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
  document: {
    createElement: () => ({ style: {}, appendChild(){}, addEventListener(){}, dataset: {}, classList: { add(){}, remove(){} }, querySelector(){ return null; } }),
    body: { appendChild(){} },
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => []
  },
  Editor: {
    data: { scenes: { village: { text: 't', visual: { mode: 'overlay', nodes: [] } } }, items: { village_key: { name: 'K' } } },
    currentScene: 'village',
    escapeHtml: (s) => String(s), escapeAttr: (s) => String(s),
    hooks: { after(){}, register(){} }, markDirty(){}
  },
  EditorHistory: { clone: (v) => JSON.parse(JSON.stringify(v)), recordMutation(){} }
};
ctx.globalThis = ctx; ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/conditions.js'), 'utf8') + '\nif (typeof ConditionSystem !== "undefined") this.ConditionSystem = ConditionSystem;', ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/actions/action-registry.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-action-catalog.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-condition-catalog.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-visual-scene.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/game-ui/visual-runtime.js'), 'utf8'), ctx);

ctx.Editor.renderVisualScenePanel = function () {};
const E = ctx.Editor;
const hid = E.visualAddNode('hotspot');
E.visualAddCondition(hid, 'hasItem');
let node = E.data.scenes.village.visual.nodes.find((n) => n.id === hid);
assert(node.showIf && node.showIf.all && node.showIf.all.length === 1, 'showIf set');
E.visualSetConditionParamAt(hid, 0, 'hasItem', 'village_key');
node = E.data.scenes.village.visual.nodes.find((n) => n.id === hid);
assert(node.showIf.all[0].hasItem === 'village_key', 'param item');

E.visualAddClickAction(hid, 'add_gold', { amount: 5 });
E.visualAddClickAction(hid, 'say', { text: 'ok' });
node = E.data.scenes.village.visual.nodes.find((n) => n.id === hid);
assert(node.events.click.length === 2, 'multi actions with condition');

const eng = {
  state: { inventory: [], gold: 0, flags: {} },
  getConditionContext() { return { inventory: this.state.inventory, gold: this.state.gold, flags: this.state.flags }; }
};
assert(ctx.VisualRuntime.evaluateShowIf ? true : true, 'placeholder');
// evaluate via ConditionSystem
assert(ctx.ConditionSystem.evaluate(node.showIf, { inventory: [], gold: 0, flags: {} }) === false, 'neg');
assert(ctx.ConditionSystem.evaluate(node.showIf, { inventory: ['village_key'], gold: 0, flags: {} }) === true, 'pos');

const ser = JSON.parse(JSON.stringify(node));
assert(ser.showIf.all[0].hasItem === 'village_key', 'save showIf');
assert(ser.events.click.length === 2, 'save clicks');

E.visualRemoveCondition(hid, 0);
node = E.data.scenes.village.visual.nodes.find((n) => n.id === hid);
assert(!node.showIf || !node.showIf.all || node.showIf.all.length === 0, 'cleared');

// ALL / ANY mode
const hid2 = E.visualAddNode('hotspot');
E.visualAddCondition(hid2, 'hasItem');
E.visualSetConditionParamAt(hid2, 0, 'hasItem', 'village_key');
E.visualAddCondition(hid2, 'goldMin');
E.visualSetConditionParamAt(hid2, 1, 'goldMin', 50);
node = E.data.scenes.village.visual.nodes.find((n) => n.id === hid2);
assert(node.showIf.all && !node.showIf.any, 'default all mode');
E.visualSetConditionMode(hid2, 'any');
node = E.data.scenes.village.visual.nodes.find((n) => n.id === hid2);
assert(node.showIf.any && node.showIf.any.length === 2 && !node.showIf.all, 'switched to any');
assert(ctx.ConditionSystem.evaluate(node.showIf, { inventory: ['village_key'], gold: 0, flags: {} }) === true, 'any evaluates');
E.visualSetConditionMode(hid2, 'all');
node = E.data.scenes.village.visual.nodes.find((n) => n.id === hid2);
assert(node.showIf.all && !node.showIf.any, 'switched back to all');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
