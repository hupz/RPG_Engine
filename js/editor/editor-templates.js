// ============================================
// Редактор: создание сцен из шаблонов
// ============================================

(function attachEditorTemplates() {
  if (typeof Editor === 'undefined') {
    console.error('editor-templates.js: Editor не определён');
    return;
  }

  const STE = typeof SceneTemplateEngine !== 'undefined' ? SceneTemplateEngine : null;

  Object.assign(Editor, {
    _templateModalType: 'shop',
    _templatePreviewHtml: '',

    ensureSceneTemplateData() {
      if (!this.data) return;
      if (STE) STE.ensureTemplateData(this.data);
    },

    getSceneTemplateIcon(scene) {
      if (!scene?.sceneTemplate || scene.templateDetached) return '✋';
      return STE ? STE.getTemplateIcon(scene.sceneTemplate) : '📄';
    },

    openTemplateSceneModal() {
      if (!this.data?.scenes) {
        alert('Сначала загрузите данные проекта');
        return;
      }
      this.ensureSceneTemplateData();
      this._templateModalType = 'shop';
      const modal = document.getElementById('template-scene-modal');
      if (modal) {
        modal.classList.remove('hidden');
        this.renderTemplateModalForm();
      }
    },

    closeTemplateSceneModal() {
      document.getElementById('template-scene-modal')?.classList.add('hidden');
      this._templatePreviewHtml = '';
    },

    setTemplateModalType(type) {
      this._templateModalType = type;
      this.renderTemplateModalForm();
    },

    getNpcOptions(selected) {
      return Object.entries(this.data?.npcs || {})
        .map(([id, n]) => `<option value="${this.escapeAttr(id)}" ${id === selected ? 'selected' : ''}>${this.escapeHtml(n.name || id)}</option>`)
        .join('');
    },

    getSceneOptions(selected) {
      return Object.keys(this.data?.scenes || {})
        .sort()
        .map((id) => `<option value="${this.escapeAttr(id)}" ${id === selected ? 'selected' : ''}>${this.escapeHtml(id)}</option>`)
        .join('');
    },

    getInventoryOptions(selected) {
      const invs = this.data?.shopInventories || {};
      let html = Object.entries(invs)
        .map(([id, inv]) => {
          const label = inv.name || id;
          return `<option value="${this.escapeAttr(id)}" ${id === selected ? 'selected' : ''}>${this.escapeHtml(label)} (${id})</option>`;
        })
        .join('');
      if (!html) html = '<option value="village_shop">village_shop (дефолт)</option>';
      return html;
    },

    getEnemyOptionsMulti(selectedIds) {
      const set = new Set(selectedIds || []);
      return Object.keys(this.data?.enemies || {})
        .sort()
        .map((id) => {
          const checked = set.has(id) ? 'checked' : '';
          return `<label class="tpl-multi-check"><input type="checkbox" value="${this.escapeAttr(id)}" ${checked}> ${this.escapeHtml(this.data.enemies[id]?.name || id)}</label>`;
        })
        .join('');
    },

    getLocationOptionsMulti(selectedIds) {
      const set = new Set(selectedIds || []);
      return Object.keys(this.data?.scenes || {})
        .sort()
        .map((id) => {
          const checked = set.has(id) ? 'checked' : '';
          const loc = this.data.scenes[id]?.location || id;
          return `<label class="tpl-multi-check"><input type="checkbox" value="${this.escapeAttr(id)}" ${checked}> ${this.escapeHtml(loc)} <code>${this.escapeHtml(id)}</code></label>`;
        })
        .join('');
    },

    readTemplateFormParams() {
      const type = this._templateModalType;
      const id = document.getElementById('tpl-scene-id')?.value?.trim();
      const name = document.getElementById('tpl-scene-name')?.value?.trim();
      const bg = document.getElementById('tpl-scene-bg')?.value?.trim() || '';
      const exit = document.getElementById('tpl-scene-exit')?.value?.trim() || 'village_hub';
      const params = { exit, exitScene: exit, bg, name };

      const readMulti = (containerId) => {
        const box = document.getElementById(containerId);
        if (!box) return [];
        return [...box.querySelectorAll('input[type=checkbox]:checked')].map((el) => el.value);
      };

      if (type === 'village_hub') {
        params.locations = readMulti('tpl-locations-box');
        params.mapLocation = id;
      }
      if (type === 'shop') {
        params.merchant = document.getElementById('tpl-merchant')?.value || 'jack';
        params.inventory = document.getElementById('tpl-inventory')?.value || 'village_shop';
      }
      if (type === 'tavern') {
        params.innkeeper = document.getElementById('tpl-innkeeper')?.value || 'marta';
        params.menu = document.getElementById('tpl-menu')?.value || 'tavern_menu';
        params.roomPrice = parseInt(document.getElementById('tpl-room-price')?.value, 10) || 5;
      }
      if (type === 'blacksmith') {
        params.blacksmith = document.getElementById('tpl-blacksmith')?.value || '';
        params.services = {
          enhance: document.getElementById('tpl-svc-enhance')?.checked !== false,
          repair: document.getElementById('tpl-svc-repair')?.checked !== false
        };
      }
      if (type === 'temple') {
        params.priest = document.getElementById('tpl-priest')?.value || '';
        params.healPrice = parseInt(document.getElementById('tpl-heal-price')?.value, 10) || 25;
        params.services = {
          heal: document.getElementById('tpl-svc-heal')?.checked !== false,
          curse: document.getElementById('tpl-svc-curse')?.checked !== false,
          bless: document.getElementById('tpl-svc-bless')?.checked !== false
        };
      }
      if (type === 'dungeon' || type === 'combat') {
        params.enemies = readMulti('tpl-enemies-box');
        params.difficulty = parseInt(document.getElementById('tpl-difficulty')?.value, 10) || 1;
        params.loot = (document.getElementById('tpl-loot')?.value || '').split(',').map((s) => s.trim()).filter(Boolean);
        if (type === 'combat') {
          params.winScene = document.getElementById('tpl-win-scene')?.value || exit;
          params.loseScene = document.getElementById('tpl-lose-scene')?.value || 'game_over';
        }
      }
      if (type === 'dialogue') {
        params.npc = document.getElementById('tpl-npc')?.value || '';
        const topicsRaw = document.getElementById('tpl-topics')?.value || '';
        params.topics = topicsRaw.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
          const parts = line.split('|');
          if (parts.length >= 2) {
            return { id: parts[0].trim(), label: parts[1].trim(), reply: parts[2]?.trim() || parts[1].trim() };
          }
          return { label: line, reply: `«${line}» — отвечает собеседник.` };
        });
      }
      if (type === 'loot_search') {
        params.items = (document.getElementById('tpl-loot-items')?.value || '').split(',').map((s) => s.trim()).filter(Boolean);
        params.dc = parseInt(document.getElementById('tpl-loot-dc')?.value, 10) || 12;
        params.skill = document.getElementById('tpl-loot-skill')?.value || 'investigation';
      }

      return { template: type, id, name: name || id, params, overrides: {} };
    },

    renderTemplateTypeFields(type) {
      const exit = 'village_hub';
      if (type === 'village_hub') {
        return `<div class="form-group"><label>Локации (выходы с площади)</label>
          <div id="tpl-locations-box" class="tpl-multi-box">${this.getLocationOptionsMulti(['tavern', 'blacksmith', 'temple', 'jack_shop'])}</div></div>`;
      }
      if (type === 'shop') {
        return `<div class="form-group"><label>Торговец (NPC)</label>
          <select id="tpl-merchant" class="form-control">${this.getNpcOptions('jack')}</select></div>
          <div class="form-group"><label>Ассортимент</label>
          <select id="tpl-inventory" class="form-control">${this.getInventoryOptions('village_shop')}</select>
          <p class="hint">Таблица shopInventories в JSON или shopItems у NPC.</p></div>`;
      }
      if (type === 'tavern') {
        return `<div class="form-group"><label>Хозяин (NPC)</label>
          <select id="tpl-innkeeper" class="form-control">${this.getNpcOptions('marta')}</select></div>
          <div class="form-group"><label>Меню (инвентарь)</label>
          <select id="tpl-menu" class="form-control">${this.getInventoryOptions('tavern_menu')}</select></div>
          <div class="form-group"><label>Комната (цена, зм)</label>
          <input type="number" id="tpl-room-price" class="form-control" value="5" min="0"></div>`;
      }
      if (type === 'blacksmith') {
        return `<div class="form-group"><label>Кузнец (NPC)</label>
          <select id="tpl-blacksmith" class="form-control">${this.getNpcOptions('')}</select></div>
          <div class="form-group"><label>Услуги</label>
          <label><input type="checkbox" id="tpl-svc-enhance" checked> Заточка</label>
          <label><input type="checkbox" id="tpl-svc-repair" checked> Ремонт</label></div>`;
      }
      if (type === 'temple') {
        return `<div class="form-group"><label>Священник (NPC)</label>
          <select id="tpl-priest" class="form-control">${this.getNpcOptions('')}</select></div>
          <div class="form-group"><label>Лечение (цена, зм)</label>
          <input type="number" id="tpl-heal-price" class="form-control" value="25" min="1"></div>
          <div class="form-group"><label>Услуги</label>
          <label><input type="checkbox" id="tpl-svc-heal" checked> Лечение</label>
          <label><input type="checkbox" id="tpl-svc-curse" checked> Снятие проклятия</label>
          <label><input type="checkbox" id="tpl-svc-bless" checked> Благословение</label></div>`;
      }
      if (type === 'dungeon') {
        return `<div class="form-group"><label>Уровень сложности</label>
          <select id="tpl-difficulty" class="form-control"><option value="1">1 — лёгкая</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></div>
          <div class="form-group"><label>Враги</label><div id="tpl-enemies-box" class="tpl-multi-box">${this.getEnemyOptionsMulti(['rat'])}</div></div>
          <div class="form-group"><label>Лут (ID предметов, через запятую)</label>
          <input type="text" id="tpl-loot" class="form-control" placeholder="healing_potion, gold..."></div>`;
      }
      if (type === 'dialogue') {
        return `<div class="form-group"><label>NPC</label>
          <select id="tpl-npc" class="form-control">${this.getNpcOptions('marta')}</select></div>
          <div class="form-group"><label>Темы (по строке: id|Подпись|Ответ NPC)</label>
          <textarea id="tpl-topics" class="form-control" rows="4" placeholder="rumors|Слухи|Слыхал про мельницу...&#10;quest|Квест|Может, поможешь?"></textarea></div>`;
      }
      if (type === 'combat') {
        return `<div class="form-group"><label>Враги</label><div id="tpl-enemies-box" class="tpl-multi-box">${this.getEnemyOptionsMulti(['rat'])}</div></div>
          <div class="form-group"><label>Лут (ID, через запятую)</label><input type="text" id="tpl-loot" class="form-control"></div>
          <div class="form-group"><label>Сцена победы</label><select id="tpl-win-scene" class="form-control">${this.getSceneOptions(exit)}</select></div>
          <div class="form-group"><label>Сцена поражения</label><select id="tpl-lose-scene" class="form-control"><option value="game_over">game_over</option>${this.getSceneOptions('')}</select></div>`;
      }
      if (type === 'loot_search') {
        return `<div class="form-group"><label>Предметы (ID, через запятую)</label>
          <input type="text" id="tpl-loot-items" class="form-control" placeholder="healing_potion"></div>
          <div class="form-group"><label>Сложность (КС)</label><input type="number" id="tpl-loot-dc" class="form-control" value="12"></div>
          <div class="form-group"><label>Навык</label>
          <select id="tpl-loot-skill" class="form-control">
            <option value="investigation">Расследование</option>
            <option value="perception">Восприятие</option>
            <option value="survival">Выживание</option>
          </select></div>`;
      }
      return '';
    },

    renderTemplateModalForm() {
      const body = document.getElementById('template-scene-modal-body');
      if (!body || !STE) return;
      const type = this._templateModalType;
      const templates = STE.listBaseTemplates();
      const typeOpts = templates.map((t) =>
        `<option value="${t.id}" ${t.id === type ? 'selected' : ''}>${t.icon} ${this.escapeHtml(t.label)}</option>`
      ).join('');

      body.innerHTML = `
        <div class="form-group"><label>Шаблон</label>
          <select id="tpl-type-select" class="form-control" onchange="Editor.setTemplateModalType(this.value)">${typeOpts}</select></div>
        <h4>Параметры</h4>
        <div class="form-group"><label>ID сцены</label><input type="text" id="tpl-scene-id" class="form-control" placeholder="village_shop_1" value="new_${type}"></div>
        <div class="form-group"><label>Название (локация)</label><input type="text" id="tpl-scene-name" class="form-control" placeholder="Лавка Джека"></div>
        <div class="form-group"><label>Фон (файл)</label><input type="text" id="tpl-scene-bg" class="form-control" placeholder="shop01.png"></div>
        <div class="form-group"><label>Выход (сцена)</label><select id="tpl-scene-exit" class="form-control">${this.getSceneOptions('village_hub')}</select></div>
        <div id="tpl-type-fields">${this.renderTemplateTypeFields(type)}</div>
        <h4 style="margin-top:16px;">Превью</h4>
        <div id="tpl-preview-box" class="tpl-preview-box">${this._templatePreviewHtml || '<p class="hint">Нажмите «Предпросмотр»</p>'}</div>
        <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">
          <button type="button" class="btn btn-secondary" onclick="Editor.previewTemplateScene()">👁️ Предпросмотр</button>
          <button type="button" class="btn btn-primary" onclick="Editor.commitTemplateScene()">✅ Создать</button>
          <button type="button" class="btn btn-secondary" onclick="Editor.closeTemplateSceneModal()">❌ Отмена</button>
        </div>`;
    },

    previewTemplateScene() {
      if (!STE) return;
      const spec = this.readTemplateFormParams();
      if (!spec.id || !/^[a-z][a-z0-9_]*$/i.test(spec.id)) {
        alert('Укажите корректный ID сцены (латиница, snake_case)');
        return;
      }
      try {
        const { main, extra } = STE.generateCompanionScenes(this.data, spec);
        const esc = (s) => this.escapeHtml(s);
        let html = `<p><strong>${esc(main.location)}</strong> <code>${esc(spec.id)}</code> · special: <code>${esc(main.special || '—')}</code></p>`;
        html += `<pre class="tpl-preview-text">${esc(main.text || '')}</pre>`;
        html += '<p><strong>Выборы:</strong></p><ul>';
        (main.choices || []).forEach((c) => {
          html += `<li>${esc(c.text)} → ${esc(c.to || c.action || '—')}</li>`;
        });
        html += '</ul>';
        const extraIds = Object.keys(extra);
        if (extraIds.length) {
          html += `<p class="hint">Доп. сцены: ${extraIds.map(esc).join(', ')}</p>`;
        }
        this._templatePreviewHtml = html;
        const box = document.getElementById('tpl-preview-box');
        if (box) box.innerHTML = html;
      } catch (e) {
        alert('Ошибка генерации: ' + e.message);
      }
    },

    commitTemplateScene() {
      if (!STE) return;
      const spec = this.readTemplateFormParams();
      if (!spec.id || !/^[a-z][a-z0-9_]*$/i.test(spec.id)) {
        alert('ID сцены: латиница, snake_case');
        return;
      }
      if (this.data.scenes[spec.id]) {
        alert('Сцена с таким ID уже существует');
        return;
      }
      try {
        const { main, extra } = STE.generateCompanionScenes(this.data, spec);
        this.data.scenes[spec.id] = main;
        Object.entries(extra).forEach(([eid, escene]) => {
          if (!this.data.scenes[eid]) this.data.scenes[eid] = escene;
        });
        this.currentScene = spec.id;
        this.closeTemplateSceneModal();
        this.renderSceneList();
        this.selectScene(spec.id);
        this.updateJSONPreview();
        alert(`Создано: ${spec.id}` + (Object.keys(extra).length ? ` (+ ${Object.keys(extra).join(', ')})` : ''));
      } catch (e) {
        alert('Ошибка: ' + e.message);
      }
    },

    detachSceneFromTemplate() {
      if (!this.currentScene) return;
      const scene = this.data.scenes[this.currentScene];
      if (!scene?.sceneTemplate) return;
      if (!confirm('Разорвать связь с шаблоном? Сцена станет ручной (текущий текст и выборы сохранятся).')) return;
      scene.templateDetached = true;
      delete scene.sceneTemplate;
      delete scene.templateParams;
      this.updateJSONPreview();
      this.renderSceneList();
      this.renderSceneEditor();
    },

    resyncSceneFromTemplate() {
      if (!this.currentScene || !STE) return;
      const scene = this.data.scenes[this.currentScene];
      if (!scene?.sceneTemplate || scene.templateDetached) return;
      if (!confirm('Пересоздать сцену из шаблона? Ручные правки в полях могут быть перезаписаны (overrides сохранятся).')) return;
      const spec = {
        template: scene.sceneTemplate,
        id: this.currentScene,
        name: scene.templateParams?.name || scene.location,
        params: scene.templateParams || {},
        overrides: scene.overrides || {}
      };
      try {
        const { main, extra } = STE.generateCompanionScenes(this.data, spec);
        const keep = { overrides: scene.overrides, mapLocation: scene.mapLocation };
        Object.assign(scene, main, keep);
        Object.entries(extra).forEach(([eid, escene]) => {
          if (!this.data.scenes[eid]) this.data.scenes[eid] = escene;
        });
        this.renderSceneEditor();
        this.renderSceneList();
        this.updateJSONPreview();
      } catch (e) {
        alert(e.message);
      }
    },

    // ——— Вкладка «Шаблоны» (кастомизация текстов) ———
    renderSceneTemplatesTab() {
      const c = document.getElementById('scene-templates-editor');
      if (!c) return;
      if (!this.data) {
        c.innerHTML = '<div class="empty-state"><h2>Загрузите данные</h2></div>';
        return;
      }
      this.ensureSceneTemplateData();
      const templates = STE.listBaseTemplates();
      const cards = templates.map((t) => {
        const str = STE.getStrings(this.data, t.id);
        const keys = Object.keys(str);
        const fields = keys.map((k) => `<div class="form-group"><label>${this.escapeHtml(k)}</label>
          <textarea class="form-control" rows="2" data-tpl="${t.id}" data-key="${this.escapeAttr(k)}"
            onchange="Editor.updateCustomTemplateString('${this.escapeAttr(t.id)}','${this.escapeAttr(k)}',this.value)">${this.escapeHtml(str[k])}</textarea></div>`).join('');
        return `<div class="tpl-def-card">
          <h4>${t.icon} ${this.escapeHtml(t.label)} <span class="hint">(базовый, только кастом-копия)</span></h4>
          <p class="hint">Подстановки: {merchantName}, {itemList}, {locationName}, {price}…</p>
          ${fields}
          <button type="button" class="btn btn-secondary" onclick="Editor.resetCustomTemplateStrings('${this.escapeAttr(t.id)}')">Сбросить кастомные тексты</button>
        </div>`;
      }).join('');

      c.innerHTML = `<div class="tpl-def-manager">
        <h3>📋 Шаблоны сцен</h3>
        <p class="hint">9 базовых шаблонов неизменяемы; здесь можно переопределить тексты в <code>sceneTemplateDefs.custom</code>.</p>
        ${cards}
      </div>`;
    },

    updateCustomTemplateString(templateId, key, value) {
      if (!this.data.sceneTemplateDefs) this.data.sceneTemplateDefs = { custom: {} };
      if (!this.data.sceneTemplateDefs.custom[templateId]) {
        this.data.sceneTemplateDefs.custom[templateId] = { strings: {} };
      }
      if (!this.data.sceneTemplateDefs.custom[templateId].strings) {
        this.data.sceneTemplateDefs.custom[templateId].strings = {};
      }
      this.data.sceneTemplateDefs.custom[templateId].strings[key] = value;
      this.updateJSONPreview();
    },

    resetCustomTemplateStrings(templateId) {
      if (!this.data?.sceneTemplateDefs?.custom?.[templateId]) return;
      delete this.data.sceneTemplateDefs.custom[templateId];
      this.renderSceneTemplatesTab();
      this.updateJSONPreview();
    }
  });

  // Патч списка сцен — иконка шаблона
  const origList = Editor.renderSceneList;
  Editor.renderSceneList = function () {
    const list = document.getElementById('scene-list');
    if (!this.data?.scenes) {
      if (list) list.innerHTML = '';
      return;
    }
    list.innerHTML = Object.entries(this.data.scenes).map(([id, scene]) => {
      const preview = scene.text ? scene.text.substring(0, 60) + '...' : (scene.special ? `special: ${scene.special}` : 'Нет текста');
      const active = this.currentScene === id ? 'active' : '';
      const icon = this.getSceneTemplateIcon(scene);
      const tplBadge = scene.sceneTemplate && !scene.templateDetached
        ? `<span class="scene-tpl-badge" title="Шаблон: ${this.escapeAttr(scene.sceneTemplate)}">${icon}</span>`
        : `<span class="scene-tpl-badge" title="Ручная сцена">${icon}</span>`;
      return `<div class="scene-item ${active}" onclick="Editor.selectScene('${id}')">
        <div class="scene-id">${tplBadge} ${id}</div>
        <div class="scene-loc">${scene.location || '—'}</div>
        <div class="scene-preview">${preview}</div>
      </div>`;
    }).join('');
  };

  // Панель в редакторе сцены
  const origEditor = Editor.renderSceneEditor;
  Editor.renderSceneEditor = function () {
    origEditor.call(this);
    const scene = this.currentScene && this.data?.scenes?.[this.currentScene];
    if (!scene?.sceneTemplate || scene.templateDetached) return;
    const container = document.getElementById('scene-editor');
    if (!container) return;
    const panel = document.createElement('div');
    panel.className = 'project-info tpl-scene-panel';
    panel.style.marginTop = '12px';
    panel.innerHTML = `<h4>${this.getSceneTemplateIcon(scene)} Сцена из шаблона: <code>${this.escapeHtml(scene.sceneTemplate)}</code></h4>
      <p class="hint">При игре сцена разворачивается из шаблона + overrides. Параметры: <code>${this.escapeHtml(JSON.stringify(scene.templateParams || {}))}</code></p>
      <button type="button" class="btn btn-secondary" onclick="Editor.resyncSceneFromTemplate()">🔄 Обновить из шаблона</button>
      <button type="button" class="btn btn-danger" onclick="Editor.detachSceneFromTemplate()">✂ Разорвать связь с шаблоном</button>`;
    container.appendChild(panel);
  };

  const origSwitch = Editor.switchTab;
  Editor.switchTab = function (tab, event) {
    origSwitch.call(this, tab, event);
    if (tab === 'scene_templates') this.renderSceneTemplatesTab();
  };

  const origRenderAll = Editor.renderAll;
  Editor.renderAll = function () {
    origRenderAll.call(this);
    if (typeof this.renderSceneTemplatesTab === 'function') this.renderSceneTemplatesTab();
  };
})();
