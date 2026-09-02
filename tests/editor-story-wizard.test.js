#!/usr/bin/env node
/**
 * P4.1 — StoryWizard FSM, persistence, newProject routing.
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

function mockStorage() {
  const map = new Map();
  return {
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(k, String(v)); },
    removeItem(k) { map.delete(k); },
    _map: map
  };
}

function bootI18n(ctx, lang) {
  const ru = JSON.parse(fs.readFileSync(path.join(root, 'locales/ru.json'), 'utf8'));
  const en = JSON.parse(fs.readFileSync(path.join(root, 'locales/en.json'), 'utf8'));
  const primary = lang === 'en' ? en : ru;
  const fallback = ru;
  function nestedGet(obj, key) {
    return String(key).split('.').reduce((o, p) => (o && o[p] !== undefined ? o[p] : undefined), obj);
  }
  function t(key, params) {
    let val = nestedGet(primary, key);
    if (val == null) val = nestedGet(fallback, key);
    if (val == null) return String(key);
    if (params && typeof params === 'object') {
      Object.entries(params).forEach(([k, v]) => {
        val = val.replace(new RegExp('\\{' + k + '\\}', 'g'), String(v ?? ''));
      });
    }
    return val;
  }
  ctx.t = t;
  ctx.I18n = { t, _strings: primary, _fallback: fallback, _loaded: true, _lang: lang || 'ru' };
}

function bootCampaignWizard(extra) {
  const storage = mockStorage();
  const Editor = {
    data: null,
    currentScene: null,
    escapeHtml(s) { return String(s ?? ''); },
    escapeAttr(s) { return String(s ?? '').replace(/"/g, '&quot;'); },
    toast: { success() {}, warning() {}, error() {}, info() {} },
    confirmDialog: async () => true,
    renderAll() {},
    updateProjectPanel() {},
    updateJSONPreview() {},
    applyThemeFromData() {},
    createDnd5eStarterProject(title, system) {
      return {
        meta: { title, system: system || 'dnd5e' },
        startScene: 'start',
        scenes: { start: { id: 'start', location: 'Start', text: '', choices: [] } }
      };
    },
    applyProjectSettings(patch) {
      if (!this.data) return;
      if (!this.data.meta) this.data.meta = {};
      if (patch.title != null) this.data.meta.title = patch.title;
    },
    openNewProjectModal() { this._blankModalOpened = true; }
  };
  Object.assign(Editor, extra || {});

  const ctx = {
    Editor,
    console,
    document: {
      getElementById() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      createElement() {
        return {
          id: '', className: '', innerHTML: '', style: {},
          appendChild() {}, addEventListener() {}, remove() {},
          classList: { add() {}, remove() {} }
        };
      },
      head: { appendChild() {} },
      body: { appendChild() {} },
      readyState: 'complete',
      addEventListener() {}
    },
    localStorage: storage,
    SystemRegistry: { getDefault() { return 'dnd5e'; }, list() { return [{ id: 'dnd5e', label: 'D&D 5e' }]; } },
    globalThis: null,
    window: null,
    JSON, Object, Array, String, Math, Date, Set, Map,
    setTimeout(fn) { if (typeof fn === 'function') fn(); }
  };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  bootI18n(ctx, 'ru');
  vm.createContext(ctx);
  vm.runInContext(read('js/editor/editor-scene-template-pack.js'), ctx);
  vm.runInContext(read('js/editor/editor-story-wizard-content.js'), ctx);
  vm.runInContext(read('js/editor/editor-quest-wizard.js'), ctx);
  vm.runInContext(read('js/editor/editor-story-wizard-heroes-quest.js'), ctx);
  vm.runInContext(read('js/editor/editor-campaign-wizard.js'), ctx);
  return { Editor: ctx.Editor, storage, Fsm: ctx.StoryWizardFsm };
}

console.log('editor-story-wizard.test.js');

const src = read('js/editor/editor-campaign-wizard.js');
const newProj = read('js/editor-new-project.js');
assert(src.includes('StoryWizardFsm'), 'StoryWizard FSM in campaign-wizard');
assert(src.includes('openStoryWizard'), 'openStoryWizard API');
assert(src.includes('finishStoryWizard'), 'finishStoryWizard API');
assert(src.includes('rpg_editor_story_wizard'), 'storage key prefix rpg_editor_');
assert(src.includes('openCampaignWizard'), 'legacy campaign wizard preserved');
assert(src.includes('finishCampaignWizard'), 'legacy finish preserved');
assert(newProj.includes('openStoryWizard'), 'newProject routes to StoryWizard');
assert(newProj.includes('newBlankProject'), 'secondary blank project path');

const { Editor, storage, Fsm } = bootCampaignWizard();
assert(!!Fsm, 'StoryWizardFsm global');
assert(Fsm.STEPS.length === 5, 'five steps');
assert(Fsm.isSkippable(2) && Fsm.isSkippable(3), 'heroes and quest skippable');
assert(!Fsm.isSkippable(0), 'genre not skippable');
assert(Fsm.isLastStep(4), 'step 5 is last');

const state = Fsm.createState(2);
state.draft.title = 'Тест';
Fsm.save(state, storage);
const loaded = Fsm.load(storage);
assert(loaded && loaded.step === 2, 'persisted step survives reload');
assert(loaded.draft.title === 'Тест', 'persisted draft');
Fsm.clear(storage);
assert(!Fsm.load(storage), 'clear removes state');

Editor._storyWizardState = Fsm.createState(0);
Editor._storyWizardStep = 0;
Editor._storyWizardPreSnapshot = null;
const r = Editor._commitStoryWizardStep(0);
assert(r.ok, 'genre step commits');
assert(Editor.data && Editor.data.meta.title, 'project via createDnd5eStarterProject');
assert(Editor._storyWizardState.draft.projectInitialized, 'projectInitialized flag');

Editor._storyWizardStep = 0;
Editor.storyWizardNext();
assert(Editor._storyWizardStep === 1, 'next advances step');
Editor.saveStoryWizardState();
assert(storage.getItem('rpg_editor_story_wizard'), 'saveStoryWizardState writes storage');

Editor._storyWizardStep = 2;
Editor._storyWizardState.step = 2;
Editor.storyWizardSkip();
assert(Editor._storyWizardStep === 3, 'skip from heroes to quest');

Editor.finishStoryWizard();
assert(!Fsm.load(storage), 'finish clears storage');

Editor._storyWizardState = Fsm.createState(1);
Editor._storyWizardState.draft.projectInitialized = true;
Editor._storyWizardPreSnapshot = null;
Editor.data = { meta: { title: 'X' }, scenes: { start: {} } };
assert(Editor._hasStoryWizardCreatedEntities(), 'detects created project');
Editor._rollbackStoryWizardCreated();
assert(Editor.data === null, 'rollback restores null snapshot');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
