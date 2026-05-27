// D&D 5e — системно-зависимая логика (вынесена из engine.js / character-creator)

class DnD5eRuleSystem extends RuleSystem {
  get id() { return 'dnd5e'; }
  get label() { return 'D&D 5e'; }
  get description() { return 'Dungeons & Dragons 5th Edition — модификаторы, КД, ячейки, proficiency.'; }

  getPointBuyConfig() { return { total: 27, min: 8, max: 15 }; }

  getSkillDefs() {
    return {
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
    const profList = engine?.getProficientSkillIds?.() || classData.skillIds || [];
    const playerSkills = classData.skills || '';
    const inList = profList.includes(key);
    const proficientByRu = def?.ru && (inList || playerSkills.includes(skillNameRu));
    const proficientById = !def?.ru && (inList || playerSkills.includes(skill));
    const level = engine?.state?.level ?? 1;
    const proficiency = proficientByRu || proficientById
      ? this.getProficiencyBonus(level)
      : 0;

    const statValue = stats[statKey] || 10;
    return this.getModifier(statValue) + proficiency;
  }

  scaleEnemy(enemy, playerLevel, config, data) {
    if (typeof EnemyScaling !== 'undefined') {
      return EnemyScaling.scaleEnemy(enemy, playerLevel, config);
    }
    return enemy ? { ...enemy } : enemy;
  }
}

const DnD5eSystem = new DnD5eRuleSystem();
if (typeof window !== 'undefined') window.DnD5eSystem = DnD5eSystem;
