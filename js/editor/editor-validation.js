// ============================================================
// Editor Validation — регистрация API проверки проекта
// Реализация: editor-linter.js, editor-validator.js
// ============================================================
(function editorValidation() {
  'use strict';
  if (typeof Editor === 'undefined') return;

  Editor.__validationModule = 'editor-validation';

  if (typeof Editor.runProjectValidation !== 'function') {
    Editor.runProjectValidation = function () {
      if (typeof this.validateAll === 'function') return this.validateAll();
      if (typeof this.validateProjectExtended === 'function') return this.validateProjectExtended();
      console.warn('[editor-validation] no validator loaded');
    };
  }

  if (Editor.hooks && typeof Editor.hooks.register === 'function') {
    const methods = { runProjectValidation: Editor.runProjectValidation };
    if (typeof Editor.validateAll === 'function') methods.validateAll = Editor.validateAll;
    if (typeof Editor.validateProjectExtended === 'function') {
      methods.validateProjectExtended = Editor.validateProjectExtended;
    }
    Editor.hooks.register('editor-validation', methods, { force: false });
  }
})();
