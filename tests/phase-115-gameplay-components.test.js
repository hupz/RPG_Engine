#!/usr/bin/env node
/**
 * Phase 1.15 — Gameplay Component Library
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

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function loadIndex() {
  const ctx = { module: { exports: {} }, globalThis: null, window: null, console };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/editor/editor-gameplay-components-index.js'), ctx);
  return ctx.GameplayComponentsIndex || ctx.module.exports;
}

function loadRegistry() {
  const ctx = { console, module: { exports: {} }, globalThis: null, window: null };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/actions/action-registry.js'), ctx);
  return ctx.ACTION_REGISTRY;
}

console.log('Phase 1.15 — capability: presets exist');

{
  const IDX = loadIndex();
  assert(Object.keys(IDX.PRESETS).length === 5, 'five presets');
  assert(typeof IDX.compileChestLoot === 'function', 'chest compiler');
}

console.log('\nPhase 1.15 — Chest / Loot');

{
  const IDX = loadIndex();
  const REG = loadRegistry();
  const compiled = IDX.compileChestLoot({ items: [{ itemId: 'sword', count: 1 }], gold: 25, openedFlag: 'chest_a' }, {});
  const steps = IDX.collectAllSteps(compiled);
  assert(compiled.nodes.length === 1, 'one hotspot');
  assert(steps.some((s) => s.action === 'add_item' && s.params.itemId === 'sword'), 'add_item');
  assert(steps.some((s) => s.action === 'add_gold'), 'add_gold');
  assert(steps.some((s) => s.action === 'set_flag'), 'opened flag');
  assert(IDX.validateShowIf(compiled.nodes[0].showIf).ok, 'showIf valid');
  assert(IDX.validateActionSteps(steps, REG).ok, 'actions in registry');
}

console.log('\nPhase 1.15 — Door / Exit');

{
  const IDX = loadIndex();
  const REG = loadRegistry();
  const compiled = IDX.compileDoorExit({
    destinationSceneId: 'forest',
    requireItemId: 'rusty_key',
    lockedText: 'Need key'
  });
  assert(compiled.nodes.length === 2, 'locked + open nodes');
  assert(compiled.nodes[1].events.click[0].action === 'change_scene', 'change_scene');
  assert(IDX.validateActionSteps(IDX.collectAllSteps(compiled), REG).ok, 'door actions valid');
}

console.log('\nPhase 1.15 — NPC / Rest / Encounter');

{
  const IDX = loadIndex();
  const REG = loadRegistry();
  const data = {
    npcs: {
      jack: { id: 'jack', name: 'Jack', shop: true, shopSceneId: 'shop', dialogues: { default: [{ text: 'Hi' }] } },
      guard: { id: 'guard', combatEnemyId: 'goblin' }
    },
    scenes: { shop: {}, tavern: {} },
    enemies: { goblin: {} }
  };

  const talk = IDX.compileNpcInteraction({ npcId: 'jack', interaction: 'talk' }, data);
  assert(talk.nodes[0].events.click[0].action === 'say', 'talk say fallback');

  const trade = IDX.compileNpcInteraction({ npcId: 'jack', interaction: 'trade' }, data);
  assert(trade.nodes[0].events.click[0].action === 'change_scene', 'trade scene');

  const attack = IDX.compileNpcInteraction({ npcId: 'guard', interaction: 'attack' }, data);
  assert(attack.nodes[0].events.click[0].action === 'start_combat', 'attack combat');

  const rest = IDX.compileRestPoint({ healAmount: '10', restType: 'short', doSave: true });
  const restSteps = IDX.collectAllSteps(rest);
  assert(restSteps.some((s) => s.action === 'heal'), 'heal');
  assert(restSteps.some((s) => s.action === 'rest_short_time'), 'rest_short_time');
  assert(restSteps.some((s) => s.action === 'save_game'), 'save_game');
  assert(IDX.validateActionSteps(restSteps, REG).ok, 'rest actions in registry');

  const enc = IDX.compileEncounter({ enemies: ['goblin'], nextScene: 'tavern', victoryGold: 5 }, data);
  assert(enc.nodes[0].events.click[0].action === 'start_combat', 'start_combat');
  assert(enc.scenePatches?.[0]?.appendEnter?.some((s) => s.action === 'add_gold'), 'victory on next scene enter');
}

console.log('\nPhase 1.15 — serialization / no Editor in runtime');

{
  const IDX = loadIndex();
  const compiled = IDX.compileChestLoot({ gold: 1 }, {});
  const rt = IDX.serializeRoundtrip(compiled);
  assert(rt.nodes.length === compiled.nodes.length, 'roundtrip nodes');
  assert(!read('js/game-ui/visual-runtime.js').includes('GameplayComponents'), 'VisualRuntime clean');
  assert(!read('js/actions/action-registry.js').includes('Editor'), 'registry no Editor');
}

console.log('\nPhase 1.15 — editor wiring');

{
  const html = read('editor.html');
  const phase = read('js/editor/editor-gameplay-components-phase-115.js');
  assert(html.includes('editor-gameplay-components-index.js'), 'index script');
  assert(html.includes('editor-gameplay-components-phase-115.js'), 'phase script');
  assert(phase.includes('applyGameplayComponentToScene'), 'apply API');
  assert(phase.includes('previewGameplayComponentRaw'), 'raw preview advanced');
  assert(phase.includes('renderVisualScenePanel'), 'visual hook');
}

console.log('\n' + (failed ? 'FAILED' : 'PASSED') + ': ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
