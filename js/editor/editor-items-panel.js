// ============================================================
// Предметы
// Вынесено из editor.html
// ============================================================
(function () {
  if (typeof Editor === 'undefined') {
    console.error('editor-items-panel.js: Editor не определён');
    return;
  }
  Object.assign(Editor, {
    renderItems() {
      const c = document.getElementById('items-editor');
      if (!this.data?.items) {
        c.innerHTML = '<div class="empty-state"><h2>Нет данных</h2></div>';
        return;
      }
      const ids = Object.keys(this.data.items).sort();
      if (!ids.length) {
        c.innerHTML = `<div class="quest-manager">
          <div class="quest-manager-sidebar"><h4>🎒 Предметы</h4><p class="hint">Создайте первый предмет.</p>
            <button class="btn btn-primary" style="width:100%;" onclick="Editor.createItem()">+ Новый предмет</button></div>
          <div class="quest-manager-detail"><div class="empty-state"><h2>Пусто</h2></div></div></div>`;
        return;
      }
      if (!this.editingItemId || !this.data.items[this.editingItemId]) {
        this.editingItemId = ids[0];
      }
      if (typeof this.renderEditorListLayout === 'function') {
        c.innerHTML = this.renderEditorListLayout({
          title: 'Предметы',
          icon: '🎒',
          ids,
          getLabel: (id) => this.data.items[id]?.name || id,
          activeId: this.editingItemId,
          onSelectMethod: 'Editor.selectItemToEdit',
          onAddMethod: 'Editor.createItem',
          addLabel: 'Новый предмет',
          detailHtml: this.renderItemDetail(this.editingItemId),
          emptyHint: 'Создайте первый предмет.'
        });
        return;
      }
      c.innerHTML = this.renderItemDetail(this.editingItemId);
    },

    selectItemToEdit(id) {
      this.editingItemId = id;
      this.renderItems();
    },

    async createItem(){
      const id = await Editor.promptDialog({ message: 'ID предмета:' });
      if (!id || this.data.items[id]) return;
      this.data.items[id] = {
        name: 'Новый предмет',
        type: 'misc',
        desc: '',
        description: '',
        icon: '',
        stackable: false,
        maxStack: 1
      };
      this.editingItemId = id;
      this.renderItems();
      this.updateJSONPreview();
    },

    async deleteItem(id) {
      if (!(await Editor.confirmDialog({ message: 'Удалить предмет?', danger: true }))) return;
      delete this.data.items[id];
      const ids = Object.keys(this.data.items);
      this.editingItemId = ids[0] || null;
      this.renderItems();
      this.updateJSONPreview();
    },

    updateItem(idx,val){ this.data.scenes[this.currentScene].items[idx]=val; this.updateJSONPreview(); },

    renderItemDetail(id) {
      const it = this.data?.items?.[id];
      if (!it) return '<div class="empty-state"><h2>Предмет не найден</h2></div>';
      const typeOpts = ['weapon', 'armor', 'shield', 'accessory', 'consumable', 'readable', 'misc', 'equipment', 'key', 'quest']
        .map(t => `<option value="${t}" ${it.type === t ? 'selected' : ''}>${t}</option>`).join('');
      let extra = '';
      if (it.type === 'weapon') {
        extra = `<div class="grid-3">
          <div class="form-group"><label>Урон</label><input value="${it.dmgRoll || it.damage || '1d6'}" onchange="Editor.updateItemData('${id}','dmgRoll',this.value)"></div>
          <div class="form-group"><label>Характеристика</label><input value="${it.stat || 'str'}" onchange="Editor.updateItemData('${id}','stat',this.value)"></div>
        </div>${this.renderItemEnhancementEditor(id, it)}${this.renderItemBonusesEditor(id, it)}`;
      } else if (it.type === 'armor' || it.type === 'shield') {
        extra = `<div class="grid-3">
          <div class="form-group"><label>КД / acBonus</label><input value="${it.ac ?? it.acBonus ?? ''}" onchange="Editor.updateItemData('${id}','ac',parseInt(this.value)||0)"></div>
        </div>${this.renderItemEnhancementEditor(id, it)}${this.renderItemBonusesEditor(id, it)}`;
      } else if (it.type === 'accessory') {
        extra = this.renderItemAccessoryFields(id, it);
      } else if (it.type === 'consumable') {
        extra = this.renderItemConsumableFields(id, it);
      }
      const descVal = it.description != null && it.description !== '' ? it.description : (it.desc || '');
      const stackable = it.stackable === true;
      const maxStack = it.maxStack != null ? it.maxStack : (stackable ? 99 : 1);
      let validationHtml = '';
      if (typeof ItemsRewardsIndex !== 'undefined' && ItemsRewardsIndex.validateItemShape) {
        const v = ItemsRewardsIndex.validateItemShape(it, id);
        if (!v.ok || (v.warnings && v.warnings.length)) {
          const msgs = (v.errors || []).concat(v.warnings || []);
          validationHtml = `<div class="project-info" style="margin:8px 0;padding:8px;border-left:3px solid ${v.ok ? '#c9a227' : '#c0392b'};">
            <strong>Item validation</strong>
            <ul style="margin:4px 0 0;padding-left:18px;">${msgs.map((m) => `<li>${this.escapeHtml(m)}</li>`).join('')}</ul>
          </div>`;
        }
      }
      const showAccessoryIcon = it.type === 'accessory';
      return `<div class="quest-detail-card">
        <div class="quest-detail-head">
          <h3>${this.escapeHtml(it.name || 'Без названия')}</h3>
          <button class="btn btn-danger" onclick="${this.escapeAttr('Editor.deleteItem(' + JSON.stringify(id) + ')')}">🗑 Удалить</button>
        </div>
        ${validationHtml}
        <div class="form-group"><label>ID</label><input value="${this.escapeHtml(id)}" disabled></div>
        <div class="form-group"><label>Name</label><input value="${this.escapeHtml(it.name || '')}" onchange="Editor.updateItemData('${id}','name',this.value)"></div>
        <div class="form-group"><label>Category</label><select onchange="Editor.updateItemData('${id}','type',this.value)">${typeOpts}</select></div>
        <div class="form-group"><label>Description</label><textarea onchange="Editor.updateItemData('${id}','description',this.value)">${this.escapeHtml(descVal)}</textarea></div>
        ${showAccessoryIcon ? '' : `<div class="form-group"><label>Icon</label><input value="${this.escapeHtml(it.icon || '')}" placeholder="emoji or asset id" onchange="Editor.updateItemData('${id}','icon',this.value)"></div>`}
        <div class="grid-2">
          <div class="form-group"><label><input type="checkbox" ${stackable ? 'checked' : ''} onchange="Editor.updateItemData('${id}','stackable',this.checked)"> Stackable</label></div>
          <div class="form-group"><label>Max stack</label>
            <input type="number" min="1" value="${this.escapeHtml(String(maxStack))}" ${stackable ? '' : 'disabled'}
              onchange="Editor.updateItemData('${id}','maxStack',parseInt(this.value,10)||1)"></div>
        </div>
        ${extra}
      </div>`;
    },

    renderItemConsumableFields(id, it) {
      if (!it.use) it.use = { effect: 'heal', formula: '1d4', target: 'self' };
      const u = it.use;
      const target = u.target || 'self';
      const effectOpts = ['heal', 'damage', 'focus_potion', 'rest_material', 'message']
        .map(e => `<option value="${e}" ${u.effect === e ? 'selected' : ''}>${e}</option>`).join('');
      const targetOpts = [
        ['self', 'Себя'],
        ['ally', 'Союзник (пока = себя)'],
        ['single_enemy', 'Один враг (только в бою)'],
        ['all_enemies', 'Все враги (только в бою)']
      ].map(([v, lab]) => `<option value="${v}" ${target === v ? 'selected' : ''}>${lab}</option>`).join('');
      return `<div class="project-info" style="margin-top:8px;">
        <h4>Использование (use)</h4>
        <div class="grid-3">
          <div class="form-group"><label>Эффект</label>
            <select onchange="Editor.updateItemUse('${id}','effect',this.value)">${effectOpts}</select>
          </div>
          <div class="form-group"><label>Цель использования</label>
            <select onchange="Editor.updateItemUse('${id}','target',this.value)">${targetOpts}</select>
          </div>
          <div class="form-group"><label>Формула / amount</label>
            <input value="${u.formula || u.amount || ''}" placeholder="2d4+2" onchange="Editor.updateItemUseFormula('${id}',this.value)">
          </div>
        </div>
        <div class="form-group"><label>Подпись кнопки</label>
          <input value="${u.label || ''}" placeholder="Выпить" onchange="Editor.updateItemUse('${id}','label',this.value)">
        </div>
      </div>`;
    },

    renderItemEnhancementEditor(id, it) {
      const max = it.enhancementMax != null ? it.enhancementMax : 3;
      const costs = Array.isArray(it.enhancementCost) ? it.enhancementCost.join(', ') : '100, 300, 900';
      const enh = it.enhancement != null ? it.enhancement : 0;
      return `<div class="project-info" style="margin-top:8px;padding:10px;">
        <h4 style="margin:0 0 8px;">⚒️ Заточка</h4>
        <div class="grid-3">
          <div class="form-group"><label>Старт. уровень (шаблон)</label>
            <input type="number" min="0" value="${enh}" onchange="Editor.updateItemData('${id}','enhancement',parseInt(this.value)||0)">
          </div>
          <div class="form-group"><label>Макс. (+N)</label>
            <input type="number" min="0" value="${max}" onchange="Editor.updateItemData('${id}','enhancementMax',parseInt(this.value)||0)">
          </div>
          <div class="form-group"><label>Цены +1,+2,+3 (через запятую)</label>
            <input value="${costs}" placeholder="100, 300, 900" onchange="Editor.updateItemEnhancementCosts('${id}',this.value)">
          </div>
        </div>
      </div>`;
    },

    renderItemAccessoryFields(id, it) {
      const slot = it.slot || 'ring';
      return `<div class="grid-3">
        <div class="form-group"><label>Слот аксессуара</label>
          <select onchange="Editor.updateItemData('${id}','slot',this.value)">
            <option value="ring" ${slot==='ring'?'selected':''}>Кольцо</option>
            <option value="necklace" ${slot==='necklace'?'selected':''}>Ожерелье</option>
            <option value="earrings" ${slot==='earrings'?'selected':''}>Серьги</option>
          </select>
        </div>
        <div class="form-group"><label>Иконка</label>
          <input value="${it.icon||''}" onchange="Editor.updateItemData('${id}','icon',this.value)">
        </div>
      </div>${this.renderItemBonusesEditor(id, it)}`;
    },

    /** Known combat/stat bonus keys used by inventory.collectEquipmentBonuses */
    getItemBonusKeyOptions() {
      return [
        { key: 'maxHpBonus', label: 'Макс. HP' },
        { key: 'acBonus', label: 'КД (AC)' },
        { key: 'atkBonus', label: 'Атака' },
        { key: 'dmgBonus', label: 'Урон' },
        { key: 'str', label: 'Сила (STR)' },
        { key: 'dex', label: 'Ловкость (DEX)' },
        { key: 'con', label: 'Телосложение (CON)' },
        { key: 'int', label: 'Интеллект (INT)' },
        { key: 'wis', label: 'Мудрость (WIS)' },
        { key: 'cha', label: 'Харизма (CHA)' }
      ];
    },

    /**
     * Editor UI for item.bonuses object { maxHpBonus, atkBonus, ... }.
     * Called from weapon/armor/accessory field renderers.
     */
    renderItemBonusesEditor(id, it) {
      if (!it || typeof it !== 'object') return '';
      const bonuses = (it.bonuses && typeof it.bonuses === 'object' && !Array.isArray(it.bonuses))
        ? it.bonuses
        : {};
      const keys = Object.keys(bonuses);
      const known = this.getItemBonusKeyOptions();
      const knownMap = Object.fromEntries(known.map((k) => [k.key, k.label]));
      const rows = keys.map((key) => {
        const val = bonuses[key];
        const label = knownMap[key] || key;
        const safeId = this.escapeAttr(id);
        const safeKey = this.escapeAttr(key);
        return `<div class="grid-3" style="align-items:end;margin-bottom:6px;">
          <div class="form-group"><label>Бонус</label>
            <input value="${this.escapeHtml(label + ' (' + key + ')')}" disabled></div>
          <div class="form-group"><label>Значение</label>
            <input type="number" value="${this.escapeHtml(String(val ?? 0))}"
              onchange="Editor.updateItemBonus('${safeId}','${safeKey}',this.value)"></div>
          <div class="form-group"><label>&nbsp;</label>
            <button type="button" class="btn btn-danger btn-sm"
              onclick="Editor.removeItemBonus('${safeId}','${safeKey}')">Удалить</button></div>
        </div>`;
      }).join('');

      const used = new Set(keys);
      const addOpts = known
        .filter((k) => !used.has(k.key))
        .map((k) => `<option value="${this.escapeAttr(k.key)}">${this.escapeHtml(k.label)}</option>`)
        .join('');
      const customOpt = '<option value="__custom__">Другой ключ…</option>';
      const safeId = this.escapeAttr(id);

      return `<div class="project-info" style="margin-top:8px;padding:10px;">
        <h4 style="margin:0 0 8px;">✨ Бонусы экипировки</h4>
        ${rows || '<p class="hint">Нет бонусов</p>'}
        <div class="grid-2" style="align-items:end;margin-top:8px;">
          <div class="form-group"><label>Добавить бонус</label>
            <select id="item-bonus-add-${safeId}">
              <option value="">— выберите —</option>
              ${addOpts}
              ${customOpt}
            </select></div>
          <div class="form-group"><label>&nbsp;</label>
            <button type="button" class="btn btn-secondary btn-sm"
              onclick="Editor.addItemBonus('${safeId}')">+ Добавить</button></div>
        </div>
      </div>`;
    },

    async addItemBonus(id) {
      const it = this.data?.items?.[id];
      if (!it) return;
      const sel = document.getElementById('item-bonus-add-' + id);
      let key = sel ? String(sel.value || '') : '';
      if (!key) return;
      if (key === '__custom__') {
        key = await Editor.promptDialog({ message: 'Ключ бонуса (например maxHpBonus, str):' });
        if (!key || !String(key).trim()) return;
        key = String(key).trim();
      }
      if (!it.bonuses || typeof it.bonuses !== 'object' || Array.isArray(it.bonuses)) {
        it.bonuses = {};
      }
      if (it.bonuses[key] == null) it.bonuses[key] = 1;
      this.renderItems();
      if (typeof this.updateJSONPreview === 'function') this.updateJSONPreview();
    },

    updateItemBonus(id, key, value) {
      const it = this.data?.items?.[id];
      if (!it) return;
      if (!it.bonuses || typeof it.bonuses !== 'object' || Array.isArray(it.bonuses)) {
        it.bonuses = {};
      }
      const n = Number(value);
      it.bonuses[key] = Number.isFinite(n) ? n : 0;
      if (typeof this.updateJSONPreview === 'function') this.updateJSONPreview();
    },

    removeItemBonus(id, key) {
      const it = this.data?.items?.[id];
      if (!it?.bonuses || typeof it.bonuses !== 'object') return;
      delete it.bonuses[key];
      if (!Object.keys(it.bonuses).length) delete it.bonuses;
      this.renderItems();
      if (typeof this.updateJSONPreview === 'function') this.updateJSONPreview();
    },

    updateItemData(id, field, value) {
      const it = this.data?.items?.[id];
      if (!it) return;
      if (field === 'type') {
        it.type = value;
        this.renderItems();
      } else if (field === 'description') {
        it.description = value;
        it.desc = value;
      } else if (field === 'desc') {
        it.desc = value;
        it.description = value;
      } else if (field === 'stackable') {
        it.stackable = !!value;
        if (!it.stackable) it.maxStack = 1;
        else if (!it.maxStack || it.maxStack < 2) it.maxStack = 99;
        this.renderItems();
      } else {
        it[field] = value;
      }
      if (typeof this.updateJSONPreview === 'function') this.updateJSONPreview();
    },

    updateItemUse(id, field, value) {
      const it = this.data?.items?.[id];
      if (!it) return;
      if (!it.use || typeof it.use !== 'object') it.use = {};
      it.use[field] = value;
      if (typeof this.updateJSONPreview === 'function') this.updateJSONPreview();
    },

    updateItemUseFormula(id, value) {
      const it = this.data?.items?.[id];
      if (!it) return;
      if (!it.use || typeof it.use !== 'object') it.use = {};
      it.use.formula = value;
      if (it.use.amount != null) delete it.use.amount;
      if (typeof this.updateJSONPreview === 'function') this.updateJSONPreview();
    },

    updateItemEnhancementCosts(id, value) {
      const it = this.data?.items?.[id];
      if (!it) return;
      const parts = String(value || '')
        .split(',')
        .map((s) => parseInt(String(s).trim(), 10))
        .filter((n) => Number.isFinite(n) && n >= 0);
      it.enhancementCost = parts.length ? parts : [100, 300, 900];
      if (typeof this.updateJSONPreview === 'function') this.updateJSONPreview();
    }
  });

  if (Editor.hooks && typeof Editor.hooks.register === 'function') {
    Editor.hooks.register('editor-items-panel', {
      renderItems: Editor.renderItems,
      renderItemBonusesEditor: Editor.renderItemBonusesEditor,
      renderItemDetail: Editor.renderItemDetail,
      selectItemToEdit: Editor.selectItemToEdit,
      createItem: Editor.createItem,
      deleteItem: Editor.deleteItem,
      updateItemData: Editor.updateItemData,
      addItemBonus: Editor.addItemBonus,
      updateItemBonus: Editor.updateItemBonus,
      removeItemBonus: Editor.removeItemBonus
    }, { force: true });
  }
})();
