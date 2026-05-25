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
    title: 'Дело о пропавшем поезде',
    subtitle: 'Нуар-детектив · Pathfinder 2e',
    description: 'Расследование на рельсах: улики, проверки навыков, моральный выбор.',
    badge: 'Демо',
    dataUrl: 'data/demos/pf2e-detective-demo.json',
    inlineGlobal: 'DEMO_PF2E_DATA',
    demoScript: 'js/demo-pf2e.js',
    cacheKey: 'rpg_data_cache_pf2e',
    saveKey: 'rpg_save_pf2e',
    pageTitle: 'Дело о пропавшем поезде — Demo'
  }
};

const GameEngine = {
  data: null,
  dataSource: null,
  activeCampaignId: null,
  activeSystem: null,
  state: {
    charName: '', className: '', gender: 'male', stats: null, hp: 25, maxHp: 25, gold: 0,
    inventory: [], flags: {}, scene: 'start', combat: null,
    enemies: [], resources: { mode: 'energy', current: 0, max: 0, spellSlots: null },
    supplies: 0, classData: {}, questStages: {},
    equipped: {},
    /** Активные эффекты проклятий с надетых предметов (флаги по ID эффекта) */
    curseEffects: {},
    /** Уровень заточки по ID предмета (сохраняется отдельно от шаблона JSON) */
    itemEnhancements: {},
    level: 1, exp: 0, expAwarded: {}, pendingLevelUp: null, resumeAfterLevelUp: null,
    currentChoices: [],
    sceneVisits: {},
    visitedLocations: {}
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

  /** Все слоты экипировки (оружие, броня, щит, аксессуары) */
  EQUIPMENT_SLOTS: ['weapon', 'armor', 'shield', 'ring1', 'ring2', 'necklace', 'earrings'],

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

  /** Слот экипировки: weapon | armor | shield | ring1 | ring2 | necklace | earrings */
  getEquipSlot(item) {
    if (!item) return null;
    if (this.isAccessoryItem(item)) return this.resolveAccessoryEquipSlot(item);
    if (item.type === 'weapon' || item.slot === 'weapon') return 'weapon';
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
      || eq.offhand === itemId
      || eq.accessory === itemId;
  },

  getEquippedItemId(slot) {
    const eq = this.state.equipped || {};
    if (slot === 'shield') return eq.shield || eq.offhand || null;
    return eq[slot] || null;
  },

  /** Дефолты заточки, если в JSON предмета не заданы поля */
  DEFAULT_ENHANCEMENT_MAX: 3,
  DEFAULT_ENHANCEMENT_COSTS: [100, 300, 900],
  ENHANCEMENT_SLOTS: ['weapon', 'armor', 'shield'],

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
    const max = this.getItemEnhancementMax(template);
    if (current >= max) return null;
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
    const eq = this.getEquippedItemId('weapon');
    if (eq) return eq;
    const items = this.itemsData;
    if (cls?.mainWeapon && items[cls.mainWeapon]) return cls.mainWeapon;
    const fromInv = (this.state.inventory || []).find(id => this.isWeaponItem(items[id]));
    if (fromInv) return fromInv;
    return (cls?.startingItems || []).find(id => this.isWeaponItem(items[id])) || null;
  },

  migrateEquippedSlots() {
    const eq = this.state.equipped || {};
    if (eq.offhand && !eq.shield) {
      eq.shield = eq.offhand;
      delete eq.offhand;
    }
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

  /** Урон оружия: кость + мод. характеристики; без оружия — 1 + СИЛ */
  computeWeaponDamageProfile() {
    const stats = this.getPlayerStats();
    const weaponId = this.getEquippedItemId('weapon');
    const weapon = weaponId ? this.itemsData[weaponId] : null;

    if (weapon && this.isWeaponItem(weapon)) {
      const statKey = String(weapon.stat || 'str').toLowerCase();
      const statMod = this.getModifier(stats[statKey] ?? 10);
      return {
        dmgRoll: weapon.damage || weapon.dmgRoll || '1d6',
        dmgBonus: statMod,
        statKey,
        weaponName: weapon.name || 'Оружие',
        weaponId
      };
    }

    const strMod = this.getModifier(stats.str ?? 10);
    return {
      dmgRoll: '1',
      dmgBonus: strMod,
      statKey: 'str',
      weaponName: 'Кулаки',
      weaponId: null
    };
  },

  formatEquippedDamageLabel(stats) {
    const s = stats || this.state.classData;
    if (!s) return '—';
    const roll = s.dmgRoll || '1';
    const bonus = s.dmgBonus ?? 0;
    const modStr = bonus >= 0 ? '+' + bonus : String(bonus);
    const name = s.weaponName ? ` (${s.weaponName})` : '';
    return `${roll}${modStr}${name}`;
  },

  rollPlayerWeaponDamage(critical) {
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

    const stats = {
      ac: this.computePlayerAC() + equipBonuses.acBonus,
      atkBonus: prof + atkStatMod + equipBonuses.atkBonus,
      dmgRoll: weaponProfile.dmgRoll,
      dmgBonus: weaponProfile.dmgBonus + equipBonuses.dmgBonus,
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
    return map[damageType] || map.physical || null;
  },

  resolveEffectTypeSound(effectType) {
    const map = this.data?.audio?.defaults?.effectType || {};
    return map[effectType] || null;
  },

  playCombatSound(soundId, volume) {
    if (!soundId) return;
    AudioEngine.playSFX(soundId, { volume });
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

  // ========== ПОДСКАЗКИ UI (ui_hints) ==========
  _tooltipDelayMs: 300,
  _tooltipShowTimer: null,
  _tooltipActiveIcon: null,
  _tooltipMoveHandler: null,
  _tooltipMousedownBound: false,

  getHintText(hintKey) {
    if (!hintKey || !this.data?.ui_hints) return null;
    const text = this.data.ui_hints[hintKey];
    if (text == null || String(text).trim() === '') return null;
    return String(text);
  },

  hideTooltip() {
    if (this._tooltipShowTimer) {
      clearTimeout(this._tooltipShowTimer);
      this._tooltipShowTimer = null;
    }
    this._tooltipActiveIcon = null;
    if (this._tooltipMoveHandler) {
      document.removeEventListener('mousemove', this._tooltipMoveHandler);
      this._tooltipMoveHandler = null;
    }
    const el = document.getElementById('ui-tooltip');
    if (el) {
      el.style.display = 'none';
      el.textContent = '';
    }
  },

  positionTooltip(pageX, pageY) {
    const el = document.getElementById('ui-tooltip');
    if (!el || el.style.display === 'none') return;
    const offset = 14;
    let left = pageX + offset;
    let top = pageY + offset;
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) {
      left = pageX - rect.width - offset;
      el.style.left = Math.max(8, left) + 'px';
    }
    if (rect.bottom > window.innerHeight - 8) {
      top = pageY - rect.height - offset;
      el.style.top = Math.max(8, top) + 'px';
    }
  },

  showTooltip(text, pageX, pageY) {
    const el = document.getElementById('ui-tooltip');
    if (!el || !text) return;
    el.textContent = text;
    el.style.display = 'block';
    this.positionTooltip(pageX, pageY);
  },

  initTooltips() {
    if (!this._tooltipMousedownBound) {
      this._tooltipMousedownBound = true;
      document.addEventListener('mousedown', () => this.hideTooltip());
    }

    document.querySelectorAll('.info-icon').forEach(icon => {
      if (icon._tooltipInited) return;
      icon._tooltipInited = true;

      icon.addEventListener('mouseenter', (e) => {
        const key = icon.getAttribute('data-hint');
        const text = this.getHintText(key);
        if (!text) return;

        this._tooltipActiveIcon = icon;
        if (this._tooltipShowTimer) clearTimeout(this._tooltipShowTimer);

        this._tooltipShowTimer = setTimeout(() => {
          this._tooltipShowTimer = null;
          if (this._tooltipActiveIcon !== icon) return;
          this.showTooltip(text, e.pageX, e.pageY);

          if (this._tooltipMoveHandler) {
            document.removeEventListener('mousemove', this._tooltipMoveHandler);
          }
          this._tooltipMoveHandler = (ev) => this.positionTooltip(ev.pageX, ev.pageY);
          document.addEventListener('mousemove', this._tooltipMoveHandler);
        }, this._tooltipDelayMs);
      });

      icon.addEventListener('mouseleave', () => {
        if (this._tooltipActiveIcon === icon) this._tooltipActiveIcon = null;
        this.hideTooltip();
      });
    });
  },

  playAbilityHit(ability, effect) {
    const eff = effect || ability?.effect;
    const dt = eff && typeof eff === 'object' ? eff.damageType : null;
    const soundId = this.resolveSoundId(
      eff?.soundHit,
      ability?.soundHit,
      ability?.sounds?.hit,
      dt && this.resolveDamageTypeSound(dt),
      eff && typeof eff === 'object' && this.resolveEffectTypeSound(eff.type)
    );
    if (soundId) this.playCombatSound(soundId);
  },

  getConditionContext() {
    return {
      flags: { ...(this.state.flags || {}) },
      inventory: [...(this.state.inventory || [])],
      gold: this.state.gold ?? 0,
      className: this.state.className || '',
      questStages: { ...(this.state.questStages || {}) },
      quests: this.data?.quests || {}
    };
  },

  filterChoicesByConditions(choices) {
    if (!Array.isArray(choices)) return [];
    const ctx = this.getConditionContext();
    return choices.filter(c => ConditionSystem.isChoiceVisible(c, ctx));
  },

  getAttackSoundId() {
    const cls = this.state.classData;
    const weaponId = this.getEquippedItemId('weapon') || this.getEquippedWeaponId(cls);
    const weapon = weaponId ? this.itemsData[weaponId] : null;
    const attackDefaults = this.data?.audio?.defaults?.attack || {};
    return this.resolveSoundId(
      cls?.attackSound,
      weapon?.soundHit,
      weapon?.sound,
      weaponId && attackDefaults[weaponId],
      weaponId === 'staff' && attackDefaults.staff,
      weaponId === 'longsword' && attackDefaults.sword,
      weaponId === 'morningstar' && attackDefaults.blunt,
      attackDefaults.default,
      'slash_physical'
    );
  },

  escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  },

  escapeAttr(str) {
    return this.escapeHtml(str).replace(/"/g, '&quot;');
  },

  /** onclick="GameEngine.method(...)" — кавычки не ломают HTML-атрибут */
  onclickGame(method, ...args) {
    const expr = 'GameEngine.' + method + '(' + args.map(a => JSON.stringify(a)).join(', ') + ')';
    return 'onclick="' + this.escapeAttr(expr) + '"';
  },

  renderIcon(icon) {
    const value = String(icon || '').trim();
    if (!value) return '';
    const isImage = /^((https?:)?\/\/|\.\/|\/).+\.(png|jpe?g|gif|svg)$/i.test(value);
    if (isImage) {
      return `<img src="${this.escapeAttr(value)}" alt="icon" class="inline-icon">`;
    }
    return this.escapeHtml(value);
  },

  normalizeAbilities(abilities, classKey) {
    return (abilities || []).map((ab, i) => this.normalizeAbility(ab, classKey, i));
  },

  normalizeAbility(ab, classKey, index) {
    const copy = JSON.parse(JSON.stringify(ab || {}));
    if (!copy.id) copy.id = (classKey || 'hero') + '_ability_' + ((index ?? 0) + 1);
    if (copy.usage === 'combat') copy.combatOnly = true;
    if (copy.usage === 'world' || copy.usage === 'exploration') copy.combatOnly = false;
    return copy;
  },

  /** Слияние сохранённого умения с актуальным из game_data (старый + новый формат effect) */
  reconcileAbility(saved, def, classKey, index) {
    if (!def) return this.normalizeAbility(saved, classKey, index);
    const merged = { ...JSON.parse(JSON.stringify(def)), ...saved };
    const savedHasEffect = merged.effect != null || (merged.effects && merged.effects.length);
    if (!savedHasEffect) {
      if (def.effect != null) merged.effect = def.effect;
      if (def.effects) merged.effects = def.effects;
    } else if (typeof saved.effect === 'string' && def.effect && typeof def.effect === 'object') {
      merged.effect = def.effect;
    }
    if (def.passive && !merged.passive) merged.passive = def.passive;
    if (def.type && !merged.type) merged.type = def.type;
    if (def.targeting && !merged.targeting) merged.targeting = def.targeting;
    if (def.spellLevel != null && merged.spellLevel == null) merged.spellLevel = def.spellLevel;
    if (def.concentration != null && merged.concentration == null) merged.concentration = def.concentration;
    return this.normalizeAbility(merged, classKey, index);
  },

  isConcentrationAbility(ability) {
    return !!(ability && ability.concentration === true);
  },

  reconcileAbilities(savedList, classKey) {
    const defs = this.data?.classes?.[classKey]?.abilities || [];
    const defById = Object.fromEntries(defs.map(d => [d.id, d]));
    const pool = this.getProgression().abilities || {};
    return (savedList || []).map((saved, i) => {
      const def = defById[saved.id] || pool[saved.id];
      return this.reconcileAbility(saved, def, classKey, i);
    });
  },

  isAbilityCombatOnly(ab) {
    if (ab.combatOnly === true) return true;
    if (ab.combatOnly === false) return false;
    return ab.usage === 'combat';
  },

  applyAcBonus(bonus) {
    if (!this.state.combat) return;
    const b = parseInt(bonus, 10) || 0;
    if (b === 4) {
      this.state.combat.shieldBlock = true;
      this.log('🛡️ +4 КД до вашего следующего хода', 'log-combat');
    } else if (b === 5) {
      this.state.combat.shieldSpell = true;
      this.log('🔰 +5 КД против следующей атаки', 'log-combat');
    } else if (b === 2) {
      this.state.combat.shieldOfFaith = true;
      this.log('🛡️ +2 КД', 'log-combat');
    } else {
      this.state.combat.tempAcBonus = (this.state.combat.tempAcBonus || 0) + b;
      this.log(`🛡️ +${b} КД до следующего хода`, 'log-combat');
    }
  },

  formatDamageLabel(dmgRoll, dmgBonus) {
    const roll = dmgRoll || '1d6';
    const bonus = dmgBonus ?? 0;
    return bonus ? `${roll}+${bonus}` : roll;
  },

  getExpThreshold(level) {
    const table = this.getProgression().expTable || [0];
    const idx = Math.max(0, (level || 1) - 1);
    return table[idx] ?? table[table.length - 1] ?? 0;
  },

  getMaxLevel() {
    const pg = this.getProgression();
    return pg.maxLevel || pg.expTable?.length || 1;
  },

  getExpToNextLevel() {
    if (!this.isProgressionEnabled()) return 0;
    if (this.state.level >= this.getMaxLevel()) return 0;
    return Math.max(0, this.getExpThreshold(this.state.level + 1) - this.state.exp);
  },

  getClassLevelConfig(level) {
    const cls = this.data?.classes?.[this.state.className];
    return cls?.progression?.levels?.[String(level)] || cls?.progression?.levels?.[level] || null;
  },

  /** Массив ячеек по уровню персонажа (D&D 5e tables в progression.levels / baseSlots) */
  getSlotsArrayForLevel(classKey, level) {
    const cls = this.data?.classes?.[classKey];
    if (!cls) return null;
    let best = null;
    if (level >= 1 && Array.isArray(cls.baseSlots) && cls.baseSlots.length) {
      best = cls.baseSlots;
    }
    for (let l = 1; l <= level; l++) {
      const slots = cls.progression?.levels?.[String(l)]?.slots;
      if (Array.isArray(slots) && slots.length) best = slots;
    }
    return best;
  },

  getResourceMode(classKey, level) {
    if (this.activeSystem?.getResourceMode) {
      return this.activeSystem.getResourceMode(classKey, level, this.data, this);
    }
    const cls = this.data?.classes?.[classKey];
    if (!cls) return 'energy';
    const lvl = level ?? this.state.level ?? 1;
    const slots = this.getSlotsArrayForLevel(classKey, lvl);
    if (!slots || !slots.length) return 'energy';
    if (cls.spellcasting && slots.length >= 1) return 'spellSlots';
    if (cls.halfCaster && lvl >= 2 && slots.length >= 1) return 'spellSlots';
    if (slots.length === 1 && !cls.spellcasting && !cls.halfCaster) return 'energy';
    if (slots.length > 1) return 'spellSlots';
    return 'energy';
  },

  buildSpellSlotsFromArray(slotsArray) {
    const out = {};
    (slotsArray || []).forEach((max, i) => {
      const n = Number(max) || 0;
      if (n > 0) out[String(i + 1)] = { c: n, m: n };
    });
    return out;
  },

  initResourcesFromLevel(level) {
    const classKey = this.state.className;
    if (!classKey || !this.data?.classes?.[classKey]) {
      this.state.resources = { mode: 'energy', current: 0, max: 0, spellSlots: null };
      return;
    }
    if (this.activeSystem?.initResources && this.activeSystem.id === 'pf2e') {
      this.state.resources = this.activeSystem.initResources(classKey, level, this.data, this);
      return;
    }
    const mode = this.getResourceMode(classKey, level);
    if (mode === 'spellSlots') {
      const arr = this.getSlotsArrayForLevel(classKey, level) || [2];
      this.state.resources = {
        mode: 'spellSlots',
        spellSlots: this.buildSpellSlotsFromArray(arr),
        current: 0,
        max: 0
      };
    } else {
      const cls = this.data.classes[classKey];
      const arr = this.getSlotsArrayForLevel(classKey, level);
      let max = cls.resource?.max ?? 2;
      if (arr && arr.length === 1) max = Number(arr[0]) || max;
      this.state.resources = {
        mode: 'energy',
        current: max,
        max,
        spellSlots: null
      };
    }
  },

  applyLevelResources(level) {
    this.initResourcesFromLevel(level);
    this.renderSpellSlotsPanel();
  },

  restoreAllResources() {
    const r = this.state.resources;
    if (!r) return;
    if (r.mode === 'spellSlots' && r.spellSlots) {
      Object.values(r.spellSlots).forEach(slot => {
        slot.c = slot.m;
      });
    } else if (r.mode === 'focus') {
      r.current = r.max ?? 0;
    } else {
      r.current = r.max ?? 0;
    }
  },

  migrateResourcesState() {
    const r = this.state.resources;
    if (!r || !this.state.className) return;
    if (r.spellSlots && typeof r.spellSlots === 'object') {
      r.mode = r.mode || 'spellSlots';
      return;
    }
    if (r.mode === 'spellSlots') return;
    const hasLegacy = r.max != null && r.current != null && !r.spellSlots;
    if (hasLegacy && this.getResourceMode(this.state.className, this.state.level) === 'spellSlots') {
      this.initResourcesFromLevel(this.state.level || 1);
      return;
    }
    if (!r.mode) {
      r.mode = 'energy';
      if (r.max == null) r.max = r.current ?? 2;
      if (r.current == null) r.current = r.max;
    }
  },

  getAbilitySpellLevel(ability) {
    if (!ability) return 0;
    const sl = ability.spellLevel;
    if (sl == null || sl === '' || sl === false) return 0;
    const n = parseInt(sl, 10);
    return Number.isFinite(n) && n >= 1 && n <= 5 ? n : 0;
  },

  /** Предмет помечен как проклятый в данных */
  isItemCursed(db) {
    return db?.cursed === true;
  },

  /** ID эффектов проклятия предмета */
  getItemCurseEffects(db) {
    const arr = db?.curseEffects;
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  },

  /** Сцена снятия проклятия (дефолт — храм) */
  getCurseRemoveSceneId(db) {
    const id = db?.curseRemoveScene;
    if (id && String(id).trim()) return String(id).trim();
    return 'temple_priest';
  },

  getSceneDisplayName(sceneId) {
    const scene = this.data?.scenes?.[sceneId];
    return scene?.location || scene?.name || sceneId || '—';
  },

  /** Человекочитаемый список эффектов проклятия */
  formatCurseEffectsList(dbOrEffects) {
    const ids = Array.isArray(dbOrEffects)
      ? dbOrEffects
      : this.getItemCurseEffects(dbOrEffects);
    return ids.map(id => this.CURSE_EFFECT_DEFS[id]?.label || id).join(', ') || '—';
  },

  hasCurseEffect(effectId) {
    return !!this.state.curseEffects?.[effectId];
  },

  isSilencedByCurse() {
    return this.hasCurseEffect('silence');
  },

  isSpellBlockedByCurse(ability) {
    return this.isSilencedByCurse() && this.getAbilitySpellLevel(ability) >= 1;
  },

  /** Пересчёт активных проклятий по надетой экипировке */
  recalculateCurseEffectsFromEquipment() {
    const next = {};
    this.EQUIPMENT_SLOTS.forEach(slot => {
      const itemId = this.getEquippedItemId(slot);
      if (!itemId) return;
      const db = this.itemsData[itemId];
      if (!this.isItemCursed(db)) return;
      this.getItemCurseEffects(db).forEach(eff => { next[eff] = true; });
    });
    this.state.curseEffects = next;
    this.renderCurseEffectsPanel();
  },

  /** Миграция старых сохранений: curseEffects в state */
  migrateCurseState() {
    if (!this.state.curseEffects || typeof this.state.curseEffects !== 'object') {
      this.state.curseEffects = {};
    }
    this.recalculateCurseEffectsFromEquipment();
  },

  getEquippedCursedEntries() {
    const out = [];
    this.EQUIPMENT_SLOTS.forEach(slot => {
      const itemId = this.getEquippedItemId(slot);
      if (!itemId) return;
      const db = this.itemsData[itemId];
      if (!this.isItemCursed(db)) return;
      out.push({
        slot,
        itemId,
        item: db,
        cost: Math.max(0, parseInt(db.curseRemoveCost, 10) || 0)
      });
    });
    return out;
  },

  /** Попытка снять экипировку: проклятые предметы блокируются */
  canUnequipItem(itemId) {
    const db = this.itemsData[itemId];
    if (!this.isItemCursed(db)) return true;
    const sceneId = this.getCurseRemoveSceneId(db);
    const sceneName = this.getSceneDisplayName(sceneId);
    this.showCurseUnequipBlockedModal(db?.name || itemId, sceneName);
    return false;
  },

  showAlertModal(title, bodyHtml) {
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');
    if (!titleEl || !bodyEl) return;
    titleEl.textContent = title;
    bodyEl.innerHTML = bodyHtml;
    document.getElementById('modal')?.classList.remove('hidden');
  },

  showCurseUnequipBlockedModal(itemName, sceneName) {
    const safeName = this.escapeHtml(itemName);
    const safeScene = this.escapeHtml(sceneName);
    this.showAlertModal(
      '⚠️ Проклятый предмет',
      `<p>Предмет <b>${safeName}</b> проклят. Снять можно только у священника в сцене «${safeScene}».</p>
       <p style="margin-top:12px;"><button type="button" class="btn btn-primary" onclick="GameEngine.closeModal()">Понятно</button></p>`
    );
  },

  canAffordAbility(ability) {
    if (this.isSpellBlockedByCurse(ability)) return false;
    const spellLevel = this.getAbilitySpellLevel(ability);
    if (spellLevel >= 1) {
      const slot = this.state.resources?.spellSlots?.[String(spellLevel)];
      if (!slot || slot.c <= 0) return false;
    }
    if (this.isPf2e() && this.state.combat) {
      const actionCost = ability?.cost ?? 1;
      return (this.state.combat.actionsRemaining ?? 0) >= actionCost;
    }
    const cost = ability?.cost ?? 0;
    return (this.state.resources?.current ?? 0) >= cost;
  },

  spendAbilityCost(ability) {
    const spellLevel = this.getAbilitySpellLevel(ability);
    if (spellLevel >= 1) {
      const key = String(spellLevel);
      const slot = this.state.resources?.spellSlots?.[key];
      if (slot && slot.c > 0) slot.c--;
    }
    if (this.isPf2e() && this.state.combat) {
      this.spendPf2eActions(ability?.cost ?? 1);
      return;
    }
    const cost = ability?.cost ?? 0;
    if (this.state.resources) this.state.resources.current = Math.max(0, (this.state.resources.current ?? 0) - cost);
  },

  renderSpellSlotsPanel() {
    const panel = document.getElementById('spell-slots-panel');
    const legacy = document.getElementById('resources');
    const r = this.state.resources;
    if (!panel) return;

    if (r?.mode === 'focus') {
      panel.innerHTML = '';
      if (legacy) {
        legacy.textContent = `Focus ${r.current ?? 0}/${r.max ?? 0}`;
        legacy.classList.remove('hidden');
      }
      return;
    }

    if (!r || r.mode !== 'spellSlots' || !r.spellSlots) {
      panel.innerHTML = '';
      if (legacy) {
        if (r && r.mode === 'energy') {
          legacy.textContent = (r.current ?? 0) + '/' + (r.max ?? 0);
          legacy.classList.remove('hidden');
        } else {
          legacy.classList.add('hidden');
        }
      }
      if (r?.mode === 'energy' && (r.max ?? 0) > 0) {
        const label = this.escapeHtml(this.state.classData?.resourceName || 'Энергия');
        const dots = [];
        for (let i = 0; i < r.max; i++) {
          dots.push(`<span class="spell-slot-dot ${i < r.current ? 'active' : 'spent'}" title="${i < r.current ? 'доступно' : 'потрачено'}"></span>`);
        }
        panel.innerHTML = `<div class="spell-slot-row"><span class="spell-slot-label">${label}</span><div class="spell-slot-dots">${dots.join('')}</div></div>`;
      }
      return;
    }

    if (legacy) legacy.classList.add('hidden');
    const keys = Object.keys(r.spellSlots).sort((a, b) => Number(a) - Number(b));
    panel.innerHTML = keys.map(circle => {
      const slot = r.spellSlots[circle];
      const max = slot.m ?? 0;
      const cur = slot.c ?? 0;
      const dots = [];
      for (let i = 0; i < max; i++) {
        dots.push(`<span class="spell-slot-dot ${i < cur ? 'active' : 'spent'}" title="${i < cur ? 'доступно' : 'потрачено'}"></span>`);
      }
      return `<div class="spell-slot-row"><span class="spell-slot-label">Круг ${circle}</span><div class="spell-slot-dots">${dots.join('')}</div></div>`;
    }).join('');
  },

  resolveAbilityDefinition(abilityId) {
    const pool = this.getProgression().abilities || {};
    if (pool[abilityId]) return JSON.parse(JSON.stringify(pool[abilityId]));
    for (const cls of Object.values(this.data?.classes || {})) {
      const found = (cls.abilities || []).find(a => a.id === abilityId);
      if (found) return JSON.parse(JSON.stringify(found));
    }
    return null;
  },

  initProgressionState() {
    this.state.level = 1;
    this.state.exp = 0;
    this.state.expAwarded = {};
    this.state.pendingLevelUp = null;
    this.state.resumeAfterLevelUp = null;
  },

  resumeAfterLevelUp() {
    if (this.state.pendingLevelUp) return;
    const resume = this.state.resumeAfterLevelUp;
    if (!resume) return;
    this.state.resumeAfterLevelUp = null;
    if (resume.type === 'scene' && resume.id) {
      this.showScene(resume.id);
    }
  },

  renderLevelBar() {
    const levelEl = document.getElementById('char-level');
    const xpText = document.getElementById('xp-text');
    const xpFill = document.getElementById('xp-bar-fill');
    const panel = document.getElementById('level-panel');
    if (!panel) return;

    if (!this.isProgressionEnabled()) {
      panel.classList.add('hidden');
      return;
    }
    panel.classList.remove('hidden');

    const level = this.state.level || 1;
    const maxLevel = this.getMaxLevel();
    if (levelEl) levelEl.textContent = level;

    if (level >= maxLevel) {
      if (xpText) xpText.textContent = 'Макс. уровень';
      if (xpFill) xpFill.style.width = '100%';
      return;
    }

    const curThreshold = this.getExpThreshold(level);
    const nextThreshold = this.getExpThreshold(level + 1);
    const span = Math.max(1, nextThreshold - curThreshold);
    const progress = Math.max(0, Math.min(1, (this.state.exp - curThreshold) / span));

    if (xpText) xpText.textContent = `${this.state.exp} / ${nextThreshold}`;
    if (xpFill) xpFill.style.width = (progress * 100) + '%';
  },

  addExp(amount, reason) {
    if (!this.isProgressionEnabled() || !amount || amount <= 0) return;
    if (this.state.level >= this.getMaxLevel()) return;

    this.state.exp += amount;
    this.log(`⭐ +${amount} опыта${reason ? ' — ' + reason : ''}`, 'log-dice');
    this.renderLevelBar();
    this.checkLevelUp();
    this.updateStats();
    this.saveGame();
  },

  grantExpOnce(key, amount, reason) {
    if (!key || !this.isProgressionEnabled()) return;
    if (this.state.expAwarded[key]) return;
    this.state.expAwarded[key] = true;
    this.addExp(amount, reason);
  },

  getSkillCheckExp(skill, skillCheck) {
    const pg = this.getProgression();
    if (skillCheck?.exp != null) return skillCheck.exp;
    if (pg.skillExp?.[skill] != null) return pg.skillExp[skill];
    if (pg.defaults?.skillCheckExp != null) return pg.defaults.skillCheckExp;
    return 15;
  },

  awardSkillCheckExp(skill, skillCheck) {
    const exp = this.getSkillCheckExp(skill, skillCheck);
    const once = skillCheck?.expOnce !== false;
    const key = skillCheck?.expKey || `skill:${this.state.scene}:${skill}`;
    if (once) this.grantExpOnce(key, exp, 'успешная проверка');
    else this.addExp(exp, 'успешная проверка');
  },

  awardSceneExp(scene) {
    if (!scene?.exp) return;
    this.grantExpOnce(`scene:${scene.id}`, scene.exp, 'сцена');
  },

  awardQuestExp(questId) {
    const quest = this.data?.quests?.[questId];
    const exp = quest?.rewards?.exp;
    if (!exp) return;
    this.grantExpOnce(`quest:${questId}:complete`, exp, `квест «${quest.title}»`);
  },

  /**
   * Текущая стадия квеста: приоритет state.questStages, затем legacy-флаг quest_<id>.
   */
  getQuestStage(questId) {
    if (!questId) return null;
    const direct = this.state.questStages?.[questId];
    if (direct != null && direct !== '') return String(direct);
    const legacy = this.state.flags?.['quest_' + questId];
    if (legacy == null || legacy === '') return null;
    const quest = this.data?.quests?.[questId];
    if (quest && typeof QuestSystem !== 'undefined') {
      return QuestSystem.resolveStageRef(quest, legacy);
    }
    return String(legacy);
  },

  /** Квест завершён: стадия __finished__, legacy complete или текущая стадия с finish: true */
  isQuestFinished(questId) {
    const s = this.state.questStages?.[questId];
    if (s === '__finished__') return true;
    if (this.state.flags?.['quest_' + questId] === 'complete') return true;
    const quest = this.data?.quests?.[questId];
    if (!quest || s == null || s === '') return false;
    const st = QuestSystem.getStageData(quest, s);
    return !!st?.finish;
  },

  /** Синхронизация legacy-флага quest_* для старых условий и сцен */
  syncLegacyQuestFlag(questId, stageKey) {
    const quest = this.data?.quests?.[questId];
    let legacyVal = stageKey;
    if (quest?.legacyStageMap) {
      const entry = Object.entries(quest.legacyStageMap).find(([, v]) => String(v) === String(stageKey));
      if (entry) legacyVal = entry[0];
    }
    this.state.flags['quest_' + questId] = legacyVal;
  },

  /**
   * Обновляет стадию квеста, пишет log в журнал боя, обновляет сайдбар «Активные задания».
   * @param {string} questId — ID из data.quests
   * @param {string|number} stage — ключ стадии ("0") или legacy ("start", "complete")
   * @param {{ silentLog?: boolean, skipFinish?: boolean }} opts
   */
  updateQuest(questId, stage, opts = {}) {
    if (!questId || !this.data?.quests?.[questId]) return;
    const quest = this.data.quests[questId];
    const stageKey = QuestSystem.resolveStageRef(quest, stage);
    if (stageKey == null) return;

    const prev = this.getQuestStage(questId);
    const finishing = !opts.skipFinish && (
      stage === 'complete' || stageKey === '__finished__' ||
      QuestSystem.isStageFinished(quest, stageKey)
    );

    if (finishing) {
      this.state.questStages[questId] = '__finished__';
      this.syncLegacyQuestFlag(questId, 'complete');
      const st = QuestSystem.getStageData(quest, stageKey);
      if (!opts.silentLog && st?.log) this.log('📜 ' + st.log, 'log-heal');
      if (prev !== '__finished__' && prev !== stageKey) {
        this.awardQuestExp(questId);
        this.log('✅ Квест завершён: «' + (quest.title || questId) + '»', 'log-heal');
      }
    } else {
      this.state.questStages[questId] = stageKey;
      this.syncLegacyQuestFlag(questId, stageKey);
      const st = QuestSystem.getStageData(quest, stageKey);
      if (!opts.silentLog && st?.log && prev !== stageKey) {
        this.log('📜 ' + st.log, 'log-heal');
      }
    }

    this.updateUI();
    this.saveGame();
  },

  awardCombatExp(enemyIds, expKey) {
    if (!enemyIds?.length) return;
    const defaults = this.getProgression().defaults || {};
    let total = 0;
    enemyIds.forEach(id => {
      const enemy = this.data?.enemies?.[id];
      total += enemy?.exp ?? defaults.enemyExp ?? 0;
    });
    if (total <= 0) return;
    const key = expKey || `combat:${this.state.scene}`;
    this.grantExpOnce(key, total, 'победа в бою');
  },

  /**
   * Бросок таблицы loot по ID врагов из боя (все участники, включая убитых).
   * Возвращает [{ item, qty }, ...]; item === 'gold' — золото.
   */
  rollCombatLootFromEnemies(enemyIds) {
    const result = [];
    const byItem = new Map();
    const enemiesData = this.data?.enemies || {};

    (enemyIds || []).forEach(enemyId => {
      const template = enemiesData[enemyId];
      const table = template?.loot;
      if (!Array.isArray(table) || !table.length) return;

      table.forEach(entry => {
        const chance = Number(entry.chance);
        if (!entry.item || isNaN(chance) || chance <= 0) return;
        if (Math.random() >= chance) return;

        const min = Math.max(0, parseInt(entry.min, 10) || 0);
        const max = Math.max(min, parseInt(entry.max, 10) ?? min);
        let qty = min;
        if (max > min) {
          qty = min + Math.floor(Math.random() * (max - min + 1));
        }
        if (qty <= 0) return;

        const prev = byItem.get(entry.item) || 0;
        byItem.set(entry.item, prev + qty);
      });
    });

    byItem.forEach((qty, item) => result.push({ item, qty }));
    return result;
  },

  /** Подпись строки добычи для окна */
  formatLootEntryLabel(entry) {
    if (entry.item === 'gold') {
      return `${entry.qty} зм`;
    }
    const db = this.itemsData[entry.item] || this.data?.items?.[entry.item];
    const name = db?.name || entry.item;
    if (entry.qty > 1) return `${name} ×${entry.qty}`;
    return name;
  },

  /** Окно добычи после победы; награды сцены — после перехода на nextScene */
  showCombatLootModal(tempLoot, nextScene, combatSnapshot) {
    this.state.pendingCombatLoot = {
      loot: tempLoot,
      nextScene: nextScene || null,
      combat: combatSnapshot || null
    };

    const modal = document.getElementById('loot-modal');
    const body = document.getElementById('loot-modal-body');
    if (!modal || !body) {
      this.claimCombatLoot();
      return;
    }

    const lines = tempLoot.map(entry => {
      const icon = entry.item === 'gold' ? '💰' : (this.itemsData[entry.item]?.icon || '📦');
      return `<div class="loot-modal-row">${icon} ${this.escapeHtml(this.formatLootEntryLabel(entry))}</div>`;
    });
    body.innerHTML = lines.length
      ? lines.join('')
      : '<div class="loot-modal-empty">Ничего не выпало.</div>';
    modal.classList.remove('hidden');
  },

  closeCombatLootModal() {
    const modal = document.getElementById('loot-modal');
    if (modal) modal.classList.add('hidden');
  },

  /** Применить добычу: предметы в инвентарь, gold — в state.gold */
  applyCombatLootEntries(loot) {
    if (!loot?.length) return;
    loot.forEach(({ item, qty }) => {
      const n = Math.max(0, parseInt(qty, 10) || 0);
      if (n <= 0) return;
      if (item === 'gold') {
        this.state.gold += n;
        this.log(`💰 +${n} зм (добыча с врагов)`, 'log-heal');
        return;
      }
      const resolved = this.resolveItemId(item);
      if (!this.data?.items?.[resolved]) {
        console.warn('Добыча: предмет не найден:', item);
        return;
      }
      for (let i = 0; i < n; i++) {
        this.state.inventory.push(resolved);
      }
      const label = this.formatLootEntryLabel({ item: resolved, qty: n });
      this.log(`🎒 Добыча: ${label}`, 'log-heal');
    });
    this.updateUI();
  },

  /** Кнопка «Забрать»: выдать добычу и перейти на nextScene боя */
  claimCombatLoot() {
    const pending = this.state.pendingCombatLoot;
    this.closeCombatLootModal();
    if (pending?.loot?.length) {
      this.applyCombatLootEntries(pending.loot);
    }
    const next = pending?.nextScene;
    const combat = pending?.combat;
    this.state.pendingCombatLoot = null;
    this.finishCombatVictory(next, combat);
    this.saveGame();
  },

  /** Завершение победы: опыт и переход на сцену (награды gold/items — в showScene) */
  finishCombatVictory(nextScene, combat) {
    if (combat) {
      const ids = combat.enemies || combat.enemyIds || [];
      this.awardCombatExp(ids, combat.expKey);
    }
    if (nextScene && this.data.scenes[nextScene]) {
      this.showScene(nextScene);
    } else if (nextScene) {
      this.setText('Ошибка: сцена «' + nextScene + '» не найдена.');
      this.setChoices([]);
    } else {
      this.setChoices([]);
    }
  },

  applyFlags(flags) {
    if (!flags) return;
    for (const [key, value] of Object.entries(flags)) {
      if (key.startsWith('quest_')) {
        const questId = key.slice(6);
        this.updateQuest(questId, value, { silentLog: false });
        continue;
      }
      this.state.flags[key] = value;
    }
  },

  applyStartingFlags() {
    const start = { ...(this.data?.startingFlags || {}) };
    Object.assign(start, this.data?.reputation?.starting || {});
    for (const [key, value] of Object.entries(start)) {
      if (this.state.flags[key] === undefined) this.state.flags[key] = value;
    }
  },

  getReputationFactionMeta(repFlag) {
    return this.data?.reputation?.[repFlag] || null;
  },

  getReputationValue(repFlag) {
    if (!repFlag || this.state.flags[repFlag] === undefined) return null;
    const n = Number(this.state.flags[repFlag]);
    return Number.isNaN(n) ? 0 : n;
  },

  getReputationStatusLabel(value) {
    const v = Number(value) || 0;
    if (v < -10) return 'Вражда';
    if (v <= 10) return 'Нейтралитет';
    if (v < 25) return 'Дружба';
    return 'Герой';
  },

  getReputationStatusClass(value) {
    const v = Number(value) || 0;
    if (v < -10) return 'enemy';
    if (v <= 10) return 'neutral';
    if (v < 25) return 'friend';
    return 'hero';
  },

  /**
   * Множитель цены от репутации: base * (1 - rep/100), скидка до 30%, наценка до 50%.
   */
  getReputationPriceMultiplier(repFlag) {
    const rep = this.getReputationValue(repFlag);
    const n = rep == null ? 0 : rep;
    let mult = 1 - n / 100;
    return Math.max(0.7, Math.min(1.5, mult));
  },

  getShopPrice(basePrice, repFlag = 'rep_village') {
    const base = Math.max(0, Number(basePrice) || 0);
    const price = Math.ceil(base * this.getReputationPriceMultiplier(repFlag));
    return Math.max(1, price);
  },

  /** Базовая цена предмета из JSON (price или cost); без цены — 0 */
  getItemBasePrice(db) {
    if (!db) return 0;
    const raw = db.price != null ? db.price : db.cost;
    return Math.max(0, Number(raw) || 0);
  },

  /** Нормализация shopConfig сцены */
  normalizeShopConfig(scene) {
    const cfg = scene?.shopConfig || {};
    return {
      inventory: Array.isArray(cfg.inventory) ? [...cfg.inventory] : [],
      sellMultiplier: Number(cfg.sellMultiplier) || 1,
      buyMultiplier: cfg.buyMultiplier != null ? Number(cfg.buyMultiplier) : 0.5,
      repFlag: cfg.repFlag || null,
      exitScene: cfg.exitScene || null
    };
  },

  /** Цена покупки у торговца: base * sellMultiplier * репутация */
  getShopBuyPrice(itemId, shopConfig) {
    const db = this.data?.items?.[itemId];
    const base = this.getItemBasePrice(db);
    if (base <= 0) return 0;
    let price = base * (shopConfig.sellMultiplier ?? 1);
    if (shopConfig.repFlag) {
      price *= this.getReputationPriceMultiplier(shopConfig.repFlag);
    }
    return Math.max(0, Math.ceil(price));
  },

  /** Цена продажи торговцу: base * buyMultiplier * репутация */
  getShopSellPrice(itemId, shopConfig) {
    const db = this.data?.items?.[itemId];
    const base = this.getItemBasePrice(db);
    if (base <= 0) return 0;
    let price = base * (shopConfig.buyMultiplier ?? 0.5);
    if (shopConfig.repFlag) {
      price *= this.getReputationPriceMultiplier(shopConfig.repFlag);
    }
    return Math.max(0, Math.floor(price));
  },

  /** Можно ли продать предмет игроком */
  getSellItemBlockReason(itemId) {
    const db = this.data?.items?.[itemId];
    if (!db) return 'Предмет не найден';
    if (db.type === 'quest' || db.type === 'key') return 'Квестовый предмет';
    if (db.cursed === true) return 'Проклятый предмет нельзя продать';
    if (this.isItemEquipped(itemId)) return 'Сначала снимите экипировку';
    if (this.getItemBasePrice(db) <= 0) return 'Торговец не покупает';
    if (!this.state.inventory.includes(itemId)) return 'Нет в инвентаре';
    return null;
  },

  getSellableInventoryIds() {
    const seen = new Set();
    const ids = [];
    for (const itemId of this.state.inventory || []) {
      if (seen.has(itemId)) continue;
      seen.add(itemId);
      if (!this.getSellItemBlockReason(itemId)) ids.push(itemId);
    }
    return ids;
  },

  /**
   * Универсальная лавка: special "shop" + shopConfig в JSON сцены.
   */
  handleShop(sceneId, scene) {
    const cfg = this.normalizeShopConfig(scene);

    if (cfg.repFlag) {
      const rep = this.getReputationValue(cfg.repFlag);
      if (rep != null && rep <= -20) {
        this.setLocation(scene?.location || 'Лавка');
        this.setText('Торговец отворачивается.\n\n«С тобой я не торгую. Убирайся.»');
        this.clearDialogue();
        const exit = cfg.exitScene || this.getShopDefaultExit(scene);
        this.setChoices(exit ? [{ text: '🚪 Уйти', to: exit }] : []);
        return;
      }
    }

    this.setLocation(scene?.location || 'Лавка');
    if (scene?.text) this.setText(scene.text);
    else this.setText('Перед вами прилавок с товарами.');

    this.clearDialogue();
    this.state.shopSession = {
      sceneId: sceneId || this.state.scene,
      config: cfg,
      selectedBuyId: null,
      selectedSellId: null,
      message: ''
    };
    this.renderShopUI();
    this.saveGame();
  },

  getShopDefaultExit(scene) {
    if (scene?.shopConfig?.exitScene) return scene.shopConfig.exitScene;
    const ch = (scene?.choices || []).find(c => c.to);
    return ch?.to || null;
  },

  closeShop() {
    const session = this.state.shopSession;
    this.state.shopSession = null;
    const exit = session?.config?.exitScene;
    if (exit && this.data?.scenes?.[exit]) {
      this.showScene(exit);
      return;
    }
    this.setChoices([]);
    this.updateUI();
  },

  shopSelectBuy(itemId) {
    if (!this.state.shopSession) return;
    this.state.shopSession.selectedBuyId = itemId;
    this.state.shopSession.selectedSellId = null;
    this.state.shopSession.message = '';
    this.renderShopUI();
  },

  shopSelectSell(itemId) {
    if (!this.state.shopSession) return;
    this.state.shopSession.selectedSellId = itemId;
    this.state.shopSession.selectedBuyId = null;
    this.state.shopSession.message = '';
    this.renderShopUI();
  },

  shopActionBuy() {
    const session = this.state.shopSession;
    if (!session) return;
    const itemId = session.selectedBuyId;
    const cfg = session.config;
    if (!itemId) {
      session.message = 'Выберите товар у торговца.';
      this.renderShopUI();
      return;
    }
    const db = this.data?.items?.[itemId];
    const price = this.getShopBuyPrice(itemId, cfg);
    if (!db || price <= 0) {
      session.message = 'Этот товар нельзя купить.';
      this.renderShopUI();
      return;
    }
    if (this.state.gold < price) {
      session.message = `Недостаточно золота (нужно ${price} зм).`;
      this.renderShopUI();
      return;
    }
    this.state.gold -= price;
    this.addItem(itemId);
    this.updateStats();
    session.message = `Куплено: ${db.name} (−${price} зм).`;
    session.selectedBuyId = null;
    this.log(`🛒 ${db.name} (−${price} зм)`, 'log-heal');
    this.renderShopUI();
    this.saveGame();
  },

  shopActionSell() {
    const session = this.state.shopSession;
    if (!session) return;
    const itemId = session.selectedSellId;
    const cfg = session.config;
    if (!itemId) {
      session.message = 'Выберите предмет из своего инвентаря.';
      this.renderShopUI();
      return;
    }
    const reason = this.getSellItemBlockReason(itemId);
    if (reason) {
      session.message = reason;
      this.renderShopUI();
      return;
    }
    const db = this.data?.items?.[itemId];
    const price = this.getShopSellPrice(itemId, cfg);
    if (price <= 0) {
      session.message = 'Торговец не покупает этот предмет.';
      this.renderShopUI();
      return;
    }
    const idx = this.state.inventory.indexOf(itemId);
    if (idx === -1) {
      session.message = 'Предмета нет в инвентаре.';
      this.renderShopUI();
      return;
    }
    this.state.inventory.splice(idx, 1);
    if (!this.state.inventory.includes(itemId)) {
      this.unequipItem(itemId, { silent: true });
    }
    this.state.gold += price;
    this.updateStats();
    session.message = `Продано: ${db?.name || itemId} (+${price} зм).`;
    session.selectedSellId = null;
    this.log(`💰 Продажа: ${db?.name || itemId} (+${price} зм)`, 'log-heal');
    this.renderShopUI();
    this.saveGame();
  },

  shopActionLeave() {
    this.closeShop();
  },

  /**
   * Кузница: special "blacksmith" — заточка экипированного оружия/брони/щита за золото.
   */
  handleBlacksmith(sceneId, scene) {
    this.setLocation(scene?.location || 'Кузница');
    if (scene?.text) this.setText(scene.text);
    else this.setText('Кузнец осматривает ваше снаряжение.\n\n«Что будем закалять?»');
    this.clearDialogue();
    this.state.blacksmithSession = {
      sceneId: sceneId || this.state.scene,
      exitScene: scene?.exitScene || this.getShopDefaultExit(scene),
      message: ''
    };
    this.renderBlacksmithUI();
    this.saveGame();
  },

  blacksmithLeave() {
    const exit = this.state.blacksmithSession?.exitScene;
    this.state.blacksmithSession = null;
    if (exit && this.data?.scenes?.[exit]) {
      this.showScene(exit);
    } else {
      this.setChoices([]);
      this.updateUI();
    }
  },

  blacksmithEnhance(itemId) {
    const session = this.state.blacksmithSession;
    if (!session) return;

    const equippedSlot = this.ENHANCEMENT_SLOTS.find(
      s => this.getEquippedItemId(s) === itemId
    );
    if (!equippedSlot) {
      session.message = 'Предмет должен быть экипирован.';
      this.renderBlacksmithUI();
      return;
    }

    const template = this.itemsData?.[itemId];
    const current = this.getItemEnhancementLevel(itemId);
    const max = this.getItemEnhancementMax(template);
    const cost = this.getNextEnhancementCost(itemId);

    if (!template || cost == null || current >= max) {
      session.message = 'Достигнут максимум заточки.';
      this.renderBlacksmithUI();
      return;
    }

    if (this.state.gold < cost) {
      session.message = `Недостаточно золота (нужно ${cost} зм).`;
      this.renderBlacksmithUI();
      return;
    }

    this.state.gold -= cost;
    this.setItemEnhancementLevel(itemId, current + 1);
    this.recalcDerivedStats();
    this.updateStats();

    const newLevel = current + 1;
    session.message = `Успех! ${template.name} теперь +${newLevel}. (−${cost} зм)`;
    this.log(`⚒️ Заточка: ${template.name} +${newLevel} (−${cost} зм)`, 'log-heal');
    this.renderBlacksmithUI();
    this.saveGame();
  },

  /**
   * Храм: special "temple_priest" — снятие проклятия с надетых предметов за золото.
   */
  handleTemplePriest(sceneId, scene) {
    this.setLocation(scene?.location || 'Храм');
    if (scene?.text) this.setText(scene.text);
    else this.setText('Священник осматривает ваше снаряжение.\n\n«Проклятие можно снять с того, что на вас надето — за подношение.»');
    this.clearDialogue();
    this.state.templePriestSession = {
      sceneId: sceneId || this.state.scene,
      exitScene: scene?.exitScene || this.getShopDefaultExit(scene),
      message: ''
    };
    this.renderTemplePriestUI();
    this.saveGame();
  },

  templePriestLeave() {
    const exit = this.state.templePriestSession?.exitScene;
    this.state.templePriestSession = null;
    if (exit && this.data?.scenes?.[exit]) {
      this.showScene(exit);
    } else {
      this.setChoices([]);
      this.updateUI();
    }
  },

  templePriestRemoveCurse(itemId) {
    const session = this.state.templePriestSession;
    if (!session) return;

    const entry = this.getEquippedCursedEntries().find(e => e.itemId === itemId);
    if (!entry) {
      session.message = 'Предмет не надет или не проклят.';
      this.renderTemplePriestUI();
      return;
    }

    const db = entry.item;
    const cost = entry.cost;
    if (this.state.gold < cost) {
      session.message = `Недостаточно золота (нужно ${cost} зм).`;
      this.renderTemplePriestUI();
      return;
    }

    this.state.gold -= cost;
    delete this.state.equipped[entry.slot];
    if (entry.slot === 'shield') delete this.state.equipped.offhand;

    this.recalculateCurseEffectsFromEquipment();
    this.recalcDerivedStats();
    this.updateStats();

    session.message = `Священник снял ${db.name}. Предмет остаётся проклятым.`;
    this.log(`✨ Священник снял ${db.name} (−${cost} зм). Предмет в инвентаре, проклятие вернётся при надевании.`, 'log-heal');
    this.renderTemplePriestUI();
    this.saveGame();
  },

  renderTemplePriestUI() {
    const area = document.getElementById('choices-area');
    if (!area || !this.state.templePriestSession) return;

    const session = this.state.templePriestSession;
    const entries = this.getEquippedCursedEntries();

    let listHtml = '<div class="temple-priest-list">';
    if (!entries.length) {
      listHtml += '<p class="hint">Нет надетых проклятых предметов.</p>';
    } else {
      entries.forEach(e => {
        const afford = this.state.gold >= e.cost;
        const effects = this.formatCurseEffectsList(e.item);
        listHtml += `<div class="temple-priest-row">
          <span><b>${this.escapeHtml(e.item.name)}</b> — ${this.escapeHtml(effects)}</span>
          <button type="button" class="choice temple-priest-btn${afford ? '' : ' temple-priest-btn--poor'}"
            ${afford ? `onclick="GameEngine.templePriestRemoveCurse('${this.escapeAttr(e.itemId)}')"` : 'disabled'}>
            Снять за ${e.cost} зм
          </button>
        </div>`;
      });
    }
    listHtml += '</div>';

    const msg = session.message
      ? `<p class="temple-priest-msg">${this.escapeHtml(session.message)}</p>`
      : '';

    area.innerHTML = `
      <div class="temple-priest-panel">
        <div class="temple-priest-header">☦️ Священник</div>
        <p class="hint">Золото: ${this.state.gold} зм. Снимается только с надетых вещей; предмет остаётся проклятым.</p>
        ${listHtml}
        ${msg}
        <button type="button" class="choice" onclick="GameEngine.templePriestLeave()">Уйти</button>
      </div>`;
  },

  renderBlacksmithUI() {
    const area = document.getElementById('choices-area');
    if (!area || !this.state.blacksmithSession) return;

    const session = this.state.blacksmithSession;
    const entries = this.getBlacksmithEnhanceableEntries();

    let equipHtml = '<div class="blacksmith-equipped">';
    this.ENHANCEMENT_SLOTS.forEach(slot => {
      const id = this.getEquippedItemId(slot);
      const item = id ? this.getEffectiveItemData(id) : null;
      const slotLabel = slot === 'weapon' ? 'Оружие' : slot === 'armor' ? 'Броня' : 'Щит';
      if (!item) {
        equipHtml += `<div class="blacksmith-slot">${slotLabel}: <span class="hint">— пусто —</span></div>`;
      } else {
        const lvl = this.getItemEnhancementLevel(id);
        const max = this.getItemEnhancementMax(item);
        equipHtml += `<div class="blacksmith-slot">${slotLabel}: <b>${this.escapeHtml(item.name)}</b> (+${lvl}${max ? ` / +${max}` : ''})</div>`;
      }
    });
    equipHtml += '</div>';

    let actionsHtml = '';
    if (entries.length) {
      entries.forEach(e => {
        const afford = this.state.gold >= e.cost;
        actionsHtml += `<button type="button" class="choice blacksmith-enhance-btn${afford ? '' : ' blacksmith-enhance-btn--poor'}"
          ${afford ? `onclick="GameEngine.blacksmithEnhance('${this.escapeAttr(e.itemId)}')"` : 'disabled'}
          title="${afford ? '' : 'Недостаточно золота'}">
          Заточить ${this.escapeHtml(e.name)} до +${e.next} — ${e.cost} зм
        </button>`;
      });
    } else {
      actionsHtml = '<div class="hint" style="margin:8px 0;">Нет доступных улучшений (максимум или слоты пусты).</div>';
    }

    area.innerHTML = `
      <div class="blacksmith-panel">
        <div class="blacksmith-header">
          <b>⚒️ Кузница</b> · 💰 ${this.state.gold} зм
          ${session.message ? `<div class="shop-flash">${this.escapeHtml(session.message)}</div>` : ''}
        </div>
        ${equipHtml}
        <div class="blacksmith-actions">${actionsHtml}</div>
        <button type="button" class="choice" onclick="GameEngine.blacksmithLeave()">Уйти</button>
      </div>`;

    this.state.currentChoices = [];
    this.state.currentChoiceIndices = [];
  },

  /** Две колонки: товары торговца / инвентарь игрока */
  renderShopUI() {
    const area = document.getElementById('choices-area');
    if (!area || !this.state.shopSession) return;

    const session = this.state.shopSession;
    const cfg = session.config;
    const selBuy = session.selectedBuyId;
    const selSell = session.selectedSellId;

    const merchantItems = (cfg.inventory || []).filter(itemId => {
      const price = this.getShopBuyPrice(itemId, cfg);
      return price > 0 && this.data?.items?.[itemId];
    });

    const sellableIds = this.getSellableInventoryIds();
    const blockedInInv = [];
    const seen = new Set();
    for (const itemId of this.state.inventory || []) {
      if (seen.has(itemId)) continue;
      seen.add(itemId);
      const reason = this.getSellItemBlockReason(itemId);
      if (reason) blockedInInv.push({ itemId, reason, db: this.data.items[itemId] });
    }

    const renderRow = (itemId, price, selected, onClick, suffix = '') => {
      const db = this.data.items[itemId];
      const cls = 'shop-item-row' + (selected ? ' shop-item-row--selected' : '');
      return `<button type="button" class="${cls}" onclick="${onClick}">
        <span class="shop-item-name">${this.escapeHtml((db?.icon || '📦') + ' ' + (db?.name || itemId))}</span>
        <span class="shop-item-price">${price} зм${suffix}</span>
      </button>`;
    };

    let leftHtml = merchantItems.length
      ? merchantItems.map(id => renderRow(
        id,
        this.getShopBuyPrice(id, cfg),
        selBuy === id,
        `GameEngine.shopSelectBuy('${this.escapeAttr(id)}')`
      )).join('')
      : '<div class="shop-empty">Нет товаров с ценой</div>';

    let rightHtml = '';
    sellableIds.forEach(id => {
      rightHtml += renderRow(
        id,
        this.getShopSellPrice(id, cfg),
        selSell === id,
        `GameEngine.shopSelectSell('${this.escapeAttr(id)}')`,
        ''
      );
    });
    blockedInInv.forEach(({ itemId, reason, db }) => {
      rightHtml += `<div class="shop-item-row shop-item-row--disabled" title="${this.escapeAttr(reason)}">
        <span class="shop-item-name">${this.escapeHtml((db?.icon || '📦') + ' ' + (db?.name || itemId))}</span>
        <span class="shop-item-hint">${this.escapeHtml(reason)}</span>
      </div>`;
    });
    if (!rightHtml) {
      rightHtml = '<div class="shop-empty">Нечего продать</div>';
    }

    const repNote = cfg.repFlag && this.getReputationValue(cfg.repFlag) != null
      ? `<div class="shop-rep">Репутация: ${this.getReputationStatusLabel(this.getReputationValue(cfg.repFlag))} (${this.getReputationValue(cfg.repFlag)})</div>`
      : '';

    area.innerHTML = `
      <div class="shop-panel">
        <div class="shop-header">
          <b>💰 Золото: ${this.state.gold} зм</b>
          ${repNote}
          ${session.message ? `<div class="shop-flash">${this.escapeHtml(session.message)}</div>` : ''}
        </div>
        <div class="shop-columns">
          <div class="shop-column">
            <div class="shop-column-title">Товары торговца</div>
            <div class="shop-item-list">${leftHtml}</div>
          </div>
          <div class="shop-column">
            <div class="shop-column-title">Ваш инвентарь</div>
            <div class="shop-item-list">${rightHtml}</div>
          </div>
        </div>
        <div class="shop-actions">
          <button type="button" class="choice shop-action-btn" onclick="GameEngine.shopActionBuy()">Купить</button>
          <button type="button" class="choice shop-action-btn" onclick="GameEngine.shopActionSell()">Продать</button>
          <button type="button" class="choice shop-action-btn" onclick="GameEngine.shopActionLeave()">Уйти</button>
        </div>
      </div>`;

    this.state.currentChoices = [];
    this.state.currentChoiceIndices = [];
  },

  changeReputation(repFlag, amount) {
    if (!repFlag) return;
    const delta = Number(amount) || 0;
    if (!delta) return;

    const prevRaw = this.state.flags[repFlag];
    const prev = prevRaw === undefined ? 0 : Number(prevRaw) || 0;
    const next = prev + delta;
    this.state.flags[repFlag] = next;

    const meta = this.getReputationFactionMeta(repFlag);
    const factionName = meta?.name || repFlag;
    const prevStatus = this.getReputationStatusClass(prev);
    const nextStatus = this.getReputationStatusClass(next);
    const significant = Math.abs(delta) >= 5 || prevStatus !== nextStatus;

    if (significant) {
      const verb = delta > 0 ? 'улучшилась' : 'ухудшилась';
      const status = this.getReputationStatusLabel(next);
      this.log(`🤝 Репутация (${factionName}) ${verb}: ${status}`, delta > 0 ? 'log-heal' : 'log-damage');
    }
    this.renderRelationsPanel();
    this.saveGame();
  },

  applyChoiceReputation(choice) {
    if (!choice?.reputation || typeof choice.reputation !== 'object') return;
    for (const [repFlag, amount] of Object.entries(choice.reputation)) {
      this.changeReputation(repFlag, amount);
    }
  },

  renderRelationsPanel() {
    const panel = document.getElementById('relations-panel');
    const list = document.getElementById('relations-list');
    if (!panel || !list) return;

    const catalog = this.data?.reputation || {};
    const rows = [];

    Object.keys(catalog).forEach(repFlag => {
      if (repFlag === 'starting' || typeof catalog[repFlag] !== 'object') return;
      if (this.state.flags[repFlag] === undefined) return;
      const meta = catalog[repFlag];
      const value = this.getReputationValue(repFlag);
      const status = this.getReputationStatusLabel(value);
      const statusClass = this.getReputationStatusClass(value);
      rows.push(`
        <div class="relation-row">
          <span class="relation-row-name">${this.renderIcon(meta.icon || '🤝')} ${this.escapeHtml(meta.name || repFlag)}</span>
          <span class="relation-row-status relation-row-status--${statusClass}">${this.escapeHtml(status)}</span>
        </div>`);
    });

    if (!rows.length) {
      panel.classList.add('hidden');
      list.innerHTML = '';
      return;
    }

    panel.classList.remove('hidden');
    list.innerHTML = rows.join('');
  },

  applyLevelHpGain(level) {
    const cls = this.data.classes[this.state.className];
    const lvlCfg = this.getClassLevelConfig(level);
    const formula = lvlCfg?.hpGain || cls?.progression?.hpGain || this.getProgression().defaultHpGain || '1d8';
    let gain = this.parseRoll(formula);
    const con = this.getBaseStats().con || 10;
    gain += Math.floor((con - 10) / 2);
    this.state.baseMaxHp = (this.state.baseMaxHp ?? this.state.maxHp) + gain;
    this.state.hp += gain;
    this.recalcDerivedStats();
    return gain;
  },

  applyLevelStatBonuses(levelConfig) {
    if (!levelConfig?.stats) return;
    for (const [key, value] of Object.entries(levelConfig.stats)) {
      if (this.state.classData[key] != null) {
        this.state.classData[key] += value;
      }
    }
  },

  STAT_KEYS: ['str', 'dex', 'con', 'int', 'wis', 'cha'],

  STAT_LABELS: {
    str: 'СИЛ', dex: 'ЛОВ', con: 'ТЕЛ', int: 'ИНТ', wis: 'МУД', cha: 'ХАР'
  },

  /**
   * ASI: объект вида { str: 2 } или { dex: 1, wis: 1 } (сумма +2).
   */
  applyStatBonus(statsObj) {
    if (!statsObj || typeof statsObj !== 'object') return false;
    const base = this.state.stats || this.state.classData?.stats;
    if (!base) return false;

    let spent = 0;
    const parts = [];
    for (const [key, raw] of Object.entries(statsObj)) {
      if (!this.STAT_KEYS.includes(key)) continue;
      const n = Number(raw) || 0;
      if (n <= 0) continue;
      spent += n;
      const before = base[key] ?? 10;
      base[key] = Math.min(20, before + n);
      if (this.state.stats) this.state.stats[key] = base[key];
      parts.push(`${this.STAT_LABELS[key] || key} ${before}→${base[key]}`);
    }

    if (spent <= 0) return false;
    this.log(`📈 Улучшение характеристик (+${spent}): ${parts.join(', ')}`, 'log-heal');
    this.updateAbilityGrid();
    this.updateStats();
    this.recalcDerivedStats?.();
    return true;
  },

  levelConfigNeedsAsi(levelConfig) {
    return !!(levelConfig && (levelConfig.asi === true || levelConfig.type === 'asi'));
  },

  getPendingLevelChoiceIds(pending) {
    if (!pending?.choiceIds?.length) return [];
    return pending.choiceIds.filter(id => this.resolveAbilityDefinition(id));
  },

  finishPendingLevelUp() {
    const pending = this.state.pendingLevelUp;
    if (!pending) return;
    this.state.pendingLevelUp = null;
    this.closeLevelUpModal();
    this.updateStats();
    this.resumeAfterLevelUp();
    this.checkLevelUp();
    this.saveGame();
  },

  showLevelUpAsiModal(pending) {
    const modal = document.getElementById('levelup-modal');
    const title = document.getElementById('levelup-title');
    const text = document.getElementById('levelup-text');
    const choicesEl = document.getElementById('levelup-choices');
    if (!modal || !choicesEl) {
      this.finishPendingLevelUp();
      return;
    }

    pending.asiMode = pending.asiMode || '+2';
    pending.asiPicks = pending.asiPicks || {};

    if (title) title.textContent = `Уровень ${pending.level}! — характеристики`;
    const hpNote = pending.hpGain > 0 ? ` (+${pending.hpGain} макс. ОЗ).` : '';
    if (text) {
      text.textContent = `Распределите +2 очка характеристик${hpNote} Можно взять +2 к одной или +1 к двум разным.`;
    }

    const mode = pending.asiMode;
    const picks = pending.asiPicks;
    const pickCount = Object.values(picks).reduce((s, v) => s + v, 0);

    let html = `
      <div class="levelup-asi-modes">
        <button type="button" class="choice levelup-asi-mode${mode === '+2' ? ' active' : ''}" ${this.onclickGame('setLevelUpAsiMode', '+2')}">+2 к одной</button>
        <button type="button" class="choice levelup-asi-mode${mode === '+1+1' ? ' active' : ''}" ${this.onclickGame('setLevelUpAsiMode', '+1+1')}">+1 к двум</button>
      </div>
      <div class="levelup-asi-grid">
    `;

    this.STAT_KEYS.forEach(stat => {
      const val = this.state.classData.stats[stat] ?? 10;
      const mod = this.getModifier(val);
      const modStr = mod >= 0 ? '+' + mod : String(mod);
      const picked = picks[stat] || 0;
      html += `<button type="button" class="choice levelup-stat-btn" ${this.onclickGame('pickLevelUpAsiStat', stat)}>
        <span class="levelup-stat-name">${this.STAT_LABELS[stat]}</span>
        <span class="levelup-stat-val">${val}${picked ? ` (+${picked})` : ''}</span>
        <span class="levelup-stat-mod">${modStr}</span>
      </button>`;
    });

    html += `</div><p class="levelup-asi-hint">Выбрано очков: ${pickCount} / 2</p>`;

    const canConfirm = pickCount === 2;
    html += `<button type="button" class="choice levelup-asi-confirm" ${canConfirm ? this.onclickGame('confirmLevelUpAsi') : 'disabled'}>Подтвердить</button>`;

    choicesEl.innerHTML = html;
    modal.classList.remove('hidden');
  },

  setLevelUpAsiMode(mode) {
    const pending = this.state.pendingLevelUp;
    if (!pending) return;
    pending.asiMode = mode === '+1+1' ? '+1+1' : '+2';
    pending.asiPicks = {};
    this.showLevelUpAsiModal(pending);
  },

  pickLevelUpAsiStat(stat) {
    const pending = this.state.pendingLevelUp;
    if (!pending || !this.STAT_KEYS.includes(stat)) return;
    const picks = { ...(pending.asiPicks || {}) };
    const mode = pending.asiMode || '+2';
    const current = picks[stat] || 0;
    const total = Object.values(picks).reduce((s, v) => s + v, 0);

    if (mode === '+2') {
      pending.asiPicks = total === 2 && current === 2 ? {} : { [stat]: 2 };
    } else {
      if (current >= 1) {
        delete picks[stat];
      } else if (total < 2) {
        picks[stat] = 1;
      }
      pending.asiPicks = picks;
    }
    this.showLevelUpAsiModal(pending);
  },

  confirmLevelUpAsi() {
    const pending = this.state.pendingLevelUp;
    if (!pending?.asiPicks) return;
    const total = Object.values(pending.asiPicks).reduce((s, v) => s + v, 0);
    if (total !== 2) return;

    this.applyStatBonus(pending.asiPicks);
    pending.asiDone = true;

    const abilityIds = this.getPendingLevelChoiceIds(pending);
    if (abilityIds.length) {
      this.showLevelUpAbilityModal(pending.level, abilityIds, pending.hpGain, true);
      return;
    }
    this.finishPendingLevelUp();
  },

  showLevelUpAbilityModal(level, choiceIds, hpGain, afterAsi) {
    const validChoices = (choiceIds || []).filter(id => this.resolveAbilityDefinition(id));
    if (!validChoices.length) {
      this.finishPendingLevelUp();
      return;
    }

    const modal = document.getElementById('levelup-modal');
    const title = document.getElementById('levelup-title');
    const text = document.getElementById('levelup-text');
    const choicesEl = document.getElementById('levelup-choices');
    if (!modal || !choicesEl) {
      this.finishPendingLevelUp();
      return;
    }

    const pending = this.state.pendingLevelUp || {};
    pending.level = level;
    pending.choiceIds = validChoices;
    pending.hpGain = hpGain;
    pending.asiDone = afterAsi || pending.asiDone;
    this.state.pendingLevelUp = pending;

    if (title) title.textContent = `Уровень ${level}!`;
    if (text) {
      const hpPart = !afterAsi && hpGain > 0 ? ` +${hpGain} макс. ОЗ.` : '';
      text.textContent = `Выберите новое умение${hpPart}`;
    }

    choicesEl.innerHTML = validChoices.map(id => {
      const ab = this.resolveAbilityDefinition(id);
      const sl = this.getAbilitySpellLevel(ab);
      const cost = sl >= 1 ? ` (круг ${sl})` : (ab.cost != null ? ` (${ab.cost} ${this.state.classData.resourceName})` : '');
      const tag = ab.type === 'passive' || ab.passive ? ' [пассив]' : '';
      return `<button type="button" class="choice levelup-choice" ${this.onclickGame('pickLevelUpAbility', id)}>
        <span class="levelup-ab-icon">${this.escapeHtml(ab.icon || '✨')}</span>
        <span class="levelup-ab-name">${this.escapeHtml(ab.name)}${this.escapeHtml(cost)}${this.escapeHtml(tag)}</span>
        <span class="levelup-ab-desc">${this.escapeHtml(ab.desc || '')}</span>
      </button>`;
    }).join('');

    modal.classList.remove('hidden');
  },

  applyPassiveAbility(ability) {
    const passive = ability.passive;
    if (!passive) return;
    if (passive.maxHpBonus) {
      this.state.baseMaxHp = (this.state.baseMaxHp ?? this.state.maxHp) + passive.maxHpBonus;
      this.state.hp += passive.maxHpBonus;
      this.recalcDerivedStats?.();
    }
    if (passive.acBonus) this.state.classData.ac += passive.acBonus;
    if (passive.atkBonus) this.state.classData.atkBonus += passive.atkBonus;
    if (passive.resourceMaxBonus) {
      const r = this.state.resources;
      if (r?.mode === 'spellSlots' && r.spellSlots?.['1']) {
        r.spellSlots['1'].m += passive.resourceMaxBonus;
        r.spellSlots['1'].c += passive.resourceMaxBonus;
      } else if (r) {
        r.max = (r.max ?? 0) + passive.resourceMaxBonus;
        r.current = (r.current ?? 0) + passive.resourceMaxBonus;
      }
    }
  },

  addAbilityToPlayer(ability) {
    if (!ability?.id || !this.state.classData.abilities) return;
    if (this.state.classData.abilities.some(a => a.id === ability.id)) return;
    const idx = this.state.classData.abilities.length;
    this.state.classData.abilities.push(
      this.normalizeAbility(ability, this.state.className, idx)
    );
    if (ability.type === 'passive' || ability.passive) {
      this.applyPassiveAbility(ability);
    }
    this.renderAbilities();
  },

  showLevelUpModal(level, choiceIds, hpGain, levelConfig) {
    const validChoices = (choiceIds || []).filter(id => this.resolveAbilityDefinition(id));
    const needsAsi = this.levelConfigNeedsAsi(levelConfig);

    if (!needsAsi && !validChoices.length) {
      this.log('⚠️ Нет выбора на уровне ' + level, 'log-damage');
      this.renderLevelBar();
      this.resumeAfterLevelUp();
      return;
    }

    this.state.pendingLevelUp = {
      level,
      choiceIds: validChoices,
      hpGain: hpGain || 0,
      needsAsi,
      asiDone: !needsAsi
    };

    if (needsAsi) {
      this.showLevelUpAsiModal(this.state.pendingLevelUp);
      return;
    }
    this.showLevelUpAbilityModal(level, validChoices, hpGain, false);
  },

  closeLevelUpModal() {
    const modal = document.getElementById('levelup-modal');
    if (modal) modal.classList.add('hidden');
  },

  pickLevelUpAbility(abilityId) {
    const pending = this.state.pendingLevelUp;
    if (!pending) return;

    const ability = this.resolveAbilityDefinition(abilityId);
    if (!ability) {
      alert('Умение не найдено в данных progression.abilities');
      return;
    }

    this.addAbilityToPlayer(ability);
    this.log(`🎉 Новое умение: ${ability.name}`, 'log-heal');
    this.finishPendingLevelUp();
  },

  checkLevelUp() {
    if (!this.isProgressionEnabled() || this.state.pendingLevelUp) return;

    while (this.state.level < this.getMaxLevel() && this.state.exp >= this.getExpThreshold(this.state.level + 1)) {
      const newLevel = this.state.level + 1;
      this.state.level = newLevel;

      const hpGain = this.applyLevelHpGain(newLevel);
      const levelConfig = this.getClassLevelConfig(newLevel);
      this.applyLevelStatBonuses(levelConfig);
      this.applyLevelResources(newLevel);

      const choices = levelConfig?.choices || [];
      const needsAsi = this.levelConfigNeedsAsi(levelConfig);
      const hasPick = needsAsi || choices.length;

      if (hasPick) {
        this.showLevelUpModal(newLevel, choices, hpGain, levelConfig);
        const extra = needsAsi ? ' Выберите улучшение характеристик' : ' Выберите умение.';
        this.log(`🎉 Уровень ${newLevel}! +${hpGain} ОЗ.${extra}`, 'log-heal');
        this.renderLevelBar();
        return;
      }

      this.log(`🎉 Уровень ${newLevel}! +${hpGain} ОЗ`, 'log-heal');
    }

    this.renderLevelBar();
    this.resumeAfterLevelUp();
  },

  // Внутри объекта GameEngine
  applyEffect(effect, target = null) {
    // --- НОВЫЙ ФОРМАТ (объект) ---
    if (effect && typeof effect === 'object' && effect.type) {
      if (effect.type === 'apply_status') {
        this.applyAbilityAddEffect(effect, target);
        return true;
      }

      switch(effect.type) {
        case 'damage': {
          const dmg = this.parseRoll(effect.value);
          let targets = [];
          const scope = effect.targeting?.scope;
          if (effect.allTargets || scope === 'all_enemies' || scope === 'area') {
            targets = this.state.enemies.filter(e => e.hp > 0);
          } else if (scope === 'single') {
            if (target && target.hp > 0) {
              targets = [target];
            } else {
              const e = this.state.enemies.find(en => en.hp > 0);
              if (e) targets = [e];
            }
          } else if (target && target.hp > 0) {
            targets = [target];
          } else {
            const e = this.state.enemies.find(en => en.hp > 0);
            if (e) targets = [e];
          }
          for (let t of targets) {
            let finalDmg = dmg;
            if (effect.savingThrow) {
              const bonus = this.getSkillBonus(effect.savingThrow.skill);
              const roll = this.d20() + bonus;
              if (roll >= effect.savingThrow.dc) {
                if (effect.savingThrow.halfOnSave) finalDmg = Math.floor(dmg/2);
                else finalDmg = 0;
                this.log(`🧙 Спасбросок ${effect.savingThrow.skill}: ${roll} vs ${effect.savingThrow.dc} -> ${finalDmg>0?'половина':'нет'} урона`, 'log-dice');
              } else this.log(`🧙 Спасбросок провален: ${roll} vs ${effect.savingThrow.dc}`, 'log-dice');
            }
            if (finalDmg > 0) {
              t.hp -= finalDmg;
              this.log(`💥 ${t.name} получает ${finalDmg} ${effect.damageType||''} урона`, 'log-damage');
              this.playAbilityHit(this._abilitySoundCtx, effect);
              if (effect.addEffect) {
                const h = this.getEnemyEffectHolder(t);
                if (h) this.applyStatusEffect(h, effect.addEffect, this._abilitySoundCtx?.name);
              }
            }
          }
          if (effect.addEffect && !targets.length) {
            this.applyAbilityAddEffect(effect, target);
          }
          this.renderCombat();
          break;
        }
        case 'heal': {
          const amt = this.parseRoll(effect.value);
          this.heal(amt);
          this.log(`✨ Восстановлено ${amt} ОЗ`, 'log-heal');
          this.playCombatSound(this.resolveSoundId(effect.soundHit, this._abilitySoundCtx?.soundHit, 'heal'));
          break;
        }
        case 'buff': {
          this.playCombatSound(this.resolveSoundId(effect.soundCast, this._abilitySoundCtx?.soundCast, 'buff'));
          const bonus = parseInt(effect.value, 10) || 0;
          if (effect.buffType === 'ac') {
            if (this.state.combat) this.applyAcBonus(bonus);
            else this.log(`🛡️ +${bonus} КД (только в бою)`, 'log-dice');
          } else if (effect.buffType === 'atk') {
            if (this.state.combat) this.state.combat.tempAtkBonus = bonus;
            this.log(`⚔️ Временно +${bonus} к атаке`, 'log-dice');
          } else if (effect.buffType === 'dmg') {
            if (this.state.combat) this.state.combat.tempDmgBonus = bonus;
            this.log(`⚔️ Временно +${bonus} к урону`, 'log-dice');
          }
          break;
        }
        case 'extra_attack': {
          if (this.state.combat) this.state.combat.actionSurge = true;
          this.log('⚡ Дополнительная атака в этом ходу!', 'log-combat');
          return false; // не завершает ход
        }
        case 'magic_missile': {
          let total = 0;
          for (let i=0;i<3;i++) total += this.d(4)+1;
          const enemy = (target && target.hp > 0)
            ? target
            : this.state.enemies.find(e => e.hp > 0);
          if (enemy) {
            enemy.hp -= total;
            this.log(`✨ Магический снаряд: ${total} урона по ${enemy.name}!`, 'log-damage');
            this.playAbilityHit(this._abilitySoundCtx, effect);
          }
          break;
        }
        case 'smite': {
          if (this.state.combat) {
            this.state.combat.divineSmite = true;
            this.state.combat.smiteRoll = effect.value;
            this.log('⚡ Кара — нанесите удар!', 'log-combat');
          }
          return false;
        }
        case 'detect_magic':
        case 'divine_sense':
        case 'custom': {
          this.log(effect.message || effect.desc || 'Умение активировано.', 'log-dice');
          return !this.state.combat;
        }
        default: {
          this.log(`Эффект ${effect.type} пока не реализован`, 'log-dice');
        }
      }
      return true;
    }

    // --- СТАРЫЙ ФОРМАТ (строка) для обратной совместимости ---
    const eff = effect;
    if (typeof eff === 'string') {
      if (eff.startsWith('heal:')) {
        const amt = this.parseRoll(eff.slice(5));
        this.heal(amt);
        this.log(`✨ +${amt} ОЗ`, 'log-heal');
        this.playCombatSound(this.resolveSoundId(this._abilitySoundCtx?.soundHit, 'heal'));
        return true;
      }
      if (eff === 'extra_attack') {
        if (this.state.combat) this.state.combat.actionSurge = true;
        this.log('⚡ Дополнительная атака!', 'log-combat');
        return false;
      }
      if (eff.startsWith('damage:')) {
        const dmg = this.parseRoll(eff.slice(7));
        const enemy = this.state.enemies.find(e => e.hp > 0);
        if (enemy) {
          enemy.hp -= dmg;
          this.log(`💥 ${dmg} урона`, 'log-damage');
          this.playAbilityHit(this._abilitySoundCtx, { damageType: 'physical' });
        }
        return true;
      }
      if (eff.startsWith('ac_bonus:')) {
        this.applyAcBonus(parseInt(eff.split(':')[1], 10));
        return true;
      }
      if (eff === 'detect_magic') {
        this.log('Обнаружение магии активировано.', 'log-dice');
        return !this.state.combat;
      }
      if (eff === 'divine_sense') {
        this.log('Божественное чувство активировано.', 'log-dice');
        return !this.state.combat;
      }
      if (eff === 'magic_missile') {
        let total = 0;
        for (let i = 0; i < 3; i++) total += this.d(4) + 1;
        const enemy = this.state.enemies.find(e => e.hp > 0);
        if (enemy) {
          enemy.hp -= total;
          this.log(`✨ Магический снаряд: ${total} урона`, 'log-damage');
          this.playAbilityHit(this._abilitySoundCtx, { type: 'magic_missile' });
        }
        return true;
      }
      if (eff.startsWith('aoe_fire:')) {
        const dmg = this.parseRoll(eff.slice(9));
        for (let e of this.state.enemies) {
          e.hp -= dmg;
          this.log(`🔥 ${e.name}: ${dmg} урона огнём`, 'log-damage');
        }
        this.playAbilityHit(this._abilitySoundCtx, { damageType: 'fire' });
        return true;
      }
      if (eff.startsWith('smite:')) {
        if (this.state.combat) {
          this.state.combat.divineSmite = true;
          this.state.combat.smiteRoll = eff.slice(6);
          this.log('⚡ Кара — нанесите удар!', 'log-combat');
        }
        return false;
      }
    }
    // Если пассивка
    if (effect && effect.passive) {
      this.applyPassiveAbility(effect);
      return true;
    }
    this.log('Умение использовано (без эффекта).', 'log-dice');
    return true;
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
    for (const [classId, cls] of Object.entries(data.classes)) {
      cls.abilities = this.normalizeAbilities(cls.abilities, classId);
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
    this.normalizeAllClassAbilities(data);
    if (typeof QuestSystem !== 'undefined') QuestSystem.normalizeAll(data);
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
    this.initActiveSystem();
    this.dataSource = source;
    ThemeSystem.apply(data.theme);
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

  async fetchCampaignData(campaign) {
    const globalName = campaign.inlineGlobal;
    if (globalName && window[globalName]?.scenes) {
      return window[globalName];
    }

    const cached = this.loadCachedGameData(campaign.cacheKey);
    if (cached) return cached;

    if (location.protocol !== 'file:') {
      const response = await fetch(campaign.dataUrl);
      if (response.ok) return response.json();
    }

    if (campaign.demoScript && globalName) {
      await this.loadScriptOnce(campaign.demoScript, globalName);
      if (window[globalName]?.scenes) return window[globalName];
    }

    if (campaign.id === 'melnitsa' && window.GAME_DATA_INLINE?.scenes) {
      return window.GAME_DATA_INLINE;
    }

    throw new Error('Не удалось загрузить данные для «' + campaign.title + '»');
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

    grid.innerHTML = Object.values(CAMPAIGNS).map(c => {
      const hasSave = this.hasCampaignSave(c);
      const saveHint = hasSave
        ? '<span class="campaign-card-save">💾 Есть сохранение</span>'
        : '';
      return `
        <button type="button" class="campaign-card" onclick="GameEngine.launchCampaign('${c.id}')">
          <span class="campaign-card-badge">${this.escapeHtml(c.badge)}</span>
          <span class="campaign-card-title">${this.escapeHtml(c.title)}</span>
          <span class="campaign-card-sub">${this.escapeHtml(c.subtitle)}</span>
          <span class="campaign-card-desc">${this.escapeHtml(c.description)}</span>
          ${saveHint}
          <span class="campaign-card-cta">${hasSave ? 'Продолжить / начать заново' : 'Играть'}</span>
        </button>`;
    }).join('');

    document.title = 'RPGengine — выбор приключения';
  },

  hideCampaignPicker() {
    document.body.classList.remove('campaign-selecting');
    document.getElementById('campaign-picker-screen')?.classList.add('hidden');
    document.getElementById('sidebar')?.classList.remove('hidden');
    if (typeof SidebarDock !== 'undefined') SidebarDock.setVisible(true);
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

  // ========== ЛОГ ==========
  log(msg, cls = '') {
    const el = document.getElementById('log');
    if (!el) return;
    const div = document.createElement('div');
    div.className = 'log-entry ' + cls;
    div.textContent = msg;
    el.prepend(div);
  },

  // ========== УПРАВЛЕНИЕ СОСТОЯНИЕМ ==========
  setCharName(name) {
    this.state.charName = name || 'Герой';
    const inp = document.getElementById('char-name-input');
    if (inp) inp.value = this.state.charName;
  },

  addItem(itemId) {
    if (!itemId) return;
    itemId = this.resolveItemId(itemId);
    if (!this.data?.items?.[itemId]) return;

    if (!this.state.inventory.includes(itemId)) {
      this.state.inventory.push(itemId);
      this.updateUI();
    }
  },

  removeItem(itemId) {
    itemId = this.resolveItemId(itemId);
    this.state.inventory = this.state.inventory.filter(i => i !== itemId);
    this.unequipItem(itemId, { silent: true });
    this.updateUI();
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

  equipItem(itemId) {
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

    const slot = this.getEquipSlot(db);
    if (!slot) {
      this.log('Этот предмет нельзя экипировать.', 'log-dice');
      return;
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

    const slots = ['weapon', 'armor', 'shield', ...this.ACCESSORY_SLOTS];
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
      return { itemRemoved: false };
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
    if (this.isGameplayEquippable(db)) {
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
    } else if (category === 'consumable' && db.use) {
      const label = this.getConsumableButtonLabel(db);
      actions = `<button type="button" class="inv-btn inv-btn-use" ${this.onclickGame('useItem', itemId)}>${this.escapeHtml(label)}</button>`;
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
        ${icon}${cursedMark}${equipTag}${this.escapeHtml(db.name)}
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
      { key: 'weapon', label: 'Оружие' },
      { key: 'armor', label: 'Броня' },
      { key: 'shield', label: 'Щит' }
    ];
    const accSlots = [
      { key: 'ring1', label: 'Кольцо 1' },
      { key: 'ring2', label: 'Кольцо 2' },
      { key: 'necklace', label: 'Ожерелье' },
      { key: 'earrings', label: 'Серьги' }
    ];

    const renderSlot = (key, label) => {
      const itemId = this.getEquippedItemId(key);
      const item = itemId ? this.itemsData[itemId] : null;
      const icon = item?.icon ? this.escapeHtml(item.icon) : '—';
      const name = item ? this.escapeHtml(item.name) : 'Пусто';
      const unequip = itemId
        ? `<button type="button" class="equip-slot-btn" ${this.onclickGame('unequipItem', key)} title="Снять">✕</button>`
        : '';
      return `<div class="equip-slot-row">
        <span class="equip-slot-label">${label}</span>
        <span class="equip-slot-icon">${icon}</span>
        <span class="equip-slot-name">${name}</span>
        ${unequip}
      </div>`;
    };

    let html = '<div class="equip-slots-block"><div class="equip-slots-title">Экипировка</div>';
    html += mainSlots.map(s => renderSlot(s.key, s.label)).join('');
    html += '</div><div class="equip-slots-block equip-slots-block--accessories">';
    html += '<div class="equip-slots-title">Аксессуары</div>';
    html += accSlots.map(s => renderSlot(s.key, s.label)).join('');
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
    this.renderTravelMenu();
    this.renderActiveQuests();
    this.initTooltips();
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

      const stage = QuestSystem.getStageData(quest, stageKey);

      if (!stage || stage.finish) return;

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
    if (supEl) supEl.textContent = this.state.supplies;
    const hpBar = document.getElementById('hp-bar-fill');
    if (hpBar) {
      const pct = Math.max(0, (this.state.hp / this.state.maxHp) * 100);
      hpBar.style.width = pct + '%';
    }
    this.renderLevelBar();
    this.renderRelationsPanel();
    this.renderInv();
    if (this.state.combat && typeof this.getEffectivePlayerAC === 'function') {
      const acEl = document.getElementById('ac-val');
      const atkEl = document.getElementById('atk-val');
      if (acEl) acEl.textContent = this.getEffectivePlayerAC();
      if (atkEl) atkEl.textContent = '+' + this.getEffectivePlayerAtkBonus();
    } else {
      this.recalculateCombatStats();
    }
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
    this.state.classData = {};
    this.state.equipped = {};
    this.state.curseEffects = {};
    this.state.itemEnhancements = {};
    this.state.className = '';
    this.state.charName = '';
    this.state.gender = 'male';
    this.state.questStages = {};
    this.state.sceneVisits = {};
    this.state.visitedLocations = {};
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
            ${(cls.abilities || []).slice(0, 3).map(ab => `<div class="class-ab">${this.renderIcon(ab.icon)} ${this.escapeHtml(ab.name)}</div>`).join('')}
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

  renderRaceDisplay(raceKey) {
    const race = this.getRaceData(raceKey);
    const el = document.getElementById('race-display');
    if (!el) return;
    if (!race) {
      el.innerHTML = '';
      el.classList.add('hidden');
      return;
    }
    el.classList.remove('hidden');
    el.innerHTML = `<span class="class-display-icon">${this.renderIcon(race.icon)}</span><span class="class-display-name">${this.escapeHtml(race.name)}</span>`;
  },

  renderClassDisplay(classKey) {
    const cls = classKey ? this.data?.classes?.[classKey] : null;
    const el = document.getElementById('class-display');
    if (!el) return;
    this.renderRaceDisplay(this.state.raceKey);
    if (!cls) {
      el.innerHTML = '';
      return;
    }
    const race = this.state.raceData || this.getRaceData(this.state.raceKey);
    const raceHtml = race
      ? `<span class="class-display-race">${this.renderIcon(race.icon)} ${this.escapeHtml(race.name)}</span>`
      : '';
    el.innerHTML = `${raceHtml}<span class="class-display-icon">${this.renderIcon(cls.icon)}</span><span class="class-display-name">${this.escapeHtml(cls.name)}</span>`;
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
      const isPassive = ab.type === 'passive' || ab.passive;
      const combatOnly = this.isAbilityCombatOnly(ab);
      const spellBlocked = this.isSpellBlockedByCurse(ab);
      const canAfford = this.canAffordAbility(ab);
      const used = inCombat && ab.oncePerCombat && this.state.combat?.abilitiesUsed?.[ab.id];
      let canUse = !isPassive && canAfford && !used && !spellBlocked;
      if (inCombat) canUse = canUse && playerTurn;
      else canUse = canUse && !combatOnly;

      const sl = spellLevel(ab);
      const meta = isPassive
        ? 'пассив'
        : (spellBlocked ? '🤐 безмолвие' : (sl >= 1 ? `круг ${sl}` : `${cost} ${resName}`));
      const abId = this.escapeAttr(ab.id);
      const useBtn = isPassive
        ? ''
        : (canUse
          ? `<button type="button" class="ability-use-btn" onclick="event.stopPropagation();GameEngine.useAbility('${abId}')">Использовать</button>`
          : '<button type="button" class="ability-use-btn" disabled>Использовать</button>');
      const desc = ab.desc
        ? `<div class="ability-row-desc">${this.escapeHtml(ab.desc)}</div>`
        : '';

      return `<div class="ability-row" title="${this.escapeAttr(ab.desc || '')}" ${this.onclickGame('showAbilityInfo', ab.id)}>
        <div class="ability-row-head">
          <span class="ability-row-icon">${this.renderIcon(ab.icon)}</span>
          <span class="ability-row-name">${this.escapeHtml(ab.name)}</span>
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
    this.showModal(ab.name + ' ' + ab.icon, ab.desc + '\n\n' + costLine + '\n' + combatTag + onceTag);
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

  getSkillBonus(skill) {
    const cd = this.state.classData;
    if (!cd || !cd.stats) return 0;

    if (this.activeSystem?.getSkillBonus) {
      return this.activeSystem.getSkillBonus(skill, cd.stats, cd, this);
    }

    const SKILL_DEFS = {
      athletics: { stat: 'str', ru: 'Атлетика' },
      acrobatics: { stat: 'dex', ru: 'Акробатика' },
      stealth: { stat: 'dex', ru: 'Скрытность' },
      perception: { stat: 'wis', ru: 'Восприятие' },
      survival: { stat: 'wis', ru: 'Выживание' },
      intimidation: { stat: 'cha', ru: 'Устрашение' },
      persuasion: { stat: 'cha', ru: 'Убеждение' },
      deception: { stat: 'cha', ru: 'Обман' },
      investigation: { stat: 'int', ru: 'Расследование' },
      history: { stat: 'int', ru: 'История' },
      religion: { stat: 'int', ru: 'Религия' },
      medicine: { stat: 'wis', ru: 'Медицина' },
      insight: { stat: 'wis', ru: 'Проницательность' },
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
    const playerSkills = cd.skills || '';
    const skillIds = cd.skillIds || [];
    const proficientByRu = def?.ru && (playerSkills.includes(skillNameRu) || skillIds.includes(key));
    const proficientById = !def?.ru && (playerSkills.includes(skill) || skillIds.includes(key));
    const proficiency = proficientByRu || proficientById ? 2 : 0;

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
      paladin: 10
    };
    const cls = this.data?.classes?.[classKey];
    const base = hitDie[classKey] ?? cls?.hpHitDie ?? cls?.hp ?? 10;
    const mod = conMod != null ? conMod : this.getModifier(this.state.stats?.con ?? 10);
    return Math.max(1, Number(base) + mod);
  },

  getFirstStorySceneId() {
    if (this.data?.scenes?.start) return 'start';
    const keys = Object.keys(this.data?.scenes || {});
    return keys[0] || 'start';
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
    this.state.combat = null;
    this.state.enemies = [];
    this.state.equipped = {};
    this.state.curseEffects = {};
    this.initProgressionState();
    this.initResourcesFromLevel(1);

    const skillStr = this.CharacterCreator
      ? this.CharacterCreator.skillsToString(d.skills)
      : (cls.skills || '');

    const baseAbilities = this.normalizeAbilities(cls.abilities || [], classKey);
    const abilities = [...baseAbilities];
    const bonusId = d.bonusAbilityId;
    if (bonusId && !abilities.some(a => a.id === bonusId)) {
      const bonusDef = this.resolveAbilityDefinition(bonusId);
      if (bonusDef) {
        abilities.push(this.normalizeAbility(bonusDef, classKey, abilities.length));
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
      skillIds: [...(d.skills || [])],
      resourceName: resource.name,
      resourceDesc: resource.desc || '',
      abilities
    };

    abilities.forEach(ab => {
      if (ab.passive || ab.type === 'passive') this.applyPassiveAbility(ab);
    });

    this.autoEquipStartingGear(classKey);
    this.recalculateCombatStats();
    this.migrateCurseState();
    this.setCharName(name);

    this.renderClassDisplay(classKey);
    this.renderRaceDisplay(raceKey);

    const resLabel = document.getElementById('resource-label');
    if (resLabel) resLabel.textContent = resource.name;

    this.hideCharacterCreator();
    document.getElementById('class-screen')?.classList.add('hidden');
    document.getElementById('name-screen')?.classList.add('hidden');
    document.getElementById('game-content')?.classList.remove('hidden');
    document.getElementById('main')?.classList.remove('hidden');

    this.initUI();
    this.updateUI();
    this.updateAbilityGrid();
    this.log('--- ' + name + ', ' + cls.name + ' — путь начинается ---', 'log-combat');

    const startScene = this.getFirstStorySceneId();
    this.state.scene = startScene;
    if (this.data?.scenes?.[startScene]) {
      this.showScene(startScene, { forceRevisit: true });
    } else {
      this.setText('Сцена «' + startScene + '» не найдена. Загрузите game_data.json.');
      this.setChoices([]);
    }
    this.saveGame();
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
    const hasSupply = this.state.supplies > 0;
    const isShortRest = type === 'short' || (cfg.hpFraction < 1 && cfg.hpFraction > 0);

    if (this.state.flags?.focusPotionUntil) {
      delete this.state.flags.focusPotionUntil;
      this.log('🧿 Отдых снял эффект зелья фокусировки.', 'log-dice');
    }

    if (hasSupply && !isShortRest) {
      this.state.supplies--;
      this.state.hp = this.state.maxHp;
      this.restoreAllResources();
      this.log('Вы восстановили силы и здоровье после отдыха.', 'log-heal');
    } else if (hasSupply && isShortRest) {
      this.state.hp = Math.min(this.state.maxHp, this.state.hp + Math.floor(this.state.maxHp * cfg.hpFraction));
      if (this.state.resources.mode === 'spellSlots') {
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
      this.log('Короткий отдых: восстановлена часть здоровья и ресурса.', 'log-heal');
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
      this.log(`Припасов осталось: ${this.state.supplies}`, 'log-dice');
    }

    this.updateUI();

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
    this.state.visitedLocations[scene.mapLocation] = true;
    this.renderTravelMenu();
  },

  shouldApplySceneRewards(sceneId, scene, options = {}) {
    if (options.forceRevisit) return false;
    if (scene?.repeatRewards === true) return true;
    const visits = this.state.sceneVisits?.[sceneId] || 0;
    return visits === 0;
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
      this.state.gold += amount;
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
    for (const [id, loc] of entries) {
      const hub = loc.hubScene || '';
      const here = hub === current ? ' (здесь)' : '';
      html += `<option value="${this.escapeAttr(id)}">${this.escapeHtml((loc.icon || '📍') + ' ' + (loc.label || id) + here)}</option>`;
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
    this.showScene(loc.hubScene, { forceRevisit: true });
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
      this.setChoices([{ text: '🚪 Выйти из лавки', to: 'village' }]);
      return;
    }
    if (!this.state.inventory.includes('jack_bag')) {
      this.log('❌ У вас нет сумки Джека.', 'log-damage');
      this.showScene('village_shop', { forceRevisit: true });
      return;
    }
    this.removeItem('jack_bag');
    this.state.gold += 30;
    this.updateStats();
    this.log('💰 +30 зм (награда Джека)', 'log-heal');
    this.updateQuest('lost_bag', '2', { silentLog: true });
    this.state.flags.jackRewarded = true;
    this.changeReputation('rep_village', 8);
    this.updateQuest('lost_bag', 'complete');
    this.setText('Джек хватает сумку и заглядывает внутрь.\n\n«Плат на месте, фляжка... Хм. Кошелёк легче, чем должен быть. Ну, ладно.»');
    this.setDialogue([
      { speaker: 'Джек', text: 'Держи тридцать — честное слово торговца. И если найдёшь ещё что-нибудь ценное в лесу — неси сюда.' }
    ]);
    this.setChoices([{ text: '🚪 Уйти', to: 'village' }]);
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
  processSceneTemplate(text) {
    if (text == null) return '';
    let out = String(text);

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

  // ========== ОТОБРАЖЕНИЕ СЦЕН ==========

  /** Глубокая копия — не мутирует GAME_DATA / scenes в памяти */
  cloneSceneData(obj) {
    if (obj == null) return obj;
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (e) {
      if (Array.isArray(obj)) return [...obj];
      if (typeof obj === 'object') return { ...obj };
      return obj;
    }
  },

  /** Поля состояния локации, перекрывающие базовую сцену */
  SCENE_STATE_OVERRIDE_FIELDS: ['text', 'audio', 'choices', 'location', 'special', 'dialogue'],

  applyLocationStateOverrides(scene, stateEntry) {
    this.SCENE_STATE_OVERRIDE_FIELDS.forEach((field) => {
      if (stateEntry[field] !== undefined && stateEntry[field] !== null) {
        scene[field] = this.cloneSceneData(stateEntry[field]);
      }
    });
  },

  /**
   * Сцена с учётом states[]: копия JSON + первое истинное condition (сверху вниз).
   * Базовые combat / flags / items / gold остаются из исходной сцены.
   */
  getProcessedScene(sceneId) {
    const raw = this.data?.scenes?.[sceneId];
    if (!raw) return null;

    const scene = this.cloneSceneData(raw);
    scene.id = sceneId;

    if (!Array.isArray(scene.states) || !scene.states.length) return scene;

    const ctx = this.getConditionContext();

    for (let i = 0; i < scene.states.length; i++) {
      const st = scene.states[i];
      if (st.default === true) continue;
      if (ConditionSystem.matchesSceneState(st, ctx)) {
        this.applyLocationStateOverrides(scene, st);
        scene._activeStateIndex = i;
        scene._activeStateId = st.id || ('state_' + i);
        return scene;
      }
    }

    const fallback = scene.states.find(st => st.default === true);
    if (fallback) {
      this.applyLocationStateOverrides(scene, fallback);
      scene._activeStateIndex = -1;
      scene._activeStateId = fallback.id || 'default';
    }

    return scene;
  },

  resolveSceneAudioId(audio) {
    if (audio == null || audio === '') return null;
    if (typeof audio === 'string') return audio;
    if (typeof audio === 'object') {
      return audio.id || audio.track || audio.ambient || audio.play || null;
    }
    return null;
  },

  playSceneAudio(audio) {
    if (typeof AudioEngine === 'undefined') return;
    AudioEngine.unlock();
    const id = this.resolveSceneAudioId(audio);
    const loop = typeof audio === 'object' ? audio.loop !== false : true;

    if (!id) {
      this._sceneAmbientId = null;
      AudioEngine.stopAmbient(false);
      return;
    }

    if (loop) {
      if (this._sceneAmbientId === id) {
        AudioEngine.applyAmbientVolume();
        return;
      }
      this._sceneAmbientId = id;
      const vol = typeof audio === 'object' ? audio.volume : undefined;
      AudioEngine.playAmbient(id, { loop: true, volume: vol });
      return;
    }

    this._sceneAmbientId = null;
    AudioEngine.stopAmbient(false).then(() => {
      AudioEngine.playSFX(id, { volume: typeof audio === 'object' ? audio.volume : undefined });
    });
  },

  showScene(sceneId, options = {}) {
    this.state.scene = sceneId;
    const rawScene = this.data.scenes[sceneId];
    if (!rawScene) {
      console.error('Сцена не найдена:', sceneId);
      this.setText('Ошибка: сцена "' + sceneId + '" не найдена в данных.');
      this.setChoices([]);
      return;
    }

    const scene = this.getProcessedScene(sceneId);

    const applyRewards = this.shouldApplySceneRewards(sceneId, rawScene, options);
    if (!this.state.sceneVisits) this.state.sceneVisits = {};
    this.state.sceneVisits[sceneId] = (this.state.sceneVisits[sceneId] || 0) + 1;

    // Обработка специальных сцен (special может прийти из states)
    if (scene.special && !options.fromSpecial) {
      this.registerMapLocation(scene);
      this.handleSpecialScene(sceneId, scene, options);
      return;
    }

    // Установка локации
    this.setLocation(scene.location || '—');
    this.registerMapLocation(scene);

    this.playSceneAudio(scene.audio ?? rawScene.audio);

    // Обработка текста с подстановками
    let text = scene.text || '';
    if (sceneId === 'jack_reward' && this.state.flags.jackRewarded) {
      text = 'Джек перебирает товар на полках. Увидев вас, улыбается.\n\n«А, мой герой! Сумка на месте — всё честно. Заходи, если что понадобится.»';
    } else if (sceneId === 'village_accept' && this.state.flags.haggleWon) {
      text = 'Марта кивает.\n\n«Пятьдесят золотых у тебя — я помню. Иди по тропе на север, не теряй время.»';
    } else if (sceneId === 'village_accept' && this.state.flags.haggleLost) {
      text = 'Марта кивает.\n\n«Двадцать пять — и точка, мы договорились. Мельница ждёт.»';
    }
    this.setText(text);

    // Диалоги
    if (sceneId === 'jack_reward' && this.state.flags.jackRewarded) {
      this.clearDialogue();
    } else if (scene.dialogue && scene.dialogue.length > 0) {
      this.setDialogue(scene.dialogue);
    } else {
      this.clearDialogue();
    }

    if (applyRewards) {
      this.applyFlags(rawScene.flags);
      this.awardSceneExp(rawScene);
      if (rawScene.items) {
        rawScene.items.forEach(itemId => this.addItem(itemId));
      }
      this.awardSceneGold(rawScene, sceneId);
    }

    // Бой (не повторять при возврате через карту)
    if (rawScene.combat && rawScene.combat.length > 0) {
      if (!applyRewards) {
        if (scene.choices) this.setChoices(scene.choices);
        else this.setChoices([]);
        this.saveGame();
        this.renderTravelMenu();
        return;
      }
      const missing = rawScene.combat.filter(eid => !this.data.enemies?.[eid]);
      if (missing.length) {
        console.error('Враги не найдены:', missing.join(', '));
        this.setText('Ошибка данных: не найдены враги: ' + missing.join(', '));
        this.setChoices([]);
        return;
      }
      const enemies = rawScene.combat.map(eid => {
        const e = this.data.enemies[eid];
        return { ...e, id: eid, maxHp: e.hp };
      });
      this.startCombat(enemies, rawScene.nextScene, rawScene.combat);
      return;
    }

    // Выборы (фильтр showIf / hideIf внутри setChoices)
    if (scene.choices) {
      this.setChoices(scene.choices);
    } else {
      this.setChoices([]);
    }
    this.saveGame();
    this.renderTravelMenu();
    this.initTooltips();
  },

  handleSpecialScene(sceneId, scene, options = {}) {
    if (typeof SpecialSceneRegistry !== 'undefined' && SpecialSceneRegistry.run(this, sceneId, scene)) {
      return;
    }
    if (this.runSpecialScenePassthrough(sceneId, scene, options)) {
      return;
    }
    const hint = 'Добавьте обработчик через SpecialSceneRegistry.register() или опишите в plugins.specialScenes в JSON.';
    this.setLocation(scene.location || '—');
    this.setText('⚠️ Неизвестный special: «' + scene.special + '».\n\n' + hint + '\n\nЗаполните текст и выборы в редакторе — сцена откроется как обычная.');
    this.setChoices([
      { text: '↺ Попробовать показать как обычную сцену', action: 'special_passthrough:' + sceneId },
      { text: '← Назад', to: 'village' }
    ]);
  },

  runSpecialScenePassthrough(sceneId, scene, options = {}) {
    const processed = this.getProcessedScene(sceneId) || scene;
    const hasContent = !!(
      processed.text?.trim()
      || processed.choices?.length
      || processed.dialogue?.length
    );
    if (!hasContent) return false;
    this.showScene(sceneId, { ...options, fromSpecial: true });
    return true;
  },

  handleResetFromSpecial() {
    this.resetGame();
  },

  // ========== СПЕЦИАЛЬНЫЕ ОБРАБОТЧИКИ ==========
  handleHaggle() {
    if (this.state.flags.haggleDone) {
      this.setText('Марта отмахивается: «Мы уже договорились о плате. Больше не торгуюсь.»');
      this.setDialogue([]);
      this.setChoices([{ text: '← Вернуться к разговору с Мартой', to: 'village' }]);
      return;
    }
    const roll = this.d20();
    const bonus = this.getSkillBonus('persuasion');
    const total = roll + bonus;

    if (total >= 14) {
      this.state.gold += 50;
      this.setText('Марта хмурится, потом достаёт кошелёк.\n\n«Чёрт с тобой. Пятьдесят. Но если Альберт погиб по твоей вине — ты ответишь перед ополчением.»');
      this.setDialogue([]);
      this.log(`Торг: успех! 50 зм (к20=${roll}+${bonus >= 0 ? '+' : ''}${bonus}=${total})`);
      this.state.flags.haggleWon = true;
    } else {
      this.state.gold += 25;
      this.state.flags.haggleLost = true;
      this.setText('Марта фыркает.\n\n«Двадцать пять — и точка. Не нравится — иди мимо. Других желающих нет.»');
      this.setDialogue([]);
      this.log(`Торг: 25 зм (к20=${roll}+${bonus >= 0 ? '+' : ''}${bonus}=${total})`);
    }
    this.state.flags.haggleDone = true;
    this.updateStats();
    this.setChoices([
      { text: '← Вернуться к разговору с Мартой', to: 'village' }
    ]);
  },

  handleShopJack() {
    const rep = this.getReputationValue('rep_village');
    if (rep != null && rep <= -20) {
      this.setText('Джек не поднимает глаз от счётов.\n\n«Убирайся отсюда, тебе здесь не рады! Не хочу видеть твоё лицо в моей лавке.»');
      this.clearDialogue();
      this.setChoices([{ text: '🚪 Уйти', to: 'village' }]);
      return;
    }

    const visited = this.state.flags.shopVisited;
    this.state.flags.shopVisited = true;

    if (!visited) {
      this.setText('Лавка пахнет сухофруктами, кожей и чем-то сладковатым. За прилавком — худой мужчина с хитрой улыбкой и лисьими глазами. Он поправляет жёлтый берет.\n\n«Добро пожаловать, добро пожаловать! У Джека всё есть — и то, что видишь, и то, что спрятано.»');
    } else {
      this.setText('Джек сидит за прилавком, перебирает бусины на счётах.');
    }

    this.clearDialogue();
    const choices = [
      { text: '💰 «Что у тебя в продаже?»', to: 'jack_buy' },
      { text: '🗣️ «Слышал, у тебя пропала сумка»', to: 'jack_quest_talk', doneFlag: 'jackQuest' },
      { text: '🚪 Уйти', to: 'village' }
    ];
    if (this.state.inventory.includes('jack_bag') && this.state.flags.jackQuest && !this.state.flags.jackRewarded) {
      choices.unshift({ text: '🎒 Вернуть сумку Джеку', to: 'jack_reward' });
    }
    this.setChoices(choices);
  },

  handleForestLoot() {
    const bonus = this.getSkillBonus('perception');
    const roll = this.d20() + bonus;
    if (roll >= 12 && !this.state.flags.forestPotion) {
      this.state.flags.forestPotion = true;
      this.addItem('healing_potion');
      this.setText('В сумке — свёрток из кожи. Внутри бутылочка с рубиновой жидкостью. Зелье лечения.');
      this.log(`Найдено зелье! (${roll})`);
    } else {
      this.setText('Больше ничего ценного. Гнилой хлеб, игральные кости, нож с выбитой рукоятью.');
    }
    this.setChoices([
      { text: 'Продолжить путь', to: 'thicket' }
    ]);
  },

  handleBarnChest() {
    if (!this.state.flags.barnChestOpen) {
      this.state.flags.barnChestOpen = true;
      this.state.gold += 15;
      this.updateStats();
      this.setText('В ящике — старые долота, клочок шерсти, и кошелёк с пятнадцатью золотыми. Сбережения Альберта.');
      this.log('Найдено 15 зм');
    } else {
      this.setText('Ящик пуст.');
    }
    this.setChoices([
      { text: 'Вернуться к мельнице', to: 'mill_arrival' }
    ]);
  },

  handleAttic() {
    const visited = this.state.flags.atticVisited;
    if (!visited) {
      this.state.flags.atticVisited = true;
      this.setText('Чердак просторный. Огромное колесо механизма. Одна шестерня сорвана и лежит в углу. Вал пустой — без неё механизм мёртв.\nНа полу три паза для шестерни.');
      this.setChoices([
        { text: '🔧 Вставить в верхний паз', to: 'mill_attic_gear_top' },
        { text: '🔧 Вставить в средний паз', to: 'mill_attic_gear_mid' },
        { text: '🔧 Вставить в нижний паз', to: 'mill_attic_gear_bot' },
        { text: '📋 Вспомнить чертёж из сарая', to: 'mill_attic_blueprint' },
        { text: '⬇️ Спуститься', to: 'mill_second' }
      ]);
    } else {
      if (this.state.flags.gearFixed && !this.state.flags.corvinSpawned) {
        this.state.flags.corvinSpawned = true;
        this.setText('Механизм грохочет. Из-за мешков выходит мужчина в кирасе. Длинный меч. Он смотрит без страха — только усталость.');
        this.setDialogue([
          { speaker: 'Корвин', text: 'Ты не первый, кто пришёл сюда. Но первый, кто добрался так далеко. Жаль. Мне не хотелось убивать, но мельница — хорошее укрытие. А ты — помеха.' }
        ]);
        this.setChoices([
          { text: '🗣️ «Сдавайся»', to: 'boss_talk' },
          { text: '🗣️ «Где Альберт?»', to: 'boss_albert' },
          { text: '⚔️ Атаковать', to: 'boss_fight' }
        ]);
        return;
      }
      this.setText(this.state.flags.gearFixed ? 'Чердак. Механизм грохочет, колесо крутится.' : 'Чердак. Механизм мёртв.');
      this.setChoices([
        { text: 'Спуститься', to: 'mill_second' }
      ]);
    }
  },

  handleBossTalk() {
    this.setDialogue([
      { speaker: 'Корвин', text: 'Окружён? Тут только ты и я. И механизм, который скоро развалится. Я бы ушёл, но ты видел слишком много.' }
    ]);
    this.setChoices([
      { text: '«Уходи, я не преследую»', to: 'boss_mercy' },
      { text: '«Тогда — оружие»', to: 'boss_fight' }
    ]);
  },

  handleBossAlbert() {
    this.setDialogue([
      { speaker: 'Корвин', text: 'Старый мельник? Жив. В погребе, с псом. Мы не убийцы — торговцы. Просто... не совсем честные. Железо, меха. Но ты всё испортил.' }
    ]);
    this.setChoices([
      { text: '«Я заберу его и уйду. Ты — тоже»', to: 'boss_mercy' },
      { text: '«Нет. Ты идёшь со мной»', to: 'boss_fight' }
    ]);
  },

  handleBossMercy() {
    const bonus = this.getSkillBonus('persuasion');
    const roll = this.d20() + bonus;
    if (roll >= 15) {
      this.setText('Корвин смотрит долго. Потом опускает меч.');
      this.setDialogue([
        { speaker: 'Корвин', text: '...Ладно. Забирай старика. Скажи деревне, что я ушёл в лес. Больше не вернусь. Но если встретимся снова — я не прощу.' }
      ]);
      this.state.flags.corvinSpared = true;
      this.setChoices([
        { text: 'Спуститься в погреб', to: 'cellar_after' }
      ]);
    } else {
      this.setText('Корвин усмехается.');
      this.setDialogue([
        { speaker: 'Корвин', text: 'Милосердие? От воина? Нет, друг. Мир жесток. Докажи, что достоин жить.' }
      ]);
      this.setChoices([
        { text: 'Вступить в бой', to: 'boss_fight' }
      ]);
    }
  },

  handleCellarFirst() {
    if (!this.state.flags.cellarVisited) {
      this.state.flags.cellarVisited = true;
      this.setText('Лестница ведёт в сырой каменный погреб. Тусклый факел. В клетке — мужчина в лохмотьях (Альберт) и привязанный пёс Гризли.\nТрое бандитов пересчитывают товар. Один замечает вас.');
      this.setChoices([
        { text: '⚔️ Ворваться в бой', to: 'cellar_combat' },
        { text: '🗣️ «Опустите оружие!»', to: 'cellar_intimidate' }
      ]);
    } else {
      this.setText('Погреб.');
      this.setChoices([
        { text: 'К Альберту', to: 'cellar_after' }
      ]);
    }
  },

  handleCellarIntimidate() {
    const bonus = this.getSkillBonus('intimidation');
    const roll = this.d20() + bonus;
    if (roll >= 14) {
      this.setText('Бандиты переглядываются. Громила опускает дубину.');
      this.setDialogue([
        { speaker: 'Бандит', text: 'Чёрт... Корвин говорил, что нас никто не тронет. Ладно, мы уходим.' }
      ]);
      this.state.flags.banditsFled = true;
      this.setChoices([
        { text: 'Позволить уйти', to: 'cellar_after' },
        { text: '«Руки за голову»', to: 'cellar_combat' }
      ]);
    } else {
      this.setText('Бандит хмыкает.');
      this.setDialogue([
        { speaker: 'Бандит', text: 'Один на троих? Ты шутишь. Ребята — в него!' }
      ]);
      this.setChoices([
        { text: 'Бой', to: 'cellar_combat' }
      ]);
    }
  },

  handleCellarAfter() {
    this.setLocation('Погреб');
    if (this.state.flags.albertSaved) {
      this.setText('Погреб пуст. Альберт и Гризли ушли. Остались только следы борьбы и разбросанные мешки.');
      this.setChoices([
        { text: '🔍 Осмотреть погреб ещё раз', to: 'cellar_search' },
        { text: '🏚️ Вернуться к мельнице', to: 'mill_arrival' },
        { text: '🌲 Вернуться в деревню', to: 'epilogue' }
      ]);
      return;
    }
    this.setText('В погребе пахнет кровью и плесенью. Альберт смотрит из клетки. Гризли рычит, потом виляет хвостом.');
    this.setDialogue([
      { speaker: 'Альберт', text: 'Боги... ты пришёл. Я думал, умру. Эти гады держали меня трое суток. Корвин на чердаке, наверное.' },
      { speaker: 'Альберт', text: 'Механизм... если запустить жернова, шум заглушит всё. Ключ у меня был, но отобрали. Возьми — в кармане у Громилы.' }
    ]);
    if (!this.state.inventory.includes('safe_key')) this.addItem('safe_key');
    const choices = [];
    if (!this.state.flags.dogFreed) choices.push({ text: '🐕 Освободить Гризли', to: 'cellar_dog' });
    choices.push({ text: '🔍 Осмотреть погреб', to: 'cellar_search' });
    choices.push({ text: '🗣️ «Корвин мёртв / сбежал. Вы свободны»', to: 'cellar_free' });
    this.setChoices(choices);
  },

  handleCellarSearch() {
    const bonus = this.getSkillBonus('perception');
    const roll = this.d20() + bonus;
    if (roll >= 12 && !this.state.flags.cellarLoot) {
      this.state.flags.cellarLoot = true;
      this.state.gold += 8;
      this.updateStats();
      this.setText('В ящике — украденные меха, два железных слитка и 8 золотых.');
      this.addItem('iron_ingots');
    } else {
      this.setText('Товар краденый, но ничего лично ценного.');
    }
    const choices = [
      { text: '🗣️ Поговорить с Альбертом', to: 'cellar_free' }
    ];
    if (!this.state.flags.dogFreed) choices.unshift({ text: '🐕 Освободить Гризли', to: 'cellar_dog' });
    if (!this.state.flags.albertSaved) choices.unshift({ text: '🔓 Освободить Альберта', to: 'cellar_free' });
    choices.push({ text: '🏚️ Вернуться к мельнице', to: 'mill_arrival' });
    this.setChoices(choices);
  },

  // ========== ГОЛОВОЛОМКА С ШЕСТЕРНЁЙ ==========
  gearPuzzle(choice) {
    const correct = 'mid';
    if (this.state.flags.gearFixed) { this.showScene('mill_attic'); return; }
    if (choice === correct) {
      this.state.flags.gearFixed = true;
      this.setText('Шестерня встаёт идеально. Механизм с грохотом оживает — колесо крутится. Шум оглушает, пыль взмывает.\n\nЭтот грохот маскирует шаги. Или... привлекает кого-то?');
      this.log('Механизм запущен!');
      this.setChoices([
        { text: 'Осмотреть чердак', to: 'mill_attic' }
      ]);
    } else {
      this.setText('Шестерня входит туго, но при обороте заедает. Ржавый трос обрывается!');
      const bonus = this.getSkillBonus('dexterity');
      const roll = this.d20() + bonus;
      if (roll >= 12) {
        this.log(`Увернулись: ${roll} vs 12`);
        this.setText('Вы уворачиваетесь. Трос падает рядом. Шестерня сломана — механизм мёртв.');
      } else {
        const dmg = this.d(6);
        this.takeDamage(dmg);
        this.log(`Трос ударил: ${dmg} урона`, 'log-damage');
        this.setText(`Трос бьёт вас, сбивая с ног. ${dmg} урона. Шестерня сломана.`);
      }
      this.state.flags.gearBroken = true;
      this.setChoices([
        { text: 'Спуститься', to: 'mill_second' }
      ]);
    }
  },

  // ========== БОЙ ==========

  /** Имя врага с уровнем скалирования для UI */
  getEnemyDisplayName(enemy) {
    const name = enemy?.name || 'Враг';
    const lv = enemy?.scaledLevel;
    if (lv > 1) return `${name} (Ур. ${lv})`;
    return name;
  },

  /** Настройки масштабирования врагов из game_data.json (вкладка «Прогрессия» редактора) */
  getEnemyScalingConfig() {
    const defaults = {
      enabled: true,
      hpRatePerLevel: 0.155,
      bossHpRatePerLevel: 0.3,
      atkBonusPerEvenLevel: 1,
      damageMinPlayerLevel: 3,
      acBonuses: [
        { playerLevel: 5, bonus: 1 },
        { playerLevel: 10, bonus: 1 }
      ]
    };
    const raw = this.data?.enemyScaling;
    if (!raw || raw.enabled === false) {
      return { ...defaults, enabled: false };
    }
    return {
      ...defaults,
      ...raw,
      acBonuses: Array.isArray(raw.acBonuses) && raw.acBonuses.length
        ? raw.acBonuses
        : defaults.acBonuses
    };
  },

  /**
   * Масштабирование врага под уровень игрока (со 2-го уровня).
   * boss: true — повышенный коэффициент ОЗ из enemyScaling.bossHpRatePerLevel.
   */
  scaleEnemyForPlayerLevel(enemy) {
    const level = Math.max(1, parseInt(this.state.level, 10) || 1);
    const cfg = this.getEnemyScalingConfig();
    if (this.activeSystem?.scaleEnemy) {
      return this.activeSystem.scaleEnemy(enemy, level, cfg, this.data);
    }
    const scaled = { ...enemy };

    scaled.scaledLevel = level;
    if (!cfg.enabled || level <= 1) {
      scaled.hp = parseInt(enemy.hp ?? enemy.maxHp, 10) || 1;
      scaled.maxHp = scaled.hp;
      scaled.dmgRoll = enemy.dmgRoll || '1d6';
      scaled._baseDmgBonus = parseInt(enemy.dmgBonus, 10) || 0;
      scaled.dmgBonus = scaled._baseDmgBonus;
      return scaled;
    }

    const baseHp = parseInt(enemy.hp ?? enemy.maxHp, 10) || 1;
    const isBoss = enemy.boss === true;
    const hpRate = isBoss ? cfg.bossHpRatePerLevel : cfg.hpRatePerLevel;
    const hpMult = 1 + Math.max(0, level - 1) * hpRate;
    const hp = Math.max(1, Math.floor(baseHp * hpMult));

    scaled.hp = hp;
    scaled.maxHp = hp;

    const baseAtk = parseInt(enemy.atkBonus, 10) || 0;
    const atkStep = cfg.atkBonusPerEvenLevel ?? 1;
    scaled.atkBonus = baseAtk + Math.floor(level / 2) * atkStep;

    const baseAc = parseInt(enemy.ac, 10) || 10;
    let acBonus = 0;
    (cfg.acBonuses || []).forEach(row => {
      const threshold = parseInt(row.playerLevel, 10) || 0;
      if (threshold > 0 && level >= threshold) {
        acBonus += parseInt(row.bonus, 10) || 0;
      }
    });
    scaled.ac = baseAc + acBonus;

    scaled.dmgRoll = enemy.dmgRoll || '1d6';
    scaled._baseDmgBonus = parseInt(enemy.dmgBonus, 10) || 0;
    const dmgFromLevel = cfg.damageMinPlayerLevel ?? 3;
    scaled.dmgBonus = level >= dmgFromLevel
      ? scaled._baseDmgBonus + level
      : scaled._baseDmgBonus;

    return scaled;
  },

  /** Текущая фаза боя (player_turn | select_target | enemy_turn) */
  getCombatPhase() {
    if (!this.state.combat) return null;
    if (this.state.combat.phase) return this.state.combat.phase;
    return this.state.combat.playerTurn ? 'player_turn' : 'enemy_turn';
  },

  /** Игрок может действовать (ход или выбор цели) */
  isPlayerCombatPhase() {
    const phase = this.getCombatPhase();
    return phase === 'player_turn' || phase === 'select_target';
  },

  setCombatPhase(phase) {
    if (!this.state.combat) return;
    this.state.combat.phase = phase;
    if (phase === 'enemy_turn') {
      this.state.combat.playerTurn = false;
    } else {
      this.state.combat.playerTurn = true;
    }
    this.updateCombatTargetHint();
  },

  /** scope из ability.targeting или effect.targeting */
  getAbilityTargetingScope(ability) {
    if (!ability) return null;
    if (Array.isArray(ability.effects)) {
      for (const ef of ability.effects) {
        if (ef?.allTargets) return 'all_enemies';
        const s = ef?.targeting?.scope;
        if (s === 'all_enemies' || s === 'area') return 'all_enemies';
      }
    }
    if (ability.effect?.allTargets) return 'all_enemies';
    if (ability.targeting?.scope) return ability.targeting.scope;
    if (ability.effect?.targeting?.scope) return ability.effect.targeting.scope;
    if (Array.isArray(ability.effects)) {
      for (const ef of ability.effects) {
        if (ef?.targeting?.scope) return ef.targeting.scope;
      }
    }
    return null;
  },

  /** Умение требует клика по живому врагу (урон по одной цели) */
  abilityRequiresEnemyTarget(ability) {
    if (!ability || !this.state.combat) return false;
    const scope = this.getAbilityTargetingScope(ability);
    if (scope !== 'single') return false;
    const effects = [];
    if (Array.isArray(ability.effects)) effects.push(...ability.effects);
    else if (ability.effect) effects.push(ability.effect);
    for (const ef of effects) {
      if (!ef || typeof ef !== 'object') continue;
      if (ef.type === 'damage' || ef.type === 'apply_status') return true;
    }
    return false;
  },

  getAliveEnemyIndices() {
    return (this.state.enemies || [])
      .map((e, i) => (e.hp > 0 ? i : -1))
      .filter(i => i >= 0);
  },

  updateCombatTargetHint() {
    const el = document.getElementById('combat-target-hint');
    if (!el) return;
    if (!this.state.combat) {
      el.classList.add('hidden');
      el.innerHTML = '';
      return;
    }
    const phase = this.getCombatPhase();
    const pendingAb = this.state.combat?.pendingAbility;
    const pendingItemId = this.state.combat?.pendingConsumableId;
    const pendingItem = pendingItemId ? this.data?.items?.[pendingItemId] : null;
    const pendingLabel = pendingAb?.name || pendingItem?.name;
    if (phase === 'select_target' && pendingLabel) {
      el.classList.remove('hidden');
      el.innerHTML = `
        <div class="combat-target-hint-title">🎯 Выберите цель для «${this.escapeHtml(pendingLabel)}»</div>
        <div>Кликните по подсвеченному врагу. <kbd>Esc</kbd> — отмена.</div>
        <button type="button" class="btn btn-secondary combat-target-cancel" onclick="GameEngine.cancelAbilityTargetSelect()">Отмена</button>`;
    } else {
      el.classList.add('hidden');
      el.innerHTML = '';
    }
  },

  /** Ожидание клика по врагу (scope: single, урон по цели) */
  beginAbilityTargetSelect(ability) {
    if (!this.state.combat || !ability) return;
    const alive = this.getAliveEnemyIndices();
    if (!alive.length) {
      this.nextCombatTurn();
      return;
    }
    this.state.combat.pendingAbility = ability;
    this.state.combat.pendingConsumableId = null;
    this.setCombatPhase('select_target');
    this.renderCombat();
    this.playerCombatTurn();
  },

  cancelAbilityTargetSelect() {
    if (this.getCombatPhase() !== 'select_target') return;
    this.state.combat.pendingAbility = null;
    this.state.combat.pendingConsumableId = null;
    this.setCombatPhase('player_turn');
    this.renderCombat();
    this.playerCombatTurn();
    this.log('Выбор цели отменён.', 'log-dice');
  },

  onCombatEnemyClick(enemyIndex) {
    if (this.getCombatPhase() !== 'select_target') return;
    const enemy = this.state.enemies?.[enemyIndex];
    if (!enemy || enemy.hp <= 0) return;

    const itemId = this.state.combat?.pendingConsumableId;
    if (itemId) {
      const db = this.data?.items?.[itemId];
      if (!db || !this.state.inventory.includes(itemId)) {
        this.cancelAbilityTargetSelect();
        return;
      }
      this.state.combat.pendingConsumableId = null;
      this.setCombatPhase('player_turn');
      this.updateCombatTargetHint();
      const result = this.applyConsumableUseEffect(itemId, db, { enemy });
      this.finishConsumableCombatTurn(itemId, result.itemRemoved);
      return;
    }

    const ability = this.state.combat?.pendingAbility;
    if (!ability) {
      this.cancelAbilityTargetSelect();
      return;
    }
    this.state.combat.pendingAbility = null;
    this.setCombatPhase('player_turn');
    this.updateCombatTargetHint();
    this.executeAbility(ability, enemy);
  },

  /**
   * Применение умения после оплаты стоимости (target — объект врага для scope: single).
   */
  executeAbility(ability, target = null) {
    this.spendAbilityCost(ability);
    this.log(`💫 ${ability.name}`, 'log-info');
    this.playAbilityCast(ability);

    const endsTurn = this.applyAbilityLogic(ability, target);

    if (this.state.combat && this.isConcentrationAbility(ability)) {
      if (typeof this.beginConcentration === 'function') {
        this.beginConcentration(ability);
      }
    }

    if (this.state.combat && ability.oncePerCombat) {
      if (!this.state.combat.abilitiesUsed) this.state.combat.abilitiesUsed = {};
      this.state.combat.abilitiesUsed[ability.id] = true;
    }

    this.updateStats();

    if (!this.state.combat) return;

    this.renderCombat();

    if (this.state.enemies.every(e => e.hp <= 0)) {
      setTimeout(() => this.nextCombatTurn(), 600);
      return;
    }

    if (this.isPf2e() && this.state.combat) {
      if (!this.endPf2ePlayerTurnIfNoActions()) {
        this.playerCombatTurn();
      }
      return;
    }

    if (!endsTurn) {
      this.playerCombatTurn();
      return;
    }

    this.state.combat.turnIndex++;
    setTimeout(() => this.nextCombatTurn(), 600);
  },

  startCombat(enemies, nextScene, enemyIds) {
    const ids = enemyIds || enemies.map(e => e.id).filter(Boolean);
    this.state.combat = {
      round: 1,
      nextScene: nextScene,
      playerTurn: false,
      /** Фаза боя: player_turn | select_target | enemy_turn */
      phase: 'enemy_turn',
      pendingAbility: null,
      /** Расходник, ожидающий выбора врага (target: single_enemy) */
      pendingConsumableId: null,
      abilitiesUsed: {},
      /** ID шаблонов врагов из data.enemies (для loot и опыта) */
      enemies: ids,
      enemyIds: ids,
      expKey: `combat:${this.state.scene}`,
      effects: [],
      effectAcMod: 0,
      effectAtkMod: 0,
      concentration: null
    };
    const playerLevel = Math.max(1, parseInt(this.state.level, 10) || 1);
    this.state.enemies = enemies.map(e => {
      const scaled = this.scaleEnemyForPlayerLevel(e);
      return {
        ...scaled,
        maxHp: scaled.hp,
        effects: [],
        _baseAc: scaled.ac,
        _baseAtkBonus: scaled.atkBonus
      };
    });
    if (playerLevel > 1) {
      this.log(`⚔️ Противники усилены под уровень ${playerLevel}`, 'log-combat');
    }
    this.renderCombat();
    const pRoll = this.d20() + this.state.classData.initBonus;
    const eRolls = this.state.enemies.map((e, i) => ({ i, roll: this.d20() + (e.dex || 2) }));
    eRolls.sort((a, b) => b.roll - a.roll);
    let order = [{ type: 'player', roll: pRoll }];
    eRolls.forEach(e => order.push({ type: 'enemy', index: e.i, roll: e.roll }));
    order.sort((a, b) => b.roll - a.roll);
    this.state.combat.order = order;
    this.state.combat.turnIndex = 0;
    if (this.isPf2e()) this.resetPf2eCombatActions();
    this.log(`⚔️ Бой! Инициатива ${this.state.charName}: ${pRoll}`, 'log-combat');
    this.nextCombatTurn();
  },

  renderCombat() {
    const area = document.getElementById('combat-area');
    if (!area) return;
    area.classList.remove('hidden');
    this.ensureCombatEffectsState();

    let pf2eActionsHtml = '';
    if (this.isPf2e() && this.state.combat) {
      const actionsLeft = this.state.combat.actionsRemaining ?? this.getPf2eActionsPerTurn();
      const filled = '◆'.repeat(Math.max(0, actionsLeft));
      const empty = '◇'.repeat(Math.max(0, this.getPf2eActionsPerTurn() - actionsLeft));
      pf2eActionsHtml = `<div class="pf2e-actions-indicator" title="Осталось действий в ход">⚡ Действия: ${filled}${empty}</div>`;
    }

    const playerFx = this.renderStatusEffectsHtml(this.state.combat?.effects);
    const pPct = Math.max(0, (this.state.hp / this.state.maxHp) * 100);

    let html = pf2eActionsHtml;
    html += '<div class="combat-player-row">';
    html += `<span class="combat-unit-name">${this.escapeHtml(this.state.charName || 'Герой')}</span>`;
    html += `<div class="hp-bar-bg"><div class="hp-bar-fill" style="width:${pPct}%"></div></div>`;
    html += `<span class="combat-hp-text">${this.state.hp}/${this.state.maxHp}</span>`;
    if (playerFx) html += `<div class="combat-effects-row">${playerFx}</div>`;
    const conc = this.state.combat?.concentration;
    if (conc?.label) {
      html += `<div class="combat-concentration-row"><span class="concentration-active" title="Активная концентрация">[C] ${this.escapeHtml(conc.label)}</span></div>`;
    }
    if (this.hasFocusPotionAdvantage()) {
      const left = this.getFocusPotionTimeLeftLabel();
      html += `<div class="combat-concentration-row"><span class="focus-potion-active" title="Преимущество на проверки концентрации">🧿 Фокус${left ? ` (${this.escapeHtml(left)})` : ''}</span></div>`;
    }
    html += '</div>';

    html += '<b class="combat-enemies-title">⚔️ Противники:</b>';
    const selectingTarget = this.getCombatPhase() === 'select_target';
    this.state.enemies.forEach((e, idx) => {
      const alive = e.hp > 0;
      const pct = Math.max(0, (e.hp / e.maxHp) * 100);
      const fx = this.renderStatusEffectsHtml(e.effects);
      let rowClass = 'combat-enemy';
      if (selectingTarget) {
        rowClass += alive ? ' combat-enemy-targetable' : ' combat-enemy-dead';
      }
      const clickAttr = (selectingTarget && alive)
        ? ` role="button" tabindex="0" onclick="GameEngine.onCombatEnemyClick(${idx})"`
        : '';
      html += `<div class="${rowClass}" data-enemy-index="${idx}"${clickAttr}>`;
      html += `<span class="combat-unit-name">${this.escapeHtml(this.getEnemyDisplayName(e))}</span>`;
      html += `<div class="hp-bar-bg"><div class="hp-bar-fill" style="width:${pct}%"></div></div>`;
      html += `<span class="combat-hp-text">${e.hp}/${e.maxHp}</span>`;
      if (fx) html += `<div class="combat-effects-row">${fx}</div>`;
      html += `</div>`;
    });
    area.innerHTML = html;
  },

  nextCombatTurn() {
    if (this.state.hp <= 0) {
      if (typeof this.clearCombatConcentration === 'function') this.clearCombatConcentration(true);
      this.state.combat = null; this.state.enemies = [];
      const ca = document.getElementById('combat-area');
      if (ca) ca.classList.add('hidden');
      return;
    }
    if (!this.state.combat) return;
    if (this.state.enemies.every(e => e.hp <= 0)) {
      const next = this.state.combat.nextScene;
      const combatSnapshot = { ...this.state.combat };
      this.log('✅ Все враги повержены!', 'log-combat');
      if (typeof this.clearCombatConcentration === 'function') this.clearCombatConcentration(true);
      this.state.combat = null;
      this.state.enemies = [];
      this.state.resumeAfterLevelUp = null;
      const ca = document.getElementById('combat-area');
      if (ca) ca.classList.add('hidden');

      const enemyIds = combatSnapshot.enemies || combatSnapshot.enemyIds || [];
      const tempLoot = this.rollCombatLootFromEnemies(enemyIds);
      if (tempLoot.length > 0) {
        this.showCombatLootModal(tempLoot, next, combatSnapshot);
      } else {
        this.finishCombatVictory(next, combatSnapshot);
      }
      this.saveGame();
      return;
    }
    const turn = this.state.combat.order[this.state.combat.turnIndex];
    if (!turn) { this.state.combat.turnIndex = 0; this.nextCombatTurn(); return; }
    if (turn.type === 'player') {
      const playerHolder = this.getPlayerEffectHolder();
      const pr = this.processEffects(playerHolder);
      this.renderCombat();
      if (pr.skipTurn) {
        this.log(`💫 ${playerHolder.name} оглушён и пропускает ход`, 'log-dice');
        this.state.combat.turnIndex++;
        setTimeout(() => this.nextCombatTurn(), 700);
        return;
      }
      this.setCombatPhase('player_turn');
      if (this.isPf2e()) this.resetPf2eCombatActions();
      this.renderCombat();
      this.playerCombatTurn();
    } else {
      this.setCombatPhase('enemy_turn');
      const enemy = this.state.enemies[turn.index];
      if (enemy && enemy.hp > 0) {
        const holder = this.getEnemyEffectHolder(enemy);
        const er = this.processEffects(holder);
        this.renderCombat();
        if (er.skipTurn) {
          this.log(`💫 ${enemy.name} оглушён и пропускает ход`, 'log-dice');
        } else {
          this.enemyTurn(enemy);
        }
      }
      this.state.combat.turnIndex++;
      setTimeout(() => this.nextCombatTurn(), 900);
    }
  },

  playerCombatTurn() {
    const area = document.getElementById('choices-area');
    if (!area) return;

    if (this.getCombatPhase() === 'select_target') {
      const pendingAb = this.state.combat?.pendingAbility;
      const pendingItemId = this.state.combat?.pendingConsumableId;
      const pendingItem = pendingItemId ? this.data?.items?.[pendingItemId] : null;
      let html = '<b style="color:var(--accent); display:block; margin-bottom:8px; font-family:Amatic SC,cursive; font-size:26px;">Выберите цель</b>';
      if (pendingAb) {
        html += `<div style="margin-bottom:10px;">Умение: ${this.renderIcon(pendingAb.icon)} <b>${this.escapeHtml(pendingAb.name)}</b> — клик по врагу в панели боя.</div>`;
      } else if (pendingItem) {
        html += `<div style="margin-bottom:10px;">Предмет: ${this.renderIcon(pendingItem.icon || '🧪')} <b>${this.escapeHtml(pendingItem.name)}</b> — клик по врагу в панели боя.</div>`;
      }
      html += `<button type="button" class="choice" onclick="GameEngine.cancelAbilityTargetSelect()">↩ Отмена (Esc)</button>`;
      area.innerHTML = html;
      this.updateCombatTargetHint();
      return;
    }

    const cls = this.state.classData;
    const atkBonus = this.getEffectivePlayerAtkBonus();
    const dmgText = 'Урон: ' + this.formatEquippedDamageLabel(cls);
    let html = '<b style="color:var(--accent); display:block; margin-bottom:8px; font-family:Amatic SC,cursive; font-size:26px;">Ваш ход:</b>';
    if (this.isPf2e()) {
      const left = this.state.combat?.actionsRemaining ?? this.getPf2eActionsPerTurn();
      html += `<div class="pf2e-actions-indicator" style="margin-bottom:8px;">⚡ Действия: ${'◆'.repeat(left)}${'◇'.repeat(this.getPf2eActionsPerTurn() - left)}</div>`;
    }
    html += `<div style="font-size:20px; color:var(--ink-light); margin-bottom:10px; font-family:'Caveat',cursive;">Атака: к20+${atkBonus} против КД | ${this.escapeHtml(dmgText)}</div>`;
    this.state.enemies.forEach((e, i) => {
      if (e.hp > 0) {
        const eac = this.getEffectiveEnemyAC(e);
        html += `<button type="button" class="choice" onclick="GameEngine.playerAttack(${i})">⚔️ Атаковать ${this.escapeHtml(this.getEnemyDisplayName(e))} (КД ${eac})</button>`;
      }
    });
    if (cls.abilities) {
      cls.abilities.forEach(ab => {
        if (!ab.id) return;
        const usedThisCombat = this.state.combat.abilitiesUsed && this.state.combat.abilitiesUsed[ab.id];
        if (!ab.oncePerCombat || !usedThisCombat) {
          if (!this.isSpellBlockedByCurse(ab) && this.canAffordAbility(ab)) {
            const sl = this.getAbilitySpellLevel(ab);
            const costLabel = sl >= 1 ? `круг ${sl}` : `${ab.cost ?? 0} ${this.escapeHtml(cls.resourceName)}`;
            html += `<button type="button" class="choice ability-choice" ${this.onclickGame('useAbility', ab.id)}>${this.renderIcon(ab.icon)} ${this.escapeHtml(ab.name)} (${costLabel})</button>`;
          }
        }
      });
    }
    const combatConsumables = this.getCombatUsableConsumables();
    html += '<div class="combat-consumable-row" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0;width:100%;">';
    if (combatConsumables.length) {
      html += '<label style="font-weight:600;">🎒 Предмет:</label>';
      html += '<select id="combat-consumable-select" class="combat-consumable-select" style="flex:1;min-width:140px;padding:6px;font-size:14px;">';
      combatConsumables.forEach(cid => {
        const cdb = this.data.items[cid];
        const label = this.getConsumableButtonLabel(cdb);
        html += `<option value="${this.escapeAttr(cid)}">${this.escapeHtml((cdb?.icon || '🧪') + ' ' + (cdb?.name || cid) + ' — ' + label)}</option>`;
      });
      html += '</select>';
      html += '<button type="button" class="choice" onclick="GameEngine.useCombatConsumableSelect()">Использовать</button>';
    } else {
      html += `<button type="button" class="choice" disabled style="opacity:0.55;cursor:not-allowed;" title="Нет подходящих расходников">🎒 Использовать предмет</button>`;
    }
    html += '</div>';
    html += `<button type="button" class="choice" onclick="GameEngine.playerFlee()">🏃 Отступить (к20+${cls.initBonus} vs DC 14)</button>`;
    area.innerHTML = html;
  },

  applyAbilityLogic(ability, target = null) {
    let endsTurn = true;
    this._abilitySoundCtx = ability;

    const runEffect = (rawEffect) => {
      if (rawEffect == null) return;
      let effect = rawEffect;
      if (typeof rawEffect === 'object' && rawEffect.type && ability.targeting && !rawEffect.targeting) {
        effect = { ...rawEffect, targeting: ability.targeting };
      }
      const result = this.applyEffect(effect, target);
      if (result === false) endsTurn = false;
    };

    if (ability.effects && Array.isArray(ability.effects)) {
      ability.effects.forEach(runEffect);
      this._abilitySoundCtx = null;
      return endsTurn;
    }

    if (ability.effect != null) {
      runEffect(ability.effect);
      this._abilitySoundCtx = null;
      return endsTurn;
    }

    if (ability.passive || ability.type === 'passive') {
      this.log('Пассивное умение уже действует.', 'log-dice');
      this._abilitySoundCtx = null;
      return true;
    }

    this.log(ability.desc || 'Умение использовано.', 'log-dice');
    this._abilitySoundCtx = null;
    return true;
  },

  useAbility(abilityIdOrObj) {
    const ability = typeof abilityIdOrObj === 'string'
      ? this.state.classData.abilities?.find(a => a.id === abilityIdOrObj)
      : abilityIdOrObj;
    if (!ability) return;

    if (this.state.combat && !this.isPlayerCombatPhase()) {
      this.log('Не ваш ход!', 'log-damage');
      return;
    }

    if (this.getCombatPhase() === 'select_target') {
      this.log('Сначала выберите цель или нажмите «Отмена».', 'log-dice');
      return;
    }

    if (this.isAbilityCombatOnly(ability) && !this.state.combat) {
      this.log('Это умение можно использовать только в бою.', 'log-dice');
      return;
    }

    if (this.state.combat?.abilitiesUsed?.[ability.id] && ability.oncePerCombat) {
      this.log('Умение уже использовано в этом бою.', 'log-dice');
      return;
    }

    if (this.isSpellBlockedByCurse(ability)) {
      this.log('🤐 Проклятие безмолвия: заклинания недоступны.', 'log-damage');
      return;
    }

    if (!this.canAffordAbility(ability)) {
      const sl = this.getAbilitySpellLevel(ability);
      this.log(sl >= 1 ? '❌ Нет свободной ячейки этого круга!' : '❌ Недостаточно ресурса!', 'log-damage');
      return;
    }

    // scope: single + урон по врагу — фаза выбора цели (стоимость списывается после клика)
    if (this.abilityRequiresEnemyTarget(ability)) {
      this.beginAbilityTargetSelect(ability);
      return;
    }

    this.executeAbility(ability, null);
  },
  playerAttack(idx) {
    if (this.getCombatPhase() === 'select_target') {
      this.cancelAbilityTargetSelect();
    }
    if (this.getCombatPhase() !== 'player_turn') {
      this.log('Сейчас нельзя атаковать.', 'log-damage');
      return;
    }
    const enemy = this.state.enemies[idx];
    const cls = this.state.classData;
    const atkBonus = this.getEffectivePlayerAtkBonus();
    const enemyAc = this.getEffectiveEnemyAC(enemy);

    if (this.isPf2e()) {
      if (!this.spendPf2eActions(1)) return;
      const map = this.state.combat?.mapPenalty || 0;
      const attacker = {
        atkBonus,
        dmgRoll: cls?.dmgRoll || '1d6',
        dmgBonus: cls?.dmgBonus ?? 0
      };
      const result = this.activeSystem.rollAttack(attacker, { ac: enemyAc }, this, { mapPenalty: map });
      this.state.combat.mapPenalty = Math.min(10, map + 5);

      const degreeLabels = {
        critical_success: 'критический успех',
        success: 'успех',
        failure: 'провал',
        critical_failure: 'критический провал'
      };
      const degLabel = degreeLabels[result.degree] || result.degree;

      if (result.hit && result.dmg > 0) {
        enemy.hp -= result.dmg;
        this.log(
          `🎲 ${result.roll}+${atkBonus}${map ? map : ''}=${result.total} vs КД ${enemyAc} — ${degLabel}! 💥 ${result.dmg} урона`,
          result.crit ? 'log-damage' : 'log-damage'
        );
        this.playCombatSound(result.crit ? 'attack_crit' : this.getAttackSoundId());
      } else {
        this.log(
          `🎲 ${result.roll}+${atkBonus}${map ? map : ''}=${result.total} vs КД ${enemyAc} — ${degLabel}`,
          'log-dice'
        );
        this.playCombatSound('attack_miss');
      }
      this.renderCombat();
      if (this.endPf2ePlayerTurnIfNoActions()) return;
      this.playerCombatTurn();
      return;
    }

    const roll = this.d20();
    const total = roll + atkBonus;
    let smiteBonus = 0;
    if (this.state.combat && this.state.combat.divineSmite) {
      smiteBonus = this.state.combat.smiteRoll
        ? this.parseRoll(this.state.combat.smiteRoll)
        : this.d(8) + this.d(8);
      this.state.combat.divineSmite = false;
      this.state.combat.smiteRoll = null;
    }
    if (roll === 20) {
      const dmg = this.rollPlayerWeaponDamage(true) + smiteBonus;
      enemy.hp -= dmg;
      this.log('🎲 Крит! ' + roll + '+' + atkBonus + '=' + total + ' | 💥 ' + dmg + ' урона по ' + enemy.name + '!' + (smiteBonus > 0 ? ' (с божественным кара)' : ''), 'log-damage');
      this.playCombatSound(smiteBonus > 0 ? 'smite_crit' : 'attack_crit');
    } else if (roll === 1) {
      this.log('🎲 Провал! (' + roll + ')', 'log-dice');
      this.playCombatSound('attack_miss');
    } else if (total >= enemyAc) {
      const dmg = this.rollPlayerWeaponDamage(false) + smiteBonus;
      enemy.hp -= dmg;
      this.log('🎲 ' + roll + '+' + atkBonus + '=' + total + ' vs КД ' + enemyAc + ' — попадание! 💥 ' + dmg + ' урона' + (smiteBonus > 0 ? ' (с божественным кара)' : ''), 'log-damage');
      this.playCombatSound(smiteBonus > 0 ? 'smite_hit' : this.getAttackSoundId());
    } else {
      this.log('🎲 ' + roll + '+' + atkBonus + '=' + total + ' vs КД ' + enemyAc + ' — промах', 'log-dice');
      this.playCombatSound('attack_miss');
    }
    this.renderCombat();
    if (this.state.combat && this.state.combat.actionSurge) {
      this.state.combat.actionSurge = false;
      this.playerCombatTurn();
      return;
    }
    this.state.combat.turnIndex++;
    setTimeout(() => this.nextCombatTurn(), 600);
  },

  usePotionInCombat() {
    this.useConsumable('healing_potion');
  },

  playerFlee() {
    const roll = this.d20() + this.state.classData.initBonus;
    if (roll >= 14) {
      this.log('🏃 Удалось отступить! (' + roll + ')', 'log-combat');
      if (typeof this.clearCombatConcentration === 'function') this.clearCombatConcentration(true);
      this.state.combat = null; this.state.enemies = [];
      const ca = document.getElementById('combat-area');
      if (ca) ca.classList.add('hidden');
      this.showScene('fled');
    } else {
      this.log('🏃 Не удалось (' + roll + ')', 'log-combat');
      this.state.combat.turnIndex++;
      setTimeout(() => this.nextCombatTurn(), 600);
    }
  },

  enemyTurn(enemy) {
    const roll = this.d20();
    const bonus = enemy.atkBonus || 3;
    const total = roll + bonus;
    let effectiveAC = this.getEffectivePlayerAC();
    if (this.state.combat?.shieldSpell) {
      effectiveAC += 5;
      if (!this.isConcentratingCleanup?.('shieldSpell')) {
        this.state.combat.shieldSpell = false;
      }
    }
    const applyEnemyOnHit = () => {
      if (!enemy.onHit?.addEffect) return;
      const h = this.getPlayerEffectHolder();
      if (h) this.applyStatusEffect(h, enemy.onHit.addEffect, enemy.name);
      this.renderCombat();
    };
    if (roll === 20) {
      const dmg = this.parseRoll(enemy.dmgRoll) + this.parseRoll(enemy.dmgRoll) + enemy.dmgBonus;
      const dead = this.takeDamage(dmg);
      this.log('💀 ' + enemy.name + ' критует! ' + dmg + ' урона!', 'log-damage');
      if (!dead) applyEnemyOnHit();
      if (dead) return;
    } else if (total >= effectiveAC) {
      const dmg = this.parseRoll(enemy.dmgRoll) + enemy.dmgBonus;
      const dead = this.takeDamage(dmg);
      this.log('⚔️ ' + enemy.name + ' попадает (' + roll + '+' + bonus + '=' + total + ') — ' + dmg + ' урона', 'log-damage');
      if (!dead) applyEnemyOnHit();
      if (dead) return;
    } else {
      this.log(enemy.name + ' промах (' + roll + '+' + bonus + '=' + total + ' vs КД ' + effectiveAC + ')', 'log-dice');
    }
    if (this.state.combat) {
      this.state.combat.shieldBlock = false;
      if (!this.isConcentratingCleanup?.('shieldOfFaith')) {
        this.state.combat.shieldOfFaith = false;
      }
      if (!this.isConcentratingCleanup?.('tempAcBonus')) {
        this.state.combat.tempAcBonus = 0;
      }
    }
  },

  // ========== ОТОБРАЖЕНИЕ ==========
  setText(txt) {
    const el = document.getElementById('story-text');
    if (el) el.textContent = this.processSceneTemplate(txt);
  },

  setDialogue(lines) {
    const area = document.getElementById('dialogue-area');
    if (!area) return;
    const rows = (lines || []).map(l => {
      const speaker = this.processSceneTemplate(l.speaker || '');
      const text = this.processSceneTemplate(l.text || l.line || '');
      return `<div class="dialogue-block"><div class="speaker">${this.escapeHtml(speaker)}:</div><div class="text">«${this.escapeHtml(text)}»</div></div>`;
    });
    area.innerHTML = rows.join('');
  },

  clearDialogue() {
    const area = document.getElementById('dialogue-area');
    if (area) area.innerHTML = '';
  },

  getChoiceUsedFlag(choice, index) {
    if (choice.doneFlag) return choice.doneFlag;
    if (choice.skillCheck) {
      if (choice.skillCheck.doneFlag) return choice.skillCheck.doneFlag;
      if (choice.skillCheck.once === false) return null;
      return `sc_${this.state.scene}_${index}`;
    }
    if (choice.once) return `ch_${this.state.scene}_${index}`;
    return null;
  },

  isChoiceUsed(choice, index) {
    const flag = this.getChoiceUsedFlag(choice, index);
    return !!(flag && this.state.flags[flag]);
  },

  markChoiceUsed(choice, index) {
    const flag = this.getChoiceUsedFlag(choice, index);
    if (!flag || this.state.flags[flag]) return;
    this.state.flags[flag] = true;
    this.saveGame();
  },

  /** Только смена стадии квеста без перехода на другую сцену */
  applyChoiceQuestSet(choiceIndex) {
    const choice = this.state.currentChoices?.[choiceIndex];
    if (!choice?.questSet) return;
    const origIdx = this.state.currentChoiceIndices?.[choiceIndex] ?? choiceIndex;
    if (this.isChoiceUsed(choice, origIdx)) return;
    if (choice.once) this.markChoiceUsed(choice, origIdx);
    this.applyChoiceReputation(choice);
    this.updateQuest(choice.questSet.questId, choice.questSet.stage);
  },

  pickChoice(choiceIndex) {
    const choices = this.state.currentChoices || [];
    const choice = choices[choiceIndex];
    if (!choice) return;
    const origIdx = this.state.currentChoiceIndices?.[choiceIndex] ?? choiceIndex;
    if (this.isChoiceUsed(choice, origIdx)) return;
    if (choice.once) this.markChoiceUsed(choice, origIdx);
    if (choice.questSet?.questId != null && choice.questSet.stage != null) {
      this.updateQuest(choice.questSet.questId, choice.questSet.stage);
    }
    this.applyChoiceReputation(choice);
    if (choice.to) this.showScene(choice.to);
  },

  setChoices(choices) {
    const area = document.getElementById('choices-area');
    if (!area) return;

    const allChoices = Array.isArray(choices) ? choices : [];
    const ctx = this.getConditionContext();
    const visible = [];
    const visibleIndices = [];
    allChoices.forEach((c, i) => {
      if (ConditionSystem.isChoiceVisible(c, ctx)) {
        visible.push(c);
        visibleIndices.push(i);
      }
    });
    this.state.currentChoices = visible;
    this.state.currentChoiceIndices = visibleIndices;

    area.innerHTML = visible.map((c, vi) => {
      const i = visibleIndices[vi];
      const disabled = this.isChoiceUsed(c, i);
      const cls = 'choice' + (disabled ? ' done' : '');
      const iconHtml = c.icon ? `${this.renderIcon(c.icon)} ` : '';
      const label = `${iconHtml}${this.escapeHtml(c.text || '')}${disabled ? ' ✓' : ''}`;

      if (c.skillCheck) {
        const sc = c.skillCheck;
        const usedFlag = this.getChoiceUsedFlag(c, i);
        const checkData = encodeURIComponent(JSON.stringify({
          to: c.to,
          skill: sc.skill,
          dc: sc.dc,
          sText: sc.successText || '',
          fText: sc.failText || '',
          sFlags: sc.successFlags || null,
          fFlags: sc.failFlags || null,
          sItems: sc.successItems || null,
          sNext: sc.successNext || c.to,
          fNext: sc.failNext || c.to,
          usedFlag,
          choiceIndex: vi,
          sceneId: this.state.scene,
          exp: sc.exp,
          expOnce: sc.expOnce,
          expKey: sc.expKey
        }));

        return `<button type="button" class="${cls}" ${disabled ? 'disabled' : ''} 
                  ${this.onclickGame('handleSkillCheckSafe', checkData)}>${label}</button>`;
      }

      if (c.questSet?.questId != null && c.questSet.stage != null && !c.to && !c.skillCheck && !c.action) {
        return `<button type="button" class="${cls}" ${disabled ? 'disabled' : ''} 
                onclick="GameEngine.applyChoiceQuestSet(${vi})">${label}</button>`;
      }

      if (c.action) {
        const classMatch = /^select_class:(.+)$/.exec(c.action);
        if (classMatch && this.data?.classes?.[classMatch[1]]) {
          return `<button type="button" class="${cls}" ${this.onclickGame('selectClass', classMatch[1])}>${label}</button>`;
        }
        if (c.action === 'start_game') return `<button type="button" class="${cls}" onclick="GameEngine.startGame()">${label}</button>`;
        if (c.action === 'reset_game') return `<button type="button" class="${cls}" onclick="GameEngine.resetGame()">${label}</button>`;
        if (c.action === 'jack_turn_in') {
          return `<button type="button" class="${cls}" ${disabled ? 'disabled' : ''} onclick="GameEngine.handleJackTurnIn()">${label}</button>`;
        }
        const travelMatch = /^travel:(.+)$/.exec(c.action);
        if (travelMatch) {
          return `<button type="button" class="${cls}" onclick="GameEngine.travelTo(${JSON.stringify(travelMatch[1])})">${label}</button>`;
        }
        const passthroughMatch = /^special_passthrough:(.+)$/.exec(c.action);
        if (passthroughMatch) {
          return `<button type="button" class="${cls}" onclick="GameEngine.runSpecialScenePassthrough(${JSON.stringify(passthroughMatch[1])})">${label}</button>`;
        }
      }

      return `<button type="button" class="${cls}" ${disabled ? 'disabled' : ''} 
              onclick="GameEngine.pickChoice(${vi})">${label}</button>`;
    }).join('');
  },

  handleSkillCheckSafe(encodedData) {
    const data = JSON.parse(decodeURIComponent(encodedData));
    const vi = data.choiceIndex;
    const origIdx = this.state.currentChoiceIndices?.[vi] ?? vi;
    const choice = this.state.currentChoices?.[vi]
      || this.data.scenes[data.sceneId || this.state.scene]?.choices?.[origIdx];

    if (data.usedFlag && this.state.flags[data.usedFlag]) return;

    if (choice) this.markChoiceUsed(choice, origIdx);
    else if (data.usedFlag) this.state.flags[data.usedFlag] = true;

    this.handleSkillCheck(
      { to: data.to },
      data.skill,
      data.dc,
      data.sText,
      data.fText,
      data.sFlags,
      data.sItems,
      data.sNext,
      data.fNext,
      data.fFlags,
      { exp: data.exp, expOnce: data.expOnce, expKey: data.expKey }
    );
  },
  handleSkillCheck(choice, skill, dc, successText, failText, successFlags, successItems, successNext, failNext, failFlags, skillCheckMeta) {
    const bonus = this.getSkillBonus(skill);
    const roll = this.d20() + bonus;
    const resolveNext = (next, fallback) => {
      if (typeof next === 'string' && next.trim()) return next;
      return typeof fallback === 'string' ? fallback : '';
    };

    if (roll >= dc) {
      this.log(`✅ Успех! ${skill}: ${roll} vs ${dc}`, 'log-combat');

      // Успех: показываем текст успеха
      this.setText(successText || 'Проверка пройдена!');
      this.clearDialogue();

      this.applyFlags(successFlags);

      if (successItems) {
        successItems.forEach(item => this.addItem(item));
      }

      this.awardSkillCheckExp(skill, skillCheckMeta || {});

      const next = resolveNext(successNext, choice.to);
      this.setChoices([
        { text: 'Продолжить', to: next }
      ]);

    } else {
      this.log(`❌ Провал. ${skill}: ${roll} vs ${dc}`, 'log-dice');

      // Провал: показываем текст провала
      this.setText(failText || 'Проверка провалена.');
      this.clearDialogue();

      this.applyFlags(failFlags);

      // Переход или остаёмся
      const next = resolveNext(failNext, choice.to);
      this.setChoices([
        { text: 'Продолжить', to: next }
      ]);
    }
  },

  /** @deprecated Используйте renderActiveQuests */
  renderQuestLog() {
    this.renderActiveQuests();
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
      { text: '← Назад в лавку', to: 'village_shop' }
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
      this.state.supplies += 1;
      this.updateStats();
      this.log(`Куплены припасы (-${price} зм). Всего припасов: ` + this.state.supplies);
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

  // ========== ШЕСТЕРНИ ==========
  handleGearTop() {
    this.gearPuzzle('top');
  },

  handleGearMid() {
    this.gearPuzzle('mid');
  },

  handleGearBot() {
    this.gearPuzzle('bot');
  },

  // ========== ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ ==========
  initUI() {
    if (typeof SidebarDock !== 'undefined') SidebarDock.init();
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
  saveGame() {
    try {
      const saveData = {
        version: this.data?.meta?.version || "2.0",
        timestamp: Date.now(),
        charName: this.state.charName,
        className: this.state.className,
        gender: this.state.gender || 'male',
        raceKey: this.state.raceKey || '',
        heritageId: this.state.heritageId || '',
        pf2eFixedBoosts: this.state.pf2eFixedBoosts || null,
        pf2eFreeBoosts: this.state.pf2eFreeBoosts || null,
        stats: this.state.stats,
        hp: this.state.hp,
        maxHp: this.state.maxHp,
        baseMaxHp: this.state.baseMaxHp,
        gold: this.state.gold,
        inventory: this.state.inventory,
        flags: this.state.flags,
        scene: this.state.scene,
        supplies: this.state.supplies,
        resources: this.state.resources,
        questStages: this.state.questStages,
        level: this.state.level,
        exp: this.state.exp,
        expAwarded: this.state.expAwarded,
        classData: this.state.classData,
        equipped: this.state.equipped || {},
        curseEffects: this.state.curseEffects || {},
        itemEnhancements: this.state.itemEnhancements || {},
        resumeAfterLevelUp: this.state.resumeAfterLevelUp,
        sceneVisits: this.state.sceneVisits || {},
        visitedLocations: this.state.visitedLocations || {}
      };

      localStorage.setItem(this.getSaveKey(), JSON.stringify(saveData));
      this.log('💾 Игра сохранена успешно', 'log-heal');
      return true;
    } catch (e) {
      console.error(e);
      this.log('❌ Ошибка сохранения', 'log-damage');
      return false;
    }
  },

  /** Загрузка сохранения (алиас для loadGame) */
  loadSave() {
    return this.loadGame();
  },

      loadGame() {
    try {
      const saved = localStorage.getItem(this.getSaveKey());
      if (!saved) {
        this.log('💾 Сохранений не найдено', 'log-dice');
        return false;
      }

      const data = JSON.parse(saved);

      this.state.charName = data.charName || 'Герой';
      this.state.className = data.className;
      this.state.gender = data.gender || 'male';
      this.state.raceKey = data.raceKey || '';
      this.state.raceData = this.state.raceKey ? this.getRaceData(this.state.raceKey) : null;
      this.state.heritageId = data.heritageId || '';
      this.state.pf2eFixedBoosts = data.pf2eFixedBoosts || null;
      this.state.pf2eFreeBoosts = data.pf2eFreeBoosts || null;
      this.state.stats = data.stats || data.classData?.stats || null;
      this.state.hp = parseInt(data.hp) || 25;
      this.state.maxHp = parseInt(data.maxHp) || 25;
      this.state.baseMaxHp = data.baseMaxHp != null ? parseInt(data.baseMaxHp, 10) : null;
      this.state._lastComputedMaxHp = this.state.maxHp;
      this.state.gold = parseInt(data.gold) || 0;
      this.state.inventory = data.inventory || [];
      this.state.flags = data.flags || {};
      this.applyStartingFlags();
      this.state.scene = data.scene || 'village';
      this.state.supplies = parseInt(data.supplies) || 0;
      this.state.questStages = data.questStages || {};
      this.migrateSaveQuestStages();
      this.state.resources = data.resources || { mode: 'energy', current: 2, max: 2, spellSlots: null };
      this.migrateResourcesState();
      this.state.level = parseInt(data.level, 10) || 1;
      this.state.exp = parseInt(data.exp, 10) || 0;
      this.state.expAwarded = data.expAwarded || {};
      this.state.pendingLevelUp = null;
      this.state.resumeAfterLevelUp = data.resumeAfterLevelUp || null;
      this.state.sceneVisits = data.sceneVisits || {};
      this.state.visitedLocations = data.visitedLocations || {};

      this.state.equipped = data.equipped || {};
      this.state.curseEffects = data.curseEffects || {};
      this.state.itemEnhancements = data.itemEnhancements || {};
      this.migrateEquippedSlots();
      this.migrateCurseState();

      if (data.classData && data.className) {
        this.state.classData = data.classData;
        this.state.classData.abilities = this.reconcileAbilities(
          this.state.classData.abilities,
          data.className
        );
        const race = this.getRaceData(this.state.raceKey);
        const racial = this.buildRacialAbilities(race);
        racial.forEach(ab => {
          if (!this.state.classData.abilities.some(a => a.id === ab.id)) {
            this.state.classData.abilities.push(
              this.normalizeAbility(ab, data.className, this.state.classData.abilities.length)
            );
          }
        });
      } else if (this.state.className && this.data?.classes?.[this.state.className]) {
        const cls = this.data.classes[this.state.className];
        const resource = cls.resource || { name: 'Ресурс', max: 2, desc: '' };
        this.state.classData = {
          ac: cls.ac ?? 10,
          atkBonus: cls.atkBonus ?? 0,
          dmgRoll: cls.dmgRoll || '1d6',
          dmgBonus: cls.dmgBonus ?? 0,
          initBonus: cls.initBonus ?? 0,
          stats: JSON.parse(JSON.stringify(cls.stats || {})),
          skills: cls.skills || '',
          resourceName: resource.name,
          resourceDesc: resource.desc || '',
          abilities: this.normalizeAbilities(cls.abilities, this.state.className)
        };
        if (!Object.keys(this.state.equipped).length) {
          this.autoEquipStartingGear(this.state.className);
        }
      }

      if (this.state.classData) {
        this.recalculateCombatStats();
      }

      // Переключение экранов
      this.hideCharacterCreator();
      document.getElementById('class-screen').classList.add('hidden');
      document.getElementById('name-screen').classList.add('hidden');
      document.getElementById('game-content').classList.remove('hidden');

      // Обновление интерфейса
      this.setCharName(this.state.charName);

      this.renderClassDisplay(this.state.className);
      this.renderRaceDisplay(this.state.raceKey);
      this.updateUI();

      const resLabel = document.getElementById('resource-label');
      if (resLabel && this.state.classData?.resourceName) {
        resLabel.textContent = this.state.classData.resourceName;
      }

      this.showScene(this.state.scene);

      this.log('✅ Сохранение загружено', 'log-heal');
      return true;
    } catch (e) {
      console.error('Ошибка загрузки:', e);
      this.log('❌ Ошибка загрузки сохранения', 'log-damage');
      return false;
    }
  },

  deleteSave() {
    if (confirm('Удалить сохранение игры?')) {
      localStorage.removeItem(this.getSaveKey());
      this.log('🗑 Сохранение удалено', 'log-dice');
    }
  }
};

  // ============================================
  // СИСТЕМА СОХРАНЕНИЯ (localStorage)
  // ============================================

  

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
