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
    if (typeof QuestMigrate !== 'undefined') this.QuestMigrate = QuestMigrate;
  `, g, { filename: rel });
}
load('js/quests/task-base.js');
load('js/quests/task-types.js');
load('js/quests/quest-migrate.js');
const { QuestMigrate, QuestTaskRegistry } = g;
let ok=0,fail=0;
function assert(c,m){if(c){ok++;console.log('OK',m);}else{fail++;console.error('FAIL',m);}}

console.log('1. Known talk with giver → TalkToNPC');
{
  const q = QuestMigrate.migrateQuest('lost', {
    title: 'Сумка',
    giver: 'jack',
    stages: {
      '0': { hint: 'Поговорите с Джеком о пропавшей сумке' },
      '1': { hint: 'Найдите сумку у валуна' },
      complete: { finish: true, hint: 'Готово' }
    }
  });
  assert(q.stages[0].tasks[0].type === 'TalkToNPC', 'talk type');
  assert(q.stages[0].tasks[0].npcId === 'jack', 'npc jack');
  assert(q.stages[1].tasks[0].type === 'CollectItem', 'collect bag');
  assert(q.stages[1].tasks[0].itemId === 'jack_bag', 'item jack_bag');
  assert(q.stages[2].tasks[0].type === 'ManualAdvance', 'finish ManualAdvance');
}

console.log('2. Unknown text → MigrationRequired not ManualAdvance');
{
  QuestMigrate.beginReport();
  const q = QuestMigrate.migrateQuest('weird', {
    title: 'Странный',
    stages: {
      '0': { hint: 'Сделайте нечто необъяснимое с фиолетовым туманом' }
    }
  });
  assert(q.stages[0].tasks[0].type === 'MigrationRequired', 'MigrationRequired');
  assert(q.stages[0].tasks[0].type !== 'ManualAdvance', 'not ManualAdvance');
  assert(q.stages[0].tasks[0].legacyData, 'legacyData kept');
  const rep = QuestMigrate.getLastReport();
  assert(rep.requiresManualReview.length >= 1, 'report requires review');
}

console.log('3. New v2 quest unchanged');
{
  const original = {
    questFormat: 2,
    title: 'New',
    stages: [{
      title: 'A',
      tasks: [{ type: 'ReachLevel', level: 3, id: 't1' }]
    }]
  };
  const q = QuestMigrate.migrateQuest('newq', JSON.parse(JSON.stringify(original)));
  assert(q.stages[0].tasks[0].type === 'ReachLevel', 'v2 preserved');
  assert(q.stages[0].tasks[0].level === 3, 'level preserved');
}

console.log('4. migrateAll report');
{
  const data = {
    quests: {
      a: { stages: { '0': { hint: 'Поговорите с Мартой' }, complete: { finish: true, hint: 'Done' } }, giver: 'marta' },
      b: { stages: { '0': { hint: 'Сделайте загадочное действие XYZ' } } }
    }
  };
  QuestMigrate.migrateAll(data);
  assert(data.questsVersion === 2, 'version 2');
  assert(data.questMigrationReport, 'report on data');
  const r = data.questMigrationReport;
  console.log(QuestMigrate.formatReport(r));
  assert(r.requiresManualReview.length >= 1, 'has manual review');
  assert(r.migratedAutomatically.length >= 1, 'has auto');
}

console.log('5. MigrationRequired registered');
{
  assert(!!QuestTaskRegistry.get('MigrationRequired'), 'type registered');
  assert(!QuestTaskRegistry.listSupported().some((t) => t.id === 'MigrationRequired'), 'not in supported list for authors');
}


console.log('6. Empty legacy quest → MigrationRequired');
{
  const q = QuestMigrate.migrateQuest('empty', null);
  assert(q.stages[0].tasks[0].type === 'MigrationRequired', 'empty → MigrationRequired');
  assert(q.stages[0].tasks[0].type !== 'ManualAdvance', 'empty not ManualAdvance');
  const q2 = QuestMigrate.migrateQuest('empty2', {});
  // {} may go through no-stages path
  const t0 = q2.stages?.[0]?.tasks?.[0];
  assert(t0 && t0.type === 'MigrationRequired', 'empty object → MigrationRequired: ' + (t0 && t0.type));
}

console.log('7. Known collect stays CollectItem');
{
  const q = QuestMigrate.migrateQuest('bag', {
    stages: { '0': { hint: 'Найдите сумку у валуна' } }
  });
  assert(q.stages[0].tasks[0].type === 'CollectItem', 'known collect');
  assert(q.stages[0].tasks[0].itemId === 'jack_bag', 'jack_bag');
}

console.log('\nResults', ok, 'passed', fail, 'failed');
