/**
 * Phase H — Export validation gate + export readiness helpers
 */
(function attachValidationPhaseH() {
  'use strict';

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
    },

    async guardExportWithValidation(opts) {
      opts = opts || {};
      const result = this.validateProjectExportReady();
      this._lastExportValidation = result;
      if (result.ok) return true;
      const errCount = result.errors.length;
      const warnCount = result.warnings.length;
      if (opts.force) return true;
      if (typeof this.refreshValidationUI === 'function') this.refreshValidationUI();
      const msg =
        'Перед экспортом найдены проблемы:\n' +
        'Ошибок: ' + errCount + (warnCount ? ', предупреждений: ' + warnCount : '') +
        '\n\nЭкспорт с ошибками может сломать игру. Продолжить?';
      const confirmOpts = {
        message: msg,
        confirmLabel: 'Продолжить',
        cancelLabel: 'Отмена',
        danger: errCount > 0
      };
      if (errCount > 0) {
        if (typeof this.showProjectValidationResults === 'function') {
          this.showProjectValidationResults({
            ok: false,
            issues: result.issues,
            errors: result.errors,
            warnings: result.warnings
          });
        }
        if (typeof Editor.confirmDialog === 'function') {
          return await Editor.confirmDialog(confirmOpts);
        }
        return false;
      }
      if (warnCount > 0) {
        if (typeof Editor.confirmDialog === 'function') {
          return await Editor.confirmDialog(confirmOpts);
        }
        return false;
      }
      return true;
    }
  });

  function wrapExport(name) {
    const orig = Editor[name];
    if (typeof orig !== 'function' || Editor['_' + name + 'PhaseH']) return;
    Editor['_' + name + 'PhaseH'] = orig;
    Editor[name] = async function exportWithValidationGate() {
      if (!(await Editor.guardExportWithValidation())) return;
      return orig.apply(this, arguments);
    };
  }

  wrapExport('exportJSON');
  wrapExport('openExportHtmlModal');

  if (typeof Editor.exportHTML === 'function') {
    const origHtml = Editor.exportHTML;
    Editor.exportHTML = async function exportHTMLWithGate() {
      if (!(await Editor.guardExportWithValidation())) return;
      return origHtml.apply(this, arguments);
    };
  }

  if (typeof Editor.exportGameStandalone === 'function') {
    const origFolder = Editor.exportGameStandalone;
    Editor.exportGameStandalone = async function exportFolderWithGate() {
      if (!(await Editor.guardExportWithValidation())) return;
      return origFolder.apply(this, arguments);
    };
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
      hint.textContent = '✓ Проект готов к экспорту (Phase H)';
      hint.style.color = '#2e7d32';
    } else if (r.ok) {
      hint.textContent = '⚠ Экспорт возможен с предупреждениями: ' + r.warnings.length;
      hint.style.color = '#f57c00';
    } else {
      hint.textContent = '✗ Экспорт заблокирован: ' + r.errors.length + ' ошибок';
      hint.style.color = '#c62828';
    }
  };
})();
