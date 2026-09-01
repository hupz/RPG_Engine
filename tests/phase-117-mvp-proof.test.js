#!/usr/bin/env node
/**
 * Phase 1.17 — MVP Proof project validation
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const demoPath = path.join(root, 'data/demos/mvp_proof.json');
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

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function loadRegistry() {
  const ctx = { console, module: { exports: {} }, globalThis: null, window: null };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/actions/action-registry.js'), ctx);
  return ctx.ACTION_REGISTRY;
}

function loadSchema() {
  const ctx = { console, module: { exports: {} }, globalThis: null, window: null };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/project-schema.js'), ctx);
  vm.runInContext(read('js/data-schema.js'), ctx);
  return ctx.ProjectSchema;
}

function collectActions(data) {
  const steps = [];
  const scenes = data.scenes || {};
  Object.values(scenes).forEach((scene) => {
    (scene.choices || []).forEach((ch) => {
      if (ch.questSet) steps.push({ action: 'update_quest', source: 'choice.questSet' });
    });
    (scene.events?.enter || []).forEach((s) => steps.push(s));
    (scene.components || []).forEach((comp) => {
      const topics = comp.params?.topics || [];
      topics.forEach((t) => {
        (t.actions || []).forEach((s) => steps.push(s));
      });
    });
    const nodes = scene.visual?.nodes || [];
    nodes.forEach((n) => {
      (n.events?.click || []).forEach((s) => steps.push(s));
    });
  });
  const ui = data.ui?.screens || {};
  Object.values(ui).forEach((screen) => {
    (screen.nodes || []).forEach((n) => {
      (n.events?.click || []).forEach((s) => steps.push(s));
    });
  });
  return steps;
}

function sceneIds(data) {
  return new Set(Object.keys(data.scenes || {}));
}

console.log('Phase 1.17 — demo exists & isolated');

assert(fs.existsSync(demoPath), 'mvp_proof.json exists');
const demo = JSON.parse(fs.readFileSync(demoPath, 'utf8'));
assert(demo.meta?.campaignId === 'mvp_proof', 'campaignId mvp_proof');
assert(demo.meta?.campaignId !== 'pf2e_mill', 'not Mill');
assert(demo.meta?.dataVersion === 'mvp-proof-1.0', 'dataVersion set');
assert(fs.existsSync(path.join(root, 'js/demo-mvp-proof.js')), 'inline demo JS exists');

const core = read('js/engine/core.js');
assert(core.includes("id: 'mvp_proof'"), 'CAMPAIGNS entry mvp_proof');
assert(!/mvp_proof/.test(read('data/game_data.json')), 'Mill game_data untouched');

console.log('\nPhase 1.17 — data shape valid');

assert(!!demo.scenes && !!demo.classes && !!demo.startScene, 'core project shape');
assert(!!demo.scenes.start && !!demo.scenes.village && !!demo.scenes.forest, 'flow scenes');
assert(!!demo.scenes.village.visual?.nodes?.length, 'village visual');
assert(!!demo.scenes.forest.visual?.nodes?.length, 'forest visual');
assert(!!demo.scenes.elder_hut?.components?.length, 'elder dialogue component');
assert(demo.scenes.elder_hut.components[0].component === 'dialogue_tree', 'dialogue_tree component');
assert(!!demo.npcs?.elder_mira, 'NPC elder_mira');
assert(!!demo.quests?.herb_for_elder, 'quest herb_for_elder');
assert(!!demo.enemies?.forest_wolf, 'enemy forest_wolf');
assert(!!demo.items?.forest_herb, 'item forest_herb');
assert(!!demo.ui?.screens?.rpg_hud, 'Game UI HUD');

console.log('\nPhase 1.17 — scene references valid');

const ids = sceneIds(demo);
function refScene(id, label) {
  assert(ids.has(id), label + ' exists: ' + id);
}

['start', 'village', 'elder_hut', 'forest', 'forest_victory'].forEach((id) => refScene(id, 'scene'));

(demo.scenes.start.choices || []).forEach((c) => assert(ids.has(c.to), 'start → ' + c.to));
(demo.scenes.village.choices || []).forEach((c) => {
  if (c.to) assert(ids.has(c.to), 'village choice → ' + c.to);
});
(demo.scenes.elder_hut.choices || []).forEach((c) => assert(ids.has(c.to), 'elder → ' + c.to));

const wolf = demo.scenes.forest.visual.nodes.find((n) => n.id === 'hs_wolf');
assert(wolf?.events?.click?.some((s) => s.action === 'start_combat'), 'wolf combat');
assert(ids.has(wolf.events.click.find((s) => s.action === 'start_combat').params.nextScene), 'combat nextScene valid');

console.log('\nPhase 1.17 — NPC & dialogue references');

assert(demo.npcs.elder_mira.dialogueSceneId === 'elder_hut', 'NPC dialogueSceneId');
const topics = demo.scenes.elder_hut.components[0].params.topics;
assert(Array.isArray(topics) && topics.length >= 3, 'dialogue topics');
assert(topics.some((t) => (t.actions || []).some((a) => a.action === 'update_quest')), 'quest accept in dialogue');

console.log('\nPhase 1.17 — quest references');

const quest = demo.quests.herb_for_elder;
assert(quest.giver === 'elder_mira', 'quest giver NPC');
assert(Array.isArray(quest.stages) && quest.stages.length >= 4, 'quest stages');
assert(quest.rewards?.gold != null, 'quest gold reward');

console.log('\nPhase 1.17 — action IDs valid');

const REG = loadRegistry();
const steps = collectActions(demo);
assert(steps.length >= 10, 'enough action steps');
steps.forEach((step) => {
  assert(typeof step.action === 'string', 'action is string');
  assert(!step.action.includes('('), 'no JS in action: ' + step.action);
  assert(!!REG[step.action], 'registry action: ' + step.action);
});

console.log('\nPhase 1.17 — conditions valid');

const condSteps = [];
(demo.scenes.forest.visual.nodes || []).forEach((n) => {
  if (n.showIf) condSteps.push(n.showIf);
});
topics.forEach((t) => {
  if (t.showIf) condSteps.push(t.showIf);
});
assert(condSteps.length >= 4, 'conditions used');
condSteps.forEach((c) => {
  assert(typeof c === 'object', 'condition object');
  assert(c.all || c.any || c.flag || c.notFlag || c.hasItem || c.questMinStage, 'known condition shape');
});

console.log('\nPhase 1.17 — assets resolve safely');

const assets = demo.assets || {};
Object.entries(assets).forEach(([id, a]) => {
  assert(a.src && a.src.startsWith('assets/'), 'asset src relative: ' + id);
  const full = path.join(root, a.src);
  assert(fs.existsSync(full), 'asset file exists: ' + a.src);
});

const bg = demo.scenes.village.visual.background.asset;
assert(bg.ref === 'village_bg' || bg.src, 'village bg resolves');

console.log('\nPhase 1.17 — UI screens valid');

const hud = demo.ui.screens.rpg_hud;
assert(hud.scope === 'persistent', 'HUD persistent');
assert((hud.nodes || []).some((n) => n.events?.click?.some((s) => s.action === 'save_game')), 'save button');
assert((hud.nodes || []).some((n) => n.binding === 'player.hp' || n.kind === 'bar'), 'HP bar');

console.log('\nPhase 1.17 — export ready');

{
  const PS = loadSchema();
  const r = PS.validateProjectExportReady(demo);
  assert(r.ok === true, 'export validation ok (' + (r.warnings?.length || 0) + ' warnings)');
}

console.log('\nPhase 1.17 — no Editor dependency in runtime');

const runtimeFiles = [
  'js/engine/scene-manager.js',
  'js/game-ui/visual-runtime.js',
  'js/components/dialogue-tree.js',
  'js/actions/action-runner.js'
];
runtimeFiles.forEach((f) => {
  const src = read(f);
  assert(!/mvp_proof/.test(src), 'no mvp_proof hardcode in ' + path.basename(f));
  assert(!/elder_mira/.test(src), 'no elder_mira hardcode in ' + path.basename(f));
});

const inline = read('js/demo-mvp-proof.js');
assert(inline.includes('DEMO_MVP_PROOF_DATA'), 'inline global name');
assert(inline.includes('mvp_proof'), 'inline campaignId');

console.log('\nPhase 1.17 — E2E flow coverage');

assert(demo.startScene === 'start', 'starts at intro');
assert(demo.scenes.village.visual.nodes.some((n) => n.id === 'hs_elder'), 'village NPC hotspot');
assert(demo.scenes.forest.visual.nodes.some((n) => n.id === 'hs_herb_chest'), 'forest loot hotspot');
assert(topics.some((t) => t.label && t.label.includes('помогу')), 'accept quest dialogue');
assert(topics.some((t) => (t.actions || []).some((a) => a.action === 'add_gold')), 'reward gold in dialogue');

console.log('\n' + '='.repeat(50));
console.log(`Phase 1.17: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
