#!/usr/bin/env node
/**
 * Phase 1.5 — viewport drag/resize/asset/history (headless data layer)
 */
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

const historyLog = [];
const ctx = {
  console,
  document: undefined,
  ACTION_REGISTRY: {
    change_scene: {},
    add_item: {},
    remove_item: {},
    add_gold: {},
    say: {},
    update_quest: {}
  },
  EditorHistory: {
    clone(v) {
      return JSON.parse(JSON.stringify(v));
    },
    recordMutation(c, before) {
      historyLog.push({ type: c.type, id: c.id, beforeNodes: before?.visual?.nodes?.length });
    }
  },
  Editor: {
    data: {
      assets: {
        village_bg: { src: 'assets/images/village.png', name: 'Деревня' },
        tavern_img: { src: 'assets/images/tavern.png', name: 'Таверна' }
      },
      scenes: {
        village: { id: 'village', location: 'Деревня', text: 'Площадь' },
        tavern: { id: 'tavern', location: 'Таверна', text: 'Внутри' }
      },
      items: {},
      quests: {}
    },
    currentScene: 'village',
    escapeHtml: (s) => String(s),
    escapeAttr: (s) => String(s),
    markDirty() {
      this._dirty = true;
    },
    hooks: { after() {}, register() {} }
  }
};
ctx.globalThis = ctx;
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-visual-scene.js'), 'utf8'), ctx);

const E = ctx.Editor;

// Viewport model from data
assert(typeof E.visualApplyTransformLive === 'function', 'live transform API');
assert(typeof E.visualSetAsset === 'function', 'asset API');
assert(typeof E.listVisualAssets === 'function', 'list assets');

const assets = E.listVisualAssets();
assert(assets.some((a) => a.id === 'village_bg'), 'lists village_bg');
assert(assets.some((a) => a.src.indexOf('village.png') !== -1), 'asset src');

// Background asset
E.visualSetAsset('background', 'village_bg');
assert(E.data.scenes.village.visual.background.asset.ref === 'village_bg', 'bg ref');
assert(E.data.scenes.village.visual.background.asset.src.indexOf('village') !== -1, 'bg src resolved');

// Image node + asset
const imgId = E.visualAddNode('image');
E.visualSetAsset(imgId, 'tavern_img');
const img = E.data.scenes.village.visual.nodes.find((n) => n.id === imgId);
assert(img.kind === 'image', 'image kind');
assert(img.asset.ref === 'tavern_img', 'image asset ref');

// Hotspot + dimensions + OpenScene
const hsId = E.visualAddNode('hotspot');
historyLog.length = 0;
// simulate drag as one gesture: live updates + one recordMutation via end pattern
const before = ctx.EditorHistory.clone(E.data.scenes.village);
E.visualApplyTransformLive(hsId, { x: 0.1, y: 0.4, w: 0.2, h: 0.25 });
E.visualApplyTransformLive(hsId, { x: 0.12, y: 0.42, w: 0.2, h: 0.25 });
E.visualApplyTransformLive(hsId, { x: 0.15, y: 0.45, w: 0.18, h: 0.22 });
// single history entry (manual end)
ctx.EditorHistory.recordMutation({ type: 'scene', id: 'village' }, before);
assert(historyLog.length === 1, 'drag recorded as one mutation');

const hs = E.data.scenes.village.visual.nodes.find((n) => n.id === hsId);
assert(hs.transform.x === 0.15 && hs.transform.w === 0.18, 'drag final transform');
assert(hs.transform.w >= 0.01 && hs.transform.h >= 0.01, 'no negative size');

// Resize clamp
E.visualApplyTransformLive(hsId, { x: 0.1, y: 0.1, w: -5, h: -5 });
assert(hs.transform.w >= 0.01 && hs.transform.h >= 0.01, 'negative size prevented');

// Selection sync fields
E.visualSelectNode(hsId);
assert(E._visualSelectedNodeId === hsId, 'selection');

// OpenScene
E.visualSetClickAction(hsId, 'change_scene', 'tavern');
assert(hs.events.click[0].params.sceneId === 'tavern', 'OpenScene tavern');

// Snap
E.visualSetSnap(true, 0.05);
E.visualApplyTransformLive(hsId, { x: 0.13, y: 0.17, w: 0.2, h: 0.2 });
assert(Math.abs(hs.transform.x % 0.05) < 1e-9 || Math.abs(hs.transform.x % 0.05 - 0.05) < 1e-9, 'snap x');

// Save/load
const json = JSON.parse(JSON.stringify(E.data.scenes.village));
assert(json.visual.background.asset.ref === 'village_bg', 'save bg');
assert(json.visual.nodes.some((n) => n.kind === 'hotspot'), 'save hotspot');

// TEXT compatibility
E.data.scenes.plain = { id: 'plain', text: 'only text' };
E.currentScene = 'plain';
E.visualEnsureScene();
assert(E.data.scenes.plain.text === 'only text', 'text intact');
assert(E.data.scenes.plain.visual.nodes.length === 0, 'empty visual');

// Mixed
E.currentScene = 'village';
assert(E.data.scenes.village.text === 'Площадь', 'mixed text');
assert(E.data.scenes.village.visual.nodes.length >= 2, 'mixed visual nodes');

// Hierarchy order move still works
const a = E.visualAddNode('panel');
const b = E.visualAddNode('button');
const nodes = E.data.scenes.village.visual.nodes;
const ia = nodes.findIndex((n) => n.id === a);
E.visualMoveNode(a, 1);
assert(nodes.findIndex((n) => n.id === a) !== ia, 'reorder');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
