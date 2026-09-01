// ============================================================
// Editor State — доступ к project data / scene / tab
// Владелец: editor-state
// ============================================================
(function editorState() {
  'use strict';
  if (typeof Editor === 'undefined') {
    console.error('editor-state: Editor missing — load editor-core first');
    return;
  }

  const api = {
    getProjectData() {
      return this.data;
    },
    hasProjectData() {
      return !!(this.data && typeof this.data === 'object');
    },
    getCurrentSceneId() {
      return this.currentScene;
    },
    getCurrentScene() {
      if (!this.data?.scenes || !this.currentScene) return null;
      return this.data.scenes[this.currentScene] || null;
    },
    getCurrentTab() {
      return this.currentTab || 'dashboard';
    },
    setCurrentTab(tab) {
      this.currentTab = tab;
      return this.currentTab;
    }
  };

  Object.assign(Editor, api);

  if (Editor.hooks && typeof Editor.hooks.register === 'function') {
    Editor.hooks.register('editor-state', {
      getProjectData: Editor.getProjectData,
      hasProjectData: Editor.hasProjectData,
      getCurrentSceneId: Editor.getCurrentSceneId,
      getCurrentScene: Editor.getCurrentScene,
      getCurrentTab: Editor.getCurrentTab,
      setCurrentTab: Editor.setCurrentTab
    }, { force: true });
  }
})();
