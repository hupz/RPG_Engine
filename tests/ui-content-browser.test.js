#!/usr/bin/env node
/**
 * Phase UI-9 — Unified Content Browser tests
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
const cb = fs.readFileSync(path.join(root, 'js/editor/editor-content-browser.js'), 'utf8');
const cb2 = fs.readFileSync(path.join(root, 'js/editor/editor-content-browser-v2.js'), 'utf8');

assert(html.includes('editor-content-browser.js'), 'script wired');
assert(html.includes('editor-content-browser-v2.js'), 'v2 script wired');
assert(cb.includes('openSceneFromContentBrowser'), 'open API');
assert(cb2.includes('openContentFromBrowser'), 'v2 open API');
assert(cb.includes('locateSceneInGraph'), 'graph locate API');
assert(!cb.includes('SceneManager'), 'no SceneManager');

const sampleData = () => ({
  startScene: 'hub',
  scenes: {
    hub: {
      id: 'hub', location: 'Village Square', text: 'Welcome',
      choices: [{ text: 'Tavern', to: 'tavern' }, { text: 'Forest', to: 'forest' }]
    },
    tavern: { id: 'tavern', location: 'Old Tavern', text: 'Dark room', choices: [{ text: 'Back', to: 'hub' }] },
    forest: {
      id: 'forest', location: 'Dark Forest', text: 'Trees',
      visual: { mode: 'overlay', nodes: [{ id: 'h1', kind: 'hotspot' }, { id: 'h2', kind: 'hotspot' }] }
    }
  },
  items: { potion: { id: 'potion', name: 'Healing Potion', type: 'consumable' } },
  quests: { main: { id: 'main', title: 'Find the Blacksmith' } },
  npcs: { smith: { id: 'smith', name: 'Blacksmith' } }
});

let dataSnapshot = '';
let openWorkspaceCalls = [];
let graphLocateCalls = [];
let confirmResult = true;

global.confirm = () => confirmResult;

const ctx = {
  console: { log() {}, info() {}, warn() {}, error() {} },
  confirm: () => confirmResult,
  _els: {},
  document: null
};

function makeEl(tag) {
  return {
    tagName: tag.toUpperCase(),
    id: '',
    className: '',
    innerHTML: '',
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {} },
    hidden: false,
    parentNode: null,
    childNodes: [],
    appendChild(c) {
      if (c) {
        c.parentNode = this;
        this.childNodes.push(c);
        if (c.id) ctx._els[c.id] = c;
      }
      return c;
    },
    insertBefore(node, ref) {
      return this.appendChild(node);
    },
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll: () => []
  };
}

ctx.document = {
  readyState: 'complete',
  head: { appendChild() {} },
  body: { classList: { add() {}, remove() {}, toggle() {} }, dataset: {}, appendChild(c) { return c; } },
  getElementById(id) { return ctx._els[id] || null; },
  querySelector: () => null,
  addEventListener() {},
  createElement(tag) {
    if (tag === 'style') return { id: '', textContent: '', appendChild() {} };
    return makeEl(tag);
  }
};

const sidebar = makeEl('aside');
sidebar.id = 'context-sidebar';
ctx._els['context-sidebar'] = sidebar;

const sceneList = makeEl('div');
sceneList.id = 'scene-list';
ctx._els['scene-list'] = sceneList;

const scenesPane = makeEl('div');
scenesPane.id = 'context-scenes-pane';
scenesPane.appendChild(sceneList);
sidebar.appendChild(scenesPane);
ctx._els['context-scenes-pane'] = scenesPane;

ctx.Editor = {
  data: sampleData(),
  currentScene: 'hub',
  currentTab: 'scenes',
  _sceneListQuery: '',
  _sceneListFilter: 'all',
  _sceneListSort: 'title',
  workspace: { open: [], activeId: null },
  toast: { success() {}, warning() {} },
  confirmDialog: async () => confirmResult,
  hooks: null,
  isWriterMode() { return !!ctx._writer; },
  isAdvancedMode() { return !ctx._writer; },
  isEditorAdvancedMode() { return !!ctx._advanced; },
  escapeHtml(s) { return String(s); },
  escapeAttr(s) { return String(s); },
  switchTab(t) { this.currentTab = t; },
  updateJSONPreview() {},
  renderSceneEditor() {},
  refreshDashboardIfVisible() {},
  findSceneInboundReferences(sceneId) {
    return ctx.EditorContentIndex.findSceneReferences(sceneId, ctx.Editor.data);
  },
  searchProjectScenes(q, f) {
    return ctx.EditorContentIndex.searchScenes(ctx.Editor.data, { query: q, filter: f });
  },
  duplicateScene(sceneId) {
    const built = ctx.EditorContentIndex.buildDuplicatedScene(sceneId, ctx.Editor.data.scenes[sceneId], ctx.Editor.data.scenes);
    ctx.Editor.data.scenes[built.id] = built.scene;
    ctx.Editor.currentScene = built.id;
    return built.id;
  },
  openSceneDocument(id) {
    ctx.Editor.currentScene = id;
    ctx.Editor.workspace.activeId = 'scene:' + id;
  },
  openSceneWorkspace(id) {
    openWorkspaceCalls.push(id);
    ctx.Editor.currentScene = id;
    return true;
  },
  onStoryGraphSearch(id) { graphLocateCalls.push(id); },
  applyGraphSearchHighlight() {},
  openSceneWizard(opts) {
    const id = 'scene_' + Object.keys(ctx.Editor.data.scenes).length;
    ctx.Editor.data.scenes[id] = {
      id,
      location: (opts && opts.defaultName) || 'New',
      text: '',
      editorModules: ['story', 'choices']
    };
    ctx.Editor.currentScene = id;
    openWorkspaceCalls.push(id);
    return id;
  },
  createContentEntity(type) {
    ctx._created = type;
    if (type === 'item') {
      ctx.Editor.data.items.new_item = { name: 'New Item' };
      ctx.Editor.editingItemId = 'new_item';
      ctx.Editor.currentTab = 'items';
    } else if (type === 'quest') {
      ctx.Editor.data.quests.new_quest = { title: 'New Quest' };
      ctx.Editor.editingQuestId = 'new_quest';
      ctx.Editor.currentTab = 'quests';
    }
    return true;
  },
  openContentEntity(type, id) {
    ctx._opened = { type, id };
    if (type === 'item') {
      ctx.Editor.editingItemId = id;
      ctx.Editor.currentTab = 'items';
    } else if (type === 'quest') {
      ctx.Editor.editingQuestId = id;
      ctx.Editor.currentTab = 'quests';
    } else if (type === 'scene') {
      ctx.Editor.openSceneFromContentBrowser(id);
    }
    return true;
  },
  testFromHere(opts) { ctx._previewed = opts?.sceneId; }
};

ctx.globalThis = ctx;
ctx.window = ctx;

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-hooks.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-content-index.js'), 'utf8'), ctx);
ctx.Editor.hooks.register('test', {
  renderSceneList() {},
  deleteScene() {}
}, { force: true });
vm.runInContext(cb, ctx);
vm.runInContext(cb2, ctx);

const E = ctx.Editor;

// Search
const forestOnly = E.searchProjectScenes('forest', 'all');
assert(forestOnly.length === 1 && forestOnly[0].id === 'forest', 'search by name');

const visualOnly = E.searchProjectScenes('', 'visual');
assert(visualOnly.some((r) => r.id === 'forest'), 'filter visual');

// Sort
const sorted = E.sortSceneEntries(E.searchProjectScenes('', 'all'), 'title', E.data);
assert(sorted[0].title <= sorted[sorted.length - 1].title || sorted.length < 2, 'sort by title');

// Metadata
const meta = E.getSceneCardMeta(E.data.scenes.hub, 'hub', E.data);
assert(meta.choices === 2, 'scene card choices count');

// No data mutation during search/filter
dataSnapshot = JSON.stringify(E.data);
E._sceneListQuery = 'tavern';
E.searchProjectScenes('tavern', 'text');
E._sceneListFilter = 'text';
E.searchProjectScenes('', 'text');
assert(JSON.stringify(E.data) === dataSnapshot, 'search/filter does not mutate data');

// Open workspace
openWorkspaceCalls = [];
E.openSceneFromContentBrowser('tavern');
assert(openWorkspaceCalls.includes('tavern'), 'open workspace');

// Graph locate
graphLocateCalls = [];
E.locateSceneInGraph('hub');
assert(graphLocateCalls.includes('hub'), 'graph locate');
assert(E.currentTab === 'graph', 'graph switches to graph tab');

// Create — opens canonical wizard (mock creates synchronously)
const newId = E.createSceneFromBrowser('text');
assert(newId && E.data.scenes[newId], 'create scene via wizard mock');
assert(openWorkspaceCalls.includes(newId), 'create opens workspace');

// Duplicate
const dupId = E.duplicateScene('hub');
assert(dupId && E.data.scenes[dupId], 'duplicate scene');

// Delete references
const usage = E.formatSceneDeleteUsage('hub');
assert(usage.refs.length > 0, 'hub has inbound refs');
assert(!usage.canSafelyDelete, 'hub not safe to delete');
assert(usage.lines.length > 0, 'usage summary lines');

const orphanUsage = E.formatSceneDeleteUsage('tavern');
// tavern referenced by hub choice
assert(orphanUsage.refs.some((r) => r.fromId === 'hub'), 'tavern referenced by hub');

// Delete with refs — confirm true
confirmResult = true;
const beforeCount = Object.keys(E.data.scenes).length;

async function runAsyncTests() {
  await E.deleteSceneWithUsageDialog('forest');
  assert(Object.keys(E.data.scenes).length === beforeCount - 1, 'delete removes scene');

  // Render list
  E.switchTab('scenes');
  E.renderSceneList();
  assert(ctx.document.getElementById('cb-browser-chrome') != null, 'browser chrome created');
  const hasCards = sceneList.innerHTML.includes('cb-scene-card') ||
    (sceneList.childNodes || []).some((n) => String(n.innerHTML || '').includes('cb-scene-card'));
  assert(hasCards, 'scene cards rendered');
  assert(!sceneList.innerHTML.includes('data-scene-id="forest"'), 'deleted scene not in list');

  ctx._writer = true;
  E.renderSceneList();
  assert(!sceneList.innerHTML.includes('cb-scene-card__id'), 'writer hides raw id');

  // UI-14: global search
  const hits = E.searchProjectContent('Potion');
  assert(hits.some((h) => h.id === 'potion'), 'search finds item');

  const questHits = E.searchProjectContent('Blacksmith');
  assert(questHits.some((h) => h.type === 'quest'), 'search finds quest');

  // UI-14: open item/quest
  E.openContentFromBrowser('item', 'potion', 'Healing Potion');
  assert(ctx._opened?.type === 'item' && ctx._opened.id === 'potion', 'open item from browser');

  E.openContentFromBrowser('quest', 'main', 'Find the Blacksmith');
  assert(E.editingQuestId === 'main', 'open quest editor');

  // UI-14: recent tracking
  assert(Array.isArray(E.workspace.recentContent) && E.workspace.recentContent.length > 0, 'recent objects tracked');

  // UI-14: categories
  const cats = E.getContentBrowserCategories();
  assert(cats.some((c) => c.id === 'quests'), 'quests category exists');
  assert(cats.some((c) => c.id === 'items'), 'items category exists');

  // UI-14: empty project
  E.data = { scenes: {}, items: {}, quests: {} };
  assert(E.isProjectContentEmpty(), 'empty project detected');
  E.switchTab('scenes');
  E.renderSceneList();
  assert(sceneList.innerHTML.includes('cb2-welcome') || sceneList.innerHTML.includes('Добро пожаловать'), 'empty project welcome');

  // UI-14: no runtime dependency
  assert(!cb2.includes('SceneManager'), 'v2 no SceneManager');
  assert(!cb2.includes('QuestRuntime'), 'v2 no QuestRuntime');
}

runAsyncTests().then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
