// Редактор: модальное окно «Новый проект» + выбор системы правил

(function attachEditorNewProject() {
  if (typeof Editor === 'undefined') {
    console.warn('editor-new-project.js: Editor не определён');
    return;
  }

  const tr = (k, p) => (typeof t === 'function' ? t(k, p) : k);

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
  Editor.ensureMetaSystem = ensureMetaSystem;

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
        title: title || tr('editor.newProject.defaultTitle'),
        version: '1.0',
        author: '',
        description: tr('editor.newProject.defaultDescription'),
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
      achievements: {},
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
      startScene: 'start',
      scenes: {
        start: {
          id: 'start',
          location: tr('editor.newProject.startLocation'),
          text: tr('editor.newProject.startText'),
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

  function fillNewProjectModalI18n(overlay) {
    if (!overlay || typeof I18n === 'undefined') return;
    const map = {
      'editor-new-project-title': 'editor.newProject.title',
      'editor-new-project-name-label': 'editor.newProject.projectName',
      'editor-new-project-system-label': 'editor.newProject.ruleSystem',
      'editor-new-project-cancel': 'editor.newProject.cancel',
      'editor-new-project-create': 'editor.newProject.create'
    };
    Object.entries(map).forEach(([id, key]) => {
      const el = overlay.querySelector('#' + id) || overlay.querySelector('[data-i18n-id="' + id + '"]');
      if (el) el.textContent = tr(key);
    });
    const nameInput = overlay.querySelector('#editor-new-project-name');
    if (nameInput) nameInput.placeholder = tr('editor.newProject.namePlaceholder');
    const closeBtn = overlay.querySelector('#editor-new-project-close');
    if (closeBtn) closeBtn.title = tr('common.close');
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

    applyProjectSettings(patch) {
      if (!this.data || !patch) return;
      if (!this.data.meta) this.data.meta = {};
      if (patch.title != null) this.data.meta.title = patch.title;
      if (patch.version != null) this.data.meta.version = patch.version;
      if (patch.author != null) this.data.meta.author = patch.author;
      if (patch.description != null) this.data.meta.description = patch.description;
      if (patch.startScene !== undefined) this.data.startScene = patch.startScene;
      if (patch.metaStartScene !== undefined) {
        if (patch.metaStartScene == null) delete this.data.meta.startScene;
        else this.data.meta.startScene = patch.metaStartScene;
      }
      this.updateProjectPanel?.();
      this.updateJSONPreview?.();
    },

    async editMeta() {
      if (!this.data?.meta) {
        Editor.toast?.warning?.('Сначала откройте проект');
        return;
      }
      const m = this.data.meta;
      const title = await Editor.promptDialog({
        message: 'Название проекта:',
        defaultValue: m.title || ''
      });
      if (title === null) return;
      const version = await Editor.promptDialog({
        message: 'Версия:',
        defaultValue: m.version || '1.0'
      });
      if (version === null) return;
      const author = await Editor.promptDialog({
        message: 'Автор:',
        defaultValue: m.author || ''
      });
      if (author === null) return;
      this.applyProjectSettings({
        title: title.trim() || m.title,
        version: version.trim() || m.version,
        author: author.trim()
      });
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
              <h3 id="editor-new-project-title" data-i18n="editor.newProject.title">📄 Новый проект</h3>
              <button type="button" class="btn-remove" id="editor-new-project-close" data-i18n-title="common.close" title="Закрыть">×</button>
            </div>
            <div class="modal-box-body">
              <div class="form-group">
                <label for="editor-new-project-name" data-i18n="editor.newProject.projectName">Название проекта</label>
                <input type="text" id="editor-new-project-name" data-i18n-placeholder="editor.newProject.namePlaceholder" placeholder="Моя новая игра" value="Моя новая игра">
              </div>
              <div class="form-group">
                <label for="editor-new-project-system" data-i18n="editor.newProject.ruleSystem">Система правил</label>
                <select id="editor-new-project-system"></select>
                <p class="hint" id="editor-new-project-system-desc"></p>
              </div>
            </div>
            <div class="modal-box-footer">
              <button type="button" class="btn btn-secondary" id="editor-new-project-cancel" data-i18n="editor.newProject.cancel">Отмена</button>
              <button type="button" class="btn btn-primary" id="editor-new-project-create" data-i18n="editor.newProject.create">Создать проект</button>
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

      document.getElementById('editor-new-project-name').value = tr('editor.newProject.defaultTitle');
      if (typeof I18n !== 'undefined') I18n.applyDocument(overlay);
      else fillNewProjectModalI18n(overlay);
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
        Editor.toast.warning(tr('editor.newProject.enterName'));
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
      Editor.toast.success('✅ ' + tr('editor.export.projectCreated', { title, system: getSystemLabel(systemId) }));
    }
  });

  const origNewProject = Editor.newProject.bind(Editor);
  Editor.newProject = async function () {
    if (this.data && !(await Editor.confirmDialog({ message: tr('editor.export.newProjectConfirm') }))) {
      return;
    }
    if (typeof this.openStoryWizard === 'function') {
      return this.openStoryWizard();
    }
    this.openNewProjectModal();
  };

  /** Вторичный путь: пустой проект без мастера «Режим истории». */
  Editor.newBlankProject = async function () {
    if (this.data && !(await Editor.confirmDialog({ message: tr('editor.export.newProjectConfirm') }))) {
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
        const parsed = JSON.parse(text);
        if (typeof this.applyLoadedProject === 'function') {
          this.applyLoadedProject(parsed);
        } else {
          this.data = parsed;
          ensureMetaSystem(this.data);
          this.renderAll();
          Editor.toast.success('✅ ' + tr('editor.export.loadOk', { title: this.data.meta?.title || tr('editor.newProject.noTitle') }));
        }
      } catch (err) {
        Editor.toast.error('❌ ' + tr('editor.export.loadFail', { message: err.message }));
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
      if (p) p.innerHTML = tr('editor.project.noProject');
      return;
    }
    ensureMetaSystem(this.data);
    const sid = this.data.meta.system;
    const label = getSystemLabel(sid);
    if (p) {
      p.innerHTML = `<b>${tr('editor.project.name')}:</b> ${this.escapeHtml(this.data.meta?.title || '—')}<br>
        <b>${tr('editor.project.version')}:</b> ${this.escapeHtml(this.data.meta?.version || '—')}<br>
        <b>${tr('editor.project.author')}:</b> ${this.escapeHtml(this.data.meta?.author || '—')}<br>
        <b>${tr('editor.project.system')}:</b> ${this.escapeHtml(label)} (<code>${this.escapeHtml(sid)}</code>)<br>
        <button class="btn btn-secondary" style="width:100%;margin-top:8px;" onclick="Editor.editMeta()">${tr('editor.newProject.editMeta')}</button>`;
    }
  };
})();
