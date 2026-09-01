#!/usr/bin/env node
/**
 * Phase UI-20 — Preview Flow tests
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
const indexHtml = read('index.html');
const epw = read('js/editor/editor-preview-workflow.js');
const session = read('js/editor-test-session.js');
const fromHere = read('js/editor/editor-test-from-here.js');
const keys = read('js/editor-test-keys.js');
const style = read('css/style.css');

assert(html.includes('editor-preview-workflow.js'), 'preview workflow wired');
assert(epw.includes('Play Current Scene'), 'unified preview menu current scene');
assert(epw.includes('Play From Project Start'), 'unified preview menu project start');
assert(epw.includes('openPreviewMenu'), 'openPreviewMenu API');
assert(epw.includes('normalizePreviewMode'), 'mode normalization API');
assert(epw.includes("mode === 'project'"), 'project mode alias to start');
assert(epw.includes('data-epw-global'), 'global preview entry');
assert(session.includes('EDITOR TEST MODE'), 'runtime test banner label');
assert(session.includes('Current Scene:'), 'runtime banner shows current scene');
assert(session.includes('Project:'), 'runtime banner shows project');
assert(session.includes('editor-test-exit-preview'), 'Exit Preview control');
assert(session.includes('editor-test-restart'), 'Restart control');
assert(session.includes('updateEditorTestBanner'), 'banner updates on scene change');
assert(fromHere.includes('projectTitle'), 'session stores project title');
assert(fromHere.includes('previewMode'), 'session stores preview mode');
assert(style.includes('.editor-test-banner'), 'runtime banner CSS');
assert(!epw.includes('SceneManager'), 'no new runtime');
assert(!epw.includes('QuestRuntime'), 'no quest runtime in preview flow module');

// Editor preview entry routes through existing test path
assert(epw.includes('buildTestSession'), 'uses buildTestSession');
assert(epw.includes('prepareEditorTestLaunch'), 'uses prepareEditorTestLaunch');
assert(epw.includes('editorTest=1'), 'uses isolated editor test URL');

const storage = {
  _data: {},
  getItem(k) { return this._data[k] || null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; }
};

let openedUrl = null;
let productionTouched = false;

const ctx = {
  console: { log() {}, info() {}, warn() {}, error() {} },
  sessionStorage: storage,
  localStorage: {
    _data: {},
    getItem(k) {
      if (k === 'melnitsa_game_data' || k === 'melnitsa_save') productionTouched = true;
      return this._data[k] || null;
    },
    setItem(k, v) {
      if (k === 'melnitsa_game_data' || k === 'melnitsa_save') productionTouched = true;
      this._data[k] = String(v);
    },
    removeItem(k) { delete this._data[k]; }
  },
  window: null,
  document: {
    readyState: 'complete',
    body: {
      dataset: {},
      classList: { add() {}, remove() {}, toggle() {} },
      appendChild() {},
      style: {}
    },
    head: { appendChild() {} },
    getElementById: () => null,
    querySelector(sel) {
      if (sel === '.header-buttons') return ctx._headerButtons;
      return null;
    },
    querySelectorAll: () => [],
    createElement() {
      return {
        id: '', className: '', dataset: {}, innerHTML: '',
        appendChild() {}, insertBefore() {}, addEventListener() {}
      };
    },
    addEventListener() {}
  },
  EditorTestKeys: null,
  ProjectValidator: null,
  _headerButtons: { querySelector: () => null, insertBefore() {}, appendChild() {} }
};

ctx.window = {
  open(url) { openedUrl = url; return {}; },
  location: { search: '' }
};
ctx.globalThis = ctx;
ctx.setTimeout = (fn) => { if (typeof fn === 'function') fn(); return 0; };

ctx.Editor = {
  data: {
    meta: { title: 'Demo RPG' },
    startScene: 'hub',
    scenes: {
      hub: { id: 'hub', location: 'Hub', text: 'Hi', choices: [] },
      intro: { id: 'intro', location: 'Intro', text: 'Start' }
    }
  },
  currentScene: 'intro',
  currentTab: 'scenes',
  workspace: { activeId: 'scene:intro', open: ['scene:intro'], sceneWs: { section: 'content' } },
  toast: { success() {}, warning() {}, error() {}, info() {} },
  hooks: null,
  escapeHtml(s) { return String(s); },
  isAdvancedMode() { return true; },
  isEditorAdvancedMode() { return true; },
  buildTestSession(opts) {
    return {
      mode: 'editor_test',
      sceneId: opts.sceneId,
      previewMode: opts.previewMode,
      projectTitle: opts.projectTitle,
      createdAt: Date.now()
    };
  },
  prepareEditorTestLaunch(session) {
    ctx.EditorTestKeys.writeTestData(ctx.Editor.data);
    ctx.EditorTestKeys.writeSession(session);
    return session;
  },
  validateProject() {
    return { valid: true, issues: [], summary: { errors: 0, warnings: 0 } };
  },
  getSceneWorkspaceSection() { return 'content'; },
  openSceneWorkspace(id) { this.currentScene = id; return true; },
  switchTab(t) { this.currentTab = t; },
  updateJSONPreview() {},
  openSceneDocument(id) { this.currentScene = id; }
};

vm.createContext(ctx);
vm.runInContext(read('js/editor/editor-hooks.js'), ctx);
vm.runInContext(keys, ctx);
ctx.EditorTestKeys = ctx.EditorTestKeys;
vm.runInContext(fromHere, ctx);
vm.runInContext(epw, ctx);

const E = ctx.Editor;

assert(typeof E.normalizePreviewMode === 'function', 'normalizePreviewMode exported');
assert(E.normalizePreviewMode('project') === 'start', 'project mode maps to start');
assert(E.normalizePreviewMode('current') === 'current', 'current mode preserved');

// Current scene uses existing test preparation path
openedUrl = null;
productionTouched = false;
ctx.localStorage._data = {};
storage._data = {};
const currentOk = E.previewScene({ mode: 'current' });
assert(currentOk === true, 'current scene preview launches');
assert(openedUrl && openedUrl.includes('editorTest=1'), 'current scene opens isolated runtime');
const currentSession = JSON.parse(storage._data['rpg_editor_test_session'] || '{}');
assert(currentSession.sceneId === 'intro', 'current scene uses selected scene');
assert(currentSession.projectTitle === 'Demo RPG', 'session includes project title');
assert(currentSession.previewMode === 'current', 'session stores preview mode');

// Project start uses startScene path
openedUrl = null;
ctx.localStorage._data = {};
storage._data = {};
E.previewScene({ mode: 'project' });
const startSession = JSON.parse(storage._data['rpg_editor_test_session'] || '{}');
assert(startSession.sceneId === 'hub', 'project start uses startScene');
assert(startSession.previewMode === 'start', 'project mode normalized to start');

// Isolation keys only
assert(ctx.localStorage._data['rpg_editor_test_data'], 'test data key written');
assert(storage._data['rpg_editor_test_session'], 'test session key written');
assert(!productionTouched, 'production cache not touched');

// testFromHere routes through unified preview flow
assert(epw.includes('testFromHereUnified'), 'testFromHere wrapped by preview workflow');
assert(epw.includes("Object.assign({ mode: 'current' }"), 'testFromHere defaults to current mode');

// Runtime banner content
const runtimeCtx = {
  console: { log() {}, warn() {}, error() {} },
  localStorage: mockStorage(),
  sessionStorage: mockStorage(),
  location: { search: '?editorTest=1', protocol: 'http:', href: 'http://x/index.html?editorTest=1' },
  setTimeout(fn) { if (typeof fn === 'function') fn(); return 0; },
  setInterval() { return 0; },
  document: {
    readyState: 'complete',
    addEventListener() {},
    createElement() {
      return {
        id: '', className: '', innerHTML: '', style: {},
        setAttribute() {},
        addEventListener() {}
      };
    },
    getElementById(id) {
      if (id === 'name-screen' || id === 'class-screen' || id === 'game-content' || id === 'start-screen') {
        return { classList: { add() {}, remove() {} } };
      }
      return runtimeCtx._banner || null;
    },
    body: { style: {}, appendChild(el) { runtimeCtx._banner = el; } }
  },
  GameEngine: {
    state: {},
    data: {
      meta: { title: 'Runtime Demo' },
      scenes: { hub: { location: 'Hub Town' } },
      classes: { fighter: { hp: 20 } }
    },
    escapeHtml(s) { return String(s); },
    showScene() {},
    updateUI() {},
    renderInv() {},
    getFirstStorySceneId() { return 'hub'; }
  }
};
runtimeCtx.globalThis = runtimeCtx;
runtimeCtx.window = runtimeCtx;
vm.createContext(runtimeCtx);
vm.runInContext(keys, runtimeCtx);
vm.runInContext(session, runtimeCtx);

runtimeCtx.GameEngine.applyEditorTestSession({
  mode: 'editor_test',
  sceneId: 'hub',
  projectTitle: 'Runtime Demo'
});
const banner = runtimeCtx._banner;
assert(banner && banner.innerHTML.includes('EDITOR TEST MODE'), 'banner rendered in runtime');
assert(banner.innerHTML.includes('Runtime Demo'), 'banner shows project');
assert(banner.innerHTML.includes('Hub Town'), 'banner shows scene label');
assert(banner.innerHTML.includes('Exit Preview'), 'banner has Exit Preview');

function mockStorage() {
  const data = {};
  return {
    getItem(k) { return data[k] || null; },
    setItem(k, v) { data[k] = String(v); },
    removeItem(k) { delete data[k]; }
  };
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
