// ============================================================
// Player Character Creator — Editor UI (no QuestRuntime changes)
// ============================================================
(function attachEditorPlayerCharacter() {
  'use strict';
  if (typeof Editor === 'undefined') {
    console.error('editor-player-character: Editor missing');
    return;
  }

  const STAT_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const STAT_LABELS = { str: 'СИЛ', dex: 'ЛОВ', con: 'ТЕЛ', int: 'ИНТ', wis: 'МУД', cha: 'ХАР' };

  function humanError(msg) {
    if (Editor.toast?.error) Editor.toast.error(msg);
  }

  function ok(msg) {
    if (Editor.toast?.success) Editor.toast.success(msg);
  }

  function slugify(name) {
    if (typeof Editor.slugFromName === 'function') return Editor.slugFromName(name);
    const s = String(name || '')
      .toLowerCase()
      .replace(/[^a-z0-9а-яё_+-]+/gi, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 48);
    return s || 'hero';
  }

  function uniqueId(base) {
    Editor.ensurePlayerCharacters();
    let id = base || 'hero';
    if (!Editor.data.playerCharacters[id]) return id;
    let n = 2;
    while (Editor.data.playerCharacters[id + '_' + n]) n++;
    return id + '_' + n;
  }

  function defaultStats() {
    return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  }

  function blankCharacter(partial) {
    const p = partial || {};
    return {
      id: p.id || '',
      isPlayerCharacter: true,
      name: p.name || '',
      displayName: p.displayName || p.name || '',
      portrait: p.portrait || '',
      race: p.race || '',
      class: p.class || '',
      description: p.description || '',
      personality: p.personality || '',
      motivation: p.motivation || '',
      fears: p.fears || '',
      goals: p.goals || '',
      backstory: p.backstory || '',
      stats: p.stats && typeof p.stats === 'object' ? { ...defaultStats(), ...p.stats } : defaultStats(),
      abilities: Array.isArray(p.abilities) ? p.abilities.slice() : [],
      startingInventory: Array.isArray(p.startingInventory) ? p.startingInventory.slice() : []
    };
  }

  Object.assign(Editor, {
    editingPlayerCharacterId: null,
    playerCharacterFormMode: 'quick', // quick | detailed

    ensurePlayerCharacters() {
      if (!this.data) return;
      if (!this.data.playerCharacters || typeof this.data.playerCharacters !== 'object') {
        this.data.playerCharacters = {};
      }
    },

    getPlayerCharacterIds() {
      this.ensurePlayerCharacters();
      return Object.keys(this.data.playerCharacters);
    },

    getPlayerCharacter(id) {
      this.ensurePlayerCharacters();
      return this.data.playerCharacters[id] || null;
    },

    selectPlayerCharacterToEdit(id) {
      this.editingPlayerCharacterId = id || null;
      this.renderPlayerCharacters();
    },

    validatePlayerCharacter(pc) {
      if (!pc || !String(pc.name || '').trim()) {
        return { ok: false, message: 'Введите имя персонажа' };
      }
      if (pc.race && this.data?.races && !this.data.races[pc.race]) {
        return { ok: false, message: 'Раса не найдена. Выберите существующую или оставьте пустой.' };
      }
      if (pc.class && this.data?.classes && !this.data.classes[pc.class]) {
        return { ok: false, message: 'Класс не найден. Выберите существующий или оставьте пустой.' };
      }
      return { ok: true };
    },

    createPlayerCharacterFromForm(opts) {
      this.ensurePlayerCharacters();
      const o = opts || {};
      const name = String(o.name || '').trim();
      if (!name) {
        humanError('Введите имя персонажа');
        return null;
      }
      const id = uniqueId(slugify(name));
      const pc = blankCharacter({
        id,
        name,
        displayName: String(o.displayName || name).trim() || name,
        portrait: o.portrait || '',
        race: o.race || '',
        class: o.class || '',
        description: o.description || '',
        personality: o.personality || '',
        motivation: o.motivation || '',
        fears: o.fears || '',
        goals: o.goals || '',
        backstory: o.backstory || '',
        stats: o.stats,
        abilities: o.abilities,
        startingInventory: o.startingInventory
      });
      const v = this.validatePlayerCharacter(pc);
      if (!v.ok) {
        humanError(v.message);
        return null;
      }
      this.data.playerCharacters[id] = pc;
      this.editingPlayerCharacterId = id;
      if (typeof EditorHistory !== 'undefined' && EditorHistory.recordCreate) {
        EditorHistory.recordCreate('playerCharacter', id);
      }
      if (typeof this.markDirty === 'function') this.markDirty();
      this.renderPlayerCharacters();
      ok('Персонаж «' + name + '» создан');
      return id;
    },

    /** Template entry point */
    createPlayerCharacterTemplate() {
      this.playerCharacterFormMode = 'detailed';
      if (typeof this.switchTab === 'function') this.switchTab('player_characters');
      // open empty form (no id yet)
      this.editingPlayerCharacterId = null;
      this._pcDraft = blankCharacter({ name: 'Новый герой', displayName: 'Новый герой' });
      this.renderPlayerCharacters();
    },

    async deletePlayerCharacter(id) {
      this.ensurePlayerCharacters();
      if (!id || !this.data.playerCharacters[id]) return;
      const name = this.data.playerCharacters[id].name || id;
      if (Editor.confirmDialog) {
        if (!(await Editor.confirmDialog({ message: 'Удалить персонажа «' + name + '»?', danger: true }))) return;
      }
      delete this.data.playerCharacters[id];
      if (this.editingPlayerCharacterId === id) this.editingPlayerCharacterId = null;
      if (typeof EditorHistory !== 'undefined' && EditorHistory.recordDelete) {
        EditorHistory.recordDelete('playerCharacter', id);
      }
      if (typeof this.markDirty === 'function') this.markDirty();
      this.renderPlayerCharacters();
      ok('Персонаж удалён');
    },

    updatePlayerCharacterField(id, field, value) {
      this.ensurePlayerCharacters();
      const pc = this.data.playerCharacters[id];
      if (!pc) return;
      if (field === 'stats' && typeof value === 'object') {
        pc.stats = { ...defaultStats(), ...(pc.stats || {}), ...value };
      } else if (field === 'startingInventory' && Array.isArray(value)) {
        pc.startingInventory = value.slice();
      } else if (field === 'abilities' && Array.isArray(value)) {
        pc.abilities = value.slice();
      } else {
        pc[field] = value;
      }
      if (field === 'name' && !pc.displayName) pc.displayName = value;
      if (typeof this.markDirty === 'function') this.markDirty();
      // light refresh of preview only when needed
      const preview = document.getElementById('pc-preview-card');
      if (preview) preview.outerHTML = this.renderPlayerCharacterPreview(pc);
    },

    setPlayerCharacterStat(id, key, val) {
      const n = parseInt(val, 10);
      if (!STAT_KEYS.includes(key)) return;
      this.updatePlayerCharacterField(id, 'stats', { [key]: Number.isFinite(n) ? n : 10 });
    },

    addPlayerCharacterItem(id, itemId) {
      if (!itemId) return;
      this.ensurePlayerCharacters();
      const pc = this.data.playerCharacters[id];
      if (!pc) return;
      if (!Array.isArray(pc.startingInventory)) pc.startingInventory = [];
      if (!pc.startingInventory.includes(itemId)) pc.startingInventory.push(itemId);
      if (typeof this.markDirty === 'function') this.markDirty();
      this.renderPlayerCharacters();
    },

    removePlayerCharacterItem(id, itemId) {
      this.ensurePlayerCharacters();
      const pc = this.data.playerCharacters[id];
      if (!pc || !Array.isArray(pc.startingInventory)) return;
      pc.startingInventory = pc.startingInventory.filter((x) => x !== itemId);
      if (typeof this.markDirty === 'function') this.markDirty();
      this.renderPlayerCharacters();
    },

    submitPlayerCharacterCreator() {
      const nameEl = document.getElementById('pc-form-name');
      const name = nameEl ? nameEl.value.trim() : '';
      if (!name) {
        humanError('Введите имя персонажа');
        return;
      }
      const get = (id) => document.getElementById(id)?.value || '';
      const stats = {};
      STAT_KEYS.forEach((k) => {
        const v = parseInt(get('pc-stat-' + k), 10);
        stats[k] = Number.isFinite(v) ? v : 10;
      });
      const inv = [];
      document.querySelectorAll('#pc-inventory-list [data-item-id]').forEach((el) => {
        const iid = el.getAttribute('data-item-id');
        if (iid) inv.push(iid);
      });

      if (this.editingPlayerCharacterId && this.data.playerCharacters[this.editingPlayerCharacterId]) {
        const id = this.editingPlayerCharacterId;
        const pc = this.data.playerCharacters[id];
        pc.name = name;
        pc.displayName = get('pc-form-display') || name;
        pc.portrait = get('pc-form-portrait');
        pc.race = get('pc-form-race');
        pc.class = get('pc-form-class');
        pc.description = get('pc-form-description');
        pc.personality = get('pc-form-personality');
        pc.motivation = get('pc-form-motivation');
        pc.fears = get('pc-form-fears');
        pc.goals = get('pc-form-goals');
        pc.backstory = get('pc-form-backstory');
        pc.stats = stats;
        const v = this.validatePlayerCharacter(pc);
        if (!v.ok) {
          humanError(v.message);
          return;
        }
        if (typeof this.markDirty === 'function') this.markDirty();
        ok('Изменения сохранены');
        this.renderPlayerCharacters();
        return;
      }

      this.createPlayerCharacterFromForm({
        name,
        displayName: get('pc-form-display') || name,
        portrait: get('pc-form-portrait'),
        race: get('pc-form-race'),
        class: get('pc-form-class'),
        description: get('pc-form-description'),
        personality: get('pc-form-personality'),
        motivation: get('pc-form-motivation'),
        fears: get('pc-form-fears'),
        goals: get('pc-form-goals'),
        backstory: get('pc-form-backstory'),
        stats,
        startingInventory: inv
      });
    },

    setPlayerCharacterFormMode(mode) {
      this.playerCharacterFormMode = mode === 'detailed' ? 'detailed' : 'quick';
      this.renderPlayerCharacters();
    },

    renderPlayerCharacterPreview(pc) {
      if (!pc) return '<div class="pc-preview-card empty" id="pc-preview-card">Нет данных</div>';
      const raceName = (this.data?.races?.[pc.race]?.name) || pc.race || '—';
      const className = (this.data?.classes?.[pc.class]?.name) || pc.class || '—';
      const stats = pc.stats || defaultStats();
      const port = pc.portrait
        ? `<div class="pc-preview-portrait"><img src="${this.escapeAttr?.(pc.portrait) || pc.portrait}" alt="" onerror="this.style.display='none'"/></div>`
        : `<div class="pc-preview-portrait pc-preview-portrait--empty">🎭</div>`;
      const esc = (s) => (typeof this.escapeHtml === 'function' ? this.escapeHtml(s) : String(s || ''));
      return `<div class="pc-preview-card" id="pc-preview-card">
        ${port}
        <div class="pc-preview-name">${esc(pc.displayName || pc.name || 'Без имени')}</div>
        <div class="pc-preview-meta">${esc(className)}</div>
        <div class="pc-preview-meta">${esc(raceName)}</div>
        <div class="pc-preview-stats">
          ${STAT_KEYS.map((k) => `<span><b>${STAT_LABELS[k]}</b> ${stats[k] ?? 10}</span>`).join('')}
        </div>
      </div>`;
    },

    renderPlayerCharacterForm(pc, isNew) {
      const p = pc || blankCharacter();
      const mode = this.playerCharacterFormMode || 'quick';
      const races = Object.entries(this.data?.races || {});
      const classes = Object.entries(this.data?.classes || {});
      const raceOpts = ['<option value="">— не выбрана —</option>']
        .concat(races.map(([id, r]) => `<option value="${this.escapeAttr?.(id) || id}" ${p.race === id ? 'selected' : ''}>${this.escapeHtml?.(r.name || id) || id}</option>`));
      const classOpts = ['<option value="">— не выбран —</option>']
        .concat(classes.map(([id, c]) => `<option value="${this.escapeAttr?.(id) || id}" ${p.class === id ? 'selected' : ''}>${this.escapeHtml?.(c.name || id) || id}</option>`));
      const esc = (s) => (typeof this.escapeHtml === 'function' ? this.escapeHtml(s) : String(s ?? ''));
      const inv = (p.startingInventory || [])
        .map((iid) => {
          const name = this.data?.items?.[iid]?.name || iid;
          return `<li data-item-id="${esc(iid)}">${esc(name)}
            <button type="button" class="btn btn-sm btn-secondary" data-pc-remove-item="${esc(iid)}">✕</button></li>`;
        })
        .join('');

      const detailed = mode === 'detailed';
      return `
        <div class="pc-form" data-pc-form="1">
          <div class="pc-mode-toggle">
            <button type="button" class="btn btn-sm ${mode === 'quick' ? 'btn-primary' : 'btn-secondary'}" data-pc-mode="quick">Быстрое создание</button>
            <button type="button" class="btn btn-sm ${detailed ? 'btn-primary' : 'btn-secondary'}" data-pc-mode="detailed">Подробное создание</button>
          </div>
          <div class="form-group">
            <label>Имя *</label>
            <input type="text" id="pc-form-name" class="form-input" value="${esc(p.name)}" placeholder="Например: Сэр Джулиан" />
          </div>
          ${detailed ? `<div class="form-group">
            <label>Отображаемое имя</label>
            <input type="text" id="pc-form-display" class="form-input" value="${esc(p.displayName)}" />
          </div>` : `<input type="hidden" id="pc-form-display" value="${esc(p.displayName || p.name)}" />`}
          <div class="form-group">
            <label>Изображение (URL портрета)</label>
            <input type="text" id="pc-form-portrait" class="form-input" value="${esc(p.portrait)}" placeholder="https://… или путь к файлу" />
          </div>
          <div class="form-row" style="display:flex;gap:12px;flex-wrap:wrap;">
            <div class="form-group" style="flex:1;min-width:140px;">
              <label>Раса</label>
              <select id="pc-form-race" class="form-input">${raceOpts.join('')}</select>
            </div>
            <div class="form-group" style="flex:1;min-width:140px;">
              <label>Класс</label>
              <select id="pc-form-class" class="form-input">${classOpts.join('')}</select>
            </div>
          </div>
          ${detailed ? `
          <h4>Характер</h4>
          <div class="form-group"><label>Описание</label>
            <textarea id="pc-form-description" class="form-input" rows="2">${esc(p.description)}</textarea></div>
          <div class="form-group"><label>Характер</label>
            <input type="text" id="pc-form-personality" class="form-input" value="${esc(p.personality)}" /></div>
          <div class="form-group"><label>Цели</label>
            <input type="text" id="pc-form-goals" class="form-input" value="${esc(p.goals)}" /></div>
          <div class="form-group"><label>Страхи</label>
            <input type="text" id="pc-form-fears" class="form-input" value="${esc(p.fears)}" /></div>
          <div class="form-group"><label>Мотивация</label>
            <input type="text" id="pc-form-motivation" class="form-input" value="${esc(p.motivation)}" /></div>
          <h4>Предыстория персонажа</h4>
          <p class="hint">Кем он был раньше? Почему отправился в путешествие? Чего хочет добиться? Что оставил позади?</p>
          <div class="form-group">
            <textarea id="pc-form-backstory" class="form-input" rows="6" placeholder="Напишите предысторию обычным текстом…">${esc(p.backstory)}</textarea>
          </div>
          <h4>Характеристики</h4>
          <div class="pc-stats-grid">
            ${STAT_KEYS.map((k) => `
              <label>${STAT_LABELS[k]}
                <input type="number" id="pc-stat-${k}" class="form-input" min="1" max="30" value="${(p.stats || defaultStats())[k] ?? 10}" />
              </label>`).join('')}
          </div>
          <h4>Стартовый инвентарь</h4>
          <ul id="pc-inventory-list" class="pc-inventory-list">${inv || '<li class="hint">Пусто</li>'}</ul>
          <div class="form-group">
            <label>Добавить предмет (ID)</label>
            <div style="display:flex;gap:8px;">
              <input type="text" id="pc-add-item-id" class="form-input" placeholder="potion_heal" list="pc-item-datalist" />
              <button type="button" class="btn btn-secondary" id="pc-add-item-btn">+</button>
            </div>
            <datalist id="pc-item-datalist">
              ${Object.entries(this.data?.items || {}).slice(0, 80).map(([id, it]) =>
                `<option value="${esc(id)}">${esc(it.name || id)}</option>`).join('')}
            </datalist>
          </div>
          ` : `
          <input type="hidden" id="pc-form-description" value="${esc(p.description)}" />
          <input type="hidden" id="pc-form-personality" value="${esc(p.personality)}" />
          <input type="hidden" id="pc-form-goals" value="${esc(p.goals)}" />
          <input type="hidden" id="pc-form-fears" value="${esc(p.fears)}" />
          <input type="hidden" id="pc-form-motivation" value="${esc(p.motivation)}" />
          <input type="hidden" id="pc-form-backstory" value="${esc(p.backstory)}" />
          ${STAT_KEYS.map((k) => `<input type="hidden" id="pc-stat-${k}" value="${(p.stats || defaultStats())[k] ?? 10}" />`).join('')}
          <ul id="pc-inventory-list" class="hidden"></ul>
          `}
          <div class="pc-form-actions" style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" class="btn btn-primary" id="pc-submit-btn">${isNew ? 'Создать персонажа' : 'Сохранить'}</button>
            ${!isNew ? `<button type="button" class="btn btn-secondary" data-pc-delete="${esc(p.id)}">Удалить</button>` : ''}
          </div>
        </div>`;
    },

    renderPlayerCharacters() {
      const root = document.getElementById('player-characters-editor');
      if (!root) return;
      if (!this.data) {
        root.innerHTML = '<div class="empty-state"><h2>Загрузите данные</h2></div>';
        return;
      }
      this.ensurePlayerCharacters();
      const ids = this.getPlayerCharacterIds();
      const editId = this.editingPlayerCharacterId;
      const pc = editId ? this.data.playerCharacters[editId] : (this._pcDraft || null);
      const isNew = !editId;

      const listHtml = ids.length
        ? ids.map((id) => {
            const c = this.data.playerCharacters[id];
            const active = id === editId ? ' is-active' : '';
            const esc = (s) => (typeof this.escapeHtml === 'function' ? this.escapeHtml(s) : String(s || ''));
            return `<button type="button" class="scene-item${active}" data-pc-select="${esc(id)}">
              <div class="scene-loc">${esc(c.displayName || c.name || id)}</div>
              <div class="scene-preview hint">${esc((this.data.classes?.[c.class]?.name) || c.class || '')} · ${esc((this.data.races?.[c.race]?.name) || c.race || '')}</div>
            </button>`;
          }).join('')
        : '<p class="hint">Пока нет персонажей игрока. Создайте первого.</p>';

      root.innerHTML = `
        <div class="editor-split pc-editor-layout" style="display:flex;gap:16px;flex-wrap:wrap;">
          <div class="pc-list-panel" style="flex:0 0 220px;max-width:100%;">
            <h3>🎭 Персонажи игрока</h3>
            <button type="button" class="btn btn-primary" id="pc-new-btn" style="width:100%;margin-bottom:10px;">+ Создать персонажа</button>
            <div class="pc-list">${listHtml}</div>
          </div>
          <div class="pc-main-panel" style="flex:1;min-width:280px;">
            <h3>${isNew ? 'Новый персонаж' : 'Редактирование'}</h3>
            ${this.renderPlayerCharacterForm(pc || blankCharacter(), isNew)}
          </div>
          <div class="pc-preview-panel" style="flex:0 0 200px;">
            <h4>Превью</h4>
            ${this.renderPlayerCharacterPreview(pc || blankCharacter())}
          </div>
        </div>`;

      this._bindPlayerCharacterUI(root);
    },

    _bindPlayerCharacterUI(root) {
      if (!root || root._pcBound) return;
      root._pcBound = true;
      root.addEventListener('click', (e) => {
        const t = e.target.closest('[data-pc-select],[data-pc-mode],[data-pc-delete],[data-pc-remove-item],#pc-submit-btn,#pc-new-btn,#pc-add-item-btn');
        if (!t) return;
        if (t.id === 'pc-submit-btn') {
          this.submitPlayerCharacterCreator();
          return;
        }
        if (t.id === 'pc-new-btn') {
          this.editingPlayerCharacterId = null;
          this._pcDraft = blankCharacter({ name: '' });
          this.renderPlayerCharacters();
          return;
        }
        if (t.id === 'pc-add-item-btn') {
          const iid = document.getElementById('pc-add-item-id')?.value?.trim();
          if (this.editingPlayerCharacterId && iid) this.addPlayerCharacterItem(this.editingPlayerCharacterId, iid);
          return;
        }
        const sel = t.getAttribute('data-pc-select');
        if (sel) {
          this.selectPlayerCharacterToEdit(sel);
          return;
        }
        const mode = t.getAttribute('data-pc-mode');
        if (mode) {
          this.setPlayerCharacterFormMode(mode);
          return;
        }
        const del = t.getAttribute('data-pc-delete');
        if (del) {
          this.deletePlayerCharacter(del);
          return;
        }
        const rm = t.getAttribute('data-pc-remove-item');
        if (rm && this.editingPlayerCharacterId) {
          this.removePlayerCharacterItem(this.editingPlayerCharacterId, rm);
        }
      });
      root.addEventListener('input', (e) => {
        const id = e.target.id;
        if (!id) return;
        // live preview for name/class/race
        if (['pc-form-name', 'pc-form-display', 'pc-form-race', 'pc-form-class', 'pc-form-portrait'].includes(id) || id.startsWith('pc-stat-')) {
          const draft = blankCharacter({
            id: this.editingPlayerCharacterId || '',
            name: document.getElementById('pc-form-name')?.value,
            displayName: document.getElementById('pc-form-display')?.value,
            portrait: document.getElementById('pc-form-portrait')?.value,
            race: document.getElementById('pc-form-race')?.value,
            class: document.getElementById('pc-form-class')?.value,
            stats: Object.fromEntries(STAT_KEYS.map((k) => [k, parseInt(document.getElementById('pc-stat-' + k)?.value, 10) || 10]))
          });
          const prev = document.getElementById('pc-preview-card');
          if (prev) prev.outerHTML = this.renderPlayerCharacterPreview(draft);
        }
      });
    }
  });

  // Hooks integration
  if (Editor.hooks && typeof Editor.hooks.after === 'function') {
    Editor.hooks.after('switchTab', function (result, args) {
      if (args && args[0] === 'player_characters' && typeof this.renderPlayerCharacters === 'function') {
        this.renderPlayerCharacters();
      }
      return result;
    });
    Editor.hooks.after('renderAll', function (result) {
      if (this.currentTab === 'player_characters' && typeof this.renderPlayerCharacters === 'function') {
        this.renderPlayerCharacters();
      }
      return result;
    });
  }

  // Styles
  if (typeof document !== 'undefined' && !document.getElementById('pc-editor-styles')) {
    const st = document.createElement('style');
    st.id = 'pc-editor-styles';
    st.textContent = `
      .pc-preview-card { border:1px solid var(--border,#444); border-radius:12px; padding:16px; text-align:center; background:var(--panel,#1a1a1a); }
      .pc-preview-portrait { width:96px; height:96px; margin:0 auto 10px; border-radius:50%; overflow:hidden; background:#333; display:flex; align-items:center; justify-content:center; font-size:40px; }
      .pc-preview-portrait img { width:100%; height:100%; object-fit:cover; }
      .pc-preview-name { font-weight:700; font-size:1.1rem; margin-bottom:4px; }
      .pc-preview-meta { color:var(--muted,#999); font-size:0.9rem; }
      .pc-preview-stats { display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-top:12px; font-size:0.85rem; }
      .pc-stats-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
      .pc-mode-toggle { display:flex; gap:8px; margin-bottom:12px; }
      .pc-inventory-list { list-style:none; padding:0; }
      .pc-inventory-list li { display:flex; justify-content:space-between; align-items:center; padding:4px 0; }
      .scene-item.is-active { outline:2px solid var(--accent,#6af); }
    `;
    document.head.appendChild(st);
  }
})();
