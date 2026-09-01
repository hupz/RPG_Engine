/**
 * Phase C — Visual Scene Editor 2.0
 * Zoom, multi-select, copy/paste, lock, hotspot shapes, hover inspector, alignment guides
 */
(function attachVisualScenePhaseC() {
  'use strict';

  if (typeof Editor === 'undefined') return;

  const SHAPES = (typeof ProjectSchema !== 'undefined' && ProjectSchema.HOTSPOT_SHAPES)
    ? ProjectSchema.HOTSPOT_SHAPES
    : ['rect', 'circle', 'polygon'];

  const pc = {
    zoom: 1,
    drawShape: 'rect',
    clipboard: null,
    selectedIds: [],
    polygonDraft: null,
    alignGuides: true
  };

  function clampZoom(z) {
    const v = Number(z);
    if (!Number.isFinite(v)) return 1;
    return Math.max(0.25, Math.min(3, v));
  }

  function getIds() {
    if (pc.selectedIds.length) return pc.selectedIds.slice();
    return Editor._visualSelectedNodeId ? [Editor._visualSelectedNodeId] : [];
  }

  function setIds(ids) {
    pc.selectedIds = (ids || []).filter(Boolean);
    Editor._visualSelectedNodeId = pc.selectedIds[0] || null;
  }

  function sceneNodes() {
    const id = Editor.currentScene;
    const scene = id && Editor.data?.scenes?.[id];
    return scene?.visual?.nodes || [];
  }

  function findNode(nodeId) {
    return sceneNodes().find((n) => n.id === nodeId) || null;
  }

  function rectToPolygonPoints(node) {
    const t = node.transform || {};
    const x = t.x || 0;
    const y = t.y || 0;
    const w = t.w || 0.1;
    const h = t.h || 0.1;
    return [
      { x: x, y: y },
      { x: x + w, y: y },
      { x: x + w, y: y + h },
      { x: x, y: y + h }
    ];
  }

  function applyShapeStyle(el, node) {
    if (!el || !node || node.kind !== 'hotspot') return;
    const shape = node.props?.shape || 'rect';
    el.style.borderRadius = shape === 'circle' ? '50%' : '';
    el.style.clipPath = '';
    if (shape === 'polygon' && Array.isArray(node.props?.points) && node.props.points.length >= 3) {
      const t = node.transform || {};
      const pts = node.props.points.map((p) => {
        const lx = ((p.x - (t.x || 0)) / Math.max(t.w || 0.01, 0.01)) * 100;
        const ly = ((p.y - (t.y || 0)) / Math.max(t.h || 0.01, 0.01)) * 100;
        return lx + '% ' + ly + '%';
      });
      el.style.clipPath = 'polygon(' + pts.join(', ') + ')';
    }
  }

  Object.assign(Editor, {
    _visualPhaseC: pc,

    visualGetSelectedIds() {
      return getIds();
    },

    visualSetZoom(z) {
      pc.zoom = clampZoom(z);
      Editor.renderVisualScenePanel?.();
    },

    visualZoomBy(delta) {
      Editor.visualSetZoom(pc.zoom + delta);
    },

    visualFitToScreen() {
      pc.zoom = 1;
      Editor.renderVisualScenePanel?.();
    },

    visualSetDrawShape(shape) {
      pc.drawShape = SHAPES.indexOf(shape) >= 0 ? shape : 'rect';
      if (pc.drawShape === 'polygon') pc.polygonDraft = [];
      else pc.polygonDraft = null;
      Editor.renderVisualScenePanel?.();
    },

    visualToggleLock(nodeId) {
      const node = findNode(nodeId);
      if (!node) return;
      node.locked = !node.locked;
      Editor.markDirty?.();
      Editor.renderVisualScenePanel?.();
    },

    visualCopySelected() {
      const ids = getIds();
      if (!ids.length) return;
      const nodes = sceneNodes().filter((n) => ids.indexOf(n.id) >= 0);
      pc.clipboard = JSON.parse(JSON.stringify(nodes));
      if (Editor.toast) Editor.toast.success('Скопировано: ' + nodes.length);
    },

    visualPasteNodes() {
      if (!pc.clipboard || !pc.clipboard.length) return;
      const scene = Editor.currentScene && Editor.data?.scenes?.[Editor.currentScene];
      if (!scene) return;
      if (!scene.visual) scene.visual = { mode: 'overlay', nodes: [] };
      if (!Array.isArray(scene.visual.nodes)) scene.visual.nodes = [];
      const pasted = [];
      pc.clipboard.forEach((src, i) => {
        const copy = JSON.parse(JSON.stringify(src));
        copy.id = (copy.kind || 'node') + '_' + Date.now().toString(36) + '_' + i;
        if (copy.transform) {
          copy.transform.x = Math.min(0.95, (copy.transform.x || 0) + 0.02);
          copy.transform.y = Math.min(0.95, (copy.transform.y || 0) + 0.02);
        }
        scene.visual.nodes.push(copy);
        pasted.push(copy.id);
      });
      scene.visual.mode = 'overlay';
      setIds(pasted);
      Editor.markDirty?.();
      Editor.renderVisualScenePanel?.();
      if (Editor.toast) Editor.toast.success('Вставлено: ' + pasted.length);
    },

    visualSetNodeShape(nodeId, shape) {
      const node = findNode(nodeId);
      if (!node || node.kind !== 'hotspot') return;
      if (!node.props) node.props = {};
      node.props.shape = SHAPES.indexOf(shape) >= 0 ? shape : 'rect';
      if (node.props.shape === 'polygon' && (!node.props.points || node.props.points.length < 3)) {
        node.props.points = rectToPolygonPoints(node);
      }
      Editor.markDirty?.();
      Editor.renderVisualScenePanel?.();
    },

    visualFinishPolygonDraft() {
      const scene = Editor.currentScene && Editor.data?.scenes?.[Editor.currentScene];
      if (!scene || !pc.polygonDraft || pc.polygonDraft.length < 3) return;
      const pts = pc.polygonDraft.slice();
      let minX = 1;
      let minY = 1;
      let maxX = 0;
      let maxY = 0;
      pts.forEach((p) => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      });
      const w = Math.max(0.02, maxX - minX);
      const h = Math.max(0.02, maxY - minY);
      const node = {
        id: 'hotspot_' + Date.now().toString(36),
        kind: 'hotspot',
        layer: 'world',
        transform: { x: minX, y: minY, w: w, h: h, z: (scene.visual?.nodes?.length || 0) + 1 },
        visible: true,
        enabled: true,
        props: { label: 'Polygon', shape: 'polygon', points: pts },
        events: { click: [] }
      };
      if (!scene.visual) scene.visual = { mode: 'overlay', nodes: [] };
      scene.visual.nodes.push(node);
      scene.visual.mode = 'overlay';
      pc.polygonDraft = [];
      setIds([node.id]);
      Editor.markDirty?.();
      Editor.renderVisualScenePanel?.();
    }
  });

  // Hover action helpers (mirror click API)
  function ensureEventList(node, key) {
    if (!node.events) node.events = {};
    if (!Array.isArray(node.events[key])) node.events[key] = [];
    return node.events[key];
  }

  Editor.visualAddHoverAction = function (nodeId, actionId, params) {
    const node = findNode(nodeId);
    if (!node) return;
    const list = ensureEventList(node, 'hover');
    const key = actionId || 'say';
    const p = typeof Editor.buildActionParamsObject === 'function'
      ? Editor.buildActionParamsObject(key, params || {})
      : params || {};
    list.push({ action: key, params: p });
    Editor.markDirty?.();
    Editor.renderVisualScenePanel?.();
  };

  Editor.visualRemoveHoverAction = function (nodeId, index) {
    const node = findNode(nodeId);
    if (!node) return;
    const list = ensureEventList(node, 'hover');
    const i = Number(index);
    if (i >= 0 && i < list.length) list.splice(i, 1);
    Editor.markDirty?.();
    Editor.renderVisualScenePanel?.();
  };

  Editor.visualClearHover = function (nodeId) {
    const node = findNode(nodeId);
    if (!node) return;
    if (!node.events) node.events = {};
    node.events.hover = [];
    Editor.markDirty?.();
    Editor.renderVisualScenePanel?.();
  };

  Editor.visualUpdateNodeProp = function (nodeId, prop, value) {
    const node = findNode(nodeId);
    if (!node) return;
    if (!node.props) node.props = {};
    if (prop === 'locked') {
      node.locked = !!value;
    } else {
      node.props[prop] = value;
    }
    Editor.markDirty?.();
    Editor.renderVisualScenePanel?.();
  };

  function injectToolbar(host) {
    let bar = host.querySelector('#visual-phase-c-toolbar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'visual-phase-c-toolbar';
      bar.className = 'form-group form-row';
      bar.style.cssText = 'flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0;';
      const vp = host.querySelector('#visual-viewport');
      if (vp) vp.parentNode.insertBefore(bar, vp);
    }
    bar.innerHTML =
      '<label>Масштаб <input type="range" id="visual-zoom-range" min="0.25" max="3" step="0.05" value="' + pc.zoom + '" style="width:100px;vertical-align:middle">' +
      ' <span id="visual-zoom-label">' + Math.round(pc.zoom * 100) + '%</span></label> ' +
      '<button type="button" class="btn btn-secondary" data-pc-action="zoom-out">−</button> ' +
      '<button type="button" class="btn btn-secondary" data-pc-action="zoom-in">+</button> ' +
      '<button type="button" class="btn btn-secondary" data-pc-action="fit">По размеру</button> ' +
      '<button type="button" class="btn btn-secondary" data-pc-action="copy">Копировать</button> ' +
      '<button type="button" class="btn btn-secondary" data-pc-action="paste">Вставить</button> ' +
      '<label>Форма hotspot <select id="visual-draw-shape">' +
      SHAPES.map((s) => '<option value="' + s + '"' + (pc.drawShape === s ? ' selected' : '') + '>' + s + '</option>').join('') +
      '</select></label>' +
      (pc.drawShape === 'polygon' && pc.polygonDraft && pc.polygonDraft.length
        ? ' <button type="button" class="btn btn-primary" data-pc-action="finish-polygon">Завершить полигон (' + pc.polygonDraft.length + ')</button>'
        : '');
  }

  function applyZoom(host) {
    const wrap = host.querySelector('#visual-vp-nodes');
    const vp = host.querySelector('#visual-viewport');
    if (wrap) {
      wrap.style.transformOrigin = 'center center';
      wrap.style.transform = 'scale(' + pc.zoom + ')';
    }
    if (vp) vp.style.overflow = pc.zoom > 1 ? 'auto' : 'hidden';
  }

  function enhanceHierarchy(host) {
    host.querySelectorAll('.visual-node-row').forEach((row) => {
      const id = row.getAttribute('data-node-id');
      const node = findNode(id);
      if (!node || row.querySelector('[data-pc-action="lock"]')) return;
      const lockBtn = document.createElement('button');
      lockBtn.type = 'button';
      lockBtn.className = 'btn btn-secondary';
      lockBtn.setAttribute('data-pc-action', 'lock');
      lockBtn.setAttribute('data-id', id);
      lockBtn.textContent = node.locked ? '🔒' : '🔓';
      lockBtn.title = node.locked ? 'Разблокировать' : 'Заблокировать';
      const del = row.querySelector('[data-action="delete"]');
      if (del) row.insertBefore(lockBtn, del);
    });
  }

  function enhanceInspector(host) {
    const insp = host.querySelector('.visual-inspector');
    const selId = Editor._visualSelectedNodeId;
    const node = selId ? findNode(selId) : null;
    if (!insp || !node || insp.querySelector('#visual-phase-c-extra')) return;

    const shapeOpts = SHAPES.map((s) =>
      '<option value="' + s + '"' + ((node.props?.shape || 'rect') === s ? ' selected' : '') + '>' + s + '</option>'
    ).join('');

    const hoverSteps = Array.isArray(node.events?.hover) ? node.events.hover : [];
    let hoverCards = '';
    hoverSteps.forEach((step, idx) => {
      const act = step?.action || '';
      const actionOpts = typeof Editor.buildActionSelectHtml === 'function'
        ? Editor.buildActionSelectHtml(act)
        : '<option value="say">Реплика</option>';
      hoverCards +=
        '<div class="visual-hover-step"><div class="form-group"><label>' + (idx + 1) + '. Hover</label>' +
        '<select data-pc-field="hoverAction" data-node="' + selId + '" data-hover-index="' + idx + '">' + actionOpts + '</select></div>' +
        '<button type="button" class="btn btn-danger" data-pc-action="hoverRemove" data-id="' + selId + '" data-index="' + idx + '">×</button></div>';
    });

    const extra = document.createElement('div');
    extra.id = 'visual-phase-c-extra';
    extra.innerHTML =
      (node.kind === 'hotspot'
        ? '<div class="form-group"><label>Форма области</label><select data-pc-field="shape" data-node="' + selId + '">' + shapeOpts + '</select></div>'
        : '') +
      '<div class="form-group"><label>Подсказка (tooltip)</label><input type="text" data-pc-field="tooltip" data-node="' + selId + '" value="' +
      String(node.props?.tooltip || '').replace(/"/g, '&quot;') + '"></div>' +
      '<div class="form-group"><label>Курсор</label><select data-pc-field="cursor" data-node="' + selId + '">' +
      ['', 'pointer', 'grab', 'help', 'crosshair'].map((c) =>
        '<option value="' + c + '"' + ((node.props?.cursor || '') === c ? ' selected' : '') + '>' + (c || 'auto') + '</option>'
      ).join('') + '</select></div>' +
      '<div class="form-group"><label><input type="checkbox" data-pc-field="highlight" data-node="' + selId + '"' +
      (node.props?.highlight ? ' checked' : '') + '> Подсветка при наведении</label></div>' +
      '<h4>При наведении (hover)</h4>' + (hoverCards || '<p class="hint">Нет действий</p>') +
      '<button type="button" class="btn btn-secondary" data-pc-action="hoverAdd" data-id="' + selId + '">+ Hover действие</button>';

    const clickHdr = insp.querySelector('h4');
    const headers = insp.querySelectorAll('h4');
    let clickSection = null;
    headers.forEach((h) => { if (h.textContent.indexOf('нажатии') >= 0) clickSection = h; });
    if (clickSection) insp.insertBefore(extra, clickSection);
    else insp.appendChild(extra);
  }

  function enhanceNodeDom(host) {
    host.querySelectorAll('.visual-vp-node').forEach((el) => {
      const id = el.getAttribute('data-node-id');
      const node = findNode(id);
      if (!node) return;
      applyShapeStyle(el, node);
      if (node.locked) el.style.opacity = '0.55';
      const ids = getIds();
      el.classList.toggle('is-selected', ids.indexOf(id) >= 0);
      el.classList.toggle('is-multi', ids.length > 1 && ids.indexOf(id) >= 0);
    });
  }

  function bindPhaseCPanel(host) {
    if (host._phaseCBound) return;
    host._phaseCBound = true;

    host.addEventListener('click', function (ev) {
      const btn = ev.target.closest?.('[data-pc-action]');
      if (!btn || !host.contains(btn)) return;
      const act = btn.getAttribute('data-pc-action');
      const id = btn.getAttribute('data-id');
      if (act === 'zoom-in') Editor.visualZoomBy(0.1);
      else if (act === 'zoom-out') Editor.visualZoomBy(-0.1);
      else if (act === 'fit') Editor.visualFitToScreen();
      else if (act === 'copy') Editor.visualCopySelected();
      else if (act === 'paste') Editor.visualPasteNodes();
      else if (act === 'lock') Editor.visualToggleLock(id);
      else if (act === 'finish-polygon') Editor.visualFinishPolygonDraft();
      else if (act === 'hoverAdd') Editor.visualAddHoverAction(id, 'say', { text: '…' });
      else if (act === 'hoverRemove') Editor.visualRemoveHoverAction(id, btn.getAttribute('data-index'));
    });

    host.addEventListener('change', function (ev) {
      const el = ev.target;
      if (!host.contains(el)) return;
      if (el.id === 'visual-zoom-range') {
        Editor.visualSetZoom(el.value);
        return;
      }
      if (el.id === 'visual-draw-shape') {
        Editor.visualSetDrawShape(el.value);
        return;
      }
      const field = el.getAttribute('data-pc-field');
      const nodeId = el.getAttribute('data-node');
      if (!field || !nodeId) return;
      if (field === 'shape') Editor.visualSetNodeShape(nodeId, el.value);
      else if (field === 'highlight') Editor.visualUpdateNodeProp(nodeId, 'highlight', el.checked);
      else if (field === 'hoverAction') {
        const idx = el.getAttribute('data-hover-index');
        const node = findNode(nodeId);
        if (node?.events?.hover?.[idx]) {
          node.events.hover[idx].action = el.value;
          Editor.markDirty?.();
        }
      } else Editor.visualUpdateNodeProp(nodeId, field, el.value);
    });

    host.addEventListener('keydown', function (ev) {
      if (!host.contains(document.activeElement) && document.activeElement !== document.body) return;
      if ((ev.ctrlKey || ev.metaKey) && ev.key === 'c') {
        ev.preventDefault();
        Editor.visualCopySelected();
      }
      if ((ev.ctrlKey || ev.metaKey) && ev.key === 'v') {
        ev.preventDefault();
        Editor.visualPasteNodes();
      }
    });
  }

  function bindPhaseCViewport(host) {
    const viewport = host.querySelector('#visual-viewport');
    if (!viewport || viewport._phaseCExtBound) return;
    viewport._phaseCExtBound = true;

    viewport.addEventListener('wheel', function (ev) {
      if (!ev.ctrlKey) return;
      ev.preventDefault();
      Editor.visualZoomBy(ev.deltaY > 0 ? -0.05 : 0.05);
    }, { passive: false });

    viewport.addEventListener('pointerdown', function (ev) {
      const nodeEl = ev.target.closest?.('.visual-vp-node');
      if (!nodeEl) return;
      const id = nodeEl.getAttribute('data-node-id');
      const node = findNode(id);
      if (node?.locked) {
        ev.stopImmediatePropagation();
        return;
      }
      if (ev.shiftKey) {
        const ids = getIds();
        const i = ids.indexOf(id);
        if (i >= 0) ids.splice(i, 1);
        else ids.push(id);
        setIds(ids);
        Editor.visualSyncSelectionUi?.();
        ev.stopPropagation();
      }
    }, true);

    viewport.addEventListener('pointerdown', function (ev) {
      if (!document.getElementById('visual-draw-mode')?.checked) return;
      if (pc.drawShape !== 'polygon') return;
      if (ev.target.closest?.('.visual-vp-node')) return;
      const rect = viewport.getBoundingClientRect();
      if (!rect.width) return;
      const nx = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      const ny = Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height));
      if (!pc.polygonDraft) pc.polygonDraft = [];
      pc.polygonDraft.push({ x: nx, y: ny });
      Editor.renderVisualScenePanel?.();
      ev.stopPropagation();
    }, true);
  }

  function patchDrawHotspotShape(host) {
    const drawCb = host.querySelector('#visual-draw-mode');
    if (!drawCb || drawCb._shapePatched) return;
    drawCb._shapePatched = true;
    drawCb.addEventListener('change', function () {
      if (drawCb.checked && pc.drawShape === 'polygon') pc.polygonDraft = [];
    });
  }

  function enhanceAfterRender() {
    const host = document.getElementById('visual-scene-editor-panel');
    if (!host) return;
    injectToolbar(host);
    applyZoom(host);
    enhanceHierarchy(host);
    enhanceInspector(host);
    enhanceNodeDom(host);
    bindPhaseCPanel(host);
    bindPhaseCViewport(host);
    patchDrawHotspotShape(host);
  }

  // Patch new hotspot shape when drawn (rect/circle)
  if (Editor.hooks?.after) {
    Editor.hooks.after('renderVisualScenePanel', function () {
      try {
        enhanceAfterRender();
        const scene = Editor.currentScene && Editor.data?.scenes?.[Editor.currentScene];
        const nodes = scene?.visual?.nodes || [];
        nodes.forEach((n) => {
          if (n.kind === 'hotspot' && n._phaseCNewDraw) {
            if (!n.props) n.props = {};
            n.props.shape = pc.drawShape === 'polygon' ? 'rect' : pc.drawShape;
            if (n.props.shape === 'circle') {
              const t = n.transform;
              const s = Math.min(t.w, t.h);
              t.w = s;
              t.h = s;
            }
            delete n._phaseCNewDraw;
          }
        });
      } catch (e) {
        console.warn('[phase-c]', e);
      }
    }, 'editor-visual-scene-phase-c');
  }

  // Mark freshly drawn hotspots for shape assignment
  if (Editor.hooks?.before) {
    Editor.hooks.before('visualApplyTransformLive', function (args) {
      const nodeId = args[0];
      const node = findNode(nodeId);
      if (node && node.kind === 'hotspot' && document.getElementById('visual-draw-mode')?.checked) {
        node._phaseCNewDraw = true;
      }
      return args;
    }, 'editor-visual-scene-phase-c');
  }

  // Block transform on locked nodes — handled in visualApplyTransformLive

  // Alignment guides during drag
  if (Editor.hooks?.before) {
    Editor.hooks.before('visualApplyTransformLive', function (args) {
      if (!pc.alignGuides) return args;
      const nodeId = args[0];
      const t = args[1];
      if (!t || t.x == null) return args;
      const others = sceneNodes().filter((n) => n.id !== nodeId && !n.locked);
      const threshold = 0.012;
      others.forEach((n) => {
        const ot = n.transform || {};
        const edges = [ot.x, ot.y, (ot.x || 0) + (ot.w || 0), (ot.y || 0) + (ot.h || 0)];
        const cx = (ot.x || 0) + (ot.w || 0) / 2;
        const cy = (ot.y || 0) + (ot.h || 0) / 2;
        [
          [t.x, edges[0]], [t.x, edges[2]], [t.x + (t.w || 0), edges[0]], [t.x + (t.w || 0), edges[2]],
          [t.y, edges[1]], [t.y, edges[3]], [t.y + (t.h || 0), edges[1]], [t.y + (t.h || 0), edges[3]],
          [t.x + (t.w || 0) / 2, cx], [t.y + (t.h || 0) / 2, cy]
        ].forEach(([val, target]) => {
          if (Math.abs(val - target) < threshold) {
            if (val === t.x || val === t.x + (t.w || 0) || val === t.x + (t.w || 0) / 2) {
              const delta = target - val;
              t.x = (t.x || 0) + delta;
            } else {
              const delta = target - val;
              t.y = (t.y || 0) + delta;
            }
          }
        });
      });
      return args;
    }, 'editor-visual-scene-phase-c-align');
  }

  // Extend visualSelectNode for multi
  if (Editor.hooks?.after) {
    Editor.hooks.after('visualSelectNode', function (_r, args) {
      if (!args || !args[0]) {
        pc.selectedIds = [];
        return;
      }
      if (!pc.selectedIds.length || pc.selectedIds.indexOf(args[0]) < 0) {
        pc.selectedIds = [args[0]];
      }
    }, 'editor-visual-scene-phase-c');
  }
})();
