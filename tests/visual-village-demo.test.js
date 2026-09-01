#!/usr/bin/env node
/**
 * Phase 1.7 — Demo Village data + navigation architecture (no hardcoded engine branches)
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

const demoPath = path.join(root, 'data/demos/visual_village.json');
assert(fs.existsSync(demoPath), 'visual_village.json exists');
const demo = JSON.parse(fs.readFileSync(demoPath, 'utf8'));

assert(demo.meta?.campaignId === 'visual_village', 'isolated campaignId');
assert(demo.meta?.campaignId !== 'pf2e_mill', 'not mill campaign');
assert(!!demo.scenes?.village?.visual, 'village has visual');
assert(demo.scenes.village.visual.mode === 'overlay', 'overlay mode');
assert(!!demo.scenes.village.visual.background?.asset, 'background asset');

const nodes = demo.scenes.village.visual.nodes || [];
const hotspots = nodes.filter((n) => n.kind === 'hotspot');
assert(hotspots.length >= 4, 'at least 4 hotspots');

function clickAction(node) {
  return node.events?.click?.[0];
}

const tavern = nodes.find((n) => n.id === 'hs_tavern');
const shop = nodes.find((n) => n.id === 'hs_shop');
const smithy = nodes.find((n) => n.id === 'hs_smithy');
const chapel = nodes.find((n) => n.id === 'hs_chapel');
const journal = nodes.find((n) => n.id === 'img_journal');

assert(clickAction(tavern)?.action === 'change_scene', 'tavern change_scene');
assert(clickAction(tavern)?.params?.sceneId === 'tavern', 'tavern → tavern');
assert(clickAction(shop)?.params?.sceneId === 'jack_shop', 'shop → jack_shop');
assert(clickAction(smithy)?.params?.sceneId === 'smithy', 'smithy → smithy');
assert(clickAction(chapel)?.params?.sceneId === 'chapel', 'chapel → chapel');
assert(clickAction(journal)?.action === 'open_panel', 'journal open_panel');
assert(clickAction(journal)?.params?.panel === 'journal', 'panel journal');

// Destination TEXT scenes (no visual required)
['tavern', 'jack_shop', 'smithy', 'chapel'].forEach((id) => {
  const s = demo.scenes[id];
  assert(!!s && !!s.text, id + ' TEXT scene');
  assert(!s.visual || !s.visual.nodes?.length, id + ' is text-only (or empty visual)');
  const back = (s.choices || []).some((c) => c.to === 'village');
  assert(back, id + ' returns to village');
});

// Mixed: village has text + visual
assert(!!demo.scenes.village.text, 'village text present');
assert(nodes.length > 0, 'village visual nodes');

// Serialization round-trip
const again = JSON.parse(JSON.stringify(demo));
assert(again.scenes.village.visual.nodes.length === nodes.length, 'serialize nodes');
assert(again.assets.village_bg.src, 'assets survive');

// Registry ids only
const allowed = new Set([
  'change_scene',
  'open_panel',
  'add_item',
  'remove_item',
  'add_gold',
  'say',
  'update_quest',
  'start_combat',
  'set_flag',
  'save_game'
]);
nodes.forEach((n) => {
  (n.events?.click || []).forEach((step) => {
    assert(allowed.has(step.action) || typeof step.action === 'string', 'action is string id: ' + step.action);
    assert(step.action.indexOf('(') === -1, 'no JS call in action');
    assert(allowed.has(step.action), 'demo action in allowlist: ' + step.action);
  });
});

// Phase 1.11 vertical slice hooks
const chest = nodes.find((n) => n.id === 'hs_chest');
assert(!!chest, 'hs_chest present');
assert(!!chest.showIf, 'chest has showIf');
assert((chest.events?.click || []).length >= 4, 'chest multi-action');
assert(!!demo.quests?.missing_supplies, 'missing_supplies quest');
assert(!!demo.ui?.screens?.rpg_hud, 'rpg_hud');

// No engine hardcode required: destinations only in params
const sceneSrc = fs.readFileSync(path.join(root, 'js/engine/scene-manager.js'), 'utf8');
assert(!/visual_village/.test(sceneSrc), 'SceneManager has no visual_village hardcode');
assert(!/hs_tavern/.test(sceneSrc), 'SceneManager has no hs_tavern hardcode');

// VisualRuntime path for clicks
const ctx = {
  console,
  document: undefined,
  window: null,
  globalThis: null
};
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/game-ui/visual-runtime.js'), 'utf8'), ctx);

const visited = [];
const panels = [];
const engine = {
  data: again,
  state: { scene: 'village' },
  showScene(id) {
    visited.push(id);
    this.state.scene = id;
  },
  runAction(action, params) {
    if (action === 'change_scene') this.showScene(params.sceneId);
    if (action === 'open_panel') panels.push(params.panel);
    return Promise.resolve(true);
  }
};

assert(ctx.VisualRuntime.mount(engine, 'village', again.scenes.village) === true, 'mount village visual');

return Promise.resolve()
  .then(() => ctx.VisualRuntime.runClickActions(engine, clickAction(tavern) && [clickAction(tavern)]))
  .then(() => {
    assert(visited[0] === 'tavern', 'Visual → TEXT tavern');
    // simulate TEXT choice back
    engine.showScene('village');
    assert(engine.state.scene === 'village', 'TEXT → Visual village');
    return ctx.VisualRuntime.runClickActions(engine, [clickAction(journal)]);
  })
  .then(() => {
    assert(panels[0] === 'journal', 'journal open_panel');
    // Inline demo JS exists
    assert(fs.existsSync(path.join(root, 'js/demo-visual-village.js')), 'demo-visual-village.js');
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
