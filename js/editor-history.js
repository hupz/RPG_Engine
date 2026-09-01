// Undo/Redo для редактора (контекстная история по объекту)
//
// Согласование с editor-autosave.js (порядок применения):
// 1. Undo/redo: flushDebounce → _replaying=true → applySnapshot → refreshUi → _replaying=false.
//    Пока _replaying, autosave не планирует снимок (см. editor-autosave.js).
// 2. После отката updateJSONPreview планирует recovery-снимок уже откатанного состояния —
//    это нормально: autosave = «черновик на диске», undo = «шаги в памяти сессии».
// 3. resetAll() при новом/загруженном проекте очищает undo; localStorage autosave не трогаем.
// 4. Восстановление из autosave через applyRecovery не попадает в undo-стек.
//
// Стратегия памяти (50 шагов, потолок ~4 МБ на все стеки):
// — payload < 32 КБ: полный JSON-clone (быстрый apply);
// — visual / choice / project: всегда только поддерево (visual, choice[idx], meta+startScene);
// — scene > 32 КБ: храним без visual.nodes (дифф по смыслу: текст/выборы отдельно от тяжёлого visual).

(function attachEditorHistory() {
  if (typeof Editor === 'undefined') {
    console.warn('editor-history.js: Editor не определён');
    return;
  }

  const MAX_STEPS = 50;
  const MAX_MEMORY_BYTES = 4 * 1024 * 1024;
  const FULL_SNAPSHOT_MAX_BYTES = 32 * 1024;
  const DEBOUNCE_MS = 500;
  const PROJECT_CTX_ID = 'settings';

  const EditorHistory = {
    stores: Object.create(null),
    _replaying: false,
    _debouncePending: Object.create(null),
    _debounceTimers: Object.create(null),
    _installed: false,
    _lastContextKey: null,
    _memoryBytes: 0,
    _globalOrder: [],

    clone(value) {
      if (value == null) return value;
      try {
        if (typeof structuredClone === 'function') return structuredClone(value);
      } catch (_) { /* fall through */ }
      return JSON.parse(JSON.stringify(value));
    },

    estimateBytes(value) {
      try {
        return JSON.stringify(value).length;
      } catch (_) {
        return 0;
      }
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

    parseChoiceId(id) {
      const sep = String(id).lastIndexOf(':');
      if (sep < 0) return null;
      const sceneId = id.slice(0, sep);
      const idx = parseInt(id.slice(sep + 1), 10);
      if (!sceneId || Number.isNaN(idx)) return null;
      return { sceneId, idx };
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
        if (Editor._historyChoiceIndex != null && Editor._historyChoiceIndex >= 0) {
          return { type: 'choice', id: `${Editor.currentScene}:${Editor._historyChoiceIndex}` };
        }
        if (Editor._visualSceneActive) {
          return { type: 'visual', id: Editor.currentScene };
        }
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
      if (tab === 'dashboard' || tab === 'json' || tab === 'theme') {
        return { type: 'project', id: PROJECT_CTX_ID };
      }
      return null;
    },

    resolveContext(methodName, args) {
      const argId = typeof args[0] === 'string' ? args[0] : null;
      const argIdx = typeof args[0] === 'number' ? args[0] : null;

      if (methodName === 'updateChoice' || methodName === 'setChoiceIcon'
        || methodName === 'updateChoiceQuestSet' || methodName === 'moveChoice') {
        const idx = argIdx != null ? argIdx : args[0];
        if (Editor.currentScene != null && idx != null && !Number.isNaN(Number(idx))) {
          return { type: 'choice', id: `${Editor.currentScene}:${idx}` };
        }
      }
      if (methodName === 'applyProjectSettings' || methodName === 'setProjectStartScene'
        || methodName === 'setProjectCover' || methodName === 'removeProjectCover') {
        return { type: 'project', id: PROJECT_CTX_ID };
      }
      if (methodName === 'updateItemData' || methodName === 'deleteItem') {
        return argId ? { type: 'item', id: argId } : this.getContext();
      }
      if (methodName.startsWith('updateQuest') || methodName === 'deleteQuest'
        || methodName === 'addQuestStage' || methodName === 'removeQuestStage'
        || methodName === 'addQuestTask' || methodName === 'addQuestTaskOfType'
        || methodName === 'removeQuestTask' || methodName === 'changeQuestTaskType'
        || methodName === 'setQuestStageType'
        || methodName === 'moveQuestStage' || methodName === 'moveQuestTask'
        || methodName === 'moveQuestStageWithHistory' || methodName === 'moveQuestTaskWithHistory') {
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
      if (methodName === 'deleteScene' || methodName === 'deleteSceneSafe') {
        return argId ? { type: 'scene', id: argId } : this.getContext();
      }
      if (methodName === 'updateSceneId') {
        return Editor.currentScene ? { type: 'scene', id: Editor.currentScene } : null;
      }
      if (methodName === 'createBlankScene' || methodName === 'createSceneWithWizard'
        || methodName === 'duplicateScene') {
        return null;
      }
      return this.getContext();
    },

    getProjectSettingsSlice() {
      if (!Editor.data) return null;
      return {
        meta: this.clone(Editor.data.meta || {}),
        startScene: Editor.data.startScene,
        metaStartScene: Editor.data.meta?.startScene
      };
    },

    applyProjectSettingsSlice(slice) {
      if (!Editor.data || !slice) return;
      if (slice.meta) Editor.data.meta = this.clone(slice.meta);
      if (slice.startScene !== undefined) Editor.data.startScene = slice.startScene;
      if (slice.metaStartScene !== undefined) {
        if (!Editor.data.meta) Editor.data.meta = {};
        if (slice.metaStartScene == null) delete Editor.data.meta.startScene;
        else Editor.data.meta.startScene = slice.metaStartScene;
      }
    },

    extractPayload(ctx) {
      if (!Editor.data || !ctx) return null;
      if (ctx.type === 'project') {
        return this.getProjectSettingsSlice();
      }
      if (ctx.type === 'choice') {
        const parsed = this.parseChoiceId(ctx.id);
        if (!parsed) return null;
        const ch = Editor.data.scenes?.[parsed.sceneId]?.choices?.[parsed.idx];
        return ch ? this.clone(ch) : null;
      }
      if (ctx.type === 'visual') {
        const visual = Editor.data.scenes?.[ctx.id]?.visual;
        return visual ? this.clone(visual) : null;
      }
      const entity = this.getEntityRaw(ctx);
      if (!entity) return null;
      const cloned = this.clone(entity);
      const bytes = this.estimateBytes(cloned);
      if (ctx.type === 'scene' && bytes > FULL_SNAPSHOT_MAX_BYTES && cloned.visual) {
        const slim = this.clone(cloned);
        if (slim.visual?.nodes?.length) {
          slim.visual = Object.assign({}, slim.visual, {
            nodes: [],
            _historyOmittedNodes: cloned.visual.nodes.length
          });
        }
        return { storage: 'scene-slim', payload: slim, visualNodes: this.clone(cloned.visual.nodes) };
      }
      return cloned;
    },

    getEntityRaw(ctx) {
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

    getEntity(ctx) {
      const raw = this.extractPayload(ctx);
      if (raw && raw.storage === 'scene-slim') return raw.payload;
      return raw;
    },

    makeSnapshot(ctx, extraMeta) {
      const payload = this.extractPayload(ctx);
      return {
        type: ctx.type,
        id: ctx.id,
        payload,
        meta: { ...(extraMeta || {}) }
      };
    },

    captureSceneInboundSnapshot(sceneId) {
      const refs = typeof Editor.findSceneInboundReferences === 'function'
        ? Editor.findSceneInboundReferences(sceneId)
        : [];
      return {
        refs: this.clone(refs),
        startScene: Editor.data?.startScene,
        metaStartScene: Editor.data?.meta?.startScene
      };
    },

    warnInboundRefsAfterRestore(sceneId, inboundSnap) {
      if (!inboundSnap?.refs?.length) return;
      const current = typeof Editor.findSceneInboundReferences === 'function'
        ? Editor.findSceneInboundReferences(sceneId)
        : [];
      const missing = [];
      for (const expected of inboundSnap.refs) {
        const found = current.some((r) =>
          r.kind === expected.kind && r.fromId === expected.fromId && r.path === expected.path
        );
        if (!found) missing.push(expected);
      }
      if (missing.length && Editor.toast) {
        const lines = missing.slice(0, 5).map((r) =>
          `• [${r.kind}] ${r.fromId}${r.label ? ' — ' + r.label : ''}`
        ).join('\n');
        Editor.toast.warning(
          `Сцена «${sceneId}» восстановлена, но ${missing.length} входящих ссылок не указывают на неё` +
          (missing.length > 5 ? ' (показаны первые 5)' : '') + ':\n' + lines
        );
      }
    },

    warnDanglingRefsOnCreateUndo(sceneId) {
      const refs = typeof Editor.findSceneInboundReferences === 'function'
        ? Editor.findSceneInboundReferences(sceneId)
        : [];
      if (refs.length && Editor.toast) {
        Editor.toast.warning(
          `Создание сцены «${sceneId}» отменено, но ${refs.length} ссылок в проекте всё ещё указывают на неё (битые ссылки).`
        );
      }
    },

    getStore(key) {
      if (!this.stores[key]) {
        this.stores[key] = { undo: [], redo: [] };
      }
      return this.stores[key];
    },

    _trackSnapshotMemory(snapshot, deltaSign) {
      const bytes = snapshot._bytes || this.estimateBytes(snapshot);
      snapshot._bytes = bytes;
      this._memoryBytes += deltaSign * bytes;
    },

    _evictOldestEntry() {
      if (!this._globalOrder.length) return;
      const oldest = this._globalOrder.shift();
      if (!oldest) return;
      const store = this.stores[oldest.key];
      const entry = store?.undo?.shift();
      if (entry) this._trackSnapshotMemory(entry, -1);
    },

    enforceLimits(store, key) {
      while (store.undo.length > MAX_STEPS) {
        const removed = store.undo.shift();
        if (removed) {
          this._trackSnapshotMemory(removed, -1);
          const gi = this._globalOrder.findIndex((e) => e.key === key && e.snapshot === removed);
          if (gi >= 0) this._globalOrder.splice(gi, 1);
        }
      }
      while (this._memoryBytes > MAX_MEMORY_BYTES && this._globalOrder.length) {
        this._evictOldestEntry();
      }
    },

    pushUndo(ctx, snapshot) {
      const key = this.contextKey(ctx);
      if (!key || !snapshot) return;
      const store = this.getStore(key);
      const top = store.undo[store.undo.length - 1];
      if (top && this.equal(top, snapshot)) return;

      store.undo.push(snapshot);
      this._trackSnapshotMemory(snapshot, 1);
      this._globalOrder.push({ key, snapshot, ts: Date.now() });
      this.enforceLimits(store, key);
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
      const entityAfter = this.extractPayload(ctx);

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
      if (type === 'scene' || type === 'visual' || type === 'choice') {
        return { currentScene: Editor.currentScene };
      }
      if (type === 'quest') return { editingQuestId: Editor.editingQuestId };
      if (type === 'npc') return { editingNpcId: Editor.editingNpcId };
      if (type === 'item') return { editingItemId: Editor.editingItemId };
      if (type === 'class') return { editingClassId: Editor.editingClassId };
      if (type === 'project') return { currentTab: Editor.currentTab };
      return {};
    },

    applyFocusState(type, meta) {
      if (!meta) return;
      if ((type === 'scene' || type === 'visual' || type === 'choice') && meta.currentScene) {
        Editor.currentScene = meta.currentScene;
      }
      if (type === 'quest' && meta.editingQuestId != null) Editor.editingQuestId = meta.editingQuestId;
      if (type === 'npc' && meta.editingNpcId != null) Editor.editingNpcId = meta.editingNpcId;
      if (type === 'item' && meta.editingItemId != null) Editor.editingItemId = meta.editingItemId;
      if (type === 'class' && meta.editingClassId != null) Editor.editingClassId = meta.editingClassId;
      if (type === 'project' && meta.currentTab && typeof Editor.switchTab === 'function') {
        try { Editor.switchTab(meta.currentTab); } catch (_) { /* */ }
      }
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

    applyPayloadToContext(ctx, payload) {
      if (!Editor.data || !ctx) return;
      if (ctx.type === 'project') {
        this.applyProjectSettingsSlice(payload);
        return;
      }
      if (ctx.type === 'choice') {
        const parsed = this.parseChoiceId(ctx.id);
        if (!parsed) return;
        const scene = Editor.data.scenes?.[parsed.sceneId];
        if (!scene) return;
        if (!Array.isArray(scene.choices)) scene.choices = [];
        if (payload == null) {
          scene.choices.splice(parsed.idx, 1);
        } else {
          scene.choices[parsed.idx] = this.clone(payload);
        }
        return;
      }
      if (ctx.type === 'visual') {
        const scene = Editor.data.scenes?.[ctx.id];
        if (!scene) return;
        if (payload == null) delete scene.visual;
        else scene.visual = this.clone(payload);
        return;
      }
      const bucketName = this.bucketName(ctx.type);
      const bucket = Editor.data[bucketName];
      if (!bucket) return;

      if (payload && payload.storage === 'scene-slim') {
        const base = this.clone(payload.payload);
        if (payload.visualNodes && base.visual) {
          base.visual.nodes = this.clone(payload.visualNodes);
          delete base.visual._historyOmittedNodes;
        }
        bucket[ctx.id] = base;
        return;
      }

      if (payload == null) {
        delete bucket[ctx.id];
        return;
      }
      bucket[ctx.id] = this.clone(payload);
    },

    applySnapshot(snapshot) {
      if (!Editor.data || !snapshot) return;

      const { type, id, payload, meta } = snapshot;

      if (meta?.op === 'create') {
        const createId = meta.createId || id;
        if (type === 'scene' && Editor.data.scenes) {
          this.warnDanglingRefsOnCreateUndo(createId);
          delete Editor.data.scenes[createId];
        } else {
          const bucket = this.bucketName(type);
          if (bucket && Editor.data[bucket]) delete Editor.data[bucket][createId];
        }
        this.applyFocusState(type, meta.previousFocus);
        return;
      }

      if (type === 'scene' && meta?.op !== 'rename' && payload != null) {
        this.applyPayloadToContext(snapshot, payload);
        Editor.currentScene = id;
        if (meta.inboundSnapshot) {
          this.warnInboundRefsAfterRestore(id, meta.inboundSnapshot);
        }
        return;
      }

      if (meta?.op === 'rename') {
        const bucket = Editor.data[this.bucketName(type)];
        const oldId = meta.oldId || id;
        const newId = meta.newId;
        if (newId && bucket?.[newId]) {
          bucket[oldId] = this.clone(payload);
          delete bucket[newId];
          this.fixSceneReferences(newId, oldId);
          if (type === 'scene') Editor.currentScene = oldId;
        }
        return;
      }

      this.applyPayloadToContext(snapshot, payload);

      if (type === 'scene') Editor.currentScene = id;
      if (type === 'visual') Editor.currentScene = id;
      if (type === 'choice') {
        const parsed = this.parseChoiceId(id);
        if (parsed) Editor.currentScene = parsed.sceneId;
      }
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
      if (type === 'scene' || type === 'choice' || type === 'visual') {
        if (typeof Editor.renderSceneList === 'function') Editor.renderSceneList();
        if (typeof Editor.renderSceneEditor === 'function') Editor.renderSceneEditor();
        if (typeof Editor.scheduleLivePreviewUpdate === 'function') Editor.scheduleLivePreviewUpdate();
        if (type === 'visual' && typeof Editor.renderVisualScenePanel === 'function') {
          Editor.renderVisualScenePanel();
        }
        if (type === 'choice' && typeof Editor.updateChoicePreview === 'function') {
          Editor.updateChoicePreview();
        }
      }
      if (type === 'project') {
        if (typeof Editor.updateProjectPanel === 'function') Editor.updateProjectPanel();
        if (typeof Editor.renderDashboard === 'function' && Editor.currentTab === 'dashboard') {
          const dash = document.getElementById('dashboard-content');
          if (dash) dash.innerHTML = Editor.renderDashboard();
        }
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
      if (prev) {
        this._trackSnapshotMemory(prev, -1);
        const gi = this._globalOrder.findIndex((e) => e.snapshot === prev);
        if (gi >= 0) this._globalOrder.splice(gi, 1);
      }
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
      store.undo.push(next);
      if (next) {
        this._trackSnapshotMemory(next, 1);
        this._globalOrder.push({ key, snapshot: next, ts: Date.now() });
      }
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
      this._memoryBytes = 0;
      this._globalOrder = [];
      this.updateButtons();
    },

    canUndo() {
      return !!this.resolveUndoTarget();
    },

    canRedo() {
      return !!this.resolveRedoTarget();
    },

    getAvailableUndoSteps() {
      const target = this.resolveUndoTarget();
      if (!target) return 0;
      return this.getStore(target.key).undo.length;
    },

    getAvailableRedoSteps() {
      const target = this.resolveRedoTarget();
      if (!target) return 0;
      return this.getStore(target.key).redo.length;
    },

    formatUndoButtonLabel() {
      const n = this.getAvailableUndoSteps();
      return n ? `↶ Undo (${n})` : '↶ Undo';
    },

    formatRedoButtonLabel() {
      const n = this.getAvailableRedoSteps();
      return n ? `↷ Redo (${n})` : '↷ Redo';
    },

    formatUndoCommandTitle() {
      const n = this.getAvailableUndoSteps();
      return n ? `Отменить (${n})` : 'Отменить';
    },

    formatRedoCommandTitle() {
      const n = this.getAvailableRedoSteps();
      return n ? `Повторить (${n})` : 'Повторить';
    },

    updateButtons() {
      const undoBtn = document.getElementById('editor-undo-btn');
      const redoBtn = document.getElementById('editor-redo-btn');
      if (undoBtn) {
        undoBtn.disabled = !this.canUndo();
        undoBtn.textContent = this.formatUndoButtonLabel();
      }
      if (redoBtn) {
        redoBtn.disabled = !this.canRedo();
        redoBtn.textContent = this.formatRedoButtonLabel();
      }
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

    recordSceneCreate(newId, focusBefore) {
      if (!newId) return;
      this.recordCreate('scene', newId, focusBefore || this.getFocusState('scene'));
    },

    wrapImmediate(name) {
      const orig = Editor[name];
      if (typeof orig !== 'function') return;
      if (orig.__historyWrapped) return;

      const createTypeMap = {
        createNPC: 'npc',
        createQuest: 'quest',
        createItem: 'item',
        createClass: 'class'
      };

      const sceneCreateMethods = new Set([
        'createBlankScene', 'createSceneWithWizard', 'duplicateScene'
      ]);

      const wrappedImm = (...args) => {
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

        if (sceneCreateMethods.has(name)) {
          const focusBefore = this.getFocusState('scene');
          const keysBefore = new Set(Object.keys(Editor.data?.scenes || {}));
          const result = orig.apply(Editor, args);
          let newId = null;
          if (name === 'duplicateScene' && typeof args[0] === 'string') {
            const keysAfter = Object.keys(Editor.data?.scenes || {});
            newId = keysAfter.find((k) => !keysBefore.has(k));
          } else if (typeof result === 'string') {
            newId = result;
          } else {
            const keysAfter = Object.keys(Editor.data?.scenes || {});
            newId = keysAfter.find((k) => !keysBefore.has(k));
          }
          if (newId) this.recordSceneCreate(newId, focusBefore);
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
              this.recordSceneCreate(sceneId, { currentScene: prevScene });
            }
          } else if (name === 'deleteScene' || name === 'deleteSceneSafe') {
            const sceneId = args[0] || ctx.id;
            const deleted = !Editor.data.scenes?.[sceneId];
            if (deleted) {
              before.meta = Object.assign({}, before.meta, {
                op: 'delete',
                inboundSnapshot: this.captureSceneInboundSnapshot(sceneId)
              });
              this.pushUndo(ctx, before);
            }
          } else {
            this.recordMutation(ctx, before);
          }
        }
        this.updateButtons();
        return result;
      };
      wrappedImm.__historyWrapped = true;
      Editor[name] = wrappedImm;
    },

    wrapDebounced(name) {
      const orig = Editor[name];
      if (typeof orig !== 'function') return;
      if (orig.__historyWrapped) return;
      const wrappedDeb = (...args) => {
        if (this._replaying) return orig.apply(Editor, args);
        const ctx = this.resolveContext(name, args);
        if (ctx) this.trackDebouncedStart(ctx);
        const result = orig.apply(Editor, args);
        if (ctx) this.trackDebouncedEnd(ctx);
        return result;
      };
      wrappedDeb.__historyWrapped = true;
      Editor[name] = wrappedDeb;
    },

    installHooks() {
      this._installed = true;

      const immediate = [
        'deleteScene', 'deleteSceneSafe', 'addDialogue', 'removeDialogue', 'addChoice', 'removeChoice',
        'moveChoice', 'addEnemyToCombat', 'removeEnemyFromCombat', 'addFlag', 'removeFlag', 'updateFlagKey',
        'addItem', 'removeItem', 'updateSceneId', 'commitTemplateScene',
        'createQuest', 'deleteQuest', 'addQuestStage', 'removeQuestStage',
        'addQuestTask', 'addQuestTaskOfType', 'removeQuestTask', 'changeQuestTaskType',
        'createNPC', 'deleteNPC', 'createItem', 'deleteItem',
        'createClass', 'deleteClass', 'addAbility', 'deleteAbility',
        'setChoiceIcon', 'setSceneReturnsToHub', 'setSceneHubScene',
        'setQuestStageType', 'moveQuestStage', 'moveQuestTask',
        'createBlankScene', 'createSceneWithWizard', 'duplicateScene',
        'applyProjectSettings', 'setProjectStartScene', 'setProjectCover', 'removeProjectCover'
      ];

      const debounced = [
        'updateSceneField', 'updateDialogue', 'updateChoice', 'updateChoiceQuestSet', 'updateFlagValue',
        'setSceneNpcId', 'updateQuestMeta', 'updateQuestReward', 'updateQuestStageField',
        'updateQuestReputation', 'updateQuestTaskField', 'updateNPC', 'updateItemData',
        'updateClass', 'updateClassStat', 'updateClassResource', 'updateAbility',
        'updateAbilityEffectType', 'updateAbilityEffectValue', 'updateAbilityEffectDamageType',
        'updateAbilityBuffType', 'updateAbilityTargeting', 'toggleSavingThrow',
        'updateAbilitySave', 'updateAbilityPassive', 'setClassWeapon', 'toggleStartingItem',
        'updateItem', 'addItemBonus', 'updateItemBonus', 'removeItemBonus'
      ];

      immediate.forEach((n) => this.wrapImmediate(n));
      debounced.forEach((n) => this.wrapDebounced(n));

      const navMethods = [
        'selectScene', 'switchTab', 'selectQuestToEdit', 'selectNpcToEdit',
        'selectClassToEdit', 'selectItemToEdit'
      ];
      if (Editor.hooks && typeof Editor.hooks.before === 'function') {
        navMethods.forEach((name) => {
          if (typeof Editor[name] !== 'function') return;
          Editor.hooks.before(name, (args) => {
            this.flushDebounce();
            return args;
          });
          Editor.hooks.after(name, (result) => {
            this.updateButtons();
            return result;
          });
        });
      } else {
        navMethods.forEach((name) => {
          const orig = Editor[name];
          if (typeof orig !== 'function' || orig.__historyWrapped) return;
          const wrappedNav = (...args) => {
            this.flushDebounce();
            const result = orig.apply(Editor, args);
            this.updateButtons();
            return result;
          };
          wrappedNav.__historyWrapped = true;
          Editor[name] = wrappedNav;
        });
      }

      if (typeof Editor.confirmNewProject === 'function' && !Editor.confirmNewProject.__historyResetWrapped) {
        const orig = Editor.confirmNewProject.bind(Editor);
        const wrapped = (...args) => {
          const result = orig(...args);
          this.resetAll();
          return result;
        };
        wrapped.__historyResetWrapped = true;
        Editor.confirmNewProject = wrapped;
      }

      if (typeof Editor._loadDataFromFile === 'function' && !Editor._loadDataFromFile.__historyResetWrapped) {
        const orig = Editor._loadDataFromFile.bind(Editor);
        const wrapped = (...args) => {
          this.resetAll();
          return orig(...args);
        };
        wrapped.__historyResetWrapped = true;
        Editor._loadDataFromFile = wrapped;
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
          title="Undo (Ctrl+Z)">↶ Undo</button>
        <button type="button" id="editor-redo-btn" class="btn btn-secondary" disabled
          title="Redo (Ctrl+Shift+Z)">↷ Redo</button>`;
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
      if (typeof setTimeout === 'function') {
        setTimeout(() => { this.installHooks(); this.updateButtons(); }, 200);
        setTimeout(() => { this.installHooks(); this.updateButtons(); }, 800);
      }
    }
  };

  window.EditorHistory = EditorHistory;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => EditorHistory.init());
  } else {
    EditorHistory.init();
  }
})();
