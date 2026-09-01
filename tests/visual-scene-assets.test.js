#!/usr/bin/env node
/**
 * Phase 1.8 — real demo assets, missing fallback, save/load refs, no Editor in runtime
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

// Real files on disk
const villageSvg = path.join(root, 'assets/images/village.svg');
const diarySvg = path.join(root, 'assets/images/diary.svg');
const bagSvg = path.join(root, 'assets/images/bag.svg');
assert(fs.existsSync(villageSvg), 'village.svg exists');
assert(fs.existsSync(diarySvg), 'diary.svg exists');
assert(fs.existsSync(bagSvg), 'bag.svg exists');
assert(fs.statSync(villageSvg).size > 100, 'village.svg non-empty');
assert(fs.readFileSync(villageSvg, 'utf8').includes('<svg'), 'village is SVG');

const demo = JSON.parse(fs.readFileSync(path.join(root, 'data/demos/visual_village.json'), 'utf8'));
assert(demo.assets.village_bg.src.endsWith('.svg'), 'demo bg uses svg');
assert(demo.assets.diary_icon.src.endsWith('.svg'), 'demo diary uses svg');
assert(demo.assets.bag_icon.src.endsWith('.svg'), 'demo bag uses svg');

// Paths in demo match files
['village_bg', 'diary_icon', 'bag_icon'].forEach((key) => {
  const rel = demo.assets[key].src;
  assert(fs.existsSync(path.join(root, rel)), 'file exists for ' + key);
});

// VisualRuntime: missing asset does not throw
const ctx = { console, document: undefined, window: null, globalThis: null };
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/game-ui/visual-runtime.js'), 'utf8'), ctx);

const engine = {
  data: {
    assets: {
      ok: { type: 'image', src: 'assets/images/village.svg' }
    },
    scenes: {
      v: {
        text: 'x',
        visual: {
          mode: 'overlay',
          background: { asset: { type: 'image', ref: 'missing_ref', src: 'assets/images/nope.png' } },
          nodes: [
            {
              id: 'n1',
              kind: 'image',
              transform: { x: 0, y: 0, w: 0.2, h: 0.2, z: 1 },
              visible: true,
              enabled: true,
              asset: { type: 'image', ref: 'ok' },
              events: { click: [{ action: 'change_scene', params: { sceneId: 'tavern' } }] }
            }
          ]
        }
      }
    }
  },
  state: { scene: 'v' },
  showScene() {},
  runAction() {
    return Promise.resolve(true);
  }
};

let threw = false;
try {
  const urlMissing = ctx.VisualRuntime.resolveAssetUrl(engine, {
    type: 'image',
    ref: 'missing_ref',
    src: 'assets/images/nope.png'
  });
  assert(urlMissing === 'assets/images/nope.png' || urlMissing === '', 'missing resolves to src or empty');
  const urlOk = ctx.VisualRuntime.resolveAssetUrl(engine, { type: 'image', ref: 'ok' });
  assert(urlOk === 'assets/images/village.svg', 'ref resolves via data.assets');
} catch (e) {
  threw = true;
  console.error(e);
}
assert(!threw, 'resolveAssetUrl never throws');

// Save/load OpenScene + OpenPanel params
const nodes = demo.scenes.village.visual.nodes;
const round = JSON.parse(JSON.stringify(demo));
const hs = round.scenes.village.visual.nodes.find((n) => n.id === 'hs_tavern');
const jr = round.scenes.village.visual.nodes.find((n) => n.id === 'img_journal');
assert(hs.events.click[0].action === 'change_scene', 'OpenScene serializes as change_scene');
assert(hs.events.click[0].params.sceneId === 'tavern', 'OpenScene target survives');
assert(jr.events.click[0].action === 'open_panel', 'OpenPanel serializes');
assert(jr.events.click[0].params.panel === 'journal', 'OpenPanel param survives');

// No Editor dependency in VisualRuntime source
const rtSrc = fs.readFileSync(path.join(root, 'js/game-ui/visual-runtime.js'), 'utf8');
assert(!/\bEditor\./.test(rtSrc), 'VisualRuntime has no Editor.* calls');
assert(!/require\(.*editor/.test(rtSrc), 'VisualRuntime has no editor require');

// SceneManager has no demo hardcode
const sm = fs.readFileSync(path.join(root, 'js/engine/scene-manager.js'), 'utf8');
assert(!/visual_village/.test(sm), 'SceneManager independent of demo id');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
