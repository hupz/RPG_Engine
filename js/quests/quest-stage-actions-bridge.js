/**
 * Phase 1.14 — Optional stage entry/reward actions (NOT QuestRuntime).
 * Listens QuestEvents.StageActivated + quest completion transitions.
 */
(function attachQuestStageActionsBridge() {
  'use strict';

  if (typeof QuestEvents === 'undefined') return;

  const prevStatus = Object.create(null);

  function getEngine() {
    return typeof GameEngine !== 'undefined' ? GameEngine : null;
  }

  function runSteps(engine, steps) {
    if (!engine || !Array.isArray(steps)) return;
    steps.forEach((step) => {
      if (!step?.action) return;
      if (typeof ActionRunner !== 'undefined' && ActionRunner.runV2) {
        ActionRunner.runV2(engine, step.action, step.params || {}, { source: 'quest_stage' });
      } else if (typeof engine.runAction === 'function') {
        engine.runAction(step.action, step.params || {});
      } else if (step.action === 'update_quest' && typeof engine.updateQuest === 'function') {
        engine.updateQuest(step.params?.questId, step.params?.stage);
      }
    });
  }

  function runStageActions(quest, stageIndex, field) {
    const engine = getEngine();
    if (!engine || !quest) return;
    const st = quest.stages?.[stageIndex];
    if (!st) return;
    runSteps(engine, st[field]);
  }

  function onStageActivated(payload) {
    const questId = payload?.questId;
    const stageIndex = Number(payload?.stageIndex);
    if (!questId || !Number.isFinite(stageIndex)) return;
    const engine = getEngine();
    const quest = engine?.data?.quests?.[questId];
    if (!quest) return;
    if (stageIndex > 0) runStageActions(quest, stageIndex - 1, 'rewardActions');
    runStageActions(quest, stageIndex, 'entryActions');
  }

  function onAnyQuestEvent() {
    const engine = getEngine();
    if (!engine?.state?.questProgress) return;
    Object.entries(engine.state.questProgress).forEach(([questId, prog]) => {
      const was = prevStatus[questId];
      const now = prog?.status;
      if (was !== 'completed' && now === 'completed') {
        const quest = engine.data?.quests?.[questId];
        const lastIdx = (quest?.stages?.length || 1) - 1;
        if (lastIdx >= 0) runStageActions(quest, lastIdx, 'rewardActions');
      }
      prevStatus[questId] = now;
    });
  }

  QuestEvents.on((event) => {
    if (event?.type === 'StageActivated') onStageActivated(event.payload);
    onAnyQuestEvent();
  });
})();
