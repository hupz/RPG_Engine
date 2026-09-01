// ============================================================
// P4.5 — Уровни редактора: Писатель / Картограф / Инженер
// (миграция бывшего Writer Mode + Advanced Mode)
// ============================================================
(function attachEditorWriterMode() {
  if (typeof Editor === 'undefined') {
    console.warn('editor-writer-mode.js: Editor не определён');
    return;
  }

  const GLOBAL_STORAGE_KEY = 'rpg_editor_mode';
  const PER_PROJECT_PREFIX = 'rpg_editor_level_';
  const LEVELS = Object.freeze(['writer', 'cartographer', 'engineer']);

  /**
   * МАТРИЦА ВИДИМОСТИ (P4.5)
   * Уровни управляют только UI; данные и поведение проекта одинаковы.
   *
   * | Ресурс / поверхность              | writer | cartographer | engineer |
   * |-----------------------------------|--------|--------------|----------|
   * | Вкладки WRITER_TAB_IDS            |   ✓    |      ✓       |    ✓     |
   * | Вкладки ENGINEER_ONLY (баланс…)  |        |              |    ✓     |
   * | Поля билдера P1.5 (flags, adv…)   |   ✓    |      ✓       |          |
   * | Карта в workspace сцен            |        |      ✓       |    ✓     |
   * | Чеклист структуры сюжета (P2.5)   |        |      ✓       |    ✓     |
   * | Мягкие подсказки по истории (P4.6)|   ✓    |      ✓       |    ✓     |
   * | Разметка этапа сюжета на сцене    |        |      ✓       |    ✓     |
   * | JSON, события входа, отладка      |        |              |    ✓     |
   *
   * Legacy: localStorage writer→writer, advanced/full→engineer.
   * isWriterMode() = writer | cartographer (авторские поля).
   * isAdvancedMode() = engineer (обратная совместимость).
   */
  const WRITER_TAB_IDS = new Set([
    'dashboard',
    'scenes',
    'scene_templates',
    'quests',
    'npcs', 'player_characters',
    'items',
    'enemies',
    'world',
    'worldmap',
    'graph',
    'audio',
    'media',
    'variables',
    'prefabs',
    'snippets',
    'achievements',
    'game_ui'
  ]);

  const ENGINEER_ONLY_TAB_IDS = new Set([
    'classes', 'abilities', 'races', 'progression', 'balance', 'beasts',
    'actions', 'climate', 'json', 'reputation', 'analytics', 'theme',
    'ingredients', 'recipes'
  ]);

  const FEATURE_MATRIX = Object.freeze({
    'author.simple_fields': { writer: true, cartographer: true, engineer: false },
    'story.map_workspace': { writer: false, cartographer: true, engineer: true },
    'story.structure_checklist': { writer: false, cartographer: true, engineer: true },
    'story.guidance_hints': { writer: true, cartographer: true, engineer: true },
    'story.phase_edit': { writer: false, cartographer: true, engineer: true },
    'tabs.engineer': { writer: false, cartographer: false, engineer: true }
  });

  const LEVEL_LABELS = Object.freeze({
    writer: '✏️ Писатель',
    cartographer: '🗺️ Картограф',
    engineer: '⚙️ Инженер'
  });

  const LEVEL_HINTS = Object.freeze({
    writer: 'Текст сцен, выборы, квесты и персонажи — без технических панелей.',
    cartographer: 'Писатель + карта истории в рабочей области и чеклист связности.',
    engineer: 'Полный доступ: JSON, баланс, флаги, события входа и отладка.'
  });

  function normalizeLevel(mode) {
    const m = String(mode == null ? 'writer' : mode).toLowerCase();
    if (m === 'cartographer' || m === 'cartograph') return 'cartographer';
    if (m === 'engineer' || m === 'advanced' || m === 'full') return 'engineer';
    return 'writer';
  }

  function isAuthorLevel(level) {
    return level === 'writer' || level === 'cartographer';
  }

  function ensureLevelStyles() {
    if (typeof document === 'undefined' || document.getElementById('editor-level-styles')) return;
    const st = document.createElement('style');
    st.id = 'editor-level-styles';
    st.textContent = `
      .editor-level-switch {
        display: inline-flex; align-items: stretch; border-radius: 8px;
        border: 1px solid var(--border, #ccc); overflow: hidden; background: var(--surface, #fff);
      }
      .editor-level-switch__btn {
        border: 0; background: transparent; padding: 6px 10px; font-size: 12px;
        cursor: pointer; color: var(--ink, #222); white-space: nowrap;
      }
      .editor-level-switch__btn:hover { background: var(--surface-hover, #f5f5f5); }
      .editor-level-switch__btn.is-active {
        background: var(--accent, #8b4513); color: #fff;
      }
      .editor-level-switch__btn + .editor-level-switch__btn {
        border-left: 1px solid var(--border, #ccc);
      }
      body.editor-cartographer-mode .editor-nav-writer-badge::after { content: ' · карта'; }
    `;
    document.head.appendChild(st);
  }

  function ensureHeaderLevelSwitcher() {
    if (typeof document === 'undefined') return null;
    ensureLevelStyles();
    let wrap = document.getElementById('editor-level-switch');
    if (!wrap) {
      const header = document.querySelector('.header-buttons');
      if (!header) return null;
      wrap = document.createElement('div');
      wrap.id = 'editor-level-switch';
      wrap.className = 'editor-level-switch';
      wrap.setAttribute('role', 'group');
      wrap.setAttribute('aria-label', 'Уровень редактора');
      LEVELS.forEach((level) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'editor-level-switch__btn';
        btn.dataset.editorLevel = level;
        btn.textContent = LEVEL_LABELS[level].replace(/^[^\s]+\s/, '');
        btn.title = LEVEL_HINTS[level];
        btn.addEventListener('click', () => {
          Editor.applyEditorLevel(level);
        });
        wrap.appendChild(btn);
      });
      const validateBtn = header.querySelector('[onclick*="runProjectValidation"]');
      if (validateBtn) header.insertBefore(wrap, validateBtn);
      else header.appendChild(wrap);
    }
    return wrap;
  }

  const api = {
    editorMode: 'writer',

    getEditorLevels() {
      return [...LEVELS];
    },

    getEditorLevel() {
      return normalizeLevel(this.editorMode);
    },

    getEditorLevelLabel(level) {
      level = normalizeLevel(level || this.getEditorLevel());
      return LEVEL_LABELS[level] || LEVEL_LABELS.writer;
    },

    getEditorLevelProjectKey() {
      if (typeof this.getStoryWorkspaceProjectKey === 'function') {
        return this.getStoryWorkspaceProjectKey();
      }
      const d = this.data || {};
      return String(d.meta?.id || d.meta?.title || d.projectId || 'default');
    },

    readStoredEditorLevel() {
      let stored = null;
      try {
        const pk = PER_PROJECT_PREFIX + this.getEditorLevelProjectKey();
        stored = localStorage.getItem(pk);
        if (!stored) stored = localStorage.getItem(GLOBAL_STORAGE_KEY);
      } catch (e) { /* private mode */ }
      return normalizeLevel(stored || 'writer');
    },

    writeStoredEditorLevel(level) {
      level = normalizeLevel(level);
      try {
        const pk = PER_PROJECT_PREFIX + this.getEditorLevelProjectKey();
        localStorage.setItem(pk, level);
        localStorage.setItem(GLOBAL_STORAGE_KEY, level === 'engineer' ? 'advanced' : level);
      } catch (e) { /* */ }
    },

    getWriterTabIds() {
      return [...WRITER_TAB_IDS];
    },

    getAdvancedTabIds() {
      return [...ENGINEER_ONLY_TAB_IDS];
    },

    getEditorVisibilityMatrix() {
      return {
        tabs: {
          writer: [...WRITER_TAB_IDS],
          engineerOnly: [...ENGINEER_ONLY_TAB_IDS]
        },
        features: FEATURE_MATRIX
      };
    },

    isEditorFeatureVisible(featureId) {
      const level = this.getEditorLevel();
      const row = FEATURE_MATRIX[featureId];
      if (!row) return true;
      return !!row[level];
    },

    isWriterMode() {
      return isAuthorLevel(this.getEditorLevel());
    },

    isCartographerMode() {
      return this.getEditorLevel() === 'cartographer';
    },

    isEngineerMode() {
      return this.getEditorLevel() === 'engineer';
    },

    isAdvancedMode() {
      return this.isEngineerMode();
    },

    isTabVisibleInEditorMode(tabId) {
      if (this.isEngineerMode()) return true;
      return WRITER_TAB_IDS.has(tabId);
    },

    getEditorModeToggleLabel() {
      const level = this.getEditorLevel();
      if (level === 'writer') return '⚙️ Advanced Mode';
      if (level === 'cartographer') return '⚙️ Инженер';
      return '✏️ Writer Mode';
    },

    updateEditorModeToggleButton() {
      const level = this.getEditorLevel();
      const legacy = document.getElementById('editor-mode-toggle');
      if (legacy) {
        legacy.hidden = !!document.getElementById('editor-level-switch');
        if (!legacy.hidden) {
          legacy.textContent = this.getEditorModeToggleLabel();
          legacy.classList.toggle('btn-info', level === 'engineer');
          legacy.classList.toggle('btn-secondary', level !== 'engineer');
          legacy.setAttribute('aria-pressed', level === 'writer' ? 'true' : 'false');
        }
      }
      const wrap = ensureHeaderLevelSwitcher();
      if (wrap) {
        wrap.querySelectorAll('[data-editor-level]').forEach((btn) => {
          const on = btn.dataset.editorLevel === level;
          btn.classList.toggle('is-active', on);
          btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      }
      const badge = document.getElementById('editor-nav-writer-badge');
      if (badge) {
        badge.textContent = this.getEditorLevelLabel(level);
        badge.hidden = false;
      }
    },

    _applyEditorLevelBodyClasses(level) {
      if (typeof document === 'undefined') return;
      const author = isAuthorLevel(level);
      document.body.classList.toggle('editor-writer-mode', author);
      document.body.classList.toggle('editor-cartographer-mode', level === 'cartographer');
      document.body.classList.toggle('editor-engineer-mode', level === 'engineer');
      document.body.classList.toggle('editor-advanced-mode', level === 'engineer');
      document.body.dataset.editorLevel = level;
    },

    _applyEditorLevelTabVisibility(level) {
      if (typeof document === 'undefined') return;
      const engineer = level === 'engineer';
      document.querySelectorAll('.tab[data-tab-id]').forEach((el) => {
        const id = el.dataset.tabId;
        const visible = engineer || WRITER_TAB_IDS.has(id);
        el.classList.toggle('tab--mode-hidden', !visible);
        el.setAttribute('aria-hidden', visible ? 'false' : 'true');
      });
      const tabsBar = document.querySelector('.tabs-bar');
      if (tabsBar) tabsBar.classList.toggle('tabs-bar--writer', !engineer);
    },

    _refreshEditorLevelChrome() {
      if (typeof this.applySceneWorkspaceView === 'function') {
        try { this.applySceneWorkspaceView(); } catch (e) { /* */ }
      }
      const tab = this.currentTab;
      if (tab === 'scenes' && typeof this.renderSceneEditor === 'function') {
        try { this.renderSceneEditor(); } catch (e) { /* */ }
      } else if (tab === 'graph' && typeof this.renderStoryGraphPanel === 'function') {
        try { this.renderStoryGraphPanel(); } catch (e) { /* */ }
      }
    },

    applyEditorLevel(level, opts) {
      return this.applyEditorMode(level, opts);
    },

    applyEditorMode(mode, opts) {
      if (this._applyingEditorLevel) return this.getEditorLevel();
      opts = opts || {};
      const level = normalizeLevel(mode);
      const prev = this.getEditorLevel();
      if (level === prev && !opts.force) {
        this.updateEditorModeToggleButton();
        return level;
      }

      this._applyingEditorLevel = true;
      try {
        this.editorMode = level;
        this._applyEditorLevelBodyClasses(level);
        this._applyEditorLevelTabVisibility(level);
        this.writeStoredEditorLevel(level);

        if (level === 'writer'
          && typeof this.getSceneWorkspaceViewMode === 'function'
          && this.getSceneWorkspaceViewMode() === 'map'
          && typeof this.setSceneWorkspaceViewMode === 'function') {
          this.setSceneWorkspaceViewMode('text');
        }

        this.updateEditorModeToggleButton();

        const hint = document.getElementById('writer-mode-hint');
        if (hint) hint.textContent = LEVEL_HINTS[level];

        if (typeof this.syncNavLayout === 'function') {
          try { this.syncNavLayout(this.currentTab || 'scenes'); } catch (e) { /* */ }
        }
        if (typeof this.renderEditorNav === 'function') {
          try { this.renderEditorNav(); } catch (e) { /* */ }
        }

        const activeTab = this.currentTab || 'scenes';
        if (!this.isTabVisibleInEditorMode(activeTab)) {
          if (typeof this.switchTab === 'function') this.switchTab('scenes');
        } else if (!opts.skipChromeRefresh) {
          this._refreshEditorLevelChrome();
        }

        if (typeof this.refreshMobileGate === 'function') {
          try { this.refreshMobileGate(); } catch (e) { /* */ }
        }
      } finally {
        this._applyingEditorLevel = false;
      }
      return level;
    },

    toggleEditorMode() {
      const order = LEVELS;
      const i = order.indexOf(this.getEditorLevel());
      this.applyEditorLevel(order[(i + 1) % order.length]);
    },

    initEditorMode() {
      this.applyEditorMode(this.readStoredEditorLevel(), { initial: true, force: true });
    },

    initEditorLevelForProject() {
      const stored = this.readStoredEditorLevel();
      if (stored !== this.getEditorLevel()) {
        this.applyEditorMode(stored, { force: true });
      }
    }
  };

  Object.assign(Editor, api);

  if (Editor.hooks && typeof Editor.hooks.after === 'function') {
    Editor.hooks.after('loadData', function editorLevelOnLoadData() {
      if (typeof Editor.initEditorLevelForProject === 'function') {
        Editor.initEditorLevelForProject();
      }
    }, 'editor-writer-mode');
  }

  if (Editor.hooks && typeof Editor.hooks.before === 'function') {
    Editor.hooks.before('switchTab', function editorLevelTabGuard(tab, event) {
      if (tab != null && typeof Editor.isTabVisibleInEditorMode === 'function' && !Editor.isTabVisibleInEditorMode(tab)) {
        return ['scenes', null];
      }
      return [tab, event];
    }, 'editor-writer-mode');
  }

  if (Editor.hooks && typeof Editor.hooks.after === 'function') {
    Editor.hooks.after('switchTab', function editorLevelTabActive(result, args) {
      const tab = args && args[0];
      const event = args && args[1];
      if (!event?.target && tab) {
        const tabEl = document.querySelector(`.tab[data-tab-id="${tab}"]:not(.tab--mode-hidden)`);
        if (tabEl) {
          document.querySelectorAll('.tab').forEach((el) => el.classList.remove('active'));
          tabEl.classList.add('active');
        }
      }
      return result;
    }, 'editor-writer-mode');
  } else if (typeof console !== 'undefined' && console.warn) {
    console.warn('[editor-writer-mode] Editor.hooks missing — switchTab extension skipped');
  }
})();
