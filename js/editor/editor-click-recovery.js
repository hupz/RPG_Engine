// ============================================================
// editor-click-recovery.js — чинит клики после поломки цепочек
// Подключать ПОСЛЕДНИМ среди editor/*.js
// ============================================================
(function editorClickRecovery() {
  if (typeof Editor === 'undefined') {
    console.error('editor-click-recovery: Editor missing');
    return;
  }

  // 1) Безопасный JSON preview (owner via hooks.register, force)
  function safeUpdateJSONPreview() {
    try {
      if (typeof this.isJsonPreviewVisible === 'function' && !this.isJsonPreviewVisible()) {
        return;
      }
      const el = document.getElementById('json-preview');
      if (!el) return;
      if (!this.data) {
        el.textContent = 'Нет данных';
        return;
      }
      el.textContent = JSON.stringify(this.data, null, 2);
    } catch (e) {
      console.warn('updateJSONPreview', e);
    }
  }
  if (Editor.hooks && typeof Editor.hooks.register === 'function') {
    Editor.hooks.register('editor-click-recovery', {
      updateJSONPreview: safeUpdateJSONPreview
    }, { force: true });
  } else {
    Editor.updateJSONPreview = safeUpdateJSONPreview;
  }

  // 2) Scene builder: принудительно подключить modular renderer
  if (typeof window.renderSceneEditorModular === 'function') {
    // not global
  }
  // scene-builder keeps renderSceneEditorModular in closure — re-call hooks.replace if method is stub
  const looksLikeStub = (fn) => {
    if (typeof fn !== 'function') return true;
    const s = Function.prototype.toString.call(fn);
    return s.includes('scene-builder') || s.includes('подключается модулем') || s.length < 120;
  };

  // If scene-builder assigned via hooks earlier, try to invoke real path:
  // Re-define add/remove/toggle if missing
  if (typeof Editor.addSceneModule !== 'function') {
    Editor.addSceneModule = function (moduleId) {
      const scene = this.data?.scenes?.[this.currentScene];
      if (!scene || !moduleId) return;
      if (!Array.isArray(scene.editorModules)) {
        scene.editorModules = typeof this.inferSceneModules === 'function'
          ? this.inferSceneModules(scene)
          : [];
      }
      if (!scene.editorModules.includes(moduleId)) {
        scene.editorModules.push(moduleId);
      }
      if (moduleId === 'choices' && !Array.isArray(scene.choices)) scene.choices = [];
      if (moduleId === 'dialogue' && !Array.isArray(scene.dialogue)) scene.dialogue = [];
      if (moduleId === 'combat' && !Array.isArray(scene.combat)) scene.combat = [];
      if (moduleId === 'story' && scene.text == null) scene.text = '';
      this._sceneModulePickerOpen = false;
      try { this.renderSceneEditor(); } catch (e) { console.error(e); }
      try { this.updateJSONPreview(); } catch (e) { /* */ }
    };
  }

  if (typeof Editor.toggleSceneModulePicker !== 'function') {
    Editor.toggleSceneModulePicker = function () {
      this._sceneModulePickerOpen = !this._sceneModulePickerOpen;
      try { this.renderSceneEditor(); } catch (e) { console.error(e); }
    };
  }

  if (typeof Editor.removeSceneModule !== 'function') {
    Editor.removeSceneModule = function (moduleId) {
      const scene = this.data?.scenes?.[this.currentScene];
      if (!scene || !Array.isArray(scene.editorModules)) return;
      scene.editorModules = scene.editorModules.filter((id) => id !== moduleId);
      try { this.renderSceneEditor(); } catch (e) { console.error(e); }
      try { this.updateJSONPreview(); } catch (e) { /* */ }
    };
  }

  // 3) Graph edge delete — always present
  Editor.deleteStoryGraphEdge = async function (fromId, choiceIndex, toId) {
    try {
      const scene = this.data?.scenes?.[fromId];
      if (!scene) {
        Editor.toast.warning('Сцена не найдена');
        return;
      }
      if (choiceIndex < 0 || (this._sg?.selectedEdge && this._sg.selectedEdge.kind === 'nextScene')) {
        if (scene.nextScene != null) {
          if (!(await Editor.confirmDialog({ message: 'Убрать переход «после боя»?' }))) return;
          delete scene.nextScene;
        }
      } else {
        if (!Array.isArray(scene.choices)) scene.choices = [];
        let idx = choiceIndex;
        if (idx < 0 || idx >= scene.choices.length ||
            (toId && scene.choices[idx] && scene.choices[idx].to !== toId)) {
          idx = toId ? scene.choices.findIndex((c) => c && c.to === toId) : idx;
        }
        if (idx < 0 || idx >= scene.choices.length) {
          Editor.toast.warning('Связь не найдена в choices. Откройте сцену и удалите выбор вручную.');
          return;
        }
        const label = scene.choices[idx]?.text || '';
        if (!(await Editor.confirmDialog({ message: 'Удалить связь «' + label + '»?', danger: true }))) return;
        scene.choices.splice(idx, 1);
      }
      if (this._sg) this._sg.selectedEdge = null;
      try { this.updateJSONPreview(); } catch (e) { /* */ }
      if (typeof this.renderEditableStoryGraph === 'function') this.renderEditableStoryGraph();
      if (typeof this.renderStoryGraphSidePanel === 'function') this.renderStoryGraphSidePanel();
    } catch (e) {
      console.error('deleteStoryGraphEdge', e);
      Editor.toast.error('Ошибка удаления связи: ' + (e.message || e));
    }
  };

  // 4) Class preset — guaranteed
  if (typeof Editor.applyClassPreset === 'function') {
    const orig = Editor.applyClassPreset.bind(Editor);
    Editor.applyClassPreset = async function (presetId) {
      try {
        return await orig(presetId);
      } catch (e) {
        console.error(e);
        Editor.toast.error('Ошибка пресета: ' + (e.message || e));
      }
    };
  }

  // 5) Event delegation for critical UI (works even if inline onclick broken)
  if (!window._editorClickRecoveryBound) {
    window._editorClickRecoveryBound = true;
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (!t || !t.closest) return;

      // Scene: + Добавить module
      const addBtn = t.closest('.scene-add-module-btn, [data-action="toggle-scene-module"]');
      if (addBtn && typeof Editor.toggleSceneModulePicker === 'function') {
        // only if not already handled by onclick
        if (!addBtn.getAttribute('onclick')) {
          e.preventDefault();
          Editor.toggleSceneModulePicker();
        }
      }

      // Scene module pick
      const pick = t.closest('.scene-module-pick[data-module-id]');
      if (pick && !pick.disabled) {
        const mid = pick.getAttribute('data-module-id');
        if (mid && typeof Editor.addSceneModule === 'function') {
          // complement onclick
        }
      }

      // Graph side panel delete (backup)
      const delEdge = t.closest('[data-action="delete-story-edge"]');
      if (delEdge) {
        e.preventDefault();
        const from = delEdge.getAttribute('data-from');
        const ci = parseInt(delEdge.getAttribute('data-ci'), 10);
        const to = delEdge.getAttribute('data-to') || '';
        Editor.deleteStoryGraphEdge(from, ci, to);
      }
    }, true);
  }

  // 6) Rebind critical hooks so after-callbacks still run
  if (Editor.hooks && typeof Editor.hooks.rebind === 'function') {
    ['renderSceneEditor', 'renderClasses', 'renderStoryGraphPanel', 'updateJSONPreview', 'switchTab'].forEach((m) => {
      try { Editor.hooks.rebind(m); } catch (e) { /* */ }
    });
  }

  console.info('[editor-click-recovery] ready', {
    addSceneModule: typeof Editor.addSceneModule,
    togglePicker: typeof Editor.toggleSceneModulePicker,
    deleteEdge: typeof Editor.deleteStoryGraphEdge,
    applyPreset: typeof Editor.applyClassPreset,
    renderScene: typeof Editor.renderSceneEditor
  });
})();
