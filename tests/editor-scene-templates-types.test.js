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

const packSrc = fs.readFileSync(path.join(root, 'js/editor/editor-scene-template-pack.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'editor.html'), 'utf8');

assert(packSrc.includes('createSceneFromPack'), 'creates new scene API');
assert(packSrc.includes("sceneType: 'dialog'") || packSrc.includes("sceneType: 'dialog'"), 'dialog type');
assert(packSrc.includes("sceneType: 'combat'"), 'combat type');
assert(packSrc.includes("sceneType: 'shop'"), 'shop type');
assert(packSrc.includes("sceneType: 'blacksmith'"), 'blacksmith type');
assert(packSrc.includes("sceneType: 'church'"), 'church type');
assert(packSrc.includes("sceneType: 'hub'"), 'hub type');
assert(packSrc.includes("sceneType: 'quest'"), 'quest type');
assert(packSrc.includes("sceneType: 'reward'"), 'reward type');
assert(packSrc.includes("sceneType: 'transition'"), 'transition type');
assert(packSrc.includes('tpl_empty'), 'empty template');
assert(packSrc.includes('tpl_location'), 'location template');
assert((html.match(/scene-template-picker-modal/g) || []).length <= 2, 'single modal in html');
assert(!/Editor\.switchTab\s*=\s*(function|\()/.test(packSrc), 'no switchTab assign');

const document = {
  getElementById() { return null; },
  addEventListener() {},
  querySelector() { return null; },
  querySelectorAll() { return []; }
};
const Editor = {
  data: { scenes: { start: { id: 'start', location: 'Start', text: '', choices: [] } }, enemies: {}, shopInventories: {}, items: {}, npcs: {} },
  currentScene: 'start',
  switchTab() { this._sw = (this._sw || 0) + 1; },
  renderSceneList() {},
  renderSceneEditor() {},
  updateJSONPreview() {},
  markDirty() {},
  ensureSceneEditorModules(s) { return s.editorModules || []; },
  templates: {
    _r: new Map(),
    register(t) { this._r.set(t.id, t); },
    list() { return [...this._r.values()]; }
  },
  toast: { success() {} }
};
const ctx = { Editor, console, document, window: {}, Object, Array, String, Math, Map, Set };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(packSrc, ctx);

const E = ctx.Editor;
const list = E.listSceneTemplatePack();
assert(list.length >= 12, 'enough templates: ' + list.length);

const need = [
  ['tpl_dialogue', 'dialog'],
  ['tpl_combat', 'combat'],
  ['tpl_shop', 'shop'],
  ['tpl_forge', 'blacksmith'],
  ['tpl_church', 'church'],
  ['tpl_hub_simple', 'hub'],
  ['tpl_quest_accept', 'quest'],
  ['tpl_reward', 'reward'],
  ['tpl_scene_choice', 'transition'],
  ['tpl_npc_meet', 'dialog'],
  ['tpl_empty', 'custom'],
  ['tpl_location', 'custom']
];

need.forEach(([id, st]) => {
  const before = Object.keys(E.data.scenes).length;
  const newId = E.applySceneTemplatePack(id); // create new
  assert(typeof newId === 'string' && E.data.scenes[newId], id + ' creates scene');
  assert(Object.keys(E.data.scenes).length === before + 1, id + ' adds one scene');
  assert(E.currentScene === newId, id + ' selects scene');
  assert(E.data.scenes[newId].sceneType === st, id + ' sceneType=' + st + ' got ' + E.data.scenes[newId].sceneType);
  const mods = E.data.scenes[newId].editorModules || [];
  assert(mods.includes('story'), id + ' has story');
});

// JSON round-trip
const json = JSON.stringify({ scenes: E.data.scenes });
const loaded = JSON.parse(json);
assert(loaded.scenes[E.currentScene].sceneType, 'JSON preserves sceneType');

// apply to current does not always add
const n = Object.keys(E.data.scenes).length;
E.applySceneTemplatePack('tpl_empty', { applyToCurrent: true });
assert(Object.keys(E.data.scenes).length === n, 'applyToCurrent does not add scene');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
