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
  vm.runInContext(code + `
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

function makeEngine(extraState) {
  const engine = {
    data: { quests: { q: { stages: [
      { title:'A', tasks:[{id:'t',type:'TalkToNPC',npcId:'x'}] },
      { title:'B', finish:true, tasks:[{id:'t2',type:'ManualAdvance'}] }
    ]}}},
    state: { questProgress: {}, questStages: {}, flags: {}, inventory: [], gold: 0, ...extraState },
    log(){}, saveGame(){}, applyQuestNpcReputation(){}, applyQuestRewards(){}, awardQuestExp(){}, checkAchievements(){}
  };
  QuestRuntime.bind(engine);
  return engine;
}

console.log('V2 save roundtrip');
{
  const eng = makeEngine();
  QuestRuntime.startQuest('q');
  QuestEvents.emit('NPCDialogueFinished', { npcId: 'x' });
  const snap = JSON.parse(JSON.stringify(QuestRuntime.serializeAll()));
  assert(snap.q && snap.q.status, 'serialized questProgress has q');
  // journal only from progress
  const j = QuestRuntime.getJournalEntries();
  assert(Array.isArray(j), 'journal array');
  // poison questStages only entry should NOT appear in journal if not in progress
  eng.state.questStages.other = '0';
  assert(!QuestRuntime.getJournalEntries().some(e => e.questId === 'other'), 'journal ignores orphan questStages');
}

console.log('V1 save migration');
{
  const eng = makeEngine({ questProgress: {}, questStages: { q: '1' }, flags: {} });
  QuestRuntime.hydrateFromSave(eng);
  const p = QuestRuntime.getProgress('q');
  assert(p && p.status === 'active' && p.stageIndex === 1, 'V1→progress stage 1');
  assert(eng.state.questStages.q === '1', 'mirror rebuilt');
}

console.log('V2 load ignores stale questStages');
{
  const eng = makeEngine({
    questProgress: { q: { status: 'active', stageIndex: 0, stages: {} } },
    questStages: { q: '9' } // stale
  });
  QuestRuntime.hydrateFromSave(eng);
  assert(QuestRuntime.getProgress('q').stageIndex === 0, 'V2 progress wins over stale stages');
  assert(eng.state.questStages.q === '0', 'mirror synced from progress');
}

console.log('Completed quest save');
{
  const eng = makeEngine();
  QuestRuntime.startQuest('q');
  QuestRuntime.completeQuest('q', { silentLog: true });
  const snap = QuestRuntime.serializeAll();
  assert(snap.q.status === 'completed', 'completed in progress');
  QuestRuntime._mirrorProgressToLegacyStages();
  assert(eng.state.questStages.q === '__finished__', 'mirror finished');
}

console.log('\nResults', ok, 'passed', fail, 'failed');
process.exit(fail?1:0);
