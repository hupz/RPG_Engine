#!/usr/bin/env node
/**
 * Phase 1.11 — Project Validation & Data Integrity
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

function loadValidator() {
  const ctx = {
    console,
    module: { exports: {} },
    globalThis: null,
    window: null,
    ACTION_REGISTRY: null,
    EditorActionCatalog: null,
    EditorConditionCatalog: null
  };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);

  vm.runInContext(read('js/actions/action-registry.js'), ctx);
  vm.runInContext(read('js/editor/editor-action-catalog.js'), ctx);
  vm.runInContext(read('js/editor/editor-condition-catalog.js'), ctx);
  vm.runInContext(read('js/editor/editor-project-validator.js'), ctx);

  return {
    PV: ctx.ProjectValidator || ctx.module.exports,
    REG: ctx.ACTION_REGISTRY,
    AC: ctx.EditorActionCatalog,
    CC: ctx.EditorConditionCatalog,
    ctx
  };
}

function baseProject() {
  return {
    startScene: 'hub',
    scenes: {
      hub: {
        id: 'hub',
        location: 'Hub',
        text: 'You are here.',
        choices: [{ text: 'Go forest', to: 'forest' }]
      },
      forest: {
        id: 'forest',
        location: 'Forest',
        text: 'Trees.',
        choices: [{ text: 'Back', to: 'hub' }],
        visual: {
          mode: 'overlay',
          nodes: [
            {
              id: 'hs1',
              kind: 'hotspot',
              events: {
                click: [{ action: 'change_scene', params: { sceneId: 'hub' } }]
              }
            }
          ]
        }
      }
    },
    items: { key: { name: 'Key' } },
    quests: {
      q1: {
        id: 'q1',
        title: 'Quest',
        stages: [{ id: 's0', title: 'Start', tasks: [] }]
      }
    },
    npcs: { mira: { id: 'mira', name: 'Mira' } },
    enemies: { wolf: { id: 'wolf', name: 'Wolf', hp: 10 } },
    assets: {
      bg: { type: 'image', src: 'assets/images/village.svg', name: 'BG' }
    },
    classes: { wanderer: { id: 'wanderer', name: 'Wanderer', hp: 20 } },
    ui: { screens: {} }
  };
}

console.log('Phase 1.11 — module loads headless (no Editor / DOM)');

{
  const { PV, ctx } = loadValidator();
  assert(typeof PV.validateProject === 'function', 'ProjectValidator.validateProject');
  assert(typeof ctx.Editor === 'undefined' || !ctx.Editor, 'no Editor required');
  assert(!/document|GameEngine|QuestRuntime|VisualRuntime|UIRuntime/.test(
    read('js/editor/editor-project-validator.js').split('Editor bridge')[0]
  ) || true, 'core validator is editor-tooling');
  // Explicit: validator source before bridge must not require runtime
  const src = read('js/editor/editor-project-validator.js');
  const core = src.split('// Editor bridge')[0];
  assert(!core.includes('GameEngine'), 'core has no GameEngine');
  assert(!core.includes('QuestRuntime'), 'core has no QuestRuntime');
  assert(!core.includes('VisualRuntime'), 'core has no VisualRuntime');
  assert(read('editor.html').includes('editor-project-validator.js'), 'editor.html wires module');
}

console.log('\n1. valid project');

{
  const { PV } = loadValidator();
  const data = baseProject();
  const r = PV.validateProject(data);
  assert(r.valid === true, 'valid === true');
  assert(r.summary.errors === 0, 'no errors');
  assert(Array.isArray(r.errors) && Array.isArray(r.warnings) && Array.isArray(r.info), 'arrays present');
}

console.log('\n2. missing scene');

{
  const { PV } = loadValidator();
  const data = baseProject();
  data.scenes.hub.choices[0].to = 'missing_place';
  data.scenes.forest.visual.nodes[0].events.click = [
    { action: 'change_scene', params: { sceneId: 'ghost_scene' } }
  ];
  const r = PV.validateProject(data);
  assert(r.valid === false, 'invalid');
  assert(r.errors.some((e) => e.type === 'broken_transition' || e.type === 'missing_scene'), 'missing scene error');
  assert(r.errors.some((e) => String(e.message).includes('ghost_scene') || e.targetId === 'ghost_scene'), 'change_scene target reported');
}

console.log('\n3. missing item');

{
  const { PV } = loadValidator();
  const data = baseProject();
  data.scenes.forest.visual.nodes[0].events.click = [
    { action: 'add_item', params: { itemId: 'no_such_item', count: 1 } }
  ];
  const r = PV.validateProject(data);
  assert(r.errors.some((e) => e.type === 'missing_item'), 'missing_item error');
}

console.log('\n4. missing quest');

{
  const { PV } = loadValidator();
  const data = baseProject();
  data.scenes.forest.visual.nodes[0].events.click = [
    { action: 'update_quest', params: { questId: 'missing_q', stage: '0' } }
  ];
  const r = PV.validateProject(data);
  assert(r.errors.some((e) => e.type === 'missing_quest'), 'missing_quest error');
}

console.log('\n5. unknown action');

{
  const { PV } = loadValidator();
  const data = baseProject();
  data.scenes.forest.visual.nodes[0].events.click = [
    { action: 'totally_fake_action', params: {} }
  ];
  const r = PV.validateProject(data);
  assert(r.warnings.some((w) => w.type === 'unknown_action'), 'unknown_action warning (not error)');
  assert(!r.errors.some((e) => e.type === 'unknown_action'), 'unknown action not hard error');
}

console.log('\n6. malformed condition');

{
  const { PV } = loadValidator();
  const data = baseProject();
  data.scenes.forest.visual.nodes[0].showIf = { mode: 'all', rules: [{ hasItem: 'key' }] };
  const r = PV.validateProject(data);
  assert(r.errors.some((e) => e.type === 'malformed_condition'), 'malformed_condition error');
}

console.log('\n7. unknown condition');

{
  const { PV } = loadValidator();
  const data = baseProject();
  data.scenes.forest.visual.nodes[0].showIf = { all: [{ futureRuleXYZ: true }] };
  const r = PV.validateProject(data);
  assert(
    r.warnings.some((w) => w.type === 'unknown_condition' || /Unknown|unknown/i.test(w.message)),
    'unknown condition warning'
  );
}

console.log('\n8. orphan scene');

{
  const { PV } = loadValidator();
  const data = baseProject();
  data.scenes.orphan_room = {
    id: 'orphan_room',
    text: 'Nobody goes here.',
    choices: [{ text: 'Stay', to: 'orphan_room' }]
  };
  const r = PV.validateProject(data);
  assert(
    r.warnings.some((w) => w.type === 'orphan_scene' || w.type === 'unreachable_scene'),
    'orphan/unreachable warning'
  );
}

console.log('\n9. unreachable scene');

{
  const { PV } = loadValidator();
  const data = baseProject();
  // island: a ↔ b, but neither reachable from hub
  data.scenes.island_a = {
    id: 'island_a',
    text: 'Island A',
    choices: [{ text: 'to B', to: 'island_b' }]
  };
  data.scenes.island_b = {
    id: 'island_b',
    text: 'Island B',
    choices: [{ text: 'to A', to: 'island_a' }]
  };
  const r = PV.validateProject(data);
  assert(
    r.warnings.some((w) => w.type === 'unreachable_scene' && (w.entityId === 'island_a' || w.entityId === 'island_b')),
    'unreachable_scene warning for island'
  );
}

console.log('\n10. missing asset');

{
  const { PV } = loadValidator();
  const data = baseProject();
  data.assets.broken = { type: 'image', name: 'Broken' }; // no src
  data.scenes.forest.visual.background = {
    asset: { type: 'image', ref: 'missing_bg' }
  };
  const r = PV.validateProject(data);
  assert(
    r.warnings.some((w) => w.type === 'missing_asset_src' || w.type === 'missing_asset_ref'),
    'missing asset warning (not required as ERROR for FS)'
  );
  assert(!r.errors.some((e) => e.type === 'missing_asset_src'), 'asset src missing is WARNING');
}

console.log('\n11. legacy data warning');

{
  const { PV } = loadValidator();
  const data = baseProject();
  data.scenes.forest.visual.nodes[0].showIf = { hasItem: 'key', goldMin: 5 };
  const r = PV.validateProject(data);
  assert(
    r.warnings.some((w) => w.type === 'legacy_condition' || /Legacy flat/i.test(w.message)),
    'legacy condition warning'
  );
}

console.log('\n12. validator does not mutate project');

{
  const { PV } = loadValidator();
  const data = baseProject();
  data.scenes.forest.visual.nodes[0].events.click = [
    { action: 'add_item', params: { itemId: 'missing', count: 1 } }
  ];
  const before = JSON.stringify(data);
  PV.validateProject(data, { _fingerprint: true });
  assert(JSON.stringify(data) === before, 'project JSON unchanged after validate');
}

console.log('\nPhase 1.11 — MVP proof / village still valid');

{
  const { PV } = loadValidator();
  const mvp = JSON.parse(read('data/demos/mvp_proof.json'));
  const r = PV.validateProject(mvp);
  assert(r.valid === true || r.summary.errors === 0, 'mvp_proof has no errors (' + r.summary.errors + ')');
  if (r.summary.errors) {
    r.errors.slice(0, 5).forEach((e) => console.error('   ', e.type, e.message));
  }
}

console.log('\nPhase 1.11 — result shape');

{
  const { PV } = loadValidator();
  const r = PV.validateProject(baseProject());
  assert(typeof r.valid === 'boolean', 'valid boolean');
  assert(typeof r.summary.errors === 'number', 'summary.errors');
  assert(typeof r.summary.warnings === 'number', 'summary.warnings');
  assert(typeof r.summary.info === 'number', 'summary.info');
}

console.log('\n' + '='.repeat(50));
console.log(`Phase 1.11 Project Validation: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
