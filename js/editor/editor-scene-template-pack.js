// ============================================================
// Scene Template Pack — no-code RPG scene starters
// Additive only. Uses existing scenes/choices/components APIs.
// ============================================================
(function attachSceneTemplatePack() {
  'use strict';
  if (typeof Editor === 'undefined') return;

  function esc(s) {
    return typeof Editor.escapeHtml === 'function' ? Editor.escapeHtml(s) : String(s ?? '');
  }

  function ensureScene() {
    if (!Editor.data) Editor.data = {};
    if (!Editor.data.scenes) Editor.data.scenes = {};
    if (!Editor.currentScene || !Editor.data.scenes[Editor.currentScene]) {
      const ids = Object.keys(Editor.data.scenes);
      if (ids.length) Editor.currentScene = ids[0];
      else {
        Editor.data.scenes.start = {
          id: 'start',
          location: 'Начало',
          text: '',
          choices: []
        };
        Editor.currentScene = 'start';
      }
    }
    return Editor.data.scenes[Editor.currentScene];
  }

  function applyPack(scene, patch) {
    const keepId = scene.id;
    Object.assign(scene, patch);
    scene.id = keepId; // never change canonical id
    if (patch.choices) scene.choices = patch.choices;
    if (patch.components) scene.components = patch.components;
    if (patch.editorModules) scene.editorModules = patch.editorModules;
    if (patch.sceneType) scene.sceneType = patch.sceneType;
    if (typeof Editor.ensureSceneEditorModules === 'function') {
      Editor.ensureSceneEditorModules(scene);
    }
    if (typeof Editor.renderSceneList === 'function') Editor.renderSceneList();
    if (typeof Editor.renderSceneEditor === 'function') Editor.renderSceneEditor();
    if (typeof Editor.updateJSONPreview === 'function') Editor.updateJSONPreview();
    if (typeof Editor.markDirty === 'function') Editor.markDirty();
  }

  function makeSceneId(base) {
    const scenes = Editor.data.scenes || {};
    if (typeof Editor.slugifySceneId === 'function') {
      return Editor.slugifySceneId(base, scenes);
    }
    if (typeof Editor.slugifyId === 'function') {
      return Editor.slugifyId(String(base || 'scene'), '', scenes);
    }
    let id = String(base || 'scene').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_|_$/g, '') || 'scene';
    if (!scenes[id]) return id;
    let n = 2;
    while (scenes[id + '_' + n]) n++;
    return id + '_' + n;
  }

  /** Create a new scene from pack template and select it */
  function createSceneFromPack(def) {
    if (!Editor.data) Editor.data = {};
    if (!Editor.data.scenes) Editor.data.scenes = {};
    const id = makeSceneId(def.id.replace(/^tpl_/, '') || 'scene');
    const blank = {
      id,
      location: def.title || id,
      text: '',
      sceneType: 'custom',
      editorModules: [],
      choices: []
    };
    Editor.data.scenes[id] = blank;
    Editor.currentScene = id;
    const patch = def.build.call(Editor, blank);
    applyPack(blank, patch);
    if (typeof Editor.switchTab === 'function') Editor.switchTab('scenes');
    return id;
  }

  function sceneIds() {
    return Object.keys(Editor.data?.scenes || {});
  }

  function firstOtherScene(exclude) {
    const ids = sceneIds().filter((id) => id !== exclude);
    return ids[0] || exclude || 'start';
  }

  /** Build choice list for multi-destination navigation */
  function makeSceneChoiceChoices(title, destinations) {
    return (destinations || []).map((d) => ({
      text: d.text || d.label || d.to || 'Перейти',
      to: d.to || d.sceneId || '',
      icon: d.icon || '➡️'
    }));
  }

  // ——— Template factories (content, not empty names) ———

  const PACK = [
    {
      id: 'tpl_game_start',
      icon: '🌅',
      title: 'Начало игры',
      category: 'Сюжет',
      filter: 'quest',
      description: 'Вступление, имя героя и путь дальше.',
      build(scene) {
        const next = firstOtherScene(scene.id);
        return {
          location: scene.location || 'Начало пути',
          text: 'Добро пожаловать в мир приключений. Ваша история начинается здесь.',
          choices: [
            { text: 'Создать персонажа', to: next, icon: '🧝' },
            { text: 'Продолжить', to: next, icon: '➡️' }
          ],
          editorModules: ['story', 'choices']
        };
      }
    },
    {
      id: 'tpl_char_creation',
      icon: '🧙',
      title: 'Создание персонажа',
      category: 'Персонаж',
      filter: 'character',
      description: 'Сцена создания героя перед началом игры: имя, раса, класс, характеристики, предыстория.',
      build(scene) {
        const next = firstOtherScene(Editor.currentScene);
        return {
          sceneType: 'character_creation',
          location: 'Создание персонажа',
          title: 'Создание персонажа',
          text:
            'Перед вами чистый лист судьбы. Выберите происхождение, класс и расскажите о прошлом героя.',
          special: 'character_creation',
          sceneTemplate: 'character_creation',
          skipStandardExit: true,
          exitScene: next,
          components: [
            {
              component: 'character_creator',
              params: {
                displayMode: 'embedded',
                pointBuy: true,
                showBackstory: true,
                onComplete: 'char_creation_complete',
                onCancel: 'char_creation_cancel',
                showCancel: true
              }
            }
          ],
          choices: [],
          editorModules: ['story', 'components', 'template']
        };
      }
    },
    {
      id: 'tpl_dialogue',
      icon: '💬',
      title: 'Диалог',
      category: 'Социальное',
      filter: 'social',
      description: 'Реплика NPC и варианты ответов.',
      build(scene) {
        const next = firstOtherScene(Editor.currentScene);
        return {
          sceneType: 'dialog',
          location: scene.location || 'Разговор',
          text: '— Здравствуй, путник. Чем могу помочь?',
          dialogue: [{ speaker: 'NPC', text: 'Здравствуй, путник. Чем могу помочь?' }],
          choices: [
            { text: 'Спросить о делах', to: Editor.currentScene, icon: '❓' },
            { text: 'Уйти', to: next, icon: '🚪' }
          ],
          editorModules: ['story', 'npc', 'dialogue', 'choices']
        };
      }
    },
    {
      id: 'tpl_explore',
      icon: '🧭',
      title: 'Исследование',
      category: 'Локация',
      filter: 'location',
      description: 'Осмотр места и несколько направлений.',
      build(scene) {
        const next = firstOtherScene(Editor.currentScene);
        return {
          location: scene.location || 'Неизвестное место',
          text: 'Вы осматриваетесь. Здесь можно пойти разными путями.',
          choices: makeSceneChoiceChoices('Куда пойти?', [
            { text: 'Идти вперёд', to: next, icon: '➡️' },
            { text: 'Осмотреться ещё', to: Editor.currentScene, icon: '🔍' },
            { text: 'Вернуться', to: next, icon: '↩️' }
          ]),
          editorModules: ['story', 'choices']
        };
      }
    },
    {
      id: 'tpl_fork',
      icon: '🔀',
      title: 'Развилка',
      category: 'Сюжет',
      filter: 'quest',
      description: 'Важный выбор с несколькими исходами.',
      build(scene) {
        const next = firstOtherScene(Editor.currentScene);
        return {
          location: scene.location || 'Развилка',
          text: 'Перед вами важный выбор. Какой путь изберёте?',
          choices: [
            { text: 'Путь чести', to: next, icon: '⚖️' },
            { text: 'Путь силы', to: next, icon: '⚔️' },
            { text: 'Путь хитрости', to: next, icon: '🗡️' }
          ],
          editorModules: ['story', 'choices']
        };
      }
    },
    {
      id: 'tpl_combat',
      icon: '⚔️',
      title: 'Бой',
      category: 'Бой',
      filter: 'combat',
      description: 'Сцена с врагами и переходами победа/поражение.',
      build(scene) {
        const next = firstOtherScene(Editor.currentScene);
        const enemies = Object.keys(Editor.data?.enemies || {});
        return {
          sceneType: 'combat',
          location: scene.location || 'Место схватки',
          text: 'Враги преграждают путь!',
          combat: enemies.slice(0, 2).length ? enemies.slice(0, 2) : [],
          choices: [
            { text: 'После победы', to: next, icon: '🏆' },
            { text: 'Отступить', to: next, icon: '🏃' }
          ],
          editorModules: ['story', 'combat', 'choices']
        };
      }
    },
    {
      id: 'tpl_victory',
      icon: '🏆',
      title: 'Победа',
      category: 'Бой',
      filter: 'combat',
      description: 'Награда и продолжение после боя.',
      build(scene) {
        const next = firstOtherScene(Editor.currentScene);
        return {
          location: scene.location || 'Победа',
          text: 'Вы одержали победу! Добыча и слава ваши.',
          gold: scene.gold || 10,
          choices: [{ text: 'Продолжить', to: next, icon: '➡️' }],
          editorModules: ['story', 'items', 'choices']
        };
      }
    },
    {
      id: 'tpl_defeat',
      icon: '💀',
      title: 'Поражение',
      category: 'Бой',
      filter: 'combat',
      description: 'Последствие неудачи.',
      build(scene) {
        const next = firstOtherScene(Editor.currentScene);
        return {
          location: scene.location || 'Поражение',
          text: 'Силы иссякли… Но это ещё не конец.',
          choices: [
            { text: 'Попробовать снова', to: Editor.currentScene, icon: '🔄' },
            { text: 'Уйти', to: next, icon: '🚪' }
          ],
          editorModules: ['story', 'choices']
        };
      }
    },
    {
      id: 'tpl_reward',
      icon: '🎁',
      title: 'Награда',
      category: 'Квест',
      filter: 'quest',
      description: 'Выдача золота/предметов и переход дальше.',
      build(scene) {
        const next = firstOtherScene(Editor.currentScene);
        return {
          sceneType: 'reward',
          location: scene.location || 'Награда',
          text: 'Вам вручают заслуженную награду.',
          gold: 25,
          choices: [{ text: 'Принять и уйти', to: next, icon: '🙏' }],
          editorModules: ['story', 'items', 'choices']
        };
      }
    },
    {
      id: 'tpl_quest_complete',
      icon: '✅',
      title: 'Завершение квеста',
      category: 'Квест',
      filter: 'quest',
      description: 'Сдача задания и награда.',
      build(scene) {
        const next = firstOtherScene(Editor.currentScene);
        return {
          location: scene.location || 'Сдача квеста',
          text: '— Вы справились. Вот ваша награда.',
          choices: [
            { text: 'Получить награду', to: next, icon: '🎁' },
            { text: 'Поговорить ещё', to: Editor.currentScene, icon: '💬' }
          ],
          editorModules: ['story', 'npc', 'quest', 'choices']
        };
      }
    },
    {
      id: 'tpl_visual_village',
      icon: '🏘️',
      title: 'Point-and-click: Деревня',
      category: 'Visual',
      filter: 'visual',
      description: 'Визуальный слой с фоном и кликабельными домами (hotspot).',
      build() {
        const next = firstOtherScene(Editor.currentScene);
        const vr = typeof VisualRuntime !== 'undefined' ? VisualRuntime : null;
        const visual = vr && vr.createVillageDemoVisual
          ? vr.createVillageDemoVisual()
          : {
              mode: 'overlay',
              background: { asset: { type: 'image', ref: 'village_bg', src: 'assets/images/village.svg' } },
              nodes: [
                { id: 'hs_tavern', kind: 'hotspot', props: { label: 'Таверна', shape: 'rect' },
                  transform: { x: 0.1, y: 0.4, w: 0.18, h: 0.25, z: 2 },
                  events: { click: [{ action: 'change_scene', params: { sceneId: next } }] } },
                { id: 'hs_shop', kind: 'hotspot', props: { label: 'Лавка', shape: 'rect' },
                  transform: { x: 0.55, y: 0.4, w: 0.15, h: 0.2, z: 2 },
                  events: { click: [{ action: 'change_scene', params: { sceneId: next } }] } }
              ]
            };
        return {
          location: 'Деревня',
          text: 'Кликайте по домам на иллюстрации.',
          visual,
          editorModules: ['story', 'visual', 'choices']
        };
      }
    },
    {
      id: 'tpl_visual_interior',
      icon: '🚪',
      title: 'Point-and-click: Интерьер',
      category: 'Visual',
      filter: 'visual',
      description: 'Комната с дверью назад и интерактивным предметом.',
      build() {
        const hub = Editor.currentScene || 'village';
        return {
          location: 'Комната',
          text: 'Тесная комната. У двери скрипит петля.',
          visual: {
            mode: 'overlay',
            background: { asset: { type: 'image', src: 'assets/images/village.svg' } },
            nodes: [
              {
                id: 'hs_door',
                kind: 'hotspot',
                props: { label: 'Дверь', shape: 'rect', tooltip: 'Выйти' },
                transform: { x: 0.02, y: 0.35, w: 0.12, h: 0.35, z: 2 },
                events: { click: [{ action: 'change_scene', params: { sceneId: hub } }] }
              },
              {
                id: 'hs_chest',
                kind: 'hotspot',
                props: { label: 'Сундук', shape: 'rect', highlight: true },
                transform: { x: 0.72, y: 0.55, w: 0.14, h: 0.18, z: 2 },
                events: {
                  click: [{ action: 'say', params: { text: 'Сундук пуст.' } }],
                  hover: [{ action: 'say', params: { text: 'Старый сундук…' } }]
                }
              }
            ]
          },
          editorModules: ['story', 'visual']
        };
      }
    },
    {
      id: 'tpl_village',
      icon: '🏘️',
      title: 'Деревня',
      category: 'Локация',
      filter: 'location',
      description: 'Хаб с переходами к типичным местам.',
      build(scene) {
        const next = firstOtherScene(Editor.currentScene);
        return {
          sceneType: 'hub',
          location: 'Деревня',
          text: 'Тихая деревня. Здесь есть таверна, кузница и лавка.',
          choices: makeSceneChoiceChoices('Куда пойти?', [
            { text: 'Таверна', to: next, icon: '🏚️' },
            { text: 'Магазин', to: next, icon: '🛒' },
            { text: 'Кузница', to: next, icon: '⚒️' },
            { text: 'Уйти из деревни', to: next, icon: '🚪' }
          ]),
          editorModules: ['story', 'choices', 'hub', 'map']
        };
      }
    },
    {
      id: 'tpl_city',
      icon: '🏙️',
      title: 'Город',
      category: 'Локация',
      filter: 'location',
      description: 'Городской хаб с несколькими районами.',
      build(scene) {
        const next = firstOtherScene(Editor.currentScene);
        return {
          location: 'Город',
          text: 'Шумный город. Торговцы, стража и слухи на каждом углу.',
          choices: [
            { text: 'Рынок', to: next, icon: '🛒' },
            { text: 'Замок', to: next, icon: '🏰' },
            { text: 'Храм', to: next, icon: '⛪' },
            { text: 'Покинуть город', to: next, icon: '🚪' }
          ],
          editorModules: ['story', 'choices', 'hub']
        };
      }
    },
    {
      id: 'tpl_tavern',
      icon: '🏚️',
      title: 'Таверна',
      category: 'Локация',
      filter: 'location',
      description: 'Трактирщик, слухи и отдых.',
      build(scene) {
        const next = firstOtherScene(Editor.currentScene);
        return {
          location: 'Таверна',
          text: 'В таверне пахнет похлёбкой и дымом. Хозяин кивает вам.',
          dialogue: [{ speaker: 'Трактирщик', text: 'Место свободно. Слухи — за кружку.' }],
          choices: [
            { text: 'Спросить слухи', to: Editor.currentScene, icon: '👂' },
            { text: 'Отдохнуть', to: Editor.currentScene, icon: '🛏️' },
            { text: 'Уйти', to: next, icon: '🚪' }
          ],
          editorModules: ['story', 'npc', 'dialogue', 'choices']
        };
      }
    },
    {
      id: 'tpl_shop',
      icon: '🛒',
      title: 'Магазин',
      category: 'Торговля',
      filter: 'trade',
      description: 'Торговец + интерфейс торговли.',
      build(scene) {
        const next = firstOtherScene(Editor.currentScene);
        const invIds = Object.keys(Editor.data?.shopInventories || {});
        return {
          sceneType: 'shop',
          location: 'Магазин',
          text: 'На полках товары. Продавец ждёт.',
          special: 'shop',
          shopConfig: {
            title: 'Магазин',
            description: 'На полках товары. Продавец ждёт.',
            merchantNpcId: '',
            inventoryId: invIds[0] || '',
            sellMultiplier: 1,
            buyMultiplier: 0.5
          },
          components: [
            {
              component: 'trade_interface',
              params: {
                inventory: invIds[0] || '',
                title: 'Магазин'
              }
            }
          ],
          choices: [
            { text: 'Открыть магазин', to: Editor.currentScene, icon: '🛒' },
            { text: 'Поговорить', to: Editor.currentScene, icon: '💬' },
            { text: 'Уйти', to: next, icon: '🚪' }
          ],
          editorModules: ['story', 'npc', 'shop', 'choices']
        };
      }
    },
    {
      id: 'tpl_forge',
      icon: '⚒️',
      title: 'Кузница',
      category: 'Торговля',
      filter: 'trade',
      description: 'Кузнец: покупка, улучшение, ремонт.',
      build(scene) {
        const next = firstOtherScene(Editor.currentScene);
        return {
          sceneType: 'blacksmith',
          location: 'Кузница',
          text: 'Звон металла. Кузнец вытирает руки.',
          special: 'blacksmith',
          blacksmithConfig: {
            title: 'Кузница',
            description: 'Звон металла. Кузнец вытирает руки.',
            npcId: '',
            enableBuy: true,
            enableUpgrade: true,
            enableRepair: true
          },
          components: [
            {
              component: 'service_menu',
              params: {
                title: 'Услуги кузницы',
                services: [
                  { id: 'buy', label: 'Купить снаряжение', enabled: true },
                  { id: 'upgrade', label: 'Улучшить', enabled: true },
                  { id: 'repair', label: 'Ремонт', enabled: true }
                ]
              }
            },
            { component: 'trade_interface', params: { title: 'Товары кузницы' } },
            { component: 'interactive_panel', params: { label: 'Улучшение', panel: 'upgrade_panel' } },
            { component: 'interactive_panel', params: { label: 'Ремонт', panel: 'repair_panel' } }
          ],
          choices: [
            { text: 'Купить', to: Editor.currentScene, icon: '🛒' },
            { text: 'Улучшить', to: Editor.currentScene, icon: '⬆️' },
            { text: 'Ремонт', to: Editor.currentScene, icon: '🔧' },
            { text: 'Уйти', to: next, icon: '🚪' }
          ],
          editorModules: ['story', 'npc', 'blacksmith', 'choices']
        };
      }
    },
    {
      id: 'tpl_church',
      icon: '⛪',
      title: 'Церковь / храм',
      category: 'Социальное',
      filter: 'social',
      description: 'Служитель: лечение, благословение, пожертвование.',
      build(scene) {
        const next = firstOtherScene(Editor.currentScene);
        return {
          sceneType: 'church',
          location: 'Храм',
          text: 'Тихий свет свечей. Служитель встречает вас кивком.',
          special: 'temple',
          churchConfig: {
            title: 'Храм',
            description: 'Тихий свет свечей.',
            npcId: '',
            enableHeal: true, healCost: 50,
            enableBless: true, blessCost: 100,
            enableDonate: true, donateCost: 10
          },
          components: [
            {
              component: 'service_menu',
              params: {
                title: 'Услуги храма',
                services: [
                  { id: 'heal', label: 'Исцеление', cost: 50, enabled: true },
                  { id: 'bless', label: 'Благословение', cost: 100, enabled: true },
                  { id: 'donate', label: 'Пожертвование', cost: 10, enabled: true }
                ]
              }
            }
          ],
          choices: [
            { text: 'Исцелиться (50 зол.)', to: Editor.currentScene, icon: '✨' },
            { text: 'Благословение (100 зол.)', to: Editor.currentScene, icon: '🙏' },
            { text: 'Пожертвовать (10 зол.)', to: Editor.currentScene, icon: '💰' },
            { text: 'Уйти', to: next, icon: '🚪' }
          ],
          editorModules: ['story', 'npc', 'church', 'choices']
        };
      }
    },
    {
      id: 'tpl_npc_home',
      icon: '🏠',
      title: 'Дом NPC',
      category: 'Локация',
      filter: 'location',
      description: 'Визит к персонажу.',
      build(scene) {
        const next = firstOtherScene(Editor.currentScene);
        return {
          location: 'Дом',
          text: 'Вас приглашают войти. Хозяин дома ждёт разговора.',
          choices: [
            { text: 'Поговорить', to: Editor.currentScene, icon: '💬' },
            { text: 'Уйти', to: next, icon: '🚪' }
          ],
          editorModules: ['story', 'npc', 'dialogue', 'choices']
        };
      }
    },
    {
      id: 'tpl_castle',
      icon: '🏰',
      title: 'Замок',
      category: 'Локация',
      filter: 'location',
      description: 'Тронный зал и охрана.',
      build(scene) {
        const next = firstOtherScene(Editor.currentScene);
        return {
          location: 'Замок',
          text: 'Высокие залы и стража у колонн.',
          choices: [
            { text: 'К правителю', to: next, icon: '👑' },
            { text: 'К страже', to: Editor.currentScene, icon: '🛡️' },
            { text: 'Покинуть замок', to: next, icon: '🚪' }
          ],
          editorModules: ['story', 'choices']
        };
      }
    },
    {
      id: 'tpl_dungeon',
      icon: '🕳️',
      title: 'Подземелье',
      category: 'Локация',
      filter: 'location',
      description: 'Опасный путь, бой и добыча.',
      build(scene) {
        const next = firstOtherScene(Editor.currentScene);
        return {
          location: 'Подземелье',
          text: 'Сырой воздух и эхо шагов. Впереди — опасность.',
          choices: [
            { text: 'Идти глубже', to: next, icon: '⬇️' },
            { text: 'Искать тайник', to: Editor.currentScene, icon: '🔍' },
            { text: 'Выбраться', to: next, icon: '🚪' }
          ],
          editorModules: ['story', 'combat', 'choices']
        };
      }
    },
    {
      id: 'tpl_camp',
      icon: '🏕️',
      title: 'Лагерь',
      category: 'Локация',
      filter: 'location',
      description: 'Отдых, сохранение темпа истории.',
      build(scene) {
        const next = firstOtherScene(Editor.currentScene);
        return {
          location: 'Лагерь',
          text: 'Костёр потрескивает. Можно перевести дух.',
          choices: [
            { text: 'Отдохнуть', to: Editor.currentScene, icon: '🔥' },
            { text: 'Сняться с лагеря', to: next, icon: '➡️' }
          ],
          editorModules: ['story', 'choices', 'time']
        };
      }
    },
    {
      id: 'tpl_quest_accept',
      icon: '📜',
      title: 'Получение квеста',
      category: 'Квест',
      filter: 'quest',
      description: 'Диалог с квестодателем и принятие задания.',
      build(scene) {
        const next = firstOtherScene(Editor.currentScene);
        return {
          sceneType: 'quest',
          location: scene.location || 'Квестодатель',
          text: '— Мне нужна ваша помощь. Возьмётесь?',
          choices: [
            { text: 'Принять задание', to: next, icon: '📜' },
            { text: 'Отказаться', to: next, icon: '🙅' },
            { text: 'Узнать подробности', to: Editor.currentScene, icon: '❓' }
          ],
          editorModules: ['story', 'npc', 'quest', 'choices']
        };
      }
    },
    {
      id: 'tpl_quest_turnin',
      icon: '🗂️',
      title: 'Сдача квеста',
      category: 'Квест',
      filter: 'quest',
      description: 'Возвращение к квестодателю.',
      build(scene) {
        const next = firstOtherScene(Editor.currentScene);
        return {
          location: scene.location || 'Квестодатель',
          text: '— Ну как, справились?',
          choices: [
            { text: 'Доложить о выполнении', to: next, icon: '✅' },
            { text: 'Ещё не готово', to: next, icon: '⏳' }
          ],
          editorModules: ['story', 'npc', 'quest', 'choices']
        };
      }
    },
    {
      id: 'tpl_npc_meet',
      icon: '🤝',
      title: 'Встреча с NPC',
      category: 'Социальное',
      filter: 'social',
      description: 'Первая встреча и ветка диалога.',
      build(scene) {
        const next = firstOtherScene(Editor.currentScene);
        return {
          sceneType: 'dialog',
          location: scene.location || 'Встреча',
          text: 'Незнакомец останавливает вас взглядом.',
          dialogue: [{ speaker: 'Незнакомец', text: 'Постой. Нам нужно поговорить.' }],
          choices: [
            { text: 'Выслушать', to: Editor.currentScene, icon: '👂' },
            { text: 'Пройти мимо', to: next, icon: '🚶' }
          ],
          editorModules: ['story', 'npc', 'dialogue', 'choices']
        };
      }
    },
    {
      id: 'tpl_story_choice',
      icon: '⚖️',
      title: 'Важный сюжетный выбор',
      category: 'Сюжет',
      filter: 'quest',
      description: 'Моральный/сюжетный выбор с последствиями.',
      build(scene) {
        const next = firstOtherScene(Editor.currentScene);
        return {
          location: scene.location || 'Решающий момент',
          text: 'От вашего решения зависит многое.',
          choices: [
            { text: 'Поступить по совести', to: next, icon: '💛' },
            { text: 'Поступить расчётливо', to: next, icon: '🧠' },
            { text: 'Отложить решение', to: Editor.currentScene, icon: '⏸️' }
          ],
          editorModules: ['story', 'choices']
        };
      }
    },
    {
      id: 'tpl_reputation',
      icon: '⭐',
      title: 'Репутационная сцена',
      category: 'Социальное',
      filter: 'social',
      description: 'Сцена, завязанная на отношении фракции.',
      build(scene) {
        const next = firstOtherScene(Editor.currentScene);
        return {
          location: scene.location || 'Слухи о вас',
          text: 'Ваше имя уже слышали. Репутация открывает — или закрывает — двери.',
          choices: [
            { text: 'Опереться на славу', to: next, icon: '⭐' },
            { text: 'Держаться скромно', to: next, icon: '🤫' }
          ],
          editorModules: ['story', 'choices']
        };
      }
    },
    {
      id: 'tpl_scene_choice',
      icon: '🗺️',
      title: 'Выбор сцены / куда пойти',
      category: 'Локация',
      filter: 'location',
      description: 'Несколько кнопок-переходов на разные сцены.',
      build(scene) {
        const ids = sceneIds();
        const dests = ids.slice(0, 4).map((id) => {
          const sc = Editor.data.scenes[id];
          return {
            text: sc.location || sc.title || id,
            to: id,
            icon: '📍'
          };
        });
        while (dests.length < 2) {
          dests.push({ text: 'Локация', to: Editor.currentScene, icon: '📍' });
        }
        return {
          sceneType: 'transition',
          location: scene.location || 'Куда пойти?',
          text: 'Куда вы направитесь?',
          choices: makeSceneChoiceChoices('Куда пойти?', dests),
          editorModules: ['story', 'scene_choice', 'choices'],
          sceneChoice: { title: 'Куда пойти?', destinations: dests }
        };
      }
    }
    ,
    {
      id: 'tpl_empty',
      icon: '✏️',
      title: 'Пустая сцена',
      category: 'Сюжет',
      filter: 'quest',
      description: 'Только название и текст — соберите сами.',
      build(scene) {
        return {
          sceneType: 'custom',
          location: scene.location || 'Новая сцена',
          text: '',
          choices: [],
          editorModules: ['story', 'choices']
        };
      }
    },
    {
      id: 'tpl_hub_simple',
      icon: '🏠',
      title: 'Хаб',
      category: 'Локация',
      filter: 'location',
      description: 'Центральная точка с несколькими переходами.',
      build(scene) {
        const next = firstOtherScene(Editor.currentScene);
        return {
          sceneType: 'hub',
          location: scene.location || 'Поселение',
          text: 'Вы в центре поселения. Куда направитесь?',
          choices: [
            { text: 'Место 1', to: next, icon: '📍' },
            { text: 'Место 2', to: next, icon: '📍' },
            { text: 'Уйти', to: next, icon: '🚪' }
          ],
          editorModules: ['story', 'choices', 'hub']
        };
      }
    },
    {
      id: 'tpl_location',
      icon: '🌲',
      title: 'Локация',
      category: 'Локация',
      filter: 'location',
      description: 'Описание места и переходы дальше.',
      build(scene) {
        const next = firstOtherScene(Editor.currentScene);
        return {
          sceneType: 'custom',
          location: scene.location || 'Локация',
          text: 'Вы осматриваете окрестности.',
          choices: [
            { text: 'Идти дальше', to: next, icon: '➡️' },
            { text: 'Осмотреться', to: Editor.currentScene, icon: '🔍' }
          ],
          editorModules: ['story', 'choices', 'map']
        };
      }
    }

  ];

  /**
   * Apply a scene template pack entry.
   *
   * CANONICAL API (do not change silently):
   *   applySceneTemplatePack(packId)
   *   applySceneTemplatePack(packId, { mode: 'create' })
   *     → CREATE a new scene from the pack, select it, return new scene id.
   *
   *   applySceneTemplatePack(packId, { applyToCurrent: true })
   *   applySceneTemplatePack(packId, { mode: 'apply' })
   *     → PATCH the current scene in place, return current scene id.
   *
   * Compatibility:
   *   - `mode: 'apply'` ≡ `applyToCurrent: true`
   *   - `mode: 'create'` ≡ default (explicit)
   *   - Unknown mode falls back to create (safe default).
   *
   * @returns {string|false} scene id or false if pack missing
   */
  Editor.applySceneTemplatePack = function (packId, opts) {
    const def = PACK.find((p) => p.id === packId);
    if (!def) return false;
    opts = opts || {};
    const modeRaw = opts.mode != null ? String(opts.mode).toLowerCase() : '';
    const applyToCurrent = opts.applyToCurrent === true || modeRaw === 'apply' || modeRaw === 'patch';
    if (applyToCurrent) {
      const scene = ensureScene();
      const patch = def.build.call(this, scene);
      applyPack(scene, patch);
      if (Editor.toast) Editor.toast.success('Шаблон «' + def.title + '» применён к сцене');
      return Editor.currentScene;
    }
    // default + mode:'create' → new scene
    const id = createSceneFromPack(def);
    if (Editor.toast) Editor.toast.success('Создана сцена «' + def.title + '»');
    return id;
  };

  /** Explicit aliases (same semantics as applySceneTemplatePack). */
  Editor.createSceneFromTemplatePack = function (packId) {
    return Editor.applySceneTemplatePack(packId, { mode: 'create' });
  };
  Editor.applySceneTemplatePackToCurrent = function (packId) {
    return Editor.applySceneTemplatePack(packId, { mode: 'apply' });
  };

  Editor.listSceneTemplatePack = function () {
    return PACK.map(({ id, icon, title, category, filter, description }) => ({
      id, icon, title, category, filter, description
    }));
  };

  Editor.buildSceneTemplatePackPatch = function (packId, scene) {
    const def = PACK.find((p) => p.id === packId);
    if (!def) return null;
    const sc = scene || { id: 'tmp', location: '', text: '', choices: [] };
    return def.build.call(this, sc);
  };

  Editor.getSceneTemplatePackDef = function (packId) {
    return PACK.find((p) => p.id === packId) || null;
  };

  if (typeof globalThis !== 'undefined') {
    globalThis.SceneTemplatePackApi = {
      PACK,
      buildPatch(packId, scene, editor) {
        const ed = editor || (typeof Editor !== 'undefined' ? Editor : null);
        if (!ed || typeof ed.buildSceneTemplatePackPatch !== 'function') return null;
        return ed.buildSceneTemplatePackPatch(packId, scene);
      }
    };
  }

  /** Scene Choice editor helpers — mutate choices only, no full architecture change */
  Editor.addSceneChoiceDestination = function () {
    const scene = ensureScene();
    if (!Array.isArray(scene.choices)) scene.choices = [];
    scene.choices.push({ text: 'Новый путь', to: firstOtherScene(Editor.currentScene), icon: '➡️' });
    if (!scene.editorModules) scene.editorModules = [];
    if (!scene.editorModules.includes('choices')) scene.editorModules.push('choices');
    this.renderSceneEditor?.();
    this.updateJSONPreview?.();
  };

  // Register into Templates library
  if (Editor.templates && typeof Editor.templates.register === 'function') {
    PACK.forEach((p) => {
      Editor.templates.register({
        id: p.id,
        icon: p.icon,
        title: p.title,
        category: p.category,
        description: p.description,
        create() {
          Editor.applySceneTemplatePack(p.id);
          if (typeof this.switchTab === 'function') this.switchTab('scenes');
        }
      });
    });
  }

  // Extend openCreateSceneModal list with pack entries if present
  if (typeof Editor.openCreateSceneModal === 'function' && Editor.hooks?.replace) {
    let savedPrevOpen;
    savedPrevOpen = Editor.hooks.replace('openCreateSceneModal', function openCreateSceneModalWithPack() {
      savedPrevOpen.call(this);
      const list = document.getElementById('scene-template-picker-list');
      if (!list || list.dataset.packExtended === '1') {
        Editor.updateSceneTemplatePickerChrome?.();
        return;
      }
      list.dataset.packExtended = '1';
      const packHtml = PACK.map((p) => {
        return `<button type="button" class="template-card btn btn-secondary" data-action="apply-scene-pack" data-pack-id="${esc(p.id)}">
          <span class="template-card__icon">${p.icon}</span>
          <span class="template-card__title">${esc(p.title)}</span>
          <span class="template-card__desc">${esc(p.description)}</span>
        </button>`;
      }).join('');
      list.insertAdjacentHTML('beforeend', packHtml);
      Editor.updateSceneTemplatePickerChrome?.();
    }, 'editor-scene-template-pack');
  }

  // Delegation for pack buttons (once)
  if (typeof document !== 'undefined' && !window._scenePackClickBound) {
    window._scenePackClickBound = true;
    document.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest && e.target.closest('[data-action="apply-scene-pack"]');
      if (!btn) return;
      e.preventDefault();
      const id = btn.getAttribute('data-pack-id');
      if (!id) return;
      if (Editor._sceneTemplatePickerMode === 'replace') {
        if (typeof Editor.runSceneTemplateReplace === 'function') {
          Editor.runSceneTemplateReplace(() => Editor.applySceneTemplatePack(id, { applyToCurrent: true }));
        }
      } else {
        Editor.applySceneTemplatePack(id);
        if (typeof Editor.closeCreateSceneModal === 'function') Editor.closeCreateSceneModal();
      }
    }, true);
  }
})();
