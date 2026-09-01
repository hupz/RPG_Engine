/**
 * Phase 1.12 — Safe preview / test session (Editor side)
 * Writes only rpg_editor_test_* keys — never production campaign cache.
 */
(function attachEditorTestIsolationPhase112() {
  'use strict';

  if (typeof Editor === 'undefined') return;

  const KEYS = typeof EditorTestKeys !== 'undefined' ? EditorTestKeys : null;

  Object.assign(Editor, {
    prepareEditorTestLaunch(session) {
      if (!Editor.data) {
        throw new Error('No project data');
      }
      if (!KEYS) {
        throw new Error('EditorTestKeys missing');
      }
      KEYS.writeTestData(Editor.data);
      KEYS.writeSession(session);
      return session;
    },

    resetEditorTestStorage(clearData) {
      if (!KEYS) return;
      if (clearData === false) {
        KEYS.clearTestSave?.();
      } else {
        KEYS.clearTestStorage();
      }
      Editor.toast?.success?.('Test session reset (production cache untouched)');
    },

    openEditorTestPreview(opts) {
      opts = opts || {};
      if (!Editor.data) {
        Editor.toast?.warning?.('Нет данных проекта');
        return;
      }
      if (!opts.sceneId && Editor.currentScene) opts.sceneId = Editor.currentScene;
      const session = typeof Editor.buildTestSession === 'function'
        ? Editor.buildTestSession(opts)
        : { mode: 'editor_test', sceneId: opts.sceneId, createdAt: Date.now() };
      try {
        Editor.prepareEditorTestLaunch(session);
      } catch (e) {
        console.error('[editorTest]', e);
        Editor.toast?.error?.('Не удалось подготовить тест');
        return;
      }
      const url = 'index.html?editorTest=1&t=' + Date.now();
      window.open(url, '_blank', 'noopener');
      Editor.toast?.info?.('EDITOR TEST MODE — isolated keys');
    },

    renderPreviewTestToolbar() {
      return (
        '<div class="preview-test-toolbar" id="preview-test-toolbar" style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0;align-items:center;">' +
        '<span class="hint" style="margin-right:4px;">Preview:</span>' +
        '<button type="button" class="btn btn-info btn-sm" data-pt="play" title="Embedded play">▶ Play</button>' +
        '<button type="button" class="btn btn-info btn-sm" data-pt="test" title="Test From Here (isolated)">Test From Here</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-pt="reset" title="Clear test save/data only">Reset Test</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-pt="stop" title="Stop embedded play">Stop Test</button>' +
        '</div>'
      );
    },

    bindPreviewTestToolbar(root) {
      if (!root || root._ptBound) return;
      root._ptBound = true;
      root.addEventListener('click', (ev) => {
        const btn = ev.target.closest('[data-pt]');
        if (!btn) return;
        const action = btn.getAttribute('data-pt');
        if (action === 'play') Editor.startEmbeddedPlay?.({ sceneId: Editor.currentScene });
        else if (action === 'test') Editor.testCurrentScene?.();
        else if (action === 'reset') Editor.resetEditorTestStorage?.(true);
        else if (action === 'stop') Editor.stopEmbeddedPlay?.() || Editor.closeEmbeddedPlayPanel?.();
      });
    },

    injectPreviewTestToolbar() {
      const hosts = [
        document.querySelector('.scenes-preview-pane .live-preview-toolbar'),
        document.querySelector('#live-preview-container'),
        document.querySelector('#scene-editor .scene-editor-toolbar'),
        document.getElementById('scene-editor')
      ].filter(Boolean);
      const host = hosts[0];
      if (!host || host.querySelector('#preview-test-toolbar')) return;
      host.insertAdjacentHTML('afterbegin', Editor.renderPreviewTestToolbar());
      const bar = document.getElementById('preview-test-toolbar');
      if (bar) Editor.bindPreviewTestToolbar(bar);
    }
  });

  if (Editor.hooks?.after) {
    Editor.hooks.after('renderSceneEditor', function previewTestToolbar() {
      try {
        Editor.injectPreviewTestToolbar?.();
      } catch (e) {
        console.warn('[phase-112]', e);
      }
    }, 'editor-test-isolation-toolbar');
  }
})();
