// ============================================================
// Вкладки, список сцен, JSON preview
// Вынесено из editor.html
// ============================================================
(function () {
  if (typeof Editor === 'undefined') {
    console.error('editor-core-tabs.js: Editor не определён');
    return;
  }
  Object.assign(Editor, {
    switchTab(tab, event) {
      this.currentTab = tab;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      if (event?.target) {
        event.target.classList.add('active');
        event.target.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
      }
      document.getElementById('tab-' + tab).classList.add('active');
      if (tab === 'json') this.updateJSONPreview();
      if (tab === 'progression') this.renderProgression();
      if (tab === 'balance') this.renderBalance();
      if (tab === 'audio') this.renderAudio();
      if (tab === 'media' && typeof this.renderMediaAssets === 'function') this.renderMediaAssets();
      if (tab === 'variables' && typeof this.renderVariablesPanel === 'function') this.renderVariablesPanel();
      if (tab === 'prefabs' && typeof this.renderPrefabsPanel === 'function') this.renderPrefabsPanel();
      if (tab === 'theme') this.renderTheme();
      if (tab === 'climate') this.renderClimateTab();
      if (tab === 'worldmap') this.renderWorldMap();
      if (tab === 'quests') this.renderQuests();
      if (tab === 'snippets' && typeof this.renderSnippets === 'function') this.renderSnippets();
      if (tab === 'reputation') this.renderReputation();
      if (tab === 'achievements' && typeof this.renderAchievements === 'function') this.renderAchievements();
      if (tab === 'analytics' && typeof this.renderAnalytics === 'function') this.renderAnalytics();
      if (tab === 'graph') this.renderStoryGraphPanel();
      if (tab === 'races') this.renderRaces();
      if (tab === 'ingredients' && typeof this.renderIngredients === 'function') this.renderIngredients();
      if (tab === 'recipes' && typeof this.renderRecipes === 'function') this.renderRecipes();
      if (tab === 'actions' && typeof this.renderActionChainsTab === 'function') this.renderActionChainsTab();
      if (tab === 'items') this.renderItems();
      if (tab === 'npcs') this.renderNPCs();
      if (tab === 'enemies') this.renderEnemies();
      if (tab === 'classes') this.renderClasses();
      if (tab === 'abilities') this.renderAbilities();
      if (tab === 'beasts' && typeof this.renderBeasts === 'function') this.renderBeasts();
      if (tab === 'scene_templates' && typeof this.renderSceneTemplates === 'function') this.renderSceneTemplates();
      if (tab === 'player_characters' && typeof this.renderPlayerCharacters === 'function') this.renderPlayerCharacters();
      if (tab === 'world' && typeof this.renderWorldHierarchy === 'function') this.renderWorldHierarchy();
    },

    renderAll() {
      this.renderSceneList();
      this.renderStats();
      this.renderQuests();
      if (typeof this.renderSnippets === 'function') this.renderSnippets();
      if (typeof this.renderReputation === 'function') this.renderReputation();
      if (typeof this.renderAchievements === 'function') this.renderAchievements();
      if (typeof this.renderAnalytics === 'function') this.renderAnalytics();
      this.renderNPCs();
      this.renderEnemies();
      if (typeof this.renderBeasts === 'function') this.renderBeasts();
      if (typeof this.renderWorldHierarchy === 'function') this.renderWorldHierarchy();
      if (typeof this.renderBalance === 'function') this.renderBalance();
      this.renderItems();
      if (typeof this.renderIngredients === 'function') this.renderIngredients();
      if (typeof this.renderRecipes === 'function') this.renderRecipes();
      this.renderClasses();
      this.renderRaces();
      this.renderAbilities();
      this.renderAudio();
      this.renderTheme();
      this.renderWorldMap();
      this.renderProgression();
      this.renderStoryGraphPanel();
      this.renderSceneEditor();
      this.updateJSONPreview();
      if (typeof this.syncNavLayout === 'function') this.syncNavLayout(this.currentTab);
    },

    renderSceneList() {
      const list = document.getElementById('scene-list');
      if (!this.data?.scenes) { list.innerHTML = ''; return; }
      list.innerHTML = Object.entries(this.data.scenes).map(([id, scene]) => {
        const preview = scene.text ? scene.text.substring(0, 60) + '...' : 'Нет текста';
        const active = this.currentScene === id ? 'active' : '';
        const title = scene.location || scene.title || id;
        const safeId = this.escapeAttr(id);
        const safeTitle = this.escapeHtml(title);
        const safePreview = this.escapeHtml(preview);
        const safeActive = this.escapeAttr(active);
        return `<div class="scene-item ${safeActive}" onclick="${this.escapeAttr('Editor.openSceneDocument(' + JSON.stringify(safeId) + ')')}">
          <div class="scene-loc">${safeTitle}</div>
          <div class="scene-id hint" data-label="code" title="Системный код">${safeId}</div>
          <div class="scene-preview">${safePreview}</div>
        </div>`;
      }).join('');
    },

    selectScene(id) {
      this.currentScene = id;
      this.renderSceneList();
      this.renderSceneEditor();
    },

    async deleteScene(id) {
      if (Object.keys(this.data.scenes).length <= 1) {
        Editor.toast.warning('Нельзя удалить последнюю сцену');
        return;
      }
      if (!(await Editor.confirmDialog({ message: 'Удалить?', danger: true }))) return;
      delete this.data.scenes[id];
      if (this.currentScene === id) this.currentScene = Object.keys(this.data.scenes)[0];
      this.renderSceneList();
      this.renderSceneEditor();
    },

    updateSceneField(field,value){
      this.data.scenes[this.currentScene][field]=value;
      this.updateJSONPreview();
      if (field === 'returnsToHub' || field === 'hubScene') this.syncHubReturnChoice();
      if(field==='combat'||field==='nextScene') this.renderSceneList();
    },

    updateJSONPreview(){
      try {
        const el = document.getElementById('json-preview');
        if (!el) return;
        if (!this.data) { el.textContent = 'Нет данных'; return; }
        el.textContent = JSON.stringify(this.data, null, 2);
      } catch (e) {
        console.warn('updateJSONPreview', e);
      }
    }
  });

  // Canonical owner: publish real implementations into hooks._impl
  // (Object.assign alone does not update _impl if methods were wrapped earlier)
  if (Editor.hooks && typeof Editor.hooks.register === 'function') {
    Editor.hooks.register('editor-core-tabs', {
      switchTab: Editor.switchTab,
      renderSceneList: Editor.renderSceneList,
      selectScene: Editor.selectScene,
      updateJSONPreview: Editor.updateJSONPreview,
      deleteScene: Editor.deleteScene,
      updateSceneField: Editor.updateSceneField
    }, { force: true });
  }
})();
