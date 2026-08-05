// Подключение NL Condition Builder к Editor.renderConditionBuilder

(function attachNlConditionBridge() {
  if (typeof Editor === 'undefined' || typeof NLConditionBuilder === 'undefined') {
    console.warn('editor-nl-condition-bridge: Editor или NLConditionBuilder не загружен');
    return;
  }

  const LEAD_BY_PROP = {
    showIf: 'Показать выбор, если',
    requires: 'Показать выбор, если',
    hideIf: 'Скрыть выбор, если',
    condition: 'Показать, если',
    if: 'Показать, если',
    when: 'Показать, если'
  };

  const origRenderRuleFields = Editor.renderRuleFields.bind(Editor);
  const origRenderRuleRow = Editor.renderRuleRow.bind(Editor);
  const origRenderConditionBuilder = Editor.renderConditionBuilder.bind(Editor);
  const origEnsureConditionBuilderEvents = Editor.ensureConditionBuilderEvents.bind(Editor);

  Editor.renderConditionBuilder = function (targetObject, path, callback, options) {
    const propKey = Array.isArray(path) ? path[path.length - 1] : path;
    this._nlLeadText = LEAD_BY_PROP[propKey] || NLConditionBuilder.DEFAULT_LEAD;
    return origRenderConditionBuilder(targetObject, path, callback, options);
  };

  Editor.renderRuleRow = function (rule, ruleIndex, builderId) {
    const type = this.inferRuleType(rule);
    const html = origRenderRuleRow(rule, ruleIndex, builderId);
    if (type === 'flag' || type === 'notFlag') {
      return html.replace('cb-rule-row flex-row', 'cb-rule-row cb-rule-row--nl flex-row');
    }
    return html;
  };

  Editor.renderRuleFields = function (rule, ruleIndex) {
    const type = this.inferRuleType(rule);
    if (type === 'flag' || type === 'notFlag') {
      const catalog = NLConditionBuilder.getFlagCatalog(this.data, this.getFlagCatalog());
      return NLConditionBuilder.renderFieldsHtml({
        rule,
        ruleIndex,
        catalog,
        gameData: this.data,
        leadText: this._nlLeadText
      });
    }
    return origRenderRuleFields(rule, ruleIndex);
  };

  function updateNlJsonPreview(row, rule, gameData) {
    const preview = row?.querySelector('[data-nl-preview]');
    if (!preview) return;
    const json = rule
      ? JSON.stringify(NLConditionBuilder.toEngineRule(NLConditionBuilder.parseRule(rule, gameData)))
      : NLConditionBuilder.formatOutputPreview(NLConditionBuilder.readStateFromRow(row, gameData));
    preview.textContent = json;
    const idSpan = row.closest('.nl-condition')?.querySelector('.nl-condition-id');
    if (idSpan) idSpan.textContent = rule?.flag || rule?.notFlag || '';
  }

  function syncNlValueVisibility(row, gameData) {
    const state = NLConditionBuilder.readStateFromRow(row, gameData);
    const valueToken = row.querySelector('.nl-token--value');
    if (!valueToken) return;
    if (state.kind === 'number') {
      valueToken.classList.remove('nl-token--hidden');
      if (!valueToken.querySelector('[data-nl-action="value"]')) {
        const ri = row.dataset.ruleIndex || row.querySelector('[data-nl-action="object"]')?.dataset.ruleIndex;
        valueToken.innerHTML = NLConditionBuilder.renderValueControl({ ...state, ruleIndex: ri });
      }
    } else {
      valueToken.classList.add('nl-token--hidden');
      valueToken.innerHTML = '';
    }
  }

  function syncNlOperatorOptions(row, gameData) {
    const state = NLConditionBuilder.readStateFromRow(row, gameData);
    const opSel = row.querySelector('[data-nl-action="operator"]');
    if (!opSel) return;
    const cur = state.op;
    opSel.innerHTML = NLConditionBuilder.renderOperatorOptions(state.kind, cur);
    if (![...opSel.options].some((o) => o.value === cur)) {
      opSel.value = state.kind === 'number' ? 'gt' : 'active';
    }
  }

  /**
   * Мгновенно синхронизирует rule, inline JSON-превью и общий JSON редактора.
   * Вызывается из onchange/oninput в предложении и из делегирования событий.
   */
  Editor.handleNlConditionChange = function (nlEl) {
    const root = nlEl.closest('.condition-builder');
    if (!root) return;
    const builderId = root.dataset.builderId;
    const ctx = this._conditionBuilders?.get(builderId);
    if (!ctx) return;

    const row = nlEl.closest('.cb-rule-row');
    if (!row) return;

    const target = ctx.getTarget();
    if (!target) return;
    const prop = ctx.propertyKey;
    const group = this.ensureConditionOnTarget(target, prop);
    const list = this.getRuleList(group);
    const ri = parseInt(nlEl.dataset.ruleIndex ?? row.dataset.ruleIndex, 10);
    const rule = list[ri];
    if (!rule) return;

    let needsRefresh = false;
    const prevKind = NLConditionBuilder.inferFlagType(rule.flag || rule.notFlag, this.data);

    if (nlEl.dataset.nlAction === 'object') {
      const opt = nlEl.selectedOptions[0];
      const newType = opt?.dataset?.flagType || NLConditionBuilder.inferFlagType(nlEl.value, this.data);
      const state = {
        flag: nlEl.value,
        kind: newType,
        op: newType === 'number' ? 'gt' : 'active',
        value: newType === 'number' ? 10 : true
      };
      NLConditionBuilder.applyStateToRule(rule, state);
      needsRefresh = newType !== prevKind;
      if (!needsRefresh) {
        syncNlOperatorOptions(row, this.data);
        syncNlValueVisibility(row, this.data);
      }
    } else {
      const hadNotFlag = !!rule.notFlag;
      const state = NLConditionBuilder.readStateFromRow(row, this.data);
      if (nlEl.dataset.nlAction === 'operator') state.op = nlEl.value;
      if (nlEl.dataset.nlAction === 'value') {
        state.value = Number(nlEl.value);
        if (Number.isNaN(state.value)) state.value = 0;
      }
      NLConditionBuilder.applyStateToRule(rule, state);
      if (nlEl.dataset.nlAction === 'operator' && !!rule.notFlag !== hadNotFlag) needsRefresh = true;
    }

    updateNlJsonPreview(row, rule, this.data);
    this.persistConditionGroup(target, prop);
    if (typeof this.updateJSONPreview === 'function') this.updateJSONPreview();
    if (ctx.onChange) ctx.onChange();

    if (needsRefresh) {
      this.refreshConditionBuilder(builderId);
    }
  };

  NLConditionBuilder._fieldChangeHandler = function (el) {
    Editor.handleNlConditionChange(el);
  };

  Editor.ensureConditionBuilderEvents = function () {
    origEnsureConditionBuilderEvents.call(this);
    if (this._nlInputBound) return;
    this._nlInputBound = true;
    document.addEventListener('input', (e) => {
      if (e.target.matches?.('[data-nl-action="value"]')) {
        Editor.handleNlConditionChange(e.target);
      }
    });
  };

  /* NL-поля обновляются через onchange/oninput в разметке (handleNlConditionChange) */
})();
