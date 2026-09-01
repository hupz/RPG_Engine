// ============================================================
// Unified Content Browser (UI-9) — scene navigation for large projects
// Orchestration over EditorContentIndex + PCM 1.13 APIs. No schema changes.
// ============================================================
(function attachContentBrowser() {
  'use strict';

  if (typeof Editor === 'undefined') return;

  const IDX = typeof EditorContentIndex !== 'undefined' ? EditorContentIndex : null;

  const FILTER_PILLS = [
    { id: 'all', label: 'Все' },
    { id: 'text', label: 'Text' },
    { id: 'visual', label: 'Visual' },
    { id: 'mixed', label: 'Mixed' }
  ];

  const SORT_OPTIONS = [
    { id: 'title', label: 'По имени' },
    { id: 'title_desc', label: 'Имя (Я→А)' },
    { id: 'kind', label: 'По типу' },
    { id: 'warnings', label: 'С предупреждениями' }
  ];

  Editor._sceneListQuery = Editor._sceneListQuery || '';
  Editor._sceneListFilter = Editor._sceneListFilter || 'all';
  Editor._sceneListSort = Editor._sceneListSort || 'title';

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

  function isWriter() {
    return typeof Editor.isWriterMode === 'function' && Editor.isWriterMode();
  }

  function isAdvanced() {
    return (typeof Editor.isEditorAdvancedMode === 'function' && Editor.isEditorAdvancedMode()) ||
      (typeof Editor.isAdvancedMode === 'function' && Editor.isAdvancedMode());
  }

  function kindLabel(kind) {
    if (kind === 'visual') return 'Visual';
    if (kind === 'mixed') return 'Mixed';
    return 'Text';
  }

  function kindBadgeClass(kind) {
    if (kind === 'visual') return 'cb-badge--visual';
    if (kind === 'mixed') return 'cb-badge--mixed';
    return 'cb-badge--text';
  }

  function getSceneCardMeta(scene, sceneId, data) {
    const choices = Array.isArray(scene?.choices) ? scene.choices.length : 0;
    const nodes = scene?.visual?.nodes?.length || 0;
    const parts = [];
    if (choices) parts.push(choices + ' ' + pluralRu(choices, 'выбор', 'выбора', 'выборов'));
    if (nodes) parts.push(nodes + ' ' + pluralRu(nodes, 'объект', 'объекта', 'объектов'));
    if (!parts.length) {
      if (scene?.text) parts.push('текст');
      else if (nodes === 0 && choices === 0) parts.push('пустая');
    }
    let warnings = 0;
    if (typeof Editor.getSceneWarningCount === 'function') {
      warnings = Editor.getSceneWarningCount(sceneId, data);
    } else if (typeof ProjectValidator !== 'undefined' && ProjectValidator.validateProject && data) {
      try {
        const report = ProjectValidator.validateProject(data);
        warnings = (report.issues || []).filter((i) =>
          (i.entityId === sceneId || i.sceneId === sceneId) &&
          (i.severity === 'warning' || i.level === 'warning')
        ).length;
      } catch (e) { /* */ }
    }
    return { choices, nodes, summary: parts.join(' · '), warnings };
  }

  function pluralRu(n, one, few, many) {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  }

  function sortSceneEntries(entries, sortId, data) {
    const list = entries.slice();
    if (sortId === 'title_desc') {
      list.sort((a, b) => String(b.title).localeCompare(String(a.title), 'ru'));
    } else if (sortId === 'kind') {
      list.sort((a, b) => {
        const k = String(a.kind).localeCompare(String(b.kind));
        return k || String(a.title).localeCompare(String(b.title), 'ru');
      });
    } else if (sortId === 'warnings') {
      const warnMap = typeof Editor.getSceneWarningCount === 'function' && typeof Editor.Perf?.getSceneWarningMap === 'function'
        ? Editor.Perf.getSceneWarningMap(data)
        : null;
      list.sort((a, b) => {
        const wa = warnMap ? (warnMap[a.id] || 0) : getSceneCardMeta(a.scene || data?.scenes?.[a.id], a.id, data).warnings;
        const wb = warnMap ? (warnMap[b.id] || 0) : getSceneCardMeta(b.scene || data?.scenes?.[b.id], b.id, data).warnings;
        return wb - wa || String(a.title).localeCompare(String(b.title), 'ru');
      });
    } else {
      list.sort((a, b) => String(a.title).localeCompare(String(b.title), 'ru'));
    }
    return list;
  }

  function groupSceneReferences(refs) {
    const g = {
      choices: 0,
      hotspots: 0,
      transitions: 0,
      combat: 0,
      ui: 0,
      start: 0,
      other: 0
    };
    (refs || []).forEach((r) => {
      if (r.kind === 'choice') g.choices++;
      else if (r.kind === 'startScene') g.start++;
      else if (r.kind === 'ui') g.ui++;
      else if (r.kind === 'transition') g.transitions++;
      else if (r.path && r.path.indexOf('visual.nodes') >= 0) g.hotspots++;
      else if (r.label && /combat|start_combat/i.test(r.label)) g.combat++;
      else g.other++;
    });
    return g;
  }

  function formatDeleteUsageSummary(sceneId) {
    const refs = typeof Editor.findSceneInboundReferences === 'function'
      ? Editor.findSceneInboundReferences(sceneId) : [];
    const g = groupSceneReferences(refs);
    const lines = [];
    if (g.choices) lines.push(g.choices + ' ' + pluralRu(g.choices, 'выбор', 'выбора', 'выборов'));
    if (g.hotspots) lines.push(g.hotspots + ' ' + pluralRu(g.hotspots, 'hotspot', 'hotspot', 'hotspots'));
    if (g.transitions) lines.push(g.transitions + ' ' + pluralRu(g.transitions, 'переход', 'перехода', 'переходов'));
    if (g.combat) lines.push(g.combat + ' combat');
    if (g.ui) lines.push(g.ui + ' UI');
    if (g.start) lines.push('startScene');
    if (g.other) lines.push(g.other + ' другое');
    return { refs, groups: g, lines, canSafelyDelete: refs.length === 0 };
  }

  function openSceneFromContentBrowser(sceneId) {
    if (!sceneId || !Editor.data?.scenes?.[sceneId]) return false;
    if (typeof Editor.openSceneWorkspace === 'function') {
      return Editor.openSceneWorkspace(sceneId);
    }
    if (typeof Editor.openSceneDocument === 'function') {
      Editor.openSceneDocument(sceneId);
      return true;
    }
    if (typeof Editor.selectScene === 'function') {
      Editor.selectScene(sceneId);
      return true;
    }
    return false;
  }

  function locateSceneInGraph(sceneId) {
    if (!sceneId) return false;
    if (typeof Editor.switchTab === 'function') {
      Editor.switchTab('graph');
    }
    if (typeof Editor.onStoryGraphSearch === 'function') {
      Editor.onStoryGraphSearch(sceneId);
    }
    const highlight = () => Editor.applyGraphSearchHighlight?.();
    if (typeof setTimeout === 'function') setTimeout(highlight, 150);
    else highlight();
    return true;
  }

  function previewSceneFromBrowser(sceneId) {
    if (!sceneId) return;
    if (typeof Editor.previewScene === 'function') {
      Editor.previewScene({ mode: 'current', sceneId });
    } else if (typeof Editor.testFromHere === 'function') {
      Editor.testFromHere({ sceneId });
    } else if (typeof Editor.testCurrentScene === 'function') {
      Editor.currentScene = sceneId;
      Editor.testCurrentScene();
    }
  }

  function createSceneFromBrowser(kind) {
    const displayMap = {
      text: 'text',
      visual: 'visual',
      mixed: 'mixed',
      empty: 'text'
    };
    const nameMap = {
      text: 'Новая текстовая сцена',
      visual: 'Новая visual-сцена',
      mixed: 'Новая mixed-сцена',
      empty: 'Пустая сцена'
    };
    return Editor.openSceneWizard({
      defaultName: nameMap[kind] || 'Новая сцена',
      sceneType: 'custom',
      displayMode: displayMap[kind] || 'text'
    });
  }

  async function deleteSceneWithUsageDialog(sceneId) {
    if (!Editor.data?.scenes?.[sceneId]) return false;
    const ids = Object.keys(Editor.data.scenes);
    if (ids.length <= 1) {
      Editor.toast.warning('Нельзя удалить последнюю сцену');
      return false;
    }

    const scene = Editor.data.scenes[sceneId];
    const title = scene?.location || scene?.title || sceneId;
    const usage = formatDeleteUsageSummary(sceneId);

    let msg;
    if (usage.canSafelyDelete) {
      msg = 'Удалить сцену «' + title + '»?\nСсылок на неё не найдено.';
    } else {
      msg = 'Нельзя безопасно удалить «' + title + '».\n\nИспользуется:\n' +
        usage.lines.map((l) => '• ' + l).join('\n') +
        '\n\nВнешние ссылки НЕ будут исправлены автоматически.\n\nВсё равно удалить?';
    }

    if (!(await Editor.confirmDialog({ message: msg, danger: true }))) return false;

    delete Editor.data.scenes[sceneId];
    if (Editor.currentScene === sceneId) {
      Editor.currentScene = Object.keys(Editor.data.scenes)[0];
    }
    Editor.updateJSONPreview?.();
    Editor.renderSceneList?.();
    Editor.renderSceneEditor?.();
    Editor.refreshDashboardIfVisible?.();
    Editor.toast?.success?.('Сцена удалена');
    return true;
  }

  function renderContentBrowserChrome() {
    const filter = Editor._sceneListFilter || 'all';
    const sort = Editor._sceneListSort || 'title';
    const pills = FILTER_PILLS.map((p) =>
      '<button type="button" class="cb-filter-pill' + (filter === p.id ? ' is-active' : '') +
      '" data-cb-filter="' + escAttr(p.id) + '">' + esc(p.label) + '</button>'
    ).join('');
    const sortOpts = SORT_OPTIONS.map((o) =>
      '<option value="' + escAttr(o.id) + '"' + (sort === o.id ? ' selected' : '') + '>' + esc(o.label) + '</option>'
    ).join('');

    return (
      '<div class="cb-browser-head">' +
      '<div class="cb-browser-title">PROJECT</div>' +
      '<div class="cb-browser-subtitle">Сцены</div>' +
      '<input type="search" id="cb-scene-search" class="cb-search" placeholder="🔍 Поиск сцен…" ' +
      'value="' + escAttr(Editor._sceneListQuery) + '" autocomplete="off" />' +
      '<div class="cb-filter-row" role="group" aria-label="Фильтр типа">' + pills + '</div>' +
      '<div class="cb-sort-row"><label class="hint">Сортировка</label>' +
      '<select id="cb-scene-sort" class="cb-sort">' + sortOpts + '</select></div>' +
      '<hr class="cb-divider" />' +
      '</div>'
    );
  }

  function renderSceneCard(row) {
    const id = row.id;
    const scene = Editor.data?.scenes?.[id] || row.scene || {};
    const title = row.title || scene.location || scene.title || id;
    const kind = row.kind || (IDX ? IDX.getSceneKind(scene) : 'text');
    const meta = getSceneCardMeta(scene, id, Editor.data);
    const active = Editor.currentScene === id ? ' is-active' : '';
    const warn = meta.warnings ? ' <span class="cb-warn" title="Есть предупреждения">⚠</span>' : '';

    return (
      '<article class="cb-scene-card scene-item pcm-scene-item' + active + '" data-scene-id="' + escAttr(id) + '">' +
      '<div class="cb-scene-card__main" data-cb-action="open" data-id="' + escAttr(id) + '">' +
      '<div class="cb-scene-card__title">' + esc(title) + warn + '</div>' +
      '<div class="cb-scene-card__meta">' +
      '<span class="cb-badge ' + kindBadgeClass(kind) + '">' + esc(kindLabel(kind)) + '</span>' +
      (row.uiLinked ? ' <span class="cb-badge cb-badge--ui">UI</span>' : '') +
      '<span class="cb-scene-card__stats hint">' + esc(meta.summary) + '</span>' +
      '</div>' +
      (isAdvanced() ? '<div class="cb-scene-card__id hint" data-label="code">' + esc(id) + '</div>' : '') +
      '</div>' +
      '<div class="cb-scene-card__actions" aria-label="Быстрые действия">' +
      '<button type="button" class="cb-action" data-cb-action="open" data-id="' + escAttr(id) + '" title="Открыть">Open</button>' +
      '<button type="button" class="cb-action" data-cb-action="dup" data-id="' + escAttr(id) + '" title="Дублировать">⧉</button>' +
      '<button type="button" class="cb-action" data-cb-action="preview" data-id="' + escAttr(id) + '" title="Превью">▶</button>' +
      '<button type="button" class="cb-action" data-cb-action="graph" data-id="' + escAttr(id) + '" title="В графе">◎</button>' +
      '<button type="button" class="cb-action cb-action--danger" data-cb-action="del" data-id="' + escAttr(id) + '" title="Удалить">🗑</button>' +
      '</div></article>'
    );
  }

  function renderCreateMenu() {
    return (
      '<div class="cb-create-wrap">' +
      '<button type="button" class="btn btn-primary btn-sm cb-create-toggle" id="cb-create-toggle">+ New Scene</button>' +
      '<div class="cb-create-menu" id="cb-create-menu" hidden>' +
      '<button type="button" data-cb-create="text">Text Scene</button>' +
      '<button type="button" data-cb-create="visual">Visual Scene</button>' +
      '<button type="button" data-cb-create="mixed">Mixed Scene</button>' +
      '<button type="button" data-cb-create="empty">Empty</button>' +
      '</div></div>'
    );
  }

  function ensureContentBrowserChrome() {
    const sidebar = document.getElementById('context-sidebar');
    if (!sidebar) return;

    let chrome = document.getElementById('cb-browser-chrome');
    if (!chrome) {
      chrome = document.createElement('div');
      chrome.id = 'cb-browser-chrome';
      chrome.className = 'cb-browser-chrome';
      const sceneList = document.getElementById('scene-list');
      const scenesPane = document.getElementById('context-scenes-pane');
      const pcm = document.getElementById('pcm-chrome');
      const parent = (sceneList && sceneList.parentNode) || scenesPane || sidebar;
      if (pcm && pcm.parentNode) pcm.style.display = 'none';
      if (sceneList && sceneList.parentNode === parent) {
        parent.insertBefore(chrome, sceneList);
      } else if (scenesPane) {
        scenesPane.insertBefore(chrome, scenesPane.firstChild);
      } else {
        sidebar.insertBefore(chrome, sidebar.firstChild);
      }
    }
    chrome.innerHTML = renderContentBrowserChrome();

    if (!chrome.dataset.bound) {
      chrome.dataset.bound = '1';
      chrome.addEventListener('input', (ev) => {
        if (ev.target.id === 'cb-scene-search') {
          Editor._sceneListQuery = ev.target.value || '';
          if (typeof Editor.Perf?.debouncedSceneListRender === 'function') {
            Editor.Perf.debouncedSceneListRender();
          } else {
            Editor.renderSceneList?.();
          }
        }
      });
      chrome.addEventListener('change', (ev) => {
        if (ev.target.id === 'cb-scene-sort') {
          Editor._sceneListSort = ev.target.value || 'title';
          Editor.renderSceneList?.();
        }
      });
      chrome.addEventListener('click', (ev) => {
        const pill = ev.target.closest('[data-cb-filter]');
        if (pill) {
          Editor._sceneListFilter = pill.getAttribute('data-cb-filter') || 'all';
          chrome.querySelectorAll('[data-cb-filter]').forEach((b) => {
            b.classList.toggle('is-active', b === pill);
          });
          Editor.renderSceneList?.();
        }
      });
    }

    let createWrap = document.getElementById('cb-create-footer');
    if (!createWrap) {
      createWrap = document.createElement('div');
      createWrap.id = 'cb-create-footer';
      createWrap.className = 'cb-create-footer';
      const scenesPane = document.getElementById('context-scenes-pane') || sidebar;
      scenesPane.appendChild(createWrap);
    }
    createWrap.innerHTML = renderCreateMenu();

    if (!createWrap.dataset.bound) {
      createWrap.dataset.bound = '1';
      createWrap.addEventListener('click', (ev) => {
        const toggle = ev.target.closest('#cb-create-toggle');
        if (toggle) {
          const menu = document.getElementById('cb-create-menu');
          if (menu) menu.hidden = !menu.hidden;
          return;
        }
        const createBtn = ev.target.closest('[data-cb-create]');
        if (createBtn) {
          createSceneFromBrowser(createBtn.getAttribute('data-cb-create'));
          const menu = document.getElementById('cb-create-menu');
          if (menu) menu.hidden = true;
        }
      });
    }
  }

  function bindContentBrowserList(root) {
    if (!root || root._cbBound) return;
    root._cbBound = true;

    root.addEventListener('click', (ev) => {
      const btn = ev.target.closest('[data-cb-action]');
      if (!btn || !root.contains(btn)) return;
      ev.stopPropagation();
      const action = btn.getAttribute('data-cb-action');
      const id = btn.getAttribute('data-id');
      if (!id) return;
      if (action === 'open') openSceneFromContentBrowser(id);
      else if (action === 'dup' && typeof Editor.duplicateScene === 'function') Editor.duplicateScene(id);
      else if (action === 'preview') previewSceneFromBrowser(id);
      else if (action === 'graph') locateSceneInGraph(id);
      else if (action === 'del') deleteSceneWithUsageDialog(id);
    });

    root.addEventListener('contextmenu', async (ev) => {
      const card = ev.target.closest('.cb-scene-card');
      if (!card || !root.contains(card)) return;
      ev.preventDefault();
      const id = card.getAttribute('data-scene-id');
      if (!id) return;
      const action = await Editor.promptDialog({
        message: 'Действие: open | duplicate | preview | graph | delete',
        defaultValue: 'open'
      });
      if (!action) return;
      const a = action.trim().toLowerCase();
      if (a === 'open') openSceneFromContentBrowser(id);
      else if (a === 'duplicate' && Editor.duplicateScene) Editor.duplicateScene(id);
      else if (a === 'preview') previewSceneFromBrowser(id);
      else if (a === 'graph') locateSceneInGraph(id);
      else if (a === 'delete') deleteSceneWithUsageDialog(id);
    });
  }

  function renderSceneContentBrowser(opts) {
    opts = opts || {};
    if (!opts.skipChrome) ensureContentBrowserChrome();
    const list = opts.listEl || document.getElementById('scene-list');
    if (!list) return;

    if (!Editor.data?.scenes) {
      list.innerHTML = '';
      return;
    }

    const entries = Object.keys(Editor.data.scenes);
    if (!entries.length) {
      list.innerHTML =
        '<div class="cb-welcome empty-state cb-empty" role="status">' +
        '<h2>Добро пожаловать в проект</h2>' +
        '<p>Создайте первую сцену — основу сюжета и геймплея.</p>' +
        '<div class="cb-welcome__actions">' +
        '<button type="button" class="btn btn-primary btn-sm" data-cb-welcome-create="text">Создать первую сцену</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-cb-welcome-create="visual">Visual Scene</button>' +
        '</div></div>';
      list.querySelectorAll('[data-cb-welcome-create]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const kind = btn.getAttribute('data-cb-welcome-create');
          if (kind) createSceneFromBrowser(kind);
        });
      });
      return;
    }

    let filtered = typeof Editor.searchProjectScenes === 'function'
      ? Editor.searchProjectScenes(Editor._sceneListQuery, Editor._sceneListFilter)
      : entries.map((id) => ({ id, title: id, kind: 'text', scene: Editor.data.scenes[id] }));

    filtered = sortSceneEntries(filtered, Editor._sceneListSort, Editor.data);

    if (!filtered.length) {
      list.innerHTML = '<p class="hint cb-no-match">Ничего не найдено</p>';
      return;
    }

    list.innerHTML = filtered.map((row) => renderSceneCard(row)).join('');
    bindContentBrowserList(list);
  }

  Object.assign(Editor, {
    openSceneFromContentBrowser,
    locateSceneInGraph,
    createSceneFromBrowser,
    formatSceneDeleteUsage: formatDeleteUsageSummary,
    groupSceneReferences,
    getSceneCardMeta,
    sortSceneEntries,
    renderSceneContentBrowser
  });

  if (Editor.hooks?.replace) {
    Editor.hooks.replace('renderSceneList', function renderSceneListUI9() {
      return renderSceneContentBrowser.call(this);
    }, 'editor-content-browser');

    Editor.hooks.replace('deleteScene', function deleteSceneUI9(id) {
      return deleteSceneWithUsageDialog(id);
    }, 'editor-content-browser');
  }

  Editor.deleteSceneWithUsageDialog = deleteSceneWithUsageDialog;

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-content-browser', {
      openSceneFromContentBrowser,
      locateSceneInGraph,
      createSceneFromBrowser,
      renderSceneContentBrowser
    }, { force: true });
  }

  function ensureStyles() {
    if (typeof document === 'undefined' || document.getElementById('cb-browser-styles')) return;
    if (document.querySelector('link#editor-design-system-css, link[href*="editor-design-system"]')) {
      return;
    }
    const st = document.createElement('style');
    st.id = 'cb-browser-styles';
    st.textContent = `
      .cb-browser-chrome { margin-bottom: 8px; }
      .cb-browser-title { font-size: 10px; font-weight: 700; letter-spacing: .06em; color: var(--ink-faint); }
      .cb-browser-subtitle { font-size: 12px; font-weight: 600; margin: 2px 0 6px; }
      .cb-search { width: 100%; font-size: 12px; padding: 5px 8px; margin-bottom: 6px; box-sizing: border-box; }
      .cb-filter-row { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
      .cb-filter-pill { border: 1px solid var(--border); background: transparent; border-radius: 12px; padding: 2px 8px; font-size: 11px; cursor: pointer; }
      .cb-filter-pill.is-active { background: var(--highlight); font-weight: 600; }
      .cb-sort-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
      .cb-sort { font-size: 11px; max-width: 140px; }
      .cb-divider { border: none; border-top: 1px solid var(--border); margin: 6px 0; }
      .cb-scene-card { position: relative; border-bottom: 1px solid rgba(0,0,0,.06); }
      .cb-scene-card__main { padding: 8px 4px; cursor: pointer; }
      .cb-scene-card__title { font-weight: 600; font-size: 13px; }
      .cb-scene-card__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-top: 2px; font-size: 11px; }
      .cb-scene-card__stats { flex: 1; min-width: 0; }
      .cb-scene-card__actions { display: none; position: absolute; right: 2px; top: 4px; gap: 2px; background: var(--bg, #fff); padding: 2px; border-radius: 4px; box-shadow: 0 1px 4px rgba(0,0,0,.1); }
      .cb-scene-card:hover .cb-scene-card__actions, .cb-scene-card:focus-within .cb-scene-card__actions { display: flex; }
      .cb-action { border: none; background: transparent; cursor: pointer; font-size: 11px; padding: 2px 4px; border-radius: 3px; }
      .cb-action:hover { background: var(--highlight); }
      .cb-action--danger:hover { color: #c62828; }
      .cb-badge { font-size: 9px; padding: 1px 5px; border-radius: 3px; font-weight: 600; }
      .cb-badge--text { background: #e3f2fd; color: #1565c0; }
      .cb-badge--visual { background: #f3e5f5; color: #6a1b9a; }
      .cb-badge--mixed { background: #fff3e0; color: #e65100; }
      .cb-badge--ui { background: #e8f5e9; color: #2e7d32; }
      .cb-warn { color: #f57c00; }
      .cb-scene-card.is-active .cb-scene-card__main { background: var(--highlight); border-radius: 4px; }
      .cb-create-footer { padding: 8px 4px; border-top: 1px solid var(--border); margin-top: 4px; }
      .cb-create-wrap { position: relative; }
      .cb-create-menu { position: absolute; bottom: 100%; left: 0; right: 0; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 4px; margin-bottom: 4px; z-index: 5; flex-direction: column; gap: 2px; }
      .cb-create-menu:not([hidden]) { display: flex; }
      .cb-create-menu[hidden] { display: none !important; }
      .cb-create-menu button { text-align: left; border: none; background: transparent; padding: 6px 8px; cursor: pointer; font-size: 12px; border-radius: 4px; }
      .cb-create-menu button:hover { background: var(--highlight); }
    `;
    document.head.appendChild(st);
  }

  ensureStyles();

  console.info('[Editor.ContentBrowser] ready');
})();
