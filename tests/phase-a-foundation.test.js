#!/usr/bin/env node
/**
 * Phase A — Foundation: project schema, events, migration v5, export scripts
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

function loadSchemaContext() {
  const ctx = { console, module: { exports: {} }, exports: {} };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/project-schema.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/data-schema.js'), 'utf8'), ctx);
  return ctx;
}

console.log('Phase A — project schema');

{
  const ctx = loadSchemaContext();
  const PS = ctx.ProjectSchema;
  const PDS = ctx.ProjectDataSchema;

  assert(PS && typeof PS.normalizeEvents === 'function', 'ProjectSchema loaded');
  assert(PDS.DATA_VERSION === 5, 'DATA_VERSION is 5');

  const legacy = PS.normalizeEvents({
    onClick: [{ type: 'OpenScene', params: { to: 'tavern' } }]
  });
  assert(legacy.click?.[0]?.action === 'change_scene', 'onClick → click.change_scene');
  assert(legacy.click[0].params.sceneId === 'tavern', 'OpenScene maps sceneId');

  const id1 = PS.createStableId('hotspot');
  const id2 = PS.createStableId('hotspot');
  assert(id1 !== id2 && id1.startsWith('hotspot_'), 'createStableId unique prefix');

  const dice = PS.normalizeEvents({ click: [{ action: 'open_panel', params: { panel: 'journal' } }] });
  assert(dice.click[0].action === 'open_panel', 'canonical action preserved');
}

console.log('\nPhase A — migration v4 → v5');

{
  const ctx = loadSchemaContext();
  const PDS = ctx.ProjectDataSchema;

  const data = {
    meta: { dataVersion: 4, title: 'Test' },
    scenes: {
      village: {
        visual: {
          background: { asset: { ref: 'village_bg' } },
          nodes: [
            {
              id: 'tavern',
              kind: 'hotspot',
              events: { onClick: [{ type: 'OpenScene', params: { scene: 'tavern_inside' } }] }
            }
          ]
        }
      },
      tavern_inside: { text: 'Inside' }
    },
    assets: {
      village_bg: { type: 'image', src: 'assets/village.svg' }
    },
    ui: {
      screens: {
        hud: {
          scope: 'persistent',
          nodes: [
            {
              id: 'journal_btn',
              kind: 'button',
              events: { click: [{ action: 'open_panel', params: { panel: 'journal' } }] }
            }
          ]
        }
      }
    }
  };

  PDS.migrateProjectData(data);
  assert(data.meta.dataVersion === 5, 'migrated to v5');
  assert(data.meta.authoring?.visual === true, 'meta.authoring set');
  assert(data.scenes.village.visual.nodes[0].events.click?.[0]?.action === 'change_scene', 'visual events normalized on migrate');
  assert(data.scenes.village.visual.nodes[0].uid, 'visual node gets uid');
  assert(data.ui.screens.hud.nodes[0].uid, 'ui node gets uid');

  const validation = PDS.validateProjectAuthoring(data);
  assert(validation.ok === true, 'valid project passes authoring validation');

  data.scenes.village.visual.nodes[0].events.click[0].params.sceneId = 'missing_room';
  const bad = PDS.validateProjectAuthoring(data);
  assert(bad.ok === false, 'missing scene target fails validation');
  assert(bad.issues.some((i) => i.type === 'authoring_missing_scene'), 'authoring_missing_scene issue');
}

console.log('\nPhase A — export script list');

{
  const exportSrc = fs.readFileSync(path.join(root, 'js/editor-export.js'), 'utf8');
  assert(exportSrc.includes("'js/game-ui/visual-runtime.js'"), 'export includes visual-runtime.js');
  assert(exportSrc.includes("'js/game-ui/ui-runtime.js'"), 'export includes ui-runtime.js');
  assert(exportSrc.includes("'js/project-schema.js'"), 'export includes project-schema.js');
  assert(exportSrc.includes('ProjectDataSchema.migrateProjectData'), 'export calls migrateProjectData');
}

console.log('\nPhase A — build bundle list');

{
  const buildSrc = fs.readFileSync(path.join(root, 'scripts/build.mjs'), 'utf8');
  assert(buildSrc.includes('js/project-schema.js'), 'build.mjs includes project-schema');
  assert(buildSrc.includes('js/game-ui/visual-runtime.js'), 'build.mjs includes visual-runtime');
  assert(buildSrc.includes('js/game-ui/ui-runtime.js'), 'build.mjs includes ui-runtime');
}

console.log('\nPhase A — HTML load order');

{
  const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const psIdx = indexHtml.indexOf('project-schema.js');
  const vrIdx = indexHtml.indexOf('visual-runtime.js');
  assert(psIdx > 0 && vrIdx > psIdx, 'index.html loads project-schema before visual-runtime');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
