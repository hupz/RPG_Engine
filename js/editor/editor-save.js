// ============================================================
// Editor Save/Load — module marker
// loadData owner: editor-core (bootstrap register)
// ============================================================
(function editorSave() {
  'use strict';
  if (typeof Editor === 'undefined') return;

  Editor.__saveModule = 'editor-save';

  // Never claim loadData — owned by editor-core.
  if (Editor.hooks && typeof Editor.hooks.register === 'function') {
    const methods = {};
    function tryClaim(name) {
      if (typeof Editor[name] !== 'function') return;
      const owner = typeof Editor.hooks.getOwner === 'function' ? Editor.hooks.getOwner(name) : null;
      if (owner && owner !== 'editor-save') return;
      methods[name] = Editor[name];
    }
    tryClaim('exportJSON');
    tryClaim('setProjectData');
    tryClaim('migrateProjectData');
    if (Object.keys(methods).length) {
      Editor.hooks.register('editor-save', methods, { force: false });
    }
  }
})();
