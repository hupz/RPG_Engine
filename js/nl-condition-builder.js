// Natural Language Condition Builder — все типы showIf в виде предложений на русском
// JSON правил не меняется: { hasItem }, { questStage }, { all: [...] }, …

const NL_RULE_IDS = [
  'hasItem', 'notHasItem', 'goldMin', 'goldMax',
  'questStage', 'questMinStage', 'class',
  'choiceUsed', 'choiceNotUsed', 'reputation',
  'flag', 'notFlag'
];

const NLConditionBuilder = {
  NL_RULE_IDS,

  getCatalog() {
    if (typeof EditorConditionCatalog !== 'undefined') return EditorConditionCatalog;
    if (typeof window !== 'undefined' && window.EditorConditionCatalog) return window.EditorConditionCatalog;
    return null;
  },

  isSupportedRuleType(type) {
    return NL_RULE_IDS.includes(type);
  },

  inferRuleType(rule) {
    const cat = this.getCatalog();
    if (cat?.ruleToCatalogId) return cat.ruleToCatalogId(rule);
    if (!rule || typeof rule !== 'object') return 'flag';
    if (rule.notFlag) return 'notFlag';
    if (rule.hasItem) return 'hasItem';
    if (rule.notHasItem) return 'notHasItem';
    if (rule.goldMin != null) return 'goldMin';
    if (rule.goldMax != null) return 'goldMax';
    if (rule.questStage) return 'questStage';
    if (rule.questMinStage) return 'questMinStage';
    if (rule.class != null) return 'class';
    if (rule.choiceUsed != null) return 'choiceUsed';
    if (rule.choiceNotUsed != null) return 'choiceNotUsed';
    if (rule.reputation) return 'reputation';
    if (rule.flag != null) return 'flag';
    return 'flag';
  },

  itemLabel(id, gameData) {
    if (!id) return '— предмет —';
    const it = gameData?.items?.[id];
    return it?.name || it?.title || id;
  },

  questLabel(id, gameData) {
    if (!id) return '— квест —';
    const q = gameData?.quests?.[id];
    return q?.title || q?.name || id;
  },

  factionLabel(id, gameData) {
    if (!id) return '— фракция —';
    const f = gameData?.reputation?.[id];
    return f?.name || f?.title || id;
  },

  classLabel(id, gameData) {
    if (!id) return '— класс —';
    const c = gameData?.classes?.[id];
    return c?.name || id;
  },

  stageLabel(stage) {
    const k = stage != null ? String(stage) : '';
    if (!k || k === '0' || k === 'start') return 'не начат';
    if (k === 'complete' || k === 'done' || k === '__finished__') return 'завершён';
    return 'этап «' + k + '»';
  },

  /** Техническое правило → русская фраза (обязательный round-trip текст) */
  ruleToPhrase(rule, gameData, opts) {
    if (!rule || typeof rule !== 'object') return '—';
    if (Array.isArray(rule.all) || Array.isArray(rule.any)) {
      return this.formatGroupPhrase(rule, gameData, opts?.lead || '');
    }
    const type = this.inferRuleType(rule);
    const g = gameData || {};
    if (type === 'hasItem') {
      return 'у героя есть «' + this.itemLabel(rule.hasItem, g) + '»';
    }
    if (type === 'notHasItem') {
      return 'у героя нет «' + this.itemLabel(rule.notHasItem, g) + '»';
    }
    if (type === 'goldMin') {
      return 'у героя не меньше ' + rule.goldMin + ' золота';
    }
    if (type === 'goldMax') {
      return 'у героя не больше ' + rule.goldMax + ' золота';
    }
    if (type === 'questStage') {
      const qs = rule.questStage || {};
      const qid = qs.questId || qs.quest || '';
      return 'квест «' + this.questLabel(qid, g) + '» на ' + this.stageLabel(qs.stage);
    }
    if (type === 'questMinStage') {
      const qm = rule.questMinStage || {};
      const qid = qm.questId || qm.quest || '';
      return 'квест «' + this.questLabel(qid, g) + '» не ниже ' + this.stageLabel(qm.stage);
    }
    if (type === 'class') {
      return 'класс героя — «' + this.classLabel(rule.class, g) + '»';
    }
    if (type === 'choiceUsed') {
      if (typeof StoryMemory !== 'undefined') {
        const phrase = StoryMemory.phraseForServiceFlag(rule.choiceUsed, g);
        if (phrase) return phrase;
      }
      return 'игрок уже выбирал этот вариант';
    }
    if (type === 'choiceNotUsed') {
      if (typeof StoryMemory !== 'undefined') {
        const phrase = StoryMemory.phraseForServiceFlag(rule.choiceNotUsed, g);
        if (phrase) return 'ещё не было: ' + phrase;
      }
      return 'игрок ещё не выбирал этот вариант';
    }
    if (type === 'reputation') {
      const rep = rule.reputation || {};
      const opLab = { gte: 'не меньше', lte: 'не больше', eq: 'равна' }[rep.op || 'gte'] || 'не меньше';
      return 'репутация «' + this.factionLabel(rep.faction, g) + '» ' + opLab + ' ' + (rep.value != null ? rep.value : 0);
    }
    if (type === 'notFlag') {
      return 'состояние «' + this.getFlagLabel(rule.notFlag, g) + '» не активно';
    }
    if (type === 'flag') {
      const st = this.parseFlagRule(rule, g);
      const name = this.getFlagLabel(st.flag, g);
      if (st.kind === 'number') {
        if (st.op === 'gt') return '«' + name + '» больше ' + st.value;
        if (st.op === 'lt') return '«' + name + '» меньше ' + st.value;
        return '«' + name + '» равно ' + st.value;
      }
      return st.op === 'inactive'
        ? 'состояние «' + name + '» не активно'
        : 'состояние «' + name + '» активно';
    }
    return 'неизвестное условие';
  },

  formatGroupPhrase(showIf, gameData, leadText) {
    const cat = this.getCatalog();
    const mode = cat?.getConditionMode ? cat.getConditionMode(showIf) : (showIf?.any ? 'any' : 'all');
    const rules = cat?.extractRules ? cat.extractRules(showIf) : [];
    if (!rules.length) return '';
    const joiner = mode === 'any' ? ' или ' : ' и ';
    const parts = rules.map((r) => {
      if (r && (Array.isArray(r.all) || Array.isArray(r.any))) {
        return '(' + this.formatGroupPhrase(r, gameData, '') + ')';
      }
      return this.ruleToPhrase(r, gameData);
    });
    const body = parts.join(joiner);
    const lead = (leadText || '').trim();
    return lead ? lead + ' ' + body : body;
  },

  buildAddRuleOptionsHtml(opts) {
    opts = opts || {};
    const cat = this.getCatalog();
    const list = cat?.getConditionCatalog
      ? cat.getConditionCatalog({ writerOnly: !!opts.writerOnly })
      : [];
    const labels = {
      hasItem: 'У героя есть предмет',
      notHasItem: 'У героя нет предмета',
      goldMin: 'Золота не меньше…',
      goldMax: 'Золота не больше…',
      questStage: 'Квест на этапе…',
      questMinStage: 'Квест не ниже этапа…',
      class: 'Класс героя…',
      choiceUsed: 'Игрок уже выбирал вариант',
      choiceNotUsed: 'Игрок ещё не выбирал вариант',
      reputation: 'Репутация фракции…',
      flag: 'Состояние игры…',
      notFlag: 'Состояние выключено'
    };
    let html = '<option value="">+ Добавить условие</option>';
    (list.length ? list : NL_RULE_IDS.map((id) => ({ id }))).forEach((e) => {
      const lab = e.label || labels[e.id] || e.id;
      html += '<option value="' + this.escapeAttr(e.id) + '">' + this.escapeHtml(lab) + '</option>';
    });
    return html;
  },

  buildModeSelectHtml(mode) {
    const m = mode === 'any' ? 'any' : 'all';
    return '<select class="cb-select cb-select--mode nl-mode-select" data-cb-action="set-mode" title="Связка условий">' +
      '<option value="all"' + (m === 'all' ? ' selected' : '') + '>все условия (и)</option>' +
      '<option value="any"' + (m === 'any' ? ' selected' : '') + '>любое условие (или)</option>' +
      '</select>';
  },

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
    if (typeof StoryMemory !== 'undefined') {
      const phrase = StoryMemory.phraseForServiceFlag(flagId, gameData);
      if (phrase) {
        const cap = phrase.charAt(0).toUpperCase() + phrase.slice(1);
        return cap;
      }
    }
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

    let list = [...map.values()];
    if (typeof Editor !== 'undefined' && typeof Editor.isWriterMode === 'function' && Editor.isWriterMode()
      && typeof StoryMemory !== 'undefined') {
      list = StoryMemory.filterAuthorFlagCatalog(list.map((e) => e.id))
        .map((id) => map.get(id))
        .filter(Boolean);
    }
    return list.sort((a, b) => a.label.localeCompare(b.label, 'ru'));
  },

  /** Правило редактора → состояние флагового предложения */
  parseFlagRule(rule, gameData) {
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

  /** Любое правило → состояние NL-редактора */
  ruleStateFromRule(rule, gameData) {
    const type = this.inferRuleType(rule);
    const cat = this.getCatalog();
    if (type === 'flag' || type === 'notFlag') {
      const st = this.parseFlagRule(rule, gameData);
      return { type: type === 'notFlag' ? 'notFlag' : 'flag', flag: st.flag, kind: st.kind, op: st.op, value: st.value };
    }
    const values = cat?.valuesFromRule ? cat.valuesFromRule(rule) : {};
    return { type, values };
  },

  defaultValuesForType(type, gameData) {
    const cat = this.getCatalog();
    const def = cat?.getConditionDefinition?.(type);
    const values = {};
    if (!def) return values;
    (def.params || []).forEach((p) => {
      if (p.default != null) values[p.id] = p.default;
    });
    if (type === 'hasItem' || type === 'notHasItem') {
      const first = Object.keys(gameData?.items || {})[0] || '';
      if (type === 'hasItem') values.hasItem = values.hasItem || first;
      else values.notHasItem = values.notHasItem || first;
    }
    if (type === 'questStage' || type === 'questMinStage') {
      const qid = Object.keys(gameData?.quests || {})[0] || '';
      values.questId = values.questId || qid;
      if (type === 'questStage') values.stage = values.stage != null ? values.stage : '0';
      else values.stage = values.stage != null ? values.stage : 1;
    }
    if (type === 'reputation') {
      const fid = Object.keys(gameData?.reputation || {}).filter((k) => k !== 'starting')[0] || '';
      values.faction = values.faction || fid;
      values.op = values.op || 'gte';
      values.value = values.value != null ? values.value : 0;
    }
    return values;
  },

  /** Состояние → объект для ConditionSystem */
  toEngineRule(state) {
    if (!state) return {};
    const type = state.type || 'flag';
    const cat = this.getCatalog();
    if (type === 'notFlag') {
      return { notFlag: state.values?.notFlag || state.flag || '' };
    }
    if (type === 'flag' || (!state.type && state.flag != null)) {
      const st = state.type ? state : state;
      if (!st.flag) return { flag: '' };
      if (st.kind === 'bool') {
        if (st.op === 'inactive') return { notFlag: st.flag };
        return { flag: st.flag, equals: true };
      }
      const out = { flag: st.flag };
      const n = Number(st.value);
      const num = Number.isNaN(n) ? 0 : n;
      if (st.op === 'gt') out.min = num;
      else if (st.op === 'lt') out.max = num;
      else out.equals = num;
      return out;
    }
    if (cat?.buildRule) return cat.buildRule(type, state.values || state);
    return {};
  },

  /** @deprecated alias */
  parseRule(rule, gameData) {
    return this.parseFlagRule(rule, gameData);
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
    if (!row) return { type: 'flag', flag: '', kind: 'bool', op: 'active', value: 10 };
    const type = row.dataset.nlRuleType
      || row.querySelector('[data-nl-type]')?.value
      || 'flag';

    if (type === 'flag' || type === 'notFlag') {
      const flag = row.querySelector('[data-nl-action="object"]')?.value
        || row.querySelector('[data-nl-action="notFlag"]')?.value
        || row.querySelector('[data-nl-action="flag"]')?.value
        || '';
      const kind = this.inferFlagType(flag, gameData);
      const op = row.querySelector('[data-nl-action="operator"]')?.value
        || (kind === 'number' ? 'gt' : (type === 'notFlag' ? 'inactive' : 'active'));
      let value = true;
      const valEl = row.querySelector('[data-nl-action="value"]');
      if (valEl) {
        if (valEl.tagName === 'SELECT') value = valEl.value === 'true';
        else value = Number(valEl.value);
      }
      if (type === 'notFlag') {
        return { type: 'notFlag', values: { notFlag: flag }, flag };
      }
      return { type: 'flag', flag, kind, op, value };
    }

    const values = {};
    row.querySelectorAll('[data-nl-action]').forEach((el) => {
      const key = el.dataset.nlAction;
      if (!key || key === 'operator') return;
      if (el.type === 'number') {
        const n = Number(el.value);
        values[key] = Number.isNaN(n) ? 0 : n;
      } else values[key] = el.value;
    });
    return { type, values };
  },

  entitySelectHtml(type, selectedId, gameData) {
    const cat = this.getCatalog();
    gameData = gameData || {};
    let opts = [];
    if (type === 'faction') {
      Object.keys(gameData.reputation || {}).forEach((id) => {
        if (id === 'starting') return;
        const o = gameData.reputation[id] || {};
        opts.push({ id, label: o.name || o.title || id });
      });
    } else if (type === 'item') {
      Object.keys(gameData.items || {}).forEach((id) => {
        const o = gameData.items[id] || {};
        opts.push({ id, label: o.name || o.title || id });
      });
    } else if (type === 'quest') {
      Object.keys(gameData.quests || {}).forEach((id) => {
        const o = gameData.quests[id] || {};
        opts.push({ id, label: o.title || o.name || id });
      });
    } else if (type === 'class') {
      Object.keys(gameData.classes || {}).forEach((id) => {
        const o = gameData.classes[id] || {};
        opts.push({ id, label: o.name || id });
      });
    }
    opts.sort((a, b) => a.label.localeCompare(b.label, 'ru'));
    let html = '<option value="">— выберите —</option>';
    let found = false;
    opts.forEach((o) => {
      if (o.id === selectedId) found = true;
      html += '<option value="' + this.escapeAttr(o.id) + '"' + (o.id === selectedId ? ' selected' : '') + '>' + this.escapeHtml(o.label) + '</option>';
    });
    if (selectedId && !found) {
      html += '<option value="' + this.escapeAttr(selectedId) + '" selected>' + this.escapeHtml(selectedId) + ' (в данных)</option>';
    }
    return html;
  },

  questStageSelectHtml(questId, selectedStage, editorApi) {
    const keys = editorApi?.getQuestStageKeys?.(questId) || ['0'];
    return keys.map((k) => {
      const sel = String(k) === String(selectedStage) ? ' selected' : '';
      const lab = this.stageLabel(k);
      return '<option value="' + this.escapeAttr(k) + '"' + sel + '>' + this.escapeHtml(lab) + '</option>';
    }).join('');
  },

  renderNlSelect(action, ruleIndex, selected, optionsHtml, aria) {
    const onChange = 'NLConditionBuilder.onFieldChange(this)';
    return '<select class="nl-inline-select" data-nl-action="' + this.escapeAttr(action) + '" data-rule-index="' + ruleIndex + '"' +
      (aria ? ' aria-label="' + this.escapeAttr(aria) + '"' : '') +
      ' onchange="' + onChange + '">' + optionsHtml + '</select>';
  },

  renderNlNumber(action, ruleIndex, value, aria) {
    const v = value != null ? value : 0;
    const sync = 'NLConditionBuilder.onFieldChange(this)';
    const syncInput = 'NLConditionBuilder.onFieldInput(this)';
    return '<input type="number" class="nl-inline-input" data-nl-action="' + this.escapeAttr(action) + '" data-rule-index="' + ruleIndex + '"' +
      ' value="' + this.escapeAttr(v) + '" step="1"' + (aria ? ' aria-label="' + this.escapeAttr(aria) + '"' : '') +
      ' oninput="' + syncInput + '" onchange="' + sync + '">';
  },

  renderNlText(action, ruleIndex, value, aria) {
    const sync = 'NLConditionBuilder.onFieldChange(this)';
    return '<input type="text" class="nl-inline-input nl-inline-input--text" data-nl-action="' + this.escapeAttr(action) + '" data-rule-index="' + ruleIndex + '"' +
      ' value="' + this.escapeAttr(value || '') + '"' + (aria ? ' aria-label="' + this.escapeAttr(aria) + '"' : '') +
      ' onchange="' + sync + '">';
  },

  renderFlagFieldsHtml(opts) {
    const { rule, ruleIndex, catalog, gameData, leadText } = opts;
    const state = this.parseFlagRule(rule, gameData);
    const isNot = this.inferRuleType(rule) === 'notFlag';
    state.ruleIndex = ruleIndex;

    const flags = catalog?.length ? catalog : [{ id: '', type: 'bool', label: '— флаг —' }];
    const flagId = isNot ? rule.notFlag : state.flag;
    if (flagId && !flags.some((f) => f.id === flagId)) {
      flags.push({
        id: flagId,
        type: this.inferFlagType(flagId, gameData),
        label: this.getFlagLabel(flagId, gameData) + ' (в данных)'
      });
      flags.sort((a, b) => a.label.localeCompare(b.label, 'ru'));
    }

    const objectOpts = flags.map((f) => {
      const sel = f.id === flagId ? 'selected' : '';
      return '<option value="' + this.escapeAttr(f.id) + '" data-flag-type="' + f.type + '" ' + sel + '>' + this.escapeHtml(f.label) + '</option>';
    }).join('');

    const showValue = !isNot && state.kind === 'number';
    const lead = leadText || this.DEFAULT_LEAD;
    const preview = JSON.stringify(rule);
    const onChange = 'NLConditionBuilder.onFieldChange(this)';
    const opAction = isNot ? '' : this.renderOperatorOptions(state.kind, state.op);

    let sentence;
    if (isNot) {
      sentence = '<span class="nl-condition-lead">' + this.escapeHtml(lead) + '</span> ' +
        'состояние <span class="nl-token nl-token--object">' +
        '<select class="nl-inline-select" data-nl-action="notFlag" data-rule-index="' + ruleIndex + '" onchange="' + onChange + '">' +
        '<option value="">— выберите —</option>' + objectOpts + '</select></span> не активно';
    } else {
      sentence = '<span class="nl-condition-lead">' + this.escapeHtml(lead) + '</span> ' +
        'состояние <span class="nl-token nl-token--object">' +
        '<select class="nl-inline-select" data-nl-action="object" data-rule-index="' + ruleIndex + '" onchange="' + onChange + '">' +
        '<option value="">— выберите —</option>' + objectOpts + '</select></span> ' +
        '<span class="nl-token nl-token--operator"><select class="nl-inline-select" data-nl-action="operator" data-rule-index="' + ruleIndex + '" onchange="' + onChange + '">' +
        opAction + '</select></span>' +
        '<span class="nl-token nl-token--value' + (showValue ? '' : ' nl-token--hidden') + '">' +
        (showValue ? this.renderValueControl(state) : '') + '</span>';
    }

    return '<div class="nl-condition" data-nl-rule data-rule-index="' + ruleIndex + '">' +
      '<p class="nl-condition-sentence">' + sentence + '</p>' +
      '<p class="nl-condition-phrase" title="Читаемая формулировка">' + this.escapeHtml(this.ruleToPhrase(rule, gameData)) + '</p>' +
      '<div class="nl-condition-meta writer-advanced-only">' +
      '<code class="nl-condition-output" data-nl-preview>' + this.escapeHtml(preview) + '</code>' +
      '<span class="nl-condition-id">' + this.escapeHtml(flagId || '') + '</span></div></div>';
  },

  renderGenericFieldsHtml(opts) {
    const { rule, ruleIndex, gameData, leadText, editorApi } = opts;
    const type = this.inferRuleType(rule);
    const cat = this.getCatalog();
    const values = cat?.valuesFromRule ? cat.valuesFromRule(rule) : {};
    const lead = leadText || this.DEFAULT_LEAD;
    const preview = JSON.stringify(rule);
    let body = '';

    if (type === 'hasItem') {
      body = 'у героя есть <span class="nl-token">' +
        this.renderNlSelect('hasItem', ruleIndex, values.hasItem, this.entitySelectHtml('item', values.hasItem, gameData), 'Предмет') +
        '</span>';
    } else if (type === 'notHasItem') {
      body = 'у героя нет <span class="nl-token">' +
        this.renderNlSelect('notHasItem', ruleIndex, values.notHasItem, this.entitySelectHtml('item', values.notHasItem, gameData), 'Предмет') +
        '</span>';
    } else if (type === 'goldMin') {
      body = 'у героя не меньше <span class="nl-token">' +
        this.renderNlNumber('goldMin', ruleIndex, values.goldMin, 'Золото') +
        '</span> золота';
    } else if (type === 'goldMax') {
      body = 'у героя не больше <span class="nl-token">' +
        this.renderNlNumber('goldMax', ruleIndex, values.goldMax, 'Золото') +
        '</span> золота';
    } else if (type === 'questStage') {
      body = 'квест <span class="nl-token">' +
        this.renderNlSelect('questId', ruleIndex, values.questId, this.entitySelectHtml('quest', values.questId, gameData), 'Квест') +
        '</span> на <span class="nl-token">' +
        this.renderNlSelect('stage', ruleIndex, values.stage, this.questStageSelectHtml(values.questId, values.stage, editorApi), 'Этап') +
        '</span>';
    } else if (type === 'questMinStage') {
      body = 'квест <span class="nl-token">' +
        this.renderNlSelect('questId', ruleIndex, values.questId, this.entitySelectHtml('quest', values.questId, gameData), 'Квест') +
        '</span> не ниже <span class="nl-token">' +
        this.renderNlNumber('stage', ruleIndex, values.stage, 'Этап') +
        '</span>';
    } else if (type === 'class') {
      const classOpts = this.entitySelectHtml('class', values.class, gameData);
      const classField = classOpts.indexOf('<option value="">') >= 0 && classOpts.indexOf('selected') < 0
        ? this.renderNlSelect('class', ruleIndex, values.class, classOpts, 'Класс')
        : this.renderNlText('class', ruleIndex, values.class, 'Класс');
      body = 'класс героя — <span class="nl-token">' + classField + '</span>';
    } else if (type === 'choiceUsed') {
      body = 'игрок уже выбирал этот вариант <span class="nl-token">(' +
        this.renderNlText('choiceUsed', ruleIndex, values.choiceUsed, 'Флаг выбора') + ')</span>';
    } else if (type === 'choiceNotUsed') {
      body = 'игрок ещё не выбирал этот вариант <span class="nl-token">(' +
        this.renderNlText('choiceNotUsed', ruleIndex, values.choiceNotUsed, 'Флаг выбора') + ')</span>';
    } else if (type === 'reputation') {
      const opOpts = [
        { id: 'gte', label: 'не меньше' },
        { id: 'lte', label: 'не больше' },
        { id: 'eq', label: 'равна' }
      ].map((o) => '<option value="' + o.id + '"' + (o.id === (values.op || 'gte') ? ' selected' : '') + '>' + o.label + '</option>').join('');
      body = 'репутация <span class="nl-token">' +
        this.renderNlSelect('faction', ruleIndex, values.faction, this.entitySelectHtml('faction', values.faction, gameData), 'Фракция') +
        '</span> <span class="nl-token">' +
        this.renderNlSelect('op', ruleIndex, values.op, opOpts, 'Сравнение') +
        '</span> <span class="nl-token">' +
        this.renderNlNumber('value', ruleIndex, values.value, 'Значение') +
        '</span>';
    } else {
      body = this.escapeHtml(this.ruleToPhrase(rule, gameData));
    }

    return '<div class="nl-condition" data-nl-rule data-rule-index="' + ruleIndex + '">' +
      '<p class="nl-condition-sentence"><span class="nl-condition-lead">' + this.escapeHtml(lead) + '</span> ' + body + '</p>' +
      '<p class="nl-condition-phrase" title="Читаемая формулировка">' + this.escapeHtml(this.ruleToPhrase(rule, gameData)) + '</p>' +
      '<div class="nl-condition-meta writer-advanced-only">' +
      '<code class="nl-condition-output" data-nl-preview>' + this.escapeHtml(preview) + '</code></div></div>';
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

  renderFieldsHtml(opts) {
    const type = this.inferRuleType(opts.rule);
    if (type === 'flag' || type === 'notFlag') {
      return this.renderFlagFieldsHtml(opts);
    }
    return this.renderGenericFieldsHtml(opts);
  }
};

if (typeof window !== 'undefined') window.NLConditionBuilder = NLConditionBuilder;
