// ============================================================
// QuestRuntime — stages/tasks progress, completion, journal API
// ============================================================

const QuestRuntime = {
  /** @type {object|null} engine ref */
  engine: null,

  /**
   * state.questProgress shape:
   * {
   *   [questId]: {
   *     status: 'inactive'|'active'|'completed'|'failed',
   *     stageIndex: number,
   *     stages: { [index]: { tasks: [serialized tasks] } }
   *   }
   * }
   */

  bind(engine) {
    this.engine = engine;
    if (engine && engine.state && !engine.state.questProgress) {
      engine.state.questProgress = {};
    }
  },

  get data() {
    return this.engine?.data || null;
  },

  get state() {
    return this.engine?.state || null;
  },

  ensureProgressStore() {
    if (!this.state) return null;
    if (!this.state.questProgress || typeof this.state.questProgress !== 'object') {
      this.state.questProgress = {};
    }
    return this.state.questProgress;
  },

  getQuestDef(questId) {
    return this.data?.quests?.[questId] || null;
  },

  /** Build live task instances for a stage */
  buildStageTasks(questId, stageIndex, savedStage) {
    const quest = this.getQuestDef(questId);
    if (!quest) return [];
    const stageDef = (quest.stages || [])[stageIndex];
    if (!stageDef) return [];
    const defs = Array.isArray(stageDef.tasks) ? stageDef.tasks : [];
    const savedTasks = savedStage?.tasks || [];
    return defs.map((def, i) => {
      const saved = savedTasks.find((t) => t && t.id === def.id) || savedTasks[i] || null;
      const merged = saved ? { ...def, ...saved, type: def.type || saved.type } : { ...def };
      const ctx = { questId, stageIndex };
      try {
        return QuestTaskRegistry.create(merged, ctx);
      } catch (err) {
        if (err && err.name === 'UnknownQuestTaskTypeError') {
          console.warn('[QuestRuntime]', err.message, err.taskData || merged);
          // Preserve data — do NOT convert to ManualAdvance
          return QuestTaskRegistry.create(merged, ctx, { placeholder: true });
        }
        throw err;
      }
    }).filter(Boolean);
  },

  getProgress(questId) {
    const store = this.ensureProgressStore();
    return store?.[questId] || null;
  },

  isActive(questId) {
    const p = this.getProgress(questId);
    return p && p.status === 'active';
  },

  isCompleted(questId) {
    const p = this.getProgress(questId);
    // questProgress is source of truth when entry exists
    if (p) return p.status === 'completed';
    // legacy mirror only if no progress entry yet
    if (this.state?.questStages?.[questId] === '__finished__') return true;
    if (this.state?.flags?.['quest_' + questId] === 'complete') return true;
    return false;
  },

  isFailed(questId) {
    const p = this.getProgress(questId);
    if (p) return p.status === 'failed';
    if (this.state?.questStages?.[questId] === '__failed__') return true;
    if (this.state?.flags?.['quest_' + questId] === 'failed') return true;
    return false;
  },

  /**
   * Start or ensure quest is active at stage 0 (or given index).
   */
  startQuest(questId, opts = {}) {
    const quest = this.getQuestDef(questId);
    if (!quest) return false;
    const store = this.ensureProgressStore();
    if ((this.isCompleted(questId) || this.isFailed(questId)) && !opts.force) return false;

    const existing = store[questId];
    if (existing && existing.status === 'active' && !opts.force) return true;

    const stageIndex = Number(opts.stageIndex) || 0;
    store[questId] = {
      status: 'active',
      stageIndex,
      stages: opts.force ? {} : (existing?.stages || {})
    };
    if (opts.force) store[questId].stages = {};
    this._ensureStageRuntime(questId, stageIndex);
    this._syncLegacyStage(questId);
    this._logStageEnter(questId, stageIndex, opts);
    this._notifyUI();
    return true;
  },

  /** Snapshot of engine state for Task.onActivate (no synthetic events). */
  _worldSnapshot() {
    const s = this.state || {};
    return {
      level: Number(s.level) || 1,
      inventory: Array.isArray(s.inventory) ? s.inventory.slice() : [],
      gold: Number(s.gold) || 0,
      equipped: s.equipped && typeof s.equipped === 'object' ? { ...s.equipped } : {},
      skills: s.skills && typeof s.skills === 'object' ? { ...s.skills } : {},
      skillIncreases: Array.isArray(s.skillIncreases) ? s.skillIncreases.slice() : [],
      visitedLocations: s.visitedLocations && typeof s.visitedLocations === 'object' ? { ...s.visitedLocations } : {},
      flags: s.flags && typeof s.flags === 'object' ? { ...s.flags } : {},
      scene: s.scene || null,
      className: s.className || null
    };
  },

  _ensureStageRuntime(questId, stageIndex) {
    const store = this.ensureProgressStore();
    const qp = store[questId];
    if (!qp) return [];
    if (!qp.stages) qp.stages = {};
    const key = String(stageIndex);
    let tasks;
    const firstBuild = !qp.stages[key];
    if (firstBuild) {
      tasks = this.buildStageTasks(questId, stageIndex, null);
    } else {
      tasks = this.buildStageTasks(questId, stageIndex, qp.stages[key]);
    }
    // Initial state sync once when stage tasks are first built (not on every ensure)
    let activatedComplete = false;
    if (firstBuild && !this._activatingTasks && !this._checkingStage) {
      this._activatingTasks = true;
      try {
        const world = this._worldSnapshot();
        for (const task of tasks) {
          if (task && !task.isCompleted() && typeof task.onActivate === 'function') {
            task.onActivate(world);
          }
          if (task && task.isCompleted()) activatedComplete = true;
        }
      } finally {
        this._activatingTasks = false;
      }
    }
    qp.stages[key] = { tasks: tasks.map((t) => t.serialize()) };
    if (firstBuild && activatedComplete && !this._checkingStage) {
      this._checkingStage = true;
      try {
        this._checkStageCompletion(questId);
      } finally {
        this._checkingStage = false;
      }
    }
    return tasks;
  },

  getLiveTasks(questId) {
    const p = this.getProgress(questId);
    if (!p || p.status !== 'active') return [];
    return this._ensureStageRuntime(questId, p.stageIndex);
  },

  /**
   * Process game event against all active quest tasks.
   */
  handleEvent(event) {
    if (!this.state || !event) return;
    const store = this.ensureProgressStore();
    let any = false;
    for (const [questId, prog] of Object.entries(store)) {
      if (!prog || prog.status !== 'active') continue;
      const tasks = this._ensureStageRuntime(questId, prog.stageIndex);
      let stageChanged = false;
      for (const task of tasks) {
        if (task.isCompleted()) continue;
        const wasCompleted = task.isCompleted();
        const before = task.getProgress();
        task.onEvent(event);
        const after = task.getProgress();
        const nowCompleted = task.isCompleted();
        if (nowCompleted && !wasCompleted) {
          any = true;
          stageChanged = true;
        } else if (after !== before) {
          // прогресс изменился, задача ещё не завершена — обновить журнал/сейв
          any = true;
        }
      }
      // persist task state
      prog.stages[String(prog.stageIndex)] = {
        tasks: tasks.map((t) => t.serialize())
      };
      if (stageChanged || any) {
        this._checkStageCompletion(questId);
      }
    }
    if (any) {
      this._notifyUI();
      if (this.engine?.saveGame) this.engine.saveGame();
    }
  },

  _checkStageCompletion(questId) {
    const p = this.getProgress(questId);
    if (!p || p.status !== 'active') return;
    const tasks = this._ensureStageRuntime(questId, p.stageIndex);
    const quest = this.getQuestDef(questId);
    const stageDef = (quest?.stages || [])[p.stageIndex] || {};
    // Advanced: completionRule 'all' (default) | 'any'
    // Optional tasks excluded from 'all' requirement unless all tasks optional
    const rule = stageDef.completionRule || stageDef.logic || 'all';
    const required = tasks.filter((t) => !t.optional);
    const list = required.length ? required : tasks;
    if (!list.length) return;
    const done = rule === 'any'
      ? list.some((t) => t.isCompleted())
      : list.every((t) => t.isCompleted());
    if (!done) return;

    const stages = quest?.stages || [];

    if (stageDef?.failed) {
      this.failQuest(questId);
      return;
    }

    // log stage complete
    if (this.engine?.log && stageDef?.log) {
      this.engine.log('📜 ' + stageDef.log, 'log-heal');
    }

    if (stageDef?.finish || p.stageIndex >= stages.length - 1) {
      this.completeQuest(questId);
      return;
    }

    // advance
    const next = p.stageIndex + 1;
    p.stageIndex = next;
    this._ensureStageRuntime(questId, next);
    if (typeof QuestEvents !== 'undefined') {
      QuestEvents.emit('StageActivated', {
        questId,
        stageIndex: next,
        stageKey: String(next)
      });
    }
    this._syncLegacyStage(questId);
    this._logStageEnter(questId, next, {});
    if (typeof this.engine?.applyQuestMapUnlocks === 'function') {
      this.engine.applyQuestMapUnlocks(questId, String(next));
    }
    if (typeof this.engine?.checkAchievements === 'function') {
      this.engine.checkAchievements({ type: 'quest_update', questId, stage: String(next) });
    }
  },

  _logStageEnter(questId, stageIndex, opts) {
    if (opts?.silentLog) return;
    const quest = this.getQuestDef(questId);
    const stage = quest?.stages?.[stageIndex];
    if (!stage) return;
    if (this.engine?.log) {
      if (stage.log) this.engine.log('📜 ' + stage.log, 'log-heal');
      else if (stage.hint || stage.title) {
        this.engine.log('💡 ' + (stage.hint || stage.title), 'log-dice');
      }
    }
  },

  completeQuest(questId, opts = {}) {
    const store = this.ensureProgressStore();
    const quest = this.getQuestDef(questId);
    if (!quest) return false;
    const prev = store[questId];
    if (prev?.status === 'completed') return false;

    store[questId] = {
      ...(prev || {}),
      status: 'completed',
      stageIndex: (quest.stages || []).length - 1
    };
    if (this.state.questStages) this.state.questStages[questId] = '__finished__';
    this._syncLegacyFlag(questId, 'complete');

    if (!opts.silentLog && this.engine?.log) {
      this.engine.log('✅ Квест завершён: «' + (quest.title || questId) + '»', 'log-heal');
    }
    if (typeof this.engine?.awardQuestExp === 'function') {
      this.engine.awardQuestExp(questId);
    }
    if (typeof this.engine?.applyQuestNpcReputation === 'function') {
      this.engine.applyQuestNpcReputation(questId);
    }
    // Награды из quest.rewards (gold/items/reputation) — если метод есть
    if (typeof this.engine?.applyQuestRewards === 'function') {
      this.engine.applyQuestRewards(questId);
    }
    if (typeof this.engine?.checkAchievements === 'function') {
      this.engine.checkAchievements({ type: 'quest_update', questId, stage: '__finished__' });
    }
    this._notifyUI();
    if (this.engine?.saveGame) this.engine.saveGame();
    return true;
  },

  failQuest(questId, opts = {}) {
    const store = this.ensureProgressStore();
    const quest = this.getQuestDef(questId);
    const prev = store[questId];
    if (prev?.status === 'failed') return false;

    store[questId] = {
      ...(prev || {}),
      status: 'failed'
    };
    if (this.state.questStages) this.state.questStages[questId] = '__failed__';
    this._syncLegacyFlag(questId, 'failed');

    if (!opts.silentLog && this.engine?.log) {
      const stages = quest?.stages || [];
      const failStage = stages.find((s) => s.failed);
      if (failStage?.log) this.engine.log('❌ ' + failStage.log, 'log-damage');
      else this.engine.log('❌ Квест провален: «' + (quest?.title || questId) + '»', 'log-damage');
    }
    if (typeof this.engine?.checkAchievements === 'function') {
      this.engine.checkAchievements({ type: 'quest_update', questId, stage: '__failed__' });
    }
    this._notifyUI();
    if (this.engine?.saveGame) this.engine.saveGame();
    return true;
  },

  /**
   * Compatibility: set stage by index or legacy key (from old questSet in scenes).
   * Completes tasks of intermediate stages and activates target stage.
   */
  setStage(questId, stageRef, opts = {}) {
    const quest = this.getQuestDef(questId);
    if (!quest) return;
    if ((this.isCompleted(questId) || this.isFailed(questId)) && !opts.force) return;

    const stages = quest.stages || [];
    let index = this.resolveStageIndex(quest, stageRef);

    if (stageRef === 'failed' || stageRef === '__failed__' ||
        (index != null && stages[index]?.failed)) {
      this.startQuest(questId, { silentLog: true, force: !!opts.force });
      this.failQuest(questId, opts);
      return;
    }
    if (!opts.force && (stageRef === 'complete' || stageRef === '__finished__' ||
        (index != null && stages[index]?.finish && index === stages.length - 1))) {
      this.startQuest(questId, { silentLog: true });
      if (index != null) {
        this._forceCompleteStageTasks(questId, index);
        const store = this.ensureProgressStore();
        if (store[questId]) store[questId].stageIndex = index;
      }
      this.completeQuest(questId, opts);
      return;
    }

    if (index == null) index = 0;
    this.startQuest(questId, { stageIndex: 0, silentLog: true, force: !!opts.force });

    const store = this.ensureProgressStore();
    const p = store[questId];
    if (!p) return;

    // Auto-complete previous stages' tasks
    for (let i = 0; i < index; i++) {
      this._forceCompleteStageTasks(questId, i);
    }

    p.status = 'active';
    p.stageIndex = index;
    this._ensureStageRuntime(questId, index);

    // Land on stage only. ManualAdvance does NOT auto-complete on StageActivated —
    // use completeTask / completeCurrentStage / TaskManualComplete.

    // Special: if stage has finish flag and is last, complete
    if (stages[index]?.finish && index >= stages.length - 1) {
      this._forceCompleteStageTasks(questId, index);
      this.completeQuest(questId, opts);
      return;
    }
    if (stages[index]?.failed) {
      this.failQuest(questId, opts);
      return;
    }

    this._syncLegacyStage(questId);
    if (!opts.silentLog) this._logStageEnter(questId, index, opts);
    if (typeof this.engine?.applyQuestMapUnlocks === 'function') {
      this.engine.applyQuestMapUnlocks(questId, String(index));
    }
    if (typeof this.engine?.checkAchievements === 'function') {
      this.engine.checkAchievements({ type: 'quest_update', questId, stage: String(index) });
    }
    this._notifyUI();
    if (this.engine?.saveGame) this.engine.saveGame();
  },

  _forceCompleteStageTasks(questId, stageIndex) {
    const store = this.ensureProgressStore();
    const p = store[questId];
    if (!p) return;
    const tasks = this._ensureStageRuntime(questId, stageIndex);
    tasks.forEach((t) => t.markComplete());
    if (!p.stages) p.stages = {};
    p.stages[String(stageIndex)] = { tasks: tasks.map((t) => t.serialize()) };
  },

  /**
   * Mark current stage tasks complete (or specific) — used when scene signals objective done.
   */
  /**
   * Explicitly complete a task (or all ManualAdvance on current stage).
   * Emits TaskManualComplete so ManualAdvance / other listeners can react.
   */
  completeTask(questId, taskId, opts = {}) {
    const p = this.getProgress(questId);
    if (!p || p.status !== 'active') {
      this.startQuest(questId, { silentLog: true });
    }
    const prog = this.getProgress(questId);
    if (!prog) return false;
    const stageIndex = prog.stageIndex;
    const tasks = this._ensureStageRuntime(questId, stageIndex);
    if (taskId) {
      const task = tasks.find((t) => t && t.id === taskId);
      if (task && !task.isCompleted()) task.markComplete();
    }
    if (typeof QuestEvents !== 'undefined') {
      QuestEvents.emit('TaskManualComplete', {
        questId,
        stageIndex,
        taskId: taskId || null
      });
    }
    // Persist + re-check after event (ManualAdvance may complete via event)
    const live = this._ensureStageRuntime(questId, stageIndex);
    if (!prog.stages) prog.stages = {};
    prog.stages[String(stageIndex)] = { tasks: live.map((t) => t.serialize()) };
    this._checkStageCompletion(questId);
    this._notifyUI();
    if (!opts.silent && this.engine?.saveGame) this.engine.saveGame();
    return true;
  },

  completeCurrentStage(questId, opts = {}) {
    const p = this.getProgress(questId);
    if (!p || p.status !== 'active') {
      this.startQuest(questId, { silentLog: true });
    }
    const prog = this.getProgress(questId);
    if (!prog) return;
    this._forceCompleteStageTasks(questId, prog.stageIndex);
    this._checkStageCompletion(questId);
    this._notifyUI();
  },

  resolveStageIndex(quest, stageRef) {
    if (!quest || stageRef == null || stageRef === '') return null;
    const stages = quest.stages || [];
    const s = String(stageRef);
    if (s === '__finished__' || s === 'complete') {
      const fi = stages.findIndex((st) => st.finish && !st.failed);
      return fi >= 0 ? fi : stages.length - 1;
    }
    if (s === '__failed__' || s === 'failed') {
      const fi = stages.findIndex((st) => st.failed);
      return fi >= 0 ? fi : null;
    }
    const asNum = Number(s);
    if (!Number.isNaN(asNum) && asNum >= 0 && asNum < stages.length) return asNum;
    // match by id / legacyKey
    for (let i = 0; i < stages.length; i++) {
      const st = stages[i];
      if (st.id && String(st.id) === s) return i;
      if (st.legacyId && String(st.legacyId) === s) return i;
      if (st.stageKey && String(st.stageKey) === s) return i;
    }
    if (quest.legacyStageMap && quest.legacyStageMap[s] != null) {
      return this.resolveStageIndex(quest, quest.legacyStageMap[s]);
    }
    return null;
  },

  /** For conditions / old API: current stage key as string index */
  getStageKey(questId) {
    if (this.isCompleted(questId)) return '__finished__';
    if (this.isFailed(questId)) return '__failed__';
    const p = this.getProgress(questId);
    if (p && p.status === 'active') return String(p.stageIndex);
    // fall back to legacy questStages
    const legacy = this.state?.questStages?.[questId];
    if (legacy != null && legacy !== '') return String(legacy);
    const flag = this.state?.flags?.['quest_' + questId];
    if (flag != null && flag !== '') {
      const quest = this.getQuestDef(questId);
      const idx = this.resolveStageIndex(quest, flag);
      return idx != null ? String(idx) : String(flag);
    }
    return null;
  },

  _syncLegacyStage(questId) {
    if (!this.state) return;
    if (!this.state.questStages) this.state.questStages = {};
    const key = this.getStageKey(questId);
    if (key != null) this.state.questStages[questId] = key;
    this._syncLegacyFlag(questId, key);
  },

  _syncLegacyFlag(questId, stageKey) {
    if (!this.state?.flags) return;
    const quest = this.getQuestDef(questId);
    let legacyVal = stageKey;
    if (quest?.legacyStageMap && stageKey != null) {
      const entry = Object.entries(quest.legacyStageMap).find(([, v]) => String(v) === String(stageKey));
      if (entry) legacyVal = entry[0];
    }
    if (stageKey === '__finished__') legacyVal = 'complete';
    if (stageKey === '__failed__') legacyVal = 'failed';
    this.state.flags['quest_' + questId] = legacyVal;
  },

  /**
   * Journal entries for UI.
   * @returns {Array<{ questId, title, status, stageTitle, tasks: Array<{ text, done, progress, target }> }>}
   */

  // ----- Editor / conditions helpers (ex-QuestSystem) -----

  getStageKeys(quest) {
    if (!quest?.stages) return [];
    if (Array.isArray(quest.stages)) {
      return quest.stages.map((_, i) => String(i));
    }
    return Object.keys(quest.stages).sort((a, b) => Number(a) - Number(b));
  },

  /** Resolve stage ref → string key (index) for legacy conditions */
  resolveStageRef(quest, stageRef) {
    const idx = this.resolveStageIndex(quest, stageRef);
    if (idx != null) return String(idx);
    if (stageRef == null || stageRef === '') return null;
    const keys = this.getStageKeys(quest);
    return keys[0] || '0';
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

  isStageFinished(quest, stageKey) {
    const st = this.getStageData(quest, stageKey);
    return !!st?.finish && !st?.failed;
  },

  isStageFailed(quest, stageKey) {
    const st = this.getStageData(quest, stageKey);
    return !!st?.failed;
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

  getJournalEntries() {
    // Source of truth: questProgress only (legacy questStages handled in hydrateFromSave)
    const store = this.ensureProgressStore() || {};
    const out = [];
    for (const [questId, prog] of Object.entries(store)) {
      if (!prog || prog.status !== 'active') continue;
      const quest = this.getQuestDef(questId);
      if (!quest) continue;
      const stage = (quest.stages || [])[prog.stageIndex] || {};
      const tasks = this._ensureStageRuntime(questId, prog.stageIndex);
      out.push({
        questId,
        title: quest.title || questId,
        status: prog.status,
        stageIndex: prog.stageIndex,
        stageTitle: stage.title || stage.hint || '',
        hint: stage.hint || stage.title || '',
        tasks: tasks.map((t) => ({
          id: t.id,
          text: t.getDescription(),
          done: t.isCompleted(),
          progress: t.getProgress(),
          target: t.target
        }))
      });
    }
    return out;
  },

  /**
   * Load path:
   * - Save V2 (questProgress present) → use as source of truth
   * - Save V1 (only questStages / flags.quest_*) → migrate into questProgress
   * After hydrate, Runtime reads only questProgress. questStages is rewritten as mirror.
   */
  hydrateFromSave(engine) {
    this.bind(engine);
    const store = this.ensureProgressStore();
    const hasProgress = store && Object.keys(store).length > 0;

    if (!hasProgress) {
      // V1 migration: questStages + flags → questProgress
      const qs = { ...(engine.state.questStages || {}) };
      const flags = engine.state.flags || {};
      for (const [k, v] of Object.entries(flags)) {
        if (!k.startsWith('quest_')) continue;
        const questId = k.slice(6);
        if (qs[questId] == null || qs[questId] === '') qs[questId] = v;
      }

      for (const [questId, stageKey] of Object.entries(qs)) {
        if (stageKey == null || stageKey === '') continue;
        const finished = stageKey === '__finished__' || stageKey === 'complete';
        const failed = stageKey === '__failed__' || stageKey === 'failed';
        const quest = this.getQuestDef(questId);
        const stages = quest?.stages || [];

        if (finished) {
          const last = Math.max(0, stages.length - 1);
          store[questId] = { status: 'completed', stageIndex: last, stages: {} };
          for (let i = 0; i <= last; i++) this._forceCompleteStageTasks(questId, i);
          continue;
        }
        if (failed) {
          store[questId] = { status: 'failed', stageIndex: 0, stages: {} };
          continue;
        }

        const idx = this.resolveStageIndex(quest, stageKey) ??
          (Number.isFinite(Number(stageKey)) ? Number(stageKey) : 0);
        store[questId] = { status: 'active', stageIndex: idx, stages: {} };
        for (let i = 0; i < idx; i++) this._forceCompleteStageTasks(questId, i);
        this._ensureStageRuntime(questId, idx);
      }
    }

    // Always rebuild questStages mirror from questProgress (compat for old condition readers)
    this._mirrorProgressToLegacyStages();
  },

  /** questProgress → questStages + flags.quest_* (mirror only, not source of truth) */
  _mirrorProgressToLegacyStages() {
    if (!this.state) return;
    if (!this.state.questStages) this.state.questStages = {};
    const store = this.ensureProgressStore() || {};
    for (const [questId, prog] of Object.entries(store)) {
      if (!prog) continue;
      if (prog.status === 'completed') this.state.questStages[questId] = '__finished__';
      else if (prog.status === 'failed') this.state.questStages[questId] = '__failed__';
      else this.state.questStages[questId] = String(prog.stageIndex);
      this._syncLegacyFlag(questId, this.state.questStages[questId]);
    }
  },

  _notifyUI() {
    if (typeof this.engine?.renderActiveQuests === 'function') {
      this.engine.renderActiveQuests();
    }
    if (typeof this.engine?.updateUI === 'function') {
      // avoid deep recursion — only quests panel when possible
    }
  },

  /** Serialize for save */
  serializeAll() {
    return this.ensureProgressStore() || {};
  }
};

if (typeof window !== 'undefined') {
  window.QuestRuntime = QuestRuntime;
}
