#!/usr/bin/env node
/**
 * Regression: updateJSONPreview must not recurse (autosave + hooks)
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

const autosave = fs.readFileSync(path.join(root, 'js/editor/editor-autosave.js'), 'utf8');
assert(!autosave.includes('Editor[name] = wrapped'), 'autosave does not monkey-patch Editor methods');
assert(autosave.includes("Editor.hooks.after('updateJSONPreview'"), 'autosave uses hooks.after for updateJSONPreview');

const storage = { _data: {}, getItem(k) { return this._data[k] || null; }, setItem() {}, removeItem() {} };
const ctx = {
  console: { log() {}, info() {}, warn() {}, error() {} },
  localStorage: storage,
  document: {
    readyState: 'complete',
    head: { appendChild() {} },
    body: { appendChild() {}, contains: () => false },
    getElementById: () => null,
    querySelector: () => null,
    createElement: () => ({ style: {}, hidden: true, appendChild() {} }),
    addEventListener() {}
  },
  window: { addEventListener() {} },
  setTimeout(fn) { if (typeof fn === 'function') fn(); return 0; },
  clearTimeout() {},
  Editor: {
    data: { scenes: { a: { id: 'a' } }, quests: {} },
    updateJSONPreview() { this._jsonCalls = (this._jsonCalls || 0) + 1; },
    setProjectData(data) { this.data = data; },
    exportJSON() { return true; }
  }
};
ctx.globalThis = ctx;

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-hooks.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-autosave.js'), 'utf8'), ctx);
ctx.Editor.hooks.after('updateJSONPreview', function () {
  ctx.Editor._perfHook = (ctx.Editor._perfHook || 0) + 1;
}, 'editor-performance');

ctx.Editor.updateJSONPreview();
assert(ctx.Editor._jsonCalls === 1, 'updateJSONPreview runs once');
assert((ctx.Editor._perfHook || 0) === 1, 'after hooks run once');
assert(!ctx.Editor._recursed, 'no recursion flag');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
