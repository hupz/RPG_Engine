// Редактор ингредиентов крафта (data.ingredients)

(function attachEditorIngredients() {
  if (typeof Editor === 'undefined') {
    console.error('editor-ingredients.js: Editor не определён');
    return;
  }

  const INGREDIENT_ICONS = [
    '🌿', '🍄', '🪵', '🪨', '⚙️', '💎', '🧪', '🩸', '🦴', '🪶', '🌾', '🍖', '🧀', '🍞',
    '💧', '⛏️', '🟫', '🍃', '🔩', '🪢'
  ];

  const RARITIES = {
    common: 'Обычный',
    uncommon: 'Необычный',
    rare: 'Редкий',
    very_rare: 'Очень редкий',
    legendary: 'Легендарный'
  };

  const GATHER_LOCATIONS = [
    'forest', 'meadow', 'swamp', 'river', 'well', 'mountain', 'cave'
  ];

  const GATHER_SKILLS = [
    'nature', 'survival', 'alchemy', 'medicine'
  ];

  const DEFAULT_INGREDIENT_IDS = [
    'herb_red', 'herb_green', 'crystal_water', 'iron_ore', 'wood_log', 'leather_scrap'
  ];

  Object.assign(Editor, {
    editingIngredientId: null,
    ingredientFilterRarity: '',
    ingredientFilterTag: '',
    ingredientFilterSource: '',
    lootItemFilter: 'all',

    shopItemFilter: 'all',

    ensureCraftingData() {
      if (!this.data) return;
      if (!this.data.ingredients || typeof this.data.ingredients !== 'object') {
        this.data.ingredients = {};
      }
      if (!this.data.recipes || typeof this.data.recipes !== 'object') {
        this.data.recipes = {};
      }
      this.migrateIngredientsFromItems();
    },

    migrateIngredientsFromItems() {
      if (!this.data?.items) return;
      const ing = this.data.ingredients;
      DEFAULT_INGREDIENT_IDS.forEach((id) => {
        if (ing[id]) return;
        const it = this.data.items[id];
        if (!it) return;
        ing[id] = {
          id,
          name: it.name || id,
          icon: it.icon || '🌿',
          description: it.desc || it.description || '',
          rarity: it.rarity || 'common',
          value: it.price ?? it.value ?? 1,
          sources: {
            loot: true,
            merchant: true,
            gatherable: false,
            gatherLocations: [],
            gatherSkill: 'nature',
            gatherDc: 12
          },
          tags: it.type === 'ingredient' ? ['crafting'] : ['misc']
        };
      });
    },

    getIngredientIds() {
      this.ensureCraftingData();
      return Object.keys(this.data.ingredients).sort((a, b) => {
        const na = this.data.ingredients[a]?.name || a;
        const nb = this.data.ingredients[b]?.name || b;
        return na.localeCompare(nb, 'ru');
      });
    },

    getIngredientLabel(id) {
      const ing = this.data?.ingredients?.[id];
      if (!ing) return id;
      return `${ing.icon || '🌿'} ${ing.name || id}`;
    },

    slugifyCraftId(name, existingIds) {
      let base = String(name || 'item')
        .toLowerCase()
        .replace(/[^a-z0-9\u0400-\u04ff]+/gi, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_');
      if (!base || !/^[a-z]/.test(base)) base = 'ingredient_' + base.replace(/^[^a-z]+/, '');
      if (!base) base = 'ingredient';
      let id = base;
      let n = 1;
      while (existingIds[id]) {
        id = `${base}_${n++}`;
      }
      return id;
    },

    syncIngredientToItem(ing) {
      if (!ing?.id || !this.data) return;
      if (!this.data.items) this.data.items = {};
      const cur = this.data.items[ing.id] || {};
      this.data.items[ing.id] = {
        ...cur,
        id: ing.id,
        name: ing.name || ing.id,
        type: 'ingredient',
        icon: ing.icon || '🌿',
        desc: ing.description || cur.desc || '',
        stackable: cur.stackable !== false,
        price: ing.value ?? cur.price ?? 0,
        rarity: ing.rarity || cur.rarity || 'common',
        cursed: cur.cursed === true
      };
    },

    isIngredientUsedInRecipes(ingredientId) {
      this.ensureCraftingData();
      return Object.values(this.data.recipes).some((r) =>
        (r.ingredients || []).some((row) => {
          const rid = row.id || row.ingredientId || row.itemId;
          return rid === ingredientId;
        })
      );
    },

    getIngredientTagOptions() {
      const tags = new Set();
      Object.values(this.data?.ingredients || {}).forEach((ing) => {
        (ing.tags || []).forEach((t) => tags.add(t));
      });
      return [...tags].sort();
    },

    filterIngredientIds(ids) {
      const rarity = this.ingredientFilterRarity;
      const tag = this.ingredientFilterTag;
      const source = this.ingredientFilterSource;
      return ids.filter((id) => {
        const ing = this.data.ingredients[id];
        if (!ing) return false;
        if (rarity && ing.rarity !== rarity) return false;
        if (tag && !(ing.tags || []).includes(tag)) return false;
        if (source) {
          const src = ing.sources || {};
          if (source === 'loot' && !src.loot) return false;
          if (source === 'merchant' && !src.merchant) return false;
          if (source === 'gatherable' && !src.gatherable) return false;
        }
        return true;
      });
    },

    selectIngredientToEdit(id) {
      this.editingIngredientId = id;
      this.renderIngredients();
    },

    setIngredientFilter(field, value) {
      this[`ingredientFilter${field.charAt(0).toUpperCase()}${field.slice(1)}`] = value;
      this.renderIngredients();
    },

    createIngredient() {
      this.ensureCraftingData();
      const name = prompt('Название ингредиента:', 'Новый ингредиент');
      if (!name?.trim()) return;
      const id = this.slugifyCraftId(name.trim(), this.data.ingredients);
      this.data.ingredients[id] = {
        id,
        name: name.trim(),
        icon: '🌿',
        description: '',
        rarity: 'common',
        value: 1,
        sources: {
          loot: false,
          merchant: true,
          gatherable: false,
          gatherLocations: [],
          gatherSkill: 'nature',
          gatherDc: 12
        },
        tags: []
      };
      this.syncIngredientToItem(this.data.ingredients[id]);
      this.editingIngredientId = id;
      this.renderIngredients();
      this.updateJSONPreview();
    },

    saveIngredient(id) {
      const ing = this.data?.ingredients?.[id];
      if (!ing) return;
      if (!ing.name?.trim()) {
        alert('Укажите название ингредиента.');
        return;
      }
      ing.name = ing.name.trim();
      this.syncIngredientToItem(ing);
      this.updateJSONPreview();
      alert('✅ Ингредиент сохранён');
      this.renderIngredients();
    },

    deleteIngredient(id) {
      if (!this.data?.ingredients?.[id]) return;
      if (this.isIngredientUsedInRecipes(id)) {
        alert('Нельзя удалить: ингредиент используется в рецептах.');
        return;
      }
      if (!confirm(`Удалить ингредиент «${this.data.ingredients[id].name || id}»?`)) return;
      delete this.data.ingredients[id];
      const ids = this.getIngredientIds();
      this.editingIngredientId = ids[0] || null;
      this.renderIngredients();
      this.updateJSONPreview();
    },

    updateIngredientField(id, field, value) {
      const ing = this.data?.ingredients?.[id];
      if (!ing) return;
      if (field.includes('.')) {
        const [root, sub] = field.split('.');
        if (!ing[root]) ing[root] = {};
        ing[root][sub] = value;
      } else {
        ing[field] = value;
      }
      this.updateJSONPreview();
    },

    toggleIngredientSource(id, key, checked) {
      const ing = this.data?.ingredients?.[id];
      if (!ing) return;
      if (!ing.sources) ing.sources = {};
      ing.sources[key] = checked;
      this.updateJSONPreview();
    },

    toggleIngredientGatherLocation(id, loc, checked) {
      const ing = this.data?.ingredients?.[id];
      if (!ing) return;
      if (!ing.sources) ing.sources = {};
      if (!Array.isArray(ing.sources.gatherLocations)) ing.sources.gatherLocations = [];
      const arr = ing.sources.gatherLocations;
      const idx = arr.indexOf(loc);
      if (checked && idx === -1) arr.push(loc);
      else if (!checked && idx !== -1) arr.splice(idx, 1);
      this.updateJSONPreview();
    },

    updateIngredientTags(id, raw) {
      const ing = this.data?.ingredients?.[id];
      if (!ing) return;
      ing.tags = raw.split(',').map((t) => t.trim()).filter(Boolean);
      this.updateJSONPreview();
    },

    exportIngredientsJson() {
      this.ensureCraftingData();
      const blob = new Blob([JSON.stringify(this.data.ingredients, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ingredients.json';
      a.click();
      URL.revokeObjectURL(url);
    },

    importIngredientsJson() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const parsed = JSON.parse(await file.text());
          if (!parsed || typeof parsed !== 'object') throw new Error('Ожидается объект');
          this.ensureCraftingData();
          Object.assign(this.data.ingredients, parsed);
          Object.values(this.data.ingredients).forEach((ing) => this.syncIngredientToItem(ing));
          this.editingIngredientId = Object.keys(parsed)[0] || this.editingIngredientId;
          this.renderIngredients();
          this.updateJSONPreview();
          alert('✅ Ингредиенты импортированы');
        } catch (err) {
          alert('❌ ' + err.message);
        }
      };
      input.click();
    },

    renderIngredientFilters() {
      const tagOpts = ['', ...this.getIngredientTagOptions()].map((t) =>
        `<option value="${this.escapeAttr(t)}" ${this.ingredientFilterTag === t ? 'selected' : ''}>${t ? this.escapeHtml(t) : '— все теги —'}</option>`
      ).join('');
      const rarityOpts = ['', ...Object.keys(RARITIES)].map((r) =>
        `<option value="${r}" ${this.ingredientFilterRarity === r ? 'selected' : ''}>${r ? RARITIES[r] : '— все —'}</option>`
      ).join('');
      const srcOpts = [
        ['', '— все источники —'],
        ['loot', 'Лут'],
        ['merchant', 'Торговец'],
        ['gatherable', 'Сбор в мире']
      ].map(([v, lab]) =>
        `<option value="${v}" ${this.ingredientFilterSource === v ? 'selected' : ''}>${lab}</option>`
      ).join('');
      return `<div class="craft-editor-filters">
        <select onchange="Editor.setIngredientFilter('rarity', this.value)">${rarityOpts}</select>
        <select onchange="Editor.setIngredientFilter('tag', this.value)">${tagOpts}</select>
        <select onchange="Editor.setIngredientFilter('source', this.value)">${srcOpts}</select>
      </div>`;
    },

    renderIngredientIconSelect(id, ing) {
      const cur = ing.icon || '🌿';
      const opts = INGREDIENT_ICONS.map((ic) =>
        `<option value="${ic}" ${cur === ic ? 'selected' : ''}>${ic}</option>`
      ).join('');
      return `<div class="form-group"><label>Иконка</label>
        <select onchange="Editor.updateIngredientField('${this.escapeAttr(id)}','icon',this.value);Editor.renderIngredients()">${opts}</select></div>`;
    },

    renderIngredientDetail(id) {
      const ing = this.data?.ingredients?.[id];
      if (!ing) return '<div class="empty-state"><h2>Ингредиент не найден</h2></div>';
      const iid = this.escapeAttr(id);
      const src = ing.sources || {};
      const locChecks = GATHER_LOCATIONS.map((loc) => {
        const on = (src.gatherLocations || []).includes(loc);
        return `<label class="craft-check"><input type="checkbox" ${on ? 'checked' : ''}
          onchange="Editor.toggleIngredientGatherLocation('${iid}','${loc}',this.checked)"> ${loc}</label>`;
      }).join('');
      const rarityOpts = Object.entries(RARITIES).map(([k, lab]) =>
        `<option value="${k}" ${ing.rarity === k ? 'selected' : ''}>${lab}</option>`
      ).join('');
      const skillOpts = GATHER_SKILLS.map((s) =>
        `<option value="${s}" ${src.gatherSkill === s ? 'selected' : ''}>${s}</option>`
      ).join('');
      const tagsStr = (ing.tags || []).join(', ');

      return `<div class="quest-detail-card craft-detail-card">
        <div class="quest-detail-head">
          <h3>${ing.icon || '🌿'} ${this.escapeHtml(ing.name || id)}</h3>
          <div class="craft-detail-actions">
            <button type="button" class="btn btn-primary" onclick="Editor.saveIngredient('${iid}')">💾 Сохранить</button>
            <button type="button" class="btn btn-danger" onclick="Editor.deleteIngredient('${iid}')">🗑️ Удалить</button>
          </div>
        </div>
        <div class="form-group"><label>ID</label><input value="${this.escapeHtml(id)}" disabled></div>
        <div class="form-group"><label>Название *</label>
          <input value="${this.escapeAttr(ing.name || '')}" onchange="Editor.updateIngredientField('${iid}','name',this.value)"></div>
        ${this.renderIngredientIconSelect(id, ing)}
        <div class="form-group"><label>Описание</label>
          <textarea rows="3" onchange="Editor.updateIngredientField('${iid}','description',this.value)">${this.escapeHtml(ing.description || '')}</textarea></div>
        <div class="grid-2">
          <div class="form-group"><label>Редкость</label>
            <select onchange="Editor.updateIngredientField('${iid}','rarity',this.value)">${rarityOpts}</select></div>
          <div class="form-group"><label>Стоимость 💰</label>
            <input type="number" min="0" value="${ing.value ?? 0}" onchange="Editor.updateIngredientField('${iid}','value',parseInt(this.value,10)||0)"></div>
        </div>
        <div class="form-group"><label>Теги (через запятую)</label>
          <input value="${this.escapeAttr(tagsStr)}" onchange="Editor.updateIngredientTags('${iid}', this.value)"></div>
        <div class="project-info">
          <h4>Источники</h4>
          <label class="craft-check"><input type="checkbox" ${src.loot ? 'checked' : ''}
            onchange="Editor.toggleIngredientSource('${iid}','loot',this.checked)"> Лут с врагов</label>
          <label class="craft-check"><input type="checkbox" ${src.merchant ? 'checked' : ''}
            onchange="Editor.toggleIngredientSource('${iid}','merchant',this.checked)"> Торговец</label>
          <label class="craft-check"><input type="checkbox" ${src.gatherable ? 'checked' : ''}
            onchange="Editor.toggleIngredientSource('${iid}','gatherable',this.checked)"> Сбор в мире</label>
          <div class="grid-2" style="margin-top:10px;">
            <div class="form-group"><label>Навык сбора</label>
              <select onchange="Editor.updateIngredientField('${iid}','sources.gatherSkill',this.value)">${skillOpts}</select></div>
            <div class="form-group"><label>DC сбора</label>
              <input type="number" min="1" max="30" value="${src.gatherDc ?? 12}"
                onchange="Editor.updateIngredientField('${iid}','sources.gatherDc',parseInt(this.value,10)||12)"></div>
          </div>
          <div class="form-group"><label>Локации сбора</label>
            <div class="craft-check-grid">${locChecks}</div></div>
        </div>
      </div>`;
    },

    renderIngredients() {
      const c = document.getElementById('ingredients-editor');
      if (!c) return;
      if (!this.data) {
        c.innerHTML = '<div class="empty-state"><h2>Загрузите данные</h2></div>';
        return;
      }
      this.ensureCraftingData();
      const allIds = this.getIngredientIds();
      const ids = this.filterIngredientIds(allIds);
      if (!this.editingIngredientId || !this.data.ingredients[this.editingIngredientId]) {
        this.editingIngredientId = ids[0] || allIds[0] || null;
      }
      const head = `<div class="craft-editor-toolbar">
        <span class="craft-editor-title">🧪 Ингредиенты</span>
        <div class="craft-editor-toolbar-actions">
          <button type="button" class="btn btn-secondary" onclick="Editor.exportIngredientsJson()">📤 Экспорт</button>
          <button type="button" class="btn btn-secondary" onclick="Editor.importIngredientsJson()">📥 Импорт</button>
          <button type="button" class="btn btn-primary" onclick="Editor.createIngredient()">+ Создать</button>
        </div>
      </div>${this.renderIngredientFilters()}`;

      const sidebar = ids.map((id) => {
        const ing = this.data.ingredients[id];
        const active = id === this.editingIngredientId ? ' active' : '';
        return `<button type="button" class="quest-pick${active}" onclick="Editor.selectIngredientToEdit('${this.escapeAttr(id)}')">${ing.icon || '🌿'} ${this.escapeHtml(ing.name || id)}</button>`;
      }).join('');

      const detail = this.editingIngredientId ? this.renderIngredientDetail(this.editingIngredientId) : '';
      if (!allIds.length) {
        c.innerHTML = `${head}<div class="quest-manager">
          <div class="quest-manager-sidebar"><p class="hint">Создайте первый ингредиент для крафта.</p>
            <button type="button" class="btn btn-primary" style="width:100%;" onclick="Editor.createIngredient()">+ Создать</button></div>
          <div class="quest-manager-detail"><div class="empty-state"><h2>Пусто</h2></div></div></div>`;
        return;
      }
      c.innerHTML = `${head}<div class="quest-manager craft-editor-wrap">
        <div class="quest-manager-sidebar">${sidebar || '<p class="hint">Нет по фильтру</p>'}</div>
        <div class="quest-manager-detail">${detail}</div>
      </div>`;
    },

    /** Лут врагов / магазин: фильтр предметов */
    getLootItemFilterOptions() {
      return [
        ['all', 'Все'],
        ['gear', 'Снаряжение'],
        ['consumable', 'Расходники'],
        ['ingredient', 'Ингредиенты']
      ];
    },

    setLootItemFilter(value) {
      this.lootItemFilter = value || 'all';
      this.renderEnemies();
    },

    itemMatchesLootFilter(iid, it, filter) {
      if (!filter || filter === 'all') return true;
      const ingIds = new Set(Object.keys(this.data?.ingredients || {}));
      const type = (it?.type || '').toLowerCase();
      if (filter === 'ingredient') {
        return type === 'ingredient' || ingIds.has(iid);
      }
      if (filter === 'consumable') {
        return type === 'consumable' || type === 'potion' || type === 'food';
      }
      if (filter === 'gear') {
        return ['weapon', 'armor', 'accessory', 'shield', 'ammo', 'ammunition'].includes(type);
      }
      return true;
    },

    renderLootItemSelect(enemyId, entry, idx) {
      this.ensureCraftingData();
      const items = this.data?.items || {};
      const cur = entry.item || '';
      const filter = this.lootItemFilter || 'all';
      const filterBar = this.getLootItemFilterOptions().map(([v, lab]) =>
        `<option value="${v}" ${filter === v ? 'selected' : ''}>${lab}</option>`
      ).join('');
      let opts = '<option value="">— предмет —</option><option value="gold"' + (cur === 'gold' ? ' selected' : '') + '>gold (золото)</option>';
      Object.keys(items).sort().forEach((iid) => {
        if (!this.itemMatchesLootFilter(iid, items[iid], filter)) return;
        const name = items[iid].name || iid;
        opts += `<option value="${iid}"${cur === iid ? ' selected' : ''}>${iid} — ${name}</option>`;
      });
      return `<div class="loot-item-select-wrap">
        <select class="loot-filter-select" onchange="Editor.setLootItemFilter(this.value)">${filterBar}</select>
        <select onchange="Editor.updateEnemyLoot('${enemyId}',${idx},'item',this.value)">${opts}</select></div>`;
    },

    getShopItemIdsForFilter(filter) {
      this.ensureCraftingData();
      const items = this.data?.items || {};
      const ingIds = new Set(Object.keys(this.data.ingredients || {}));
      return Object.keys(items).filter((iid) => {
        const it = items[iid];
        if (!filter || filter === 'all') return true;
        if (filter === 'ingredients') {
          return (it.type === 'ingredient') || ingIds.has(iid);
        }
        if (filter === 'gear') {
          return ['weapon', 'armor', 'accessory', 'shield'].includes(it.type);
        }
        if (filter === 'consumable') {
          return ['consumable', 'potion', 'food'].includes(it.type);
        }
        return true;
      }).sort();
    },
  });

  const origRenderAll = Editor.renderAll?.bind(Editor);
  if (origRenderAll) {
    Editor.renderAll = function renderAllWithCrafting() {
      if (typeof this.ensureCraftingData === 'function') this.ensureCraftingData();
      return origRenderAll();
    };
  }
})();
