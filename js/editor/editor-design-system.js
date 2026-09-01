// ============================================================
// Editor Design System (UI-5 + UI-10) — boot, density, components
// Presentation only; does not mutate project JSON.
// ============================================================
(function attachEditorDesignSystem() {
  'use strict';

  if (typeof Editor === 'undefined') return;

  const EDS_FLAG = 'eds';
  const UI_FLAG = 'ui';

  function isEdsActive() {
    return typeof document !== 'undefined' &&
      document.body &&
      document.body.dataset[EDS_FLAG] === '1';
  }

  function isUiActive() {
    return typeof document !== 'undefined' &&
      document.body &&
      document.body.dataset[UI_FLAG] === '1';
  }

  function markEdsActive() {
    if (typeof document === 'undefined' || !document.body) return;
    document.body.dataset[EDS_FLAG] = '1';
    document.body.dataset[UI_FLAG] = '1';
  }

  const UI_SHELL_TARGETS = [
    { sel: '.editor-nav', cls: 'ui-shell' },
    { sel: '#context-sidebar', cls: 'ui-shell' },
    { sel: '#editor-inspector', cls: 'ui-shell' },
    { sel: '.usw-root', cls: 'ui-shell' },
    { sel: '.header-buttons', cls: 'ui-toolbar' }
  ];

  function applyUiShellClasses() {
    if (typeof document === 'undefined' || !isUiActive()) return;
    UI_SHELL_TARGETS.forEach(({ sel, cls }) => {
      document.querySelectorAll(sel).forEach((el) => {
        el.classList.add(cls);
        if (cls === 'ui-panel') el.classList.add('ui-panel');
      });
    });
    const main = document.querySelector('.main-area');
    if (main) main.classList.add('ui-panel');
  }

  function applyDensityClasses() {
    if (typeof document === 'undefined' || !document.body) return;
    const writer = typeof Editor.isWriterMode === 'function' && Editor.isWriterMode();
    const advanced = typeof Editor.isEditorAdvancedMode === 'function' && Editor.isEditorAdvancedMode();
    document.body.classList.toggle('editor-density-writer', !!writer);
    document.body.classList.toggle('editor-density-advanced', !!advanced);
  }

  function renderSceneEmptyState(container) {
    if (!container) return;
    const hasProject = !!(Editor.data && Editor.data.scenes);
    const sceneCount = hasProject ? Object.keys(Editor.data.scenes).length : 0;
    let html = '<div class="empty-state eds-empty-scene" role="status">';
    if (!Editor.data) {
      html += '<h2>Нет открытого проекта</h2>';
      html += '<p>Загрузите проект или создайте новый на стартовом экране.</p>';
    } else if (sceneCount === 0) {
      html += '<h2>Добро пожаловать в проект</h2>';
      html += '<p>Создайте первую сцену — основу сюжета и геймплея.</p>';
      html += '<div class="empty-state__actions">';
      html += '<button type="button" class="btn btn-primary" onclick="Editor.openSceneWizard()">Создать первую сцену</button>';
      html += '</div>';
    } else {
      html += '<h2>Сцена не открыта</h2>';
      html += '<p>Откройте сцену из списка слева или создайте новую.</p>';
      html += '<div class="empty-state__actions">';
      html += '<button type="button" class="btn btn-primary" onclick="Editor.openSceneWizard()">+ Новая сцена</button>';
      html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
  }

  function patchInspectorEmptyState() {
    if (!Editor.Inspector || Editor.Inspector._edsEmptyPatched) return;
    const orig = Editor.Inspector.render.bind(Editor.Inspector);
    Editor.Inspector.render = function patchedInspectorRender() {
      orig();
      const body = document.getElementById('editor-inspector-body');
      if (!body || Editor.Inspector.selection) return;
      const tab = Editor.currentTab;
      let hint = 'Выберите объект в рабочей области.';
      if (tab === 'scenes') {
        hint = Editor.currentScene
          ? 'Выберите visual-элемент, выбор или карточку — свойства появятся здесь.'
          : 'Откройте сцену — здесь будут свойства выбранного объекта.';
      } else if (tab === 'game_ui') {
        hint = 'Выберите UI-элемент на холсте.';
      }
      const empty = body.querySelector('.editor-inspector-empty');
      if (empty) {
        const p = empty.querySelector('p');
        if (p) p.textContent = hint;
        const p2 = empty.querySelector('p:nth-child(2)');
        if (p2 && tab === 'scenes') {
          p2.textContent = 'Свойства сцены — в документе; детали выбора — в карточке.';
        }
      }
    };
    Editor.Inspector._edsEmptyPatched = true;
  }

  function boot() {
    markEdsActive();
    applyDensityClasses();
    applyUiShellClasses();
    patchInspectorEmptyState();
    if (typeof Editor.applyContextLayoutClasses === 'function') {
      try { Editor.applyContextLayoutClasses(); } catch (e) { /* */ }
    }
  }

  Object.assign(Editor, {
    isDesignSystemActive: isEdsActive,
    isUiDesignSystemActive: isUiActive,
    applyEditorDensityClasses: applyDensityClasses,
    applyUiShellClasses,
    renderSceneEmptyState
  });

  if (Editor.hooks && typeof Editor.hooks.after === 'function') {
    Editor.hooks.after('applyEditorMode', function () {
      applyDensityClasses();
      applyUiShellClasses();
    });
    Editor.hooks.after('switchTab', function () {
      applyDensityClasses();
      applyUiShellClasses();
      if (Editor.Inspector) Editor.Inspector.render();
    });
    Editor.hooks.after('renderSceneList', function () {
      applyUiShellClasses();
    });
    Editor.hooks.after('renderUnifiedSceneWorkspace', function () {
      applyUiShellClasses();
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-design-system', {
      applyEditorDensityClasses: Editor.applyEditorDensityClasses,
      applyUiShellClasses: Editor.applyUiShellClasses,
      renderSceneEmptyState: Editor.renderSceneEmptyState,
      isUiDesignSystemActive: Editor.isUiDesignSystemActive
    }, { force: true });
  }

  console.info('[Editor.DesignSystem] ready');
})();
