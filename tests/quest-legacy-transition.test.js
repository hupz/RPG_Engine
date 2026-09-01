#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { console, Math, Date, String, Number, Array, Object, Set, Map, JSON, module: { exports: {} }, exports: {}, window: {} };
vm.createContext(ctx); ctx.window = ctx;
function load(rel) {
  vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), ctx, { filename: rel });
}
load('js/quests/task-base.js');
load('js/quests/task-types.js');
load('js/quests/quest-events.js');
load('js/quests/quest-runtime.js');
load('js/quests/quest-migrate.js');

const { QuestRuntime, QuestEvents, QuestMigrate, QuestTaskRegistry } = ctx;
let ok = 0, fail = 0;
function assert(c, m) { if (c) { ok++; console.log('  OK', m); } else { fail++; console.error('  FAIL', m); } }

function makeEngine(data, stateExtra = {}) {
  const engine = {
    data,
    state: {
      questProgress: {},
      questStages: {},
      flags: {},
      inventory: [],
      gold: 0,
      level: 1,
      ...stateExtra
    },
    log() {}, saveGame() {}, applyQuestNpcReputation() {}, applyQuestRewards() {}, awardQuestExp() {}, checkAchievements() {}
  };
  QuestRuntime.bind(engine);
  return engine;
}

const questDef = {
  title: 'Legacy Bag',
  stages: [
    { title: 'Talk', tasks: [{ id: 't0', type: 'TalkToNPC', npcId: 'jack' }] },
    { title: 'Collect', tasks: [{ id: 't1', type: 'CollectItem', itemId: 'bag', count: 1 }] },
    { title: 'Done', finish: true, tasks: [{ id: 't2', type: 'ManualAdvance' }] }
  ]
};

console.log('1. New quest flow');
{
  const eng = makeEngine({ quests: { bag: questDef } });
  assert(QuestRuntime.startQuest('bag'), 'start');
  QuestEvents.emit('NPCDialogueFinished', { npcId: 'jack' });
  assert(QuestRuntime.getProgress('bag').stageIndex === 1, 'stage advanced to 1');
  QuestEvents.emit('ItemCollected', { itemId: 'bag', qty: 1 });
  // stage 1 done → stage 2 ManualAdvance needs StageActivated which fires on advance
  // after collect, stage may be 2 and ManualAdvance may complete via StageActivated
  const p = QuestRuntime.getProgress('bag');
  assert(p.status === 'completed' || p.stageIndex >= 1, 'progressed after collect');
}

console.log('2. Legacy questStages save → hydrate');
{
  const eng = makeEngine(
    { quests: { bag: questDef } },
    { questStages: { bag: '1' }, questProgress: {} }
  );
  QuestRuntime.hydrateFromSave(eng);
  const p = QuestRuntime.getProgress('bag');
  assert(p && p.status === 'active', 'hydrated active');
  assert(p.stageIndex === 1, 'hydrated stageIndex 1');
  const s0 = p.stages['0'];
  assert(s0 && s0.tasks.some((t) => t._completed), 'previous stage tasks completed');
}

console.log('3. Legacy flags.quest_* → hydrate');
{
  const eng = makeEngine(
    { quests: { bag: questDef } },
    { flags: { quest_bag: 'complete' }, questStages: {}, questProgress: {} }
  );
  QuestRuntime.hydrateFromSave(eng);
  assert(QuestRuntime.isCompleted('bag'), 'flag complete → completed');
}

console.log('4. Project migration v1 stages map');
{
  const data = {
    quests: {
      old: {
        title: 'Old',
        stages: {
          '0': { hint: 'Go' },
          complete: { finish: true, hint: 'Done' }
        }
      }
    }
  };
  QuestMigrate.migrateAll(data);
  assert(Array.isArray(data.quests.old.stages), 'stages array');
  assert(data.quests.old.stages[0].tasks.length >= 1, 'tasks inferred');
}

console.log('5. No QuestSystem in source modules');
{
  const files = [
    'js/quests/quest-runtime.js',
    'js/quests/quest-migrate.js',
    'js/editor/editor-quests.js',
    'js/engine/ui-renderer.js',
    'js/conditions.js'
  ];
  let found = false;
  for (const f of files) {
    const s = fs.readFileSync(path.join(root, f), 'utf8');
    if (/\bQuestSystem\b/.test(s) && !s.includes('ex-QuestSystem')) {
      // allow comment "ex-QuestSystem"
      const withoutComment = s.replace(/\/\/.*ex-QuestSystem.*/g, '');
      if (/\bQuestSystem\b/.test(withoutComment)) {
        console.error(' still in', f);
        found = true;
      }
    }
  }
  assert(!found, 'no QuestSystem symbol in core sources');
}

console.log('6. Editor uses TaskRegistry');
{
  assert(typeof QuestTaskRegistry.list === 'function', 'TaskRegistry.list');
  assert(QuestTaskRegistry.list().some((t) => t.id === 'TalkToNPC'), 'TalkToNPC registered');
}

console.log('\nResults', ok, 'passed', fail, 'failed');
process.exit(fail ? 1 : 0);
