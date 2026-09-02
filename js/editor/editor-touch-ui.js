// ============================================================
// Editor Touch UI — writer workflow на тач / узких экранах
// ============================================================
(function attachEditorTouchUi() {
  'use strict';
  function tr(key, params) {
    if (typeof I18n !== 'undefined' && typeof I18n.t === 'function') return I18n.t(key, params);
    if (typeof t === 'function') return t(key, params);
    return key;
  }

  if (typeof Editor === 'undefined') {
    console.warn('editor-touch-ui: Editor не определён');
    return;
  }

  const MOVE_HINT_ID = 'sg-move-mode-hint';

  function gateApi() {
    return typeof window !== 'undefined' ? window.EditorMobileGate : null;
  }

  function isTouchDevice() {
    if (typeof Editor.isTouchDevice === 'function') return Editor.isTouchDevice();
    const api = gateApi();
    return api ? api.isTouchDevice() : false;
  }

  function isTouchUi() {
    return isTouchDevice() && !document.body.classList.contains('editor-gated');
  }

  function applyTouchShell() {
    const touch = isTouchDevice();
    document.body.classList.toggle('editor-touch', touch && isTouchUi());
    if (touch && typeof Editor.refreshMobileGate === 'function') {
      Editor.refreshMobileGate();
    }
  }

  function installHoverTapHandlers() {
    if (document.body._editorTouchHoverBound) return;
    document.body._editorTouchHoverBound = true;

    document.addEventListener('click', function (e) {
      if (!isTouchUi()) return;
      const card = e.target.closest('.cb-scene-card, .cb2-row');
      if (!card) return;
      document.querySelectorAll('.cb-scene-card.is-touch-open, .cb2-row.is-touch-open').forEach((el) => {
        if (el !== card) el.classList.remove('is-touch-open');
      });
      card.classList.toggle('is-touch-open');
    }, true);

    document.addEventListener('click', function (e) {
      if (!isTouchUi()) return;
      if (e.target.closest('.cb-scene-card, .cb2-row')) return;
      document.querySelectorAll('.cb-scene-card.is-touch-open, .cb2-row.is-touch-open').forEach((el) => {
        el.classList.remove('is-touch-open');
      });
    });
  }

  function touchBarHtml(actions) {
    const btns = actions.map((a) =>
      `<button type="button" class="btn ${a.cls || 'btn-secondary'}" data-touch-action="${Editor.escapeAttr(a.id)}">${Editor.escapeHtml(a.label)}</button>`
    ).join('');
    return `<div class="editor-touch-bar" role="toolbar">${btns}</div>`;
  }

  function bindTouchBar(host, handlers) {
    if (!host || host._touchBarBound) return;
    host._touchBarBound = true;
    host.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-touch-action]');
      if (!btn) return;
      const id = btn.getAttribute('data-touch-action');
      if (handlers[id]) handlers[id](e);
    });
  }

  /** Карта сюжета: выбор целевой сцены без drag-линка */
  async function pickStoryGraphTarget(fromId) {
    const scenes = Editor.data?.scenes || {};
    const ids = Object.keys(scenes).filter((id) => id !== fromId);
    if (!ids.length) {
      Editor.toast.warning(tr('editor.touchUi.noOtherScenes'));
      return;
    }
    const opts = ids.map((id) => {
      const label = scenes[id]?.location || scenes[id]?.title || id;
      return `<option value="${Editor.escapeAttr(id)}">${Editor.escapeHtml(label)}</option>`;
    }).join('');

    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'editor-modal editor-confirm-modal';
      modal.innerHTML = `
        <div class="editor-modal-backdrop" data-pick="cancel"></div>
        <div class="editor-modal-panel editor-confirm-panel" role="dialog" aria-modal="true">
          <h2>${Editor.escapeHtml(tr('editor.touchUi.linkModalTitle'))}</h2>
          <p class="hint">${Editor.escapeHtml(tr('editor.touchUi.linkModalHint'))}</p>
          <select class="editor-prompt-input" style="width:100%;min-height:44px;">${opts}</select>
          <div class="editor-confirm-actions" style="margin-top:12px;">
            <button type="button" class="btn btn-secondary" data-pick="cancel">${Editor.escapeHtml(tr('editor.touchUi.cancel'))}</button>
            <button type="button" class="btn btn-primary" data-pick="ok">${Editor.escapeHtml(tr('editor.touchUi.link'))}</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      const sel = modal.querySelector('select');
      const finish = (val) => { modal.remove(); resolve(val); };
      modal.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-pick]');
        if (!btn) return;
        if (btn.getAttribute('data-pick') === 'ok') finish(sel.value);
        else finish(null);
      });
    }).then((toId) => {
      if (toId && typeof Editor.createStoryGraphLink === 'function') {
        Editor.createStoryGraphLink(fromId, toId);
      }
    });
  }

  function enableStoryGraphMoveMode(sceneId) {
    if (!Editor._sg) Editor._sg = {};
    Editor._sg._moveModeId = sceneId;
    Editor.toast.info(tr('editor.touchUi.moveToast'));
    const side = document.getElementById('sg-side');
    if (side && !document.getElementById(MOVE_HINT_ID)) {
      const done = document.createElement('button');
      done.type = 'button';
      done.className = 'btn btn-secondary';
      done.id = 'sg-move-mode-done';
      done.style.width = '100%';
      done.style.marginBottom = '8px';
      done.textContent = tr('editor.touchUi.done');
      done.addEventListener('click', () => {
        Editor._sg._moveModeId = null;
        document.getElementById(MOVE_HINT_ID)?.remove();
        done.remove();
        Editor.renderStoryGraphSidePanel?.();
      });
      const hint = document.createElement('p');
      hint.id = MOVE_HINT_ID;
      hint.className = 'sg-move-mode-hint';
      hint.textContent = tr('editor.touchUi.moveModeHint');
      side.prepend(hint);
      side.prepend(done);
    }
    Editor.renderStoryGraphSidePanel?.();
  }

  function renderStoryGraphTouchActions(nodeId) {
    const side = document.getElementById('sg-side');
    if (!side || !Editor.data?.scenes?.[nodeId]) return;
    const sc = Editor.data.scenes[nodeId];
    const outs = (sc.choices || []).filter((c) => c && c.to).length;
    side.innerHTML = `
      <h4>${Editor.escapeHtml(sc.location || nodeId)}</h4>
      <p class="hint">ID: <code>${Editor.escapeHtml(nodeId)}</code></p>
      <p class="hint">${Editor.escapeHtml(tr('editor.touchUi.outputs', { count: outs }))}</p>
      ${touchBarHtml([
        { id: 'link', label: tr('editor.touchUi.linkAction'), cls: 'btn-primary' },
        { id: 'move', label: tr('editor.touchUi.moveAction'), cls: 'btn-secondary' },
        { id: 'open', label: tr('editor.touchUi.openScene'), cls: 'btn-secondary' }
      ])}
      <p class="hint" style="margin-top:12px;">${Editor.escapeHtml(tr('editor.touchUi.touchLinkHint'))}</p>`;
    bindTouchBar(side, {
      link: () => pickStoryGraphTarget(nodeId),
      move: () => enableStoryGraphMoveMode(nodeId),
      open: () => Editor.openSceneFromGraph?.(nodeId)
    });
  }

  function renderVisualTouchBar(nodeId) {
    const host = document.getElementById('visual-scene-panel');
    if (!host) return;
    let bar = host.querySelector('.visual-touch-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'visual-touch-bar';
      const tools = host.querySelector('.visual-vp-toolbar') || host.querySelector('.visual-panel-toolbar');
      if (tools) tools.after(bar);
      else host.prepend(bar);
    }
    bar.innerHTML = touchBarHtml([
      { id: 'link', label: tr('editor.touchUi.linkAction'), cls: 'btn-primary' },
      { id: 'move', label: tr('editor.touchUi.moveAction'), cls: 'btn-secondary' }
    ]).replace('editor-touch-bar', 'editor-touch-bar visual-touch-bar-inner');
    bar.className = 'visual-touch-bar';
    bar.innerHTML = `
      <button type="button" class="btn btn-primary" data-visual-touch="link">${Editor.escapeHtml(tr('editor.touchUi.linkAction'))}</button>
      <button type="button" class="btn btn-secondary" data-visual-touch="move">${Editor.escapeHtml(tr('editor.touchUi.moveAction'))}</button>`;
    bar._nodeId = nodeId;
    if (!bar._bound) {
      bar._bound = true;
      bar.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-visual-touch]');
        if (!btn || !bar._nodeId) return;
        const action = btn.getAttribute('data-visual-touch');
        if (action === 'move') {
          Editor._visualTouchMoveId = bar._nodeId;
          Editor.toast.info(tr('editor.touchUi.dragNodeToast'));
        } else if (action === 'link') {
          Editor.visualOpenClickActionPicker?.(bar._nodeId);
        }
      });
    }
  }

  function initTouchUi() {
    applyTouchShell();
    installHoverTapHandlers();

    if (isTouchDevice()) {
      if (typeof Editor.isAdvancedMode === 'function' && Editor.isAdvancedMode()) {
        if (typeof Editor.refreshMobileGate === 'function') Editor.refreshMobileGate();
        return;
      }
      if (typeof Editor.isWriterMode === 'function' && !Editor.isWriterMode()) {
        try { Editor.applyEditorMode('writer'); } catch (_) { /* */ }
      }
    }

    applyTouchShell();
    if (typeof Editor.refreshMobileGate === 'function') Editor.refreshMobileGate();
  }

  Object.assign(Editor, {
    isTouchUi,
    renderStoryGraphTouchActions,
    pickStoryGraphTarget,
    enableStoryGraphMoveMode,
    renderVisualTouchBar
  });

  if (Editor.hooks && typeof Editor.hooks.after === 'function') {
    Editor.hooks.after('applyEditorMode', function () {
      applyTouchShell();
      if (typeof Editor.refreshMobileGate === 'function') Editor.refreshMobileGate();
    });
    Editor.hooks.after('editorAppBootstrap', function () {
      initTouchUi();
    });
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', initTouchUi);
    document.addEventListener('i18n-ready', initTouchUi);
  }
})();
