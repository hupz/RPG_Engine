/**
 * Phase 1.14 — Quest authoring index (pure, testable)
 */
(function attachQuestAuthoringIndex(global) {
  'use strict';

  function validateQuestShape(quest) {
    if (!quest || typeof quest !== 'object') return false;
    if (!Array.isArray(quest.stages) || !quest.stages.length) return false;
    return quest.stages.every((st) => st && Array.isArray(st.tasks));
  }

  function buildQuestFlowSummary(quest) {
    const stages = Array.isArray(quest?.stages) ? quest.stages : [];
    return stages.map((st, i) => {
      const tasks = Array.isArray(st.tasks) ? st.tasks : [];
      const next = stages[i + 1];
      return {
        index: i,
        id: st.id || ('stage_' + i),
        title: st.title || st.hint || ('Этап ' + (i + 1)),
        description: st.description || st.log || '',
        finish: !!st.finish,
        failed: !!st.failed,
        completionRule: st.completionRule || 'all',
        taskCount: tasks.length,
        taskLabels: tasks.map((t) => t.description || t.type || 'task'),
        entryActionCount: Array.isArray(st.entryActions) ? st.entryActions.length : 0,
        rewardActionCount: Array.isArray(st.rewardActions) ? st.rewardActions.length : 0,
        hasStartConditions: !!(st.startConditions && typeof st.startConditions === 'object'),
        nextTitle: next ? (next.title || next.hint || ('Этап ' + (i + 2))) : (st.finish ? 'Complete' : null)
      };
    });
  }

  function collectQuestStartSources(data, questId) {
    const sources = [];
    if (!data || !questId) return sources;

    Object.entries(data.scenes || {}).forEach(([sceneId, sc]) => {
      (sc.choices || []).forEach((c, ci) => {
        if (c?.questSet?.questId === questId) {
          sources.push({
            kind: 'choice',
            sceneId,
            label: c.text || ('choice ' + ci),
            stage: c.questSet.stage,
            choiceIndex: ci
          });
        }
      });
      (sc.visual?.nodes || []).forEach((node) => {
        ['click', 'hover', 'enter'].forEach((evKey) => {
          (node.events?.[evKey] || []).forEach((step, si) => {
            if (step?.action === 'update_quest' && step.params?.questId === questId) {
              sources.push({
                kind: 'visual_' + evKey,
                sceneId,
                nodeId: node.id,
                label: node.props?.label || node.id,
                stage: step.params.stage,
                stepIndex: si
              });
            }
          });
        });
      });
      (sc.events?.enter || []).forEach((step, si) => {
        if (step?.action === 'update_quest' && step.params?.questId === questId) {
          sources.push({
            kind: 'scene_enter',
            sceneId,
            label: 'enter',
            stage: step.params.stage,
            stepIndex: si
          });
        }
      });
      (sc.components || []).forEach((comp, ci) => {
        const topics = comp?.params?.topics;
        if (!Array.isArray(topics)) return;
        topics.forEach((t, ti) => {
          if (typeof t === 'object' && t.questSet?.questId === questId) {
            sources.push({
              kind: 'dialogue_topic',
              sceneId,
              componentIndex: ci,
              topicIndex: ti,
              label: t.label || t.id,
              stage: t.questSet.stage
            });
          }
        });
      });
    });

    return sources;
  }

  function createQuestTemplate(id, title, description, stageCount) {
    const n = Math.max(1, Math.min(8, stageCount || 3));
    const stages = [];
    for (let i = 0; i < n; i++) {
      const isLast = i === n - 1;
      stages.push({
        id: 'stage_' + i,
        title: isLast ? 'Завершение' : ('Этап ' + (i + 1)),
        hint: isLast ? 'Получите награду' : ('Шаг ' + (i + 1)),
        description: '',
        finish: isLast,
        failed: false,
        completionRule: 'all',
        tasks: [{
          id: id + '_s' + i + '_t0',
          type: isLast ? 'ManualAdvance' : 'TalkToNPC',
          description: isLast ? 'Завершить квест' : 'Выполнить задачу'
        }]
      });
    }
    return {
      id,
      title,
      description: description || '',
      hidden: false,
      questFormat: 2,
      rewards: { gold: 0, exp: 0 },
      stages
    };
  }

  function scanConditionForQuest(cond, questId, sink, ctx) {
    if (!cond || typeof cond !== 'object') return;
    const rules = Array.isArray(cond.all)
      ? cond.all
      : (Array.isArray(cond.any) ? cond.any : (Array.isArray(cond) ? cond : [cond]));
    rules.forEach((rule, ri) => {
      if (!rule || typeof rule !== 'object') return;
      if (Array.isArray(rule.all) || Array.isArray(rule.any)) {
        scanConditionForQuest(rule, questId, sink, ctx);
        return;
      }
      ['questMinStage', 'questMaxStage', 'questStage'].forEach((key) => {
        const ref = rule[key];
        if (!ref) return;
        const qid = typeof ref === 'object' ? ref.questId : null;
        if (qid === questId) {
          sink.push({
            kind: 'condition',
            sceneId: ctx.sceneId || null,
            label: key,
            stage: typeof ref === 'object' ? ref.stage : undefined,
            path: ctx.path + '.' + key + '[' + ri + ']'
          });
        }
      });
    });
  }

  /**
   * Where a quest is used: scenes / actions / conditions / dialogue / questSet.
   */
  function collectQuestUsages(data, questId) {
    const usages = [];
    if (!data || !questId) return usages;

    collectQuestStartSources(data, questId).forEach((s) => {
      usages.push(Object.assign({ category: 'start' }, s));
    });

    Object.entries(data.scenes || {}).forEach(([sceneId, sc]) => {
      (sc.choices || []).forEach((c, ci) => {
        if (c?.showIf) {
          scanConditionForQuest(c.showIf, questId, usages, {
            sceneId,
            path: 'scenes.' + sceneId + '.choices[' + ci + '].showIf'
          });
        }
        // questSet already in start sources; still mark as action-ish if stage complete
        if (c?.questSet?.questId === questId && String(c.questSet.stage) === 'complete') {
          usages.push({
            kind: 'choice_complete',
            category: 'action',
            sceneId,
            label: c.text || ('choice ' + ci),
            stage: 'complete'
          });
        }
      });
      (sc.visual?.nodes || []).forEach((node) => {
        if (node.showIf) {
          scanConditionForQuest(node.showIf, questId, usages, {
            sceneId,
            path: 'scenes.' + sceneId + '.visual.' + (node.id || '?')
          });
        }
        ['click', 'hover', 'enter', 'exit'].forEach((evKey) => {
          (node.events?.[evKey] || []).forEach((step) => {
            if (step?.action === 'update_quest' && step.params?.questId === questId) {
              // may already be in start sources — keep as action category too if not stage 0
              if (String(step.params.stage) !== '0') {
                usages.push({
                  kind: 'visual_action',
                  category: 'action',
                  sceneId,
                  nodeId: node.id,
                  label: (step.action || 'update_quest') + ' → ' + step.params.stage,
                  stage: step.params.stage
                });
              }
            }
          });
        });
      });
      (sc.components || []).forEach((comp, ci) => {
        (comp?.params?.topics || []).forEach((t, ti) => {
          if (t?.showIf) {
            scanConditionForQuest(t.showIf, questId, usages, {
              sceneId,
              path: 'scenes.' + sceneId + '.components[' + ci + '].topics[' + ti + ']'
            });
          }
          (t?.actions || []).forEach((step) => {
            if (step?.action === 'update_quest' && step.params?.questId === questId) {
              usages.push({
                kind: 'dialogue_action',
                category: 'action',
                sceneId,
                label: t.label || 'topic',
                stage: step.params.stage
              });
            }
          });
        });
      });
      ['enter', 'exit'].forEach((ev) => {
        (sc.events?.[ev] || []).forEach((step) => {
          if (step?.action === 'update_quest' && step.params?.questId === questId) {
            usages.push({
              kind: 'scene_event',
              category: 'action',
              sceneId,
              label: ev,
              stage: step.params.stage
            });
          }
        });
      });
    });

    // Dedupe by kind+sceneId+label+stage
    const seen = new Set();
    return usages.filter((u) => {
      const key = [u.kind, u.sceneId, u.label, u.stage, u.path].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Sidebar overview row — authoring status (not runtime questProgress).
   */
  function buildQuestOverviewEntry(questId, quest, data) {
    const stages = Array.isArray(quest?.stages) ? quest.stages : [];
    const starts = collectQuestStartSources(data, questId);
    const hasFinish = stages.some((st) => st && st.finish);
    const shapeOk = validateQuestShape(quest);
    let status = 'draft';
    if (!shapeOk) status = 'invalid';
    else if (starts.length && hasFinish) status = 'wired';
    else if (stages.length) status = 'authored';
    return {
      id: questId,
      title: quest?.title || questId,
      stageCount: stages.length,
      status,
      startCount: starts.length,
      hasFinish,
      shapeOk
    };
  }

  /** Friendly presets → still emit registry update_quest JSON */
  function getQuestActionPresets() {
    return [
      {
        id: 'quest_start',
        label: 'Start Quest',
        hint: 'update_quest → stage 0',
        steps: [{ action: 'update_quest', params: { questId: '', stage: '0' } }]
      },
      {
        id: 'quest_advance',
        label: 'Advance Quest',
        hint: 'update_quest → next stage',
        steps: [{ action: 'update_quest', params: { questId: '', stage: '1' } }]
      },
      {
        id: 'quest_complete',
        label: 'Complete Quest',
        hint: 'update_quest → complete',
        steps: [{ action: 'update_quest', params: { questId: '', stage: 'complete' } }]
      }
    ];
  }

  const api = {
    validateQuestShape,
    buildQuestFlowSummary,
    collectQuestStartSources,
    collectQuestUsages,
    buildQuestOverviewEntry,
    getQuestActionPresets,
    createQuestTemplate
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof global !== 'undefined') {
    global.QuestAuthoringIndex = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global);
