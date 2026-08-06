// ============================================================
// Migrate v1 stage-marker quests → v2 stages with tasks
// ============================================================

const QuestMigrate = {
  /**
   * Normalize + migrate all quests in data to v2 task format.
   * Idempotent: already-v2 quests only lightly normalized.
   */
  migrateAll(data) {
    if (!data) return data;
    if (!data.quests || typeof data.quests !== 'object') data.quests = {};
    for (const [id, quest] of Object.entries(data.quests)) {
      data.quests[id] = this.migrateQuest(id, quest);
    }
    data.questsVersion = 2;
    return data;
  },

  isV2(quest) {
    if (!quest || typeof quest !== 'object') return false;
    if (!Array.isArray(quest.stages)) return false;
    if (!quest.stages.length) return true;
    // v2: stages are array of { tasks: [] }
    return quest.stages.every((s) => s && (Array.isArray(s.tasks) || s.tasks == null));
  },

  migrateQuest(questId, quest) {
    if (!quest || typeof quest !== 'object') {
      return {
        id: questId,
        title: questId,
        stages: [{
          id: 'stage_0',
          title: 'Начало',
          hint: 'Начало',
          tasks: [{ type: 'ManualAdvance', id: 't0', description: 'Получите задание' }]
        }],
        rewards: {},
        hidden: false
      };
    }

    // Already array of stages with tasks
    if (Array.isArray(quest.stages) && quest.stages.length &&
        quest.stages.every((s) => s && Array.isArray(s.tasks))) {
      return this.normalizeV2(questId, quest);
    }

    // Object stages map "0","1" from old normalize
    if (quest.stages && !Array.isArray(quest.stages) && typeof quest.stages === 'object') {
      return this.fromStageMap(questId, quest);
    }

    // Array stages without tasks (old data/quests.json style)
    if (Array.isArray(quest.stages)) {
      return this.fromStageArray(questId, quest);
    }

    return this.normalizeV2(questId, {
      ...quest,
      stages: [{
        id: 'stage_0',
        title: 'Начало',
        hint: quest.description || 'Начало',
        log: quest.description || '',
        tasks: [{ type: 'ManualAdvance', id: questId + '_t0', description: quest.description || 'Выполните задание' }]
      }]
    });
  },

  fromStageMap(questId, quest) {
    const keys = Object.keys(quest.stages).sort((a, b) => Number(a) - Number(b));
    const legacyStageMap = { ...(quest.legacyStageMap || {}) };
    const stages = keys.map((k, i) => {
      const st = quest.stages[k] || {};
      const legacyId = Object.keys(legacyStageMap).find((lid) => String(legacyStageMap[lid]) === String(k));
      return this.stageFromOld(questId, i, {
        id: legacyId || st.id || ('stage_' + k),
        name: st.hint || st.name || st.title,
        description: st.log || st.description,
        hint: st.hint,
        log: st.log,
        finish: !!st.finish,
        failed: !!st.failed
      }, quest);
    });
    return this.normalizeV2(questId, {
      ...quest,
      stages,
      legacyStageMap: this.buildLegacyMap(stages, legacyStageMap)
    });
  },

  fromStageArray(questId, quest) {
    const arr = quest.stages || [];
    const stages = arr.map((st, i) => this.stageFromOld(questId, i, st, quest));
    return this.normalizeV2(questId, {
      ...quest,
      stages,
      legacyStageMap: this.buildLegacyMap(stages, quest.legacyStageMap || {})
    });
  },

  stageFromOld(questId, index, st, quest) {
    const legacyId = st.id || st.legacyId || ('stage_' + index);
    const finish = legacyId === 'complete' || !!st.finish;
    const failed = legacyId === 'failed' || !!st.failed;
    const title = st.name || st.hint || st.title || ('Этап ' + (index + 1));
    const hint = st.hint || st.name || title;
    const log = st.description || st.log || '';
    const tasks = this.inferTasks(questId, index, {
      legacyId, title, hint, log, finish, failed, giver: quest.giver
    });
    return {
      id: legacyId,
      legacyId,
      title,
      hint,
      log,
      finish,
      failed,
      tasks
    };
  },

  /**
   * Heuristic: turn old stage text into a concrete task when possible.
   * Fallback: ManualAdvance with description (completed via scene questSet).
   */
  inferTasks(questId, index, info) {
    const text = ((info.hint || '') + ' ' + (info.log || '') + ' ' + (info.title || '')).toLowerCase();
    const tasks = [];
    const tid = (suffix) => questId + '_s' + index + '_' + suffix;

    if (info.failed) {
      tasks.push({
        type: 'ManualAdvance',
        id: tid('fail'),
        description: info.hint || 'Квест провален',
        stageKey: info.legacyId
      });
      return tasks;
    }

    // Talk
    if (/поговори|поговорите|узнайте|расспроси/.test(text)) {
      const npc = info.giver && info.giver !== 'auto' ? info.giver : undefined;
      tasks.push({
        type: 'TalkToNPC',
        id: tid('talk'),
        npcId: npc,
        description: info.hint || info.log || 'Поговорить с NPC'
      });
    } else if (/верн|достав|отнес|отда/.test(text) && /сумк|письм|предмет|медаль/.test(text)) {
      tasks.push({
        type: 'DeliverItem',
        id: tid('deliver'),
        description: info.hint || info.log || 'Доставить предмет'
      });
    } else if (/найд|собери|собрать|подбер/.test(text)) {
      let itemId;
      if (/сумк/.test(text)) itemId = 'jack_bag';
      if (/медаль/.test(text)) itemId = itemId || 'albert_locket';
      tasks.push({
        type: 'CollectItem',
        id: tid('collect'),
        itemId,
        count: 1,
        description: info.hint || info.log || 'Найти предмет'
      });
    } else if (/убей|побед|сраз|убейте|главaрь|босс|бандит/.test(text)) {
      tasks.push({
        type: 'KillEnemy',
        id: tid('kill'),
        description: info.hint || info.log || 'Победить врага'
      });
    } else if (/отправ|достигн|посетите|иди|идите|осмотрите|локац|мельниц|деревн|склад|погреб/.test(text)) {
      let sceneId;
      if (/мельниц/.test(text)) sceneId = 'mill_arrival';
      if (/погреб/.test(text)) sceneId = sceneId || 'cellar';
      tasks.push({
        type: 'VisitLocation',
        id: tid('visit'),
        sceneId,
        description: info.hint || info.log || 'Посетить локацию'
      });
    } else if (info.finish) {
      tasks.push({
        type: 'ManualAdvance',
        id: tid('fin'),
        description: info.hint || info.log || 'Завершите задание',
        stageKey: info.legacyId || 'complete'
      });
    } else {
      tasks.push({
        type: 'ManualAdvance',
        id: tid('m'),
        description: info.hint || info.log || info.title || 'Выполните этап',
        stageKey: info.legacyId
      });
    }

    // Always ensure at least one task
    if (!tasks.length) {
      tasks.push({
        type: 'ManualAdvance',
        id: tid('m'),
        description: info.hint || 'Выполните этап',
        stageKey: info.legacyId
      });
    }
    return tasks;
  },

  buildLegacyMap(stages, existing) {
    const map = { ...(existing || {}) };
    stages.forEach((st, i) => {
      if (st.legacyId) map[st.legacyId] = String(i);
      if (st.id) map[st.id] = String(i);
      map[String(i)] = String(i);
    });
    if (stages.some((s) => s.finish)) {
      const fi = stages.findIndex((s) => s.finish);
      map.complete = String(fi);
    }
    if (stages.some((s) => s.failed)) {
      const fi = stages.findIndex((s) => s.failed);
      map.failed = String(fi);
    }
    return map;
  },

  normalizeV2(questId, quest) {
    const stages = (quest.stages || []).map((st, i) => {
      const tasks = Array.isArray(st.tasks) ? st.tasks.map((t, j) => {
        if (!t || typeof t !== 'object') {
          return { type: 'ManualAdvance', id: questId + '_s' + i + '_t' + j, description: String(t || '') };
        }
        return {
          ...t,
          type: t.type || 'ManualAdvance',
          id: t.id || (questId + '_s' + i + '_t' + j)
        };
      }) : [{
        type: 'ManualAdvance',
        id: questId + '_s' + i + '_t0',
        description: st.hint || st.title || 'Выполните этап'
      }];
      return {
        id: st.id || st.legacyId || ('stage_' + i),
        legacyId: st.legacyId || st.id || ('stage_' + i),
        title: st.title || st.hint || st.name || ('Этап ' + (i + 1)),
        hint: st.hint || st.title || '',
        log: st.log || st.description || '',
        finish: !!st.finish,
        failed: !!st.failed,
        completionRule: st.completionRule === 'any' ? 'any' : 'all',
        // Advanced (not shown in basic editor): optional future AND/OR trees
        advanced: st.advanced || null,
        tasks
      };
    });
    if (!stages.length) {
      stages.push({
        id: 'stage_0',
        title: 'Начало',
        hint: 'Начало',
        log: '',
        finish: false,
        failed: false,
        tasks: [{ type: 'ManualAdvance', id: questId + '_t0', description: 'Получите задание' }]
      });
    }
    return {
      id: quest.id || questId,
      title: quest.title || questId,
      description: quest.description,
      giver: quest.giver,
      hidden: !!quest.hidden,
      rewards: quest.rewards || {},
      stages,
      legacyStageMap: this.buildLegacyMap(stages, quest.legacyStageMap || {}),
      questFormat: 2
    };
  },

  /** Migrate scene questSet stage refs remain valid via legacyStageMap */
  migrateSaveQuestProgress(state, data) {
    if (!state) return;
    if (!state.questProgress) state.questProgress = {};
    // Leave QuestRuntime.hydrateFromSave to fill from questStages
  }
};

if (typeof window !== 'undefined') {
  window.QuestMigrate = QuestMigrate;
}
