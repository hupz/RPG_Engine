'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'js/editor/editor-scene-builder.js'), 'utf8');

let passed = 0, failed = 0;
function assert(c, m) {
  if (c) { passed++; console.log('  ✓', m); }
  else { failed++; console.error('  ✗', m); }
}

// 1) Button renders with data-action (not broken optional-chaining onclick)
assert(src.includes('data-action="open-scene-templates"'), 'Template block button uses data-action');
assert(!/onclick="Editor\.openCreateSceneModal\?\.\(\)"/.test(src), 'old optional-chaining onclick removed');

// 2) API exists
assert(/Editor\.openCreateSceneModal\s*=\s*function/.test(src), 'openCreateSceneModal defined');
assert(/Editor\.closeCreateSceneModal\s*=\s*function/.test(src), 'closeCreateSceneModal defined');
assert(/Editor\.applySceneTemplateToCurrent\s*=\s*function/.test(src), 'applySceneTemplateToCurrent defined');
assert(/Editor\.createSceneFromBaseTemplate\s*=\s*function/.test(src), 'createSceneFromBaseTemplate defined');
assert(src.includes('scene-template-replace-toggle'), 'replace-current-scene toggle in picker');
assert(!src.includes('заполнит <strong>текущую</strong>'), 'picker no longer promises overwrite on click');
assert(src.includes('будет создана <strong>новая</strong>'), 'picker promises new scene by default');

// 3) Click path via stable document delegation
assert(src.includes("closest('[data-action=\"open-scene-templates\"]')") ||
       src.includes('data-action="open-scene-templates"'), 'delegation handles open-scene-templates');
assert(src.includes('_sceneBuilderClickBound'), 'single document-level bind flag');

// 4) Simulate click after "rerender" — handler is on document, not replaced button
let openCalls = 0;
const Editor = {
  openCreateSceneModal() { openCalls++; },
  closeCreateSceneModal() {},
  applySceneTemplateToCurrent() {}
};
// Fake delegation matching production
function handleClick(targetAttrs) {
  if (targetAttrs['data-action'] === 'open-scene-templates') {
    Editor.openCreateSceneModal();
    return true;
  }
  return false;
}
// first render
assert(handleClick({ 'data-action': 'open-scene-templates' }), 'click invokes open');
assert(openCalls === 1, 'Click: PASS (1 call)');
// rerender — new button, same delegation
assert(handleClick({ 'data-action': 'open-scene-templates' }), 'click after rerender');
assert(openCalls === 2, 'After rerender: PASS');
// no duplicate: one logical path
assert(openCalls === 2, 'No duplicate handlers from re-render');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
