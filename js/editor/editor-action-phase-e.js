/**
 * Phase E — Unified Action Picker + scene enter events editor
 */
(function attachActionPhaseE() {
  'use strict';

  if (typeof Editor === 'undefined') return;

  const EVENT_LABELS = {
    click: 'При нажатии',
    hover: 'При наведении',
    enter: 'При входе / показе',
    show: 'При показе экрана',
    exit: 'При выходе'
  };

  function esc(s) {
    return typeof Editor.escapeHtml === 'function'
      ? Editor.escapeHtml(String(s == null ? '' : s))
      : String(s == null ? '' : s);
  }

  function escAttr(s) {
    return typeof Editor.escapeAttr === 'function'
      ? Editor.escapeAttr(String(s == null ? '' : s))
      : esc(s);
  }

  function ensureSceneEvents(scene) {
    if (!scene.events || typeof scene.events !== 'object') scene.events = {};
    if (!Array.isArray(scene.events.enter)) scene.events.enter = [];
    return scene.events;
  }

  /**
   * Unified modal action picker for visual / UI / scene authoring.
   * @param {{ title?, onSelect(step), actionId?, params? }} opts
   */
  Editor.openUnifiedActionPicker = function openUnifiedActionPicker(opts) {
    opts = opts || {};
    if (typeof document === 'undefined') return;
    const existing = document.getElementById('unified-action-picker-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'unified-action-picker-overlay';
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:10050;display:flex;align-items:center;justify-content:center;';

    const box = document.createElement('div');
    box.style.cssText =
      'background:#1e1e28;color:#eee;padding:16px 20px;border-radius:10px;min-width:320px;max-width:520px;max-height:80vh;overflow:auto;';

    const actionId = opts.actionId || '';
    const params = opts.params || {};
    const actionOpts = typeof Editor.buildActionSelectHtml === 'function'
      ? Editor.buildActionSelectHtml(actionId)
      : '<option value="change_scene">Открыть сцену</option>';

    box.innerHTML =
      '<h3 style="margin-top:0">' + esc(opts.title || 'Выбор действия') + '</h3>' +
      '<div class="form-group"><label>Действие</label><select id="uap-action">' + actionOpts + '</select></div>' +
      '<div id="uap-params"></div>' +
      '<div style="margin-top:12px"><button type="button" class="btn btn-primary" id="uap-ok">Применить</button> ' +
      '<button type="button" class="btn btn-secondary" id="uap-cancel">Отмена</button></div>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const sel = box.querySelector('#uap-action');
    const paramsHost = box.querySelector('#uap-params');
    if (actionId) sel.value = actionId;

    function paintParams() {
      const aid = sel.value;
      if (!aid) { paramsHost.innerHTML = ''; return; }
      paramsHost.innerHTML = typeof Editor.buildActionParamFieldsHtml === 'function'
        ? Editor.buildActionParamFieldsHtml(aid, params, { nodeId: 'uap', data: Editor.data })
        : '';
    }
    paintParams();
    sel.addEventListener('change', paintParams);

    function collectParams() {
      const aid = sel.value;
      if (!aid) return {};
      const vals = {};
      paramsHost.querySelectorAll('[data-param-id]').forEach(function (el) {
        vals[el.getAttribute('data-param-id')] = el.type === 'number' ? Number(el.value) : el.value;
      });
      return typeof Editor.buildActionParamsObject === 'function'
        ? Editor.buildActionParamsObject(aid, vals)
        : vals;
    }

    function close() { overlay.remove(); }

    box.querySelector('#uap-cancel').onclick = close;
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    box.querySelector('#uap-ok').onclick = function () {
      const aid = sel.value;
      if (!aid) { close(); return; }
      const step = { action: aid, params: collectParams() };
      if (typeof opts.onSelect === 'function') opts.onSelect(step);
      close();
    };
  };

  Editor.sceneAddEnterAction = function (actionId, params) {
    const sid = Editor.currentScene;
    const scene = sid && Editor.data?.scenes?.[sid];
    if (!scene) return;
    const events = ensureSceneEvents(scene);
    const key = actionId || 'say';
    const p = typeof Editor.buildActionParamsObject === 'function'
      ? Editor.buildActionParamsObject(key, params || {})
      : params || {};
    events.enter.push({ action: key, params: p });
    Editor.markDirty?.();
    Editor.updateJSONPreview?.();
    Editor.renderSceneEnterEventsPanel?.();
  };

  Editor.sceneRemoveEnterAction = function (index) {
    const scene = Editor.data?.scenes?.[Editor.currentScene];
    if (!scene?.events?.enter) return;
    const i = Number(index);
    if (i >= 0 && i < scene.events.enter.length) scene.events.enter.splice(i, 1);
    Editor.markDirty?.();
    Editor.renderSceneEnterEventsPanel?.();
  };

  Editor.sceneMoveEnterAction = function (index, dir) {
    const scene = Editor.data?.scenes?.[Editor.currentScene];
    const list = scene?.events?.enter;
    if (!list) return;
    const i = Number(index);
    const j = i + (dir < 0 ? -1 : 1);
    if (i < 0 || j < 0 || i >= list.length || j >= list.length) return;
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
    Editor.markDirty?.();
    Editor.renderSceneEnterEventsPanel?.();
  };

  function formatEnterStepLabel(step) {
    const act = step?.action || '';
    const label = typeof Editor.getActionLabel === 'function' ? Editor.getActionLabel(act) : act;
    const p = step?.params || {};
    let tail = '';
    if (p.sceneId) {
      const sl = typeof Editor.data !== 'undefined' && Editor.data?.scenes?.[p.sceneId];
      const loc = sl?.location || sl?.title || p.sceneId;
      tail = ' → ' + loc;
    } else if (p.text) {
      tail = ': ' + String(p.text).slice(0, 48);
      if (String(p.text).length > 48) tail += '…';
    }
    return label + tail;
  }

  Editor.formatSceneEnterSummary = function (steps) {
    if (!steps || !steps.length) return '';
    return steps.map((step, idx) => (idx + 1) + '. ' + formatEnterStepLabel(step)).join('; ');
  };

  Editor.renderSceneEnterEventsPanel = function () {
    const mount = document.getElementById('scene-enter-events-panel');
    if (!mount) return;
    const scene = Editor.data?.scenes?.[Editor.currentScene];
    if (!scene) {
      mount.innerHTML = '';
      return;
    }
    ensureSceneEvents(scene);
    const steps = scene.events.enter || [];
    let cards = '';
    steps.forEach(function (step, idx) {
      const act = step?.action || '';
      cards +=
        '<div class="scene-enter-step"><span>' + (idx + 1) + '. ' + esc(act) + '</span> ' +
        '<button type="button" class="btn btn-secondary btn-sm" data-se-action="up" data-index="' + idx + '">↑</button> ' +
        '<button type="button" class="btn btn-secondary btn-sm" data-se-action="down" data-index="' + idx + '">↓</button> ' +
        '<button type="button" class="btn btn-danger btn-sm" data-se-action="remove" data-index="' + idx + '">×</button></div>';
    });

    const summaryText = Editor.formatSceneEnterSummary(steps);
    const summaryHtml = steps.length
      ? '<p class="scene-enter-summary-line writer-only"><span class="scene-enter-summary-label">При входе в сцену:</span> '
        + esc(summaryText) + '</p>'
      : '';

    mount.innerHTML =
      summaryHtml +
      '<div class="scene-enter-editor writer-advanced-only">' +
      '<hr><h4>🚪 При входе в сцену (Phase E)</h4>' +
      '<p class="hint">Цепочка no-code действий сразу после перехода на сцену.</p>' +
      (cards || '<p class="hint">Нет действий</p>') +
      '<button type="button" class="btn btn-secondary" id="scene-enter-add">+ Добавить действие…</button>' +
      '</div>';

    const addBtn = mount.querySelector('#scene-enter-add');
    if (addBtn && !addBtn._bound) {
      addBtn._bound = true;
      addBtn.onclick = function () {
        Editor.openUnifiedActionPicker({
          title: 'Действие при входе в сцену',
          onSelect: function (step) {
            Editor.sceneAddEnterAction(step.action, step.params);
          }
        });
      };
    }
    mount.querySelectorAll('[data-se-action]').forEach(function (btn) {
      btn.onclick = function () {
        const act = btn.getAttribute('data-se-action');
        const idx = btn.getAttribute('data-index');
        if (act === 'remove') Editor.sceneRemoveEnterAction(idx);
        if (act === 'up') Editor.sceneMoveEnterAction(idx, -1);
        if (act === 'down') Editor.sceneMoveEnterAction(idx, 1);
      };
    });
  };

  if (Editor.hooks?.after) {
    Editor.hooks.after('renderSceneEditor', function () {
      try {
        const host =
          document.getElementById('scene-editor-mount') ||
          document.querySelector('#scene-editor .scene-builder') ||
          document.getElementById('scene-editor');
        if (!host) return;
        let panel = document.getElementById('scene-enter-events-panel');
        if (!panel) {
          panel = document.createElement('div');
          panel.id = 'scene-enter-events-panel';
          host.appendChild(panel);
        }
        Editor.renderSceneEnterEventsPanel();
      } catch (e) {
        console.warn('[phase-e]', e);
      }
    }, 'editor-action-phase-e');
  }

  function ensureUiScreenEvents(screen) {
    if (!screen.events || typeof screen.events !== 'object') screen.events = {};
    if (!Array.isArray(screen.events.show)) screen.events.show = [];
    return screen.events;
  }

  Editor.uiAddShowAction = function (actionId, params) {
    const sid = Editor._uiSelectedScreen;
    const screen = sid && Editor.data?.ui?.screens?.[sid];
    if (!screen) return;
    const events = ensureUiScreenEvents(screen);
    const key = actionId || 'say';
    const p = typeof Editor.buildActionParamsObject === 'function'
      ? Editor.buildActionParamsObject(key, params || {})
      : params || {};
    events.show.push({ action: key, params: p });
    Editor.markDirty?.();
    Editor.updateJSONPreview?.();
    Editor.renderUiShowEventsPanel?.();
  };

  Editor.uiRemoveShowAction = function (index) {
    const screen = Editor.data?.ui?.screens?.[Editor._uiSelectedScreen];
    if (!screen?.events?.show) return;
    const i = Number(index);
    if (i >= 0 && i < screen.events.show.length) screen.events.show.splice(i, 1);
    Editor.markDirty?.();
    Editor.renderUiShowEventsPanel?.();
  };

  Editor.uiMoveShowAction = function (index, dir) {
    const screen = Editor.data?.ui?.screens?.[Editor._uiSelectedScreen];
    const list = screen?.events?.show;
    if (!list) return;
    const i = Number(index);
    const j = i + (dir < 0 ? -1 : 1);
    if (i < 0 || j < 0 || i >= list.length || j >= list.length) return;
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
    Editor.markDirty?.();
    Editor.renderUiShowEventsPanel?.();
  };

  Editor.renderUiShowEventsPanel = function () {
    const mount = document.getElementById('ui-show-events-panel');
    if (!mount) return;
    const screen = Editor.data?.ui?.screens?.[Editor._uiSelectedScreen];
    if (!screen) {
      mount.innerHTML = '';
      return;
    }
    ensureUiScreenEvents(screen);
    const steps = screen.events.show || [];
    let cards = '';
    steps.forEach(function (step, idx) {
      const act = step?.action || '';
      cards +=
        '<div class="ui-show-step"><span>' + (idx + 1) + '. ' + esc(act) + '</span> ' +
        '<button type="button" class="btn btn-secondary btn-sm" data-us-action="up" data-index="' + idx + '">↑</button> ' +
        '<button type="button" class="btn btn-secondary btn-sm" data-us-action="down" data-index="' + idx + '">↓</button> ' +
        '<button type="button" class="btn btn-danger btn-sm" data-us-action="remove" data-index="' + idx + '">×</button></div>';
    });

    mount.innerHTML =
      '<hr><h4>📺 При показе экрана (Phase E)</h4>' +
      '<p class="hint">Цепочка действий при монтировании UI-экрана.</p>' +
      (cards || '<p class="hint">Нет действий</p>') +
      '<button type="button" class="btn btn-secondary" id="ui-show-add">+ Добавить действие…</button>';

    const addBtn = mount.querySelector('#ui-show-add');
    if (addBtn && !addBtn._bound) {
      addBtn._bound = true;
      addBtn.onclick = function () {
        Editor.openUnifiedActionPicker({
          title: 'Действие при показе UI-экрана',
          onSelect: function (step) {
            Editor.uiAddShowAction(step.action, step.params);
          }
        });
      };
    }
    mount.querySelectorAll('[data-us-action]').forEach(function (btn) {
      btn.onclick = function () {
        const act = btn.getAttribute('data-us-action');
        const idx = btn.getAttribute('data-index');
        if (act === 'remove') Editor.uiRemoveShowAction(idx);
        if (act === 'up') Editor.uiMoveShowAction(idx, -1);
        if (act === 'down') Editor.uiMoveShowAction(idx, 1);
      };
    });
  };

  if (Editor.hooks?.after) {
    Editor.hooks.after('renderGameUiEditor', function () {
      try {
        const host = document.getElementById('game-ui-editor-root');
        if (!host) return;
        let panel = document.getElementById('ui-show-events-panel');
        if (!panel) {
          panel = document.createElement('div');
          panel.id = 'ui-show-events-panel';
          host.querySelector('.game-ui-editor')?.appendChild(panel);
        }
        Editor.renderUiShowEventsPanel();
      } catch (e) {
        console.warn('[phase-e ui]', e);
      }
    }, 'editor-action-phase-e-ui');
  }

  Editor.EVENT_AUTHORING_LABELS = EVENT_LABELS;
})();
