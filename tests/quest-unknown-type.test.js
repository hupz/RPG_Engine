#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const g = {
  console, Math, Date, String, Number, Array, Object, Set, Map, JSON, Error,
  module: { exports: {} }, exports: {}, window: {}
};
vm.createContext(g); g.window = g;
function load(rel) {
  const code = fs.readFileSync(path.join(root, rel), 'utf8');
  vm.runInContext(code + `
    if (typeof QuestTaskRegistry !== 'undefined') this.QuestTaskRegistry = QuestTaskRegistry;
    if (typeof UnknownQuestTaskTypeError !== 'undefined') this.UnknownQuestTaskTypeError = UnknownQuestTaskTypeError;
    if (typeof UnknownTaskType !== 'undefined') this.UnknownTaskType = UnknownTaskType;
    if (typeof QuestRuntime !== 'undefined') this.QuestRuntime = QuestRuntime;
    if (typeof QuestEvents !== 'undefined') this.QuestEvents = QuestEvents;
  `, g, { filename: rel });
}
load('js/quests/task-base.js');
load('js/quests/task-types.js');
load('js/quests/quest-events.js');
load('js/quests/quest-runtime.js');

const { QuestTaskRegistry, UnknownQuestTaskTypeError, UnknownTaskType, QuestRuntime } = g;
let ok = 0, fail = 0;
function assert(c, m) { if (c) { ok++; console.log('OK', m); } else { fail++; console.error('FAIL', m); } }

console.log('1. Known type');
{
  const t = QuestTaskRegistry.create({ type: 'KillEnemy', enemyId: 'wolf', count: 2 }, { questId: 'q', stageIndex: 0 });
  assert(t && t.type === 'KillEnemy', 'KillEnemy instance');
  assert(t.constructor.typeId === 'KillEnemy', 'class KillEnemy');
}

console.log('2. Explicit ManualAdvance');
{
  const t = QuestTaskRegistry.create({ type: 'ManualAdvance', description: 'x' }, { questId: 'q', stageIndex: 0 });
  assert(t && t.type === 'ManualAdvance', 'ManualAdvance only when explicit');
}

console.log('3. Unknown type throws');
{
  let threw = null;
  try {
    QuestTaskRegistry.create({ type: 'KillEnemyXYZ', id: 't1' }, { questId: 'quest_a', stageIndex: 2 });
  } catch (e) {
    threw = e;
  }
  assert(threw && threw.name === 'UnknownQuestTaskTypeError', 'throws UnknownQuestTaskTypeError');
  assert(threw.questId === 'quest_a', 'error has questId');
  assert(threw.stageIndex === 2, 'error has stageIndex');
  assert(threw.typeId === 'KillEnemyXYZ', 'error has typeId');
  assert(threw.taskData && threw.taskData.type === 'KillEnemyXYZ', 'error has taskData');
}

console.log('4. validateTaskType');
{
  const good = QuestTaskRegistry.validateTaskType('TalkToNPC');
  assert(good.ok === true, 'TalkToNPC ok');
  const bad = QuestTaskRegistry.validateTaskType('NoSuchType');
  assert(bad.ok === false && /Неизвестный/.test(bad.error), 'unknown type message');
  const empty = QuestTaskRegistry.validateTaskType('');
  assert(empty.ok === false, 'empty type fails');
}

console.log('5. Placeholder preserves type (migration path)');
{
  const t = QuestTaskRegistry.create(
    { type: 'AncientCustomTask', id: 'old1', foo: 1 },
    { questId: 'legacy', stageIndex: 0 },
    { placeholder: true }
  );
  assert(t instanceof UnknownTaskType || t.constructor.typeId === '__unknown__', 'placeholder class');
  assert(!t.isCompleted(), 'never completes');
  const ser = t.serialize();
  assert(ser.type === 'AncientCustomTask' || ser._unknownType === 'AncientCustomTask', 'preserves original type in serialize');
  assert(ser._isUnknown === true, 'marks unknown');
}

console.log('6. Runtime buildStageTasks with unknown type');
{
  const engine = {
    data: { quests: { q: { stages: [{ tasks: [{ id: 't', type: 'GhostType', x: 1 }] }] } } },
    state: { questProgress: {}, questStages: {}, flags: {} },
    log() {}, saveGame() {}
  };
  QuestRuntime.bind(engine);
  QuestRuntime.startQuest('q');
  const tasks = QuestRuntime.getLiveTasks('q');
  assert(tasks.length === 1, 'one task');
  assert(!tasks[0].isCompleted(), 'unknown not completed');
  const desc = tasks[0].getDescription();
  assert(/Неизвестный|GhostType/i.test(desc), 'description shows unknown: ' + desc);
}

console.log('\nResults', ok, 'passed', fail, 'failed');
process.exit(fail ? 1 : 0);
