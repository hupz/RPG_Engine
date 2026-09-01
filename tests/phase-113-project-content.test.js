#!/usr/bin/env node
/**
 * Phase 1.13 — Project Content Management
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
  const ctx = { console, module: { exports: {} }, globalThis: null, window: null };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/editor/editor-content-index.js'), ctx);
  return ctx.EditorContentIndex || ctx.module.exports;
}

function sampleData() {
  return {
    startScene: 'hub',
    scenes: {
      hub: {
        id: 'hub',
        location: 'Town Square',
        text: 'Welcome to the square.',
        tags: ['hub', 'start'],
        choices: [{ text: 'Forest', to: 'forest' }]
      },
      forest: {
        id: 'forest',
        location: 'Dark Forest',
        text: 'Trees everywhere.',
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
        },
        choices: [{ text: 'Back', to: 'hub' }]
      },
      visual_only: {
        id: 'visual_only',
        location: 'Map',
        visual: {
          mode: 'full',
          background: { src: 'assets/images/village.svg' },
          nodes: []
        }
      },
      orphan: {
        id: 'orphan',
        location: 'Secret Room',
        text: 'Nobody comes here.'
      }
    },
    items: { key: { name: 'Key' } },
    quests: { q1: { title: 'Quest', stages: [] } },
    npcs: { mira: { name: 'Mira', dialogueSceneId: 'hub' } },
    ui: {
      screens: {
        hud: {
          id: 'hud',
          scope: 'persistent',
          nodes: [
            {
              id: 'b1',
              kind: 'button',
              events: {
                click: [{ action: 'change_scene', params: { sceneId: 'forest' } }]
              }
            }
          ]
        }
      }
    },
    classes: { wanderer: { name: 'Wanderer' } }
  };
}

console.log('Phase 1.13 — module wiring / no runtime');

{
  const src = read('js/editor/editor-project-content-phase-113.js');
  assert(read('editor.html').includes('editor-project-content-phase-113.js'), 'editor.html loads module');
  assert(!src.includes('QuestRuntime'), 'no QuestRuntime');
  assert(!src.includes('SceneManager'), 'no SceneManager');
  assert(!src.includes('ACTION_REGISTRY'), 'no ACTION_REGISTRY execute');
  const core = read('js/editor/editor-content-index.js');
  assert(!core.includes('GameEngine'), 'index has no GameEngine');
}

console.log('\n1. search');

{
  const IDX = loadIndex();
  const data = sampleData();
  const byId = IDX.searchScenes(data, { query: 'forest' });
  assert(byId.some((r) => r.id === 'forest'), 'search by id');
  const byTitle = IDX.searchScenes(data, { query: 'town square' });
  assert(byTitle.some((r) => r.id === 'hub'), 'search by title');
  const byText = IDX.searchScenes(data, { query: 'trees everywhere' });
  assert(byText.some((r) => r.id === 'forest'), 'search by text');
  const byTag = IDX.searchScenes(data, { query: 'hub' });
  assert(byTag.some((r) => r.id === 'hub'), 'search by tags');
}

console.log('\n2. filter');

{
  const IDX = loadIndex();
  const data = sampleData();
  const text = IDX.searchScenes(data, { filter: 'text' });
  assert(text.every((r) => r.kind === 'text'), 'TEXT filter');
  assert(text.some((r) => r.id === 'orphan'), 'orphan is text');
  const visual = IDX.searchScenes(data, { filter: 'visual' });
  assert(visual.every((r) => r.kind === 'visual' || r.kind === 'mixed'), 'Visual filter includes visual+mixed');
  assert(visual.some((r) => r.id === 'forest' || r.id === 'visual_only'), 'visual scenes found');
  const mixed = IDX.searchScenes(data, { filter: 'mixed' });
  assert(mixed.some((r) => r.id === 'forest'), 'forest is mixed');
  const ui = IDX.searchScenes(data, { filter: 'ui' });
  assert(ui.some((r) => r.id === 'forest'), 'UI-linked forest');
}

console.log('\n3–4. duplicate + unique id');

{
  const IDX = loadIndex();
  const data = sampleData();
  const a = IDX.buildDuplicatedScene('hub', data.scenes.hub, data.scenes);
  assert(a.id !== 'hub', 'new id differs');
  assert(a.scene.id === a.id, 'internal id matches');
  assert(!data.scenes[a.id], 'original map untouched');
  data.scenes[a.id] = a.scene;
  const b = IDX.buildDuplicatedScene('hub', data.scenes.hub, data.scenes);
  assert(b.id !== a.id, 'second duplicate unique');
  assert(IDX.allocateUniqueSceneId('hub', { hub: 1, hub_copy: 1 }) === 'hub_copy_2', 'allocate unique');
}

console.log('\n5. delete reference detection');

{
  const IDX = loadIndex();
  const data = sampleData();
  const refsHub = IDX.findSceneReferences('hub', data);
  assert(refsHub.some((r) => r.kind === 'action' || r.kind === 'choice'), 'hub has inbound refs');
  assert(refsHub.some((r) => r.fromId === 'forest'), 'forest → hub');
  assert(refsHub.some((r) => r.kind === 'npc'), 'npc dialogueSceneId');
  assert(refsHub.some((r) => r.kind === 'startScene'), 'startScene ref');
  const refsOrphan = IDX.findSceneReferences('orphan', data);
  assert(refsOrphan.length === 0, 'orphan has no inbound refs');
  const refsForest = IDX.findSceneReferences('forest', data);
  assert(refsForest.some((r) => r.kind === 'choice' || r.kind === 'ui'), 'forest referenced by choice/ui');
}

console.log('\n6. project stats');

{
  const IDX = loadIndex();
  const stats = IDX.collectProjectContentStats(sampleData());
  assert(stats.scenes === 4, 'scenes count');
  assert(stats.visual_scenes >= 2, 'visual scenes');
  assert(stats.items === 1, 'items');
  assert(stats.quests === 1, 'quests');
  assert(stats.npcs === 1, 'npcs');
  assert(stats.ui_screens === 1, 'ui screens');
}

console.log('\n7. kinds from existing fields');

{
  const IDX = loadIndex();
  const data = sampleData();
  assert(IDX.getSceneKind(data.scenes.orphan) === 'text', 'text kind');
  assert(IDX.getSceneKind(data.scenes.visual_only) === 'visual', 'visual kind');
  assert(IDX.getSceneKind(data.scenes.forest) === 'mixed', 'mixed kind');
}

console.log('\nUX APIs present');

{
  const ux = read('js/editor/editor-project-content-phase-113.js');
  assert(ux.includes('duplicateScene'), 'duplicateScene API');
  assert(ux.includes('deleteSceneSafe'), 'deleteSceneSafe API');
  assert(ux.includes('renderProjectOverviewBar'), 'overview');
  assert(ux.includes('renderSceneListEmptyState'), 'empty state');
  assert(ux.includes('ProjectValidator'), 'validator integration (optional)');
}

console.log('\n' + '='.repeat(50));
console.log(`Phase 1.13 Content Mgmt: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
