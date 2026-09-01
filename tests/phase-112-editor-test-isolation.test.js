#!/usr/bin/env node
/**
 * Phase 1.12 — Safe Preview & Editor Test Session Isolation
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
    setItem(k, v) { map.set(String(k), String(v)); },
    removeItem(k) { map.delete(k); },
    _map: map
  };
}

function loadKeys(ctx) {
  vm.runInContext(read('js/editor-test-keys.js'), ctx);
  return ctx.EditorTestKeys;
}

console.log('Phase 1.12 — static: no production writes from test launch');

{
  const fromHere = read('js/editor/editor-test-from-here.js');
  const playG = read('js/editor/editor-play-phase-g.js');
  const isolation = read('js/editor/editor-test-isolation-phase-112.js');
  const preview = read('js/editor-preview.js');
  assert(!fromHere.includes("setItem('melnitsa_game_data'"), 'test-from-here no melnitsa_game_data');
  assert(!playG.includes("setItem('melnitsa_game_data'"), 'play-g no melnitsa_game_data');
  assert(!isolation.includes("setItem('melnitsa_game_data'"), 'isolation no melnitsa_game_data');
  assert(!preview.includes("setItem('melnitsa_game_data'"), 'preview no melnitsa_game_data write');
  assert(read('editor.html').includes('editor-test-isolation-phase-112.js'), 'editor loads phase-112');
  assert(read('index.html').includes('editor-test-keys.js'), 'index loads keys');
  assert(read('js/editor-test-keys.js').includes('rpg_editor_test_data'), 'canonical rpg_editor_test_data');
}

console.log('\n1. preview writes test key');

{
  const local = mockStorage();
  const session = mockStorage();
  const ctx = {
    console,
    localStorage: local,
    sessionStorage: session,
    Editor: { data: { scenes: { a: { text: 'x' } }, classes: { f: {} } } }
  };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  loadKeys(ctx);
  vm.runInContext(read('js/editor/editor-test-isolation-phase-112.js'), ctx);
  ctx.Editor.prepareEditorTestLaunch({ mode: 'editor_test', sceneId: 'a', createdAt: 1 });
  assert(!!local.getItem('rpg_editor_test_data'), 'writes rpg_editor_test_data');
  assert(!!local.getItem('rpg_editor_test_session'), 'writes rpg_editor_test_session');
}

console.log('\n2. production key unchanged');

{
  const local = mockStorage();
  const session = mockStorage();
  const ctx = {
    console,
    localStorage: local,
    sessionStorage: session,
    Editor: { data: { scenes: { a: {} }, classes: { f: {} } } }
  };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  loadKeys(ctx);
  vm.runInContext(read('js/editor/editor-test-isolation-phase-112.js'), ctx);
  const prod = '{"production":true,"scenes":{}}';
  local.setItem('melnitsa_game_data', prod);
  local.setItem('melnitsa_save', '{"charName":"Hero"}');
  ctx.Editor.prepareEditorTestLaunch({ mode: 'editor_test', sceneId: 'a' });
  assert(local.getItem('melnitsa_game_data') === prod, 'melnitsa_game_data unchanged');
  assert(local.getItem('melnitsa_save') === '{"charName":"Hero"}', 'melnitsa_save unchanged');
}

console.log('\n3. preview save isolated');

(async () => {
  const local = mockStorage();
  const session = mockStorage();
  const ctx = {
    console,
    localStorage: local,
    sessionStorage: session,
    location: { search: '?editorTest=1', protocol: 'http:', href: 'http://x/?editorTest=1' },
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
      async launchCampaign() { this._launched = true; }
    }
  };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  loadKeys(ctx);
  vm.runInContext(read('js/editor-test-session.js'), ctx);

  assert(ctx.GameEngine.getSaveKey() === 'rpg_editor_test_save', 'test save key');
  assert(ctx.GameEngine.getDataCacheKey() === 'rpg_editor_test_data', 'test data key');

  console.log('\n4. normal runtime ignores test data');

  {
    const local2 = mockStorage();
    const session2 = mockStorage();
    local2.setItem('rpg_editor_test_data', JSON.stringify({
      scenes: { dirty: {} },
      classes: { x: {} }
    }));
    local2.setItem('melnitsa_game_data', JSON.stringify({
      scenes: { clean: {} },
      classes: { y: {} }
    }));
    const ctx2 = {
      console,
      localStorage: local2,
      sessionStorage: session2,
      location: { search: '', protocol: 'http:', href: 'http://x/' },
      setTimeout() { return 0; },
      setInterval() { return 0; },
      document: { readyState: 'complete', addEventListener() {}, getElementById: () => null, body: { style: {} } },
      GameEngine: {
        state: {},
        getActiveCampaign() { return { cacheKey: 'melnitsa_game_data', saveKey: 'melnitsa_save' }; },
        getSaveKey() { return 'melnitsa_save'; },
        getDataCacheKey() { return 'melnitsa_game_data'; },
        loadCachedGameData(key) {
          const raw = local2.getItem(key);
          return raw ? JSON.parse(raw) : null;
        },
        async fetchCampaignData(campaign) {
          return this.loadCachedGameData(campaign.cacheKey);
        },
        init() { this._normal = true; }
      }
    };
    ctx2.globalThis = ctx2;
    ctx2.window = ctx2;
    vm.createContext(ctx2);
    loadKeys(ctx2);
    vm.runInContext(read('js/editor-test-session.js'), ctx2);

    assert(ctx2.EditorTestKeys.isEditorTestContext() === false, 'no editorTest URL → not test context');
    assert(ctx2.GameEngine.getSaveKey() === 'melnitsa_save', 'normal save key');
    assert(ctx2.GameEngine.getDataCacheKey() === 'melnitsa_game_data', 'normal data key');
    const data = await ctx2.GameEngine.fetchCampaignData({ cacheKey: 'melnitsa_game_data' });
    assert(data.scenes.clean, 'normal fetch reads production');
    assert(!data.scenes.dirty, 'normal fetch ignores test data');
  }

  console.log('\n5. test runtime uses test data');

  {
    local.setItem('rpg_editor_test_data', JSON.stringify({
      scenes: { preview: { location: 'Edited' } },
      classes: { wanderer: { hp: 10 } }
    }));
    local.setItem('melnitsa_game_data', JSON.stringify({
      scenes: { production: {} },
      classes: { fighter: {} }
    }));
    session.setItem('rpg_editor_test_session', JSON.stringify({
      mode: 'editor_test',
      sceneId: 'preview',
      campaignId: 'melnitsa'
    }));

    const data = await ctx.GameEngine.fetchCampaignData({ cacheKey: 'melnitsa_game_data', id: 'melnitsa' });
    assert(data && data.scenes.preview, 'test fetch uses test data');
    assert(!data.scenes.production, 'test fetch does not use production');
  }

  console.log('\n6. exit does not destroy production data');

  {
    const local3 = mockStorage();
    const session3 = mockStorage();
    local3.setItem('rpg_editor_test_data', '{}');
    local3.setItem('rpg_editor_test_save', '{}');
    local3.setItem('rpg_editor_test_session', '{}');
    local3.setItem('melnitsa_game_data', '{"keep":1}');
    local3.setItem('melnitsa_save', '{"keep":2}');
    const ctx3 = {
      console,
      localStorage: local3,
      sessionStorage: session3,
      location: { search: '?editorTest=1', href: 'http://x/?editorTest=1' },
      setTimeout() { return 0; },
      setInterval() { return 0; },
      document: { readyState: 'complete', addEventListener() {}, getElementById: () => null, body: { style: {} } },
      GameEngine: {
        _editorTestMode: true,
        _editorTestSession: { mode: 'editor_test' },
        state: {},
        getSaveKey() { return 'melnitsa_save'; },
        getDataCacheKey() { return 'melnitsa_game_data'; }
      }
    };
    ctx3.globalThis = ctx3;
    ctx3.window = ctx3;
    vm.createContext(ctx3);
    loadKeys(ctx3);
    vm.runInContext(read('js/editor-test-session.js'), ctx3);

    ctx3.GameEngine.resetEditorTestStorage({});
    assert(!local3.getItem('rpg_editor_test_data'), 'test data cleared');
    assert(!local3.getItem('rpg_editor_test_save'), 'test save cleared');
    assert(local3.getItem('melnitsa_game_data') === '{"keep":1}', 'production data kept');
    assert(local3.getItem('melnitsa_save') === '{"keep":2}', 'production save kept');
  }

  console.log('\n7. restart resets test session correctly');

  {
    const local4 = mockStorage();
    const session4 = mockStorage();
    local4.setItem('rpg_editor_test_data', '{"scenes":{}}');
    local4.setItem('rpg_editor_test_save', '{"progress":1}');
    local4.setItem('rpg_editor_test_session', JSON.stringify({ mode: 'editor_test', sceneId: 'a' }));
    local4.setItem('melnitsa_save', '{"hero":1}');
    const ctx4 = {
      console,
      localStorage: local4,
      sessionStorage: session4,
      location: {
        search: '?editorTest=1',
        href: 'http://localhost/index.html?editorTest=1',
        protocol: 'http:'
      },
      setTimeout() { return 0; },
      setInterval() { return 0; },
      document: { readyState: 'complete', addEventListener() {}, getElementById: () => null, body: { style: {} } },
      URL: class {
        constructor(h) {
          this.href = h;
          this.searchParams = {
            _p: { editorTest: '1' },
            set(k, v) { this._p[k] = v; },
            toString() {
              return Object.keys(this._p).map((k) => k + '=' + this._p[k]).join('&');
            }
          };
        }
        toString() { return 'http://localhost/index.html?' + this.searchParams.toString(); }
      },
      GameEngine: {
        _editorTestMode: true,
        _editorTestSession: { mode: 'editor_test' },
        state: {},
        getSaveKey() { return 'melnitsa_save'; },
        getDataCacheKey() { return 'melnitsa_game_data'; }
      }
    };
    // Provide URL on ctx for restart
    ctx4.globalThis = ctx4;
    ctx4.window = ctx4;
    vm.createContext(ctx4);
    // Inject URL into vm global
    vm.runInContext('globalThis.URL = this.URL;', ctx4);
    loadKeys(ctx4);
    vm.runInContext(read('js/editor-test-session.js'), ctx4);

    let navigated = null;
    Object.defineProperty(ctx4, 'location', {
      value: {
        search: '?editorTest=1',
        href: 'http://localhost/index.html?editorTest=1',
        protocol: 'http:',
        set href(v) { navigated = v; },
        get href() { return 'http://localhost/index.html?editorTest=1'; },
        reload() { navigated = 'reload'; }
      },
      writable: true,
      configurable: true
    });
    // re-bind location after createContext — set on ctx4 for restart
    ctx4.location = {
      search: '?editorTest=1',
      href: 'http://localhost/index.html?editorTest=1',
      protocol: 'http:',
      set href(v) { navigated = v; },
      get href() { return 'http://localhost/index.html?editorTest=1'; },
      reload() { navigated = 'reload'; }
    };

    ctx4.GameEngine.resetEditorTestStorage({ saveOnly: true });
    assert(!local4.getItem('rpg_editor_test_save'), 'restart clears test save');
    assert(!!local4.getItem('rpg_editor_test_data'), 'restart keeps test data');
    assert(local4.getItem('melnitsa_save') === '{"hero":1}', 'production save untouched on restart');

    // clearTestSave via KEYS
    local4.setItem('rpg_editor_test_save', '{"again":1}');
    ctx4.EditorTestKeys.clearTestSave([local4, session4]);
    assert(!local4.getItem('rpg_editor_test_save'), 'clearTestSave works');
    assert(!!local4.getItem('rpg_editor_test_data'), 'data remains after clearTestSave');
  }

  console.log('\nLegacy compatibility: read old melnitsa_editor_test_data');

  {
    const local5 = mockStorage();
    local5.setItem('melnitsa_editor_test_data', JSON.stringify({
      scenes: { legacy: {} },
      classes: { c: {} }
    }));
    const ctx5 = { console, localStorage: local5, sessionStorage: mockStorage() };
    ctx5.globalThis = ctx5;
    ctx5.window = ctx5;
    vm.createContext(ctx5);
    const KEYS = loadKeys(ctx5);
    const data = KEYS.readTestData();
    assert(data && data.scenes.legacy, 'reads legacy test data key');
  }

  console.log('\nBanner / lifecycle APIs present');

  {
    const src = read('js/editor-test-session.js');
    assert(src.includes('EDITOR TEST MODE'), 'banner label');
    assert(src.includes('exitEditorTest'), 'exit API');
    assert(src.includes('restartEditorTest'), 'restart API');
    assert(src.includes('production cache intentionally NOT used'), 'no production fallback in test');
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Phase 1.12: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
