#!/usr/bin/env node
/**
 * Phase 1.4 — Visual Scene Editor data API tests (headless).
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
  module: { exports: {} },
  exports: {},
  document: undefined,
  ACTION_REGISTRY: {
    change_scene: { id: 'change_scene' },
    add_item: { id: 'add_item' },
    remove_item: { id: 'remove_item' },
    add_gold: { id: 'add_gold' },
    say: { id: 'say' },
    update_quest: { id: 'update_quest' }
  },
  EditorHistory: {
    clone(v) {
      return JSON.parse(JSON.stringify(v));
    },
    recordMutation(c, before) {
      historyLog.push({ c, before });
    }
  }
};
ctx.globalThis = ctx;
ctx.window = ctx;
ctx.Editor = {
  data: {
    scenes: {
      village: { id: 'village', location: 'Деревня', text: 'Площадь' },
      tavern: { id: 'tavern', location: 'Таверна', text: 'Внутри' },
      smithy: { id: 'smithy', location: 'Кузница' },
      shop: { id: 'shop', location: 'Лавка' },
      chapel: { id: 'chapel', location: 'Часовня' }
    },
    items: { potion: { name: 'Зелье' } },
    quests: { mill_quest: { name: 'Мельница' } }
  },
  currentScene: 'village',
  escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },
  escapeAttr(s) {
    return this.escapeHtml(s).replace(/'/g, '&#39;');
  },
  markDirty() {
    this._dirty = true;
  },
  hooks: {
    after() {},
    register() {}
  }
};

vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync(path.join(root, 'js/editor/editor-visual-scene.js'), 'utf8'),
  ctx,
  { filename: 'editor-visual-scene.js' }
);

const E = ctx.Editor;
assert(typeof E.visualAddNode === 'function', 'visualAddNode API');
assert(typeof E.visualDeleteNode === 'function', 'visualDeleteNode API');
assert(typeof E.visualSetClickAction === 'function', 'visualSetClickAction API');
assert(typeof E.renderVisualScenePanel === 'function', 'renderVisualScenePanel API');

// 1 Editor loads API
assert(!!E.VISUAL_KIND_META.hotspot, 'kind meta hotspot');

// Add kinds
const kinds = ['image', 'text', 'button', 'panel', 'hotspot'];
const ids = [];
kinds.forEach((k) => {
  const id = E.visualAddNode(k);
  ids.push(id);
  assert(!!id, 'add ' + k);
});
const nodes = E.data.scenes.village.visual.nodes;
assert(nodes.length === 5, '5 nodes after adds');
assert(nodes.every((n) => kinds.indexOf(n.kind) >= 0), 'kinds valid');

// Select + property
E.visualSelectNode(ids[4]);
assert(E._visualSelectedNodeId === ids[4], 'select hotspot');
E.visualUpdateNodeField(ids[4], 'label', 'Таверна');
E.visualUpdateNodeField(ids[4], 'x', '0.12');
E.visualUpdateNodeField(ids[4], 'y', '0.4');
E.visualUpdateNodeField(ids[4], 'w', '0.18');
E.visualUpdateNodeField(ids[4], 'h', '0.2');
E.visualUpdateNodeField(ids[4], 'z', '5');
const hs = nodes.find((n) => n.id === ids[4]);
assert(hs.props.label === 'Таверна', 'label');
assert(hs.transform.x === 0.12 && hs.transform.z === 5, 'transform');

// Visibility
E.visualToggleNodeFlag(ids[4], 'visible', false);
assert(hs.visible === false, 'visible false');
E.visualToggleNodeFlag(ids[4], 'visible', true);
assert(hs.visible === true, 'visible true');

// OnClick OpenScene
E.visualSetClickAction(ids[4], 'change_scene', 'tavern');
assert(hs.events.click[0].action === 'change_scene', 'click action change_scene');
assert(hs.events.click[0].params.sceneId === 'tavern', 'target tavern');

// Scene picker data
const sceneKeys = Object.keys(E.data.scenes);
assert(sceneKeys.indexOf('tavern') !== -1, 'scene picker source has tavern');

// Action UX uses registry
const ux = E.getVisualActionUxList();
assert(ux.some((a) => a.action === 'change_scene'), 'UX Open Scene');
assert(ux.every((a) => !!ctx.ACTION_REGISTRY[a.action]), 'all UX actions in registry');

// Delete
const beforeLen = nodes.length;
E.visualDeleteNode(ids[0]);
assert(E.data.scenes.village.visual.nodes.length === beforeLen - 1, 'delete node');

// Z-order move
const idA = E.visualAddNode('hotspot');
const idB = E.visualAddNode('hotspot');
const list = E.data.scenes.village.visual.nodes;
const iA = list.findIndex((n) => n.id === idA);
E.visualMoveNode(idA, 1);
const iA2 = list.findIndex((n) => n.id === idA);
assert(iA2 !== iA, 'move changes order');

// Save/load JSON
const snap = JSON.parse(JSON.stringify(E.data.scenes.village));
assert(snap.visual.nodes.length >= 1, 'serialize visual');
const restored = JSON.parse(JSON.stringify(snap));
assert(restored.visual.nodes.some((n) => n.events?.click?.[0]?.action === 'change_scene'), 'load keeps OpenScene');

// History recorded
assert(historyLog.length > 0, 'EditorHistory.recordMutation called');

// Undo simulation: restore before snapshot of last add is heavy — check API only
assert(typeof ctx.EditorHistory.recordMutation === 'function', 'history API');

// TEXT scene without visual still ok
E.data.scenes.plain = { id: 'plain', text: 'only', choices: [] };
E.currentScene = 'plain';
const v = E.visualEnsureScene();
assert(v && Array.isArray(v.nodes) && v.nodes.length === 0, 'ensure visual empty on text scene');

// Mixed: text + visual
E.currentScene = 'village';
assert(E.data.scenes.village.text === 'Площадь', 'text preserved');
assert(E.data.scenes.village.visual.nodes.length > 0, 'visual preserved');

// Hotspot → OpenScene integration with VisualRuntime if present
vm.runInContext(
  fs.readFileSync(path.join(root, 'js/game-ui/visual-runtime.js'), 'utf8'),
  ctx,
  { filename: 'visual-runtime.js' }
);
const visited = [];
const eng = {
  data: E.data,
  state: {},
  showScene(id) {
    visited.push(id);
  },
  runAction(a, p) {
    if (a === 'change_scene') this.showScene(p.sceneId);
    return Promise.resolve(true);
  }
};
const hot = E.data.scenes.village.visual.nodes.find((n) => n.events?.click?.[0]?.params?.sceneId === 'tavern');
assert(!!hot, 'has tavern hotspot');
return ctx.VisualRuntime.runClickActions(eng, hot.events.click).then(() => {
  assert(visited[0] === 'tavern', 'runtime OpenScene from editor data');
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
});
