#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
let passed = 0, failed = 0;
function assert(c, m) { if (c) { passed++; console.log('  ✓', m); } else { failed++; console.error('  ✗', m); } }

const src = fs.readFileSync(path.join(root, 'js/editor/editor-game-ui.js'), 'utf8');
assert(src.includes('beginGesture'), 'gesture begin');
assert(src.includes('endGesture'), 'gesture end');
assert(src.includes('snapVal'), 'snapVal');
assert(src.includes('uiSetSnap'), 'uiSetSnap');
assert(src.includes('uiPickAsset'), 'uiPickAsset');
assert(src.includes('openSharedAssetPicker'), 'uses shared asset picker');
assert(src.includes('ui-snap-toggle'), 'snap toggle UI');
assert(!/Editor\.switchTab\s*=(?!=)/.test(src), 'no switchTab monkey-patch');

const vis = fs.readFileSync(path.join(root, 'js/editor/editor-visual-scene.js'), 'utf8');
assert(vis.includes('openSharedAssetPicker'), 'shared picker defined in visual module');

const ctx = { console, document: undefined, window: null, globalThis: null, module: { exports: {} } };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/game-ui/ui-runtime.js'), 'utf8'), ctx);

const history = [];
const ectx = {
  console,
  document: { getElementById() { return null; }, createElement() { return { style: {}, appendChild() {}, dataset: {} }; } },
  window: null, globalThis: null,
  Editor: {
    data: { ui: { screens: {} }, scenes: { village: {} }, assets: {
      diary_icon: { type: 'image', src: 'assets/images/diary.svg', name: 'Diary' },
      bag_icon: { type: 'image', src: 'assets/images/bag.svg', name: 'Bag' }
    }},
    history: { recordMutation(op) { history.push(op); } },
    markDirty() {},
    hooks: { after() {} },
    toast: { success() {}, error() {} },
    openSharedAssetPicker(onSelect) {
      onSelect({ id: 'diary_icon', src: 'assets/images/diary.svg', name: 'Diary', ref: 'diary_icon' });
    }
  },
  UIRuntime: ctx.UIRuntime
};
ectx.window = ectx; ectx.globalThis = ectx;
ectx.Editor = ectx.Editor;
vm.createContext(ectx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-game-ui.js'), 'utf8'), ectx);
const Ed = ectx.Editor;

Ed.uiAddScreen('test_hud');
Ed._uiSelectedScreen = 'test_hud';
Ed.uiAddNode('image');
const nodes = Ed.data.ui.screens.test_hud.nodes;
const id = nodes[0].id;

// Snap
Ed.uiSetSnap(true, 0.1);
assert(Ed.uiGetSnap().enabled === true, 'snap enabled');
assert(Ed.uiGetSnap().grid === 0.1, 'snap grid');
Ed.uiApplyLiveTransform(id, { x: 0.14, y: 0.26, w: 0.15, h: 0.12 });
assert(Math.abs(nodes[0].transform.x - 0.1) < 0.001, 'snap x to 0.1');
assert(Math.abs(nodes[0].transform.y - 0.3) < 0.001, 'snap y to 0.3');

Ed.uiSetSnap(false, 0.05);
const hist0 = history.length;
Ed.uiBeginGesture(id, 'move', null, 0, 0);
Ed.uiApplyLiveTransform(id, { x: 0.55, y: 0.55, w: 0.2, h: 0.1 });
Ed.uiApplyLiveTransform(id, { x: 0.6, y: 0.6, w: 0.2, h: 0.1 });
Ed.uiEndGesture();
assert(history.length === hist0 + 1, 'drag = one history mutation');

const hist1 = history.length;
const beforeR = JSON.parse(JSON.stringify(nodes[0].transform));
Ed.uiBeginGesture(id, 'resize', 'se', 0, 0);
Ed.uiApplyLiveTransform(id, { x: beforeR.x, y: beforeR.y, w: 0.3, h: 0.2 });
Ed.uiEndGesture();
assert(history.length === hist1 + 1, 'resize = one history mutation');

// Asset picker
Ed.uiPickAsset(id);
assert(nodes[0].asset && nodes[0].asset.src === 'assets/images/diary.svg', 'asset from shared picker');
assert(nodes[0].asset.ref === 'diary_icon', 'asset ref set');
assert(nodes[0].transform.x === 0.6 || nodes[0].transform.w === 0.3, 'transform kept after asset');

// Undo style: last history has undo
const last = history[history.length - 1];
assert(typeof last.undo === 'function', 'history undo fn');

const demo = JSON.parse(fs.readFileSync(path.join(root, 'data/demos/visual_village.json'), 'utf8'));
assert(!!demo.ui?.screens?.rpg_hud, 'demo hud');
assert(!!demo.scenes?.village?.visual, 'demo visual');

const rt = fs.readFileSync(path.join(root, 'js/game-ui/ui-runtime.js'), 'utf8');
assert(!/\bEditor\./.test(rt), 'UIRuntime no Editor');

// Phase 1.10.4B — condition ALL/ANY on Game UI (needs condition catalog)
const cctx = {
  console,
  document: { getElementById() { return null; }, createElement() { return { style: {}, appendChild() {}, dataset: {} }; } },
  window: null, globalThis: null,
  Editor: {
    data: { ui: { screens: {} }, scenes: { village: {} }, items: { potion: { name: 'P' } } },
    history: { recordMutation() {} },
    markDirty() {},
    hooks: { after() {} },
    toast: { success() {}, error() {} }
  },
  UIRuntime: ctx.UIRuntime
};
cctx.window = cctx; cctx.globalThis = cctx;
vm.createContext(cctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/conditions.js'), 'utf8') + '\nif (typeof ConditionSystem !== "undefined") this.ConditionSystem = ConditionSystem;', cctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-condition-catalog.js'), 'utf8'), cctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-game-ui.js'), 'utf8'), cctx);
const CE = cctx.Editor;
CE.uiAddScreen('hud_cond');
CE._uiSelectedScreen = 'hud_cond';
CE.uiAddNode('button');
const bid = CE.data.ui.screens.hud_cond.nodes[0].id;
CE.uiAddCondition(bid, 'hasItem');
CE.uiSetConditionParamAt(bid, 0, 'hasItem', 'potion');
CE.uiAddCondition(bid, 'goldMin');
CE.uiSetConditionParamAt(bid, 1, 'goldMin', 10);
let bn = CE.data.ui.screens.hud_cond.nodes[0];
assert(bn.showIf && bn.showIf.all && bn.showIf.all.length === 2, 'ui showIf all default');
CE.uiSetConditionMode(bid, 'any');
bn = CE.data.ui.screens.hud_cond.nodes[0];
assert(bn.showIf.any && bn.showIf.any.length === 2 && !bn.showIf.all, 'ui showIf any');
assert(src.includes('uiSetConditionMode'), 'uiSetConditionMode in source');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
