// ============================================
// Условия показа выборов (флаги, инвентарь, золото, класс)
// Используется в engine.js и editor.html
// ============================================

const ConditionSystem = {
  /** Модификатор характеристики D&D 5e (делегирует GameEngine при наличии) */
  getModifier(score) {
    if (typeof GameEngine !== 'undefined' && typeof GameEngine.getModifier === 'function') {
      return GameEngine.getModifier(score);
    }
    return Math.floor((Number(score) - 10) / 2);
  },
  /** Плоский requires → { all: [...] } */
  normalize(conditions) {
    if (!conditions || typeof conditions !== 'object') return null;
    if (Array.isArray(conditions.all) || Array.isArray(conditions.any)) return conditions;

    const rules = [];
    const c = conditions;
    if (c.flag != null && c.flag !== '') {
      const rule = { flag: c.flag };
      if (c.min != null) rule.min = c.min;
      if (c.max != null) rule.max = c.max;
      if (rule.min == null && rule.max == null) {
        rule.equals = c.equals !== undefined ? c.equals : (c.value !== undefined ? c.value : true);
      }
      rules.push(rule);
    }
    if (c.notFlag) rules.push({ flag: c.notFlag, equals: false });
    if (c.hasItem) rules.push({ hasItem: c.hasItem });
    if (c.notHasItem) rules.push({ notHasItem: c.notHasItem });
    if (c.goldMin != null) rules.push({ goldMin: c.goldMin });
    if (c.goldMax != null) rules.push({ goldMax: c.goldMax });
    if (c.class) rules.push({ class: c.class });
    if (c.choiceUsed) rules.push({ choiceUsed: c.choiceUsed });
    if (c.choiceNotUsed) rules.push({ choiceNotUsed: c.choiceNotUsed });
    if (c.questStage && typeof c.questStage === 'object') rules.push({ questStage: c.questStage });
    if (c.questMinStage != null) rules.push({ questMinStage: c.questMinStage });
    if (c.reputation && typeof c.reputation === 'object') rules.push({ reputation: c.reputation });

    if (!rules.length) return null;
    return { all: rules };
  },

  parseEquals(raw) {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (raw === '' || raw == null) return true;
    const n = Number(raw);
    if (!Number.isNaN(n) && String(n) === String(raw).trim()) return n;
    return raw;
  },

  /** Правило-лист или вложенный блок { all } / { any } */
  evaluateConditionNode(rule, ctx) {
    if (!rule || typeof rule !== 'object') return true;
    if (Array.isArray(rule.all) || Array.isArray(rule.any)) {
      return this.evaluate(rule, ctx);
    }
    return this.evaluateRule(rule, ctx);
  },

  /** Объяснение провала одного узла (без повторного normalize листа) */
  explainConditionNode(rule, ctx) {
    if (!rule || typeof rule !== 'object') {
      return 'неизвестное правило';
    }
    if (Array.isArray(rule.all) || Array.isArray(rule.any)) {
      return this.explainConditionsFailure(rule, ctx);
    }
    return this.explainRuleFailure(rule, ctx);
  },

  /** Значение флага или переменной проекта (флаг имеет приоритет). */
  resolveFlagOrVariable(name, ctx) {
    if (typeof RuntimeVariables !== 'undefined' && RuntimeVariables.resolveValue) {
      return RuntimeVariables.resolveValue(name, ctx);
    }
    return (ctx?.flags || {})[name];
  },

  evaluateRule(rule, ctx) {
    if (!rule || typeof rule !== 'object') return true;
    const flags = ctx.flags || {};
    const inventory = ctx.inventory || [];

    if (rule.flag != null && rule.flag !== '') {
      const val = this.resolveFlagOrVariable(rule.flag, ctx);
      if (rule.min != null || rule.max != null) {
        const n = Number(val);
        if (Number.isNaN(n)) return false;
        if (rule.min != null && n < Number(rule.min)) return false;
        if (rule.max != null && n > Number(rule.max)) return false;
        return true;
      }
      const eq = rule.equals !== undefined ? rule.equals : true;
      if (typeof eq === 'boolean') return !!val === eq;
      return val == eq;
    }
    if (rule.notFlag) return !this.resolveFlagOrVariable(rule.notFlag, ctx);
    if (rule.hasItem) return inventory.includes(rule.hasItem);
    if (rule.notHasItem) return !inventory.includes(rule.notHasItem);
    if (rule.goldMin != null) return (ctx.gold ?? 0) >= rule.goldMin;
    if (rule.goldMax != null) return (ctx.gold ?? 0) <= rule.goldMax;
    if (rule.class) return (ctx.className || '') === rule.class;
    if (rule.choiceUsed) return !!flags[rule.choiceUsed];
    if (rule.choiceNotUsed) return !flags[rule.choiceNotUsed];
    if (rule.questStage) {
      const qs = rule.questStage;
      const questId = qs.questId || qs.quest;
      const want = qs.stage != null ? String(qs.stage) : '';
      const current = this.getQuestStageFromCtx(ctx, questId);
      if (current == null) return false;
      return String(current) === want;
    }
    if (rule.questMinStage) {
      const qm = rule.questMinStage;
      const questId = qm.questId || qm.quest;
      const min = Number(qm.stage);
      const current = this.getQuestStageFromCtx(ctx, questId);
      if (current == null) return false;
      return Number(current) >= min;
    }
    if (rule.reputation && typeof ReputationSystem !== 'undefined') {
      return ReputationSystem.evaluateReputationRule(rule, flags);
    }
    if (rule.reputation?.faction) {
      const cur = Number(flags[rule.reputation.faction]) || 0;
      const val = Number(rule.reputation.value);
      const op = rule.reputation.op || 'gte';
      if (op === 'gte' || op === '>=') return cur >= val;
      if (op === 'lte' || op === '<=') return cur <= val;
      if (op === 'eq') return cur === val;
      return cur >= val;
    }
    return true;
  },

  /**
   * Текущая стадия квеста. Source of truth: QuestRuntime.questProgress.
   * questStages / flags.quest_* — только fallback до hydrate.
   */
  getQuestStageFromCtx(ctx, questId) {
    if (!questId) return null;
    if (typeof QuestRuntime !== 'undefined') {
      if (ctx.engine) QuestRuntime.bind(ctx.engine);
      const key = QuestRuntime.getStageKey(questId);
      if (key != null && key !== '') return String(key);
    }
    // Legacy fallback (pre-hydrate saves / contexts without engine)
    const progress = ctx.questProgress?.[questId];
    if (progress) {
      if (progress.status === 'completed') return '__finished__';
      if (progress.status === 'failed') return '__failed__';
      if (progress.stageIndex != null) return String(progress.stageIndex);
    }
    const stages = ctx.questStages || {};
    if (stages[questId] != null && stages[questId] !== '') return String(stages[questId]);
    const legacy = ctx.flags?.['quest_' + questId];
    if (legacy == null || legacy === '') return null;
    if (typeof QuestRuntime !== 'undefined' && ctx.quests?.[questId]) {
      return QuestRuntime.resolveStageRef(ctx.quests[questId], legacy);
    }
    return String(legacy);
  },

  isQuestActiveFromCtx(ctx, questId) {
    if (!questId) return false;
    if (typeof QuestRuntime !== 'undefined') {
      if (ctx.engine) QuestRuntime.bind(ctx.engine);
      if (QuestRuntime.isActive(questId)) return true;
      if (QuestRuntime.isCompleted(questId) || QuestRuntime.isFailed(questId)) return false;
    }
    const p = ctx.questProgress?.[questId];
    if (p) return p.status === 'active';
    const s = this.getQuestStageFromCtx(ctx, questId);
    return s != null && s !== '__finished__' && s !== '__failed__' && s !== 'complete' && s !== 'failed';
  },

  isQuestFinishedFromCtx(ctx, questId) {
    if (!questId) return false;
    if (typeof QuestRuntime !== 'undefined') {
      if (ctx.engine) QuestRuntime.bind(ctx.engine);
      if (QuestRuntime.isCompleted(questId)) return true;
    }
    const p = ctx.questProgress?.[questId];
    if (p?.status === 'completed') return true;
    const s = this.getQuestStageFromCtx(ctx, questId);
    return s === '__finished__' || s === 'complete';
  },

  evaluate(conditions, ctx) {
    if (!conditions) return true;
    const norm = this.normalize(conditions);
    if (!norm) return true;
    if (Array.isArray(norm.all)) {
      return norm.all.length === 0 || norm.all.every((r) => this.evaluateConditionNode(r, ctx));
    }
    if (Array.isArray(norm.any)) {
      return norm.any.length === 0 || norm.any.some((r) => this.evaluateConditionNode(r, ctx));
    }
    return true;
  },

  /** Условие элемента states[] (приоритет: condition → if → when → showIf → requires) */
  getSceneStateCondition(stateEntry) {
    if (!stateEntry || typeof stateEntry !== 'object') return null;
    return (
      stateEntry.condition
      ?? stateEntry.if
      ?? stateEntry.when
      ?? stateEntry.showIf
      ?? stateEntry.requires
      ?? null
    );
  },

  /** Проверка условия против контекста игры: ConditionSystem.check(ctx, condition) */
  check(ctx, condition) {
    if (!condition) return true;
    if (!ctx || typeof ctx !== 'object') return true;
    return this.evaluate(condition, ctx);
  },

  /** Истинно ли состояние локации для текущего контекста */
  matchesSceneState(stateEntry, ctx) {
    const cond = this.getSceneStateCondition(stateEntry);
    if (!cond) return true;
    return this.check(ctx, cond);
  },

  /** Человекочитаемая причина, почему одно правило не выполнилось */
  explainRuleFailure(rule, ctx) {
    if (!rule || typeof rule !== 'object') return 'неизвестное правило';
    const flags = ctx.flags || {};
    const inventory = ctx.inventory || [];

    if (rule.flag != null && rule.flag !== '') {
      const val = this.resolveFlagOrVariable(rule.flag, ctx);
      if (rule.min != null || rule.max != null) {
        const n = Number(val);
        if (Number.isNaN(n)) {
          return `флаг «${rule.flag}» не задан или не число (нужно от ${rule.min ?? '—'} до ${rule.max ?? '—'})`;
        }
        if (rule.min != null && n < Number(rule.min)) {
          return `флаг «${rule.flag}» = ${n} (нужно ≥ ${rule.min})`;
        }
        if (rule.max != null && n > Number(rule.max)) {
          return `флаг «${rule.flag}» = ${n} (нужно ≤ ${rule.max})`;
        }
      }
      const eq = rule.equals !== undefined ? rule.equals : true;
      if (typeof eq === 'boolean') {
        return `флаг «${rule.flag}» равен ${!!val} (ожидалось ${eq})`;
      }
      return `флаг «${rule.flag}» = ${val} (ожидалось ${eq})`;
    }
    if (rule.notFlag) {
      return `флаг «${rule.notFlag}» установлен (ожидалось, что он выключен)`;
    }
    if (rule.hasItem) {
      return `нет предмета «${rule.hasItem}»`;
    }
    if (rule.notHasItem) {
      return `есть предмет «${rule.notHasItem}» (ожидалось отсутствие)`;
    }
    if (rule.goldMin != null) {
      return `золото ${ctx.gold ?? 0} (нужно ≥ ${rule.goldMin})`;
    }
    if (rule.goldMax != null) {
      return `золото ${ctx.gold ?? 0} (нужно ≤ ${rule.goldMax})`;
    }
    if (rule.class) {
      return `класс «${ctx.className || '—'}» (нужен «${rule.class}»)`;
    }
    if (rule.choiceUsed) {
      return `выбор «${rule.choiceUsed}» ещё не использован`;
    }
    if (rule.choiceNotUsed) {
      return `выбор «${rule.choiceNotUsed}» уже использован`;
    }
    if (rule.questStage) {
      const qs = rule.questStage;
      const questId = qs.questId || qs.quest;
      const want = qs.stage != null ? String(qs.stage) : '';
      const current = this.getQuestStageFromCtx(ctx, questId);
      return `квест «${questId}»: стадия «${current ?? 'нет'}» (нужна «${want}»)`;
    }
    if (rule.questMinStage) {
      const qm = rule.questMinStage;
      const questId = qm.questId || qm.quest;
      const min = Number(qm.stage);
      const current = this.getQuestStageFromCtx(ctx, questId);
      return `квест «${questId}»: стадия «${current ?? 'нет'}» (нужна ≥ ${min})`;
    }
    if (rule.reputation?.faction) {
      const cur = Number(flags[rule.reputation.faction]) || 0;
      const val = Number(rule.reputation.value);
      const op = rule.reputation.op || 'gte';
      return `репутация «${rule.reputation.faction}» = ${cur} (нужно ${op} ${val})`;
    }
    if (rule.reputation) {
      return 'условие репутации не выполнено';
    }
    return 'условие не выполнено';
  },

  /**
   * Первая причина, почему блок условий не выполнен (для showIf — нужно true, для hideIf — объяснение при true).
   * @returns {string|null} текст причины или null, если блок «провалился» ожидаемо для режима
   */
  explainConditionsFailure(conditions, ctx, options) {
    if (!conditions) return null;
    const norm = this.normalize(conditions);
    if (!norm) return null;
    const opts = options || {};

    if (Array.isArray(norm.all)) {
      if (norm.all.length === 0) return null;
      for (let i = 0; i < norm.all.length; i++) {
        const rule = norm.all[i];
        if (!this.evaluateConditionNode(rule, ctx)) {
          const detail = this.explainConditionNode(rule, ctx);
          const mode = norm.all.length > 1 ? ` (правило ${i + 1} из ${norm.all.length}, all)` : '';
          return `${detail}${mode}`;
        }
      }
      return opts.whenTrue ? 'все условия (all) выполнены' : null;
    }

    if (Array.isArray(norm.any)) {
      if (norm.any.length === 0) return null;
      if (norm.any.some((r) => this.evaluateConditionNode(r, ctx))) {
        return opts.whenTrue ? 'хотя бы одно условие (any) выполнено' : null;
      }
      const parts = norm.any
        .map((r) => this.explainConditionNode(r, ctx))
        .filter(Boolean);
      const sample = parts[0] || 'ни одно условие не подошло';
      return `ни одно из условий (any) не выполнено: ${sample}`;
    }

    return null;
  },

  explainConditionRefFailure(conditionRef, ctx, args) {
    if (conditionRef == null || conditionRef === '') return 'ссылка на условие пуста';
    if (typeof conditionRef === 'string') {
      const def = this.CONDITION_REGISTRY[conditionRef];
      if (def) return `условие «${conditionRef}» не выполнено`;
      return `неизвестное условие «${conditionRef}»`;
    }
    if (typeof conditionRef === 'object') {
      const detail = this.explainConditionsFailure(conditionRef, ctx);
      return detail ? `условие не выполнено: ${detail}` : 'условие не выполнено';
    }
    return 'условие не выполнено';
  },

  /**
   * Объяснение видимости выбора для редактора (God Mode / превью).
   * @returns {{ visible: boolean, reason: string }}
   */
  explainChoiceVisibility(choice, ctx) {
    if (!choice) {
      return { visible: false, reason: 'Скрыто: пустой выбор' };
    }

    if (choice.condition != null && choice.condition !== '') {
      const args = choice.conditionParams || choice.params || null;
      if (!this.resolveRef(choice.condition, ctx, args)) {
        const detail = this.explainConditionRefFailure(choice.condition, ctx, args);
        return { visible: false, reason: `Скрыто: ${detail}` };
      }
    }

    const show = choice.showIf || choice.requires;
    if (show) {
      const fail = this.explainConditionsFailure(show, ctx);
      if (fail) {
        return { visible: false, reason: `Скрыто: ${fail}` };
      }
    }

    if (choice.hideIf && this.evaluate(choice.hideIf, ctx)) {
      const detail = this.explainConditionsFailure(choice.hideIf, ctx, { whenTrue: true });
      return {
        visible: false,
        reason: detail
          ? `Скрыто: условие hideIf выполнено (${detail})`
          : 'Скрыто: условие hideIf выполнено'
      };
    }

    return { visible: true, reason: '' };
  },

  /** Имя предмета / квеста / фракции без показа internal-only полей */
  humanItemName(ctx, itemId) {
    const it = ctx?.engine?.data?.items?.[itemId] || ctx?.items?.[itemId];
    return (it && (it.name || it.title)) || itemId || '—';
  },
  humanQuestName(ctx, questId) {
    const q = ctx?.quests?.[questId] || ctx?.engine?.data?.quests?.[questId];
    return (q && (q.title || q.name)) || questId || '—';
  },
  humanStageLabel(ctx, questId, stageKey) {
    const key = stageKey == null ? '' : String(stageKey);
    if (key === 'complete' || key === 'done' || key === '__finished__') return 'Завершён';
    if (key === '__failed__' || key === 'failed') return 'Провален';
    if (key === '0' || key === 'start' || key === '') return 'Не начат';
    const q = ctx?.quests?.[questId] || ctx?.engine?.data?.quests?.[questId];
    const stages = q?.stages;
    if (Array.isArray(stages)) {
      const idx = parseInt(key, 10);
      if (!Number.isNaN(idx) && stages[idx]) {
        return stages[idx].title || stages[idx].name || ('Этап ' + (idx + 1));
      }
      const byId = stages.find((s) => s && (s.id === key || String(s.index) === key));
      if (byId) return byId.title || byId.name || key;
    }
    return 'Этап «' + key + '»';
  },
  humanFactionName(ctx, factionId) {
    const r = ctx?.engine?.data?.reputation?.[factionId] || ctx?.reputation?.[factionId];
    return (r && r.name) || factionId || '—';
  },
  humanClassName(ctx, classId) {
    const c = ctx?.engine?.data?.classes?.[classId];
    return (c && (c.name || c.title)) || classId || '—';
  },

  /**
   * Статус одного правила: { ok, title, required, current, detail }
   * Без questProgress / flags / AST в тексте.
   */
  explainRuleStatus(rule, ctx) {
    if (!rule || typeof rule !== 'object') {
      return { ok: true, title: 'Условие', detail: '' };
    }
    if (Array.isArray(rule.all) || Array.isArray(rule.any)) {
      const nested = this.explainConditionsDetail(rule, ctx);
      return {
        ok: nested.ok,
        title: nested.modeLabel,
        required: '',
        current: '',
        detail: nested.ok ? 'Выполнено' : 'Не выполнено',
        children: nested.lines
      };
    }
    const ok = this.evaluateRule(rule, ctx);
    const flags = ctx.flags || {};
    const inventory = ctx.inventory || [];

    if (rule.hasItem) {
      const name = this.humanItemName(ctx, rule.hasItem);
      return {
        ok,
        title: 'Предмет «' + name + '»',
        required: 'есть у игрока',
        current: inventory.includes(rule.hasItem) ? 'есть' : 'нет',
        detail: ok ? '✓ Есть' : '❌ Нет в инвентаре'
      };
    }
    if (rule.notHasItem) {
      const name = this.humanItemName(ctx, rule.notHasItem);
      return {
        ok,
        title: 'Предмет «' + name + '»',
        required: 'отсутствует',
        current: inventory.includes(rule.notHasItem) ? 'есть' : 'нет',
        detail: ok ? '✓ Нет в инвентаре' : '❌ Всё ещё в инвентаре'
      };
    }
    if (rule.goldMin != null) {
      const g = ctx.gold ?? 0;
      return {
        ok,
        title: 'Золото',
        required: '≥ ' + rule.goldMin,
        current: String(g),
        detail: ok ? '✓ ' + g : '❌ Сейчас: ' + g + ', нужно ≥ ' + rule.goldMin
      };
    }
    if (rule.goldMax != null) {
      const g = ctx.gold ?? 0;
      return {
        ok,
        title: 'Золото',
        required: '≤ ' + rule.goldMax,
        current: String(g),
        detail: ok ? '✓ ' + g : '❌ Сейчас: ' + g + ', нужно ≤ ' + rule.goldMax
      };
    }
    if (rule.class) {
      const need = this.humanClassName(ctx, rule.class);
      const cur = this.humanClassName(ctx, ctx.className) || ctx.className || '—';
      return {
        ok,
        title: 'Класс',
        required: need,
        current: cur,
        detail: ok ? '✓ ' + cur : '❌ Сейчас: ' + cur + ', нужен: ' + need
      };
    }
    if (rule.questStage) {
      const qs = rule.questStage;
      const questId = qs.questId || qs.quest;
      const want = qs.stage != null ? String(qs.stage) : '';
      const current = this.getQuestStageFromCtx(ctx, questId);
      const qName = this.humanQuestName(ctx, questId);
      const wantL = this.humanStageLabel(ctx, questId, want);
      const curL = this.humanStageLabel(ctx, questId, current);
      return {
        ok,
        title: 'Квест «' + qName + '»',
        required: wantL,
        current: curL,
        detail: ok ? '✓ ' + curL : '❌ Требуется: ' + wantL + '. Сейчас: ' + curL
      };
    }
    if (rule.reputation?.faction) {
      const fac = rule.reputation.faction;
      const name = this.humanFactionName(ctx, fac);
      const cur = Number(flags[fac]) || 0;
      const val = Number(rule.reputation.value);
      const op = rule.reputation.op || 'gte';
      const opL = op === 'lte' || op === '<=' ? '≤' : op === 'eq' ? '=' : '≥';
      return {
        ok,
        title: 'Репутация: ' + name,
        required: opL + ' ' + val,
        current: String(cur),
        detail: ok ? '✓ ' + cur : '❌ Сейчас: ' + cur + ', нужно ' + opL + ' ' + val
      };
    }
    if (rule.flag != null && rule.flag !== '') {
      // Не светим сырой id; смягчённая формулировка
      const label = String(rule.flag).replace(/^rep_/, 'репутация ').replace(/_/g, ' ');
      const cur = this.resolveFlagOrVariable(rule.flag, ctx);
      return {
        ok,
        title: 'Состояние: ' + label,
        required: rule.min != null ? '≥ ' + rule.min : (rule.equals !== undefined ? String(rule.equals) : 'да'),
        current: String(cur),
        detail: ok ? '✓ Выполнено' : '❌ Не выполнено'
      };
    }
    if (rule.notFlag) {
      const label = String(rule.notFlag).replace(/_/g, ' ');
      const cur = this.resolveFlagOrVariable(rule.notFlag, ctx);
      return { ok, title: 'Состояние: ' + label, required: 'выключено', current: cur ? 'включено' : 'выключено', detail: ok ? '✓' : '❌' };
    }
    if (rule.choiceUsed) {
      return { ok, title: 'Выбор уже сделан', required: 'да', current: ok ? 'да' : 'нет', detail: ok ? '✓' : '❌ Ещё не сделан' };
    }
    if (rule.choiceNotUsed) {
      return { ok, title: 'Выбор ещё не сделан', required: 'не сделан', current: ok ? 'не сделан' : 'уже сделан', detail: ok ? '✓' : '❌ Уже использован' };
    }
    // fallback to string explainer
    const fail = this.explainRuleFailure(rule, ctx);
    return { ok, title: 'Условие', required: '', current: '', detail: ok ? '✓ Выполнено' : '❌ ' + fail };
  },

  /**
   * Детальный разбор all/any: { ok, mode, modeLabel, lines: explainRuleStatus[] }
   */
  explainConditionsDetail(conditions, ctx, options) {
    const opts = options || {};
    const norm = this.normalize(conditions);
    if (!norm) return { ok: true, mode: 'all', modeLabel: '', lines: [] };

    if (Array.isArray(norm.all)) {
      const lines = norm.all.map((r) => this.explainRuleStatus(r, ctx));
      const ok = lines.every((l) => l.ok);
      return {
        ok: opts.whenTrue ? !ok : ok,
        mode: 'all',
        modeLabel: 'Все условия должны выполняться',
        lines
      };
    }
    if (Array.isArray(norm.any)) {
      const lines = norm.any.map((r) => this.explainRuleStatus(r, ctx));
      const ok = lines.some((l) => l.ok);
      return {
        ok: opts.whenTrue ? !ok : ok,
        mode: 'any',
        modeLabel: 'Достаточно любого условия',
        lines
      };
    }
    return { ok: true, mode: 'all', modeLabel: '', lines: [] };
  },

  /**
   * Полное объяснение недоступности выбора (для UI «Почему?»).
   * @returns {{ visible: boolean, title: string, summary: string, sections: Array }}
   */
  explainChoiceDetail(choice, ctx) {
    const base = this.explainChoiceVisibility(choice, ctx);
    if (base.visible) {
      return { visible: true, title: '', summary: '', sections: [] };
    }
    const choiceLabel = String(choice?.text || 'Выбор').replace(/<[^>]+>/g, '').trim() || 'Выбор';
    const sections = [];

    const show = choice.showIf || choice.requires;
    if (show) {
      const det = this.explainConditionsDetail(show, ctx);
      sections.push({
        heading: det.modeLabel || 'Условия доступности',
        lines: det.lines
      });
    }
    if (choice.hideIf && this.evaluate(choice.hideIf, ctx)) {
      const det = this.explainConditionsDetail(choice.hideIf, ctx, { whenTrue: true });
      sections.push({
        heading: 'Скрыто, потому что',
        lines: det.lines
      });
    }
    if (choice.condition != null && choice.condition !== '') {
      sections.push({
        heading: 'Особое условие',
        lines: [{ ok: false, title: 'Дополнительная проверка', detail: this.explainConditionRefFailure(choice.condition, ctx) }]
      });
    }

    if (!sections.length) {
      sections.push({
        heading: 'Причина',
        lines: [{ ok: false, title: 'Недоступно', detail: base.reason || 'Условие не выполнено' }]
      });
    }

    return {
      visible: false,
      title: 'Выбор «' + choiceLabel + '» недоступен',
      summary: 'Недоступно',
      sections
    };
  },

  /** showIf / requires — показать; hideIf — скрыть если условие истинно */
  isChoiceVisible(choice, ctx) {
    return this.explainChoiceVisibility(choice, ctx).visible;
  },

  filterChoices(choices, ctx) {
    if (!Array.isArray(choices)) return [];
    return choices.filter(c => this.isChoiceVisible(c, ctx));
  },

  /** Именованные условия (ссылки в service_menu и JSON) */
  CONDITION_REGISTRY: {
    always: { check: () => true },
    has_jack_bag: {
      check: (ctx) => (ctx.inventory || []).includes('jack_bag')
    },
    jack_quest_active: {
      check: (ctx) => !!(ctx.flags?.jackQuest) && !ctx.flags?.jackRewarded
    },
    has_damaged_equipment: {
      check: (ctx) => {
        const engine = typeof GameEngine !== 'undefined' ? GameEngine : null;
        if (!engine?.getEquippedItemId) return false;
        const slots = engine.ENHANCEMENT_SLOTS || ['weapon_main', 'armor', 'shield'];
        return slots.some((slot) => {
          const id = engine.getEquippedItemId(slot);
          return id && (engine.getItemEnhancementLevel?.(id) || 0) > 0;
        });
      }
    },
    has_cursed_equipped: {
      check: (ctx) => {
        const engine = typeof GameEngine !== 'undefined' ? GameEngine : null;
        return !!(engine?.getEquippedCursedEntries?.()?.length);
      }
    },
    time_period: {
      check: (ctx, params) => {
        const engine = typeof GameEngine !== 'undefined' ? GameEngine : null;
        if (!engine?.isTimeSystemEnabled?.()) return true;
        const period = engine.getTimePeriod();
        const periods = params?.periods || params?.period;
        if (Array.isArray(periods)) return periods.includes(period);
        if (typeof periods === 'string') return periods === period;
        return true;
      }
    },
    time_between: {
      check: (ctx, params) => {
        const engine = typeof GameEngine !== 'undefined' ? GameEngine : null;
        const h = engine?.timeSystem?.state?.hour;
        if (h == null) return true;
        const from = parseInt(params?.from, 10);
        const to = parseInt(params?.to, 10);
        if (Number.isNaN(from) || Number.isNaN(to)) return true;
        if (from <= to) return h >= from && h < to;
        return h >= from || h < to;
      }
    },
    is_open: {
      check: (ctx, params) => {
        const engine = typeof GameEngine !== 'undefined' ? GameEngine : null;
        if (!engine?.isTimeSystemEnabled?.()) return true;
        const open = params?.openHour ?? params?.open ?? params?.from;
        const close = params?.closeHour ?? params?.close ?? params?.to;
        return engine.isOpen(open, close);
      }
    },
    day_of_week: {
      check: (ctx, params) => {
        const engine = typeof GameEngine !== 'undefined' ? GameEngine : null;
        const day = engine?.timeSystem?.state?.day;
        if (day == null) return true;
        const dow = ((day - 1) % 7);
        const days = params?.days;
        if (!Array.isArray(days)) return true;
        return days.includes(dow);
      }
    },
    season_is: {
      check: (ctx, params) => {
        const cur = GameEngine?.seasonSystem?.state?.season;
        if (!cur) return true;
        const list = params?.seasons || params?.season;
        if (Array.isArray(list)) return list.includes(cur);
        return list === cur;
      }
    },
    weather_is: {
      check: (ctx, params) => {
        const cur = GameEngine?.weatherSystem?.state?.current;
        if (!cur) return true;
        const list = params?.types || params?.weather;
        if (Array.isArray(list)) return list.includes(cur);
        return list === cur;
      }
    },
    temp_below: {
      check: (ctx, params) => {
        const t = GameEngine?.seasonSystem?.state?.temperature;
        if (t == null) return true;
        return t < (parseInt(params?.value, 10) || 0);
      }
    },
    temp_above: {
      check: (ctx, params) => {
        const t = GameEngine?.seasonSystem?.state?.temperature;
        if (t == null) return true;
        return t > (parseInt(params?.value, 10) || 0);
      }
    }
  },

  /**
   * conditionRef: строка (имя из CONDITION_REGISTRY), объект ConditionSystem, или { all/any }.
   */
  resolveRef(conditionRef, ctx, args) {
    if (conditionRef == null || conditionRef === '') return true;
    if (typeof conditionRef === 'string') {
      const def = this.CONDITION_REGISTRY[conditionRef];
      if (def && typeof def.check === 'function') {
        return !!def.check(ctx, args);
      }
      return true;
    }
    if (typeof conditionRef === 'object') {
      return this.evaluate(conditionRef, ctx);
    }
    return true;
  },

  /** Сбор имён флагов по всему проекту (для редактора) */
  collectFlagNames(data) {
    const set = new Set();
    const add = (name) => { if (name) set.add(name); };

    Object.entries(data?.scenes || {}).forEach(([sceneId, scene]) => {
      Object.keys(scene.flags || {}).forEach(add);
      (scene.states || []).forEach(st => {
        this.walkConditionFlags(st.condition, add);
        this.walkConditionFlags(st.if, add);
        this.walkConditionFlags(st.when, add);
        this.walkConditionFlags(st.showIf, add);
        this.walkConditionFlags(st.requires, add);
      });
      (scene.choices || []).forEach((c, i) => {
        add(c.doneFlag);
        add(c.skillCheck?.doneFlag);
        add(`sc_${sceneId}_${i}`);
        add(`ch_${sceneId}_${i}`);
        this.walkConditionFlags(c.showIf, add);
        this.walkConditionFlags(c.hideIf, add);
        this.walkConditionFlags(c.requires, add);
        Object.keys(c.skillCheck?.successFlags || {}).forEach(add);
      });
    });
    Object.values(data?.quests || {}).forEach(q => {
      if (!q.rewards?.reputation) return;
      const rep = q.rewards.reputation;
      if (typeof rep === 'object' && !Array.isArray(rep)) {
        Object.keys(rep).forEach(add);
      } else if (typeof rep === 'string') {
        add(typeof QuestRuntime !== 'undefined' ? QuestRuntime.resolveReputationFlag(rep) : rep);
      }
    });
    Object.keys(data?.startingFlags || {}).forEach(add);
    Object.keys(data?.reputation || {}).forEach(k => {
      if (k !== 'starting') add(k);
    });
    Object.keys(data?.quests || {}).forEach(qid => add('quest_' + qid));
    return [...set].sort();
  },

  walkConditionFlags(conditions, add) {
    const norm = this.normalize(conditions);
    if (!norm) return;
    const list = norm.all || norm.any || [];
    list.forEach(r => {
      if (r.flag) add(r.flag);
      if (r.notFlag) add(r.notFlag);
      if (r.choiceUsed) add(r.choiceUsed);
      if (r.choiceNotUsed) add(r.choiceNotUsed);
      if (r.questStage?.questId) add('quest_' + r.questStage.questId);
      if (r.questMinStage?.questId) add('quest_' + r.questMinStage.questId);
    });
  },

  validateChoiceConditions(choice, ctxMeta, errors, prefix) {
    const { sceneId, flagCatalog, itemIds, sceneIds } = ctxMeta;
    const checkGroup = (label, cond) => {
      const norm = this.normalize(cond);
      if (!norm) return;
      const list = norm.all || norm.any || [];
      list.forEach((r, ri) => {
        if (r.hasItem && itemIds && !itemIds.has(r.hasItem)) {
          errors.push(`${prefix} ${label}, правило ${ri + 1}: неизвестный предмет "${r.hasItem}"`);
        }
        if (r.notHasItem && itemIds && !itemIds.has(r.notHasItem)) {
          errors.push(`${prefix} ${label}, правило ${ri + 1}: неизвестный предмет "${r.notHasItem}"`);
        }
        if (r.flag && flagCatalog && !flagCatalog.has(r.flag)) {
          errors.push(`${prefix} ${label}, правило ${ri + 1}: флаг "${r.flag}" нигде не задаётся (подсказка)`);
        }
      });
    };
    checkGroup('showIf', choice.showIf || choice.requires);
    checkGroup('hideIf', choice.hideIf);
    if (choice.skillCheck) {
      const sc = choice.skillCheck;
      if (!sc.skill) errors.push(`${prefix}: skillCheck без навыка`);
      if (sc.dc == null) errors.push(`${prefix}: skillCheck без DC`);
      if (sc.successNext && sceneIds && !sceneIds.includes(sc.successNext)) {
        errors.push(`${prefix}: successNext "${sc.successNext}" не найдена`);
      }
      if (sc.failNext && sceneIds && !sceneIds.includes(sc.failNext)) {
        errors.push(`${prefix}: failNext "${sc.failNext}" не найдена`);
      }
      Object.keys(sc.successFlags || {}).forEach(fid => {
        if (flagCatalog && !flagCatalog.has(fid)) {
          errors.push(`${prefix}: successFlags."${fid}" — новый флаг (ок, если задумано)`);
        }
      });
      (sc.successItems || []).forEach(iid => {
        if (itemIds && !itemIds.has(iid)) {
          errors.push(`${prefix}: successItems "${iid}" — предмет не в каталоге`);
        }
      });
    }
  }
};
