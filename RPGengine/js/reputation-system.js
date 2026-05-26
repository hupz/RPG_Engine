// ============================================
// Система фракций и уровней репутации
// ============================================

const ReputationSystem = {
  DEFAULT_LEVELS: [
    { min: -100, max: -21, label: 'Вражда', color: '#c0392b', discount: -0.50, tradeAllowed: false },
    { min: -20, max: -1, label: 'Нейтралитет-', color: '#e67e22', discount: -0.20, tradeAllowed: true },
    { min: 0, max: 19, label: 'Нейтралитет', color: '#f1c40f', discount: 0, tradeAllowed: true },
    { min: 20, max: 49, label: 'Дружба', color: '#27ae60', discount: 0.10, tradeAllowed: true },
    { min: 50, max: 100, label: 'Герой', color: '#3498db', discount: 0.30, tradeAllowed: true, bonusAccess: [] }
  ],

  STATUS_CLASS_BY_LABEL: {
    'Вражда': 'enemy',
    'Нейтралитет-': 'neutral-low',
    'Нейтралитет': 'neutral',
    'Дружба': 'friend',
    'Герой': 'hero'
  },

  ensureFactions(data) {
    if (!data) return;
    if (!data.reputation || typeof data.reputation !== 'object') data.reputation = {};
    Object.entries(data.reputation).forEach(([id, meta]) => {
      if (id === 'starting' || !meta || typeof meta !== 'object') return;
      if (!Array.isArray(meta.levels) || !meta.levels.length) {
        meta.levels = this.DEFAULT_LEVELS.map((lv) => ({ ...lv, bonusAccess: lv.bonusAccess ? [...lv.bonusAccess] : undefined }));
      }
      if (!meta.icon) meta.icon = '🤝';
      if (!meta.name) meta.name = id;
    });
  },

  getFactionIds(data) {
    this.ensureFactions(data);
    return Object.keys(data?.reputation || {}).filter(
      (k) => k !== 'starting' && typeof data.reputation[k] === 'object'
    );
  },

  getFactionMeta(data, flag) {
    if (!flag) return null;
    this.ensureFactions(data);
    return data?.reputation?.[flag] || null;
  },

  getLevelForValue(factionMeta, value) {
    const v = Number(value) || 0;
    const levels = factionMeta?.levels?.length ? factionMeta.levels : this.DEFAULT_LEVELS;
    const sorted = [...levels].sort((a, b) => Number(b.min) - Number(a.min));
    for (const lv of sorted) {
      const min = Number(lv.min);
      const max = Number(lv.max);
      if (v >= min && v <= max) return lv;
    }
    return levels.find((lv) => v >= Number(lv.min) && v <= Number(lv.max)) || levels[2] || this.DEFAULT_LEVELS[2];
  },

  getNextLevel(factionMeta, value) {
    const v = Number(value) || 0;
    const levels = [...(factionMeta?.levels?.length ? factionMeta.levels : this.DEFAULT_LEVELS)]
      .sort((a, b) => Number(a.min) - Number(b.min));
    for (const lv of levels) {
      if (v < Number(lv.min)) return lv;
    }
    return null;
  },

  getStatusLabel(factionMeta, value) {
    return this.getLevelForValue(factionMeta, value).label || 'Нейтралитет';
  },

  getStatusClass(factionMeta, value) {
    const label = this.getStatusLabel(factionMeta, value);
    return this.STATUS_CLASS_BY_LABEL[label] || 'neutral';
  },

  /** Множитель цены: 1 - discount (скидка +0.1 → 0.9) */
  getPriceMultiplier(factionMeta, value) {
    const lv = this.getLevelForValue(factionMeta, value);
    const discount = Number(lv.discount) || 0;
    let mult = 1 - discount;
    return Math.max(0.5, Math.min(1.5, mult));
  },

  isTradeAllowed(factionMeta, value) {
    const lv = this.getLevelForValue(factionMeta, value);
    return lv.tradeAllowed !== false;
  },

  /** Поведение врага по текущему значению репутации с его фракцией */
  resolveEnemyBehavior(enemy, repValue) {
    const behavior = enemy?.behavior || {};
    const v = Number(repValue) || 0;
    const tiers = [
      { key: 'hero', match: (b) => v >= Number(b.threshold) },
      { key: 'friendly', match: (b) => v >= Number(b.threshold) },
      { key: 'neutral', match: (b) => v >= Number(b.threshold) },
      { key: 'hostile', match: (b) => v <= Number(b.threshold) }
    ];
    for (const tier of tiers) {
      const b = behavior[tier.key];
      if (!b || b.threshold == null) continue;
      if (tier.match(b)) return { tier: tier.key, ...b };
    }
    if (behavior.neutral) return { tier: 'neutral', ...behavior.neutral };
    return { tier: 'neutral', action: 'dialogue_then_combat', threshold: 0 };
  },

  evaluateReputationRule(rule, flags) {
    const rep = rule.reputation;
    if (!rep?.faction) return true;
    const cur = Number(flags[rep.faction]) || 0;
    const val = Number(rep.value);
    if (Number.isNaN(val)) return true;
    const op = rep.op || rep.operator || 'gte';
    if (op === 'gte' || op === '>=') return cur >= val;
    if (op === 'lte' || op === '<=') return cur <= val;
    if (op === 'eq' || op === '==') return cur === val;
    if (op === 'gt' || op === '>') return cur > val;
    if (op === 'lt' || op === '<') return cur < val;
    return cur >= val;
  },

  createDefaultFaction(id, name) {
    return {
      id,
      name: name || id,
      icon: '🤝',
      levels: this.DEFAULT_LEVELS.map((lv) => ({
        ...lv,
        bonusAccess: Array.isArray(lv.bonusAccess) ? [...lv.bonusAccess] : undefined
      })),
      effects: { onHostile: [], onHero: [] }
    };
  }
};
