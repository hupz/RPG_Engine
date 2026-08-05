// Undo/Redo для редактора (контекстная история по объекту)

(function attachEditorHistory() {
  if (typeof Editor === 'undefined') {
    console.warn('editor-history.js: Editor не определён');
    return;
  }

  const MAX_STEPS = 20;
  const DEBOUNCE_MS = 500;

  const EditorHistory = {
    stores: Object.create(null),
    _replaying: false,
    _debouncePending: Object.create(null),
    _debounceTimers: Object.create(null),
    _installed: false,
    _lastContextKey: null,

    clone(value) {
      if (value == null) return value;
      try {
        if (typeof structuredClone === 'function') return structuredClone(value);
      } catch (_) { /* fall through */ }
      return JSON.parse(JSON.stringify(value));
    },

    equal(a, b) {
      try {
        return JSON.stringify(a) === JSON.stringify(b);
      } catch (_) {
        return a === b;
      }
    },

    contextKey(ctx) {
      if (!ctx?.type || ctx.id == null || ctx.id === '') return null;
      return `${ctx.type}:${ctx.id}`;
    },

    parseContextKey(key) {
      if (!key) return null;
      const idx = key.indexOf(':');
      if (idx < 0) return null;
      return { type: key.slice(0, idx), id: key.slice(idx + 1) };
    },

    resolveUndoTarget() {
      const currentKey = this.contextKey(this.getContext());
      if (currentKey && this.stores[currentKey]?.undo.length) {
        return { key: currentKey, ctx: this.parseContextKey(currentKey) };
      }
      if (this._lastContextKey && this.stores[this._lastContextKey]?.undo.length) {
        return { key: this._lastContextKey, ctx: this.parseContextKey(this._lastContextKey) };
      }
      return null;
    },

    resolveRedoTarget() {
      const currentKey = this.contextKey(this.getContext());
      if (currentKey && this.stores[currentKey]?.redo.length) {
        return { key: currentKey, ctx: this.parseContextKey(currentKey) };
      }
      if (this._lastContextKey && this.stores[this._lastContextKey]?.redo.length) {
        return { key: this._lastContextKey, ctx: this.parseContextKey(this._lastContextKey) };
      }
      return null;
    },

    getContext() {
      if (!Editor.data) return null;
      const tab = Editor.currentTab;

      if (tab === 'scenes' && Editor.currentScene) {
        return { type: 'scene', id: Editor.currentScene };
      }
      if (tab === 'quests' && Editor.editingQuestId) {
        return { type: 'quest', id: Editor.editingQuestId };
      }
      if (tab === 'npcs' && Editor.editingNpcId) {
        return { type: 'npc', id: Editor.editingNpcId };
      }
      if (tab === 'items' && Editor.editingItemId) {
        return { type: 'item', id: Editor.editingItemId };
      }
      if (tab === 'classes' && Editor.editingClassId) {
        return { type: 'class', id: Editor.editingClassId };
      }
      return null;
    },

    resolveContext(methodName, args) {
      const argId = typeof args[0] === 'string' ? args[0] : null;

      if (methodName === 'updateItemData' || methodName === 'deleteItem') {
        return argId ? { type: 'item', id: argId } : this.getContext();
      }
      if (methodName.startsWith('updateQuest') || methodName === 'deleteQuest'
        || methodName === 'addQuestStage' || methodName === 'removeQuestStage'
        || methodName === 'setQuestStageType') {
        return argId ? { type: 'quest', id: argId } : this.getContext();
      }
      if (methodName === 'updateNPC' || methodName === 'deleteNPC') {
        return argId ? { type: 'npc', id: argId } : this.getContext();
      }
      if (methodName === 'updateClass' || methodName === 'updateClassStat'
        || methodName === 'updateClassResource' || methodName === 'deleteClass'
        || methodName === 'updateAbility' || methodName === 'updateAbilityEffectType'
        || methodName === 'updateAbilityEffectValue' || methodName === 'updateAbilityEffectDamageType'
        || methodName === 'updateAbilityBuffType' || methodName === 'updateAbilityTargeting'
        || methodName === 'toggleSavingThrow' || methodName === 'updateAbilitySave'
        || methodName === 'updateAbilityPassive' || methodName === 'setClassWeapon'
        || methodName === 'toggleStartingItem') {
        const classId = methodName === 'updateClass' || methodName === 'deleteClass'
          || methodName === 'setClassWeapon' || methodName === 'toggleStartingItem'
          ? argId
          : args[0];
        return classId ? { type: 'class', id: classId } : this.getContext();
      }
      if (methodName === 'deleteScene') {
        return argId ? { type: 'scene', id: argId } : this.getContext();
      }
      if (methodName === 'updateSceneId') {
        return Editor.currentScene ? { type: 'scene', id: Editor.currentScene } : null;
      }
      return this.getContext();
    },

    getEntity(ctx) {
      if (!Editor.data || !ctx) return null;
      const map = {
        scene: Editor.data.scenes,
        quest: Editor.data.quests,
        npc: Editor.data.npcs,
        item: Editor.data.items,
        class: Editor.data.classes
      };
      const bucket = map[ctx.type];
      return bucket?.[ctx.id] ?? null;
    },

    makeSnapshot(ctx, extraMeta) {
      const entity = this.getEntity(ctx);
      return {
        type: ctx.type,
        id: ctx.id,
        payload: entity ? this.clone(entity) : null,
        meta: { ...(extraMeta || {}) }
      };
    },

    getStore(key) {
      if (!this.stores[key]) {
        this.stores[key] = { undo: [], redo: [] };
      }
      return this.stores[key];
    },

    pushUndo(ctx, snapshot) {
      const key = this.contextKey(ctx);
      if (!key || !snapshot) return;
      const store = this.getStore(key);
      const top = store.undo[store.undo.length - 1];
      if (top && this.equal(top, snapshot)) return;

      store.undo.push(snapshot);
      while (store.undo.length > MAX_STEPS) store.undo.shift();
      store.redo = [];
      this._lastContextKey = key;
      this.updateButtons();
    },

    flushDebounce() {
      Object.keys(this._debounceTimers).forEach((key) => {
        clearTimeout(this._debounceTimers[key]);
        delete this._debounceTimers[key];
      });
      Object.keys(this._debouncePending).forEach((key) => {
        const pending = this._debouncePending[key];
        delete this._debouncePending[key];
        if (!pending) return;
        const ctx = pending.ctx;
        const current = this.makeSnapshot(ctx);
        if (!this.equal(pending.snapshot.payload, current.payload)
          || pending.snapshot.meta?.op !== current.meta?.op) {
          this.pushUndo(ctx, pending.snapshot);
        }
      });
      this.updateButtons();
    },

    trackDebouncedStart(ctx) {
      const key = this.contextKey(ctx);
      if (!key) return;
      if (!this._debouncePending[key]) {
        this._debouncePending[key] = {
          ctx,
          snapshot: this.makeSnapshot(ctx)
        };
      }
    },

    trackDebouncedEnd(ctx) {
      const key = this.contextKey(ctx);
      if (!key) return;
      clearTimeout(this._debounceTimers[key]);
      this._debounceTimers[key] = setTimeout(() => {
        delete this._debounceTimers[key];
        const pending = this._debouncePending[key];
        delete this._debouncePending[key];
        if (!pending || this._replaying) return;
        const current = this.makeSnapshot(pending.ctx);
        if (!this.equal(pending.snapshot.payload, current.payload)) {
          this.pushUndo(pending.ctx, pending.snapshot);
        }
        this.updateButtons();
      }, DEBOUNCE_MS);
    },

    recordMutation(ctx, beforeSnap) {
      if (this._replaying || !ctx || !beforeSnap) return;

      const entityBefore = beforeSnap.payload;
      const entityAfter = this.getEntity(ctx);

      if (entityBefore && !entityAfter) {
        this.pushUndo(ctx, beforeSnap);
        return;
      }

      if (!entityBefore && entityAfter) {
        this.pushUndo(ctx, {
          type: ctx.type,
          id: ctx.id,
          payload: null,
          meta: {
            op: 'create',
            createId: ctx.id,
            previousFocus: this.getFocusState(ctx.type)
          }
        });
        return;
      }

      if (entityBefore && entityAfter) {
        const afterSnap = this.makeSnapshot(ctx);
        if (!this.equal(entityBefore, afterSnap.payload)) {
          this.pushUndo(ctx, beforeSnap);
        }
      }
    },

    getFocusState(type) {
      if (type === 'scene') return { currentScene: Editor.currentScene };
      if (type === 'quest') return { editingQuestId: Editor.editingQuestId };
      if (type === 'npc') return { editingNpcId: Editor.editingNpcId };
      if (type === 'item') return { editingItemId: Editor.editingItemId };
      if (type === 'class') return { editingClassId: Editor.editingClassId };
      return {};
    },

    applyFocusState(type, meta) {
      if (!meta) return;
      if (type === 'scene' && meta.currentScene) Editor.currentScene = meta.currentScene;
      if (type === 'quest' && meta.editingQuestId != null) Editor.editingQuestId = meta.editingQuestId;
      if (type === 'npc' && meta.editingNpcId != null) Editor.editingNpcId = meta.editingNpcId;
      if (type === 'item' && meta.editingItemId != null) Editor.editingItemId = meta.editingItemId;
      if (type === 'class' && meta.editingClassId != null) Editor.editingClassId = meta.editingClassId;
    },

    fixSceneReferences(oldId, newId) {
      if (!Editor.data?.scenes || oldId === newId) return;
      Object.values(Editor.data.scenes).forEach((scene) => {
        if (!scene) return;
        if (scene.nextScene === oldId) scene.nextScene = newId;
        (scene.choices || []).forEach((ch) => {
          if (ch?.to === oldId) ch.to = newId;
        });
        if (scene.hubScene === oldId) scene.hubScene = newId;
      });
    },

    applySnapshot(snapshot) {
      if (!Editor.data || !snapshot) return;

      const { type, id, payload, meta } = snapshot;

      if (meta?.op === 'create') {
        const createId = meta.createId || id;
        if (Editor.data[this.bucketName(type)]) {
          delete Editor.data[this.bucketName(type)][createId];
        }
        this.applyFocusState(type, meta.previousFocus);
        return;
      }

      const bucket = Editor.data[this.bucketName(type)];
      if (!bucket) return;

      if (meta?.op === 'rename') {
        const oldId = meta.oldId || id;
        const newId = meta.newId;
        if (newId && bucket[newId]) {
          bucket[oldId] = this.clone(payload);
          delete bucket[newId];
          this.fixSceneReferences(newId, oldId);
          if (type === 'scene') Editor.currentScene = oldId;
        }
        return;
      }

      if (payload == null) {
        delete bucket[id];
        return;
      }

      bucket[id] = this.clone(payload);
      if (type === 'scene') Editor.currentScene = id;
      if (type === 'quest') Editor.editingQuestId = id;
      if (type === 'npc') Editor.editingNpcId = id;
      if (type === 'item') Editor.editingItemId = id;
      if (type === 'class') Editor.editingClassId = id;
    },

    bucketName(type) {
      const map = {
        scene: 'scenes',
        quest: 'quests',
        npc: 'npcs',
        item: 'items',
        class: 'classes'
      };
      return map[type];
    },

    refreshUi(type) {
      if (typeof Editor.updateJSONPreview === 'function') Editor.updateJSONPreview();
      if (type === 'scene') {
        if (typeof Editor.renderSceneList === 'function') Editor.renderSceneList();
        if (typeof Editor.renderSceneEditor === 'function') Editor.renderSceneEditor();
        if (typeof Editor.scheduleLivePreviewUpdate === 'function') Editor.scheduleLivePreviewUpdate();
      }
      if (type === 'quest' && typeof Editor.renderQuests === 'function') Editor.renderQuests();
      if (type === 'npc' && typeof Editor.renderNPCs === 'function') Editor.renderNPCs();
      if (type === 'item' && typeof Editor.renderItems === 'function') Editor.renderItems();
      if (type === 'class' && typeof Editor.renderClasses === 'function') Editor.renderClasses();
      if (typeof Editor.renderStats === 'function') Editor.renderStats();
    },

    undo() {
      const target = this.resolveUndoTarget();
      if (!target) return;
      const { key, ctx } = target;
      const store = this.getStore(key);

      this.flushDebounce();
      this._replaying = true;
      const current = this.makeSnapshot(ctx);
      const prev = store.undo.pop();
      store.redo.push(current);
      this.applySnapshot(prev);
      this.refreshUi(ctx.type);
      this._replaying = false;
      this._lastContextKey = key;
      this.updateButtons();
    },

    redo() {
      const target = this.resolveRedoTarget();
      if (!target) return;
      const { key, ctx } = target;
      const store = this.getStore(key);

      this._replaying = true;
      const current = this.makeSnapshot(ctx);
      const next = store.redo.pop();
      store.undo.push(current);
      this.applySnapshot(next);
      this.refreshUi(ctx.type);
      this._replaying = false;
      this._lastContextKey = key;
      this.updateButtons();
    },

    resetAll() {
      this.flushDebounce();
      this.stores = Object.create(null);
      this._lastContextKey = null;
      this.updateButtons();
    },

    canUndo() {
      return !!this.resolveUndoTarget();
    },

    canRedo() {
      return !!this.resolveRedoTarget();
    },

    updateButtons() {
      const undoBtn = document.getElementById('editor-undo-btn');
      const redoBtn = document.getElementById('editor-redo-btn');
      if (undoBtn) undoBtn.disabled = !this.canUndo();
      if (redoBtn) redoBtn.disabled = !this.canRedo();
    },

    recordCreate(type, createId, focusBefore) {
      if (!createId) return;
      const ctx = { type, id: createId };
      this.pushUndo(ctx, {
        type,
        id: createId,
        payload: null,
        meta: { op: 'create', createId, previousFocus: focusBefore || this.getFocusState(type) }
      });
    },

    wrapImmediate(name) {
      const orig = Editor[name];
      if (typeof orig !== 'function') return;

      const createTypeMap = {
        createNPC: 'npc',
        createQuest: 'quest',
        createItem: 'item',
        createClass: 'class'
      };

      Editor[name] = (...args) => {
        if (this._replaying) return orig.apply(Editor, args);

        const createType = createTypeMap[name];
        if (createType) {
          const bucket = this.bucketName(createType);
          const focusBefore = this.getFocusState(createType);
          const keysBefore = new Set(Object.keys(Editor.data?.[bucket] || {}));
          const result = orig.apply(Editor, args);
          const keysAfter = Object.keys(Editor.data?.[bucket] || {});
          const newId = keysAfter.find((k) => !keysBefore.has(k));
          if (newId) this.recordCreate(createType, newId, focusBefore);
          this.updateButtons();
          return result;
        }

        const ctx = this.resolveContext(name, args);
        const before = ctx ? this.makeSnapshot(ctx) : null;
        const result = orig.apply(Editor, args);

        if (ctx && before) {
          if (name === 'updateSceneId') {
            const oldId = before.id;
            const newId = args[0];
            if (oldId && newId && oldId !== newId && Editor.data.scenes[newId]) {
              this.pushUndo(ctx, {
                ...before,
                meta: { op: 'rename', oldId, newId }
              });
            } else {
              this.recordMutation(ctx, before);
            }
          } else if (name === 'commitTemplateScene') {
            const spec = typeof Editor.readTemplateFormParams === 'function'
              ? Editor.readTemplateFormParams()
              : null;
            const sceneId = spec?.id;
            const prevScene = before?.id || Editor.currentScene;
            if (sceneId && Editor.data.scenes?.[sceneId]) {
              this.recordCreate('scene', sceneId, { currentScene: prevScene });
            }
          } else {
            this.recordMutation(ctx, before);
          }
        }
        this.updateButtons();
        return result;
      };
    },

    wrapDebounced(name) {
      const orig = Editor[name];
      if (typeof orig !== 'function') return;
      Editor[name] = (...args) => {
        if (this._replaying) return orig.apply(Editor, args);
        const ctx = this.resolveContext(name, args);
        if (ctx) this.trackDebouncedStart(ctx);
        const result = orig.apply(Editor, args);
        if (ctx) this.trackDebouncedEnd(ctx);
        return result;
      };
    },

    installHooks() {
      if (this._installed) return;
      this._installed = true;

      const immediate = [
        'deleteScene', 'addDialogue', 'removeDialogue', 'addChoice', 'removeChoice',
        'addEnemyToCombat', 'removeEnemyFromCombat', 'addFlag', 'removeFlag', 'updateFlagKey',
        'addItem', 'removeItem', 'updateSceneId', 'commitTemplateScene',
        'createQuest', 'deleteQuest', 'addQuestStage', 'removeQuestStage',
        'createNPC', 'deleteNPC', 'createItem', 'deleteItem',
        'createClass', 'deleteClass', 'addAbility', 'deleteAbility',
        'setChoiceIcon', 'setSceneReturnsToHub', 'setSceneHubScene',
        'setQuestStageType'
      ];

      const debounced = [
        'updateSceneField', 'updateDialogue', 'updateChoice', 'updateFlagValue',
        'setSceneNpcId', 'updateQuestMeta', 'updateQuestReward', 'updateQuestStageField',
        'updateQuestReputation', 'updateNPC', 'updateItemData',
        'updateClass', 'updateClassStat', 'updateClassResource', 'updateAbility',
        'updateAbilityEffectType', 'updateAbilityEffectValue', 'updateAbilityEffectDamageType',
        'updateAbilityBuffType', 'updateAbilityTargeting', 'toggleSavingThrow',
        'updateAbilitySave', 'updateAbilityPassive', 'setClassWeapon', 'toggleStartingItem',
        'updateItem'
      ];

      immediate.forEach((n) => this.wrapImmediate(n));
      debounced.forEach((n) => this.wrapDebounced(n));

      const wrapNav = (name) => {
        const orig = Editor[name];
        if (typeof orig !== 'function') return;
        Editor[name] = (...args) => {
          this.flushDebounce();
          const result = orig.apply(Editor, args);
          this.updateButtons();
          return result;
        };
      };

      [
        'selectScene', 'switchTab', 'selectQuestToEdit', 'selectNpcToEdit',
        'selectClassToEdit', 'selectItemToEdit'
      ].forEach(wrapNav);

      if (typeof Editor.confirmNewProject === 'function') {
        const orig = Editor.confirmNewProject.bind(Editor);
        Editor.confirmNewProject = (...args) => {
          const result = orig(...args);
          this.resetAll();
          return result;
        };
      }

      if (typeof Editor._loadDataFromFile === 'function') {
        const orig = Editor._loadDataFromFile.bind(Editor);
        Editor._loadDataFromFile = (...args) => {
          this.resetAll();
          return orig(...args);
        };
      }
    },

    initUi() {
      if (document.getElementById('editor-undo-btn')) return;

      const host = document.querySelector('.header-buttons') || document.querySelector('.tabs-bar');
      if (!host) return;

      const controls = document.createElement('div');
      controls.className = 'editor-history-controls';
      controls.innerHTML = `
        <button type="button" id="editor-undo-btn" class="btn btn-secondary" disabled
          title="Отменить (Ctrl+Z)">↩ Отменить</button>
        <button type="button" id="editor-redo-btn" class="btn btn-secondary" disabled
          title="Повторить (Ctrl+Y)">↪ Повторить</button>`;
      host.insertBefore(controls, host.firstChild);

      controls.querySelector('#editor-undo-btn').addEventListener('click', () => this.undo());
      controls.querySelector('#editor-redo-btn').addEventListener('click', () => this.redo());
    },

    bindHotkeys() {
      document.addEventListener('keydown', (e) => {
        if (!Editor.data) return;
        if (!e.ctrlKey && !e.metaKey) return;

        const key = e.key.toLowerCase();
        if (key === 'z' && !e.shiftKey) {
          e.preventDefault();
          this.undo();
        } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
          e.preventDefault();
          this.redo();
        }
      });
    },

    bindFormFallback() {
      const root = document.querySelector('.main-area');
      if (!root) return;

      const onEdit = (e) => {
        if (this._replaying) return;
        const el = e.target;
        if (!el || !['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;
        if (el.closest('.editor-history-controls')) return;
        const ctx = this.getContext();
        if (!ctx) return;
        this.trackDebouncedStart(ctx);
        this.trackDebouncedEnd(ctx);
      };

      root.addEventListener('input', onEdit, true);
      root.addEventListener('change', onEdit, true);
    },

    init() {
      this.installHooks();
      this.initUi();
      this.bindHotkeys();
      this.bindFormFallback();
      this.updateButtons();
    }
  };

  window.EditorHistory = EditorHistory;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => EditorHistory.init());
  } else {
    EditorHistory.init();
  }
})();
