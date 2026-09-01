#!/usr/bin/env node
/**
 * Phase UI-6 — Navigation + Writer/Advanced mode tests.
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
const redesign = fs.readFileSync(path.join(root, 'js/editor/editor-nav-redesign.js'), 'utf8');

assert(html.includes('editor-nav-redesign.js'), 'editor.html loads nav redesign');
assert(redesign.includes('REDESIGN_SECTIONS'), 'redesign sections defined');
assert(redesign.includes("groupId: 'create'"), 'CREATE group');
assert(redesign.includes("groupId: 'content'"), 'CONTENT group');
assert(redesign.includes('tools:') && redesign.includes('TOOL_ACTIONS'), 'TOOLS group');
assert(redesign.includes('TOOL_ACTIONS'), 'tool actions');
assert(redesign.includes('preserveModeContext'), 'mode switch preservation');
assert(redesign.includes('syncNavOnboarding'), 'onboarding API');
assert(redesign.includes('registerNavCommands'), 'command palette integration');

// Writer mode default persistence key
const writer = fs.readFileSync(path.join(root, 'js/editor/editor-writer-mode.js'), 'utf8');
assert(writer.includes('GLOBAL_STORAGE_KEY'), 'mode storage key');
assert(writer.includes('writeStoredEditorLevel'), 'mode persists helper');

// Contextual scene nav
const wsScene = fs.readFileSync(path.join(root, 'js/editor/editor-workspace-scene.js'), 'utf8');
assert(wsScene.includes('injectSceneContextNav'), 'contextual scene nav');
assert(wsScene.includes('ws-scene-context-nav'), 'context nav markup');

// --- Runtime ---
const ctx = {
  console: { log() {}, info() {}, warn() {}, error() {} },
  document: {
    readyState: 'complete',
    head: { appendChild() {} },
    body: { classList: { add() {}, remove() {}, toggle() {} }, dataset: {} },
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    addEventListener() {},
    createElement: () => ({
      id: '', className: '', hidden: true, innerHTML: '',
      dataset: {}, style: {}, insertBefore() {}, appendChild() {}
    })
  },
  localStorage: { store: {}, getItem(k) { return this.store[k] || null; }, setItem(k, v) { this.store[k] = v; } }
};
ctx.globalThis = ctx;
ctx.window = ctx;
ctx.t = (k) => k;

let switchTabCalls = [];
let markDirtyCalls = 0;

ctx.Editor = {
  editorMode: 'writer',
  currentTab: 'scenes',
  currentScene: 'hub',
  data: { scenes: { hub: { id: 'hub', text: 'Hi' }, start: { id: 'start' } }, startScene: 'hub' },
  workspace: { open: ['scene:hub'], activeId: 'scene:hub', ui: {} },
  Inspector: { selection: { type: 'scene', id: 'hub' }, render() {} },
  isWriterMode() { return this.editorMode === 'writer'; },
  isEditorAdvancedMode() { return false },
  isTabVisibleInEditorMode(tab) {
    if (this.editorMode !== 'writer') return true;
    return ['scenes', 'graph', 'items', 'quests', 'npcs'].includes(tab);
  },
  escapeAttr(s) { return String(s); },
  switchTab(tab) { switchTabCalls.push(tab); this.currentTab = tab; },
  markDirty() { markDirtyCalls++; },
  syncNavLayout() {},
  applyNavEditorMode() {},
  applyEditorDensityClasses() {},
  hooks: { after() {}, register() {} },
  commands: { register() {} }
};

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-writer-mode.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-nav-layout.js'), 'utf8'), ctx);
vm.runInContext(redesign, ctx);

const E = ctx.Editor;

// Nav groups API
assert(typeof E.getNavGroups === 'function', 'getNavGroups API');
const groups = E.getNavGroups();
assert(groups.some((g) => g.id === 'create'), 'create group in API');
assert(groups.some((g) => g.id === 'tools'), 'tools group in API');

// Sections include story (graph)
const sections = E.getNavSections();
assert(sections.some((s) => s.id === 'story' && s.tab === 'graph'), 'story section maps to graph');
assert(sections.some((s) => s.id === 'scenes' && s.primary), 'scenes is primary');

// Tab → section
assert(E.getNavSectionForTab('graph')?.id === 'story', 'graph tab → story section');
assert(E.getNavSectionForTab('world')?.id === 'world', 'world tab → world section');

// Nav click resolves redesign-only section ids (story, world)
E.onNavSectionClick('story', { preventDefault() {} });
assert(E.currentTab === 'graph', 'onNavSectionClick story → graph tab');
E.onNavSectionClick('world', { preventDefault() {} });
assert(E.currentTab === 'world', 'onNavSectionClick world → world tab');

// Tool actions
const tools = E.getNavToolActions();
assert(tools.length === 3, 'three tool actions');
assert(tools.some((t) => t.id === 'validate'), 'validate tool');

// Mode switch does not mark dirty
const snapOpen = E.workspace.open.slice();
const snapScene = E.currentScene;
E.applyEditorMode('full');
assert(markDirtyCalls === 0, 'applyEditorMode does not markDirty');
assert(E.workspace.open.join(',') === snapOpen.join(','), 'workspace open preserved on mode switch');
assert(E.currentScene === snapScene, 'currentScene preserved on mode switch');

// Writer mode persistence
E.applyEditorMode('writer');
assert(ctx.localStorage.store.rpg_editor_mode === 'writer', 'writer mode persisted');
E.applyEditorMode('advanced');
assert(ctx.localStorage.store.rpg_editor_mode === 'advanced', 'advanced mode persisted');
assert(E.getEditorLevel && E.getEditorLevel() === 'engineer', 'advanced maps to engineer level');
E.applyEditorMode('cartographer');
assert(E.getEditorLevel() === 'cartographer', 'cartographer level applies');

// Onboarding
E.syncNavOnboarding();
assert(typeof E.syncNavOnboarding === 'function', 'syncNavOnboarding callable');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
