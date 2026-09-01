// ============================================================
// Export & Release UX (UI-22) — unified export surface
// Uses existing editor-export.js pipeline — no duplicate exporter.
// ============================================================
(function attachExportFlow() {
  'use strict';
  if (typeof Editor === 'undefined') return;

  const EXPORT_FORMATS = [
    {
      id: 'json',
      label: 'Project JSON',
      description: 'Editable project file for the RPG Engine editor.',
      icon: '📁',
      isAvailable() { return true; }
    },
    {
      id: 'html',
      label: 'Standalone HTML',
      description: 'Single self-contained HTML file with inlined runtime.',
      icon: '🌐',
      isAvailable() { return typeof Editor.exportHTML === 'function'; }
    },
    {
      id: 'folder',
      label: 'Web Folder',
      description: 'index.html + scripts folder (Chrome / Edge).',
      icon: '📦',
      isAvailable() { return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'; }
    }
  ];

  function esc(s) {
    return typeof Editor.escapeHtml === 'function' ? Editor.escapeHtml(String(s ?? '')) : String(s ?? '');
  }

  function slugifyFilename(title) {
    return String(title || 'project')
      .replace(/[^\wа-яёА-ЯЁ\-]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'project';
  }

  function getProjectTitle() {
    return Editor.data?.meta?.title || Editor.data?.meta?.name || 'Untitled Project';
  }

  function getExportValidation() {
    if (typeof Editor.validateProjectExportReady === 'function') {
      return Editor.validateProjectExportReady();
    }
    return { ok: true, issues: [], errors: [], warnings: [] };
  }

  function getAvailableFormats() {
    return EXPORT_FORMATS.filter((f) => f.isAvailable());
  }

  function renderValidationSummary(validation) {
    const errors = validation.errors?.length || 0;
    const warnings = validation.warnings?.length || 0;
    const blocked = errors > 0;
    return {
      errors,
      warnings,
      blocked,
      html:
        '<div class="efx-validation' + (blocked ? ' efx-validation--blocked' : '') + '">' +
        '<span class="efx-validation__stat efx-validation__stat--error">' + errors + ' Errors</span>' +
        '<span class="efx-validation__stat efx-validation__stat--warning">' + warnings + ' Warnings</span>' +
        (blocked
          ? '<p class="efx-validation__note">Export is blocked until critical errors are fixed.</p>'
          : (warnings > 0
            ? '<p class="efx-validation__note">Warnings do not block export.</p>'
            : '<p class="efx-validation__note">Project passed export validation.</p>')) +
        '<button type="button" class="btn btn-ghost btn-sm" data-efx-review="1">Review issues</button>' +
        '</div>'
    };
  }

  function renderFormatOptions(selectedId) {
    const formats = getAvailableFormats();
    return formats.map((f) =>
      '<label class="efx-format' + (f.id === selectedId ? ' is-selected' : '') + '">' +
      '<input type="radio" name="efx-format" value="' + esc(f.id) + '"' +
      (f.id === selectedId ? ' checked' : '') + ' />' +
      '<span class="efx-format__icon" aria-hidden="true">' + f.icon + '</span>' +
      '<span class="efx-format__body">' +
      '<span class="efx-format__label">' + esc(f.label) + '</span>' +
      '<span class="efx-format__desc hint">' + esc(f.description) + '</span>' +
      '</span></label>'
    ).join('');
  }

  function renderExportPanel(state) {
    state = state || {};
    const validation = state.validation || getExportValidation();
    const summary = renderValidationSummary(validation);
    const selected = state.format || getAvailableFormats()[0]?.id || 'json';
    const canExport = !summary.blocked && !!Editor.data;
    const exportLabel = summary.warnings > 0 && !summary.blocked ? 'Export Anyway' : 'Export Project';

    return (
      '<div class="efx-panel" data-efx-view="export">' +
      '<div class="efx-head">' +
      '<h2>Export Project</h2>' +
      '<button type="button" class="btn-remove" data-efx-close="1" aria-label="Close">×</button>' +
      '</div>' +
      '<div class="efx-project">' +
      '<span class="efx-project__label">Project</span>' +
      '<span class="efx-project__title">' + esc(getProjectTitle()) + '</span>' +
      '</div>' +
      '<div class="efx-section">' +
      '<h3 class="efx-section__title">Export format</h3>' +
      '<div class="efx-formats">' + renderFormatOptions(selected) + '</div>' +
      '</div>' +
      '<div class="efx-section">' +
      '<h3 class="efx-section__title">Validation status</h3>' +
      summary.html +
      '</div>' +
      '<div class="efx-actions">' +
      '<button type="button" class="btn btn-secondary" data-efx-close="1">Cancel</button>' +
      '<button type="button" class="btn btn-primary" data-efx-run="1"' +
      (canExport ? '' : ' disabled') + '>' + esc(exportLabel) + '</button>' +
      '</div></div>'
    );
  }

  function renderResultPanel(result) {
    const files = Array.isArray(result.files) ? result.files : [];
    return (
      '<div class="efx-panel" data-efx-view="result">' +
      '<div class="efx-head">' +
      '<h2>Export complete</h2>' +
      '<button type="button" class="btn-remove" data-efx-close="1" aria-label="Close">×</button>' +
      '</div>' +
      '<p class="efx-result__lead">Your export finished successfully.</p>' +
      '<div class="efx-result__files">' +
      '<h3 class="efx-section__title">Generated files</h3>' +
      (files.length
        ? '<ul class="efx-file-list">' + files.map((f) => '<li><code>' + esc(f) + '</code></li>').join('') + '</ul>'
        : '<p class="hint">Download started in your browser.</p>') +
      (result.note ? '<p class="hint efx-result__note">' + esc(result.note) + '</p>' : '') +
      '</div>' +
      '<div class="efx-actions">' +
      '<button type="button" class="btn btn-primary" data-efx-close="1">Done</button>' +
      '</div></div>'
    );
  }

  function ensureModal() {
    let modal = document.getElementById('editor-export-flow-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'editor-export-flow-modal';
      modal.className = 'editor-modal efx-modal hidden';
      document.body.appendChild(modal);
    }
    return modal;
  }

  function getSelectedFormat(root) {
    const checked = root.querySelector('input[name="efx-format"]:checked');
    return checked ? checked.value : (getAvailableFormats()[0]?.id || 'json');
  }

  function refreshExportView(modal, format) {
    const validation = getExportValidation();
    modal.innerHTML =
      '<div class="editor-modal-backdrop" data-efx-close="1"></div>' +
      '<div class="editor-modal-panel editor-modal-panel--wide efx-modal__card">' +
      renderExportPanel({ validation, format: format || getSelectedFormat(modal) }) +
      '</div>';
  }

  function showResultView(modal, result) {
    modal.innerHTML =
      '<div class="editor-modal-backdrop" data-efx-close="1"></div>' +
      '<div class="editor-modal-panel editor-modal-panel--wide efx-modal__card">' +
      renderResultPanel(result) +
      '</div>';
  }

  async function runExport(format) {
    if (!Editor.data) {
      Editor.toast?.warning?.('No project data loaded');
      return null;
    }

    const validation = getExportValidation();
    if ((validation.errors?.length || 0) > 0) {
      Editor.toast?.error?.('Export blocked: fix critical errors first');
      if (typeof Editor.showProjectValidationResults === 'function') {
        Editor.showProjectValidationResults({
          ok: false,
          issues: validation.issues || [],
          errors: validation.errors || [],
          warnings: validation.warnings || []
        });
      }
      return null;
    }

    Editor._exportFlowValidated = true;
    const title = slugifyFilename(getProjectTitle());
    const result = { format, files: [], note: '' };

    try {
      if (format === 'json') {
        if (typeof Editor.exportJSON !== 'function') throw new Error('exportJSON unavailable');
        Editor.exportJSON();
        result.files = [title + '.json'];
      } else if (format === 'html') {
        if (typeof Editor.exportHTML !== 'function') throw new Error('exportHTML unavailable');
        await Editor.exportHTML();
        result.files = [title + '.html'];
        result.note = 'Standalone HTML uses the existing inlined runtime build.';
      } else if (format === 'folder') {
        if (typeof Editor.exportGameStandalone !== 'function') throw new Error('exportGameStandalone unavailable');
        await Editor.exportGameStandalone();
        result.files = ['index.html', 'js/data.js', 'css/*', 'js/*', 'audio files (if used)'];
        result.note = 'Folder export uses the browser folder picker; open the chosen directory in your file manager.';
      } else {
        throw new Error('Unknown export format: ' + format);
      }
      return result;
    } catch (e) {
      console.error('[ExportFlow]', e);
      Editor.toast?.error?.(String(e.message || e));
      return null;
    } finally {
      Editor._exportFlowValidated = false;
    }
  }

  function bindModal(modal) {
    modal.onclick = async (ev) => {
      if (ev.target.closest('[data-efx-close]')) {
        modal.classList.add('hidden');
        return;
      }
      if (ev.target.closest('[data-efx-review]')) {
        if (typeof Editor.runProjectValidation === 'function') Editor.runProjectValidation();
        return;
      }
      const formatLabel = ev.target.closest('.efx-format');
      if (formatLabel) {
        const input = formatLabel.querySelector('input[name="efx-format"]');
        if (input) refreshExportView(modal, input.value);
        return;
      }
      if (ev.target.closest('[data-efx-run]')) {
        const format = getSelectedFormat(modal);
        const btn = ev.target.closest('[data-efx-run]');
        if (btn) btn.disabled = true;
        const result = await runExport(format);
        if (btn) btn.disabled = false;
        if (result) showResultView(modal, result);
        else refreshExportView(modal, format);
        return;
      }
    };
  }

  function openExportSurface(opts) {
    opts = opts || {};
    if (typeof document === 'undefined') return false;
    if (!Editor.data) {
      Editor.toast?.warning?.('Load or create a project first');
      return false;
    }
    const modal = ensureModal();
    refreshExportView(modal, opts.format || null);
    bindModal(modal);
    modal.classList.remove('hidden');
    return true;
  }

  function patchExportGuardBypass() {
    if (!Editor.guardExportWithValidation || Editor._exportFlowGuardPatched) return;
    const orig = Editor.guardExportWithValidation.bind(Editor);
    Editor.guardExportWithValidation = async function guardExportWithValidationFlow(opts) {
      if (Editor._exportFlowValidated) return true;
      return await orig(opts || {});
    };
    Editor._exportFlowGuardPatched = true;
  }

  function ensureStyles() {
    if (typeof document === 'undefined' || document.getElementById('export-flow-styles')) return;
    const st = document.createElement('style');
    st.id = 'export-flow-styles';
    st.textContent = `
      .efx-modal .efx-modal__card { max-width: 560px; }
      .efx-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
      .efx-head h2 { margin: 0; font-size: 1.15rem; }
      .efx-project { margin-bottom: 14px; padding: 10px 12px; border-radius: 8px; background: var(--highlight, #f7f7f7); }
      .efx-project__label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; opacity: .7; }
      .efx-project__title { font-weight: 700; font-size: 15px; }
      .efx-section { margin-bottom: 14px; }
      .efx-section__title { margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted, #666); }
      .efx-formats { display: flex; flex-direction: column; gap: 8px; }
      .efx-format { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border: 1px solid var(--border, #ddd); border-radius: 8px; cursor: pointer; }
      .efx-format.is-selected { border-color: var(--accent, #4a7c59); background: rgba(74,124,89,.06); }
      .efx-format input { margin-top: 4px; }
      .efx-format__icon { font-size: 18px; line-height: 1; }
      .efx-format__label { display: block; font-weight: 600; font-size: 14px; }
      .efx-format__desc { display: block; font-size: 12px; margin-top: 2px; }
      .efx-validation { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border, #ddd); }
      .efx-validation--blocked { border-color: #e57373; background: #fff8f8; }
      .efx-validation__stat { font-size: 12px; font-weight: 700; padding: 4px 8px; border-radius: 999px; }
      .efx-validation__stat--error { background: #ffebee; color: #b71c1c; }
      .efx-validation__stat--warning { background: #fff8e1; color: #e65100; }
      .efx-validation__note { flex-basis: 100%; margin: 4px 0 0; font-size: 12px; color: var(--muted, #666); }
      .efx-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
      .efx-file-list { margin: 8px 0 0; padding-left: 18px; }
      .efx-result__lead { margin: 0 0 12px; }
      .efx-result__note { margin-top: 8px; }
    `;
    document.head.appendChild(st);
  }

  const ExportFlow = {
    EXPORT_FORMATS,
    getAvailableFormats,
    getExportValidation,
    openExportSurface,
    runExport
  };

  Editor.ExportFlow = ExportFlow;
  Editor.openExportMenu = openExportSurface;
  Editor.openExportSurface = openExportSurface;

  patchExportGuardBypass();
  Editor.applyValidatorExportGuardPatch?.();

  if (typeof document !== 'undefined') {
    ensureStyles();
  }

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-export-flow', ExportFlow, { force: true });
  }

  console.info('[Editor.ExportFlow] ready');
})();
