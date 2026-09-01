// Навигация редактора: левый сайдбар + контекстная панель списков

(function attachEditorNavLayout() {
  if (typeof Editor === 'undefined') {
    console.warn('editor-nav-layout.js: Editor не определён');
    return;
  }

  const NAV_SECTIONS = [
    {
      id: 'scenes',
      tab: 'scenes',
      icon: '📖',
      labelKey: 'editor.nav.scenes',
      writerVisible: true,
      showSceneList: true,
      subTabs: [
        { tab: 'scene_templates', labelKey: 'editor.tabs.scene_templates', writerVisible: true }
      ]
    },
    { id: 'items', tab: 'items', icon: '🎒', labelKey: 'editor.nav.items', writerVisible: true },
    { id: 'quests', tab: 'quests', icon: '📜', labelKey: 'editor.nav.quests', writerVisible: true },
    { id: 'npcs', tab: 'npcs', icon: '👤', labelKey: 'editor.nav.npcs', writerVisible: true },
    { id: 'enemies', tab: 'enemies', icon: '👹', labelKey: 'editor.nav.enemies', writerVisible: true },
    {
      id: 'classes',
      tab: 'classes',
      icon: '🏅',
      labelKey: 'editor.nav.classes',
      subTabs: [
        { tab: 'balance', labelKey: 'editor.tabs.balance' },
        { tab: 'beasts', labelKey: 'editor.tabs.beasts' },
        { tab: 'progression', labelKey: 'editor.tabs.progression' }
      ]
    },
    { id: 'abilities', tab: 'abilities', icon: '✨', labelKey: 'editor.nav.abilities' },
    {
      id: 'craft',
      tab: 'recipes',
      icon: '🔨',
      labelKey: 'editor.nav.craft',
      subTabs: [
        { tab: 'ingredients', labelKey: 'editor.tabs.ingredients' },
        { tab: 'recipes', labelKey: 'editor.tabs.recipes' }
      ]
    },
    { id: 'achievements', tab: 'achievements', icon: '🏆', labelKey: 'editor.nav.achievements', writerVisible: true },
    { id: 'game_ui', tab: 'game_ui', icon: '🖥', labelKey: 'editor.nav.game_ui', writerVisible: true, labelFallback: 'Игровой UI' },
    {
      id: 'assets',
      tab: 'audio',
      icon: '🎵',
      labelKey: 'editor.nav.assets',
      subTabs: [
        { tab: 'media', labelKey: 'editor.tabs.media', labelFallback: 'Ассеты', writerVisible: true },
        { tab: 'audio', labelKey: 'editor.tabs.audio', writerVisible: true },
        { tab: 'theme', labelKey: 'editor.tabs.theme' }
      ]
    },
    {
      id: 'settings',
      tab: 'json',
      icon: '⚙️',
      labelKey: 'editor.nav.settings',
      subTabs: [
        { tab: 'json', labelKey: 'editor.tabs.json' },
        { tab: 'variables', labelKey: 'editor.tabs.variables', labelFallback: 'Переменные', writerVisible: true },
        { tab: 'prefabs', labelKey: 'editor.tabs.prefabs', labelFallback: 'Префабы', writerVisible: true },
        { tab: 'actions', labelKey: 'editor.tabs.actions' },
        { tab: 'snippets', labelKey: 'editor.tabs.snippets', writerVisible: true },
        { tab: 'reputation', labelKey: 'editor.tabs.reputation' },
        { tab: 'analytics', labelKey: 'editor.tabs.analytics' },
        { tab: 'climate', labelKey: 'editor.tabs.climate' },
        { tab: 'world', labelKey: 'editor.tabs.world', writerVisible: true },
        { tab: 'worldmap', labelKey: 'editor.tabs.worldmap', writerVisible: true },
        { tab: 'graph', labelKey: 'editor.tabs.graph', writerVisible: true },
        { tab: 'races', labelKey: 'editor.tabs.races' }
      ]
    }
  ];

  const TAB_TO_SECTION = {};
  NAV_SECTIONS.forEach((section) => {
    TAB_TO_SECTION[section.tab] = section.id;
    (section.subTabs || []).forEach((st) => {
      TAB_TO_SECTION[st.tab] = section.id;
    });
  });

  function tr(key) {
    return typeof t === 'function' ? t(key) : key;
  }

  function getSectionTabIds(section) {
    const ids = [section.tab];
    (section.subTabs || []).forEach((st) => ids.push(st.tab));
    return ids;
  }

  function isSubTabVisibleInWriterMode(subTab) {
    if (!Editor.isWriterMode || !Editor.isWriterMode()) return true;
    if (subTab.writerVisible) return true;
    return Editor.isTabVisibleInEditorMode(subTab.tab);
  }

  function getSectionTabEntries(section) {
    const entries = [{ tab: section.tab, writerVisible: section.writerVisible }];
    (section.subTabs || []).forEach((st) => {
      if (!entries.some((e) => e.tab === st.tab)) entries.push(st);
    });
    return entries;
  }

  function isSectionVisibleInWriterMode(section) {
    if (!Editor.isWriterMode || !Editor.isWriterMode()) return true;
    if (section.writerVisible) return true;
    return getSectionTabEntries(section).some((st) => isSubTabVisibleInWriterMode(st));
  }

  function isTabAllowedInCurrentEditorMode(tab) {
    if (!Editor.isTabVisibleInEditorMode) return true;
    return Editor.isTabVisibleInEditorMode(tab);
  }

  function getVisibleSubTabs(section) {
    if (!section.subTabs || !section.subTabs.length) return [];
    if (!Editor.isWriterMode || !Editor.isWriterMode()) return section.subTabs;
    return section.subTabs.filter((st) => isSubTabVisibleInWriterMode(st));
  }

  function getActiveNavSections() {
    if (typeof Editor.getNavSections === 'function') {
      try {
        const list = Editor.getNavSections();
        if (Array.isArray(list) && list.length) return list;
      } catch (e) { /* ignore */ }
    }
    return NAV_SECTIONS;
  }

  function tabToSectionMap(sections) {
    const map = {};
    (sections || NAV_SECTIONS).forEach((section) => {
      map[section.tab] = section.id;
      (section.subTabs || []).forEach((st) => {
        map[st.tab] = section.id;
      });
    });
    return map;
  }

  function findSectionById(sectionId) {
    return getActiveNavSections().find((s) => s.id === sectionId) || null;
  }

  function findSectionForTab(tab) {
    if (typeof Editor.getNavSectionForTab === 'function') {
      try {
        const fromApi = Editor.getNavSectionForTab(tab);
        if (fromApi) return fromApi;
      } catch (e) { /* ignore */ }
    }
    const sectionId = tabToSectionMap(getActiveNavSections())[tab];
    return sectionId ? findSectionById(sectionId) : null;
  }

  Object.assign(Editor, {
    getNavSections() {
      return NAV_SECTIONS;
    },

    getNavSectionForTab(tab) {
      return findSectionForTab(tab);
    },

    getNavSectionTabIds(sectionId) {
      const section = findSectionById(sectionId);
      return section ? getSectionTabIds(section) : [];
    },

    syncLegacyTabActive(tab) {
      document.querySelectorAll('.tab[data-tab-id]').forEach((el) => {
        el.classList.toggle('active', el.dataset.tabId === tab);
      });
    },

    _renderSectionSubNav(section, activeTab) {
      const subPanel = document.getElementById('editor-section-bar');
      const legacySub = document.getElementById('editor-nav-sub');

      const hideEl = (el) => {
        if (!el) return;
        el.hidden = true;
        el.innerHTML = '';
      };

      if (!section || !section.subTabs || !section.subTabs.length) {
        hideEl(subPanel);
        hideEl(legacySub);
        return;
      }

      const visibleSubs = getVisibleSubTabs(section);
      if (!visibleSubs.length) {
        hideEl(subPanel);
        hideEl(legacySub);
        return;
      }

      const syncValidationDots = (root, itemSelector) => {
        if (!root) return;
        root.querySelectorAll(itemSelector).forEach((btn) => {
          const tabId = btn.dataset.tabId;
          const legacy = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
          if (!legacy) return;
          btn.classList.toggle('has-validation-error', legacy.classList.contains('has-validation-error'));
          btn.classList.toggle('has-validation-warning', legacy.classList.contains('has-validation-warning'));
          const dot = legacy.querySelector('.tab-issue-dot');
          if (dot) {
            let subDot = btn.querySelector('.tab-issue-dot');
            if (!subDot) {
              subDot = document.createElement('span');
              subDot.className = dot.className;
              subDot.setAttribute('aria-hidden', 'true');
              btn.appendChild(subDot);
            } else {
              subDot.className = dot.className;
            }
          } else {
            btn.querySelector('.tab-issue-dot')?.remove();
          }
        });
      };

      const buildButtons = (className) => visibleSubs.map((st) => {
        const active = st.tab === activeTab ? ' active' : '';
        const label = tr(st.labelKey);
        return `<button type="button" class="${className}${active}" data-tab-id="${st.tab}"
          onclick="${this.escapeAttr('Editor.switchTab(' + JSON.stringify(st.tab) + ', event)')}">${label}</button>`;
      }).join('');

      // Main workspace chips (unchanged position)
      if (subPanel) {
        subPanel.hidden = false;
        subPanel.innerHTML = buildButtons('editor-section-tab');
        syncValidationDots(subPanel, '.editor-section-tab');
      }

      // Sidebar: insert submenu directly under the active section button
      if (legacySub) {
        const navList = document.getElementById('editor-nav-list');
        const activeBtn = navList?.querySelector(
          `.editor-nav-item[data-section-id="${section.id}"]`
        );
        if (activeBtn && activeBtn.parentNode) {
          activeBtn.insertAdjacentElement('afterend', legacySub);
        } else if (navList) {
          navList.appendChild(legacySub);
        }
        legacySub.hidden = false;
        legacySub.innerHTML = buildButtons('editor-nav-sub-item');
        syncValidationDots(legacySub, '.editor-nav-sub-item');
      }
    },

    syncNavLayout(tab) {
      const activeTab = tab || this.currentTab;
      const section = findSectionForTab(activeTab);
      const sectionId = section ? section.id : null;

      document.querySelectorAll('.editor-nav-item[data-section-id]').forEach((btn) => {
        const isActive = btn.dataset.sectionId === sectionId;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-current', isActive ? 'page' : 'false');
      });

      this._renderSectionSubNav(section, activeTab);

      if (typeof Editor.syncContextSidebar === 'function') {
        Editor.syncContextSidebar(activeTab);
      }
    },

    applyNavEditorMode() {
      document.querySelectorAll('.editor-nav-item[data-section-id]').forEach((btn) => {
        const section = findSectionById(btn.dataset.sectionId);
        if (!section) return;
        const visible = isSectionVisibleInWriterMode(section);
        btn.classList.toggle('editor-nav-item--mode-hidden', !visible);
        btn.setAttribute('aria-hidden', visible ? 'false' : 'true');
      });

      const brandHint = document.getElementById('editor-nav-writer-badge');
      if (brandHint) {
        const writer = Editor.isWriterMode && Editor.isWriterMode();
        brandHint.hidden = !writer;
      }

      this.syncNavLayout(this.currentTab);
    },

    initEditorNav() {
      const navList = document.getElementById('editor-nav-list');
      if (!navList || navList.dataset.built === '1') return;
      navList.dataset.built = '1';

      navList.innerHTML = NAV_SECTIONS.map((section) => {
        const translated = tr(section.labelKey);
        const label = (translated && translated !== section.labelKey) ? translated : (section.labelFallback || translated || section.id);
        return `<button type="button" class="editor-nav-item" data-section-id="${section.id}"
          data-default-tab="${section.tab}" onclick="${this.escapeAttr('Editor.onNavSectionClick(' + JSON.stringify(section.id) + ', event)')}">
          <span class="editor-nav-icon" aria-hidden="true">${section.icon}</span>
          <span class="editor-nav-label">${label}</span>
        </button>`;
      }).join('') + `
        <a class="editor-nav-item editor-nav-item--link" href="editor-guide.html" target="_blank" rel="noopener">
          <span class="editor-nav-icon" aria-hidden="true">❓</span>
          <span class="editor-nav-label" data-i18n="editor.nav.help">${tr('editor.nav.help')}</span>
        </a>`;

      // Submenu host lives inside the list so it can sit under the active section.
      let sub = document.getElementById('editor-nav-sub');
      if (!sub) {
        sub = document.createElement('div');
        sub.id = 'editor-nav-sub';
        sub.className = 'editor-nav-sub';
        sub.hidden = true;
      }
      navList.appendChild(sub);

      if (typeof Editor.applyNavEditorMode === 'function') {
        Editor.applyNavEditorMode();
      }
    },

    onNavSectionClick(sectionId, event) {
      const section = findSectionById(sectionId);
      if (!section) return;
      if (!isSectionVisibleInWriterMode(section)) return;
      if (!isTabAllowedInCurrentEditorMode(section.tab)) return;
      this.switchTab(section.tab, event);
    }
  });

  if (Editor.hooks && typeof Editor.hooks.after === 'function') {
    Editor.hooks.after('switchTab', function (result, args) {
      const tab = args && args[0];
      const event = args && args[1];
      if (!event?.target?.classList?.contains('tab') && tab != null) {
        if (typeof Editor.syncLegacyTabActive === 'function') Editor.syncLegacyTabActive(tab);
      }
      if (typeof Editor.syncNavLayout === 'function') Editor.syncNavLayout(tab);
    });
  } else if (typeof console !== 'undefined' && console.warn) {
    console.warn('[editor-nav-layout] Editor.hooks missing — switchTab extension skipped');
  }

  function clearNavOnDashboard() {
    document.querySelectorAll('.editor-nav-item').forEach((btn) => {
      btn.classList.remove('active');
      btn.setAttribute('aria-current', 'false');
    });
    const subPanel = document.getElementById('editor-section-bar');
    const legacySub = document.getElementById('editor-nav-sub');
    [subPanel, legacySub].filter(Boolean).forEach((el) => {
      el.hidden = true;
      el.innerHTML = '';
    });
    const contextSidebar = document.getElementById('context-sidebar');
    if (contextSidebar) {
      contextSidebar.classList.remove('is-visible');
      contextSidebar.setAttribute('aria-hidden', 'true');
    }
  }
  if (Editor.hooks && typeof Editor.hooks.after === 'function') {
    Editor.hooks.after('showDashboard', function () { clearNavOnDashboard(); });
  } else if (typeof console !== 'undefined' && console.warn) {
    console.warn('[editor-nav-layout] Editor.hooks missing — showDashboard extension skipped');
  }

  if (Editor.hooks && typeof Editor.hooks.after === 'function') {
    Editor.hooks.after('applyEditorMode', function (result, args) {
      if (typeof Editor.applyNavEditorMode === 'function') {
        Editor.applyNavEditorMode();
      }
      return result;
    });
  } else if (typeof console !== 'undefined' && console.warn) {
    console.warn('[editor-nav-layout] Editor.hooks missing — applyEditorMode extension skipped');
  }

  function bootstrapNav() {
    Editor.initEditorNav();
    if (Editor.currentTab && Editor.currentTab !== 'dashboard') {
      Editor.syncNavLayout(Editor.currentTab);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapNav);
  } else {
    bootstrapNav();
  }
})();
