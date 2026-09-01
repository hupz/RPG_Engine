#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const g = { console, Math, Date, String, Number, Array, Object, Set, Map, JSON, module:{exports:{}}, exports:{}, window:{} };
vm.createContext(g); g.window = g;
function load(rel) {
  const code = fs.readFileSync(path.join(root, rel), 'utf8');
  vm.runInContext(code + `
    if (typeof QuestTaskRegistry !== 'undefined') this.QuestTaskRegistry = QuestTaskRegistry;
  `, g, { filename: rel });
}
load('js/quests/task-base.js');
load('js/quests/task-types.js');
const R = g.QuestTaskRegistry;
let ok=0,fail=0;
function assert(c,m){if(c){ok++;console.log('OK',m);}else{fail++;console.error('FAIL',m);}}

const data = { npcs: { jack: { name: 'Джек' } }, items: { herb: { name: 'Трава' } }, enemies: {}, scenes: { village: {} }, worldMap: {} };

assert(R.listSupported().every(t => !R.get(t.id).unsupported), 'listSupported no unsupported');
assert(!R.listSupported().some(t => t.id === 'EscortNPC'), 'Escort hidden from supported');

const bad = R.validateDef({ type: 'TalkToNPC' }, data);
assert(!bad.ok && bad.errors.some(e => /NPC|Персонаж|npcId/i.test(e)), 'TalkToNPC requires npcId');

const missing = R.validateDef({ type: 'TalkToNPC', npcId: 'ghost' }, data);
assert(!missing.ok && missing.errors.some(e => /не найден/i.test(e)), 'missing NPC error');

const good = R.validateDef({ type: 'TalkToNPC', npcId: 'jack' }, data);
assert(good.ok, 'TalkToNPC with jack ok');

const collect = R.validateDef({ type: 'CollectItem', itemId: 'herb', count: 5 }, data);
assert(collect.ok, 'CollectItem ok');

const unsup = R.validateDef({ type: 'EscortNPC', npcId: 'jack' }, data);
assert(!unsup.ok, 'unsupported flagged');

console.log('Results', ok, 'passed', fail, 'failed');
process.exit(fail?1:0);
