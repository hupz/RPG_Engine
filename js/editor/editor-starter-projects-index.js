/**
 * Phase 1.18 — Starter project templates (pure builders).
 * Isolated project JSON; no Mill / runtime coupling.
 */
(function attachStarterProjectsIndex(global) {
  'use strict';

  const STARTER_IDS = Object.freeze([
    'blank_rpg',
    'text_rpg',
    'visual_adventure',
    'village_demo'
  ]);

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function baseMeta(title, opts) {
    opts = opts || {};
    return {
      title: title || opts.defaultTitle || 'New RPG',
      version: '1.0',
      author: '',
      description: opts.description || '',
      system: opts.system || 'generic',
      campaignId: opts.campaignId || null,
      templateId: opts.templateId || null,
      dataVersion: opts.dataVersion || 'starter-1.0'
    };
  }

  function emptyBuckets() {
    return {
      startingFlags: {},
      reputation: {},
      achievements: {},
      classes: {},
      items: {},
      ingredients: {},
      recipes: {},
      enemies: {},
      npcs: {},
      quests: {},
      assets: {},
      worldMap: {},
      audio: { catalog: {}, defaults: { damageType: {}, effectType: {}, attack: {} } },
      statusEffects: {}
    };
  }

  /** 1. Blank RPG — single start scene, ready to author */
  function buildBlankRpg(title, opts) {
    opts = opts || {};
    const buckets = emptyBuckets();
    return {
      meta: baseMeta(title || 'Blank RPG', {
        description: 'Empty starter: one start scene. Add scenes, items, and quests.',
        system: opts.system || 'generic',
        campaignId: 'blank_rpg',
        templateId: 'blank_rpg',
        dataVersion: 'starter-blank-1.0'
      }),
      system: opts.system || 'generic',
      startScene: 'start',
      ...buckets,
      scenes: {
        start: {
          id: 'start',
          location: 'Начало',
          title: 'Start',
          text: 'Ваша история начинается здесь. Добавьте текст, выборы или visual-узлы.',
          choices: [],
          sceneType: 'custom',
          editorModules: ['story', 'choices']
        }
      }
    };
  }

  /** 2. Text RPG — hub + two branches + return */
  function buildTextRpg(title, opts) {
    opts = opts || {};
    const buckets = emptyBuckets();
    buckets.items = {
      rusty_key: {
        name: 'Rusty Key',
        type: 'key',
        desc: 'Opens the cellar door.',
        description: 'Opens the cellar door.'
      }
    };
    buckets.quests = {
      find_key: {
        id: 'find_key',
        name: 'Find the Key',
        title: 'Find the Key',
        description: 'Search the crossroads for a rusty key.',
        stages: [
          { id: '0', name: 'Start', title: 'Ask around' },
          { id: '1', name: 'Search', title: 'Search the path' },
          { id: '2', name: 'Done', title: 'Return home', finish: true }
        ]
      }
    };
    return {
      meta: baseMeta(title || 'Text RPG', {
        description: 'Classic text adventure: hub, branches, item, quest.',
        system: opts.system || 'generic',
        campaignId: 'text_rpg',
        templateId: 'text_rpg',
        dataVersion: 'starter-text-1.0'
      }),
      system: opts.system || 'generic',
      startScene: 'hub',
      ...buckets,
      scenes: {
        hub: {
          id: 'hub',
          location: 'Crossroads',
          title: 'Hub',
          text: 'Вы стоите на развилке. На север — лесная тропа, на восток — деревенский колодец.',
          sceneType: 'hub',
          editorModules: ['story', 'choices'],
          choices: [
            { text: 'Идти в лес', icon: '🌲', to: 'forest_path' },
            { text: 'К колодцу', icon: '🪣', to: 'well' }
          ]
        },
        forest_path: {
          id: 'forest_path',
          location: 'Forest Path',
          title: 'Forest',
          text: 'Среди корней блестит ржавый ключ.',
          sceneType: 'custom',
          editorModules: ['story', 'choices'],
          choices: [
            {
              text: 'Поднять ключ',
              icon: '🔑',
              to: 'hub',
              actions: [
                { action: 'add_item', params: { itemId: 'rusty_key', count: 1 } },
                { action: 'update_quest', params: { questId: 'find_key', stage: '1' } },
                { action: 'say', params: { text: 'Вы нашли Rusty Key.' } }
              ]
            },
            { text: 'Вернуться', icon: '↩️', to: 'hub' }
          ]
        },
        well: {
          id: 'well',
          location: 'Village Well',
          title: 'Well',
          text: 'У колодца запертая дверь в погреб. Нужен ключ.',
          sceneType: 'custom',
          editorModules: ['story', 'choices'],
          choices: [
            {
              text: 'Открыть погреб (нужен ключ)',
              icon: '🚪',
              to: 'cellar',
              showIf: { all: [{ hasItem: 'rusty_key' }] }
            },
            {
              text: 'Дверь заперта',
              icon: '🔒',
              to: 'well',
              showIf: { all: [{ notHasItem: 'rusty_key' }] },
              actions: [{ action: 'say', params: { text: 'Нужен ключ.' } }]
            },
            { text: 'Назад к развилке', icon: '↩️', to: 'hub' }
          ]
        },
        cellar: {
          id: 'cellar',
          location: 'Cellar',
          title: 'Cellar',
          text: 'В погребе тихо. Квест можно завершить.',
          sceneType: 'custom',
          editorModules: ['story', 'choices'],
          choices: [
            {
              text: 'Завершить поиски',
              icon: '✅',
              to: 'hub',
              actions: [
                { action: 'update_quest', params: { questId: 'find_key', stage: 'complete' } },
                { action: 'add_gold', params: { amount: 10 } },
                { action: 'say', params: { text: 'Вы нашли тайник (+10 золота).' } }
              ]
            }
          ]
        }
      }
    };
  }

  /** 3. Visual Adventure — overlay scene with hotspots */
  function buildVisualAdventure(title, opts) {
    opts = opts || {};
    const buckets = emptyBuckets();
    buckets.assets = {
      adventure_bg: {
        type: 'image',
        src: 'assets/images/village.svg',
        name: 'Adventure background'
      }
    };
    buckets.items = {
      trail_map: {
        name: 'Trail Map',
        type: 'misc',
        desc: 'A rough map of the clearing.',
        description: 'A rough map of the clearing.'
      }
    };
    return {
      meta: baseMeta(title || 'Visual Adventure', {
        description: 'Visual overlay starter: hotspots, loot, second scene.',
        system: opts.system || 'generic',
        campaignId: 'visual_adventure',
        templateId: 'visual_adventure',
        dataVersion: 'starter-visual-1.0'
      }),
      system: opts.system || 'generic',
      startScene: 'clearing',
      ...buckets,
      scenes: {
        clearing: {
          id: 'clearing',
          location: 'Sunny Clearing',
          title: 'Clearing',
          text: 'Поляна. Кликайте по объектам на сцене.',
          sceneType: 'custom',
          editorModules: ['story', 'visual', 'choices'],
          choices: [
            { text: 'Уйти к лагерю (текстом)', icon: '⛺', to: 'camp' }
          ],
          visual: {
            mode: 'overlay',
            background: {
              asset: {
                type: 'image',
                ref: 'adventure_bg',
                src: 'assets/images/village.svg'
              }
            },
            nodes: [
              {
                id: 'hs_chest',
                kind: 'hotspot',
                layer: 'world',
                transform: { x: 0.55, y: 0.45, w: 0.16, h: 0.14, z: 2 },
                visible: true,
                enabled: true,
                props: { label: 'Сундук', debugDraw: true },
                showIf: { all: [{ notFlag: 'chest_looted' }] },
                events: {
                  click: [
                    { action: 'say', params: { text: 'Вы открыли сундук.' } },
                    { action: 'add_item', params: { itemId: 'trail_map', count: 1 } },
                    { action: 'add_gold', params: { amount: 5 } },
                    { action: 'set_flag', params: { flag: 'chest_looted', value: true } }
                  ]
                }
              },
              {
                id: 'hs_camp',
                kind: 'hotspot',
                layer: 'world',
                transform: { x: 0.12, y: 0.5, w: 0.18, h: 0.16, z: 2 },
                visible: true,
                enabled: true,
                props: { label: 'Лагерь', debugDraw: true },
                events: {
                  click: [
                    { action: 'change_scene', params: { sceneId: 'camp' } }
                  ]
                }
              }
            ]
          }
        },
        camp: {
          id: 'camp',
          location: 'Camp',
          title: 'Camp',
          text: 'Небольшой лагерь у опушки. Можно отдохнуть.',
          sceneType: 'custom',
          editorModules: ['story', 'choices'],
          choices: [
            {
              text: 'Отдохнуть',
              icon: '🛏️',
              to: 'camp',
              actions: [
                { action: 'heal', params: { amount: '5' } },
                { action: 'say', params: { text: 'Вы немного восстановились.' } }
              ]
            },
            { text: 'Вернуться на поляну', icon: '↩️', to: 'clearing' }
          ]
        }
      }
    };
  }

  /**
   * 4. Village Demo — clone of visual_village / DEMO_VISUAL_VILLAGE_DATA when available.
   * Isolated campaignId; never mutates Mill.
   */
  function buildVillageDemo(title, opts) {
    opts = opts || {};
    let src = null;
    if (typeof DEMO_VISUAL_VILLAGE_DATA !== 'undefined' && DEMO_VISUAL_VILLAGE_DATA) {
      src = deepClone(DEMO_VISUAL_VILLAGE_DATA);
    } else if (opts.villageData) {
      src = deepClone(opts.villageData);
    }
    if (!src) {
      // Minimal fallback if demo script not loaded
      const fallback = buildVisualAdventure(title || 'Village Demo', opts);
      fallback.meta.templateId = 'village_demo';
      fallback.meta.campaignId = 'village_demo';
      fallback.meta.description = 'Village demo fallback (visual adventure).';
      fallback.meta.title = title || 'Village Demo';
      return fallback;
    }
    src.meta = src.meta || {};
    src.meta.title = title || src.meta.title || 'Village Demo';
    src.meta.templateId = 'village_demo';
    src.meta.campaignId = 'village_demo';
    src.meta.description = src.meta.description ||
      'Isolated village vertical slice template (not Mill).';
    src.meta.dataVersion = src.meta.dataVersion || 'starter-village-1.0';
    src.system = src.system || src.meta.system || 'generic';
    if (!src.startScene) {
      const keys = Object.keys(src.scenes || {});
      src.startScene = keys.includes('village') ? 'village' : keys[0];
    }
    return src;
  }

  const BUILDERS = {
    blank_rpg: buildBlankRpg,
    text_rpg: buildTextRpg,
    visual_adventure: buildVisualAdventure,
    village_demo: buildVillageDemo
  };

  const CATALOG = Object.freeze([
    {
      id: 'blank_rpg',
      label: 'Blank RPG',
      icon: '📄',
      description: 'One empty start scene — build from scratch.'
    },
    {
      id: 'text_rpg',
      label: 'Text RPG',
      icon: '📖',
      description: 'Hub, branches, item, quest — classic text loop.'
    },
    {
      id: 'visual_adventure',
      label: 'Visual Adventure',
      icon: '🗺️',
      description: 'Overlay scene with hotspots, loot, and camp.'
    },
    {
      id: 'village_demo',
      label: 'Village Demo',
      icon: '🏘️',
      description: 'Isolated village vertical slice (demo data).'
    }
  ]);

  function listStarterProjects() {
    return CATALOG.slice();
  }

  function buildStarterProject(templateId, title, opts) {
    const fn = BUILDERS[templateId];
    if (!fn) return null;
    const data = fn(title, opts || {});
    // Ensure startScene always set
    if (!data.startScene && data.scenes) {
      const keys = Object.keys(data.scenes);
      data.startScene = keys[0] || 'start';
    }
    return data;
  }

  const api = {
    STARTER_IDS,
    CATALOG,
    listStarterProjects,
    buildStarterProject,
    buildBlankRpg,
    buildTextRpg,
    buildVisualAdventure,
    buildVillageDemo
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof global !== 'undefined') {
    global.StarterProjectsIndex = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global);
