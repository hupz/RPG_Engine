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
