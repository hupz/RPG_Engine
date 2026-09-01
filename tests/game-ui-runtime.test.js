#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log('  ✓', msg);
  } else {
    failed++;
    console.error('  ✗', msg);
  }
}

const ctx = { console, document: undefined, window: null, globalThis: null, module: { exports: {} } };
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/game-ui/ui-runtime.js'), 'utf8'), ctx);
const UI = ctx.UIRuntime;

assert(!!UI, 'UIRuntime exported');
assert(UI.UI_KINDS.includes('button'), 'button kind');
assert(UI.UI_KINDS.includes('bar'), 'bar kind');
assert(UI.BINDINGS.includes('player.gold'), 'gold binding');

const data = { ui: { screens: {} } };
UI.ensureProjectUi(data);
assert(!!data.ui.screens, 'ensureProjectUi');

const hud = UI.presets.basic_hud();
assert(hud.scope === 'persistent', 'hud persistent');
assert(hud.nodes.some((n) => n.kind === 'bar'), 'hud has bar');
assert(hud.nodes.some((n) => n.kind === 'button'), 'hud has button');
assert(
  hud.nodes.some(
    (n) =>
      n.events?.click?.[0]?.action === 'open_panel' &&
      n.events.click[0].params.panel === 'journal'
  ),
  'journal open_panel in hud'
);

const menu = UI.presets.main_menu();
assert(menu.nodes.some((n) => n.kind === 'button'), 'main menu buttons');

const eng = {
  data: {
    ui: {
      screens: {
        basic_hud: hud,
        village_only: {
          id: 'village_only',
          scope: 'scene',
          sceneId: 'village',
          nodes: [
            {
              id: 'vbtn',
              kind: 'button',
              transform: { x: 0.1, y: 0.1, w: 0.2, h: 0.08, z: 1 },
              text: 'Only village',
              events: { click: [{ action: 'change_scene', params: { sceneId: 'tavern' } }] }
            }
          ]
        }
      }
    },
    assets: {}
  },
  state: { hp: 12, maxHp: 20, gold: 50, level: 3, charName: 'Алекс' },
  actions: [],
  runAction(a, p) {
    this.actions.push({ a, p });
    return Promise.resolve(true);
  },
  showScene() {}
};

assert(UI.resolveBinding(eng, 'player.gold') === '50', 'bind gold');
assert(UI.resolveBinding(eng, 'player.level') === '3', 'bind level');
assert(UI.resolveBinding(eng, 'player.name') === 'Алекс', 'bind name');
assert(UI.applyTextTemplate(eng, 'Gold: {gold}') === 'Gold: 50', 'template gold');
assert(UI.applyTextTemplate(eng, 'HP {hp}/{maxHp}') === 'HP 12/20', 'template hp');

const screens = UI.listScreens(eng.data);
assert(screens.length === 2, 'list screens');
assert(screens.filter((s) => s.scope === 'persistent').length === 1, 'one persistent');
assert(screens.filter((s) => s.scope === 'scene' && s.sceneId === 'village').length === 1, 'scene scoped');

// No Editor dependency
const src = fs.readFileSync(path.join(root, 'js/game-ui/ui-runtime.js'), 'utf8');
assert(!/\bEditor\./.test(src), 'runtime has no Editor');

// Serialize
const round = JSON.parse(JSON.stringify(eng.data.ui));
assert(round.screens.basic_hud.nodes.length === hud.nodes.length, 'serialize nodes');

// Click action path
return UI.runClick(eng, [{ action: 'open_panel', params: { panel: 'inventory' } }]).then(() => {
  assert(eng.actions[0]?.a === 'open_panel', 'runClick open_panel');
  assert(eng.actions[0]?.p?.panel === 'inventory', 'inventory panel');

  // Preset nodes are editable plain objects (not monolithic)
  const n0 = hud.nodes[0];
  n0.transform.x = 0.5;
  assert(n0.transform.x === 0.5, 'preset node editable');

  // registry has load_game
  const reg = fs.readFileSync(path.join(root, 'js/actions/action-registry.js'), 'utf8');
  assert(/load_game:\s*\{/.test(reg), 'load_game in registry');
  assert(/save_game:\s*\{/.test(reg), 'save_game in registry');

  // SceneManager references UIRuntime softly
  const sm = fs.readFileSync(path.join(root, 'js/engine/scene-manager.js'), 'utf8');
  assert(/UIRuntime/.test(sm), 'SceneManager mounts UIRuntime');

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
});
