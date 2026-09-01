/**
 * Phase 1.12 — Editor test storage keys (shared Editor + runtime)
 *
 * Canonical (multi-campaign safe):
 *   rpg_editor_test_data / rpg_editor_test_save / rpg_editor_test_session
 *
 * Legacy (read-compatible, write no longer uses):
 *   melnitsa_editor_test_data / melnitsa_editor_test_save / melnitsa_editor_test_session
 *
 * Production (NEVER written by Test From Here):
 *   melnitsa_game_data / melnitsa_save  (+ per-campaign CAMPAIGNS.*.cacheKey/saveKey)
 */
(function attachEditorTestKeys(global) {
  'use strict';

  const SESSION_KEY = 'rpg_editor_test_session';
  const TEST_SAVE_KEY = 'rpg_editor_test_save';
  const TEST_DATA_CACHE_KEY = 'rpg_editor_test_data';

  const LEGACY_SESSION_KEY = 'melnitsa_editor_test_session';
  const LEGACY_SAVE_KEY = 'melnitsa_editor_test_save';
  const LEGACY_DATA_CACHE_KEY = 'melnitsa_editor_test_data';

  /** Production melnitsa cache — do NOT write from editor test flows */
  const PRODUCTION_MELNITSA_CACHE_KEY = 'melnitsa_game_data';
  const PRODUCTION_MELNITSA_SAVE_KEY = 'melnitsa_save';

  function queryParam(search, name) {
    if (!search) return null;
    const q = String(search).replace(/^\?/, '');
    if (typeof URLSearchParams !== 'undefined') {
      return new URLSearchParams(q).get(name);
    }
    const parts = q.split('&');
    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i];
      if (!seg) continue;
      const eq = seg.indexOf('=');
      const k = decodeURIComponent(eq >= 0 ? seg.slice(0, eq) : seg);
      if (k === name) {
        return decodeURIComponent(eq >= 0 ? seg.slice(eq + 1) : '');
      }
    }
    return null;
  }

  function isEditorTestUrl(loc) {
    try {
      const search = (loc && loc.search) || (typeof global.location !== 'undefined' ? global.location.search : '');
      return queryParam(search || '', 'editorTest') === '1';
    } catch (e) {
      return false;
    }
  }

  function readRaw(store, key) {
    try {
      return store.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function parseSession(raw) {
    if (!raw) return null;
    try {
      const s = JSON.parse(raw);
      if (s && s.mode === 'editor_test') return s;
    } catch (e) { /* */ }
    return null;
  }

  function readSession(storage) {
    const stores = storage || [global.sessionStorage, global.localStorage].filter(Boolean);
    for (let i = 0; i < stores.length; i++) {
      const store = stores[i];
      const s = parseSession(readRaw(store, SESSION_KEY))
        || parseSession(readRaw(store, LEGACY_SESSION_KEY));
      if (s) return s;
    }
    return null;
  }

  /**
   * Test mode is URL-gated so leftover session keys never hijack normal Mill play.
   */
  function isEditorTestContext() {
    return isEditorTestUrl();
  }

  function getTestDataCacheKey(/* campaign */) {
    return TEST_DATA_CACHE_KEY;
  }

  function getTestSaveKey() {
    return TEST_SAVE_KEY;
  }

  /** Read test project JSON: canonical first, then legacy test key (never production). */
  function readTestData(storage) {
    const store = storage || global.localStorage;
    if (!store) return null;
    const raw = readRaw(store, TEST_DATA_CACHE_KEY) || readRaw(store, LEGACY_DATA_CACHE_KEY);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      if (data && typeof data === 'object' && data.scenes) return data;
    } catch (e) { /* */ }
    return null;
  }

  function writeTestData(payload, storage) {
    const store = storage || global.localStorage;
    if (!store) return;
    store.setItem(TEST_DATA_CACHE_KEY, typeof payload === 'string' ? payload : JSON.stringify(payload));
  }

  function writeSession(session, stores) {
    const list = stores || [global.sessionStorage, global.localStorage].filter(Boolean);
    const json = typeof session === 'string' ? session : JSON.stringify(session);
    list.forEach((store) => {
      try {
        store.setItem(SESSION_KEY, json);
      } catch (e) { /* */ }
    });
  }

  function clearTestStorage(storage) {
    const stores = storage || [global.sessionStorage, global.localStorage].filter(Boolean);
    const keys = [
      SESSION_KEY, TEST_SAVE_KEY, TEST_DATA_CACHE_KEY,
      LEGACY_SESSION_KEY, LEGACY_SAVE_KEY, LEGACY_DATA_CACHE_KEY
    ];
    stores.forEach((store) => {
      keys.forEach((k) => {
        try { store.removeItem(k); } catch (e) { /* */ }
      });
    });
  }

  /** Clear only test save (keep test data + session for Restart). */
  function clearTestSave(storage) {
    const stores = storage || [global.sessionStorage, global.localStorage].filter(Boolean);
    stores.forEach((store) => {
      try {
        store.removeItem(TEST_SAVE_KEY);
        store.removeItem(LEGACY_SAVE_KEY);
      } catch (e) { /* */ }
    });
  }

  const api = {
    SESSION_KEY,
    TEST_SAVE_KEY,
    TEST_DATA_CACHE_KEY,
    LEGACY_SESSION_KEY,
    LEGACY_SAVE_KEY,
    LEGACY_DATA_CACHE_KEY,
    PRODUCTION_MELNITSA_CACHE_KEY,
    PRODUCTION_MELNITSA_SAVE_KEY,
    isEditorTestUrl,
    readSession,
    isEditorTestContext,
    getTestDataCacheKey,
    getTestSaveKey,
    readTestData,
    writeTestData,
    writeSession,
    clearTestStorage,
    clearTestSave
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof global !== 'undefined') {
    global.EditorTestKeys = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global);
