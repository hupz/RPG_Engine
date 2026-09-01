// ============================================================
// Editor Inspector — правая панель свойств выбранного объекта
// Registry: type → inspector { id, label, render(ctx) }
// Новые типы подключаются без изменения core.
// ============================================================
(function attachEditorInspector() {
  'use strict';
  if (typeof Editor === 'undefined') {
    console.error('editor-inspector: Editor missing');
    return;
  }

  /** @type {Map<string, { id: string, label: string, render: Function }>} */
  const registry = new Map();

  const Inspector = {
    registry,

    /**
     * @param {string} type
     * @param {{ label?: string, render: (ctx: object) => string }} def
     */
    register(type, def) {
      if (!type || !def || typeof def.render !== 'function') {
        console.warn('[Inspector] invalid register', type, def);
        return;
      }
      registry.set(type, {
        id: type,
        label: def.label || type,
        render: def.render.bind(def)
      });
    },

    get(type) {
      return registry.get(type) || null;
    },

    list() {
      return Array.from(registry.keys());
    },

    /** Текущий выбор: { type, id, stageIndex?, taskIndex?, meta? } */
    selection: null,

    select(sel) {
      if (!sel || !sel.type) {
        this.selection = null;
      } else {
        this.selection = Object.assign({}, sel);
      }
      this.render();
    },

    clear() {
      this.selection = null;
      this.render();
    },

    ensurePanel() {
      if (typeof document === 'undefined') return null;
      let panel = document.getElementById('editor-inspector');
      if (panel) return panel;
      const workspace = document.querySelector('.editor-workspace');
      if (!workspace) return null;
      panel = document.createElement('aside');
      panel.id = 'editor-inspector';
      panel.className = 'editor-inspector';
      panel.setAttribute('aria-label', 'Свойства');
      panel.innerHTML = `
        <div class="editor-inspector-head">
          <h3>Свойства</h3>
          <button type="button" class="btn-remove editor-inspector-close" title="Скрыть" aria-label="Скрыть">×</button>
        </div>
        <div class="editor-inspector-body" id="editor-inspector-body"></div>`;
      workspace.appendChild(panel);
      panel.querySelector('.editor-inspector-close')?.addEventListener('click', () => {
        panel.classList.add('is-collapsed');
      });
      return panel;
    },

    render() {
      const panel = this.ensurePanel();
      if (!panel) return;
      panel.classList.remove('is-collapsed');
      const body = document.getElementById('editor-inspector-body');
      if (!body) return;
      bindInspectorActions(body);

      const sel = this.selection;
      if (!sel) {
        while (body.firstChild) body.removeChild(body.firstChild);
        const empty = document.createElement('div');
        empty.className = 'editor-inspector-empty';
        const p1 = document.createElement('p');
        p1.className = 'hint';
        p1.textContent = 'Выберите объект в рабочей области';
        const p2 = document.createElement('p');
        p2.className = 'hint';
        p2.textContent = 'Сцена · NPC · Предмет · Враг · Квест · Этап · Задача';
        empty.appendChild(p1);
        empty.appendChild(p2);
        body.appendChild(empty);
        return;
      }

      const insp = registry.get(sel.type);
      if (!insp) {
        while (body.firstChild) body.removeChild(body.firstChild);
        const empty = document.createElement('div');
        empty.className = 'editor-inspector-empty';
        const p1 = document.createElement('p');
        p1.textContent = 'Нет панели свойств для: ';
        const code = document.createElement('code');
        code.textContent = sel.type;
        p1.appendChild(code);
        const p2 = document.createElement('p');
        p2.className = 'hint';
        p2.textContent = "Зарегистрируйте: Editor.Inspector.register('" + sel.type + "', { render })";
        empty.appendChild(p1);
        empty.appendChild(p2);
        body.appendChild(empty);
        return;
      }

      const ctx = {
        type: sel.type,
        id: sel.id,
        stageIndex: sel.stageIndex,
        taskIndex: sel.taskIndex,
        meta: sel.meta || {},
        data: Editor.data,
        editor: Editor,
        selection: sel
      };

      while (body.firstChild) body.removeChild(body.firstChild);
      const typeEl = document.createElement('div');
      typeEl.className = 'editor-inspector-type';
      typeEl.textContent = insp.label;
      body.appendChild(typeEl);

      try {
        const out = insp.render(ctx);
        if (out == null) {
          /* empty */
        } else if (typeof out === 'string') {
          // legacy string path — escape-only content expected from migrated inspectors
          const wrap = document.createElement('div');
          wrap.className = 'editor-inspector-legacy-html';
          wrap.innerHTML = out;
          body.appendChild(wrap);
        } else {
          body.appendChild(out);
        }
      } catch (e) {
        console.error('[Inspector] render failed', sel.type, e);
        const err = document.createElement('p');
        err.className = 'quest-task-errors';
        err.textContent = 'Ошибка панели свойств: ' + (e.message || String(e));
        body.appendChild(err);
      }
    }
  };

  // Делегирование действий Inspector (без inline onclick)
  function bindInspectorActions(root) {
    if (!root || root._inspectorBound) return;
    root._inspectorBound = true;
    root.addEventListener('click', (ev) => {
      const btn = ev.target.closest && ev.target.closest('[data-action]');
      if (!btn || !root.contains(btn)) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === 'open-scene' && id) {
        Editor.switchTab && Editor.switchTab('scenes');
        Editor.selectScene && Editor.selectScene(id);
      } else if (action === 'open-npc' && id) {
        Editor.switchTab && Editor.switchTab('npcs');
        Editor.selectNpcToEdit && Editor.selectNpcToEdit(id);
      } else if (action === 'open-item' && id) {
        Editor.switchTab && Editor.switchTab('items');
        Editor.selectItemToEdit && Editor.selectItemToEdit(id);
      } else if (action === 'open-enemies') {
        Editor.switchTab && Editor.switchTab('enemies');
      } else if (action === 'open-quest' && id) {
        Editor.switchTab && Editor.switchTab('quests');
        Editor.selectQuestToEdit && Editor.selectQuestToEdit(id);
      }
    });
  }

  // ——— helpers (DOM, без inline onclick) ———
  const D = () => Editor.DOM || window.EditorDOM;

  function field(label, control) {
    const DOM = D();
    if (DOM) return DOM.formGroup(label, control);
    const wrap = document.createElement('div');
    wrap.className = 'form-group';
    const lab = document.createElement('label');
    lab.textContent = label;
    wrap.appendChild(lab);
    if (typeof control === 'string') {
      const span = document.createElement('div');
      span.innerHTML = control; // только из trusted/escaped builder
      wrap.appendChild(span);
    } else if (control) wrap.appendChild(control);
    return wrap;
  }

  function textInput(value, onChange) {
    const DOM = D();
    if (DOM) return DOM.input({ value: value ?? '', onChange });
    const input = document.createElement('input');
    input.value = String(value ?? '');
    input.addEventListener('change', () => onChange(input.value, input));
    return input;
  }

  function numInput(value, onChange, min) {
    const DOM = D();
    if (DOM) return DOM.input({ type: 'number', value: value ?? 0, min, onChange: (v) => onChange(v) });
    const input = document.createElement('input');
    input.type = 'number';
    if (min != null) input.min = String(min);
    input.value = String(value ?? 0);
    input.addEventListener('change', () => onChange(input.value, input));
    return input;
  }

  function entityPickerOrInput(kind, value, onChangeExpr) {
    // EntityPicker пока отдаёт HTML; вставляем как trusted component output
    if (typeof Editor.renderEntityPicker === 'function') {
      const wrap = document.createElement('div');
      wrap.innerHTML = Editor.renderEntityPicker({ kind, value: value || '', onChange: onChangeExpr });
      if (typeof Editor.bindEntityPickers === 'function') {
        setTimeout(() => Editor.bindEntityPickers(wrap), 0);
      }
      return wrap;
    }
    return textInput(value, (v) => {
      // onChangeExpr like Editor.update...(this.value) — call via Function forbidden
      // fallback: dispatch custom
    });
  }

  function codeText(id) {
    const c = document.createElement('code');
    c.textContent = id;
    return c;
  }

  function actionButton(label, action, dataset) {
    const DOM = D();
    const ds = Object.assign({ action: action }, dataset || {});
    if (DOM) {
      return DOM.button(label, { className: 'btn btn-secondary btn-sm', dataset: ds });
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary btn-sm';
    btn.textContent = label;
    btn.dataset.action = action;
    Object.keys(dataset || {}).forEach((k) => { btn.dataset[k] = String(dataset[k]); });
    return btn;
  }

  function appendAll(parent, nodes) {
    (nodes || []).forEach((n) => {
      if (!n) return;
      parent.appendChild(typeof n === 'string' ? document.createTextNode(n) : n);
    });
  }

  function codeFieldIfAdvanced(id) {
    let adv = false;
    if (typeof Editor.isEditorAdvancedMode === 'function') {
      adv = !!Editor.isEditorAdvancedMode.call(Editor);
    } else if (typeof Editor.isAdvancedMode === 'function') {
      adv = !!Editor.isAdvancedMode.call(Editor);
    } else {
      adv = !!(Editor.devMode || Editor.editorMode === 'advanced');
    }
    if (!adv) return document.createDocumentFragment();
    // Canonical implementation — never call codeFieldIfAdvanced recursively
    return field('Код / ID', codeText(id));
  }

  // ——— Inspectors ———


  Inspector.register('scene', {
    label: 'Сцена',
    render(ctx) {
      const id = ctx.id;
      const scene = ctx.data?.scenes?.[id];
      if (!scene) {
        const p = document.createElement('p');
        p.className = 'hint';
        p.textContent = 'Сцена не найдена';
        return p;
      }
      const frag = document.createDocumentFragment();
      appendAll(frag, [
        codeFieldIfAdvanced(id),
        (() => {
          if (typeof Editor.renderSceneTypeSelect !== 'function') return null;
          const wrap = document.createElement('div');
          wrap.innerHTML = Editor.renderSceneTypeSelect(scene);
          return wrap.firstElementChild || wrap;
        })(),
        field('Название / локация', textInput(scene.location || scene.title || '', (v) => {
          Editor.updateSceneField && Editor.updateSceneField('location', v);
        })),
        field('NPC', entityPickerOrInput('npc', scene.npcId || '', 'Editor.setSceneNpcId(this.value)')),
        field('Текст (начало)', (() => {
          const ta = document.createElement('textarea');
          ta.rows = 4;
          ta.value = scene.text || '';
          ta.addEventListener('change', () => Editor.updateSceneField && Editor.updateSceneField('text', ta.value));
          return ta;
        })()),
        actionButton('Открыть в редакторе', 'open-scene', { id })
      ]);
      return frag;
    }
  });

  Inspector.register('npc', {
    label: 'NPC',
    render(ctx) {
      const id = ctx.id;
      const npc = ctx.data?.npcs?.[id];
      if (!npc) {
        const p = document.createElement('p');
        p.className = 'hint';
        p.textContent = 'NPC не найден';
        return p;
      }
      const frag = document.createDocumentFragment();
      appendAll(frag, [
        codeFieldIfAdvanced(id),
        field('Имя', textInput(npc.name || '', (v) => Editor.updateNPC && Editor.updateNPC(id, 'name', v))),
        field('Роль', textInput(npc.role || npc.title || '', (v) => Editor.updateNPC && Editor.updateNPC(id, 'role', v))),
        actionButton('Открыть NPC', 'open-npc', { id })
      ]);
      return frag;
    }
  });

  Inspector.register('item', {
    label: 'Предмет',
    render(ctx) {
      const id = ctx.id;
      const item = ctx.data?.items?.[id];
      if (!item) {
        const p = document.createElement('p');
        p.className = 'hint';
        p.textContent = 'Предмет не найден';
        return p;
      }
      const frag = document.createDocumentFragment();
      appendAll(frag, [
        codeFieldIfAdvanced(id),
        field('Название', textInput(item.name || '', (v) => Editor.updateItemData && Editor.updateItemData(id, 'name', v))),
        field('Тип', textInput(item.type || '', (v) => Editor.updateItemData && Editor.updateItemData(id, 'type', v))),
        field('Цена', numInput(item.price ?? 0, (v) => Editor.updateItemData && Editor.updateItemData(id, 'price', parseInt(v, 10) || 0), 0)),
        actionButton('Открыть предмет', 'open-item', { id })
      ]);
      return frag;
    }
  });

  Inspector.register('enemy', {
    label: 'Враг',
    render(ctx) {
      const id = ctx.id;
      const enemy = ctx.data?.enemies?.[id];
      if (!enemy) {
        const p = document.createElement('p');
        p.className = 'hint';
        p.textContent = 'Враг не найден';
        return p;
      }
      const frag = document.createDocumentFragment();
      appendAll(frag, [
        codeFieldIfAdvanced(id),
        field('Имя', textInput(enemy.name || '', (v) => Editor.updateEnemy && Editor.updateEnemy(id, 'name', v))),
        field('HP', numInput(enemy.hp ?? enemy.maxHp ?? 0, (v) => Editor.updateEnemy && Editor.updateEnemy(id, 'hp', v), 1)),
        actionButton('К списку врагов', 'open-enemies', {})
      ]);
      return frag;
    }
  });

  Inspector.register('quest', {
    label: 'Квест',
    render(ctx) {
      const id = ctx.id;
      const q = ctx.data?.quests?.[id];
      if (!q) {
        const p = document.createElement('p');
        p.className = 'hint';
        p.textContent = 'Квест не найден';
        return p;
      }
      const stages = Array.isArray(q.stages) ? q.stages.length : 0;
      const frag = document.createDocumentFragment();
      const stagesEl = document.createElement('span');
      stagesEl.textContent = String(stages);
      appendAll(frag, [
        codeFieldIfAdvanced(id),
        field('Название', textInput(q.title || '', (v) => Editor.updateQuestMeta && Editor.updateQuestMeta(id, 'title', v))),
        field('Этапов', stagesEl),
        field('Золото', numInput(q.rewards?.gold ?? 0, (v) => Editor.updateQuestReward && Editor.updateQuestReward(id, 'gold', parseInt(v, 10) || 0), 0)),
        field('Опыт', numInput(q.rewards?.exp ?? 0, (v) => Editor.updateQuestReward && Editor.updateQuestReward(id, 'exp', parseInt(v, 10) || 0), 0)),
        actionButton('Открыть квест', 'open-quest', { id })
      ]);
      return frag;
    }
  });

  Inspector.register('stage', {
    label: 'Этап квеста',
    render(ctx) {
      const id = ctx.id;
      const si = ctx.stageIndex;
      const q = ctx.data?.quests?.[id];
      const st = q?.stages?.[si];
      if (!st) {
        const p = document.createElement('p');
        p.className = 'hint';
        p.textContent = 'Этап не найден';
        return p;
      }
      const tasks = Array.isArray(st.tasks) ? st.tasks.length : 0;
      const state = st.finish ? 'Финал' : (st.failed ? 'Провал' : 'Обычный');
      const frag = document.createDocumentFragment();
      const num = document.createElement('span');
      num.textContent = String((si | 0) + 1);
      const stState = document.createElement('span');
      stState.textContent = state;
      const tasksEl = document.createElement('span');
      tasksEl.textContent = String(tasks);
      appendAll(frag, [
        field('Квест', codeText(id)),
        field('Номер', num),
        field('Состояние', stState),
        field('Название', textInput(st.title || '', (v) => Editor.updateQuestStageField && Editor.updateQuestStageField(id, si, 'title', v))),
        field('Подсказка', textInput(st.hint || '', (v) => Editor.updateQuestStageField && Editor.updateQuestStageField(id, si, 'hint', v))),
        field('Задач', tasksEl),
        actionButton('К квесту', 'open-quest', { id })
      ]);
      return frag;
    }
  });

  Inspector.register('task', {
    label: 'Задача',
    render(ctx) {
      const id = ctx.id;
      const si = ctx.stageIndex;
      const ti = ctx.taskIndex;
      const task = ctx.data?.quests?.[id]?.stages?.[si]?.tasks?.[ti];
      if (!task) {
        const p = document.createElement('p');
        p.className = 'hint';
        p.textContent = 'Задача не найдена';
        return p;
      }
      const human = typeof Editor.humanizeQuestTask === 'function'
        ? Editor.humanizeQuestTask(task)
        : (task.description || task.type);
      const C = typeof QuestTaskRegistry !== 'undefined' ? QuestTaskRegistry.get(task.type) : null;
      const fields = C && typeof C.getEditorFields === 'function' ? C.getEditorFields() : [];
      const entityInputs = new Set(['npc', 'item', 'enemy', 'scene', 'location']);
      const frag = document.createDocumentFragment();
      const humanEl = document.createElement('div');
      humanEl.className = 'editor-inspector-human';
      humanEl.textContent = human;
      frag.appendChild(humanEl);
      const typeSpan = document.createElement('span');
      typeSpan.textContent = (C && C.label) || task.type || '';
      frag.appendChild(field('Тип', typeSpan));
      let anyField = false;
      fields.filter((f) => f.key !== 'stageKey').forEach((f) => {
        anyField = true;
        const val = task[f.key] != null ? task[f.key] : '';
        const apply = (v) => Editor.updateQuestTaskField && Editor.updateQuestTaskField(id, si, ti, f.key, v);
        if (entityInputs.has(f.input)) {
          frag.appendChild(field(f.label || f.key, entityPickerOrInput(f.input, String(val), '/* bound */')));
          // re-bind onChange for entity picker via data after insert — value applied through update if picker supports onChange string; use textInput fallback path
          const last = frag.lastChild;
          const input = last && last.querySelector && last.querySelector('input, select');
          if (input && !input.closest('.entity-picker')) {
            input.addEventListener('change', () => apply(input.value));
          }
        } else if (f.input === 'number') {
          frag.appendChild(field(f.label || f.key, numInput(val, apply, f.min != null ? f.min : 1)));
        } else {
          frag.appendChild(field(f.label || f.key, textInput(val, apply)));
        }
      });
      if (!anyField) {
        const hint = document.createElement('p');
        hint.className = 'hint';
        hint.textContent = 'Нет полей';
        frag.appendChild(hint);
      }
      frag.appendChild(actionButton('К квесту', 'open-quest', { id }));
      return frag;
    }
  });

  // ——— Editor API ———
  Editor.Inspector = Inspector;

  Editor.selectInspectorObject = function (sel) {
    Inspector.select(sel);
  };

  Editor.clearInspector = function () {
    Inspector.clear();
  };

  Editor.renderInspector = function () {
    Inspector.render();
  };

  // Sync selection via hooks.after — NEVER Editor[method] = wrapper (recursion with Editor.hooks)
  const SELECT_HOOKS = [
    ['selectScene', function (id) { return id ? { type: 'scene', id } : null; }],
    ['selectQuestToEdit', function (id) { return id ? { type: 'quest', id } : null; }],
    ['selectItemToEdit', function (id) { return id ? { type: 'item', id } : null; }],
    ['selectNpcToEdit', function (id) { return id ? { type: 'npc', id } : null; }],
    ['selectEnemyToEdit', function (id) { return id ? { type: 'enemy', id } : null; }]
  ];
  const _afterBound = Object.create(null);

  function bindSelectHooks() {
    if (!Editor.hooks || typeof Editor.hooks.after !== 'function') {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[Inspector] Editor.hooks missing — selection sync skipped');
      }
      return;
    }
    SELECT_HOOKS.forEach(([methodName, buildSel]) => {
      if (_afterBound[methodName]) return;
      if (typeof Editor[methodName] !== 'function') return;
      Editor.hooks.after(methodName, function (result, args) {
        try {
          const sel = buildSel.apply(this, args || []);
          if (sel) Inspector.select(sel);
        } catch (e) {
          console.warn('[Inspector] select hook', methodName, e);
        }
        return result;
      });
      _afterBound[methodName] = true;
    });
  }

  // Click on stage/task cards in quest editor
  if (typeof document !== 'undefined' && !window._inspectorQuestClickBound) {
    window._inspectorQuestClickBound = true;
    document.addEventListener('click', (e) => {
      const taskCard = e.target.closest?.('.quest-task-card[data-quest-id]');
      if (taskCard && !e.target.closest('.quest-dnd-handle, .btn-remove, select, input, textarea, button, .entity-picker')) {
        Inspector.select({
          type: 'task',
          id: taskCard.getAttribute('data-quest-id'),
          stageIndex: parseInt(taskCard.getAttribute('data-stage-index'), 10),
          taskIndex: parseInt(taskCard.getAttribute('data-task-index'), 10)
        });
        return;
      }
      const stageCard = e.target.closest?.('.quest-stage-card[data-quest-id]:not(.quest-reward-card)');
      if (stageCard && !e.target.closest('.quest-dnd-handle, .btn-remove, select, input, textarea, button, .entity-picker, .quest-task-card')) {
        Inspector.select({
          type: 'stage',
          id: stageCard.getAttribute('data-quest-id'),
          stageIndex: parseInt(stageCard.getAttribute('data-stage-index'), 10)
        });
      }
    }, true);
  }

  // Styles
  if (typeof document !== 'undefined' && !document.getElementById('editor-inspector-styles')) {
    const st = document.createElement('style');
    st.id = 'editor-inspector-styles';
    st.textContent = `
      .editor-inspector {
        width: 300px; flex-shrink: 0; display: flex; flex-direction: column;
        background: var(--card-bg, #fff); border-left: 2px solid var(--border, #cbb);
        min-height: 0; overflow: hidden;
      }
      .editor-inspector.is-collapsed { display: none; }
      .editor-inspector-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 12px 14px; border-bottom: 2px solid var(--border, #cbb); flex-shrink: 0;
      }
      .editor-inspector-head h3 { margin: 0; font-size: 15px; color: var(--accent, #6d4c41); }
      .editor-inspector-body {
        flex: 1; overflow-y: auto; padding: 12px 14px; font-size: 13px;
      }
      .editor-inspector-type {
        font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em;
        color: var(--muted, #888); margin-bottom: 10px;
      }
      .editor-inspector-empty { color: var(--muted, #888); }
      .editor-inspector-human { font-weight: 600; margin-bottom: 12px; font-size: 14px; }
      @media (max-width: 1100px) {
        .editor-inspector { width: 260px; }
      }
    `;
    document.head.appendChild(st);
  }

  function boot() {
    bindSelectHooks();
    Inspector.ensurePanel();
    Inspector.render();
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        bindSelectHooks();
        boot();
      });
    } else if (typeof setTimeout === 'function') {
      setTimeout(boot, 0);
    } else {
      boot();
    }
    // content modules may load after this file — retry once
    if (typeof setTimeout === 'function') {
      setTimeout(bindSelectHooks, 50);
      setTimeout(bindSelectHooks, 300);
    }
  } else {
    bindSelectHooks();
  }

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-inspector', {
      selectInspectorObject: Editor.selectInspectorObject,
      clearInspector: Editor.clearInspector,
      renderInspector: Editor.renderInspector
    }, { force: true });
  }
})();
