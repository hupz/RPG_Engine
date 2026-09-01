#!/usr/bin/env node
/**
 * Phase UI-2 — Editor workspace: open/activate/close documents, currentScene sync.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
function assert(c, m) {
  if (c) {
    passed++;
    console.log('  ✓', m);
  } else {
    failed++;
    console.error('  ✗', m);
  }
}

const ctx = {
  console: { log() {}, info() {}, warn() {}, error() {} },
  document: {
    readyState: 'complete',
    head: { appendChild() {} },
    body: { appendChild() {} },
    addEventListener() {},
    getElementById: (id) => {
      if (id === 'editor-workspace-tabs') return ctx._wsBar;
      if (id === 'editor-workspace-styles') return {};
      return null;
    },
    querySelector: (sel) => {
      if (sel === '.main-area') return ctx._mainArea;
      return null;
    },
    createElement: (tag) => {
      const el = {
        tagName: tag.toUpperCase(),
        id: '',
        className: '',
        hidden: false,
        dataset: {},
        style: {},
        innerHTML: '',
        setAttribute() {},
        getAttribute(k) { return k === 'data-ws-doc' ? null : null; },
        insertAdjacentElement() {},
        addEventListener() {},
        parentNode: ctx._mainArea
      };
      if (tag === 'div') {
        Object.defineProperty(el, 'id', {
          set(v) { el._id = v; if (v === 'editor-workspace-tabs') ctx._wsBar = el; },
          get() { return el._id || ''; }
        });
        return el;
      }
      if (tag === 'style') return { id: '', textContent: '' };
      return el;
    }
  }
};
ctx._mainArea = { insertBefore() {}, firstChild: null };
ctx._wsBar = null;
ctx.globalThis = ctx;
ctx.window = ctx;

let selectSceneCalls = 0;
let renderEditorCalls = 0;
let currentTab = 'dashboard';

ctx.Editor = {
  data: {
    scenes: {
      start: { id: 'start', location: 'Start', text: 'Hi' },
      village: { id: 'village', location: 'Village', text: 'Town' },
      tavern: { id: 'tavern', location: 'Tavern', text: 'Drink' }
    }
  },
  currentScene: null,
  currentTab,
  projectStatus: {
    _dirty: false,
    isDirty() { return this._dirty; },
    markDirty() { this._dirty = true; }
  },
  escapeHtml(s) { return String(s == null ? '' : s); },
  escapeAttr(s) { return String(s == null ? '' : s); },
  switchTab(tab) {
    this.currentTab = tab;
    currentTab = tab;
  },
  renderSceneList() {},
  renderSceneEditor() { renderEditorCalls++; },
  selectScene(id) {
    selectSceneCalls++;
    this.currentScene = id;
    this.renderSceneList();
    this.renderSceneEditor();
  }
};

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-hooks.js'), 'utf8'), ctx);
ctx.Editor.hooks.register('test-core', {
  selectScene: ctx.Editor.selectScene,
  renderSceneList: ctx.Editor.renderSceneList,
  renderSceneEditor: ctx.Editor.renderSceneEditor,
  switchTab: ctx.Editor.switchTab,
  deleteScene: function (id) {
    delete this.data.scenes[id];
    if (this.currentScene === id) {
      this.currentScene = Object.keys(this.data.scenes)[0];
    }
  }
}, { force: true });

vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-workspace.js'), 'utf8'), ctx);

const W = ctx.Editor.Workspace;
const E = ctx.Editor;

// --- open document ---
selectSceneCalls = 0;
assert(E.openSceneDocument('start'), 'openSceneDocument(start) returns true');
assert(W.state.open.length === 1, 'one open doc after first open');
assert(W.state.activeId === 'scene:start', 'activeId is scene:start');
assert(E.currentScene === 'start', 'currentScene synced to start');
assert(W.state.open[0] === 'scene:start', 'open contains scene:start');

// --- duplicate open prevention ---
assert(E.openSceneDocument('village'), 'open village');
assert(W.state.open.length === 2, 'two open docs');
assert(E.openSceneDocument('start'), 're-open start');
assert(W.state.open.length === 2, 'no duplicate tab for start');
assert(W.state.activeId === 'scene:start', 're-open activates start');

// --- activate document ---
assert(E.activateWorkspaceDocument('scene:village'), 'activate village');
assert(W.state.activeId === 'scene:village', 'active is village');
assert(E.currentScene === 'village', 'currentScene is village');

// --- open third ---
assert(E.openSceneDocument('tavern'), 'open tavern');
assert(W.state.open.length === 3, 'three open docs');
assert(E.currentScene === 'tavern', 'currentScene tavern');

// --- close with fallback ---
assert(E.closeWorkspaceDocument('scene:tavern'), 'close tavern');
assert(W.state.open.length === 2, 'two docs after close');
assert(W.state.activeId === 'scene:village', 'fallback to village after close tavern');
assert(E.currentScene === 'village', 'currentScene village after close');

// --- close middle, fallback to previous ---
assert(E.activateWorkspaceDocument('scene:start'), 'activate start');
assert(E.closeWorkspaceDocument('scene:start'), 'close start');
assert(W.state.activeId === 'scene:village', 'fallback to village when closing start');

// --- selectScene compatibility ---
selectSceneCalls = 0;
E.selectScene('start');
assert(W.isOpen('scene:start'), 'selectScene opens workspace tab');
assert(W.state.activeId === 'scene:start', 'selectScene sets active');
assert(selectSceneCalls === 1, 'selectScene called once');

// --- deleteScene closes tab ---
E.openSceneDocument('tavern');
assert(W.isOpen('scene:tavern'), 'tavern open');
E.deleteScene('tavern');
assert(!W.isOpen('scene:tavern'), 'deleteScene removes workspace tab');
assert(!E.data.scenes.tavern, 'tavern deleted from data');

// --- dirty indicator uses projectStatus ---
E.projectStatus._dirty = true;
const html = W.renderTabs();
W.ensureChrome();
const bar = ctx._wsBar || ctx.document.getElementById('editor-workspace-tabs');
// renderTabs writes to ensureChrome bar
W.renderTabs();
const barEl = ctx.document.getElementById('editor-workspace-tabs');
// Re-get after ensureChrome creates it
const tabsHtml = W.state.open.map(() => '').join('');
W.renderTabs();
assert(
  typeof W._isDocDirty('scene:village') === 'boolean' && W._isDocDirty('scene:village') === true,
  'dirty when projectStatus dirty'
);

// --- invalid doc ---
assert(!E.openWorkspaceDocument('scene:missing'), 'reject missing scene');
assert(!E.openWorkspaceDocument('badformat'), 'reject bad doc id');

// --- registerDocumentType ---
let customActivated = null;
E.registerWorkspaceDocumentType('quest', {
  exists(id) { return id === 'q1'; },
  getTitle(id) { return 'Quest ' + id; },
  activate(id) { customActivated = id; }
});
assert(E.openWorkspaceDocument('quest:q1'), 'custom quest type opens');
assert(customActivated === 'q1', 'quest activate called');
assert(W.isOpen('quest:q1'), 'quest doc in open list');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
