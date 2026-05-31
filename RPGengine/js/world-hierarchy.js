// ============================================
// Иерархия мира: Мир → Регион → Хаб → Сцена
// Наследование inherited / ownState
// ============================================

const WorldHierarchy = (function () {
  const TIME_LABELS = {
    morning: 'Утро',
    day: 'День',
    evening: 'Вечер',
    night: 'Ночь'
  };
  const WEATHER_LABELS = {
    clear: 'Ясно',
    cloudy: 'Облачно',
    rain: 'Дождь',
    snow: 'Снег',
    fog: 'Туман'
  };

  const HUB_TYPE_ICONS = {
    village: '🏘️',
    city: '🏰',
    dungeon: '🕳️',
    wilderness: '🌲',
    default: '📍'
  };

  /** Глубокое слияние объектов (массивы заменяются) */
  function deepMerge(...layers) {
    const out = {};
    layers.forEach((layer) => {
      if (!layer || typeof layer !== 'object') return;
      Object.keys(layer).forEach((key) => {
        const val = layer[key];
        if (val && typeof val === 'object' && !Array.isArray(val) && typeof out[key] === 'object' && !Array.isArray(out[key])) {
          out[key] = deepMerge(out[key], val);
        } else {
          out[key] = val;
        }
      });
    });
    return out;
  }

  function ensureWorldHierarchy(data) {
    if (!data) return;
    if (!data.worlds || typeof data.worlds !== 'object') data.worlds = {};
    if (!data.regions || typeof data.regions !== 'object') data.regions = {};
    if (!data.hubs || typeof data.hubs !== 'object') data.hubs = {};

    // Миграция: деревня Тихая река (один раз, если хаба ещё нет)
    if (!data.hubs.village_tihaya && data.scenes?.village_hub) {
      migrateVillageHub(data);
    }
  }

  /** Привязка существующих сцен деревни к хабу village_tihaya */
  function migrateVillageHub(data) {
    if (!data.worlds.world_main) {
      data.worlds.world_main = {
        name: 'Основной мир',
        regions: ['region_tihaya_river']
      };
    }
    if (!data.regions.region_tihaya_river) {
      data.regions.region_tihaya_river = {
        name: 'Долина Тихой реки',
        parent: 'world_main',
        hubs: ['village_tihaya'],
        inherited: {
          climate: 'temperate',
          factionBase: 'rep_village'
        }
      };
    }

    const childScenes = [
      'village_hub',
      'tavern',
      'jack_shop',
      'blacksmith',
      'temple',
      'forest_path'
    ].filter((id) => data.scenes[id]);

    data.hubs.village_tihaya = {
      name: 'Деревня Тихая река',
      parent: 'region_tihaya_river',
      type: 'village',
      hubScene: 'village_hub',
      scenes: childScenes,
      inherited: {
        music: 'buff',
        timeOfDay: 'morning',
        weather: 'clear',
        reputation: { rep_village: 0 },
        ambient: 'buff',
        npcsAvailable: ['marta', 'jack']
      }
    };

    const sceneOwnState = {
      tavern: { innkeeper: 'marta', menu: 'tavern_menu', roomPrice: 5 },
      jack_shop: { merchant: 'jack', inventory: 'village_shop' },
      blacksmith: { blacksmith: 'blacksmith_npc' },
      temple: { priest: 'priest', healPrice: 25 }
    };

    childScenes.forEach((sid) => {
      const sc = data.scenes[sid];
      if (!sc) return;
      sc.parent = 'village_tihaya';
      if (sc.inherits == null) sc.inherits = true;
      if (sceneOwnState[sid] && !sc.ownState) sc.ownState = sceneOwnState[sid];
      if (!sc.hubScene) sc.hubScene = 'village_hub';
      if (sid !== 'village_hub' && sc.returnsToHub == null) {
        sc.returnsToHub = true;
      }
    });
  }

  function getHubIdForScene(data, sceneId) {
    const scene = data?.scenes?.[sceneId];
    if (scene?.parent && data?.hubs?.[scene.parent]) return scene.parent;
    for (const [hubId, hub] of Object.entries(data?.hubs || {})) {
      if (hub.scenes?.includes(sceneId)) return hubId;
      if (hub.hubScene === sceneId) return hubId;
    }
    return null;
  }

  /** Цепочка узлов снизу вверх: [hub, region, world] */
  function getParentChain(data, sceneId) {
    const chain = [];
    const scene = data?.scenes?.[sceneId];
    if (!scene) return chain;

    let hubId = scene.parent && data.hubs?.[scene.parent] ? scene.parent : getHubIdForScene(data, sceneId);
    if (hubId && data.hubs[hubId]) {
      chain.push({ type: 'hub', id: hubId, node: data.hubs[hubId] });
      const regionId = data.hubs[hubId].parent;
      if (regionId && data.regions[regionId]) {
        chain.push({ type: 'region', id: regionId, node: data.regions[regionId] });
        const worldId = data.regions[regionId].parent;
        if (worldId && data.worlds[worldId]) {
          chain.push({ type: 'world', id: worldId, node: data.worlds[worldId] });
        }
      }
    }
    return chain;
  }

  function getRuntimeInherited(gameState, type, id) {
    const bucket = gameState?.worldState?.[`${type}s`]?.[id]?.inherited;
    return bucket && typeof bucket === 'object' ? bucket : {};
  }

  function getStaticInherited(data, type, id) {
    if (type === 'hub') return data?.hubs?.[id]?.inherited || {};
    if (type === 'region') return data?.regions?.[id]?.inherited || {};
    if (type === 'world') return data?.worlds?.[id]?.inherited || {};
    return {};
  }

  function getNodeMergedInherited(data, gameState, type, id) {
    return deepMerge(
      getStaticInherited(data, type, id),
      getRuntimeInherited(gameState, type, id)
    );
  }

  /**
   * Итоговое состояние сцены (регион → хаб → ownState).
   * @param {object} data — game_data
   * @param {object} [gameState] — сохранение игрока (worldState)
   * @param {string} sceneId
   */
  function getSceneState(data, gameState, sceneId) {
    const scene = data?.scenes?.[sceneId];
    if (!scene) return {};

    const chain = getParentChain(data, sceneId);
    const layers = [];

    // Сверху вниз: world → region → hub (в chain порядок hub, region, world — развернём)
    const ordered = [...chain].reverse();
    ordered.forEach((link) => {
      layers.push(getNodeMergedInherited(data, gameState, link.type, link.id));
    });

    if (scene.inherits !== false) {
      if (scene.ownState && typeof scene.ownState === 'object') {
        layers.push(scene.ownState);
      }
    } else if (scene.ownState) {
      return { ...scene.ownState };
    }

    return deepMerge(...layers);
  }

  function ensureWorldState(gameState) {
    if (!gameState.worldState) {
      gameState.worldState = { worlds: {}, regions: {}, hubs: {} };
    }
    if (!gameState.worldState.hubs) gameState.worldState.hubs = {};
    if (!gameState.worldState.regions) gameState.worldState.regions = {};
    if (!gameState.worldState.worlds) gameState.worldState.worlds = {};
  }

  /**
   * Изменить наследуемое состояние хаба (сохраняется в прохождении).
   */
  function setHubState(data, gameState, hubId, key, value) {
    if (!data?.hubs?.[hubId]) return false;
    ensureWorldState(gameState);
    if (!gameState.worldState.hubs[hubId]) {
      gameState.worldState.hubs[hubId] = { inherited: {} };
    }
    if (!gameState.worldState.hubs[hubId].inherited) {
      gameState.worldState.hubs[hubId].inherited = {};
    }
    if (key === 'reputation' && value && typeof value === 'object') {
      gameState.worldState.hubs[hubId].inherited.reputation = deepMerge(
        gameState.worldState.hubs[hubId].inherited.reputation || {},
        value
      );
      Object.entries(value).forEach(([flag, val]) => {
        if (!gameState.flags) gameState.flags = {};
        gameState.flags[flag] = val;
      });
    } else {
      gameState.worldState.hubs[hubId].inherited[key] = value;
    }
    return true;
  }

  function setRegionState(data, gameState, regionId, key, value) {
    if (!data?.regions?.[regionId]) return false;
    ensureWorldState(gameState);
    if (!gameState.worldState.regions[regionId]) {
      gameState.worldState.regions[regionId] = { inherited: {} };
    }
    gameState.worldState.regions[regionId].inherited[key] = value;
    return true;
  }

  /** Аудио из inherited: music / ambient → id для AudioEngine */
  function resolveInheritedAudio(state) {
    if (!state) return null;
    const id = state.music || state.ambient;
    if (!id) return null;
    return String(id).replace(/\.mp3$/i, '');
  }

  function formatAtmosphereLine(state) {
    if (!state) return '';
    const parts = [];
    if (state.timeOfDay && TIME_LABELS[state.timeOfDay]) {
      parts.push(TIME_LABELS[state.timeOfDay]);
    }
    if (state.weather && WEATHER_LABELS[state.weather]) {
      parts.push(WEATHER_LABELS[state.weather]);
    }
    if (state.climate) parts.push(state.climate);
    return parts.length ? `🌤 ${parts.join(' · ')}` : '';
  }

  function applyReputationFromState(gameState, state) {
    if (!state?.reputation || typeof state.reputation !== 'object') return;
    if (!gameState.flags) gameState.flags = {};
    Object.entries(state.reputation).forEach(([flag, val]) => {
      if (gameState.flags[flag] == null) gameState.flags[flag] = val;
    });
  }

  /** После отдыха в дочерней сцене — сдвиг времени суток в хабе */
  function onRestInScene(data, gameState, sceneId, restType) {
    const hubId = getHubIdForScene(data, sceneId);
    if (!hubId) return;
    const nextTime = restType === 'short' ? 'day' : 'evening';
    setHubState(data, gameState, hubId, 'timeOfDay', nextTime);
    const hubStatic = data.hubs[hubId]?.inherited || {};
    if (nextTime === 'evening' && hubStatic.musicEvening) {
      setHubState(data, gameState, hubId, 'music', hubStatic.musicEvening);
    } else if (nextTime === 'evening') {
      setHubState(data, gameState, hubId, 'music', 'buff');
    }
  }

  function getHubIcon(hub) {
    return HUB_TYPE_ICONS[hub?.type] || HUB_TYPE_ICONS.default;
  }

  function buildTree(data) {
    ensureWorldHierarchy(data);
    const roots = Object.keys(data.worlds || {});
    return roots.map((worldId) => {
      const world = data.worlds[worldId];
      const regions = (world.regions || [])
        .filter((rid) => data.regions[rid])
        .map((regionId) => {
          const region = data.regions[regionId];
          const hubs = (region.hubs || [])
            .filter((hid) => data.hubs[hid])
            .map((hubId) => {
              const hub = data.hubs[hubId];
              const scenes = (hub.scenes || [])
                .filter((sid) => data.scenes[sid])
                .map((sid) => ({
                  id: sid,
                  name: data.scenes[sid].name || data.scenes[sid].location || sid,
                  type: data.scenes[sid].type || data.scenes[sid].sceneTemplate || ''
                }));
              return {
                id: hubId,
                name: hub.name || hubId,
                type: 'hub',
                icon: getHubIcon(hub),
                hubScene: hub.hubScene,
                scenes
              };
            });
          return {
            id: regionId,
            name: region.name || regionId,
            type: 'region',
            icon: '❄️',
            hubs
          };
        });
      return {
        id: worldId,
        name: world.name || worldId,
        type: 'world',
        icon: '🌍',
        regions
      };
    });
  }

  function bindGameEngine() {
    if (typeof GameEngine === 'undefined') return;
    GameEngine.getSceneState = function (sceneId) {
      return getSceneState(this.data, this.state, sceneId || this.state?.scene);
    };
    GameEngine.setHubState = function (hubId, key, value) {
      const ok = setHubState(this.data, this.state, hubId, key, value);
      if (ok && getHubIdForScene(this.data, this.state?.scene) === hubId) {
        this.applyInheritedSceneAmbience?.(this.state.scene);
      }
      if (ok) this.saveGame?.();
      return ok;
    };
    GameEngine.getHubIdForScene = function (sceneId) {
      return getHubIdForScene(this.data, sceneId || this.state?.scene);
    };
    GameEngine.applyInheritedSceneAmbience = function (sceneId) {
      const st = getSceneState(this.data, this.state, sceneId);
      applyReputationFromState(this.state, st);
      const atmo = formatAtmosphereLine(st);
      if (atmo) {
        const loc = document.getElementById('location');
        if (loc && !loc.dataset.atmoAppended) {
          const base = loc.textContent.replace(/\s*🌤.*$/, '');
          loc.textContent = base + (base ? ' ' : '') + atmo;
          loc.dataset.atmoAppended = '1';
        }
      }
      this._lastInheritedState = st;
    };
  }

  bindGameEngine();
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', bindGameEngine);
  }

  return {
    TIME_LABELS,
    WEATHER_LABELS,
    ensureWorldHierarchy,
    migrateVillageHub,
    getHubIdForScene,
    getParentChain,
    getSceneState,
    setHubState,
    setRegionState,
    resolveInheritedAudio,
    formatAtmosphereLine,
    applyReputationFromState,
    onRestInScene,
    getHubIcon,
    buildTree,
    deepMerge
  };
})();

if (typeof window !== 'undefined') {
  window.WorldHierarchy = WorldHierarchy;
}
