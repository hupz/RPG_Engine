// Inline demo data (file://) — data/demos/pf2e-detective-demo.json
var DEMO_PF2E_DATA = {
  "meta": {
    "title": "Дело о пропавшем поезде",
    "version": "1.0",
    "author": "RPGengine Demo",
    "description": "Детективное расследование в стиле нуар на системе Pathfinder 2e. Демонстрация degrees of success, skill challenges, морального компаса.",
    "system": "pf2e"
  },
  "theme": {
    "id": "dark_fantasy",
    "label": "Тёмное фэнтези",
    "fonts": {
      "google": "Cinzel:wght@400;600;700|family=Crimson+Pro:ital,wght@0,400;0,600;1,400",
      "body": "'Crimson Pro', serif",
      "heading": "'Cinzel', serif"
    },
    "colors": {
      "pageBg": "#2a2834",
      "paper": "#38353f",
      "paperDark": "#302d38",
      "paperShadow": "#222028",
      "cardBg": "#42404c",
      "ink": "#f0ebe3",
      "inkLight": "#cfc6b8",
      "inkFaint": "#9a9288",
      "accent": "#d4ad2e",
      "accentLight": "#e8c44a",
      "danger": "#e07a8a",
      "success": "#5cbf8a",
      "successDark": "#3d9468",
      "info": "#7ab8f5",
      "infoLight": "#a8d4ff",
      "border": "#5a5568",
      "borderDark": "#484452",
      "pencil": "#b0a89c",
      "onAccent": "#2a2834",
      "onSuccess": "#1e1c26",
      "overlay": "rgba(20, 18, 28, 0.55)",
      "tagCombatBg": "#4a3038",
      "tagOnceBg": "#4a4030",
      "tagOnceFg": "#ffc870",
      "invUseBg": "#2a4a38",
      "invUseBorder": "#5cbf8a",
      "invUseHover": "#3a6048",
      "wizard": "#b094e8",
      "wizardLight": "#c8b0f0",
      "paladin": "#7acc8a",
      "paladinLight": "#94dda0",
      "warrior": "#e0b888",
      "warriorLight": "#ecd0a8",
      "shadowSm": "rgba(0, 0, 0, 0.22)",
      "shadowMd": "rgba(0, 0, 0, 0.32)",
      "highlight": "rgba(255, 255, 255, 0.1)"
    }
  },
  "ui_hints": {
    "hp": "Здоровье. При 0 — вы теряете сознание.",
    "ac": "Защита — уклонение от атак и ловушек.",
    "atk": "Точность удара или выстрела.",
    "level": "Уровень и опыт детектива.",
    "resource": "Улики. Собираются на месте преступления. Тратятся на дедукцию.",
    "rest": "Отдых в участке: восстанавливает здоровье и фокус.",
    "inventory": "Оружие, улики, документы.",
    "travel": "Переход между точками расследования на карте.",
    "stat_str": "Сила — физическое давление, ближний бой.",
    "stat_dex": "Ловкость — скрытность, быстрый выхват.",
    "stat_con": "Телосложение — выдержка и стойкость.",
    "stat_int": "Расследование — анализ улик, логика, знание города.",
    "stat_wis": "Проницательность — чтение людей, интуиция, медицина.",
    "stat_cha": "Допрос — убеждение, запугивание, обман."
  },
  "startingFlags": {
    "witness_talked": false,
    "tunnel_sneaked": false,
    "all_clues": false
  },
  "reputation": {},
  "statusEffects": {},
  "enemyScaling": {
    "enabled": true,
    "hpRatePerLevel": 0.15,
    "bossHpRatePerLevel": 0.25,
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
    "defaultHpGain": "1d8",
    "defaults": {
      "enemyExp": 25,
      "skillCheckExp": 12
    },
    "skillExp": {},
    "abilities": {}
  },
  "races": {
    "human_pf2e": {
      "id": "human_pf2e",
      "system": "pf2e",
      "name": "Человек (PF2e)",
      "icon": "🧑",
      "description": "Универсальные и амбициозные. Два свободных буста характеристик.",
      "abilityBoosts": [
        "str",
        "dex",
        "con",
        "int"
      ],
      "speed": 25,
      "hp": 8,
      "size": "medium",
      "heritages": [
        {
          "id": "versatile_human",
          "name": "Разносторонний",
          "desc": "Получите общую черту 1-го уровня."
        },
        {
          "id": "skilled_human",
          "name": "Умелый",
          "desc": "Тренирован в одном навыке на ваш выбор."
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
    }
  },
  "classes": {
    "detective": {
      "system": "pf2e",
      "name": "Частный детектив",
      "icon": "🔍",
      "hp": 16,
      "ac": 15,
      "atkBonus": 6,
      "dmgRoll": "1d6",
      "dmgBonus": 3,
      "initBonus": 4,
      "armorProficiency": "trained",
      "ancestry": "human",
      "stats": {
        "str": 12,
        "dex": 16,
        "con": 12,
        "int": 18,
        "wis": 14,
        "cha": 14
      },
      "skills": "Investigation, Perception, Diplomacy, Intimidation, Stealth",
      "startingSkills": [
        "investigation",
        "perception",
        "persuasion",
        "intimidation",
        "stealth"
      ],
      "resource": {
        "name": "Улики",
        "max": 3,
        "desc": "Собираются на местах. Тратятся на дедуктивные выводы."
      },
      "mainWeapon": "revolver",
      "startingItems": [
        "revolver",
        "magnifying_glass",
        "notebook",
        "badge"
      ],
      "abilities": [
        {
          "id": "deduce",
          "name": "Дедукция",
          "cost": 1,
          "icon": "🧠",
          "desc": "Потратьте улику, чтобы получить автоматический успех на проверке Расследования. (1 действие)",
          "combatOnly": false,
          "effect": {
            "type": "custom",
            "message": "Вы сопоставляете факты..."
          }
        },
        {
          "id": "interrogate",
          "name": "Допрос",
          "cost": 2,
          "icon": "🗣️",
          "desc": "Интенсивный допрос. INTIMIDATION vs Will DC. Успех: подозреваемый выдаёт информацию. Крит. успех: полная исповедь. (2 действия)",
          "combatOnly": false,
          "effect": {
            "type": "custom",
            "message": "Вы давите на подозреваемого..."
          }
        },
        {
          "id": "quick_draw",
          "name": "Быстрый выхват",
          "cost": 1,
          "icon": "🔫",
          "desc": "Выхватите оружие и выстрелите как одно действие. (1 действие)",
          "combatOnly": true,
          "effect": {
            "type": "extra_attack"
          }
        }
      ],
      "progression": {
        "hpGain": "1d8",
        "levels": {}
      }
    }
  },
  "items": {
    "revolver": {
      "id": "revolver",
      "name": "Револьвер",
      "type": "weapon",
      "desc": "1к6 урона. Дальность 30 фт.",
      "slot": "weapon",
      "dmgRoll": "1d6",
      "stat": "dex"
    },
    "magnifying_glass": {
      "id": "magnifying_glass",
      "name": "Лупа",
      "type": "misc",
      "desc": "+2 к Investigation при осмотре мелких деталей.",
      "equippable": true,
      "slot": "accessory"
    },
    "notebook": {
      "id": "notebook",
      "name": "Блокнот детектива",
      "type": "misc",
      "desc": "Ваши записи по делу."
    },
    "badge": {
      "id": "badge",
      "name": "Значок частного детектива",
      "type": "misc",
      "desc": "Подтверждает ваш статус.",
      "equippable": true,
      "slot": "accessory"
    },
    "clue_bloodstain": {
      "id": "clue_bloodstain",
      "name": "Улика: пятно крови",
      "type": "misc",
      "desc": "Кровь на полу вагона. Не принадлежит пассажирам."
    },
    "clue_torn_ticket": {
      "id": "clue_torn_ticket",
      "name": "Улика: порванный билет",
      "type": "misc",
      "desc": "Билет третьего класса с пометкой «особый груз»."
    },
    "clue_witness_statement": {
      "id": "clue_witness_statement",
      "name": "Улика: показания свидетеля",
      "type": "misc",
      "desc": "Кондуктор видел фигуру в чёрном пальто."
    }
  },
  "enemies": {
    "thug": {
      "name": "Громила из банды",
      "hp": 20,
      "ac": 14,
      "atkBonus": 6,
      "dmgRoll": "1d8",
      "dmgBonus": 3,
      "dex": 2,
      "exp": 30
    },
    "gang_leader": {
      "name": "Главарь банды «Чёрные рельсы»",
      "hp": 35,
      "ac": 17,
      "atkBonus": 8,
      "dmgRoll": "1d10",
      "dmgBonus": 4,
      "dex": 3,
      "exp": 80,
      "boss": true
    }
  },
  "npcs": {
    "inspector_hargrove": {
      "id": "inspector_hargrove",
      "name": "Инспектор Харгроув",
      "icon": "👮",
      "description": "Суровый полицейский инспектор, нанявший вас по делу о пропавшем поезде.",
      "location": "Участок",
      "attitude": "neutral"
    }
  },
  "quests": {
    "missing_train": {
      "id": "missing_train",
      "title": "Дело о пропавшем поезде",
      "giver": "inspector_hargrove",
      "description": "Поезд №47 исчез между станциями. Найдите его и узнайте, что случилось.",
      "stages": {
        "0": {
          "log": "Инспектор Харгроув поручил дело.",
          "hint": "Осмотрите место последнего появления поезда.",
          "finish": false
        },
        "1": {
          "log": "Найдены улики в депо.",
          "hint": "Допросите кондуктора или осмотрите пути.",
          "finish": false
        },
        "2": {
          "log": "Поезд найден в туннеле.",
          "hint": "Обыщите вагоны.",
          "finish": false
        },
        "3": {
          "log": "Дело раскрыто.",
          "hint": "",
          "finish": true
        }
      },
      "rewards": {
        "gold": 50,
        "exp": 100
      },
      "hidden": false
    }
  },
  "audio": {
    "catalog": {},
    "defaults": {
      "damageType": {},
      "effectType": {},
      "attack": {}
    }
  },
  "worldMap": {
    "office": {
      "label": "Офис детектива",
      "icon": "🏢",
      "hubScene": "start"
    },
    "depot": {
      "label": "Депо",
      "icon": "🚂",
      "hubScene": "train_depot"
    },
    "tunnel": {
      "label": "Туннель",
      "icon": "🕳️",
      "hubScene": "tunnel_entrance",
      "showIf": {
        "questStage": {
          "questId": "missing_train",
          "stage": "1"
        }
      }
    },
    "hideout": {
      "label": "Логово банды",
      "icon": "☠️",
      "hubScene": "gang_hideout",
      "showIf": {
        "questStage": {
          "questId": "missing_train",
          "stage": "2"
        }
      }
    }
  },
  "scenes": {
    "start": {
      "id": "start",
      "location": "Офис частного детектива",
      "mapLocation": "office",
      "text": "Дождь барабанит по стеклу. На столе — папка «Поезд №47». Телефон звонит: инспектор Харгроув.\n\nСоздайте персонажа (человек PF2e, класс «Частный детектив»), затем отправляйтесь на встречу.",
      "choices": [
        {
          "text": "🚔 К инспектору Харгроуву",
          "to": "inspector_office"
        }
      ],
      "dialogue": [],
      "combat": null,
      "flags": {},
      "items": [],
      "gold": 0
    },
    "inspector_office": {
      "id": "inspector_office",
      "location": "Участок — кабинет инспектора",
      "text": "Харгроув бросает на стол фотографию состава.\n\n«Поезд исчез между станциями «Северная» и «Туманная». Пассажиры, груз — всё пропало. Мне нужен кто-то с вашими… методами.»",
      "choices": [
        {
          "text": "📋 Принять дело",
          "to": "train_depot",
          "questSet": {
            "questId": "missing_train",
            "stage": "0"
          }
        },
        {
          "text": "❓ Спросить о деталях",
          "to": "inspector_office"
        }
      ],
      "dialogue": [
        {
          "speaker": "Харгроув",
          "text": "У нас есть три часа до того, как пресса узнает."
        }
      ],
      "combat": null,
      "flags": {},
      "items": [],
      "gold": 0
    },
    "train_depot": {
      "id": "train_depot",
      "location": "Депо «Северная»",
      "mapLocation": "depot",
      "text": "Пустые пути, туман и запах угля. Последний раз поезд видели здесь. Следы тормозной колодки ведут к заброшенному тупику.",
      "choices": [
        {
          "text": "🔍 Осмотр путей (Investigation DC 15)",
          "to": "train_depot",
          "skillCheck": {
            "skill": "investigation",
            "dc": 15,
            "critSuccessText": "Критический успех! Вы находите цепочку улик и понимаете маршрут похитителей.",
            "critSuccessNext": "depot_clues",
            "successText": "Вы находите пятно крови и обрывок билета.",
            "successNext": "depot_clues",
            "failText": "Следы стёр дождь. Нужно искать свидетелей.",
            "failNext": "depot_fail",
            "critFailText": "Вы топчете важные следы. Улики уничтожены.",
            "critFailNext": "depot_fail"
          }
        },
        {
          "text": "🗣️ Допросить кондуктора",
          "to": "witness_interrogation"
        }
      ],
      "dialogue": [],
      "combat": null,
      "flags": {},
      "items": [],
      "gold": 0
    },
    "depot_fail": {
      "id": "depot_fail",
      "location": "Депо «Северная»",
      "text": "Улики размыты. Кондуктор курит у будки и бросает на вас подозрительный взгляд.",
      "choices": [
        {
          "text": "🔍 Попробовать снова",
          "to": "train_depot"
        },
        {
          "text": "🗣️ Допросить кондуктора",
          "to": "witness_interrogation"
        }
      ],
      "dialogue": [],
      "combat": null,
      "flags": {},
      "items": [],
      "gold": 0
    },
    "depot_clues": {
      "id": "depot_clues",
      "location": "Депо — место находки",
      "text": "Вы аккуратно упаковываете улики в конверты. Билет помечен шифром банды «Чёрные рельсы».",
      "choices": [
        {
          "text": "📦 Забрать улики и продолжить",
          "to": "witness_interrogation",
          "questSet": {
            "questId": "missing_train",
            "stage": "1"
          }
        }
      ],
      "dialogue": [],
      "combat": null,
      "flags": {},
      "items": [
        "clue_bloodstain",
        "clue_torn_ticket"
      ],
      "gold": 0
    },
    "witness_interrogation": {
      "id": "witness_interrogation",
      "location": "Будка кондуктора",
      "text": "Кондуктор нервно теребит кепку. «Я ничего не видел…» — но глаза выдают страх.",
      "choices": [
        {
          "text": "🤝 Убедить (Diplomacy DC 16)",
          "to": "witness_interrogation",
          "skillCheck": {
            "skill": "persuasion",
            "dc": 16,
            "critSuccessText": "Критический успех! Кондуктор рассказывает всё — включая тайный вход в туннель.",
            "critSuccessNext": "tunnel_entrance",
            "successText": "Кондуктор признаётся: видел фигуру в чёрном пальто у туннеля.",
            "successFlags": {
              "witness_talked": true
            },
            "successNext": "tunnel_entrance",
            "failText": "Кондуктор молчит. Придётся пробираться самому.",
            "failNext": "tunnel_entrance",
            "critFailText": "Кондуктор закрывается и вызывает полицию. Время потеряно.",
            "critFailNext": "game_over"
          }
        },
        {
          "text": "😠 Запугать (Intimidation DC 16)",
          "to": "witness_interrogation",
          "skillCheck": {
            "skill": "intimidation",
            "dc": 16,
            "successText": "Кондуктор ломается: «Они увели состав в старый туннель!»",
            "successFlags": {
              "witness_talked": true
            },
            "successNext": "tunnel_entrance",
            "failText": "Кондуктор отказывается говорить.",
            "failNext": "tunnel_entrance"
          }
        }
      ],
      "dialogue": [
        {
          "speaker": "Кондуктор",
          "text": "Пожалуйста… они сказали молчать."
        }
      ],
      "combat": null,
      "flags": {},
      "items": [],
      "gold": 0
    },
    "tunnel_entrance": {
      "id": "tunnel_entrance",
      "location": "Вход в туннель",
      "mapLocation": "tunnel",
      "text": "Ржавые рельсы уходят во тьму. Слышен металлический скрежет — поезд где-то внутри.",
      "choices": [
        {
          "text": "🌑 Пробраться незаметно (Stealth DC 14)",
          "to": "tunnel_entrance",
          "skillCheck": {
            "skill": "stealth",
            "dc": 14,
            "critSuccessText": "Критический успех! Вы проходите мимо патруля бандитов незамеченным.",
            "critSuccessNext": "train_interior",
            "successText": "Вы пробираетесь вдоль стены, избегая фонарей.",
            "successFlags": {
              "tunnel_sneaked": true
            },
            "successNext": "train_interior",
            "failText": "Камень падает под ногой. Вас заметили!",
            "failNext": "gang_combat",
            "critFailText": "Вы спотыкаетесь о рельсу. Бандиты окружают вас.",
            "critFailNext": "gang_combat"
          }
        },
        {
          "text": "⚔️ Идти открыто",
          "to": "gang_hideout"
        }
      ],
      "dialogue": [],
      "combat": null,
      "flags": {},
      "items": [],
      "gold": 0
    },
    "train_interior": {
      "id": "train_interior",
      "location": "Вагон поезда №47",
      "text": "Состав стоит в туннеле. Вагоны пусты, но на полу — свежие следы. Кто-то недавно был здесь.",
      "choices": [
        {
          "text": "👁️ Обыск (Perception DC 15)",
          "to": "train_interior",
          "skillCheck": {
            "skill": "perception",
            "dc": 15,
            "critSuccessText": "Критический успех! Вы находите записную книжку свидетеля и карту логова.",
            "critSuccessNext": "gang_hideout",
            "successText": "Под сиденьем — записанные показания очевидца.",
            "successItems": [
              "clue_witness_statement"
            ],
            "successFlags": {
              "all_clues": true
            },
            "successNext": "gang_hideout",
            "failText": "Вагоны кажутся пустыми. Но бандиты где-то рядом.",
            "failNext": "gang_hideout"
          }
        },
        {
          "text": "📍 Поезд найден — к логову банды",
          "to": "gang_hideout",
          "showIf": {
            "mode": "any",
            "any": [
              {
                "hasItem": "clue_witness_statement"
              },
              {
                "flag": "all_clues",
                "equals": true
              }
            ]
          },
          "questSet": {
            "questId": "missing_train",
            "stage": "2"
          }
        }
      ],
      "dialogue": [],
      "combat": null,
      "flags": {},
      "items": [],
      "gold": 0
    },
    "gang_hideout": {
      "id": "gang_hideout",
      "location": "Логово «Чёрные рельсы»",
      "mapLocation": "hideout",
      "text": "Склад у тупика. Главарь банды и трое громил. Поезд стоит за их спинами — груз внутри.",
      "choices": [
        {
          "text": "🤝 Убедить сдаться (Diplomacy DC 20)",
          "to": "gang_hideout",
          "skillCheck": {
            "skill": "persuasion",
            "dc": 20,
            "critSuccessText": "Критический успех! Бандиты кладут оружие. Главарь признаётся добровольно.",
            "critSuccessNext": "confrontation_peace",
            "successText": "Громилы колеблются. Главарь готов говорить.",
            "successNext": "confrontation_peace",
            "failText": "Главарь смеётся. «Детектив, ты опоздал.»",
            "failNext": "gang_combat"
          }
        },
        {
          "text": "⚔️ Штурм",
          "to": "gang_combat"
        },
        {
          "text": "🔍 Предъявить все улики (арест)",
          "to": "confrontation",
          "showIf": {
            "mode": "all",
            "all": [
              {
                "hasItem": "clue_bloodstain"
              },
              {
                "hasItem": "clue_torn_ticket"
              },
              {
                "hasItem": "clue_witness_statement"
              }
            ]
          },
          "questSet": {
            "questId": "missing_train",
            "stage": "2"
          }
        }
      ],
      "dialogue": [],
      "combat": null,
      "flags": {},
      "items": [],
      "gold": 0
    },
    "gang_combat": {
      "id": "gang_combat",
      "location": "Логово — бой",
      "text": "Громила бросается на вас с цепью!",
      "choices": [],
      "dialogue": [],
      "combat": [
        "thug"
      ],
      "nextScene": "confrontation",
      "flags": {},
      "items": [],
      "gold": 0
    },
    "confrontation": {
      "id": "confrontation",
      "location": "Логово — финал",
      "text": "Главарь «Чёрных рельсов» стоит у поезда. У вас достаточно улик для ареста — или придётся стрелять.",
      "choices": [
        {
          "text": "📋 Арестовать по уликам",
          "to": "case_closed_good",
          "showIf": {
            "mode": "all",
            "all": [
              {
                "hasItem": "clue_bloodstain"
              },
              {
                "hasItem": "clue_torn_ticket"
              },
              {
                "hasItem": "clue_witness_statement"
              }
            ]
          },
          "questSet": {
            "questId": "missing_train",
            "stage": "3"
          }
        },
        {
          "text": "⚔️ Бой с главарём",
          "to": "confrontation_boss"
        },
        {
          "text": "🏃 Отпустить бандитов (поезд вернуть)",
          "to": "case_closed_neutral",
          "questSet": {
            "questId": "missing_train",
            "stage": "3"
          }
        }
      ],
      "dialogue": [
        {
          "speaker": "Главарь",
          "text": "Этот поезд — наш последний шанс, детектив."
        }
      ],
      "combat": null,
      "flags": {},
      "items": [],
      "gold": 0
    },
    "confrontation_peace": {
      "id": "confrontation_peace",
      "location": "Логово — переговоры",
      "text": "Главарь опускает револьвер. «Ладно. Забирайте поезд. Только скажите инспектору, что мы не трогали пассажиров.»",
      "choices": [
        {
          "text": "✅ Арестовать банду",
          "to": "case_closed_good",
          "questSet": {
            "questId": "missing_train",
            "stage": "3"
          }
        },
        {
          "text": "🤷 Отпустить (поезд важнее)",
          "to": "case_closed_neutral",
          "questSet": {
            "questId": "missing_train",
            "stage": "3"
          }
        }
      ],
      "dialogue": [],
      "combat": null,
      "flags": {},
      "items": [],
      "gold": 0
    },
    "confrontation_boss": {
      "id": "confrontation_boss",
      "location": "Логово — бой с главарём",
      "text": "Главарь выхватывает двустволку!",
      "choices": [],
      "dialogue": [],
      "combat": [
        "gang_leader"
      ],
      "nextScene": "case_closed_good",
      "flags": {},
      "items": [],
      "gold": 0
    },
    "case_closed_good": {
      "id": "case_closed_good",
      "location": "Участок",
      "text": "Харгроув принимает отчёт. Поезд возвращён, бандиты за решёткой (или повержены). Вам вручают гонорар.\n\nДело закрыто. Конец демо-модуля PF2e.",
      "choices": [
        {
          "text": "🔄 Новое расследование",
          "action": "reset_game"
        }
      ],
      "dialogue": [],
      "combat": null,
      "flags": {},
      "items": [],
      "gold": 50
    },
    "case_closed_neutral": {
      "id": "case_closed_neutral",
      "location": "Станция «Туманная»",
      "text": "Поезд вернули на рельсы. Бандиты растворились в тумане. Харгроув недоволен, но состав спасён.\n\nНейтральная концовка. Конец демо.",
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
      "gold": 25
    },
    "game_over": {
      "id": "game_over",
      "location": "Депо",
      "text": "Расследование провалено. Поезд так и не найден. Вашу лицензию отзывают.\n\nКонец.",
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
if (typeof window !== 'undefined') window.DEMO_PF2E_DATA = DEMO_PF2E_DATA;
