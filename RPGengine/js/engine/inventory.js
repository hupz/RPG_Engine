// ============================================================
// engine/inventory.js — инвентарь, экипировка, магазин
// ============================================================

(function attachEngineInventory() {
  'use strict';
  if (typeof GameEngine === 'undefined') {
    console.error('engine/inventory.js: GameEngine не определён — загрузите core.js первым');
    return;
  }

  Object.assign(GameEngine, {
    // ========== УПРАВЛЕНИЕ СОСТОЯНИЕМ ==========
    setCharName(name) {
      this.state.charName = name || 'Герой';
      const inp = document.getElementById('char-name-input');
      if (inp) inp.value = this.state.charName;
      this.syncMobileCompactBar();
    },

    SUPPLY_ITEM_ID: 'supplies',
    ARROWS_ITEM_ID: 'arrows',
    ARROWS_START_COUNT: 10,
    ARROWS_PER_BUNDLE: 10,

    isRestSupplyItem(db) {
      if (!db) return false;
      if (db.id === this.SUPPLY_ITEM_ID || db.use?.effect === 'rest_material') return true;
      return false;
    },

    isStackableItem(itemId, db) {
      if (itemId === this.ARROWS_ITEM_ID) return false;
      const d = db || this.data?.items?.[itemId];
      return itemId === this.SUPPLY_ITEM_ID || d?.stackable === true;
    },

    weaponRequiresArrows(weapon) {
      if (!weapon) return false;
      return (
        typeof CombatPosition !== 'undefined' && CombatPosition.isWeaponRanged(weapon)
      );
    },

    attackRequiresArrows(profile) {
      if (!profile?.weaponId) return false;
      const weapon =
        this.itemsData?.[profile.weaponId] || this.data?.items?.[profile.weaponId];
      return this.weaponRequiresArrows(weapon);
    },

    getArrowCount() {
      if (!this.state.inventory.includes(this.ARROWS_ITEM_ID)) return 0;
      if (!this.state.itemCharges) this.state.itemCharges = {};
      return Math.max(0, parseInt(this.state.itemCharges[this.ARROWS_ITEM_ID], 10) || 0);
    },

    setArrowCount(value) {
      if (!this.state.itemCharges) this.state.itemCharges = {};
      const max = this.getItemMaxCharges(this.ARROWS_ITEM_ID) || 9999;
      this.state.itemCharges[this.ARROWS_ITEM_ID] = Math.max(
        0,
        Math.min(max, parseInt(value, 10) || 0)
      );
    },

    addArrows(amount) {
      const n = Math.max(1, parseInt(amount, 10) || this.ARROWS_PER_BUNDLE);
      if (!this.state.inventory.includes(this.ARROWS_ITEM_ID)) {
        this.state.inventory.push(this.ARROWS_ITEM_ID);
      }
      this.setArrowCount(this.getArrowCount() + n);
      this.updateUI();
    },

    consumeOneArrow() {
      if (this.getArrowCount() <= 0) return false;
      this.setArrowCount(this.getArrowCount() - 1);
      return true;
    },

    playerHasBowInInventory() {
      const check = (itemId) => {
        const w = this.itemsData?.[itemId] || this.data?.items?.[itemId];
        return this.weaponRequiresArrows(w);
      };
      if ((this.state.inventory || []).some(check)) return true;
      if (check(this.getEquippedItemId('weapon_main'))) return true;
      if (check(this.getEquippedItemId('weapon_off'))) return true;
      return false;
    },

    initStartingArrowAmmo() {
      if (!this.playerHasBowInInventory()) return;
      if (!this.state.inventory.includes(this.ARROWS_ITEM_ID)) {
        this.state.inventory.push(this.ARROWS_ITEM_ID);
      }
      if (!this.state.itemCharges) this.state.itemCharges = {};
      if (this.state.itemCharges[this.ARROWS_ITEM_ID] == null) {
        this.state.itemCharges[this.ARROWS_ITEM_ID] = this.ARROWS_START_COUNT;
      }
    },

    migrateArrowAmmoState() {
      const id = this.ARROWS_ITEM_ID;
      let inv = [...(this.state.inventory || [])];
      const copies = inv.filter((i) => i === id).length;
      if (copies > 1) {
        inv = inv.filter((i) => i !== id);
        inv.push(id);
        this.state.inventory = inv;
        const legacy = (copies - 1) * 20;
        if (!this.state.itemCharges) this.state.itemCharges = {};
        const cur = parseInt(this.state.itemCharges[id], 10) || 0;
        this.state.itemCharges[id] = cur + legacy;
      }
      if (inv.includes(id) && this.state.itemCharges?.[id] == null) {
        if (!this.state.itemCharges) this.state.itemCharges = {};
        this.state.itemCharges[id] = this.ARROWS_START_COUNT;
      }
    },

    getSupplyCount() {
      const inv = (this.state.inventory || []).filter((id) => id === this.SUPPLY_ITEM_ID).length;
      return inv + (parseInt(this.state.supplies, 10) || 0);
    },

    consumeOneSupply() {
      const idx = (this.state.inventory || []).indexOf(this.SUPPLY_ITEM_ID);
      if (idx >= 0) {
        this.state.inventory.splice(idx, 1);
        return true;
      }
      if ((parseInt(this.state.supplies, 10) || 0) > 0) {
        this.state.supplies--;
        return true;
      }
      return false;
    },

    /** Старые сохранения: счётчик припасов + предметы в инвентаре */
    migrateSuppliesState() {
      const inv = (this.state.inventory || []).filter((id) => id === this.SUPPLY_ITEM_ID).length;
      const legacy = parseInt(this.state.supplies, 10) || 0;
      if (legacy > 0 && inv === 0) {
        for (let i = 0; i < legacy; i++) this.state.inventory.push(this.SUPPLY_ITEM_ID);
      }
      this.state.supplies = 0;
    },

    MILL_EXTERIOR_SCENES: ['mill_arrival', 'mill_door', 'mill_barn'],

    isMillSceneId(sceneId) {
      return typeof sceneId === 'string' && sceneId.startsWith('mill_');
    },

    isMillExteriorSceneId(sceneId) {
      return this.MILL_EXTERIOR_SCENES.includes(sceneId);
    },

    /** Старые сохранения: доступ в мельницу после первого проникновения */
    migrateMillAccessFlag() {
      const f = this.state.flags || {};
      if (!f.mill_infiltrated) {
        const wasInside = !!(
          f.mill_window_entry
          || f.doorBroken
          || f.foundCellar
          || f.secondFloorLoot
          || f.mill_first_perc12_fail
          || f.mill_first_perc14_fail
        );
        if (wasInside) f.mill_infiltrated = true;
      }
      if (f.mill_infiltrated && !f.mill_shortcut_unlocked) {
        const scene = this.state.scene;
        if (scene && !this.isMillSceneId(scene)) {
          f.mill_shortcut_unlocked = true;
        }
      }
    },

    /** Ярлык «Войти в мельницу» — только после ухода с площадки и возврата */
    /** Обе проверки на излучине реки использованы, медальон не найден */
    shouldFailAlbertLocketSearch() {
      if ((this.state.inventory || []).includes('elsa_locket')) return false;
      if (this.isQuestFailed('albert_locket') || this.isQuestFinished('albert_locket')) {
        return false;
      }
      const stage = this.getQuestStage('albert_locket');
      if (stage == null || stage === '' || stage === '__finished__' || stage === '__failed__') {
        return false;
      }
      if (!this.state.flags?.albert_locket_started) return false;
      return !!(
        this.state.flags.sc_river_bend_search_0 &&
        this.state.flags.sc_river_bend_search_1
      );
    },

    unlockMillShortcutOnLeave(prevSceneId, nextSceneId) {
      if (!prevSceneId || !this.isMillExteriorSceneId(prevSceneId)) return;
      if (this.isMillSceneId(nextSceneId)) return;
      this.migrateMillAccessFlag();
      if (this.state.flags?.mill_infiltrated) {
        this.state.flags.mill_shortcut_unlocked = true;
      }
    },

    getItemMaxCharges(itemId, db) {
      const d = db || this.data?.items?.[itemId];
      const n = d?.use?.maxCharges ?? d?.charges;
      const max = parseInt(n, 10);
      return Number.isFinite(max) && max > 0 ? max : 0;
    },

    getItemCharges(itemId) {
      if (itemId === this.ARROWS_ITEM_ID) {
        const max = this.getItemMaxCharges(itemId) || 9999;
        const current = this.getArrowCount();
        return { current, max };
      }
      const db = this.data?.items?.[itemId];
      const max = this.getItemMaxCharges(itemId, db);
      if (!max) return null;
      if (!this.state.itemCharges) this.state.itemCharges = {};
      if (this.state.itemCharges[itemId] == null) this.state.itemCharges[itemId] = max;
      const current = Math.max(0, Math.min(max, parseInt(this.state.itemCharges[itemId], 10) || 0));
      this.state.itemCharges[itemId] = current;
      return { current, max };
    },

    setItemCharges(itemId, value) {
      const max = this.getItemMaxCharges(itemId);
      if (!max) return;
      if (!this.state.itemCharges) this.state.itemCharges = {};
      this.state.itemCharges[itemId] = Math.max(0, Math.min(max, parseInt(value, 10) || 0));
    },

    initItemChargesOnAdd(itemId) {
      if (itemId === this.ARROWS_ITEM_ID) return;
      const max = this.getItemMaxCharges(itemId);
      if (!max) return;
      if (!this.state.itemCharges) this.state.itemCharges = {};
      if (this.state.itemCharges[itemId] == null) this.state.itemCharges[itemId] = max;
    },

    formatItemChargeHint(itemId, db) {
      if (itemId === this.ARROWS_ITEM_ID) {
        const n = this.getArrowCount();
        return n > 0 ? ` (${n})` : ' (0)';
      }
      const ch = this.getItemCharges(itemId);
      if (!ch) return '';
      return ` (${ch.current}/${ch.max})`;
    },

    sceneHasWaterSource(scene) {
      return !!(scene?.waterSource || scene?.water_source);
    },

    canRefillWaterFlaskHere() {
      if (!this.state.inventory.includes('water_flask')) return false;
      const scene = this.data?.scenes?.[this.state.scene];
      if (!this.sceneHasWaterSource(scene)) return false;
      const ch = this.getItemCharges('water_flask');
      return ch && ch.current < ch.max;
    },

    refillWaterFlask() {
      if (!this.state.inventory.includes('water_flask')) {
        this.log('❌ Нет фляги.', 'log-damage');
        return;
      }
      const scene = this.data?.scenes?.[this.state.scene];
      if (!this.sceneHasWaterSource(scene)) {
        this.log('❌ Здесь нельзя набрать воды.', 'log-damage');
        return;
      }
      const max = this.getItemMaxCharges('water_flask');
      this.setItemCharges('water_flask', max);
      this.log(`💧 Фляга наполнена (${max} глотка).`, 'log-heal');
      this.updateUI();
      this.saveGame();
    },

    withWaterRefillChoices(choices, scene) {
      const list = Array.isArray(choices) ? [...choices] : [];
      if (!this.canRefillWaterFlaskHere()) return list;
      list.push({
        text: '💧 Наполнить флягу у воды',
        action: 'refill_water_flask',
        once: false
      });
      return list;
    },

    addItem(itemId) {
      if (!itemId) return;
      itemId = this.resolveItemId(itemId);
      const db = this.data?.items?.[itemId];
      if (!db) return;

      if (itemId === this.ARROWS_ITEM_ID) {
        this.addArrows(this.ARROWS_PER_BUNDLE);
        return;
      }

      const stackable = this.isStackableItem(itemId, db);
      if (stackable || !this.state.inventory.includes(itemId)) {
        this.state.inventory.push(itemId);
        this.initItemChargesOnAdd(itemId);
        this.updateUI();
        this.checkAchievements({ type: 'item_gained', itemId });
      }
    },

    removeItem(itemId) {
      itemId = this.resolveItemId(itemId);
      this.state.inventory = this.state.inventory.filter(i => i !== itemId);
      this.unequipItem(itemId, { silent: true });
      this.updateUI();
    },

    ensureCraftingState() {
      if (!this.state.crafting || typeof this.state.crafting !== 'object') {
        this.state.crafting = { knownRecipes: [] };
      }
      if (!Array.isArray(this.state.crafting.knownRecipes)) {
        this.state.crafting.knownRecipes = [];
      }
      if (!this.state.crafting.knownRecipes.length && this.data?.recipes) {
        this.state.crafting.knownRecipes = Object.values(this.data.recipes)
          .filter((r) => r && r.startKnown !== false)
          .map((r) => r.id)
          .filter(Boolean);
      }
    },

    migrateCraftingState() {
      if (!this.data?.recipes) return;
      this.ensureCraftingState();
    },

    getRecipeById(recipeId) {
      return this.data?.recipes?.[recipeId] || null;
    },

    getAllRecipes() {
      const raw = this.data?.recipes || {};
      return Object.keys(raw).map((id) => ({ ...raw[id], id: raw[id].id || id }));
    },

    countInventoryItem(itemId) {
      const id = this.resolveItemId(itemId);
      return (this.state.inventory || []).filter((i) => i === id).length;
    },

    isRecipeKnown(recipeId) {
      this.ensureCraftingState();
      const recipe = this.getRecipeById(recipeId);
      if (!recipe) return false;
      if (recipe.startKnown === false) {
        return this.state.crafting.knownRecipes.includes(recipeId);
      }
      return true;
    },

    discoverRecipe(recipeId) {
      this.ensureCraftingState();
      if (recipeId && !this.state.crafting.knownRecipes.includes(recipeId)) {
        this.state.crafting.knownRecipes.push(recipeId);
      }
    },

    canCraftRecipe(recipeId) {
      const recipe = this.getRecipeById(recipeId);
      if (!recipe || !this.isRecipeKnown(recipeId)) return false;
      return (recipe.ingredients || []).every((ing) => {
        const id = ing.id || ing.itemId;
        const need = Math.max(1, parseInt(ing.quantity, 10) || 1);
        return this.countInventoryItem(id) >= need;
      });
    },

    getCraftableRecipes() {
      return this.getAllRecipes().filter((r) => this.canCraftRecipe(r.id));
    },

    async craft(recipeId) {
      if (!recipeId) return { success: false, error: 'no_recipe' };
      if (typeof this.runAction === 'function') {
        return this.runAction('craft_item', { recipeId });
      }
      if (typeof ActionRunner !== 'undefined' && ActionRunner.runV2) {
        return ActionRunner.runV2(this, 'craft_item', { recipeId });
      }
      return { success: false, error: 'no_runner' };
    },

    FOCUS_POTION_MS: 60 * 60 * 1000,

    expireFocusPotionIfNeeded(silent) {
      const until = this.state.flags?.focusPotionUntil;
      if (!until) return false;
      if (Date.now() >= until) {
        delete this.state.flags.focusPotionUntil;
        if (!silent) this.log('🧿 Действие зелья фокусировки закончилось.', 'log-dice');
        return true;
      }
      return false;
    },

    hasFocusPotionAdvantage() {
      this.expireFocusPotionIfNeeded(true);
      const until = this.state.flags?.focusPotionUntil;
      return typeof until === 'number' && Date.now() < until;
    },

    getFocusPotionTimeLeftLabel() {
      const until = this.state.flags?.focusPotionUntil;
      if (!until || Date.now() >= until) return '';
      const minLeft = Math.ceil((until - Date.now()) / 60000);
      if (minLeft >= 60) return '~1 ч';
      return `${minLeft} мин`;
    },

    applyFocusPotion(itemId, db) {
      const hours = Number(db?.use?.durationHours) || 1;
      this.state.flags.focusPotionUntil = Date.now() + hours * this.FOCUS_POTION_MS;
      this.log(
        `🧿 ${db.name}: преимущество на проверки концентрации (${hours} ч.)`,
        'log-heal'
      );
      this.playCombatSound(this.resolveSoundId(db?.use?.sound, 'heal', 'buff'));
      this.removeItem(itemId);
    },

    getConsumableButtonLabel(db) {
      if (db?.use?.label) return db.use.label;
      const n = (db?.name || '').toLowerCase();
      if (/зелье|эликсир|flask|potion/.test(n)) return 'Выпить';
      if (/припас|еда|хлеб|мясо/.test(n)) return 'Съесть';
      return 'Использовать';
    },

    /** Проверки перед экипировкой оружия / щита */
    resolveWeaponEquipPlan(item, targetSlot) {
      const hands = this.getWeaponHands(item);
      const slot = targetSlot === 'weapon_off' ? 'weapon_off' : 'weapon_main';
      const eq = this.state.equipped || {};
      const mainId = eq.weapon_main || eq.weapon;
      const mainItem = mainId ? this.itemsData[mainId] : null;

      if (slot === 'weapon_off') {
        if (hands === 'two') {
          return { ok: false, message: 'Второе оружие должно быть одноручным.' };
        }
        if (mainItem && this.isTwoHandedWeapon(mainItem)) {
          return { ok: false, message: 'Нельзя: в основной руке двуручное оружие.' };
        }
        if (!mainItem) {
          return { ok: false, message: 'Сначала экипируйте оружие в основную руку.' };
        }
        if (eq.shield) {
          return {
            ok: true,
            slot: 'weapon_off',
            clearSlots: ['shield'],
            notice: 'Щит снят — во второй руке оружие.'
          };
        }
        return { ok: true, slot: 'weapon_off' };
      }

      if (hands === 'two') {
        return {
          ok: true,
          slot: 'weapon_main',
          clearSlots: ['weapon_off', 'shield'],
          notice: 'Двуручное оружие требует обе руки.'
        };
      }
      return { ok: true, slot: 'weapon_main' };
    },

    equipItem(itemId, targetSlot) {
      itemId = this.resolveItemId(itemId);
      const db = this.itemsData[itemId];
      if (!db || !this.state.inventory.includes(itemId)) return;
      if (!this.isEquippableItem(db)) {
        this.log('Этот предмет нельзя экипировать.', 'log-dice');
        return;
      }
      if (this.state.combat && !this.state.combat.playerTurn) {
        this.log('Не ваш ход!', 'log-damage');
        return;
      }

      if (this.isArmorItem(db) && !this.canWearArmor(db)) {
        this.log('Слишком тяжелая броня', 'log-damage');
        return;
      }

      let slot = this.getEquipSlot(db, targetSlot);
      if (!slot) {
        this.log('Этот предмет нельзя экипировать.', 'log-dice');
        return;
      }

      if (this.isWeaponItem(db)) {
        const plan = this.resolveWeaponEquipPlan(db, targetSlot);
        if (!plan.ok) {
          this.log(`❌ ${plan.message}`, 'log-damage');
          return;
        }
        slot = plan.slot;
        if (!this.state.equipped) this.state.equipped = {};
        (plan.clearSlots || []).forEach((s) => this.clearEquipSlot(s, { silent: true }));
        if (plan.notice) this.log(plan.notice, 'log-dice');
      }

      if (this.isShieldItem(db)) {
        if (this.getEquippedItemId('weapon_off')) {
          this.clearEquipSlot('weapon_off', { silent: true });
          this.log('Во второй руке нельзя держать оружие вместе со щитом — оружие снято.', 'log-dice');
        }
        slot = 'shield';
      }

      if (!this.state.equipped) this.state.equipped = {};
      const prev = this.state.equipped[slot];
      this.state.equipped[slot] = itemId;
      if (slot === 'shield' && this.state.equipped.offhand) delete this.state.equipped.offhand;

      this.recalculateCombatStats();
      if (prev && prev !== itemId) {
        const prevDb = this.itemsData[prev];
        this.log(`🛡️ Снято: ${prevDb?.name || prev}`, 'log-dice');
      }
      this.log(`🛡️ Экипировано: ${db.name}`, 'log-heal');
      if (this.isItemCursed(db)) {
        this.recalculateCurseEffectsFromEquipment();
        const effects = this.formatCurseEffectsList(db);
        this.log(`⚠️ ${db.name} проклят! Эффекты: ${effects}`, 'log-damage');
        this.playCombatSound(this.resolveSoundId('curse_equip', 'physical_hit'), 0.45);
      } else {
        this.recalculateCurseEffectsFromEquipment();
      }
      this.updateUI();
      this.saveGame();
    },

    unequipItem(itemIdOrSlot, opts = {}) {
      if (!this.state.equipped) return;

      const slots = ['weapon_main', 'weapon_off', 'armor', 'shield', 'weapon', ...this.ACCESSORY_SLOTS];
      if (slots.includes(itemIdOrSlot)) {
        const slot = itemIdOrSlot;
        const itemId = this.state.equipped[slot] || (slot === 'shield' ? this.state.equipped.offhand : null);
        if (!itemId) return;
        if (!opts.silent && !this.canUnequipItem(itemId)) return;
        delete this.state.equipped[slot];
        if (slot === 'shield') delete this.state.equipped.offhand;
        this.recalculateCombatStats();
        this.recalculateCurseEffectsFromEquipment();
        if (!opts.silent) {
          const db = this.itemsData[itemId];
          this.log(`Снято: ${db?.name || itemId}`, 'log-dice');
          this.updateUI();
          this.saveGame();
        }
        return;
      }

      const itemId = this.resolveItemId(itemIdOrSlot);
      if (!opts.silent && !this.canUnequipItem(itemId)) return;
      let removed = false;
      for (const slot of [...this.EQUIPMENT_SLOTS, 'offhand', 'accessory']) {
        if (this.state.equipped[slot] === itemId) {
          delete this.state.equipped[slot];
          removed = true;
        }
      }
      if (!removed) return;
      this.recalculateCombatStats();
      this.recalculateCurseEffectsFromEquipment();
      if (!opts.silent) {
        const db = this.itemsData[itemId];
        this.log(`Снято: ${db?.name || itemId}`, 'log-dice');
        this.updateUI();
        this.saveGame();
      }
    },

    /**
     * Использование предмета: расходник — эффект и удаление; снаряжение — экипировка; ключ — без действия.
     */
    useItem(itemKey) {
      const itemId = this.resolveItemId(itemKey);
      const db = this.data?.items?.[itemId];
      if (!db || !this.state.inventory.includes(itemId)) return;

      if (db.useAbility) {
        this.applyItemAbilityEffect(itemId);
        return;
      }

      const category = this.getInventoryCategory(db);
      if (category === 'consumable') {
        this.applyConsumableEffect(itemId);
        return;
      }
      if (this.isGameplayEquippable(db)) {
        if (this.isItemEquipped(itemId)) this.unequipItem(itemId);
        else this.equipItem(itemId);
        return;
      }
      if (this.isAccessoryItem(db)) {
        if (this.isItemEquipped(itemId)) this.unequipItem(itemId);
        else this.equipItem(itemId);
        return;
      }
      if (category === 'key') return;
      if (db.content || db.type === 'readable') this.readItem(itemId);
    },

    /** Цель расходника: self | ally | single_enemy | all_enemies (по умолчанию self) */
    getConsumableUseTarget(db) {
      const t = db?.use?.target;
      if (t === 'ally' || t === 'single_enemy' || t === 'all_enemies') return t;
      return 'self';
    },

    consumableRequiresCombat(target) {
      return target === 'single_enemy' || target === 'all_enemies';
    },

    /** Уникальные ID расходников в инвентаре (с полем use, без useAbility) */
    getInventoryConsumableIds() {
      const seen = new Set();
      const ids = [];
      for (const itemId of this.state.inventory || []) {
        if (seen.has(itemId)) continue;
        seen.add(itemId);
        const db = this.data?.items?.[itemId];
        if (!db || db.type !== 'consumable' || !db.use || db.useAbility) continue;
        if (this.isRestSupplyItem(db)) continue;
        ids.push(itemId);
      }
      return ids;
    },

    /** Расходники, которые можно применить в текущей фазе боя */
    getCombatUsableConsumables() {
      if (!this.state.combat || this.getCombatPhase() !== 'player_turn') return [];
      return this.getInventoryConsumableIds().filter(itemId => {
        const db = this.data.items[itemId];
        const target = this.getConsumableUseTarget(db);
        return !this.consumableRequiresCombat(target) || this.state.combat;
      });
    },

    /**
     * Эффект расходника: heal / damage / focus_potion / …
     * opts: { enemy } — один враг; { allEnemies: true } — все живые.
     */
    applyConsumableUseEffect(itemId, db, opts = {}) {
      const use = db.use;
      if (!use) return { itemRemoved: false };

      if (use.effect === 'heal') {
        const amount = use.amount != null
          ? Number(use.amount)
          : this.parseRoll(use.formula || '1d4');
        this.state.hp = Math.min(this.state.maxHp, this.state.hp + amount);
        this.log(`🧪 ${db.name}! +${amount} ОЗ`, 'log-heal');
        this.playCombatSound(this.resolveSoundId(use.sound, 'heal'));
        return { itemRemoved: false };
      }

      if (use.effect === 'damage') {
        const amount = use.amount != null
          ? Number(use.amount)
          : this.parseRoll(use.formula || '1d6');
        let targets = [];
        if (opts.allEnemies) {
          targets = (this.state.enemies || []).filter(e => e.hp > 0);
        } else if (opts.enemy && opts.enemy.hp > 0) {
          targets = [opts.enemy];
        }
        for (const t of targets) {
          t.hp -= amount;
          this.log(`💥 ${t.name} получает ${amount} урона (${db.name})`, 'log-damage');
        }
        this.playCombatSound(this.resolveSoundId(use.sound, use.soundHit, 'fire_hit', 'physical_hit'));
        this.renderCombat();
        return { itemRemoved: false };
      }

      if (use.effect === 'focus_potion') {
        this.applyFocusPotion(itemId, db);
        return { itemRemoved: true };
      }

      if (use.effect === 'rest_material') {
        this.log(use.message || 'Используйте отдых в боковой панели.', 'log-dice');
        return { itemRemoved: true };
      }

      if (use.effect === 'charges_heal') {
        const ch = this.getItemCharges(itemId);
        if (!ch || ch.current <= 0) {
          this.log(use.emptyMessage || 'Заряды закончились.', 'log-dice');
          return { itemRemoved: true };
        }
        const amount = use.amount != null
          ? Number(use.amount)
          : this.parseRoll(use.formula || '1d4');
        this.state.hp = Math.min(this.state.maxHp, this.state.hp + amount);
        ch.current--;
        this.setItemCharges(itemId, ch.current);
        this.log(
          `💧 ${db.name}: +${amount} ОЗ. Глотков осталось: ${ch.current}/${ch.max}`,
          'log-heal'
        );
        this.playCombatSound(this.resolveSoundId(use.sound, 'heal'));
        return { itemRemoved: true };
      }

      if (use.message) {
        this.log(use.message, 'log-dice');
      }
      return { itemRemoved: false };
    },

    /** Завершение хода после расходника в бою */
    finishConsumableCombatTurn(itemId, alreadyRemoved = false) {
      if (!alreadyRemoved) this.removeItem(itemId);
      this.updateStats();
      if (!this.state.combat) {
        this.saveGame();
        return;
      }
      this.renderCombat();
      if (this.state.enemies.every(e => e.hp <= 0)) {
        setTimeout(() => this.nextCombatTurn(), 600);
        this.saveGame();
        return;
      }
      this.state.combat.turnIndex++;
      setTimeout(() => this.nextCombatTurn(), 600);
      this.saveGame();
    },

    /** Выбор врага для расходника (target: single_enemy) */
    beginConsumableTargetSelect(itemId) {
      if (!this.state.combat) return;
      const db = this.data?.items?.[itemId];
      if (!db) return;
      const alive = this.getAliveEnemyIndices();
      if (!alive.length) {
        this.nextCombatTurn();
        return;
      }
      this.state.combat.pendingAbility = null;
      this.state.combat.pendingConsumableId = itemId;
      this.setCombatPhase('select_target');
      this.renderCombat();
      this.playerCombatTurn();
    },

    applyConsumableEffect(itemId) {
      const db = this.data.items[itemId];
      if (!db?.use) return;
      if (!this.state.inventory.includes(itemId)) return;

      if (this.isRestSupplyItem(db)) {
        this.log(db.use?.message || 'Припасы расходуются только при отдыхе.', 'log-dice');
        return;
      }

      if (this.state.combat && !this.isPlayerCombatPhase()) {
        this.log('Не ваш ход!', 'log-damage');
        return;
      }

      if (this.getCombatPhase() === 'select_target') {
        this.log('Сначала выберите цель или нажмите «Отмена».', 'log-dice');
        return;
      }

      let target = this.getConsumableUseTarget(db);
      if (target === 'ally') target = 'self';

      if (this.consumableRequiresCombat(target) && !this.state.combat) {
        this.log('Можно использовать только в бою.', 'log-damage');
        return;
      }

      this.log(`${db.icon || '🧪'} ${db.name}`, 'log-info');

      if (target === 'single_enemy') {
        this.beginConsumableTargetSelect(itemId);
        return;
      }

      if (target === 'all_enemies') {
        const result = this.applyConsumableUseEffect(itemId, db, { allEnemies: true });
        this.finishConsumableCombatTurn(itemId, result.itemRemoved);
        return;
      }

      const result = this.applyConsumableUseEffect(itemId, db, {});
      if (this.state.combat && this.getCombatPhase() === 'player_turn') {
        this.finishConsumableCombatTurn(itemId, result.itemRemoved);
      } else {
        if (!result.itemRemoved) this.removeItem(itemId);
        this.updateUI();
        this.saveGame();
      }
    },

    /** Кнопка «Использовать» у выпадашки расходников в бою */
    useCombatConsumableSelect() {
      const sel = document.getElementById('combat-consumable-select');
      const itemId = sel?.value;
      if (!itemId) {
        this.log('Выберите предмет из списка.', 'log-dice');
        return;
      }
      this.applyConsumableEffect(itemId);
    },

    /**
     * Расходник с useAbility: эффект из progression.abilities, без траты ресурсов класса.
     */
    applyItemAbilityEffect(itemId) {
      const db = this.data?.items?.[itemId];
      if (!db?.useAbility || !this.state.inventory.includes(itemId)) return;

      const ability = this.resolveAbilityDefinition(db.useAbility);
      if (!ability) {
        this.log('Предмет не сработал: умение не найдено.', 'log-damage');
        return;
      }

      if (this.state.combat && this.state.combat.playerTurn === false) {
        this.log('Не ваш ход!', 'log-damage');
        return;
      }

      if (this.isAbilityCombatOnly(ability) && !this.state.combat) {
        this.log('Этот предмет можно использовать только в бою.', 'log-dice');
        return;
      }

      const scrollAbility = JSON.parse(JSON.stringify(ability));
      scrollAbility.cost = 0;
      delete scrollAbility.spellLevel;

      this.log(`${db.icon || '📜'} ${db.name}`, 'log-info');
      this.playAbilityCast(scrollAbility);

      const endsTurn = this.applyAbilityLogic(scrollAbility);
      if (this.state.combat && this.isConcentrationAbility(scrollAbility) && typeof this.beginConcentration === 'function') {
        this.beginConcentration(scrollAbility);
      }
      this.removeItem(itemId);

      if (this.state.combat) {
        this.updateStats();
        this.renderCombat();
        if (!endsTurn) {
          this.playerCombatTurn();
          this.saveGame();
          return;
        }
        this.state.combat.turnIndex++;
        setTimeout(() => this.nextCombatTurn(), 600);
      } else {
        this.updateUI();
      }
      this.saveGame();
    },

    buildInvItemElement(itemId, db) {
      const div = document.createElement('div');
      const category = this.getInventoryCategory(db);
      const equipped = this.isItemEquipped(itemId);
      const usableScroll = !!db.useAbility;
      div.className = 'inv-item'
        + (equipped ? ' inv-item-equipped' : '')
        + (usableScroll ? ' inv-item-usable' : '');

      let actions = '';
      if (this.isWeaponItem(db)) {
        const eq = this.state.equipped || {};
        const inMain = eq.weapon_main === itemId;
        const inOff = eq.weapon_off === itemId;
        if (inMain || inOff) {
          actions = `<button type="button" class="inv-btn inv-btn-unequip" ${this.onclickGame('unequipItem', itemId)}>Снять</button>`;
        } else if (this.isTwoHandedWeapon(db)) {
          actions = `<button type="button" class="inv-btn inv-btn-equip" ${this.onclickGame('equipItem', itemId, 'weapon_main')}>Надеть (2 руки)</button>`;
        } else {
          actions = `<button type="button" class="inv-btn inv-btn-equip" ${this.onclickGame('equipItem', itemId, 'weapon_main')}>Основная</button>`
            + `<button type="button" class="inv-btn inv-btn-equip" ${this.onclickGame('equipItem', itemId, 'weapon_off')}>Вторая</button>`;
        }
      } else if (this.isGameplayEquippable(db)) {
        if (equipped) {
          actions = `<button type="button" class="inv-btn inv-btn-unequip" ${this.onclickGame('unequipItem', itemId)}>Снять</button>`;
        } else {
          actions = `<button type="button" class="inv-btn inv-btn-equip" ${this.onclickGame('equipItem', itemId)}>Надеть</button>`;
        }
      } else if (this.isAccessoryItem(db)) {
        if (equipped) {
          actions = `<button type="button" class="inv-btn inv-btn-unequip" ${this.onclickGame('unequipItem', itemId)}>Снять</button>`;
        } else {
          actions = `<button type="button" class="inv-btn inv-btn-equip" ${this.onclickGame('equipItem', itemId)}>Надеть</button>`;
        }
      } else if (db.useAbility) {
        actions = `<button type="button" class="inv-btn inv-btn-use" ${this.onclickGame('useItem', itemId)}>Использовать</button>`;
      } else if (category === 'consumable' && db.use && !this.isRestSupplyItem(db)) {
        const label = this.getConsumableButtonLabel(db);
        actions = `<button type="button" class="inv-btn inv-btn-use" ${this.onclickGame('useItem', itemId)}>${this.escapeHtml(label)}</button>`;
      } else if (this.isRestSupplyItem(db)) {
        actions = `<span class="inv-hint" title="Тратятся при отдыхе в боковой панели">для отдыха</span>`;
      } else if (category === 'quest' && (db.content || db.type === 'readable')) {
        actions = `<button type="button" class="inv-btn inv-btn-read" ${this.onclickGame('readItem', itemId)}>Читать</button>`;
      }

      const equipTag = equipped ? '<span class="inv-equipped-tag">[Экипировано]</span> ' : '';
      const cursedMark = this.isItemCursed(db) ? '<span class="inv-cursed-mark" title="Проклятый предмет">☠️</span> ' : '';
      const icon = db.icon ? `<span class="inv-item-icon" ${usableScroll ? this.onclickGame('useItem', itemId) : ''} title="${usableScroll ? 'Использовать' : ''}">${this.escapeHtml(db.icon)}</span> ` : '';
      const nameClick = usableScroll ? this.onclickGame('useItem', itemId) : this.onclickGame('showItemDesc', itemId);

      if (equipped && this.isItemCursed(db)) {
        actions = `<button type="button" class="inv-btn inv-btn-cursed" disabled title="Снять можно только у священника">⚠️ Проклято</button>`;
      }

      div.innerHTML = `
        <span class="item-name" ${nameClick} title="${this.escapeAttr(db.desc || '')}">
          ${icon}${cursedMark}${equipTag}${this.escapeHtml(db.name)}${this.escapeHtml(this.formatItemChargeHint(itemId, db))}
        </span>
        <div class="item-actions">${actions}</div>
      `;
      return div;
    },

    renderInv() {
      const el = document.getElementById('inventory-list');
      if (!el) {
        console.warn('Элемент #inventory-list не найден!');
        return;
      }

      if (!this.data || !this.data.items) {
        console.warn('Данные items не загружены');
        el.innerHTML = '<div class="inv-empty">Данные не загружены</div>';
        return;
      }

      el.innerHTML = '';

      if (!this.state.inventory.length) {
        el.innerHTML = '<div class="inv-empty">Инвентарь пуст</div>';
        return;
      }

      const buckets = { equipment: [], consumable: [], key: [], quest: [] };

      this.state.inventory.forEach(itemId => {
        const db = this.data.items[itemId];
        if (!db) {
          console.warn('Предмет не найден в базе:', itemId);
          return;
        }
        const cat = this.getInventoryCategory(db);
        buckets[cat].push({ itemId, db });
      });

      let rendered = 0;

      this.INVENTORY_SECTIONS.forEach(section => {
        const items = buckets[section.key];
        if (!items.length) return;

        const wrap = document.createElement('div');
        wrap.className = 'inv-section';

        const title = document.createElement('div');
        title.className = 'inv-section-title';
        title.textContent = section.label;
        wrap.appendChild(title);

        const list = document.createElement('div');
        list.className = 'inv-section-list';
        items.forEach(({ itemId, db }) => {
          list.appendChild(this.buildInvItemElement(itemId, db));
        });
        wrap.appendChild(list);
        el.appendChild(wrap);
        rendered += items.length;
      });

      if (!rendered) {
        el.innerHTML = '<div class="inv-empty">Инвентарь пуст</div>';
      }
    },

    showItemDesc(itemId) {
      const db = this.data.items[itemId] || { desc: 'Нет описания.' };
      this.showModal(db.name, db.desc);
    },

    useConsumable(itemId) {
      this.useItem(itemId);
    },

    readItem(itemId) {
      const db = this.data.items[itemId];
      if (!db || !db.content) return;
      this.showModal(db.name, db.content);
    },

    showModal(title, body) {
      document.getElementById('modal-title').textContent = title;
      document.getElementById('modal-body').textContent = body;
      document.getElementById('modal').classList.remove('hidden');
    },

    closeModal() {
      document.getElementById('modal').classList.add('hidden');
    },

    takeDamage(amount) {
      const dmg = Math.max(0, Number(amount) || 0);
      this.state.hp = Math.max(0, this.state.hp - dmg);
      if (dmg > 0 && typeof this.checkConcentrationAfterDamage === 'function') {
        this.checkConcentrationAfterDamage(dmg);
      }
      this.updateStats();
      if (this.state.hp <= 0) {
        if (typeof this.clearCombatConcentration === 'function') {
          this.clearCombatConcentration(true);
        }
        this.gameOver();
        return true;
      }
      return false;
    },

    heal(amount) {
      this.state.hp = Math.min(this.state.maxHp, this.state.hp + amount);
      this.updateUI();
    },

    /** Панель надетой экипировки и аксессуаров в сайдбаре */
    renderEquipmentPanel() {
      const panel = document.getElementById('equipment-slots');
      if (!panel) return;

      const mainSlots = [
        { key: 'weapon_main', label: 'Основная рука' },
        { key: 'weapon_off', label: 'Вторая рука', offHand: true },
        { key: 'armor', label: 'Броня' },
        { key: 'shield', label: 'Щит' }
      ];
      const accSlots = [
        { key: 'ring1', label: 'Кольцо 1' },
        { key: 'ring2', label: 'Кольцо 2' },
        { key: 'necklace', label: 'Ожерелье' },
        { key: 'earrings', label: 'Серьги' }
      ];

      const renderSlot = (def) => {
        const key = def.key;
        const label = def.label;
        let itemId = this.getEquippedItemId(key);
        let item = itemId ? this.itemsData[itemId] : null;
        let name = 'Пусто';
        let icon = '—';
        let unequip = '';
        let extraClass = '';

        if (def.offHand && this.isOffHandBlockedByTwoHander()) {
          name = 'Занято двуручным оружием';
          extraClass = ' equip-slot-row--blocked';
        } else if (key === 'weapon_off' && !itemId && this.getEquippedItemId('shield')) {
          itemId = this.getEquippedItemId('shield');
          item = itemId ? this.itemsData[itemId] : null;
          name = item ? `Щит: ${item.name}` : 'Щит';
          icon = item?.icon ? this.escapeHtml(item.icon) : '🛡️';
          unequip = itemId
            ? `<button type="button" class="equip-slot-btn" ${this.onclickGame('unequipItem', 'shield')} title="Снять">✕</button>`
            : '';
        } else {
          if (item) {
            const hands = this.isWeaponItem(item) ? this.getWeaponHands(item) : null;
            icon = item.icon ? this.escapeHtml(item.icon) : (hands === 'two' ? '⚔️' : '🗡️');
            name = item.name + (hands === 'two' ? ' (2 руки)' : '');
          }
          unequip = itemId
            ? `<button type="button" class="equip-slot-btn" ${this.onclickGame('unequipItem', key)} title="Снять">✕</button>`
            : '';
        }

        return `<div class="equip-slot-row${extraClass}">
          <span class="equip-slot-label">${label}</span>
          <span class="equip-slot-icon">${icon}</span>
          <span class="equip-slot-name">${this.escapeHtml(name)}</span>
          ${unequip}
        </div>`;
      };

      let html = '<div class="equip-slots-block"><div class="equip-slots-title">Экипировка</div>';
      html += mainSlots.map((s) => renderSlot(s)).join('');
      html += '</div><div class="equip-slots-block equip-slots-block--accessories">';
      html += '<div class="equip-slots-title">Аксессуары</div>';
      html += accSlots.map((s) => renderSlot({ key: s.key, label: s.label })).join('');
      html += '</div>';
      panel.innerHTML = html;
    },

    /** Блок активных проклятий в сайдбаре */
    renderCurseEffectsPanel() {
      const panel = document.getElementById('curse-effects-panel');
      const list = document.getElementById('curse-effects-list');
      if (!panel || !list) return;

      const active = Object.entries(this.state.curseEffects || {}).filter(([, v]) => v);
      if (!active.length) {
        panel.classList.add('hidden');
        list.innerHTML = '';
        return;
      }

      panel.classList.remove('hidden');
      list.innerHTML = active.map(([id]) => {
        const def = this.CURSE_EFFECT_DEFS[id] || { label: id, icon: '☠️' };
        return `<span class="curse-effect-chip" title="${this.escapeAttr(def.label)}">${def.icon}</span>`;
      }).join('');
    },

    /** Обновление интерфейса сайдбара (статы, инвентарь, квесты и т.д.) */
    updateUI() {
      this.updateStats();
      this.updateAbilityGrid();
      this.renderEquipmentPanel();
      this.renderInv();
      this.renderCurseEffectsPanel();
      this.renderAbilities();
      this.renderProficienciesPanel();
      this.renderTravelMenu();
      this.renderActiveQuests();
      this.renderAchievementsPanel();
      this.initTooltips();
    },

    /** Сайдбар: владения навыками (D&D) или ранги PF2e */
    renderProficienciesPanel() {
      const el = document.getElementById('skills-list');
      if (!el) return;

      if (this.isPf2eMode()) {
        this.migratePf2eSkillsState();
        const entries = Object.entries(this.state.skills || {}).filter(([, r]) => r && r !== 'untrained');
        if (!entries.length) {
          el.textContent = 'Навыки: —';
          return;
        }
        const cd = this.state.classData;
        const stats = cd?.stats || this.state.stats || {};
        const parts = entries.map(([id, rank]) => {
          const ru = this.CharacterCreator?.skillLabel?.(id)
            || this.activeSystem?.getSkillDefs?.()?.[id]?.ru
            || id;
          const bonus = this.activeSystem?.getSkillBonusBreakdown
            ? this.activeSystem.getSkillBonusBreakdown(id, stats, cd, this).total
            : this.getSkillBonus(id);
          const sign = bonus >= 0 ? '+' : '';
          const short = this.getPf2eSkillRankShort(rank);
          return `${ru} (${short} ${sign}${bonus})`;
        });
        el.textContent = `Навыки: ${parts.join(', ')}`;
        return;
      }

      const ids = this.getProficientSkillIds();
      if (!ids.length) {
        el.textContent = 'Владения: —';
        return;
      }
      const prof = this.getProficiencyBonus();
      const profStr = prof >= 0 ? `+${prof}` : String(prof);
      const labels = ids.map(id => {
        const ru = this.CharacterCreator?.skillLabel(id)
          || this.activeSystem?.getSkillDefs?.()?.[id]?.ru
          || id;
        return ru;
      });
      el.textContent = `Владения: ${labels.join(', ')} (${profStr})`;
    },

    /**
     * Список активных квестов в #active-quests-list из state.questStages.
     */
    renderActiveQuests() {
      const container = document.getElementById('active-quests-list');
      if (!container) return;

      const activeEntries = Object.entries(this.state.questStages || {});

      if (activeEntries.length === 0) {
        container.innerHTML = '<div class="hint">У вас пока нет активных заданий.</div>';
        return;
      }

      let html = '';
      activeEntries.forEach(([id, stageKey]) => {
        const quest = this.data?.quests?.[id];
        if (!quest) return;
        if (stageKey === '__failed__' || stageKey === '__finished__') return;

        const stage = QuestSystem.getStageData(quest, stageKey);

        if (!stage || stage.finish || stage.failed) return;

        html += `
        <div class="active-quest-item">
          <div class="quest-title">${this.escapeHtml(quest.title || id)}</div>
          <div class="quest-hint">${this.escapeHtml(stage.hint || 'Задание выполняется...')}</div>
        </div>`;
      });

      container.innerHTML = html || '<div class="hint">Все задания выполнены!</div>';
    },

    updateStats() {
      const hpEl = document.getElementById('hp');
      const maxHpEl = document.getElementById('max-hp');
      const goldEl = document.getElementById('gold');
      const resEl = document.getElementById('resources');
      const supEl = document.getElementById('supplies');
      if (hpEl) hpEl.textContent = this.state.hp;
      if (maxHpEl) maxHpEl.textContent = this.state.maxHp;
      if (goldEl) goldEl.textContent = this.state.gold;
      if (resEl && this.state.resources?.mode === 'energy') {
        resEl.textContent = this.state.resources.current + '/' + this.state.resources.max;
      }
      this.renderSpellSlotsPanel();
      if (supEl) supEl.textContent = this.getSupplyCount();
      const hpBar = document.getElementById('hp-bar-fill');
      if (hpBar) {
        const pct = Math.max(0, (this.state.hp / this.state.maxHp) * 100);
        hpBar.style.width = pct + '%';
      }
      this.renderLevelBar();
      this.renderRelationsPanel();
      this.renderInv();
      if (typeof this.isInWildShape === 'function' && this.isInWildShape()) {
        const beast = typeof this.getActiveBeast === 'function' ? this.getActiveBeast() : null;
        if (beast) this.updateWildShapeStatDisplay?.(beast);
      } else if (this.state.combat && typeof this.getEffectivePlayerAC === 'function') {
        const acEl = document.getElementById('ac-val');
        const atkEl = document.getElementById('atk-val');
        if (acEl) acEl.textContent = this.getEffectivePlayerAC();
        if (atkEl) atkEl.textContent = '+' + this.getEffectivePlayerAtkBonus();
      } else {
        this.recalculateCombatStats();
      }
      this.syncMobileCompactBar();
    },

    setLocation(name) {
      const el = document.getElementById('location');
      if (el) el.textContent = name;
    },

    gameOver() {
      this.showScene('game_over');
    },

    resetGame() {
      if (confirm('Начать новую игру? Текущий прогресс будет сброшен.')) {
        localStorage.removeItem(this.getSaveKey());
      } else {
        return;
      }
      this.state.hp = 25;
      this.state.maxHp = 25;
      this.state.gold = 0;
      this.state.inventory = [];
      this.state.flags = {};
      this.state.combat = null;
      this.state.enemies = [];
      this.state.resources = { mode: 'energy', current: 0, max: 0, spellSlots: null };
      this.state.supplies = 0;
      this.state.itemCharges = {};
      this.state.classData = {};
      this.state.proficiencies = { skills: [] };
      this.state.skills = {};
      this.state.skillIncreases = [];
      this.state.equipped = {};
      this.state.curseEffects = {};
      this.state.itemEnhancements = {};
      this.state.className = '';
      this.state.charName = '';
      this.state.gender = 'male';
      this.state.questStages = {};
      this.state.sceneVisits = {};
      this.state.visitedLocations = {};
      this.state.clearedCombats = {};
      this.state.achievementUnlocks = {};
      this.state.scene = 'start';
      this.initProgressionState();
      this.updateStats();
      this.renderInv();
      const classDisplay = document.getElementById('class-display');
      if (classDisplay) classDisplay.innerHTML = '';
      const abilitiesList = document.getElementById('abilities-list');
      if (abilitiesList) abilitiesList.innerHTML = '';
      const skillsEl = document.getElementById('skills-list');
      if (skillsEl) skillsEl.textContent = '';
      document.getElementById('log').innerHTML = '';
      this.log('--- Начало новой игры ---');
      if (this.CharacterCreator?.open) this.CharacterCreator.open();
      else this.showCharacterCreator();
    },

    // ========== МАГАЗИН ==========
    getJackBuyMenuChoices() {
      const price = (base, label, to) => ({
        text: `${label} (${this.getShopPrice(base, 'rep_village')} зм)`,
        to
      });
      return [
        price(20, '🧪 Купить зелье лечения', 'jack_buy_potion'),
        price(10, '🪢 Купить верёвку', 'jack_buy_rope'),
        price(10, '🍖 Купить припасы', 'jack_buy_supplies'),
        price(15, '📜 Купить свиток Огненного шара', 'jack_buy_fireball_scroll'),
        price(22, '🧿 Купить зелье фокусировки', 'jack_buy_focus_potion'),
        { text: '← В лавку', to: 'jack_shop' }
      ];
    },

    handleJackBuyPotion() {
      const price = this.getShopPrice(20, 'rep_village');
      if (this.state.gold >= price) {
        this.state.gold -= price;
        this.addItem('healing_potion');
        this.updateStats();
        this.log(`Куплено зелье лечения (-${price} зм)`);
        this.setText('Джек протягивает вам бутылочку с рубиновой жидкостью.«Держи. Пей в момент опасности — или после. Главное, не до.»');
      } else {
        this.setText('Джек хмыкает.«Денег маловато, приятель. Приходи, когда карман потяжелеет.»');
      }
      this.setChoices(this.getJackBuyMenuChoices());
    },

    handleJackBuyRope() {
      const price = this.getShopPrice(10, 'rep_village');
      if (this.state.gold >= price) {
        this.state.gold -= price;
        this.addItem('rope');
        this.updateStats();
        this.log(`Куплена верёвка (-${price} зм)`);
        this.setText('Джек снимает с крюка катушку крепкой пеньковой верёвки.«Пятнадцать футов. Выдержит и тебя, и твоего врага, если захочешь его привязать.»');
      } else {
        this.setText('Джек щёлкает по кассе.«Десять золотых, не копейкой меньше. Таковы расценки.»');
      }
      this.setChoices(this.getJackBuyMenuChoices());
    },

    handleJackBuySupplies() {
      const price = this.getShopPrice(10, 'rep_village');
      if (this.state.gold >= price) {
        this.state.gold -= price;
        this.addItem(this.SUPPLY_ITEM_ID);
        this.updateStats();
        this.log(`Куплены припасы (-${price} зм). Всего припасов: ` + this.getSupplyCount());
        this.setText('Джек достаёт свёрток из сухофруктов, орехов и сушёного мяса.«Провиант для путника. Одного свёртка хватит на один полноценный отдых.»');
      } else {
        this.setText('Джек качает головой.«Десять золотых. Припасы — товар дефицитный. Не могу уступить.»');
      }
      this.setChoices(this.getJackBuyMenuChoices());
    },

    handleJackBuyFireballScroll() {
      const price = this.getShopPrice(15, 'rep_village');
      if (this.state.gold >= price) {
        this.state.gold -= price;
        this.addItem('fireball_scroll');
        this.updateStats();
        this.log(`Куплен свиток Огненного шара (-${price} зм)`);
        this.setText('Джек аккуратно вынимает свиток из шкатулки.«Одноразовый. В бою — и пламя сожжёт всех перед тобой. Не жги лавку.»');
      } else {
        this.setText('Джек качает головой.«Пятнадцать золотых за свиток. Магия не в кредит.»');
      }
      this.setChoices(this.getJackBuyMenuChoices());
    },

    handleJackBuyFocusPotion() {
      const price = this.getShopPrice(22, 'rep_village');
      if (this.state.gold >= price) {
        this.state.gold -= price;
        this.addItem('focus_potion');
        this.updateStats();
        this.log(`Куплено зелье фокусировки (-${price} зм)`);
        this.setText('Джек подаёт флакон с мутной синей жидкостью.«Для тех, кто держит сложные заклинания. Час — и мысль ясна, концентрация крепче.»');
      } else {
        this.setText('Джек щёлкает по бутылочке.«Двадцать два золотых. Дешевле, чем потерять боевое заклинание посреди боя.»');
      }
      this.setChoices(this.getJackBuyMenuChoices());
    },
  });
})();
