/**
 * Phase F — Built-in prefab / template library (seed on demand)
 */
(function attachPrefabLibrary() {
  'use strict';

  const BUILTIN = [
    {
      id: 'pf_village_hotspots',
      type: 'visual',
      name: 'Деревня: hotspots',
      description: 'Таверна, лавка, кузница — кликабельные зоны поверх фона.',
      tags: ['village', 'visual'],
      nodes: [
        {
          id: 'hs_tavern',
          kind: 'hotspot',
          props: { label: 'Таверна', shape: 'rect', tooltip: 'Таверна' },
          transform: { x: 0.08, y: 0.38, w: 0.2, h: 0.28, z: 2 },
          events: { click: [{ action: 'change_scene', params: { sceneId: 'tavern' } }] }
        },
        {
          id: 'hs_shop',
          kind: 'hotspot',
          props: { label: 'Лавка', shape: 'rect' },
          transform: { x: 0.52, y: 0.42, w: 0.16, h: 0.22, z: 2 },
          events: { click: [{ action: 'change_scene', params: { sceneId: 'shop' } }] }
        },
        {
          id: 'hs_smith',
          kind: 'hotspot',
          props: { label: 'Кузница', shape: 'circle' },
          transform: { x: 0.72, y: 0.5, w: 0.14, h: 0.14, z: 2 },
          events: { click: [{ action: 'change_scene', params: { sceneId: 'forge' } }] }
        }
      ]
    },
    {
      id: 'pf_shop_interior',
      type: 'visual',
      name: 'Интерьер: лавка',
      description: 'Прилавок + выход.',
      tags: ['interior', 'shop'],
      nodes: [
        {
          id: 'hs_counter',
          kind: 'hotspot',
          props: { label: 'Прилавок', shape: 'rect', highlight: true },
          transform: { x: 0.35, y: 0.45, w: 0.3, h: 0.2, z: 2 },
          events: { click: [{ action: 'open_panel', params: { panel: 'trade' } }] }
        },
        {
          id: 'hs_exit',
          kind: 'hotspot',
          props: { label: 'Выход', shape: 'rect', tooltip: 'На улицу' },
          transform: { x: 0.02, y: 0.35, w: 0.1, h: 0.3, z: 2 },
          events: { click: [{ action: 'change_scene', params: { sceneId: 'village' } }] }
        }
      ]
    },
    {
      id: 'pf_hud_actions',
      type: 'ui',
      name: 'HUD: журнал + инвентарь',
      description: 'Две иконки-кнопки в правом верхнем углу.',
      tags: ['hud'],
      nodes: [
        {
          id: 'btn_journal',
          kind: 'button',
          text: 'Журнал',
          props: { widget: 'journal_button', layout: { anchor: 'top-right', marginX: 0.02, marginY: 0.02 } },
          transform: { x: 0.82, y: 0.02, w: 0.1, h: 0.07, z: 10 },
          events: { click: [{ action: 'open_panel', params: { panel: 'journal' } }] }
        },
        {
          id: 'btn_inventory',
          kind: 'button',
          text: 'Инвентарь',
          props: { widget: 'inventory_button', layout: { anchor: 'top-right', marginX: 0.14, marginY: 0.02 } },
          transform: { x: 0.68, y: 0.02, w: 0.12, h: 0.07, z: 11 },
          events: { click: [{ action: 'open_panel', params: { panel: 'inventory' } }] }
        }
      ]
    },
    {
      id: 'pf_journal_panel',
      type: 'ui',
      name: 'UI: панель журнала',
      description: 'Overlay с заголовком и кнопкой закрытия.',
      tags: ['journal', 'overlay'],
      nodes: [
        {
          id: 'panel_bg',
          kind: 'panel',
          transform: { x: 0.15, y: 0.1, w: 0.7, h: 0.75, z: 20 },
          props: { layout: { anchor: 'center' } },
          style: { background: 'rgba(10,14,24,0.92)' }
        },
        {
          id: 'title',
          kind: 'text',
          text: '📜 Журнал квестов',
          binding: 'quest.activeTitle',
          transform: { x: 0.2, y: 0.14, w: 0.6, h: 0.08, z: 21 }
        },
        {
          id: 'btn_close',
          kind: 'button',
          text: '✕',
          transform: { x: 0.78, y: 0.12, w: 0.06, h: 0.06, z: 22 },
          events: { click: [{ action: 'open_panel', params: { panel: 'none' } }] }
        }
      ]
    },
    {
      id: 'pf_main_menu_block',
      type: 'ui',
      name: 'UI: главное меню',
      description: 'Новая игра / продолжить / настройки.',
      tags: ['menu'],
      nodes: [
        {
          id: 'menu_bg',
          kind: 'panel',
          transform: { x: 0.25, y: 0.2, w: 0.5, h: 0.55, z: 1 },
          style: { background: 'rgba(0,0,0,0.65)' }
        },
        {
          id: 'btn_new',
          kind: 'button',
          text: 'Новая игра',
          transform: { x: 0.32, y: 0.32, w: 0.36, h: 0.08, z: 2 },
          events: { click: [{ action: 'change_scene', params: { sceneId: 'start' } }] }
        },
        {
          id: 'btn_load',
          kind: 'button',
          text: 'Продолжить',
          transform: { x: 0.32, y: 0.44, w: 0.36, h: 0.08, z: 2 },
          events: { click: [{ action: 'load_game', params: {} }] }
        },
        {
          id: 'btn_settings',
          kind: 'button',
          text: 'Настройки',
          transform: { x: 0.32, y: 0.56, w: 0.36, h: 0.08, z: 2 },
          events: { click: [{ action: 'open_panel', params: { panel: 'settings' } }] }
        }
      ]
    }
  ];

  const api = {
    BUILTIN_PREFABS: BUILTIN,

    getBuiltinPrefab(id) {
      return BUILTIN.find((p) => p.id === id) || null;
    },

    listBuiltinPrefabs(typeFilter) {
      return BUILTIN.filter((p) => !typeFilter || p.type === typeFilter);
    },

    seedBuiltinPrefabs(data, opts) {
      opts = opts || {};
      if (!data || typeof ProjectSchema === 'undefined') return [];
      const PS = ProjectSchema;
      const added = [];
      BUILTIN.forEach((def) => {
        if (opts.onlyMissing && data.prefabs?.[def.id]) return;
        const pid = PS.registerPrefab(data, def.id, def);
        if (pid) added.push(pid);
      });
      return added;
    }
  };

  if (typeof globalThis !== 'undefined') globalThis.PrefabLibrary = api;
  if (typeof window !== 'undefined') window.PrefabLibrary = api;
})();
