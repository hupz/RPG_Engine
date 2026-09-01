// ============================================================
// Editor Context UI — Content Browser + Contextual Inspector (UI-4)
// Separates: CONTENT (browser) | WORKSPACE (open docs) | INSPECTOR (selection)
// Session state only — does not mutate project JSON.
// ============================================================
(function attachEditorContextUi() {
  'use strict';

  if (typeof Editor === 'undefined') return;

  const IDX = typeof EditorContentIndex !== 'undefined' ? EditorContentIndex : null;

  /** Nav section id → content browser category (null = full-width tab, no sidebar browser) */
  const SECTION_CATEGORY = {
    scenes: 'scenes',
    items: 'items',
    quests: 'quests',
    npcs: 'npcs',
    enemies: 'enemies',
    game_ui: 'ui_screens',
    assets: 'assets',
    story: null,
    world: null,
    achievements: null,
    classes: null,
    abilities: null,
    craft: null,
    settings: null
  };

  /** Tabs that use the full workspace width — never show the content sidebar */
  const FULL_WIDTH_TABS = new Set([
    'dashboard', 'graph', 'world', 'worldmap', 'scene_templates',
    'classes', 'abilities', 'balance', 'beasts', 'progression', 'races',
    'actions', 'climate', 'json', 'variables', 'prefabs', 'reputation',
    'analytics', 'theme', 'ingredients', 'recipes', 'snippets', 'achievements'
  ]);

  const SECTION_LABELS = {
    scenes: 'Сцены',
    items: 'Предметы',
    quests: 'Квесты',
    npcs: 'NPC',
    enemies: 'Враги',
    game_ui: 'Game UI',
    assets: 'Ассеты',
    story: 'Карта сюжета',
    world: 'Мир',
    settings: 'Контент'
  };

  function esc(s) {
    return typeof Editor.escapeHtml === 'function'
      ? Editor.escapeHtml(String(s == null ? '' : s))
      : String(s == null ? '' : s);
  }

  function isWriter() {
    return typeof Editor.isWriterMode === 'function' && Editor.isWriterMode();
  }

  function isAdvanced() {
    return typeof Editor.isEditorAdvancedMode === 'function' && Editor.isEditorAdvancedMode();
  }

  function ensureUiState() {
    if (!Editor.workspace) Editor.workspace = { open: [], activeId: null };
    if (!Editor.workspace.ui) {
      Editor.workspace.ui = {
        sidebarCollapsed: false,
        inspectorCollapsed: false,
        inspectorSections: {}
      };
    }
    return Editor.workspace.ui;
  }

  function getSectionExpanded(key, defaultOpen) {
    const ui = ensureUiState();
    if (Object.prototype.hasOwnProperty.call(ui.inspectorSections, key)) {
      return !!ui.inspectorSections[key];
    }
    return defaultOpen !== false;
  }

  function setSectionExpanded(key, open) {
    ensureUiState().inspectorSections[key] = !!open;
  }

  function findSectionForTab(tab) {
    if (typeof Editor.getNavSectionForTab === 'function') {
      return Editor.getNavSectionForTab(tab);
    }
    return TAB_SECTION[tab] || null;
  }

  /** Minimal tab → section map (mirrors editor-nav-layout.js) */
  const TAB_SECTION = {
    scenes: { id: 'scenes', showSceneList: true },
    scene_templates: { id: 'scenes', showSceneList: false },
    items: { id: 'items' },
    quests: { id: 'quests' },
    npcs: { id: 'npcs' },
    enemies: { id: 'enemies' },
    player_characters: { id: 'npcs' },
    game_ui: { id: 'game_ui' },
    media: { id: 'assets' },
    audio: { id: 'assets' },
    theme: { id: 'assets' },
    graph: { id: 'story' },
    world: { id: 'world' },
    worldmap: { id: 'world' },
    json: { id: 'settings' },
    variables: { id: 'settings' },
    prefabs: { id: 'settings' },
    classes: { id: 'classes' },
    abilities: { id: 'abilities' },
    recipes: { id: 'craft' },
    ingredients: { id: 'craft' },
    achievements: { id: 'achievements' }
  };

  function ensureContextSidebarDom() {
    if (typeof document === 'undefined') return null;
    const sidebar = document.getElementById('context-sidebar');
    if (!sidebar) return null;
    if (sidebar.dataset.ctxReady === '1') return sidebar;

    let head = sidebar.querySelector('.context-sidebar-head');
    if (!head) {
      head = document.createElement('div');
      head.className = 'context-sidebar-head';
      head.innerHTML =
        '<h3 class="context-sidebar-title" id="context-sidebar-title">Контент</h3>' +
        '<button type="button" class="context-sidebar-toggle" id="context-sidebar-toggle" title="Свернуть" aria-label="Свернуть панель">‹</button>';
      sidebar.insertBefore(head, sidebar.firstChild);
      head.querySelector('#context-sidebar-toggle')?.addEventListener('click', () => {
        const ui = ensureUiState();
        ui.sidebarCollapsed = !ui.sidebarCollapsed;
        sidebar.classList.toggle('is-collapsed', ui.sidebarCollapsed);
      });
    }

    let browserMount = document.getElementById('context-browser-mount');
    if (!browserMount) {
      browserMount = document.createElement('div');
      browserMount.id = 'context-browser-mount';
      browserMount.className = 'context-browser-mount';
      browserMount.hidden = true;
      const sceneList = document.getElementById('scene-list');
      if (sceneList) sidebar.insertBefore(browserMount, sceneList);
      else sidebar.appendChild(browserMount);
    }

    let scenesPane = document.getElementById('context-scenes-pane');
    if (!scenesPane) {
      scenesPane = document.createElement('div');
      scenesPane.id = 'context-scenes-pane';
      scenesPane.className = 'context-scenes-pane';
      const h3 = sidebar.querySelector('h3:not(.context-sidebar-title)');
      const sceneList = document.getElementById('scene-list');
      const newBtn = sidebar.querySelector('button[onclick*="openSceneWizard"], button[onclick*="createScene"], button[onclick*="openSceneQuickCreate"]');
      if (h3) scenesPane.appendChild(h3);
      if (sceneList) scenesPane.appendChild(sceneList);
      if (newBtn) scenesPane.appendChild(newBtn);
      sidebar.appendChild(scenesPane);
    }

    sidebar.dataset.ctxReady = '1';
    return sidebar;
  }

  function syncContextSidebar(tab) {
    const sidebar = ensureContextSidebarDom();
    if (!sidebar) return;

    const activeTab = tab || Editor.currentTab;
    const section = findSectionForTab(activeTab);
    const sectionId = section?.id || null;
    const scenesPane = document.getElementById('context-scenes-pane');
    const browserMount = document.getElementById('context-browser-mount');
    const titleEl = document.getElementById('context-sidebar-title');

    const showScenes = activeTab === 'scenes' && section?.showSceneList && !FULL_WIDTH_TABS.has(activeTab);
    const category = sectionId ? SECTION_CATEGORY[sectionId] : null;
    const showBrowser = !showScenes && !!category && Editor.data && !FULL_WIDTH_TABS.has(activeTab);

    if (titleEl) {
      titleEl.textContent = showScenes
        ? (SECTION_LABELS.scenes || 'Сцены')
        : (SECTION_LABELS[sectionId] || 'Контент');
    }

    if (scenesPane) scenesPane.hidden = !showScenes;
    if (browserMount) {
      browserMount.hidden = !showBrowser;
      if (showBrowser && typeof Editor.renderContentBrowserPanel === 'function') {
        Editor._contentBrowserCategory = category;
        browserMount.innerHTML = Editor.renderContentBrowserPanel({
          category,
          writerMode: isWriter()
        });
        Editor.bindContentBrowserEvents?.(browserMount);
      }
    }

    const visible = showScenes || showBrowser;
    sidebar.classList.toggle('is-visible', visible);
    sidebar.setAttribute('aria-hidden', visible ? 'false' : 'true');

    const ui = ensureUiState();
    sidebar.classList.toggle('is-collapsed', ui.sidebarCollapsed);
  }

  // ——— Inspector helpers ———

  function sectionDetails(key, title, bodyFrag, defaultOpen) {
    const details = document.createElement('details');
    details.className = 'insp-section';
    details.dataset.inspSection = key;
    details.open = getSectionExpanded(key, defaultOpen);
    const summary = document.createElement('summary');
    summary.className = 'insp-section__title';
    summary.textContent = title;
    details.appendChild(summary);
    const body = document.createElement('div');
    body.className = 'insp-section__body';
    if (bodyFrag) {
      if (bodyFrag.nodeType === 11) body.appendChild(bodyFrag);
      else body.appendChild(bodyFrag);
    }
    details.appendChild(body);
    details.addEventListener('toggle', () => {
      setSectionExpanded(key, details.open);
    });
    return details;
  }

  function fieldRow(label, control) {
    const wrap = document.createElement('div');
    wrap.className = 'insp-field';
    const lab = document.createElement('label');
    lab.className = 'insp-field__label';
    lab.textContent = label;
    wrap.appendChild(lab);
    const val = document.createElement('div');
    val.className = 'insp-field__control';
    if (control && control.nodeType === 1) val.appendChild(control);
    else if (control != null) val.textContent = String(control);
    wrap.appendChild(val);
    return wrap;
  }

  function textInput(val, onChange) {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'form-control';
    inp.value = val || '';
    inp.addEventListener('change', () => onChange(inp.value));
    return inp;
  }

  function numInput(val, onChange, min) {
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.className = 'form-control';
    inp.value = val != null ? String(val) : '';
    if (min != null) inp.min = String(min);
    inp.addEventListener('change', () => onChange(parseFloat(inp.value)));
    return inp;
  }

  function syncInspectorChrome() {
    const panel = document.getElementById('editor-inspector');
    if (!panel) return;

    const ui = ensureUiState();
    panel.classList.toggle('is-collapsed', ui.inspectorCollapsed);

    let toggle = panel.querySelector('.editor-inspector-toggle');
    if (!toggle) {
      const head = panel.querySelector('.editor-inspector-head');
      if (head) {
        toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'btn btn-secondary btn-sm editor-inspector-toggle';
        toggle.title = 'Свернуть инспектор';
        toggle.textContent = '⟩';
        head.insertBefore(toggle, head.querySelector('.editor-inspector-close'));
        toggle.addEventListener('click', () => {
          ui.inspectorCollapsed = !ui.inspectorCollapsed;
          panel.classList.toggle('is-collapsed', ui.inspectorCollapsed);
        });
      }
    }

    const headTitle = panel.querySelector('.editor-inspector-head h3');
    if (headTitle) {
      const sel = Editor.Inspector?.selection;
      headTitle.textContent = sel ? 'Свойства' : 'Контекст';
    }
  }

  function applyContextLayoutClasses() {
    if (typeof document === 'undefined') return;
    const body = document.body;
    const tab = Editor.currentTab;
    const sceneId = Editor.currentScene;
    const scene = sceneId && Editor.data?.scenes?.[sceneId];
    let kind = 'text';
    if (scene && typeof Editor.getSceneContentKind === 'function') {
      kind = Editor.getSceneContentKind(scene);
    }
    const viewMode = typeof Editor.getSceneViewMode === 'function'
      ? Editor.getSceneViewMode(sceneId)
      : 'text';

    body.classList.toggle('editor-ctx-scenes', tab === 'scenes');
    body.classList.toggle('editor-ctx-visual-active', tab === 'scenes' && kind !== 'text' && viewMode !== 'text');
    body.classList.toggle('editor-ctx-game-ui', tab === 'game_ui');
    body.classList.toggle('editor-ctx-writer', isWriter());

    // Writer + TEXT-only: collapse inspector by default once per session
    const ui = ensureUiState();
    if (isWriter() && tab === 'scenes' && kind === 'text' && !ui._writerInspectorDefaulted) {
      ui.inspectorCollapsed = true;
      ui._writerInspectorDefaulted = true;
    }
    syncInspectorChrome();
  }

  function registerContextInspectors() {
    if (!Editor.Inspector || typeof Editor.Inspector.register !== 'function') return;

    // Compact scene inspector — avoid duplicating document header / full text editor
    Editor.Inspector.register('scene', {
      label: 'Сцена',
      render(ctx) {
        const id = ctx.id;
        const scene = ctx.data?.scenes?.[id];
        if (!scene) {
          const p = document.createElement('p');
          p.className = 'hint';
          p.textContent = 'Сцена не найдена';
          return p;
        }
        const frag = document.createDocumentFragment();
        const hint = document.createElement('p');
        hint.className = 'hint';
        hint.textContent = 'Текст и выборы редактируются в документе слева.';
        frag.appendChild(hint);

        if (isAdvanced()) {
          const code = document.createElement('code');
          code.textContent = id;
          frag.appendChild(fieldRow('ID', code));
        }

        const npcFrag = document.createDocumentFragment();
        if (typeof Editor.renderNpcIdSelect === 'function') {
          const wrap = document.createElement('div');
          wrap.innerHTML = Editor.renderNpcIdSelect(scene.npcId || '', `Editor.setSceneNpcId(this.value)`);
          npcFrag.appendChild(wrap);
        } else {
          npcFrag.appendChild(textInput(scene.npcId || '', (v) => Editor.setSceneNpcId?.(v)));
        }
        frag.appendChild(sectionDetails('scene-npc', 'NPC', npcFrag, false));

        const stats = document.createElement('p');
        stats.className = 'hint';
        const choices = Array.isArray(scene.choices) ? scene.choices.length : 0;
        const nodes = scene.visual?.nodes?.length || 0;
        stats.textContent = `Выборов: ${choices}` + (nodes ? ` · Visual: ${nodes}` : '');
        frag.appendChild(stats);

        return frag;
      }
    });

    Editor.Inspector.register('visual_node', {
      label: 'Visual элемент',
      render(ctx) {
        const sceneId = ctx.meta?.sceneId || Editor.currentScene;
        const nodeId = ctx.id;
        const scene = ctx.data?.scenes?.[sceneId];
        const node = scene?.visual?.nodes?.find((n) => n.id === nodeId);
        if (!node) {
          const p = document.createElement('p');
          p.className = 'hint';
          p.textContent = 'Элемент не найден';
          return p;
        }
        const frag = document.createDocumentFragment();
        const t = node.transform || { x: 0, y: 0, w: 0.1, h: 0.1, z: 0 };

        const transformFrag = document.createDocumentFragment();
        ['x', 'y', 'w', 'h', 'z'].forEach((f) => {
          transformFrag.appendChild(fieldRow(f.toUpperCase(), numInput(t[f], (v) => {
            Editor.visualUpdateNodeField?.(nodeId, f, v);
          })));
        });
        frag.appendChild(sectionDetails('visual-transform', 'Transform', transformFrag, true));

        const appearFrag = document.createDocumentFragment();
        appearFrag.appendChild(fieldRow('Метка', textInput(node.props?.label || node.props?.text || '', (v) => {
          Editor.visualUpdateNodeField?.(nodeId, 'label', v);
        })));
        if (isAdvanced()) appearFrag.appendChild(fieldRow('Kind', node.kind || 'hotspot'));
        frag.appendChild(sectionDetails('visual-appearance', 'Appearance', appearFrag, true));

        const behaviorFrag = document.createDocumentFragment();
        const condHint = document.createElement('p');
        condHint.className = 'hint';
        condHint.textContent = node.showIf ? 'Условия заданы' : 'Без условий видимости';
        behaviorFrag.appendChild(condHint);
        frag.appendChild(sectionDetails('visual-behavior', 'Conditions', behaviorFrag, false));

        const actionFrag = document.createDocumentFragment();
        const click = node.events?.click?.[0];
        const actHint = document.createElement('p');
        actHint.className = 'hint';
        actHint.textContent = click ? `Действие: ${click.action || '—'}` : 'Нет click action';
        actionFrag.appendChild(actHint);
        frag.appendChild(sectionDetails('visual-actions', 'Actions', actionFrag, false));

        return frag;
      }
    });

    Editor.Inspector.register('ui_node', {
      label: 'UI элемент',
      render(ctx) {
        const screenId = ctx.meta?.screenId || Editor._uiSelectedScreen;
        const nodeId = ctx.id;
        const screen = ctx.data?.ui?.screens?.[screenId];
        const node = screen?.nodes?.find((n) => n.id === nodeId);
        if (!node) {
          const p = document.createElement('p');
          p.className = 'hint';
          p.textContent = 'UI элемент не найден';
          return p;
        }
        const frag = document.createDocumentFragment();
        const t = node.transform || { x: 0, y: 0, w: 0.2, h: 0.1 };

        const transformFrag = document.createDocumentFragment();
        ['x', 'y', 'w', 'h'].forEach((f) => {
          transformFrag.appendChild(fieldRow(f.toUpperCase(), numInput(t[f], (v) => {
            Editor.uiUpdateNodeField?.(nodeId, f, v);
          })));
        });
        frag.appendChild(sectionDetails('ui-transform', 'Transform', transformFrag, true));

        const styleFrag = document.createDocumentFragment();
        styleFrag.appendChild(fieldRow('Тип', node.kind || node.type || 'panel'));
        if (node.props?.text) styleFrag.appendChild(fieldRow('Текст', node.props.text));
        frag.appendChild(sectionDetails('ui-style', 'Style', styleFrag, false));

        const actionFrag = document.createDocumentFragment();
        const click = node.events?.click?.[0];
        const ah = document.createElement('p');
        ah.className = 'hint';
        ah.textContent = click ? `Action: ${click.action}` : 'Нет действий';
        actionFrag.appendChild(ah);
        frag.appendChild(sectionDetails('ui-actions', 'Actions', actionFrag, false));

        return frag;
      }
    });

    Editor.Inspector.register('choice', {
      label: 'Выбор',
      render(ctx) {
        const sceneId = ctx.meta?.sceneId || Editor.currentScene;
        const idx = ctx.meta?.choiceIndex;
        const choice = ctx.data?.scenes?.[sceneId]?.choices?.[idx];
        if (!choice) {
          const p = document.createElement('p');
          p.className = 'hint';
          p.textContent = 'Выбор не найден';
          return p;
        }
        const frag = document.createDocumentFragment();

        const textFrag = document.createDocumentFragment();
        textFrag.appendChild(fieldRow('Текст', textInput(choice.text || '', (v) => {
          Editor.updateChoice?.(idx, 'text', v);
        })));
        if (isAdvanced() && choice.to) textFrag.appendChild(fieldRow('Переход', choice.to));
        frag.appendChild(sectionDetails('choice-text', 'Text', textFrag, true));

        const condFrag = document.createElement('p');
        condFrag.className = 'hint';
        condFrag.textContent = (choice.showIf || choice.hideIf)
          ? 'Условия заданы — подробности в карточке выбора'
          : 'Без условий';
        frag.appendChild(sectionDetails('choice-conditions', 'Conditions', condFrag, false));

        const actFrag = document.createElement('p');
        actFrag.className = 'hint';
        actFrag.textContent = choice.action ? `Action: ${choice.action}` : (choice.to ? `→ ${choice.to}` : 'Нет действия');
        frag.appendChild(sectionDetails('choice-actions', 'Actions', actFrag, false));

        return frag;
      }
    });
  }

  function bindContextSelectionDelegates() {
    if (typeof document === 'undefined' || window._ctxUiSelectionBound) return;
    window._ctxUiSelectionBound = true;

    document.addEventListener('click', (ev) => {
      const choiceHead = ev.target.closest?.('.choice-card-head');
      if (choiceHead && !ev.target.closest('.btn-remove, input, select, textarea, button')) {
        const card = choiceHead.closest('.choice-card');
        if (!card) return;
        const list = card.parentElement;
        const cards = list ? Array.from(list.querySelectorAll(':scope > .choice-card')) : [];
        const idx = cards.indexOf(card);
        if (idx >= 0 && Editor.Inspector) {
          Editor.Inspector.select({
            type: 'choice',
            id: String(idx),
            meta: { sceneId: Editor.currentScene, choiceIndex: idx }
          });
          ensureUiState().inspectorCollapsed = false;
          syncInspectorChrome();
        }
      }
    }, true);
  }

  function removeDuplicateSceneAuthoringPanel() {
    document.getElementById('scene-authoring-panel')?.remove();
  }

  function ensureStyles() {
    if (typeof document === 'undefined' || document.getElementById('editor-context-ui-styles')) return;
    if (document.querySelector('link#editor-design-system-css, link[href*="editor-design-system"]')) return;
    const st = document.createElement('style');
    st.id = 'editor-context-ui-styles';
    st.textContent = `
      .context-sidebar-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 8px 10px 4px; border-bottom: 1px solid var(--border, #ddd);
      }
      .context-sidebar-head h3 { margin: 0; font-size: 13px; }
      .context-sidebar-toggle {
        border: none; background: transparent; cursor: pointer; font-size: 16px;
        padding: 2px 6px; opacity: .6;
      }
      .context-sidebar.is-collapsed {
        width: 0 !important; min-width: 0 !important; padding: 0 !important;
        overflow: hidden; border: none !important;
      }
      .context-browser-mount {
        flex: 1; overflow-y: auto; padding: 6px 8px; font-size: 12px;
      }
      .context-browser-mount .content-browser-root { margin: 0; }
      .context-browser-mount .content-browser-cat { font-size: 12px; margin: 8px 0 4px; }
      .context-browser-mount .content-browser-link {
        width: 100%; text-align: left; border: none; background: transparent;
        padding: 5px 4px; cursor: pointer; border-radius: 4px;
      }
      .context-browser-mount .content-browser-link:hover { background: rgba(0,0,0,.05); }
      .editor-workspace .main-area { flex: 1 1 auto; min-width: 0; }
      .editor-inspector.is-collapsed { display: none; }
      .editor-inspector-toggle { margin-right: 4px; }
      .insp-section { margin: 0 0 8px; border: none; }
      .insp-section__title {
        font-size: 11px; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.05em; color: var(--ink-light, #666); cursor: pointer;
        padding: 6px 0; list-style: none;
      }
      .insp-section__title::-webkit-details-marker { display: none; }
      .insp-section__body { padding: 0 0 8px; }
      .insp-field { margin-bottom: 8px; }
      .insp-field__label { display: block; font-size: 11px; color: var(--ink-light); margin-bottom: 2px; }
      .insp-field__control input { width: 100%; font-size: 12px; }
      body.editor-ctx-writer .insp-field__control code,
      body.editor-ctx-writer .content-browser-id { display: none; }
      body.editor-ctx-visual-active .editor-inspector { display: flex; }
      @media (min-width: 1100px) {
        .editor-workspace .main-area { flex: 1 1 65%; }
        .editor-inspector:not(.is-collapsed) { width: 280px; }
      }
    `;
    document.head.appendChild(st);
  }

  Object.assign(Editor, {
    syncContextSidebar,
    applyContextLayoutClasses,

    shouldShowSceneAuthoringPanel() {
      return false;
    }
  });

  registerContextInspectors();
  bindContextSelectionDelegates();
  ensureStyles();

  if (Editor.hooks) {
    if (typeof Editor.hooks.after === 'function') {
      Editor.hooks.after('switchTab', function (_r, args) {
        const tab = args && args[0];
        syncContextSidebar(tab);
        applyContextLayoutClasses();
      });

      Editor.hooks.after('selectScene', function () {
        applyContextLayoutClasses();
        if (Editor.Inspector && Editor.currentScene) {
          const kind = typeof Editor.getSceneContentKind === 'function'
            ? Editor.getSceneContentKind(Editor.currentScene)
            : 'text';
          if (kind === 'visual' || kind === 'mixed') {
            ensureUiState().inspectorCollapsed = false;
            syncInspectorChrome();
          }
        }
      });

      Editor.hooks.after('renderSceneEditor', function () {
        removeDuplicateSceneAuthoringPanel();
        applyContextLayoutClasses();
      }, 'editor-context-ui');

      Editor.hooks.after('visualSelectNode', function (_r, args) {
        const nodeId = args && args[0];
        if (!nodeId || !Editor.Inspector) return;
        Editor.Inspector.select({
          type: 'visual_node',
          id: nodeId,
          meta: { sceneId: Editor.currentScene }
        });
        ensureUiState().inspectorCollapsed = false;
        syncInspectorChrome();
      });

      if (typeof Editor.uiSelectNode === 'function') {
        Editor.hooks.after('uiSelectNode', function (_r, args) {
          const nodeId = args && args[0];
          if (!nodeId || !Editor.Inspector) return;
          Editor.Inspector.select({
            type: 'ui_node',
            id: nodeId,
            meta: { screenId: Editor._uiSelectedScreen }
          });
          ensureUiState().inspectorCollapsed = false;
          syncInspectorChrome();
        });
      }
    }
  }

  // Expose NAV_SECTIONS for getNavSectionForTab — read from nav layout if available
  if (typeof document !== 'undefined') {
    const boot = () => {
      ensureContextSidebarDom();
      syncContextSidebar(Editor.currentTab);
      applyContextLayoutClasses();
      if (Editor.Inspector) {
        const origRender = Editor.Inspector.render.bind(Editor.Inspector);
        Editor.Inspector.render = function () {
          origRender();
          syncInspectorChrome();
        };
      }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-context-ui', {
      syncContextSidebar: Editor.syncContextSidebar,
      applyContextLayoutClasses: Editor.applyContextLayoutClasses
    }, { force: true });
  }

  console.info('[Editor.ContextUI] ready');
})();
