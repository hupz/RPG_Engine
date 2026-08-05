// Патч прогрессии: ячейки заклинаний, уровни 1–10, выбор умений, ASI
// Подключать до engine.js

const SpellSlotProgression = {
  WIZARD_SLOTS: {
    1: [2],
    2: [3],
    3: [4, 2],
    4: [4, 3],
    5: [4, 3, 2],
    6: [4, 3, 3],
    7: [4, 3, 3, 1],
    8: [4, 3, 3, 2],
    9: [4, 3, 3, 3, 1],
    10: [4, 3, 3, 3, 2]
  },

  PALADIN_SLOTS: {
    2: [2],
    3: [3],
    4: [3, 1],
    5: [4, 2],
    6: [4, 2],
    7: [4, 3],
    8: [4, 3],
    9: [4, 3, 2],
    10: [4, 3, 2]
  },

  WARRIOR_RAGE: {
    1: [2],
    2: [3],
    3: [3],
    4: [4],
    5: [4],
    6: [4],
    7: [5],
    8: [5],
    9: [5],
    10: [6]
  },

  ABILITY_SPELL_LEVELS: {
    magic_missile: 1,
    shield_spell: 1,
    burning_hands: 1,
    detect_magic: 1,
    wizard_arcane_bolt: 1,
    wizard_venom: 1,
    wizard_ward: 1,
    wizard_scorch: 2,
    wizard_frost: 2,
    wizard_counterspell: 3,
    hold_person: 2,
    mirror_image: 2,
    fireball: 3,
    cone_of_cold: 5,
    lay_on_hands: 0,
    divine_smite: 1,
    divine_sense: 1,
    shield_of_faith: 1,
    paladin_bless: 1,
    paladin_holy_armor: 1,
    paladin_divine_shield: 2,
    paladin_radiant_strike: 1,
    paladin_aura: 2,
    paladin_divine_wrath: 2,
    aura_of_protection: 2,
    extra_attack_paladin: 0,
    turn_undead: 1,
    second_wind: 0,
    action_surge: 0,
    shield_block: 0,
    warrior_cleave: 0,
    warrior_rally: 0,
    warrior_parry: 0,
    warrior_whirlwind: 0,
    shield_master: 0,
    death_strike: 0,
    warrior_intimidate: 0,
    scroll_fireball: 0
  },

  applyClassSlots(cls, table, opts = {}) {
    if (!cls?.progression) cls.progression = { levels: {} };
    if (!cls.progression.levels) cls.progression.levels = {};
    Object.entries(table).forEach(([lvl, slots]) => {
      const key = String(lvl);
      if (!cls.progression.levels[key]) cls.progression.levels[key] = {};
      cls.progression.levels[key].slots = slots.slice();
    });
    if (opts.spellcasting) cls.spellcasting = true;
    if (opts.halfCaster) cls.halfCaster = true;
    if (opts.baseSlots) cls.baseSlots = opts.baseSlots.slice();
  },

  applyToGameData(data) {
    if (!data?.classes) return data;

    const wiz = data.classes.wizard;
    if (wiz) {
      this.applyClassSlots(wiz, this.WIZARD_SLOTS, { spellcasting: true, baseSlots: [2] });
      if (wiz.resource) {
        wiz.resource.name = 'Ячейки заклинаний';
        wiz.resource.desc = 'Тратятся при сотворении заклинаний. Восстанавливаются при отдыхе.';
      }
    }

    const pal = data.classes.paladin;
    if (pal) {
      this.applyClassSlots(pal, this.PALADIN_SLOTS, { halfCaster: true });
    }

    const war = data.classes.warrior;
    if (war) {
      this.applyClassSlots(war, this.WARRIOR_RAGE);
    }

    const pool = data.progression?.abilities;
    if (pool) {
      Object.entries(this.ABILITY_SPELL_LEVELS).forEach(([id, spellLevel]) => {
        if (pool[id]) pool[id].spellLevel = spellLevel;
      });
    }

    Object.values(data.classes).forEach(cls => {
      (cls.abilities || []).forEach(ab => {
        if (ab.spellLevel == null && this.ABILITY_SPELL_LEVELS[ab.id] != null) {
          ab.spellLevel = this.ABILITY_SPELL_LEVELS[ab.id];
        }
      });
    });

    if (typeof LevelProgressionPatch !== 'undefined') {
      LevelProgressionPatch.applyToGameData(data);
    }

    return data;
  }
};

/** Уровни 2–10: choices и ASI (4, 8, 10) */
const LevelProgressionPatch = {
  EXP_TABLE: [0, 80, 180, 320, 500, 750, 1100, 1550, 2100, 2800],

  LEVEL1_BONUS: {
    warrior: [
      'warrior_cleave', 'warrior_rally', 'warrior_parry', 'warrior_endurance',
      'shield_master', 'warrior_whirlwind', 'warrior_armor_mastery'
    ],
    wizard: [
      'wizard_arcane_bolt', 'wizard_venom', 'wizard_ward', 'wizard_scorch',
      'wizard_frost', 'mirror_image', 'wizard_meditation'
    ],
    paladin: [
      'paladin_bless', 'paladin_divine_shield', 'paladin_radiant_strike',
      'shield_of_faith', 'aura_of_protection', 'divine_sense'
    ]
  },

  CLASS_LEVELS: {
    warrior: {
      2: { choices: ['warrior_cleave', 'warrior_rally', 'warrior_parry'] },
      3: { choices: ['warrior_whirlwind', 'warrior_endurance', 'shield_master'], stats: { atkBonus: 1 } },
      4: { asi: true, choices: ['warrior_armor_mastery', 'death_strike'] },
      5: { choices: ['warrior_cleave', 'warrior_intimidate', 'warrior_rally'] },
      6: { choices: ['warrior_whirlwind', 'warrior_endurance', 'shield_master'] },
      7: { choices: ['warrior_parry', 'death_strike', 'warrior_armor_mastery'] },
      8: { asi: true, choices: ['warrior_cleave', 'warrior_rally'] },
      9: { choices: ['warrior_whirlwind', 'shield_master', 'warrior_intimidate'] },
      10: { asi: true, choices: ['death_strike', 'warrior_armor_mastery', 'warrior_endurance'] }
    },
    wizard: {
      2: { choices: ['wizard_arcane_bolt', 'wizard_meditation', 'wizard_venom', 'wizard_ward'] },
      3: { choices: ['wizard_scorch', 'wizard_frost', 'hold_person'], stats: { atkBonus: 1 } },
      4: { asi: true, choices: ['wizard_empower', 'wizard_counterspell', 'mirror_image'] },
      5: { choices: ['fireball', 'wizard_scorch', 'wizard_arcane_bolt'] },
      6: { choices: ['wizard_frost', 'wizard_ward', 'hold_person'] },
      7: { choices: ['wizard_counterspell', 'wizard_venom', 'mirror_image'] },
      8: { asi: true, choices: ['wizard_empower', 'wizard_arcane_bolt'] },
      9: { choices: ['fireball', 'wizard_scorch', 'cone_of_cold'] },
      10: { asi: true, choices: ['cone_of_cold', 'wizard_counterspell', 'hold_person'] }
    },
    paladin: {
      2: { choices: ['paladin_bless', 'paladin_holy_armor', 'paladin_divine_shield'] },
      3: { choices: ['paladin_radiant_strike', 'paladin_aura', 'shield_of_faith'], stats: { atkBonus: 1 } },
      4: { asi: true, choices: ['paladin_faith_shield', 'aura_of_protection'] },
      5: { choices: ['paladin_divine_wrath', 'turn_undead', 'paladin_bless'] },
      6: { choices: ['paladin_divine_shield', 'extra_attack_paladin', 'paladin_radiant_strike'] },
      7: { choices: ['paladin_aura', 'aura_of_protection', 'turn_undead'] },
      8: { asi: true, choices: ['paladin_faith_shield', 'paladin_divine_wrath'] },
      9: { choices: ['extra_attack_paladin', 'paladin_radiant_strike', 'turn_undead'] },
      10: { asi: true, choices: ['aura_of_protection', 'paladin_divine_wrath', 'paladin_aura'] }
    }
  },

  mergeLevelConfig(existing, patch) {
    const out = { ...(existing || {}), ...(patch || {}) };
    if (patch?.choices) out.choices = patch.choices.slice();
    if (patch?.stats) out.stats = { ...(existing?.stats || {}), ...patch.stats };
    if (patch?.asi) out.asi = true;
    return out;
  },

  applyToGameData(data) {
    if (!data.progression) data.progression = {};
    data.progression.enabled = true;
    data.progression.maxLevel = 10;
    data.progression.expTable = this.EXP_TABLE.slice();

    Object.entries(this.LEVEL1_BONUS).forEach(([classId, ids]) => {
      if (data.classes[classId]) {
        data.classes[classId].level1BonusChoices = ids.slice();
      }
    });

    Object.entries(this.CLASS_LEVELS).forEach(([classId, levels]) => {
      const cls = data.classes[classId];
      if (!cls) return;
      if (!cls.progression) cls.progression = { levels: {} };
      if (!cls.progression.levels) cls.progression.levels = {};
      Object.entries(levels).forEach(([lvl, cfg]) => {
        const key = String(lvl);
        cls.progression.levels[key] = this.mergeLevelConfig(cls.progression.levels[key], cfg);
      });
    });

    return data;
  }
};
