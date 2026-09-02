// ============================================================
// Компонентный конструктор сцен: ID + название, затем «+» модули
// ============================================================
(function attachEditorSceneBuilder() {
  if (typeof Editor === 'undefined') {
    console.error('editor-scene-builder.js: Editor не определён');
    return;
  }

  /** Каталог модулей сцены (то, что появляется по кнопке +) */
  const SCENE_MODULES = [
    { id: 'story', icon: '📝', label: 'Текст и локация', hint: 'Описание сцены для игрока' },
    { id: 'npc', icon: '👤', label: 'NPC', hint: 'Привязка персонажа к сцене' },
    { id: 'dialogue', icon: '💬', label: 'Диалог', hint: 'Реплики speaker / text' },
    { id: 'choices', icon: '🔀', label: 'Выборы', hint: 'Кнопки переходов' },
    { id: 'quest', icon: '📜', label: 'Квест', hint: 'Старт/прогресс квеста на выборах' },
    { id: 'combat', icon: '⚔️', label: 'Бой', hint: 'Враги и следующая сцена' },
    { id: 'components', icon: '🧩', label: 'Компоненты UI', hint: 'Диалог-дерево, торговля, услуги…' },
    { id: 'elements', icon: '🎬', label: 'Элементы сцены', hint: 'Последовательные блоки / advanced' },
    { id: 'items', icon: '🎒', label: 'Предметы', hint: 'Выдача предметов при входе' },
    { id: 'flags', icon: '🚩', label: 'Флаги', hint: 'Установка флагов при входе' },
    { id: 'audio', icon: '🔊', label: 'Звук', hint: 'Ambient и SFX' },
    { id: 'climate', icon: '🌤', label: 'Погода и климат', hint: 'Погода сцены' },
    { id: 'time', icon: '🕐', label: 'Время', hint: 'Сдвиг времени при входе' },
    { id: 'map', icon: '🗺️', label: 'Карта', hint: 'Точка на карте путешествий' },
    { id: 'hub', icon: '🏘️', label: 'Хаб / возврат', hint: 'Связь с хабом локации' },
    { id: 'template', icon: '📋', label: 'Шаблон', hint: 'Создать содержимое из шаблона' },
    { id: 'scene_choice', icon: '🗺️', label: 'Выбор сцены', hint: 'Куда пойти — несколько переходов' },
    { id: 'location_place', icon: '🏛️', label: 'Локация / место', hint: 'Магазин, кузница, храм…' },
    { id: 'shop', icon: '🛒', label: 'Магазин', hint: 'Торговля предметами с игроком' },
    { id: 'blacksmith', icon: '🔨', label: 'Кузница', hint: 'Улучшение и ремонт через существующий крафт' },
    { id: 'church', icon: '⛪', label: 'Церковь', hint: 'Служитель и сервисные действия' }
  ];

  function moduleMeta(id) {
    return SCENE_MODULES.find((m) => m.id === id) || { id, icon: '📦', label: id, hint: '' };
  }

  Object.assign(Editor, {
    _sceneModulePickerOpen: false,
    SCENE_MODULES,

    /**
     * Активные модули: явный список editorModules или вывод из данных сцены.
     */
    getSceneModules(scene) {
      if (!scene) return [];
      // Явный список (в т.ч. пустой []) — только он; infer только если поля нет
      if (Object.prototype.hasOwnProperty.call(scene, 'editorModules') && Array.isArray(scene.editorModules)) {
        return scene.editorModules.slice();
      }
      return this.inferSceneModules(scene);
    },

    inferSceneModules(scene) {
      const m = [];
      if (scene.text || scene.location) m.push('story');
      if (scene.npcId) m.push('npc');
      if (Array.isArray(scene.dialogue) && scene.dialogue.length) m.push('dialogue');
      if (Array.isArray(scene.choices) && scene.choices.length) m.push('choices');
      if (
        (Array.isArray(scene.choices) && scene.choices.some((c) => c && c.questSet)) ||
        (scene.flags && Object.keys(scene.flags).some((k) => String(k).startsWith('quest_')))
      ) {
        m.push('quest');
      }
      if (Array.isArray(scene.combat) && scene.combat.length) m.push('combat');
      if (Array.isArray(scene.components) && scene.components.length) m.push('components');
      if (Array.isArray(scene.elements) && scene.elements.length) m.push('elements');
      if (Array.isArray(scene.items) && scene.items.length) m.push('items');
      if (scene.flags && Object.keys(scene.flags).length) m.push('flags');
      if (scene.audio) m.push('audio');
      if (scene.climate || scene.weather) m.push('climate');
      if (scene.timeAdvance != null || scene.timeOfDay || scene.time) m.push('time');
      if (scene.mapLocation) m.push('map');
      if (scene.returnsToHub || scene.hubScene) m.push('hub');
      if (scene.sceneTemplate) m.push('template');
      return m;
    },

    ensureSceneEditorModules(scene) {
      if (!scene) return [];
      if (!Array.isArray(scene.editorModules)) {
        scene.editorModules = this.inferSceneModules(scene);
      }
      return scene.editorModules;
    },

    addSceneModule(moduleId) {
      try {
      if (!this.data) {
        Editor.toast.warning('Нет данных проекта');
        return;
      }
      const scene = this.data.scenes?.[this.currentScene];
      if (!scene) {
        Editor.toast.warning('Сцена не выбрана');
        return;
      }
      if (!moduleId) return;
      // Явный список модулей: не подмешивать infer, если уже []
      if (!Array.isArray(scene.editorModules)) {
        scene.editorModules = [];
      }
      const mods = scene.editorModules;
      if (mods.includes(moduleId)) {
        this._sceneModulePickerOpen = false;
        this.renderSceneEditor();
        return;
      }
      mods.push(moduleId);
      scene.editorModules = mods;

      // Инициализация пустых структур
      if (moduleId === 'story' && scene.text == null) scene.text = '';
      if (moduleId === 'dialogue' && !Array.isArray(scene.dialogue)) scene.dialogue = [];
      if (moduleId === 'choices' && !Array.isArray(scene.choices)) scene.choices = [];
      if (moduleId === 'combat' && !Array.isArray(scene.combat)) scene.combat = [];
      if (moduleId === 'components' && !Array.isArray(scene.components)) scene.components = [];
      if (moduleId === 'elements' && !Array.isArray(scene.elements)) scene.elements = [];
      if (moduleId === 'items' && !Array.isArray(scene.items)) scene.items = [];
      if (moduleId === 'flags' && (!scene.flags || typeof scene.flags !== 'object')) scene.flags = {};
      if (moduleId === 'shop') this._initShopModule(scene);
      if (moduleId === 'blacksmith') this._initBlacksmithModule(scene);
      if (moduleId === 'church') this._initChurchModule(scene);
      if (moduleId === 'template' && typeof this.openCreateSceneModal === 'function') {
        // шаблон — отдельный поток; не открываем модалку автоматически
      }

      this._sceneModulePickerOpen = false;
      try { this.renderSceneEditor(); } catch (e) { console.error(e); }
      try { this.updateJSONPreview(); } catch (e) { /* */ }
      } catch (err) {
        console.error('addSceneModule', err);
        Editor.toast.error('Не удалось добавить блок: ' + (err.message || err));
      }
    },

    removeSceneModule(moduleId) {
      const scene = this.data?.scenes?.[this.currentScene];
      if (!scene) return;
      const mods = this.ensureSceneEditorModules(scene);
      scene.editorModules = mods.filter((id) => id !== moduleId);
      // Данные не удаляем — только скрываем блок; можно очистить по желанию
      this.renderSceneEditor();
      this.updateJSONPreview();
    },

    toggleSceneModulePicker() {
      this._sceneModulePickerOpen = !this._sceneModulePickerOpen;
      try {
        this.renderSceneEditor();
      } catch (e) {
        console.error('toggleSceneModulePicker render', e);
        Editor.toast.error('Ошибка отрисовки сцены: ' + (e.message || e));
      }
      // если пикер должен быть открыт — прокрутить к нему
      if (this._sceneModulePickerOpen) {
        setTimeout(() => {
          const p = document.querySelector('.scene-module-picker');
          if (p) p.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }, 50);
      }
    },

    openSceneModulePicker() {
      this._sceneModulePickerOpen = true;
      try { this.renderSceneEditor(); } catch (e) { console.error(e); }
    },


    _ensureComponents(scene) {
      if (!Array.isArray(scene.components)) scene.components = [];
      return scene.components;
    },

    _upsertComponent(scene, type, params) {
      const comps = this._ensureComponents(scene);
      let c = comps.find((x) => x.component === type || x.type === type);
      if (!c) {
        c = { component: type, params: {} };
        comps.push(c);
      }
      c.params = Object.assign({}, c.params || {}, params || {});
      return c;
    },

    _initShopModule(scene) {
      if (!scene.shopConfig) {
        scene.shopConfig = {
          title: 'Магазин',
          description: 'Добро пожаловать! Смотрите товар.',
          merchantNpcId: scene.npcId || '',
          inventoryId: '',
          sellMultiplier: 1,
          buyMultiplier: 0.5
        };
      }
      if (!scene.special) scene.special = 'shop';
      this._upsertComponent(scene, 'trade_interface', {
        title: scene.shopConfig.title,
        merchant: scene.shopConfig.merchantNpcId,
        inventory: scene.shopConfig.inventoryId,
        sellMultiplier: scene.shopConfig.sellMultiplier,
        buyMultiplier: scene.shopConfig.buyMultiplier
      });
    },

    _initBlacksmithModule(scene) {
      if (!scene.blacksmithConfig) {
        scene.blacksmithConfig = {
          title: 'Кузница',
          description: 'Звон молота. Чем помочь?',
          npcId: scene.npcId || '',
          enableBuy: true,
          enableUpgrade: true,
          enableRepair: true
        };
      }
      if (!scene.special) scene.special = 'blacksmith';
      this._upsertComponent(scene, 'service_menu', {
        title: scene.blacksmithConfig.title,
        services: [
          { id: 'buy', label: 'Купить снаряжение', enabled: !!scene.blacksmithConfig.enableBuy },
          { id: 'upgrade', label: 'Улучшить', enabled: !!scene.blacksmithConfig.enableUpgrade },
          { id: 'repair', label: 'Ремонт', enabled: !!scene.blacksmithConfig.enableRepair }
        ]
      });
      if (scene.blacksmithConfig.enableBuy) {
        this._upsertComponent(scene, 'trade_interface', { title: 'Товары кузницы', merchant: scene.blacksmithConfig.npcId });
      }
      if (scene.blacksmithConfig.enableUpgrade) {
        this._upsertComponent(scene, 'interactive_panel', { label: 'Улучшение', panel: 'upgrade_panel' });
      }
      if (scene.blacksmithConfig.enableRepair) {
        this._upsertComponent(scene, 'interactive_panel', { label: 'Ремонт', panel: 'repair_panel' });
      }
    },

    _initChurchModule(scene) {
      if (!scene.churchConfig) {
        scene.churchConfig = {
          title: 'Храм',
          description: 'Тишина и свет свечей.',
          npcId: scene.npcId || '',
          enableHeal: true,
          healCost: 50,
          enableBless: true,
          blessCost: 100,
          enableDonate: true,
          donateCost: 10
        };
      }
      if (!scene.special) scene.special = 'temple';
      this._upsertComponent(scene, 'service_menu', {
        title: scene.churchConfig.title,
        services: [
          { id: 'heal', label: 'Исцеление', cost: scene.churchConfig.healCost, enabled: !!scene.churchConfig.enableHeal },
          { id: 'bless', label: 'Благословение', cost: scene.churchConfig.blessCost, enabled: !!scene.churchConfig.enableBless },
          { id: 'donate', label: 'Пожертвование', cost: scene.churchConfig.donateCost, enabled: !!scene.churchConfig.enableDonate }
        ]
      });
    },

    _npcSelectHtml(selected, onchangeAttr) {
      const npcs = this.data?.npcs || {};
      const opts = Object.keys(npcs).map((nid) => {
        const sel = nid === selected ? ' selected' : '';
        const name = npcs[nid]?.name || nid;
        return `<option value="${this.escapeAttr(nid)}"${sel}>${this.escapeHtml(name)}</option>`;
      }).join('');
      return `<select onchange="${onchangeAttr}"><option value="">— без NPC —</option>${opts}</select>`;
    },

    _inventorySelectHtml(selected, onchangeAttr) {
      const invs = this.data?.shopInventories || {};
      let opts = '<option value="">— по умолчанию —</option>';
      Object.keys(invs).forEach((iid) => {
        const sel = iid === selected ? ' selected' : '';
        const name = invs[iid]?.name || iid;
        opts += `<option value="${this.escapeAttr(iid)}"${sel}>${this.escapeHtml(name)}</option>`;
      });
      return `<select onchange="${onchangeAttr}">${opts}</select>`;
    },

    renderShopModule(scene) {
      const cfg = scene.shopConfig || {};
      return `<p class="hint">Торговля предметами с игроком (существующий trade_interface).</p>
        <div class="form-group"><label>Название магазина</label>
          <input value="${this.escapeHtml(cfg.title || '')}" onchange="Editor.updateShopConfig('title', this.value)"></div>
        <div class="form-group"><label>Описание / приветствие</label>
          <textarea rows="2" onchange="Editor.updateShopConfig('description', this.value)">${this.escapeHtml(cfg.description || '')}</textarea></div>
        <div class="form-group"><label>Продавец (NPC)</label>
          ${this._npcSelectHtml(cfg.merchantNpcId || '', "Editor.updateShopConfig('merchantNpcId', this.value)")}</div>
        <div class="form-group"><label>Список товаров (inventory)</label>
          ${this._inventorySelectHtml(cfg.inventoryId || '', "Editor.updateShopConfig('inventoryId', this.value)")}</div>
        <div class="grid-2">
          <div class="form-group"><label>Множитель продажи</label>
            <input type="number" step="0.1" min="0" value="${cfg.sellMultiplier ?? 1}" onchange="Editor.updateShopConfig('sellMultiplier', parseFloat(this.value)||1)"></div>
          <div class="form-group"><label>Множитель скупки</label>
            <input type="number" step="0.1" min="0" value="${cfg.buyMultiplier ?? 0.5}" onchange="Editor.updateShopConfig('buyMultiplier', parseFloat(this.value)||0.5)"></div>
        </div>`;
    },

    renderBlacksmithModule(scene) {
      const cfg = scene.blacksmithConfig || {};
      return `<p class="hint">Кузница: service_menu + торговля + панели улучшения/ремонта.</p>
        <div class="form-group"><label>Название</label>
          <input value="${this.escapeHtml(cfg.title || '')}" onchange="Editor.updateBlacksmithConfig('title', this.value)"></div>
        <div class="form-group"><label>Кузнец (NPC)</label>
          ${this._npcSelectHtml(cfg.npcId || '', "Editor.updateBlacksmithConfig('npcId', this.value)")}</div>
        <div class="form-group"><label>Приветствие</label>
          <textarea rows="2" onchange="Editor.updateBlacksmithConfig('description', this.value)">${this.escapeHtml(cfg.description || '')}</textarea></div>
        <label><input type="checkbox" ${cfg.enableBuy ? 'checked' : ''} onchange="Editor.updateBlacksmithConfig('enableBuy', this.checked)"> Покупка</label>
        <label><input type="checkbox" ${cfg.enableUpgrade ? 'checked' : ''} onchange="Editor.updateBlacksmithConfig('enableUpgrade', this.checked)"> Улучшение</label>
        <label><input type="checkbox" ${cfg.enableRepair ? 'checked' : ''} onchange="Editor.updateBlacksmithConfig('enableRepair', this.checked)"> Ремонт</label>`;
    },

    renderChurchModule(scene) {
      const cfg = scene.churchConfig || {};
      return `<p class="hint">Сервисное меню храма (конфиг service_menu).</p>
        <div class="form-group"><label>Название</label>
          <input value="${this.escapeHtml(cfg.title || '')}" onchange="Editor.updateChurchConfig('title', this.value)"></div>
        <div class="form-group"><label>Служитель (NPC)</label>
          ${this._npcSelectHtml(cfg.npcId || '', "Editor.updateChurchConfig('npcId', this.value)")}</div>
        <div class="form-group"><label>Текст</label>
          <textarea rows="2" onchange="Editor.updateChurchConfig('description', this.value)">${this.escapeHtml(cfg.description || '')}</textarea></div>
        <div class="grid-2">
          <label><input type="checkbox" ${cfg.enableHeal ? 'checked' : ''} onchange="Editor.updateChurchConfig('enableHeal', this.checked)"> Исцеление</label>
          <input type="number" min="0" value="${cfg.healCost ?? 50}" onchange="Editor.updateChurchConfig('healCost', parseInt(this.value,10)||0)">
        </div>
        <div class="grid-2">
          <label><input type="checkbox" ${cfg.enableBless ? 'checked' : ''} onchange="Editor.updateChurchConfig('enableBless', this.checked)"> Благословение</label>
          <input type="number" min="0" value="${cfg.blessCost ?? 100}" onchange="Editor.updateChurchConfig('blessCost', parseInt(this.value,10)||0)">
        </div>
        <div class="grid-2">
          <label><input type="checkbox" ${cfg.enableDonate ? 'checked' : ''} onchange="Editor.updateChurchConfig('enableDonate', this.checked)"> Пожертвование</label>
          <input type="number" min="0" value="${cfg.donateCost ?? 10}" onchange="Editor.updateChurchConfig('donateCost', parseInt(this.value,10)||0)">
        </div>`;
    },

    updateShopConfig(key, value) {
      const scene = this.data?.scenes?.[this.currentScene];
      if (!scene) return;
      if (!scene.shopConfig) scene.shopConfig = {};
      scene.shopConfig[key] = value;
      this._initShopModule(scene);
      this.updateJSONPreview?.();
    },

    updateBlacksmithConfig(key, value) {
      const scene = this.data?.scenes?.[this.currentScene];
      if (!scene) return;
      if (!scene.blacksmithConfig) scene.blacksmithConfig = {};
      scene.blacksmithConfig[key] = value;
      this._initBlacksmithModule(scene);
      this.updateJSONPreview?.();
    },

    updateChurchConfig(key, value) {
      const scene = this.data?.scenes?.[this.currentScene];
      if (!scene) return;
      if (!scene.churchConfig) scene.churchConfig = {};
      scene.churchConfig[key] = value;
      this._initChurchModule(scene);
      this.updateJSONPreview?.();
    },

    /**
     * Создать пустую сцену: только ID и название.
     */
    async promptChangeSceneId() {
      const n = await Editor.promptDialog({ message: 'Изменить ID (латиница):', defaultValue: this.currentScene || '' });
      if (n) this.updateSceneId(n);
    },

    async createBlankScene() {
      if (!this.data) {
        Editor.toast.warning('Сначала загрузите или создайте проект');
        return;
      }
      if (!this.data.scenes) this.data.scenes = {};
      let id, title;
      if (typeof this.promptNameAndId === 'function') {
        const r = await this.promptNameAndId({
          namePrompt: 'Название сцены (для игрока):',
          defaultName: 'Новая сцена',
          existing: this.data.scenes,
          allowEditId: false
        });
        if (!r) return;
        id = r.id;
        title = r.name;
      } else {
        title = await Editor.promptDialog({ message: 'Название сцены:', defaultValue: 'Новая сцена' });
        if (!title) return;
        if (typeof this.slugifySceneId === 'function') {
          id = this.slugifySceneId(title, this.data.scenes);
        } else if (typeof this.slugifyId === 'function') {
          id = this.slugifyId(String(title).trim(), '', this.data.scenes);
        } else {
          id = String(title).toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'new_scene';
          if (this.data.scenes[id]) id = id + '_' + Date.now().toString(36).slice(-3);
        }
      }
      this.data.scenes[id] = {
        id,
        location: title,
        text: '',
        sceneType: 'custom',
        editorModules: ['story', 'choices']
      };
      if (!this.data.startScene && !this.data.meta?.startScene) {
        this.data.startScene = id;
      }
      this.currentScene = id;
      this._sceneModulePickerOpen = false;
      const startScreen = document.getElementById('start-screen');
      if (startScreen) startScreen.style.display = 'none';
      this.renderSceneList();
      this.renderSceneEditor();
      this.updateJSONPreview();
      if (typeof this.switchTab === 'function') this.switchTab('scenes');
      if (typeof this.openSceneDocument === 'function') this.openSceneDocument(id);
    },

    /** Рендер одного модуля */
    renderSceneModuleBlock(moduleId, scene, allScenes, allEnemies) {
      const meta = moduleMeta(moduleId);
      const head = `<div class="scene-module-head">
        <strong>${meta.icon} ${this.escapeHtml(meta.label)}</strong>
        <button type="button" class="btn-remove" title="Убрать блок" onclick="Editor.removeSceneModule(${JSON.stringify(moduleId)})">×</button>
      </div>`;

      let body = '';
      switch (moduleId) {
        case 'story':
          body = `
            <div class="form-group"><label>Локация (название)</label>
              <input type="text" id="scene-location" value="${this.escapeHtml(scene.location || '')}"
                oninput="Editor.scheduleLivePreviewUpdate?.()" onchange="Editor.updateSceneField('location',this.value)"></div>
            <div class="form-group"><label>Текст</label>
              ${typeof this.renderSmartTextarea === 'function'
                ? this.renderSmartTextarea(
                    'scene-text',
                    scene.text || '',
                    6,
                    "Editor.updateSceneField('text',this.value)",
                    this.getSmartTextVariables?.() || [],
                    { onInput: 'Editor.scheduleLivePreviewUpdate?.()' }
                  )
                : `<textarea id="scene-text" onchange="Editor.updateSceneField('text',this.value)">${this.escapeTextarea(scene.text || '')}</textarea>`}
              <p class="hint">Подстановки: <code>{charName}</code>, сниппеты <code>@id</code></p>
            </div>`;
          break;

        case 'npc':
          body = `<div class="form-group"><label>NPC сцены</label>
            ${typeof this.renderEntityPicker === 'function'
              ? this.renderEntityPicker({ kind: 'npc', value: scene.npcId || '', onChange: 'Editor.setSceneNpcId(this.value)' })
              : `<select onchange="Editor.setSceneNpcId(this.value)"><option value="">— нет —</option>${
                  Object.keys(this.data.npcs || {}).map((nid) =>
                    `<option value="${this.escapeAttr(nid)}" ${scene.npcId === nid ? 'selected' : ''}>${this.escapeHtml(this.data.npcs[nid]?.name || nid)}</option>`
                  ).join('')
                }</select>`}
            <p class="hint">Эффекты репутации «при разговоре» при первом входе.</p>
          </div>`;
          break;

        case 'dialogue':
          body = `<div class="dialogue-section">
            <button type="button" class="btn btn-secondary" style="font-size:12px;" onclick="Editor.addDialogue()">+ Реплика</button>
            <div id="dialogue-list">${typeof this.renderDialogueList === 'function' ? this.renderDialogueList(scene) : ''}</div>
          </div>`;
          break;

        case 'choices':
          body = `${typeof this.renderChoicePreviewPanel === 'function' ? this.renderChoicePreviewPanel() : ''}
            <div class="choices-section">
              <button type="button" class="btn btn-secondary" style="font-size:12px;" onclick="Editor.addChoice()">+ Выбор</button>
              <div id="choices-list">${(scene.choices || []).map((c, i) =>
                (typeof this.renderChoiceEditor === 'function' ? this.renderChoiceEditor(c, i, allScenes) : '')
              ).join('')}</div>
            </div>`;
          break;

        case 'quest':
          body = this.renderSceneQuestModule(scene, allScenes);
          break;

        case 'combat':
          body = this.renderSceneCombatModule(scene, allEnemies, allScenes);
          break;

        case 'components':
          body = typeof this.renderSceneComponentsSection === 'function'
            ? this.renderSceneComponentsSection(scene)
            : '<p class="hint">Модуль компонентов не загружен</p>';
          break;

        case 'elements':
          body = typeof this.renderSceneElementsSection === 'function'
            ? this.renderSceneElementsSection(scene)
            : '<p class="hint">Модуль элементов не загружен</p>';
          if (typeof this.renderSceneAdvancedSection === 'function') {
            body += this.renderSceneAdvancedSection(scene);
          }
          break;

        case 'items':
          body = this.renderSceneItemsModule(scene);
          break;

        case 'flags':
          body = this.renderSceneFlagsModule(scene);
          break;

        case 'audio':
          body = typeof this.renderSceneAudioSection === 'function'
            ? this.renderSceneAudioSection(scene)
            : '<p class="hint">Модуль звука не загружен</p>';
          break;

        case 'climate':
          body = typeof this.renderSceneClimateSection === 'function'
            ? this.renderSceneClimateSection(scene)
            : '<p class="hint">Модуль климата не загружен</p>';
          break;

        case 'time':
          body = this.renderSceneTimeModule(scene);
          break;

        case 'map':
          body = typeof this.renderMapLocationField === 'function'
            ? this.renderMapLocationField(scene)
            : '<p class="hint">Модуль карты не загружен</p>';
          break;

        case 'hub':
          body = this.renderSceneHubModule(scene, allScenes);
          break;


        case 'shop':
          body = this.renderShopModule(scene);
          break;

        case 'blacksmith':
          body = this.renderBlacksmithModule(scene);
          break;

        case 'church':
          body = this.renderChurchModule(scene);
          break;

        case 'template':
          body = `<p class="hint">Создать содержимое сцены из готового шаблона (торговля, бой, диалог…).</p>
            <button type="button" class="btn btn-primary" data-action="open-scene-templates">📋 Открыть шаблоны</button>
            ${scene.sceneTemplate ? `<p class="hint">Текущий шаблон: <code>${this.escapeHtml(scene.sceneTemplate)}</code></p>` : ''}`;
          break;

        case 'scene_choice': {
          const choices = scene.choices || [];
          const rows = choices.map((c, idx) => {
            const picker = typeof this.renderEntityPicker === 'function'
              ? this.renderEntityPicker({ kind: 'scene', value: c.to || '', onChange: 'Editor.updateChoice(' + idx + ',\'to\',this.value)' })
              : `<input value="${this.escapeAttr(c.to || '')}" onchange="Editor.updateChoice(${idx},'to',this.value)">`;
            return `<div class="project-info" style="margin-bottom:8px;padding:8px;">
              <div class="form-group"><label>Текст кнопки</label>
                <input value="${this.escapeHtml(c.text || '')}" onchange="Editor.updateChoice(${idx},'text',this.value)"></div>
              <div class="form-group"><label>Куда перейти</label>${picker}</div>
            </div>`;
          }).join('') || '<p class="hint">Пока нет вариантов.</p>';
          body = `<p class="hint">Куда пойти? Каждый вариант — переход в сцену.</p>
            ${rows}
            <button type="button" class="btn btn-secondary" onclick="Editor.addSceneChoiceDestination()">+ Добавить вариант</button>`;
          break;
        }

        case 'location_place': {
          const locType = scene.locationPlaceType || 'shop';
          const types = [
            ['shop','Магазин'],['forge','Кузница'],['church','Церковь'],['tavern','Таверна'],
            ['bank','Банк'],['guild','Гильдия'],['home','Дом'],['castle','Замок'],
            ['camp','Лагерь'],['quest','Квестовая точка']
          ];
          const opts = types.map(([id, lab]) =>
            `<option value="${id}" ${locType === id ? 'selected' : ''}>${lab}</option>`).join('');
          body = `<div class="form-group"><label>Тип места</label>
            <select onchange="Editor.setSceneLocationPlaceType(this.value)">${opts}</select></div>
            <p class="hint">Применит готовый шаблон содержимого (NPC, услуги, переходы).</p>
            <button type="button" class="btn btn-primary" onclick="Editor.applyLocationPlaceTemplate()">Применить тип локации</button>`;
          break;
        }

        default:
          body = `<p class="hint">Неизвестный модуль: ${this.escapeHtml(moduleId)}</p>`;
      }

      return `<div class="scene-module-card${moduleId === 'flags' ? ' writer-surface--technical' : ''}" data-module="${this.escapeAttr(moduleId)}">
        ${head}
        <div class="scene-module-body">${body}</div>
      </div>`;
    },

    renderSceneQuestModule(scene) {
      const questIds = Object.keys(this.data?.quests || {});
      const choices = scene.choices || [];
      const rows = choices.map((c, i) => {
        const qs = c.questSet || {};
        const qopts = questIds.map((qid) => {
          const t = this.data.quests[qid]?.title || qid;
          const sel = qs.questId === qid ? ' selected' : '';
          return `<option value="${this.escapeAttr(qid)}"${sel}>${this.escapeHtml(t)}</option>`;
        }).join('');
        let stages;
        if (typeof this._wizardQuestStageOptions === 'function' && qs.questId) {
          stages = `<select onchange="Editor.setChoiceQuestSet(${i},'stage',this.value)">${this._wizardQuestStageOptions(qs.questId, qs.stage)}</select>`;
        } else if (typeof this.renderQuestStageSelect === 'function' && qs.questId) {
          stages = this.renderQuestStageSelect(qs.questId, qs.stage, `Editor.setChoiceQuestSet(${i},'stage',this.value)`);
        } else {
          stages = `<input value="${this.escapeHtml(qs.stage != null ? String(qs.stage) : '')}" placeholder="этап"
              onchange="Editor.setChoiceQuestSet(${i},'stage',this.value)">`;
        }
        return `<div class="form-group" style="border:1px solid var(--border);padding:8px;border-radius:6px;margin:6px 0;">
          <div class="hint">Выбор ${i + 1}: ${this.escapeHtml((c.text || '').slice(0, 40))}</div>
          <label>Квест</label>
          <select onchange="Editor.setChoiceQuestSet(${i},'questId',this.value)">
            <option value="">— нет —</option>${qopts}
          </select>
          <label>Этап</label>${stages}
        </div>`;
      }).join('');
      return `<p class="hint">Привяжите квест к выбору: при нажатии этап обновится автоматически.</p>
        ${rows || '<p class="hint">Сначала добавьте модуль «Выборы».</p>'}
        <button type="button" class="btn btn-secondary" onclick="Editor.addSceneModule('choices')">+ Добавить выборы</button>`;
    },

    setChoiceQuestSet(choiceIndex, field, value) {
      const s = this.data?.scenes?.[this.currentScene];
      if (!s?.choices?.[choiceIndex]) return;
      const c = s.choices[choiceIndex];
      if (!value) {
        if (field === 'questId') delete c.questSet;
        else if (c.questSet) delete c.questSet[field];
      } else {
        if (!c.questSet) c.questSet = {};
        c.questSet[field] = value;
        if (field === 'questId' && c.questSet.stage == null) c.questSet.stage = '0';
      }
      this.renderSceneEditor();
      this.updateJSONPreview();
    },

    renderSceneCombatModule(scene, allEnemies, allScenes) {
      const combat = scene.combat || [];
      const list = combat.map((eid, i) =>
        `<span class="tag">${this.escapeHtml(eid)} <button type="button" class="btn-remove" onclick="Editor.removeEnemyFromCombat(${i})">×</button></span>`
      ).join(' ');
      const opts = (allEnemies || []).map((e) =>
        `<option value="${this.escapeAttr(e)}">${this.escapeHtml(this.data.enemies?.[e]?.name || e)}</option>`
      ).join('');
      const nextOpts = (allScenes || []).map((sid) =>
        `<option value="${this.escapeAttr(sid)}" ${scene.nextScene === sid ? 'selected' : ''}>${this.escapeHtml(sid)}</option>`
      ).join('');
      return `<div class="form-group"><label>Враги</label>
          <div>${list || '<span class="hint">нет</span>'}</div>
          <select onchange="if(this.value){Editor.addEnemyToCombat(this.value);this.value='';}">
            <option value="">+ враг</option>${opts}
          </select>
        </div>
        <div class="form-group"><label>Сцена после боя</label>
          <select onchange="Editor.updateSceneField('nextScene',this.value)">
            <option value="">—</option>${nextOpts}
          </select>
        </div>`;
    },

    renderSceneItemsModule(scene) {
      const items = scene.items || [];
      const rows = items.map((id, i) =>
        `<div style="display:flex;gap:6px;margin:4px 0;">
          <input value="${this.escapeHtml(id)}" onchange="Editor.updateSceneItem(${i},this.value)" style="flex:1">
          <button type="button" class="btn-remove" onclick="Editor.removeSceneItem(${i})">×</button>
        </div>`
      ).join('');
      return `<p class="hint">Предметы, выдаваемые при входе в сцену.</p>
        ${rows}
        <button type="button" class="btn btn-secondary" onclick="Editor.addSceneItem()">+ Предмет</button>`;
    },

    addSceneItem() {
      const s = this.data.scenes[this.currentScene];
      if (!s) return;
      if (!Array.isArray(s.items)) s.items = [];
      s.items.push('');
      this.ensureSceneEditorModules(s);
      if (!s.editorModules.includes('items')) s.editorModules.push('items');
      this.renderSceneEditor();
    },
    updateSceneItem(i, v) {
      const s = this.data.scenes[this.currentScene];
      if (s?.items) s.items[i] = v;
      this.updateJSONPreview();
    },
    removeSceneItem(i) {
      const s = this.data.scenes[this.currentScene];
      if (s?.items) s.items.splice(i, 1);
      this.renderSceneEditor();
      this.updateJSONPreview();
    },

    renderSceneFlagsModule(scene) {
      const flags = scene.flags || {};
      const isWriter = typeof this.isWriterMode === 'function' && this.isWriterMode();
      const entries = Object.entries(flags).filter(([k]) => {
        if (!isWriter || typeof StoryMemory === 'undefined') return true;
        return !StoryMemory.isServiceFlag(k);
      });
      const rows = entries.map(([k, v], i) =>
        `<div style="display:flex;gap:6px;margin:4px 0;">
          <input value="${this.escapeHtml(k)}" onchange="Editor.updateFlagKey(${i},this.value)" placeholder="флаг" style="flex:1">
          <input value="${this.escapeHtml(String(v))}" onchange="Editor.updateFlagValue(${i},this.value)" placeholder="значение" style="flex:1">
          <button type="button" class="btn-remove" onclick="Editor.removeFlag(${i})">×</button>
        </div>`
      ).join('');
      return `<p class="hint">Флаги, выставляемые при входе в сцену.</p>
        ${rows}
        <button type="button" class="btn btn-secondary" onclick="Editor.addFlag()">+ Флаг</button>`;
    },

    renderSceneTimeModule(scene) {
      const adv = scene.timeAdvance != null ? scene.timeAdvance : '';
      const tod = scene.timeOfDay || '';
      return `<div class="form-group"><label>Сдвиг времени (часы)</label>
          <input type="number" min="0" value="${this.escapeHtml(String(adv))}"
            onchange="Editor.updateSceneField('timeAdvance', this.value === '' ? undefined : parseInt(this.value,10)||0)">
        </div>
        <div class="form-group"><label>Время суток (необязательно)</label>
          <select onchange="Editor.updateSceneField('timeOfDay', this.value || undefined)">
            <option value="">— не задано —</option>
            ${['dawn','morning','noon','afternoon','evening','night'].map((t) =>
              `<option value="${t}" ${tod === t ? 'selected' : ''}>${t}</option>`
            ).join('')}
          </select>
        </div>`;
    },

    renderSceneHubModule(scene, allScenes) {
      const opts = (allScenes || []).map((sid) =>
        `<option value="${this.escapeAttr(sid)}" ${scene.hubScene === sid ? 'selected' : ''}>${this.escapeHtml(sid)}</option>`
      ).join('');
      return `<div class="form-group hub-return-panel">
          <label><input type="checkbox" ${scene.returnsToHub ? 'checked' : ''}
            onchange="Editor.updateSceneField('returnsToHub', this.checked)"> Возврат в хаб</label>
        </div>
        <div class="form-group"><label>Сцена-хаб</label>
          <select onchange="Editor.updateSceneField('hubScene', this.value)">
            <option value="">—</option>${opts}
          </select>
        </div>`;
    },

    renderSceneModulePicker(activeModules) {
      const active = new Set(activeModules || []);
      const writer = typeof this.isWriterMode === 'function' && this.isWriterMode();
      const showAdvanced = !!this._sceneModulePickerShowAdvanced && !writer;

      // Presentation only — IDs unchanged
      const GROUPS = [
        {
          id: 'basic',
          title: 'Основное',
          ids: ['story', 'dialogue', 'choices', 'npc', 'items']
        },
        {
          id: 'actions',
          title: 'Игровые действия',
          ids: ['combat', 'quest', 'flags']
        },
        {
          id: 'world',
          title: 'Мир',
          ids: ['scene_choice', 'location_place', 'map', 'hub', 'shop', 'blacksmith', 'church']
        },
        {
          id: 'atmosphere',
          title: 'Атмосфера',
          ids: ['audio', 'climate', 'time']
        },
        {
          id: 'advanced',
          title: 'Продвинутое',
          ids: ['components', 'elements', 'template'],
          advanced: true
        }
      ];

      const byId = Object.create(null);
      SCENE_MODULES.forEach((m) => { byId[m.id] = m; });
      const placed = new Set();
      GROUPS.forEach((g) => g.ids.forEach((id) => placed.add(id)));
      // Any module not listed → advanced (keep all IDs available)
      SCENE_MODULES.forEach((m) => {
        if (!placed.has(m.id)) {
          GROUPS.find((g) => g.id === 'advanced').ids.push(m.id);
          placed.add(m.id);
        }
      });

      const renderCard = (m) => {
        if (!m) return '';
        const on = active.has(m.id);
        return `<button type="button" class="scene-module-pick${on ? ' is-active' : ''}"
          ${on ? 'disabled' : ''}
          data-module-id="${this.escapeAttr(m.id)}"
          onclick="Editor.addSceneModule(${JSON.stringify(m.id)})"
          title="${this.escapeAttr(m.hint || '')}">
          <span class="scene-module-pick-icon">${m.icon}</span>
          <span class="scene-module-pick-label">${this.escapeHtml(m.label)}</span>
          ${m.hint ? `<span class="scene-module-pick-hint">${this.escapeHtml(m.hint)}</span>` : ''}
        </button>`;
      };

      let body = '';
      GROUPS.forEach((g) => {
        if (g.advanced && !showAdvanced) return;
        const ids = writer ? g.ids.filter((id) => id !== 'flags') : g.ids;
        const cards = ids.map((id) => renderCard(byId[id])).filter(Boolean).join('');
        if (!cards) return;
        body += `<div class="scene-module-picker-group" data-group="${this.escapeAttr(g.id)}">
          <div class="scene-module-picker-group-title">${this.escapeHtml(g.title)}</div>
          <div class="scene-module-picker-grid">${cards}</div>
        </div>`;
      });

      const moreBtn = writer
        ? ''
        : `<button type="button" class="btn btn-secondary scene-module-picker-more"
            onclick="Editor.toggleSceneModulePickerAdvanced()">
            ${showAdvanced ? '− Свернуть' : '+ Ещё'}
          </button>`;

      return `<div class="scene-module-picker" id="scene-element-picker" data-editor-ui="scene-element-picker">
        <div class="scene-module-picker-title">Что добавить на сцену?</div>
        ${body}
        <div class="scene-module-picker-actions">
          ${moreBtn}
          <button type="button" class="btn btn-secondary" onclick="Editor.toggleSceneModulePicker()">Закрыть</button>
        </div>
      </div>`;
    },

    toggleSceneModulePickerAdvanced() {
      this._sceneModulePickerShowAdvanced = !this._sceneModulePickerShowAdvanced;
      this._sceneModulePickerOpen = true;
      try { this.renderSceneEditor(); } catch (e) { console.error(e); }
    }
  });

  // Полная замена UI редактора сцены (последний в цепочке скриптов)
  function getSceneEditorMount() {
    const container = document.getElementById('scene-editor');
    if (!container) return null;
    const uswMount = document.getElementById('usw-canvas-mount');
    if (uswMount && typeof Editor.isUnifiedSceneWorkspaceActive === 'function' && Editor.isUnifiedSceneWorkspaceActive()) {
      return uswMount;
    }
    // если уже split-view (превью) — пишем в левую панель, не снося layout
    return container.querySelector('.scenes-editor-pane') || container;
  }

  function renderSceneEditorModular() {
    const root = document.getElementById('scene-editor');
    const container = getSceneEditorMount();
    if (!container) return;
    if (!this.currentScene || !this.data?.scenes?.[this.currentScene]) {
      if (typeof this.renderSceneEmptyState === 'function') {
        this.renderSceneEmptyState(container);
      } else {
        container.innerHTML = '<div class="empty-state"><h2>Сцена не открыта</h2><p class="hint">Откройте сцену из списка слева или создайте новую.</p></div>';
      }
      return;
    }
    const startScreen = document.getElementById('start-screen');
    if (startScreen) startScreen.style.display = 'none';

    const scene = this.data.scenes[this.currentScene];
    const allScenes = Object.keys(this.data.scenes);
    const allEnemies = this.data.enemies ? Object.keys(this.data.enemies) : [];
    const modules = this.getSceneModules(scene);
    const title = scene.location || scene.title || this.currentScene;

    const modulesHtml = modules.map((mid) =>
      this.renderSceneModuleBlock(mid, scene, allScenes, allEnemies)
    ).join('');

    const picker = this._sceneModulePickerOpen
      ? this.renderSceneModulePicker(modules)
      : '';

    const showIdHint = typeof this.isEditorAdvancedMode === 'function' && this.isEditorAdvancedMode();
    const idHintBlock = showIdHint
      ? `<p class="hint"><span class="hint" title="Технический ID">ID: <code>${this.escapeHtml(this.currentScene)}</code></span>
              <button type="button" class="btn btn-secondary" style="font-size:11px;margin-left:6px;" onclick="Editor.promptChangeSceneId()">Изменить ID</button></p>`
      : '<p class="hint">Соберите сцену блоками ниже.</p>';

    container.innerHTML = `
      <div class="scene-builder">
        <div class="scene-builder-core project-info">
          ${typeof this.renderSceneTypeSelect === 'function'
            ? `<div class="writer-advanced-only">${this.renderSceneTypeSelect(scene)}</div>`
            : ''}
          <div class="form-group"><label>Название</label>
            <input type="text" id="scene-title" value="${this.escapeHtml(scene.location || '')}"
              onchange="Editor.updateSceneField('location', this.value); Editor.renderSceneList(); Editor.injectSceneWorkspaceChrome?.();">
            ${idHintBlock}
          </div>
        </div>
        <div class="scene-modules-list">${modulesHtml ||
          '<div class="scene-modules-empty hint">Сцена пока пустая. Нажмите «+ Добавить», чтобы выбрать NPC, диалог, квест, погоду…</div>'}</div>
        <div class="scene-builder-add">
          <button type="button" class="btn btn-primary scene-add-module-btn" onclick="Editor.toggleSceneModulePicker()">
            ${this._sceneModulePickerOpen ? '− Закрыть' : '+ Добавить'}
          </button>
        </div>
        ${picker}
      </div>`;

    setTimeout(() => {
      if (Editor.updateChoicePreview) Editor.updateChoicePreview();
      if (typeof this.wrapSceneEditorSplitView === 'function') this.wrapSceneEditorSplitView();
      if (typeof this.renderLivePreview === 'function') this.renderLivePreview();
      if (typeof this.bindChoiceDragDrop === 'function') {
        this._choiceDragBound = false;
        this.bindChoiceDragDrop();
      }
    }, 0);
  };

  if (Editor.hooks && typeof Editor.hooks.replace === 'function') {
    Editor.hooks.replace('renderSceneEditor', function () {
      return renderSceneEditorModular.call(this);
    }, 'editor-scene-builder');
  } else if (typeof console !== 'undefined' && console.warn) {
    console.warn('[editor-scene-builder] Editor.hooks missing — modular scene editor not installed');
  }

    // «Новая сцена» → пустая (ID + название), шаблоны — отдельный модуль
  Editor.createScene = function createSceneBlank() {
    this.createBlankScene();
  };


  // ——— Scene template modal ———
  Editor._sceneTemplatePickerMode = 'create';

  function sceneTemplateSceneLabel(sceneId) {
    const s = Editor.data?.scenes?.[sceneId];
    return s?.location || s?.title || sceneId || '—';
  }

  function makeSceneIdFromTemplateBase(templateId, label) {
    const scenes = Editor.data?.scenes || {};
    const base = label || templateId || 'scene';
    if (typeof Editor.slugifySceneId === 'function') {
      return Editor.slugifySceneId(base, scenes);
    }
    if (typeof Editor.slugifyId === 'function') {
      return Editor.slugifyId(String(base), '', scenes);
    }
    let id = String(base).toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_|_$/g, '') || 'scene';
    if (!scenes[id]) return id;
    let n = 2;
    while (scenes[id + '_' + n]) n++;
    return id + '_' + n;
  }

  Editor.isSceneHistorySupported = function isSceneHistorySupported(sceneId) {
    const sid = sceneId || Editor.currentScene;
    const H = typeof window !== 'undefined' ? window.EditorHistory : null;
    return !!(sid && Editor.data?.scenes?.[sid] && H
      && typeof H.makeSnapshot === 'function' && typeof H.pushUndo === 'function');
  };

  Editor.snapshotSceneBeforeTemplateReplace = function snapshotSceneBeforeTemplateReplace(sceneId) {
    const sid = sceneId || Editor.currentScene;
    if (!this.isSceneHistorySupported(sid)) return false;
    const H = window.EditorHistory;
    const ctx = { type: 'scene', id: sid };
    const snap = H.makeSnapshot(ctx, { op: 'template-replace' });
    H.pushUndo(ctx, snap);
    return true;
  };

  Editor.buildSceneTemplateReplaceConfirmMessage = function buildSceneTemplateReplaceConfirmMessage(sceneId) {
    const sid = sceneId || Editor.currentScene;
    const name = sceneTemplateSceneLabel(sid);
    const historyOk = this.isSceneHistorySupported(sid);
    const historyNote = historyOk
      ? ' Перед заменой будет сохранён снимок сцены — отменить можно через «Отменить» (Ctrl+Z).'
      : ' История изменений для этой сцены сейчас недоступна — отменить замену через Ctrl+Z нельзя.';
    return `Сцена «${name}» будет перезаписана: текст, выборы и события входа заменятся содержимым шаблона.${historyNote}`;
  };

  Editor.requestSceneTemplateReplaceConfirm = function requestSceneTemplateReplaceConfirm(sceneId) {
    const sid = sceneId || Editor.currentScene;
    if (!sid || !Editor.data?.scenes?.[sid]) {
      if (Editor.toast?.error) Editor.toast.error('Сначала выберите сцену');
      return Promise.resolve(false);
    }
    if (typeof Editor.confirmDialog === 'function') {
      return Editor.confirmDialog({
        title: 'Заменить текущую сцену?',
        message: Editor.buildSceneTemplateReplaceConfirmMessage(sid),
        confirmLabel: 'Заменить',
        danger: true
      });
    }
    return Promise.resolve(false);
  };

  Editor.runSceneTemplateReplace = function runSceneTemplateReplace(applyFn, sceneId) {
    return Editor.requestSceneTemplateReplaceConfirm(sceneId).then((ok) => {
      if (!ok) return false;
      const sid = sceneId || Editor.currentScene;
      Editor.snapshotSceneBeforeTemplateReplace(sid);
      if (typeof applyFn === 'function') applyFn();
      if (typeof Editor.closeCreateSceneModal === 'function') Editor.closeCreateSceneModal();
      return true;
    });
  };

  Editor.updateSceneTemplatePickerChrome = function updateSceneTemplatePickerChrome() {
    const overlay = document.getElementById('scene-template-picker-modal');
    if (!overlay) return;
    const hint = overlay.querySelector('#scene-template-picker-hint');
    const toggle = overlay.querySelector('[data-action="scene-template-replace-toggle"]');
    const replace = Editor._sceneTemplatePickerMode === 'replace';
    const hasScene = !!(Editor.currentScene && Editor.data?.scenes?.[Editor.currentScene]);
    if (hint) {
      if (replace && hasScene) {
        hint.textContent = `Режим замены: выберите шаблон — содержимое «${sceneTemplateSceneLabel(Editor.currentScene)}» будет перезаписано (текст, выборы, события).`;
      } else {
        hint.innerHTML = 'Выберите шаблон — будет создана <strong>новая</strong> сцена. Текущая сцена не изменится.';
      }
    }
    if (toggle) {
      toggle.textContent = replace ? '← Создавать новую сцену' : 'Заменить текущую сцену…';
      toggle.disabled = !hasScene;
      toggle.classList.toggle('btn-danger', replace);
      toggle.classList.toggle('btn-secondary', !replace);
    }
  };

  Editor.createSceneFromBaseTemplate = function createSceneFromBaseTemplate(templateId) {
    if (!templateId) return null;
    if (!Editor.data?.scenes) Editor.data.scenes = {};
    if (typeof SceneTemplateEngine === 'undefined' || typeof SceneTemplateEngine.generateSceneFromTemplate !== 'function') {
      if (Editor.toast?.error) Editor.toast.error('Движок шаблонов не загружен');
      return null;
    }
    const templates = SceneTemplateEngine.listBaseTemplates?.() || [];
    const tplMeta = templates.find((t) => (t.id || t) === templateId);
    const label = tplMeta?.label || templateId;
    const id = makeSceneIdFromTemplateBase(templateId, label);
    try {
      const H = typeof window !== 'undefined' ? window.EditorHistory : null;
      const focusBefore = H?.getFocusState?.('scene');
      const generated = SceneTemplateEngine.generateSceneFromTemplate(Editor.data, {
        template: templateId,
        id,
        name: label,
        params: { id, name: label }
      });
      generated.id = id;
      if (!generated.location) generated.location = label;
      Editor.data.scenes[id] = generated;
      Editor.currentScene = id;
      if (H?.recordCreate) H.recordCreate('scene', id, focusBefore);
      Editor._sceneTemplatePickerMode = 'create';
      Editor.closeCreateSceneModal?.();
      Editor.markDirty?.();
      Editor.renderSceneList?.();
      if (typeof Editor.switchTab === 'function') Editor.switchTab('scenes');
      Editor.renderSceneEditor?.();
      Editor.updateJSONPreview?.();
      if (Editor.toast?.success) Editor.toast.success('Создана сцена «' + label + '»');
      return id;
    } catch (err) {
      console.error('[createSceneFromBaseTemplate]', err);
      if (Editor.toast?.error) Editor.toast.error('Не удалось создать сцену: ' + (err.message || err));
      return null;
    }
  };

  // ——— Scene template modal (was missing: openCreateSceneModal) ———
  Editor.openCreateSceneModal = function openCreateSceneModal() {
    Editor._sceneTemplatePickerMode = 'create';
    let overlay = document.getElementById('scene-template-picker-modal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'scene-template-picker-modal';
      overlay.setAttribute('role', 'dialog');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px;';
      overlay.innerHTML = `
        <div class="project-info" style="max-width:520px;width:100%;max-height:80vh;overflow:auto;background:var(--card-bg,#fff);border-radius:10px;padding:16px 18px;box-shadow:0 8px 32px rgba(0,0,0,.2);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h3 style="margin:0;">📋 Шаблоны сцены</h3>
            <button type="button" class="btn btn-secondary" data-action="close-scene-templates">Закрыть</button>
          </div>
          <p class="hint" id="scene-template-picker-hint">Выберите шаблон — будет создана <strong>новая</strong> сцена. Текущая сцена не изменится.</p>
          <div id="scene-template-picker-list" class="template-grid"></div>
          <div class="scene-template-picker-actions" style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border,#ddd);">
            <button type="button" class="btn btn-secondary" data-action="scene-template-replace-toggle">Заменить текущую сцену…</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) Editor.closeCreateSceneModal();
      });
    }
    const list = overlay.querySelector('#scene-template-picker-list');
    const templates = (typeof SceneTemplateEngine !== 'undefined' && SceneTemplateEngine.listBaseTemplates)
      ? SceneTemplateEngine.listBaseTemplates()
      : [];
    if (!list) return;
    if (!templates.length) {
      list.innerHTML = '<p class="hint">Шаблоны недоступны (SceneTemplateEngine не загружен).</p>';
    } else {
      list.innerHTML = templates.map((tpl) => {
        const id = tpl.id || '';
        const icon = tpl.icon || '📄';
        const label = tpl.label || id;
        const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
        return `<button type="button" class="template-card btn btn-secondary" data-action="apply-scene-template" data-template-id="${esc(id)}">
          <span class="template-card__icon">${esc(icon)}</span>
          <span class="template-card__title">${esc(label)}</span>
        </button>`;
      }).join('');
    }
    overlay.style.display = 'flex';
    Editor.updateSceneTemplatePickerChrome?.();
  };

  Editor.closeCreateSceneModal = function closeCreateSceneModal() {
    const overlay = document.getElementById('scene-template-picker-modal');
    if (overlay) overlay.style.display = 'none';
    Editor._sceneTemplatePickerMode = 'create';
  };

  Editor.applySceneTemplateToCurrent = function applySceneTemplateToCurrent(templateId) {
    if (!templateId) return;
    const sceneId = this.currentScene;
    if (!sceneId || !this.data?.scenes?.[sceneId]) {
      if (Editor.toast?.error) Editor.toast.error('Сначала выберите сцену');
      return;
    }
    if (typeof SceneTemplateEngine === 'undefined' || typeof SceneTemplateEngine.generateSceneFromTemplate !== 'function') {
      if (Editor.toast?.error) Editor.toast.error('Движок шаблонов не загружен');
      return;
    }
    const prev = this.data.scenes[sceneId];
    const location = prev.location || prev.title || sceneId;
    try {
      const generated = SceneTemplateEngine.generateSceneFromTemplate(this.data, {
        template: templateId,
        id: sceneId,
        name: location,
        params: { id: sceneId, name: location, ...(prev.templateParams || {}) }
      });
      // Keep editorModules / mapLocation if present
      if (prev.editorModules) generated.editorModules = prev.editorModules;
      if (prev.mapLocation) generated.mapLocation = prev.mapLocation;
      generated.id = sceneId;
      if (!generated.location) generated.location = location;
      this.data.scenes[sceneId] = generated;
      this.closeCreateSceneModal();
      this.markDirty?.();
      this.renderSceneList?.();
      this.renderSceneEditor?.();
      this.updateJSONPreview?.();
      const templates = SceneTemplateEngine.listBaseTemplates?.() || [];
      const tplMeta = templates.find((t) => (t.id || t) === templateId);
      const tplLabel = tplMeta?.label || templateId;
      if (Editor.toast?.success) Editor.toast.success('Шаблон «' + tplLabel + '» применён к сцене');
    } catch (err) {
      console.error('[applySceneTemplateToCurrent]', err);
      if (Editor.toast?.error) Editor.toast.error('Не удалось применить шаблон: ' + (err.message || err));
    }
  };

  /** Единый вход в мастер шаблонов сцены (legacy alias + палитра + пустое состояние). */
  Editor.openTemplateSceneModal = function openTemplateSceneModal() {
    if (!Editor.data || (typeof Editor.isProjectContentEmpty === 'function' && Editor.isProjectContentEmpty())) {
      if (typeof Editor.openNewProjectModal === 'function') return Editor.openNewProjectModal();
    }
    if (typeof Editor.openCreateSceneModal === 'function') return Editor.openCreateSceneModal();
    if (typeof Editor.openSceneWizard === 'function') return Editor.openSceneWizard();
    Editor.toast?.info?.('Шаблоны недоступны');
    return false;
  };

  // Делегирование кликов (не зависит от пересоздания DOM превью)
  if (!window._sceneBuilderClickBound) {
    window._sceneBuilderClickBound = true;
    document.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest && e.target.closest('.scene-add-module-btn');
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof Editor.toggleSceneModulePicker === 'function') {
          Editor.toggleSceneModulePicker();
        }
        return;
      }
      const pick = e.target && e.target.closest && e.target.closest('.scene-module-pick[data-module-id]');
      if (pick && !pick.disabled) {
        e.preventDefault();
        e.stopPropagation();
        const mid = pick.getAttribute('data-module-id');
        if (mid && typeof Editor.addSceneModule === 'function') {
          Editor.addSceneModule(mid);
        }
        return;
      }
      const openTpl = e.target && e.target.closest && e.target.closest('[data-action="open-scene-templates"]');
      if (openTpl) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof Editor.openCreateSceneModal === 'function') Editor.openCreateSceneModal();
        return;
      }
      const closeTpl = e.target && e.target.closest && e.target.closest('[data-action="close-scene-templates"]');
      if (closeTpl) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof Editor.closeCreateSceneModal === 'function') Editor.closeCreateSceneModal();
        return;
      }
      const replaceToggle = e.target && e.target.closest && e.target.closest('[data-action="scene-template-replace-toggle"]');
      if (replaceToggle) {
        e.preventDefault();
        e.stopPropagation();
        if (!(Editor.currentScene && Editor.data?.scenes?.[Editor.currentScene])) {
          if (Editor.toast?.error) Editor.toast.error('Сначала выберите сцену для замены');
          return;
        }
        Editor._sceneTemplatePickerMode = Editor._sceneTemplatePickerMode === 'replace' ? 'create' : 'replace';
        if (typeof Editor.updateSceneTemplatePickerChrome === 'function') Editor.updateSceneTemplatePickerChrome();
        return;
      }
      const applyTpl = e.target && e.target.closest && e.target.closest('[data-action="apply-scene-template"]');
      if (applyTpl) {
        e.preventDefault();
        e.stopPropagation();
        const tid = applyTpl.getAttribute('data-template-id');
        if (!tid) return;
        if (Editor._sceneTemplatePickerMode === 'replace') {
          if (typeof Editor.runSceneTemplateReplace === 'function') {
            Editor.runSceneTemplateReplace(() => Editor.applySceneTemplateToCurrent(tid));
          }
        } else if (typeof Editor.createSceneFromBaseTemplate === 'function') {
          Editor.createSceneFromBaseTemplate(tid);
        }
        return;
      }
    }, true);
  }

  // Стили
  if (typeof document !== 'undefined' && !document.getElementById('scene-builder-styles')) {
    const style = document.createElement('style');
    style.id = 'scene-builder-styles';
    style.textContent = `
      .scene-builder-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; gap:8px; flex-wrap:wrap; }
      .scene-builder-core { margin-bottom:16px; }
      .scene-modules-empty { padding:16px; text-align:center; border:1px dashed var(--border, #444); border-radius:8px; margin:12px 0; }
      .scene-module-card { border:1px solid var(--border, #444); border-radius:8px; margin:10px 0; background: var(--paper, rgba(255,255,255,0.03)); overflow:hidden; }
      .scene-module-head { display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background: rgba(0,0,0,0.15); border-bottom:1px solid var(--border, #333); }
      .scene-module-body { padding:12px; }
      .scene-builder-add { margin:16px 0; }
      .scene-add-module-btn { font-size:16px; padding:10px 18px; }
      .scene-module-picker { border:1px solid var(--accent, #6af); border-radius:10px; padding:14px; margin:12px 0; background: var(--paper, #1a1a1a); }
      .scene-module-picker-title { font-weight:700; margin-bottom:10px; }
      .scene-module-picker-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:8px; margin-bottom:12px; }
      .scene-module-pick { display:flex; flex-direction:column; align-items:flex-start; gap:4px; padding:10px; border-radius:8px; border:1px solid var(--border,#444); background:transparent; color:inherit; cursor:pointer; text-align:left; }
      .scene-module-pick:hover:not(:disabled) { border-color: var(--accent,#6af); }
      .scene-module-pick.is-active, .scene-module-pick:disabled { opacity:0.45; cursor:default; }
      .scene-module-pick-icon { font-size:20px; }
      .scene-module-pick-label { font-size:13px; font-weight:600; }
      .scene-module-pick-hint { font-size:11px; opacity:0.75; font-weight:400; }
      .scene-module-picker-group { margin-bottom:14px; }
      .scene-module-picker-group-title { font-size:12px; text-transform:uppercase; letter-spacing:0.04em; opacity:0.8; margin-bottom:8px; font-weight:700; }
      .scene-module-picker-actions { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
    `;
    document.head.appendChild(style);
  }

  if (Editor.hooks && typeof Editor.hooks.register === 'function') {
    Editor.hooks.register('editor-scene-builder-templates', {
      openCreateSceneModal: Editor.openCreateSceneModal,
      closeCreateSceneModal: Editor.closeCreateSceneModal,
      createSceneFromBaseTemplate: Editor.createSceneFromBaseTemplate,
      applySceneTemplateToCurrent: Editor.applySceneTemplateToCurrent,
      runSceneTemplateReplace: Editor.runSceneTemplateReplace
    }, { force: true });
  }
})();

