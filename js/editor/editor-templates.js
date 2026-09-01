// ============================================================
// Editor Templates Registry — scene + entity templates
// ============================================================
(function attachEditorTemplates() {
  'use strict';
  if (typeof Editor === 'undefined') {
    console.error('editor-templates: Editor missing');
    return;
  }

  /** @type {Map<string, object>} */
  const registry = new Map();

  const Templates = {
    register(tpl) {
      if (!tpl || !tpl.id || typeof tpl.create !== 'function') {
        console.warn('[templates] invalid template', tpl);
        return;
      }
      registry.set(tpl.id, {
        id: tpl.id,
        title: tpl.title || tpl.id,
        icon: tpl.icon || '📋',
        description: tpl.description || '',
        category: tpl.category || 'Общее',
        create: tpl.create
      });
    },
    list() {
      return Array.from(registry.values());
    },
    get(id) {
      return registry.get(id) || null;
    },
    run(id) {
      const t = registry.get(id);
      if (!t) return false;
      try {
        t.create.call(Editor);
        return true;
      } catch (e) {
        console.error('[templates]', id, e);
        return false;
      }
    }
  };

  Editor.templates = Templates;

  // Built-in: Player Character
  Templates.register({
    id: 'player_character',
    icon: '🎭',
    title: 'Персонаж игрока',
    category: 'Персонажи',
    description: 'Главный герой: имя, раса, класс, предыстория — без JSON.',
    create() {
      if (typeof this.createPlayerCharacterTemplate === 'function') {
        this.createPlayerCharacterTemplate();
      } else if (typeof this.switchTab === 'function') {
        this.switchTab('player_characters');
      }
    }
  });

  // Optional: blank NPC (reuse existing)
  Templates.register({
    id: 'npc_basic',
    icon: '👤',
    title: 'NPC',
    category: 'Персонажи',
    description: 'Создать персонажа (NPC).',
    create() {
      if (typeof this.switchTab === 'function') this.switchTab('npcs');
      if (typeof this.createNPC === 'function') this.createNPC();
    }
  });

  Templates.register({
    id: 'quest_basic',
    icon: '📜',
    title: 'Квест',
    category: 'Сюжет',
    description: 'Новый квест через мастер или редактор.',
    create() {
      if (typeof this.openQuestWizard === 'function') this.openQuestWizard();
      else if (typeof this.createQuest === 'function') this.createQuest();
      else if (typeof this.switchTab === 'function') this.switchTab('quests');
    }
  });

  Editor.renderSceneTemplates = function renderSceneTemplates() {
    const root = document.getElementById('scene-templates-editor');
    if (!root) return;
    if (!this.data) {
      root.innerHTML = '<div class="empty-state"><h2>Загрузите данные</h2></div>';
      return;
    }
    const filter = this._templateFilter || 'all';
    const FILTERS = [
      { id: 'all', label: 'Все' },
      { id: 'Персонаж', label: 'Персонаж' },
      { id: 'Персонажи', label: 'Персонажи' },
      { id: 'Сюжет', label: 'Сюжет' },
      { id: 'Локация', label: 'Локации' },
      { id: 'Торговля', label: 'Торговля' },
      { id: 'Бой', label: 'Бой' },
      { id: 'Квест', label: 'Квест' },
      { id: 'Социальное', label: 'Социальное' }
    ];
    const items = Templates.list().filter((t) => {
      if (filter === 'all') return true;
      const c = t.category || '';
      if (filter === 'Персонаж') return c === 'Персонаж' || c === 'Персонажи';
      return c === filter;
    });
    const byCat = {};
    items.forEach((t) => {
      const c = t.category || 'Общее';
      if (!byCat[c]) byCat[c] = [];
      byCat[c].push(t);
    });
    const esc = (s) => (typeof this.escapeHtml === 'function' ? this.escapeHtml(s) : String(s || ''));
    let html = '<h2>📋 Шаблоны</h2><p class="hint">Готовые заготовки сцен и сущностей — без правки JSON.</p>';
    html += '<div class="template-filters">';
    FILTERS.forEach((f) => {
      const active = filter === f.id || (filter === 'all' && f.id === 'all');
      html += `<button type="button" class="btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'}" data-template-filter="${esc(f.id)}">${esc(f.label)}</button>`;
    });
    html += '</div>';
    if (!items.length) {
      html += '<p class="hint">Нет шаблонов в этой категории.</p>';
    }
    Object.keys(byCat).sort((a, b) => a.localeCompare(b, 'ru')).forEach((cat) => {
      html += `<h3>${esc(cat)}</h3><div class="template-grid">`;
      byCat[cat].forEach((t) => {
        html += `<button type="button" class="template-card btn btn-secondary" data-template-id="${esc(t.id)}">
          <span class="template-card__icon">${t.icon}</span>
          <span class="template-card__title">${esc(t.title)}</span>
          <span class="template-card__desc">${esc(t.description)}</span>
        </button>`;
      });
      html += '</div>';
    });
    root.innerHTML = html;
    if (!root._tplBound) {
      root._tplBound = true;
      root.addEventListener('click', (e) => {
        const filt = e.target.closest('[data-template-filter]');
        if (filt) {
          Editor._templateFilter = filt.getAttribute('data-template-filter') || 'all';
          Editor.renderSceneTemplates();
          return;
        }
        const btn = e.target.closest('[data-template-id]');
        if (!btn) return;
        Templates.run(btn.getAttribute('data-template-id'));
      });
    }
  };

  if (Editor.hooks && typeof Editor.hooks.after === 'function') {
    Editor.hooks.after('switchTab', function (result, args) {
      if (args && args[0] === 'scene_templates' && typeof this.renderSceneTemplates === 'function') {
        this.renderSceneTemplates();
      }
      return result;
    });
    Editor.hooks.after('renderAll', function (result) {
      if (this.currentTab === 'scene_templates' && typeof this.renderSceneTemplates === 'function') {
        this.renderSceneTemplates();
      }
      return result;
    });
  }

  // Command palette
  if (Editor.commands && typeof Editor.commands.register === 'function') {
    Editor.commands.register({
      id: 'create.player_character',
      title: '➕ Создать персонажа игрока',
      category: 'Действия',
      keywords: ['персонаж', 'герой', 'player', 'character', 'создать'],
      action() {
        if (typeof this.createPlayerCharacterTemplate === 'function') this.createPlayerCharacterTemplate();
      }
    });
  }
})();
