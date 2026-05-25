// D&D 5e — системно-зависимая логика (вынесена из engine.js / character-creator)

class DnD5eRuleSystem extends RuleSystem {
  get id() { return 'dnd5e'; }
  get label() { return 'D&D 5e'; }
  get description() { return 'Dungeons & Dragons 5th Edition — модификаторы, КД, ячейки, proficiency.'; }

  getPointBuyConfig() { return { total: 27, min: 8, max: 15 }; }

  getSkillDefs() {
    return {
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
  }

  getStatForSkill(skill) {
    const defs = this.getSkillDefs();
    const key = String(skill || '').toLowerCase();
    if (defs[key]?.stat) return defs[key].stat;
    const byRu = Object.values(defs).find((d) => d.ru === skill);
    return byRu?.stat || 'int';
  }

  calculateHP(classKey, level, stats, data, conMod) {
    const hitDie = { warrior: 10, wizard: 6, paladin: 10 };
    const cls = data?.classes?.[classKey];
    const base = hitDie[classKey] ?? cls?.hpHitDie ?? cls?.hp ?? 10;
    const mod = conMod != null ? conMod : this.getModifier(stats?.con ?? 10);
    return Math.max(1, Number(base) + mod);
  }

  /** КД: броня + щит + DEX (ограничения light/medium/heavy) */
  calculateAC(stats, equipment, data, engine) {
    const dexMod = this.getModifier(stats?.dex ?? 10);
    const shieldBonus = typeof engine?.getShieldAcBonus === 'function' ? engine.getShieldAcBonus() : 0;
    const itemsData = equipment?.itemsData || data?.items || {};
    const getEquipped = equipment?.getEquippedItem || ((slot) => engine?.getEquippedItem?.(slot));

    const armor = typeof getEquipped === 'function' ? getEquipped('armor') : null;

    if (armor && (armor.type === 'armor' || (armor.type === 'equipment' && armor.slot === 'armor'))) {
      const baseAc = parseInt(armor.ac ?? armor.baseAc, 10);
      if (!Number.isNaN(baseAc)) {
        const armorType = String(armor.armorType || 'heavy').toLowerCase();
        let ac = baseAc;
        if (armorType === 'light') ac += dexMod;
        else if (armorType === 'medium') ac += Math.min(dexMod, 2);
        return ac + shieldBonus;
      }
    }

    return 10 + dexMod + shieldBonus;
  }

  getResourceMode(classKey, level, data, engine) {
    const cls = data?.classes?.[classKey];
    if (!cls) return 'energy';
    const lvl = level ?? 1;
    const slots = typeof engine?.getSlotsArrayForLevel === 'function'
      ? engine.getSlotsArrayForLevel(classKey, lvl)
      : [];
    if (!slots || !slots.length) return 'energy';
    if (cls.spellcasting && slots.length >= 1) return 'spellSlots';
    if (cls.halfCaster && lvl >= 2 && slots.length >= 1) return 'spellSlots';
    if (slots.length === 1 && !cls.spellcasting && !cls.halfCaster) return 'energy';
    if (slots.length > 1) return 'spellSlots';
    return 'energy';
  }

  initResources(classKey, level, data, engine) {
    const mode = this.getResourceMode(classKey, level, data, engine);
    const cls = data?.classes?.[classKey];
    if (mode === 'spellSlots') {
      const arr = typeof engine?.getSlotsArrayForLevel === 'function'
        ? engine.getSlotsArrayForLevel(classKey, level) || [2]
        : [2];
      const spellSlots = typeof engine?.buildSpellSlotsFromArray === 'function'
        ? engine.buildSpellSlotsFromArray(arr)
        : {};
      return { mode: 'spellSlots', spellSlots, current: 0, max: 0 };
    }
    const arr = typeof engine?.getSlotsArrayForLevel === 'function'
      ? engine.getSlotsArrayForLevel(classKey, level)
      : null;
    let max = cls?.resource?.max ?? 2;
    if (arr && arr.length === 1) max = Number(arr[0]) || max;
    return { mode: 'energy', current: max, max, spellSlots: null };
  }

  getSkillBonus(skill, stats, classData, engine) {
    if (!classData || !stats) return 0;

    const defs = this.getSkillDefs();
    const key = String(skill || '').toLowerCase();
    let def = defs[key];
    let skillNameRu = skill;

    if (def) {
      skillNameRu = def.ru || skill;
    } else {
      const byRu = Object.values(defs).find((d) => d.ru === skill);
      if (byRu) {
        def = byRu;
        skillNameRu = skill;
      }
    }

    const statKey = def?.stat || this.getStatForSkill(skill);
    const playerSkills = classData.skills || '';
    const skillIds = classData.skillIds || [];
    const proficientByRu = def?.ru && (playerSkills.includes(skillNameRu) || skillIds.includes(key));
    const proficientById = !def?.ru && (playerSkills.includes(skill) || skillIds.includes(key));
    const level = engine?.state?.level ?? 1;
    const proficiency = proficientByRu || proficientById
      ? this.getProficiencyBonus(level)
      : 0;

    const statValue = stats[statKey] || 10;
    return this.getModifier(statValue) + proficiency;
  }

  scaleEnemy(enemy, playerLevel, config, data) {
    const level = Math.max(1, parseInt(playerLevel, 10) || 1);
    const scaled = { ...enemy };
    const cfg = config || {};

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
    (cfg.acBonuses || []).forEach((row) => {
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
  }
}

const DnD5eSystem = new DnD5eRuleSystem();
if (typeof window !== 'undefined') window.DnD5eSystem = DnD5eSystem;
