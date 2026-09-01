// ============================================================
// Project status indicator — верхняя панель Editor
// Состояния: saved | dirty | saving | error
// ============================================================
(function attachProjectStatus() {
  'use strict';
  if (typeof Editor === 'undefined') return;

  const LABELS = {
    saved: '✓ Сохранено',
    dirty: '● Несохранённые изменения',
    saving: '⟳ Сохранение...',
    error: '❌ Ошибка сохранения'
  };

  let state = 'saved'; // default until project loaded
  let el = null;

  function ensureEl() {
    if (typeof document === 'undefined') return null;
    if (el && document.body.contains(el)) return el;
    el = document.getElementById('editor-project-status');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'editor-project-status';
    el.className = 'editor-project-status';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    const host =
      document.querySelector('.header-buttons') ||
      document.querySelector('.editor-nav-brand') ||
      document.body;
    // insert as first child of header-buttons for visibility
    if (host.classList?.contains('header-buttons') && host.firstChild) {
      host.insertBefore(el, host.firstChild);
    } else {
      host.appendChild(el);
    }
    return el;
  }

  function render() {
    const node = ensureEl();
    if (!node) return;
    const label = LABELS[state] || LABELS.saved;
    node.dataset.state = state;
    node.textContent = label;
    node.title =
      state === 'dirty'
        ? 'Есть изменения, не экспортированные в файл. Черновик может быть в autosave.'
        : state === 'saving'
          ? 'Идёт сохранение…'
          : state === 'error'
            ? 'Не удалось сохранить'
            : 'Проект сохранён (экспорт или autosave)';
  }

  const ProjectStatus = {
    get() {
      return state;
    },
    set(next) {
      if (!LABELS[next]) next = 'saved';
      state = next;
      render();
      return state;
    },
    markDirty() {
      if (state === 'saving') return state;
      return this.set('dirty');
    },
    markSaving() {
      return this.set('saving');
    },
    markSaved() {
      return this.set('saved');
    },
    markError() {
      return this.set('error');
    },
    isDirty() {
      return state === 'dirty' || state === 'error';
    }
  };

  Editor.projectStatus = ProjectStatus;

  // Styles
  if (typeof document !== 'undefined' && !document.getElementById('editor-project-status-styles')) {
    const st = document.createElement('style');
    st.id = 'editor-project-status-styles';
    st.textContent = `
      .editor-project-status {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 12px; font-weight: 600; padding: 4px 10px;
        border-radius: 999px; border: 1px solid var(--border, #ccc);
        margin-right: 8px; white-space: nowrap; user-select: none;
        background: var(--paper, #f7f5f2); color: var(--ink-light, #555);
      }
      .editor-project-status[data-state="saved"] {
        color: #2e7d32; border-color: #a5d6a7; background: #e8f5e9;
      }
      .editor-project-status[data-state="dirty"] {
        color: #ef6c00; border-color: #ffcc80; background: #fff3e0;
      }
      .editor-project-status[data-state="saving"] {
        color: #1565c0; border-color: #90caf9; background: #e3f2fd;
      }
      .editor-project-status[data-state="error"] {
        color: #c62828; border-color: #ef9a9a; background: #ffebee;
      }
      /* hide legacy autosave text if both present */
      .editor-autosave-status { display: none !important; }
    `;
    document.head.appendChild(st);
  }

  function boot() {
    render();
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }

  // beforeunload if dirty (project export sense)
  if (typeof window !== 'undefined' && !window._projectStatusUnload) {
    window._projectStatusUnload = true;
    window.addEventListener('beforeunload', (e) => {
      if (!ProjectStatus.isDirty()) return;
      e.preventDefault();
      e.returnValue = '';
    });
  }

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-project-status', {
      projectStatus: Editor.projectStatus
    }, { force: true });
  }
})();
