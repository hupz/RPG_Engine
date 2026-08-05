// Экспорт проекта: JSON (рабочий) и HTML (релизный), без сервера

(function attachEditorExport() {
  if (typeof Editor === 'undefined') {
    console.error('editor-export.js: Editor не определён');
    return;
  }

  const ENGINE_VERSION = '1.0.0';
  const FORMAT_VERSION = 1;
  const BACKUP_KEY = 'rpg_pre_export_backup';
  const MAX_HTML_BYTES = 3 * 1024 * 1024;

  const STANDALONE_CSS = [
    'css/theme.css',
    'css/dark-ui.css',
    'css/i18n.css',
    'css/style.css',
    'css/combat.css'
  ];

  const STANDALONE_HEAD_SCRIPTS = [
    'locales/ru.js',
    'locales/en.js',
    'js/i18n.js',
    'js/theme.js',
    'js/mobile-layout.js'
  ];

  const STANDALONE_BODY_SCRIPTS = [
    'js/data.js',
    'js/demo-pf2e.js',
    'js/patch-progression.js',
    'js/pf2e-mill-progression.js',
    'js/reputation-system.js',
    'js/achievements.js',
    'js/conditions.js',
    'js/quests.js',
    'js/enemy-scaling.js',
    'js/scene-templates.js',
    'js/world-hierarchy.js',
    'js/audio.js',
    'js/special-scenes.js',
    'js/systems/base-system.js',
    'js/systems/generic.js',
    'js/systems/dnd5e.js',
    'js/systems/pathfinder2e.js',
    'js/systems/registry.js',
    'js/sidebar-dock.js',
    'js/actions/action-registry.js',
    'js/actions/action-registry-v3.js',
    'js/actions/action-context.js',
    'js/actions/action-effects.js',
    'js/actions/action-chain-library.js',
    'js/components/component-base.js',
    'js/components/component-normalize.js',
    'js/scene-components.js',
    'js/components/component-panels.js',
    'js/components/service-menu.js',
    'js/components/trade-interface.js',
    'js/components/dialogue-tree.js',
    'js/components/interactive-panel.js',
    'js/components/component-handlers.js',
    'js/components/combat/CombatTimeline.js',
    'js/components/combat/CombatManager.js',
    'js/components/combat/CombatPosition.js',
    'js/components/combat/OpportunityAttack.js',
    'js/components/combat/EnemyTacticalAI.js',
    'js/components/combat/CombatLog.js',
    'js/campaign-covers.js',
    'js/engine/core.js',
    'js/engine/ui-renderer.js',
    'js/engine/inventory.js',
    'js/scene-elements.js',
    'js/engine/scene-manager.js',
    'js/engine/scene-element-runner.js',
    'js/engine/combat.js',
    'js/engine/dialog.js',
    'js/engine/save-load.js',
    'js/analytics.js',
    'js/components/combat/StatusManager.js',
    'js/crafting-ui.js',
    'js/actions/action-runner.js',
    'js/character-creation-sync.js',
    'js/combat-effects.js',
    'js/wild-shape.js',
    'js/transformation-system.js',
    'js/time-system.js',
    'js/climate-data.js',
    'js/season-system.js',
    'js/weather-system.js',
    'js/climate-system.js',
    'js/wait-panel.js',
    'js/character-creator.js',
    'js/scene-template-char-creation.js',
    'js/components/component-character-creator.js'
  ];

  const tr = (k, p) => (typeof t === 'function' ? t(k, p) : k);

  const FOLDER_EXPORT_FILES = [
    'index.html',
    'README.html',
    'CHANGELOG.md',
    'css/theme.css',
    'css/dark-ui.css',
    'css/i18n.css',
    'css/readme.css',
    'css/style.css',
    'css/combat.css',
    'js/i18n.js',
    'locales/ru.js',
    'locales/en.js',
    'locales/ru.json',
    'locales/en.json',
    'js/conditions.js',
    'js/patch-progression.js',
    'js/theme.js',
    'js/mobile-layout.js',
    'js/enemy-scaling.js',
    'js/audio.js',
    'js/special-scenes.js',
    'js/achievements.js',
    'js/analytics.js',
    'js/engine/core.js',
    'js/engine/ui-renderer.js',
    'js/engine/inventory.js',
    'js/scene-elements.js',
    'js/engine/scene-manager.js',
    'js/engine/scene-element-runner.js',
    'js/engine/combat.js',
    'js/engine/dialog.js',
    'js/engine/save-load.js'
  ];

  function escapeXmlTitle(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function slugifyFilename(title) {
    return String(title || 'project')
      .replace(/[^\wа-яёА-ЯЁ\-]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'project';
  }

  function buildInlineDataJs(data) {
    const json = JSON.stringify(data);
    return [
      '// Сгенерировано RPGengine (экспорт)',
      'var GAME_DATA_INLINE = ' + json + ';',
      'if (typeof window !== "undefined") window.GAME_DATA_INLINE = GAME_DATA_INLINE;'
    ].join('\n');
  }

  function prepareExportPayload(data) {
    if (typeof SceneElements !== 'undefined' && data?.scenes) {
      Object.values(data.scenes).forEach((s) => {
        if (s.elements?.length || s.onEnterElements?.length) SceneElements.syncElementsToLegacy(s);
      });
    }
    const payload = JSON.parse(JSON.stringify(data));
    payload.meta = payload.meta || {};
    payload.meta.exportedAt = new Date().toISOString();
    payload.meta.engineVersion = ENGINE_VERSION;
    payload._export = {
      format: 'rpgengine-project-json',
      formatVersion: FORMAT_VERSION,
      engineVersion: ENGINE_VERSION,
      exportedAt: payload.meta.exportedAt,
      title: payload.meta.title || ''
    };
    return payload;
  }

  function migrateProjectData(raw) {
    let data = raw;
    if (!data || typeof data !== 'object') {
      throw new Error(tr('editor.export.migrateNoObject'));
    }

    const fmtVer = data._export?.formatVersion || data.meta?.formatVersion || 0;
    if (fmtVer > FORMAT_VERSION) {
      console.warn('[export] Файл новее редактора (format', fmtVer, '), возможны несовместимости');
    }

    if (!data.meta || typeof data.meta !== 'object') data.meta = {};
    if (!data.scenes || typeof data.scenes !== 'object') data.scenes = {};

    if (fmtVer < 1 && !data.meta.engineVersion) {
      data.meta.engineVersion = data._export?.engineVersion || 'legacy';
    }

    if (typeof SpellSlotProgression !== 'undefined') SpellSlotProgression.applyToGameData(data);
    if (typeof QuestSystem !== 'undefined') QuestSystem.normalizeAll(data);
    if (typeof ThemeSystem !== 'undefined') ThemeSystem.ensureInData(data);
    if (typeof AchievementSystem !== 'undefined') AchievementSystem.ensureAchievements(data);
    if (typeof SceneElements !== 'undefined') SceneElements.migrateAllScenes(data);
    if (typeof Editor !== 'undefined' && typeof Editor.ensureMetaSystem === 'function') {
      Editor.ensureMetaSystem(data);
    }

    data.meta.formatVersion = FORMAT_VERSION;
    return data;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function savePreExportBackup(data) {
    try {
      const payload = prepareExportPayload(data);
      localStorage.setItem(BACKUP_KEY, JSON.stringify({
        label: 'pre-export-backup',
        savedAt: Date.now(),
        title: payload.meta?.title || tr('editor.export.defaultProject'),
        data: payload
      }));
      localStorage.setItem('melnitsa_game_data', JSON.stringify(payload, null, 2));
    } catch (e) {
      console.warn('[export] backup', e);
    }
  }

  async function fetchText(rel) {
    const url = new URL(rel, window.location.href);
    const res = await fetch(url);
    if (!res.ok) throw new Error(rel + ': HTTP ' + res.status);
    return await res.text();
  }

  async function fetchBinary(rel) {
    const url = new URL(rel, window.location.href);
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  }

  function ensureExportModal() {
    let modal = document.getElementById('editor-export-html-modal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'editor-export-html-modal';
    modal.className = 'modal-overlay hidden';
    const tr = (k) => (typeof t === 'function' ? t(k) : k);
    modal.innerHTML = `
      <div class="modal-box paper-sheet editor-export-modal-box" onclick="event.stopPropagation()">
        <h2 class="editor-export-modal-title">🌐 ${tr('editor.export.htmlModalTitle')}</h2>
        <p class="editor-export-modal-text">${tr('editor.export.htmlModalText')}</p>
        <p class="hint editor-export-modal-hint">${tr('editor.export.htmlModalHint')}</p>
        <div class="editor-export-modal-actions">
          <button type="button" class="btn btn-secondary" id="editor-export-html-cancel">${tr('editor.export.htmlCancel')}</button>
          <button type="button" class="btn btn-primary editor-export-modal-confirm" id="editor-export-html-confirm">${tr('editor.export.htmlConfirm')}</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) Editor.closeExportHtmlModal();
    });
    modal.querySelector('#editor-export-html-cancel').addEventListener('click', () => Editor.closeExportHtmlModal());
    modal.querySelector('#editor-export-html-confirm').addEventListener('click', () => Editor.confirmExportHTML());
    return modal;
  }

  function bindExportMenu() {
    const toggle = document.getElementById('export-menu-toggle');
    const menu = document.getElementById('export-menu-dropdown');
    if (!toggle || !menu || toggle._exportBound) return;
    toggle._exportBound = true;

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = menu.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      menu.classList.toggle('hidden', !open);
    });

    menu.querySelectorAll('[data-export]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.classList.remove('is-open');
        menu.classList.add('hidden');
        toggle.setAttribute('aria-expanded', 'false');
        const kind = btn.getAttribute('data-export');
        if (kind === 'json') Editor.exportJSON();
        else if (kind === 'html') Editor.openExportHtmlModal();
        else if (kind === 'folder') Editor.exportGameStandalone();
      });
    });

    document.addEventListener('click', () => {
      menu.classList.remove('is-open');
      menu.classList.add('hidden');
      toggle.setAttribute('aria-expanded', 'false');
    });
  }

  async function ensureDirHandle(parent, pathParts) {
    let h = parent;
    for (const name of pathParts) {
      h = await h.getDirectoryHandle(name, { create: true });
    }
    return h;
  }

  async function writeToRootDir(rootDir, relativePath, contents) {
    const parts = relativePath.split('/').filter(Boolean);
    const fileName = parts.pop();
    const parent = parts.length ? await ensureDirHandle(rootDir, parts) : rootDir;
    const fh = await parent.getFileHandle(fileName, { create: true });
    const w = await fh.createWritable();
    if (typeof contents === 'string') await w.write(contents);
    else await w.write(contents instanceof Uint8Array ? contents : new Uint8Array(contents));
    await w.close();
  }

  function collectAudioPaths(data) {
    const paths = new Set();
    const audio = data?.audio;
    if (!audio) return [];
    const add = (p) => {
      if (!p || typeof p !== 'string') return;
      const n = p.replace(/^\.\//, '').replace(/\\/g, '/').trim();
      if (n && !n.startsWith('http:') && !n.startsWith('https:') && !n.startsWith('//')) paths.add(n);
    };
    for (const entry of Object.values(audio.catalog || {})) {
      if (entry && typeof entry === 'object') {
        add(entry.file);
        add(entry.path);
      }
    }
    const maps = [audio.defaults?.damageType, audio.defaults?.effectType, audio.defaults?.attack];
    for (const map of maps) {
      if (!map || typeof map !== 'object') continue;
      for (const sid of Object.values(map)) {
        if (!sid || typeof sid !== 'string') continue;
        const cat = audio.catalog?.[sid];
        if (cat && typeof cat === 'object') {
          add(cat.file);
          add(cat.path);
        }
      }
    }
    return [...paths].sort();
  }

  function patchIndexHtml(html, title) {
    if (!title) return html;
    return html.replace(/<title>[\s\S]*?<\/title>/i, '<title>' + escapeXmlTitle(title) + '</title>');
  }

  async function buildStandaloneHtml(data) {
    const title = data.meta?.title || tr('editor.export.defaultGame');
    let shell = await fetchText('index.html');

    shell = patchIndexHtml(shell, title);
    shell = shell.replace(/<link rel="stylesheet" href="css\/[^"]+">\s*/gi, '');
    shell = shell.replace(/<script src="js\/theme\.js"><\/script>\s*/i, '');
    shell = shell.replace(/<script src="js\/mobile-layout\.js"><\/script>\s*/i, '');

    const cssParts = await Promise.all(STANDALONE_CSS.map(fetchText));
    const cssBlock = cssParts.join('\n\n');

    const headScripts = await Promise.all(STANDALONE_HEAD_SCRIPTS.map(fetchText));
    const headInline = headScripts.map((s) => '<script>\n' + s + '\n</script>').join('\n');

    const bodyScripts = [];
    for (const rel of STANDALONE_BODY_SCRIPTS) {
      const content = rel === 'js/data.js' ? buildInlineDataJs(data) : await fetchText(rel);
      bodyScripts.push('<script>\n' + content + '\n</script>');
    }

    const bootScript = `<script>
document.addEventListener('DOMContentLoaded', function () {
  if (typeof ThemeSystem !== 'undefined') {
    ThemeSystem.initAppTheme();
    ThemeSystem.registerToggleButton(document.getElementById('game-theme-toggle'));
  }
});
</script>`;

    const scriptBlockRe = /<script src="[^"]+"><\/script>\s*/gi;
    const endScriptsRe = /<div id="ui-tooltip"><\/div>\s*<script>[\s\S]*?<\/script>\s*(?=<\/body>)/i;

    shell = shell.replace(scriptBlockRe, '');
    shell = shell.replace(endScriptsRe, '<div id="ui-tooltip"></div>\n');

    const styleInject = `<style id="rpg-inline-css">\n${cssBlock}\n</style>\n${headInline}\n`;
    shell = shell.replace('</head>', styleInject + '</head>');

    shell = shell.replace('</body>', bodyScripts.join('\n') + '\n' + bootScript + '\n</body>');

    return shell;
  }

  Object.assign(Editor, {
    ENGINE_VERSION,
    EXPORT_FORMAT_VERSION: FORMAT_VERSION,

    migrateProjectData,

    applyLoadedProject(data, options = {}) {
      const migrated = migrateProjectData(data);
      this.data = migrated;

      if (typeof this.ensureWorldMap === 'function') this.ensureWorldMap();
      if (typeof this.ensureCraftingData === 'function') this.ensureCraftingData();
      if (typeof this.ensureSnippets === 'function') this.ensureSnippets();
      if (typeof this.applyThemeFromData === 'function') this.applyThemeFromData();

      this.currentScene = Object.keys(this.data.scenes || {})[0] || null;

      try {
        localStorage.setItem('melnitsa_game_data', JSON.stringify(this.data, null, 2));
      } catch (_) { /* ignore */ }

      if (typeof CampaignCovers !== 'undefined') CampaignCovers.clearAllCoverCaches();
      if (typeof this.invalidateProjectCoverCache === 'function') this.invalidateProjectCoverCache();

      this.renderAll();
      this.updateProjectPanel();
      this.updateJSONPreview();
      if (typeof this.refreshDashboardIfVisible === 'function') this.refreshDashboardIfVisible();
      if (options.showDashboard !== false && typeof this.showDashboard === 'function') this.showDashboard();

      if (!options.silent) {
        alert('✅ ' + tr('editor.export.loadOk', { title: this.data.meta?.title || '—' }));
      }
    },

    exportJSON() {
      if (!this.data) {
        alert(tr('editor.export.noData'));
        return;
      }
      const payload = prepareExportPayload(this.data);
      const json = JSON.stringify(payload, null, 2);
      try {
        localStorage.setItem('melnitsa_game_data', json);
      } catch (_) { /* ignore */ }

      const filename = slugifyFilename(payload.meta?.title) + '.json';
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      downloadBlob(blob, filename);

      if (typeof this.invalidateProjectCoverCache === 'function') this.invalidateProjectCoverCache();
      if (typeof this.showToast === 'function') {
        this.showToast('✅ ' + tr('editor.export.jsonSavedToast', { filename }));
      } else {
        alert('✅ ' + tr('editor.export.fileSavedAlert', { filename }));
      }
    },

    exportData() {
      return this.exportJSON();
    },

    openExportHtmlModal() {
      if (!this.data) {
        alert(tr('editor.export.noData'));
        return;
      }
      const modal = ensureExportModal();
      modal.classList.remove('hidden');
      modal.classList.add('open');
    },

    closeExportHtmlModal() {
      const modal = document.getElementById('editor-export-html-modal');
      if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('open');
      }
    },

    async confirmExportHTML() {
      this.closeExportHtmlModal();
      await this.exportHTML();
    },

    async exportHTML() {
      if (!this.data) {
        alert(tr('editor.export.noData'));
        return;
      }

      savePreExportBackup(this.data);

      try {
        const payload = prepareExportPayload(this.data);
        const html = await buildStandaloneHtml(payload);
        const bytes = new Blob([html]).size;

        if (bytes > MAX_HTML_BYTES) {
          const mb = (bytes / (1024 * 1024)).toFixed(2);
          const ok = confirm(tr('editor.export.htmlTooLarge', { mb }));
          if (!ok) return;
        }

        const filename = slugifyFilename(payload.meta?.title) + '.html';
        downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), filename);

        const saveJsonToo = confirm(tr('editor.export.htmlDone', { filename }));
        if (saveJsonToo) this.exportJSON();
      } catch (e) {
        console.error(e);
        alert('❌ ' + tr('editor.export.htmlBuildFail', {
          message: e && e.message ? e.message : String(e)
        }));
      }
    },

    async exportGameStandalone() {
      if (!this.data) {
        alert(tr('editor.export.noData'));
        return;
      }
      if (typeof window.showDirectoryPicker !== 'function') {
        alert(tr('editor.export.folderUnsupported'));
        return;
      }
      let rootDir;
      try {
        rootDir = await window.showDirectoryPicker({ mode: 'readwrite' });
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        alert('❌ ' + tr('editor.export.folderPickFail', {
          message: e && e.message ? e.message : String(e)
        }));
        return;
      }

      const title = this.data.meta?.title || tr('editor.export.defaultGame');
      const payload = prepareExportPayload(this.data);
      try {
        await writeToRootDir(rootDir, 'js/data.js', buildInlineDataJs(payload));

        for (const rel of FOLDER_EXPORT_FILES) {
          let text = await fetchText(rel);
          if (rel === 'index.html') text = patchIndexHtml(text, title);
          await writeToRootDir(rootDir, rel, text);
        }

        const audioPaths = collectAudioPaths(payload);
        for (const rel of audioPaths) {
          const buf = await fetchBinary(rel);
          if (!buf) continue;
          await writeToRootDir(rootDir, rel, buf);
        }

        alert(tr('editor.export.folderDone'));
      } catch (e) {
        console.error(e);
        alert('❌ ' + tr('editor.export.exportError', {
          message: e && e.message ? e.message : String(e)
        }));
      }
    },

    tryRestorePreExportBackup() {
      if (this.data) return;
      let raw;
      try {
        raw = localStorage.getItem(BACKUP_KEY);
      } catch (_) {
        return;
      }
      if (!raw) return;

      let backup;
      try {
        backup = JSON.parse(raw);
      } catch (_) {
        return;
      }
      if (!backup?.data || backup.label !== 'pre-export-backup') return;

      const when = backup.savedAt
        ? (typeof I18n !== 'undefined' ? I18n.formatDate(backup.savedAt) : new Date(backup.savedAt).toLocaleString())
        : tr('editor.export.recently');
      const title = backup.title || backup.data?.meta?.title || tr('editor.export.defaultProject');

      if (confirm(tr('editor.export.backupRestore', { title, when }))) {
        this.applyLoadedProject(backup.data, { silent: false });
      }
    }
  });

  window.EditorExport = {
    ENGINE_VERSION,
    FORMAT_VERSION,
    migrateProjectData,
    prepareExportPayload,
    buildStandaloneHtml
  };

  document.addEventListener('DOMContentLoaded', () => {
    bindExportMenu();
    setTimeout(() => Editor.tryRestorePreExportBackup(), 400);
  });
})();
