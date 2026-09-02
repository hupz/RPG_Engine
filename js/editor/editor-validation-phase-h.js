/**
 * Phase H — Export validation gate + export readiness helpers
 */
(function attachValidationPhaseH() {
  'use strict';
  function tr(key, params) {
    if (typeof I18n !== 'undefined' && typeof I18n.t === 'function') return I18n.t(key, params);
    if (typeof t === 'function') return t(key, params);
    return key;
  }

  if (typeof Editor === 'undefined') return;

  Object.assign(Editor, {
    validateProjectExportReady() {
      if (typeof ProjectSchema !== 'undefined' && ProjectSchema.validateProjectExportReady) {
        return ProjectSchema.validateProjectExportReady(this.data || {});
      }
      if (typeof this.validateProjectExtended === 'function') {
        const r = this.validateProjectExtended();
        return { ok: !!r.ok, issues: r.issues || [], errors: (r.issues || []).filter((i) => i.severity === 'error'), warnings: (r.issues || []).filter((i) => i.severity === 'warning') };
      }
      return { ok: true, issues: [], errors: [], warnings: [] };
    }
  });

  function wrapExport(name) {
    if (typeof Editor[name] !== 'function' || Editor['_' + name + 'PhaseH'] || !Editor.hooks?.replace) return;
    let savedPrev;
    savedPrev = Editor.hooks.replace(name, async function exportWithValidationGate(...args) {
      if (!(await Editor.guardExportWithValidation())) return;
      return savedPrev.apply(this, args);
    }, 'editor-validation-phase-h');
    Editor['_' + name + 'PhaseH'] = true;
  }

  wrapExport('exportJSON');
  wrapExport('openExportHtmlModal');

  if (typeof Editor.exportHTML === 'function' && Editor.hooks?.replace && !Editor._exportHTMLPhaseH) {
    let savedPrevHtml;
    savedPrevHtml = Editor.hooks.replace('exportHTML', async function exportHTMLWithGate(...args) {
      if (!(await Editor.guardExportWithValidation())) return;
      return savedPrevHtml.apply(this, args);
    }, 'editor-validation-phase-h');
    Editor._exportHTMLPhaseH = true;
  }

  if (typeof Editor.exportGameStandalone === 'function' && Editor.hooks?.replace && !Editor._exportGameStandalonePhaseH) {
    let savedPrevFolder;
    savedPrevFolder = Editor.hooks.replace('exportGameStandalone', async function exportFolderWithGate(...args) {
      if (!(await Editor.guardExportWithValidation())) return;
      return savedPrevFolder.apply(this, args);
    }, 'editor-validation-phase-h');
    Editor._exportGameStandalonePhaseH = true;
  }

  if (Editor.hooks?.after) {
    Editor.hooks.after('switchTab', function (_r, args) {
      if (args && args[0] === 'json' && typeof Editor.renderExportValidationHint === 'function') {
        Editor.renderExportValidationHint();
      }
    }, 'editor-validation-phase-h');
  }

  Editor.renderExportValidationHint = function renderExportValidationHint() {
    const preview = document.getElementById('json-preview');
    if (!preview) return;
    let hint = document.getElementById('export-validation-hint');
    if (!hint) {
      hint = document.createElement('p');
      hint.id = 'export-validation-hint';
      hint.className = 'hint';
      hint.style.margin = '8px 0';
      preview.parentNode?.insertBefore(hint, preview);
    }
    const r = Editor.validateProjectExportReady();
    if (r.ok && !r.warnings.length) {
      hint.textContent = tr('editor.validationPhaseH.exportReady');
      hint.style.color = '#2e7d32';
    } else if (r.ok) {
      hint.textContent = tr('editor.validationPhaseH.exportWithWarnings', { count: r.warnings.length });
      hint.style.color = '#f57c00';
    } else {
      hint.textContent = tr('editor.validationPhaseH.exportBlocked', { count: r.errors.length });
      hint.style.color = '#c62828';
    }
  };
})();
