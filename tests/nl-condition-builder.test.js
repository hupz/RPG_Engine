#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓', msg); }
  else { failed++; console.error('  ✗', msg); }
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

const gameData = {
  items: { village_key: { name: 'Ключ' }, potion: { name: 'Зелье' } },
  quests: { q1: { title: 'Квест деревни', stages: [{ id: '1' }, { id: '2' }] } },
  classes: { warrior: { name: 'Воин' } },
  reputation: { village: { name: 'Деревня' }, starting: {} },
  startingFlags: { door_open: false, gold_score: 0 }
};

const ctx = {
  console,
  window: {},
  globalThis: null,
  Editor: { data: gameData, getQuestStageKeys: (qid) => (qid === 'q1' ? ['0', '1', '2'] : ['0']) }
};
ctx.globalThis = ctx;
ctx.window = ctx;
vm.createContext(ctx);

vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-condition-catalog.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/nl-condition-builder.js'), 'utf8'), ctx);

const C = ctx.EditorConditionCatalog;
const NL = ctx.NLConditionBuilder;

assert(!!NL && !!C, 'modules loaded');

const samples = [
  ['hasItem', { hasItem: 'village_key' }],
  ['notHasItem', { notHasItem: 'potion' }],
  ['goldMin', { goldMin: 20 }],
  ['goldMax', { goldMax: 100 }],
  ['questStage', { questId: 'q1', stage: '2' }],
  ['questMinStage', { questId: 'q1', stage: 2 }],
  ['class', { class: 'warrior' }],
  ['choiceUsed', { choiceUsed: 'talked_to_jack' }],
  ['choiceNotUsed', { choiceNotUsed: 'talked_to_jack' }],
  ['reputation', { faction: 'village', op: 'gte', value: 10 }],
  ['flag', { flag: 'door_open', equals: true }],
  ['notFlag', { notFlag: 'door_open' }]
];

samples.forEach(([type, vals]) => {
  const rule = C.buildRule(type, vals);
  const state = NL.ruleStateFromRule(rule, gameData);
  const rebuilt = NL.toEngineRule(state);
  assert(deepEqual(rebuilt, rule), type + ': JSON round-trip');
  const phrase = NL.ruleToPhrase(rule, gameData);
  assert(typeof phrase === 'string' && phrase.length > 3, type + ': phrase «' + phrase + '»');
});

assert(NL.ruleToPhrase(C.buildRule('hasItem', { hasItem: 'village_key' }), gameData).includes('Ключ'), 'hasItem label');
assert(NL.ruleToPhrase(C.buildRule('goldMax', { goldMax: 20 }), gameData).includes('20'), 'goldMax number');
assert(NL.ruleToPhrase(C.buildRule('questStage', { questId: 'q1', stage: '2' }), gameData).includes('Квест деревни'), 'quest label');

const allGroup = C.rulesToShowIf([
  C.buildRule('hasItem', { hasItem: 'village_key' }),
  C.buildRule('goldMin', { goldMin: 10 })
], 'all');
const allPhrase = NL.formatGroupPhrase(allGroup, gameData);
assert(allPhrase.includes(' и '), 'all combinator «и»');
assert(allPhrase.includes('Ключ'), 'all phrase item');

const anyGroup = C.rulesToShowIf([
  C.buildRule('hasItem', { hasItem: 'village_key' }),
  C.buildRule('goldMin', { goldMin: 10 })
], 'any');
const anyPhrase = NL.formatGroupPhrase(anyGroup, gameData);
assert(anyPhrase.includes(' или '), 'any combinator «или»');

assert(NL.isSupportedRuleType('hasItem'), 'supported hasItem');
assert(NL.isSupportedRuleType('unknown') === false, 'unsupported type');

const addHtml = NL.buildAddRuleOptionsHtml({ writerOnly: true });
assert(addHtml.includes('hasItem') || addHtml.includes('предмет'), 'writer add options');
assert(!addHtml.includes('notFlag'), 'notFlag not in writer add');

assert(NL.NL_RULE_IDS.length === 12, '12 rule types');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
