#!/usr/bin/env node
/**
 * Phase UI-13 — Scene Workspace polish tests
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

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const html = read('editor.html');
assert(html.includes('editor-scene-workspace-polish.js'), 'polish script wired');

function makeEl(tag) {
  const el = {
    tagName: tag.toUpperCase(),
    id: '',
    className: '',
    innerHTML: '',
    hidden: false,
    style: {},
    dataset: {},
    children: [],
    firstChild: null,
    appendChild(c) {
      if (c) c.parentElement = this;
      this.children.push(c);
      this.firstChild = this.children[0] || null;
      if (c && c.id) ctx._els[c.id] = c;
      return c;
    },
    insertBefore(c, ref) {
      if (c) c.parentElement = this;
      const i = this.children.indexOf(ref);
      if (i >= 0) this.children.splice(i, 0, c);
      else this.children.unshift(c);
      this.firstChild = this.children[0] || null;
      if (c && c.id) ctx._els[c.id] = c;
      return c;
    },
    setAttribute() {},
    addEventListener() {},
    querySelector(sel) {
      if (sel === '.scene-builder') return ctx._builder;
      if (sel === '.usw-canvas') return ctx._els['usw-canvas'] || null;
      return null;
    },
    querySelectorAll: () => []
  };
  return el;
}

const ctx = {
  console: { log() {}, info() {}, warn() {}, error() {} },
  _els: {},
  _builder: null,
  document: null
};

ctx.document = {
  readyState: 'complete',
  head: { appendChild() {} },
  body: { classList: { add() {}, remove() {}, toggle() {} }, dataset: {} },
  getElementById(id) { return ctx._els[id] || null; },
  querySelector(sel) {
    if (sel === '#scene-editor .scene-builder') return ctx._builder;
    if (sel === '.usw-canvas') {
      const mount = ctx._els['usw-canvas-mount'];
      return mount?.parentElement || null;
    }
    return null;
  },
  querySelectorAll: () => [],
  createElement(tag) {
    const el = makeEl(tag);
    return el;
  }
};
ctx.globalThis = ctx;
ctx.window = ctx;

let inspectorSelection = null;
let visualNodeId = null;

ctx.Editor = {
  currentTab: 'scenes',
  currentScene: null,
  data: {
    scenes: {
      village: {
        id: 'village', location: 'Village', text: 'Hi',
        choices: [{ text: 'Go', to: 'start' }],
        visual: { mode: 'overlay', nodes: [{ id: 'door', kind: 'hotspot', label: 'Door' }] }
      },
      start: { id: 'start', location: 'Start', text: '', choices: [] }
    },
    ui: { screens: { hud: { name: 'HUD' } } }
  },
  workspace: { open: [], activeId: null },
  projectStatus: { isDirty() { return false; } },
  hooks: null,
  switchTab(t) { this.currentTab = t; },
  selectScene(id) { this.currentScene = id; },
  openSceneDocument(id) {
    this.currentScene = id;
    this.workspace.activeId = 'scene:' + id;
  },
  renderSceneEditor() {
    const mount = ctx.document.getElementById('usw-canvas-mount');
    if (!mount) return;
    const builder = makeEl('div');
    builder.className = 'scene-builder';
    const core = makeEl('div');
    core.className = 'scene-builder-core';
    builder.appendChild(core);
    const choices = makeEl('div');
    choices.className = 'scene-module-card';
    choices.dataset = { module: 'choices' };
    builder.appendChild(choices);
    const visual = makeEl('div');
    visual.id = 'visual-scene-editor-panel';
    builder.appendChild(visual);
    mount.innerHTML = '';
    mount.appendChild(builder);
    ctx._builder = builder;
  },
  renderVisualScenePanel() { this._visualRendered = true; },
  visualSelectNode(id) {
    visualNodeId = id;
    this._visualSelectedNodeId = id;
    if (this.hooks?.emit) this.hooks.emit('after', 'visualSelectNode', [id]);
  },
  addChoice() {
    const sc = this.data.scenes[this.currentScene];
    if (!sc.choices) sc.choices = [];
    sc.choices.push({ text: 'New', to: '' });
  },
  visualAddNode() {
    const sc = this.data.scenes[this.currentScene];
    if (!sc.visual) sc.visual = { mode: 'overlay', nodes: [] };
    sc.visual.nodes.push({ id: 'n' + sc.visual.nodes.length, kind: 'hotspot' });
    return sc.visual.nodes[sc.visual.nodes.length - 1].id;
  },
  markDirty() {},
  isEditorAdvancedMode() { return false; },
  getSceneContentKind() { return 'mixed'; },
  Inspector: {
    selection: null,
    select(sel) {
      inspectorSelection = sel;
      this.selection = sel;
      if (ctx.Editor.Inspector._usw13SelectWrapped) { /* wrapped in polish */ }
    },
    clear() {
      inspectorSelection = null;
      this.selection = null;
    },
    render() {}
  }
};

ctx._els['scene-editor'] = makeEl('div');
ctx._els['scene-editor'].id = 'scene-editor';

vm.createContext(ctx);
vm.runInContext(read('js/editor/editor-hooks.js'), ctx);

ctx.Editor.hooks.register('test', {
  renderSceneEditor: ctx.Editor.renderSceneEditor,
  openSceneDocument: ctx.Editor.openSceneDocument,
  selectScene: ctx.Editor.selectScene,
  switchTab: ctx.Editor.switchTab,
  renderUnifiedSceneWorkspace() {}
}, { force: true });

vm.runInContext(read('js/editor/editor-scene-workspace.js'), ctx);
vm.runInContext(read('js/editor/editor-scene-workspace-polish.js'), ctx);
vm.runInContext(read('js/editor/editor-ui-integration.js'), ctx);

const E = ctx.Editor;

// 1. Open scene with section option
assert(E.openSceneWorkspace('village', { section: 'visual' }) === true, 'opens scene with section');
assert(E.currentScene === 'village', 'correct scene');
assert(E.getSceneWorkspaceSection() === 'visual', 'section visual');

// 2. Legacy redirect
E.setSceneWorkspaceSection('content');
E.openVisualSceneEditor('village');
assert(E.getSceneWorkspaceSection() === 'visual', 'legacy openVisualSceneEditor → visual');

// 3. Selection persistence
E.visualSelectNode('door');
E.Inspector.select({ type: 'visual_node', id: 'door', meta: { sceneId: 'village' } });
const sel = E.getSceneWorkspaceSelection();
assert(sel && sel.nodeId === 'door', 'selection stored');

E.setSceneWorkspaceSection('conditions');
E.setSceneWorkspaceSection('visual');
assert(visualNodeId === 'door', 'visual selection restored after section nav');

// 4. Scene switch clears selection
E.openSceneWorkspace('start');
assert(E.getSceneWorkspaceSelection() === null, 'scene switch clears selection');

// 5. Invalid selection cleared
E.openSceneWorkspace('village', { section: 'visual' });
E.setSceneWorkspaceSelection({ type: 'visual_node', sceneId: 'village', nodeId: 'gone', id: 'gone' });
E.setSceneWorkspaceSection('visual');
assert(E.getSceneWorkspaceSelection() === null, 'invalid selection cleared');

// 6. Choice selection
E.openSceneWorkspace('village', { section: 'choices' });
E.Inspector.select({ type: 'choice', id: '0', meta: { sceneId: 'village', choiceIndex: 0 } });
const csel = E.getSceneWorkspaceSelection();
assert(csel && csel.choiceIndex === 0, 'choice selection stored');
E.setSceneWorkspaceSection('conditions');
E.setSceneWorkspaceSection('choices');
assert(inspectorSelection?.type === 'choice', 'choice selection restored');

// 7. Chrome elements
assert(ctx.document.getElementById('usw-breadcrumb') != null, 'breadcrumb exists');
assert(ctx.document.getElementById('usw-section-header-host') != null, 'section header host exists');

// 8. Empty state API
E.openSceneWorkspace('start', { section: 'choices' });
assert(E.getSceneWorkspaceSection() === 'choices', 'empty scene choices navigable');

// 9. Runtime audit
const polish = read('js/editor/editor-scene-workspace-polish.js');
assert(!polish.includes('SceneManager'), 'no SceneManager in polish');
assert(!/QuestRuntime/.test(polish), 'no QuestRuntime in polish');

// 10. openSceneWorkspace opts backward compat
assert(E.openSceneWorkspace('village') === true, 'string-only open still works');
assert(E.getSceneWorkspaceSection() === 'overview', 'defaults to overview');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
