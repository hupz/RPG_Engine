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

const typesSrc = fs.readFileSync(path.join(root, 'js/editor/editor-scene-types.js'), 'utf8');
const builderSrc = fs.readFileSync(path.join(root, 'js/editor/editor-scene-builder.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'editor.html'), 'utf8');

assert(typesSrc.includes("id: 'dialog'"), 'dialog type');
assert(typesSrc.includes("id: 'combat'"), 'combat type');
assert(typesSrc.includes("id: 'shop'"), 'shop type');
assert(typesSrc.includes("id: 'blacksmith'"), 'blacksmith type');
assert(typesSrc.includes("id: 'church'"), 'church type');
assert(typesSrc.includes("id: 'hub'"), 'hub type');
assert(typesSrc.includes("id: 'quest'"), 'quest type');
assert(typesSrc.includes("id: 'reward'"), 'reward type');
assert(typesSrc.includes("id: 'transition'"), 'transition type');
assert(typesSrc.includes("id: 'custom'"), 'custom type');
assert(builderSrc.includes("sceneType: 'custom'"), 'new scene default custom');
assert(html.includes('editor-scene-types.js'), 'script included');
assert(!/force\s*:\s*true/.test(typesSrc.replace(/\/\/.*$/gm,'')), 'no force:true in code');
assert(!typesSrc.includes('Editor.switchTab ='), 'no switchTab assign');
assert(!typesSrc.includes('Editor.renderAll ='), 'no renderAll assign');

const document = {
  querySelectorAll() { return []; },
  createElement() { return { style: {}, classList: { add() {} }, appendChild() {}, querySelector() { return null; } }; }
};
const ctx = {
  Editor: {
    data: {
      scenes: {
        old: { id: 'old', location: 'Старая', text: 'hi', choices: [] },
        shop_legacy: { id: 'shop_legacy', special: 'shop', location: 'Лавка' }
      }
    },
    currentScene: 'old',
    escapeHtml(s) { return String(s); },
    updateJSONPreview() {},
    renderSceneEditor() {},
    renderSceneList() {},
    hooks: { after() {} }
  },
  console, document, window: {}, Object, Array, String, Map, Set
};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(typesSrc, ctx);
const E = ctx.Editor;

// old scene without sceneType
assert(E.inferSceneType(E.data.scenes.old) === 'custom', 'scene without sceneType → custom');
assert(E.getSceneType('old') === 'custom', 'getSceneType fallback');

// legacy special
assert(E.inferSceneType(E.data.scenes.shop_legacy) === 'shop', 'infer from special=shop');

// set type merges modules, keeps id
E.data.scenes.old.editorModules = ['story', 'audio'];
E.setSceneType('combat', { sceneId: 'old' });
assert(E.data.scenes.old.sceneType === 'combat', 'sceneType set');
assert(E.data.scenes.old.id === 'old', 'scene id unchanged');
assert(E.data.scenes.old.editorModules.includes('story'), 'kept story');
assert(E.data.scenes.old.editorModules.includes('audio'), 'kept existing audio');
assert(E.data.scenes.old.editorModules.includes('combat'), 'added combat module');
assert(E.data.scenes.old.location === 'Старая', 'location unchanged');

// each type has modules
E.SCENE_TYPES.forEach((t) => {
  assert(Array.isArray(t.modules) && t.modules.length > 0, t.id + ' has modules');
});

// modal singleton not duplicated by this module
assert(!typesSrc.includes('createElement(\'div\')') || typesSrc.includes('scene-type'), 'no extra modal factory');
assert((html.match(/scene-template-picker-modal/g) || []).length <= 2, 'template modal not duplicated in html');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
