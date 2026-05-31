// Редактор: модальное окно «Новый проект» + выбор системы правил

(function attachEditorNewProject() {
  if (typeof Editor === 'undefined') {
    console.warn('editor-new-project.js: Editor не определён');
    return;
  }

  function ensureMetaSystem(data) {
    if (!data.meta) data.meta = {};
    if (data.meta.system) return data.meta.system;
    if (data.system === 'pf2e' || (data.ancestries && Object.keys(data.ancestries).length)) {
      data.meta.system = 'pf2e';
      return 'pf2e';
    }
    const hasSpellcasting = Object.values(data.classes || {}).some(
      (c) => c && (c.spellcasting || c.halfCaster)
    );
    data.meta.system = hasSpellcasting ? 'dnd5e' : 'generic';
    return data.meta.system;
  }

  function getSystemLabel(systemId) {
    if (typeof SystemRegistry !== 'undefined') {
      const sys = SystemRegistry.get(systemId);
      if (sys?.label) return sys.label;
    }
    return systemId || '—';
  }

  function buildDnd5eStarterProject(title, systemId) {
    const sys = systemId || (typeof SystemRegistry !== 'undefined' ? SystemRegistry.getDefault() : 'dnd5e');
    return {
      meta: {
        title: title || 'Моя новая игра',
        version: '1.0',
        author: '',
        description: 'Новый проект',
        system: sys
      },
      enemyScaling: {
        enabled: true,
        baseLevel: 1,
        bossHpRate: 1.5,
        scaling: JSON.parse(JSON.stringify(EnemyScaling?.DEFAULT_SCALING || {}))
      },
      progression: {
        enabled: true,
        maxLevel: 5,
        expTable: [0, 100, 220, 380, 600],
        defaultHpGain: '1d8',
        defaults: { enemyExp: 20, skillCheckExp: 12 },
        skillExp: {},
        abilities: {}
      },
      startingFlags: {},
      reputation: {},
      classes: {},
      items: {},
      ingredients: {},
      recipes: {},
      enemies: {},
      npcs: {},
      quests: {},
      theme: typeof ThemeSystem !== 'undefined' ? ThemeSystem.getDefaultTheme() : {},
      audio: { catalog: {}, defaults: { damageType: {}, effectType: {}, attack: {} } },
      statusEffects: {},
      worldMap: {},
      scenes: {
        start: {
          id: 'start',
          location: 'Начало',
          text: 'Добро пожаловать!',
          choices: [],
          dialogue: [],
          combat: null,
          flags: {},
          items: [],
          gold: 0
        }
      }
    };
  }

  Object.assign(Editor, {
    createDnd5eStarterProject(title, systemId) {
      return buildDnd5eStarterProject(title, systemId);
    },

    createPf2eStarterProject(title) {
      if (typeof window.createPf2eStarterProject === 'function') {
        return window.createPf2eStarterProject(title);
      }
      return buildDnd5eStarterProject(title, 'pf2e');
    },

    getRuleSystemLabel(systemId) {
      return getSystemLabel(systemId);
    },

    ensureProjectMetaSystem() {
      if (!this.data) return null;
      return ensureMetaSystem(this.data);
    },

    openNewProjectModal() {
      let overlay = document.getElementById('editor-new-project-modal');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'editor-new-project-modal';
        overlay.className = 'modal-overlay hidden';
        overlay.innerHTML = `
          <div class="modal-box paper-sheet" role="dialog" aria-labelledby="editor-new-project-title" onclick="event.stopPropagation()">
            <div class="modal-box-header">
              <h3 id="editor-new-project-title">📄 Новый проект</h3>
              <button type="button" class="btn-remove" id="editor-new-project-close" title="Закрыть">×</button>
            </div>
            <div class="modal-box-body">
              <div class="form-group">
                <label for="editor-new-project-name">Название проекта</label>
                <input type="text" id="editor-new-project-name" placeholder="Моя новая игра" value="Моя новая игра">
              </div>
              <div class="form-group">
                <label for="editor-new-project-system">Система правил</label>
                <select id="editor-new-project-system"></select>
                <p class="hint" id="editor-new-project-system-desc"></p>
              </div>
            </div>
            <div class="modal-box-footer">
              <button type="button" class="btn btn-secondary" id="editor-new-project-cancel">Отмена</button>
              <button type="button" class="btn btn-primary" id="editor-new-project-create">Создать проект</button>
            </div>
          </div>`;
        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) Editor.closeNewProjectModal();
        });
        overlay.querySelector('#editor-new-project-close').addEventListener('click', () => Editor.closeNewProjectModal());
        overlay.querySelector('#editor-new-project-cancel').addEventListener('click', () => Editor.closeNewProjectModal());
        overlay.querySelector('#editor-new-project-create').addEventListener('click', () => Editor.confirmNewProject());

        const sysSel = overlay.querySelector('#editor-new-project-system');
        sysSel.addEventListener('change', () => Editor._updateNewProjectSystemHint());
      }

      const list = typeof SystemRegistry !== 'undefined'
        ? SystemRegistry.list()
        : [{ id: 'dnd5e', label: 'D&D 5e', description: '' }];
      const sysSel = document.getElementById('editor-new-project-system');
      const defaultId = typeof SystemRegistry !== 'undefined' ? SystemRegistry.getDefault() : 'dnd5e';
      sysSel.innerHTML = list.map((s) =>
        `<option value="${Editor.escapeAttr(s.id)}">${Editor.escapeHtml(s.label)}</option>`
      ).join('');
      sysSel.value = defaultId;

      document.getElementById('editor-new-project-name').value = 'Моя новая игра';
      this._updateNewProjectSystemHint();
      overlay.classList.remove('hidden');
      overlay.classList.add('open');
      setTimeout(() => document.getElementById('editor-new-project-name')?.focus(), 50);
    },

    _updateNewProjectSystemHint() {
      const sel = document.getElementById('editor-new-project-system');
      const hint = document.getElementById('editor-new-project-system-desc');
      if (!sel || !hint) return;
      const id = sel.value;
      const sys = typeof SystemRegistry !== 'undefined' ? SystemRegistry.get(id) : null;
      hint.textContent = sys?.description || '';
    },

    closeNewProjectModal() {
      const overlay = document.getElementById('editor-new-project-modal');
      if (overlay) {
        overlay.classList.add('hidden');
        overlay.classList.remove('open');
      }
    },

    confirmNewProject() {
      const title = (document.getElementById('editor-new-project-name')?.value || '').trim();
      if (!title) {
        alert('Введите название проекта.');
        return;
      }
      const systemId = document.getElementById('editor-new-project-system')?.value
        || (typeof SystemRegistry !== 'undefined' ? SystemRegistry.getDefault() : 'dnd5e');

      if (systemId === 'pf2e') {
        this.data = this.createPf2eStarterProject(title);
      } else {
        this.data = this.createDnd5eStarterProject(title, systemId);
      }
      this.currentScene = 'start';
      if (typeof ThemeSystem !== 'undefined') ThemeSystem.ensureInData(this.data);
      if (typeof this.applyThemeFromData === 'function') this.applyThemeFromData();
      this.closeNewProjectModal();
      this.renderAll();
      this.updateProjectPanel();
      this.updateJSONPreview();
      if (typeof this.showDashboard === 'function') this.showDashboard();
      alert(`✅ Проект «${title}» создан (${getSystemLabel(systemId)}).`);
    }
  });

  const origNewProject = Editor.newProject.bind(Editor);
  Editor.newProject = function () {
    if (this.data && !confirm('У вас есть открытый проект. Создать новый? Несохранённые изменения будут потеряны.')) {
      return;
    }
    this.openNewProjectModal();
  };

  Editor._loadDataFromFile = function () {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        this.data = JSON.parse(text);
        ensureMetaSystem(this.data);
        if (typeof SpellSlotProgression !== 'undefined') SpellSlotProgression.applyToGameData(this.data);
        if (typeof QuestSystem !== 'undefined') QuestSystem.normalizeAll(this.data);
        if (typeof ThemeSystem !== 'undefined') ThemeSystem.ensureInData(this.data);
        if (typeof this.ensureWorldMap === 'function') this.ensureWorldMap();
        if (typeof this.ensureCraftingData === 'function') this.ensureCraftingData();
        if (typeof this.applyThemeFromData === 'function') this.applyThemeFromData();
        this.currentScene = Object.keys(this.data.scenes || {})[0] || null;
        localStorage.setItem('melnitsa_game_data', text);
        this.renderAll();
        this.updateProjectPanel();
        this.updateJSONPreview();
        if (typeof this.refreshDashboardIfVisible === 'function') this.refreshDashboardIfVisible();
        if (typeof this.showDashboard === 'function') this.showDashboard();
        alert('✅ Данные загружены: ' + (this.data.meta?.title || 'Без названия'));
      } catch (err) {
        alert('❌ Ошибка: ' + err.message);
      }
    };
    input.click();
  };

  Editor.loadData = function () {
    Editor._loadDataFromFile();
  };

  Editor.updateProjectPanel = function () {
    const p = document.getElementById('project-panel');
    if (!this.data) {
      if (p) p.innerHTML = 'Нет проекта';
      return;
    }
    ensureMetaSystem(this.data);
    const sid = this.data.meta.system;
    const label = getSystemLabel(sid);
    if (p) {
      p.innerHTML = `<b>Название:</b> ${this.escapeHtml(this.data.meta?.title || '—')}<br>
        <b>Версия:</b> ${this.escapeHtml(this.data.meta?.version || '—')}<br>
        <b>Автор:</b> ${this.escapeHtml(this.data.meta?.author || '—')}<br>
        <b>Система:</b> ${this.escapeHtml(label)} (<code>${this.escapeHtml(sid)}</code>)<br>
        <button class="btn btn-secondary" style="width:100%;margin-top:8px;" onclick="Editor.editMeta()">✏️ Мета</button>`;
    }
  };
})();
