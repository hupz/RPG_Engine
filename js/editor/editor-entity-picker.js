// ============================================================
// EntityPicker — универсальный поиск и выбор сущностей в Editor
// Виды: npc | item | enemy | scene | location | quest | class | ability
// ============================================================
(function attachEntityPicker() {
  'use strict';
  if (typeof Editor === 'undefined') {
    console.error('editor-entity-picker: Editor missing');
    return;
  }

  const KIND_META = {
    npc: { icon: '👤', label: 'Персонаж', source: 'npcs' },
    item: { icon: '🎒', label: 'Предмет', source: 'items' },
    enemy: { icon: '⚔️', label: 'Враг', source: 'enemies' },
    scene: { icon: '🎬', label: 'Место', source: 'scenes' },
    location: { icon: '📍', label: 'Локация', source: 'location' },
    quest: { icon: '📜', label: 'Квест', source: 'quests' },
    class: { icon: '🛡️', label: 'Класс', source: 'classes' },
    ability: { icon: '✨', label: 'Умение', source: 'ability' }
  };

  const DEFAULT_LIMIT = 40;

  function meta(kind) {
    return KIND_META[kind] || { icon: '•', label: kind || '?', source: kind };
  }

  function listEntities(kind, data) {
    data = data || {};
    const out = [];
    if (kind === 'npc') {
      Object.keys(data.npcs || {}).forEach((id) => {
        const n = data.npcs[id] || {};
        out.push({ id, name: n.name || n.title || id, desc: n.desc || n.role || '', icon: n.icon || meta(kind).icon });
      });
    } else if (kind === 'item') {
      Object.keys(data.items || {}).forEach((id) => {
        const it = data.items[id] || {};
        out.push({ id, name: it.name || id, desc: it.type || it.desc || '', icon: it.icon || meta(kind).icon });
      });
    } else if (kind === 'enemy') {
      Object.keys(data.enemies || {}).forEach((id) => {
        const e = data.enemies[id] || {};
        out.push({ id, name: e.name || id, desc: e.desc || '', icon: e.icon || meta(kind).icon });
      });
    } else if (kind === 'scene') {
      Object.keys(data.scenes || {}).forEach((id) => {
        const s = data.scenes[id] || {};
        out.push({ id, name: s.title || s.name || id, desc: s.location || '', icon: meta(kind).icon });
      });
    } else if (kind === 'location') {
      const seen = new Set();
      Object.keys(data.scenes || {}).forEach((id) => {
        seen.add(id);
        const s = data.scenes[id] || {};
        out.push({ id, name: s.title || s.name || id, desc: 'сцена', icon: meta(kind).icon });
      });
      Object.keys(data.worldMap || {}).forEach((id) => {
        if (seen.has(id)) return;
        const loc = data.worldMap[id] || {};
        out.push({ id, name: loc.label || loc.name || id, desc: 'карта', icon: '🗺️' });
      });
    } else if (kind === 'quest') {
      Object.keys(data.quests || {}).forEach((id) => {
        const q = data.quests[id] || {};
        out.push({ id, name: q.name || q.title || id, desc: q.description || '', icon: meta(kind).icon });
      });
    } else if (kind === 'class') {
      Object.keys(data.classes || {}).forEach((id) => {
        const c = data.classes[id] || {};
        out.push({ id, name: c.name || id, desc: c.desc || '', icon: c.icon || meta(kind).icon });
      });
    } else if (kind === 'ability') {
      Object.entries(data.progression?.abilities || {}).forEach(([id, ab]) => {
        out.push({ id, name: (ab && ab.name) || id, desc: 'пул умений', icon: (ab && ab.icon) || meta(kind).icon });
      });
    }
    out.sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'));
    return out;
  }

  function filterEntities(list, query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return list;
    return list.filter((e) => {
      return (
        String(e.id).toLowerCase().includes(q) ||
        String(e.name).toLowerCase().includes(q) ||
        String(e.desc || '').toLowerCase().includes(q)
      );
    });
  }

  /**
   * HTML контрола.
   * @param {object} opts
   * @param {string} opts.kind
   * @param {string} [opts.value]
   * @param {string} opts.onChange  — JS, this.value = выбранный id (как у <select onchange>)
   * @param {number} [opts.limit]
   * @param {string} [opts.placeholder]
   * @param {string} [opts.id] — unique id for the root
   */
  function renderEntityPicker(opts) {
    opts = opts || {};
    const kind = opts.kind || 'npc';
    const value = opts.value != null ? String(opts.value) : '';
    const onChange = opts.onChange || '';
    const limit = opts.limit != null ? opts.limit : DEFAULT_LIMIT;
    const m = meta(kind);
    const uid = opts.id || ('ep-' + kind + '-' + Math.random().toString(36).slice(2, 9));
    const entities = listEntities(kind, this.data);
    const current = value ? entities.find((e) => e.id === value) : null;
    const displayName = current ? current.name : (value ? ('⚠ ' + value) : '');
    const displayId = value || '';
    const missing = value && !current;

    return `<div class="entity-picker" data-entity-picker="1" data-kind="${this.escapeAttr(kind)}"
      data-value="${this.escapeAttr(value)}" data-limit="${limit}"
      data-onchange="${this.escapeAttr(onChange)}" id="${this.escapeAttr(uid)}">
      <div class="entity-picker-current ${missing ? 'is-missing' : ''}">
        <span class="entity-picker-current-icon">${this.escapeHtml(current?.icon || m.icon)}</span>
        <span class="entity-picker-current-text">
          ${value
            ? `<strong>${this.escapeHtml(displayName || value)}</strong>
               <span class="entity-picker-id">${this.escapeHtml(m.label)}: ${this.escapeHtml(displayId)}</span>`
            : `<span class="entity-picker-placeholder">${this.escapeHtml(opts.placeholder || ('Выберите: ' + m.label))}</span>`}
        </span>
        <button type="button" class="entity-picker-clear btn-remove" title="Очистить" aria-label="Очистить"
          ${value ? '' : 'hidden'}>×</button>
        <button type="button" class="entity-picker-toggle" aria-label="Открыть список" aria-expanded="false">▾</button>
      </div>
      <div class="entity-picker-dropdown" hidden>
        <input type="search" class="entity-picker-search" placeholder="🔎 Поиск..." autocomplete="off" />
        <ul class="entity-picker-list" role="listbox"></ul>
        <div class="entity-picker-create-bar">
          <button type="button" class="btn btn-secondary btn-sm entity-picker-create-btn">+ Создать ${this.escapeHtml(m.label)}</button>
        </div>
      </div>
    </div>`;
  }

  function ensureStyles() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('entity-picker-styles')) return;
    const st = document.createElement('style');
    st.id = 'entity-picker-styles';
    st.textContent = `
      .entity-picker { position: relative; width: 100%; max-width: 420px; font-size: 13px; }
      .entity-picker-current {
        display: flex; align-items: center; gap: 8px; padding: 6px 8px;
        border: 1px solid var(--border, #cbb); border-radius: 8px;
        background: var(--card, #fff); cursor: pointer; min-height: 36px;
      }
      .entity-picker-current.is-missing { border-color: #c0392b; }
      .entity-picker-current-icon { font-size: 1.15em; flex-shrink: 0; }
      .entity-picker-current-text { flex: 1; min-width: 0; line-height: 1.25; }
      .entity-picker-current-text strong { display: block; }
      .entity-picker-id, .entity-picker-placeholder { color: var(--muted, #666); font-size: 12px; }
      .entity-picker-toggle, .entity-picker-clear {
        border: none; background: transparent; cursor: pointer; font-size: 14px; padding: 2px 6px; line-height: 1;
      }
      .entity-picker-dropdown {
        position: absolute; z-index: 40; left: 0; right: 0; top: calc(100% + 4px);
        background: var(--card, #fff); border: 1px solid var(--border, #cbb);
        border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.12); overflow: hidden;
      }
      .entity-picker-search {
        width: 100%; box-sizing: border-box; border: none; border-bottom: 1px solid var(--border, #ddd);
        padding: 8px 10px; font-size: 13px; outline: none;
      }
      .entity-picker-list {
        list-style: none; margin: 0; padding: 4px 0; max-height: 240px; overflow-y: auto;
      }
      .entity-picker-list li {
        display: flex; gap: 8px; align-items: flex-start; padding: 7px 10px; cursor: pointer;
      }
      .entity-picker-list li:hover, .entity-picker-list li.is-active {
        background: rgba(109, 76, 65, 0.1);
      }
      .entity-picker-list li.is-selected { background: rgba(109, 76, 65, 0.16); }
      .entity-picker-list .ep-icon { flex-shrink: 0; }
      .entity-picker-list .ep-name { font-weight: 600; display: block; }
      .entity-picker-list .ep-meta { font-size: 11px; color: var(--muted, #666); }
      .entity-picker-create-bar {
        border-top: 1px solid var(--border, #ccc); padding: 8px; background: var(--card-bg, #fff);
      }
      .entity-picker-create-bar .btn { width: 100%; }
      .entity-picker-create-modal {
        position: fixed; inset: 0; z-index: 10050; display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.35);
      }
      .entity-picker-create-panel {
        background: var(--card-bg, #fff); border-radius: 10px; padding: 16px 18px;
        min-width: 280px; max-width: 400px; box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      }
      .entity-picker-create-panel h3 { margin: 0 0 12px; font-size: 16px; }
      .entity-picker-create-panel .form-group { margin-bottom: 10px; }
      .entity-picker-create-panel .form-group label { display: block; font-size: 13px; margin-bottom: 4px; }
      .entity-picker-create-panel input, .entity-picker-create-panel select {
        width: 100%; padding: 6px 8px; border: 1px solid var(--border, #ccc); border-radius: 6px;
      }
      .entity-picker-create-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }

      .entity-picker-empty { padding: 12px; color: var(--muted, #666); text-align: center; }
    `;
    document.head.appendChild(st);
  }

  function closeAll(except) {
    document.querySelectorAll('.entity-picker[data-open="1"]').forEach((root) => {
      if (except && root === except) return;
      root.dataset.open = '0';
      const dd = root.querySelector('.entity-picker-dropdown');
      const tog = root.querySelector('.entity-picker-toggle');
      if (dd) dd.hidden = true;
      if (tog) tog.setAttribute('aria-expanded', 'false');
    });
  }

  function setValue(root, id, fireChange) {
    const kind = root.dataset.kind;
    const m = meta(kind);
    const entities = listEntities(kind, Editor.data);
    const ent = id ? entities.find((e) => e.id === id) : null;
    root.dataset.value = id || '';
    const iconEl = root.querySelector('.entity-picker-current-icon');
    const textEl = root.querySelector('.entity-picker-current-text');
    const clearBtn = root.querySelector('.entity-picker-clear');
    const cur = root.querySelector('.entity-picker-current');
    if (iconEl) iconEl.textContent = ent?.icon || m.icon;
    if (textEl) {
      if (id) {
        textEl.innerHTML = `<strong>${Editor.escapeHtml(ent?.name || id)}</strong>
          <span class="entity-picker-id">${Editor.escapeHtml(m.label)}: ${Editor.escapeHtml(id)}</span>`;
        if (cur) cur.classList.toggle('is-missing', !ent);
      } else {
        textEl.innerHTML = `<span class="entity-picker-placeholder">Выберите: ${Editor.escapeHtml(m.label)}</span>`;
        if (cur) cur.classList.remove('is-missing');
      }
    }
    if (clearBtn) clearBtn.hidden = !id;
    if (fireChange) {
      const expr = root.getAttribute('data-onchange') || '';
      if (expr) {
        try {
          const code = expr.replace(/\bthis\.value\b/g, JSON.stringify(id || ''));
          const fn = new Function('Editor', code);
          fn(typeof Editor !== 'undefined' ? Editor : window.Editor);
        } catch (e) {
          console.error('[EntityPicker] onChange failed', e, expr);
        }
      }
      root.dispatchEvent(new CustomEvent('entity-picker-change', { detail: { kind, id: id || '' }, bubbles: true }));
    }
  }

  function renderList(root, query, activeIndex) {
    const kind = root.dataset.kind;
    const limit = parseInt(root.dataset.limit, 10) || DEFAULT_LIMIT;
    const selected = root.dataset.value || '';
    const listEl = root.querySelector('.entity-picker-list');
    if (!listEl) return 0;
    const filtered = filterEntities(listEntities(kind, Editor.data), query).slice(0, limit);
    if (!filtered.length) {
      listEl.innerHTML = '<li class="entity-picker-empty" role="presentation">Ничего не найдено</li>';
      return 0;
    }
    const m = meta(kind);
    listEl.innerHTML = filtered.map((e, i) => {
      const active = i === activeIndex ? ' is-active' : '';
      const sel = e.id === selected ? ' is-selected' : '';
      return `<li role="option" data-id="${Editor.escapeAttr(e.id)}" class="${active}${sel}" data-index="${i}">
        <span class="ep-icon">${Editor.escapeHtml(e.icon || m.icon)}</span>
        <span><span class="ep-name">${Editor.escapeHtml(e.name)}</span>
        <span class="ep-meta">${Editor.escapeHtml(m.label)}: ${Editor.escapeHtml(e.id)}${e.desc ? ' · ' + Editor.escapeHtml(String(e.desc).slice(0, 48)) : ''}</span></span>
      </li>`;
    }).join('');
    return filtered.length;
  }

  function openPicker(root) {
    ensureStyles();
    closeAll(root);
    root.dataset.open = '1';
    const dd = root.querySelector('.entity-picker-dropdown');
    const search = root.querySelector('.entity-picker-search');
    const tog = root.querySelector('.entity-picker-toggle');
    if (dd) dd.hidden = false;
    if (tog) tog.setAttribute('aria-expanded', 'true');
    root._epActive = 0;
    renderList(root, '', 0);
    if (search) {
      search.value = '';
      setTimeout(() => search.focus(), 0);
    }
  }

  function closePicker(root) {
    root.dataset.open = '0';
    const dd = root.querySelector('.entity-picker-dropdown');
    const tog = root.querySelector('.entity-picker-toggle');
    if (dd) dd.hidden = true;
    if (tog) tog.setAttribute('aria-expanded', 'false');
  }

  function onKey(root, e) {
    if (root.dataset.open !== '1') {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        openPicker(root);
      }
      return;
    }
    const listEl = root.querySelector('.entity-picker-list');
    const items = listEl ? [...listEl.querySelectorAll('li[data-id]')] : [];
    let active = root._epActive || 0;
    if (e.key === 'Escape') {
      e.preventDefault();
      closePicker(root);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = Math.min(active + 1, Math.max(items.length - 1, 0));
      root._epActive = active;
      items.forEach((li, i) => li.classList.toggle('is-active', i === active));
      items[active]?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = Math.max(active - 1, 0);
      root._epActive = active;
      items.forEach((li, i) => li.classList.toggle('is-active', i === active));
      items[active]?.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const li = items[active];
      if (li) {
        setValue(root, li.getAttribute('data-id'), true);
        closePicker(root);
      }
    }
  }


  function slugFromName(name, prefix) {
    const tr = {
      а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',
      о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'
    };
    let s = String(name || '').toLowerCase();
    let out = '';
    for (const ch of s) {
      if (tr[ch] != null) out += tr[ch];
      else if (/[a-z0-9]/.test(ch)) out += ch;
      else if (/[\s\-_]+/.test(ch)) out += '_';
    }
    let id = out.replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 36);
    if (!id) id = (prefix || 'new') + '_' + Date.now().toString(36).slice(-4);
    if (!/^[a-z]/i.test(id)) id = (prefix || 'n') + '_' + id;
    return id;
  }

  function uniqueId(bucket, base) {
    const map = (Editor.data && Editor.data[bucket]) || {};
    let id = base;
    let n = 2;
    while (map[id]) {
      id = base + '_' + n;
      n += 1;
    }
    return id;
  }

  /**
   * Создать сущность в проекте без ухода с текущего экрана.
   * @returns {string|null} id
   */
  Editor.createEntityContextual = function createEntityContextual(kind, fields) {
    fields = fields || {};
    const name = String(fields.name || '').trim();
    if (!name) {
      if (Editor.toast) Editor.toast.warning('Укажите имя');
      return null;
    }
    if (!this.data) return null;

    let id = null;
    if (kind === 'npc') {
      this.ensureNpcs?.();
      if (!this.data.npcs) this.data.npcs = {};
      id = uniqueId('npcs', slugFromName(name, 'npc'));
      this.data.npcs[id] = {
        id,
        name,
        location: '',
        icon: '👤',
        description: fields.role || fields.description || '',
        role: fields.role || '',
        dialogues: { default: [] },
        quests: [],
        shop: false,
        attitude: 'neutral'
      };
    } else if (kind === 'item') {
      if (!this.data.items) this.data.items = {};
      id = uniqueId('items', slugFromName(name, 'item'));
      this.data.items[id] = {
        id,
        name,
        type: fields.type || 'misc',
        desc: fields.description || ''
      };
    } else if (kind === 'enemy') {
      this.ensureEnemies?.();
      if (!this.data.enemies) this.data.enemies = {};
      id = uniqueId('enemies', slugFromName(name, 'enemy'));
      this.data.enemies[id] = {
        id,
        name,
        creatureType: 'humanoid',
        hp: 10,
        maxHp: 10,
        ac: 12,
        atkBonus: 2,
        dmgRoll: '1d6',
        dmgBonus: 0,
        dex: 2
      };
    } else if (kind === 'scene' || kind === 'location') {
      if (!this.data.scenes) this.data.scenes = {};
      id = uniqueId('scenes', slugFromName(name, 'scene'));
      this.data.scenes[id] = {
        id,
        location: name,
        title: name,
        text: '',
        choices: []
      };
      if (!this.currentScene) this.currentScene = id;
    } else if (kind === 'quest') {
      this.ensureQuests?.();
      if (!this.data.quests) this.data.quests = {};
      id = uniqueId('quests', slugFromName(name, 'quest'));
      this.data.quests[id] = {
        id,
        title: name,
        stages: [{
          id: 'stage_0',
          title: 'Начало',
          tasks: [{ type: 'ManualAdvance', id: id + '_t0', description: 'После нажатия «Продолжить»' }]
        }],
        hidden: false,
        rewards: { exp: 0, gold: 0 },
        questFormat: 2
      };
    } else if (kind === 'class') {
      if (!this.data.classes) this.data.classes = {};
      id = uniqueId('classes', slugFromName(name, 'class'));
      this.data.classes[id] = {
        id,
        name,
        icon: '🛡️',
        hp: 10,
        ac: 10,
        stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        resource: { name: 'Ресурс', max: 2, desc: '' },
        abilities: []
      };
    } else if (kind === 'ability') {
      this.ensureProgressionAbilities?.();
      if (!this.data.progression) this.data.progression = {};
      if (!this.data.progression.abilities) this.data.progression.abilities = {};
      id = uniqueId('progression', slugFromName(name, 'ability'));
      // progression.abilities is nested — unique against abilities keys
      let aid = slugFromName(name, 'ability');
      let n = 2;
      while (this.data.progression.abilities[aid]) {
        aid = slugFromName(name, 'ability') + '_' + n;
        n += 1;
      }
      id = aid;
      this.data.progression.abilities[id] = {
        id,
        name,
        icon: '✨',
        cost: 1,
        usage: 'both',
        type: 'active',
        desc: fields.description || '',
        effect: { type: 'damage', value: '1d6', damageType: 'physical', targeting: { scope: 'single', range: 'self' } }
      };
    } else {
      if (Editor.toast) Editor.toast.warning('Создание этого типа пока не поддерживается здесь');
      return null;
    }

    this.updateJSONPreview?.();
    // Undo: one atomic create if history available
    try {
      if (typeof EditorHistory !== 'undefined' && EditorHistory.recordCreate) {
        const typeMap = {
          npc: 'npc', item: 'item', enemy: 'enemy', scene: 'scene',
          location: 'scene', quest: 'quest', class: 'class', ability: 'ability'
        };
        const t = typeMap[kind];
        if (t) EditorHistory.recordCreate(t, id, null);
      }
    } catch (e) { /* ignore */ }
    if (Editor.toast) Editor.toast.success((meta(kind).label || kind) + ' «' + name + '» создан');
    return id;
  };

  function openCreateModal(pickerRoot) {
    const kind = pickerRoot.dataset.kind || 'npc';
    const m = meta(kind);
    closePicker(pickerRoot);
    const existing = document.getElementById('entity-picker-create-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'entity-picker-create-modal';
    modal.className = 'entity-picker-create-modal';
    let extra = '';
    if (kind === 'npc') {
      extra = `<div class="form-group"><label>Роль</label>
        <input type="text" data-field="role" placeholder="Например: Квестодатель" /></div>`;
    }
    if (kind === 'item') {
      extra = `<div class="form-group"><label>Тип</label>
        <select data-field="type">
          <option value="misc">Разное</option>
          <option value="weapon">Оружие</option>
          <option value="armor">Броня</option>
          <option value="consumable">Расходник</option>
          <option value="quest">Квестовый</option>
        </select></div>`;
    }
    modal.innerHTML = `
      <div class="entity-picker-create-panel" role="dialog" aria-label="Создать">
        <h3>+ Создать: ${Editor.escapeHtml(m.label)}</h3>
        <div class="form-group"><label>Имя</label>
          <input type="text" data-field="name" placeholder="Название" autofocus /></div>
        ${extra}
        <div class="entity-picker-create-actions">
          <button type="button" class="btn btn-secondary" data-act="cancel">Отмена</button>
          <button type="button" class="btn btn-primary" data-act="ok">Создать и выбрать</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const nameInput = modal.querySelector('[data-field="name"]');
    setTimeout(() => nameInput?.focus(), 0);

    function finish(ok) {
      if (!ok) {
        modal.remove();
        return;
      }
      const fields = {};
      modal.querySelectorAll('[data-field]').forEach((el) => {
        fields[el.getAttribute('data-field')] = el.value;
      });
      const id = Editor.createEntityContextual(kind, fields);
      modal.remove();
      if (!id) return;
      setValue(pickerRoot, id, true);
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) finish(false);
      const act = e.target.getAttribute?.('data-act');
      if (act === 'cancel') finish(false);
      if (act === 'ok') finish(true);
    });
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') finish(false);
      if (e.key === 'Enter' && e.target.matches('input')) {
        e.preventDefault();
        finish(true);
      }
    });
  }


  function bindEntityPickers(root) {
    ensureStyles();
    const scope = root && root.querySelectorAll ? root : document;
    // delegation once on document
    if (!window._entityPickerBound) {
      window._entityPickerBound = true;
      document.addEventListener('click', (e) => {
        const rootEl = e.target.closest?.('.entity-picker');
        if (!rootEl) {
          closeAll();
          return;
        }
        if (e.target.closest('.entity-picker-clear')) {
          e.preventDefault();
          e.stopPropagation();
          setValue(rootEl, '', true);
          closePicker(rootEl);
          return;
        }
        if (e.target.closest('.entity-picker-create-btn')) {
          e.preventDefault();
          e.stopPropagation();
          openCreateModal(rootEl);
          return;
        }
        if (e.target.closest('.entity-picker-list li[data-id]')) {
          const li = e.target.closest('li[data-id]');
          setValue(rootEl, li.getAttribute('data-id'), true);
          closePicker(rootEl);
          return;
        }
        if (e.target.closest('.entity-picker-current') || e.target.closest('.entity-picker-toggle')) {
          e.preventDefault();
          if (rootEl.dataset.open === '1') closePicker(rootEl);
          else openPicker(rootEl);
          return;
        }
      });
      document.addEventListener('input', (e) => {
        const search = e.target.closest?.('.entity-picker-search');
        if (!search) return;
        const rootEl = search.closest('.entity-picker');
        if (!rootEl) return;
        rootEl._epActive = 0;
        renderList(rootEl, search.value, 0);
      });
      document.addEventListener('keydown', (e) => {
        const rootEl = e.target.closest?.('.entity-picker') || document.querySelector('.entity-picker[data-open="1"]');
        if (!rootEl) return;
        if (e.target.classList?.contains('entity-picker-search') || rootEl.contains(e.target)) {
          onKey(rootEl, e);
        } else if (e.key === 'Escape') {
          closeAll();
        }
      });
    }
  }

  Editor.listEntities = function (kind) {
    return listEntities(kind, this.data);
  };
  Editor.renderEntityPicker = renderEntityPicker;
  Editor.bindEntityPickers = bindEntityPickers;

  /**
   * Модальный выбор сущности (scene, quest, …).
   * @returns {Promise<string|null>} id или null при отмене
   */
  Editor.pickEntity = function pickEntity(kind, opts) {
    opts = opts || {};
    kind = kind || 'scene';
    const m = meta(kind);
    ensureStyles();
    bindEntityPickers(document);

    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'entity-picker-create-modal ep-pick-modal';
      modal.setAttribute('role', 'dialog');
      const uid = 'ep-pick-' + Math.random().toString(36).slice(2, 9);
      const pickerHtml = renderEntityPicker.call(Editor, {
        kind,
        value: opts.value || '',
        id: uid,
        placeholder: opts.placeholder || ('Выберите: ' + m.label)
      });
      modal.innerHTML =
        '<div class="entity-picker-create-panel ep-pick-panel">' +
        '<h3>' + Editor.escapeHtml(opts.title || m.label) + '</h3>' +
        (opts.message ? '<p class="hint">' + Editor.escapeHtml(opts.message) + '</p>' : '') +
        pickerHtml +
        '<div class="entity-picker-create-actions">' +
        '<button type="button" class="btn btn-secondary" data-act="cancel">Отмена</button>' +
        '<button type="button" class="btn btn-primary" data-act="ok">Выбрать</button>' +
        '</div></div>';
      document.body.appendChild(modal);

      const root = modal.querySelector('.entity-picker');
      const finish = (id) => {
        modal.remove();
        resolve(id == null ? null : String(id));
      };
      modal.addEventListener('click', (e) => {
        if (e.target === modal) finish(null);
        const act = e.target.getAttribute?.('data-act');
        if (act === 'cancel') finish(null);
        if (act === 'ok') finish(root?.dataset?.value || '');
      });
      root?.addEventListener('entity-picker-change', (e) => {
        if (opts.autoConfirm && e.detail?.id) finish(e.detail.id);
      });
      setTimeout(() => {
        const tog = root?.querySelector('.entity-picker-toggle');
        if (tog) tog.click();
      }, 0);
    });
  };

  Editor.EntityPicker = {
    kinds: Object.keys(KIND_META),
    list: listEntities,
    filter: filterEntities,
    meta,
    openCreate: openCreateModal
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => bindEntityPickers(document));
    } else {
      bindEntityPickers(document);
    }
  }

  if (Editor.hooks?.after) {
    // re-bind after major panel renders (delegation already global; ensure styles)
    ['renderQuests', 'renderItems', 'renderNPCs', 'renderSceneEditor', 'renderClasses'].forEach((m) => {
      Editor.hooks.after(m, function () {
        ensureStyles();
      });
    });
  }
})();
