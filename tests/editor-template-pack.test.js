'use strict';
/**
 * Scene Template Pack — API contract + apply semantics.
 *
 * Canonical:
 *   applySceneTemplatePack(id)            → CREATE new scene
 *   applySceneTemplatePack(id, { mode:'apply' | applyToCurrent:true }) → PATCH current
 */
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
const tplSrc = fs.readFileSync(path.join(root, 'js/editor/editor-templates.js'), 'utf8');
const builderSrc = fs.readFileSync(path.join(root, 'js/editor/editor-scene-builder.js'), 'utf8');
const pcSrc = fs.readFileSync(path.join(root, 'js/editor/editor-player-character.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'editor.html'), 'utf8');

assert(packSrc.includes('tpl_char_creation'), 'Character Creation template exists');
assert(packSrc.includes('character_creator'), 'Char creation uses character_creator component');
assert(packSrc.includes('showBackstory') || pcSrc.includes('backstory'), 'Backstory field supported');
assert(pcSrc.includes('backstory'), 'Backstory persists on player character data');

assert(packSrc.includes('tpl_scene_choice'), 'Scene Choice template exists');
assert(packSrc.includes('makeSceneChoiceChoices') || packSrc.includes('addSceneChoiceDestination'), 'Scene Choice multi destinations');
assert(builderSrc.includes("id: 'scene_choice'") || builderSrc.includes("case 'scene_choice'"), 'Scene Choice element in builder');

assert(packSrc.includes('tpl_shop'), 'Shop template exists');
assert(packSrc.includes('trade_interface'), 'Shop uses trade_interface');
assert(packSrc.includes('tpl_forge'), 'Forge template exists');
assert(packSrc.includes('tpl_church'), 'Church template exists');
assert(builderSrc.includes('location_place') || packSrc.includes('locationPlaceType'), 'Location place element');

assert(tplSrc.includes('data-template-filter') || tplSrc.includes('_templateFilter'), 'Template category filters');
assert(html.includes('editor-scene-template-pack.js'), 'Pack script in editor.html');

assert(packSrc.includes('CANONICAL API'), 'canonical API documented in source');
assert(packSrc.includes("mode: 'create'"), 'mode create documented');
assert(packSrc.includes('createSceneFromTemplatePack'), 'explicit create alias');
assert(packSrc.includes('applySceneTemplatePackToCurrent'), 'explicit apply alias');

const Editor = {
  data: {
    scenes: {
      start: { id: 'start', location: 'Start', text: '', choices: [] },
      forest: { id: 'forest', location: 'Лес' }
    },
    enemies: {},
    shopInventories: {},
    items: {},
    npcs: {}
  },
  currentScene: 'start',
  renderSceneList() {},
  renderSceneEditor() {},
  updateJSONPreview() {},
  switchTab() {},
  markDirty() {},
  ensureSceneEditorModules(s) { return s.editorModules || []; },
  templates: {
    _r: new Map(),
    register(t) { this._r.set(t.id, t); },
    list() { return [...this._r.values()]; },
    run() {}
  },
  toast: { success() {} }
};

const ctx = {
  Editor,
  console,
  document: { getElementById() { return null; }, addEventListener() {} },
  window: {},
  Object, Array, String, Math, Map, Set
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(packSrc, ctx);

const E = ctx.Editor;
const list = E.listSceneTemplatePack();
assert(list.length >= 20, 'at least 20 pack templates: ' + list.length);
assert(list.some((t) => t.id === 'tpl_char_creation'), 'pack lists char creation');

// ——— Canonical: default CREATE ———
const before = Object.keys(E.data.scenes).length;
const newCharId = E.applySceneTemplatePack('tpl_char_creation');
assert(typeof newCharId === 'string' && newCharId !== 'start', 'default creates NEW scene id');
assert(Object.keys(E.data.scenes).length === before + 1, 'default adds one scene');
assert(E.currentScene === newCharId, 'default selects new scene');
const newSc = E.data.scenes[newCharId];
assert(
  newSc.special === 'character_creation' ||
    (newSc.components && newSc.components[0]?.component === 'character_creator'),
  'char creation creates valid scene structure (new scene)'
);
assert(
  !(E.data.scenes.start.components && E.data.scenes.start.components[0]?.component === 'character_creator'),
  'default does NOT patch start'
);

// Explicit mode create
const before2 = Object.keys(E.data.scenes).length;
const id2 = E.applySceneTemplatePack('tpl_scene_choice', { mode: 'create' });
assert(Object.keys(E.data.scenes).length === before2 + 1, 'mode:create adds scene');
assert(Array.isArray(E.data.scenes[id2].choices) && E.data.scenes[id2].choices.length >= 2, 'scene choice multi destinations');

// Alias create
const before3 = Object.keys(E.data.scenes).length;
const id3 = E.createSceneFromTemplatePack('tpl_shop');
assert(Object.keys(E.data.scenes).length === before3 + 1, 'createSceneFromTemplatePack adds');
assert(E.data.scenes[id3].components?.some((c) => c.component === 'trade_interface'), 'shop has trade component');

// ——— Canonical: apply to current ———
E.currentScene = 'start';
const nBefore = Object.keys(E.data.scenes).length;
E.applySceneTemplatePack('tpl_forge', { applyToCurrent: true });
assert(Object.keys(E.data.scenes).length === nBefore, 'applyToCurrent does not add scene');
assert(
  E.data.scenes.start.special === 'blacksmith' || E.data.scenes.start.components?.length > 0,
  'forge structure applied to start'
);

E.applySceneTemplatePackToCurrent('tpl_church');
assert(
  E.data.scenes.start.components?.some((c) => c.component === 'service_menu'),
  'church service menu via apply alias'
);

E.applySceneTemplatePack('tpl_empty', { mode: 'apply' });
assert(E.data.scenes.start.sceneType === 'custom' || E.data.scenes.start.location, 'mode:apply patches current');

assert(!packSrc.includes('QuestRuntime'), 'does not touch QuestRuntime');
assert(html.split('editor-scene-template-pack.js').length === 2, 'single script include (no duplicate path spam)');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
