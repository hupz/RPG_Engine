// ============================================================
// Editor Toast + Confirm Dialog
// Editor.toast.success/info/warning/error
// Editor.confirmDialog({ title, message, confirmLabel, cancelLabel })
// ============================================================
(function attachEditorToast() {
  'use strict';
  if (typeof Editor === 'undefined') {
    console.error('editor-toast: Editor missing');
    return;
  }

  const DEFAULT_DURATION = {
    success: 3200,
    info: 4000,
    warning: 5000,
    error: 7000
  };

  function ensureStack() {
    let stack = document.getElementById('editor-toast-stack');
    if (stack) return stack;
    stack = document.createElement('div');
    stack.id = 'editor-toast-stack';
    stack.className = 'editor-toast-stack';
    stack.setAttribute('aria-live', 'polite');
    stack.setAttribute('aria-relevant', 'additions');
    document.body.appendChild(stack);
    return stack;
  }

  function escapeHtml(s) {
    if (typeof Editor.escapeHtml === 'function') return Editor.escapeHtml(s);
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * @param {string} message
   * @param {{ type?: string, duration?: number, title?: string }} [opts]
   */
  function showToast(message, opts) {
    opts = opts || {};
    const type = opts.type || 'info';
    const duration = opts.duration != null ? opts.duration : (DEFAULT_DURATION[type] || 4000);
    if (typeof document === 'undefined') {
      console.log('[toast:' + type + ']', message);
      return null;
    }
    const stack = ensureStack();
    const el = document.createElement('div');
    el.className = 'editor-toast editor-toast--' + type;
    el.setAttribute('role', type === 'error' || type === 'warning' ? 'alert' : 'status');
    const icons = { success: '✓', info: 'ℹ', warning: '⚠', error: '❌' };
    el.innerHTML = `
      <span class="editor-toast-icon">${icons[type] || '•'}</span>
      <div class="editor-toast-body">
        ${opts.title ? `<div class="editor-toast-title">${escapeHtml(opts.title)}</div>` : ''}
        <div class="editor-toast-msg">${escapeHtml(message)}</div>
      </div>
      <button type="button" class="editor-toast-close" aria-label="Закрыть">×</button>`;
    stack.appendChild(el);

    let timer = null;
    const dismiss = () => {
      if (timer) clearTimeout(timer);
      el.classList.add('editor-toast--out');
      setTimeout(() => el.remove(), 200);
    };
    el.querySelector('.editor-toast-close')?.addEventListener('click', dismiss);
    if (duration > 0) timer = setTimeout(dismiss, duration);

    // limit stack size
    while (stack.children.length > 6) {
      stack.removeChild(stack.firstChild);
    }
    return { dismiss, el };
  }

  const toast = {
    show: showToast,
    success(msg, opts) { return showToast(msg, Object.assign({}, opts, { type: 'success' })); },
    info(msg, opts) { return showToast(msg, Object.assign({}, opts, { type: 'info' })); },
    warning(msg, opts) { return showToast(msg, Object.assign({}, opts, { type: 'warning' })); },
    error(msg, opts) { return showToast(msg, Object.assign({}, opts, { type: 'error' })); }
  };

  Editor.toast = toast;

  /**
   * Non-blocking confirm. Returns Promise<boolean>.
   * @param {{ title?: string, message: string, confirmLabel?: string, cancelLabel?: string, danger?: boolean }} opts
   */
  function confirmDialog(opts) {
    opts = opts || {};
    const message = opts.message || opts.title || 'Подтвердите действие';
    if (typeof document === 'undefined') {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'editor-modal editor-confirm-modal';
      modal.innerHTML = `
        <div class="editor-modal-backdrop" data-confirm="cancel"></div>
        <div class="editor-modal-panel editor-confirm-panel" role="alertdialog" aria-modal="true">
          ${opts.title ? `<h2>${escapeHtml(opts.title)}</h2>` : ''}
          <p class="editor-confirm-message">${escapeHtml(message)}</p>
          <div class="editor-confirm-actions">
            <button type="button" class="btn btn-secondary" data-confirm="cancel">${escapeHtml(opts.cancelLabel || 'Отмена')}</button>
            <button type="button" class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'}" data-confirm="ok">${escapeHtml(opts.confirmLabel || 'OK')}</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      const finish = (val) => {
        modal.remove();
        resolve(!!val);
      };
      modal.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-confirm]');
        if (!btn) return;
        finish(btn.getAttribute('data-confirm') === 'ok');
      });
      const onKey = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          document.removeEventListener('keydown', onKey, true);
          finish(false);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          document.removeEventListener('keydown', onKey, true);
          finish(true);
        }
      };
      document.addEventListener('keydown', onKey, true);
      setTimeout(() => modal.querySelector('[data-confirm="ok"]')?.focus(), 0);
    });
  }

  /**
   * Optional prompt-like dialog. Returns Promise<string|null>.
   */
  function promptDialog(opts) {
    opts = opts || {};
    if (typeof document === 'undefined') {
      return Promise.resolve(opts.defaultValue || '');
    }
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'editor-modal editor-confirm-modal';
      modal.innerHTML = `
        <div class="editor-modal-backdrop" data-prompt="cancel"></div>
        <div class="editor-modal-panel editor-confirm-panel" role="dialog" aria-modal="true">
          ${opts.title ? `<h2>${escapeHtml(opts.title)}</h2>` : ''}
          ${opts.message ? `<p class="editor-confirm-message">${escapeHtml(opts.message)}</p>` : ''}
          <input type="text" class="editor-prompt-input" value="${escapeHtml(opts.defaultValue || '')}" placeholder="${escapeHtml(opts.placeholder || '')}" />
          <div class="editor-confirm-actions">
            <button type="button" class="btn btn-secondary" data-prompt="cancel">${escapeHtml(opts.cancelLabel || 'Отмена')}</button>
            <button type="button" class="btn btn-primary" data-prompt="ok">${escapeHtml(opts.confirmLabel || 'OK')}</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      const input = modal.querySelector('.editor-prompt-input');
      const finish = (val) => {
        modal.remove();
        resolve(val);
      };
      modal.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-prompt]');
        if (!btn) return;
        if (btn.getAttribute('data-prompt') === 'ok') finish(input.value);
        else finish(null);
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finish(input.value);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          finish(null);
        }
      });
      setTimeout(() => input.focus(), 0);
    });
  }

  Editor.confirmDialog = confirmDialog;
  Editor.promptDialog = promptDialog;

  // Styles
  if (typeof document !== 'undefined' && !document.getElementById('editor-toast-styles')) {
    const st = document.createElement('style');
    st.id = 'editor-toast-styles';
    st.textContent = `
      .editor-toast-stack {
        position: fixed; z-index: 10000; right: 16px; bottom: 16px;
        display: flex; flex-direction: column; gap: 8px;
        max-width: min(400px, calc(100vw - 32px)); pointer-events: none;
      }
      .editor-toast {
        pointer-events: auto; display: flex; align-items: flex-start; gap: 10px;
        padding: 12px 14px; border-radius: 10px; border: 1px solid var(--border, #ccc);
        background: var(--card-bg, #fff); box-shadow: 0 8px 24px rgba(0,0,0,.15);
        animation: editor-toast-in 0.2s ease;
        color: var(--ink, #222);
      }
      .editor-toast--out { opacity: 0; transform: translateY(6px); transition: 0.2s; }
      .editor-toast--success { border-color: #81c784; }
      .editor-toast--info { border-color: #64b5f6; }
      .editor-toast--warning { border-color: #ffb74d; }
      .editor-toast--error { border-color: #e57373; }
      .editor-toast-icon { font-size: 1.1rem; flex-shrink: 0; line-height: 1.3; }
      .editor-toast-body { flex: 1; min-width: 0; font-size: 13px; line-height: 1.4; }
      .editor-toast-title { font-weight: 700; margin-bottom: 2px; }
      .editor-toast-close {
        border: none; background: transparent; cursor: pointer; font-size: 16px;
        line-height: 1; padding: 0 2px; color: var(--muted, #888);
      }
      @keyframes editor-toast-in {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .editor-confirm-panel { max-width: 420px; }
      .editor-confirm-message { margin: 0 0 16px; line-height: 1.45; }
      .editor-confirm-actions { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
      .editor-prompt-input {
        width: 100%; box-sizing: border-box; margin-bottom: 14px; padding: 8px 10px;
        border: 1px solid var(--border, #ccc); border-radius: 6px; font-size: 14px;
      }
    `;
    document.head.appendChild(st);
  }

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-toast', {
      toast: Editor.toast,
      confirmDialog: Editor.confirmDialog,
      promptDialog: Editor.promptDialog
    }, { force: true });
  }

  // Command palette entry
  if (Editor.commands && typeof Editor.commands.register === 'function') {
    Editor.commands.register({
      id: 'ui.toast.test',
      title: 'Тест уведомления (toast)',
      category: 'Справка',
      keywords: ['toast', 'notify'],
      action() {
        Editor.toast.success('Квест сохранён');
        setTimeout(() => Editor.toast.warning('В квесте есть ошибки'), 400);
        setTimeout(() => Editor.toast.error('Не удалось сохранить'), 800);
      }
    });
  }
})();
