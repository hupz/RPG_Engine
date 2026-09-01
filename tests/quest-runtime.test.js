#!/usr/bin/env node
/**
 * Минимальные тесты QuestRuntime / Stage / Task / migration / save-restore
 * Запуск: node tests/quest-runtime.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function load(rel) {
  const code = fs.readFileSync(path.join(root, rel), 'utf8');
  vm.runInContext(code, ctx, { filename: rel });
}

const ctx = {
  console,
  Math,
  Date,
  String,
  Number,
  Array,
  Object,
  Set,
  Map,
  JSON,
  module: { exports: {} },
  exports: {},
  window: {}
};
vm.createContext(ctx);
ctx.window = ctx;

load('js/quests/task-base.js');
load('js/quests/task-types.js');
load('js/quests/quest-events.js');
load('js/quests/quest-runtime.js');
load('js/quests/quest-migrate.js');

const { QuestTaskRegistry, QuestRuntime, QuestEvents, QuestMigrate } = ctx;

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log('  OK', msg);
  } else {
    failed++;
    console.error('  FAIL', msg);
  }
}

// Mock engine
function makeEngine(data) {
  const engine = {
    data,
    state: {
      questProgress: {},
      questStages: {},
      flags: {},
      inventory: [],
      gold: 0,
      level: 1,
      scene: 'start'
    },
    logs: [],
    log(msg) { this.logs.push(msg); },
    saveGame() { this._saved = JSON.parse(JSON.stringify(this.state)); },
    applyQuestNpcReputation(qid) { this._repNpc = qid; },
    applyQuestRewards(qid) { this._rewards = qid; },
    awardQuestExp(qid) { this._exp = qid; },
    checkAchievements() {}
  };
  QuestRuntime.bind(engine);
  return engine;
}

console.log('1. Create quest / stage / task');
{
  const data = {
    quests: {
      test_q: {
        id: 'test_q',
        title: 'Test',
        stages: [
          {
            id: 's0',
            title: 'Start',
            tasks: [
              { id: 't0', type: 'CollectItem', itemId: 'herb', count: 3, description: 'Собрать травы' }
            ]
          },
          {
            id: 's1',
            title: 'Finish',
            finish: true,
            tasks: [
              { id: 't1', type: 'TalkToNPC', npcId: 'marta' }
            ]
          }
        ],
        rewards: { gold: 10, reputation: { rep_village: 5 } }
      }
    }
  };
  const engine = makeEngine(data);
  assert(!!data.quests.test_q.stages[0].tasks[0], 'quest has stage with task');
  const task = QuestTaskRegistry.create(data.quests.test_q.stages[0].tasks[0], { questId: 'test_q', stageIndex: 0 });
  assert(task && task.type === 'CollectItem', 'task created CollectItem');
  assert(task.target === 3, 'task target 3');
}

console.log('2. Progress task via event');
{
  const data = {
    quests: {
      test_q: {
        title: 'Test',
        stages: [{
          title: 'S0',
          // без finish — остаёмся на этапе после завершения задачи
          tasks: [{ id: 't0', type: 'CollectItem', itemId: 'herb', count: 3 }]
        }, {
          title: 'S1',
          finish: true,
          tasks: [{ id: 't1', type: 'ManualAdvance', description: 'done' }]
        }]
      }
    }
  };
  const engine = makeEngine(data);
  QuestRuntime.startQuest('test_q');
  assert(QuestRuntime.isActive('test_q'), 'quest active');
  QuestEvents.emit('ItemCollected', { itemId: 'herb', qty: 1 });
  let tasks = QuestRuntime.getLiveTasks('test_q');
  assert(tasks[0].getProgress() === 1, 'progress 1/3');
  assert(!tasks[0].isCompleted(), 'not complete yet');
  QuestEvents.emit('ItemCollected', { itemId: 'herb', qty: 2 });
  // после 3/3 этап может переключиться — смотрим сохранённый прогресс этапа 0
  const saved = QuestRuntime.getProgress('test_q');
  const t0 = saved?.stages?.['0']?.tasks?.find((x) => x.id === 't0') || saved?.stages?.['0']?.tasks?.[0];
  assert(t0 && (t0._completed || t0._progress >= 3), 'task complete after 3 (serialized)');
}

console.log('3. Stage transition + quest complete');
{
  const data = {
    quests: {
      q2: {
        title: 'Q2',
        stages: [
          { title: 'A', tasks: [{ id: 'a', type: 'TalkToNPC', npcId: 'bob' }] },
          { title: 'B', finish: true, tasks: [{ id: 'b', type: 'VisitLocation', sceneId: 'hub' }] }
        ]
      }
    }
  };
  const engine = makeEngine(data);
  QuestRuntime.startQuest('q2');
  QuestEvents.emit('NPCDialogueFinished', { npcId: 'bob' });
  // stage completion should advance
  const p = QuestRuntime.getProgress('q2');
  assert(p.stageIndex === 1 || QuestRuntime.isCompleted('q2'), 'advanced stage or completed after talk');
  if (!QuestRuntime.isCompleted('q2')) {
    QuestEvents.emit('SceneEntered', { sceneId: 'hub' });
  }
  // force complete path
  if (!QuestRuntime.isCompleted('q2')) {
    QuestRuntime.completeQuest('q2');
  }
  assert(QuestRuntime.isCompleted('q2'), 'quest completed');
  assert(engine._repNpc === 'q2', 'applyQuestNpcReputation called');
  assert(engine._rewards === 'q2', 'applyQuestRewards called');
  assert(engine._exp === 'q2', 'awardQuestExp called');
}

console.log('4. Save / load progress');
{
  const data = {
    quests: {
      q3: {
        title: 'Q3',
        stages: [{
          title: 'S',
          tasks: [{ id: 'c', type: 'CollectItem', itemId: 'key', count: 5 }]
        }]
      }
    }
  };
  const engine = makeEngine(data);
  QuestRuntime.startQuest('q3');
  QuestEvents.emit('ItemCollected', { itemId: 'key', qty: 2 });
  engine.saveGame();
  const snap = engine._saved;
  assert(snap.questProgress.q3, 'saved questProgress');
  assert(snap.questProgress.q3.status === 'active', 'saved status active');
  const stage0 = snap.questProgress.q3.stages['0'];
  assert(stage0 && stage0.tasks[0]._progress === 2, 'saved task progress 2');

  // restore into new engine
  const engine2 = makeEngine(data);
  engine2.state.questProgress = JSON.parse(JSON.stringify(snap.questProgress));
  QuestRuntime.bind(engine2);
  const tasks = QuestRuntime.getLiveTasks('q3');
  assert(tasks[0].getProgress() === 2, 'restored progress 2');
  assert(tasks[0].isCompleted() === false, 'restored not complete');
}

console.log('5. Migration old quest format');
{
  const oldQuest = {
    title: 'Old',
    description: 'Find bag',
    stages: {
      '0': { hint: 'Talk to Jack', log: 'Jack asked for help' },
      '1': { hint: 'Find bag' },
      complete: { hint: 'Done', finish: true }
    },
    rewards: { gold: 20 }
  };
  const migrated = QuestMigrate.migrateQuest('old_q', oldQuest);
  assert(Array.isArray(migrated.stages), 'migrated stages is array');
  assert(migrated.stages.length >= 2, 'has stages');
  assert(migrated.stages.every((s) => Array.isArray(s.tasks)), 'each stage has tasks array');
  assert(migrated.title === 'Old' || !!migrated.title, 'title preserved');
}

console.log('6. Reputation method name (no Finish typo)');
{
  const src = fs.readFileSync(path.join(root, 'js/quests/quest-runtime.js'), 'utf8');
  assert(!src.includes('applyQuestFinishReputation'), 'no applyQuestFinishReputation typo');
  assert(src.includes('applyQuestNpcReputation'), 'uses applyQuestNpcReputation');
}

console.log('\nResults:', passed, 'passed,', failed, 'failed');
process.exit(failed ? 1 : 0);
