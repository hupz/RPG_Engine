// ============================================================
// Editor Test Session — ephemeral Preview from Editor
// Phase 1.12: isolated rpg_editor_test_* keys (never production cache/save)
// ============================================================
(function attachEditorTestSession() {
  'use strict';
  if (typeof GameEngine === 'undefined') return;

  const KEYS = typeof EditorTestKeys !== 'undefined'
    ? EditorTestKeys
    : {
      SESSION_KEY: 'rpg_editor_test_session',
      TEST_SAVE_KEY: 'rpg_editor_test_save',
      TEST_DATA_CACHE_KEY: 'rpg_editor_test_data',
      isEditorTestContext: () => false,
      isEditorTestUrl: () => false,
      readSession: () => null,
      readTestData: () => null,
      clearTestStorage: () => {},
      clearTestSave: () => {}
    };

  const TEST_SAVE_KEY = KEYS.TEST_SAVE_KEY || 'rpg_editor_test_save';

  function readSession() {
    return KEYS.readSession ? KEYS.readSession() : null;
  }

  function clearSession() {
    if (KEYS.clearTestStorage) KEYS.clearTestStorage();
  }

  function isEditorTestContext() {
    return KEYS.isEditorTestContext ? KEYS.isEditorTestContext() : false;
  }

  GameEngine._editorTestSession = null;
  GameEngine.isEditorTestMode = function isEditorTestMode() {
    return !!(this._editorTestMode || this._editorTestSession || isEditorTestContext());
  };

  const origGetSaveKey = GameEngine.getSaveKey?.bind(GameEngine);
  GameEngine.getSaveKey = function getSaveKeyPatched() {
    if (this.isEditorTestMode()) {
      return KEYS.getTestSaveKey ? KEYS.getTestSaveKey() : TEST_SAVE_KEY;
    }
    return origGetSaveKey ? origGetSaveKey() : 'melnitsa_save';
  };

  const origGetDataCacheKey = GameEngine.getDataCacheKey?.bind(GameEngine);
  GameEngine.getDataCacheKey = function getDataCacheKeyPatched() {
    if (this.isEditorTestMode()) {
      return KEYS.getTestDataCacheKey
        ? KEYS.getTestDataCacheKey(this.getActiveCampaign?.())
        : KEYS.TEST_DATA_CACHE_KEY;
    }
    return origGetDataCacheKey ? origGetDataCacheKey() : 'melnitsa_game_data';
  };

  const origFetchCampaignData = GameEngine.fetchCampaignData?.bind(GameEngine);
  if (origFetchCampaignData) {
    GameEngine.fetchCampaignData = async function fetchCampaignDataEditorTest(campaign) {
      if (isEditorTestContext()) {
        // Phase 1.12: never fall through to production cache while in editor test.
        if (KEYS.readTestData) {
          const fromKeys = KEYS.readTestData();
          if (fromKeys) return fromKeys;
        }
        const testKey = KEYS.getTestDataCacheKey
          ? KEYS.getTestDataCacheKey(campaign)
          : KEYS.TEST_DATA_CACHE_KEY;
        const cached = this.loadCachedGameData?.(testKey);
        if (cached) return cached;
        console.warn('[EditorTest] no isolated test data — production cache intentionally NOT used');
        return null;
      }
      return origFetchCampaignData(campaign);
    };
  }

  const origInit = GameEngine.init?.bind(GameEngine);
  if (origInit) {
    GameEngine.init = function initEditorTestRoute() {
      if (isEditorTestContext()) {
        this.initUI?.();
        const boot = async () => {
          try {
            const session = readSession();
            const campaignId = session?.campaignId || this.activeCampaignId || 'melnitsa';
            await this.launchCampaign(campaignId);
          } catch (e) {
            console.warn('[EditorTest] auto launch', e);
            this.log?.('Editor Test: нет test data. Запустите Test From Here снова.', 'log-damage');
            this.showCampaignPicker?.();
          }
        };
        boot();
        return;
      }
      return origInit();
    };
  }

  const origPersist = GameEngine.persistSave?.bind(GameEngine);
  if (origPersist) {
    GameEngine.persistSave = function persistSavePatched(opts) {
      if (this.isEditorTestMode()) {
        try {
          return origPersist.call(this, opts || {});
        } catch (e) {
          return false;
        }
      }
      return origPersist.call(this, opts);
    };
  }

  GameEngine.resetEditorTestStorage = function resetEditorTestStorage(opts) {
    opts = opts || {};
    if (opts.saveOnly) {
      if (KEYS.clearTestSave) KEYS.clearTestSave();
      else {
        try { localStorage.removeItem(TEST_SAVE_KEY); } catch (e) { /* */ }
      }
      return;
    }
    clearSession();
    this._editorTestMode = false;
    this._editorTestSession = null;
  };

  GameEngine.exitEditorTest = function exitEditorTest() {
    clearSession();
    this._editorTestMode = false;
    this._editorTestSession = null;
    try {
      if (window.opener && !window.opener.closed) {
        window.close();
        return;
      }
    } catch (e) { /* */ }
    window.location.href = 'editor.html';
  };

  GameEngine.restartEditorTest = function restartEditorTest() {
    // Keep test data + session; clear only test save; reload same URL
    if (KEYS.clearTestSave) KEYS.clearTestSave();
    else {
      try { localStorage.removeItem(TEST_SAVE_KEY); } catch (e) { /* */ }
    }
    this._editorTestMode = false;
    this._editorTestSession = null;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('editorTest', '1');
      url.searchParams.set('t', String(Date.now()));
      window.location.href = url.toString();
    } catch (e) {
      window.location.reload();
    }
  };

  GameEngine.applyEditorTestSession = function applyEditorTestSession(session) {
    if (!session || session.mode !== 'editor_test') return false;
    this._editorTestMode = true;
    this._editorTestSession = session;

    if (!this.state.charName) this.state.charName = session.charName || 'Тестер';
    if (!this.state.className) {
      const firstClass = Object.keys(this.data?.classes || {})[0] || 'fighter';
      this.state.className = session.className || firstClass;
      const cls = this.data?.classes?.[this.state.className];
      if (cls && !this.state.classData) {
        try {
          this.selectClass?.(this.state.className);
        } catch (e) {
          this.state.hp = cls.hp || 20;
          this.state.maxHp = cls.hp || 20;
          this.state.gold = session.gold != null ? session.gold : 50;
          this.state.inventory = Array.isArray(session.inventory)
            ? session.inventory.slice()
            : [...(cls.startingItems || [])];
        }
      }
    }
    if (session.gold != null) this.state.gold = session.gold;
    if (Array.isArray(session.inventory) && session.inventory.length) {
      this.state.inventory = session.inventory.slice();
    }
    if (session.flags && typeof session.flags === 'object') {
      this.state.flags = { ...(this.state.flags || {}), ...session.flags };
    }

    if (session.questId && typeof QuestRuntime !== 'undefined') {
      QuestRuntime.bind(this);
      const qid = session.questId;
      const stageIndex = Math.max(0, parseInt(session.stageIndex, 10) || 0);
      const store = QuestRuntime.ensureProgressStore();
      if (store) {
        store[qid] = {
          status: 'active',
          stageIndex,
          stages: {}
        };
        try {
          QuestRuntime.startQuest(qid, { stageIndex, silentLog: true, force: true });
          if (stageIndex > 0 && typeof QuestRuntime.setStage === 'function') {
            QuestRuntime.setStage(qid, stageIndex, { force: true, silentLog: true });
          }
        } catch (e) {
          console.warn('[EditorTest] quest setup', e);
        }
      }
    }

    this.showEditorTestBanner(session);

    document.getElementById('name-screen')?.classList.add('hidden');
    document.getElementById('class-screen')?.classList.add('hidden');
    document.getElementById('game-content')?.classList.remove('hidden');
    document.getElementById('start-screen')?.classList.add('hidden');

    const sceneId = session.sceneId
      || (session.questId && this.findSceneForQuest?.(session.questId))
      || this.getFirstStorySceneId?.();

    if (sceneId && this.data?.scenes?.[sceneId]) {
      this.showScene(sceneId, { forceRevisit: true });
    }

    this.updateUI?.();
    this.renderInv?.();
    return true;
  };

  GameEngine.showEditorTestBanner = function showEditorTestBanner(session) {
    let bar = document.getElementById('editor-test-banner');
    if (bar) {
      this.updateEditorTestBanner?.(session);
      bar.style.display = '';
      return;
    }
    bar = document.createElement('div');
    bar.id = 'editor-test-banner';
    bar.className = 'editor-test-banner';
    bar.setAttribute('role', 'status');
    document.body.appendChild(bar);
    document.body.style.paddingTop = '56px';
    this.updateEditorTestBanner(session);
    document.getElementById('editor-test-restart')?.addEventListener('click', () => {
      this.restartEditorTest();
    });
    document.getElementById('editor-test-exit-preview')?.addEventListener('click', () => {
      this.backToEditorFromTest();
    });
  };

  GameEngine.updateEditorTestBanner = function updateEditorTestBanner(session) {
    const bar = document.getElementById('editor-test-banner');
    if (!bar) return;
    session = session || this._editorTestSession || readSession() || {};
    const project = session.projectTitle || this.data?.meta?.title || this.data?.meta?.name || 'Project';
    const sceneId = session.sceneId || this.state?.currentScene || this.currentScene;
    const scene = sceneId ? (this.data?.scenes?.[sceneId] || null) : null;
    const sceneLabel = scene?.location || scene?.title || sceneId || '—';
    const esc = this.escapeHtml ? (s) => this.escapeHtml(String(s == null ? '' : s)) : (s) => String(s == null ? '' : s);
    bar.innerHTML =
      '<div class="etb-main">' +
      '<strong class="etb-mode">EDITOR TEST MODE</strong>' +
      '<span class="etb-meta">Project: <span class="etb-meta__value">' + esc(project) + '</span></span>' +
      '<span class="etb-meta">Current Scene: <span class="etb-meta__value">' + esc(sceneLabel) + '</span></span>' +
      '<span class="etb-hint">Isolated test — production save is not used</span>' +
      '</div>' +
      '<div class="etb-actions">' +
      '<button type="button" class="btn btn-secondary btn-sm" id="editor-test-restart">Restart</button>' +
      '<button type="button" class="btn btn-primary btn-sm" id="editor-test-exit-preview">Exit Preview</button>' +
      '</div>';
    document.getElementById('editor-test-restart')?.addEventListener('click', () => {
      this.restartEditorTest();
    });
    document.getElementById('editor-test-exit-preview')?.addEventListener('click', () => {
      this.backToEditorFromTest();
    });
  };

  GameEngine.backToEditorFromTest = function backToEditorFromTest() {
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.focus?.();
        window.close();
        return;
      }
    } catch (e) { /* */ }
    window.location.href = 'editor.html?restoreEditor=1';
  };

  GameEngine.tryConsumeEditorTestSession = function tryConsumeEditorTestSession() {
    if (!isEditorTestContext()) return false;
    const session = readSession();
    if (!session) return false;
    return this.applyEditorTestSession(session);
  };

  function isEmbeddedPlay() {
    try {
      const params = new URLSearchParams(window.location.search || '');
      return params.get('embedded') === '1' && window.parent !== window;
    } catch (e) {
      return false;
    }
  }

  GameEngine.emitPlayDebugEvent = function emitPlayDebugEvent(payload) {
    if (!payload || typeof payload !== 'object') return;
    try {
      if (isEmbeddedPlay()) {
        window.parent.postMessage({ channel: 'rpg_editor_play_debug', payload }, '*');
      }
    } catch (e) { /* */ }
  };

  function installPlayDebugHooks() {
    if (GameEngine._playDebugHooksInstalled) return;
    if (typeof GameEngine.runAction !== 'function') return;
    GameEngine._playDebugHooksInstalled = true;

    const origRun = GameEngine.runAction.bind(GameEngine);
    GameEngine.runAction = function runActionWithDebug(actionRef, params, ctx) {
      GameEngine.emitPlayDebugEvent({
        type: 'action',
        action: actionRef,
        params: params || {},
        source: (ctx && ctx.source) || null,
        sceneId: this.state?.currentScene || this.currentScene,
        nodeId: (ctx && ctx.nodeId) || null
      });
      return origRun(actionRef, params, ctx);
    };

    if (typeof GameEngine.showScene === 'function') {
      const origShow = GameEngine.showScene.bind(GameEngine);
      GameEngine.showScene = function showSceneWithDebug(sceneId, opts) {
        GameEngine.emitPlayDebugEvent({ type: 'scene', sceneId, source: 'showScene' });
        const result = origShow(sceneId, opts);
        if (this.isEditorTestMode?.()) {
          const session = this._editorTestSession || readSession();
          if (session) {
            session.sceneId = sceneId;
            this.updateEditorTestBanner?.(session);
          }
        }
        return result;
      };
    }
  }

  const applyEditorTestSessionCore = GameEngine.applyEditorTestSession;

  GameEngine.applyEditorTestSession = function applyEditorTestSessionWithDebug(session) {
    const ok = applyEditorTestSessionCore.call(this, session);
    setTimeout(installPlayDebugHooks, 0);
    setTimeout(installPlayDebugHooks, 200);
    if (isEmbeddedPlay()) {
      const bar = document.getElementById('editor-test-banner');
      if (bar) bar.style.display = 'none';
      document.body.style.paddingTop = '0';
    }
    return ok;
  };

  const boot = () => {
    try {
      if (isEditorTestContext()) {
        const tryApply = () => {
          if (!GameEngine.data) {
            setTimeout(tryApply, 100);
            return;
          }
          GameEngine.tryConsumeEditorTestSession();
          installPlayDebugHooks();
        };
        setTimeout(tryApply, 50);
      }
    } catch (e) {
      console.warn('[EditorTest]', e);
    }
    setInterval(installPlayDebugHooks, 500);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
