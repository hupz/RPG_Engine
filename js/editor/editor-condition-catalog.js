/**
 * Phase 1.10.4 — Editor Condition Catalog (UX only).
 * Runtime evaluation stays in ConditionSystem (js/conditions.js).
 * Payload: { all: [ rule, ... ] } | { any: [ rule, ... ] }
 * matching ConditionSystem.normalize/evaluate.
 */
(function editorConditionCatalog(global) {
  'use strict';

  const CONDITION_CATEGORIES = Object.freeze([
    { id: 'inventory', label: 'Инвентарь', icon: '🎒' },
    { id: 'economy', label: 'Экономика', icon: '🪙' },
    { id: 'quest', label: 'Квест', icon: '📜' },
    { id: 'player', label: 'Игрок', icon: '👤' },
    { id: 'advanced', label: 'Продвинутое', icon: '⚙️' }
  ]);

  /** Keys handled by ConditionSystem.evaluateRule (editor metadata only). */
  const RUNTIME_RULE_KEYS = Object.freeze([
    'hasItem', 'notHasItem', 'goldMin', 'goldMax',
    'questStage', 'questMinStage', 'class',
    'flag', 'notFlag', 'choiceUsed', 'choiceNotUsed', 'reputation'
  ]);

  const REPUTATION_OPS = Object.freeze([
    { value: 'gte', label: '≥' },
    { value: 'lte', label: '≤' },
    { value: 'eq', label: '=' }
  ]);

  /**
   * Catalog entries map to ConditionSystem.evaluateRule keys.
   */
  const CONDITION_CATALOG = Object.freeze([
    {
      id: 'hasItem',
      label: 'У игрока есть предмет',
      category: 'inventory',
      writerSafe: true,
      description: 'Предмет есть в инвентаре.',
      params: [{ id: 'hasItem', type: 'item', label: 'Предмет', required: true }]
    },
    {
      id: 'notHasItem',
      label: 'Нет предмета',
      category: 'inventory',
      writerSafe: true,
      params: [{ id: 'notHasItem', type: 'item', label: 'Предмет', required: true }]
    },
    {
      id: 'goldMin',
      label: 'Золота не меньше',
      category: 'economy',
      writerSafe: true,
      params: [{ id: 'goldMin', type: 'number', label: 'Минимум', default: 1, min: 0 }]
    },
    {
      id: 'goldMax',
      label: 'Золота не больше',
      category: 'economy',
      writerSafe: true,
      params: [{ id: 'goldMax', type: 'number', label: 'Максимум', default: 100, min: 0 }]
    },
    {
      id: 'questStage',
      label: 'Квест на стадии',
      category: 'quest',
      writerSafe: true,
      description: 'Точное совпадение стадии (QuestRuntime).',
      params: [
        { id: 'questId', type: 'quest', label: 'Квест', required: true },
        { id: 'stage', type: 'text', label: 'Стадия', required: true }
      ]
    },
    {
      id: 'questMinStage',
      label: 'Квест не ниже стадии',
      category: 'quest',
      writerSafe: true,
      params: [
        { id: 'questId', type: 'quest', label: 'Квест', required: true },
        { id: 'stage', type: 'number', label: 'Мин. стадия', default: 1 }
      ]
    },
    {
      id: 'class',
      label: 'Класс персонажа',
      category: 'player',
      writerSafe: true,
      params: [{ id: 'class', type: 'text', label: 'Класс (id)', required: true }]
    },
    {
      id: 'choiceUsed',
      label: 'Выбор уже был сделан',
      category: 'player',
      writerSafe: true,
      description: 'Флаг выбора установлен (choiceUsed).',
      params: [{ id: 'choiceUsed', type: 'text', label: 'Флаг выбора', required: true }]
    },
    {
      id: 'choiceNotUsed',
      label: 'Выбор ещё не был сделан',
      category: 'player',
      writerSafe: true,
      params: [{ id: 'choiceNotUsed', type: 'text', label: 'Флаг выбора', required: true }]
    },
    {
      id: 'reputation',
      label: 'Репутация',
      category: 'player',
      writerSafe: true,
      description: 'Сравнение репутации фракции (ConditionSystem).',
      params: [
        { id: 'faction', type: 'faction', label: 'Фракция', required: true },
        {
          id: 'op',
          type: 'select',
          label: 'Оператор',
          default: 'gte',
          options: REPUTATION_OPS.slice()
        },
        { id: 'value', type: 'number', label: 'Значение', default: 0 }
      ]
    },
    {
      id: 'flag',
      label: 'Флаг установлен',
      category: 'advanced',
      writerSafe: false,
      description: 'Техническое. Предпочтительны квесты и предметы.',
      params: [
        { id: 'flag', type: 'text', label: 'Флаг', required: true },
        { id: 'equals', type: 'text', label: 'Значение', default: 'true' }
      ]
    },
    {
      id: 'notFlag',
      label: 'Флаг НЕ установлен',
      category: 'advanced',
      writerSafe: false,
      description: 'Техническое. Флаг отсутствует или ложен.',
      params: [{ id: 'notFlag', type: 'text', label: 'Флаг', required: true }]
    }
  ]);

  const byId = Object.create(null);
  CONDITION_CATALOG.forEach(function (e) { byId[e.id] = e; });

  const knownRuntimeSet = Object.create(null);
  RUNTIME_RULE_KEYS.forEach(function (k) { knownRuntimeSet[k] = true; });

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escAttr(s) {
    return escHtml(s).replace(/'/g, '&#39;');
  }

  function isWriterModeActive() {
    try {
      if (typeof Editor !== 'undefined' && typeof Editor.isWriterMode === 'function') {
        return !!Editor.isWriterMode();
      }
    } catch (e) { /* */ }
    return false;
  }

  function getConditionCatalog(opts) {
    opts = opts || {};
    var list = CONDITION_CATALOG.slice();
    if (opts.writerOnly) list = list.filter(function (e) { return e.writerSafe; });
    return list;
  }

  function getConditionDefinition(id) {
    return byId[id] || null;
  }

  function entityLabel(type, id, data) {
    if (!id) return '';
    data = data || (typeof Editor !== 'undefined' ? Editor.data : null) || {};
    if (type === 'item' && data.items && data.items[id]) {
      return data.items[id].name || data.items[id].title || id;
    }
    if (type === 'quest' && data.quests && data.quests[id]) {
      return data.quests[id].title || data.quests[id].name || id;
    }
    if (type === 'faction' && data.factions && data.factions[id]) {
      return data.factions[id].name || id;
    }
    return String(id);
  }

  /** Human-readable one-line condition rule (UI-8). Unknown rules preserved. */
  function formatConditionRuleSummary(rule, data) {
    if (!rule || typeof rule !== 'object') return '—';
    var id = ruleToCatalogId(rule);
    if (!id) return 'Неизвестное условие';
    var def = getConditionDefinition(id);
    var label = def ? def.label : id;
    var vals = valuesFromRule(rule);
    data = data || (typeof Editor !== 'undefined' ? Editor.data : null) || {};
    if (id === 'hasItem' || id === 'notHasItem') {
      var itemId = vals.hasItem || vals.notHasItem;
      if (itemId) label += ': ' + entityLabel('item', itemId, data);
    } else if (id === 'goldMin' || id === 'goldMax') {
      var g = vals.goldMin != null ? vals.goldMin : vals.goldMax;
      if (g != null) label += ' ' + g;
    } else if (id === 'questStage' || id === 'questMinStage') {
      var qid = vals.questId;
      if (qid) label += ': ' + entityLabel('quest', qid, data);
      if (vals.stage != null) label += ' / ' + vals.stage;
    } else if (id === 'reputation' && vals.faction) {
      label += ': ' + entityLabel('faction', vals.faction, data);
      if (vals.value != null) label += ' ' + (vals.op || '≥') + ' ' + vals.value;
    } else if (id === 'flag' || id === 'notFlag') {
      var f = vals.flag || vals.notFlag;
      if (f) label += ': ' + f;
    }
    return label;
  }

  /** Summary block for showIf (UI-8). */
  function formatConditionsSummary(showIf, data) {
    var rules = extractRules(showIf);
    if (!rules.length) return { empty: true, mode: 'all', lines: [] };
    var mode = getConditionMode(showIf);
    return {
      empty: false,
      mode: mode,
      modeLabel: mode === 'any' ? 'Хотя бы одно' : 'Все условия',
      lines: rules.map(function (r) { return formatConditionRuleSummary(r, data); })
    };
  }

  function getWriterConditions() {
    return getConditionCatalog({ writerOnly: true });
  }

  function getConditionCategories() {
    return CONDITION_CATEGORIES.slice();
  }

  /** Detect catalog id from a ConditionSystem rule object */
  function ruleToCatalogId(rule) {
    if (!rule || typeof rule !== 'object') return null;
    if (Array.isArray(rule.all) || Array.isArray(rule.any)) return null;
    if (rule.notFlag != null && rule.notFlag !== '') return 'notFlag';
    if (rule.hasItem != null) return 'hasItem';
    if (rule.notHasItem != null) return 'notHasItem';
    if (rule.goldMin != null) return 'goldMin';
    if (rule.goldMax != null) return 'goldMax';
    if (rule.questStage) return 'questStage';
    if (rule.questMinStage) return 'questMinStage';
    if (rule.class != null) return 'class';
    if (rule.choiceUsed != null) return 'choiceUsed';
    if (rule.choiceNotUsed != null) return 'choiceNotUsed';
    if (rule.reputation) return 'reputation';
    if (rule.flag != null) return 'flag';
    return null;
  }

  /** Detect mode without mutating. Default all for flat / missing. */
  function getConditionMode(showIf) {
    if (!showIf || typeof showIf !== 'object') return 'all';
    if (Array.isArray(showIf.any)) return 'any';
    return 'all';
  }

  /** Flatten showIf / conditions into rule array (does not mutate). */
  function extractRules(showIf) {
    if (!showIf) return [];
    if (Array.isArray(showIf)) return showIf.slice();
    if (Array.isArray(showIf.all)) return showIf.all.slice();
    if (Array.isArray(showIf.any)) return showIf.any.slice();
    // Invalid legacy editor shape { mode, rules } — read rules without rewriting
    if (Array.isArray(showIf.rules)) return showIf.rules.slice();
    // flat legacy
    if (typeof ConditionSystem !== 'undefined' && ConditionSystem.normalize) {
      var n = ConditionSystem.normalize(showIf);
      if (n && Array.isArray(n.all)) return n.all.slice();
      if (n && Array.isArray(n.any)) return n.any.slice();
    }
    return [];
  }

  /**
   * Build showIf object. Preserves mode (all|any).
   * @param {object[]} rules
   * @param {string} [mode='all']
   */
  function rulesToShowIf(rules, mode) {
    if (!rules || !rules.length) return null;
    var m = mode === 'any' ? 'any' : 'all';
    if (m === 'any') return { any: rules.slice() };
    return { all: rules.slice() };
  }

  /** Build rule object from catalog id + form values */
  function buildRule(catalogId, values) {
    values = values || {};
    if (catalogId === 'hasItem') return { hasItem: values.hasItem || values.itemId || '' };
    if (catalogId === 'notHasItem') return { notHasItem: values.notHasItem || values.itemId || '' };
    if (catalogId === 'goldMin') return { goldMin: Number(values.goldMin != null ? values.goldMin : 0) };
    if (catalogId === 'goldMax') return { goldMax: Number(values.goldMax != null ? values.goldMax : 0) };
    if (catalogId === 'questStage') {
      return {
        questStage: {
          questId: values.questId || '',
          stage: values.stage != null ? String(values.stage) : ''
        }
      };
    }
    if (catalogId === 'questMinStage') {
      return {
        questMinStage: {
          questId: values.questId || '',
          stage: Number(values.stage != null ? values.stage : 1)
        }
      };
    }
    if (catalogId === 'class') return { class: values.class || '' };
    if (catalogId === 'choiceUsed') return { choiceUsed: values.choiceUsed || '' };
    if (catalogId === 'choiceNotUsed') return { choiceNotUsed: values.choiceNotUsed || '' };
    if (catalogId === 'reputation') {
      var op = values.op || 'gte';
      if (op === '>=') op = 'gte';
      if (op === '<=') op = 'lte';
      return {
        reputation: {
          faction: values.faction || '',
          op: op,
          value: Number(values.value != null ? values.value : 0)
        }
      };
    }
    if (catalogId === 'flag') {
      var eq = values.equals;
      if (eq === 'true') eq = true;
      else if (eq === 'false') eq = false;
      return { flag: values.flag || '', equals: eq !== undefined ? eq : true };
    }
    if (catalogId === 'notFlag') return { notFlag: values.notFlag || values.flag || '' };
    return Object.assign({}, values);
  }

  function valuesFromRule(rule) {
    if (!rule) return {};
    if (rule.notFlag != null) return { notFlag: rule.notFlag };
    if (rule.hasItem != null) return { hasItem: rule.hasItem };
    if (rule.notHasItem != null) return { notHasItem: rule.notHasItem };
    if (rule.goldMin != null) return { goldMin: rule.goldMin };
    if (rule.goldMax != null) return { goldMax: rule.goldMax };
    if (rule.questStage) {
      return {
        questId: rule.questStage.questId || rule.questStage.quest || '',
        stage: rule.questStage.stage != null ? rule.questStage.stage : ''
      };
    }
    if (rule.questMinStage) {
      return {
        questId: rule.questMinStage.questId || rule.questMinStage.quest || '',
        stage: rule.questMinStage.stage
      };
    }
    if (rule.class != null) return { class: rule.class };
    if (rule.choiceUsed != null) return { choiceUsed: rule.choiceUsed };
    if (rule.choiceNotUsed != null) return { choiceNotUsed: rule.choiceNotUsed };
    if (rule.reputation) {
      return {
        faction: rule.reputation.faction || '',
        op: rule.reputation.op || 'gte',
        value: rule.reputation.value != null ? rule.reputation.value : 0
      };
    }
    if (rule.flag != null) return { flag: rule.flag, equals: rule.equals != null ? rule.equals : true };
    return Object.assign({}, rule);
  }

  function factionOptions(data) {
    data = data || {};
    var opts = [];
    var map = data.reputation || {};
    Object.keys(map).forEach(function (id) {
      if (id === 'starting') return;
      var o = map[id] || {};
      opts.push({ id: id, label: o.name || o.title || id });
    });
    return opts;
  }

  function entitySelectHtml(type, selectedId, data) {
    data = data || (typeof Editor !== 'undefined' ? Editor.data : null) || {};
    var opts = [];
    if (type === 'faction') {
      opts = factionOptions(data);
    } else if (typeof Editor !== 'undefined' && typeof Editor.getActionEntityOptions === 'function') {
      opts = Editor.getActionEntityOptions(type, data) || [];
    } else if (typeof EditorActionCatalog !== 'undefined' && EditorActionCatalog.getEntityOptions) {
      opts = EditorActionCatalog.getEntityOptions(type, data) || [];
    } else {
      var map = type === 'item' ? data.items : type === 'quest' ? data.quests : type === 'npc' ? data.npcs : data.scenes;
      Object.keys(map || {}).forEach(function (id) {
        var o = map[id] || {};
        opts.push({ id: id, label: o.name || o.title || o.location || id });
      });
    }
    var html = '';
    var found = false;
    if (!opts.length) html += '<option value="">(нет данных)</option>';
    opts.forEach(function (o) {
      if (o.id === selectedId) found = true;
      html += '<option value="' + escAttr(o.id) + '"' + (o.id === selectedId ? ' selected' : '') + '>' + escHtml(o.label) + '</option>';
    });
    if (selectedId && !found) {
      html = '<option value="' + escAttr(selectedId) + '" selected>Неизвестно: ' + escHtml(selectedId) + '</option>' + html;
    }
    return html;
  }

  function selectOptionsHtml(options, selected) {
    var html = '';
    (options || []).forEach(function (o) {
      var v = o.value != null ? o.value : o.id;
      var lab = o.label != null ? o.label : v;
      html += '<option value="' + escAttr(v) + '"' + (String(v) === String(selected) ? ' selected' : '') + '>' + escHtml(lab) + '</option>';
    });
    return html;
  }

  function buildConditionSelectHtml(selectedId, writerOnly) {
    var list = writerOnly ? getWriterConditions() : getConditionCatalog();
    if (isWriterModeActive() && writerOnly !== false) list = getWriterConditions();
    var groups = {};
    list.forEach(function (e) {
      var cat = (CONDITION_CATEGORIES.find(function (c) { return c.id === e.category; }) || {}).label || e.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(e);
    });
    var html = '<option value="">—</option>';
    Object.keys(groups).forEach(function (cat) {
      html += '<optgroup label="' + escHtml(cat) + '">';
      groups[cat].forEach(function (e) {
        var adv = !e.writerSafe ? ' [Advanced]' : '';
        html += '<option value="' + escAttr(e.id) + '"' + (e.id === selectedId ? ' selected' : '') + '>' + escHtml(e.label + adv) + '</option>';
      });
      html += '</optgroup>';
    });
    return html;
  }

  function buildConditionParamFieldsHtml(catalogId, values, opts) {
    opts = opts || {};
    var def = getConditionDefinition(catalogId);
    if (!def) return '';
    values = values || {};
    var nodeId = opts.nodeId || '';
    var idxAttr = opts.index != null ? ' data-cond-index="' + escAttr(opts.index) + '"' : '';
    var html = '';
    (def.params || []).forEach(function (p) {
      var val = values[p.id];
      if (val == null && p.default != null) val = p.default;
      if (val == null) val = '';
      html += '<div class="form-group"><label>' + escHtml(p.label || p.id) + '</label>';
      var common = ' data-cond-param="' + escAttr(p.id) + '" data-node="' + escAttr(nodeId) + '" data-field="condParam"' + idxAttr;
      if (p.type === 'item' || p.type === 'quest' || p.type === 'npc' || p.type === 'scene' || p.type === 'faction') {
        html += '<select' + common + '>' + entitySelectHtml(p.type, String(val), opts.data) + '</select>';
      } else if (p.type === 'select') {
        html += '<select' + common + '>' + selectOptionsHtml(p.options, val) + '</select>';
      } else if (p.type === 'number') {
        html += '<input type="number"' + common + ' value="' + escAttr(val) + '">';
      } else {
        html += '<input type="text"' + common + ' value="' + escAttr(val) + '">';
      }
      html += '</div>';
    });
    return html;
  }

  function buildConditionModeSelectHtml(mode) {
    var m = mode === 'any' ? 'any' : 'all';
    return (
      '<select data-field="condMode">' +
      '<option value="all"' + (m === 'all' ? ' selected' : '') + '>Все условия выполнены</option>' +
      '<option value="any"' + (m === 'any' ? ' selected' : '') + '>Хотя бы одно условие выполнено</option>' +
      '</select>'
    );
  }

  function validateCatalog() {
    var errors = [];
    var seen = Object.create(null);
    CONDITION_CATALOG.forEach(function (e) {
      if (seen[e.id]) errors.push('duplicate ' + e.id);
      seen[e.id] = true;
      if (typeof e.writerSafe !== 'boolean') errors.push('writerSafe ' + e.id);
      if (!e.label) errors.push('label ' + e.id);
    });
    CONDITION_CATALOG.forEach(function (e) {
      if (!knownRuntimeSet[e.id]) errors.push('unknown runtime rule key ' + e.id);
    });
    return { ok: errors.length === 0, errors: errors };
  }

  function isLegacyFlatObject(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
    if (Array.isArray(obj.all) || Array.isArray(obj.any)) return false;
    if (Array.isArray(obj.rules)) return false;
    return RUNTIME_RULE_KEYS.some(function (k) {
      return Object.prototype.hasOwnProperty.call(obj, k);
    });
  }

  /**
   * Editor-level validation. Does not mutate input.
   * @returns {{ ok: boolean, errors: string[], warnings: Array, mode: string, rules: object[] }}
   */
  function validateConditionRules(showIf) {
    var errors = [];
    var warnings = [];
    var mode = 'all';
    var rules = [];

    if (showIf == null || showIf === '' || showIf === true) {
      return { ok: true, errors: errors, warnings: warnings, mode: mode, rules: rules };
    }
    if (typeof showIf !== 'object') {
      errors.push('Condition must be an object or null');
      return { ok: false, errors: errors, warnings: warnings, mode: mode, rules: rules };
    }

    // Invalid no-code preset shape (historical bug)
    if (Array.isArray(showIf.rules) && !Array.isArray(showIf.all) && !Array.isArray(showIf.any)) {
      errors.push('Invalid condition shape: use { all: [...] } or { any: [...] }, not { rules: [...] }');
      rules = showIf.rules.slice();
      mode = showIf.mode === 'any' ? 'any' : 'all';
    } else if (Array.isArray(showIf)) {
      rules = showIf.slice();
      mode = 'all';
      warnings.push({ message: 'Bare rule array; prefer { all: [...] }' });
    } else if (Array.isArray(showIf.all)) {
      rules = showIf.all.slice();
      mode = 'all';
    } else if (Array.isArray(showIf.any)) {
      rules = showIf.any.slice();
      mode = 'any';
    } else if (isLegacyFlatObject(showIf)) {
      rules = extractRules(showIf);
      mode = 'all';
      warnings.push({ message: 'Legacy flat condition; runtime normalizes to { all: [...] }' });
    } else {
      errors.push('Unrecognized condition structure');
      return { ok: false, errors: errors, warnings: warnings, mode: mode, rules: rules };
    }

    rules.forEach(function (rule, i) {
      if (!rule || typeof rule !== 'object') {
        errors.push('Rule ' + (i + 1) + ': not an object');
        return;
      }
      if (Array.isArray(rule.all) || Array.isArray(rule.any)) {
        warnings.push({ index: i, message: 'Nested all/any group (supported by runtime)', rule: rule });
        return;
      }
      var id = ruleToCatalogId(rule);
      if (!id) {
        warnings.push({
          index: i,
          message: 'Unknown condition rule preserved (not deleted)',
          rule: rule
        });
        return;
      }
      if (!knownRuntimeSet[id]) {
        warnings.push({ index: i, message: 'Catalog-only or unsupported key: ' + id, rule: rule });
        return;
      }
      var def = getConditionDefinition(id);
      if (!def) return;
      var vals = valuesFromRule(rule);
      (def.params || []).forEach(function (p) {
        if (!p.required) return;
        var v = vals[p.id];
        if (v == null || v === '') {
          warnings.push({
            index: i,
            message: 'Missing required param «' + (p.label || p.id) + '» for ' + id,
            rule: rule
          });
        }
      });
    });

    return {
      ok: errors.length === 0,
      errors: errors,
      warnings: warnings,
      mode: mode,
      rules: rules
    };
  }

  var api = {
    CONDITION_CATALOG: CONDITION_CATALOG,
    CONDITION_CATEGORIES: CONDITION_CATEGORIES,
    RUNTIME_RULE_KEYS: RUNTIME_RULE_KEYS,
    REPUTATION_OPS: REPUTATION_OPS,
    getConditionCatalog: getConditionCatalog,
    getConditionDefinition: getConditionDefinition,
    getWriterConditions: getWriterConditions,
    getConditionCategories: getConditionCategories,
    ruleToCatalogId: ruleToCatalogId,
    getConditionMode: getConditionMode,
    extractRules: extractRules,
    rulesToShowIf: rulesToShowIf,
    buildRule: buildRule,
    valuesFromRule: valuesFromRule,
    buildConditionSelectHtml: buildConditionSelectHtml,
    buildConditionParamFieldsHtml: buildConditionParamFieldsHtml,
    buildConditionModeSelectHtml: buildConditionModeSelectHtml,
    validateCatalog: validateCatalog,
    validateConditionRules: validateConditionRules,
    formatConditionRuleSummary: formatConditionRuleSummary,
    formatConditionsSummary: formatConditionsSummary
  };

  if (typeof Editor !== 'undefined') {
    Editor.getConditionCatalog = getConditionCatalog;
    Editor.getConditionDefinition = getConditionDefinition;
    Editor.getWriterConditions = getWriterConditions;
    Editor.getConditionCategories = getConditionCategories;
    Editor.extractConditionRules = extractRules;
    Editor.getConditionMode = getConditionMode;
    Editor.rulesToShowIf = rulesToShowIf;
    Editor.buildConditionRule = buildRule;
    Editor.conditionValuesFromRule = valuesFromRule;
    Editor.ruleToCatalogId = ruleToCatalogId;
    Editor.buildConditionSelectHtml = buildConditionSelectHtml;
    Editor.buildConditionParamFieldsHtml = buildConditionParamFieldsHtml;
    Editor.buildConditionModeSelectHtml = buildConditionModeSelectHtml;
    Editor.validateConditionCatalog = validateCatalog;
    Editor.validateConditionRules = validateConditionRules;
    Editor.CONDITION_CATALOG = CONDITION_CATALOG;
    Editor.CONDITION_RUNTIME_RULE_KEYS = RUNTIME_RULE_KEYS;
    Editor.formatConditionRuleSummary = formatConditionRuleSummary;
    Editor.formatConditionsSummary = formatConditionsSummary;
  }

  global.EditorConditionCatalog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
