#!/usr/bin/env node
/**
 * P4.6 — Story memory: service flags, guidance hints, NL phrases.
 */
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

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const data = {
  startScene: 'cave',
  scenes: {
    cave: { id: 'cave', location: 'Пещера', choices: [{ text: 'Выйти', to: 'hub', once: true }] },
    hub: { id: 'hub', location: 'Хаб', sceneType: 'hub', choices: [] },
    orphan: { id: 'orphan', location: 'Сирота', choices: [] }
  },
  items: { key: { id: 'key', name: 'Старый ключ' } }
};

const ctx = vm.createContext({
  StoryMemory: null,
  Editor: { hooks: { after() {} }, data, isWriterMode() { return true; }, getFlagCatalog() { return ['loc_cave', 'player_met']; } },
  console,
  module: { exports: {} },
  globalThis: null
});
ctx.globalThis = ctx;
vm.runInContext(read('js/editor/editor-story-memory.js'), ctx);
const SM = ctx.StoryMemory;

console.log('Story memory P4.6');

assert(SM.isServiceFlag('loc_cave'), 'loc_ is service');
assert(SM.isServiceFlag('it_key'), 'it_ is service');
assert(SM.isServiceFlag('ch_cave_0'), 'ch_ is service');
assert(!SM.isServiceFlag('player_met'), 'story flag not service');

assert(SM.locationFlag('cave') === 'loc_cave', 'location flag id');
assert(SM.itemFlag('key') === 'it_key', 'item flag id');

const phrase = SM.phraseForServiceFlag('loc_cave', data);
assert(phrase && phrase.includes('Пещера'), 'location phrase human');
const itemPhrase = SM.phraseForServiceFlag('it_key', data);
assert(itemPhrase && itemPhrase.includes('Старый ключ'), 'item phrase human');

const model = {
  startId: 'cave',
  reachable: new Set(['cave', 'hub']),
  nodes: [
    { id: 'cave', label: 'Пещера', outCount: 1, isHub: false, isFinal: false },
    { id: 'hub', label: 'Хаб', outCount: 0, isHub: true, isFinal: true },
    { id: 'orphan', label: 'Сирота', outCount: 0, isHub: false, isFinal: true }
  ],
  edges: []
};
const hints = SM.buildStoryGuidanceHints(model, data);
assert(hints.some((h) => h.id === 'route_coverage'), 'unreachable hint');
assert(hints.some((h) => h.message.includes('недостижим') || h.message.includes('маршрут')), 'soft route message');

const sanitized = SM.sanitizeProjectForAuthorView({
  startingFlags: { loc_cave: true, quest_done: true },
  scenes: { cave: { flags: { loc_cave: true, custom: 1 }, choices: [{ doneFlag: 'ch_cave_0' }] } }
});
assert(!sanitized.startingFlags.loc_cave, 'sanitize starting service flag');
assert(sanitized.startingFlags.quest_done, 'keep story flag');
assert(!sanitized.scenes.cave.flags.loc_cave, 'sanitize scene service flag');
assert(!sanitized.scenes.cave.choices[0].doneFlag, 'sanitize choice doneFlag');

assert(SM.inferStoryPhaseForNode('start', { startKey: 'start' }) === 'start', 'phase start');
assert(SM.inferStoryPhaseForNode('hub', { startKey: 'start' }) === 'setup', 'phase setup');
assert(SM.inferStoryPhaseForNode('exit', { startKey: 'start' }) === 'finale', 'phase finale');

const html = SM.renderGuidanceHtml(hints);
assert(html.includes('sf-guidance'), 'guidance html');
assert(!html.includes('loc_'), 'no flag names in guidance');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
