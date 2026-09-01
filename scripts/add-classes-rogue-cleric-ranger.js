const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../data/game_data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const newAbilities = {
  rogue_cunning_action: {
    id: 'rogue_cunning_action',
    name: 'Хитрое действие',
    cost: 1,
    icon: '💨',
    desc: 'Бонусное действие: Рывок, Отход или Засада.',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'custom', message: 'Вы совершаете хитрое маневрирование!' },
    usage: 'combat',
    type: 'active'
  },
  rogue_expertise_stealth: {
    id: 'rogue_expertise_stealth',
    name: 'Экспертиза: Скрытность',
    type: 'passive',
    icon: '🥷',
    desc: 'Удваивает бонус мастерства к проверкам Скрытности.',
    passive: {},
    usage: 'both'
  },
  rogue_fast_hands: {
    id: 'rogue_fast_hands',
    name: 'Быстрые руки',
    cost: 1,
    icon: '🤲',
    desc: 'Хитрое действие можно использовать для проверки Ловкости рук или использования предмета.',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'custom', message: 'Ваши руки мелькают быстрее тени!' },
    usage: 'combat',
    type: 'active'
  },
  rogue_assassinate: {
    id: 'rogue_assassinate',
    name: 'Убийственный удар',
    cost: 2,
    icon: '💀',
    desc: 'Раз за бой: автокрит по застигнутому врасплох врагу или 3к6 урона.',
    combatOnly: true,
    oncePerCombat: true,
    effect: { type: 'damage', value: '3d6', targeting: { scope: 'single' } },
    usage: 'combat',
    type: 'active'
  },
  rogue_evasion: {
    id: 'rogue_evasion',
    name: 'Уклонение',
    type: 'passive',
    icon: '🌀',
    desc: 'При успешном спасброске Ловкости от AoE — ноль урона вместо половины.',
    passive: {},
    usage: 'both'
  },
  rogue_uncanny_dodge: {
    id: 'rogue_uncanny_dodge',
    name: 'Невероятное уклонение',
    cost: 1,
    icon: '↩️',
    desc: 'Реакция: половина урона от атаки, которую вы видите.',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'buff', buffType: 'ac', value: '0', targeting: { scope: 'self' } },
    usage: 'combat',
    type: 'active'
  },
  rogue_reliable_talent: {
    id: 'rogue_reliable_talent',
    name: 'Надёжный талант',
    type: 'passive',
    icon: '⭐',
    desc: 'При проверке характеристики с мастерством: результат к20 не может быть ниже 10.',
    passive: {},
    usage: 'both'
  },
  cleric_bless: {
    id: 'cleric_bless',
    name: 'Благословение',
    spellLevel: 1,
    cost: 1,
    icon: '🙏',
    concentration: true,
    desc: 'Концентрация. Союзники получают +1к4 к атакам и спасброскам.',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'buff', buffType: 'atk', value: '0', targeting: { scope: 'self' } },
    usage: 'combat',
    type: 'active'
  },
  cleric_shield_of_faith: {
    id: 'cleric_shield_of_faith',
    name: 'Щит веры',
    spellLevel: 1,
    cost: 1,
    icon: '🛡️',
    concentration: true,
    desc: 'Концентрация. +2 КД цели.',
    combatOnly: true,
    oncePerCombat: false,
    effect: {
      type: 'apply_status',
      targeting: { scope: 'self' },
      addEffect: { id: 'fortified', duration: 99, attribute: 'ac', value: 2 }
    },
    usage: 'combat',
    type: 'active'
  },
  cleric_guiding_bolt: {
    id: 'cleric_guiding_bolt',
    name: 'Направляющий луч',
    spellLevel: 1,
    cost: 1,
    icon: '✨',
    soundCast: 'smite_hit',
    soundHit: 'smite_hit',
    desc: 'Луч света наносит 4к6 излучения. Следующая атака по цели — с преимуществом.',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'damage', value: '4d6', damageType: 'radiant', targeting: { scope: 'single' } },
    usage: 'combat',
    type: 'active'
  },
  cleric_healing_word: {
    id: 'cleric_healing_word',
    name: 'Лечащее слово',
    spellLevel: 1,
    cost: 1,
    icon: '💬',
    desc: 'Бонусное действие. Восстанавливает 1к4+мод.МУД ОЗ на расстоянии.',
    combatOnly: false,
    oncePerCombat: false,
    effect: { type: 'heal', value: '1d4+3', targeting: { scope: 'single' } },
    usage: 'both',
    type: 'active'
  },
  cleric_turn_undead: {
    id: 'cleric_turn_undead',
    name: 'Изгнание нечисти',
    cost: 1,
    spellLevel: 1,
    icon: '☀️',
    soundCast: 'buff',
    desc: '2к8 урона излучением всем врагам; нежить ослаблена.',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'damage', value: '2d8', damageType: 'radiant', targeting: { scope: 'all_enemies' } },
    usage: 'both',
    type: 'active'
  },
  cleric_spiritual_weapon: {
    id: 'cleric_spiritual_weapon',
    name: 'Духовное оружие',
    spellLevel: 2,
    cost: 2,
    icon: '⚔️',
    desc: 'Бонусное действие. Призрачное оружие атакует каждый ход (1к8+мод.МУД).',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'damage', value: '1d8+3', damageType: 'radiant', targeting: { scope: 'single' } },
    usage: 'combat',
    type: 'active'
  },
  cleric_prayer_of_healing: {
    id: 'cleric_prayer_of_healing',
    name: 'Молитва исцеления',
    spellLevel: 2,
    cost: 2,
    icon: '🙏',
    desc: 'Восстанавливает 2к8+2 ОЗ всем союзникам.',
    combatOnly: false,
    oncePerCombat: false,
    effect: { type: 'heal', value: '2d8+2', targeting: { scope: 'single' } },
    usage: 'both',
    type: 'active'
  },
  cleric_aid: {
    id: 'cleric_aid',
    name: 'Подмога',
    spellLevel: 2,
    cost: 2,
    icon: '💪',
    desc: 'Увеличивает макс. ОЗ цели на 5 на 8 часов.',
    combatOnly: false,
    oncePerCombat: false,
    effect: { type: 'heal', value: '5', targeting: { scope: 'single' } },
    usage: 'both',
    type: 'active'
  },
  ranger_hunters_mark: {
    id: 'ranger_hunters_mark',
    name: 'Метка охотника',
    spellLevel: 1,
    cost: 1,
    icon: '🎯',
    concentration: true,
    desc: 'Концентрация. Цель получает +1к6 урона от ваших атак.',
    combatOnly: true,
    oncePerCombat: false,
    effect: {
      type: 'apply_status',
      targeting: { scope: 'self' },
      addEffect: { id: 'fortified', duration: 99, attribute: 'ac', value: 0 }
    },
    usage: 'combat',
    type: 'active'
  },
  ranger_favored_enemy: {
    id: 'ranger_favored_enemy',
    name: 'Избранный враг (улучш.)',
    type: 'passive',
    icon: '🐺',
    desc: '+2 к урону против избранного типа существ.',
    passive: { atkBonus: 0 },
    usage: 'both'
  },
  ranger_natural_explorer: {
    id: 'ranger_natural_explorer',
    name: 'Природный проводник (улучш.)',
    type: 'passive',
    icon: '🌿',
    desc: 'Группа путешествует быстрее и не сбивается с пути.',
    passive: {},
    usage: 'both'
  },
  ranger_colossus_slayer: {
    id: 'ranger_colossus_slayer',
    name: 'Убийца колоссов',
    cost: 1,
    icon: '🗡️',
    desc: 'Раз за ход: +1к8 урона раненому врагу.',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'damage', value: '1d8', targeting: { scope: 'single' } },
    usage: 'combat',
    type: 'active'
  },
  ranger_volley: {
    id: 'ranger_volley',
    name: 'Залп',
    cost: 2,
    icon: '🏹',
    desc: 'Атака дальнобойным оружием по всем врагам (1к8 урона каждому).',
    combatOnly: true,
    oncePerCombat: false,
    effects: [{ type: 'damage', value: '1d8', allTargets: true }],
    usage: 'combat',
    type: 'active'
  },
  ranger_pass_without_trace: {
    id: 'ranger_pass_without_trace',
    name: 'Бесследное передвижение',
    spellLevel: 2,
    cost: 2,
    icon: '🍃',
    concentration: true,
    desc: 'Концентрация. +10 к Скрытности для вас и союзников.',
    combatOnly: false,
    oncePerCombat: false,
    effect: { type: 'buff', buffType: 'ac', value: '0', targeting: { scope: 'self' } },
    usage: 'both',
    type: 'active'
  },
  ranger_spike_growth: {
    id: 'ranger_spike_growth',
    name: 'Шипы',
    spellLevel: 2,
    cost: 2,
    icon: '🌵',
    concentration: true,
    desc: 'Концентрация. Земля покрывается шипами. Враги получают 2к4 колющего урона при движении.',
    combatOnly: true,
    oncePerCombat: false,
    effect: { type: 'damage', value: '2d4', damageType: 'piercing', targeting: { scope: 'all_enemies' } },
    usage: 'combat',
    type: 'active'
  }
};

for (const [id, ab] of Object.entries(newAbilities)) {
  if (data.progression.abilities[id]) {
    console.warn('Skip ability (exists):', id);
  } else {
    data.progression.abilities[id] = ab;
  }
}

const newClasses = {
  rogue: {
    name: 'Плут',
    icon: '🗡️',
    hp: 20,
    ac: 14,
    atkBonus: 5,
    dmgRoll: '1d8',
    dmgBonus: 3,
    initBonus: 4,
    stats: { str: 10, dex: 16, con: 12, int: 14, wis: 12, cha: 12 },
    skills: 'Скрытность, Ловкость рук, Расследование, Убеждение',
    resource: { name: 'Хитрость', max: 2, desc: 'Очки хитрости для особых приёмов. Восстанавливаются при отдыхе.' },
    mainWeapon: 'shortsword',
    startingItems: ['shortsword', 'leather_armor', 'thieves_tools', 'water_flask'],
    level1BonusChoices: [
      'rogue_cunning_action',
      'rogue_expertise_stealth',
      'rogue_fast_hands',
      'rogue_assassinate',
      'rogue_evasion'
    ],
    abilities: [
      {
        id: 'rogue_sneak_attack',
        name: 'Скрытая атака',
        cost: 0,
        icon: '🎯',
        desc: 'Раз за ход: +1к6 урона при атаке оружием finesse или ranged.',
        combatOnly: true,
        oncePerCombat: false,
        effect: { type: 'damage', value: '1d6', targeting: { scope: 'single' } },
        usage: 'combat',
        type: 'active'
      },
      {
        id: 'rogue_cunning_action_base',
        name: 'Хитрое действие',
        cost: 1,
        icon: '💨',
        desc: 'Бонусное действие: Рывок, Отход или Засада.',
        combatOnly: true,
        oncePerCombat: false,
        effect: { type: 'custom', message: 'Вы совершаете хитрое маневрирование!' },
        usage: 'combat',
        type: 'active'
      },
      {
        id: 'rogue_thieves_tools',
        name: 'Отмычки',
        cost: 0,
        icon: '🔓',
        desc: 'Мастерство взлома замков и обезвреживания ловушек.',
        combatOnly: false,
        oncePerCombat: false,
        effect: { type: 'custom', message: 'Вы осматриваете замок профессиональным взглядом.' },
        usage: 'exploration',
        type: 'active'
      }
    ],
    progression: {
      hpGain: '1d8',
      levels: {
        '2': { choices: ['rogue_cunning_action', 'rogue_expertise_stealth'] },
        '3': { choices: ['rogue_fast_hands', 'rogue_assassinate', 'rogue_evasion'], stats: { atkBonus: 1 } },
        '4': { asi: true, choices: ['rogue_uncanny_dodge', 'rogue_reliable_talent'] },
        '5': { choices: ['rogue_cunning_action', 'rogue_assassinate', 'rogue_expertise_stealth'], stats: { atkBonus: 1 } }
      }
    }
  },
  cleric: {
    spellcasting: true,
    baseSlots: [2],
    name: 'Жрец',
    icon: '✝️',
    hp: 22,
    ac: 16,
    atkBonus: 4,
    dmgRoll: '1d8',
    dmgBonus: 2,
    initBonus: 1,
    stats: { str: 14, dex: 10, con: 14, int: 10, wis: 16, cha: 12 },
    skills: 'Религия, Медицина, Проницательность, Убеждение',
    resource: { name: 'Ячейки заклинаний', max: 3, desc: 'Используются для божественных заклинаний. Восстанавливаются при отдыхе.' },
    mainWeapon: 'mace',
    startingItems: ['mace', 'chainmail', 'shield', 'holy_symbol', 'water_flask'],
    level1BonusChoices: [
      'cleric_bless',
      'cleric_shield_of_faith',
      'cleric_guiding_bolt',
      'cleric_healing_word',
      'cleric_turn_undead'
    ],
    abilities: [
      {
        id: 'cleric_lay_on_hands',
        name: 'Лечение руками',
        cost: 1,
        icon: '💚',
        desc: 'Касание. Восстанавливает 1к8+2 ОЗ себе или союзнику.',
        combatOnly: false,
        oncePerCombat: false,
        effect: { type: 'heal', value: '1d8+2', targeting: { scope: 'single' } },
        usage: 'both',
        type: 'active'
      },
      {
        id: 'cleric_divine_sense',
        name: 'Божественное чувство',
        cost: 1,
        icon: '👁️',
        desc: 'Обнаруживает нежить, демонов и источники святости в радиусе 60 футов. Вне боя.',
        combatOnly: false,
        oncePerCombat: false,
        effect: { type: 'divine_sense' },
        usage: 'exploration',
        type: 'active'
      },
      {
        id: 'cleric_sacred_flame',
        name: 'Священное пламя',
        spellLevel: 0,
        cost: 0,
        icon: '🕯️',
        desc: 'Заговор. Луч света наносит 1к8 излучения (спасбросок Ловкости).',
        combatOnly: true,
        oncePerCombat: false,
        effect: { type: 'damage', value: '1d8', damageType: 'radiant', targeting: { scope: 'single' } },
        usage: 'combat',
        type: 'active'
      }
    ],
    progression: {
      hpGain: '1d8',
      levels: {
        '2': { slots: [3], choices: ['cleric_bless', 'cleric_shield_of_faith', 'cleric_healing_word'] },
        '3': { slots: [4, 2], choices: ['cleric_spiritual_weapon', 'cleric_prayer_of_healing', 'cleric_turn_undead'], stats: { atkBonus: 1 } },
        '4': { slots: [4, 3], asi: true, choices: ['cleric_guiding_bolt', 'cleric_aid'] },
        '5': { slots: [4, 3, 2], choices: ['cleric_spiritual_weapon', 'cleric_bless', 'cleric_healing_word'] }
      }
    }
  },
  ranger: {
    halfCaster: true,
    name: 'Следопыт',
    icon: '🏹',
    hp: 23,
    ac: 15,
    atkBonus: 5,
    dmgRoll: '1d8',
    dmgBonus: 3,
    initBonus: 3,
    stats: { str: 12, dex: 16, con: 14, int: 10, wis: 14, cha: 8 },
    skills: 'Выживание, Скрытность, Восприятие, Природа',
    resource: { name: 'Ячейки заклинаний', max: 2, desc: 'Природная магия. Ячейки доступны со 2 уровня. Восстанавливаются при отдыхе.' },
    mainWeapon: 'longbow',
    startingItems: ['longbow', 'leather_armor', 'shortsword', 'water_flask', 'rope'],
    level1BonusChoices: [
      'ranger_hunters_mark',
      'ranger_favored_enemy',
      'ranger_natural_explorer',
      'ranger_colossus_slayer',
      'ranger_volley'
    ],
    abilities: [
      {
        id: 'ranger_favored_enemy_base',
        name: 'Избранный враг',
        cost: 0,
        icon: '🐺',
        desc: 'Преимущество на проверки Выживания и Восприятия против избранного типа существ.',
        combatOnly: false,
        oncePerCombat: false,
        effect: { type: 'custom', message: 'Вы знаете повадки этого типа существ.' },
        usage: 'exploration',
        type: 'active'
      },
      {
        id: 'ranger_natural_explorer_base',
        name: 'Природный проводник',
        cost: 0,
        icon: '🌿',
        desc: 'Вы не теряетесь в дикой местности и находите пищу для группы.',
        combatOnly: false,
        oncePerCombat: false,
        effect: { type: 'custom', message: 'Местность вам хорошо знакома.' },
        usage: 'exploration',
        type: 'active'
      },
      {
        id: 'ranger_archery_style',
        name: 'Стрелковый стиль',
        type: 'passive',
        icon: '🏹',
        desc: '+2 к атаке дальнобойным оружием.',
        passive: { atkBonus: 2 },
        usage: 'both'
      }
    ],
    progression: {
      hpGain: '1d10',
      levels: {
        '2': { slots: [2], choices: ['ranger_hunters_mark', 'ranger_colossus_slayer'] },
        '3': { slots: [3], choices: ['ranger_volley', 'ranger_pass_without_trace', 'ranger_favored_enemy'], stats: { atkBonus: 1 } },
        '4': { slots: [3], asi: true, choices: ['ranger_spike_growth', 'ranger_natural_explorer'] },
        '5': { slots: [4, 2], choices: ['ranger_hunters_mark', 'ranger_volley', 'ranger_colossus_slayer'], stats: { atkBonus: 1 } }
      }
    }
  }
};

for (const [id, cls] of Object.entries(newClasses)) {
  if (data.classes[id]) {
    console.warn('Skip class (exists):', id);
  } else {
    data.classes[id] = cls;
  }
}

const newItems = {
  shortsword: {
    id: 'shortsword',
    name: 'Короткий меч',
    type: 'weapon',
    desc: 'Лёгкое оружие finesse. Урон 1к6 + мод. Ловкости.',
    slot: 'weapon',
    damage: '1d6',
    stat: 'dex',
    soundHit: 'slash_sword'
  },
  leather_armor: {
    id: 'leather_armor',
    name: 'Кожаная броня',
    type: 'armor',
    desc: 'Лёгкая броня. КД 11 + полный мод. Ловкости.',
    slot: 'armor',
    ac: 11,
    armorType: 'light'
  },
  thieves_tools: {
    id: 'thieves_tools',
    name: 'Отмычки',
    type: 'equipment',
    desc: 'Набор инструментов для взлома замков.',
    equippable: true,
    slot: 'accessory'
  },
  mace: {
    id: 'mace',
    name: 'Булава',
    type: 'weapon',
    desc: 'Одноручное дробящее оружие. Урон 1к6 + мод. Силы.',
    slot: 'weapon',
    damage: '1d6',
    stat: 'str',
    soundHit: 'slash_physical'
  },
  longbow: {
    id: 'longbow',
    name: 'Длинный лук',
    type: 'weapon',
    desc: 'Дальнобойное оружие. Урон 1к8 + мод. Ловкости. Дальность 150/600.',
    slot: 'weapon',
    damage: '1d8',
    stat: 'dex',
    soundHit: 'attack_miss'
  }
};

for (const [id, item] of Object.entries(newItems)) {
  if (!data.items[id]) data.items[id] = item;
}

function validateRefs() {
  const pool = data.progression.abilities;
  for (const [cid, cls] of Object.entries(newClasses)) {
  if (!data.classes[cid]) continue;
    const c = data.classes[cid];
    (c.level1BonusChoices || []).forEach((aid) => {
      if (!pool[aid]) throw new Error(`Missing ability in pool: ${aid} (class ${cid})`);
    });
    Object.values(c.progression?.levels || {}).forEach((lv) => {
      (lv.choices || []).forEach((aid) => {
        if (!pool[aid]) throw new Error(`Missing ability in pool: ${aid} (class ${cid} level)`);
      });
    });
    (c.startingItems || []).forEach((iid) => {
      if (!data.items[iid]) throw new Error(`Missing item: ${iid} (class ${cid})`);
    });
  }
}

validateRefs();

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('OK: rogue, cleric, ranger added to game_data.json');
