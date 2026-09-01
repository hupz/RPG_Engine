/**
 * Phase 1.4–1.5 — Visual Scene Editor (no-code)
 * Viewport + drag/resize + asset picker. Hooks.after only — no monkey-patch.
 * Data: Editor.data.scenes[id].visual  |  Runtime: VisualRuntime
 */
(function editorVisualScene(global) {
  'use strict';

  if (typeof Editor === 'undefined') {
    console.warn('[editor-visual-scene] Editor missing');
    return;
  }

  const KIND_META = {
    image: { label: 'Изображение', icon: '🖼️' },
    text: { label: 'Текст', icon: '📝' },
    button: { label: 'Кнопка', icon: '🔘' },
    panel: { label: 'Панель', icon: '▦' },
    hotspot: { label: 'Область (Hotspot)', icon: '📍' }
  };

  /**
   * Action UX from Editor Action Catalog (Phase 1.10.2).
   * Runtime JSON still uses ACTION_REGISTRY ids only.
   */
  function catalogActions() {
    if (typeof Editor !== 'undefined' && typeof Editor.listActionsForEditor === 'function') {
      const list = Editor.listActionsForEditor();
      if (list && list.length) return list;
    }
    if (typeof EditorActionCatalog !== 'undefined' && EditorActionCatalog.listActionsForEditor) {
      return EditorActionCatalog.listActionsForEditor();
    }
    // Minimal fallback if catalog script not loaded (headless tests)
    return [
      { id: 'change_scene', label: 'Открыть сцену', category: 'navigation', writerSafe: true },
      { id: 'open_panel', label: 'Открыть панель', category: 'interface', writerSafe: true },
      { id: 'add_item', label: 'Выдать предмет', category: 'items', writerSafe: true },
      { id: 'remove_item', label: 'Забрать предмет', category: 'items', writerSafe: true },
      { id: 'add_gold', label: 'Дать золото', category: 'economy', writerSafe: true },
      { id: 'remove_gold', label: 'Забрать золото', category: 'economy', writerSafe: true },
      { id: 'update_quest', label: 'Обновить квест', category: 'quest', writerSafe: true },
      { id: 'say', label: 'Реплика NPC', category: 'dialogue', writerSafe: true },
      { id: 'start_combat', label: 'Начать бой', category: 'combat', writerSafe: true }
    ];
  }

  /** Interaction state — not on Editor.data */
  const ui = {
    drag: null, // { nodeId, mode: 'move'|'resize'|'draw', corner?, startX, startY, orig, beforeSnap }
    drawMode: false,
    snap: false,
    grid: 0.05,
    suppressFullRender: false
  };

  function esc(s) {
    if (typeof Editor.escapeHtml === 'function') return Editor.escapeHtml(String(s == null ? '' : s));
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function escAttr(s) {
    if (typeof Editor.escapeAttr === 'function') return Editor.escapeAttr(String(s == null ? '' : s));
    return esc(s).replace(/'/g, '&#39;');
  }
  function genId(kind) {
    return (kind || 'node') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  }

  function ensureVisual(scene) {
    if (!scene.visual || typeof scene.visual !== 'object') scene.visual = { mode: 'overlay', nodes: [] };
    if (!Array.isArray(scene.visual.nodes)) scene.visual.nodes = [];
    if (scene.visual.mode !== 'none' && scene.visual.mode !== 'overlay') {
      scene.visual.mode = scene.visual.nodes.length ? 'overlay' : 'none';
    }
    return scene.visual;
  }

  function currentSceneObj() {
    const id = Editor.currentScene;
    if (!id || !Editor.data?.scenes?.[id]) return null;
    return Editor.data.scenes[id];
  }

  function cloneScene(scene) {
    if (typeof EditorHistory !== 'undefined' && EditorHistory.clone) return EditorHistory.clone(scene);
    try {
      return JSON.parse(JSON.stringify(scene));
    } catch (_) {
      return null;
    }
  }

  function withSceneHistory(mutateFn) {
    const scene = currentSceneObj();
    if (!scene) return;
    const ctx = { type: 'visual', id: Editor.currentScene };
    const before = scene.visual
      ? (typeof EditorHistory !== 'undefined' && EditorHistory.clone
        ? EditorHistory.clone(scene.visual)
        : JSON.parse(JSON.stringify(scene.visual)))
      : null;
    mutateFn(scene);
    if (typeof EditorHistory !== 'undefined' && EditorHistory.recordMutation) {
      try {
        EditorHistory.recordMutation(ctx, {
          type: 'visual',
          id: Editor.currentScene,
          payload: before ? EditorHistory.clone(before) : null,
          meta: {}
        });
      } catch (_) { /* optional */ }
    }
    if (typeof Editor.markDirty === 'function') Editor.markDirty();
    else Editor._projectDirty = true;
  }

  /** Begin interaction: snapshot once. End: single recordMutation. */
  function beginNodeGesture(nodeId, mode, corner) {
    const scene = currentSceneObj();
    if (!scene) return null;
    const node = findNode(scene, nodeId);
    if (!node && mode !== 'draw') return null;
    const before = scene.visual
      ? (typeof EditorHistory !== 'undefined' && EditorHistory.clone
        ? EditorHistory.clone(scene.visual)
        : JSON.parse(JSON.stringify(scene.visual)))
      : null;
    ui.drag = {
      nodeId: nodeId,
      mode: mode,
      corner: corner || null,
      before: before,
      orig: node
        ? {
            x: node.transform?.x ?? 0,
            y: node.transform?.y ?? 0,
            w: node.transform?.w ?? 0.1,
            h: node.transform?.h ?? 0.1
          }
        : null
    };
    return ui.drag;
  }

  function endNodeGesture() {
    if (!ui.drag || !ui.drag.before) {
      ui.drag = null;
      return;
    }
    const scene = currentSceneObj();
    const ctx = { type: 'visual', id: Editor.currentScene };
    if (scene && typeof EditorHistory !== 'undefined' && EditorHistory.recordMutation) {
      try {
        EditorHistory.recordMutation(ctx, {
          type: 'visual',
          id: Editor.currentScene,
          payload: ui.drag.before ? EditorHistory.clone(ui.drag.before) : null,
          meta: {}
        });
      } catch (_) { /* optional */ }
    }
    if (typeof Editor.markDirty === 'function') Editor.markDirty();
    else Editor._projectDirty = true;
    ui.drag = null;
  }

  function snapVal(v) {
    if (!ui.snap) return v;
    const g = ui.grid > 0 ? ui.grid : 0.05;
    return Math.round(v / g) * g;
  }

  function clamp01(n, fb) {
    const v = Number(n);
    if (!Number.isFinite(v)) return fb;
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
  }

  function defaultNode(kind) {
    const k = KIND_META[kind] ? kind : 'hotspot';
    const base = {
      id: genId(k),
      kind: k,
      layer: k === 'button' || k === 'panel' ? 'hud' : 'world',
      transform: { x: 0.35, y: 0.35, w: 0.2, h: 0.15, z: 1 },
      visible: true,
      enabled: true,
      props: {},
      events: { click: [] }
    };
    if (k === 'image') {
      base.asset = { type: 'image', src: '', ref: '' };
      base.transform = { x: 0.25, y: 0.25, w: 0.5, h: 0.5, z: 1 };
    }
    if (k === 'text') base.props = { text: 'Текст', fontSize: 14, align: 'left' };
    if (k === 'button') base.props = { label: 'Кнопка' };
    if (k === 'panel') {
      base.props = { label: 'Панель' };
      base.transform.w = 0.3;
      base.transform.h = 0.25;
    }
    if (k === 'hotspot') {
      base.props = { label: 'Область', shape: 'rect' };
    }
    return base;
  }

  function getSelectedNodeId() {
    return Editor._visualSelectedNodeId || null;
  }
  function setSelectedNodeId(id) {
    Editor._visualSelectedNodeId = id || null;
  }
  function findNode(scene, nodeId) {
    if (!scene || !nodeId) return null;
    return ensureVisual(scene).nodes.find((n) => n.id === nodeId) || null;
  }

  function listProjectAssets() {
    if (typeof Editor.getProjectAssetList === 'function') {
      return Editor.getProjectAssetList();
    }
    const out = [];
    const seen = Object.create(null);
    function add(id, src, name) {
      const key = id || src;
      if (!key || seen[key]) return;
      seen[key] = true;
      out.push({ id: id || src, src: src || id, name: name || id || src });
    }
    const assets = Editor.data?.assets;
    if (assets && typeof assets === 'object') {
      Object.keys(assets).forEach((id) => {
        const a = assets[id];
        if (typeof a === 'string') add(id, a, id);
        else if (a && (a.src || a.url)) add(id, a.src || a.url, a.name || id);
      });
    }
    const scenes = Editor.data?.scenes || {};
    Object.keys(scenes).forEach((sid) => {
      const v = scenes[sid].visual;
      if (!v) return;
      const bg = v.background?.asset;
      if (bg?.src || bg?.ref) add(bg.ref || bg.src, bg.src || bg.ref, bg.ref || bg.src);
      (v.nodes || []).forEach((n) => {
        if (n.asset?.src || n.asset?.ref) add(n.asset.ref || n.asset.src, n.asset.src || n.asset.ref);
      });
    });
    return out;
  }

  Editor.visualDropAssetAt = function (payload, normX, normY) {
    if (!payload || !payload.id) return;
    const w = 0.12;
    const h = 0.12;
    let newId = null;
    withSceneHistory((scene) => {
      const v = ensureVisual(scene);
      if (v.mode === 'none') v.mode = 'overlay';
      const node = defaultNode('image');
      node.asset = { type: 'image', ref: payload.id, src: payload.src || '' };
      node.transform.x = clamp01((normX || 0.5) - w / 2, 0);
      node.transform.y = clamp01((normY || 0.5) - h / 2, 0);
      node.transform.w = w;
      node.transform.h = h;
      let maxZ = 0;
      v.nodes.forEach((n) => { if ((n.transform?.z ?? 0) > maxZ) maxZ = n.transform.z; });
      node.transform.z = maxZ + 1;
      if (payload.name) {
        if (!node.props) node.props = {};
        node.props.label = payload.name;
      }
      v.nodes.push(node);
      newId = node.id;
      setSelectedNodeId(node.id);
    });
    Editor.renderVisualScenePanel?.();
    return newId;
  };

  function resolveAssetUrl(asset) {
    if (!asset) return '';
    if (asset.src) return asset.src;
    if (asset.ref && Editor.data?.assets) {
      const e = Editor.data.assets[asset.ref];
      if (typeof e === 'string') return e;
      if (e?.src) return e.src;
      if (e?.url) return e.url;
    }
    return asset.ref || '';
  }

  function sceneOptionsHtml(selected) {
    const scenes = Editor.data?.scenes || {};
    let html = '<option value="">— выберите сцену —</option>';
    Object.keys(scenes).forEach((id) => {
      const s = scenes[id];
      const title = s.location || s.title || id;
      html += `<option value="${escAttr(id)}"${id === selected ? ' selected' : ''}>${esc(title)} (${esc(id)})</option>`;
    });
    return html;
  }

  function entityOptionsHtml(source, selected) {
    if (source === 'scenes') return sceneOptionsHtml(selected);
    if (source === 'number' || source === 'text') return '';
    const bag = Editor.data?.[source] || {};
    let html = '<option value="">— выберите —</option>';
    Object.keys(bag).forEach((id) => {
      const o = bag[id];
      const title = o.name || o.title || o.label || id;
      html += `<option value="${escAttr(id)}"${id === selected ? ' selected' : ''}>${esc(title)}</option>`;
    });
    return html;
  }

  // ——— Public API ———

  Editor.visualEnsureScene = function () {
    const scene = currentSceneObj();
    return scene ? ensureVisual(scene) : null;
  };

  Editor.visualAddNode = function (kind) {
    let newId = null;
    withSceneHistory((scene) => {
      const v = ensureVisual(scene);
      if (v.mode === 'none') v.mode = 'overlay';
      const node = defaultNode(kind);
      let maxZ = 0;
      v.nodes.forEach((n) => {
        const z = n.transform?.z ?? 0;
        if (z > maxZ) maxZ = z;
      });
      node.transform.z = maxZ + 1;
      v.nodes.push(node);
      newId = node.id;
      setSelectedNodeId(node.id);
    });
    Editor.renderVisualScenePanel?.();
    return newId;
  };

  Editor.visualDeleteNode = function (nodeId) {
    nodeId = nodeId || getSelectedNodeId();
    if (!nodeId) return;
    withSceneHistory((scene) => {
      const v = ensureVisual(scene);
      v.nodes = v.nodes.filter((n) => n.id !== nodeId);
      if (getSelectedNodeId() === nodeId) setSelectedNodeId(v.nodes[0]?.id || null);
    });
    Editor.renderVisualScenePanel?.();
  };

  Editor.visualSelectNode = function (nodeId) {
    setSelectedNodeId(nodeId);
    if (ui.suppressFullRender) {
      Editor.visualSyncSelectionUi?.();
      return;
    }
    Editor.renderVisualScenePanel?.();
  };

  Editor.visualMoveNode = function (nodeId, dir) {
    withSceneHistory((scene) => {
      const v = ensureVisual(scene);
      const i = v.nodes.findIndex((n) => n.id === nodeId);
      if (i < 0) return;
      const j = dir < 0 ? i - 1 : i + 1;
      if (j < 0 || j >= v.nodes.length) return;
      const tmp = v.nodes[i];
      v.nodes[i] = v.nodes[j];
      v.nodes[j] = tmp;
      if (!v.nodes[i].transform) v.nodes[i].transform = {};
      if (!v.nodes[j].transform) v.nodes[j].transform = {};
      const zi = v.nodes[i].transform.z ?? i;
      const zj = v.nodes[j].transform.z ?? j;
      v.nodes[i].transform.z = zj;
      v.nodes[j].transform.z = zi;
    });
    Editor.renderVisualScenePanel?.();
  };

  Editor.visualUpdateNodeField = function (nodeId, field, value) {
    withSceneHistory((scene) => {
      if (field === 'mode') {
        ensureVisual(scene).mode = value === 'none' ? 'none' : 'overlay';
        return;
      }
      if (field === 'bgSrc') {
        const v = ensureVisual(scene);
        if (!v.background) v.background = { asset: { type: 'image' } };
        if (!v.background.asset) v.background.asset = { type: 'image' };
        v.background.asset.src = String(value == null ? '' : value);
        v.background.asset.ref = '';
        v.mode = 'overlay';
        return;
      }
      if (field === 'bgRef') {
        const v = ensureVisual(scene);
        if (!v.background) v.background = { asset: { type: 'image' } };
        if (!v.background.asset) v.background.asset = { type: 'image' };
        v.background.asset.ref = String(value == null ? '' : value);
        const list = listProjectAssets();
        const found = list.find((a) => a.id === value);
        if (found) v.background.asset.src = found.src;
        v.mode = 'overlay';
        return;
      }
      const node = findNode(scene, nodeId);
      if (!node) return;
      if (field === 'visible' || field === 'enabled') {
        node[field] = !!value && value !== 'false' && value !== '0';
      } else if (['x', 'y', 'w', 'h', 'z'].indexOf(field) >= 0) {
        if (!node.transform) node.transform = { x: 0, y: 0, w: 0.1, h: 0.1, z: 0 };
        let num = parseFloat(value);
        if (!Number.isFinite(num)) num = 0;
        if (field !== 'z') num = clamp01(num, 0);
        if ((field === 'w' || field === 'h') && num < 0.01) num = 0.01;
        node.transform[field] = num;
      } else if (field === 'label' || field === 'text') {
        if (!node.props) node.props = {};
        node.props[field] = String(value == null ? '' : value);
      } else if (field === 'assetSrc') {
        if (!node.asset) node.asset = { type: 'image' };
        node.asset.src = String(value == null ? '' : value);
        node.asset.ref = '';
      } else if (field === 'assetRef') {
        if (!node.asset) node.asset = { type: 'image' };
        node.asset.ref = String(value == null ? '' : value);
        const found = listProjectAssets().find((a) => a.id === value);
        if (found) node.asset.src = found.src;
      }
    });
    if (!ui.suppressFullRender) Editor.renderVisualScenePanel?.();
  };

  Editor.visualToggleNodeFlag = function (nodeId, field, checked) {
    Editor.visualUpdateNodeField(nodeId, field, !!checked);
  };

  Editor.visualSetClickAction = function (nodeId, actionId, paramValue) {
    withSceneHistory((scene) => {
      const node = findNode(scene, nodeId);
      if (!node) return;
      if (!node.events) node.events = {};
      let actionKey = actionId;
      let fixedHint = null;
      // legacy colon form open_panel:journal
      if (typeof actionId === 'string' && actionId.indexOf(':') > 0) {
        const parts = actionId.split(':');
        actionKey = parts[0];
        fixedHint = parts.slice(1).join(':');
      }
      if (!actionKey) {
        node.events.click = [];
        return;
      }
      const prev = (node.events.click && node.events.click[0] && node.events.click[0].params) || {};
      let values = Object.assign({}, prev);
      if (fixedHint != null && actionKey === 'open_panel') values.panel = fixedHint;
      if (paramValue != null && typeof paramValue === 'object' && !Array.isArray(paramValue)) {
        values = Object.assign(values, paramValue);
      } else if (paramValue != null && paramValue !== '') {
        const def = typeof Editor.getActionDefinition === 'function' ? Editor.getActionDefinition(actionKey) : null;
        const first = def && def.params && def.params[0];
        if (first) values[first.id] = paramValue;
        else {
          // Fallback without catalog (tests / early boot)
          if (actionKey === 'change_scene') values.sceneId = paramValue;
          else if (actionKey === 'open_panel') values.panel = paramValue;
          else if (actionKey === 'add_item' || actionKey === 'remove_item') values.itemId = paramValue;
          else if (actionKey === 'add_gold' || actionKey === 'remove_gold') values.amount = paramValue;
          else if (actionKey === 'update_quest') values.questId = paramValue;
          else if (actionKey === 'say') values.text = paramValue;
          else values.value = paramValue;
        }
      }
      const params =
        typeof Editor.buildActionParamsObject === 'function'
          ? Editor.buildActionParamsObject(actionKey, values)
          : values;
      node.events.click = [{ action: actionKey, params: params }];
    });
    Editor.renderVisualScenePanel?.();
  };

  Editor.visualOpenClickActionPicker = function (nodeId) {
    const scenes = Editor.data?.scenes || {};
    const ids = Object.keys(scenes);
    if (!ids.length) {
      Editor.toast.warning('Нет сцен в проекте');
      return;
    }
    const opts = ids.map((id) => {
      const label = scenes[id]?.location || scenes[id]?.title || id;
      return `<option value="${Editor.escapeAttr(id)}">${Editor.escapeHtml(label)}</option>`;
    }).join('');
    const modal = document.createElement('div');
    modal.className = 'editor-modal editor-confirm-modal';
    modal.innerHTML = `
      <div class="editor-modal-backdrop" data-pick="cancel"></div>
      <div class="editor-modal-panel editor-confirm-panel" role="dialog" aria-modal="true">
        <h2>Связать с…</h2>
        <p class="hint">По нажатию на узел откроется выбранная сцена.</p>
        <select class="editor-prompt-input" style="width:100%;min-height:44px;">${opts}</select>
        <div class="editor-confirm-actions" style="margin-top:12px;">
          <button type="button" class="btn btn-secondary" data-pick="cancel">Отмена</button>
          <button type="button" class="btn btn-primary" data-pick="ok">Связать</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const sel = modal.querySelector('select');
    modal.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-pick]');
      if (!btn) return;
      if (btn.getAttribute('data-pick') === 'ok') {
        Editor.visualSetClickAction(nodeId, 'change_scene', sel.value);
        Editor.toast.success('Связь с сценой задана');
      }
      modal.remove();
    });
  };

  /** Update a single param on existing click action without changing action id */
  Editor.visualSetClickParam = function (nodeId, paramId, value) {
    withSceneHistory((scene) => {
      const node = findNode(scene, nodeId);
      if (!node || !node.events || !node.events.click || !node.events.click[0]) return;
      const step = node.events.click[0];
      const values = Object.assign({}, step.params || {});
      values[paramId] = value;
      step.params =
        typeof Editor.buildActionParamsObject === 'function'
          ? Editor.buildActionParamsObject(step.action, values)
          : values;
    });
    Editor.renderVisualScenePanel?.();
  };

  Editor.visualClearClick = function (nodeId) {
    withSceneHistory((scene) => {
      const node = findNode(scene, nodeId);
      if (!node) return;
      if (!node.events) node.events = {};
      node.events.click = [];
    });
    Editor.renderVisualScenePanel?.();
  };

  function ensureClickList(node) {
    if (!node.events) node.events = {};
    if (!Array.isArray(node.events.click)) node.events.click = [];
    return node.events.click;
  }

  Editor.visualAddClickAction = function (nodeId, actionId, params) {
    withSceneHistory((scene) => {
      const node = findNode(scene, nodeId);
      if (!node) return;
      const list = ensureClickList(node);
      const key = actionId || 'change_scene';
      const p =
        typeof Editor.buildActionParamsObject === 'function'
          ? Editor.buildActionParamsObject(key, params || {})
          : params || {};
      list.push({ action: key, params: p });
    });
    Editor.renderVisualScenePanel?.();
  };

  Editor.visualRemoveClickAction = function (nodeId, index) {
    withSceneHistory((scene) => {
      const node = findNode(scene, nodeId);
      if (!node) return;
      const list = ensureClickList(node);
      const i = Number(index);
      if (i >= 0 && i < list.length) list.splice(i, 1);
    });
    Editor.renderVisualScenePanel?.();
  };

  Editor.visualMoveClickAction = function (nodeId, index, dir) {
    withSceneHistory((scene) => {
      const node = findNode(scene, nodeId);
      if (!node) return;
      const list = ensureClickList(node);
      const i = Number(index);
      const j = i + (dir < 0 ? -1 : 1);
      if (i < 0 || j < 0 || i >= list.length || j >= list.length) return;
      const tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    });
    Editor.renderVisualScenePanel?.();
  };

  Editor.visualSetClickActionAt = function (nodeId, index, actionId, paramValue) {
    withSceneHistory((scene) => {
      const node = findNode(scene, nodeId);
      if (!node) return;
      const list = ensureClickList(node);
      const i = Number(index);
      if (i < 0 || i >= list.length) return;
      let actionKey = actionId || '';
      let fixedHint = null;
      if (typeof actionId === 'string' && actionId.indexOf(':') > 0) {
        const parts = actionId.split(':');
        actionKey = parts[0];
        fixedHint = parts.slice(1).join(':');
      }
      if (!actionKey) {
        list.splice(i, 1);
        return;
      }
      const prev = (list[i] && list[i].params) || {};
      let values = Object.assign({}, prev);
      if (fixedHint != null && actionKey === 'open_panel') values.panel = fixedHint;
      if (paramValue != null && typeof paramValue === 'object' && !Array.isArray(paramValue)) {
        values = Object.assign(values, paramValue);
      } else if (paramValue != null && paramValue !== '') {
        const def = typeof Editor.getActionDefinition === 'function' ? Editor.getActionDefinition(actionKey) : null;
        const first = def && def.params && def.params[0];
        if (first) values[first.id] = paramValue;
      }
      list[i] = {
        action: actionKey,
        params:
          typeof Editor.buildActionParamsObject === 'function'
            ? Editor.buildActionParamsObject(actionKey, values)
            : values
      };
    });
    Editor.renderVisualScenePanel?.();
  };

  Editor.visualSetClickParamAt = function (nodeId, index, paramId, value) {
    withSceneHistory((scene) => {
      const node = findNode(scene, nodeId);
      if (!node) return;
      const list = ensureClickList(node);
      const i = Number(index);
      if (i < 0 || i >= list.length || !list[i]) return;
      const step = list[i];
      const values = Object.assign({}, step.params || {});
      values[paramId] = value;
      step.params =
        typeof Editor.buildActionParamsObject === 'function'
          ? Editor.buildActionParamsObject(step.action, values)
          : values;
    });
    Editor.renderVisualScenePanel?.();
  };

  Editor.visualApplyClickMacro = function (nodeId, macroId) {
    const macros =
      typeof Editor.getActionMacros === 'function' ? Editor.getActionMacros() : [];
    const m = macros.find((x) => x.id === macroId);
    if (!m || !m.steps || !m.steps.length) return;
    withSceneHistory((scene) => {
      const node = findNode(scene, nodeId);
      if (!node) return;
      const list = ensureClickList(node);
      m.steps.forEach((step) => {
        const key = step.action;
        const p =
          typeof Editor.buildActionParamsObject === 'function'
            ? Editor.buildActionParamsObject(key, step.params || {})
            : step.params || {};
        list.push({ action: key, params: p });
      });
    });
    Editor.renderVisualScenePanel?.();
  };


  function visualConditionMode(showIf) {
    return typeof Editor.getConditionMode === 'function'
      ? Editor.getConditionMode(showIf)
      : Array.isArray(showIf?.any)
        ? 'any'
        : 'all';
  }

  function visualWriteShowIf(node, rules, mode) {
    if (!rules || !rules.length) {
      node.showIf = null;
      return;
    }
    const m = mode === 'any' ? 'any' : 'all';
    node.showIf =
      typeof Editor.rulesToShowIf === 'function'
        ? Editor.rulesToShowIf(rules, m)
        : m === 'any'
          ? { any: rules }
          : { all: rules };
  }

  Editor.visualAddCondition = function (nodeId, catalogId) {
    withSceneHistory((scene) => {
      const node = findNode(scene, nodeId);
      if (!node) return;
      const mode = visualConditionMode(node.showIf);
      const rules =
        typeof Editor.extractConditionRules === 'function'
          ? Editor.extractConditionRules(node.showIf)
          : [];
      const rule =
        typeof Editor.buildConditionRule === 'function'
          ? Editor.buildConditionRule(catalogId || 'hasItem', {})
          : { hasItem: '' };
      rules.push(rule);
      visualWriteShowIf(node, rules, mode);
    });
    Editor.renderVisualScenePanel?.();
  };

  Editor.visualRemoveCondition = function (nodeId, index) {
    withSceneHistory((scene) => {
      const node = findNode(scene, nodeId);
      if (!node) return;
      const mode = visualConditionMode(node.showIf);
      const rules =
        typeof Editor.extractConditionRules === 'function'
          ? Editor.extractConditionRules(node.showIf)
          : [];
      const i = Number(index);
      if (i >= 0 && i < rules.length) rules.splice(i, 1);
      visualWriteShowIf(node, rules, mode);
    });
    Editor.renderVisualScenePanel?.();
  };

  Editor.visualSetConditionAt = function (nodeId, index, catalogId) {
    withSceneHistory((scene) => {
      const node = findNode(scene, nodeId);
      if (!node) return;
      const mode = visualConditionMode(node.showIf);
      const rules =
        typeof Editor.extractConditionRules === 'function'
          ? Editor.extractConditionRules(node.showIf)
          : [];
      const i = Number(index);
      if (i < 0 || i >= rules.length) return;
      rules[i] =
        typeof Editor.buildConditionRule === 'function'
          ? Editor.buildConditionRule(catalogId, {})
          : { hasItem: '' };
      visualWriteShowIf(node, rules, mode);
    });
    Editor.renderVisualScenePanel?.();
  };

  Editor.visualSetConditionParamAt = function (nodeId, index, paramId, value) {
    withSceneHistory((scene) => {
      const node = findNode(scene, nodeId);
      if (!node) return;
      const mode = visualConditionMode(node.showIf);
      const rules =
        typeof Editor.extractConditionRules === 'function'
          ? Editor.extractConditionRules(node.showIf)
          : [];
      const i = Number(index);
      if (i < 0 || i >= rules.length) return;
      const catId =
        typeof Editor.ruleToCatalogId === 'function' ? Editor.ruleToCatalogId(rules[i]) : null;
      const vals =
        typeof Editor.conditionValuesFromRule === 'function'
          ? Editor.conditionValuesFromRule(rules[i])
          : {};
      vals[paramId] = value;
      if (catId && typeof Editor.buildConditionRule === 'function') {
        rules[i] = Editor.buildConditionRule(catId, vals);
      }
      visualWriteShowIf(node, rules, mode);
    });
    Editor.renderVisualScenePanel?.();
  };

  Editor.visualSetConditionMode = function (nodeId, mode) {
    withSceneHistory((scene) => {
      const node = findNode(scene, nodeId);
      if (!node) return;
      const rules =
        typeof Editor.extractConditionRules === 'function'
          ? Editor.extractConditionRules(node.showIf)
          : [];
      if (!rules.length) return;
      visualWriteShowIf(node, rules, mode === 'any' ? 'any' : 'all');
    });
    Editor.renderVisualScenePanel?.();
  };

  Editor.visualClearConditions = function (nodeId) {
    withSceneHistory((scene) => {
      const node = findNode(scene, nodeId);
      if (!node) return;
      node.showIf = null;
    });
    Editor.renderVisualScenePanel?.();
  };

  // Keep single-action API: replaces whole list with one entry (compat)


  Editor.visualSetAsset = function (target, assetId) {
    // target: 'background' | nodeId
    if (target === 'background') Editor.visualUpdateNodeField(null, 'bgRef', assetId);
    else Editor.visualUpdateNodeField(target, 'assetRef', assetId);
  };

  Editor.visualSetSnap = function (enabled, grid) {
    ui.snap = !!enabled;
    if (grid != null && Number(grid) > 0) ui.grid = Number(grid);
  };

  Editor.visualSetDrawMode = function (on) {
    ui.drawMode = !!on;
    Editor.renderVisualScenePanel?.();
  };

  /** Apply transform during gesture without history (data only + DOM) */
  Editor.visualApplyTransformLive = function (nodeId, t) {
    const scene = currentSceneObj();
    const node = findNode(scene, nodeId);
    if (!node) return;
    if (node.locked) return;
    if (!node.transform) node.transform = {};
    let x = clamp01(t.x, 0);
    let y = clamp01(t.y, 0);
    let w = clamp01(t.w, 0.01);
    let h = clamp01(t.h, 0.01);
    if (w < 0.01) w = 0.01;
    if (h < 0.01) h = 0.01;
    if (x + w > 1) x = Math.max(0, 1 - w);
    if (y + h > 1) y = Math.max(0, 1 - h);
    node.transform.x = snapVal(x);
    node.transform.y = snapVal(y);
    node.transform.w = snapVal(w);
    node.transform.h = snapVal(h);
    updateNodeDom(nodeId);
    updateInspectorTransformInputs(nodeId);
  };

  Editor.getVisualActionUxList = function () {
    var reg = typeof ACTION_REGISTRY !== 'undefined' ? ACTION_REGISTRY : null;
    return catalogActions()
      .filter(function (e) {
        return !reg || !!reg[e.id];
      })
      .map(function (e) {
        return {
          action: e.id,
          label: e.label,
          category: e.category,
          writerSafe: e.writerSafe,
          params: e.params
        };
      });
  };

  Editor.listVisualAssets = listProjectAssets;

  // ——— DOM helpers (partial update) ———

  function updateNodeDom(nodeId) {
    if (typeof document === 'undefined') return;
    const scene = currentSceneObj();
    const node = findNode(scene, nodeId);
    if (!node) return;
    const el = document.querySelector('#visual-vp-nodes [data-node-id="' + nodeId + '"]');
    if (!el) return;
    const t = node.transform || {};
    el.style.left = (t.x || 0) * 100 + '%';
    el.style.top = (t.y || 0) * 100 + '%';
    el.style.width = (t.w || 0.1) * 100 + '%';
    el.style.height = (t.h || 0.1) * 100 + '%';
    el.style.zIndex = String(t.z || 0);
  }

  function updateInspectorTransformInputs(nodeId) {
    if (typeof document === 'undefined') return;
    const scene = currentSceneObj();
    const node = findNode(scene, nodeId);
    if (!node) return;
    const t = node.transform || {};
    ['x', 'y', 'w', 'h', 'z'].forEach((f) => {
      const input = document.querySelector('#visual-scene-editor-panel input[data-field="' + f + '"][data-node="' + nodeId + '"]');
      if (input && document.activeElement !== input) input.value = t[f];
    });
  }

  Editor.visualSyncSelectionUi = function () {
    if (typeof document === 'undefined') return;
    const sel = getSelectedNodeId();
    document.querySelectorAll('#visual-vp-nodes .visual-vp-node').forEach((el) => {
      el.classList.toggle('is-selected', el.getAttribute('data-node-id') === sel);
    });
    document.querySelectorAll('#visual-scene-editor-panel .visual-node-row').forEach((el) => {
      el.classList.toggle('is-selected', el.getAttribute('data-node-id') === sel);
    });
  };

  function nodeStyle(node, selected) {
    const t = node.transform || {};
    const outline = selected ? '2px solid #f0c040' : '1px solid rgba(255,255,255,0.35)';
    let bg = 'rgba(70,110,170,0.4)';
    let extra = '';
    if (node.kind === 'hotspot') {
      bg = 'rgba(240,180,40,0.25)';
    } else if (node.kind === 'image') {
      const url = resolveAssetUrl(node.asset);
      if (url) {
        bg = 'transparent';
        extra = 'background-image:url("' + url.replace(/"/g, '\\"') + '");background-size:cover;background-position:center;';
      }
    } else if (node.kind === 'button') {
      bg = 'rgba(40,40,50,0.9)';
    } else if (node.kind === 'panel') {
      bg = 'rgba(20,20,28,0.8)';
    }
    return (
      'position:absolute;left:' +
      (t.x || 0) * 100 +
      '%;top:' +
      (t.y || 0) * 100 +
      '%;width:' +
      (t.w || 0.1) * 100 +
      '%;height:' +
      (t.h || 0.1) * 100 +
      '%;z-index:' +
      (t.z || 0) +
      ';box-sizing:border-box;outline:' +
      outline +
      ';background:' +
      bg +
      ';' +
      extra +
      'cursor:move;overflow:hidden;font-size:11px;color:#fff;user-select:none;' +
      (node.visible === false ? 'display:none;' : '') +
      (node.enabled === false ? 'opacity:0.45;' : '')
    );
  }

  function handlesHtml(nodeId) {
    const corners = ['tl', 'tr', 'bl', 'br'];
    return corners
      .map((c) => {
        const pos =
          c === 'tl'
            ? 'left:0;top:0;cursor:nwse-resize;'
            : c === 'tr'
              ? 'right:0;top:0;cursor:nesw-resize;'
              : c === 'bl'
                ? 'left:0;bottom:0;cursor:nesw-resize;'
                : 'right:0;bottom:0;cursor:nwse-resize;';
        return (
          '<span class="visual-vp-handle" data-handle="' +
          c +
          '" data-node-id="' +
          escAttr(nodeId) +
          '" style="position:absolute;width:10px;height:10px;background:#f0c040;border:1px solid #333;' +
          pos +
          'z-index:20;"></span>'
        );
      })
      .join('');
  }

  Editor.renderVisualScenePanel = function renderVisualScenePanel() {
    if (typeof document === 'undefined') return;
    const container =
      document.getElementById('scene-editor-mount') ||
      document.querySelector('#scene-editor .scene-builder') ||
      document.getElementById('scene-editor');
    if (!container) return;
    const scene = currentSceneObj();
    if (!scene) return;

    let host = document.getElementById('visual-scene-editor-panel');
    if (!host) {
      host = document.createElement('div');
      host.id = 'visual-scene-editor-panel';
      host.className = 'visual-scene-editor-panel project-info';
      const builder = container.querySelector?.('.scene-builder') || container;
      builder.appendChild(host);
    }

    const visual = ensureVisual(scene);
    const selectedId = getSelectedNodeId();
    const selected = selectedId ? findNode(scene, selectedId) : null;
    const nodes = visual.nodes || [];
    const bgUrl = resolveAssetUrl(visual.background?.asset);

    const hierarchy = nodes
      .map((n) => {
        const meta = KIND_META[n.kind] || { label: n.kind, icon: '•' };
        const active = n.id === selectedId ? ' is-selected' : '';
        return (
          '<div class="visual-node-row' +
          active +
          '" data-node-id="' +
          escAttr(n.id) +
          '">' +
          '<button type="button" class="btn btn-secondary" data-action="select" data-id="' +
          escAttr(n.id) +
          '">' +
          meta.icon +
          ' ' +
          esc(n.props?.label || n.props?.text || n.id) +
          '</button>' +
          '<button type="button" class="btn btn-secondary" data-action="up" data-id="' +
          escAttr(n.id) +
          '">↑</button>' +
          '<button type="button" class="btn btn-secondary" data-action="down" data-id="' +
          escAttr(n.id) +
          '">↓</button>' +
          '<button type="button" class="btn btn-danger" data-action="delete" data-id="' +
          escAttr(n.id) +
          '">×</button></div>'
        );
      })
      .join('');

    const addButtons = Object.keys(KIND_META)
      .map(
        (k) =>
          '<button type="button" class="btn btn-secondary" data-action="add" data-kind="' +
          escAttr(k) +
          '">' +
          KIND_META[k].icon +
          ' ' +
          esc(KIND_META[k].label) +
          '</button>'
      )
      .join(' ');

    let inspector = '<p class="hint">Выберите элемент на холсте или в списке</p>';
    if (selected) {
      const t = selected.transform || { x: 0, y: 0, w: 0.1, h: 0.1, z: 0 };

      const condRules =
        typeof Editor.extractConditionRules === 'function'
          ? Editor.extractConditionRules(selected.showIf)
          : [];
      const condMode = visualConditionMode(selected.showIf);
      const modeSelect =
        typeof Editor.buildConditionModeSelectHtml === 'function'
          ? Editor.buildConditionModeSelectHtml(condMode).replace(
              'data-field="condMode"',
              'data-field="condMode" data-node="' + escAttr(selected.id) + '"'
            )
          : '<select data-field="condMode" data-node="' +
            escAttr(selected.id) +
            '"><option value="all"' +
            (condMode === 'all' ? ' selected' : '') +
            '>Все условия выполнены</option><option value="any"' +
            (condMode === 'any' ? ' selected' : '') +
            '>Хотя бы одно условие выполнено</option></select>';
      let condCards = '';
      condRules.forEach((rule, idx) => {
        const cid =
          typeof Editor.ruleToCatalogId === 'function' ? Editor.ruleToCatalogId(rule) : '';
        const vals =
          typeof Editor.conditionValuesFromRule === 'function'
            ? Editor.conditionValuesFromRule(rule)
            : {};
        const sel =
          typeof Editor.buildConditionSelectHtml === 'function'
            ? Editor.buildConditionSelectHtml(cid)
            : '';
        const params =
          typeof Editor.buildConditionParamFieldsHtml === 'function'
            ? Editor.buildConditionParamFieldsHtml(cid, vals, {
                nodeId: selected.id,
                data: Editor.data,
                index: idx
              })
            : '';
        condCards +=
          '<div class="visual-cond-step"><div class="form-group"><label>' +
          (idx + 1) +
          '. Условие</label><select data-field="condType" data-node="' +
          escAttr(selected.id) +
          '" data-cond-index="' +
          idx +
          '">' +
          sel +
          '</select></div>' +
          params +
          '<button type="button" class="btn btn-danger" data-action="condRemove" data-id="' +
          escAttr(selected.id) +
          '" data-index="' +
          idx +
          '">Удалить</button></div>';
      });
      const condBlock =
        '<h4>Когда доступно</h4><div class="form-group"><label>Режим</label>' +
        modeSelect +
        '</div>' +
        (condCards || '<p class="hint">Всегда</p>') +
        '<button type="button" class="btn btn-secondary" data-action="condAdd" data-id="' +
        escAttr(selected.id) +
        '">+ Добавить условие</button>';

      const clickSteps = Array.isArray(selected.events?.click) ? selected.events.click : [];
      let clickCards = '';
      clickSteps.forEach((step, idx) => {
        const act = step && step.action ? step.action : '';
        const params = (step && step.params) || {};
        const actionOpts =
          typeof Editor.buildActionSelectHtml === 'function'
            ? Editor.buildActionSelectHtml(act)
            : '<option value="change_scene">Открыть сцену</option>';
        const paramControl =
          typeof Editor.buildActionParamFieldsHtml === 'function'
            ? Editor.buildActionParamFieldsHtml(act, params, {
                nodeId: selected.id,
                data: Editor.data,
                index: idx
              })
            : '';
        clickCards +=
          '<div class="visual-click-step" data-click-index="' +
          idx +
          '"><div class="form-group"><label>' +
          (idx + 1) +
          '. Действие</label><select data-field="actionType" data-node="' +
          escAttr(selected.id) +
          '" data-click-index="' +
          idx +
          '">' +
          actionOpts +
          '</select></div>' +
          paramControl +
          '<div class="btn-row">' +
          '<button type="button" class="btn btn-secondary" data-action="clickUp" data-id="' +
          escAttr(selected.id) +
          '" data-index="' +
          idx +
          '">↑</button>' +
          '<button type="button" class="btn btn-secondary" data-action="clickDown" data-id="' +
          escAttr(selected.id) +
          '" data-index="' +
          idx +
          '">↓</button>' +
          '<button type="button" class="btn btn-danger" data-action="clickRemove" data-id="' +
          escAttr(selected.id) +
          '" data-index="' +
          idx +
          '">Удалить</button></div></div>';
      });
      let macroOpts = '<option value="">Готовое действие…</option>';
      if (typeof Editor.getActionMacros === 'function') {
        Editor.getActionMacros().forEach((m) => {
          macroOpts +=
            '<option value="' + escAttr(m.id) + '">' + esc(m.label) + '</option>';
        });
      }
      inspector =
        typeof Editor.buildVisualNodeInspectorHtml === 'function'
          ? Editor.buildVisualNodeInspectorHtml(selected)
          : (
        '<div class="visual-inspector"><h4>Свойства</h4>' +
        '<div class="form-group"><label>Метка</label><input type="text" data-field="label" data-node="' +
        escAttr(selected.id) +
        '" value="' +
        escAttr(selected.props?.label || '') +
        '"></div>' +
        (selected.kind === 'text' || selected.kind === 'button'
          ? '<div class="form-group"><label>Текст</label><textarea data-field="text" data-node="' +
            escAttr(selected.id) +
            '" rows="2">' +
            esc(selected.props?.text || '') +
            '</textarea></div>'
          : '') +
        (selected.kind === 'image'
          ? '<div class="form-group"><label>Изображение</label> ' +
            '<button type="button" class="btn btn-secondary" data-action="pickAsset" data-target="' +
            escAttr(selected.id) +
            '">Выбрать…</button></div>'
          : '') +
        '<div class="form-group form-row">' +
        '<label>X <input type="number" step="0.01" data-field="x" data-node="' +
        escAttr(selected.id) +
        '" value="' +
        escAttr(t.x) +
        '"></label>' +
        '<label>Y <input type="number" step="0.01" data-field="y" data-node="' +
        escAttr(selected.id) +
        '" value="' +
        escAttr(t.y) +
        '"></label>' +
        '<label>W <input type="number" step="0.01" data-field="w" data-node="' +
        escAttr(selected.id) +
        '" value="' +
        escAttr(t.w) +
        '"></label>' +
        '<label>H <input type="number" step="0.01" data-field="h" data-node="' +
        escAttr(selected.id) +
        '" value="' +
        escAttr(t.h) +
        '"></label>' +
        '<label>Z <input type="number" data-field="z" data-node="' +
        escAttr(selected.id) +
        '" value="' +
        escAttr(t.z) +
        '"></label></div>' +
        '<div class="form-group">' +
        '<label><input type="checkbox" data-field="visible" data-node="' +
        escAttr(selected.id) +
        '"' +
        (selected.visible !== false ? ' checked' : '') +
        '> Видимый</label> ' +
        '<label><input type="checkbox" data-field="enabled" data-node="' +
        escAttr(selected.id) +
        '"' +
        (selected.enabled !== false ? ' checked' : '') +
        '> Активный</label></div>' +
        condBlock + '<h4>При нажатии</h4>' +
        (clickCards || '<p class="hint">Нет действий</p>') +
        '<div class="btn-row">' +
        '<button type="button" class="btn btn-secondary" data-action="clickAdd" data-id="' +
        escAttr(selected.id) +
        '">+ Добавить действие</button></div>' +
        '<div class="form-group"><label>Готовое действие</label><select data-field="clickMacro" data-node="' +
        escAttr(selected.id) +
        '">' +
        macroOpts +
        '</select></div>' +
        '<button type="button" class="btn btn-secondary" data-action="clearClick" data-id="' +
        escAttr(selected.id) +
        '">Убрать все действия</button></div>'
      );
    }

    const vpNodes = nodes
      .map((n) => {
        const sel = n.id === selectedId;
        return (
          '<div class="visual-vp-node' +
          (sel ? ' is-selected' : '') +
          '" data-node-id="' +
          escAttr(n.id) +
          '" style="' +
          nodeStyle(n, sel) +
          '">' +
          esc(n.props?.label || n.kind) +
          (sel ? handlesHtml(n.id) : '') +
          '</div>'
        );
      })
      .join('');

    host.innerHTML =
      '<hr><h3>🖼 Визуальный слой</h3>' +
      '<p><button type="button" class="btn btn-secondary" data-action="loadDemoVillage">📦 Загрузить демо «Деревня»</button></p>' +
      '<p class="hint">Перетаскивайте области мышью. Углы — изменение размера. Код писать не нужно.</p>' +
      '<div class="form-group form-row">' +
      '<label>Режим <select data-field="mode"><option value="none"' +
      (visual.mode === 'none' ? ' selected' : '') +
      '>Выключен</option><option value="overlay"' +
      (visual.mode !== 'none' ? ' selected' : '') +
      '>Поверх сцены</option></select></label> ' +
      '<label><input type="checkbox" id="visual-snap-toggle"' +
      (ui.snap ? ' checked' : '') +
      '> Сетка</label> ' +
      '<label>Шаг <input type="number" id="visual-grid-size" step="0.01" min="0.01" max="0.5" value="' +
      escAttr(ui.grid) +
      '" style="width:4em"></label> ' +
      '<label><input type="checkbox" id="visual-draw-mode"' +
      (ui.drawMode ? ' checked' : '') +
      '> Рисовать hotspot</label>' +
      '</div>' +
      '<div class="form-group"><label>Фон сцены</label> ' +
      '<button type="button" class="btn btn-secondary" data-action="pickAsset" data-target="background">Выбрать фон…</button> ' +
      '<span class="hint">' +
      esc(bgUrl || 'не задан') +
      '</span></div>' +
      '<div id="visual-viewport" class="visual-viewport" style="position:relative;width:100%;max-width:640px;aspect-ratio:16/9;background:#1a1a1a center/cover no-repeat;border-radius:8px;overflow:hidden;margin:8px 0;touch-action:none;' +
      (bgUrl ? 'background-image:url(\"' + bgUrl.replace(/"/g, '\\"') + '\");' : '') +
      '">' +
      '<div id="visual-vp-nodes" style="position:absolute;inset:0;">' +
      vpNodes +
      '</div></div>' +
      '<h4>Элементы</h4><div class="visual-hierarchy">' +
      (hierarchy || '<p class="hint">Пусто</p>') +
      '</div>' +
      '<div style="margin:8px 0;display:flex;flex-wrap:wrap;gap:6px;"><span class="hint">+ Добавить:</span> ' +
      addButtons +
      '</div>' +
      inspector;

    bindPanel(host);
    const viewport = host.querySelector('#visual-viewport');
    bindViewportPointer(viewport);
    if (viewport && typeof Editor.bindAssetDropTarget === 'function') {
      Editor.bindAssetDropTarget(viewport, function (payload, e) {
        const norm = clientToNorm(viewport, e.clientX, e.clientY);
        Editor.visualDropAssetAt(payload, norm.x, norm.y);
      });
    }
  };

  function clientToNorm(viewport, clientX, clientY) {
    const rect = viewport.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0, y: 0 };
    return {
      x: clamp01((clientX - rect.left) / rect.width, 0),
      y: clamp01((clientY - rect.top) / rect.height, 0)
    };
  }

  function bindViewportPointer(viewport) {
    if (!viewport || viewport._vpBound) return;
    viewport._vpBound = true;

    viewport.addEventListener('pointerdown', function (ev) {
      if (ev.button != null && ev.button !== 0) return;
      const handle = ev.target.closest?.('.visual-vp-handle');
      const nodeEl = ev.target.closest?.('.visual-vp-node');
      const norm = clientToNorm(viewport, ev.clientX, ev.clientY);

      if (ui.drawMode && !handle && !nodeEl) {
        ev.preventDefault();
        beginNodeGesture(null, 'draw');
        ui.drag.start = norm;
        ui.drag.tempId = null;
        viewport.setPointerCapture?.(ev.pointerId);
        return;
      }

      if (handle) {
        ev.preventDefault();
        ev.stopPropagation();
        const id = handle.getAttribute('data-node-id');
        const corner = handle.getAttribute('data-handle');
        setSelectedNodeId(id);
        beginNodeGesture(id, 'resize', corner);
        ui.drag.start = norm;
        viewport.setPointerCapture?.(ev.pointerId);
        Editor.visualSyncSelectionUi?.();
        return;
      }

      if (nodeEl) {
        ev.preventDefault();
        ev.stopPropagation();
        const id = nodeEl.getAttribute('data-node-id');
        setSelectedNodeId(id);

        const touchUi = typeof Editor.isTouchUi === 'function' && Editor.isTouchUi();
        if (touchUi && Editor._visualTouchMoveId !== id) {
          if (typeof Editor.renderVisualTouchBar === 'function') Editor.renderVisualTouchBar(id);
          Editor.visualSyncSelectionUi?.();
          return;
        }

        beginNodeGesture(id, 'move');
        ui.drag.start = norm;
        viewport.setPointerCapture?.(ev.pointerId);
        if (touchUi && Editor._visualTouchMoveId === id) {
          Editor._visualTouchMoveId = null;
        }
        ui.suppressFullRender = true;
        Editor.renderVisualScenePanel?.();
        ui.suppressFullRender = false;
        return;
      }

      // empty space
      setSelectedNodeId(null);
      Editor.renderVisualScenePanel?.();
    });

    viewport.addEventListener('pointermove', function (ev) {
      if (!ui.drag) return;
      const norm = clientToNorm(viewport, ev.clientX, ev.clientY);
      if (ui.drag.mode === 'draw') {
        const x0 = Math.min(ui.drag.start.x, norm.x);
        const y0 = Math.min(ui.drag.start.y, norm.y);
        const x1 = Math.max(ui.drag.start.x, norm.x);
        const y1 = Math.max(ui.drag.start.y, norm.y);
        let w = x1 - x0;
        let h = y1 - y0;
        if (w < 0.02) w = 0.02;
        if (h < 0.02) h = 0.02;
        if (!ui.drag.tempId) {
          // create node once into data without history until end
          const scene = currentSceneObj();
          if (!scene) return;
          const v = ensureVisual(scene);
          if (v.mode === 'none') v.mode = 'overlay';
          const node = defaultNode('hotspot');
          node.props.label = 'Hotspot';
          node.transform = { x: x0, y: y0, w: w, h: h, z: 10 };
          v.nodes.push(node);
          ui.drag.tempId = node.id;
          ui.drag.nodeId = node.id;
          setSelectedNodeId(node.id);
          // lightweight: append DOM node
          const layer = document.getElementById('visual-vp-nodes');
          if (layer) {
            const el = document.createElement('div');
            el.className = 'visual-vp-node is-selected';
            el.setAttribute('data-node-id', node.id);
            el.style.cssText = nodeStyle(node, true);
            el.textContent = 'Hotspot';
            layer.appendChild(el);
          }
        } else {
          Editor.visualApplyTransformLive(ui.drag.tempId, { x: x0, y: y0, w: w, h: h });
        }
        return;
      }

      const orig = ui.drag.orig;
      if (!orig || !ui.drag.nodeId) return;
      const dx = norm.x - ui.drag.start.x;
      const dy = norm.y - ui.drag.start.y;

      if (ui.drag.mode === 'move') {
        Editor.visualApplyTransformLive(ui.drag.nodeId, {
          x: orig.x + dx,
          y: orig.y + dy,
          w: orig.w,
          h: orig.h
        });
      } else if (ui.drag.mode === 'resize') {
        let x = orig.x;
        let y = orig.y;
        let w = orig.w;
        let h = orig.h;
        const c = ui.drag.corner;
        if (c === 'br') {
          w = orig.w + dx;
          h = orig.h + dy;
        } else if (c === 'bl') {
          x = orig.x + dx;
          w = orig.w - dx;
          h = orig.h + dy;
        } else if (c === 'tr') {
          y = orig.y + dy;
          w = orig.w + dx;
          h = orig.h - dy;
        } else if (c === 'tl') {
          x = orig.x + dx;
          y = orig.y + dy;
          w = orig.w - dx;
          h = orig.h - dy;
        }
        if (w < 0.02) w = 0.02;
        if (h < 0.02) h = 0.02;
        Editor.visualApplyTransformLive(ui.drag.nodeId, { x: x, y: y, w: w, h: h });
      }
    });

    function endPointer(ev) {
      if (!ui.drag) return;
      endNodeGesture();
      Editor.renderVisualScenePanel?.();
    }
    viewport.addEventListener('pointerup', endPointer);
    viewport.addEventListener('pointercancel', endPointer);
  }

  function openAssetPicker(target) {
    if (typeof document === 'undefined') return;
    const assets = listProjectAssets();
    const existing = document.getElementById('visual-asset-picker-overlay');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'visual-asset-picker-overlay';
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:10000;display:flex;align-items:center;justify-content:center;';
    const box = document.createElement('div');
    box.style.cssText =
      'background:#1e1e28;color:#eee;padding:16px 20px;border-radius:10px;min-width:320px;max-width:480px;max-height:70vh;overflow:auto;';
    box.innerHTML =
      '<h3 style="margin-top:0">Выбор изображения</h3>' +
      '<input type="search" id="visual-asset-search" placeholder="Поиск…" style="width:100%;margin-bottom:8px;box-sizing:border-box;">' +
      '<div id="visual-asset-list"></div>' +
      '<p class="hint" style="margin-top:12px">Или путь вручную:</p>' +
      '<input type="text" id="visual-asset-manual" placeholder="assets/images/village.png" style="width:100%;box-sizing:border-box;">' +
      '<div style="margin-top:12px"><button type="button" class="btn btn-primary" id="visual-asset-ok">OK</button> ' +
      '<button type="button" class="btn btn-secondary" id="visual-asset-cancel">Отмена</button></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    function renderList(filter) {
      const list = box.querySelector('#visual-asset-list');
      list.innerHTML = '';
      const q = (filter || '').toLowerCase().trim();
      const filtered = assets.filter((a) => {
        if (!q) return true;
        return (
          String(a.name || '').toLowerCase().indexOf(q) >= 0 ||
          String(a.src || '').toLowerCase().indexOf(q) >= 0 ||
          String(a.id || '').toLowerCase().indexOf(q) >= 0
        );
      });
      if (!filtered.length) {
        const miss = document.createElement('p');
        miss.className = 'hint';
        miss.textContent = assets.length
          ? 'Ничего не найдено'
          : 'В проекте нет assets. Добавьте в data.assets или введите путь.';
        list.appendChild(miss);
        return;
      }
      filtered.forEach((a) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-secondary';
        btn.style.cssText = 'display:flex;align-items:center;gap:8px;width:100%;margin:4px 0;text-align:left;';
        const thumb = document.createElement('span');
        thumb.style.cssText =
          'width:40px;height:40px;flex-shrink:0;background:#333 center/cover no-repeat;border-radius:4px;';
        if (a.src) thumb.style.backgroundImage = 'url("' + String(a.src).replace(/"/g, '\\"') + '")';
        const lab = document.createElement('span');
        lab.textContent = a.name + (a.src && a.src !== a.name ? ' — ' + a.src : '');
        btn.appendChild(thumb);
        btn.appendChild(lab);
        btn.onclick = function () {
          Editor.visualSetAsset(target, a.id);
          overlay.remove();
        };
        list.appendChild(btn);
      });
    }
    renderList('');
    box.querySelector('#visual-asset-search')?.addEventListener('input', function (e) {
      renderList(e.target.value);
    });
    overlay.querySelector('#visual-asset-cancel')?.addEventListener('click', () => overlay.remove());
    overlay.querySelector('#visual-asset-ok')?.addEventListener('click', () => {
      const v = overlay.querySelector('#visual-asset-manual')?.value?.trim();
      if (v) {
        if (target === 'background') Editor.visualUpdateNodeField(null, 'bgSrc', v);
        else Editor.visualUpdateNodeField(target, 'assetSrc', v);
      }
      overlay.remove();
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }


  /**
   * Shared Asset Picker for Visual Scene + Game UI (Phase 1.9.2).
   * onSelect({ id, src, name }) — no Visual-only coupling.
   */
  Editor.openSharedAssetPicker = function openSharedAssetPicker(onSelect, opts) {
    opts = opts || {};
    if (typeof document === 'undefined') return;
    const assets = listProjectAssets();
    const existing = document.getElementById('visual-asset-picker-overlay');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'visual-asset-picker-overlay';
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:10000;display:flex;align-items:center;justify-content:center;';
    const box = document.createElement('div');
    box.style.cssText =
      'background:#1e1e28;color:#eee;padding:16px 20px;border-radius:10px;min-width:320px;max-width:480px;max-height:70vh;overflow:auto;';
    box.innerHTML =
      '<h3 style="margin-top:0">' + (opts.title || 'Выбор изображения') + '</h3>' +
      '<input type="search" id="visual-asset-search" placeholder="Поиск…" style="width:100%;margin-bottom:8px;box-sizing:border-box;">' +
      '<div id="visual-asset-list"></div>' +
      '<p class="hint" style="margin-top:12px">Или путь вручную:</p>' +
      '<input type="text" id="visual-asset-manual" placeholder="assets/images/..." style="width:100%;box-sizing:border-box;">' +
      '<div style="margin-top:12px"><button type="button" class="btn btn-primary" id="visual-asset-ok">OK</button> ' +
      '<button type="button" class="btn btn-secondary" id="visual-asset-cancel">Отмена</button></div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    function finish(asset) {
      try {
        if (typeof onSelect === 'function') onSelect(asset);
      } finally {
        overlay.remove();
      }
    }

    function renderList(filter) {
      const list = box.querySelector('#visual-asset-list');
      list.innerHTML = '';
      const q = String(filter || '').toLowerCase();
      const filtered = assets.filter((a) => {
        const hay = ((a.id || '') + ' ' + (a.name || '') + ' ' + (a.src || '')).toLowerCase();
        return !q || hay.indexOf(q) >= 0;
      });
      if (!filtered.length) {
        list.innerHTML = '<p class="hint">Ничего не найдено. Добавьте assets в проект или введите путь.</p>';
        return;
      }
      filtered.forEach((a) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-secondary';
        btn.style.cssText = 'display:block;width:100%;text-align:left;margin:4px 0;';
        const thumb = a.src
          ? '<img src="' + String(a.src).replace(/"/g, '') + '" alt="" style="width:32px;height:32px;object-fit:cover;vertical-align:middle;margin-right:8px;background:#333;">'
          : '';
        btn.innerHTML = thumb + '<strong>' + (a.name || a.id) + '</strong> <span class="hint">' + (a.src || a.id) + '</span>';
        btn.onclick = function () {
          finish({ id: a.id, src: a.src || a.id, name: a.name || a.id, ref: a.id });
        };
        list.appendChild(btn);
      });
    }
    renderList('');
    box.querySelector('#visual-asset-search')?.addEventListener('input', function (e) {
      renderList(e.target.value);
    });
    overlay.querySelector('#visual-asset-cancel')?.addEventListener('click', function () { overlay.remove(); });
    overlay.querySelector('#visual-asset-ok')?.addEventListener('click', function () {
      const v = overlay.querySelector('#visual-asset-manual')?.value?.trim();
      if (v) finish({ id: '', src: v, name: v, ref: '' });
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });
  };

  function bindPanel(host) {
    host.onclick = function (ev) {
      const t = ev.target.closest('[data-action]');
      if (!t || !host.contains(t)) return;
      const action = t.getAttribute('data-action');
      const id = t.getAttribute('data-id');
      const kind = t.getAttribute('data-kind');
      const target = t.getAttribute('data-target');
      if (action === 'loadDemoVillage') {
        Editor.loadVisualVillageDemo && Editor.loadVisualVillageDemo();
        return;
      }
      if (action === 'add' && kind) {
        const nid = Editor.visualAddNode(kind);
        if (kind === 'image' && nid) openAssetPicker(nid);
      } else if (action === 'select' && id) Editor.visualSelectNode(id);
      else if (action === 'delete' && id) Editor.visualDeleteNode(id);
      else if (action === 'up' && id) Editor.visualMoveNode(id, -1);
      else if (action === 'down' && id) Editor.visualMoveNode(id, 1);
      else if (action === 'clearClick' && id) Editor.visualClearClick(id);
      else if (action === 'condAdd' && id) Editor.visualAddCondition(id, 'hasItem');
      else if (action === 'condRemove' && id) Editor.visualRemoveCondition(id, t.getAttribute('data-index'));
      else if (action === 'clickAdd' && id) Editor.visualAddClickAction(id, 'change_scene', {});
      else if (action === 'clickRemove' && id) Editor.visualRemoveClickAction(id, t.getAttribute('data-index'));
      else if (action === 'clickUp' && id) Editor.visualMoveClickAction(id, t.getAttribute('data-index'), -1);
      else if (action === 'clickDown' && id) Editor.visualMoveClickAction(id, t.getAttribute('data-index'), 1);
      else if (action === 'pickAsset' && target) openAssetPicker(target);
    };

    host.onchange = function (ev) {
      const el = ev.target;
      if (!el?.getAttribute) return;
      if (el.id === 'visual-snap-toggle') {
        Editor.visualSetSnap(el.checked, parseFloat(document.getElementById('visual-grid-size')?.value) || ui.grid);
        return;
      }
      if (el.id === 'visual-grid-size') {
        Editor.visualSetSnap(ui.snap, parseFloat(el.value) || 0.05);
        return;
      }
      if (el.id === 'visual-draw-mode') {
        ui.drawMode = !!el.checked;
        return;
      }
      const field = el.getAttribute('data-field');
      if (!field) return;
      const nodeId = el.getAttribute('data-node');
      if (field === 'mode') {
        Editor.visualUpdateNodeField(null, 'mode', el.value);
        return;
      }
      if (field === 'visible' || field === 'enabled') {
        Editor.visualToggleNodeFlag(nodeId, field, el.checked);
        return;
      }
      if (field === 'condMode') {
        Editor.visualSetConditionMode(nodeId, el.value);
        return;
      }
      if (field === 'condType') {
        const cidx = el.getAttribute('data-cond-index');
        Editor.visualSetConditionAt(nodeId, cidx, el.value);
        return;
      }
      if (field === 'condParam') {
        const cidx = el.getAttribute('data-cond-index');
        const pid = el.getAttribute('data-cond-param');
        if (pid != null) Editor.visualSetConditionParamAt(nodeId, cidx, pid, el.value);
        return;
      }
      if (field === 'actionType') {
        const idx = el.getAttribute('data-click-index');
        if (idx != null && typeof Editor.visualSetClickActionAt === 'function') {
          Editor.visualSetClickActionAt(nodeId, idx, el.value, {});
        } else {
          Editor.visualSetClickAction(nodeId, el.value, {});
        }
        return;
      }
      if (field === 'actionParam') {
        const paramId = el.getAttribute('data-param-id');
        const idx = el.getAttribute('data-click-index');
        const paramVal =
          typeof Editor.readActionParamInputValue === 'function'
            ? Editor.readActionParamInputValue(el)
            : el.value;
        if (paramId && idx != null && typeof Editor.visualSetClickParamAt === 'function') {
          Editor.visualSetClickParamAt(nodeId, idx, paramId, paramVal);
        } else if (paramId && typeof Editor.visualSetClickParam === 'function') {
          Editor.visualSetClickParam(nodeId, paramId, paramVal);
        } else {
          const node = findNode(currentSceneObj(), nodeId);
          const actionId = node?.events?.click?.[0]?.action || 'change_scene';
          Editor.visualSetClickAction(nodeId, actionId, paramVal);
        }
        return;
      }
      if (field === 'clickMacro') {
        if (el.value) {
          Editor.visualApplyClickMacro(nodeId, el.value);
          el.value = '';
        }
        return;
      }
      Editor.visualUpdateNodeField(nodeId, field, el.value);
    };
  }

  if (Editor.hooks?.after) {
    Editor.hooks.after(
      'renderSceneEditor',
      function () {
        try {
          Editor.renderVisualScenePanel();
        } catch (e) {
          console.warn('[editor-visual-scene]', e);
        }
      },
      'editor-visual-scene'
    );
  }

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-visual-scene', {
      visualAddNode: Editor.visualAddNode,
      visualDeleteNode: Editor.visualDeleteNode,
      visualSelectNode: Editor.visualSelectNode,
      visualUpdateNodeField: Editor.visualUpdateNodeField,
      visualSetClickAction: Editor.visualSetClickAction,
      visualApplyTransformLive: Editor.visualApplyTransformLive,
      visualSetAsset: Editor.visualSetAsset,
      renderVisualScenePanel: Editor.renderVisualScenePanel
    });
  }


  /**
   * Load isolated Demo Village project (does not merge Mill).
   * Uses DEMO_VISUAL_VILLAGE_DATA or fetch data/demos/visual_village.json
   */
  Editor.loadVisualVillageDemo = function loadVisualVillageDemo() {
    const apply = (data) => {
      if (!data || !data.scenes || !data.scenes.village) {
        if (Editor.toast) Editor.toast.error('Демо деревни не загружено');
        else console.error('[visual-village] invalid demo data');
        return false;
      }
      if (typeof Editor.setProjectData === 'function') {
        Editor.setProjectData(JSON.parse(JSON.stringify(data)));
      } else {
        Editor.data = JSON.parse(JSON.stringify(data));
      }
      Editor.currentScene = 'village';
      if (typeof Editor.switchTab === 'function') Editor.switchTab('scenes');
      else if (typeof Editor.renderAll === 'function') Editor.renderAll();
      else {
        Editor.renderSceneList?.();
        Editor.renderSceneEditor?.();
      }
      if (Editor.toast) Editor.toast.success('Загружено демо: квест деревни (vertical slice)');
      return true;
    };
    // Prefer JSON when fetch works (http/https); inline for file:// offline.
    const canFetch =
      typeof fetch === 'function' &&
      typeof location !== 'undefined' &&
      location.protocol !== 'file:';
    if (canFetch) {
      fetch('data/demos/visual_village.json?v=' + Date.now())
        .then((r) => r.json())
        .then(apply)
        .catch((e) => {
          console.warn('[visual-village] fetch failed, falling back to inline', e);
          if (typeof DEMO_VISUAL_VILLAGE_DATA !== 'undefined' && DEMO_VISUAL_VILLAGE_DATA) {
            apply(DEMO_VISUAL_VILLAGE_DATA);
          } else if (Editor.toast) {
            Editor.toast.error('Не удалось загрузить visual_village.json');
          }
        });
      return true;
    }
    if (typeof DEMO_VISUAL_VILLAGE_DATA !== 'undefined' && DEMO_VISUAL_VILLAGE_DATA) {
      return apply(DEMO_VISUAL_VILLAGE_DATA);
    }
    if (Editor.toast) Editor.toast.error('Нет DEMO_VISUAL_VILLAGE_DATA — подключите js/demo-visual-village.js');
    return false;
  };

  Editor.VISUAL_ACTION_UX = typeof Editor.getVisualActionUxList === "function" ? Editor.getVisualActionUxList() : [];
  Editor.VISUAL_KIND_META = KIND_META;
  Editor._visualUiState = ui; // tests may inspect snap/drag
})(typeof window !== 'undefined' ? window : globalThis);
