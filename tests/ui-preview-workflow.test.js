#!/usr/bin/env node
/**
 * Phase UI-11 — Preview Workflow tests
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
const epw = fs.readFileSync(path.join(root, 'js/editor/editor-preview-workflow.js'), 'utf8');
const keys = fs.readFileSync(path.join(root, 'js/editor-test-keys.js'), 'utf8');

assert(html.includes('editor-preview-workflow.js'), 'script wired');
assert(epw.includes('previewScene'), 'previewScene API');
assert(!epw.includes('melnitsa_game_data'), 'no production cache writes in module');
assert(keys.includes('PRODUCTION_MELNITSA_CACHE_KEY'), 'isolation keys documented');

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
      appendChild() {}
    },
    head: { appendChild() {} },
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement() {
      return { id: '', hidden: true, innerHTML: '', style: {}, appendChild() {}, addEventListener() {} };
    },
    addEventListener() {}
  },
  EditorTestKeys: null,
  ProjectValidator: null
};

ctx.window = {
  open(url) { openedUrl = url; return {}; },
  location: { search: '' }
};
ctx.globalThis = ctx;
ctx.setTimeout = (fn) => { if (typeof fn === 'function') fn(); return 0; };

ctx.Editor = {
  data: {
    startScene: 'hub',
    scenes: {
      hub: { id: 'hub', location: 'Hub', text: 'Hi', choices: [{ text: 'Go', to: 'bad' }] },
      bad: { id: 'bad', text: 'Orphan' }
    }
  },
  currentScene: 'hub',
  currentTab: 'scenes',
  workspace: { activeId: 'scene:hub', open: ['scene:hub'], sceneWs: { section: 'content' } },
  toast: { success() {}, warning() {}, error() {}, info() {} },
  hooks: null,
  isAdvancedMode() { return !!ctx._advanced; },
  isEditorAdvancedMode() { return !!ctx._advanced; },
  buildTestSession(opts) {
    return { mode: 'editor_test', sceneId: opts.sceneId, createdAt: Date.now() };
  },
  prepareEditorTestLaunch(session) {
    ctx.EditorTestKeys.writeTestData(ctx.Editor.data);
    ctx.EditorTestKeys.writeSession(session);
    return session;
  },
  validateProject(data) {
    return {
      valid: false,
      issues: [
        { severity: 'error', message: 'Missing scene bad', sceneId: 'hub', path: 'scenes.hub.choices[0].to' },
        { severity: 'warning', message: 'Short text', sceneId: 'hub' }
      ],
      summary: { errors: 1, warnings: 1 }
    };
  },
  getSceneWorkspaceSection() { return 'content'; },
  openSceneWorkspace(id) { this.currentScene = id; return true; },
  switchTab(t) { this.currentTab = t; },
  updateJSONPreview() {},
  openSceneDocument(id) { this.currentScene = id; }
};

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-hooks.js'), 'utf8'), ctx);
vm.runInContext(keys, ctx);
ctx.EditorTestKeys = ctx.EditorTestKeys;
vm.runInContext(epw, ctx);

const E = ctx.Editor;

assert(typeof E.previewScene === 'function', 'previewScene exported');
assert(E.isPreviewWorkflowActive(), 'workflow flag active');

// Validation gate — errors block without force
openedUrl = null;
const blocked = E.previewScene({ mode: 'current', sceneId: 'hub' });
assert(blocked === false, 'error gate blocks launch');
assert(openedUrl === null, 'no window open on errors');

// Warning-only path with force via advanced anyway — use valid report mock
E.validateProject = () => ({
  valid: true,
  issues: [{ severity: 'warning', message: 'warn', sceneId: 'hub' }],
  summary: { errors: 0, warnings: 1 }
});
openedUrl = null;
const ok = E.previewScene({ mode: 'current', sceneId: 'hub' });
assert(ok === true, 'preview launches when no errors');
assert(openedUrl && openedUrl.includes('editorTest=1'), 'opens isolated runtime URL');

// Isolated cache keys only
assert(ctx.localStorage._data['rpg_editor_test_data'], 'test data written');
assert(ctx.sessionStorage._data['rpg_editor_test_session'], 'test session written');
assert(!productionTouched, 'production save/cache untouched');

// Return navigation state
const ret = JSON.parse(ctx.sessionStorage._data['rpg_editor_preview_return']);
assert(ret.sceneId === 'hub', 'return state saves scene');
assert(ret.workspaceSection === 'content', 'return state saves section');

// Restore navigation
E.currentScene = null;
ctx.window.location.search = '?restoreEditor=1';
E.restorePreviewReturnState();
assert(E.currentScene === 'hub', 'restore navigation');

// Start mode
storage._data = {};
ctx.localStorage._data = {};
openedUrl = null;
E.previewScene({ mode: 'start' });
const sess = JSON.parse(ctx.sessionStorage._data['rpg_editor_test_session'] || '{}');
assert(sess.sceneId === 'hub', 'start mode uses startScene');

// Search/filter does not mutate project data
const snap = JSON.stringify(E.data);
E.getPreviewValidation('hub');
assert(JSON.stringify(E.data) === snap, 'validation does not mutate data');

// Runtime module has no Editor dependency
assert(!epw.includes('require('), 'no require in preview workflow');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
