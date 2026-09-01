#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const g = { console, Math, Date, String, Number, Array, Object, Set, Map, JSON, module: { exports: {} }, exports: {}, window: {} };
vm.createContext(g); g.window = g;
function load(rel) {
  const code = fs.readFileSync(path.join(root, rel), 'utf8');
  vm.runInContext(
    code + '\nthis.QuestRuntime=typeof QuestRuntime!=="undefined"?QuestRuntime:this.QuestRuntime;' +
    'this.QuestEvents=typeof QuestEvents!=="undefined"?QuestEvents:this.QuestEvents;' +
    'this.QuestTaskRegistry=typeof QuestTaskRegistry!=="undefined"?QuestTaskRegistry:this.QuestTaskRegistry;',
    g, { filename: rel }
  );
}
load('js/quests/task-base.js');
load('js/quests/task-types.js');
load('js/quests/quest-events.js');
load('js/quests/quest-runtime.js');
const { QuestRuntime, QuestEvents, QuestTaskRegistry } = g;
let ok = 0, fail = 0;
function assert(c, m) { if (c) { ok++; console.log('  OK', m); } else { fail++; console.error('  FAIL', m); } }

function eng(tasks) {
  const engine = {
    data: { quests: { q: { stages: [
      { title: 'S0', tasks },
      { title: 'S1', finish: true, tasks: [{ id: 'end', type: 'ManualAdvance' }] }
    ] } } },
    state: { questProgress: {}, questStages: {}, flags: {} },
    log() {}, saveGame() {}, applyQuestNpcReputation() {}, applyQuestRewards() {},
    awardQuestExp() {}, checkAchievements() {}
  };
  QuestRuntime.bind(engine);
  QuestRuntime.startQuest('q');
  return engine;
}

console.log('H2 DeliverItem');
{
  eng([{ id: 'd', type: 'DeliverItem', itemId: 'bag', count: 3 }]);
  QuestEvents.emit('ItemDelivered', { itemId: 'bag', qty: 1 });
  let t = QuestRuntime.getLiveTasks('q')[0];
  assert(t.getProgress() === 1, 'Deliver 1 → progress 1');

  QuestEvents.emit('ItemDelivered', { itemId: 'bag', qty: 2 });
  t = QuestRuntime.getLiveTasks('q')[0];
  // may have advanced stage if complete
  const saved = QuestRuntime.getProgress('q').stages['0'].tasks[0];
  assert(saved._progress >= 3 || saved._completed, 'Deliver +2 more → progress 3 / complete');
}

{
  eng([{ id: 'd', type: 'DeliverItem', itemId: 'bag', count: 1 }]);
  // simulate remove then deliver — only ItemDelivered counts
  QuestEvents.emit('ItemRemoved', { itemId: 'bag' });
  QuestEvents.emit('ItemDelivered', { itemId: 'bag', qty: 1 });
  const saved = QuestRuntime.getProgress('q').stages['0'].tasks[0];
  assert(saved._progress === 1 || saved._completed, 'remove+deliver → progress 1 not 2');
  assert(saved._progress !== 2, 'no double count');
}

console.log('ManualAdvance getDescription');
{
  eng([{ id: 'm', type: 'ManualAdvance' }]);
  QuestRuntime.startQuest('q');
  const t = QuestRuntime.getLiveTasks('q')[0];
  assert(t && /вручную|Продолжить/i.test(t.getDescription()), 'generic ManualAdvance description');
  assert(!/Посетить/i.test(t.getDescription()), 'not VisitLocation text');
  eng([{ id: 'm2', type: 'ManualAdvance', description: 'Custom step' }]);
  QuestRuntime.startQuest('q');
  const t2 = QuestRuntime.getLiveTasks('q')[0];
  assert(t2.getDescription() === 'Custom step', 'custom description preserved');
}

console.log('H1 ManualAdvance');
{
  eng([{ id: 'm', type: 'ManualAdvance', description: 'Do the thing' }]);
  // StageActivated for current stage must NOT complete
  QuestEvents.emit('StageActivated', { questId: 'q', stageIndex: 0, stageKey: '0' });
  let t = QuestRuntime.getLiveTasks('q')[0];
  assert(!t.isCompleted(), 'StageActivated → ManualAdvance still incomplete');

  QuestRuntime.completeTask('q', 'm', { silent: true });
  const saved = QuestRuntime.getProgress('q').stages['0'].tasks.find((x) => x.id === 'm');
  assert(saved && saved._completed, 'completeTask → ManualAdvance complete');
}

{
  eng([{ id: 'm', type: 'ManualAdvance' }]);
  QuestEvents.emit('TaskManualComplete', { questId: 'q', stageIndex: 0 });
  const saved = QuestRuntime.getProgress('q').stages['0'].tasks[0];
  assert(saved._completed, 'TaskManualComplete stage-wide → complete');
}

console.log('\nResults', ok, 'passed', fail, 'failed');
process.exit(fail ? 1 : 0);
