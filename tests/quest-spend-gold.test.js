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
    if (typeof QuestTaskRegistry !== 'undefined') this.QuestTaskRegistry = QuestTaskRegistry;
  `, g, { filename: rel });
}
load('js/quests/task-base.js');
load('js/quests/task-types.js');
load('js/quests/quest-events.js');
load('js/quests/quest-runtime.js');

// Minimal changeGold/spendGold like engine
const events = [];
const engine = {
  state: { gold: 100, questProgress: {}, questStages: {}, flags: {}, inventory: [] },
  data: { quests: { q: { stages: [{ title: 'S', tasks: [{ id: 'sg', type: 'SpendGold', amount: 30 }] }] } } },
  log() {}, saveGame() {}, updateStats() {},
  changeGold(delta, opts = {}) {
    const n = Number(delta) || 0;
    if (!n) return this.state.gold;
    this.state.gold = Math.max(0, (this.state.gold || 0) + n);
    const payload = { amount: Math.abs(n), reason: opts.reason, source: opts.source, gold: this.state.gold };
    if (n > 0) g.QuestEvents.emit('GoldGained', payload);
    else g.QuestEvents.emit('GoldSpent', payload);
    return this.state.gold;
  },
  spendGold(amount, opts = {}) {
    const n = Math.max(0, Number(amount) || 0);
    if ((this.state.gold || 0) < n) return { ok: false, gold: this.state.gold };
    this.changeGold(-n, opts);
    return { ok: true, gold: this.state.gold };
  }
};
g.QuestRuntime.bind(engine);
g.QuestRuntime.startQuest('q');

let lastSpent = null;
const unsub = g.QuestEvents.on((e) => {
  if (e.type === 'GoldSpent') lastSpent = e.payload;
});

const r = engine.spendGold(30, { reason: 'choice', source: 'choice' });
console.log('gold', engine.state.gold, 'expect 70');
console.log('spent payload', lastSpent);

const saved = g.QuestRuntime.getProgress('q');
const st = saved?.stages?.['0']?.tasks?.[0];
let ok = 0, fail = 0;
function assert(c, m) { if (c) { ok++; console.log('OK', m); } else { fail++; console.error('FAIL', m); } }
assert(engine.state.gold === 70, 'gold = 70');
assert(lastSpent && lastSpent.amount === 30, 'GoldSpent amount = 30');
assert(st && (st._progress === 30 || st._completed), 'SpendGoldTask progress += 30');
assert(st && st._completed, 'task complete at 30/30');
console.log('Results', ok, 'passed', fail, 'failed');
process.exit(fail ? 1 : 0);
