// ============================================================
// Editor utils (вынесено из editor.html) — escape, icons
// Подключать ПОСЛЕ const Editor = {...} базового объекта
// или ДО — тогда допишет прототип при наличии.
// ============================================================
(function attachEditorUtils() {
  if (typeof Editor === 'undefined') {
    console.warn('editor-utils.js: Editor не определён');
    return;
  }

  // Не перетираем, если уже есть в editor.html
  if (typeof Editor.escapeHtml !== 'function') {
    Editor.escapeHtml = function (str) {
      return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    };
  }
  if (typeof Editor.escapeAttr !== 'function') {
    Editor.escapeAttr = function (str) {
      return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    };
  }
  if (typeof Editor.escapeTextarea !== 'function') {
    Editor.escapeTextarea = function (str) {
      return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    };
  }

  Editor.ARCH = Editor.ARCH || {
    hooks: true,
    dataVersion: typeof ProjectDataSchema !== 'undefined' ? ProjectDataSchema.DATA_VERSION : null,
    note: 'Prefer Editor.hooks.after/before instead of replacing Editor methods'
  };
})();
