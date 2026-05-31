// Редактор: компоненты сцен (диалог, торговля, ремонт и т.д.)
(function attachEditorSceneComponents() {
  if (typeof Editor === 'undefined' || typeof SceneComponentRegistry === 'undefined') {
    console.warn('editor-scene-components.js: Editor или SceneComponentRegistry не найдены');
    return;
  }

  const TYPE_ORDER = SceneComponentRegistry.listTypes();

  function npcOptions(data, selected) {
    const npcs = data?.npcs || {};
    return Object.keys(npcs).map((id) => {
      const name = npcs[id]?.name || id;
      const sel = id === selected ? ' selected' : '';
      return `<option value="${Editor.escapeAttr(id)}"${sel}>${Editor.escapeHtml(name)}</option>`;
    }).join('');
  }

  function inventoryOptions(data, selected) {
    const invs = data?.shopInventories || {};
    let html = '<option value="">— список предметов —</option>';
    Object.keys(invs).forEach((id) => {
      const name = invs[id]?.name || id;
      const sel = id === selected ? ' selected' : '';
      html += `<option value="${Editor.escapeAttr(id)}"${sel}>${Editor.escapeHtml(name)}</option>`;
    });
    return html;
  }

  function ensureComponentsArray(scene) {
    if (!Array.isArray(scene.components)) scene.components = [];
    return scene.components;
  }

  function chainOptions(data, selected) {
    if (typeof Editor.ensureActionChainsData === 'function') Editor.ensureActionChainsData();
    const chains = data?.actionChains || {};
    let html = '<option value="">— нет —</option>';
    Object.keys(chains).sort().forEach((id) => {
      const name = chains[id]?.name || id;
      const sel = id === selected ? ' selected' : '';
      html += `<option value="${Editor.escapeAttr(id)}"${sel}>${Editor.escapeHtml(name)} (${id})</option>`;
    });
    return html;
  }

  Object.assign(Editor, {
    renderSceneComponentsSection(scene) {
      const comps = scene.components || [];
      const cards = comps.map((c, i) => this.renderComponentEditorCard(c, i)).join('');
      const typeMenu = TYPE_ORDER.map((t) => {
        const m = SceneComponentRegistry.getMeta(t);
        return `<button type="button" class="btn btn-secondary component-add-type" onclick="Editor.addSceneComponent('${t}')">${m.icon} ${Editor.escapeHtml(m.label)}</button>`;
      }).join('');

      return `<div class="scene-components-editor project-info" style="margin-top:16px;">
        <h4>🧩 Компоненты сцены</h4>
        <p class="hint">Сцена как контейнер: блоки рендерятся сверху вниз. Наследуются только фон/музыка хаба, не компоненты.</p>
        <div id="scene-components-list">${cards || '<p class="hint">Компонентов пока нет — добавьте ниже.</p>'}</div>
        <div class="component-add-menu" style="margin:12px 0; display:flex; flex-wrap:wrap; gap:6px;">
          ${typeMenu}
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" class="btn btn-primary" onclick="Editor.previewSceneComponents()">👁️ Предпросмотр компонентов</button>
        </div>
        <div id="components-preview-box" class="components-preview-box hidden" style="margin-top:12px;"></div>
      </div>`;
    },

    renderComponentEditorCard(comp, index) {
      const type = comp.component || 'dialogue';
      const meta = SceneComponentRegistry.getMeta(type);
      const p = comp.params || {};
      const enabled = comp.enabled !== false;
      let fields = '';

      const npcSel = (field, val) => `<div class="form-group"><label>NPC</label>
        <select onchange="Editor.updateComponentParam(${index},'${field}',this.value)">
          <option value="">—</option>
          ${npcOptions(this.data, val || p.npc || p.merchant)}
        </select></div>`;

      switch (type) {
        case 'dialogue':
        case 'dialogue_tree':
          fields = `${npcSel('npc', p.npc)}
            <div class="form-group"><label>Цепочка при входе (chainOnEnter)</label>
              <select onchange="Editor.setComponentChainOnEnter(${index},this.value)">
                ${chainOptions(this.data, comp.chainOnEnter)}
              </select>
            </div>
            <div class="form-group"><label>Приветствие</label>
              <textarea rows="2" onchange="Editor.updateComponentParam(${index},'greeting',this.value)">${Editor.escapeHtml(p.greeting || '')}</textarea>
            </div>
            <div class="form-group"><label>Темы (JSON: label, reply, flags, donate)</label>
              <textarea rows="4" onchange="Editor.updateComponentTopics(${index},this.value)">${Editor.escapeHtml(JSON.stringify(p.topics || [], null, 2))}</textarea>
            </div>`;
          break;
        case 'interactive':
        case 'interactive_panel':
          fields = `<div class="form-group"><label>Текст кнопки</label>
              <input type="text" value="${Editor.escapeAttr(p.label || '')}" onchange="Editor.updateComponentParam(${index},'label',this.value)">
            </div>
            <div class="form-group"><label>Иконка</label>
              <input type="text" value="${Editor.escapeAttr(p.icon || '➡️')}" onchange="Editor.updateComponentParam(${index},'icon',this.value)">
            </div>
            <div class="form-group"><label>Цепочка (chain)</label>
              <select onchange="Editor.updateComponentParam(${index},'chain',this.value)">
                ${chainOptions(this.data, p.chain)}
              </select>
            </div>`;
          break;
        case 'trade':
        case 'trade_interface':
          fields = `${npcSel('merchant', p.merchant)}
            <div class="form-group"><label>Ассортимент</label>
              <select onchange="Editor.updateComponentParam(${index},'inventory',this.value)">
                ${inventoryOptions(this.data, p.inventory)}
              </select>
            </div>
            <div class="form-group"><label>Цена покупки (×)</label>
              <input type="number" step="0.1" value="${p.sellMultiplier ?? 1}" onchange="Editor.updateComponentParam(${index},'sellMultiplier',parseFloat(this.value)||1)">
            </div>
            <div class="form-group"><label>Цена продажи (×)</label>
              <input type="number" step="0.1" value="${p.buyMultiplier ?? 0.5}" onchange="Editor.updateComponentParam(${index},'buyMultiplier',parseFloat(this.value)||0.5)">
            </div>
            <div class="form-group"><label>Репутация (флаг)</label>
              <input type="text" value="${Editor.escapeAttr(p.repFaction || '')}" onchange="Editor.updateComponentParam(${index},'repFaction',this.value)">
            </div>
            <div class="form-group"><label><input type="checkbox" ${p.jackShop ? 'checked' : ''} onchange="Editor.updateComponentParam(${index},'jackShop',this.checked)"> Лавка Джека</label></div>`;
          break;
        case 'service_menu':
          fields = `<div class="form-group"><label>Заголовок меню</label>
              <input type="text" value="${Editor.escapeAttr(p.header || 'Услуги')}" onchange="Editor.updateComponentParam(${index},'header',this.value)">
            </div>
            <div class="form-group"><label>Услуги (JSON массив services[])</label>
              <p class="hint">type: <code>action</code> (action, actionParams, cost), <code>chain</code> (chain), <code>panel</code> (panel, panelParams). Панели: repair_panel, upgrade_panel, curse_remove_panel, gamble_panel, craft_panel.</p>
              <textarea rows="12" onchange="Editor.updateComponentServices(${index},this.value)">${Editor.escapeHtml(JSON.stringify(p.services || [], null, 2))}</textarea>
            </div>`;
          break;
        default:
          fields = '<p class="hint">Нет редактора для этого типа.</p>';
      }

      return `<div class="component-editor-card" data-comp-index="${index}">
        <div class="component-editor-card-head">
          <strong>${meta.icon} ${Editor.escapeHtml(meta.label)}</strong>
          <label style="margin-left:12px;"><input type="checkbox" ${enabled ? 'checked' : ''} onchange="Editor.setComponentEnabled(${index},this.checked)"> Вкл</label>
          <span style="flex:1"></span>
          <button type="button" class="btn btn-secondary" title="Вверх" onclick="Editor.moveSceneComponent(${index},-1)">↑</button>
          <button type="button" class="btn btn-secondary" title="Вниз" onclick="Editor.moveSceneComponent(${index},1)">↓</button>
          <button type="button" class="btn btn-danger" onclick="Editor.removeSceneComponent(${index})">❌</button>
        </div>
        <div class="component-editor-card-body">${fields}</div>
      </div>`;
    },

    addSceneComponent(type) {
      const scene = this.data.scenes[this.currentScene];
      if (!scene) return;
      const list = ensureComponentsArray(scene);
      const def = SceneComponentRegistry.defaultParams(type) || {};
      list.push({
        component: type,
        id: `${type}_${this.currentScene}_${list.length + 1}`,
        enabled: true,
        params: { ...def }
      });
      this.updateJSONPreview();
      this.renderSceneEditor();
    },

    removeSceneComponent(index) {
      const scene = this.data.scenes[this.currentScene];
      if (!scene?.components) return;
      scene.components.splice(index, 1);
      this.updateJSONPreview();
      this.renderSceneEditor();
    },

    moveSceneComponent(index, dir) {
      const scene = this.data.scenes[this.currentScene];
      const list = scene?.components;
      if (!list) return;
      const j = index + dir;
      if (j < 0 || j >= list.length) return;
      const tmp = list[index];
      list[index] = list[j];
      list[j] = tmp;
      this.updateJSONPreview();
      this.renderSceneEditor();
    },

    setComponentEnabled(index, on) {
      const c = this.data.scenes[this.currentScene]?.components?.[index];
      if (!c) return;
      c.enabled = on;
      this.updateJSONPreview();
    },

    updateComponentParam(index, key, value) {
      const c = this.data.scenes[this.currentScene]?.components?.[index];
      if (!c) return;
      if (!c.params) c.params = {};
      c.params[key] = value;
      this.updateJSONPreview();
    },

    updateComponentCostTable(index, str) {
      const arr = String(str).split(/[,;\s]+/).map((x) => parseInt(x.trim(), 10)).filter((n) => !Number.isNaN(n));
      this.updateComponentParam(index, 'costTable', arr);
    },

    updateComponentTopics(index, jsonStr) {
      try {
        const topics = JSON.parse(jsonStr);
        this.updateComponentParam(index, 'topics', topics);
      } catch (e) {
        alert('Ошибка JSON тем: ' + e.message);
      }
    },

    updateComponentRecipes(index, jsonStr) {
      try {
        const recipes = JSON.parse(jsonStr);
        this.updateComponentParam(index, 'recipes', recipes);
      } catch (e) {
        alert('Ошибка JSON рецептов: ' + e.message);
      }
    },

    updateComponentServices(index, jsonStr) {
      try {
        const services = JSON.parse(jsonStr);
        if (!Array.isArray(services)) throw new Error('services должен быть массивом');
        this.updateComponentParam(index, 'services', services);
      } catch (e) {
        alert('Ошибка JSON услуг: ' + e.message);
      }
    },

    setComponentChainOnEnter(index, chainId) {
      const c = this.data.scenes[this.currentScene]?.components?.[index];
      if (!c) return;
      if (chainId) c.chainOnEnter = chainId;
      else delete c.chainOnEnter;
      this.updateJSONPreview();
    },

    buildMockEngineForPreview() {
      const self = this;
      return {
        state: {
          gold: 120,
          hp: 18,
          maxHp: 25,
          inventory: ['healing_potion', 'rope'],
          flags: {},
          equipped: {}
        },
        data: this.data,
        ENHANCEMENT_SLOTS: ['weapon_main', 'armor', 'shield'],
        escapeHtml: (s) => self.escapeHtml(s),
        escapeAttr: (s) => self.escapeAttr(s),
        getNpcName: (id) => self.data?.npcs?.[id]?.name || id,
        getEquippedItemId: () => null,
        getEffectiveItemData: () => null,
        getItemEnhancementLevel: () => 0,
        getEquippedCursedEntries: () => [],
        getShopBuyPrice: (id, cfg) => {
          const db = self.data?.items?.[id];
          return Math.ceil((db?.price || 10) * (cfg?.sellMultiplier || 1));
        },
        getConditionContext: () => ({ flags: {}, inventory: [], gold: 120 }),
        d20: () => 12,
        log: () => {},
        saveGame: () => {}
      };
    },

    previewSceneComponents() {
      const scene = this.data.scenes[this.currentScene];
      const box = document.getElementById('components-preview-box');
      if (!box || !scene?.components?.length) {
        if (box) {
          box.classList.remove('hidden');
          box.innerHTML = '<p class="hint">Добавьте хотя бы один компонент.</p>';
        }
        return;
      }
      box.classList.remove('hidden');
      box.innerHTML = '<h4>Предпросмотр (кнопки неактивны)</h4><div id="components-preview-inner" class="scene-components-area"></div>';
      const inner = document.getElementById('components-preview-inner');
      const mock = this.buildMockEngineForPreview();
      scene.components.forEach((comp, index) => {
        if (comp.enabled === false) return;
        const renderer = SceneComponentRegistry.get(comp.component);
        if (!renderer) return;
        const wrap = document.createElement('div');
        wrap.className = `scene-component scene-component--${comp.component}`;
        inner.appendChild(wrap);
        renderer.render(mock, wrap, comp, {
          sceneId: this.currentScene,
          index,
          preview: true,
          scene
        });
      });
    }
  });

  const origRender = Editor.renderSceneEditor.bind(Editor);
  Editor.renderSceneEditor = function () {
    origRender();
    const container = document.getElementById('scene-editor');
    const scene = this.currentScene && this.data?.scenes?.[this.currentScene];
    if (!container || !scene) return;
    const section = this.renderSceneComponentsSection(scene);
    const anchor = container.querySelector('.hub-return-panel') || container.querySelector('.choices-section');
    const div = document.createElement('div');
    div.innerHTML = section;
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(div.firstElementChild, anchor);
    } else {
      container.appendChild(div.firstElementChild);
    }
  };
})();
