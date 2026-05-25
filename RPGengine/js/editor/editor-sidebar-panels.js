// Редактор: боковой список + панель деталей (враги, NPC, умения)

(function attachEditorSidebarPanels() {
  if (typeof Editor === 'undefined') {
    console.error('editor-sidebar-panels.js: Editor не определён');
    return;
  }

  Object.assign(Editor, {
    editingEnemyId: null,
    editingNpcId: null,
    editingGlobalAbilityId: null,

    /** Общая разметка как у квестов / классов */
    renderEditorListLayout(opts) {
      const {
        title,
        icon = '',
        ids = [],
        getLabel,
        activeId,
        onSelectMethod,
        onAddMethod,
        addLabel = 'Добавить',
        detailHtml = '',
        emptyHint = 'Создайте первую запись.'
      } = opts;

      const addBtn = `<button type="button" class="btn btn-primary" style="width:100%;margin-top:10px;" onclick="${onAddMethod}()">+ ${this.escapeHtml(addLabel)}</button>`;

      if (!ids.length) {
        return `<div class="quest-manager">
          <div class="quest-manager-sidebar">
            <h4>${icon} ${this.escapeHtml(title)}</h4>
            <p class="hint">${this.escapeHtml(emptyHint)}</p>
            ${addBtn}
          </div>
          <div class="quest-manager-detail"><div class="empty-state"><h2>Пусто</h2></div></div>
        </div>`;
      }

      const sidebar = ids.map(id => {
        const active = id === activeId ? ' active' : '';
        const label = typeof getLabel === 'function' ? getLabel(id) : id;
        return `<button type="button" class="quest-pick${active}" onclick="${onSelectMethod}('${this.escapeAttr(id)}')">${this.escapeHtml(label)}</button>`;
      }).join('');

      return `<div class="quest-manager">
        <div class="quest-manager-sidebar">
          <h4>${icon} ${this.escapeHtml(title)}</h4>
          ${sidebar}
          ${addBtn}
        </div>
        <div class="quest-manager-detail">${detailHtml}</div>
      </div>`;
    },

    // ——— Враги ———
    ensureEnemies() {
      if (!this.data) return;
      if (!this.data.enemies || typeof this.data.enemies !== 'object') {
        this.data.enemies = {};
      }
    },

    getEnemyIds() {
      this.ensureEnemies();
      return Object.keys(this.data.enemies).sort();
    },

    selectEnemyToEdit(id) {
      this.editingEnemyId = id;
      this.renderEnemies();
    },

    renderEnemyDetail(id) {
      const e = this.data?.enemies?.[id];
      if (!e) return '<div class="empty-state"><h2>Враг не найден</h2></div>';
      const eid = this.escapeAttr(id);
      return `<div class="quest-detail-card">
        <div class="quest-detail-head">
          <h3>${this.escapeHtml(e.name || 'Без имени')}</h3>
          <button type="button" class="btn btn-danger" onclick="Editor.deleteEnemy('${eid}')">🗑 Удалить</button>
        </div>
        <div class="form-group"><label>ID</label><input value="${this.escapeHtml(id)}" disabled></div>
        <div class="form-group"><label>Имя</label>
          <input value="${this.escapeAttr(e.name || '')}" onchange="Editor.updateEnemy('${eid}','name',this.value)"></div>
        <div class="form-group">
          <label><input type="checkbox" ${e.boss ? 'checked' : ''}
            onchange="Editor.updateEnemy('${eid}','boss',this.checked)"> Босс (усиленное ОЗ по настройкам прогрессии)</label>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;">
          <div class="form-group"><label>HP</label><input type="number" value="${e.hp ?? 10}" onchange="Editor.updateEnemy('${eid}','hp',parseInt(this.value,10))"></div>
          <div class="form-group"><label>КД</label><input type="number" value="${e.ac ?? 12}" onchange="Editor.updateEnemy('${eid}','ac',parseInt(this.value,10))"></div>
          <div class="form-group"><label>Атака</label><input type="number" value="${e.atkBonus ?? 2}" onchange="Editor.updateEnemy('${eid}','atkBonus',parseInt(this.value,10))"></div>
          <div class="form-group"><label>Урон</label><input value="${this.escapeAttr(e.dmgRoll || '1d6')}" onchange="Editor.updateEnemy('${eid}','dmgRoll',this.value)"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
          <div class="form-group"><label>Бонус урона</label><input type="number" value="${e.dmgBonus ?? 0}" onchange="Editor.updateEnemy('${eid}','dmgBonus',parseInt(this.value,10)||0)"></div>
          <div class="form-group"><label>Ловкость</label><input type="number" value="${e.dex ?? 2}" onchange="Editor.updateEnemy('${eid}','dex',parseInt(this.value,10))"></div>
          <div class="form-group"><label>Опыт</label><input type="number" value="${e.exp ?? ''}" placeholder="20" onchange="Editor.updateEnemy('${eid}','exp',parseInt(this.value,10)||0)"></div>
        </div>
        ${typeof this.renderEnemyLootSection === 'function' ? this.renderEnemyLootSection(id, e) : ''}
      </div>`;
    },

    renderEnemies() {
      const c = document.getElementById('enemies-editor');
      if (!c) return;
      if (!this.data) {
        c.innerHTML = '<div class="empty-state"><h2>Нет данных</h2></div>';
        return;
      }
      this.ensureEnemies();
      if (typeof this.ensureEnemyScaling === 'function') this.ensureEnemyScaling();
      const ids = this.getEnemyIds();
      if (!this.editingEnemyId || !this.data.enemies[this.editingEnemyId]) {
        this.editingEnemyId = ids[0] || null;
      }
      c.innerHTML = this.renderEditorListLayout({
        title: 'Враги',
        icon: '⚔️',
        ids,
        getLabel: (id) => {
          const e = this.data.enemies[id];
          const boss = e?.boss ? ' ☠' : '';
          return (e?.name || id) + boss;
        },
        activeId: this.editingEnemyId,
        onSelectMethod: 'Editor.selectEnemyToEdit',
        onAddMethod: 'Editor.createEnemy',
        addLabel: 'Добавить врага',
        detailHtml: this.editingEnemyId ? this.renderEnemyDetail(this.editingEnemyId) : '',
        emptyHint: 'Добавьте первого врага для боевых сцен.'
      });
    },

    // ——— NPC ———
    ensureNpcs() {
      if (!this.data) return;
      if (!this.data.npcs || typeof this.data.npcs !== 'object') {
        this.data.npcs = {};
      }
    },

    getNpcIds() {
      this.ensureNpcs();
      return Object.keys(this.data.npcs).sort();
    },

    selectNpcToEdit(id) {
      this.editingNpcId = id;
      this.renderNPCs();
    },

    renderNpcDetail(id) {
      const n = this.data?.npcs?.[id];
      if (!n) return '<div class="empty-state"><h2>NPC не найден</h2></div>';
      const nid = this.escapeAttr(id);
      return `<div class="quest-detail-card npc-editor">
        <div class="quest-detail-head">
          <h3>${this.escapeHtml(n.name || 'Без имени')}</h3>
          <button type="button" class="btn btn-danger" onclick="Editor.deleteNPC('${nid}')">🗑 Удалить</button>
        </div>
        <div class="form-group"><label>ID</label><input value="${this.escapeHtml(id)}" disabled></div>
        <div class="form-group"><label>Имя</label>
          <input value="${this.escapeAttr(n.name || '')}" onchange="Editor.updateNPC('${nid}','name',this.value)"></div>
        <div class="form-group"><label>Иконка</label>
          <div class="icon-picker-row">${this.renderIconEmojiSelect('if(this.value){Editor.updateNPC(' + JSON.stringify(id) + ',"icon",this.value);}')}
            <input type="text" value="${this.escapeHtml(n.icon || '👤')}" onchange="Editor.updateNPC('${nid}','icon',this.value)">${this.renderIconPreview(n.icon)}</div>
          <div class="icon-suggestions">${this.renderIconSuggestionButtons(icon => 'Editor.updateNPC(' + JSON.stringify(id) + ',"icon",' + JSON.stringify(icon) + ')')}</div>
          <div class="icon-hint">Emoji, панель ниже или путь к PNG/SVG.</div>
        </div>
        <div class="form-group"><label>Описание</label>
          <textarea onchange="Editor.updateNPC('${nid}','description',this.value)">${this.escapeHtml(n.description || '')}</textarea></div>
        <div class="form-group"><label>Локация</label>
          <input value="${this.escapeAttr(n.location || '')}" onchange="Editor.updateNPC('${nid}','location',this.value)"></div>
        <div class="form-group"><label>Отношение</label>
          <select onchange="Editor.updateNPC('${nid}','attitude',this.value)">
            <option value="neutral" ${n.attitude === 'neutral' ? 'selected' : ''}>Нейтральное</option>
            <option value="friendly" ${n.attitude === 'friendly' ? 'selected' : ''}>Дружелюбное</option>
            <option value="hostile" ${n.attitude === 'hostile' ? 'selected' : ''}>Враждебное</option>
          </select></div>
      </div>`;
    },

    renderNPCs() {
      const c = document.getElementById('npcs-editor');
      if (!c) return;
      if (!this.data) {
        c.innerHTML = '<div class="empty-state"><h2>Нет данных</h2></div>';
        return;
      }
      this.ensureNpcs();
      const ids = this.getNpcIds();
      if (!this.editingNpcId || !this.data.npcs[this.editingNpcId]) {
        this.editingNpcId = ids[0] || null;
      }
      c.innerHTML = this.renderEditorListLayout({
        title: 'NPC',
        icon: '👤',
        ids,
        getLabel: (id) => this.data.npcs[id]?.name || id,
        activeId: this.editingNpcId,
        onSelectMethod: 'Editor.selectNpcToEdit',
        onAddMethod: 'Editor.createNPC',
        addLabel: 'Добавить NPC',
        detailHtml: this.editingNpcId ? this.renderNpcDetail(this.editingNpcId) : '',
        emptyHint: 'Справочник персонажей для диалогов и сюжета.'
      });
    },

    // ——— Глобальные умения (progression.abilities) ———
    ensureProgressionAbilities() {
      if (!this.data) return;
      if (!this.data.progression) {
        this.data.progression = {
          enabled: true, maxLevel: 5, expTable: [0, 100, 220, 380, 600],
          defaultHpGain: '1d8', defaults: { enemyExp: 20, skillCheckExp: 12 },
          skillExp: {}, abilities: {}
        };
      }
      if (!this.data.progression.abilities) this.data.progression.abilities = {};
    },

    getGlobalAbilityIds() {
      this.ensureProgressionAbilities();
      return Object.keys(this.data.progression.abilities).sort();
    },

    selectGlobalAbilityToEdit(id) {
      this.editingGlobalAbilityId = id;
      this.renderAbilities();
    },

    renderAbilities() {
      const c = document.getElementById('abilities-editor');
      if (!c) return;
      if (!this.data) {
        c.innerHTML = '<div class="empty-state"><h2>Нет данных</h2></div>';
        return;
      }
      this.ensureProgressionAbilities();
      const pool = this.data.progression.abilities;
      const ids = this.getGlobalAbilityIds();
      if (!this.editingGlobalAbilityId || !pool[this.editingGlobalAbilityId]) {
        this.editingGlobalAbilityId = ids[0] || null;
      }
      const detail = this.editingGlobalAbilityId
        ? (typeof this.renderGlobalAbilityEditor === 'function'
          ? this.renderGlobalAbilityEditor(
            this.editingGlobalAbilityId,
            pool[this.editingGlobalAbilityId],
            ids.indexOf(this.editingGlobalAbilityId)
          )
          : '')
        : '';
      c.innerHTML = this.renderEditorListLayout({
        title: 'Умения',
        icon: '⚡',
        ids,
        getLabel: (id) => pool[id]?.name || id,
        activeId: this.editingGlobalAbilityId,
        onSelectMethod: 'Editor.selectGlobalAbilityToEdit',
        onAddMethod: 'Editor.addGlobalAbility',
        addLabel: 'Добавить умение',
        detailHtml: detail,
        emptyHint: 'Пул умений для прогрессии и классов.'
      });
    }
  });

  // Переопределение create/delete/update для синхронизации списка
  const origUpdateEnemy = Editor.updateEnemy;
  Editor.updateEnemy = function (id, f, val) {
    origUpdateEnemy.call(this, id, f, val);
    if (f === 'name' || f === 'boss') this.renderEnemies();
  };

  Editor.createEnemy = function () {
    const id = prompt('ID врага:');
    if (!id) return;
    this.ensureEnemies();
    if (this.data.enemies[id]) {
      alert('Враг с таким ID уже есть');
      return;
    }
    this.data.enemies[id] = {
      id, name: 'Новый враг', hp: 10, maxHp: 10, ac: 12,
      atkBonus: 2, dmgRoll: '1d6', dmgBonus: 0, dex: 2
    };
    this.editingEnemyId = id;
    this.renderEnemies();
    this.updateJSONPreview();
  };

  Editor.deleteEnemy = function (id) {
    if (!confirm('Удалить врага?')) return;
    delete this.data.enemies[id];
    const ids = this.getEnemyIds();
    this.editingEnemyId = ids[0] || null;
    this.renderEnemies();
    this.updateJSONPreview();
  };

  Editor.updateNPC = function (id, f, val) {
    if (!this.data.npcs?.[id]) return;
    this.data.npcs[id][f] = val;
    this.updateJSONPreview();
    if (f === 'name' || f === 'icon' || f === 'attitude') this.renderNPCs();
  };

  Editor.createNPC = function () {
    const id = prompt('ID NPC:');
    if (!id) return;
    this.ensureNpcs();
    if (this.data.npcs[id]) return;
    this.data.npcs[id] = {
      id, name: 'Новый NPC', location: '', icon: '👤', description: '',
      dialogues: { default: [] }, quests: [], shop: false, attitude: 'neutral'
    };
    this.editingNpcId = id;
    this.renderNPCs();
    this.updateJSONPreview();
  };

  Editor.deleteNPC = function (id) {
    if (!confirm('Удалить NPC?')) return;
    delete this.data.npcs[id];
    const ids = this.getNpcIds();
    this.editingNpcId = ids[0] || null;
    this.renderNPCs();
    this.updateJSONPreview();
  };

  Editor.addGlobalAbility = function () {
    this.ensureProgressionAbilities();
    const idx = Object.keys(this.data.progression.abilities).length + 1;
    const id = 'ability_' + idx;
    this.data.progression.abilities[id] = {
      id, name: 'Новое умение', icon: '✨', cost: 1, usage: 'both', type: 'active',
      desc: 'Описание...',
      effect: { type: 'damage', value: '1d6', damageType: 'physical', targeting: { scope: 'single', range: 'self' } }
    };
    this.editingGlobalAbilityId = id;
    this.renderAbilities();
    this.updateJSONPreview();
  };

  Editor.deleteGlobalAbility = function (id) {
    if (!confirm('Удалить умение?')) return;
    if (!this.data.progression?.abilities) return;
    delete this.data.progression.abilities[id];
    const ids = this.getGlobalAbilityIds();
    this.editingGlobalAbilityId = ids[0] || null;
    this.renderAbilities();
    this.updateJSONPreview();
  };
})();
