// Редактор выборов: skillCheck, showIf/hideIf, превью видимости

(function attachEditorChoices() {
  if (typeof Editor === 'undefined') {
    console.error('editor-choices.js: Editor не определён — проверьте синтаксис в editor.html');
    return;
  }
  Object.assign(Editor, {
  previewState: {
    level: 1,
    className: '',
    inventory: [],
    gold: 0,
    flags: {},
    questStages: {}
  },

  SKILL_LIST: [
    'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma',
    'athletics', 'acrobatics', 'stealth', 'perception', 'investigation',
    'persuasion', 'intimidation', 'survival'
  ],

  SKILL_LABELS: {
    strength: 'Сила',
    dexterity: 'Ловкость',
    constitution: 'Телосложение',
    intelligence: 'Интеллект',
    wisdom: 'Мудрость',
    charisma: 'Харизма',
    athletics: 'Атлетика',
    acrobatics: 'Акробатика',
    stealth: 'Скрытность',
    perception: 'Восприятие',
    investigation: 'Анализ',
    persuasion: 'Убеждение',
    intimidation: 'Запугивание',
    survival: 'Выживание'
  },

  _skillCheckEditorAdvanced: null,

  allocSmartIdList(prefix) {
    if (!this._smartIdListSeq) this._smartIdListSeq = 0;
    return `${prefix}-${++this._smartIdListSeq}`;
  },

  /**
   * Поле ID с автодополнением (HTML5 datalist). Ручной ввод не блокируется.
   * @param {string} inputId — общий id для list= и <datalist id=>
   * @param {string} currentValue — текущий id
   * @param {{id:string,label?:string}[]} options
   * @param {string} onChangeAttr — например Editor.updateChoice(0,'to',this.value)
   * @param {object} [opts] — placeholder, allowEmpty
   */
  renderSmartIdInput(inputId, currentValue, options, onChangeAttr, opts) {
    const extra = opts || {};
    const val = currentValue != null ? String(currentValue) : '';
    const placeholder = extra.placeholder
      ? ` placeholder="${this.escapeAttr(extra.placeholder)}"`
      : '';
    const listAttr = inputId ? ` list="${this.escapeAttr(inputId)}"` : '';
    const handler = onChangeAttr
      ? ` onchange="${onChangeAttr}" oninput="${onChangeAttr}"`
      : '';
    let datalistHtml = '';
    if (inputId && Array.isArray(options)) {
      let optsHtml = '';
      if (extra.allowEmpty) {
        optsHtml += '<option value="">— пусто —</option>';
      }
      optsHtml += options.map((o) => {
        const id = o?.id != null ? String(o.id) : '';
        if (!id && !extra.allowEmpty) return '';
        const label = (o?.label != null ? String(o.label) : id).trim() || id;
        const text = label && label !== id ? `${id} (${label})` : id;
        return `<option value="${this.escapeAttr(id)}">${this.escapeHtml(text)}</option>`;
      }).join('');
      datalistHtml = `<datalist id="${this.escapeAttr(inputId)}">${optsHtml}</datalist>`;
    }
    return `<input type="text" class="form-control"${listAttr} value="${this.escapeAttr(val)}"${placeholder}${handler}>${datalistHtml}`;
  },

  getSceneOptions() {
    const scenes = this.data?.scenes || {};
    return Object.keys(scenes)
      .sort((a, b) => a.localeCompare(b, 'ru'))
      .map((id) => ({
        id,
        label: (scenes[id]?.location || '').trim() || id
      }));
  },

  getChainOptions() {
    if (typeof this.ensureActionChainsData === 'function') this.ensureActionChainsData();
    const chains = this.data?.actionChains || {};
    return Object.keys(chains)
      .sort((a, b) => a.localeCompare(b, 'ru'))
      .map((id) => ({
        id,
        label: chains[id]?.name || id
      }));
  },

  /** Сцена: автодополнение по data.scenes */
  renderSceneIdField(currentValue, inputId, onChangeAttr, opts) {
    return this.renderSmartIdInput(
      inputId,
      currentValue,
      this.getSceneOptions(),
      onChangeAttr,
      { allowEmpty: true, placeholder: 'id_сцены', ...(opts || {}) }
    );
  },

  /** Цепочка действий: автодополнение по data.actionChains */
  renderChainIdField(currentValue, inputId, onChangeAttr, opts) {
    return this.renderSmartIdInput(
      inputId,
      currentValue,
      this.getChainOptions(),
      onChangeAttr,
      { allowEmpty: true, placeholder: 'id_цепочки', ...(opts || {}) }
    );
  },

  CONDITION_RULE_TYPES: [
    { id: 'questStage', label: 'Квест', group: 'Квест' },
    { id: 'questMinStage', label: 'Квест не ниже стадии', group: 'Квест' },
    { id: 'hasItem', label: 'Есть предмет', group: 'Предмет' },
    { id: 'notHasItem', label: 'Нет предмета', group: 'Предмет' },
    { id: 'goldMin', label: 'Золото не меньше', group: 'Золото' },
    { id: 'goldMax', label: 'Золото не больше', group: 'Золото' },
    { id: 'class', label: 'Класс персонажа', group: 'Класс' },
    { id: 'reputation', label: 'Репутация', group: 'Репутация' },
    { id: 'choiceUsed', label: 'Выбор уже сделан', group: 'Состояние' },
    { id: 'choiceNotUsed', label: 'Выбор ещё не сделан', group: 'Состояние' },
    { id: 'flag', label: 'Состояние игры (расширенное)', group: 'Другое' },
    { id: 'notFlag', label: 'Состояние выключено', group: 'Другое' }
  ],

  getItemIds() {
    return Object.keys(this.data?.items || {});
  },

  getFlagCatalog() {
    if (typeof ConditionSystem === 'undefined') return [];
    let flags = ConditionSystem.collectFlagNames(this.data);
    if (typeof StoryMemory !== 'undefined' && typeof this.isWriterMode === 'function' && this.isWriterMode()) {
      flags = StoryMemory.filterAuthorFlagCatalog(flags);
    }
    return flags;
  },

  /** Переменные для подстановки в текст сцен и диалогов */
  getSmartTextVariables() {
    const base = ['charName', 'gold', 'current_time', 'current_period'];
    const flags = typeof this.getFlagCatalog === 'function' ? this.getFlagCatalog() : [];
    const set = new Set(base);
    flags.forEach((f) => { if (f) set.add(String(f)); });
    return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
  },

  getSnippetAutocompleteIds() {
    if (typeof this.getSnippetIds === 'function') return this.getSnippetIds();
    if (this.data?.snippets && typeof this.data.snippets === 'object') {
      return Object.keys(this.data.snippets).sort((a, b) => a.localeCompare(b, 'ru'));
    }
    return [];
  },

  renderSmartTextarea(id, value, rows, onChangeAttr, variablesList, opts) {
    const extra = opts || {};
    const vars = Array.isArray(variablesList) && variablesList.length
      ? variablesList
      : this.getSmartTextVariables();
    const snippets = this.getSnippetAutocompleteIds();
    const varsJson = this.escapeAttr(JSON.stringify(vars));
    const snippetsJson = this.escapeAttr(JSON.stringify(snippets));
    const rid = id ? ` id="${this.escapeAttr(id)}"` : '';
    const rowCount = rows != null ? rows : 4;
    const onInput = extra.onInput
      ? `${extra.onInput}; Editor.onSmartTextareaInput(event)`
      : 'Editor.onSmartTextareaInput(event)';
    return `<div class="smart-textarea-wrapper" data-vars="${varsJson}" data-snippets="${snippetsJson}" data-onchange="${this.escapeAttr(onChangeAttr || '')}">
      <textarea class="smart-textarea"${rid} rows="${rowCount}"
        onkeydown="Editor.onSmartTextareaKeydown(event)"
        oninput="${onInput}"
        onchange="Editor.onSmartTextareaChange(event)">${this.escapeTextarea(value || '')}</textarea>
      <div class="smart-textarea-warning" role="alert" hidden></div>
    </div>`;
  },

  renderDialogueList(scene) {
    const vars = this.getSmartTextVariables();
    return (scene.dialogue || [])
      .map((d, i) => this.renderDialogueRow(d, i, vars))
      .join('');
  },

  renderDialogueRow(d, idx, variablesList) {
    const vars = variablesList || this.getSmartTextVariables();
    return `<div class="dialogue-row">
      <input placeholder="Говорящий" value="${this.escapeAttr(d.speaker || '')}" onchange="Editor.updateDialogue(${idx},'speaker',this.value)">
      ${this.renderSmartTextarea(
        `dialogue-text-${idx}`,
        d.text || '',
        3,
        `Editor.updateDialogue(${idx},'text',this.value)`,
        vars
      )}
      <button type="button" class="btn btn-danger" onclick="Editor.removeDialogue(${idx})">×</button>
    </div>`;
  },

  _varsFromSmartTextareaWrapper(textarea) {
    const wrapper = textarea?.closest?.('.smart-textarea-wrapper');
    if (!wrapper) return [];
    try {
      return JSON.parse(wrapper.getAttribute('data-vars') || '[]');
    } catch (e) {
      return [];
    }
  },

  _getSmartTextToken(textarea) {
    const pos = textarea.selectionStart;
    const before = textarea.value.slice(0, pos);
    const m = before.match(/[{@]([a-zA-Z0-9_]*)$/);
    if (!m) return null;
    const prefix = m[0][0];
    return {
      kind: prefix === '@' ? 'snippet' : 'var',
      prefix,
      query: m[1],
      replaceLen: m[0].length
    };
  },

  _getVariableTokenQuery(textarea) {
    const t = this._getSmartTextToken(textarea);
    return t && t.kind === 'var' ? t : null;
  },

  _snippetsFromSmartTextareaWrapper(textarea) {
    const wrapper = textarea?.closest?.('.smart-textarea-wrapper');
    if (!wrapper) return [];
    try {
      return JSON.parse(wrapper.getAttribute('data-snippets') || '[]');
    } catch (e) {
      return [];
    }
  },

  runSmartTextareaOnChange(textarea) {
    const wrapper = textarea.closest('.smart-textarea-wrapper');
    if (!wrapper) return;
    const attr = wrapper.getAttribute('data-onchange');
    if (!attr) return;
    try {
      const fn = new Function('el', `return (${attr.replace(/\bthis\b/g, 'el')})`);
      fn(textarea);
    } catch (err) {
      console.warn('Smart textarea onchange:', err);
    }
  },

  validateSmartTextarea(textarea, variablesList) {
    const allowed = new Set(variablesList || this._varsFromSmartTextareaWrapper(textarea));
    const text = textarea.value || '';
    const re = /\{([a-zA-Z0-9_]+)\}/g;
    const invalid = [];
    let m;
    while ((m = re.exec(text))) {
      if (!allowed.has(m[1])) invalid.push(m[1]);
    }
    textarea.classList.toggle('smart-textarea-invalid', invalid.length > 0);
    const warn = textarea.closest('.smart-textarea-wrapper')?.querySelector('.smart-textarea-warning');
    if (warn) {
      if (invalid.length) {
        warn.hidden = false;
        warn.textContent = `Неизвестные переменные: ${invalid.map((v) => `{${v}}`).join(', ')}`;
      } else {
        warn.hidden = true;
        warn.textContent = '';
      }
    }
    return invalid;
  },

  closeVariableAutocomplete() {
    if (this._varAutocompleteEl) {
      this._varAutocompleteEl.remove();
      this._varAutocompleteEl = null;
    }
    this._varAutocompleteTa = null;
  },

  ensureVarAutocompleteGlobalClose() {
    if (this._varAutocompleteCloseBound) return;
    this._varAutocompleteCloseBound = true;
    document.addEventListener('mousedown', (e) => {
      if (!this._varAutocompleteEl) return;
      if (this._varAutocompleteEl.contains(e.target)) return;
      const ta = this._varAutocompleteTa;
      if (ta && (e.target === ta || ta.contains(e.target))) return;
      this.closeVariableAutocomplete();
    });
  },

  _positionVariableAutocomplete(textarea, dropdown) {
    const style = window.getComputedStyle(textarea);
    const lineHeight = parseFloat(style.lineHeight) || 20;
    const padTop = parseFloat(style.paddingTop) || 0;
    const padLeft = parseFloat(style.paddingLeft) || 0;
    const textBefore = textarea.value.substring(0, textarea.selectionStart);
    const lines = textBefore.split('\n');
    const lineNum = lines.length;
    const col = lines[lines.length - 1].length;
    const chWidth = 7.5;
    const top = padTop + lineNum * lineHeight - textarea.scrollTop;
    const left = Math.min(padLeft + col * chWidth, Math.max(0, textarea.clientWidth - 160));
    dropdown.style.top = `${top}px`;
    dropdown.style.left = `${left}px`;
  },

  _renderAutocompleteDropdown(textarea, html, onPick) {
    const wrapper = textarea.closest('.smart-textarea-wrapper');
    if (!wrapper) return;
    this.closeVariableAutocomplete();
    const dropdown = document.createElement('div');
    dropdown.className = 'variable-autocomplete';
    dropdown.setAttribute('role', 'listbox');
    dropdown.innerHTML = html;
    dropdown.addEventListener('mousedown', (e) => {
      const btn = e.target.closest('[data-autocomplete-pick]');
      if (!btn) return;
      e.preventDefault();
      onPick(btn.getAttribute('data-autocomplete-pick'));
      this.closeVariableAutocomplete();
      const vars = this._varsFromSmartTextareaWrapper(textarea);
      this.validateSmartTextarea(textarea, vars);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      this.runSmartTextareaOnChange(textarea);
    });
    wrapper.appendChild(dropdown);
    this._positionVariableAutocomplete(textarea, dropdown);
    this._varAutocompleteEl = dropdown;
    this._varAutocompleteTa = textarea;
    this.ensureVarAutocompleteGlobalClose();
  },

  _renderVariableAutocompleteList(textarea, variablesList, query) {
    const q = (query || '').toLowerCase();
    const filtered = variablesList.filter((v) => !q || String(v).toLowerCase().includes(q));
    if (!filtered.length) {
      this.closeVariableAutocomplete();
      return;
    }
    const html = filtered.slice(0, 40).map((v) => {
      const id = String(v);
      return `<button type="button" class="variable-autocomplete-item" data-autocomplete-pick="${this.escapeAttr(id)}" role="option">{${this.escapeHtml(id)}}</button>`;
    }).join('');
    this._renderAutocompleteDropdown(textarea, html, (varName) => {
      this.insertSmartTextAtCursor(textarea, 'var', varName);
    });
  },

  _renderSnippetAutocompleteList(textarea, snippetIds, query) {
    const q = (query || '').toLowerCase();
    const filtered = snippetIds.filter((id) => !q || String(id).toLowerCase().includes(q));
    if (!filtered.length) {
      this.closeVariableAutocomplete();
      return;
    }
    const snippets = this.data?.snippets || {};
    const html = filtered.slice(0, 40).map((id) => {
      const preview = String(snippets[id] || '').slice(0, 48);
      const label = preview ? `${id} — ${preview}${preview.length >= 48 ? '…' : ''}` : id;
      return `<button type="button" class="variable-autocomplete-item variable-autocomplete-item--snippet" data-autocomplete-pick="${this.escapeAttr(id)}" role="option">@${this.escapeHtml(label)}</button>`;
    }).join('');
    this._renderAutocompleteDropdown(textarea, html, (snippetId) => {
      this.insertSmartTextAtCursor(textarea, 'snippet', snippetId);
    });
  },

  showVariableAutocomplete(event, textarea, variablesList) {
    if (!textarea) return;
    const vars = variablesList || this._varsFromSmartTextareaWrapper(textarea);
    const token = this._getSmartTextToken(textarea);
    const query = token && token.kind === 'var' ? token.query : '';
    this._renderVariableAutocompleteList(textarea, vars, query);
  },

  showSnippetAutocomplete(event, textarea, snippetIds) {
    if (!textarea) return;
    const ids = snippetIds || this._snippetsFromSmartTextareaWrapper(textarea);
    const token = this._getSmartTextToken(textarea);
    const query = token && token.kind === 'snippet' ? token.query : '';
    this._renderSnippetAutocompleteList(textarea, ids, query);
  },

  insertSmartTextAtCursor(textarea, kind, name) {
    const pos = textarea.selectionStart;
    const before = textarea.value.slice(0, pos);
    const after = textarea.value.slice(pos);
    const token = before.match(/[{@]([a-zA-Z0-9_]*)$/);
    if (!token) return;
    const start = pos - token[0].length;
    const insert = kind === 'snippet' ? `@${name}` : `{${name}}`;
    textarea.value = before.slice(0, start) + insert + after;
    const newPos = start + insert.length;
    textarea.selectionStart = newPos;
    textarea.selectionEnd = newPos;
  },

  insertVariableAtCursor(textarea, varName) {
    this.insertSmartTextAtCursor(textarea, 'var', varName);
  },

  onSmartTextareaInput(event) {
    const ta = event.target;
    if (!ta?.classList?.contains('smart-textarea')) return;
    const ch = event.data;
    const token = this._getSmartTextToken(ta);

    if (ch === '@' || (token && token.kind === 'snippet')) {
      this.showSnippetAutocomplete(event, ta);
      return;
    }
    if (ch === '{' || (token && token.kind === 'var')) {
      this.showVariableAutocomplete(event, ta);
      return;
    }
    if (this._varAutocompleteTa === ta) {
      this.closeVariableAutocomplete();
    }
  },

  onSmartTextareaKeydown(event) {
    if (event.key === 'Escape') {
      this.closeVariableAutocomplete();
    }
  },

  onSmartTextareaChange(event) {
    const ta = event.target;
    if (!ta?.classList?.contains('smart-textarea')) return;
    const vars = this._varsFromSmartTextareaWrapper(ta);
    this.validateSmartTextarea(ta, vars);
    this.closeVariableAutocomplete();
    this.runSmartTextareaOnChange(ta);
  },

  initSmartTextareas(root) {
    const scope = root || document.getElementById('scene-editor');
    if (!scope) return;
    scope.querySelectorAll('textarea.smart-textarea').forEach((ta) => {
      const vars = this._varsFromSmartTextareaWrapper(ta);
      this.validateSmartTextarea(ta, vars);
    });
    this.ensureVarAutocompleteGlobalClose();
  },

  getChoiceActionType(c) {
    if (c.skillCheck) return 'skillCheck';
    // Пустая строка action — валидный режим «Действие» (поле только что создано)
    if (Object.prototype.hasOwnProperty.call(c, 'action')) return 'action';
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
    if (rule.goldMax != null) return 'goldMax';
    if (rule.choiceUsed) return 'choiceUsed';
    if (rule.choiceNotUsed) return 'choiceNotUsed';
    if (rule.class) return 'class';
    if (rule.questStage) return 'questStage';
    if (rule.questMinStage) return 'questMinStage';
    if (rule.reputation) return 'reputation';
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
    } else if (ruleType === 'goldMax') {
      rule.goldMax = 100;
    } else if (ruleType === 'choiceUsed') {
      rule.choiceUsed = '';
    } else if (ruleType === 'choiceNotUsed') {
      rule.choiceNotUsed = '';
    } else if (ruleType === 'class') {
      rule.class = classes[0] || '';
    } else if (ruleType === 'questStage') {
      const qid = this.getQuestIds?.()[0] || '';
      rule.questStage = { questId: qid, stage: this.getQuestStageKeys?.(qid)[0] || '0' };
    } else if (ruleType === 'questMinStage') {
      const qid = this.getQuestIds?.()[0] || '';
      rule.questMinStage = { questId: qid, stage: 0 };
    } else if (ruleType === 'reputation') {
      const fid = this.getFactionIds?.()[0] || 'rep_village';
      rule.reputation = { faction: fid, op: 'gte', value: 0 };
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
    const isShow = /show/i.test(String(title || '')) || propertyKey === 'showIf';
    const headTitle = isShow ? 'Когда это доступно?' : (title || 'Когда скрыть?');

    const groups = {};
    this.CONDITION_RULE_TYPES.forEach((rt) => {
      const g = rt.group || 'Другое';
      if (!groups[g]) groups[g] = [];
      groups[g].push(rt);
    });
    const addOpts = Object.keys(groups).map((g) => {
      const opts = groups[g].map((rt) =>
        `<option value="${this.escapeAttr(rt.id)}">${this.escapeHtml(rt.label)}</option>`
      ).join('');
      return `<optgroup label="${this.escapeAttr(g)}">${opts}</optgroup>`;
    }).join('');

    const clearBtn = (hasGroup || group)
      ? `<button type="button" class="btn btn-secondary" style="font-size:11px;" data-cb-action="clear">Очистить</button>`
      : '';
    const writerAddOpts = typeof NLConditionBuilder !== 'undefined'
      ? NLConditionBuilder.buildAddRuleOptionsHtml({ writerOnly: true })
      : (`<option value="">+ Добавить условие</option>` +
        `<option value="flag">Состояние игры</option>` +
        `<option value="notFlag">Состояние выключено</option>`);

    let html = `<div class="cb-head cb-head--writer writer-only">
      <strong>${this.escapeHtml(headTitle)}</strong>
      ${typeof NLConditionBuilder !== 'undefined' ? NLConditionBuilder.buildModeSelectHtml(mode) : ''}
      <select class="cb-select cb-select--add" data-cb-action="add-rule">${writerAddOpts}</select>
      ${clearBtn}
    </div>`;

    html += `<div class="cb-head writer-advanced-only">
      <strong>${this.escapeHtml(headTitle)}</strong>
      <select class="cb-select cb-select--mode" data-cb-action="set-mode" title="Как сочетать условия">
        <option value="all" ${mode === 'all' ? 'selected' : ''}>Все условия должны выполняться</option>
        <option value="any" ${mode === 'any' ? 'selected' : ''}>Любое условие должно выполняться</option>
      </select>
      <select class="cb-select cb-select--add" data-cb-action="add-rule">
        <option value="">+ Добавить условие</option>
        ${addOpts}
      </select>
      ${clearBtn}
    </div>`;

    const nlRows = list.map((rule, ri) => ({ rule, ri }));

    html += `<div class="cb-rules cb-rules--writer writer-only" data-cb-rules>`;
    if (!list.length) {
      html += `<div class="cb-empty-hint">Без условий — выбор доступен всегда.</div>`;
    } else if (list.length > 1 && typeof NLConditionBuilder !== 'undefined') {
      const groupPhrase = NLConditionBuilder.formatGroupPhrase(
        this.rulesToShowIf ? this.rulesToShowIf(list, mode) : { [mode === 'any' ? 'any' : 'all']: list },
        this.data,
        ''
      );
      html += `<p class="cb-group-phrase">${this.escapeHtml(groupPhrase)}</p>`;
      nlRows.forEach(({ rule, ri }) => { html += this.renderRuleRow(rule, ri, builderId); });
    } else {
      nlRows.forEach(({ rule, ri }) => { html += this.renderRuleRow(rule, ri, builderId); });
    }
    html += `</div>`;

    html += `<div class="cb-rules cb-rules--advanced writer-advanced-only" data-cb-rules>`;
    if (!list.length) {
      html += `<div class="cb-empty-hint">Условий нет — доступно всегда. Нажмите «+ Добавить условие».</div>`;
    } else {
      list.forEach((rule, ri) => { html += this.renderRuleRow(rule, ri, builderId); });
    }
    html += `</div>`;
    return html;
  },

  renderRuleRow(rule, ruleIndex, builderId) {
    const type = this.inferRuleType(rule);
    const types = this.CONDITION_RULE_TYPES;
    const typeOpts = types.map(t =>
      `<option value="${this.escapeAttr(t.id)}" ${t.id === type ? 'selected' : ''}>${this.escapeHtml(t.label)}</option>`
    ).join('');
    const missing = this.getConditionRuleMissingRef(rule);
    const missingHtml = missing
      ? `<div class="quest-task-errors cb-missing" style="width:100%;margin:4px 0;">
          ${this.escapeHtml(missing.message)}
          <button type="button" class="btn btn-secondary btn-sm" data-cb-action="set-rule-type" data-rule-index="${ruleIndex}" data-type-force="${this.escapeAttr(type)}">Выбрать другой</button>
          <button type="button" class="btn btn-danger btn-sm" data-cb-action="remove-rule" data-rule-index="${ruleIndex}">Удалить условие</button>
        </div>`
      : '';
    return `<div class="cb-rule-row flex-row" data-rule-index="${ruleIndex}" style="flex-wrap:wrap;">
      <select class="cb-select cb-rule-type" data-cb-action="set-rule-type" data-rule-index="${ruleIndex}">${typeOpts}</select>
      <div class="cb-rule-fields flex-row">${this.renderRuleFields(rule, ruleIndex)}</div>
      <button type="button" class="btn-remove" data-cb-action="remove-rule" data-rule-index="${ruleIndex}" title="Удалить условие">×</button>
      ${missingHtml}
    </div>`;
  },

  getConditionRuleMissingRef(rule) {
    if (!rule || !this.data) return null;
    if (rule.hasItem && !this.data.items?.[rule.hasItem]) {
      return { kind: 'item', id: rule.hasItem, message: `Предмет «${rule.hasItem}» больше не существует.` };
    }
    if (rule.notHasItem && !this.data.items?.[rule.notHasItem]) {
      return { kind: 'item', id: rule.notHasItem, message: `Предмет «${rule.notHasItem}» больше не существует.` };
    }
    if (rule.questStage?.questId && !this.data.quests?.[rule.questStage.questId]) {
      return { kind: 'quest', id: rule.questStage.questId, message: `Квест «${rule.questStage.questId}» больше не существует.` };
    }
    if (rule.questMinStage?.questId && !this.data.quests?.[rule.questMinStage.questId]) {
      return { kind: 'quest', id: rule.questMinStage.questId, message: `Квест «${rule.questMinStage.questId}» больше не существует.` };
    }
    if (rule.class && this.data.classes && !this.data.classes[rule.class]) {
      return { kind: 'class', id: rule.class, message: `Класс «${rule.class}» больше не существует.` };
    }
    return null;
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
      const flagOpts = '<option value="">— состояние —</option>' + flags.map(f => opt(f, f, rule.flag)).join('');
      const eq = rule.equals !== undefined ? rule.equals : true;
      const eqOpts = opt('true', 'true', eq) + opt('false', 'false', eq);
      return `<span class="cb-field-label">Состояние</span>${sel('flag', rule.flag, flagOpts)}
        <span class="cb-field-label">=</span>${sel('equals', eq, eqOpts)}`;
    }
    if (type === 'notFlag') {
      const flagOpts = '<option value="">—</option>' + flags.map(f => opt(f, f, rule.notFlag)).join('');
      return `<span class="cb-field-label">Выключено</span>${sel('notFlag', rule.notFlag, flagOpts)}`;
    }
    if (type === 'hasItem') {
      const itemOpts = '<option value="">— предмет —</option>' + items.map(id => {
        const name = this.data?.items?.[id]?.name || id;
        return opt(id, name, rule.hasItem);
      }).join('');
      return `<span class="cb-field-label">У игрока есть</span>${sel('hasItem', rule.hasItem, itemOpts)}`;
    }
    if (type === 'notHasItem') {
      const itemOpts = '<option value="">—</option>' + items.map(id => { const name = this.data?.items?.[id]?.name || id; return opt(id, name, rule.notHasItem); }).join('');
      return `<span class="cb-field-label">Нет предмета</span>${sel('notHasItem', rule.notHasItem, itemOpts)}`;
    }
    if (type === 'goldMin') {
      return `<span class="cb-field-label">Золото не меньше</span>
        <input type="number" class="cb-input-num" data-cb-action="update-field" data-rule-index="${ri}" data-field="goldMin"
          value="${rule.goldMin != null ? rule.goldMin : 0}" min="0">`;
    }
    if (type === 'goldMax') {
      return `<span class="cb-field-label">Золото не больше</span>
        <input type="number" class="cb-input-num" data-cb-action="update-field" data-rule-index="${ri}" data-field="goldMax"
          value="${rule.goldMax != null ? rule.goldMax : 100}" min="0">`;
    }
    if (type === 'choiceUsed') {
      return `<span class="cb-field-label">Выбор уже сделан</span>
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
        (this.getQuestIds?.() || []).map(q => {
        const title = this.data?.quests?.[q]?.title || q;
        return opt(q, title, qid);
      }).join('');
      const stageKeys = qid ? (this.getQuestStageKeys?.(qid) || ['0']) : ['0'];
      const stageOpts = stageKeys.map(k => {
        let lab = k;
        if (k === '0' || k === 'start') lab = 'не начат / старт';
        else if (k === 'complete' || k === 'done') lab = 'завершён';
        else lab = 'этап «' + k + '»';
        return opt(k, lab, stg);
      }).join('');
      return `<span class="cb-field-label">Квест</span>
        <select class="cb-select" data-cb-action="update-quest" data-rule-index="${ri}" data-quest-field="questId">${questOpts}</select>
        <span class="cb-field-label">состояние</span>
        <select class="cb-select" data-cb-action="update-quest" data-rule-index="${ri}" data-quest-field="stage">${stageOpts}</select>`;
    }
    if (type === 'questMinStage') {
      const qid = rule.questMinStage?.questId || '';
      const stg = rule.questMinStage?.stage != null ? rule.questMinStage.stage : 0;
      const questOpts = '<option value="">— квест —</option>' +
        (this.getQuestIds?.() || []).map(q => {
          const title = this.data?.quests?.[q]?.title || q;
          return opt(q, title, qid);
        }).join('');
      return `<span class="cb-field-label">Квест</span>
        <select class="cb-select" data-cb-action="update-quest-min" data-rule-index="${ri}" data-quest-field="questId">${questOpts}</select>
        <span class="cb-field-label">не ниже</span>
        <input type="number" class="cb-input-num" data-cb-action="update-quest-min" data-rule-index="${ri}" data-quest-field="stage"
          value="${stg}" min="0">`;
    }
    if (type === 'reputation') {
      const rep = rule.reputation || {};
      const fac = rep.faction || '';
      const op = rep.op || 'gte';
      const val = rep.value != null ? rep.value : 0;
      const facOpts = '<option value="">—</option>' + (this.getFactionIds?.() || []).map(fid => {
        const name = this.data?.reputation?.[fid]?.name || fid;
        return opt(fid, name, fac);
      }).join('');
      const opOpts = [
        { v: 'gte', l: '≥' },
        { v: 'lte', l: '≤' },
        { v: 'eq', l: '=' }
      ].map(o => opt(o.v, o.l, op)).join('');
      return `<span class="cb-field-label">Фракция</span>
        <select class="cb-select" data-cb-action="update-reputation" data-rule-index="${ri}" data-rep-field="faction">${facOpts}</select>
        <select class="cb-select" data-cb-action="update-reputation" data-rule-index="${ri}" data-rep-field="op">${opOpts}</select>
        <input type="number" class="cb-input-num" data-cb-action="update-reputation" data-rule-index="${ri}" data-rep-field="value" value="${val}">`;
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
      else if (field === 'goldMax') rule.goldMax = parseInt(el.value, 10) || 0;
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
    } else if (action === 'update-quest-min') {
      const group = this.ensureConditionOnTarget(target, prop);
      const list = this.getRuleList(group);
      const ri = parseInt(el.dataset.ruleIndex, 10);
      const rule = list[ri];
      if (!rule) return;
      if (!rule.questMinStage) rule.questMinStage = { questId: '', stage: 0 };
      const qf = el.dataset.questField;
      if (qf === 'questId') {
        rule.questMinStage.questId = el.value;
        needsRefresh = true;
      } else if (qf === 'stage') {
        rule.questMinStage.stage = parseInt(el.value, 10) || 0;
      }
      this.persistConditionGroup(target, prop);
    } else if (action === 'update-reputation') {
      const group = this.ensureConditionOnTarget(target, prop);
      const list = this.getRuleList(group);
      const ri = parseInt(el.dataset.ruleIndex, 10);
      const rule = list[ri];
      if (!rule) return;
      if (!rule.reputation) rule.reputation = { faction: '', op: 'gte', value: 0 };
      const rf = el.dataset.repField;
      if (rf === 'value') rule.reputation.value = parseInt(el.value, 10) || 0;
      else rule.reputation[rf] = el.value;
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
      this.syncSkillCheckOnceDoneFlag(idx);
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
    const c = this.data.scenes[this.currentScene]?.choices?.[idx];
    if (!c) return;
    if (!c.skillCheck) c.skillCheck = {};

    if (field === 'dc' || field === 'exp') {
      c.skillCheck[field] = parseInt(value, 10) || 0;
    } else if (field === 'once') {
      c.skillCheck.once = !!value;
      this.syncSkillCheckOnceDoneFlag(idx);
    } else if (field === 'successFlags') {
      try {
        if (!value || value === '{}') delete c.skillCheck.successFlags;
        else c.skillCheck.successFlags = JSON.parse(value);
      } catch (e) {
        Editor.toast.error('JSON: ' + e.message);
        return;
      }
    } else if (field === 'successItems') {
      const arr = String(value).split(',').map((s) => s.trim()).filter(Boolean);
      if (arr.length) c.skillCheck.successItems = arr;
      else delete c.skillCheck.successItems;
    } else if (field === 'doneFlag') {
      if (value) c.skillCheck.doneFlag = value;
      else delete c.skillCheck.doneFlag;
    } else {
      c.skillCheck[field] = value;
    }
    this.updateJSONPreview();
  },

  /** Разбор successFlags в строки конструктора */
  parseFlagsToRows(flags) {
    if (!flags || typeof flags !== 'object' || Array.isArray(flags)) return [];
    return Object.entries(flags).map(([key, val]) => {
      if (typeof val === 'number') {
        return { key: String(key), valueType: 'number', value: val };
      }
      if (typeof val === 'boolean') {
        return { key: String(key), valueType: 'boolean', value: val };
      }
      if (val === 'true' || val === 'false') {
        return { key: String(key), valueType: 'boolean', value: val === 'true' || val === true };
      }
      const num = Number(val);
      if (!Number.isNaN(num) && String(val).trim() !== '') {
        return { key: String(key), valueType: 'number', value: num };
      }
      return { key: String(key), valueType: 'boolean', value: !!val };
    });
  },

  /** Сборка successFlags из строк конструктора */
  buildFlagsFromRows(rows) {
    if (!Array.isArray(rows) || !rows.length) return undefined;
    const out = {};
    rows.forEach((row) => {
      const key = (row.key || '').trim();
      if (!key) return;
      if (row.valueType === 'number') {
        out[key] = Number(row.value);
        if (Number.isNaN(out[key])) out[key] = 0;
      } else {
        out[key] = row.value === true || row.value === 'true';
      }
    });
    return Object.keys(out).length ? out : undefined;
  },

  getSkillCheckDoneFlagAuto(idx) {
    return `sc_${this.currentScene}_${idx}`;
  },

  isSkillCheckAdvanced(idx, sc) {
    if (!this._skillCheckEditorAdvanced) this._skillCheckEditorAdvanced = {};
    const key = `${this.currentScene}_${idx}`;
    if (this._skillCheckEditorAdvanced[key] != null) {
      return !!this._skillCheckEditorAdvanced[key];
    }
    const hasFlags = sc?.successFlags && typeof sc.successFlags === 'object'
      && Object.keys(sc.successFlags).length > 0;
    const hasItems = Array.isArray(sc?.successItems) && sc.successItems.length > 0;
    const manualDone = sc?.doneFlag && sc.doneFlag !== this.getSkillCheckDoneFlagAuto(idx);
    return !!(hasFlags || hasItems || manualDone);
  },

  setSkillCheckAdvancedMode(idx, advanced) {
    if (!this._skillCheckEditorAdvanced) this._skillCheckEditorAdvanced = {};
    this._skillCheckEditorAdvanced[`${this.currentScene}_${idx}`] = !!advanced;
    const c = this.data.scenes[this.currentScene]?.choices?.[idx];
    if (c?.skillCheck && !advanced) {
      this.syncSkillCheckOnceDoneFlag(idx);
    }
    this.renderSceneEditor();
    this.updateJSONPreview();
  },

  syncSkillCheckOnceDoneFlag(idx) {
    const c = this.data.scenes[this.currentScene]?.choices?.[idx];
    if (!c?.skillCheck) return;
    const auto = this.getSkillCheckDoneFlagAuto(idx);
    const onceOn = c.skillCheck.once !== false;
    const simple = !this.isSkillCheckAdvanced(idx, c.skillCheck);
    if (simple && onceOn) {
      c.skillCheck.doneFlag = auto;
    } else if (simple && !onceOn && c.skillCheck.doneFlag === auto) {
      delete c.skillCheck.doneFlag;
    }
  },

  getSkillCheckFlagRows(idx) {
    const sc = this.data.scenes[this.currentScene]?.choices?.[idx]?.skillCheck;
    return this.parseFlagsToRows(sc?.successFlags);
  },

  applySkillCheckFlagRows(idx, rows) {
    const c = this.data.scenes[this.currentScene]?.choices?.[idx];
    if (!c?.skillCheck) return;
    const built = this.buildFlagsFromRows(rows);
    if (built) c.skillCheck.successFlags = built;
    else delete c.skillCheck.successFlags;
    this.updateJSONPreview();
  },

  addSkillCheckFlagRow(idx) {
    const c = this.data.scenes[this.currentScene]?.choices?.[idx];
    if (!c) return;
    if (!c.skillCheck) c.skillCheck = {};
    const rows = this.getSkillCheckFlagRows(idx);
    rows.push({ key: '', valueType: 'boolean', value: true });
    this.applySkillCheckFlagRows(idx, rows);
    this.renderSceneEditor();
  },

  removeSkillCheckFlagRow(idx, rowIndex) {
    const rows = this.getSkillCheckFlagRows(idx);
    rows.splice(rowIndex, 1);
    this.applySkillCheckFlagRows(idx, rows);
    this.renderSceneEditor();
  },

  updateSkillCheckFlagRow(idx, rowIndex, field, value) {
    const rows = this.getSkillCheckFlagRows(idx);
    while (rows.length <= rowIndex) {
      rows.push({ key: '', valueType: 'boolean', value: true });
    }
    const row = rows[rowIndex];
    if (field === 'valueType') {
      row.valueType = value === 'number' ? 'number' : 'boolean';
      row.value = row.valueType === 'number' ? (Number(row.value) || 0) : true;
    } else if (field === 'value') {
      if (row.valueType === 'number') row.value = parseInt(value, 10) || 0;
      else row.value = value === true || value === 'true';
    } else if (field === 'key') {
      row.key = value;
    }
    this.applySkillCheckFlagRows(idx, rows);
  },

  renderSkillCheckFlagRow(idx, row, rowIndex) {
    const vt = row.valueType === 'number' ? 'number' : 'boolean';
    const typeOpts = [
      ['boolean', 'Да / Нет'],
      ['number', 'Число']
    ].map(([v, lab]) =>
      `<option value="${v}" ${vt === v ? 'selected' : ''}>${lab}</option>`
    ).join('');
    const valueControl = vt === 'number'
      ? `<input type="number" class="cb-input-num" value="${Number(row.value) || 0}"
          onchange="Editor.updateSkillCheckFlagRow(${idx},${rowIndex},'value',this.value)">`
      : `<select class="cb-select" onchange="Editor.updateSkillCheckFlagRow(${idx},${rowIndex},'value',this.value)">
          <option value="true" ${row.value === true || row.value === 'true' ? 'selected' : ''}>true (да)</option>
          <option value="false" ${row.value === false || row.value === 'false' ? 'selected' : ''}>false (нет)</option>
        </select>`;
    return `<div class="sc-flag-row flex-row">
      <input type="text" class="cb-input-text" placeholder="doorBroken" value="${this.escapeAttr(row.key || '')}"
        onchange="Editor.updateSkillCheckFlagRow(${idx},${rowIndex},'key',this.value)">
      <span class="cb-field-label">=</span>
      <select class="cb-select" onchange="Editor.updateSkillCheckFlagRow(${idx},${rowIndex},'valueType',this.value)">${typeOpts}</select>
      ${valueControl}
      <button type="button" class="btn-remove" title="Удалить флаг"
        onclick="Editor.removeSkillCheckFlagRow(${idx},${rowIndex})">×</button>
    </div>`;
  },

  renderSkillCheckFlagBuilder(idx, sc) {
    const rows = this.parseFlagsToRows(sc.successFlags);
    const rowsHtml = rows.length
      ? rows.map((row, ri) => this.renderSkillCheckFlagRow(idx, row, ri)).join('')
      : '<p class="hint sc-flag-empty">Нет флагов — нажмите «+ Добавить флаг», чтобы задать условие при успехе.</p>';
    return `<div class="form-group sc-flags-builder">
      <label>Флаги при успехе</label>
      <p class="hint">Каждая строка — один флаг в игре: имя и значение (да/нет или число).</p>
      <div class="sc-flag-rows">${rowsHtml}</div>
      <button type="button" class="btn btn-secondary" style="margin-top:8px;"
        onclick="Editor.addSkillCheckFlagRow(${idx})">+ Добавить флаг</button>
    </div>`;
  },

  renderSkillCheckEditor(idx, c, allScenes) {
    const sc = c.skillCheck || {};
    const advanced = this.isSkillCheckAdvanced(idx, sc);
    const doneAuto = this.getSkillCheckDoneFlagAuto(idx);
    const onceOn = sc.once !== false;
    const skillOpts = this.SKILL_LIST.map((s) => {
      const lab = this.SKILL_LABELS[s] || s;
      return `<option value="${s}" ${sc.skill === s ? 'selected' : ''}>${this.escapeHtml(lab)}</option>`;
    }).join('');

    const successListId = this.allocSmartIdList(`sc-success-${idx}`);
    const failListId = this.allocSmartIdList(`sc-fail-${idx}`);

    let advancedBlock = '';
    if (advanced) {
      advancedBlock = `
        ${this.renderSkillCheckFlagBuilder(idx, sc)}
        <div class="form-group">
          <label>Предметы при успехе</label>
          <input type="text" value="${this.escapeAttr((sc.successItems || []).join(', '))}"
            placeholder="healing_potion, old_key"
            onchange="Editor.updateSkillCheck(${idx},'successItems',this.value)">
          <p class="hint">Введите ID предметов через запятую, например: healing_potion, old_key</p>
        </div>
        <div class="form-group">
          <label>doneFlag (флаг «уже использовано»)</label>
          <input type="text" value="${this.escapeAttr(sc.doneFlag || '')}" placeholder="${this.escapeAttr(doneAuto)}"
            onchange="Editor.updateSkillCheck(${idx},'doneFlag',this.value)">
          <p class="hint">Оставьте пустым для авто: <code>${this.escapeHtml(doneAuto)}</code></p>
        </div>`;
    } else {
      advancedBlock = `<p class="hint sc-simple-hint">В простом режиме дополнительные флаги и предметы скрыты.${
        onceOn
          ? ` При «Один раз» автоматически: <code>${this.escapeHtml(doneAuto)}</code>`
          : ' Включите «Один раз», чтобы выбор нельзя было повторить.'
      }</p>`;
    }

    return `<div class="skillcheck-block">
      <div class="form-group sc-mode-toggle writer-advanced-only">
        <label>
          <input type="checkbox" ${advanced ? 'checked' : ''}
            onchange="Editor.setSkillCheckAdvancedMode(${idx}, this.checked)">
          Расширенный режим
        </label>
        <span class="hint">${advanced
          ? 'Доступны флаги при успехе, предметы и ручной doneFlag.'
          : 'Только навык, DC, тексты и переходы — без JSON.'}</span>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>Навык</label>
          <select onchange="Editor.updateSkillCheck(${idx},'skill',this.value)">${skillOpts}</select>
        </div>
        <div class="form-group">
          <label>Сложность (DC)</label>
          <input type="number" min="1" max="30" value="${sc.dc ?? 13}"
            onchange="Editor.updateSkillCheck(${idx},'dc',this.value)">
        </div>
      </div>
      <div class="form-group">
        <label><input type="checkbox" ${onceOn ? 'checked' : ''}
          onchange="Editor.updateSkillCheck(${idx},'once',this.checked)"> Один раз (нельзя повторить проверку)</label>
      </div>
      <div class="form-group">
        <label>Текст при успехе</label>
        <textarea rows="2" onchange="Editor.updateSkillCheck(${idx},'successText',this.value)">${this.escapeTextarea(sc.successText || '')}</textarea>
      </div>
      <div class="form-group">
        <label>Текст при провале</label>
        <textarea rows="2" onchange="Editor.updateSkillCheck(${idx},'failText',this.value)">${this.escapeTextarea(sc.failText || '')}</textarea>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>Успех → сцена</label>
          ${this.renderSceneIdField(sc.successNext || c.to || '', successListId, `Editor.updateSkillCheck(${idx},'successNext',this.value)`, { placeholder: 'сцена при успехе' })}
          <p class="hint">Начните вводить id или название локации.</p>
        </div>
        <div class="form-group">
          <label>Провал → сцена</label>
          ${this.renderSceneIdField(sc.failNext || c.to || '', failListId, `Editor.updateSkillCheck(${idx},'failNext',this.value)`, { placeholder: 'сцена при провале' })}
        </div>
      </div>
      ${advancedBlock}
    </div>`;
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
      const toListId = this.allocSmartIdList(`ch-to-${idx}`);
      html += `<div class="form-group"><label>Сцена (переход)</label>
        ${this.renderSceneIdField(c.to || '', toListId, `Editor.updateChoice(${idx},'to',this.value)`, { placeholder: 'id целевой сцены' })}
        <p class="hint writer-advanced-only">Подсказка: id и локация сцены. Можно ввести новый id вручную.</p></div>`;
    }
    if (actionType === 'action') {
      html += `<div class="form-group writer-advanced-only"><label>action</label><input value="${this.escapeHtml(c.action||'')}" onchange="Editor.updateChoice(${idx},'action',this.value)"></div>`;
    }
    if (actionType === 'skillCheck') html += this.renderSkillCheckEditor(idx, c, allScenes);

    html += `<div class="form-group writer-advanced-only"><label>doneFlag (один раз)</label>
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
    this.ensurePreviewStateInitialized();
    const ps = this.previewState;
    return {
      level: ps.level ?? 1,
      className: ps.className || '',
      inventory: [...(ps.inventory || [])],
      gold: ps.gold ?? 0,
      flags: { ...ps.flags },
      questStages: { ...(ps.questStages || {}) },
      quests: this.data?.quests || {}
    };
  },

  updatePreviewState(field, value) {
    this.ensurePreviewStateInitialized();
    const ps = this.previewState;

    if (field.startsWith('flagToggle:')) {
      const name = field.slice(11);
      const checked = value === true || value === 'true';
      const isNumeric = typeof ps.flags[name] === 'number' || String(name).startsWith('rep_');
      if (isNumeric) {
        ps.flags[name] = checked ? (Number(ps.flags[name]) || 10) : 0;
        if (checked && !ps.flags[name]) ps.flags[name] = 10;
      } else {
        ps.flags[name] = checked;
      }
    } else if (field.startsWith('flag:')) {
      const name = field.slice(5);
      const isNumeric = typeof ps.flags[name] === 'number' || String(name).startsWith('rep_');
      if (isNumeric) {
        ps.flags[name] = parseInt(value, 10) || 0;
      } else {
        ps.flags[name] = value === true || value === 'true';
      }
    } else if (field.startsWith('questStage:')) {
      const questId = field.slice(11);
      if (!value) delete ps.questStages[questId];
      else ps.questStages[questId] = String(value);
    } else if (field === 'inventory') {
      ps.inventory = String(value).split(',').map((s) => s.trim()).filter(Boolean);
    } else if (field === 'gold') {
      ps.gold = parseInt(value, 10) || 0;
    } else if (field === 'className') {
      ps.className = String(value);
    } else if (field === 'level') {
      const lv = Math.min(10, Math.max(1, parseInt(value, 10) || 1));
      ps.level = lv;
      const numEl = document.getElementById('god-mode-level-num');
      const rangeEl = document.getElementById('god-mode-level-range');
      if (numEl && document.activeElement !== numEl) numEl.value = String(lv);
      if (rangeEl && document.activeElement !== rangeEl) rangeEl.value = String(lv);
    }

    this.updateChoicePreview();
  },

  updatePreviewField(field, value) {
    this.updatePreviewState(field, value);
  },

  ensurePreviewStateInitialized() {
    if (!this.previewState) {
      this.previewState = {
        level: 1,
        className: '',
        inventory: [],
        gold: 0,
        flags: {},
        questStages: {}
      };
    }
    if (this.previewState.level == null) this.previewState.level = 1;
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
    this.updatePreviewState(`flagToggle:${flag}`, !this.isPreviewFlagOn(cur));
  },

  togglePreviewItem(itemId) {
    this.ensurePreviewStateInitialized();
    const inv = this.previewState.inventory;
    const i = inv.indexOf(itemId);
    if (i >= 0) inv.splice(i, 1);
    else inv.push(itemId);
    this.updatePreviewState('inventory', inv.join(', '));
  },

  updateChoicePreview() {
    const el = document.getElementById('choice-preview-panel');
    if (!el || !this.currentScene || !this.data?.scenes) return;
    const scene = this.data.scenes[this.currentScene];
    const ctx = this.getPreviewContext();
    el.innerHTML = (scene.choices || []).map((c, i) => {
      const result = typeof ConditionSystem.explainChoiceVisibility === 'function'
        ? ConditionSystem.explainChoiceVisibility(c, ctx)
        : { visible: ConditionSystem.isChoiceVisible(c, ctx), reason: '' };
      const visible = result.visible;
      const uf = c.doneFlag || (c.skillCheck ? `sc_${this.currentScene}_${i}` : null);
      const used = uf && ctx.flags[uf];
      const cls = visible ? (used ? 'preview-visible used' : 'preview-visible') : 'preview-hidden';
      const reason = result.reason || '';
      const titleAttr = !visible && reason ? ` title="${this.escapeAttr(reason)}"` : '';
      const hintIcon = !visible && reason
        ? `<span class="condition-reason-tooltip" title="${this.escapeAttr(reason)}" aria-label="Причина скрытия">❓</span>`
        : '';
      return `<div class="preview-choice ${cls}"${titleAttr}>${visible ? '✅' : '⛔'} ${this.escapeHtml(c.text || '(без текста)')}${c.skillCheck ? ' [проверка]' : ''}${used ? ' ✓' : ''}${hintIcon}</div>`;
    }).join('') || '<div class="hint">Нет выборов</div>';
    if (Editor.updateLiveScenePreview) Editor.updateLiveScenePreview();
  },

  getPreviewStateSnapshot() {
    this.ensurePreviewStateInitialized();
    return {
      level: this.previewState.level ?? 1,
      className: this.previewState.className || '',
      inventory: [...(this.previewState.inventory || [])],
      gold: this.previewState.gold ?? 0,
      flags: { ...this.previewState.flags },
      questStages: { ...(this.previewState.questStages || {}) }
    };
  },

  applyPreviewStateSnapshot(snap) {
    if (!snap || typeof snap !== 'object') return false;
    this.ensurePreviewStateInitialized();
    if (snap.level != null) {
      this.previewState.level = Math.min(10, Math.max(1, parseInt(snap.level, 10) || 1));
    }
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
      Editor.toast.success('Состояние скопировано в буфер обмена.');
    } catch (e) {
      await Editor.promptDialog({ message: 'Скопируйте JSON:', defaultValue: json });
    }
  },

  async pastePreviewState() {
    let raw = '';
    try {
      raw = await navigator.clipboard.readText();
    } catch (e) {
      raw = (await Editor.promptDialog({ message: 'Вставьте JSON состояния:' })) || '';
    }
    if (!raw.trim()) return;
    try {
      const snap = JSON.parse(raw);
      if (!this.applyPreviewStateSnapshot(snap)) {
        Editor.toast.error('Некорректный формат JSON.');
        return;
      }
      this.updateChoicePreview();
      if (this.currentScene) this.renderSceneEditor();
    } catch (err) {
      Editor.toast.error('Ошибка разбора JSON: ' + err.message);
    }
  },

  resetPreviewState() {
    this.resetPreviewToGameStart();
  },

  /** Сброс God Mode к startingFlags и базовым значениям (не трогает this.data) */
  resetPreviewToGameStart() {
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
      const starting = this.data?.startingFlags || {};
      catalog.forEach((name) => {
        const start = starting[name];
        if (typeof start === 'number' || String(name).startsWith('rep_')) {
          this.previewState.flags[name] = typeof start === 'number' ? start : 0;
        } else if (start === true || start === false) {
          this.previewState.flags[name] = start;
        } else if (start !== undefined) {
          this.previewState.flags[name] = start;
        } else {
          this.previewState.flags[name] = false;
        }
      });
      Object.keys(starting).forEach((name) => {
        if (this.previewState.flags[name] === undefined) {
          this.previewState.flags[name] = starting[name];
        }
      });
      this.previewState.level = 1;
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

  renderPreviewFlagControl(name, val) {
    const isNumeric = typeof val === 'number' || String(name).startsWith('rep_');
    if (isNumeric) {
      const n = Number(val) || 0;
      const on = n !== 0;
      return `<div class="god-mode-flag-row god-mode-flag-row--numeric">
        <label class="god-mode-flag-check">
          <input type="checkbox" ${on ? 'checked' : ''}
            onchange="Editor.updatePreviewState('flagToggle:${this.escapeAttr(name)}', this.checked)">
          <span>${this.escapeHtml(name)}</span>
        </label>
        <input type="number" class="god-mode-flag-num" value="${n}" title="Числовое значение"
          oninput="Editor.updatePreviewState('flag:${this.escapeAttr(name)}', this.value)"
          onchange="Editor.updatePreviewState('flag:${this.escapeAttr(name)}', this.value)">
      </div>`;
    }
    const on = this.isPreviewFlagOn(val);
    return `<label class="god-mode-flag-row god-mode-flag-check">
      <input type="checkbox" ${on ? 'checked' : ''}
        onchange="Editor.updatePreviewState('flag:${this.escapeAttr(name)}', this.checked)">
      <span>${this.escapeHtml(name)}</span>
    </label>`;
  },

  renderPreviewFlagsList() {
    let flags = [...this.getFlagCatalog()].sort((a, b) => a.localeCompare(b, 'ru'));
    if (typeof StoryMemory !== 'undefined' && typeof this.isWriterMode === 'function' && this.isWriterMode()) {
      flags = StoryMemory.filterAuthorFlagCatalog(flags);
    }
    const ps = this.previewState;
    if (!flags.length) {
      return '<p class="hint">Нет флагов в проекте — добавьте флаги на сценах или в startingFlags.</p>';
    }
    return `<div class="god-mode-flags-list">${flags.map((f) => this.renderPreviewFlagControl(f, ps.flags[f])).join('')}</div>`;
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
        <select onchange="Editor.updatePreviewState('questStage:${this.escapeAttr(qid)}', this.value)" style="width:100%;padding:8px;border:2px solid var(--border);border-radius:6px;">
          <option value="">— не начат —</option>${opts}
        </select>
      </div>`;
    }).join('');
  },

  renderTestStatePanel() {
    this.ensurePreviewStateInitialized();
    const classes = Object.keys(this.data?.classes || {});
    const ps = this.previewState;
    const level = Math.min(10, Math.max(1, ps.level ?? 1));
    const invText = (ps.inventory || []).join(', ');

    return `<div class="preview-panel god-mode-panel" style="margin-top:16px;">
      <h4>🎮 God Mode</h4>
      <p class="hint">Тестовое состояние героя для отладки showIf/hideIf. Изменения только в <code>previewState</code>, проект не затрагивается.</p>
      <div class="god-mode-toolbar">
        <button type="button" class="btn btn-secondary" onclick="Editor.copyPreviewState()">📋 Скопировать</button>
        <button type="button" class="btn btn-secondary" onclick="Editor.pastePreviewState()">📥 Вставить</button>
        <button type="button" class="btn btn-secondary" onclick="Editor.resetPreviewToGameStart()">↺ Сбросить к начальной игре</button>
        <select class="btn btn-secondary god-mode-preset-select" onchange="Editor.applyPreviewPreset(this.value); this.value='';">
          <option value="">⚡ Пресет…</option>
          <option value="gameStart">Начало игры</option>
          <option value="allQuests">Все квесты выполнены</option>
          <option value="richHero">Богатый герой</option>
        </select>
      </div>
      <div class="god-mode-level-block">
        <label>Уровень персонажа: <strong id="god-mode-level-label">${level}</strong></label>
        <div class="god-mode-level-inputs">
          <input type="range" id="god-mode-level-range" min="1" max="10" step="1" value="${level}"
            oninput="Editor.updatePreviewState('level', this.value); document.getElementById('god-mode-level-label').textContent=this.value;">
          <input type="number" id="god-mode-level-num" class="god-mode-level-num" min="1" max="10" value="${level}"
            oninput="Editor.updatePreviewState('level', this.value); document.getElementById('god-mode-level-label').textContent=this.value;">
        </div>
      </div>
      <div class="grid-2 god-mode-stats">
        <div class="form-group">
          <label>Золото</label>
          <input type="text" class="god-mode-input" value="${ps.gold ?? 0}" placeholder="0"
            oninput="Editor.updatePreviewState('gold', this.value)"
            onchange="Editor.updatePreviewState('gold', this.value)">
        </div>
        <div class="form-group">
          <label>Класс</label>
          <select class="god-mode-input" onchange="Editor.updatePreviewState('className', this.value)">
            <option value="">—</option>
            ${classes.map((cid) => `<option value="${this.escapeAttr(cid)}" ${ps.className === cid ? 'selected' : ''}>${this.escapeHtml(cid)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Инвентарь (ID через запятую)</label>
        <input type="text" class="god-mode-input" value="${this.escapeAttr(invText)}" placeholder="healing_potion, old_key"
          oninput="Editor.updatePreviewState('inventory', this.value)"
          onchange="Editor.updatePreviewState('inventory', this.value)">
      </div>
      <div class="form-group">
        <label>Флаги проекта</label>
        ${this.renderPreviewFlagsList()}
      </div>
      <div class="form-group">
        <label>Стадии квестов</label>
        ${this.renderTestStateQuestSelects()}
      </div>
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
    this.updatePreviewState(`questStage:${questId}`, stage);
  }
});

  if (Editor.hooks?.after) {
    Editor.hooks.after('renderSceneEditor', function () {
      if (typeof Editor.initSmartTextareas === 'function') {
        Editor.initSmartTextareas(document.getElementById('scene-editor'));
      }
    });
  }
})();
