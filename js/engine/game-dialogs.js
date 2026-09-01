/**
 * Внутриигровые модалки alert / confirm / prompt (без window.alert).
 * Стили: .modal-overlay / .modal-box из css/style.css
 */
(function initGameDialogs(global) {
  const ROOT_ID = 'game-dialog-overlay';
  let activeResolve = null;
  let activeKind = null;
  let queue = Promise.resolve();

  function tr(key, params) {
    if (typeof I18n !== 'undefined' && typeof I18n.t === 'function') return I18n.t(key, params);
    if (typeof t === 'function') return t(key, params);
    return key;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function onKeyDown(event) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    if (activeKind === 'prompt') dismiss(null);
    else if (activeKind === 'confirm') dismiss(false);
    else dismiss(undefined);
  }

  function ensureRoot() {
    let root = document.getElementById(ROOT_ID);
    if (root) return root;
    root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = 'modal-overlay hidden game-dialog-overlay';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    document.body.appendChild(root);
    return root;
  }

  function dismiss(result) {
    const root = document.getElementById(ROOT_ID);
    if (root) {
      root.classList.add('hidden');
      root.innerHTML = '';
      root.onclick = null;
    }
    document.removeEventListener('keydown', onKeyDown);
    const resolve = activeResolve;
    activeResolve = null;
    activeKind = null;
    if (resolve) resolve(result);
  }

  function showBox(innerHtml, kind) {
    const root = ensureRoot();
    activeKind = kind;
    root.innerHTML = innerHtml;
    root.classList.remove('hidden');
    document.addEventListener('keydown', onKeyDown);
    root.onclick = (event) => {
      if (event.target !== root) return;
      if (kind === 'prompt') dismiss(null);
      else if (kind === 'confirm') dismiss(false);
      else dismiss(undefined);
    };
  }

  function enqueue(factory) {
    const run = queue.then(() => factory());
    queue = run.catch(() => {});
    return run;
  }

  function alert(title, text) {
    return enqueue(() => new Promise((resolve) => {
      activeResolve = () => resolve();
      const okLabel = tr('game.dialog.ok');
      const titleHtml = title
        ? `<div class="modal-title">${escapeHtml(title)}</div>`
        : '';
      showBox(`
        <div class="modal-box paper-sheet game-dialog-box" onclick="event.stopPropagation()">
          ${titleHtml}
          <div class="modal-body">${escapeHtml(text || '')}</div>
          <div class="game-dialog-actions">
            <button type="button" class="start-btn game-dialog-ok">${escapeHtml(okLabel)}</button>
          </div>
        </div>
      `, 'alert');
      const root = document.getElementById(ROOT_ID);
      const okBtn = root.querySelector('.game-dialog-ok');
      okBtn?.addEventListener('click', () => dismiss(undefined));
      okBtn?.focus();
    }));
  }

  function confirm(title, text) {
    return enqueue(() => new Promise((resolve) => {
      activeResolve = resolve;
      const okLabel = tr('game.dialog.confirm');
      const cancelLabel = tr('game.dialog.cancel');
      const titleHtml = title
        ? `<div class="modal-title">${escapeHtml(title)}</div>`
        : '';
      showBox(`
        <div class="modal-box paper-sheet game-dialog-box" onclick="event.stopPropagation()">
          ${titleHtml}
          <div class="modal-body">${escapeHtml(text || '')}</div>
          <div class="game-dialog-actions">
            <button type="button" class="choice game-dialog-cancel">${escapeHtml(cancelLabel)}</button>
            <button type="button" class="start-btn game-dialog-ok">${escapeHtml(okLabel)}</button>
          </div>
        </div>
      `, 'confirm');
      const root = document.getElementById(ROOT_ID);
      root.querySelector('.game-dialog-cancel')?.addEventListener('click', () => dismiss(false));
      root.querySelector('.game-dialog-ok')?.addEventListener('click', () => dismiss(true));
      root.querySelector('.game-dialog-ok')?.focus();
    }));
  }

  function prompt(title, text, defaultValue = '') {
    return enqueue(() => new Promise((resolve) => {
      activeResolve = resolve;
      const okLabel = tr('game.dialog.confirm');
      const cancelLabel = tr('game.dialog.cancel');
      const placeholder = tr('game.dialog.promptPlaceholder');
      const titleHtml = title
        ? `<div class="modal-title">${escapeHtml(title)}</div>`
        : '';
      showBox(`
        <div class="modal-box paper-sheet game-dialog-box" onclick="event.stopPropagation()">
          ${titleHtml}
          <div class="modal-body">${escapeHtml(text || '')}</div>
          <input type="text" class="game-dialog-input" value="${escapeHtml(defaultValue)}" placeholder="${escapeHtml(placeholder)}" autocomplete="off">
          <div class="game-dialog-actions">
            <button type="button" class="choice game-dialog-cancel">${escapeHtml(cancelLabel)}</button>
            <button type="button" class="start-btn game-dialog-ok">${escapeHtml(okLabel)}</button>
          </div>
        </div>
      `, 'prompt');
      const root = document.getElementById(ROOT_ID);
      const input = root.querySelector('.game-dialog-input');
      const submit = () => dismiss(input ? input.value : '');
      root.querySelector('.game-dialog-cancel')?.addEventListener('click', () => dismiss(null));
      root.querySelector('.game-dialog-ok')?.addEventListener('click', submit);
      input?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          submit();
        }
      });
      input?.focus();
      input?.select();
    }));
  }

  const GameDialogs = { alert, confirm, prompt, dismiss };
  global.GameDialogs = GameDialogs;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GameDialogs };
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
