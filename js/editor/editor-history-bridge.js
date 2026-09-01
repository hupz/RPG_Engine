// ============================================================
// Editor History bridge — ownership for undo/history API
// Реализация: js/editor-history.js (подключается отдельно)
// ============================================================
(function editorHistoryBridge() {
  'use strict';
  if (typeof Editor === 'undefined') return;
  Editor.__historyModule = 'editor-history';
  if (Editor.hooks && typeof Editor.hooks.register === 'function') {
    const methods = {};
    if (typeof Editor.undo === 'function') methods.undo = Editor.undo;
    if (typeof Editor.redo === 'function') methods.redo = Editor.redo;
    if (typeof Editor.pushHistory === 'function') methods.pushHistory = Editor.pushHistory;
    if (Object.keys(methods).length) {
      Editor.hooks.register('editor-history', methods, { force: false });
    }
  }
})();
