// ============================================
// Система квестов: нормализация данных, стадии, совместимость с флагами quest_*
// ============================================

const QuestSystem = {
  /**
   * Нормализует все квесты в data.quests к формату v2:
   * { title, stages: { "0": { log, hint } }, isFinished, hidden?, rewards?, legacyStageMap? }
   */
  normalizeAll(data) {
    if (!data) return;
    if (!data.quests || typeof data.quests !== 'object') data.quests = {};
    for (const [id, quest] of Object.entries(data.quests)) {
      data.quests[id] = this.normalizeQuest(id, quest);
    }
  },

  /** Один квест: массив stages[] или старые поля → объект stages по ключам "0","1",… */
  normalizeQuest(questId, quest) {
    if (!quest || typeof quest !== 'object') {
      return { title: questId, stages: { 0: { log: '', hint: '' } }, isFinished: false };
    }
    if (quest.stages && !Array.isArray(quest.stages) && typeof quest.stages === 'object') {
      const stages = {};
      const legacyStageMap = { ...(quest.legacyStageMap || {}) };
      for (const [k, st] of Object.entries(quest.stages)) {
        const key = String(k);
        stages[key] = {
          log: st.log || st.description || '',
          hint: st.hint || st.name || '',
          finish: !!st.finish
        };
        if (st.legacyId) legacyStageMap[st.legacyId] = key;
      }
      return {
        ...quest,
        title: quest.title || questId,
        stages,
        isFinished: !!quest.isFinished,
        legacyStageMap
      };
    }
    const arr = Array.isArray(quest.stages) ? quest.stages : [];
    const stages = {};
    const legacyStageMap = {};
    arr.forEach((st, i) => {
      const key = String(i);
      const legacyId = st.id || ('stage_' + i);
      stages[key] = {
        log: st.description || st.log || '',
        hint: st.name || st.hint || '',
        finish: legacyId === 'complete' || !!st.finish
      };
      legacyStageMap[legacyId] = key;
    });
    if (!Object.keys(stages).length) {
      stages['0'] = { log: quest.description || '', hint: 'Начало', finish: false };
      legacyStageMap.start = '0';
    }
    return {
      title: quest.title || questId,
      description: quest.description,
      giver: quest.giver,
      hidden: !!quest.hidden,
      rewards: quest.rewards,
      stages,
      isFinished: !!quest.isFinished,
      legacyStageMap
    };
  },

  /** Ключи стадий по возрастанию (0, 1, 2, …) */
  getStageKeys(quest) {
    if (!quest?.stages) return [];
    return Object.keys(quest.stages).sort((a, b) => Number(a) - Number(b));
  },

  /**
   * Приводит ссылку на стадию (число, "0", legacy "start", "complete") к ключу в stages.
   */
  resolveStageRef(quest, stageRef) {
    if (stageRef == null || stageRef === '') return null;
    const keys = this.getStageKeys(quest);
    if (!keys.length) return '0';
    const s = String(stageRef);
    if (quest.stages[s]) return s;
    if (quest.legacyStageMap?.[s]) return quest.legacyStageMap[s];
    if (s === 'complete') {
      const fin = keys.find(k => quest.stages[k]?.finish);
      return fin || keys[keys.length - 1];
    }
    const n = Number(s);
    if (!Number.isNaN(n) && quest.stages[String(n)]) return String(n);
    return keys[0];
  },

  getStageData(quest, stageKey) {
    if (!quest?.stages || stageKey == null) return null;
    return quest.stages[String(stageKey)] || null;
  },

  /** Последняя стадия (максимальный числовой ключ) */
  getLastStageKey(quest) {
    const keys = this.getStageKeys(quest);
    return keys.length ? keys[keys.length - 1] : null;
  },

  /** Стадия считается финальной только если у неё явно finish: true */
  isStageFinished(quest, stageKey) {
    const st = this.getStageData(quest, stageKey);
    return !!st?.finish;
  },

  /** ID квеста из legacy-флага quest_find_albert → find_albert */
  questIdFromLegacyFlag(flagName) {
    if (!flagName || !String(flagName).startsWith('quest_')) return null;
    return String(flagName).slice(6);
  },

  /** Legacy-псевдонимы флагов репутации в старых JSON */
  resolveReputationFlag(flag) {
    const alias = { village_hero: 'rep_village', jack_friend: 'rep_village' };
    return alias[flag] || flag;
  },

  /**
   * Награды репутации из rewards.
   * Новый формат: { "rep_village": 15 } (может быть отрицательным).
   * Старый: строка "rep_village" + опционально reputationAmount.
   */
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

  /** Первый флаг/значение для редактора (одна фракция на квест) */
  getPrimaryReputationReward(rewards) {
    const entries = this.getReputationEntries(rewards || {});
    if (entries.length) return entries[0];
    return { flag: '', amount: 0 };
  },

  /** Список ID квестов для редакторов */
  getQuestIds(data) {
    return Object.keys(data?.quests || {});
  }
};
