/**
 * Phase 1.11 — Project & Content Workflow UX layer
 */
(function attachEditorContentWorkflow() {
  'use strict';

  if (typeof Editor === 'undefined') return;

  const IDX = typeof EditorContentIndex !== 'undefined' ? EditorContentIndex : null;

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

  function getStats() {
    if (IDX && typeof IDX.collectProjectContentStats === 'function') {
      return IDX.collectProjectContentStats(Editor.data || {});
    }
    return {};
  }

  const CREATE_HANDLERS = {
    scene() {
      Editor.openSceneWizard();
    },
    item() {
      if (typeof Editor.createItem === 'function') Editor.createItem();
    },
    quest() {
      if (typeof Editor.createQuest === 'function') Editor.createQuest();
    },
    npc() {
      if (typeof Editor.createNPC === 'function') Editor.createNPC();
    },
    player_character() {
      if (typeof Editor.createPlayerCharacterTemplate === 'function') Editor.createPlayerCharacterTemplate();
    },
    enemy() {
      if (typeof Editor.createEnemy === 'function') Editor.createEnemy();
    },
    ui_screen() {
      if (typeof Editor.uiAddScreen === 'function') Editor.uiAddScreen();
      else if (typeof Editor.switchTab === 'function') Editor.switchTab('game_ui');
    },
    asset() {
      if (typeof Editor.addProjectAssetFromPath === 'function') Editor.addProjectAssetFromPath();
      else if (typeof Editor.switchTab === 'function') Editor.switchTab('media');
    }
  };

  const OPEN_HANDLERS = {
    scene(id) {
      if (typeof Editor.openSceneFromContentBrowser === 'function') {
        Editor.openSceneFromContentBrowser(id);
      } else if (typeof Editor.openSceneWorkspace === 'function') {
        Editor.openSceneWorkspace(id);
      } else if (typeof Editor.openSceneDocument === 'function') {
        Editor.openSceneDocument(id);
      } else if (typeof Editor.selectScene === 'function') {
        Editor.selectScene(id);
      } else {
        Editor.currentScene = id;
      }
      Editor.switchTab?.('scenes');
      Editor.renderSceneEditor?.();
    },
    visual_scene(id) {
      OPEN_HANDLERS.scene(id);
    },
    item(id) {
      Editor.switchTab?.('items');
      if (typeof Editor.selectItemToEdit === 'function') Editor.selectItemToEdit(id);
      else {
        Editor.editingItemId = id;
        Editor.renderItems?.();
      }
    },
    quest(id) {
      Editor.switchTab?.('quests');
      if (typeof Editor.selectQuestToEdit === 'function') Editor.selectQuestToEdit(id);
      else {
        Editor.editingQuestId = id;
        Editor.renderQuests?.();
      }
    },
    npc(id) {
      Editor.switchTab?.('npcs');
      if (typeof Editor.selectNpcToEdit === 'function') Editor.selectNpcToEdit(id);
      else {
        Editor.editingNpcId = id;
        Editor.renderNPCs?.();
      }
    },
    player_character(id) {
      Editor.switchTab?.('player_characters');
      if (typeof Editor.selectPlayerCharacterToEdit === 'function') Editor.selectPlayerCharacterToEdit(id);
      else {
        Editor.editingPlayerCharacterId = id;
        Editor.renderPlayerCharacters?.();
      }
    },
    enemy(id) {
      Editor.switchTab?.('enemies');
      Editor.editingEnemyId = id;
      Editor.renderEnemies?.();
    },
    ui_screen(id) {
      Editor.switchTab?.('game_ui');
      if (typeof Editor.uiSelectScreen === 'function') Editor.uiSelectScreen(id);
      else Editor._uiSelectedScreen = id;
      Editor.renderGameUiEditor?.();
    },
    asset(id) {
      Editor.switchTab?.('media');
      if (typeof Editor.selectAssetToEdit === 'function') Editor.selectAssetToEdit(id);
      else Editor._editingAssetId = id;
      Editor.renderMediaAssets?.();
    }
  };

  const TAB_HANDLERS = {
    scenes: () => Editor.switchTab?.('scenes'),
    items: () => Editor.switchTab?.('items'),
    quests: () => Editor.switchTab?.('quests'),
    npcs: () => Editor.switchTab?.('npcs'),
    player_characters: () => Editor.switchTab?.('player_characters'),
    enemies: () => Editor.switchTab?.('enemies'),
    game_ui: () => Editor.switchTab?.('game_ui'),
    media: () => Editor.switchTab?.('media')
  };

  Object.assign(Editor, {
    getProjectContentStats() {
      return getStats();
    },

    createContentEntity(type) {
      const fn = CREATE_HANDLERS[type];
      if (typeof fn !== 'function') return false;
      try {
        fn();
        Editor.refreshDashboardIfVisible?.();
        Editor.renderContentBrowser?.();
        return true;
      } catch (e) {
        console.error('[content-workflow] create', type, e);
        return false;
      }
    },

    openContentCategory(categoryId) {
      if (!IDX) return false;
      const cat = IDX.CATEGORIES.find((c) => c.id === categoryId);
      if (!cat) return false;
      const fn = TAB_HANDLERS[cat.tab];
      if (typeof fn === 'function') {
        fn();
        return true;
      }
      return false;
    },

    openContentEntity(type, id) {
      if (!type || id == null || id === '') return false;
      const fn = OPEN_HANDLERS[type];
      if (typeof fn !== 'function') return false;
      try {
        fn(String(id));
        return true;
      } catch (e) {
        console.error('[content-workflow] open', type, id, e);
        return false;
      }
    },

    renderContentBrowserPanel(opts) {
      opts = opts || {};
      if (!Editor.data) {
        return '<div class="content-browser-empty hint">Загрузите проект, чтобы просматривать контент.</div>';
      }
      if (!IDX) return '<div class="content-browser-empty hint">Content index не загружен.</div>';

      const writer = opts.writerMode != null ? opts.writerMode : isWriter();
      const category = opts.category || Editor._contentBrowserCategory || 'all';
      const query = opts.query != null ? opts.query : (Editor._contentBrowserQuery || '');
      const categories = IDX.getVisibleCategories({ writerMode: writer, data: Editor.data });
      const allEntries = IDX.buildContentBrowserIndex(Editor.data, { writerMode: writer });
      const entries = IDX.filterContentEntries(allEntries, { category, query });
      const stats = IDX.collectProjectContentStats(Editor.data);

      let html = '<div class="content-browser-root">';
      html += '<div class="content-browser-toolbar">';
      html += `<input type="search" class="content-browser-search form-control" placeholder="Поиск контента…" value="${escAttr(query)}" id="content-browser-search-input">`;
      html += '<select class="content-browser-filter form-control" id="content-browser-category-filter">';
      html += `<option value="all"${category === 'all' ? ' selected' : ''}>Все категории</option>`;
      categories.forEach((cat) => {
        const n = stats[cat.id] || 0;
        const sel = category === cat.id ? ' selected' : '';
        html += `<option value="${escAttr(cat.id)}"${sel}>${esc(cat.labelRu)} (${n})</option>`;
      });
      html += '</select></div>';

      if (!entries.length) {
        html += '<div class="content-browser-empty"><p>Ничего не найдено.</p>';
        if (category !== 'all') {
          const catDef = IDX.CATEGORIES.find((c) => c.id === category);
          if (catDef && catDef.createType) {
            html += `<button type="button" class="btn btn-primary btn-sm" data-cb-create="${escAttr(catDef.createType)}">+ Создать</button>`;
          }
        }
        html += '</div></div>';
        return html;
      }

      let lastCat = null;
      entries.forEach((row) => {
        if (row.categoryId !== lastCat) {
          if (lastCat) html += '</ul>';
          lastCat = row.categoryId;
          const n = stats[row.categoryId] || 0;
          html += `<h3 class="content-browser-cat">${esc(row.categoryLabel)} <span class="hint">(${n})</span></h3>`;
          html += '<ul class="content-browser-list">';
        }
        const showId = !writer;
        html += `<li class="content-browser-item">
          <button type="button" class="content-browser-link" data-cb-open="${escAttr(row.type)}" data-cb-id="${escAttr(row.id)}">
            <span class="content-browser-title">${esc(row.title)}</span>
            ${showId ? `<code class="content-browser-id">${esc(row.id)}</code>` : ''}
            ${row.meta ? `<span class="content-browser-meta hint">${esc(row.meta)}</span>` : ''}
          </button>
        </li>`;
      });
      if (lastCat) html += '</ul>';

      html += '<div class="content-browser-create-row">';
      const activeCat = category !== 'all'
        ? IDX.CATEGORIES.find((c) => c.id === category)
        : null;
      const createType = activeCat?.createType;
      if (createType) {
        html += `<button type="button" class="btn btn-secondary btn-sm" data-cb-create="${escAttr(createType)}">+ Новая сущность</button>`;
      }
      html += '</div></div>';
      return html;
    },

    renderProjectDashboardContentSection() {
      if (!Editor.data) return '';
      const stats = getStats();
      const writer = isWriter();

      const cards = [
        { id: 'scenes', icon: '🎬', label: 'Сцены', tab: 'scenes', create: 'scene' },
        { id: 'visual_scenes', icon: '🖼', label: 'Visual', tab: 'scenes', create: 'scene' },
        { id: 'items', icon: '🎒', label: 'Предметы', tab: 'items', create: 'item' },
        { id: 'quests', icon: '📜', label: 'Квесты', tab: 'quests', create: 'quest' },
        { id: 'npcs', icon: '👤', label: 'NPC', tab: 'npcs', create: 'npc' },
        { id: 'player_characters', icon: '🎭', label: 'Герои', tab: 'player_characters', create: 'player_character' },
        { id: 'enemies', icon: '👹', label: 'Враги', tab: 'enemies', create: 'enemy' },
        { id: 'ui_screens', icon: '🖥', label: 'Game UI', tab: 'game_ui', create: 'ui_screen' },
        { id: 'assets', icon: '📦', label: 'Ассеты', tab: 'media', create: 'asset' }
      ];

      let cardsHtml = cards.map((c) => {
        const n = stats[c.id] || 0;
        return `<button type="button" class="dashboard-content-card paper-sheet" data-dc-tab="${escAttr(c.tab)}" data-dc-cat="${escAttr(c.id)}" title="Открыть раздел">
          <span class="dashboard-content-icon">${c.icon}</span>
          <span class="dashboard-content-value">${n}</span>
          <span class="dashboard-content-label">${esc(c.label)}</span>
        </button>`;
      }).join('');

      let quickHtml = cards.map((c) =>
        `<button type="button" class="btn btn-secondary btn-sm" data-dc-create="${escAttr(c.create)}" title="${esc(c.label)}">+ ${esc(c.label)}</button>`
      ).join('');

      return `<div class="paper-sheet dashboard-content-section">
        <h3>📊 Контент проекта</h3>
        <p class="hint">Реальные данные из Editor.data — нажмите на карточку, чтобы открыть раздел.</p>
        <div class="dashboard-content-grid">${cardsHtml}</div>
        <h4 style="margin-top:16px;">Быстрое создание</h4>
        <div class="dashboard-quick-create-row">${quickHtml}</div>
        <h4 style="margin-top:20px;">Content Browser</h4>
        <div id="content-browser-mount">${Editor.renderContentBrowserPanel({ writerMode: writer })}</div>
      </div>`;
    },

    renderContentBrowser() {
      const mount = document.getElementById('content-browser-mount');
      if (mount) {
        mount.innerHTML = Editor.renderContentBrowserPanel();
        Editor.bindContentBrowserEvents?.(mount.closest('.dashboard-content-section') || mount);
      }
    },

    bindContentBrowserEvents(root) {
      if (!root || root._cbBound) return;
      root._cbBound = true;

      root.addEventListener('input', (ev) => {
        if (ev.target.id === 'content-browser-search-input') {
          Editor._contentBrowserQuery = ev.target.value;
          Editor.renderContentBrowser();
        }
      });

      root.addEventListener('change', (ev) => {
        if (ev.target.id === 'content-browser-category-filter') {
          Editor._contentBrowserCategory = ev.target.value || 'all';
          Editor.renderContentBrowser();
        }
      });

      root.addEventListener('click', (ev) => {
        const openBtn = ev.target.closest('[data-cb-open]');
        if (openBtn) {
          ev.preventDefault();
          Editor.openContentEntity(
            openBtn.getAttribute('data-cb-open'),
            openBtn.getAttribute('data-cb-id')
          );
          return;
        }
        const createBtn = ev.target.closest('[data-cb-create]');
        if (createBtn) {
          ev.preventDefault();
          Editor.createContentEntity(createBtn.getAttribute('data-cb-create'));
          return;
        }
        const card = ev.target.closest('[data-dc-tab]');
        if (card) {
          ev.preventDefault();
          const tab = card.getAttribute('data-dc-tab');
          const cat = card.getAttribute('data-dc-cat');
          if (tab) Editor.switchTab?.(tab);
          if (cat) {
            Editor._contentBrowserCategory = cat;
            Editor.renderContentBrowser();
          }
          return;
        }
        const qc = ev.target.closest('[data-dc-create]');
        if (qc) {
          ev.preventDefault();
          Editor.createContentEntity(qc.getAttribute('data-dc-create'));
        }
      });
    }
  });
})();
