// ============================================================
// Unified Scene Workspace (UI-7) — orchestration layer only
// Reuses existing scene / visual / choices editors; no schema/runtime changes.
// ============================================================
(function attachUnifiedSceneWorkspace() {
  'use strict';

  if (typeof Editor === 'undefined') return;

  const SECTIONS = [
    { id: 'overview', label: 'Обзор', icon: '◎' },
    { id: 'content', label: 'Контент', icon: '📝', region: 'content' },
    { id: 'choices', label: 'Выборы', icon: '🔀', region: 'choices', module: 'choices' },
    { id: 'visual', label: 'Visual', icon: '🖼', region: 'visual', module: 'visual' },
    { id: 'game_ui', label: 'Game UI', icon: '🖥', region: 'game_ui' },
    { id: 'conditions', label: 'Условия', icon: '⛓', region: 'conditions' },
    { id: 'advanced', label: 'Advanced', icon: '⚙', region: 'advanced', advancedOnly: true }
  ];

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

  function isAdvanced() {
    return typeof Editor.isEditorAdvancedMode === 'function' && Editor.isEditorAdvancedMode();
  }

  function ensureWsState() {
    if (!Editor.workspace) Editor.workspace = { open: [], activeId: null };
    if (!Editor.workspace.sceneWs) {
      Editor.workspace.sceneWs = { enabled: false, section: 'overview', selection: null };
    }
    if (!('selection' in Editor.workspace.sceneWs)) {
      Editor.workspace.sceneWs.selection = null;
    }
    return Editor.workspace.sceneWs;
  }

  function getScene(sceneId) {
    const id = sceneId || Editor.currentScene;
    return id && Editor.data?.scenes?.[id] ? Editor.data.scenes[id] : null;
  }

  function getSceneKind(scene) {
    if (typeof Editor.getSceneContentKind === 'function') {
      return Editor.getSceneContentKind(scene);
    }
    const s = scene;
    const hasVisual = !!(s?.visual?.nodes?.length || s?.visual?.background?.asset);
    const hasText = !!(s?.text || s?.choices?.length);
    if (hasVisual && hasText) return 'mixed';
    if (hasVisual) return 'visual';
    return 'text';
  }

  function countChoices(scene) {
    return Array.isArray(scene?.choices) ? scene.choices.length : 0;
  }

  function countVisualNodes(scene) {
    return scene?.visual?.nodes?.length || 0;
  }

  function countConditions(scene) {
    let n = 0;
    if (scene?.showIf) n++;
    (scene?.choices || []).forEach((c) => {
      if (c.showIf || c.hideIf) n++;
    });
    (scene?.visual?.nodes || []).forEach((node) => {
      if (node.showIf) n++;
    });
    return n;
  }

  function sectionCount(section, scene) {
    if (section.id === 'choices') return countChoices(scene);
    if (section.id === 'visual') return countVisualNodes(scene);
    if (section.id === 'conditions') return countConditions(scene);
    return null;
  }

  function ensureShell() {
    if (typeof document === 'undefined') return null;
    const root = document.getElementById('scene-editor');
    if (!root) return null;
    let shell = document.getElementById('usw-root');
    if (shell) return shell;

    shell = document.createElement('div');
    shell.id = 'usw-root';
    shell.className = 'usw-root';

    const layout = document.createElement('div');
    layout.className = 'usw-layout';

    const outline = document.createElement('aside');
    outline.className = 'usw-outline';
    outline.id = 'usw-outline';
    outline.setAttribute('aria-label', 'Структура сцены');

    const canvas = document.createElement('div');
    canvas.className = 'usw-canvas';

    ['overview', 'game_ui', 'conditions', 'advanced'].forEach((pid) => {
      const panel = document.createElement('div');
      panel.className = 'usw-section-panel';
      panel.id = 'usw-panel-' + pid;
      panel.dataset.uswPanel = pid;
      panel.hidden = true;
      canvas.appendChild(panel);
    });

    const mount = document.createElement('div');
    mount.id = 'usw-canvas-mount';
    mount.className = 'usw-canvas-mount';
    canvas.appendChild(mount);

    layout.appendChild(outline);
    layout.appendChild(canvas);
    shell.appendChild(layout);

    root.innerHTML = '';
    root.appendChild(shell);
    return shell;
  }

  function renderOutline(sceneId) {
    const outline = document.getElementById('usw-outline');
    const scene = getScene(sceneId);
    if (!outline || !scene) return;

    const ws = ensureWsState();
    const active = ws.section || 'overview';

    let html = '<div class="usw-outline__title">SCENE</div><ul class="usw-outline__list" role="tree">';
    SECTIONS.forEach((sec) => {
      if (sec.advancedOnly && !isAdvanced()) return;
      const cnt = sectionCount(sec, scene);
      const label = cnt != null && cnt > 0 ? sec.label + ' (' + cnt + ')' : sec.label;
      const isActive = sec.id === active;
      const emptyHint = (sec.id === 'choices' && cnt === 0) || (sec.id === 'visual' && cnt === 0);
      html += '<li class="usw-outline__item' + (isActive ? ' is-active' : '') + '">' +
        '<button type="button" class="usw-outline__btn" data-usw-section="' + escAttr(sec.id) + '"' +
        ' aria-current="' + (isActive ? 'page' : 'false') + '">' +
        '<span class="usw-outline__icon" aria-hidden="true">' + sec.icon + '</span>' +
        '<span class="usw-outline__label">' + esc(label) + '</span></button>';
      if (emptyHint && isActive) {
        html += '<div class="usw-outline__empty hint">Пусто — добавьте ниже</div>';
      }
      html += '</li>';
    });
    html += '</ul>';

    if (!outline.dataset.bound) {
      outline.dataset.bound = '1';
      outline.addEventListener('click', (ev) => {
        const btn = ev.target.closest('[data-usw-section]');
        if (!btn) return;
        Editor.setSceneWorkspaceSection(btn.getAttribute('data-usw-section'));
      });
    }
    outline.innerHTML = html;
  }

  function renderOverviewPanel(sceneId) {
    const panel = document.getElementById('usw-panel-overview');
    const scene = getScene(sceneId);
    if (!panel || !scene) return;
    const kind = getSceneKind(scene);
    const kindLabel = kind === 'mixed' ? 'TEXT + VISUAL' : kind === 'visual' ? 'Visual Scene' : 'TEXT Scene';
    const choices = countChoices(scene);
    const nodes = countVisualNodes(scene);
    const warnings = typeof Editor.getSceneValidationIssues === 'function'
      ? (Editor.getSceneValidationIssues(sceneId) || []).filter((i) => i.level === 'warning').length
      : 0;

    panel.innerHTML =
      '<div class="usw-overview-card">' +
      '<h3 class="usw-overview__title">' + esc(scene.location || scene.title || sceneId) + '</h3>' +
      '<p class="usw-overview__kind">' + esc(kindLabel) + '</p>' +
      (warnings ? '<p class="usw-overview__warn">⚠ ' + warnings + ' предупр.</p>' : '') +
      (isAdvanced() ? '<p class="hint usw-overview__id">ID: <code>' + esc(sceneId) + '</code></p>' : '') +
      '<dl class="usw-overview__stats">' +
      '<div><dt>Текст</dt><dd>' + (scene.text ? 'есть' : '—') + '</dd></div>' +
      '<div><dt>Выборы</dt><dd>' + choices + '</dd></div>' +
      '<div><dt>Visual</dt><dd>' + nodes + ' nodes</dd></div>' +
      '</dl>' +
      '<div class="usw-overview__actions">' +
      '<button type="button" class="btn btn-primary btn-sm" data-usw-goto="content">Редактировать текст</button> ' +
      (choices ? '<button type="button" class="btn btn-secondary btn-sm" data-usw-goto="choices">Выборы</button> ' : '') +
      (nodes || kind !== 'text' ? '<button type="button" class="btn btn-secondary btn-sm" data-usw-goto="visual">Visual</button>' : '') +
      '</div></div>';

    panel.querySelectorAll('[data-usw-goto]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Editor.setSceneWorkspaceSection(btn.getAttribute('data-usw-goto'));
      });
    });
  }

  function renderGameUiPanel(sceneId) {
    const panel = document.getElementById('usw-panel-game_ui');
    if (!panel) return;
    const screens = Editor.data?.ui?.screens ? Object.keys(Editor.data.ui.screens) : [];
    panel.innerHTML =
      '<div class="usw-panel-card">' +
      '<h3>Game UI</h3>' +
      '<p class="hint">Экраны HUD и меню редактируются в разделе «Игровой UI». Здесь — быстрый переход.</p>' +
      (screens.length
        ? '<ul class="usw-simple-list">' + screens.map((id) =>
          '<li><button type="button" class="btn btn-ghost btn-sm" data-usw-open-ui="' + escAttr(id) + '">' +
          esc(Editor.data.ui.screens[id]?.name || id) + '</button></li>'
        ).join('') + '</ul>'
        : '<p class="hint">Нет UI-экранов. <button type="button" class="btn btn-secondary btn-sm" id="usw-add-ui">Создать экран</button></p>') +
      '<button type="button" class="btn btn-secondary btn-sm" id="usw-open-game-ui-tab">Открыть редактор UI →</button>' +
      '</div>';

    panel.querySelector('#usw-open-game-ui-tab')?.addEventListener('click', () => {
      Editor.switchTab?.('game_ui');
    });
    panel.querySelector('#usw-add-ui')?.addEventListener('click', () => {
      Editor.switchTab?.('game_ui');
      Editor.uiAddScreen?.();
    });
    panel.querySelectorAll('[data-usw-open-ui]').forEach((btn) => {
      btn.addEventListener('click', () => {
        Editor.switchTab?.('game_ui');
        Editor.uiSelectScreen?.(btn.getAttribute('data-usw-open-ui'));
      });
    });
  }

  function renderConditionsPanel(sceneId) {
    const panel = document.getElementById('usw-panel-conditions');
    const scene = getScene(sceneId);
    if (!panel || !scene) return;
    const items = [];
    if (scene.showIf) items.push({ label: 'Видимость сцены', detail: 'showIf задано' });
    (scene.choices || []).forEach((c, i) => {
      if (c.showIf || c.hideIf) items.push({ label: 'Выбор ' + (i + 1), detail: c.text || '—' });
    });
    panel.innerHTML =
      '<div class="usw-panel-card">' +
      '<h3>Условия</h3>' +
      (items.length
        ? '<ul class="usw-simple-list">' + items.map((it) =>
          '<li><strong>' + esc(it.label) + '</strong><span class="hint">' + esc(it.detail) + '</span></li>'
        ).join('') + '</ul>'
        : '<div class="usw-panel-empty" data-usw-conditions-empty="1"></div>') +
      '<p class="hint">Подробное редактирование — в секциях Выборы и Visual.</p></div>';
    if (!items.length && typeof Editor.renderAuthorEmptyState === 'function') {
      const host = panel.querySelector('[data-usw-conditions-empty]');
      if (host) Editor.renderAuthorEmptyState(host, 'conditions');
    }
  }

  function renderAdvancedPanel(sceneId) {
    const panel = document.getElementById('usw-panel-advanced');
    const scene = getScene(sceneId);
    if (!panel || !scene) return;
    panel.innerHTML =
      '<div class="usw-panel-card">' +
      '<h3>Advanced</h3>' +
      '<p class="hint">ID: <code>' + esc(sceneId) + '</code></p>' +
      '<p class="hint">Тип: <code>' + esc(scene.sceneType || 'custom') + '</code></p>' +
      '<p class="hint">Модули: ' + esc((scene.editorModules || []).join(', ') || '—') + '</p>' +
      '<button type="button" class="btn btn-secondary btn-sm" onclick="Editor.switchTab(\'json\')">Данные проекта →</button>' +
      '</div>';
  }

  function applySectionVisibility(sectionId) {
    const mount = document.getElementById('usw-canvas-mount');
    const builder = mount?.querySelector('.scene-builder');
    const ws = ensureWsState();

    document.querySelectorAll('[data-usw-panel]').forEach((p) => {
      p.hidden = p.dataset.uswPanel !== sectionId;
    });

    if (mount) mount.hidden = sectionId === 'overview' || sectionId === 'game_ui' ||
      sectionId === 'conditions' || sectionId === 'advanced';

    if (!builder) return;

    hideInlineEmpty(builder);

    const regions = {
      content: ['.scene-builder-core', '[data-module="story"]', '[data-module="npc"]', '[data-module="dialogue"]'],
      choices: ['[data-module="choices"]', '.choices-section'],
      visual: ['#visual-scene-editor-panel'],
      advanced: ['[data-module="components"]', '[data-module="elements"]', '.scene-builder-add', '.scene-module-picker']
    };

    builder.querySelectorAll('.scene-builder-core, .scene-module-card, #visual-scene-editor-panel, .scene-builder-add, .scene-module-picker, .scene-modules-empty')
      .forEach((el) => { el.style.display = 'none'; });

    if (sectionId === 'content') {
      regions.content.forEach((sel) => {
        builder.querySelectorAll(sel).forEach((el) => { el.style.display = ''; });
      });
      builder.querySelector('.scene-builder-add') && (builder.querySelector('.scene-builder-add').style.display = '');
      const scene = getScene();
      if (scene && !scene.text && !sceneHasModule('story') && !sceneHasModule('npc')) {
        showEmptySection(builder, 'content', '+ Добавить текст', () => {
          const ta = builder.querySelector('[data-field="text"], textarea[name="text"], .scene-text-input');
          if (ta) ta.focus();
          else if (typeof Editor.addSceneModule === 'function') Editor.addSceneModule('story');
        });
      }
    } else if (sectionId === 'choices') {
      regions.choices.forEach((sel) => {
        builder.querySelectorAll(sel).forEach((el) => { el.style.display = ''; });
      });
      if (!builder.querySelector('[data-module="choices"]') && !builder.querySelector('.choices-section')) {
        showEmptySection(builder, 'choices', '+ Добавить выборы', () => {
          if (!sceneHasModule('choices')) Editor.addSceneModule?.('choices');
          Editor.setSceneWorkspaceSection('choices');
        });
      }
    } else if (sectionId === 'visual') {
      regions.visual.forEach((sel) => {
        builder.querySelectorAll(sel).forEach((el) => { el.style.display = ''; });
      });
      Editor.renderVisualScenePanel?.();
      if (countVisualNodes(getScene()) === 0) {
        showEmptySection(builder, 'visual', '+ Добавить Visual', () => {
          const scene = getScene();
          if (scene && !scene.visual) {
            scene.visual = { mode: 'overlay', nodes: [] };
            Editor.markDirty?.();
          }
          Editor.renderVisualScenePanel?.();
          Editor.setSceneWorkspaceSection('visual');
        });
      }
    } else if (sectionId === 'advanced') {
      regions.advanced.forEach((sel) => {
        builder.querySelectorAll(sel).forEach((el) => { el.style.display = ''; });
      });
      builder.querySelector('.scene-builder-core') && (builder.querySelector('.scene-builder-core').style.display = '');
    }

    ws.section = sectionId;
  }

  function sceneHasModule(moduleId) {
    const scene = getScene();
    return Array.isArray(scene?.editorModules) && scene.editorModules.includes(moduleId);
  }

  function showEmptySection(builder, kind, ctaLabel, onClick) {
    let empty = builder.querySelector('.usw-inline-empty');
    if (!empty) {
      empty = document.createElement('div');
      empty.className = 'usw-inline-empty';
      builder.appendChild(empty);
    }
    empty.style.display = '';
    if (typeof Editor.renderAuthorEmptyState === 'function') {
      Editor.renderAuthorEmptyState(empty, kind, {
        primaryLabel: ctaLabel,
        onPrimary: onClick
      });
      const btn = empty.querySelector('.ui-guidance-empty__cta');
      if (btn && typeof onClick === 'function') {
        const cta = btn.cloneNode(true);
        btn.replaceWith(cta);
        cta.addEventListener('click', onClick);
      }
      return;
    }
    const copy = kind === 'choices'
      ? '<p class="usw-empty__title">Нет выборов</p><p class="hint">Добавьте варианты ответа игрока.</p>'
      : kind === 'visual'
        ? '<p class="usw-empty__title">Нет visual-контента</p><p class="hint">Добавьте фон или интерактивные объекты.</p>'
        : kind === 'content'
          ? '<p class="usw-empty__title">Сцена пуста</p><p class="hint">Добавьте текст или модуль сцены.</p>'
          : '<p class="hint">Секция пуста</p>';
    empty.innerHTML = copy +
      '<button type="button" class="btn btn-primary btn-sm usw-inline-empty__cta">' + esc(ctaLabel) + '</button>';
    empty.querySelector('.usw-inline-empty__cta')?.addEventListener('click', onClick);
  }

  function hideInlineEmpty(builder) {
    builder?.querySelector('.usw-inline-empty')?.remove();
  }

  function renderUnifiedSceneWorkspace(sceneId) {
    if (!ensureWsState().enabled) return;
    const id = sceneId || Editor.currentScene;
    if (!id || !getScene(id)) return;

    ensureShell();
    renderOutline(id);
    renderOverviewPanel(id);
    renderGameUiPanel(id);
    renderConditionsPanel(id);
    renderAdvancedPanel(id);

    const section = ensureWsState().section || 'overview';
    applySectionVisibility(section);

    if (typeof Editor.injectSceneWorkspaceChrome === 'function') {
      Editor.injectSceneWorkspaceChrome();
    }
    if (typeof Editor.injectSceneContextNav === 'function') {
      Editor.injectSceneContextNav(id);
    }
    document.body.classList.add('editor-usw-active');
    if (Editor.hooks?.emit) {
      try { Editor.hooks.emit('after', 'renderUnifiedSceneWorkspace', [id]); } catch (e) { /* */ }
    }
  }

  function openSceneWorkspace(sceneId, opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    if (!sceneId || !Editor.data?.scenes?.[sceneId]) return false;
    const ws = ensureWsState();
    const prevScene = Editor.currentScene;
    ws.enabled = true;
    ws.section = opts.section || 'overview';

    if (typeof Editor.switchTab === 'function') Editor.switchTab('scenes');
    ensureShell();

    if (typeof Editor.openSceneDocument === 'function') {
      Editor.openSceneDocument(sceneId);
    } else if (typeof Editor.selectScene === 'function') {
      Editor.selectScene(sceneId);
    }

    if (prevScene && prevScene !== sceneId && typeof Editor.clearSceneWorkspaceSelection === 'function') {
      Editor.clearSceneWorkspaceSelection();
    }

    if (typeof Editor.renderSceneEditor === 'function') Editor.renderSceneEditor();
    renderUnifiedSceneWorkspace(sceneId);
    if (opts.section && typeof Editor.setSceneWorkspaceSection === 'function') {
      Editor.setSceneWorkspaceSection(opts.section);
    }
    return true;
  }

  Object.assign(Editor, {
    isUnifiedSceneWorkspaceActive() {
      return !!(ensureWsState().enabled && Editor.currentTab === 'scenes' && Editor.currentScene);
    },

    getSceneWorkspaceSection() {
      return ensureWsState().section || 'overview';
    },

    setSceneWorkspaceSection(sectionId) {
      if (!SECTIONS.some((s) => s.id === sectionId)) return;
      if (sectionId === 'advanced' && !isAdvanced()) return;
      ensureWsState().section = sectionId;
      applySectionVisibility(sectionId);
      renderOutline(Editor.currentScene);
      if (sectionId === 'overview') renderOverviewPanel(Editor.currentScene);
      // Navigation only — no history mutation
    },

    openSceneWorkspace,
    renderUnifiedSceneWorkspace,

    getSceneWorkspaceSections() {
      return SECTIONS.slice();
    }
  });

  // Wrap renderSceneEditor
  if (Editor.hooks?.replace) {
    const baseRender = Editor.hooks.getImpl('renderSceneEditor');
    if (typeof baseRender === 'function') {
      Editor.hooks.replace('renderSceneEditor', function uswRenderSceneEditor() {
        const result = baseRender.apply(this, arguments);
        if (Editor.isUnifiedSceneWorkspaceActive()) {
          try { renderUnifiedSceneWorkspace(Editor.currentScene); } catch (e) {
            console.warn('[usw]', e);
          }
        }
        return result;
      }, 'editor-scene-workspace');
    }
  }

  // Route openSceneDocument through unified workspace when scenes tab
  if (Editor.hooks?.after) {
    Editor.hooks.after('openSceneDocument', function (_r, args) {
      const raw = args && args[0];
      if (!raw) return;
      ensureWsState().enabled = true;
      if (!ensureWsState().section) ensureWsState().section = 'overview';
      ensureShell();
      try { renderUnifiedSceneWorkspace(raw); } catch (e) { /* */ }
    }, 'editor-scene-workspace');

    Editor.hooks.after('selectScene', function () {
      if (ensureWsState().enabled && Editor.currentScene) {
        renderUnifiedSceneWorkspace(Editor.currentScene);
      }
    }, 'editor-scene-workspace');
  }

  function ensureStyles() {
    if (typeof document === 'undefined' || document.getElementById('usw-styles')) return;
    if (document.querySelector('link#editor-design-system-css, link[href*="editor-design-system"]')) return;
    const st = document.createElement('style');
    st.id = 'usw-styles';
    st.textContent = `
      .usw-root { display:flex; flex-direction:column; min-height:0; flex:1; }
      .usw-layout { display:flex; gap:0; min-height:0; flex:1; align-items:stretch; }
      .usw-outline { width:200px; flex-shrink:0; border-right:1px solid var(--border); padding:8px 6px; overflow-y:auto; }
      .usw-outline__title { font-size:10px; font-weight:700; letter-spacing:.06em; color:var(--ink-faint); padding:4px 8px; }
      .usw-outline__list { list-style:none; margin:0; padding:0; }
      .usw-outline__btn { display:flex; align-items:center; gap:8px; width:100%; padding:6px 8px; border:none; border-radius:4px; background:transparent; cursor:pointer; text-align:left; color:var(--ink-light); font-size:12px; }
      .usw-outline__btn:hover, .usw-outline__item.is-active .usw-outline__btn { background:var(--highlight); color:var(--ink); }
      .usw-canvas { flex:1; min-width:0; overflow-y:auto; padding:0 4px; }
      .usw-canvas-mount { min-height:120px; }
      .usw-overview-card, .usw-panel-card { padding:12px 8px; }
      .usw-overview__title { margin:0 0 4px; font-size:17px; }
      .usw-overview__kind { color:var(--ink-light); font-size:12px; margin:0 0 8px; }
      .usw-simple-list { list-style:none; padding:0; margin:8px 0; }
      body.editor-usw-active #scene-editor { display:flex; flex-direction:column; min-height:0; }
    `;
    document.head.appendChild(st);
  }

  ensureStyles();

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-scene-workspace', {
      openSceneWorkspace: Editor.openSceneWorkspace,
      setSceneWorkspaceSection: Editor.setSceneWorkspaceSection,
      isUnifiedSceneWorkspaceActive: Editor.isUnifiedSceneWorkspaceActive
    }, { force: true });
  }

  console.info('[Editor.SceneWorkspace] ready');
})();
