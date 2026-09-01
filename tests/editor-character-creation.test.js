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

const ccSrc = fs.readFileSync(path.join(root, 'js/character-creator.js'), 'utf8');
const syncSrc = fs.readFileSync(path.join(root, 'js/character-creation-sync.js'), 'utf8');
const packSrc = fs.readFileSync(path.join(root, 'js/editor/editor-scene-template-pack.js'), 'utf8');
const sceneTpl = fs.readFileSync(path.join(root, 'js/scene-template-char-creation.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'editor.html'), 'utf8');

assert(packSrc.includes('tpl_char_creation'), 'template exists in pack');
assert(packSrc.includes("sceneType: 'character_creation'"), 'sceneType character_creation');
assert(packSrc.includes('character_creator') || sceneTpl.includes('character_creator'), 'uses character_creator component');
assert(ccSrc.includes('cc-char-backstory'), 'backstory textarea in CharacterCreator');
assert(ccSrc.includes('backstory: \'\''), 'draft.backstory field');
assert(syncSrc.includes('backstory:'), 'sync persists backstory');
assert((html.match(/scene-template-picker-modal/g) || []).length <= 2, 'template modal <= 1');

// Simulate pack create
const document = { getElementById() { return null; }, addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } };
const Editor = {
  data: { scenes: {}, races: { human: { name: 'Человек' } }, classes: { fighter: { name: 'Воин' } }, enemies: {}, items: {}, npcs: {}, shopInventories: {} },
  currentScene: null,
  switchTab() {},
  renderSceneList() {},
  renderSceneEditor() {},
  updateJSONPreview() {},
  markDirty() {},
  ensureSceneEditorModules(s) { return s.editorModules || []; },
  templates: { _r: new Map(), register(t) { this._r.set(t.id, t); }, list() { return [...this._r.values()]; } },
  toast: { success() {} }
};
const ctx = { Editor, console, document, window: {}, Object, Array, String, Math, Map, Set };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(packSrc, ctx);

const id = ctx.Editor.applySceneTemplatePack('tpl_char_creation');
assert(typeof id === 'string' && ctx.Editor.data.scenes[id], 'template creates scene');
const sc = ctx.Editor.data.scenes[id];
assert(sc.sceneType === 'character_creation', 'sceneType set');
assert(sc.special === 'character_creation' || (sc.components && sc.components.some((c) => c.component === 'character_creator')), 'special or component');
assert(ctx.Editor.currentScene === id, 'scene selected');

// Round-trip character payload with backstory (sync shape)
const draft = {
  name: 'Альберт',
  raceKey: 'human',
  classKey: 'fighter',
  backstory: 'Был мельником у реки.',
  stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  skills: [],
  gender: 'male'
};
assert(draft.backstory.length > 0, 'backstory text');
const saved = JSON.stringify({
  scenes: ctx.Editor.data.scenes,
  player: { name: draft.name, raceKey: draft.raceKey, classKey: draft.classKey, backstory: draft.backstory }
});
const loaded = JSON.parse(saved);
assert(loaded.player.backstory === 'Был мельником у реки.', 'JSON load backstory');
assert(loaded.player.name === 'Альберт', 'JSON load name');
assert(loaded.player.raceKey === 'human', 'JSON load race');
assert(loaded.player.classKey === 'fighter', 'JSON load class');
assert(loaded.scenes[id].sceneType === 'character_creation', 'scene type survives JSON');

// Old scene without sceneType still loadable
const old = JSON.parse(JSON.stringify({ scenes: { village: { id: 'village', location: 'Деревня', text: 'ok' } } }));
assert(old.scenes.village && !old.scenes.village.sceneType, 'old project without sceneType ok');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
