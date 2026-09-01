// ============================================================
// Visual Polish (UI-17) — boot flag, toolbar hierarchy, legacy bridge
// Presentation only. Extends UI-5/UI-10 design system.
// ============================================================
(function attachVisualPolish() {
  'use strict';

  if (typeof Editor === 'undefined') return;

  const POLISH_FLAG = 'uiPolish';

  function isPolishActive() {
    return typeof document !== 'undefined' &&
      document.body &&
      document.body.dataset[POLISH_FLAG] === '1';
  }

  function markPolishActive() {
    if (typeof document === 'undefined' || !document.body) return;
    document.body.dataset[POLISH_FLAG] = '1';
  }

  const TOOLBAR_SELECTORS = [
    '.header-buttons',
    '.ws-scene-header__actions',
    '.ui-toolbar',
    '.editor-section-bar',
    '.usw-overview__actions',
    '.cb-create-footer'
  ];

  function isPrimaryCandidate(btn) {
    if (!btn || btn.disabled) return false;
    if (btn.classList.contains('export-menu-toggle')) return true;
    const text = (btn.textContent || '').toLowerCase();
    if (/сохран|save|экспорт|export|создать первую|create scene/i.test(text)) return true;
    if (btn.dataset.primary === '1') return true;
    return false;
  }

  /** One primary action per toolbar — demote extras to secondary. */
  function normalizeToolbarHierarchy(root) {
    if (typeof document === 'undefined') return;
    const scope = root && root.querySelectorAll ? root : document;
    TOOLBAR_SELECTORS.forEach((sel) => {
      scope.querySelectorAll(sel).forEach((bar) => {
        const primaries = Array.from(bar.querySelectorAll('.btn-primary'));
        if (primaries.length <= 1) {
          bar.classList.remove('ui-toolbar-demoted');
          bar.classList.toggle('ui-toolbar-single-primary', primaries.length === 1);
          return;
        }
        let keptPrimary = false;
        primaries.forEach((btn) => {
          if (!keptPrimary && isPrimaryCandidate(btn)) {
            keptPrimary = true;
            return;
          }
          if (!keptPrimary) {
            keptPrimary = true;
            return;
          }
          btn.classList.remove('btn-primary');
          btn.classList.add('btn-secondary');
        });
        bar.classList.add('ui-toolbar-demoted');
        bar.classList.add('ui-toolbar-single-primary');
      });
    });
  }

  function bridgeLegacyValidationAlerts() {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.validation-errors').forEach((el) => {
      if (!el.classList.contains('ui-alert')) {
        el.classList.add('ui-alert', 'ui-alert--error');
      }
    });
    document.querySelectorAll('.editor-nav-onboarding').forEach((el) => {
      if (!el.classList.contains('ui-alert')) {
        el.classList.add('ui-alert', 'ui-alert--info');
      }
    });
  }

  function applyPolish() {
    markPolishActive();
    normalizeToolbarHierarchy(document);
    bridgeLegacyValidationAlerts();
  }

  Object.assign(Editor, {
    isVisualPolishActive: isPolishActive,
    applyVisualPolish: applyPolish,
    normalizeToolbarHierarchy
  });

  if (Editor.hooks && typeof Editor.hooks.after === 'function') {
    Editor.hooks.after('switchTab', function () {
      applyPolish();
    }, 'editor-visual-polish');
    Editor.hooks.after('renderSceneList', function () {
      normalizeToolbarHierarchy(document);
    }, 'editor-visual-polish');
    Editor.hooks.after('renderUnifiedSceneWorkspace', function () {
      normalizeToolbarHierarchy(document);
    }, 'editor-visual-polish');
    Editor.hooks.after('applyEditorMode', function () {
      applyPolish();
    }, 'editor-visual-polish');
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', applyPolish);
    } else {
      applyPolish();
    }
  }

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-visual-polish', {
      isVisualPolishActive: Editor.isVisualPolishActive,
      applyVisualPolish: Editor.applyVisualPolish,
      normalizeToolbarHierarchy: Editor.normalizeToolbarHierarchy
    }, { force: true });
  }

  console.info('[Editor.VisualPolish] ready');
})();
