// Редактор рецептов крафта (data.recipes)

(function attachEditorRecipes() {
  if (typeof Editor === 'undefined') {
    console.error('editor-recipes.js: Editor не определён');
    return;
  }

  const RECIPE_CATEGORIES = {
    potion: 'Зелье',
    weapon: 'Оружие',
    armor: 'Доспех',
    tool: 'Инструмент',
    consumable: 'Расходник',
    ammunition: 'Боеприпасы',
    trap: 'Ловушка',
    poison: 'Яд'
  };

  const CATEGORY_ITEM_TYPES = {
    potion: ['consumable', 'potion'],
    weapon: ['weapon'],
    armor: ['armor'],
    tool: ['misc', 'tool'],
    consumable: ['consumable', 'food', 'potion'],
    ammunition: ['ammo', 'ammunition'],
    trap: ['misc', 'tool'],
    poison: ['consumable', 'potion']
  };

  const CRAFTING_SKILLS = [
    'alchemy', 'smithing', 'leatherworking', 'tinkering', 'cooking', 'enchanting', 'medicine'
  ];

  const SKILL_RANKS = {
    untrained: 'Необучен',
    trained: 'Обучен',
    expert: 'Эксперт',
    master: 'Мастер',
    legendary: 'Легенда'
  };

  const CRAFTING_TIMES = {
    instant: 'Мгновенно',
    minutes: 'Минуты',
    hours: 'Часы',
    short_rest: 'Короткий отдых',
    long_rest: 'Длинный отдых',
    days: 'Дни'
  };

  const LOCATION_CONDITIONS = {
    '': '— не требуется —',
    workshop: 'Мастерская',
    forge: 'Кузня',
    alchemy_lab: 'Алхимическая лаборатория'
  };

  const MAX_RECIPE_INGREDIENTS = 4;
  const MIN_RECIPE_INGREDIENTS = 1;

  Object.assign(Editor, {
    editingRecipeId: null,
    recipeFilterCategory: '',
    recipeFilterAffordable: false,
    recipeWizardStep: 0,
    recipeTestInventory: {},

    getRecipeIds() {
      if (typeof this.ensureCraftingData === 'function') this.ensureCraftingData();
      return Object.keys(this.data?.recipes || {}).sort((a, b) => {
        const na = this.data.recipes[a]?.name || a;
        const nb = this.data.recipes[b]?.name || b;
        return na.localeCompare(nb, 'ru');
      });
    },

    normalizeRecipeIngredients(recipe) {
      if (!recipe?.ingredients) return [];
      return recipe.ingredients.map((row) => ({
        id: row.id || row.ingredientId || row.itemId || '',
        quantity: Math.max(1, parseInt(row.quantity, 10) || 1)
      }));
    },

    getRecipeIngredientId(row) {
      return row?.id || row?.ingredientId || row?.itemId || '';
    },

    ensureRecipeDefaults(recipe) {
      if (!recipe.requirements) recipe.requirements = { level: { min: 1 }, skills: [], tools: [] };
      if (!recipe.requirements.level) recipe.requirements.level = { min: 1 };
      if (!Array.isArray(recipe.requirements.skills)) recipe.requirements.skills = [];
      if (!Array.isArray(recipe.requirements.tools)) recipe.requirements.tools = [];
      if (!recipe.craftingTime) recipe.craftingTime = { type: 'instant', value: 0 };
      if (!recipe.rewards) recipe.rewards = { experience: 0 };
      if (!recipe.conditions) recipe.conditions = { location: null, weather: null, timeOfDay: null };
      if (!Array.isArray(recipe.tags)) recipe.tags = [];
      if (!recipe.result) recipe.result = { itemId: '', quantity: 1 };
      if (!Array.isArray(recipe.ingredients)) recipe.ingredients = [];
      recipe.ingredients = this.normalizeRecipeIngredients(recipe);
    },

    validateRecipe(recipe) {
      const errors = [];
      if (!recipe?.name?.trim()) errors.push('Укажите название рецепта.');
      const resultId = recipe?.result?.itemId;
      if (!resultId) errors.push('Выберите предмет-результат.');
      else if (!this.data?.items?.[resultId]) errors.push(`Предмет «${resultId}» не найден в items.`);
      const ings = this.normalizeRecipeIngredients(recipe);
      if (ings.length < MIN_RECIPE_INGREDIENTS) {
        errors.push(`Нужно минимум ${MIN_RECIPE_INGREDIENTS} ингредиента.`);
      }
      if (ings.length > MAX_RECIPE_INGREDIENTS) {
        errors.push(`Максимум ${MAX_RECIPE_INGREDIENTS} ингредиента.`);
      }
      const seen = new Set();
      ings.forEach((row, i) => {
        if (!row.id) errors.push(`Ингредиент #${i + 1}: не выбран.`);
        else if (!this.data?.ingredients?.[row.id] && !this.data?.items?.[row.id]) {
          errors.push(`Ингредиент «${row.id}» не найден.`);
        }
        if (row.id && seen.has(row.id)) errors.push(`Ингредиент «${row.id}» дублируется.`);
        if (row.id) seen.add(row.id);
      });
      return errors;
    },

    filterRecipeIds(ids) {
      const cat = this.recipeFilterCategory;
      const affordable = this.recipeFilterAffordable;
      return ids.filter((id) => {
        const r = this.data.recipes[id];
        if (cat && r.category !== cat) return false;
        if (affordable && !this.canAffordRecipeTest(r)) return false;
        return true;
      });
    },

    canAffordRecipeTest(recipe) {
      const inv = this.recipeTestInventory || {};
      for (const row of this.normalizeRecipeIngredients(recipe)) {
        const need = row.quantity;
        const have = inv[row.id] || 0;
        if (have < need) return false;
      }
      return true;
    },

    selectRecipeToEdit(id) {
      this.editingRecipeId = id;
      this.recipeWizardStep = 0;
      this.renderRecipes();
    },

    setRecipeFilter(field, value) {
      if (field === 'category') this.recipeFilterCategory = value;
      if (field === 'affordable') this.recipeFilterAffordable = !!value;
      this.renderRecipes();
    },

    createRecipe() {
      if (typeof this.ensureCraftingData === 'function') this.ensureCraftingData();
      const name = prompt('Название рецепта:', 'Новый рецепт');
      if (!name?.trim()) return;
      const id = this.slugifyCraftId(name.trim(), this.data.recipes);
      this.data.recipes[id] = {
        id,
        name: name.trim(),
        category: 'consumable',
        icon: '🔨',
        description: '',
        result: { itemId: '', quantity: 1 },
        ingredients: [{ id: '', quantity: 1 }, { id: '', quantity: 1 }],
        requirements: { level: { min: 1 }, skills: [], tools: [] },
        craftingTime: { type: 'instant', value: 0 },
        rewards: { experience: 5 },
        conditions: { location: null, weather: null, timeOfDay: null },
        tags: []
      };
      this.editingRecipeId = id;
      this.recipeWizardStep = 1;
      this.renderRecipes();
      this.updateJSONPreview();
    },

    saveRecipe(id) {
      const recipe = this.data?.recipes?.[id];
      if (!recipe) return;
      this.ensureRecipeDefaults(recipe);
      recipe.ingredients = this.normalizeRecipeIngredients(recipe);
      const errors = this.validateRecipe(recipe);
      if (errors.length) {
        alert('Ошибки:\n' + errors.join('\n'));
        return;
      }
      recipe.name = recipe.name.trim();
      this.updateJSONPreview();
      this.recipeWizardStep = 0;
      alert('✅ Рецепт сохранён');
      this.renderRecipes();
    },

    deleteRecipe(id) {
      if (!this.data?.recipes?.[id]) return;
      if (!confirm(`Удалить рецепт «${this.data.recipes[id].name || id}»?`)) return;
      delete this.data.recipes[id];
      const ids = this.getRecipeIds();
      this.editingRecipeId = ids[0] || null;
      this.renderRecipes();
      this.updateJSONPreview();
    },

    updateRecipeField(id, field, value) {
      const recipe = this.data?.recipes?.[id];
      if (!recipe) return;
      if (field.startsWith('result.')) {
        if (!recipe.result) recipe.result = {};
        recipe.result[field.slice(7)] = value;
      } else if (field.startsWith('craftingTime.')) {
        if (!recipe.craftingTime) recipe.craftingTime = {};
        recipe.craftingTime[field.slice(13)] = value;
      } else if (field.startsWith('rewards.')) {
        if (!recipe.rewards) recipe.rewards = {};
        recipe.rewards[field.slice(8)] = value;
      } else if (field.startsWith('requirements.level.')) {
        if (!recipe.requirements) recipe.requirements = {};
        if (!recipe.requirements.level) recipe.requirements.level = {};
        recipe.requirements.level[field.slice(19)] = value;
      } else if (field.startsWith('conditions.')) {
        if (!recipe.conditions) recipe.conditions = {};
        recipe.conditions[field.slice(11)] = value || null;
      } else {
        recipe[field] = value;
      }
      this.updateJSONPreview();
    },

    updateRecipeIngredient(id, idx, field, value) {
      const recipe = this.data?.recipes?.[id];
      if (!recipe?.ingredients?.[idx]) return;
      this.ensureRecipeDefaults(recipe);
      if (field === 'quantity') {
        recipe.ingredients[idx].quantity = Math.max(1, parseInt(value, 10) || 1);
      } else {
        recipe.ingredients[idx].id = value;
        delete recipe.ingredients[idx].ingredientId;
        delete recipe.ingredients[idx].itemId;
      }
      this.updateJSONPreview();
      this.renderRecipes();
    },

    addRecipeIngredient(id) {
      const recipe = this.data?.recipes?.[id];
      if (!recipe) return;
      this.ensureRecipeDefaults(recipe);
      if (recipe.ingredients.length >= MAX_RECIPE_INGREDIENTS) {
        alert(`Максимум ${MAX_RECIPE_INGREDIENTS} ингредиента.`);
        return;
      }
      recipe.ingredients.push({ id: '', quantity: 1 });
      this.updateJSONPreview();
      this.renderRecipes();
    },

    removeRecipeIngredient(id, idx) {
      const recipe = this.data?.recipes?.[id];
      if (!recipe?.ingredients) return;
      recipe.ingredients.splice(idx, 1);
      this.updateJSONPreview();
      this.renderRecipes();
    },

    toggleRecipeRequirementSkill(id, enabled) {
      const recipe = this.data?.recipes?.[id];
      if (!recipe) return;
      this.ensureRecipeDefaults(recipe);
      if (enabled) {
        if (!recipe.requirements.skills.length) {
          recipe.requirements.skills.push({ skillId: 'alchemy', rank: 'untrained' });
        }
      } else {
        recipe.requirements.skills = [];
      }
      this.updateJSONPreview();
      this.renderRecipes();
    },

    updateRecipeSkill(id, field, value) {
      const recipe = this.data?.recipes?.[id];
      if (!recipe) return;
      this.ensureRecipeDefaults(recipe);
      if (!recipe.requirements.skills[0]) {
        recipe.requirements.skills[0] = { skillId: 'alchemy', rank: 'untrained' };
      }
      recipe.requirements.skills[0][field] = value;
      this.updateJSONPreview();
    },

    toggleRecipeRequirementTool(id, enabled) {
      const recipe = this.data?.recipes?.[id];
      if (!recipe) return;
      this.ensureRecipeDefaults(recipe);
      if (enabled) {
        if (!recipe.requirements.tools.length) {
          recipe.requirements.tools.push({ itemId: '', consumed: false });
        }
      } else {
        recipe.requirements.tools = [];
      }
      this.updateJSONPreview();
      this.renderRecipes();
    },

    updateRecipeTool(id, field, value) {
      const recipe = this.data?.recipes?.[id];
      if (!recipe) return;
      this.ensureRecipeDefaults(recipe);
      if (!recipe.requirements.tools[0]) {
        recipe.requirements.tools[0] = { itemId: '', consumed: false };
      }
      recipe.requirements.tools[0][field] = value;
      this.updateJSONPreview();
    },

    toggleRecipeLevelReq(id, enabled) {
      const recipe = this.data?.recipes?.[id];
      if (!recipe) return;
      this.ensureRecipeDefaults(recipe);
      if (enabled) {
        if (!recipe.requirements.level.min) recipe.requirements.level.min = 1;
      } else {
        recipe.requirements.level = { min: null };
      }
      this.updateJSONPreview();
      this.renderRecipes();
    },

    updateRecipeTags(id, raw) {
      const recipe = this.data?.recipes?.[id];
      if (!recipe) return;
      recipe.tags = raw.split(',').map((t) => t.trim()).filter(Boolean);
      this.updateJSONPreview();
    },

    exportRecipesJson() {
      if (typeof this.ensureCraftingData === 'function') this.ensureCraftingData();
      const blob = new Blob([JSON.stringify(this.data.recipes, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'recipes.json';
      a.click();
      URL.revokeObjectURL(url);
    },

    importRecipesJson() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const parsed = JSON.parse(await file.text());
          if (!parsed || typeof parsed !== 'object') throw new Error('Ожидается объект');
          if (typeof this.ensureCraftingData === 'function') this.ensureCraftingData();
          Object.assign(this.data.recipes, parsed);
          this.editingRecipeId = Object.keys(parsed)[0] || this.editingRecipeId;
          this.renderRecipes();
          this.updateJSONPreview();
          alert('✅ Рецепты импортированы');
        } catch (err) {
          alert('❌ ' + err.message);
        }
      };
      input.click();
    },

    goToItemsTabForRecipe(id) {
      const recipe = this.data?.recipes?.[id];
      if (!recipe) return;
      this.switchTab('items');
      alert('Создайте предмет с ID, который выберете в рецепте «' + (recipe.name || id) + '».');
    },

    testRecipe(id) {
      const recipe = this.data?.recipes?.[id];
      if (!recipe) return;
      this.ensureRecipeDefaults(recipe);
      const errors = this.validateRecipe(recipe);
      if (errors.length) {
        alert('Нельзя протестировать:\n' + errors.join('\n'));
        return;
      }
      const logs = [];
      const inv = {};
      const ings = this.normalizeRecipeIngredients(recipe);
      ings.forEach((row) => {
        inv[row.id] = (inv[row.id] || 0) + row.quantity;
      });
      logs.push('📦 Тестовый инвентарь создан.');
      ings.forEach((row) => {
        const label = typeof this.getIngredientLabel === 'function'
          ? this.getIngredientLabel(row.id)
          : row.id;
        logs.push(`  − ${label} ×${row.quantity}`);
        inv[row.id] = (inv[row.id] || 0) - row.quantity;
      });
      const resultId = recipe.result.itemId;
      const qty = recipe.result.quantity || 1;
      const resultItem = this.data.items[resultId];
      logs.push(`✅ Крафт успешен: ${resultItem?.icon || ''} ${resultItem?.name || resultId} ×${qty}`);
      if (recipe.rewards?.experience) logs.push(`⭐ Опыт: +${recipe.rewards.experience} XP`);
      const time = recipe.craftingTime;
      if (time?.type && time.type !== 'instant') {
        logs.push(`⏱ Время: ${CRAFTING_TIMES[time.type] || time.type}${time.value ? ` (${time.value})` : ''}`);
      }
      this.recipeTestInventory = {};
      ings.forEach((row) => {
        this.recipeTestInventory[row.id] = row.quantity * 2;
      });
      alert(logs.join('\n'));
    },

    renderRecipeFilters() {
      const catOpts = ['', ...Object.keys(RECIPE_CATEGORIES)].map((c) =>
        `<option value="${c}" ${this.recipeFilterCategory === c ? 'selected' : ''}>${c ? RECIPE_CATEGORIES[c] : '— все категории —'}</option>`
      ).join('');
      return `<div class="craft-editor-filters">
        <select onchange="Editor.setRecipeFilter('category', this.value)">${catOpts}</select>
        <label class="craft-check"><input type="checkbox" ${this.recipeFilterAffordable ? 'checked' : ''}
          onchange="Editor.setRecipeFilter('affordable', this.checked)"> Доступны в тест. инвентаре</label>
      </div>`;
    },

    renderRecipeResultSelect(id, recipe) {
      const cat = recipe.category || 'consumable';
      const allowed = CATEGORY_ITEM_TYPES[cat] || null;
      const items = this.data?.items || {};
      const cur = recipe.result?.itemId || '';
      let opts = '<option value="">— выберите предмет —</option>';
      Object.keys(items).sort().forEach((iid) => {
        const it = items[iid];
        if (allowed && !allowed.includes(it.type)) return;
        opts += `<option value="${iid}" ${cur === iid ? 'selected' : ''}>${it.icon || ''} ${this.escapeHtml(it.name || iid)}</option>`;
      });
      const preview = cur && items[cur]
        ? `<div class="craft-result-preview">${items[cur].icon || ''} <strong>${this.escapeHtml(items[cur].name || cur)}</strong>
            <div class="hint">${this.escapeHtml(items[cur].desc || items[cur].description || '')}</div></div>`
        : `<button type="button" class="btn btn-secondary" onclick="Editor.goToItemsTabForRecipe('${this.escapeAttr(id)}')">Создать предмет во вкладке Items</button>`;
      return `<div class="form-group"><label>Результат</label>
        <select onchange="Editor.updateRecipeField('${this.escapeAttr(id)}','result.itemId',this.value);Editor.renderRecipes()">${opts}</select>
        ${preview}
        <div class="form-group" style="margin-top:8px;"><label>Количество</label>
          <input type="number" min="1" value="${recipe.result?.quantity ?? 1}"
            onchange="Editor.updateRecipeField('${this.escapeAttr(id)}','result.quantity',parseInt(this.value,10)||1)"></div></div>`;
    },

    renderRecipeIngredientsEditor(id, recipe) {
      const rid = this.escapeAttr(id);
      const ingIds = typeof this.getIngredientIds === 'function' ? this.getIngredientIds() : [];
      const used = new Set();
      const rows = (recipe.ingredients || []).map((row, idx) => {
        const cur = this.getRecipeIngredientId(row);
        if (cur) used.add(cur);
        let opts = '<option value="">— ингредиент —</option>';
        ingIds.forEach((iid) => {
          if (iid !== cur && used.has(iid)) return;
          const label = typeof this.getIngredientLabel === 'function' ? this.getIngredientLabel(iid) : iid;
          opts += `<option value="${this.escapeAttr(iid)}" ${cur === iid ? 'selected' : ''}>${this.escapeHtml(label)}</option>`;
        });
        return `<div class="craft-ing-row">
          <div class="craft-ing-head">#${idx + 1}
            <button type="button" class="btn btn-danger btn-sm" onclick="Editor.removeRecipeIngredient('${rid}',${idx})">×</button></div>
          <select onchange="Editor.updateRecipeIngredient('${rid}',${idx},'id',this.value)">${opts}</select>
          <label>Количество: <input type="number" min="1" value="${row.quantity ?? 1}"
            onchange="Editor.updateRecipeIngredient('${rid}',${idx},'quantity',this.value)"></label>
        </div>`;
      }).join('');
      const canAdd = (recipe.ingredients || []).length < MAX_RECIPE_INGREDIENTS;
      return `<div class="project-info">
        <div class="craft-ing-toolbar"><h4>Ингредиенты (${MIN_RECIPE_INGREDIENTS}–${MAX_RECIPE_INGREDIENTS})</h4>
          ${canAdd ? `<button type="button" class="btn btn-secondary" onclick="Editor.addRecipeIngredient('${rid}')">+ Добавить</button>` : ''}</div>
        <div class="craft-ing-list">${rows || '<p class="hint">Добавьте ингредиенты</p>'}</div>
      </div>`;
    },

    renderRecipeRequirements(id, recipe) {
      const rid = this.escapeAttr(id);
      const req = recipe.requirements || {};
      const lvl = req.level || {};
      const hasLevel = lvl.min != null && lvl.min !== '';
      const hasSkill = (req.skills || []).length > 0;
      const hasTool = (req.tools || []).length > 0;
      const skill = req.skills?.[0] || { skillId: 'alchemy', rank: 'untrained' };
      const tool = req.tools?.[0] || { itemId: '', consumed: false };
      const skillOpts = CRAFTING_SKILLS.map((s) =>
        `<option value="${s}" ${skill.skillId === s ? 'selected' : ''}>${s}</option>`
      ).join('');
      const rankOpts = Object.entries(SKILL_RANKS).map(([k, lab]) =>
        `<option value="${k}" ${skill.rank === k ? 'selected' : ''}>${lab}</option>`
      ).join('');
      const toolOpts = ['', ...Object.keys(this.data?.items || {})].map((iid) => {
        const it = iid ? this.data.items[iid] : null;
        const lab = iid ? `${iid} — ${it?.name || '?'}` : '— инструмент —';
        return `<option value="${this.escapeAttr(iid)}" ${tool.itemId === iid ? 'selected' : ''}>${this.escapeHtml(lab)}</option>`;
      }).join('');
      const timeOpts = Object.entries(CRAFTING_TIMES).map(([k, lab]) =>
        `<option value="${k}" ${recipe.craftingTime?.type === k ? 'selected' : ''}>${lab}</option>`
      ).join('');
      const locOpts = Object.entries(LOCATION_CONDITIONS).map(([k, lab]) =>
        `<option value="${k}" ${(recipe.conditions?.location || '') === k ? 'selected' : ''}>${this.escapeHtml(lab)}</option>`
      ).join('');
      return `<div class="project-info">
        <h4>Требования</h4>
        <label class="craft-check"><input type="checkbox" ${hasLevel ? 'checked' : ''}
          onchange="Editor.toggleRecipeLevelReq('${rid}', this.checked)"> Уровень:
          <input type="number" min="1" value="${lvl.min ?? 1}" ${hasLevel ? '' : 'disabled'}
            onchange="Editor.updateRecipeField('${rid}','requirements.level.min',parseInt(this.value,10)||1)"></label>
        <label class="craft-check"><input type="checkbox" ${hasSkill ? 'checked' : ''}
          onchange="Editor.toggleRecipeRequirementSkill('${rid}', this.checked)"> Навык:
          <select ${hasSkill ? '' : 'disabled'} onchange="Editor.updateRecipeSkill('${rid}','skillId',this.value)">${skillOpts}</select>
          <select ${hasSkill ? '' : 'disabled'} onchange="Editor.updateRecipeSkill('${rid}','rank',this.value)">${rankOpts}</select></label>
        <label class="craft-check"><input type="checkbox" ${hasTool ? 'checked' : ''}
          onchange="Editor.toggleRecipeRequirementTool('${rid}', this.checked)"> Инструмент:
          <select ${hasTool ? '' : 'disabled'} onchange="Editor.updateRecipeTool('${rid}','itemId',this.value)">${toolOpts}</select>
          <label><input type="checkbox" ${tool.consumed ? 'checked' : ''} ${hasTool ? '' : 'disabled'}
            onchange="Editor.updateRecipeTool('${rid}','consumed',this.checked)"> расходуется</label></label>
        <div class="grid-2" style="margin-top:10px;">
          <div class="form-group"><label>Время крафта</label>
            <select onchange="Editor.updateRecipeField('${rid}','craftingTime.type',this.value)">${timeOpts}</select></div>
          <div class="form-group"><label>Значение времени</label>
            <input type="number" min="0" value="${recipe.craftingTime?.value ?? 0}"
              onchange="Editor.updateRecipeField('${rid}','craftingTime.value',parseInt(this.value,10)||0)"></div>
        </div>
        <div class="form-group"><label>Опыт за крафт (XP)</label>
          <input type="number" min="0" value="${recipe.rewards?.experience ?? 0}"
            onchange="Editor.updateRecipeField('${rid}','rewards.experience',parseInt(this.value,10)||0)"></div>
        <div class="form-group"><label>Локация (условие)</label>
          <select onchange="Editor.updateRecipeField('${rid}','conditions.location',this.value||null)">${locOpts}</select></div>
      </div>`;
    },

    renderRecipeWizard(id) {
      const recipe = this.data.recipes[id];
      const step = this.recipeWizardStep || 1;
      const rid = this.escapeAttr(id);
      const catOpts = Object.entries(RECIPE_CATEGORIES).map(([k, lab]) =>
        `<option value="${k}" ${recipe.category === k ? 'selected' : ''}>${lab}</option>`
      ).join('');
      const steps = [
        `<div class="craft-wizard-step"><h4>Шаг 1: Название и категория</h4>
          <input value="${this.escapeAttr(recipe.name || '')}" onchange="Editor.updateRecipeField('${rid}','name',this.value)">
          <select onchange="Editor.updateRecipeField('${rid}','category',this.value)">${catOpts}</select></div>`,
        `<div class="craft-wizard-step"><h4>Шаг 2: Результат</h4>${this.renderRecipeResultSelect(id, recipe)}</div>`,
        `<div class="craft-wizard-step"><h4>Шаг 3: Ингредиенты</h4>${this.renderRecipeIngredientsEditor(id, recipe)}</div>`,
        `<div class="craft-wizard-step"><h4>Шаг 4: Требования и время</h4>${this.renderRecipeRequirements(id, recipe)}</div>`,
        `<div class="craft-wizard-step"><h4>Шаг 5: Проверка</h4>
          <p class="hint">${this.validateRecipe(recipe).join('<br>') || '✅ Все проверки пройдены'}</p>
          <button type="button" class="btn btn-primary" onclick="Editor.saveRecipe('${rid}')">💾 Сохранить рецепт</button></div>`
      ];
      const nav = `<div class="craft-wizard-nav">
        ${step > 1 ? `<button type="button" class="btn btn-secondary" onclick="Editor.recipeWizardStep=${step - 1};Editor.renderRecipes()">← Назад</button>` : ''}
        ${step < 5 ? `<button type="button" class="btn btn-secondary" onclick="Editor.recipeWizardStep=${step + 1};Editor.renderRecipes()">Далее →</button>` : ''}
        <button type="button" class="btn btn-secondary" onclick="Editor.recipeWizardStep=0;Editor.renderRecipes()">Пропустить мастер</button>
      </div>`;
      return `<div class="craft-wizard">${nav}${steps[step - 1] || steps[0]}</div>`;
    },

    renderRecipeDetail(id) {
      const recipe = this.data?.recipes?.[id];
      if (!recipe) return '<div class="empty-state"><h2>Рецепт не найден</h2></div>';
      this.ensureRecipeDefaults(recipe);
      const rid = this.escapeAttr(id);
      if (this.recipeWizardStep > 0) return this.renderRecipeWizard(id);

      const catOpts = Object.entries(RECIPE_CATEGORIES).map(([k, lab]) =>
        `<option value="${k}" ${recipe.category === k ? 'selected' : ''}>${lab}</option>`
      ).join('');
      const tagsStr = (recipe.tags || []).join(', ');

      return `<div class="quest-detail-card craft-detail-card">
        <div class="quest-detail-head">
          <h3>${recipe.icon || '🔨'} ${this.escapeHtml(recipe.name || id)}</h3>
          <div class="craft-detail-actions">
            <button type="button" class="btn btn-primary" onclick="Editor.saveRecipe('${rid}')">💾 Сохранить</button>
            <button type="button" class="btn btn-secondary" onclick="Editor.testRecipe('${rid}')">🧪 Тест</button>
            <button type="button" class="btn btn-danger" onclick="Editor.deleteRecipe('${rid}')">🗑️ Удалить</button>
          </div>
        </div>
        <div class="form-group"><label>ID</label><input value="${this.escapeHtml(id)}" disabled></div>
        <div class="grid-2">
          <div class="form-group"><label>Название *</label>
            <input value="${this.escapeAttr(recipe.name || '')}" onchange="Editor.updateRecipeField('${rid}','name',this.value)"></div>
          <div class="form-group"><label>Категория</label>
            <select onchange="Editor.updateRecipeField('${rid}','category',this.value);Editor.renderRecipes()">${catOpts}</select></div>
        </div>
        <div class="grid-2">
          <div class="form-group"><label>Иконка</label>
            <input value="${this.escapeAttr(recipe.icon || '')}" onchange="Editor.updateRecipeField('${rid}','icon',this.value)"></div>
          <div class="form-group"><label>Теги</label>
            <input value="${this.escapeAttr(tagsStr)}" onchange="Editor.updateRecipeTags('${rid}', this.value)"></div>
        </div>
        <div class="form-group"><label>Описание</label>
          <textarea rows="2" onchange="Editor.updateRecipeField('${rid}','description',this.value)">${this.escapeHtml(recipe.description || '')}</textarea></div>
        ${this.renderRecipeResultSelect(id, recipe)}
        ${this.renderRecipeIngredientsEditor(id, recipe)}
        ${this.renderRecipeRequirements(id, recipe)}
        <label class="craft-check"><input type="checkbox" ${recipe.startKnown ? 'checked' : ''}
          onchange="Editor.updateRecipeField('${rid}','startKnown',this.checked)"> Известен с начала игры</label>
      </div>`;
    },

    renderRecipes() {
      const c = document.getElementById('recipes-editor');
      if (!c) return;
      if (!this.data) {
        c.innerHTML = '<div class="empty-state"><h2>Загрузите данные</h2></div>';
        return;
      }
      if (typeof this.ensureCraftingData === 'function') this.ensureCraftingData();
      const allIds = this.getRecipeIds();
      const ids = this.filterRecipeIds(allIds);
      if (!this.editingRecipeId || !this.data.recipes[this.editingRecipeId]) {
        this.editingRecipeId = ids[0] || allIds[0] || null;
      }
      const head = `<div class="craft-editor-toolbar">
        <span class="craft-editor-title">🔨 Рецепты</span>
        <div class="craft-editor-toolbar-actions">
          <button type="button" class="btn btn-secondary" onclick="Editor.exportRecipesJson()">📤 Экспорт</button>
          <button type="button" class="btn btn-secondary" onclick="Editor.importRecipesJson()">📥 Импорт</button>
          <button type="button" class="btn btn-primary" onclick="Editor.createRecipe()">+ Создать</button>
        </div>
      </div>${this.renderRecipeFilters()}`;

      if (!allIds.length) {
        c.innerHTML = `${head}<div class="quest-manager">
          <div class="quest-manager-sidebar"><p class="hint">Создайте первый рецепт.</p>
            <button type="button" class="btn btn-primary" style="width:100%;" onclick="Editor.createRecipe()">+ Создать</button></div>
          <div class="quest-manager-detail"><div class="empty-state"><h2>Пусто</h2></div></div></div>`;
        return;
      }

      const sidebar = ids.map((rid) => {
        const r = this.data.recipes[rid];
        const active = rid === this.editingRecipeId ? ' active' : '';
        const afford = this.canAffordRecipeTest(r) ? '' : ' craft-rec-unaffordable';
        return `<button type="button" class="quest-pick${active}${afford}" onclick="Editor.selectRecipeToEdit('${this.escapeAttr(rid)}')">${r.icon || '🔨'} ${this.escapeHtml(r.name || rid)}</button>`;
      }).join('');

      const detail = this.editingRecipeId ? this.renderRecipeDetail(this.editingRecipeId) : '';
      c.innerHTML = `${head}<div class="quest-manager craft-editor-wrap">
        <div class="quest-manager-sidebar">${sidebar || '<p class="hint">Нет по фильтру</p>'}</div>
        <div class="quest-manager-detail">${detail}</div>
      </div>`;
    }
  });
})();
