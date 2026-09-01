// ============================================================
// Editor Workspace — Scene document integration (UI-3)
// Document header, view mode (TEXT / Visual / Mixed), chrome.
// Session-only viewModes; does not modify project JSON schema.
// ============================================================
(function attachEditorWorkspaceScene() {
  'use strict';

  if (typeof Editor === 'undefined') return;

  const IDX = typeof EditorContentIndex !== 'undefined' ? EditorContentIndex : null;

  function esc(s) {
    return typeof Editor.escapeHtml === 'function'
      ? Editor.escapeHtml(String(s == null ? '' : s))
      : String(s == null ? '' : s);
  }

  function escAttr(s) {
    return typeof Editor.escapeAttr === 'function'
      ? Editor.escapeAttr(String(s == null ? '' : s))
      : esc(s);
  }

  function isAdvanced() {
    return typeof Editor.isEditorAdvancedMode === 'function' && Editor.isEditorAdvancedMode();
  }

  function getSceneKind(scene) {
    if (IDX && typeof IDX.getSceneKind === 'function') return IDX.getSceneKind(scene);
    const v = scene?.visual;
    const hasVisual = !!(v && ((v.nodes && v.nodes.length) || v.background?.asset || v.mode));
    const hasText = !!(scene && String(scene.text || '').trim());
    const hasChoices = Array.isArray(scene?.choices) && scene.choices.length > 0;
    if (hasVisual && (hasText || hasChoices)) return 'mixed';
    if (hasVisual) return 'visual';
    return 'text';
  }

  function kindLabel(kind) {
    if (kind === 'visual') return 'Visual';
    if (kind === 'mixed') return 'Mixed';
    return 'TEXT';
  }

  function defaultViewMode(kind) {
    if (kind === 'visual') return 'visual';
    if (kind === 'mixed') return 'both';
    return 'text';
  }

  function ensureWorkspaceState() {
    if (!Editor.workspace) Editor.workspace = { open: [], activeId: null };
    if (!Editor.workspace.viewModes) Editor.workspace.viewModes = {};
    return Editor.workspace;
  }

  function getSceneViewMode(sceneId) {
    const ws = ensureWorkspaceState();
    if (ws.viewModes[sceneId]) return ws.viewModes[sceneId];
    const scene = Editor.data?.scenes?.[sceneId];
    return defaultViewMode(getSceneKind(scene));
  }

  function setSceneViewMode(sceneId, mode) {
    const allowed = ['text', 'visual', 'both'];
    if (!allowed.includes(mode)) return;
    const ws = ensureWorkspaceState();
    ws.viewModes[sceneId] = mode;
    applySceneViewMode(sceneId);
    if (Editor.Workspace) Editor.Workspace.renderTabs();
  }

  function applySceneViewMode(sceneId) {
    const builder = document.querySelector('#scene-editor .scene-builder');
    if (!builder || Editor.currentScene !== sceneId) return;
    const mode = getSceneViewMode(sceneId);
    builder.classList.remove('ws-view-text', 'ws-view-visual', 'ws-view-both');
    builder.classList.add('ws-view-' + mode);

    const visualPanel = document.getElementById('visual-scene-editor-panel');
    const textBlocks = builder.querySelectorAll(
      '.scene-builder-core, .scene-modules-list, .scene-builder-add, .scene-wizards-bar, .scene-wizard-panel'
    );
    if (mode === 'text') {
      if (visualPanel) visualPanel.style.display = 'none';
      textBlocks.forEach((el) => { el.style.display = ''; });
    } else if (mode === 'visual') {
      if (visualPanel) visualPanel.style.display = '';
      textBlocks.forEach((el) => { el.style.display = 'none'; });
    } else {
      if (visualPanel) visualPanel.style.display = '';
      textBlocks.forEach((el) => { el.style.display = ''; });
    }
  }

  function renderSceneDocumentHeader(sceneId) {
    const scene = Editor.data?.scenes?.[sceneId];
    if (!scene) return '';
    const kind = getSceneKind(scene);
    const viewMode = getSceneViewMode(sceneId);
    const title = scene.location || scene.title || sceneId;
    const typeMeta = typeof Editor.getSceneTypeMeta === 'function'
      ? Editor.getSceneTypeMeta(typeof Editor.inferSceneType === 'function' ? Editor.inferSceneType(scene) : 'custom')
      : { icon: '🎬', label: 'Сцена' };

    let modeControls = '';
    if (kind === 'mixed') {
      modeControls =
        '<div class="ws-scene-header__modes" role="group" aria-label="Режим редактора">' +
        ['text', 'both', 'visual'].map((m) => {
          const labels = { text: 'Текст', both: 'Оба', visual: 'Visual' };
          const active = viewMode === m ? ' is-active' : '';
          return '<button type="button" class="ws-scene-mode-btn' + active + '" data-scene-view="' + m + '">' +
            esc(labels[m]) + '</button>';
        }).join('') +
        '</div>';
    } else if (kind === 'visual') {
      modeControls = '<span class="ws-scene-header__kind ws-scene-header__kind--visual">Visual Scene</span>';
    } else {
      modeControls = '<span class="ws-scene-header__kind ws-scene-header__kind--text">TEXT Scene</span>';
    }

    const idMeta = isAdvanced()
      ? '<span class="ws-scene-header__id hint" title="Системный ID"><code>' + esc(sceneId) + '</code></span>'
      : '';

    return (
      '<header class="ws-scene-document-header" id="ws-scene-document-header" data-scene-id="' + escAttr(sceneId) + '">' +
      '<div class="ws-scene-header__main">' +
      '<span class="ws-scene-header__icon" aria-hidden="true">' + esc(typeMeta.icon) + '</span>' +
      '<div class="ws-scene-header__titles">' +
      '<h2 class="ws-scene-header__title">' + esc(title) + '</h2>' +
      '<div class="ws-scene-header__meta">' +
      '<span class="ws-scene-header__badge">' + esc(kindLabel(kind)) + '</span>' +
      idMeta +
      '</div></div>' +
      modeControls +
      '</div>' +
      '<div class="ws-scene-header__actions">' +
      '<div class="ws-scene-header__more">' +
      '<button type="button" class="btn btn-ghost btn-sm" data-scene-action="more" aria-haspopup="true" title="Ещё">⋯</button>' +
      '<div class="ws-scene-more-menu" hidden>' +
      '<button type="button" data-scene-action="duplicate">Дублировать</button>' +
      '<button type="button" data-scene-action="delete" class="danger">Удалить</button>' +
      (isAdvanced() ? '<button type="button" data-scene-action="rename-id">Изменить ID</button>' : '') +
      '</div></div>' +
      '</div></header>'
    );
  }

  function injectSceneWorkspaceChrome() {
    if (typeof document === 'undefined') return;
    const sceneId = Editor.currentScene;
    const builder = document.querySelector('#scene-editor .scene-builder');
    if (!sceneId || !builder || !Editor.data?.scenes?.[sceneId]) return;

    let header = document.getElementById('ws-scene-document-header');
    const html = renderSceneDocumentHeader(sceneId);
    if (header) {
      header.outerHTML = html;
    } else {
      builder.insertAdjacentHTML('afterbegin', html);
    }
    header = document.getElementById('ws-scene-document-header');
    if (header && !header.dataset.bound) {
      header.dataset.bound = '1';
      header.addEventListener('click', onSceneHeaderClick);
    }

    applySceneViewMode(sceneId);
    injectSceneContextNav(sceneId);
  }

  function renderSceneContextNav(sceneId) {
    const scene = Editor.data?.scenes?.[sceneId];
    if (!scene) return '';
    const kind = getSceneKind(scene);
    const viewMode = getSceneViewMode(sceneId);
    const chips = [];

    if (kind === 'mixed' || kind === 'text') {
      chips.push({
        id: 'content',
        label: 'Контент',
        active: viewMode === 'text' || viewMode === 'both',
        action: 'view:text'
      });
    }
    if (kind === 'mixed' || kind === 'visual') {
      chips.push({
        id: 'visual',
        label: 'Visual',
        active: viewMode === 'visual' || viewMode === 'both',
        action: 'view:visual'
      });
    }
    if (Editor.data?.ui?.screens && Object.keys(Editor.data.ui.screens).length) {
      chips.push({ id: 'ui', label: 'UI', active: false, action: 'tab:game_ui' });
    }

    chips.push({ id: 'sep-tools', sep: true });
    chips.push({ id: 'validate', label: 'Проверить', action: 'validate' });
    if (!(typeof Editor.isPreviewWorkflowActive === 'function' && Editor.isPreviewWorkflowActive())) {
      chips.push({ id: 'preview', label: 'Превью', action: 'preview' });
    }

    return (
      '<nav class="ws-scene-context-nav" id="ws-scene-context-nav" aria-label="Инструменты сцены">' +
      chips.map((c) => {
        if (c.sep) return '<span class="ws-ctx-nav-sep" aria-hidden="true"></span>';
        const cls = 'ws-ctx-nav-btn' + (c.active ? ' is-active' : '');
        return '<button type="button" class="' + cls + '" data-ctx-nav="' + escAttr(c.action) + '">' + esc(c.label) + '</button>';
      }).join('') +
      '</nav>'
    );
  }

  function injectSceneContextNav(sceneId) {
    if (typeof document === 'undefined') return;
    const sid = sceneId || Editor.currentScene;
    const builder = document.querySelector('#scene-editor .scene-builder');
    if (!sid || !builder || !Editor.data?.scenes?.[sid]) {
      document.getElementById('ws-scene-context-nav')?.remove();
      return;
    }

    const html = renderSceneContextNav(sid);
    const header = document.getElementById('ws-scene-document-header');
    let nav = document.getElementById('ws-scene-context-nav');
    if (nav) {
      nav.outerHTML = html;
    } else if (header) {
      header.insertAdjacentHTML('afterend', html);
    } else {
      builder.insertAdjacentHTML('afterbegin', html);
    }

    nav = document.getElementById('ws-scene-context-nav');
    if (nav && !nav.dataset.bound) {
      nav.dataset.bound = '1';
      nav.addEventListener('click', onSceneContextNavClick);
    }
  }

  function onSceneContextNavClick(ev) {
    const btn = ev.target.closest('[data-ctx-nav]');
    if (!btn) return;
    const action = btn.getAttribute('data-ctx-nav');
    const sid = Editor.currentScene;
    if (!sid) return;

    if (action === 'view:text') {
      setSceneViewMode(sid, 'text');
      injectSceneContextNav(sid);
      return;
    }
    if (action === 'view:visual') {
      setSceneViewMode(sid, 'visual');
      injectSceneContextNav(sid);
      return;
    }
    if (action === 'tab:game_ui') {
      if (typeof Editor.switchTab === 'function') Editor.switchTab('game_ui');
      return;
    }
    if (action === 'validate') {
      if (typeof Editor.runProjectValidation === 'function') Editor.runProjectValidation();
      return;
    }
    if (action === 'preview') {
      if (typeof Editor.previewScene === 'function') {
        Editor.previewScene({ mode: 'current', sceneId: sid });
      } else if (typeof Editor.testFromHere === 'function') Editor.testFromHere({ sceneId: sid });
      else if (typeof Editor.testCurrentScene === 'function') Editor.testCurrentScene();
    }
  }

  async function onSceneHeaderClick(ev) {
    const viewBtn = ev.target.closest('[data-scene-view]');
    if (viewBtn) {
      const mode = viewBtn.getAttribute('data-scene-view');
      if (Editor.currentScene) setSceneViewMode(Editor.currentScene, mode);
      return;
    }

    const action = ev.target.closest('[data-scene-action]');
    if (!action) return;
    const act = action.getAttribute('data-scene-action');
    const sid = Editor.currentScene;
    if (!sid) return;

    if (act === 'test') {
      if (typeof Editor.testFromHere === 'function') Editor.testFromHere({ sceneId: sid });
      else if (typeof Editor.testCurrentScene === 'function') Editor.testCurrentScene();
      return;
    }
    if (act === 'validate') {
      if (typeof Editor.runProjectValidation === 'function') Editor.runProjectValidation();
      return;
    }
    if (act === 'more') {
      const menu = action.parentElement?.querySelector('.ws-scene-more-menu');
      if (menu) menu.hidden = !menu.hidden;
      return;
    }
    if (act === 'duplicate') {
      if (typeof Editor.duplicateScene === 'function') Editor.duplicateScene(sid);
      closeMoreMenu();
      return;
    }
    if (act === 'delete') {
      if (typeof Editor.deleteScene === 'function') Editor.deleteScene(sid);
      closeMoreMenu();
      return;
    }
    if (act === 'rename-id') {
      const n = await Editor.promptDialog({ message: 'Изменить ID (латиница):', defaultValue: sid });
      if (n && typeof Editor.updateSceneId === 'function') Editor.updateSceneId(n);
      closeMoreMenu();
    }
  }

  function closeMoreMenu() {
    document.querySelectorAll('.ws-scene-more-menu').forEach((m) => { m.hidden = true; });
  }

  function ensureStyles() {
    if (typeof document === 'undefined' || document.getElementById('editor-workspace-scene-styles')) return;
    if (document.querySelector('link#editor-design-system-css, link[href*="editor-design-system"]')) return;
    const st = document.createElement('style');
    st.id = 'editor-workspace-scene-styles';
    st.textContent = `
      .ws-scene-document-header {
        display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between;
        gap: 8px 12px; padding: 10px 12px; margin: 0 0 12px;
        border: 1px solid var(--border, #ccc); border-radius: 8px;
        background: var(--card-bg, #fff);
      }
      .ws-scene-header__main { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; flex: 1; min-width: 0; }
      .ws-scene-header__icon { font-size: 22px; line-height: 1; }
      .ws-scene-header__titles { min-width: 0; }
      .ws-scene-header__title { margin: 0; font-size: 16px; font-weight: 600; line-height: 1.25; }
      .ws-scene-header__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 2px; }
      .ws-scene-header__badge {
        font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;
        background: #e3f2fd; color: #1565c0; text-transform: uppercase; letter-spacing: 0.03em;
      }
      .ws-scene-header__kind { font-size: 11px; color: var(--ink-light, #666); font-weight: 600; }
      .ws-scene-header__kind--visual { color: #6a1b9a; }
      .ws-scene-header__modes { display: flex; gap: 2px; }
      .ws-scene-mode-btn {
        font-size: 11px; padding: 3px 8px; border: 1px solid var(--border, #ccc);
        border-radius: 4px; background: var(--paper, #f7f5f2); cursor: pointer;
      }
      .ws-scene-mode-btn.is-active {
        background: var(--info, #1976d2); color: #fff; border-color: var(--info, #1976d2);
      }
      .ws-scene-header__actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
      .ws-scene-header__more { position: relative; }
      .ws-scene-more-menu {
        position: absolute; right: 0; top: 100%; z-index: 50; min-width: 140px;
        margin-top: 4px; padding: 4px; border: 1px solid var(--border, #ccc);
        border-radius: 6px; background: var(--card-bg, #fff); box-shadow: 0 4px 12px rgba(0,0,0,.12);
      }
      .ws-scene-more-menu button {
        display: block; width: 100%; text-align: left; padding: 6px 10px;
        border: none; background: transparent; cursor: pointer; font-size: 12px; border-radius: 4px;
      }
      .ws-scene-more-menu button:hover { background: rgba(0,0,0,.05); }
      .ws-scene-more-menu button.danger { color: #c62828; }
      .scene-builder.ws-view-visual .scene-builder-core,
      .scene-builder.ws-view-visual .scene-modules-list,
      .scene-builder.ws-view-visual .scene-builder-add { display: none !important; }
      .scene-builder.ws-view-text #visual-scene-editor-panel { display: none !important; }
    `;
    document.head.appendChild(st);
  }

  function openSceneQuickCreate() {
    return Editor.openSceneWizard();
  }

  function finishSceneQuickCreate() {
    return Editor.finishSceneWizard?.();
  }

  Object.assign(Editor, {
    getSceneContentKind(sceneOrId) {
      const scene = typeof sceneOrId === 'string'
        ? Editor.data?.scenes?.[sceneOrId]
        : sceneOrId;
      return getSceneKind(scene);
    },

    getSceneViewMode(sceneId) {
      return getSceneViewMode(sceneId || Editor.currentScene);
    },

    setSceneViewMode(sceneId, mode) {
      setSceneViewMode(sceneId || Editor.currentScene, mode);
    },

    openSceneQuickCreate,

    injectSceneWorkspaceChrome,
    injectSceneContextNav
  });

  if (Editor.hooks && typeof Editor.hooks.after === 'function') {
    Editor.hooks.after('renderSceneEditor', function () {
      try {
        ensureStyles();
        injectSceneWorkspaceChrome();
      } catch (e) {
        console.warn('[editor-workspace-scene]', e);
      }
    }, 'editor-workspace-scene');
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.ws-scene-header__more')) closeMoreMenu();
    });
  }

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-workspace-scene', {
      openSceneQuickCreate: Editor.openSceneQuickCreate,
      getSceneViewMode: Editor.getSceneViewMode,
      setSceneViewMode: Editor.setSceneViewMode,
      injectSceneWorkspaceChrome: Editor.injectSceneWorkspaceChrome
    }, { force: true });
  }

  console.info('[Editor.Workspace.Scene] ready');
})();
