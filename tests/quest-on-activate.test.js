#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const g = { console, Math, Date, String, Number, Array, Object, Set, Map, JSON, Error, module:{exports:{}}, exports:{}, window:{} };
vm.createContext(g); g.window = g;
function load(rel) {
  const code = fs.readFileSync(path.join(root, rel), 'utf8');
  vm.runInContext(code + `
    if (typeof QuestTaskRegistry !== 'undefined') this.QuestTaskRegistry = QuestTaskRegistry;
    if (typeof QuestRuntime !== 'undefined') this.QuestRuntime = QuestRuntime;
    if (typeof QuestEvents !== 'undefined') this.QuestEvents = QuestEvents;
  `, g, { filename: rel });
}
load('js/quests/task-base.js');
load('js/quests/task-types.js');
load('js/quests/quest-events.js');
load('js/quests/quest-runtime.js');
const { QuestRuntime, QuestEvents } = g;
let ok=0,fail=0;
function assert(c,m){if(c){ok++;console.log('OK',m);}else{fail++;console.error('FAIL',m);}}

function eng(tasks, stateExtra) {
  const engine = {
    data: { quests: { q: { stages: [{ title: 'S', tasks }] } } },
    state: {
      questProgress: {}, questStages: {}, flags: {},
      inventory: [], gold: 100, level: 1, equipped: {}, skills: {},
      skillIncreases: [], visitedLocations: {}, scene: 'village',
      ...stateExtra
    },
    log(){}, saveGame(){}, applyQuestNpcReputation(){}, applyQuestRewards(){},
    awardQuestExp(){}, checkAchievements(){}
  };
  QuestRuntime.bind(engine);
  return engine;
}

console.log('ReachLevel');
{
  eng([{ id: 't', type: 'ReachLevel', level: 5 }], { level: 10 });
  QuestRuntime.startQuest('q');
  const prog = QuestRuntime.getProgress('q');
  const task = prog?.stages?.['0']?.tasks?.[0];
  assert(task && (task._completed || task._progress >= 5), 'level 10 >= 5 immediate');
}

console.log('LearnSkill');
{
  eng([{ id: 't', type: 'LearnSkill', skillId: 'arcana' }], { skills: { arcana: 2 } });
  QuestRuntime.startQuest('q');
  const task = QuestRuntime.getProgress('q')?.stages?.['0']?.tasks?.[0];
  assert(task && task._completed, 'skill already learned');
}

console.log('DiscoverLocation');
{
  eng([{ id: 't', type: 'DiscoverLocation', locationId: 'river_bend' }], {
    visitedLocations: { river_bend: true }
  });
  QuestRuntime.startQuest('q');
  const task = QuestRuntime.getProgress('q')?.stages?.['0']?.tasks?.[0];
  assert(task && task._completed, 'location already discovered');
}

console.log('CollectItem');
{
  eng([{ id: 't', type: 'CollectItem', itemId: 'herb', count: 3 }], {
    inventory: ['herb', 'herb', 'herb', 'sword']
  });
  QuestRuntime.startQuest('q');
  const task = QuestRuntime.getProgress('q')?.stages?.['0']?.tasks?.[0];
  assert(task && task._progress >= 3 && task._completed, '3 herbs in inventory');
}

console.log('SpendGold must NOT complete from balance');
{
  eng([{ id: 't', type: 'SpendGold', amount: 30 }], { gold: 100 });
  QuestRuntime.startQuest('q');
  const t = QuestRuntime.getLiveTasks('q')[0];
  assert(!t.isCompleted() && t.getProgress() === 0, 'SpendGold ignores current gold');
}

console.log('EquipItem');
{
  eng([{ id: 't', type: 'EquipItem', itemId: 'iron_sword' }], {
    equipped: { weapon_main: 'iron_sword' }
  });
  QuestRuntime.startQuest('q');
  const task = QuestRuntime.getProgress('q')?.stages?.['0']?.tasks?.[0];
  assert(task && task._completed, 'already equipped');
}

console.log('\nResults', ok, 'passed', fail, 'failed');
process.exit(fail ? 1 : 0);
