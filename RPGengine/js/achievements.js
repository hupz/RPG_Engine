// Система достижений: каталог в data.achievements, прогресс в save

const AchievementSystem = {
  TEMPLATES: {
    visit_scene: 'Пройти сцену',
    collect_items: 'Собрать N предметов',
    defeat_boss: 'Победить босса (сцена боя)',
    defeat_enemy: 'Победить врага',
    quest_stage: 'Достичь стадии квеста',
    quest_complete: 'Завершить квест',
    flag: 'Флаг = значение'
  },

  ensureAchievements(data) {
    if (!data || typeof data !== 'object') return;
    if (!data.achievements || typeof data.achievements !== 'object') {
      data.achievements = {};
    }
  },

  normalize(ach, id) {
    if (!ach || typeof ach !== 'object') ach = {};
    const out = { ...ach };
    out.id = String(out.id || id || '').trim() || id;
    out.title = String(out.title || out.id || 'Достижение').trim();
    out.description = String(out.description || '').trim();
    out.icon = String(out.icon || '🏆').trim();
    out.secret = !!out.secret;
    out.sound = String(out.sound || 'buff').trim();

    if (!out.unlock || typeof out.unlock !== 'object') {
      out.unlock = { type: 'template', template: 'visit_scene', sceneId: 'start' };
    }
    const u = out.unlock;
    if (!u.type) {
      if (u.expression) u.type = 'expression';
      else if (u.rules || u.all || u.any) u.type = 'rules';
      else u.type = 'template';
    }
    return out;
  },

  normalizeAll(data) {
    this.ensureAchievements(data);
    Object.entries(data.achievements).forEach(([id, ach]) => {
      data.achievements[id] = this.normalize(ach, id);
    });
  },

  getCatalog(data) {
    this.ensureAchievements(data);
    return data.achievements || {};
  },

  ensureUnlockState(engine) {
    if (!engine?.state) return;
    if (!engine.state.achievementUnlocks || typeof engine.state.achievementUnlocks !== 'object') {
      engine.state.achievementUnlocks = {};
    }
  },

  isUnlocked(engine, achievementId) {
    this.ensureUnlockState(engine);
    return !!engine.state.achievementUnlocks[achievementId];
  },

  getUnlockedCount(engine) {
    this.ensureUnlockState(engine);
    const catalog = this.getCatalog(engine.data);
    const total = Object.keys(catalog).length;
    const unlocked = Object.keys(catalog).filter((id) => this.isUnlocked(engine, id)).length;
    return { unlocked, total };
  },

  countItem(inventory, itemId) {
    if (!itemId || !Array.isArray(inventory)) return 0;
    return inventory.filter((i) => i === itemId).length;
  },

  hasDefeatedEnemy(engine, enemyId) {
    if (!enemyId) return false;
    const cleared = engine.state.clearedCombats || {};
    for (const info of Object.values(cleared)) {
      if (info?.enemyIds?.includes(enemyId)) return true;
    }
    const scenes = engine.data?.scenes || {};
    for (const [sid, raw] of Object.entries(scenes)) {
      if (!raw?.combat?.includes(enemyId)) continue;
      if (typeof engine.isCombatSceneCleared === 'function' && engine.isCombatSceneCleared(sid)) {
        return true;
      }
    }
    if (engine.state.flags?.[`enemy_defeated_${enemyId}`]) return true;
    return false;
  },

  getQuestStage(engine, questId) {
    if (typeof engine.getQuestStage === 'function') {
      return engine.getQuestStage(questId);
    }
    return engine.state?.questStages?.[questId];
  },

  evaluateExpression(engine, expression) {
    const expr = String(expression || '').trim();
    if (!expr) return false;
    try {
      const state = engine.state;
      const data = engine.data;
      const flags = state.flags || {};
      const inventory = state.inventory || [];
      const questStages = state.questStages || {};
      const sceneVisits = state.sceneVisits || {};
      const clearedCombats = state.clearedCombats || {};
      const achievementUnlocks = state.achievementUnlocks || {};
      const fn = new Function(
        'state', 'data', 'flags', 'inventory', 'questStages', 'sceneVisits', 'clearedCombats', 'achievementUnlocks',
        `return !!(${expr});`
      );
      return !!fn(state, data, flags, inventory, questStages, sceneVisits, clearedCombats, achievementUnlocks);
    } catch (err) {
      console.warn('AchievementSystem: ошибка выражения', expr, err);
      return false;
    }
  },

  evaluateTemplate(engine, unlock) {
    const u = unlock || {};
    const tpl = u.template || 'visit_scene';

    if (tpl === 'visit_scene') {
      const sid = u.sceneId || u.scene;
      if (!sid) return false;
      return (engine.state.sceneVisits?.[sid] || 0) >= 1 || engine.state.scene === sid;
    }

    if (tpl === 'collect_items') {
      const itemId = u.itemId || u.item;
      const need = Math.max(1, parseInt(u.count, 10) || 1);
      return this.countItem(engine.state.inventory, itemId) >= need;
    }

    if (tpl === 'defeat_boss') {
      const sid = u.sceneId || u.scene;
      if (!sid) return false;
      if (engine.state.clearedCombats?.[sid]) return true;
      if (typeof engine.isCombatSceneCleared === 'function') return engine.isCombatSceneCleared(sid);
      return !!engine.state.flags?.[`combat_cleared_${sid}`];
    }

    if (tpl === 'defeat_enemy') {
      return this.hasDefeatedEnemy(engine, u.enemyId || u.enemy);
    }

    if (tpl === 'quest_stage') {
      const qid = u.questId || u.quest;
      const stage = u.stage != null ? String(u.stage) : '';
      if (!qid || !stage) return false;
      const cur = this.getQuestStage(engine, qid);
      if (stage === 'complete' || stage === '__finished__') {
        return cur === '__finished__' || cur === 'complete';
      }
      if (stage === 'failed' || stage === '__failed__') {
        return cur === '__failed__' || cur === 'failed';
      }
      return String(cur) === stage;
    }

    if (tpl === 'quest_complete') {
      const qid = u.questId || u.quest;
      if (!qid) return false;
      const cur = this.getQuestStage(engine, qid);
      return cur === '__finished__' || cur === 'complete';
    }

    if (tpl === 'flag') {
      const flag = u.flag;
      if (!flag) return false;
      const expected = u.equals != null ? u.equals : u.value;
      const actual = engine.state.flags?.[flag];
      if (typeof expected === 'boolean') return !!actual === expected;
      if (typeof expected === 'number') return Number(actual) === expected;
      return String(actual) === String(expected);
    }

    return false;
  },

  evaluateRules(engine, rules) {
    if (typeof ConditionSystem === 'undefined' || !rules) return false;
    const ctx = typeof engine.getConditionContext === 'function'
      ? engine.getConditionContext()
      : {
        flags: { ...(engine.state.flags || {}) },
        inventory: [...(engine.state.inventory || [])],
        gold: engine.state.gold ?? 0,
        className: engine.state.className || '',
        questStages: { ...(engine.state.questStages || {}) },
        quests: engine.data?.quests || {}
      };
    ctx.achievementUnlocks = { ...(engine.state.achievementUnlocks || {}) };
    return !!ConditionSystem.evaluate(rules, ctx);
  },

  evaluateUnlock(engine, ach) {
    if (!ach?.unlock) return false;
    const u = ach.unlock;
    if (u.type === 'expression') return this.evaluateExpression(engine, u.expression);
    if (u.type === 'rules') return this.evaluateRules(engine, u.rules || u);
    return this.evaluateTemplate(engine, u);
  },

  unlock(engine, achievementId, ach) {
    this.ensureUnlockState(engine);
    if (this.isUnlocked(engine, achievementId)) return false;

    const meta = this.normalize(ach || engine.data?.achievements?.[achievementId] || {}, achievementId);
    engine.state.achievementUnlocks[achievementId] = {
      unlockedAt: Date.now()
    };

    if (typeof engine.onAchievementUnlocked === 'function') {
      engine.onAchievementUnlocked(meta);
    }
    return true;
  },

  checkAll(engine, event) {
    if (!engine?.data) return [];
    this.normalizeAll(engine.data);
    this.ensureUnlockState(engine);

    const catalog = this.getCatalog(engine.data);
    const ids = Object.keys(catalog);
    if (!ids.length) return [];

    const unlockedNow = [];
    ids.forEach((id) => {
      if (this.isUnlocked(engine, id)) return;
      const ach = catalog[id];
      if (!this.evaluateUnlock(engine, ach)) return;
      if (this.unlock(engine, id, ach)) unlockedNow.push(id);
    });

    if (unlockedNow.length && typeof engine.renderAchievementsPanel === 'function') {
      engine.renderAchievementsPanel();
    }

    return unlockedNow;
  },

  getDisplayMeta(engine, achievementId, ach) {
    const meta = this.normalize(ach || engine.data?.achievements?.[achievementId] || {}, achievementId);
    const unlocked = this.isUnlocked(engine, achievementId);
    if (!unlocked && meta.secret) {
      return {
        id: achievementId,
        unlocked: false,
        secret: true,
        title: '???',
        description: 'Секретное достижение',
        icon: '❓'
      };
    }
    return {
      id: achievementId,
      unlocked,
      secret: !!meta.secret,
      title: meta.title,
      description: meta.description,
      icon: meta.icon
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AchievementSystem };
}
