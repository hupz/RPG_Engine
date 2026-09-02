#!/usr/bin/env node
/**
 * Scene Assistant UI — сохранение ввода описания при перерисовке панели.
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

function makeInteractiveEl(id, tag) {
  const listeners = {};
  const el = {
    id,
    tagName: (tag || 'div').toUpperCase(),
    innerHTML: '',
    disabled: false,
    value: '',
    childNodes: [],
    addEventListener(type, fn) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(fn);
    },
    dispatchInput() {
      (listeners.input || []).forEach((fn) => fn());
    },
    dispatchBlur() {
      (listeners.blur || []).forEach((fn) => fn());
    },
    appendChild() {},
    insertBefore() {},
    setAttribute() {}
  };
  return el;
}

function bootAssistantUi(externalStorage) {
  const storage = externalStorage || mockStorage();
  const registry = {};
  const ASSISTANT_IDS = [
    'scene-assistant-input',
    'scene-assistant-draft-btn',
    'scene-assistant-apply-btn',
    'scene-assistant-preview'
  ];

  function registerPanelElements() {
    ASSISTANT_IDS.forEach((id) => {
      const tag = id === 'scene-assistant-input' ? 'textarea' : 'button';
      registry[id] = makeInteractiveEl(id, tag);
    });
  }

  const tabScenes = {
    id: 'tab-scenes',
    firstChild: null,
    insertBefore(el) {
      this.firstChild = el;
      registry['scene-assistant-mount'] = el;
    }
  };
  registry['tab-scenes'] = tabScenes;

  let mountEl = null;
  function ensureMountNode() {
    if (!mountEl) {
      mountEl = {
        id: 'scene-assistant-mount',
        _html: '',
        insertBefore() {},
        appendChild() {}
      };
      Object.defineProperty(mountEl, 'innerHTML', {
        set(v) {
          mountEl._html = v;
          registerPanelElements();
        },
        get() { return mountEl._html || ''; }
      });
    }
    return mountEl;
  }

  const Editor = {
    data: {
      scenes: { village: { id: 'village', location: 'Деревня' } }
    },
    currentScene: 'village',
    workspace: {},
    hooks: {
      _after: {},
      after(name, fn) {
        this._after[name] = this._after[name] || [];
        this._after[name].push(fn);
      }
    },
    toast: { success() {}, warning() {}, error() {}, info() {} },
    renderSceneList() {},
    renderSceneEditor() {},
    updateJSONPreview() {},
    switchTab() {},
    markDirty() {},
    ensureSceneEditorModules(s) { return s.editorModules || []; },
    templates: {
      _r: new Map(),
      register(t) { this._r.set(t.id, t); },
      list() { return [...this._r.values()]; },
      run() {}
    },
    slugifySceneId(name, existing) {
      let id = String(name || 'scene').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'new_scene';
      if (!existing[id]) return id;
      let n = 2;
      while (existing[id + '_' + n]) n++;
      return id + '_' + n;
    },
    createSceneWithWizard(name, intent) {
      if (!this.data.scenes) this.data.scenes = {};
      const id = this.slugifySceneId(name, this.data.scenes);
      const scene = { id, location: name };
      if (intent && intent.sceneType === 'combat') scene.combat = [];
      if (intent && intent.sceneType === 'dialog') scene.dialogue = [];
      this.data.scenes[id] = scene;
      this.currentScene = id;
      return id;
    }
  };

  const ctx = {
    Editor,
    console,
    document: {
      getElementById(id) {
        if (id === 'scene-assistant-mount') return ensureMountNode();
        return registry[id] || null;
      },
      createElement(tag) {
        if (tag === 'div') return ensureMountNode();
        return makeInteractiveEl('', tag);
      },
      head: { appendChild() {} },
      addEventListener() {}
    },
    localStorage: storage,
    globalThis: null,
    window: null,
    Object, Array, String, Math, Map, Set, JSON, RegExp,
    setTimeout(fn, ms) {
      if (typeof fn === 'function' && (ms === 300 || ms === 0)) fn();
    },
    clearTimeout() {}
  };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);

  vm.runInContext(read('js/actions/action-registry.js'), ctx);
  vm.runInContext(read('js/editor/editor-action-catalog.js'), ctx);
  vm.runInContext(read('js/editor/editor-condition-catalog.js'), ctx);
  vm.runInContext(read('js/editor/editor-scene-authoring-index.js'), ctx);
  vm.runInContext(read('js/editor/editor-scene-template-pack.js'), ctx);
  vm.runInContext(read('js/editor/editor-assistant.js'), ctx);
  vm.runInContext(read('js/editor/editor-assistant-ui.js'), ctx);

  return { Editor: ctx.Editor, storage, document: ctx.document, ASSISTANT_IDS };
}

function runTests() {
console.log('scene-assistant-draft.test.js');

const src = read('js/editor/editor-assistant-ui.js');
assert(src.includes('rpg_editor_scene_assistant'), 'localStorage key for scene assistant input');
assert(src.includes('scheduleSaveInput'), 'debounced input save');
assert(src.includes('readState().description'), 'restore description on render');

const { Editor, storage, document } = bootAssistantUi();
assert(typeof Editor.renderSceneAssistantPanel === 'function', 'renderSceneAssistantPanel exported');

const sample = 'Таверна — диалог с барменом; выбор — лес или деревня';

Editor.renderSceneAssistantPanel();
let input = document.getElementById('scene-assistant-input');
assert(!!input, 'textarea mounted');
input.value = sample;
input.dispatchInput();

Editor.renderSceneAssistantPanel();
input = document.getElementById('scene-assistant-input');
assert(input && input.value === sample, 'description survives panel re-mount');

assert(Editor.getSceneAssistantInputState().description === sample, 'workspace state matches input');
const stored = JSON.parse(storage.getItem('rpg_editor_scene_assistant'));
assert(stored.description === sample, 'description persisted to localStorage');

const sharedStorage = storage;
const reloaded = bootAssistantUi(sharedStorage);
reloaded.Editor.renderSceneAssistantPanel();
input = reloaded.document.getElementById('scene-assistant-input');
assert(input && input.value === sample, 'description restored after page reload simulation');

const plan = Editor.assistant.draftScene(sample);
assert(plan.ok, 'draft generation still works');
assert(typeof Editor.assistant.formatDraftDiff(plan) === 'string', 'formatDraftDiff still works');
assert(typeof plan.needsReviewCount === 'number', 'needsReviewCount still present');

const applyResult = Editor.assistant.applyDraft(plan);
assert(applyResult.ok, 'apply draft still works');

Editor.flushSceneAssistantInputSave('');
Editor.renderSceneAssistantPanel();
input = document.getElementById('scene-assistant-input');
assert(input && input.value === '', 'input cleared after explicit clear + re-render');
assert(storage.getItem('rpg_editor_scene_assistant') === JSON.stringify({ description: '' }), 'storage cleared');

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
