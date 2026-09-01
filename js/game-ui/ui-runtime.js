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
