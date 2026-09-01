/**
 * Phase 1.10.1 — Unified No-Code Action Catalog (EDITOR UX only).
 * ACTION_REGISTRY = runtime SoT; Catalog = editor presentation only.
 */
(function editorActionCatalog(global) {
  'use strict';

  const CATALOG_CATEGORIES = Object.freeze([
    { id: 'navigation', label: 'Навигация', icon: '🚪' },
    { id: 'interface', label: 'Интерфейс', icon: '🖥' },
    { id: 'player', label: 'Игрок', icon: '👤' },
    { id: 'items', label: 'Предметы', icon: '🎒' },
    { id: 'economy', label: 'Экономика', icon: '🪙' },
    { id: 'quest', label: 'Квест', icon: '📜' },
    { id: 'dialogue', label: 'Диалог', icon: '💬' },
    { id: 'combat', label: 'Бой', icon: '⚔️' },
    { id: 'world', label: 'Мир', icon: '🌍' },
    { id: 'audio', label: 'Аудио', icon: '🎵' },
    { id: 'system', label: 'Система', icon: '💾' },
    { id: 'advanced', label: 'Продвинутое', icon: '⚙️' }
  ]);

  const PARAM_TYPES = Object.freeze([
    'scene', 'item', 'number', 'text', 'quest', 'questStage', 'panel', 'npc', 'boolean',
    'select', 'variable', 'enemy', 'enemies'
  ]);

  const ACTION_CATALOG = Object.freeze([
    {
      id: 'change_scene',
      label: 'Открыть сцену',
      category: 'navigation',
      description: 'Перейти к другой сцене проекта.',
      writerSafe: true,
      params: [{ id: 'sceneId', type: 'scene', label: 'Сцена', required: true }]
    },
    {
      id: 'transition',
      label: 'Переход (эффект)',
      category: 'navigation',
      writerSafe: false,
      params: [{ id: 'sceneId', type: 'scene', label: 'Сцена' }]
    },
    {
      id: 'open_panel',
      label: 'Открыть панель',
      category: 'interface',
      description: 'Инвентарь, журнал и другие панели.',
      writerSafe: true,
      params: [{
        id: 'panel',
        type: 'select',
        label: 'Панель',
        required: true,
        options: [
          { value: 'inventory', label: 'Инвентарь' },
          { value: 'journal', label: 'Журнал' },
          { value: 'quests', label: 'Квесты' },
          { value: 'abilities', label: 'Способности' },
          { value: 'crafting', label: 'Крафт' },
          { value: 'menu', label: 'Меню' }
        ]
      }]
    },
    {
      id: 'refresh_ui',
      label: 'Обновить интерфейс',
      category: 'interface',
      writerSafe: false,
      params: []
    },
    {
      id: 'hide_sidebar',
      label: 'Скрыть боковую панель',
      category: 'interface',
      writerSafe: false,
      params: []
    },
    {
      id: 'show_sidebar',
      label: 'Показать боковую панель',
      category: 'interface',
      writerSafe: false,
      params: []
    },
    {
      id: 'add_item',
      label: 'Выдать предмет',
      category: 'items',
      writerSafe: true,
      params: [
        { id: 'itemId', type: 'item', label: 'Предмет', required: true },
        { id: 'count', type: 'number', label: 'Количество', default: 1, min: 1 }
      ]
    },
    {
      id: 'remove_item',
      label: 'Забрать предмет',
      category: 'items',
      writerSafe: true,
      params: [
        { id: 'itemId', type: 'item', label: 'Предмет', required: true },
        { id: 'count', type: 'number', label: 'Количество', default: 1, min: 1 }
      ]
    },
    {
      id: 'add_gold',
      label: 'Дать золото',
      category: 'economy',
      writerSafe: true,
      params: [{ id: 'amount', type: 'number', label: 'Количество', default: 10, min: 0 }]
    },
    {
      id: 'remove_gold',
      label: 'Забрать золото',
      category: 'economy',
      writerSafe: true,
      params: [{ id: 'amount', type: 'number', label: 'Количество', default: 10, min: 0 }]
    },
    {
      id: 'heal',
      label: 'Вылечить',
      category: 'player',
      writerSafe: true,
      params: [{ id: 'amount', type: 'text', label: 'Количество / формула', default: '10' }]
    },
    {
      id: 'damage',
      label: 'Нанести урон',
      category: 'player',
      writerSafe: false,
      params: [{ id: 'amount', type: 'text', label: 'Количество / формула', default: '1d6' }]
    },
    {
      id: 'set_character',
      label: 'Изменить персонажа',
      category: 'player',
      writerSafe: false,
      params: []
    },
    {
      id: 'update_quest',
      label: 'Обновить квест',
      category: 'quest',
      writerSafe: true,
      params: [
        { id: 'questId', type: 'quest', label: 'Квест', required: true },
        { id: 'stage', type: 'questStage', label: 'Этап / complete', default: '0' }
      ]
    },
    {
      id: 'unlock_achievement',
      label: 'Открыть достижение',
      category: 'quest',
      writerSafe: true,
      params: [{ id: 'id', type: 'text', label: 'ID достижения', required: true }]
    },
    {
      id: 'say',
      label: 'Реплика NPC',
      category: 'dialogue',
      writerSafe: true,
      params: [
        { id: 'npcId', type: 'npc', label: 'NPC' },
        { id: 'text', type: 'text', label: 'Текст', required: true }
      ]
    },
    {
      id: 'start_combat',
      label: 'Start Combat',
      category: 'combat',
      writerSafe: true,
      description: 'enemies[] + nextScene (victory). Defeat is not a start_combat param.',
      params: [
        { id: 'enemies', type: 'enemies', label: 'Enemies', required: true },
        { id: 'nextScene', type: 'scene', label: 'Victory scene (nextScene)' }
      ]
    },
    {
      id: 'end_combat',
      label: 'Закончить бой',
      category: 'combat',
      writerSafe: false,
      params: [{ id: 'victory', type: 'boolean', label: 'Победа', default: true }]
    },
    {
      id: 'advance_time',
      label: 'Сдвинуть время',
      category: 'world',
      writerSafe: true,
      params: [{ id: 'hours', type: 'number', label: 'Часы', default: 1 }]
    },
    {
      id: 'rest_short_time',
      label: 'Короткий отдых',
      category: 'world',
      writerSafe: true,
      params: []
    },
    {
      id: 'rest_long_time',
      label: 'Долгий отдых',
      category: 'world',
      writerSafe: true,
      params: []
    },
    {
      id: 'play_music',
      label: 'Включить музыку',
      category: 'audio',
      writerSafe: true,
      params: [{ id: 'track', type: 'text', label: 'Трек / id' }]
    },
    {
      id: 'stop_music',
      label: 'Остановить музыку',
      category: 'audio',
      writerSafe: true,
      params: []
    },
    {
      id: 'save_game',
      label: 'Сохранить игру',
      category: 'system',
      writerSafe: true,
      params: []
    },
    {
      id: 'load_game',
      label: 'Загрузить игру',
      category: 'system',
      writerSafe: true,
      params: []
    },
    {
      id: 'show_image',
      label: 'Показать изображение',
      category: 'interface',
      writerSafe: true,
      params: [{ id: 'src', type: 'text', label: 'Путь / asset' }]
    },
    {
      id: 'set_flag',
      label: 'Установить флаг',
      category: 'advanced',
      description: 'Техническое. Предпочтительны квесты и задачи.',
      writerSafe: false,
      params: [
        { id: 'flag', type: 'variable', label: 'Переменная / флаг', required: true },
        { id: 'value', type: 'select', label: 'Значение', options: [
          { value: 'true', label: 'true' },
          { value: 'false', label: 'false' },
          { value: 'toggle', label: 'toggle' }
        ] }
      ]
    },
    {
      id: 'run_script',
      label: 'Выполнить скрипт',
      category: 'advanced',
      writerSafe: false,
      params: [{ id: 'code', type: 'text', label: 'Код' }]
    },
    {
      id: 'log',
      label: 'Лог (отладка)',
      category: 'advanced',
      writerSafe: false,
      params: [{ id: 'message', type: 'text', label: 'Сообщение' }]
    }
  ]);


  // Macros expand to ACTION_REGISTRY steps only — never persist macro ids in project JSON.
  const ACTION_MACROS = Object.freeze([
    {
      id: 'give_item',
      label: 'Give Item',
      steps: [{ action: 'add_item', params: { itemId: '', count: 1 } }]
    },
    {
      id: 'take_item',
      label: 'Take Item',
      steps: [{ action: 'remove_item', params: { itemId: '', count: 1 } }]
    },
    {
      id: 'give_gold',
      label: 'Give Gold',
      steps: [{ action: 'add_gold', params: { amount: 10 } }]
    },
    {
      id: 'take_gold',
      label: 'Take Gold',
      steps: [{ action: 'remove_gold', params: { amount: 10 } }]
    },
    {
      id: 'heal_player',
      label: 'Лечение',
      steps: [{ action: 'heal', params: { amount: '10' } }]
    },
    {
      id: 'start_fight',
      label: 'Start Fight',
      steps: [{ action: 'start_combat', params: { enemies: [], nextScene: '' } }]
    },
    {
      id: 'quest_update',
      label: 'Квест (update_quest)',
      steps: [{ action: 'update_quest', params: { questId: '', stage: '' } }]
    },
    {
      id: 'quest_start',
      label: 'Start Quest',
      steps: [{ action: 'update_quest', params: { questId: '', stage: '0' } }]
    },
    {
      id: 'quest_advance',
      label: 'Advance Quest',
      steps: [{ action: 'update_quest', params: { questId: '', stage: '1' } }]
    },
    {
      id: 'quest_complete',
      label: 'Complete Quest',
      steps: [{ action: 'update_quest', params: { questId: '', stage: 'complete' } }]
    },
    {
      id: 'loot_chest',
      label: 'Loot Chest',
      steps: [
        { action: 'say', params: { text: 'Вы открыли сундук и нашли добычу.' } },
        { action: 'add_item', params: { itemId: '', count: 1 } },
        { action: 'add_gold', params: { amount: 25 } },
        { action: 'update_quest', params: { questId: '', stage: '1' } },
        { action: 'set_flag', params: { flag: 'chest_looted', value: true } }
      ]
    },
    {
      id: 'mark_visited',
      label: 'Отметить посещение (set_flag)',
      steps: [{ action: 'set_flag', params: { flag: 'visited_place', value: 'true' } }]
    }
  ]);

  function getActionMacros() {
    return ACTION_MACROS.slice();
  }

  const byId = Object.create(null);
  ACTION_CATALOG.forEach(function (entry) { byId[entry.id] = entry; });


  function isWriterModeActive() {
    try {
      if (typeof Editor !== 'undefined' && typeof Editor.isWriterMode === 'function') {
        return !!Editor.isWriterMode();
      }
    } catch (e) { /* */ }
    return false;
  }

  function listActionsForEditor() {
    if (isWriterModeActive()) return getWriterActions();
    return ACTION_CATALOG.slice();
  }

  function categoryLabel(catId) {
    var c = CATALOG_CATEGORIES.find(function (x) { return x.id === catId; });
    return c ? c.label : catId;
  }

  function matchDefinition(actionId, params) {
    return getActionDefinition(actionId);
  }

  /** Build <optgroup> options for action select. selectedAction = registry id */
  function buildActionSelectHtml(selectedAction, writerOnly) {
    var list = writerOnly ? getWriterActions() : listActionsForEditor();
    var groups = {};
    list.forEach(function (e) {
      var cat = categoryLabel(e.category);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(e);
    });
    var html = '<option value="">— нет —</option>';
    Object.keys(groups).forEach(function (cat) {
      html += '<optgroup label="' + escHtml(cat) + '">';
      groups[cat].forEach(function (e) {
        var sel = e.id === selectedAction ? ' selected' : '';
        var adv = !e.writerSafe ? ' [Advanced]' : '';
        html += '<option value="' + escAttr(e.id) + '"' + sel + '>' + escHtml(e.label + adv) + '</option>';
      });
      html += '</optgroup>';
    });
    return html;
  }

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escAttr(s) {
    return escHtml(s).replace(/'/g, '&#39;');
  }

  function entitySelectHtml(type, selectedId, data) {
    var opts = getEntityOptions(type, data);
    var html = '';
    var found = false;
    if (!opts.length) {
      html += '<option value="">(нет данных)</option>';
    }
    opts.forEach(function (o) {
      var sel = o.id === selectedId ? ' selected' : '';
      if (o.id === selectedId) found = true;
      html += '<option value="' + escAttr(o.id) + '"' + sel + '>' + escHtml(o.label) + '</option>';
    });
    if (selectedId && !found) {
      html = '<option value="' + escAttr(selectedId) + '" selected>Неизвестно: ' + escHtml(selectedId) + '</option>' + html;
    }
    return html;
  }

  function parseEnemiesParam(val) {
    if (typeof CombatAuthoringIndex !== 'undefined' && CombatAuthoringIndex.parseEnemyIds) {
      return CombatAuthoringIndex.parseEnemyIds(val);
    }
    if (Array.isArray(val)) return val.map(String).filter(Boolean);
    if (val == null || val === '') return [];
    return String(val).split(/[,;\s]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function enemiesMultiSelectHtml(selectedIds, data, commonAttrs) {
    var opts = getEntityOptions('enemy', data);
    var selected = parseEnemiesParam(selectedIds);
    var selectedSet = Object.create(null);
    selected.forEach(function (id) { selectedSet[id] = true; });
    var html = '<select multiple size="' + Math.min(6, Math.max(3, opts.length || 3)) + '"' +
      commonAttrs + ' data-param-multi="enemies">';
    if (!opts.length) {
      html += '<option value="">(нет врагов)</option>';
    }
    opts.forEach(function (o) {
      var sel = selectedSet[o.id] ? ' selected' : '';
      html += '<option value="' + escAttr(o.id) + '"' + sel + '>' + escHtml(o.label) + '</option>';
    });
    selected.forEach(function (id) {
      if (!opts.some(function (o) { return o.id === id; })) {
        html += '<option value="' + escAttr(id) + '" selected>Неизвестно: ' + escHtml(id) + '</option>';
      }
    });
    html += '</select>';
    html += '<p class="hint" style="margin:4px 0 0;">Ctrl/Cmd+клик — несколько врагов. Поражение (defeat) не задаётся в start_combat.</p>';
    return html;
  }

  /**
   * HTML for params of one action.
   * dataAttrs: { nodeAttr: 'data-node', nodeId, fieldPrefix for visual: actionParam }
   */
  function buildParamFieldsHtml(actionId, params, opts) {
    opts = opts || {};
    var def = getActionDefinition(actionId);
    if (!def || !def.params || !def.params.length) return '';
    params = params || {};
    var nodeId = opts.nodeId || '';
    var html = '';
    def.params.forEach(function (p) {
      var val = params[p.id];
      if (val == null && p.default != null) val = p.default;
      if (val == null) val = '';
      html += '<div class="form-group"><label>' + escHtml(p.label || p.id) + '</label>';
      var idxAttr = opts.index != null ? ' data-click-index="' + escAttr(opts.index) + '"' : '';
      var common = ' data-param-id="' + escAttr(p.id) + '" data-node="' + escAttr(nodeId) + '" data-field="actionParam"' + idxAttr;
      if (p.type === 'enemies') {
        html += enemiesMultiSelectHtml(val, opts.data, common);
      } else if (p.type === 'enemy') {
        html += '<select' + common + '>' + entitySelectHtml('enemy', String(val), opts.data) + '</select>';
      } else if (p.type === 'scene' || p.type === 'item' || p.type === 'quest' || p.type === 'npc' || p.type === 'variable') {
        html += '<select' + common + '>' + entitySelectHtml(p.type, String(val), opts.data) + '</select>';
      } else if (p.type === 'questStage') {
        var qid = params.questId || '';
        var stages = getQuestStageOptions(qid, opts.data);
        html += '<select' + common + '>';
        if (!stages.length) html += '<option value="">—</option>';
        stages.forEach(function (s) {
          html += '<option value="' + escAttr(s.id) + '"' + (s.id === String(val) ? ' selected' : '') + '>' + escHtml(s.label) + '</option>';
        });
        if (val && !stages.some(function (s) { return s.id === String(val); })) {
          html = html.replace('<select', '<select') + ''; // keep unknown via prepend
        }
        html += '</select>';
      } else if (p.type === 'select' && Array.isArray(p.options)) {
        html += '<select' + common + '>';
        p.options.forEach(function (o) {
          var v = typeof o === 'object' ? o.value : o;
          var lab = typeof o === 'object' ? o.label : o;
          html += '<option value="' + escAttr(v) + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + escHtml(lab) + '</option>';
        });
        if (val && !p.options.some(function (o) {
          var v = typeof o === 'object' ? o.value : o;
          return String(v) === String(val);
        })) {
          html = html.replace('</select>', '<option value="' + escAttr(val) + '" selected>Неизвестно: ' + escHtml(val) + '</option></select>');
        }
        html += '</select>';
      } else if (p.type === 'number') {
        html += '<input type="number"' + common + ' value="' + escAttr(val) + '">';
      } else if (p.type === 'boolean') {
        html += '<select' + common + '><option value="true"' + (val === true || val === 'true' ? ' selected' : '') + '>Да</option>';
        html += '<option value="false"' + (val === false || val === 'false' ? ' selected' : '') + '>Нет</option></select>';
      } else {
        html += '<input type="text"' + common + ' value="' + escAttr(val) + '">';
      }
      html += '</div>';
    });
    return html;
  }

  /** Build params object from definition + partial values */
  function buildParamsObject(actionId, values) {
    var def = getActionDefinition(actionId);
    var out = {};
    values = values || {};
    if (!def) return Object.assign({}, values);
    (def.params || []).forEach(function (p) {
      var v = values[p.id];
      if (v == null || v === '') {
        if (p.default != null) v = p.default;
        else if (p.type === 'enemies') {
          out[p.id] = [];
          return;
        } else return;
      }
      if (p.type === 'number') out[p.id] = Number(v);
      else if (p.type === 'boolean') out[p.id] = v === true || v === 'true';
      else if (p.type === 'enemies') out[p.id] = parseEnemiesParam(v);
      else out[p.id] = v;
    });
    return out;
  }

  function getRegistry() {
    if (typeof ACTION_REGISTRY !== 'undefined' && ACTION_REGISTRY) return ACTION_REGISTRY;
    if (global.ACTION_REGISTRY) return global.ACTION_REGISTRY;
    return null;
  }

  function getActionCatalog(opts) {
    opts = opts || {};
    var list = ACTION_CATALOG.slice();
    if (opts.writerOnly) list = list.filter(function (e) { return e.writerSafe; });
    if (opts.category) list = list.filter(function (e) { return e.category === opts.category; });
    return list;
  }

  function getActionDefinition(id) {
    if (!id) return null;
    return byId[id] || null;
  }

  /** Human-readable label for an action id (UI-8). Unknown ids preserved. */
  function getActionLabel(actionId) {
    if (!actionId) return '—';
    var def = getActionDefinition(actionId);
    return def ? def.label : String(actionId);
  }

  function formatParamDisplay(param, value, data) {
    if (value == null || value === '') return '';
    data = data || (typeof Editor !== 'undefined' ? Editor.data : null) || {};
    if (param.type === 'scene' || param.type === 'item' || param.type === 'quest' || param.type === 'npc') {
      var opts = getEntityOptions(param.type, data);
      var hit = opts.find(function (o) { return o.id === String(value); });
      return hit ? hit.label : String(value);
    }
    if (param.type === 'boolean') return value === true || value === 'true' ? 'Да' : 'Нет';
    return String(value);
  }

  /** One-line summary for action step display (UI-8). */
  function formatActionStepSummary(actionId, params, data) {
    if (!actionId) return '—';
    var def = getActionDefinition(actionId);
    if (!def) return String(actionId);
    var parts = [def.label];
    (def.params || []).forEach(function (p) {
      var v = params && params[p.id];
      if (v == null || v === '') return;
      var disp = formatParamDisplay(p, v, data);
      if (disp) parts.push(disp);
    });
    return parts.join(' — ');
  }

  function getWriterActions() { return getActionCatalog({ writerOnly: true }); }
  function getAdvancedActions() {
    return ACTION_CATALOG.filter(function (e) { return !e.writerSafe; });
  }
  function getActionCategories() { return CATALOG_CATEGORIES.slice(); }
  function getParamTypes() { return PARAM_TYPES.slice(); }

  function getEntityOptions(type, data) {
    data = data || (typeof Editor !== 'undefined' ? Editor.data : null) || {};
    var out = [];
    if (type === 'scene') {
      Object.keys(data.scenes || {}).forEach(function (id) {
        var s = data.scenes[id] || {};
        out.push({ id: id, label: s.title || s.location || id });
      });
    } else if (type === 'item') {
      Object.keys(data.items || {}).forEach(function (id) {
        var it = data.items[id] || {};
        var name = it.name || id;
        var label = (typeof ItemsRewardsIndex !== 'undefined' && ItemsRewardsIndex.itemPickerLabel)
          ? ItemsRewardsIndex.itemPickerLabel(id, it)
          : (name === id ? id : (name + ' (' + id + ')'));
        out.push({ id: id, label: label });
      });
    } else if (type === 'enemy') {
      Object.keys(data.enemies || {}).forEach(function (id) {
        var en = data.enemies[id] || {};
        var label = (typeof CombatAuthoringIndex !== 'undefined' && CombatAuthoringIndex.enemyPickerLabel)
          ? CombatAuthoringIndex.enemyPickerLabel(id, en)
          : ((en.name || id) === id ? id : ((en.name || id) + ' (' + id + ')'));
        out.push({ id: id, label: label });
      });
    } else if (type === 'quest') {
      Object.keys(data.quests || {}).forEach(function (id) {
        var q = data.quests[id] || {};
        var qn = q.name || q.title || id;
        out.push({ id: id, label: qn === id ? id : (qn + ' (' + id + ')') });
      });
    } else if (type === 'npc') {
      Object.keys(data.npcs || {}).forEach(function (id) {
        var n = data.npcs[id] || {};
        var nn = n.name || id;
        out.push({ id: id, label: nn === id ? id : (nn + ' (' + id + ')') });
      });
    } else if (type === 'variable') {
      if (typeof ProjectSchema !== 'undefined' && typeof ProjectSchema.listProjectVariables === 'function') {
        ProjectSchema.listProjectVariables(data).forEach(function (v) {
          out.push({ id: v.id, label: v.name || v.id });
        });
      } else {
        Object.keys(data.variables || {}).forEach(function (id) {
          var v = data.variables[id] || {};
          out.push({ id: id, label: (typeof v === 'string' ? v : v.name) || id });
        });
      }
    }
    return out;
  }

  function getQuestStageOptions(questId, data) {
    data = data || (typeof Editor !== 'undefined' ? Editor.data : null) || {};
    var q = data.quests && data.quests[questId];
    if (!q) {
      return [
        { id: '0', label: '0 — Start' },
        { id: 'complete', label: 'complete — Complete' },
        { id: 'failed', label: 'failed — Fail' }
      ];
    }
    var stages = q.stages || q.stageList || [];
    var out = [];
    if (Array.isArray(stages)) {
      stages.forEach(function (st, i) {
        var title = (typeof st === 'string')
          ? st
          : (st.name || st.title || st.id || ('Этап ' + (i + 1)));
        // Prefer numeric index — matches update_quest / demos / QuestRuntime.setStage
        out.push({ id: String(i), label: (i + 1) + '. ' + title });
      });
    } else if (stages && typeof stages === 'object') {
      Object.keys(stages).forEach(function (id) {
        out.push({ id: id, label: stages[id].name || stages[id].title || id });
      });
    }
    out.push({ id: 'complete', label: '✓ complete — Complete Quest' });
    out.push({ id: 'failed', label: '✗ failed — Fail Quest' });
    return out;
  }

  function validateCatalogAgainstRegistry(registry) {
    registry = registry || getRegistry();
    var errors = [];
    if (!registry) {
      errors.push('ACTION_REGISTRY not available');
      return { ok: false, errors: errors };
    }
    var seen = Object.create(null);
    ACTION_CATALOG.forEach(function (entry) {
      if (seen[entry.id]) errors.push('duplicate catalog id: ' + entry.id);
      seen[entry.id] = true;
      if (!registry[entry.id]) {
        errors.push('catalog id missing in ACTION_REGISTRY: ' + entry.id);
      }
      (entry.params || []).forEach(function (p) {
        if (PARAM_TYPES.indexOf(p.type) < 0) {
          errors.push('invalid param type ' + p.type + ' on ' + entry.id);
        }
      });
      var catOk = CATALOG_CATEGORIES.some(function (c) { return c.id === entry.category; });
      if (!catOk) errors.push('invalid category ' + entry.category + ' on ' + entry.id);
      if (typeof entry.writerSafe !== 'boolean') {
        errors.push('writerSafe missing on ' + entry.id);
      }
      if (!entry.label) errors.push('label missing on ' + entry.id);
    });
    return { ok: errors.length === 0, errors: errors };
  }

  function readParamInputValue(el) {
    if (!el) return '';
    if (el.tagName === 'SELECT' && el.multiple) {
      return Array.prototype.slice.call(el.selectedOptions || [])
        .map(function (o) { return o.value; })
        .filter(Boolean);
    }
    if (el.getAttribute && el.getAttribute('data-param-multi') === 'enemies') {
      return Array.prototype.slice.call(el.selectedOptions || [])
        .map(function (o) { return o.value; })
        .filter(Boolean);
    }
    if (el.type === 'number') return Number(el.value);
    return el.value;
  }

  var api = {
    ACTION_CATALOG: ACTION_CATALOG,
    CATALOG_CATEGORIES: CATALOG_CATEGORIES,
    PARAM_TYPES: PARAM_TYPES,
    getActionCatalog: getActionCatalog,
    getActionDefinition: getActionDefinition,
    getWriterActions: getWriterActions,
    getAdvancedActions: getAdvancedActions,
    getActionCategories: getActionCategories,
    getParamTypes: getParamTypes,
    getEntityOptions: getEntityOptions,
    getQuestStageOptions: getQuestStageOptions,
    validateCatalogAgainstRegistry: validateCatalogAgainstRegistry,
    listActionsForEditor: listActionsForEditor,
    buildActionSelectHtml: buildActionSelectHtml,
    buildParamFieldsHtml: buildParamFieldsHtml,
    buildParamsObject: buildParamsObject,
    entitySelectHtml: entitySelectHtml,
    parseEnemiesParam: parseEnemiesParam,
    readParamInputValue: readParamInputValue,
    matchDefinition: matchDefinition,
    isWriterModeActive: isWriterModeActive,
    getActionMacros: getActionMacros,
    ACTION_MACROS: ACTION_MACROS,
    getActionLabel: getActionLabel,
    formatActionStepSummary: formatActionStepSummary
  };

  if (typeof Editor !== 'undefined') {
    Editor.getActionCatalog = getActionCatalog;
    Editor.getActionDefinition = getActionDefinition;
    Editor.getWriterActions = getWriterActions;
    Editor.getAdvancedActions = getAdvancedActions;
    Editor.getActionCategories = getActionCategories;
    Editor.getActionParamTypes = getParamTypes;
    Editor.getActionEntityOptions = getEntityOptions;
    Editor.getActionQuestStageOptions = getQuestStageOptions;
    Editor.validateActionCatalog = validateCatalogAgainstRegistry;
    Editor.listActionsForEditor = listActionsForEditor;
    Editor.buildActionSelectHtml = buildActionSelectHtml;
    Editor.buildActionParamFieldsHtml = buildParamFieldsHtml;
    Editor.buildActionParamsObject = buildParamsObject;
    Editor.readActionParamInputValue = readParamInputValue;
    Editor.getActionMacros = getActionMacros;
    Editor.ACTION_CATALOG = ACTION_CATALOG;
    Editor.getActionLabel = getActionLabel;
    Editor.formatActionStepSummary = formatActionStepSummary;
  }

  global.EditorActionCatalog = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
