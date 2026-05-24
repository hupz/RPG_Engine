// Реестр обработчиков special-сцен (Plugin API).
// Встроенные — registerMany; JSON — plugins.specialScenes; свои — register() из внешнего JS.

const SpecialSceneRegistry = {
  _entries: {},

  /**
   * Регистрация кастомного обработчика.
   * @param {string} id — уникальный ID (совпадает с полем scene.special)
   * @param {string} label — человекочитаемое название для редактора
   * @param {function|string} handler — функция(engine, sceneId, scene) ИЛИ строка-имя метода GameEngine
   */
  register(id, label, handler) {
    if (!id || !handler) return;
    this._entries[id] = { label: label || id, handler };
  },

  /** Массовая регистрация из массива [id, label, handler] */
  registerMany(list) {
    if (!Array.isArray(list)) return;
    list.forEach(([id, label, handler]) => this.register(id, label, handler));
  },

  has(id) {
    return !!this._entries[id];
  },

  list() {
    return Object.entries(this._entries).map(([id, e]) => ({ id, label: e.label }));
  },

  allIds() {
    return Object.keys(this._entries);
  },

  /**
   * Выполнение обработчика.
   * Поддерживает: функцию, строку-метод GameEngine, JSON-конфиг из plugins.specialScenes.
   * @returns {boolean} true если обработчик найден и выполнен
   */
  run(engine, sceneId, scene) {
    const entry = this._entries[scene?.special];
    if (!entry) return false;

    if (typeof entry.handler === 'function') {
      try {
        entry.handler(engine, sceneId, scene);
      } catch (e) {
        console.error(`[PluginAPI] Error in special "${scene.special}":`, e);
      }
      return true;
    }

    if (typeof entry.handler === 'string') {
      const method = engine[entry.handler];
      if (typeof method === 'function') {
        method.call(engine, sceneId, scene);
        return true;
      }
      console.warn(`[PluginAPI] Method "${entry.handler}" not found on GameEngine`);
      return false;
    }

    return false;
  }
};

/**
 * Создаёт функцию-обработчик из JSON-конфига.
 * Поддерживает: choices, flags, items, gold, text, dialogue.
 */
function createJsonSpecialHandler(config) {
  return function jsonSpecialHandler(engine, sceneId, scene) {
    if (config.flags && typeof config.flags === 'object') {
      engine.applyFlags(config.flags);
    }

    if (Array.isArray(config.items)) {
      config.items.forEach((itemId) => engine.addItem(itemId));
    }

    if (typeof config.gold === 'number' && config.gold > 0) {
      engine.state.gold += config.gold;
      engine.updateStats();
      engine.log(`💰 +${config.gold} зм`, 'log-heal');
    }

    engine.setLocation(scene?.location || config.location || '—');

    if (config.text) engine.setText(config.text);
    else if (scene?.text) engine.setText(scene.text);

    if (Array.isArray(config.dialogue)) engine.setDialogue(config.dialogue);
    else engine.clearDialogue();

    if (Array.isArray(config.choices)) {
      engine.setChoices(config.choices);
    } else {
      engine.setChoices([]);
    }

    engine.saveGame();
  };
}

/** Регистрация встроенных обработчиков и plugins.specialScenes — после загрузки game_data */
SpecialSceneRegistry._registerBuiltins = function (engine) {
  const eng = engine || { data: {} };

  SpecialSceneRegistry.registerMany([
    ['haggle', 'Торг (Марта)', 'handleHaggle'],
    ['shop_jack', 'Лавка Джека', 'handleShopJack'],
    ['forest_loot_check', 'Обыск в лесу', 'handleForestLoot'],
    ['barn_chest', 'Сундук в сарае', 'handleBarnChest'],
    ['attic', 'Чердак мельницы', 'handleAttic'],
    ['jack_buy_potion', 'Покупка зелья', 'handleJackBuyPotion'],
    ['jack_buy_rope', 'Покупка верёвки', 'handleJackBuyRope'],
    ['jack_buy_supplies', 'Покупка припасов', 'handleJackBuySupplies'],
    ['jack_buy_fireball_scroll', 'Покупка свитка Огненного шара', 'handleJackBuyFireballScroll'],
    ['jack_buy_focus_potion', 'Покупка зелья фокусировки', 'handleJackBuyFocusPotion'],
    ['gear_top', 'Шестерня (верх)', 'handleGearTop'],
    ['gear_mid', 'Шестерня (середина)', 'handleGearMid'],
    ['gear_bot', 'Шестерня (низ)', 'handleGearBot'],
    ['boss_talk', 'Разговор с боссом', 'handleBossTalk'],
    ['boss_albert', 'Альберт (босс)', 'handleBossAlbert'],
    ['boss_mercy', 'Пощада боссу', 'handleBossMercy'],
    ['cellar_first', 'Погреб (первый раз)', 'handleCellarFirst'],
    ['cellar_intimidate', 'Погреб (запугивание)', 'handleCellarIntimidate'],
    ['cellar_after', 'Погреб (после)', 'handleCellarAfter'],
    ['cellar_search', 'Погреб (обыск)', 'handleCellarSearch'],
    ['reset', 'Сброс игры', 'handleResetFromSpecial']
  ]);

  const plugins = eng.data?.plugins?.specialScenes;
  if (plugins && typeof plugins === 'object') {
    for (const [id, config] of Object.entries(plugins)) {
      if (!config || typeof config !== 'object') continue;
      if (SpecialSceneRegistry.has(id)) {
        console.warn(`[PluginAPI] special "${id}" already registered, skipping JSON override`);
        continue;
      }
      const handler = createJsonSpecialHandler(config);
      SpecialSceneRegistry.register(id, config.label || id, handler);
    }
  }
};

if (typeof window !== 'undefined') {
  window.SpecialSceneRegistry = SpecialSceneRegistry;
  window.createJsonSpecialHandler = createJsonSpecialHandler;
}

// Встроенные ID в datalist редактора до загрузки game_data
SpecialSceneRegistry._registerBuiltins({ data: {} });
