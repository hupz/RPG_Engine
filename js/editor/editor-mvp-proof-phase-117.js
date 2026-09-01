/**
 * Phase 1.17 — MVP Proof project loader (Editor)
 */
(function attachMvpProofPhase117() {
  'use strict';

  if (typeof Editor === 'undefined') return;

  const DEMO_JSON = 'data/demos/mvp_proof.json';
  const GLOBAL = 'DEMO_MVP_PROOF_DATA';

  function applyDemo(data) {
    if (!data || !data.scenes || !data.scenes.village) {
      Editor.toast?.error?.('MVP Proof: invalid demo data');
      return false;
    }
    if (typeof Editor.setProjectData === 'function') {
      Editor.setProjectData(JSON.parse(JSON.stringify(data)));
    } else {
      Editor.data = JSON.parse(JSON.stringify(data));
    }
    Editor.currentScene = data.startScene || 'village';
    if (typeof Editor.switchTab === 'function') Editor.switchTab('scenes');
    else Editor.renderAll?.();
    Editor.renderSceneList?.();
    Editor.renderSceneEditor?.();
    Editor.toast?.success?.('Загружен MVP Proof: Oakhaven Quest');
    return true;
  }

  Editor.loadMvpProofDemo = function loadMvpProofDemo() {
    const canFetch =
      typeof fetch === 'function' &&
      typeof location !== 'undefined' &&
      location.protocol !== 'file:';
    if (canFetch) {
      fetch(DEMO_JSON + '?v=' + Date.now())
        .then((r) => r.json())
        .then(applyDemo)
        .catch((e) => {
          console.warn('[mvp-proof] fetch failed', e);
          if (typeof window !== 'undefined' && window[GLOBAL]) {
            applyDemo(window[GLOBAL]);
          } else {
            Editor.toast?.error?.('Не удалось загрузить mvp_proof.json');
          }
        });
      return true;
    }
    if (typeof window !== 'undefined' && window[GLOBAL]) {
      return applyDemo(window[GLOBAL]);
    }
    Editor.toast?.error?.('Подключите js/demo-mvp-proof.js');
    return false;
  };

  Editor.openMvpProofInGame = function openMvpProofInGame() {
    if (typeof Editor.openEditorTestPreview === 'function') {
      Editor.loadMvpProofDemo();
      setTimeout(() => Editor.openEditorTestPreview({ sceneId: 'start' }), 300);
      return;
    }
    window.open('index.html?campaign=mvp_proof', '_blank', 'noopener');
  };

  if (Editor.hooks?.after) {
    Editor.hooks.after('renderSceneEditor', function mvpProofQuickLoad() {
      try {
        const host =
          document.querySelector('.scenes-preview-pane .live-preview-toolbar') ||
          document.getElementById('live-preview-container');
        if (!host || host.querySelector('.mvp-proof-load-btn')) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-secondary btn-sm mvp-proof-load-btn';
        btn.textContent = 'MVP Proof';
        btn.title = 'Загрузить Oakhaven MVP Proof (Phase 1.17)';
        btn.addEventListener('click', () => Editor.loadMvpProofDemo());
        host.appendChild(btn);
      } catch (e) {
        console.warn('[phase-117]', e);
      }
    }, 'mvp-proof-load-btn');
  }
})();
