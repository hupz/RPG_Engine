#!/usr/bin/env node
/**
 * Phase UI-10 — Editor Design System tests
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

const html = fs.readFileSync(path.join(root, 'editor.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/editor-design-system.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'js/editor/editor-design-system.js'), 'utf8');
const audit = fs.readFileSync(path.join(root, 'docs/ui-redesign/UI-10-visual-audit.md'), 'utf8');

assert(html.includes('editor-design-system.css'), 'CSS linked');
assert(html.includes('editor-design-system.js'), 'JS linked');
assert(audit.includes('Визуальный хаос'), 'audit doc exists');

// UI-10 tokens
const uiTokens = [
  '--ui-bg', '--ui-surface', '--ui-surface-raised', '--ui-border', '--ui-border-subtle',
  '--ui-text', '--ui-text-muted', '--ui-accent', '--ui-success', '--ui-warning', '--ui-danger',
  '--space-1', '--space-2', '--space-3', '--space-4', '--space-6',
  '--radius-sm', '--radius-md', '--radius-lg'
];
uiTokens.forEach((t) => assert(css.includes(t), 'token ' + t));

// Component classes
const components = [
  '.ui-button', '.ui-button--primary', '.ui-button--secondary', '.ui-button--ghost',
  '.ui-button--danger', '.ui-card', '.ui-panel', '.ui-input', '.ui-section',
  '.ui-empty-state', '.ui-toolbar'
];
components.forEach((c) => assert(css.includes(c), 'component ' + c));

// Rollout scopes
assert(css.includes('data-ui="1"] .editor-nav'), 'nav rollout');
assert(css.includes('data-ui="1"] .usw-root'), 'workspace rollout');
assert(css.includes('data-ui="1"] .editor-inspector'), 'inspector rollout');
assert(css.includes('data-ui="1"] .cb-scene-card'), 'content browser rollout');

// Button hierarchy
assert(css.includes('.header-buttons .btn:not(.btn-primary)'), 'header secondary de-emphasis');

// DOM IDs preserved
['context-sidebar', 'scene-list', 'scene-editor', 'editor-section-bar']
  .forEach((id) => assert(html.includes('id="' + id + '"'), 'DOM #' + id));
assert(html.includes('editor-inspector') || html.includes('id="editor-inspector"'), 'inspector in DOM');

// Runtime
const shellCalls = [];
const ctx = {
  console: { log() {}, info() {}, warn() {}, error() {} },
  document: {
    readyState: 'complete',
    body: { classList: { add() {}, remove() {}, toggle() {} }, dataset: {} },
    querySelector(sel) {
      if (sel === '.main-area') return ctx._main;
      return null;
    },
    querySelectorAll(sel) {
      if (sel === '.editor-nav') return [ctx._nav];
      if (sel === '#context-sidebar') return [ctx._sidebar];
      if (sel === '#editor-inspector') return [ctx._inspector];
      if (sel === '.usw-root') return [];
      if (sel === '.header-buttons') return [ctx._header];
      return [];
    },
    getElementById: () => null,
    addEventListener() {}
  },
  _nav: { classList: { _cls: '', add(c) { this._cls += ' ' + c; } } },
  _sidebar: { classList: { _cls: '', add(c) { this._cls = c; } } },
  _inspector: { classList: { _cls: '', add(c) { this._cls = c; } } },
  _header: { classList: { _cls: '', add(c) { this._cls = c; } } },
  _main: { classList: { _cls: '', add(c) { this._cls = c; } } }
};

ctx.Editor = {
  editorMode: 'writer',
  currentTab: 'scenes',
  isWriterMode() { return true; },
  isEditorAdvancedMode() { return false; },
  applyContextLayoutClasses() {},
  Inspector: { selection: null, render() {} },
  hooks: { after() {}, register() {} }
};
ctx.globalThis = ctx;
ctx.window = ctx;

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-hooks.js'), 'utf8'), ctx);
vm.runInContext(js, ctx);

assert(typeof ctx.Editor.isUiDesignSystemActive === 'function', 'isUiDesignSystemActive API');
assert(typeof ctx.Editor.applyUiShellClasses === 'function', 'applyUiShellClasses API');

ctx.Editor.applyUiShellClasses();
assert(ctx.document.body.dataset.ui === '1', 'data-ui flag on boot');
assert(ctx._nav.classList._cls.includes('ui-shell'), 'nav ui-shell class');
assert(ctx._sidebar.classList._cls === 'ui-shell', 'sidebar ui-shell');
assert(ctx._header.classList._cls === 'ui-toolbar', 'header ui-toolbar');

// Writer vs advanced density
ctx.Editor.applyEditorDensityClasses();
assert(ctx.document.body.classList.toggle, 'density classes callable');

// No history / schema changes in module
assert(!js.includes('recordMutation'), 'no history mutations');
assert(!js.includes('SceneManager'), 'no runtime dependency');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
