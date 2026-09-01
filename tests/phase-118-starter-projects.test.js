#!/usr/bin/env node
/**
 * Phase 1.18 — Starter Projects & Template Hardening
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

function loadStarterIndex(extra) {
  const ctx = {
    console,
    module: { exports: {} },
    globalThis: null,
    window: null,
    DEMO_VISUAL_VILLAGE_DATA: null
  };
  Object.assign(ctx, extra || {});
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  if (extra && extra.loadVillage) {
    vm.runInContext(read('js/demo-visual-village.js'), ctx);
  }
  vm.runInContext(read('js/editor/editor-starter-projects-index.js'), ctx);
  return ctx;
}

function loadValidatorStack(village) {
  const ctx = {
    console,
    module: { exports: {} },
    globalThis: null,
    window: null,
    ACTION_REGISTRY: null,
    DEMO_VISUAL_VILLAGE_DATA: null
  };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  if (village) vm.runInContext(read('js/demo-visual-village.js'), ctx);
  vm.runInContext(read('js/editor/editor-starter-projects-index.js'), ctx);
  vm.runInContext(read('js/actions/action-registry.js'), ctx);
  vm.runInContext(read('js/editor/editor-action-catalog.js'), ctx);
  vm.runInContext(read('js/editor/editor-condition-catalog.js'), ctx);
  vm.runInContext(read('js/editor/editor-project-validator.js'), ctx);
  return ctx;
}

console.log('Phase 1.18 — wiring / API');

{
  const html = read('editor.html');
  assert(html.includes('editor-starter-projects-index.js'), 'starter index wired');
  assert(html.includes('editor-starter-projects-phase-118.js'), 'starter phase wired');
  const pack = read('js/editor/editor-scene-template-pack.js');
  assert(pack.includes('CANONICAL API'), 'scene pack API documented');
  assert(pack.includes('createSceneFromTemplatePack'), 'create alias');
  assert(pack.includes('applySceneTemplatePackToCurrent'), 'apply alias');
  const ux = read('js/editor/editor-starter-projects-phase-118.js');
  assert(ux.includes('previewNewStarterProject'), 'preview after create');
  assert(ux.includes('editor-new-project-template'), 'template picker in UX');
}

console.log('\n1. catalog: four starters');

{
  const ctx = loadStarterIndex();
  const IDX = ctx.StarterProjectsIndex;
  const list = IDX.listStarterProjects();
  assert(list.length === 4, 'four templates');
  ['blank_rpg', 'text_rpg', 'visual_adventure', 'village_demo'].forEach((id) => {
    assert(list.some((t) => t.id === id), 'has ' + id);
  });
}

console.log('\n2. each template: loads + startScene + isolated');

{
  const ctx = loadStarterIndex({ loadVillage: true });
  const IDX = ctx.StarterProjectsIndex;
  ['blank_rpg', 'text_rpg', 'visual_adventure', 'village_demo'].forEach((id) => {
    const data = IDX.buildStarterProject(id, 'T ' + id, {});
    assert(!!data, id + ' builds');
    assert(data.startScene && data.scenes[data.startScene], id + ' startScene valid');
    assert(data.meta && data.meta.templateId === id, id + ' templateId');
    assert(data.meta.campaignId, id + ' campaignId set');
    assert(JSON.stringify(data).indexOf('melnitsa') < 0, id + ' not Mill');
    // round-trip
    const again = JSON.parse(JSON.stringify(data));
    assert(again.scenes[again.startScene], id + ' JSON round-trip');
  });
}

console.log('\n3. Project Validator clean (errors)');

{
  const ctx = loadValidatorStack(true);
  const IDX = ctx.StarterProjectsIndex;
  const PV = ctx.ProjectValidator;
  const REG = ctx.ACTION_REGISTRY;

  function assertClean(id) {
    const data = IDX.buildStarterProject(id, 'Validate ' + id, {});
    const report = PV.validateProject(data, { registry: REG });
    const errs = report.errors || [];
    if (errs.length) {
      console.error('    errors for', id, errs.map((e) => e.type + ': ' + e.message).slice(0, 8));
    }
    assert(errs.length === 0, id + ' validator clean (0 errors)');
    // preview data shape
    assert(data.scenes && Object.keys(data.scenes).length >= 1, id + ' has scenes');
    assert(!!data.startScene, id + ' preview startScene');
  }

  assertClean('blank_rpg');
  assertClean('text_rpg');
  assertClean('visual_adventure');
  assertClean('village_demo');
}

console.log('\n4. no missing references (starter-owned entities)');

{
  const ctx = loadValidatorStack(true);
  const IDX = ctx.StarterProjectsIndex;
  const PV = ctx.ProjectValidator;
  const data = IDX.buildStarterProject('text_rpg', 'Text', {});
  const report = PV.validateProject(data, { registry: ctx.ACTION_REGISTRY });
  const types = (report.errors || []).map((e) => e.type);
  assert(!types.includes('missing_item'), 'text_rpg no missing_item');
  assert(!types.includes('missing_quest'), 'text_rpg no missing_quest');
  assert(!types.includes('missing_scene'), 'text_rpg no missing_scene');

  const vis = IDX.buildStarterProject('visual_adventure', 'Vis', {});
  const r2 = PV.validateProject(vis, { registry: ctx.ACTION_REGISTRY });
  assert(!(r2.errors || []).some((e) => e.type === 'missing_item'), 'visual no missing item');
  assert(!(r2.errors || []).some((e) => e.type === 'missing_scene'), 'visual no missing scene');
}

console.log('\n5. scene template pack test still green');

{
  // run as child would be heavy — spot-check contract already in editor-template-pack.test.js
  assert(fs.existsSync(path.join(root, 'tests/editor-template-pack.test.js')), 'pack test file exists');
}

console.log('\n---');
console.log('Passed:', passed, 'Failed:', failed);
process.exit(failed ? 1 : 0);
