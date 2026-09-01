// ============================================================
// Editor Navigation — metadata + nav helpers only
// switchTab owner: editor-core-tabs (+ dashboard hooks.replace)
// showDashboard owner: editor-dashboard
// Extensions: editor-nav-layout hooks.after
// ============================================================
(function editorNavigation() {
  'use strict';
  if (typeof Editor === 'undefined') return;

  Editor.__navigationModule = 'editor-navigation';

  if (typeof Editor.syncNavLayout !== 'function') {
    Editor.syncNavLayout = function (tab) {
      /* filled by editor-nav-layout */
    };
  }
  if (typeof Editor.initEditorNav !== 'function') {
    Editor.initEditorNav = function () {
      /* filled by editor-nav-layout */
    };
  }

  // NEVER register switchTab / showDashboard here — not the canonical owner.
  if (Editor.hooks && typeof Editor.hooks.register === 'function') {
    const methods = {};
    if (typeof Editor.syncNavLayout === 'function') methods.syncNavLayout = Editor.syncNavLayout;
    if (typeof Editor.initEditorNav === 'function') methods.initEditorNav = Editor.initEditorNav;
    if (Object.keys(methods).length) {
      Editor.hooks.register('editor-navigation', methods, { force: false });
    }
  }
})();
