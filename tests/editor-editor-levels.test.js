#!/usr/bin/env node
/**
 * P4.5 — Editor levels: writer / cartographer / engineer.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓', msg); }
  else { failed++; console.error('  ✗', msg); }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function bootEditorLevel() {
  const storage = {};
  const tabs = [
    { id: 'scenes', hidden: false },
    { id: 'json', hidden: false },
    { id: 'balance', hidden: false }
  ];
  const ctx = {
    console,
    localStorage: {
      getItem(k) { return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null; },
      setItem(k, v) { storage[k] = String(v); },
      removeItem(k) { delete storage[k]; }
    },
    document: {
      body: { classList: { add() {}, remove() {}, toggle() {} }, dataset: {} },
      querySelector(sel) {
        if (sel === '.tabs-bar') return { classList: { toggle() {} } };
        return null;
      },
      querySelectorAll(sel) {
        if (sel === '.tab[data-tab-id]') {
          return tabs.map((t) => ({
            dataset: { tabId: t.id },
            classList: { toggle(_c, v) { t.hidden = !v; } },
            setAttribute() {}
          }));
        }
        return [];
      },
      getElementById() { return null; },
      createElement() { return { id: '', textContent: '', appendChild() {}, setAttribute() {}, addEventListener() {} }; },
      head: { appendChild() {} }
    },
    globalThis: null
  };
  ctx.globalThis = ctx;
  ctx.window = ctx;

  const Editor = {
    editorMode: 'writer',
    data: { meta: { title: 'Demo' }, scenes: { hub: { id: 'hub' } } },
    currentTab: 'scenes',
    currentScene: 'hub',
    workspace: { open: ['scene:hub'], activeId: 'scene:hub' },
    getStoryWorkspaceProjectKey() { return 'demo'; },
    switchTabCalls: 0,
    renderAllCalls: 0,
    switchTab(tab) { this.switchTabCalls++; this.currentTab = tab; },
    renderAll() { this.renderAllCalls++; },
    renderSceneEditor() {},
    applySceneWorkspaceView() {},
    getSceneWorkspaceViewMode() { return 'text'; },
    setSceneWorkspaceViewMode() {},
    hooks: {
      _after: {},
      after(name, fn) {
        if (!this._after[name]) this._after[name] = [];
        this._after[name].push(fn);
        return () => {};
      }
    }
  };
  ctx.Editor = Editor;
  vm.createContext(ctx);
  vm.runInContext(read('js/editor/editor-writer-mode.js'), ctx);
  return { Editor, storage };
}

console.log('Editor levels P4.5');

const src = read('js/editor/editor-writer-mode.js');
assert(src.includes('МАТРИЦА ВИДИМОСТИ'), 'visibility matrix documented');
assert(src.includes('story.map_workspace'), 'map workspace feature');
assert(src.includes('PER_PROJECT_PREFIX'), 'per-project storage');

{
  const { Editor } = bootEditorLevel();
  Editor.applyEditorMode('writer');
  assert(Editor.getEditorLevel() === 'writer', 'writer level');
  assert(Editor.isWriterMode(), 'isWriterMode writer');
  assert(!Editor.isAdvancedMode(), 'not advanced in writer');
  assert(!Editor.isEditorFeatureVisible('story.map_workspace'), 'writer hides map workspace');
  assert(Editor.isEditorFeatureVisible('author.simple_fields'), 'writer simple fields');
  assert(!Editor.isTabVisibleInEditorMode('json'), 'json hidden in writer');
}

{
  const { Editor } = bootEditorLevel();
  Editor.applyEditorMode('cartographer');
  assert(Editor.getEditorLevel() === 'cartographer', 'cartographer level');
  assert(Editor.isWriterMode(), 'cartographer is author level');
  assert(Editor.isCartographerMode(), 'isCartographerMode');
  assert(Editor.isEditorFeatureVisible('story.map_workspace'), 'cartographer map workspace');
  assert(Editor.isEditorFeatureVisible('story.structure_checklist'), 'cartographer checklist');
}

{
  const { Editor } = bootEditorLevel();
  Editor.applyEditorMode('advanced');
  assert(Editor.getEditorLevel() === 'engineer', 'advanced migrates to engineer');
  assert(Editor.isAdvancedMode(), 'isAdvancedMode engineer');
  assert(!Editor.isWriterMode(), 'engineer not writer mode');
  assert(Editor.isTabVisibleInEditorMode('json'), 'json visible in engineer');
}

{
  const { Editor, storage } = bootEditorLevel();
  Editor.applyEditorMode('cartographer');
  assert(storage.rpg_editor_level_demo === 'cartographer', 'per-project level stored');
  assert(storage.rpg_editor_mode === 'cartographer', 'global legacy key updated');
  Editor.applyEditorMode('engineer');
  assert(storage.rpg_editor_mode === 'advanced', 'engineer stored as advanced globally');
}

{
  const { Editor } = bootEditorLevel();
  Editor.applyEditorMode('engineer', { force: true });
  Editor.currentTab = 'json';
  Editor.currentScene = 'hub';
  const open = Editor.workspace.open.slice();
  Editor.switchTabCalls = 0;
  Editor.renderAllCalls = 0;
  Editor.applyEditorMode('writer', { force: true });
  assert(Editor.switchTabCalls === 1, 'one switchTab when leaving hidden tab');
  assert(Editor.renderAllCalls === 0, 'no renderAll on level switch');
  assert(Editor.currentScene === 'hub', 'scene preserved');
  assert(Editor.workspace.open.join(',') === open.join(','), 'workspace open preserved');
  Editor.switchTabCalls = 0;
  Editor.applyEditorMode('cartographer', { force: true });
  assert(Editor.switchTabCalls === 0, 'no switchTab when tab still valid');
}

{
  const { Editor } = bootEditorLevel();
  Editor.applyEditorMode('cartographer', { force: true });
  Editor.getSceneWorkspaceViewMode = () => 'map';
  let forcedText = false;
  Editor.setSceneWorkspaceViewMode = (m) => { if (m === 'text') forcedText = true; };
  Editor.applyEditorMode('writer', { force: true });
  assert(forcedText, 'writer downshift resets map workspace');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
