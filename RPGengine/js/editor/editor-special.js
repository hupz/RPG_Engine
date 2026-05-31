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
      if (v === 'shop' && !scene.shopConfig) {
        scene.shopConfig = {
          inventory: [],
          sellMultiplier: 1,
          buyMultiplier: 0.5,
          repFlag: 'rep_village',
          exitScene: ''
        };
      }
      this.updateJSONPreview();
      if (this.renderSceneList) this.renderSceneList();
      if (this.renderSceneEditor) this.renderSceneEditor();
      if (this.updateLiveScenePreview) this.updateLiveScenePreview();
    },

    getReputationFlagOptions() {
      const keys = Object.keys(this.data?.reputation || {});
      if (!keys.includes('rep_village')) keys.unshift('rep_village');
      return keys.sort();
    },

    renderShopConfigSection(scene) {
      if (scene.special !== 'shop') return '';
      if (!scene.shopConfig) {
        scene.shopConfig = {
          inventory: [],
          sellMultiplier: 1,
          buyMultiplier: 0.5,
          repFlag: 'rep_village',
          exitScene: ''
        };
      }
      const cfg = scene.shopConfig;
      const inv = Array.isArray(cfg.inventory) ? cfg.inventory : [];
      if (cfg.sellCraftIngredients == null) cfg.sellCraftIngredients = false;
      const shopFilter = this.shopItemFilter || 'all';
      const filterOpts = [
        ['all', 'Все'],
        ['gear', 'Снаряжение'],
        ['consumable', 'Расходники'],
        ['ingredients', 'Ингредиенты']
      ].map(([v, lab]) =>
        `<option value="${v}" ${shopFilter === v ? 'selected' : ''}>${lab}</option>`
      ).join('');
      const itemIds = typeof this.getShopItemIdsForFilter === 'function'
        ? this.getShopItemIdsForFilter(shopFilter === 'all' ? null : shopFilter)
        : Object.keys(this.data?.items || {}).sort();
      const invChecks = itemIds.map(iid => {
        const it = this.data.items[iid];
        const checked = inv.includes(iid) ? 'checked' : '';
        return `<label class="shop-inv-check"><input type="checkbox" ${checked} onchange="Editor.toggleShopInventory('${iid}', this.checked)"> ${iid} — ${it?.name || '?'}</label>`;
      }).join('');

      const repOpts = ['', ...this.getReputationFlagOptions()].map(rf => {
        const label = rf ? (this.data.reputation[rf]?.name || rf) : '— без репутации —';
        return `<option value="${this.escapeAttr(rf)}" ${(cfg.repFlag || '') === rf ? 'selected' : ''}>${this.escapeHtml(label)}</option>`;
      }).join('');

      const sceneIds = Object.keys(this.data.scenes || {});
      const exitOpts = ['', ...sceneIds].map(sid =>
        `<option value="${this.escapeAttr(sid)}" ${cfg.exitScene === sid ? 'selected' : ''}>${this.escapeHtml(sid)}</option>`
      ).join('');

      return `<div class="project-info shop-config-editor" style="margin-top:16px;border-color:#2e7d32;">
        <h4>🏪 Лавка (shopConfig)</h4>
        <p class="hint">Сцена: <code>special: "shop"</code>. Цена покупки = item.price × sellMultiplier × репутация.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
          <div class="form-group"><label>Множитель продажи (торговец→игрок)</label>
            <input type="number" step="0.05" min="0" value="${cfg.sellMultiplier ?? 1}"
              onchange="Editor.updateShopConfig('sellMultiplier', parseFloat(this.value)||0)">
          </div>
          <div class="form-group"><label>Множитель скупки (игрок→торговец)</label>
            <input type="number" step="0.05" min="0" value="${cfg.buyMultiplier ?? 0.5}"
              onchange="Editor.updateShopConfig('buyMultiplier', parseFloat(this.value)||0)">
          </div>
          <div class="form-group"><label>Репутация (repFlag)</label>
            <select onchange="Editor.updateShopConfig('repFlag', this.value || null)">${repOpts}</select>
          </div>
        </div>
        <div class="form-group"><label>Сцена выхода (Уйти)</label>
          <select onchange="Editor.updateShopConfig('exitScene', this.value || null)">${exitOpts}</select>
        </div>
        <div class="form-group"><label>Товары торговца (inventory)</label>
          <select onchange="Editor.shopItemFilter=this.value;Editor.renderSceneEditor()">${filterOpts}</select>
          <label class="craft-check" style="margin:8px 0;"><input type="checkbox" ${cfg.sellCraftIngredients ? 'checked' : ''}
            onchange="Editor.updateShopConfig('sellCraftIngredients', this.checked);Editor.renderSceneEditor()"> Продавать ингредиенты для крафта</label>
          <div class="shop-inv-grid" style="max-height:200px;overflow:auto;border:1px solid var(--border);padding:8px;">${invChecks || '<span class="hint">Нет предметов в data.items</span>'}</div>
        </div>
      </div>`;
    },

    updateShopConfig(field, value) {
      if (!this.currentScene) return;
      const scene = this.data.scenes[this.currentScene];
      if (!scene.shopConfig) scene.shopConfig = {};
      if (field === 'repFlag' || field === 'exitScene') {
        scene.shopConfig[field] = value || null;
      } else if (field === 'sellCraftIngredients') {
        scene.shopConfig[field] = !!value;
        if (value && typeof this.ensureCraftingData === 'function') {
          this.ensureCraftingData();
          const inv = scene.shopConfig.inventory || (scene.shopConfig.inventory = []);
          Object.values(this.data.ingredients || {}).forEach((ing) => {
            if (ing?.sources?.merchant && ing.id && !inv.includes(ing.id)) inv.push(ing.id);
          });
        }
      } else {
        scene.shopConfig[field] = value;
      }
      this.updateJSONPreview();
    },

    toggleShopInventory(itemId, checked) {
      if (!this.currentScene) return;
      const scene = this.data.scenes[this.currentScene];
      if (!scene.shopConfig) scene.shopConfig = { inventory: [] };
      if (!Array.isArray(scene.shopConfig.inventory)) scene.shopConfig.inventory = [];
      const inv = scene.shopConfig.inventory;
      const idx = inv.indexOf(itemId);
      if (checked && idx === -1) inv.push(itemId);
      else if (!checked && idx !== -1) inv.splice(idx, 1);
      this.updateJSONPreview();
      this.renderSceneEditor();
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
