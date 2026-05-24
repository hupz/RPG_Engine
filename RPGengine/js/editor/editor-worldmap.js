// Редактор карты мира: worldMap + mapLocation на сценах

(function attachEditorWorldMap() {
  if (typeof Editor === 'undefined') {
    console.error('editor-worldmap.js: Editor не определён');
    return;
  }

  const D = 'motion'.replace('motion', 'div');
  const origRenderSceneEditor = Editor.renderSceneEditor.bind(Editor);

  Object.assign(Editor, {
    ensureWorldMap() {
      if (!this.data) return;
      if (!this.data.worldMap || typeof this.data.worldMap !== 'object') {
        this.data.worldMap = {};
      }
    },

    getSceneIds() {
      return Object.keys(this.data?.scenes || {});
    },

    renderMapLocationOptions(selected) {
      this.ensureWorldMap();
      const keys = Object.keys(this.data.worldMap);
      let html = `<option value="">— Не привязана —</option>`;
      for (const id of keys) {
        const loc = this.data.worldMap[id];
        const label = loc?.label || id;
        const sel = selected === id ? ' selected' : '';
        html += `<option value="${this.escapeAttr(id)}"${sel}>${this.escapeHtml(id)} — ${this.escapeHtml(label)}</option>`;
      }
      return html;
    },

    renderHubSceneOptions(selected) {
      return this.getSceneIds().map(sid => {
        const sel = selected === sid ? ' selected' : '';
        return `<option value="${this.escapeAttr(sid)}"${sel}>${this.escapeHtml(sid)}</option>`;
      }).join('');
    },

    renderMapLocationField(scene) {
      const mapLoc = scene.mapLocation || '';
      return `<${D} class="form-group map-location-block">
        <label>🗺️ Точка на карте путешествий (mapLocation)</label>
        <${D} style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          <select style="flex:1; min-width:200px;" onchange="Editor.setSceneMapLocation(this.value)">
            ${this.renderMapLocationOptions(mapLoc)}
          </select>
          <button type="button" class="btn btn-secondary" onclick="Editor.createMapFromCurrentScene()">+ Создать из сцены</button>
        </${D}>
        <${D} class="hint">Первый визит в эту сцену откроет точку в меню «Переместиться» у игрока. Hub — сцена, куда ведёт быстрый переход.</${D}>
      </${D}>`;
    },

    setSceneMapLocation(value) {
      if (!this.currentScene) return;
      const scene = this.data.scenes[this.currentScene];
      const id = (value || '').trim();
      if (id) scene.mapLocation = id;
      else delete scene.mapLocation;
      this.updateJSONPreview();
      this.renderSceneList();
    },

    createMapFromCurrentScene() {
      if (!this.currentScene) return;
      const scene = this.data.scenes[this.currentScene];
      const suggested = (this.currentScene || 'place').replace(/[^a-z0-9_]+/gi, '_').replace(/^_|_$/g, '').toLowerCase() || 'new_place';
      const id = prompt('ID точки на карте (латиница):', suggested);
      if (!id || !/^[a-z][a-z0-9_]*$/i.test(id)) {
        alert('ID: только латиница, цифры и _');
        return;
      }
      this.ensureWorldMap();
      if (this.data.worldMap[id] && !confirm('Точка "' + id + '" уже есть. Привязать сцену к ней?')) return;
      if (!this.data.worldMap[id]) {
        this.data.worldMap[id] = {
          label: scene.location || id,
          icon: '📍',
          hubScene: this.currentScene
        };
      }
      scene.mapLocation = id;
      this.renderSceneEditor();
      this.renderWorldMap();
      this.updateJSONPreview();
      alert('✅ Точка «' + id + '» создана и привязана к сцене.');
    },

    renderSceneEditor() {
      origRenderSceneEditor();
      if (!this.currentScene || !this.data?.scenes[this.currentScene]) return;
      if (document.querySelector('.map-location-block')) return;
      const locInput = document.getElementById('scene-location');
      if (!locInput?.parentElement) return;
      const wrap = document.createElement(D);
      wrap.innerHTML = this.renderMapLocationField(this.data.scenes[this.currentScene]);
      const el = wrap.firstElementChild;
      if (el) locInput.parentElement.insertAdjacentElement('afterend', el);
    },

    renderWorldMap() {
      const c = document.getElementById('worldmap-editor');
      if (!c) return;
      if (!this.data) {
        c.innerHTML = `<${D} class="empty-state"><h2>Загрузите данные</h2></${D}>`;
        return;
      }
      this.ensureWorldMap();
      const entries = Object.entries(this.data.worldMap);
      const flagNames = typeof ConditionSystem !== 'undefined'
        ? ConditionSystem.collectFlagNames(this.data)
        : [];

      const cards = entries.map(([id, loc]) => {
        const showIf = loc.showIf || {};
        const questStage = showIf.questStage || null;
        const flag = showIf.flag || '';
        const equals = showIf.equals !== undefined ? showIf.equals : (showIf.value !== undefined ? showIf.value : '');
        const equalsStr = equals === true ? 'true' : equals === false ? 'false' : String(equals ?? '');
        const scenesUsing = Object.entries(this.data.scenes || {})
          .filter(([, s]) => s.mapLocation === id)
          .map(([sid]) => sid);

        return `<${D} class="worldmap-card" data-map-id="${this.escapeAttr(id)}">
          <${D} class="worldmap-card-header">
            <span class="worldmap-card-icon">${this.escapeHtml(loc.icon || '📍')}</span>
            <code>${this.escapeHtml(id)}</code>
            <button type="button" class="btn btn-danger" style="margin-left:auto;" onclick="Editor.deleteMapLocation('${this.escapeAttr(id)}')">🗑</button>
          </${D}>
          <${D} class="grid-2">
            <${D} class="form-group"><label>Название в меню</label>
              <input value="${this.escapeAttr(loc.label || '')}" onchange="Editor.updateMapLocation('${this.escapeAttr(id)}','label',this.value)"></${D}>
            <${D} class="form-group"><label>Иконка</label>
              <input value="${this.escapeAttr(loc.icon || '📍')}" onchange="Editor.updateMapLocation('${this.escapeAttr(id)}','icon',this.value)"></${D}>
          </${D}>
          <${D} class="form-group"><label>Hub-сцена (куда ведёт переход)</label>
            <select onchange="Editor.updateMapLocation('${this.escapeAttr(id)}','hubScene',this.value)">
              <option value="">— Выберите —</option>
              ${this.renderHubSceneOptions(loc.hubScene || '')}
            </select></${D}>
          <${D} class="form-group"><label>Условие показа на карте</label>
            <${D} class="hint" style="margin-bottom:8px;">Режим: стадия квеста (рекомендуется) или legacy-флаг</${D}>
            <${D} class="grid-2" style="margin-bottom:8px;">
              <label style="font-size:12px;">Стадия квеста</label>
            </${D}>
            <${D} style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px;">
              ${this.renderQuestIdSelect(questStage?.questId || '', `Editor.updateMapQuestShowIf('${this.escapeAttr(id)}','questId',this.value)`)}
              ${this.renderQuestStageSelect(questStage?.questId || '', questStage?.stage != null ? String(questStage.stage) : '', `Editor.updateMapQuestShowIf('${this.escapeAttr(id)}','stage',this.value)`)}
              <button type="button" class="btn btn-secondary" style="font-size:11px;" onclick="Editor.clearMapQuestShowIf('${this.escapeAttr(id)}')">Сбросить квест</button>
            </${D}>
            <${D} class="grid-2">
              <select onchange="Editor.updateMapShowIf('${this.escapeAttr(id)}','flag',this.value)">
                <option value="">— Legacy-флаг —</option>
                ${flagNames.map(f => `<option value="${this.escapeAttr(f)}" ${f === flag ? 'selected' : ''}>${this.escapeHtml(f)}</option>`).join('')}
              </select>
              <input placeholder="значение флага" value="${this.escapeAttr(equalsStr)}" onchange="Editor.updateMapShowIf('${this.escapeAttr(id)}','equals',this.value)">
            </${D}>
            <${D} class="hint">Пусто = точка видна после первого визита. Квест: показывать, когда стадия совпадает.</${D}>
          </${D}>
          <${D} class="hint">Сцены с mapLocation: ${scenesUsing.length ? scenesUsing.map(s => '<code>' + this.escapeHtml(s) + '</code>').join(', ') : '— нет —'}</${D}>
        </${D}>`;
      }).join('');

      c.innerHTML = `
        <${D} class="worldmap-editor-panel">
          <h2>🗺️ Карта путешествий</h2>
          <p class="hint">Блок <code>worldMap</code> в JSON — быстрые переходы для игрока. Сцены помечаются полем <code>mapLocation</code> (вкладка «Сцены»).</p>
          <button type="button" class="btn btn-primary" onclick="Editor.createMapLocation()">+ Новая точка на карте</button>
          <${D} class="worldmap-list" style="margin-top:20px;">${cards || '<p class="hint">Пока нет точек. Создайте первую или привяжите из редактора сцены.</p>'}</${D}>
        </${D}>`;
    },

    createMapLocation() {
      const id = prompt('ID точки (латиница, например forest_camp):', 'new_place');
      if (!id || !/^[a-z][a-z0-9_]*$/i.test(id)) {
        alert('ID: только латиница, цифры и _');
        return;
      }
      this.ensureWorldMap();
      if (this.data.worldMap[id]) {
        alert('Точка уже существует');
        return;
      }
      const hub = this.currentScene || this.getSceneIds()[0] || '';
      this.data.worldMap[id] = { label: 'Новое место', icon: '📍', hubScene: hub };
      this.renderWorldMap();
      this.updateJSONPreview();
    },

    deleteMapLocation(id) {
      if (!confirm('Удалить точку «' + id + '» с карты? mapLocation у сцен не сбросится автоматически.')) return;
      delete this.data.worldMap[id];
      this.renderWorldMap();
      this.renderSceneEditor();
      this.updateJSONPreview();
    },

    updateMapLocation(id, field, value) {
      if (!this.data.worldMap?.[id]) return;
      this.data.worldMap[id][field] = value;
      this.updateJSONPreview();
      if (field === 'icon' || field === 'label') this.renderWorldMap();
    },

    updateMapShowIf(id, field, raw) {
      if (!this.data.worldMap?.[id]) return;
      const loc = this.data.worldMap[id];
      if (field === 'flag') {
        if (!raw) {
          if (loc.showIf && !loc.showIf.questStage) delete loc.showIf;
          else if (loc.showIf) delete loc.showIf.flag;
        } else {
          if (!loc.showIf) loc.showIf = {};
          loc.showIf.flag = raw;
          if (loc.showIf.equals === undefined) loc.showIf.equals = true;
        }
      } else if (field === 'equals') {
        if (!loc.showIf?.flag) return;
        let val = raw;
        if (val === 'true') val = true;
        else if (val === 'false') val = false;
        else if (val !== '' && !Number.isNaN(Number(val))) val = Number(val);
        loc.showIf.equals = val;
        delete loc.showIf.value;
      }
      this.updateJSONPreview();
    },

    /** Условие карты: стадия квеста из data.quests */
    updateMapQuestShowIf(mapId, field, value) {
      if (!this.data.worldMap?.[mapId]) return;
      const loc = this.data.worldMap[mapId];
      if (!loc.showIf) loc.showIf = {};
      if (!loc.showIf.questStage) {
        const qid = this.getQuestIds?.()[0] || '';
        loc.showIf.questStage = { questId: qid, stage: this.getQuestStageKeys?.(qid)[0] || '0' };
      }
      if (field === 'questId') {
        loc.showIf.questStage.questId = value;
        const keys = this.getQuestStageKeys(value);
        loc.showIf.questStage.stage = keys[0] || '0';
        this.renderWorldMap();
      } else if (field === 'stage') {
        loc.showIf.questStage.stage = value;
      }
      this.updateJSONPreview();
    },

    clearMapQuestShowIf(mapId) {
      const loc = this.data.worldMap?.[mapId];
      if (!loc?.showIf) return;
      delete loc.showIf.questStage;
      if (!loc.showIf.flag && !loc.showIf.all && !loc.showIf.any) delete loc.showIf;
      this.renderWorldMap();
      this.updateJSONPreview();
    }
  });

  const origRenderSceneList = Editor.renderSceneList.bind(Editor);
  Editor.renderSceneList = function () {
    origRenderSceneList();
    if (!this.data?.scenes) return;
    document.querySelectorAll('.scene-item').forEach(el => {
      const idEl = el.querySelector('.scene-id');
      if (!idEl) return;
      const sid = idEl.textContent.trim();
      const mapId = this.data.scenes[sid]?.mapLocation;
      if (mapId && !el.querySelector('.scene-map-badge')) {
        const badge = document.createElement('span');
        badge.className = 'scene-map-badge';
        badge.title = 'mapLocation: ' + mapId;
        badge.textContent = '🗺️ ' + mapId;
        idEl.insertAdjacentElement('afterend', badge);
      }
    });
  };
})();
