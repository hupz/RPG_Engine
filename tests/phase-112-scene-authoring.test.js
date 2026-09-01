#!/usr/bin/env node
/**
 * Phase 1.12 — Scene & World Authoring
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

function loadIndexWithSchema() {
  const ctx = { module: { exports: {} }, globalThis: null, window: null, console };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/project-schema.js'), ctx);
  vm.runInContext(read('js/editor/editor-scene-authoring-index.js'), ctx);
  return ctx.SceneAuthoringIndex || ctx.module.exports;
}

console.log('Phase 1.12 — wizard presets produce valid scene shape');

{
  const IDX = loadIndexWithSchema();
  assert(typeof IDX.applyWizardPreset === 'function', 'applyWizardPreset exported');
  assert(typeof IDX.validateSceneShape === 'function', 'validateSceneShape exported');

  const textScene = { id: 'intro', location: 'Intro' };
  IDX.applyWizardPreset(textScene, 'text');
  assert(IDX.validateSceneShape(textScene), 'text preset valid shape');
  assert(Array.isArray(textScene.choices), 'text preset has choices[]');
  assert(textScene.editorModules.includes('story'), 'text preset story module');

  const visualScene = { id: 'map', location: 'Map' };
  IDX.applyWizardPreset(visualScene, 'visual');
  assert(IDX.validateSceneShape(visualScene), 'visual preset valid shape');
  assert(visualScene.visual && visualScene.visual.mode === 'overlay', 'visual preset visual.mode');
  assert(Array.isArray(visualScene.visual.nodes), 'visual preset nodes[]');

  const dialogScene = { id: 'talk', location: 'Talk' };
  IDX.applyWizardPreset(dialogScene, 'dialogue');
  assert(dialogScene.sceneType === 'dialog', 'dialogue preset sceneType dialog');
  assert(Array.isArray(dialogScene.dialogue), 'dialogue preset dialogue[]');

  const combatScene = { id: 'fight', location: 'Fight' };
  IDX.applyWizardPreset(combatScene, 'combat');
  assert(combatScene.sceneType === 'combat', 'combat preset sceneType combat');
  assert(Array.isArray(combatScene.combat), 'combat preset combat[]');
}

console.log('\nPhase 1.12 — connections / flow edges');

{
  const IDX = loadIndexWithSchema();
  const data = {
    scenes: {
      village: {
        id: 'village',
        location: 'Village',
        choices: [{ text: 'Tavern', to: 'tavern' }, { text: 'Forest', to: 'missing_forest' }],
        visual: {
          nodes: [{
            id: 'hs1',
            events: { click: [{ action: 'change_scene', params: { sceneId: 'shop' } }] }
          }]
        }
      },
      tavern: { id: 'tavern', location: 'Tavern' },
      shop: { id: 'shop', location: 'Shop', choices: [{ text: 'Back', to: 'village' }] },
      start: { id: 'start', location: 'Start', nextScene: 'village' }
    }
  };

  const { outgoing, incoming } = IDX.collectSceneConnections('village', data);
  assert(outgoing.some((e) => e.kind === 'choice' && e.toId === 'tavern'), 'choice outgoing edge');
  assert(outgoing.some((e) => e.kind === 'visual_click' && e.toId === 'shop'), 'visual change_scene edge');
  assert(outgoing.some((e) => e.broken && e.toId === 'missing_forest'), 'unknown destination marked broken');

  const summary = IDX.buildSceneFlowSummary('village', data);
  assert(summary.outgoing.length >= 3, 'flow summary outgoing');
  assert(summary.incoming.some((e) => e.fromId === 'start'), 'incoming from start nextScene');
  assert(summary.incoming.some((e) => e.fromId === 'shop'), 'incoming from shop choice');
}

console.log('\nPhase 1.12 — EntityPicker lists scenes (static)');

{
  const ep = read('js/editor/editor-entity-picker.js');
  assert(ep.includes("kind: 'scene'") || ep.includes('scene:'), 'entity picker supports scene kind');
  const phase = read('js/editor/editor-scene-authoring-phase-112.js');
  assert(phase.includes("kind: 'scene'"), 'connections UI uses scene EntityPicker');
}

console.log('\nPhase 1.12 — existing scenes not migrated / SceneManager unchanged');

{
  const sm = read('js/engine/scene-manager.js');
  const phase = read('js/editor/editor-scene-authoring-phase-112.js');
  const idx = read('js/editor/editor-scene-authoring-index.js');
  assert(!idx.includes('migrate'), 'index has no migration');
  assert(!phase.includes('SceneManager'), 'phase-112 does not touch SceneManager');
  assert(sm.includes('showScene(sceneId'), 'SceneManager showScene intact');
  assert(!phase.includes('showScene'), 'authoring does not override showScene');
}

console.log('\nPhase 1.12 — runtime has no Editor dependency');

{
  const engineFiles = [
    'js/engine/scene-manager.js',
    'js/actions/action-registry.js'
  ];
  engineFiles.forEach((rel) => {
    const src = read(rel);
    assert(!/editor\//i.test(src), rel + ' has no editor/ imports');
    assert(!src.includes('SceneAuthoringIndex'), rel + ' has no SceneAuthoringIndex');
  });
  assert(!read('js/editor/editor-scene-authoring-index.js').includes('require('), 'index is browser-safe IIFE');
}

console.log('\nPhase 1.12 — editor wiring');

{
  const html = read('editor.html');
  assert(html.includes('editor-scene-authoring-index.js'), 'index script in editor.html');
  assert(html.includes('editor-scene-authoring-phase-112.js'), 'phase-112 script in editor.html');
  const phase = read('js/editor/editor-scene-authoring-phase-112.js');
  assert(phase.includes('openSceneWizard'), 'canonical wizard API');
  assert(phase.includes('openSceneCreationWizard'), 'wizard alias API');
  assert(phase.includes('renderSceneAuthoringPanel'), 'inspector panel API');
  assert(phase.includes('addSceneConnectionChoice'), 'connection API uses choice.to');
  assert(phase.includes("hooks.after('renderSceneEditor'"), 'hooks into scene editor');
  const builderIdx = html.indexOf('editor-scene-builder.js');
  const phaseIdx = html.indexOf('editor-scene-authoring-phase-112.js');
  assert(builderIdx > 0 && phaseIdx > builderIdx, 'phase-112 loads after scene-builder');
}

console.log('\n' + (failed ? 'FAILED' : 'PASSED') + ': ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
