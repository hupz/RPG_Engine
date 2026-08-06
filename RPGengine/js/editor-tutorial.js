// Интерактивный onboarding-туториал редактора

(function attachEditorTutorial() {
  if (typeof Editor === 'undefined') {
    console.warn('editor-tutorial.js: Editor не определён');
    return;
  }

  const STORAGE_KEY = 'tutorialCompleted';

  const STEPS = [
    {
      id: 'create-scene',
      title: 'Создайте сцену',
      text: 'Нажмите «+ Новая сцена» и введите только название. ID создастся сам — код писать не нужно.',
      selectors: ['#scene-list', '#btn-create-scene', 'button[onclick*="createScene"]'],
      prepare(t) {
        t.ensureProject();
        t.switchToScenesTab();
        if (typeof Editor.ensureSceneListActions === 'function') Editor.ensureSceneListActions();
      },
      isDone(t) {
        return t._flags.sceneCommitted || t._flags.modalOpened;
      }
    },
    {
      id: 'add-text',
      title: 'Текст сцены',
      text: 'Нажмите «+ Добавить» → «Текст и локация». Напишите, что видит игрок. Справа обновится превью «глазами игрока».',
      selectors: ['.scene-add-module-btn', '.scene-module-pick', '#scene-text', '#scene-title', '.scene-module-card[data-module="story"]'],
      prepare(t) {
        t.switchToScenesTab();
        if (Editor.currentScene && typeof Editor.selectScene === 'function') {
          Editor.selectScene(Editor.currentScene);
        }
        // подсказать добавить story, если пусто
        const scene = Editor.data?.scenes?.[Editor.currentScene];
        if (scene && typeof Editor.addSceneModule === 'function') {
          const mods = Editor.getSceneModules?.(scene) || [];
          if (!mods.includes('story')) {
            /* пользователь добавит сам */
          }
        }
      },
      isDone() {
        const scene = Editor.data?.scenes?.[Editor.currentScene];
        const text = (scene?.text || '').trim();
        const el = document.getElementById('scene-text');
        const live = el ? el.value.trim() : '';
        return !!(text || live);
      }
    },
    {
      id: 'add-choice',
      title: 'Выбор (кнопка)',
      text: 'Снова «+ Добавить» → «Выборы». Создайте кнопку перехода: текст кнопки и куда ведёт.',
      selectors: ['.scene-add-module-btn', '.choices-section', '#choices-list', '.choice-card'],
      prepare(t) {
        t.switchToScenesTab();
        if (Editor.currentScene && typeof Editor.selectScene === 'function') {
          Editor.selectScene(Editor.currentScene);
        }
      },
      isDone() {
        const scene = Editor.data?.scenes?.[Editor.currentScene];
        return Array.isArray(scene?.choices) && scene.choices.length > 0;
      }
    },
    {
      id: 'add-quest',
      title: 'Квест на выборе',
      text: 'В карточке выбора включите «Продвинуть квест» или используйте мастер «📜 Старт квеста». Выберите задание и этап по названиям.',
      selectors: ['.choice-quest-fields', '.scene-wizards-bar', 'button[onclick*="openSceneWizard(\'quest\')"]'],
      prepare(t) {
        t.switchToScenesTab();
        if (Editor.currentScene && typeof Editor.selectScene === 'function') {
          Editor.selectScene(Editor.currentScene);
        }
        // убедиться что есть choices
        const scene = Editor.data?.scenes?.[Editor.currentScene];
        if (scene && (!scene.choices || !scene.choices.length) && typeof Editor.addChoice === 'function') {
          /* не авто-добавляем — пользователь */
        }
      },
      isDone() {
        const scene = Editor.data?.scenes?.[Editor.currentScene];
        const hasOnChoice = (scene?.choices || []).some((c) => c?.questSet?.questId);
        const hasQuestTab = Object.keys(Editor.data?.quests || {}).length > 0 && hasOnChoice;
        return hasOnChoice || hasQuestTab;
      }
    },
    {
      id: 'play',
      title: 'Превью и Play',
      text: 'Справа — вид глазами игрока. Нажмите ▶ Play, чтобы открыть игру с текущими данными.',
      selectors: ['.scenes-preview-pane', '#editor-play-btn', '#live-preview-body'],
      prepare(t) {
        t.switchToScenesTab();
        if (typeof Editor.renderLivePreview === 'function') Editor.renderLivePreview();
      },
      isDone(t) {
        return t._flags.playClicked;
      }
    },
    {
      id: 'save',
      title: 'Сохранение',
      text: 'Сохраните проект: «Сохранить JSON» в меню экспорта.',
      selectors: ['#export-menu-toggle', '[data-export="json"]'],
      prepare() {},
      isDone(t) {
        return t._flags.projectSaved;
      }
    }
  ];

  const EditorTutorial = {
    active: false,
    index: 0,
    waitingForProject: false,
    _flags: {},
    _step2Phase: 'modal',
    _elevated: [],
    _pollId: null,
    _resizeHandler: null,

    tryStart() {
      if (localStorage.getItem(STORAGE_KEY)) return;
      if (window.innerWidth < 768) return;
      if (this.active) return;
      this.init();
    },

    init() {
      this.active = true;
      document.body.classList.add('editor-tutorial-active');
      this.index = 0;
      this._flags = {};
      this._step2Phase = 'modal';
      this._buildUi();
      this._installHooks();
      this._bindGlobalEvents();

      if (!Editor.data) {
        this.waitingForProject = true;
        this._showProjectPrompt();
        return;
      }

      this._runStep(0);
    },

    _buildUi() {
      if (document.getElementById('editor-tutorial-root')) return;

      const root = document.createElement('div');
      root.id = 'editor-tutorial-root';
      root.className = 'editor-tutorial-root';
      root.innerHTML = `
        <div class="editor-tutorial-backdrop" id="editor-tutorial-backdrop"></div>
        <div class="editor-tutorial-spotlight" id="editor-tutorial-spotlight" hidden></div>
        <div class="editor-tutorial-card arrow-top" id="editor-tutorial-card" hidden>
          <div class="editor-tutorial-step-label" id="editor-tutorial-step-label"></div>
          <div class="editor-tutorial-title" id="editor-tutorial-title"></div>
          <div class="editor-tutorial-text" id="editor-tutorial-text"></div>
          <div class="editor-tutorial-wait" id="editor-tutorial-wait">Выполните действие на экране…</div>
          <div class="editor-tutorial-actions">
            <button type="button" class="btn btn-secondary" id="editor-tutorial-skip">Пропустить</button>
            <button type="button" class="btn btn-danger" id="editor-tutorial-never">Не показывать снова</button>
          </div>
        </div>`;
      document.body.appendChild(root);

      root.querySelector('#editor-tutorial-skip').addEventListener('click', () => this.skip(false));
      root.querySelector('#editor-tutorial-never').addEventListener('click', () => this.skip(true));
      root.querySelector('#editor-tutorial-backdrop').addEventListener('click', (e) => {
        e.stopPropagation();
      });
    },

    _installHooks() {
      if (this._hooksInstalled) return;
      this._hooksInstalled = true;

      
      this._wrap('addSceneModule', () => {
        this._flags.moduleAdded = true;
      });
      this._wrap('addChoice', () => {
        this._flags.choiceAdded = true;
      });
      this._wrap('setChoiceQuestSet', () => {
        this._flags.questBound = true;
      });
      this._wrap('applyWizardQuest', () => {
        this._flags.questBound = true;
      });

this._wrap('openCreateSceneModal', () => {
        this._flags.modalOpened = true;
      });

      this._wrap('createBlankScene', () => {
        this._flags.sceneCommitted = true;
        this._flags.modalOpened = true;
      });

      this._wrap('createScene', () => {
        this._flags.modalOpened = true;
        this._flags.sceneCommitted = true;
      });

      this._wrap('commitTemplateScene', () => {
        const name = document.getElementById('tpl-scene-name')?.value?.trim();
        if (name) {
          this._step2Phase = 'description';
          this._flags.sceneCommitted = true;
          this._flags.descriptionTouched = false;
        }
        this._scheduleReposition();
      });

      this._wrap('createNPC', () => {
        this._flags.npcCreated = true;
      });

      this._wrap('addDialogue', () => {
        this._scheduleReposition();
      });

      this._wrap('addChoice', () => {
        this._scheduleReposition();
      });

      this._wrap('updateChoice', (idx, field, val) => {
        if (field === 'to' && String(val || '').trim()) {
          this._scheduleReposition();
        }
      });

      this._wrap('exportJSON', () => {
        this._flags.projectSaved = true;
      });
      this._wrap('exportData', () => {
        this._flags.projectSaved = true;
      });

      if (Editor.hooks?.after) {
        Editor.hooks.after('confirmNewProject', () => { this.onProjectReady(); });
        Editor.hooks.after('renderAll', () => {
          if (this.waitingForProject && Editor.data) this.onProjectReady();
          if (this.active) this._scheduleReposition();
        });
        Editor.hooks.after('renderSceneEditor', () => {
          if (this.active) this._scheduleReposition();
        });
        Editor.hooks.after('renderNPCs', () => {
          if (this.active) this._scheduleReposition();
        });
      } else {
        const origConfirm = Editor.confirmNewProject?.bind(Editor);
        if (origConfirm) {
          Editor.confirmNewProject = (...args) => {
            origConfirm(...args);
            this.onProjectReady();
          };
        }
        const origRenderAll = Editor.renderAll?.bind(Editor);
        if (origRenderAll) {
          Editor.renderAll = (...args) => {
            origRenderAll(...args);
            if (this.waitingForProject && Editor.data) this.onProjectReady();
            if (this.active) this._scheduleReposition();
          };
        }
        const origRenderSceneEditor = Editor.renderSceneEditor?.bind(Editor);
        if (origRenderSceneEditor) {
          Editor.renderSceneEditor = (...args) => {
            origRenderSceneEditor(...args);
            if (this.active) this._scheduleReposition();
          };
        }
        const origRenderNPCs = Editor.renderNPCs?.bind(Editor);
        if (origRenderNPCs) {
          Editor.renderNPCs = (...args) => {
            origRenderNPCs(...args);
            if (this.active) this._scheduleReposition();
          };
        }
      }
    },

    _wrap(name, after) {
      if (Editor.hooks?.after) {
        Editor.hooks.after(name, function (...hookArgs) {
          try {
            after.apply(EditorTutorial, hookArgs[1] || []);
          } catch (e) {
            console.warn('[tutorial]', e);
          }
        });
        return;
      }
      const orig = Editor[name];
      if (typeof orig !== 'function') return;
      Editor[name] = function (...args) {
        const result = orig.apply(this, args);
        try {
          after.apply(EditorTutorial, args);
        } catch (e) {
          console.warn('[tutorial]', e);
        }
        return result;
      };
    },

    _bindGlobalEvents() {
      if (this._resizeHandler) return;
      this._resizeHandler = () => this._scheduleReposition();
      window.addEventListener('resize', this._resizeHandler);
      window.addEventListener('scroll', this._resizeHandler, true);

      document.addEventListener('click', (e) => {
        if (!this.active) return;
        if (e.target.closest('#editor-play-btn')) {
          this._flags.playClicked = true;
        }
      }, true);

      document.addEventListener('input', (e) => {
        if (!this.active) return;
        if (e.target?.id === 'scene-text' && this._flags.sceneCommitted) {
          this._flags.descriptionTouched = String(e.target.value || '').trim().length > 0;
        }
        this._checkAdvance();
      }, true);
    },

    _showProjectPrompt() {
      const root = document.getElementById('editor-tutorial-root');
      root?.classList.add('active');
      const backdrop = root?.querySelector('#editor-tutorial-backdrop');
      if (backdrop) backdrop.hidden = false;

      const card = document.getElementById('editor-tutorial-card');
      const spotlight = document.getElementById('editor-tutorial-spotlight');
      if (card) card.hidden = false;
      if (spotlight) spotlight.hidden = false;

      const tr = (k, p) => (typeof t === 'function' ? t(k, p) : k);
      document.getElementById('editor-tutorial-step-label').textContent = tr('tutorial.preparation');
      document.getElementById('editor-tutorial-title').textContent = tr('tutorial.createProjectTitle');
      document.getElementById('editor-tutorial-text').textContent = tr('tutorial.createProjectText');
      document.getElementById('editor-tutorial-wait').textContent = tr('tutorial.createProjectWait');

      this._elevateTargets(['.header-buttons .btn-info']);
      this._positionUi(['.header-buttons .btn-info']);
      this._startPolling();
    },

    onProjectReady() {
      if (!this.waitingForProject || !Editor.data) return;
      this.waitingForProject = false;
      this._flags = {};
      this._step2Phase = 'modal';
      this._runStep(0);
    },

    ensureProject() {
      if (!Editor.data) {
        this.waitingForProject = true;
        this._showProjectPrompt();
        return false;
      }
      return true;
    },

    switchToScenesTab() {
      if (Editor.currentTab === 'scenes') return;
      const tab = document.querySelector('.tab[data-tab-id="scenes"]');
      if (typeof Editor.switchTab === 'function') {
        Editor.switchTab('scenes', tab ? { target: tab } : undefined);
      }
    },

    switchToTab(tabId) {
      if (Editor.currentTab === tabId) return;
      const tab = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
      if (typeof Editor.switchTab === 'function') {
        Editor.switchTab(tabId, tab ? { target: tab } : undefined);
      }
    },

    _runStep(index) {
      if (!this.active) return;
      if (index >= STEPS.length) {
        this.complete();
        return;
      }

      this.index = index;
      this._resetStepFlags(index);
      const step = STEPS[index];
      step.prepare?.(this);

      const root = document.getElementById('editor-tutorial-root');
      root?.classList.add('active');
      const backdrop = root?.querySelector('#editor-tutorial-backdrop');
      if (backdrop) backdrop.hidden = false;

      const tr = (k, p) => (typeof t === 'function' ? t(k, p) : k);
      const stepI18n = {
        'scenes-list': ['tutorial.scenesListTitle', 'tutorial.scenesListText'],
        'scene-form': ['tutorial.sceneFormTitle', 'tutorial.sceneFormText'],
        'npc-panel': ['tutorial.npcTitle', 'tutorial.npcText'],
        dialogue: ['tutorial.dialogueTitle', 'tutorial.dialogueText'],
        choice: ['tutorial.choiceTitle', 'tutorial.choiceText'],
        play: ['tutorial.playTitle', 'tutorial.playText'],
        save: ['tutorial.saveTitle', 'tutorial.saveText']
      }[step.id];
      document.getElementById('editor-tutorial-step-label').textContent =
        tr('tutorial.stepOf', { current: index + 1, total: STEPS.length });
      document.getElementById('editor-tutorial-title').textContent =
        stepI18n ? tr(stepI18n[0]) : step.title;
      document.getElementById('editor-tutorial-text').textContent =
        stepI18n ? tr(stepI18n[1]) : step.text;
      document.getElementById('editor-tutorial-wait').textContent = tr('tutorial.waitAction');

      document.getElementById('editor-tutorial-card').hidden = false;
      document.getElementById('editor-tutorial-spotlight').hidden = false;

      this._scheduleReposition();
      this._startPolling();
    },

    _resetStepFlags(index) {
      const step = STEPS[index];
      if (!step) return;
      if (step.id === 'scenes-list') this._flags.modalOpened = false;
      if (step.id === 'npc-panel') this._flags.npcCreated = false;
      if (step.id === 'play') this._flags.playClicked = false;
      if (step.id === 'save') this._flags.projectSaved = false;
      if (step.id === 'scene-form') {
        this._step2Phase = 'modal';
        this._flags.sceneCommitted = false;
        this._flags.descriptionTouched = false;
      }
    },

    _getStepSelectors(step) {
      const raw = typeof step.selectors === 'function' ? step.selectors() : step.selectors;
      return (raw || []).filter(Boolean);
    },

    _resolveElements(selectors) {
      const found = [];
      selectors.forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => {
          if (el && !found.includes(el)) found.push(el);
        });
      });
      return found;
    },

    _elevateTargets(selectors) {
      this._clearElevated();
      const els = this._resolveElements(selectors);
      els.forEach((el) => {
        el.classList.add('editor-tutorial-target-elevated');
        this._elevated.push(el);
      });
    },

    _clearElevated() {
      this._elevated.forEach((el) => el.classList.remove('editor-tutorial-target-elevated'));
      this._elevated = [];
    },

    _unionRect(elements) {
      if (!elements.length) return null;
      let top = Infinity;
      let left = Infinity;
      let right = -Infinity;
      let bottom = -Infinity;

      elements.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width && !r.height) return;
        top = Math.min(top, r.top);
        left = Math.min(left, r.left);
        right = Math.max(right, r.right);
        bottom = Math.max(bottom, r.bottom);
      });

      if (!Number.isFinite(top)) return null;
      const pad = 8;
      return {
        top: Math.max(0, top - pad),
        left: Math.max(0, left - pad),
        width: Math.min(window.innerWidth, right - left + pad * 2),
        height: Math.min(window.innerHeight, bottom - top + pad * 2)
      };
    },

    _positionUi(selectors) {
      const els = this._resolveElements(selectors);
      this._elevateTargets(selectors);

      const rect = this._unionRect(els);
      const spotlight = document.getElementById('editor-tutorial-spotlight');
      const card = document.getElementById('editor-tutorial-card');

      if (!rect || !spotlight || !card) {
        if (spotlight) spotlight.hidden = true;
        return;
      }

      spotlight.hidden = false;
      spotlight.style.top = `${rect.top}px`;
      spotlight.style.left = `${rect.left}px`;
      spotlight.style.width = `${rect.width}px`;
      spotlight.style.height = `${rect.height}px`;

      const margin = 16;
      const cardRect = card.getBoundingClientRect();
      const cardW = cardRect.width || 360;
      const cardH = cardRect.height || 180;

      let cardTop = rect.bottom + margin;
      let cardLeft = rect.left;
      let arrow = 'arrow-top';

      if (cardTop + cardH > window.innerHeight - margin) {
        cardTop = rect.top - cardH - margin;
        arrow = 'arrow-bottom';
      }
      if (cardLeft + cardW > window.innerWidth - margin) {
        cardLeft = window.innerWidth - cardW - margin;
      }
      if (cardLeft < margin) cardLeft = margin;
      if (cardTop < margin) {
        cardTop = rect.bottom + margin;
        arrow = 'arrow-top';
      }

      card.classList.remove('arrow-top', 'arrow-bottom', 'arrow-left', 'arrow-right');
      card.classList.add(arrow);
      card.style.top = `${cardTop}px`;
      card.style.left = `${cardLeft}px`;
    },

    _scheduleReposition() {
      clearTimeout(this._repositionTimer);
      this._repositionTimer = setTimeout(() => {
        if (!this.active || this.waitingForProject) return;
        const step = STEPS[this.index];
        if (!step) return;
        this._positionUi(this._getStepSelectors(step));
      }, 80);
    },

    _startPolling() {
      clearInterval(this._pollId);
      this._pollId = setInterval(() => this._checkAdvance(), 350);
    },

    _checkAdvance() {
      if (!this.active || this.waitingForProject) return;

      const step = STEPS[this.index];
      if (!step) return;

      if (step.id === 'scene-form') {
        const modal = document.getElementById('template-scene-modal');
        const modalOpen = modal && !modal.classList.contains('hidden');
        this._step2Phase = modalOpen ? 'modal' : 'description';
      }

      if (step.isDone(this)) {
        this._advance();
      } else {
        this._scheduleReposition();
      }
    },

    _advance() {
      clearInterval(this._pollId);
      this._pollId = null;
      const next = this.index + 1;
      if (next >= STEPS.length) {
        this.complete();
      } else {
        this._runStep(next);
      }
    },

    skip(permanent) {
      if (permanent) localStorage.setItem(STORAGE_KEY, '1');
      this._teardown();
    },

    complete() {
      localStorage.setItem(STORAGE_KEY, '1');
      this._teardown();
      if (typeof Editor.showToast === 'function') {
        Editor.showToast(typeof t === 'function' ? t('tutorial.complete') : 'Обучение завершено! Можно продолжать работу над игрой.');
      }
    },

    _teardown() {
      this.active = false;
      this.waitingForProject = false;
      document.body.classList.remove('editor-tutorial-active');
      clearInterval(this._pollId);
      this._pollId = null;
      clearTimeout(this._repositionTimer);
      this._clearElevated();

      const root = document.getElementById('editor-tutorial-root');
      if (root) {
        root.classList.remove('active');
        const card = root.querySelector('#editor-tutorial-card');
        const spotlight = root.querySelector('#editor-tutorial-spotlight');
        const backdrop = root.querySelector('#editor-tutorial-backdrop');
        if (card) card.hidden = true;
        if (spotlight) spotlight.hidden = true;
        if (backdrop) backdrop.hidden = true;
      }
    },

    playTest() {
      if (!Editor.data) return;
      const json = JSON.stringify(Editor.data);
      localStorage.setItem('melnitsa_game_data', json);
      this._flags.playClicked = true;
      window.open('index.html', '_blank', 'noopener');
    },

    restart() {
      localStorage.removeItem(STORAGE_KEY);
      this._teardown();
      this._hooksInstalled = true;
      this.init();
    }
  };

  window.EditorTutorial = EditorTutorial;

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => EditorTutorial.tryStart(), 900);
  });
})();
