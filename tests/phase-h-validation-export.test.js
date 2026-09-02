#!/usr/bin/env node
/**
 * Phase H — Validation & Export pipeline
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

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

function loadSchema() {
  const ctx = { console, module: { exports: {} }, globalThis: null, window: null };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/project-schema.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/data-schema.js'), 'utf8'), ctx);
  return { PS: ctx.ProjectSchema, PDS: ctx.ProjectDataSchema };
}

console.log('Phase H — validation: extended authoring');

{
  const { PS } = loadSchema();
  assert(typeof PS.validateProjectExportReady === 'function', 'validateProjectExportReady');

  const data = {
    meta: { dataVersion: 5 },
    startScene: 'missing_start',
    scenes: {
      hub: {
        visual: {
          nodes: [{
            id: 'hs1',
            kind: 'hotspot',
            events: {
              click: [{ action: 'change_scene', params: { sceneId: 'missing' } }],
              hover: [{ action: 'change_scene', params: { sceneId: 'also_missing' } }]
            },
            transform: { x: 0, y: 0, w: 0.1, h: 0.1, z: 1 }
          }, {
            id: 'hs_orphan',
            kind: 'hotspot',
            events: {},
            transform: { x: 0.2, y: 0.2, w: 0.1, h: 0.1, z: 2 }
          }]
        },
        events: { enter: [{ action: 'change_scene', params: { sceneId: 'bad_enter' } }] }
      }
    },
    ui: {
      screens: {
        hud: {
          scope: 'scene',
          sceneId: 'hub',
          events: { show: [{ action: 'change_scene', params: { sceneId: 'bad_ui' } }] },
          nodes: [{
            id: 'b1',
            kind: 'button',
            prefabLink: { prefabId: 'pf_missing', instanceId: 'i1', sourceNodeId: 'x' },
            events: { click: [] },
            transform: { x: 0, y: 0, w: 0.1, h: 0.1, z: 1 }
          }]
        }
      }
    },
    prefabs: {},
    assets: {}
  };

  const v = PS.validateProjectAuthoring(data);
  assert(v.ok === false, 'broken targets fail');
  assert(v.issues.some((i) => i.type === 'authoring_missing_scene'), 'missing scene issues');
  assert(v.issues.some((i) => i.type === 'authoring_missing_prefab'), 'missing prefab warning');
  assert(v.issues.some((i) => i.type === 'authoring_orphan_hotspot'), 'orphan hotspot warning');
  assert(v.issues.some((i) => i.type === 'authoring_flow_broken'), 'flow broken issue');
  assert(v.issues.some((i) => i.type === 'authoring_bad_start_scene'), 'bad startScene');
}

console.log('\nPhase H — validation: visual_village export ready');

{
  const { PS, PDS } = loadSchema();
  const demo = JSON.parse(fs.readFileSync(path.join(root, 'data/demos/visual_village.json'), 'utf8'));
  PDS.migrateProjectData(demo);
  const r = PS.validateProjectExportReady(demo);
  assert(r.ok === true, 'visual_village export ready (' + (r.warnings?.length || 0) + ' warnings)');
}

console.log('\nPhase H — export pipeline');

{
  const exportSrc = fs.readFileSync(path.join(root, 'js/editor-export.js'), 'utf8');
  assert(exportSrc.includes('visual-runtime.js'), 'standalone includes visual-runtime');
  assert(exportSrc.includes('ui-runtime.js'), 'standalone includes ui-runtime');
  assert(exportSrc.includes('project-schema.js'), 'standalone includes project-schema');
  assert(!exportSrc.includes('editor.html'), 'export script has no editor.html');
  assert(!exportSrc.includes('editor-visual-scene.js'), 'export excludes editor modules');

  const val = fs.readFileSync(path.join(root, 'js/editor/editor-validation-phase-h.js'), 'utf8');
  const exportFlow = fs.readFileSync(path.join(root, 'js/editor/editor-export-flow.js'), 'utf8');
  assert(val.includes('validateProjectExportReady'), 'export readiness API');
  assert(exportFlow.includes('guardExportWithValidation'), 'export validation gate in export-flow');

  const html = fs.readFileSync(path.join(root, 'editor.html'), 'utf8');
  assert(html.includes('editor-validation-phase-h.js'), 'editor loads phase-h validation');
}

console.log('\nPhase H — dist/release smoke');

{
  execSync('node scripts/export-dist.mjs', { cwd: root, stdio: 'pipe' });
  const manifestPath = path.join(root, 'dist/release/manifest.json');
  assert(fs.existsSync(manifestPath), 'dist/release/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert(manifest.excludesEditor === true, 'manifest excludesEditor');
  assert(manifest.validation?.ok === true, 'manifest validation ok');
  assert(fs.existsSync(path.join(root, 'dist/release/js/data.js')), 'release data.js');
  assert(fs.existsSync(path.join(root, 'dist/release/js/engine.bundle.js')), 'release engine bundle');
}

console.log('\n---');
console.log('Passed:', passed, 'Failed:', failed);
process.exit(failed ? 1 : 0);
