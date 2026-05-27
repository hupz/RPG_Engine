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

  evaluateRule(rule, ctx) {
    if (!rule || typeof rule !== 'object') return true;
    const flags = ctx.flags || {};
    const inventory = ctx.inventory || [];

    if (rule.flag != null && rule.flag !== '') {
      const val = flags[rule.flag];
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
    if (rule.notFlag) return !flags[rule.notFlag];
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

  /** Текущая стадия квеста: приоритет questStages, затем legacy-флаг quest_* */
  getQuestStageFromCtx(ctx, questId) {
    if (!questId) return null;
    const stages = ctx.questStages || {};
    if (stages[questId] != null && stages[questId] !== '') return String(stages[questId]);
    const legacy = ctx.flags?.['quest_' + questId];
    if (legacy == null || legacy === '') return null;
    if (typeof QuestSystem !== 'undefined' && ctx.quests?.[questId]) {
      return QuestSystem.resolveStageRef(ctx.quests[questId], legacy);
    }
    return String(legacy);
  },

  evaluate(conditions, ctx) {
    if (!conditions) return true;
    const norm = this.normalize(conditions);
    if (!norm) return true;
    if (Array.isArray(norm.all)) {
      return norm.all.length === 0 || norm.all.every(r => this.evaluateRule(r, ctx));
    }
    if (Array.isArray(norm.any)) {
      return norm.any.length === 0 || norm.any.some(r => this.evaluateRule(r, ctx));
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

  /** showIf / requires — показать; hideIf — скрыть если условие истинно */
  isChoiceVisible(choice, ctx) {
    if (!choice) return false;
    const show = choice.showIf || choice.requires;
    if (show && !this.evaluate(show, ctx)) return false;
    if (choice.hideIf && this.evaluate(choice.hideIf, ctx)) return false;
    return true;
  },

  filterChoices(choices, ctx) {
    if (!Array.isArray(choices)) return [];
    return choices.filter(c => this.isChoiceVisible(c, ctx));
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
        add(typeof QuestSystem !== 'undefined' ? QuestSystem.resolveReputationFlag(rep) : rep);
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
