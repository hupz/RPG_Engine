// ============================================================
// Export & Release UX (UI-22) — unified export surface
// Uses existing editor-export.js pipeline — no duplicate exporter.
// ============================================================
(function attachExportFlow() {
  'use strict';
  function tr(key, params) {
    if (typeof I18n !== 'undefined' && typeof I18n.t === 'function') return I18n.t(key, params);
    if (typeof t === 'function') return t(key, params);
    return key;
  }

  if (typeof Editor === 'undefined') return;

  const EXPORT_FORMATS = [
    // i18n labels: Project JSON, Standalone HTML, Web Folder
    {
      id: 'json',
      labelKey: 'editor.exportFlow.formats.json.label',
      descriptionKey: 'editor.exportFlow.formats.json.description',
      icon: '📁',
      isAvailable() { return true; }
    },
    {
      id: 'html',
      labelKey: 'editor.exportFlow.formats.html.label',
      descriptionKey: 'editor.exportFlow.formats.html.description',
      icon: '🌐',
      isAvailable() { return typeof Editor.exportHTML === 'function'; }
    },
    {
      id: 'folder',
      labelKey: 'editor.exportFlow.formats.folder.label',
      descriptionKey: 'editor.exportFlow.formats.folder.description',
      icon: '📦',
      isAvailable() { return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'; }
    }
  ];

  function formatLabel(fmt) {
    return tr(fmt.labelKey);
  }

  function formatDescription(fmt) {
    return tr(fmt.descriptionKey);
  }

  function esc(s) {
    return typeof Editor.escapeHtml === 'function' ? Editor.escapeHtml(String(s ?? '')) : String(s ?? '');
  }

  function slugifyFilename(title) {
    return String(title || tr('editor.exportFlow.defaultSlug'))
      .replace(/[^\wа-яёА-ЯЁ\-]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || tr('editor.exportFlow.defaultSlug');
  }

  function getProjectTitle() {
    return Editor.data?.meta?.title || Editor.data?.meta?.name || tr('editor.exportFlow.untitledProject');
  }

  function getExportValidation() {
    if (typeof Editor.validateProjectExportReady === 'function') {
      return Editor.validateProjectExportReady();
    }
    return { ok: true, issues: [], errors: [], warnings: [] };
  }

  /** Внутренний bypass: UI-22 уже проверил проект, не запускать гейт повторно на exportJSON/HTML/folder. */
  let exportGateBypassDepth = 0;

  function runWithExportGateBypass(fn) {
    exportGateBypassDepth++;
    try {
      return fn();
    } finally {
      exportGateBypassDepth--;
    }
  }

  async function runWithExportGateBypassAsync(fn) {
    exportGateBypassDepth++;
    try {
      return await fn();
    } finally {
      exportGateBypassDepth--;
    }
  }

  function showValidationForExport(result) {
    if (typeof Editor.showProjectValidationResults !== 'function') return;
    let issues = result.issues || [];
    if (typeof Editor.ValidatorNav?.enrichIssue === 'function') {
      issues = issues.map((iss) => Editor.ValidatorNav.enrichIssue(iss, Editor.data));
    }
    Editor.showProjectValidationResults({
      ok: false,
      issues,
      errors: issues.filter((i) => i.severity === 'error'),
      warnings: issues.filter((i) => i.severity === 'warning'),
      info: issues.filter((i) => i.severity === 'info')
    });
  }

  /**
   * Единый гейт экспорта: ошибки — модалка валидации; предупреждения — confirm.
   * @param {{ force?: boolean, skipGate?: boolean }} opts
   */
  async function guardExportWithValidation(opts) {
    opts = opts || {};
    if (opts.force || opts.skipGate || exportGateBypassDepth > 0) return true;

    const result = getExportValidation();
    Editor._lastExportValidation = result;

    const errCount = result.errors?.length || 0;
    const warnCount = result.warnings?.length || 0;

    if (result.ok && warnCount === 0) return true;

    if (typeof Editor.refreshValidationUI === 'function') {
      try { Editor.refreshValidationUI(); } catch (e) { /* */ }
    }

    const warningsPart = warnCount
      ? tr('editor.exportFlow.confirm.warningsPart', { warnings: warnCount })
      : '';
    const confirmMsg = tr('editor.exportFlow.confirm.message', {
      errors: errCount,
      warningsPart
    });
    const confirmOpts = {
      message: confirmMsg,
      confirmLabel: tr('editor.exportFlow.confirm.confirmLabel'),
      cancelLabel: tr('editor.exportFlow.confirm.cancelLabel'),
      danger: errCount > 0
    };

    if (errCount > 0) {
      showValidationForExport(result);
      if (Editor.toast) {
        Editor.toast.error(tr('editor.exportFlow.toast.exportBlocked', { count: errCount })); // Export blocked
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

  /** Можно ли экспортировать без диалога (нет блокирующих ошибок). */
  function isExportAllowed(opts) {
    opts = opts || {};
    const result = getExportValidation();
    const errCount = result.errors?.length || 0;
    if (errCount > 0) return false;
    if (opts.strict) {
      return !!result.ok && !(result.warnings?.length);
    }
    return true;
  }

  function getAvailableFormats() {
    return EXPORT_FORMATS.filter((f) => f.isAvailable()).map((f) => ({
      id: f.id,
      label: formatLabel(f),
      description: formatDescription(f),
      icon: f.icon,
      isAvailable: f.isAvailable
    }));
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
        '<span class="efx-validation__stat efx-validation__stat--error">' +
        esc(tr('editor.exportFlow.panel.errorsStat', { count: errors })) + '</span>' +
        '<span class="efx-validation__stat efx-validation__stat--warning">' +
        esc(tr('editor.exportFlow.panel.warningsStat', { count: warnings })) + '</span>' +
        (blocked
          ? '<p class="efx-validation__note">' + esc(tr('editor.exportFlow.panel.blockedNote')) + '</p>'
          : (warnings > 0
            ? '<p class="efx-validation__note">' + esc(tr('editor.exportFlow.panel.warningsNote')) + '</p>'
            : '<p class="efx-validation__note">' + esc(tr('editor.exportFlow.panel.passedNote')) + '</p>')) +
        '<button type="button" class="btn btn-ghost btn-sm" data-efx-review="1">' +
        esc(tr('editor.exportFlow.panel.reviewIssues')) + '</button>' +
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
    const canExport = isExportAllowed() && !!Editor.data;
    const exportLabel = summary.warnings > 0 && !summary.blocked
      ? tr('editor.exportFlow.panel.exportAnyway')
      : tr('editor.exportFlow.panel.exportProject');

    return (
      '<div class="efx-panel" data-efx-view="export">' +
      '<div class="efx-head">' +
      '<h2>' + esc(tr('editor.exportFlow.panel.title')) + '</h2>' +
      '<button type="button" class="btn-remove" data-efx-close="1" aria-label="' +
      esc(tr('editor.exportFlow.panel.closeAria')) + '">×</button>' +
      '</div>' +
      '<div class="efx-project">' +
      '<span class="efx-project__label">' + esc(tr('editor.exportFlow.panel.projectLabel')) + '</span>' +
      '<span class="efx-project__title">' + esc(getProjectTitle()) + '</span>' +
      '</div>' +
      '<div class="efx-section">' +
      '<h3 class="efx-section__title">' + esc(tr('editor.exportFlow.panel.formatSection')) + '</h3>' +
      '<div class="efx-formats">' + renderFormatOptions(selected) + '</div>' +
      '</div>' +
      '<div class="efx-section">' +
      '<h3 class="efx-section__title">' + esc(tr('editor.exportFlow.panel.validationSection')) + '</h3>' +
      summary.html +
      '</div>' +
      '<div class="efx-actions">' +
      '<button type="button" class="btn btn-secondary" data-efx-close="1">' +
      esc(tr('editor.exportFlow.panel.cancel')) + '</button>' +
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
      '<h2>' + esc(tr('editor.exportFlow.result.title')) + '</h2>' + // Export complete
      '<button type="button" class="btn-remove" data-efx-close="1" aria-label="' +
      esc(tr('editor.exportFlow.panel.closeAria')) + '">×</button>' +
      '</div>' +
      '<p class="efx-result__lead">' + esc(tr('editor.exportFlow.result.lead')) + '</p>' +
      '<div class="efx-result__files">' +
      '<h3 class="efx-section__title">' + esc(tr('editor.exportFlow.result.generatedFiles')) + '</h3>' + // Generated files
      (files.length
        ? '<ul class="efx-file-list">' + files.map((f) => '<li><code>' + esc(f) + '</code></li>').join('') + '</ul>'
        : '<p class="hint">' + esc(tr('editor.exportFlow.result.downloadStarted')) + '</p>') +
      (result.note ? '<p class="hint efx-result__note">' + esc(result.note) + '</p>' : '') +
      '</div>' +
      '<div class="efx-actions">' +
      '<button type="button" class="btn btn-primary" data-efx-close="1">' +
      esc(tr('editor.exportFlow.result.done')) + '</button>' +
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
      Editor.toast?.warning?.(tr('editor.exportFlow.toast.noProjectData'));
      return null;
    }

    const validation = getExportValidation();
    if ((validation.errors?.length || 0) > 0) {
      Editor.toast?.error?.(tr('editor.exportFlow.toast.exportBlockedFix'));
      showValidationForExport(validation);
      return null;
    }

    const title = slugifyFilename(getProjectTitle());
    const result = { format, files: [], note: '' };

    try {
      return await runWithExportGateBypassAsync(async () => {
      if (format === 'json') {
        if (typeof Editor.exportJSON !== 'function') throw new Error('exportJSON unavailable');
        await Promise.resolve(Editor.exportJSON());
        result.files = [title + '.json'];
      } else if (format === 'html') {
        if (typeof Editor.exportHTML !== 'function') throw new Error('exportHTML unavailable');
        await Editor.exportHTML();
        result.files = [title + '.html'];
        result.note = tr('editor.exportFlow.result.htmlNote');
      } else if (format === 'folder') {
        if (typeof Editor.exportGameStandalone !== 'function') throw new Error('exportGameStandalone unavailable');
        await Editor.exportGameStandalone();
        result.files = [tr('editor.exportFlow.result.folderFiles')];
        result.note = tr('editor.exportFlow.result.folderNote');
      } else {
        throw new Error('Unknown export format: ' + format);
      }
      return result;
      });
    } catch (e) {
      console.error('[ExportFlow]', e);
      Editor.toast?.error?.(String(e.message || e));
      return null;
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
      Editor.toast?.warning?.(tr('editor.exportFlow.toast.loadProjectFirst'));
      return false;
    }
    const modal = ensureModal();
    refreshExportView(modal, opts.format || null);
    bindModal(modal);
    modal.classList.remove('hidden');
    return true;
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
    formatLabel,
    formatDescription,
    getAvailableFormats,
    getExportValidation,
    guardExportWithValidation,
    isExportAllowed,
    openExportSurface,
    runExport,
    runWithExportGateBypass,
    runWithExportGateBypassAsync
  };

  Editor.ExportFlow = ExportFlow;
  Editor.openExportMenu = openExportSurface;
  Editor.openExportSurface = openExportSurface;
  Editor.isExportAllowed = isExportAllowed;

  if (Editor.hooks?.replace) {
    Editor.hooks.replace('guardExportWithValidation', guardExportWithValidation, 'editor-export-flow');
  } else {
    Editor.guardExportWithValidation = guardExportWithValidation;
  }

  if (typeof document !== 'undefined') {
    ensureStyles();
  }

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-export-flow', ExportFlow, { force: true });
  }

  console.info('[Editor.ExportFlow] ready');
})();
