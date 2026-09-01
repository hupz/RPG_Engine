#!/usr/bin/env node
/**
 * Phase 1.3 — Visual Scene foundation tests (headless).
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

const ctx = {
  console,
  module: { exports: {} },
  exports: {},
  globalThis: null,
  window: null,
  document: undefined
};
ctx.globalThis = ctx;
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync(path.join(root, 'js/game-ui/visual-runtime.js'), 'utf8'),
  ctx,
  { filename: 'visual-runtime.js' }
);

const VR = ctx.VisualRuntime;
assert(!!VR, 'VisualRuntime global');
assert(Array.isArray(VR.MVP_KINDS), 'MVP_KINDS');
assert(VR.MVP_KINDS.indexOf('hotspot') !== -1, 'kind hotspot');
assert(VR.MVP_KINDS.indexOf('image') !== -1, 'kind image');
assert(VR.MVP_KINDS.indexOf('button') !== -1, 'kind button');
assert(VR.MVP_KINDS.indexOf('text') !== -1, 'kind text');
assert(VR.MVP_KINDS.indexOf('panel') !== -1, 'kind panel');

// Legacy scene without visual
assert(VR.normalizeVisual({}) === null, 'no visual → null');
assert(VR.normalizeVisual({ text: 'hi' }) === null, 'text-only scene → null');
assert(VR.normalizeVisual({ visual: { mode: 'none' } }).mode === 'none', 'mode none');

// Image node
const imgScene = {
  visual: {
    mode: 'overlay',
    nodes: [
      {
        id: 'bg_img',
        kind: 'image',
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        asset: { type: 'image', src: 'assets/images/village.png' }
      }
    ]
  }
};
const nv = VR.normalizeVisual(imgScene);
assert(nv && nv.nodes.length === 1, 'image node normalized');
assert(nv.nodes[0].kind === 'image', 'kind image');
assert(nv.nodes[0].asset && nv.nodes[0].asset.src.indexOf('village') !== -1, 'image asset src');

// Hotspot + OpenScene alias
const hs = VR.createHotspot('tavern', { x: 0.1, y: 0.2, w: 0.15, h: 0.2, z: 3 }, 'tavern_inside');
assert(hs.kind === 'hotspot', 'createHotspot kind');
assert(hs.events.click[0].action === 'change_scene', 'hotspot uses change_scene');
assert(hs.events.click[0].params.sceneId === 'tavern_inside', 'hotspot target scene');

const alias = VR.normalizeAction({ action: 'OpenScene', params: { sceneId: 'shop' } });
assert(alias.action === 'change_scene' && alias.params.sceneId === 'shop', 'OpenScene → change_scene');

// Village demo
const village = VR.createVillageDemoVisual();
assert(village.nodes.length === 4, 'village has 4 hotspots');
const ids = village.nodes.map((n) => n.id).sort();
assert(ids.join(',') === 'chapel,shop,smithy,tavern', 'village hotspot ids');
village.nodes.forEach((n) => {
  assert(n.events.click[0].action === 'change_scene', n.id + ' opens scene');
  assert(n.events.click[0].params.sceneId === n.id, n.id + ' target matches id');
});

// Mixed text + visual
const mixed = {
  id: 'village',
  text: 'Вы на площади.',
  choices: [{ text: 'Уйти', to: 'road' }],
  visual: village
};
const nm = VR.normalizeVisual(mixed);
assert(nm.nodes.length === 4 && mixed.text === 'Вы на площади.', 'mixed text+visual preserves text');

// Save/load round-trip (JSON)
const raw = JSON.parse(JSON.stringify({ scenes: { village: mixed } }));
const loaded = VR.normalizeVisual(raw.scenes.village);
assert(loaded.nodes.length === 4, 'JSON round-trip nodes');

// Headless mount + click → showScene
const visited = [];
const engine = {
  data: {
    assets: { village_bg: { src: 'assets/images/village.png' } },
    scenes: {
      village: { id: 'village', text: 'square', visual: village },
      tavern: { id: 'tavern', text: 'tavern inside' },
      smithy: { id: 'smithy', text: 'forge' },
      shop: { id: 'shop', text: 'shop' },
      chapel: { id: 'chapel', text: 'church' }
    }
  },
  state: { scene: null },
  showScene(id) {
    visited.push(id);
    this.state.scene = id;
  },
  runAction(action, params) {
    if (action === 'change_scene' && params.sceneId) this.showScene(params.sceneId);
    return Promise.resolve(true);
  }
};

assert(VR.mount(engine, 'village', engine.data.scenes.village) === true, 'headless mount village');
assert(VR.getMountState().nodeCount === 4, 'mounted 4 nodes');
assert(VR.getMountState().sceneId === 'village', 'mount sceneId');

// Simulate clicks
const tavernNode = village.nodes.find((n) => n.id === 'tavern');
return VR.runClickActions(engine, tavernNode.events.click).then(function () {
  assert(visited[0] === 'tavern', 'click tavern → OpenScene tavern');
  return VR.runClickActions(engine, village.nodes.find((n) => n.id === 'chapel').events.click);
}).then(function () {
  assert(visited[1] === 'chapel', 'click chapel → chapel');
  VR.unmount(engine);
  assert(VR.getMountState().nodeCount === 0, 'unmount clears');

  // Old text scene mount no-op
  assert(VR.mount(engine, 'plain', { text: 'only text' }) === false, 'text scene no visual mount');

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}).catch(function (e) {
  console.error(e);
  process.exit(1);
});
