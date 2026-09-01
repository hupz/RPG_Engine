// ============================================================
// Author Guidance & Empty States (UI-19)
// Contextual next-step hints — no tutorial overlay.
// ============================================================
(function attachAuthorGuidance() {
  'use strict';

  if (typeof Editor === 'undefined') return;

  const CONTEXT_HINTS = Object.freeze({
    visual: 'Используйте для интерактивных локаций и объектов на сцене.',
    game_ui: 'Используйте для HUD и постоянных элементов управления.',
    conditions: 'Условия определяют, когда что-то доступно игроку.',
    choices: 'Выборы — это действия игрока в текстовой сцене.',
    content: 'Текст сцены и модули задают, что видит игрок.',
    items: 'Предметы выдаются в квестах, сценах и бою.',
    quests: 'Квесты связывают сцены, цели и награды.',
    combat: 'Враги используются в боевых сценах и заданиях.'
  });

  const EMPTY_STATES = Object.freeze({
    project: {
      title: 'Welcome to your RPG project',
      explanation: 'Create your first scene — that is where the game begins.',
      primaryLabel: 'Create First Scene',
      action: 'create-scene'
    },
    scene: {
      title: 'Сцена не открыта',
      explanation: 'Откройте сцену из списка слева или создайте новую.',
      primaryLabel: 'Создать сцену',
      action: 'create-scene'
    },
    content: {
      title: 'Сцена пуста',
      explanation: 'Добавьте текст или модуль, чтобы игрок увидел содержание сцены.',
      primaryLabel: 'Добавить модуль',
      action: 'content-add-module',
      hint: 'content'
    },
    choices: {
      title: 'Нет выборов',
      explanation: 'Добавьте варианты ответа, чтобы игрок мог действовать.',
      primaryLabel: 'Добавить выбор',
      action: 'choices-add',
      hint: 'choices'
    },
    visual: {
      title: 'Нет visual-контента',
      explanation: 'Добавьте фон или интерактивный объект на сцену.',
      primaryLabel: 'Добавить объект',
      action: 'visual-add-hotspot',
      hint: 'visual'
    },
    game_ui: {
      title: 'Нет UI-экранов',
      explanation: 'Создайте HUD или меню — элементы управления для игрока.',
      primaryLabel: 'Создать экран',
      action: 'game-ui-add-screen',
      hint: 'game_ui'
    },
    conditions: {
      title: 'Нет условий',
      explanation: 'Условия управляют видимостью сцены, выборов и объектов.',
      primaryLabel: 'Добавить условие',
      action: 'conditions-add',
      hint: 'conditions'
    },
    items: {
      title: 'Нет предметов',
      explanation: 'Создайте предметы для квестов, наград и инвентаря.',
      primaryLabel: 'Создать предмет',
      action: 'create-item',
      hint: 'items'
    },
    quests: {
      title: 'Нет квестов',
      explanation: 'Задайте цель игроку — квест связывает сцены и награды.',
      primaryLabel: 'Создать квест',
      action: 'create-quest',
      hint: 'quests'
    },
    combat: {
      title: 'Нет врагов',
      explanation: 'Создайте врагов для боевых сцен и заданий.',
      primaryLabel: 'Создать врага',
      action: 'create-enemy',
      hint: 'combat'
    },
    content_category: {
      title: 'Нет объектов',
      explanation: 'Создайте первый объект в этой категории.',
      primaryLabel: 'Создать',
      action: 'create-content'
    }
  });

  function esc(s) {
    return typeof Editor.escapeHtml === 'function'
      ? Editor.escapeHtml(String(s == null ? '' : s))
      : String(s == null ? '' : s);
  }

  function escAttr(s) {
    return typeof Editor.escapeAttr === 'function'
      ? Editor.escapeAttr(String(s == null ? '' : s))
      : esc(s);
  }

  function ensureUi() {
    if (!Editor.workspace) Editor.workspace = {};
    if (!Editor.workspace.ui) Editor.workspace.ui = {};
    if (!Editor.workspace.ui.guidanceDismissed) {
      Editor.workspace.ui.guidanceDismissed = {};
    }
    return Editor.workspace.ui;
  }

  function isHintDismissed(id) {
    return !!ensureUi().guidanceDismissed[id];
  }

  function dismissHint(id) {
    ensureUi().guidanceDismissed[id] = true;
  }

  function runPrimaryAction(actionKey, payload) {
    switch (actionKey) {
      case 'create-scene':
        Editor.openSceneWizard();
        break;
      case 'content-add-module':
        if (typeof Editor.addSceneModule === 'function') Editor.addSceneModule('story');
        Editor.setSceneWorkspaceSection?.('content');
        break;
      case 'choices-add':
        if (typeof Editor.addChoice === 'function') Editor.addChoice();
        else if (typeof Editor.addSceneModule === 'function') Editor.addSceneModule('choices');
        Editor.setSceneWorkspaceSection?.('choices');
        break;
      case 'visual-add-hotspot': {
        const scene = Editor.currentScene && Editor.data?.scenes?.[Editor.currentScene];
        if (scene && !scene.visual) {
          scene.visual = { mode: 'overlay', nodes: [] };
          Editor.markDirty?.();
        }
        if (typeof Editor.visualAddNode === 'function') Editor.visualAddNode('hotspot');
        else if (typeof Editor.renderVisualScenePanel === 'function') Editor.renderVisualScenePanel();
        Editor.setSceneWorkspaceSection?.('visual');
        break;
      }
      case 'game-ui-add-screen':
        if (typeof Editor.uiAddScreen === 'function') Editor.uiAddScreen();
        break;
      case 'conditions-add':
        Editor.setSceneWorkspaceSection?.('conditions');
        break;
      case 'create-item':
        if (typeof Editor.createContentEntity === 'function') Editor.createContentEntity('item');
        else if (typeof Editor.createItem === 'function') Editor.createItem();
        break;
      case 'create-quest':
        if (typeof Editor.createContentEntity === 'function') Editor.createContentEntity('quest');
        else if (typeof Editor.openQuestWizard === 'function') Editor.openQuestWizard();
        else if (typeof Editor.createQuest === 'function') Editor.createQuest();
        break;
      case 'create-enemy':
        if (typeof Editor.createContentEntity === 'function') Editor.createContentEntity('enemy');
        else if (typeof Editor.switchTab === 'function') Editor.switchTab('enemies');
        break;
      case 'create-content':
        if (payload && typeof Editor.createContentEntity === 'function') {
          Editor.createContentEntity(payload);
        }
        break;
      default:
        break;
    }
  }

  function buildEmptyStateHtml(contextKey, overrides) {
    overrides = overrides || {};
    const base = EMPTY_STATES[contextKey] || EMPTY_STATES.content;
    const title = overrides.title || base.title;
    const explanation = overrides.explanation || base.explanation;
    const primaryLabel = overrides.primaryLabel || overrides.ctaLabel || base.primaryLabel;
    const action = overrides.action || base.action;
    const hintKey = overrides.hint || base.hint;
    const hint = hintKey && CONTEXT_HINTS[hintKey]
      ? '<p class="ui-guidance-hint ui-guidance-hint--inline">' + esc(CONTEXT_HINTS[hintKey]) + '</p>'
      : '';

    return (
      '<div class="ui-guidance-empty empty-state" role="status" data-guidance-context="' + escAttr(contextKey) + '">' +
      '<h2 class="ui-guidance-empty__title">' + esc(title) + '</h2>' +
      '<p class="ui-guidance-empty__text">' + esc(explanation) + '</p>' +
      hint +
      '<div class="empty-state__actions ui-guidance-empty__actions">' +
      '<button type="button" class="btn btn-primary ui-guidance-empty__cta" data-guidance-action="' +
      escAttr(action) + '"' +
      (overrides.createType
        ? ' data-guidance-payload="' + escAttr(overrides.createType) +
          '" data-cb2-create="' + escAttr(overrides.createType) + '"'
        : '') +
      '>' + esc(primaryLabel) + '</button>' +
      '</div></div>'
    );
  }

  function bindEmptyStateActions(root) {
    if (!root) return;
    root.querySelectorAll('[data-guidance-action]').forEach((btn) => {
      if (btn._guidanceBound) return;
      btn._guidanceBound = true;
      btn.addEventListener('click', () => {
        runPrimaryAction(btn.getAttribute('data-guidance-action'), btn.getAttribute('data-guidance-payload'));
      });
    });
    root.querySelectorAll('[data-guidance-dismiss]').forEach((btn) => {
      if (btn._guidanceDismissBound) return;
      btn._guidanceDismissBound = true;
      btn.addEventListener('click', () => {
        dismissHint(btn.getAttribute('data-guidance-dismiss'));
        btn.closest('.ui-guidance-hint')?.remove();
      });
    });
  }

  function mountEmptyState(container, contextKey, overrides) {
    if (!container) return null;
    container.innerHTML = buildEmptyStateHtml(contextKey, overrides);
    bindEmptyStateActions(container);
    return container.querySelector('.ui-guidance-empty');
  }

  function renderGuidanceHintHtml(hintId, text) {
    if (!text || isHintDismissed(hintId)) return '';
    return (
      '<p class="ui-guidance-hint" data-guidance-hint-id="' + escAttr(hintId) + '">' +
      esc(text) +
      ' <button type="button" class="ui-guidance-dismiss" data-guidance-dismiss="' + escAttr(hintId) +
      '" title="Скрыть подсказку" aria-label="Скрыть подсказку">×</button></p>'
    );
  }

  function injectSectionHint(sectionId) {
    if (typeof document === 'undefined') return;
    const host = document.getElementById('usw-section-header-host');
    if (!host || host.hidden) return;
    const hintId = 'section-' + sectionId;
    const text = CONTEXT_HINTS[sectionId];
    host.querySelectorAll('.ui-guidance-hint').forEach((el) => el.remove());
    if (!text || isHintDismissed(hintId)) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = renderGuidanceHintHtml(hintId, text);
    const hint = wrap.firstElementChild;
    if (hint) {
      host.appendChild(hint);
      bindEmptyStateActions(host);
    }
  }

  function guidanceReplace(methodName, handler) {
    if (!Editor.hooks?.replace || Editor['_guidanceHook_' + methodName]) return;
    let savedPrev;
    savedPrev = Editor.hooks.replace(methodName, function guidanceWrapper(...args) {
      return handler(savedPrev, args);
    }, 'editor-author-guidance');
    Editor['_guidanceHook_' + methodName] = true;
    return savedPrev;
  }

  function patchIntegrations() {
    if (typeof Editor.renderSceneEmptyState === 'function') {
      guidanceReplace('renderSceneEmptyState', function (prev, args) {
        const container = args[0];
        if (!container) {
          return typeof prev === 'function' ? prev.apply(Editor, args) : undefined;
        }
        const hasProject = !!(Editor.data && Editor.data.scenes);
        const sceneCount = hasProject ? Object.keys(Editor.data.scenes).length : 0;
        if (!Editor.data) {
          mountEmptyState(container, 'project', {
            title: 'Нет открытого проекта',
            explanation: 'Загрузите проект или создайте новый на стартовом экране.',
            primaryLabel: 'Загрузить проект',
            action: 'load-project'
          });
          const btn = container.querySelector('[data-guidance-action="load-project"]');
          if (btn) {
            btn.addEventListener('click', () => Editor.loadData?.());
          }
          return;
        }
        if (sceneCount === 0) {
          mountEmptyState(container, 'project');
          return;
        }
        mountEmptyState(container, 'scene');
      });
    }

    if (typeof Editor.renderQuests === 'function') {
      guidanceReplace('renderQuests', function (prev, args) {
        const c = document.getElementById('quests-editor');
        if (c && Editor.data && typeof Editor.getQuestIds === 'function' && !Editor.getQuestIds().length) {
          mountEmptyState(c, 'quests');
          return;
        }
        return typeof prev === 'function' ? prev.apply(Editor, args) : undefined;
      });
    }

    if (typeof Editor.renderGameUiEditor === 'function') {
      guidanceReplace('renderGameUiEditor', function (prev, args) {
        const ui = Editor.data?.ui;
        const screens = ui && ui.screens ? Object.keys(ui.screens) : [];
        if (Editor.data && !screens.length) {
          const host = document.getElementById('game-ui-editor-root');
          if (host) {
            mountEmptyState(host, 'game_ui');
            return;
          }
        }
        if (typeof prev === 'function') prev.apply(Editor, args);
        const host = document.getElementById('game-ui-editor-root');
        if (host) bindEmptyStateActions(host);
      });
    }

    if (typeof Editor.renderItems === 'function') {
      guidanceReplace('renderItems', function (prev, args) {
        const c = document.getElementById('items-editor');
        if (c && Editor.data && (!Editor.data.items || !Object.keys(Editor.data.items).length)) {
          mountEmptyState(c, 'items');
          return;
        }
        return typeof prev === 'function' ? prev.apply(Editor, args) : undefined;
      });
    }

    if (typeof Editor.renderEnemies === 'function') {
      guidanceReplace('renderEnemies', function (prev, args) {
        const c = document.getElementById('enemies-editor');
        if (c && Editor.data && (!Editor.data.enemies || !Object.keys(Editor.data.enemies).length)) {
          mountEmptyState(c, 'combat');
          return;
        }
        return typeof prev === 'function' ? prev.apply(Editor, args) : undefined;
      });
    }

    if (typeof Editor.setSceneWorkspaceSection === 'function' && Editor.hooks?.after && !Editor._guidanceSectionPatched) {
      Editor._guidanceSectionPatched = true;
      Editor.hooks.after('setSceneWorkspaceSection', function (result, args) {
        const sectionId = args && args[0];
        if (sectionId) injectSectionHint(sectionId);
        return result;
      }, 'editor-author-guidance');
    }
  }

  const AuthorGuidance = {
    CONTEXT_HINTS,
    EMPTY_STATES,
    getEmptyStateDef(contextKey) {
      return EMPTY_STATES[contextKey] ? Object.assign({}, EMPTY_STATES[contextKey]) : null;
    },
    getContextHint(contextKey) {
      return CONTEXT_HINTS[contextKey] || '';
    },
    buildEmptyStateHtml,
    mountEmptyState,
    renderGuidanceHintHtml,
    injectSectionHint,
    bindEmptyStateActions,
    runPrimaryAction,
    dismissHint,
    isHintDismissed
  };

  Editor.AuthorGuidance = AuthorGuidance;
  Editor.renderAuthorEmptyState = mountEmptyState;
  Editor.runAuthorGuidanceAction = runPrimaryAction;

  patchIntegrations();

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-author-guidance', AuthorGuidance, { force: true });
  }

  console.info('[Editor.AuthorGuidance] ready');
})();
