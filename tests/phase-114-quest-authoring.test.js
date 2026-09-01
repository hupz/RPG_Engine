#!/usr/bin/env node
/**
 * Phase 1.14 — Quest Authoring 2.0
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log('  ✓', msg);
  } else {
    failed++;
    console.error('  ✗', msg);
  }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function loadQuestStack() {
  const ctx = { console, module: { exports: {} }, globalThis: null, window: null, GameEngine: null, ActionRunner: { runV2() {} } };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/quests/task-base.js'), ctx);
  vm.runInContext(read('js/quests/task-types.js'), ctx);
  vm.runInContext(read('js/quests/quest-events.js'), ctx);
  vm.runInContext(read('js/quests/quest-runtime.js'), ctx);
  vm.runInContext(read('js/quests/quest-stage-actions-bridge.js'), ctx);
  return ctx;
}

function loadIndex() {
  const ctx = { module: { exports: {} }, globalThis: null, window: null, console };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/editor/editor-quest-authoring-index.js'), ctx);
  return ctx.QuestAuthoringIndex || ctx.module.exports;
}

console.log('Phase 1.14 — create quest / stages');

{
  const IDX = loadIndex();
  const q = IDX.createQuestTemplate('find_sword', 'Find Sword', 'Bring the blade', 3);
  assert(IDX.validateQuestShape(q), 'quest template valid');
  assert(q.stages.length === 3, 'three stages');
  assert(q.stages[2].finish === true, 'last stage finish');
  assert(q.stages[0].tasks[0].type === 'TalkToNPC', 'first stage talk task');
}

console.log('\nPhase 1.14 — flow summary / start sources');

{
  const IDX = loadIndex();
  const data = {
    quests: {
      q1: {
        id: 'q1',
        title: 'Q1',
        stages: [
          { id: 's0', title: 'Start', tasks: [{ type: 'TalkToNPC', npcId: 'bob' }], completionRule: 'all' },
          { id: 's1', title: 'Done', tasks: [{ type: 'ManualAdvance' }], finish: true }
        ]
      }
    },
    scenes: {
      village: {
        choices: [{ text: 'Start', questSet: { questId: 'q1', stage: '0' } }],
        visual: {
          nodes: [{
            id: 'hs1',
            events: { click: [{ action: 'update_quest', params: { questId: 'q1', stage: '1' } }] }
          }]
        }
      }
    }
  };
  const flow = IDX.buildQuestFlowSummary(data.quests.q1);
  assert(flow.length === 2, 'flow two stages');
  assert(flow[0].nextTitle === 'Done', 'stage transition label');

  const sources = IDX.collectQuestStartSources(data, 'q1');
  assert(sources.some((s) => s.kind === 'choice'), 'dialogue/choice starts quest');
  assert(sources.some((s) => s.kind === 'visual_click'), 'visual starts quest');
}

console.log('\nPhase 1.14 — stage transition QuestRuntime SoT');

{
  const ctx = loadQuestStack();
  const { QuestRuntime, QuestEvents } = ctx;
  const engine = {
    data: {
      quests: {
        q: {
          title: 'Q',
          stages: [
            { title: 'A', tasks: [{ id: 't1', type: 'TalkToNPC', npcId: 'x' }] },
            { title: 'B', tasks: [{ id: 't2', type: 'ManualAdvance' }], finish: true }
          ]
        }
      }
    },
    state: { questProgress: {}, questStages: {}, flags: {}, inventory: [], gold: 0 },
    log() {}, saveGame() {}, applyQuestNpcReputation() {}, applyQuestRewards() {}, awardQuestExp() {}, checkAchievements() {}
  };
  ctx.GameEngine = engine;
  QuestRuntime.bind(engine);
  QuestRuntime.startQuest('q');
  assert(engine.state.questProgress.q.status === 'active', 'quest active');
  QuestEvents.emit('NPCTalked', { npcId: 'x' });
  assert(QuestRuntime.getProgress('q').stageIndex >= 0, 'progress in questProgress');
  assert(!read('js/quests/quest-runtime.js').includes('entryActions'), 'QuestRuntime unchanged');
}

console.log('\nPhase 1.14 — stage actions bridge');

{
  const ctx = loadQuestStack();
  const { QuestRuntime, QuestEvents } = ctx;
  let ran = 0;
  const engine = {
    data: {
      quests: {
        q: {
          stages: [
            { title: 'A', entryActions: [{ action: 'add_gold', params: { amount: 5 } }], tasks: [{ id: 't', type: 'ManualAdvance' }] },
            { title: 'B', rewardActions: [{ action: 'add_gold', params: { amount: 3 } }], tasks: [{ id: 't2', type: 'ManualAdvance' }], finish: true }
          ]
        }
      }
    },
    state: { questProgress: {}, flags: {}, inventory: [], gold: 0 },
    log() {}, saveGame() {}, applyQuestNpcReputation() {}, applyQuestRewards() {}, awardQuestExp() {}, checkAchievements() {},
    runAction() { ran++; }
  };
  ctx.GameEngine = engine;
  ctx.ActionRunner = { runV2(eng, action) { if (action === 'add_gold') ran++; } };
  QuestRuntime.bind(engine);
  QuestRuntime.setStage('q', 0, { silentLog: true });
  QuestEvents.emit('StageActivated', { questId: 'q', stageIndex: 0 });
  assert(ran >= 1, 'entry action on stage activate');
}

console.log('\nPhase 1.14 — migrate preserves stage actions');

{
  const ctx = { console, module: { exports: {} }, globalThis: null, window: null, QuestTaskRegistry: { get: () => null } };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/quests/task-base.js'), ctx);
  vm.runInContext(read('js/quests/task-types.js'), ctx);
  vm.runInContext(read('js/quests/quest-migrate.js'), ctx);
  const QM = ctx.QuestMigrate;
  const out = QM.normalizeV2('q', {
    title: 'T',
    stages: [{
      title: 'S',
      entryActions: [{ action: 'update_quest', params: { questId: 'q', stage: '1' } }],
      rewardActions: [{ action: 'add_gold', params: { amount: 1 } }],
      tasks: [{ type: 'ManualAdvance', id: 't' }]
    }]
  });
  assert(Array.isArray(out.stages[0].entryActions), 'entryActions preserved');
  assert(Array.isArray(out.stages[0].rewardActions), 'rewardActions preserved');
}

console.log('\nPhase 1.14 — editor wiring / update_quest stage picker');

{
  const html = read('editor.html');
  const phase = read('js/editor/editor-quest-authoring-phase-114.js');
  const catalog = read('js/editor/editor-action-catalog.js');
  assert(html.includes('editor-quest-authoring-phase-114.js'), 'phase script wired');
  assert(phase.includes('openQuestCreationWorkflow'), 'creation workflow');
  assert(phase.includes('renderQuestStageAuthoringExtra'), 'stage editor extra');
  assert(phase.includes('openUnifiedActionPicker'), 'action catalog integration');
  assert(phase.includes('renderConditionBuilder'), 'condition catalog integration');
  assert(catalog.includes("type: 'questStage'"), 'update_quest stage dropdown type');
  assert(read('index.html').includes('quest-stage-actions-bridge.js'), 'bridge in game index');
}

console.log('\n' + (failed ? 'FAILED' : 'PASSED') + ': ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
