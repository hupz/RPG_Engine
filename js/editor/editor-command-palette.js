// ============================================================
// Command Palette — Ctrl+K, registry Editor.commands
// ============================================================
(function attachCommandPalette() {
  'use strict';
  if (typeof Editor === 'undefined') {
    console.error('editor-command-palette: Editor missing');
    return;
  }

  /** @type {Map<string, Command>} */
  const registry = new Map();

  /**
   * @typedef {object} Command
   * @property {string} id
   * @property {string} title
   * @property {string} [shortcut]
   * @property {string} [category]
   * @property {string[]} [keywords]
   * @property {() => void|boolean|Promise} action
   * @property {() => boolean} [when] — if returns false, hidden
   */

  const Commands = {
    registry,

    /**
     * @param {Command} cmd
     */
    register(cmd) {
      if (!cmd || !cmd.id || typeof cmd.action !== 'function') {
        console.warn('[commands] invalid command', cmd);
        return;
      }
      registry.set(cmd.id, {
        id: cmd.id,
        title: cmd.title || cmd.id,
        shortcut: cmd.shortcut || '',
        category: cmd.category || 'Общее',
        keywords: Array.isArray(cmd.keywords) ? cmd.keywords : [],
        action: cmd.action,
        when: typeof cmd.when === 'function' ? cmd.when : null
      });
    },

    registerMany(list) {
      (list || []).forEach((c) => this.register(c));
    },

    get(id) {
      return registry.get(id) || null;
    },

    list() {
      return Array.from(registry.values()).map((c) => {
        if (c.id === 'edit.undo' && typeof EditorHistory !== 'undefined' && EditorHistory.formatUndoCommandTitle) {
          return Object.assign({}, c, { title: EditorHistory.formatUndoCommandTitle() });
        }
        if (c.id === 'edit.redo' && typeof EditorHistory !== 'undefined' && EditorHistory.formatRedoCommandTitle) {
          return Object.assign({}, c, { title: EditorHistory.formatRedoCommandTitle() });
        }
        return c;
      });
    },

    /**
     * Unified search: commands + project objects.
     * @param {string} query
     * @returns {Array<object>}
     */
    search(query) {
      return this.searchUnified(query);
    },

    searchCommands(query) {
      const q = String(query || '').trim().toLowerCase();
      let items = this.list().filter((c) => {
        if (c.when) {
          try {
            if (!c.when()) return false;
          } catch (e) {
            return false;
          }
        }
        return true;
      });
      if (!q) {
        return items.sort((a, b) =>
          String(a.category).localeCompare(String(b.category), 'ru') ||
          String(a.title).localeCompare(String(b.title), 'ru')
        );
      }
      const scored = [];
      for (const c of items) {
        const hay = [c.title, c.id, c.category, c.shortcut, ...(c.keywords || [])]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q) && !q.split(/\s+/).every((w) => hay.includes(w))) continue;
        let score = 0;
        if (c.title.toLowerCase().startsWith(q)) score += 50;
        if (c.title.toLowerCase().includes(q)) score += 20;
        if (c.id.toLowerCase().includes(q)) score += 10;
        scored.push({ c, score });
      }
      scored.sort((a, b) => b.score - a.score || a.c.title.localeCompare(b.c.title, 'ru'));
      return scored.map((x) => x.c);
    },

    /** Search entities in project data */
    searchEntities(query) {
      const q = String(query || '').trim().toLowerCase();
      const data = Editor.data || {};
      const out = [];
      if (!q) return out;

      function push(kind, icon, id, name, extra) {
        const title = icon + ' ' + kind + ' «' + (name || id) + '»';
        const hay = (title + ' ' + id + ' ' + (extra || '')).toLowerCase();
        if (!hay.includes(q) && !q.split(/\s+/).every((w) => hay.includes(w))) return;
        let score = 0;
        if (String(name || '').toLowerCase().startsWith(q)) score += 60;
        if (String(name || '').toLowerCase().includes(q)) score += 30;
        if (String(id).toLowerCase().includes(q)) score += 15;
        out.push({
          id: 'entity:' + kind + ':' + id,
          title,
          category: 'Объекты',
          group: 'objects',
          kind,
          entityId: id,
          score,
          keywords: [kind, id, name],
          action: function () {
            openEntity(kind, id, false);
          },
          actionAlt: function () {
            openEntity(kind, id, true);
          }
        });
      }

      Object.entries(data.quests || {}).forEach(([id, qst]) => {
        push('Квест', '📜', id, qst.title || qst.name, qst.description);
      });
      Object.entries(data.npcs || {}).forEach(([id, n]) => {
        push('Персонаж', '👤', id, n.name || n.title, n.role || n.description);
      });
      Object.entries(data.scenes || {}).forEach(([id, s]) => {
        push('Сцена', '🎬', id, s.location || s.title || s.name, s.text);
      });
      Object.entries(data.items || {}).forEach(([id, it]) => {
        push('Предмет', '🎒', id, it.name, it.desc || it.type);
      });
      Object.entries(data.enemies || {}).forEach(([id, en]) => {
        push('Враг', '⚔️', id, en.name, en.desc);
      });
      Object.entries(data.classes || {}).forEach(([id, cl]) => {
        push('Класс', '🛡️', id, cl.name, cl.desc);
      });

      out.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'ru'));
      return out.slice(0, 25);
    },

    searchUnified(query) {
      const q = String(query || '').trim();
      const results = [];

      // Recent (when empty query)
      if (!q) {
        getRecent().forEach((r) => {
          results.push({
            ...r,
            category: 'Недавние',
            group: 'recent'
          });
        });
      }

      // Commands
      const cmds = this.searchCommands(query);
      cmds.forEach((c) => {
        const cat = c.category || 'Команды';
        let group = 'commands';
        if (/создать|новый|\+/i.test(c.title) || /create|new/i.test(c.id)) group = 'actions';
        if (/проверить|preview|тест|запуст/i.test(c.title + c.id)) group = 'quick';
        if (/навигация|открыть|вкладк/i.test(cat + c.title)) group = 'commands';
        results.push({
          id: c.id,
          title: c.title,
          shortcut: c.shortcut,
          category: group === 'actions' ? 'Действия' : (group === 'quick' ? 'Быстрые действия' : cat),
          group,
          keywords: c.keywords,
          action: c.action,
          when: c.when
        });
      });

      // Objects
      this.searchEntities(query).forEach((e) => results.push(e));

      // Stable order by group when querying
      const order = { recent: 0, quick: 1, actions: 2, objects: 3, commands: 4 };
      if (q) {
        results.sort((a, b) => {
          const ga = order[a.group] != null ? order[a.group] : 5;
          const gb = order[b.group] != null ? order[b.group] : 5;
          if (ga !== gb) return ga - gb;
          return String(a.title).localeCompare(String(b.title), 'ru');
        });
      }
      return results;
    },

    run(id, opts) {
      opts = opts || {};
      // Entity virtual commands
      if (String(id).startsWith('entity:')) {
        const parts = String(id).split(':');
        const kind = parts[1];
        const entityId = parts.slice(2).join(':');
        openEntity(kind, entityId, !!opts.alt);
        pushRecent({
          id: id,
          title: (opts.title || id),
          category: 'Недавние',
          group: 'recent',
          kind,
          entityId,
          action: function () { openEntity(kind, entityId, false); }
        });
        return true;
      }
      const cmd = registry.get(id);
      if (!cmd) return false;
      try {
        const r = opts.alt && typeof cmd.actionAlt === 'function'
          ? cmd.actionAlt.call(Editor)
          : cmd.action.call(Editor);
        pushRecent({
          id: cmd.id,
          title: cmd.title,
          category: 'Недавние',
          group: 'recent',
          action: cmd.action
        });
        return r !== false;
      } catch (e) {
        console.error('[commands] action failed', id, e);
        return false;
      }
    }
  };

  const RECENT_KEY = 'rpg_cmd_palette_recent';
  const RECENT_MAX = 8;

  function getRecent() {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function pushRecent(entry) {
    try {
      let list = getRecent().filter((x) => x.id !== entry.id);
      list.unshift({
        id: entry.id,
        title: entry.title,
        category: 'Недавние',
        group: 'recent',
        kind: entry.kind,
        entityId: entry.entityId
      });
      list = list.slice(0, RECENT_MAX);
      localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch (e) { /* */ }
  }

  function openEntity(kind, id, alt) {
    // kind labels from searchEntities are Russian
    const k = String(kind || '').toLowerCase();
    if (k === 'квест' || k === 'quest') {
      if (typeof Editor.switchTab === 'function') Editor.switchTab('quests');
      if (typeof Editor.selectQuestToEdit === 'function') Editor.selectQuestToEdit(id);
      if (alt && typeof Editor.selectInspectorObject === 'function') {
        Editor.selectInspectorObject({ type: 'quest', id: id });
      }
      return;
    }
    if (k === 'персонаж' || k === 'npc') {
      if (typeof Editor.switchTab === 'function') Editor.switchTab('npcs');
      if (typeof Editor.selectNpcToEdit === 'function') Editor.selectNpcToEdit(id);
      return;
    }
    if (k === 'сцена' || k === 'scene') {
      if (typeof Editor.switchTab === 'function') Editor.switchTab('scenes');
      if (typeof Editor.selectScene === 'function') Editor.selectScene(id);
      return;
    }
    if (k === 'предмет' || k === 'item') {
      if (typeof Editor.switchTab === 'function') Editor.switchTab('items');
      if (typeof Editor.selectItemToEdit === 'function') Editor.selectItemToEdit(id);
      return;
    }
    if (k === 'враг' || k === 'enemy') {
      if (typeof Editor.switchTab === 'function') Editor.switchTab('enemies');
      if (typeof Editor.selectEnemyToEdit === 'function') Editor.selectEnemyToEdit(id);
      return;
    }
    if (k === 'класс' || k === 'class') {
      if (typeof Editor.switchTab === 'function') Editor.switchTab('classes');
      if (typeof Editor.selectClassToEdit === 'function') Editor.selectClassToEdit(id);
      return;
    }
  }

  function isTypingContext(el) {
    if (!el || typeof el !== 'object') return false;
    const tag = String(el.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      if (el.id === 'cmd-palette-input') return false;
      return true;
    }
    if (el.isContentEditable) return true;
    return false;
  }

  function formatPaletteItem(c) {
    if (typeof Editor.formatCommandPaletteItem === 'function') {
      return Editor.formatCommandPaletteItem(c) || c;
    }
    return c;
  }

  Editor.commands = Commands;

  // ——— Palette UI ———
  let activeIndex = 0;
  let currentQuery = '';

  function ensureModal() {
    let modal = document.getElementById('editor-command-palette');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'editor-command-palette';
    modal.className = 'editor-modal cmd-palette-modal hidden';
    modal.innerHTML = `
      <div class="editor-modal-backdrop" data-cmd-close="1"></div>
      <div class="editor-modal-panel cmd-palette-panel" role="dialog" aria-label="Command Palette">
        <input type="search" id="cmd-palette-input" class="cmd-palette-input"
          placeholder="Search commands…" autocomplete="off" />
        <ul id="cmd-palette-list" class="cmd-palette-list" role="listbox"></ul>
        <div class="cmd-palette-footer hint">
          <span>↑↓ навигация</span>
          <span>Enter — выполнить</span>
          <span>Esc — закрыть</span>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target.closest('[data-cmd-close]')) closePalette();
    });
    const input = modal.querySelector('#cmd-palette-input');
    if (typeof Editor.Perf?.registerPaletteRender === 'function') {
      Editor.Perf.registerPaletteRender(renderList);
    }
    input.addEventListener('input', () => {
      currentQuery = input.value;
      activeIndex = 0;
      if (typeof Editor.Perf?.debouncedPaletteRender === 'function') {
        Editor.Perf.debouncedPaletteRender();
      } else {
        renderList();
      }
    });
    input.addEventListener('keydown', onInputKey);
    modal.querySelector('#cmd-palette-list').addEventListener('click', (e) => {
      const li = e.target.closest('[data-cmd-id]');
      if (!li) return;
      runAndClose(li.getAttribute('data-cmd-id'), {
        alt: !!(e.ctrlKey || e.metaKey),
        title: li.querySelector('.cmd-palette-title')?.textContent
      });
    });
    return modal;
  }

  function renderList() {
    const list = document.getElementById('cmd-palette-list');
    if (!list) return;
    const items = Commands.search(currentQuery).slice(0, 40);
    if (!items.length) {
      list.innerHTML = '<li class="cmd-palette-empty">Ничего не найдено</li>';
      return;
    }
    if (activeIndex >= items.length) activeIndex = items.length - 1;
    if (activeIndex < 0) activeIndex = 0;
    let lastCat = null;
    const html = [];
    items.forEach((c, i) => {
      c = formatPaletteItem(c);
      if (c.category !== lastCat) {
        lastCat = c.category;
        html.push(`<li class="cmd-palette-cat" role="presentation">${escape(lastCat)}</li>`);
      }
      const active = i === activeIndex ? ' is-active' : '';
      const subtitle = c.subtitle
        ? `<span class="cmd-palette-subtitle">${escape(c.subtitle)}</span>` : '';
      html.push(`<li class="cmd-palette-item${active}" role="option" data-cmd-id="${escape(c.id)}" data-index="${i}">
        <span class="cmd-palette-item__text">
          <span class="cmd-palette-title">${escape(c.title)}</span>${subtitle}
        </span>
        ${c.shortcut ? `<kbd class="cmd-palette-kbd">${escape(c.shortcut)}</kbd>` : ''}
      </li>`);
    });
    list.innerHTML = html.join('');
    const activeEl = list.querySelector('.cmd-palette-item.is-active');
    if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
  }

  function escape(s) {
    return typeof Editor.escapeHtml === 'function'
      ? Editor.escapeHtml(s)
      : String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function openPalette(prefill) {
    const modal = ensureModal();
    modal.classList.remove('hidden');
    currentQuery = prefill != null ? String(prefill) : '';
    activeIndex = 0;
    const input = document.getElementById('cmd-palette-input');
    if (input) {
      input.value = currentQuery;
      setTimeout(() => input.focus(), 0);
    }
    renderList();
  }

  function closePalette() {
    const modal = document.getElementById('editor-command-palette');
    if (modal) modal.classList.add('hidden');
  }

  function isOpen() {
    const modal = document.getElementById('editor-command-palette');
    return modal && !modal.classList.contains('hidden');
  }

  function runAndClose(id, opts) {
    closePalette();
    Commands.run(id, opts || {});
  }

  function onInputKey(e) {
    const items = Commands.search(currentQuery).slice(0, 50);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, Math.max(items.length - 1, 0));
      renderList();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      renderList();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = items[activeIndex];
      if (cmd) {
        runAndClose(cmd.id, {
          alt: !!(e.ctrlKey || e.metaKey),
          title: cmd.title
        });
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    }
  }

  Editor.openCommandPalette = openPalette;
  Editor.closeCommandPalette = closePalette;

  // Global shortcut Ctrl+K / Cmd+K
  if (typeof document !== 'undefined' && !window._cmdPaletteKeyBound) {
    window._cmdPaletteKeyBound = true;
    document.addEventListener('keydown', (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 'k' || e.key === 'K')) {
        if (!isOpen() && isTypingContext(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        if (isOpen()) closePalette();
        else openPalette();
        return;
      }
      if (e.key === 'Escape' && isOpen()) {
        e.preventDefault();
        closePalette();
      }
    }, true);
  }

  // ——— Built-in commands ———
  function safe(fn) {
    return function () {
      try {
        return fn.call(this);
      } catch (e) {
        console.error(e);
        return false;
      }
    };
  }

  Commands.registerMany([
    {
      id: 'quest.create',
      title: 'Создать квест',
      category: 'Квесты',
      keywords: ['quest', 'новый', 'wizard'],
      action: safe(function () {
        if (typeof this.openQuestWizard === 'function') this.openQuestWizard();
        else if (typeof this.createQuest === 'function') this.createQuest();
        else this.switchTab && this.switchTab('quests');
      })
    },
    {
      id: 'npc.create',
      title: 'Создать NPC',
      category: 'Контент',
      keywords: ['npc', 'персонаж'],
      action: safe(function () {
        this.switchTab && this.switchTab('npcs');
        if (typeof this.createNPC === 'function') this.createNPC();
      })
    },
    {
      id: 'item.create',
      title: 'Создать предмет',
      category: 'Контент',
      keywords: ['item', 'inventory'],
      action: safe(function () {
        this.switchTab && this.switchTab('items');
        if (typeof this.createItem === 'function') this.createItem();
      })
    },
    {
      id: 'scene.create',
      title: 'Создать сцену',
      category: 'Сцены',
      keywords: ['scene', 'новая'],
      action: safe(function () {
        this.switchTab && this.switchTab('scenes');
        this.openSceneWizard();
      })
    },
    {
      id: 'tab.scenes',
      title: 'Открыть сцены',
      category: 'Навигация',
      keywords: ['scenes', 'вкладка'],
      action: safe(function () { this.switchTab && this.switchTab('scenes'); })
    },
    {
      id: 'tab.quests',
      title: 'Открыть квесты',
      category: 'Навигация',
      keywords: ['quests'],
      action: safe(function () { this.switchTab && this.switchTab('quests'); })
    },
    {
      id: 'tab.npcs',
      title: 'Открыть NPC',
      category: 'Навигация',
      action: safe(function () { this.switchTab && this.switchTab('npcs'); })
    },
    {
      id: 'tab.items',
      title: 'Открыть предметы',
      category: 'Навигация',
      action: safe(function () { this.switchTab && this.switchTab('items'); })
    },
    {
      id: 'tab.enemies',
      title: 'Открыть врагов',
      category: 'Навигация',
      action: safe(function () { this.switchTab && this.switchTab('enemies'); })
    },
    {
      id: 'tab.graph',
      title: 'Открыть карту сюжета',
      category: 'Навигация',
      keywords: ['graph', 'story'],
      action: safe(function () { this.switchTab && this.switchTab('graph'); })
    },
    {
      id: 'tab.dashboard',
      title: 'Открыть дашборд',
      category: 'Навигация',
      action: safe(function () {
        if (typeof this.showDashboard === 'function') this.showDashboard();
        else this.switchTab && this.switchTab('dashboard');
      })
    },
    {
      id: 'project.validate',
      title: 'Проверить проект',
      category: 'Проект',
      keywords: ['lint', 'validate', 'ошибки'],
      action: safe(function () {
        if (typeof this.runProjectValidation === 'function') this.runProjectValidation();
        else if (typeof this.validateAll === 'function') this.validateAll();
        else if (typeof this.validateProjectExtended === 'function') this.validateProjectExtended();
        else Editor.toast.warning('Валидатор не загружен');
      })
    },
    {
      id: 'project.save',
      title: 'Сохранить',
      category: 'Проект',
      shortcut: '',
      keywords: ['save', 'json'],
      action: safe(function () {
        if (typeof this.exportJSON === 'function') this.exportJSON();
        else Editor.toast.warning('Сохранение недоступно');
      })
    },
    {
      id: 'project.export',
      title: 'Экспортировать',
      category: 'Проект',
      keywords: ['export', 'standalone'],
      action: safe(function () {
        if (typeof this.openExportMenu === 'function') this.openExportMenu();
        else if (typeof this.exportStandalone === 'function') this.exportStandalone();
        else if (typeof this.exportJSON === 'function') this.exportJSON();
      })
    },
    {
      id: 'project.load',
      title: 'Загрузить JSON',
      category: 'Проект',
      keywords: ['load', 'open'],
      action: safe(function () {
        if (typeof this.loadData === 'function') this.loadData();
      })
    },
    {
      id: 'project.settings',
      title: 'Открыть настройки',
      category: 'Проект',
      keywords: ['settings', 'theme', 'config'],
      action: safe(function () {
        if (typeof this.switchTab === 'function') {
          // theme / world as closest to settings
          this.switchTab('theme');
        }
      })
    },
    {
      id: 'edit.undo',
      title: 'Отменить',
      category: 'Правка',
      shortcut: 'Ctrl+Z',
      action: safe(function () {
        if (typeof EditorHistory !== 'undefined' && EditorHistory.undo) EditorHistory.undo();
      })
    },
    {
      id: 'edit.redo',
      title: 'Повторить',
      category: 'Правка',
      shortcut: 'Ctrl+Shift+Z',
      action: safe(function () {
        if (typeof EditorHistory !== 'undefined' && EditorHistory.redo) EditorHistory.redo();
      })
    },
    {
      id: 'palette.help',
      title: 'Справка: Command Palette',
      category: 'Справка',
      keywords: ['help', 'ctrl+k'],
      action: safe(function () {
        Editor.toast.info('Ctrl+K — палитра команд.\nРегистрация: Editor.commands.register({ id, title, action, category })');
      })
    }
  ]);


  // Extra navigation / authoring commands (idempotent by id)
  Commands.registerMany([
    {
      id: 'create.quest',
      title: '➕ Новый квест',
      category: 'Действия',
      keywords: ['создать', 'квест', 'new quest'],
      action: safe(function () {
        if (typeof this.createQuest === 'function') this.createQuest();
        else if (typeof this.openQuestWizard === 'function') this.openQuestWizard();
      })
    },
    {
      id: 'create.npc',
      title: '➕ Новый персонаж',
      category: 'Действия',
      keywords: ['создать', 'npc', 'персонаж'],
      action: safe(function () {
        if (typeof this.switchTab === 'function') this.switchTab('npcs');
        if (typeof this.createNPC === 'function') this.createNPC();
      })
    },
    {
      id: 'create.item',
      title: '➕ Новый предмет',
      category: 'Действия',
      keywords: ['создать', 'предмет', 'item'],
      action: safe(function () {
        if (typeof this.switchTab === 'function') this.switchTab('items');
        if (typeof this.createItem === 'function') this.createItem();
      })
    },
    {
      id: 'create.scene',
      title: '➕ Новая сцена',
      category: 'Действия',
      keywords: ['создать', 'сцена', 'scene'],
      action: safe(function () {
        if (typeof this.switchTab === 'function') this.switchTab('scenes');
        this.openSceneWizard();
      })
    },
    {
      id: 'preview.test',
      title: '▶ Проверить / Preview',
      category: 'Быстрые действия',
      keywords: ['проверить', 'тест', 'preview', 'play', 'запуск'],
      action: safe(function () {
        if (typeof this.testCurrentScene === 'function') this.testCurrentScene();
        else if (typeof this.playTest === 'function') this.playTest();
      })
    },
    {
      id: 'nav.graph',
      title: 'Открыть карту истории',
      category: 'Навигация',
      keywords: ['граф', 'история', 'story'],
      action: safe(function () {
        if (typeof this.switchTab === 'function') this.switchTab('graph');
      })
    }
  ]);

  // Styles
  if (typeof document !== 'undefined' && !document.getElementById('cmd-palette-styles')) {
    const st = document.createElement('style');
    st.id = 'cmd-palette-styles';
    st.textContent = `
      .cmd-palette-modal .cmd-palette-panel {
        max-width: 560px; padding: 12px 12px 8px; margin-top: -10vh;
      }
      .cmd-palette-input {
        width: 100%; box-sizing: border-box; font-size: 16px; padding: 12px 14px;
        border: 2px solid var(--border, #cbb); border-radius: 8px; margin-bottom: 8px;
        background: var(--paper, #fff); color: inherit;
      }
      .cmd-palette-list {
        list-style: none; margin: 0; padding: 0; max-height: 360px; overflow-y: auto;
      }
      .cmd-palette-cat {
        font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
        color: var(--muted, #888); padding: 10px 12px 4px; font-weight: 600;
      }
      .cmd-palette-item {
        display: flex; align-items: center; justify-content: space-between;
        gap: 12px; padding: 10px 12px; border-radius: 8px; cursor: pointer;
      }
      .cmd-palette-item.is-active, .cmd-palette-item:hover {
        background: rgba(109, 76, 65, 0.12);
      }
      .cmd-palette-title { font-weight: 600; font-size: 14px; display: block; }
      .cmd-palette-subtitle {
        font-size: 11px; color: var(--muted, #888); display: block; margin-top: 1px;
      }
      .cmd-palette-item__text { flex: 1; min-width: 0; }
      .cmd-palette-kbd {
        font-size: 11px; padding: 2px 6px; border-radius: 4px;
        border: 1px solid var(--border, #ccc); background: var(--paper, #f5f5f5);
        color: var(--muted, #666);
      }
      .cmd-palette-empty { padding: 20px; text-align: center; color: var(--muted, #888); }
      .cmd-palette-footer {
        display: flex; gap: 16px; flex-wrap: wrap; padding: 8px 4px 0;
        border-top: 1px solid var(--border, #eee); margin-top: 6px; font-size: 12px;
      }
    `;
    document.head.appendChild(st);
  }

    Commands.registerMany([
    {
      id: 'mode.writer',
      title: 'Writer Mode',
      category: 'Интерфейс',
      keywords: ['writer', 'писатель'],
      action() { if (Editor.applyEditorMode) Editor.applyEditorMode('writer'); }
    },
    {
      id: 'mode.advanced',
      title: 'Advanced Mode',
      category: 'Интерфейс',
      keywords: ['advanced', 'полный'],
      action() { if (Editor.applyEditorMode) Editor.applyEditorMode('advanced'); }
    },
    {
      id: 'mode.toggle',
      title: 'Переключить Writer / Advanced',
      category: 'Интерфейс',
      action() { if (Editor.toggleEditorMode) Editor.toggleEditorMode(); }
    }
  ]);

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-command-palette', {
      openCommandPalette: Editor.openCommandPalette,
      closeCommandPalette: Editor.closeCommandPalette
    }, { force: true });
  }
})();
