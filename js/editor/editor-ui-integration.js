// ============================================================
// UI-12 — Final UI Integration (cleanup + legacy routing)
// No new runtime. Routes legacy entry points to unified workspace APIs.
// ============================================================
(function attachUiIntegration() {
  'use strict';
  function tr(key, params) {
    if (typeof I18n !== 'undefined' && typeof I18n.t === 'function') return I18n.t(key, params);
    if (typeof t === 'function') return t(key, params);
    return key;
  }
  if (typeof Editor === 'undefined') return;

  function markUi12Active() {
    if (typeof document !== 'undefined' && document.body) {
      document.body.dataset.ui12 = '1';
    }
  }

  function openSceneWorkspaceSection(sceneId, sectionId, opts) {
    opts = opts || {};
    if (!sceneId) return false;
    if (typeof Editor.openSceneWorkspace === 'function') {
      Editor.openSceneWorkspace(sceneId, { section: sectionId });
    } else if (typeof Editor.openSceneDocument === 'function') {
      if (typeof Editor.switchTab === 'function') Editor.switchTab('scenes');
      Editor.openSceneDocument(sceneId);
    } else if (typeof Editor.selectScene === 'function') {
      if (typeof Editor.switchTab === 'function') Editor.switchTab('scenes');
      Editor.selectScene(sceneId);
    } else {
      return false;
    }
    if (sectionId && typeof Editor.setSceneWorkspaceSection === 'function') {
      Editor.setSceneWorkspaceSection(sectionId);
    }
    if (opts.choiceIndex != null && typeof Editor.selectChoiceIndex === 'function') {
      try { Editor.selectChoiceIndex(opts.choiceIndex); } catch (e) { /* */ }
    }
    if (opts.nodeId && typeof Editor.visualSelectNode === 'function') {
      try { Editor.visualSelectNode(opts.nodeId); } catch (e) { /* */ }
    }
    return true;
  }

  /** Legacy alias — Scene Workspace → Visual section */
  Editor.openVisualSceneEditor = function openVisualSceneEditor(sceneId) {
    const sid = sceneId || Editor.currentScene;
    if (!sid) {
      Editor.toast?.warning?.(tr('editor.uiIntegration.selectScene'));
      return false;
    }
    const ok = openSceneWorkspaceSection(sid, 'visual');
    if (ok) Editor.renderVisualScenePanel?.();
    return ok;
  };

  /** Legacy alias — Scene Workspace → Game UI section or tab */
  function openGameUiEditorUi12() {
    if (Editor.currentScene && typeof Editor.setSceneWorkspaceSection === 'function') {
      Editor.setSceneWorkspaceSection('game_ui');
      return true;
    }
    if (typeof Editor.switchTab === 'function') Editor.switchTab('game_ui');
    return true;
  }
  if (Editor.hooks?.replace) {
    Editor.hooks.replace('openGameUiEditor', openGameUiEditorUi12, 'editor-ui-integration');
  } else if (typeof Editor.openGameUiEditor !== 'function') {
    Editor.openGameUiEditor = openGameUiEditorUi12;
  }

  /** Navigate validation issue → workspace section */
  Editor.openValidationIssueInWorkspace = function openValidationIssueInWorkspace(issue) {
    if (!issue) return false;
    const sceneId = issue.sceneId || issue.object?.id;
    if (!sceneId && issue.questId) {
      if (typeof Editor.switchTab === 'function') Editor.switchTab('quests');
      if (typeof Editor.selectQuestToEdit === 'function') Editor.selectQuestToEdit(issue.questId);
      return true;
    }
    if (!sceneId) return false;
    const field = issue.field || issue.object?.field || '';
    const choiceIndex = issue.choiceIndex ?? issue.object?.choiceIndex ?? issue.raw?.choiceIndex;
    const nodeId = issue.nodeId || issue.object?.nodeId;
    let section = issue.section || 'content';
    if (choiceIndex != null || field === 'to' || field === 'choices' || /choice/i.test(field)) {
      section = 'choices';
    } else if (nodeId || /visual|node|hotspot/i.test(field)) {
      section = 'visual';
    } else if (/condition|showIf/i.test(field)) {
      section = 'conditions';
    }
    return openSceneWorkspaceSection(sceneId, section, { choiceIndex, nodeId });
  };

  function wrapFocusSceneAfterWizard() {
    if (typeof Editor.focusSceneAfterWizard !== 'function' || Editor._ui12FocusWrapped || !Editor.hooks?.replace) return;
    let savedPrev;
    savedPrev = Editor.hooks.replace('focusSceneAfterWizard', function focusSceneAfterWizardUi12(presetId) {
      if (presetId === 'visual' && typeof Editor.setSceneWorkspaceSection === 'function') {
        const sc = Editor.data?.scenes?.[Editor.currentScene];
        if (sc && !sc.visual) sc.visual = { mode: 'overlay', nodes: [] };
        Editor.setSceneWorkspaceSection('visual');
        Editor.renderVisualScenePanel?.();
        return;
      }
      return savedPrev ? savedPrev.call(this, presetId) : undefined;
    }, 'editor-ui-integration');
    Editor._ui12FocusWrapped = true;
  }

  function dedupeCreateButtons() {
    if (typeof document === 'undefined') return;
    const cbFooter = document.getElementById('cb-create-footer');
    if (!cbFooter) return;
    const sidebarBtn = document.querySelector('#context-sidebar button[data-i18n="editor.newScene"]');
    if (sidebarBtn) sidebarBtn.style.display = 'none';
  }

  function ensureStyles() {
    if (typeof document === 'undefined' || document.getElementById('ui12-styles')) return;
    const st = document.createElement('style');
    st.id = 'ui12-styles';
    st.textContent = `
      body.editor-app[data-ui12="1"] .editor-test-scene { display: none !important; }
      body.editor-app[data-ui12="1"][data-epw="1"] #ws-scene-context-nav [data-ctx-nav="preview"] { display: none; }
      .cb-welcome { padding: 12px 8px; text-align: center; }
      .cb-welcome h2 { font-size: 15px; margin: 0 0 6px; }
      .cb-welcome p { font-size: 12px; color: var(--ink-faint); margin: 0 0 10px; }
      .cb-welcome__actions { display: flex; flex-direction: column; gap: 6px; align-items: stretch; }
    `;
    document.head.appendChild(st);
  }

  wrapFocusSceneAfterWizard();
  markUi12Active();
  ensureStyles();

  if (Editor.hooks?.after) {
    Editor.hooks.after('renderSceneList', function () {
      try { dedupeCreateButtons(); } catch (e) { /* */ }
    }, 'editor-ui-integration');

    Editor.hooks.after('renderUnifiedSceneWorkspace', function () {
      try { dedupeCreateButtons(); } catch (e) { /* */ }
    }, 'editor-ui-integration');
  }

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-ui-integration', {
      openVisualSceneEditor: Editor.openVisualSceneEditor,
      openGameUiEditor: Editor.openGameUiEditor,
      openValidationIssueInWorkspace: Editor.openValidationIssueInWorkspace,
      isUiIntegrationActive() {
        return typeof document !== 'undefined' && document.body?.dataset?.ui12 === '1';
      }
    }, { force: true });
  }

  console.info('[Editor.UIIntegration] ready');
})();
