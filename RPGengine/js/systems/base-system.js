// ============================================
// Базовый класс системы правил (Rule System)
// ============================================

class RuleSystem {
  get id() { return 'generic'; }
  get label() { return 'Generic d20'; }
  get description() { return 'Универсальная система на основе d20.'; }

  getStatKeys() { return ['str', 'dex', 'con', 'int', 'wis', 'cha']; }
  getStatLabels() {
    return { str: 'СИЛ', dex: 'ЛОВ', con: 'ТЕЛ', int: 'ИНТ', wis: 'МУД', cha: 'ХАР' };
  }

  getModifier(score) {
    return Math.floor((Number(score) - 10) / 2);
  }

  getPointBuyConfig() { return { total: 27, min: 8, max: 15 }; }

  pointCost(score) {
    const cfg = this.getPointBuyConfig();
    const s = Math.max(cfg.min, Math.min(cfg.max, Number(score) || cfg.min));
    if (s <= cfg.min) return 0;
    let cost = 0;
    for (let v = cfg.min + 1; v <= s; v++) cost += v <= 13 ? 1 : 2;
    return cost;
  }

  validateCharacter(draft) { return true; }

  calculateHP(classKey, level, stats, data, conMod) {
    const mod = conMod != null ? conMod : this.getModifier(stats?.con ?? 10);
    return Math.max(1, 10 + mod);
  }

  calculateAC(stats, equipment, data, engine) {
    const dexMod = this.getModifier(stats?.dex ?? 10);
    return 10 + dexMod;
  }

  getProficiencyBonus(level) {
    const lvl = Math.max(1, parseInt(level, 10) || 1);
    return Math.max(2, 2 + Math.floor((lvl - 1) / 4));
  }

  rollAttack(attacker, target, engine) {
    return { hit: false, dmg: 0, crit: false };
  }

  rollDamage(weapon, attacker, engine) {
    return 0;
  }

  getMaxLevel(data) { return data?.progression?.maxLevel || 10; }
  getExpTable(data) { return data?.progression?.expTable || [0]; }
  getLevelConfig(level, classKey, data) {
    return data?.classes?.[classKey]?.progression?.levels?.[String(level)] || {};
  }

  getResourceMode(classKey, level, data, engine) { return 'energy'; }

  initResources(classKey, level, data, engine) {
    const cls = data?.classes?.[classKey];
    const max = cls?.resource?.max ?? 2;
    return { mode: 'energy', current: max, max, spellSlots: null };
  }

  scaleEnemy(enemy, playerLevel, config, data) {
    return enemy ? { ...enemy } : enemy;
  }

  getSkillDefs() { return {}; }

  getStatForSkill(skill) {
    const defs = this.getSkillDefs();
    const key = String(skill || '').toLowerCase();
    if (defs[key]?.stat) return defs[key].stat;
    const byRu = Object.values(defs).find((d) => d.ru === skill);
    return byRu?.stat || 'int';
  }

  getSkillBonus(skill, stats, classData, engine) {
    const statKey = this.getStatForSkill(skill);
    const statValue = stats?.[statKey] ?? 10;
    return this.getModifier(statValue);
  }
}

if (typeof window !== 'undefined') window.RuleSystem = RuleSystem;
