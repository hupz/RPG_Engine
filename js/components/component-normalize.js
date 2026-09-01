// Нормализация legacy-компонентов → v3 (обратная совместимость)
const SceneComponentNormalize = (function () {
  const LEGACY_PANEL = {
    repair: 'repair_panel',
    upgrade: 'upgrade_panel',
    enhance: 'upgrade_panel',
    heal: null,
    curse_remove: 'curse_remove_panel',
    gambling: 'gamble_panel',
    crafting: 'craft_panel'
  };

  const LEGACY_HEADER = {
    repair: '⚒️ Ремонт',
    upgrade: '⬆️ Заточка',
    enhance: '⬆️ Заточка',
    heal: '🩹 Лечение',
    curse_remove: '✨ Снятие проклятий',
    gambling: '🎲 Азарт',
    crafting: '🔨 Создание'
  };

  function normalize(comp) {
    if (!comp || typeof comp !== 'object') return comp;
    const type = comp.component || comp.type;
    if (!type) return comp;

    if (type === 'trade') {
      return {
        ...comp,
        component: 'trade_interface',
        params: { ...(comp.params || comp.config || {}), _legacyTrade: true }
      };
    }

    if (type === 'interactive') {
      return {
        ...comp,
        component: 'interactive_panel',
        params: comp.params || comp.config || {}
      };
    }

    if (type === 'dialogue') {
      return {
        ...comp,
        component: 'dialogue_tree',
        params: comp.params || comp.config || {}
      };
    }

    const panelId = LEGACY_PANEL[type];
    if (panelId && comp._wrapServiceMenu !== false) {
      return {
        ...comp,
        component: 'service_menu',
        _legacyWrapped: type,
        params: {
          header: LEGACY_HEADER[type] || 'Услуги',
          services: [
            {
              id: `${type}_panel`,
              type: 'panel',
              panel: panelId,
              panelParams: { ...(comp.params || comp.config || {}) }
            }
          ]
        }
      };
    }

    if (comp.config && !comp.params) {
      return { ...comp, params: comp.config };
    }

    return comp;
  }

  function normalizeList(components) {
    if (!Array.isArray(components)) return [];
    return components.map(normalize);
  }

  return { normalize, normalizeList, LEGACY_PANEL };
})();

if (typeof window !== 'undefined') {
  window.SceneComponentNormalize = SceneComponentNormalize;
}
