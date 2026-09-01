/* engine bundle generated 2026-09-01T20:11:41.766Z */

;/* —— js/engine-version.js —— */
/**
 * ENGINE VERSION — единственный runtime-источник.
 * Генерируется из package.json (scripts/sync-version.mjs).
 * НЕ редактировать вручную число версии здесь.
 */
(function (global) {
  'use strict';
  var VERSION = "1.1.0";
  global.ENGINE_VERSION = VERSION;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ENGINE_VERSION: VERSION, version: VERSION };
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);


;/* —— js/data-schema.js —— */
// ============================================================
// Project data schema version + единая миграция при загрузке
// ============================================================
(function (global) {
  const DATA_VERSION = 5;

  /**
   * Нормализация ability.effect: string → object
   */
  function normalizeAbilityEffect(effect) {
    if (effect == null) return { type: 'damage', value: '1d6', damageType: 'physical' };
    if (typeof effect === 'object' && effect.type) return effect;
    if (typeof effect !== 'string') return { type: 'custom', desc: String(effect) };
    const s = effect.trim();
    if (s.startsWith('heal:')) return { type: 'heal', value: s.slice(5), targeting: { scope: 'self' } };
    if (s.startsWith('damage:')) return { type: 'damage', value: s.slice(7), damageType: 'physical' };
    if (s === 'extra_attack') return { type: 'extra_attack' };
    if (s.startsWith('ac_bonus:')) return { type: 'buff', buffType: 'ac', value: parseInt(s.slice(9), 10) || 2, targeting: { scope: 'self' } };
    if (s === 'magic_missile') return { type: 'magic_missile' };
    if (s.startsWith('aoe_fire:')) {
      return { type: 'damage', value: s.slice(9), damageType: 'fire', targeting: { scope: 'all_enemies' } };
    }
    if (s.startsWith('smite:')) return { type: 'smite', value: s.slice(6) };
    return { type: 'custom', desc: s };
  }

  function migrateAbilitiesInClass(cls) {
    if (!cls || !Array.isArray(cls.abilities)) return;
    cls.abilities.forEach((ab) => {
      if (!ab || typeof ab === 'string') return;
      if (typeof ab.effect === 'string' || (ab.effect && !ab.effect.type && !Array.isArray(ab.effects))) {
        ab.effect = normalizeAbilityEffect(ab.effect);
      }
    });
  }

  /**
   * Единый каталог умений: progression.abilities.
   * Классы хранят только id-ссылки. Встроенные объекты поднимаются в пул.
   * Идемпотентна.
   */
  function migrateClassAbilitiesToPool(data) {
    if (!data || typeof data !== 'object') return;
    if (!data.progression || typeof data.progression !== 'object') {
      data.progression = {
        enabled: true,
        maxLevel: 5,
        expTable: [0, 100, 220, 380, 600],
        defaults: {},
        abilities: {}
      };
    }
    if (!data.progression.abilities || typeof data.progression.abilities !== 'object') {
      data.progression.abilities = {};
    }
    const pool = data.progression.abilities;

    Object.entries(data.classes || {}).forEach(([classId, cls]) => {
      if (!cls || !Array.isArray(cls.abilities)) return;
      const ids = [];
      const seen = new Set();

      cls.abilities.forEach((ab, i) => {
        if (ab == null) return;
        let aid = null;

        if (typeof ab === 'string') {
          aid = ab.trim();
          if (!aid) return;
        } else if (typeof ab === 'object') {
          aid = String(ab.id || (classId + '_ability_' + (i + 1))).trim();
          if (!aid) return;
          if (typeof ab.effect === 'string' || (ab.effect && !ab.effect.type && !Array.isArray(ab.effects))) {
            ab.effect = normalizeAbilityEffect(ab.effect);
          }
          if (!pool[aid]) {
            const copy = JSON.parse(JSON.stringify(ab));
            copy.id = aid;
            pool[aid] = copy;
          }
        } else {
          return;
        }

        if (!seen.has(aid)) {
          seen.add(aid);
          ids.push(aid);
        }
      });

      cls.abilities = ids;
    });

    Object.entries(pool).forEach(([id, ab]) => {
      if (!ab || typeof ab !== 'object') return;
      if (!ab.id) ab.id = id;
      if (typeof ab.effect === 'string' || (ab.effect && !ab.effect.type && !Array.isArray(ab.effects))) {
        ab.effect = normalizeAbilityEffect(ab.effect);
      }
    });
  }

  function migrateScenes(data) {
    Object.values(data.scenes || {}).forEach((sc) => {
      if (!sc || typeof sc !== 'object') return;
      if (!Array.isArray(sc.editorModules) && (sc.text || sc.choices || sc.combat)) {
        // не форсируем editorModules — редактор выводит сам
      }
      // audio string → object
      if (typeof sc.audio === 'string') {
        sc.audio = { ambient: sc.audio, loop: true, volume: 0.7 };
      }
    });
  }

  function migrateQuests(data) {
    if (typeof QuestMigrate !== 'undefined' && typeof QuestMigrate.migrateAll === 'function') {
      if (data.questsVersion !== 2) { QuestMigrate.migrateAll(data); data.questsVersion = 2; }
      return;
    }
    if (typeof QuestMigrate !== 'undefined' && typeof QuestMigrate.normalizeAll === 'function') {
      QuestMigrate.normalizeAll(data);
    }
  }

  /**
   * Единая точка: data → актуальная схема.
   * Идемпотентна: повторный вызов безопасен.
   */
  function migrateProjectData(data) {
    if (!data || typeof data !== 'object') return data;
    if (!data.meta) data.meta = {};

    const from = parseInt(data.meta.dataVersion, 10) || 0;

    // v0/v1/v2 → v3
    if (from < 3) {
      migrateScenes(data);
      migrateQuests(data);
      Object.values(data.classes || {}).forEach(migrateAbilitiesInClass);
      if (data.progression?.abilities) {
        Object.values(data.progression.abilities).forEach((ab) => {
          if (ab && (typeof ab.effect === 'string' || (ab.effect && !ab.effect.type))) {
            ab.effect = normalizeAbilityEffect(ab.effect);
          }
        });
      }
      if (!data.meta.storyGraph) data.meta.storyGraph = { positions: {} };
    }

    // v3 → v4: умения классов → общий пул, классы хранят id
    if (from < 4) {
      migrateClassAbilitiesToPool(data);
    } else {
      // Идемпотентная нормализация на случай смешанных данных
      migrateClassAbilitiesToPool(data);
    }

    // v4 → v5: visual / ui / assets / unified events (Phase A)
    if (typeof ProjectSchema !== 'undefined' && typeof ProjectSchema.normalizeProjectAuthoring === 'function') {
      ProjectSchema.normalizeProjectAuthoring(data);
    }

    // playerCharacters is optional — do not auto-create a hero
    if (data.playerCharacters != null && typeof data.playerCharacters !== 'object') {
      data.playerCharacters = {};
    }

    data.meta.dataVersion = DATA_VERSION;
    if (!data.meta.version) data.meta.version = '1.0';
    return data;
  }

  function getDataVersion(data) {
    return parseInt(data?.meta?.dataVersion, 10) || 0;
  }

  global.ProjectDataSchema = {
    DATA_VERSION,
    migrateProjectData,
    migrateClassAbilitiesToPool,
    normalizeAbilityEffect,
    getDataVersion,
    validateProjectAuthoring(data) {
      if (typeof ProjectSchema !== 'undefined' && typeof ProjectSchema.validateProjectAuthoring === 'function') {
        return ProjectSchema.validateProjectAuthoring(data);
      }
      return { ok: true, issues: [] };
    },
    normalizeProjectAuthoring(data) {
      if (typeof ProjectSchema !== 'undefined' && typeof ProjectSchema.normalizeProjectAuthoring === 'function') {
        return ProjectSchema.normalizeProjectAuthoring(data);
      }
      return data;
    }
  };

  // Авто-хук GameEngine при наличии
  if (typeof global.GameEngine !== 'undefined') {
    // no-op: подключение через save-load / data load
  }
})(typeof window !== 'undefined' ? window : globalThis);


;/* —— js/project-schema.js —— */
// ============================================================
// Phase A — Project model: visual / ui / assets / events
// Shared normalization + validation (Editor + Runtime + export)
// ============================================================
(function (global) {
  'use strict';

  const VISUAL_KINDS = Object.freeze(['image', 'text', 'button', 'panel', 'hotspot']);
  const HOTSPOT_SHAPES = Object.freeze(['rect', 'circle', 'polygon']);
  const UI_KINDS = Object.freeze(['image', 'text', 'button', 'panel', 'bar', 'gold', 'level', 'portrait']);
  const UI_SCREEN_TYPES = Object.freeze(['hud', 'main_menu', 'journal', 'inventory', 'pause', 'dialogue', 'custom']);
  const UI_ANCHORS = Object.freeze(['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center']);
  const UI_SMART_WIDGETS = Object.freeze(['journal_button', 'inventory_button', 'icon_action', 'quest_tracker']);
  const ASSET_TYPES = Object.freeze(['image', 'audio', 'font', 'data']);
  const PREFAB_TYPES = Object.freeze(['visual', 'ui']);

  /** @param {string} [prefix] */
  function createStableId(prefix) {
    const p = String(prefix || 'obj').replace(/[^a-z0-9_]/gi, '_').slice(0, 24) || 'obj';
    const hex = Math.floor(Math.random() * 0xffffffff)
      .toString(16)
      .padStart(8, '0');
    return p + '_' + hex;
  }

  /** @param {string} [prefix] @param {Set<string>} [used] */
  function createUniqueStableId(prefix, used) {
    const set = used || new Set();
    for (let i = 0; i < 32; i++) {
      const id = createStableId(prefix);
      if (!set.has(id)) return id;
    }
    return createStableId(prefix) + '_' + Date.now().toString(36).slice(-4);
  }

  function clamp01(n, fallback) {
    const v = Number(n);
    if (!Number.isFinite(v)) return fallback;
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
  }

  /**
   * Unified event step: { action, params }
   * Accepts legacy: type, id, OpenScene, onClick arrays
   */
  function normalizeEventStep(step) {
    if (!step || typeof step !== 'object') return null;
    const action = step.action || step.type || step.id;
    if (!action || typeof action !== 'string') return null;
    const params = step.params && typeof step.params === 'object' ? { ...step.params } : {};
    if (action === 'OpenScene' || action === 'open_scene') {
      return {
        action: 'change_scene',
        params: {
          sceneId: params.sceneId || params.scene || params.to || ''
        }
      };
    }
    return { action, params };
  }

  /**
   * Unified events object — canonical key: click[]
   */
  function normalizeEvents(events) {
    const out = {};
    if (!events || typeof events !== 'object') return out;
    const clickRaw = events.click || events.onClick || events.OnClick;
    if (Array.isArray(clickRaw)) {
      out.click = clickRaw.map(normalizeEventStep).filter(Boolean);
    } else if (clickRaw && typeof clickRaw === 'object') {
      const one = normalizeEventStep(clickRaw);
      if (one) out.click = [one];
    }
    const hoverRaw = events.hover || events.onHover || events.OnHover;
    if (Array.isArray(hoverRaw)) {
      out.hover = hoverRaw.map(normalizeEventStep).filter(Boolean);
    } else if (hoverRaw && typeof hoverRaw === 'object') {
      const one = normalizeEventStep(hoverRaw);
      if (one) out.hover = [one];
    }
    ['enter', 'show', 'exit'].forEach((key) => {
      const raw = events[key];
      if (Array.isArray(raw)) {
        out[key] = raw.map(normalizeEventStep).filter(Boolean);
      } else if (raw && typeof raw === 'object') {
        const one = normalizeEventStep(raw);
        if (one) out[key] = [one];
      }
    });
    return out;
  }

  function normalizeAssetEntry(raw, id) {
    if (!raw || typeof raw !== 'object') return null;
    const type = ASSET_TYPES.includes(raw.type) ? raw.type : 'image';
    const ref = id != null ? String(id) : (raw.ref != null ? String(raw.ref) : '');
    const src = raw.src != null ? String(raw.src) : (raw.path != null ? String(raw.path) : '');
    const name = raw.name != null ? String(raw.name) : ref;
    if (!ref && !src) return null;
    const out = { type, name };
    if (ref) out.ref = ref;
    if (src) out.src = src;
    if (raw.uid) out.uid = String(raw.uid);
    if (Array.isArray(raw.tags)) out.tags = raw.tags.slice();
    return out;
  }

  function normalizeAssetRef(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const type = raw.type || 'image';
    const ref = raw.ref != null ? String(raw.ref) : '';
    const src = raw.src != null ? String(raw.src) : '';
    if (!ref && !src) return null;
    return { type, ref: ref || undefined, src: src || undefined };
  }

  function normalizeVisualNode(raw, index, usedIds) {
    if (!raw || typeof raw !== 'object') return null;
    let kind = String(raw.kind || raw.type || 'hotspot').toLowerCase();
    if (VISUAL_KINDS.indexOf(kind) === -1) kind = 'hotspot';
    const t = raw.transform || raw;
    let id = String(raw.id || kind + '_' + (index + 1));
    if (usedIds && usedIds.has(id)) {
      id = createUniqueStableId(kind, usedIds);
    }
    if (usedIds) usedIds.add(id);

    const node = {
      id,
      kind,
      layer: raw.layer === 'hud' ? 'hud' : 'world',
      transform: {
        x: clamp01(t.x != null ? t.x : raw.x, 0),
        y: clamp01(t.y != null ? t.y : raw.y, 0),
        w: clamp01(t.w != null ? t.w : (t.width != null ? t.width : raw.width), 0.1),
        h: clamp01(t.h != null ? t.h : (t.height != null ? t.height : raw.height), 0.1),
        z: Number.isFinite(Number(t.z != null ? t.z : (t.zIndex != null ? t.zIndex : raw.zIndex)))
          ? Number(t.z != null ? t.z : (t.zIndex != null ? t.zIndex : raw.zIndex))
          : index
      },
      visible: raw.visible !== false,
      enabled: raw.enabled !== false,
      showIf: raw.showIf != null ? raw.showIf : (raw.conditions != null ? raw.conditions : null),
      asset: normalizeAssetRef(raw.asset),
      props: raw.props && typeof raw.props === 'object' ? { ...raw.props } : {},
      events: normalizeEvents(raw.events)
    };
    if (raw.uid) node.uid = String(raw.uid);
    else node.uid = createStableId(kind);
    if (raw.text != null && node.props.text == null) node.props.text = String(raw.text);
    if (raw.label != null && node.props.label == null) node.props.label = String(raw.label);
    if (raw.locked != null) node.locked = !!raw.locked;
    if (raw.prefabLink && typeof raw.prefabLink === 'object') {
      const link = normalizePrefabLink(raw.prefabLink);
      if (link) node.prefabLink = link;
    }
    if (node.kind === 'hotspot') {
      const shape = String(node.props.shape || raw.shape || 'rect').toLowerCase();
      node.props.shape = HOTSPOT_SHAPES.indexOf(shape) >= 0 ? shape : 'rect';
      if (Array.isArray(node.props.points)) {
        node.props.points = node.props.points
          .filter((p) => p && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)))
          .map((p) => ({ x: clamp01(p.x, 0), y: clamp01(p.y, 0) }));
      }
    }
    return node;
  }

  function normalizeSceneVisual(scene) {
    if (!scene || typeof scene !== 'object') return scene;
    const visual = scene.visual;
    if (!visual || typeof visual !== 'object') return scene;

    const usedIds = new Set();
    const nodesIn = Array.isArray(visual.nodes) ? visual.nodes : [];
    const nodes = nodesIn.map((n, i) => normalizeVisualNode(n, i, usedIds)).filter(Boolean);

    let background = null;
    if (visual.background) {
      const asset = normalizeAssetRef(visual.background.asset || visual.background);
      if (asset) background = { asset };
    }

    const mode = visual.mode === 'overlay' ? 'overlay'
      : (visual.mode === 'none' ? 'none' : (nodes.length || background ? 'overlay' : null));

    if (!mode && !nodes.length && !background) {
      delete scene.visual;
      return scene;
    }

    scene.visual = {
      mode: mode || 'overlay',
      background,
      nodes
    };
    return scene;
  }

  function normalizeUiNode(raw, index, usedIds) {
    if (!raw || typeof raw !== 'object') return null;
    const kind = String(raw.kind || raw.type || 'panel').toLowerCase();
    if (UI_KINDS.indexOf(kind) === -1) return null;
    const t = raw.transform || raw;
    let id = String(raw.id || 'ui_' + (index + 1));
    if (usedIds && usedIds.has(id)) {
      id = createUniqueStableId('ui', usedIds);
    }
    if (usedIds) usedIds.add(id);

    const layout = raw.props?.layout && typeof raw.props.layout === 'object'
      ? { ...raw.props.layout }
      : {};
    if (layout.anchor && UI_ANCHORS.indexOf(layout.anchor) < 0) delete layout.anchor;

    const props = raw.props && typeof raw.props === 'object' ? { ...raw.props } : {};
    if (Object.keys(layout).length) props.layout = layout;
    if (raw.props?.widget && UI_SMART_WIDGETS.indexOf(String(raw.props.widget)) >= 0) {
      props.widget = String(raw.props.widget);
    }

    const node = {
      id,
      uid: raw.uid ? String(raw.uid) : createStableId('ui'),
      kind,
      layer: raw.layer || 'hud',
      transform: {
        x: clamp01(t.x, 0),
        y: clamp01(t.y, 0),
        w: clamp01(t.w != null ? t.w : t.width, 0.12),
        h: clamp01(t.h != null ? t.h : t.height, 0.08),
        z: Number.isFinite(Number(t.z)) ? Number(t.z) : index
      },
      visible: raw.visible !== false,
      enabled: raw.enabled !== false,
      locked: !!raw.locked,
      showIf: raw.showIf != null ? raw.showIf : null,
      text: raw.text != null ? String(raw.text) : '',
      binding: raw.binding != null ? String(raw.binding) : '',
      asset: normalizeAssetRef(raw.asset),
      style: raw.style && typeof raw.style === 'object' ? { ...raw.style } : {},
      props,
      events: normalizeEvents(raw.events)
    };
    if (raw.prefabLink && typeof raw.prefabLink === 'object') {
      const link = normalizePrefabLink(raw.prefabLink);
      if (link) node.prefabLink = link;
    }
    return node;
  }

  function normalizeUiScreen(raw, screenId) {
    if (!raw || typeof raw !== 'object') return null;
    const usedIds = new Set();
    const nodes = Array.isArray(raw.nodes)
      ? raw.nodes.map((n, i) => normalizeUiNode(n, i, usedIds)).filter(Boolean)
      : [];
    let screenType = raw.screenType != null ? String(raw.screenType) : 'custom';
    if (UI_SCREEN_TYPES.indexOf(screenType) < 0) screenType = 'custom';
    return {
      id: String(raw.id || screenId),
      uid: raw.uid ? String(raw.uid) : createStableId('screen'),
      screenType,
      scope: raw.scope === 'scene' ? 'scene' : 'persistent',
      sceneId: raw.sceneId != null ? String(raw.sceneId) : '',
      visible: raw.visible !== false,
      events: normalizeEvents(raw.events),
      nodes
    };
  }

  /** Resolve anchored layout to absolute normalized rect */
  function resolveUiAnchoredTransform(transform, layout) {
    const tr = transform || {};
    const w = clamp01(tr.w, 0.12);
    const h = clamp01(tr.h, 0.08);
    if (!layout || !layout.anchor) {
      return { x: clamp01(tr.x, 0), y: clamp01(tr.y, 0), w, h, z: tr.z };
    }
    const mx = layout.marginX != null ? clamp01(layout.marginX, tr.x) : clamp01(tr.x, 0);
    const my = layout.marginY != null ? clamp01(layout.marginY, tr.y) : clamp01(tr.y, 0);
    let x = mx;
    let y = my;
    switch (layout.anchor) {
      case 'top-right':
        x = 1 - w - mx;
        y = my;
        break;
      case 'bottom-left':
        x = mx;
        y = 1 - h - my;
        break;
      case 'bottom-right':
        x = 1 - w - mx;
        y = 1 - h - my;
        break;
      case 'center':
        x = 0.5 - w / 2 + mx;
        y = 0.5 - h / 2 + my;
        break;
      default:
        x = mx;
        y = my;
    }
    return {
      x: clamp01(x, 0),
      y: clamp01(y, 0),
      w,
      h,
      z: tr.z
    };
  }

  function applySmartWidgetDefaults(node) {
    if (!node || !node.props?.widget) return node;
    const w = node.props.widget;
    if (!node.events) node.events = {};
    if (w === 'journal_button') {
      node.kind = node.kind === 'image' ? 'image' : 'button';
      if (!node.text) node.text = 'Журнал';
      if (!node.events.click?.length) {
        node.events.click = [{ action: 'open_panel', params: { panel: 'journal' } }];
      }
    } else if (w === 'inventory_button') {
      node.kind = node.kind === 'image' ? 'image' : 'button';
      if (!node.text) node.text = 'Инвентарь';
      if (!node.events.click?.length) {
        node.events.click = [{ action: 'open_panel', params: { panel: 'inventory' } }];
      }
    } else if (w === 'icon_action') {
      node.kind = 'image';
    } else if (w === 'quest_tracker') {
      node.kind = node.kind || 'text';
      if (!node.text) node.text = '📜 {questTitle}';
      if (!node.binding) node.binding = 'quest.activeTitle';
    }
    return node;
  }

  function ensureProjectAssets(data) {
    if (!data.assets || typeof data.assets !== 'object') data.assets = {};
    return data.assets;
  }

  function ensureProjectUi(data) {
    if (!data.ui || typeof data.ui !== 'object') data.ui = { screens: {} };
    if (!data.ui.screens || typeof data.ui.screens !== 'object') data.ui.screens = {};
    return data.ui;
  }

  /**
   * Normalize visual layers, UI screens, assets catalog, event chains.
   * Idempotent.
   */
  function normalizeSceneAuthoringEvents(scene) {
    if (!scene || typeof scene !== 'object') return scene;
    if (scene.events && typeof scene.events === 'object') {
      scene.events = normalizeEvents(scene.events);
    }
    return scene;
  }

  function ensureProjectVariables(data) {
    if (!data.variables || typeof data.variables !== 'object') data.variables = {};
    return data.variables;
  }

  function listProjectVariables(data) {
    const bag = ensureProjectVariables(data || {});
    return Object.entries(bag).map(([id, raw]) => {
      if (typeof raw === 'string') {
        return { id, name: raw, defaultValue: false, description: '' };
      }
      if (!raw || typeof raw !== 'object') return { id, name: id, defaultValue: false, description: '' };
      return {
        id,
        name: raw.name || id,
        defaultValue: raw.defaultValue != null ? raw.defaultValue : (raw.default != null ? raw.default : false),
        description: raw.description || raw.hint || ''
      };
    }).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'));
  }

  function registerProjectVariable(data, id, entry) {
    const bag = ensureProjectVariables(data);
    const vid = id || slugifyAssetId(entry?.name || 'var', bag);
    bag[vid] = {
      name: entry?.name || vid,
      defaultValue: entry?.defaultValue != null ? entry.defaultValue : false,
      description: entry?.description || ''
    };
    return vid;
  }

  function normalizePrefabLink(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const prefabId = raw.prefabId != null ? String(raw.prefabId) : '';
    const instanceId = raw.instanceId != null ? String(raw.instanceId) : '';
    const sourceNodeId = raw.sourceNodeId != null
      ? String(raw.sourceNodeId)
      : (raw.sourceId != null ? String(raw.sourceId) : '');
    if (!prefabId || !instanceId) return null;
    return { prefabId, instanceId, sourceNodeId };
  }

  function ensureProjectPrefabs(data) {
    if (!data.prefabs || typeof data.prefabs !== 'object') data.prefabs = {};
    return data.prefabs;
  }

  function normalizePrefab(raw, prefabId) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id || prefabId || '');
    if (!id) return null;
    let type = raw.type != null ? String(raw.type) : 'visual';
    if (PREFAB_TYPES.indexOf(type) < 0) type = 'visual';
    const usedIds = new Set();
    const normNode = type === 'ui' ? normalizeUiNode : normalizeVisualNode;
    const nodes = Array.isArray(raw.nodes)
      ? raw.nodes.map((n, i) => {
        const copy = JSON.parse(JSON.stringify(n || {}));
        delete copy.prefabLink;
        return normNode(copy, i, usedIds);
      }).filter(Boolean)
      : [];
    let background = null;
    if (raw.background) {
      const asset = normalizeAssetRef(raw.background.asset || raw.background);
      if (asset) background = { asset };
    }
    return {
      id,
      uid: raw.uid ? String(raw.uid) : createStableId('prefab'),
      type,
      name: raw.name != null ? String(raw.name) : id,
      description: raw.description != null ? String(raw.description) : '',
      tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
      nodes,
      background: background || undefined
    };
  }

  function listProjectPrefabs(data, typeFilter) {
    const bag = ensureProjectPrefabs(data || {});
    return Object.entries(bag).map(([id, raw]) => {
      const norm = typeof raw === 'object' && raw.nodes
        ? normalizePrefab(raw, id)
        : normalizePrefab({ id, type: 'visual', nodes: [] }, id);
      return norm;
    }).filter((p) => p && (!typeFilter || p.type === typeFilter))
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'));
  }

  function registerPrefab(data, id, entry) {
    const bag = ensureProjectPrefabs(data);
    const pid = id || slugifyAssetId(entry?.name || 'prefab', bag);
    const norm = normalizePrefab(Object.assign({}, entry, { id: pid }), pid);
    if (!norm) return null;
    bag[pid] = norm;
    return pid;
  }

  function prefabTemplateFromNodes(nodes, type) {
    return (Array.isArray(nodes) ? nodes : []).map((n) => {
      const copy = JSON.parse(JSON.stringify(n));
      delete copy.prefabLink;
      return copy;
    });
  }

  function instantiatePrefabNodes(prefab, opts) {
    if (!prefab || !Array.isArray(prefab.nodes)) return [];
    opts = opts || {};
    const instanceId = opts.instanceId || createStableId('prefab_inst');
    const ox = Number(opts.offsetX) || 0;
    const oy = Number(opts.offsetY) || 0;
    const used = new Set();
    const normNode = prefab.type === 'ui' ? normalizeUiNode : normalizeVisualNode;
    return prefab.nodes.map((tpl, i) => {
      const clone = JSON.parse(JSON.stringify(tpl));
      const sourceNodeId = String(clone.id || 'node_' + i);
      clone.id = createUniqueStableId(clone.kind || 'node', used);
      if (clone.transform) {
        clone.transform.x = clamp01((clone.transform.x || 0) + ox, 0);
        clone.transform.y = clamp01((clone.transform.y || 0) + oy, 0);
      }
      clone.prefabLink = {
        prefabId: prefab.id,
        instanceId,
        sourceNodeId
      };
      clone.uid = createStableId(clone.kind || 'node');
      return normNode(clone, i, used);
    }).filter(Boolean);
  }

  function collectPrefabInstances(nodes) {
    const map = Object.create(null);
    (nodes || []).forEach((n) => {
      const link = n?.prefabLink;
      if (!link?.instanceId) return;
      if (!map[link.instanceId]) {
        map[link.instanceId] = { instanceId: link.instanceId, prefabId: link.prefabId, nodeIds: [] };
      }
      map[link.instanceId].nodeIds.push(n.id);
    });
    return Object.values(map);
  }

  function detachPrefabInstance(nodes, instanceId) {
    if (!Array.isArray(nodes) || !instanceId) return nodes;
    nodes.forEach((n) => {
      if (n?.prefabLink?.instanceId === instanceId) delete n.prefabLink;
    });
    return nodes;
  }

  function updatePrefabInstanceNodes(nodes, prefab, instanceId) {
    if (!Array.isArray(nodes) || !prefab || !instanceId) return nodes;
    const templatesBySource = Object.create(null);
    (prefab.nodes || []).forEach((tpl) => {
      if (tpl?.id) templatesBySource[tpl.id] = tpl;
    });
    nodes.forEach((n) => {
      const link = n?.prefabLink;
      if (!link || link.instanceId !== instanceId || !link.sourceNodeId) return;
      const tpl = templatesBySource[link.sourceNodeId];
      if (!tpl) return;
      const keepTransform = n.transform ? { ...n.transform } : null;
      const keepId = n.id;
      const keepLink = { ...link };
      const merged = JSON.parse(JSON.stringify(tpl));
      merged.id = keepId;
      merged.prefabLink = keepLink;
      if (keepTransform) merged.transform = keepTransform;
      Object.keys(merged).forEach((k) => { n[k] = merged[k]; });
    });
    return nodes;
  }

  function normalizeProjectAuthoring(data) {
    if (!data || typeof data !== 'object') return data;
    if (!data.meta || typeof data.meta !== 'object') data.meta = {};

    const assets = ensureProjectAssets(data);
    Object.entries({ ...(assets) }).forEach(([id, entry]) => {
      const norm = normalizeAssetEntry(entry, id);
      if (norm) assets[id] = norm;
    });

    Object.values(data.scenes || {}).forEach((scene) => {
      if (scene && typeof scene === 'object') {
        normalizeSceneVisual(scene);
        normalizeSceneAuthoringEvents(scene);
      }
    });

    ensureProjectVariables(data);

    const prefabs = ensureProjectPrefabs(data);
    Object.entries({ ...prefabs }).forEach(([pid, entry]) => {
      const norm = normalizePrefab(entry, pid);
      if (norm) prefabs[pid] = norm;
    });

    const ui = ensureProjectUi(data);
    Object.entries({ ...ui.screens }).forEach(([sid, screen]) => {
      const norm = normalizeUiScreen(screen, sid);
      if (norm) ui.screens[sid] = norm;
    });

    if (!data.meta.authoring || typeof data.meta.authoring !== 'object') {
      data.meta.authoring = { visual: true, ui: true, assets: true };
    }

    return data;
  }

  function collectActionSceneTargets(step, sceneIds) {
    if (!step || typeof step !== 'object') return null;
    const action = step.action;
    const params = step.params || {};
    if (action === 'change_scene' || action === 'show_scene') {
      const tid = params.sceneId || params.scene || params.to;
      if (tid && !sceneIds.has(String(tid))) {
        return { targetId: String(tid), action };
      }
    }
    return null;
  }

  function stepSceneTarget(step) {
    const norm = normalizeEventStep(step);
    if (!norm) return null;
    const action = norm.action;
    const params = norm.params || {};
    if (action === 'change_scene' || action === 'show_scene') {
      const tid = params.sceneId || params.scene || params.to;
      return tid ? String(tid) : null;
    }
    // Victory / post-combat scene is a real authored transition
    if (action === 'start_combat' && params.nextScene) {
      return String(params.nextScene);
    }
    return null;
  }

  function collectEventSteps(events, key) {
    if (!events || typeof events !== 'object') return [];
    const raw = events[key];
    if (Array.isArray(raw)) return raw.map(normalizeEventStep).filter(Boolean);
    const one = normalizeEventStep(raw);
    return one ? [one] : [];
  }

  /**
   * Collect all scene transition edges: choices, nextScene, visual hotspots, enter events.
   * Phase G — visual flow map.
   */
  function collectSceneFlowEdges(scene, sceneId, opts) {
    opts = opts || {};
    const scenes = opts.scenes || {};
    const edges = [];
    if (!scene || !sceneId) return edges;

    (scene.choices || []).forEach((c, ci) => {
      if (!c) return;
      const to = c.to || c.nextScene;
      if (!to) return;
      const tid = String(to);
      edges.push({
        fromId: sceneId,
        toId: tid,
        kind: 'choice',
        label: String(c.text || '→').replace(/<[^>]+>/g, '').trim().slice(0, 40),
        choiceIndex: ci,
        broken: !scenes[tid]
      });
    });

    if (scene.nextScene) {
      const tid = String(scene.nextScene);
      edges.push({
        fromId: sceneId,
        toId: tid,
        kind: 'next',
        label: 'далее',
        choiceIndex: -1,
        broken: !scenes[tid]
      });
    }

    function pushSteps(steps, kind, label) {
      (steps || []).forEach((step, si) => {
        const to = stepSceneTarget(step);
        if (!to) return;
        edges.push({
          fromId: sceneId,
          toId: to,
          kind,
          label: label || kind,
          choiceIndex: si,
          broken: !scenes[to]
        });
      });
    }

    pushSteps(collectEventSteps(scene.events, 'enter'), 'scene_enter', '🚪 enter');
    pushSteps(collectEventSteps(scene.events, 'exit'), 'scene_exit', 'exit');

    (scene.visual?.nodes || []).forEach((node) => {
      const nodeLabel = (node.props && node.props.label) || node.id || 'hotspot';
      ['click', 'hover', 'enter'].forEach((evKey) => {
        collectEventSteps(node.events, evKey).forEach((step, si) => {
          const to = stepSceneTarget(step);
          if (!to) return;
          edges.push({
            fromId: sceneId,
            toId: to,
            kind: 'visual_' + evKey,
            label: nodeLabel + ' · ' + evKey,
            choiceIndex: si,
            nodeId: node.id,
            broken: !scenes[to]
          });
        });
      });
    });

    const uiScreens = opts.uiScreens || {};
    Object.values(uiScreens).forEach((screen) => {
      if (!screen || screen.scope !== 'scene' || String(screen.sceneId) !== String(sceneId)) return;
      collectEventSteps(screen.events, 'show').forEach((step, si) => {
        const to = stepSceneTarget(step);
        if (!to) return;
        edges.push({
          fromId: sceneId,
          toId: to,
          kind: 'ui_show',
          label: 'UI:' + (screen.id || 'screen'),
          choiceIndex: si,
          broken: !scenes[to]
        });
      });
    });

    return edges;
  }

  /**
   * Validate visual / ui / assets structure.
   * @returns {{ ok: boolean, issues: object[] }}
   */
  function validateProjectAuthoring(data) {
    const issues = [];
    if (!data || typeof data !== 'object') {
      return {
        ok: false,
        issues: [{
          id: 'authoring:no_data',
          type: 'authoring_no_data',
          severity: 'error',
          tab: 'scenes',
          message: 'Нет данных проекта (authoring)'
        }]
      };
    }

    const scenes = data.scenes || {};
    const sceneIds = new Set(Object.keys(scenes));
    const assets = data.assets || {};

    const checkNodeEvents = (ctx) => {
      const events = normalizeEvents(ctx.node?.events);
      const keys = ['click', 'hover', 'enter', 'exit', 'show'];
      keys.forEach((evKey) => {
        (events[evKey] || []).forEach((step, idx) => {
          const missing = collectActionSceneTargets(step, sceneIds);
          if (missing) {
            issues.push({
              id: 'authoring:missing_scene:' + ctx.scope + ':' + ctx.nodeId + ':' + evKey + ':' + idx,
              type: 'authoring_missing_scene',
              severity: 'error',
              tab: ctx.tab,
              sceneId: ctx.sceneId,
              nodeId: ctx.nodeId,
              targetId: missing.targetId,
              message: `${ctx.label} «${ctx.nodeId}» (${evKey}): действие ${missing.action} → сцена «${missing.targetId}» не найдена`
            });
          }
          if (step && !step.action) {
            issues.push({
              id: 'authoring:bad_event:' + ctx.scope + ':' + ctx.nodeId + ':' + evKey + ':' + idx,
              type: 'authoring_bad_event',
              severity: 'warning',
              tab: ctx.tab,
              sceneId: ctx.sceneId,
              nodeId: ctx.nodeId,
              message: `${ctx.label} «${ctx.nodeId}» (${evKey}): пустое действие #${idx + 1}`
            });
          }
        });
      });
    };

    const prefabs = data.prefabs || {};

    const checkPrefabLinks = (nodes, ctx) => {
      (nodes || []).forEach((node) => {
        const link = node?.prefabLink;
        if (!link?.prefabId) return;
        if (!prefabs[link.prefabId]) {
          issues.push({
            id: 'authoring:missing_prefab:' + ctx.scope + ':' + (node.id || '') + ':' + link.prefabId,
            type: 'authoring_missing_prefab',
            severity: 'warning',
            tab: ctx.tab,
            sceneId: ctx.sceneId,
            nodeId: node.id,
            prefabId: link.prefabId,
            message: `${ctx.label} «${node.id}»: префаб «${link.prefabId}» не найден в каталоге`
          });
        }
      });
    };

    Object.entries(scenes).forEach(([sceneId, scene]) => {
      const sceneEvents = normalizeEvents(scene?.events);
      ['enter', 'exit'].forEach((evKey) => {
        (sceneEvents[evKey] || []).forEach((step, idx) => {
          const missing = collectActionSceneTargets(step, sceneIds);
          if (missing) {
            issues.push({
              id: 'authoring:scene_event:' + sceneId + ':' + evKey + ':' + idx,
              type: 'authoring_missing_scene',
              severity: 'error',
              tab: 'scenes',
              sceneId,
              targetId: missing.targetId,
              message: `Сцена «${sceneId}» (${evKey}): → «${missing.targetId}» не найдена`
            });
          }
        });
      });

      const visual = scene?.visual;
      if (!visual || typeof visual !== 'object') return;
      (visual.nodes || []).forEach((node) => {
        if (!node?.id) {
          issues.push({
            id: 'authoring:visual_no_id:' + sceneId,
            type: 'authoring_visual_no_id',
            severity: 'error',
            tab: 'scenes',
            sceneId,
            message: `Сцена «${sceneId}»: visual-узел без id`
          });
          return;
        }
        if (node.asset?.ref && !assets[node.asset.ref] && !node.asset.src) {
          issues.push({
            id: 'authoring:missing_asset:' + sceneId + ':' + node.id,
            type: 'authoring_missing_asset',
            severity: 'warning',
            tab: 'scenes',
            sceneId,
            nodeId: node.id,
            assetRef: node.asset.ref,
            message: `Сцена «${sceneId}», узел «${node.id}»: asset «${node.asset.ref}» не в каталоге assets`
          });
        }
        checkNodeEvents({
          scope: 'visual',
          tab: 'scenes',
          label: 'Visual',
          sceneId,
          nodeId: node.id,
          node
        });
        if (node.kind === 'hotspot' && !(normalizeEvents(node.events).click || []).length &&
            !(normalizeEvents(node.events).hover || []).length) {
          issues.push({
            id: 'authoring:orphan_hotspot:' + sceneId + ':' + node.id,
            type: 'authoring_orphan_hotspot',
            severity: 'warning',
            tab: 'scenes',
            sceneId,
            nodeId: node.id,
            message: `Сцена «${sceneId}», hotspot «${node.id}»: нет действий click/hover`
          });
        }
      });
      checkPrefabLinks(visual.nodes, {
        scope: 'visual',
        tab: 'scenes',
        label: 'Visual',
        sceneId
      });
      if (visual.background?.asset?.ref && !assets[visual.background.asset.ref] && !visual.background.asset.src) {
        issues.push({
          id: 'authoring:bg_asset:' + sceneId,
          type: 'authoring_missing_asset',
          severity: 'warning',
          tab: 'scenes',
          sceneId,
          assetRef: visual.background.asset.ref,
          message: `Сцена «${sceneId}»: фон ссылается на asset «${visual.background.asset.ref}», которого нет в каталоге`
        });
      }
    });

    Object.entries(data.ui?.screens || {}).forEach(([screenId, screen]) => {
      if (screen?.scope === 'scene' && screen.sceneId && !sceneIds.has(screen.sceneId)) {
        issues.push({
          id: 'authoring:ui_scene:' + screenId,
          type: 'authoring_ui_scene',
          severity: 'error',
          tab: 'game_ui',
          screenId,
          sceneId: screen.sceneId,
          message: `UI экран «${screenId}»: привязан к несуществующей сцене «${screen.sceneId}»`
        });
      }
      (screen?.nodes || []).forEach((node) => {
        if (!node?.id) return;
        if (node.asset?.ref && !assets[node.asset.ref] && !node.asset.src) {
          issues.push({
            id: 'authoring:ui_asset:' + screenId + ':' + node.id,
            type: 'authoring_missing_asset',
            severity: 'warning',
            tab: 'game_ui',
            screenId,
            nodeId: node.id,
            assetRef: node.asset.ref,
            message: `UI «${screenId}», узел «${node.id}»: asset «${node.asset.ref}» не в каталоге`
          });
        }
        checkNodeEvents({
          scope: 'ui',
          tab: 'game_ui',
          label: 'UI',
          sceneId: screen.sceneId || '',
          nodeId: node.id,
          node
        });
      });
      checkPrefabLinks(screen?.nodes, {
        scope: 'ui',
        tab: 'game_ui',
        label: 'UI',
        sceneId: screen.sceneId || '',
        screenId
      });
      const screenEv = normalizeEvents(screen?.events);
      (screenEv.show || []).forEach((step, idx) => {
        const missing = collectActionSceneTargets(step, sceneIds);
        if (missing) {
          issues.push({
            id: 'authoring:ui_show:' + screenId + ':' + idx,
            type: 'authoring_missing_scene',
            severity: 'error',
            tab: 'game_ui',
            screenId,
            targetId: missing.targetId,
            message: `UI «${screenId}» (show): → «${missing.targetId}» не найдена`
          });
        }
      });
    });

    Object.entries(prefabs).forEach(([pid, prefab]) => {
      if (!prefab || !Array.isArray(prefab.nodes)) {
        issues.push({
          id: 'authoring:bad_prefab:' + pid,
          type: 'authoring_bad_prefab',
          severity: 'warning',
          tab: 'prefabs',
          prefabId: pid,
          message: `Префаб «${pid}»: пустой или некорректный`
        });
      }
    });

    const uiScreens = data.ui?.screens || {};
    Object.keys(scenes).forEach((sid) => {
      collectSceneFlowEdges(scenes[sid], sid, { scenes, uiScreens }).forEach((edge, idx) => {
        if (!edge.broken) return;
        issues.push({
          id: 'authoring:flow_broken:' + sid + ':' + idx + ':' + edge.toId,
          type: 'authoring_flow_broken',
          severity: 'error',
          tab: 'graph',
          sceneId: sid,
          targetId: edge.toId,
          message: `Flow «${sid}» → «${edge.toId}» (${edge.label || edge.kind}) — цель не найдена`
        });
      });
    });

    if (data.startScene && !sceneIds.has(String(data.startScene))) {
      issues.push({
        id: 'authoring:bad_start_scene',
        type: 'authoring_bad_start_scene',
        severity: 'error',
        tab: 'scenes',
        targetId: data.startScene,
        message: `startScene «${data.startScene}» не существует`
      });
    }

    if (data.meta?.startScene && !sceneIds.has(String(data.meta.startScene))) {
      issues.push({
        id: 'authoring:bad_meta_start_scene',
        type: 'authoring_bad_start_scene',
        severity: 'warning',
        tab: 'scenes',
        targetId: data.meta.startScene,
        message: `meta.startScene «${data.meta.startScene}» не существует`
      });
    }

    Object.entries(assets).forEach(([ref, asset]) => {
      if (!asset || typeof asset !== 'object') {
        issues.push({
          id: 'authoring:bad_asset:' + ref,
          type: 'authoring_bad_asset',
          severity: 'error',
          tab: 'game_ui',
          assetRef: ref,
          message: `Asset «${ref}»: некорректная запись`
        });
        return;
      }
      if (!asset.src && !asset.ref) {
        issues.push({
          id: 'authoring:asset_no_src:' + ref,
          type: 'authoring_asset_no_src',
          severity: 'warning',
          tab: 'game_ui',
          assetRef: ref,
          message: `Asset «${ref}»: не указан src`
        });
      }
    });

    const errors = issues.filter((i) => i.severity === 'error');
    return { ok: errors.length === 0, issues, errors, warnings: issues.filter((i) => i.severity === 'warning') };
  }

  /**
   * Phase H — export readiness: authoring + startScene + data version hint.
   */
  function validateProjectExportReady(data) {
    const base = validateProjectAuthoring(data);
    const issues = base.issues ? base.issues.slice() : [];
    if (data?.meta?.dataVersion != null) {
      const dv = parseInt(data.meta.dataVersion, 10);
      if (Number.isFinite(dv) && dv < 5) {
        issues.push({
          id: 'export:old_data_version',
          type: 'export_old_data_version',
          severity: 'warning',
          tab: 'json',
          message: `dataVersion ${dv} — рекомендуется миграция до v5 перед экспортом`
        });
      }
    }
    if (!Object.keys(data?.scenes || {}).length) {
      issues.push({
        id: 'export:no_scenes',
        type: 'export_no_scenes',
        severity: 'error',
        tab: 'scenes',
        message: 'Экспорт невозможен: нет сцен'
      });
    }
    const errors = issues.filter((i) => i.severity === 'error');
    return { ok: errors.length === 0, issues, errors, warnings: issues.filter((i) => i.severity === 'warning') };
  }

  const ASSET_DRAG_MIME = 'application/x-rpgengine-asset';

  function inferAssetType(src, explicit) {
    if (explicit && ASSET_TYPES.includes(explicit)) return explicit;
    const s = String(src || '').toLowerCase();
    if (/\.(png|jpe?g|gif|svg|webp|bmp|ico)$/.test(s)) return 'image';
    if (/\.(mp3|ogg|wav|webm|m4a)$/.test(s)) return 'audio';
    if (/\.(woff2?|ttf|otf|eot)$/.test(s)) return 'font';
    return 'data';
  }

  function slugifyAssetId(name, existing) {
    const base = String(name || 'asset')
      .trim()
      .toLowerCase()
      .replace(/[^\wа-яёА-ЯЁ\-]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'asset';
    const used = existing || {};
    if (!used[base]) return base;
    for (let i = 2; i < 1000; i++) {
      const cand = base + '_' + i;
      if (!used[cand]) return cand;
    }
    return base + '_' + Date.now().toString(36).slice(-4);
  }

  /**
   * Full asset list: catalog + inline refs from visual/ui.
   * @returns {{ id, src, name, type, inCatalog, tags }[]}
   */
  function listRegistryAssets(data) {
    const out = [];
    const seen = Object.create(null);
    function add(entry) {
      if (!entry || !entry.id) return;
      const key = entry.id;
      if (seen[key]) return;
      seen[key] = true;
      out.push(entry);
    }

    const catalog = data?.assets || {};
    Object.entries(catalog).forEach(([id, raw]) => {
      if (typeof raw === 'string') {
        add({
          id,
          src: raw,
          name: id,
          type: inferAssetType(raw),
          inCatalog: true,
          tags: []
        });
        return;
      }
      if (!raw || typeof raw !== 'object') return;
      const src = raw.src || raw.url || '';
      add({
        id,
        src,
        name: raw.name || id,
        type: inferAssetType(src, raw.type),
        inCatalog: true,
        tags: Array.isArray(raw.tags) ? raw.tags.slice() : [],
        uid: raw.uid
      });
    });

    function addRef(ref, src) {
      const id = ref || src;
      if (!id || seen[id]) return;
      add({
        id,
        src: src || id,
        name: id,
        type: inferAssetType(src || id),
        inCatalog: !!catalog[id],
        tags: [],
        orphan: !catalog[id]
      });
    }

    Object.values(data?.scenes || {}).forEach((scene) => {
      const v = scene?.visual;
      if (!v) return;
      const bg = v.background?.asset;
      if (bg?.ref || bg?.src) addRef(bg.ref || bg.src, bg.src || bg.ref);
      (v.nodes || []).forEach((n) => {
        if (n?.asset?.ref || n?.asset?.src) addRef(n.asset.ref || n.asset.src, n.asset.src || n.asset.ref);
      });
    });

    Object.values(data?.ui?.screens || {}).forEach((screen) => {
      (screen?.nodes || []).forEach((n) => {
        if (n?.asset?.ref || n?.asset?.src) addRef(n.asset.ref || n.asset.src, n.asset.src || n.asset.ref);
      });
    });

    return out.sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'));
  }

  /**
   * Where asset id/src is referenced.
   * @returns {{ kind, sceneId?, screenId?, nodeId?, label }[]}
   */
  function scanAssetUsage(data, assetId) {
    const usages = [];
    const needle = String(assetId || '').trim();
    if (!needle) return usages;

    const matchesAsset = (asset) => {
      if (!asset) return false;
      return asset.ref === needle || asset.src === needle;
    };

    Object.entries(data?.scenes || {}).forEach(([sceneId, scene]) => {
      const v = scene?.visual;
      if (!v) return;
      if (matchesAsset(v.background?.asset)) {
        usages.push({ kind: 'visual_bg', sceneId, label: `Сцена «${sceneId}» — фон` });
      }
      (v.nodes || []).forEach((n) => {
        if (matchesAsset(n.asset)) {
          usages.push({
            kind: 'visual_node',
            sceneId,
            nodeId: n.id,
            label: `Сцена «${sceneId}» — ${n.kind || 'узел'} «${n.id}»`
          });
        }
      });
    });

    Object.entries(data?.ui?.screens || {}).forEach(([screenId, screen]) => {
      (screen?.nodes || []).forEach((n) => {
        if (matchesAsset(n.asset)) {
          usages.push({
            kind: 'ui_node',
            screenId,
            nodeId: n.id,
            label: `UI «${screenId}» — ${n.kind || 'узел'} «${n.id}»`
          });
        }
      });
    });

    return usages;
  }

  function registerAsset(data, id, entry) {
    ensureProjectAssets(data);
    const assets = data.assets;
    const aid = id || slugifyAssetId(entry?.name || entry?.src || 'asset', assets);
    const norm = normalizeAssetEntry(Object.assign({}, entry, { id: aid }), aid);
    if (!norm) return null;
    if (!norm.uid) norm.uid = createStableId('asset');
    assets[aid] = norm;
    return aid;
  }

  function parseAssetDragPayload(dataTransfer) {
    if (!dataTransfer) return null;
    let raw = '';
    try {
      raw = dataTransfer.getData(ASSET_DRAG_MIME);
    } catch (_) { /* */ }
    if (!raw) return null;
    try {
      const o = JSON.parse(raw);
      if (o && o.id) return o;
    } catch (_) { /* */ }
    return null;
  }

  /**
   * Стартовая сцена проекта для рантайма и редактора.
   * При валидном startScene / meta.startScene — использует его;
   * иначе legacy: village_hub → start → первый ключ словаря сцен.
   */
  function resolveProjectStartSceneId(data) {
    const scenes = data?.scenes || {};
    const configured = data?.startScene ?? data?.meta?.startScene;
    if (configured != null && String(configured) !== '' && scenes[configured]) {
      return String(configured);
    }
    if (scenes.village_hub) return 'village_hub';
    if (scenes.start) return 'start';
    const keys = Object.keys(scenes);
    return keys[0] || 'start';
  }

  const ProjectSchema = {
    VISUAL_KINDS,
    HOTSPOT_SHAPES,
    UI_KINDS,
    UI_SCREEN_TYPES,
    UI_ANCHORS,
    UI_SMART_WIDGETS,
    ASSET_TYPES,
    ASSET_DRAG_MIME,
    PREFAB_TYPES,
    createStableId,
    createUniqueStableId,
    normalizeEventStep,
    normalizeEvents,
    normalizeAssetEntry,
    normalizeAssetRef,
    normalizeVisualNode,
    normalizeSceneVisual,
    normalizeUiNode,
    normalizeUiScreen,
    resolveUiAnchoredTransform,
    applySmartWidgetDefaults,
    normalizeProjectAuthoring,
    validateProjectAuthoring,
    validateProjectExportReady,
    ensureProjectAssets,
    ensureProjectUi,
    ensureProjectVariables,
    listProjectVariables,
    registerProjectVariable,
    normalizeSceneAuthoringEvents,
    ensureProjectPrefabs,
    normalizePrefabLink,
    normalizePrefab,
    listProjectPrefabs,
    registerPrefab,
    prefabTemplateFromNodes,
    instantiatePrefabNodes,
    collectPrefabInstances,
    detachPrefabInstance,
    updatePrefabInstanceNodes,
    collectSceneFlowEdges,
    stepSceneTarget,
    inferAssetType,
    slugifyAssetId,
    listRegistryAssets,
    scanAssetUsage,
    registerAsset,
    parseAssetDragPayload,
    resolveProjectStartSceneId
  };

  global.ProjectSchema = ProjectSchema;
})(typeof window !== 'undefined' ? window : globalThis);


;/* —— js/game-ui/visual-runtime.js —— */
/**
 * Visual Scene Runtime (Phase 1.3)
 * Optional overlay on top of existing TEXT scene flow.
 * - Does not replace SceneManager / SceneElements
 * - Actions go through ACTION_REGISTRY / ActionRunner / engine.showScene
 * - No Editor dependency
 */
(function visualSceneRuntime(global) {
  'use strict';

  const MVP_KINDS = Object.freeze(['image', 'text', 'button', 'panel', 'hotspot']);

  /** @type {{ engine: *, root: HTMLElement|null, sceneId: string|null, nodes: object[] }} */
  const mountState = {
    engine: null,
    root: null,
    sceneId: null,
    nodes: []
  };

  function clamp01(n, fallback) {
    const v = Number(n);
    if (!Number.isFinite(v)) return fallback;
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
  }

  function normalizeAsset(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const type = raw.type || 'image';
    const ref = raw.ref != null ? String(raw.ref) : '';
    const src = raw.src != null ? String(raw.src) : '';
    if (!ref && !src) return null;
    return { type, ref: ref || undefined, src: src || undefined };
  }

  function normalizeAction(step) {
    if (typeof ProjectSchema !== 'undefined' && typeof ProjectSchema.normalizeEventStep === 'function') {
      return ProjectSchema.normalizeEventStep(step);
    }
    if (!step || typeof step !== 'object') return null;
    const action = step.action || step.type || step.id;
    if (!action || typeof action !== 'string') return null;
    const params = step.params && typeof step.params === 'object' ? { ...step.params } : {};
    if (action === 'OpenScene' || action === 'open_scene') {
      return {
        action: 'change_scene',
        params: {
          sceneId: params.sceneId || params.scene || params.to || ''
        }
      };
    }
    return { action, params };
  }

  function normalizeEvents(events) {
    if (typeof ProjectSchema !== 'undefined' && typeof ProjectSchema.normalizeEvents === 'function') {
      return ProjectSchema.normalizeEvents(events);
    }
    const out = {};
    if (!events || typeof events !== 'object') return out;
    const clickRaw = events.click || events.onClick || events.OnClick;
    if (Array.isArray(clickRaw)) {
      out.click = clickRaw.map(normalizeAction).filter(Boolean);
    } else if (clickRaw && typeof clickRaw === 'object') {
      const one = normalizeAction(clickRaw);
      if (one) out.click = [one];
    }
    const hoverRaw = events.hover || events.onHover || events.OnHover;
    if (Array.isArray(hoverRaw)) {
      out.hover = hoverRaw.map(normalizeAction).filter(Boolean);
    } else if (hoverRaw && typeof hoverRaw === 'object') {
      const one = normalizeAction(hoverRaw);
      if (one) out.hover = [one];
    }
    return out;
  }

  /** Normalized point (0–1) inside hotspot shape */
  function pointInHotspotShape(nx, ny, node) {
    const t = node.transform || {};
    const x = t.x || 0;
    const y = t.y || 0;
    const w = t.w || 0.1;
    const h = t.h || 0.1;
    if (nx < x || ny < y || nx > x + w || ny > y + h) return false;
    const shape = node.props && node.props.shape ? node.props.shape : 'rect';
    if (shape === 'circle') {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rx = w / 2;
      const ry = h / 2;
      if (!rx || !ry) return false;
      const dx = (nx - cx) / rx;
      const dy = (ny - cy) / ry;
      return dx * dx + dy * dy <= 1;
    }
    if (shape === 'polygon' && Array.isArray(node.props.points) && node.props.points.length >= 3) {
      const pts = node.props.points;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i].x;
        const yi = pts[i].y;
        const xj = pts[j].x;
        const yj = pts[j].y;
        const intersect = yi > ny !== yj > ny && nx < ((xj - xi) * (ny - yi)) / (yj - yi + 1e-12) + xi;
        if (intersect) inside = !inside;
      }
      return inside;
    }
    return true;
  }

  function applyHotspotShapeStyle(el, node) {
    const shape = node.props && node.props.shape ? node.props.shape : 'rect';
    if (shape === 'circle') {
      el.style.borderRadius = '50%';
    } else if (shape === 'polygon' && Array.isArray(node.props.points) && node.props.points.length >= 3) {
      const t = node.transform || {};
      const pts = node.props.points.map(function (p) {
        const lx = ((p.x - (t.x || 0)) / Math.max(t.w || 0.01, 0.01)) * 100;
        const ly = ((p.y - (t.y || 0)) / Math.max(t.h || 0.01, 0.01)) * 100;
        return lx + '% ' + ly + '%';
      });
      el.style.clipPath = 'polygon(' + pts.join(', ') + ')';
    }
  }

  function normalizeNode(raw, index) {
    if (!raw || typeof raw !== 'object') return null;
    let kind = String(raw.kind || raw.type || 'hotspot').toLowerCase();
    if (MVP_KINDS.indexOf(kind) === -1) kind = 'hotspot';
    const t = raw.transform || raw;
    const id = String(raw.id || kind + '_' + index);
    const node = {
      id,
      kind,
      layer: raw.layer === 'hud' ? 'hud' : 'world',
      transform: {
        x: clamp01(t.x != null ? t.x : raw.x, 0),
        y: clamp01(t.y != null ? t.y : raw.y, 0),
        w: clamp01(t.w != null ? t.w : (t.width != null ? t.width : raw.width), 0.1),
        h: clamp01(t.h != null ? t.h : (t.height != null ? t.height : raw.height), 0.1),
        z: Number.isFinite(Number(t.z != null ? t.z : (t.zIndex != null ? t.zIndex : raw.zIndex)))
          ? Number(t.z != null ? t.z : (t.zIndex != null ? t.zIndex : raw.zIndex))
          : index
      },
      visible: raw.visible !== false,
      enabled: raw.enabled !== false,
      showIf: raw.showIf != null ? raw.showIf : (raw.conditions != null ? raw.conditions : null),
      asset: normalizeAsset(raw.asset),
      props: raw.props && typeof raw.props === 'object' ? { ...raw.props } : {},
      events: normalizeEvents(raw.events),
      locked: !!raw.locked
    };
    if (raw.text != null && node.props.text == null) node.props.text = String(raw.text);
    if (raw.label != null && node.props.label == null) node.props.label = String(raw.label);
    return node;
  }

  /**
   * Normalize scene.visual into a stable structure. Missing visual → null (legacy path).
   */
  function normalizeVisual(scene) {
    if (!scene || typeof scene !== 'object') return null;
    const visual = scene.visual;
    if (!visual || typeof visual !== 'object') return null;
    const mode = visual.mode === 'overlay' ? 'overlay' : (visual.mode === 'none' ? 'none' : null);
    const nodesIn = Array.isArray(visual.nodes) ? visual.nodes : [];
    const nodes = nodesIn.map(normalizeNode).filter(Boolean);
    if (mode === 'none') return { mode: 'none', background: null, nodes: [] };
    // Implicit overlay if nodes or background present
    const hasContent = nodes.length > 0 || !!(visual.background && (visual.background.asset || visual.background.src || visual.background.ref));
    if (!hasContent && mode !== 'overlay') return null;
    let background = null;
    if (visual.background) {
      background = {
        asset: normalizeAsset(visual.background.asset || visual.background)
      };
      if (!background.asset) background = null;
    }
    return {
      mode: mode || 'overlay',
      background,
      nodes
    };
  }

  function resolveAssetUrl(engine, asset) {
    if (!asset) return '';
    if (asset.src) return asset.src;
    if (asset.ref && engine && engine.data && engine.data.assets) {
      const entry = engine.data.assets[asset.ref];
      if (entry) {
        if (typeof entry === 'string') return entry;
        if (entry.src) return entry.src;
        if (entry.url) return entry.url;
      }
    }
    // Treat ref as relative path fallback
    if (asset.ref) return asset.ref;
    return '';
  }

  function getHostParent() {
    if (typeof document === 'undefined') return null;
    return (
      document.getElementById('visual-scene-host') ||
      document.getElementById('story') ||
      document.getElementById('game-main') ||
      document.getElementById('main') ||
      document.body
    );
  }

  function ensureRoot() {
    if (typeof document === 'undefined') return null;
    let root = document.getElementById('visual-scene-layer');
    if (!root) {
      root = document.createElement('div');
      root.id = 'visual-scene-layer';
      root.setAttribute('data-visual-runtime', '1');
      root.style.cssText =
        'position:relative;width:100%;max-width:960px;margin:0 auto 12px;aspect-ratio:16/9;' +
        'background:#1a1a1a;overflow:hidden;border-radius:8px;';
      const parent = getHostParent();
      if (parent) {
        if (parent.firstChild) parent.insertBefore(root, parent.firstChild);
        else parent.appendChild(root);
      }
    }
    return root;
  }

  function clearRoot(root) {
    if (!root) return;
    while (root.firstChild) root.removeChild(root.firstChild);
  }

  function unmount(engine) {
    if (mountState.root) {
      clearRoot(mountState.root);
      mountState.root.style.display = 'none';
    }
    mountState.engine = null;
    mountState.sceneId = null;
    mountState.nodes = [];
  }


  function evaluateShowIf(engine, showIf) {
    if (showIf == null || showIf === true) return true;
    if (showIf === false) return false;
    if (typeof ConditionSystem === 'undefined' || !ConditionSystem.evaluate) return true;
    let ctx = {};
    try {
      if (engine && typeof engine.getConditionContext === 'function') ctx = engine.getConditionContext() || {};
      else if (typeof ConditionSystem.buildContext === 'function') ctx = ConditionSystem.buildContext(engine) || {};
      else {
        ctx = {
          flags: (engine && engine.state && engine.state.flags) || {},
          inventory: (engine && engine.state && engine.state.inventory) || [],
          gold: (engine && engine.state && engine.state.gold) || 0,
          className: (engine && engine.state && (engine.state.className || engine.state.class)) || '',
          questProgress: (engine && engine.state && engine.state.questProgress) || null,
          questStages: (engine && engine.state && engine.state.questStages) || null
        };
      }
    } catch (e) {
      ctx = {};
    }
    try {
      return !!ConditionSystem.evaluate(showIf, ctx);
    } catch (e) {
      return true;
    }
  }

  async function runClickActions(engine, actions) {
    if (!engine || !actions || !actions.length) return;
    let navigatesAway = false;
    for (let i = 0; i < actions.length; i++) {
      const step = actions[i];
      if (!step || !step.action) continue;
      if (step.action === 'change_scene' || step.action === 'start_combat') {
        navigatesAway = true;
      }
      try {
        if (typeof engine.runAction === 'function') {
          await engine.runAction(step.action, step.params || {}, { source: 'visual' });
        } else if (typeof ActionRunner !== 'undefined' && ActionRunner.runV2) {
          await ActionRunner.runV2(engine, step.action, step.params || {}, { source: 'visual' });
        } else if (step.action === 'change_scene' && step.params && step.params.sceneId) {
          engine.showScene(step.params.sceneId);
        } else if (typeof ACTION_REGISTRY !== 'undefined' && ACTION_REGISTRY[step.action]) {
          ACTION_REGISTRY[step.action].execute(engine, step.params || {});
        }
      } catch (err) {
        console.warn('[VisualRuntime] action failed', step.action, err);
      }
    }
    // Vertical slice: refresh HUD after multi-action; remount to re-eval showIf.
    if (typeof UIRuntime !== 'undefined' && typeof UIRuntime.refreshBindings === 'function') {
      try {
        UIRuntime.refreshBindings(engine);
      } catch (_) { /* ignore */ }
    }
    if (
      !navigatesAway &&
      mountState.sceneId &&
      engine.data &&
      engine.data.scenes &&
      engine.data.scenes[mountState.sceneId]
    ) {
      try {
        mount(engine, mountState.sceneId, engine.data.scenes[mountState.sceneId]);
      } catch (_) { /* ignore */ }
    }
  }

  function buildNodeEl(engine, node) {
    if (typeof document === 'undefined') return null;
    const el = document.createElement('div');
    el.dataset.visualId = node.id;
    el.dataset.visualKind = node.kind;
    el.style.position = 'absolute';
    el.style.left = node.transform.x * 100 + '%';
    el.style.top = node.transform.y * 100 + '%';
    el.style.width = node.transform.w * 100 + '%';
    el.style.height = node.transform.h * 100 + '%';
    el.style.zIndex = String(node.transform.z);
    el.style.boxSizing = 'border-box';
    if (!node.visible) el.style.display = 'none';
    if (!node.enabled) {
      el.style.pointerEvents = 'none';
      el.style.opacity = '0.5';
    } else {
      el.style.pointerEvents = 'auto';
      const customCursor = node.props && node.props.cursor;
      const hasClick = node.events.click && node.events.click.length;
      const hasHover = node.events.hover && node.events.hover.length;
      el.style.cursor = customCursor || (hasClick || hasHover ? 'pointer' : 'default');
    }

    const tip = (node.props && (node.props.tooltip || node.props.label)) || '';
    if (tip) el.title = tip;

    if (node.kind === 'hotspot') {
      el.style.background = 'transparent';
      if (!el.title) el.title = node.props.label || node.id;
      applyHotspotShapeStyle(el, node);
      if (node.props.debugDraw) {
        el.style.outline = '1px dashed rgba(255,200,80,0.6)';
        el.style.background = 'rgba(255,200,80,0.12)';
      }
    } else if (node.kind === 'image') {
      const url = resolveAssetUrl(engine, node.asset);
      if (url) {
        el.style.backgroundImage = 'url("' + url.replace(/"/g, '\\"') + '")';
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
      }
    } else if (node.kind === 'text') {
      el.textContent = node.props.text || node.props.label || '';
      el.style.color = '#f0e6d2';
      el.style.fontSize = '14px';
      el.style.padding = '4px';
      el.style.overflow = 'hidden';
    } else if (node.kind === 'button') {
      el.textContent = node.props.label || node.props.text || node.id;
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.background = 'rgba(40,40,50,0.85)';
      el.style.color = '#f0e6d2';
      el.style.border = '1px solid rgba(200,180,120,0.5)';
      el.style.borderRadius = '6px';
      el.style.fontSize = '13px';
      el.style.userSelect = 'none';
    } else if (node.kind === 'panel') {
      el.style.background = 'rgba(20,20,28,0.75)';
      el.style.border = '1px solid rgba(120,120,140,0.4)';
      el.style.borderRadius = '8px';
      if (node.props.label) {
        const lab = document.createElement('div');
        lab.textContent = node.props.label;
        lab.style.padding = '6px 8px';
        lab.style.color = '#ccc';
        lab.style.fontSize = '12px';
        el.appendChild(lab);
      }
    }

    if (node.enabled && node.events.click && node.events.click.length) {
      el.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        const eng = mountState.engine || engine;
        if (!evaluateShowIf(eng, node.showIf)) return;
        const rect = el.getBoundingClientRect();
        if (rect.width && rect.height && node.kind === 'hotspot') {
          const nx = (ev.clientX - rect.left) / rect.width * (node.transform.w || 0.1) + (node.transform.x || 0);
          const ny = (ev.clientY - rect.top) / rect.height * (node.transform.h || 0.1) + (node.transform.y || 0);
          if (!pointInHotspotShape(nx, ny, node)) return;
        }
        Promise.resolve(runClickActions(eng, node.events.click)).catch(function (err) {
          console.warn('[VisualRuntime] click chain', err);
        });
      });
    }

    if (node.enabled && node.events.hover && node.events.hover.length) {
      const highlight = node.props && node.props.highlight;
      el.addEventListener('mouseenter', function () {
        if (highlight) el.style.outline = '2px solid ' + (highlight === true ? 'rgba(255,220,80,0.9)' : highlight);
        else if (node.kind === 'hotspot') el.style.background = 'rgba(255,220,80,0.18)';
        const eng = mountState.engine || engine;
        if (!evaluateShowIf(eng, node.showIf)) return;
        Promise.resolve(runClickActions(eng, node.events.hover)).catch(function (err) {
          console.warn('[VisualRuntime] hover chain', err);
        });
      });
      el.addEventListener('mouseleave', function () {
        if (highlight) el.style.outline = '';
        else if (node.kind === 'hotspot' && !node.props.debugDraw) el.style.background = 'transparent';
      });
    } else if (node.props && node.props.highlight && node.enabled) {
      const highlight = node.props.highlight;
      el.addEventListener('mouseenter', function () {
        el.style.outline = '2px solid ' + (highlight === true ? 'rgba(255,220,80,0.9)' : highlight);
      });
      el.addEventListener('mouseleave', function () {
        el.style.outline = '';
      });
    }
    return el;
  }

  function mount(engine, sceneId, scene) {
    unmount(engine);
    const visual = normalizeVisual(scene);
    if (!visual || visual.mode === 'none' || (visual.nodes.length === 0 && !visual.background)) {
      return false;
    }
    if (typeof document === 'undefined') {
      // Headless: keep logical mount for tests
    mountState.engine = engine;
    mountState.sceneId = sceneId;
    mountState.nodes = visual.nodes.filter(function (n) {
      return evaluateShowIf(engine, n.showIf);
    });
      mountState.root = null;
      return true;
    }
    const root = ensureRoot();
    if (!root) return false;
    root.style.display = 'block';
    clearRoot(root);

    if (visual.background && visual.background.asset) {
      const url = resolveAssetUrl(engine, visual.background.asset);
      if (url) {
        root.style.backgroundImage = 'url("' + url.replace(/"/g, '\\"') + '")';
        root.style.backgroundSize = 'cover';
        root.style.backgroundPosition = 'center';
      }
    } else {
      root.style.backgroundImage = '';
    }

    const sorted = visual.nodes.slice().sort(function (a, b) {
      return a.transform.z - b.transform.z;
    });
    for (let i = 0; i < sorted.length; i++) {
      if (!evaluateShowIf(engine, sorted[i].showIf)) continue;
      const nodeEl = buildNodeEl(engine, sorted[i]);
      if (nodeEl) root.appendChild(nodeEl);
      if (sorted[i].enabled && sorted[i].events?.enter?.length) {
        Promise.resolve(runClickActions(engine, sorted[i].events.enter)).catch(function () {});
      }
    }

    mountState.engine = engine;
    mountState.root = root;
    mountState.sceneId = sceneId;
    mountState.nodes = visual.nodes;
    return true;
  }

  /** Called from SceneManager after scene data is ready */
  function onSceneShown(engine, sceneId, rawScene) {
    try {
      return mount(engine, sceneId, rawScene || engine?.data?.scenes?.[sceneId]);
    } catch (err) {
      console.warn('[VisualRuntime] mount failed', err);
      return false;
    }
  }

  /** Factory helpers for tests / future editor (no JS required from players) */
  function createHotspot(id, transform, targetSceneId, extra) {
    const node = {
      id: id,
      kind: 'hotspot',
      layer: 'world',
      transform: {
        x: transform.x,
        y: transform.y,
        w: transform.w != null ? transform.w : transform.width,
        h: transform.h != null ? transform.h : transform.height,
        z: transform.z != null ? transform.z : transform.zIndex || 1
      },
      events: {
        click: [{ action: 'change_scene', params: { sceneId: targetSceneId } }]
      },
      props: extra && extra.props ? extra.props : { label: id }
    };
    return node;
  }

  function createVillageDemoVisual() {
    return {
      mode: 'overlay',
      background: { asset: { type: 'image', src: 'assets/images/village.svg', ref: 'village_bg' } },
      nodes: [
        createHotspot('tavern', { x: 0.1, y: 0.4, w: 0.18, h: 0.25, z: 2 }, 'tavern'),
        createHotspot('smithy', { x: 0.35, y: 0.45, w: 0.16, h: 0.22, z: 2 }, 'smithy'),
        createHotspot('shop', { x: 0.55, y: 0.4, w: 0.15, h: 0.2, z: 2 }, 'shop'),
        createHotspot('chapel', { x: 0.75, y: 0.35, w: 0.18, h: 0.28, z: 2 }, 'chapel')
      ]
    };
  }

  const api = {
    MVP_KINDS,
    normalizeVisual,
    normalizeNode,
    normalizeAction,
    resolveAssetUrl,
    mount,
    unmount,
    onSceneShown,
    runClickActions,
    evaluateShowIf,
    pointInHotspotShape,
    createHotspot,
    createVillageDemoVisual,
    getMountState: function () {
      return {
        sceneId: mountState.sceneId,
        nodeCount: mountState.nodes.length,
        nodeIds: mountState.nodes.map(function (n) {
          return n.id;
        })
      };
    }
  };

  global.VisualRuntime = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);


;/* —— js/game-ui/ui-runtime.js —— */
/**
 * Game UI Runtime (Phase 1.9)
 * Declarative project.ui screens over existing gameplay UI.
 * - No Editor dependency
 * - Buttons → ACTION_REGISTRY / engine.runAction
 * - Persistent screens survive scene changes; scene-scoped unmount on leave
 * - Does NOT replace ui-renderer / SidebarDock / Journal
 */
(function gameUiRuntime(global) {
  'use strict';

  const UI_KINDS = Object.freeze([
    'image',
    'text',
    'button',
    'panel',
    'bar',
    'gold',
    'level',
    'portrait'
  ]);

  const BINDINGS = Object.freeze([
    'player.hp',
    'player.maxHp',
    'player.gold',
    'player.level',
    'player.name',
    'player.className',
    'quest.activeTitle',
    'quest.activeStage'
  ]);

  /** @type {{ engine: *, root: HTMLElement|null, persistentMounted: boolean, sceneId: string|null }} */
  const state = {
    engine: null,
    root: null,
    persistentMounted: false,
    sceneId: null
  };

  function clamp01(n, fallback) {
    const v = Number(n);
    if (!Number.isFinite(v)) return fallback;
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
  }

  function normalizeNode(raw, index) {
    if (typeof ProjectSchema !== 'undefined' && typeof ProjectSchema.normalizeUiNode === 'function') {
      const used = new Set();
      const n = ProjectSchema.normalizeUiNode(raw, index, used);
      if (n && typeof ProjectSchema.applySmartWidgetDefaults === 'function') {
        return ProjectSchema.applySmartWidgetDefaults(n);
      }
      return n;
    }
    if (!raw || typeof raw !== 'object') return null;
    const kind = String(raw.kind || raw.type || 'panel').toLowerCase();
    if (UI_KINDS.indexOf(kind) < 0) return null;
    const t = raw.transform || raw;
    return {
      id: String(raw.id || 'ui_' + index),
      kind,
      layer: raw.layer || 'hud',
      transform: {
        x: clamp01(t.x, 0),
        y: clamp01(t.y, 0),
        w: clamp01(t.w != null ? t.w : t.width, 0.12),
        h: clamp01(t.h != null ? t.h : t.height, 0.08),
        z: Number.isFinite(Number(t.z)) ? Number(t.z) : index
      },
      visible: raw.visible !== false,
      enabled: raw.enabled !== false,
      showIf: raw.showIf != null ? raw.showIf : null,
      text: raw.text != null ? String(raw.text) : '',
      binding: raw.binding != null ? String(raw.binding) : '',
      asset: raw.asset && typeof raw.asset === 'object' ? { ...raw.asset } : null,
      style: raw.style && typeof raw.style === 'object' ? { ...raw.style } : {},
      props: raw.props && typeof raw.props === 'object' ? { ...raw.props } : {},
      events: (typeof ProjectSchema !== 'undefined' && typeof ProjectSchema.normalizeEvents === 'function')
        ? ProjectSchema.normalizeEvents(raw.events)
        : (function () {
            const out = { click: [] };
            if (Array.isArray(raw.events?.click)) {
              out.click = raw.events.click
                .map((s) => {
                  if (!s || typeof s !== 'object') return null;
                  const action = s.action || s.type;
                  if (!action || typeof action !== 'string') return null;
                  let act = action;
                  const params = s.params && typeof s.params === 'object' ? { ...s.params } : {};
                  if (act === 'OpenScene' || act === 'open_scene') {
                    act = 'change_scene';
                    params.sceneId = params.sceneId || params.scene || params.to || '';
                  }
                  return { action: act, params };
                })
                .filter(Boolean);
            }
            return out;
          })()
    };
  }

  function normalizeScreen(raw, id) {
    if (typeof ProjectSchema !== 'undefined' && typeof ProjectSchema.normalizeUiScreen === 'function') {
      return ProjectSchema.normalizeUiScreen(raw, id);
    }
    if (!raw || typeof raw !== 'object') return null;
    const scope = raw.scope === 'scene' ? 'scene' : 'persistent';
    const nodes = Array.isArray(raw.nodes)
      ? raw.nodes.map(normalizeNode).filter(Boolean)
      : [];
    return {
      id: String(raw.id || id || 'screen'),
      scope,
      sceneId: raw.sceneId != null ? String(raw.sceneId) : '',
      visible: raw.visible !== false,
      events: (typeof ProjectSchema !== 'undefined' && ProjectSchema.normalizeEvents)
        ? ProjectSchema.normalizeEvents(raw.events)
        : { show: [] },
      nodes
    };
  }

  function ensureProjectUi(data) {
    if (!data) return { screens: {} };
    if (!data.ui || typeof data.ui !== 'object') data.ui = { screens: {} };
    if (!data.ui.screens || typeof data.ui.screens !== 'object') data.ui.screens = {};
    return data.ui;
  }

  function listScreens(data) {
    const ui = ensureProjectUi(data);
    const out = [];
    Object.keys(ui.screens).forEach((id) => {
      const s = normalizeScreen(ui.screens[id], id);
      if (s) out.push(s);
    });
    return out;
  }

  function resolveBinding(engine, path) {
    if (!path || !engine || !engine.state) return '';
    const st = engine.state;
    switch (path) {
      case 'player.hp':
        return st.hp != null ? String(st.hp) : '0';
      case 'player.maxHp':
        return st.maxHp != null ? String(st.maxHp) : '0';
      case 'player.gold':
        return st.gold != null ? String(st.gold) : '0';
      case 'player.level':
        return st.level != null ? String(st.level) : '1';
      case 'player.name':
        return String(st.charName || st.name || 'Герой');
      case 'player.className':
        return String(st.className || '');
      case 'quest.activeTitle': {
        const qp = st.questProgress || st.questStages || {};
        const active = st.activeQuest || st.currentQuest;
        if (active && qp[active]?.title) return String(qp[active].title);
        if (active && typeof active === 'string') return active;
        const keys = Object.keys(qp);
        if (keys.length) return String(qp[keys[0]]?.title || keys[0]);
        return '';
      }
      case 'quest.activeStage': {
        const qp = st.questProgress || st.questStages || {};
        const active = st.activeQuest || st.currentQuest || Object.keys(qp)[0];
        if (!active) return '0';
        const prog = qp[active];
        if (prog && prog.stage != null) return String(prog.stage);
        if (typeof prog === 'number') return String(prog);
        return '0';
      }
      default:
        return '';
    }
  }

  function applyTextTemplate(engine, text) {
    if (!text) return '';
    return String(text).replace(/\{([a-zA-Z0-9_.]+)\}/g, (_, key) => {
      const mapped =
        key === 'gold'
          ? 'player.gold'
          : key === 'level'
            ? 'player.level'
            : key === 'hp'
              ? 'player.hp'
              : key === 'maxHp'
                ? 'player.maxHp'
            : key === 'name'
              ? 'player.name'
              : key === 'questTitle'
                ? 'quest.activeTitle'
                : key.indexOf('.') >= 0
                    ? key
                    : 'player.' + key;
      return resolveBinding(engine, mapped);
    });
  }

  function resolveAssetUrl(engine, asset) {
    if (!asset) return '';
    if (asset.src) return asset.src;
    if (asset.ref && engine?.data?.assets) {
      const entry = engine.data.assets[asset.ref];
      if (typeof entry === 'string') return entry;
      if (entry?.src) return entry.src;
      if (entry?.url) return entry.url;
    }
    if (asset.ref) return asset.ref;
    return '';
  }

  function getOrCreateRoot() {
    if (typeof document === 'undefined') return null;
    let root = document.getElementById('game-ui-host');
    if (!root) {
      root = document.createElement('div');
      root.id = 'game-ui-host';
      root.setAttribute('data-game-ui', 'true');
      root.style.cssText =
        'position:fixed;left:0;top:0;right:0;bottom:0;pointer-events:none;z-index:40;';
      const parent =
        document.getElementById('game-root') ||
        document.getElementById('app') ||
        document.body;
      parent.appendChild(root);
    }
    return root;
  }

  function clearLayer(root, layerClass) {
    if (!root) return;
    Array.from(root.querySelectorAll('[data-ui-layer="' + layerClass + '"]')).forEach((n) =>
      n.remove()
    );
  }


  function evaluateShowIf(engine, showIf) {
    if (showIf == null || showIf === true) return true;
    if (showIf === false) return false;
    if (typeof ConditionSystem === 'undefined' || !ConditionSystem.evaluate) return true;
    var ctx = {};
    try {
      if (engine && typeof engine.getConditionContext === 'function') ctx = engine.getConditionContext() || {};
      else {
        ctx = {
          flags: (engine && engine.state && engine.state.flags) || {},
          inventory: (engine && engine.state && engine.state.inventory) || [],
          gold: (engine && engine.state && engine.state.gold) || 0,
          className: (engine && engine.state && (engine.state.className || engine.state.class)) || ''
        };
      }
    } catch (e) {}
    try { return !!ConditionSystem.evaluate(showIf, ctx); } catch (e2) { return true; }
  }

  function runClick(engine, steps) {
    if (!steps || !steps.length) return Promise.resolve(false);
    let p = Promise.resolve(true);
    steps.forEach((step) => {
      p = p.then(() => {
        if (typeof engine.runAction === 'function') {
          return engine.runAction(step.action, step.params || {});
        }
        if (typeof ACTION_REGISTRY !== 'undefined' && ACTION_REGISTRY[step.action]?.execute) {
          return ACTION_REGISTRY[step.action].execute(engine, step.params || {});
        }
        if (step.action === 'change_scene' && step.params?.sceneId && engine.showScene) {
          engine.showScene(step.params.sceneId);
          return true;
        }
        return false;
      });
    });
    return p.then((result) => {
      try {
        refreshBindings(engine);
      } catch (_) { /* ignore */ }
      return result;
    });
  }

  function resolveNodeTransform(node) {
    const tr = node.transform || {};
    const layout = node.props && node.props.layout;
    if (typeof ProjectSchema !== 'undefined' && typeof ProjectSchema.resolveUiAnchoredTransform === 'function') {
      return ProjectSchema.resolveUiAnchoredTransform(tr, layout);
    }
    return tr;
  }

  function renderNode(engine, node, layerEl) {
    if (!evaluateShowIf(engine, node.showIf)) return;
    const el = document.createElement('div');
    el.dataset.uiNode = node.id;
    el.dataset.uiKind = node.kind;
    const tr = resolveNodeTransform(node);
    el.style.cssText = [
      'position:absolute',
      'left:' + tr.x * 100 + '%',
      'top:' + tr.y * 100 + '%',
      'width:' + tr.w * 100 + '%',
      'height:' + tr.h * 100 + '%',
      'z-index:' + tr.z,
      'box-sizing:border-box',
      'pointer-events:' + (node.enabled && node.visible ? 'auto' : 'none'),
      'display:' + (node.visible ? 'flex' : 'none'),
      'align-items:center',
      'justify-content:center',
      'overflow:hidden',
      'user-select:none'
    ].join(';');

    if (node.kind === 'panel') {
      el.style.background = node.style.background || 'rgba(20,24,32,0.75)';
      el.style.borderRadius = '8px';
      el.style.border = node.style.border || '1px solid rgba(255,255,255,0.12)';
    } else if (node.kind === 'button') {
      el.style.background = node.style.background || 'rgba(60,90,140,0.9)';
      el.style.borderRadius = '6px';
      el.style.cursor = node.enabled ? 'pointer' : 'default';
      el.style.color = '#fff';
      el.style.fontWeight = '600';
      el.style.fontSize = '14px';
      el.textContent = applyTextTemplate(engine, node.text || node.props.label || 'Кнопка');
    } else if (node.kind === 'text' || node.kind === 'gold' || node.kind === 'level') {
      el.style.color = node.style.color || '#f0f0f0';
      el.style.fontSize = node.style.fontSize || '14px';
      el.style.justifyContent = 'flex-start';
      el.style.padding = '2px 6px';
      let content = node.text;
      if (node.kind === 'gold') content = content || '🪙 {gold}';
      if (node.kind === 'level') content = content || 'Ур. {level}';
      if (node.binding) content = resolveBinding(engine, node.binding);
      else content = applyTextTemplate(engine, content || '');
      el.textContent = content;
    } else if (node.kind === 'image' || node.kind === 'portrait') {
      const url = resolveAssetUrl(engine, node.asset);
      if (url) {
        el.style.backgroundImage = 'url("' + url.replace(/"/g, '\\"') + '")';
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.style.cursor = node.enabled && node.events.click.length ? 'pointer' : 'default';
      } else {
        el.style.background = 'rgba(80,80,100,0.5)';
        el.textContent = node.props?.widget === 'icon_action' ? '🖼' : (node.kind === 'portrait' ? '👤' : '');
      }
    } else if (node.props?.widget === 'quest_tracker') {
      el.style.color = node.style.color || '#f5e6c8';
      el.style.fontSize = node.style.fontSize || '13px';
      el.style.justifyContent = 'flex-start';
      el.style.padding = '4px 8px';
      el.style.background = node.style.background || 'rgba(20,24,32,0.75)';
      el.style.borderRadius = '6px';
      let content = node.text || '📜 {questTitle}';
      if (node.binding) content = resolveBinding(engine, node.binding);
      else content = applyTextTemplate(engine, content);
      el.textContent = content || '—';
    } else if (node.kind === 'bar') {
      el.style.background = 'rgba(0,0,0,0.45)';
      el.style.borderRadius = '4px';
      const fill = document.createElement('div');
      const hp = Number(resolveBinding(engine, 'player.hp')) || 0;
      const maxHp = Math.max(1, Number(resolveBinding(engine, 'player.maxHp')) || 1);
      const ratio = Math.max(0, Math.min(1, hp / maxHp));
      fill.style.cssText =
        'height:100%;width:' +
        ratio * 100 +
        '%;background:' +
        (node.style.fill || '#c44545') +
        ';border-radius:4px;';
      el.appendChild(fill);
      const label = document.createElement('span');
      label.style.cssText =
        'position:absolute;left:0;right:0;text-align:center;font-size:11px;color:#fff;';
      label.textContent = hp + ' / ' + maxHp;
      el.style.position = 'absolute';
      el.appendChild(label);
    }

    if (node.enabled && node.events.click.length) {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!evaluateShowIf(engine, node.showIf)) return;
        runClick(engine, node.events.click);
      });
    }

    layerEl.appendChild(el);
  }

  function mountScreen(engine, root, screen, layerName) {
    if (!screen || !screen.visible || !root) return;
    const layer = document.createElement('div');
    layer.dataset.uiLayer = layerName;
    layer.dataset.uiScreen = screen.id;
    layer.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;';
    const nodes = screen.nodes.slice().sort((a, b) => a.transform.z - b.transform.z);
    nodes.forEach((n) => {
      if (!evaluateShowIf(engine, n.showIf)) return;
      renderNode(engine, n, layer);
    });
    root.appendChild(layer);
    if (screen.events?.show?.length) {
      runClick(engine, screen.events.show);
    }
  }

  function mountPersistent(engine) {
    if (typeof document === 'undefined') return false;
    const root = getOrCreateRoot();
    state.engine = engine;
    state.root = root;
    clearLayer(root, 'persistent');
    listScreens(engine.data)
      .filter((s) => s.scope === 'persistent')
      .forEach((s) => mountScreen(engine, root, s, 'persistent'));
    state.persistentMounted = true;
    return true;
  }

  function onSceneShown(engine, sceneId) {
    if (typeof document === 'undefined') return false;
    const root = getOrCreateRoot();
    state.engine = engine;
    state.root = root;
    if (!state.persistentMounted) mountPersistent(engine);
    clearLayer(root, 'scene');
    state.sceneId = sceneId || null;
    listScreens(engine.data)
      .filter((s) => s.scope === 'scene' && s.sceneId === sceneId)
      .forEach((s) => mountScreen(engine, root, s, 'scene'));
    // refresh bindings on persistent (hp/gold may change between scenes)
    refreshBindings(engine);
    return true;
  }

  function refreshBindings(engine) {
    if (!state.root || !engine) return;
    const eng = engine || state.engine;
    listScreens(eng.data).forEach((screen) => {
      screen.nodes.forEach((node) => {
        const el = state.root.querySelector('[data-ui-node="' + node.id + '"]');
        if (!el) return;
        if (node.kind === 'gold' || node.kind === 'level' || node.kind === 'text') {
          let content = node.text;
          if (node.kind === 'gold') content = content || '🪙 {gold}';
          if (node.kind === 'level') content = content || 'Ур. {level}';
          if (node.binding) el.textContent = resolveBinding(eng, node.binding);
          else el.textContent = applyTextTemplate(eng, content || '');
        } else if (node.kind === 'bar') {
          const fill = el.querySelector('div');
          const label = el.querySelector('span');
          const hp = Number(resolveBinding(eng, 'player.hp')) || 0;
          const maxHp = Math.max(1, Number(resolveBinding(eng, 'player.maxHp')) || 1);
          if (fill) fill.style.width = Math.max(0, Math.min(1, hp / maxHp)) * 100 + '%';
          if (label) label.textContent = hp + ' / ' + maxHp;
        }
      });
    });
  }

  function unmountAll() {
    if (state.root) {
      state.root.innerHTML = '';
    }
    state.persistentMounted = false;
    state.sceneId = null;
    state.engine = null;
  }

  /** Built-in presets → plain editable node arrays */
  function presetMainMenu() {
    return {
      id: 'main_menu',
      scope: 'persistent',
      nodes: [
        {
          id: 'mm_bg',
          kind: 'panel',
          transform: { x: 0, y: 0, w: 1, h: 1, z: 0 },
          style: { background: 'rgba(12,16,24,0.92)' }
        },
        {
          id: 'mm_title',
          kind: 'text',
          transform: { x: 0.25, y: 0.12, w: 0.5, h: 0.1, z: 2 },
          text: 'Игра',
          style: { fontSize: '28px', color: '#f5e6c8' }
        },
        {
          id: 'mm_continue',
          kind: 'button',
          transform: { x: 0.35, y: 0.35, w: 0.3, h: 0.08, z: 3 },
          text: 'Продолжить',
          events: { click: [{ action: 'load_game', params: {} }] }
        },
        {
          id: 'mm_save',
          kind: 'button',
          transform: { x: 0.35, y: 0.46, w: 0.3, h: 0.08, z: 3 },
          text: 'Сохранить',
          events: { click: [{ action: 'save_game', params: {} }] }
        }
      ]
    };
  }

  function presetBasicHud() {
    return {
      id: 'basic_hud',
      scope: 'persistent',
      nodes: [
        {
          id: 'hud_panel',
          kind: 'panel',
          transform: { x: 0.02, y: 0.02, w: 0.28, h: 0.22, z: 1 },
          style: { background: 'rgba(15,20,28,0.8)' }
        },
        {
          id: 'hud_portrait',
          kind: 'portrait',
          transform: { x: 0.03, y: 0.03, w: 0.08, h: 0.12, z: 2 }
        },
        {
          id: 'hud_name',
          kind: 'text',
          transform: { x: 0.12, y: 0.03, w: 0.16, h: 0.04, z: 2 },
          text: '{name}'
        },
        {
          id: 'hud_level',
          kind: 'level',
          transform: { x: 0.12, y: 0.07, w: 0.16, h: 0.04, z: 2 }
        },
        {
          id: 'hud_hp',
          kind: 'bar',
          transform: { x: 0.03, y: 0.16, w: 0.25, h: 0.04, z: 2 }
        },
        {
          id: 'hud_gold',
          kind: 'gold',
          transform: { x: 0.03, y: 0.2, w: 0.25, h: 0.04, z: 2 }
        },
        {
          id: 'hud_inv',
          kind: 'button',
          transform: { x: 0.86, y: 0.02, w: 0.12, h: 0.07, z: 5 },
          text: 'Инвентарь',
          events: { click: [{ action: 'open_panel', params: { panel: 'inventory' } }] }
        },
        {
          id: 'hud_journal',
          kind: 'button',
          transform: { x: 0.86, y: 0.1, w: 0.12, h: 0.07, z: 5 },
          text: 'Журнал',
          events: { click: [{ action: 'open_panel', params: { panel: 'journal' } }] }
        }
      ]
    };
  }

  function presetCharacterStatus() {
    return {
      id: 'character_status',
      scope: 'persistent',
      nodes: [
        {
          id: 'cs_panel',
          kind: 'panel',
          transform: { x: 0.02, y: 0.7, w: 0.32, h: 0.26, z: 1 }
        },
        {
          id: 'cs_portrait',
          kind: 'portrait',
          transform: { x: 0.04, y: 0.72, w: 0.1, h: 0.14, z: 2 }
        },
        {
          id: 'cs_name',
          kind: 'text',
          transform: { x: 0.15, y: 0.72, w: 0.17, h: 0.05, z: 2 },
          text: '{name}'
        },
        {
          id: 'cs_hp',
          kind: 'bar',
          transform: { x: 0.04, y: 0.88, w: 0.28, h: 0.04, z: 2 }
        }
      ]
    };
  }

  function presetBottomBar() {
    return {
      id: 'bottom_action_bar',
      scope: 'persistent',
      nodes: [
        {
          id: 'bab_bg',
          kind: 'panel',
          transform: { x: 0.2, y: 0.88, w: 0.6, h: 0.1, z: 1 }
        },
        {
          id: 'bab_inv',
          kind: 'button',
          transform: { x: 0.25, y: 0.9, w: 0.15, h: 0.06, z: 2 },
          text: 'Инвентарь',
          events: { click: [{ action: 'open_panel', params: { panel: 'inventory' } }] }
        },
        {
          id: 'bab_journal',
          kind: 'button',
          transform: { x: 0.425, y: 0.9, w: 0.15, h: 0.06, z: 2 },
          text: 'Журнал',
          events: { click: [{ action: 'open_panel', params: { panel: 'journal' } }] }
        },
        {
          id: 'bab_save',
          kind: 'button',
          transform: { x: 0.6, y: 0.9, w: 0.15, h: 0.06, z: 2 },
          text: 'Сохранить',
          events: { click: [{ action: 'save_game', params: {} }] }
        }
      ]
    };
  }


  function presetJournalOverlay() {
    return {
      id: 'journal_overlay',
      screenType: 'journal',
      scope: 'persistent',
      nodes: [
        {
          id: 'jo_bg',
          kind: 'panel',
          transform: { x: 0.15, y: 0.08, w: 0.7, h: 0.84, z: 0 },
          style: { background: 'rgba(12,14,20,0.94)' }
        },
        {
          id: 'jo_title',
          kind: 'text',
          transform: { x: 0.2, y: 0.1, w: 0.6, h: 0.06, z: 1 },
          text: '📜 Журнал',
          style: { fontSize: '22px', color: '#f5e6c8' }
        },
        {
          id: 'jo_close',
          kind: 'button',
          transform: { x: 0.78, y: 0.1, w: 0.08, h: 0.05, z: 2 },
          text: '✕',
          events: { click: [{ action: 'open_panel', params: { panel: 'journal' } }] }
        }
      ]
    };
  }

  function presetInventoryOverlay() {
    return {
      id: 'inventory_overlay',
      screenType: 'inventory',
      scope: 'persistent',
      nodes: [
        {
          id: 'inv_bg',
          kind: 'panel',
          transform: { x: 0.1, y: 0.1, w: 0.8, h: 0.8, z: 0 },
          style: { background: 'rgba(18,22,30,0.95)' }
        },
        {
          id: 'inv_title',
          kind: 'text',
          transform: { x: 0.15, y: 0.12, w: 0.5, h: 0.05, z: 1 },
          text: '🎒 Инвентарь',
          style: { fontSize: '20px' }
        },
        {
          id: 'inv_close',
          kind: 'button',
          transform: { x: 0.82, y: 0.12, w: 0.06, h: 0.05, z: 2 },
          text: '✕',
          events: { click: [{ action: 'open_panel', params: { panel: 'inventory' } }] }
        }
      ]
    };
  }

  function presetPauseMenu() {
    return {
      id: 'pause_menu',
      screenType: 'pause',
      scope: 'persistent',
      nodes: [
        {
          id: 'pause_bg',
          kind: 'panel',
          transform: { x: 0, y: 0, w: 1, h: 1, z: 0 },
          style: { background: 'rgba(0,0,0,0.65)' }
        },
        {
          id: 'pause_title',
          kind: 'text',
          transform: { x: 0.3, y: 0.2, w: 0.4, h: 0.08, z: 1 },
          text: 'Пауза',
          style: { fontSize: '26px', color: '#fff' }
        },
        {
          id: 'pause_continue',
          kind: 'button',
          transform: { x: 0.35, y: 0.4, w: 0.3, h: 0.08, z: 2 },
          text: 'Продолжить',
          events: { click: [{ action: 'open_panel', params: { panel: 'pause' } }] }
        },
        {
          id: 'pause_save',
          kind: 'button',
          transform: { x: 0.35, y: 0.52, w: 0.3, h: 0.08, z: 2 },
          text: 'Сохранить',
          events: { click: [{ action: 'save_game', params: {} }] }
        }
      ]
    };
  }

  function presetDialogueOverlay() {
    return {
      id: 'dialogue_overlay',
      screenType: 'dialogue',
      scope: 'scene',
      sceneId: '',
      nodes: [
        {
          id: 'dlg_panel',
          kind: 'panel',
          transform: { x: 0.05, y: 0.72, w: 0.9, h: 0.24, z: 1 },
          style: { background: 'rgba(10,12,18,0.92)' }
        },
        {
          id: 'dlg_speaker',
          kind: 'text',
          transform: { x: 0.07, y: 0.74, w: 0.3, h: 0.05, z: 2 },
          text: '{name}',
          binding: 'player.name',
          style: { fontWeight: '600', color: '#ffd' }
        },
        {
          id: 'dlg_text',
          kind: 'text',
          transform: { x: 0.07, y: 0.8, w: 0.86, h: 0.14, z: 2 },
          text: 'Текст реплики…',
          style: { fontSize: '15px' }
        }
      ]
    };
  }

  function presetIconHud() {
    return {
      id: 'icon_hud',
      screenType: 'hud',
      scope: 'persistent',
      nodes: [
        {
          id: 'ih_journal',
          kind: 'image',
          props: { widget: 'journal_button', layout: { anchor: 'top-right', marginX: 0.02, marginY: 0.02 } },
          transform: { x: 0.86, y: 0.02, w: 0.1, h: 0.1, z: 5 },
          asset: { type: 'image', ref: 'diary_icon', src: 'assets/images/diary.svg' },
          events: { click: [{ action: 'open_panel', params: { panel: 'journal' } }] }
        },
        {
          id: 'ih_bag',
          kind: 'image',
          props: { widget: 'inventory_button', layout: { anchor: 'top-right', marginX: 0.14, marginY: 0.02 } },
          transform: { x: 0.72, y: 0.02, w: 0.1, h: 0.1, z: 5 },
          asset: { type: 'image', ref: 'bag_icon', src: 'assets/images/bag.svg' },
          events: { click: [{ action: 'open_panel', params: { panel: 'inventory' } }] }
        },
        {
          id: 'ih_quest',
          kind: 'text',
          props: { widget: 'quest_tracker', layout: { anchor: 'top-left', marginX: 0.02, marginY: 0.02 } },
          transform: { x: 0.02, y: 0.02, w: 0.35, h: 0.06, z: 4 },
          text: '📜 {questTitle}',
          binding: 'quest.activeTitle'
        }
      ]
    };
  }


  function presetRpgHud() {
    return {
      id: 'rpg_hud',
      scope: 'persistent',
      nodes: [
        { id: 'rh_bar_bg', kind: 'panel', transform: { x: 0.02, y: 0.02, w: 0.45, h: 0.1, z: 1 }, style: { background: 'rgba(10,14,22,0.85)' } },
        { id: 'rh_hp', kind: 'bar', transform: { x: 0.03, y: 0.035, w: 0.22, h: 0.035, z: 2 } },
        { id: 'rh_level', kind: 'level', transform: { x: 0.26, y: 0.03, w: 0.1, h: 0.04, z: 2 }, text: 'Ур. {level}' },
        { id: 'rh_gold', kind: 'gold', transform: { x: 0.36, y: 0.03, w: 0.1, h: 0.04, z: 2 }, text: '🪙 {gold}' },
        { id: 'rh_inv', kind: 'button', transform: { x: 0.72, y: 0.88, w: 0.12, h: 0.08, z: 5 }, text: 'Инвентарь',
          events: { click: [{ action: 'open_panel', params: { panel: 'inventory' } }] } },
        { id: 'rh_jr', kind: 'button', transform: { x: 0.86, y: 0.88, w: 0.12, h: 0.08, z: 5 }, text: 'Журнал',
          events: { click: [{ action: 'open_panel', params: { panel: 'journal' } }] } }
      ]
    };
  }

  const UI_SCREEN_TYPES = (typeof ProjectSchema !== 'undefined' && ProjectSchema.UI_SCREEN_TYPES)
    ? ProjectSchema.UI_SCREEN_TYPES
    : Object.freeze(['hud', 'main_menu', 'journal', 'inventory', 'pause', 'dialogue', 'custom']);

  const UIRuntime = {
    UI_KINDS,
    UI_SCREEN_TYPES,
    BINDINGS,
    normalizeNode,
    normalizeScreen,
    resolveNodeTransform,
    evaluateShowIf,
    ensureProjectUi,
    listScreens,
    resolveBinding,
    applyTextTemplate,
    resolveAssetUrl,
    mountPersistent,
    onSceneShown,
    refreshBindings,
    unmountAll,
    runClick,
    presets: {
      main_menu: presetMainMenu,
      basic_hud: presetBasicHud,
      character_status: presetCharacterStatus,
      bottom_action_bar: presetBottomBar,
      rpg_hud: presetRpgHud,
      journal_overlay: presetJournalOverlay,
      inventory_overlay: presetInventoryOverlay,
      pause_menu: presetPauseMenu,
      dialogue_overlay: presetDialogueOverlay,
      icon_hud: presetIconHud
    }
  };

  global.UIRuntime = UIRuntime;
  if (typeof module !== 'undefined' && module.exports) module.exports = UIRuntime;
})(typeof window !== 'undefined' ? window : globalThis);


;/* —— js/engine/core.js —— */
// ============================================================
// engine/core.js — инициализация, состояние, прогрессия, квесты
// ============================================================
// ============================================
// JSON ДВИЖОК v2.0
// ============================================
// Этот движок читает данные из data/game_data.json
// и строит игру динамически.
// НЕ НУЖНО редактировать этот файл для добавления контента!
// Весь контент — в JSON-файлах.
// ============================================

const GAME_DATA_CACHE_KEY = 'melnitsa_game_data';
const ACTIVE_CAMPAIGN_KEY = 'rpg_active_campaign';

const CAMPAIGNS = {
  melnitsa: {
    id: 'melnitsa',
    title: 'Мельница на Тихой реке',
    subtitle: 'D&D 5e · основная игра',
    description: 'Спасите мельника Альберта. Мельница, погреб, босс Корвин и деревня.',
    badge: 'Основная',
    dataUrl: 'data/game_data.json',
    inlineGlobal: 'GAME_DATA_INLINE',
    cacheKey: GAME_DATA_CACHE_KEY,
    saveKey: 'melnitsa_save',
    pageTitle: 'Мельница на Тихой реке — D&D Solo'
  },
  scifi: {
    id: 'scifi',
    title: 'Станция «Гефест»',
    subtitle: 'Sci-Fi хоррор · generic',
    description: 'Заброшенная орбитальная станция, кислород и сигнал бедствия.',
    badge: 'Демо',
    dataUrl: 'data/demos/scifi-horror-demo.json',
    inlineGlobal: 'DEMO_SCIFI_DATA',
    demoScript: 'js/demo-scifi.js',
    cacheKey: 'rpg_data_cache_scifi',
    saveKey: 'rpg_save_scifi',
    pageTitle: 'Станция Гефест — Demo'
  },
  pf2e: {
    id: 'pf2e',
    title: 'Мельница на Тихой реке',
    subtitle: 'Pathfinder 2e · демо-кампания',
    description: 'Деревня Горнистead: пропавший мельник, святилище фейри, уровни 1–10.',
    badge: 'Демо PF2e',
    dataUrl: 'data/demos/pf2e-mill.json',
    inlineGlobal: 'DEMO_PF2E_DATA',
    demoScript: 'js/demo-pf2e.js',
    expectedCampaignId: 'pf2e_mill',
    dataVersion: 'mill-1.0',
    cacheKey: 'rpg_data_cache_pf2e_mill',
    saveKey: 'rpg_save_pf2e',
    pageTitle: 'Мельница на Тихой реке — PF2e Demo'
  },
  mvp_proof: {
    id: 'mvp_proof',
    title: 'Oakhaven MVP Proof',
    subtitle: 'Hybrid RPG · no-code proof',
    description: 'Деревня → NPC → квест → лес → бой → лут → награда → сохранение. Без author JS.',
    badge: 'MVP Proof',
    dataUrl: 'data/demos/mvp_proof.json',
    inlineGlobal: 'DEMO_MVP_PROOF_DATA',
    demoScript: 'js/demo-mvp-proof.js',
    expectedCampaignId: 'mvp_proof',
    dataVersion: 'mvp-proof-1.0',
    cacheKey: 'rpg_data_cache_mvp_proof',
    saveKey: 'rpg_save_mvp_proof',
    pageTitle: 'Oakhaven MVP Proof'
  }
};


const GameEngine = window.GameEngine || {};
window.GameEngine = GameEngine;

Object.assign(GameEngine, {
    data: null,
    dataSource: null,
    activeCampaignId: null,
    activeSystem: null,
    state: {
      charName: '', className: '', gender: 'male', stats: null, hp: 25, maxHp: 25, gold: 0,
      inventory: [], flags: {}, scene: 'start', combat: null,
      enemies: [], resources: { mode: 'energy', current: 0, max: 0, spellSlots: null },
      supplies: 0, classData: {}, questStages: {},
      questProgress: {},
      equipped: {},
      /** Активные эффекты проклятий с надетых предметов (флаги по ID эффекта) */
      curseEffects: {},
      /** Уровень заточки по ID предмета (сохраняется отдельно от шаблона JSON) */
      itemEnhancements: {},
      level: 1, exp: 0, expAwarded: {}, pendingLevelUp: null, resumeAfterLevelUp: null,
      currentChoices: [],
      sceneVisits: {},
      visitedLocations: {},
      /** Зачищенные боевые сцены: sceneId → { mapLocation, afterScene, label, … } */
      clearedCombats: {},
      /** Владения навыками (id: athletics, perception, …) — D&D 5e */
      proficiencies: { skills: [] },
      /** Ранги навыков PF2e: { athletics: 'trained', … } */
      skills: {},
      /** История повышений навыков PF2e при level-up */
      skillIncreases: [],
      /** Оставшиеся глотки расходников с зарядами (например water_flask) */
      itemCharges: {},
      /** Разблокированные достижения: id → { unlockedAt } */
      achievementUnlocks: {}
    },
    itemMap: {
      "Длинный меч": "longsword",
      "Кольчуга": "chainmail",
      "Щит": "shield",
      "Фляга с водой": "water_flask",
      "Посох": "staff",
      "Роба ученика": "robe",
      "Книга заклинаний": "spellbook",
      "Моргенштерн": "morningstar",
      "Латы": "plate_armor",
      "Святой символ": "holy_symbol"
    },
  
    // ========== СИСТЕМА УРОВНЕЙ (data-driven) ==========
    isProgressionEnabled() {
      return this.data?.progression?.enabled !== false && Array.isArray(this.data?.progression?.expTable);
    },

    getProgression() {
      return this.data?.progression || {};
    },

    /** Предметы: itemsData (алиас data.items) */
    get itemsData() {
      return this.data?.items || {};
    },

    /** Базовые характеристики персонажа (без бонусов экипировки) */
    getBaseStats() {
      return this.state.stats || this.state.classData?.stats || {};
    },

    /** Эффективные характеристики с учётом bonuses предметов */
    getPlayerStats() {
      return this.state._effectiveStats || this.getBaseStats();
    },

    /** Все слоты экипировки (две руки, броня, щит, аксессуары) */
    EQUIPMENT_SLOTS: ['weapon_main', 'weapon_off', 'armor', 'shield', 'ring1', 'ring2', 'necklace', 'earrings'],
    WEAPON_SLOTS: ['weapon_main', 'weapon_off'],

    /** Слоты аксессуаров */
    ACCESSORY_SLOTS: ['ring1', 'ring2', 'necklace', 'earrings'],

    /** Справочник эффектов проклятия (ID → подпись и иконка для UI) */
    CURSE_EFFECT_DEFS: {
      silence: { label: 'Безмолвие', icon: '🤐' },
      weakness: { label: 'Слабость', icon: '💀' },
      poison_touch: { label: 'Ядовитое касание', icon: '☠️' },
      bloodlust: { label: 'Кровожадность', icon: '🩸' },
      haunted: { label: 'Преследование', icon: '👻' }
    },

    initActiveSystem() {
      const systemId = this.data?.meta?.system || this.data?.system || 'dnd5e';
      if (typeof SystemRegistry !== 'undefined') {
        this.activeSystem = SystemRegistry.get(systemId);
      } else if (systemId === 'pf2e' && typeof Pathfinder2eSystem !== 'undefined') {
        this.activeSystem = Pathfinder2eSystem;
      } else if (typeof DnD5eSystem !== 'undefined') {
        this.activeSystem = DnD5eSystem;
      } else {
        this.activeSystem = null;
      }
    },

    isPf2e() {
      return this.activeSystem?.id === 'pf2e';
    },

    getPf2eActionsPerTurn() {
      return this.activeSystem?.getActionsPerTurn?.() ?? 3;
    },

    resetPf2eCombatActions() {
      if (!this.state.combat) return;
      this.state.combat.actionsRemaining = this.getPf2eActionsPerTurn();
      this.state.combat.mapPenalty = 0;
    },

    spendPf2eActions(cost) {
      if (!this.isPf2e() || !this.state.combat) return true;
      const n = Math.max(0, parseInt(cost, 10) || 1);
      const left = this.state.combat.actionsRemaining ?? this.getPf2eActionsPerTurn();
      if (left < n) {
        this.log(`⚡ Недостаточно действий (нужно ${n}, осталось ${left})`, 'log-dice');
        return false;
      }
      this.state.combat.actionsRemaining = left - n;
      return true;
    },

    endPf2ePlayerTurnIfNoActions() {
      if (!this.isPf2e() || !this.state.combat) return false;
      if ((this.state.combat.actionsRemaining ?? 0) > 0) return false;
      this.state.combat.turnIndex++;
      setTimeout(() => this.nextCombatTurn(), 600);
      return true;
    },

    getProficiencyBonus() {
      const level = Math.max(1, parseInt(this.state.level, 10) || 1);
      if (this.activeSystem?.getProficiencyBonus) {
        return this.activeSystem.getProficiencyBonus(level);
      }
      return Math.max(2, 2 + Math.floor((level - 1) / 4));
    },

    /** Категория аксессуара: ring | necklace | earrings (legacy: accessory → ring) */
    getAccessoryCategory(item) {
      if (!item) return null;
      if (item.type === 'accessory') return item.slot || 'ring';
      if (item.equippable) {
        if (item.slot === 'accessory') return 'ring';
        if (['ring', 'necklace', 'earrings'].includes(item.slot)) return item.slot;
      }
      return null;
    },

    isAccessoryItem(item) {
      if (!item) return false;
      if (item.type === 'accessory') return true;
      return !!(item.equippable && this.getAccessoryCategory(item));
    },

    /**
     * Слот для кольца: ring1, если занят — ring2; ожерелье/серьги — отдельные слоты.
     */
    resolveAccessoryEquipSlot(item) {
      const cat = this.getAccessoryCategory(item);
      if (cat === 'necklace') return 'necklace';
      if (cat === 'earrings') return 'earrings';
      const eq = this.state.equipped || {};
      if (!eq.ring1) return 'ring1';
      if (!eq.ring2) return 'ring2';
      return 'ring2';
    },

    /** Одноручное / двуручное (по умолчанию одноручное) */
    getWeaponHands(item) {
      if (!this.isWeaponItem(item)) return null;
      const h = String(item?.hands || 'one').toLowerCase();
      return h === 'two' ? 'two' : 'one';
    },

    isTwoHandedWeapon(item) {
      return this.getWeaponHands(item) === 'two';
    },

    /** Слот экипировки: weapon_main | weapon_off | armor | shield | аксессуары */
    getEquipSlot(item, preferredSlot) {
      if (!item) return null;
      if (this.isAccessoryItem(item)) return this.resolveAccessoryEquipSlot(item);
      if (this.isWeaponItem(item)) {
        if (preferredSlot === 'weapon_main' || preferredSlot === 'weapon_off') return preferredSlot;
        return 'weapon_main';
      }
      if (item.type === 'armor' || item.slot === 'armor') return 'armor';
      if (item.type === 'shield' || item.slot === 'shield' || item.slot === 'offhand') return 'shield';
      return null;
    },

    isWeaponItem(item) {
      if (!item) return false;
      if (item.type === 'weapon') return true;
      return item.type === 'equipment' && item.slot === 'weapon';
    },

    isArmorItem(item) {
      if (!item) return false;
      if (item.type === 'armor') return true;
      return item.type === 'equipment' && item.slot === 'armor';
    },

    isShieldItem(item) {
      if (!item) return false;
      if (item.type === 'shield') return true;
      return item.type === 'equipment' && (item.slot === 'shield' || item.slot === 'offhand');
    },

    isGameplayEquippable(item) {
      return this.isWeaponItem(item) || this.isArmorItem(item) || this.isShieldItem(item);
    },

    isEquippableItem(item) {
      if (!item) return false;
      if (this.isGameplayEquippable(item)) return true;
      return this.isAccessoryItem(item);
    },

    isItemEquipped(itemId) {
      const eq = this.state.equipped || {};
      return this.EQUIPMENT_SLOTS.some(slot => eq[slot] === itemId)
        || eq.weapon === itemId
        || eq.offhand === itemId
        || eq.accessory === itemId;
    },

    getEquippedItemId(slot) {
      const eq = this.state.equipped || {};
      if (slot === 'weapon') return eq.weapon_main || eq.weapon || null;
      if (slot === 'weapon_main') return eq.weapon_main || eq.weapon || null;
      if (slot === 'shield') return eq.shield || eq.offhand || null;
      return eq[slot] || null;
    },

    clearEquipSlot(slot, opts = {}) {
      if (!this.state.equipped) return;
      const id = this.getEquippedItemId(slot);
      if (!id) return;
      delete this.state.equipped[slot];
      if (slot === 'shield') delete this.state.equipped.offhand;
      if (!opts.silent) {
        const db = this.itemsData[id];
        this.log(`Снято: ${db?.name || id}`, 'log-dice');
      }
    },

    hasDualWieldSetup() {
      const mainId = this.getEquippedItemId('weapon_main');
      const offId = this.getEquippedItemId('weapon_off');
      if (!mainId || !offId) return false;
      const main = this.itemsData[mainId];
      const off = this.itemsData[offId];
      return this.isOneHandedWeapon(main) && this.isOneHandedWeapon(off);
    },

    isOneHandedWeapon(item) {
      return this.isWeaponItem(item) && this.getWeaponHands(item) === 'one';
    },

    isOffHandBlockedByTwoHander() {
      const mainId = this.getEquippedItemId('weapon_main');
      if (!mainId) return false;
      return this.isTwoHandedWeapon(this.itemsData[mainId]);
    },

    getOffHandSlotLabel() {
      if (this.isOffHandBlockedByTwoHander()) {
        return 'Занято двуручным оружием';
      }
      const shieldId = this.getEquippedItemId('shield');
      if (shieldId) {
        const sh = this.itemsData[shieldId];
        return sh?.name ? `Щит: ${sh.name}` : 'Щит';
      }
      const offId = this.getEquippedItemId('weapon_off');
      if (offId) {
        const w = this.itemsData[offId];
        return w?.name || 'Оружие';
      }
      return 'Пусто';
    },

    /** Дефолты заточки, если в JSON предмета не заданы поля */
    DEFAULT_ENHANCEMENT_MAX: 3,
    DEFAULT_ENHANCEMENT_COSTS: [100, 300, 900],
    ENHANCEMENT_SLOTS: ['weapon_main', 'armor', 'shield'],

    /** Текущий уровень +N предмета (0, если не заточен) */
    getItemEnhancementLevel(itemId) {
      if (!itemId) return 0;
      if (this.state.itemEnhancements?.[itemId] != null) {
        return Math.max(0, parseInt(this.state.itemEnhancements[itemId], 10) || 0);
      }
      const template = this.itemsData?.[itemId];
      return Math.max(0, parseInt(template?.enhancement, 10) || 0);
    },

    setItemEnhancementLevel(itemId, level) {
      if (!itemId) return;
      if (!this.state.itemEnhancements) this.state.itemEnhancements = {};
      this.state.itemEnhancements[itemId] = Math.max(0, parseInt(level, 10) || 0);
    },

    getItemEnhancementMax(item) {
      if (!item) return this.DEFAULT_ENHANCEMENT_MAX;
      const m = item.enhancementMax;
      return m != null ? Math.max(0, parseInt(m, 10) || 0) : this.DEFAULT_ENHANCEMENT_MAX;
    },

    getItemEnhancementCosts(item) {
      const costs = item?.enhancementCost;
      if (Array.isArray(costs) && costs.length) {
        return costs.map(c => Math.max(0, parseInt(c, 10) || 0));
      }
      return [...this.DEFAULT_ENHANCEMENT_COSTS];
    },

    /** Стоимость следующего уровня заточки (+1 → индекс 0) */
    getNextEnhancementCost(itemId) {
      const template = this.itemsData?.[itemId];
      if (!template) return null;
      const current = this.getItemEnhancementLevel(itemId);
      const session = this.state.blacksmithSession;
      const max = session?.maxEnhancement != null
        ? Math.min(this.getItemEnhancementMax(template), Number(session.maxEnhancement))
        : this.getItemEnhancementMax(template);
      if (current >= max) return null;
      if (session?.costTable && session.costTable[current] != null) {
        return Number(session.costTable[current]);
      }
      const costs = this.getItemEnhancementCosts(template);
      return costs[current] ?? costs[costs.length - 1] ?? this.DEFAULT_ENHANCEMENT_COSTS[current] ?? null;
    },

    /** Шаблон предмета + актуальный enhancement из сохранения */
    getEffectiveItemData(itemId) {
      const base = this.itemsData?.[itemId];
      if (!base) return null;
      return {
        ...base,
        enhancement: this.getItemEnhancementLevel(itemId)
      };
    },

    getEquippedItem(slot) {
      const id = this.getEquippedItemId(slot);
      return id ? this.getEffectiveItemData(id) : null;
    },

    getEquippedWeaponId(cls) {
      const eq = this.getEquippedItemId('weapon_main');
      if (eq) return eq;
      const items = this.itemsData;
      if (cls?.mainWeapon && items[cls.mainWeapon]) return cls.mainWeapon;
      const fromInv = (this.state.inventory || []).find(id => this.isWeaponItem(items[id]));
      if (fromInv) return fromInv;
      return (cls?.startingItems || []).find(id => this.isWeaponItem(items[id])) || null;
    },

    migrateEquippedSlots() {
      const eq = this.state.equipped || {};
      if (eq.weapon && !eq.weapon_main) {
        eq.weapon_main = eq.weapon;
        delete eq.weapon;
      }
      if (eq.offhand && !eq.shield) {
        eq.shield = eq.offhand;
        delete eq.offhand;
      }
      this.WEAPON_SLOTS.forEach((slot) => {
        if (!(slot in eq)) eq[slot] = null;
      });
      // Старые сохранения: нет слотов аксессуаров — null
      this.ACCESSORY_SLOTS.forEach(slot => {
        if (!(slot in eq)) eq[slot] = null;
      });
      // Legacy: один слот accessory → ring1 или ring2
      if (eq.accessory) {
        if (!eq.ring1) eq.ring1 = eq.accessory;
        else if (!eq.ring2) eq.ring2 = eq.accessory;
        delete eq.accessory;
      }
      this.state.equipped = eq;
    },

    /**
     * bonuses предмета + заточка (enhancement):
     * оружие: atkBonus, dmgBonus; броня/щит: acBonus.
     */
    getItemBonuses(item) {
      const b = (item?.bonuses && typeof item.bonuses === 'object') ? { ...item.bonuses } : {};
      const enh = parseInt(item?.enhancement, 10) || 0;
      if (enh > 0 && this.isWeaponItem(item)) {
        b.atkBonus = (b.atkBonus || 0) + enh;
        b.dmgBonus = (b.dmgBonus || 0) + enh;
      }
      if (enh > 0 && (this.isArmorItem(item) || this.isShieldItem(item))) {
        b.acBonus = (b.acBonus || 0) + enh;
      }
      return b;
    },

    /** Экипированные слоты, доступные для заточки в кузнице */
    getBlacksmithEnhanceableEntries() {
      const entries = [];
      for (const slot of this.ENHANCEMENT_SLOTS) {
        const itemId = this.getEquippedItemId(slot);
        if (!itemId) continue;
        const item = this.getEffectiveItemData(itemId);
        if (!item) continue;
        if (!this.isWeaponItem(item) && !this.isArmorItem(item) && !this.isShieldItem(item)) continue;
        const current = this.getItemEnhancementLevel(itemId);
        const max = this.getItemEnhancementMax(item);
        const cost = this.getNextEnhancementCost(itemId);
        if (cost == null) continue;
        entries.push({
          slot,
          itemId,
          name: item.name || itemId,
          current,
          next: current + 1,
          max,
          cost
        });
      }
      return entries;
    },

    /** Сумма bonuses по всем слотам экипировки */
    collectEquipmentBonuses() {
      const totals = {
        str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0,
        maxHpBonus: 0, acBonus: 0, atkBonus: 0, dmgBonus: 0
      };
      for (const slot of this.EQUIPMENT_SLOTS) {
        const item = this.getEquippedItem(slot);
        if (!item) continue;
        const b = this.getItemBonuses(item);
        for (const [key, raw] of Object.entries(b)) {
          const val = Number(raw) || 0;
          if (this.STAT_KEYS.includes(key)) totals[key] += val;
          else if (key === 'maxHpBonus') totals.maxHpBonus += val;
          else if (key === 'acBonus') totals.acBonus += val;
          else if (key === 'atkBonus') totals.atkBonus += val;
          else if (key === 'dmgBonus') totals.dmgBonus += val;
        }
      }
      return totals;
    },

    /** baseMaxHp для старых сохранений: вычитаем бонусы экипировки из текущего maxHp */
    ensureBaseMaxHp() {
      if (this.state.baseMaxHp != null) return;
      const bonuses = this.collectEquipmentBonuses();
      this.state.baseMaxHp = Math.max(1, (this.state.maxHp || 1) - bonuses.maxHpBonus);
    },

    getInventoryCategory(item) {
      const t = item?.type;
      if (t === 'consumable' || t === 'key' || t === 'quest') return t;
      if (t === 'accessory' || t === 'weapon' || t === 'armor' || t === 'shield' || t === 'equipment') return 'equipment';
      if (t === 'readable') return 'quest';
      if (item?.useAbility || item?.use) return 'consumable';
      return 'equipment';
    },

    getShieldAcBonus() {
      const shield = this.getEquippedItem('shield');
      if (!shield || !this.isShieldItem(shield)) return 0;
      return parseInt(shield.acBonus, 10) || 0;
    },

    /** Пассивные бонусы из изученных умений (пересчитываются при каждом recalcDerivedStats) */
    collectPassiveAbilityBonuses() {
      const totals = { acBonus: 0, atkBonus: 0, maxHpBonus: 0 };
      const abilities = this.state.classData?.abilities || [];
      abilities.forEach(ab => {
        if (ab.type !== 'passive' && !ab.passive) return;
        const p = ab.passive;
        if (!p || typeof p !== 'object') return;

        if (p.acBonus) {
          const n = parseInt(p.acBonus, 10) || 0;
          if (n && this.isPassiveAcBonusActive(ab)) totals.acBonus += n;
        }
        if (p.atkBonus) {
          const n = parseInt(p.atkBonus, 10) || 0;
          if (n) totals.atkBonus += n;
        }
        if (p.maxHpBonus) {
          const n = parseInt(p.maxHpBonus, 10) || 0;
          if (n) totals.maxHpBonus += n;
        }
      });
      return totals;
    },

    /** Условия пассивного бонуса к КД (например «Мастер щита» только со щитом) */
    isPassiveAcBonusActive(ability) {
      const id = ability?.id;
      const p = ability?.passive;
      if (id === 'shield_master' || p?.requiresShield === true) {
        const shield = this.getEquippedItem('shield');
        return !!(shield && this.isShieldItem(shield));
      }
      return true;
    },

    /** КД по D&D 5e: броня + щит, иначе 10 + DEX + щит */
    computePlayerAC() {
      const stats = this.getPlayerStats();
      if (this.activeSystem?.calculateAC) {
        return this.activeSystem.calculateAC(
          stats,
          { itemsData: this.itemsData, getEquippedItem: (slot) => this.getEquippedItem(slot) },
          this.data,
          this
        );
      }
      const dexMod = this.getModifier(stats.dex ?? 10);
      const shieldBonus = this.getShieldAcBonus();
      const armor = this.getEquippedItem('armor');

      if (armor && this.isArmorItem(armor)) {
        const baseAc = parseInt(armor.ac ?? armor.baseAc, 10);
        if (!isNaN(baseAc)) {
          const armorType = String(armor.armorType || 'heavy').toLowerCase();
          let ac = baseAc;
          if (armorType === 'light') ac += dexMod;
          else if (armorType === 'medium') ac += Math.min(dexMod, 2);
          return ac + shieldBonus;
        }
      }

      return 10 + dexMod + shieldBonus;
    },

    canWearArmor(item) {
      if (!item || !this.isArmorItem(item)) return true;
      const req = parseInt(item.strRequirement, 10);
      if (!req) return true;
      const str = parseInt(this.getPlayerStats().str, 10) || 10;
      return str >= req;
    },

    /** Профиль урона/атаки для слота weapon_main | weapon_off */
    getWeaponAttackProfile(slot = 'weapon_main') {
      const stats = this.getPlayerStats();
      const prof = this.getProficiencyBonus();
      const passiveBonuses = this.collectPassiveAbilityBonuses();
      const levelBonuses = this.collectProgressionLevelBonuses();
      const equipBonuses = this.collectEquipmentBonuses();
      const weaponId = this.getEquippedItemId(slot);
      const weapon = weaponId ? this.itemsData[weaponId] : null;

      if (!weapon || !this.isWeaponItem(weapon)) {
        if (slot === 'weapon_off') return null;
        const strMod = this.getModifier(stats.str ?? 10);
        return {
          dmgRoll: '1',
          dmgBonus: strMod + equipBonuses.dmgBonus,
          atkBonus: prof + strMod + equipBonuses.atkBonus + passiveBonuses.atkBonus + levelBonuses.atkBonus,
          statKey: 'str',
          weaponName: 'Кулаки',
          weaponId: null,
          isOffHand: false
        };
      }

      const statKey = String(weapon.stat || 'str').toLowerCase();
      const statMod = this.getModifier(stats[statKey] ?? 10);
      const itemBonuses = this.getItemBonuses(weapon);
      const dmgRoll = weapon.damage || weapon.dmgRoll || '1d6';

      if (slot === 'weapon_off') {
        return {
          dmgRoll,
          dmgBonus: (itemBonuses.dmgBonus || 0),
          atkBonus: statMod + (itemBonuses.atkBonus || 0),
          statKey,
          weaponName: weapon.name || 'Оружие',
          weaponId,
          isOffHand: true
        };
      }

      const isRanged =
        typeof CombatPosition !== 'undefined' &&
        CombatPosition.isWeaponRanged(weapon);

      return {
        dmgRoll,
        dmgBonus: statMod + (itemBonuses.dmgBonus || 0) + equipBonuses.dmgBonus,
        atkBonus: prof + statMod + (itemBonuses.atkBonus || 0) + equipBonuses.atkBonus
          + passiveBonuses.atkBonus + levelBonuses.atkBonus,
        statKey,
        weaponName: weapon.name || 'Оружие',
        weaponId,
        isOffHand: false,
        isRanged: !!isRanged
      };
    },

    /** Профиль атаки по ID предмета (лук из инвентаря, не экипирован) */
    getWeaponAttackProfileFromItem(itemId) {
      const weapon = this.itemsData?.[itemId] || this.data?.items?.[itemId];
      if (!weapon || !this.isWeaponItem(weapon)) return null;
      const stats = this.getPlayerStats();
      const prof = this.getProficiencyBonus();
      const passiveBonuses = this.collectPassiveAbilityBonuses();
      const levelBonuses = this.collectProgressionLevelBonuses();
      const equipBonuses = this.collectEquipmentBonuses();
      const statKey = String(weapon.stat || 'dex').toLowerCase();
      const statMod = this.getModifier(stats[statKey] ?? 10);
      const itemBonuses = this.getItemBonuses(weapon);
      const isRanged =
        typeof CombatPosition !== 'undefined' && CombatPosition.isWeaponRanged(weapon);
      return {
        dmgRoll: weapon.damage || weapon.dmgRoll || '1d6',
        dmgBonus: statMod + (itemBonuses.dmgBonus || 0) + equipBonuses.dmgBonus,
        atkBonus:
          prof + statMod + (itemBonuses.atkBonus || 0) + equipBonuses.atkBonus
          + passiveBonuses.atkBonus + levelBonuses.atkBonus,
        statKey,
        weaponName: weapon.name || 'Оружие',
        weaponId: itemId,
        isOffHand: false,
        isRanged: !!isRanged
      };
    },

    /** Урон основной руки для панели статов (classData) */
    computeWeaponDamageProfile() {
      const p = this.getWeaponAttackProfile('weapon_main');
      if (!p) {
        const stats = this.getPlayerStats();
        const strMod = this.getModifier(stats.str ?? 10);
        return {
          dmgRoll: '1',
          dmgBonus: strMod,
          statKey: 'str',
          weaponName: 'Кулаки',
          weaponId: null
        };
      }
      return {
        dmgRoll: p.dmgRoll,
        dmgBonus: p.dmgBonus,
        statKey: p.statKey,
        weaponName: p.weaponName,
        weaponId: p.weaponId
      };
    },

    rollWeaponDamage(profile, critical = false) {
      if (!profile) return 0;
      let dice = this.parseRoll(profile.dmgRoll || '1');
      if (critical) dice += this.parseRoll(profile.dmgRoll || '1');
      let total = dice + (profile.dmgBonus ?? 0);
      const combat = this.state.combat;
      if (combat?.tempDmgBonus) total += Number(combat.tempDmgBonus) || 0;
      if (critical && (this.state.classData?.abilities || []).some((a) => a.id === 'barbarian_brutal_critical')) {
        total += this.parseRoll('1d6');
      }
      return total;
    },

    getClassResourceConfig(classKey) {
      classKey = classKey || this.state.className;
      return this.data?.classes?.[classKey]?.resource || null;
    },

    getClassResourceMax(classKey, level) {
      const cls = this.data?.classes?.[classKey];
      const res = cls?.resource;
      const lvl = Math.max(1, parseInt(level, 10) || 1);
      const stats = this.state.stats || this.state.classData?.stats || cls?.stats || {};
      const mod = (stat) => this.getModifier(stats[stat] ?? 10);

      if (res?.formula === 'rage') return Math.max(1, 2 + mod('con'));
      if (res?.formula === 'charisma') return Math.max(1, mod('cha'));
      if (res?.formula === 'wild_shape') return 2;
      if (res?.formula === 'level') return Math.max(0, lvl);

      const arr = this.getSlotsArrayForLevel(classKey, lvl);
      if (arr?.length === 1 && !cls?.spellcasting && !cls?.pactMagic) {
        return Math.max(0, Number(arr[0]) || res?.max || 0);
      }
      return res?.max ?? 2;
    },

    getWarlockPactSlots(level) {
      const lvl = Math.max(1, parseInt(level, 10) || 1);
      const count = lvl >= 2 ? 2 : 1;
      const slotLevel = Math.min(5, Math.max(1, Math.ceil(lvl / 2)));
      return { count, slotLevel };
    },

    buildWarlockSpellSlots(level) {
      const { count, slotLevel } = this.getWarlockPactSlots(level);
      return { [String(slotLevel)]: { c: count, m: count } };
    },

    playerHasExtraAttack() {
      return (this.state.classData?.abilities || []).some(
        (a) => a.passive?.extraAttack
          || a.id === 'barbarian_extra_attack'
          || a.id === 'monk_extra_attack'
      );
    },

    DEFAULT_CREATURE_TYPES: {
      beast: 'Звери',
      humanoid: 'Гуманоиды',
      giant: 'Великаны',
      elemental: 'Элементали'
    },

    getCreatureTypeCatalog() {
      const raw = this.data?.creatureTypes;
      const src = raw && typeof raw === 'object' && Object.keys(raw).length
        ? raw
        : this.DEFAULT_CREATURE_TYPES;
      return Object.keys(src).map((id) => ({
        id,
        label: typeof src[id] === 'string' ? src[id] : (src[id]?.name || id)
      }));
    },

    getCreatureTypeLabel(typeId) {
      if (!typeId) return '';
      const row = this.getCreatureTypeCatalog().find((t) => t.id === typeId);
      return row?.label || typeId;
    },

    getDefaultCreatureType() {
      const ids = this.getCreatureTypeCatalog().map((t) => t.id);
      return ids.includes('humanoid') ? 'humanoid' : (ids[0] || 'humanoid');
    },

    getEnemyCreatureType(enemy) {
      if (!enemy) return this.getDefaultCreatureType();
      if (enemy.creatureType) return enemy.creatureType;
      const tplId = enemy.id || enemy.templateId;
      if (tplId && this.data?.enemies?.[tplId]?.creatureType) {
        return this.data.enemies[tplId].creatureType;
      }
      return this.getDefaultCreatureType();
    },

    hasPlayerAbility(abilityId) {
      return !!this.state.classData?.abilities?.some((a) => a.id === abilityId);
    },

    getMaxFavoredEnemyTypes() {
      let max = 0;
      if (this.hasPlayerAbility('ranger_favored_enemy_base')) max = 1;
      if (this.hasPlayerAbility('ranger_favored_enemy')) max = 2;
      return max;
    },

    formatFavoredEnemyTypesList() {
      const types = this.state.favoredEnemyTypes || [];
      if (!types.length) return '';
      return types.map((t) => this.getCreatureTypeLabel(t)).join(', ');
    },

    getAbilityDisplayDesc(ab) {
      if (!ab) return '';
      let desc = ab.desc || '';
      if (ab.id === 'ranger_favored_enemy_base' || ab.id === 'ranger_favored_enemy') {
        const picked = this.formatFavoredEnemyTypesList();
        if (picked) desc += (desc ? ' ' : '') + `Выбрано: ${picked}.`;
      }
      return desc;
    },

    getFavoredEnemyDamageBonus(enemy) {
      if (!this.hasPlayerAbility('ranger_favored_enemy')) return 0;
      const types = this.state.favoredEnemyTypes || [];
      if (!types.length || !enemy) return 0;
      return types.includes(this.getEnemyCreatureType(enemy)) ? 2 : 0;
    },

    addFavoredEnemyDamageToHit(enemy, baseDamage) {
      const bonus = this.getFavoredEnemyDamageBonus(enemy);
      return { total: baseDamage + bonus, bonus };
    },

    favoredEnemyDamageNote(bonus) {
      if (!bonus) return '';
      return ` (+${bonus} избр. враг)`;
    },

    migrateFavoredEnemyState() {
      if (this.state.className !== 'ranger') return;
      if (!this.getMaxFavoredEnemyTypes()) return;
      const cur = (this.state.favoredEnemyTypes || []).length;
      const max = this.getMaxFavoredEnemyTypes();
      if (cur >= max) return;
      if (this.state.pendingLevelUp || this.state.pendingFavoredEnemyPick) return;
      this.state.pendingFavoredEnemyPick = true;
      setTimeout(() => {
        if (!this.state.pendingFavoredEnemyPick) return;
        this.showFavoredEnemyPickModal({
          pickCount: max - cur,
          title: 'Избранные враги',
          intro: 'Выберите тип существ для умения «Избранный враг».',
          onDone: () => {
            this.state.pendingFavoredEnemyPick = false;
            this.saveGame();
          }
        });
      }, 400);
    },

    showFavoredEnemyPickModal(opts = {}) {
      const pickCount = Math.max(1, parseInt(opts.pickCount, 10) || 1);
      const catalog = this.getCreatureTypeCatalog();
      const modal = document.getElementById('levelup-modal') || document.getElementById('modal');
      const titleEl = document.getElementById('levelup-title') || document.getElementById('modal-title');
      const textEl = document.getElementById('levelup-text') || document.getElementById('modal-body');
      const choicesEl = document.getElementById('levelup-choices');
      const useLevelUpShell = !!(document.getElementById('levelup-modal') && choicesEl);

      if (!modal || (!choicesEl && !textEl)) {
        if (typeof opts.onDone === 'function') opts.onDone();
        return;
      }

      const existing = Array.isArray(this.state.favoredEnemyTypes)
        ? [...this.state.favoredEnemyTypes]
        : [];
      const selection = [];
      const maxTotal = this.getMaxFavoredEnemyTypes() || (existing.length + pickCount);

      const renderBody = () => {
        const need = pickCount;
        const pickedLabels = selection.map((id) => this.getCreatureTypeLabel(id)).join(', ') || '—';
        const chips = catalog.map((t) => {
          const on = selection.includes(t.id);
          const disabled = !on && selection.length >= need;
          return `<button type="button" class="choice favored-type-chip${on ? ' active' : ''}" data-type="${this.escapeAttr(t.id)}" ${disabled ? 'disabled' : ''}>${this.escapeHtml(t.label)}</button>`;
        }).join('');
        const html = `
          <p>${this.escapeHtml(opts.intro || `Выберите ${need === 1 ? 'тип' : need + ' типа'} существ (осталось: ${need - selection.length}).`)}</p>
          <p><strong>Выбрано сейчас:</strong> ${this.escapeHtml(pickedLabels)}</p>
          <div class="favored-type-grid" style="display:flex;flex-wrap:wrap;gap:8px;margin:12px 0;">${chips}</div>
          <button type="button" class="choice" id="favored-type-confirm" ${selection.length < need ? 'disabled style="opacity:0.5;"' : ''}>Подтвердить</button>`;
        if (useLevelUpShell) {
          if (textEl) textEl.textContent = '';
          choicesEl.innerHTML = html;
          choicesEl.querySelectorAll('.favored-type-chip').forEach((btn) => {
            btn.onclick = () => {
              const tid = btn.getAttribute('data-type');
              const idx = selection.indexOf(tid);
              if (idx >= 0) selection.splice(idx, 1);
              else if (selection.length < need) selection.push(tid);
              renderBody();
            };
          });
          const confirm = choicesEl.querySelector('#favored-type-confirm');
          if (confirm) {
            confirm.onclick = () => {
              if (selection.length < need) return;
              const merged = [...existing];
              selection.forEach((t) => {
                if (!merged.includes(t) && merged.length < maxTotal) merged.push(t);
              });
              this.state.favoredEnemyTypes = merged.slice(0, maxTotal);
              this.log(`🐺 Избранные враги: ${this.formatFavoredEnemyTypesList()}`, 'log-heal');
              this.renderAbilities();
              modal.classList.add('hidden');
              if (typeof opts.onDone === 'function') opts.onDone();
            };
          }
        } else if (textEl) {
          textEl.innerHTML = html;
          textEl.querySelectorAll('.favored-type-chip').forEach((btn) => {
            btn.onclick = () => {
              const tid = btn.getAttribute('data-type');
              const idx = selection.indexOf(tid);
              if (idx >= 0) selection.splice(idx, 1);
              else if (selection.length < need) selection.push(tid);
              renderBody();
            };
          });
          const confirm = textEl.querySelector('#favored-type-confirm');
          if (confirm) {
            confirm.onclick = () => {
              if (selection.length < need) return;
              const merged = [...existing];
              selection.forEach((t) => {
                if (!merged.includes(t) && merged.length < maxTotal) merged.push(t);
              });
              this.state.favoredEnemyTypes = merged.slice(0, maxTotal);
              this.log(`🐺 Избранные враги: ${this.formatFavoredEnemyTypesList()}`, 'log-heal');
              this.renderAbilities();
              this.closeModal();
              if (typeof opts.onDone === 'function') opts.onDone();
            };
          }
        }
      };

      if (titleEl) titleEl.textContent = opts.title || 'Избранные враги';
      modal.classList.remove('hidden');
      renderBody();
    },

    buildCombatAttackButtonsForEnemy(enemyIndex) {
      const enemy = this.state.enemies[enemyIndex];
      if (!enemy || enemy.hp <= 0) return '';
      const eac = this.getEffectiveEnemyAC(enemy);
      const name = this.escapeHtml(this.getEnemyDisplayName(enemy));
      const dual = this.hasDualWieldSetup();
      const zoneTip =
        typeof CombatPosition !== 'undefined'
          ? ` [${CombatPosition.getZoneLabel(CombatPosition.getEnemyPosition(this, enemyIndex))}]`
          : '';
      let html = '';

      const appendWeaponAttack = (slot, labelPrefix, icon, useBonusAction) => {
        const profile = slot.startsWith('inv:')
          ? this.getWeaponAttackProfileFromItem(slot.slice(4))
          : this.getWeaponAttackProfile(slot);
        if (!profile) return;
        const rangeType =
          typeof CombatPosition !== 'undefined'
            ? CombatPosition.getWeaponRangeType(this, profile)
            : 'melee';
        const zoneCheck =
          typeof CombatPosition !== 'undefined'
            ? CombatPosition.validateAttack(this, {
                enemyIndex,
                rangeType
              })
            : { valid: true };
        const wLabel = this.escapeHtml(profile.weaponName || 'Оружие');
        if (this.attackRequiresArrows(profile) && this.getArrowCount() <= 0) {
          html += `<button type="button" class="choice" disabled style="opacity:0.55;cursor:not-allowed;" title="Нет стрел">🏹 ${wLabel} → ${name}${zoneTip} (нет стрел)</button>`;
          return;
        }
        if (!zoneCheck.valid) {
          html += `<button type="button" class="choice" disabled style="opacity:0.55;cursor:not-allowed;" title="${this.escapeAttr(zoneCheck.reason)}">${icon ? `${icon} ` : ''}${labelPrefix}${wLabel} → ${name}${zoneTip}</button>`;
          return;
        }
        const modNote =
          zoneCheck.modifiers?.notes?.length
            ? ` · ${zoneCheck.modifiers.notes.join('; ')}`
            : '';
        const onclick = `GameEngine.playerAttack(${enemyIndex},'${this.escapeAttr(slot)}')`;
        const iconPart = icon ? `${icon} ` : '';
        html += `<button type="button" class="choice" onclick="${onclick}" title="${this.escapeAttr(modNote || '')}">${iconPart}${labelPrefix}${wLabel} → ${name}${zoneTip} (КД ${eac})</button>`;
      };

      const mainProfile = this.getWeaponAttackProfile('weapon_main');
      const mainRangeType =
        typeof CombatPosition !== 'undefined' && mainProfile
          ? CombatPosition.getWeaponRangeType(this, mainProfile)
          : 'melee';
      const mainIsRanged =
        mainRangeType === 'ranged' || mainRangeType === 'spell';

      if (mainIsRanged) {
        appendWeaponAttack('weapon_main', '', '🏹', false);
      } else if (!dual) {
        appendWeaponAttack('weapon_main', 'Атаковать ', '⚔️', false);
      } else {
        appendWeaponAttack('weapon_main', 'Основная ', '⚔️', false);
        const offProfile = this.getWeaponAttackProfile('weapon_off');
        if (offProfile) {
          const bonusSpent = !!this.state.combat?.bonusActionSpent;
          const offRangeType =
            typeof CombatPosition !== 'undefined'
              ? CombatPosition.getWeaponRangeType(this, offProfile)
              : 'melee';
          const offCheck =
            typeof CombatPosition !== 'undefined'
              ? CombatPosition.validateAttack(this, {
                  enemyIndex,
                  rangeType: offRangeType
                })
              : { valid: true };
          const offLabel = this.escapeHtml(offProfile.weaponName || 'вторая рука');
          if (!offCheck.valid || bonusSpent) {
            const title = !offCheck.valid
              ? offCheck.reason
              : 'Бонусное действие потрачено';
            html += `<button type="button" class="choice" disabled style="opacity:0.55;" title="${this.escapeAttr(title)}">🗡 ${offLabel} → ${name}</button>`;
          } else {
            html += `<button type="button" class="choice" onclick="GameEngine.playerAttack(${enemyIndex},'weapon_off')">🗡 ${offLabel} → ${name}</button>`;
          }
        }
      }

      const rangedIds = new Set();
      ['weapon_main', 'weapon_off'].forEach((slot) => {
        const id = this.getEquippedItemId(slot);
        const w = id ? this.itemsData[id] || this.data?.items?.[id] : null;
        if (id && w && typeof CombatPosition !== 'undefined' && CombatPosition.isWeaponRanged(w)) {
          rangedIds.add(id);
        }
      });
      (this.state.inventory || []).forEach((itemId) => {
        const w = this.itemsData[itemId] || this.data?.items?.[itemId];
        if (!w || !this.isWeaponItem(w)) return;
        if (typeof CombatPosition !== 'undefined' && !CombatPosition.isWeaponRanged(w)) return;
        if (rangedIds.has(itemId)) return;
        rangedIds.add(itemId);
        appendWeaponAttack(`inv:${itemId}`, '', '🏹', false);
      });

      if (!html) {
        html = `<button type="button" class="choice" disabled style="opacity:0.55;">⚔️ Нет доступной атаки</button>`;
      }
      return html;
    },

    /** true, если в основной руке нет оружия (кулаки) */
    isUnarmedMainHand(stats) {
      const s = stats || this.state.classData;
      if (!s) return false;
      if (s.weaponId) return false;
      return s.weaponName === 'Кулаки' || s.weaponName == null;
    },

    formatEquippedDamageLabel(stats) {
      const s = stats || this.state.classData;
      if (!s) return '—';
      const formula = this.formatDamageLabel(s.dmgRoll, s.dmgBonus);
      if (this.isUnarmedMainHand(s)) return `${formula} · кулаки`;
      return formula;
    },

    rollPlayerWeaponDamage(critical, weaponSlot = 'weapon_main') {
      const profile =
        typeof weaponSlot === 'string' && weaponSlot.startsWith('inv:')
          ? this.getWeaponAttackProfileFromItem(weaponSlot.slice(4))
          : this.getWeaponAttackProfile(weaponSlot);
      if (profile) return this.rollWeaponDamage(profile, critical);
      const cd = this.state.classData || {};
      const roll = cd.dmgRoll || '1';
      let dice = this.parseRoll(roll);
      if (critical) dice += this.parseRoll(roll);
      return dice + (cd.dmgBonus ?? 0);
    },

    buildClassCombatStats(cls) {
      return {
        ac: cls.ac ?? 10,
        atkBonus: cls.atkBonus ?? 0,
        dmgRoll: cls.dmgRoll || '1d6',
        dmgBonus: cls.dmgBonus ?? 0,
        initBonus: cls.initBonus ?? 0
      };
    },

    INVENTORY_SECTIONS: [
      { key: 'equipment', label: 'Снаряжение' },
      { key: 'consumable', label: 'Расходники' },
      { key: 'key', label: 'Ключи' },
      { key: 'quest', label: 'Квестовые' }
    ],

    resolveItemId(itemKey) {
      if (!itemKey) return null;
      if (this.data?.items?.[itemKey]) return itemKey;
      for (const [id, item] of Object.entries(this.data?.items || {})) {
        if (item.name === itemKey) return id;
      }
      return itemKey;
    },

    /**
     * Пересчёт производных статов: характеристики, maxHp, КД, атака, урон.
     * Проходит по всем слотам (оружие, броня, щит, кольца, ожерелье, серьги).
     */
    recalcDerivedStats() {
      const cls = this.data?.classes?.[this.state.className];
      if (!cls || !this.state.classData) return null;
      // В облике зверя ОЗ/КД/атака задаются отдельно (wild-shape.js)
      if (typeof this.isInWildShape === 'function' && this.isInWildShape()) {
        const beast = typeof this.getActiveBeast === 'function' ? this.getActiveBeast() : null;
        if (beast) this.updateWildShapeStatDisplay?.(beast);
        return null;
      }

      this.migrateEquippedSlots();
      this.ensureBaseMaxHp();

      const baseStats = this.getBaseStats();
      const equipBonuses = this.collectEquipmentBonuses();

      const effective = {};
      for (const key of this.STAT_KEYS) {
        const base = baseStats[key] ?? 10;
        effective[key] = Math.min(20, base + (equipBonuses[key] || 0));
      }
      this.state._effectiveStats = effective;
      this.state.classData.stats = effective;

      const oldMax = this.state._lastComputedMaxHp ?? this.state.maxHp;
      const newMax = Math.max(1, (this.state.baseMaxHp || this.state.maxHp) + equipBonuses.maxHpBonus);
      if (newMax > oldMax && this.state.hp >= oldMax) {
        this.state.hp += (newMax - oldMax);
      }
      this.state.maxHp = newMax;
      this.state._lastComputedMaxHp = newMax;
      if (this.state.hp > this.state.maxHp) this.state.hp = this.state.maxHp;

      const weaponProfile = this.computeWeaponDamageProfile();
      const prof = this.getProficiencyBonus();
      const atkStatMod = this.getModifier(
        this.getPlayerStats()[weaponProfile.statKey] ?? 10
      );
      const passiveBonuses = this.collectPassiveAbilityBonuses();
      const levelBonuses = this.collectProgressionLevelBonuses();

      const stats = {
        ac: this.computePlayerAC() + equipBonuses.acBonus + passiveBonuses.acBonus + levelBonuses.acBonus,
        atkBonus: prof + atkStatMod + equipBonuses.atkBonus + passiveBonuses.atkBonus + levelBonuses.atkBonus,
        dmgRoll: weaponProfile.dmgRoll,
        dmgBonus: weaponProfile.dmgBonus + equipBonuses.dmgBonus,
        weaponId: weaponProfile.weaponId ?? null,
        weaponName: weaponProfile.weaponName,
        initBonus: cls.initBonus ?? 0
      };

      Object.assign(this.state.classData, stats);
      this.refreshCombatStatDisplay(stats);
      return stats;
    },

    /** Алиас: боевые статы после recalcDerivedStats */
    recalculateCombatStats() {
      return this.recalcDerivedStats();
    },

    refreshCombatStatDisplay(stats) {
      const s = stats || this.state.classData;
      if (!s) return;
      const acEl = document.getElementById('ac-val');
      const atkEl = document.getElementById('atk-val');
      const dmgEl = document.getElementById('dmg-val');
      const initEl = document.getElementById('init-val');
      if (acEl) acEl.textContent = String(s.ac);
      if (atkEl) atkEl.textContent = '+' + s.atkBonus;
      if (dmgEl) dmgEl.textContent = this.formatEquippedDamageLabel(s);
      if (initEl) initEl.textContent = '+' + s.initBonus;
    },

    autoEquipStartingGear(classKey) {
      const cls = this.data?.classes?.[classKey];
      const items = this.itemsData;
      if (!cls) return;
      this.state.equipped = {};
      (cls.startingItems || []).forEach(itemId => {
        const item = items[itemId];
        if (!item) return;
        if (this.isAccessoryItem(item)) {
          const slot = this.resolveAccessoryEquipSlot(item);
          if (!this.state.equipped[slot]) this.state.equipped[slot] = itemId;
          return;
        }
        const slot = this.getEquipSlot(item);
        if (!slot) return;
        if (this.isArmorItem(item) && !this.canWearArmor(item)) return;
        this.state.equipped[slot] = itemId;
      });
      this.recalculateCombatStats();
    },

    resolveSoundId(...candidates) {
      for (const c of candidates) {
        if (c && typeof c === 'string' && c.trim()) return c.trim();
      }
      return null;
    },

    resolveDamageTypeSound(damageType) {
      const map = this.data?.audio?.defaults?.damageType || {};
      const dt = String(damageType || 'physical').toLowerCase();
      const fallbacks = {
        magical: 'radiant',
        force: 'radiant',
        arcane: 'radiant',
        electric: 'lightning',
        lightning: 'lightning',
        thunder: 'lightning',
        darkness: 'necrotic',
        necrotic: 'necrotic',
        dark: 'necrotic',
        shadow: 'necrotic',
        curse: 'necrotic',
        heal: 'heal',
        help: 'buff',
        enhancement: 'buff'
      };
      return map[dt] || map[fallbacks[dt]] || map.physical || null;
    },

    resolveEffectTypeSound(effectType) {
      const map = this.data?.audio?.defaults?.effectType || {};
      return map[effectType] || null;
    },

    playCombatSound(soundId, volume) {
      if (!soundId) return;
      AudioEngine.playSFX(soundId, { volume });
    },

    resolveEnemySound(enemy, field, ...fallbacks) {
      const tpl = enemy?.id ? this.data?.enemies?.[enemy.id] : null;
      return this.resolveSoundId(tpl?.[field], ...fallbacks);
    },

    playEnemyAttackSound(enemy, outcome) {
      const fallback = outcome === 'miss' ? 'attack_miss' : 'slash_physical';
      const soundId = this.resolveEnemySound(enemy, 'soundAttack', fallback);
      if (soundId) this.playCombatSound(soundId);
    },

    playEnemyDamagedSound(enemy, opts = {}) {
      const custom = this.resolveEnemySound(enemy, 'soundHit');
      if (custom) {
        this.playCombatSound(custom, opts.volume);
        return true;
      }
      return false;
    },

    /** Лёгкий звук при восстановлении ячеек заклинаний на отдыхе */
    playRestSpellSlotSound() {
      if (typeof AudioEngine === 'undefined') return;
      AudioEngine.unlock?.();
      const id = this.resolveSoundId('heal', this.resolveEffectTypeSound('heal'));
      if (id) AudioEngine.play(id, { volume: 0.55 });
    },

    playAbilityCast(ability) {
      const effect = ability?.effect;
      const firstFx = Array.isArray(ability?.effects) ? ability.effects[0] : null;
      const dt = (effect && typeof effect === 'object' && effect.damageType)
        || (firstFx && firstFx.damageType)
        || null;
      const hitFromType = dt ? this.resolveDamageTypeSound(dt) : null;
      const castFromType = hitFromType
        ? (hitFromType.endsWith('_hit') ? hitFromType.replace(/_hit$/, '_cast') : `${hitFromType}_cast`)
        : null;
      const soundId = this.resolveSoundId(
        ability?.soundCast,
        ability?.sounds?.cast,
        castFromType,
        effect && typeof effect === 'object' && this.resolveEffectTypeSound(effect.type)
      );
      if (soundId) this.playCombatSound(soundId);
    },

    toggleAudio() {
      AudioEngine.setEnabled(!AudioEngine.enabled);
      this.updateAudioToggleButton();
      this.syncAudioVolumeUI();
      if (AudioEngine.enabled) {
        AudioEngine.unlock();
        this.playCombatSound('buff');
        const scene = this.state.scene && this.getProcessedScene(this.state.scene);
        if (scene?.audio) this.playSceneAudio(scene.audio);
      }
    },

    updateAudioToggleButton() {
      const btn = document.getElementById('audio-toggle-btn');
      if (!btn) return;
      btn.textContent = AudioEngine.enabled ? '🔊 Звук вкл' : '🔇 Звук выкл';
      btn.setAttribute('aria-pressed', AudioEngine.enabled ? 'true' : 'false');
    },

    initAudioVolumeUI() {
      if (typeof AudioEngine === 'undefined') return;
      this.syncAudioVolumeUI();
      const music = document.getElementById('music-volume');
      const sfx = document.getElementById('sfx-volume');
      if (music && !music._bound) {
        music._bound = true;
        music.addEventListener('input', () => this.onMusicVolumeChange(music.value));
      }
      if (sfx && !sfx._bound) {
        sfx._bound = true;
        sfx.addEventListener('input', () => this.onSfxVolumeChange(sfx.value));
      }
    },

    syncAudioVolumeUI() {
      if (typeof AudioEngine === 'undefined') return;
      const music = document.getElementById('music-volume');
      const sfx = document.getElementById('sfx-volume');
      const musicVal = document.getElementById('music-volume-val');
      const sfxVal = document.getElementById('sfx-volume-val');
      const pctM = Math.round(AudioEngine.musicVolume * 100);
      const pctS = Math.round(AudioEngine.sfxVolume * 100);
      if (music) music.value = String(pctM);
      if (sfx) sfx.value = String(pctS);
      if (musicVal) musicVal.textContent = pctM + '%';
      if (sfxVal) sfxVal.textContent = pctS + '%';
    },

    onMusicVolumeChange(percent) {
      const v = Math.max(0, Math.min(100, parseInt(percent, 10) || 0)) / 100;
      AudioEngine.setMusicVolume(v);
      this.syncAudioVolumeUI();
    },

    onSfxVolumeChange(percent) {
      const v = Math.max(0, Math.min(100, parseInt(percent, 10) || 0)) / 100;
      AudioEngine.setSfxVolume(v);
      this.syncAudioVolumeUI();
    },

    // ========== ИНИЦИАЛИЗАЦИЯ ==========
    cacheGameData() {
      try {
        const key = this.getDataCacheKey();
        localStorage.setItem(key, JSON.stringify(this.data));
      } catch (e) {
        console.warn('Не удалось сохранить кэш данных:', e);
      }
    },

    showDataSourceNotice() {
      if (this.dataSource === 'file' || this.dataSource === 'demo') return;
      const msg = this.dataSource === 'cache'
        ? 'Локальный режим: данные из редактора (кэш браузера). Для data/game_data.json откройте игру через хост или нажмите «Загрузить контент JSON».'
        : 'Локальный режим: загружен game_data.json. Сохраните JSON в редакторе (💾) для обновления кэша.';
      this.log('ℹ️ ' + msg, 'log-dice');
    },

    normalizeAllClassAbilities(data) {
      if (!data?.classes) return;
      // v4: классы хранят id; полные объекты — в progression.abilities
      if (typeof ProjectDataSchema !== 'undefined' && typeof ProjectDataSchema.migrateClassAbilitiesToPool === 'function') {
        ProjectDataSchema.migrateClassAbilitiesToPool(data);
      }
    },

    loadCachedGameData(cacheKey) {
      const key = cacheKey || this.getDataCacheKey();
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object' || !data.scenes || !data.classes) {
          throw new Error('Неполные данные в кэше');
        }
        return data;
      } catch (e) {
        console.warn('Кэш данных повреждён, сбрасываем:', e.message);
        localStorage.removeItem(key);
        return null;
      }
    },

    applyGameData(data, source) {
      if (typeof SpellSlotProgression !== 'undefined') SpellSlotProgression.applyToGameData(data);
      if (typeof Pf2eMillProgression !== 'undefined') Pf2eMillProgression.applyToGameData(data);
      this.normalizeAllClassAbilities(data);
      if (typeof CombatManager !== 'undefined') {
        CombatManager.normalizeProgressionAbilities(data, this);
      }
      if (typeof QuestMigrate !== 'undefined' && data.questsVersion !== 2) { QuestMigrate.migrateAll(data); data.questsVersion = 2; }
      if (typeof QuestRuntime !== 'undefined') QuestRuntime.bind(this);
      ThemeSystem.ensureInData(data);
      if (!data.races) data.races = {};
      if (!data.meta) data.meta = {};
      if (!data.meta.system) {
        if (data.system === 'pf2e' || (data.ancestries && Object.keys(data.ancestries).length)) {
          data.meta.system = 'pf2e';
        } else {
          const hasSpellcasting = Object.values(data.classes || {}).some(
            (c) => c && (c.spellcasting || c.halfCaster)
          );
          data.meta.system = hasSpellcasting ? 'dnd5e' : 'generic';
        }
      }
      this.data = data;
      if (typeof ReputationSystem !== 'undefined') ReputationSystem.ensureFactions(this.data);
      if (typeof BeastSystem !== 'undefined') BeastSystem.ensureBeasts(this.data);
      if (typeof SceneTemplateEngine !== 'undefined') SceneTemplateEngine.ensureTemplateData(this.data);
      if (typeof WorldHierarchy !== 'undefined') WorldHierarchy.ensureWorldHierarchy(this.data);
      if (typeof ActionChainLibrary !== 'undefined') ActionChainLibrary.ensureActionChains(this.data);
      this.initActiveSystem();
      this.dataSource = source;
      ThemeSystem.applyForApp(data.theme);
      AudioEngine.init(data.audio);
      this.initAudioVolumeUI();
      this.initTooltips();
      if (source === 'file' || source === 'file-picker' || source === 'inline' || source === 'demo') this.cacheGameData();
      this.showDataSourceNotice();
      if (typeof SpecialSceneRegistry !== 'undefined' && SpecialSceneRegistry._registerBuiltins) {
        SpecialSceneRegistry._registerBuiltins(this);
      }
      this.handleStartupRoute();
      this.renderActiveQuests();
    },

    /** Нет сохранения или в нём нет готового персонажа */
    needsCharacterCreation() {
      const raw = localStorage.getItem(this.getSaveKey());
      if (!raw) return true;
      try {
        const save = JSON.parse(raw);
        if (!save.charName?.trim() || !save.className) return true;
      } catch (_) {
        return true;
      }
      return !this.state.charName?.trim();
    },

    handleStartupRoute() {
      this.hideCampaignPicker();
      if (this.needsCharacterCreation()) {
        if (this.CharacterCreator?.open) {
          this.CharacterCreator.open();
        } else {
          this.showCharacterCreator();
        }
        return;
      }
      this.continueNormalStartup();
    },

    continueNormalStartup() {
      document.getElementById('char-creator-screen')?.classList.add('hidden');
      document.getElementById('main')?.classList.remove('hidden');
      const saved = localStorage.getItem(this.getSaveKey());
      if (saved) {
        try {
          const data = JSON.parse(saved);
          if (data.charName?.trim() && data.className) {
            this.loadGame();
            return;
          }
        } catch (_) { /* ignore */ }
      }
      document.getElementById('class-screen')?.classList.remove('hidden');
      this.renderClassSelection();
    },

    loadGameDataFromFile() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          if (!data.scenes) throw new Error('В файле нет объекта scenes');
          this.activeCampaignId = 'melnitsa';
          localStorage.setItem(ACTIVE_CAMPAIGN_KEY, 'melnitsa');
          localStorage.setItem(this.getDataCacheKey(), text);
          if (typeof CampaignCovers !== 'undefined') {
            CampaignCovers.clearAllCoverCaches();
          }
          this.hideCampaignPicker();
          this.applyGameData(data, 'file-picker');
          this.log('✅ Контент загружен: ' + (data.meta?.title || file.name), 'log-heal');
        } catch (err) {
          alert('❌ Ошибка чтения JSON: ' + err.message);
        }
      };
      input.click();
    },

    showLoadDataError(msg) {
      const screen = document.getElementById('class-screen');
      if (!screen) return;
      screen.innerHTML = `
        <h1>Ошибка загрузки</h1>
        <p>${msg || 'Не удалось загрузить данные игры. Убедитесь, что рядом с index.html есть файл <b>data.js</b>.'}</p>
        <p>Откройте игру так: проводник → папка RPGengine → правый клик по <b>index.html</b> → «Открыть с помощью» → Microsoft Edge.</p>
        <button type="button" class="start-btn" onclick="GameEngine.loadGameDataFromFile()">📂 Загрузить game_data.json</button>
      `;
    },

    getActiveCampaign() {
      const id = this.activeCampaignId || localStorage.getItem(ACTIVE_CAMPAIGN_KEY) || 'melnitsa';
      return CAMPAIGNS[id] || CAMPAIGNS.melnitsa;
    },

    getSaveKey() {
      return this.getActiveCampaign().saveKey;
    },

    getDataCacheKey() {
      return this.getActiveCampaign().cacheKey;
    },

    hasCampaignSave(campaign) {
      try {
        const raw = localStorage.getItem(campaign.saveKey);
        if (!raw) return false;
        const save = JSON.parse(raw);
        return !!(save.charName?.trim() && save.className);
      } catch (_) {
        return false;
      }
    },

    loadScriptOnce(src, globalName) {
      return new Promise((resolve, reject) => {
        if (window[globalName]?.scenes) {
          resolve();
          return;
        }
        const existing = document.querySelector(`script[data-demo-src="${src}"]`);
        if (existing) {
          existing.addEventListener('load', () => resolve());
          existing.addEventListener('error', () => reject(new Error('Не удалось загрузить: ' + src)));
          return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.dataset.demoSrc = src;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Не удалось загрузить: ' + src));
        document.head.appendChild(script);
      });
    },

    /** Кэш / inline совпадает с ожидаемой кампанией (не подхватывать старое демо). */
    isCampaignDataValid(campaign, data) {
      if (!data || typeof data !== 'object' || !data.scenes || !data.classes) return false;
      if (campaign.expectedCampaignId) {
        return data.meta?.campaignId === campaign.expectedCampaignId;
      }
      if (campaign.dataVersion) {
        return data.meta?.dataVersion === campaign.dataVersion;
      }
      return true;
    },

    dropCampaignCache(campaign) {
      if (!campaign?.cacheKey) return;
      try {
        localStorage.removeItem(campaign.cacheKey);
      } catch (_) { /* ignore */ }
      if (campaign.cacheKey === 'rpg_data_cache_pf2e') {
        try { localStorage.removeItem('rpg_data_cache_pf2e'); } catch (_) { /* legacy */ }
      }
    },

    async fetchCampaignData(campaign) {
      const globalName = campaign.inlineGlobal;

      if (globalName && window[globalName]?.scenes) {
        const inline = window[globalName];
        if (this.isCampaignDataValid(campaign, inline)) return inline;
      }

      if (location.protocol !== 'file:' && campaign.dataUrl) {
        try {
          const url = campaign.dataUrl + (campaign.dataUrl.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(campaign.dataVersion || campaign.expectedCampaignId || '1');
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            if (this.isCampaignDataValid(campaign, data)) return data;
          }
        } catch (err) {
          console.warn('fetchCampaignData:', err.message);
        }
      }

      const cached = this.loadCachedGameData(campaign.cacheKey);
      if (cached) {
        if (this.isCampaignDataValid(campaign, cached)) return cached;
        this.dropCampaignCache(campaign);
      }

      if (campaign.demoScript && globalName) {
        await this.loadScriptOnce(campaign.demoScript, globalName);
        const fromScript = window[globalName];
        if (fromScript?.scenes && this.isCampaignDataValid(campaign, fromScript)) {
          return fromScript;
        }
      }

      if (campaign.id === 'melnitsa' && window.GAME_DATA_INLINE?.scenes) {
        return window.GAME_DATA_INLINE;
      }

      throw new Error('Не удалось загрузить данные для «' + campaign.title + '»');
    },

    renderCampaignCardShell(campaign, hasSave) {
      const CC = typeof CampaignCovers !== 'undefined' ? CampaignCovers : null;
      const gradient = CC
        ? CC.gradientFromTitle(campaign.title || campaign.id)
        : 'linear-gradient(135deg, #3d5a80, #1a1a2e)';
      const tr = (k, p) => (typeof t === 'function' ? t(k, p) : k);
      const badge = typeof I18n !== 'undefined'
        ? I18n.campaignField(campaign.id, 'badge', campaign.badge)
        : campaign.badge;
      const subtitle = typeof I18n !== 'undefined'
        ? I18n.campaignField(campaign.id, 'subtitle', campaign.subtitle)
        : campaign.subtitle;
      const description = typeof I18n !== 'undefined'
        ? I18n.campaignField(campaign.id, 'description', campaign.description)
        : campaign.description;
      const saveHint = hasSave
        ? `<span class="campaign-card-save">💾 ${tr('game.hasSave')}</span>`
        : '';
      return `
        <button type="button" class="campaign-card" data-campaign-id="${this.escapeAttr(campaign.id)}"
          onclick="GameEngine.launchCampaign('${this.escapeAttr(campaign.id)}')">
          <div class="campaign-card-cover" data-campaign-id="${this.escapeAttr(campaign.id)}"
            data-cover-title="${this.escapeAttr(campaign.title || campaign.id)}">
            <div class="campaign-card-cover-fallback" style="background:${gradient}">
              <span class="campaign-card-cover-icon" aria-hidden="true">🎮</span>
            </div>
            <img class="campaign-card-cover-img" alt="" hidden decoding="async" loading="lazy">
          </div>
          <div class="campaign-card-body">
            <span class="campaign-card-badge">${this.escapeHtml(badge)}</span>
            <span class="campaign-card-title">${this.escapeHtml(campaign.title)}</span>
            <span class="campaign-card-sub">${this.escapeHtml(subtitle)}</span>
            <span class="campaign-card-desc">${this.escapeHtml(description)}</span>
            ${saveHint}
            <span class="campaign-card-cta">${hasSave ? tr('game.continueOrNew') : tr('game.play')}</span>
          </div>
        </button>`;
    },

    async hydrateCampaignCardCovers() {
      if (typeof CampaignCovers === 'undefined') return;
      const campaigns = Object.values(CAMPAIGNS);
      await Promise.all(campaigns.map(async (campaign) => {
        try {
          const payload = await CampaignCovers.getCoverForCampaign(
            campaign,
            (c) => this.fetchCampaignData(c)
          );
          const coverEl = document.querySelector(
            `.campaign-card-cover[data-campaign-id="${campaign.id}"]`
          );
          CampaignCovers.applyToCardElement(coverEl, payload);
        } catch (err) {
          console.warn('[cover]', campaign.id, err);
        }
      }));
    },

    showCampaignPicker() {
      const screen = document.getElementById('campaign-picker-screen');
      const grid = document.getElementById('campaign-grid');
      if (!screen || !grid) return;

      document.body.classList.add('campaign-selecting');
      screen.classList.remove('hidden');
      document.getElementById('sidebar')?.classList.add('hidden');
      if (typeof SidebarDock !== 'undefined') SidebarDock.setVisible(false);
      document.getElementById('main')?.classList.add('hidden');
      document.getElementById('char-creator-screen')?.classList.add('hidden');

      const campaigns = Object.values(CAMPAIGNS);
      grid.innerHTML = campaigns.map((c) => {
        const hasSave = this.hasCampaignSave(c);
        return this.renderCampaignCardShell(c, hasSave);
      }).join('');

      this.hydrateCampaignCardCovers();

      document.title = 'RPGengine — выбор приключения';
    },

    hideCampaignPicker() {
      document.body.classList.remove('campaign-selecting');
      document.getElementById('campaign-picker-screen')?.classList.add('hidden');
      this.ensurePlayerUIVisible({ force: true });
    },

    /** Сцена прячет боковую панель / док (создание персонажа и т.п.) */
    sceneHidesPlayerUI(sceneId) {
      const raw = this.data?.scenes?.[sceneId];
      if (!raw) return false;
      let scene = raw;
      if (raw.sceneTemplate && !raw.templateDetached && typeof SceneTemplateEngine !== 'undefined') {
        try {
          scene = SceneTemplateEngine.materializeScene(this.data, raw);
        } catch (_) { /* use raw */ }
      }
      if (scene.special === 'character_creation') return true;
      if (scene.visibility?.sidebar === false || scene.visibility?.dock === false) return true;
      return false;
    },

    /**
     * Вернуть правую панель персонажа, док (🎒⚡) и основной layout.
     * Вызывать после выхода из сцен с hide_sidebar / hide_dock.
     */
    ensurePlayerUIVisible(opts = {}) {
      if (document.body.classList.contains('campaign-selecting') && !opts.force) return;
      const inCreator = document.body.classList.contains('cc-fullscreen-active')
        || !document.getElementById('char-creator-screen')?.classList.contains('hidden');
      const hasHero = !!(this.state?.charName?.trim() || this.state?.className);
      if (!opts.force && inCreator && !hasHero) return;

      document.getElementById('game-content')?.classList.remove('hidden');
      document.getElementById('main')?.classList.remove('hidden');
      document.body.classList.remove('scene-hide-log', 'cc-fullscreen-active');

      if (hasHero || opts.force) {
        document.getElementById('sidebar')?.classList.remove('hidden');
        if (typeof SidebarDock !== 'undefined') SidebarDock.setVisible(true);
      }
    },

    /** Загрузка демо по алиасу (mill → pf2e, scifi → scifi). */
    loadDemo(demoId) {
      const map = { mill: 'pf2e', pf2e_mill: 'pf2e', pf2e: 'pf2e', detective: 'pf2e', scifi: 'scifi' };
      const campaignId = map[demoId] || demoId;
      return this.launchCampaign(campaignId);
    },

    async launchCampaign(campaignId) {
      const campaign = CAMPAIGNS[campaignId];
      if (!campaign) return;

      const screen = document.getElementById('campaign-picker-screen');
      const grid = document.getElementById('campaign-grid');
      if (grid) {
        grid.innerHTML = '<p class="campaign-loading">Загрузка «' + this.escapeHtml(campaign.title) + '»…</p>';
      }

      try {
        if (campaign.expectedCampaignId) {
          try { localStorage.removeItem('rpg_data_cache_pf2e'); } catch (_) { /* legacy detective cache */ }
        }
        const data = await this.fetchCampaignData(campaign);
        this.activeCampaignId = campaign.id;
        localStorage.setItem(ACTIVE_CAMPAIGN_KEY, campaign.id);
        this.hideCampaignPicker();
        const source = campaign.id === 'melnitsa' ? 'file' : 'demo';
        this.applyGameData(data, source);
        if (campaign.pageTitle) document.title = campaign.pageTitle;
        else if (data.meta?.title) document.title = data.meta.title;
        this.renderActiveQuests();
      } catch (err) {
        console.error(err);
        if (screen && grid) {
          grid.innerHTML = `
            <p class="campaign-error">❌ ${this.escapeHtml(err.message || String(err))}</p>
            <button type="button" class="start-btn" onclick="GameEngine.showCampaignPicker()">← Назад</button>`;
        }
      }
    },

    returnToCampaignPicker() {
      if (this.state.charName?.trim() && !confirm('Вернуться к выбору игры? Несохранённый прогресс может быть потерян.')) {
        return;
      }
      document.getElementById('char-creator-screen')?.classList.add('hidden');
      document.getElementById('game-content')?.classList.add('hidden');
      document.getElementById('class-screen')?.classList.add('hidden');
      document.getElementById('name-screen')?.classList.add('hidden');
      document.getElementById('main')?.classList.add('hidden');
      this.showCampaignPicker();
    },

    async init() {
      this.showCampaignPicker();
    },

    // ========== БРОСКИ КУБИКОВ ==========
    d(n) { return Math.floor(Math.random() * n) + 1; },
    d20() { return this.d(20); },

    parseRoll(formula) {
      // "2d4+2" -> результат
      const match = formula.match(/(\d+)d(\d+)(?:\+(-?\d+))?/);
      if (!match) return 0;
      const count = parseInt(match[1]);
      const sides = parseInt(match[2]);
      const bonus = match[3] ? parseInt(match[3]) : 0;
      let total = bonus;
      for (let i = 0; i < count; i++) total += this.d(sides);
      return total;
    },

    // ========== ВЫБОР КЛАССА ==========
    renderClassSelection() {
      const screen = document.getElementById('class-screen');
      if (!screen || !this.data) return;

      let html = `
        <h1>Выберите класс</h1>
        <p>Каждый класс имеет уникальные способности, характеристики и стиль боя.</p>
        <div class="class-grid">
      `;

      for (const [key, cls] of Object.entries(this.data.classes)) {
        html += `
          <div class="class-card" ${this.onclickGame('selectClass', key)}>
            <div class="class-icon">${this.renderIcon(cls.icon)}</div>
            <div class="class-name">${cls.name}</div>
            <div class="class-stats">
              <div>❤️ ${cls.hp} ОЗ</div>
              <div>🛡️ КД ${cls.ac}</div>
              <div>⚔️ +${cls.atkBonus} атака</div>
            </div>
            <div class="class-abilities-preview">
              ${(cls.abilities || []).slice(0, 3).map((ab) => {
                const def = typeof ab === 'string'
                  ? (this.resolveAbilityDefinition(ab) || { id: ab, name: ab, icon: '✨' })
                  : ab;
                return `<div class="class-ab">${this.renderIcon(def.icon)} ${this.escapeHtml(def.name || def.id || '')}</div>`;
              }).join('')}
            </div>
            <div class="class-resource">Ресурс: ${(cls.resource || { name: '—', max: 0 }).name} (${(cls.resource || { max: 0 }).max})</div>
          </div>
        `;
      }

      html += '</div>';
      screen.innerHTML = html;
    },

    selectClass(classKey) {
      this.state.className = classKey;
      const cls = this.data.classes[classKey];
      if (!cls) return;

      const resource = cls.resource || { name: 'Ресурс', max: 2, desc: '' };

      this.state.hp = cls.hp ?? 20;
      this.state.maxHp = cls.hp ?? 20;
      this.state.inventory = [...(cls.startingItems || [])];
      this.initProgressionState();
      this.initResourcesFromLevel(1);

      this.state.classData = {
        ac: cls.ac ?? 10,
        atkBonus: cls.atkBonus ?? 0,
        dmgRoll: cls.dmgRoll || '1d6',
        dmgBonus: cls.dmgBonus ?? 0,
        initBonus: cls.initBonus ?? 0,
        stats: { ...(cls.stats || {}) },
        skills: cls.skills || '',
        resourceName: resource.name,
        resourceDesc: resource.desc || '',
        abilities: this.normalizeAbilities(cls.abilities, classKey)
      };

      this.autoEquipStartingGear(classKey);
      const combat = this.recalculateCombatStats();

      // Обновление интерфейса
      this.renderClassDisplay(classKey);
      this.setCharName(this.state.charName || 'Герой');
      this.updateUI();
      this.updateAbilityGrid();

      const skillsEl = document.getElementById('skills-list');
      if (skillsEl) skillsEl.textContent = 'Навыки: ' + (cls.skills || '—');

      const resLabel = document.getElementById('resource-label');
      if (resLabel) resLabel.textContent = resource.name;

      document.getElementById('class-screen').classList.add('hidden');
      document.getElementById('name-screen').classList.remove('hidden');
    },

    getActiveSystemId() {
      return this.data?.meta?.system || this.data?.system || this.activeSystem?.id || 'dnd5e';
    },

    getDefaultRaceKey() {
      const races = this.data?.races || {};
      const sys = this.getActiveSystemId();
      if (sys === 'pf2e') {
        const pf2e = Object.keys(races).find(k => races[k]?.system === 'pf2e');
        return pf2e || '';
      }
      if (races.human && (!races.human.system || races.human.system !== 'pf2e')) return 'human';
      const dnd = Object.keys(races).find(k => !races[k]?.system || races[k].system !== 'pf2e');
      return dnd || '';
    },

    getRaceData(raceKey) {
      const key = raceKey || this.state.raceKey;
      if (!key) return null;
      return this.data?.races?.[key] || null;
    },

    buildRacialAbilities(race) {
      if (!race?.traits?.length) return [];
      const isPf2e = race.system === 'pf2e';
      return race.traits
        .filter(t => t.type === 'active')
        .map(trait => ({
          id: trait.id,
          name: trait.name,
          icon: '🧬',
          desc: trait.desc,
          cost: 0,
          combatOnly: isPf2e ? trait.type === 'active' : true,
          oncePerCombat: !isPf2e,
          effect: { type: 'custom', message: trait.desc },
          usage: isPf2e && trait.type !== 'active' ? 'exploration' : 'combat',
          type: 'active',
          racial: true
        }));
    },

    /** Раса + класс в одной строке (#class-display). Отдельный #race-display не используем. */
    renderRaceDisplay(raceKey) {
      const raceEl = document.getElementById('race-display');
      if (raceEl) {
        raceEl.innerHTML = '';
        raceEl.classList.add('hidden');
      }
      if (raceKey && !this.state.raceData) {
        const r = this.getRaceData(raceKey);
        if (r) this.state.raceData = { ...r };
      }
      this.renderClassDisplay(this.state.className);
    },

    renderClassDisplay(classKey) {
      const cls = classKey ? this.data?.classes?.[classKey] : null;
      const el = document.getElementById('class-display');
      const raceEl = document.getElementById('race-display');
      if (!el) return;
      if (raceEl) {
        raceEl.innerHTML = '';
        raceEl.classList.add('hidden');
      }
      const race = this.state.raceData || this.getRaceData(this.state.raceKey);
      if (!cls && !race) {
        el.innerHTML = '';
        return;
      }
      const parts = [];
      if (race) {
        parts.push(
          `<span class="class-display-race">${this.renderIcon(race.icon)} <span class="class-display-name class-display-name--race">${this.escapeHtml(race.name)}</span></span>`
        );
      }
      if (cls) {
        if (race) parts.push('<span class="class-display-sep" aria-hidden="true">·</span>');
        parts.push(
          `<span class="class-display-class">${this.renderIcon(cls.icon)} <span class="class-display-name">${this.escapeHtml(cls.name)}</span></span>`
        );
      }
      el.innerHTML = parts.join('');
    },

    renderAbilities() {
      const el = document.getElementById('abilities-list');
      const cd = this.state.classData;
      if (!el || !cd?.abilities?.length) {
        if (el) el.innerHTML = '<div class="hint" style="font-size:12px;">Нет умений</div>';
        return;
      }

      const inCombat = !!this.state.combat;
      const playerTurn = !!this.state.combat?.playerTurn;
      const resName = cd.resourceName || 'ресурс';
      const spellLevel = (ab) => this.getAbilitySpellLevel(ab);

      el.innerHTML = cd.abilities.map(ab => {
        const cost = ab.cost ?? 0;
        const isPassive = this.isAbilityPassiveAbility(ab);
        const combatOnly = this.isAbilityCombatOnly(ab);
        const spellBlocked = this.isSpellBlockedByCurse(ab);
        const canAfford = this.canAffordAbility(ab);
        const used = inCombat && ab.oncePerCombat && this.state.combat?.abilitiesUsed?.[ab.id];
        let unavailable = inCombat ? this.getAbilityUnavailableReason(ab) : null;
        if (!inCombat) {
          if (combatOnly) unavailable = unavailable || 'Только в бою';
          if ((this.state.level || 1) < this.getAbilityMinLevel(ab)) {
            unavailable = `Доступно с ${this.getAbilityMinLevel(ab)} уровня`;
          } else if (typeof this.getWildShapeUnavailableReason === 'function') {
            const ws = this.getWildShapeUnavailableReason(ab);
            if (ws && ws !== 'Уже в облике зверя') unavailable = unavailable || ws;
          } else if (typeof this.getTransformUnavailableReason === 'function') {
            const tr = this.getTransformUnavailableReason(ab);
            if (tr && tr !== 'Уже преобразованы') unavailable = unavailable || tr;
          }
        }
        let canUse = !isPassive && canAfford && !used && !spellBlocked && !unavailable;
        if (inCombat) canUse = canUse && playerTurn;
        else canUse = canUse && !combatOnly;

        const sl = spellLevel(ab);
        const actionBadge = `<span class="ability-action-badge ability-action-badge--${this.escapeAttr(this.getAbilityActionType(ab))}">${this.escapeHtml(this.getAbilityActionTypeBadge(ab))}</span>`;
        const meta = isPassive
          ? 'пассив'
          : (spellBlocked ? '🤐 безмолвие' : (sl >= 1 ? `круг ${sl}` : `${cost} ${resName}`));
        const abId = this.escapeAttr(ab.id);
        const useBtn = isPassive
          ? ''
          : (canUse
            ? `<button type="button" class="ability-use-btn" onclick="event.stopPropagation();GameEngine.useAbility('${abId}')">Использовать</button>`
            : `<button type="button" class="ability-use-btn" disabled title="${this.escapeAttr(unavailable || '')}">Использовать</button>`);
        const displayDesc = this.getAbilityDisplayDesc(ab);
        const desc = displayDesc
          ? `<div class="ability-row-desc">${this.escapeHtml(displayDesc)}</div>`
          : '';
        const rowClass = 'ability-row' + (isPassive ? ' ability-row--passive' : '');

        return `<div class="${rowClass}" title="${this.escapeAttr(displayDesc || '')}" ${this.onclickGame('showAbilityInfo', ab.id)}>
          <div class="ability-row-head">
            <span class="ability-row-icon">${this.renderIcon(ab.icon)}</span>
            <span class="ability-row-name">${this.escapeHtml(ab.name)}</span>
            ${actionBadge}
            <span class="ability-row-meta">${this.escapeHtml(meta)}</span>
            ${useBtn}
          </div>
          ${desc}
        </div>`;
      }).join('');
    },

    onAbilityCardClick(abilityId) {
      const ab = this.state.classData.abilities?.find(a => a.id === abilityId);
      if (!ab) return;

      const inCombat = !!this.state.combat;
      const cost = ab.cost ?? 0;
      const spellBlocked = this.isSpellBlockedByCurse(ab);
      const canAfford = this.canAffordAbility(ab);
      const sl = this.getAbilitySpellLevel(ab);
      const canUse = !spellBlocked && (inCombat
        ? this.state.combat.playerTurn && canAfford
        : !this.isAbilityCombatOnly(ab) && canAfford);

      if (canUse && ab.type !== 'passive' && !ab.passive) {
        this.useAbility(abilityId);
        return;
      }
      this.showAbilityInfo(abilityId);
    },

    showAbilityInfo(abilityId) {
      const ab = this.state.classData.abilities.find(a => a.id === abilityId);
      if (!ab) return;
      const combatTag = this.isAbilityCombatOnly(ab) ? '⚔️ Только в бою' : '🌿 Мир / Бой';
      const onceTag = ab.oncePerCombat ? ' | Используется 1 раз за бой' : '';
      const sl = this.getAbilitySpellLevel(ab);
      const costLine = sl >= 1
        ? `Ячейка круга ${sl}`
        : `Стоимость: ${ab.cost ?? 0} ${this.state.classData.resourceName}`;
      this.showModal(ab.name + ' ' + ab.icon, this.getAbilityDisplayDesc(ab) + '\n\n' + costLine + '\n' + combatTag + onceTag);
    },

    renderAttrRow(label, score) {
      const val = score != null && score !== ''
        ? `${score} (${this.formatMod(score)})`
        : '—';
      return `<div class="attr-row"><span class="attr-label">${label}:</span><span class="attr-val">${val}</span></div>`;
    },

    updateAbilityGrid() {
      const grid = document.getElementById('ability-grid');
      if (!grid) return;

      const cd = this.state.classData;
      const keys = [
        ['СИЛ', 'str'],
        ['ЛОВ', 'dex'],
        ['ТЕЛ', 'con'],
        ['ИНТ', 'int'],
        ['МУД', 'wis'],
        ['ХАР', 'cha']
      ];

      if (!cd?.stats) {
        grid.innerHTML = keys.map(([label]) => this.renderAttrRow(label, null)).join('');
        return;
      }

      grid.innerHTML = keys.map(([label, key]) => this.renderAttrRow(label, cd.stats[key])).join('');
    },

    getModifierPF2e(score) {
      return Math.floor((Number(score) - 10) / 2);
    },

    getModifier(score) {
      if (this.activeSystem?.getModifier) {
        return this.activeSystem.getModifier(score);
      }
      if (this.getActiveSystemId() === 'pf2e') {
        return this.getModifierPF2e(score);
      }
      return Math.floor((Number(score) - 10) / 2);
    },

    formatMod(score) {
      const mod = this.getModifier(score);
      return mod >= 0 ? '+' + mod : mod;
    },

    /** Список id навыков, которыми владеет персонаж (сохранения без proficiencies — из classData) */
    getProficientSkillIds() {
      const fromState = this.state.proficiencies?.skills;
      if (Array.isArray(fromState) && fromState.length) {
        return fromState.map(s => String(s).toLowerCase());
      }
      const cd = this.state.classData;
      if (Array.isArray(cd?.skillIds) && cd.skillIds.length) {
        return cd.skillIds.map(s => String(s).toLowerCase());
      }
      return [];
    },

    isPf2eMode() {
      return this.getActiveSystemId() === 'pf2e' || this.activeSystem?.id === 'pf2e';
    },

    getPf2eSkillRank(skill) {
      const sys = this.activeSystem;
      const key = sys?.normalizeSkillId
        ? sys.normalizeSkillId(skill)
        : String(skill || '').toLowerCase();
      const rank = this.state.skills?.[key];
      if (rank && rank !== 'untrained') return rank;
      return sys?.getSkillProficiencyRank?.(key, this.state.classData, this) || 'untrained';
    },

    getPf2eSkillRankShort(rank) {
      const map = this.activeSystem?.RANK_SHORT || { trained: 'T', expert: 'E', master: 'M', legendary: 'L' };
      return map[rank] || 'U';
    },

    getPf2eSkillRankCss(rank) {
      return `skill-rank--${rank || 'untrained'}`;
    },

    /** Миграция старых PF2e сохранений без state.skills */
    migratePf2eSkillsState() {
      if (!this.isPf2eMode()) return;
      if (this.state.skills && Object.keys(this.state.skills).length) return;

      const map = {};
      const cd = this.state.classData || {};
      const cls = this.data?.classes?.[this.state.className];

      const add = (id, rank) => {
        const key = this.activeSystem?.normalizeSkillId?.(id) || String(id).toLowerCase();
        if (key) map[key] = rank || 'trained';
      };

      (cls?.fixedSkills || []).forEach(id => add(id, cls?.skillChoices?.rank || 'trained'));
      (cd.skillProficiency && typeof cd.skillProficiency === 'object'
        ? Object.entries(cd.skillProficiency)
        : []
      ).forEach(([k, r]) => add(k, r));
      (cd.skillIds || this.state.proficiencies?.skills || []).forEach(id => add(id, 'trained'));
      if (typeof cd.skills === 'string' && cd.skills.trim()) {
        cd.skills.split(',').forEach(part => add(part.trim(), 'trained'));
      }

      this.state.skills = map;
      if (cd) cd.skillProficiency = { ...map };
    },

    isSkillProficient(skill) {
      if (this.isPf2eMode()) {
        const rank = this.getPf2eSkillRank(skill);
        return rank && rank !== 'untrained';
      }
      const key = String(skill || '').toLowerCase();
      const ids = this.getProficientSkillIds();
      if (ids.includes(key)) return true;
      const cd = this.state.classData;
      const playerSkills = cd?.skills || '';
      if (playerSkills && typeof playerSkills === 'string') {
        const defs = this.activeSystem?.getSkillDefs?.() || {};
        const def = defs[key] || Object.values(defs).find(d => d.ru === skill);
        if (def?.ru && playerSkills.includes(def.ru)) return true;
      }
      return false;
    },

    getSkillBonus(skill) {
      const cd = this.state.classData;
      if (!cd || !cd.stats) return 0;

      if (this.activeSystem?.getSkillBonus) {
        return this.activeSystem.getSkillBonus(skill, cd.stats, cd, this);
      }

      const SKILL_DEFS = this.activeSystem?.getSkillDefs?.() || {
        acrobatics: { stat: 'dex', ru: 'Акробатика' },
        animal_handling: { stat: 'wis', ru: 'Уход за животными' },
        arcana: { stat: 'int', ru: 'Магия (тайные знания)' },
        athletics: { stat: 'str', ru: 'Атлетика' },
        deception: { stat: 'cha', ru: 'Обман' },
        history: { stat: 'int', ru: 'История' },
        insight: { stat: 'wis', ru: 'Проницательность' },
        intimidation: { stat: 'cha', ru: 'Устрашение' },
        investigation: { stat: 'int', ru: 'Расследование' },
        medicine: { stat: 'wis', ru: 'Медицина' },
        nature: { stat: 'int', ru: 'Природа' },
        perception: { stat: 'wis', ru: 'Восприятие' },
        performance: { stat: 'cha', ru: 'Выступление' },
        persuasion: { stat: 'cha', ru: 'Убеждение' },
        religion: { stat: 'int', ru: 'Религия' },
        sleight_of_hand: { stat: 'dex', ru: 'Ловкость рук' },
        stealth: { stat: 'dex', ru: 'Скрытность' },
        survival: { stat: 'wis', ru: 'Выживание' },
        magic: { stat: 'int', ru: 'Магия' },
        dexterity: { stat: 'dex', ru: null },
        strength: { stat: 'str', ru: null },
        wisdom: { stat: 'wis', ru: null },
        charisma: { stat: 'cha', ru: null },
        intelligence: { stat: 'int', ru: null },
        constitution: { stat: 'con', ru: null }
      };

      const key = String(skill || '').toLowerCase();
      let def = SKILL_DEFS[key];
      let skillNameRu = skill;

      if (def) {
        skillNameRu = def.ru || skill;
      } else {
        const byRu = Object.values(SKILL_DEFS).find(d => d.ru === skill);
        if (byRu) {
          def = byRu;
          skillNameRu = skill;
        }
      }

      const statKey = def?.stat || 'int';
      const proficient = this.isSkillProficient(key) || (def?.ru && this.isSkillProficient(skillNameRu));
      const proficiency = proficient ? this.getProficiencyBonus() : 0;

      const statValue = cd.stats[statKey] || 10;
      return this.getModifier(statValue) + proficiency;
    },

    shouldShowCharacterCreator() {
      return this.needsCharacterCreation();
    },

    showCharacterCreator() {
      if (this.CharacterCreator?.open) this.CharacterCreator.open();
    },

    hideCharacterCreator() {
      if (this.CharacterCreator?.close) this.CharacterCreator.close();
      else document.getElementById('char-creator-screen')?.classList.add('hidden');
    },

    /** ОЗ 1 уровня: кость класса + мод. Тел (D&D 5e) */
    getClassLevel1Hp(classKey, conMod) {
      if (this.activeSystem?.calculateHP) {
        const draftStats = this.CharacterCreator?.draft?.stats;
        const stats = this.state.stats || draftStats || this.state.classData?.stats || {};
        return this.activeSystem.calculateHP(classKey, 1, stats, this.data, conMod, this);
      }
      const hitDie = {
        warrior: 10,
        wizard: 6,
        paladin: 10,
        barbarian: 12,
        bard: 8,
        druid: 8,
        monk: 8,
        warlock: 8,
        sorcerer: 6,
        rogue: 8,
        cleric: 8,
        ranger: 10
      };
      const cls = this.data?.classes?.[classKey];
      const base = cls?.hpHitDie ?? hitDie[classKey] ?? cls?.hp ?? 10;
      const mod = conMod != null ? conMod : this.getModifier(this.state.stats?.con ?? 10);
      return Math.max(1, Number(base) + mod);
    },

    /** Стартовая сцена после создателя персонажа (project.startScene или legacy-фолбэк). */
    getFirstStorySceneId() {
      if (typeof ProjectSchema !== 'undefined' && typeof ProjectSchema.resolveProjectStartSceneId === 'function') {
        return ProjectSchema.resolveProjectStartSceneId(this.data);
      }
      const scenes = this.data?.scenes || {};
      const configured = this.data?.startScene ?? this.data?.meta?.startScene;
      if (configured != null && String(configured) !== '' && scenes[configured]) {
        return String(configured);
      }
      if (scenes.village_hub) return 'village_hub';
      if (scenes.start) return 'start';
      const keys = Object.keys(scenes);
      return keys[0] || 'start';
    },

    /** Сцена по умолчанию для кнопки «назад» из special / лавки */
    getSceneExitTarget(scene) {
      if (!scene) return 'village';
      return scene.exitScene || scene.hubScene || 'village';
    },

    /** Кнопка возврата в хаб (если в данных включён returnsToHub) */
    buildHubReturnChoice(rawScene) {
      if (this.state.flags?.skipHubReturn) return null;
      if (!rawScene?.returnsToHub || !rawScene.hubScene) return null;
      const hub = rawScene.hubScene;
      const choices = rawScene.choices || [];
      const hasHubLink = choices.some(c => c && c.to === hub);
      if (hasHubLink) return null;
      const label = hub === 'village_hub'
        ? '← Вернуться на площадь'
        : '← Вернуться';
      return { text: label, to: hub, icon: '🏘️', _hubReturn: true };
    },

    /** Дополняет список выборов кнопкой возврата в хаб */
    withHubReturnChoices(choices, rawScene) {
      const extra = this.buildHubReturnChoice(rawScene);
      if (!extra) return choices || [];
      return [...(choices || []), extra];
    },

    racesRequiredForSystem() {
      const races = this.data?.races || {};
      const sys = this.getActiveSystemId();
      return Object.keys(races).some(k => {
        const rs = races[k]?.system || 'dnd5e';
        return sys === 'pf2e' ? rs === 'pf2e' : rs !== 'pf2e';
      });
    },

    buildPf2eStatsFromDraft(d) {
      const stats = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
      Object.entries(d.pf2eFixedBoosts || {}).forEach(([stat, val]) => {
        stats[stat] = Math.min(18, (stats[stat] || 10) + val);
      });
      Object.entries(d.pf2eFreeBoosts || {}).forEach(([stat, count]) => {
        stats[stat] = Math.min(18, (stats[stat] || 10) + count * 2);
      });
      return stats;
    },

    finalizeCharacter(draft) {
      const d = draft || this.CharacterCreator?.draft;
      if (!d?.classKey || !this.data?.classes?.[d.classKey]) return;

      const races = this.data?.races;
      const racesRequired = this.racesRequiredForSystem();
      if (racesRequired && !d.raceKey) return;

      const classKey = d.classKey;
      const cls = this.data.classes[classKey];
      const raceKey = d.raceKey || '';
      const race = raceKey && races ? races[raceKey] : null;
      const isPf2eRace = race?.system === 'pf2e' || this.getActiveSystemId() === 'pf2e';
      const name = (d.name || '').trim() || 'Герой';
      const resource = cls.resource || { name: 'Ресурс', max: 2, desc: '' };

      let stats;
      if (isPf2eRace) {
        stats = d.stats ? { ...d.stats } : this.buildPf2eStatsFromDraft(d);
      } else {
        stats = { ...d.stats };
        if (d.raceKey && race?.asi) {
          for (const [stat, bonus] of Object.entries(race.asi)) {
            if (stats[stat] != null) {
              stats[stat] = Math.min(20, stats[stat] + bonus);
            }
          }
        }
      }

      const conMod = this.getModifier(stats.con ?? 10);
      const maxHp = this.getClassLevel1Hp(classKey, conMod);

      this.state.charName = name;
      this.state.className = classKey;
      this.state.gender = d.gender || 'male';
      this.state.raceKey = d.raceKey || '';
      this.state.raceData = race ? { ...race } : null;
      this.state.stats = stats;
      this.state.heritageId = d.heritageId || '';
      this.state.pf2eFixedBoosts = d.pf2eFixedBoosts ? { ...d.pf2eFixedBoosts } : null;
      this.state.pf2eFreeBoosts = d.pf2eFreeBoosts ? { ...d.pf2eFreeBoosts } : null;
      this.state.hp = maxHp;
      this.state.maxHp = maxHp;
      this.state.baseMaxHp = maxHp;
      this.state._lastComputedMaxHp = maxHp;
      this.state.gold = 0;
      this.state.supplies = 0;
      this.state.inventory = [...(cls.startingItems || [])];
      this.state.flags = {};
      this.applyStartingFlags();
      this.state.questStages = {};
      this.state.sceneVisits = {};
      this.state.visitedLocations = {};
      this.state.clearedCombats = {};
      this.state.achievementUnlocks = {};
      this.state.combat = null;
      this.state.enemies = [];
      this.state.favoredEnemyTypes = Array.isArray(d.favoredEnemyTypes)
        ? [...d.favoredEnemyTypes]
        : [];
      this.state.equipped = {};
      this.state.curseEffects = {};
      this.initProgressionState();
      this.initResourcesFromLevel(1);

      const isPf2eClass = cls.system === 'pf2e' || isPf2eRace || this.isPf2eMode();
      let skillIds = [];
      let skillStr = '';

      if (isPf2eClass && d.pf2eSkills && typeof d.pf2eSkills === 'object') {
        this.state.skills = { ...d.pf2eSkills };
        this.state.skillIncreases = [];
        skillIds = Object.keys(this.state.skills);
        skillStr = this.CharacterCreator
          ? skillIds.map(id => this.CharacterCreator.skillLabel(id)).join(', ')
          : skillIds.join(', ');
        this.state.proficiencies = { skills: [] };
      } else {
        skillIds = [...new Set((d.skills || []).map(s => String(s).toLowerCase()))];
        skillStr = this.CharacterCreator
          ? this.CharacterCreator.skillsToString(skillIds)
          : (cls.skills || '');
        this.state.proficiencies = { skills: skillIds };
        this.state.skills = {};
      }

      const baseAbilities = this.reconcileAbilities(
        this.normalizeAbilities(cls.abilities || [], classKey),
        classKey
      );
      const abilities = [...baseAbilities];
      const bonusId = d.bonusAbilityId;
      if (bonusId && !abilities.some(a => a.id === bonusId)) {
        const bonusDef = this.resolveAbilityDefinition(bonusId);
        if (bonusDef) {
          abilities.push(this.reconcileAbility(bonusDef, bonusDef, classKey, abilities.length));
        }
      }

      const racialAbilities = this.buildRacialAbilities(race);
      racialAbilities.forEach(ab => {
        if (!abilities.some(a => a.id === ab.id)) {
          abilities.push(this.normalizeAbility(ab, classKey, abilities.length));
        }
      });

      this.state.classData = {
        ac: cls.ac ?? 10,
        atkBonus: cls.atkBonus ?? 0,
        dmgRoll: cls.dmgRoll || '1d6',
        dmgBonus: cls.dmgBonus ?? 0,
        initBonus: cls.initBonus ?? 0,
        stats: { ...stats },
        skills: skillStr,
        skillIds,
        skillProficiency: isPf2eClass ? { ...(this.state.skills || {}) } : undefined,
        resourceName: resource.name,
        resourceDesc: resource.desc || '',
        abilities
      };

      abilities.forEach(ab => {
        if (ab.passive || ab.type === 'passive') this.applyPassiveAbility(ab);
      });

      this.autoEquipStartingGear(classKey);
      this.initStartingArrowAmmo();
      this.recalculateCombatStats();
      this.migrateCurseState();
      this.migrateCraftingState();
      if (classKey === 'druid') {
        const forms = Array.isArray(d.wildShapeKnownForms) ? d.wildShapeKnownForms.filter(Boolean) : [];
        this.state.wildShape = {
          knownForms: forms.length
            ? forms
            : (typeof BeastSystem !== 'undefined'
              ? BeastSystem.defaultKnownFormIds(this.data)
              : ['wolf', 'panther'])
        };
        if (typeof this.migrateWildShapeState === 'function') this.migrateWildShapeState();
      }
      this.setCharName(name);

      this.renderClassDisplay(classKey);

      const resLabel = document.getElementById('resource-label');
      if (resLabel) resLabel.textContent = resource.name;

      this.hideCharacterCreator();
      document.getElementById('class-screen')?.classList.add('hidden');
      document.getElementById('name-screen')?.classList.add('hidden');
      this.ensurePlayerUIVisible({ force: true });

      this.initUI();
      this.updateUI();
      this.updateAbilityGrid();
      this.log('--- ' + name + ', ' + cls.name + ' — путь начинается ---', 'log-combat');

      // Стартовая сцена: project.startScene при наличии, иначе legacy-цепочка в getFirstStorySceneId()
      const startScene = this.getFirstStorySceneId();
      if (this.data?.scenes?.[startScene]) {
        this.showScene(startScene, { forceRevisit: true });
      } else {
        this.state.scene = startScene;
        this.setText('Сцена «' + startScene + '» не найдена. Загрузите game_data.json.');
        this.setChoices([]);
        this.saveGame({ force: true });
      }
      this.initTooltips();
    },

    maybeEnterCharacterCreator() {
      if (this.needsCharacterCreation()) {
        this.showCharacterCreator();
        return true;
      }
      return false;
    },

    /**
     * Настройки отдыха из game_data.json (rest.types.short / rest.types.long).
     * hpFraction / resourceFraction: доля от max (1 = полностью).
     * consumesSupply: тратить 1 припас при отдыхе этого типа.
     */
    getRestConfig(type) {
      const defaults = {
        short: { hpFraction: 0.5, resourceFraction: 0.5, consumesSupply: false },
        long: { hpFraction: 1, resourceFraction: 1, consumesSupply: true }
      };
      const key = type || this.data?.rest?.defaultType || 'long';
      const fromData = this.data?.rest?.types?.[key];
      return { ...(defaults[key] || defaults.long), ...(fromData || {}) };
    },

    /**
     * Отдых: восстановление HP и классового ресурса.
     * @param {string} [type] — опционально 'short' | 'long' из data.rest.types.
     * supplies > 0: −1 припас, HP = maxHp, ресурс = max.
     * supplies === 0: +50% maxHp и +50% ресурса (отдых не блокируется).
     */
    rest(type) {
      const resourcesFull = this.state.resources?.mode === 'spellSlots'
        ? Object.values(this.state.resources.spellSlots || {}).every(s => s.c >= s.m)
        : this.state.resources.current >= this.state.resources.max;
      if (this.state.hp >= this.state.maxHp && resourcesFull) {
        this.log('Вы уже полностью отдохнувшие.', 'log-dice');
        return;
      }

      const cfg = this.getRestConfig(type);
      const hpBefore = this.state.hp;
      const resBefore = this.state.resources?.mode === 'spellSlots'
        ? Object.values(this.state.resources.spellSlots || {}).reduce((s, x) => s + x.c, 0)
        : this.state.resources.current;
      const resName = this.state.classData?.resourceName || 'ресурс';
      const hasSupply = this.getSupplyCount() > 0;
      const isShortRest = type === 'short' || (cfg.hpFraction < 1 && cfg.hpFraction > 0);

      if (this.state.flags?.focusPotionUntil) {
        delete this.state.flags.focusPotionUntil;
        this.log('🧿 Отдых снял эффект зелья фокусировки.', 'log-dice');
      }

      if (hasSupply && !isShortRest) {
        this.consumeOneSupply();
        this.state.hp = this.state.maxHp;
        this.restoreAllResources();
        this.log('Вы восстановили силы и здоровье после отдыха.', 'log-heal');
      } else if (hasSupply && isShortRest) {
        this.state.hp = Math.min(this.state.maxHp, this.state.hp + Math.floor(this.state.maxHp * cfg.hpFraction));
        const resCfg = this.getClassResourceConfig(this.state.className);
        if (resCfg?.shortRestFull) {
          this.applyLevelResources(this.state.level || 1);
          this.restoreAllResources();
          this.log('Короткий отдых: ресурс класса полностью восстановлен.', 'log-heal');
        } else if (this.state.resources.mode === 'spellSlots') {
          Object.values(this.state.resources.spellSlots || {}).forEach(slot => {
            const gain = Math.floor(slot.m * cfg.resourceFraction);
            slot.c = Math.min(slot.m, slot.c + gain);
          });
        } else {
          this.state.resources.current = Math.min(
            this.state.resources.max,
            this.state.resources.current + Math.floor(this.state.resources.max * cfg.resourceFraction)
          );
        }
        if (!resCfg?.shortRestFull) {
          this.log('Короткий отдых: восстановлена часть здоровья и ресурса.', 'log-heal');
        }
      } else {
        this.state.hp = Math.min(this.state.maxHp, this.state.hp + Math.floor(this.state.maxHp / 2));
        if (this.state.resources.mode === 'spellSlots') {
          Object.values(this.state.resources.spellSlots || {}).forEach(slot => {
            const gain = Math.floor(slot.m / 2);
            slot.c = Math.min(slot.m, slot.c + gain);
          });
        } else {
          this.state.resources.current = Math.min(
            this.state.resources.max,
            this.state.resources.current + Math.floor(this.state.resources.max / 2)
          );
        }
        this.log('Без провизии здоровье восстанавливается лишь наполовину.', 'log-damage');
        this.log('Купите припасы у Джека (10 зм), чтобы полностью восстановиться после отдыха.', 'log-dice');
      }

      const hpGain = this.state.hp - hpBefore;
      const resAfter = this.state.resources?.mode === 'spellSlots'
        ? Object.values(this.state.resources.spellSlots || {}).reduce((s, x) => s + x.c, 0)
        : this.state.resources.current;
      const resGain = resAfter - resBefore;
      if (hpGain > 0) {
        this.log(`❤️ +${hpGain} ОЗ — сейчас ${this.state.hp} / ${this.state.maxHp}`, 'log-heal');
      }
      if (resGain > 0) {
        if (this.state.resources.mode === 'spellSlots') {
          this.log(`⚡ ${resName}: ячейки восстановлены (+${resGain})`, 'log-heal');
          this.playRestSpellSlotSound();
        } else {
          this.log(`⚡ ${resName}: ${this.state.resources.current} / ${this.state.resources.max}`, 'log-heal');
        }
      }
      if (hasSupply && !isShortRest) {
        this.log(`Припасов осталось: ${this.getSupplyCount()}`, 'log-dice');
      }

      this.updateUI();

      if (typeof WorldHierarchy !== 'undefined') {
        WorldHierarchy.onRestInScene(this.data, this.state, this.state.scene, isShortRest ? 'short' : 'long');
        const hubId = WorldHierarchy.getHubIdForScene(this.data, this.state.scene);
        if (hubId) {
          const st = WorldHierarchy.getSceneState(this.data, this.state, this.state.scene);
          const t = WorldHierarchy.TIME_LABELS[st.timeOfDay] || st.timeOfDay;
          if (t) this.log(`🌅 В деревне уже ${t.toLowerCase()}.`, 'log-dice');
          this.applyInheritedSceneAmbience?.(this.state.scene);
        }
      }

      const restBtn = document.getElementById('rest-btn');
      if (restBtn) {
        restBtn.classList.add('resting');
        setTimeout(() => restBtn.classList.remove('resting'), 500);
      }
      this.saveGame();
    },

    startGame() {
      if (this.needsCharacterCreation()) {
        if (this.CharacterCreator?.open) this.CharacterCreator.open();
        return;
      }
      AudioEngine.unlock();
      const nameInput = document.getElementById('start-name');
      const name = nameInput ? nameInput.value.trim() : '';
      this.setCharName(name);
      document.getElementById('name-screen').classList.add('hidden');
      document.getElementById('game-content').classList.remove('hidden');
      this.showScene(this.getFirstStorySceneId());
      this.renderInv();
      this.updateUI();
      this.initTooltips();
    },

    /** Перенос старых ключей questStages (quest_find_albert → find_albert) */
    /** Старые сохранения: площадь была привязана к village_tavern */
    migrateVisitedLocations() {
      const v = this.state.visitedLocations || {};
      if (v.village_tavern && !v.village_hub) v.village_hub = true;
      this.state.visitedLocations = v;
    },

    migrateSaveQuestStages() {
      const qs = this.state.questStages || {};
      let changed = false;
      const next = {};
      for (const [key, val] of Object.entries(qs)) {
        if (key.startsWith('quest_')) {
          next[key.slice(6)] = val;
          changed = true;
        } else {
          next[key] = val;
        }
      }
      if (changed) this.state.questStages = next;
    },

    registerMapLocation(scene) {
      if (!scene?.mapLocation) return;
      if (!this.state.visitedLocations) this.state.visitedLocations = {};
      const locId = scene.mapLocation;
      const first = !this.state.visitedLocations[locId];
      this.state.visitedLocations[locId] = true;
      if (first && typeof QuestEvents !== 'undefined') {
        QuestEvents.emit('LocationDiscovered', {
          locationId: locId,
          sceneId: scene.id || this.state.scene,
          location: scene.location || locId
        });
      }
      this.renderTravelMenu();
    },

    shouldApplySceneRewards(sceneId, scene, options = {}) {
      if (options.forceRevisit) return false;
      if (scene?.repeatRewards === true) return true;
      const visits = this.state.sceneVisits?.[sceneId] || 0;
      return visits === 0;
    },

    getCombatSourceSceneId(combat) {
      if (!combat) return null;
      const key = combat.expKey;
      if (typeof key === 'string' && key.startsWith('combat:')) return key.slice(7);
      return null;
    },

    inferClearedCombatMapLabel(enemyIds) {
      if (!enemyIds?.length) return 'поверженные';
      const joined = enemyIds.join(',');
      if (/wolf/i.test(joined)) return 'волки';
      if (/scout|bandit|thug|enforcer|cultist|robber/i.test(joined)) return 'разбойники';
      const names = enemyIds.map((id) => this.data?.enemies?.[id]?.name).filter(Boolean);
      if (names.length === 1) return names[0];
      if (names.length > 1) return names.slice(0, 2).join(', ');
      return 'поверженные';
    },

    formatClearedBodiesMapNote(label) {
      const raw = String(label || 'поверженных').trim();
      const low = raw.toLowerCase();
      if (low === 'волки' || low === 'волк') return 'тела волков';
      if (low === 'разбойники' || low === 'разбойник') return 'тела разбойников';
      return `тела: ${raw}`;
    },

    markCombatCleared(combatSceneId) {
      const raw = this.data?.scenes?.[combatSceneId];
      if (!raw?.combat?.length) return;
      if (!this.state.clearedCombats) this.state.clearedCombats = {};
      const label = raw.clearedMapLabel || this.inferClearedCombatMapLabel(raw.combat);
      this.state.clearedCombats[combatSceneId] = {
        sceneId: combatSceneId,
        mapLocation: raw.mapLocation || null,
        afterScene: raw.nextScene || null,
        enemyIds: [...raw.combat],
        label,
        icon: '☠️'
      };
      this.state.flags[`combat_cleared_${combatSceneId}`] = true;
      if (raw.mapLocation) this.state.flags[`map_combat_cleared_${raw.mapLocation}`] = true;
      this.checkAchievements({
        type: 'combat_victory',
        sceneId: combatSceneId,
        enemyIds: [...(raw.combat || [])]
      });
    },

    isCombatSceneCleared(sceneId) {
      if (this.state.clearedCombats?.[sceneId]) return true;
      if (this.state.flags?.[`combat_cleared_${sceneId}`]) return true;
      const raw = this.data?.scenes?.[sceneId];
      const after = raw?.nextScene;
      if (after && (this.state.sceneVisits?.[after] || 0) > 0) return true;
      if (this.state.expAwarded?.[`combat:${sceneId}`]) return true;
      return false;
    },

    getClearedCombatsForMap(mapLocation) {
      if (!mapLocation) return [];
      const fromState = Object.values(this.state.clearedCombats || {}).filter((c) => c.mapLocation === mapLocation);
      if (fromState.length) return fromState;
      const out = [];
      for (const [sceneId, raw] of Object.entries(this.data?.scenes || {})) {
        if (raw.mapLocation !== mapLocation || !raw.combat?.length) continue;
        if (!this.isCombatSceneCleared(sceneId)) continue;
        out.push({
          sceneId,
          mapLocation,
          afterScene: raw.nextScene || null,
          label: raw.clearedMapLabel || this.inferClearedCombatMapLabel(raw.combat),
          icon: '☠️'
        });
      }
      return out;
    },

    getClearedMapNoteForLocation(mapLocation) {
      const cleared = this.getClearedCombatsForMap(mapLocation);
      if (!cleared.length) return '';
      const notes = [...new Set(cleared.map((c) => this.formatClearedBodiesMapNote(c.label)))];
      return ` — ☠️ ${notes.join('; ')}`;
    },

    resolveMapTravelScene(mapId) {
      const loc = this.data?.worldMap?.[mapId];
      if (!loc?.hubScene) return null;
      const cleared = this.getClearedCombatsForMap(mapId);
      const withAfter = cleared.filter((c) => c.afterScene && this.data.scenes[c.afterScene]);
      if (withAfter.length === 1) return withAfter[0].afterScene;
      return loc.hubScene;
    },

    migrateClearedCombatsFromSave() {
      if (!this.data?.scenes) return;
      if (!this.state.clearedCombats) this.state.clearedCombats = {};
      for (const [sceneId, raw] of Object.entries(this.data.scenes)) {
        if (!raw.combat?.length) continue;
        if (this.state.clearedCombats[sceneId]) continue;
        if (!this.isCombatSceneCleared(sceneId)) continue;
        this.markCombatCleared(sceneId);
      }
    },

    migrateQuestMapUnlocksFromSave() {
      const qs = this.state.questStages || {};
      const locket = qs.albert_locket;
      if (locket != null && locket !== '' && locket !== '__finished__') {
        this.applyQuestMapUnlocks('albert_locket', locket);
      }
      const lukorn = qs.lukorn_investigation;
      if (lukorn != null && lukorn !== '' && lukorn !== '__finished__' && Number(lukorn) >= 1) {
        this.applyQuestMapUnlocks('lukorn_investigation', lukorn);
      }
    },

    /** Аванс Марты: торг ИЛИ принятие квеста — одна выплата, не обе. */
    awardMartaQuestPayment(sceneId) {
      if (sceneId !== 'village_accept') return 0;
      if (this.state.flags.haggleDone) return 0;
      this.state.flags.haggleDone = true;
      return 25;
    },

    awardSceneGold(scene, sceneId) {
      if (!scene) return;
      let amount = scene.gold || 0;
      if (sceneId === 'village_accept') {
        amount = this.awardMartaQuestPayment(sceneId);
      }
      if (amount > 0) {
        if (typeof this.changeGold === 'function') {
          this.changeGold(amount, { reason: 'scene', source: 'scene_reward', silent: true });
        } else {
          this.state.gold += amount;
        }
        this.updateStats();
        const note = sceneId === 'village_accept' ? ' (аванс от Марты)' : '';
        this.log(`💰 +${amount} зм${note}`, 'log-heal');
      }
    },

    renderTravelMenu() {
      const sel = document.getElementById('travel-select');
      if (!sel) return;
      const map = this.data?.worldMap;
      if (!map) {
        sel.innerHTML = '<option value="">— Карта недоступна —</option>';
        sel.disabled = true;
        return;
      }
      const visited = this.state.visitedLocations || {};
      const ctx = this.getConditionContext();
      const current = this.state.scene;
      const entries = Object.entries(map).filter(([id, loc]) => {
        if (!visited[id]) return false;
        return ConditionSystem.isChoiceVisible({ showIf: loc.showIf, hideIf: loc.hideIf }, ctx);
      });
      if (entries.length === 0) {
        sel.innerHTML = '<option value="">— Исследуйте мир —</option>';
        sel.disabled = true;
        return;
      }
      sel.disabled = false;
      let html = '<option value="">🗺️ Переместиться…</option>';
      const currentScene = this.data?.scenes?.[current];
      const currentMapId = currentScene?.mapLocation || '';
      for (const [id, loc] of entries) {
        const hub = loc.hubScene || '';
        const here = id === currentMapId || hub === current ? ' (здесь)' : '';
        const bodies = this.getClearedMapNoteForLocation(id);
        html += `<option value="${this.escapeAttr(id)}">${this.escapeHtml((loc.icon || '📍') + ' ' + (loc.label || id) + bodies + here)}</option>`;
      }
      sel.innerHTML = html;
    },

    travelTo(mapId) {
      const loc = this.data?.worldMap?.[mapId];
      if (!loc?.hubScene) return;
      if (!this.state.visitedLocations?.[mapId]) {
        this.log('❌ Вы ещё не открыли это место.', 'log-damage');
        return;
      }
      if (this.state.combat) {
        this.log('❌ Нельзя путешествовать во время боя!', 'log-damage');
        return;
      }
      this.log(`🗺️ ${loc.label || mapId}`, 'log-dice');
      const dest = this.resolveMapTravelScene(mapId) || loc.hubScene;
      this.showScene(dest, { forceRevisit: true });
    },

    onTravelSelect(el) {
      const id = el?.value;
      el.value = '';
      if (id) this.travelTo(id);
    },

    handleJackTurnIn() {
      if (this.state.flags.jackRewarded) {
        this.setText('Джек кивает: «Уже расплатился — честное слово торговца!»');
        this.clearDialogue();
        this.setChoices([{ text: '🚪 На площадь', to: 'village_hub' }]);
        return;
      }
      if (!this.state.inventory.includes('jack_bag')) {
        this.log('❌ У вас нет сумки Джека.', 'log-damage');
        this.reopenJackShop();
        return;
      }
      this.removeItem('jack_bag');
      this.applyQuestRewards('lost_bag', { claimFlag: 'jackRewarded' });
      this.updateQuest('lost_bag', '2', { silentLog: true });
      this.updateQuest('lost_bag', 'complete');
      this.updateStats();
      this.setText('Джек хватает сумку и заглядывает внутрь.\n\n«Плат на месте, фляжка... Хм. Кошелёк легче, чем должен быть. Ну, ладно.»');
      this.setDialogue([
        { speaker: 'Джек', text: 'Держи тридцать — честное слово торговца. И если найдёшь ещё что-нибудь ценное в лесу — неси сюда.' }
      ]);
      this.setChoices([
        { text: '💰 Продолжить торговлю', action: 'reopen_jack_shop' },
        { text: '🚪 На площадь', to: 'village_hub' }
      ]);
      this.saveGame();
    },

    /** Флаг истинен для шаблона {flag ? 'да' : 'нет'} */
    isTemplateFlagTrue(flagName) {
      return !!this.state.flags?.[flagName];
    },

    /**
     * Шаблоны в тексте сцен и диалогов:
     * {flag ? 'если true' : 'если false'}, [name], {charName}, {gold}, {charGender}, {if_male}...{/if_male}, {if_female}...{/if_female}
     */
    /** Подстановка текстовых сниппетов @id из data.snippets */
    expandTextSnippets(text) {
      if (text == null) return '';
      let out = String(text);
      const snippets = this.data?.snippets;
      if (!snippets || typeof snippets !== 'object') return out;
      out = out.replace(/@([a-zA-Z0-9_]+)/g, (match, id) => {
        if (Object.prototype.hasOwnProperty.call(snippets, id)) {
          return String(snippets[id]);
        }
        console.warn('[Snippets] Сниппет не найден:', id);
        return match;
      });
      return out;
    },

    processSceneTemplate(text) {
      if (text == null) return '';
      let out = this.expandTextSnippets(text);

      out = out.replace(/\[name\]/gi, this.state.charName || 'Герой');

      const flagTpl =
        /\{([a-zA-Z_][a-zA-Z0-9_]*)\s*\?\s*'((?:\\'|[^'])*)'\s*:\s*'((?:\\'|[^'])*)'\}/g;
      out = out.replace(flagTpl, (_, flag, ifTrue, ifFalse) => {
        const pick = this.isTemplateFlagTrue(flag) ? ifTrue : ifFalse;
        return pick.replace(/\\'/g, "'");
      });

      out = out.replace(/{charName}/g, this.state.charName || 'Герой');
      out = out.replace(/{gold}/g, String(this.state.gold ?? 0));

      const genderId = this.state.gender || 'male';
      const genderLabel = genderId === 'female' ? 'Женский' : 'Мужской';
      out = out.replace(/\{charGender\}/gi, genderLabel);

      out = out.replace(/\{if_male\}([\s\S]*?)\{\/if_male\}/gi, (_, content) => genderId === 'male' ? content : '');
      out = out.replace(/\{if_female\}([\s\S]*?)\{\/if_female\}/gi, (_, content) => genderId === 'female' ? content : '');

      return out;
    },

    initUI() {
      if (typeof SidebarDock !== 'undefined') SidebarDock.init();
      this.migrateCraftingState?.();
      this.initMobileSidebar();
      // Добавляем кнопку закрытия модалки
      const modalClose = document.querySelector('.modal-close');
      if (modalClose) {
        modalClose.onclick = () => this.closeModal();
      }
      // Закрытие по клику вне модалки
      const modal = document.getElementById('modal');
      if (modal) {
        modal.onclick = (e) => { if (e.target === modal) this.closeModal(); };
      }
      const levelModal = document.getElementById('levelup-modal');
      if (levelModal) {
        levelModal.onclick = (e) => { if (e.target === levelModal) e.stopPropagation(); };
      }
      this.updateAudioToggleButton();
      if (!this._combatKeyHandlerBound) {
        this._combatKeyHandlerBound = true;
        document.addEventListener('keydown', (e) => {
          if (e.key !== 'Escape') return;
          if (GameEngine.getCombatPhase?.() === 'select_target') {
            e.preventDefault();
            GameEngine.cancelAbilityTargetSelect();
          }
        });
      }
    },
});

// Запуск при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  try {
    GameEngine.initUI();
    GameEngine.init();
  } catch (err) {
    console.error(err);
    const screen = document.getElementById('class-screen');
    if (screen) {
      screen.innerHTML =
        '<h1>Ошибка движка</h1><p style="font-family:monospace;white-space:pre-wrap;">' +
        String(err.message || err) +
        '</p><p>Обновите страницу (Ctrl+F5).</p>';
    }
  }
});


;/* —— js/engine/ui-renderer.js —— */
// ============================================================
// engine/ui-renderer.js — рендеринг HTML и UI
// ============================================================

(function attachEngineUiRenderer() {
  'use strict';
  if (typeof GameEngine === 'undefined') {
    console.error('engine/ui-renderer.js: GameEngine не определён — загрузите core.js первым');
    return;
  }

  Object.assign(GameEngine, {
    _tr(key, params, fallback) {
      if (typeof t !== 'function') return fallback ?? key;
      const v = t(key, params);
      return v !== key ? v : (fallback ?? key);
    },

    abilityActionTypeLabel(key) {
      const fb = {
        action: 'Действие',
        bonus_action: 'Бонус',
        reaction: 'Реакция',
        passive: 'Пассивное',
        free: 'Свободное'
      }[key] || key;
      return this._tr('game.ui.actionTypes.' + key, null, fb);
    },

    // ========== ПОДСКАЗКИ UI (ui_hints) ==========
    _tooltipDelayMs: 300,
    _tooltipShowTimer: null,
    _tooltipActiveIcon: null,
    _tooltipMoveHandler: null,
    _tooltipMousedownBound: false,

    getHintText(hintKey) {
      if (!hintKey || !this.data?.ui_hints) return null;
      const text = this.data.ui_hints[hintKey];
      if (text == null || String(text).trim() === '') return null;
      return String(text);
    },

    hideTooltip() {
      if (this._tooltipShowTimer) {
        clearTimeout(this._tooltipShowTimer);
        this._tooltipShowTimer = null;
      }
      this._tooltipActiveIcon = null;
      if (this._tooltipMoveHandler) {
        document.removeEventListener('mousemove', this._tooltipMoveHandler);
        this._tooltipMoveHandler = null;
      }
      const el = document.getElementById('ui-tooltip');
      if (el) {
        el.style.display = 'none';
        el.textContent = '';
      }
    },

    positionTooltip(pageX, pageY) {
      const el = document.getElementById('ui-tooltip');
      if (!el || el.style.display === 'none') return;
      const offset = 14;
      let left = pageX + offset;
      let top = pageY + offset;
      el.style.left = left + 'px';
      el.style.top = top + 'px';
      const rect = el.getBoundingClientRect();
      if (rect.right > window.innerWidth - 8) {
        left = pageX - rect.width - offset;
        el.style.left = Math.max(8, left) + 'px';
      }
      if (rect.bottom > window.innerHeight - 8) {
        top = pageY - rect.height - offset;
        el.style.top = Math.max(8, top) + 'px';
      }
    },

    showTooltip(text, pageX, pageY) {
      const el = document.getElementById('ui-tooltip');
      if (!el || !text) return;
      el.textContent = text;
      el.style.display = 'block';
      this.positionTooltip(pageX, pageY);
    },

    initTooltips() {
      if (!this._tooltipMousedownBound) {
        this._tooltipMousedownBound = true;
        document.addEventListener('mousedown', () => this.hideTooltip());
      }

      document.querySelectorAll('.info-icon').forEach(icon => {
        if (icon._tooltipInited) return;
        icon._tooltipInited = true;

        icon.addEventListener('mouseenter', (e) => {
          const key = icon.getAttribute('data-hint');
          const text = this.getHintText(key);
          if (!text) return;

          this._tooltipActiveIcon = icon;
          if (this._tooltipShowTimer) clearTimeout(this._tooltipShowTimer);

          this._tooltipShowTimer = setTimeout(() => {
            this._tooltipShowTimer = null;
            if (this._tooltipActiveIcon !== icon) return;
            this.showTooltip(text, e.pageX, e.pageY);

            if (this._tooltipMoveHandler) {
              document.removeEventListener('mousemove', this._tooltipMoveHandler);
            }
            this._tooltipMoveHandler = (ev) => this.positionTooltip(ev.pageX, ev.pageY);
            document.addEventListener('mousemove', this._tooltipMoveHandler);
          }, this._tooltipDelayMs);
        });

        icon.addEventListener('mouseleave', () => {
          if (this._tooltipActiveIcon === icon) this._tooltipActiveIcon = null;
          this.hideTooltip();
        });
      });
    },

    playAbilityHit(ability, effect) {
      const eff = effect || ability?.effect;
      const dt = eff && typeof eff === 'object' ? eff.damageType : null;
      const soundId = this.resolveSoundId(
        eff?.soundHit,
        ability?.soundHit,
        ability?.sounds?.hit,
        dt && this.resolveDamageTypeSound(dt),
        eff && typeof eff === 'object' && this.resolveEffectTypeSound(eff.type)
      );
      if (soundId) this.playCombatSound(soundId);
    },

    getConditionContext() {
      // questProgress = source of truth via QuestRuntime (ctx.engine).
      // questStages kept as legacy mirror snapshot for old condition JSON only.
      if (typeof QuestRuntime !== 'undefined') {
        QuestRuntime.bind(this);
      }
      return {
        flags: { ...(this.state.flags || {}) },
        inventory: [...(this.state.inventory || [])],
        gold: this.state.gold ?? 0,
        className: this.state.className || '',
        engine: this,
        questProgress: this.state.questProgress || {},
        questStages: { ...(this.state.questStages || {}) },
        quests: this.data?.quests || {}
      };
    },

    filterChoicesByConditions(choices) {
      if (!Array.isArray(choices)) return [];
      const ctx = this.getConditionContext();
      return choices.filter(c => ConditionSystem.isChoiceVisible(c, ctx));
    },

    getAttackSoundId(forWeaponId) {
      const cls = this.state.classData;
      const weaponId = forWeaponId || this.getEquippedItemId('weapon_main') || this.getEquippedWeaponId(cls);
      const weapon = weaponId ? this.itemsData[weaponId] : null;
      const attackDefaults = this.data?.audio?.defaults?.attack || {};
      return this.resolveSoundId(
        cls?.attackSound,
        weapon?.soundHit,
        weapon?.sound,
        weaponId && attackDefaults[weaponId],
        weaponId === 'staff' && attackDefaults.staff,
        weaponId === 'longsword' && attackDefaults.sword,
        weaponId === 'morningstar' && attackDefaults.blunt,
        attackDefaults.default,
        'slash_physical'
      );
    },

    escapeHtml(str) {
      return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    },

    escapeAttr(str) {
      return this.escapeHtml(str).replace(/"/g, '&quot;');
    },

    /** onclick="GameEngine.method(...)" — кавычки не ломают HTML-атрибут */
    onclickGame(method, ...args) {
      const expr = 'GameEngine.' + method + '(' + args.map(a => JSON.stringify(a)).join(', ') + ')';
      return 'onclick="' + this.escapeAttr(expr) + '"';
    },

    renderIcon(icon) {
      const value = String(icon || '').trim();
      if (!value) return '';
      const isImage = /^((https?:)?\/\/|\.\/|\/).+\.(png|jpe?g|gif|svg)$/i.test(value);
      if (isImage) {
        return `<img src="${this.escapeAttr(value)}" alt="icon" class="inline-icon">`;
      }
      return this.escapeHtml(value);
    },

    normalizeAbilities(abilities, classKey) {
      return (abilities || []).map((ab, i) => {
        if (typeof ab === 'string') {
          const def = this.resolveAbilityDefinition(ab) || { id: ab, name: ab, icon: '✨' };
          return this.normalizeAbility(def, classKey, i);
        }
        return this.normalizeAbility(ab, classKey, i);
      });
    },

    /** @deprecated use abilityActionTypeLabel() */
    get ABILITY_ACTION_TYPE_LABELS() {
      return {
        action: this.abilityActionTypeLabel('action'),
        bonus_action: this.abilityActionTypeLabel('bonus_action'),
        reaction: this.abilityActionTypeLabel('reaction'),
        passive: this.abilityActionTypeLabel('passive'),
        free: this.abilityActionTypeLabel('free')
      };
    },

    normalizeAbility(ab, classKey, index) {
      const copy = JSON.parse(JSON.stringify(ab || {}));
      if (!copy.id) copy.id = (classKey || 'hero') + '_ability_' + ((index ?? 0) + 1);
      if (copy.usage === 'combat') copy.combatOnly = true;
      if (copy.usage === 'world' || copy.usage === 'exploration') copy.combatOnly = false;
      if (typeof CombatManager !== 'undefined') {
        const system =
          this.data?.meta?.system === 'pf2e' || this.isPf2e?.() ? 'pf2e' : 'dnd5e';
        return CombatManager.parseAction(copy, { system });
      }
      return copy;
    },

    getAbilityPrimaryEffect(ab) {
      if (!ab) return null;
      if (ab.effect && typeof ab.effect === 'object') return ab.effect;
      if (Array.isArray(ab.effects) && ab.effects.length) return ab.effects[0];
      return null;
    },

    /** Тип действия умения (по умолчанию — action) */
    getAbilityActionType(ab) {
      if (!ab) return 'action';
      if (ab.actionType) return ab.actionType;
      if (ab.type === 'passive' || ab.passive) return 'passive';
      const eff = this.getAbilityPrimaryEffect(ab);
      if (eff?.type === 'smite' || (typeof ab.effect === 'string' && String(ab.effect).startsWith('smite'))) {
        return 'reaction';
      }
      return 'action';
    },

    getAbilityTrigger(ab) {
      if (!ab) return null;
      if (ab.trigger) return ab.trigger;
      if (this.getAbilityActionType(ab) === 'reaction') return 'after_player_hit';
      return null;
    },

    isAbilityPassiveAbility(ab) {
      return this.getAbilityActionType(ab) === 'passive' || ab?.type === 'passive' || !!ab?.passive;
    },

    getAbilityActionTypeBadge(ab) {
      const key = this.getAbilityActionType(ab);
      const label = this.ABILITY_ACTION_TYPE_LABELS[key] || key;
      return `[${label}]`;
    },

    /** Сброс действий в начале хода игрока */
    resetPlayerTurnEconomy() {
      if (!this.state.combat) return;
      this.state.combat.actionSpent = false;
      this.state.combat.bonusActionSpent = false;
      if (typeof CombatPosition !== 'undefined') {
        CombatPosition.resetTurnMovement(this);
      }
    },

    /** Занята ли концентрация другим заклинанием */
    isConcentrationBlockedFor(ability) {
      if (!this.isConcentrationAbility(ability)) return false;
      const conc = this.state.combat?.concentration;
      if (!conc) return false;
      return (conc.abilityId || conc.id) !== ability?.id;
    },

    /** Почему умение недоступно в бою (null = можно) */
    getAbilityMinLevel(ab) {
      const n = parseInt(ab?.minLevel, 10);
      return Number.isFinite(n) && n > 0 ? n : 1;
    },

    getAbilityUnavailableReason(ab) {
      if (!ab || !this.state.combat) return null;
      if ((this.state.level || 1) < this.getAbilityMinLevel(ab)) {
        return this._tr('game.ui.minLevel', { level: this.getAbilityMinLevel(ab) }, `Доступно с ${this.getAbilityMinLevel(ab)} уровня`);
      }
      if (this.getCombatPhase() !== 'player_turn') return this._tr('game.ui.notYourTurn', null, 'Не ваш ход');
      const actionType = this.getAbilityActionType(ab);
      if (actionType === 'passive') return null;
      if (actionType === 'reaction') return this._tr('game.ui.reactionTrigger', null, 'Срабатывает по триггеру');
      if (this.isSpellBlockedByCurse(ab)) return this._tr('game.ui.curseSilence', null, 'Проклятие безмолвия');
      if (!this.canAffordAbility(ab)) {
        const sl = this.getAbilitySpellLevel(ab);
        if (this.abilityUsesSpellSlots(ab)) {
          if (sl >= 1) return this._tr('game.ui.noSpellCircle', { level: sl }, `Нет ячеек ${sl} круга и выше`);
          const cost = parseInt(ab?.cost, 10) || 0;
          return cost > 1
            ? this._tr('game.ui.needSpellSlots', { cost }, `Нужно ${cost} свободных ячеек`)
            : this._tr('game.ui.noSpellSlots', null, 'Нет свободных ячеек');
        }
        const resName = this.state.classData?.resourceName || 'ресурса';
        return sl >= 1 && this.state.resources?.spellSlots?.[String(sl)]
          ? this._tr('game.ui.noSlotsCircle', { level: sl }, `Нет слотов ${sl} круга`)
          : this._tr('game.ui.notEnoughResource', { resource: resName }, `Недостаточно ${resName}`);
      }
      if (this.isConcentrationBlockedFor(ab)) return this._tr('game.ui.concentrationBusy', null, 'Концентрация занята');
      if (ab.oncePerCombat && this.state.combat.abilitiesUsed?.[ab.id]) return this._tr('game.ui.alreadyUsedCombat', null, 'Уже использовано в этом бою');
      if (actionType === 'action' && this.state.combat.actionSpent && !this.state.combat.actionSurge) {
        return this._tr('game.ui.actionSpent', null, 'Действие потрачено');
      }
      if (actionType === 'bonus_action' && this.state.combat.bonusActionSpent) {
        return this._tr('game.ui.bonusSpent', null, 'Бонусное действие потрачено');
      }
      if (typeof CombatManager !== 'undefined') {
        const cmReason = CombatManager.canPerformAction(this, ab);
        if (cmReason) return cmReason;
      }
      if (typeof CombatPosition !== 'undefined' && CombatPosition.isEnabled(this)) {
        const zoneReason = CombatPosition.getAbilityZoneUnavailableReason(this, ab);
        if (zoneReason) return zoneReason;
      }
      return null;
    },

    canOfferReactionAbility(ab) {
      if (!ab || this.getAbilityActionType(ab) !== 'reaction') return false;
      if (!this.state.combat?.reactionAvailable) return false;
      if (this.isSpellBlockedByCurse(ab)) return false;
      if (!this.canAffordAbility(ab)) return false;
      if (ab.oncePerCombat && this.state.combat.abilitiesUsed?.[ab.id]) return false;
      return true;
    },

    spendCombatActionType(actionType) {
      if (!this.state.combat) return;
      if (actionType === 'action') this.state.combat.actionSpent = true;
      if (actionType === 'bonus_action') this.state.combat.bonusActionSpent = true;
      if (actionType === 'reaction') this.state.combat.reactionAvailable = false;
    },

    buildCombatAbilityButton(ab, opts = {}) {
      const forceDisabled = !!opts.forceDisabled;
      const reason = forceDisabled
        ? (opts.disabledReason || this._tr('game.ui.unavailable', null, 'Недоступно'))
        : this.getAbilityUnavailableReason(ab);
      const disabled = forceDisabled || !!reason;
      const costLabel = this.getAbilityResourceCostLabel(ab);
      const title = this.escapeAttr(reason || ab.desc || '');
      const label = `${this.renderIcon(ab.icon)} ${this.escapeHtml(ab.name)} (${costLabel})`;
      if (disabled) {
        return `<button type="button" class="choice ability-choice" disabled style="opacity:0.55;cursor:not-allowed;" title="${title}">${label}</button>`;
      }
      return `<button type="button" class="choice ability-choice" ${this.onclickGame('useAbility', ab.id)} title="${title}">${label}</button>`;
    },

    renderCombatActionSection(title, buttonsHtml, opts = {}) {
      const showEmpty = !!opts.showEmpty;
      if (!buttonsHtml && !showEmpty) return '';
      const inner =
        buttonsHtml ||
        (showEmpty ? '<span class="combat-actions-empty">—</span>' : '');
      const col = opts.column ? ` combat-actions-section--${opts.column}` : '';
      const compact = opts.compact ? ' combat-actions-section--compact' : '';
      const inGrid = opts.column ? ' combat-actions-section--in-grid' : '';
      const inBar = opts.compact ? ' combat-actions-section--in-bar' : '';
      return (
        `<div class="combat-actions-section${col}${compact}${inGrid}${inBar}">` +
        `<div class="combat-actions-section-title">${title}</div>` +
        `<div class="combat-actions-section-buttons">${inner}</div></div>`
      );
    },

    /** Три колонки: атака | умения (действие) | бонус */
    renderCombatActionsGrid(columns) {
      const parts = (columns || []).filter(Boolean);
      if (!parts.length) return '';
      return `<div class="combat-actions-grid">${parts.join('')}</div>`;
    },

    getReactionAbilitiesForTrigger(trigger) {
      return (this.state.classData?.abilities || []).filter((ab) => {
        if (!ab?.id) return false;
        if (this.getAbilityActionType(ab) !== 'reaction') return false;
        return this.getAbilityTrigger(ab) === trigger;
      });
    },

    getSmiteDamageFormula(ability) {
      const eff = this.getAbilityPrimaryEffect(ability);
      if (eff?.type === 'smite' && eff.value) return String(eff.value);
      if (typeof ability?.effect === 'string' && ability.effect.startsWith('smite:')) {
        return ability.effect.slice(6);
      }
      return '2d8';
    },

    /** Модальное окно реакции (например, божественная кара после попадания) */
    promptReactionUse(ability, context) {
      const formula = this.getSmiteDamageFormula(ability);
      const bodyEl = document.getElementById('modal-body');
      const titleEl = document.getElementById('modal-title');
      if (!bodyEl || !titleEl) {
        this.finishPlayerAttackAfterReaction(context, false);
        return;
      }
      this._reactionPrompt = { ability, context };
      titleEl.textContent = `Использовать ${ability.name}?`;
      bodyEl.innerHTML = `
        <p>${this.escapeHtml(ability.desc || '')}</p>
        <p><strong>Добавить ${this.escapeHtml(formula)} урона излучением?</strong></p>
        <div class="reaction-prompt-actions" style="display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;">
          <button type="button" class="choice" onclick="GameEngine.confirmReactionPrompt(true)">Да</button>
          <button type="button" class="choice" onclick="GameEngine.confirmReactionPrompt(false)">Нет</button>
        </div>`;
      document.getElementById('modal')?.classList.remove('hidden');
    },

    confirmReactionPrompt(accept) {
      this.closeModal();
      const pending = this._reactionPrompt;
      this._reactionPrompt = null;
      if (!pending) return;
      if (accept) this.applyReactionSmite(pending.ability, pending.context);
      this.finishPlayerAttackAfterReaction(pending.context, !!accept);
    },

    applyReactionSmite(ability, context) {
      const enemy = context?.enemy || this.state.enemies?.[context?.enemyIndex];
      if (!enemy || enemy.hp <= 0) return;
      if (!this.canOfferReactionAbility(ability)) return;
      this.spendAbilityCost(ability);
      this.spendCombatActionType('reaction');
      if (ability.oncePerCombat) {
        if (!this.state.combat.abilitiesUsed) this.state.combat.abilitiesUsed = {};
        this.state.combat.abilitiesUsed[ability.id] = true;
      }
      const bonus = this.parseRoll(this.getSmiteDamageFormula(ability));
      enemy.hp -= bonus;
      this.log(`⚡ ${ability.name}: +${bonus} урона излучением по ${enemy.name}!`, 'log-damage');
      this.playCombatSound('smite_hit');
      this.renderCombat();
      this.updateStats();
    },

    tryOfferReactionAfterPlayerHit(enemyIndex, hitSucceeded) {
      if (!hitSucceeded || !this.state.combat) {
        this.finishPlayerAttackAfterReaction({ enemyIndex }, false);
        return;
      }
      const enemy = this.state.enemies[enemyIndex];
      const reactions = this.getReactionAbilitiesForTrigger('after_player_hit')
        .filter((ab) => this.canOfferReactionAbility(ab));
      if (!reactions.length) {
        this.finishPlayerAttackAfterReaction({ enemyIndex, enemy }, false);
        return;
      }
      const ability = reactions.find((a) => a.id === 'divine_smite') || reactions[0];
      this.promptReactionUse(ability, { enemyIndex, enemy, trigger: 'after_player_hit' });
    },

    finishPlayerAttackAfterReaction(context, usedReaction) {
      if (!this.state.combat) return;
      const enemy = context?.enemy || this.state.enemies?.[context?.enemyIndex];
      if (enemy && enemy.hp <= 0) {
        setTimeout(() => this.nextCombatTurn(), usedReaction ? 800 : 600);
        return;
      }
      if (this.state.combat.actionSurge) {
        this.state.combat.actionSurge = false;
        this.playerCombatTurn();
        return;
      }
      this.state.combat.turnIndex++;
      setTimeout(() => this.nextCombatTurn(), 600);
    },

    /** Слияние сохранённого умения с актуальным из game_data (старый + новый формат effect) */
    reconcileAbility(saved, def, classKey, index) {
      if (!def) return this.normalizeAbility(saved, classKey, index);
      const merged = { ...JSON.parse(JSON.stringify(def)), ...saved };
      const savedHasEffect = merged.effect != null || (merged.effects && merged.effects.length);
      if (!savedHasEffect) {
        if (def.effect != null) merged.effect = def.effect;
        if (def.effects) merged.effects = def.effects;
      } else if (typeof saved.effect === 'string' && def.effect && typeof def.effect === 'object') {
        merged.effect = def.effect;
      }
      if (def.passive && !merged.passive) merged.passive = def.passive;
      if (def.type && !merged.type) merged.type = def.type;
      if (def.targeting && !merged.targeting) merged.targeting = def.targeting;
      if (def.spellLevel != null && (merged.spellLevel == null || merged.spellLevel === '')) {
        merged.spellLevel = def.spellLevel;
      }
      if (def.cost != null && merged.cost == null) merged.cost = def.cost;
      if (def.concentration != null && merged.concentration == null) merged.concentration = def.concentration;
      if (def.actionType && !merged.actionType) merged.actionType = def.actionType;
      if (def.trigger && !merged.trigger) merged.trigger = def.trigger;
      return this.normalizeAbility(merged, classKey, index);
    },

    isConcentrationAbility(ability) {
      return !!(ability && ability.concentration === true);
    },

    reconcileAbilities(savedList, classKey) {
      const refs = this.data?.classes?.[classKey]?.abilities || [];
      const defById = {};
      refs.forEach((r) => {
        if (typeof r === 'string') {
          const d = this.resolveAbilityDefinition(r);
          if (d) defById[r] = d;
        } else if (r && r.id) {
          defById[r.id] = this.resolveAbilityDefinition(r.id) || r;
        }
      });
      const pool = this.getProgression().abilities || {};
      return (savedList || []).map((saved, i) => {
        const sid = typeof saved === 'string' ? saved : saved?.id;
        const def = (sid && defById[sid]) || (sid && pool[sid]) || null;
        const savedObj = typeof saved === 'string' ? { id: saved } : saved;
        return this.reconcileAbility(savedObj, def, classKey, i);
      });
    },

    isAbilityCombatOnly(ab) {
      if (ab.combatOnly === true) return true;
      if (ab.combatOnly === false) return false;
      return ab.usage === 'combat';
    },

    applyAcBonus(bonus) {
      if (!this.state.combat) return;
      const b = parseInt(bonus, 10) || 0;
      if (b === 4) {
        this.state.combat.shieldBlock = true;
        this.log('🛡️ +4 КД до вашего следующего хода', 'log-combat');
      } else if (b === 5) {
        this.state.combat.shieldSpell = true;
        this.log('🔰 +5 КД против следующей атаки', 'log-combat');
      } else if (b === 2) {
        this.state.combat.shieldOfFaith = true;
        this.log('🛡️ +2 КД', 'log-combat');
      } else {
        this.state.combat.tempAcBonus = (this.state.combat.tempAcBonus || 0) + b;
        this.log(`🛡️ +${b} КД до следующего хода`, 'log-combat');
      }
    },

    formatDamageLabel(dmgRoll, dmgBonus) {
      const roll = dmgRoll || '1d6';
      const bonus = dmgBonus ?? 0;
      return bonus ? `${roll}+${bonus}` : roll;
    },

    getExpThreshold(level) {
      const table = this.getProgression().expTable || [0];
      const idx = Math.max(0, (level || 1) - 1);
      return table[idx] ?? table[table.length - 1] ?? 0;
    },

    getMaxLevel() {
      const pg = this.getProgression();
      return pg.maxLevel || pg.expTable?.length || 1;
    },

    getExpToNextLevel() {
      if (!this.isProgressionEnabled()) return 0;
      if (this.state.level >= this.getMaxLevel()) return 0;
      return Math.max(0, this.getExpThreshold(this.state.level + 1) - this.state.exp);
    },

    /** Сумма stats из progression.levels (2…текущий уровень), напр. +1 атаки на 3 ур. */
    collectProgressionLevelBonuses() {
      const totals = { atkBonus: 0, acBonus: 0 };
      const level = parseInt(this.state.level, 10) || 1;
      if (level < 2) return totals;
      for (let lv = 2; lv <= level; lv++) {
        const cfg = this.getClassLevelConfig(lv);
        const st = cfg?.stats;
        if (!st) continue;
        if (st.atkBonus != null) totals.atkBonus += parseInt(st.atkBonus, 10) || 0;
        if (st.ac != null) totals.acBonus += parseInt(st.ac, 10) || 0;
      }
      return totals;
    },

    getClassLevelConfig(level) {
      const cls = this.data?.classes?.[this.state.className];
      return cls?.progression?.levels?.[String(level)] || cls?.progression?.levels?.[level] || null;
    },

    /** Массив ячеек по уровню персонажа (D&D 5e tables в progression.levels / baseSlots) */
    getSlotsArrayForLevel(classKey, level) {
      const cls = this.data?.classes?.[classKey];
      if (!cls) return null;
      let best = null;
      if (level >= 1 && Array.isArray(cls.baseSlots) && cls.baseSlots.length) {
        best = cls.baseSlots;
      }
      for (let l = 1; l <= level; l++) {
        const slots = cls.progression?.levels?.[String(l)]?.slots;
        if (Array.isArray(slots) && slots.length) best = slots;
      }
      return best;
    },

    getResourceMode(classKey, level) {
      if (this.activeSystem?.getResourceMode) {
        return this.activeSystem.getResourceMode(classKey, level, this.data, this);
      }
      const cls = this.data?.classes?.[classKey];
      if (!cls) return 'energy';
      if (cls.pactMagic) return 'spellSlots';
      const lvl = level ?? this.state.level ?? 1;
      const slots = this.getSlotsArrayForLevel(classKey, lvl);
      if (!slots || !slots.length) return 'energy';
      if (cls.spellcasting && slots.length >= 1) return 'spellSlots';
      if (cls.halfCaster && lvl >= 2 && slots.length >= 1) return 'spellSlots';
      if (slots.length === 1 && !cls.spellcasting && !cls.halfCaster) return 'energy';
      if (slots.length > 1) return 'spellSlots';
      return 'energy';
    },

    buildSpellSlotsFromArray(slotsArray) {
      const out = {};
      (slotsArray || []).forEach((max, i) => {
        const n = Number(max) || 0;
        if (n > 0) out[String(i + 1)] = { c: n, m: n };
      });
      return out;
    },

    initResourcesFromLevel(level) {
      const classKey = this.state.className;
      if (!classKey || !this.data?.classes?.[classKey]) {
        this.state.resources = { mode: 'energy', current: 0, max: 0, spellSlots: null };
        return;
      }
      if (this.activeSystem?.initResources && this.activeSystem.id === 'pf2e') {
        this.state.resources = this.activeSystem.initResources(classKey, level, this.data, this);
        return;
      }
      const cls = this.data.classes[classKey];
      const mode = this.getResourceMode(classKey, level);
      if (cls.pactMagic) {
        const pact = this.getWarlockPactSlots(level);
        this.state.resources = {
          mode: 'spellSlots',
          spellSlots: this.buildWarlockSpellSlots(level),
          pactLevel: pact.slotLevel,
          current: 0,
          max: 0
        };
      } else if (mode === 'spellSlots') {
        const arr = this.getSlotsArrayForLevel(classKey, level) || [2];
        this.state.resources = {
          mode: 'spellSlots',
          spellSlots: this.buildSpellSlotsFromArray(arr),
          current: 0,
          max: 0
        };
      } else {
        const max = Math.max(0, this.getClassResourceMax(classKey, level));
        this.state.resources = {
          mode: 'energy',
          current: max,
          max,
          spellSlots: null
        };
      }
    },

    applyLevelResources(level) {
      this.initResourcesFromLevel(level);
      this.renderSpellSlotsPanel();
    },

    restoreAllResources() {
      const r = this.state.resources;
      if (!r) return;
      if (r.mode === 'spellSlots' && r.spellSlots) {
        Object.values(r.spellSlots).forEach(slot => {
          slot.c = slot.m;
        });
      } else if (r.mode === 'focus') {
        r.current = r.max ?? 0;
      } else {
        r.current = r.max ?? 0;
      }
    },

    migrateResourcesState() {
      const r = this.state.resources;
      if (!r || !this.state.className) return;
      if (r.spellSlots && typeof r.spellSlots === 'object') {
        r.mode = r.mode || 'spellSlots';
        return;
      }
      if (r.mode === 'spellSlots') return;
      const hasLegacy = r.max != null && r.current != null && !r.spellSlots;
      if (hasLegacy && this.getResourceMode(this.state.className, this.state.level) === 'spellSlots') {
        this.initResourcesFromLevel(this.state.level || 1);
        return;
      }
      if (!r.mode) {
        r.mode = 'energy';
        if (r.max == null) r.max = r.current ?? 2;
        if (r.current == null) r.current = r.max;
      }
    },

    getAbilitySpellLevel(ability) {
      if (!ability) return 0;
      const sl = ability.spellLevel;
      if (sl == null || sl === '' || sl === false) return 0;
      const n = parseInt(sl, 10);
      return Number.isFinite(n) && n >= 1 && n <= 5 ? n : 0;
    },

    /** Круг ячейки, которым фактически кастуют (после выбора усиления) */
    getCastSlotLevel(ability) {
      const cast = ability?._castSlotLevel ?? ability?.castSlotLevel;
      const n = parseInt(cast, 10);
      if (Number.isFinite(n) && n >= 1) return n;
      return this.getAbilitySpellLevel(ability);
    },

    withCastSlotLevel(ability, level) {
      return { ...ability, _castSlotLevel: level };
    },

    getUpcastLevelsAboveBase(ability) {
      const min = this.getAbilitySpellLevel(ability);
      const cast = this.getCastSlotLevel(ability);
      return Math.max(0, cast - min);
    },

    /** Доступные круги ячеек для каста (от базового круга заклинания и выше, где есть c > 0) */
    getAvailableCastLevels(ability) {
      if (!this.abilityUsesSpellSlots(ability)) return [];
      const min = this.getAbilitySpellLevel(ability);
      if (min < 1) return [];
      const slots = this.state.resources?.spellSlots || {};
      const levels = [];
      for (const key of Object.keys(slots).sort((a, b) => Number(a) - Number(b))) {
        const lv = Number(key);
        if (!Number.isFinite(lv) || lv < min) continue;
        const slot = slots[key];
        if (slot && slot.c > 0) levels.push(lv);
      }
      return levels;
    },

    canAffordAbilityAtLevel(ability, level) {
      if (this.isSpellBlockedByCurse(ability)) return false;
      if (this.abilityUsesSpellSlots(ability)) {
        const min = this.getAbilitySpellLevel(ability);
        if (level < min) return false;
        const slot = this.state.resources?.spellSlots?.[String(level)];
        return !!(slot && slot.c > 0);
      }
      return this.canAffordAbility(ability);
    },

    needsCastLevelChoice(ability) {
      return this.getAvailableCastLevels(ability).length > 1;
    },

    promptSpellSlotLevel(ability, levels, onPick) {
      const bodyEl = document.getElementById('modal-body');
      const titleEl = document.getElementById('modal-title');
      if (!bodyEl || !titleEl) {
        onPick(levels[0]);
        return;
      }
      this._castLevelPrompt = { ability, onPick };
      const min = this.getAbilitySpellLevel(ability);
      titleEl.textContent = `Ячейка заклинания: ${ability.name || ''}`;
      const btns = levels.map((lv) => {
        const left = this.state.resources?.spellSlots?.[String(lv)]?.c ?? 0;
        const upNote = lv > min ? ` — усиление +${lv - min}` : '';
        return `<button type="button" class="choice" ${this.onclickGame('confirmCastLevelPick', lv)}>Круг ${lv} (свободно: ${left})${this.escapeHtml(upNote)}</button>`;
      }).join('');
      bodyEl.innerHTML = `
        <p>Базовый круг заклинания: <b>${min}</b>. Выберите, какой ячейкой творить:</p>
        <div style="display:flex;flex-direction:column;gap:8px;margin:12px 0;">${btns}</div>
        <button type="button" class="choice" onclick="GameEngine.cancelCastLevelPick()">Отмена</button>`;
      document.getElementById('modal')?.classList.remove('hidden');
    },

    confirmCastLevelPick(level) {
      this.closeModal();
      const pending = this._castLevelPrompt;
      this._castLevelPrompt = null;
      if (!pending) return;
      const lv = parseInt(level, 10);
      if (!this.canAffordAbilityAtLevel(pending.ability, lv)) {
        this.log('❌ Нет свободной ячейки этого круга.', 'log-damage');
        return;
      }
      pending.onPick(lv);
    },

    cancelCastLevelPick() {
      this.closeModal();
      this._castLevelPrompt = null;
    },

    continueUseAbility(ability, castLevel) {
      const sl = this.getAbilitySpellLevel(ability);
      if (sl >= 1) {
        const lv = castLevel ?? this.getAvailableCastLevels(ability)[0] ?? sl;
        if (!this.canAffordAbilityAtLevel(ability, lv)) {
          this.log('❌ Нет свободной ячейки для этого круга.', 'log-damage');
          return;
        }
        const prepared = this.withCastSlotLevel(ability, lv);
        if (this.abilityRequiresEnemyTarget(prepared)) {
          this.beginAbilityTargetSelect(prepared);
          return;
        }
        this.executeAbility(prepared, null);
        return;
      }
      if (!this.canAffordAbility(ability)) {
        this.log('❌ Недостаточно ресурса!', 'log-damage');
        return;
      }
      if (this.abilityRequiresEnemyTarget(ability)) {
        this.beginAbilityTargetSelect(ability);
        return;
      }
      this.executeAbility(ability, null);
    },

    /** Предмет помечен как проклятый в данных */
    isItemCursed(db) {
      return db?.cursed === true;
    },

    /** ID эффектов проклятия предмета */
    getItemCurseEffects(db) {
      const arr = db?.curseEffects;
      return Array.isArray(arr) ? arr.filter(Boolean) : [];
    },

    /** Сцена снятия проклятия (дефолт — храм) */
    getCurseRemoveSceneId(db) {
      const id = db?.curseRemoveScene;
      if (id && String(id).trim()) return String(id).trim();
      return 'temple_priest';
    },

    getSceneDisplayName(sceneId) {
      const scene = this.data?.scenes?.[sceneId];
      return scene?.location || scene?.name || sceneId || '—';
    },

    /** Человекочитаемый список эффектов проклятия */
    formatCurseEffectsList(dbOrEffects) {
      const ids = Array.isArray(dbOrEffects)
        ? dbOrEffects
        : this.getItemCurseEffects(dbOrEffects);
      return ids.map(id => this.CURSE_EFFECT_DEFS[id]?.label || id).join(', ') || '—';
    },

    hasCurseEffect(effectId) {
      return !!this.state.curseEffects?.[effectId];
    },

    isSilencedByCurse() {
      return this.hasCurseEffect('silence');
    },

    isSpellBlockedByCurse(ability) {
      return this.isSilencedByCurse() && this.getAbilitySpellLevel(ability) >= 1;
    },

    /** Пересчёт активных проклятий по надетой экипировке */
    recalculateCurseEffectsFromEquipment() {
      const next = {};
      this.EQUIPMENT_SLOTS.forEach(slot => {
        const itemId = this.getEquippedItemId(slot);
        if (!itemId) return;
        const db = this.itemsData[itemId];
        if (!this.isItemCursed(db)) return;
        this.getItemCurseEffects(db).forEach(eff => { next[eff] = true; });
      });
      this.state.curseEffects = next;
      this.renderCurseEffectsPanel();
    },

    /** Миграция старых сохранений: curseEffects в state */
    migrateCurseState() {
      if (!this.state.curseEffects || typeof this.state.curseEffects !== 'object') {
        this.state.curseEffects = {};
      }
      this.recalculateCurseEffectsFromEquipment();
    },

    getEquippedCursedEntries() {
      const out = [];
      this.EQUIPMENT_SLOTS.forEach(slot => {
        const itemId = this.getEquippedItemId(slot);
        if (!itemId) return;
        const db = this.itemsData[itemId];
        if (!this.isItemCursed(db)) return;
        out.push({
          slot,
          itemId,
          item: db,
          cost: Math.max(0, parseInt(db.curseRemoveCost, 10) || 0)
        });
      });
      return out;
    },

    /** Попытка снять экипировку: проклятые предметы блокируются */
    canUnequipItem(itemId) {
      const db = this.itemsData[itemId];
      if (!this.isItemCursed(db)) return true;
      const sceneId = this.getCurseRemoveSceneId(db);
      const sceneName = this.getSceneDisplayName(sceneId);
      this.showCurseUnequipBlockedModal(db?.name || itemId, sceneName);
      return false;
    },

    showAlertModal(title, bodyHtml) {
      const titleEl = document.getElementById('modal-title');
      const bodyEl = document.getElementById('modal-body');
      if (!titleEl || !bodyEl) return;
      titleEl.textContent = title;
      bodyEl.innerHTML = bodyHtml;
      document.getElementById('modal')?.classList.remove('hidden');
    },

    showCurseUnequipBlockedModal(itemName, sceneName) {
      const safeName = this.escapeHtml(itemName);
      const safeScene = this.escapeHtml(sceneName);
      this.showAlertModal(
        '⚠️ Проклятый предмет',
        `<p>Предмет <b>${safeName}</b> проклят. Снять можно только у священника в сцене «${safeScene}».</p>
         <p style="margin-top:12px;"><button type="button" class="btn btn-primary" onclick="GameEngine.closeModal()">Понятно</button></p>`
      );
    },

    isClassSpellcaster() {
      const cls = this.data?.classes?.[this.state.className];
      return !!(cls?.spellcasting || cls?.halfCaster);
    },

    /** Режим ячеек заклинаний (полный или полукастер) */
    isSpellSlotResourceMode() {
      const r = this.state.resources;
      if (!r?.spellSlots || typeof r.spellSlots !== 'object') return false;
      if (r.mode === 'spellSlots') return true;
      return this.isClassSpellcaster() && Object.values(r.spellSlots).some((s) => (s?.m ?? 0) > 0);
    },

    getTotalSpellSlotCharges() {
      if (!this.isSpellSlotResourceMode()) return 0;
      return Object.values(this.state.resources.spellSlots).reduce(
        (sum, slot) => sum + Math.max(0, parseInt(slot?.c, 10) || 0),
        0
      );
    },

    spendSpellSlotCharges(amount) {
      let left = Math.max(0, parseInt(amount, 10) || 0);
      if (!left || !this.isSpellSlotResourceMode()) return;
      const slots = this.state.resources.spellSlots;
      const keys = Object.keys(slots).sort((a, b) => Number(a) - Number(b));
      for (const key of keys) {
        while (left > 0 && slots[key]?.c > 0) {
          slots[key].c--;
          left--;
        }
        if (left <= 0) break;
      }
    },

    /** Умение оплачивается ячейками, а не пулом energy.current */
    abilityUsesSpellSlots(ability) {
      if (!this.isSpellSlotResourceMode()) return false;
      const spellLevel = this.getAbilitySpellLevel(ability);
      if (spellLevel >= 1) return true;
      const cost = parseInt(ability?.cost, 10) || 0;
      return cost > 0 && this.isClassSpellcaster();
    },

    getAbilityResourceCostLabel(ability) {
      const sl = this.getAbilitySpellLevel(ability);
      if (this.abilityUsesSpellSlots(ability)) {
        if (sl >= 1) return `круг ${sl}`;
        const cost = parseInt(ability?.cost, 10) || 0;
        if (cost <= 1) return '1 ячейка';
        return `${cost} ${cost < 5 ? 'ячейки' : 'ячеек'}`;
      }
      const resName = this.state.classData?.resourceName || 'ресурс';
      return sl >= 1 ? `круг ${sl}` : `${ability?.cost ?? 0} ${resName}`;
    },

    canAffordAbility(ability) {
      if (this.isSpellBlockedByCurse(ability)) return false;
      if (this.abilityUsesSpellSlots(ability)) {
        const spellLevel = this.getAbilitySpellLevel(ability);
        if (spellLevel >= 1) {
          if (this.getAvailableCastLevels(ability).length === 0) return false;
        } else {
          const cost = parseInt(ability?.cost, 10) || 0;
          if (this.getTotalSpellSlotCharges() < cost) return false;
        }
      } else {
        const spellLevel = this.getAbilitySpellLevel(ability);
        if (spellLevel >= 1 && this.isSpellSlotResourceMode()) {
          const slot = this.state.resources?.spellSlots?.[String(spellLevel)];
          if (!slot || slot.c <= 0) return false;
        } else {
          const cost = ability?.cost ?? 0;
          if ((this.state.resources?.current ?? 0) < cost) return false;
        }
      }
      if (this.isPf2e() && this.state.combat) {
        let actionCost = ability?.cost ?? 1;
        if (typeof CombatManager !== 'undefined' && ability.actionCost?.actions != null) {
          actionCost = ability.actionCost.actions;
        } else if (
          typeof CombatManager !== 'undefined' &&
          ability.actionCost &&
          !ability._combatParsed
        ) {
          const parsed = CombatManager.parseAction(ability, {
            system: 'pf2e'
          });
          actionCost = parsed.actionCost?.actions ?? actionCost;
        }
        return (this.state.combat.actionsRemaining ?? 0) >= actionCost;
      }
      return true;
    },

    spendAbilityCost(ability) {
      if (this.abilityUsesSpellSlots(ability)) {
        const spellLevel = this.getAbilitySpellLevel(ability);
        if (spellLevel >= 1) {
          const key = String(this.getCastSlotLevel(ability));
          const slot = this.state.resources?.spellSlots?.[key];
          if (slot && slot.c > 0) slot.c--;
        } else {
          this.spendSpellSlotCharges(ability?.cost ?? 0);
        }
      } else {
        const spellLevel = this.getAbilitySpellLevel(ability);
        if (spellLevel >= 1 && this.isSpellSlotResourceMode()) {
          const key = String(spellLevel);
          const slot = this.state.resources?.spellSlots?.[key];
          if (slot && slot.c > 0) slot.c--;
        } else {
          const cost = ability?.cost ?? 0;
          if (this.state.resources) {
            this.state.resources.current = Math.max(0, (this.state.resources.current ?? 0) - cost);
          }
        }
      }
      if (this.isPf2e() && this.state.combat) {
        if (!ability._skipPf2eActionSpend) {
          const actions =
            ability.actionCost?.actions ?? ability?.cost ?? 1;
          this.spendPf2eActions(actions);
        }
        this.renderSpellSlotsPanel();
        return;
      }
      this.renderSpellSlotsPanel();
    },

    renderSpellSlotsPanel() {
      const panel = document.getElementById('spell-slots-panel');
      const legacy = document.getElementById('resources');
      const r = this.state.resources;
      if (!panel) return;

      if (r?.mode === 'focus') {
        panel.innerHTML = '';
        if (legacy) {
          legacy.textContent = `Focus ${r.current ?? 0}/${r.max ?? 0}`;
          legacy.classList.remove('hidden');
        }
        return;
      }

      if (!r || r.mode !== 'spellSlots' || !r.spellSlots) {
        panel.innerHTML = '';
        if (legacy) {
          if (r && r.mode === 'energy') {
            legacy.textContent = (r.current ?? 0) + '/' + (r.max ?? 0);
            legacy.classList.remove('hidden');
          } else {
            legacy.classList.add('hidden');
          }
        }
        if (r?.mode === 'energy' && (r.max ?? 0) > 0) {
          const cls = this.data?.classes?.[this.state.className];
          const icon = cls?.resource?.icon || '⚡';
          const label = this.escapeHtml(this.state.classData?.resourceName || 'Энергия');
          const dots = [];
          for (let i = 0; i < r.max; i++) {
            dots.push(`<span class="spell-slot-dot ${i < r.current ? 'active' : 'spent'}" title="${i < r.current ? 'доступно' : 'потрачено'}"></span>`);
          }
          panel.innerHTML = `<div class="spell-slot-row"><span class="spell-slot-label">${icon} ${label}</span><div class="spell-slot-dots">${dots.join('')}</div></div>`;
        }
        return;
      }

      if (legacy) legacy.classList.add('hidden');
      const cls = this.data?.classes?.[this.state.className];
      const pactLabel = cls?.pactMagic && r.pactLevel
        ? `💎 ${this.escapeHtml(this.state.classData?.resourceName || 'Ячейки')} (${r.pactLevel} кр.)`
        : null;
      const keys = Object.keys(r.spellSlots).sort((a, b) => Number(a) - Number(b));
      panel.innerHTML = keys.map(circle => {
        const slot = r.spellSlots[circle];
        const max = slot.m ?? 0;
        const cur = slot.c ?? 0;
        const dots = [];
        for (let i = 0; i < max; i++) {
          dots.push(`<span class="spell-slot-dot ${i < cur ? 'active' : 'spent'}" title="${i < cur ? 'доступно' : 'потрачено'}"></span>`);
        }
        const rowLabel = pactLabel || `Круг ${circle}`;
        return `<div class="spell-slot-row"><span class="spell-slot-label">${rowLabel}</span><div class="spell-slot-dots">${dots.join('')}</div></div>`;
      }).join('');
    },

    resolveAbilityDefinition(abilityId) {
      if (!abilityId) return null;
      const pool = this.getProgression().abilities || {};
      if (pool[abilityId]) return JSON.parse(JSON.stringify(pool[abilityId]));
      // Legacy: встроенные объекты в классах (до миграции v4)
      for (const cls of Object.values(this.data?.classes || {})) {
        const found = (cls.abilities || []).find(
          (a) => a && typeof a === 'object' && a.id === abilityId
        );
        if (found) return JSON.parse(JSON.stringify(found));
      }
      return null;
    },

    initProgressionState() {
      this.state.level = 1;
      this.state.exp = 0;
      this.state.expAwarded = {};
      this.state.pendingLevelUp = null;
      this.state.resumeAfterLevelUp = null;
    },

    resumeAfterLevelUp() {
      if (this.state.pendingLevelUp) return;
      const resume = this.state.resumeAfterLevelUp;
      if (!resume) return;
      this.state.resumeAfterLevelUp = null;
      if (resume.type === 'scene' && resume.id) {
        this.showScene(resume.id);
      }
    },

    renderLevelBar() {
      const levelEl = document.getElementById('char-level');
      const xpText = document.getElementById('xp-text');
      const xpFill = document.getElementById('xp-bar-fill');
      const panel = document.getElementById('level-panel');
      if (!panel) return;

      if (!this.isProgressionEnabled()) {
        panel.classList.add('hidden');
        return;
      }
      panel.classList.remove('hidden');

      const level = this.state.level || 1;
      const maxLevel = this.getMaxLevel();
      if (levelEl) levelEl.textContent = level;

      if (level >= maxLevel) {
        if (xpText) xpText.textContent = this._tr('game.ui.maxLevel', null, 'Макс. уровень');
        if (xpFill) xpFill.style.width = '100%';
        return;
      }

      const curThreshold = this.getExpThreshold(level);
      const nextThreshold = this.getExpThreshold(level + 1);
      const span = Math.max(1, nextThreshold - curThreshold);
      const progress = Math.max(0, Math.min(1, (this.state.exp - curThreshold) / span));

      if (xpText) xpText.textContent = `${this.state.exp} / ${nextThreshold}`;
      if (xpFill) xpFill.style.width = (progress * 100) + '%';
    },

    addExp(amount, reason) {
      if (!this.isProgressionEnabled() || !amount || amount <= 0) return;
      if (this.state.level >= this.getMaxLevel()) return;

      this.state.exp += amount;
      this.log(`⭐ +${amount} опыта${reason ? ' — ' + reason : ''}`, 'log-dice');
      this.renderLevelBar();
      this.checkLevelUp();
      this.updateStats();
      this.saveGame();
    },

    grantExpOnce(key, amount, reason) {
      if (!key || !this.isProgressionEnabled()) return;
      if (this.state.expAwarded[key]) return;
      this.state.expAwarded[key] = true;
      this.addExp(amount, reason);
    },

    getSkillCheckExp(skill, skillCheck) {
      const pg = this.getProgression();
      if (skillCheck?.exp != null) return skillCheck.exp;
      if (pg.skillExp?.[skill] != null) return pg.skillExp[skill];
      if (pg.defaults?.skillCheckExp != null) return pg.defaults.skillCheckExp;
      return 15;
    },

    awardSkillCheckExp(skill, skillCheck) {
      const exp = this.getSkillCheckExp(skill, skillCheck);
      const once = skillCheck?.expOnce !== false;
      const key = skillCheck?.expKey || `skill:${this.state.scene}:${skill}`;
      if (once) this.grantExpOnce(key, exp, 'успешная проверка');
      else this.addExp(exp, 'успешная проверка');
    },

    awardSceneExp(scene) {
      if (!scene?.exp) return;
      this.grantExpOnce(`scene:${scene.id}`, scene.exp, 'сцена');
    },

    awardQuestExp(questId) {
      const quest = this.data?.quests?.[questId];
      const exp = quest?.rewards?.exp;
      if (!exp) return;
      this.grantExpOnce(`quest:${questId}:complete`, exp, `квест «${quest.title}»`);
    },

    /**
     * Текущая стадия квеста: приоритет state.questStages, затем legacy-флаг quest_<id>.
     */
    getQuestStage(questId) {
      if (!questId) return null;
      if (typeof QuestRuntime !== 'undefined') {
        QuestRuntime.bind(this);
        const key = QuestRuntime.getStageKey(questId);
        if (key != null) return key;
      }
      const direct = this.state.questStages?.[questId];
      if (direct != null && direct !== '') return String(direct);
      const legacy = this.state.flags?.['quest_' + questId];
      if (legacy == null || legacy === '') return null;
      const quest = this.data?.quests?.[questId];
      if (quest && typeof QuestRuntime !== 'undefined') {
        return QuestRuntime.resolveStageRef(quest, legacy);
      }
      return String(legacy);
    },

    /** Квест завершён: стадия __finished__, legacy complete или текущая стадия с finish: true */
    isQuestFinished(questId) {
      if (typeof QuestRuntime !== 'undefined') {
        QuestRuntime.bind(this);
        if (QuestRuntime.isCompleted(questId)) return true;
      }
      const s = this.state.questStages?.[questId];
      if (s === '__finished__') return true;
      if (this.state.flags?.['quest_' + questId] === 'complete') return true;
      const quest = this.data?.quests?.[questId];
      if (!quest || s == null || s === '') return false;
      const st = QuestRuntime.getStageData(quest, s);
      return !!st?.finish;
    },

    /** Квест провален */
    isQuestFailed(questId) {
      if (typeof QuestRuntime !== 'undefined') {
        QuestRuntime.bind(this);
        if (QuestRuntime.isFailed(questId)) return true;
      }
      const s = this.state.questStages?.[questId];
      if (s === '__failed__') return true;
      if (this.state.flags?.['quest_' + questId] === 'failed') return true;
      const quest = this.data?.quests?.[questId];
      if (!quest || s == null || s === '') return false;
      return QuestRuntime.isStageFailed(quest, s);
    },

    /**
     * Провал квеста: стадия с failed: true или ссылка "failed" / __failed__.
     * @param {string} questId
     * @param {string} [stageRef='failed']
     */
    failQuest(questId, stageRef = 'failed', opts = {}) {
      this.updateQuest(questId, stageRef, opts);
    },

    /** Синхронизация legacy-флага quest_* для старых условий и сцен */
    syncLegacyQuestFlag(questId, stageKey) {
      const quest = this.data?.quests?.[questId];
      let legacyVal = stageKey;
      if (quest?.legacyStageMap) {
        const entry = Object.entries(quest.legacyStageMap).find(([, v]) => String(v) === String(stageKey));
        if (entry) legacyVal = entry[0];
      }
      this.state.flags['quest_' + questId] = legacyVal;
    },


    /**
     * Обновляет стадию квеста, пишет log в журнал боя, обновляет сайдбар «Активные задания».
     * @param {string} questId — ID из data.quests
     * @param {string|number} stage — ключ стадии ("0") или legacy ("start", "complete")
     * @param {{ silentLog?: boolean, skipFinish?: boolean }} opts
     */

    /**
     * Generic scene object interaction → ObjectInteracted (quest tasks), optional chain.
     */
    interactSceneObject(objectId, chainId) {
      if (typeof QuestEvents !== 'undefined') {
        QuestEvents.emit('ObjectInteracted', {
          objectId: objectId || null,
          id: objectId || null,
          sceneId: this.state?.scene || null
        });
      }
      if (chainId && typeof this.executeChain === 'function') {
        this.executeChain(chainId);
      }
    },

    updateQuest(questId, stage, opts = {}) {
      if (!questId || !this.data?.quests?.[questId]) return;
      if (typeof QuestRuntime === 'undefined') return;
      QuestRuntime.bind(this);
      QuestRuntime.setStage(questId, stage, opts || {});
    },

    /**
     * Открывает точки карты из stage.mapUnlocks / stage.unlockMapLocations (data-driven).
     */
    applyQuestMapUnlocks(questId, stageKey) {
      if (!this.state.visitedLocations) this.state.visitedLocations = {};
      const quest = this.data?.quests?.[questId];
      if (!quest?.stages) return;
      let stage = null;
      if (Array.isArray(quest.stages)) {
        const idx = Number(stageKey);
        stage = Number.isFinite(idx) ? quest.stages[idx] : quest.stages.find((s) => s && (s.id === stageKey || String(s.legacyId) === String(stageKey)));
      } else {
        stage = quest.stages[String(stageKey)];
      }
      const unlocks = stage?.mapUnlocks || stage?.unlockMapLocations || [];
      (Array.isArray(unlocks) ? unlocks : []).forEach((locId) => {
        if (locId) this.state.visitedLocations[locId] = true;
      });
      if (typeof this.renderTravelMenu === 'function') this.renderTravelMenu();
    },

    awardCombatExp(enemyIds, expKey) {
      if (!enemyIds?.length) return;
      const defaults = this.getProgression().defaults || {};
      let total = 0;
      enemyIds.forEach(id => {
        const enemy = this.data?.enemies?.[id];
        total += enemy?.exp ?? defaults.enemyExp ?? 0;
      });
      if (total <= 0) return;
      const key = expKey || `combat:${this.state.scene}`;
      this.grantExpOnce(key, total, 'победа в бою');
    },

    /**
     * Бросок таблицы loot по ID врагов из боя (все участники, включая убитых).
     * Возвращает [{ item, qty }, ...]; item === 'gold' — золото.
     */
    rollCombatLootFromEnemies(enemyIds) {
      const result = [];
      const byItem = new Map();
      const enemiesData = this.data?.enemies || {};

      (enemyIds || []).forEach(enemyId => {
        const template = enemiesData[enemyId];
        const table = template?.loot;
        if (!Array.isArray(table) || !table.length) return;

        table.forEach(entry => {
          const chance = Number(entry.chance);
          if (!entry.item || isNaN(chance) || chance <= 0) return;
          if (Math.random() >= chance) return;

          const min = Math.max(0, parseInt(entry.min, 10) || 0);
          const max = Math.max(min, parseInt(entry.max, 10) ?? min);
          let qty = min;
          if (max > min) {
            qty = min + Math.floor(Math.random() * (max - min + 1));
          }
          if (qty <= 0) return;

          const prev = byItem.get(entry.item) || 0;
          byItem.set(entry.item, prev + qty);
        });
      });

      byItem.forEach((qty, item) => result.push({ item, qty }));
      return result;
    },

    /** Подпись строки добычи для окна */
    formatLootEntryLabel(entry) {
      if (entry.item === 'gold') {
        return `${entry.qty} зм`;
      }
      const db = this.itemsData[entry.item] || this.data?.items?.[entry.item];
      const name = db?.name || entry.item;
      if (entry.qty > 1) return `${name} ×${entry.qty}`;
      return name;
    },

    /** Окно добычи после победы; награды сцены — после перехода на nextScene */
    showCombatLootModal(tempLoot, nextScene, combatSnapshot) {
      this.state.pendingCombatLoot = {
        loot: tempLoot,
        nextScene: nextScene || null,
        combat: combatSnapshot || null
      };

      const modal = document.getElementById('loot-modal');
      const body = document.getElementById('loot-modal-body');
      if (!modal || !body) {
        this.claimCombatLoot();
        return;
      }

      const lines = tempLoot.map(entry => {
        const icon = entry.item === 'gold' ? '💰' : (this.itemsData[entry.item]?.icon || '📦');
        return `<div class="loot-modal-row">${icon} ${this.escapeHtml(this.formatLootEntryLabel(entry))}</div>`;
      });
      body.innerHTML = lines.length
        ? lines.join('')
        : '<div class="loot-modal-empty">' + this.escapeHtml(this._tr('game.ui.nothingDropped', null, 'Ничего не выпало.')) + '</div>';
      modal.classList.remove('hidden');
    },

    closeCombatLootModal() {
      const modal = document.getElementById('loot-modal');
      if (modal) modal.classList.add('hidden');
    },

    /** Применить добычу: предметы в инвентарь, gold — в state.gold */
    applyCombatLootEntries(loot) {
      if (!loot?.length) return;
      loot.forEach(({ item, qty }) => {
        const n = Math.max(0, parseInt(qty, 10) || 0);
        if (n <= 0) return;
        if (item === 'gold') {
          if (typeof this.changeGold === 'function') this.changeGold(n, { reason: 'loot', source: 'combat_loot', silent: true });
          else this.state.gold += n;
          this.log(`💰 +${n} зм (добыча с врагов)`, 'log-heal');
          return;
        }
        const resolved = this.resolveItemId(item);
        if (!this.data?.items?.[resolved]) {
          console.warn('Добыча: предмет не найден:', item);
          return;
        }
        for (let i = 0; i < n; i++) {
          this.state.inventory.push(resolved);
        }
        const label = this.formatLootEntryLabel({ item: resolved, qty: n });
        this.log(`🎒 Добыча: ${label}`, 'log-heal');
      });
      this.updateUI();
    },

    /** Кнопка «Забрать»: выдать добычу и перейти на nextScene боя */
    claimCombatLoot() {
      const pending = this.state.pendingCombatLoot;
      this.closeCombatLootModal();
      if (pending?.loot?.length) {
        this.applyCombatLootEntries(pending.loot);
      }
      const next = pending?.nextScene;
      const combat = pending?.combat;
      this.state.pendingCombatLoot = null;
      this.finishCombatVictory(next, combat);
      this.saveGame();
    },

    /** Завершение победы: опыт и переход на сцену (награды gold/items — в showScene) */
    finishCombatVictory(nextScene, combat) {
      if (combat) {
        const ids = combat.enemies || combat.enemyIds || [];
        this.awardCombatExp(ids, combat.expKey);
        const sourceScene = this.getCombatSourceSceneId(combat);
        if (sourceScene) this.markCombatCleared(sourceScene);
      }
      if (this.state._combatFromSceneElement && typeof SceneElementRunner !== 'undefined') {
        delete this.state._combatFromSceneElement;
        const runner = SceneElementRunner.getRunner(this);
        if (runner?.paused) {
          SceneElementRunner.resume(this);
          return;
        }
      }
      if (nextScene && this.data.scenes[nextScene]) {
        this.showScene(nextScene);
      } else if (nextScene) {
        this.setText(this._tr('game.ui.sceneNotFound', { id: nextScene }, 'Ошибка: сцена «' + nextScene + '» не найдена.'));
        this.setChoices([]);
      } else {
        this.setChoices([]);
      }
    },

    shouldApplyQuestStageUpdate(questId, newStageRef) {
      if (!questId || newStageRef == null || newStageRef === '') return false;
      if (this.isQuestFinished(questId) || this.isQuestFailed(questId)) return false;
      const quest = this.data?.quests?.[questId];
      if (!quest) return true;
      const currentKey = this.getQuestStage(questId);
      if (currentKey == null || currentKey === '' || currentKey === '__finished__') return true;
      const newKey = QuestRuntime.resolveStageRef(quest, newStageRef);
      if (newKey == null) return true;
      const curNum = Number(currentKey);
      const newNum = Number(newKey);
      if (!Number.isNaN(curNum) && !Number.isNaN(newNum) && newNum < curNum) return false;
      return true;
    },

    applyFlags(flags) {
      if (!flags) return;
      for (const [key, value] of Object.entries(flags)) {
        if (key.startsWith('quest_')) {
          const questId = key.slice(6);
          if (this.shouldApplyQuestStageUpdate(questId, value)) {
            this.updateQuest(questId, value, { silentLog: false });
          }
          continue;
        }
        this.state.flags[key] = value;
        if (typeof QuestEvents !== 'undefined') {
          QuestEvents.emit('FlagSet', { flag: key, value, objectId: key });
        }
      }
    },

    isVillageReturnScene(sceneId) {
      const villageScenes = new Set([
        'village_hub', 'tavern', 'tavern_entry', 'village', 'village_albert', 'village_millinfo',
        'village_accept', 'village_haggle', 'village_square', 'forest_path',
        'quest_board', 'start'
      ]);
      return villageScenes.has(sceneId);
    },

    maybeAlbertWalksToVillage(sceneId) {
      if (!this.state.flags?.albertSaved) return;
      if (this.state.flags.albertEscorted || this.state.flags.albertAtVillage) return;
      if (!this.isVillageReturnScene(sceneId)) return;
      this.state.flags.albertAtVillage = true;
      this.log('🏚️ Альберт добрался до деревни своим ходом. Зайдите в таверну к Марте.', 'log-heal');
      this.saveGame();
    },


    /**
     * Выдаёт награды квеста из data.quests[questId].rewards.
     * @param {string} questId
     * @param {{ claimFlag?: string, gold?: boolean, items?: boolean, reputation?: boolean, logGold?: string }} opts
     */
    applyQuestRewards(questId, opts = {}) {
      const quest = this.data?.quests?.[questId];
      if (!quest) return false;
      if (opts.claimFlag && this.state.flags[opts.claimFlag]) return false;

      const rewards = quest.rewards || {};
      let applied = false;

      if (opts.gold !== false) {
        const gold = Number(rewards.gold) || 0;
        if (gold > 0) {
          if (typeof this.changeGold === 'function') this.changeGold(gold, { reason: 'quest_reward', silent: true });
          else this.state.gold += gold;
          const note = opts.logGold ? ` (${opts.logGold})` : '';
          this.log(`💰 +${gold} зм${note}`, 'log-heal');
          applied = true;
        }
      }
      if (opts.items !== false) {
        (rewards.items || []).forEach((itemId) => {
          if (itemId) {
            this.addItem(itemId);
            applied = true;
          }
        });
      }
      if (opts.reputation !== false && typeof QuestRuntime !== 'undefined') {
        QuestRuntime.getReputationEntries(rewards).forEach(({ flag, amount }) => {
          this.changeReputation(flag, amount);
          applied = true;
        });
      }
      if (opts.claimFlag) this.state.flags[opts.claimFlag] = true;
      return applied || !!opts.claimFlag;
    },




    /** @deprecated compat shim — logic in QuestMigrate.migrateAlbertSaveState */
    migrateAlbertQuestState() {
      if (typeof QuestMigrate !== 'undefined' && QuestMigrate.migrateAlbertSaveState) {
        QuestMigrate.migrateAlbertSaveState(this);
      }
    },

    applyStartingFlags() {
      const start = { ...(this.data?.startingFlags || {}) };
      Object.assign(start, this.data?.reputation?.starting || {});
      for (const [key, value] of Object.entries(start)) {
        if (this.state.flags[key] === undefined) this.state.flags[key] = value;
      }
    },

    getReputationFactionMeta(repFlag) {
      if (typeof ReputationSystem !== 'undefined') {
        return ReputationSystem.getFactionMeta(this.data, repFlag);
      }
      return this.data?.reputation?.[repFlag] || null;
    },

    getReputationValue(repFlag) {
      if (!repFlag || this.state.flags[repFlag] === undefined) return null;
      const n = Number(this.state.flags[repFlag]);
      return Number.isNaN(n) ? 0 : n;
    },

    getReputationStatusLabel(value, repFlag) {
      const v = Number(value) || 0;
      const meta = repFlag ? this.getReputationFactionMeta(repFlag) : null;
      if (meta && typeof ReputationSystem !== 'undefined') {
        return ReputationSystem.getStatusLabel(meta, v);
      }
      if (v < -10) return this._tr('game.ui.reputationHostile', null, 'Вражда');
      if (v <= 10) return this._tr('game.ui.reputationNeutral', null, 'Нейтралитет');
      if (v < 25) return this._tr('game.ui.reputationFriendly', null, 'Дружба');
      return this._tr('game.ui.reputationHero', null, 'Герой');
    },

    getReputationStatusClass(value, repFlag) {
      const v = Number(value) || 0;
      const meta = repFlag ? this.getReputationFactionMeta(repFlag) : null;
      if (meta && typeof ReputationSystem !== 'undefined') {
        return ReputationSystem.getStatusClass(meta, v);
      }
      if (v < -10) return 'enemy';
      if (v <= 10) return 'neutral';
      if (v < 25) return 'friend';
      return 'hero';
    },

    /** Множитель цены из уровня фракции (discount в JSON). */
    getReputationPriceMultiplier(repFlag) {
      const rep = this.getReputationValue(repFlag);
      const n = rep == null ? 0 : rep;
      const meta = this.getReputationFactionMeta(repFlag);
      if (meta && typeof ReputationSystem !== 'undefined') {
        return ReputationSystem.getPriceMultiplier(meta, n);
      }
      let mult = 1 - n / 100;
      return Math.max(0.7, Math.min(1.5, mult));
    },

    getShopPrice(basePrice, repFlag = 'rep_village') {
      const base = Math.max(0, Number(basePrice) || 0);
      const price = Math.ceil(base * this.getReputationPriceMultiplier(repFlag));
      return Math.max(1, price);
    },

    /** Базовая цена предмета из JSON (price или cost); без цены — 0 */
    getItemBasePrice(db) {
      if (!db) return 0;
      const raw = db.price != null ? db.price : db.cost;
      return Math.max(0, Number(raw) || 0);
    },

    /** Нормализация shopConfig сцены */
    normalizeShopConfig(scene) {
      const cfg = scene?.shopConfig || {};
      return {
        inventory: Array.isArray(cfg.inventory) ? [...cfg.inventory] : [],
        sellMultiplier: Number(cfg.sellMultiplier) || 1,
        buyMultiplier: cfg.buyMultiplier != null ? Number(cfg.buyMultiplier) : 0.5,
        repFlag: cfg.repFlag || null,
        exitScene: cfg.exitScene || null,
        jackShop: !!cfg.jackShop
      };
    },

    /** Товары и цены лавки Джека (покупка + продажа через renderShopUI) */
    getJackShopConfig(scene) {
      const fromScene = scene?.shopConfig;
      if (fromScene?.inventory?.length) {
        return this.normalizeShopConfig({ ...scene, shopConfig: { ...fromScene, jackShop: true } });
      }
      const jackNpc = this.data?.npcs?.jack;
      const inventory = jackNpc?.shopItems || [
        'healing_potion', 'rope', 'supplies', 'fireball_scroll', 'focus_potion'
      ];
      return {
        inventory: [...inventory],
        sellMultiplier: 1,
        buyMultiplier: 0.5,
        repFlag: 'rep_village',
        exitScene: scene?.exitScene || 'village_hub',
        jackShop: true
      };
    },

    /** Цена покупки у торговца: base * sellMultiplier * репутация */
    getShopBuyPrice(itemId, shopConfig) {
      let base = null;
      if (shopConfig?.jackShop) {
        const override = this.data?.npcs?.jack?.shopPrices?.[itemId];
        if (override != null) base = Math.max(0, Number(override) || 0);
      }
      const db = this.data?.items?.[itemId];
      if (base == null) base = this.getItemBasePrice(db);
      if (base <= 0) return 0;
      let price = base * (shopConfig.sellMultiplier ?? 1);
      if (shopConfig.repFlag) {
        price *= this.getReputationPriceMultiplier(shopConfig.repFlag);
      }
      return Math.max(0, Math.ceil(price));
    },

    /** Цена продажи торговцу: base * buyMultiplier * репутация */
    getShopSellPrice(itemId, shopConfig) {
      const db = this.data?.items?.[itemId];
      const base = this.getItemBasePrice(db);
      if (base <= 0) return 0;
      let price = base * (shopConfig.buyMultiplier ?? 0.5);
      if (shopConfig.repFlag) {
        price *= this.getReputationPriceMultiplier(shopConfig.repFlag);
      }
      return Math.max(0, Math.floor(price));
    },

    /** Можно ли продать предмет игроком */
    getSellItemBlockReason(itemId) {
      const db = this.data?.items?.[itemId];
      if (!db) return this._tr('game.ui.itemNotFound', null, 'Предмет не найден');
      if (db.type === 'quest' || db.type === 'key') return this._tr('game.ui.questItem', null, 'Квестовый предмет');
      if (db.cursed === true) return this._tr('game.ui.cursedNoSell', null, 'Проклятый предмет нельзя продать');
      if (this.isItemEquipped(itemId)) return this._tr('game.ui.unequipFirst', null, 'Сначала снимите экипировку');
      if (this.getItemBasePrice(db) <= 0) return this._tr('game.ui.merchantWontBuy', null, 'Торговец не покупает');
      if (!this.state.inventory.includes(itemId)) return this._tr('game.ui.notInInventory', null, 'Нет в инвентаре');
      return null;
    },

    getSellableInventoryIds() {
      const seen = new Set();
      const ids = [];
      for (const itemId of this.state.inventory || []) {
        if (seen.has(itemId)) continue;
        seen.add(itemId);
        if (!this.getSellItemBlockReason(itemId)) ids.push(itemId);
      }
      return ids;
    },

    /**
     * Универсальная лавка: special "shop" + shopConfig в JSON сцены.
     */
    handleShop(sceneId, scene) {
      const cfg = this.normalizeShopConfig(scene);

      if (cfg.repFlag) {
        const rep = this.getReputationValue(cfg.repFlag) ?? 0;
        const meta = this.getReputationFactionMeta(cfg.repFlag);
        const tradeOk = meta && typeof ReputationSystem !== 'undefined'
          ? ReputationSystem.isTradeAllowed(meta, rep)
          : rep > -20;
        if (!tradeOk) {
          this.setLocation(scene?.location || 'Лавка');
          this.setText('Торговец отворачивается.\n\n«С тобой я не торгую. Торговля запрещена. Убирайся.»');
          this.clearDialogue();
          const exit = cfg.exitScene || this.getShopDefaultExit(scene);
          this.setChoices(exit ? [{ text: '🚪 Уйти', to: exit }] : []);
          return;
        }
      }

      this.setLocation(scene?.location || 'Лавка');
      if (typeof this.applyInheritedSceneAmbience === 'function') {
        this.applyInheritedSceneAmbience(sceneId || this.state.scene);
      }
      if (scene?.text) this.setText(scene.text);
      else this.setText('Перед вами прилавок с товарами.');

      this.clearDialogue();
      this.state.shopSession = {
        sceneId: sceneId || this.state.scene,
        config: cfg,
        selectedBuyId: null,
        selectedSellId: null,
        message: ''
      };
      this.refreshShopUI();
      this.saveGame();
    },

    getShopDefaultExit(scene) {
      if (scene?.shopConfig?.exitScene) return scene.shopConfig.exitScene;
      const ch = (scene?.choices || []).find(c => c.to);
      return ch?.to || null;
    },

    closeShop() {
      const session = this.state.shopSession;
      const inComponent = session?.componentIndex != null;
      this.state.shopSession = null;
      if (inComponent) {
        this.refreshSceneComponents?.();
        return;
      }
      const exit = session?.config?.exitScene;
      if (exit && this.data?.scenes?.[exit]) {
        this.showScene(exit);
        return;
      }
      this.setChoices([]);
      this.updateUI();
    },

    refreshShopUI() {
      const session = this.state.shopSession;
      const area = session?.containerEl || document.getElementById('choices-area');
      this.renderShopUIInto(area);
    },

    shopSelectBuy(itemId) {
      if (!this.state.shopSession) return;
      this.state.shopSession.selectedBuyId = itemId;
      this.state.shopSession.selectedSellId = null;
      this.state.shopSession.message = '';
      this.refreshShopUI();
    },

    shopSelectSell(itemId) {
      if (!this.state.shopSession) return;
      this.state.shopSession.selectedSellId = itemId;
      this.state.shopSession.selectedBuyId = null;
      this.state.shopSession.message = '';
      this.refreshShopUI();
    },

    shopActionBuy() {
      const session = this.state.shopSession;
      if (!session) return;
      const itemId = session.selectedBuyId;
      const cfg = session.config;
      if (!itemId) {
        session.message = 'Выберите товар у торговца.';
        this.refreshShopUI();
        return;
      }
      const db = this.data?.items?.[itemId];
      const price = this.getShopBuyPrice(itemId, cfg);
      if (!db || price <= 0) {
        session.message = 'Этот товар нельзя купить.';
        this.refreshShopUI();
        return;
      }
      if (this.state.gold < price) {
        session.message = this._tr('game.ui.notEnoughGold', { price }, `Недостаточно золота (нужно ${price} зм).`);
        this.refreshShopUI();
        return;
      }
      if (typeof this.changeGold === 'function') this.changeGold(-price, { reason: 'buy', silent: true }); else this.state.gold -= price;
      this.addItem(itemId);
      this.updateStats();
      session.message =
        itemId === this.ARROWS_ITEM_ID
          ? `Куплено: 10 стрел (−${price} зм).`
          : `Куплено: ${db.name} (−${price} зм).`;
      session.selectedBuyId = null;
      this.log(`🛒 ${db.name} (−${price} зм)`, 'log-heal');
      this.refreshShopUI();
      this.saveGame();
    },

    shopActionSell() {
      const session = this.state.shopSession;
      if (!session) return;
      const itemId = session.selectedSellId;
      const cfg = session.config;
      if (!itemId) {
        session.message = 'Выберите предмет из своего инвентаря.';
        this.refreshShopUI();
        return;
      }
      const reason = this.getSellItemBlockReason(itemId);
      if (reason) {
        session.message = reason;
        this.refreshShopUI();
        return;
      }
      const db = this.data?.items?.[itemId];
      const price = this.getShopSellPrice(itemId, cfg);
      if (price <= 0) {
        session.message = 'Торговец не покупает этот предмет.';
        this.refreshShopUI();
        return;
      }
      const idx = this.state.inventory.indexOf(itemId);
      if (idx === -1) {
        session.message = 'Предмета нет в инвентаре.';
        this.refreshShopUI();
        return;
      }
      this.state.inventory.splice(idx, 1);
      if (!this.state.inventory.includes(itemId)) {
        this.unequipItem(itemId, { silent: true });
      }
      if (typeof this.changeGold === 'function') this.changeGold(price, { reason: 'sell', silent: true }); else this.state.gold += price;
      this.updateStats();
      session.message = `Продано: ${db?.name || itemId} (+${price} зм).`;
      session.selectedSellId = null;
      this.log(`💰 Продажа: ${db?.name || itemId} (+${price} зм)`, 'log-heal');
      this.refreshShopUI();
      this.saveGame();
    },

    shopActionLeave() {
      this.closeShop();
    },

    /**
     * Кузница: special "blacksmith" — заточка экипированного оружия/брони/щита за золото.
     */
    handleBlacksmith(sceneId, scene) {
      this.setLocation(scene?.location || 'Кузница');
      if (typeof this.applyInheritedSceneAmbience === 'function') {
        this.applyInheritedSceneAmbience(sceneId || this.state.scene);
      }
      if (scene?.text) this.setText(scene.text);
      else this.setText('Кузнец осматривает ваше снаряжение.\n\n«Что будем закалять?»');
      this.clearDialogue();
      this.state.blacksmithSession = {
        sceneId: sceneId || this.state.scene,
        exitScene: scene?.exitScene || this.getShopDefaultExit(scene),
        message: ''
      };
      this.refreshBlacksmithUI();
      this.saveGame();
    },

    blacksmithLeave() {
      const session = this.state.blacksmithSession;
      const inComponent = session?.componentIndex != null;
      const exit = session?.exitScene;
      this.state.blacksmithSession = null;
      if (inComponent) {
        this.refreshSceneComponents?.();
        return;
      }
      if (exit && this.data?.scenes?.[exit]) {
        this.showScene(exit);
      } else {
        this.setChoices([]);
        this.updateUI();
      }
    },

    refreshBlacksmithUI() {
      const session = this.state.blacksmithSession;
      const area = session?.componentContainer || document.getElementById('choices-area');
      this.renderBlacksmithUIInto(area);
    },

    blacksmithEnhance(itemId) {
      const session = this.state.blacksmithSession;
      if (!session) return;

      const equippedSlot = this.ENHANCEMENT_SLOTS.find(
        s => this.getEquippedItemId(s) === itemId
      );
      if (!equippedSlot) {
        session.message = 'Предмет должен быть экипирован.';
        this.refreshBlacksmithUI();
        return;
      }

      const template = this.itemsData?.[itemId];
      const current = this.getItemEnhancementLevel(itemId);
      const max = session?.maxEnhancement != null
        ? Math.min(this.getItemEnhancementMax(template), Number(session.maxEnhancement))
        : this.getItemEnhancementMax(template);
      const cost = this.getNextEnhancementCost(itemId);

      if (!template || cost == null || current >= max) {
        session.message = 'Достигнут максимум заточки.';
        this.refreshBlacksmithUI();
        return;
      }

      if (this.state.gold < cost) {
        session.message = this._tr('game.ui.notEnoughGold', { price: cost }, `Недостаточно золота (нужно ${cost} зм).`);
        this.refreshBlacksmithUI();
        return;
      }

      if (typeof this.changeGold === 'function') this.changeGold(-cost, { reason: 'service', silent: true }); else this.state.gold -= cost;
      this.setItemEnhancementLevel(itemId, current + 1);
      this.recalcDerivedStats();
      this.updateStats();

      const newLevel = current + 1;
      session.message = `Успех! ${template.name} теперь +${newLevel}. (−${cost} зм)`;
      this.log(`⚒️ Заточка: ${template.name} +${newLevel} (−${cost} зм)`, 'log-heal');
      this.refreshBlacksmithUI();
      this.saveGame();
    },

    /**
     * Храм: special "temple_priest" — снятие проклятия с надетых предметов за золото.
     */
    handleTemplePriest(sceneId, scene) {
      this.setLocation(scene?.location || 'Храм');
      if (typeof this.applyInheritedSceneAmbience === 'function') {
        this.applyInheritedSceneAmbience(sceneId || this.state.scene);
      }
      if (scene?.text) this.setText(scene.text);
      else this.setText('Священник осматривает ваше снаряжение.\n\n«Проклятие можно снять с того, что на вас надето — за подношение.»');
      this.clearDialogue();
      this.state.templePriestSession = {
        sceneId: sceneId || this.state.scene,
        exitScene: scene?.exitScene || this.getShopDefaultExit(scene),
        message: ''
      };
      this.renderTemplePriestUI();
      this.saveGame();
    },

    templePriestLeave() {
      const session = this.state.templePriestSession;
      const inComponent = session?.componentIndex != null;
      const exit = session?.exitScene;
      this.state.templePriestSession = null;
      if (inComponent) {
        this.refreshSceneComponents?.();
        return;
      }
      if (exit && this.data?.scenes?.[exit]) {
        this.showScene(exit);
      } else {
        this.setChoices([]);
        this.updateUI();
      }
    },

    templePriestRemoveCurse(itemId) {
      const session = this.state.templePriestSession;
      if (!session) return;

      const entry = this.getEquippedCursedEntries().find(e => e.itemId === itemId);
      if (!entry) {
        session.message = 'Предмет не надет или не проклят.';
        this.refreshTemplePriestUI();
        return;
      }

      const db = entry.item;
      const cost = entry.cost;
      if (this.state.gold < cost) {
        session.message = this._tr('game.ui.notEnoughGold', { price: cost }, `Недостаточно золота (нужно ${cost} зм).`);
        this.refreshTemplePriestUI();
        return;
      }

      if (typeof this.changeGold === 'function') this.changeGold(-cost, { reason: 'service', silent: true }); else this.state.gold -= cost;
      delete this.state.equipped[entry.slot];
      if (entry.slot === 'shield') delete this.state.equipped.offhand;

      this.recalculateCurseEffectsFromEquipment();
      this.recalcDerivedStats();
      this.updateStats();

      session.message = `Священник снял ${db.name}. Предмет остаётся проклятым.`;
      this.log(`✨ Священник снял ${db.name} (−${cost} зм). Предмет в инвентаре, проклятие вернётся при надевании.`, 'log-heal');
      if (session.componentIndex != null) {
        this.refreshSceneComponents?.();
      } else {
        this.refreshTemplePriestUI();
      }
      this.saveGame();
    },

    refreshTemplePriestUI() {
      const session = this.state.templePriestSession;
      const area = session?.componentContainer || document.getElementById('choices-area');
      this.renderTemplePriestUIInto(area);
    },

    renderTemplePriestUI() {
      this.renderTemplePriestUIInto(document.getElementById('choices-area'));
    },

    renderTemplePriestUIInto(area) {
      if (!area || !this.state.templePriestSession) return;

      const session = this.state.templePriestSession;
      const entries = this.getEquippedCursedEntries();

      let listHtml = '<div class="temple-priest-list">';
      if (!entries.length) {
        listHtml += '<p class="hint">Нет надетых проклятых предметов.</p>';
      } else {
        entries.forEach(e => {
          const afford = this.state.gold >= e.cost;
          const effects = this.formatCurseEffectsList(e.item);
          listHtml += `<div class="temple-priest-row">
            <span><b>${this.escapeHtml(e.item.name)}</b> — ${this.escapeHtml(effects)}</span>
            <button type="button" class="choice temple-priest-btn${afford ? '' : ' temple-priest-btn--poor'}"
              ${afford ? `onclick="GameEngine.templePriestRemoveCurse('${this.escapeAttr(e.itemId)}')"` : 'disabled'}>
              Снять за ${e.cost} зм
            </button>
          </div>`;
        });
      }
      listHtml += '</div>';

      const msg = session.message
        ? `<p class="temple-priest-msg">${this.escapeHtml(session.message)}</p>`
        : '';

      area.innerHTML = `
        <div class="temple-priest-panel">
          <div class="temple-priest-header">☦️ Священник</div>
          <p class="hint">Золото: ${this.state.gold} зм. Снимается только с надетых вещей; предмет остаётся проклятым.</p>
          ${listHtml}
          ${msg}
          ${session.componentContainer ? '' : '<button type="button" class="choice" onclick="GameEngine.templePriestLeave()">Уйти</button>'}
        </div>`;

      if (!session.componentContainer) {
        this.state.currentChoices = [];
        this.state.currentChoiceIndices = [];
      }
    },

    renderBlacksmithUI() {
      this.renderBlacksmithUIInto(document.getElementById('choices-area'));
    },

    renderBlacksmithUIInto(area) {
      if (!area || !this.state.blacksmithSession) return;

      const session = this.state.blacksmithSession;
      const entries = this.getBlacksmithEnhanceableEntries();

      let equipHtml = '<div class="blacksmith-equipped">';
      this.ENHANCEMENT_SLOTS.forEach(slot => {
        const id = this.getEquippedItemId(slot);
        const item = id ? this.getEffectiveItemData(id) : null;
        const slotLabel = slot === 'weapon_main' ? 'Оружие (осн.)' : slot === 'armor' ? 'Броня' : 'Щит';
        if (!item) {
          equipHtml += `<div class="blacksmith-slot">${slotLabel}: <span class="hint">— пусто —</span></div>`;
        } else {
          const lvl = this.getItemEnhancementLevel(id);
          const max = this.getItemEnhancementMax(item);
          equipHtml += `<div class="blacksmith-slot">${slotLabel}: <b>${this.escapeHtml(item.name)}</b> (+${lvl}${max ? ` / +${max}` : ''})</div>`;
        }
      });
      equipHtml += '</div>';

      let actionsHtml = '';
      if (entries.length) {
        entries.forEach(e => {
          const afford = this.state.gold >= e.cost;
          actionsHtml += `<button type="button" class="choice blacksmith-enhance-btn${afford ? '' : ' blacksmith-enhance-btn--poor'}"
            ${afford ? `onclick="GameEngine.blacksmithEnhance('${this.escapeAttr(e.itemId)}')"` : 'disabled'}
            title="${afford ? '' : 'Недостаточно золота'}">
            Заточить ${this.escapeHtml(e.name)} до +${e.next} — ${e.cost} зм
          </button>`;
        });
      } else {
        actionsHtml = '<div class="hint" style="margin:8px 0;">Нет доступных улучшений (максимум или слоты пусты).</div>';
      }

      area.innerHTML = `
        <div class="blacksmith-panel">
          <div class="blacksmith-header">
            <b>⚒️ Кузница</b> · 💰 ${this.state.gold} зм
            ${session.message ? `<div class="shop-flash">${this.escapeHtml(session.message)}</div>` : ''}
          </div>
          ${equipHtml}
          <div class="blacksmith-actions">${actionsHtml}</div>
          ${session.componentContainer ? '' : '<button type="button" class="choice" onclick="GameEngine.blacksmithLeave()">Уйти</button>'}
        </div>`;

      if (!session.componentContainer) {
        this.state.currentChoices = [];
        this.state.currentChoiceIndices = [];
      }
    },

    /** Две колонки: товары торговца / инвентарь игрока */
    renderShopUI() {
      this.renderShopUIInto(document.getElementById('choices-area'));
    },

    renderShopUIInto(area) {
      if (!area || !this.state.shopSession) return;

      const session = this.state.shopSession;
      const cfg = session.config;
      const selBuy = session.selectedBuyId;
      const selSell = session.selectedSellId;

      const merchantItems = (cfg.inventory || []).filter(itemId => {
        const price = this.getShopBuyPrice(itemId, cfg);
        return price > 0 && this.data?.items?.[itemId];
      });

      const sellableIds = this.getSellableInventoryIds();
      const blockedInInv = [];
      const seen = new Set();
      for (const itemId of this.state.inventory || []) {
        if (seen.has(itemId)) continue;
        seen.add(itemId);
        const reason = this.getSellItemBlockReason(itemId);
        if (reason) blockedInInv.push({ itemId, reason, db: this.data.items[itemId] });
      }

      const renderRow = (itemId, price, selected, onClick, suffix = '') => {
        const db = this.data.items[itemId];
        const cls = 'shop-item-row' + (selected ? ' shop-item-row--selected' : '');
        const bundleHint =
          itemId === this.ARROWS_ITEM_ID ? ' · 10 шт.' : '';
        return `<button type="button" class="${cls}" onclick="${onClick}">
          <span class="shop-item-name">${this.escapeHtml((db?.icon || '📦') + ' ' + (db?.name || itemId))}${bundleHint}</span>
          <span class="shop-item-price">${price} зм${suffix}</span>
        </button>`;
      };

      let leftHtml = merchantItems.length
        ? merchantItems.map(id => renderRow(
          id,
          this.getShopBuyPrice(id, cfg),
          selBuy === id,
          `GameEngine.shopSelectBuy('${this.escapeAttr(id)}')`
        )).join('')
        : '<div class="shop-empty">Нет товаров с ценой</div>';

      let rightHtml = '';
      sellableIds.forEach(id => {
        rightHtml += renderRow(
          id,
          this.getShopSellPrice(id, cfg),
          selSell === id,
          `GameEngine.shopSelectSell('${this.escapeAttr(id)}')`,
          ''
        );
      });
      blockedInInv.forEach(({ itemId, reason, db }) => {
        rightHtml += `<div class="shop-item-row shop-item-row--disabled" title="${this.escapeAttr(reason)}">
          <span class="shop-item-name">${this.escapeHtml((db?.icon || '📦') + ' ' + (db?.name || itemId))}</span>
          <span class="shop-item-hint">${this.escapeHtml(reason)}</span>
        </div>`;
      });
      if (!rightHtml) {
        rightHtml = '<div class="shop-empty">Нечего продать</div>';
      }

      const repNote = cfg.repFlag && this.getReputationValue(cfg.repFlag) != null
        ? `<div class="shop-rep">Репутация: ${this.escapeHtml(this.getReputationStatusLabel(this.getReputationValue(cfg.repFlag), cfg.repFlag))} (${this.getReputationValue(cfg.repFlag)})</div>`
        : '';

      area.innerHTML = `
        <div class="shop-panel">
          <div class="shop-header">
            <b>💰 Золото: ${this.state.gold} зм</b>
            ${repNote}
            ${session.message ? `<div class="shop-flash">${this.escapeHtml(session.message)}</div>` : ''}
          </div>
          <div class="shop-columns">
            <div class="shop-column">
              <div class="shop-column-title">Товары торговца</div>
              <div class="shop-item-list">${leftHtml}</div>
            </div>
            <div class="shop-column">
              <div class="shop-column-title">Ваш инвентарь</div>
              <div class="shop-item-list">${rightHtml}</div>
            </div>
          </div>
          <div class="shop-actions">
            <button type="button" class="choice shop-action-btn" onclick="GameEngine.shopActionBuy()">Купить</button>
            <button type="button" class="choice shop-action-btn" onclick="GameEngine.shopActionSell()">Продать</button>
            ${typeof this.renderJackShopQuestButtons === 'function' ? this.renderJackShopQuestButtons(cfg) : ''}
            ${session.containerEl ? '' : '<button type="button" class="choice shop-action-btn" onclick="GameEngine.shopActionLeave()">Уйти</button>'}
          </div>
        </div>`;

      if (!session.containerEl) {
        this.state.currentChoices = [];
        this.state.currentChoiceIndices = [];
      }
    },

    changeReputation(repFlag, amount, opts = {}) {
      if (!repFlag) return;
      const delta = Number(amount) || 0;
      if (!delta) return;

      const prevRaw = this.state.flags[repFlag];
      const prev = prevRaw === undefined ? 0 : Number(prevRaw) || 0;
      const next = prev + delta;
      this.state.flags[repFlag] = next;

      const meta = this.getReputationFactionMeta(repFlag);
      const factionName = meta?.name || repFlag;
      const prevStatus = this.getReputationStatusClass(prev, repFlag);
      const nextStatus = this.getReputationStatusClass(next, repFlag);
      const significant = Math.abs(delta) >= 5 || prevStatus !== nextStatus;

      const sign = delta > 0 ? '+' : '';
      if (opts.notify !== false) {
        this.log(`🤝 Репутация с «${factionName}» изменена: ${sign}${delta}`, delta > 0 ? 'log-heal' : 'log-damage');
      } else if (significant) {
        const verb = delta > 0 ? 'улучшилась' : 'ухудшилась';
        const status = this.getReputationStatusLabel(next, repFlag);
        this.log(`🤝 Репутация (${factionName}) ${verb}: ${status}`, delta > 0 ? 'log-heal' : 'log-damage');
      }
      this.renderRelationsPanel();
      this.saveGame();
    },

    applyNpcReputationEffects(npcId, trigger) {
      const npc = this.data?.npcs?.[npcId];
      if (!npc?.reputationEffects?.length) return;
      npc.reputationEffects.forEach((eff) => {
        if (!eff || eff.trigger !== trigger || !eff.faction) return;
        const onceKey = eff.once ? `rep_npc_${npcId}_${trigger}_${eff.faction}` : null;
        if (onceKey && this.state.flags[onceKey]) return;
        const val = Number(eff.value);
        if (!val) return;
        this.changeReputation(eff.faction, val);
        if (onceKey) this.state.flags[onceKey] = true;
      });
    },

    applyQuestNpcReputation(questId) {
      const giver = this.data?.quests?.[questId]?.giver;
      if (giver) this.applyNpcReputationEffects(giver, 'quest_complete');
    },

    /** Репутация за убийство врага с «Важность для фракции» (один раз на экземпляр) */
    processDefeatedEnemiesReputation() {
      if (!this.state.enemies?.length) return;
      this.state.enemies.forEach((enemy) => {
        if (!enemy || enemy.hp > 0 || enemy._repKillApplied) return;
        enemy._repKillApplied = true;
        if (typeof QuestEvents !== 'undefined') {
          QuestEvents.emit('EnemyKilled', {
            enemyId: enemy.id || enemy.templateId,
            id: enemy.id,
            templateId: enemy.templateId || enemy.id,
            count: 1
          });
        }
        const template = this.data?.enemies?.[enemy.id];
        if (!template?.factionImportant) return;
        const delta = Number(template.reputationOnKill);
        if (!delta || !template.faction) return;
        this.changeReputation(template.faction, delta);
      });
    },

    tryEnterCombatWithReputation(rawScene, enemies) {
      if (typeof ReputationSystem === 'undefined') return false;
      const enemyIds = rawScene.combat;
      const primaryId = enemyIds?.[0];
      const template = this.data?.enemies?.[primaryId];
      if (!template?.faction) return false;

      const rep = this.getReputationValue(template.faction) ?? 0;
      const behavior = ReputationSystem.resolveEnemyBehavior(template, rep);
      const nextScene = rawScene.nextScene;
      const exitTo = nextScene || this.getSceneExitTarget(rawScene) || 'village_hub';

      if (behavior.action === 'auto_combat') {
        this.startCombat(enemies, nextScene, enemyIds);
        return true;
      }

      const dialogue = behavior.dialogue || '';
      if (behavior.action === 'ally') {
        let text = rawScene.text || '';
        if (dialogue) text += (text ? '\n\n' : '') + dialogue;
        this.setText(text);
        this.setChoices([
          { text: '🗣️ Поговорить', to: exitTo },
          { text: '🚪 Уйти', to: exitTo }
        ]);
        this.saveGame();
        this.renderTravelMenu();
        return true;
      }

      this.state.pendingFactionCombat = { enemies, nextScene, enemyIds, behavior };
      let text = rawScene.text || '';
      if (dialogue) text += (text ? '\n\n' : '') + dialogue;
      this.setText(text);

      const choices = [];
      if (behavior.action === 'dialogue_optional_combat') {
        choices.push({ text: '🗣️ Поговорить', to: exitTo });
        choices.push({ text: '⚔️ Атаковать', action: 'start_pending_faction_combat' });
        choices.push({ text: '🚪 Уйти', to: exitTo });
      } else {
        choices.push({ text: '⚔️ Вступить в бой', action: 'start_pending_faction_combat' });
        choices.push({ text: '🚪 Уйти', to: exitTo });
      }
      this.setChoices(choices);
      this.saveGame();
      this.renderTravelMenu();
      return true;
    },

    applyChoiceReputation(choice) {
      if (!choice?.reputation || typeof choice.reputation !== 'object') return;
      for (const [repFlag, amount] of Object.entries(choice.reputation)) {
        this.changeReputation(repFlag, amount);
      }
    },

    checkAchievements(event) {
      if (typeof AchievementSystem === 'undefined') return [];
      return AchievementSystem.checkAll(this, event || {});
    },

    onAchievementUnlocked(ach) {
      const title = ach?.title || ach?.id || 'Достижение';
      this.log(`🏆 Достижение разблокировано: «${title}»`, 'log-heal');
      this.showAchievementToast(ach);
      const soundId = ach?.sound || 'buff';
      if (typeof AudioEngine !== 'undefined' && AudioEngine.playSFX) {
        AudioEngine.playSFX(soundId, { volume: 0.92 });
      } else if (typeof this.playCombatSound === 'function') {
        this.playCombatSound(soundId);
      }
    },

    showAchievementToast(ach) {
      const el = document.getElementById('achievement-toast');
      const nameEl = document.getElementById('achievement-toast-name');
      const iconEl = document.getElementById('achievement-toast-icon');
      if (!el || !nameEl) return;

      const title = ach?.title || 'Достижение';
      nameEl.textContent = title;
      if (iconEl) {
        iconEl.innerHTML = this.renderIcon?.(ach?.icon || '🏆') || (ach?.icon || '🏆');
      }

      el.classList.remove('hidden');
      el.classList.add('is-visible');
      clearTimeout(this._achievementToastTimer);
      this._achievementToastTimer = setTimeout(() => {
        el.classList.remove('is-visible');
        el.classList.add('hidden');
      }, 4200);
    },

    renderAchievementsPanel() {
      const grid = document.getElementById('achievements-grid');
      const summary = document.getElementById('achievements-summary');
      if (!grid) return;

      if (typeof AchievementSystem === 'undefined') {
        grid.innerHTML = '<div class="hint">Модуль достижений не загружен.</div>';
        return;
      }

      AchievementSystem.normalizeAll(this.data);
      const catalog = AchievementSystem.getCatalog(this.data);
      const ids = Object.keys(catalog);
      const counts = AchievementSystem.getUnlockedCount(this);

      if (summary) {
        summary.textContent = ids.length
          ? `${counts.unlocked} / ${counts.total}`
          : '0 / 0';
      }

      if (!ids.length) {
        grid.innerHTML = '<div class="hint">В этом модуле пока нет достижений.</div>';
        return;
      }

      grid.innerHTML = ids.map((id) => {
        const display = AchievementSystem.getDisplayMeta(this, id, catalog[id]);
        const cls = display.unlocked ? 'ach-trophy-card is-unlocked' : 'ach-trophy-card is-locked';
        const iconHtml = this.renderIcon?.(display.icon) || this.escapeHtml(display.icon);
        return `<div class="${cls}" title="${this.escapeAttr(display.description)}">
          <div class="ach-trophy-icon">${iconHtml}</div>
          <div class="ach-trophy-title">${this.escapeHtml(display.title)}</div>
          <div class="ach-trophy-desc">${this.escapeHtml(display.description || '')}</div>
        </div>`;
      }).join('');
    },

    renderRelationsPanel() {
      const list = document.getElementById('relations-list');
      const dockBtn = document.querySelector('.dock-icon[data-panel="relations"]');
      if (!list) return;

      if (typeof ReputationSystem !== 'undefined') ReputationSystem.ensureFactions(this.data);
      const catalog = this.data?.reputation || {};
      const rows = [];

      Object.keys(catalog).forEach(repFlag => {
        if (repFlag === 'starting' || typeof catalog[repFlag] !== 'object') return;
        if (this.state.flags[repFlag] === undefined) return;
        const meta = this.getReputationFactionMeta(repFlag);
        const value = this.getReputationValue(repFlag) ?? 0;
        const status = this.getReputationStatusLabel(value, repFlag);
        const statusClass = this.getReputationStatusClass(value, repFlag);
        const level = typeof ReputationSystem !== 'undefined'
          ? ReputationSystem.getLevelForValue(meta, value)
          : null;
        const color = level?.color || '#888';
        const nextLv = typeof ReputationSystem !== 'undefined'
          ? ReputationSystem.getNextLevel(meta, value)
          : null;
        let progressHint = '';
        if (nextLv) {
          const need = Number(nextLv.min) - value;
          progressHint = `title="До «${this.escapeAttr(nextLv.label)}»: ${need > 0 ? '+' : ''}${need} (${value} / 100)"`;
        } else {
          progressHint = `title="Текущее значение: ${value} / 100"`;
        }
        const barPct = Math.max(0, Math.min(100, ((value + 100) / 200) * 100));
        rows.push(`
          <div class="relation-row" ${progressHint}>
            <span class="relation-row-name">${this.renderIcon(meta?.icon || '🤝')} ${this.escapeHtml(meta?.name || repFlag)}</span>
            <span class="relation-row-meta">
              <span class="relation-row-value">${value}</span>
              <span class="relation-row-status relation-row-status--${statusClass}" style="color:${color}">${this.escapeHtml(status)}</span>
            </span>
            <div class="relation-progress" aria-hidden="true"><span class="relation-progress-fill" style="width:${barPct}%;background:${color}"></span></div>
          </div>`);
      });

      if (!rows.length) {
        dockBtn?.classList.add('hidden');
        list.innerHTML = '<div class="hint">Пока нет активных отношений.</div>';
        if (typeof SidebarDock !== 'undefined' && SidebarDock.activePanel === 'relations') {
          SidebarDock.closeAll();
        }
        return;
      }

      dockBtn?.classList.remove('hidden');
      list.innerHTML = rows.join('');
    },

    applyLevelHpGain(level) {
      const cls = this.data.classes[this.state.className];
      const lvlCfg = this.getClassLevelConfig(level);
      const formula = lvlCfg?.hpGain || cls?.progression?.hpGain || this.getProgression().defaultHpGain || '1d8';
      let gain = this.parseRoll(formula);
      const con = this.getBaseStats().con || 10;
      gain += Math.floor((con - 10) / 2);
      this.state.baseMaxHp = (this.state.baseMaxHp ?? this.state.maxHp) + gain;
      this.state.hp += gain;
      this.recalcDerivedStats();
      return gain;
    },

    applyLevelStatBonuses(levelConfig) {
      if (!levelConfig?.stats) return;
      // atk/ac из уровней учитываются в recalcDerivedStats (collectProgressionLevelBonuses)
      if (levelConfig.stats.atkBonus != null || levelConfig.stats.ac != null) {
        this.recalcDerivedStats?.();
        return;
      }
      for (const [key, value] of Object.entries(levelConfig.stats)) {
        if (this.state.classData[key] != null) {
          this.state.classData[key] += value;
        }
      }
    },

    STAT_KEYS: ['str', 'dex', 'con', 'int', 'wis', 'cha'],

    STAT_LABELS: {
      str: 'СИЛ', dex: 'ЛОВ', con: 'ТЕЛ', int: 'ИНТ', wis: 'МУД', cha: 'ХАР'
    },

    /**
     * ASI: объект вида { str: 2 } или { dex: 1, wis: 1 } (сумма +2).
     */
    applyStatBonus(statsObj) {
      if (!statsObj || typeof statsObj !== 'object') return false;
      const base = this.state.stats || this.state.classData?.stats;
      if (!base) return false;

      let spent = 0;
      const parts = [];
      for (const [key, raw] of Object.entries(statsObj)) {
        if (!this.STAT_KEYS.includes(key)) continue;
        const n = Number(raw) || 0;
        if (n <= 0) continue;
        spent += n;
        const before = base[key] ?? 10;
        base[key] = Math.min(20, before + n);
        if (this.state.stats) this.state.stats[key] = base[key];
        parts.push(`${this.STAT_LABELS[key] || key} ${before}→${base[key]}`);
      }

      if (spent <= 0) return false;
      this.log(`📈 Улучшение характеристик (+${spent}): ${parts.join(', ')}`, 'log-heal');
      this.updateAbilityGrid();
      this.updateStats();
      this.recalcDerivedStats?.();
      return true;
    },

    levelConfigNeedsAsi(levelConfig) {
      return !!(levelConfig && (levelConfig.asi === true || levelConfig.type === 'asi'));
    },

    getPendingLevelChoiceIds(pending) {
      if (!pending?.choiceIds?.length) return [];
      return pending.choiceIds.filter(id => this.resolveAbilityDefinition(id));
    },

    finishPendingLevelUp() {
      const pending = this.state.pendingLevelUp;
      if (!pending) return;
      this.state.pendingLevelUp = null;
      this.closeLevelUpModal();
      this.updateStats();
      this.resumeAfterLevelUp();
      this.checkLevelUp();
      this.saveGame();
    },

    showLevelUpAsiModal(pending) {
      const modal = document.getElementById('levelup-modal');
      const title = document.getElementById('levelup-title');
      const text = document.getElementById('levelup-text');
      const choicesEl = document.getElementById('levelup-choices');
      if (!modal || !choicesEl) {
        this.finishPendingLevelUp();
        return;
      }

      pending.asiMode = pending.asiMode || '+2';
      pending.asiPicks = pending.asiPicks || {};

      if (title) title.textContent = `Уровень ${pending.level}! — характеристики`;
      const hpNote = pending.hpGain > 0 ? ` (+${pending.hpGain} макс. ОЗ).` : '';
      if (text) {
        text.textContent = `Распределите +2 очка характеристик${hpNote} Можно взять +2 к одной или +1 к двум разным.`;
      }

      const mode = pending.asiMode;
      const picks = pending.asiPicks;
      const pickCount = Object.values(picks).reduce((s, v) => s + v, 0);

      let html = `
        <div class="levelup-asi-modes">
          <button type="button" class="choice levelup-asi-mode${mode === '+2' ? ' active' : ''}" ${this.onclickGame('setLevelUpAsiMode', '+2')}">+2 к одной</button>
          <button type="button" class="choice levelup-asi-mode${mode === '+1+1' ? ' active' : ''}" ${this.onclickGame('setLevelUpAsiMode', '+1+1')}">+1 к двум</button>
        </div>
        <div class="levelup-asi-grid">
      `;

      this.STAT_KEYS.forEach(stat => {
        const val = this.state.classData.stats[stat] ?? 10;
        const mod = this.getModifier(val);
        const modStr = mod >= 0 ? '+' + mod : String(mod);
        const picked = picks[stat] || 0;
        html += `<button type="button" class="choice levelup-stat-btn" ${this.onclickGame('pickLevelUpAsiStat', stat)}>
          <span class="levelup-stat-name">${this.STAT_LABELS[stat]}</span>
          <span class="levelup-stat-val">${val}${picked ? ` (+${picked})` : ''}</span>
          <span class="levelup-stat-mod">${modStr}</span>
        </button>`;
      });

      html += `</div><p class="levelup-asi-hint">Выбрано очков: ${pickCount} / 2</p>`;

      const canConfirm = pickCount === 2;
      html += `<button type="button" class="choice levelup-asi-confirm" ${canConfirm ? this.onclickGame('confirmLevelUpAsi') : 'disabled'}>Подтвердить</button>`;

      choicesEl.innerHTML = html;
      modal.classList.remove('hidden');
    },

    setLevelUpAsiMode(mode) {
      const pending = this.state.pendingLevelUp;
      if (!pending) return;
      pending.asiMode = mode === '+1+1' ? '+1+1' : '+2';
      pending.asiPicks = {};
      this.showLevelUpAsiModal(pending);
    },

    pickLevelUpAsiStat(stat) {
      const pending = this.state.pendingLevelUp;
      if (!pending || !this.STAT_KEYS.includes(stat)) return;
      const picks = { ...(pending.asiPicks || {}) };
      const mode = pending.asiMode || '+2';
      const current = picks[stat] || 0;
      const total = Object.values(picks).reduce((s, v) => s + v, 0);

      if (mode === '+2') {
        pending.asiPicks = total === 2 && current === 2 ? {} : { [stat]: 2 };
      } else {
        if (current >= 1) {
          delete picks[stat];
        } else if (total < 2) {
          picks[stat] = 1;
        }
        pending.asiPicks = picks;
      }
      this.showLevelUpAsiModal(pending);
    },

    confirmLevelUpAsi() {
      const pending = this.state.pendingLevelUp;
      if (!pending?.asiPicks) return;
      const total = Object.values(pending.asiPicks).reduce((s, v) => s + v, 0);
      if (total !== 2) return;

      this.applyStatBonus(pending.asiPicks);
      pending.asiDone = true;

      const abilityIds = this.getPendingLevelChoiceIds(pending);
      if (abilityIds.length) {
        this.showLevelUpAbilityModal(pending.level, abilityIds, pending.hpGain, true);
        return;
      }
      this.finishPendingLevelUp();
    },

    showLevelUpAbilityModal(level, choiceIds, hpGain, afterAsi) {
      const validChoices = (choiceIds || []).filter(id => this.resolveAbilityDefinition(id));
      if (!validChoices.length) {
        this.finishPendingLevelUp();
        return;
      }

      const modal = document.getElementById('levelup-modal');
      const title = document.getElementById('levelup-title');
      const text = document.getElementById('levelup-text');
      const choicesEl = document.getElementById('levelup-choices');
      if (!modal || !choicesEl) {
        this.finishPendingLevelUp();
        return;
      }

      const pending = this.state.pendingLevelUp || {};
      pending.level = level;
      pending.choiceIds = validChoices;
      pending.hpGain = hpGain;
      pending.asiDone = afterAsi || pending.asiDone;
      this.state.pendingLevelUp = pending;

      if (title) title.textContent = `Уровень ${level}!`;
      if (text) {
        const hpPart = !afterAsi && hpGain > 0 ? ` +${hpGain} макс. ОЗ.` : '';
        text.textContent = `Выберите новое умение${hpPart}`;
      }

      choicesEl.innerHTML = validChoices.map(id => {
        const ab = this.resolveAbilityDefinition(id);
        const sl = this.getAbilitySpellLevel(ab);
        const cost = sl >= 1 ? ` (круг ${sl})` : (ab.cost != null ? ` (${ab.cost} ${this.state.classData.resourceName})` : '');
        const tag = ab.type === 'passive' || ab.passive ? ' [пассив]' : '';
        return `<button type="button" class="choice levelup-choice" ${this.onclickGame('pickLevelUpAbility', id)}>
          <span class="levelup-ab-icon">${this.escapeHtml(ab.icon || '✨')}</span>
          <span class="levelup-ab-name">${this.escapeHtml(ab.name)}${this.escapeHtml(cost)}${this.escapeHtml(tag)}</span>
          <span class="levelup-ab-desc">${this.escapeHtml(ab.desc || '')}</span>
        </button>`;
      }).join('');

      modal.classList.remove('hidden');
    },

    applyPassiveAbility(ability) {
      const passive = ability.passive;
      if (!passive) return;
      // ОЗ: по-прежнему накапливаем в baseMaxHp (совместимость со старыми сохранениями)
      if (passive.maxHpBonus) {
        const bonus = parseInt(passive.maxHpBonus, 10) || 0;
        if (bonus > 0) {
          this.ensureBaseMaxHp();
          this.state.baseMaxHp = (this.state.baseMaxHp ?? this.state.maxHp) + bonus;
          this.state.hp += bonus;
        }
      }
      // КД/атака — только через recalcDerivedStats (иначе затираются при экипировке)
      if (passive.resourceMaxBonus) {
        const r = this.state.resources;
        const bonus = parseInt(passive.resourceMaxBonus, 10) || 0;
        if (r?.mode === 'spellSlots' && r.spellSlots?.['1']) {
          r.spellSlots['1'].m += bonus;
          r.spellSlots['1'].c += bonus;
        } else if (r) {
          r.max = (r.max ?? 0) + bonus;
          r.current = (r.current ?? 0) + bonus;
        }
      }
      if (passive.acBonus || passive.atkBonus || passive.maxHpBonus) {
        this.recalcDerivedStats?.();
        this.updateStats?.();
      }
    },

    addAbilityToPlayer(ability) {
      if (!ability?.id || !this.state.classData.abilities) return;
      if (this.state.classData.abilities.some(a => a.id === ability.id)) return;
      const idx = this.state.classData.abilities.length;
      const def = this.resolveAbilityDefinition(ability.id) || ability;
      this.state.classData.abilities.push(
        this.reconcileAbility(ability, def, this.state.className, idx)
      );
      if (ability.type === 'passive' || ability.passive) {
        this.applyPassiveAbility(ability);
      } else {
        this.recalcDerivedStats?.();
      }
      this.renderAbilities();
    },

    /** PF2e: навыки, которые можно повысить на чётном уровне */
    getPf2eSkillIncreaseOptions() {
      const sys = this.activeSystem;
      if (!sys?.getNextRank) return [];
      const skills = this.state.skills || {};
      return Object.entries(skills)
        .filter(([, rank]) => rank && rank !== 'untrained' && rank !== 'legendary')
        .map(([id, rank]) => ({
          id,
          rank,
          nextRank: sys.getNextRank(rank),
          label: this.CharacterCreator?.skillLabel?.(id) || sys.getSkillDefs?.()?.[id]?.ru || id
        }))
        .filter(o => o.nextRank);
    },

    pf2eLevelGrantsSkillIncrease(level) {
      return this.isPf2eMode() && level >= 2 && level % 2 === 0;
    },

    showPf2eSkillIncreaseModal(pending) {
      const modal = document.getElementById('levelup-modal');
      const title = document.getElementById('levelup-title');
      const text = document.getElementById('levelup-text');
      const choicesEl = document.getElementById('levelup-choices');
      if (!modal || !choicesEl) {
        this.continuePendingLevelUpAfterSkillIncrease(pending);
        return;
      }

      const options = this.getPf2eSkillIncreaseOptions();
      if (!options.length) {
        pending.skillIncreaseDone = true;
        this.continuePendingLevelUpAfterSkillIncrease(pending);
        return;
      }

      if (title) title.textContent = `Уровень ${pending.level}! — увеличение навыка`;
      const hpNote = pending.hpGain > 0 ? ` (+${pending.hpGain} макс. ОЗ).` : '';
      if (text) {
        text.textContent = `Выберите один навык для повышения ранга (Skill Increase).${hpNote}`;
      }

      let html = options.map(opt => {
        const from = this.getPf2eSkillRankShort(opt.rank);
        const to = this.getPf2eSkillRankShort(opt.nextRank);
        return `<button type="button" class="choice levelup-skill-btn ${this.getPf2eSkillRankCss(opt.rank)}"
          ${this.onclickGame('pickPf2eSkillIncrease', opt.id)}>${this.escapeHtml(opt.label)} (${from} → ${to})</button>`;
      }).join('');

      if (pending.level % 4 === 0) {
        html += `<p class="levelup-asi-hint">Уровень ${pending.level}: черта навыка (Skill Feat) — в разработке.</p>`;
      }

      choicesEl.innerHTML = html;
      modal.classList.remove('hidden');
    },

    pickPf2eSkillIncrease(skillId) {
      const pending = this.state.pendingLevelUp;
      if (!pending || !skillId) return;
      const sys = this.activeSystem;
      const key = sys?.normalizeSkillId?.(skillId) || String(skillId).toLowerCase();
      const cur = this.state.skills?.[key];
      const next = sys?.getNextRank?.(cur);
      if (!cur || !next) return;

      this.state.skills[key] = next;
      if (!this.state.skillIncreases) this.state.skillIncreases = [];
      this.state.skillIncreases.push({ level: pending.level, skill: key, newRank: next });
      if (typeof QuestEvents !== 'undefined') {
        QuestEvents.emit('SkillLearned', { skillId: key, skill: key, rank: next, level: pending.level });
      }

      if (this.state.classData) {
        if (!this.state.classData.skillProficiency) this.state.classData.skillProficiency = {};
        this.state.classData.skillProficiency[key] = next;
      }

      const label = this.CharacterCreator?.skillLabel?.(key) || key;
      this.log(`📈 Навык «${label}»: ${this.getPf2eSkillRankShort(cur)} → ${this.getPf2eSkillRankShort(next)}`, 'log-heal');
      pending.skillIncreaseDone = true;
      this.renderProficienciesPanel();
      this.continuePendingLevelUpAfterSkillIncrease(pending);
    },

    continuePendingLevelUpAfterSkillIncrease(pending) {
      const validChoices = this.getPendingLevelChoiceIds(pending);
      if (pending.needsAsi && !pending.asiDone) {
        this.showLevelUpAsiModal(pending);
        return;
      }
      if (validChoices.length) {
        this.showLevelUpAbilityModal(pending.level, validChoices, pending.hpGain, false);
        return;
      }
      this.finishPendingLevelUp();
    },

    showLevelUpModal(level, choiceIds, hpGain, levelConfig) {
      const validChoices = (choiceIds || []).filter(id => this.resolveAbilityDefinition(id));
      const needsAsi = this.levelConfigNeedsAsi(levelConfig);
      const needsSkillInc = this.pf2eLevelGrantsSkillIncrease(level);

      if (!needsAsi && !validChoices.length && !needsSkillInc) {
        this.log('⚠️ Нет выбора на уровне ' + level, 'log-damage');
        this.renderLevelBar();
        this.resumeAfterLevelUp();
        return;
      }

      this.state.pendingLevelUp = {
        level,
        choiceIds: validChoices,
        hpGain: hpGain || 0,
        needsAsi,
        asiDone: !needsAsi,
        needsSkillIncrease: needsSkillInc,
        skillIncreaseDone: !needsSkillInc
      };

      if (needsSkillInc && !this.state.pendingLevelUp.skillIncreaseDone) {
        this.showPf2eSkillIncreaseModal(this.state.pendingLevelUp);
        const extra = needsAsi ? ' Затем — характеристики.' : (validChoices.length ? ' Затем — умение.' : '');
        this.log(`🎉 Уровень ${level}! Увеличение навыка.${extra}`, 'log-heal');
        this.renderLevelBar();
        return;
      }

      if (needsAsi) {
        this.showLevelUpAsiModal(this.state.pendingLevelUp);
        return;
      }
      this.showLevelUpAbilityModal(level, validChoices, hpGain, false);
    },

    closeLevelUpModal() {
      const modal = document.getElementById('levelup-modal');
      if (modal) modal.classList.add('hidden');
    },

    pickLevelUpAbility(abilityId) {
      const pending = this.state.pendingLevelUp;
      if (!pending) return;

      const ability = this.resolveAbilityDefinition(abilityId);
      if (!ability) {
        alert('Умение не найдено в данных progression.abilities');
        return;
      }

      this.addAbilityToPlayer(ability);
      this.log(`🎉 Новое умение: ${ability.name}`, 'log-heal');
      if (abilityId === 'ranger_favored_enemy') {
        const max = this.getMaxFavoredEnemyTypes();
        const cur = (this.state.favoredEnemyTypes || []).length;
        if (cur < max) {
          this.showFavoredEnemyPickModal({
            pickCount: max - cur,
            title: `Уровень ${pending.level}! — избранные враги`,
            intro: 'Улучшение умения: выберите ещё один тип существ (+2 урона по обоим типам).',
            onDone: () => this.finishPendingLevelUp()
          });
          return;
        }
      }
      this.finishPendingLevelUp();
    },

    checkLevelUp() {
      if (!this.isProgressionEnabled() || this.state.pendingLevelUp) return;

      while (this.state.level < this.getMaxLevel() && this.state.exp >= this.getExpThreshold(this.state.level + 1)) {
        const newLevel = this.state.level + 1;
        this.state.level = newLevel;
        if (typeof QuestEvents !== 'undefined') {
          QuestEvents.emit('PlayerLevelChanged', { level: newLevel, previousLevel: newLevel - 1 });
          QuestEvents.emit('LevelUp', { level: newLevel, previousLevel: newLevel - 1 });
        }

        const hpGain = this.applyLevelHpGain(newLevel);
        const levelConfig = this.getClassLevelConfig(newLevel);
        this.applyLevelStatBonuses(levelConfig);
        this.applyLevelResources(newLevel);

        const choices = levelConfig?.choices || [];
        const needsAsi = this.levelConfigNeedsAsi(levelConfig);
        const hasPick = needsAsi || choices.length;

        if (hasPick) {
          this.showLevelUpModal(newLevel, choices, hpGain, levelConfig);
          const extra = needsAsi ? ' Выберите улучшение характеристик' : ' Выберите умение.';
          this.log(`🎉 Уровень ${newLevel}! +${hpGain} ОЗ.${extra}`, 'log-heal');
          this.renderLevelBar();
          return;
        }

        this.log(`🎉 Уровень ${newLevel}! +${hpGain} ОЗ`, 'log-heal');
      }

      this.renderLevelBar();
      this.resumeAfterLevelUp();
    },

    // Внутри объекта GameEngine
    applyEffect(effect, target = null) {
      // Legacy string effects → object (миграции ProjectDataSchema; ветка оставлена как страховка)
      if (typeof effect === 'string') {
        if (typeof ProjectDataSchema !== 'undefined' && ProjectDataSchema.normalizeAbilityEffect) {
          effect = ProjectDataSchema.normalizeAbilityEffect(effect);
        } else {
          const s = effect.trim();
          if (s.startsWith('heal:')) effect = { type: 'heal', value: s.slice(5), targeting: { scope: 'self' } };
          else if (s.startsWith('damage:')) effect = { type: 'damage', value: s.slice(7), damageType: 'physical' };
          else if (s.startsWith('smite:')) effect = { type: 'smite', value: s.slice(6) };
          else if (s === 'magic_missile') effect = { type: 'magic_missile' };
          else if (s === 'extra_attack') effect = { type: 'extra_attack' };
          else effect = { type: 'custom', desc: s };
        }
      }
      // --- НОВЫЙ ФОРМАТ (объект) ---
      if (effect && typeof effect === 'object' && effect.type) {
        if (effect.type === 'apply_status') {
          this.applyAbilityAddEffect(effect, target);
          return true;
        }

        switch(effect.type) {
          case 'damage': {
            let dmg = this.parseRoll(effect.value);
            if (this._abilitySoundCtx?.id === 'eldritch_blast' && (this.state.level || 1) >= 5) {
              dmg += this.parseRoll('1d10');
            }
            if (typeof this.applyClimateSpellMods === 'function') {
              dmg = this.applyClimateSpellMods(dmg, effect.damageType);
            }
            const upLv = this.getUpcastLevelsAboveBase(this._abilitySoundCtx);
            if (upLv > 0) {
              const per = effect.upcastDamage || '1d6';
              for (let u = 0; u < upLv; u++) dmg += this.parseRoll(per);
            }
            let targets = [];
            const scope = effect.targeting?.scope;
            if (effect.allTargets || scope === 'all_enemies' || scope === 'area') {
              targets = this.state.enemies.filter(e => e.hp > 0);
              const abCtx = this._abilitySoundCtx;
              if (
                abCtx &&
                typeof CombatPosition !== 'undefined' &&
                CombatPosition.isEnabled(this) &&
                CombatPosition.rangeTypeRequiresSameZone(
                  CombatPosition.getAbilityRangeType(abCtx)
                )
              ) {
                const pz = CombatPosition.getPlayerPosition(this);
                targets = (this.state.enemies || []).filter(
                  (e, i) => e.hp > 0 && CombatPosition.getEnemyPosition(this, i) === pz
                );
              }
            } else if (scope === 'single') {
              if (target && target.hp > 0) {
                targets = [target];
              } else {
                const e = this.state.enemies.find(en => en.hp > 0);
                if (e) targets = [e];
              }
            } else if (target && target.hp > 0) {
              targets = [target];
            } else {
              const e = this.state.enemies.find(en => en.hp > 0);
              if (e) targets = [e];
            }
            for (let t of targets) {
              let finalDmg = dmg;
              if (effect.savingThrow) {
                const bonus = this.getSkillBonus(effect.savingThrow.skill);
                const roll = this.d20() + bonus;
                if (roll >= effect.savingThrow.dc) {
                  if (effect.savingThrow.halfOnSave) finalDmg = Math.floor(dmg/2);
                  else finalDmg = 0;
                  this.log(`🧙 Спасбросок ${effect.savingThrow.skill}: ${roll} vs ${effect.savingThrow.dc} -> ${finalDmg>0?'половина':'нет'} урона`, 'log-dice');
                } else this.log(`🧙 Спасбросок провален: ${roll} vs ${effect.savingThrow.dc}`, 'log-dice');
              }
              if (finalDmg > 0) {
                const favHit = this.addFavoredEnemyDamageToHit(t, finalDmg);
                finalDmg = favHit.total;
                t.hp -= finalDmg;
                const favNote = this.favoredEnemyDamageNote(favHit.bonus);
                this.log(`💥 ${t.name} получает ${finalDmg} ${effect.damageType||''} урона${favNote}`, 'log-damage');
                this.playAbilityHit(this._abilitySoundCtx, effect);
                if (effect.addEffect) {
                  const h = this.getEnemyEffectHolder(t);
                  if (h) this.applyStatusEffect(h, effect.addEffect, this._abilitySoundCtx?.name);
                }
              }
            }
            if (effect.addEffect && !targets.length) {
              this.applyAbilityAddEffect(effect, target);
            }
            this.renderCombat();
            break;
          }
          case 'heal': {
            const amt = this.parseRoll(effect.value);
            this.heal(amt);
            this.log(`✨ Восстановлено ${amt} ОЗ`, 'log-heal');
            this.playCombatSound(this.resolveSoundId(effect.soundHit, this._abilitySoundCtx?.soundHit, 'heal'));
            break;
          }
          case 'rage': {
            if (this.state.combat) {
              this.state.combat.rageActive = true;
              this.state.combat.tempDmgBonus = (this.state.combat.tempDmgBonus || 0) + 2;
            }
            this.log('😤 Ярость! +2 к урону оружием до конца боя.', 'log-combat');
            this.playCombatSound('buff');
            break;
          }
          case 'wild_shape': {
            const beastId = this._pendingWildShapeBeastId;
            this._pendingWildShapeBeastId = null;
            if (beastId && typeof this.enterWildShape === 'function') {
              this.enterWildShape(beastId);
            } else if (this.isInWildShape?.()) {
              this.log('Вы уже в облике зверя.', 'log-dice');
            } else {
              this.log('❌ Выберите форму зверя.', 'log-damage');
            }
            break;
          }
          case 'transformation': {
            const ability = this._abilitySoundCtx || this._pendingTransformAbility;
            const formId = this._pendingTransformFormId;
            const mods = this._pendingTransformModifiers ?? ability?.effect?.modifiers;
            this._pendingTransformFormId = null;
            this._pendingTransformModifiers = null;
            this._pendingTransformAbility = null;

            const mode = effect.mode || effect.target || 'self';
            if (mode === 'target' || mode === 'enemy') {
              const enemyIdx = this.state.combat?.selectedEnemyIndex;
              if (enemyIdx != null && formId) {
                this.transformEnemy?.(enemyIdx, formId, ability);
                break;
              }
            }

            if (typeof this.enterTransformation === 'function') {
              this.enterTransformation(formId, { ability, modifiers: mods });
            } else {
              this.log('❌ Система превращений не загружена.', 'log-damage');
            }
            break;
          }
          case 'buff': {
            this.playCombatSound(this.resolveSoundId(effect.soundCast, this._abilitySoundCtx?.soundCast, 'buff'));
            const bonus = parseInt(effect.value, 10) || 0;
            if (effect.buffType === 'ac') {
              if (this.state.combat) this.applyAcBonus(bonus);
              else this.log(`🛡️ +${bonus} КД (только в бою)`, 'log-dice');
            } else if (effect.buffType === 'atk') {
              if (this.state.combat) this.state.combat.tempAtkBonus = bonus;
              this.log(`⚔️ Временно +${bonus} к атаке`, 'log-dice');
            } else if (effect.buffType === 'dmg') {
              if (this.state.combat) this.state.combat.tempDmgBonus = (this.state.combat.tempDmgBonus || 0) + bonus;
              this.log(`⚔️ Временно +${bonus} к урону`, 'log-dice');
            }
            break;
          }
          case 'extra_attack': {
            if (this.state.combat) this.state.combat.actionSurge = true;
            this.log('⚡ Дополнительная атака в этом ходу!', 'log-combat');
            return false; // не завершает ход
          }
          case 'magic_missile': {
            const upLv = this.getUpcastLevelsAboveBase(this._abilitySoundCtx);
            const dartCount = 3 + upLv;
            let total = 0;
            for (let i = 0; i < dartCount; i++) total += this.d(4) + 1;
            const enemy = (target && target.hp > 0)
              ? target
              : this.state.enemies.find(e => e.hp > 0);
            if (enemy) {
              enemy.hp -= total;
              const castLv = this.getCastSlotLevel(this._abilitySoundCtx);
              const lvTag = castLv > 1 ? ` (круг ${castLv}, ${dartCount} снаряда)` : '';
              this.log(`✨ Магический снаряд${lvTag}: ${total} урона по ${enemy.name}!`, 'log-damage');
              this.playAbilityHit(this._abilitySoundCtx, effect);
            }
            break;
          }
          case 'smite': {
            if (this.state.combat) {
              const abCtx = this._abilitySoundCtx;
              if (abCtx && this.getAbilityActionType(abCtx) === 'reaction') {
                this.log('⚡ Кара применяется после попадания оружием.', 'log-combat');
                return false;
              }
              this.state.combat.divineSmite = true;
              this.state.combat.smiteRoll = effect.value;
              this.log('⚡ Кара — нанесите удар!', 'log-combat');
            }
            return false;
          }
          case 'detect_magic':
          case 'divine_sense':
          case 'custom': {
            this.log(effect.message || effect.desc || 'Умение активировано.', 'log-dice');
            return !this.state.combat;
          }
          default: {
            this.log(`Эффект ${effect.type} пока не реализован`, 'log-dice');
          }
        }
        return true;
      }

      // Legacy string effects нормализуются в начале applyEffect — отдельная ветка не нужна.

      // Если пассивка
      if (effect && effect.passive) {
        this.applyPassiveAbility(effect);
        return true;
      }
      this.log('Умение использовано (без эффекта).', 'log-dice');
      return true;
    },
    // ========== ЛОГ ==========
    log(msg, cls = '') {
      if (
        this.state?.combat &&
        typeof CombatLog !== 'undefined' &&
        CombatLog.isCombatLogClass(cls)
      ) {
        CombatLog.addFromLegacy(msg, cls, this);
        return;
      }
      const el = document.getElementById('log');
      if (!el) return;
      const div = document.createElement('div');
      div.className = 'log-entry ' + cls;
      div.textContent = msg;
      el.prepend(div);
    },

    /** Прямая запись в журнал боя (CombatLog.add) */
    combatLog(type, data = {}) {
      if (typeof CombatLog === 'undefined') {
        const text = data.message ?? data.text ?? '';
        this.log(text, data.cls || 'log-combat');
        return null;
      }
      return CombatLog.add(type, { ...data, engine: this });
    },

    finishCombatLogUI() {
      if (typeof CombatLog === 'undefined') return;
      const log = CombatLog.getInstance();
      if (!log) return;
      log.finishCombatSession();
    },

    /** Развернуть блок последнего боя в нижнем журнале */
    showCombatLogReview() {
      if (typeof CombatLog === 'undefined') return;
      const log = CombatLog.getInstance();
      if (!log?.hasEntries()) return;
      log.ensureDom();
      log.ensurePlacement();
      if (!log.reviewMode) log.enterArchiveMode();
      log.host?.classList.remove('hidden');
      log.expandAllRounds();
      log.scrollJournalIntoView();
    },

    syncCombatLogRound() {
      if (!this.state?.combat || typeof CombatLog === 'undefined') return;
      const log = CombatLog.attach(this);
      log.setRound(this.state.combat.round || 1, { announce: true });
    },
    // ========== ОТОБРАЖЕНИЕ ==========
    setText(txt) {
      const el = document.getElementById('story-text');
      if (el) el.textContent = this.processSceneTemplate(txt);
    },


    getChoiceUsedFlag(choice, index) {
      if (choice.doneFlag) return choice.doneFlag;
      if (choice.skillCheck) {
        if (choice.skillCheck.doneFlag) return choice.skillCheck.doneFlag;
        if (choice.skillCheck.once === false) return null;
        return `sc_${this.state.scene}_${index}`;
      }
      if (choice.once) return `ch_${this.state.scene}_${index}`;
      return null;
    },

    isChoiceUsed(choice, index) {
      const flag = this.getChoiceUsedFlag(choice, index);
      return !!(flag && this.state.flags[flag]);
    },

    markChoiceUsed(choice, index) {
      const flag = this.getChoiceUsedFlag(choice, index);
      if (!flag || this.state.flags[flag]) return;
      this.state.flags[flag] = true;
      this.saveGame();
    },

    /** Только смена стадии квеста без перехода на другую сцену */
    applyChoiceQuestSet(choiceIndex) {
      const choice = this.state.currentChoices?.[choiceIndex];
      if (!choice?.questSet) return;
      const origIdx = this.state.currentChoiceIndices?.[choiceIndex] ?? choiceIndex;
      if (this.isChoiceUsed(choice, origIdx)) return;
      if (choice.once) this.markChoiceUsed(choice, origIdx);
      this.applyChoiceReputation(choice);
      let stage = choice.questSet.stage;
      const alt = choice.questSet.stageIfHasItem;
      if (alt?.itemId && (this.state.inventory || []).includes(alt.itemId)) {
        stage = alt.stage != null ? alt.stage : stage;
      }
      this.updateQuest(choice.questSet.questId, stage);
    },

    /** Подпись кнопки выбора: icon отдельно от text, без дубля emoji в начале текста */
    formatChoiceButtonLabel(choice, disabled) {
      const rawText = (choice?.text || '').trim();
      const icon = (choice?.icon || '').trim();
      const suffix = disabled ? ' ✓' : '';
      if (!icon) return `${this.escapeHtml(rawText)}${suffix}`;
      if (rawText.startsWith(icon)) {
        return `${this.escapeHtml(rawText)}${suffix}`;
      }
      return `${this.renderIcon(icon)} ${this.escapeHtml(rawText)}${suffix}`;
    },

    pickChoice(choiceIndex) {
      const choices = this.state.currentChoices || [];
      const choice = choices[choiceIndex];
      if (!choice) return;
      if (choice.action === 'scene_element_resume' && typeof SceneElementRunner !== 'undefined') {
        SceneElementRunner.resume(this);
        return;
      }
      const origIdx = this.state.currentChoiceIndices?.[choiceIndex] ?? choiceIndex;
      if (this.isChoiceUsed(choice, origIdx)) return;
      if (choice.once) this.markChoiceUsed(choice, origIdx);
      if (choice.questSet?.questId != null && choice.questSet.stage != null) {
        let stage = choice.questSet.stage;
        const alt = choice.questSet.stageIfHasItem;
        if (alt?.itemId && (this.state.inventory || []).includes(alt.itemId)) {
          stage = alt.stage != null ? alt.stage : stage;
        }
        this.updateQuest(choice.questSet.questId, stage);
      }
      if (typeof QuestEvents !== 'undefined') {
        const npcId = choice.npc || choice.npcId;
        if (npcId) {
          QuestEvents.emit('NPCTalked', { npcId, npc: npcId, sceneId: this.state.scene });
          QuestEvents.emit('NPCDialogueFinished', { npcId, npc: npcId, sceneId: this.state.scene });
        }
        if (choice.deliverItem) {
          QuestEvents.emit('ItemDelivered', {
            itemId: choice.deliverItem,
            item: choice.deliverItem,
            npcId: choice.npc || choice.npcId,
            qty: Number(choice.deliverQty) || 1
          });
        }
        // Semantic dialogue choice event (not a quest flag). Always emit for quest tasks.
        {
          const choiceId = choice.id || choice.choiceId || choice.choiceFlag ||
            (typeof this.getChoiceUsedFlag === 'function' ? this.getChoiceUsedFlag(choice, origIdx) : null);
          const payload = {
            choiceId: choiceId || null,
            id: choiceId || null,
            flag: choice.choiceFlag || null, // legacy alias only
            sceneId: this.state.scene,
            text: choice.text || '',
            choiceIndex: origIdx
          };
          QuestEvents.emit('ChoiceSelected', payload);
          QuestEvents.emit('DialogueChoiceSelected', payload);
        }
      }
      if (choice.flags) this.applyFlags(choice.flags);
      const goldCost = Number(choice.goldCost) || 0;
      if (goldCost > 0) {
        const spent = typeof this.spendGold === 'function'
          ? this.spendGold(goldCost, {
              reason: 'choice',
              source: 'choice',
              choiceId: choice.id || choice.choiceFlag || null,
              silent: true
            })
          : null;
        if (spent && !spent.ok) {
          this.log(`❌ Нужно ${goldCost} зм.`, 'log-damage');
          return;
        }
        if (!spent) {
          if (this.state.gold < goldCost) {
            this.log(`❌ Нужно ${goldCost} зм.`, 'log-damage');
            return;
          }
          if (typeof this.changeGold === 'function') {
            this.changeGold(-goldCost, { reason: 'choice', source: 'choice', silent: true });
          } else {
            this.state.gold -= goldCost;
          }
        }
        this.updateStats();
      }
      if (Array.isArray(choice.grantItems)) {
        choice.grantItems.forEach((itemId) => this.addItem(itemId));
      }
      this.applyChoiceReputation(choice);
      if (choice.flags?.jackQuest) {
      }
      if (choice.action === 'reopen_jack_shop') {
        this.reopenJackShop();
        return;
      }
      if (choice.action === 'refill_water_flask') {
        this.refillWaterFlask();
        return;
      }
      if (choice.action === 'rest_short' || choice.action === 'rest:short') {
        this.rest('short');
        return;
      }
      if (choice.action === 'rest_long' || choice.action === 'rest:long') {
        this.rest('long');
        return;
      }
      if (choice.action === 'template_start_combat') {
        const scene = this.resolveSceneDefinition?.(this.state.scene) || this.data?.scenes?.[this.state.scene];
        const tc = scene?.templateCombat;
        if (tc?.enemies?.length) {
          const enemies = tc.enemies.map((eid) => {
            const e = this.data.enemies[eid];
            return {
              ...e,
              id: eid,
              maxHp: e.hp,
              creatureType: e.creatureType || this.getDefaultCreatureType()
            };
          });
          this.startCombat(enemies, tc.winScene, tc.enemies);
        } else {
          this.log('❌ В шаблоне боя не указаны враги.', 'log-damage');
        }
        return;
      }
      if (choice.action === 'tavern_rent_room') {
        const scene = this.resolveSceneDefinition?.(this.state.scene) || this.data?.scenes?.[this.state.scene];
        const price = scene?.tavernConfig?.roomPrice ?? 5;
        if (this.state.gold < price) {
          this.log(`❌ Нужно ${price} зм за комнату.`, 'log-damage');
          return;
        }
        if (typeof this.changeGold === 'function') this.changeGold(-price, { reason: 'buy', silent: true }); else this.state.gold -= price;
        this.updateStats();
        this.rest('long');
        this.log(`🛏️ Комната снята (−${price} зм). Долгий отдых.`, 'log-heal');
        return;
      }
      if (choice.action === 'temple_heal') {
        const scene = this.resolveSceneDefinition?.(this.state.scene) || this.data?.scenes?.[this.state.scene];
        const price = scene?.templeConfig?.healPrice ?? 25;
        if (this.state.gold < price) {
          this.log(`❌ Нужно ${price} зм.`, 'log-damage');
          return;
        }
        if (typeof this.changeGold === 'function') this.changeGold(-price, { reason: 'buy', silent: true }); else this.state.gold -= price;
        this.state.hp = this.state.maxHp;
        this.updateStats();
        this.log(`✨ Лечение (−${price} зм). ОЗ восстановлены.`, 'log-heal');
        return;
      }
      if (choice.action === 'temple_bless') {
        if (!this.state.flags) this.state.flags = {};
        this.state.flags.templeBlessed = true;
        this.log('🙏 Благословение оберегает вас в следующем бою.', 'log-combat');
        return;
      }
      if (choice.action === 'start_pending_faction_combat') {
        const pending = this.state.pendingFactionCombat;
        this.state.pendingFactionCombat = null;
        if (pending?.enemies?.length) {
          this.startCombat(pending.enemies, pending.nextScene, pending.enemyIds);
        }
        return;
      }
      const chainMatch = /^chain:(.+)$/.exec(choice.action || '');
      if (chainMatch) {
        this.executeChain(chainMatch[1]);
        return;
      }
      if (choice.to) this.showScene(choice.to);
    },

    /**
     * HTML блока «Почему недоступно?» по explainChoiceDetail.
     */
    renderChoiceUnavailableWhy(choice, ctx, lockId) {
      if (typeof ConditionSystem === 'undefined' || !ConditionSystem.explainChoiceDetail) {
        return '';
      }
      const detail = ConditionSystem.explainChoiceDetail(choice, ctx);
      const linesHtml = (detail.sections || []).map((sec) => {
        const rows = (sec.lines || []).map((ln) => {
          const mark = ln.ok ? '✓' : '❌';
          const title = this.escapeHtml(ln.title || '');
          let body = '';
          if (ln.required || ln.current) {
            body = `<div class="choice-why-meta">Требуется: ${this.escapeHtml(ln.required || '—')}<br>Сейчас: ${this.escapeHtml(ln.current || '—')}</div>`;
          } else if (ln.detail) {
            body = `<div class="choice-why-meta">${this.escapeHtml(ln.detail)}</div>`;
          }
          return `<div class="choice-why-line ${ln.ok ? 'ok' : 'fail'}">${mark} <strong>${title}</strong>${body}</div>`;
        }).join('');
        return `<div class="choice-why-section"><div class="choice-why-heading">${this.escapeHtml(sec.heading || '')}</div>${rows}</div>`;
      }).join('');
      return `<div class="choice-locked-wrap" id="${this.escapeAttr(lockId)}">
        <button type="button" class="choice choice--locked" disabled>${this.escapeHtml(detail.summary || 'Недоступно')}: ${this.escapeHtml(String(choice.text || '').replace(/<[^>]+>/g, '').trim())}</button>
        <button type="button" class="choice-why-toggle hint" ${this.onclickGame('toggleChoiceWhy', lockId)}>Почему?</button>
        <div class="choice-why-panel" hidden>
          <div class="choice-why-title">${this.escapeHtml(detail.title || 'Почему недоступно?')}</div>
          ${linesHtml}
        </div>
      </div>`;
    },

    toggleChoiceWhy(lockId) {
      const wrap = document.getElementById(lockId);
      if (!wrap) return;
      const panel = wrap.querySelector('.choice-why-panel');
      if (!panel) return;
      panel.hidden = !panel.hidden;
    },

    setChoices(choices) {
      const area = document.getElementById('choices-area');
      if (!area) return;

      const allChoices = Array.isArray(choices) ? choices : [];
      const ctx = this.getConditionContext();
      const visible = [];
      const visibleIndices = [];
      const locked = [];
      allChoices.forEach((c, i) => {
        if (ConditionSystem.isChoiceVisible(c, ctx)) {
          visible.push(c);
          visibleIndices.push(i);
        } else if (c.showIf || c.requires || c.hideIf || c.condition) {
          locked.push({ choice: c, index: i });
        }
      });
      this.state.currentChoices = visible;
      this.state.currentChoiceIndices = visibleIndices;

      const lockedHtml = locked.map(({ choice }, li) =>
        this.renderChoiceUnavailableWhy(choice, ctx, 'choice-lock-' + li)
      ).join('');

      area.innerHTML = visible.map((c, vi) => {
        const i = visibleIndices[vi];
        const disabled = this.isChoiceUsed(c, i);
        const cls = 'choice' + (disabled ? ' done' : '');
        const label = this.formatChoiceButtonLabel(c, disabled);

        if (c.skillCheck) {
          const sc = c.skillCheck;
          const usedFlag = this.getChoiceUsedFlag(c, i);
          const checkData = encodeURIComponent(JSON.stringify({
            to: c.to,
            skill: sc.skill,
            dc: sc.dc,
            sText: sc.successText || '',
            fText: sc.failText || '',
            sFlags: sc.successFlags || null,
            fFlags: sc.failFlags || null,
            sItems: sc.successItems || null,
            sNext: sc.successNext || c.to,
            fNext: sc.failNext || c.to,
            sQuestSet: sc.successQuestSet || null,
            usedFlag,
            choiceIndex: vi,
            sceneId: this.state.scene,
            exp: sc.exp,
            expOnce: sc.expOnce,
            expKey: sc.expKey
          }));

          let profMark = '';
          let rankCls = '';
          if (this.isPf2eMode()) {
            const rank = this.getPf2eSkillRank(sc.skill);
            if (rank && rank !== 'untrained') {
              const short = this.getPf2eSkillRankShort(rank);
              profMark = `<span class="choice-skill-prof ${this.getPf2eSkillRankCss(rank)}" title="Ранг: ${rank}">${short}</span> `;
              rankCls = ` choice--${rank}`;
            }
          } else if (this.isSkillProficient(sc.skill)) {
            profMark = '<span class="choice-skill-prof choice--trained" title="Владение">✓</span> ';
            rankCls = ' choice--proficient';
          }
          return `<button type="button" class="${cls}${rankCls}" ${disabled ? 'disabled' : ''} 
                    ${this.onclickGame('handleSkillCheckSafe', checkData)}>${profMark}${label}</button>`;
        }

        if (c.questSet?.questId != null && c.questSet.stage != null && !c.to && !c.skillCheck && !c.action) {
          return `<button type="button" class="${cls}" ${disabled ? 'disabled' : ''} 
                  onclick="GameEngine.applyChoiceQuestSet(${vi})">${label}</button>`;
        }

        if (c.action) {
          const classMatch = /^select_class:(.+)$/.exec(c.action);
          if (classMatch && this.data?.classes?.[classMatch[1]]) {
            return `<button type="button" class="${cls}" ${this.onclickGame('selectClass', classMatch[1])}>${label}</button>`;
          }
          if (c.action === 'start_game') return `<button type="button" class="${cls}" onclick="GameEngine.startGame()">${label}</button>`;
          if (c.action === 'reset_game') return `<button type="button" class="${cls}" onclick="GameEngine.resetGame()">${label}</button>`;
          if (c.action === 'jack_turn_in') {
            return `<button type="button" class="${cls}" ${disabled ? 'disabled' : ''} onclick="GameEngine.handleJackTurnIn()">${label}</button>`;
          }
          if (c.action === 'reopen_jack_shop') {
            return `<button type="button" class="${cls}" onclick="GameEngine.reopenJackShop()">${label}</button>`;
          }
          if (c.action === 'refill_water_flask') {
            return `<button type="button" class="${cls}" ${this.onclickGame('refillWaterFlask')}>${label}</button>`;
          }
          const travelMatch = /^travel:(.+)$/.exec(c.action);
          if (travelMatch) {
            return `<button type="button" class="${cls}" ${this.onclickGame('travelTo', travelMatch[1])}>${label}</button>`;
          }
          const passthroughMatch = /^special_passthrough:(.+)$/.exec(c.action);
          if (passthroughMatch) {
            return `<button type="button" class="${cls}" ${this.onclickGame('runSpecialScenePassthrough', passthroughMatch[1])}>${label}</button>`;
          }
          const chainMatch = /^chain:(.+)$/.exec(c.action || '');
          if (chainMatch) {
            return `<button type="button" class="${cls}" ${disabled ? 'disabled' : ''} onclick="GameEngine.runActionChain('${this.escapeAttr(chainMatch[1])}')">${label}</button>`;
          }
        }

        return `<button type="button" class="${cls}" ${disabled ? 'disabled' : ''} 
                onclick="GameEngine.pickChoice(${vi})">${label}</button>`;
      }).join('') + lockedHtml;

      /* На мобильном: две короткие кнопки в ряд */
      if (document.body.classList.contains('mobile') && !this.state.combat) {
        const allShort = visible.length >= 2 && visible.every((c) => {
          const raw = String(c.text || '').replace(/<[^>]+>/g, '').trim();
          return raw.length > 0 && raw.length <= 20;
        });
        area.classList.toggle('choices-grid--short-row', allShort);
      } else {
        area.classList.remove('choices-grid--short-row');
      }
    },

    handleSkillCheckSafe(encodedData) {
      const data = JSON.parse(decodeURIComponent(encodedData));
      const vi = data.choiceIndex;
      const origIdx = this.state.currentChoiceIndices?.[vi] ?? vi;
      const choice = this.state.currentChoices?.[vi]
        || this.data.scenes[data.sceneId || this.state.scene]?.choices?.[origIdx];

      if (data.usedFlag && this.state.flags[data.usedFlag]) return;

      if (choice) this.markChoiceUsed(choice, origIdx);
      else if (data.usedFlag) this.state.flags[data.usedFlag] = true;

      this.handleSkillCheck(
        { to: data.to },
        data.skill,
        data.dc,
        data.sText,
        data.fText,
        data.sFlags,
        data.sItems,
        data.sNext,
        data.fNext,
        data.fFlags,
        {
          exp: data.exp,
          expOnce: data.expOnce,
          expKey: data.expKey,
          successQuestSet: data.sQuestSet
        }
      );
    },
    handleSkillCheck(choice, skill, dc, successText, failText, successFlags, successItems, successNext, failNext, failFlags, skillCheckMeta) {
      const bonus = this.getSkillBonus(skill);
      const roll = this.d20() + bonus;
      const resolveNext = (next, fallback) => {
        if (typeof next === 'string' && next.trim()) return next;
        return typeof fallback === 'string' ? fallback : '';
      };

      if (roll >= dc) {
        this.log(`✅ Успех! ${skill}: ${roll} vs ${dc}`, 'log-combat');

        // Успех: показываем текст успеха
        this.setText(successText || 'Проверка пройдена!');
        this.clearDialogue();

        this.applyFlags(successFlags);

        if (successItems) {
          successItems.forEach(item => this.addItem(item));
        }

        const sQuest = skillCheckMeta?.successQuestSet;
        if (sQuest?.questId != null && sQuest.stage != null) {
          this.updateQuest(sQuest.questId, sQuest.stage);
        }

        this.awardSkillCheckExp(skill, skillCheckMeta || {});

        const next = resolveNext(successNext, choice.to);
        this.setChoices([
          { text: 'Продолжить', to: next }
        ]);

      } else {
        this.log(`❌ Провал. ${skill}: ${roll} vs ${dc}`, 'log-dice');

        // Провал: показываем текст провала
        this.setText(failText || 'Проверка провалена.');
        this.clearDialogue();

        this.applyFlags(failFlags);

        const fQuest = skillCheckMeta?.failQuestSet;
        if (fQuest?.questId != null) {
          this.failQuest(fQuest.questId, fQuest.stage || 'failed');
          if (fQuest.failScene) {
            this.showScene(fQuest.failScene);
            return;
          }
        }

        // Переход или остаёмся
        const next = resolveNext(failNext, choice.to);
        this.setChoices([
          { text: 'Продолжить', to: next }
        ]);
      }
    },

    /** @deprecated Используйте renderActiveQuests */
    renderQuestLog() {
      this.renderActiveQuests();
    },

    // ========== Мобильная панель персонажа (свёртка) ==========
    MOBILE_SIDEBAR_STORAGE_KEY: 'rpg_mobile_sidebar_compact',

    initMobileSidebar() {
      const toggles = document.querySelectorAll('.mobile-sidebar-toggle');
      if (!toggles.length || document.getElementById('sidebar')?.dataset.mobileSidebarInit) return;
      document.getElementById('sidebar').dataset.mobileSidebarInit = '1';

      toggles.forEach((btn) => {
        btn.addEventListener('click', () => {
          const compact = document.body.classList.contains('mobile-sidebar-expanded');
          this.setMobileSidebarCompact(compact);
        });
      });

      const saved = sessionStorage.getItem(this.MOBILE_SIDEBAR_STORAGE_KEY);
      const compactDefault = saved === null ? true : saved === '1';
      if (document.body.classList.contains('mobile')) {
        this.setMobileSidebarCompact(compactDefault);
      }

      if (!this._mobileSidebarResizeBound) {
        this._mobileSidebarResizeBound = true;
        window.addEventListener('rpg-mobile-change', (e) => {
          if (e.detail?.mobile) {
            const compact = sessionStorage.getItem(this.MOBILE_SIDEBAR_STORAGE_KEY);
            this.setMobileSidebarCompact(compact !== '0');
          } else {
            document.body.classList.remove('mobile-compact', 'mobile-sidebar-expanded');
            document.getElementById('sidebar')?.classList.remove('mobile-compact');
          }
        });
      }
      this.syncMobileCompactBar();
    },

    /** Свёрнутая панель персонажа на мобильном */
    setMobileSidebarCompact(compact) {
      if (!document.body.classList.contains('mobile')) return;
      document.body.classList.toggle('mobile-compact', compact);
      document.body.classList.toggle('mobile-sidebar-expanded', !compact);
      const sidebar = document.getElementById('sidebar');
      sidebar?.classList.toggle('mobile-compact', compact);

      document.querySelectorAll('.mobile-sidebar-toggle').forEach((btn) => {
        const inPanel = btn.classList.contains('mobile-sidebar-toggle--in-panel');
        btn.textContent = inPanel ? '▲' : '▼';
        btn.setAttribute('aria-expanded', compact ? 'false' : 'true');
        btn.setAttribute(
          'aria-label',
          compact ? 'Развернуть панель персонажа' : 'Свернуть панель персонажа'
        );
      });
      sessionStorage.setItem(this.MOBILE_SIDEBAR_STORAGE_KEY, compact ? '1' : '0');
    },

    syncMobileCompactBar() {
      if (!document.body.classList.contains('mobile')) return;
      const nameEl = document.getElementById('mobile-compact-name');
      const acEl = document.getElementById('mobile-compact-ac-val');
      const fill = document.getElementById('mobile-compact-hp-fill');
      if (nameEl) {
        nameEl.textContent = this.state.charName
          || document.getElementById('char-name-input')?.value
          || 'Герой';
      }
      if (acEl) {
        acEl.textContent = document.getElementById('ac-val')?.textContent || '—';
      }
      if (fill && this.state.maxHp > 0) {
        const pct = Math.max(0, (this.state.hp / this.state.maxHp) * 100);
        fill.style.width = pct + '%';
      }
    },

    /** Классы in-combat для мобильной вёрстки боя */
    updateCombatLayoutClasses() {
      const combatArea = document.getElementById('combat-area');
      const inCombat = !!(this.state.combat && combatArea && !combatArea.classList.contains('hidden'));
      document.getElementById('game-content')?.classList.toggle('in-combat', inCombat);
      document.getElementById('game-card')?.classList.toggle('in-combat', inCombat);
      if (inCombat && document.body.classList.contains('mobile')) {
        this.setMobileSidebarCompact(true);
      }
    },

  });
})();


;/* —— js/engine/inventory.js —— */
// ============================================================
// engine/inventory.js — инвентарь, экипировка, магазин
// ============================================================

(function attachEngineInventory() {
  'use strict';
  if (typeof GameEngine === 'undefined') {
    console.error('engine/inventory.js: GameEngine не определён — загрузите core.js первым');
    return;
  }

  Object.assign(GameEngine, {
    // ========== УПРАВЛЕНИЕ СОСТОЯНИЕМ ==========
    setCharName(name) {
      this.state.charName = name || 'Герой';
      const inp = document.getElementById('char-name-input');
      if (inp) inp.value = this.state.charName;
      this.syncMobileCompactBar();
    },

    SUPPLY_ITEM_ID: 'supplies',
    ARROWS_ITEM_ID: 'arrows',
    ARROWS_START_COUNT: 10,
    ARROWS_PER_BUNDLE: 10,

    isRestSupplyItem(db) {
      if (!db) return false;
      if (db.id === this.SUPPLY_ITEM_ID || db.use?.effect === 'rest_material') return true;
      return false;
    },

    isStackableItem(itemId, db) {
      if (itemId === this.ARROWS_ITEM_ID) return false;
      const d = db || this.data?.items?.[itemId];
      return itemId === this.SUPPLY_ITEM_ID || d?.stackable === true;
    },

    weaponRequiresArrows(weapon) {
      if (!weapon) return false;
      return (
        typeof CombatPosition !== 'undefined' && CombatPosition.isWeaponRanged(weapon)
      );
    },

    attackRequiresArrows(profile) {
      if (!profile?.weaponId) return false;
      const weapon =
        this.itemsData?.[profile.weaponId] || this.data?.items?.[profile.weaponId];
      return this.weaponRequiresArrows(weapon);
    },

    getArrowCount() {
      if (!this.state.inventory.includes(this.ARROWS_ITEM_ID)) return 0;
      if (!this.state.itemCharges) this.state.itemCharges = {};
      return Math.max(0, parseInt(this.state.itemCharges[this.ARROWS_ITEM_ID], 10) || 0);
    },

    setArrowCount(value) {
      if (!this.state.itemCharges) this.state.itemCharges = {};
      const max = this.getItemMaxCharges(this.ARROWS_ITEM_ID) || 9999;
      this.state.itemCharges[this.ARROWS_ITEM_ID] = Math.max(
        0,
        Math.min(max, parseInt(value, 10) || 0)
      );
    },

    addArrows(amount) {
      const n = Math.max(1, parseInt(amount, 10) || this.ARROWS_PER_BUNDLE);
      if (!this.state.inventory.includes(this.ARROWS_ITEM_ID)) {
        this.state.inventory.push(this.ARROWS_ITEM_ID);
      }
      this.setArrowCount(this.getArrowCount() + n);
      this.updateUI();
    },

    consumeOneArrow() {
      if (this.getArrowCount() <= 0) return false;
      this.setArrowCount(this.getArrowCount() - 1);
      return true;
    },

    playerHasBowInInventory() {
      const check = (itemId) => {
        const w = this.itemsData?.[itemId] || this.data?.items?.[itemId];
        return this.weaponRequiresArrows(w);
      };
      if ((this.state.inventory || []).some(check)) return true;
      if (check(this.getEquippedItemId('weapon_main'))) return true;
      if (check(this.getEquippedItemId('weapon_off'))) return true;
      return false;
    },

    initStartingArrowAmmo() {
      if (!this.playerHasBowInInventory()) return;
      if (!this.state.inventory.includes(this.ARROWS_ITEM_ID)) {
        this.state.inventory.push(this.ARROWS_ITEM_ID);
      }
      if (!this.state.itemCharges) this.state.itemCharges = {};
      if (this.state.itemCharges[this.ARROWS_ITEM_ID] == null) {
        this.state.itemCharges[this.ARROWS_ITEM_ID] = this.ARROWS_START_COUNT;
      }
    },

    migrateArrowAmmoState() {
      const id = this.ARROWS_ITEM_ID;
      let inv = [...(this.state.inventory || [])];
      const copies = inv.filter((i) => i === id).length;
      if (copies > 1) {
        inv = inv.filter((i) => i !== id);
        inv.push(id);
        this.state.inventory = inv;
        const legacy = (copies - 1) * 20;
        if (!this.state.itemCharges) this.state.itemCharges = {};
        const cur = parseInt(this.state.itemCharges[id], 10) || 0;
        this.state.itemCharges[id] = cur + legacy;
      }
      if (inv.includes(id) && this.state.itemCharges?.[id] == null) {
        if (!this.state.itemCharges) this.state.itemCharges = {};
        this.state.itemCharges[id] = this.ARROWS_START_COUNT;
      }
    },

    getSupplyCount() {
      const inv = (this.state.inventory || []).filter((id) => id === this.SUPPLY_ITEM_ID).length;
      return inv + (parseInt(this.state.supplies, 10) || 0);
    },

    consumeOneSupply() {
      const idx = (this.state.inventory || []).indexOf(this.SUPPLY_ITEM_ID);
      if (idx >= 0) {
        this.state.inventory.splice(idx, 1);
        return true;
      }
      if ((parseInt(this.state.supplies, 10) || 0) > 0) {
        this.state.supplies--;
        return true;
      }
      return false;
    },

    /** Старые сохранения: счётчик припасов + предметы в инвентаре */
    migrateSuppliesState() {
      const inv = (this.state.inventory || []).filter((id) => id === this.SUPPLY_ITEM_ID).length;
      const legacy = parseInt(this.state.supplies, 10) || 0;
      if (legacy > 0 && inv === 0) {
        for (let i = 0; i < legacy; i++) this.state.inventory.push(this.SUPPLY_ITEM_ID);
      }
      this.state.supplies = 0;
    },

    MILL_EXTERIOR_SCENES: ['mill_arrival', 'mill_door', 'mill_barn'],

    isMillSceneId(sceneId) {
      return typeof sceneId === 'string' && sceneId.startsWith('mill_');
    },

    isMillExteriorSceneId(sceneId) {
      return this.MILL_EXTERIOR_SCENES.includes(sceneId);
    },

    /** Старые сохранения: доступ в мельницу после первого проникновения */
    migrateMillAccessFlag() {
      const f = this.state.flags || {};
      if (!f.mill_infiltrated) {
        const wasInside = !!(
          f.mill_window_entry
          || f.doorBroken
          || f.foundCellar
          || f.secondFloorLoot
          || f.mill_first_perc12_fail
          || f.mill_first_perc14_fail
        );
        if (wasInside) f.mill_infiltrated = true;
      }
      if (f.mill_infiltrated && !f.mill_shortcut_unlocked) {
        const scene = this.state.scene;
        if (scene && !this.isMillSceneId(scene)) {
          f.mill_shortcut_unlocked = true;
        }
      }
    },

    /** Ярлык «Войти в мельницу» — только после ухода с площадки и возврата */
    /** Обе проверки на излучине реки использованы, медальон не найден */
    shouldFailAlbertLocketSearch() {
      if ((this.state.inventory || []).includes('elsa_locket')) return false;
      if (this.isQuestFailed('albert_locket') || this.isQuestFinished('albert_locket')) {
        return false;
      }
      const stage = this.getQuestStage('albert_locket');
      if (stage == null || stage === '' || stage === '__finished__' || stage === '__failed__') {
        return false;
      }
      if (!this.state.flags?.albert_locket_started) return false;
      return !!(
        this.state.flags.sc_river_bend_search_0 &&
        this.state.flags.sc_river_bend_search_1
      );
    },

    unlockMillShortcutOnLeave(prevSceneId, nextSceneId) {
      if (!prevSceneId || !this.isMillExteriorSceneId(prevSceneId)) return;
      if (this.isMillSceneId(nextSceneId)) return;
      this.migrateMillAccessFlag();
      if (this.state.flags?.mill_infiltrated) {
        this.state.flags.mill_shortcut_unlocked = true;
      }
    },

    getItemMaxCharges(itemId, db) {
      const d = db || this.data?.items?.[itemId];
      const n = d?.use?.maxCharges ?? d?.charges;
      const max = parseInt(n, 10);
      return Number.isFinite(max) && max > 0 ? max : 0;
    },

    getItemCharges(itemId) {
      if (itemId === this.ARROWS_ITEM_ID) {
        const max = this.getItemMaxCharges(itemId) || 9999;
        const current = this.getArrowCount();
        return { current, max };
      }
      const db = this.data?.items?.[itemId];
      const max = this.getItemMaxCharges(itemId, db);
      if (!max) return null;
      if (!this.state.itemCharges) this.state.itemCharges = {};
      if (this.state.itemCharges[itemId] == null) this.state.itemCharges[itemId] = max;
      const current = Math.max(0, Math.min(max, parseInt(this.state.itemCharges[itemId], 10) || 0));
      this.state.itemCharges[itemId] = current;
      return { current, max };
    },

    setItemCharges(itemId, value) {
      const max = this.getItemMaxCharges(itemId);
      if (!max) return;
      if (!this.state.itemCharges) this.state.itemCharges = {};
      this.state.itemCharges[itemId] = Math.max(0, Math.min(max, parseInt(value, 10) || 0));
    },

    initItemChargesOnAdd(itemId) {
      if (itemId === this.ARROWS_ITEM_ID) return;
      const max = this.getItemMaxCharges(itemId);
      if (!max) return;
      if (!this.state.itemCharges) this.state.itemCharges = {};
      if (this.state.itemCharges[itemId] == null) this.state.itemCharges[itemId] = max;
    },

    formatItemChargeHint(itemId, db) {
      if (itemId === this.ARROWS_ITEM_ID) {
        const n = this.getArrowCount();
        return n > 0 ? ` (${n})` : ' (0)';
      }
      const ch = this.getItemCharges(itemId);
      if (!ch) return '';
      return ` (${ch.current}/${ch.max})`;
    },

    sceneHasWaterSource(scene) {
      return !!(scene?.waterSource || scene?.water_source);
    },

    canRefillWaterFlaskHere() {
      if (!this.state.inventory.includes('water_flask')) return false;
      const scene = this.data?.scenes?.[this.state.scene];
      if (!this.sceneHasWaterSource(scene)) return false;
      const ch = this.getItemCharges('water_flask');
      return ch && ch.current < ch.max;
    },

    refillWaterFlask() {
      if (!this.state.inventory.includes('water_flask')) {
        this.log('❌ Нет фляги.', 'log-damage');
        return;
      }
      const scene = this.data?.scenes?.[this.state.scene];
      if (!this.sceneHasWaterSource(scene)) {
        this.log('❌ Здесь нельзя набрать воды.', 'log-damage');
        return;
      }
      const max = this.getItemMaxCharges('water_flask');
      this.setItemCharges('water_flask', max);
      this.log(`💧 Фляга наполнена (${max} глотка).`, 'log-heal');
      this.updateUI();
      this.saveGame();
    },

    withWaterRefillChoices(choices, scene) {
      const list = Array.isArray(choices) ? [...choices] : [];
      if (!this.canRefillWaterFlaskHere()) return list;
      list.push({
        text: '💧 Наполнить флягу у воды',
        action: 'refill_water_flask',
        once: false
      });
      return list;
    },

    /**
     * Изменение золота с событиями квестов.
     * @param {number} delta
     * @param {{ reason?: string, silent?: boolean }} [opts]
     */
    /**
     * Изменение золота с событиями квестов (единая точка для gain/spend).
     * @param {number} delta — +получение, −трата
     * @param {{ reason?: string, source?: string, choiceId?: string, silent?: boolean }} [opts]
     */
    changeGold(delta, opts = {}) {
      const n = Number(delta) || 0;
      if (!n) return this.state.gold;
      this.state.gold = Math.max(0, (this.state.gold || 0) + n);
      if (typeof QuestEvents !== 'undefined') {
        const payload = {
          amount: Math.abs(n),
          reason: opts.reason || null,
          source: opts.source || opts.reason || null,
          choiceId: opts.choiceId || null,
          gold: this.state.gold
        };
        if (n > 0) QuestEvents.emit('GoldGained', payload);
        else QuestEvents.emit('GoldSpent', payload);
        QuestEvents.emit('GoldSync', { gold: this.state.gold });
      }
      if (!opts.silent && typeof this.updateStats === 'function') this.updateStats();
      return this.state.gold;
    },

    /**
     * Списание золота с проверкой баланса. Реальные траты — только через эту / changeGold(-n).
     * @returns {{ ok: boolean, gold: number }}
     */
    spendGold(amount, opts = {}) {
      const n = Math.max(0, Number(amount) || 0);
      if (!n) return { ok: true, gold: this.state.gold || 0 };
      if ((this.state.gold || 0) < n) return { ok: false, gold: this.state.gold || 0 };
      this.changeGold(-n, { reason: opts.reason || 'spend', source: opts.source || opts.reason || 'spend', choiceId: opts.choiceId, silent: opts.silent });
      return { ok: true, gold: this.state.gold || 0 };
    },

    addItem(itemId) {
      if (!itemId) return;
      itemId = this.resolveItemId(itemId);
      const db = this.data?.items?.[itemId];
      if (!db) return;

      if (itemId === this.ARROWS_ITEM_ID) {
        this.addArrows(this.ARROWS_PER_BUNDLE);
        return;
      }

      const stackable = this.isStackableItem(itemId, db);
      if (stackable || !this.state.inventory.includes(itemId)) {
        this.state.inventory.push(itemId);
        this.initItemChargesOnAdd(itemId);
        if (!this.state.flags) this.state.flags = {};
        this.state.flags['it_' + itemId] = true;
        this.updateUI();
        this.checkAchievements({ type: 'item_gained', itemId });
        if (typeof QuestEvents !== 'undefined') {
          QuestEvents.emit('ItemCollected', { itemId, item: itemId, qty: 1 });
          QuestEvents.emit('InventorySync', { inventory: this.state.inventory.slice() });
        }
      }
    },

    removeItem(itemId) {
      itemId = this.resolveItemId(itemId);
      const had = (this.state.inventory || []).includes(itemId);
      this.state.inventory = this.state.inventory.filter(i => i !== itemId);
      this.unequipItem(itemId, { silent: true });
      if (had && typeof QuestEvents !== 'undefined') {
        // May be delivery or consumption — tasks filter by itemId
        QuestEvents.emit('ItemRemoved', { itemId, item: itemId });
      }
      this.updateUI();
    },

    ensureCraftingState() {
      if (!this.state.crafting || typeof this.state.crafting !== 'object') {
        this.state.crafting = { knownRecipes: [] };
      }
      if (!Array.isArray(this.state.crafting.knownRecipes)) {
        this.state.crafting.knownRecipes = [];
      }
      if (!this.state.crafting.knownRecipes.length && this.data?.recipes) {
        this.state.crafting.knownRecipes = Object.values(this.data.recipes)
          .filter((r) => r && r.startKnown !== false)
          .map((r) => r.id)
          .filter(Boolean);
      }
    },

    migrateCraftingState() {
      if (!this.data?.recipes) return;
      this.ensureCraftingState();
    },

    getRecipeById(recipeId) {
      return this.data?.recipes?.[recipeId] || null;
    },

    getAllRecipes() {
      const raw = this.data?.recipes || {};
      return Object.keys(raw).map((id) => ({ ...raw[id], id: raw[id].id || id }));
    },

    countInventoryItem(itemId) {
      const id = this.resolveItemId(itemId);
      return (this.state.inventory || []).filter((i) => i === id).length;
    },

    isRecipeKnown(recipeId) {
      this.ensureCraftingState();
      const recipe = this.getRecipeById(recipeId);
      if (!recipe) return false;
      if (recipe.startKnown === false) {
        return this.state.crafting.knownRecipes.includes(recipeId);
      }
      return true;
    },

    discoverRecipe(recipeId) {
      this.ensureCraftingState();
      if (recipeId && !this.state.crafting.knownRecipes.includes(recipeId)) {
        this.state.crafting.knownRecipes.push(recipeId);
      }
    },

    canCraftRecipe(recipeId) {
      const recipe = this.getRecipeById(recipeId);
      if (!recipe || !this.isRecipeKnown(recipeId)) return false;
      return (recipe.ingredients || []).every((ing) => {
        const id = ing.id || ing.itemId;
        const need = Math.max(1, parseInt(ing.quantity, 10) || 1);
        return this.countInventoryItem(id) >= need;
      });
    },

    getCraftableRecipes() {
      return this.getAllRecipes().filter((r) => this.canCraftRecipe(r.id));
    },

    async craft(recipeId) {
      if (!recipeId) return { success: false, error: 'no_recipe' };
      if (typeof this.runAction === 'function') {
        return this.runAction('craft_item', { recipeId });
      }
      if (typeof ActionRunner !== 'undefined' && ActionRunner.runV2) {
        return ActionRunner.runV2(this, 'craft_item', { recipeId });
      }
      return { success: false, error: 'no_runner' };
    },

    FOCUS_POTION_MS: 60 * 60 * 1000,

    expireFocusPotionIfNeeded(silent) {
      const until = this.state.flags?.focusPotionUntil;
      if (!until) return false;
      if (Date.now() >= until) {
        delete this.state.flags.focusPotionUntil;
        if (!silent) this.log('🧿 Действие зелья фокусировки закончилось.', 'log-dice');
        return true;
      }
      return false;
    },

    hasFocusPotionAdvantage() {
      this.expireFocusPotionIfNeeded(true);
      const until = this.state.flags?.focusPotionUntil;
      return typeof until === 'number' && Date.now() < until;
    },

    getFocusPotionTimeLeftLabel() {
      const until = this.state.flags?.focusPotionUntil;
      if (!until || Date.now() >= until) return '';
      const minLeft = Math.ceil((until - Date.now()) / 60000);
      if (minLeft >= 60) return '~1 ч';
      return `${minLeft} мин`;
    },

    applyFocusPotion(itemId, db) {
      const hours = Number(db?.use?.durationHours) || 1;
      this.state.flags.focusPotionUntil = Date.now() + hours * this.FOCUS_POTION_MS;
      this.log(
        `🧿 ${db.name}: преимущество на проверки концентрации (${hours} ч.)`,
        'log-heal'
      );
      this.playCombatSound(this.resolveSoundId(db?.use?.sound, 'heal', 'buff'));
      this.removeItem(itemId);
    },

    getConsumableButtonLabel(db) {
      if (db?.use?.label) return db.use.label;
      const n = (db?.name || '').toLowerCase();
      if (/зелье|эликсир|flask|potion/.test(n)) return 'Выпить';
      if (/припас|еда|хлеб|мясо/.test(n)) return 'Съесть';
      return 'Использовать';
    },

    /** Проверки перед экипировкой оружия / щита */
    resolveWeaponEquipPlan(item, targetSlot) {
      const hands = this.getWeaponHands(item);
      const slot = targetSlot === 'weapon_off' ? 'weapon_off' : 'weapon_main';
      const eq = this.state.equipped || {};
      const mainId = eq.weapon_main || eq.weapon;
      const mainItem = mainId ? this.itemsData[mainId] : null;

      if (slot === 'weapon_off') {
        if (hands === 'two') {
          return { ok: false, message: 'Второе оружие должно быть одноручным.' };
        }
        if (mainItem && this.isTwoHandedWeapon(mainItem)) {
          return { ok: false, message: 'Нельзя: в основной руке двуручное оружие.' };
        }
        if (!mainItem) {
          return { ok: false, message: 'Сначала экипируйте оружие в основную руку.' };
        }
        if (eq.shield) {
          return {
            ok: true,
            slot: 'weapon_off',
            clearSlots: ['shield'],
            notice: 'Щит снят — во второй руке оружие.'
          };
        }
        return { ok: true, slot: 'weapon_off' };
      }

      if (hands === 'two') {
        return {
          ok: true,
          slot: 'weapon_main',
          clearSlots: ['weapon_off', 'shield'],
          notice: 'Двуручное оружие требует обе руки.'
        };
      }
      return { ok: true, slot: 'weapon_main' };
    },

    equipItem(itemId, targetSlot) {
      itemId = this.resolveItemId(itemId);
      const db = this.itemsData[itemId];
      if (!db || !this.state.inventory.includes(itemId)) return;
      if (!this.isEquippableItem(db)) {
        this.log('Этот предмет нельзя экипировать.', 'log-dice');
        return;
      }
      if (this.state.combat && !this.state.combat.playerTurn) {
        this.log('Не ваш ход!', 'log-damage');
        return;
      }

      if (this.isArmorItem(db) && !this.canWearArmor(db)) {
        this.log('Слишком тяжелая броня', 'log-damage');
        return;
      }

      let slot = this.getEquipSlot(db, targetSlot);
      if (!slot) {
        this.log('Этот предмет нельзя экипировать.', 'log-dice');
        return;
      }

      if (this.isWeaponItem(db)) {
        const plan = this.resolveWeaponEquipPlan(db, targetSlot);
        if (!plan.ok) {
          this.log(`❌ ${plan.message}`, 'log-damage');
          return;
        }
        slot = plan.slot;
        if (!this.state.equipped) this.state.equipped = {};
        (plan.clearSlots || []).forEach((s) => this.clearEquipSlot(s, { silent: true }));
        if (plan.notice) this.log(plan.notice, 'log-dice');
      }

      if (this.isShieldItem(db)) {
        if (this.getEquippedItemId('weapon_off')) {
          this.clearEquipSlot('weapon_off', { silent: true });
          this.log('Во второй руке нельзя держать оружие вместе со щитом — оружие снято.', 'log-dice');
        }
        slot = 'shield';
      }

      if (!this.state.equipped) this.state.equipped = {};
      const prev = this.state.equipped[slot];
      this.state.equipped[slot] = itemId;
      if (slot === 'shield' && this.state.equipped.offhand) delete this.state.equipped.offhand;

      this.recalculateCombatStats();
      if (prev && prev !== itemId) {
        const prevDb = this.itemsData[prev];
        this.log(`🛡️ Снято: ${prevDb?.name || prev}`, 'log-dice');
      }
      this.log(`🛡️ Экипировано: ${db.name}`, 'log-heal');
      if (this.isItemCursed(db)) {
        this.recalculateCurseEffectsFromEquipment();
        const effects = this.formatCurseEffectsList(db);
        this.log(`⚠️ ${db.name} проклят! Эффекты: ${effects}`, 'log-damage');
        this.playCombatSound(this.resolveSoundId('curse_equip', 'physical_hit'), 0.45);
      } else {
        this.recalculateCurseEffectsFromEquipment();
      }
      if (typeof QuestEvents !== 'undefined') {
        QuestEvents.emit('ItemEquipped', { itemId, item: itemId, slot });
      }
      this.updateUI();
      this.saveGame();
    },

    unequipItem(itemIdOrSlot, opts = {}) {
      if (!this.state.equipped) return;

      const slots = ['weapon_main', 'weapon_off', 'armor', 'shield', 'weapon', ...this.ACCESSORY_SLOTS];
      if (slots.includes(itemIdOrSlot)) {
        const slot = itemIdOrSlot;
        const itemId = this.state.equipped[slot] || (slot === 'shield' ? this.state.equipped.offhand : null);
        if (!itemId) return;
        if (!opts.silent && !this.canUnequipItem(itemId)) return;
        delete this.state.equipped[slot];
        if (slot === 'shield') delete this.state.equipped.offhand;
        this.recalculateCombatStats();
        this.recalculateCurseEffectsFromEquipment();
        if (!opts.silent) {
          const db = this.itemsData[itemId];
          this.log(`Снято: ${db?.name || itemId}`, 'log-dice');
          this.updateUI();
          this.saveGame();
        }
        return;
      }

      const itemId = this.resolveItemId(itemIdOrSlot);
      if (!opts.silent && !this.canUnequipItem(itemId)) return;
      let removed = false;
      for (const slot of [...this.EQUIPMENT_SLOTS, 'offhand', 'accessory']) {
        if (this.state.equipped[slot] === itemId) {
          delete this.state.equipped[slot];
          removed = true;
        }
      }
      if (!removed) return;
      this.recalculateCombatStats();
      this.recalculateCurseEffectsFromEquipment();
      if (!opts.silent) {
        const db = this.itemsData[itemId];
        this.log(`Снято: ${db?.name || itemId}`, 'log-dice');
        this.updateUI();
        this.saveGame();
      }
    },

    /**
     * Использование предмета: расходник — эффект и удаление; снаряжение — экипировка; ключ — без действия.
     */
    useItem(itemKey) {
      const itemId = this.resolveItemId(itemKey);
      const db = this.data?.items?.[itemId];
      if (!db || !this.state.inventory.includes(itemId)) return;

      if (db.useAbility) {
        this.applyItemAbilityEffect(itemId);
        return;
      }

      const category = this.getInventoryCategory(db);
      if (category === 'consumable') {
        this.applyConsumableEffect(itemId);
        return;
      }
      if (this.isGameplayEquippable(db)) {
        if (this.isItemEquipped(itemId)) this.unequipItem(itemId);
        else this.equipItem(itemId);
        return;
      }
      if (this.isAccessoryItem(db)) {
        if (this.isItemEquipped(itemId)) this.unequipItem(itemId);
        else this.equipItem(itemId);
        return;
      }
      if (category === 'key') return;
      if (db.content || db.type === 'readable') this.readItem(itemId);
    },

    /** Цель расходника: self | ally | single_enemy | all_enemies (по умолчанию self) */
    getConsumableUseTarget(db) {
      const t = db?.use?.target;
      if (t === 'ally' || t === 'single_enemy' || t === 'all_enemies') return t;
      return 'self';
    },

    consumableRequiresCombat(target) {
      return target === 'single_enemy' || target === 'all_enemies';
    },

    /** Уникальные ID расходников в инвентаре (с полем use, без useAbility) */
    getInventoryConsumableIds() {
      const seen = new Set();
      const ids = [];
      for (const itemId of this.state.inventory || []) {
        if (seen.has(itemId)) continue;
        seen.add(itemId);
        const db = this.data?.items?.[itemId];
        if (!db || db.type !== 'consumable' || !db.use || db.useAbility) continue;
        if (this.isRestSupplyItem(db)) continue;
        ids.push(itemId);
      }
      return ids;
    },

    /** Расходники, которые можно применить в текущей фазе боя */
    getCombatUsableConsumables() {
      if (!this.state.combat || this.getCombatPhase() !== 'player_turn') return [];
      return this.getInventoryConsumableIds().filter(itemId => {
        const db = this.data.items[itemId];
        const target = this.getConsumableUseTarget(db);
        return !this.consumableRequiresCombat(target) || this.state.combat;
      });
    },

    /**
     * Эффект расходника: heal / damage / focus_potion / …
     * opts: { enemy } — один враг; { allEnemies: true } — все живые.
     */
    applyConsumableUseEffect(itemId, db, opts = {}) {
      const use = db.use;
      if (!use) return { itemRemoved: false };

      if (use.effect === 'heal') {
        const amount = use.amount != null
          ? Number(use.amount)
          : this.parseRoll(use.formula || '1d4');
        this.state.hp = Math.min(this.state.maxHp, this.state.hp + amount);
        this.log(`🧪 ${db.name}! +${amount} ОЗ`, 'log-heal');
        this.playCombatSound(this.resolveSoundId(use.sound, 'heal'));
        return { itemRemoved: false };
      }

      if (use.effect === 'damage') {
        const amount = use.amount != null
          ? Number(use.amount)
          : this.parseRoll(use.formula || '1d6');
        let targets = [];
        if (opts.allEnemies) {
          targets = (this.state.enemies || []).filter(e => e.hp > 0);
        } else if (opts.enemy && opts.enemy.hp > 0) {
          targets = [opts.enemy];
        }
        for (const t of targets) {
          t.hp -= amount;
          this.log(`💥 ${t.name} получает ${amount} урона (${db.name})`, 'log-damage');
        }
        this.playCombatSound(this.resolveSoundId(use.sound, use.soundHit, 'fire_hit', 'physical_hit'));
        this.renderCombat();
        return { itemRemoved: false };
      }

      if (use.effect === 'focus_potion') {
        this.applyFocusPotion(itemId, db);
        return { itemRemoved: true };
      }

      if (use.effect === 'rest_material') {
        this.log(use.message || 'Используйте отдых в боковой панели.', 'log-dice');
        return { itemRemoved: true };
      }

      if (use.effect === 'charges_heal') {
        const ch = this.getItemCharges(itemId);
        if (!ch || ch.current <= 0) {
          this.log(use.emptyMessage || 'Заряды закончились.', 'log-dice');
          return { itemRemoved: true };
        }
        const amount = use.amount != null
          ? Number(use.amount)
          : this.parseRoll(use.formula || '1d4');
        this.state.hp = Math.min(this.state.maxHp, this.state.hp + amount);
        ch.current--;
        this.setItemCharges(itemId, ch.current);
        this.log(
          `💧 ${db.name}: +${amount} ОЗ. Глотков осталось: ${ch.current}/${ch.max}`,
          'log-heal'
        );
        this.playCombatSound(this.resolveSoundId(use.sound, 'heal'));
        return { itemRemoved: true };
      }

      if (use.message) {
        this.log(use.message, 'log-dice');
      }
      return { itemRemoved: false };
    },

    /** Завершение хода после расходника в бою */
    finishConsumableCombatTurn(itemId, alreadyRemoved = false) {
      if (!alreadyRemoved) this.removeItem(itemId);
      this.updateStats();
      if (!this.state.combat) {
        this.saveGame();
        return;
      }
      this.renderCombat();
      if (this.state.enemies.every(e => e.hp <= 0)) {
        setTimeout(() => this.nextCombatTurn(), 600);
        this.saveGame();
        return;
      }
      this.state.combat.turnIndex++;
      setTimeout(() => this.nextCombatTurn(), 600);
      this.saveGame();
    },

    /** Выбор врага для расходника (target: single_enemy) */
    beginConsumableTargetSelect(itemId) {
      if (!this.state.combat) return;
      const db = this.data?.items?.[itemId];
      if (!db) return;
      const alive = this.getAliveEnemyIndices();
      if (!alive.length) {
        this.nextCombatTurn();
        return;
      }
      this.state.combat.pendingAbility = null;
      this.state.combat.pendingConsumableId = itemId;
      this.setCombatPhase('select_target');
      this.renderCombat();
      this.playerCombatTurn();
    },

    applyConsumableEffect(itemId) {
      const db = this.data.items[itemId];
      if (!db?.use) return;
      if (!this.state.inventory.includes(itemId)) return;

      if (this.isRestSupplyItem(db)) {
        this.log(db.use?.message || 'Припасы расходуются только при отдыхе.', 'log-dice');
        return;
      }

      if (this.state.combat && !this.isPlayerCombatPhase()) {
        this.log('Не ваш ход!', 'log-damage');
        return;
      }

      if (this.getCombatPhase() === 'select_target') {
        this.log('Сначала выберите цель или нажмите «Отмена».', 'log-dice');
        return;
      }

      let target = this.getConsumableUseTarget(db);
      if (target === 'ally') target = 'self';

      if (this.consumableRequiresCombat(target) && !this.state.combat) {
        this.log('Можно использовать только в бою.', 'log-damage');
        return;
      }

      this.log(`${db.icon || '🧪'} ${db.name}`, 'log-info');

      if (target === 'single_enemy') {
        this.beginConsumableTargetSelect(itemId);
        return;
      }

      if (target === 'all_enemies') {
        const result = this.applyConsumableUseEffect(itemId, db, { allEnemies: true });
        if (typeof QuestEvents !== 'undefined') {
          QuestEvents.emit('ItemUsed', { itemId, item: itemId, target: 'all_enemies' });
        }
        this.finishConsumableCombatTurn(itemId, result.itemRemoved);
        return;
      }

      const result = this.applyConsumableUseEffect(itemId, db, {});
      if (typeof QuestEvents !== 'undefined') {
        QuestEvents.emit('ItemUsed', { itemId, item: itemId, target: 'self' });
      }
      if (this.state.combat && this.getCombatPhase() === 'player_turn') {
        this.finishConsumableCombatTurn(itemId, result.itemRemoved);
      } else {
        if (!result.itemRemoved) this.removeItem(itemId);
        this.updateUI();
        this.saveGame();
      }
    },

    /** Кнопка «Использовать» у выпадашки расходников в бою */
    useCombatConsumableSelect() {
      const sel = document.getElementById('combat-consumable-select');
      const itemId = sel?.value;
      if (!itemId) {
        this.log('Выберите предмет из списка.', 'log-dice');
        return;
      }
      this.applyConsumableEffect(itemId);
    },

    /**
     * Расходник с useAbility: эффект из progression.abilities, без траты ресурсов класса.
     */
    applyItemAbilityEffect(itemId) {
      const db = this.data?.items?.[itemId];
      if (!db?.useAbility || !this.state.inventory.includes(itemId)) return;

      const ability = this.resolveAbilityDefinition(db.useAbility);
      if (!ability) {
        this.log('Предмет не сработал: умение не найдено.', 'log-damage');
        return;
      }

      if (this.state.combat && this.state.combat.playerTurn === false) {
        this.log('Не ваш ход!', 'log-damage');
        return;
      }

      if (this.isAbilityCombatOnly(ability) && !this.state.combat) {
        this.log('Этот предмет можно использовать только в бою.', 'log-dice');
        return;
      }

      const scrollAbility = JSON.parse(JSON.stringify(ability));
      scrollAbility.cost = 0;
      delete scrollAbility.spellLevel;

      this.log(`${db.icon || '📜'} ${db.name}`, 'log-info');
      this.playAbilityCast(scrollAbility);

      const endsTurn = this.applyAbilityLogic(scrollAbility);
      if (this.state.combat && this.isConcentrationAbility(scrollAbility) && typeof this.beginConcentration === 'function') {
        this.beginConcentration(scrollAbility);
      }
      this.removeItem(itemId);

      if (this.state.combat) {
        this.updateStats();
        this.renderCombat();
        if (!endsTurn) {
          this.playerCombatTurn();
          this.saveGame();
          return;
        }
        this.state.combat.turnIndex++;
        setTimeout(() => this.nextCombatTurn(), 600);
      } else {
        this.updateUI();
      }
      this.saveGame();
    },

    buildInvItemElement(itemId, db) {
      const div = document.createElement('div');
      const category = this.getInventoryCategory(db);
      const equipped = this.isItemEquipped(itemId);
      const usableScroll = !!db.useAbility;
      div.className = 'inv-item'
        + (equipped ? ' inv-item-equipped' : '')
        + (usableScroll ? ' inv-item-usable' : '');

      let actions = '';
      if (this.isWeaponItem(db)) {
        const eq = this.state.equipped || {};
        const inMain = eq.weapon_main === itemId;
        const inOff = eq.weapon_off === itemId;
        if (inMain || inOff) {
          actions = `<button type="button" class="inv-btn inv-btn-unequip" ${this.onclickGame('unequipItem', itemId)}>Снять</button>`;
        } else if (this.isTwoHandedWeapon(db)) {
          actions = `<button type="button" class="inv-btn inv-btn-equip" ${this.onclickGame('equipItem', itemId, 'weapon_main')}>Надеть (2 руки)</button>`;
        } else {
          actions = `<button type="button" class="inv-btn inv-btn-equip" ${this.onclickGame('equipItem', itemId, 'weapon_main')}>Основная</button>`
            + `<button type="button" class="inv-btn inv-btn-equip" ${this.onclickGame('equipItem', itemId, 'weapon_off')}>Вторая</button>`;
        }
      } else if (this.isGameplayEquippable(db)) {
        if (equipped) {
          actions = `<button type="button" class="inv-btn inv-btn-unequip" ${this.onclickGame('unequipItem', itemId)}>Снять</button>`;
        } else {
          actions = `<button type="button" class="inv-btn inv-btn-equip" ${this.onclickGame('equipItem', itemId)}>Надеть</button>`;
        }
      } else if (this.isAccessoryItem(db)) {
        if (equipped) {
          actions = `<button type="button" class="inv-btn inv-btn-unequip" ${this.onclickGame('unequipItem', itemId)}>Снять</button>`;
        } else {
          actions = `<button type="button" class="inv-btn inv-btn-equip" ${this.onclickGame('equipItem', itemId)}>Надеть</button>`;
        }
      } else if (db.useAbility) {
        actions = `<button type="button" class="inv-btn inv-btn-use" ${this.onclickGame('useItem', itemId)}>Использовать</button>`;
      } else if (category === 'consumable' && db.use && !this.isRestSupplyItem(db)) {
        const label = this.getConsumableButtonLabel(db);
        actions = `<button type="button" class="inv-btn inv-btn-use" ${this.onclickGame('useItem', itemId)}>${this.escapeHtml(label)}</button>`;
      } else if (this.isRestSupplyItem(db)) {
        actions = `<span class="inv-hint" title="Тратятся при отдыхе в боковой панели">для отдыха</span>`;
      } else if (category === 'quest' && (db.content || db.type === 'readable')) {
        actions = `<button type="button" class="inv-btn inv-btn-read" ${this.onclickGame('readItem', itemId)}>Читать</button>`;
      }

      const equipTag = equipped ? '<span class="inv-equipped-tag">[Экипировано]</span> ' : '';
      const cursedMark = this.isItemCursed(db) ? '<span class="inv-cursed-mark" title="Проклятый предмет">☠️</span> ' : '';
      const icon = db.icon ? `<span class="inv-item-icon" ${usableScroll ? this.onclickGame('useItem', itemId) : ''} title="${usableScroll ? 'Использовать' : ''}">${this.escapeHtml(db.icon)}</span> ` : '';
      const nameClick = usableScroll ? this.onclickGame('useItem', itemId) : this.onclickGame('showItemDesc', itemId);

      if (equipped && this.isItemCursed(db)) {
        actions = `<button type="button" class="inv-btn inv-btn-cursed" disabled title="Снять можно только у священника">⚠️ Проклято</button>`;
      }

      div.innerHTML = `
        <span class="item-name" ${nameClick} title="${this.escapeAttr(db.desc || '')}">
          ${icon}${cursedMark}${equipTag}${this.escapeHtml(db.name)}${this.escapeHtml(this.formatItemChargeHint(itemId, db))}
        </span>
        <div class="item-actions">${actions}</div>
      `;
      return div;
    },

    renderInv() {
      const el = document.getElementById('inventory-list');
      if (!el) {
        console.warn('Элемент #inventory-list не найден!');
        return;
      }

      if (!this.data || !this.data.items) {
        console.warn('Данные items не загружены');
        el.innerHTML = '<div class="inv-empty">Данные не загружены</div>';
        return;
      }

      el.innerHTML = '';

      if (!this.state.inventory.length) {
        el.innerHTML = '<div class="inv-empty">Инвентарь пуст</div>';
        return;
      }

      const buckets = { equipment: [], consumable: [], key: [], quest: [] };

      this.state.inventory.forEach(itemId => {
        const db = this.data.items[itemId];
        if (!db) {
          console.warn('Предмет не найден в базе:', itemId);
          return;
        }
        const cat = this.getInventoryCategory(db);
        buckets[cat].push({ itemId, db });
      });

      let rendered = 0;

      this.INVENTORY_SECTIONS.forEach(section => {
        const items = buckets[section.key];
        if (!items.length) return;

        const wrap = document.createElement('div');
        wrap.className = 'inv-section';

        const title = document.createElement('div');
        title.className = 'inv-section-title';
        title.textContent = section.label;
        wrap.appendChild(title);

        const list = document.createElement('div');
        list.className = 'inv-section-list';
        items.forEach(({ itemId, db }) => {
          list.appendChild(this.buildInvItemElement(itemId, db));
        });
        wrap.appendChild(list);
        el.appendChild(wrap);
        rendered += items.length;
      });

      if (!rendered) {
        el.innerHTML = '<div class="inv-empty">Инвентарь пуст</div>';
      }
    },

    showItemDesc(itemId) {
      const db = this.data.items[itemId] || { desc: 'Нет описания.' };
      this.showModal(db.name, db.desc);
    },

    useConsumable(itemId) {
      this.useItem(itemId);
    },

    readItem(itemId) {
      const db = this.data.items[itemId];
      if (!db || !db.content) return;
      this.showModal(db.name, db.content);
    },

    showModal(title, body) {
      document.getElementById('modal-title').textContent = title;
      document.getElementById('modal-body').textContent = body;
      document.getElementById('modal').classList.remove('hidden');
    },

    closeModal() {
      document.getElementById('modal').classList.add('hidden');
    },

    takeDamage(amount) {
      const dmg = Math.max(0, Number(amount) || 0);
      this.state.hp = Math.max(0, this.state.hp - dmg);
      if (dmg > 0 && typeof this.checkConcentrationAfterDamage === 'function') {
        this.checkConcentrationAfterDamage(dmg);
      }
      this.updateStats();
      if (this.state.hp <= 0) {
        if (typeof this.clearCombatConcentration === 'function') {
          this.clearCombatConcentration(true);
        }
        this.gameOver();
        return true;
      }
      return false;
    },

    heal(amount) {
      this.state.hp = Math.min(this.state.maxHp, this.state.hp + amount);
      this.updateUI();
    },

    /** Панель надетой экипировки и аксессуаров в сайдбаре */
    renderEquipmentPanel() {
      const panel = document.getElementById('equipment-slots');
      if (!panel) return;

      const mainSlots = [
        { key: 'weapon_main', label: 'Основная рука' },
        { key: 'weapon_off', label: 'Вторая рука', offHand: true },
        { key: 'armor', label: 'Броня' },
        { key: 'shield', label: 'Щит' }
      ];
      const accSlots = [
        { key: 'ring1', label: 'Кольцо 1' },
        { key: 'ring2', label: 'Кольцо 2' },
        { key: 'necklace', label: 'Ожерелье' },
        { key: 'earrings', label: 'Серьги' }
      ];

      const renderSlot = (def) => {
        const key = def.key;
        const label = def.label;
        let itemId = this.getEquippedItemId(key);
        let item = itemId ? this.itemsData[itemId] : null;
        let name = 'Пусто';
        let icon = '—';
        let unequip = '';
        let extraClass = '';

        if (def.offHand && this.isOffHandBlockedByTwoHander()) {
          name = 'Занято двуручным оружием';
          extraClass = ' equip-slot-row--blocked';
        } else if (key === 'weapon_off' && !itemId && this.getEquippedItemId('shield')) {
          itemId = this.getEquippedItemId('shield');
          item = itemId ? this.itemsData[itemId] : null;
          name = item ? `Щит: ${item.name}` : 'Щит';
          icon = item?.icon ? this.escapeHtml(item.icon) : '🛡️';
          unequip = itemId
            ? `<button type="button" class="equip-slot-btn" ${this.onclickGame('unequipItem', 'shield')} title="Снять">✕</button>`
            : '';
        } else {
          if (item) {
            const hands = this.isWeaponItem(item) ? this.getWeaponHands(item) : null;
            icon = item.icon ? this.escapeHtml(item.icon) : (hands === 'two' ? '⚔️' : '🗡️');
            name = item.name + (hands === 'two' ? ' (2 руки)' : '');
          }
          unequip = itemId
            ? `<button type="button" class="equip-slot-btn" ${this.onclickGame('unequipItem', key)} title="Снять">✕</button>`
            : '';
        }

        return `<div class="equip-slot-row${extraClass}">
          <span class="equip-slot-label">${label}</span>
          <span class="equip-slot-icon">${icon}</span>
          <span class="equip-slot-name">${this.escapeHtml(name)}</span>
          ${unequip}
        </div>`;
      };

      let html = '<div class="equip-slots-block"><div class="equip-slots-title">Экипировка</div>';
      html += mainSlots.map((s) => renderSlot(s)).join('');
      html += '</div><div class="equip-slots-block equip-slots-block--accessories">';
      html += '<div class="equip-slots-title">Аксессуары</div>';
      html += accSlots.map((s) => renderSlot({ key: s.key, label: s.label })).join('');
      html += '</div>';
      panel.innerHTML = html;
    },

    /** Блок активных проклятий в сайдбаре */
    renderCurseEffectsPanel() {
      const panel = document.getElementById('curse-effects-panel');
      const list = document.getElementById('curse-effects-list');
      if (!panel || !list) return;

      const active = Object.entries(this.state.curseEffects || {}).filter(([, v]) => v);
      if (!active.length) {
        panel.classList.add('hidden');
        list.innerHTML = '';
        return;
      }

      panel.classList.remove('hidden');
      list.innerHTML = active.map(([id]) => {
        const def = this.CURSE_EFFECT_DEFS[id] || { label: id, icon: '☠️' };
        return `<span class="curse-effect-chip" title="${this.escapeAttr(def.label)}">${def.icon}</span>`;
      }).join('');
    },

    /** Обновление интерфейса сайдбара (статы, инвентарь, квесты и т.д.) */
    updateUI() {
      this.updateStats();
      this.updateAbilityGrid();
      this.renderEquipmentPanel();
      this.renderInv();
      this.renderCurseEffectsPanel();
      this.renderAbilities();
      this.renderProficienciesPanel();
      this.renderTravelMenu();
      this.renderActiveQuests();
      this.renderAchievementsPanel();
      this.initTooltips();
    },

    /** Сайдбар: владения навыками (D&D) или ранги PF2e */
    renderProficienciesPanel() {
      const el = document.getElementById('skills-list');
      if (!el) return;

      if (this.isPf2eMode()) {
        this.migratePf2eSkillsState();
        const entries = Object.entries(this.state.skills || {}).filter(([, r]) => r && r !== 'untrained');
        if (!entries.length) {
          el.textContent = 'Навыки: —';
          return;
        }
        const cd = this.state.classData;
        const stats = cd?.stats || this.state.stats || {};
        const parts = entries.map(([id, rank]) => {
          const ru = this.CharacterCreator?.skillLabel?.(id)
            || this.activeSystem?.getSkillDefs?.()?.[id]?.ru
            || id;
          const bonus = this.activeSystem?.getSkillBonusBreakdown
            ? this.activeSystem.getSkillBonusBreakdown(id, stats, cd, this).total
            : this.getSkillBonus(id);
          const sign = bonus >= 0 ? '+' : '';
          const short = this.getPf2eSkillRankShort(rank);
          return `${ru} (${short} ${sign}${bonus})`;
        });
        el.textContent = `Навыки: ${parts.join(', ')}`;
        return;
      }

      const ids = this.getProficientSkillIds();
      if (!ids.length) {
        el.textContent = 'Владения: —';
        return;
      }
      const prof = this.getProficiencyBonus();
      const profStr = prof >= 0 ? `+${prof}` : String(prof);
      const labels = ids.map(id => {
        const ru = this.CharacterCreator?.skillLabel(id)
          || this.activeSystem?.getSkillDefs?.()?.[id]?.ru
          || id;
        return ru;
      });
      el.textContent = `Владения: ${labels.join(', ')} (${profStr})`;
    },

    /**
     * Список активных квестов в #active-quests-list из state.questStages.
     */
    renderActiveQuests() {
      const container = document.getElementById('active-quests-list');
      if (!container) return;

      if (typeof QuestRuntime !== 'undefined') {
        QuestRuntime.bind(this);
        const entries = QuestRuntime.getJournalEntries();
        if (!entries.length) {
          container.innerHTML = '<div class="hint">У вас пока нет активных заданий.</div>';
          return;
        }
        let html = '';
        entries.forEach((e) => {
          const tasksHtml = (e.tasks || []).map((t) => {
            const mark = t.done ? '✓' : '○';
            let prog = '';
            if (!t.done && t.target > 1) prog = ` (${t.progress}/${t.target})`;
            const cls = t.done ? 'quest-task done' : 'quest-task';
            return `<div class="${cls}">${mark} ${this.escapeHtml(t.text)}${prog}</div>`;
          }).join('');
          html += `
        <div class="active-quest-item">
          <div class="quest-title">${this.escapeHtml(e.title)}</div>
          <div class="quest-hint">${this.escapeHtml(e.hint || e.stageTitle || '')}</div>
          ${tasksHtml}
        </div>`;
        });
        container.innerHTML = html || '<div class="hint">Все задания выполнены!</div>';
        return;
      }

      const activeEntries = Object.entries(this.state.questStages || {});
      if (activeEntries.length === 0) {
        container.innerHTML = '<div class="hint">У вас пока нет активных заданий.</div>';
        return;
      }
      let html = '';
      activeEntries.forEach(([id, stageKey]) => {
        const quest = this.data?.quests?.[id];
        if (!quest) return;
        if (stageKey === '__failed__' || stageKey === '__finished__') return;
        const stage = QuestRuntime.getStageData(quest, stageKey);
        if (!stage || stage.finish || stage.failed) return;
        html += `
        <div class="active-quest-item">
          <div class="quest-title">${this.escapeHtml(quest.title || id)}</div>
          <div class="quest-hint">${this.escapeHtml(stage.hint || 'Задание выполняется...')}</div>
        </div>`;
      });
      container.innerHTML = html || '<div class="hint">Все задания выполнены!</div>';
    },

    updateStats() {
      const hpEl = document.getElementById('hp');
      const maxHpEl = document.getElementById('max-hp');
      const goldEl = document.getElementById('gold');
      const resEl = document.getElementById('resources');
      const supEl = document.getElementById('supplies');
      if (hpEl) hpEl.textContent = this.state.hp;
      if (maxHpEl) maxHpEl.textContent = this.state.maxHp;
      if (goldEl) goldEl.textContent = this.state.gold;
      if (resEl && this.state.resources?.mode === 'energy') {
        resEl.textContent = this.state.resources.current + '/' + this.state.resources.max;
      }
      this.renderSpellSlotsPanel();
      if (supEl) supEl.textContent = this.getSupplyCount();
      const hpBar = document.getElementById('hp-bar-fill');
      if (hpBar) {
        const pct = Math.max(0, (this.state.hp / this.state.maxHp) * 100);
        hpBar.style.width = pct + '%';
      }
      this.renderLevelBar();
      this.renderRelationsPanel();
      this.renderInv();
      if (typeof this.isInWildShape === 'function' && this.isInWildShape()) {
        const beast = typeof this.getActiveBeast === 'function' ? this.getActiveBeast() : null;
        if (beast) this.updateWildShapeStatDisplay?.(beast);
      } else if (this.state.combat && typeof this.getEffectivePlayerAC === 'function') {
        const acEl = document.getElementById('ac-val');
        const atkEl = document.getElementById('atk-val');
        if (acEl) acEl.textContent = this.getEffectivePlayerAC();
        if (atkEl) atkEl.textContent = '+' + this.getEffectivePlayerAtkBonus();
      } else {
        this.recalculateCombatStats();
      }
      this.syncMobileCompactBar();
    },

    setLocation(name) {
      const el = document.getElementById('location');
      if (el) el.textContent = name;
    },

    gameOver() {
      this.showScene('game_over');
    },

    resetGame() {
      if (confirm('Начать новую игру? Текущий прогресс будет сброшен.')) {
        localStorage.removeItem(this.getSaveKey());
      } else {
        return;
      }
      this.state.hp = 25;
      this.state.maxHp = 25;
      this.state.gold = 0;
      this.state.inventory = [];
      this.state.flags = {};
      this.state.combat = null;
      this.state.enemies = [];
      this.state.resources = { mode: 'energy', current: 0, max: 0, spellSlots: null };
      this.state.supplies = 0;
      this.state.itemCharges = {};
      this.state.classData = {};
      this.state.proficiencies = { skills: [] };
      this.state.skills = {};
      this.state.skillIncreases = [];
      this.state.equipped = {};
      this.state.curseEffects = {};
      this.state.itemEnhancements = {};
      this.state.className = '';
      this.state.charName = '';
      this.state.gender = 'male';
      this.state.questStages = {};
      this.state.sceneVisits = {};
      this.state.visitedLocations = {};
      this.state.clearedCombats = {};
      this.state.achievementUnlocks = {};
      this.state.scene = 'start';
      this.initProgressionState();
      this.updateStats();
      this.renderInv();
      const classDisplay = document.getElementById('class-display');
      if (classDisplay) classDisplay.innerHTML = '';
      const abilitiesList = document.getElementById('abilities-list');
      if (abilitiesList) abilitiesList.innerHTML = '';
      const skillsEl = document.getElementById('skills-list');
      if (skillsEl) skillsEl.textContent = '';
      document.getElementById('log').innerHTML = '';
      this.log('--- Начало новой игры ---');
      if (this.CharacterCreator?.open) this.CharacterCreator.open();
      else this.showCharacterCreator();
    },

    // ========== МАГАЗИН ==========
    getJackBuyMenuChoices() {
      const price = (base, label, to) => ({
        text: `${label} (${this.getShopPrice(base, 'rep_village')} зм)`,
        to
      });
      return [
        price(20, '🧪 Купить зелье лечения', 'jack_buy_potion'),
        price(10, '🪢 Купить верёвку', 'jack_buy_rope'),
        price(10, '🍖 Купить припасы', 'jack_buy_supplies'),
        price(15, '📜 Купить свиток Огненного шара', 'jack_buy_fireball_scroll'),
        price(22, '🧿 Купить зелье фокусировки', 'jack_buy_focus_potion'),
        { text: '← В лавку', to: 'jack_shop' }
      ];
    },

    handleJackBuyPotion() {
      const price = this.getShopPrice(20, 'rep_village');
      if (this.state.gold >= price) {
        this.spendGold(price, { reason: 'shop', source: 'jack_shop', silent: true });
        this.addItem('healing_potion');
        this.updateStats();
        this.log(`Куплено зелье лечения (-${price} зм)`);
        this.setText('Джек протягивает вам бутылочку с рубиновой жидкостью.«Держи. Пей в момент опасности — или после. Главное, не до.»');
      } else {
        this.setText('Джек хмыкает.«Денег маловато, приятель. Приходи, когда карман потяжелеет.»');
      }
      this.setChoices(this.getJackBuyMenuChoices());
    },

    handleJackBuyRope() {
      const price = this.getShopPrice(10, 'rep_village');
      if (this.state.gold >= price) {
        this.spendGold(price, { reason: 'shop', source: 'jack_shop', silent: true });
        this.addItem('rope');
        this.updateStats();
        this.log(`Куплена верёвка (-${price} зм)`);
        this.setText('Джек снимает с крюка катушку крепкой пеньковой верёвки.«Пятнадцать футов. Выдержит и тебя, и твоего врага, если захочешь его привязать.»');
      } else {
        this.setText('Джек щёлкает по кассе.«Десять золотых, не копейкой меньше. Таковы расценки.»');
      }
      this.setChoices(this.getJackBuyMenuChoices());
    },

    handleJackBuySupplies() {
      const price = this.getShopPrice(10, 'rep_village');
      if (this.state.gold >= price) {
        this.spendGold(price, { reason: 'shop', source: 'jack_shop', silent: true });
        this.addItem(this.SUPPLY_ITEM_ID);
        this.updateStats();
        this.log(`Куплены припасы (-${price} зм). Всего припасов: ` + this.getSupplyCount());
        this.setText('Джек достаёт свёрток из сухофруктов, орехов и сушёного мяса.«Провиант для путника. Одного свёртка хватит на один полноценный отдых.»');
      } else {
        this.setText('Джек качает головой.«Десять золотых. Припасы — товар дефицитный. Не могу уступить.»');
      }
      this.setChoices(this.getJackBuyMenuChoices());
    },

    handleJackBuyFireballScroll() {
      const price = this.getShopPrice(15, 'rep_village');
      if (this.state.gold >= price) {
        this.spendGold(price, { reason: 'shop', source: 'jack_shop', silent: true });
        this.addItem('fireball_scroll');
        this.updateStats();
        this.log(`Куплен свиток Огненного шара (-${price} зм)`);
        this.setText('Джек аккуратно вынимает свиток из шкатулки.«Одноразовый. В бою — и пламя сожжёт всех перед тобой. Не жги лавку.»');
      } else {
        this.setText('Джек качает головой.«Пятнадцать золотых за свиток. Магия не в кредит.»');
      }
      this.setChoices(this.getJackBuyMenuChoices());
    },

    handleJackBuyFocusPotion() {
      const price = this.getShopPrice(22, 'rep_village');
      if (this.state.gold >= price) {
        this.spendGold(price, { reason: 'shop', source: 'jack_shop', silent: true });
        this.addItem('focus_potion');
        this.updateStats();
        this.log(`Куплено зелье фокусировки (-${price} зм)`);
        this.setText('Джек подаёт флакон с мутной синей жидкостью.«Для тех, кто держит сложные заклинания. Час — и мысль ясна, концентрация крепче.»');
      } else {
        this.setText('Джек щёлкает по бутылочке.«Двадцать два золотых. Дешевле, чем потерять боевое заклинание посреди боя.»');
      }
      this.setChoices(this.getJackBuyMenuChoices());
    },
  });
})();


;/* —— js/engine/campaign-hooks.js —— */
// ============================================================
// Campaign-specific content hooks (Мельница / demo)
// Quest IDs live here, not in generic ui-renderer.
// ============================================================
(function attachCampaignHooks() {
  'use strict';
  if (typeof GameEngine === 'undefined') return;

  Object.assign(GameEngine, {
    /**
     * Claim find_albert reward (content). Uses generic applyQuestRewards + updateQuest.
     */
    claimFindAlbertReward() {
      if (this.state.flags.find_albert_rewardClaimed) return false;
      if (!this.state.flags.albertSaved) return false;
      if (!this.applyQuestRewards('find_albert', {
        claimFlag: 'find_albert_rewardClaimed',
        logGold: 'награда от Марты'
      })) {
        return false;
      }
      this.state.flags.albertAtVillage = true;
      this.updateQuest('find_albert', 'complete');
      this.updateStats();
      this.saveGame();
      return true;
    },

    handleEpilogueAlbertArrival() {
      this.state.flags.albertEscorted = true;
      this.state.flags.albertAtVillage = true;
      if (!this.state.flags.find_albert_rewardClaimed) {
        this.claimFindAlbertReward();
      }
    },

    handleMartaFindAlbertReward() {
      this.setLocation('Таверна «Кривой Котёл»');
      const claimed = this.claimFindAlbertReward();
      if (claimed) {
        this.setText(
          'Марта обнимает Альберта, потом крепко жмёт вам руки.\n\n«Ты не просто спас мельника — ты спас всю деревню. Держи награду — и знай: дверь таверны всегда открыта для тебя.»'
        );
        this.setDialogue([
          { speaker: 'Марта', text: 'Пятьдесят золотых — и моя благодарность. Альберт уже отдыхает у камина.' },
          { speaker: 'Альберт', text: 'Спасибо, ' + (this.state.charName || 'друг') + '. Без тебя я бы не выбрался.' }
        ]);
      } else {
        this.setText('Марта улыбается: «Награда уже вручена, но благодарность наша не кончается.»');
        this.clearDialogue();
      }
      const sideQuestChoices = this.getAlbertSideQuestChoices();
      this.setChoices([
        ...sideQuestChoices,
        { text: '← В таверну', to: 'tavern' },
        { text: '🏘️ На площадь', to: 'village_hub' }
      ]);
    },

    getAlbertSideQuestChoices() {
      const ctx = this.getConditionContext();
      const raw = [
        {
          text: '🗣️ Спросить Альберта о письме Люкорна',
          to: 'albert_lukorn_talk',
          questSet: { questId: 'lukorn_investigation', stage: '0' },
          showIf: {
            all: [
              { flag: 'albertSaved', equals: true },
              { notHasItem: 'lukorn_signet_ring' },
              { flag: 'lukorn_investigation_started', equals: false }
            ]
          }
        },
        {
          text: '🗣️ Поговорить с Альбертом о медальоне Эльзы',
          to: 'albert_locket_talk',
          showIf: {
            all: [
              { flag: 'albertSaved', equals: true },
              { notHasItem: 'elsa_locket' },
              { flag: 'albert_locket_started', equals: false }
            ]
          }
        }
      ];
      if (typeof ConditionSystem === 'undefined') return raw;
      return raw.filter((c) => ConditionSystem.isChoiceVisible(c, ctx));
    },

    /** Extra shop action buttons for jackShop (item/flag driven, not quest-id in renderer). */
    renderJackShopQuestButtons(cfg) {
      if (!cfg?.jackShop) return '';
      let html = '';
      if (!this.state.flags.jackQuest) {
        html += `<button type="button" class="choice shop-action-btn" onclick="GameEngine.openJackQuestTalk()">🗣️ О пропавшей сумке</button>`;
      }
      if (
        this.state.inventory.includes('jack_bag') &&
        this.state.flags.jackQuest &&
        !this.state.flags.jackRewarded
      ) {
        html += `<button type="button" class="choice shop-action-btn" onclick="GameEngine.showScene('jack_reward')">🎒 Вернуть сумку</button>`;
      }
      return html;
    }
  });
})();


;/* —— js/engine/scene-manager.js —— */
// ============================================================
// engine/scene-manager.js — сцены, переходы, special
// ============================================================

(function attachEngineSceneManager() {
  'use strict';
  if (typeof GameEngine === 'undefined') {
    console.error('engine/scene-manager.js: GameEngine не определён — загрузите core.js первым');
    return;
  }

  Object.assign(GameEngine, {
    // ========== ОТОБРАЖЕНИЕ СЦЕН ==========

    /** Глубокая копия — не мутирует GAME_DATA / scenes в памяти */
    cloneSceneData(obj) {
      if (obj == null) return obj;
      try {
        return JSON.parse(JSON.stringify(obj));
      } catch (e) {
        if (Array.isArray(obj)) return [...obj];
        if (typeof obj === 'object') return { ...obj };
        return obj;
      }
    },

    /** Поля состояния локации, перекрывающие базовую сцену */
    SCENE_STATE_OVERRIDE_FIELDS: ['text', 'audio', 'choices', 'location', 'special', 'dialogue'],

    applyLocationStateOverrides(scene, stateEntry) {
      this.SCENE_STATE_OVERRIDE_FIELDS.forEach((field) => {
        if (stateEntry[field] !== undefined && stateEntry[field] !== null) {
          scene[field] = this.cloneSceneData(stateEntry[field]);
        }
      });
    },

    /**
     * Сцена с учётом states[]: копия JSON + первое истинное condition (сверху вниз).
     * Базовые combat / flags / items / gold остаются из исходной сцены.
     */
    /** Сцена из JSON с разворотом шаблона (без клонирования) */
    resolveSceneDefinition(sceneId) {
      const raw = this.data?.scenes?.[sceneId];
      if (!raw) return null;
      if (
        raw.sceneTemplate
        && !raw.templateDetached
        && typeof SceneTemplateEngine !== 'undefined'
      ) {
        return SceneTemplateEngine.materializeScene(this.data, raw);
      }
      return raw;
    },

    getProcessedScene(sceneId) {
      const raw = this.data?.scenes?.[sceneId];
      if (!raw) return null;

      const source = this.resolveSceneDefinition(sceneId) || raw;
      const scene = this.cloneSceneData(source);
      scene.id = sceneId;

      if (typeof this.applyTimeOfDayVariant === 'function') {
        this.applyTimeOfDayVariant(scene, source);
      }

      if (!Array.isArray(scene.states) || !scene.states.length) return scene;

      const ctx = this.getConditionContext();

      for (let i = 0; i < scene.states.length; i++) {
        const st = scene.states[i];
        if (st.default === true) continue;
        if (ConditionSystem.matchesSceneState(st, ctx)) {
          this.applyLocationStateOverrides(scene, st);
          scene._activeStateIndex = i;
          scene._activeStateId = st.id || ('state_' + i);
          return scene;
        }
      }

      const fallback = scene.states.find(st => st.default === true);
      if (fallback) {
        this.applyLocationStateOverrides(scene, fallback);
        scene._activeStateIndex = -1;
        scene._activeStateId = fallback.id || 'default';
      }

      if (raw.returnsToHub && raw.hubScene) {
        scene.choices = this.withHubReturnChoices(scene.choices, raw);
      }

      return scene;
    },

    resolveSceneAudioId(audio) {
      if (audio == null || audio === '') return null;
      if (typeof audio === 'string') return audio;
      if (typeof audio === 'object') {
        return audio.ambient || audio.id || audio.track || audio.play || null;
      }
      return null;
    },

    playSceneAudio(audio) {
      if (typeof AudioEngine === 'undefined') return;
      AudioEngine.unlock();

      if (audio == null || audio === '') {
        this._sceneAmbientId = null;
        this._sceneAmbientVolume = undefined;
        AudioEngine.stopAmbient(false);
        return;
      }

      if (typeof audio === 'string') {
        this._sceneAmbientId = audio;
        this._sceneAmbientVolume = undefined;
        AudioEngine.playAmbient(audio, { loop: true });
        return;
      }

      if (typeof audio !== 'object') return;

      const ambientId = audio.ambient || audio.id || audio.track || audio.play || null;
      const vol = audio.volume != null ? Number(audio.volume) : undefined;
      const loop = audio.loop !== false;

      if (ambientId && loop) {
        if (this._sceneAmbientId === ambientId && vol === this._sceneAmbientVolume) {
          AudioEngine.applyAmbientVolume();
        } else {
          this._sceneAmbientId = ambientId;
          this._sceneAmbientVolume = vol;
          AudioEngine.playAmbient(ambientId, { loop: true, volume: vol });
        }
      } else if (ambientId && !loop) {
        this._sceneAmbientId = null;
        this._sceneAmbientVolume = undefined;
        AudioEngine.stopAmbient(false).then(() => {
          AudioEngine.playSFX(ambientId, { volume: vol });
        });
      } else {
        this._sceneAmbientId = null;
        this._sceneAmbientVolume = undefined;
        AudioEngine.stopAmbient(false);
      }

      const sfxEnter = audio.sfxOnEnter || audio.sfx || null;
      if (sfxEnter) {
        AudioEngine.playSFX(sfxEnter, {
          volume: audio.sfxVolume != null ? Number(audio.sfxVolume) : undefined
        });
      }
    },

    showScene(sceneId, options = {}) {
      const prevSceneId = this.state.scene;
      if (typeof SceneElementRunner !== 'undefined') SceneElementRunner.clearRunner(this);
      if (typeof VisualRuntime !== 'undefined' && VisualRuntime.unmount) {
        try { VisualRuntime.unmount(this); } catch (_) { /* ignore */ }
      }
      if (typeof UIRuntime !== 'undefined' && UIRuntime.mountPersistent) {
        try { UIRuntime.mountPersistent(this); } catch (_) { /* ignore */ }
      }
      try {
      this.unlockMillShortcutOnLeave(prevSceneId, sceneId);
      if (sceneId === 'river_bend_search' && this.shouldFailAlbertLocketSearch()) {
        if (!this.isQuestFailed('albert_locket')) {
          this.failQuest('albert_locket', 'failed', { silentLog: false });
        }
        sceneId = 'albert_locket_failed';
      }
      this.state.scene = sceneId;
      if (typeof QuestEvents !== 'undefined') {
        const loc = this.data?.scenes?.[sceneId]?.location || '';
        QuestEvents.emit('SceneEntered', { sceneId, scene: sceneId, location: loc });
        QuestEvents.emit('LocationVisited', { sceneId, scene: sceneId, location: loc });
      }
      if (typeof CombatLog !== 'undefined' && !this.state.combat) {
        const log = CombatLog.getInstance();
        if (log?.active) {
          log.active = false;
          log.host?.classList.remove('combat-log-host--live');
          if (log.hasEntries() && !log.reviewMode) {
            log.enterArchiveMode();
          }
        }
      }
      const rawScene = this.data.scenes[sceneId];
      if (!rawScene) {
        console.error('Сцена не найдена:', sceneId);
        this.setText('Ошибка: сцена "' + sceneId + '" не найдена в данных.');
        this.setChoices([]);
        return;
      }

      const scene = this.getProcessedScene(sceneId);
      const hasComponents = this.hasSceneComponents?.(scene) || this.hasSceneComponents?.(rawScene);

      if (sceneId === 'mill_arrival' || sceneId === 'mill_door') {
        this.migrateMillAccessFlag();
      }
      this.migrateAlbertQuestState();

      const applyRewards = this.shouldApplySceneRewards(sceneId, rawScene, options);
      if (!this.state.sceneVisits) this.state.sceneVisits = {};
      this.state.sceneVisits[sceneId] = (this.state.sceneVisits[sceneId] || 0) + 1;
      if (typeof this.applyFlags === 'function') {
        this.applyFlags({ ['loc_' + sceneId]: true });
      } else if (this.state.flags) {
        this.state.flags['loc_' + sceneId] = true;
      }

      // Обработка специальных сцен (special может прийти из states)
      if (scene.special && !options.fromSpecial && !hasComponents) {
        this.registerMapLocation(scene);
        this.handleSpecialScene(sceneId, scene, options);
        return;
      }

      if (!hasComponents) {
        this.clearSceneComponentsArea?.();
      }

      // Установка локации
      const locEl = document.getElementById('location');
      if (locEl) delete locEl.dataset.atmoAppended;
      this.setLocation(scene.location || '—');
      this.registerMapLocation(scene);

      const useSceneElements = typeof SceneElementRunner !== 'undefined' && typeof SceneElements !== 'undefined';
      if (useSceneElements) {
        SceneElements.ensureMigrated(rawScene);
      }

      // Sync: apply legacy scene.flags (incl. quest_*) before async SceneElementRunner.
      // Quest progress must update before choices/conditions render.
      // set_flag elements remain for non-quest side effects; updateQuest is idempotent for same stage.
      if (applyRewards && rawScene.flags && typeof this.applyFlags === 'function') {
        this.applyFlags(rawScene.flags);
      }

      const onEnterHasMusic = useSceneElements && (rawScene.onEnterElements || []).some((e) => e.type === 'music' && e.enabled !== false);
      if (!onEnterHasMusic) {
        if (scene.audio ?? rawScene.audio) {
          this.playSceneAudio(scene.audio ?? rawScene.audio);
        } else if (typeof WorldHierarchy !== 'undefined') {
          const inhAudio = WorldHierarchy.resolveInheritedAudio(
            WorldHierarchy.getSceneState(this.data, this.state, sceneId)
          );
          if (inhAudio) this.playSceneAudio({ ambient: inhAudio, loop: true });
        }
      }
      if (typeof this.applyInheritedSceneAmbience === 'function') {
        this.applyInheritedSceneAmbience(sceneId);
      }

      // Обработка текста с подстановками
      let text = scene.text || '';
      if (sceneId === 'jack_reward' && this.state.flags.jackRewarded) {
        text = 'Джек перебирает товар на полках. Увидев вас, улыбается.\n\n«А, мой герой! Сумка на месте — всё честно. Заходи, если что понадобится.»';
      } else if (sceneId === 'village_accept' && this.state.flags.haggleWon) {
        text = 'Марта кивает.\n\n«Пятьдесят золотых у тебя — я помню. Иди по тропе на север, не теряй время.»';
      } else if (sceneId === 'village_accept' && this.state.flags.haggleLost) {
        text = 'Марта кивает.\n\n«Двадцать пять — и точка, мы договорились. Мельница ждёт.»';
      }
      this.setText(text);

      // Диалоги
      if (sceneId === 'jack_reward' && this.state.flags.jackRewarded) {
        this.clearDialogue();
      } else if (scene.dialogue && scene.dialogue.length > 0) {
        this.setDialogue(scene.dialogue);
      } else {
        this.clearDialogue();
      }

      if (applyRewards && sceneId === 'epilogue' && this.state.flags.albertSaved) {
        this.handleEpilogueAlbertArrival();
      }

      // Optional Visual overlay (Phase 1.3) — additive; no-op if scene.visual absent
      if (typeof VisualRuntime !== 'undefined' && VisualRuntime.onSceneShown) {
        try { VisualRuntime.onSceneShown(this, sceneId, rawScene); } catch (_) { /* ignore */ }
      }
      if (typeof UIRuntime !== 'undefined' && UIRuntime.onSceneShown) {
        try { UIRuntime.onSceneShown(this, sceneId); } catch (_) { /* ignore */ }
      }

      // Phase E — authoring scene.events.enter (no-code chain)
      const enterSteps = rawScene.events?.enter;
      if (Array.isArray(enterSteps) && enterSteps.length) {
        const eng = this;
        enterSteps.forEach((step) => {
          if (!step || !step.action) return;
          try {
            if (typeof eng.runAction === 'function') {
              Promise.resolve(eng.runAction(step.action, step.params || {}, { source: 'scene_enter' })).catch(function () {});
            } else if (typeof ActionRunner !== 'undefined' && ActionRunner.runV2) {
              ActionRunner.runV2(eng, step.action, step.params || {}, { source: 'scene_enter' });
            }
          } catch (_) { /* ignore */ }
        });
      }

      if (useSceneElements) {
        SceneElementRunner.runSceneFlow(this, {
          sceneId,
          scene,
          rawScene,
          options,
          applyRewards,
          text,
          hasComponents
        });
        return;
      }

      // Legacy fallback (без scene-elements.js)
      if (applyRewards) {
        this.applyFlags(rawScene.flags);
        this.awardSceneExp(rawScene);
        if (rawScene.items) {
          rawScene.items.forEach(itemId => this.addItem(itemId));
        }
        this.awardSceneGold(rawScene, sceneId);
      }
      this.maybeAlbertWalksToVillage(sceneId);
      if (applyRewards && rawScene.npcId) {
        this.applyNpcReputationEffects(rawScene.npcId, 'talk');
      }
      if (rawScene.combat && rawScene.combat.length > 0) {
        if (this.isCombatSceneCleared(sceneId)) {
          const after = rawScene.nextScene;
          if (after && this.data.scenes[after]) {
            this.showScene(after, options);
            return;
          }
        }
        if (!applyRewards) {
          if (scene.choices?.length) {
            this.setChoices(scene.choices);
          } else {
            const bodies = this.formatClearedBodiesMapNote(
              rawScene.clearedMapLabel || this.inferClearedCombatMapLabel(rawScene.combat)
            );
            const note = this.isCombatSceneCleared(sceneId)
              ? `\n\n☠️ Здесь уже лежат ${bodies}. Бой не повторяется.`
              : '\n\n⚠️ Вы уже были здесь — бой не начинается повторно.';
            this.setText((text || '') + note);
            const fallbackTo = rawScene.nextScene
              || this.resolveMapTravelScene(rawScene.mapLocation)
              || 'village';
            if (fallbackTo && this.data.scenes[fallbackTo]) {
              this.setChoices([{ text: '➡️ Продолжить', to: fallbackTo }]);
            } else {
              this.setChoices([]);
            }
          }
          this.renderTravelMenu();
          return;
        }
        const missing = rawScene.combat.filter(eid => !this.data.enemies?.[eid]);
        if (missing.length) {
          console.error('Враги не найдены:', missing.join(', '));
          this.setText('Ошибка данных: не найдены враги: ' + missing.join(', '));
          this.setChoices([]);
          return;
        }
        const enemies = rawScene.combat.map(eid => {
          const e = this.data.enemies[eid];
          return {
            ...e,
            id: eid,
            maxHp: e.hp,
            creatureType: e.creatureType || this.getDefaultCreatureType()
          };
        });
        if (this.tryEnterCombatWithReputation(rawScene, enemies)) return;
        this.startCombat(enemies, rawScene.nextScene, rawScene.combat);
        return;
      }
      if (hasComponents) {
        const sceneWithComponents = scene.components?.length ? scene : { ...scene, components: rawScene.components };
        this.renderSceneComponents(sceneId, sceneWithComponents);
        this._runSceneChainOnEnter?.(sceneWithComponents.components);
        this.renderTravelMenu();
        this.initTooltips();
        return;
      }
      const sceneChoices = this.withWaterRefillChoices(scene.choices, rawScene);
      if (sceneChoices.length) {
        this.setChoices(sceneChoices);
      } else {
        this.setChoices([]);
      }
      this.renderTravelMenu();
      this.initTooltips();
      if (typeof this.getTimePeriod === 'function') {
        this._lastSceneTimePeriod = this.getTimePeriod();
      }
      } finally {
        this.checkAchievements({ type: 'scene_change', sceneId });
        this.autosaveOnSceneChange(prevSceneId);
      }
    },

    handleSpecialScene(sceneId, scene, options = {}) {
      if (typeof SpecialSceneRegistry !== 'undefined' && SpecialSceneRegistry.run(this, sceneId, scene)) {
        return;
      }
      if (this.runSpecialScenePassthrough(sceneId, scene, options)) {
        return;
      }
      const hint = 'Добавьте обработчик через SpecialSceneRegistry.register() или опишите в plugins.specialScenes в JSON.';
      this.setLocation(scene.location || '—');
      this.setText('⚠️ Неизвестный special: «' + scene.special + '».\n\n' + hint + '\n\nЗаполните текст и выборы в редакторе — сцена откроется как обычная.');
      this.setChoices([
        { text: '↺ Попробовать показать как обычную сцену', action: 'special_passthrough:' + sceneId },
        { text: '← Назад', to: this.getSceneExitTarget(scene) }
      ]);
    },

    runSpecialScenePassthrough(sceneId, scene, options = {}) {
      const processed = this.getProcessedScene(sceneId) || scene;
      const hasContent = !!(
        processed.text?.trim()
        || processed.choices?.length
        || processed.dialogue?.length
      );
      if (!hasContent) return false;
      this.showScene(sceneId, { ...options, fromSpecial: true });
      return true;
    },

    handleResetFromSpecial() {
      this.resetGame();
    },

    // ========== СПЕЦИАЛЬНЫЕ ОБРАБОТЧИКИ ==========
    handleHaggle() {
      if (this.state.flags.haggleDone) {
        this.setText('Марта отмахивается: «Мы уже договорились о плате. Больше не торгуюсь.»');
        this.setDialogue([]);
        const scene = this.data?.scenes?.[this.state.scene];
        this.setChoices([{ text: '← Вернуться к разговору с Мартой', to: this.getSceneExitTarget(scene) }]);
        return;
      }
      const roll = this.d20();
      const bonus = this.getSkillBonus('persuasion');
      const total = roll + bonus;

      if (total >= 14) {
        this.state.gold += 50;
        this.setText('Марта хмурится, потом достаёт кошелёк.\n\n«Чёрт с тобой. Пятьдесят. Но если Альберт погиб по твоей вине — ты ответишь перед ополчением.»');
        this.setDialogue([]);
        this.log(`Торг: успех! 50 зм (к20=${roll}+${bonus >= 0 ? '+' : ''}${bonus}=${total})`);
        this.state.flags.haggleWon = true;
      } else {
        this.state.gold += 25;
        this.state.flags.haggleLost = true;
        this.setText('Марта фыркает.\n\n«Двадцать пять — и точка. Не нравится — иди мимо. Других желающих нет.»');
        this.setDialogue([]);
        this.log(`Торг: 25 зм (к20=${roll}+${bonus >= 0 ? '+' : ''}${bonus}=${total})`);
      }
      this.state.flags.haggleDone = true;
      this.updateStats();
      this.setChoices([
        { text: '← Вернуться к разговору с Мартой', to: 'village' }
      ]);
    },

    /** Лавка Джека: универсальный интерфейс покупки/продажи (special shop_jack) */
    handleShopJack(sceneId, scene) {
      const sid = sceneId || this.state.scene;
      const sc = scene || this.data?.scenes?.[sid];
      const visited = this.state.flags.shopVisited;
      if (!visited) this.state.flags.shopVisited = true;

      const welcome = 'Лавка пахнет сухофруктами, кожей и чем-то сладковатым. За прилавком — худой мужчина с хитрой улыбкой и лисьими глазами. Он поправляет жёлтый берет.\n\n«Добро пожаловать! Покупай, продавай — честная цена.»';
      const revisit = 'Джек сидит за прилавком, перебирает бусины на счётах.«Ну, смотри, выбирай.»';
      const merged = {
        ...sc,
        location: sc?.location || 'Лавка Пройдохи Джека',
        text: (sc?.text && sc.text.trim()) ? sc.text : (visited ? revisit : welcome),
        shopConfig: this.getJackShopConfig(sc)
      };
      this.handleShop(sid, merged);
    },

    /** Из лавки — диалог о пропавшей сумке (после возврата снова открывается jack_shop) */
    openJackQuestTalk() {
      if (this.state.combat) return;
      this.state.shopSession = null;
      this.showScene('jack_quest_talk');
    },

    /** После принятия квеста — снова прилавок Джека */
    reopenJackShop() {
      if (this.state.combat) return;
      this.showScene('jack_shop');
    },

    handleForestLoot() {
      const bonus = this.getSkillBonus('perception');
      const roll = this.d20() + bonus;
      if (roll >= 12 && !this.state.flags.forestPotion) {
        this.state.flags.forestPotion = true;
        this.addItem('healing_potion');
        this.setText('В сумке — свёрток из кожи. Внутри бутылочка с рубиновой жидкостью. Зелье лечения.');
        this.log(`Найдено зелье! (${roll})`);
      } else {
        this.setText('Больше ничего ценного. Гнилой хлеб, игральные кости, нож с выбитой рукоятью.');
      }
      this.setChoices([
        { text: 'Продолжить путь', to: 'thicket' }
      ]);
    },

    handleBarnChest() {
      if (!this.state.flags.barnChestOpen) {
        this.state.flags.barnChestOpen = true;
        this.state.gold += 15;
        this.updateStats();
        this.setText('В ящике — старые долота, клочок шерсти, и кошелёк с пятнадцатью золотыми. Сбережения Альберта.');
        this.log('Найдено 15 зм');
      } else {
        this.setText('Ящик пуст.');
      }
      this.setChoices([
        { text: 'Вернуться к мельнице', to: 'mill_arrival' }
      ]);
    },

    handleAttic() {
      const visited = this.state.flags.atticVisited;
      if (!visited) {
        this.state.flags.atticVisited = true;
        this.setText('Чердак просторный. Огромное колесо механизма. Одна шестерня сорвана и лежит в углу. Вал пустой — без неё механизм мёртв.\nНа полу три паза для шестерни.');
        this.setChoices([
          { text: '🔧 Вставить в верхний паз', to: 'mill_attic_gear_top' },
          { text: '🔧 Вставить в средний паз', to: 'mill_attic_gear_mid' },
          { text: '🔧 Вставить в нижний паз', to: 'mill_attic_gear_bot' },
          { text: '📋 Вспомнить чертёж из сарая', to: 'mill_attic_blueprint' },
          { text: '⬇️ Спуститься', to: 'mill_second' }
        ]);
      } else {
        if (this.state.flags.gearFixed && !this.state.flags.corvinSpawned) {
          this.state.flags.corvinSpawned = true;
          this.setText('Механизм грохочет. Из-за мешков выходит мужчина в кирасе. Длинный меч. Он смотрит без страха — только усталость.');
          this.setDialogue([
            { speaker: 'Корвин', text: 'Ты не первый, кто пришёл сюда. Но первый, кто добрался так далеко. Жаль. Мне не хотелось убивать, но мельница — хорошее укрытие. А ты — помеха.' }
          ]);
          this.setChoices([
            { text: '🗣️ «Сдавайся»', to: 'boss_talk' },
            { text: '🗣️ «Где Альберт?»', to: 'boss_albert' },
            { text: '⚔️ Атаковать', to: 'boss_fight' }
          ]);
          return;
        }
        this.setText(this.state.flags.gearFixed ? 'Чердак. Механизм грохочет, колесо крутится.' : 'Чердак. Механизм мёртв.');
        this.setChoices([
          { text: 'Спуститься', to: 'mill_second' }
        ]);
      }
    },

    handleBossTalk() {
      this.setDialogue([
        { speaker: 'Корвин', text: 'Окружён? Тут только ты и я. И механизм, который скоро развалится. Я бы ушёл, но ты видел слишком много.' }
      ]);
      this.setChoices([
        { text: '«Уходи, я не преследую»', to: 'boss_mercy' },
        { text: '«Тогда — оружие»', to: 'boss_fight' }
      ]);
    },

    handleBossAlbert() {
      this.setDialogue([
        { speaker: 'Корвин', text: 'Старый мельник? Жив. В погребе, с псом. Мы не убийцы — торговцы. Просто... не совсем честные. Железо, меха. Но ты всё испортил.' }
      ]);
      this.setChoices([
        { text: '«Я заберу его и уйду. Ты — тоже»', to: 'boss_mercy' },
        { text: '«Нет. Ты идёшь со мной»', to: 'boss_fight' }
      ]);
    },

    handleBossMercy() {
      const bonus = this.getSkillBonus('persuasion');
      const roll = this.d20() + bonus;
      if (roll >= 15) {
        this.setText('Корвин смотрит долго. Потом опускает меч.');
        this.setDialogue([
          { speaker: 'Корвин', text: '...Ладно. Забирай старика. Скажи деревне, что я ушёл в лес. Больше не вернусь. Но если встретимся снова — я не прощу.' }
        ]);
        this.state.flags.corvinSpared = true;
        this.setChoices([
          { text: 'Спуститься в погреб', to: 'cellar_after' }
        ]);
      } else {
        this.setText('Корвин усмехается.');
        this.setDialogue([
          { speaker: 'Корвин', text: 'Милосердие? От воина? Нет, друг. Мир жесток. Докажи, что достоин жить.' }
        ]);
        this.setChoices([
          { text: 'Вступить в бой', to: 'boss_fight' }
        ]);
      }
    },

    handleCellarFirst() {
      if (!this.state.flags.cellarVisited) {
        this.state.flags.cellarVisited = true;
        this.setText('Лестница ведёт в сырой каменный погреб. Тусклый факел. В клетке — мужчина в лохмотьях (Альберт) и привязанный пёс Гризли.\nТрое бандитов пересчитывают товар. Один замечает вас.');
        this.setChoices([
          { text: '⚔️ Ворваться в бой', to: 'cellar_combat' },
          { text: '🗣️ «Опустите оружие!»', to: 'cellar_intimidate' }
        ]);
      } else {
        this.setText('Погреб.');
        this.setChoices([
          { text: 'К Альберту', to: 'cellar_after' }
        ]);
      }
    },

    handleCellarIntimidate() {
      const bonus = this.getSkillBonus('intimidation');
      const roll = this.d20() + bonus;
      if (roll >= 14) {
        this.setText('Бандиты переглядываются. Громила опускает дубину.');
        this.setDialogue([
          { speaker: 'Бандит', text: 'Чёрт... Корвин говорил, что нас никто не тронет. Ладно, мы уходим.' }
        ]);
        this.state.flags.banditsFled = true;
        this.setChoices([
          { text: 'Позволить уйти', to: 'cellar_after' },
          { text: '«Руки за голову»', to: 'cellar_combat' }
        ]);
      } else {
        this.setText('Бандит хмыкает.');
        this.setDialogue([
          { speaker: 'Бандит', text: 'Один на троих? Ты шутишь. Ребята — в него!' }
        ]);
        this.setChoices([
          { text: 'Бой', to: 'cellar_combat' }
        ]);
      }
    },

    handleCellarAfter() {
      this.setLocation('Погреб');
      if (this.state.flags.albertSaved) {
        this.setText('Погреб пуст. Альберт и Гризли ушли. Остались только следы борьбы и разбросанные мешки.');
        this.setChoices([
          { text: '🔍 Осмотреть погреб ещё раз', to: 'cellar_search' },
          ...this.getAlbertSideQuestChoices(),
          { text: '🏚️ Вернуться к мельнице', to: 'mill_arrival' },
          { text: '🌲 Вернуться в деревню', to: 'epilogue' }
        ]);
        return;
      }
      this.setText('В погребе пахнет кровью и плесенью. Альберт смотрит из клетки. Гризли рычит, потом виляет хвостом.');
      this.setDialogue([
        { speaker: 'Альберт', text: 'Боги... ты пришёл. Я думал, умру. Эти гады держали меня трое суток. Корвин на чердаке, наверное.' },
        { speaker: 'Альберт', text: 'Механизм... если запустить жернова, шум заглушит всё. Ключ у меня был, но отобрали. Возьми — в кармане у Громилы.' }
      ]);
      if (!this.state.inventory.includes('safe_key')) this.addItem('safe_key');
      const choices = [];
      if (!this.state.flags.dogFreed) choices.push({ text: '🐕 Освободить Гризли', to: 'cellar_dog' });
      choices.push({ text: '🔍 Осмотреть погреб', to: 'cellar_search' });
      choices.push({ text: '🗣️ «Корвин мёртв / сбежал. Вы свободны»', to: 'cellar_free' });
      this.setChoices(choices);
    },

    handleCellarSearch() {
      const bonus = this.getSkillBonus('perception');
      const roll = this.d20() + bonus;
      if (roll >= 12 && !this.state.flags.cellarLoot) {
        this.state.flags.cellarLoot = true;
        this.state.gold += 8;
        this.updateStats();
        this.setText('В ящике — украденные меха, два железных слитка и 8 золотых.');
        this.addItem('iron_ingots');
      } else {
        this.setText('Товар краденый, но ничего лично ценного.');
      }
      const choices = [
        { text: '🗣️ Поговорить с Альбертом', to: 'cellar_free' }
      ];
      if (!this.state.flags.dogFreed) choices.unshift({ text: '🐕 Освободить Гризли', to: 'cellar_dog' });
      if (!this.state.flags.albertSaved) choices.unshift({ text: '🔓 Освободить Альберта', to: 'cellar_free' });
      choices.push({ text: '🏚️ Вернуться к мельнице', to: 'mill_arrival' });
      this.setChoices(choices);
    },

    // ========== ГОЛОВОЛОМКА С ШЕСТЕРНЁЙ ==========
    gearPuzzle(choice) {
      const correct = 'mid';
      if (this.state.flags.gearFixed) { this.showScene('mill_attic'); return; }
      if (choice === correct) {
        this.state.flags.gearFixed = true;
        this.setText('Шестерня встаёт идеально. Механизм с грохотом оживает — колесо крутится. Шум оглушает, пыль взмывает.\n\nЭтот грохот маскирует шаги. Или... привлекает кого-то?');
        this.log('Механизм запущен!');
        this.setChoices([
          { text: 'Осмотреть чердак', to: 'mill_attic' }
        ]);
      } else {
        this.setText('Шестерня входит туго, но при обороте заедает. Ржавый трос обрывается!');
        const bonus = this.getSkillBonus('dexterity');
        const roll = this.d20() + bonus;
        if (roll >= 12) {
          this.log(`Увернулись: ${roll} vs 12`);
          this.setText('Вы уворачиваетесь. Трос падает рядом. Шестерня сломана — механизм мёртв.');
        } else {
          const dmg = this.d(6);
          this.takeDamage(dmg);
          this.log(`Трос ударил: ${dmg} урона`, 'log-damage');
          this.setText(`Трос бьёт вас, сбивая с ног. ${dmg} урона. Шестерня сломана.`);
        }
        this.state.flags.gearBroken = true;
        this.setChoices([
          { text: 'Спуститься', to: 'mill_second' }
        ]);
      }
    },

    // ========== ШЕСТЕРНИ ==========
    handleGearTop() {
      this.gearPuzzle('top');
    },

    handleGearMid() {
      this.gearPuzzle('mid');
    },

    handleGearBot() {
      this.gearPuzzle('bot');
    },

  });
})();


;/* —— js/engine/combat.js —— */
// ============================================================
// engine/combat.js — боевая система
// ============================================================

(function attachEngineCombat() {
  'use strict';
  if (typeof GameEngine === 'undefined') {
    console.error('engine/combat.js: GameEngine не определён — загрузите core.js первым');
    return;
  }

  Object.assign(GameEngine, {
    // ========== БОЙ ==========

    /** Правила инициативы текущей сцены (combatInitiative в JSON сцены) */
    getCombatInitiativeRules() {
      if (typeof CombatTimeline !== 'undefined' && CombatTimeline.getSceneInitiativeRules) {
        return CombatTimeline.getSceneInitiativeRules(this);
      }
      return {};
    },

    /** Синхронизация combat.battleParticipants для UI (timeline) */
    syncBattleParticipants() {
      if (typeof CombatTimeline === 'undefined') return [];
      return CombatTimeline.syncBattleState(this);
    },

    updateCombatTimeline() {
      if (typeof CombatTimeline === 'undefined') return;
      if (!this.state.combat) {
        CombatTimeline.getInstance()?.hide();
        return;
      }
      const tl = CombatTimeline.attach(this);
      this.syncBattleParticipants();
      tl.update(this.state.combat, this);
    },

    /**
     * Бросок инициативы и порядок ходов.
     * Учитывает combatInitiative сцены: бонусы, засада, «враги ходят первыми».
     */
    buildCombatInitiativeOrder() {
      const rules = this.getCombatInitiativeRules();
      const pDie = this.d20();
      const pBonus = (this.state.classData?.initBonus ?? 0) + (rules.playerBonus || 0);
      const pRoll = pDie + pBonus;

      const eRolls = this.state.enemies.map((e, i) => {
        const die = this.d20();
        const bonus = (parseInt(e.dex, 10) || 2) + (rules.enemyBonus || 0);
        return { i, die, bonus, roll: die + bonus };
      });

      let order = [{ type: 'player', die: pDie, bonus: pBonus, roll: pRoll }];
      eRolls.forEach((e) => {
        order.push({ type: 'enemy', index: e.i, die: e.die, bonus: e.bonus, roll: e.roll });
      });

      if (rules.enemiesActFirst || rules.surpriseRound) {
        const enemies = order
          .filter((o) => o.type === 'enemy')
          .sort((a, b) => b.roll - a.roll);
        const player = order.find((o) => o.type === 'player');
        order = player ? [...enemies, player] : enemies;
      } else {
        order.sort((a, b) => {
          if (b.roll !== a.roll) return b.roll - a.roll;
          if (a.type === 'player') return -1;
          if (b.type === 'player') return 1;
          return 0;
        });
      }

      return { order, rules, pRoll };
    },

    /** Отложить ход (Delay) — игрок уходит в конец очереди */
    delayTurn() {
      return this.delayCombatTurn();
    },

    delayCombatTurn() {
      const combat = this.state.combat;
      if (!combat?.order?.length) return false;
      const idx = combat.turnIndex ?? 0;
      const turn = combat.order[idx];
      if (!turn || turn.type !== 'player') return false;
      if (this.getCombatPhase() !== 'player_turn') return false;

      const [entry] = combat.order.splice(idx, 1);
      entry.delayed = true;
      combat.order.push(entry);
      this.log('⏳ Ход отложен — вы будете ходить в конце раунда', 'log-combat');
      this.syncBattleParticipants();
      this.updateCombatTimeline();
      this.state.combat.turnIndex = idx;
      setTimeout(() => this.nextCombatTurn(), 400);
      return true;
    },

    /** Подготовленное действие (Ready) — пометка + передача хода */
    readyTurn() {
      const combat = this.state.combat;
      if (!combat?.order?.length) return false;
      const idx = combat.turnIndex ?? 0;
      const turn = combat.order[idx];
      if (!turn || turn.type !== 'player') return false;
      if (this.getCombatPhase() !== 'player_turn') return false;

      turn.ready = true;
      this.log('🛡️ Подготовленное действие — ход передан', 'log-combat');
      this.syncBattleParticipants();
      this.updateCombatTimeline();
      this.state.combat.turnIndex++;
      setTimeout(() => this.nextCombatTurn(), 400);
      return true;
    },

    /** Алиас для внешних модулей (timeline, тесты) */
    nextTurn() {
      return this.nextCombatTurn();
    },

    /** Смена зоны на 1 шаг: toward_close | toward_far */
    shiftCombatPosition(direction) {
      if (typeof CombatPosition !== 'undefined') {
        return CombatPosition.shiftPlayerPosition(this, direction);
      }
      return false;
    },

    /** Имя врага с уровнем скалирования для UI */
    getEnemyDisplayName(enemy) {
      const name = enemy?.name || 'Враг';
      const lv = enemy?.scaledLevel;
      if (lv > 1) return `${name} (Ур. ${lv})`;
      return name;
    },

    /** Настройки масштабирования врагов из game_data.json (вкладка «Прогрессия» редактора) */
    getEnemyScalingConfig() {
      const raw = this.data?.enemyScaling;
      if (typeof EnemyScaling !== 'undefined') {
        return EnemyScaling.ensureConfig(raw);
      }
      return { enabled: raw?.enabled !== false, scaling: {} };
    },

    /**
     * Масштабирование врага под уровень игрока (таблица enemyScaling.scaling).
     * scaleWithPlayerLevel === false — базовые статы; boss — доп. множитель bossHpRate.
     */
    scaleEnemyForPlayerLevel(enemy) {
      const level = Math.max(1, parseInt(this.state.level, 10) || 1);
      const cfg = this.getEnemyScalingConfig();
      if (typeof EnemyScaling !== 'undefined') {
        return EnemyScaling.scaleEnemy(enemy, level, cfg);
      }
      if (this.activeSystem?.scaleEnemy) {
        return this.activeSystem.scaleEnemy(enemy, level, cfg, this.data);
      }
      const scaled = { ...enemy };
      scaled.hp = parseInt(enemy.hp ?? enemy.maxHp, 10) || 1;
      scaled.maxHp = scaled.hp;
      return scaled;
    },

    /** Текущая фаза боя (player_turn | select_target | enemy_turn) */
    getCombatPhase() {
      if (!this.state.combat) return null;
      if (this.state.combat.phase) return this.state.combat.phase;
      return this.state.combat.playerTurn ? 'player_turn' : 'enemy_turn';
    },

    /** Игрок может действовать (ход или выбор цели) */
    isPlayerCombatPhase() {
      const phase = this.getCombatPhase();
      return phase === 'player_turn' || phase === 'select_target';
    },

    setCombatPhase(phase) {
      if (!this.state.combat) return;
      this.state.combat.phase = phase;
      if (phase === 'enemy_turn') {
        this.state.combat.playerTurn = false;
      } else {
        this.state.combat.playerTurn = true;
      }
      this.updateCombatTargetHint();
    },

    /** scope из ability.targeting или effect.targeting */
    getAbilityTargetingScope(ability) {
      if (!ability) return null;
      if (Array.isArray(ability.effects)) {
        for (const ef of ability.effects) {
          if (ef?.allTargets) return 'all_enemies';
          const s = ef?.targeting?.scope;
          if (s === 'all_enemies' || s === 'area') return 'all_enemies';
        }
      }
      if (ability.effect?.allTargets) return 'all_enemies';
      if (ability.targeting?.scope) return ability.targeting.scope;
      if (ability.effect?.targeting?.scope) return ability.effect.targeting.scope;
      if (Array.isArray(ability.effects)) {
        for (const ef of ability.effects) {
          if (ef?.targeting?.scope) return ef.targeting.scope;
        }
      }
      return null;
    },

    /** Умение требует клика по живому врагу (урон по одной цели) */
    abilityRequiresEnemyTarget(ability) {
      if (!ability || !this.state.combat) return false;
      if (typeof CombatManager !== 'undefined') {
        const parsed = ability._combatParsed
          ? ability
          : CombatManager.parseAction(ability, {
              system: CombatManager.getRulesSystem(this)
            });
        return CombatManager.actionNeedsEnemyTarget(parsed);
      }
      const scope = this.getAbilityTargetingScope(ability);
      if (scope !== 'single') return false;
      const effects = [];
      if (Array.isArray(ability.effects)) effects.push(...ability.effects);
      else if (ability.effect) effects.push(ability.effect);
      for (const ef of effects) {
        if (!ef || typeof ef !== 'object') continue;
        if (ef.type === 'damage' || ef.type === 'apply_status') return true;
      }
      return false;
    },

    getAliveEnemyIndices() {
      return (this.state.enemies || [])
        .map((e, i) => (e.hp > 0 ? i : -1))
        .filter(i => i >= 0);
    },

    updateCombatTargetHint() {
      const el = document.getElementById('combat-target-hint');
      if (!el) return;
      if (!this.state.combat) {
        el.classList.add('hidden');
        el.innerHTML = '';
        return;
      }
      const phase = this.getCombatPhase();
      const pendingAb = this.state.combat?.pendingAbility;
      const pendingItemId = this.state.combat?.pendingConsumableId;
      const pendingItem = pendingItemId ? this.data?.items?.[pendingItemId] : null;
      const pendingLabel = pendingAb?.name || pendingItem?.name;
      if (phase === 'select_target' && pendingLabel) {
        el.classList.remove('hidden');
        el.innerHTML = `
          <div class="combat-target-hint-title">🎯 Выберите цель для «${this.escapeHtml(pendingLabel)}»</div>
          <div>Кликните по подсвеченному врагу. <kbd>Esc</kbd> — отмена.</div>
          <button type="button" class="btn btn-secondary combat-target-cancel" onclick="GameEngine.cancelAbilityTargetSelect()">Отмена</button>`;
      } else {
        el.classList.add('hidden');
        el.innerHTML = '';
      }
    },

    /** Ожидание клика по врагу (scope: single, урон по цели) */
    beginAbilityTargetSelect(ability) {
      if (!this.state.combat || !ability) return;
      const alive = this.getAliveEnemyIndices();
      if (!alive.length) {
        this.nextCombatTurn();
        return;
      }
      this.state.combat.pendingAbility = ability;
      this.state.combat.pendingConsumableId = null;
      this.setCombatPhase('select_target');
      this.renderCombat();
      this.playerCombatTurn();
    },

    cancelAbilityTargetSelect() {
      if (this.getCombatPhase() !== 'select_target') return;
      this.state.combat.pendingAbility = null;
      this.state.combat.pendingConsumableId = null;
      this.setCombatPhase('player_turn');
      this.renderCombat();
      this.playerCombatTurn();
      this.log('Выбор цели отменён.', 'log-dice');
    },

    onCombatEnemyClick(enemyIndex) {
      if (this.getCombatPhase() !== 'select_target') return;
      const enemy = this.state.enemies?.[enemyIndex];
      if (!enemy || enemy.hp <= 0) return;

      const pendingAb = this.state.combat?.pendingAbility;
      if (
        pendingAb &&
        typeof CombatPosition !== 'undefined' &&
        CombatPosition.isEnabled(this)
      ) {
        const v = CombatPosition.validateAbilityTarget(this, pendingAb, enemyIndex);
        if (!v.valid) {
          this.log(`❌ ${v.reason}`, 'log-damage');
          return;
        }
      }

      const itemId = this.state.combat?.pendingConsumableId;
      if (itemId) {
        const db = this.data?.items?.[itemId];
        if (!db || !this.state.inventory.includes(itemId)) {
          this.cancelAbilityTargetSelect();
          return;
        }
        this.state.combat.pendingConsumableId = null;
        this.setCombatPhase('player_turn');
        this.updateCombatTargetHint();
        const result = this.applyConsumableUseEffect(itemId, db, { enemy });
        this.finishConsumableCombatTurn(itemId, result.itemRemoved);
        return;
      }

      const ability = this.state.combat?.pendingAbility;
      if (!ability) {
        this.cancelAbilityTargetSelect();
        return;
      }
      this.state.combat.pendingAbility = null;
      this.setCombatPhase('player_turn');
      this.updateCombatTargetHint();
      this.executeAbility(ability, enemy);
    },

    /**
     * Применение умения после оплаты стоимости (target — объект врага для scope: single).
     */
    executeAbility(ability, target = null) {
      const scheduleNextTurn = (delay = 600) => {
        if (this._combatTurnScheduled) return;
        this._combatTurnScheduled = true;
        setTimeout(() => this.nextCombatTurn(), delay);
      };

      if (typeof CombatManager !== 'undefined') {
        const parsed = ability._combatParsed
          ? ability
          : CombatManager.parseAction(ability, {
              system: CombatManager.getRulesSystem(this)
            });
        const res = CombatManager.performAction(this, parsed, {
          target,
          skipValidation: true
        });
        if (!res.success) return;

        const endsTurn = res.endsTurn !== false;

        if (!this.state.combat) return;

        if (this.state.enemies.every(e => e.hp <= 0)) {
          scheduleNextTurn(600);
          return;
        }

        if (this.isPf2e() && this.state.combat) {
          if (this.endPf2ePlayerTurnIfNoActions()) return;
        }

        if (!endsTurn) {
          this.playerCombatTurn();
          return;
        }

        this.state.combat.turnIndex++;
        scheduleNextTurn(600);
        return;
      }

      const actionType = this.getAbilityActionType(ability);
      if (this.state.combat) {
        if (actionType === 'action') this.spendCombatActionType('action');
        if (actionType === 'bonus_action') this.spendCombatActionType('bonus_action');
      }

      this.spendAbilityCost(ability);
      const castLv = this.getCastSlotLevel(ability);
      const minLv = this.getAbilitySpellLevel(ability);
      let castNote = '';
      if (this.abilityUsesSpellSlots(ability) && castLv >= 1) {
        castNote = castLv > minLv ? ` — ячейка ${castLv} круга (усилено)` : ` — круг ${castLv}`;
      }
      this.log(`💫 ${ability.name}${castNote}`, 'log-info');
      this.playAbilityCast(ability);

      let endsTurn = this.applyAbilityLogic(ability, target);
      if (actionType === 'bonus_action' || actionType === 'free') {
        if (endsTurn !== false) endsTurn = false;
      } else if (actionType === 'action' && endsTurn !== false) {
        endsTurn = true;
      }

      if (this.state.combat && this.isConcentrationAbility(ability)) {
        if (typeof this.beginConcentration === 'function') {
          this.beginConcentration(ability);
        }
      }

      if (this.state.combat && ability.oncePerCombat) {
        if (!this.state.combat.abilitiesUsed) this.state.combat.abilitiesUsed = {};
        this.state.combat.abilitiesUsed[ability.id] = true;
      }

      this.updateStats();

      if (!this.state.combat) return;

      this.renderCombat();

      if (this.state.enemies.every(e => e.hp <= 0)) {
        scheduleNextTurn(600);
        return;
      }

      if (this.isPf2e() && this.state.combat) {
        if (!this.endPf2ePlayerTurnIfNoActions()) {
          this.playerCombatTurn();
        }
        return;
      }

      if (!endsTurn) {
        this.playerCombatTurn();
        return;
      }

      this.state.combat.turnIndex++;
      scheduleNextTurn(600);
      return;
    },

    startCombat(enemies, nextScene, enemyIds) {
      const ids = enemyIds || enemies.map(e => e.id).filter(Boolean);
      this.state.combat = {
        round: 1,
        nextScene: nextScene,
        playerTurn: false,
        /** Фаза боя: player_turn | select_target | enemy_turn */
        phase: 'enemy_turn',
        pendingAbility: null,
        /** Расходник, ожидающий выбора врага (target: single_enemy) */
        pendingConsumableId: null,
        abilitiesUsed: {},
        /** ID шаблонов врагов из data.enemies (для loot и опыта) */
        enemies: ids,
        enemyIds: ids,
        expKey: `combat:${this.state.scene}`,
        effects: [],
        effectAcMod: 0,
        effectAtkMod: 0,
        concentration: null,
        actionSpent: false,
        bonusActionSpent: false,
        reactionAvailable: true,
        extraAttackUsed: false,
        rageActive: false,
        tempDmgBonus: 0
      };
      const playerLevel = Math.max(1, parseInt(this.state.level, 10) || 1);
      this.state.enemies = enemies.map(e => {
        const scaled = this.scaleEnemyForPlayerLevel(e);
        const tpl = this.data?.enemies?.[scaled.id];
        return {
          ...scaled,
          maxHp: scaled.hp,
          effects: [],
          _baseAc: scaled.ac,
          _baseAtkBonus: scaled.atkBonus,
          combatRole: scaled.combatRole || tpl?.combatRole,
          attacks: scaled.attacks || tpl?.attacks,
          combatAbilities: scaled.combatAbilities || tpl?.combatAbilities,
          reactionAvailable: true
        };
      });
      if (typeof CombatPosition !== 'undefined') {
        CombatPosition.initCombatPositions(this);
      }
      if (typeof OpportunityAttack !== 'undefined') {
        OpportunityAttack.initReactionState(this);
      } else {
        this.state.combat.reactionAvailable = true;
      }
      if (typeof CombatLog !== 'undefined') {
        CombatLog.attach(this).startCombat(this, 1);
      }
      if (playerLevel > 1) {
        this.log(`⚔️ Противники усилены под уровень ${playerLevel}`, 'log-combat');
      }
      if (typeof CombatPosition !== 'undefined' && CombatPosition.isEnabled(this)) {
        const pz = CombatPosition.getZoneLabel(CombatPosition.getPlayerPosition(this));
        this.log(`📍 Позиция героя: ${pz}`, 'log-combat');
      }
      this.renderCombat();
      const init = this.buildCombatInitiativeOrder();
      this.state.combat.order = init.order;
      this.state.combat.initiativeRules = init.rules;
      if (typeof StatusManager !== 'undefined') {
        StatusManager.applyAmbushSurprise(this, init.rules);
      }
      this.state.combat.turnIndex = 0;
      this.state.combat.battleParticipants = [];
      if (this.isPf2e()) this.resetPf2eCombatActions();
      this.syncBattleParticipants();
      this.combatLog('combat', {
        message: `⚔️ Инициатива ${this.state.charName}: ${init.pRoll}`,
        round: 1
      });
      this.updateCombatTimeline();
      this.nextCombatTurn();
    },

    renderCombat() {
      const area = document.getElementById('combat-area');
      if (!area) return;
      area.classList.remove('hidden');
      this.ensureCombatEffectsState();

      let pf2eActionsHtml = '';
      if (this.isPf2e() && this.state.combat) {
        const actionsLeft = this.state.combat.actionsRemaining ?? this.getPf2eActionsPerTurn();
        const filled = '◆'.repeat(Math.max(0, actionsLeft));
        const empty = '◇'.repeat(Math.max(0, this.getPf2eActionsPerTurn() - actionsLeft));
        pf2eActionsHtml = `<div class="pf2e-actions-indicator" title="Осталось действий в ход">⚡ Действия: ${filled}${empty}</div>`;
      }

      const isMobileCombat = document.body.classList.contains('mobile');
      const playerFx = this.renderStatusEffectsHtml(this.state.combat?.effects);
      const pPct = Math.max(0, (this.state.hp / this.state.maxHp) * 100);

      let html = pf2eActionsHtml;

      if (typeof CombatPosition !== 'undefined' && CombatPosition.isEnabled(this)) {
        html += `<p class="combat-zone-hint">Фронт — мили; тыл — дистанция. С фронта по тылу: −2. Фланг (⊞): атаки с обеих зон за раунд.</p>`;
        html += CombatPosition.renderZoneFieldHtml(this, {
          hidePlayer: isMobileCombat
        });
      }

      const zoneUi =
        typeof CombatPosition !== 'undefined' && CombatPosition.isEnabled(this);
      /* На мобильном игрок только в сайдбаре — не дублируем в списке боя */
      if (!isMobileCombat && !zoneUi) {
        html += '<div class="combat-player-row">';
        const dualIcon = this.hasDualWieldSetup() ? ' <span title="Два оружия">⚔️</span>' : '';
        html += `<span class="combat-unit-name">${this.escapeHtml(this.state.charName || 'Герой')}${dualIcon}</span>`;
        html += `<div class="hp-bar-bg"><div class="hp-bar-fill" style="width:${pPct}%"></div></div>`;
        html += `<span class="combat-hp-text">${this.state.hp}/${this.state.maxHp}</span>`;
        if (playerFx) html += `<div class="combat-effects-row">${playerFx}</div>`;
        const conc = this.state.combat?.concentration;
        if (conc?.label) {
          html += `<div class="combat-concentration-row"><span class="concentration-active" title="Активная концентрация">[C] ${this.escapeHtml(conc.label)}</span></div>`;
        }
        if (this.hasFocusPotionAdvantage()) {
          const left = this.getFocusPotionTimeLeftLabel();
          html += `<div class="combat-concentration-row"><span class="focus-potion-active" title="Преимущество на проверки концентрации">🧿 Фокус${left ? ` (${this.escapeHtml(left)})` : ''}</span></div>`;
        }
        html += '</div>';
      }

      const useZoneColumns =
        typeof CombatPosition !== 'undefined' && CombatPosition.isEnabled(this);
      if (!useZoneColumns) {
        html += '<b class="combat-enemies-title">⚔️ Противники:</b>';
      }
      html += '<div class="combat-enemies-list' + (useZoneColumns ? ' combat-enemies-list--zones' : '') + '">';
      const selectingTarget = this.getCombatPhase() === 'select_target';
      this.state.enemies.forEach((e, idx) => {
        if (useZoneColumns) return;
        const alive = e.hp > 0;
        const pct = Math.max(0, (e.hp / e.maxHp) * 100);
        const fx = this.renderStatusEffectsHtml(e.effects);
        let rowClass = 'combat-enemy';
        if (selectingTarget) {
          rowClass += alive ? ' combat-enemy-targetable' : ' combat-enemy-dead';
        }
        const clickAttr = (selectingTarget && alive)
          ? ` role="button" tabindex="0" onclick="GameEngine.onCombatEnemyClick(${idx})"`
          : '';
        html += `<div class="${rowClass}" data-enemy-index="${idx}"${clickAttr}>`;
        const typeTag = this.getCreatureTypeLabel(this.getEnemyCreatureType(e));
        const typeHtml = typeTag ? ` <span class="combat-creature-type" title="Тип существа">[${this.escapeHtml(typeTag)}]</span>` : '';
        html += `<span class="combat-unit-name">${this.escapeHtml(this.getEnemyDisplayName(e))}${typeHtml}</span>`;
        html += `<div class="hp-bar-bg"><div class="hp-bar-fill" style="width:${pct}%"></div></div>`;
        html += `<span class="combat-hp-text">${e.hp}/${e.maxHp}</span>`;
        if (fx) html += `<div class="combat-effects-row">${fx}</div>`;
        html += `</div>`;
      });
      html += '</div>';
      area.innerHTML = html;
      this.updateCombatLayoutClasses();
      this.updateCombatTimeline();
    },

    nextCombatTurn() {
      this._combatTurnScheduled = false;
      if (this.state.hp <= 0) {
        if (typeof this.clearCombatConcentration === 'function') this.clearCombatConcentration(true);
        this.finishCombatLogUI();
        this.state.combat = null; this.state.enemies = [];
        const ca = document.getElementById('combat-area');
        if (ca) ca.classList.add('hidden');
        this.updateCombatLayoutClasses();
        this.updateCombatTimeline();
        return;
      }
      if (!this.state.combat) return;
      this.processDefeatedEnemiesReputation();
      if (this.state.enemies.every(e => e.hp <= 0)) {
        const next = this.state.combat.nextScene;
        const combatSnapshot = { ...this.state.combat };
        this.combatLog('death', {
          message: '✅ Все враги повержены!',
          important: true,
          round: this.state.combat.round
        });
        if (typeof this.clearCombatConcentration === 'function') this.clearCombatConcentration(true);
        if (typeof this.clearWildShapeIfCombatEnds === 'function') this.clearWildShapeIfCombatEnds();
        if (typeof this.clearTransformIfCombatEnds === 'function') this.clearTransformIfCombatEnds();
        this.finishCombatLogUI();
        this.state.combat = null;
        this.state.enemies = [];
        this.state.resumeAfterLevelUp = null;
        const ca = document.getElementById('combat-area');
        if (ca) ca.classList.add('hidden');
        this.updateCombatLayoutClasses();
        this.updateCombatTimeline();

        const enemyIds = combatSnapshot.enemies || combatSnapshot.enemyIds || [];
        const tempLoot = this.rollCombatLootFromEnemies(enemyIds);
        if (tempLoot.length > 0) {
          this.showCombatLootModal(tempLoot, next, combatSnapshot);
        } else {
          this.finishCombatVictory(next, combatSnapshot);
        }
        this.saveGame();
        return;
      }
      const turn = this.state.combat.order[this.state.combat.turnIndex];
      if (!turn) {
        if (this.state.combat.turnIndex >= this.state.combat.order.length) {
          this.tickStatusRoundEnd?.();
          this.state.combat.round = (this.state.combat.round || 1) + 1;
          this.syncCombatLogRound();
          if (typeof OpportunityAttack !== 'undefined') {
            OpportunityAttack.restoreReactionsForRound(this);
          } else {
            this.state.combat.reactionAvailable = true;
            (this.state.enemies || []).forEach((e) => {
              if (e) e.reactionAvailable = true;
            });
          }
        }
        this.state.combat.turnIndex = 0;
        this.syncBattleParticipants();
        this.updateCombatTimeline();
        this.nextCombatTurn();
        return;
      }
      this.syncBattleParticipants();
      this.updateCombatTimeline();
      if (turn.type === 'player') {
        const playerHolder = this.getPlayerEffectHolder();
        const pr = this.processEffects(playerHolder);
        this.renderCombat();
        if (pr.skipTurn) {
          this.combatLog('status', {
            message: `💫 ${playerHolder.name} не может действовать (оглушение / врасплох)`,
            important: true
          });
          this.state.combat.turnIndex++;
          setTimeout(() => this.nextCombatTurn(), 700);
          return;
        }
        this.setCombatPhase('player_turn');
        this.resetPlayerTurnEconomy();
        if (this.isPf2e()) this.resetPf2eCombatActions();
        this.renderCombat();
        this.playerCombatTurn();
      } else {
        this.setCombatPhase('enemy_turn');
        const enemy = this.state.enemies[turn.index];
        if (enemy && enemy.hp > 0) {
          const holder = this.getEnemyEffectHolder(enemy);
          const er = this.processEffects(holder);
          this.renderCombat();
          if (er.skipTurn) {
            this.combatLog('status', {
              message: `💫 ${enemy.name} оглушён и пропускает ход`,
              target: enemy.name,
              important: true
            });
          } else {
            this.enemyTurn(enemy, turn.index);
          }
        }
        this.state.combat.turnIndex++;
        setTimeout(() => this.nextCombatTurn(), 900);
      }
    },

    playerCombatTurn() {
      const area = document.getElementById('choices-area');
      if (!area) return;

      if (this.getCombatPhase() === 'select_target') {
        const pendingAb = this.state.combat?.pendingAbility;
        const pendingItemId = this.state.combat?.pendingConsumableId;
        const pendingItem = pendingItemId ? this.data?.items?.[pendingItemId] : null;
        let html = '<b style="color:var(--accent); display:block; margin-bottom:8px; font-family:Amatic SC,cursive; font-size:26px;">Выберите цель</b>';
        if (pendingAb) {
          const castLv = this.getCastSlotLevel(pendingAb);
          const minLv = this.getAbilitySpellLevel(pendingAb);
          const lvTxt = castLv > minLv ? `, ячейка ${castLv} круга` : (castLv >= 1 ? `, круг ${castLv}` : '');
          html += `<div style="margin-bottom:10px;">Умение: ${this.renderIcon(pendingAb.icon)} <b>${this.escapeHtml(pendingAb.name)}</b>${this.escapeHtml(lvTxt)} — клик по врагу в панели боя.</div>`;
        } else if (pendingItem) {
          html += `<div style="margin-bottom:10px;">Предмет: ${this.renderIcon(pendingItem.icon || '🧪')} <b>${this.escapeHtml(pendingItem.name)}</b> — клик по врагу в панели боя.</div>`;
        }
        html += `<button type="button" class="choice" onclick="GameEngine.cancelAbilityTargetSelect()">↩ Отмена (Esc)</button>`;
        area.innerHTML = html;
        this.updateCombatTargetHint();
        return;
      }

      const cls = this.state.classData;
      const atkBonus = this.getEffectivePlayerAtkBonus();
      const dmgText = 'Урон: ' + this.formatEquippedDamageLabel(cls);
      const turnHeadCls = document.body.classList.contains('mobile')
        ? 'combat-turn-sticky'
        : '';
      let html = `<div class="combat-turn-panel"><b class="combat-turn-head ${turnHeadCls}">Ваш ход</b>`;
      const footerParts = [];

      if (this.isPf2e()) {
        const left = this.state.combat?.actionsRemaining ?? this.getPf2eActionsPerTurn();
        html += `<div class="pf2e-actions-indicator" style="margin-bottom:8px;">⚡ Действия: ${'◆'.repeat(left)}${'◇'.repeat(this.getPf2eActionsPerTurn() - left)}</div>`;
        html += `<div style="font-size:20px; color:var(--ink-light); margin-bottom:10px; font-family:'Caveat',cursive;">Атака: к20+${atkBonus} против КД | ${this.escapeHtml(dmgText)}</div>`;
        this.state.enemies.forEach((e, i) => {
          if (e.hp > 0) html += this.buildCombatAttackButtonsForEnemy(i);
        });
        (cls.abilities || []).forEach((ab) => {
          if (!ab.id || this.isAbilityPassiveAbility(ab)) return;
          if (this.getAbilityActionType(ab) === 'action' && !this.isAbilityCombatOnly(ab)) return;
          html += this.buildCombatAbilityButton(ab);
        });
      } else {
        const actionSpent = !!this.state.combat?.actionSpent && !this.state.combat?.actionSurge;
        let attackButtons = '';
        if (!actionSpent) {
          this.state.enemies.forEach((e, i) => {
            if (e.hp > 0) attackButtons += this.buildCombatAttackButtonsForEnemy(i);
          });
        }

        const byType = { action: [], bonus_action: [], reaction: [] };
        (cls.abilities || []).forEach((ab) => {
          if (!ab.id || this.isAbilityPassiveAbility(ab)) return;
          const t = this.getAbilityActionType(ab);
          if (t === 'passive' || t === 'free') return;
          if (t === 'action' && !this.isAbilityCombatOnly(ab)) return;
          if (!byType[t]) byType[t] = [];
          byType[t].push(ab);
        });

        const actionAbilities = byType.action.map((ab) => this.buildCombatAbilityButton(ab)).join('');
        const bonusHtml = byType.bonus_action.map((ab) => this.buildCombatAbilityButton(ab)).join('');

        html += this.renderCombatActionsGrid([
          this.renderCombatActionSection('⚔️ Атака', attackButtons, {
            column: 'attacks',
            showEmpty: true
          }),
          this.renderCombatActionSection('✨ Умения', actionAbilities, {
            column: 'abilities',
            showEmpty: true
          }),
          this.renderCombatActionSection('⚡ Бонус', bonusHtml, {
            column: 'bonus',
            showEmpty: true
          })
        ]);

        const reactionHtml = byType.reaction
          .map((ab) =>
            this.buildCombatAbilityButton(ab, {
              forceDisabled: true,
              disabledReason: this.state.combat?.reactionAvailable
                ? 'Срабатывает после вашего попадания'
                : 'Реакция потрачена'
            })
          )
          .join('');

        if (reactionHtml) {
          footerParts.push(
            this.renderCombatActionSection('🛡️', reactionHtml, { compact: true })
          );
        }
      }

      const combatConsumables = this.getCombatUsableConsumables();
      let itemsHtml = '';
      if (combatConsumables.length) {
        itemsHtml += '<label style="font-weight:600;">🎒</label>';
        itemsHtml += '<select id="combat-consumable-select" class="combat-consumable-select" style="flex:1;min-width:140px;padding:6px;font-size:14px;">';
        combatConsumables.forEach(cid => {
          const cdb = this.data.items[cid];
          const label = this.getConsumableButtonLabel(cdb);
          itemsHtml += `<option value="${this.escapeAttr(cid)}">${this.escapeHtml((cdb?.icon || '🧪') + ' ' + (cdb?.name || cid) + ' — ' + label)}</option>`;
        });
        itemsHtml += '</select>';
        itemsHtml += '<button type="button" class="choice" onclick="GameEngine.useCombatConsumableSelect()">Использовать</button>';
      } else {
        itemsHtml += `<button type="button" class="choice" disabled style="opacity:0.55;cursor:not-allowed;" title="Нет подходящих расходников">Нет расходников</button>`;
      }
      let actionsHtml = '';
      if (typeof CombatPosition !== 'undefined' && CombatPosition.isEnabled(this)) {
        const shiftOpts = CombatPosition.getShiftOptions(this);
        const moved = !!this.state.combat?.zoneMovedThisTurn;
        const shiftUsesAction =
          typeof CombatPosition.shiftCostsAction === 'function' &&
          CombatPosition.shiftCostsAction(this);
        const shiftDisabled =
          moved ||
          (shiftUsesAction &&
            this.state.combat?.actionSpent &&
            !this.state.combat?.actionSurge);
        const shiftTitle = moved
          ? 'Уже перемещались в этом ходу (макс. 1 зона)'
          : shiftUsesAction
            ? 'Потратить действие: сменить зону на соседнюю'
            : 'Перемещение на 1 соседнюю зону за ход (Far ↔ Mid ↔ Close). Атака не тратится.';
        if (shiftOpts.towardFar) {
          const label = `← ${CombatPosition.getZoneLabel(shiftOpts.towardFar)}`;
          if (shiftDisabled) {
            actionsHtml += `<button type="button" class="choice" disabled style="opacity:0.55;" title="${this.escapeAttr(shiftTitle)}">↔️ ${label}</button>`;
          } else {
            actionsHtml += `<button type="button" class="choice" onclick="GameEngine.shiftCombatPosition('toward_far')" title="${this.escapeAttr(shiftTitle)}">↔️ ${label}</button>`;
          }
        }
        if (shiftOpts.towardClose) {
          const label = `${CombatPosition.getZoneLabel(shiftOpts.towardClose)} →`;
          if (shiftDisabled) {
            actionsHtml += `<button type="button" class="choice" disabled style="opacity:0.55;" title="${this.escapeAttr(shiftTitle)}">↔️ ${label}</button>`;
          } else {
            actionsHtml += `<button type="button" class="choice" onclick="GameEngine.shiftCombatPosition('toward_close')" title="${this.escapeAttr(shiftTitle)}">↔️ ${label}</button>`;
          }
        }
      }
      actionsHtml += `<button type="button" class="choice" onclick="GameEngine.playerFlee()">🏃 Отступить (к20+${cls.initBonus} vs DC 14)</button>`;
      if (typeof this.isInWildShape === 'function' && this.isInWildShape()) {
        const beast = this.getActiveBeast?.();
        const bname = beast ? `${beast.icon || ''} ${beast.name}` : 'зверя';
        actionsHtml = `<button type="button" class="choice" onclick="GameEngine.revertWildShapeManually()">🧙 Вернуться в форму (из ${this.escapeHtml(bname)})</button>` + actionsHtml;
      } else if (typeof this.isInTransformation === 'function' && this.isInTransformation()) {
        const t = this.state.transformation;
        const label = t?.formName ? `${t.formIcon || ''} ${t.formName}` : 'превращения';
        actionsHtml = `<button type="button" class="choice" onclick="GameEngine.revertTransformManually()">✨ Вернуться (${this.escapeHtml(label.trim())})</button>` + actionsHtml;
      }
      if (this.isPf2e()) {
        html += this.renderCombatActionSection('🎒 ПРЕДМЕТЫ', itemsHtml);
        html += this.renderCombatActionSection('🏃 ДЕЙСТВИЯ', actionsHtml);
      } else {
        footerParts.push(
          this.renderCombatActionSection('🎒', itemsHtml, { compact: true })
        );
        footerParts.push(
          this.renderCombatActionSection('⋯', actionsHtml, { compact: true })
        );
        if (footerParts.length) {
          html += `<div class="combat-actions-footer">${footerParts.join('')}</div>`;
        }
      }
      html += '</div>';

      area.innerHTML = html;
      this.renderAbilities();
    },

    applyAbilityLogic(ability, target = null) {
      let endsTurn = true;
      this._abilitySoundCtx = ability;

      const runEffect = (rawEffect) => {
        if (rawEffect == null) return;
        let effect = rawEffect;
        if (typeof rawEffect === 'object' && rawEffect.type && ability.targeting && !rawEffect.targeting) {
          effect = { ...rawEffect, targeting: ability.targeting };
        }
        const result = this.applyEffect(effect, target);
        if (result === false) endsTurn = false;
      };

      if (ability.effects && Array.isArray(ability.effects)) {
        ability.effects.forEach(runEffect);
        this._abilitySoundCtx = null;
        return endsTurn;
      }

      if (ability.effect != null) {
        runEffect(ability.effect);
        this._abilitySoundCtx = null;
        return endsTurn;
      }

      if (ability.passive || ability.type === 'passive') {
        this.log('Пассивное умение уже действует.', 'log-dice');
        this._abilitySoundCtx = null;
        return true;
      }

      this.log(ability.desc || 'Умение использовано.', 'log-dice');
      this._abilitySoundCtx = null;
      return true;
    },

    useAbility(abilityIdOrObj) {
      const ability = typeof abilityIdOrObj === 'string'
        ? this.state.classData.abilities?.find(a => a.id === abilityIdOrObj)
        : abilityIdOrObj;
      if (!ability) return;

      if (this.state.combat && !this.isPlayerCombatPhase()) {
        this.log('Не ваш ход!', 'log-damage');
        return;
      }

      if (this.getCombatPhase() === 'select_target') {
        this.log('Сначала выберите цель или нажмите «Отмена».', 'log-dice');
        return;
      }

      if (this.isAbilityCombatOnly(ability) && !this.state.combat) {
        this.log('Это умение можно использовать только в бою.', 'log-dice');
        return;
      }

      if (this.state.combat?.abilitiesUsed?.[ability.id] && ability.oncePerCombat) {
        this.log('Умение уже использовано в этом бою.', 'log-dice');
        return;
      }

      if (this.getAbilityActionType(ability) === 'reaction') {
        this.log('Реакция срабатывает автоматически (например, после попадания по врагу).', 'log-dice');
        return;
      }

      if (this.isAbilityPassiveAbility(ability)) {
        this.showAbilityInfo(ability.id);
        return;
      }

      const unavailable = this.getAbilityUnavailableReason(ability);
      if (unavailable) {
        this.log(`❌ ${unavailable}`, 'log-damage');
        return;
      }

      const castLevels = this.getAvailableCastLevels(ability);
      const sl = this.getAbilitySpellLevel(ability);
      if (this.abilityUsesSpellSlots(ability)) {
        if (sl >= 1) {
          if (castLevels.length === 0) {
            this.log(`❌ Нет ячеек ${sl} круга и выше!`, 'log-damage');
            return;
          }
          if (this.needsCastLevelChoice(ability)) {
            this.promptSpellSlotLevel(ability, castLevels, (lv) => this.continueUseAbility(ability, lv));
            return;
          }
          this.continueUseAbility(ability, castLevels[0]);
          return;
        }
        if (!this.canAffordAbility(ability)) {
          const cost = parseInt(ability?.cost, 10) || 0;
          this.log(cost > 1 ? `❌ Нужно ${cost} свободных ячеек!` : '❌ Нет свободных ячеек!', 'log-damage');
          return;
        }
        this.continueUseAbility(ability, null);
        return;
      }
      if (!this.canAffordAbility(ability)) {
        this.log('❌ Недостаточно ресурса!', 'log-damage');
        return;
      }

      if (this.needsCastLevelChoice(ability)) {
        this.promptSpellSlotLevel(ability, castLevels, (lv) => this.continueUseAbility(ability, lv));
        return;
      }

      this.continueUseAbility(ability, null);
    },
    playerAttack(idx, weaponSlot = 'weapon_main') {
      if (this.getCombatPhase() === 'select_target') {
        this.cancelAbilityTargetSelect();
      }
      if (this.getCombatPhase() !== 'player_turn') {
        this.log('Сейчас нельзя атаковать.', 'log-damage');
        return;
      }

      const isInventoryShot =
        typeof weaponSlot === 'string' && weaponSlot.startsWith('inv:');
      const slot = isInventoryShot
        ? weaponSlot
        : weaponSlot === 'weapon_off'
          ? 'weapon_off'
          : 'weapon_main';
      const profile = isInventoryShot
        ? this.getWeaponAttackProfileFromItem(weaponSlot.slice(4))
        : this.getWeaponAttackProfile(slot);
      if (!isInventoryShot && slot === 'weapon_off') {
        if (!this.hasDualWieldSetup()) {
          this.log('Нет второго одноручного оружия.', 'log-damage');
          return;
        }
        if (this.state.combat?.bonusActionSpent) {
          this.log('Бонусное действие уже потрачено в этом ходу.', 'log-damage');
          return;
        }
      } else if (this.state.combat?.actionSpent && !this.state.combat?.actionSurge) {
        this.log('Действие уже потрачено в этом ходу.', 'log-damage');
        return;
      }

      const enemy = this.state.enemies[idx];
      if (!enemy || enemy.hp <= 0) return;

      if (this.attackRequiresArrows(profile)) {
        if (this.getArrowCount() <= 0) {
          this.log('❌ Нет стрел для выстрела из лука.', 'log-damage');
          return;
        }
        this.consumeOneArrow();
      }

      const rangeType =
        typeof CombatPosition !== 'undefined' && profile
          ? CombatPosition.getWeaponRangeType(this, profile)
          : 'melee';
      const attackMode =
        typeof CombatPosition !== 'undefined'
          ? CombatPosition.getAttackModeFromRangeType(rangeType)
          : rangeType === 'ranged'
            ? 'ranged'
            : 'melee';
      if (typeof CombatPosition !== 'undefined' && CombatPosition.isEnabled(this)) {
        const zoneCheck = CombatPosition.validateAttack(this, {
          enemyIndex: idx,
          rangeType,
          attackMode
        });
        if (!zoneCheck.valid) {
          this.log(`❌ ${zoneCheck.reason}`, 'log-damage');
          return;
        }
        CombatPosition.recordAttackOnEnemy(
          this,
          idx,
          CombatPosition.getPlayerPosition(this)
        );
      }

      const cls = this.state.classData;
      let atkBonus = profile?.atkBonus ?? this.getEffectivePlayerAtkBonus();
      const enemyAc = this.getEffectiveEnemyAC(enemy);
      const weaponLabel = profile?.weaponName || 'Атака';

      let zoneMods = null;
      if (typeof CombatPosition !== 'undefined' && CombatPosition.isEnabled(this)) {
        zoneMods = CombatPosition.getAttackModifiers(this, {
          enemyIndex: idx,
          attackMode,
          attackerZone: CombatPosition.getPlayerPosition(this),
          targetZone: CombatPosition.getEnemyPosition(this, enemy)
        });
        atkBonus += zoneMods.attackBonus || 0;
      }
      if (typeof StatusManager !== 'undefined') {
        const statusMods = StatusManager.getAttackModifiers(
          this,
          StatusManager.getPlayerHolder(this),
          StatusManager.getEnemyHolder(this, enemy),
          {
            ranged:
              attackMode === 'ranged' ||
              rangeType === 'ranged' ||
              rangeType === 'spell'
          }
        );
        zoneMods = zoneMods || {
          attackBonus: 0,
          advantage: false,
          disadvantage: false,
          notes: []
        };
        zoneMods.attackBonus = (zoneMods.attackBonus || 0) + (statusMods.attackBonus || 0);
        if (statusMods.advantage) zoneMods.advantage = true;
        if (statusMods.disadvantage) zoneMods.disadvantage = true;
        zoneMods.notes = [...(zoneMods.notes || []), ...(statusMods.notes || [])];
        atkBonus += statusMods.attackBonus || 0;
      }

      if (this.isPf2e()) {
        if (!this.spendPf2eActions(1)) return;
        const map = this.state.combat?.mapPenalty || 0;
        const attacker = {
          atkBonus,
          dmgRoll: profile?.dmgRoll || cls?.dmgRoll || '1d6',
          dmgBonus: profile?.dmgBonus ?? cls?.dmgBonus ?? 0
        };
        const result = this.activeSystem.rollAttack(attacker, { ac: enemyAc }, this, { mapPenalty: map });
        this.state.combat.mapPenalty = Math.min(10, map + 5);

        const degreeLabels = {
          critical_success: 'критический успех',
          success: 'успех',
          failure: 'провал',
          critical_failure: 'критический провал'
        };
        const degLabel = degreeLabels[result.degree] || result.degree;

        if (result.hit && result.dmg > 0) {
          const favHit = this.addFavoredEnemyDamageToHit(enemy, result.dmg);
          enemy.hp -= favHit.total;
          this.log(
            `🎲 ${result.roll}+${atkBonus}${map ? map : ''}=${result.total} vs КД ${enemyAc} — ${degLabel}! 💥 ${favHit.total} урона${this.favoredEnemyDamageNote(favHit.bonus)}`,
            result.crit ? 'log-damage' : 'log-damage'
          );
          if (!this.playEnemyDamagedSound(enemy)) {
            this.playCombatSound(result.crit ? 'attack_crit' : this.getAttackSoundId());
          }
        } else {
          this.log(
            `🎲 ${result.roll}+${atkBonus}${map ? map : ''}=${result.total} vs КД ${enemyAc} — ${degLabel}`,
            'log-dice'
          );
          this.playCombatSound('attack_miss');
        }
        this.renderCombat();
        if (this.endPf2ePlayerTurnIfNoActions()) return;
        this.playerCombatTurn();
        return;
      }

      const rollPack =
        zoneMods && (zoneMods.advantage || zoneMods.disadvantage) && typeof CombatPosition !== 'undefined'
          ? CombatPosition.rollD20(this, zoneMods)
          : zoneMods?.advantage || zoneMods?.disadvantage
            ? (() => {
                const r1 = this.d20();
                const r2 = this.d20();
                if (zoneMods.advantage && !zoneMods.disadvantage) {
                  return { roll: Math.max(r1, r2), advantage: true, detail: `${r1}, ${r2}` };
                }
                if (zoneMods.disadvantage) {
                  return { roll: Math.min(r1, r2), disadvantage: true, detail: `${r1}, ${r2}` };
                }
                return { roll: r1 };
              })()
            : { roll: this.d20() };
      const roll = rollPack.roll;
      const total = roll + atkBonus;
      const zoneTag = zoneMods?.notes?.length
        ? ' [' + zoneMods.notes.join('; ') + ']'
        : '';
      const advTag = rollPack.advantage
        ? ` (Advantage: ${rollPack.detail || roll})`
        : rollPack.disadvantage
          ? ` (Disadvantage: ${rollPack.detail || roll})`
          : '';
      // Старый режим: кара активирована вручную до удара (совместимость)
      let smiteBonus = 0;
      if (this.state.combat?.divineSmite) {
        smiteBonus = this.state.combat.smiteRoll
          ? this.parseRoll(this.state.combat.smiteRoll)
          : this.d(8) + this.d(8);
        this.state.combat.divineSmite = false;
        this.state.combat.smiteRoll = null;
        this.spendCombatActionType('reaction');
      }
      if (slot === 'weapon_off') {
        this.spendCombatActionType('bonus_action');
      } else if (!this.state.combat?.actionSurge) {
        this.spendCombatActionType('action');
      }

      const offHandTag = profile?.isOffHand ? ' (второе оружие, без бонуса мастерства)' : '';
      let hit = false;
      if (roll === 20) {
        const baseDmg = this.rollPlayerWeaponDamage(true, slot) + smiteBonus;
        const favHit = this.addFavoredEnemyDamageToHit(enemy, baseDmg);
        const dmg = favHit.total;
        enemy.hp -= dmg;
        this.log('🎲 Крит! ' + roll + '+' + atkBonus + '=' + total + advTag + zoneTag + ' | 💥 ' + dmg + ' урона (' + weaponLabel + ')' + offHandTag + this.favoredEnemyDamageNote(favHit.bonus) + ' по ' + enemy.name + '!' + (smiteBonus > 0 ? ' (с божественной кара)' : ''), 'log-damage');
        if (!this.playEnemyDamagedSound(enemy)) {
          this.playCombatSound(smiteBonus > 0 ? 'smite_crit' : 'attack_crit');
        }
        hit = true;
      } else if (roll === 1) {
        this.log('🎲 ' + roll + '+' + atkBonus + '=' + total + advTag + zoneTag + ' vs КД ' + enemyAc + ' — автопровал' + offHandTag, 'log-dice');
        this.playCombatSound('attack_miss');
      } else if (total >= enemyAc) {
        const baseDmg = this.rollPlayerWeaponDamage(false, slot) + smiteBonus;
        const favHit = this.addFavoredEnemyDamageToHit(enemy, baseDmg);
        const dmg = favHit.total;
        enemy.hp -= dmg;
        this.log('🎲 ' + roll + '+' + atkBonus + '=' + total + advTag + zoneTag + ' vs КД ' + enemyAc + ' — попадание! 💥 ' + dmg + ' урона (' + weaponLabel + ')' + offHandTag + this.favoredEnemyDamageNote(favHit.bonus) + (smiteBonus > 0 ? ' (с божественной кара)' : ''), 'log-damage');
        if (!this.playEnemyDamagedSound(enemy)) {
          this.playCombatSound(smiteBonus > 0 ? 'smite_hit' : this.getAttackSoundId(profile?.weaponId));
        }
        hit = true;
      } else {
        this.log('🎲 ' + roll + '+' + atkBonus + '=' + total + advTag + zoneTag + ' vs КД ' + enemyAc + ' — промах' + offHandTag, 'log-dice');
        this.playCombatSound('attack_miss');
      }
      if (typeof StatusManager !== 'undefined') {
        StatusManager.syncFlankingMarkers(this);
      }
      this.renderCombat();

      if (hit && smiteBonus === 0) {
        this.tryOfferReactionAfterPlayerHit(idx, true);
        return;
      }
      if (this.state.combat?.actionSurge) {
        this.state.combat.actionSurge = false;
        this.playerCombatTurn();
        return;
      }
      if (
        slot === 'weapon_main'
        && hit
        && this.playerHasExtraAttack()
        && !this.state.combat?.extraAttackUsed
        && enemy.hp > 0
      ) {
        this.state.combat.extraAttackUsed = true;
        this.state.combat.actionSurge = true;
        this.log('⚔️ Дополнительная атака!', 'log-combat');
        this.playerCombatTurn();
        return;
      }
      if (enemy.hp <= 0) {
        setTimeout(() => this.nextCombatTurn(), 600);
        return;
      }
      this.state.combat.turnIndex++;
      setTimeout(() => this.nextCombatTurn(), 600);
    },

    usePotionInCombat() {
      this.useConsumable('healing_potion');
    },

    playerFlee() {
      const roll = this.d20() + this.state.classData.initBonus;
      if (roll >= 14) {
        this.log('🏃 Удалось отступить! (' + roll + ')', 'log-combat');
        if (typeof this.clearCombatConcentration === 'function') this.clearCombatConcentration(true);
        if (typeof this.clearWildShapeIfCombatEnds === 'function') this.clearWildShapeIfCombatEnds();
        if (typeof this.clearTransformIfCombatEnds === 'function') this.clearTransformIfCombatEnds();
        this.finishCombatLogUI();
        this.state.combat = null; this.state.enemies = [];
        const ca = document.getElementById('combat-area');
        if (ca) ca.classList.add('hidden');
        this.updateCombatLayoutClasses();
        this.updateCombatTimeline();
        this.showScene('fled');
      } else {
        this.log('🏃 Не удалось (' + roll + ')', 'log-combat');
        this.state.combat.turnIndex++;
        setTimeout(() => this.nextCombatTurn(), 600);
      }
    },

    /** Уровень игрока для баланса (если level нет в сохранении — 1) */
    getPlayerLevelForBalance() {
      return Math.max(1, parseInt(this.state?.level, 10) || 1);
    },

    /** Бросок урона врага (кости + бонус; при крите — удвоение костей) */
    rollEnemyRawDamage(enemy, isCrit, attack) {
      const bonus = parseInt(attack?.dmgBonus ?? enemy.dmgBonus, 10) || 0;
      const dice = attack?.dmgRoll || enemy.dmgRoll || '1d6';
      const rollPart = this.parseRoll(dice);
      if (isCrit) return rollPart + this.parseRoll(dice) + bonus;
      return rollPart + bonus;
    },

    /**
     * Атака возможности игрока по уходящему врагу (тратит реакцию снаружи — OpportunityAttack).
     */
    executePlayerOpportunityAttack(enemyIndex, leaveEvent) {
      const enemy = this.state.enemies?.[enemyIndex];
      if (!enemy || enemy.hp <= 0) return false;

      const profile =
        typeof OpportunityAttack !== 'undefined'
          ? OpportunityAttack.pickPlayerMeleeAttack(this)
          : this.getWeaponAttackProfile('weapon_main');
      if (!profile) {
        this.log('❌ Нет подходящего оружия для атаки возможности.', 'log-damage');
        return false;
      }

      const slot = profile.isOffHand ? 'weapon_off' : 'weapon_main';
      const fromZone = leaveEvent?.fromZone;
      const atkBonus = profile.atkBonus ?? this.getEffectivePlayerAtkBonus();
      const enemyAc = this.getEffectiveEnemyAC(enemy);
      const weaponLabel = profile.weaponName || 'Атака';
      const rangeType =
        typeof CombatPosition !== 'undefined'
          ? CombatPosition.getWeaponRangeType(this, profile)
          : 'melee';

      let zoneMods = null;
      if (typeof CombatPosition !== 'undefined' && CombatPosition.isEnabled(this) && fromZone) {
        const zoneCheck = CombatPosition.validateAttack(this, {
          enemyIndex,
          rangeType,
          attackMode: 'melee',
          attackerZone: fromZone,
          targetZone: fromZone
        });
        if (!zoneCheck.valid) {
          this.log(`❌ Атака возможности: ${zoneCheck.reason}`, 'log-damage');
          return false;
        }
        zoneMods = zoneCheck.modifiers;
      }

      const rollPack =
        zoneMods && (zoneMods.advantage || zoneMods.disadvantage) && typeof CombatPosition !== 'undefined'
          ? CombatPosition.rollD20(this, zoneMods)
          : { roll: this.d20() };
      const roll = rollPack.roll;
      const total = roll + atkBonus;
      const advTag = rollPack.advantage
        ? ` (Advantage: ${rollPack.detail || roll})`
        : rollPack.disadvantage
          ? ` (Disadvantage: ${rollPack.detail || roll})`
          : '';

      if (roll === 20) {
        const baseDmg = this.rollPlayerWeaponDamage(true, slot);
        const favHit = this.addFavoredEnemyDamageToHit(enemy, baseDmg);
        enemy.hp -= favHit.total;
        this.log(
          `⚡ Крит! Атака возможности: ${roll}+${atkBonus}=${total}${advTag} | 💥 ${favHit.total} по ${enemy.name}`,
          'log-damage'
        );
        this.playCombatSound('attack_crit');
      } else if (total >= enemyAc) {
        const baseDmg = this.rollPlayerWeaponDamage(false, slot);
        const favHit = this.addFavoredEnemyDamageToHit(enemy, baseDmg);
        enemy.hp -= favHit.total;
        this.log(
          `⚡ Атака возможности (${weaponLabel}): ${roll}+${atkBonus}=${total}${advTag} vs КД ${enemyAc} | 💥 ${favHit.total}`,
          'log-damage'
        );
        if (!this.playEnemyDamagedSound(enemy)) {
          this.playCombatSound(this.getAttackSoundId());
        }
      } else {
        this.log(
          `⚡ Атака возможности: ${roll}+${atkBonus}=${total}${advTag} vs КД ${enemyAc} — промах`,
          'log-dice'
        );
        this.playCombatSound('attack_miss');
      }

      if (typeof CombatPosition !== 'undefined' && fromZone) {
        CombatPosition.recordAttackOnEnemy(this, enemyIndex, fromZone);
      }
      this.renderCombat();
      return true;
    },

    /**
     * Атака возможности врага по уходящему игроку.
     */
    executeEnemyOpportunityAttack(enemyIndex, leaveEvent) {
      const enemy = this.state.enemies?.[enemyIndex];
      if (!enemy || enemy.hp <= 0) return false;
      const attack =
        typeof OpportunityAttack !== 'undefined'
          ? OpportunityAttack.pickEnemyMeleeAttack(this, enemy, enemyIndex)
          : null;
      if (!attack) return false;
      return this.executeEnemyAttack(enemy, enemyIndex, attack, 'opportunity', {
        opportunityDepartureZone: leaveEvent?.fromZone
      });
    },

    /**
     * Атака врага по профилю (range / теги из JSON). Учитывает зоны и помеху в ближней дистанции.
     */
    executeEnemyAttack(enemy, enemyIndex, attack, note, opts) {
      if (!enemy || enemy.hp <= 0) return false;

      const atkBonus = parseInt(attack?.atkBonus ?? enemy.atkBonus, 10) || 3;
      const label = attack?.label || attack?.id || 'Атака';
      let effectiveAC = this.getEffectivePlayerAC();
      if (this.state.combat?.shieldSpell) {
        effectiveAC += 5;
        if (!this.isConcentratingCleanup?.('shieldSpell')) {
          this.state.combat.shieldSpell = false;
        }
      }

      let zoneMods = null;
      let rangeType = 'melee';
      if (typeof CombatPosition !== 'undefined' && CombatPosition.isEnabled(this)) {
        rangeType = CombatPosition.normalizeRangeType(attack?.range, {
          tags: attack?.tags
        });
        const oppZone = opts?.opportunityDepartureZone;
        const zoneCheck = oppZone
          ? CombatPosition.validateAttack(this, {
              attackerZone: CombatPosition.getEnemyPosition(this, enemyIndex),
              targetZone: oppZone,
              rangeType,
              attackerIsEnemy: true
            })
          : CombatPosition.validateAttackAgainstPlayer(this, enemyIndex, rangeType);
        if (!zoneCheck.valid) {
          this.log(`❌ ${enemy.name}: ${zoneCheck.reason}`, 'log-damage');
          return false;
        }
        zoneMods = zoneCheck.modifiers;
      }

      const rollPack =
        zoneMods && (zoneMods.advantage || zoneMods.disadvantage) && typeof CombatPosition !== 'undefined'
          ? CombatPosition.rollD20(this, zoneMods)
          : { roll: this.d20() };
      const roll = rollPack.roll;
      const total = roll + atkBonus;
      const advTag = rollPack.advantage
        ? ` (Advantage: ${rollPack.detail || roll})`
        : rollPack.disadvantage
          ? ` (Disadvantage: ${rollPack.detail || roll})`
          : '';
      const noteTag =
        note === 'opportunity'
          ? ' [атака возможности]'
          : note === 'ranged_in_melee'
            ? ' [вплотную]'
            : '';
      const atkLabel = label !== 'Атака' ? ` (${label})` : '';

      const applyEnemyOnHit = () => {
        if (!enemy.onHit?.addEffect) return;
        const h = this.getPlayerEffectHolder();
        if (h) this.applyStatusEffect(h, enemy.onHit.addEffect, enemy.name);
        this.renderCombat();
      };

      if (roll === 20) {
        this.logEnemyAttackRoll(enemy, roll, atkBonus, total, effectiveAC, 'crit');
        const rawDmg = this.rollEnemyRawDamage(enemy, true, attack);
        const { dead } = this.applyEnemyDamageToPlayer(rawDmg, enemy.name + atkLabel + noteTag);
        this.playEnemyAttackSound(enemy, 'hit');
        if (!dead) applyEnemyOnHit();
        this._finishEnemyAttackCleanup();
        return true;
      }
      if (total >= effectiveAC) {
        this.logEnemyAttackRoll(enemy, roll, atkBonus, total, effectiveAC, 'hit');
        const rawDmg = this.rollEnemyRawDamage(enemy, false, attack);
        const { dead } = this.applyEnemyDamageToPlayer(rawDmg, enemy.name + atkLabel + noteTag);
        this.playEnemyAttackSound(enemy, 'hit');
        if (!dead) applyEnemyOnHit();
        this._finishEnemyAttackCleanup();
        return true;
      }
      this.log(
        `${enemy.name}${atkLabel} бросает d20: ${roll} + ${atkBonus} = ${total}${advTag} против КД ${effectiveAC} → Промах${noteTag}`,
        'log-dice'
      );
      this.playEnemyAttackSound(enemy, 'miss');
      this._finishEnemyAttackCleanup();
      return true;
    },

    _finishEnemyAttackCleanup() {
      if (!this.state.combat) return;
      this.state.combat.shieldBlock = false;
      if (!this.isConcentratingCleanup?.('shieldOfFaith')) {
        this.state.combat.shieldOfFaith = false;
      }
      if (!this.isConcentratingCleanup?.('tempAcBonus')) {
        this.state.combat.tempAcBonus = 0;
      }
    },

    /** Базовая атака без тактики (fallback) */
    executeEnemyBasicAttack(enemy, enemyIndex, attack) {
      const profile =
        attack ||
        (typeof EnemyTacticalAI !== 'undefined'
          ? EnemyTacticalAI.getEnemyAttacks(this, enemy)[0]
          : null);
      if (profile) return this.executeEnemyAttack(enemy, enemyIndex, profile);
      return this.executeEnemyAttack(enemy, enemyIndex, {
        id: 'default',
        range: 'melee',
        atkBonus: enemy.atkBonus,
        dmgRoll: enemy.dmgRoll,
        dmgBonus: enemy.dmgBonus
      });
    },

    /** Снижение урона на ранних уровнях + нанесение урона игроку */
    applyEnemyDamageToPlayer(rawDmg, enemyName) {
      let dmg = Math.max(0, parseInt(rawDmg, 10) || 0);
      let suffix = '';
      // Снижение урона на ранних уровнях
      if (this.getPlayerLevelForBalance() <= 2) {
        const reduced = Math.floor(dmg * 0.7);
        if (reduced < dmg) suffix = ' (снижено на раннем уровне)';
        dmg = reduced;
      }
      const dead = this.takeDamage(dmg);
      const who = enemyName || 'Враг';
      this.log(`${who} наносит ${dmg} урона${suffix}`, 'log-damage');
      return { dmg, dead };
    },

    // Лог броска d20 при атаке врага
    logEnemyAttackRoll(enemy, roll, bonus, total, targetAc, outcome) {
      const name = enemy?.name || 'Враг';
      let resultLabel;
      if (outcome === 'crit') resultLabel = 'Критическое попадание!';
      else if (outcome === 'hit') resultLabel = 'Попадание!';
      else resultLabel = 'Промах';
      this.log(
        `${name} бросает d20: ${roll} + ${bonus} = ${total} против КД ${targetAc} → ${resultLabel}`,
        outcome === 'miss' ? 'log-dice' : 'log-combat'
      );
    },

    enemyTurn(enemy, enemyIndex) {
      if (!enemy || enemy.hp <= 0) return;
      const idx =
        enemyIndex != null
          ? enemyIndex
          : (this.state.enemies || []).indexOf(enemy);
      if (idx < 0) {
        this.executeEnemyBasicAttack(enemy, 0, null);
        return;
      }

      if (typeof EnemyTacticalAI !== 'undefined') {
        EnemyTacticalAI.runTurn(this, enemy, idx);
        return;
      }
      this.executeEnemyBasicAttack(enemy, idx, null);
    },

  });
})();


;/* —— js/engine/dialog.js —— */
// ============================================================
// engine/dialog.js — диалоговая система
// ============================================================

(function attachEngineDialog() {
  'use strict';
  if (typeof GameEngine === 'undefined') {
    console.error('engine/dialog.js: GameEngine не определён — загрузите core.js первым');
    return;
  }

  Object.assign(GameEngine, {
    setDialogue(lines) {
      const area = document.getElementById('dialogue-area');
      if (!area) return;
      const rows = (lines || []).map(l => {
        const speaker = this.processSceneTemplate(l.speaker || '');
        const text = this.processSceneTemplate(l.text || l.line || '');
        return `<div class="dialogue-block"><div class="speaker">${this.escapeHtml(speaker)}:</div><div class="text">«${this.escapeHtml(text)}»</div></div>`;
      });
      area.innerHTML = rows.join('');
    },

    clearDialogue() {
      const area = document.getElementById('dialogue-area');
      if (area) area.innerHTML = '';
    },
  });
})();


;/* —— js/engine/save-load.js —— */
// ============================================================
// engine/save-load.js — сохранение и загрузка
// ============================================================

(function attachEngineSaveLoad() {
  'use strict';
  if (typeof GameEngine === 'undefined') {
    console.error('engine/save-load.js: GameEngine не определён — загрузите core.js первым');
    return;
  }

  Object.assign(GameEngine, {
    /**
     * Сохранение в localStorage.
     * @param {{ force?: boolean, quiet?: boolean }} [opts]
     * force — сразу (кнопка «Сохранить»); иначе отложено до смены сцены.
     */
    saveGame(opts = {}) {
      if (opts.force) {
        return this.persistSave(opts);
      }
      this._saveDirty = true;
      return true;
    },

    /** Автосохранение только при переходе на другую сцену */
    autosaveOnSceneChange(prevSceneId) {
      if (prevSceneId === this.state.scene) return;
      this._saveDirty = false;
      this.persistSave({ quiet: true });
    },

    persistSave(opts = {}) {
      try {
        const saveData = {
          version: this.data?.meta?.version || "2.0",
          timestamp: Date.now(),
          charName: this.state.charName,
          className: this.state.className,
          gender: this.state.gender || 'male',
          raceKey: this.state.raceKey || '',
          heritageId: this.state.heritageId || '',
          pf2eFixedBoosts: this.state.pf2eFixedBoosts || null,
          pf2eFreeBoosts: this.state.pf2eFreeBoosts || null,
          stats: this.state.stats,
          hp: this.state.hp,
          maxHp: this.state.maxHp,
          baseMaxHp: this.state.baseMaxHp,
          gold: this.state.gold,
          inventory: this.state.inventory,
          flags: this.state.flags,
          scene: this.state.scene,
          supplies: this.state.supplies,
          resources: this.state.resources,
          // Quest save: questProgress is source of truth (format v2).
          // questStages is a derived mirror for older readers / conditions.
          questSaveVersion: 2,
          questProgress: (typeof QuestRuntime !== 'undefined'
            ? (QuestRuntime.bind(this), QuestRuntime.serializeAll())
            : (this.state.questProgress || {})),
          questStages: (typeof QuestRuntime !== 'undefined'
            ? (QuestRuntime._mirrorProgressToLegacyStages(), this.state.questStages || {})
            : (this.state.questStages || {})),
          level: this.state.level,
          exp: this.state.exp,
          expAwarded: this.state.expAwarded,
          classData: this.state.classData,
          proficiencies: this.state.proficiencies || { skills: [] },
          skills: this.state.skills || {},
          skillIncreases: this.state.skillIncreases || [],
          equipped: this.state.equipped || {},
          curseEffects: this.state.curseEffects || {},
          itemEnhancements: this.state.itemEnhancements || {},
          itemCharges: this.state.itemCharges || {},
          resumeAfterLevelUp: this.state.resumeAfterLevelUp,
          favoredEnemyTypes: this.state.favoredEnemyTypes || [],
          wildShape: this.state.wildShape || null,
          transformation: this.state.transformation || null,
          passiveTransformModifiers: this.state.passiveTransformModifiers || [],
          crafting: this.state.crafting || { knownRecipes: [] },
          sceneVisits: this.state.sceneVisits || {},
          visitedLocations: this.state.visitedLocations || {},
          clearedCombats: this.state.clearedCombats || {},
          gameTime: this.timeSystem?.getSaveState?.() || this.state.gameTime || null,
          gameSeason: this.seasonSystem?.getSaveState?.() || this.state.gameSeason || null,
          gameWeather: this.weatherSystem?.getSaveState?.() || this.state.gameWeather || null,
          achievementUnlocks: this.state.achievementUnlocks || {}
        };

        localStorage.setItem(this.getSaveKey(), JSON.stringify(saveData));
        if (!opts.quiet) {
          this.log('💾 Игра сохранена успешно', 'log-heal');
        }
        return true;
      } catch (e) {
        console.error(e);
        this.log('❌ Ошибка сохранения', 'log-damage');
        return false;
      }
    },

    /** Загрузка сохранения (алиас для loadGame) */
    loadSave() {
      return this.loadGame();
    },

        loadGame() {
      try {
        const saved = localStorage.getItem(this.getSaveKey());
        if (!saved) {
          this.log('💾 Сохранений не найдено', 'log-dice');
          return false;
        }

        const data = JSON.parse(saved);

        this.state.charName = data.charName || 'Герой';
        this.state.className = data.className;
        this.state.gender = data.gender || 'male';
        this.state.raceKey = data.raceKey || '';
        this.state.raceData = this.state.raceKey ? this.getRaceData(this.state.raceKey) : null;
        this.state.heritageId = data.heritageId || '';
        this.state.pf2eFixedBoosts = data.pf2eFixedBoosts || null;
        this.state.pf2eFreeBoosts = data.pf2eFreeBoosts || null;
        this.state.stats = data.stats || data.classData?.stats || null;
        this.state.hp = parseInt(data.hp) || 25;
        this.state.maxHp = parseInt(data.maxHp) || 25;
        this.state.baseMaxHp = data.baseMaxHp != null ? parseInt(data.baseMaxHp, 10) : null;
        this.state._lastComputedMaxHp = this.state.maxHp;
        this.state.gold = parseInt(data.gold) || 0;
        this.state.inventory = data.inventory || [];
        this.state.flags = data.flags || {};
        this.applyStartingFlags();
        this.state.scene = data.scene || 'village';
        this.state.supplies = parseInt(data.supplies) || 0;
        // Load quests: prefer questProgress (V2); hydrate migrates V1 questStages if needed
        this.state.questStages = data.questStages || {};
        this.state.questProgress = data.questProgress || {};
        if (typeof QuestRuntime !== 'undefined') {
          QuestRuntime.bind(this);
          QuestRuntime.hydrateFromSave(this);
        }
        this.migrateSaveQuestStages();
        this.state.resources = data.resources || { mode: 'energy', current: 2, max: 2, spellSlots: null };
        this.migrateResourcesState();
        this.state.level = parseInt(data.level, 10) || 1;
        this.state.exp = parseInt(data.exp, 10) || 0;
        this.state.expAwarded = data.expAwarded || {};
        this.state.pendingLevelUp = null;
        this.state.resumeAfterLevelUp = data.resumeAfterLevelUp || null;
        this.state.sceneVisits = data.sceneVisits || {};
        this.state.visitedLocations = data.visitedLocations || {};
        this.state.clearedCombats = data.clearedCombats || {};
        this.state.achievementUnlocks = data.achievementUnlocks || {};
        this.migrateClearedCombatsFromSave();
        this.migrateQuestMapUnlocksFromSave();
        this.migrateVisitedLocations();
        this.state.itemCharges = data.itemCharges || {};
        this.migrateSuppliesState();
        this.migrateArrowAmmoState();
        if (this.state.inventory.includes('water_flask')) {
          this.initItemChargesOnAdd('water_flask');
        }

        this.state.equipped = data.equipped || {};
        this.state.curseEffects = data.curseEffects || {};
        this.state.itemEnhancements = data.itemEnhancements || {};
        this.migrateEquippedSlots();
        this.migrateCurseState();
        this.migrateMillAccessFlag();
        this.migrateAlbertQuestState();

        if (this.state.className && !this.data?.classes?.[this.state.className]) {
          this.state.className = 'warrior';
          this.log('⚠️ Неизвестный класс в сохранении — выбран Воин.', 'log-dice');
        }

        const savedProf = data.proficiencies?.skills;
        if (Array.isArray(savedProf)) {
          this.state.proficiencies = { skills: savedProf.map(s => String(s).toLowerCase()) };
        } else if (data.classData?.skillIds?.length) {
          this.state.proficiencies = { skills: [...data.classData.skillIds] };
        } else {
          this.state.proficiencies = { skills: [] };
        }

        this.state.skills = data.skills && typeof data.skills === 'object' ? { ...data.skills } : {};
        this.state.skillIncreases = Array.isArray(data.skillIncreases) ? [...data.skillIncreases] : [];
        this.migratePf2eSkillsState();
        this.state.favoredEnemyTypes = Array.isArray(data.favoredEnemyTypes)
          ? [...data.favoredEnemyTypes]
          : [];
        this.state.wildShape = data.wildShape && typeof data.wildShape === 'object'
          ? { ...data.wildShape, knownForms: [...(data.wildShape.knownForms || [])] }
          : null;
        this.state.transformation = data.transformation && typeof data.transformation === 'object'
          ? { ...data.transformation }
          : null;
        this.state.passiveTransformModifiers = Array.isArray(data.passiveTransformModifiers)
          ? [...data.passiveTransformModifiers]
          : [];
        if (this.state.passiveTransformModifiers.length && typeof this.applyTransformModifiers === 'function') {
          this.applyTransformModifiers(this.state.passiveTransformModifiers);
        }
        if (data.gameTime && typeof data.gameTime === 'object') {
          this.state.gameTime = { ...data.gameTime };
          if (this.timeSystem) {
            this.timeSystem.loadState(this.state.gameTime);
            this.timeSystem.updateUI?.();
          }
        }
        if (typeof this.migrateWildShapeState === 'function') {
          this.migrateWildShapeState();
        }
        this.state.crafting = data.crafting && typeof data.crafting === 'object'
          ? { knownRecipes: [...(data.crafting.knownRecipes || [])] }
          : null;
        this.migrateCraftingState();

        if (data.classData && data.className) {
          this.state.classData = data.classData;
          if (!this.state.classData.skillIds?.length && this.state.proficiencies.skills.length) {
            this.state.classData.skillIds = [...this.state.proficiencies.skills];
          }
          this.state.classData.abilities = this.reconcileAbilities(
            this.state.classData.abilities,
            data.className
          );
          const race = this.getRaceData(this.state.raceKey);
          const racial = this.buildRacialAbilities(race);
          racial.forEach(ab => {
            if (!this.state.classData.abilities.some(a => a.id === ab.id)) {
              this.state.classData.abilities.push(
                this.normalizeAbility(ab, data.className, this.state.classData.abilities.length)
              );
            }
          });
        } else if (this.state.className && this.data?.classes?.[this.state.className]) {
          const cls = this.data.classes[this.state.className];
          const resource = cls.resource || { name: 'Ресурс', max: 2, desc: '' };
          this.state.classData = {
            ac: cls.ac ?? 10,
            atkBonus: cls.atkBonus ?? 0,
            dmgRoll: cls.dmgRoll || '1d6',
            dmgBonus: cls.dmgBonus ?? 0,
            initBonus: cls.initBonus ?? 0,
            stats: JSON.parse(JSON.stringify(cls.stats || {})),
            skills: cls.skills || '',
            resourceName: resource.name,
            resourceDesc: resource.desc || '',
            abilities: this.normalizeAbilities(cls.abilities, this.state.className)
          };
          if (!Object.keys(this.state.equipped).length) {
            this.autoEquipStartingGear(this.state.className);
          }
        }

        if (this.state.classData) {
          this.recalculateCombatStats();
        }

        // Переключение экранов
        this.hideCharacterCreator();
        document.getElementById('class-screen').classList.add('hidden');
        document.getElementById('name-screen').classList.add('hidden');
        this.ensurePlayerUIVisible({ force: true });

        // Обновление интерфейса
        this.setCharName(this.state.charName);

        this.renderClassDisplay(this.state.className);
        this.migratePf2eSkillsState();
        this.updateUI();

        const resLabel = document.getElementById('resource-label');
        if (resLabel && this.state.classData?.resourceName) {
          resLabel.textContent = this.state.classData.resourceName;
        }

        this.showScene(this.state.scene);
        this.migrateFavoredEnemyState();

        this.log('✅ Сохранение загружено', 'log-heal');
        return true;
      } catch (e) {
        console.error('Ошибка загрузки:', e);
        this.log('❌ Ошибка загрузки сохранения', 'log-damage');
        return false;
      }
    },

    deleteSave() {
      if (confirm('Удалить сохранение игры?')) {
        localStorage.removeItem(this.getSaveKey());
        this.log('🗑 Сохранение удалено', 'log-dice');
      }
    }
  });
})();

// dataVersion migration on load
(function patchSaveLoadMigration() {
  if (typeof GameEngine === 'undefined') return;
  const migrate = (data) => {
    if (typeof ProjectDataSchema !== 'undefined' && data) {
      return ProjectDataSchema.migrateProjectData(data);
    }
    return data;
  };
  const origLoadFile = GameEngine.loadGameDataFromFile;
  if (typeof origLoadFile === 'function') {
    // leave file picker; patch internal assign if any
  }
  const origApply = GameEngine.applyGameData || GameEngine.setGameData || GameEngine.loadData;
  // Patch common path: when state gets data from JSON.parse in load
  const origLoad = GameEngine.loadGame;
  if (typeof origLoad === 'function' && !GameEngine._dataSchemaPatched) {
    GameEngine._dataSchemaPatched = true;
    GameEngine.loadGame = function (...args) {
      const r = origLoad.apply(this, args);
      if (this.data) this.data = migrate(this.data);
      return r;
    };
  }
  if (typeof GameEngine.init === 'function' && !GameEngine._dataSchemaInitPatched) {
    GameEngine._dataSchemaInitPatched = true;
    const oi = GameEngine.init.bind(GameEngine);
    GameEngine.init = function (...args) {
      if (this.data) this.data = migrate(this.data);
      return oi(...args);
    };
  }
})();


;/* —— js/engine/scene-element-runner.js —— */
// Последовательное выполнение Scene Elements

const SceneElementRunner = {
  _attach(engine) {
    if (!engine || engine._sceneElementRunnerAttached) return;
    engine._sceneElementRunnerAttached = true;
    engine.resumeSceneElements = function () {
      SceneElementRunner.resume(engine);
    };
  },

  shouldSkipElement(engine, el, applyRewards) {
    if (el.enabled === false) return true;
    if (el.firstVisitOnly && !applyRewards) return true;
    return false;
  },

  clearRunner(engine) {
    if (engine.state._sceneRunner) delete engine.state._sceneRunner;
  },

  initRunner(engine, ctx) {
    engine.state._sceneRunner = {
      sceneId: ctx.sceneId,
      list: 'main',
      index: 0,
      paused: false,
      ctx,
      completed: false
    };
  },

  getRunner(engine) {
    return engine.state._sceneRunner || null;
  },

  async runOnEnter(engine, scene, applyRewards) {
    const list = scene.onEnterElements || [];
    for (let i = 0; i < list.length; i++) {
      const el = list[i];
      if (this.shouldSkipElement(engine, el, applyRewards)) continue;
      const done = await this.executeElement(engine, el, { ...this.getRunner(engine)?.ctx, phase: 'onEnter' });
      if (done === 'pause') return false;
    }
    return true;
  },

  runSceneFlow(engine, ctx) {
    this._attach(engine);
    const { sceneId, scene, rawScene, options, applyRewards, text } = ctx;

    if (typeof SceneElements !== 'undefined') {
      SceneElements.ensureMigrated(rawScene);
    }

    const hasServiceOnly = this._hasOnlyServiceElements(rawScene);
    const hasLegacyComponents = (rawScene.components || []).some((c) => {
      const t = c.component || c.type;
      return t && t !== 'service_menu';
    });

    if (hasLegacyComponents && engine.hasSceneComponents?.(rawScene)) {
      this._runLegacyComponents(engine, ctx);
      return;
    }

    this.initRunner(engine, ctx);

    const self = this;
    (async () => {
      await self.runOnEnter(engine, rawScene, applyRewards);

      if (applyRewards && rawScene.npcId) {
        engine.applyNpcReputationEffects?.(rawScene.npcId, 'talk');
      }
      engine.maybeAlbertWalksToVillage?.(sceneId);

      await self.runMainSequence(engine);
    })();
  },

  _hasOnlyServiceElements(rawScene) {
    const comps = rawScene.components || [];
    if (!comps.length) return false;
    return comps.every((c) => (c.component || c.type) === 'service_menu');
  },

  _runLegacyComponents(engine, ctx) {
    const { sceneId, scene, rawScene } = ctx;
    const sceneWithComponents = scene.components?.length ? scene : { ...scene, components: rawScene.components };
    engine.renderSceneComponents?.(sceneId, sceneWithComponents);
    engine._runSceneChainOnEnter?.(sceneWithComponents.components);
    engine.renderTravelMenu?.();
    engine.initTooltips?.();
  },

  async runMainSequence(engine) {
    const runner = this.getRunner(engine);
    if (!runner || runner.completed) return;

    const rawScene = runner.ctx.rawScene;
    const scene = runner.ctx.scene;
    const applyRewards = runner.ctx.applyRewards;
    const list = rawScene.elements || [];

    while (runner.index < list.length) {
      const el = list[runner.index];
      runner.index += 1;

      if (this.shouldSkipElement(engine, el, applyRewards)) continue;

      const result = await this.executeElement(engine, el, { ...runner.ctx, phase: 'main' });
      if (result === 'pause') {
        runner.paused = true;
        runner.index -= 1;
        return;
      }
    }

    if (!list.some((e) => e.type === 'show_choices' && e.enabled !== false)) {
      const sceneChoices = engine.withWaterRefillChoices?.(scene.choices, rawScene) || scene.choices || [];
      if (sceneChoices.length) {
        engine.setChoices(sceneChoices);
      } else {
        engine.setChoices([]);
      }
    }

    runner.completed = true;
    engine.renderTravelMenu?.();
    engine.initTooltips?.();
    if (typeof engine.getTimePeriod === 'function') {
      engine._lastSceneTimePeriod = engine.getTimePeriod();
    }
    this.clearRunner(engine);
  },

  resume(engine) {
    const runner = this.getRunner(engine);
    if (!runner || !runner.paused) return;
    runner.paused = false;
    runner.index += 1;
    this.runMainSequence(engine);
  },

  resumeAfterCombat(engine, nextSceneFromCombat) {
    const runner = this.getRunner(engine);
    if (runner?.paused) {
      runner.paused = false;
      this.runMainSequence(engine);
      return true;
    }
    if (nextSceneFromCombat && engine.data.scenes[nextSceneFromCombat]) {
      engine.showScene(nextSceneFromCombat);
    }
    return false;
  },

  async executeElement(engine, el, ctx) {
    const d = el.data || {};
    const type = el.type;

    switch (type) {
      case 'set_flag':
        engine.applyFlags?.({ [d.key]: d.value });
        return 'continue';

      case 'give_item': {
        const n = Math.max(1, parseInt(d.count, 10) || 1);
        for (let i = 0; i < n; i++) {
          if (d.itemId) engine.addItem?.(d.itemId);
        }
        return 'continue';
      }

      case 'remove_item':
        if (typeof ActionRunner !== 'undefined' && ACTION_REGISTRY?.remove_item) {
          ActionRunner.runV2('remove_item', { itemId: d.itemId, count: d.count || 1 }, engine);
        }
        return 'continue';

      case 'award_gold':
        if (d.amount) {
          engine.state.gold = (engine.state.gold || 0) + Math.max(0, parseInt(d.amount, 10) || 0);
          engine.updateStats?.();
          engine.log?.(`💰 +${d.amount} зм`, 'log-heal');
        }
        return 'continue';

      case 'award_exp':
        if (d.amount) {
          engine.grantExpOnce?.(`scene:${ctx.sceneId}:el:${el.id}`, d.amount, 'сцена');
        } else if (ctx.rawScene?.exp) {
          engine.awardSceneExp?.(ctx.rawScene);
        }
        return 'continue';

      case 'quest_start':
      case 'quest_complete':
        if (d.questId && d.stage != null) {
          engine.updateQuest?.(d.questId, d.stage);
        }
        return 'continue';

      case 'add_status':
        if (typeof ActionRunner !== 'undefined') {
          ActionRunner.runV2('apply_effect', {
            effect: d.effect,
            duration: d.duration || 3,
            target: d.target || 'self'
          }, engine);
        }
        return 'continue';

      case 'remove_status':
        if (typeof ActionRunner !== 'undefined') {
          ActionRunner.runV2('remove_effect', {
            effect: d.effect,
            target: d.target || 'self'
          }, engine);
        }
        return 'continue';

      case 'achievement':
        if (d.achievementId && typeof AchievementSystem !== 'undefined') {
          const ach = engine.data?.achievements?.[d.achievementId];
          AchievementSystem.unlock(engine, d.achievementId, ach);
        }
        return 'continue';

      case 'music':
        if (d.ambient || d.sfxOnEnter) {
          engine.playSceneAudio?.({
            ambient: d.ambient,
            sfxOnEnter: d.sfxOnEnter,
            volume: d.volume,
            loop: d.loop !== false
          });
        } else if (d.track && typeof ActionRunner !== 'undefined') {
          ActionRunner.runV2('play_music', { track: d.track, volume: d.volume }, engine);
        }
        return 'continue';

      case 'image':
        this._showImage(engine, d);
        return 'continue';

      case 'show_text':
        if (d.text) engine.setText?.(d.text);
        return 'continue';

      case 'custom_action':
        if (d.chainId && typeof engine.executeChain === 'function') {
          await engine.executeChain(d.chainId);
        } else if (d.action && typeof ActionRunner !== 'undefined') {
          ActionRunner.runV2(d.action, d.params || {}, engine);
        }
        return 'continue';

      case 'change_scene':
        if (d.sceneId && engine.data.scenes[d.sceneId]) {
          engine.showScene(d.sceneId, ctx.options || {});
          return 'pause';
        }
        return 'continue';

      case 'skill_check':
        return this._runSkillCheckElement(engine, el, ctx);

      case 'combat':
        return this._runCombatElement(engine, el, ctx);

      case 'show_choices':
        return this._runShowChoices(engine, ctx);

      case 'service_menu':
        return this._runServiceMenu(engine, el, ctx);

      default:
        return 'continue';
    }
  },

  _showImage(engine, d) {
    let box = document.getElementById('scene-image-box');
    if (!d.src) {
      if (box) box.remove();
      return;
    }
    if (!box) {
      box = document.createElement('div');
      box.id = 'scene-image-box';
      box.className = 'scene-image-box';
      const story = document.getElementById('story-text');
      if (story?.parentNode) story.parentNode.insertBefore(box, story);
    }
    box.innerHTML = `<img src="${String(d.src).replace(/"/g, '&quot;')}" alt="" style="max-width:100%;border-radius:8px;">`
      + (d.caption ? `<p class="scene-image-caption">${d.caption}</p>` : '');
  },

  _runShowChoices(engine, ctx) {
    const scene = ctx.scene;
    const rawScene = ctx.rawScene;
    const sceneChoices = engine.withWaterRefillChoices?.(scene.choices, rawScene) || scene.choices || [];
    engine.setChoices(sceneChoices.length ? sceneChoices : []);
    return 'pause';
  },

  _runServiceMenu(engine, el, ctx) {
    const d = el.data || {};
    const comp = {
      component: 'service_menu',
      id: d.id || 'service_menu',
      enabled: d.enabled !== false,
      params: d.params || { services: [] }
    };
    const sceneId = ctx.sceneId;
    const scene = { ...ctx.scene, components: [comp] };
    engine.renderSceneComponents?.(sceneId, scene);
    engine.renderTravelMenu?.();
    return 'pause';
  },

  _runSkillCheckElement(engine, el, ctx) {
    const d = el.data || {};
    const skill = d.skill || 'perception';
    const dc = parseInt(d.dc, 10) || 12;
    const bonus = engine.getSkillBonus?.(skill) || 0;
    const roll = (engine.d20?.() || 1) + bonus;
    const fakeChoice = { to: d.successNext || d.failNext || '' };

    if (roll >= dc) {
      engine.log?.(`✅ Успех! ${skill}: ${roll} vs ${dc}`, 'log-combat');
      engine.setText?.(d.successText || 'Проверка пройдена!');
      engine.clearDialogue?.();
      engine.applyFlags?.(d.successFlags);
      if (d.successItems?.length) d.successItems.forEach((id) => engine.addItem?.(id));
      engine.setChoices([{ text: 'Продолжить', action: 'scene_element_resume' }]);
    } else {
      engine.log?.(`❌ Провал. ${skill}: ${roll} vs ${dc}`, 'log-dice');
      engine.setText?.(d.failText || 'Проверка провалена.');
      engine.clearDialogue?.();
      engine.applyFlags?.(d.failFlags);
      engine.setChoices([{ text: 'Продолжить', action: 'scene_element_resume' }]);
    }

    const runner = this.getRunner(engine);
    if (runner) runner.paused = true;
    return 'pause';
  },

  _runCombatElement(engine, el, ctx) {
    const d = el.data || {};
    const enemies = d.enemies || [];
    const sceneId = ctx.sceneId;

    if (!enemies.length) return 'continue';

    if (engine.isCombatSceneCleared?.(sceneId)) {
      const after = d.nextScene;
      if (after && engine.data.scenes[after]) {
        engine.showScene(after, ctx.options || {});
        return 'pause';
      }
      const note = '\n\n☠️ Бой уже пройден.';
      engine.setText?.((ctx.text || '') + note);
      engine.setChoices([{ text: '➡️ Продолжить', action: 'scene_element_resume' }]);
      const runner = this.getRunner(engine);
      if (runner) runner.paused = true;
      return 'pause';
    }

    if (!ctx.applyRewards) {
      const note = '\n\n⚠️ Вы уже были здесь — бой не начинается повторно.';
      engine.setText?.((ctx.text || '') + note);
      engine.setChoices([{ text: '➡️ Продолжить', action: 'scene_element_resume' }]);
      const runner = this.getRunner(engine);
      if (runner) runner.paused = true;
      return 'pause';
    }

    const missing = enemies.filter((eid) => !engine.data.enemies?.[eid]);
    if (missing.length) {
      engine.setText?.('Ошибка данных: не найдены враги: ' + missing.join(', '));
      engine.setChoices([]);
      return 'pause';
    }

    const enemyObjs = enemies.map((eid) => {
      const e = engine.data.enemies[eid];
      return {
        ...e,
        id: eid,
        maxHp: e.hp,
        creatureType: e.creatureType || engine.getDefaultCreatureType?.()
      };
    });

    const runner = this.getRunner(engine);
    if (runner) runner.paused = true;

    engine.state._combatFromSceneElement = true;
    if (engine.tryEnterCombatWithReputation?.({ combat: enemies }, enemyObjs)) {
      return 'pause';
    }
    engine.startCombat(enemyObjs, d.nextScene || '', enemies);
    return 'pause';
  }
};

if (typeof window !== 'undefined') {
  window.SceneElementRunner = SceneElementRunner;
}

