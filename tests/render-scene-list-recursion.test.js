'use strict';
/**
 * Regression: renderSceneList — no recursive re-entry via late wrappers.
 * Source check + simulated hooks.after path.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

let passed = 0, failed = 0;
function assert(c, m) {
  if (c) { passed++; console.log('  ✓', m); }
  else { failed++; console.error('  ✗', m); }
}

// 1) Source architecture
const importSrc = fs.readFileSync(path.join(root, 'js/editor-import.js'), 'utf8');
const mapSrc = fs.readFileSync(path.join(root, 'js/editor/editor-worldmap.js'), 'utf8');
const coreSrc = fs.readFileSync(path.join(root, 'js/editor/editor-core-tabs.js'), 'utf8');

assert(/renderSceneList\s*\(/.test(coreSrc), 'canonical owner: editor-core-tabs defines renderSceneList');
assert(!/Editor\.renderSceneList\s*=\s*function/.test(importSrc), 'import: no late Editor.renderSceneList = function');
assert(!/Editor\.renderSceneList\s*=\s*function/.test(mapSrc), 'worldmap: no late Editor.renderSceneList = function');
assert(!/origRenderSceneList/.test(importSrc), 'import: no origRenderSceneList bind wrapper');
assert(!/origRenderSceneList/.test(mapSrc), 'worldmap: no origRenderSceneList bind wrapper');
assert(/hooks\.after\(\s*['"]renderSceneList['"]/.test(importSrc), 'import uses hooks.after(renderSceneList)');
assert(/hooks\.after\(\s*['"]renderSceneList['"]/.test(mapSrc), 'worldmap uses hooks.after(renderSceneList)');

// 2) Behavioral simulation of hooks without loading full Editor
let implCalls = 0;
let afterCalls = 0;
let depth = 0;
let maxDepth = 0;

function baseRenderSceneList() {
  depth++;
  if (depth > maxDepth) maxDepth = depth;
  if (depth > 5) throw new Error('RECURSION');
  implCalls++;
  depth--;
}

const afterHooks = [];
function hookedRenderSceneList() {
  // before none
  baseRenderSceneList(); // _impl — never calls public hooked API
  for (const fn of afterHooks) fn();
}

afterHooks.push(() => { afterCalls++; /* ensureSceneListActions mock */ });
afterHooks.push(() => { afterCalls++; /* map badges mock */ });

implCalls = 0; afterCalls = 0; maxDepth = 0;
hookedRenderSceneList();
assert(implCalls === 1, '1 public invoke → 1 impl');
assert(afterCalls === 2, '2 after extensions');
assert(maxDepth === 1, 'depth 1 — no recursion');

hookedRenderSceneList();
hookedRenderSceneList();
assert(implCalls === 3, '3 public invokes → 3 impl');
assert(maxDepth === 1, 'still depth 1');

// 3) Forbidden pattern would recurse
let forbiddenThrows = false;
try {
  let publicApi;
  const wrap = function () {
    depth++;
    if (depth > 20) throw new Error('RECURSION');
    publicApi(); // BAD: calls public API
    depth--;
  };
  publicApi = wrap;
  depth = 0;
  publicApi();
} catch (e) {
  forbiddenThrows = String(e.message).includes('RECURSION');
}
assert(forbiddenThrows, 'documents that publicApi→publicApi pattern recurses (why we banned it)');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
