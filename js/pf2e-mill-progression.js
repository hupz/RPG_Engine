/**
 * Прогрессия PF2e для демо «Мельница на Тихой реке» (уровни 1–10).
 */
const Pf2eMillProgression = {
  EXP_TABLE: [0, 80, 180, 320, 500, 750, 1100, 1550, 2100, 2800],

  WIZARD_SLOTS: {
    1: [2], 2: [2], 3: [3], 4: [3], 5: [3], 6: [3], 7: [4], 8: [4], 9: [4], 10: [4]
  },

  CLERIC_SLOTS: {
    1: [2], 2: [2], 3: [3], 4: [3], 5: [3], 6: [3], 7: [4], 8: [4], 9: [4], 10: [4]
  },

  DRUID_SLOTS: {
    1: [2], 2: [2], 3: [3], 4: [3], 5: [3], 6: [3], 7: [4], 8: [4], 9: [4], 10: [4]
  },

  CLASS_LEVELS: {
    fighter: {
      2: { choices: ['pf2e_sudden_charge', 'pf2e_power_attack'] },
      3: { choices: ['pf2e_reactive_strike', 'pf2e_intimidating_glare'], stats: { atkBonus: 1 } },
      4: { asi: true, choices: ['pf2e_twin_parry', 'pf2e_brutal_finish'] },
      5: { choices: ['pf2e_attack_of_opportunity', 'pf2e_power_attack'] },
      6: { choices: ['pf2e_sudden_charge', 'pf2e_reactive_strike'] },
      7: { choices: ['pf2e_intimidating_glare', 'pf2e_brutal_finish'] },
      8: { asi: true, choices: ['pf2e_twin_parry', 'pf2e_power_attack'] },
      9: { choices: ['pf2e_attack_of_opportunity', 'pf2e_sudden_charge'] },
      10: { asi: true, choices: ['pf2e_brutal_finish', 'pf2e_reactive_strike'] }
    },
    rogue: {
      2: { choices: ['pf2e_twin_feint', 'pf2e_nimble_dodge'] },
      3: { choices: ['pf2e_mobility', 'pf2e_gang_up'], stats: { atkBonus: 1 } },
      4: { asi: true, choices: ['pf2e_surprise_attack', 'pf2e_minor_magic'] },
      5: { choices: ['pf2e_twin_feint', 'pf2e_nimble_dodge'] },
      6: { choices: ['pf2e_mobility', 'pf2e_gang_up'] },
      7: { choices: ['pf2e_surprise_attack', 'pf2e_minor_magic'] },
      8: { asi: true, choices: ['pf2e_twin_feint', 'pf2e_nimble_dodge'] },
      9: { choices: ['pf2e_mobility', 'pf2e_gang_up'] },
      10: { asi: true, choices: ['pf2e_surprise_attack', 'pf2e_minor_magic'] }
    },
    cleric: {
      2: { choices: ['pf2e_healing_font', 'pf2e_channel_smite'] },
      3: { choices: ['pf2e_bless_pf2e', 'pf2e_turn_undead_pf2e'], stats: { atkBonus: 1 } },
      4: { asi: true, choices: ['pf2e_magic_weapon', 'pf2e_restorative_touch'] },
      5: { choices: ['pf2e_healing_font', 'pf2e_channel_smite'] },
      6: { choices: ['pf2e_bless_pf2e', 'pf2e_turn_undead_pf2e'] },
      7: { choices: ['pf2e_magic_weapon', 'pf2e_restorative_touch'] },
      8: { asi: true, choices: ['pf2e_healing_font', 'pf2e_bless_pf2e'] },
      9: { choices: ['pf2e_channel_smite', 'pf2e_turn_undead_pf2e'] },
      10: { asi: true, choices: ['pf2e_magic_weapon', 'pf2e_restorative_touch'] }
    },
    wizard: {
      2: { choices: ['pf2e_electric_arc', 'pf2e_shield_cantrip_pf2e'] },
      3: { choices: ['pf2e_detect_magic_pf2e', 'pf2e_mage_hand'], stats: { atkBonus: 1 } },
      4: { asi: true, choices: ['pf2e_light', 'pf2e_spell_substitution'] },
      5: { choices: ['pf2e_electric_arc', 'pf2e_shield_cantrip_pf2e'] },
      6: { choices: ['pf2e_detect_magic_pf2e', 'pf2e_mage_hand'] },
      7: { choices: ['pf2e_light', 'pf2e_spell_substitution'] },
      8: { asi: true, choices: ['pf2e_electric_arc', 'pf2e_detect_magic_pf2e'] },
      9: { choices: ['pf2e_shield_cantrip_pf2e', 'pf2e_mage_hand'] },
      10: { asi: true, choices: ['pf2e_spell_substitution', 'pf2e_light'] }
    },
    ranger: {
      2: { choices: ['pf2e_hunt_prey', 'pf2e_hunters_edge'] },
      3: { choices: ['pf2e_animal_companion', 'pf2e_hunt_prey'], stats: { atkBonus: 1 } },
      4: { asi: true, choices: ['pf2e_hunters_edge', 'pf2e_animal_companion'] },
      5: { choices: ['pf2e_hunt_prey', 'pf2e_hunters_edge'] },
      6: { choices: ['pf2e_animal_companion', 'pf2e_hunt_prey'] },
      7: { choices: ['pf2e_hunters_edge', 'pf2e_animal_companion'] },
      8: { asi: true, choices: ['pf2e_hunt_prey', 'pf2e_hunters_edge'] },
      9: { choices: ['pf2e_animal_companion', 'pf2e_hunt_prey'] },
      10: { asi: true, choices: ['pf2e_hunters_edge', 'pf2e_animal_companion'] }
    },
    druid: {
      2: { choices: ['pf2e_wild_shape', 'pf2e_storm_order'] },
      3: { choices: ['pf2e_goodberry', 'pf2e_heal_animal'], stats: { atkBonus: 1 } },
      4: { asi: true, choices: ['pf2e_wild_shape', 'pf2e_goodberry'] },
      5: { choices: ['pf2e_storm_order', 'pf2e_heal_animal'] },
      6: { choices: ['pf2e_wild_shape', 'pf2e_goodberry'] },
      7: { choices: ['pf2e_storm_order', 'pf2e_heal_animal'] },
      8: { asi: true, choices: ['pf2e_wild_shape', 'pf2e_goodberry'] },
      9: { choices: ['pf2e_storm_order', 'pf2e_heal_animal'] },
      10: { asi: true, choices: ['pf2e_wild_shape', 'pf2e_storm_order'] }
    }
  },

  isMillDemo(data) {
    return data?.meta?.campaignId === 'pf2e_mill';
  },

  applySpellSlots(cls, table) {
    if (!cls?.progression) cls.progression = { levels: {} };
    if (!cls.progression.levels) cls.progression.levels = {};
    Object.entries(table).forEach(([lvl, slots]) => {
      const key = String(lvl);
      if (!cls.progression.levels[key]) cls.progression.levels[key] = {};
      cls.progression.levels[key].slots = slots.slice();
    });
    cls.spellcasting = true;
  },

  mergeLevelConfig(existing, patch) {
    const out = { ...(existing || {}), ...(patch || {}) };
    if (patch?.choices) out.choices = patch.choices.slice();
    if (patch?.stats) out.stats = { ...(existing?.stats || {}), ...patch.stats };
    if (patch?.asi) out.asi = true;
    return out;
  },

  applyToGameData(data) {
    if (!this.isMillDemo(data)) return data;

    if (!data.progression) data.progression = {};
    data.progression.enabled = true;
    data.progression.maxLevel = 10;
    data.progression.expTable = this.EXP_TABLE.slice();

    const wiz = data.classes?.wizard;
    if (wiz) this.applySpellSlots(wiz, this.WIZARD_SLOTS);
    const cleric = data.classes?.cleric;
    if (cleric) this.applySpellSlots(cleric, this.CLERIC_SLOTS);
    const druid = data.classes?.druid;
    if (druid) this.applySpellSlots(druid, this.DRUID_SLOTS);

    Object.entries(this.CLASS_LEVELS).forEach(([classId, levels]) => {
      const cls = data.classes?.[classId];
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

if (typeof window !== 'undefined') window.Pf2eMillProgression = Pf2eMillProgression;
