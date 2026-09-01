#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
let passed = 0, failed = 0;
function assert(c, m) { if (c) { passed++; console.log('  ✓', m); } else { failed++; console.error('  ✗', m); } }

const ctx = {
  console,
  window: {},
  globalThis: null,
  Editor: {
    data: {
      scenes: { village: { id: 'village', text: 't', visual: { mode: 'overlay', nodes: [] } }, tavern: {} },
      items: { potion: { name: 'Зелье' } },
      quests: { q1: { name: 'Q' } }
    },
    currentScene: 'village',
    escapeHtml: (s) => String(s),
    escapeAttr: (s) => String(s),
    hooks: { after() {}, register() {} },
    markDirty() {}
  },
  EditorHistory: {
    clone: (v) => JSON.parse(JSON.stringify(v)),
    recordMutation() {}
  },
  ACTION_REGISTRY: null
};
ctx.globalThis = ctx;
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/actions/action-registry.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-action-catalog.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-visual-scene.js'), 'utf8'), ctx);

const E = ctx.Editor;
assert(typeof E.getActionMacros === 'function', 'getActionMacros');
const macros = E.getActionMacros();
assert(macros.length >= 5, 'macros count');
assert(macros.every((m) => m.steps && m.steps.length), 'macros have steps');
assert(
  macros.every((m) => m.steps.every((s) => !!ctx.ACTION_REGISTRY[s.action])),
  'macro steps in registry'
);
assert(!macros.some((m) => m.steps.some((s) => s.macro)), 'no macro id in steps');

const hid = E.visualAddNode('hotspot');
E.visualSetClickAction(hid, 'change_scene', 'tavern');
let node = E.data.scenes.village.visual.nodes.find((n) => n.id === hid);
assert(node.events.click.length === 1, 'single action');
assert(node.events.click[0].params.sceneId === 'tavern', 'single sceneId');

E.visualAddClickAction(hid, 'add_gold', { amount: 5 });
E.visualAddClickAction(hid, 'say', { text: 'ok' });
node = E.data.scenes.village.visual.nodes.find((n) => n.id === hid);
assert(node.events.click.length === 3, 'multi length 3');
assert(node.events.click[0].action === 'change_scene', 'order 0');
assert(node.events.click[1].action === 'add_gold', 'order 1');
assert(node.events.click[2].action === 'say', 'order 2');

E.visualMoveClickAction(hid, 2, -1);
node = E.data.scenes.village.visual.nodes.find((n) => n.id === hid);
assert(node.events.click[1].action === 'say', 'moved up');
assert(node.events.click[2].action === 'add_gold', 'moved down');

E.visualRemoveClickAction(hid, 1);
node = E.data.scenes.village.visual.nodes.find((n) => n.id === hid);
assert(node.events.click.length === 2, 'after delete');
assert(node.events.click[1].action === 'add_gold', 'remaining');

E.visualSetClickParamAt(hid, 1, 'amount', 99);
node = E.data.scenes.village.visual.nodes.find((n) => n.id === hid);
assert(node.events.click[1].params.amount === 99, 'param at index');

const before = node.events.click.length;
E.visualApplyClickMacro(hid, 'loot_chest');
node = E.data.scenes.village.visual.nodes.find((n) => n.id === hid);
const lootMacro = E.getActionMacros().find((m) => m.id === 'loot_chest');
const lootSteps = (lootMacro && lootMacro.steps) ? lootMacro.steps.length : 3;
assert(node.events.click.length === before + lootSteps, 'macro appends loot_chest steps (' + lootSteps + ')');
assert(node.events.click.slice(before).every((s) => typeof s.action === 'string' && s.action !== 'loot_chest'), 'macro expands to registry');
assert(node.events.click.slice(before).some((s) => s.action === 'say'), 'loot has say');
assert(node.events.click.slice(before).some((s) => s.action === 'add_item'), 'loot has add_item');
assert(node.events.click.slice(before).some((s) => s.action === 'add_gold'), 'loot has add_gold');

const ser = JSON.parse(JSON.stringify(node.events.click));
assert(ser[0].action === 'change_scene', 'save order');
assert(ser.length === node.events.click.length, 'roundtrip length');

const unknown = [{ action: 'future_action', params: { x: 1 } }, { action: 'change_scene', params: { sceneId: 'tavern' } }];
node.events.click = unknown;
assert(node.events.click[0].action === 'future_action', 'unknown preserved');

assert(!/\bEditor\./.test(fs.readFileSync(path.join(root, 'js/game-ui/visual-runtime.js'), 'utf8')), 'VisualRuntime no Editor');
assert(!/\bEditor\./.test(fs.readFileSync(path.join(root, 'js/game-ui/ui-runtime.js'), 'utf8')), 'UIRuntime no Editor');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
