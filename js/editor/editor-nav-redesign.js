// ============================================================
// Editor Nav Redesign (UI-6) — task-oriented navigation + mode UX
// Presentation only; does not mutate project JSON.
// ============================================================
(function attachEditorNavRedesign() {
  'use strict';

  if (typeof Editor === 'undefined') return;

  const GROUP_LABEL_KEYS = {
    create: 'editor.nav.groups.create',
    content: 'editor.nav.groups.content',
    tools: 'editor.nav.groups.tools',
    advanced: 'editor.nav.groups.advanced'
  };

  /** Flat sections — same ids/tabs as editor-nav-layout where possible */
  const REDESIGN_SECTIONS = [
    {
      groupId: 'create', id: 'scenes', tab: 'scenes', icon: '🎬',
      labelKey: 'editor.nav.scenes',
      writerVisible: true, showSceneList: true, primary: true,
      subTabs: [
        { tab: 'scene_templates', labelKey: 'editor.tabs.scene_templates', writerVisible: true }
      ]
    },
    {
      groupId: 'create', id: 'story', tab: 'graph', icon: '🗺️',
      labelKey: 'editor.tabs.graph',
      writerVisible: true
    },
    {
      groupId: 'create', id: 'game_ui', tab: 'game_ui', icon: '🖥',
      labelKey: 'editor.nav.game_ui',
      writerVisible: true
    },
    {
      groupId: 'content', id: 'items', tab: 'items', icon: '🎒',
      labelKey: 'editor.nav.items',
      writerVisible: true
    },
    {
      groupId: 'content', id: 'quests', tab: 'quests', icon: '📜',
      labelKey: 'editor.nav.quests',
      writerVisible: true
    },
    {
      groupId: 'content', id: 'npcs', tab: 'npcs', icon: '👤',
      labelKey: 'editor.nav.npcs',
      writerVisible: true,
      subTabs: [
        { tab: 'player_characters', labelKey: 'editor.tabs.player_characters', writerVisible: true }
      ]
    },
    {
      groupId: 'content', id: 'enemies', tab: 'enemies', icon: '👹',
      labelKey: 'editor.nav.enemies',
      writerVisible: true
    },
    {
      groupId: 'content', id: 'world', tab: 'world', icon: '🌍',
      labelKey: 'editor.tabs.world',
      writerVisible: true,
      subTabs: [
        { tab: 'worldmap', labelKey: 'editor.tabs.worldmap', writerVisible: true }
      ]
    },
    {
      groupId: 'advanced', id: 'classes', tab: 'classes', icon: '🏅',
      labelKey: 'editor.nav.classes',
      subTabs: [
        { tab: 'balance', labelKey: 'editor.tabs.balance' },
        { tab: 'beasts', labelKey: 'editor.tabs.beasts' },
        { tab: 'progression', labelKey: 'editor.tabs.progression' }
      ]
    },
    {
      groupId: 'advanced', id: 'abilities', tab: 'abilities', icon: '✨',
      labelKey: 'editor.nav.abilities'
    },
    {
      groupId: 'advanced', id: 'craft', tab: 'recipes', icon: '🔨',
      labelKey: 'editor.nav.craft',
      subTabs: [
        { tab: 'ingredients', labelKey: 'editor.tabs.ingredients' },
        { tab: 'recipes', labelKey: 'editor.tabs.recipes' }
      ]
    },
    {
      groupId: 'advanced', id: 'achievements', tab: 'achievements', icon: '🏆',
      labelKey: 'editor.nav.achievements',
      writerVisible: true
    },
    {
      groupId: 'advanced', id: 'assets', tab: 'audio', icon: '🎵',
      labelKey: 'editor.nav.assets',
      subTabs: [
        { tab: 'media', labelKey: 'editor.tabs.media', writerVisible: true },
        { tab: 'audio', labelKey: 'editor.tabs.audio', writerVisible: true },
        { tab: 'theme', labelKey: 'editor.tabs.theme' }
      ]
    },
    {
      groupId: 'advanced', id: 'settings', tab: 'json', icon: '⚙️',
      labelKey: 'editor.nav.settings',
      subTabs: [
        { tab: 'json', labelKey: 'editor.tabs.json' },
        { tab: 'variables', labelKey: 'editor.tabs.variables', writerVisible: true },
        { tab: 'prefabs', labelKey: 'editor.tabs.prefabs', writerVisible: true },
        { tab: 'actions', labelKey: 'editor.tabs.actions' },
        { tab: 'snippets', labelKey: 'editor.tabs.snippets', writerVisible: true },
        { tab: 'reputation', labelKey: 'editor.tabs.reputation' },
        { tab: 'analytics', labelKey: 'editor.tabs.analytics' },
        { tab: 'climate', labelKey: 'editor.tabs.climate' },
        { tab: 'races', labelKey: 'editor.tabs.races' }
      ]
    }
  ];

  const TOOL_ACTIONS = [
    {
      id: 'validate',
      icon: '🔍',
      labelKey: 'editor.nav.tools.validate.label',
      titleKey: 'editor.nav.tools.validate.title',
      run() {
        if (typeof Editor.runProjectValidation === 'function') Editor.runProjectValidation();
      }
    },
    {
      id: 'preview',
      icon: '▶',
      labelKey: 'editor.nav.tools.preview.label',
      titleKey: 'editor.nav.tools.preview.title',
      run() {
        if (typeof Editor.openPreviewMenu === 'function') Editor.openPreviewMenu();
        else if (typeof Editor.testCurrentScene === 'function') Editor.testCurrentScene();
        else if (typeof Editor.openEmbeddedPlayPanel === 'function') Editor.openEmbeddedPlayPanel();
      }
    },
    {
      id: 'export',
      icon: '💾',
      labelKey: 'editor.nav.tools.export.label',
      titleKey: 'editor.nav.tools.export.title',
      run() {
        const btn = document.getElementById('export-menu-toggle');
        if (btn) btn.click();
      }
    }
  ];

  const NAV_COMMAND_SECTIONS = [
    { id: 'nav.scenes', tab: 'scenes', titleKey: 'editor.nav.scenes', keywords: ['scene', 'scenes'] },
    { id: 'nav.story', tab: 'graph', titleKey: 'editor.nav.commands.story', keywords: ['story', 'graph'] },
    { id: 'nav.game_ui', tab: 'game_ui', titleKey: 'editor.nav.game_ui', keywords: ['ui', 'hud'] },
    { id: 'nav.quests', tab: 'quests', titleKey: 'editor.nav.quests', keywords: ['quest', 'quests'] },
    { id: 'nav.items', tab: 'items', titleKey: 'editor.nav.items', keywords: ['item', 'items'] },
    { id: 'nav.npcs', tab: 'npcs', titleKey: 'editor.nav.npcs', keywords: ['npc', 'character'] }
  ];

  const TAB_TO_SECTION = {};
  REDESIGN_SECTIONS.forEach((section) => {
    TAB_TO_SECTION[section.tab] = section.id;
    (section.subTabs || []).forEach((st) => {
      TAB_TO_SECTION[st.tab] = section.id;
    });
  });

  function tr(key) {
    return typeof t === 'function' ? t(key) : key;
  }

  function groupLabel(groupId) {
    return tr(GROUP_LABEL_KEYS[groupId] || groupId);
  }

  function resolveTool(tool) {
    return {
      id: tool.id,
      icon: tool.icon,
      label: tr(tool.labelKey),
      title: tr(tool.titleKey),
      run: tool.run
    };
  }

  function labelFor(entry) {
    if (!entry.labelKey) return entry.id || '';
    const translated = tr(entry.labelKey);
    let label = (translated && translated !== entry.labelKey)
      ? translated
      : (entry.id || '');
    if (entry.icon && typeof label === 'string' && label.startsWith(entry.icon)) {
      label = label.slice(entry.icon.length).trim();
    }
    return label;
  }

  function isWriter() {
    return typeof Editor.isWriterMode === 'function' && Editor.isWriterMode();
  }

  function isSubTabVisibleInWriterMode(subTab) {
    if (!isWriter()) return true;
    if (subTab.writerVisible) return true;
    return Editor.isTabVisibleInEditorMode && Editor.isTabVisibleInEditorMode(subTab.tab);
  }

  function getSectionTabEntries(section) {
    const entries = [{ tab: section.tab, writerVisible: section.writerVisible }];
    (section.subTabs || []).forEach((st) => {
      if (!entries.some((e) => e.tab === st.tab)) entries.push(st);
    });
    return entries;
  }

  function isSectionVisibleInWriterMode(section) {
    if (!isWriter()) return true;
    if (section.groupId === 'advanced' && !section.writerVisible) {
      return getSectionTabEntries(section).some((st) => isSubTabVisibleInWriterMode(st));
    }
    if (section.writerVisible) return true;
    return getSectionTabEntries(section).some((st) => isSubTabVisibleInWriterMode(st));
  }

  function isGroupVisible(groupId) {
    if (groupId === 'tools') return true;
    if (groupId === 'advanced' && isWriter()) {
      return REDESIGN_SECTIONS.some((s) => s.groupId === 'advanced' && isSectionVisibleInWriterMode(s));
    }
    return REDESIGN_SECTIONS.some((s) => s.groupId === groupId && isSectionVisibleInWriterMode(s));
  }

  function findSectionById(sectionId) {
    return REDESIGN_SECTIONS.find((s) => s.id === sectionId) || null;
  }

  function findSectionForTab(tab) {
    const sectionId = TAB_TO_SECTION[tab];
    return sectionId ? findSectionById(sectionId) : null;
  }

  function getVisibleSubTabs(section) {
    if (!section?.subTabs?.length) return [];
    if (!isWriter()) return section.subTabs;
    return section.subTabs.filter((st) => isSubTabVisibleInWriterMode(st));
  }

  function escAttr(s) {
    return typeof Editor.escapeAttr === 'function'
      ? Editor.escapeAttr(String(s == null ? '' : s))
      : String(s == null ? '' : s);
  }

  function renderGroupedNav() {
    const navList = document.getElementById('editor-nav-list');
    if (!navList) return;

    let html = '';
    ['create', 'content', 'tools', 'advanced'].forEach((groupId) => {
      if (!isGroupVisible(groupId)) return;

      html += '<div class="editor-nav-group" data-nav-group="' + groupId + '">';
      html += '<div class="editor-nav-group__label">' + groupLabel(groupId) + '</div>';

      if (groupId === 'tools') {
        TOOL_ACTIONS.forEach((toolDef) => {
          const tool = resolveTool(toolDef);
          html += '<button type="button" class="editor-nav-item editor-nav-item--tool" data-tool-id="' + tool.id + '"' +
            ' title="' + escAttr(tool.title) + '" aria-label="' + escAttr(tool.title) + '">' +
            '<span class="editor-nav-icon" aria-hidden="true">' + tool.icon + '</span>' +
            '<span class="editor-nav-label">' + tool.label + '</span></button>';
        });
      } else {
        REDESIGN_SECTIONS.filter((s) => s.groupId === groupId).forEach((section) => {
          if (!isSectionVisibleInWriterMode(section)) return;
          const primary = section.primary ? ' editor-nav-item--primary' : '';
          html += '<button type="button" class="editor-nav-item' + primary + '" data-section-id="' + section.id + '"' +
            ' data-default-tab="' + section.tab + '"' +
            ' onclick="' + escAttr('Editor.onNavSectionClick(' + JSON.stringify(section.id) + ', event)') + '">' +
            '<span class="editor-nav-icon" aria-hidden="true">' + section.icon + '</span>' +
            '<span class="editor-nav-label">' + labelFor(section) + '</span></button>';
        });
      }
      html += '</div>';
    });

    html += '<a class="editor-nav-item editor-nav-item--link" href="editor-guide.html" target="_blank" rel="noopener">' +
      '<span class="editor-nav-icon" aria-hidden="true">❓</span>' +
      '<span class="editor-nav-label" data-i18n="editor.nav.help">' + tr('editor.nav.help') + '</span></a>';

    navList.innerHTML = html;

    let sub = document.getElementById('editor-nav-sub');
    if (!sub) {
      sub = document.createElement('div');
      sub.id = 'editor-nav-sub';
      sub.className = 'editor-nav-sub';
      sub.hidden = true;
    }
    navList.appendChild(sub);

    navList.querySelectorAll('[data-tool-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const toolDef = TOOL_ACTIONS.find((t) => t.id === btn.dataset.toolId);
        if (toolDef) toolDef.run();
      });
    });
  }

  function syncOnboarding() {
    const host = document.getElementById('editor-nav-onboarding');
    if (!host) return;

    const data = Editor.data;
    const scenes = data?.scenes ? Object.keys(data.scenes) : [];
    const hasProject = !!data;
    const openCount = Editor.workspace?.open?.length || 0;
    const current = Editor.currentScene;

    let message = '';
    let cta = '';

    if (!hasProject) {
      message = tr('editor.nav.onboarding.noProject');
    } else if (scenes.length === 0) {
      message = tr('editor.nav.onboarding.noScenes');
      cta = '<button type="button" class="btn btn-primary btn-sm" onclick="Editor.openSceneWizard()">' +
        escAttr(tr('editor.nav.onboarding.firstSceneBtn')) + '</button>';
    } else if (Editor.currentTab === 'scenes' && !current && openCount === 0) {
      message = tr('editor.nav.onboarding.openScene');
      cta = '<button type="button" class="btn btn-secondary btn-sm" onclick="Editor.openSceneWizard()">' +
        escAttr(tr('editor.nav.onboarding.newSceneBtn')) + '</button>';
    } else if (Editor.currentTab === 'scenes' && data.startScene && current === data.startScene) {
      message = tr('editor.nav.onboarding.startScene');
    } else {
      host.hidden = true;
      host.innerHTML = '';
      return;
    }

    host.hidden = false;
    host.innerHTML = '<p class="editor-nav-onboarding__text">' + message + '</p>' +
      (cta ? '<div class="editor-nav-onboarding__cta">' + cta + '</div>' : '');
  }

  function preserveModeContext() {
    const ws = Editor.workspace;
    if (!ws) return;
    const snap = {
      open: ws.open ? ws.open.slice() : [],
      activeId: ws.activeId,
      currentScene: Editor.currentScene,
      selection: Editor.Inspector?.selection || null
    };
    Editor._modeSwitchSnap = snap;
    requestAnimationFrame(() => {
      const s = Editor._modeSwitchSnap;
      if (!s || !Editor.workspace) return;
      if (s.open.length && Editor.workspace.open.length === 0) {
        Editor.workspace.open = s.open.slice();
        Editor.workspace.activeId = s.activeId;
        if (Editor.Workspace?.renderTabs) Editor.Workspace.renderTabs();
      }
      if (s.currentScene && !Editor.currentScene && typeof Editor.selectScene === 'function') {
        try { Editor.selectScene(s.currentScene); } catch (e) { /* */ }
      }
      if (s.selection && Editor.Inspector) {
        try { Editor.Inspector.select(s.selection); } catch (e) { /* */ }
      }
      delete Editor._modeSwitchSnap;
    });
  }

  function registerNavCommands() {
    if (!Editor.commands?.register) return;
    const toolsCategory = tr('editor.nav.commands.categoryTools');
    const navigationCategory = tr('editor.commandPaletteV2.categories.navigation');
    TOOL_ACTIONS.forEach((toolDef) => {
      const tool = resolveTool(toolDef);
      Editor.commands.register({
        id: 'nav.tool.' + tool.id,
        title: tool.icon + ' ' + tool.label,
        category: toolsCategory,
        keywords: [tool.id, tool.label],
        action: toolDef.run
      });
    });
    NAV_COMMAND_SECTIONS.forEach((n) => {
      Editor.commands.register({
        id: n.id,
        title: tr(n.titleKey),
        category: navigationCategory,
        keywords: n.keywords,
        action() {
          if (typeof Editor.switchTab === 'function') Editor.switchTab(n.tab);
        }
      });
    });
  }

  function ensureOnboardingHost() {
    const scroll = document.querySelector('.editor-nav-scroll');
    if (!scroll || document.getElementById('editor-nav-onboarding')) return;
    const el = document.createElement('div');
    el.id = 'editor-nav-onboarding';
    el.className = 'editor-nav-onboarding';
    el.hidden = true;
    scroll.insertBefore(el, scroll.firstChild);
  }

  function ensureStyles() {
    if (typeof document === 'undefined' || document.getElementById('editor-nav-redesign-styles')) return;
    if (document.querySelector('link#editor-design-system-css, link[href*="editor-design-system"]')) {
      return;
    }
    if (!document.head) return;
    const st = document.createElement('style');
    st.id = 'editor-nav-redesign-styles';
    st.textContent = `
      .editor-nav-group { margin-bottom: 10px; }
      .editor-nav-group__label {
        font-size: 10px; font-weight: 600; text-transform: uppercase;
        letter-spacing: 0.06em; color: var(--ink-faint); padding: 4px 10px 2px;
      }
      .editor-nav-item--primary { font-weight: 600; }
      .editor-nav-item--tool { opacity: 0.95; }
      .editor-nav-onboarding {
        margin: 0 4px 10px; padding: 10px; border-radius: 6px;
        background: color-mix(in srgb, var(--info) 8%, var(--paper));
        border: 1px solid color-mix(in srgb, var(--info) 20%, var(--border));
      }
      .editor-nav-onboarding__text { font-size: 12px; line-height: 1.45; margin: 0 0 8px; color: var(--ink-light); }
      .ws-scene-context-nav {
        display: flex; flex-wrap: wrap; gap: 4px; margin: 0 0 12px; padding-bottom: 8px;
        border-bottom: 1px solid var(--border);
      }
      .ws-ctx-nav-btn {
        font-size: 11px; padding: 3px 10px; border-radius: 4px;
        border: 1px solid transparent; background: transparent; color: var(--ink-light);
        cursor: pointer;
      }
      .ws-ctx-nav-btn.is-active { background: var(--highlight); color: var(--ink); border-color: var(--border); }
      .ws-ctx-nav-btn:hover { background: var(--highlight); color: var(--ink); }
      .ws-ctx-nav-sep { width: 1px; background: var(--border); margin: 2px 4px; align-self: stretch; }
    `;
    document.head.appendChild(st);
  }

  // Override nav APIs
  Object.assign(Editor, {
    getNavSections() {
      return REDESIGN_SECTIONS;
    },

    getNavGroups() {
      return ['create', 'content', 'tools', 'advanced'].map((id) => ({
        id,
        label: groupLabel(id),
        visible: isGroupVisible(id)
      }));
    },

    getNavSectionForTab(tab) {
      return findSectionForTab(tab);
    },

    getNavToolActions() {
      return TOOL_ACTIONS.map(resolveTool);
    },

    initEditorNav() {
      ensureOnboardingHost();
      renderGroupedNav();
      if (typeof Editor.applyNavEditorMode === 'function') {
        Editor.applyNavEditorMode();
      }
      syncOnboarding();
    },

    syncNavOnboarding: syncOnboarding
  });

  // Re-use nav-layout helpers for subnav — patch visibility checks to use redesign sections
  if (typeof Editor.applyNavEditorMode === 'function' && Editor.hooks?.replace) {
    Editor.hooks.replace('applyNavEditorMode', function patchedApplyNavEditorMode() {
      document.querySelectorAll('.editor-nav-item[data-section-id]').forEach((btn) => {
        const section = findSectionById(btn.dataset.sectionId);
        if (!section) return;
        const visible = isSectionVisibleInWriterMode(section);
        btn.classList.toggle('editor-nav-item--mode-hidden', !visible);
        btn.setAttribute('aria-hidden', visible ? 'false' : 'true');
      });

      document.querySelectorAll('.editor-nav-group').forEach((group) => {
        const gid = group.dataset.navGroup;
        group.hidden = !isGroupVisible(gid);
      });

      const brandHint = document.getElementById('editor-nav-writer-badge');
      if (brandHint) {
        if (typeof Editor.getEditorLevelLabel === 'function') {
          brandHint.textContent = Editor.getEditorLevelLabel();
          brandHint.hidden = false;
        } else {
          brandHint.hidden = !isWriter();
        }
      }

      if (typeof Editor.syncNavLayout === 'function') {
        Editor.syncNavLayout(Editor.currentTab);
      }
      syncOnboarding();
    }, 'editor-nav-redesign');
  }

  if (Editor.hooks) {
    if (typeof Editor.hooks.after === 'function') {
      Editor.hooks.after('applyEditorMode', function () {
        preserveModeContext();
        const navList = document.getElementById('editor-nav-list');
        if (navList) {
          renderGroupedNav();
          if (typeof Editor.applyNavEditorMode === 'function') Editor.applyNavEditorMode();
        }
        if (typeof Editor.applyEditorDensityClasses === 'function') Editor.applyEditorDensityClasses();
        syncOnboarding();
      }, 'editor-nav-redesign');

      Editor.hooks.after('switchTab', function () {
        syncOnboarding();
      });

      Editor.hooks.after('selectScene', function () {
        syncOnboarding();
      });

      Editor.hooks.after('renderSceneEditor', function () {
        if (typeof Editor.injectSceneContextNav === 'function') Editor.injectSceneContextNav();
      }, 'editor-nav-redesign');
    }
  }

  function bindNavDelegation() {
    const nav = document.getElementById('editor-nav');
    if (!nav || nav.dataset.navDelegationBound) return;
    nav.dataset.navDelegationBound = '1';
    nav.addEventListener('click', (ev) => {
      const toolBtn = ev.target.closest('.editor-nav-item[data-tool-id]');
      if (toolBtn) {
        const toolDef = TOOL_ACTIONS.find((t) => t.id === toolBtn.dataset.toolId);
        if (toolDef && typeof toolDef.run === 'function') {
          ev.preventDefault();
          toolDef.run();
        }
        return;
      }
      const sectionBtn = ev.target.closest('.editor-nav-item[data-section-id]');
      if (!sectionBtn || sectionBtn.classList.contains('editor-nav-item--mode-hidden')) return;
      if (typeof Editor.onNavSectionClick === 'function') {
        ev.preventDefault();
        Editor.onNavSectionClick(sectionBtn.dataset.sectionId, ev);
      }
    });
  }

  function bootstrap() {
    ensureStyles();
    ensureOnboardingHost();
    registerNavCommands();
    bindNavDelegation();
    const navList = document.getElementById('editor-nav-list');
    if (navList) {
      navList.dataset.built = '';
      Editor.initEditorNav();
    }
    if (Editor.currentTab && Editor.currentTab !== 'dashboard') {
      if (typeof Editor.syncNavLayout === 'function') Editor.syncNavLayout(Editor.currentTab);
    }
    document.body.classList.add('editor-nav-redesign');
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
      bootstrap();
    }
  }

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-nav-redesign', {
      syncNavOnboarding: Editor.syncNavOnboarding,
      getNavGroups: Editor.getNavGroups
    }, { force: true });
  }

  console.info('[Editor.NavRedesign] ready');
})();
