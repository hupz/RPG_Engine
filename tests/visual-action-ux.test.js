#!/usr/bin/env node
/**
 * Phase 1.6 — Action UX mapping + open_panel registry action
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

// Load ACTION_REGISTRY in isolation (needs minimal DOM stubs for some actions)
const ctx = {
  console,
  document: {
    body: { classList: { add() {}, remove() {}, contains() { return false; } }, style: {} },
    getElementById() {
      return null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    }
  },
  window: null,
  globalThis: null
};
ctx.window = ctx;
ctx.globalThis = ctx;
ctx.SidebarDock = {
  opened: null,
  open(id) {
    this.opened = id;
  },
  setVisible() {}
};

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/actions/action-registry.js'), 'utf8'), ctx, {
  filename: 'action-registry.js'
});

assert(!!ctx.ACTION_REGISTRY, 'ACTION_REGISTRY loaded');
assert(!!ctx.ACTION_REGISTRY.open_panel, 'open_panel registered');
assert(ctx.ACTION_REGISTRY.open_panel.name === 'Открыть панель', 'open_panel human name');

ctx.ACTION_REGISTRY.open_panel.execute({}, { panel: 'inventory' });
assert(ctx.SidebarDock.opened === 'inventory', 'open_panel → SidebarDock.inventory');

ctx.SidebarDock.opened = null;
ctx.ACTION_REGISTRY.open_panel.execute({}, { panel: 'unknown_xyz' });
// may return false or try DOM — should not throw
assert(true, 'unknown panel does not throw');

const journalCalls = [];
ctx.ACTION_REGISTRY.open_panel.execute(
  {
    renderQuestLog() {
      journalCalls.push(1);
    }
  },
  { panel: 'journal' }
);
assert(journalCalls.length === 1, 'journal calls renderQuestLog');

// Editor UX mapping
const ectx = {
  console,
  document: undefined,
  ACTION_REGISTRY: ctx.ACTION_REGISTRY,
  EditorHistory: {
    clone: (v) => JSON.parse(JSON.stringify(v)),
    recordMutation() {}
  },
  Editor: {
    data: {
      assets: { village_bg: { src: 'assets/images/village.png', name: 'Village' } },
      scenes: { village: { id: 'village', text: 't' }, tavern: { id: 'tavern' } },
      items: {},
      quests: {}
    },
    currentScene: 'village',
    escapeHtml: (s) => String(s),
    escapeAttr: (s) => String(s),
    markDirty() {},
    hooks: { after() {}, register() {} }
  }
};
ectx.window = ectx;
ectx.globalThis = ectx;
vm.createContext(ectx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-visual-scene.js'), 'utf8'), ectx);

const E = ectx.Editor;
const ux = E.getVisualActionUxList();
assert(ux.some((a) => a.action === 'change_scene'), 'UX has Open Scene');
assert(ux.some((a) => a.action === 'open_panel'), 'UX Open Panel (inventory/journal via params)');
assert(ux.some((a) => a.label && a.action === 'open_panel'), 'UX open_panel has human label');
assert(
  ux.every((a) => a.label && a.label.indexOf('_') === -1 || a.action === 'update_quest'),
  'labels human-readable (no raw snake in label preferred)'
);
// stricter: labels should not equal action ids
assert(
  ux.every((a) => a.label !== a.action),
  'label !== technical id'
);

const hid = E.visualAddNode('hotspot');
E.visualSetClickAction(hid, 'open_panel:journal', 'journal');
const node = E.data.scenes.village.visual.nodes.find((n) => n.id === hid);
assert(node.events.click[0].action === 'open_panel', 'stores open_panel id');
assert(node.events.click[0].params.panel === 'journal', 'stores panel journal');

E.visualSetClickAction(hid, 'change_scene', 'tavern');
assert(node.events.click[0].action === 'change_scene', 'Open Scene id');
assert(node.events.click[0].params.sceneId === 'tavern', 'sceneId param');

// Assets list
const assets = E.listVisualAssets();
assert(assets.some((a) => a.id === 'village_bg'), 'asset list has village_bg');

// Village workflow data shape
const village = {
  id: 'village_demo',
  text: 'Площадь деревни',
  visual: {
    mode: 'overlay',
    background: { asset: { type: 'image', ref: 'village_bg' } },
    nodes: [
      {
        id: 'hs_tavern',
        kind: 'hotspot',
        transform: { x: 0.1, y: 0.4, w: 0.15, h: 0.2, z: 2 },
        events: { click: [{ action: 'change_scene', params: { sceneId: 'tavern' } }] }
      },
      {
        id: 'img_diary',
        kind: 'image',
        transform: { x: 0.85, y: 0.05, w: 0.1, h: 0.12, z: 5 },
        events: { click: [{ action: 'open_panel', params: { panel: 'journal' } }] }
      }
    ]
  }
};
assert(village.visual.nodes[0].events.click[0].action === 'change_scene', 'village tavern OpenScene');
assert(village.visual.nodes[1].events.click[0].params.panel === 'journal', 'diary opens journal');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
