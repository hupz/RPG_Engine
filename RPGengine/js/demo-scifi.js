// Inline demo data (file://) — data/demos/scifi-horror-demo.json
var DEMO_SCIFI_DATA = {
  "meta": {
    "title": "Станция Гефест: Сигнал бедствия",
    "version": "1.0",
    "author": "RPGengine Demo",
    "description": "Sci-Fi хоррор на заброшенной космической станции. Демонстрация темы sci_fi, механики кислорода и хакинга.",
    "system": "generic"
  },
  "theme": {
    "id": "sci_fi",
    "label": "Sci-Fi",
    "fonts": {
      "google": "Orbitron:wght@400;600;700|family=Share+Tech+Mono",
      "body": "'Share Tech Mono', monospace",
      "heading": "'Orbitron', sans-serif"
    },
    "colors": {
      "pageBg": "#050a12",
      "paper": "#0c1420",
      "paperDark": "#080e18",
      "paperShadow": "#040810",
      "cardBg": "#101c2c",
      "ink": "#c8e6ff",
      "inkLight": "#7eb8d4",
      "inkFaint": "#4a7a94",
      "accent": "#00e5ff",
      "accentLight": "#4dffff",
      "danger": "#ff5252",
      "success": "#00e676",
      "successDark": "#00a152",
      "info": "#448aff",
      "infoLight": "#82b1ff",
      "border": "#1e3a52",
      "borderDark": "#142838",
      "pencil": "#5a8aaa",
      "onAccent": "#050a12",
      "onSuccess": "#050a12",
      "overlay": "rgba(0, 20, 40, 0.85)",
      "tagCombatBg": "#2a1018",
      "tagOnceBg": "#1a2838",
      "tagOnceFg": "#ffb74d",
      "invUseBg": "#0a2830",
      "invUseBorder": "#00e5ff",
      "invUseHover": "#143848",
      "wizard": "#b388ff",
      "wizardLight": "#d1c4e9",
      "paladin": "#69f0ae",
      "paladinLight": "#b9f6ca",
      "warrior": "#ffab40",
      "warriorLight": "#ffd180",
      "shadowSm": "rgba(0, 229, 255, 0.08)",
      "shadowMd": "rgba(0, 229, 255, 0.2)",
      "highlight": "rgba(0, 229, 255, 0.08)"
    }
  },
  "ui_hints": {
    "hp": "Целостность скафандра. При 0% — разгерметизация.",
    "ac": "Защита костюма — сопротивление урону и взлому.",
    "atk": "Точность систем наведения.",
    "level": "Уровень и опыт. Новые навыки открываются при повышении.",
    "resource": "Кислород (O₂). Тратится каждый ход в опасных зонах. Восстанавливается в шлюзах.",
    "rest": "Подзарядка в шлюзе: восстанавливает O₂ и целостность.",
    "inventory": "Экипировка, инструменты, ключ-карты.",
    "travel": "Навигация между открытыми отсеками.",
    "stat_str": "Сила — вскрытие дверей, переноска грузов, ближний бой.",
    "stat_dex": "Ловкость — уклонение, точная работа, скрытность.",
    "stat_con": "Выносливость — сопротивление токсинам, удержание дыхания.",
    "stat_int": "Интеллект — хакинг, диагностика, наука.",
    "stat_wis": "Восприятие — сканирование, интуиция, выживание.",
    "stat_cha": "Харизма — переговоры с ИИ, убеждение выживших."
  },
  "startingFlags": {
    "o2_warning": false,
    "drone_disabled": false,
    "crew_found": false
  },
  "reputation": {},
  "statusEffects": {},
  "enemyScaling": {
    "enabled": true,
    "hpRatePerLevel": 0.12,
    "bossHpRatePerLevel": 0.2,
    "atkBonusPerEvenLevel": 1,
    "acBonuses": [
      {
        "playerLevel": 2,
        "bonus": 1
      }
    ]
  },
  "progression": {
    "enabled": true,
    "maxLevel": 3,
    "expTable": [
      0,
      100,
      250
    ],
    "defaultHpGain": "1d6",
    "defaults": {
      "enemyExp": 20,
      "skillCheckExp": 15
    },
    "skillExp": {},
    "abilities": {}
  },
  "classes": {
    "engineer": {
      "name": "Инженер-техник",
      "icon": "🔧",
      "hp": 18,
      "ac": 14,
      "atkBonus": 4,
      "dmgRoll": "1d6",
      "dmgBonus": 2,
      "initBonus": 3,
      "stats": {
        "str": 12,
        "dex": 14,
        "con": 14,
        "int": 16,
        "wis": 12,
        "cha": 10
      },
      "skills": "Хакинг, Диагностика, Скрытность, Восприятие",
      "resource": {
        "name": "Кислород (O₂)",
        "max": 6,
        "desc": "Тратится в опасных зонах. Восстанавливается в шлюзах."
      },
      "mainWeapon": "plasma_cutter",
      "startingItems": [
        "plasma_cutter",
        "multitool",
        "keycard_green",
        "medkit"
      ],
      "abilities": [
        {
          "id": "hack_terminal",
          "name": "Взлом терминала",
          "cost": 1,
          "icon": "💻",
          "desc": "Взломать электронную систему (INT DC зависит от цели).",
          "combatOnly": false,
          "effect": {
            "type": "custom",
            "message": "Вы подключаетесь к системе..."
          }
        },
        {
          "id": "emergency_seal",
          "name": "Аварийная герметизация",
          "cost": 2,
          "icon": "🔒",
          "desc": "Запечатать отсек. Блокирует проход врагам на 3 хода.",
          "combatOnly": true,
          "effect": {
            "type": "buff",
            "buffType": "ac",
            "value": 3
          }
        },
        {
          "id": "plasma_burst",
          "name": "Плазменный разряд",
          "cost": 2,
          "icon": "⚡",
          "desc": "Мощный выстрел плазмой. 2к6 урона одной цели.",
          "combatOnly": true,
          "effect": {
            "type": "damage",
            "value": "2d6",
            "damageType": "fire"
          }
        }
      ]
    }
  },
  "items": {
    "plasma_cutter": {
      "id": "plasma_cutter",
      "name": "Плазменный резак",
      "type": "weapon",
      "desc": "Инструмент и оружие. 1к6 урона огнём.",
      "slot": "weapon",
      "dmgRoll": "1d6",
      "stat": "dex"
    },
    "multitool": {
      "id": "multitool",
      "name": "Мультитул",
      "type": "misc",
      "desc": "+2 к проверкам Хакинга и Диагностики.",
      "equippable": true,
      "slot": "accessory"
    },
    "keycard_green": {
      "id": "keycard_green",
      "name": "Зелёная ключ-карта",
      "type": "misc",
      "desc": "Доступ к техническим отсекам."
    },
    "keycard_red": {
      "id": "keycard_red",
      "name": "Красная ключ-карта",
      "type": "misc",
      "desc": "Доступ к командному мостику."
    },
    "medkit": {
      "id": "medkit",
      "name": "Медкомплект",
      "type": "consumable",
      "desc": "Восстанавливает 2к4+2 целостности.",
      "use": {
        "effect": "heal",
        "formula": "2d4+2"
      }
    },
    "o2_canister": {
      "id": "o2_canister",
      "name": "Баллон O₂",
      "type": "consumable",
      "desc": "Восстанавливает 3 единицы кислорода.",
      "use": {
        "effect": "custom",
        "message": "Кислород восстановлен (+3 O₂)."
      }
    }
  },
  "enemies": {
    "maintenance_drone": {
      "name": "Дрон-уборщик (взломанный)",
      "hp": 12,
      "ac": 13,
      "atkBonus": 3,
      "dmgRoll": "1d4",
      "dmgBonus": 1,
      "dex": 3,
      "exp": 20
    },
    "infected_crew": {
      "name": "Заражённый член экипажа",
      "hp": 18,
      "ac": 12,
      "atkBonus": 4,
      "dmgRoll": "1d6",
      "dmgBonus": 2,
      "dex": 2,
      "exp": 30
    },
    "security_bot": {
      "name": "Охранный бот",
      "hp": 25,
      "ac": 16,
      "atkBonus": 5,
      "dmgRoll": "1d8",
      "dmgBonus": 3,
      "dex": 1,
      "exp": 50,
      "boss": true
    }
  },
  "npcs": {},
  "quests": {},
  "audio": {
    "catalog": {},
    "defaults": {
      "damageType": {},
      "effectType": {},
      "attack": {}
    }
  },
  "worldMap": {
    "cryo_bay": {
      "label": "Крио-отсек",
      "icon": "❄️",
      "hubScene": "cryo_bay"
    },
    "corridor_hub": {
      "label": "Коридор A",
      "icon": "🚪",
      "hubScene": "corridor_a"
    },
    "medbay": {
      "label": "Медотсек",
      "icon": "🏥",
      "hubScene": "medbay"
    },
    "bridge_approach": {
      "label": "Подход к мостику",
      "icon": "🛸",
      "hubScene": "bridge_door"
    }
  },
  "scenes": {
    "start": {
      "id": "start",
      "location": "Криокамера — Станция «Гефест»",
      "text": "Холодный пар окутывает криокамеру. Системы жизнеобеспечения мигают красным: «SOS — ПОТЕРЯ СВЯЗИ С ЦЕНТРОМ». Вы — единственный инженер, проснувшийся вовремя.\n\nВ создателе персонажа доступен класс «Инженер-техник». После пробуждения осмотрите станцию и найдите путь к спасательной капсуле.",
      "choices": [
        {
          "text": "❄️ Выйти из криокамеры",
          "to": "cryo_bay"
        }
      ],
      "dialogue": [],
      "combat": null,
      "flags": {},
      "items": [],
      "gold": 0
    },
    "cryo_bay": {
      "id": "cryo_bay",
      "location": "Крио-отсек",
      "mapLocation": "cryo_bay",
      "text": "Ряды криокапсул. Большинство погасло навсегда. На стене — схема станции и мигающий терминал: «УТЕЧКА В СЕКТОРЕ B».",
      "choices": [
        {
          "text": "👁️ Сканировать отсек (Восприятие DC 12)",
          "to": "cryo_bay",
          "skillCheck": {
            "skill": "perception",
            "dc": 12,
            "successText": "Вы замечаете следы когтей у люка в коридор A и запись в журнале: «Экипаж… не они сами…»",
            "successFlags": {
              "crew_found": true
            },
            "failText": "Сканер шипит помехами. Видны только обугленные провода.",
            "successNext": "corridor_a"
          }
        },
        {
          "text": "🚪 Идти в коридор A",
          "to": "corridor_a"
        }
      ],
      "dialogue": [],
      "combat": null,
      "flags": {},
      "items": [],
      "gold": 0
    },
    "corridor_a": {
      "id": "corridor_a",
      "location": "Коридор A",
      "mapLocation": "corridor_hub",
      "text": "Тусклый аварийный свет. Впереди — главный коридор с гулом моторов. Слева — узкий техтоннель с табличкой «Только персонал».",
      "choices": [
        {
          "text": "🕳️ Техтоннель (Скрытность DC 14)",
          "to": "corridor_a",
          "skillCheck": {
            "skill": "stealth",
            "dc": 14,
            "successText": "Вы проскальзываете мимо камер наблюдения.",
            "successNext": "tech_tunnel",
            "failText": "Сирена! Дрон-уборщик активируется в главном коридоре.",
            "failNext": "main_corridor"
          }
        },
        {
          "text": "⚔️ Главный коридор (дрон на пути)",
          "to": "main_corridor"
        },
        {
          "text": "🏥 Медотсек",
          "to": "medbay"
        },
        {
          "text": "☠️ Снять шлем (кислород 0)",
          "to": "game_over",
          "hideIf": {
            "all": [
              {
                "flag": "o2_warning",
                "equals": true
              }
            ]
          }
        }
      ],
      "dialogue": [],
      "combat": null,
      "flags": {
        "o2_warning": true
      },
      "items": [],
      "gold": 0
    },
    "tech_tunnel": {
      "id": "tech_tunnel",
      "location": "Техтоннель",
      "text": "Узкий туннель с кабелями и мигающими реле. На конце — заблокированный серверный шлюз.",
      "choices": [
        {
          "text": "💻 Взломать шлюз (Расследование DC 13)",
          "to": "tech_tunnel",
          "skillCheck": {
            "skill": "investigation",
            "dc": 13,
            "successText": "Вы обходите протокол безопасности и находите резервную красную ключ-карту в кэше.",
            "successItems": [
              "keycard_red"
            ],
            "successFlags": {
              "tunnel_hacked": true
            },
            "successNext": "corridor_a",
            "failText": "Защита отбрасывает ваш мультитул. Придётся искать другой путь.",
            "failNext": "corridor_a"
          }
        },
        {
          "text": "← Назад в коридор",
          "to": "corridor_a"
        }
      ],
      "dialogue": [],
      "combat": null,
      "flags": {},
      "items": [],
      "gold": 0
    },
    "main_corridor": {
      "id": "main_corridor",
      "location": "Главный коридор",
      "text": "Взломанный дрон-уборщик блокирует проход. Лезвия вращаются, оптика горит багровым.",
      "choices": [],
      "dialogue": [],
      "combat": [
        "maintenance_drone"
      ],
      "nextScene": "main_corridor_clear",
      "flags": {
        "drone_disabled": true
      },
      "items": [],
      "gold": 0
    },
    "main_corridor_clear": {
      "id": "main_corridor_clear",
      "location": "Главный коридор",
      "text": "Искры из дронa. Коридор свободен. Вдалеке — дверь на мостик и указатель «Медотсек».",
      "choices": [
        {
          "text": "🛸 К двери мостика",
          "to": "bridge_door"
        },
        {
          "text": "🏥 Медотсек",
          "to": "medbay"
        },
        {
          "text": "← К развилке",
          "to": "corridor_a"
        }
      ],
      "dialogue": [],
      "combat": null,
      "flags": {},
      "items": [],
      "gold": 0
    },
    "medbay": {
      "id": "medbay",
      "location": "Медотсек",
      "mapLocation": "medbay",
      "text": "Перевёрнутые койки, разбитые ампулы. На терминале — последние показания: «биологическая угроза класса 3».",
      "choices": [
        {
          "text": "🔍 Обыскать шкафы (Восприятие DC 11)",
          "to": "medbay",
          "skillCheck": {
            "skill": "perception",
            "dc": 11,
            "successText": "Вы находите дополнительный медкомплект и баллон O₂.",
            "successItems": [
              "medkit",
              "o2_canister"
            ],
            "failText": "Шкафы пусты — кто-то уже забрал запасы.",
            "successNext": "medbay",
            "failNext": "medbay"
          }
        },
        {
          "text": "← В коридор",
          "to": "corridor_a"
        },
        {
          "text": "🛸 К мостику",
          "to": "bridge_door"
        }
      ],
      "dialogue": [],
      "combat": null,
      "flags": {},
      "items": [],
      "gold": 0
    },
    "bridge_door": {
      "id": "bridge_door",
      "location": "Дверь на мостик",
      "mapLocation": "bridge_approach",
      "text": "Массивная дверь с двойным замком. Требуется красная ключ-карта или взлом центрального терминала.",
      "choices": [
        {
          "text": "🗝️ Приложить красную ключ-карту",
          "to": "bridge",
          "showIf": {
            "all": [
              {
                "hasItem": "keycard_red"
              }
            ]
          }
        },
        {
          "text": "💻 Взломать замок (Интеллект DC 16)",
          "to": "bridge_door",
          "skillCheck": {
            "skill": "intelligence",
            "dc": 16,
            "successText": "Замок щёлкает. Дверь на мостик открыта.",
            "successNext": "bridge",
            "failText": "Система блокирует попытку. Сигнал тревоги усиливается.",
            "failNext": "bridge_door"
          }
        },
        {
          "text": "← Назад",
          "to": "corridor_a"
        }
      ],
      "dialogue": [],
      "combat": null,
      "flags": {},
      "items": [],
      "gold": 0
    },
    "bridge": {
      "id": "bridge",
      "location": "Командный мостик",
      "text": "Панорамные окна показывают пустоту. Охранный бот наводит на вас оружие. Голос ИИ: «Несанкционированный доступ. Инициирую протокол зачистки… или переговоров?»",
      "choices": [
        {
          "text": "💻 Перехватить ИИ (Расследование DC 18)",
          "to": "bridge",
          "skillCheck": {
            "skill": "investigation",
            "dc": 18,
            "successText": "Вы отключаете протокол зачистки. Спасательная капсула разблокирована.",
            "successNext": "escape_pod",
            "failText": "ИИ блокирует ваш доступ. Бот атакует!",
            "failNext": "bridge_combat"
          }
        },
        {
          "text": "⚔️ Сразиться с охранным ботом",
          "to": "bridge_combat"
        }
      ],
      "dialogue": [
        {
          "speaker": "ИИ «Гефест»",
          "text": "Последний сигнал бедствия… или последний шанс?"
        }
      ],
      "combat": null,
      "flags": {},
      "items": [],
      "gold": 0
    },
    "bridge_combat": {
      "id": "bridge_combat",
      "location": "Командный мостик — бой",
      "text": "Охранный бот поднимает плазменную турель!",
      "choices": [],
      "dialogue": [],
      "combat": [
        "security_bot"
      ],
      "nextScene": "bridge_after_combat",
      "flags": {},
      "items": [],
      "gold": 0
    },
    "bridge_after_combat": {
      "id": "bridge_after_combat",
      "location": "Командный мостик",
      "text": "Бот искрит и падает. ИИ молчит. На экране загорается: «КАПСУЛА 7 — ГОТОВА К ОТСТЫКОВКЕ».",
      "choices": [
        {
          "text": "🚀 Спасательная капсула",
          "to": "escape_pod"
        }
      ],
      "dialogue": [],
      "combat": null,
      "flags": {},
      "items": [],
      "gold": 0
    },
    "escape_pod": {
      "id": "escape_pod",
      "location": "Спасательная капсула",
      "text": "Капсула отделяется от станции. За иллюминатором «Гефест» вспыхивает и гаснет.\n\nВы живы. Сигнал бедствия отправлен. Конец демо-модуля.",
      "choices": [
        {
          "text": "🔄 Начать заново",
          "action": "reset_game"
        }
      ],
      "dialogue": [],
      "combat": null,
      "flags": {},
      "items": [],
      "gold": 0
    },
    "game_over": {
      "id": "game_over",
      "location": "Станция «Гефест»",
      "text": "Кислород иссяк. Скафандр схлопывается. Станция поглощает ещё одну жертву.\n\nКонец.",
      "choices": [
        {
          "text": "🔄 Попробовать снова",
          "action": "reset_game"
        }
      ],
      "dialogue": [],
      "combat": null,
      "flags": {},
      "items": [],
      "gold": 0
    }
  }
};
if (typeof window !== 'undefined') window.DEMO_SCIFI_DATA = DEMO_SCIFI_DATA;
