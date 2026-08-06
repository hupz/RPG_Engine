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
    {
      id: 'assets',
      tab: 'audio',
      icon: '🎵',
      labelKey: 'editor.nav.assets',
      subTabs: [
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
        { tab: 'actions', labelKey: 'editor.tabs.actions' },
        { tab: 'snippets', labelKey: 'editor.tabs.snippets', writerVisible: true },
        { tab: 'reputation', labelKey: 'editor.tabs.reputation' },
        { tab: 'analytics', labelKey: 'editor.tabs.analytics' },
        { tab: 'climate', labelKey: 'editor.tabs.climate' },
        { tab: 'world', labelKey: 'editor.tabs.world' },
        { tab: 'worldmap', labelKey: 'editor.tabs.worldmap', writerVisible: true },
        { tab: 'graph', labelKey: 'editor.tabs.graph' },
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

  function findSectionById(sectionId) {
    return NAV_SECTIONS.find((s) => s.id === sectionId) || null;
  }

  function findSectionForTab(tab) {
    const sectionId = TAB_TO_SECTION[tab];
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
      const panels = [subPanel, legacySub].filter(Boolean);

      if (!section || !section.subTabs || !section.subTabs.length) {
        panels.forEach((el) => {
          el.hidden = true;
          el.innerHTML = '';
        });
        return;
      }

      const visibleSubs = getVisibleSubTabs(section);
      if (!visibleSubs.length) {
        panels.forEach((el) => {
          el.hidden = true;
          el.innerHTML = '';
        });
        return;
      }

      const html = visibleSubs.map((st) => {
        const active = st.tab === activeTab ? ' active' : '';
        const label = tr(st.labelKey);
        return `<button type="button" class="editor-section-tab${active}" data-tab-id="${st.tab}"
          onclick="Editor.switchTab('${st.tab}', event)">${label}</button>`;
      }).join('');

      panels.forEach((el) => {
        el.hidden = false;
        el.innerHTML = html;
        el.querySelectorAll('.editor-section-tab, .editor-nav-sub-item').forEach((btn) => {
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
      });
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

      const contextSidebar = document.getElementById('context-sidebar');
      if (contextSidebar) {
        const showScenes = activeTab === 'scenes' && section?.showSceneList;
        contextSidebar.classList.toggle('is-visible', !!showScenes);
        contextSidebar.setAttribute('aria-hidden', showScenes ? 'false' : 'true');
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
        const label = tr(section.labelKey);
        return `<button type="button" class="editor-nav-item" data-section-id="${section.id}"
          data-default-tab="${section.tab}" onclick="Editor.onNavSectionClick('${section.id}', event)">
          <span class="editor-nav-icon" aria-hidden="true">${section.icon}</span>
          <span class="editor-nav-label">${label}</span>
        </button>`;
      }).join('') + `
        <a class="editor-nav-item editor-nav-item--link" href="editor-guide.html" target="_blank" rel="noopener">
          <span class="editor-nav-icon" aria-hidden="true">❓</span>
          <span class="editor-nav-label" data-i18n="editor.nav.help">${tr('editor.nav.help')}</span>
        </a>`;

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

  const origSwitchTab = Editor.switchTab?.bind(Editor);
  if (origSwitchTab) {
    Editor.switchTab = function switchTabWithNav(tab, event) {
      origSwitchTab(tab, event);
      if (!event?.target?.classList?.contains('tab')) {
        Editor.syncLegacyTabActive(tab);
      }
      Editor.syncNavLayout(tab);
    };
  }

  const origShowDashboard = Editor.showDashboard?.bind(Editor);
  if (origShowDashboard) {
    Editor.showDashboard = function showDashboardWithNav() {
      origShowDashboard();
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
    };
  }

  const origApplyEditorMode = Editor.applyEditorMode?.bind(Editor);
  if (origApplyEditorMode) {
    Editor.applyEditorMode = function applyEditorModeWithNav(mode) {
      origApplyEditorMode(mode);
      if (typeof Editor.applyNavEditorMode === 'function') {
        Editor.applyNavEditorMode();
      }
    };
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
