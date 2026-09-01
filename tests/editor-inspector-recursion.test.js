'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

let passed = 0, failed = 0;
function assert(c, m) {
  if (c) { passed++; console.log('  ✓', m); }
  else { failed++; console.error('  ✗', m); }
}

const src = fs.readFileSync(path.join(root, 'js/editor/editor-inspector.js'), 'utf8');

// Architecture: no late public API reassignment for select*
assert(!/Editor\[methodName\]\s*=\s*wrapped/.test(src), 'no Editor[methodName] = wrapped');
assert(!/__inspectorWrapped/.test(src), 'no __inspectorWrapped flag (old wrapper gone)');
assert(!/orig\.apply\(this,\s*arguments\)/.test(src), 'no orig.apply pattern in select wrap');
assert(/hooks\.after\(methodName/.test(src) || /hooks\.after\(/.test(src), 'uses hooks.after for select sync');

// Must not call public select APIs from after in a recursive way in source
// (Inspector.select is OK — different API)
assert(/Inspector\.select\(sel\)/.test(src), 'after hook updates Inspector.select');

// Behavioral model of correct path
let selectSceneImpl = 0;
let afterRuns = 0;
let depth = 0;
let maxDepth = 0;

function baseSelectScene(id) {
  depth++;
  if (depth > maxDepth) maxDepth = depth;
  if (depth > 5) throw new Error('RECURSION');
  selectSceneImpl++;
  depth--;
  return id;
}

const afters = [];
function hookedSelectScene(id) {
  const r = baseSelectScene(id);
  for (const fn of afters) fn(r, [id]);
  return r;
}

afters.push(function (result, args) {
  afterRuns++;
  // Inspector.select — NOT hookedSelectScene
});

selectSceneImpl = 0; afterRuns = 0; maxDepth = 0;
hookedSelectScene('scene_a');
assert(selectSceneImpl === 1, '1 impl per public call');
assert(afterRuns === 1, '1 after hook');
assert(maxDepth === 1, 'depth 1');

hookedSelectScene('scene_b');
hookedSelectScene('scene_c');
assert(selectSceneImpl === 3, '3 impl for 3 calls');
assert(maxDepth === 1, 'still no recursion');

// Forbidden pattern
let threw = false;
try {
  let api;
  const wrap = function () {
    depth++;
    if (depth > 30) throw new Error('RECURSION');
    api();
    depth--;
  };
  api = wrap;
  depth = 0;
  api();
} catch (e) {
  threw = /RECURSION/.test(e.message);
}
assert(threw, 'documents forbidden public→public recursion');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
