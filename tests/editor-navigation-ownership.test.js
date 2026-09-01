'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const vm = require('vm');

let passed = 0, failed = 0;
function assert(c, m) {
  if (c) { passed++; console.log('  ✓', m); }
  else { failed++; console.error('  ✗', m); }
}

// Static: navigation must not claim switchTab/showDashboard
const nav = fs.readFileSync(path.join(root, 'js/editor/editor-navigation.js'), 'utf8');
assert(!/methods\.switchTab\s*=/.test(nav), 'navigation does not assign methods.switchTab');
assert(!/methods\.showDashboard\s*=/.test(nav), 'navigation does not assign methods.showDashboard');
assert(!/Editor\.switchTab\s*=/.test(nav), 'navigation does not assign Editor.switchTab');
assert(!/Editor\.showDashboard\s*=/.test(nav), 'navigation does not assign Editor.showDashboard');

const save = fs.readFileSync(path.join(root, 'js/editor/editor-save.js'), 'utf8');
assert(!/tryClaim\('loadData'\)/.test(save) && !/methods\.loadData\s*=/.test(save), 'save does not claim loadData');

const tabs = fs.readFileSync(path.join(root, 'js/editor/editor-core-tabs.js'), 'utf8');
assert(/register\(\s*['"]editor-core-tabs['"]/.test(tabs), 'core-tabs registers as owner');
assert(/force:\s*true/.test(tabs), 'core-tabs force updates _impl');

const dash = fs.readFileSync(path.join(root, 'js/editor-dashboard.js'), 'utf8');
assert(/register\(\s*['"]editor-dashboard['"]/.test(dash), 'dashboard registers showDashboard');
assert(/hooks\.replace\(\s*['"]switchTab['"]/.test(dash), 'dashboard extends switchTab via replace');

// Behavioral: load hooks + core stubs + tabs + dashboard
const document = {
  querySelectorAll() { return []; },
  getElementById() { return { classList: { add() {}, remove() {} }, innerHTML: '' }; },
  addEventListener() {},
  createElement() { return { style: {}, classList: { add() {} } }; },
  body: { appendChild() {} },
  head: { appendChild() {} }
};
const ctx = {
  console: { log() {}, warn() {}, error() {}, debug() {}, info() {} },
  document, window: {}, localStorage: { getItem() { return null; }, setItem() {} },
  setTimeout, clearTimeout, Map, Set, Object, Array, String, Number, Error, JSON
};
ctx.window = ctx;
vm.createContext(ctx);

vm.runInContext(`
var Editor = {
  currentTab: 'scenes',
  data: { scenes: {} },
  switchTab(tab, event) {},
  showDashboard() { this.currentTab = 'dashboard'; },
  loadData() {},
  escapeHtml(s) { return String(s); },
  escapeAttr(s) { return String(s); }
};
`, ctx);

vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-hooks.js'), 'utf8'), ctx);

// Simulate core-tabs real switchTab + register
vm.runInContext(`
Editor.switchTab = function (tab, event) {
  this.currentTab = tab;
  this._lastSwitch = tab;
};
Editor.hooks.register('editor-core-tabs', {
  switchTab: Editor.switchTab
}, { force: true });

Editor.showDashboard = function () {
  this.currentTab = 'dashboard';
  this._dash = true;
};
Editor.hooks.register('editor-dashboard', {
  showDashboard: Editor.showDashboard
}, { force: true });

// dashboard replace
var prevSwitch = Editor.hooks.replace('switchTab', function (tab, event) {
  if (tab === 'dashboard') {
    this.showDashboard();
    return;
  }
  return typeof prevSwitch === 'function' ? prevSwitch.call(this, tab, event) : undefined;
}, 'editor-dashboard');
`, ctx);

const Editor = ctx.Editor;
let calls = 0;
const origImpl = Editor.hooks._impl || null;

// Count public calls
Editor.switchTab('scenes');
assert(Editor.currentTab === 'scenes', 'switchTab scenes works');
Editor.switchTab('quests');
assert(Editor.currentTab === 'quests', 'switchTab quests works');
Editor.switchTab('dashboard');
assert(Editor.currentTab === 'dashboard', 'dashboard intercept works');

assert(Editor.hooks.getOwner('switchTab') === 'editor-dashboard' || Editor.hooks.getOwner('switchTab') === 'editor-core-tabs',
  'single owner for switchTab: ' + Editor.hooks.getOwner('switchTab'));
assert(Editor.hooks.getOwner('showDashboard') === 'editor-dashboard',
  'showDashboard owner is editor-dashboard');

// navigation must not re-register as owner of switchTab
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-navigation.js'), 'utf8'), ctx);
assert(Editor.hooks.getOwner('switchTab') !== 'editor-navigation', 'navigation is not switchTab owner');
assert(Editor.hooks.getOwner('showDashboard') !== 'editor-navigation', 'navigation is not showDashboard owner');

// 1 call per click simulation
let n = 0;
const _after = [];
Editor.hooks.after('switchTab', function () { n++; });
n = 0;
Editor.switchTab('items');
assert(n === 1, '1 after-hook fire per switchTab call');
Editor.switchTab('npcs');
assert(n === 2, 'second click +1');

// Writer mode before-hook must not break switchTab (args are spread, not an array)
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-writer-mode.js'), 'utf8'), ctx);
vm.runInContext(`Editor.editorMode = 'writer';`, ctx);
Editor.switchTab('quests');
assert(Editor.currentTab === 'quests', 'writer mode allows switchTab to quests');
Editor.switchTab('json');
assert(Editor.currentTab === 'scenes', 'writer mode blocks hidden tab → scenes');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
