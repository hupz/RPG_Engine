#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { console, Math, Date, String, Number, Array, Object, Set, Map, JSON, module: { exports: {} }, exports: {}, window: {} };
vm.createContext(ctx);
ctx.window = ctx;
function load(rel) {
  vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), ctx, { filename: rel });
}
load('js/quests/task-base.js');
load('js/quests/task-types.js');
load('js/quests/quest-events.js');
load('js/quests/quest-runtime.js');

const { QuestTaskRegistry, QuestRuntime, QuestEvents } = ctx;
let ok = 0, fail = 0;
function assert(c, m) { if (c) { ok++; console.log('  OK', m); } else { fail++; console.error('  FAIL', m); } }

function engineWithQuest(tasks) {
  const data = {
    quests: {
      q: {
        title: 'Q',
        stages: [{ title: 'S', tasks }, { title: 'End', finish: true, tasks: [{ id: 'end', type: 'ManualAdvance' }] }]
      }
    }
  };
  const engine = {
    data,
    state: { questProgress: {}, questStages: {}, flags: {}, inventory: [], gold: 0, level: 1 },
    log() {},
    saveGame() {},
    applyQuestNpcReputation() {},
    applyQuestRewards() {},
    awardQuestExp() {},
    checkAchievements() {}
  };
  QuestRuntime.bind(engine);
  QuestRuntime.startQuest('q');
  return engine;
}

const cases = [
  { type: 'TalkToNPC', def: { id: 't', type: 'TalkToNPC', npcId: 'bob' }, event: 'NPCDialogueFinished', payload: { npcId: 'bob' } },
  { type: 'CollectItem', def: { id: 't', type: 'CollectItem', itemId: 'herb', count: 2 }, event: 'ItemCollected', payload: { itemId: 'herb', qty: 2 }, needComplete: true },
  { type: 'KillEnemy', def: { id: 't', type: 'KillEnemy', enemyId: 'wolf', count: 1 }, event: 'EnemyKilled', payload: { enemyId: 'wolf', count: 1 } },
  { type: 'VisitLocation', def: { id: 't', type: 'VisitLocation', sceneId: 'tavern' }, event: 'LocationVisited', payload: { sceneId: 'tavern' } },
  { type: 'DeliverItem', def: { id: 't', type: 'DeliverItem', itemId: 'bag', count: 1 }, event: 'ItemDelivered', payload: { itemId: 'bag', qty: 1 } },
  { type: 'UseItem', def: { id: 't', type: 'UseItem', itemId: 'potion' }, event: 'ItemUsed', payload: { itemId: 'potion' } },
  { type: 'CraftItem', def: { id: 't', type: 'CraftItem', itemId: 'bread' }, event: 'ItemCrafted', payload: { itemId: 'bread', qty: 1 } },
  { type: 'AcquireGold', def: { id: 't', type: 'AcquireGold', amount: 10 }, event: 'GoldGained', payload: { amount: 10 } },
  { type: 'SpendGold', def: { id: 't', type: 'SpendGold', amount: 5 }, event: 'GoldSpent', payload: { amount: 5 } },
  { type: 'ReachLevel', def: { id: 't', type: 'ReachLevel', level: 3 }, event: 'PlayerLevelChanged', payload: { level: 3 } },
  { type: 'EquipItem', def: { id: 't', type: 'EquipItem', itemId: 'sword' }, event: 'ItemEquipped', payload: { itemId: 'sword' } },
  { type: 'DiscoverLocation', def: { id: 't', type: 'DiscoverLocation', locationId: 'mill' }, event: 'LocationDiscovered', payload: { locationId: 'mill' } },
  { type: 'WaitTime', def: { id: 't', type: 'WaitTime', minutes: 30 }, event: 'TimePassed', payload: { minutes: 30 } },
  { type: 'LearnSkill', def: { id: 't', type: 'LearnSkill', skillId: 'athletics' }, event: 'SkillLearned', payload: { skillId: 'athletics' } },
  { type: 'ChooseDialogueOption', def: { id: 't', type: 'ChooseDialogueOption', choiceFlag: 'said_yes' }, event: 'ChoiceSelected', payload: { flag: 'said_yes' } },
  { type: 'InteractObject', def: { id: 't', type: 'InteractObject', objectId: 'lever' }, event: 'ObjectInteracted', payload: { objectId: 'lever' } },
];

console.log('Supported task event tests');
for (const c of cases) {
  engineWithQuest([c.def]);
  QuestEvents.emit(c.event, c.payload);
  const tasks = QuestRuntime.getLiveTasks('q');
  // after complete may advance stage
  const prog = QuestRuntime.getProgress('q');
  const saved = prog?.stages?.['0']?.tasks?.[0];
  const done = saved?._completed || (tasks[0] && tasks[0].isCompleted && tasks[0].isCompleted());
  const progressOk = saved && (saved._progress > 0 || saved._completed);
  assert(done || progressOk, c.type + ' ← ' + c.event);
}

// FlagSet must NOT advance InteractObject (semantic: only ObjectInteracted)
console.log('InteractObject ignores FlagSet');
{
  engineWithQuest([{ id: 't', type: 'InteractObject', objectId: 'lever' }]);
  QuestEvents.emit('FlagSet', { flag: 'lever', objectId: 'lever' });
  const prog = QuestRuntime.getProgress('q');
  const saved = prog?.stages?.['0']?.tasks?.[0];
  const tasks = QuestRuntime.getLiveTasks('q');
  const done = saved?._completed || (tasks[0] && tasks[0].isCompleted && tasks[0].isCompleted());
  assert(!done && !(saved && saved._progress > 0), 'FlagSet → InteractObject progress unchanged');
}

console.log('Unsupported markers');
assert(QuestTaskRegistry.get('EscortNPC').unsupported === true, 'EscortNPC unsupported');
assert(QuestTaskRegistry.get('ProtectNPC').unsupported === true, 'ProtectNPC unsupported');
assert(QuestTaskRegistry.get('ActivateObject').unsupported === true, 'ActivateObject unsupported');

console.log('\nResults', ok, 'passed', fail, 'failed');
process.exit(fail ? 1 : 0);
