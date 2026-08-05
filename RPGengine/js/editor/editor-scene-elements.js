// Редактор: Scene Elements (элементы сцены)

(function attachEditorSceneElements() {
  if (typeof Editor === 'undefined' || typeof SceneElements === 'undefined') {
    console.warn('editor-scene-elements.js: Editor или SceneElements не найдены');
    return;
  }

  Editor._useSceneElements = Editor._useSceneElements !== false;
  Editor._elementCollapse = Editor._elementCollapse || {};

  const tr = (k, p) => (typeof Editor.tr === 'function' ? Editor.tr(k, p) : k);
  const lbl = (k, p) => Editor.escapeHtml(tr(k, p));

  const PICKER_TYPES = [
    'skill_check', 'combat', 'give_item', 'remove_item', 'set_flag',
    'quest_start', 'quest_complete', 'add_status', 'remove_status',
    'achievement', 'service_menu', 'music', 'image', 'custom_action',
    'show_choices', 'show_text', 'change_scene', 'award_gold', 'award_exp'
  ];

  function ensureSceneElements(scene) {
    SceneElements.ensureArrays(scene);
    SceneElements.migrateLegacyScene(scene);
    return scene;
  }

  function getScene() {
    return Editor.data?.scenes?.[Editor.currentScene] || null;
  }

  function syncAndPreview() {
    const scene = getScene();
    if (scene) SceneElements.syncElementsToLegacy(scene);
    Editor.updateJSONPreview();
  }

  Object.assign(Editor, {
    ensureSceneElements(scene) {
      return ensureSceneElements(scene);
    },

    migrateAllSceneElements() {
      if (!this.data?.scenes) return;
      SceneElements.migrateAllScenes(this.data);
    },

    openAddElementPicker(listKey) {
      this._pendingElementList = listKey === 'onEnter' ? 'onEnter' : 'main';
      const modal = document.getElementById('scene-element-picker-modal');
      if (modal) modal.classList.remove('hidden');
    },

    closeElementPicker() {
      const modal = document.getElementById('scene-element-picker-modal');
      if (modal) modal.classList.add('hidden');
      this._pendingElementList = null;
    },

    pickElementType(type) {
      const listKey = this._pendingElementList || 'main';
      this.addSceneElement(type, listKey);
      this.closeElementPicker();
    },

    addSceneElement(type, listKey) {
      const scene = getScene();
      if (!scene) return;
      ensureSceneElements(scene);
      const list = SceneElements.getList(scene, listKey);
      list.push(SceneElements.createElement(type));
      syncAndPreview();
      this.renderSceneEditor();
    },

    removeSceneElement(elementId) {
      const scene = getScene();
      if (!scene) return;
      const lk = SceneElements.findElementListKey(scene, elementId);
      if (!lk) return;
      const list = lk === 'onEnter' ? scene.onEnterElements : scene.elements;
      const idx = list.findIndex((e) => e.id === elementId);
      if (idx === -1) return;
      if (!confirm(tr('editor.sceneElements.deleteConfirm'))) return;
      list.splice(idx, 1);
      syncAndPreview();
      this.renderSceneEditor();
    },

    moveSceneElement(elementId, dir) {
      const scene = getScene();
      if (!scene) return;
      const lk = SceneElements.findElementListKey(scene, elementId);
      if (!lk) return;
      const list = lk === 'onEnter' ? scene.onEnterElements : scene.elements;
      const idx = list.findIndex((e) => e.id === elementId);
      const ni = idx + dir;
      if (idx < 0 || ni < 0 || ni >= list.length) return;
      const tmp = list[idx];
      list[idx] = list[ni];
      list[ni] = tmp;
      syncAndPreview();
      this.renderSceneEditor();
    },

    toggleElementCollapse(elementId) {
      this._elementCollapse[elementId] = !this._elementCollapse[elementId];
      this.renderSceneEditor();
    },

    updateElementField(elementId, field, value) {
      const scene = getScene();
      const el = scene && SceneElements.findElement(scene, elementId);
      if (!el) return;
      if (field === 'enabled' || field === 'firstVisitOnly') {
        el[field] = !!value;
      } else {
        el[field] = value;
      }
      syncAndPreview();
    },

    updateElementData(elementId, key, value) {
      const scene = getScene();
      const el = scene && SceneElements.findElement(scene, elementId);
      if (!el) return;
      if (!el.data) el.data = {};
      el.data[key] = value;
      syncAndPreview();
    },

    updateElementDataJson(elementId, jsonStr) {
      const scene = getScene();
      const el = scene && SceneElements.findElement(scene, elementId);
      if (!el) return;
      try {
        el.data = JSON.parse(jsonStr);
        syncAndPreview();
        this.renderSceneEditor();
      } catch (e) {
        alert(tr('editor.forms.jsonError', { message: e.message }));
      }
    },

    addCombatEnemyToElement(elementId, enemyId) {
      if (!enemyId) return;
      const scene = getScene();
      const el = scene && SceneElements.findElement(scene, elementId);
      if (!el || el.type !== 'combat') return;
      if (!el.data.enemies) el.data.enemies = [];
      if (!el.data.enemies.includes(enemyId)) el.data.enemies.push(enemyId);
      syncAndPreview();
      this.renderSceneEditor();
    },

    removeCombatEnemyFromElement(elementId, index) {
      const scene = getScene();
      const el = scene && SceneElements.findElement(scene, elementId);
      if (!el?.data?.enemies) return;
      el.data.enemies.splice(index, 1);
      syncAndPreview();
      this.renderSceneEditor();
    },

    renderElementTypeLabel(type) {
      const meta = SCENE_ELEMENT_META[type] || { label: type, icon: '•' };
      const i18nKey = 'editor.sceneElements.types.' + type;
      const label = tr(i18nKey);
      const text = label === i18nKey ? meta.label : label;
      return `${meta.icon} ${text}`;
    },

    renderElementParams(el) {
      const d = el.data || {};
      const eid = this.escapeAttr(el.id);
      const allScenes = Object.keys(this.data.scenes || {});
      const allEnemies = Object.keys(this.data.enemies || {});
      const allItems = Object.keys(this.data.items || {});
      const allQuests = Object.keys(this.data.quests || {});
      const allAch = Object.keys(this.data.achievements || {});

      switch (el.type) {
        case 'skill_check':
          return `<div class="grid-2">
            <div class="form-group"><label>${lbl('editor.sceneElements.skill')}</label>
              <input value="${this.escapeHtml(d.skill || 'perception')}" onchange="Editor.updateElementData('${eid}','skill',this.value)"></div>
            <div class="form-group"><label>${lbl('editor.sceneElements.dc')}</label>
              <input type="number" value="${d.dc ?? 12}" onchange="Editor.updateElementData('${eid}','dc',parseInt(this.value)||12)"></div>
          </div>
          <div class="form-group"><label>${lbl('editor.sceneElements.successText')}</label>
            <textarea rows="2" onchange="Editor.updateElementData('${eid}','successText',this.value)">${this.escapeTextarea(d.successText || '')}</textarea></div>
          <div class="form-group"><label>${lbl('editor.sceneElements.failText')}</label>
            <textarea rows="2" onchange="Editor.updateElementData('${eid}','failText',this.value)">${this.escapeTextarea(d.failText || '')}</textarea></div>`;

        case 'combat': {
          const tags = (d.enemies || []).map((eid2, i) =>
            `<div class="enemy-tag">${this.escapeHtml(eid2)}<span class="remove" onclick="Editor.removeCombatEnemyFromElement('${eid}',${i})">×</span></div>`
          ).join('');
          const opts = allEnemies.map((e) => `<option value="${this.escapeAttr(e)}">${this.escapeHtml(e)}</option>`).join('');
          const nextOpts = allScenes.map((s) =>
            `<option value="${this.escapeAttr(s)}" ${d.nextScene === s ? 'selected' : ''}>${this.escapeHtml(s)}</option>`
          ).join('');
          return `<div class="form-group"><label>${lbl('editor.sceneElements.enemies')}</label>
            <div class="enemy-tags">${tags}</div>
            <select onchange="Editor.addCombatEnemyToElement('${eid}',this.value);this.value='';"><option value="">+ ${lbl('editor.sceneElements.addEnemy')}</option>${opts}</select></div>
            <div class="form-group"><label>${lbl('editor.sceneElements.nextScene')}</label>
            <select onchange="Editor.updateElementData('${eid}','nextScene',this.value)"><option value="">—</option>${nextOpts}</select></div>`;
        }

        case 'give_item':
        case 'remove_item': {
          const itemOpts = allItems.map((id) =>
            `<option value="${this.escapeAttr(id)}" ${d.itemId === id ? 'selected' : ''}>${this.escapeHtml(id)}</option>`
          ).join('');
          return `<div class="grid-2">
            <div class="form-group"><label>${lbl('editor.sceneElements.item')}</label>
              <select onchange="Editor.updateElementData('${eid}','itemId',this.value)"><option value="">—</option>${itemOpts}</select></div>
            <div class="form-group"><label>${lbl('editor.sceneElements.count')}</label>
              <input type="number" min="1" value="${d.count ?? 1}" onchange="Editor.updateElementData('${eid}','count',parseInt(this.value)||1)"></div>
          </div>`;
        }

        case 'set_flag':
          return `<div class="grid-2">
            <div class="form-group"><label>${lbl('editor.sceneElements.flagKey')}</label>
              <input value="${this.escapeHtml(d.key || '')}" onchange="Editor.updateElementData('${eid}','key',this.value)"></div>
            <div class="form-group"><label>${lbl('editor.sceneElements.flagValue')}</label>
              <input value="${this.escapeHtml(String(d.value ?? true))}" onchange="Editor.updateElementData('${eid}','value',this.value==='true'?true:(this.value==='false'?false:this.value))"></div>
          </div>`;

        case 'quest_start':
        case 'quest_complete': {
          const qOpts = allQuests.map((q) =>
            `<option value="${this.escapeAttr(q)}" ${d.questId === q ? 'selected' : ''}>${this.escapeHtml(q)}</option>`
          ).join('');
          return `<div class="grid-2">
            <div class="form-group"><label>${lbl('editor.sceneElements.quest')}</label>
              <select onchange="Editor.updateElementData('${eid}','questId',this.value)"><option value="">—</option>${qOpts}</select></div>
            <div class="form-group"><label>${lbl('editor.sceneElements.stage')}</label>
              <input value="${this.escapeHtml(d.stage ?? (el.type === 'quest_complete' ? 'complete' : '0'))}" onchange="Editor.updateElementData('${eid}','stage',this.value)"></div>
          </div>`;
        }

        case 'add_status':
        case 'remove_status':
          return `<div class="grid-2">
            <div class="form-group"><label>${lbl('editor.sceneElements.effect')}</label>
              <input value="${this.escapeHtml(d.effect || 'poisoned')}" onchange="Editor.updateElementData('${eid}','effect',this.value)"></div>
            <div class="form-group"><label>${lbl('editor.sceneElements.duration')}</label>
              <input type="number" value="${d.duration ?? 3}" onchange="Editor.updateElementData('${eid}','duration',parseInt(this.value)||3)"></div>
          </div>`;

        case 'achievement': {
          const aOpts = allAch.map((a) =>
            `<option value="${this.escapeAttr(a)}" ${d.achievementId === a ? 'selected' : ''}>${this.escapeHtml(a)}</option>`
          ).join('');
          return `<div class="form-group"><label>${lbl('editor.sceneElements.achievement')}</label>
            <select onchange="Editor.updateElementData('${eid}','achievementId',this.value)"><option value="">—</option>${aOpts}</select></div>`;
        }

        case 'music':
          return `<div class="grid-2">
            <div class="form-group"><label>Ambient</label>
              ${typeof this.renderAudioFileSelect === 'function'
    ? this.renderAudioFileSelect(d.ambient || '', `Editor.updateElementData('${eid}','ambient',this.value)`, '—')
    : `<input value="${this.escapeHtml(d.ambient || '')}" onchange="Editor.updateElementData('${eid}','ambient',this.value)">`}</div>
            <div class="form-group"><label>SFX on enter</label>
              ${typeof this.renderAudioFileSelect === 'function'
    ? this.renderAudioFileSelect(d.sfxOnEnter || '', `Editor.updateElementData('${eid}','sfxOnEnter',this.value)`, '—')
    : `<input value="${this.escapeHtml(d.sfxOnEnter || '')}" onchange="Editor.updateElementData('${eid}','sfxOnEnter',this.value)">`}</div>
          </div>`;

        case 'image':
          return `<div class="form-group"><label>${lbl('editor.sceneElements.imageSrc')}</label>
            <input value="${this.escapeHtml(d.src || '')}" placeholder="images/scene.png" onchange="Editor.updateElementData('${eid}','src',this.value)"></div>
            <div class="form-group"><label>${lbl('editor.sceneElements.caption')}</label>
            <input value="${this.escapeHtml(d.caption || '')}" onchange="Editor.updateElementData('${eid}','caption',this.value)"></div>`;

        case 'custom_action':
          return `<div class="grid-2">
            <div class="form-group"><label>${lbl('editor.sceneElements.actionId')}</label>
              <input value="${this.escapeHtml(d.action || '')}" placeholder="set_flag" onchange="Editor.updateElementData('${eid}','action',this.value)"></div>
            <div class="form-group"><label>${lbl('editor.sceneElements.chainId')}</label>
              <input value="${this.escapeHtml(d.chainId || '')}" onchange="Editor.updateElementData('${eid}','chainId',this.value)"></div>
          </div>
          <div class="form-group"><label>${lbl('editor.sceneElements.paramsJson')}</label>
            <textarea rows="3" onchange="Editor.updateElementDataJson('${eid}',this.value)">${this.escapeTextarea(JSON.stringify(d.params || {}, null, 2))}</textarea></div>`;

        case 'show_text':
          return `<div class="form-group"><label>${lbl('editor.sceneElements.text')}</label>
            <textarea rows="3" onchange="Editor.updateElementData('${eid}','text',this.value)">${this.escapeTextarea(d.text || '')}</textarea></div>`;

        case 'change_scene': {
          const scOpts = allScenes.map((s) =>
            `<option value="${this.escapeAttr(s)}" ${d.sceneId === s ? 'selected' : ''}>${this.escapeHtml(s)}</option>`
          ).join('');
          return `<div class="form-group"><label>${lbl('editor.sceneElements.targetScene')}</label>
            <select onchange="Editor.updateElementData('${eid}','sceneId',this.value)"><option value="">—</option>${scOpts}</select></div>`;
        }

        case 'award_gold':
        case 'award_exp':
          return `<div class="form-group"><label>${lbl('editor.sceneElements.amount')}</label>
            <input type="number" value="${d.amount ?? 0}" onchange="Editor.updateElementData('${eid}','amount',parseInt(this.value)||0)"></div>`;

        case 'show_choices':
          return `<p class="hint">${lbl('editor.sceneElements.showChoicesHint')}</p>`;

        case 'service_menu':
          return `<p class="hint">${lbl('editor.sceneElements.serviceMenuHint')}</p>
            <div class="form-group"><label>params (JSON)</label>
            <textarea rows="4" onchange="Editor.updateElementDataJson('${eid}',this.value)">${this.escapeTextarea(JSON.stringify(d.params || { services: [] }, null, 2))}</textarea></div>`;

        default:
          return `<p class="hint">${this.escapeHtml(el.type)}</p>`;
      }
    },

    renderElementCard(el, index, listKey) {
      const collapsed = !!this._elementCollapse[el.id];
      const eid = this.escapeAttr(el.id);
      const title = this.renderElementTypeLabel(el.type);
      const lk = listKey === 'onEnter' ? 'onEnter' : 'main';
      return `<div class="scene-element-card project-info" data-element-id="${eid}" style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <button type="button" class="btn btn-secondary" style="font-size:12px;padding:4px 8px;" onclick="Editor.toggleElementCollapse('${eid}')">${collapsed ? '▶' : '▼'}</button>
          <strong style="flex:1;">${this.escapeHtml(title)}</strong>
          <button type="button" class="btn btn-secondary" title="↑" onclick="Editor.moveSceneElement('${eid}',-1)">↑</button>
          <button type="button" class="btn btn-secondary" title="↓" onclick="Editor.moveSceneElement('${eid}',1)">↓</button>
          <button type="button" class="btn btn-danger" onclick="Editor.removeSceneElement('${eid}')">🗑</button>
        </div>
        ${collapsed ? '' : `<div style="margin-top:10px;">
          <div class="form-group" style="display:flex;gap:16px;flex-wrap:wrap;">
            <label><input type="checkbox" ${el.enabled !== false ? 'checked' : ''} onchange="Editor.updateElementField('${eid}','enabled',this.checked)"> ${lbl('editor.sceneElements.enabled')}</label>
            <label><input type="checkbox" ${el.firstVisitOnly ? 'checked' : ''} onchange="Editor.updateElementField('${eid}','firstVisitOnly',this.checked)"> ${lbl('editor.sceneElements.firstVisitOnly')}</label>
          </div>
          ${this.renderElementParams(el)}
        </div>`}
      </div>`;
    },

    renderSceneElementsSection(scene) {
      ensureSceneElements(scene);
      const onEnter = (scene.onEnterElements || []).map((el, i) => this.renderElementCard(el, i, 'onEnter')).join('')
        || `<p class="hint">${lbl('editor.sceneElements.onEnterEmpty')}</p>`;
      const main = (scene.elements || []).map((el, i) => this.renderElementCard(el, i, 'main')).join('')
        || `<p class="hint">${lbl('editor.sceneElements.mainEmpty')}</p>`;

      const pickerItems = PICKER_TYPES.map((t) => {
        const meta = SCENE_ELEMENT_META[t] || {};
        return `<button type="button" class="btn btn-secondary scene-element-pick" style="margin:4px;" onclick="Editor.pickElementType('${t}')">${this.escapeHtml(this.renderElementTypeLabel(t))}</button>`;
      }).join('');

      return `<div class="scene-elements-panel" style="margin-top:20px;border-top:2px solid var(--border);padding-top:16px;">
        <h4>${lbl('editor.sceneElements.onEnterTitle')}</h4>
        <p class="hint">${lbl('editor.sceneElements.onEnterHint')}</p>
        ${onEnter}
        <button type="button" class="btn btn-secondary" onclick="Editor.openAddElementPicker('onEnter')">${lbl('editor.sceneElements.addElement')}</button>

        <h4 style="margin-top:24px;">${lbl('editor.sceneElements.mainTitle')}</h4>
        <p class="hint">${lbl('editor.sceneElements.mainHint')}</p>
        ${main}
        <button type="button" class="btn btn-primary" onclick="Editor.openAddElementPicker('main')">${lbl('editor.sceneElements.addElement')}</button>

        <div id="scene-element-picker-modal" class="modal hidden" role="dialog" aria-modal="true">
          <div class="modal-content" style="max-width:640px;">
            <h3>${lbl('editor.sceneElements.pickerTitle')}</h3>
            <div class="scene-element-picker-grid" style="display:flex;flex-wrap:wrap;gap:6px;margin:12px 0;">${pickerItems}</div>
            <button type="button" class="btn btn-secondary" onclick="Editor.closeElementPicker()">${lbl('common.cancel')}</button>
          </div>
        </div>
      </div>`;
    },

    renderSceneAdvancedSection(scene) {
      const npcOpts = Object.keys(this.data.npcs || {}).map((nid) => {
        const name = this.data.npcs[nid]?.name || nid;
        return `<option value="${this.escapeAttr(nid)}" ${scene.npcId === nid ? 'selected' : ''}>${this.escapeHtml(name)}</option>`;
      }).join('');

      let html = `<details class="scene-advanced-panel project-info" style="margin-top:16px;">
        <summary style="cursor:pointer;font-weight:600;">${lbl('editor.sceneElements.advanced')}</summary>
        <div style="margin-top:12px;">
          <div class="form-group"><label>${lbl('editor.sceneElements.npcId')}</label>
            <select onchange="Editor.setSceneNpcId(this.value)"><option value="">—</option>${npcOpts}</select></div>
          ${typeof this.renderHubReturnFields === 'function' ? this.renderHubReturnFields(scene) : ''}
          ${typeof this.renderMapLocationField === 'function' ? this.renderMapLocationField(scene) : ''}
          ${typeof this.renderSpecialSceneField === 'function' ? this.renderSpecialSceneField(scene) : ''}
          ${typeof this.renderShopConfigSection === 'function' ? this.renderShopConfigSection(scene) : ''}
          ${typeof this.renderSceneComponentsSection === 'function' ? this.renderSceneComponentsSection(scene) : ''}
        </div>
      </details>`;
      return html;
    }
  });

  const origRender = Editor.renderSceneEditor.bind(Editor);
  Editor.renderSceneEditor = function () {
    if (this._useSceneElements && this.currentScene && this.data?.scenes?.[this.currentScene]) {
      ensureSceneElements(this.data.scenes[this.currentScene]);
    }
    origRender();
    if (!this._useSceneElements) return;
    const container = document.getElementById('scene-editor');
    const scene = getScene();
    if (!container || !scene) return;

    container.querySelectorAll('.scene-elements-panel, .scene-advanced-panel, #scene-element-picker-modal').forEach((n) => n.remove());

    const choicesSection = container.querySelector('.choices-section');
    const wrap = document.createElement('div');
    wrap.innerHTML = this.renderSceneElementsSection(scene) + this.renderSceneAdvancedSection(scene);
    const panel = wrap.querySelector('.scene-elements-panel');
    const advanced = wrap.querySelector('.scene-advanced-panel');
    if (choicesSection) {
      if (panel) choicesSection.insertAdjacentElement('afterend', panel);
      if (advanced) (panel || choicesSection).insertAdjacentElement('afterend', advanced);
    } else {
      if (panel) container.appendChild(panel);
      if (advanced) container.appendChild(advanced);
    }

    const legacy = container.querySelectorAll('.combat-section, .flags-section, .scene-audio-panel');
    legacy.forEach((n) => { n.style.display = 'none'; });
    container.querySelectorAll('.form-group').forEach((fg) => {
      const lab = fg.querySelector('label');
      if (!lab) return;
      const t = lab.textContent || '';
      if (t.includes('Предметы') || t.includes('Золото') || t.includes('Items') || t.includes('Gold')) {
        const prev = fg.previousElementSibling;
        if (prev?.classList?.contains('flags-section') || fg.querySelector('#items-list, #scene-gold')) {
          fg.style.display = 'none';
        }
      }
    });
  };

  const origSelect = Editor.selectScene.bind(Editor);
  Editor.selectScene = function (id) {
    origSelect(id);
    const scene = this.data?.scenes?.[id];
    if (scene && this._useSceneElements) ensureSceneElements(scene);
  };

  const origUpdateJson = Editor.updateJSONPreview.bind(Editor);
  Editor.updateJSONPreview = function () {
    if (this._useSceneElements && this.data?.scenes) {
      Object.values(this.data.scenes).forEach((s) => {
        if (s.elements?.length || s.onEnterElements?.length) {
          SceneElements.syncElementsToLegacy(s);
        }
      });
    }
    origUpdateJson();
  };

  if (typeof Editor.applyLoadedProject === 'function') {
    const origApply = Editor.applyLoadedProject.bind(Editor);
    Editor.applyLoadedProject = function (data, options) {
      origApply(data, options);
      if (this._useSceneElements) this.migrateAllSceneElements();
    };
  }
})();
