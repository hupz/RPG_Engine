#!/usr/bin/env node
/**
 * P4.2 — StoryWizard genre presets + world skeleton generation.
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

function bootStack() {
  const Editor = {
    data: null,
    currentScene: null,
    shopInventories: {},
    enemies: {},
    npcs: {},
    items: {},
    renderAll() {},
    updateProjectPanel() {},
    updateJSONPreview() {},
    applyThemeFromData() {},
    createDnd5eStarterProject(title, system) {
      return {
        meta: { title, system: system || 'generic', version: '1.0', author: '' },
        system: system || 'generic',
        startScene: 'start',
        scenes: {
          start: { id: 'start', location: 'Start', text: '', choices: [], gold: 0 }
        },
        items: {},
        npcs: {},
        quests: {},
        enemies: {},
        classes: {}
      };
    },
    slugifySceneId(name, existing) {
      const TR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
      let s = String(name || '').trim().toLowerCase();
      s = s.split('').map((ch) => TR[ch] || ch).join('');
      s = s.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'scene';
      if (!/^[a-z]/.test(s)) s = 'id_' + s;
      const taken = new Set(Object.keys(existing || {}));
      let out = s;
      let n = 2;
      while (taken.has(out)) { out = s + '_' + n; n++; }
      return out;
    }
  };

  const ctx = {
    Editor,
    console,
    document: { getElementById() { return null; }, querySelector() { return null; }, createElement() { return { appendChild() {}, addEventListener() {}, classList: { add() {}, remove() {} } }; }, head: { appendChild() {} }, body: { appendChild() {} }, addEventListener() {} },
    localStorage: { _m: new Map(), getItem(k) { return this._m.get(k) || null; }, setItem(k, v) { this._m.set(k, v); }, removeItem(k) { this._m.delete(k); } },
    globalThis: null,
    window: null,
    module: { exports: {} },
    JSON, Object, Array, String, Math, Date, Set, Map,
    setTimeout(fn) { if (typeof fn === 'function') fn(); }
  };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  bootI18n(ctx, 'ru');
  vm.createContext(ctx);
  vm.runInContext(read('js/editor/editor-scene-template-pack.js'), ctx);
  vm.runInContext(read('js/editor/editor-story-wizard-content.js'), ctx);
  vm.runInContext(read('js/actions/action-registry.js'), ctx);
  vm.runInContext(read('js/editor/editor-action-catalog.js'), ctx);
  vm.runInContext(read('js/editor/editor-condition-catalog.js'), ctx);
  vm.runInContext(read('js/editor/editor-project-validator.js'), ctx);
  return { Editor: ctx.Editor, SW: ctx.StoryWizardContent, PV: ctx.ProjectValidator, REG: ctx.ACTION_REGISTRY };
}

console.log('editor-story-wizard-world.test.js');

assert(read('editor.html').includes('editor-story-wizard-content.js'), 'content module wired');

const { Editor, SW, PV, REG } = bootStack();
assert(SW.listGenrePresets().length >= 4, 'four genre presets');
assert(SW.listWorldSkeletons().length === 3, 'three world skeletons');

const draft = {
  title: 'Тест',
  genre: 'fantasy',
  system: 'generic',
  skeletonId: 'hub_branches',
  projectInitialized: false,
  worldApplied: false,
  worldEdited: false,
  worldSceneIds: []
};

const g = SW.applyGenrePresetToProject(Editor, draft);
assert(g.ok, 'genre preset applies');
assert(Editor.data.meta.storyGenre === 'fantasy', 'storyGenre meta');
assert(Editor.data.meta.coverColor, 'cover color');
assert(Editor.data.meta.storyBalance?.gold > 0, 'starting gold');
assert(draft.projectInitialized, 'project initialized');

['hub_branches', 'linear_road', 'ready_village'].forEach((skel) => {
  draft.skeletonId = skel;
  draft.worldApplied = false;
  draft.worldSceneIds = [];
  const r = SW.applyWorldSkeletonToProject(Editor, draft);
  assert(r.ok, 'skeleton applies: ' + skel);
  assert(r.sceneIdList.length >= 4, skel + ' has 4+ scenes');
  assert(Editor.data.startScene && Editor.data.scenes[Editor.data.startScene], skel + ' startScene valid');
  r.sceneIdList.forEach((id) => {
    assert(/^[a-z][a-z0-9_]*$/.test(id), 'translit slug: ' + id);
  });
  const vr = SW.validateWorldProject(Editor, REG);
  if (!vr.ok) {
    console.error('    validation errors:', (vr.errors || []).slice(0, 5).map((e) => e.message));
  }
  assert(vr.ok, skel + ' passes ProjectValidator');
});

// regenerate does not duplicate (same skeleton)
draft.skeletonId = 'hub_branches';
draft.worldApplied = true;
draft.worldEdited = false;
SW.applyWorldSkeletonToProject(Editor, draft);
const countBefore = Object.keys(Editor.data.scenes).length;
const sceneCount = draft.worldSceneIds.length;
SW.applyWorldSkeletonToProject(Editor, draft);
const countAfter = Object.keys(Editor.data.scenes).length;
assert(countAfter === countBefore, 'regenerate does not duplicate scenes (' + countBefore + ' vs ' + countAfter + ')');
assert(draft.worldSceneIds.length === sceneCount, 'same scene count after regenerate');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
