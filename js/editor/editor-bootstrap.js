// ============================================================
// Editor Bootstrap — старт UI после загрузки модулей
// Владелец: editor-bootstrap
// ============================================================
(function editorBootstrap() {
  'use strict';
  if (typeof Editor === 'undefined') {
    console.error('editor-bootstrap: Editor missing');
    return;
  }

  function registerEditorCoreApi() {
    if (typeof Editor === 'undefined' || !Editor.hooks || typeof Editor.hooks.register !== 'function') return;
    Editor.hooks.register('editor-core', {
      escapeHtml: Editor.escapeHtml,
      escapeAttr: Editor.escapeAttr,
      renderIcon: Editor.renderIcon,
      renderIconPreview: Editor.renderIconPreview,
      renderIconEmojiSelect: Editor.renderIconEmojiSelect,
      getWeaponItems: Editor.getWeaponItems,
      getAllItemIds: Editor.getAllItemIds,
      loadData: Editor.loadData,
      newProject: Editor.newProject,
      showDashboard: Editor.showDashboard
    }, { force: true });
  }
  registerEditorCoreApi();


  function initEditorTheme() {
    if (typeof ThemeSystem === 'undefined') return;
    ThemeSystem.initAppTheme();
    const btn = document.getElementById('editor-theme-toggle');
    if (btn) ThemeSystem.registerToggleButton(btn);
  }

  function editorAppBootstrap() {
    try {
      initEditorTheme();
      if (typeof Editor.updateProjectPanel === 'function') Editor.updateProjectPanel();
      if (typeof Editor.initEditorNav === 'function') Editor.initEditorNav();
      if (typeof Editor.initEditorMode === 'function') Editor.initEditorMode();
      if (typeof Editor.showDashboard === 'function') Editor.showDashboard();
      if (typeof I18n !== 'undefined' && I18n.isLoaded()) I18n.applyDocument();
    } catch (e) {
      console.error('[editor-bootstrap]', e);
    }
  }

  Editor.editorAppBootstrap = editorAppBootstrap;
  // global for legacy listeners
  window.editorAppBootstrap = editorAppBootstrap;

  if (typeof document !== 'undefined') {
    document.addEventListener('i18n-ready', editorAppBootstrap);
    document.addEventListener('DOMContentLoaded', () => {
      initEditorTheme();
      if (typeof I18n !== 'undefined' && I18n._ready) editorAppBootstrap();
    });
  }

  if (Editor.hooks && typeof Editor.hooks.register === 'function') {
    Editor.hooks.register('editor-bootstrap', {
      editorAppBootstrap: Editor.editorAppBootstrap
    }, { force: true });
  }
})();
