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
