#!/usr/bin/env node
/**
 * Phase UI-7 — Unified Scene Workspace tests
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
const usw = fs.readFileSync(path.join(root, 'js/editor/editor-scene-workspace.js'), 'utf8');

assert(html.includes('editor-scene-workspace.js'), 'script wired in editor.html');
assert(usw.includes('openSceneWorkspace'), 'openSceneWorkspace API');
assert(!usw.includes('SceneManager'), 'no SceneManager dependency');
assert(!/require\s*\(\s*['"].*engine/.test(usw), 'no runtime engine require');

// --- Runtime ---
let markDirtyCalls = 0;
let historyCalls = 0;

function makeEl(tag) {
  const el = {
    tagName: tag.toUpperCase(),
    id: '',
    className: '',
    innerHTML: '',
    hidden: false,
    style: {},
    dataset: {},
    appendChild(c) {
      if (c && c.id) ctx._els[c.id] = c;
      return c;
    },
    setAttribute() {},
    addEventListener() {},
    querySelector(sel) {
      if (sel === '.scene-builder') return ctx._builder;
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
    return null;
  },
  querySelectorAll: () => [],
  createElement(tag) {
    const el = makeEl(tag);
    if (tag === 'div' || tag === 'aside') {
      const origAppend = el.appendChild.bind(el);
      el.appendChild = (c) => {
        if (c && c.id) ctx._els[c.id] = c;
        return origAppend(c);
      };
    }
    return el;
  }
};
ctx.globalThis = ctx;
ctx.window = ctx;

ctx.Editor = {
  currentTab: 'scenes',
  currentScene: null,
  data: {
    scenes: {
      hub: {
        id: 'hub', location: 'Village', text: 'Hello',
        choices: [{ text: 'Go', to: 'start' }],
        visual: { mode: 'overlay', nodes: [{ id: 'n1', kind: 'hotspot' }] }
      },
      start: { id: 'start', location: 'Start', text: 'Hi', choices: [] }
    },
    ui: { screens: { hud: { id: 'hud', name: 'HUD' } } }
  },
  workspace: { open: [], activeId: null },
  switchTab(t) { this.currentTab = t; },
  selectScene(id) { this.currentScene = id; },
  openSceneDocument(id) {
    this.currentScene = id;
    this.workspace.activeId = 'scene:' + id;
    if (!this.workspace.open.includes('scene:' + id)) this.workspace.open.push('scene:' + id);
  },
  renderSceneEditor() {
    const mount = ctx.document.getElementById('usw-canvas-mount') || ctx.document.getElementById('scene-editor');
    if (!mount) return;
    const builder = makeEl('div');
    builder.className = 'scene-builder';
    builder.innerHTML = 'x';
    const core = makeEl('div');
    core.className = 'scene-builder-core';
    builder.appendChild(core);
    const choices = makeEl('div');
    choices.className = 'scene-module-card';
    choices.dataset.module = 'choices';
    const cs = makeEl('div');
    cs.className = 'choices-section';
    choices.appendChild(cs);
    builder.appendChild(choices);
    const visual = makeEl('div');
    visual.id = 'visual-scene-editor-panel';
    builder.appendChild(visual);
    mount.innerHTML = '';
    mount.appendChild(builder);
    ctx._builder = builder;
  },
  renderVisualScenePanel() { this._visualRendered = true; },
  markDirty() { markDirtyCalls++; },
  isEditorAdvancedMode() { return false; },
  getSceneContentKind(s) { return 'mixed'; },
  hooks: null
};

// scene-editor root
const sceneEditor = makeEl('div');
sceneEditor.id = 'scene-editor';
ctx._els['scene-editor'] = sceneEditor;

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-hooks.js'), 'utf8'), ctx);
ctx.Editor.hooks.register('test', {
  renderSceneEditor: ctx.Editor.renderSceneEditor,
  openSceneDocument: ctx.Editor.openSceneDocument,
  selectScene: ctx.Editor.selectScene,
  switchTab: ctx.Editor.switchTab
}, { force: true });

vm.runInContext(usw, ctx);
const E = ctx.Editor;

assert(typeof E.openSceneWorkspace === 'function', 'API exported');
assert(E.openSceneWorkspace('hub') === true, 'openSceneWorkspace returns true');
assert(E.currentScene === 'hub', 'currentScene set');
assert(E.isUnifiedSceneWorkspaceActive(), 'unified workspace active');
assert(ctx.document.getElementById('usw-root') != null, 'shell created');
assert(ctx.document.getElementById('usw-outline') != null, 'outline created');

markDirtyCalls = 0;
E.setSceneWorkspaceSection('choices');
assert(E.getSceneWorkspaceSection() === 'choices', 'section selection');
assert(markDirtyCalls === 0, 'section nav does not markDirty');

E.setSceneWorkspaceSection('visual');
assert(E._visualRendered === true, 'visual host calls renderVisualScenePanel');

const sections = E.getSceneWorkspaceSections();
assert(sections.some((s) => s.id === 'choices'), 'choices section defined');
assert(sections.some((s) => s.id === 'visual'), 'visual section defined');

E.setSceneWorkspaceSection('overview');
assert(ctx.document.getElementById('usw-panel-overview') != null, 'overview panel');

E.setSceneWorkspaceSection('game_ui');
const gameUiPanel = ctx.document.getElementById('usw-panel-game_ui');
assert(gameUiPanel != null, 'game UI panel exists');
assert(E.getSceneWorkspaceSection() === 'game_ui', 'game UI section selected');

E.setSceneWorkspaceSection('choices');
assert(E.getSceneWorkspaceSection() === 'choices', 'choices section selected');
assert(ctx._builder != null, 'scene builder mounted for choices');

E.openSceneWorkspace('start');
assert(E.currentScene === 'start', 'switch scene in workspace');

// Empty scene — choices empty state path
E.setSceneWorkspaceSection('choices');
const emptyChoices = ctx._builder && ctx._builder.querySelector('.usw-inline-empty');
// start has no choices module card — may show inline empty or hide module
assert(E.getSceneWorkspaceSection() === 'choices', 'empty scene choices section navigable');

historyCalls = 0;
if (ctx.EditorHistory) historyCalls++;
E.setSceneWorkspaceSection('content');
E.setSceneWorkspaceSection('visual');
assert(markDirtyCalls === 0, 'multi-section nav still no markDirty');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
