/**
 * Добавляет 6 классов PHB (варвар, бард, друид, монах, чернокнижник, чародей)
 * в data/game_data.json — умения, прогрессия 1–10, предметы.
 */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../data/game_data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const FULL_CASTER_SLOTS = {
  '1': [2],
  '2': [3],
  '3': [4, 2],
  '4': [4, 3],
  '5': [4, 3, 2],
  '6': [4, 3, 3],
  '7': [4, 3, 3, 1],
  '8': [4, 3, 3, 2],
  '9': [4, 3, 3, 3, 1],
  '10': [4, 3, 3, 3, 2]
};

function fullCasterLevels(extra = {}) {
  const levels = {};
  for (const [lv, slots] of Object.entries(FULL_CASTER_SLOTS)) {
    levels[lv] = { slots, ...(extra[lv] || {}) };
  }
  return levels;
}

const newAbilities = {
  rage: {
    id: 'rage',
    name: 'Ярость',
    cost: 1,
    icon: '😤',
    actionType: 'bonus_action',
    desc: 'Бонусное действие: преимущество на проверки Силы, +2 к урону оружием. Длится до конца боя.',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'rage' },
    usage: 'combat',
    type: 'active',
    spellLevel: 0
  },
  reckless_attack: {
    id: 'reckless_attack',
    name: 'Яростная атака',
    cost: 0,
    icon: '⚔️',
    actionType: 'action',
    desc: 'При атаке в этом ходу — преимущество на броски атаки ближнего боя; враги получают преимущество по вам.',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'buff', buffType: 'atk', value: '99', targeting: { scope: 'self' } },
    usage: 'combat',
    type: 'active',
    spellLevel: 0
  },
  barbarian_danger_sense: {
    id: 'barbarian_danger_sense',
    name: 'Чувство опасности',
    type: 'passive',
    icon: '👁️',
    desc: 'Преимущество на спасброски Ловкости от эффектов, которые вы видите.',
    passive: {},
    usage: 'both'
  },
  barbarian_frenzy: {
    id: 'barbarian_frenzy',
    name: 'Бешенство',
    cost: 1,
    icon: '🩸',
    actionType: 'bonus_action',
    desc: 'В ярости: дополнительная атака ближним оружием бонусным действием.',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'extra_attack' },
    usage: 'combat',
    type: 'active',
    spellLevel: 0
  },
  barbarian_extra_attack: {
    id: 'barbarian_extra_attack',
    name: 'Дополнительная атака',
    type: 'passive',
    icon: '⚔️',
    desc: 'При действии «Атака» можете совершить две атаки вместо одной.',
    passive: { extraAttack: true },
    usage: 'both'
  },
  barbarian_feral_instinct: {
    id: 'barbarian_feral_instinct',
    name: 'Неудержимая ярость',
    type: 'passive',
    icon: '🐺',
    desc: '+4 к инициативе; в ярости действуете в начале боя.',
    passive: { initBonus: 4 },
    usage: 'both'
  },
  barbarian_brutal_critical: {
    id: 'barbarian_brutal_critical',
    name: 'Жестокий критический удар',
    type: 'passive',
    icon: '💥',
    desc: 'При критическом попадании добавляете 1к6 урона.',
    passive: {},
    usage: 'both'
  },
  barbarian_rage_heal: {
    id: 'barbarian_rage_heal',
    name: 'Жизненная сила ярости',
    type: 'passive',
    icon: '❤️',
    desc: 'В начале хода в ярости восстанавливаете мод. Тел. ОЗ (упрощённо: +мод. Тел при активации ярости).',
    passive: { maxHpBonus: 4 },
    usage: 'both'
  },
  bardic_inspiration: {
    id: 'bardic_inspiration',
    name: 'Вдохновение Барда',
    cost: 1,
    icon: '🎵',
    actionType: 'bonus_action',
    desc: 'Цель добавляет 1к6 к следующему броску атаки, проверке или спасброску.',
    combatOnly: false,
    oncePerCombat: false,
    effect: { type: 'buff', buffType: 'atk', value: '1', targeting: { scope: 'self' } },
    usage: 'both',
    type: 'active',
    spellLevel: 0
  },
  bard_song_of_rest: {
    id: 'bard_song_of_rest',
    name: 'Песнь отдыха',
    type: 'passive',
    icon: '🎶',
    desc: 'При коротком отдыхе союзники восстанавливают дополнительно 1к6 ОЗ.',
    passive: {},
    usage: 'both'
  },
  bard_jack_of_all_trades: {
    id: 'bard_jack_of_all_trades',
    name: 'Мастер на все руки',
    type: 'passive',
    icon: '🎭',
    desc: 'Половина бонуса мастерства к проверкам без мастерства.',
    passive: {},
    usage: 'both'
  },
  bard_cutting_words: {
    id: 'bard_cutting_words',
    name: 'Колкие слова',
    cost: 1,
    icon: '💬',
    actionType: 'reaction',
    desc: 'Реакция: −1к6 к броску атаки или урона врага.',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'custom', message: 'Ваши насмешки сбивают врага с толку!' },
    usage: 'combat',
    type: 'active',
    spellLevel: 0
  },
  bard_countercharm: {
    id: 'bard_countercharm',
    name: 'Контрзаклинание',
    cost: 1,
    icon: '🛡️',
    actionType: 'reaction',
    desc: 'Реакция: сопротивление урону от заклинаний до начала следующего хода.',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'buff', buffType: 'ac', value: '2', targeting: { scope: 'self' } },
    usage: 'combat',
    type: 'active',
    spellLevel: 0
  },
  wild_shape: {
    id: 'wild_shape',
    name: 'Дикий облик',
    cost: 1,
    icon: '🐻',
    actionType: 'action',
    desc: 'Превращаетесь в зверя (упрощённо: +2 КД и +6 временных ОЗ на бой).',
    combatOnly: true,
    oncePerCombat: true,
    effect: { type: 'buff', buffType: 'ac', value: '2', targeting: { scope: 'self' } },
    usage: 'combat',
    type: 'active',
    spellLevel: 0
  },
  druid_moon_combat: {
    id: 'druid_moon_combat',
    name: 'Круг Луны: боевой облик',
    cost: 1,
    icon: '🌕',
    actionType: 'bonus_action',
    desc: 'Дикий облик бонусным действием.',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'wild_shape' },
    usage: 'combat',
    type: 'active',
    spellLevel: 0
  },
  monk_flurry_of_blows: {
    id: 'monk_flurry_of_blows',
    name: 'Шквал ударов',
    cost: 1,
    icon: '👊',
    actionType: 'bonus_action',
    desc: 'После действия «Атака» — дополнительная атака без оружия (1к4+Лов).',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'damage', value: '1d4', damageType: 'bludgeoning', targeting: { scope: 'single' } },
    usage: 'combat',
    type: 'active',
    spellLevel: 0
  },
  monk_patient_defense: {
    id: 'monk_patient_defense',
    name: 'Терпеливая защита',
    cost: 1,
    icon: '🧘',
    actionType: 'bonus_action',
    desc: 'Бонусное действие: Уклонение (+2 КД до следующего хода).',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'buff', buffType: 'ac', value: '2', targeting: { scope: 'self' } },
    usage: 'combat',
    type: 'active',
    spellLevel: 0
  },
  monk_step_of_the_wind: {
    id: 'monk_step_of_the_wind',
    name: 'Шаг ветра',
    cost: 1,
    icon: '💨',
    actionType: 'bonus_action',
    desc: 'Бонусное действие: Рывок или Отход.',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'custom', message: 'Вы стремительно смещаетесь по полю боя.' },
    usage: 'combat',
    type: 'active',
    spellLevel: 0
  },
  monk_stunning_strike: {
    id: 'monk_stunning_strike',
    name: 'Оглушающий удар',
    cost: 1,
    icon: '💫',
    actionType: 'bonus_action',
    desc: 'При попадании безоружной атакой — цель спасбросок Тел или оглушена.',
    combatOnly: true,
    oncePerCombat: false,
    effect: {
      type: 'apply_status',
      targeting: { scope: 'single' },
      addEffect: { id: 'stunned', duration: 1 }
    },
    usage: 'combat',
    type: 'active',
    spellLevel: 0
  },
  monk_extra_attack: {
    id: 'monk_extra_attack',
    name: 'Дополнительная атака',
    type: 'passive',
    icon: '👊',
    desc: 'Две атаки при действии «Атака».',
    passive: { extraAttack: true },
    usage: 'both'
  },
  eldritch_blast: {
    id: 'eldritch_blast',
    name: 'Мистический заряд',
    spellLevel: 0,
    cost: 0,
    icon: '⚡',
    actionType: 'action',
    desc: 'Луч силового поля: 1к10 урона. С 5 уровня — два луча (2к10).',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'damage', value: '1d10', damageType: 'force', targeting: { scope: 'single' } },
    usage: 'combat',
    type: 'active'
  },
  warlock_hex: {
    id: 'warlock_hex',
    name: 'Порча',
    spellLevel: 1,
    cost: 1,
    icon: '🔮',
    actionType: 'bonus_action',
    concentration: true,
    desc: 'Проклятая цель получает +1к6 некротического урона при ваших попаданиях.',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'damage', value: '1d6', damageType: 'necrotic', targeting: { scope: 'single' } },
    usage: 'combat',
    type: 'active'
  },
  warlock_dark_ones_blessing: {
    id: 'warlock_dark_ones_blessing',
    name: 'Благословение Тёмного',
    type: 'passive',
    icon: '😈',
    desc: 'При убийстве врага восстанавливаете мод. Хар + уровень ОЗ.',
    passive: { maxHpBonus: 2 },
    usage: 'both'
  },
  warlock_agony: {
    id: 'warlock_agony',
    name: 'Мучительный луч',
    cost: 1,
    icon: '💀',
    actionType: 'action',
    desc: 'Мистический заряд с дополнительным 1к6 урона.',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'damage', value: '1d10+1d6', damageType: 'force', targeting: { scope: 'single' } },
    usage: 'combat',
    type: 'active',
    spellLevel: 0
  },
  sorcerer_metamagic_quickened: {
    id: 'sorcerer_metamagic_quickened',
    name: 'Ускоренное заклинание',
    cost: 2,
    icon: '⏩',
    actionType: 'bonus_action',
    desc: 'Следующее заклинание с временем «Акция» можно сотворить бонусным действием (2 очка чародейства).',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'extra_attack' },
    usage: 'combat',
    type: 'active',
    spellLevel: 0
  },
  sorcerer_draconic_resilience: {
    id: 'sorcerer_draconic_resilience',
    name: 'Драконья стойкость',
    type: 'passive',
    icon: '🐉',
    desc: '+1 ОЗ за уровень; КД 13 + Ловкость без доспехов.',
    passive: { maxHpBonus: 3, acBonus: 1 },
    usage: 'both'
  },
  sorcerer_careful_spell: {
    id: 'sorcerer_careful_spell',
    name: 'Осторожное заклинание',
    cost: 1,
    icon: '🛡️',
    actionType: 'action',
    desc: 'Союзники автоматически проходят спасбросок от вашего AoE.',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'custom', message: 'Магия обходит союзников.' },
    usage: 'combat',
    type: 'active',
    spellLevel: 0
  }
};

for (const [id, ab] of Object.entries(newAbilities)) {
  if (!data.progression.abilities[id]) data.progression.abilities[id] = ab;
}

const newItems = {
  greataxe: {
    id: 'greataxe',
    name: 'Секира',
    type: 'weapon',
    hands: 'two',
    desc: 'Тяжёлое оружие. Урон 1к12 + мод. Силы.',
    slot: 'weapon',
    damage: '1d12',
    stat: 'str',
    soundHit: 'slash_sword'
  },
  rapier: {
    id: 'rapier',
    name: 'Рапира',
    type: 'weapon',
    hands: 'one',
    desc: 'Finesse. Урон 1к8 + мод. Ловкости.',
    slot: 'weapon',
    damage: '1d8',
    stat: 'dex',
    soundHit: 'slash_sword'
  },
  scimitar: {
    id: 'scimitar',
    name: 'Скимитар',
    type: 'weapon',
    hands: 'one',
    desc: 'Лёгкое finesse. Урон 1к6 + мод. Ловкости.',
    slot: 'weapon',
    damage: '1d6',
    stat: 'dex',
    soundHit: 'slash_sword'
  },
  light_crossbow: {
    id: 'light_crossbow',
    name: 'Лёгкий арбалет',
    type: 'weapon',
    hands: 'two',
    desc: 'Дальнобойное. Урон 1к8 + мод. Ловкости.',
    slot: 'weapon',
    damage: '1d8',
    stat: 'dex',
    soundHit: 'attack_miss'
  },
  wooden_shield: {
    id: 'wooden_shield',
    name: 'Деревянный щит',
    type: 'shield',
    desc: 'Щит друида. +2 КД.',
    slot: 'shield',
    acBonus: 2
  },
  druidic_focus: {
    id: 'druidic_focus',
    name: 'Друидический фокус',
    type: 'equipment',
    desc: 'Посох или омела для заклинаний друида.',
    equippable: true,
    slot: 'accessory'
  },
  component_pouch: {
    id: 'component_pouch',
    name: 'Мешочек с компонентами',
    type: 'equipment',
    desc: 'Реагенты для заклинаний.',
    equippable: true,
    slot: 'accessory'
  },
  dart: {
    id: 'dart',
    name: 'Дротик',
    type: 'weapon',
    hands: 'one',
    desc: 'Метательное finesse. Урон 1к4 + Ловкость.',
    slot: 'weapon',
    damage: '1d4',
    stat: 'dex',
    soundHit: 'attack_miss'
  }
};

for (const [id, item] of Object.entries(newItems)) {
  if (!data.items[id]) data.items[id] = item;
}

const rageSlots = {
  '1': [2], '2': [2], '3': [3], '4': [3], '5': [3],
  '6': [4], '7': [4], '8': [4], '9': [4], '10': [4]
};

function rageLevels(choicesByLevel = {}) {
  const levels = { '1': { slots: rageSlots['1'] } };
  for (let lv = 2; lv <= 10; lv++) {
    const entry = { slots: rageSlots[String(lv)] };
    if (choicesByLevel[lv]) entry.choices = choicesByLevel[lv];
    if (lv === 4 || lv === 8) entry.asi = true;
    if (lv === 3 || lv === 5 || lv === 9) entry.stats = { atkBonus: 1 };
    levels[String(lv)] = entry;
  }
  return levels;
}

const newClasses = {
  barbarian: {
    name: 'Варвар',
    icon: '🪓',
    hpHitDie: 12,
    hp: 28,
    ac: 14,
    atkBonus: 5,
    dmgRoll: '1d12',
    dmgBonus: 3,
    initBonus: 1,
    unarmoredDefense: true,
    stats: { str: 16, dex: 14, con: 16, int: 8, wis: 12, cha: 10 },
    skillChoices: {
      count: 2,
      from: ['animal_handling', 'athletics', 'intimidation', 'nature', 'perception', 'survival']
    },
    resource: {
      name: 'Ярость',
      max: 2,
      formula: 'rage',
      icon: '🔥',
      shortRestFull: true,
      desc: '2 + мод. Тел. Восстанавливается на коротком отдыхе.'
    },
    mainWeapon: 'greataxe',
    startingItems: ['greataxe', 'water_flask', 'rope'],
    level1BonusChoices: ['reckless_attack', 'barbarian_danger_sense', 'barbarian_frenzy'],
    abilities: [
      {
        id: 'rage',
        name: 'Ярость',
        cost: 1,
        icon: '😤',
        actionType: 'bonus_action',
        desc: 'Бонусное действие: +2 к урону, преимущество на Силу. До конца боя.',
        combatOnly: true,
        oncePerCombat: false,
        effect: { type: 'rage' },
        usage: 'combat',
        type: 'active',
        spellLevel: 0
      }
    ],
    progression: {
      hpGain: '1d12',
      levels: rageLevels({
        2: ['reckless_attack', 'barbarian_danger_sense'],
        3: ['barbarian_frenzy', 'barbarian_feral_instinct'],
        5: ['barbarian_extra_attack', 'warrior_cleave'],
        7: ['barbarian_feral_instinct', 'barbarian_brutal_critical'],
        9: ['barbarian_brutal_critical', 'barbarian_rage_heal'],
        10: ['barbarian_rage_heal', 'warrior_endurance']
      })
    }
  },
  bard: {
    name: 'Бард',
    icon: '🎵',
    spellcasting: true,
    hpHitDie: 8,
    hp: 18,
    ac: 13,
    atkBonus: 4,
    dmgRoll: '1d8',
    dmgBonus: 2,
    initBonus: 2,
    stats: { str: 8, dex: 14, con: 12, int: 12, wis: 10, cha: 16 },
    skillChoices: {
      count: 3,
      from: ['acrobatics', 'deception', 'history', 'insight', 'intimidation', 'performance', 'persuasion']
    },
    resource: {
      name: 'Вдохновение Барда',
      max: 3,
      formula: 'charisma',
      icon: '🎵',
      shortRestFull: true,
      desc: 'Мод. Хар. Восстанавливается на коротком отдыхе.'
    },
    mainWeapon: 'rapier',
    startingItems: ['rapier', 'leather_armor', 'dagger', 'water_flask'],
    level1BonusChoices: ['bard_song_of_rest', 'bard_jack_of_all_trades', 'magic_missile'],
    abilities: [
      {
        id: 'bardic_inspiration',
        name: 'Вдохновение Барда',
        cost: 1,
        icon: '🎵',
        actionType: 'bonus_action',
        desc: 'Бонусное действие: +1к6 к следующему броску цели.',
        combatOnly: false,
        oncePerCombat: false,
        effect: { type: 'buff', buffType: 'atk', value: '1', targeting: { scope: 'self' } },
        usage: 'both',
        type: 'active',
        spellLevel: 0
      },
      {
        id: 'magic_missile',
        name: 'Магический снаряд',
        cost: 1,
        icon: '✨',
        spellLevel: 1,
        desc: 'Три снаряда по 1к4+1 урона.',
        combatOnly: true,
        oncePerCombat: false,
        effect: { type: 'magic_missile' },
        usage: 'combat',
        type: 'active'
      }
    ],
    progression: {
      hpGain: '1d8',
      levels: {
        ...fullCasterLevels({
          '2': { choices: ['bard_cutting_words', 'wizard_arcane_bolt', 'wizard_meditation'] },
          '3': { choices: ['bard_cutting_words', 'hold_person', 'wizard_venom'], stats: { atkBonus: 1 } },
          '4': { asi: true, choices: ['bard_countercharm', 'mirror_image'] },
          '5': { choices: ['fireball', 'wizard_scorch', 'cleric_healing_word'] },
          '6': { choices: ['bard_countercharm', 'wizard_ward'] },
          '10': { choices: ['wizard_empower', 'wizard_counterspell', 'cleric_prayer_of_healing'] }
        })
      }
    }
  },
  druid: {
    name: 'Друид',
    icon: '🌿',
    spellcasting: true,
    hpHitDie: 8,
    hp: 18,
    ac: 14,
    atkBonus: 4,
    dmgRoll: '1d6',
    dmgBonus: 2,
    initBonus: 1,
    stats: { str: 10, dex: 12, con: 14, int: 12, wis: 16, cha: 10 },
    skillChoices: {
      count: 2,
      from: ['arcana', 'animal_handling', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival']
    },
    resource: {
      name: 'Дикий облик',
      max: 2,
      formula: 'wild_shape',
      icon: '🐻',
      shortRestFull: true,
      desc: '2 использования. Короткий или длинный отдых.'
    },
    mainWeapon: 'scimitar',
    startingItems: ['scimitar', 'leather_armor', 'wooden_shield', 'druidic_focus', 'water_flask'],
    level1BonusChoices: ['wild_shape', 'druid_moon_combat', 'wizard_meditation'],
    abilities: [
      {
        id: 'wild_shape',
        name: 'Дикий облик',
        cost: 1,
        icon: '🐻',
        actionType: 'action',
        desc: 'Превращение в зверя: +2 КД на бой.',
        combatOnly: true,
        oncePerCombat: true,
        effect: { type: 'wild_shape' },
        usage: 'combat',
        type: 'active',
        spellLevel: 0
      },
      {
        id: 'cleric_sacred_flame',
        name: 'Пламенный клинок',
        spellLevel: 0,
        cost: 0,
        icon: '🔥',
        desc: 'Заговор. 1к8 огня.',
        combatOnly: true,
        oncePerCombat: false,
        effect: { type: 'damage', value: '1d8', damageType: 'fire', targeting: { scope: 'single' } },
        usage: 'combat',
        type: 'active'
      }
    ],
    progression: {
      hpGain: '1d8',
      levels: fullCasterLevels({
        '2': { choices: ['druid_moon_combat', 'cleric_healing_word', 'wizard_meditation'] },
        '3': { choices: ['ranger_spike_growth', 'cleric_bless', 'wizard_venom'], stats: { atkBonus: 1 } },
        '4': { asi: true, choices: ['wild_shape', 'cleric_shield_of_faith'] },
        '5': { choices: ['ranger_pass_without_trace', 'fireball', 'cleric_prayer_of_healing'] }
      })
    }
  },
  monk: {
    name: 'Монах',
    icon: '🥋',
    hpHitDie: 8,
    hp: 18,
    ac: 15,
    atkBonus: 5,
    dmgRoll: '1d4',
    dmgBonus: 3,
    initBonus: 3,
    unarmoredDefense: true,
    stats: { str: 10, dex: 16, con: 12, int: 12, wis: 16, cha: 10 },
    skillChoices: {
      count: 2,
      from: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth']
    },
    resource: {
      name: 'Ки',
      max: 2,
      formula: 'level',
      icon: '🪷',
      shortRestFull: true,
      desc: 'Очков = уровень. Короткий отдых восстанавливает все.'
    },
    mainWeapon: null,
    startingItems: ['dart', 'dart', 'water_flask'],
    level1BonusChoices: ['monk_patient_defense', 'monk_step_of_the_wind', 'monk_flurry_of_blows'],
    abilities: [
      {
        id: 'monk_martial_arts',
        name: 'Безоружный удар',
        cost: 0,
        icon: '👊',
        desc: 'Без оружия: 1к4 + Ловкость урона.',
        combatOnly: true,
        oncePerCombat: false,
        effect: { type: 'custom', message: 'Удар кулаком или ногой.' },
        usage: 'combat',
        type: 'active',
        spellLevel: 0
      }
    ],
    progression: {
      hpGain: '1d8',
      levels: {
        '1': { slots: [0] },
        '2': {
          slots: [2],
          choices: ['monk_flurry_of_blows', 'monk_patient_defense', 'monk_step_of_the_wind']
        },
        '3': { slots: [3], choices: ['monk_stunning_strike', 'monk_flurry_of_blows'], stats: { atkBonus: 1 } },
        '4': { slots: [4], asi: true, choices: ['monk_patient_defense', 'rogue_evasion'] },
        '5': {
          slots: [5],
          choices: ['monk_extra_attack', 'monk_stunning_strike', 'monk_flurry_of_blows'],
          stats: { atkBonus: 1 }
        },
        '6': { slots: [6], choices: ['monk_step_of_the_wind', 'rogue_uncanny_dodge'] },
        '7': { slots: [7], choices: ['rogue_evasion', 'monk_stunning_strike'] },
        '8': { slots: [8], asi: true, choices: ['monk_patient_defense'] },
        '9': { slots: [9], choices: ['monk_step_of_the_wind', 'rogue_reliable_talent'] },
        '10': { slots: [10], choices: ['monk_extra_attack', 'monk_stunning_strike'] }
      }
    }
  },
  warlock: {
    name: 'Чернокнижник',
    icon: '👁️',
    pactMagic: true,
    hpHitDie: 8,
    hp: 18,
    ac: 13,
    atkBonus: 4,
    dmgRoll: '1d8',
    dmgBonus: 2,
    initBonus: 2,
    stats: { str: 8, dex: 14, con: 14, int: 12, wis: 10, cha: 16 },
    skillChoices: {
      count: 2,
      from: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion']
    },
    resource: {
      name: 'Ячейки договора',
      max: 1,
      icon: '💎',
      shortRestFull: true,
      desc: 'Мало ячеек, но короткий отдых восстанавливает все.'
    },
    mainWeapon: 'light_crossbow',
    startingItems: ['light_crossbow', 'leather_armor', 'dagger', 'component_pouch', 'water_flask'],
    level1BonusChoices: ['warlock_dark_ones_blessing', 'warlock_hex', 'eldritch_blast'],
    abilities: [
      {
        id: 'eldritch_blast',
        name: 'Мистический заряд',
        spellLevel: 0,
        cost: 0,
        icon: '⚡',
        actionType: 'action',
        desc: '1к10 силового урона. С 5 уровня — 2к10.',
        combatOnly: true,
        oncePerCombat: false,
        effect: { type: 'damage', value: '1d10', damageType: 'force', targeting: { scope: 'single' } },
        usage: 'combat',
        type: 'active'
      }
    ],
    progression: {
      hpGain: '1d8',
      levels: {
        '1': { slots: [1] },
        '2': { slots: [2], choices: ['warlock_hex', 'warlock_agony', 'wizard_meditation'] },
        '3': { slots: [2], choices: ['warlock_agony', 'hold_person', 'wizard_venom'], stats: { atkBonus: 1 } },
        '4': { slots: [2], asi: true, choices: ['warlock_dark_ones_blessing', 'mirror_image'] },
        '5': { slots: [2], choices: ['fireball', 'warlock_hex', 'eldritch_blast'], stats: { atkBonus: 1 } },
        '6': { slots: [2], choices: ['warlock_dark_ones_blessing', 'wizard_ward'] },
        '7': { slots: [2], choices: ['wizard_scorch', 'warlock_agony'] },
        '8': { slots: [2], asi: true, choices: ['wizard_counterspell'] },
        '9': { slots: [2], choices: ['wizard_frost', 'warlock_hex'] },
        '10': { slots: [2], choices: ['wizard_empower', 'fireball'] }
      }
    }
  },
  sorcerer: {
    name: 'Чародей',
    icon: '✨',
    spellcasting: true,
    hpHitDie: 6,
    hp: 14,
    ac: 12,
    atkBonus: 4,
    dmgRoll: '1d4',
    dmgBonus: 2,
    initBonus: 2,
    stats: { str: 8, dex: 14, con: 14, int: 10, wis: 12, cha: 16 },
    skillChoices: {
      count: 2,
      from: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion']
    },
    resource: {
      name: 'Очки чародейства',
      max: 1,
      formula: 'level',
      icon: '⭐',
      shortRestFull: false,
      desc: 'Очков = уровень. Полное восстановление на длинном отдыхе.'
    },
    mainWeapon: 'light_crossbow',
    startingItems: ['light_crossbow', 'dagger', 'component_pouch', 'water_flask'],
    level1BonusChoices: ['sorcerer_draconic_resilience', 'sorcerer_careful_spell', 'burning_hands'],
    abilities: [
      {
        id: 'burning_hands',
        name: 'Пылающие руки',
        cost: 1,
        icon: '🔥',
        spellLevel: 1,
        desc: 'Конус. 3к6 огня.',
        combatOnly: true,
        oncePerCombat: false,
        effect: { type: 'aoe_fire', value: '3d6' },
        usage: 'combat',
        type: 'active'
      },
      {
        id: 'magic_missile',
        name: 'Магический снаряд',
        cost: 1,
        icon: '✨',
        spellLevel: 1,
        desc: 'Автопопадание 3к4+3.',
        combatOnly: true,
        oncePerCombat: false,
        effect: { type: 'magic_missile' },
        usage: 'combat',
        type: 'active'
      }
    ],
    progression: {
      hpGain: '1d6',
      levels: fullCasterLevels({
        '2': { choices: ['sorcerer_metamagic_quickened', 'sorcerer_careful_spell', 'wizard_meditation'] },
        '3': { choices: ['sorcerer_metamagic_quickened', 'hold_person', 'wizard_venom'], stats: { atkBonus: 1 } },
        '4': { asi: true, choices: ['sorcerer_draconic_resilience', 'mirror_image'] },
        '5': { choices: ['fireball', 'wizard_scorch', 'sorcerer_careful_spell'] },
        '6': { choices: ['sorcerer_draconic_resilience', 'wizard_ward'] },
        '10': { choices: ['wizard_empower', 'wizard_counterspell'] }
      })
    }
  }
};

// Подсказки UI
const hints = {
  class_barbarian: 'Варвар — яростный боец ближнего боя. Кость хитов к12, Сила. Ресурс: Ярость (2 + Тел), короткий отдых.',
  class_bard: 'Бард — поддержка и магия. к8, Харизма. Вдохновение Барда и полный кастер.',
  class_druid: 'Друид — природа и облики зверей. к8, Мудрость. Дикий облик и заклинания.',
  class_monk: 'Монах — безоружный боец. к8, Ловкость и Мудрость. Ки = уровень, короткий отдых.',
  class_warlock: 'Чернокнижник — мистические заряды и мало ячеек договора. к8, Харизма. Короткий отдых.',
  class_sorcerer: 'Чародей — врождённая магия и метамагия. к6, Харизма. Очки чародейства = уровень.'
};
Object.assign(data.ui_hints, hints);

for (const [id, cls] of Object.entries(newClasses)) {
  if (data.classes[id]) {
    console.warn('Перезапись класса:', id);
  }
  data.classes[id] = cls;
}

function abilityExists(aid) {
  if (data.progression.abilities[aid]) return true;
  for (const cls of Object.values(data.classes)) {
    if ((cls.abilities || []).some((a) => a.id === aid)) return true;
  }
  return false;
}

function validateRefs() {
  for (const [cid, cls] of Object.entries(newClasses)) {
    const c = data.classes[cid];
    (c.level1BonusChoices || []).forEach((aid) => {
      if (!abilityExists(aid)) throw new Error(`Missing ability: ${aid} (${cid})`);
    });
    Object.values(c.progression?.levels || {}).forEach((lv) => {
      (lv.choices || []).forEach((aid) => {
        if (!abilityExists(aid)) throw new Error(`Missing ability: ${aid} (${cid} level)`);
      });
    });
    (c.startingItems || []).forEach((iid) => {
      if (!data.items[iid]) throw new Error(`Missing item: ${iid} (${cid})`);
    });
  }
}

validateRefs();
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('OK: barbarian, bard, druid, monk, warlock, sorcerer added.');
