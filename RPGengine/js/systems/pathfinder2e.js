// Pathfinder 2e — полная реализация RuleSystem

class Pathfinder2eRuleSystem extends RuleSystem {
  get id() { return 'pf2e'; }
  get label() { return 'Pathfinder 2e'; }
  get description() { return '3 действия за ход, 4 степени успеха, proficiency ranks.'; }

  get PROFICIENCY_RANKS() {
    return ['untrained', 'trained', 'expert', 'master', 'legendary'];
  }

  /** Бонус ранга к проверке навыка (PF2e Remastered) */
  get RANK_BONUS() {
    return {
      untrained: -2,
      trained: 2,
      expert: 4,
      master: 6,
      legendary: 8
    };
  }

  get RANK_SHORT() {
    return {
      untrained: 'U',
      trained: 'T',
      expert: 'E',
      master: 'M',
      legendary: 'L'
    };
  }

  getSkillDefs() {
    return {
      acrobatics: { stat: 'dex', ru: 'Акробатика' },
      arcana: { stat: 'int', ru: 'Магия (тайные знания)' },
      athletics: { stat: 'str', ru: 'Атлетика' },
      crafting: { stat: 'int', ru: 'Ремесло' },
      deception: { stat: 'cha', ru: 'Обман' },
      diplomacy: { stat: 'cha', ru: 'Дипломатия' },
      intimidation: { stat: 'cha', ru: 'Запугивание' },
      medicine: { stat: 'wis', ru: 'Медицина' },
      nature: { stat: 'wis', ru: 'Природа' },
      occultism: { stat: 'int', ru: 'Оккультизм' },
      performance: { stat: 'cha', ru: 'Выступление' },
      religion: { stat: 'wis', ru: 'Религия' },
      society: { stat: 'int', ru: 'Общество' },
      stealth: { stat: 'dex', ru: 'Скрытность' },
      survival: { stat: 'wis', ru: 'Выживание' },
      thievery: { stat: 'dex', ru: 'Воровство' },
      perception: { stat: 'wis', ru: 'Восприятие' }
    };
  }

  getAllSkillIds() {
    return Object.keys(this.getSkillDefs());
  }

  normalizeSkillId(raw) {
    const s = String(raw || '').trim().toLowerCase().replace(/\s+/g, '_');
    if (this.getSkillDefs()[s]) return s;
    const aliases = {
      thievery: 'thievery',
      stealth: 'stealth',
      arcane: 'arcana',
      lore: 'society'
    };
    return aliases[s] || s;
  }

  getNextRank(rank) {
    const order = this.PROFICIENCY_RANKS;
    const i = order.indexOf(rank || 'untrained');
    if (i < 0 || i >= order.length - 1) return null;
    return order[i + 1];
  }

  getModifier(score) {
    return Math.floor((Number(score) - 10) / 2);
  }

  getPointBuyConfig() {
    return {
      mode: 'ability_boosts',
      totalBoosts: 4,
      minScore: 8,
      maxScore: 18,
      boostValue: 2
    };
  }

  pointCost() {
    return 0;
  }

  getProficiencyBonus(level, rank) {
    const r = rank || 'trained';
    if (r === 'untrained' || rank == null) return 0;
    const rankBonus = { trained: 2, expert: 4, master: 6, legendary: 8 }[r] || 0;
    return rankBonus + Math.max(1, parseInt(level, 10) || 1);
  }

  get PF2E_SKILL_TO_STAT() {
    return {
      acrobatics: 'dex',
      athletics: 'str',
      crafting: 'int',
      deception: 'cha',
      diplomacy: 'cha',
      intimidation: 'cha',
      medicine: 'wis',
      nature: 'wis',
      occultism: 'int',
      performance: 'cha',
      religion: 'wis',
      society: 'int',
      stealth: 'dex',
      survival: 'wis',
      thievery: 'dex',
      perception: 'wis',
      persuasion: 'cha',
      investigation: 'int',
      insight: 'wis',
      arcana: 'int',
      athletics_ru: 'str'
    };
  }

  getStatForSkill(skill) {
    const key = String(skill || '').toLowerCase();
    return this.PF2E_SKILL_TO_STAT[key] || 'int';
  }

  /** Ранг навыка: state.skills → classData.skillProficiency → legacy строка skills */
  getSkillProficiencyRank(skill, classData, engine) {
    const key = this.normalizeSkillId(skill);
    const stateSkills = engine?.state?.skills;
    if (stateSkills && typeof stateSkills === 'object' && stateSkills[key]) {
      return stateSkills[key];
    }
    if (!classData) return 'untrained';
    const ranks = classData.skillProficiency || {};
    if (ranks[key]) return ranks[key];
    const skills = String(classData.skills || '').toLowerCase();
    if (skills.includes(key)) return 'trained';
    return 'untrained';
  }

  getSkillBonus(skill, stats, classData, engine) {
    if (!stats) return 0;
    const level = Math.max(1, parseInt(engine?.state?.level, 10) || 1);
    const key = this.normalizeSkillId(skill);
    const rank = this.getSkillProficiencyRank(key, classData, engine);
    const rankBonus = this.RANK_BONUS[rank] ?? this.RANK_BONUS.untrained;
    const statKey = this.getStatForSkill(key);
    const statMod = this.getModifier(stats[statKey] || 10);
    return level + statMod + rankBonus;
  }

  getSkillBonusBreakdown(skill, stats, classData, engine) {
    const level = Math.max(1, parseInt(engine?.state?.level, 10) || 1);
    const key = this.normalizeSkillId(skill);
    const rank = this.getSkillProficiencyRank(key, classData, engine);
    const rankBonus = this.RANK_BONUS[rank] ?? this.RANK_BONUS.untrained;
    const statKey = this.getStatForSkill(key);
    const statMod = this.getModifier(stats[statKey] || 10);
    return { level, statMod, rank, rankBonus, total: level + statMod + rankBonus };
  }

  calculateHP(classKey, level, stats, data, conMod, engine) {
    const cls = data?.classes?.[classKey];
    if (!cls) return 10;
    const draftRaceKey = engine?.CharacterCreator?.draft?.raceKey;
    const raceKey = engine?.state?.raceKey || draftRaceKey || '';
    const raceHp = raceKey && data?.races?.[raceKey]?.hp != null
      ? data.races[raceKey].hp
      : null;
    const ancestryKey = cls.ancestry || 'human';
    const ancestryHp = raceHp ?? data?.ancestries?.[ancestryKey]?.hp ?? cls.hp ?? 8;
    const classHpPerLevel = cls.hpPerLevel ?? 8;
    const mod = conMod != null ? conMod : this.getModifier(stats?.con ?? 10);
    const lvl = Math.max(1, parseInt(level, 10) || 1);
    return Math.max(1, ancestryHp + classHpPerLevel * lvl + mod * lvl);
  }

  calculateAC(stats, equipment, data, engineOrState) {
    const statsSafe = stats || {};
    const dexMod = this.getModifier(statsSafe.dex ?? 10);
    const engine = engineOrState?.getEquippedItem ? engineOrState : null;
    const playerState = engine?.state || engineOrState || {};
    const level = playerState.level || 1;
    const classKey = playerState.className;
    const cls = data?.classes?.[classKey];
    const armorProfRank = cls?.armorProficiency || playerState.armorProficiency || 'trained';

    let armor = null;
    if (engine?.getEquippedItem) {
      armor = engine.getEquippedItem('armor');
    } else if (equipment?.getEquippedItem) {
      armor = equipment.getEquippedItem('armor');
    } else {
      const armorId = equipment?.armor || playerState.equipped?.armor;
      armor = armorId ? (data?.items?.[armorId] || equipment?.itemsData?.[armorId]) : null;
    }

    const shieldBonus = engine?.getShieldAcBonus ? engine.getShieldAcBonus() : 0;

    if (armor && (armor.type === 'armor' || armor.slot === 'armor')) {
      const baseAc = parseInt(armor.ac ?? armor.baseAc, 10) || 10;
      const dexCap = armor.dexCap != null ? parseInt(armor.dexCap, 10) : 5;
      const effectiveDex = Math.min(dexMod, dexCap);
      const profBonus = this.getProficiencyBonus(level, armorProfRank);
      return baseAc + effectiveDex + profBonus + shieldBonus;
    }

    const unarmoredProf = this.getProficiencyBonus(level, armorProfRank);
    return 10 + dexMod + unarmoredProf + shieldBonus;
  }

  getDegreeOfSuccess(total, dc) {
    if (total >= dc + 10) return 'critical_success';
    if (total >= dc) return 'success';
    if (total <= dc - 10) return 'critical_failure';
    return 'failure';
  }

  rollAttack(attacker, target, engine, options = {}) {
    const map = options.mapPenalty || 0;
    const roll = engine.d20();
    const atkBonus = attacker?.atkBonus || 0;
    const total = roll + atkBonus + map;
    const ac = target?.ac || 10;
    let degree = this.getDegreeOfSuccess(total, ac);
    if (roll === 1) degree = 'critical_failure';
    if (roll === 20 && degree !== 'critical_failure') degree = 'critical_success';

    let dmg = 0;
    let crit = false;
    const dmgRoll = attacker?.dmgRoll || '1d6';
    const dmgBonus = attacker?.dmgBonus || 0;

    if (degree === 'critical_success') {
      dmg = engine.parseRoll(dmgRoll) * 2 + dmgBonus * 2;
      crit = true;
    } else if (degree === 'success') {
      dmg = engine.parseRoll(dmgRoll) + dmgBonus;
    }

    return {
      roll,
      total,
      degree,
      hit: degree === 'success' || degree === 'critical_success',
      crit,
      dmg,
      map
    };
  }

  getActionsPerTurn() { return 3; }

  getResourceMode(classKey, level, data) {
    const cls = data?.classes?.[classKey];
    if (!cls) return 'energy';
    if (cls.hasFocusPoints) return 'focus';
    if (cls.spellcasting && (cls.baseSlots || cls.progression)) return 'spellSlots';
    return 'energy';
  }

  initResources(classKey, level, data, engine) {
    const cls = data?.classes?.[classKey];
    if (!cls) {
      return { mode: 'energy', current: 0, max: 0, spellSlots: null };
    }
    if (cls.hasFocusPoints) {
      const maxFocus = Math.min(3, Math.max(1, parseInt(cls.focusPoints, 10) || 1));
      return { mode: 'focus', current: maxFocus, max: maxFocus, spellSlots: null };
    }
    if (cls.spellcasting && cls.baseSlots) {
      const slots = {};
      (cls.baseSlots || []).forEach((max, i) => {
        const n = Number(max) || 0;
        if (n > 0) slots[String(i + 1)] = { c: n, m: n };
      });
      return { mode: 'spellSlots', spellSlots: slots, current: 0, max: 0 };
    }
    const max = cls.resource?.max ?? this.getActionsPerTurn();
    return { mode: 'energy', current: max, max, spellSlots: null };
  }

  scaleEnemy(enemy, playerLevel, config, data) {
    const level = Math.max(1, parseInt(playerLevel, 10) || 1);
    if (!enemy) return enemy;
    if (level <= 1) {
      const copy = { ...enemy };
      copy.hp = parseInt(enemy.hp ?? enemy.maxHp, 10) || 1;
      copy.maxHp = copy.hp;
      return copy;
    }
    const scaled = { ...enemy };
    const cfg = config || {};
    if (cfg.enabled === false) {
      scaled.hp = parseInt(enemy.hp ?? enemy.maxHp, 10) || 1;
      scaled.maxHp = scaled.hp;
      return scaled;
    }
    const hpRate = enemy.boss ? (cfg.bossHpRatePerLevel ?? 0.35) : (cfg.hpRatePerLevel ?? 0.18);
    const hpMult = 1 + Math.max(0, level - 1) * hpRate;
    scaled.hp = Math.max(1, Math.floor((parseInt(enemy.hp, 10) || 10) * hpMult));
    scaled.maxHp = scaled.hp;
    scaled.atkBonus = (parseInt(enemy.atkBonus, 10) || 0) + Math.floor(level / 2);
    scaled.ac = (parseInt(enemy.ac, 10) || 10) + Math.floor(level / 3);
    scaled.dmgBonus = (parseInt(enemy.dmgBonus, 10) || 0) + Math.floor(level / 2);
    scaled.scaledLevel = level;
    return scaled;
  }

  getMaxLevel(data) {
    return data?.progression?.maxLevel || 20;
  }

  validateCharacter(draft) {
    if (!draft) return false;
    const cfg = this.getPointBuyConfig();
    const boosts = draft.boostsRemaining != null ? draft.boostsRemaining : 0;
    return boosts === 0;
  }
}

const Pathfinder2eSystem = new Pathfinder2eRuleSystem();
if (typeof window !== 'undefined') {
  window.Pathfinder2eSystem = Pathfinder2eSystem;
}
