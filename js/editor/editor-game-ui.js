/**
 * Game UI Editor (Phase 1.9 / 1.9.1)
 * WYSIWYG: select / drag / resize / one history mutation per gesture.
 */
(function editorGameUi(global) {
  'use strict';

  if (typeof Editor === 'undefined') return;

  const KIND_LABELS = {
    image: 'Изображение', text: 'Текст', button: 'Кнопка', panel: 'Панель',
    bar: 'Полоска HP', gold: 'Золото', level: 'Уровень', portrait: 'Портрет'
  };
  const MIN_W = 0.04, MIN_H = 0.03;
  const gesture = {
    active: false, mode: null, corner: null, nodeId: null,
    startX: 0, startY: 0, orig: null, beforeSnap: null
  };
  const uiSnap = { enabled: false, grid: 0.05 };

  function snapVal(v) {
    if (!uiSnap.enabled) return v;
    var g = uiSnap.grid || 0.05;
    return Math.round(v / g) * g;
  };

  function ensureUi() {
    if (!Editor.data) Editor.data = {};
    if (typeof UIRuntime !== 'undefined' && UIRuntime.ensureProjectUi) return UIRuntime.ensureProjectUi(Editor.data);
    if (!Editor.data.ui) Editor.data.ui = { screens: {} };
    if (!Editor.data.ui.screens) Editor.data.ui.screens = {};
    return Editor.data.ui;
  }
  function selectedScreenId() {
    return Editor._uiSelectedScreen || Object.keys(ensureUi().screens)[0] || null;
  }
  function getScreen(id) { return ensureUi().screens[id] || null; }
  function clamp01(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
  }
  function snapshotUi() { return JSON.parse(JSON.stringify(Editor.data.ui || { screens: {} })); }

  function withUiHistory(label, mutator) {
    const before = JSON.stringify(Editor.data.ui || {});
    mutator();
    const after = JSON.stringify(Editor.data.ui || {});
    if (before === after) return;
    if (Editor.history && typeof Editor.history.recordMutation === 'function') {
      Editor.history.recordMutation({
        label: label || 'UI',
        undo: function () { Editor.data.ui = JSON.parse(before); Editor.renderGameUiEditor && Editor.renderGameUiEditor(); },
        redo: function () { Editor.data.ui = JSON.parse(after); Editor.renderGameUiEditor && Editor.renderGameUiEditor(); }
      });
    }
    if (Editor.markDirty) Editor.markDirty();
  }

  function beginGesture(nodeId, mode, corner, clientX, clientY) {
    const sc = getScreen(selectedScreenId());
    const node = sc && sc.nodes && sc.nodes.find(function (n) { return n.id === nodeId; });
    if (!node) return;
    gesture.active = true;
    gesture.mode = mode;
    gesture.corner = corner || null;
    gesture.nodeId = nodeId;
    gesture.startX = clientX;
    gesture.startY = clientY;
    gesture.orig = Object.assign({}, node.transform || {});
    gesture.beforeSnap = snapshotUi();
  }

  function endGesture() {
    if (!gesture.active) return;
    const before = gesture.beforeSnap;
    gesture.active = false;
    gesture.mode = null;
    gesture.nodeId = null;
    if (!before) return;
    const after = snapshotUi();
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    if (Editor.history && typeof Editor.history.recordMutation === 'function') {
      Editor.history.recordMutation({
        label: 'UI transform',
        undo: function () { Editor.data.ui = before; Editor.renderGameUiEditor && Editor.renderGameUiEditor(); },
        redo: function () { Editor.data.ui = after; Editor.renderGameUiEditor && Editor.renderGameUiEditor(); }
      });
    }
    if (Editor.markDirty) Editor.markDirty();
  }

  function applyLiveTransform(nodeId, t) {
    const sc = getScreen(selectedScreenId());
    const node = sc && sc.nodes && sc.nodes.find(function (n) { return n.id === nodeId; });
    if (!node) return;
    if (node.locked) return;
    if (!node.transform) node.transform = {};
    var x = clamp01(snapVal(t.x)), y = clamp01(snapVal(t.y));
    var w = Math.max(MIN_W, clamp01(snapVal(t.w))), h = Math.max(MIN_H, clamp01(snapVal(t.h)));
    if (x + w > 1) x = Math.max(0, 1 - w);
    if (y + h > 1) y = Math.max(0, 1 - h);
    node.transform.x = x; node.transform.y = y; node.transform.w = w; node.transform.h = h;
    if (t.z != null) node.transform.z = Number(t.z) || 0;
    paintViewportNodes();
  }


  Editor.uiPickAsset = async function (nodeId) {
    var apply = function (asset) {
      if (!asset) return;
      withUiHistory('UI: asset', function () {
        var sc = getScreen(selectedScreenId());
        var node = sc && sc.nodes && sc.nodes.find(function (n) { return n.id === nodeId; });
        if (!node) return;
        node.asset = {
          type: 'image',
          ref: asset.ref || asset.id || undefined,
          src: asset.src || asset.id || ''
        };
      });
      if (Editor.renderGameUiEditor) Editor.renderGameUiEditor();
    };
    if (typeof Editor.openSharedAssetPicker === 'function') {
      Editor.openSharedAssetPicker(apply, { title: 'Изображение для UI' });
      return;
    }
    var path = await Editor.promptDialog({ message: 'Путь к изображению', defaultValue: 'assets/images/' });
    if (path) apply({ src: path, id: '', name: path });
  };

  Editor.uiSetSnap = function (enabled, grid) {
    uiSnap.enabled = !!enabled;
    if (grid != null && Number.isFinite(Number(grid))) uiSnap.grid = Math.max(0.01, Number(grid));
  };
  Editor.uiGetSnap = function () { return { enabled: uiSnap.enabled, grid: uiSnap.grid }; };

  Editor.uiSelectScreen = function (id) {
    Editor._uiSelectedScreen = id; Editor._uiSelectedNode = null; Editor.renderGameUiEditor && Editor.renderGameUiEditor();
  };
  Editor.uiSelectNode = function (nodeId) {
    Editor._uiSelectedNode = nodeId; Editor.renderGameUiEditor && Editor.renderGameUiEditor();
  };
  Editor.uiAddScreen = function (id) {
    var sid = String(id || ('hud_' + Date.now())).replace(/[^a-zA-Z0-9_-]/g, '_');
    withUiHistory('UI: new screen', function () {
      var ui = ensureUi();
      if (!ui.screens[sid]) ui.screens[sid] = { id: sid, scope: 'persistent', nodes: [] };
      Editor._uiSelectedScreen = sid;
    });
    Editor.renderGameUiEditor && Editor.renderGameUiEditor();
  };
  Editor.uiApplyPreset = function (presetId) {
    if (typeof UIRuntime === 'undefined' || !UIRuntime.presets || !UIRuntime.presets[presetId]) {
      if (Editor.toast) Editor.toast.error('Пресет не найден');
      return;
    }
    var preset = UIRuntime.presets[presetId]();
    withUiHistory('UI: preset ' + presetId, function () {
      ensureUi().screens[preset.id] = JSON.parse(JSON.stringify(preset));
      Editor._uiSelectedScreen = preset.id;
      Editor._uiSelectedNode = null;
    });
    if (Editor.toast) Editor.toast.success('Пресет добавлен');
    Editor.renderGameUiEditor && Editor.renderGameUiEditor();
  };
  Editor.uiAddNode = function (kind) {
    if (!selectedScreenId()) Editor.uiAddScreen('basic_hud');
    var screenId = selectedScreenId();
    withUiHistory('UI: +' + kind, function () {
      var sc = getScreen(screenId);
      if (!sc) return;
      if (!Array.isArray(sc.nodes)) sc.nodes = [];
      var id = kind + '_' + Date.now().toString(36);
      var node = {
        id: id, kind: kind,
        transform: { x: 0.35, y: 0.4, w: 0.2, h: 0.08, z: sc.nodes.length + 1 },
        visible: true, enabled: true,
        text: kind === 'button' ? 'Кнопка' : (kind === 'text' ? 'Текст' : ''),
        events: { click: [] }
      };
      if (kind === 'gold') node.text = '🪙 {gold}';
      if (kind === 'level') node.text = 'Ур. {level}';
      if (kind === 'button') node.events.click = [{ action: 'open_panel', params: { panel: 'journal' } }];
      sc.nodes.push(node);
      Editor._uiSelectedNode = id;
    });
    Editor.renderGameUiEditor && Editor.renderGameUiEditor();
  };
  Editor.uiDeleteNode = function (nodeId) {
    var sid = selectedScreenId();
    withUiHistory('UI: delete', function () {
      var sc = getScreen(sid);
      if (!sc || !sc.nodes) return;
      sc.nodes = sc.nodes.filter(function (n) { return n.id !== nodeId; });
      if (Editor._uiSelectedNode === nodeId) Editor._uiSelectedNode = null;
    });
    Editor.renderGameUiEditor && Editor.renderGameUiEditor();
  };

  function findUiNode(nodeId) {
    var sc = getScreen(selectedScreenId());
    if (!sc || !sc.nodes) return null;
    return sc.nodes.find(function (n) { return n.id === nodeId; }) || null;
  }

  function uiConditionMode(showIf) {
    return typeof Editor.getConditionMode === 'function'
      ? Editor.getConditionMode(showIf)
      : Array.isArray(showIf && showIf.any)
        ? 'any'
        : 'all';
  }

  function uiWriteShowIf(node, rules, mode) {
    if (!rules || !rules.length) {
      node.showIf = null;
      return;
    }
    var m = mode === 'any' ? 'any' : 'all';
    node.showIf =
      typeof Editor.rulesToShowIf === 'function'
        ? Editor.rulesToShowIf(rules, m)
        : m === 'any'
          ? { any: rules }
          : { all: rules };
  }

  Editor.uiAddCondition = function (nodeId, catalogId) {
    withUiHistory('UI: +cond', function () {
      var node = findUiNode(nodeId);
      if (!node) return;
      var mode = uiConditionMode(node.showIf);
      var rules = typeof Editor.extractConditionRules === 'function' ? Editor.extractConditionRules(node.showIf) : [];
      var rule = typeof Editor.buildConditionRule === 'function' ? Editor.buildConditionRule(catalogId || 'hasItem', {}) : { hasItem: '' };
      rules.push(rule);
      uiWriteShowIf(node, rules, mode);
    });
    Editor.renderGameUiEditor && Editor.renderGameUiEditor();
  };
  Editor.uiRemoveCondition = function (nodeId, index) {
    withUiHistory('UI: -cond', function () {
      var node = findUiNode(nodeId);
      if (!node) return;
      var mode = uiConditionMode(node.showIf);
      var rules = typeof Editor.extractConditionRules === 'function' ? Editor.extractConditionRules(node.showIf) : [];
      var i = Number(index);
      if (i >= 0 && i < rules.length) rules.splice(i, 1);
      uiWriteShowIf(node, rules, mode);
    });
    Editor.renderGameUiEditor && Editor.renderGameUiEditor();
  };
  Editor.uiSetConditionAt = function (nodeId, index, catalogId) {
    withUiHistory('UI: set cond', function () {
      var node = findUiNode(nodeId);
      if (!node) return;
      var mode = uiConditionMode(node.showIf);
      var rules = typeof Editor.extractConditionRules === 'function' ? Editor.extractConditionRules(node.showIf) : [];
      var i = Number(index);
      if (i < 0 || i >= rules.length) return;
      rules[i] = typeof Editor.buildConditionRule === 'function' ? Editor.buildConditionRule(catalogId, {}) : { hasItem: '' };
      uiWriteShowIf(node, rules, mode);
    });
    Editor.renderGameUiEditor && Editor.renderGameUiEditor();
  };
  Editor.uiSetConditionParamAt = function (nodeId, index, paramId, value) {
    withUiHistory('UI: cond param', function () {
      var node = findUiNode(nodeId);
      if (!node) return;
      var mode = uiConditionMode(node.showIf);
      var rules = typeof Editor.extractConditionRules === 'function' ? Editor.extractConditionRules(node.showIf) : [];
      var i = Number(index);
      if (i < 0 || i >= rules.length) return;
      var catId = typeof Editor.ruleToCatalogId === 'function' ? Editor.ruleToCatalogId(rules[i]) : null;
      var vals = typeof Editor.conditionValuesFromRule === 'function' ? Editor.conditionValuesFromRule(rules[i]) : {};
      vals[paramId] = value;
      if (catId && typeof Editor.buildConditionRule === 'function') rules[i] = Editor.buildConditionRule(catId, vals);
      uiWriteShowIf(node, rules, mode);
    });
    Editor.renderGameUiEditor && Editor.renderGameUiEditor();
  };
  Editor.uiSetConditionMode = function (nodeId, mode) {
    withUiHistory('UI: cond mode', function () {
      var node = findUiNode(nodeId);
      if (!node) return;
      var rules = typeof Editor.extractConditionRules === 'function' ? Editor.extractConditionRules(node.showIf) : [];
      if (!rules.length) return;
      uiWriteShowIf(node, rules, mode === 'any' ? 'any' : 'all');
    });
    Editor.renderGameUiEditor && Editor.renderGameUiEditor();
  };
  Editor.uiAddClickAction = function (nodeId, actionId, params) {
    withUiHistory('UI: +click', function () {
      var node = findUiNode(nodeId);
      if (!node) return;
      if (!node.events) node.events = {};
      if (!Array.isArray(node.events.click)) node.events.click = [];
      var key = actionId || 'change_scene';
      var p = typeof Editor.buildActionParamsObject === 'function' ? Editor.buildActionParamsObject(key, params || {}) : params || {};
      node.events.click.push({ action: key, params: p });
    });
    Editor.renderGameUiEditor && Editor.renderGameUiEditor();
  };
  Editor.uiRemoveClickAction = function (nodeId, index) {
    withUiHistory('UI: -click', function () {
      var node = findUiNode(nodeId);
      if (!node || !node.events || !Array.isArray(node.events.click)) return;
      var i = Number(index);
      if (i >= 0 && i < node.events.click.length) node.events.click.splice(i, 1);
    });
    Editor.renderGameUiEditor && Editor.renderGameUiEditor();
  };
  Editor.uiMoveClickAction = function (nodeId, index, dir) {
    withUiHistory('UI: move click', function () {
      var node = findUiNode(nodeId);
      if (!node || !node.events || !Array.isArray(node.events.click)) return;
      var list = node.events.click;
      var i = Number(index), j = i + (dir < 0 ? -1 : 1);
      if (i < 0 || j < 0 || i >= list.length || j >= list.length) return;
      var tmp = list[i]; list[i] = list[j]; list[j] = tmp;
    });
    Editor.renderGameUiEditor && Editor.renderGameUiEditor();
  };
  Editor.uiSetClickActionAt = function (nodeId, index, actionId) {
    withUiHistory('UI: set click', function () {
      var node = findUiNode(nodeId);
      if (!node || !node.events || !Array.isArray(node.events.click)) return;
      var i = Number(index);
      if (i < 0 || i >= node.events.click.length) return;
      if (!actionId) { node.events.click.splice(i, 1); return; }
      var prev = (node.events.click[i] && node.events.click[i].params) || {};
      node.events.click[i] = { action: actionId, params: typeof Editor.buildActionParamsObject === 'function' ? Editor.buildActionParamsObject(actionId, prev) : prev };
    });
    Editor.renderGameUiEditor && Editor.renderGameUiEditor();
  };
  Editor.uiSetClickParamAt = function (nodeId, index, paramId, value) {
    withUiHistory('UI: click param', function () {
      var node = findUiNode(nodeId);
      if (!node || !node.events || !node.events.click || !node.events.click[index]) return;
      var step = node.events.click[index];
      var vals = Object.assign({}, step.params || {});
      vals[paramId] = value;
      step.params = typeof Editor.buildActionParamsObject === 'function' ? Editor.buildActionParamsObject(step.action, vals) : vals;
    });
    Editor.renderGameUiEditor && Editor.renderGameUiEditor();
  };
  Editor.uiApplyClickMacro = function (nodeId, macroId) {
    var macros = typeof Editor.getActionMacros === 'function' ? Editor.getActionMacros() : [];
    var m = macros.find(function (x) { return x.id === macroId; });
    if (!m || !m.steps) return;
    withUiHistory('UI: macro', function () {
      var node = findUiNode(nodeId);
      if (!node) return;
      if (!node.events) node.events = {};
      if (!Array.isArray(node.events.click)) node.events.click = [];
      m.steps.forEach(function (step) {
        var pr = typeof Editor.buildActionParamsObject === 'function' ? Editor.buildActionParamsObject(step.action, step.params || {}) : step.params || {};
        node.events.click.push({ action: step.action, params: pr });
      });
    });
    Editor.renderGameUiEditor && Editor.renderGameUiEditor();
  };
  Editor.uiClearClick = function (nodeId) {
    withUiHistory('UI: clear click', function () {
      var node = findUiNode(nodeId);
      if (!node) return;
      if (!node.events) node.events = {};
      node.events.click = [];
    });
    Editor.renderGameUiEditor && Editor.renderGameUiEditor();
  };

  Editor.uiUpdateNodeField = function (nodeId, field, value) {
    var sid = selectedScreenId();
    withUiHistory('UI: field', function () {
      var sc = getScreen(sid);
      if (!sc) return;
      if (field === 'scope') { sc.scope = value === 'scene' ? 'scene' : 'persistent'; return; }
      if (field === 'screenSceneId') { sc.sceneId = value; return; }
      var node = sc.nodes && sc.nodes.find(function (n) { return n.id === nodeId; });
      if (!node) return;
      if (field.indexOf('transform.') === 0) {
        var k = field.split('.')[1];
        if (!node.transform) node.transform = {};
        node.transform[k] = Number(value);
      } else if (field === 'text') node.text = value;
      else if (field === 'binding') node.binding = value;
      else if (field === 'assetSrc') {
        node.asset = node.asset || { type: 'image' };
        node.asset.src = value;
      } else if (field === 'clickAction') {
        node.events = node.events || {};
        if (!value) {
          node.events.click = [];
        } else {
          var prev = (node.events.click && node.events.click[0] && node.events.click[0].params) || {};
          var params =
            typeof Editor.buildActionParamsObject === 'function'
              ? Editor.buildActionParamsObject(value, prev)
              : prev;
          node.events.click = [{ action: value, params: params }];
        }
      } else if (field.indexOf('actionParam:') === 0) {
        var pid = field.slice('actionParam:'.length);
        node.events = node.events || {};
        if (!node.events.click || !node.events.click[0]) return;
        var st = node.events.click[0];
        var vals = Object.assign({}, st.params || {});
        vals[pid] = value;
        st.params =
          typeof Editor.buildActionParamsObject === 'function'
            ? Editor.buildActionParamsObject(st.action, vals)
            : vals;
      }
    });
    Editor.renderGameUiEditor && Editor.renderGameUiEditor();
  };

  function paintViewportNodes() {
    var vp = document.getElementById('game-ui-viewport');
    if (!vp) return;
    var sc = getScreen(selectedScreenId());
    var nid = Editor._uiSelectedNode;
    vp.innerHTML = '';
    if (!sc) return;
    (sc.nodes || []).forEach(function (n) {
      var t = n.transform || {};
      var el = document.createElement('div');
      el.className = 'game-ui-vp-node' + (n.id === nid ? ' selected' : '');
      el.dataset.nodeId = n.id;
      el.style.cssText = [
        'position:absolute', 'left:' + ((t.x || 0) * 100) + '%', 'top:' + ((t.y || 0) * 100) + '%',
        'width:' + ((t.w || 0.1) * 100) + '%', 'height:' + ((t.h || 0.08) * 100) + '%',
        'box-sizing:border-box', 'background:rgba(70,110,180,0.4)', 'border:1px solid rgba(255,255,255,0.35)',
        'color:#fff', 'font-size:11px', 'display:flex', 'align-items:center', 'justify-content:center',
        'cursor:move', 'user-select:none', 'overflow:hidden',
        n.id === nid ? 'outline:2px solid #6af' : ''
      ].join(';');
      el.textContent = n.text || KIND_LABELS[n.kind] || n.kind;
      if (n.id === nid) {
        ['nw', 'ne', 'sw', 'se'].forEach(function (c) {
          var h = document.createElement('div');
          h.dataset.resize = c;
          h.dataset.nodeId = n.id;
          var pos = c === 'nw' ? 'left:0;top:0;cursor:nwse-resize' :
            c === 'ne' ? 'right:0;top:0;cursor:nesw-resize' :
            c === 'sw' ? 'left:0;bottom:0;cursor:nesw-resize' :
            'right:0;bottom:0;cursor:nwse-resize';
          h.style.cssText = 'position:absolute;width:10px;height:10px;background:#6af;z-index:5;' + pos;
          el.appendChild(h);
        });
      }
      vp.appendChild(el);
    });
  }

  Editor.uiDropAssetAt = function (payload, normX, normY) {
    if (!payload || !payload.id) return;
    if (!selectedScreenId()) Editor.uiAddScreen('basic_hud');
    var screenId = selectedScreenId();
    if (!screenId) return;
    var w = 0.1;
    var h = 0.1;
    var newId = null;
    withUiHistory('UI: drop asset', function () {
      var sc = getScreen(screenId);
      if (!sc) return;
      if (!Array.isArray(sc.nodes)) sc.nodes = [];
      newId = 'image_' + Date.now().toString(36);
      var node = {
        id: newId,
        kind: 'image',
        transform: {
          x: Math.max(0, Math.min(1 - w, (normX || 0.5) - w / 2)),
          y: Math.max(0, Math.min(1 - h, (normY || 0.5) - h / 2)),
          w: w,
          h: h,
          z: sc.nodes.length + 1
        },
        visible: true,
        enabled: true,
        asset: { type: 'image', ref: payload.id, src: payload.src || '' },
        events: { click: [] }
      };
      if (payload.name) node.text = payload.name;
      sc.nodes.push(node);
      Editor._uiSelectedNode = newId;
    });
    Editor.renderGameUiEditor && Editor.renderGameUiEditor();
    return newId;
  };

  function bindViewportEvents(vp) {
    if (!vp || vp._gameUiBound) return;
    vp._gameUiBound = true;
    vp.addEventListener('pointerdown', function (ev) {
      var handle = ev.target.closest('[data-resize]');
      var nodeEl = ev.target.closest('[data-node-id]');
      if (handle) {
        var id = handle.getAttribute('data-node-id');
        Editor._uiSelectedNode = id;
        beginGesture(id, 'resize', handle.getAttribute('data-resize'), ev.clientX, ev.clientY);
        if (vp.setPointerCapture) vp.setPointerCapture(ev.pointerId);
        ev.preventDefault();
        return;
      }
      if (nodeEl && vp.contains(nodeEl)) {
        var nid = nodeEl.getAttribute('data-node-id');
        Editor._uiSelectedNode = nid;
        beginGesture(nid, 'move', null, ev.clientX, ev.clientY);
        if (vp.setPointerCapture) vp.setPointerCapture(ev.pointerId);
        paintViewportNodes();
        ev.preventDefault();
      }
    });
    vp.addEventListener('pointermove', function (ev) {
      if (!gesture.active || !gesture.nodeId) return;
      var rect = vp.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var dx = (ev.clientX - gesture.startX) / rect.width;
      var dy = (ev.clientY - gesture.startY) / rect.height;
      var o = gesture.orig || {};
      if (gesture.mode === 'move') {
        applyLiveTransform(gesture.nodeId, { x: (o.x || 0) + dx, y: (o.y || 0) + dy, w: o.w || 0.1, h: o.h || 0.08 });
      } else if (gesture.mode === 'resize') {
        var x = o.x || 0, y = o.y || 0, w = o.w || 0.1, h = o.h || 0.08;
        var c = gesture.corner;
        if (c === 'se') { w += dx; h += dy; }
        else if (c === 'sw') { x += dx; w -= dx; h += dy; }
        else if (c === 'ne') { w += dx; y += dy; h -= dy; }
        else if (c === 'nw') { x += dx; y += dy; w -= dx; h -= dy; }
        applyLiveTransform(gesture.nodeId, { x: x, y: y, w: w, h: h });
      }
    });
    function up() {
      if (gesture.active) { endGesture(); if (Editor.renderGameUiEditor) Editor.renderGameUiEditor(); }
    }
    vp.addEventListener('pointerup', up);
    vp.addEventListener('pointercancel', up);
    if (typeof Editor.bindAssetDropTarget === 'function') {
      Editor.bindAssetDropTarget(vp, function (payload, e) {
        var rect = vp.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        var nx = (e.clientX - rect.left) / rect.width;
        var ny = (e.clientY - rect.top) / rect.height;
        Editor.uiDropAssetAt(payload, nx, ny);
      });
    }
  }

  Editor.renderGameUiEditor = function () {
    var host = document.getElementById('game-ui-editor-root');
    if (!host) return;
    var ui = ensureUi();
    var screens = Object.keys(ui.screens);
    var sid = selectedScreenId();
    var sc = sid ? ui.screens[sid] : null;
    var nid = Editor._uiSelectedNode;
    var node = sc && sc.nodes && sc.nodes.find(function (n) { return n.id === nid; });
    var presets = (typeof UIRuntime !== 'undefined' && UIRuntime.presets) ? Object.keys(UIRuntime.presets) :
      ['main_menu', 'basic_hud', 'character_status', 'bottom_action_bar', 'rpg_hud'];

    var html = '<div class="game-ui-editor"><h3>🖥 Игровой интерфейс</h3>';
    html += '<p class="hint">Перетаскивайте элементы мышью. Углы — размер. On Click — готовые действия без кода.</p>';
    html += '<label><input type="checkbox" id="ui-snap-toggle"' + (uiSnap.enabled ? ' checked' : '') + '> Snap</label> ';
    html += '<label>Сетка <input type="number" id="ui-snap-grid" step="0.01" min="0.01" value="' + uiSnap.grid + '" style="width:4em"></label>';
    html += '<div class="form-row"><strong>Пресеты:</strong> ';
    presets.forEach(function (pid) {
      html += '<button type="button" class="btn btn-secondary btn-sm" data-ui-action="preset" data-preset="' + pid + '">' + pid + '</button> ';
    });
    html += '</div><div class="form-row"><button type="button" class="btn btn-primary btn-sm" data-ui-action="addScreen">+ Экран</button></div>';
    html += '<div class="ui-hierarchy"><strong>Экраны</strong><ul>';
    screens.forEach(function (id) {
      html += '<li' + (id === sid ? ' class="active"' : '') + '><button type="button" data-ui-action="selectScreen" data-id="' + id + '">' + id + '</button></li>';
    });
    html += '</ul></div>';

    if (sc) {
      html += '<div class="form-group"><label>Область <select data-ui-field="scope">';
      html += '<option value="persistent"' + (sc.scope !== 'scene' ? ' selected' : '') + '>Постоянный HUD</option>';
      html += '<option value="scene"' + (sc.scope === 'scene' ? ' selected' : '') + '>Только для сцены</option></select></label></div>';
      if (sc.scope === 'scene') {
        html += '<div class="form-group"><label>ID сцены <input type="text" data-ui-field="screenSceneId" value="' + (sc.sceneId || '') + '"/></label></div>';
      }
      html += '<div class="form-row"><strong>Добавить:</strong> ';
      Object.keys(KIND_LABELS).forEach(function (k) {
        html += '<button type="button" class="btn btn-secondary btn-sm" data-ui-action="addNode" data-kind="' + k + '">' + KIND_LABELS[k] + '</button> ';
      });
      html += '</div><div class="ui-nodes"><strong>Элементы</strong><ul>';
      (sc.nodes || []).forEach(function (n) {
        html += '<li' + (n.id === nid ? ' class="active"' : '') + '><button type="button" data-ui-action="selectNode" data-id="' + n.id + '">' +
          (KIND_LABELS[n.kind] || n.kind) + ' — ' + n.id + '</button> <button type="button" data-ui-action="deleteNode" data-id="' + n.id + '">✕</button></li>';
      });
      html += '</ul></div>';
      html += '<div id="game-ui-viewport" style="position:relative;width:100%;max-width:560px;aspect-ratio:16/9;background:#1a2030;border:1px solid #445;border-radius:8px;margin:8px 0;touch-action:none;"></div>';
    }

    if (node) {
      html += typeof Editor.buildGameUiNodeInspectorHtml === 'function'
        ? Editor.buildGameUiNodeInspectorHtml(node)
        : (function () {
      var t = node.transform || {};
      var block = '<div class="ui-inspector"><h4>Свойства: ' + node.id + '</h4>';
      block += '<label>Текст <input type="text" data-ui-node="' + node.id + '" data-ui-field="text" value="' + String(node.text || '').replace(/"/g, '&quot;') + '"/></label>';
      block += '<label>Binding <select data-ui-node="' + node.id + '" data-ui-field="binding"><option value="">—</option>';
      var binds = (typeof UIRuntime !== 'undefined' && UIRuntime.BINDINGS) ? UIRuntime.BINDINGS : ['player.hp', 'player.gold', 'player.level', 'player.name'];
      binds.forEach(function (b) {
        block += '<option value="' + b + '"' + (node.binding === b ? ' selected' : '') + '>' + b + '</option>';
      });
      block += '</select></label>';
      ['x', 'y', 'w', 'h', 'z'].forEach(function (k) {
        block += '<label>' + k + ' <input type="number" step="0.01" data-ui-node="' + node.id + '" data-ui-field="transform.' + k + '" value="' + (t[k] != null ? t[k] : 0) + '"/></label> ';
      });
      block += '<label>Asset src <input type="text" data-ui-node="' + node.id + '" data-ui-field="assetSrc" value="' + String((node.asset && (node.asset.src || node.asset.ref)) || '').replace(/"/g, '&quot;') + '"/></label>';
      block += '<button type="button" class="btn btn-secondary btn-sm" data-ui-action="pickAsset" data-id="' + node.id + '">Выбрать asset…</button>';
      var steps = (node.events && Array.isArray(node.events.click)) ? node.events.click : [];
      var condRules = typeof Editor.extractConditionRules === 'function' ? Editor.extractConditionRules(node.showIf) : [];
      var condMode = uiConditionMode(node.showIf);
      block += '<h4>Когда доступно</h4><label>Режим <select data-ui-node="' + node.id + '" data-ui-field="condMode">';
      block += '<option value="all"' + (condMode === 'all' ? ' selected' : '') + '>Все условия выполнены</option>';
      block += '<option value="any"' + (condMode === 'any' ? ' selected' : '') + '>Хотя бы одно условие выполнено</option>';
      block += '</select></label>';
      condRules.forEach(function (rule, idx) {
        var cid = typeof Editor.ruleToCatalogId === 'function' ? Editor.ruleToCatalogId(rule) : '';
        var vals = typeof Editor.conditionValuesFromRule === 'function' ? Editor.conditionValuesFromRule(rule) : {};
        block += '<div class="ui-cond-step"><label>' + (idx + 1) + '. <select data-ui-node="' + node.id + '" data-ui-field="condType" data-cond-index="' + idx + '">';
        block += typeof Editor.buildConditionSelectHtml === 'function' ? Editor.buildConditionSelectHtml(cid) : '';
        block += '</select></label>';
        if (cid && typeof Editor.buildConditionParamFieldsHtml === 'function') {
          block += Editor.buildConditionParamFieldsHtml(cid, vals, { nodeId: node.id, data: Editor.data, index: idx });
        }
        block += '<button type="button" data-ui-action="condRemove" data-id="' + node.id + '" data-index="' + idx + '">Удалить</button></div>';
      });
      block += '<button type="button" data-ui-action="condAdd" data-id="' + node.id + '">+ Добавить условие</button>';
      block += '<h4>При нажатии</h4>';
      steps.forEach(function (step, idx) {
        var cur = step && step.action ? step.action : '';
        var params = (step && step.params) || {};
        block += '<div class="ui-click-step"><label>' + (idx + 1) + '. Действие <select data-ui-node="' + node.id + '" data-ui-field="clickActionAt" data-click-index="' + idx + '">';
        block += typeof Editor.buildActionSelectHtml === 'function' ? Editor.buildActionSelectHtml(cur) : '';
        block += '</select></label>';
        if (cur && typeof Editor.buildActionParamFieldsHtml === 'function') {
          block += Editor.buildActionParamFieldsHtml(cur, params, { nodeId: node.id, data: Editor.data, index: idx });
        }
        block += '<button type="button" data-ui-action="clickUp" data-id="' + node.id + '" data-index="' + idx + '">↑</button>';
        block += '<button type="button" data-ui-action="clickDown" data-id="' + node.id + '" data-index="' + idx + '">↓</button>';
        block += '<button type="button" data-ui-action="clickRemove" data-id="' + node.id + '" data-index="' + idx + '">Удалить</button></div>';
      });
      block += '<button type="button" data-ui-action="clickAdd" data-id="' + node.id + '">+ Добавить действие</button>';
      block += '<label>Готовое действие <select data-ui-node="' + node.id + '" data-ui-field="clickMacro"><option value="">…</option>';
      if (typeof Editor.getActionMacros === 'function') {
        Editor.getActionMacros().forEach(function (m) {
          block += '<option value="' + m.id + '">' + (m.label || m.id) + '</option>';
        });
      }
      block += '</select></label></div>';
      return block;
      })();
    }
    html += '</div>';
    host.innerHTML = html;
    paintViewportNodes();
    bindViewportEvents(document.getElementById('game-ui-viewport'));

    host.onclick = function (e) {
      var btn = e.target.closest('[data-ui-action]');
      if (!btn || !host.contains(btn)) return;
      var action = btn.getAttribute('data-ui-action');
      if (action === 'condAdd' && btn.getAttribute('data-id')) Editor.uiAddCondition(btn.getAttribute('data-id'), 'hasItem');
      if (action === 'condRemove') Editor.uiRemoveCondition(btn.getAttribute('data-id'), btn.getAttribute('data-index'));
      if (action === 'clickAdd' && btn.getAttribute('data-id')) Editor.uiAddClickAction(btn.getAttribute('data-id'), 'change_scene', {});
      if (action === 'clickRemove') Editor.uiRemoveClickAction(btn.getAttribute('data-id'), btn.getAttribute('data-index'));
      if (action === 'clickUp') Editor.uiMoveClickAction(btn.getAttribute('data-id'), btn.getAttribute('data-index'), -1);
      if (action === 'clickDown') Editor.uiMoveClickAction(btn.getAttribute('data-id'), btn.getAttribute('data-index'), 1);
      if (action === 'preset') Editor.uiApplyPreset(btn.getAttribute('data-preset'));
      if (action === 'addScreen') Editor.uiAddScreen();
      if (action === 'selectScreen') Editor.uiSelectScreen(btn.getAttribute('data-id'));
      if (action === 'selectNode') Editor.uiSelectNode(btn.getAttribute('data-id'));
      if (action === 'addNode') Editor.uiAddNode(btn.getAttribute('data-kind'));
      if (action === 'deleteNode') Editor.uiDeleteNode(btn.getAttribute('data-id'));
      if (action === 'pickAsset') Editor.uiPickAsset(btn.getAttribute('data-id'));
    };
    host.onchange = function (e) {
      var el = e.target;
      if (el.id === 'ui-snap-toggle') { var ge = document.getElementById('ui-snap-grid'); Editor.uiSetSnap(el.checked, parseFloat(ge && ge.value) || 0.05); return; }
      if (el.id === 'ui-snap-grid') { Editor.uiSetSnap(uiSnap.enabled, parseFloat(el.value) || 0.05); return; }
      if (el.matches('[data-ui-field="scope"]')) { Editor.uiUpdateNodeField(null, 'scope', el.value); return; }
      if (el.matches('[data-ui-field="screenSceneId"]')) { Editor.uiUpdateNodeField(null, 'screenSceneId', el.value); return; }
      var nodeId = el.getAttribute('data-ui-node') || el.getAttribute('data-node');
      var field = el.getAttribute('data-ui-field');
      var paramId = el.getAttribute('data-param-id');
      if (nodeId && paramId) {
        var cidx = el.getAttribute('data-click-index');
        var paramVal =
          typeof Editor.readActionParamInputValue === 'function'
            ? Editor.readActionParamInputValue(el)
            : (el.type === 'number' ? Number(el.value) : el.value);
        if (cidx != null && Editor.uiSetClickParamAt) {
          Editor.uiSetClickParamAt(nodeId, cidx, paramId, paramVal);
        } else {
          Editor.uiUpdateNodeField(nodeId, 'actionParam:' + paramId, paramVal);
        }
        return;
      }
      if (nodeId && field === 'condMode') {
        Editor.uiSetConditionMode(nodeId, el.value);
        return;
      }
      if (nodeId && field === 'condType') {
        Editor.uiSetConditionAt(nodeId, el.getAttribute('data-cond-index'), el.value);
        return;
      }
      if (nodeId && el.getAttribute('data-cond-param') && el.getAttribute('data-cond-index') != null) {
        Editor.uiSetConditionParamAt(nodeId, el.getAttribute('data-cond-index'), el.getAttribute('data-cond-param'), el.value);
        return;
      }
      if (nodeId && field === 'clickActionAt') {
        Editor.uiSetClickActionAt(nodeId, el.getAttribute('data-click-index'), el.value);
        return;
      }
      if (nodeId && field === 'clickMacro') {
        if (el.value) { Editor.uiApplyClickMacro(nodeId, el.value); el.value = ''; }
        return;
      }
      if (nodeId && field) Editor.uiUpdateNodeField(nodeId, field, el.type === 'number' ? Number(el.value) : el.value);
    };
  };

  if (Editor.hooks && typeof Editor.hooks.after === 'function') {
    Editor.hooks.after('switchTab', function (_r, args) {
      var tab = args && args[0];
      if (tab === 'game_ui' || tab === 'ui') Editor.renderGameUiEditor && Editor.renderGameUiEditor();
    });
  }

  Editor.openGameUiEditor = function () {
    if (typeof Editor.switchTab === 'function') Editor.switchTab('game_ui');
    else if (Editor.renderGameUiEditor) Editor.renderGameUiEditor();
  };

  if (Editor.commands && typeof Editor.commands.register === 'function') {
    try {
      Editor.commands.register({ id: 'open_game_ui', title: 'Игровой UI', category: 'Editor', action: function () { Editor.openGameUiEditor(); } });
    } catch (e) { /* optional */ }
  }

  Editor._gameUiGesture = gesture;
  Editor._uiSnap = uiSnap;
  Editor.uiApplyLiveTransform = applyLiveTransform;
  Editor.uiBeginGesture = beginGesture;
  Editor.uiEndGesture = endGesture;
})(typeof window !== 'undefined' ? window : globalThis);
