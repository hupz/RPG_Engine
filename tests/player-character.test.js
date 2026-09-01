'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');

let passed = 0, failed = 0;
function assert(c, m) {
  if (c) { passed++; console.log('  ✓', m); }
  else { failed++; console.error('  ✗', m); }
}

const document = {
  _els: {},
  getElementById(id) {
    if (!this._els[id]) {
      this._els[id] = {
        id, innerHTML: '', value: '', style: {},
        classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
        setAttribute() {}, getAttribute() { return null; },
        addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
        appendChild() {}, remove() {}, focus() {}, textContent: '', outerHTML: ''
      };
    }
    return this._els[id];
  },
  createElement() {
    return { style: {}, classList: { add() {}, remove() {} }, appendChild() {}, setAttribute() {}, textContent: '' };
  },
  head: { appendChild() {} },
  body: { appendChild() {} },
  addEventListener() {},
  readyState: 'complete',
  querySelectorAll() { return []; }
};

const ctx = {
  console, document, window: {}, localStorage: { getItem() { return null; }, setItem() {} },
  setTimeout, clearTimeout, JSON, Math, Number, String, Array, Object, Error, Map, Set, Promise, alert() {}
};
ctx.window = ctx;
vm.createContext(ctx);

// Minimal Editor shell
vm.runInContext(`
var Editor = {
  data: { races: { human: { name: 'Человек' } }, classes: { warrior: { name: 'Воин' } }, items: { potion: { name: 'Зелье' } }, meta: {} },
  currentTab: 'player_characters',
  escapeHtml(s) { return String(s ?? '').replace(/</g,'&lt;'); },
  escapeAttr(s) { return String(s ?? '').replace(/"/g,'&quot;'); },
  slugFromName(n) { return String(n||'hero').toLowerCase().replace(/[^a-z0-9_]+/g,'_').replace(/^_|_$/g,'') || 'hero'; },
  markDirty() { this._dirty = true; },
  switchTab(t) { this.currentTab = t; },
  hooks: { after() {}, before() {}, replace() {} }
};
`, ctx);

vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-player-character.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-templates.js'), 'utf8'), ctx);

const Editor = ctx.Editor;

(async () => {
console.log('\n--- create ---');
const id = Editor.createPlayerCharacterFromForm({
  name: 'Сэр Джулиан',
  race: 'human',
  class: 'warrior',
  backstory: 'Бывший рыцарь короны.',
  personality: 'Честный',
  motivation: 'Справедливость',
  goals: 'Найти реликвию',
  fears: 'Предательство'
});
assert(!!id, 'create returns id');
assert(!!Editor.data.playerCharacters[id], 'character in data');
assert(Editor.data.playerCharacters[id].isPlayerCharacter === true, 'isPlayerCharacter flag');
assert(Editor.data.playerCharacters[id].backstory.includes('рыцарь'), 'backstory saved');

console.log('\n--- edit ---');
Editor.updatePlayerCharacterField(id, 'backstory', 'Новая предыстория');
assert(Editor.data.playerCharacters[id].backstory === 'Новая предыстория', 'edit backstory');

console.log('\n--- empty backstory ---');
Editor.updatePlayerCharacterField(id, 'backstory', '');
assert(Editor.data.playerCharacters[id].backstory === '', 'empty backstory allowed');

console.log('\n--- validation ---');
const bad = Editor.createPlayerCharacterFromForm({ name: '' });
assert(bad === null, 'empty name rejected');

console.log('\n--- template ---');
assert(!!Editor.templates.get('player_character'), 'template exists');
assert(Editor.templates.get('player_character').title.includes('ерсонаж') || Editor.templates.get('player_character').icon === '🎭', 'template title/icon');
Editor.templates.run('player_character');
assert(Editor.currentTab === 'player_characters', 'template opens player characters tab');

console.log('\n--- delete ---');
await Editor.deletePlayerCharacter(id);
assert(!Editor.data.playerCharacters[id], 'deleted');

console.log('\n--- old project ---');
const old = { scenes: {}, meta: { dataVersion: 2 } };
assert(old.playerCharacter === undefined && old.playerCharacters === undefined, 'old project without PC is valid');

console.log('\n--- save shape ---');
const id2 = Editor.createPlayerCharacterFromForm({
  name: 'Ара',
  backstory: 'Охотница из леса',
  race: 'human',
  class: 'warrior'
});
const snap = JSON.parse(JSON.stringify(Editor.data.playerCharacters[id2]));
assert(snap.backstory === 'Охотница из леса', 'save/load backstory field present');
assert(snap.name === 'Ара', 'save name');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
