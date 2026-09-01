#!/usr/bin/env node
/**
 * Phase 1.19 — Validator sweep: Mill, Village Demo, starter templates
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function loadCtx(extraScripts) {
  const ctx = {
    console,
    module: { exports: {} },
    globalThis: null,
    window: null,
    ACTION_REGISTRY: null,
    DEMO_VISUAL_VILLAGE_DATA: null,
    GAME_DATA_INLINE: null
  };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  (extraScripts || []).forEach((rel) => {
    vm.runInContext(read(rel), ctx);
  });
  vm.runInContext(read('js/editor/editor-starter-projects-index.js'), ctx);
  vm.runInContext(read('js/actions/action-registry.js'), ctx);
  vm.runInContext(read('js/editor/editor-action-catalog.js'), ctx);
  vm.runInContext(read('js/editor/editor-condition-catalog.js'), ctx);
  vm.runInContext(read('js/editor/editor-project-validator.js'), ctx);
  return ctx;
}

function summarize(name, report) {
  const errors = report.errors || [];
  const warnings = report.warnings || [];
  return {
    name,
    valid: !!report.valid,
    errors: errors.length,
    warnings: warnings.length,
    errorTypes: [...new Set(errors.map((e) => e.type))].slice(0, 16),
    sampleErrors: errors.slice(0, 8).map((e) => e.type + ': ' + (e.message || '').slice(0, 100))
  };
}

const rows = [];

{
  const ctx = loadCtx(['js/demo-visual-village.js']);
  rows.push(summarize('Demo Village', ctx.ProjectValidator.validateProject(ctx.DEMO_VISUAL_VILLAGE_DATA, { registry: ctx.ACTION_REGISTRY })));
}

{
  const ctx = loadCtx(['js/demo-visual-village.js']);
  const IDX = ctx.StarterProjectsIndex;
  ['blank_rpg', 'text_rpg', 'visual_adventure', 'village_demo'].forEach((id) => {
    const data = IDX.buildStarterProject(id, 'MVP ' + id, {});
    rows.push(summarize('Template:' + id, ctx.ProjectValidator.validateProject(data, { registry: ctx.ACTION_REGISTRY })));
  });
}

{
  const ctx = loadCtx([]);
  try {
    vm.runInContext(read('js/data.js'), ctx);
    const mill = ctx.GAME_DATA_INLINE;
    if (mill && mill.scenes) {
      // Ensure startScene for reachability
      if (!mill.startScene) {
        mill.startScene = mill.meta?.startScene || Object.keys(mill.scenes)[0];
      }
      rows.push(summarize('Mill (GAME_DATA_INLINE)', ctx.ProjectValidator.validateProject(mill, { registry: ctx.ACTION_REGISTRY })));
    } else {
      rows.push({ name: 'Mill (GAME_DATA_INLINE)', valid: null, errors: null, warnings: null, note: 'not found' });
    }
  } catch (e) {
    rows.push({ name: 'Mill (GAME_DATA_INLINE)', valid: false, errors: -1, warnings: -1, loadError: String(e.message || e).slice(0, 160) });
  }
}

fs.writeFileSync(path.join(root, 'docs/_mvp-validator-sweep.json'), JSON.stringify({ when: new Date().toISOString(), rows }, null, 2));

console.log('Validator sweep');
rows.forEach((r) => {
  const tag = r.valid === true ? 'CLEAN' : r.valid === false ? 'DIRTY' : 'SKIP';
  console.log(tag, r.name, 'errors=' + r.errors, 'warnings=' + r.warnings, r.errorTypes && r.errorTypes.length ? ('[' + r.errorTypes.join(', ') + ']') : '', r.loadError || r.note || '');
  (r.sampleErrors || []).forEach((s) => console.log('   ', s));
});
