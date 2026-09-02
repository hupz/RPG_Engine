// ============================================================
// Product Hardening (UI-24) — unify author flow, legacy cleanup
// No schema/runtime/API changes. Redirects + visibility only.
// ============================================================
(function attachProductHardening() {
  'use strict';
  function tr(key, params) {
    if (typeof I18n !== 'undefined' && typeof I18n.t === 'function') return I18n.t(key, params);
    if (typeof t === 'function') return t(key, params);
    return key;
  }
  if (typeof Editor === 'undefined') return;

  function fallbackIsProjectContentEmpty() {
    if (!Editor.data) return true;
    const d = Editor.data;
    const counts = [
      Object.keys(d.scenes || {}).length,
      Object.keys(d.quests || {}).length,
      Object.keys(d.items || {}).length,
      Object.keys(d.npcs || {}).length,
      Object.keys(d.enemies || {}).length,
      Object.keys(d.ui?.screens || {}).length
    ];
    return counts.every((n) => n === 0);
  }

  function projectHasNoContent() {
    if (!Editor.data) return true;
    if (typeof Editor.isProjectContentEmpty === 'function') return Editor.isProjectContentEmpty();
    return fallbackIsProjectContentEmpty();
  }

  /** Unified template entry — starter project vs scene template */
  Editor.openProjectTemplatePicker = function openProjectTemplatePicker() {
    if (!Editor.data || projectHasNoContent()) {
      if (typeof Editor.openNewProjectModal === 'function') return Editor.openNewProjectModal();
    }
    if (typeof Editor.openCreateSceneModal === 'function') return Editor.openCreateSceneModal();
    if (typeof Editor.openSceneWizard === 'function') return Editor.openSceneWizard();
    Editor.toast?.info?.(tr('editor.productHardening.templatesUnavailable'));
    return false;
  };

  function markLegacyNavHidden() {
    if (typeof document === 'undefined') return;
    const legacy = document.querySelector('.tabs-bar--legacy');
    if (legacy) {
      legacy.setAttribute('aria-hidden', 'true');
      legacy.setAttribute('hidden', '');
    }
    const previewToolbar = document.getElementById('preview-test-toolbar');
    if (previewToolbar) previewToolbar.setAttribute('aria-hidden', 'true');
  }

  function syncEmptyProjectShell() {
    if (typeof document === 'undefined' || !document.body) return;
    const noProject = !Editor.data;
    const empty = !!Editor.data && projectHasNoContent();
    document.body.dataset.ui24NoProject = noProject ? '1' : '0';
    document.body.dataset.ui24EmptyProject = empty ? '1' : '0';
    const startScreen = document.getElementById('start-screen');
    if (startScreen) {
      startScreen.hidden = !!Editor.data;
      startScreen.style.display = Editor.data ? 'none' : '';
    }
    const legacyTabs = document.querySelector('.tabs-bar--legacy');
    if (legacyTabs && (noProject || empty)) legacyTabs.setAttribute('hidden', '');
  }

  function ensureStyles() {
    if (typeof document === 'undefined' || document.getElementById('ui24-styles')) return;
    const st = document.createElement('style');
    st.id = 'ui24-styles';
    st.textContent = `
      body.editor-app[data-ui24-no-project="1"] .tab-content { display: none !important; }
      body.editor-app[data-ui24-no-project="1"] #tab-scenes { display: block !important; }
      body.editor-app[data-ui24-no-project="1"] #editor-dashboard,
      body.editor-app[data-ui24-no-project="1"] #start-screen { display: block !important; }
      body.editor-app[data-ui24-empty-project="1"] .tab-content:not(#tab-scenes) { display: none !important; }
      body.editor-app[data-ui24-empty-project="1"] #scene-editor .ws-scene-document { display: none !important; }
      body.editor-app[data-ui24-empty-project="1"] #inspector-panel .inspector-body > :not(.ui24-empty-hint) { opacity: 0.35; pointer-events: none; }
      body.editor-app[data-ui24-no-project="1"] .tabs-bar--legacy,
      body.editor-app[data-ui24-empty-project="1"] .tabs-bar--legacy { display: none !important; }
    `;
    document.head.appendChild(st);
  }

  function wrapLegacyEntry(name, redirect) {
    if (typeof Editor[name] !== 'function' || Editor['_ui24' + name] || !Editor.hooks?.replace) return;
    let savedPrev;
    savedPrev = Editor.hooks.replace(name, function ui24Redirect(...args) {
      const redirected = redirect.apply(this, args);
      return redirected !== undefined ? redirected : (savedPrev ? savedPrev.apply(this, args) : undefined);
    }, 'editor-product-hardening');
    Editor['_ui24' + name] = true;
  }

  function installRedirects() {
    if (Editor._ui24Redirects) return;
    Editor._ui24Redirects = true;
    if (typeof Editor.openExportMenu === 'function' && typeof Editor.openExportSurface === 'function') {
      wrapLegacyEntry('openExportMenu', function () { return Editor.openExportSurface(); });
    }
    if (typeof Editor.openProjectSearch === 'function' && typeof Editor.openCommandPalette === 'function') {
      Editor.hooks.replace('openProjectSearch', function openProjectSearchUi24(prefill) {
        return Editor.openCommandPalette(prefill);
      }, 'editor-product-hardening');
      Editor._ui24openProjectSearch = true;
    }
  }

  function onProjectChange() {
    try {
      syncEmptyProjectShell();
      markLegacyNavHidden();
    } catch (e) { /* */ }
  }

  markLegacyNavHidden();
  ensureStyles();
  installRedirects();
  syncEmptyProjectShell();

  if (Editor.hooks?.after) {
    ['loadData', 'applyLoadedProject', 'newProject', 'renderSceneList', 'renderUnifiedSceneWorkspace'].forEach((hook) => {
      Editor.hooks.after(hook, onProjectChange, 'editor-product-hardening');
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onProjectChange);
    } else {
      setTimeout(onProjectChange, 0);
    }
  }

  if (typeof Editor.isProjectContentEmpty !== 'function') {
    Editor.isProjectContentEmpty = fallbackIsProjectContentEmpty;
  }

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-product-hardening', {
      openProjectTemplatePicker: Editor.openProjectTemplatePicker,
      syncEmptyProjectShell
    }, { force: true });
  }

  console.info('[Editor.UI24] product hardening ready');
})();
