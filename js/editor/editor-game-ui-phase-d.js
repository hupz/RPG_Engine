/**
 * Phase D — UI Builder 2.0
 * Screen types, smart widgets, anchors, copy/paste, lock, zoom
 */
(function attachGameUiPhaseD() {
  'use strict';

  if (typeof Editor === 'undefined') return;

  const SCREEN_TYPES = (typeof ProjectSchema !== 'undefined' && ProjectSchema.UI_SCREEN_TYPES)
    ? ProjectSchema.UI_SCREEN_TYPES
    : ['hud', 'main_menu', 'journal', 'inventory', 'pause', 'dialogue', 'custom'];

  const ANCHORS = (typeof ProjectSchema !== 'undefined' && ProjectSchema.UI_ANCHORS)
    ? ProjectSchema.UI_ANCHORS
    : ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'];

  const WIDGETS = (typeof ProjectSchema !== 'undefined' && ProjectSchema.UI_SMART_WIDGETS)
    ? ProjectSchema.UI_SMART_WIDGETS
    : ['journal_button', 'inventory_button', 'icon_action', 'quest_tracker'];

  const WIDGET_LABELS = {
    journal_button: '📜 Кнопка журнала',
    inventory_button: '🎒 Кнопка инвентаря',
    icon_action: '🖼 Иконка + действие',
    quest_tracker: '📋 Трекер квеста'
  };

  const pd = { zoom: 1, clipboard: null };

  function selectedScreenId() {
    return Editor._uiSelectedScreen || null;
  }

  function getScreen() {
    const sid = selectedScreenId();
    return sid && Editor.data?.ui?.screens?.[sid] ? Editor.data.ui.screens[sid] : null;
  }

  function findNode(nodeId) {
    const sc = getScreen();
    if (!sc?.nodes) return null;
    return sc.nodes.find(function (n) { return n.id === nodeId; }) || null;
  }

  function withUiHistory(label, fn) {
    if (typeof Editor.uiAddNode !== 'function') return;
    const before = JSON.stringify(Editor.data.ui || {});
    fn();
    const after = JSON.stringify(Editor.data.ui || {});
    if (before === after) return;
    if (Editor.history?.recordMutation) {
      Editor.history.recordMutation({
        label: label || 'UI Phase D',
        undo: function () { Editor.data.ui = JSON.parse(before); Editor.renderGameUiEditor?.(); },
        redo: function () { Editor.data.ui = JSON.parse(after); Editor.renderGameUiEditor?.(); }
      });
    }
    Editor.markDirty?.();
  }

  Object.assign(Editor, {
    _uiPhaseD: pd,

    uiSetScreenType(screenId, screenType) {
      withUiHistory('UI: screen type', function () {
        const sc = Editor.data?.ui?.screens?.[screenId || selectedScreenId()];
        if (!sc) return;
        sc.screenType = SCREEN_TYPES.indexOf(screenType) >= 0 ? screenType : 'custom';
      });
      Editor.renderGameUiEditor?.();
    },

    uiAddSmartWidget(widgetId) {
      if (WIDGETS.indexOf(widgetId) < 0) return;
      if (!selectedScreenId() && Editor.uiAddScreen) Editor.uiAddScreen('icon_hud');
      const screenId = selectedScreenId();
      withUiHistory('UI: widget ' + widgetId, function () {
        const sc = Editor.data.ui.screens[screenId];
        if (!sc.nodes) sc.nodes = [];
        const id = widgetId + '_' + Date.now().toString(36);
        let node = {
          id: id,
          kind: widgetId.indexOf('button') >= 0 ? 'button' : (widgetId === 'icon_action' ? 'image' : 'text'),
          transform: { x: 0.8, y: 0.05, w: 0.1, h: 0.08, z: sc.nodes.length + 1 },
          visible: true,
          enabled: true,
          props: { widget: widgetId, layout: { anchor: 'top-right', marginX: 0.02, marginY: 0.02 } },
          events: { click: [] }
        };
        if (typeof ProjectSchema !== 'undefined' && ProjectSchema.applySmartWidgetDefaults) {
          node = ProjectSchema.applySmartWidgetDefaults(node);
        } else if (widgetId === 'journal_button') {
          node.text = 'Журнал';
          node.events.click = [{ action: 'open_panel', params: { panel: 'journal' } }];
        } else if (widgetId === 'inventory_button') {
          node.text = 'Инвентарь';
          node.events.click = [{ action: 'open_panel', params: { panel: 'inventory' } }];
        } else if (widgetId === 'quest_tracker') {
          node.text = '📜 {questTitle}';
          node.binding = 'quest.activeTitle';
        }
        sc.nodes.push(node);
        Editor._uiSelectedNode = id;
      });
      Editor.renderGameUiEditor?.();
    },

    uiSetNodeAnchor(nodeId, anchor, marginX, marginY) {
      withUiHistory('UI: anchor', function () {
        const node = findNode(nodeId);
        if (!node) return;
        if (!node.props) node.props = {};
        if (!anchor || anchor === 'none') {
          delete node.props.layout;
          return;
        }
        node.props.layout = {
          anchor: ANCHORS.indexOf(anchor) >= 0 ? anchor : 'top-left',
          marginX: Number(marginX) || node.transform?.x || 0,
          marginY: Number(marginY) || node.transform?.y || 0
        };
      });
      Editor.renderGameUiEditor?.();
    },

    uiToggleUiLock(nodeId) {
      withUiHistory('UI: lock', function () {
        const node = findNode(nodeId);
        if (node) node.locked = !node.locked;
      });
      Editor.renderGameUiEditor?.();
    },

    uiCopySelectedNodes() {
      const nid = Editor._uiSelectedNode;
      if (!nid) return;
      const node = findNode(nid);
      if (!node) return;
      pd.clipboard = [JSON.parse(JSON.stringify(node))];
      Editor.toast?.success('UI: скопировано');
    },

    uiPasteNodes() {
      if (!pd.clipboard?.length) return;
      const screenId = selectedScreenId();
      if (!screenId) return;
      withUiHistory('UI: paste', function () {
        const sc = Editor.data.ui.screens[screenId];
        pd.clipboard.forEach(function (src, i) {
          const copy = JSON.parse(JSON.stringify(src));
          copy.id = (copy.kind || 'ui') + '_' + Date.now().toString(36) + '_' + i;
          if (copy.transform) {
            copy.transform.x = Math.min(0.92, (copy.transform.x || 0) + 0.02);
            copy.transform.y = Math.min(0.92, (copy.transform.y || 0) + 0.02);
          }
          sc.nodes.push(copy);
          Editor._uiSelectedNode = copy.id;
        });
      });
      Editor.renderGameUiEditor?.();
    },

    uiSetViewportZoom(z) {
      pd.zoom = Math.max(0.25, Math.min(3, Number(z) || 1));
      Editor.renderGameUiEditor?.();
    }
  });

  function enhanceAfterRender() {
    const host = document.getElementById('game-ui-editor-root');
    if (!host) return;
    const sc = getScreen();

    let bar = host.querySelector('#ui-phase-d-toolbar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'ui-phase-d-toolbar';
      bar.className = 'form-row';
      bar.style.cssText = 'flex-wrap:wrap;gap:6px;margin:8px 0;align-items:center;';
      const vp = host.querySelector('#game-ui-viewport');
      if (vp) vp.parentNode.insertBefore(bar, vp);
      else host.querySelector('.game-ui-editor')?.appendChild(bar);
    }

    bar.innerHTML =
      '<label>Zoom <input type="range" id="ui-zoom-range" min="0.25" max="3" step="0.05" value="' + pd.zoom + '" style="width:90px"></label> ' +
      '<button type="button" class="btn btn-secondary btn-sm" data-ui-pd="copy">Копировать</button> ' +
      '<button type="button" class="btn btn-secondary btn-sm" data-ui-pd="paste">Вставить</button> ' +
      '<span class="hint">Smart:</span> ' +
      WIDGETS.map(function (w) {
        return '<button type="button" class="btn btn-secondary btn-sm" data-ui-pd="widget" data-widget="' + w + '">' + (WIDGET_LABELS[w] || w) + '</button>';
      }).join(' ');

    if (sc && !host.querySelector('[data-ui-field="screenType"]')) {
      const hier = host.querySelector('.ui-hierarchy');
      if (hier) {
        const typeRow = document.createElement('div');
        typeRow.className = 'form-group';
        typeRow.innerHTML = '<label>Тип экрана <select data-ui-field="screenType">' +
          SCREEN_TYPES.map(function (t) {
            return '<option value="' + t + '"' + ((sc.screenType || 'custom') === t ? ' selected' : '') + '>' + t + '</option>';
          }).join('') + '</select></label>';
        hier.after(typeRow);
      }
    }

    const node = Editor._uiSelectedNode ? findNode(Editor._uiSelectedNode) : null;
    const insp = host.querySelector('.ui-inspector');
    if (node && insp && !insp.querySelector('#ui-phase-d-anchor')) {
      const layout = node.props?.layout || {};
      const extra = document.createElement('div');
      extra.id = 'ui-phase-d-anchor';
      extra.innerHTML =
        '<h4>Якорь (responsive)</h4>' +
        '<label>Anchor <select data-ui-pd-field="anchor" data-node="' + node.id + '">' +
        '<option value="none"' + (!layout.anchor ? ' selected' : '') + '>— абсолютный —</option>' +
        ANCHORS.map(function (a) {
          return '<option value="' + a + '"' + (layout.anchor === a ? ' selected' : '') + '>' + a + '</option>';
        }).join('') + '</select></label> ' +
        '<label>marginX <input type="number" step="0.01" data-ui-pd-field="marginX" data-node="' + node.id + '" value="' + (layout.marginX != null ? layout.marginX : (node.transform?.x || 0)) + '" style="width:4em"></label> ' +
        '<label>marginY <input type="number" step="0.01" data-ui-pd-field="marginY" data-node="' + node.id + '" value="' + (layout.marginY != null ? layout.marginY : (node.transform?.y || 0)) + '" style="width:4em"></label> ' +
        '<button type="button" class="btn btn-secondary btn-sm" data-ui-pd="lock" data-id="' + node.id + '">' + (node.locked ? '🔒' : '🔓') + '</button>' +
        (node.props?.widget ? '<p class="hint">Widget: ' + node.props.widget + '</p>' : '');

      const clickHdr = insp.querySelector('h4');
      if (clickHdr) insp.insertBefore(extra, clickHdr);
      else insp.appendChild(extra);
    }

    const vp = host.querySelector('#game-ui-viewport');
    if (vp) {
      vp.style.transformOrigin = 'center center';
      vp.style.transform = 'scale(' + pd.zoom + ')';
      vp.style.overflow = pd.zoom > 1 ? 'auto' : 'hidden';
    }

    host.querySelectorAll('.ui-nodes li button[data-ui-action="selectNode"]').forEach(function (btn) {
      const id = btn.getAttribute('data-id');
      const n = findNode(id);
      if (n?.locked) btn.textContent = '🔒 ' + btn.textContent;
    });

    if (!host._uiPhaseDBound) {
      host._uiPhaseDBound = true;
      host.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-ui-pd]');
        if (!btn || !host.contains(btn)) return;
        const act = btn.getAttribute('data-ui-pd');
        if (act === 'copy') Editor.uiCopySelectedNodes();
        if (act === 'paste') Editor.uiPasteNodes();
        if (act === 'lock') Editor.uiToggleUiLock(btn.getAttribute('data-id'));
        if (act === 'widget') Editor.uiAddSmartWidget(btn.getAttribute('data-widget'));
      });
      host.addEventListener('change', function (e) {
        const el = e.target;
        if (el.id === 'ui-zoom-range') { Editor.uiSetViewportZoom(el.value); return; }
        if (el.matches('[data-ui-field="screenType"]')) {
          Editor.uiSetScreenType(selectedScreenId(), el.value);
          return;
        }
        const field = el.getAttribute('data-ui-pd-field');
        const nodeId = el.getAttribute('data-node');
        if (field && nodeId) {
          const node = findNode(nodeId);
          const layout = node?.props?.layout || {};
          Editor.uiSetNodeAnchor(
            nodeId,
            field === 'anchor' ? el.value : (layout.anchor || 'top-left'),
            field === 'marginX' ? el.value : layout.marginX,
            field === 'marginY' ? el.value : layout.marginY
          );
        }
      });
    }
  }

  if (Editor.hooks?.after) {
    Editor.hooks.after('renderGameUiEditor', function () {
      try { enhanceAfterRender(); } catch (e) { console.warn('[ui-phase-d]', e); }
    }, 'editor-game-ui-phase-d');
  }

  if (Editor.hooks?.before && Editor.uiApplyLiveTransform) {
    Editor.hooks.before('uiApplyLiveTransform', function (args) {
      const nodeId = args[0];
      const node = findNode(nodeId);
      if (node?.locked) return null;
      return args;
    }, 'editor-game-ui-phase-d-lock');
  }
})();
