#!/usr/bin/env node
/**
 * Content Browser 2.0 — панель поиска/сортировки/фильтра сцен
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

const sampleData = () => ({
  startScene: 'alpha',
  scenes: {
    alpha: { id: 'alpha', location: 'Alpha Village', text: 'Start', choices: [] },
    beta: { id: 'beta', location: 'Beta Tavern', text: 'Drinks', choices: [] },
    gamma: {
      id: 'gamma', location: 'Gamma Forest', text: 'Trees',
      visual: { mode: 'overlay', nodes: [{ id: 'n1' }] }
    }
  },
  quests: { q1: { id: 'q1', title: 'Quest' } },
  items: { i1: { id: 'i1', name: 'Item' } },
  npcs: {}
});

const ctx = {
  console: { log() {}, info() {}, warn() {}, error() {} },
  _els: {},
  document: null
};

function makeEl(tag) {
  const el = {
    tagName: tag.toUpperCase(),
    className: '',
    _html: '',
    style: {},
    dataset: {},
    hidden: false,
    parentNode: null,
    childNodes: [],
    value: '',
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
    querySelector(sel) {
      if (sel === '#cb2-scene-filters') return ctx._els['cb2-scene-filters'] || null;
      if (sel === '#cb-scene-search') return ctx._els['cb-scene-search'] || null;
      if (sel === '#cb-scene-sort') return ctx._els['cb-scene-sort'] || null;
      if (sel === '#cb2-global-search') return ctx._els['cb2-global-search'] || null;
      return null;
    },
    querySelectorAll: () => [],
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {},
    getAttribute() { return null; },
    closest() { return null; }
  };
  Object.defineProperty(el, 'id', {
    get() { return el._id || ''; },
    set(v) {
      el._id = v;
      if (v) ctx._els[v] = el;
    }
  });
  Object.defineProperty(el, 'innerHTML', {
    get() { return el._html; },
    set(v) {
      el._html = String(v);
      el.childNodes.length = 0;
      if (String(v).includes('id="cb2-scene-filters"')) {
        const panel = makeEl('div');
        panel.id = 'cb2-scene-filters';
        const search = makeEl('input');
        search.id = 'cb-scene-search';
        const m = String(v).match(/id="cb-scene-search"[^>]*value="([^"]*)"/);
        search.value = m ? m[1] : '';
        panel.appendChild(search);
        const sort = makeEl('select');
        sort.id = 'cb-scene-sort';
        panel.appendChild(sort);
        el.childNodes.push(panel);
      }
      if (String(v).includes('id="cb2-global-search"')) {
        const gs = makeEl('input');
        gs.id = 'cb2-global-search';
        el.childNodes.push(gs);
      }
    }
  });
  return el;
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

const sceneList = makeEl('div');
sceneList.id = 'scene-list';

const scenesPane = makeEl('div');
scenesPane.id = 'context-scenes-pane';
scenesPane.appendChild(sceneList);
sidebar.appendChild(scenesPane);

ctx.Editor = {
  data: sampleData(),
  currentScene: 'alpha',
  currentTab: 'scenes',
  _contentBrowserCategory: 'scenes',
  _contentBrowserQuery: '',
  _sceneListQuery: '',
  _sceneListFilter: 'all',
  _sceneListSort: 'title',
  workspace: { recentContent: [] },
  toast: { success() {}, warning() {}, info() {} },
  hooks: null,
  isWriterMode() { return false },
  isAdvancedMode() { return true },
  isEditorAdvancedMode() { return true },
  escapeHtml(s) { return String(s ?? ''); },
  escapeAttr(s) { return String(s ?? ''); },
  switchTab(t) { this.currentTab = t; },
  updateJSONPreview() {},
  renderSceneEditor() {},
  refreshDashboardIfVisible() {},
  openSceneWorkspace(id) { this.currentScene = id; return true; },
  openSceneDocument(id) { this.currentScene = id; },
  selectScene(id) { this.currentScene = id; },
  duplicateScene() { return null; },
  confirmDialog: async () => true,
  findSceneInboundReferences() { return []; }
};

ctx.globalThis = ctx;
ctx.window = ctx;

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-hooks.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-content-index.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-content-browser.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-content-browser-v2.js'), 'utf8'), ctx);

const E = ctx.Editor;
if (typeof E.searchProjectScenes !== 'function') {
  E.searchProjectScenes = function searchProjectScenes(q, f) {
    return ctx.EditorContentIndex.searchScenes(this.data, { query: q, filter: f });
  };
}
const cb2src = fs.readFileSync(path.join(root, 'js/editor/editor-content-browser-v2.js'), 'utf8');

assert(!cb2src.includes('renderContentBrowserChrome'), 'no dead renderContentBrowserChrome dependency');
assert(cb2src.includes('renderSceneFiltersPanel'), 'scene filters panel helper exists');

function sceneIdsInList() {
  const mount = sceneList.childNodes.find((n) => n.className === 'cb2-scenes-mount');
  const html = mount ? mount.innerHTML : sceneList.innerHTML;
  const ids = [];
  const re = /data-scene-id="([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) ids.push(m[1]);
  return ids;
}

// Монтирование панели на «Сцены»
E._contentBrowserCategory = 'scenes';
E.renderSceneList();
const chrome = ctx.document.getElementById('cb-browser-chrome');
assert(chrome, 'browser chrome mounted');
assert(chrome.innerHTML.includes('cb2-scene-filters'), 'scene filters panel in chrome HTML');
assert(ctx.document.getElementById('cb-scene-search'), 'scene search input in DOM');

// Поиск по подстроке
E._sceneListQuery = 'tavern';
E.renderSceneList();
let ids = sceneIdsInList();
assert(ids.length === 1 && ids[0] === 'beta', 'search filters to Beta Tavern');

E._sceneListQuery = 'GAMMA';
E.renderSceneList();
ids = sceneIdsInList();
assert(ids.length === 1 && ids[0] === 'gamma', 'search case-insensitive');

// Сортировка
E._sceneListQuery = '';
E._sceneListSort = 'title';
E.renderSceneList();
const asc = sceneIdsInList();
E._sceneListSort = 'title_desc';
E.renderSceneList();
const desc = sceneIdsInList();
assert(asc.join() !== desc.join(), 'sort change reorders scene list');
assert(desc[0] === 'gamma', 'title_desc puts gamma first');

// Другая категория — без панели сцен
E._contentBrowserCategory = 'quests';
E._cb2ForceChromeRebuild = true;
E.renderSceneList();
assert(!chrome.innerHTML.includes('cb2-scene-filters'), 'scene filters not on quests category');

// Глобальный поиск не ломается
E._contentBrowserCategory = 'scenes';
E._cb2ForceChromeRebuild = true;
E._contentBrowserQuery = 'Quest';
E.renderSceneList();
assert(sceneList.innerHTML.includes('cb2-global-results') || sceneList.innerHTML.includes('Quest'), 'global search still works');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
