#!/usr/bin/env node
/**
 * Phase UI-4 — Content browser + contextual inspector tests.
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

function makeEl(tag, doc) {
  const children = [];
  const el = {
    tagName: tag.toUpperCase(),
    id: '',
    className: '',
    classList: { add() {}, remove() {}, toggle() {} },
    style: {},
    dataset: {},
    innerHTML: '',
    hidden: false,
    open: false,
    _text: '',
    get textContent() { return this._text || children.map((c) => c.textContent || '').join(''); },
    set textContent(v) { this._text = String(v); },
    setAttribute() {},
    getAttribute() { return null; },
    insertBefore(child) { this.appendChild(child); },
    appendChild(child) {
      if (!child) return child;
      children.push(child);
      if (child.id) doc._els[child.id] = child;
      return child;
    },
    addEventListener() {},
    querySelector(sel) {
      if (sel.startsWith('#') && doc._els[sel.slice(1)]) return doc._els[sel.slice(1)];
      return children.find((c) => c.className && sel.includes(c.className.split(' ')[0])) || null;
    },
    querySelectorAll: () => []
  };
  return el;
}

const ctx = {
  console: { log() {}, info() {}, warn() {}, error() {} },
  _els: {},
  document: null
};

ctx.document = {
  readyState: 'complete',
  head: { appendChild() {} },
  body: { classList: { add() {}, remove() {}, toggle() {} } },
  addEventListener() {},
  getElementById(id) {
    if (id === 'context-sidebar') return ctx._sidebar;
    return ctx._els[id] || null;
  },
  querySelector(sel) {
    if (sel === '#context-sidebar') return ctx._sidebar;
    if (sel === '#scene-editor .scene-builder') return ctx._builder;
    if (sel === '.editor-inspector-head') return ctx._inspHead;
    return null;
  },
  createElement(tag) {
    if (tag === 'style') return { id: '', textContent: '' };
    return makeEl(tag, ctx);
  },
  createDocumentFragment() {
    const children = [];
    return {
      nodeType: 11,
      appendChild(c) { children.push(c); },
      get textContent() { return children.map((c) => c.textContent || '').join(''); }
    };
  }
};

ctx._sidebar = makeEl('aside', ctx);
ctx._sidebar.id = 'context-sidebar';
ctx._els['context-sidebar'] = ctx._sidebar;
ctx._builder = { classList: { add() {}, remove() {}, toggle() {} } };
ctx._inspHead = { insertBefore() {}, querySelector: () => ({ addEventListener() {} }) };
ctx.globalThis = ctx;
ctx.window = ctx;

let inspectorSelections = [];
let markDirtyCalls = 0;

ctx.Editor = {
  data: {
    scenes: {
      hub: {
        id: 'hub', location: 'Hub', text: 'Hello',
        choices: [{ text: 'Go', to: 'start' }],
        visual: { mode: 'overlay', nodes: [{ id: 'n1', kind: 'hotspot', transform: { x: 0.1, y: 0.2, w: 0.1, h: 0.1, z: 0 } }] }
      },
      start: { id: 'start', location: 'Start', text: 'Hi', choices: [] }
    },
    ui: { screens: { hud: { id: 'hud', nodes: [{ id: 'btn1', kind: 'button', transform: { x: 0, y: 0, w: 0.2, h: 0.1 } }] } } }
  },
  currentScene: 'hub',
  currentTab: 'scenes',
  editorMode: 'writer',
  workspace: { open: [], activeId: 'scene:hub' },
  _uiSelectedScreen: 'hud',
  _visualSelectedNodeId: null,
  escapeHtml(s) { return String(s == null ? '' : s); },
  escapeAttr(s) { return String(s == null ? '' : s); },
  isWriterMode() { return true; },
  isEditorAdvancedMode() { return false; },
  getSceneContentKind(sc) {
    const s = typeof sc === 'string' ? this.data.scenes[sc] : sc;
    if (s?.visual?.nodes?.length && (s.text || s.choices?.length)) return 'mixed';
    if (s?.visual) return 'visual';
    return 'text';
  },
  getSceneViewMode() { return 'both'; },
  switchTab(t) { this.currentTab = t; },
  renderSceneList() {},
  renderSceneEditor() {},
  selectScene(id) { this.currentScene = id; },
  markDirty() { markDirtyCalls++; },
  visualUpdateNodeField() {},
  uiUpdateNodeField() {},
  updateChoice() {},
  renderContentBrowserPanel(opts) {
    return '<div class="content-browser-root"><ul class="content-browser-list">' +
      '<li><button data-cb-open="scene" data-cb-id="start">Start</button></li></ul></div>';
  },
  bindContentBrowserEvents() {},
  openContentEntity(type, id) {
    this._lastOpen = { type, id };
    if (type === 'scene' || type === 'visual_scene') this.selectScene(id);
  },
  Inspector: {
    selection: null,
    registry: new Map(),
    register(type, def) { this.registry.set(type, def); },
    select(sel) {
      this.selection = sel;
      inspectorSelections.push(sel);
    },
    render() {}
  }
};

ctx.EditorContentIndex = {
  CATEGORIES: [{ id: 'scenes', labelRu: 'Сцены' }, { id: 'items', labelRu: 'Предметы' }],
  getVisibleCategories: () => ctx.EditorContentIndex.CATEGORIES,
  buildContentBrowserIndex: () => [{ categoryId: 'scenes', categoryLabel: 'Сцены', type: 'scene', id: 'start', title: 'Start' }],
  filterContentEntries: (entries) => entries,
  collectProjectContentStats: () => ({ scenes: 2 })
};

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-hooks.js'), 'utf8'), ctx);
ctx.Editor.hooks.register('test', {
  selectScene: ctx.Editor.selectScene,
  switchTab: ctx.Editor.switchTab,
  renderSceneEditor: ctx.Editor.renderSceneEditor,
  visualSelectNode: function (id) {
    ctx.Editor._visualSelectedNodeId = id;
  },
  uiSelectNode: function (id) {
    ctx.Editor._uiSelectedNode = id;
  }
}, { force: true });

vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-context-ui.js'), 'utf8'), ctx);

const E = ctx.Editor;

// Workspace UI state not in project data
assert(E.workspace.ui != null, 'workspace.ui session state exists');
assert(E.data.workspace === undefined, 'no workspace in project data');

// Content browser sync for items tab
E.syncContextSidebar('items');
const browser = ctx.document.getElementById('context-browser-mount');
assert(browser != null, 'context browser mount created');
assert(browser.hidden === false, 'browser visible on items tab');

// Scenes tab shows scenes pane
E.syncContextSidebar('scenes');
const scenesPane = ctx.document.getElementById('context-scenes-pane');
assert(scenesPane && scenesPane.hidden === false, 'scenes pane on scenes tab');

// Full-width tabs hide the content sidebar (graph, world)
E.syncContextSidebar('graph');
assert(browser.hidden === true, 'browser hidden on graph tab');
assert(scenesPane.hidden === true, 'scenes pane hidden on graph tab');
E.syncContextSidebar('world');
assert(browser.hidden === true, 'browser hidden on world tab');

// Inspector registrations
assert(E.Inspector.registry.has('visual_node'), 'visual_node inspector registered');
assert(E.Inspector.registry.has('ui_node'), 'ui_node inspector registered');
assert(E.Inspector.registry.has('choice'), 'choice inspector registered');

// Visual selection updates inspector
inspectorSelections = [];
E.visualSelectNode('n1');
assert(inspectorSelections.length >= 1, 'visualSelectNode triggers inspector');
assert(inspectorSelections[inspectorSelections.length - 1].type === 'visual_node', 'visual_node selection type');

// UI selection updates inspector
inspectorSelections = [];
E.uiSelectNode('btn1');
assert(inspectorSelections.some((s) => s.type === 'ui_node'), 'ui_node selection');

// Tab switch does not mark dirty
markDirtyCalls = 0;
E.selectScene('start');
assert(markDirtyCalls === 0, 'selectScene does not markDirty');

// Collapse state session only
E.workspace.ui.inspectorCollapsed = true;
E.workspace.ui.inspectorSections = { transform: false };
assert(JSON.stringify(E.data).indexOf('inspectorCollapsed') < 0, 'collapse not in project JSON');

// Scene authoring panel disabled
assert(E.shouldShowSceneAuthoringPanel() === false, 'scene authoring panel disabled');

// Compact scene inspector hint (no full text duplicate)
const sceneInsp = E.Inspector.registry.get('scene');
const frag = sceneInsp.render({
  id: 'hub',
  data: E.data,
  editor: E
});
const text = frag.textContent || '';
assert(text.includes('документе') || text.includes('Выборов'), 'compact scene inspector');

// Writer mode layout class
E.applyContextLayoutClasses();
assert(true, 'applyContextLayoutClasses runs');

// openContentEntity routes through handlers
E.openContentEntity('scene', 'start');
assert(E._lastOpen.type === 'scene' && E._lastOpen.id === 'start', 'openContentEntity scene');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
