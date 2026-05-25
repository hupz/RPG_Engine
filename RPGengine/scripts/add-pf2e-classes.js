const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../data/game_data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const pf2eAbilities = {
  pf2e_sudden_charge: {
    id: 'pf2e_sudden_charge',
    name: 'Sudden Charge',
    cost: 2,
    icon: '🏃',
    desc: 'Stride twice, then Strike. (2 действия)',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'custom', message: 'Вы стремительно бросаетесь в атаку!' },
    usage: 'combat',
    type: 'active'
  },
  pf2e_power_attack: {
    id: 'pf2e_power_attack',
    name: 'Power Attack',
    cost: 2,
    icon: '🗡️',
    desc: 'Один Strike с дополнительным кубиком урона. (2 действия)',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'damage', value: '2d8', targeting: { scope: 'single' } },
    usage: 'combat',
    type: 'active'
  },
  pf2e_reactive_strike: {
    id: 'pf2e_reactive_strike',
    name: 'Reactive Strike',
    cost: 0,
    icon: '⚡',
    desc: 'Реакция: бесплатный Strike по врагу, спровоцировавшему реакцию.',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'custom', message: 'Вы мгновенно контратакуете!' },
    usage: 'combat',
    type: 'active'
  },
  pf2e_twin_parry: {
    id: 'pf2e_twin_parry',
    name: 'Twin Parry',
    cost: 1,
    icon: '🛡️',
    desc: '+1 КД до начала следующего хода (требуется два оружия). (1 действие)',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'buff', buffType: 'ac', value: 1, targeting: { scope: 'self' } },
    usage: 'combat',
    type: 'active'
  },
  pf2e_brutal_finish: {
    id: 'pf2e_brutal_finish',
    name: 'Brutal Finish',
    cost: 2,
    icon: '💀',
    desc: 'Strike с дополнительным кубиком урона. Если промах — получаете усталость. (2 действия)',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'damage', value: '2d10', targeting: { scope: 'single' } },
    usage: 'combat',
    type: 'active'
  },
  pf2e_intimidating_glare: {
    id: 'pf2e_intimidating_glare',
    name: 'Intimidating Glare',
    type: 'passive',
    icon: '👁️',
    desc: 'Demoralize не требует языка и работает на всех видимых врагов.',
    passive: {},
    usage: 'both'
  },
  pf2e_attack_of_opportunity: {
    id: 'pf2e_attack_of_opportunity',
    name: 'Attack of Opportunity',
    type: 'passive',
    icon: '⚔️',
    desc: 'Вы можете использовать Reactive Strike как реакцию.',
    passive: {},
    usage: 'both'
  },
  pf2e_healing_font: {
    id: 'pf2e_healing_font',
    name: 'Healing Font',
    spellLevel: 1,
    cost: 1,
    icon: '💚',
    desc: 'Дополнительная ячейка Heal 1-го круга. (Focus Point)',
    combatOnly: false,
    oncePerCombat: false,
    effect: { type: 'heal', value: '1d8', targeting: { scope: 'single' } },
    usage: 'both',
    type: 'active'
  },
  pf2e_channel_smite: {
    id: 'pf2e_channel_smite',
    name: 'Channel Smite',
    cost: 2,
    icon: '☀️',
    desc: 'Strike + 1d8 radiant/necrotic. (2 действия)',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'smite', value: '1d8' },
    usage: 'combat',
    type: 'active'
  },
  pf2e_turn_undead_pf2e: {
    id: 'pf2e_turn_undead_pf2e',
    name: 'Turn Undead',
    spellLevel: 1,
    cost: 2,
    icon: '✨',
    desc: 'Нежить в 30 футах: Will save или Fleeing 1. (2 действия)',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'damage', value: '2d8', damageType: 'radiant', targeting: { scope: 'all_enemies' } },
    usage: 'combat',
    type: 'active'
  },
  pf2e_bless_pf2e: {
    id: 'pf2e_bless_pf2e',
    name: 'Bless',
    spellLevel: 1,
    cost: 2,
    icon: '🙏',
    concentration: true,
    desc: 'Концентрация. Союзники в 30 футах: +1 status bonus к атакам. (2 действия)',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'buff', buffType: 'atk', value: 1, targeting: { scope: 'self' } },
    usage: 'combat',
    type: 'active'
  },
  pf2e_magic_weapon: {
    id: 'pf2e_magic_weapon',
    name: 'Magic Weapon',
    spellLevel: 1,
    cost: 2,
    icon: '🗡️',
    desc: 'Оружие становится +1 striking на 1 минуту. (2 действия)',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'buff', buffType: 'dmg', value: 1, targeting: { scope: 'self' } },
    usage: 'combat',
    type: 'active'
  },
  pf2e_restorative_touch: {
    id: 'pf2e_restorative_touch',
    name: 'Restorative Touch',
    spellLevel: 1,
    cost: 2,
    icon: '💛',
    desc: 'Убирает один condition: blinded, deafened, etc. (2 действия)',
    combatOnly: false,
    oncePerCombat: false,
    effect: { type: 'custom', message: 'Божественная энергия снимает недуг.' },
    usage: 'both',
    type: 'active'
  },
  pf2e_twin_feint: {
    id: 'pf2e_twin_feint',
    name: 'Twin Feint',
    cost: 2,
    icon: '🎭',
    desc: 'Два Strike; цель flat-footed для второго удара. (2 действия)',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'extra_attack' },
    usage: 'combat',
    type: 'active'
  },
  pf2e_nimble_dodge: {
    id: 'pf2e_nimble_dodge',
    name: 'Nimble Dodge',
    cost: 0,
    icon: '💨',
    desc: 'Реакция: +2 КД против одной атаки.',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'buff', buffType: 'ac', value: 2, targeting: { scope: 'self' } },
    usage: 'combat',
    type: 'active'
  },
  pf2e_mobility: {
    id: 'pf2e_mobility',
    name: 'Mobility',
    cost: 1,
    icon: '🏃',
    desc: 'Stride без провокации реакций. (1 действие)',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'custom', message: 'Вы проскальзываете мимо врагов.' },
    usage: 'combat',
    type: 'active'
  },
  pf2e_gang_up: {
    id: 'pf2e_gang_up',
    name: 'Gang Up',
    type: 'passive',
    icon: '👥',
    desc: 'Цель считается flat-footed, если рядом 2 союзника.',
    passive: {},
    usage: 'both'
  },
  pf2e_minor_magic: {
    id: 'pf2e_minor_magic',
    name: 'Minor Magic',
    cost: 0,
    icon: '✨',
    desc: "Вы знаете 2 cantrip'а (например, Light, Mage Hand).",
    combatOnly: false,
    oncePerCombat: false,
    effect: { type: 'custom', message: 'Магическая искра.' },
    usage: 'both',
    type: 'active'
  },
  pf2e_surprise_attack: {
    id: 'pf2e_surprise_attack',
    name: 'Surprise Attack',
    type: 'passive',
    icon: '🎯',
    desc: 'В первом раунде боя враги flat-footed против ваших атак.',
    passive: {},
    usage: 'combat'
  },
  pf2e_electric_arc: {
    id: 'pf2e_electric_arc',
    name: 'Electric Arc',
    spellLevel: 1,
    cost: 2,
    icon: '⚡',
    desc: 'Молния между 2 целями. 2d12 электричества (Reflex save). (2 действия)',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'damage', value: '2d12', damageType: 'lightning', targeting: { scope: 'all_enemies' } },
    usage: 'combat',
    type: 'active'
  },
  pf2e_shield_cantrip: {
    id: 'pf2e_shield_cantrip',
    name: 'Shield (Cantrip)',
    spellLevel: 0,
    cost: 1,
    icon: '🛡️',
    desc: '+1 КД до начала следующего хода. (1 действие)',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'buff', buffType: 'ac', value: 1, targeting: { scope: 'self' } },
    usage: 'combat',
    type: 'active'
  },
  pf2e_shield_cantrip_pf2e: {
    id: 'pf2e_shield_cantrip_pf2e',
    name: 'Shield (Cantrip)',
    spellLevel: 0,
    cost: 1,
    icon: '🛡️',
    desc: '+1 КД до начала следующего хода. (1 действие)',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'buff', buffType: 'ac', value: 1, targeting: { scope: 'self' } },
    usage: 'combat',
    type: 'active'
  },
  pf2e_detect_magic_pf2e: {
    id: 'pf2e_detect_magic_pf2e',
    name: 'Detect Magic',
    spellLevel: 0,
    cost: 2,
    icon: '👁️',
    desc: 'Обнаружение магических аур в 30 футах. (2 действия)',
    combatOnly: false,
    oncePerCombat: false,
    effect: { type: 'detect_magic' },
    usage: 'exploration',
    type: 'active'
  },
  pf2e_mage_hand: {
    id: 'pf2e_mage_hand',
    name: 'Mage Hand',
    spellLevel: 0,
    cost: 2,
    icon: '🤚',
    desc: 'Призрачная рука перемещает предметы до 5 фунтов. (2 действия)',
    combatOnly: false,
    oncePerCombat: false,
    effect: { type: 'custom', message: 'Призрачная рука выполняет вашу волю.' },
    usage: 'both',
    type: 'active'
  },
  pf2e_light: {
    id: 'pf2e_light',
    name: 'Light',
    spellLevel: 0,
    cost: 2,
    icon: '💡',
    desc: 'Яркий свет в радиусе 20 футов. Длительность до следующего отдыха.',
    combatOnly: false,
    oncePerCombat: false,
    effect: { type: 'custom', message: 'Предмет озаряется ярким светом.' },
    usage: 'both',
    type: 'active'
  },
  pf2e_spell_substitution: {
    id: 'pf2e_spell_substitution',
    name: 'Spell Substitution',
    type: 'passive',
    icon: '🔄',
    desc: 'Можете заменить подготовленное заклинание за 10 минут.',
    passive: {},
    usage: 'both'
  }
};

for (const [id, ab] of Object.entries(pf2eAbilities)) {
  if (data.progression.abilities[id]) {
    console.warn('Skip ability (exists):', id);
  } else {
    data.progression.abilities[id] = ab;
  }
}

const pf2eClasses = {
  pf2e_fighter: {
    system: 'pf2e',
    name: 'Воин (PF2e)',
    icon: '⚔️',
    hp: 20,
    ac: 18,
    atkBonus: 7,
    dmgRoll: '1d8',
    dmgBonus: 4,
    initBonus: 3,
    stats: { str: 18, dex: 14, con: 14, int: 10, wis: 12, cha: 10 },
    skills: 'Athletics, Intimidation, Acrobatics',
    resource: { name: 'Actions', max: 3, desc: '3 действия за ход. Тратятся на атаки, движения, способности.' },
    mainWeapon: 'longsword',
    startingItems: ['longsword', 'chainmail_pf2e', 'shield_pf2e'],
    armorProficiency: 'trained',
    ancestry: 'human',
    level1BonusChoices: [
      'pf2e_sudden_charge',
      'pf2e_power_attack',
      'pf2e_reactive_strike',
      'pf2e_twin_parry',
      'pf2e_brutal_finish'
    ],
    abilities: [
      {
        id: 'pf2e_strike',
        name: 'Strike',
        cost: 1,
        icon: '⚔️',
        desc: 'Совершите одну атаку оружием. (1 действие)',
        combatOnly: true,
        oncePerCombat: false,
        effect: { type: 'custom', message: 'Вы наносите удар!' },
        usage: 'combat',
        type: 'active'
      },
      {
        id: 'pf2e_raise_shield',
        name: 'Raise a Shield',
        cost: 1,
        icon: '🛡️',
        desc: '+2 КД до начала вашего следующего хода. (1 действие)',
        combatOnly: true,
        oncePerCombat: false,
        effect: { type: 'buff', buffType: 'ac', value: 2, targeting: { scope: 'self' } },
        usage: 'combat',
        type: 'active'
      },
      {
        id: 'pf2e_demoralize',
        name: 'Demoralize',
        cost: 1,
        icon: '😠',
        desc: 'Запугайте врага (Intimidation vs Will DC). При успехе — Frightened 1. (1 действие)',
        combatOnly: true,
        oncePerCombat: false,
        effect: {
          type: 'apply_status',
          targeting: { scope: 'single' },
          addEffect: { id: 'frightened', duration: 1 }
        },
        usage: 'combat',
        type: 'active'
      }
    ],
    progression: {
      hpGain: '1d10',
      levels: {
        '2': { choices: ['pf2e_sudden_charge', 'pf2e_power_attack'] },
        '3': {
          choices: ['pf2e_reactive_strike', 'pf2e_twin_parry', 'pf2e_brutal_finish'],
          stats: { atkBonus: 1 }
        },
        '4': { asi: true, choices: ['pf2e_intimidating_glare', 'pf2e_attack_of_opportunity'] },
        '5': {
          choices: ['pf2e_sudden_charge', 'pf2e_power_attack', 'pf2e_reactive_strike'],
          stats: { atkBonus: 1 }
        }
      }
    }
  },
  pf2e_cleric: {
    system: 'pf2e',
    spellcasting: true,
    hasFocusPoints: true,
    focusPoints: 1,
    baseSlots: [2],
    name: 'Жрец (PF2e)',
    icon: '✝️',
    hp: 16,
    ac: 16,
    atkBonus: 5,
    dmgRoll: '1d6',
    dmgBonus: 2,
    initBonus: 1,
    stats: { str: 14, dex: 12, con: 14, int: 10, wis: 18, cha: 12 },
    skills: 'Religion, Medicine, Diplomacy',
    resource: {
      name: 'Focus Points',
      max: 1,
      desc: 'Тратятся на фокус-заклинания. Восстанавливаются при Refocus (10 мин).'
    },
    mainWeapon: 'mace',
    startingItems: ['mace', 'chainmail_pf2e', 'shield_pf2e', 'holy_symbol_pf2e'],
    armorProficiency: 'trained',
    ancestry: 'human',
    level1BonusChoices: [
      'pf2e_healing_font',
      'pf2e_channel_smite',
      'pf2e_turn_undead_pf2e',
      'pf2e_bless_pf2e',
      'pf2e_magic_weapon'
    ],
    abilities: [
      {
        id: 'pf2e_heal_1action',
        name: 'Heal (1 action)',
        spellLevel: 1,
        cost: 1,
        icon: '💚',
        desc: 'Касание. Восстанавливает 1d8 ОЗ. (1 действие)',
        combatOnly: false,
        oncePerCombat: false,
        effect: { type: 'heal', value: '1d8', targeting: { scope: 'single' } },
        usage: 'both',
        type: 'active'
      },
      {
        id: 'pf2e_heal_2action',
        name: 'Heal (2 actions)',
        spellLevel: 1,
        cost: 2,
        icon: '💚',
        desc: '30 футов. Восстанавливает 1d8+8 ОЗ. (2 действия)',
        combatOnly: false,
        oncePerCombat: false,
        effect: { type: 'heal', value: '1d8+8', targeting: { scope: 'single' } },
        usage: 'both',
        type: 'active'
      },
      {
        id: 'pf2e_divine_lance',
        name: 'Divine Lance',
        spellLevel: 0,
        cost: 2,
        icon: '✨',
        desc: 'Луч святости/нечестия. 2d4 урона излучением/тьмой. (2 действия)',
        combatOnly: true,
        oncePerCombat: false,
        effect: { type: 'damage', value: '2d4', damageType: 'radiant', targeting: { scope: 'single' } },
        usage: 'combat',
        type: 'active'
      }
    ],
    progression: {
      hpGain: '1d8',
      levels: {
        '2': { slots: [3], choices: ['pf2e_healing_font', 'pf2e_channel_smite', 'pf2e_bless_pf2e'] },
        '3': {
          slots: [4, 2],
          choices: ['pf2e_turn_undead_pf2e', 'pf2e_magic_weapon', 'pf2e_restorative_touch'],
          stats: { atkBonus: 1 }
        },
        '4': { slots: [4, 3], asi: true, choices: ['pf2e_healing_font', 'pf2e_channel_smite'] },
        '5': { slots: [4, 3, 2], choices: ['pf2e_bless_pf2e', 'pf2e_turn_undead_pf2e', 'pf2e_magic_weapon'] }
      }
    }
  },
  pf2e_rogue: {
    system: 'pf2e',
    name: 'Плут (PF2e)',
    icon: '🗡️',
    hp: 16,
    ac: 17,
    atkBonus: 7,
    dmgRoll: '1d6',
    dmgBonus: 4,
    initBonus: 4,
    stats: { str: 12, dex: 18, con: 12, int: 14, wis: 12, cha: 12 },
    skills: 'Stealth, Thievery, Acrobatics, Deception',
    resource: {
      name: 'Actions',
      max: 3,
      desc: '3 действия за ход. Sneak Attack срабатывает автоматически на flat-footed целях.'
    },
    mainWeapon: 'shortsword',
    startingItems: ['shortsword', 'leather_armor_pf2e', 'thieves_tools_pf2e'],
    armorProficiency: 'trained',
    ancestry: 'human',
    level1BonusChoices: [
      'pf2e_twin_feint',
      'pf2e_nimble_dodge',
      'pf2e_mobility',
      'pf2e_gang_up',
      'pf2e_minor_magic'
    ],
    abilities: [
      {
        id: 'pf2e_sneak_attack_passive',
        name: 'Sneak Attack',
        type: 'passive',
        icon: '🎯',
        desc: '+1d6 precision damage против flat-footed целей (автоматически).',
        passive: {},
        usage: 'both'
      },
      {
        id: 'pf2e_take_cover',
        name: 'Take Cover',
        cost: 1,
        icon: '🏰',
        desc: '+2 КД от дальних атак до конца хода. Требует укрытие. (1 действие)',
        combatOnly: true,
        oncePerCombat: false,
        effect: { type: 'buff', buffType: 'ac', value: 2, targeting: { scope: 'self' } },
        usage: 'combat',
        type: 'active'
      },
      {
        id: 'pf2e_step',
        name: 'Step',
        cost: 1,
        icon: '👣',
        desc: 'Перемещение на 5 футов без провокации реакций. (1 действие)',
        combatOnly: true,
        oncePerCombat: false,
        effect: { type: 'custom', message: 'Вы делаете осторожный шаг.' },
        usage: 'combat',
        type: 'active'
      }
    ],
    progression: {
      hpGain: '1d8',
      levels: {
        '2': { choices: ['pf2e_twin_feint', 'pf2e_nimble_dodge'] },
        '3': {
          choices: ['pf2e_mobility', 'pf2e_gang_up', 'pf2e_surprise_attack'],
          stats: { atkBonus: 1 }
        },
        '4': { asi: true, choices: ['pf2e_minor_magic', 'pf2e_twin_feint'] },
        '5': {
          choices: ['pf2e_nimble_dodge', 'pf2e_mobility', 'pf2e_gang_up'],
          stats: { atkBonus: 1 }
        }
      }
    }
  },
  pf2e_wizard: {
    system: 'pf2e',
    spellcasting: true,
    baseSlots: [2],
    name: 'Волшебник (PF2e)',
    icon: '🔮',
    hp: 12,
    ac: 12,
    atkBonus: 4,
    dmgRoll: '1d4',
    dmgBonus: 0,
    initBonus: 3,
    stats: { str: 10, dex: 14, con: 12, int: 18, wis: 14, cha: 10 },
    skills: 'Arcana, Occultism, Society',
    resource: { name: 'Spell Slots', max: 2, desc: 'Prepared spell slots. Восстанавливаются при отдыхе.' },
    mainWeapon: 'staff',
    startingItems: ['staff', 'mage_robe_pf2e', 'spellbook_pf2e'],
    armorProficiency: 'untrained',
    ancestry: 'human',
    level1BonusChoices: [
      'pf2e_electric_arc',
      'pf2e_shield_cantrip',
      'pf2e_detect_magic_pf2e',
      'pf2e_mage_hand',
      'pf2e_light'
    ],
    abilities: [
      {
        id: 'pf2e_ignite',
        name: 'Ignition',
        spellLevel: 0,
        cost: 2,
        icon: '🔥',
        desc: 'Огненный луч. 2d4 огня + persistent fire 1d4. (2 действия)',
        combatOnly: true,
        oncePerCombat: false,
        effect: { type: 'damage', value: '2d4', damageType: 'fire', targeting: { scope: 'single' } },
        usage: 'combat',
        type: 'active'
      },
      {
        id: 'pf2e_telekinetic_projectile',
        name: 'Telekinetic Projectile',
        spellLevel: 0,
        cost: 2,
        icon: '🪨',
        desc: 'Метните предмет. 1d6+mod INT урона. (2 действия)',
        combatOnly: true,
        oncePerCombat: false,
        effect: { type: 'damage', value: '1d6+4', damageType: 'physical', targeting: { scope: 'single' } },
        usage: 'combat',
        type: 'active'
      },
      {
        id: 'pf2e_shield_cantrip',
        name: 'Shield (Cantrip)',
        spellLevel: 0,
        cost: 1,
        icon: '🛡️',
        desc: '+1 КД до начала следующего хода. (1 действие)',
        combatOnly: true,
        oncePerCombat: false,
        effect: { type: 'buff', buffType: 'ac', value: 1, targeting: { scope: 'self' } },
        usage: 'combat',
        type: 'active'
      }
    ],
    progression: {
      hpGain: '1d6',
      levels: {
        '2': { slots: [3], choices: ['pf2e_electric_arc', 'pf2e_shield_cantrip_pf2e'] },
        '3': {
          slots: [4, 2],
          choices: ['pf2e_detect_magic_pf2e', 'pf2e_mage_hand', 'pf2e_light'],
          stats: { atkBonus: 1 }
        },
        '4': { slots: [4, 3], asi: true, choices: ['pf2e_spell_substitution', 'pf2e_electric_arc'] },
        '5': {
          slots: [4, 3, 2],
          choices: ['pf2e_electric_arc', 'pf2e_shield_cantrip_pf2e', 'pf2e_detect_magic_pf2e']
        }
      }
    }
  }
};

for (const [id, cls] of Object.entries(pf2eClasses)) {
  if (data.classes[id]) {
    console.warn('Skip class (exists):', id);
  } else {
    data.classes[id] = cls;
  }
}

const pf2eItems = {
  longsword_pf2e: {
    id: 'longsword_pf2e',
    name: 'Longsword (PF2e)',
    type: 'weapon',
    desc: 'Versatile P/S. 1d8 slashing. Bulk 1.',
    slot: 'weapon',
    damage: '1d8',
    stat: 'str',
    soundHit: 'slash_sword'
  },
  shortsword_pf2e: {
    id: 'shortsword_pf2e',
    name: 'Shortsword (PF2e)',
    type: 'weapon',
    desc: 'Agile, finesse, versatile S/P. 1d6 piercing. Bulk L.',
    slot: 'weapon',
    damage: '1d6',
    stat: 'dex',
    soundHit: 'slash_sword'
  },
  mace_pf2e: {
    id: 'mace_pf2e',
    name: 'Mace (PF2e)',
    type: 'weapon',
    desc: 'Shove. 1d6 bludgeoning. Bulk 1.',
    slot: 'weapon',
    damage: '1d6',
    stat: 'str',
    soundHit: 'slash_physical'
  },
  staff_pf2e: {
    id: 'staff_pf2e',
    name: 'Staff (PF2e)',
    type: 'weapon',
    desc: 'Two-hand d8. 1d4 bludgeoning. Bulk 1.',
    slot: 'weapon',
    damage: '1d4',
    stat: 'str',
    soundHit: 'slash_staff'
  },
  chainmail_pf2e: {
    id: 'chainmail_pf2e',
    name: 'Chain Mail (PF2e)',
    type: 'armor',
    desc: 'AC +4, Dex cap +1, check penalty -2. Heavy armor.',
    slot: 'armor',
    ac: 4,
    dexCap: 1,
    armorType: 'heavy'
  },
  leather_armor_pf2e: {
    id: 'leather_armor_pf2e',
    name: 'Leather Armor (PF2e)',
    type: 'armor',
    desc: 'AC +1, Dex cap +4, check penalty -1. Light armor.',
    slot: 'armor',
    ac: 1,
    dexCap: 4,
    armorType: 'light'
  },
  mage_robe_pf2e: {
    id: 'mage_robe_pf2e',
    name: "Explorer's Clothing (PF2e)",
    type: 'armor',
    desc: 'Unarmored defense. AC +0, Dex cap +5.',
    slot: 'armor',
    ac: 0,
    dexCap: 5,
    armorType: 'unarmored'
  },
  shield_pf2e: {
    id: 'shield_pf2e',
    name: 'Wooden Shield (PF2e)',
    type: 'shield',
    desc: 'Hardness 3, HP 12. +2 AC when Raised.',
    slot: 'shield',
    acBonus: 2
  },
  holy_symbol_pf2e: {
    id: 'holy_symbol_pf2e',
    name: 'Holy Symbol (PF2e)',
    type: 'equipment',
    desc: 'Divine focus for Cleric spells.',
    equippable: true,
    slot: 'accessory'
  },
  spellbook_pf2e: {
    id: 'spellbook_pf2e',
    name: 'Spellbook (PF2e)',
    type: 'equipment',
    desc: 'Contains prepared arcane spells.',
    equippable: true,
    slot: 'accessory'
  },
  thieves_tools_pf2e: {
    id: 'thieves_tools_pf2e',
    name: "Thieves' Tools (PF2e)",
    type: 'equipment',
    desc: 'Required for Pick Lock and Disable Device.',
    equippable: true,
    slot: 'accessory'
  }
};

for (const [id, item] of Object.entries(pf2eItems)) {
  if (!data.items[id]) data.items[id] = item;
}

function validatePf2eClasses() {
  const pool = data.progression.abilities;
  for (const [cid, cls] of Object.entries(pf2eClasses)) {
    const c = data.classes[cid];
    if (!c) continue;
    if (c.system !== 'pf2e') throw new Error(`Class ${cid} missing system: pf2e`);
    (c.level1BonusChoices || []).forEach((aid) => {
      if (!pool[aid]) throw new Error(`Missing ability: ${aid} (${cid} level1)`);
    });
    Object.values(c.progression?.levels || {}).forEach((lv) => {
      (lv.choices || []).forEach((aid) => {
        if (!pool[aid]) throw new Error(`Missing ability: ${aid} (${cid} level)`);
      });
    });
    (c.startingItems || []).forEach((iid) => {
      if (!data.items[iid]) throw new Error(`Missing item: ${iid} (${cid})`);
    });
  }
}

validatePf2eClasses();

const dndCore = ['warrior', 'wizard', 'paladin'];
for (const id of dndCore) {
  if (!data.classes[id]) throw new Error(`D&D class missing after merge: ${id}`);
}

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('OK: pf2e_fighter, pf2e_cleric, pf2e_rogue, pf2e_wizard added');
