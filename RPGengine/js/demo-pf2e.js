// Inline demo data (file://) — data/demos/pf2e-mill.json
var DEMO_PF2E_DATA = {
  "meta": {
    "title": "Мельница на Тихой реке",
    "campaignId": "pf2e_mill",
    "dataVersion": "mill-1.0",
    "version": "1.0",
    "author": "RPGengine Demo",
    "description": "Деревня у реки, проклятая мельница и святилище фейри. Pathfinder 2e, уровни 1–10.",
    "system": "pf2e"
  },
  "system": "pf2e",
  "theme": {
    "id": "river_mill",
    "label": "Тихая река",
    "fonts": {
      "google": "Cinzel:wght@400;600|family=Crimson+Pro:ital,wght@0,400;0,600",
      "body": "'Crimson Pro', serif",
      "heading": "'Cinzel', serif"
    },
    "colors": {
      "pageBg": "#1e2a24",
      "paper": "#2d3b32",
      "paperDark": "#243028",
      "ink": "#e8efe6",
      "inkLight": "#b8c4b8",
      "accent": "#7cb87a",
      "accentLight": "#9ed49a",
      "danger": "#c75c5c",
      "success": "#5cbf8a",
      "border": "#4a5c50",
      "onAccent": "#1e2a24"
    }
  },
  "ui_hints": {
    "hp": "Здоровье. При 0 — вы теряете сознание.",
    "ac": "Класс брони (PF2e).",
    "atk": "Бонус атаки / точности.",
    "level": "Уровень персонажа (макс. 10).",
    "resource": "Ресурс класса или фокус.",
    "rest": "Отдых восстанавливает ОЗ и ресурсы.",
    "stat_str": "Сила — атлетика и урон.",
    "stat_dex": "Ловкость — уклонение, скрытность.",
    "stat_con": "Телосложение — ОЗ и стойкость.",
    "stat_int": "Интеллект — аркана, общество.",
    "stat_wis": "Мудрость — религия, природа, медицина.",
    "stat_cha": "Харизма — дипломатия, обман."
  },
  "startingFlags": {
    "heard_mill_rumor": false,
    "mill_gear_checked": false,
    "has_journal": false,
    "runes_decoded": false,
    "balance_restored": false,
    "shrine_destroyed": false,
    "thomas_saved": false,
    "merchant_quest_offered": false
  },
  "reputation": {},
  "statusEffects": {
    "poison": {
      "id": "poison",
      "label": "Яд",
      "type": "dot",
      "value": "1d4",
      "attribute": "hp"
    },
    "bleed": {
      "id": "bleed",
      "label": "Кровотечение",
      "type": "dot",
      "value": "1d6",
      "attribute": "hp"
    },
    "regen": {
      "id": "regen",
      "label": "Регенерация",
      "type": "hot",
      "value": "1d4",
      "attribute": "hp"
    },
    "weakened": {
      "id": "weakened",
      "label": "Ослабление",
      "type": "stat_mod",
      "attribute": "atkBonus",
      "value": -2
    },
    "fortified": {
      "id": "fortified",
      "label": "Укрепление",
      "type": "stat_mod",
      "attribute": "ac",
      "value": 2
    },
    "stun": {
      "id": "stun",
      "label": "Оглушение",
      "type": "stun",
      "duration": 1
    }
  },
  "enemyScaling": {
    "enabled": true,
    "hpRatePerLevel": 0.12,
    "bossHpRatePerLevel": 0.2,
    "atkBonusPerEvenLevel": 1,
    "acBonuses": [
      {
        "playerLevel": 3,
        "bonus": 1
      },
      {
        "playerLevel": 6,
        "bonus": 1
      },
      {
        "playerLevel": 9,
        "bonus": 1
      }
    ]
  },
  "progression": {
    "enabled": true,
    "maxLevel": 10,
    "expTable": [
      0,
      80,
      180,
      320,
      500,
      750,
      1100,
      1550,
      2100,
      2800
    ],
    "defaultHpGain": "1d8",
    "defaults": {
      "enemyExp": 30,
      "skillCheckExp": 15
    },
    "abilities": {
      "pf2e_sudden_charge": {
        "id": "pf2e_sudden_charge",
        "name": "Sudden Charge",
        "cost": 2,
        "icon": "🏃",
        "desc": "Stride twice, then Strike. (2 действия)",
        "combatOnly": true,
        "oncePerCombat": false,
        "effect": {
          "type": "custom",
          "message": "Вы стремительно бросаетесь в атаку!"
        },
        "usage": "combat",
        "type": "active"
      },
      "pf2e_power_attack": {
        "id": "pf2e_power_attack",
        "name": "Power Attack",
        "cost": 2,
        "icon": "🗡️",
        "desc": "Один Strike с дополнительным кубиком урона. (2 действия)",
        "combatOnly": true,
        "oncePerCombat": false,
        "effect": {
          "type": "damage",
          "value": "2d8",
          "targeting": {
            "scope": "single"
          }
        },
        "usage": "combat",
        "type": "active"
      },
      "pf2e_reactive_strike": {
        "id": "pf2e_reactive_strike",
        "name": "Reactive Strike",
        "cost": 0,
        "icon": "⚡",
        "desc": "Реакция: бесплатный Strike по врагу, спровоцировавшему реакцию.",
        "combatOnly": true,
        "oncePerCombat": false,
        "effect": {
          "type": "custom",
          "message": "Вы мгновенно контратакуете!"
        },
        "usage": "combat",
        "type": "active"
      },
      "pf2e_twin_parry": {
        "id": "pf2e_twin_parry",
        "name": "Twin Parry",
        "cost": 1,
        "icon": "🛡️",
        "desc": "+1 КД до начала следующего хода (требуется два оружия). (1 действие)",
        "combatOnly": true,
        "oncePerCombat": false,
        "effect": {
          "type": "buff",
          "buffType": "ac",
          "value": 1,
          "targeting": {
            "scope": "self"
          }
        },
        "usage": "combat",
        "type": "active"
      },
      "pf2e_brutal_finish": {
        "id": "pf2e_brutal_finish",
        "name": "Brutal Finish",
        "cost": 2,
        "icon": "💀",
        "desc": "Strike с дополнительным кубиком урона. Если промах — получаете усталость. (2 действия)",
        "combatOnly": true,
        "oncePerCombat": false,
        "effect": {
          "type": "damage",
          "value": "2d10",
          "targeting": {
            "scope": "single"
          }
        },
        "usage": "combat",
        "type": "active"
      },
      "pf2e_intimidating_glare": {
        "id": "pf2e_intimidating_glare",
        "name": "Intimidating Glare",
        "type": "passive",
        "icon": "👁️",
        "desc": "Demoralize не требует языка и работает на всех видимых врагов.",
        "passive": {},
        "usage": "both"
      },
      "pf2e_attack_of_opportunity": {
        "id": "pf2e_attack_of_opportunity",
        "name": "Attack of Opportunity",
        "type": "passive",
        "icon": "⚔️",
        "desc": "Вы можете использовать Reactive Strike как реакцию.",
        "passive": {},
        "usage": "both"
      },
      "pf2e_twin_feint": {
        "id": "pf2e_twin_feint",
        "name": "Twin Feint",
        "cost": 2,
        "icon": "🎭",
        "desc": "Два Strike; цель flat-footed для второго удара. (2 действия)",
        "combatOnly": true,
        "oncePerCombat": false,
        "effect": {
          "type": "extra_attack"
        },
        "usage": "combat",
        "type": "active"
      },
      "pf2e_nimble_dodge": {
        "id": "pf2e_nimble_dodge",
        "name": "Nimble Dodge",
        "cost": 0,
        "icon": "💨",
        "desc": "Реакция: +2 КД против одной атаки.",
        "combatOnly": true,
        "oncePerCombat": false,
        "effect": {
          "type": "buff",
          "buffType": "ac",
          "value": 2,
          "targeting": {
            "scope": "self"
          }
        },
        "usage": "combat",
        "type": "active"
      },
      "pf2e_mobility": {
        "id": "pf2e_mobility",
        "name": "Mobility",
        "cost": 1,
        "icon": "🏃",
        "desc": "Stride без провокации реакций. (1 действие)",
        "combatOnly": true,
        "oncePerCombat": false,
        "effect": {
          "type": "custom",
          "message": "Вы проскальзываете мимо врагов."
        },
        "usage": "combat",
        "type": "active"
      },
      "pf2e_gang_up": {
        "id": "pf2e_gang_up",
        "name": "Gang Up",
        "type": "passive",
        "icon": "👥",
        "desc": "Цель считается flat-footed, если рядом 2 союзника.",
        "passive": {},
        "usage": "both"
      },
      "pf2e_minor_magic": {
        "id": "pf2e_minor_magic",
        "name": "Minor Magic",
        "cost": 0,
        "icon": "✨",
        "desc": "Вы знаете 2 cantrip'а (например, Light, Mage Hand).",
        "combatOnly": false,
        "oncePerCombat": false,
        "effect": {
          "type": "custom",
          "message": "Магическая искра."
        },
        "usage": "both",
        "type": "active"
      },
      "pf2e_surprise_attack": {
        "id": "pf2e_surprise_attack",
        "name": "Surprise Attack",
        "type": "passive",
        "icon": "🎯",
        "desc": "В первом раунде боя враги flat-footed против ваших атак.",
        "passive": {},
        "usage": "combat"
      },
      "pf2e_healing_font": {
        "id": "pf2e_healing_font",
        "name": "Healing Font",
        "spellLevel": 1,
        "cost": 1,
        "icon": "💚",
        "desc": "Дополнительная ячейка Heal 1-го круга. (Focus Point)",
        "combatOnly": false,
        "oncePerCombat": false,
        "effect": {
          "type": "heal",
          "value": "1d8",
          "targeting": {
            "scope": "single"
          }
        },
        "usage": "both",
        "type": "active"
      },
      "pf2e_channel_smite": {
        "id": "pf2e_channel_smite",
        "name": "Channel Smite",
        "cost": 2,
        "icon": "☀️",
        "desc": "Strike + 1d8 radiant/necrotic. (2 действия)",
        "combatOnly": true,
        "oncePerCombat": false,
        "effect": {
          "type": "smite",
          "value": "1d8"
        },
        "usage": "combat",
        "type": "active"
      },
      "pf2e_turn_undead_pf2e": {
        "id": "pf2e_turn_undead_pf2e",
        "name": "Turn Undead",
        "spellLevel": 1,
        "cost": 2,
        "icon": "✨",
        "desc": "Нежить в 30 футах: Will save или Fleeing 1. (2 действия)",
        "combatOnly": true,
        "oncePerCombat": false,
        "effect": {
          "type": "damage",
          "value": "2d8",
          "damageType": "radiant",
          "targeting": {
            "scope": "all_enemies"
          }
        },
        "usage": "combat",
        "type": "active"
      },
      "pf2e_bless_pf2e": {
        "id": "pf2e_bless_pf2e",
        "name": "Bless",
        "spellLevel": 1,
        "cost": 2,
        "icon": "🙏",
        "concentration": true,
        "desc": "Концентрация. Союзники в 30 футах: +1 status bonus к атакам. (2 действия)",
        "combatOnly": true,
        "oncePerCombat": false,
        "effect": {
          "type": "buff",
          "buffType": "atk",
          "value": 1,
          "targeting": {
            "scope": "self"
          }
        },
        "usage": "combat",
        "type": "active"
      },
      "pf2e_magic_weapon": {
        "id": "pf2e_magic_weapon",
        "name": "Magic Weapon",
        "spellLevel": 1,
        "cost": 2,
        "icon": "🗡️",
        "desc": "Оружие становится +1 striking на 1 минуту. (2 действия)",
        "combatOnly": true,
        "oncePerCombat": false,
        "effect": {
          "type": "buff",
          "buffType": "dmg",
          "value": 1,
          "targeting": {
            "scope": "self"
          }
        },
        "usage": "combat",
        "type": "active"
      },
      "pf2e_restorative_touch": {
        "id": "pf2e_restorative_touch",
        "name": "Restorative Touch",
        "spellLevel": 1,
        "cost": 2,
        "icon": "💛",
        "desc": "Убирает один condition: blinded, deafened, etc. (2 действия)",
        "combatOnly": false,
        "oncePerCombat": false,
        "effect": {
          "type": "custom",
          "message": "Божественная энергия снимает недуг."
        },
        "usage": "both",
        "type": "active"
      },
      "pf2e_shield_cantrip": {
        "id": "pf2e_shield_cantrip",
        "name": "Shield (Cantrip)",
        "spellLevel": 0,
        "cost": 1,
        "icon": "🛡️",
        "desc": "+1 КД до начала следующего хода. (1 действие)",
        "combatOnly": true,
        "oncePerCombat": false,
        "effect": {
          "type": "buff",
          "buffType": "ac",
          "value": 1,
          "targeting": {
            "scope": "self"
          }
        },
        "usage": "combat",
        "type": "active"
      },
      "pf2e_electric_arc": {
        "id": "pf2e_electric_arc",
        "name": "Electric Arc",
        "spellLevel": 1,
        "cost": 2,
        "icon": "⚡",
        "desc": "Молния между 2 целями. 2d12 электричества (Reflex save). (2 действия)",
        "combatOnly": true,
        "oncePerCombat": false,
        "effect": {
          "type": "damage",
          "value": "2d12",
          "damageType": "lightning",
          "targeting": {
            "scope": "all_enemies"
          }
        },
        "usage": "combat",
        "type": "active"
      },
      "pf2e_detect_magic_pf2e": {
        "id": "pf2e_detect_magic_pf2e",
        "name": "Detect Magic",
        "spellLevel": 0,
        "cost": 2,
        "icon": "👁️",
        "desc": "Обнаружение магических аур в 30 футах. (2 действия)",
        "combatOnly": false,
        "oncePerCombat": false,
        "effect": {
          "type": "detect_magic"
        },
        "usage": "exploration",
        "type": "active"
      },
      "pf2e_mage_hand": {
        "id": "pf2e_mage_hand",
        "name": "Mage Hand",
        "spellLevel": 0,
        "cost": 2,
        "icon": "🤚",
        "desc": "Призрачная рука перемещает предметы до 5 фунтов. (2 действия)",
        "combatOnly": false,
        "oncePerCombat": false,
        "effect": {
          "type": "custom",
          "message": "Призрачная рука выполняет вашу волю."
        },
        "usage": "both",
        "type": "active"
      },
      "pf2e_light": {
        "id": "pf2e_light",
        "name": "Light",
        "spellLevel": 0,
        "cost": 2,
        "icon": "💡",
        "desc": "Яркий свет в радиусе 20 футов. Длительность до следующего отдыха.",
        "combatOnly": false,
        "oncePerCombat": false,
        "effect": {
          "type": "custom",
          "message": "Предмет озаряется ярким светом."
        },
        "usage": "both",
        "type": "active"
      },
      "pf2e_shield_cantrip_pf2e": {
        "id": "pf2e_shield_cantrip_pf2e",
        "name": "Shield (Cantrip)",
        "spellLevel": 0,
        "cost": 1,
        "icon": "🛡️",
        "desc": "+1 КД до начала следующего хода. (1 действие)",
        "combatOnly": true,
        "oncePerCombat": false,
        "effect": {
          "type": "buff",
          "buffType": "ac",
          "value": 1,
          "targeting": {
            "scope": "self"
          }
        },
        "usage": "combat",
        "type": "active"
      },
      "pf2e_spell_substitution": {
        "id": "pf2e_spell_substitution",
        "name": "Spell Substitution",
        "type": "passive",
        "icon": "🔄",
        "desc": "Можете заменить подготовленное заклинание за 10 минут.",
        "passive": {},
        "usage": "both"
      },
      "pf2e_hunt_prey": {
        "id": "pf2e_hunt_prey",
        "name": "Hunt Prey",
        "desc": "Отметьте добычу.",
        "type": "passive"
      },
      "pf2e_animal_companion": {
        "id": "pf2e_animal_companion",
        "name": "Animal Companion",
        "desc": "Спутник-зверь.",
        "type": "passive"
      },
      "pf2e_hunters_edge": {
        "id": "pf2e_hunters_edge",
        "name": "Hunter's Edge",
        "desc": "Бонус урона по добыче.",
        "type": "passive"
      },
      "pf2e_wild_shape": {
        "id": "pf2e_wild_shape",
        "name": "Wild Shape",
        "desc": "Превращение в зверя (PF2e).",
        "type": "active",
        "cost": 2
      },
      "pf2e_storm_order": {
        "id": "pf2e_storm_order",
        "name": "Storm Order",
        "desc": "Стихийные заклинания.",
        "type": "passive"
      },
      "pf2e_goodberry": {
        "id": "pf2e_goodberry",
        "name": "Goodberry",
        "desc": "Ягоды исцеления.",
        "type": "active",
        "cost": 2
      },
      "pf2e_heal_animal": {
        "id": "pf2e_heal_animal",
        "name": "Heal Animal",
        "desc": "Лечение спутника.",
        "type": "active",
        "cost": 1
      }
    }
  },
  "races": {
    "human": {
      "id": "human",
      "system": "pf2e",
      "name": "Человек",
      "icon": "🧑",
      "description": "Универсальные и амбициозные. Два свободных буста характеристик.",
      "abilityBoosts": [
        "free",
        "free"
      ],
      "speed": 25,
      "hp": 8,
      "size": "medium",
      "heritages": [
        {
          "id": "versatile",
          "name": "Универсальный",
          "desc": "Общая черта 1-го уровня на выбор."
        },
        {
          "id": "half_elf",
          "name": "Полуэльф",
          "desc": "Тренирован в Дипломатии или Скрытности."
        },
        {
          "id": "half_orc_heritage",
          "name": "Полуорк",
          "desc": "Тренирован в Запугивании или Атлетике."
        }
      ],
      "traits": [
        {
          "id": "human_natural_ambition",
          "name": "Природная амбиция",
          "desc": "+1 к проверкам характеристик для получения опыта.",
          "type": "passive"
        }
      ],
      "languages": [
        "Общий"
      ]
    },
    "elf": {
      "id": "elf",
      "system": "pf2e",
      "name": "Эльф",
      "icon": "🧝",
      "description": "Грациозные и долгоживущие. Бусты ЛОВ, ИНТ и свободный.",
      "abilityBoosts": [
        "dex",
        "int",
        "free"
      ],
      "speed": 30,
      "hp": 6,
      "size": "medium",
      "heritages": [
        {
          "id": "ancient",
          "name": "Древний",
          "desc": "Тренирован в Аркане."
        },
        {
          "id": "woodland",
          "name": "Лесной",
          "desc": "Игнорируете сложную местность в лесу."
        },
        {
          "id": "whisper",
          "name": "Шёпот",
          "desc": "Тренирован в Скрытности."
        }
      ],
      "traits": [
        {
          "id": "low_light_vision_elf",
          "name": "Ночное зрение",
          "desc": "Видите в тусклом свете как при ярком.",
          "type": "passive"
        },
        {
          "id": "elven_immunities",
          "name": "Эльфийский иммунитет",
          "desc": "Иммунитет к магическому сну.",
          "type": "resistance"
        }
      ],
      "languages": [
        "Общий",
        "Эльфийский"
      ],
      "abilityFlaws": [
        "con"
      ]
    },
    "dwarf": {
      "id": "dwarf",
      "system": "pf2e",
      "name": "Дварф",
      "icon": "⛏️",
      "description": "Крепкие и стойкие. Бусты ТЕЛ, МУД и свободный.",
      "abilityBoosts": [
        "con",
        "wis",
        "free"
      ],
      "speed": 20,
      "hp": 10,
      "size": "medium",
      "heritages": [
        {
          "id": "ancient_forge",
          "name": "Древняя кузня",
          "desc": "Тренирован в Ремесле."
        },
        {
          "id": "forge",
          "name": "Кузнечный",
          "desc": "Сопротивление огню 1."
        },
        {
          "id": "stronghold",
          "name": "Крепость",
          "desc": "+1 к спасброскам от яда."
        }
      ],
      "traits": [
        {
          "id": "darkvision_dwarf",
          "name": "Тёмное зрение",
          "desc": "Видите в темноте как в тусклом свете.",
          "type": "passive"
        },
        {
          "id": "dwarven_toughness",
          "name": "Дварфская стойкость",
          "desc": "+1 к спасброскам от ядов.",
          "type": "resistance"
        }
      ],
      "languages": [
        "Общий",
        "Дварфийский"
      ],
      "abilityFlaws": [
        "cha"
      ]
    },
    "halfling": {
      "id": "halfling",
      "system": "pf2e",
      "name": "Полурослик",
      "icon": "🌿",
      "description": "Маленькие, удачливые и отважные. Бусты ЛОВ, МУД и свободный.",
      "abilityBoosts": [
        "dex",
        "wis",
        "free"
      ],
      "speed": 25,
      "hp": 6,
      "size": "small",
      "heritages": [
        {
          "id": "hillheart",
          "name": "Холмовой",
          "desc": "Удача полурослика 1/день."
        },
        {
          "id": "nomadic",
          "name": "Кочевой",
          "desc": "Тренирован в Выживании."
        },
        {
          "id": "twilight",
          "name": "Сумеречный",
          "desc": "Ночное зрение."
        }
      ],
      "traits": [
        {
          "id": "keen_eyes",
          "name": "Острые глаза",
          "desc": "+2 к Восприятию для поиска скрытых существ.",
          "type": "passive"
        },
        {
          "id": "halfling_luck",
          "name": "Удача полурослика",
          "desc": "Раз в день перебросьте проваленную проверку.",
          "type": "active"
        }
      ],
      "languages": [
        "Общий",
        "Полуросликов"
      ],
      "abilityFlaws": [
        "str"
      ]
    },
    "gnome": {
      "id": "gnome",
      "system": "pf2e",
      "name": "Гном",
      "icon": "🎭",
      "description": "Любопытные и магические. Бусты ТЕЛ, ХАР и свободный.",
      "abilityBoosts": [
        "con",
        "cha",
        "free"
      ],
      "speed": 20,
      "hp": 8,
      "size": "small",
      "heritages": [
        {
          "id": "chameleon",
          "name": "Хамелеон",
          "desc": "Тренирован в Скрытности."
        },
        {
          "id": "sensate",
          "name": "Чувствительный",
          "desc": "Тренирован в Обществе."
        },
        {
          "id": "umbral",
          "name": "Сумеречный",
          "desc": "Тёмное зрение."
        }
      ],
      "traits": [
        {
          "id": "low_light_vision_gnome",
          "name": "Ночное зрение",
          "desc": "Видите в тусклом свете как при ярком.",
          "type": "passive"
        },
        {
          "id": "gnome_obsession",
          "name": "Гномья одержимость",
          "desc": "+1 к проверкам знаний по выбранной теме.",
          "type": "passive"
        }
      ],
      "languages": [
        "Общий",
        "Гномий",
        "Сильван"
      ],
      "abilityFlaws": [
        "str"
      ]
    },
    "half_orc": {
      "id": "half_orc",
      "system": "pf2e",
      "name": "Полуорк",
      "icon": "💪",
      "description": "Сила и выносливость. Два свободных буста.",
      "abilityBoosts": [
        "free",
        "free"
      ],
      "speed": 25,
      "hp": 8,
      "size": "medium",
      "heritages": [
        {
          "id": "orc_blooded",
          "name": "Орочья кровь",
          "desc": "Тренирован в Запугивании."
        },
        {
          "id": "human_blooded",
          "name": "Человеческая кровь",
          "desc": "Тренирован в Дипломатии."
        }
      ],
      "traits": [
        {
          "id": "low_light_half_orc",
          "name": "Ночное зрение",
          "desc": "Видите в тусклом свете.",
          "type": "passive"
        }
      ],
      "languages": [
        "Общий",
        "Орочий"
      ]
    }
  },
  "classes": {
    "fighter": {
      "system": "pf2e",
      "name": "Воин",
      "icon": "⚔️",
      "hp": 20,
      "ac": 18,
      "atkBonus": 7,
      "dmgRoll": "1d8",
      "dmgBonus": 4,
      "initBonus": 3,
      "stats": {
        "str": 18,
        "dex": 14,
        "con": 14,
        "int": 10,
        "wis": 12,
        "cha": 10
      },
      "skills": "",
      "keyAbility": "str",
      "fixedSkills": [
        "athletics"
      ],
      "skillChoices": {
        "count": 3,
        "from": [
          "acrobatics",
          "intimidation",
          "medicine",
          "survival",
          "crafting"
        ],
        "rank": "trained"
      },
      "resource": {
        "name": "Actions",
        "max": 3,
        "desc": "3 действия за ход. Тратятся на атаки, движения, способности."
      },
      "mainWeapon": "longsword",
      "startingItems": [
        "longsword",
        "chainmail_pf2e",
        "shield_pf2e"
      ],
      "armorProficiency": "trained",
      "level1BonusChoices": [
        "pf2e_sudden_charge",
        "pf2e_power_attack",
        "pf2e_reactive_strike",
        "pf2e_twin_parry",
        "pf2e_brutal_finish"
      ],
      "abilities": [
        {
          "id": "pf2e_strike",
          "name": "Strike",
          "cost": 1,
          "icon": "⚔️",
          "desc": "Совершите одну атаку оружием. (1 действие)",
          "combatOnly": true,
          "oncePerCombat": false,
          "effect": {
            "type": "custom",
            "message": "Вы наносите удар!"
          },
          "usage": "combat",
          "type": "active"
        },
        {
          "id": "pf2e_raise_shield",
          "name": "Raise a Shield",
          "cost": 1,
          "icon": "🛡️",
          "desc": "+2 КД до начала вашего следующего хода. (1 действие)",
          "combatOnly": true,
          "oncePerCombat": false,
          "effect": {
            "type": "buff",
            "buffType": "ac",
            "value": 2,
            "targeting": {
              "scope": "self"
            }
          },
          "usage": "combat",
          "type": "active"
        },
        {
          "id": "pf2e_demoralize",
          "name": "Demoralize",
          "cost": 1,
          "icon": "😠",
          "desc": "Запугайте врага (Intimidation vs Will DC). При успехе — Frightened 1. (1 действие)",
          "combatOnly": true,
          "oncePerCombat": false,
          "effect": {
            "type": "apply_status",
            "targeting": {
              "scope": "single"
            },
            "addEffect": {
              "id": "frightened",
              "duration": 1
            }
          },
          "usage": "combat",
          "type": "active"
        }
      ],
      "progression": {
        "hpGain": "1d10",
        "levels": {
          "2": {
            "choices": [
              "pf2e_sudden_charge",
              "pf2e_power_attack"
            ]
          },
          "3": {
            "choices": [
              "pf2e_reactive_strike",
              "pf2e_twin_parry",
              "pf2e_brutal_finish"
            ],
            "stats": {
              "atkBonus": 1
            }
          },
          "4": {
            "asi": true,
            "choices": [
              "pf2e_intimidating_glare",
              "pf2e_attack_of_opportunity"
            ]
          },
          "5": {
            "choices": [
              "pf2e_sudden_charge",
              "pf2e_power_attack",
              "pf2e_reactive_strike"
            ],
            "stats": {
              "atkBonus": 1
            }
          }
        }
      },
      "hpPerLevel": 10
    },
    "rogue": {
      "system": "pf2e",
      "name": "Плут",
      "icon": "🗡️",
      "hp": 16,
      "ac": 17,
      "atkBonus": 7,
      "dmgRoll": "1d6",
      "dmgBonus": 4,
      "initBonus": 4,
      "stats": {
        "str": 12,
        "dex": 18,
        "con": 12,
        "int": 14,
        "wis": 12,
        "cha": 12
      },
      "skills": "",
      "keyAbility": "dex",
      "fixedSkills": [
        "stealth",
        "thievery"
      ],
      "skillChoices": {
        "count": 4,
        "from": "any",
        "rank": "trained"
      },
      "resource": {
        "name": "Actions",
        "max": 3,
        "desc": "3 действия за ход. Sneak Attack срабатывает автоматически на flat-footed целях."
      },
      "mainWeapon": "shortsword",
      "startingItems": [
        "shortsword",
        "leather_armor_pf2e",
        "thieves_tools_pf2e"
      ],
      "armorProficiency": "trained",
      "level1BonusChoices": [
        "pf2e_twin_feint",
        "pf2e_nimble_dodge",
        "pf2e_mobility",
        "pf2e_gang_up",
        "pf2e_minor_magic"
      ],
      "abilities": [
        {
          "id": "pf2e_sneak_attack_passive",
          "name": "Sneak Attack",
          "type": "passive",
          "icon": "🎯",
          "desc": "+1d6 precision damage против flat-footed целей (автоматически).",
          "passive": {},
          "usage": "both"
        },
        {
          "id": "pf2e_take_cover",
          "name": "Take Cover",
          "cost": 1,
          "icon": "🏰",
          "desc": "+2 КД от дальних атак до конца хода. Требует укрытие. (1 действие)",
          "combatOnly": true,
          "oncePerCombat": false,
          "effect": {
            "type": "buff",
            "buffType": "ac",
            "value": 2,
            "targeting": {
              "scope": "self"
            }
          },
          "usage": "combat",
          "type": "active"
        },
        {
          "id": "pf2e_step",
          "name": "Step",
          "cost": 1,
          "icon": "👣",
          "desc": "Перемещение на 5 футов без провокации реакций. (1 действие)",
          "combatOnly": true,
          "oncePerCombat": false,
          "effect": {
            "type": "custom",
            "message": "Вы делаете осторожный шаг."
          },
          "usage": "combat",
          "type": "active"
        }
      ],
      "progression": {
        "hpGain": "1d8",
        "levels": {
          "2": {
            "choices": [
              "pf2e_twin_feint",
              "pf2e_nimble_dodge"
            ]
          },
          "3": {
            "choices": [
              "pf2e_mobility",
              "pf2e_gang_up",
              "pf2e_surprise_attack"
            ],
            "stats": {
              "atkBonus": 1
            }
          },
          "4": {
            "asi": true,
            "choices": [
              "pf2e_minor_magic",
              "pf2e_twin_feint"
            ]
          },
          "5": {
            "choices": [
              "pf2e_nimble_dodge",
              "pf2e_mobility",
              "pf2e_gang_up"
            ],
            "stats": {
              "atkBonus": 1
            }
          }
        }
      },
      "hpPerLevel": 8
    },
    "cleric": {
      "system": "pf2e",
      "spellcasting": true,
      "hasFocusPoints": true,
      "focusPoints": 1,
      "baseSlots": [
        2
      ],
      "name": "Жрец",
      "icon": "✝️",
      "hp": 16,
      "ac": 16,
      "atkBonus": 5,
      "dmgRoll": "1d6",
      "dmgBonus": 2,
      "initBonus": 1,
      "stats": {
        "str": 14,
        "dex": 12,
        "con": 14,
        "int": 10,
        "wis": 18,
        "cha": 12
      },
      "skills": "",
      "keyAbility": "wis",
      "fixedSkills": [
        "religion"
      ],
      "skillChoices": {
        "count": 2,
        "from": [
          "diplomacy",
          "intimidation",
          "medicine",
          "society"
        ],
        "rank": "trained"
      },
      "resource": {
        "name": "Focus Points",
        "max": 1,
        "desc": "Тратятся на фокус-заклинания. Восстанавливаются при Refocus (10 мин)."
      },
      "mainWeapon": "mace",
      "startingItems": [
        "mace",
        "chainmail_pf2e",
        "shield_pf2e",
        "holy_symbol_pf2e"
      ],
      "armorProficiency": "trained",
      "level1BonusChoices": [
        "pf2e_healing_font",
        "pf2e_channel_smite",
        "pf2e_turn_undead_pf2e",
        "pf2e_bless_pf2e",
        "pf2e_magic_weapon"
      ],
      "abilities": [
        {
          "id": "pf2e_heal_1action",
          "name": "Heal (1 action)",
          "spellLevel": 1,
          "cost": 1,
          "icon": "💚",
          "desc": "Касание. Восстанавливает 1d8 ОЗ. (1 действие)",
          "combatOnly": false,
          "oncePerCombat": false,
          "effect": {
            "type": "heal",
            "value": "1d8",
            "targeting": {
              "scope": "single"
            }
          },
          "usage": "both",
          "type": "active"
        },
        {
          "id": "pf2e_heal_2action",
          "name": "Heal (2 actions)",
          "spellLevel": 1,
          "cost": 2,
          "icon": "💚",
          "desc": "30 футов. Восстанавливает 1d8+8 ОЗ. (2 действия)",
          "combatOnly": false,
          "oncePerCombat": false,
          "effect": {
            "type": "heal",
            "value": "1d8+8",
            "targeting": {
              "scope": "single"
            }
          },
          "usage": "both",
          "type": "active"
        },
        {
          "id": "pf2e_divine_lance",
          "name": "Divine Lance",
          "spellLevel": 0,
          "cost": 2,
          "icon": "✨",
          "desc": "Луч святости/нечестия. 2d4 урона излучением/тьмой. (2 действия)",
          "combatOnly": true,
          "oncePerCombat": false,
          "effect": {
            "type": "damage",
            "value": "2d4",
            "damageType": "radiant",
            "targeting": {
              "scope": "single"
            }
          },
          "usage": "combat",
          "type": "active"
        }
      ],
      "progression": {
        "hpGain": "1d8",
        "levels": {
          "2": {
            "slots": [
              3
            ],
            "choices": [
              "pf2e_healing_font",
              "pf2e_channel_smite",
              "pf2e_bless_pf2e"
            ]
          },
          "3": {
            "slots": [
              4,
              2
            ],
            "choices": [
              "pf2e_turn_undead_pf2e",
              "pf2e_magic_weapon",
              "pf2e_restorative_touch"
            ],
            "stats": {
              "atkBonus": 1
            }
          },
          "4": {
            "slots": [
              4,
              3
            ],
            "asi": true,
            "choices": [
              "pf2e_healing_font",
              "pf2e_channel_smite"
            ]
          },
          "5": {
            "slots": [
              4,
              3,
              2
            ],
            "choices": [
              "pf2e_bless_pf2e",
              "pf2e_turn_undead_pf2e",
              "pf2e_magic_weapon"
            ]
          }
        }
      },
      "hpPerLevel": 8
    },
    "wizard": {
      "system": "pf2e",
      "spellcasting": true,
      "baseSlots": [
        2
      ],
      "name": "Волшебник",
      "icon": "🔮",
      "hp": 12,
      "ac": 12,
      "atkBonus": 4,
      "dmgRoll": "1d4",
      "dmgBonus": 0,
      "initBonus": 3,
      "stats": {
        "str": 10,
        "dex": 14,
        "con": 12,
        "int": 18,
        "wis": 14,
        "cha": 10
      },
      "skills": "",
      "keyAbility": "int",
      "fixedSkills": [
        "arcana"
      ],
      "skillChoices": {
        "count": 2,
        "from": [
          "diplomacy",
          "intimidation",
          "medicine",
          "nature",
          "occultism",
          "religion",
          "society"
        ],
        "rank": "trained"
      },
      "resource": {
        "name": "Spell Slots",
        "max": 2,
        "desc": "Prepared spell slots. Восстанавливаются при отдыхе."
      },
      "mainWeapon": "staff",
      "startingItems": [
        "staff",
        "mage_robe_pf2e",
        "spellbook_pf2e"
      ],
      "armorProficiency": "untrained",
      "level1BonusChoices": [
        "pf2e_electric_arc",
        "pf2e_shield_cantrip",
        "pf2e_detect_magic_pf2e",
        "pf2e_mage_hand",
        "pf2e_light"
      ],
      "abilities": [
        {
          "id": "pf2e_ignite",
          "name": "Ignition",
          "spellLevel": 0,
          "cost": 2,
          "icon": "🔥",
          "desc": "Огненный луч. 2d4 огня + persistent fire 1d4. (2 действия)",
          "combatOnly": true,
          "oncePerCombat": false,
          "effect": {
            "type": "damage",
            "value": "2d4",
            "damageType": "fire",
            "targeting": {
              "scope": "single"
            }
          },
          "usage": "combat",
          "type": "active"
        },
        {
          "id": "pf2e_telekinetic_projectile",
          "name": "Telekinetic Projectile",
          "spellLevel": 0,
          "cost": 2,
          "icon": "🪨",
          "desc": "Метните предмет. 1d6+mod INT урона. (2 действия)",
          "combatOnly": true,
          "oncePerCombat": false,
          "effect": {
            "type": "damage",
            "value": "1d6+4",
            "damageType": "physical",
            "targeting": {
              "scope": "single"
            }
          },
          "usage": "combat",
          "type": "active"
        },
        {
          "id": "pf2e_shield_cantrip",
          "name": "Shield (Cantrip)",
          "spellLevel": 0,
          "cost": 1,
          "icon": "🛡️",
          "desc": "+1 КД до начала следующего хода. (1 действие)",
          "combatOnly": true,
          "oncePerCombat": false,
          "effect": {
            "type": "buff",
            "buffType": "ac",
            "value": 1,
            "targeting": {
              "scope": "self"
            }
          },
          "usage": "combat",
          "type": "active"
        }
      ],
      "progression": {
        "hpGain": "1d6",
        "levels": {
          "2": {
            "slots": [
              3
            ],
            "choices": [
              "pf2e_electric_arc",
              "pf2e_shield_cantrip_pf2e"
            ]
          },
          "3": {
            "slots": [
              4,
              2
            ],
            "choices": [
              "pf2e_detect_magic_pf2e",
              "pf2e_mage_hand",
              "pf2e_light"
            ],
            "stats": {
              "atkBonus": 1
            }
          },
          "4": {
            "slots": [
              4,
              3
            ],
            "asi": true,
            "choices": [
              "pf2e_spell_substitution",
              "pf2e_electric_arc"
            ]
          },
          "5": {
            "slots": [
              4,
              3,
              2
            ],
            "choices": [
              "pf2e_electric_arc",
              "pf2e_shield_cantrip_pf2e",
              "pf2e_detect_magic_pf2e"
            ]
          }
        }
      },
      "hpPerLevel": 6
    },
    "ranger": {
      "system": "pf2e",
      "name": "Следопыт",
      "icon": "🏹",
      "hp": 18,
      "hpPerLevel": 10,
      "ac": 17,
      "atkBonus": 7,
      "dmgRoll": "1d8",
      "dmgBonus": 3,
      "initBonus": 4,
      "keyAbility": "dex",
      "stats": {
        "str": 14,
        "dex": 18,
        "con": 12,
        "int": 10,
        "wis": 14,
        "cha": 10
      },
      "fixedSkills": [
        "nature",
        "survival"
      ],
      "skillChoices": {
        "count": 3,
        "from": [
          "athletics",
          "stealth",
          "acrobatics",
          "medicine",
          "crafting",
          "intimidation"
        ],
        "rank": "trained"
      },
      "resource": {
        "name": "Фокус",
        "max": 1,
        "desc": "Очки фокуса для особых приёмов следопыта."
      },
      "mainWeapon": "shortbow",
      "startingItems": [
        "shortbow",
        "shortsword",
        "leather_armor",
        "rations",
        "healing_potion_minor"
      ],
      "armorProficiency": "trained",
      "level1BonusChoices": [
        "pf2e_hunt_prey",
        "pf2e_animal_companion",
        "pf2e_hunters_edge"
      ],
      "abilities": [
        {
          "id": "pf2e_strike",
          "name": "Strike",
          "cost": 1,
          "icon": "⚔️",
          "desc": "Атака оружием (1 действие).",
          "combatOnly": true,
          "effect": {
            "type": "custom",
            "message": "Вы наносите удар!"
          },
          "usage": "combat",
          "type": "active"
        },
        {
          "id": "pf2e_hunt_prey",
          "name": "Hunt Prey",
          "cost": 1,
          "icon": "🎯",
          "desc": "Отметьте добычу: +2 к Восприятию и Скрытности против неё.",
          "combatOnly": true,
          "effect": {
            "type": "buff",
            "buffType": "atkBonus",
            "value": 1,
            "targeting": {
              "scope": "self"
            }
          },
          "usage": "combat",
          "type": "active",
          "level": 1
        }
      ],
      "progression": {
        "hpGain": "1d10",
        "levels": {}
      }
    },
    "druid": {
      "system": "pf2e",
      "name": "Друид",
      "icon": "🌿",
      "hp": 16,
      "hpPerLevel": 8,
      "ac": 16,
      "atkBonus": 5,
      "dmgRoll": "1d4",
      "dmgBonus": 2,
      "initBonus": 3,
      "keyAbility": "wis",
      "spellcasting": true,
      "stats": {
        "str": 10,
        "dex": 12,
        "con": 14,
        "int": 12,
        "wis": 18,
        "cha": 10
      },
      "fixedSkills": [
        "nature"
      ],
      "skillChoices": {
        "count": 2,
        "from": [
          "medicine",
          "survival",
          "athletics",
          "religion",
          "occultism"
        ],
        "rank": "trained"
      },
      "resource": {
        "name": "Фокус",
        "max": 2,
        "desc": "Очки фокуса для заклинаний природы."
      },
      "mainWeapon": "sickle",
      "startingItems": [
        "sickle",
        "leather_armor",
        "healing_potion_minor",
        "antidote"
      ],
      "armorProficiency": "untrained",
      "spellSlots": {
        "1": {
          "current": 2,
          "max": 2
        }
      },
      "level1BonusChoices": [
        "pf2e_wild_shape",
        "pf2e_storm_order",
        "pf2e_goodberry"
      ],
      "abilities": [
        {
          "id": "pf2e_heal_1action",
          "name": "Heal",
          "cost": 1,
          "icon": "💚",
          "desc": "Исцеление 1d8 (1 действие).",
          "combatOnly": false,
          "effect": {
            "type": "heal",
            "dice": "1d8",
            "targeting": {
              "scope": "self"
            }
          },
          "usage": "both",
          "type": "active"
        },
        {
          "id": "pf2e_goodberry",
          "name": "Goodberry",
          "cost": 2,
          "icon": "🫐",
          "desc": "Создаёт ягоды лечения (2 действия).",
          "combatOnly": false,
          "effect": {
            "type": "heal",
            "dice": "1d4+1",
            "targeting": {
              "scope": "self"
            }
          },
          "usage": "both",
          "type": "active",
          "level": 1
        }
      ],
      "progression": {
        "hpGain": "1d8",
        "levels": {
          "2": {
            "choices": [
              "pf2e_wild_shape",
              "pf2e_storm_order"
            ]
          },
          "4": {
            "asi": true,
            "choices": [
              "pf2e_goodberry",
              "pf2e_heal_animal"
            ]
          }
        }
      }
    }
  },
  "items": {
    "shortsword": {
      "id": "shortsword",
      "name": "Короткий меч",
      "type": "weapon",
      "level": 0,
      "price": 9,
      "dmgRoll": "1d6",
      "stat": "str",
      "traits": [
        "agile",
        "finesse"
      ],
      "slot": "weapon"
    },
    "longsword": {
      "id": "longsword",
      "name": "Длинный меч",
      "type": "weapon",
      "hands": "one",
      "desc": "Обычный длинный меч. Урон 1к8 + мод. Силы.",
      "slot": "weapon",
      "damage": "1d8",
      "stat": "str",
      "soundHit": "slash_sword",
      "enhancement": 0,
      "enhancementMax": 3,
      "enhancementCost": [
        100,
        300,
        900
      ]
    },
    "dagger": {
      "id": "dagger",
      "name": "Кинжал",
      "type": "weapon",
      "hands": "one",
      "desc": "Лёгкое finesse-оружие. Урон 1к4 + мод. Ловкости.",
      "slot": "weapon",
      "damage": "1d4",
      "stat": "dex",
      "soundHit": "slash_sword"
    },
    "staff": {
      "id": "staff",
      "name": "Посох",
      "type": "weapon",
      "hands": "one",
      "desc": "Деревянный посох. Урон 1к6 + мод. Силы.",
      "slot": "weapon",
      "damage": "1d6",
      "stat": "str",
      "soundHit": "slash_staff"
    },
    "leather_armor": {
      "id": "leather_armor",
      "name": "Кожаный доспех",
      "type": "armor",
      "level": 0,
      "price": 20,
      "acBonus": 1,
      "desc": "Лёгкий доспех PF2e."
    },
    "chainmail_pf2e": {
      "id": "chainmail_pf2e",
      "name": "Chain Mail (PF2e)",
      "type": "armor",
      "desc": "AC +4, Dex cap +1, check penalty -2. Heavy armor.",
      "slot": "armor",
      "ac": 4,
      "dexCap": 1,
      "armorType": "heavy"
    },
    "shield_pf2e": {
      "id": "shield_pf2e",
      "name": "Wooden Shield (PF2e)",
      "type": "shield",
      "desc": "Hardness 3, HP 12. +2 AC when Raised.",
      "slot": "shield",
      "acBonus": 2
    },
    "healing_potion": {
      "name": "Зелье лечения",
      "type": "consumable",
      "desc": "Рубиновая жидкость в стеклянном флаконе. Восстанавливает 2к4+2 ОЗ.",
      "price": 20,
      "use": {
        "effect": "heal",
        "formula": "2d4+2",
        "target": "self"
      }
    },
    "rope": {
      "name": "Верёвка",
      "type": "equipment",
      "price": 10,
      "desc": "Пятнадцать футов крепкой пеньковой верёвки."
    },
    "torch": {
      "id": "torch",
      "name": "Факел",
      "type": "tool",
      "icon": "🔥",
      "stackable": true,
      "price": 2,
      "desc": "Горит около часа, освещает тёмные проходы."
    },
    "mill_journal": {
      "id": "mill_journal",
      "name": "Дневник мельника",
      "type": "misc",
      "desc": "Записи Томаса о странном шуме из подвала и «голосе реки»."
    },
    "fey_charm": {
      "id": "fey_charm",
      "name": "Оберег фейри",
      "type": "misc",
      "desc": "Светится у входа в святилище. +1 к спасброскам Will в зоне мельницы.",
      "equippable": true,
      "slot": "accessory"
    },
    "silver_dagger": {
      "id": "silver_dagger",
      "name": "Серебряный кинжал",
      "type": "weapon",
      "level": 2,
      "price": 40,
      "dmgRoll": "1d4",
      "stat": "dex",
      "traits": [
        "agile",
        "finesse",
        "silver"
      ],
      "desc": "Эффективен против фейри и нежити."
    },
    "runestone_fragment": {
      "id": "runestone_fragment",
      "name": "Осколок рунического камня",
      "type": "misc",
      "desc": "Нужен для квеста «Древние руны»."
    },
    "blessed_millstone_shard": {
      "id": "blessed_millstone_shard",
      "name": "Осколок освящённого жернова",
      "type": "misc",
      "desc": "Ключ к хорошей концовке — восстановление баланса."
    },
    "corrupted_idol": {
      "id": "corrupted_idol",
      "name": "Искажённый идол",
      "type": "misc",
      "desc": "Источник проклятия. Можно уничтожить для плохой концовки."
    },
    "healing_potion_minor": {
      "id": "healing_potion_minor",
      "name": "Малое зелье лечения",
      "type": "consumable",
      "level": 1,
      "price": 40,
      "effect": {
        "heal": "1d8"
      },
      "desc": "Восстанавливает 1d8 ОЗ."
    },
    "elixir_of_life": {
      "id": "elixir_of_life",
      "name": "Эликсир жизни",
      "type": "consumable",
      "level": 5,
      "price": 300,
      "effect": {
        "heal": "3d8+6",
        "temp_hp": 5
      },
      "desc": "Сильное исцеление и временные ОЗ."
    }
  },
  "enemies": {
    "fey_mite": {
      "name": "Жалкий фейри",
      "level": -1,
      "hp": 8,
      "ac": 15,
      "atkBonus": 5,
      "dmgRoll": "1d4",
      "dmgBonus": 2,
      "dex": 4,
      "exp": 20,
      "saves": {
        "fortitude": 2,
        "reflex": 4,
        "will": 0
      },
      "traits": [
        "fey",
        "chaotic",
        "small"
      ]
    },
    "fey_grig": {
      "name": "Григ",
      "level": 1,
      "hp": 20,
      "ac": 17,
      "atkBonus": 7,
      "dmgRoll": "1d4",
      "dmgBonus": 2,
      "dex": 6,
      "exp": 40,
      "saves": {
        "fortitude": 3,
        "reflex": 6,
        "will": 5
      },
      "traits": [
        "fey",
        "small"
      ]
    },
    "fey_pixie": {
      "name": "Пикси",
      "level": 1,
      "hp": 15,
      "ac": 16,
      "atkBonus": 6,
      "dmgRoll": "1d4",
      "dmgBonus": 0,
      "dex": 8,
      "exp": 40,
      "saves": {
        "fortitude": 1,
        "reflex": 8,
        "will": 6
      },
      "traits": [
        "fey",
        "tiny"
      ]
    },
    "drowned_spirit": {
      "name": "Утонувший дух",
      "level": 2,
      "hp": 30,
      "ac": 18,
      "atkBonus": 8,
      "dmgRoll": "1d6",
      "dmgBonus": 3,
      "dex": 3,
      "exp": 60,
      "dmgType": "cold",
      "saves": {
        "fortitude": 5,
        "reflex": 3,
        "will": 8
      },
      "traits": [
        "undead",
        "incorporeal"
      ]
    },
    "river_twigjack": {
      "name": "Речной твигджек",
      "level": 0,
      "hp": 14,
      "ac": 14,
      "atkBonus": 5,
      "dmgRoll": "1d6",
      "dmgBonus": 1,
      "dex": 3,
      "exp": 25,
      "traits": [
        "plant",
        "fey"
      ]
    },
    "bandit_scout": {
      "name": "Разведчик-бандит",
      "level": 1,
      "hp": 18,
      "ac": 15,
      "atkBonus": 6,
      "dmgRoll": "1d6",
      "dmgBonus": 2,
      "dex": 3,
      "exp": 35
    },
    "bandit_leader": {
      "name": "Главарь бандитов",
      "level": 2,
      "hp": 28,
      "ac": 17,
      "atkBonus": 8,
      "dmgRoll": "1d8",
      "dmgBonus": 3,
      "dex": 2,
      "exp": 70,
      "boss": true
    },
    "fey_lord": {
      "name": "Лорд Фейри Тихой реки",
      "level": 4,
      "hp": 60,
      "ac": 21,
      "atkBonus": 14,
      "dmgRoll": "1d6",
      "dmgBonus": 6,
      "dex": 10,
      "exp": 150,
      "boss": true,
      "saves": {
        "fortitude": 8,
        "reflex": 10,
        "will": 12
      },
      "traits": [
        "fey",
        "boss"
      ]
    },
    "animated_mill_gear": {
      "name": "Ожившая шестерня",
      "level": 1,
      "hp": 22,
      "ac": 16,
      "atkBonus": 7,
      "dmgRoll": "1d8",
      "dmgBonus": 2,
      "dex": 1,
      "exp": 35,
      "traits": [
        "construct"
      ]
    }
  },
  "npcs": {
    "innkeeper_ela": {
      "id": "innkeeper_ela",
      "name": "Эла",
      "icon": "🍺",
      "description": "Трактирщица «У трёх гусей».",
      "location": "Таверна"
    },
    "elder_borin": {
      "id": "elder_borin",
      "name": "Староста Борин",
      "icon": "👴",
      "description": "Глава деревни Горнистead.",
      "location": "Площадь"
    },
    "miller_thomas": {
      "id": "miller_thomas",
      "name": "Томас-мельник",
      "icon": "⚙️",
      "description": "Пропавший мельник.",
      "location": "Мельница"
    },
    "healer_mira": {
      "id": "healer_mira",
      "name": "Мира-целительница",
      "icon": "💚",
      "description": "Жрица местного святилища.",
      "location": "Часовня"
    },
    "merchant_finn": {
      "id": "merchant_finn",
      "name": "Финн-торговец",
      "icon": "🛒",
      "description": "Торговец на площади.",
      "location": "Площадь"
    },
    "stranger_veil": {
      "id": "stranger_veil",
      "name": "Странник в плаще",
      "icon": "🎭",
      "description": "Загадочный гость таверны.",
      "location": "Таверна"
    },
    "river_warden": {
      "id": "river_warden",
      "name": "Речной страж",
      "icon": "🌊",
      "description": "Дух реки, появляется у берега.",
      "location": "Берег"
    }
  },
  "quests": {
    "missing_miller": {
      "id": "missing_miller",
      "title": "Пропавший мельник",
      "giver": "innkeeper_ela",
      "description": "Мельница замолчала, Томас исчез. Расследуйте и найдите его.",
      "stages": {
        "0": {
          "log": "Эла просит проверить мельницу.",
          "hint": "Осмотрите деревню и мельницу.",
          "finish": false
        },
        "1": {
          "log": "Найдены следы борьбы в мельнице.",
          "hint": "Спуститесь в подвал.",
          "finish": false
        },
        "2": {
          "log": "Обнаружено святилище фейри под мельницей.",
          "hint": "Исследуйте святилище.",
          "finish": false
        },
        "3": {
          "log": "Томас найден.",
          "hint": "Восстановите баланс или уничтожьте угрозу.",
          "finish": false
        },
        "4": {
          "log": "Дело закрыто.",
          "hint": "",
          "finish": true
        }
      },
      "rewards": {
        "gold": 80,
        "exp": 200
      }
    },
    "merchant_trouble": {
      "id": "merchant_trouble",
      "title": "Торговец в беде",
      "giver": "merchant_finn",
      "description": "Бандиты перехватывают караваны на дороге к деревне.",
      "stages": {
        "0": {
          "log": "Финн просит разобраться с бандитами.",
          "hint": "Отправьтесь на опушку у дороги.",
          "finish": false
        },
        "1": {
          "log": "Бандиты разбиты.",
          "hint": "",
          "finish": true
        }
      },
      "rewards": {
        "gold": 40,
        "exp": 80
      }
    },
    "ancient_runes": {
      "id": "ancient_runes",
      "title": "Древние руны",
      "giver": "healer_mira",
      "description": "Расшифруйте руны в святилище и принесите осколок камня.",
      "stages": {
        "0": {
          "log": "Мира дала свиток для сопоставления.",
          "hint": "Осмотрите руны у входа в святилище.",
          "finish": false
        },
        "1": {
          "log": "Руны расшифрованы.",
          "hint": "Принесите осколок Мире.",
          "finish": false
        },
        "2": {
          "log": "Мира благодарит вас.",
          "hint": "",
          "finish": true
        }
      },
      "rewards": {
        "gold": 30,
        "exp": 60,
        "items": [
          "healing_potion_minor"
        ]
      }
    },
    "restore_balance": {
      "id": "restore_balance",
      "title": "Восстановление баланса",
      "giver": "river_warden",
      "description": "Верните жернов-оберег на алтарь или уничтожьте источник проклятия.",
      "stages": {
        "0": {
          "log": "Судьба святилища в ваших руках.",
          "hint": "Глубины святилища.",
          "finish": false
        },
        "1": {
          "log": "Баланс восстановлен.",
          "hint": "",
          "finish": true
        }
      },
      "rewards": {
        "gold": 50,
        "exp": 120
      }
    }
  },
  "actionChains": {
    "not_enough_gold": {
      "name": "Недостаточно золота",
      "steps": [
        {
          "action": "log",
          "params": {
            "message": "❌ Недостаточно золота.",
            "type": "danger"
          }
        }
      ]
    },
    "tavern_rest": {
      "name": "Отдых в трактире",
      "steps": [
        {
          "action": "check_gold",
          "params": {
            "amount": 5
          },
          "onFail": "not_enough_gold"
        },
        {
          "action": "remove_gold",
          "params": {
            "amount": 5
          }
        },
        {
          "action": "heal",
          "params": {
            "target": "self",
            "amount": "full",
            "restoreResources": true
          }
        },
        {
          "action": "log",
          "params": {
            "message": "🛏️ Вы хорошо отдохнули.",
            "type": "success"
          }
        },
        {
          "action": "refresh_ui"
        }
      ]
    },
    "tavern_buy_rations": {
      "name": "Купить провиант",
      "steps": [
        {
          "action": "check_gold",
          "params": {
            "amount": 2
          },
          "onFail": "not_enough_gold"
        },
        {
          "action": "remove_gold",
          "params": {
            "amount": 2
          }
        },
        {
          "action": "add_item",
          "params": {
            "itemId": "rations",
            "count": 1
          }
        },
        {
          "action": "log",
          "params": {
            "message": "🍞 Провиант куплен.",
            "type": "success"
          }
        },
        {
          "action": "refresh_ui"
        }
      ]
    },
    "tavern_rumors": {
      "name": "Слухи в таверне",
      "steps": [
        {
          "action": "say",
          "params": {
            "npcId": "innkeeper_ela",
            "text": "Мельник Томас три ночи назад кричал про «шёпот под жерновом». Утром его не было. Староста боится, что река «заберёт» ещё кого-то."
          }
        },
        {
          "action": "set_flag",
          "params": {
            "flag": "heard_mill_rumor",
            "value": true
          }
        },
        {
          "action": "refresh_ui"
        }
      ]
    },
    "investigate_mill": {
      "name": "Осмотр механизма",
      "steps": [
        {
          "action": "log",
          "params": {
            "message": "🔍 Шестерни заросли зелёным налётом. Ось сорвана — не от поломки, а от рывка изнутри.",
            "type": "info"
          }
        },
        {
          "action": "set_flag",
          "params": {
            "flag": "mill_gear_checked",
            "value": true
          }
        },
        {
          "action": "refresh_ui"
        }
      ]
    },
    "read_miller_journal": {
      "name": "Дневник мельника",
      "steps": [
        {
          "action": "add_item",
          "params": {
            "itemId": "mill_journal",
            "count": 1
          }
        },
        {
          "action": "log",
          "params": {
            "message": "📖 «Подвал… руны светятся. Я открыл проход — простите меня, река…»",
            "type": "info"
          }
        },
        {
          "action": "set_flag",
          "params": {
            "flag": "has_journal",
            "value": true
          }
        },
        {
          "action": "refresh_ui"
        }
      ]
    },
    "shrine_runes_check": {
      "name": "Расшифровка рун",
      "steps": [
        {
          "action": "skill_check",
          "params": {
            "skill": "arcana",
            "dc": 16,
            "successText": "Руны говорят о «договоре жернова и реки». Вы находите осколок.",
            "failText": "Символы плывут перед глазами. Нужен свиток Миры или повторная попытка."
          }
        },
        {
          "action": "add_item",
          "params": {
            "itemId": "runestone_fragment",
            "count": 1
          },
          "condition": {
            "flag": "runes_decoded"
          }
        },
        {
          "action": "set_flag",
          "params": {
            "flag": "runes_decoded",
            "value": true
          }
        },
        {
          "action": "refresh_ui"
        }
      ]
    },
    "healer_rest": {
      "name": "Лечение у Миры",
      "steps": [
        {
          "action": "check_gold",
          "params": {
            "amount": 15
          },
          "onFail": "not_enough_gold"
        },
        {
          "action": "remove_gold",
          "params": {
            "amount": 15
          }
        },
        {
          "action": "heal",
          "params": {
            "target": "self",
            "amount": "2d8+4",
            "restoreResources": true
          }
        },
        {
          "action": "log",
          "params": {
            "message": "💚 Мира снимает усталость и раны.",
            "type": "success"
          }
        },
        {
          "action": "refresh_ui"
        }
      ]
    },
    "restore_balance_ritual": {
      "name": "Ритуал баланса",
      "steps": [
        {
          "action": "set_flag",
          "params": {
            "flag": "balance_restored",
            "value": true
          }
        },
        {
          "action": "update_quest",
          "params": {
            "questId": "restore_balance",
            "stage": "1"
          }
        },
        {
          "action": "log",
          "params": {
            "message": "✨ Жернов встаёт на место. Река успокаивается.",
            "type": "success"
          }
        },
        {
          "action": "change_scene",
          "params": {
            "sceneId": "resolution_good"
          }
        }
      ]
    },
    "destroy_shrine": {
      "name": "Уничтожить идол",
      "steps": [
        {
          "action": "set_flag",
          "params": {
            "flag": "shrine_destroyed",
            "value": true
          }
        },
        {
          "action": "log",
          "params": {
            "message": "💥 Святилище рушится. Тишина… слишком мёртвая.",
            "type": "danger"
          }
        },
        {
          "action": "change_scene",
          "params": {
            "sceneId": "resolution_bad"
          }
        }
      ]
    }
  },
  "shops": {
    "finn_shop": {
      "id": "finn_shop",
      "name": "Лавка Финна",
      "buy": [
        {
          "itemId": "healing_potion_minor",
          "price": 45
        },
        {
          "itemId": "rations",
          "price": 3
        },
        {
          "itemId": "rope",
          "price": 5
        },
        {
          "itemId": "torch",
          "price": 1
        },
        {
          "itemId": "antidote",
          "price": 25
        },
        {
          "itemId": "silver_dagger",
          "price": 55
        }
      ],
      "sell": [
        {
          "itemId": "rations",
          "price": 1
        },
        {
          "itemId": "runestone_fragment",
          "price": 20
        }
      ]
    }
  },
  "scenes": {
    "start": {
      "id": "start",
      "location": "Дорога к Горнистead",
      "mapLocation": "village_gate",
      "text": "Тихая деревня у реки. Старая мельница стоит неподвижно, словно застыв во времени.\n\nСоздайте героя Pathfinder 2e (раса, класс 1–10), затем войдите в деревню.",
      "choices": [
        {
          "text": "🏘️ Войти в деревню",
          "to": "arrival"
        }
      ]
    },
    "arrival": {
      "id": "arrival",
      "location": "Деревня Горнистead",
      "mapLocation": "village_gate",
      "text": "Вы прибываете в тихую деревню у реки. Старый трактир «У трёх гусей» приветствует путников. На ветру — запах хлеба и сырой ивняк.",
      "choices": [
        {
          "text": "🏠 Зайти в трактир",
          "to": "tavern"
        },
        {
          "text": "🗺️ Осмотреть площадь",
          "to": "village_square"
        },
        {
          "text": "🌊 Пойти к реке",
          "to": "river_bank"
        }
      ]
    },
    "tavern": {
      "id": "tavern",
      "location": "Таверна «У трёх гусей»",
      "mapLocation": "tavern",
      "text": "В трактире тепло и шумно. Эла протирает кружки и кивает вам.",
      "exitScene": "village_square",
      "components": [
        {
          "component": "dialogue",
          "params": {
            "npc": "innkeeper_ela",
            "greeting": "Добро пожаловать, странник. Мельница молчит третий день — если не боитесь тьмы, сходите к Томасу.",
            "topics": [
              {
                "label": "Спросить о мельнике",
                "reply": "Томас спускался в подвал. Слышали крик — и всё."
              },
              {
                "label": "Кто такой странник в углу?",
                "reply": "Пришёл вчера. Говорит, что «река помнит договор»."
              }
            ]
          }
        },
        {
          "component": "service_menu",
          "params": {
            "header": "Услуги трактира",
            "services": [
              {
                "id": "rest",
                "type": "chain",
                "label": "Отдохнуть (5 зм)",
                "chain": "tavern_rest",
                "cost": {
                  "gold": 5
                }
              },
              {
                "id": "food",
                "type": "chain",
                "label": "Купить провиант (2 зм)",
                "chain": "tavern_buy_rations"
              },
              {
                "id": "rumors",
                "type": "chain",
                "label": "Послушать слухи",
                "chain": "tavern_rumors"
              }
            ]
          }
        }
      ],
      "choices": [
        {
          "text": "📋 Взять поручение о мельнике",
          "to": "tavern",
          "questSet": {
            "questId": "missing_miller",
            "stage": "0"
          },
          "once": true
        },
        {
          "text": "🚪 На площадь",
          "to": "village_square"
        }
      ]
    },
    "village_square": {
      "id": "village_square",
      "location": "Площадь деревни",
      "mapLocation": "square",
      "text": "Доска объявлений, лавка Финна и суровый староста Борин. На севере виднеется мельница.",
      "components": [
        {
          "component": "dialogue",
          "params": {
            "npc": "elder_borin",
            "greeting": "Путник, не время для праздников. Мельница стоит — хлеб дорожает.",
            "topics": [
              {
                "label": "Что случилось?",
                "reply": "Томас пропал. Река воняет гнилью у колеса."
              }
            ]
          }
        },
        {
          "component": "trade_interface",
          "params": {
            "npc": "merchant_finn",
            "shopId": "finn_shop",
            "greeting": "Зелья, верёвки, факелы — берите, пока не стемнело."
          }
        }
      ],
      "choices": [
        {
          "text": "⚔️ Помочь Финну с бандитами",
          "to": "bandit_ambush",
          "questSet": {
            "questId": "merchant_trouble",
            "stage": "0"
          },
          "showIf": {
            "flag": "merchant_quest_offered",
            "equals": false
          }
        },
        {
          "text": "💚 Часовня Миры",
          "to": "healer_shrine"
        },
        {
          "text": "🌾 К мельнице",
          "to": "mill_approach"
        },
        {
          "text": "🏠 В трактир",
          "to": "tavern"
        }
      ]
    },
    "healer_shrine": {
      "id": "healer_shrine",
      "location": "Часовня целительницы",
      "text": "Мира молится у алтаря. «Под мельницей — старое святилище. Руны нужно читать осторожно».",
      "components": [
        {
          "component": "service_menu",
          "params": {
            "header": "Услуги Миры",
            "services": [
              {
                "id": "heal",
                "type": "chain",
                "label": "Лечение (15 зм)",
                "chain": "healer_rest"
              },
              {
                "id": "runes_quest",
                "type": "action",
                "label": "Квест: древние руны",
                "action": "set_flag",
                "actionParams": {
                  "flag": "runes_quest_active",
                  "value": true
                }
              }
            ]
          }
        }
      ],
      "choices": [
        {
          "text": "📜 Принять квест рун",
          "to": "healer_shrine",
          "questSet": {
            "questId": "ancient_runes",
            "stage": "0"
          },
          "once": true
        },
        {
          "text": "← На площадь",
          "to": "village_square"
        }
      ]
    },
    "river_bank": {
      "id": "river_bank",
      "location": "Берег Тихой реки",
      "mapLocation": "river",
      "text": "Вода мутная, пена зеленоватая. У мостка — следы босых ног и мокрый оберег.",
      "choices": [
        {
          "text": "🔍 Осмотреть оберег",
          "to": "river_bank",
          "grantItems": [
            "fey_charm"
          ],
          "once": true
        },
        {
          "text": "🌾 К мельнице",
          "to": "mill_approach"
        },
        {
          "text": "🏘️ В деревню",
          "to": "arrival"
        }
      ]
    },
    "bandit_ambush": {
      "id": "bandit_ambush",
      "location": "Опушка у дороги",
      "text": "Бандиты перегораживают тропу! «Кошелёк или жизнь!»",
      "combat": [
        "bandit_scout",
        "bandit_scout",
        "bandit_leader"
      ],
      "nextScene": "village_square",
      "choices": [
        {
          "text": "⚔️ Бой",
          "to": "combat",
          "combat": true
        }
      ]
    },
    "mill_approach": {
      "id": "mill_approach",
      "location": "Подход к мельнице",
      "text": "Запах гнили и застоявшейся воды. Колесо не двигается. Внутри — тишина, нарушаемая только капелью.",
      "choices": [
        {
          "text": "🚪 Войти в мельницу",
          "to": "mill_ground_floor"
        },
        {
          "text": "← В деревню",
          "to": "village_square"
        }
      ]
    },
    "mill_ground_floor": {
      "id": "mill_ground_floor",
      "location": "Мельница — первый этаж",
      "text": "Внутри пахнет плесенью. Механизм остановлен. На полу — царапины, будто тащили мешок к подвалу.",
      "components": [
        {
          "component": "interactive_panel",
          "params": {
            "label": "🔍 Осмотреть механизм",
            "chain": "investigate_mill"
          }
        }
      ],
      "choices": [
        {
          "text": "⬆️ На второй этаж",
          "to": "mill_upper_floor"
        },
        {
          "text": "⬇️ В подвал",
          "to": "mill_basement",
          "showIf": {
            "flag": "mill_gear_checked"
          }
        },
        {
          "text": "⬇️ В подвал (вслепую)",
          "to": "mill_basement"
        }
      ]
    },
    "mill_upper_floor": {
      "id": "mill_upper_floor",
      "location": "Мельница — верхний этаж",
      "text": "Пыльные мешки, остановленный вал. На столе — дневник Томаса.",
      "components": [
        {
          "component": "interactive_panel",
          "params": {
            "label": "📖 Прочитать дневник",
            "chain": "read_miller_journal"
          }
        }
      ],
      "choices": [
        {
          "text": "⬇️ Вниз",
          "to": "mill_ground_floor"
        }
      ]
    },
    "mill_basement": {
      "id": "mill_basement",
      "location": "Подвал мельницы",
      "text": "Сырость и фосфоресцирующий мох. За бочками — тайный проход, выбитый изнутри.",
      "combat": [
        "river_twigjack",
        "drowned_spirit"
      ],
      "nextScene": "shrine_entrance",
      "choices": [
        {
          "text": "⚔️ Отразить нападение",
          "to": "combat"
        },
        {
          "text": "🕳️ В проход святилища",
          "to": "shrine_entrance",
          "showIf": {
            "flag": "mill_basement_cleared"
          }
        }
      ]
    },
    "shrine_entrance": {
      "id": "shrine_entrance",
      "location": "Вход в святилище",
      "text": "Руны пульсируют мягким светом. Коридор уходит под русло реки.",
      "components": [
        {
          "component": "interactive_panel",
          "params": {
            "label": "📜 Расшифровать руны",
            "chain": "shrine_runes_check"
          }
        }
      ],
      "choices": [
        {
          "text": "➡️ В зал святилища",
          "to": "shrine_hall"
        },
        {
          "text": "← Подвал",
          "to": "mill_basement"
        }
      ]
    },
    "shrine_hall": {
      "id": "shrine_hall",
      "location": "Зал святилища",
      "text": "Зал освещён грибами. Из тени выходят крошечные фигуры — жадные глаза, звонкие смешки.",
      "combat": [
        "fey_mite",
        "fey_mite",
        "fey_grig",
        "fey_pixie"
      ],
      "nextScene": "shrine_depths",
      "choices": [
        {
          "text": "⚔️ Сразиться с фейри",
          "to": "combat"
        }
      ]
    },
    "shrine_depths": {
      "id": "shrine_depths",
      "location": "Глубины святилища",
      "text": "Алтарь из влажного камня. Лорд Фейри парит над искажённым жерновом. Томас связан корнями — жив, но слаб.",
      "combat": [
        "fey_lord"
      ],
      "nextScene": "shrine_depths_after",
      "choices": [
        {
          "text": "⚔️ Битва с лордом фейри",
          "to": "combat"
        }
      ]
    },
    "shrine_depths_after": {
      "id": "shrine_depths_after",
      "location": "Глубины — после боя",
      "text": "Лорд повержен. Жернов-оберег расколот. Томас шепчет: «Верните камень… или сожгите идол — но река запомнит».",
      "choices": [
        {
          "text": "🪨 Поднять осколок жернова",
          "to": "shrine_depths_after",
          "grantItems": [
            "blessed_millstone_shard"
          ],
          "once": true
        },
        {
          "text": "✨ Восстановить баланс (оберег)",
          "to": "resolution_good",
          "showIf": {
            "item": "blessed_millstone_shard"
          },
          "chain": "restore_balance_ritual"
        },
        {
          "text": "✨ Ритуал без осколка (Религия DC 18)",
          "to": "resolution_good",
          "skillCheck": {
            "skill": "religion",
            "dc": 18,
            "successNext": "resolution_good",
            "failNext": "shrine_depths_after",
            "successText": "Вы проводите ритуал силой веры.",
            "failText": "Силы не хватает — нужен осколок или помощь Миры."
          }
        },
        {
          "text": "💥 Уничтожить идол",
          "to": "resolution_bad",
          "chain": "destroy_shrine",
          "grantItems": [
            "corrupted_idol"
          ]
        },
        {
          "text": "🆓 Освободить Томаса",
          "to": "resolution_good",
          "flags": {
            "thomas_saved": true
          }
        }
      ]
    },
    "resolution_good": {
      "id": "resolution_good",
      "location": "Мельница восстановлена",
      "text": "Жернов снова вращается. Река сияет чистой полосой. Томас благодарит вас; Эла готовит пир.",
      "choices": [
        {
          "text": "📖 Эпилог",
          "to": "epilogue",
          "questSet": {
            "questId": "missing_miller",
            "stage": "4"
          }
        }
      ]
    },
    "resolution_bad": {
      "id": "resolution_bad",
      "location": "Мельница мертва",
      "text": "Святилище разрушено. Мельница не заработает — зато угроза устранена. Деревня спасена ценой договора с рекой.",
      "choices": [
        {
          "text": "📖 Эпилог",
          "to": "epilogue",
          "questSet": {
            "questId": "missing_miller",
            "stage": "4"
          },
          "flags": {
            "dark_ending": true
          }
        }
      ]
    },
    "epilogue": {
      "id": "epilogue",
      "location": "Горнистead — через неделю",
      "text": "Вас помнят как героя Тихой реки. Награды собраны, шрамы зажили. Кампания завершена — спасибо за игру!",
      "choices": [
        {
          "text": "🔄 Новая игра",
          "action": "restart"
        }
      ]
    }
  },
  "worldMap": {
    "village_gate": {
      "label": "Ворота",
      "icon": "🏘️",
      "hubScene": "arrival"
    },
    "tavern": {
      "label": "Таверна",
      "icon": "🍺",
      "hubScene": "tavern"
    },
    "square": {
      "label": "Площадь",
      "icon": "🗺️",
      "hubScene": "village_square"
    },
    "river": {
      "label": "Река",
      "icon": "🌊",
      "hubScene": "river_bank"
    },
    "mill": {
      "label": "Мельница",
      "icon": "🌾",
      "hubScene": "mill_approach"
    },
    "shrine": {
      "label": "Святилище",
      "icon": "🕯️",
      "hubScene": "shrine_entrance",
      "showIf": {
        "flag": "has_journal"
      }
    }
  },
  "audio": {
    "catalog": {},
    "defaults": {
      "damageType": {},
      "effectType": {},
      "attack": {}
    }
  }
};
if (typeof window !== 'undefined') window.DEMO_PF2E_DATA = DEMO_PF2E_DATA;
