// ============================================================
// Migrate v1 stage-marker quests → v2 stages with tasks
// ============================================================

const QuestMigrate = {
  /**
   * Normalize + migrate all quests in data to v2 task format.
   * Idempotent: already-v2 quests only lightly normalized.
   */
  _report: null,

  beginReport() {
    this._report = {
      migratedAutomatically: [],
      requiresManualReview: [],
      unsupported: [],
      skippedV2: []
    };
  },

  getLastReport() {
    return this._report || {
      migratedAutomatically: [],
      requiresManualReview: [],
      unsupported: [],
      skippedV2: []
    };
  },

  formatReport(report) {
    report = report || this.getLastReport();
    const lines = [];
    lines.push('Migrated automatically: ' + (report.migratedAutomatically?.length || 0));
    (report.migratedAutomatically || []).forEach((x) => lines.push('  ✓ ' + x));
    lines.push('Requires manual review: ' + (report.requiresManualReview?.length || 0));
    (report.requiresManualReview || []).forEach((x) => lines.push('  ⚠ ' + x));
    lines.push('Unsupported: ' + (report.unsupported?.length || 0));
    (report.unsupported || []).forEach((x) => lines.push('  ✗ ' + x));
    if (report.skippedV2?.length) {
      lines.push('Already v2 (unchanged): ' + report.skippedV2.length);
    }
    return lines.join('\n');
  },

  migrateAll(data) {
    if (!data) return data;
    if (!data.quests || typeof data.quests !== 'object') data.quests = {};
    this.beginReport();
    for (const [id, quest] of Object.entries(data.quests)) {
      const wasV2 = this.isV2(quest) && Array.isArray(quest.stages) &&
        quest.stages.every((s) => s && Array.isArray(s.tasks));
      data.quests[id] = this.migrateQuest(id, quest);
      if (wasV2 && quest.questFormat === 2) {
        this._report.skippedV2.push(id);
      }
    }
    data.questsVersion = 2;
    data.questMigrationReport = this.getLastReport();
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
          tasks: [{
            type: 'MigrationRequired',
            id: 't0',
            description: 'Пустой квест — настройте задачи',
            legacyData: { questId, reason: 'empty_quest_def' }
          }]
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
        tasks: [{
          type: 'MigrationRequired',
          id: questId + '_t0',
          description: quest.description || 'Требуется ручная настройка',
          legacyData: { questId, description: quest.description, reason: 'no_stages_structure' }
        }]
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
   * Ambiguous stages → MigrationRequired (not ManualAdvance).
   * Explicit finish/failed markers → ManualAdvance (scene-driven legacy).
   */
  inferTasks(questId, index, info) {
    const text = ((info.hint || '') + ' ' + (info.log || '') + ' ' + (info.title || '')).toLowerCase();
    const tasks = [];
    const tid = (suffix) => questId + '_s' + index + '_' + suffix;
    const path = questId + ' / stage ' + index + ' («' + (info.title || info.legacyId || index) + '»)';
    const report = this._report;

    const pushMigrationRequired = (reason) => {
      tasks.push({
        type: 'MigrationRequired',
        id: tid('mig'),
        description: info.hint || info.log || info.title || 'Требуется ручная настройка задачи',
        legacyHint: info.hint || info.title || '',
        legacyId: info.legacyId || '',
        legacyData: {
          questId,
          stageIndex: index,
          legacyId: info.legacyId,
          title: info.title,
          hint: info.hint,
          log: info.log,
          finish: !!info.finish,
          failed: !!info.failed,
          giver: info.giver,
          reason: reason || 'unrecognized_stage_text'
        }
      });
      if (report) report.requiresManualReview.push(path + ' — ' + (reason || 'неоднозначный текст этапа'));
    };

    // Failed stage: explicit fail marker in old data — ManualAdvance is OK (scene-driven)
    if (info.failed) {
      tasks.push({
        type: 'ManualAdvance',
        id: tid('fail'),
        description: info.hint || 'Квест провален',
        stageKey: info.legacyId || 'failed'
      });
      if (report) report.migratedAutomatically.push(path + ' → ManualAdvance (failed)');
      return tasks;
    }

    // Finish stage with no other cue — ManualAdvance (old questSet complete)
    if (info.finish && !/поговори|найд|убей|побед|верн|достав|отправ|посетите/.test(text)) {
      tasks.push({
        type: 'ManualAdvance',
        id: tid('fin'),
        description: info.hint || info.log || 'Завершите задание',
        stageKey: info.legacyId || 'complete'
      });
      if (report) report.migratedAutomatically.push(path + ' → ManualAdvance (finish)');
      return tasks;
    }

    // Unambiguous heuristics only
    if (/поговори|поговорите|узнайте|расспроси/.test(text)) {
      const npc = info.giver && info.giver !== 'auto' ? info.giver : undefined;
      if (npc) {
        tasks.push({
          type: 'TalkToNPC',
          id: tid('talk'),
          npcId: npc,
          description: info.hint || info.log || 'Поговорить с NPC'
        });
        if (report) report.migratedAutomatically.push(path + ' → TalkToNPC(' + npc + ')');
      } else {
        pushMigrationRequired('TalkToNPC без npcId (giver не задан)');
      }
    } else if (/верн|достав|отнес|отда/.test(text) && /сумк|письм|предмет|медаль|кольц/.test(text)) {
      let itemId;
      if (/сумк/.test(text)) itemId = 'jack_bag';
      if (/медаль/.test(text)) itemId = itemId || 'elsa_locket';
      if (/кольц/.test(text)) itemId = itemId || 'lukorn_signet_ring';
      if (itemId) {
        tasks.push({
          type: 'DeliverItem',
          id: tid('deliver'),
          itemId,
          count: 1,
          description: info.hint || info.log || 'Доставить предмет'
        });
        if (report) report.migratedAutomatically.push(path + ' → DeliverItem(' + itemId + ')');
      } else {
        pushMigrationRequired('DeliverItem без однозначного itemId');
      }
    } else if (/найд|собери|собрать|подбер/.test(text)) {
      let itemId;
      if (/сумк/.test(text)) itemId = 'jack_bag';
      if (/медаль/.test(text)) itemId = itemId || 'elsa_locket';
      if (/трава|лунолист|herb/.test(text)) itemId = itemId || undefined;
      if (itemId) {
        tasks.push({
          type: 'CollectItem',
          id: tid('collect'),
          itemId,
          count: 1,
          description: info.hint || info.log || 'Найти предмет'
        });
        if (report) report.migratedAutomatically.push(path + ' → CollectItem(' + itemId + ')');
      } else {
        pushMigrationRequired('CollectItem без однозначного itemId');
      }
    } else if (/убей|побед|сраз|убейте|главарь|босс|бандит/.test(text)) {
      // Kill without specific enemy id → manual review (cannot invent enemyId)
      pushMigrationRequired('KillEnemy без однозначного enemyId');
    } else if (/отправ|достигн|посетите|иди\b|идите|осмотрите/.test(text) &&
               /мельниц|деревн|склад|погреб|локац|таверн|площад/.test(text)) {
      let sceneId;
      if (/мельниц/.test(text)) sceneId = 'mill_arrival';
      if (/погреб/.test(text)) sceneId = sceneId || 'cellar';
      if (/таверн/.test(text)) sceneId = sceneId || 'tavern';
      if (sceneId) {
        tasks.push({
          type: 'VisitLocation',
          id: tid('visit'),
          sceneId,
          description: info.hint || info.log || 'Посетить локацию'
        });
        if (report) report.migratedAutomatically.push(path + ' → VisitLocation(' + sceneId + ')');
      } else {
        pushMigrationRequired('VisitLocation без однозначного sceneId');
      }
    } else {
      pushMigrationRequired('текст этапа не распознан однозначно');
    }

    if (!tasks.length) {
      pushMigrationRequired('пустой результат эвристики');
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
          return {
            type: 'MigrationRequired',
            id: questId + '_s' + i + '_t' + j,
            description: String(t || 'Требуется ручная настройка'),
            legacyData: { raw: t, reason: 'string_task_entry' }
          };
        }
        if (!t.type) {
          return {
            ...t,
            type: 'MigrationRequired',
            id: t.id || (questId + '_s' + i + '_t' + j),
            description: t.description || 'Требуется ручная настройка',
            legacyData: { ...(t.legacyData || {}), reason: 'task_missing_type' }
          };
        }
        return {
          ...t,
          type: t.type,
          id: t.id || (questId + '_s' + i + '_t' + j)
        };
      }) : [{
        type: 'MigrationRequired',
        id: questId + '_s' + i + '_t0',
        description: st.hint || st.title || 'Требуется ручная настройка',
        legacyData: { hint: st.hint, title: st.title, reason: 'v2_stage_without_tasks' }
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
        description: st.description || st.log || '',
        entryActions: Array.isArray(st.entryActions) ? st.entryActions.slice() : undefined,
        rewardActions: Array.isArray(st.rewardActions) ? st.rewardActions.slice() : undefined,
        startConditions: st.startConditions && typeof st.startConditions === 'object' ? st.startConditions : undefined,
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
        tasks: [{
          type: 'MigrationRequired',
          id: questId + '_t0',
          description: 'Требуется ручная настройка',
          legacyData: { reason: 'empty_stages' }
        }]
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
      questFormat: 2,
      // Preserve legacy metadata when present
      legacyFlags: quest.legacyFlags || quest.flags || undefined,
      legacyConditions: quest.legacyConditions || quest.conditions || undefined,
      legacyData: quest.legacyData || undefined
    };
  },

  /** Migrate scene questSet stage refs remain valid via legacyStageMap */
  migrateSaveQuestProgress(state, data) {
    if (!state) return;
    if (!state.questProgress) state.questProgress = {};
  },

  /**
   * Old saves: find_albert completed without reward — reopen at stage 3 (compat only).
   */
  migrateAlbertSaveState(engine) {
    if (!engine?.state) return;
    const f = engine.state.flags || {};
    if (!f.albertSaved) return;
    if (f.find_albert_rewardClaimed) {
      if (!f.albertAtVillage) f.albertAtVillage = true;
      return;
    }
    const stage = typeof engine.getQuestStage === 'function' ? engine.getQuestStage('find_albert') : null;
    const finished =
      (typeof engine.isQuestFinished === 'function' && engine.isQuestFinished('find_albert')) ||
      stage === '4' || stage === '__finished__' || f.quest_find_albert === 'complete';
    if (!finished) return;
    f.albertAtVillage = true;
    if (typeof QuestRuntime !== 'undefined') {
      QuestRuntime.bind(engine);
      QuestRuntime.setStage('find_albert', 3, { force: true, silentLog: true });
    } else if (typeof engine.updateQuest === 'function') {
      engine.updateQuest('find_albert', 3, { force: true, silentLog: true });
    }
  }
};

if (typeof window !== 'undefined') {
  window.QuestMigrate = QuestMigrate;
}


