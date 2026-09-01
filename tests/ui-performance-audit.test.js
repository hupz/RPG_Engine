#!/usr/bin/env node
/**
 * Phase UI-23 — Performance audit tests (no flaky ms assertions)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { buildLargeProjectFixture } = require('./fixtures/large-project-fixture');
const root = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
function assert(c, m) {
  if (c) { passed++; console.log('  ✓', m); }
  else { failed++; console.error('  ✗', m); }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const html = read('editor.html');
const perf = read('js/editor/editor-performance.js');
const browser = read('js/editor/editor-content-browser.js');
const browserV2 = read('js/editor/editor-content-browser-v2.js');
const graph = read('js/editor/editor-graph.js');
const search = read('js/editor/editor-project-search.js');
const palette = read('js/editor/editor-command-palette.js');

assert(html.includes('editor-performance.js'), 'performance module wired');
assert(html.indexOf('editor-performance.js') < html.indexOf('editor-content-browser.js'),
  'performance loads before content browser');
assert(perf.includes('getSceneWarningMap'), 'scene warning cache');
assert(perf.includes('getCachedProjectSearchIndex'), 'search index cache');
assert(perf.includes('getCachedContentBrowserIndex'), 'content index cache');
assert(perf.includes('debouncedSceneListRender'), 'debounced scene list');
assert(perf.includes('debouncedProjectSearchRender'), 'debounced project search');
assert(perf.includes('debouncedPaletteRender'), 'debounced command palette');
assert(browser.includes('getSceneWarningCount'), 'content browser uses warning cache');
assert(browser.includes('debouncedSceneListRender'), 'content browser debounced search');
assert(browserV2.includes('getCachedContentBrowserIndex'), 'v2 cached global search index');
assert(browserV2.includes('ensureBrowserChromeV2(false)'), 'incremental chrome update');
assert(browserV2.includes('_cb2ForceChromeRebuild'), 'chrome rebuild only when needed');
assert(!graph.includes('validateProject'), 'story graph build does not call validateProject');
assert(search.includes('getCachedProjectSearchIndex'), 'project search uses cached index');
assert(search.includes('debouncedProjectSearchRender'), 'project search debounced input');
assert(palette.includes('debouncedPaletteRender'), 'palette debounced input');
assert(!perf.includes('SceneManager'), 'no runtime changes');

// Large fixture shape
const data = buildLargeProjectFixture();
assert(Object.keys(data.scenes).length === 200, 'fixture has 200 scenes');
assert(Object.keys(data.items).length === 500, 'fixture has 500 items');
assert(Object.keys(data.quests).length === 100, 'fixture has 100 quests');
assert(Object.keys(data.ui.screens).length === 5, 'fixture has UI screens');

let validateCalls = 0;
const ctx = {
  console: { log() {}, info() {}, warn() {}, error() {} },
  setTimeout(fn) { if (typeof fn === 'function') fn(); return 1; },
  clearTimeout() {},
  Editor: {
    data,
    hooks: { after() {}, register() {} },
    renderSceneList() {}
  },
  ProjectValidator: {
    validateProject(d) {
      validateCalls++;
      return {
        issues: Object.keys(d.scenes || {}).slice(0, 3).map((sid) => ({
          severity: 'warning',
          sceneId: sid
        }))
      };
    }
  }
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(perf, ctx);

assert(typeof ctx.Editor.Perf.getSceneWarningCount === 'function', 'Perf API exported');

validateCalls = 0;
const w1 = ctx.Editor.getSceneWarningCount('scene_0', data);
const w2 = ctx.Editor.getSceneWarningCount('scene_1', data);
const w3 = ctx.Editor.getSceneWarningCount('scene_2', data);
assert(validateCalls === 1, 'warning map validates once per data token (bounded)');
assert(w1 === 1 && w2 === 1, 'cached warning counts');

ctx.Editor.invalidatePerfCaches();
validateCalls = 0;
ctx.Editor.getSceneWarningCount('scene_0', data);
assert(validateCalls === 1, 'cache invalidation triggers recompute');

// debounce coalesces calls (fake timer — no wall-clock assertions)
let renderCalls = 0;
let scheduled = null;
ctx.setTimeout = function (fn) {
  scheduled = fn;
  return 1;
};
ctx.clearTimeout = function () {
  scheduled = null;
};
ctx.Editor.renderSceneListNow = function () { renderCalls++; };
vm.runInContext(perf, ctx);
ctx.Editor.Perf.debouncedSceneListRender();
ctx.Editor.Perf.debouncedSceneListRender();
ctx.Editor.Perf.debouncedSceneListRender();
assert(renderCalls === 0, 'debounce delays render until timer fires');
assert(typeof scheduled === 'function', 'debounce keeps one pending callback');
scheduled();
assert(renderCalls === 1, 'debounce coalesces rapid scene list renders');

// search index cache
let indexBuilds = 0;
ctx.Editor.buildProjectSearchIndex = function () {
  indexBuilds++;
  return [{ kind: 'Сцена', id: 'scene_0', title: 'A', haystack: 'a' }];
};
ctx.Editor._searchQuery = 'scene';
ctx.Editor._searchResults = [];
ctx.Editor.runProjectSearch = function (q) {
  const index = ctx.Editor.Perf.getCachedProjectSearchIndex(ctx.Editor.buildProjectSearchIndex);
  return index.filter((r) => r.haystack.includes(String(q || '').toLowerCase()));
};
ctx.Editor.runProjectSearch('scene');
ctx.Editor.runProjectSearch('scene');
assert(indexBuilds === 1, 'project search index built once per data token');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
