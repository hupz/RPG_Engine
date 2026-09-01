// Inline demo data (file://) — data/demos/mvp_proof.json
var DEMO_MVP_PROOF_DATA = {
  "meta": {
    "title": "MVP Proof: Oakhaven Quest",
    "campaignId": "mvp_proof",
    "description": "Hybrid RPG proof — Village (visual) → NPC dialogue → Quest → Forest → Combat → Chest → Return → Reward → Save. No author JavaScript. Isolated from Mill.",
    "author": "RPGengine",
    "version": "1.0",
    "dataVersion": "mvp-proof-1.0",
    "system": "generic"
  },
  "system": "generic",
  "questsVersion": 2,
  "assets": {
    "village_bg": {
      "type": "image",
      "src": "assets/images/village.svg",
      "name": "Деревня (фон)"
    },
    "forest_bg": {
      "type": "image",
      "src": "assets/images/village.svg",
      "name": "Лесная тропа (placeholder bg)"
    },
    "diary_icon": {
      "type": "image",
      "src": "assets/images/diary.svg",
      "name": "Журнал"
    },
    "bag_icon": {
      "type": "image",
      "src": "assets/images/bag.svg",
      "name": "Инвентарь"
    }
  },
  "startingFlags": {},
  "startScene": "start",
  "scenes": {
    "start": {
      "id": "start",
      "location": "Oakhaven",
      "title": "Добро пожаловать",
      "text": "Вы прибываете в деревню Oakhaven. На площади суетятся местные, а у дома старейшины собралась тревожная толпа.\n\nЭто небольшой proof-проект: всё создано через данные редактора, без пользовательского JavaScript.",
      "choices": [
        {
          "text": "Войти в деревню",
          "icon": "🏘️",
          "to": "village"
        }
      ]
    },
    "village": {
      "id": "village",
      "location": "Oakhaven — площадь",
      "title": "Деревня",
      "text": "Площадь Oakhaven. Дом старейшины слева, лесная тропа на востоке.\n\nКликайте по объектам на сцене или используйте HUD внизу.",
      "choices": [
        {
          "text": "Поговорить со старейшиной (текстом)",
          "icon": "👵",
          "to": "elder_hut"
        },
        {
          "text": "Идти в лес",
          "icon": "🌲",
          "showIf": {
            "all": [{ "flag": "herb_quest_started" }]
          },
          "to": "forest"
        }
      ],
      "visual": {
        "mode": "overlay",
        "background": {
          "asset": {
            "type": "image",
            "ref": "village_bg",
            "src": "assets/images/village.svg"
          }
        },
        "nodes": [
          {
            "id": "hs_elder",
            "kind": "hotspot",
            "layer": "world",
            "transform": { "x": 0.1, "y": 0.35, "w": 0.2, "h": 0.3, "z": 2 },
            "visible": true,
            "enabled": true,
            "props": { "label": "Дом старейшины (NPC)", "debugDraw": true },
            "events": {
              "click": [
                { "action": "change_scene", "params": { "sceneId": "elder_hut" } }
              ]
            }
          },
          {
            "id": "hs_forest_path",
            "kind": "hotspot",
            "layer": "world",
            "transform": { "x": 0.62, "y": 0.42, "w": 0.24, "h": 0.28, "z": 2 },
            "visible": true,
            "enabled": true,
            "props": { "label": "Лесная тропа", "debugDraw": true },
            "showIf": {
              "all": [{ "flag": "herb_quest_started" }]
            },
            "events": {
              "click": [
                { "action": "change_scene", "params": { "sceneId": "forest" } }
              ]
            }
          },
          {
            "id": "img_journal",
            "kind": "image",
            "layer": "hud",
            "transform": { "x": 0.88, "y": 0.04, "w": 0.1, "h": 0.12, "z": 10 },
            "visible": true,
            "enabled": true,
            "asset": {
              "type": "image",
              "ref": "diary_icon",
              "src": "assets/images/diary.svg"
            },
            "props": { "label": "Журнал" },
            "events": {
              "click": [
                { "action": "open_panel", "params": { "panel": "journal" } }
              ]
            }
          },
          {
            "id": "img_inventory",
            "kind": "image",
            "layer": "hud",
            "transform": { "x": 0.76, "y": 0.04, "w": 0.1, "h": 0.12, "z": 10 },
            "visible": true,
            "enabled": true,
            "asset": {
              "type": "image",
              "ref": "bag_icon",
              "src": "assets/images/bag.svg"
            },
            "props": { "label": "Инвентарь" },
            "events": {
              "click": [
                { "action": "open_panel", "params": { "panel": "inventory" } }
              ]
            }
          }
        ]
      }
    },
    "elder_hut": {
      "id": "elder_hut",
      "location": "Дом старейшины",
      "title": "Мира, старейшина",
      "text": "В доме пахнет сушёными травами. Старейшина Мира ждёт вашего решения.",
      "npcId": "elder_mira",
      "components": [
        {
          "component": "dialogue_tree",
          "params": {
            "npc": "elder_mira",
            "greeting": "Путник, у нас беда. Волки заняли лесную тропу — без редкой травы деревня не переживёт зиму.",
            "topics": [
              {
                "label": "Что случилось?",
                "reply": "Волки стали агрессивнее. Они охраняют куст с целебной травой — нам нужен хотя бы один пучок."
              },
              {
                "label": "Я помогу",
                "reply": "Слава небесам! Идите на восток, к лесной тропе. Разберитесь с волком и принесите траву.",
                "showIf": {
                  "all": [{ "notFlag": "herb_quest_started" }]
                },
                "actions": [
                  { "action": "update_quest", "params": { "questId": "herb_for_elder", "stage": "0" } },
                  { "action": "set_flag", "params": { "flag": "herb_quest_started", "value": true } }
                ]
              },
              {
                "label": "Я принёс траву",
                "reply": "Вы спасли Oakhaven! Примите награду — и отдыхайте сколько нужно.",
                "showIf": {
                  "all": [
                    { "hasItem": "forest_herb" },
                    { "questMinStage": { "questId": "herb_for_elder", "stage": 3 } },
                    { "notFlag": "herb_quest_done" }
                  ]
                },
                "actions": [
                  { "action": "remove_item", "params": { "itemId": "forest_herb", "count": 1 } },
                  { "action": "update_quest", "params": { "questId": "herb_for_elder", "stage": "complete" } },
                  { "action": "add_gold", "params": { "amount": 50 } },
                  { "action": "set_flag", "params": { "flag": "herb_quest_done", "value": true } },
                  { "action": "say", "params": { "text": "Квест «Травы для старейшины» завершён." } }
                ]
              },
              {
                "label": "Как поживает деревня?",
                "reply": "Спокойно, благодаря вам. Лес снова безопасен.",
                "showIf": {
                  "all": [{ "flag": "herb_quest_done" }]
                }
              }
            ]
          }
        }
      ],
      "choices": [
        {
          "text": "Вернуться на площадь",
          "icon": "🚪",
          "to": "village"
        }
      ]
    },
    "forest": {
      "id": "forest",
      "location": "Лесная тропа",
      "title": "Лес",
      "text": "Тропа уходит между деревьями. Впереди рычит волк, а за поваленным стволом виднеется старый сундук с травами.",
      "events": {
        "enter": [
          {
            "action": "update_quest",
            "params": { "questId": "herb_for_elder", "stage": "1" }
          }
        ]
      },
      "choices": [
        {
          "text": "Вернуться в деревню",
          "icon": "🏘️",
          "to": "village"
        }
      ],
      "visual": {
        "mode": "overlay",
        "background": {
          "asset": {
            "type": "image",
            "ref": "forest_bg",
            "src": "assets/images/village.svg"
          }
        },
        "nodes": [
          {
            "id": "hs_wolf",
            "kind": "hotspot",
            "layer": "world",
            "transform": { "x": 0.28, "y": 0.48, "w": 0.22, "h": 0.2, "z": 3 },
            "visible": true,
            "enabled": true,
            "props": { "label": "Лесной волк", "debugDraw": true },
            "showIf": {
              "all": [
                { "flag": "herb_quest_started" },
                { "notFlag": "wolf_defeated" }
              ]
            },
            "events": {
              "click": [
                {
                  "action": "say",
                  "params": { "text": "Волк скалит клыки и бросается в атаку!" }
                },
                {
                  "action": "start_combat",
                  "params": {
                    "enemies": ["forest_wolf"],
                    "nextScene": "forest_victory"
                  }
                }
              ]
            }
          },
          {
            "id": "hs_herb_chest",
            "kind": "hotspot",
            "layer": "world",
            "transform": { "x": 0.62, "y": 0.55, "w": 0.16, "h": 0.14, "z": 3 },
            "visible": true,
            "enabled": true,
            "props": { "label": "Куст с травой", "debugDraw": true },
            "showIf": {
              "all": [
                { "flag": "wolf_defeated" },
                { "notFlag": "herb_collected" }
              ]
            },
            "events": {
              "click": [
                {
                  "action": "say",
                  "params": { "text": "Вы собираете пучок редкой лесной травы." }
                },
                {
                  "action": "add_item",
                  "params": { "itemId": "forest_herb", "count": 1 }
                },
                {
                  "action": "update_quest",
                  "params": { "questId": "herb_for_elder", "stage": "3" }
                },
                {
                  "action": "set_flag",
                  "params": { "flag": "herb_collected", "value": true }
                }
              ]
            }
          },
          {
            "id": "hs_forest_exit",
            "kind": "hotspot",
            "layer": "world",
            "transform": { "x": 0.04, "y": 0.7, "w": 0.18, "h": 0.14, "z": 2 },
            "visible": true,
            "enabled": true,
            "props": { "label": "К деревне", "debugDraw": true },
            "events": {
              "click": [
                { "action": "change_scene", "params": { "sceneId": "village" } }
              ]
            }
          }
        ]
      }
    },
    "forest_victory": {
      "id": "forest_victory",
      "location": "Лесная тропа",
      "title": "Победа",
      "text": "Волк отступает в чащу. Тропа свободна — можно искать траву у поваленного ствола.",
      "flags": { "wolf_defeated": true },
      "choices": [
        {
          "text": "Осмотреть лес",
          "icon": "🌿",
          "questSet": { "questId": "herb_for_elder", "stage": "2" },
          "to": "forest"
        }
      ]
    }
  },
  "npcs": {
    "elder_mira": {
      "id": "elder_mira",
      "name": "Мира",
      "icon": "👵",
      "description": "Старейшина Oakhaven.",
      "dialogueSceneId": "elder_hut",
      "dialogues": {
        "default": [
          { "speaker": "Мира", "text": "Путник, у нас беда. Волки заняли лесную тропу." }
        ]
      }
    }
  },
  "items": {
    "forest_herb": {
      "name": "Лесная трава",
      "description": "Редкий целебный пучок. Нужен старейшине Мире."
    }
  },
  "quests": {
    "herb_for_elder": {
      "id": "herb_for_elder",
      "title": "Травы для старейшины",
      "description": "Мира просит прогнать волка и принести лесную траву.",
      "giver": "elder_mira",
      "stages": [
        {
          "id": "accept",
          "title": "Поговорить с Мирой",
          "log": "Старейшина просит о помощи.",
          "hint": "Дом старейшины → «Я помогу».",
          "tasks": [{ "id": "t_accept", "type": "ManualAdvance", "description": "Принять квест" }]
        },
        {
          "id": "enter_forest",
          "title": "Дойти до леса",
          "log": "Отправьтесь на лесную тропу.",
          "hint": "Площадь → Лесная тропа.",
          "tasks": [{ "id": "t_forest", "type": "ManualAdvance", "description": "Войти в лес" }]
        },
        {
          "id": "defeat_wolf",
          "title": "Победить волка",
          "log": "Разберитесь с лесным волком.",
          "hint": "Кликните волка на visual-сцене леса.",
          "tasks": [{ "id": "t_wolf", "type": "ManualAdvance", "description": "Победить волка" }]
        },
        {
          "id": "collect_herb",
          "title": "Собрать траву",
          "log": "Соберите траву у поваленного ствола.",
          "hint": "Кликните куст после победы.",
          "tasks": [{ "id": "t_herb", "type": "ManualAdvance", "description": "Собрать траву" }]
        },
        {
          "id": "return_elder",
          "title": "Вернуться к Мире",
          "log": "Отнесите траву старейшине.",
          "hint": "Дом старейшины → «Я принёс траву».",
          "tasks": [{ "id": "t_return", "type": "ManualAdvance", "description": "Сдать траву" }]
        },
        {
          "id": "done",
          "title": "Готово",
          "log": "Oakhaven в безопасности.",
          "finish": true,
          "tasks": [{ "id": "t_done", "type": "ManualAdvance", "description": "Квест завершён" }]
        }
      ],
      "rewards": {
        "gold": 25,
        "exp": 40
      }
    }
  },
  "enemies": {
    "forest_wolf": {
      "id": "forest_wolf",
      "name": "Лесной волк",
      "icon": "🐺",
      "hp": 14,
      "ac": 12,
      "attack": 4,
      "damage": "1d6+1",
      "exp": 30,
      "description": "Голодный хищник на тропе."
    }
  },
  "classes": {
    "wanderer": {
      "id": "wanderer",
      "name": "Странник",
      "hp": 22,
      "startingItems": [],
      "startingGold": 15
    }
  },
  "ui": {
    "screens": {
      "rpg_hud": {
        "id": "rpg_hud",
        "scope": "persistent",
        "nodes": [
          {
            "id": "rh_bar_bg",
            "kind": "panel",
            "transform": { "x": 0.02, "y": 0.02, "w": 0.52, "h": 0.1, "z": 1 },
            "style": { "background": "rgba(10,14,22,0.85)" }
          },
          {
            "id": "rh_hp",
            "kind": "bar",
            "transform": { "x": 0.03, "y": 0.035, "w": 0.22, "h": 0.035, "z": 2 },
            "binding": "player.hp"
          },
          {
            "id": "rh_gold",
            "kind": "gold",
            "transform": { "x": 0.28, "y": 0.03, "w": 0.14, "h": 0.04, "z": 2 },
            "text": "🪙 {gold}"
          },
          {
            "id": "rh_quest_hint",
            "kind": "text",
            "transform": { "x": 0.44, "y": 0.03, "w": 0.3, "h": 0.04, "z": 2 },
            "text": "Oakhaven MVP"
          },
          {
            "id": "rh_inv",
            "kind": "button",
            "transform": { "x": 0.58, "y": 0.88, "w": 0.12, "h": 0.08, "z": 5 },
            "text": "Инвентарь",
            "events": {
              "click": [{ "action": "open_panel", "params": { "panel": "inventory" } }]
            }
          },
          {
            "id": "rh_jr",
            "kind": "button",
            "transform": { "x": 0.71, "y": 0.88, "w": 0.12, "h": 0.08, "z": 5 },
            "text": "Журнал",
            "events": {
              "click": [{ "action": "open_panel", "params": { "panel": "journal" } }]
            }
          },
          {
            "id": "rh_save",
            "kind": "button",
            "transform": { "x": 0.84, "y": 0.88, "w": 0.14, "h": 0.08, "z": 5 },
            "text": "Сохранить",
            "events": {
              "click": [{ "action": "save_game", "params": { "slot": "auto" } }]
            }
          }
        ]
      }
    }
  }
};
if (typeof window !== 'undefined') window.DEMO_MVP_PROOF_DATA = DEMO_MVP_PROOF_DATA;
