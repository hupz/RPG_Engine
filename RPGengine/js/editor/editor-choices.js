// Редактор выборов: skillCheck, showIf/hideIf, превью видимости

(function attachEditorChoices() {
  if (typeof Editor === 'undefined') {
    console.error('editor-choices.js: Editor не определён — проверьте синтаксис в editor.html');
    return;
  }
  Object.assign(Editor, {
  previewState: { flags: {}, inventory: [], gold: 0, className: '', questStages: {} },

  SKILL_LIST: [
    'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma',
    'athletics', 'acrobatics', 'stealth', 'perception', 'investigation',
    'persuasion', 'intimidation', 'survival'
  ],

  CONDITION_RULE_TYPES: [
    { id: 'flag', label: 'Флаг = значение' },
    { id: 'notFlag', label: 'Флаг выключен' },
    { id: 'hasItem', label: 'Есть предмет' },
    { id: 'notHasItem', label: 'Нет предмета' },
    { id: 'goldMin', label: 'Золото ≥' },
    { id: 'choiceUsed', label: 'Выбор использован' },
    { id: 'choiceNotUsed', label: 'Выбор не использован' },
    { id: 'class', label: 'Класс' },
    { id: 'questStage', label: 'Стадия квеста' }
  ],

  getItemIds() {
    return Object.keys(this.data?.items || {});
  },

  getFlagCatalog() {
    return ConditionSystem.collectFlagNames(this.data);
  },

  getChoiceActionType(c) {
    if (c.skillCheck) return 'skillCheck';
    if (c.action) return 'action';
    return 'goto';
  },

  syncConditionGroup(group) {
    if (!group) return null;
    if (group.requires && !group.showIf) {
      group.showIf = group.requires;
      delete group.requires;
    }
    if (!group.all && !group.any) {
      const norm = ConditionSystem.normalize(group);
      if (norm?.all) {
        group.all = norm.all;
        group.mode = 'all';
      }
    }
    if (group.any) group.mode = 'any';
    else if (group.all) group.mode = group.mode || 'all';
    if (group.all || group.any) this.stripFlatConditionKeys(group);
    return group;
  },

  getRuleList(group) {
    if (!group) return [];
    this.syncConditionGroup(group);
    return group.any || group.all || [];
  },

  _conditionBuilderSeq: 0,
  _conditionBuilders: null,
  _cbEventsBound: false,

  ensureConditionBuilderEvents() {
    if (this._cbEventsBound) return;
    this._cbEventsBound = true;
    if (!this._conditionBuilders) this._conditionBuilders = new Map();
    const onEvt = (e) => this._onConditionBuilderEvent(e);
    document.addEventListener('change', onEvt);
    document.addEventListener('click', onEvt);
  },

  inferRuleType(rule) {
    if (!rule || typeof rule !== 'object') return 'flag';
    if (rule.notFlag) return 'notFlag';
    if (rule.hasItem) return 'hasItem';
    if (rule.notHasItem) return 'notHasItem';
    if (rule.goldMin != null) return 'goldMin';
    if (rule.choiceUsed) return 'choiceUsed';
    if (rule.choiceNotUsed) return 'choiceNotUsed';
    if (rule.class) return 'class';
    if (rule.questStage) return 'questStage';
    if (rule.flag != null) return 'flag';
    return 'flag';
  },

  createEmptyConditionRule(ruleType) {
    const flags = this.getFlagCatalog();
    const items = this.getItemIds();
    const classes = Object.keys(this.data?.classes || {});
    const rule = {};
    if (ruleType === 'flag') {
      rule.flag = flags[0] || '';
      rule.equals = true;
    } else if (ruleType === 'notFlag') {
      rule.notFlag = flags[0] || '';
    } else if (ruleType === 'hasItem') {
      rule.hasItem = items[0] || '';
    } else if (ruleType === 'notHasItem') {
      rule.notHasItem = items[0] || '';
    } else if (ruleType === 'goldMin') {
      rule.goldMin = 0;
    } else if (ruleType === 'choiceUsed') {
      rule.choiceUsed = '';
    } else if (ruleType === 'choiceNotUsed') {
      rule.choiceNotUsed = '';
    } else if (ruleType === 'class') {
      rule.class = classes[0] || '';
    } else if (ruleType === 'questStage') {
      const qid = this.getQuestIds?.()[0] || '';
      rule.questStage = { questId: qid, stage: this.getQuestStageKeys?.(qid)[0] || '0' };
    }
    return rule;
  },

  ensureConditionOnTarget(target, propertyKey) {
    if (!target[propertyKey]) target[propertyKey] = { all: [], mode: 'all' };
    this.syncConditionGroup(target[propertyKey]);
    return target[propertyKey];
  },

  setConditionGroupMode(group, mode) {
    const list = [...this.getRuleList(group)];
    delete group.all;
    delete group.any;
    if (mode === 'any') group.any = list;
    else group.all = list;
    group.mode = mode;
  },

  stripFlatConditionKeys(group) {
    ['flag', 'equals', 'value', 'notFlag', 'hasItem', 'notHasItem', 'goldMin', 'goldMax',
      'class', 'choiceUsed', 'choiceNotUsed', 'questStage', 'questMinStage', 'requires', 'showIf'
    ].forEach(k => { if (group && k in group && k !== 'all' && k !== 'any' && k !== 'mode') delete group[k]; });
  },

  persistConditionGroup(target, propertyKey) {
    const group = target[propertyKey];
    if (!group) return;
    const list = this.getRuleList(group);
    if (!list.length) {
      delete target[propertyKey];
      return;
    }
    const mode = group.mode || (group.any ? 'any' : 'all');
    this.stripFlatConditionKeys(group);
    delete group.all;
    delete group.any;
    if (mode === 'any') group.any = list;
    else group.all = list;
    group.mode = mode;
  },

  /**
   * Визуальный конструктор условий.
   * @param {object|function} targetObject — объект или () => объект
   * @param {string|string[]} path — ключ свойства ('showIf', 'hideIf', 'condition')
   * @param {function|object} callback — onChange или { title, builderSuffix, onChange, rerender }
   */
  renderConditionBuilder(targetObject, path, callback, options) {
    this.ensureConditionBuilderEvents();
    const propKey = Array.isArray(path) ? path[path.length - 1] : path;
    const opts = typeof callback === 'object' && callback !== null ? callback : (options || {});
    const onChange = typeof callback === 'function' ? callback : (opts.onChange || (() => {}));
    const getTarget = typeof targetObject === 'function' ? targetObject : () => targetObject;
    const title = opts.title || propKey;
    const suffix = opts.builderSuffix || String(++this._conditionBuilderSeq);
    const builderId = 'cb-' + suffix;

    this._conditionBuilders.set(builderId, {
      getTarget,
      propertyKey: propKey,
      onChange,
      title,
      rerender: opts.rerender || null
    });

    const target = getTarget();
    const body = this._renderConditionBuilderBody(target, propKey, builderId, title);
    return `<div class="condition-builder" id="${this.escapeAttr(builderId)}" data-builder-id="${this.escapeAttr(builderId)}">${body}</div>`;
  },

  _renderConditionBuilderBody(target, propertyKey, builderId, title) {
    const raw = target?.[propertyKey];
    const group = raw ? this.syncConditionGroup(raw) : null;
    const list = group ? this.getRuleList(group) : [];
    const mode = group?.mode || 'all';
    const hasGroup = !!group && list.length > 0;

    let html = `<div class="cb-head">
      <strong>${this.escapeHtml(title)}</strong>
      <select class="cb-select cb-select--mode" data-cb-action="set-mode" title="Режим группы">
        <option value="all" ${mode === 'all' ? 'selected' : ''}>Все (И)</option>
        <option value="any" ${mode === 'any' ? 'selected' : ''}>Любое (ИЛИ)</option>
      </select>
      <select class="cb-select cb-select--add" data-cb-action="add-rule">
        <option value="">+ Правило</option>
        ${this.CONDITION_RULE_TYPES.map(t =>
          `<option value="${this.escapeAttr(t.id)}">${this.escapeHtml(t.label)}</option>`
        ).join('')}
      </select>`;
    if (hasGroup || group) {
      html += `<button type="button" class="btn btn-secondary" style="font-size:11px;" data-cb-action="clear">Очистить</button>`;
    }
    html += `</div><div class="cb-rules" data-cb-rules>`;
    if (!list.length) {
      html += `<div class="cb-empty-hint">Нет правил — элемент всегда доступен (для showIf) или не скрыт (для hideIf).</div>`;
    } else {
      list.forEach((rule, ri) => { html += this.renderRuleRow(rule, ri, builderId); });
    }
    html += '</div>';
    return html;
  },

  renderRuleRow(rule, ruleIndex, builderId) {
    const type = this.inferRuleType(rule);
    const types = this.CONDITION_RULE_TYPES;
    const typeOpts = types.map(t =>
      `<option value="${this.escapeAttr(t.id)}" ${t.id === type ? 'selected' : ''}>${this.escapeHtml(t.label)}</option>`
    ).join('');
    return `<div class="cb-rule-row flex-row" data-rule-index="${ruleIndex}">
      <select class="cb-select cb-rule-type" data-cb-action="set-rule-type" data-rule-index="${ruleIndex}">${typeOpts}</select>
      <div class="cb-rule-fields flex-row">${this.renderRuleFields(rule, ruleIndex)}</div>
      <button type="button" class="btn-remove" data-cb-action="remove-rule" data-rule-index="${ruleIndex}" title="Удалить правило">×</button>
    </div>`;
  },

  renderRuleFields(rule, ruleIndex) {
    const type = this.inferRuleType(rule);
    const flags = this.getFlagCatalog();
    const items = this.getItemIds();
    const classes = Object.keys(this.data?.classes || {});
    const ri = ruleIndex;
    const sel = (field, val, optionsHtml) =>
      `<select class="cb-select" data-cb-action="update-field" data-rule-index="${ri}" data-field="${field}">${optionsHtml}</select>`;
    const opt = (v, label, cur) =>
      `<option value="${this.escapeAttr(v)}" ${String(v) === String(cur ?? '') ? 'selected' : ''}>${this.escapeHtml(label)}</option>`;

    if (type === 'flag') {
      const flagOpts = '<option value="">— флаг —</option>' + flags.map(f => opt(f, f, rule.flag)).join('');
      const eq = rule.equals !== undefined ? rule.equals : true;
      const eqOpts = opt('true', 'true', eq) + opt('false', 'false', eq);
      return `<span class="cb-field-label">Флаг</span>${sel('flag', rule.flag, flagOpts)}
        <span class="cb-field-label">=</span>${sel('equals', eq, eqOpts)}`;
    }
    if (type === 'notFlag') {
      const flagOpts = '<option value="">—</option>' + flags.map(f => opt(f, f, rule.notFlag)).join('');
      return `<span class="cb-field-label">Флаг выключен</span>${sel('notFlag', rule.notFlag, flagOpts)}`;
    }
    if (type === 'hasItem') {
      const itemOpts = '<option value="">—</option>' + items.map(id => opt(id, id, rule.hasItem)).join('');
      return `<span class="cb-field-label">Предмет</span>${sel('hasItem', rule.hasItem, itemOpts)}`;
    }
    if (type === 'notHasItem') {
      const itemOpts = '<option value="">—</option>' + items.map(id => opt(id, id, rule.notHasItem)).join('');
      return `<span class="cb-field-label">Нет предмета</span>${sel('notHasItem', rule.notHasItem, itemOpts)}`;
    }
    if (type === 'goldMin') {
      return `<span class="cb-field-label">Золото ≥</span>
        <input type="number" class="cb-input-num" data-cb-action="update-field" data-rule-index="${ri}" data-field="goldMin"
          value="${rule.goldMin != null ? rule.goldMin : 0}" min="0">`;
    }
    if (type === 'choiceUsed') {
      return `<span class="cb-field-label">Флаг выбора</span>
        <input type="text" class="cb-input-text" data-cb-action="update-field" data-rule-index="${ri}" data-field="choiceUsed"
          value="${this.escapeAttr(rule.choiceUsed || '')}" placeholder="ch_scene_0">`;
    }
    if (type === 'choiceNotUsed') {
      return `<span class="cb-field-label">Не использован</span>
        <input type="text" class="cb-input-text" data-cb-action="update-field" data-rule-index="${ri}" data-field="choiceNotUsed"
          value="${this.escapeAttr(rule.choiceNotUsed || '')}" placeholder="ch_scene_0">`;
    }
    if (type === 'class') {
      const clsOpts = classes.map(cid => opt(cid, cid, rule.class)).join('');
      return `<span class="cb-field-label">Класс</span>${sel('class', rule.class, clsOpts)}`;
    }
    if (type === 'questStage') {
      const qid = rule.questStage?.questId || '';
      const stg = rule.questStage?.stage != null ? String(rule.questStage.stage) : '0';
      const questOpts = '<option value="">— квест —</option>' +
        (this.getQuestIds?.() || []).map(q => opt(q, q, qid)).join('');
      const stageKeys = qid ? (this.getQuestStageKeys?.(qid) || ['0']) : ['0'];
      const stageOpts = stageKeys.map(k => opt(k, k, stg)).join('');
      return `<span class="cb-field-label">Квест</span>
        <select class="cb-select" data-cb-action="update-quest" data-rule-index="${ri}" data-quest-field="questId">${questOpts}</select>
        <span class="cb-field-label">Стадия</span>
        <select class="cb-select" data-cb-action="update-quest" data-rule-index="${ri}" data-quest-field="stage">${stageOpts}</select>`;
    }
    return '';
  },

  refreshConditionBuilder(builderId) {
    const ctx = this._conditionBuilders?.get(builderId);
    const root = document.getElementById(builderId);
    if (!ctx || !root) return;
    const target = ctx.getTarget();
    if (!target) return;
    root.innerHTML = this._renderConditionBuilderBody(target, ctx.propertyKey, builderId, ctx.title);
  },

  _afterConditionBuilderChange(builderId, ctx, rerenderPanel) {
    if (ctx.onChange) ctx.onChange();
    this.updateJSONPreview();
    if (rerenderPanel) this.refreshConditionBuilder(builderId);
    else if (ctx.rerender) ctx.rerender();
  },

  _onConditionBuilderEvent(e) {
    const el = e.target.closest('[data-cb-action]');
    if (!el) return;
    const root = el.closest('.condition-builder');
    if (!root) return;
    const builderId = root.dataset.builderId;
    const ctx = this._conditionBuilders?.get(builderId);
    if (!ctx) return;

    const action = el.dataset.cbAction;
    if (e.type === 'click' && action !== 'remove-rule' && action !== 'clear') return;
    if (e.type === 'change' && (action === 'remove-rule' || action === 'clear')) return;
    if (action === 'add-rule' && e.type === 'click') return;
    if (action === 'add-rule' && !el.value) return;

    const target = ctx.getTarget();
    if (!target) return;
    const prop = ctx.propertyKey;
    let needsRefresh = false;

    if (action === 'clear') {
      delete target[prop];
      needsRefresh = true;
    } else if (action === 'set-mode') {
      const group = this.ensureConditionOnTarget(target, prop);
      this.setConditionGroupMode(group, el.value);
      needsRefresh = true;
    } else if (action === 'add-rule') {
      const group = this.ensureConditionOnTarget(target, prop);
      const list = this.getRuleList(group);
      list.push(this.createEmptyConditionRule(el.value));
      el.value = '';
      this.persistConditionGroup(target, prop);
      needsRefresh = true;
    } else if (action === 'remove-rule') {
      const group = target[prop];
      if (!group) return;
      const list = this.getRuleList(group);
      const ri = parseInt(el.dataset.ruleIndex, 10);
      list.splice(ri, 1);
      this.persistConditionGroup(target, prop);
      needsRefresh = true;
    } else if (action === 'set-rule-type') {
      const group = this.ensureConditionOnTarget(target, prop);
      const list = this.getRuleList(group);
      const ri = parseInt(el.dataset.ruleIndex, 10);
      list[ri] = this.createEmptyConditionRule(el.value);
      this.persistConditionGroup(target, prop);
      needsRefresh = true;
    } else if (action === 'update-field') {
      const group = this.ensureConditionOnTarget(target, prop);
      const list = this.getRuleList(group);
      const ri = parseInt(el.dataset.ruleIndex, 10);
      const field = el.dataset.field;
      const rule = list[ri];
      if (!rule) return;
      if (field === 'equals') rule.equals = ConditionSystem.parseEquals(el.value);
      else if (field === 'goldMin') rule.goldMin = parseInt(el.value, 10) || 0;
      else if (el.value === '' || el.value == null) delete rule[field];
      else rule[field] = el.value;
      this.persistConditionGroup(target, prop);
      if (field === 'flag' || field === 'notFlag') needsRefresh = false;
    } else if (action === 'update-quest') {
      const group = this.ensureConditionOnTarget(target, prop);
      const list = this.getRuleList(group);
      const ri = parseInt(el.dataset.ruleIndex, 10);
      const rule = list[ri];
      if (!rule?.questStage) rule.questStage = { questId: '', stage: '0' };
      const qf = el.dataset.questField;
      if (qf === 'questId') {
        rule.questStage.questId = el.value;
        rule.questStage.stage = this.getQuestStageKeys(el.value)[0] || '0';
        needsRefresh = true;
      } else if (qf === 'stage') {
        rule.questStage.stage = el.value;
      }
      this.persistConditionGroup(target, prop);
    }

    this._afterConditionBuilderChange(builderId, ctx, needsRefresh);
  },

  updateChoiceQuestSet(idx, field, value) {
    const c = this.data.scenes[this.currentScene].choices[idx];
    if (!c.questSet) c.questSet = { questId: '', stage: '0' };
    if (field === 'questId') {
      c.questSet.questId = value;
      const keys = this.getQuestStageKeys(value);
      c.questSet.stage = keys[0] || '0';
      this.renderSceneEditor();
    } else {
      c.questSet[field] = value;
    }
    this.updateJSONPreview();
  },

  clearChoiceQuestSet(idx) {
    const c = this.data.scenes[this.currentScene].choices[idx];
    delete c.questSet;
    this.renderSceneEditor();
    this.updateJSONPreview();
  },

  setChoiceActionType(idx, type) {
    const c = this.data.scenes[this.currentScene].choices[idx];
    if (type === 'skillCheck') {
      delete c.action;
      if (!c.skillCheck) {
        c.skillCheck = {
          skill: 'strength',
          dc: 13,
          successText: '',
          failText: '',
          successNext: c.to || this.currentScene,
          failNext: c.to || this.currentScene
        };
      }
    } else if (type === 'action') {
      delete c.skillCheck;
      if (!c.action) c.action = '';
    } else {
      delete c.skillCheck;
      delete c.action;
    }
    this.renderSceneEditor();
    this.updateJSONPreview();
  },

  updateSkillCheck(idx, field, value) {
    const c = this.data.scenes[this.currentScene].choices[idx];
    if (!c.skillCheck) c.skillCheck = {};
    if (field === 'dc' || field === 'exp') c.skillCheck[field] = parseInt(value, 10) || 0;
    else if (field === 'once') c.skillCheck.once = !!value;
    else if (field === 'successFlags') {
      try {
        if (!value || value === '{}') delete c.skillCheck.successFlags;
        else c.skillCheck.successFlags = JSON.parse(value);
      } catch (e) { alert('JSON: ' + e.message); return; }
    } else if (field === 'successItems') {
      const arr = value.split(',').map(s => s.trim()).filter(Boolean);
      if (arr.length) c.skillCheck.successItems = arr;
      else delete c.skillCheck.successItems;
    } else if (field === 'doneFlag') {
      if (value) c.skillCheck.doneFlag = value;
      else delete c.skillCheck.doneFlag;
    } else c.skillCheck[field] = value;
    this.updateJSONPreview();
  },

  clearChoiceConditions(idx, which) {
    const c = this.data.scenes[this.currentScene].choices[idx];
    if (which === 'hide') delete c.hideIf;
    else { delete c.showIf; delete c.requires; }
    this.renderSceneEditor();
    this.updateJSONPreview();
  },

  renderConditionRules(choiceIdx, which) {
    const key = which === 'hide' ? 'hideIf' : 'showIf';
    const title = which === 'hide' ? 'Скрыть если' : 'Показать если';
    return this.renderConditionBuilder(
      () => this.data.scenes[this.currentScene]?.choices?.[choiceIdx],
      key,
      () => this.updateChoicePreview(),
      { title, builderSuffix: `ch-${choiceIdx}-${which}` }
    );
  },

  renderSkillCheckEditor(idx, c, allScenes) {
    const sc = c.skillCheck || {};
    const flagsJson = sc.successFlags ? JSON.stringify(sc.successFlags) : '';
    return `<div class="skillcheck-block">
      <div class="grid-3"><div class="form-group"><label>Навык</label><select onchange="Editor.updateSkillCheck(${idx},'skill',this.value)">${this.SKILL_LIST.map(s => `<option value="${s}" ${sc.skill===s?'selected':''}>${s}</option>`).join('')}</select></div></div>
      <div class="form-group"><label>DC</label><input type="number" value="${sc.dc??13}" onchange="Editor.updateSkillCheck(${idx},'dc',this.value)"></div>
      <div class="form-group"><label>Один раз</label><label><input type="checkbox" ${sc.once!==false?'checked':''} onchange="Editor.updateSkillCheck(${idx},'once',this.checked)"> да</label></div></div>
      <div class="form-group"><label>Успех — текст</label><textarea rows="2" onchange="Editor.updateSkillCheck(${idx},'successText',this.value)">${this.escapeTextarea(sc.successText||'')}</textarea></div>
      <div class="form-group"><label>Провал — текст</label><textarea rows="2" onchange="Editor.updateSkillCheck(${idx},'failText',this.value)">${this.escapeTextarea(sc.failText||'')}</textarea></div>
      <div class="grid-2"><div class="form-group"><label>Успех → сцена</label><select onchange="Editor.updateSkillCheck(${idx},'successNext',this.value)">${allScenes.map(s => `<option value="${s}" ${(sc.successNext||c.to)===s?'selected':''}>${s}</option>`).join('')}</select></div>
      <div class="form-group"><label>Провал → сцена</label><select onchange="Editor.updateSkillCheck(${idx},'failNext',this.value)">${allScenes.map(s => `<option value="${s}" ${(sc.failNext||c.to)===s?'selected':''}>${s}</option>`).join('')}</select></div></div>
      <div class="form-group"><label>Флаги при успехе (JSON)</label><input value="${this.escapeAttr(flagsJson)}" placeholder='{"doorBroken":true}' onchange="Editor.updateSkillCheck(${idx},'successFlags',this.value)"></div>
      <div class="form-group"><label>Предметы (через запятую)</label><input value="${this.escapeHtml((sc.successItems||[]).join(', '))}" onchange="Editor.updateSkillCheck(${idx},'successItems',this.value)"></div>
      <div class="form-group"><label>doneFlag</label><input value="${this.escapeHtml(sc.doneFlag||'')}" placeholder="sc_${this.currentScene}_${idx}" onchange="Editor.updateSkillCheck(${idx},'doneFlag',this.value)"></div>
    </div>`
  },

  renderChoiceEditor(c, idx, allScenes) {
    const actionType = this.getChoiceActionType(c);
    const autoFlag = c.skillCheck
      ? (c.skillCheck.doneFlag || `sc_${this.currentScene}_${idx}`)
      : (c.doneFlag || (c.once ? `ch_${this.currentScene}_${idx}` : ''));

    let html = `<div class="choice-card">
      <div class="choice-card-head"><strong>Выбор #${idx + 1}</strong>
        <button type="button" class="btn-remove" onclick="Editor.removeChoice(${idx})">×</button></div>
      <div class="grid-2">
        <div class="form-group"><label>Текст</label><input value="${this.escapeHtml(c.text||'')}" onchange="Editor.updateChoice(${idx},'text',this.value)"></div>
        <div class="form-group"><label>Иконка</label><input value="${this.escapeHtml(c.icon||'')}" onchange="Editor.updateChoice(${idx},'icon',this.value)"></div></div>
      <div class="form-group"><label>Тип</label><select onchange="Editor.setChoiceActionType(${idx},this.value)">
        <option value="goto" ${actionType==='goto'?'selected':''}>Переход</option>
        <option value="skillCheck" ${actionType==='skillCheck'?'selected':''}>Проверка навыка</option>
        <option value="action" ${actionType==='action'?'selected':''}>Действие</option></select></div>`;

    if (actionType === 'goto') {
      html += `<div class="form-group"><label>Сцена</label><select onchange="Editor.updateChoice(${idx},'to',this.value)"><option value=""></option>${allScenes.map(s => `<option value="${s}" ${c.to===s?'selected':''}>${s}</option>`).join('')}</select></div>`;
    }
    if (actionType === 'action') {
      html += `<div class="form-group"><label>action</label><input value="${this.escapeHtml(c.action||'')}" onchange="Editor.updateChoice(${idx},'action',this.value)"></div>`;
    }
    if (actionType === 'skillCheck') html += this.renderSkillCheckEditor(idx, c, allScenes);

    html += `<div class="form-group"><label>doneFlag (один раз)</label>
      <input value="${this.escapeHtml(c.doneFlag||'')}" placeholder="${this.escapeHtml(autoFlag)}" onchange="Editor.updateChoice(${idx},'doneFlag',this.value||undefined)">
      <div class="hint">Авто: <code>${this.escapeHtml(autoFlag)}</code></div></div>`;
    html += this.renderConditionRules(idx, 'show');
    html += this.renderConditionRules(idx, 'hide');
    html += this.renderChoiceQuestSetBlock(idx, c);
    html += '</div>';
    return html
  },

  /** Блок «перевести квест на стадию» при выборе кнопки */
  renderChoiceQuestSetBlock(idx, c) {
    const qs = c.questSet;
    if (!qs) {
      return `<div class="form-group quest-set-block">
        <label>Квест при выборе</label>
        <button type="button" class="btn btn-secondary" style="font-size:12px;" onclick="Editor.updateChoiceQuestSet(${idx},'questId',Editor.getQuestIds()[0]||'')">+ При смене стадии квеста</button>
        <div class="hint">Без ручных флагов: стадия из вкладки «Квесты».</div></div>`;
    }
    const qid = qs.questId || '';
    const st = qs.stage != null ? String(qs.stage) : '0';
    return `<div class="form-group quest-set-block">
      <label>📜 При выборе — стадия квеста</label>
      <div class="grid-2">
        <div>${this.renderQuestIdSelect(qid, `Editor.updateChoiceQuestSet(${idx},'questId',this.value)`)}</div>
        <div>${this.renderQuestStageSelect(qid, st, `Editor.updateChoiceQuestSet(${idx},'stage',this.value)`)}</div>
      </div>
      <button type="button" class="btn btn-secondary" style="font-size:11px;margin-top:6px;" onclick="Editor.clearChoiceQuestSet(${idx})">Убрать привязку квеста</button>
    </div>`;
  },

  getPreviewContext() {
    return {
      flags: { ...this.previewState.flags },
      inventory: [...(this.previewState.inventory || [])],
      gold: this.previewState.gold ?? 0,
      className: this.previewState.className || '',
      questStages: { ...(this.previewState.questStages || {}) },
      quests: this.data?.quests || {}
    };
  },

  updatePreviewField(field, value) {
    this.ensurePreviewStateInitialized();
    if (field === 'inventory') {
      this.previewState.inventory = value.split(',').map(s => s.trim()).filter(Boolean);
    } else if (field === 'gold') {
      this.previewState.gold = parseInt(value, 10) || 0;
    } else if (field === 'className') {
      this.previewState.className = value;
    }
    this.updateChoicePreview();
  },

  ensurePreviewStateInitialized() {
    if (!this.previewState) {
      this.previewState = { flags: {}, inventory: [], gold: 0, className: '', questStages: {} };
    }
    if (!this.previewState.flags) this.previewState.flags = {};
    if (!this.previewState.inventory) this.previewState.inventory = [];
    if (!this.previewState.questStages) this.previewState.questStages = {};
    const catalog = this.getFlagCatalog();
    catalog.forEach((name) => {
      if (this.previewState.flags[name] === undefined) {
        const start = this.data?.startingFlags?.[name];
        this.previewState.flags[name] = start !== undefined ? start : false;
      }
    });
  },

  isPreviewFlagOn(val) {
    if (typeof val === 'number') return val !== 0;
    return val === true;
  },

  togglePreviewFlag(flag) {
    this.ensurePreviewStateInitialized();
    const cur = this.previewState.flags[flag];
    if (typeof cur === 'number' || (typeof flag === 'string' && flag.startsWith('rep_'))) {
      this.previewState.flags[flag] = this.isPreviewFlagOn(cur) ? 0 : 10;
    } else {
      this.previewState.flags[flag] = !this.isPreviewFlagOn(cur);
    }
    this.updateChoicePreview();
  },

  togglePreviewItem(itemId) {
    this.ensurePreviewStateInitialized();
    const inv = this.previewState.inventory;
    const i = inv.indexOf(itemId);
    if (i >= 0) inv.splice(i, 1);
    else inv.push(itemId);
    this.updateChoicePreview();
  },

  updateChoicePreview() {
    const el = document.getElementById('choice-preview-panel');
    if (!el || !this.currentScene || !this.data?.scenes) return;
    const scene = this.data.scenes[this.currentScene];
    const ctx = this.getPreviewContext();
    el.innerHTML = (scene.choices || []).map((c, i) => {
      const visible = ConditionSystem.isChoiceVisible(c, ctx);
      const uf = c.doneFlag || (c.skillCheck ? `sc_${this.currentScene}_${i}` : null);
      const used = uf && ctx.flags[uf];
      const cls = visible ? (used ? 'preview-visible used' : 'preview-visible') : 'preview-hidden';
      return `<div class="preview-choice ${cls}">${visible ? '✅' : '⛔'} ${this.escapeHtml(c.text || '(без текста)')}${c.skillCheck ? ' [проверка]' : ''}${used ? ' ✓' : ''}</div>`;
    }).join('') || '<div class="hint">Нет выборов</div>';
    if (Editor.updateLiveScenePreview) Editor.updateLiveScenePreview();
  },

  getPreviewStateSnapshot() {
    this.ensurePreviewStateInitialized();
    return {
      flags: { ...this.previewState.flags },
      inventory: [...(this.previewState.inventory || [])],
      gold: this.previewState.gold ?? 0,
      className: this.previewState.className || '',
      questStages: { ...(this.previewState.questStages || {}) }
    };
  },

  applyPreviewStateSnapshot(snap) {
    if (!snap || typeof snap !== 'object') return false;
    this.ensurePreviewStateInitialized();
    if (snap.flags && typeof snap.flags === 'object') {
      Object.assign(this.previewState.flags, snap.flags);
    }
    if (Array.isArray(snap.inventory)) {
      this.previewState.inventory = [...snap.inventory];
    }
    if (snap.gold != null) this.previewState.gold = Number(snap.gold) || 0;
    if (snap.className != null) this.previewState.className = String(snap.className);
    if (snap.questStages && typeof snap.questStages === 'object') {
      this.previewState.questStages = { ...snap.questStages };
    }
    return true;
  },

  async copyPreviewState() {
    const json = JSON.stringify(this.getPreviewStateSnapshot(), null, 2);
    try {
      await navigator.clipboard.writeText(json);
      alert('Состояние скопировано в буфер обмена.');
    } catch (e) {
      prompt('Скопируйте JSON:', json);
    }
  },

  async pastePreviewState() {
    let raw = '';
    try {
      raw = await navigator.clipboard.readText();
    } catch (e) {
      raw = prompt('Вставьте JSON состояния:') || '';
    }
    if (!raw.trim()) return;
    try {
      const snap = JSON.parse(raw);
      if (!this.applyPreviewStateSnapshot(snap)) {
        alert('Некорректный формат JSON.');
        return;
      }
      this.updateChoicePreview();
      if (this.currentScene) this.renderSceneEditor();
    } catch (err) {
      alert('Ошибка разбора JSON: ' + err.message);
    }
  },

  resetPreviewState() {
    this.applyPreviewPreset('gameStart');
  },

  getLastQuestStageKey(questId) {
    const keys = this.getQuestStageKeys(questId);
    return keys.length ? keys[keys.length - 1] : '0';
  },

  applyPreviewPreset(preset) {
    if (!preset) return;
    this.ensurePreviewStateInitialized();
    const catalog = this.getFlagCatalog();

    if (preset === 'gameStart') {
      catalog.forEach((name) => {
        const start = this.data?.startingFlags?.[name];
        if (typeof start === 'number' || String(name).startsWith('rep_')) {
          this.previewState.flags[name] = typeof start === 'number' ? start : 0;
        } else {
          this.previewState.flags[name] = false;
        }
      });
      this.previewState.inventory = [];
      this.previewState.gold = 0;
      this.previewState.className = '';
      this.previewState.questStages = {};
    } else if (preset === 'allQuests') {
      const ids = this.getQuestIds?.() || [];
      ids.forEach((qid) => {
        this.previewState.questStages[qid] = this.getLastQuestStageKey(qid);
      });
    } else if (preset === 'richHero') {
      this.previewState.gold = 999;
      this.previewState.inventory = this.getItemIds();
    }

    this.updateChoicePreview();
    if (this.currentScene) this.renderSceneEditor();
  },

  renderTestStateQuestSelects() {
    const ids = this.getQuestIds?.() || [];
    if (!ids.length) {
      return '<div class="hint">Квестов в проекте нет.</div>';
    }
    const ps = this.previewState.questStages || {};
    return ids.map((qid) => {
      const keys = this.getQuestStageKeys(qid);
      const cur = ps[qid] != null ? String(ps[qid]) : '';
      const opts = keys.map(k =>
        `<option value="${this.escapeAttr(k)}" ${cur === k ? 'selected' : ''}>${this.escapeHtml(k)}</option>`
      ).join('');
      return `<div class="form-group" style="margin-bottom:8px;">
        <label style="text-transform:none;font-size:13px;">${this.escapeHtml(qid)}</label>
        <select onchange="Editor.setPreviewQuestStage('${this.escapeAttr(qid)}', this.value)" style="width:100%;padding:8px;border:2px solid var(--border);border-radius:6px;">
          <option value="">— не начат —</option>${opts}
        </select>
      </div>`;
    }).join('');
  },

  renderTestStatePanel() {
    this.ensurePreviewStateInitialized();
    const flags = [...this.getFlagCatalog()].sort();
    const items = this.getItemIds();
    const classes = Object.keys(this.data?.classes || {});
    const ps = this.previewState;

    const flagChips = flags.length
      ? flags.map((f) => {
          const on = this.isPreviewFlagOn(ps.flags[f]);
          return `<button type="button" class="chip ${on ? 'on' : ''}" title="${on ? 'true' : 'false'}" onclick="Editor.togglePreviewFlag('${this.escapeAttr(f)}')">${this.escapeHtml(f)}</button>`;
        }).join('')
      : '<span class="hint">Нет флагов в проекте</span>';

    const itemChips = items.length
      ? items.map((id) => {
          const on = (ps.inventory || []).includes(id);
          return `<button type="button" class="chip ${on ? 'on' : ''}" onclick="Editor.togglePreviewItem('${this.escapeAttr(id)}')">${this.escapeHtml(id)}</button>`;
        }).join('')
      : '<span class="hint">Нет предметов в data.items</span>';

    return `<div class="preview-panel" style="margin-top:16px;">
      <h4>🎛️ Тестовое состояние</h4>
      <p class="hint">Контекст для проверки showIf/hideIf. Не сохраняется в JSON проекта.</p>
      <div class="preview-chips" style="margin-bottom:14px;gap:8px;">
        <button type="button" class="btn btn-secondary" style="font-size:12px;" onclick="Editor.copyPreviewState()">📋 Скопировать состояние</button>
        <button type="button" class="btn btn-secondary" style="font-size:12px;" onclick="Editor.pastePreviewState()">📥 Вставить состояние</button>
        <button type="button" class="btn btn-secondary" style="font-size:12px;" onclick="Editor.resetPreviewState()">↺ Сбросить</button>
        <select class="btn btn-secondary" style="font-size:12px;padding:8px 10px;" onchange="Editor.applyPreviewPreset(this.value); this.value='';">
          <option value="">⚡ Пресет…</option>
          <option value="gameStart">Начало игры</option>
          <option value="allQuests">Все квесты выполнены</option>
          <option value="richHero">Богатый герой</option>
        </select>
      </div>
      <div class="grid-3">
        <div class="form-group"><label>Золото</label><input type="number" value="${ps.gold ?? 0}" onchange="Editor.updatePreviewField('gold',this.value)"></div>
        <div class="form-group"><label>Класс</label><select onchange="Editor.updatePreviewField('className',this.value)"><option value="">—</option>${classes.map(cid => `<option value="${cid}" ${ps.className === cid ? 'selected' : ''}>${this.escapeHtml(cid)}</option>`).join('')}</select></div>
      </div>
      <div class="form-group"><label>Флаги</label><div class="preview-chips">${flagChips}</div></div>
      <div class="form-group"><label>Предметы</label><div class="preview-chips">${itemChips}</div></div>
      <div class="form-group"><label>Стадии квестов</label>${this.renderTestStateQuestSelects()}</div>
    </div>`;
  },

  renderChoicePreviewPanel() {
    return `<div class="preview-panel">
      <h4>👁 Превью видимости выборов</h4>
      <p class="hint">Какие кнопки увидит игрок при тестовом состоянии ниже.</p>
      <div id="choice-preview-panel" class="preview-results"></div>
    </div>${this.renderTestStatePanel()}`;
  },

  setPreviewQuestStage(questId, stage) {
    this.ensurePreviewStateInitialized();
    if (!stage) {
      delete this.previewState.questStages[questId];
    } else {
      this.previewState.questStages[questId] = stage;
    }
    this.updateChoicePreview();
  }
});
})();
