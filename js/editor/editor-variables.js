/**
 * Phase E — Project variables / flags catalog (no JSON editing)
 */
(function attachEditorVariables() {
  'use strict';

  if (typeof Editor === 'undefined') return;

  function esc(s) {
    return typeof Editor.escapeHtml === 'function'
      ? Editor.escapeHtml(String(s == null ? '' : s))
      : String(s == null ? '' : s);
  }

  function escAttr(s) {
    return typeof Editor.escapeAttr === 'function'
      ? Editor.escapeAttr(String(s == null ? '' : s))
      : esc(s);
  }

  function ensureVars() {
    if (!Editor.data) return {};
    if (typeof ProjectSchema !== 'undefined' && ProjectSchema.ensureProjectVariables) {
      return ProjectSchema.ensureProjectVariables(Editor.data);
    }
    if (!Editor.data.variables) Editor.data.variables = {};
    return Editor.data.variables;
  }

  function listVars() {
    if (typeof ProjectSchema !== 'undefined' && ProjectSchema.listProjectVariables) {
      return ProjectSchema.listProjectVariables(Editor.data || {});
    }
    return Object.keys(ensureVars()).map((id) => ({ id, name: id, defaultValue: false, description: '' }));
  }

  function normalizeVariableId(raw) {
    return String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  }

  function collectOccupiedVariableIds() {
    const set = new Set();
    Object.keys(ensureVars()).forEach((id) => set.add(id));
    if (typeof ConditionSystem !== 'undefined' && typeof ConditionSystem.collectFlagNames === 'function') {
      ConditionSystem.collectFlagNames(Editor.data || {}).forEach((name) => set.add(name));
    } else {
      Object.keys(Editor.data?.startingFlags || {}).forEach((id) => set.add(id));
      Object.keys(Editor.data?.reputation || {}).forEach((id) => set.add(id));
    }
    return set;
  }

  function validateNewVariableId(rawId) {
    const id = normalizeVariableId(rawId);
    if (!id) return 'Введите имя переменной (латиница, snake_case).';
    if (!/^[a-z][a-z0-9_]*$/.test(id)) {
      return 'Имя должно начинаться с буквы и содержать только a–z, 0–9 и _.';
    }
    if (collectOccupiedVariableIds().has(id)) {
      return 'Переменная или флаг «' + id + '» уже существует.';
    }
    return '';
  }

  function ensureModalStyles() {
    if (document.getElementById('editor-variables-modal-styles')) return;
    const st = document.createElement('style');
    st.id = 'editor-variables-modal-styles';
    st.textContent = `
      .var-add-modal-overlay {
        position: fixed; inset: 0; z-index: 12500;
        background: var(--overlay, rgba(0,0,0,.45));
        display: flex; align-items: center; justify-content: center; padding: 16px;
      }
      .var-add-modal {
        max-width: 420px; width: 100%;
        background: var(--card-bg, #fff);
        border: 1px solid var(--border, #ccc);
        border-radius: 10px; padding: 20px;
      }
      .var-add-modal .field-error {
        color: var(--danger, #c62828); font-size: 12px; margin-top: 4px; min-height: 1.2em;
      }
      .var-add-modal .btn[disabled] { opacity: 0.55; cursor: not-allowed; }
    `;
    document.head.appendChild(st);
  }

  function closeAddVariableModal() {
    const overlay = document.getElementById('var-add-modal-overlay');
    if (overlay) overlay.remove();
  }

  function syncAddVariableFormState(overlay) {
    if (!overlay) return;
    const idInput = overlay.querySelector('#var-add-id');
    const errEl = overlay.querySelector('#var-add-id-error');
    const saveBtn = overlay.querySelector('#var-add-save');
    if (!idInput || !errEl || !saveBtn) return;
    const err = validateNewVariableId(idInput.value);
    errEl.textContent = err;
    saveBtn.disabled = !!err;
  }

  function commitNewProjectVariable(id, defaultValue, description) {
    const vid = normalizeVariableId(id);
    if (!vid || validateNewVariableId(vid)) return false;
    const entry = {
      name: vid,
      defaultValue: defaultValue === true || defaultValue === 'true' || defaultValue === '1',
      description: String(description || '').trim()
    };
    if (typeof ProjectSchema !== 'undefined' && ProjectSchema.registerProjectVariable) {
      ProjectSchema.registerProjectVariable(Editor.data, vid, entry);
    } else {
      ensureVars()[vid] = entry;
    }
    Editor._editingVariableId = vid;
    Editor.markDirty?.();
    Editor.updateJSONPreview?.();
    Editor.renderVariablesPanel?.();
    Editor.toast?.success?.('Переменная добавлена');
    return true;
  }

  Object.assign(Editor, {
    getProjectVariables() {
      return listVars();
    },

    normalizeProjectVariableId: normalizeVariableId,

    validateNewProjectVariableId(rawId) {
      return validateNewVariableId(rawId);
    },

    collectOccupiedVariableIds() {
      return [...collectOccupiedVariableIds()];
    },

    openAddProjectVariableModal() {
      if (!Editor.data) {
        Editor.toast?.warning?.('Сначала загрузите или создайте проект');
        return;
      }
      ensureModalStyles();
      closeAddVariableModal();
      const overlay = document.createElement('div');
      overlay.id = 'var-add-modal-overlay';
      overlay.className = 'var-add-modal-overlay';
      overlay.innerHTML =
        '<div class="var-add-modal" role="dialog" aria-labelledby="var-add-title">' +
        '<h2 id="var-add-title" style="margin:0 0 8px;font-size:18px;">Новая переменная</h2>' +
        '<p class="hint" style="margin:0 0 12px;">Имя используется в условиях и действиях set_flag.</p>' +
        '<div class="form-group"><label for="var-add-id">Имя (ID)</label>' +
        '<input type="text" id="var-add-id" class="form-control" placeholder="visited_tavern" autocomplete="off">' +
        '<div id="var-add-id-error" class="field-error" role="alert"></div></div>' +
        '<div class="form-group"><label for="var-add-default">Начальное значение</label>' +
        '<select id="var-add-default" class="form-control">' +
        '<option value="false" selected>false</option><option value="true">true</option></select></div>' +
        '<div class="form-group"><label for="var-add-desc">Описание <span class="hint">(необязательно)</span></label>' +
        '<textarea id="var-add-desc" class="form-control" rows="2" placeholder="Для чего нужна переменная"></textarea></div>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">' +
        '<button type="button" class="btn btn-secondary" id="var-add-cancel">Отмена</button>' +
        '<button type="button" class="btn btn-primary" id="var-add-save" disabled>Сохранить</button>' +
        '</div></div>';
      document.body.appendChild(overlay);

      const idInput = overlay.querySelector('#var-add-id');
      overlay.querySelector('#var-add-cancel').onclick = closeAddVariableModal;
      overlay.querySelector('#var-add-save').onclick = () => {
        const def = overlay.querySelector('#var-add-default')?.value;
        const desc = overlay.querySelector('#var-add-desc')?.value;
        if (commitNewProjectVariable(idInput?.value, def, desc)) {
          closeAddVariableModal();
        }
      };
      overlay.addEventListener('click', (ev) => {
        if (ev.target === overlay) closeAddVariableModal();
      });
      idInput?.addEventListener('input', () => syncAddVariableFormState(overlay));
      idInput?.addEventListener('change', () => syncAddVariableFormState(overlay));
      syncAddVariableFormState(overlay);
      setTimeout(() => idInput?.focus(), 0);
    },

    addProjectVariable() {
      Editor.openAddProjectVariableModal();
    },

    deleteProjectVariable(id) {
      if (!id || !Editor.data?.variables?.[id]) return;
      const runDelete = () => {
        delete Editor.data.variables[id];
        if (Editor._editingVariableId === id) Editor._editingVariableId = null;
        Editor.markDirty?.();
        Editor.updateJSONPreview?.();
        Editor.renderVariablesPanel?.();
        Editor.toast?.success?.('Переменная удалена');
      };
      if (typeof Editor.confirmDialog === 'function') {
        Editor.confirmDialog({
          title: 'Удалить переменную',
          message: 'Удалить переменную «' + id + '» из каталога?',
          confirmLabel: 'Удалить',
          cancelLabel: 'Отмена',
          danger: true
        }).then((ok) => { if (ok) runDelete(); });
        return;
      }
      runDelete();
    },

    updateProjectVariable(id, field, value) {
      const bag = ensureVars();
      if (!bag[id]) return;
      if (typeof bag[id] !== 'object') bag[id] = { name: id, defaultValue: false };
      if (field === 'defaultValue') {
        bag[id].defaultValue = value === true || value === 'true' || value === '1';
      } else {
        bag[id][field] = value;
      }
      Editor.markDirty?.();
      Editor.updateJSONPreview?.();
    },

    renderVariablesPanel() {
      const root = document.getElementById('variables-editor');
      if (!root) return;
      if (!Editor.data) {
        root.innerHTML = '<div class="empty-state"><h2>Нет данных</h2></div>';
        return;
      }
      ensureVars();
      const vars = listVars();
      const editing = Editor._editingVariableId;
      const active = editing ? vars.find((v) => v.id === editing) : null;

      let detail = '<p class="hint">Выберите переменную или создайте новую.</p>';
      if (active) {
        detail =
          '<div class="form-group"><label>ID</label><code>' + esc(active.id) + '</code></div>' +
          '<div class="form-group"><label>Название</label><input type="text" data-var-field="name" data-var-id="' + escAttr(active.id) + '" value="' + escAttr(active.name) + '"></div>' +
          '<div class="form-group"><label>По умолчанию</label><select data-var-field="defaultValue" data-var-id="' + escAttr(active.id) + '">' +
          '<option value="false"' + (active.defaultValue === false ? ' selected' : '') + '>false</option>' +
          '<option value="true"' + (active.defaultValue === true ? ' selected' : '') + '>true</option></select></div>' +
          '<div class="form-group"><label>Описание</label><textarea data-var-field="description" data-var-id="' + escAttr(active.id) + '" rows="2">' + esc(active.description || '') + '</textarea></div>' +
          '<p class="hint">В условиях: «Флаг = …». В действиях: «Установить флаг» → выбор из списка.</p>' +
          '<button type="button" class="btn btn-danger" data-var-action="delete" data-var-id="' + escAttr(active.id) + '">Удалить</button>';
      }

      const list = vars.map((v) =>
        '<button type="button" class="btn btn-secondary' + (v.id === editing ? ' active' : '') + '" data-var-action="select" data-var-id="' + escAttr(v.id) + '">' +
        esc(v.name || v.id) + ' <span class="hint">(' + esc(v.id) + ')</span></button>'
      ).join(' ');

      root.innerHTML =
        '<div class="variables-editor-wrap"><h3>🏳 Переменные проекта</h3>' +
        '<p class="hint">Каталог флагов для no-code условий и действий set_flag. Без правки JSON.</p>' +
        '<button type="button" class="btn btn-primary" data-var-action="add">+ Новая переменная</button>' +
        '<div class="form-group" style="margin-top:12px"><strong>Каталог</strong><div class="btn-row" style="flex-wrap:wrap;gap:6px;margin:6px 0">' +
        (list || '<span class="hint">Пусто</span>') + '</div></div>' +
        '<div class="variable-detail">' + detail + '</div></div>';

      if (!root._varBound) {
        root._varBound = true;
        root.addEventListener('click', function (e) {
          const btn = e.target.closest('[data-var-action]');
          if (!btn) return;
          const act = btn.getAttribute('data-var-action');
          const vid = btn.getAttribute('data-var-id');
          if (act === 'add') Editor.openAddProjectVariableModal();
          if (act === 'select') { Editor._editingVariableId = vid; Editor.renderVariablesPanel(); }
          if (act === 'delete') Editor.deleteProjectVariable(vid);
        });
        root.addEventListener('change', function (e) {
          const el = e.target;
          const field = el.getAttribute('data-var-field');
          const vid = el.getAttribute('data-var-id');
          if (field && vid) Editor.updateProjectVariable(vid, field, el.value);
        });
        root.addEventListener('input', function (e) {
          const el = e.target;
          const field = el.getAttribute('data-var-field');
          const vid = el.getAttribute('data-var-id');
          if (field && vid && field !== 'defaultValue') Editor.updateProjectVariable(vid, field, el.value);
        });
      }
    }
  });

  if (Editor.hooks?.after) {
    Editor.hooks.after('switchTab', function (_r, args) {
      if (args && args[0] === 'variables') Editor.renderVariablesPanel?.();
    }, 'editor-variables');
  }
})();
