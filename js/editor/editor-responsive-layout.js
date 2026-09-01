// ============================================================
// Responsive Editor Layout (UI-18) — desktop breakpoints only
// Reuses context-ui collapse + inspector toggle. No mobile rewrite.
// ============================================================
(function attachResponsiveEditorLayout() {
  'use strict';

  if (typeof Editor === 'undefined') return;

  const BREAKPOINTS = Object.freeze({
    sm: 1280,
    md: 1366,
    lg: 1440,
    xl: 1920
  });

  const MIN_WORKSPACE = 480;

  const PANEL_WIDTH = Object.freeze({
    sm: { nav: 200, sidebar: 176, inspector: 240 },
    md: { nav: 212, sidebar: 200, inspector: 248 },
    lg: { nav: 228, sidebar: 220, inspector: 260 },
    xl: { nav: 248, sidebar: 248, inspector: 272 }
  });

  function ensureUiState() {
    if (!Editor.workspace) Editor.workspace = { open: [], activeId: null };
    if (!Editor.workspace.ui) {
      Editor.workspace.ui = {
        sidebarCollapsed: false,
        inspectorCollapsed: false,
        inspectorSections: {}
      };
    }
    if (!Editor.workspace.ui.layout) {
      Editor.workspace.ui.layout = {
        tier: 'xl',
        sidebarUserExpanded: null,
        inspectorUserExpanded: null
      };
    }
    return Editor.workspace.ui;
  }

  function getViewportWidth() {
    if (typeof window === 'undefined') return BREAKPOINTS.xl;
    return window.innerWidth || document.documentElement.clientWidth || BREAKPOINTS.xl;
  }

  function getLayoutTier(width) {
    const w = width != null ? width : getViewportWidth();
    if (w <= BREAKPOINTS.sm) return 'sm';
    if (w <= BREAKPOINTS.md) return 'md';
    if (w <= BREAKPOINTS.lg) return 'lg';
    return 'xl';
  }

  function getPanelWidths(tier) {
    return PANEL_WIDTH[tier] || PANEL_WIDTH.xl;
  }

  function isSidebarVisible() {
    const sidebar = document.getElementById('context-sidebar');
    return !!(sidebar && sidebar.classList.contains('is-visible') && !sidebar.classList.contains('is-collapsed'));
  }

  function isInspectorVisible() {
    const panel = document.getElementById('editor-inspector');
    return !!(panel && !panel.classList.contains('is-collapsed'));
  }

  function estimateWorkspaceWidth(tier) {
    const w = getPanelWidths(tier);
    let avail = getViewportWidth() - w.nav;
    if (isSidebarVisible()) avail -= w.sidebar;
    if (isInspectorVisible() && tier !== 'sm' && tier !== 'md') avail -= w.inspector;
    return avail;
  }

  function setSidebarCollapsed(collapsed, source) {
    const ui = ensureUiState();
    const sidebar = document.getElementById('context-sidebar');
    if (!sidebar) return;
    ui.sidebarCollapsed = !!collapsed;
    if (source === 'user') ui.layout.sidebarUserExpanded = !collapsed;
    sidebar.classList.toggle('is-collapsed', ui.sidebarCollapsed);
  }

  function setInspectorCollapsed(collapsed, source) {
    const ui = ensureUiState();
    const panel = document.getElementById('editor-inspector');
    if (!panel) return;
    ui.inspectorCollapsed = !!collapsed;
    if (source === 'user') ui.layout.inspectorUserExpanded = !collapsed;
    panel.classList.toggle('is-collapsed', ui.inspectorCollapsed);
    panel.classList.toggle('is-drawer', !ui.inspectorCollapsed && (getLayoutTier() === 'sm' || getLayoutTier() === 'md'));
    syncLayoutFabs();
  }

  function toggleSidebar() {
    const ui = ensureUiState();
    setSidebarCollapsed(!ui.sidebarCollapsed, 'user');
    applyResponsiveLayout();
  }

  function toggleInspector() {
    const ui = ensureUiState();
    setInspectorCollapsed(!ui.inspectorCollapsed, 'user');
    applyResponsiveLayout();
  }

  function ensureLayoutFabs() {
    if (typeof document === 'undefined') return;
    let host = document.getElementById('editor-layout-fabs');
    if (!host) {
      host = document.createElement('div');
      host.id = 'editor-layout-fabs';
      host.className = 'editor-layout-fabs';
      host.innerHTML =
        '<button type="button" class="editor-layout-fab" data-fab="sidebar" title="Контент" aria-label="Открыть браузер контента">☰</button>' +
        '<button type="button" class="editor-layout-fab" data-fab="inspector" title="Свойства" aria-label="Открыть инспектор">⚙</button>';
      document.body.appendChild(host);
      host.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-fab]');
        if (!btn) return;
        if (btn.dataset.fab === 'sidebar') toggleSidebar();
        if (btn.dataset.fab === 'inspector') toggleInspector();
      });
    }
    return host;
  }

  function syncLayoutFabs() {
    const host = ensureLayoutFabs();
    if (!host) return;
    const tier = getLayoutTier();
    const show = tier === 'sm' || tier === 'md';
    host.hidden = !show;
    const sidebarFab = host.querySelector('[data-fab="sidebar"]');
    const inspectorFab = host.querySelector('[data-fab="inspector"]');
    const sidebar = document.getElementById('context-sidebar');
    const inspector = document.getElementById('editor-inspector');
    if (sidebarFab) {
      sidebarFab.hidden = !show || !(sidebar && sidebar.classList.contains('is-visible'));
      sidebarFab.classList.toggle('is-active', !!(sidebar && !sidebar.classList.contains('is-collapsed')));
    }
    if (inspectorFab) {
      inspectorFab.hidden = !show || !inspector;
      inspectorFab.classList.toggle('is-active', !!(inspector && !inspector.classList.contains('is-collapsed')));
    }
  }

  function applyAutoCollapse(tier) {
    const ui = ensureUiState();
    const sidebar = document.getElementById('context-sidebar');
    const sidebarRelevant = sidebar && sidebar.classList.contains('is-visible');

    if (tier === 'sm' || tier === 'md') {
      let workspace = estimateWorkspaceWidth(tier);
      if (workspace < MIN_WORKSPACE && sidebarRelevant && !ui.sidebarCollapsed) {
        if (ui.layout.sidebarUserExpanded !== true) {
          setSidebarCollapsed(true, 'auto');
        }
      }
      workspace = estimateWorkspaceWidth(tier);
      if (workspace < MIN_WORKSPACE && isInspectorVisible()) {
        if (ui.layout.inspectorUserExpanded !== true) {
          setInspectorCollapsed(true, 'auto');
        }
      }
      const panel = document.getElementById('editor-inspector');
      if (panel) {
        panel.classList.toggle('is-drawer', !ui.inspectorCollapsed);
      }
    } else {
      const panel = document.getElementById('editor-inspector');
      if (panel) panel.classList.remove('is-drawer');
      if (ui.layout.sidebarUserExpanded === null && ui.sidebarCollapsed && sidebarRelevant) {
        setSidebarCollapsed(false, 'auto');
      }
    }
  }

  function applyResponsiveLayout(width) {
    if (typeof document === 'undefined' || !document.body) return getLayoutTier(width);
    const tier = getLayoutTier(width);
    const ui = ensureUiState();
    ui.layout.tier = tier;
    document.body.dataset.layoutTier = tier;

    const widths = getPanelWidths(tier);
    document.documentElement.style.setProperty('--editor-layout-nav', widths.nav + 'px');
    document.documentElement.style.setProperty('--editor-layout-sidebar', widths.sidebar + 'px');
    document.documentElement.style.setProperty('--editor-layout-inspector', widths.inspector + 'px');

    applyAutoCollapse(tier);
    syncLayoutFabs();
    return tier;
  }

  function bindResize() {
    if (typeof window === 'undefined' || window._editorLayoutResizeBound) return;
    window._editorLayoutResizeBound = true;
    let timer = null;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => applyResponsiveLayout(), 120);
    };
    window.addEventListener('resize', onResize);
  }

  function patchPanelToggles() {
    if (typeof document === 'undefined') return;
    const sidebarToggle = document.getElementById('context-sidebar-toggle');
    if (sidebarToggle && !sidebarToggle._layoutPatched) {
      sidebarToggle._layoutPatched = true;
      sidebarToggle.addEventListener('click', () => {
        setTimeout(() => {
          const ui = ensureUiState();
          ui.layout.sidebarUserExpanded = !ui.sidebarCollapsed;
          applyResponsiveLayout();
        }, 0);
      });
    }
    const inspector = document.getElementById('editor-inspector');
    const inspToggle = inspector?.querySelector('.editor-inspector-toggle');
    if (inspToggle && !inspToggle._layoutPatched) {
      inspToggle._layoutPatched = true;
      inspToggle.addEventListener('click', () => {
        setTimeout(() => {
          const ui = ensureUiState();
          ui.layout.inspectorUserExpanded = !ui.inspectorCollapsed;
          applyResponsiveLayout();
        }, 0);
      });
    }
  }

  function boot() {
    bindResize();
    if (typeof Editor.ensureContextSidebarDom === 'function') {
      try { Editor.ensureContextSidebarDom(); } catch (e) { /* */ }
    } else if (typeof document !== 'undefined') {
      const sidebar = document.getElementById('context-sidebar');
      if (sidebar && sidebar.dataset?.ctxReady !== '1' && typeof Editor.syncContextSidebar === 'function') {
        Editor.syncContextSidebar(Editor.currentTab);
      }
    }
    applyResponsiveLayout();
    patchPanelToggles();
    if (typeof Editor.applyContextLayoutClasses === 'function') {
      try { Editor.applyContextLayoutClasses(); } catch (e) { /* */ }
    }
  }

  Object.assign(Editor, {
    getLayoutTier,
    getLayoutBreakpoints: () => Object.assign({}, BREAKPOINTS),
    getMinWorkspaceWidth: () => MIN_WORKSPACE,
    applyResponsiveLayout,
    toggleContentSidebar: toggleSidebar,
    toggleInspectorPanel: toggleInspector
  });

  if (Editor.hooks && typeof Editor.hooks.after === 'function') {
    Editor.hooks.after('switchTab', function () {
      applyResponsiveLayout();
    }, 'editor-responsive-layout');
    Editor.hooks.after('selectScene', function () {
      applyResponsiveLayout();
    }, 'editor-responsive-layout');
    Editor.hooks.after('renderSceneList', function () {
      applyResponsiveLayout();
    }, 'editor-responsive-layout');
    Editor.hooks.after('renderUnifiedSceneWorkspace', function () {
      applyResponsiveLayout();
    }, 'editor-responsive-layout');
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-responsive-layout', {
      applyResponsiveLayout: Editor.applyResponsiveLayout,
      getLayoutTier: Editor.getLayoutTier,
      toggleContentSidebar: Editor.toggleContentSidebar,
      toggleInspectorPanel: Editor.toggleInspectorPanel
    }, { force: true });
  }

  console.info('[Editor.ResponsiveLayout] ready');
})();
