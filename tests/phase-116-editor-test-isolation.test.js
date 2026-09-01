#!/usr/bin/env node
/**
 * Phase 1.16 (superseded by Phase 1.12) — isolation smoke against current keys
 * Canonical keys: rpg_editor_test_*
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log('  ✓', msg);
  } else {
    failed++;
    console.error('  ✗', msg);
  }
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

function loadEditorTestKeys(ctx) {
  vm.runInContext(read('js/editor-test-keys.js'), ctx);
  return ctx.EditorTestKeys;
}

console.log('Phase 1.16→1.12 — static: no production cache writes');

{
  const isolation = read('js/editor/editor-test-isolation-phase-112.js');
  assert(!isolation.includes("setItem('melnitsa_game_data'"), 'isolation avoids melnitsa_game_data');
  assert(read('editor.html').includes('editor-test-isolation-phase-112.js'), 'editor loads isolation module');
  assert(read('index.html').includes('editor-test-keys.js'), 'index loads editor-test-keys');
}

console.log('\nPhase 1.16→1.12 — prepareEditorTestLaunch writes test key only');

{
  const local = mockStorage();
  const session = mockStorage();
  const ctx = {
    console,
    localStorage: local,
    sessionStorage: session,
    Editor: { data: { scenes: { a: {} }, classes: { fighter: {} }, meta: {} } }
  };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  loadEditorTestKeys(ctx);
  vm.runInContext(read('js/editor/editor-test-isolation-phase-112.js'), ctx);

  const prodBefore = '{"production":true}';
  local.setItem('melnitsa_game_data', prodBefore);
  local.setItem('melnitsa_save', '{"charName":"Hero"}');

  ctx.Editor.prepareEditorTestLaunch({ mode: 'editor_test', sceneId: 'a', createdAt: 1 });

  assert(local.getItem('rpg_editor_test_data'), 'test data key written');
  assert(local.getItem('melnitsa_game_data') === prodBefore, 'production cache unchanged');
  assert(local.getItem('melnitsa_save') === '{"charName":"Hero"}', 'production save unchanged');
  assert(session.getItem('rpg_editor_test_session') || local.getItem('rpg_editor_test_session'), 'session written');
}

console.log('\nPhase 1.16→1.12 — runtime routing');

(async () => {
  const local = mockStorage();
  const session = mockStorage();
  const ctx = {
    console,
    localStorage: local,
    sessionStorage: session,
    location: { search: '?editorTest=1', protocol: 'http:' },
    setTimeout() { return 0; },
    setInterval() { return 0; },
    document: {
      readyState: 'complete',
      addEventListener() {},
      getElementById: () => null,
      createElement: () => ({ style: {}, setAttribute() {}, innerHTML: '', addEventListener() {} }),
      body: { appendChild() {}, style: {} }
    },
    GameEngine: {
      state: {},
      getActiveCampaign() { return { cacheKey: 'melnitsa_game_data', saveKey: 'melnitsa_save', id: 'melnitsa' }; },
      getSaveKey() { return 'melnitsa_save'; },
      getDataCacheKey() { return 'melnitsa_game_data'; },
      loadCachedGameData(key) {
        const raw = local.getItem(key);
        return raw ? JSON.parse(raw) : null;
      },
      async fetchCampaignData(campaign) {
        return this.loadCachedGameData(campaign.cacheKey);
      },
      init() { this._initCalled = true; },
      initUI() {},
      async launchCampaign() { this._launched = true; },
      showCampaignPicker() {}
    }
  };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  loadEditorTestKeys(ctx);
  vm.runInContext(read('js/editor-test-session.js'), ctx);

  assert(ctx.GameEngine.getSaveKey() === 'rpg_editor_test_save', 'test mode uses test save key');
  assert(ctx.GameEngine.getDataCacheKey() === 'rpg_editor_test_data', 'test mode uses test data key');

  local.setItem('rpg_editor_test_data', JSON.stringify({
    scenes: { intro: { location: 'Test' } },
    classes: { fighter: { hp: 10 } },
    meta: {}
  }));

  ctx.GameEngine.init();
  assert(ctx.GameEngine._launched === true, 'editorTest URL skips picker and launches');

  const data = await ctx.GameEngine.fetchCampaignData({ cacheKey: 'melnitsa_game_data', id: 'melnitsa' });
  assert(data.scenes.intro, 'fetchCampaignData prefers test cache');

  console.log('\nPhase 1.16→1.12 — missing test data safe (no production read)');

  {
    const local4 = mockStorage();
    const ctx4 = {
      console,
      localStorage: local4,
      sessionStorage: mockStorage(),
      location: { search: '?editorTest=1', protocol: 'http:' },
      setTimeout() { return 0; },
      setInterval() { return 0; },
      document: { readyState: 'complete', addEventListener() {}, getElementById: () => null, body: { style: {} } },
      GameEngine: {
        getActiveCampaign() { return { cacheKey: 'melnitsa_game_data', saveKey: 'melnitsa_save' }; },
        getSaveKey() { return 'melnitsa_save'; },
        getDataCacheKey() { return 'melnitsa_game_data'; },
        loadCachedGameData(key) {
          const raw = local4.getItem(key);
          return raw ? JSON.parse(raw) : null;
        },
        async fetchCampaignData(campaign) {
          return this.loadCachedGameData(campaign.cacheKey);
        }
      }
    };
    ctx4.globalThis = ctx4;
    ctx4.window = ctx4;
    vm.createContext(ctx4);
    loadEditorTestKeys(ctx4);
    vm.runInContext(read('js/editor-test-session.js'), ctx4);
    local4.setItem('melnitsa_game_data', JSON.stringify({ scenes: { x: {} }, classes: { f: {} } }));
    const fallback = await ctx4.GameEngine.fetchCampaignData({ cacheKey: 'melnitsa_game_data' });
    assert(fallback == null, 'missing test data does not read production');
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Phase 1.16 (aligned 1.12): ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
