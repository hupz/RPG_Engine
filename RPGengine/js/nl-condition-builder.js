// Natural Language Condition Builder — флаговые условия в виде предложения
// Генерирует объекты движка: { flag, min }, { flag, equals }, { notFlag }, …

const NLConditionBuilder = {
  NUM_OPS: [
    { id: 'gt', label: 'больше чем' },
    { id: 'lt', label: 'меньше чем' },
    { id: 'eq', label: 'равно' }
  ],

  BOOL_OPS: [
    { id: 'active', label: 'активен' },
    { id: 'inactive', label: 'не активен' }
  ],

  DEFAULT_LEAD: 'Показать выбор, если',

  humanizeFlag(id) {
    if (!id) return '— флаг —';
    let s = String(id).replace(/^rep_/, '').replace(/_/g, ' ');
    if (s.length) s = s.charAt(0).toUpperCase() + s.slice(1);
    return s || id;
  },

  inferFlagType(flagId, gameData) {
    if (!flagId) return 'bool';
    const start = gameData?.startingFlags?.[flagId];
    if (typeof start === 'number') return 'number';
    if (gameData?.reputation?.[flagId]) return 'number';
    if (/^rep_|_rep$|reputation|_score$/i.test(flagId)) return 'number';
    return 'bool';
  },

  getFlagLabel(flagId, gameData) {
    if (!flagId) return this.humanizeFlag(flagId);
    const rep = gameData?.reputation?.[flagId];
    if (rep?.name) return rep.name;
    if (flagId.startsWith('rep_')) {
      return 'Отношения: ' + this.humanizeFlag(flagId.slice(4));
    }
    return this.humanizeFlag(flagId);
  },

  /**
   * Каталог флагов: startingFlags, reputation, плюс имена из редактора.
   * @returns {{ id: string, type: 'number'|'bool', label: string }[]}
   */
  getFlagCatalog(gameData, extraIds) {
    const map = new Map();
    const add = (id, type, label) => {
      if (!id) return;
      const prev = map.get(id);
      const resolvedType = type || prev?.type || this.inferFlagType(id, gameData);
      map.set(id, {
        id,
        type: resolvedType,
        label: label || prev?.label || this.getFlagLabel(id, gameData)
      });
    };

    Object.entries(gameData?.startingFlags || {}).forEach(([k, v]) => {
      add(k, typeof v === 'number' ? 'number' : 'bool');
    });
    Object.entries(gameData?.reputation || {}).forEach(([k, meta]) => {
      add(k, 'number', meta?.name || k);
    });
    (extraIds || []).forEach((id) => add(id, this.inferFlagType(id, gameData)));

    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'ru'));
  },

  /** Правило редактора → состояние предложения */
  parseRule(rule, gameData) {
    if (!rule || typeof rule !== 'object') {
      return { flag: '', kind: 'bool', op: 'active', value: 10 };
    }
    if (rule.notFlag) {
      return {
        flag: rule.notFlag,
        kind: 'bool',
        op: 'inactive',
        value: false
      };
    }

    const flag = rule.flag || '';
    let kind = this.inferFlagType(flag, gameData);

    if (rule.min != null) {
      return { flag, kind: 'number', op: 'gt', value: Number(rule.min) };
    }
    if (rule.max != null) {
      return { flag, kind: 'number', op: 'lt', value: Number(rule.max) };
    }

    const rawEq = rule.equals !== undefined ? rule.equals : rule.value;
    if (kind === 'number') {
      if (rawEq !== undefined && rawEq !== '' && !Number.isNaN(Number(rawEq))) {
        return { flag, kind: 'number', op: 'eq', value: Number(rawEq) };
      }
      return { flag, kind: 'number', op: 'gt', value: 10 };
    }

    const eq = rawEq !== undefined ? rawEq : true;
    const inactive = eq === false || eq === 'false' || eq === 0;
    return { flag, kind: 'bool', op: inactive ? 'inactive' : 'active', value: true };
  },

  /** Состояние → объект для ConditionSystem ({ flag, min: 10 } и т.д.) */
  toEngineRule(state) {
    if (!state?.flag) return { flag: '' };

    if (state.kind === 'bool') {
      if (state.op === 'inactive') return { notFlag: state.flag };
      return { flag: state.flag, equals: true };
    }

    const out = { flag: state.flag };
    const n = Number(state.value);
    const num = Number.isNaN(n) ? 0 : n;
    if (state.op === 'gt') out.min = num;
    else if (state.op === 'lt') out.max = num;
    else out.equals = num;
    return out;
  },

  /** Плоский объект showIf (не группа) */
  toFlatCondition(state) {
    return this.toEngineRule(state);
  },

  applyStateToRule(rule, state) {
    const next = this.toEngineRule(state);
    Object.keys(rule).forEach((k) => delete rule[k]);
    Object.assign(rule, next);
  },

  readStateFromRow(row, gameData) {
    if (!row) return { flag: '', kind: 'bool', op: 'active', value: 10 };
    const flag = row.querySelector('[data-nl-action="object"]')?.value || '';
    const kind = this.inferFlagType(flag, gameData);
    const op = row.querySelector('[data-nl-action="operator"]')?.value
      || (kind === 'number' ? 'gt' : 'active');
    let value = true;
    const valEl = row.querySelector('[data-nl-action="value"]');
    if (valEl) {
      if (valEl.tagName === 'SELECT') value = valEl.value === 'true';
      else value = Number(valEl.value);
    }
    return { flag, kind, op, value };
  },

  escapeAttr(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  },

  escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  renderOperatorOptions(kind, currentOp) {
    const ops = kind === 'number' ? this.NUM_OPS : this.BOOL_OPS;
    return ops.map((o) =>
      `<option value="${this.escapeAttr(o.id)}" ${o.id === currentOp ? 'selected' : ''}>${this.escapeHtml(o.label)}</option>`
    ).join('');
  },

  /** Вызывается из onchange/oninput в разметке; bridge подставляет Editor.handleNlConditionChange */
  onFieldChange(el) {
    if (typeof this._fieldChangeHandler === 'function') this._fieldChangeHandler(el);
  },

  onFieldInput(el) {
    this.onFieldChange(el);
  },

  renderValueControl(state) {
    if (state.kind === 'bool') return '';
    const v = state.value != null ? state.value : 0;
    const ri = state.ruleIndex;
    const sync = 'NLConditionBuilder.onFieldChange(this)';
    const syncInput = 'NLConditionBuilder.onFieldInput(this)';
    return `<input type="number" class="nl-inline-input" data-nl-action="value" data-rule-index="${ri}"
      value="${this.escapeAttr(v)}" step="1" aria-label="Значение"
      oninput="${syncInput}" onchange="${sync}">`;
  },

  formatOutputPreview(state) {
    try {
      return JSON.stringify(this.toEngineRule(state));
    } catch (_) {
      return '{}';
    }
  },

  /**
   * HTML для строки правила (внутри .cb-rule-fields).
   * @param {object} opts — rule, ruleIndex, catalog, gameData, leadText
   */
  renderFieldsHtml(opts) {
    const { rule, ruleIndex, catalog, gameData, leadText } = opts;
    const state = this.parseRule(rule, gameData);
    state.ruleIndex = ruleIndex;

    const flags = catalog?.length ? catalog : [{ id: '', type: 'bool', label: '— флаг —' }];
    if (state.flag && !flags.some((f) => f.id === state.flag)) {
      flags.push({
        id: state.flag,
        type: state.kind,
        label: this.getFlagLabel(state.flag, gameData) + ' (в данных)'
      });
      flags.sort((a, b) => a.label.localeCompare(b.label, 'ru'));
    }

    const objectOpts = flags.map((f) => {
      const sel = f.id === state.flag ? 'selected' : '';
      return `<option value="${this.escapeAttr(f.id)}" data-flag-type="${f.type}" ${sel}>${this.escapeHtml(f.label)}</option>`;
    }).join('');

    const showValue = state.kind === 'number';
    const lead = leadText || this.DEFAULT_LEAD;
    const preview = this.formatOutputPreview(state);
    const onChange = 'NLConditionBuilder.onFieldChange(this)';

    return `<div class="nl-condition" data-nl-rule data-rule-index="${ruleIndex}">
      <p class="nl-condition-sentence">
        <span class="nl-condition-lead">${this.escapeHtml(lead)}</span>
        <span class="nl-token nl-token--object" title="Объект (флаг)">
          <select class="nl-inline-select" data-nl-action="object" data-rule-index="${ruleIndex}" aria-label="Флаг"
            onchange="${onChange}">
            <option value="">— выберите —</option>
            ${objectOpts}
          </select>
        </span>
        <span class="nl-token nl-token--operator" title="Условие">
          <select class="nl-inline-select" data-nl-action="operator" data-rule-index="${ruleIndex}" aria-label="Оператор"
            onchange="${onChange}">
            ${this.renderOperatorOptions(state.kind, state.op)}
          </select>
        </span>
        <span class="nl-token nl-token--value${showValue ? '' : ' nl-token--hidden'}" title="Значение">
          ${showValue ? this.renderValueControl(state) : ''}
        </span>
      </p>
      <div class="nl-condition-meta">
        <code class="nl-condition-output" data-nl-preview>${this.escapeHtml(preview)}</code>
        <span class="nl-condition-id" title="ID в JSON">${state.flag ? this.escapeHtml(state.flag) : ''}</span>
      </div>
    </div>`;
  }
};

if (typeof window !== 'undefined') window.NLConditionBuilder = NLConditionBuilder;
