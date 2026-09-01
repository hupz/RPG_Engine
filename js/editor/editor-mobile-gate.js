// ============================================================
// Editor mobile / touch gate
// — ширина < 768: заглушка (кроме режима писателя на тач)
// — тач + Advanced (Инженер): заглушка с переходом в Writer
// — ширина ≥ 768 без тач-ограничений: без заглушки
// ============================================================
(function editorMobileGate() {
  'use strict';

  const BREAK = 768;
  const TAP_MOVE_PX = 12;

  function isTouchDevice() {
    if (typeof window === 'undefined') return false;
    try {
      if (window.matchMedia) {
        if (window.matchMedia('(pointer: coarse)').matches) return true;
        if (window.matchMedia('(hover: none)').matches && navigator.maxTouchPoints > 0) return true;
      }
    } catch (_) { /* ignore */ }
    return navigator.maxTouchPoints > 0;
  }

  function isAdvancedMode() {
    return typeof Editor !== 'undefined' && typeof Editor.isAdvancedMode === 'function' && Editor.isAdvancedMode();
  }

  function isWriterMode() {
    return typeof Editor !== 'undefined' && typeof Editor.isWriterMode === 'function' && Editor.isWriterMode();
  }

  /**
   * @returns {{ block: boolean, reason: 'engineer'|'narrow'|null }}
   */
  function evaluateGate() {
    const w = typeof window !== 'undefined' ? window.innerWidth : BREAK;
    const touch = isTouchDevice();

    if (touch && isAdvancedMode()) {
      return { block: true, reason: 'engineer' };
    }

    if (w < BREAK) {
      if (touch && isWriterMode()) {
        return { block: false, reason: null };
      }
      return { block: true, reason: 'narrow' };
    }

    return { block: false, reason: null };
  }

  function updateGateCopy(reason) {
    const title = document.getElementById('editor-mobile-gate-title');
    const body = document.getElementById('editor-mobile-gate-body');
    const writerBtn = document.getElementById('editor-mobile-gate-writer');
    if (!title || !body) return;

    if (reason === 'engineer') {
      title.textContent = typeof I18n !== 'undefined'
        ? I18n.t('editor.mobileGateEngineerTitle')
        : 'Инженерный режим недоступен на тач-экране';
      body.textContent = typeof I18n !== 'undefined'
        ? I18n.t('editor.mobileGateEngineerBody')
        : 'Конструкторы классов, баланса, JSON и другие технические разделы пока только с мышью. Переключитесь в режим писателя для сцен, квестов и карты сюжета.';
      if (writerBtn) writerBtn.hidden = false;
      return;
    }

    title.textContent = typeof I18n !== 'undefined'
      ? I18n.t('editor.mobileGateTitle')
      : 'Редактор доступен только на ПК';
    body.textContent = typeof I18n !== 'undefined'
      ? I18n.t('editor.mobileGateBody')
      : 'Для создания и правки модулей используйте компьютер с шириной экрана от 768px.';
    if (writerBtn) writerBtn.hidden = true;
  }

  function refresh() {
    const gate = document.getElementById('editor-mobile-gate');
    if (!gate) return;

    const { block, reason } = evaluateGate();
    const touch = isTouchDevice();

    gate.classList.toggle('active', block);
    gate.setAttribute('aria-hidden', block ? 'false' : 'true');
    document.body.classList.toggle('editor-gated', block);
    document.body.classList.toggle('editor-touch-device', touch);
    document.body.style.overflow = block ? 'hidden' : '';

    if (block) updateGateCopy(reason);
  }

  function bindWriterEscape() {
    const btn = document.getElementById('editor-mobile-gate-writer');
    if (!btn || btn._bound) return;
    btn._bound = true;
    btn.addEventListener('click', function () {
      if (typeof Editor !== 'undefined' && typeof Editor.applyEditorMode === 'function') {
        Editor.applyEditorMode('writer');
      }
      refresh();
    });
  }

  let t;
  window.addEventListener('resize', function () {
    clearTimeout(t);
    t = setTimeout(refresh, 200);
  });

  function attachToEditor() {
    if (typeof Editor === 'undefined') return;
    Editor.isTouchDevice = isTouchDevice;
    Editor.refreshMobileGate = refresh;
    Editor.evaluateMobileGate = evaluateGate;
  }

  function boot() {
    bindWriterEscape();
    attachToEditor();
    refresh();
    window.addEventListener('load', function () {
      attachToEditor();
      refresh();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  document.addEventListener('i18n-ready', refresh);

  const api = {
    BREAK,
    TAP_MOVE_PX,
    isTouchDevice,
    evaluateGate,
    refresh
  };

  if (typeof Editor !== 'undefined') {
    Editor.isTouchDevice = isTouchDevice;
    Editor.refreshMobileGate = refresh;
    Editor.evaluateMobileGate = evaluateGate;
  }

  if (typeof window !== 'undefined') {
    window.EditorMobileGate = api;
  }
})();
