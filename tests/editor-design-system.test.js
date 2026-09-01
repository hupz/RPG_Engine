#!/usr/bin/env node
/**
 * Phase UI-5 — Design system structural tests.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
function assert(c, m) {
  if (c) { passed++; console.log('  ✓', m); }
  else { failed++; console.error('  ✗', m); }
}

// --- Static: files and editor.html wiring ---
const html = fs.readFileSync(path.join(root, 'editor.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/editor-design-system.css'), 'utf8');
const audit = fs.readFileSync(path.join(root, 'docs/UI-5-css-audit.md'), 'utf8');

assert(html.includes('editor-design-system.css'), 'editor.html links design-system CSS');
assert(html.includes('editor-design-system.js'), 'editor.html loads design-system JS');
assert(css.includes('--eds-space-1'), 'spacing tokens defined');
assert(css.includes('--eds-radius-control'), 'radius tokens defined');
assert(css.includes('--eds-text-doc-title'), 'typography tokens defined');
assert(css.includes('btn-ghost'), 'ghost button variant defined');
assert(css.includes('editor-writer-mode'), 'writer density rules');
assert(css.includes('@media (max-width: 1100px)'), 'responsive rules');
assert(audit.includes('Аудит CSS'), 'audit report exists (RU)');

// Required workspace DOM roots
const requiredIds = [
  'context-sidebar', 'scene-list', 'scene-editor', 'editor-section-bar'
];
requiredIds.forEach((id) => {
  assert(html.includes(`id="${id}"`), `DOM root #${id} in editor.html`);
});

// No duplicate critical IDs (simple count)
const dupCheck = ['context-sidebar', 'scene-editor'];
dupCheck.forEach((id) => {
  const re = new RegExp(`id="${id}"`, 'g');
  const matches = html.match(re) || [];
  assert(matches.length === 1, `unique id="${id}" (${matches.length})`);
});
assert(html.includes('class="editor-workspace"'), 'editor-workspace root class');

// Token values in CSS
assert(css.includes('4px') && css.includes('32px'), 'spacing scale 4–32');
assert(css.includes('focus-visible'), 'focus-visible a11y');

// --- Runtime: design system module ---
const ctx = {
  console: { log() {}, info() {}, warn() {}, error() {} },
  document: {
    readyState: 'complete',
    body: { classList: { add() {}, remove() {}, toggle() {} }, dataset: {} },
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    addEventListener() {}
  }
};
ctx.globalThis = ctx;
ctx.window = ctx;
ctx.Editor = {
  editorMode: 'writer',
  currentTab: 'scenes',
  currentScene: null,
  data: { scenes: { a: { id: 'a' } } },
  isWriterMode() { return this.editorMode === 'writer'; },
  isEditorAdvancedMode() { return false },
  applyContextLayoutClasses() {},
  Inspector: { selection: null, render() {} },
  hooks: { after() {}, register() {} }
};

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-design-system.js'), 'utf8'), ctx);

assert(ctx.document.body.dataset.eds === '1', 'data-eds flag set on boot');
assert(typeof ctx.Editor.renderSceneEmptyState === 'function', 'renderSceneEmptyState API');
assert(typeof ctx.Editor.applyEditorDensityClasses === 'function', 'applyEditorDensityClasses API');

// Empty state HTML
const mount = { innerHTML: '' };
ctx.Editor.renderSceneEmptyState(mount);
assert(mount.innerHTML.includes('Сцена не открыта'), 'empty state when scenes exist');
assert(mount.innerHTML.includes('empty-state__actions'), 'empty state CTA');

ctx.Editor.data = { scenes: {} };
ctx.Editor.renderSceneEmptyState(mount);
assert(mount.innerHTML.includes('Добро пожаловать'), 'empty state no scenes');

ctx.Editor.data = null;
ctx.Editor.renderSceneEmptyState(mount);
assert(mount.innerHTML.includes('Нет открытого проекта'), 'empty state no project');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
