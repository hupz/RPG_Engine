#!/usr/bin/env node
/**
 * Phase 1.11 — Project & Content Workflow
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

function loadIndex() {
  const ctx = { module: { exports: {} }, globalThis: null, window: null, console };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-content-index.js'), 'utf8'), ctx);
  return ctx.EditorContentIndex || ctx.module.exports;
}

console.log('Phase 1.11 — content stats from real data shape');

{
  const IDX = loadIndex();
  assert(typeof IDX.collectProjectContentStats === 'function', 'collectProjectContentStats');

  const empty = IDX.collectProjectContentStats(null);
  assert(empty.scenes === 0 && empty.items === 0, 'empty/null project stats are zero');

  const partial = IDX.collectProjectContentStats({ scenes: { a: { text: 'A' } } });
  assert(partial.scenes === 1, 'partial scenes counted');
  assert(partial.items === 0, 'missing items collection safe');

  const data = {
    scenes: {
      village: { location: 'Деревня', visual: { mode: 'overlay', nodes: [{ id: 'hs1' }] } },
      tavern: { title: 'Tavern' }
    },
    items: { sword: { name: 'Меч', type: 'weapon' } },
    quests: { q1: { title: 'Квест' } },
    npcs: { npc1: { name: 'Bob' } },
    playerCharacters: { hero: { name: 'Hero' } },
    enemies: { goblin: { name: 'Goblin' } },
    ui: { screens: { hud: { id: 'hud', scope: 'scene' } } },
    assets: { village_bg: { type: 'image', name: 'Village' } }
  };
  const stats = IDX.collectProjectContentStats(data);
  assert(stats.scenes === 2, 'scenes count');
  assert(stats.visual_scenes === 1, 'visual scenes count');
  assert(stats.items === 1, 'items count');
  assert(stats.ui_screens === 1, 'ui screens count');
  assert(stats.assets === 1, 'assets count');
}

console.log('\nPhase 1.11 — search and category filter');

{
  const IDX = loadIndex();
  const data = {
    scenes: { forest: { location: 'Лес' }, cave: { location: 'Пещера' } },
    items: { potion: { name: 'Зелье' } }
  };
  const all = IDX.buildContentBrowserIndex(data, { writerMode: true });
  assert(all.length === 3, 'index all entries');

  const filtered = IDX.filterContentEntries(all, { category: 'scenes', query: 'лес' });
  assert(filtered.length === 1 && filtered[0].id === 'forest', 'search + category filter');

  const none = IDX.filterContentEntries(all, { query: 'zzz_missing' });
  assert(none.length === 0, 'search no match');
}

console.log('\nPhase 1.11 — writer mode categories');

{
  const IDX = loadIndex();
  const writerCats = IDX.getVisibleCategories({ writerMode: true, data: {} });
  assert(writerCats.some((c) => c.id === 'scenes'), 'writer sees scenes');
  assert(writerCats.every((c) => c.writerVisible !== false), 'writer mode categories');
}

console.log('\nPhase 1.11 — module wiring');

{
  const wf = fs.readFileSync(path.join(root, 'js/editor/editor-content-workflow.js'), 'utf8');
  const dash = fs.readFileSync(path.join(root, 'js/editor-dashboard.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'editor.html'), 'utf8');

  assert(wf.includes('openContentEntity'), 'openContentEntity API');
  assert(wf.includes('createContentEntity'), 'createContentEntity API');
  assert(wf.includes('selectScene'), 'reuses selectScene');
  assert(wf.includes('selectQuestToEdit'), 'reuses selectQuestToEdit');
  assert(wf.includes('uiSelectScreen'), 'reuses uiSelectScreen');
  assert(wf.includes('return false'), 'unknown entity graceful');

  assert(dash.includes('getProjectContentStats'), 'dashboard uses content stats');
  assert(dash.includes('renderProjectDashboardContentSection'), 'dashboard content section');

  assert(html.includes('editor-content-index.js'), 'index script wired');
  assert(html.includes('editor-content-workflow.js'), 'workflow script wired');

  const engineFiles = ['js/engine/core.js', 'js/engine/scene-manager.js'];
  engineFiles.forEach((f) => {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    assert(!src.includes('editor-content-index'), f + ' has no editor-content dependency');
    assert(!src.includes('EditorContentIndex'), f + ' has no EditorContentIndex');
  });
}

console.log('\n' + '='.repeat(40));
console.log('Phase 1.11 results:', passed, 'passed,', failed, 'failed');
process.exit(failed ? 1 : 0);
