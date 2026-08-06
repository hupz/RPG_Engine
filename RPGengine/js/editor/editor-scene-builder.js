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
    { id: 'template', icon: '📋', label: 'Шаблон', hint: 'Создать содержимое из шаблона' }
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
      if (Array.isArray(scene.editorModules)) {
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
      const scene = this.data?.scenes?.[this.currentScene];
      if (!scene || !moduleId) return;
      const mods = this.ensureSceneEditorModules(scene);
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
      if (moduleId === 'template' && typeof this.openCreateSceneModal === 'function') {
        // шаблон — отдельный поток; не открываем модалку автоматически
      }

      this._sceneModulePickerOpen = false;
      this.renderSceneEditor();
      this.updateJSONPreview();
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
      this.renderSceneEditor();
    },

    /**
     * Создать пустую сцену: только ID и название.
     */
    createBlankScene() {
      if (!this.data) {
        alert('Сначала загрузите или создайте проект');
        return;
      }
      if (!this.data.scenes) this.data.scenes = {};
      let id, title;
      if (typeof this.promptNameAndId === 'function') {
        const r = this.promptNameAndId({
          namePrompt: 'Название сцены (для игрока):',
          defaultName: 'Новая сцена',
          existing: this.data.scenes,
          allowEditId: false
        });
        if (!r) return;
        id = r.id;
        title = r.name;
      } else {
        title = prompt('Название сцены:', 'Новая сцена');
        if (!title) return;
        id = String(title).toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'new_scene';
        if (this.data.scenes[id]) id = id + '_' + Date.now().toString(36).slice(-3);
      }
      this.data.scenes[id] = {
        id,
        location: title,
        text: '',
        editorModules: []
      };
      this.currentScene = id;
      this._sceneModulePickerOpen = false;
      const startScreen = document.getElementById('start-screen');
      if (startScreen) startScreen.style.display = 'none';
      this.renderSceneList();
      this.renderSceneEditor();
      this.updateJSONPreview();
      if (typeof this.switchTab === 'function') this.switchTab('scenes');
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
            <select onchange="Editor.setSceneNpcId(this.value)">
              <option value="">— нет —</option>
              ${Object.keys(this.data.npcs || {}).map((nid) =>
                `<option value="${this.escapeAttr(nid)}" ${scene.npcId === nid ? 'selected' : ''}>${this.escapeHtml(this.data.npcs[nid]?.name || nid)}</option>`
              ).join('')}
            </select>
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

        case 'template':
          body = `<p class="hint">Создать содержимое сцены из готового шаблона (торговля, бой, диалог…).</p>
            <button type="button" class="btn btn-primary" onclick="Editor.openCreateSceneModal?.()">📋 Открыть шаблоны</button>
            ${scene.sceneTemplate ? `<p class="hint">Текущий шаблон: <code>${this.escapeHtml(scene.sceneTemplate)}</code></p>` : ''}`;
          break;

        default:
          body = `<p class="hint">Неизвестный модуль: ${this.escapeHtml(moduleId)}</p>`;
      }

      return `<div class="scene-module-card" data-module="${this.escapeAttr(moduleId)}">
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
      const rows = Object.entries(flags).map(([k, v], i) =>
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
      const cards = SCENE_MODULES.map((m) => {
        const on = active.has(m.id);
        return `<button type="button" class="scene-module-pick${on ? ' is-active' : ''}"
          ${on ? 'disabled' : ''}
          data-module-id="${m.id}" onclick="Editor.addSceneModule(${JSON.stringify(m.id)})"
          title="${this.escapeAttr(m.hint)}">
          <span class="scene-module-pick-icon">${m.icon}</span>
          <span class="scene-module-pick-label">${this.escapeHtml(m.label)}</span>
        </button>`;
      }).join('');
      return `<div class="scene-module-picker">
        <div class="scene-module-picker-title">Что добавить на сцену?</div>
        <div class="scene-module-picker-grid">${cards}</div>
        <button type="button" class="btn btn-secondary" onclick="Editor.toggleSceneModulePicker()">Закрыть</button>
      </div>`;
    }
  });

  // Полная замена UI редактора сцены (последний в цепочке скриптов)
  function renderSceneEditorModular() {
    const container = document.getElementById('scene-editor');
    if (!container) return;
    if (!this.currentScene || !this.data?.scenes?.[this.currentScene]) {
      container.innerHTML = '<div class="empty-state"><h2>Сцена не выбрана</h2><p class="hint">Создайте сцену кнопкой «+ Новая сцена»</p></div>';
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

    container.innerHTML = `
      <div class="scene-builder">
        <div class="scene-builder-head">
          <h2>🎬 ${this.escapeHtml(title)}</h2>
          <button type="button" class="btn btn-danger" onclick="Editor.deleteScene('${this.escapeAttr(this.currentScene)}')">🗑 Удалить</button>
        </div>
        <div class="scene-builder-core project-info">
          <div class="form-group"><label>Название</label>
            <input type="text" id="scene-title" value="${this.escapeHtml(scene.location || '')}"
              onchange="Editor.updateSceneField('location', this.value); Editor.renderSceneList();">
            <p class="hint">Соберите сцену блоками ниже. <span class="hint" title="Технический ID">ID: <code>${this.escapeHtml(this.currentScene)}</code></span>
              <button type="button" class="btn btn-secondary" style="font-size:11px;margin-left:6px;" onclick="const n=prompt('Изменить ID (латиница):','${this.escapeAttr(this.currentScene)}');if(n)Editor.updateSceneId(n);">Изменить ID</button>
            </p>
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

  Editor.renderSceneEditor = function () {
    return renderSceneEditorModular.call(this);
  };
  if (Editor.hooks && typeof Editor.hooks.replace === 'function') {
    Editor.hooks.replace('renderSceneEditor', function () {
      return renderSceneEditorModular.call(this);
    });
  }

    // «Новая сцена» → пустая (ID + название), шаблоны — отдельный модуль
  Editor.createScene = function createSceneBlank() {
    this.createBlankScene();
  };

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
    `;
    document.head.appendChild(style);
  }
})();
