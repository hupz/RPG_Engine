#!/usr/bin/env node
/**
 * Phase F — Prefabs & Templates: schema, instantiate, detach, update, editor wiring
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

function loadSchema() {
  const ctx = { console, module: { exports: {} }, globalThis: null, window: null };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/project-schema.js'), 'utf8'), ctx);
  return ctx.ProjectSchema;
}

console.log('Phase F — schema: prefabs catalog');

{
  const PS = loadSchema();
  assert(PS.PREFAB_TYPES.includes('visual'), 'PREFAB_TYPES visual');
  assert(PS.PREFAB_TYPES.includes('ui'), 'PREFAB_TYPES ui');

  const data = { prefabs: {} };
  const pid = PS.registerPrefab(data, 'pf_test', {
    type: 'visual',
    name: 'Test Hotspots',
    nodes: [{
      id: 'hs1',
      kind: 'hotspot',
      transform: { x: 0.1, y: 0.1, w: 0.2, h: 0.2, z: 1 },
      events: { click: [{ action: 'say', params: { text: 'hi' } }] }
    }]
  });
  assert(pid === 'pf_test', 'registerPrefab id');
  assert(data.prefabs.pf_test.nodes.length === 1, 'prefab nodes normalized');

  const inst = PS.instantiatePrefabNodes(data.prefabs.pf_test, { offsetX: 0.05, offsetY: 0.05 });
  assert(inst.length === 1, 'instantiate one node');
  assert(inst[0].prefabLink?.prefabId === 'pf_test', 'instance prefabLink');
  assert(inst[0].prefabLink?.sourceNodeId === 'hs1', 'instance sourceNodeId');
  assert(inst[0].id !== 'hs1', 'instance new id');
  assert(Math.abs(inst[0].transform.x - 0.15) < 0.001, 'instance offset x');

  const nodes = inst.slice();
  PS.detachPrefabInstance(nodes, inst[0].prefabLink.instanceId);
  assert(!nodes[0].prefabLink, 'detach removes prefabLink');

  const inst2 = PS.instantiatePrefabNodes(data.prefabs.pf_test, {});
  nodes.push(...inst2);
  const iid = inst2[0].prefabLink.instanceId;
  data.prefabs.pf_test.nodes[0].props = { label: 'Updated' };
  data.prefabs.pf_test = PS.normalizePrefab(data.prefabs.pf_test, 'pf_test');
  PS.updatePrefabInstanceNodes(nodes, data.prefabs.pf_test, iid);
  const updated = nodes.find((n) => n.prefabLink?.instanceId === iid);
  assert(updated?.props?.label === 'Updated', 'update from prefab template');
  assert(updated?.transform, 'update keeps transform');

  const grouped = PS.collectPrefabInstances(nodes);
  assert(grouped.some((g) => g.instanceId === iid), 'collectPrefabInstances');

  PS.normalizeProjectAuthoring({
    meta: {},
    scenes: {},
    ui: { screens: {} },
    prefabs: { pf_x: { type: 'ui', name: 'x', nodes: [] } }
  });
  assert(Array.isArray(PS.listProjectPrefabs({ prefabs: { pf_x: { type: 'ui', name: 'x', nodes: [] } } })), 'listProjectPrefabs');
}

console.log('\nPhase F — builtin library');

{
  const libSrc = fs.readFileSync(path.join(root, 'js/editor/editor-prefab-library.js'), 'utf8');
  assert(libSrc.includes('pf_village_hotspots'), 'village prefab');
  assert(libSrc.includes('pf_journal_panel'), 'journal prefab');
  assert(libSrc.includes('pf_main_menu_block'), 'main menu prefab');
  assert(libSrc.includes('pf_shop_interior'), 'shop interior prefab');

  const PS = loadSchema();
  const ctx = { console, ProjectSchema: PS, globalThis: null, window: null };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(libSrc, ctx);
  const PL = ctx.PrefabLibrary;
  assert(PL.listBuiltinPrefabs().length >= 5, 'builtin count');
  const data = { prefabs: {} };
  const added = PL.seedBuiltinPrefabs(data, { onlyMissing: true });
  assert(added.length >= 5, 'seed adds prefabs');
  assert(data.prefabs.pf_hud_actions, 'hud prefab seeded');
}

console.log('\nPhase F — editor wiring');

{
  const html = fs.readFileSync(path.join(root, 'editor.html'), 'utf8');
  assert(html.includes('editor-prefab-library.js'), 'editor loads prefab library');
  assert(html.includes('editor-prefabs-phase-f.js'), 'editor loads phase-f module');
  assert(html.includes('id="tab-prefabs"'), 'prefabs tab content');

  const nav = fs.readFileSync(path.join(root, 'js/editor/editor-nav-layout.js'), 'utf8');
  assert(nav.includes("tab: 'prefabs'"), 'nav prefabs subtab');

  const pf = fs.readFileSync(path.join(root, 'js/editor/editor-prefabs-phase-f.js'), 'utf8');
  assert(pf.includes('saveVisualSelectionAsPrefab'), 'save visual prefab');
  assert(pf.includes('insertUiPrefab'), 'insert ui prefab');
  assert(pf.includes('detachPrefabInstance'), 'detach API');
  assert(pf.includes('updatePrefabInstance'), 'update API');
  assert(pf.includes('renderPrefabsPanel'), 'prefabs panel');
  assert(pf.includes('renderVisualPrefabToolbar'), 'visual toolbar');
}

console.log('\n---');
console.log('Passed:', passed, 'Failed:', failed);
process.exit(failed ? 1 : 0);
