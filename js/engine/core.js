// ============================================================
// engine/core.js — инициализация, состояние, прогрессия, квесты
// ============================================================
// ============================================
// JSON ДВИЖОК v2.0
// ============================================
// Этот движок читает данные из data/game_data.json
// и строит игру динамически.
// НЕ НУЖНО редактировать этот файл для добавления контента!
// Весь контент — в JSON-файлах.
// ============================================

const GAME_DATA_CACHE_KEY = 'melnitsa_game_data';
const ACTIVE_CAMPAIGN_KEY = 'rpg_active_campaign';

const CAMPAIGNS = {
  melnitsa: {
    id: 'melnitsa',
    title: 'Мельница на Тихой реке',
    subtitle: 'D&D 5e · основная игра',
    description: 'Спасите мельника Альберта. Мельница, погреб, босс Корвин и деревня.',
    badge: 'Основная',
    dataUrl: 'data/game_data.json',
    inlineGlobal: 'GAME_DATA_INLINE',
    cacheKey: GAME_DATA_CACHE_KEY,
    saveKey: 'melnitsa_save',
    pageTitle: 'Мельница на Тихой реке — D&D Solo'
  },
  scifi: {
    id: 'scifi',
    title: 'Станция «Гефест»',
    subtitle: 'Sci-Fi хоррор · generic',
    description: 'Заброшенная орбитальная станция, кислород и сигнал бедствия.',
    badge: 'Демо',
    dataUrl: 'data/demos/scifi-horror-demo.json',
    inlineGlobal: 'DEMO_SCIFI_DATA',
    demoScript: 'js/demo-scifi.js',
    cacheKey: 'rpg_data_cache_scifi',
    saveKey: 'rpg_save_scifi',
    pageTitle: 'Станция Гефест — Demo'
  },
  pf2e: {
    id: 'pf2e',
    title: 'Мельница на Тихой реке',
    subtitle: 'Pathfinder 2e · демо-кампания',
    description: 'Деревня Горнистead: пропавший мельник, святилище фейри, уровни 1–10.',
    badge: 'Демо PF2e',
    dataUrl: 'data/demos/pf2e-mill.json',
    inlineGlobal: 'DEMO_PF2E_DATA',
    demoScript: 'js/demo-pf2e.js',
    expectedCampaignId: 'pf2e_mill',
    dataVersion: 'mill-1.0',
    cacheKey: 'rpg_data_cache_pf2e_mill',
    saveKey: 'rpg_save_pf2e',
    pageTitle: 'Мельница на Тихой реке — PF2e Demo'
  },
  mvp_proof: {
    id: 'mvp_proof',
    title: 'Oakhaven MVP Proof',
    subtitle: 'Hybrid RPG · no-code proof',
    description: 'Деревня → NPC → квест → лес → бой → лут → награда → сохранение. Без author JS.',
    badge: 'MVP Proof',
    dataUrl: 'data/demos/mvp_proof.json',
    inlineGlobal: 'DEMO_MVP_PROOF_DATA',
    demoScript: 'js/demo-mvp-proof.js',
    expectedCampaignId: 'mvp_proof',
    dataVersion: 'mvp-proof-1.0',
    cacheKey: 'rpg_data_cache_mvp_proof',
    saveKey: 'rpg_save_mvp_proof',
    pageTitle: 'Oakhaven MVP Proof'
  }
};


const GameEngine = window.GameEngine || {};
window.GameEngine = GameEngine;

Object.assign(GameEngine, {
    data: null,
    dataSource: null,
    activeCampaignId: null,
    activeSystem: null,
    state: {
      charName: '', className: '', gender: 'male', stats: null, hp: 25, maxHp: 25, gold: 0,
      inventory: [], flags: {}, scene: 'start', combat: null,
      enemies: [], resources: { mode: 'energy', current: 0, max: 0, spellSlots: null },
      supplies: 0, classData: {}, questStages: {},
      questProgress: {},
      equipped: {},
      /** Активные эффекты проклятий с надетых предметов (флаги по ID эффекта) */
      curseEffects: {},
      /** Уровень заточки по ID предмета (сохраняется отдельно от шаблона JSON) */
      itemEnhancements: {},
      level: 1, exp: 0, expAwarded: {}, pendingLevelUp: null, resumeAfterLevelUp: null,
      currentChoices: [],
      sceneVisits: {},
      visitedLocations: {},
      /** Зачищенные боевые сцены: sceneId → { mapLocation, afterScene, label, … } */
      clearedCombats: {},
      /** Владения навыками (id: athletics, perception, …) — D&D 5e */
      proficiencies: { skills: [] },
      /** Ранги навыков PF2e: { athletics: 'trained', … } */
      skills: {},
      /** История повышений навыков PF2e при level-up */
      skillIncreases: [],
      /** Оставшиеся глотки расходников с зарядами (например water_flask) */
      itemCharges: {},
      /** Разблокированные достижения: id → { unlockedAt } */
      achievementUnlocks: {}
    },
    itemMap: {
      "Длинный меч": "longsword",
      "Кольчуга": "chainmail",
      "Щит": "shield",
      "Фляга с водой": "water_flask",
      "Посох": "staff",
      "Роба ученика": "robe",
      "Книга заклинаний": "spellbook",
      "Моргенштерн": "morningstar",
      "Латы": "plate_armor",
      "Святой символ": "holy_symbol"
    },
  
    // ========== СИСТЕМА УРОВНЕЙ (data-driven) ==========
    isProgressionEnabled() {
      return this.data?.progression?.enabled !== false && Array.isArray(this.data?.progression?.expTable);
    },

    getProgression() {
      return this.data?.progression || {};
    },

    /** Предметы: itemsData (алиас data.items) */
    get itemsData() {
      return this.data?.items || {};
    },

    /** Базовые характеристики персонажа (без бонусов экипировки) */
    getBaseStats() {
      return this.state.stats || this.state.classData?.stats || {};
    },

    /** Эффективные характеристики с учётом bonuses предметов */
    getPlayerStats() {
      return this.state._effectiveStats || this.getBaseStats();
    },

    /** Все слоты экипировки (две руки, броня, щит, аксессуары) */
    EQUIPMENT_SLOTS: ['weapon_main', 'weapon_off', 'armor', 'shield', 'ring1', 'ring2', 'necklace', 'earrings'],
    WEAPON_SLOTS: ['weapon_main', 'weapon_off'],

    /** Слоты аксессуаров */
    ACCESSORY_SLOTS: ['ring1', 'ring2', 'necklace', 'earrings'],

    /** Справочник эффектов проклятия (ID → подпись и иконка для UI) */
    CURSE_EFFECT_DEFS: {
      silence: { label: 'Безмолвие', icon: '🤐' },
      weakness: { label: 'Слабость', icon: '💀' },
      poison_touch: { label: 'Ядовитое касание', icon: '☠️' },
      bloodlust: { label: 'Кровожадность', icon: '🩸' },
      haunted: { label: 'Преследование', icon: '👻' }
    },

    initActiveSystem() {
      const systemId = this.data?.meta?.system || this.data?.system || 'dnd5e';
      if (typeof SystemRegistry !== 'undefined') {
        this.activeSystem = SystemRegistry.get(systemId);
      } else if (systemId === 'pf2e' && typeof Pathfinder2eSystem !== 'undefined') {
        this.activeSystem = Pathfinder2eSystem;
      } else if (typeof DnD5eSystem !== 'undefined') {
        this.activeSystem = DnD5eSystem;
      } else {
        this.activeSystem = null;
      }
    },

    isPf2e() {
      return this.activeSystem?.id === 'pf2e';
    },

    getPf2eActionsPerTurn() {
      return this.activeSystem?.getActionsPerTurn?.() ?? 3;
    },

    resetPf2eCombatActions() {
      if (!this.state.combat) return;
      this.state.combat.actionsRemaining = this.getPf2eActionsPerTurn();
      this.state.combat.mapPenalty = 0;
    },

    spendPf2eActions(cost) {
      if (!this.isPf2e() || !this.state.combat) return true;
      const n = Math.max(0, parseInt(cost, 10) || 1);
      const left = this.state.combat.actionsRemaining ?? this.getPf2eActionsPerTurn();
      if (left < n) {
        this.log(`⚡ Недостаточно действий (нужно ${n}, осталось ${left})`, 'log-dice');
        return false;
      }
      this.state.combat.actionsRemaining = left - n;
      return true;
    },

    endPf2ePlayerTurnIfNoActions() {
      if (!this.isPf2e() || !this.state.combat) return false;
      if ((this.state.combat.actionsRemaining ?? 0) > 0) return false;
      this.state.combat.turnIndex++;
      setTimeout(() => this.nextCombatTurn(), 600);
      return true;
    },

    getProficiencyBonus() {
      const level = Math.max(1, parseInt(this.state.level, 10) || 1);
      if (this.activeSystem?.getProficiencyBonus) {
        return this.activeSystem.getProficiencyBonus(level);
      }
      return Math.max(2, 2 + Math.floor((level - 1) / 4));
    },

    /** Категория аксессуара: ring | necklace | earrings (legacy: accessory → ring) */
    getAccessoryCategory(item) {
      if (!item) return null;
      if (item.type === 'accessory') return item.slot || 'ring';
      if (item.equippable) {
        if (item.slot === 'accessory') return 'ring';
        if (['ring', 'necklace', 'earrings'].includes(item.slot)) return item.slot;
      }
      return null;
    },

    isAccessoryItem(item) {
      if (!item) return false;
      if (item.type === 'accessory') return true;
      return !!(item.equippable && this.getAccessoryCategory(item));
    },

    /**
     * Слот для кольца: ring1, если занят — ring2; ожерелье/серьги — отдельные слоты.
     */
    resolveAccessoryEquipSlot(item) {
      const cat = this.getAccessoryCategory(item);
      if (cat === 'necklace') return 'necklace';
      if (cat === 'earrings') return 'earrings';
      const eq = this.state.equipped || {};
      if (!eq.ring1) return 'ring1';
      if (!eq.ring2) return 'ring2';
      return 'ring2';
    },

    /** Одноручное / двуручное (по умолчанию одноручное) */
    getWeaponHands(item) {
      if (!this.isWeaponItem(item)) return null;
      const h = String(item?.hands || 'one').toLowerCase();
      return h === 'two' ? 'two' : 'one';
    },

    isTwoHandedWeapon(item) {
      return this.getWeaponHands(item) === 'two';
    },

    /** Слот экипировки: weapon_main | weapon_off | armor | shield | аксессуары */
    getEquipSlot(item, preferredSlot) {
      if (!item) return null;
      if (this.isAccessoryItem(item)) return this.resolveAccessoryEquipSlot(item);
      if (this.isWeaponItem(item)) {
        if (preferredSlot === 'weapon_main' || preferredSlot === 'weapon_off') return preferredSlot;
        return 'weapon_main';
      }
      if (item.type === 'armor' || item.slot === 'armor') return 'armor';
      if (item.type === 'shield' || item.slot === 'shield' || item.slot === 'offhand') return 'shield';
      return null;
    },

    isWeaponItem(item) {
      if (!item) return false;
      if (item.type === 'weapon') return true;
      return item.type === 'equipment' && item.slot === 'weapon';
    },

    isArmorItem(item) {
      if (!item) return false;
      if (item.type === 'armor') return true;
      return item.type === 'equipment' && item.slot === 'armor';
    },

    isShieldItem(item) {
      if (!item) return false;
      if (item.type === 'shield') return true;
      return item.type === 'equipment' && (item.slot === 'shield' || item.slot === 'offhand');
    },

    isGameplayEquippable(item) {
      return this.isWeaponItem(item) || this.isArmorItem(item) || this.isShieldItem(item);
    },

    isEquippableItem(item) {
      if (!item) return false;
      if (this.isGameplayEquippable(item)) return true;
      return this.isAccessoryItem(item);
    },

    isItemEquipped(itemId) {
      const eq = this.state.equipped || {};
      return this.EQUIPMENT_SLOTS.some(slot => eq[slot] === itemId)
        || eq.weapon === itemId
        || eq.offhand === itemId
        || eq.accessory === itemId;
    },

    getEquippedItemId(slot) {
      const eq = this.state.equipped || {};
      if (slot === 'weapon') return eq.weapon_main || eq.weapon || null;
      if (slot === 'weapon_main') return eq.weapon_main || eq.weapon || null;
      if (slot === 'shield') return eq.shield || eq.offhand || null;
      return eq[slot] || null;
    },

    clearEquipSlot(slot, opts = {}) {
      if (!this.state.equipped) return;
      const id = this.getEquippedItemId(slot);
      if (!id) return;
      delete this.state.equipped[slot];
      if (slot === 'shield') delete this.state.equipped.offhand;
      if (!opts.silent) {
        const db = this.itemsData[id];
        this.log(`Снято: ${db?.name || id}`, 'log-dice');
      }
    },

    hasDualWieldSetup() {
      const mainId = this.getEquippedItemId('weapon_main');
      const offId = this.getEquippedItemId('weapon_off');
      if (!mainId || !offId) return false;
      const main = this.itemsData[mainId];
      const off = this.itemsData[offId];
      return this.isOneHandedWeapon(main) && this.isOneHandedWeapon(off);
    },

    isOneHandedWeapon(item) {
      return this.isWeaponItem(item) && this.getWeaponHands(item) === 'one';
    },

    isOffHandBlockedByTwoHander() {
      const mainId = this.getEquippedItemId('weapon_main');
      if (!mainId) return false;
      return this.isTwoHandedWeapon(this.itemsData[mainId]);
    },

    getOffHandSlotLabel() {
      if (this.isOffHandBlockedByTwoHander()) {
        return 'Занято двуручным оружием';
      }
      const shieldId = this.getEquippedItemId('shield');
      if (shieldId) {
        const sh = this.itemsData[shieldId];
        return sh?.name ? `Щит: ${sh.name}` : 'Щит';
      }
      const offId = this.getEquippedItemId('weapon_off');
      if (offId) {
        const w = this.itemsData[offId];
        return w?.name || 'Оружие';
      }
      return 'Пусто';
    },

    /** Дефолты заточки, если в JSON предмета не заданы поля */
    DEFAULT_ENHANCEMENT_MAX: 3,
    DEFAULT_ENHANCEMENT_COSTS: [100, 300, 900],
    ENHANCEMENT_SLOTS: ['weapon_main', 'armor', 'shield'],

    /** Текущий уровень +N предмета (0, если не заточен) */
    getItemEnhancementLevel(itemId) {
      if (!itemId) return 0;
      if (this.state.itemEnhancements?.[itemId] != null) {
        return Math.max(0, parseInt(this.state.itemEnhancements[itemId], 10) || 0);
      }
      const template = this.itemsData?.[itemId];
      return Math.max(0, parseInt(template?.enhancement, 10) || 0);
    },

    setItemEnhancementLevel(itemId, level) {
      if (!itemId) return;
      if (!this.state.itemEnhancements) this.state.itemEnhancements = {};
      this.state.itemEnhancements[itemId] = Math.max(0, parseInt(level, 10) || 0);
    },

    getItemEnhancementMax(item) {
      if (!item) return this.DEFAULT_ENHANCEMENT_MAX;
      const m = item.enhancementMax;
      return m != null ? Math.max(0, parseInt(m, 10) || 0) : this.DEFAULT_ENHANCEMENT_MAX;
    },

    getItemEnhancementCosts(item) {
      const costs = item?.enhancementCost;
      if (Array.isArray(costs) && costs.length) {
        return costs.map(c => Math.max(0, parseInt(c, 10) || 0));
      }
      return [...this.DEFAULT_ENHANCEMENT_COSTS];
    },

    /** Стоимость следующего уровня заточки (+1 → индекс 0) */
    getNextEnhancementCost(itemId) {
      const template = this.itemsData?.[itemId];
      if (!template) return null;
      const current = this.getItemEnhancementLevel(itemId);
      const session = this.state.blacksmithSession;
      const max = session?.maxEnhancement != null
        ? Math.min(this.getItemEnhancementMax(template), Number(session.maxEnhancement))
        : this.getItemEnhancementMax(template);
      if (current >= max) return null;
      if (session?.costTable && session.costTable[current] != null) {
        return Number(session.costTable[current]);
      }
      const costs = this.getItemEnhancementCosts(template);
      return costs[current] ?? costs[costs.length - 1] ?? this.DEFAULT_ENHANCEMENT_COSTS[current] ?? null;
    },

    /** Шаблон предмета + актуальный enhancement из сохранения */
    getEffectiveItemData(itemId) {
      const base = this.itemsData?.[itemId];
      if (!base) return null;
      return {
        ...base,
        enhancement: this.getItemEnhancementLevel(itemId)
      };
    },

    getEquippedItem(slot) {
      const id = this.getEquippedItemId(slot);
      return id ? this.getEffectiveItemData(id) : null;
    },

    getEquippedWeaponId(cls) {
      const eq = this.getEquippedItemId('weapon_main');
      if (eq) return eq;
      const items = this.itemsData;
      if (cls?.mainWeapon && items[cls.mainWeapon]) return cls.mainWeapon;
      const fromInv = (this.state.inventory || []).find(id => this.isWeaponItem(items[id]));
      if (fromInv) return fromInv;
      return (cls?.startingItems || []).find(id => this.isWeaponItem(items[id])) || null;
    },

    migrateEquippedSlots() {
      const eq = this.state.equipped || {};
      if (eq.weapon && !eq.weapon_main) {
        eq.weapon_main = eq.weapon;
        delete eq.weapon;
      }
      if (eq.offhand && !eq.shield) {
        eq.shield = eq.offhand;
        delete eq.offhand;
      }
      this.WEAPON_SLOTS.forEach((slot) => {
        if (!(slot in eq)) eq[slot] = null;
      });
      // Старые сохранения: нет слотов аксессуаров — null
      this.ACCESSORY_SLOTS.forEach(slot => {
        if (!(slot in eq)) eq[slot] = null;
      });
      // Legacy: один слот accessory → ring1 или ring2
      if (eq.accessory) {
        if (!eq.ring1) eq.ring1 = eq.accessory;
        else if (!eq.ring2) eq.ring2 = eq.accessory;
        delete eq.accessory;
      }
      this.state.equipped = eq;
    },

    /**
     * bonuses предмета + заточка (enhancement):
     * оружие: atkBonus, dmgBonus; броня/щит: acBonus.
     */
    getItemBonuses(item) {
      const b = (item?.bonuses && typeof item.bonuses === 'object') ? { ...item.bonuses } : {};
      const enh = parseInt(item?.enhancement, 10) || 0;
      if (enh > 0 && this.isWeaponItem(item)) {
        b.atkBonus = (b.atkBonus || 0) + enh;
        b.dmgBonus = (b.dmgBonus || 0) + enh;
      }
      if (enh > 0 && (this.isArmorItem(item) || this.isShieldItem(item))) {
        b.acBonus = (b.acBonus || 0) + enh;
      }
      return b;
    },

    /** Экипированные слоты, доступные для заточки в кузнице */
    getBlacksmithEnhanceableEntries() {
      const entries = [];
      for (const slot of this.ENHANCEMENT_SLOTS) {
        const itemId = this.getEquippedItemId(slot);
        if (!itemId) continue;
        const item = this.getEffectiveItemData(itemId);
        if (!item) continue;
        if (!this.isWeaponItem(item) && !this.isArmorItem(item) && !this.isShieldItem(item)) continue;
        const current = this.getItemEnhancementLevel(itemId);
        const max = this.getItemEnhancementMax(item);
        const cost = this.getNextEnhancementCost(itemId);
        if (cost == null) continue;
        entries.push({
          slot,
          itemId,
          name: item.name || itemId,
          current,
          next: current + 1,
          max,
          cost
        });
      }
      return entries;
    },

    /** Сумма bonuses по всем слотам экипировки */
    collectEquipmentBonuses() {
      const totals = {
        str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0,
        maxHpBonus: 0, acBonus: 0, atkBonus: 0, dmgBonus: 0
      };
      for (const slot of this.EQUIPMENT_SLOTS) {
        const item = this.getEquippedItem(slot);
        if (!item) continue;
        const b = this.getItemBonuses(item);
        for (const [key, raw] of Object.entries(b)) {
          const val = Number(raw) || 0;
          if (this.STAT_KEYS.includes(key)) totals[key] += val;
          else if (key === 'maxHpBonus') totals.maxHpBonus += val;
          else if (key === 'acBonus') totals.acBonus += val;
          else if (key === 'atkBonus') totals.atkBonus += val;
          else if (key === 'dmgBonus') totals.dmgBonus += val;
        }
      }
      return totals;
    },

    /** baseMaxHp для старых сохранений: вычитаем бонусы экипировки из текущего maxHp */
    ensureBaseMaxHp() {
      if (this.state.baseMaxHp != null) return;
      const bonuses = this.collectEquipmentBonuses();
      this.state.baseMaxHp = Math.max(1, (this.state.maxHp || 1) - bonuses.maxHpBonus);
    },

    getInventoryCategory(item) {
      const t = item?.type;
      if (t === 'consumable' || t === 'key' || t === 'quest') return t;
      if (t === 'accessory' || t === 'weapon' || t === 'armor' || t === 'shield' || t === 'equipment') return 'equipment';
      if (t === 'readable') return 'quest';
      if (item?.useAbility || item?.use) return 'consumable';
      return 'equipment';
    },

    getShieldAcBonus() {
      const shield = this.getEquippedItem('shield');
      if (!shield || !this.isShieldItem(shield)) return 0;
      return parseInt(shield.acBonus, 10) || 0;
    },

    /** Пассивные бонусы из изученных умений (пересчитываются при каждом recalcDerivedStats) */
    collectPassiveAbilityBonuses() {
      const totals = { acBonus: 0, atkBonus: 0, maxHpBonus: 0 };
      const abilities = this.state.classData?.abilities || [];
      abilities.forEach(ab => {
        if (ab.type !== 'passive' && !ab.passive) return;
        const p = ab.passive;
        if (!p || typeof p !== 'object') return;

        if (p.acBonus) {
          const n = parseInt(p.acBonus, 10) || 0;
          if (n && this.isPassiveAcBonusActive(ab)) totals.acBonus += n;
        }
        if (p.atkBonus) {
          const n = parseInt(p.atkBonus, 10) || 0;
          if (n) totals.atkBonus += n;
        }
        if (p.maxHpBonus) {
          const n = parseInt(p.maxHpBonus, 10) || 0;
          if (n) totals.maxHpBonus += n;
        }
      });
      return totals;
    },

    /** Условия пассивного бонуса к КД (например «Мастер щита» только со щитом) */
    isPassiveAcBonusActive(ability) {
      const id = ability?.id;
      const p = ability?.passive;
      if (id === 'shield_master' || p?.requiresShield === true) {
        const shield = this.getEquippedItem('shield');
        return !!(shield && this.isShieldItem(shield));
      }
      return true;
    },

    /** КД по D&D 5e: броня + щит, иначе 10 + DEX + щит */
    computePlayerAC() {
      const stats = this.getPlayerStats();
      if (this.activeSystem?.calculateAC) {
        return this.activeSystem.calculateAC(
          stats,
          { itemsData: this.itemsData, getEquippedItem: (slot) => this.getEquippedItem(slot) },
          this.data,
          this
        );
      }
      const dexMod = this.getModifier(stats.dex ?? 10);
      const shieldBonus = this.getShieldAcBonus();
      const armor = this.getEquippedItem('armor');

      if (armor && this.isArmorItem(armor)) {
        const baseAc = parseInt(armor.ac ?? armor.baseAc, 10);
        if (!isNaN(baseAc)) {
          const armorType = String(armor.armorType || 'heavy').toLowerCase();
          let ac = baseAc;
          if (armorType === 'light') ac += dexMod;
          else if (armorType === 'medium') ac += Math.min(dexMod, 2);
          return ac + shieldBonus;
        }
      }

      return 10 + dexMod + shieldBonus;
    },

    canWearArmor(item) {
      if (!item || !this.isArmorItem(item)) return true;
      const req = parseInt(item.strRequirement, 10);
      if (!req) return true;
      const str = parseInt(this.getPlayerStats().str, 10) || 10;
      return str >= req;
    },

    /** Профиль урона/атаки для слота weapon_main | weapon_off */
    getWeaponAttackProfile(slot = 'weapon_main') {
      const stats = this.getPlayerStats();
      const prof = this.getProficiencyBonus();
      const passiveBonuses = this.collectPassiveAbilityBonuses();
      const levelBonuses = this.collectProgressionLevelBonuses();
      const equipBonuses = this.collectEquipmentBonuses();
      const weaponId = this.getEquippedItemId(slot);
      const weapon = weaponId ? this.itemsData[weaponId] : null;

      if (!weapon || !this.isWeaponItem(weapon)) {
        if (slot === 'weapon_off') return null;
        const strMod = this.getModifier(stats.str ?? 10);
        return {
          dmgRoll: '1',
          dmgBonus: strMod + equipBonuses.dmgBonus,
          atkBonus: prof + strMod + equipBonuses.atkBonus + passiveBonuses.atkBonus + levelBonuses.atkBonus,
          statKey: 'str',
          weaponName: 'Кулаки',
          weaponId: null,
          isOffHand: false
        };
      }

      const statKey = String(weapon.stat || 'str').toLowerCase();
      const statMod = this.getModifier(stats[statKey] ?? 10);
      const itemBonuses = this.getItemBonuses(weapon);
      const dmgRoll = weapon.damage || weapon.dmgRoll || '1d6';

      if (slot === 'weapon_off') {
        return {
          dmgRoll,
          dmgBonus: (itemBonuses.dmgBonus || 0),
          atkBonus: statMod + (itemBonuses.atkBonus || 0),
          statKey,
          weaponName: weapon.name || 'Оружие',
          weaponId,
          isOffHand: true
        };
      }

      const isRanged =
        typeof CombatPosition !== 'undefined' &&
        CombatPosition.isWeaponRanged(weapon);

      return {
        dmgRoll,
        dmgBonus: statMod + (itemBonuses.dmgBonus || 0) + equipBonuses.dmgBonus,
        atkBonus: prof + statMod + (itemBonuses.atkBonus || 0) + equipBonuses.atkBonus
          + passiveBonuses.atkBonus + levelBonuses.atkBonus,
        statKey,
        weaponName: weapon.name || 'Оружие',
        weaponId,
        isOffHand: false,
        isRanged: !!isRanged
      };
    },

    /** Профиль атаки по ID предмета (лук из инвентаря, не экипирован) */
    getWeaponAttackProfileFromItem(itemId) {
      const weapon = this.itemsData?.[itemId] || this.data?.items?.[itemId];
      if (!weapon || !this.isWeaponItem(weapon)) return null;
      const stats = this.getPlayerStats();
      const prof = this.getProficiencyBonus();
      const passiveBonuses = this.collectPassiveAbilityBonuses();
      const levelBonuses = this.collectProgressionLevelBonuses();
      const equipBonuses = this.collectEquipmentBonuses();
      const statKey = String(weapon.stat || 'dex').toLowerCase();
      const statMod = this.getModifier(stats[statKey] ?? 10);
      const itemBonuses = this.getItemBonuses(weapon);
      const isRanged =
        typeof CombatPosition !== 'undefined' && CombatPosition.isWeaponRanged(weapon);
      return {
        dmgRoll: weapon.damage || weapon.dmgRoll || '1d6',
        dmgBonus: statMod + (itemBonuses.dmgBonus || 0) + equipBonuses.dmgBonus,
        atkBonus:
          prof + statMod + (itemBonuses.atkBonus || 0) + equipBonuses.atkBonus
          + passiveBonuses.atkBonus + levelBonuses.atkBonus,
        statKey,
        weaponName: weapon.name || 'Оружие',
        weaponId: itemId,
        isOffHand: false,
        isRanged: !!isRanged
      };
    },

    /** Урон основной руки для панели статов (classData) */
    computeWeaponDamageProfile() {
      const p = this.getWeaponAttackProfile('weapon_main');
      if (!p) {
        const stats = this.getPlayerStats();
        const strMod = this.getModifier(stats.str ?? 10);
        return {
          dmgRoll: '1',
          dmgBonus: strMod,
          statKey: 'str',
          weaponName: 'Кулаки',
          weaponId: null
        };
      }
      return {
        dmgRoll: p.dmgRoll,
        dmgBonus: p.dmgBonus,
        statKey: p.statKey,
        weaponName: p.weaponName,
        weaponId: p.weaponId
      };
    },

    rollWeaponDamage(profile, critical = false) {
      if (!profile) return 0;
      let dice = this.parseRoll(profile.dmgRoll || '1');
      if (critical) dice += this.parseRoll(profile.dmgRoll || '1');
      let total = dice + (profile.dmgBonus ?? 0);
      const combat = this.state.combat;
      if (combat?.tempDmgBonus) total += Number(combat.tempDmgBonus) || 0;
      if (critical && (this.state.classData?.abilities || []).some((a) => a.id === 'barbarian_brutal_critical')) {
        total += this.parseRoll('1d6');
      }
      return total;
    },

    getClassResourceConfig(classKey) {
      classKey = classKey || this.state.className;
      return this.data?.classes?.[classKey]?.resource || null;
    },

    getClassResourceMax(classKey, level) {
      const cls = this.data?.classes?.[classKey];
      const res = cls?.resource;
      const lvl = Math.max(1, parseInt(level, 10) || 1);
      const stats = this.state.stats || this.state.classData?.stats || cls?.stats || {};
      const mod = (stat) => this.getModifier(stats[stat] ?? 10);

      if (res?.formula === 'rage') return Math.max(1, 2 + mod('con'));
      if (res?.formula === 'charisma') return Math.max(1, mod('cha'));
      if (res?.formula === 'wild_shape') return 2;
      if (res?.formula === 'level') return Math.max(0, lvl);

      const arr = this.getSlotsArrayForLevel(classKey, lvl);
      if (arr?.length === 1 && !cls?.spellcasting && !cls?.pactMagic) {
        return Math.max(0, Number(arr[0]) || res?.max || 0);
      }
      return res?.max ?? 2;
    },

    getWarlockPactSlots(level) {
      const lvl = Math.max(1, parseInt(level, 10) || 1);
      const count = lvl >= 2 ? 2 : 1;
      const slotLevel = Math.min(5, Math.max(1, Math.ceil(lvl / 2)));
      return { count, slotLevel };
    },

    buildWarlockSpellSlots(level) {
      const { count, slotLevel } = this.getWarlockPactSlots(level);
      return { [String(slotLevel)]: { c: count, m: count } };
    },

    playerHasExtraAttack() {
      return (this.state.classData?.abilities || []).some(
        (a) => a.passive?.extraAttack
          || a.id === 'barbarian_extra_attack'
          || a.id === 'monk_extra_attack'
      );
    },

    DEFAULT_CREATURE_TYPES: {
      beast: 'Звери',
      humanoid: 'Гуманоиды',
      giant: 'Великаны',
      elemental: 'Элементали'
    },

    getCreatureTypeCatalog() {
      const raw = this.data?.creatureTypes;
      const src = raw && typeof raw === 'object' && Object.keys(raw).length
        ? raw
        : this.DEFAULT_CREATURE_TYPES;
      return Object.keys(src).map((id) => ({
        id,
        label: typeof src[id] === 'string' ? src[id] : (src[id]?.name || id)
      }));
    },

    getCreatureTypeLabel(typeId) {
      if (!typeId) return '';
      const row = this.getCreatureTypeCatalog().find((t) => t.id === typeId);
      return row?.label || typeId;
    },

    getDefaultCreatureType() {
      const ids = this.getCreatureTypeCatalog().map((t) => t.id);
      return ids.includes('humanoid') ? 'humanoid' : (ids[0] || 'humanoid');
    },

    getEnemyCreatureType(enemy) {
      if (!enemy) return this.getDefaultCreatureType();
      if (enemy.creatureType) return enemy.creatureType;
      const tplId = enemy.id || enemy.templateId;
      if (tplId && this.data?.enemies?.[tplId]?.creatureType) {
        return this.data.enemies[tplId].creatureType;
      }
      return this.getDefaultCreatureType();
    },

    hasPlayerAbility(abilityId) {
      return !!this.state.classData?.abilities?.some((a) => a.id === abilityId);
    },

    getMaxFavoredEnemyTypes() {
      let max = 0;
      if (this.hasPlayerAbility('ranger_favored_enemy_base')) max = 1;
      if (this.hasPlayerAbility('ranger_favored_enemy')) max = 2;
      return max;
    },

    formatFavoredEnemyTypesList() {
      const types = this.state.favoredEnemyTypes || [];
      if (!types.length) return '';
      return types.map((t) => this.getCreatureTypeLabel(t)).join(', ');
    },

    getAbilityDisplayDesc(ab) {
      if (!ab) return '';
      let desc = ab.desc || '';
      if (ab.id === 'ranger_favored_enemy_base' || ab.id === 'ranger_favored_enemy') {
        const picked = this.formatFavoredEnemyTypesList();
        if (picked) desc += (desc ? ' ' : '') + `Выбрано: ${picked}.`;
      }
      return desc;
    },

    getFavoredEnemyDamageBonus(enemy) {
      if (!this.hasPlayerAbility('ranger_favored_enemy')) return 0;
      const types = this.state.favoredEnemyTypes || [];
      if (!types.length || !enemy) return 0;
      return types.includes(this.getEnemyCreatureType(enemy)) ? 2 : 0;
    },

    addFavoredEnemyDamageToHit(enemy, baseDamage) {
      const bonus = this.getFavoredEnemyDamageBonus(enemy);
      return { total: baseDamage + bonus, bonus };
    },

    favoredEnemyDamageNote(bonus) {
      if (!bonus) return '';
      return ` (+${bonus} избр. враг)`;
    },

    migrateFavoredEnemyState() {
      if (this.state.className !== 'ranger') return;
      if (!this.getMaxFavoredEnemyTypes()) return;
      const cur = (this.state.favoredEnemyTypes || []).length;
      const max = this.getMaxFavoredEnemyTypes();
      if (cur >= max) return;
      if (this.state.pendingLevelUp || this.state.pendingFavoredEnemyPick) return;
      this.state.pendingFavoredEnemyPick = true;
      setTimeout(() => {
        if (!this.state.pendingFavoredEnemyPick) return;
        this.showFavoredEnemyPickModal({
          pickCount: max - cur,
          title: 'Избранные враги',
          intro: 'Выберите тип существ для умения «Избранный враг».',
          onDone: () => {
            this.state.pendingFavoredEnemyPick = false;
            this.saveGame();
          }
        });
      }, 400);
    },

    showFavoredEnemyPickModal(opts = {}) {
      const pickCount = Math.max(1, parseInt(opts.pickCount, 10) || 1);
      const catalog = this.getCreatureTypeCatalog();
      const modal = document.getElementById('levelup-modal') || document.getElementById('modal');
      const titleEl = document.getElementById('levelup-title') || document.getElementById('modal-title');
      const textEl = document.getElementById('levelup-text') || document.getElementById('modal-body');
      const choicesEl = document.getElementById('levelup-choices');
      const useLevelUpShell = !!(document.getElementById('levelup-modal') && choicesEl);

      if (!modal || (!choicesEl && !textEl)) {
        if (typeof opts.onDone === 'function') opts.onDone();
        return;
      }

      const existing = Array.isArray(this.state.favoredEnemyTypes)
        ? [...this.state.favoredEnemyTypes]
        : [];
      const selection = [];
      const maxTotal = this.getMaxFavoredEnemyTypes() || (existing.length + pickCount);

      const renderBody = () => {
        const need = pickCount;
        const pickedLabels = selection.map((id) => this.getCreatureTypeLabel(id)).join(', ') || '—';
        const chips = catalog.map((t) => {
          const on = selection.includes(t.id);
          const disabled = !on && selection.length >= need;
          return `<button type="button" class="choice favored-type-chip${on ? ' active' : ''}" data-type="${this.escapeAttr(t.id)}" ${disabled ? 'disabled' : ''}>${this.escapeHtml(t.label)}</button>`;
        }).join('');
        const html = `
          <p>${this.escapeHtml(opts.intro || `Выберите ${need === 1 ? 'тип' : need + ' типа'} существ (осталось: ${need - selection.length}).`)}</p>
          <p><strong>Выбрано сейчас:</strong> ${this.escapeHtml(pickedLabels)}</p>
          <div class="favored-type-grid" style="display:flex;flex-wrap:wrap;gap:8px;margin:12px 0;">${chips}</div>
          <button type="button" class="choice" id="favored-type-confirm" ${selection.length < need ? 'disabled style="opacity:0.5;"' : ''}>Подтвердить</button>`;
        if (useLevelUpShell) {
          if (textEl) textEl.textContent = '';
          choicesEl.innerHTML = html;
          choicesEl.querySelectorAll('.favored-type-chip').forEach((btn) => {
            btn.onclick = () => {
              const tid = btn.getAttribute('data-type');
              const idx = selection.indexOf(tid);
              if (idx >= 0) selection.splice(idx, 1);
              else if (selection.length < need) selection.push(tid);
              renderBody();
            };
          });
          const confirm = choicesEl.querySelector('#favored-type-confirm');
          if (confirm) {
            confirm.onclick = () => {
              if (selection.length < need) return;
              const merged = [...existing];
              selection.forEach((t) => {
                if (!merged.includes(t) && merged.length < maxTotal) merged.push(t);
              });
              this.state.favoredEnemyTypes = merged.slice(0, maxTotal);
              this.log(`🐺 Избранные враги: ${this.formatFavoredEnemyTypesList()}`, 'log-heal');
              this.renderAbilities();
              modal.classList.add('hidden');
              if (typeof opts.onDone === 'function') opts.onDone();
            };
          }
        } else if (textEl) {
          textEl.innerHTML = html;
          textEl.querySelectorAll('.favored-type-chip').forEach((btn) => {
            btn.onclick = () => {
              const tid = btn.getAttribute('data-type');
              const idx = selection.indexOf(tid);
              if (idx >= 0) selection.splice(idx, 1);
              else if (selection.length < need) selection.push(tid);
              renderBody();
            };
          });
          const confirm = textEl.querySelector('#favored-type-confirm');
          if (confirm) {
            confirm.onclick = () => {
              if (selection.length < need) return;
              const merged = [...existing];
              selection.forEach((t) => {
                if (!merged.includes(t) && merged.length < maxTotal) merged.push(t);
              });
              this.state.favoredEnemyTypes = merged.slice(0, maxTotal);
              this.log(`🐺 Избранные враги: ${this.formatFavoredEnemyTypesList()}`, 'log-heal');
              this.renderAbilities();
              this.closeModal();
              if (typeof opts.onDone === 'function') opts.onDone();
            };
          }
        }
      };

      if (titleEl) titleEl.textContent = opts.title || 'Избранные враги';
      modal.classList.remove('hidden');
      renderBody();
    },

    buildCombatAttackButtonsForEnemy(enemyIndex) {
      const enemy = this.state.enemies[enemyIndex];
      if (!enemy || enemy.hp <= 0) return '';
      const eac = this.getEffectiveEnemyAC(enemy);
      const name = this.escapeHtml(this.getEnemyDisplayName(enemy));
      const dual = this.hasDualWieldSetup();
      const zoneTip =
        typeof CombatPosition !== 'undefined'
          ? ` [${CombatPosition.getZoneLabel(CombatPosition.getEnemyPosition(this, enemyIndex))}]`
          : '';
      let html = '';

      const appendWeaponAttack = (slot, labelPrefix, icon, useBonusAction) => {
        const profile = slot.startsWith('inv:')
          ? this.getWeaponAttackProfileFromItem(slot.slice(4))
          : this.getWeaponAttackProfile(slot);
        if (!profile) return;
        const rangeType =
          typeof CombatPosition !== 'undefined'
            ? CombatPosition.getWeaponRangeType(this, profile)
            : 'melee';
        const zoneCheck =
          typeof CombatPosition !== 'undefined'
            ? CombatPosition.validateAttack(this, {
                enemyIndex,
                rangeType
              })
            : { valid: true };
        const wLabel = this.escapeHtml(profile.weaponName || 'Оружие');
        if (this.attackRequiresArrows(profile) && this.getArrowCount() <= 0) {
          html += `<button type="button" class="choice" disabled style="opacity:0.55;cursor:not-allowed;" title="Нет стрел">🏹 ${wLabel} → ${name}${zoneTip} (нет стрел)</button>`;
          return;
        }
        if (!zoneCheck.valid) {
          html += `<button type="button" class="choice" disabled style="opacity:0.55;cursor:not-allowed;" title="${this.escapeAttr(zoneCheck.reason)}">${icon ? `${icon} ` : ''}${labelPrefix}${wLabel} → ${name}${zoneTip}</button>`;
          return;
        }
        const modNote =
          zoneCheck.modifiers?.notes?.length
            ? ` · ${zoneCheck.modifiers.notes.join('; ')}`
            : '';
        const onclick = `GameEngine.playerAttack(${enemyIndex},'${this.escapeAttr(slot)}')`;
        const iconPart = icon ? `${icon} ` : '';
        html += `<button type="button" class="choice" onclick="${onclick}" title="${this.escapeAttr(modNote || '')}">${iconPart}${labelPrefix}${wLabel} → ${name}${zoneTip} (КД ${eac})</button>`;
      };

      const mainProfile = this.getWeaponAttackProfile('weapon_main');
      const mainRangeType =
        typeof CombatPosition !== 'undefined' && mainProfile
          ? CombatPosition.getWeaponRangeType(this, mainProfile)
          : 'melee';
      const mainIsRanged =
        mainRangeType === 'ranged' || mainRangeType === 'spell';

      if (mainIsRanged) {
        appendWeaponAttack('weapon_main', '', '🏹', false);
      } else if (!dual) {
        appendWeaponAttack('weapon_main', 'Атаковать ', '⚔️', false);
      } else {
        appendWeaponAttack('weapon_main', 'Основная ', '⚔️', false);
        const offProfile = this.getWeaponAttackProfile('weapon_off');
        if (offProfile) {
          const bonusSpent = !!this.state.combat?.bonusActionSpent;
          const offRangeType =
            typeof CombatPosition !== 'undefined'
              ? CombatPosition.getWeaponRangeType(this, offProfile)
              : 'melee';
          const offCheck =
            typeof CombatPosition !== 'undefined'
              ? CombatPosition.validateAttack(this, {
                  enemyIndex,
                  rangeType: offRangeType
                })
              : { valid: true };
          const offLabel = this.escapeHtml(offProfile.weaponName || 'вторая рука');
          if (!offCheck.valid || bonusSpent) {
            const title = !offCheck.valid
              ? offCheck.reason
              : 'Бонусное действие потрачено';
            html += `<button type="button" class="choice" disabled style="opacity:0.55;" title="${this.escapeAttr(title)}">🗡 ${offLabel} → ${name}</button>`;
          } else {
            html += `<button type="button" class="choice" onclick="GameEngine.playerAttack(${enemyIndex},'weapon_off')">🗡 ${offLabel} → ${name}</button>`;
          }
        }
      }

      const rangedIds = new Set();
      ['weapon_main', 'weapon_off'].forEach((slot) => {
        const id = this.getEquippedItemId(slot);
        const w = id ? this.itemsData[id] || this.data?.items?.[id] : null;
        if (id && w && typeof CombatPosition !== 'undefined' && CombatPosition.isWeaponRanged(w)) {
          rangedIds.add(id);
        }
      });
      (this.state.inventory || []).forEach((itemId) => {
        const w = this.itemsData[itemId] || this.data?.items?.[itemId];
        if (!w || !this.isWeaponItem(w)) return;
        if (typeof CombatPosition !== 'undefined' && !CombatPosition.isWeaponRanged(w)) return;
        if (rangedIds.has(itemId)) return;
        rangedIds.add(itemId);
        appendWeaponAttack(`inv:${itemId}`, '', '🏹', false);
      });

      if (!html) {
        html = `<button type="button" class="choice" disabled style="opacity:0.55;">⚔️ Нет доступной атаки</button>`;
      }
      return html;
    },

    /** true, если в основной руке нет оружия (кулаки) */
    isUnarmedMainHand(stats) {
      const s = stats || this.state.classData;
      if (!s) return false;
      if (s.weaponId) return false;
      return s.weaponName === 'Кулаки' || s.weaponName == null;
    },

    formatEquippedDamageLabel(stats) {
      const s = stats || this.state.classData;
      if (!s) return '—';
      const formula = this.formatDamageLabel(s.dmgRoll, s.dmgBonus);
      if (this.isUnarmedMainHand(s)) return `${formula} · кулаки`;
      return formula;
    },

    rollPlayerWeaponDamage(critical, weaponSlot = 'weapon_main') {
      const profile =
        typeof weaponSlot === 'string' && weaponSlot.startsWith('inv:')
          ? this.getWeaponAttackProfileFromItem(weaponSlot.slice(4))
          : this.getWeaponAttackProfile(weaponSlot);
      if (profile) return this.rollWeaponDamage(profile, critical);
      const cd = this.state.classData || {};
      const roll = cd.dmgRoll || '1';
      let dice = this.parseRoll(roll);
      if (critical) dice += this.parseRoll(roll);
      return dice + (cd.dmgBonus ?? 0);
    },

    buildClassCombatStats(cls) {
      return {
        ac: cls.ac ?? 10,
        atkBonus: cls.atkBonus ?? 0,
        dmgRoll: cls.dmgRoll || '1d6',
        dmgBonus: cls.dmgBonus ?? 0,
        initBonus: cls.initBonus ?? 0
      };
    },

    INVENTORY_SECTIONS: [
      { key: 'equipment', label: 'Снаряжение' },
      { key: 'consumable', label: 'Расходники' },
      { key: 'key', label: 'Ключи' },
      { key: 'quest', label: 'Квестовые' }
    ],

    resolveItemId(itemKey) {
      if (!itemKey) return null;
      if (this.data?.items?.[itemKey]) return itemKey;
      for (const [id, item] of Object.entries(this.data?.items || {})) {
        if (item.name === itemKey) return id;
      }
      return itemKey;
    },

    /**
     * Пересчёт производных статов: характеристики, maxHp, КД, атака, урон.
     * Проходит по всем слотам (оружие, броня, щит, кольца, ожерелье, серьги).
     */
    recalcDerivedStats() {
      const cls = this.data?.classes?.[this.state.className];
      if (!cls || !this.state.classData) return null;
      // В облике зверя ОЗ/КД/атака задаются отдельно (wild-shape.js)
      if (typeof this.isInWildShape === 'function' && this.isInWildShape()) {
        const beast = typeof this.getActiveBeast === 'function' ? this.getActiveBeast() : null;
        if (beast) this.updateWildShapeStatDisplay?.(beast);
        return null;
      }

      this.migrateEquippedSlots();
      this.ensureBaseMaxHp();

      const baseStats = this.getBaseStats();
      const equipBonuses = this.collectEquipmentBonuses();

      const effective = {};
      for (const key of this.STAT_KEYS) {
        const base = baseStats[key] ?? 10;
        effective[key] = Math.min(20, base + (equipBonuses[key] || 0));
      }
      this.state._effectiveStats = effective;
      this.state.classData.stats = effective;

      const oldMax = this.state._lastComputedMaxHp ?? this.state.maxHp;
      const newMax = Math.max(1, (this.state.baseMaxHp || this.state.maxHp) + equipBonuses.maxHpBonus);
      if (newMax > oldMax && this.state.hp >= oldMax) {
        this.state.hp += (newMax - oldMax);
      }
      this.state.maxHp = newMax;
      this.state._lastComputedMaxHp = newMax;
      if (this.state.hp > this.state.maxHp) this.state.hp = this.state.maxHp;

      const weaponProfile = this.computeWeaponDamageProfile();
      const prof = this.getProficiencyBonus();
      const atkStatMod = this.getModifier(
        this.getPlayerStats()[weaponProfile.statKey] ?? 10
      );
      const passiveBonuses = this.collectPassiveAbilityBonuses();
      const levelBonuses = this.collectProgressionLevelBonuses();

      const stats = {
        ac: this.computePlayerAC() + equipBonuses.acBonus + passiveBonuses.acBonus + levelBonuses.acBonus,
        atkBonus: prof + atkStatMod + equipBonuses.atkBonus + passiveBonuses.atkBonus + levelBonuses.atkBonus,
        dmgRoll: weaponProfile.dmgRoll,
        dmgBonus: weaponProfile.dmgBonus + equipBonuses.dmgBonus,
        weaponId: weaponProfile.weaponId ?? null,
        weaponName: weaponProfile.weaponName,
        initBonus: cls.initBonus ?? 0
      };

      Object.assign(this.state.classData, stats);
      this.refreshCombatStatDisplay(stats);
      return stats;
    },

    /** Алиас: боевые статы после recalcDerivedStats */
    recalculateCombatStats() {
      return this.recalcDerivedStats();
    },

    refreshCombatStatDisplay(stats) {
      const s = stats || this.state.classData;
      if (!s) return;
      const acEl = document.getElementById('ac-val');
      const atkEl = document.getElementById('atk-val');
      const dmgEl = document.getElementById('dmg-val');
      const initEl = document.getElementById('init-val');
      if (acEl) acEl.textContent = String(s.ac);
      if (atkEl) atkEl.textContent = '+' + s.atkBonus;
      if (dmgEl) dmgEl.textContent = this.formatEquippedDamageLabel(s);
      if (initEl) initEl.textContent = '+' + s.initBonus;
    },

    autoEquipStartingGear(classKey) {
      const cls = this.data?.classes?.[classKey];
      const items = this.itemsData;
      if (!cls) return;
      this.state.equipped = {};
      (cls.startingItems || []).forEach(itemId => {
        const item = items[itemId];
        if (!item) return;
        if (this.isAccessoryItem(item)) {
          const slot = this.resolveAccessoryEquipSlot(item);
          if (!this.state.equipped[slot]) this.state.equipped[slot] = itemId;
          return;
        }
        const slot = this.getEquipSlot(item);
        if (!slot) return;
        if (this.isArmorItem(item) && !this.canWearArmor(item)) return;
        this.state.equipped[slot] = itemId;
      });
      this.recalculateCombatStats();
    },

    resolveSoundId(...candidates) {
      for (const c of candidates) {
        if (c && typeof c === 'string' && c.trim()) return c.trim();
      }
      return null;
    },

    resolveDamageTypeSound(damageType) {
      const map = this.data?.audio?.defaults?.damageType || {};
      const dt = String(damageType || 'physical').toLowerCase();
      const fallbacks = {
        magical: 'radiant',
        force: 'radiant',
        arcane: 'radiant',
        electric: 'lightning',
        lightning: 'lightning',
        thunder: 'lightning',
        darkness: 'necrotic',
        necrotic: 'necrotic',
        dark: 'necrotic',
        shadow: 'necrotic',
        curse: 'necrotic',
        heal: 'heal',
        help: 'buff',
        enhancement: 'buff'
      };
      return map[dt] || map[fallbacks[dt]] || map.physical || null;
    },

    resolveEffectTypeSound(effectType) {
      const map = this.data?.audio?.defaults?.effectType || {};
      return map[effectType] || null;
    },

    playCombatSound(soundId, volume) {
      if (!soundId) return;
      AudioEngine.playSFX(soundId, { volume });
    },

    resolveEnemySound(enemy, field, ...fallbacks) {
      const tpl = enemy?.id ? this.data?.enemies?.[enemy.id] : null;
      return this.resolveSoundId(tpl?.[field], ...fallbacks);
    },

    playEnemyAttackSound(enemy, outcome) {
      const fallback = outcome === 'miss' ? 'attack_miss' : 'slash_physical';
      const soundId = this.resolveEnemySound(enemy, 'soundAttack', fallback);
      if (soundId) this.playCombatSound(soundId);
    },

    playEnemyDamagedSound(enemy, opts = {}) {
      const custom = this.resolveEnemySound(enemy, 'soundHit');
      if (custom) {
        this.playCombatSound(custom, opts.volume);
        return true;
      }
      return false;
    },

    /** Лёгкий звук при восстановлении ячеек заклинаний на отдыхе */
    playRestSpellSlotSound() {
      if (typeof AudioEngine === 'undefined') return;
      AudioEngine.unlock?.();
      const id = this.resolveSoundId('heal', this.resolveEffectTypeSound('heal'));
      if (id) AudioEngine.play(id, { volume: 0.55 });
    },

    playAbilityCast(ability) {
      const effect = ability?.effect;
      const firstFx = Array.isArray(ability?.effects) ? ability.effects[0] : null;
      const dt = (effect && typeof effect === 'object' && effect.damageType)
        || (firstFx && firstFx.damageType)
        || null;
      const hitFromType = dt ? this.resolveDamageTypeSound(dt) : null;
      const castFromType = hitFromType
        ? (hitFromType.endsWith('_hit') ? hitFromType.replace(/_hit$/, '_cast') : `${hitFromType}_cast`)
        : null;
      const soundId = this.resolveSoundId(
        ability?.soundCast,
        ability?.sounds?.cast,
        castFromType,
        effect && typeof effect === 'object' && this.resolveEffectTypeSound(effect.type)
      );
      if (soundId) this.playCombatSound(soundId);
    },

    toggleAudio() {
      AudioEngine.setEnabled(!AudioEngine.enabled);
      this.updateAudioToggleButton();
      this.syncAudioVolumeUI();
      if (AudioEngine.enabled) {
        AudioEngine.unlock();
        this.playCombatSound('buff');
        const scene = this.state.scene && this.getProcessedScene(this.state.scene);
        if (scene?.audio) this.playSceneAudio(scene.audio);
      }
    },

    updateAudioToggleButton() {
      const btn = document.getElementById('audio-toggle-btn');
      if (!btn) return;
      btn.textContent = AudioEngine.enabled ? '🔊 Звук вкл' : '🔇 Звук выкл';
      btn.setAttribute('aria-pressed', AudioEngine.enabled ? 'true' : 'false');
    },

    initAudioVolumeUI() {
      if (typeof AudioEngine === 'undefined') return;
      this.syncAudioVolumeUI();
      const music = document.getElementById('music-volume');
      const sfx = document.getElementById('sfx-volume');
      if (music && !music._bound) {
        music._bound = true;
        music.addEventListener('input', () => this.onMusicVolumeChange(music.value));
      }
      if (sfx && !sfx._bound) {
        sfx._bound = true;
        sfx.addEventListener('input', () => this.onSfxVolumeChange(sfx.value));
      }
    },

    syncAudioVolumeUI() {
      if (typeof AudioEngine === 'undefined') return;
      const music = document.getElementById('music-volume');
      const sfx = document.getElementById('sfx-volume');
      const musicVal = document.getElementById('music-volume-val');
      const sfxVal = document.getElementById('sfx-volume-val');
      const pctM = Math.round(AudioEngine.musicVolume * 100);
      const pctS = Math.round(AudioEngine.sfxVolume * 100);
      if (music) music.value = String(pctM);
      if (sfx) sfx.value = String(pctS);
      if (musicVal) musicVal.textContent = pctM + '%';
      if (sfxVal) sfxVal.textContent = pctS + '%';
    },

    onMusicVolumeChange(percent) {
      const v = Math.max(0, Math.min(100, parseInt(percent, 10) || 0)) / 100;
      AudioEngine.setMusicVolume(v);
      this.syncAudioVolumeUI();
    },

    onSfxVolumeChange(percent) {
      const v = Math.max(0, Math.min(100, parseInt(percent, 10) || 0)) / 100;
      AudioEngine.setSfxVolume(v);
      this.syncAudioVolumeUI();
    },

    // ========== ИНИЦИАЛИЗАЦИЯ ==========
    cacheGameData() {
      try {
        const key = this.getDataCacheKey();
        localStorage.setItem(key, JSON.stringify(this.data));
      } catch (e) {
        console.warn('Не удалось сохранить кэш данных:', e);
      }
    },

    showDataSourceNotice() {
      if (this.dataSource === 'file' || this.dataSource === 'demo') return;
      const msg = this.dataSource === 'cache'
        ? 'Локальный режим: данные из редактора (кэш браузера). Для data/game_data.json откройте игру через хост или нажмите «Загрузить контент JSON».'
        : 'Локальный режим: загружен game_data.json. Сохраните JSON в редакторе (💾) для обновления кэша.';
      this.log('ℹ️ ' + msg, 'log-dice');
    },

    normalizeAllClassAbilities(data) {
      if (!data?.classes) return;
      // v4: классы хранят id; полные объекты — в progression.abilities
      if (typeof ProjectDataSchema !== 'undefined' && typeof ProjectDataSchema.migrateClassAbilitiesToPool === 'function') {
        ProjectDataSchema.migrateClassAbilitiesToPool(data);
      }
    },

    loadCachedGameData(cacheKey) {
      const key = cacheKey || this.getDataCacheKey();
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object' || !data.scenes || !data.classes) {
          throw new Error('Неполные данные в кэше');
        }
        return data;
      } catch (e) {
        console.warn('Кэш данных повреждён, сбрасываем:', e.message);
        localStorage.removeItem(key);
        return null;
      }
    },

    applyGameData(data, source) {
      if (typeof SpellSlotProgression !== 'undefined') SpellSlotProgression.applyToGameData(data);
      if (typeof Pf2eMillProgression !== 'undefined') Pf2eMillProgression.applyToGameData(data);
      this.normalizeAllClassAbilities(data);
      if (typeof CombatManager !== 'undefined') {
        CombatManager.normalizeProgressionAbilities(data, this);
      }
      if (typeof QuestMigrate !== 'undefined' && data.questsVersion !== 2) { QuestMigrate.migrateAll(data); data.questsVersion = 2; }
      if (typeof QuestRuntime !== 'undefined') QuestRuntime.bind(this);
      ThemeSystem.ensureInData(data);
      if (!data.races) data.races = {};
      if (!data.meta) data.meta = {};
      if (!data.meta.system) {
        if (data.system === 'pf2e' || (data.ancestries && Object.keys(data.ancestries).length)) {
          data.meta.system = 'pf2e';
        } else {
          const hasSpellcasting = Object.values(data.classes || {}).some(
            (c) => c && (c.spellcasting || c.halfCaster)
          );
          data.meta.system = hasSpellcasting ? 'dnd5e' : 'generic';
        }
      }
      this.data = data;
      if (typeof ReputationSystem !== 'undefined') ReputationSystem.ensureFactions(this.data);
      if (typeof BeastSystem !== 'undefined') BeastSystem.ensureBeasts(this.data);
      if (typeof SceneTemplateEngine !== 'undefined') SceneTemplateEngine.ensureTemplateData(this.data);
      if (typeof WorldHierarchy !== 'undefined') WorldHierarchy.ensureWorldHierarchy(this.data);
      if (typeof ActionChainLibrary !== 'undefined') ActionChainLibrary.ensureActionChains(this.data);
      this.initActiveSystem();
      this.dataSource = source;
      ThemeSystem.applyForApp(data.theme);
      AudioEngine.init(data.audio);
      this.initAudioVolumeUI();
      this.initTooltips();
      if (source === 'file' || source === 'file-picker' || source === 'inline' || source === 'demo') this.cacheGameData();
      this.showDataSourceNotice();
      if (typeof SpecialSceneRegistry !== 'undefined' && SpecialSceneRegistry._registerBuiltins) {
        SpecialSceneRegistry._registerBuiltins(this);
      }
      this.handleStartupRoute();
      this.renderActiveQuests();
    },

    /** Нет сохранения или в нём нет готового персонажа */
    needsCharacterCreation() {
      const raw = localStorage.getItem(this.getSaveKey());
      if (!raw) return true;
      try {
        const save = JSON.parse(raw);
        if (!save.charName?.trim() || !save.className) return true;
      } catch (_) {
        return true;
      }
      return !this.state.charName?.trim();
    },

    handleStartupRoute() {
      this.hideCampaignPicker();
      if (this.needsCharacterCreation()) {
        if (this.CharacterCreator?.open) {
          this.CharacterCreator.open();
        } else {
          this.showCharacterCreator();
        }
        return;
      }
      this.continueNormalStartup();
    },

    continueNormalStartup() {
      document.getElementById('char-creator-screen')?.classList.add('hidden');
      document.getElementById('main')?.classList.remove('hidden');
      const saved = localStorage.getItem(this.getSaveKey());
      if (saved) {
        try {
          const data = JSON.parse(saved);
          if (data.charName?.trim() && data.className) {
            this.loadGame();
            return;
          }
        } catch (_) { /* ignore */ }
      }
      document.getElementById('class-screen')?.classList.remove('hidden');
      this.renderClassSelection();
    },

    loadGameDataFromFile() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          if (!data.scenes) throw new Error('В файле нет объекта scenes');
          this.activeCampaignId = 'melnitsa';
          localStorage.setItem(ACTIVE_CAMPAIGN_KEY, 'melnitsa');
          localStorage.setItem(this.getDataCacheKey(), text);
          if (typeof CampaignCovers !== 'undefined') {
            CampaignCovers.clearAllCoverCaches();
          }
          this.hideCampaignPicker();
          this.applyGameData(data, 'file-picker');
          this.log('✅ Контент загружен: ' + (data.meta?.title || file.name), 'log-heal');
        } catch (err) {
          alert('❌ Ошибка чтения JSON: ' + err.message);
        }
      };
      input.click();
    },

    showLoadDataError(msg) {
      const screen = document.getElementById('class-screen');
      if (!screen) return;
      screen.innerHTML = `
        <h1>Ошибка загрузки</h1>
        <p>${msg || 'Не удалось загрузить данные игры. Убедитесь, что рядом с index.html есть файл <b>data.js</b>.'}</p>
        <p>Откройте игру так: проводник → папка RPGengine → правый клик по <b>index.html</b> → «Открыть с помощью» → Microsoft Edge.</p>
        <button type="button" class="start-btn" onclick="GameEngine.loadGameDataFromFile()">📂 Загрузить game_data.json</button>
      `;
    },

    getActiveCampaign() {
      const id = this.activeCampaignId || localStorage.getItem(ACTIVE_CAMPAIGN_KEY) || 'melnitsa';
      return CAMPAIGNS[id] || CAMPAIGNS.melnitsa;
    },

    getSaveKey() {
      return this.getActiveCampaign().saveKey;
    },

    getDataCacheKey() {
      return this.getActiveCampaign().cacheKey;
    },

    hasCampaignSave(campaign) {
      try {
        const raw = localStorage.getItem(campaign.saveKey);
        if (!raw) return false;
        const save = JSON.parse(raw);
        return !!(save.charName?.trim() && save.className);
      } catch (_) {
        return false;
      }
    },

    loadScriptOnce(src, globalName) {
      return new Promise((resolve, reject) => {
        if (window[globalName]?.scenes) {
          resolve();
          return;
        }
        const existing = document.querySelector(`script[data-demo-src="${src}"]`);
        if (existing) {
          existing.addEventListener('load', () => resolve());
          existing.addEventListener('error', () => reject(new Error('Не удалось загрузить: ' + src)));
          return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.dataset.demoSrc = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Не удалось загрузить: ' + src));
        document.head.appendChild(script);
      });
    },

    /** Кэш / inline совпадает с ожидаемой кампанией (не подхватывать старое демо). */
    isCampaignDataValid(campaign, data) {
      if (!data || typeof data !== 'object' || !data.scenes || !data.classes) return false;
      if (campaign.expectedCampaignId) {
        return data.meta?.campaignId === campaign.expectedCampaignId;
      }
      if (campaign.dataVersion) {
        return data.meta?.dataVersion === campaign.dataVersion;
      }
      return true;
    },

    dropCampaignCache(campaign) {
      if (!campaign?.cacheKey) return;
      try {
        localStorage.removeItem(campaign.cacheKey);
      } catch (_) { /* ignore */ }
      if (campaign.cacheKey === 'rpg_data_cache_pf2e') {
        try { localStorage.removeItem('rpg_data_cache_pf2e'); } catch (_) { /* legacy */ }
      }
    },

    async fetchCampaignData(campaign) {
      const globalName = campaign.inlineGlobal;

      if (globalName && window[globalName]?.scenes) {
        const inline = window[globalName];
        if (this.isCampaignDataValid(campaign, inline)) return inline;
      }

      if (location.protocol !== 'file:' && campaign.dataUrl) {
        try {
          const url = campaign.dataUrl + (campaign.dataUrl.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(campaign.dataVersion || campaign.expectedCampaignId || '1');
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            if (this.isCampaignDataValid(campaign, data)) return data;
          }
        } catch (err) {
          console.warn('fetchCampaignData:', err.message);
        }
      }

      const cached = this.loadCachedGameData(campaign.cacheKey);
      if (cached) {
        if (this.isCampaignDataValid(campaign, cached)) return cached;
        this.dropCampaignCache(campaign);
      }

      if (campaign.demoScript && globalName) {
        await this.loadScriptOnce(campaign.demoScript, globalName);
        const fromScript = window[globalName];
        if (fromScript?.scenes && this.isCampaignDataValid(campaign, fromScript)) {
          return fromScript;
        }
      }

      if (campaign.id === 'melnitsa' && window.GAME_DATA_INLINE?.scenes) {
        return window.GAME_DATA_INLINE;
      }

      throw new Error('Не удалось загрузить данные для «' + campaign.title + '»');
    },

    renderCampaignCardShell(campaign, hasSave) {
      const CC = typeof CampaignCovers !== 'undefined' ? CampaignCovers : null;
      const gradient = CC
        ? CC.gradientFromTitle(campaign.title || campaign.id)
        : 'linear-gradient(135deg, #3d5a80, #1a1a2e)';
      const tr = (k, p) => (typeof t === 'function' ? t(k, p) : k);
      const badge = typeof I18n !== 'undefined'
        ? I18n.campaignField(campaign.id, 'badge', campaign.badge)
        : campaign.badge;
      const subtitle = typeof I18n !== 'undefined'
        ? I18n.campaignField(campaign.id, 'subtitle', campaign.subtitle)
        : campaign.subtitle;
      const description = typeof I18n !== 'undefined'
        ? I18n.campaignField(campaign.id, 'description', campaign.description)
        : campaign.description;
      const saveHint = hasSave
        ? `<span class="campaign-card-save">💾 ${tr('game.hasSave')}</span>`
        : '';
      return `
        <button type="button" class="campaign-card" data-campaign-id="${this.escapeAttr(campaign.id)}"
          onclick="GameEngine.launchCampaign('${this.escapeAttr(campaign.id)}')">
          <div class="campaign-card-cover" data-campaign-id="${this.escapeAttr(campaign.id)}"
            data-cover-title="${this.escapeAttr(campaign.title || campaign.id)}">
            <div class="campaign-card-cover-fallback" style="background:${gradient}">
              <span class="campaign-card-cover-icon" aria-hidden="true">🎮</span>
            </div>
            <img class="campaign-card-cover-img" alt="" hidden decoding="async" loading="lazy">
          </div>
          <div class="campaign-card-body">
            <span class="campaign-card-badge">${this.escapeHtml(badge)}</span>
            <span class="campaign-card-title">${this.escapeHtml(campaign.title)}</span>
            <span class="campaign-card-sub">${this.escapeHtml(subtitle)}</span>
            <span class="campaign-card-desc">${this.escapeHtml(description)}</span>
            ${saveHint}
            <span class="campaign-card-cta">${hasSave ? tr('game.continueOrNew') : tr('game.play')}</span>
          </div>
        </button>`;
    },

    async hydrateCampaignCardCovers() {
      if (typeof CampaignCovers === 'undefined') return;
      const campaigns = Object.values(CAMPAIGNS);
      await Promise.all(campaigns.map(async (campaign) => {
        try {
          const payload = await CampaignCovers.getCoverForCampaign(
            campaign,
            (c) => this.fetchCampaignData(c)
          );
          const coverEl = document.querySelector(
            `.campaign-card-cover[data-campaign-id="${campaign.id}"]`
          );
          CampaignCovers.applyToCardElement(coverEl, payload);
        } catch (err) {
          console.warn('[cover]', campaign.id, err);
        }
      }));
    },

    showCampaignPicker() {
      const screen = document.getElementById('campaign-picker-screen');
      const grid = document.getElementById('campaign-grid');
      if (!screen || !grid) return;

      document.body.classList.add('campaign-selecting');
      screen.classList.remove('hidden');
      document.getElementById('sidebar')?.classList.add('hidden');
      if (typeof SidebarDock !== 'undefined') SidebarDock.setVisible(false);
      document.getElementById('main')?.classList.add('hidden');
      document.getElementById('char-creator-screen')?.classList.add('hidden');

      const campaigns = Object.values(CAMPAIGNS);
      grid.innerHTML = campaigns.map((c) => {
        const hasSave = this.hasCampaignSave(c);
        return this.renderCampaignCardShell(c, hasSave);
      }).join('');

      this.hydrateCampaignCardCovers();

      document.title = 'RPGengine — выбор приключения';
    },

    hideCampaignPicker() {
      document.body.classList.remove('campaign-selecting');
      document.getElementById('campaign-picker-screen')?.classList.add('hidden');
      this.ensurePlayerUIVisible({ force: true });
    },

    /** Сцена прячет боковую панель / док (создание персонажа и т.п.) */
    sceneHidesPlayerUI(sceneId) {
      const raw = this.data?.scenes?.[sceneId];
      if (!raw) return false;
      let scene = raw;
      if (raw.sceneTemplate && !raw.templateDetached && typeof SceneTemplateEngine !== 'undefined') {
        try {
          scene = SceneTemplateEngine.materializeScene(this.data, raw);
        } catch (_) { /* use raw */ }
      }
      if (scene.special === 'character_creation') return true;
      if (scene.visibility?.sidebar === false || scene.visibility?.dock === false) return true;
      return false;
    },

    /**
     * Вернуть правую панель персонажа, док (🎒⚡) и основной layout.
     * Вызывать после выхода из сцен с hide_sidebar / hide_dock.
     */
    ensurePlayerUIVisible(opts = {}) {
      if (document.body.classList.contains('campaign-selecting') && !opts.force) return;
      const inCreator = document.body.classList.contains('cc-fullscreen-active')
        || !document.getElementById('char-creator-screen')?.classList.contains('hidden');
      const hasHero = !!(this.state?.charName?.trim() || this.state?.className);
      if (!opts.force && inCreator && !hasHero) return;

      document.getElementById('game-content')?.classList.remove('hidden');
      document.getElementById('main')?.classList.remove('hidden');
      document.body.classList.remove('scene-hide-log', 'cc-fullscreen-active');

      if (hasHero || opts.force) {
        document.getElementById('sidebar')?.classList.remove('hidden');
        if (typeof SidebarDock !== 'undefined') SidebarDock.setVisible(true);
      }
    },

    /** Загрузка демо по алиасу (mill → pf2e, scifi → scifi). */
    loadDemo(demoId) {
      const map = { mill: 'pf2e', pf2e_mill: 'pf2e', pf2e: 'pf2e', detective: 'pf2e', scifi: 'scifi' };
      const campaignId = map[demoId] || demoId;
      return this.launchCampaign(campaignId);
    },

    async launchCampaign(campaignId) {
      const campaign = CAMPAIGNS[campaignId];
      if (!campaign) return;

      const screen = document.getElementById('campaign-picker-screen');
      const grid = document.getElementById('campaign-grid');
      if (grid) {
        grid.innerHTML = '<p class="campaign-loading">Загрузка «' + this.escapeHtml(campaign.title) + '»…</p>';
      }

      try {
        if (campaign.expectedCampaignId) {
          try { localStorage.removeItem('rpg_data_cache_pf2e'); } catch (_) { /* legacy detective cache */ }
        }
        const data = await this.fetchCampaignData(campaign);
        this.activeCampaignId = campaign.id;
        localStorage.setItem(ACTIVE_CAMPAIGN_KEY, campaign.id);
        this.hideCampaignPicker();
        const source = campaign.id === 'melnitsa' ? 'file' : 'demo';
        this.applyGameData(data, source);
        if (campaign.pageTitle) document.title = campaign.pageTitle;
        else if (data.meta?.title) document.title = data.meta.title;
        this.renderActiveQuests();
      } catch (err) {
        console.error(err);
        if (screen && grid) {
          grid.innerHTML = `
            <p class="campaign-error">❌ ${this.escapeHtml(err.message || String(err))}</p>
            <button type="button" class="start-btn" onclick="GameEngine.showCampaignPicker()">← Назад</button>`;
        }
      }
    },

    returnToCampaignPicker() {
      if (this.state.charName?.trim() && !confirm('Вернуться к выбору игры? Несохранённый прогресс может быть потерян.')) {
        return;
      }
      document.getElementById('char-creator-screen')?.classList.add('hidden');
      document.getElementById('game-content')?.classList.add('hidden');
      document.getElementById('class-screen')?.classList.add('hidden');
      document.getElementById('name-screen')?.classList.add('hidden');
      document.getElementById('main')?.classList.add('hidden');
      this.showCampaignPicker();
    },

    async init() {
      this.showCampaignPicker();
    },

    // ========== БРОСКИ КУБИКОВ ==========
    d(n) { return Math.floor(Math.random() * n) + 1; },
    d20() { return this.d(20); },

    parseRoll(formula) {
      // "2d4+2" -> результат
      const match = formula.match(/(\d+)d(\d+)(?:\+(-?\d+))?/);
      if (!match) return 0;
      const count = parseInt(match[1]);
      const sides = parseInt(match[2]);
      const bonus = match[3] ? parseInt(match[3]) : 0;
      let total = bonus;
      for (let i = 0; i < count; i++) total += this.d(sides);
      return total;
    },

    // ========== ВЫБОР КЛАССА ==========
    renderClassSelection() {
      const screen = document.getElementById('class-screen');
      if (!screen || !this.data) return;

      let html = `
        <h1>Выберите класс</h1>
        <p>Каждый класс имеет уникальные способности, характеристики и стиль боя.</p>
        <div class="class-grid">
      `;

      for (const [key, cls] of Object.entries(this.data.classes)) {
        html += `
          <div class="class-card" ${this.onclickGame('selectClass', key)}>
            <div class="class-icon">${this.renderIcon(cls.icon)}</div>
            <div class="class-name">${cls.name}</div>
            <div class="class-stats">
              <div>❤️ ${cls.hp} ОЗ</div>
              <div>🛡️ КД ${cls.ac}</div>
              <div>⚔️ +${cls.atkBonus} атака</div>
            </div>
            <div class="class-abilities-preview">
              ${(cls.abilities || []).slice(0, 3).map((ab) => {
                const def = typeof ab === 'string'
                  ? (this.resolveAbilityDefinition(ab) || { id: ab, name: ab, icon: '✨' })
                  : ab;
                return `<div class="class-ab">${this.renderIcon(def.icon)} ${this.escapeHtml(def.name || def.id || '')}</div>`;
              }).join('')}
            </div>
            <div class="class-resource">Ресурс: ${(cls.resource || { name: '—', max: 0 }).name} (${(cls.resource || { max: 0 }).max})</div>
          </div>
        `;
      }

      html += '</div>';
      screen.innerHTML = html;
    },

    selectClass(classKey) {
      this.state.className = classKey;
      const cls = this.data.classes[classKey];
      if (!cls) return;

      const resource = cls.resource || { name: 'Ресурс', max: 2, desc: '' };

      this.state.hp = cls.hp ?? 20;
      this.state.maxHp = cls.hp ?? 20;
      this.state.inventory = [...(cls.startingItems || [])];
      this.initProgressionState();
      this.initResourcesFromLevel(1);

      this.state.classData = {
        ac: cls.ac ?? 10,
        atkBonus: cls.atkBonus ?? 0,
        dmgRoll: cls.dmgRoll || '1d6',
        dmgBonus: cls.dmgBonus ?? 0,
        initBonus: cls.initBonus ?? 0,
        stats: { ...(cls.stats || {}) },
        skills: cls.skills || '',
        resourceName: resource.name,
        resourceDesc: resource.desc || '',
        abilities: this.normalizeAbilities(cls.abilities, classKey)
      };

      this.autoEquipStartingGear(classKey);
      const combat = this.recalculateCombatStats();

      // Обновление интерфейса
      this.renderClassDisplay(classKey);
      this.setCharName(this.state.charName || 'Герой');
      this.updateUI();
      this.updateAbilityGrid();

      const skillsEl = document.getElementById('skills-list');
      if (skillsEl) skillsEl.textContent = 'Навыки: ' + (cls.skills || '—');

      const resLabel = document.getElementById('resource-label');
      if (resLabel) resLabel.textContent = resource.name;

      document.getElementById('class-screen').classList.add('hidden');
      document.getElementById('name-screen').classList.remove('hidden');
    },

    getActiveSystemId() {
      return this.data?.meta?.system || this.data?.system || this.activeSystem?.id || 'dnd5e';
    },

    getDefaultRaceKey() {
      const races = this.data?.races || {};
      const sys = this.getActiveSystemId();
      if (sys === 'pf2e') {
        const pf2e = Object.keys(races).find(k => races[k]?.system === 'pf2e');
        return pf2e || '';
      }
      if (races.human && (!races.human.system || races.human.system !== 'pf2e')) return 'human';
      const dnd = Object.keys(races).find(k => !races[k]?.system || races[k].system !== 'pf2e');
      return dnd || '';
    },

    getRaceData(raceKey) {
      const key = raceKey || this.state.raceKey;
      if (!key) return null;
      return this.data?.races?.[key] || null;
    },

    buildRacialAbilities(race) {
      if (!race?.traits?.length) return [];
      const isPf2e = race.system === 'pf2e';
      return race.traits
        .filter(t => t.type === 'active')
        .map(trait => ({
          id: trait.id,
          name: trait.name,
          icon: '🧬',
          desc: trait.desc,
          cost: 0,
          combatOnly: isPf2e ? trait.type === 'active' : true,
          oncePerCombat: !isPf2e,
          effect: { type: 'custom', message: trait.desc },
          usage: isPf2e && trait.type !== 'active' ? 'exploration' : 'combat',
          type: 'active',
          racial: true
        }));
    },

    /** Раса + класс в одной строке (#class-display). Отдельный #race-display не используем. */
    renderRaceDisplay(raceKey) {
      const raceEl = document.getElementById('race-display');
      if (raceEl) {
        raceEl.innerHTML = '';
        raceEl.classList.add('hidden');
      }
      if (raceKey && !this.state.raceData) {
        const r = this.getRaceData(raceKey);
        if (r) this.state.raceData = { ...r };
      }
      this.renderClassDisplay(this.state.className);
    },

    renderClassDisplay(classKey) {
      const cls = classKey ? this.data?.classes?.[classKey] : null;
      const el = document.getElementById('class-display');
      const raceEl = document.getElementById('race-display');
      if (!el) return;
      if (raceEl) {
        raceEl.innerHTML = '';
        raceEl.classList.add('hidden');
      }
      const race = this.state.raceData || this.getRaceData(this.state.raceKey);
      if (!cls && !race) {
        el.innerHTML = '';
        return;
      }
      const parts = [];
      if (race) {
        parts.push(
          `<span class="class-display-race">${this.renderIcon(race.icon)} <span class="class-display-name class-display-name--race">${this.escapeHtml(race.name)}</span></span>`
        );
      }
      if (cls) {
        if (race) parts.push('<span class="class-display-sep" aria-hidden="true">·</span>');
        parts.push(
          `<span class="class-display-class">${this.renderIcon(cls.icon)} <span class="class-display-name">${this.escapeHtml(cls.name)}</span></span>`
        );
      }
      el.innerHTML = parts.join('');
    },

    renderAbilities() {
      const el = document.getElementById('abilities-list');
      const cd = this.state.classData;
      if (!el || !cd?.abilities?.length) {
        if (el) el.innerHTML = '<div class="hint" style="font-size:12px;">Нет умений</div>';
        return;
      }

      const inCombat = !!this.state.combat;
      const playerTurn = !!this.state.combat?.playerTurn;
      const resName = cd.resourceName || 'ресурс';
      const spellLevel = (ab) => this.getAbilitySpellLevel(ab);

      el.innerHTML = cd.abilities.map(ab => {
        const cost = ab.cost ?? 0;
        const isPassive = this.isAbilityPassiveAbility(ab);
        const combatOnly = this.isAbilityCombatOnly(ab);
        const spellBlocked = this.isSpellBlockedByCurse(ab);
        const canAfford = this.canAffordAbility(ab);
        const used = inCombat && ab.oncePerCombat && this.state.combat?.abilitiesUsed?.[ab.id];
        let unavailable = inCombat ? this.getAbilityUnavailableReason(ab) : null;
        if (!inCombat) {
          if (combatOnly) unavailable = unavailable || 'Только в бою';
          if ((this.state.level || 1) < this.getAbilityMinLevel(ab)) {
            unavailable = `Доступно с ${this.getAbilityMinLevel(ab)} уровня`;
          } else if (typeof this.getWildShapeUnavailableReason === 'function') {
            const ws = this.getWildShapeUnavailableReason(ab);
            if (ws && ws !== 'Уже в облике зверя') unavailable = unavailable || ws;
          } else if (typeof this.getTransformUnavailableReason === 'function') {
            const tr = this.getTransformUnavailableReason(ab);
            if (tr && tr !== 'Уже преобразованы') unavailable = unavailable || tr;
          }
        }
        let canUse = !isPassive && canAfford && !used && !spellBlocked && !unavailable;
        if (inCombat) canUse = canUse && playerTurn;
        else canUse = canUse && !combatOnly;

        const sl = spellLevel(ab);
        const actionBadge = `<span class="ability-action-badge ability-action-badge--${this.escapeAttr(this.getAbilityActionType(ab))}">${this.escapeHtml(this.getAbilityActionTypeBadge(ab))}</span>`;
        const meta = isPassive
          ? 'пассив'
          : (spellBlocked ? '🤐 безмолвие' : (sl >= 1 ? `круг ${sl}` : `${cost} ${resName}`));
        const abId = this.escapeAttr(ab.id);
        const useBtn = isPassive
          ? ''
          : (canUse
            ? `<button type="button" class="ability-use-btn" onclick="event.stopPropagation();GameEngine.useAbility('${abId}')">Использовать</button>`
            : `<button type="button" class="ability-use-btn" disabled title="${this.escapeAttr(unavailable || '')}">Использовать</button>`);
        const displayDesc = this.getAbilityDisplayDesc(ab);
        const desc = displayDesc
          ? `<div class="ability-row-desc">${this.escapeHtml(displayDesc)}</div>`
          : '';
        const rowClass = 'ability-row' + (isPassive ? ' ability-row--passive' : '');

        return `<div class="${rowClass}" title="${this.escapeAttr(displayDesc || '')}" ${this.onclickGame('showAbilityInfo', ab.id)}>
          <div class="ability-row-head">
            <span class="ability-row-icon">${this.renderIcon(ab.icon)}</span>
            <span class="ability-row-name">${this.escapeHtml(ab.name)}</span>
            ${actionBadge}
            <span class="ability-row-meta">${this.escapeHtml(meta)}</span>
            ${useBtn}
          </div>
          ${desc}
        </div>`;
      }).join('');
    },

    onAbilityCardClick(abilityId) {
      const ab = this.state.classData.abilities?.find(a => a.id === abilityId);
      if (!ab) return;

      const inCombat = !!this.state.combat;
      const cost = ab.cost ?? 0;
      const spellBlocked = this.isSpellBlockedByCurse(ab);
      const canAfford = this.canAffordAbility(ab);
      const sl = this.getAbilitySpellLevel(ab);
      const canUse = !spellBlocked && (inCombat
        ? this.state.combat.playerTurn && canAfford
        : !this.isAbilityCombatOnly(ab) && canAfford);

      if (canUse && ab.type !== 'passive' && !ab.passive) {
        this.useAbility(abilityId);
        return;
      }
      this.showAbilityInfo(abilityId);
    },

    showAbilityInfo(abilityId) {
      const ab = this.state.classData.abilities.find(a => a.id === abilityId);
      if (!ab) return;
      const combatTag = this.isAbilityCombatOnly(ab) ? '⚔️ Только в бою' : '🌿 Мир / Бой';
      const onceTag = ab.oncePerCombat ? ' | Используется 1 раз за бой' : '';
      const sl = this.getAbilitySpellLevel(ab);
      const costLine = sl >= 1
        ? `Ячейка круга ${sl}`
        : `Стоимость: ${ab.cost ?? 0} ${this.state.classData.resourceName}`;
      this.showModal(ab.name + ' ' + ab.icon, this.getAbilityDisplayDesc(ab) + '\n\n' + costLine + '\n' + combatTag + onceTag);
    },

    renderAttrRow(label, score) {
      const val = score != null && score !== ''
        ? `${score} (${this.formatMod(score)})`
        : '—';
      return `<div class="attr-row"><span class="attr-label">${label}:</span><span class="attr-val">${val}</span></div>`;
    },

    updateAbilityGrid() {
      const grid = document.getElementById('ability-grid');
      if (!grid) return;

      const cd = this.state.classData;
      const keys = [
        ['СИЛ', 'str'],
        ['ЛОВ', 'dex'],
        ['ТЕЛ', 'con'],
        ['ИНТ', 'int'],
        ['МУД', 'wis'],
        ['ХАР', 'cha']
      ];

      if (!cd?.stats) {
        grid.innerHTML = keys.map(([label]) => this.renderAttrRow(label, null)).join('');
        return;
      }

      grid.innerHTML = keys.map(([label, key]) => this.renderAttrRow(label, cd.stats[key])).join('');
    },

    getModifierPF2e(score) {
      return Math.floor((Number(score) - 10) / 2);
    },

    getModifier(score) {
      if (this.activeSystem?.getModifier) {
        return this.activeSystem.getModifier(score);
      }
      if (this.getActiveSystemId() === 'pf2e') {
        return this.getModifierPF2e(score);
      }
      return Math.floor((Number(score) - 10) / 2);
    },

    formatMod(score) {
      const mod = this.getModifier(score);
      return mod >= 0 ? '+' + mod : mod;
    },

    /** Список id навыков, которыми владеет персонаж (сохранения без proficiencies — из classData) */
    getProficientSkillIds() {
      const fromState = this.state.proficiencies?.skills;
      if (Array.isArray(fromState) && fromState.length) {
        return fromState.map(s => String(s).toLowerCase());
      }
      const cd = this.state.classData;
      if (Array.isArray(cd?.skillIds) && cd.skillIds.length) {
        return cd.skillIds.map(s => String(s).toLowerCase());
      }
      return [];
    },

    isPf2eMode() {
      return this.getActiveSystemId() === 'pf2e' || this.activeSystem?.id === 'pf2e';
    },

    getPf2eSkillRank(skill) {
      const sys = this.activeSystem;
      const key = sys?.normalizeSkillId
        ? sys.normalizeSkillId(skill)
        : String(skill || '').toLowerCase();
      const rank = this.state.skills?.[key];
      if (rank && rank !== 'untrained') return rank;
      return sys?.getSkillProficiencyRank?.(key, this.state.classData, this) || 'untrained';
    },

    getPf2eSkillRankShort(rank) {
      const map = this.activeSystem?.RANK_SHORT || { trained: 'T', expert: 'E', master: 'M', legendary: 'L' };
      return map[rank] || 'U';
    },

    getPf2eSkillRankCss(rank) {
      return `skill-rank--${rank || 'untrained'}`;
    },

    /** Миграция старых PF2e сохранений без state.skills */
    migratePf2eSkillsState() {
      if (!this.isPf2eMode()) return;
      if (this.state.skills && Object.keys(this.state.skills).length) return;

      const map = {};
      const cd = this.state.classData || {};
      const cls = this.data?.classes?.[this.state.className];

      const add = (id, rank) => {
        const key = this.activeSystem?.normalizeSkillId?.(id) || String(id).toLowerCase();
        if (key) map[key] = rank || 'trained';
      };

      (cls?.fixedSkills || []).forEach(id => add(id, cls?.skillChoices?.rank || 'trained'));
      (cd.skillProficiency && typeof cd.skillProficiency === 'object'
        ? Object.entries(cd.skillProficiency)
        : []
      ).forEach(([k, r]) => add(k, r));
      (cd.skillIds || this.state.proficiencies?.skills || []).forEach(id => add(id, 'trained'));
      if (typeof cd.skills === 'string' && cd.skills.trim()) {
        cd.skills.split(',').forEach(part => add(part.trim(), 'trained'));
      }

      this.state.skills = map;
      if (cd) cd.skillProficiency = { ...map };
    },

    isSkillProficient(skill) {
      if (this.isPf2eMode()) {
        const rank = this.getPf2eSkillRank(skill);
        return rank && rank !== 'untrained';
      }
      const key = String(skill || '').toLowerCase();
      const ids = this.getProficientSkillIds();
      if (ids.includes(key)) return true;
      const cd = this.state.classData;
      const playerSkills = cd?.skills || '';
      if (playerSkills && typeof playerSkills === 'string') {
        const defs = this.activeSystem?.getSkillDefs?.() || {};
        const def = defs[key] || Object.values(defs).find(d => d.ru === skill);
        if (def?.ru && playerSkills.includes(def.ru)) return true;
      }
      return false;
    },

    getSkillBonus(skill) {
      const cd = this.state.classData;
      if (!cd || !cd.stats) return 0;

      if (this.activeSystem?.getSkillBonus) {
        return this.activeSystem.getSkillBonus(skill, cd.stats, cd, this);
      }

      const SKILL_DEFS = this.activeSystem?.getSkillDefs?.() || {
        acrobatics: { stat: 'dex', ru: 'Акробатика' },
        animal_handling: { stat: 'wis', ru: 'Уход за животными' },
        arcana: { stat: 'int', ru: 'Магия (тайные знания)' },
        athletics: { stat: 'str', ru: 'Атлетика' },
        deception: { stat: 'cha', ru: 'Обман' },
        history: { stat: 'int', ru: 'История' },
        insight: { stat: 'wis', ru: 'Проницательность' },
        intimidation: { stat: 'cha', ru: 'Устрашение' },
        investigation: { stat: 'int', ru: 'Расследование' },
        medicine: { stat: 'wis', ru: 'Медицина' },
        nature: { stat: 'int', ru: 'Природа' },
        perception: { stat: 'wis', ru: 'Восприятие' },
        performance: { stat: 'cha', ru: 'Выступление' },
        persuasion: { stat: 'cha', ru: 'Убеждение' },
        religion: { stat: 'int', ru: 'Религия' },
        sleight_of_hand: { stat: 'dex', ru: 'Ловкость рук' },
        stealth: { stat: 'dex', ru: 'Скрытность' },
        survival: { stat: 'wis', ru: 'Выживание' },
        magic: { stat: 'int', ru: 'Магия' },
        dexterity: { stat: 'dex', ru: null },
        strength: { stat: 'str', ru: null },
        wisdom: { stat: 'wis', ru: null },
        charisma: { stat: 'cha', ru: null },
        intelligence: { stat: 'int', ru: null },
        constitution: { stat: 'con', ru: null }
      };

      const key = String(skill || '').toLowerCase();
      let def = SKILL_DEFS[key];
      let skillNameRu = skill;

      if (def) {
        skillNameRu = def.ru || skill;
      } else {
        const byRu = Object.values(SKILL_DEFS).find(d => d.ru === skill);
        if (byRu) {
          def = byRu;
          skillNameRu = skill;
        }
      }

      const statKey = def?.stat || 'int';
      const proficient = this.isSkillProficient(key) || (def?.ru && this.isSkillProficient(skillNameRu));
      const proficiency = proficient ? this.getProficiencyBonus() : 0;

      const statValue = cd.stats[statKey] || 10;
      return this.getModifier(statValue) + proficiency;
    },

    shouldShowCharacterCreator() {
      return this.needsCharacterCreation();
    },

    showCharacterCreator() {
      if (this.CharacterCreator?.open) this.CharacterCreator.open();
    },

    hideCharacterCreator() {
      if (this.CharacterCreator?.close) this.CharacterCreator.close();
      else document.getElementById('char-creator-screen')?.classList.add('hidden');
    },

    /** ОЗ 1 уровня: кость класса + мод. Тел (D&D 5e) */
    getClassLevel1Hp(classKey, conMod) {
      if (this.activeSystem?.calculateHP) {
        const draftStats = this.CharacterCreator?.draft?.stats;
        const stats = this.state.stats || draftStats || this.state.classData?.stats || {};
        return this.activeSystem.calculateHP(classKey, 1, stats, this.data, conMod, this);
      }
      const hitDie = {
        warrior: 10,
        wizard: 6,
        paladin: 10,
        barbarian: 12,
        bard: 8,
        druid: 8,
        monk: 8,
        warlock: 8,
        sorcerer: 6,
        rogue: 8,
        cleric: 8,
        ranger: 10
      };
      const cls = this.data?.classes?.[classKey];
      const base = cls?.hpHitDie ?? hitDie[classKey] ?? cls?.hp ?? 10;
      const mod = conMod != null ? conMod : this.getModifier(this.state.stats?.con ?? 10);
      return Math.max(1, Number(base) + mod);
    },

    /** Стартовая сцена после создателя персонажа (project.startScene или legacy-фолбэк). */
    getFirstStorySceneId() {
      if (typeof ProjectSchema !== 'undefined' && typeof ProjectSchema.resolveProjectStartSceneId === 'function') {
        return ProjectSchema.resolveProjectStartSceneId(this.data);
      }
      const scenes = this.data?.scenes || {};
      const configured = this.data?.startScene ?? this.data?.meta?.startScene;
      if (configured != null && String(configured) !== '' && scenes[configured]) {
        return String(configured);
      }
      if (scenes.village_hub) return 'village_hub';
      if (scenes.start) return 'start';
      const keys = Object.keys(scenes);
      return keys[0] || 'start';
    },

    /** Сцена по умолчанию для кнопки «назад» из special / лавки */
    getSceneExitTarget(scene) {
      if (!scene) return 'village';
      return scene.exitScene || scene.hubScene || 'village';
    },

    /** Кнопка возврата в хаб (если в данных включён returnsToHub) */
    buildHubReturnChoice(rawScene) {
      if (this.state.flags?.skipHubReturn) return null;
      if (!rawScene?.returnsToHub || !rawScene.hubScene) return null;
      const hub = rawScene.hubScene;
      const choices = rawScene.choices || [];
      const hasHubLink = choices.some(c => c && c.to === hub);
      if (hasHubLink) return null;
      const label = hub === 'village_hub'
        ? '← Вернуться на площадь'
        : '← Вернуться';
      return { text: label, to: hub, icon: '🏘️', _hubReturn: true };
    },

    /** Дополняет список выборов кнопкой возврата в хаб */
    withHubReturnChoices(choices, rawScene) {
      const extra = this.buildHubReturnChoice(rawScene);
      if (!extra) return choices || [];
      return [...(choices || []), extra];
    },

    racesRequiredForSystem() {
      const races = this.data?.races || {};
      const sys = this.getActiveSystemId();
      return Object.keys(races).some(k => {
        const rs = races[k]?.system || 'dnd5e';
        return sys === 'pf2e' ? rs === 'pf2e' : rs !== 'pf2e';
      });
    },

    buildPf2eStatsFromDraft(d) {
      const stats = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
      Object.entries(d.pf2eFixedBoosts || {}).forEach(([stat, val]) => {
        stats[stat] = Math.min(18, (stats[stat] || 10) + val);
      });
      Object.entries(d.pf2eFreeBoosts || {}).forEach(([stat, count]) => {
        stats[stat] = Math.min(18, (stats[stat] || 10) + count * 2);
      });
      return stats;
    },

    finalizeCharacter(draft) {
      const d = draft || this.CharacterCreator?.draft;
      if (!d?.classKey || !this.data?.classes?.[d.classKey]) return;

      const races = this.data?.races;
      const racesRequired = this.racesRequiredForSystem();
      if (racesRequired && !d.raceKey) return;

      const classKey = d.classKey;
      const cls = this.data.classes[classKey];
      const raceKey = d.raceKey || '';
      const race = raceKey && races ? races[raceKey] : null;
      const isPf2eRace = race?.system === 'pf2e' || this.getActiveSystemId() === 'pf2e';
      const name = (d.name || '').trim() || 'Герой';
      const resource = cls.resource || { name: 'Ресурс', max: 2, desc: '' };

      let stats;
      if (isPf2eRace) {
        stats = d.stats ? { ...d.stats } : this.buildPf2eStatsFromDraft(d);
      } else {
        stats = { ...d.stats };
        if (d.raceKey && race?.asi) {
          for (const [stat, bonus] of Object.entries(race.asi)) {
            if (stats[stat] != null) {
              stats[stat] = Math.min(20, stats[stat] + bonus);
            }
          }
        }
      }

      const conMod = this.getModifier(stats.con ?? 10);
      const maxHp = this.getClassLevel1Hp(classKey, conMod);

      this.state.charName = name;
      this.state.className = classKey;
      this.state.gender = d.gender || 'male';
      this.state.raceKey = d.raceKey || '';
      this.state.raceData = race ? { ...race } : null;
      this.state.stats = stats;
      this.state.heritageId = d.heritageId || '';
      this.state.pf2eFixedBoosts = d.pf2eFixedBoosts ? { ...d.pf2eFixedBoosts } : null;
      this.state.pf2eFreeBoosts = d.pf2eFreeBoosts ? { ...d.pf2eFreeBoosts } : null;
      this.state.hp = maxHp;
      this.state.maxHp = maxHp;
      this.state.baseMaxHp = maxHp;
      this.state._lastComputedMaxHp = maxHp;
      this.state.gold = 0;
      this.state.supplies = 0;
      this.state.inventory = [...(cls.startingItems || [])];
      this.state.flags = {};
      this.applyStartingFlags();
      this.state.questStages = {};
      this.state.sceneVisits = {};
      this.state.visitedLocations = {};
      this.state.clearedCombats = {};
      this.state.achievementUnlocks = {};
      this.state.combat = null;
      this.state.enemies = [];
      this.state.favoredEnemyTypes = Array.isArray(d.favoredEnemyTypes)
        ? [...d.favoredEnemyTypes]
        : [];
      this.state.equipped = {};
      this.state.curseEffects = {};
      this.initProgressionState();
      this.initResourcesFromLevel(1);

      const isPf2eClass = cls.system === 'pf2e' || isPf2eRace || this.isPf2eMode();
      let skillIds = [];
      let skillStr = '';

      if (isPf2eClass && d.pf2eSkills && typeof d.pf2eSkills === 'object') {
        this.state.skills = { ...d.pf2eSkills };
        this.state.skillIncreases = [];
        skillIds = Object.keys(this.state.skills);
        skillStr = this.CharacterCreator
          ? skillIds.map(id => this.CharacterCreator.skillLabel(id)).join(', ')
          : skillIds.join(', ');
        this.state.proficiencies = { skills: [] };
      } else {
        skillIds = [...new Set((d.skills || []).map(s => String(s).toLowerCase()))];
        skillStr = this.CharacterCreator
          ? this.CharacterCreator.skillsToString(skillIds)
          : (cls.skills || '');
        this.state.proficiencies = { skills: skillIds };
        this.state.skills = {};
      }

      const baseAbilities = this.reconcileAbilities(
        this.normalizeAbilities(cls.abilities || [], classKey),
        classKey
      );
      const abilities = [...baseAbilities];
      const bonusId = d.bonusAbilityId;
      if (bonusId && !abilities.some(a => a.id === bonusId)) {
        const bonusDef = this.resolveAbilityDefinition(bonusId);
        if (bonusDef) {
          abilities.push(this.reconcileAbility(bonusDef, bonusDef, classKey, abilities.length));
        }
      }

      const racialAbilities = this.buildRacialAbilities(race);
      racialAbilities.forEach(ab => {
        if (!abilities.some(a => a.id === ab.id)) {
          abilities.push(this.normalizeAbility(ab, classKey, abilities.length));
        }
      });

      this.state.classData = {
        ac: cls.ac ?? 10,
        atkBonus: cls.atkBonus ?? 0,
        dmgRoll: cls.dmgRoll || '1d6',
        dmgBonus: cls.dmgBonus ?? 0,
        initBonus: cls.initBonus ?? 0,
        stats: { ...stats },
        skills: skillStr,
        skillIds,
        skillProficiency: isPf2eClass ? { ...(this.state.skills || {}) } : undefined,
        resourceName: resource.name,
        resourceDesc: resource.desc || '',
        abilities
      };

      abilities.forEach(ab => {
        if (ab.passive || ab.type === 'passive') this.applyPassiveAbility(ab);
      });

      this.autoEquipStartingGear(classKey);
      this.initStartingArrowAmmo();
      this.recalculateCombatStats();
      this.migrateCurseState();
      this.migrateCraftingState();
      if (classKey === 'druid') {
        const forms = Array.isArray(d.wildShapeKnownForms) ? d.wildShapeKnownForms.filter(Boolean) : [];
        this.state.wildShape = {
          knownForms: forms.length
            ? forms
            : (typeof BeastSystem !== 'undefined'
              ? BeastSystem.defaultKnownFormIds(this.data)
              : ['wolf', 'panther'])
        };
        if (typeof this.migrateWildShapeState === 'function') this.migrateWildShapeState();
      }
      this.setCharName(name);

      this.renderClassDisplay(classKey);

      const resLabel = document.getElementById('resource-label');
      if (resLabel) resLabel.textContent = resource.name;

      this.hideCharacterCreator();
      document.getElementById('class-screen')?.classList.add('hidden');
      document.getElementById('name-screen')?.classList.add('hidden');
      this.ensurePlayerUIVisible({ force: true });

      this.initUI();
      this.updateUI();
      this.updateAbilityGrid();
      this.log('--- ' + name + ', ' + cls.name + ' — путь начинается ---', 'log-combat');

      // Стартовая сцена: project.startScene при наличии, иначе legacy-цепочка в getFirstStorySceneId()
      const startScene = this.getFirstStorySceneId();
      if (this.data?.scenes?.[startScene]) {
        this.showScene(startScene, { forceRevisit: true });
      } else {
        this.state.scene = startScene;
        this.setText('Сцена «' + startScene + '» не найдена. Загрузите game_data.json.');
        this.setChoices([]);
        this.saveGame({ force: true });
      }
      this.initTooltips();
    },

    maybeEnterCharacterCreator() {
      if (this.needsCharacterCreation()) {
        this.showCharacterCreator();
        return true;
      }
      return false;
    },

    /**
     * Настройки отдыха из game_data.json (rest.types.short / rest.types.long).
     * hpFraction / resourceFraction: доля от max (1 = полностью).
     * consumesSupply: тратить 1 припас при отдыхе этого типа.
     */
    getRestConfig(type) {
      const defaults = {
        short: { hpFraction: 0.5, resourceFraction: 0.5, consumesSupply: false },
        long: { hpFraction: 1, resourceFraction: 1, consumesSupply: true }
      };
      const key = type || this.data?.rest?.defaultType || 'long';
      const fromData = this.data?.rest?.types?.[key];
      return { ...(defaults[key] || defaults.long), ...(fromData || {}) };
    },

    /**
     * Отдых: восстановление HP и классового ресурса.
     * @param {string} [type] — опционально 'short' | 'long' из data.rest.types.
     * supplies > 0: −1 припас, HP = maxHp, ресурс = max.
     * supplies === 0: +50% maxHp и +50% ресурса (отдых не блокируется).
     */
    rest(type) {
      const resourcesFull = this.state.resources?.mode === 'spellSlots'
        ? Object.values(this.state.resources.spellSlots || {}).every(s => s.c >= s.m)
        : this.state.resources.current >= this.state.resources.max;
      if (this.state.hp >= this.state.maxHp && resourcesFull) {
        this.log('Вы уже полностью отдохнувшие.', 'log-dice');
        return;
      }

      const cfg = this.getRestConfig(type);
      const hpBefore = this.state.hp;
      const resBefore = this.state.resources?.mode === 'spellSlots'
        ? Object.values(this.state.resources.spellSlots || {}).reduce((s, x) => s + x.c, 0)
        : this.state.resources.current;
      const resName = this.state.classData?.resourceName || 'ресурс';
      const hasSupply = this.getSupplyCount() > 0;
      const isShortRest = type === 'short' || (cfg.hpFraction < 1 && cfg.hpFraction > 0);

      if (this.state.flags?.focusPotionUntil) {
        delete this.state.flags.focusPotionUntil;
        this.log('🧿 Отдых снял эффект зелья фокусировки.', 'log-dice');
      }

      if (hasSupply && !isShortRest) {
        this.consumeOneSupply();
        this.state.hp = this.state.maxHp;
        this.restoreAllResources();
        this.log('Вы восстановили силы и здоровье после отдыха.', 'log-heal');
      } else if (hasSupply && isShortRest) {
        this.state.hp = Math.min(this.state.maxHp, this.state.hp + Math.floor(this.state.maxHp * cfg.hpFraction));
        const resCfg = this.getClassResourceConfig(this.state.className);
        if (resCfg?.shortRestFull) {
          this.applyLevelResources(this.state.level || 1);
          this.restoreAllResources();
          this.log('Короткий отдых: ресурс класса полностью восстановлен.', 'log-heal');
        } else if (this.state.resources.mode === 'spellSlots') {
          Object.values(this.state.resources.spellSlots || {}).forEach(slot => {
            const gain = Math.floor(slot.m * cfg.resourceFraction);
            slot.c = Math.min(slot.m, slot.c + gain);
          });
        } else {
          this.state.resources.current = Math.min(
            this.state.resources.max,
            this.state.resources.current + Math.floor(this.state.resources.max * cfg.resourceFraction)
          );
        }
        if (!resCfg?.shortRestFull) {
          this.log('Короткий отдых: восстановлена часть здоровья и ресурса.', 'log-heal');
        }
      } else {
        this.state.hp = Math.min(this.state.maxHp, this.state.hp + Math.floor(this.state.maxHp / 2));
        if (this.state.resources.mode === 'spellSlots') {
          Object.values(this.state.resources.spellSlots || {}).forEach(slot => {
            const gain = Math.floor(slot.m / 2);
            slot.c = Math.min(slot.m, slot.c + gain);
          });
        } else {
          this.state.resources.current = Math.min(
            this.state.resources.max,
            this.state.resources.current + Math.floor(this.state.resources.max / 2)
          );
        }
        this.log('Без провизии здоровье восстанавливается лишь наполовину.', 'log-damage');
        this.log('Купите припасы у Джека (10 зм), чтобы полностью восстановиться после отдыха.', 'log-dice');
      }

      const hpGain = this.state.hp - hpBefore;
      const resAfter = this.state.resources?.mode === 'spellSlots'
        ? Object.values(this.state.resources.spellSlots || {}).reduce((s, x) => s + x.c, 0)
        : this.state.resources.current;
      const resGain = resAfter - resBefore;
      if (hpGain > 0) {
        this.log(`❤️ +${hpGain} ОЗ — сейчас ${this.state.hp} / ${this.state.maxHp}`, 'log-heal');
      }
      if (resGain > 0) {
        if (this.state.resources.mode === 'spellSlots') {
          this.log(`⚡ ${resName}: ячейки восстановлены (+${resGain})`, 'log-heal');
          this.playRestSpellSlotSound();
        } else {
          this.log(`⚡ ${resName}: ${this.state.resources.current} / ${this.state.resources.max}`, 'log-heal');
        }
      }
      if (hasSupply && !isShortRest) {
        this.log(`Припасов осталось: ${this.getSupplyCount()}`, 'log-dice');
      }

      this.updateUI();

      if (typeof WorldHierarchy !== 'undefined') {
        WorldHierarchy.onRestInScene(this.data, this.state, this.state.scene, isShortRest ? 'short' : 'long');
        const hubId = WorldHierarchy.getHubIdForScene(this.data, this.state.scene);
        if (hubId) {
          const st = WorldHierarchy.getSceneState(this.data, this.state, this.state.scene);
          const t = WorldHierarchy.TIME_LABELS[st.timeOfDay] || st.timeOfDay;
          if (t) this.log(`🌅 В деревне уже ${t.toLowerCase()}.`, 'log-dice');
          this.applyInheritedSceneAmbience?.(this.state.scene);
        }
      }

      const restBtn = document.getElementById('rest-btn');
      if (restBtn) {
        restBtn.classList.add('resting');
        setTimeout(() => restBtn.classList.remove('resting'), 500);
      }
      this.saveGame();
    },

    startGame() {
      if (this.needsCharacterCreation()) {
        if (this.CharacterCreator?.open) this.CharacterCreator.open();
        return;
      }
      AudioEngine.unlock();
      const nameInput = document.getElementById('start-name');
      const name = nameInput ? nameInput.value.trim() : '';
      this.setCharName(name);
      document.getElementById('name-screen').classList.add('hidden');
      document.getElementById('game-content').classList.remove('hidden');
      this.showScene(this.getFirstStorySceneId());
      this.renderInv();
      this.updateUI();
      this.initTooltips();
    },

    /** Перенос старых ключей questStages (quest_find_albert → find_albert) */
    /** Старые сохранения: площадь была привязана к village_tavern */
    migrateVisitedLocations() {
      const v = this.state.visitedLocations || {};
      if (v.village_tavern && !v.village_hub) v.village_hub = true;
      this.state.visitedLocations = v;
    },

    migrateSaveQuestStages() {
      const qs = this.state.questStages || {};
      let changed = false;
      const next = {};
      for (const [key, val] of Object.entries(qs)) {
        if (key.startsWith('quest_')) {
          next[key.slice(6)] = val;
          changed = true;
        } else {
          next[key] = val;
        }
      }
      if (changed) this.state.questStages = next;
    },

    registerMapLocation(scene) {
      if (!scene?.mapLocation) return;
      if (!this.state.visitedLocations) this.state.visitedLocations = {};
      const locId = scene.mapLocation;
      const first = !this.state.visitedLocations[locId];
      this.state.visitedLocations[locId] = true;
      if (first && typeof QuestEvents !== 'undefined') {
        QuestEvents.emit('LocationDiscovered', {
          locationId: locId,
          sceneId: scene.id || this.state.scene,
          location: scene.location || locId
        });
      }
      this.renderTravelMenu();
    },

    shouldApplySceneRewards(sceneId, scene, options = {}) {
      if (options.forceRevisit) return false;
      if (scene?.repeatRewards === true) return true;
      const visits = this.state.sceneVisits?.[sceneId] || 0;
      return visits === 0;
    },

    getCombatSourceSceneId(combat) {
      if (!combat) return null;
      const key = combat.expKey;
      if (typeof key === 'string' && key.startsWith('combat:')) return key.slice(7);
      return null;
    },

    inferClearedCombatMapLabel(enemyIds) {
      if (!enemyIds?.length) return 'поверженные';
      const joined = enemyIds.join(',');
      if (/wolf/i.test(joined)) return 'волки';
      if (/scout|bandit|thug|enforcer|cultist|robber/i.test(joined)) return 'разбойники';
      const names = enemyIds.map((id) => this.data?.enemies?.[id]?.name).filter(Boolean);
      if (names.length === 1) return names[0];
      if (names.length > 1) return names.slice(0, 2).join(', ');
      return 'поверженные';
    },

    formatClearedBodiesMapNote(label) {
      const raw = String(label || 'поверженных').trim();
      const low = raw.toLowerCase();
      if (low === 'волки' || low === 'волк') return 'тела волков';
      if (low === 'разбойники' || low === 'разбойник') return 'тела разбойников';
      return `тела: ${raw}`;
    },

    markCombatCleared(combatSceneId) {
      const raw = this.data?.scenes?.[combatSceneId];
      if (!raw?.combat?.length) return;
      if (!this.state.clearedCombats) this.state.clearedCombats = {};
      const label = raw.clearedMapLabel || this.inferClearedCombatMapLabel(raw.combat);
      this.state.clearedCombats[combatSceneId] = {
        sceneId: combatSceneId,
        mapLocation: raw.mapLocation || null,
        afterScene: raw.nextScene || null,
        enemyIds: [...raw.combat],
        label,
        icon: '☠️'
      };
      this.state.flags[`combat_cleared_${combatSceneId}`] = true;
      if (raw.mapLocation) this.state.flags[`map_combat_cleared_${raw.mapLocation}`] = true;
      this.checkAchievements({
        type: 'combat_victory',
        sceneId: combatSceneId,
        enemyIds: [...(raw.combat || [])]
      });
    },

    isCombatSceneCleared(sceneId) {
      if (this.state.clearedCombats?.[sceneId]) return true;
      if (this.state.flags?.[`combat_cleared_${sceneId}`]) return true;
      const raw = this.data?.scenes?.[sceneId];
      const after = raw?.nextScene;
      if (after && (this.state.sceneVisits?.[after] || 0) > 0) return true;
      if (this.state.expAwarded?.[`combat:${sceneId}`]) return true;
      return false;
    },

    getClearedCombatsForMap(mapLocation) {
      if (!mapLocation) return [];
      const fromState = Object.values(this.state.clearedCombats || {}).filter((c) => c.mapLocation === mapLocation);
      if (fromState.length) return fromState;
      const out = [];
      for (const [sceneId, raw] of Object.entries(this.data?.scenes || {})) {
        if (raw.mapLocation !== mapLocation || !raw.combat?.length) continue;
        if (!this.isCombatSceneCleared(sceneId)) continue;
        out.push({
          sceneId,
          mapLocation,
          afterScene: raw.nextScene || null,
          label: raw.clearedMapLabel || this.inferClearedCombatMapLabel(raw.combat),
          icon: '☠️'
        });
      }
      return out;
    },

    getClearedMapNoteForLocation(mapLocation) {
      const cleared = this.getClearedCombatsForMap(mapLocation);
      if (!cleared.length) return '';
      const notes = [...new Set(cleared.map((c) => this.formatClearedBodiesMapNote(c.label)))];
      return ` — ☠️ ${notes.join('; ')}`;
    },

    resolveMapTravelScene(mapId) {
      const loc = this.data?.worldMap?.[mapId];
      if (!loc?.hubScene) return null;
      const cleared = this.getClearedCombatsForMap(mapId);
      const withAfter = cleared.filter((c) => c.afterScene && this.data.scenes[c.afterScene]);
      if (withAfter.length === 1) return withAfter[0].afterScene;
      return loc.hubScene;
    },

    migrateClearedCombatsFromSave() {
      if (!this.data?.scenes) return;
      if (!this.state.clearedCombats) this.state.clearedCombats = {};
      for (const [sceneId, raw] of Object.entries(this.data.scenes)) {
        if (!raw.combat?.length) continue;
        if (this.state.clearedCombats[sceneId]) continue;
        if (!this.isCombatSceneCleared(sceneId)) continue;
        this.markCombatCleared(sceneId);
      }
    },

    migrateQuestMapUnlocksFromSave() {
      const qs = this.state.questStages || {};
      const locket = qs.albert_locket;
      if (locket != null && locket !== '' && locket !== '__finished__') {
        this.applyQuestMapUnlocks('albert_locket', locket);
      }
      const lukorn = qs.lukorn_investigation;
      if (lukorn != null && lukorn !== '' && lukorn !== '__finished__' && Number(lukorn) >= 1) {
        this.applyQuestMapUnlocks('lukorn_investigation', lukorn);
      }
    },

    /** Аванс Марты: торг ИЛИ принятие квеста — одна выплата, не обе. */
    awardMartaQuestPayment(sceneId) {
      if (sceneId !== 'village_accept') return 0;
      if (this.state.flags.haggleDone) return 0;
      this.state.flags.haggleDone = true;
      return 25;
    },

    awardSceneGold(scene, sceneId) {
      if (!scene) return;
      let amount = scene.gold || 0;
      if (sceneId === 'village_accept') {
        amount = this.awardMartaQuestPayment(sceneId);
      }
      if (amount > 0) {
        if (typeof this.changeGold === 'function') {
          this.changeGold(amount, { reason: 'scene', source: 'scene_reward', silent: true });
        } else {
          this.state.gold += amount;
        }
        this.updateStats();
        const note = sceneId === 'village_accept' ? ' (аванс от Марты)' : '';
        this.log(`💰 +${amount} зм${note}`, 'log-heal');
      }
    },

    renderTravelMenu() {
      const sel = document.getElementById('travel-select');
      if (!sel) return;
      const map = this.data?.worldMap;
      if (!map) {
        sel.innerHTML = '<option value="">— Карта недоступна —</option>';
        sel.disabled = true;
        return;
      }
      const visited = this.state.visitedLocations || {};
      const ctx = this.getConditionContext();
      const current = this.state.scene;
      const entries = Object.entries(map).filter(([id, loc]) => {
        if (!visited[id]) return false;
        return ConditionSystem.isChoiceVisible({ showIf: loc.showIf, hideIf: loc.hideIf }, ctx);
      });
      if (entries.length === 0) {
        sel.innerHTML = '<option value="">— Исследуйте мир —</option>';
        sel.disabled = true;
        return;
      }
      sel.disabled = false;
      let html = '<option value="">🗺️ Переместиться…</option>';
      const currentScene = this.data?.scenes?.[current];
      const currentMapId = currentScene?.mapLocation || '';
      for (const [id, loc] of entries) {
        const hub = loc.hubScene || '';
        const here = id === currentMapId || hub === current ? ' (здесь)' : '';
        const bodies = this.getClearedMapNoteForLocation(id);
        html += `<option value="${this.escapeAttr(id)}">${this.escapeHtml((loc.icon || '📍') + ' ' + (loc.label || id) + bodies + here)}</option>`;
      }
      sel.innerHTML = html;
    },

    travelTo(mapId) {
      const loc = this.data?.worldMap?.[mapId];
      if (!loc?.hubScene) return;
      if (!this.state.visitedLocations?.[mapId]) {
        this.log('❌ Вы ещё не открыли это место.', 'log-damage');
        return;
      }
      if (this.state.combat) {
        this.log('❌ Нельзя путешествовать во время боя!', 'log-damage');
        return;
      }
      this.log(`🗺️ ${loc.label || mapId}`, 'log-dice');
      const dest = this.resolveMapTravelScene(mapId) || loc.hubScene;
      this.showScene(dest, { forceRevisit: true });
    },

    onTravelSelect(el) {
      const id = el?.value;
      el.value = '';
      if (id) this.travelTo(id);
    },

    handleJackTurnIn() {
      if (this.state.flags.jackRewarded) {
        this.setText('Джек кивает: «Уже расплатился — честное слово торговца!»');
        this.clearDialogue();
        this.setChoices([{ text: '🚪 На площадь', to: 'village_hub' }]);
        return;
      }
      if (!this.state.inventory.includes('jack_bag')) {
        this.log('❌ У вас нет сумки Джека.', 'log-damage');
        this.reopenJackShop();
        return;
      }
      this.removeItem('jack_bag');
      this.applyQuestRewards('lost_bag', { claimFlag: 'jackRewarded' });
      this.updateQuest('lost_bag', '2', { silentLog: true });
      this.updateQuest('lost_bag', 'complete');
      this.updateStats();
      this.setText('Джек хватает сумку и заглядывает внутрь.\n\n«Плат на месте, фляжка... Хм. Кошелёк легче, чем должен быть. Ну, ладно.»');
      this.setDialogue([
        { speaker: 'Джек', text: 'Держи тридцать — честное слово торговца. И если найдёшь ещё что-нибудь ценное в лесу — неси сюда.' }
      ]);
      this.setChoices([
        { text: '💰 Продолжить торговлю', action: 'reopen_jack_shop' },
        { text: '🚪 На площадь', to: 'village_hub' }
      ]);
      this.saveGame();
    },

    /** Флаг истинен для шаблона {flag ? 'да' : 'нет'} */
    isTemplateFlagTrue(flagName) {
      return !!this.state.flags?.[flagName];
    },

    /**
     * Шаблоны в тексте сцен и диалогов:
     * {flag ? 'если true' : 'если false'}, [name], {charName}, {gold}, {charGender}, {if_male}...{/if_male}, {if_female}...{/if_female}
     */
    /** Подстановка текстовых сниппетов @id из data.snippets */
    expandTextSnippets(text) {
      if (text == null) return '';
      let out = String(text);
      const snippets = this.data?.snippets;
      if (!snippets || typeof snippets !== 'object') return out;
      out = out.replace(/@([a-zA-Z0-9_]+)/g, (match, id) => {
        if (Object.prototype.hasOwnProperty.call(snippets, id)) {
          return String(snippets[id]);
        }
        console.warn('[Snippets] Сниппет не найден:', id);
        return match;
      });
      return out;
    },

    processSceneTemplate(text) {
      if (text == null) return '';
      let out = this.expandTextSnippets(text);

      out = out.replace(/\[name\]/gi, this.state.charName || 'Герой');

      const flagTpl =
        /\{([a-zA-Z_][a-zA-Z0-9_]*)\s*\?\s*'((?:\\'|[^'])*)'\s*:\s*'((?:\\'|[^'])*)'\}/g;
      out = out.replace(flagTpl, (_, flag, ifTrue, ifFalse) => {
        const pick = this.isTemplateFlagTrue(flag) ? ifTrue : ifFalse;
        return pick.replace(/\\'/g, "'");
      });

      out = out.replace(/{charName}/g, this.state.charName || 'Герой');
      out = out.replace(/{gold}/g, String(this.state.gold ?? 0));

      const genderId = this.state.gender || 'male';
      const genderLabel = genderId === 'female' ? 'Женский' : 'Мужской';
      out = out.replace(/\{charGender\}/gi, genderLabel);

      out = out.replace(/\{if_male\}([\s\S]*?)\{\/if_male\}/gi, (_, content) => genderId === 'male' ? content : '');
      out = out.replace(/\{if_female\}([\s\S]*?)\{\/if_female\}/gi, (_, content) => genderId === 'female' ? content : '');

      return out;
    },

    initUI() {
      if (typeof SidebarDock !== 'undefined') SidebarDock.init();
      this.migrateCraftingState?.();
      this.initMobileSidebar();
      // Добавляем кнопку закрытия модалки
      const modalClose = document.querySelector('.modal-close');
      if (modalClose) {
        modalClose.onclick = () => this.closeModal();
      }
      // Закрытие по клику вне модалки
      const modal = document.getElementById('modal');
      if (modal) {
        modal.onclick = (e) => { if (e.target === modal) this.closeModal(); };
      }
      const levelModal = document.getElementById('levelup-modal');
      if (levelModal) {
        levelModal.onclick = (e) => { if (e.target === levelModal) e.stopPropagation(); };
      }
      this.updateAudioToggleButton();
      if (!this._combatKeyHandlerBound) {
        this._combatKeyHandlerBound = true;
        document.addEventListener('keydown', (e) => {
          if (e.key !== 'Escape') return;
          if (GameEngine.getCombatPhase?.() === 'select_target') {
            e.preventDefault();
            GameEngine.cancelAbilityTargetSelect();
          }
        });
      }
    },
});

// Запуск при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  try {
    GameEngine.initUI();
    GameEngine.init();
  } catch (err) {
    console.error(err);
    const screen = document.getElementById('class-screen');
    if (screen) {
      screen.innerHTML =
        '<h1>Ошибка движка</h1><p style="font-family:monospace;white-space:pre-wrap;">' +
        String(err.message || err) +
        '</p><p>Обновите страницу (Ctrl+F5).</p>';
    }
  }
});
