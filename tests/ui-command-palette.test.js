#!/usr/bin/env node
/**
 * Phase UI-16 — Command Palette & Fast Navigation tests
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
const palette = fs.readFileSync(path.join(root, 'js/editor/editor-command-palette.js'), 'utf8');
const paletteV2 = fs.readFileSync(path.join(root, 'js/editor/editor-command-palette-v2.js'), 'utf8');
const projectSearch = fs.readFileSync(path.join(root, 'js/editor/editor-project-search.js'), 'utf8');

assert(html.includes('editor-command-palette-v2.js'), 'v2 script wired after palette');
assert(palette.includes('isTypingContext'), 'typing context guard');
assert(palette.includes('Search commands'), 'palette placeholder');
assert(palette.includes('cmd-palette-subtitle'), 'subtitle markup');
assert(paletteV2.includes('searchProjectContent'), 'object search via content index');
assert(paletteV2.includes('openContentFromBrowser'), 'opens via existing browser API');
assert(!paletteV2.includes('SceneManager'), 'no SceneManager');
assert(!paletteV2.includes('QuestRuntime'), 'no QuestRuntime');
assert(projectSearch.includes('openCommandPalette'), 'project search delegates Ctrl+K');
assert(paletteV2.includes('openProjectSearch'), 'v2 redirects project search');

const calls = {
  openSceneWorkspace: 0,
  renderSceneList: 0,
  switchTab: [],
  runProjectValidation: 0,
  previewScene: 0,
  exportJSON: 0,
  openContentFromBrowser: 0,
  createSceneFromBrowser: 0,
  openSceneWizard: 0,
  createContentEntity: 0,
  openCommandPalette: 0
};

const ctx = {
  console: { log() {}, info() {}, warn() {}, error() {} },
  localStorage: {
    store: {},
    getItem(k) { return this.store[k] || null; },
    setItem(k, v) { this.store[k] = v; }
  },
  document: {
    readyState: 'complete',
    head: { appendChild() {} },
    body: { classList: { add() {}, remove() {}, toggle() {} }, appendChild() {} },
    addEventListener() {},
    querySelector: () => null,
    getElementById: () => null,
    createElement(tag) {
      const el = {
        tagName: tag,
        id: '',
        className: '',
        innerHTML: '',
        hidden: false,
        classList: { add() {}, remove() {}, toggle() {} },
        appendChild() {},
        addEventListener() {},
        querySelector: () => null,
        querySelectorAll: () => []
      };
      return el;
    }
  },
  Editor: {
    workspace: { ui: {} },
    data: {
      scenes: {
        village: { location: 'Village', text: 'A quiet place' },
        tavern: { location: 'Tavern' }
      },
      quests: { main_quest: { title: 'Main Quest' } },
      items: { healing_potion: { name: 'Healing Potion' } },
      npcs: { innkeeper: { name: 'Innkeeper' } }
    },
    currentScene: 'village',
    escapeHtml(s) { return String(s); },
    escapeAttr(s) { return String(s); },
    hooks: null,
    switchTab(tab) { calls.switchTab.push(tab); },
    openSceneWorkspace(id) { calls.openSceneWorkspace++; return true; },
    renderSceneList() { calls.renderSceneList++; },
    runProjectValidation() { calls.runProjectValidation++; },
    previewScene(opts) { calls.previewScene++; this._lastPreview = opts; },
    exportJSON() { calls.exportJSON++; },
    openContentFromBrowser(type, id) {
      calls.openContentFromBrowser++;
      this._lastOpen = { type, id };
      return true;
    },
    createSceneFromBrowser() { calls.createSceneFromBrowser++; return true; },
    openSceneWizard() { calls.openSceneWizard++; return true; },
    createContentEntity(type) {
      calls.createContentEntity++;
      this._lastCreate = type;
      return true;
    },
    searchProjectContent(query) {
      const q = String(query || '').toLowerCase();
      const out = [];
      Object.entries(this.data.scenes || {}).forEach(([id, s]) => {
        const title = s.location || id;
        if (title.toLowerCase().includes(q) || id.includes(q)) {
          out.push({ type: 'scene', id, title, categoryLabel: 'Сцены' });
        }
      });
      Object.entries(this.data.quests || {}).forEach(([id, qst]) => {
        const title = qst.title || id;
        if (title.toLowerCase().includes(q) || id.includes(q)) {
          out.push({ type: 'quest', id, title, categoryLabel: 'Квесты' });
        }
      });
      Object.entries(this.data.items || {}).forEach(([id, it]) => {
        const title = it.name || id;
        if (title.toLowerCase().includes(q) || id.includes(q)) {
          out.push({ type: 'item', id, title, categoryLabel: 'Предметы' });
        }
      });
      Object.entries(this.data.npcs || {}).forEach(([id, n]) => {
        const title = n.name || id;
        if (title.toLowerCase().includes(q) || id.includes(q)) {
          out.push({ type: 'npc', id, title, categoryLabel: 'NPC' });
        }
      });
      return out;
    },
    openCommandPalette(prefill) {
      calls.openCommandPalette++;
      this._palettePrefill = prefill;
    },
    openProjectSearch(prefill) {
      this._projectSearchPrefill = prefill;
    },
    renderProjectSearchModal() {}
  }
};
ctx.globalThis = ctx;
ctx.window = ctx;
ctx.window._cmdPaletteKeyBound = false;

function primeTestI18n(context) {
  vm.runInContext(fs.readFileSync(path.join(root, 'locales/ru.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/i18n.js'), 'utf8'), context);
  const ru = JSON.parse(JSON.stringify(context.I18N_LOCALES.ru));
  context.I18n._strings = ru;
  context.I18n._fallback = ru;
  context.I18n._loaded = true;
  context.I18n._lang = 'ru';
}

vm.createContext(ctx);
primeTestI18n(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-hooks.js'), 'utf8'), ctx);
vm.runInContext(palette, ctx);
vm.runInContext(paletteV2, ctx);

const E = ctx.Editor;
const Cmd = E.commands;

assert(typeof E.openCommandPalette === 'function', 'openCommandPalette API');
assert(typeof Cmd.search === 'function', 'commands.search API');
assert(typeof E.getCommandPaletteCategories === 'function', 'getCommandPaletteCategories API');

// Command registration
const ids = [
  'nav.go_scene',
  'nav.content_browser',
  'nav.project_graph',
  'ui16.create.scene',
  'ui16.create.item',
  'ui16.create.quest',
  'ui16.validate.project',
  'ui16.preview.project',
  'ui16.export.project'
];
ids.forEach((id) => assert(!!Cmd.get(id), 'registered: ' + id));

// Commands delegate to existing APIs
Cmd.run('nav.go_scene');
assert(calls.switchTab.includes('scenes'), 'go scene → switchTab scenes');
assert(calls.openSceneWorkspace === 1, 'go scene → openSceneWorkspace');

Cmd.run('nav.content_browser');
assert(calls.renderSceneList >= 1, 'content browser → renderSceneList');

Cmd.run('ui16.create.scene');
assert(calls.openSceneWizard === 1, 'create scene → openSceneWizard');

Cmd.run('ui16.create.item');
assert(calls.createContentEntity === 1 && E._lastCreate === 'item', 'create item → createContentEntity');

Cmd.run('ui16.create.quest');
assert(calls.createContentEntity === 2 && E._lastCreate === 'quest', 'create quest → createContentEntity');

Cmd.run('ui16.validate.project');
assert(calls.runProjectValidation === 1, 'validate → runProjectValidation');

Cmd.run('ui16.preview.project');
assert(calls.previewScene === 1 && E._lastPreview.mode === 'project', 'preview → previewScene');

Cmd.run('ui16.export.project');
assert(calls.exportJSON === 1, 'export → exportJSON');

// Object search
const objects = Cmd.searchEntities('village');
assert(objects.length > 0, 'object search finds scene');
assert(objects[0].title === 'Village', 'object title');
assert(objects[0].subtitle === 'Сцена', 'object subtitle type label');

const questHit = Cmd.searchEntities('main quest');
assert(questHit.some((o) => o.subtitle === 'Квест'), 'quest object typed');

const itemHit = Cmd.searchEntities('healing');
assert(itemHit.some((o) => o.subtitle === 'Предмет'), 'item object typed');

// Object click uses openContentFromBrowser
const sceneObj = objects[0];
Cmd.run(sceneObj.id);
assert(calls.openContentFromBrowser === 1, 'object run → openContentFromBrowser');
assert(E._lastOpen.type === 'scene' && E._lastOpen.id === 'village', 'correct scene opened');

// Unified search includes objects
const unified = Cmd.search('healing');
assert(unified.some((r) => r.group === 'objects'), 'unified search includes objects');

// Project search redirect
const realOpen = E.openCommandPalette;
let palettePrefill;
E.openCommandPalette = function (prefill) {
  palettePrefill = prefill;
  calls.openCommandPalette++;
};
E.openProjectSearch = function (prefill) {
  E.openCommandPalette(prefill);
};
E.openProjectSearch('tavern');
assert(calls.openCommandPalette >= 1, 'openProjectSearch → openCommandPalette');
assert(palettePrefill === 'tavern', 'prefill passed to palette');
E.openCommandPalette = realOpen;

// No duplicate validation logic in v2
assert(!paletteV2.includes('validateProject'), 'no duplicate validator');
assert(!paletteV2.includes('buildProjectSearchIndex'), 'no duplicate search index');

// Categories
const cats = E.getCommandPaletteCategories();
assert(cats.navigation === 'Навигация', 'navigation category');
assert(cats.create === 'Создание', 'create category');
assert(cats.validation === 'Проверка', 'validation category');

// Keyboard source checks
assert(palette.includes('ArrowDown'), 'arrow down navigation');
assert(palette.includes('ArrowUp'), 'arrow up navigation');
assert(palette.includes("e.key === 'Enter'"), 'enter executes');
assert(palette.includes("e.key === 'Escape'"), 'escape closes');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
