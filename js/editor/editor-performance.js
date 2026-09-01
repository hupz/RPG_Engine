// ============================================================
// Editor Performance (UI-23) — caches + debounce for large projects
// No schema/runtime/API changes.
// ============================================================
(function attachEditorPerformance() {
  'use strict';
  if (typeof Editor === 'undefined') return;

  const timers = Object.create(null);
  const DEBOUNCE_MS = {
    sceneListSearch: 200,
    projectSearch: 150,
    commandPalette: 120
  };

  function debounce(key, fn, waitMs) {
    return function debounced() {
      const args = arguments;
      const ctx = this;
      if (timers[key]) clearTimeout(timers[key]);
      timers[key] = setTimeout(() => {
        timers[key] = null;
        fn.apply(ctx, args);
      }, waitMs);
    };
  }

  function dataToken(data) {
    if (!data) return '0';
    const scenes = Object.keys(data.scenes || {}).length;
    const items = Object.keys(data.items || {}).length;
    const quests = Object.keys(data.quests || {}).length;
    return scenes + ':' + items + ':' + quests + ':' + (data.meta?.exportedAt || '');
  }

  function invalidateCaches() {
    Editor._perfSceneWarnings = null;
    Editor._perfProjectSearchIndex = null;
    Editor._perfContentBrowserIndex = null;
  }

  function getSceneWarningMap(data) {
    data = data || Editor.data;
    const token = dataToken(data);
    if (Editor._perfSceneWarnings && Editor._perfSceneWarnings.token === token) {
      return Editor._perfSceneWarnings.map;
    }
    const map = Object.create(null);
    if (typeof ProjectValidator !== 'undefined' && ProjectValidator.validateProject && data) {
      try {
        const report = ProjectValidator.validateProject(data);
        (report.issues || []).forEach((issue) => {
          if (issue.severity !== 'warning' && issue.level !== 'warning') return;
          const sid = issue.sceneId || issue.entityId;
          if (!sid) return;
          map[sid] = (map[sid] || 0) + 1;
        });
      } catch (e) { /* */ }
    }
    Editor._perfSceneWarnings = { token, map };
    return map;
  }

  function getSceneWarningCount(sceneId, data) {
    if (!sceneId) return 0;
    return getSceneWarningMap(data)[sceneId] || 0;
  }

  function getCachedProjectSearchIndex(buildFn) {
    const data = Editor.data;
    const token = dataToken(data);
    if (Editor._perfProjectSearchIndex && Editor._perfProjectSearchIndex.token === token) {
      return Editor._perfProjectSearchIndex.rows;
    }
    const rows = typeof buildFn === 'function' ? buildFn.call(Editor) : [];
    Editor._perfProjectSearchIndex = { token, rows };
    return rows;
  }

  function getCachedContentBrowserIndex(buildFn) {
    const data = Editor.data;
    const token = dataToken(data);
    if (Editor._perfContentBrowserIndex && Editor._perfContentBrowserIndex.token === token) {
      return Editor._perfContentBrowserIndex.rows;
    }
    const rows = typeof buildFn === 'function' ? buildFn() : [];
    Editor._perfContentBrowserIndex = { token, rows };
    return rows;
  }

  function scheduleSceneListRender() {
    if (typeof Editor.renderSceneListNow === 'function') {
      Editor.renderSceneListNow();
    } else if (typeof Editor.renderSceneList === 'function') {
      Editor.renderSceneList();
    }
  }

  const debouncedSceneListRender = debounce('sceneListSearch', scheduleSceneListRender, DEBOUNCE_MS.sceneListSearch);
  const debouncedProjectSearchRender = debounce('projectSearch', function () {
    if (typeof Editor._renderProjectSearchResultsInline === 'function') {
      Editor._renderProjectSearchResultsInline(Editor._searchQuery);
    }
  }, DEBOUNCE_MS.projectSearch);

  let paletteRenderFn = null;
  const debouncedPaletteRender = debounce('commandPalette', function () {
    if (typeof paletteRenderFn === 'function') paletteRenderFn();
  }, DEBOUNCE_MS.commandPalette);

  function registerPaletteRender(fn) {
    paletteRenderFn = fn;
  }

  function wrapRenderSceneList() {
    if (!Editor.renderSceneList || Editor._perfSceneListWrapped) return;
    Editor.renderSceneListNow = Editor.renderSceneList.bind(Editor);
    Editor._perfSceneListWrapped = true;
  }

  function installInvalidationHooks() {
    if (Editor._perfInvalidationHooks || !Editor.hooks?.after) return;
    Editor._perfInvalidationHooks = true;
    ['updateSceneField', 'updateJSONPreview', 'loadData', 'applyLoadedProject', 'exportJSON'].forEach((hook) => {
      Editor.hooks.after(hook, function () {
        invalidateCaches();
      }, 'editor-performance');
    });
  }

  const Perf = {
    DEBOUNCE_MS,
    debounce,
    invalidateCaches,
    getSceneWarningMap,
    getSceneWarningCount,
    getCachedProjectSearchIndex,
    getCachedContentBrowserIndex,
    debouncedSceneListRender,
    debouncedProjectSearchRender,
    debouncedPaletteRender,
    registerPaletteRender
  };

  Editor.Perf = Perf;
  Editor.invalidatePerfCaches = invalidateCaches;
  Editor.getSceneWarningCount = getSceneWarningCount;

  wrapRenderSceneList();
  installInvalidationHooks();

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-performance', Perf, { force: true });
  }

  console.info('[Editor.Perf] ready');
})();
