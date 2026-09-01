function createPf2eStarterProject(title) {
  return {
    meta: {
      title: title || 'PF2e Adventure',
      version: '1.0',
      author: '',
      description: 'Pathfinder 2e adventure',
      system: 'pf2e'
    },
    system: 'pf2e',
    startingFlags: {},
    reputation: {},
    ui_hints: {
      hp: 'Hit Points. At 0 HP you are dying.',
      ac: 'Armor Class — how hard you are to hit.',
      atk: 'Attack bonus (d20 roll).',
      level: 'Level and experience.',
      resource: 'Class resource (Focus Points or Spell Slots).',
      rest: 'Rest to recover HP and resources.',
      inventory: 'Equipment, consumables, and quest items.',
      travel: 'Fast travel between visited locations on the map.'
    },
    statusEffects: {},
    audio: {
      catalog: {},
      defaults: {
        damageType: {},
        effectType: {},
        attack: {}
      }
    },
    enemyScaling: {
      enabled: true,
      hpRatePerLevel: 0.18,
      bossHpRatePerLevel: 0.35,
      atkBonusPerEvenLevel: 1,
      damageMinPlayerLevel: 3,
      acBonuses: []
    },
    progression: {
      enabled: true,
      maxLevel: 20,
      expTable: [
        0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000,
        12000, 14000, 16000, 18000, 20000, 22500, 25000, 28000, 32000
      ],
      defaultHpGain: '1d8',
      defaults: { enemyExp: 40, skillCheckExp: 20 },
      skillExp: {},
      abilities: {}
    },
    ancestries: {
      human: { name: 'Human', icon: '🧑', hp: 8, desc: 'Versatile and ambitious.' },
      elf: { name: 'Elf', icon: '🧝', hp: 6, desc: 'Graceful and perceptive.', speed: 30 },
      dwarf: { name: 'Dwarf', icon: '⛏️', hp: 10, desc: 'Sturdy and resilient.', speed: 20 },
      gnome: { name: 'Gnome', icon: '🎭', hp: 8, desc: 'Curious and magical.' },
      halfling: { name: 'Halfling', icon: '🧒', hp: 6, desc: 'Lucky and nimble.' }
    },
    classes: {
      fighter: {
        name: 'Fighter',
        icon: '⚔️',
        ancestry: 'human',
        hpPerLevel: 10,
        ac: 18,
        atkBonus: 7,
        dmgRoll: '1d8',
        dmgBonus: 4,
        initBonus: 2,
        armorProficiency: 'trained',
        stats: { str: 18, dex: 14, con: 14, int: 10, wis: 12, cha: 10 },
        skills: 'Athletics, Intimidation, Acrobatics',
        resource: { name: 'Actions', max: 3, desc: '3 actions per turn.' },
        mainWeapon: 'longsword',
        startingItems: ['longsword', 'chainmail', 'shield'],
        abilities: [
          {
            id: 'pf2e_sudden_charge',
            name: 'Sudden Charge',
            cost: 2,
            icon: '🏃',
            desc: 'Stride twice, then Strike. (2 actions)',
            combatOnly: true,
            effect: { type: 'custom', message: 'You charge forward and strike!' }
          },
          {
            id: 'pf2e_power_attack',
            name: 'Power Attack',
            cost: 2,
            icon: '🗡️',
            desc: 'One Strike with extra damage die. (2 actions)',
            combatOnly: true,
            effect: { type: 'damage', value: '2d8' }
          }
        ],
        progression: { hpGain: '1d10', levels: {} }
      },
      wizard: {
        name: 'Wizard',
        icon: '🔮',
        ancestry: 'human',
        hpPerLevel: 6,
        spellcasting: true,
        baseSlots: [2],
        ac: 12,
        atkBonus: 4,
        dmgRoll: '1d6',
        dmgBonus: 2,
        initBonus: 3,
        armorProficiency: 'untrained',
        stats: { str: 10, dex: 14, con: 12, int: 18, wis: 14, cha: 10 },
        skills: 'Arcana, Occultism, Society',
        resource: { name: 'Spell Slots', max: 2, desc: 'Prepared spell slots.' },
        mainWeapon: 'staff',
        startingItems: ['staff', 'spellbook'],
        abilities: [
          {
            id: 'pf2e_electric_arc',
            name: 'Electric Arc',
            spellLevel: 1,
            cost: 2,
            icon: '⚡',
            desc: 'Lightning arcs between enemies. (2 actions)',
            combatOnly: true,
            effect: {
              type: 'damage',
              value: '2d12',
              damageType: 'lightning',
              targeting: { scope: 'all_enemies' }
            }
          },
          {
            id: 'pf2e_shield_cantrip',
            name: 'Shield (Cantrip)',
            cost: 1,
            icon: '🛡️',
            desc: '+1 AC until start of next turn. (1 action)',
            combatOnly: true,
            effect: { type: 'buff', buffType: 'ac', value: 1 }
          }
        ],
        progression: { hpGain: '1d6', levels: {} }
      },
      cleric: {
        name: 'Cleric',
        icon: '✝️',
        ancestry: 'human',
        hpPerLevel: 8,
        hasFocusPoints: true,
        focusPoints: 1,
        spellcasting: true,
        baseSlots: [2],
        ac: 16,
        atkBonus: 5,
        dmgRoll: '1d8',
        dmgBonus: 3,
        initBonus: 1,
        armorProficiency: 'trained',
        stats: { str: 14, dex: 12, con: 14, int: 10, wis: 18, cha: 12 },
        skills: 'Religion, Medicine, Diplomacy',
        resource: { name: 'Focus Points', max: 1, desc: 'Regained with Refocus.' },
        mainWeapon: 'mace',
        startingItems: ['mace', 'shield', 'holy_symbol'],
        abilities: [
          {
            id: 'pf2e_heal_font',
            name: 'Heal (Font)',
            spellLevel: 1,
            cost: 1,
            icon: '💚',
            desc: 'Restore 1d8 HP to one ally. (1-2 actions)',
            combatOnly: false,
            effect: { type: 'heal', value: '1d8' }
          },
          {
            id: 'pf2e_channel_smite',
            name: 'Channel Smite',
            cost: 2,
            icon: '☀️',
            desc: 'Strike with divine energy, +1d8 radiant. (2 actions)',
            combatOnly: true,
            effect: { type: 'smite', value: '1d8' }
          }
        ],
        progression: { hpGain: '1d8', levels: {} }
      },
      rogue: {
        name: 'Rogue',
        icon: '🗡️',
        ancestry: 'human',
        hpPerLevel: 8,
        ac: 17,
        atkBonus: 6,
        dmgRoll: '1d6',
        dmgBonus: 4,
        initBonus: 4,
        armorProficiency: 'trained',
        stats: { str: 12, dex: 18, con: 12, int: 14, wis: 12, cha: 12 },
        skills: 'Stealth, Thievery, Acrobatics, Deception',
        resource: { name: 'Actions', max: 3, desc: '3 actions per turn.' },
        mainWeapon: 'shortsword',
        startingItems: ['shortsword', 'leather_armor', 'thieves_tools'],
        abilities: [
          {
            id: 'pf2e_sneak_attack',
            name: 'Sneak Attack',
            cost: 0,
            icon: '🎯',
            desc: 'Extra 1d6 precision damage to flat-footed targets.',
            combatOnly: true,
            passive: { atkBonus: 0 },
            effect: { type: 'custom', message: 'You strike a vulnerable spot!' }
          },
          {
            id: 'pf2e_twin_feint',
            name: 'Twin Feint',
            cost: 2,
            icon: '🎭',
            desc: 'Two Strikes; target is flat-footed for the second. (2 actions)',
            combatOnly: true,
            effect: { type: 'extra_attack' }
          }
        ],
        progression: { hpGain: '1d8', levels: {} }
      }
    },
    items: {
      longsword: {
        id: 'longsword',
        name: 'Longsword',
        type: 'weapon',
        desc: '1d8 slashing',
        slot: 'weapon',
        damage: '1d8',
        stat: 'str'
      },
      shortsword: {
        id: 'shortsword',
        name: 'Shortsword',
        type: 'weapon',
        desc: '1d6 piercing',
        slot: 'weapon',
        damage: '1d6',
        stat: 'dex'
      },
      staff: {
        id: 'staff',
        name: 'Staff',
        type: 'weapon',
        desc: '1d4 bludgeoning',
        slot: 'weapon',
        damage: '1d4',
        stat: 'str'
      },
      mace: {
        id: 'mace',
        name: 'Mace',
        type: 'weapon',
        desc: '1d6 bludgeoning',
        slot: 'weapon',
        damage: '1d6',
        stat: 'str'
      },
      chainmail: {
        id: 'chainmail',
        name: 'Chain Mail',
        type: 'armor',
        desc: 'AC +4, dex cap +1',
        slot: 'armor',
        ac: 4,
        dexCap: 1,
        armorType: 'heavy'
      },
      leather_armor: {
        id: 'leather_armor',
        name: 'Leather Armor',
        type: 'armor',
        desc: 'AC +1, dex cap +4',
        slot: 'armor',
        ac: 1,
        dexCap: 4,
        armorType: 'light'
      },
      shield: {
        id: 'shield',
        name: 'Shield',
        type: 'shield',
        desc: '+2 AC when raised',
        slot: 'shield',
        acBonus: 2
      },
      holy_symbol: {
        id: 'holy_symbol',
        name: 'Holy Symbol',
        type: 'equipment',
        desc: 'Divine focus.',
        slot: 'accessory',
        equippable: true
      },
      spellbook: {
        id: 'spellbook',
        name: 'Spellbook',
        type: 'equipment',
        desc: 'Contains prepared spells.',
        slot: 'accessory',
        equippable: true
      },
      thieves_tools: {
        id: 'thieves_tools',
        name: "Thieves' Tools",
        type: 'equipment',
        desc: 'For picking locks.',
        slot: 'accessory',
        equippable: true
      },
      healing_potion: {
        id: 'healing_potion',
        name: 'Healing Potion',
        type: 'consumable',
        desc: 'Restores 2d4+2 HP.',
        use: {
          effect: 'heal',
          formula: '2d4+2'
        }
      }
    },
    enemies: {
      pf2e_goblin: {
        name: 'Goblin Scout',
        hp: 16,
        ac: 16,
        atkBonus: 7,
        dmgRoll: '1d6',
        dmgBonus: 2,
        dex: 3
      }
    },
    npcs: {},
    quests: {},
    scenes: {
      start: {
        id: 'start',
        location: 'Создание персонажа',
        text: 'Welcome to a Pathfinder 2e adventure. Choose your path and create your hero.',
        choices: [
          { text: '⚔️ Play as Fighter', action: 'select_class:fighter' },
          { text: '🔮 Play as Wizard', action: 'select_class:wizard' },
          { text: '✝️ Play as Cleric', action: 'select_class:cleric' },
          { text: '🗡️ Play as Rogue', action: 'select_class:rogue' }
        ],
        dialogue: [],
        combat: null,
        flags: {},
        items: [],
        gold: 0
      },
      intro: {
        id: 'intro',
        location: 'Перекрёсток',
        text: 'Your journey starts at a crossroads under a grey sky. To the north — a ruined tower. To the east — a merchant caravan. To the west — whispers of a haunted forest.\n\nWelcome to Pathfinder 2e, {charName}.',
        choices: [
          { text: '🗼 Head to the ruined tower', to: 'tower_approach' },
          { text: '🏕️ Join the caravan', to: 'caravan' },
          { text: '🌲 Enter the haunted forest', to: 'forest' }
        ],
        dialogue: [],
        combat: null,
        flags: {},
        items: [],
        gold: 0
      },
      tower_approach: {
        id: 'tower_approach',
        location: 'Руины башни',
        text: 'The tower looms against the sky. Stones crumble. Something moves in the shadows.',
        choices: [
          { text: '⚔️ Draw weapon and enter', to: 'tower_fight' },
          {
            text: '🔍 Scout carefully (Stealth DC 17)',
            to: 'tower_sneak',
            skillCheck: {
              skill: 'stealth',
              dc: 17,
              successText: 'You slip in unseen.',
              failText: 'A guard spots you!',
              successNext: 'tower_interior',
              failNext: 'tower_fight'
            }
          },
          { text: '↩️ Return to crossroads', to: 'intro' }
        ],
        dialogue: [],
        combat: null,
        flags: {},
        items: [],
        gold: 0
      },
      tower_fight: {
        id: 'tower_fight',
        location: 'Руины башни — бой',
        text: 'A goblin scout leaps at you!',
        choices: [],
        dialogue: [],
        combat: ['pf2e_goblin'],
        nextScene: 'tower_interior',
        flags: {},
        items: [],
        gold: 0
      },
      tower_interior: {
        id: 'tower_interior',
        location: 'Внутренность башни',
        text: 'Inside the tower — dust, broken furniture, and a glimmering chest.',
        choices: [
          { text: '🎁 Open the chest', to: 'tower_chest' },
          { text: '↩️ Leave', to: 'intro' }
        ],
        dialogue: [],
        combat: null,
        flags: {},
        items: [],
        gold: 0
      },
      tower_chest: {
        id: 'tower_chest',
        location: 'Башня — сундук',
        text: 'The chest holds 25 gold pieces and a healing potion.',
        choices: [
          { text: '↩️ Return to crossroads', to: 'intro' }
        ],
        dialogue: [],
        combat: null,
        flags: {},
        items: ['healing_potion'],
        gold: 25
      },
      caravan: {
        id: 'caravan',
        location: 'Караван торговцев',
        text: 'The caravan leader greets you warmly. Trade and rest are available.',
        choices: [
          { text: '↩️ Return to crossroads', to: 'intro' }
        ],
        dialogue: [],
        combat: null,
        flags: {},
        items: [],
        gold: 0
      },
      forest: {
        id: 'forest',
        location: 'Зачарованный лес',
        text: 'Ancient trees whisper secrets. Shadows move between the trunks.',
        choices: [
          { text: '↩️ Return to crossroads', to: 'intro' }
        ],
        dialogue: [],
        combat: null,
        flags: {},
        items: [],
        gold: 0
      }
    },
    theme: { preset: 'dark_fantasy' },
    worldMap: {}
  };
}

if (typeof window !== 'undefined') {
  window.createPf2eStarterProject = createPf2eStarterProject;
}
