#!/usr/bin/env node
/**
 * Phase UI-18 — Responsive Editor Layout tests
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
const js = fs.readFileSync(path.join(root, 'js/editor/editor-responsive-layout.js'), 'utf8');

assert(html.includes('editor-responsive-layout.js'), 'script wired');
assert(css.includes('data-layout-tier'), 'layout tier CSS scope');
assert(css.includes('is-drawer'), 'inspector drawer mode');
assert(css.includes('editor-layout-fab'), 'layout FAB controls');
assert(css.includes('overflow-x: hidden'), 'overflow guard');
assert(js.includes('toggleContentSidebar'), 'reuses sidebar toggle API');
assert(js.includes('inspectorCollapsed'), 'reuses inspector collapse state');
assert(!js.includes('mobile-layout'), 'no mobile rewrite');
assert(!js.includes('@media (max-width: 480px)'), 'no phone breakpoints');

const ctx = {
  console: { log() {}, info() {}, warn() {}, error() {} },
  window: {
    innerWidth: 1280,
    addEventListener() {},
    _editorLayoutResizeBound: false
  },
  document: {
    readyState: 'complete',
    documentElement: { style: { setProperty() {} } },
    body: { dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {} },
    getElementById(id) {
      if (id === 'context-sidebar') return ctx._sidebar;
      if (id === 'editor-inspector') return ctx._inspector;
      if (id === 'editor-layout-fabs') return null;
      return null;
    },
    createElement() {
      return {
        id: '', className: '', hidden: false, innerHTML: '',
        classList: { add() {}, remove() {}, toggle() {} },
        appendChild() {},
        addEventListener() {},
        querySelector() { return null; },
        querySelectorAll() { return []; }
      };
    },
    addEventListener() {}
  },
  Editor: {
    workspace: { ui: {} },
    currentTab: 'scenes',
    hooks: null,
    applyContextLayoutClasses() {}
  }
};
ctx._sidebar = {
  id: 'context-sidebar',
  classList: {
    _c: new Set(['is-visible']),
    contains(c) { return this._c.has(c); },
    add(c) { this._c.add(c); },
    remove(c) { this._c.delete(c); },
    toggle(c, on) { on ? this._c.add(c) : this._c.delete(c); }
  }
};
ctx._inspector = {
  id: 'editor-inspector',
  querySelector() { return null; },
  classList: {
    _c: new Set(),
    contains(c) { return this._c.has(c); },
    add(c) { this._c.add(c); },
    remove(c) { this._c.delete(c); },
    toggle(c, on) { on ? this._c.add(c) : this._c.delete(c); }
  }
};
ctx.globalThis = ctx;
ctx.window = ctx.window;

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-hooks.js'), 'utf8'), ctx);
vm.runInContext(js, ctx);

const E = ctx.Editor;

assert(typeof E.getLayoutTier === 'function', 'getLayoutTier API');
assert(typeof E.applyResponsiveLayout === 'function', 'applyResponsiveLayout API');
assert(typeof E.toggleContentSidebar === 'function', 'toggleContentSidebar API');
assert(typeof E.toggleInspectorPanel === 'function', 'toggleInspectorPanel API');

assert(E.getLayoutTier(1280) === 'sm', '1280 → sm tier');
assert(E.getLayoutTier(1366) === 'md', '1366 → md tier');
assert(E.getLayoutTier(1440) === 'lg', '1440 → lg tier');
assert(E.getLayoutTier(1920) === 'xl', '1920 → xl tier');

const tier = E.applyResponsiveLayout(1280);
assert(tier === 'sm', 'apply sets sm tier');
assert(ctx.document.body.dataset.layoutTier === 'sm', 'body data-layout-tier');

ctx.window.innerWidth = 1920;
assert(E.getLayoutTier() === 'xl', '1920 tier');

const bps = E.getLayoutBreakpoints();
assert(bps.sm === 1280 && bps.md === 1366 && bps.lg === 1440, 'target breakpoints');

assert(E.getMinWorkspaceWidth() >= 400, 'min workspace width defined');

// No duplicate docking system
assert(!js.includes('docking'), 'no docking system');
assert(!js.includes('split-pane'), 'no split-pane framework');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
