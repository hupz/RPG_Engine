// ============================================================
// Content Browser 2.0 (UI-14) — unified project content navigation
// Uses EditorContentIndex + editor-content-workflow APIs. No new data registry.
// ============================================================
(function attachContentBrowserV2() {
  'use strict';

  if (typeof Editor === 'undefined') return;

  const IDX = typeof EditorContentIndex !== 'undefined' ? EditorContentIndex : null;

  const CATEGORIES = [
    { id: 'scenes', indexId: 'scenes', label: 'Сцены', icon: '🎬', createType: 'scene', openType: 'scene' },
    { id: 'quests', indexId: 'quests', label: 'Квесты', icon: '📜', createType: 'quest', openType: 'quest' },
    { id: 'items', indexId: 'items', label: 'Предметы', icon: '🎒', createType: 'item', openType: 'item' },
    { id: 'npcs', indexId: 'npcs', label: 'NPC', icon: '👤', createType: 'npc', openType: 'npc' },
    { id: 'characters', indexId: 'player_characters', label: 'Герои', icon: '🎭', createType: 'player_character', openType: 'player_character' },
    { id: 'combat', indexId: 'enemies', label: 'Бой', icon: '⚔', createType: 'enemy', openType: 'enemy' },
    { id: 'game_ui', indexId: 'ui_screens', label: 'Игровой UI', icon: '🖥', createType: 'ui_screen', openType: 'ui_screen' },
    { id: 'assets', indexId: 'assets', label: 'Ассеты', icon: '📦', createType: 'asset', openType: 'asset' }
  ];

  Editor._contentBrowserCategory = Editor._contentBrowserCategory || 'scenes';
  Editor._contentBrowserQuery = Editor._contentBrowserQuery || '';

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

  function getStats() {
    if (!IDX || !Editor.data) return {};
    return IDX.collectProjectContentStats(Editor.data);
  }

  function categoryDef(catId) {
    return CATEGORIES.find((c) => c.id === catId) || CATEGORIES[0];
  }

  function ensureRecentStore() {
    if (!Editor.workspace) Editor.workspace = {};
    if (!Array.isArray(Editor.workspace.recentContent)) {
      Editor.workspace.recentContent = [];
    }
    return Editor.workspace.recentContent;
  }

  function trackRecentOpen(type, id, title) {
    if (!type || !id) return;
    const list = ensureRecentStore();
    const next = list.filter((e) => !(e.type === type && e.id === id));
    next.unshift({ type, id, title: title || id, at: Date.now() });
    Editor.workspace.recentContent = next.slice(0, 8);
  }

  function isProjectEmpty() {
    if (!Editor.data) return true;
    const stats = getStats();
    return CATEGORIES.every((c) => (stats[c.indexId] || 0) === 0);
  }

  function getCategoryCount(cat) {
    return getStats()[cat.indexId] || 0;
  }

  function visibleCategories() {
    if (!Editor.data) return [];
    return CATEGORIES.filter((cat) => {
      if (cat.id === 'scenes') return true;
      if (Editor.data[cat.indexId] != null) return true;
      if (cat.indexId === 'player_characters' && Editor.data.playerCharacters != null) return true;
      if (cat.indexId === 'ui_screens' && Editor.data.ui != null) return true;
      if (cat.indexId === 'enemies' && Editor.data.enemies != null) return true;
      return getCategoryCount(cat) > 0;
    });
  }

  function openContentFromBrowser(type, id, title) {
    if (!type || id == null || id === '') return false;
    let ok = false;
    if (type === 'scene' || type === 'visual_scene') {
      ok = typeof Editor.openSceneFromContentBrowser === 'function'
        ? Editor.openSceneFromContentBrowser(id)
        : false;
      if (!ok && typeof Editor.openContentEntity === 'function') {
        ok = Editor.openContentEntity('scene', id);
      }
    } else if (typeof Editor.openContentEntity === 'function') {
      ok = Editor.openContentEntity(type, id);
    }
    if (ok) trackRecentOpen(type, id, title);
    return ok;
  }

  function createFromBrowser(createType) {
    if (createType === 'scene') {
      if (typeof Editor.createSceneFromBrowser === 'function') {
        return Editor.createSceneFromBrowser('text');
      }
    }
    if (typeof Editor.createContentEntity === 'function') {
      return Editor.createContentEntity(createType);
    }
    return false;
  }

  function renderGlobalSearchResults(query) {
    if (!IDX || !query.trim()) return null;
    const buildIndex = () => IDX.buildContentBrowserIndex(Editor.data, { writerMode: isWriter() });
    const all = typeof Editor.Perf?.getCachedContentBrowserIndex === 'function'
      ? Editor.Perf.getCachedContentBrowserIndex(buildIndex)
      : buildIndex();
    const hits = IDX.filterContentEntries(all, { category: 'all', query });
    if (!hits.length) {
      return '<p class="hint cb-no-match">Ничего не найдено по запросу «' + esc(query) + '»</p>';
    }
    return (
      '<div class="cb2-global-results">' +
      '<div class="cb2-global-results__title hint">Результаты поиска (' + hits.length + ')</div>' +
      hits.slice(0, 40).map((row) =>
        '<button type="button" class="cb2-row cb2-row--search" data-cb2-open="' + escAttr(row.type) +
        '" data-cb2-id="' + escAttr(row.id) + '" data-cb2-title="' + escAttr(row.title) + '">' +
        '<span class="cb2-row__title">' + esc(row.title) + '</span>' +
        '<span class="cb2-row__type hint">' + esc(row.categoryLabel || row.type) + '</span>' +
        '</button>'
      ).join('') +
      '</div>'
    );
  }

  function renderRecentBlock() {
    const recent = ensureRecentStore().filter((e) => {
      if (e.type === 'scene' || e.type === 'visual_scene') {
        return !!Editor.data?.scenes?.[e.id];
      }
      return true;
    });
    if (!recent.length) return '';
    return (
      '<div class="cb2-recent">' +
      '<div class="cb2-recent__title hint">Недавно открыто</div>' +
      recent.map((e) =>
        '<button type="button" class="cb2-recent__item" data-cb2-open="' + escAttr(e.type) +
        '" data-cb2-id="' + escAttr(e.id) + '" data-cb2-title="' + escAttr(e.title) + '">' +
        esc(e.title) + '</button>'
      ).join('') +
      '</div>'
    );
  }

  function renderCategoryNav(activeId) {
    const cats = visibleCategories();
    return (
      '<nav class="cb2-cat-nav" aria-label="Категории контента">' +
      cats.map((cat) => {
        const n = getCategoryCount(cat);
        const active = cat.id === activeId ? ' is-active' : '';
        return '<button type="button" class="cb2-cat-btn' + active + '" data-cb2-cat="' + escAttr(cat.id) + '">' +
          '<span class="cb2-cat-btn__icon" aria-hidden="true">' + cat.icon + '</span>' +
          '<span class="cb2-cat-btn__label">' + esc(cat.label) + '</span>' +
          '<span class="cb2-cat-btn__count">' + n + '</span></button>';
      }).join('') +
      '</nav>'
    );
  }

  function renderEmptyProjectWelcome() {
    return (
      '<div class="cb-welcome empty-state cb-empty cb2-welcome" role="status">' +
      '<h2>Welcome to your RPG project</h2>' +
      '<p>Start with your first scene — quests, items, and visuals live here too.</p>' +
      '<div class="cb-welcome__actions">' +
      '<button type="button" class="btn btn-primary btn-sm" data-cb2-create="scene">Create First Scene</button>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-cb2-template="1">Choose Template</button>' +
      '</div></div>'
    );
  }

  function renderGenericRow(row, cat) {
    const active = (cat.openType === 'scene' && Editor.currentScene === row.id) ? ' is-active' : '';
    return (
      '<article class="cb2-row cb2-object-row' + active + '" data-cb2-open="' + escAttr(row.type || cat.openType) +
      '" data-cb2-id="' + escAttr(row.id) + '" data-cb2-title="' + escAttr(row.title) + '">' +
      '<div class="cb2-row__main">' +
      '<div class="cb2-row__title">' + esc(row.title) + '</div>' +
      (row.meta ? '<div class="cb2-row__meta hint">' + esc(row.meta) + '</div>' : '') +
      (isAdvanced() ? '<div class="cb2-row__id hint"><code>' + esc(row.id) + '</code></div>' : '') +
      '</div></article>'
    );
  }

  function renderCategoryList(catId) {
    const cat = categoryDef(catId);
    if (!IDX) return '<p class="hint">Content index не загружен</p>';

    if (catId === 'scenes') {
      return null;
    }

    const rows = IDX.collectEntriesForCategory(cat.indexId, Editor.data);
    const q = String(Editor._contentBrowserQuery || '').trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) => [r.title, r.id, r.meta].join(' ').toLowerCase().indexOf(q) >= 0)
      : rows;

    if (!filtered.length) {
      const createLabel = {
        quest: '+ Создать квест',
        item: '+ Создать предмет',
        npc: '+ Создать NPC',
        player_character: '+ Создать героя',
        enemy: '+ Создать врага',
        ui_screen: '+ Создать UI-экран',
        asset: '+ Добавить ассет'
      }[cat.createType] || '+ Создать';
      if (typeof Editor.AuthorGuidance !== 'undefined') {
        const wrap = document.createElement('div');
        Editor.renderAuthorEmptyState(wrap, 'content_category', {
          title: 'Нет объектов',
          explanation: 'Категория «' + (cat.label || '') + '» пуста. Создайте первый объект.',
          primaryLabel: createLabel,
          action: 'create-content',
          createType: cat.createType
        });
        return wrap.innerHTML;
      }
      return (
        '<div class="cb2-empty empty-state">' +
        '<p class="cb2-empty__title">Нет объектов</p>' +
        '<p class="hint">Категория «' + esc(cat.label) + '» пуста.</p>' +
        '<button type="button" class="btn btn-primary btn-sm" data-cb2-create="' + escAttr(cat.createType) + '">' +
        esc(createLabel) + '</button></div>'
      );
    }

    return (
      '<div class="cb2-list">' +
      '<div class="cb2-list__head"><span class="cb2-list__title">' + esc(cat.label) +
      '</span><span class="cb2-list__count hint">(' + filtered.length + ')</span></div>' +
      filtered.map((row) => renderGenericRow(row, cat)).join('') +
      '</div>'
    );
  }

  function renderUnifiedCreateMenu() {
    const cats = visibleCategories();
    return (
      '<div class="cb2-create-wrap">' +
      '<button type="button" class="btn btn-primary btn-sm cb2-create-toggle" id="cb2-create-toggle">+ Create</button>' +
      '<div class="cb2-create-menu" id="cb2-create-menu" hidden>' +
      cats.map((cat) =>
        '<button type="button" data-cb2-create="' + escAttr(cat.createType) + '">' +
        esc(cat.icon + ' ' + cat.label) + '</button>'
      ).join('') +
      '</div></div>'
    );
  }

  function renderBrowserChromeV2() {
    const cat = Editor._contentBrowserCategory || 'scenes';
    const query = Editor._contentBrowserQuery || '';
    const catDef = categoryDef(cat);
    const count = getCategoryCount(catDef);

    return (
      '<div class="cb2-browser-head">' +
      '<div class="cb-browser-title">CONTENT</div>' +
      '<input type="search" id="cb2-global-search" class="cb-search cb2-global-search" ' +
      'placeholder="🔍 Поиск по проекту…" value="' + escAttr(query) + '" autocomplete="off" />' +
      renderCategoryNav(cat) +
      '<div class="cb2-section-head">' +
      '<span class="cb2-section-head__title">' + esc(catDef.label) +
      (count ? ' <span class="hint">(' + count + ')</span>' : '') +
      '</span></div>' +
      (cat === 'scenes' && typeof Editor.renderSceneContentBrowser === 'function'
        ? '' : '') +
      '</div>'
    );
  }

  function ensureBrowserChromeV2(forceRebuild) {
    const sidebar = document.getElementById('context-sidebar');
    if (!sidebar) return;

    const cat = Editor._contentBrowserCategory || 'scenes';
    const query = Editor._contentBrowserQuery || '';

    let chrome = document.getElementById('cb-browser-chrome');
    if (!chrome) {
      chrome = document.createElement('div');
      chrome.id = 'cb-browser-chrome';
      chrome.className = 'cb-browser-chrome cb2-browser-chrome';
      const sceneList = document.getElementById('scene-list');
      const scenesPane = document.getElementById('context-scenes-pane');
      const pcm = document.getElementById('pcm-chrome');
      const parent = (sceneList && sceneList.parentNode) || scenesPane || sidebar;
      if (pcm && pcm.parentNode) pcm.style.display = 'none';
      if (sceneList && sceneList.parentNode === parent) parent.insertBefore(chrome, sceneList);
      else if (scenesPane) scenesPane.insertBefore(chrome, scenesPane.firstChild);
      else sidebar.insertBefore(chrome, sidebar.firstChild);
      forceRebuild = true;
    }
    chrome.classList?.add?.('cb2-browser-chrome');
    if (!chrome.classList) chrome.className = (chrome.className || '') + ' cb2-browser-chrome';

    const needsRebuild = forceRebuild || Editor._cb2ForceChromeRebuild || chrome.dataset.cb2Cat !== cat || !chrome.dataset.cb2Bound;
    if (needsRebuild) {
      chrome.innerHTML = renderBrowserChromeV2();
      chrome.dataset.cb2Cat = cat;
      Editor._cb2ForceChromeRebuild = false;
    } else {
      const globalSearch = chrome.querySelector('#cb2-global-search');
      if (globalSearch && globalSearch.value !== query) globalSearch.value = query;
      const sceneSearch = chrome.querySelector('#cb-scene-search');
      const sceneQ = Editor._sceneListQuery || '';
      if (sceneSearch && sceneSearch.value !== sceneQ) sceneSearch.value = sceneQ;
    }

    if (!chrome.dataset.cb2Bound) {
      chrome.dataset.cb2Bound = '1';
      chrome.addEventListener('input', (ev) => {
        if (ev.target.id === 'cb2-global-search') {
          Editor._contentBrowserQuery = ev.target.value || '';
          if (typeof Editor.Perf?.debouncedSceneListRender === 'function') {
            Editor.Perf.debouncedSceneListRender();
          } else {
            Editor.renderSceneList?.();
          }
        }
        if (ev.target.id === 'cb-scene-search') {
          Editor._sceneListQuery = ev.target.value || '';
          Editor._contentBrowserQuery = ev.target.value || '';
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
          Editor._cb2ForceChromeRebuild = true;
          Editor.renderSceneList?.();
        }
      });
      chrome.addEventListener('click', (ev) => {
        const catBtn = ev.target.closest('[data-cb2-cat]');
        if (catBtn) {
          Editor._contentBrowserCategory = catBtn.getAttribute('data-cb2-cat') || 'scenes';
          Editor._cb2ForceChromeRebuild = true;
          chrome.querySelectorAll('[data-cb2-cat]').forEach((b) => {
            b.classList.toggle('is-active', b === catBtn);
          });
          const head = chrome.querySelector('.cb2-section-head__title');
          if (head) {
            const c = categoryDef(Editor._contentBrowserCategory);
            head.innerHTML = esc(c.label) + ' <span class="hint">(' + getCategoryCount(c) + ')</span>';
          }
          Editor.renderSceneList?.();
          return;
        }
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

    let sceneFilters = document.getElementById('cb2-scene-filters');
    if (cat === 'scenes') {
      if (!sceneFilters && typeof Editor.renderContentBrowserChrome === 'function') {
        const tmp = document.createElement('div');
        tmp.innerHTML = (function () {
          const filter = Editor._sceneListFilter || 'all';
          const sort = Editor._sceneListSort || 'title';
          const pills = [
            { id: 'all', label: 'Все' },
            { id: 'text', label: 'Text' },
            { id: 'visual', label: 'Visual' },
            { id: 'mixed', label: 'Mixed' }
          ].map((p) =>
            '<button type="button" class="cb-filter-pill' + (filter === p.id ? ' is-active' : '') +
            '" data-cb-filter="' + escAttr(p.id) + '">' + esc(p.label) + '</button>'
          ).join('');
          const sortOpts = [
            { id: 'title', label: 'По имени' },
            { id: 'title_desc', label: 'Имя (Я→А)' },
            { id: 'kind', label: 'По типу' }
          ].map((o) =>
            '<option value="' + escAttr(o.id) + '"' + (sort === o.id ? ' selected' : '') + '>' + esc(o.label) + '</option>'
          ).join('');
          return '<div id="cb2-scene-filters" class="cb2-scene-filters">' +
            '<input type="search" id="cb-scene-search" class="cb-search" placeholder="🔍 Поиск сцен…" ' +
            'value="' + escAttr(Editor._sceneListQuery || Editor._contentBrowserQuery || '') + '" />' +
            '<div class="cb-filter-row">' + pills + '</div>' +
            '<div class="cb-sort-row"><label class="hint">Сортировка</label>' +
            '<select id="cb-scene-sort" class="cb-sort">' + sortOpts + '</select></div></div>';
        })();
        sceneFilters = tmp.firstElementChild;
        chrome.appendChild(sceneFilters);
      }
      if (sceneFilters) sceneFilters.hidden = false;
    } else if (sceneFilters) {
      sceneFilters.hidden = true;
    }

    let footer = document.getElementById('cb-create-footer');
    if (!footer) {
      footer = document.createElement('div');
      footer.id = 'cb-create-footer';
      footer.className = 'cb-create-footer cb2-create-footer';
      (document.getElementById('context-scenes-pane') || sidebar).appendChild(footer);
    }
    footer.innerHTML = renderUnifiedCreateMenu();
    footer.classList?.add?.('cb2-create-footer');
    if (!footer.classList) footer.className = (footer.className || '') + ' cb2-create-footer';
    const createMenu = footer.querySelector('#cb2-create-menu');
    if (createMenu) createMenu.hidden = true;

    if (!footer.dataset.cb2Bound) {
      footer.dataset.cb2Bound = '1';
      footer.addEventListener('click', (ev) => {
        const toggle = ev.target.closest('#cb2-create-toggle');
        if (toggle) {
          const menu = document.getElementById('cb2-create-menu');
          if (menu) menu.hidden = !menu.hidden;
          ev.stopPropagation();
          return;
        }
        const createBtn = ev.target.closest('[data-cb2-create]');
        if (createBtn) {
          createFromBrowser(createBtn.getAttribute('data-cb2-create'));
          const menu = document.getElementById('cb2-create-menu');
          if (menu) menu.hidden = true;
          Editor.renderSceneList?.();
        }
      });
    }

    if (!document.body.dataset.cb2CreateDismissBound) {
      document.body.dataset.cb2CreateDismissBound = '1';
      document.addEventListener('click', (ev) => {
        const menu = document.getElementById('cb2-create-menu');
        const toggle = document.getElementById('cb2-create-toggle');
        if (!menu || menu.hidden) return;
        if (ev.target.closest('#cb2-create-footer') || ev.target.closest('#cb2-create-menu')) return;
        menu.hidden = true;
        toggle?.setAttribute('aria-expanded', 'false');
      });
    }
  }

  function bindBrowserListV2(root) {
    if (!root || root._cb2Bound) return;
    root._cb2Bound = true;
    root.addEventListener('click', (ev) => {
      const openBtn = ev.target.closest('[data-cb2-open]');
      if (openBtn && root.contains(openBtn)) {
        ev.stopPropagation();
        openContentFromBrowser(
          openBtn.getAttribute('data-cb2-open'),
          openBtn.getAttribute('data-cb2-id'),
          openBtn.getAttribute('data-cb2-title')
        );
        return;
      }
      const createBtn = ev.target.closest('[data-cb2-create]');
      if (createBtn && root.contains(createBtn)) {
        createFromBrowser(createBtn.getAttribute('data-cb2-create'));
        Editor.renderSceneList?.();
        return;
      }
      const guidanceBtn = ev.target.closest('[data-guidance-action]');
      if (guidanceBtn && root.contains(guidanceBtn)) {
        if (typeof Editor.runAuthorGuidanceAction === 'function') {
          Editor.runAuthorGuidanceAction(
            guidanceBtn.getAttribute('data-guidance-action'),
            guidanceBtn.getAttribute('data-guidance-payload')
          );
        }
        Editor.renderSceneList?.();
        return;
      }
      const tplBtn = ev.target.closest('[data-cb2-template]');
      if (tplBtn) {
        if (typeof Editor.openProjectTemplatePicker === 'function') Editor.openProjectTemplatePicker();
        else if (typeof Editor.openNewProjectModal === 'function') Editor.openNewProjectModal();
        else if (typeof Editor.openSceneWizard === 'function') Editor.openSceneWizard();
      }
    });
  }

  const BROWSER_SECTION_IDS = new Set([
    'scenes', 'items', 'quests', 'npcs', 'enemies', 'game_ui', 'assets'
  ]);

  function isContentBrowserTabActive() {
    const tab = Editor.currentTab || 'scenes';
    if (tab === 'scenes') return true;
    const section = typeof Editor.getNavSectionForTab === 'function'
      ? Editor.getNavSectionForTab(tab)
      : null;
    return !!(section && BROWSER_SECTION_IDS.has(section.id));
  }

  function renderUnifiedContentBrowser() {
    if (!isContentBrowserTabActive()) {
      const chrome = document.getElementById('cb-browser-chrome');
      if (chrome) chrome.hidden = true;
      return;
    }
    const chrome = document.getElementById('cb-browser-chrome');
    if (chrome) chrome.hidden = false;
    ensureBrowserChromeV2(false);
    const list = document.getElementById('scene-list');
    if (!list) return;

    if (!Editor.data) {
      list.innerHTML = '';
      return;
    }

    if (isProjectEmpty()) {
      list.innerHTML = renderEmptyProjectWelcome();
      bindBrowserListV2(list);
      return;
    }

    const globalQ = String(Editor._contentBrowserQuery || '').trim();
    let html = renderRecentBlock();
    if (globalQ.length >= 2) {
      html += renderGlobalSearchResults(globalQ) || '';
      list.innerHTML = html;
      bindBrowserListV2(list);
      return;
    }

    const cat = Editor._contentBrowserCategory || 'scenes';
    if (cat === 'scenes' && !globalQ) {
      list.innerHTML = html;
      const mount = document.createElement('div');
      mount.className = 'cb2-scenes-mount';
      list.appendChild(mount);
      if (typeof Editor.renderSceneContentBrowser === 'function') {
        Editor.renderSceneContentBrowser({ listEl: mount, skipChrome: true });
      }
      bindBrowserListV2(list);
      return;
    }

    const body = renderCategoryList(cat);
    list.innerHTML = html + (body || '');
    bindBrowserListV2(list);
  }

  const origOpenScene = Editor.openSceneFromContentBrowser;
  if (typeof origOpenScene === 'function') {
    Editor.openSceneFromContentBrowser = function openSceneFromBrowserV2(sceneId) {
      const scene = Editor.data?.scenes?.[sceneId];
      const title = scene?.location || scene?.title || sceneId;
      const ok = origOpenScene.call(this, sceneId);
      if (ok) trackRecentOpen('scene', sceneId, title);
      return ok;
    };
  }

  Object.assign(Editor, {
    openContentFromBrowser,
    trackContentBrowserRecent: trackRecentOpen,
    getContentBrowserCategories() { return CATEGORIES.slice(); },
    setContentBrowserCategory(catId) {
      Editor._contentBrowserCategory = catId || 'scenes';
      Editor.renderSceneList?.();
    },
    searchProjectContent(query) {
      if (!IDX) return [];
      const all = IDX.buildContentBrowserIndex(Editor.data || {}, { writerMode: isWriter() });
      return IDX.filterContentEntries(all, { category: 'all', query: query || '' });
    },
    isProjectContentEmpty: isProjectEmpty,
    renderUnifiedContentBrowser
  });

  if (Editor.hooks?.replace) {
    Editor.hooks.replace('renderSceneList', function renderSceneListUI14() {
      return renderUnifiedContentBrowser();
    }, 'editor-content-browser-v2');
  }

  if (typeof Editor.openContentCategory === 'function') {
    const origOpenCat = Editor.openContentCategory.bind(Editor);
    Editor.openContentCategory = function openContentCategoryV2(categoryId) {
      const map = {
        scenes: 'scenes',
        visual_scenes: 'scenes',
        items: 'items',
        quests: 'quests',
        npcs: 'npcs',
        player_characters: 'characters',
        enemies: 'combat',
        ui_screens: 'game_ui',
        assets: 'assets'
      };
      const cbCat = map[categoryId] || 'scenes';
      Editor._contentBrowserCategory = cbCat;
      Editor.switchTab?.('scenes');
      Editor.renderSceneList?.();
      return origOpenCat(categoryId);
    };
  }

  function ensureStyles() {
    if (typeof document === 'undefined' || document.getElementById('cb2-styles')) return;
    const st = document.createElement('style');
    st.id = 'cb2-styles';
    st.textContent = `
      .cb2-cat-nav { display: flex; flex-direction: column; gap: 2px; margin: 6px 0; }
      .cb2-cat-btn { display: flex; align-items: center; gap: 6px; width: 100%; padding: 5px 8px;
        border: none; border-radius: 4px; background: transparent; cursor: pointer; font-size: 12px; text-align: left; }
      .cb2-cat-btn:hover, .cb2-cat-btn.is-active { background: var(--highlight); }
      .cb2-cat-btn__icon { width: 18px; text-align: center; }
      .cb2-cat-btn__label { flex: 1; }
      .cb2-cat-btn__count { font-size: 10px; color: var(--ink-faint); }
      .cb2-section-head { margin: 6px 0 4px; font-size: 12px; font-weight: 600; }
      .cb2-global-search { margin-bottom: 6px; }
      .cb2-recent { margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
      .cb2-recent__title { font-size: 10px; font-weight: 700; letter-spacing: .04em; margin-bottom: 4px; }
      .cb2-recent__item { display: block; width: 100%; text-align: left; border: none; background: transparent;
        padding: 3px 6px; font-size: 11px; cursor: pointer; border-radius: 3px; }
      .cb2-recent__item:hover { background: var(--highlight); }
      .cb2-row { display: block; width: 100%; text-align: left; border: none; background: transparent;
        padding: 7px 6px; cursor: pointer; border-bottom: 1px solid rgba(0,0,0,.05); }
      .cb2-row:hover, .cb2-row.is-active { background: var(--highlight); }
      .cb2-row__title { font-weight: 600; font-size: 13px; }
      .cb2-row__type { font-size: 10px; display: block; }
      .cb2-list__head { display: flex; gap: 4px; align-items: baseline; padding: 4px 6px; }
      .cb2-empty { padding: 12px 8px; text-align: center; }
      .cb2-empty__title { font-weight: 600; margin: 0 0 4px; }
      .cb2-create-wrap { position: relative; }
      .cb2-create-menu { position: absolute; bottom: 100%; left: 0; right: 0; background: var(--card-bg, #fff);
        border: 1px solid var(--border); border-radius: 6px; padding: 4px; margin-bottom: 4px; z-index: 10;
        flex-direction: column; gap: 2px; max-height: 240px; overflow-y: auto; }
      .cb2-create-menu:not([hidden]) { display: flex; }
      .cb2-create-menu[hidden] { display: none !important; }
      .cb2-create-menu button { text-align: left; border: none; background: transparent; padding: 6px 8px;
        cursor: pointer; font-size: 12px; border-radius: 4px; }
      .cb2-create-menu button:hover { background: var(--highlight); }
      .cb2-scene-filters { margin-top: 4px; padding-top: 4px; border-top: 1px solid var(--border); }
      #cb2-scenes-mount .cb-browser-chrome { display: none; }
      body.editor-app .cb2-browser-chrome ~ #pcm-chrome,
      body.editor-app #cb-browser-chrome.cb2-browser-chrome ~ #pcm-chrome,
      body.editor-app .cb2-browser-chrome #pcm-chrome { display: none !important; }
      body.editor-app .cb2-browser-chrome ~ h3:not(.context-sidebar-title),
      body.editor-app #context-scenes-pane > h3:not(.context-sidebar-title) { display: none; }
      body.editor-app #context-browser-mount[hidden] { display: none !important; }
    `;
    document.head.appendChild(st);
  }

  ensureStyles();

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-content-browser-v2', {
      openContentFromBrowser,
      renderUnifiedContentBrowser,
      searchProjectContent: Editor.searchProjectContent
    }, { force: true });
  }

  console.info('[Editor.ContentBrowserV2] ready');
})();
