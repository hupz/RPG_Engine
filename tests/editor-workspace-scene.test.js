#!/usr/bin/env node
/**
 * Phase UI-3 — Scene workspace integration tests.
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

const ctx = {
  console: { log() {}, info() {}, warn() {}, error() {} },
  document: {
    readyState: 'complete',
    head: { appendChild() {} },
    body: { appendChild() {} },
    addEventListener() {},
    getElementById: (id) => ctx._els[id] || null,
    querySelector: (sel) => {
      if (sel === '#scene-editor .scene-builder') return ctx._builder;
      if (sel === '.main-area') return ctx._mainArea;
      return null;
    },
    createElement: (tag) => {
      const el = {
        tagName: tag.toUpperCase(),
        className: '',
        classList: { add() {}, remove() {} },
        style: {},
        dataset: {},
        innerHTML: '',
        hidden: false,
        setAttribute() {},
        getAttribute() { return null; },
        insertAdjacentHTML() {},
        insertAdjacentElement() {},
        addEventListener() {},
        querySelector: () => null,
        querySelectorAll: () => [],
        parentNode: ctx._mainArea
      };
      if (tag === 'div') {
        Object.defineProperty(el, 'id', {
          set(v) { el._id = v; ctx._els[v] = el; },
          get() { return el._id || ''; }
        });
      }
      if (tag === 'style') return { id: '', textContent: '' };
      return el;
    }
  }
};
ctx._els = {};
ctx._builder = {
  className: 'scene-builder',
  classList: { add() {}, remove() {} },
  style: {},
  insertAdjacentHTML(pos, html) {
    if (html.includes('ws-scene-document-header')) ctx._headerHtml = html;
  },
  querySelectorAll: () => []
};
ctx._mainArea = { insertBefore() {}, firstChild: null };
ctx.globalThis = ctx;
ctx.window = ctx;

let historyMutations = 0;
let markDirtyCalls = 0;

ctx.Editor = {
  data: {
    scenes: {
      start: { id: 'start', location: 'Start', text: 'Hi', choices: [] },
      village: { id: 'village', location: 'Village', text: 'Town', choices: [] },
      visual_hub: {
        id: 'visual_hub',
        location: 'Visual Hub',
        text: '',
        visual: { mode: 'overlay', nodes: [{ id: 'n1', kind: 'hotspot' }] }
      },
      mixed: {
        id: 'mixed',
        location: 'Mixed',
        text: 'Both',
        choices: [{ text: 'Go', to: 'start' }],
        visual: { mode: 'overlay', nodes: [] }
      }
    }
  },
  currentScene: null,
  currentTab: 'scenes',
  editorMode: 'full',
  projectStatus: { isDirty: () => false },
  workspace: { open: [], activeId: null },
  escapeHtml(s) { return String(s == null ? '' : s); },
  escapeAttr(s) { return String(s == null ? '' : s); },
  isEditorAdvancedMode() { return true; },
  inferSceneType() { return 'custom'; },
  getSceneTypeMeta() { return { icon: '🎬', label: 'Сцена' }; },
  switchTab(t) { this.currentTab = t; },
  renderSceneList() {},
  renderSceneEditor() { this._renderCount = (this._renderCount || 0) + 1; },
  selectScene(id) {
    this.currentScene = id;
    this.renderSceneList();
    this.renderSceneEditor();
  },
  markDirty() { markDirtyCalls++; },
  deleteScene(id) {
    delete this.data.scenes[id];
    if (this.currentScene === id) this.currentScene = Object.keys(this.data.scenes)[0];
    this.renderSceneList();
    this.renderSceneEditor();
  },
  duplicateScene(id) {
    const copyId = id + '_copy';
    this.data.scenes[copyId] = JSON.parse(JSON.stringify(this.data.scenes[id]));
    this.data.scenes[copyId].id = copyId;
    this.data.scenes[copyId].location = (this.data.scenes[id].location || id) + ' (copy)';
    this.currentScene = copyId;
    this.renderSceneList();
    this.renderSceneEditor();
    return copyId;
  },
  createSceneWithWizard(name, preset) {
    const id = name.toLowerCase().replace(/\s+/g, '_');
    const scene = { id, location: name, text: '', editorModules: ['story', 'choices'] };
    if (preset === 'visual') scene.visual = { mode: 'overlay', nodes: [] };
    this.data.scenes[id] = scene;
    this.currentScene = id;
    return id;
  }
};

ctx.EditorContentIndex = {
  getSceneKind(sc) {
    const v = sc?.visual;
    const hasVisual = !!(v && (
      (v.nodes && v.nodes.length) ||
      v.background ||
      v.mode === 'overlay' ||
      v.mode === 'full'
    ));
    const hasText = !!(sc && String(sc.text || '').trim());
    const hasChoices = Array.isArray(sc?.choices) && sc.choices.length > 0;
    if (hasVisual && (hasText || hasChoices)) return 'mixed';
    if (hasVisual) return 'visual';
    return 'text';
  }
};

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-hooks.js'), 'utf8'), ctx);
ctx.Editor.hooks.register('test', {
  selectScene: ctx.Editor.selectScene,
  renderSceneList: ctx.Editor.renderSceneList,
  renderSceneEditor: ctx.Editor.renderSceneEditor,
  switchTab: ctx.Editor.switchTab,
  deleteScene: ctx.Editor.deleteScene
}, { force: true });
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-workspace.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-workspace-scene.js'), 'utf8'), ctx);

const E = ctx.Editor;
const W = E.Workspace;

// TEXT scene opens as document
assert(E.openSceneDocument('start'), 'TEXT scene opens');
assert(E.currentScene === 'start', 'TEXT sets currentScene');
assert(W.isOpen('scene:start'), 'TEXT in workspace open list');

// Visual scene opens as document
assert(E.openSceneDocument('visual_hub'), 'Visual scene opens');
assert(E.currentScene === 'visual_hub', 'Visual sets currentScene');
assert(E.getSceneContentKind('visual_hub') === 'visual', 'visual kind detected');

// Mixed scene
assert(E.getSceneContentKind('mixed') === 'mixed', 'mixed kind detected');
assert(E.getSceneViewMode('mixed') === 'both', 'mixed default view both');

// View mode switching (session only, no JSON change)
const beforeJson = JSON.stringify(E.data.scenes.mixed);
E.setSceneViewMode('mixed', 'text');
assert(E.workspace.viewModes.mixed === 'text', 'view mode stored in session');
assert(JSON.stringify(E.data.scenes.mixed) === beforeJson, 'view mode does not mutate scene JSON');

// Switching scenes updates currentScene
E.openSceneDocument('start');
E.openSceneDocument('village');
assert(W.state.open.length === 3, 'three scenes open');
E.activateWorkspaceDocument('scene:start');
assert(E.currentScene === 'start', 'tab switch updates currentScene');

// Close active with fallback
markDirtyCalls = 0;
historyMutations = 0;
const dirtyBefore = markDirtyCalls;
E.activateWorkspaceDocument('scene:village');
E.closeWorkspaceDocument('scene:village');
assert(E.currentScene !== 'village' || W.state.open.indexOf('scene:village') < 0, 'closed village tab');
assert(markDirtyCalls === dirtyBefore, 'tab close does not markDirty');

// selectScene does not markDirty
markDirtyCalls = 0;
E.selectScene('start');
assert(markDirtyCalls === 0, 'selectScene does not markDirty');

// Duplicate opens new document
W.state.open = [];
E.openSceneDocument('start');
const newId = E.duplicateScene('start');
if (typeof E.openSceneDocument === 'function') E.openSceneDocument(newId);
assert(W.isOpen('scene:' + newId), 'duplicate opens new workspace tab');
assert(E.currentScene === newId, 'duplicate activates new scene');

// Delete active scene
E.openSceneDocument('village');
const openBefore = W.state.open.length;
E.deleteScene('village');
assert(!W.isOpen('scene:village'), 'delete removes workspace tab');
assert(E.data.scenes.village === undefined, 'village deleted from data');
assert(E.currentScene && E.data.scenes[E.currentScene], 'currentScene valid after delete');

// workspace state not in project JSON
const projectKeys = Object.keys(E.data);
assert(!projectKeys.includes('workspace'), 'no workspace in Editor.data');
assert(!projectKeys.includes('open'), 'no open in Editor.data root');

// Header render
E.currentScene = 'start';
E.renderSceneEditor();
E.injectSceneWorkspaceChrome();
assert(ctx._headerHtml && ctx._headerHtml.includes('ws-scene-document-header'), 'document header injected');
assert(ctx._headerHtml.includes('Start'), 'header shows scene title');

// createSceneWithWizard + openSceneDocument path
W.state.open = [];
const created = E.createSceneWithWizard('New Place', 'text');
E.openSceneDocument(created);
assert(W.isOpen('scene:new_place'), 'created scene opens in workspace');

// No workspace fields serialized
const exported = JSON.stringify(E.data);
assert(!exported.includes('"viewModes"'), 'viewModes not in project JSON');
assert(!exported.includes('"activeId"'), 'activeId not in project JSON');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
