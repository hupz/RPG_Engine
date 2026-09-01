// ============================================================
// Preview Workflow (UI-11) — Edit → Save → Preview UX layer
// Uses existing editor test isolation (Phase 1.12). No new runtime.
// ============================================================
(function attachPreviewWorkflow() {
  'use strict';

  if (typeof Editor === 'undefined') return;

  const RETURN_KEY = 'rpg_editor_preview_return';
  const PREVIEW_MODE_KEY = 'rpg_editor_preview_mode';

  function esc(s) {
    return typeof Editor.escapeHtml === 'function'
      ? Editor.escapeHtml(String(s == null ? '' : s))
      : String(s == null ? '' : s);
  }

  function isAdvanced() {
    return (typeof Editor.isEditorAdvancedMode === 'function' && Editor.isEditorAdvancedMode()) ||
      (typeof Editor.isAdvancedMode === 'function' && Editor.isAdvancedMode());
  }

  function getStartSceneId() {
    const d = Editor.data || {};
    if (typeof ProjectSchema !== 'undefined' && typeof ProjectSchema.resolveProjectStartSceneId === 'function') {
      const resolved = ProjectSchema.resolveProjectStartSceneId(d);
      return resolved || null;
    }
    const start = d.startScene || d.meta?.startScene;
    if (start && d.scenes?.[start]) return start;
    const keys = Object.keys(d.scenes || {});
    return keys[0] || null;
  }

  function normalizePreviewMode(mode) {
    if (!mode || mode === 'project') return mode === 'project' ? 'start' : 'current';
    if (mode === 'start' || mode === 'current') return mode;
    return 'current';
  }

  function getPreviewProjectLabel() {
    const d = Editor.data || {};
    return d.meta?.title || d.meta?.name || d.title || 'Project';
  }

  function getPreviewSceneLabel(sceneId) {
    if (!sceneId) return '—';
    const scene = Editor.data?.scenes?.[sceneId];
    return scene?.location || scene?.title || sceneId;
  }

  function resolvePreviewSceneId(opts) {
    opts = opts || {};
    const mode = normalizePreviewMode(opts.mode || opts.previewMode || readStoredPreviewMode() || 'current');
    if (mode === 'start') return getStartSceneId();
    return opts.sceneId || Editor.currentScene || getStartSceneId();
  }

  function readStoredPreviewMode() {
    try {
      return sessionStorage.getItem(PREVIEW_MODE_KEY) || 'current';
    } catch (e) {
      return 'current';
    }
  }

  function storePreviewMode(mode) {
    try {
      sessionStorage.setItem(PREVIEW_MODE_KEY, normalizePreviewMode(mode));
    } catch (e) { /* */ }
  }

  function flushEditorState() {
    try {
      if (typeof Editor.updateJSONPreview === 'function') Editor.updateJSONPreview();
      if (typeof Editor.syncSceneFieldsFromDom === 'function') Editor.syncSceneFieldsFromDom();
    } catch (e) { /* */ }
  }

  function issueSeverity(iss) {
    return iss.severity || iss.level || 'warning';
  }

  function issueRelatesToScene(iss, sceneId) {
    if (!sceneId) return true;
    if (iss.sceneId === sceneId || iss.entityId === sceneId || iss.targetId === sceneId) return true;
    const path = iss.path || '';
    return path.indexOf('scenes.' + sceneId) >= 0;
  }

  function getPreviewValidation(sceneId) {
    let report = { valid: true, issues: [], summary: { errors: 0, warnings: 0 } };
    if (typeof Editor.validateProject === 'function') {
      report = Editor.validateProject(Editor.data) || report;
    } else if (typeof ProjectValidator !== 'undefined' && ProjectValidator.validateProject) {
      report = ProjectValidator.validateProject(Editor.data) || report;
    }
    const all = Array.isArray(report.issues) ? report.issues : [];
    const relevant = sceneId ? all.filter((i) => issueRelatesToScene(i, sceneId)) : all;
    const errors = relevant.filter((i) => issueSeverity(i) === 'error');
    const warnings = relevant.filter((i) => issueSeverity(i) === 'warning');
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      errorCount: errors.length,
      warningCount: warnings.length,
      sceneId
    };
  }

  function saveReturnNavigationState() {
    const state = {
      sceneId: Editor.currentScene,
      tab: Editor.currentTab,
      workspaceSection: typeof Editor.getSceneWorkspaceSection === 'function'
        ? Editor.getSceneWorkspaceSection() : null,
      workspaceActiveId: Editor.workspace?.activeId || null,
      timestamp: Date.now()
    };
    try {
      sessionStorage.setItem(RETURN_KEY, JSON.stringify(state));
    } catch (e) { /* */ }
    if (state.sceneId && typeof Editor.buildTestSession === 'function') {
      return state;
    }
    return state;
  }

  function readReturnNavigationState() {
    try {
      const raw = sessionStorage.getItem(RETURN_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function clearReturnNavigationState() {
    try {
      sessionStorage.removeItem(RETURN_KEY);
    } catch (e) { /* */ }
  }

  function restoreReturnNavigationState() {
    const state = readReturnNavigationState();
    if (!state) return false;
    clearReturnNavigationState();

    if (state.tab && typeof Editor.switchTab === 'function') {
      Editor.switchTab(state.tab);
    }
    if (state.sceneId) {
      if (typeof Editor.openSceneWorkspace === 'function') {
        Editor.openSceneWorkspace(state.sceneId);
      } else if (typeof Editor.openSceneDocument === 'function') {
        Editor.openSceneDocument(state.sceneId);
      } else if (typeof Editor.selectScene === 'function') {
        Editor.selectScene(state.sceneId);
      }
    }
    if (state.workspaceSection && typeof Editor.setSceneWorkspaceSection === 'function') {
      Editor.setSceneWorkspaceSection(state.workspaceSection);
    }
    Editor.toast?.info?.('Возврат в редактор');
    return true;
  }

  function launchIsolatedPreview(sceneId, sessionExtras) {
    if (!Editor.data) {
      Editor.toast?.warning?.('Нет данных проекта');
      return false;
    }
    sessionExtras = sessionExtras || {};
    const session = typeof Editor.buildTestSession === 'function'
      ? Editor.buildTestSession(Object.assign({
        sceneId: sceneId,
        previewMode: sessionExtras.previewMode,
        projectTitle: getPreviewProjectLabel()
      }, sessionExtras))
      : {
        mode: 'editor_test',
        sceneId,
        previewMode: sessionExtras.previewMode,
        projectTitle: getPreviewProjectLabel(),
        createdAt: Date.now()
      };
    session.returnState = saveReturnNavigationState();
    if (sessionExtras.previewMode) session.previewMode = sessionExtras.previewMode;

    try {
      if (typeof Editor.prepareEditorTestLaunch === 'function') {
        Editor.prepareEditorTestLaunch(session);
      } else if (typeof EditorTestKeys !== 'undefined') {
        EditorTestKeys.writeTestData(Editor.data);
        EditorTestKeys.writeSession(session);
      } else {
        Editor.toast?.error?.('Изоляция теста недоступна');
        return false;
      }
    } catch (e) {
      console.error('[previewWorkflow]', e);
      Editor.toast?.error?.('Не удалось подготовить превью');
      return false;
    }

    const url = 'index.html?editorTest=1&t=' + Date.now();
    if (typeof window !== 'undefined' && window.open) {
      window.open(url, '_blank', 'noopener');
    }
    Editor.toast?.success?.('Превью открыто — EDITOR TEST MODE');
    return true;
  }

  function showValidationGate(validation, onFix, onContinue) {
    if (typeof document === 'undefined') {
      if (validation.errorCount > 0 && !isAdvanced()) return;
      onContinue();
      return;
    }

    let modal = document.getElementById('epw-validation-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'epw-validation-modal';
      modal.className = 'epw-validation-modal';
      modal.hidden = true;
      document.body.appendChild(modal);
    }

    const errLines = validation.errors.slice(0, 8).map((e) =>
      '<li>' + esc(e.message || e.type || 'Ошибка') + '</li>'
    ).join('');
    const warnNote = validation.warningCount
      ? '<p class="hint">Предупреждений: ' + validation.warningCount + ' — превью разрешено.</p>'
      : '';

    modal.innerHTML =
      '<div class="epw-validation-modal__card" role="dialog" aria-labelledby="epw-val-title">' +
      '<h3 id="epw-val-title">Перед превью</h3>' +
      (validation.errorCount
        ? '<p><strong>' + validation.errorCount + '</strong> ' +
          (validation.errorCount === 1 ? 'ошибка' : 'ошибок') + ' найдено.</p>' +
          '<ul class="epw-validation-list">' + errLines + '</ul>'
        : '<p>Ошибок нет.</p>') +
      warnNote +
      '<div class="epw-validation-modal__actions">' +
      '<button type="button" class="btn btn-secondary" data-epw-val="fix">Исправить</button>' +
      (validation.errorCount && isAdvanced()
        ? '<button type="button" class="btn btn-ghost" data-epw-val="anyway">Превью всё равно</button>'
        : '') +
      (validation.errorCount === 0
        ? '<button type="button" class="btn btn-primary" data-epw-val="continue">Продолжить</button>'
        : '') +
      '<button type="button" class="btn btn-ghost" data-epw-val="cancel">Отмена</button>' +
      '</div></div>';

    modal.hidden = false;
    modal.onclick = (ev) => {
      const btn = ev.target.closest('[data-epw-val]');
      if (!btn) return;
      const act = btn.getAttribute('data-epw-val');
      modal.hidden = true;
      if (act === 'fix') onFix();
      else if (act === 'anyway' || act === 'continue') onContinue();
    };
  }

  function previewScene(opts) {
    opts = opts || {};
    const mode = normalizePreviewMode(opts.mode || opts.previewMode || readStoredPreviewMode());
    storePreviewMode(mode);
    opts = Object.assign({}, opts, { mode });

    flushEditorState();

    const sceneId = resolvePreviewSceneId(opts);
    if (!sceneId) {
      Editor.toast?.warning?.('Нет сцены для превью');
      return false;
    }

    const validation = getPreviewValidation(sceneId);
    const force = !!opts.force;
    const sessionExtras = {};
    ['questId', 'stageIndex', 'npcId', 'dialogueIndex', 'choiceIndex', 'charName', 'gold', 'inventory', 'flags']
      .forEach((k) => {
        if (opts[k] != null) sessionExtras[k] = opts[k];
      });

    const doLaunch = () => launchIsolatedPreview(sceneId, Object.assign({ previewMode: mode }, sessionExtras));

    if (validation.errorCount > 0 && !force) {
      showValidationGate(
        validation,
        () => {
          if (typeof Editor.runProjectValidation === 'function') Editor.runProjectValidation();
          else if (typeof Editor.showProjectIntegrityPanel === 'function') {
            Editor.showProjectIntegrityPanel(Editor.validateProject?.());
          }
        },
        () => {
          if (isAdvanced()) doLaunch();
        }
      );
      return false;
    }

    if (validation.warningCount > 0) {
      Editor.toast?.info?.('Превью с ' + validation.warningCount + ' предупр.');
    }

    return doLaunch();
  }

  function renderPreviewMenuHtml() {
    return (
      '<div class="epw-preview-menu" role="menu" data-epw-menu="1">' +
      '<p class="epw-preview-menu__heading">Preview</p>' +
      '<button type="button" class="epw-preview-menu__item" role="menuitem" data-epw-mode="current">' +
      'Play Current Scene</button>' +
      '<button type="button" class="epw-preview-menu__item" role="menuitem" data-epw-mode="start">' +
      'Play From Project Start</button>' +
      '</div>'
    );
  }

  function renderPreviewClusterHtml() {
    const sceneLabel = getPreviewSceneLabel(Editor.currentScene);
    return (
      '<div class="epw-preview-cluster" data-epw-cluster="1">' +
      '<details class="epw-preview-dropdown">' +
      '<summary class="btn btn-primary btn-sm epw-preview-trigger" title="Preview in isolated test mode">' +
      '<span class="epw-preview-trigger__label">Preview</span>' +
      '<span class="epw-preview-trigger__caret" aria-hidden="true">▾</span>' +
      '</summary>' +
      renderPreviewMenuHtml() +
      '</details>' +
      '<span class="epw-preview-context hint" title="Current scene">' + esc(sceneLabel) + '</span>' +
      '</div>'
    );
  }

  function bindPreviewEntry(root) {
    if (!root || root.dataset.epwBound) return;
    root.dataset.epwBound = '1';
    root.addEventListener('click', (ev) => {
      const modeBtn = ev.target.closest('[data-epw-mode]');
      if (!modeBtn || !root.contains(modeBtn)) return;
      ev.preventDefault();
      const mode = modeBtn.getAttribute('data-epw-mode');
      const details = modeBtn.closest('details.epw-preview-dropdown');
      if (details) details.open = false;
      previewScene({ mode });
    });
  }

  function injectGlobalPreviewEntry() {
    if (typeof document === 'undefined') return;
    const header = document.querySelector('.header-buttons');
    if (!header || header.querySelector('[data-epw-global]')) return;

    const wrap = document.createElement('div');
    wrap.className = 'epw-global-preview';
    wrap.dataset.epwGlobal = '1';
    wrap.innerHTML =
      '<details class="epw-preview-dropdown epw-preview-dropdown--global">' +
      '<summary class="btn btn-secondary epw-preview-trigger" title="Preview in isolated test mode">' +
      '<span class="epw-preview-trigger__label">▶ Preview</span>' +
      '<span class="epw-preview-trigger__caret" aria-hidden="true">▾</span>' +
      '</summary>' +
      renderPreviewMenuHtml() +
      '</details>';
    const validateBtn = header.querySelector('[onclick*="runProjectValidation"]');
    if (validateBtn) header.insertBefore(wrap, validateBtn);
    else header.appendChild(wrap);
    bindPreviewEntry(wrap);
  }

  function openPreviewMenu() {
    const global = document.querySelector('[data-epw-global] details.epw-preview-dropdown');
    if (global) {
      global.open = true;
      global.querySelector('[data-epw-mode="current"]')?.focus?.();
      return true;
    }
    const cluster = document.querySelector('[data-epw-cluster] details.epw-preview-dropdown');
    if (cluster) {
      cluster.open = true;
      cluster.querySelector('[data-epw-mode="current"]')?.focus?.();
      return true;
    }
    return previewScene({ mode: 'current' });
  }

  function injectPreviewWorkflowChrome() {
    if (typeof document === 'undefined') return;
    const header = document.getElementById('ws-scene-document-header');
    if (!header) return;
    const actions = header.querySelector('.ws-scene-header__actions');
    if (!actions || actions.querySelector('[data-epw-cluster]')) return;

    const wrap = document.createElement('div');
    wrap.innerHTML = renderPreviewClusterHtml();
    const cluster = wrap.firstElementChild;
    if (!cluster) return;
    actions.insertBefore(cluster, actions.firstChild);
    bindPreviewEntry(cluster);

    const legacy = document.getElementById('preview-test-toolbar');
    if (legacy) legacy.style.display = 'none';
  }

  function markPreviewWorkflowActive() {
    if (typeof document !== 'undefined' && document.body) {
      document.body.dataset.epw = '1';
    }
  }

  function checkRestoreOnLoad() {
    try {
      const params = new URLSearchParams(window.location.search || '');
      if (params.get('restoreEditor') === '1') {
        setTimeout(() => restoreReturnNavigationState(), 100);
      }
    } catch (e) { /* */ }
  }

  Object.assign(Editor, {
    previewScene,
    getPreviewValidation,
    flushEditorStateForPreview: flushEditorState,
    savePreviewReturnState: saveReturnNavigationState,
    restorePreviewReturnState: restoreReturnNavigationState,
    clearPreviewReturnState: clearReturnNavigationState,
    openPreviewMenu,
    getPreviewProjectLabel,
    getPreviewSceneLabel,
    normalizePreviewMode,
    isPreviewWorkflowActive() {
      return typeof document !== 'undefined' && document.body?.dataset?.epw === '1';
    }
  });

  // Route legacy APIs through unified flow
  const origTestFromHere = Editor.testFromHere;
  if (typeof origTestFromHere === 'function') {
    Editor.testFromHere = function testFromHereUnified(opts) {
      if (Editor._epwBypassWrap) return origTestFromHere.call(this, opts);
      return previewScene(Object.assign({ mode: 'current' }, opts || {}));
    };
  }

  Editor.testCurrentScene = function testCurrentSceneUnified() {
    if (!Editor.currentScene) {
      Editor.toast?.warning?.('Выберите сцену');
      return false;
    }
    return previewScene({ mode: 'current', sceneId: Editor.currentScene });
  };

  if (Editor.hooks?.after) {
    Editor.hooks.after('injectSceneWorkspaceChrome', function () {
      try { injectPreviewWorkflowChrome(); } catch (e) { /* */ }
    }, 'editor-preview-workflow');

    Editor.hooks.after('renderUnifiedSceneWorkspace', function () {
      try { injectPreviewWorkflowChrome(); } catch (e) { /* */ }
    }, 'editor-preview-workflow');

    Editor.hooks.after('renderSceneEditor', function () {
      try { injectPreviewWorkflowChrome(); } catch (e) { /* */ }
    }, 'editor-preview-workflow');
  }

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-preview-workflow', {
      previewScene,
      getPreviewValidation,
      restorePreviewReturnState: restoreReturnNavigationState
    }, { force: true });
  }

  function ensureStyles() {
    if (typeof document === 'undefined' || document.getElementById('epw-styles')) return;
    const st = document.createElement('style');
    st.id = 'epw-styles';
    st.textContent = `
      .epw-preview-cluster { display: inline-flex; align-items: center; gap: 8px; margin-right: 6px; }
      .epw-preview-context { max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
      .epw-preview-dropdown { position: relative; }
      .epw-preview-dropdown > summary.epw-preview-trigger { list-style: none; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; }
      .epw-preview-dropdown > summary.epw-preview-trigger::-webkit-details-marker { display: none; }
      .epw-preview-trigger__caret { opacity: 0.8; font-size: 10px; }
      .epw-preview-menu { position: absolute; right: 0; top: calc(100% + 4px); z-index: 30; min-width: 220px;
        background: var(--card-bg, #fff); border: 1px solid var(--border); border-radius: 8px;
        padding: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.14); }
      .epw-preview-dropdown:not([open]) .epw-preview-menu { display: none; }
      .epw-preview-menu__heading { margin: 0 0 6px; font-size: 11px; font-weight: 700; letter-spacing: .04em;
        text-transform: uppercase; color: var(--ink-muted, #666); }
      .epw-preview-menu__item { display: block; width: 100%; text-align: left; border: none; background: transparent;
        padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 13px; color: inherit; }
      .epw-preview-menu__item:hover { background: var(--highlight, #f5f5f5); }
      .epw-global-preview { display: inline-flex; align-items: center; }
      .epw-preview-dropdown--global .epw-preview-menu { right: auto; left: 0; }
      .epw-validation-modal { position: fixed; inset: 0; z-index: 100000; background: rgba(0,0,0,.4);
        display: flex; align-items: center; justify-content: center; }
      .epw-validation-modal[hidden] { display: none !important; }
      .epw-validation-modal__card { background: var(--card-bg, #fff); border-radius: 8px; padding: 16px;
        max-width: 420px; width: 90%; box-shadow: 0 8px 24px rgba(0,0,0,.2); }
      .epw-validation-list { margin: 8px 0; padding-left: 18px; font-size: 13px; }
      .epw-validation-modal__actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
      body.editor-app[data-epw="1"] #preview-test-toolbar { display: none !important; }
    `;
    document.head.appendChild(st);
  }

  markPreviewWorkflowActive();
  ensureStyles();
  injectGlobalPreviewEntry();

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        checkRestoreOnLoad();
        injectGlobalPreviewEntry();
      });
    } else {
      checkRestoreOnLoad();
    }
  }

  console.info('[Editor.PreviewWorkflow] ready');
})();
