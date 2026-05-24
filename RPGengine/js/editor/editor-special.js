// Редактор: special-сцены и создание новых сцен

(function attachEditorSpecial() {
  if (typeof Editor === 'undefined') {
    console.error('editor-special.js: Editor не определён');
    return;
  }

  Object.assign(Editor, {
    syncSpecialSceneRegistry() {
      if (typeof SpecialSceneRegistry === 'undefined' || !SpecialSceneRegistry._registerBuiltins) return;
      SpecialSceneRegistry._registerBuiltins({ data: this.data || {} });
    },

    getBuiltinSpecialIds() {
      this.syncSpecialSceneRegistry();
      return typeof SpecialSceneRegistry !== 'undefined'
        ? SpecialSceneRegistry.allIds()
        : [];
    },

    getPluginSpecialSceneLabel(id) {
      const cfg = this.data?.plugins?.specialScenes?.[id];
      return cfg?.label || null;
    },

    collectSpecialIdsFromData() {
      const set = new Set(this.getBuiltinSpecialIds());
      Object.values(this.data?.scenes || {}).forEach((s) => {
        if (s?.special) set.add(s.special);
      });
      const pluginScenes = this.data?.plugins?.specialScenes;
      if (pluginScenes && typeof pluginScenes === 'object') {
        Object.keys(pluginScenes).forEach((id) => set.add(id));
      }
      return [...set].sort();
    },

    renderSpecialSceneField(scene) {
      const current = scene.special || '';
      const ids = this.collectSpecialIdsFromData();
      const datalistId = 'special-scene-datalist';
      const pluginScenes = this.data?.plugins?.specialScenes || {};
      const options = ids.map((id) => {
        const entry = typeof SpecialSceneRegistry !== 'undefined'
          ? SpecialSceneRegistry.list().find((e) => e.id === id)
          : null;
        const label = entry?.label || pluginScenes[id]?.label || id;
        const isPluginJson = !!pluginScenes[id];
        const suffix = isPluginJson ? ' (JSON-плагин)' : '';
        return `<option value="${this.escapeAttr(id)}">${this.escapeHtml(label + suffix)}</option>`;
      }).join('');

      const isRegistered = typeof SpecialSceneRegistry !== 'undefined' && current && SpecialSceneRegistry.has(current);
      const isPluginJson = current && !!pluginScenes[current];
      let hint = 'Оставьте пустым для обычной сцены.';
      if (current) {
        if (isPluginJson) {
          hint = 'JSON-плагин из plugins.specialScenes — правки в JSON или вкладке JSON.';
        } else if (isRegistered) {
          hint = 'Зарегистрированный обработчик (встроенный или SpecialSceneRegistry).';
        } else {
          hint = 'Свой ID: заполните текст/выборы сцены или добавьте plugins.specialScenes / register() в JS.';
        }
      }

      return `<div class="form-group">
        <label>Специальная обработка (special)</label>
        <input type="text" list="${datalistId}" value="${this.escapeAttr(current)}"
          placeholder="например shop_jack или dice_game"
          onchange="Editor.setSceneSpecial(this.value)">
        <datalist id="${datalistId}">${options}</datalist>
        <div class="hint">${hint} Встроенные: haggle, shop_jack, attic, reset…</div>
      </div>`;
    },

    setSceneSpecial(value) {
      if (!this.currentScene) return;
      const scene = this.data.scenes[this.currentScene];
      const v = (value || '').trim();
      if (v) scene.special = v;
      else delete scene.special;
      this.updateJSONPreview();
      if (this.renderSceneList) this.renderSceneList();
      if (this.updateLiveScenePreview) this.updateLiveScenePreview();
    },

    createScene() {
      const id = prompt('ID новой сцены (латиница, snake_case):', 'new_scene');
      if (!id) return;
      if (!/^[a-z][a-z0-9_]*$/i.test(id)) {
        alert('ID: только латиница, цифры и подчёркивание');
        return;
      }
      if (this.data.scenes[id]) {
        alert('Сцена с таким ID уже существует');
        return;
      }
      const location = prompt('Локация (как в игре):', 'Новая локация');
      if (location === null) return;
      const text = prompt('Текст сцены:', 'Опишите, что видит игрок...');
      if (text === null) return;

      this.data.scenes[id] = {
        id,
        location: location.trim() || 'Новая локация',
        text: text.trim() || '',
        choices: [],
        dialogue: [],
        combat: null,
        flags: {},
        items: [],
        gold: 0
      };
      this.currentScene = id;
      this.renderSceneList();
      this.selectScene(id);
      this.updateJSONPreview();
      const startScreen = document.getElementById('start-screen');
      if (startScreen) startScreen.style.display = 'none';
      setTimeout(() => {
        const loc = document.getElementById('scene-location');
        if (loc) loc.focus();
      }, 50);
    }
  });
})();
