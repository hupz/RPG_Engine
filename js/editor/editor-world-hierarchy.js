// ============================================
// Редактор иерархии: Мир → Регион → Хаб → Сцена
// ============================================

(function attachEditorWorldHierarchy() {
  if (typeof Editor === 'undefined' || typeof WorldHierarchy === 'undefined') {
    console.error('editor-world-hierarchy.js: нужны Editor и WorldHierarchy');
    return;
  }

  const WH = WorldHierarchy;
  const D = 'div';

  Object.assign(Editor, {
    hierarchySelection: null,

    ensureWorldHierarchyData() {
      if (!this.data) return;
      WH.ensureWorldHierarchy(this.data);
    },

    renderWorldHierarchy() {
      const c = document.getElementById('world-hierarchy-editor');
      if (!c) return;
      if (!this.data) {
        c.innerHTML = `<${D} class="empty-state"><h2>Загрузите данные</h2></${D}>`;
        return;
      }
      this.ensureWorldHierarchyData();
      const tree = WH.buildTree(this.data);
      const treeHtml = this.renderHierarchyTreeHtml(tree);
      const detail = this.renderHierarchyDetailPanel();
      c.innerHTML = `<${D} class="world-hierarchy-manager">
        <${D} class="world-hierarchy-head">
          <h3>🌍 Мир и регионы</h3>
          <${D} style="display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" class="btn btn-primary" onclick="Editor.createWorld()">+ Мир</button>
            <button type="button" class="btn btn-secondary" onclick="Editor.createRegion()">+ Регион</button>
            <button type="button" class="btn btn-secondary" onclick="Editor.createHub()">+ Хаб</button>
          </${D}>
        </${D}>
        <p class="hint">Мир → Регион → Хаб → Сцены. Дочерние сцены наследуют <code>inherited</code> хаба и региона.</p>
        <${D} class="world-hierarchy-layout">
          <${D} class="world-hierarchy-tree">${treeHtml}</${D}>
          <${D} class="world-hierarchy-detail">${detail}</${D}>
        </${D}>
      </${D}>`;
    },

    renderHierarchyTreeHtml(tree) {
      if (!tree.length) {
        return '<p class="hint">Нет миров — создайте первый.</p>';
      }
      let html = '<ul class="wh-tree">';
      tree.forEach((world) => {
        html += `<li><button type="button" class="wh-tree-btn" onclick="Editor.selectHierarchyNode('world','${this.escapeAttr(world.id)}')">${world.icon} ${this.escapeHtml(world.name)}</button>`;
        html += '<ul>';
        world.regions.forEach((region) => {
          html += `<li><button type="button" class="wh-tree-btn wh-tree-btn--region" onclick="Editor.selectHierarchyNode('region','${this.escapeAttr(region.id)}')">${region.icon} ${this.escapeHtml(region.name)}</button>`;
          html += '<ul>';
          region.hubs.forEach((hub) => {
            html += `<li><button type="button" class="wh-tree-btn wh-tree-btn--hub" onclick="Editor.selectHierarchyNode('hub','${this.escapeAttr(hub.id)}')">${hub.icon} ${this.escapeHtml(hub.name)}</button>`;
            html += '<ul>';
            hub.scenes.forEach((sc) => {
              const icon = sc.type === 'shop' ? '🏪' : sc.type === 'tavern' ? '🍺' : '📍';
              html += `<li><button type="button" class="wh-tree-btn wh-tree-btn--scene" onclick="Editor.selectHierarchyNode('scene','${this.escapeAttr(sc.id)}')">${icon} ${this.escapeHtml(sc.name)}</button></li>`;
            });
            html += '</ul></li>';
          });
          html += '</ul></li>';
        });
        html += '</ul></li>';
      });
      html += '</ul>';
      return html;
    },

    selectHierarchyNode(type, id) {
      this.hierarchySelection = { type, id };
      this.renderWorldHierarchy();
    },

    renderHierarchyDetailPanel() {
      const sel = this.hierarchySelection;
      if (!sel) {
        return `<${D} class="empty-state"><p>Выберите узел дерева слева.</p></${D}>`;
      }
      if (sel.type === 'hub') return this.renderHubEditPanel(sel.id);
      if (sel.type === 'region') return this.renderRegionEditPanel(sel.id);
      if (sel.type === 'world') return this.renderWorldEditPanel(sel.id);
      if (sel.type === 'scene') return this.renderHierarchyScenePanel(sel.id);
      return '';
    },

    renderInheritedFields(prefix, inherited, onChangeHub) {
      const inh = inherited || {};
      const rep = inh.reputation || {};
      const repKey = Object.keys(rep)[0] || 'rep_village';
      const repVal = rep[repKey] ?? 0;
      const npcIds = Object.keys(this.data.npcs || {});
      const npcChecks = npcIds.map((nid) => {
        const checked = (inh.npcsAvailable || []).includes(nid) ? 'checked' : '';
        return `<label><input type="checkbox" ${checked} onchange="Editor.toggleHubNpc('${this.escapeAttr(prefix)}','${this.escapeAttr(nid)}',this.checked)"> ${this.escapeHtml(this.data.npcs[nid]?.name || nid)}</label>`;
      }).join('');

      return `<h4>Наследуемое состояние</h4>
        <p class="hint">Все дочерние сцены получают эти значения автоматически.</p>
        <${D} class="form-group"><label>Музыка (ID ambient)</label>
          <input class="form-control" value="${this.escapeAttr(inh.music || '')}" onchange="Editor.updateHubInherited('${this.escapeAttr(prefix)}','music',this.value)"></${D}>
        <${D} class="form-group"><label>Время суток</label>
          <select class="form-control" onchange="Editor.updateHubInherited('${this.escapeAttr(prefix)}','timeOfDay',this.value)">
            ${['morning', 'day', 'evening', 'night'].map((t) => `<option value="${t}" ${inh.timeOfDay === t ? 'selected' : ''}>${WH.TIME_LABELS[t]}</option>`).join('')}
          </select></${D}>
        <${D} class="form-group"><label>Погода</label>
          <select class="form-control" onchange="Editor.updateHubInherited('${this.escapeAttr(prefix)}','weather',this.value)">
            ${['clear', 'cloudy', 'rain', 'snow', 'fog'].map((w) => `<option value="${w}" ${inh.weather === w ? 'selected' : ''}>${WH.WEATHER_LABELS[w]}</option>`).join('')}
          </select></${D}>
        <${D} class="form-group"><label>Атмосфера (ambient ID)</label>
          <input class="form-control" value="${this.escapeAttr(inh.ambient || '')}" onchange="Editor.updateHubInherited('${this.escapeAttr(prefix)}','ambient',this.value)"></${D}>
        <${D} class="form-group"><label>Репутация (флаг)</label>
          <input class="form-control" value="${this.escapeAttr(repKey)}" onchange="Editor.updateHubRepKey('${this.escapeAttr(prefix)}',this.value)"></${D}>
        <${D} class="form-group"><label>Базовое значение</label>
          <input type="number" class="form-control" value="${repVal}" onchange="Editor.updateHubRepValue('${this.escapeAttr(prefix)}','${this.escapeAttr(repKey)}',parseInt(this.value,10))"></${D}>
        <${D} class="form-group"><label>Доступные NPC</label><${D} class="wh-npc-checks">${npcChecks || '<span class="hint">Нет NPC</span>'}</${D}></${D}>`;
    },

    renderHubEditPanel(hubId) {
      const hub = this.data.hubs[hubId];
      if (!hub) return '<p>Хаб не найден</p>';
      if (!hub.inherited) hub.inherited = {};
      if (!hub.scenes) hub.scenes = [];
      const sceneList = hub.scenes.map((sid) => {
        const sc = this.data.scenes[sid];
        return `<li>${this.escapeHtml(sc?.location || sid)} <code>${sid}</code>
          <button type="button" class="btn btn-secondary" style="font-size:11px;" onclick="Editor.selectScene('${this.escapeAttr(sid)}')">Редактор сцены</button>
          <button type="button" class="btn btn-danger" style="font-size:11px;" onclick="Editor.detachSceneFromHub('${this.escapeAttr(sid)}')">Отвязать</button></li>`;
      }).join('') || '<li class="hint">Нет привязанных сцен</li>';

      const sceneOpts = Object.keys(this.data.scenes).sort().map((sid) =>
        `<option value="${this.escapeAttr(sid)}">${this.escapeHtml(sid)}</option>`
      ).join('');

      return `<h3>${WH.getHubIcon(hub)} Редактирование хаба</h3>
        <${D} class="form-group"><label>Название</label>
          <input class="form-control" value="${this.escapeAttr(hub.name || '')}" onchange="Editor.updateHubField('${this.escapeAttr(hubId)}','name',this.value)"></${D}>
        <${D} class="form-group"><label>ID</label><input class="form-control" value="${this.escapeAttr(hubId)}" disabled></${D}>
        <${D} class="form-group"><label>Сцена-площадь (hubScene)</label>
          <select class="form-control" onchange="Editor.updateHubField('${this.escapeAttr(hubId)}','hubScene',this.value)">
            ${sceneOpts.replace(`value="${this.escapeAttr(hub.hubScene)}"`, `value="${this.escapeAttr(hub.hubScene)}" selected`)}
          </select></${D}>
        ${this.renderInheritedFields(hubId, hub.inherited)}
        <h4>Внутренние сцены</h4>
        <ul class="wh-scene-list">${sceneList}</ul>
        <${D} style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
          <button type="button" class="btn btn-primary" onclick="Editor.openTemplateSceneModal()">+ Из шаблона</button>
          <select id="wh-attach-scene-select" class="form-control" style="max-width:220px;">${sceneOpts}</select>
          <button type="button" class="btn btn-secondary" onclick="Editor.attachSceneToHub('${this.escapeAttr(hubId)}',document.getElementById('wh-attach-scene-select').value)">Привязать сцену</button>
        </${D}>`;
    },

    renderRegionEditPanel(regionId) {
      const region = this.data.regions[regionId];
      if (!region) return '';
      if (!region.inherited) region.inherited = {};
      return `<h3>❄️ Регион: ${this.escapeHtml(region.name || regionId)}</h3>
        <${D} class="form-group"><label>Название</label>
          <input class="form-control" value="${this.escapeAttr(region.name || '')}" onchange="Editor.updateRegionField('${this.escapeAttr(regionId)}','name',this.value)"></${D}>
        <${D} class="form-group"><label>Климат</label>
          <input class="form-control" value="${this.escapeAttr(region.inherited.climate || '')}" onchange="Editor.updateRegionInherited('${this.escapeAttr(regionId)}','climate',this.value)"></${D}>
        <${D} class="form-group"><label>Музыка региона</label>
          <input class="form-control" value="${this.escapeAttr(region.inherited.music || '')}" onchange="Editor.updateRegionInherited('${this.escapeAttr(regionId)}','music',this.value)"></${D}>`;
    },

    renderWorldEditPanel(worldId) {
      const world = this.data.worlds[worldId];
      if (!world) return '';
      return `<h3>🌍 ${this.escapeHtml(world.name || worldId)}</h3>
        <${D} class="form-group"><label>Название</label>
          <input class="form-control" value="${this.escapeAttr(world.name || '')}" onchange="Editor.updateWorldField('${this.escapeAttr(worldId)}','name',this.value)"></${D}>`;
    },

    renderHierarchyScenePanel(sceneId) {
      const scene = this.data.scenes[sceneId];
      if (!scene) return '';
      const hubId = scene.parent || WH.getHubIdForScene(this.data, sceneId);
      const hub = hubId ? this.data.hubs[hubId] : null;
      const inherited = hubId && scene.inherits !== false
        ? WH.getSceneState(this.data, null, sceneId)
        : {};
      const own = scene.ownState || {};

      let inhReadonly = '';
      if (hubId) {
        inhReadonly = `<h4>Наследовано (только просмотр)</h4>
          <p class="hint">🔒 Музыка: <code>${this.escapeHtml(inherited.music || '—')}</code></p>
          <p class="hint">🔒 Время: ${this.escapeHtml(WH.TIME_LABELS[inherited.timeOfDay] || inherited.timeOfDay || '—')}</p>
          <p class="hint">🔒 Погода: ${this.escapeHtml(WH.WEATHER_LABELS[inherited.weather] || inherited.weather || '—')}</p>`;
      }

      return `<h3>📍 ${this.escapeHtml(scene.location || sceneId)}</h3>
        ${hub ? `<p>Наследует от: <strong>${this.escapeHtml(hub.name)}</strong> (${hubId})</p>` : '<p class="hint">Свободная сцена (без хаба)</p>'}
        <label><input type="checkbox" ${scene.inherits !== false ? 'checked' : ''} onchange="Editor.setSceneInherits('${this.escapeAttr(sceneId)}',this.checked)"> Наследовать состояние родителя</label>
        ${inhReadonly}
        <h4>Собственное (ownState)</h4>
        <textarea class="form-control" rows="6" onchange="Editor.setSceneOwnStateJson('${this.escapeAttr(sceneId)}',this.value)">${this.escapeHtml(JSON.stringify(own, null, 2))}</textarea>
        <${D} style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" class="btn btn-primary" onclick="Editor.selectScene('${this.escapeAttr(sceneId)}')">🎬 Открыть в редакторе сцен</button>
          ${hubId ? `<button type="button" class="btn btn-danger" onclick="Editor.detachSceneFromHub('${this.escapeAttr(sceneId)}')">🚫 Отвязать от хаба</button>` : `<button type="button" class="btn btn-secondary" onclick="Editor.promptAttachSceneToHub('${this.escapeAttr(sceneId)}')">Привязать к хабу</button>`}
        </${D}>`;
    },

    updateHubField(hubId, field, value) {
      if (!this.data.hubs[hubId]) return;
      this.data.hubs[hubId][field] = value;
      this.updateJSONPreview();
      this.renderWorldHierarchy();
    },

    updateHubInherited(hubId, key, value) {
      const hub = this.data.hubs[hubId];
      if (!hub) return;
      if (!hub.inherited) hub.inherited = {};
      hub.inherited[key] = value;
      this.updateJSONPreview();
    },

    updateHubRepKey(hubId, newKey) {
      const hub = this.data.hubs[hubId];
      if (!hub.inherited) hub.inherited = {};
      const old = hub.inherited.reputation || {};
      const val = Object.values(old)[0] ?? 0;
      hub.inherited.reputation = { [newKey]: val };
      this.updateJSONPreview();
      this.renderWorldHierarchy();
    },

    updateHubRepValue(hubId, key, val) {
      const hub = this.data.hubs[hubId];
      if (!hub.inherited) hub.inherited = {};
      if (!hub.inherited.reputation) hub.inherited.reputation = {};
      hub.inherited.reputation[key] = val;
      this.updateJSONPreview();
    },

    toggleHubNpc(hubId, npcId, on) {
      const hub = this.data.hubs[hubId];
      if (!hub.inherited) hub.inherited = {};
      if (!Array.isArray(hub.inherited.npcsAvailable)) hub.inherited.npcsAvailable = [];
      const arr = hub.inherited.npcsAvailable;
      const i = arr.indexOf(npcId);
      if (on && i === -1) arr.push(npcId);
      if (!on && i !== -1) arr.splice(i, 1);
      this.updateJSONPreview();
    },

    updateRegionField(id, field, value) {
      if (this.data.regions[id]) this.data.regions[id][field] = value;
      this.updateJSONPreview();
      this.renderWorldHierarchy();
    },

    updateRegionInherited(id, key, value) {
      if (!this.data.regions[id].inherited) this.data.regions[id].inherited = {};
      this.data.regions[id].inherited[key] = value;
      this.updateJSONPreview();
    },

    updateWorldField(id, field, value) {
      if (this.data.worlds[id]) this.data.worlds[id][field] = value;
      this.updateJSONPreview();
      this.renderWorldHierarchy();
    },

    setSceneInherits(sceneId, on) {
      const sc = this.data.scenes[sceneId];
      if (!sc) return;
      sc.inherits = !!on;
      this.updateJSONPreview();
      this.renderWorldHierarchy();
    },

    setSceneOwnStateJson(sceneId, raw) {
      try {
        this.data.scenes[sceneId].ownState = JSON.parse(raw);
        this.updateJSONPreview();
      } catch (e) {
        alert('Неверный JSON: ' + e.message);
      }
    },

    attachSceneToHub(hubId, sceneId) {
      if (!hubId || !sceneId || !this.data.hubs[hubId] || !this.data.scenes[sceneId]) return;
      const hub = this.data.hubs[hubId];
      if (!hub.scenes) hub.scenes = [];
      if (!hub.scenes.includes(sceneId)) hub.scenes.push(sceneId);
      this.data.scenes[sceneId].parent = hubId;
      if (this.data.scenes[sceneId].inherits == null) this.data.scenes[sceneId].inherits = true;
      if (!this.data.scenes[sceneId].hubScene) this.data.scenes[sceneId].hubScene = hub.hubScene || 'village_hub';
      this.hierarchySelection = { type: 'hub', id: hubId };
      this.updateJSONPreview();
      this.renderWorldHierarchy();
      this.renderSceneList();
    },

    detachSceneFromHub(sceneId) {
      const sc = this.data.scenes[sceneId];
      if (!sc?.parent) return;
      const hubId = sc.parent;
      const hub = this.data.hubs[hubId];
      if (hub?.scenes) hub.scenes = hub.scenes.filter((s) => s !== sceneId);
      delete sc.parent;
      this.updateJSONPreview();
      this.renderWorldHierarchy();
      this.renderSceneList();
    },

    promptAttachSceneToHub(sceneId) {
      const hubIds = Object.keys(this.data.hubs || {});
      if (!hubIds.length) {
        alert('Сначала создайте хаб');
        return;
      }
      const hubId = prompt('ID хаба:\n' + hubIds.join(', '), hubIds[0]);
      if (hubId && this.data.hubs[hubId]) this.attachSceneToHub(hubId, sceneId);
    },

    createWorld() {
      const id = prompt('ID мира (латиница):', 'world_main');
      if (!id || !/^[a-z][a-z0-9_]*$/i.test(id)) return;
      if (this.data.worlds[id]) {
        alert('Уже существует');
        return;
      }
      this.data.worlds[id] = { name: 'Новый мир', regions: [] };
      this.hierarchySelection = { type: 'world', id };
      this.renderWorldHierarchy();
      this.updateJSONPreview();
    },

    createRegion() {
      const worldIds = Object.keys(this.data.worlds || {});
      const parent = worldIds[0] || 'world_main';
      if (!this.data.worlds[parent]) {
        this.createWorld();
      }
      const id = prompt('ID региона:', 'region_new');
      if (!id || !/^[a-z][a-z0-9_]*$/i.test(id)) return;
      this.data.regions[id] = {
        name: 'Новый регион',
        parent: parent,
        hubs: [],
        inherited: { climate: 'temperate' }
      };
      if (!this.data.worlds[parent].regions) this.data.worlds[parent].regions = [];
      this.data.worlds[parent].regions.push(id);
      this.hierarchySelection = { type: 'region', id };
      this.renderWorldHierarchy();
      this.updateJSONPreview();
    },

    createHub() {
      const regionIds = Object.keys(this.data.regions || {});
      if (!regionIds.length) {
        alert('Сначала создайте регион');
        return;
      }
      const parent = regionIds.includes('region_tihaya_river') ? 'region_tihaya_river' : regionIds[0];
      const id = prompt('ID хаба:', 'hub_new');
      if (!id || !/^[a-z][a-z0-9_]*$/i.test(id)) return;
      this.data.hubs[id] = {
        name: 'Новый хаб',
        parent,
        type: 'village',
        hubScene: '',
        scenes: [],
        inherited: {
          music: 'buff',
          timeOfDay: 'morning',
          weather: 'clear',
          reputation: { rep_village: 0 }
        }
      };
      if (!this.data.regions[parent].hubs) this.data.regions[parent].hubs = [];
      this.data.regions[parent].hubs.push(id);
      this.hierarchySelection = { type: 'hub', id };
      this.renderWorldHierarchy();
      this.updateJSONPreview();
    },

    /** Визуальная карта для вкладки «Карта путешествий» */
    renderHierarchyMapDiagram() {
      const tree = WH.buildTree(this.data);
      if (!tree.length) return '';
      let blocks = '';
      tree.forEach((w) => {
        w.regions.forEach((r) => {
          r.hubs.forEach((h) => {
            const sceneIcons = h.scenes.map((s) => {
              const ic = s.type === 'shop' ? '🏪' : s.type === 'tavern' ? '🍺' : '·';
              return `<span class="wh-map-scene" title="${this.escapeAttr(s.id)}">${ic}</span>`;
            }).join('');
            blocks += `<${D} class="wh-map-hub-block">
              <${D} class="wh-map-region-label">❄️ ${this.escapeHtml(r.name)}</${D}>
              <${D} class="wh-map-hub">${h.icon} ${this.escapeHtml(h.name)}</${D}>
              <${D} class="wh-map-scenes">${sceneIcons}</${D}>
              <${D} class="wh-map-inherit-hint">↑ наследование</${D}>
            </${D}>`;
          });
        });
      });
      return `<${D} class="wh-map-diagram"><h4>🗺️ Иерархия локаций</h4><${D} class="wh-map-grid">${blocks}</${D}></${D}>`;
    }
  });

  const origWorldMap = Editor.renderWorldMap;
  Editor.renderWorldMap = function () {
    origWorldMap.call(this);
    const c = document.getElementById('worldmap-editor');
    if (!c || !this.data) return;
    const diagram = this.renderHierarchyMapDiagram();
    const detail = c.querySelector('.quest-manager-detail');
    if (detail && diagram) {
      const wrap = document.createElement(D);
      wrap.innerHTML = diagram;
      detail.insertBefore(wrap.firstElementChild, detail.firstChild);
    }
  };

  const origSwitch = Editor.switchTab;
  Editor.switchTab = function (tab, event) {
    origSwitch.call(this, tab, event);
    if (tab === 'world') this.renderWorldHierarchy();
  };

  const origRenderAll = Editor.renderAll;
  Editor.renderAll = function () {
    origRenderAll.call(this);
    this.renderWorldHierarchy();
  };

  const origSceneList = Editor.renderSceneList;
  Editor.renderSceneList = function () {
    origSceneList.call(this);
    if (!this.data?.scenes) return;
    document.querySelectorAll('.scene-item').forEach((el) => {
      const idEl = el.querySelector('.scene-id');
      if (!idEl || el.querySelector('.scene-hub-badge')) return;
      const m = el.getAttribute('onclick')?.match(/selectScene\('([^']+)'\)/);
      const sid = m?.[1];
      if (!sid) return;
      const hubId = WH.getHubIdForScene(this.data, sid);
      if (hubId) {
        const badge = document.createElement('span');
        badge.className = 'scene-hub-badge hint';
        badge.title = 'Хаб: ' + hubId;
        badge.textContent = ' 🏘';
        idEl.appendChild(badge);
      }
    });
  };
})();
