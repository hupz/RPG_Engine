// ============================================================
// Editor Boot Smoke Test — ранняя диагностика API, без автофиксов
// ============================================================
// Подключать ПОСЛЕДНИМ среди editor-модулей.
//
// Editor.debugBoot()  — таблица Module / Loaded / Registered / API
// Editor.runBootSmokeTest({ silent?: boolean }) — ручной повтор
// ============================================================
(function editorBootSmoke() {
  'use strict';

  /** Обязательный API → ожидаемый модуль-владелец (для сообщения) */
  const REQUIRED_API = [
    { path: 'Editor', check: () => typeof Editor !== 'undefined', provider: 'editor.html (const Editor)' },
    { path: 'Editor.hooks', check: () => typeof Editor !== 'undefined' && Editor.hooks && typeof Editor.hooks.after === 'function', provider: 'js/editor/editor-hooks.js' },
    { path: 'Editor.renderAll', check: () => typeof Editor?.renderAll === 'function', provider: 'editor.html / editor-core-tabs.js' },
    { path: 'Editor.renderClasses', check: () => typeof Editor?.renderClasses === 'function', provider: 'js/editor/editor-classes.js (+ class-skills replace)' },
    { path: 'Editor.renderItems', check: () => typeof Editor?.renderItems === 'function', provider: 'js/editor/editor-items-panel.js' },
    { path: 'Editor.renderQuests', check: () => typeof Editor?.renderQuests === 'function', provider: 'js/editor/editor-quests.js' },
    { path: 'Editor.renderSceneEditor', check: () => typeof Editor?.renderSceneEditor === 'function', provider: 'js/editor/editor-scene-builder.js' },
    { path: 'Editor.renderItemBonusesEditor', check: () => typeof Editor?.renderItemBonusesEditor === 'function', provider: 'js/editor/editor-items-panel.js' },
    { path: 'Editor.getClassAbilityOptions', check: () => typeof Editor?.getClassAbilityOptions === 'function', provider: 'js/editor/editor-progression-panel.js' },
    { path: 'Editor.switchTab', check: () => typeof Editor?.switchTab === 'function', provider: 'editor.html / editor-core-tabs.js' },
    // Официальные имена save/load в текущей архитектуре:
    { path: 'Editor.loadData', check: () => typeof Editor?.loadData === 'function', provider: 'editor.html / editor-data-load.js' },
    { path: 'Editor.exportJSON', check: () => typeof Editor?.exportJSON === 'function', provider: 'js/editor-export.js (сохранение проекта)' },
    { path: 'Editor.isUiDesignSystemActive', check: () => typeof Editor?.isUiDesignSystemActive === 'function', provider: 'js/editor/editor-design-system.js (UI-10)' },
    { path: 'Editor.applyUiShellClasses', check: () => typeof Editor?.applyUiShellClasses === 'function', provider: 'js/editor/editor-design-system.js (UI-10)' }
  ];

  /** Модули, которые должны быть в document (по src) */
  const EXPECTED_SCRIPTS = [
    { id: 'editor-hooks', srcPart: 'js/editor/editor-hooks.js' },
    { id: 'editor-items-panel', srcPart: 'js/editor/editor-items-panel.js' },
    { id: 'editor-progression-panel', srcPart: 'js/editor/editor-progression-panel.js' },
    { id: 'editor-classes', srcPart: 'js/editor/editor-classes.js' },
    { id: 'editor-class-skills', srcPart: 'js/editor/editor-class-skills.js' },
    { id: 'editor-quests', srcPart: 'js/editor/editor-quests.js' },
    { id: 'editor-scene-builder', srcPart: 'js/editor/editor-scene-builder.js' },
    { id: 'editor-design-system', srcPart: 'js/editor/editor-design-system.js' },
    { id: 'editor-export', srcPart: 'js/editor-export.js' },
    { id: 'editor-data-load', srcPart: 'js/editor/editor-data-load.js' }
  ];

  function scriptLoaded(srcPart) {
    if (typeof document === 'undefined') return false;
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const s = scripts[i].getAttribute('src') || '';
      if (s.indexOf(srcPart) !== -1) return true;
    }
    return false;
  }

  function collectMissing() {
    const missing = [];
    for (const item of REQUIRED_API) {
      let ok = false;
      try {
        ok = !!item.check();
      } catch (e) {
        ok = false;
      }
      if (!ok) missing.push(item);
    }
    return missing;
  }

  function formatBootError(missing) {
    const lines = ['EDITOR BOOT ERROR', ''];
    for (const m of missing) {
      lines.push('Missing API:');
      lines.push('  ' + m.path);
      lines.push('Expected provider:');
      lines.push('  ' + m.provider);
      lines.push('Possible cause:');
      lines.push('  module not loaded or registration failed');
      lines.push('');
    }
    return lines.join('\n');
  }

  function detectDuplicateScripts() {
    if (typeof document === 'undefined') return [];
    const counts = Object.create(null);
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const s = (scripts[i].getAttribute('src') || '').split('?')[0];
      if (!s) continue;
      counts[s] = (counts[s] || 0) + 1;
    }
    return Object.keys(counts).filter((k) => counts[k] > 1).map((k) => ({ src: k, count: counts[k] }));
  }

  /**
   * Таблица: Module | Loaded (script) | Registered (hooks owner) | API ok
   */
  function buildBootTable() {
    const owners = (typeof Editor !== 'undefined' && Editor.hooks && typeof Editor.hooks.listOwners === 'function')
      ? Editor.hooks.listOwners()
      : {};
    const rows = [];

    for (const mod of EXPECTED_SCRIPTS) {
      const loaded = scriptLoaded(mod.srcPart);
      const registeredKeys = Object.keys(owners).filter((k) => owners[k] === mod.id || String(owners[k]).indexOf(mod.id) !== -1);
      rows.push({
        module: mod.id,
        src: mod.srcPart,
        loaded: loaded,
        registered: registeredKeys.length ? registeredKeys.join(', ') : '—',
        api: '—'
      });
    }

    for (const item of REQUIRED_API) {
      let ok = false;
      try { ok = !!item.check(); } catch (e) { ok = false; }
      const owner = (item.path.indexOf('Editor.') === 0 && Editor.hooks?.getOwner)
        ? Editor.hooks.getOwner(item.path.slice('Editor.'.length))
        : null;
      rows.push({
        module: item.path,
        src: item.provider,
        loaded: ok ? 'API ok' : 'MISSING',
        registered: owner || '—',
        api: ok ? 'function' : 'missing'
      });
    }

    return rows;
  }

  function runBootSmokeTest(opts) {
    const silent = !!(opts && opts.silent);
    const missing = collectMissing();
    const dupScripts = detectDuplicateScripts();
    const result = {
      ok: missing.length === 0,
      missing: missing.map((m) => m.path),
      duplicateScripts: dupScripts,
      owners: (typeof Editor !== 'undefined' && Editor.hooks?.listOwners) ? Editor.hooks.listOwners() : null
    };

    if (dupScripts.length && !silent) {
      console.warn('[Editor Boot] Duplicate script includes:', dupScripts);
    }

    if (missing.length) {
      const msg = formatBootError(missing);
      if (!silent) {
        console.error(msg);
        if (typeof document !== 'undefined') {
          try {
            let banner = document.getElementById('editor-boot-error-banner');
            if (!banner) {
              banner = document.createElement('div');
              banner.id = 'editor-boot-error-banner';
              banner.setAttribute('role', 'alert');
              banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#4a1515;color:#ffeaea;padding:12px 16px;font:13px/1.4 ui-monospace,monospace;white-space:pre-wrap;max-height:40vh;overflow:auto;border-top:3px solid #c62828;';
              document.body.appendChild(banner);
            }
            banner.textContent = msg + '\n(см. console; Editor.debugBoot() для таблицы)';
          } catch (e) { /* ignore DOM */ }
        }
      }
    } else if (!silent) {
      console.info('[Editor Boot] Smoke OK — required API present');
    }

    return result;
  }

  function debugBoot() {
    const rows = buildBootTable();
    console.table(rows.map((r) => ({
      Module: r.module,
      Loaded: r.loaded,
      Registered: r.registered,
      API: r.api
    })));
    const smoke = runBootSmokeTest({ silent: true });
    console.info('[Editor.debugBoot] smoke.ok =', smoke.ok, 'missing =', smoke.missing);
    if (smoke.duplicateScripts.length) {
      console.warn('[Editor.debugBoot] duplicate scripts', smoke.duplicateScripts);
    }
    if (typeof Editor !== 'undefined' && Editor.hooks?.listOwners) {
      console.info('[Editor.debugBoot] owners', Editor.hooks.listOwners());
    }
    return { rows: rows, smoke: smoke };
  }

  if (typeof Editor === 'undefined') {
    console.error('EDITOR BOOT ERROR\nMissing API:\n  Editor\nExpected provider:\n  editor.html\nPossible cause:\n  Editor object not created before boot smoke');
    return;
  }

  Editor.runBootSmokeTest = runBootSmokeTest;
  Editor.debugBoot = debugBoot;

  // Автозапуск после полной загрузки страницы (все sync-скрипты уже выполнены)
  function schedule() {
    try {
      runBootSmokeTest({ silent: false });
    } catch (e) {
      console.error('EDITOR BOOT ERROR\nBoot smoke itself failed:', e);
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      // microtask: после текущего sync-хвоста
      setTimeout(schedule, 0);
    } else {
      document.addEventListener('DOMContentLoaded', function () {
        setTimeout(schedule, 0);
      });
    }
  } else {
    schedule();
  }
})();
