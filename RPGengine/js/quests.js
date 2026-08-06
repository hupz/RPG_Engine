// ============================================
// Система квестов v2: этапы → задачи + события
// ============================================

const QuestSystem = {
  normalizeAll(data) {
    if (!data) return;
    if (typeof QuestMigrate !== 'undefined') {
      QuestMigrate.migrateAll(data);
      return;
    }
    if (!data.quests || typeof data.quests !== 'object') data.quests = {};
  },

  normalizeQuest(questId, quest) {
    if (typeof QuestMigrate !== 'undefined') {
      return QuestMigrate.migrateQuest(questId, quest);
    }
    return quest;
  },

  getStageKeys(quest) {
    if (!quest?.stages) return [];
    if (Array.isArray(quest.stages)) {
      return quest.stages.map((_, i) => String(i));
    }
    return Object.keys(quest.stages).sort((a, b) => Number(a) - Number(b));
  },

  resolveStageRef(quest, stageRef) {
    if (typeof QuestRuntime !== 'undefined') {
      const idx = QuestRuntime.resolveStageIndex(quest, stageRef);
      if (idx != null) return String(idx);
    }
    if (stageRef == null || stageRef === '') return null;
    const keys = this.getStageKeys(quest);
    if (!keys.length) return '0';
    const s = String(stageRef);
    if (quest.stages && !Array.isArray(quest.stages) && quest.stages[s]) return s;
    if (Array.isArray(quest.stages)) {
      const n = Number(s);
      if (!Number.isNaN(n) && n >= 0 && n < quest.stages.length) return String(n);
      const found = quest.stages.findIndex((st) => st.id === s || st.legacyId === s);
      if (found >= 0) return String(found);
    }
    if (quest.legacyStageMap?.[s] != null) return String(quest.legacyStageMap[s]);
    if (s === 'complete' && Array.isArray(quest.stages)) {
      const fi = quest.stages.findIndex((st) => st.finish);
      return fi >= 0 ? String(fi) : String(quest.stages.length - 1);
    }
    if (s === 'failed' && Array.isArray(quest.stages)) {
      const fi = quest.stages.findIndex((st) => st.failed);
      return fi >= 0 ? String(fi) : s;
    }
    return keys[0];
  },

  getStageData(quest, stageKey) {
    if (!quest?.stages || stageKey == null) return null;
    if (Array.isArray(quest.stages)) {
      const n = Number(stageKey);
      const st = quest.stages[n];
      if (!st) return null;
      return {
        log: st.log || '',
        hint: st.hint || st.title || '',
        finish: !!st.finish,
        failed: !!st.failed,
        title: st.title,
        tasks: st.tasks
      };
    }
    return quest.stages[String(stageKey)] || null;
  },

  getLastStageKey(quest) {
    const keys = this.getStageKeys(quest);
    return keys.length ? keys[keys.length - 1] : null;
  },

  isStageFinished(quest, stageKey) {
    const st = this.getStageData(quest, stageKey);
    return !!st?.finish && !st?.failed;
  },

  isStageFailed(quest, stageKey) {
    const st = this.getStageData(quest, stageKey);
    return !!st?.failed;
  },

  questIdFromLegacyFlag(flagName) {
    if (!flagName || !String(flagName).startsWith('quest_')) return null;
    return String(flagName).slice(6);
  },

  resolveReputationFlag(flag) {
    const alias = { village_hero: 'rep_village', jack_friend: 'rep_village' };
    return alias[flag] || flag;
  },

  getReputationEntries(rewards) {
    const rep = rewards?.reputation;
    if (rep == null || rep === '') return [];
    const legacyDefault = { village_hero: 10, jack_friend: 8, rep_village: 10 };
    if (typeof rep === 'object' && !Array.isArray(rep)) {
      return Object.entries(rep)
        .map(([flag, amount]) => ({
          flag: this.resolveReputationFlag(flag),
          amount: Number(amount) || 0
        }))
        .filter((e) => e.flag && e.amount !== 0);
    }
    if (typeof rep === 'string') {
      const flag = this.resolveReputationFlag(rep);
      const fromField = Number(rewards.reputationAmount);
      const amount = Number.isFinite(fromField) ? fromField : (legacyDefault[rep] ?? 10);
      return amount !== 0 ? [{ flag, amount }] : [];
    }
    return [];
  },

  getPrimaryReputationReward(rewards) {
    const entries = this.getReputationEntries(rewards || {});
    if (entries.length) return entries[0];
    return { flag: '', amount: 0 };
  },

  getQuestIds(data) {
    return Object.keys(data?.quests || {});
  },

  getTaskTypes() {
    if (typeof QuestTaskRegistry !== 'undefined') {
      return QuestTaskRegistry.list().filter((t) => t.id !== 'base');
    }
    return [];
  }
};

if (typeof window !== 'undefined') {
  window.QuestSystem = QuestSystem;
}
