// ============================================================
// Scene Workspace Polish (UI-13) — headers, selection, breadcrumb
// Extends editor-scene-workspace.js; no schema/runtime changes.
// ============================================================
(function attachSceneWorkspacePolish() {
  'use strict';
  function tr(key, params) {
    if (typeof I18n !== 'undefined' && typeof I18n.t === 'function') return I18n.t(key, params);
    if (typeof t === 'function') return t(key, params);
    return key;
  }
  if (typeof Editor === 'undefined') return;

  const SECTION_META = {
    overview: {
      titleKey: 'editor.sceneWorkspacePolish.sections.overview.title',
      descKey: 'editor.sceneWorkspacePolish.sections.overview.desc'
    },
    content: {
      titleKey: 'editor.sceneWorkspacePolish.sections.content.title',
      descKey: 'editor.sceneWorkspacePolish.sections.content.desc',
      primary: { labelKey: 'editor.sceneWorkspacePolish.sections.content.addModule', action: 'content-add-module' }
    },
    choices: {
      titleKey: 'editor.sceneWorkspacePolish.sections.choices.title',
      descKey: 'editor.sceneWorkspacePolish.sections.choices.desc',
      primary: { labelKey: 'editor.sceneWorkspacePolish.sections.choices.addChoice', action: 'choices-add' }
    },
    visual: {
      titleKey: 'editor.sceneWorkspacePolish.sections.visual.title',
      descKey: 'editor.sceneWorkspacePolish.sections.visual.desc',
      primary: { labelKey: 'editor.sceneWorkspacePolish.sections.visual.addObject', action: 'visual-add-hotspot' }
    },
    game_ui: {
      titleKey: 'editor.sceneWorkspacePolish.sections.gameUi.title',
      descKey: 'editor.sceneWorkspacePolish.sections.gameUi.desc',
      primary: { labelKey: 'editor.sceneWorkspacePolish.sections.gameUi.addUi', action: 'game-ui-add' }
    },
    conditions: {
      titleKey: 'editor.sceneWorkspacePolish.sections.conditions.title',
      descKey: 'editor.sceneWorkspacePolish.sections.conditions.desc',
      primary: { labelKey: 'editor.sceneWorkspacePolish.sections.conditions.addCondition', action: 'conditions-add' }
    },
    advanced: {
      titleKey: 'editor.sceneWorkspacePolish.sections.advanced.title',
      descKey: 'editor.sceneWorkspacePolish.sections.advanced.desc'
    }
  };

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

  function wsState() {
    if (!Editor.workspace) Editor.workspace = {};
    if (!Editor.workspace.sceneWs) {
      Editor.workspace.sceneWs = { enabled: false, section: 'overview', selection: null };
    }
    if (!('selection' in Editor.workspace.sceneWs)) {
      Editor.workspace.sceneWs.selection = null;
    }
    return Editor.workspace.sceneWs;
  }

  function sectionLabel(sectionId) {
    const meta = SECTION_META[sectionId];
    if (meta) return tr(meta.titleKey);
    const list = typeof Editor.getSceneWorkspaceSections === 'function'
      ? Editor.getSceneWorkspaceSections() : [];
    const found = list.find((s) => s.id === sectionId);
    return found ? found.label : sectionId;
  }

  function isDirty() {
    return !!(Editor.projectStatus && typeof Editor.projectStatus.isDirty === 'function' &&
      Editor.projectStatus.isDirty());
  }

  function normalizeSelection(sel) {
    if (!sel || !sel.type) return null;
    const sceneId = sel.meta?.sceneId || Editor.currentScene;
    const out = {
      type: sel.type,
      sceneId,
      id: sel.id,
      choiceIndex: sel.meta?.choiceIndex,
      nodeId: sel.type === 'visual_node' ? sel.id : sel.meta?.nodeId,
      screenId: sel.meta?.screenId
    };
    if (out.choiceIndex == null && sel.type === 'choice' && sel.id != null) {
      const idx = parseInt(sel.id, 10);
      if (!Number.isNaN(idx)) out.choiceIndex = idx;
    }
    return out;
  }

  function selectionStillValid(sel) {
    if (!sel || !sel.sceneId) return false;
    const scene = Editor.data?.scenes?.[sel.sceneId];
    if (!scene) return false;
    if (sel.type === 'choice' || sel.choiceIndex != null) {
      const idx = sel.choiceIndex != null ? sel.choiceIndex : parseInt(sel.id, 10);
      return Array.isArray(scene.choices) && scene.choices[idx] != null;
    }
    if (sel.type === 'visual_node' || sel.nodeId) {
      const nid = sel.nodeId || sel.id;
      return (scene.visual?.nodes || []).some((n) => n.id === nid);
    }
    if (sel.type === 'scene') return true;
    return true;
  }

  function sectionCompatibleWithSelection(sectionId, sel) {
    if (!sel) return false;
    if (sectionId === 'overview' || sectionId === 'advanced' || sectionId === 'game_ui') return false;
    if (sel.type === 'choice') return sectionId === 'choices' || sectionId === 'conditions' || sectionId === 'content';
    if (sel.type === 'visual_node') return sectionId === 'visual' || sectionId === 'conditions';
    if (sel.type === 'scene') return sectionId === 'content' || sectionId === 'overview';
    return false;
  }

  function setWorkspaceSelection(sel) {
    wsState().selection = sel ? Object.assign({}, sel) : null;
  }

  function getWorkspaceSelection() {
    return wsState().selection ? Object.assign({}, wsState().selection) : null;
  }

  function clearSceneWorkspaceSelection() {
    setWorkspaceSelection(null);
    if (Editor.Inspector) Editor.Inspector.clear();
    if (Editor._visualSelectedNodeId) Editor._visualSelectedNodeId = null;
  }

  function captureSelectionFromInspector() {
    const sel = Editor.Inspector?.selection;
    if (!sel) return;
    setWorkspaceSelection(normalizeSelection(sel));
  }

  function restoreWorkspaceSelection(sectionId) {
    const sel = getWorkspaceSelection();
    if (!sel || sel.sceneId !== Editor.currentScene) return;
    if (!selectionStillValid(sel)) {
      clearSceneWorkspaceSelection();
      return;
    }
    if (!sectionCompatibleWithSelection(sectionId, sel)) return;

    if (sel.type === 'visual_node' && typeof Editor.visualSelectNode === 'function') {
      Editor.visualSelectNode(sel.nodeId || sel.id);
    } else if (sel.type === 'choice' && Editor.Inspector) {
      const idx = sel.choiceIndex != null ? sel.choiceIndex : parseInt(sel.id, 10);
      Editor.Inspector.select({
        type: 'choice',
        id: String(idx),
        meta: { sceneId: sel.sceneId, choiceIndex: idx }
      });
    } else if (sel.type === 'scene' && Editor.Inspector) {
      Editor.Inspector.select({ type: 'scene', id: sel.sceneId });
    }
  }

  function runSectionPrimaryAction(action) {
    const sceneId = Editor.currentScene;
    if (!sceneId) return;
    if (action === 'content-add-module') {
      if (typeof Editor.addSceneModule === 'function') Editor.addSceneModule('story');
      else document.querySelector('.scene-builder-add button')?.click();
      return;
    }
    if (action === 'choices-add') {
      if (!Editor.data.scenes[sceneId].choices) Editor.data.scenes[sceneId].choices = [];
      if (typeof Editor.addChoice === 'function') Editor.addChoice();
      else if (typeof Editor.addSceneModule === 'function') Editor.addSceneModule('choices');
      return;
    }
    if (action === 'visual-add-hotspot') {
      const scene = Editor.data.scenes[sceneId];
      if (scene && !scene.visual) {
        scene.visual = { mode: 'overlay', nodes: [] };
        Editor.markDirty?.();
      }
      if (typeof Editor.visualAddNode === 'function') Editor.visualAddNode('hotspot');
      else Editor.renderVisualScenePanel?.();
      return;
    }
    if (action === 'game-ui-add') {
      Editor.switchTab?.('game_ui');
      Editor.uiAddScreen?.();
      return;
    }
    if (action === 'conditions-add') {
      Editor.setSceneWorkspaceSection?.('choices');
      return;
    }
  }

  function renderBreadcrumb(sceneId, sectionId) {
    const scene = Editor.data?.scenes?.[sceneId];
    if (!scene) return '';
    const title = scene.location || scene.title || sceneId;
    const dirty = isDirty()
      ? ' <span class="usw-bc__dirty" title="' + escAttr(tr('editor.sceneWorkspacePolish.breadcrumb.unsavedTitle')) + '">*</span>'
      : '';
    return (
      '<nav class="usw-breadcrumb" aria-label="' + escAttr(tr('editor.sceneWorkspacePolish.breadcrumb.ariaLabel')) + '">' +
      '<button type="button" class="usw-bc__link" data-usw-bc="project">' + esc(tr('editor.sceneWorkspacePolish.breadcrumb.project')) + '</button>' +
      '<span class="usw-bc__sep" aria-hidden="true">›</span>' +
      '<span class="usw-bc__current">' + esc(title) + dirty + '</span>' +
      '<span class="usw-bc__sep" aria-hidden="true">›</span>' +
      '<span class="usw-bc__section">' + esc(sectionLabel(sectionId)) + '</span>' +
      '</nav>'
    );
  }

  function renderSectionHeader(sectionId, sceneId) {
    const meta = SECTION_META[sectionId];
    if (!meta) return '';
    const primary = meta.primary
      ? '<button type="button" class="btn btn-primary btn-sm usw-section-header__primary" data-usw-primary="' +
        escAttr(meta.primary.action) + '">' + esc(tr(meta.primary.labelKey)) + '</button>'
      : '';
    return (
      '<header class="usw-section-header" data-usw-section-header="' + escAttr(sectionId) + '">' +
      '<div class="usw-section-header__text">' +
      '<h3 class="usw-section-header__title">' + esc(tr(meta.titleKey)) + '</h3>' +
      (meta.descKey ? '<p class="usw-section-header__desc hint">' + esc(tr(meta.descKey)) + '</p>' : '') +
      '</div>' +
      (primary ? '<div class="usw-section-header__actions">' + primary + '</div>' : '') +
      '</header>'
    );
  }

  function injectWorkspaceChrome(sceneId) {
    if (typeof document === 'undefined') return;
    const outline = document.getElementById('usw-outline');
    const mount = document.getElementById('usw-canvas-mount');
    const canvas = mount?.parentElement;
    if (!outline || !canvas) return;

    const sectionId = typeof Editor.getSceneWorkspaceSection === 'function'
      ? Editor.getSceneWorkspaceSection() : 'overview';

    let bc = document.getElementById('usw-breadcrumb');
    if (!bc) {
      bc = document.createElement('div');
      bc.id = 'usw-breadcrumb';
      outline.insertBefore(bc, outline.firstChild);
      bc.addEventListener('click', (ev) => {
        const btn = ev.target.closest('[data-usw-bc]');
        if (!btn) return;
        if (btn.getAttribute('data-usw-bc') === 'project') {
          if (typeof Editor.switchTab === 'function') Editor.switchTab('scenes');
          Editor.setSceneWorkspaceSection?.('overview');
        }
      });
    }
    bc.innerHTML = renderBreadcrumb(sceneId, sectionId);

    let headerHost = document.getElementById('usw-section-header-host');
    if (!headerHost) {
      headerHost = document.createElement('div');
      headerHost.id = 'usw-section-header-host';
      headerHost.className = 'usw-section-header-host';
      const mount = document.getElementById('usw-canvas-mount');
      if (mount) canvas.insertBefore(headerHost, mount);
      else canvas.insertBefore(headerHost, canvas.firstChild);
      headerHost.addEventListener('click', (ev) => {
        const btn = ev.target.closest('[data-usw-primary]');
        if (!btn) return;
        runSectionPrimaryAction(btn.getAttribute('data-usw-primary'));
      });
    }
    headerHost.innerHTML = renderSectionHeader(sectionId, sceneId);
    headerHost.hidden = sectionId === 'overview';
  }

  function wrapSetSceneWorkspaceSection() {
    if (Editor._usw13SectionWrapped || typeof Editor.setSceneWorkspaceSection !== 'function' || !Editor.hooks?.replace) return;
    let savedPrev;
    savedPrev = Editor.hooks.replace('setSceneWorkspaceSection', function setSceneWorkspaceSectionPolish(sectionId) {
      captureSelectionFromInspector();
      const result = savedPrev ? savedPrev.call(this, sectionId) : undefined;
      injectWorkspaceChrome(Editor.currentScene);
      restoreWorkspaceSelection(sectionId);
      return result;
    }, 'editor-scene-workspace-polish');
    Editor._usw13SectionWrapped = true;
  }

  function installSelectionHooks() {
    if (Editor._usw13SelectionHooks) return;
    Editor._usw13SelectionHooks = true;

    if (Editor.hooks?.after) {
      Editor.hooks.after('visualSelectNode', function (_r, args) {
        const nodeId = args && args[0];
        if (!nodeId) return;
        setWorkspaceSelection({
          type: 'visual_node',
          sceneId: Editor.currentScene,
          nodeId,
          id: nodeId
        });
      }, 'editor-scene-workspace-polish');
    }

    if (Editor.Inspector && !Editor.Inspector._usw13SelectWrapped) {
      const origSelect = Editor.Inspector.select.bind(Editor.Inspector);
      Editor.Inspector.select = function selectWithWorkspace(sel) {
        origSelect(sel);
        if (sel && sel.type) setWorkspaceSelection(normalizeSelection(sel));
        else setWorkspaceSelection(null);
      };
      Editor.Inspector._usw13SelectWrapped = true;
    }
  }

  function ensureStyles() {
    if (typeof document === 'undefined' || document.getElementById('usw13-styles')) return;
    const st = document.createElement('style');
    st.id = 'usw13-styles';
    st.textContent = `
      .usw-breadcrumb { padding: 4px 8px 8px; font-size: 11px; color: var(--ink-faint); display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
      .usw-bc__link { border: none; background: transparent; color: var(--ink-light); cursor: pointer; padding: 0; font-size: inherit; }
      .usw-bc__link:hover { color: var(--ink); text-decoration: underline; }
      .usw-bc__sep { opacity: .5; }
      .usw-bc__current { font-weight: 600; color: var(--ink); }
      .usw-bc__dirty { color: var(--warning, #c90); }
      .usw-section-header-host { padding: 8px 8px 0; }
      .usw-section-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
        padding: 8px 10px; margin-bottom: 8px; border-bottom: 1px solid var(--border); }
      .usw-section-header__title { margin: 0; font-size: 15px; font-weight: 600; }
      .usw-section-header__desc { margin: 4px 0 0; font-size: 12px; }
      .usw-empty__title { font-weight: 600; margin: 0 0 4px; font-size: 13px; }
      body.editor-usw-active #ws-scene-context-nav { display: none !important; }
      body.editor-usw-active .usw-section-header-host + .usw-canvas-mount .scene-builder-add { margin-top: 0; }
    `;
    document.head.appendChild(st);
  }

  Object.assign(Editor, {
    getSceneWorkspaceSelection: getWorkspaceSelection,
    setSceneWorkspaceSelection: setWorkspaceSelection,
    clearSceneWorkspaceSelection,
    restoreSceneWorkspaceSelection: restoreWorkspaceSelection,
    isSceneWorkspaceSelectionValid: selectionStillValid
  });

  wrapSetSceneWorkspaceSection();
  installSelectionHooks();
  ensureStyles();

  if (Editor.hooks?.after) {
    Editor.hooks.after('renderUnifiedSceneWorkspace', function () {
      try {
        injectWorkspaceChrome(Editor.currentScene);
      } catch (e) { /* */ }
    }, 'editor-scene-workspace-polish');
  }

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-scene-workspace-polish', {
      getSceneWorkspaceSelection: Editor.getSceneWorkspaceSelection,
      clearSceneWorkspaceSelection: Editor.clearSceneWorkspaceSelection
    }, { force: true });
  }

  console.info('[Editor.SceneWorkspacePolish] ready');
})();
