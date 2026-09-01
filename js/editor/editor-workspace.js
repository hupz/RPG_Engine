// ============================================================
// Editor Workspace — open documents, tabs, routing layer (UI-2)
// Session state only; does not modify project JSON.
// ============================================================
(function attachEditorWorkspace() {
  'use strict';

  if (typeof Editor === 'undefined') {
    console.warn('editor-workspace.js: Editor не определён');
    return;
  }

  const SEP = ':';
  const _types = new Map();

  function parseDocId(docId) {
    const raw = String(docId || '');
    const i = raw.indexOf(SEP);
    if (i <= 0) return null;
    return { type: raw.slice(0, i), resourceId: raw.slice(i + 1) };
  }

  function makeDocId(type, resourceId) {
    return String(type) + SEP + String(resourceId);
  }

  const Workspace = {
    /** @type {{ open: string[], activeId: string|null }} */
    state: {
      open: [],
      activeId: null
    },

    makeId: makeDocId,
    parseId: parseDocId,

    /**
     * @param {string} type
     * @param {{ activate: Function, exists?: Function, getTitle?: Function, isDirty?: Function, onClose?: Function }} handlers
     */
    registerDocumentType(type, handlers) {
      if (!type || !handlers || typeof handlers.activate !== 'function') return;
      _types.set(String(type), handlers);
    },

    getHandler(type) {
      return _types.get(String(type)) || null;
    },

    isOpen(docId) {
      return this.state.open.includes(docId);
    },

    getActiveDocId() {
      return this.state.activeId;
    },

    getOpenDocIds() {
      return this.state.open.slice();
    },

    /** Sync workspace tabs when selectScene was called directly (compatibility). */
    syncFromSelectScene(sceneId) {
      if (!sceneId) return;
      const docId = makeDocId('scene', sceneId);
      const handler = _types.get('scene');
      if (handler && typeof handler.exists === 'function' && !handler.exists(sceneId)) return;

      if (!this.state.open.includes(docId)) {
        this.state.open.push(docId);
      }
      this.state.activeId = docId;
      this.renderTabs();
      this._syncChromeVisibility();
    },

    /**
     * Open or focus a workspace document.
     * @param {string} docId e.g. scene:hub
     * @returns {boolean}
     */
    openWorkspaceDocument(docId) {
      const parsed = parseDocId(docId);
      if (!parsed) return false;
      const handler = _types.get(parsed.type);
      if (!handler) return false;
      if (typeof handler.exists === 'function' && !handler.exists(parsed.resourceId)) return false;

      const prevActive = this.state.activeId;
      if (!this.state.open.includes(docId)) {
        this.state.open.push(docId);
      }
      this.state.activeId = docId;
      if (prevActive !== docId) {
        this._lastActiveId = prevActive;
      }

      try {
        handler.activate(parsed.resourceId);
      } catch (e) {
        console.error('[Editor.Workspace] activate', docId, e);
        return false;
      }

      this.renderTabs();
      this._syncChromeVisibility();
      return true;
    },

    activateWorkspaceDocument(docId) {
      if (!this.state.open.includes(docId)) {
        return this.openWorkspaceDocument(docId);
      }
      const parsed = parseDocId(docId);
      if (!parsed) return false;
      const handler = _types.get(parsed.type);
      if (!handler) return false;

      const prevActive = this.state.activeId;
      this.state.activeId = docId;
      if (prevActive !== docId) {
        this._lastActiveId = prevActive;
      }

      try {
        handler.activate(parsed.resourceId);
      } catch (e) {
        console.error('[Editor.Workspace] activate', docId, e);
        return false;
      }

      this.renderTabs();
      this._syncChromeVisibility();
      return true;
    },

    closeWorkspaceDocument(docId) {
      const idx = this.state.open.indexOf(docId);
      if (idx < 0) return false;

      const parsed = parseDocId(docId);
      const handler = parsed ? _types.get(parsed.type) : null;
      if (handler && typeof handler.onClose === 'function') {
        try { handler.onClose(parsed.resourceId); } catch (e) { /* */ }
      }

      const wasActive = this.state.activeId === docId;
      this.state.open.splice(idx, 1);

      if (wasActive) {
        if (this.state.open.length) {
          const fallbackIdx = Math.min(idx, this.state.open.length - 1);
          const fallback = this.state.open[fallbackIdx];
          this.activateWorkspaceDocument(fallback);
        } else {
          this.state.activeId = null;
          this.renderTabs();
          this._syncChromeVisibility();
        }
      } else {
        this.renderTabs();
      }
      return true;
    },

    closeDocumentByResource(type, resourceId) {
      return this.closeWorkspaceDocument(makeDocId(type, resourceId));
    },

    _lastActiveId: null,

    ensureChrome() {
      if (typeof document === 'undefined') return null;
      let bar = document.getElementById('editor-workspace-tabs');
      if (bar) return bar;
      const main = document.querySelector('.main-area');
      if (!main) return null;
      bar = document.createElement('div');
      bar.id = 'editor-workspace-tabs';
      bar.className = 'editor-workspace-tabs';
      bar.setAttribute('role', 'tablist');
      bar.setAttribute('aria-label', 'Открытые документы');
      bar.hidden = true;

      const sectionBar = document.getElementById('editor-section-bar');
      if (sectionBar && sectionBar.parentNode === main) {
        sectionBar.insertAdjacentElement('afterend', bar);
      } else {
        main.insertBefore(bar, main.firstChild);
      }

      if (!document.getElementById('editor-workspace-styles') &&
          !document.querySelector('link#editor-design-system-css, link[href*="editor-design-system"]')) {
        const st = document.createElement('style');
        st.id = 'editor-workspace-styles';
        st.textContent = `
          .editor-workspace-tabs {
            display: flex; flex-wrap: wrap; align-items: stretch; gap: 2px;
            padding: 4px 8px 0; min-height: 32px;
            border-bottom: 1px solid var(--border, #ccc);
            background: var(--paper, #f7f5f2);
          }
          .editor-workspace-tabs[hidden] { display: none !important; }
          .ws-doc-tab {
            display: inline-flex; align-items: center; gap: 4px;
            max-width: 180px; padding: 4px 8px 6px;
            font-size: 12px; border: 1px solid transparent;
            border-bottom: none; border-radius: 6px 6px 0 0;
            background: transparent; color: var(--ink-light, #555);
            cursor: pointer; user-select: none;
          }
          .ws-doc-tab:hover { background: rgba(0,0,0,.04); }
          .ws-doc-tab.is-active {
            background: var(--bg, #fff); color: var(--ink, #222);
            border-color: var(--border, #ccc); font-weight: 600;
            margin-bottom: -1px; padding-bottom: 7px;
          }
          .ws-doc-tab__label {
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          }
          .ws-doc-tab__dirty {
            color: #ef6c00; font-weight: 700; line-height: 1;
          }
          .ws-doc-tab__close {
            flex-shrink: 0; width: 18px; height: 18px; padding: 0;
            border: none; border-radius: 3px; background: transparent;
            color: inherit; font-size: 14px; line-height: 1; cursor: pointer;
            opacity: .55;
          }
          .ws-doc-tab__close:hover { opacity: 1; background: rgba(0,0,0,.08); }
          .ws-doc-tab--new {
            max-width: 36px; min-width: 28px; justify-content: center;
            font-size: 16px; font-weight: 600; color: var(--ink-light, #666);
            border: 1px dashed var(--border, #ccc); border-bottom: none;
            margin-left: 4px;
          }
          .ws-doc-tab--new:hover { background: rgba(0,0,0,.04); color: var(--ink, #222); }
        `;
        document.head.appendChild(st);
      }

      if (!bar.dataset.bound) {
        bar.dataset.bound = '1';
        bar.addEventListener('click', (e) => {
          const closeBtn = e.target.closest('[data-ws-close]');
          if (closeBtn) {
            e.preventDefault();
            e.stopPropagation();
            const docId = closeBtn.getAttribute('data-ws-close');
            if (docId) Workspace.closeWorkspaceDocument(docId);
            return;
          }
          const tab = e.target.closest('[data-ws-doc]');
          if (tab) {
            const docId = tab.getAttribute('data-ws-doc');
            if (docId && docId !== Workspace.state.activeId) {
              Workspace.activateWorkspaceDocument(docId);
            }
            return;
          }
          if (e.target.closest('[data-ws-new-scene]')) {
            Editor.openSceneWizard();
          }
        });
      }
      return bar;
    },

    _syncChromeVisibility() {
      const bar = this.ensureChrome();
      if (!bar) return;
      const onScenes = Editor.currentTab === 'scenes';
      const hasOpen = this.state.open.length > 0;
      bar.hidden = !(onScenes && hasOpen);
    },

    _getDocTitle(docId) {
      const parsed = parseDocId(docId);
      if (!parsed) return docId;
      const handler = _types.get(parsed.type);
      if (handler && typeof handler.getTitle === 'function') {
        try {
          return handler.getTitle(parsed.resourceId) || parsed.resourceId;
        } catch (e) { /* */ }
      }
      return parsed.resourceId;
    },

    _isDocDirty(docId) {
      const parsed = parseDocId(docId);
      if (!parsed) return false;
      const handler = _types.get(parsed.type);
      if (handler && typeof handler.isDirty === 'function') {
        try {
          return !!handler.isDirty(parsed.resourceId);
        } catch (e) { /* */ }
      }
      return false;
    },

    renderTabs() {
      const bar = this.ensureChrome();
      if (!bar) return;
      const esc = typeof Editor.escapeHtml === 'function'
        ? (s) => Editor.escapeHtml(s)
        : (s) => String(s == null ? '' : s);
      const escAttr = typeof Editor.escapeAttr === 'function'
        ? (s) => Editor.escapeAttr(s)
        : esc;

      if (!this.state.open.length) {
        bar.innerHTML = '';
        bar.hidden = true;
        return;
      }

      bar.innerHTML = this.state.open.map((docId) => {
        const active = docId === this.state.activeId;
        const title = this._getDocTitle(docId);
        const dirty = this._isDocDirty(docId);
        return (
          '<button type="button" class="ws-doc-tab' + (active ? ' is-active' : '') + '"' +
          ' role="tab" aria-selected="' + (active ? 'true' : 'false') + '"' +
          ' data-ws-doc="' + escAttr(docId) + '" title="' + escAttr(title) + '">' +
          '<span class="ws-doc-tab__label">' + esc(title) + '</span>' +
          (dirty ? '<span class="ws-doc-tab__dirty" aria-label="Несохранённые изменения">●</span>' : '') +
          '<span class="ws-doc-tab__close" role="button" tabindex="-1"' +
          ' data-ws-close="' + escAttr(docId) + '" aria-label="Закрыть" title="Закрыть">×</span>' +
          '</button>'
        );
      }).join('') +
        '<button type="button" class="ws-doc-tab ws-doc-tab--new" data-ws-new-scene title="Новая сцена" aria-label="Новая сцена">+</button>';

      this._syncChromeVisibility();
    }
  };

  // --- Scene document type (TEXT / Visual / mixed share one editor) ---
  Workspace.registerDocumentType('scene', {
    exists(sceneId) {
      return !!(Editor.data && Editor.data.scenes && Editor.data.scenes[sceneId]);
    },
    getTitle(sceneId) {
      const sc = Editor.data?.scenes?.[sceneId];
      return (sc && (sc.location || sc.title)) || sceneId;
    },
    isDirty() {
      return !!(Editor.projectStatus && typeof Editor.projectStatus.isDirty === 'function' && Editor.projectStatus.isDirty());
    },
    activate(sceneId) {
      if (typeof Editor.switchTab === 'function' && Editor.currentTab !== 'scenes') {
        Editor.switchTab('scenes');
      }
      if (typeof Editor.selectScene === 'function') {
        Editor.selectScene(sceneId);
      } else {
        Editor.currentScene = sceneId;
        if (typeof Editor.renderSceneList === 'function') Editor.renderSceneList();
        if (typeof Editor.renderSceneEditor === 'function') Editor.renderSceneEditor();
      }
    },
    onClose() { /* scene data persists in Editor.data */ }
  });

  Object.assign(Editor, {
    Workspace,
    workspace: Workspace.state,

    openWorkspaceDocument(docId) {
      return Workspace.openWorkspaceDocument(docId);
    },

    activateWorkspaceDocument(docId) {
      return Workspace.activateWorkspaceDocument(docId);
    },

    closeWorkspaceDocument(docId) {
      return Workspace.closeWorkspaceDocument(docId);
    },

    openSceneDocument(sceneId) {
      return Workspace.openWorkspaceDocument(makeDocId('scene', sceneId));
    },

    registerWorkspaceDocumentType(type, handlers) {
      Workspace.registerDocumentType(type, handlers);
    }
  });

  if (Editor.hooks) {
    if (typeof Editor.hooks.after === 'function') {
      Editor.hooks.after('selectScene', function (_result, args) {
        const id = args && args[0];
        if (id) Workspace.syncFromSelectScene(id);
      });

      Editor.hooks.after('renderSceneList', function () {
        Workspace.renderTabs();
      });

      Editor.hooks.after('switchTab', function (_result, args) {
        Workspace._syncChromeVisibility();
        if (args && args[0] === 'scenes' && Workspace.state.activeId) {
          Workspace.renderTabs();
        }
      });

      Editor.hooks.after('deleteScene', function (_result, args) {
        const id = args && args[0];
        if (id) Workspace.closeDocumentByResource('scene', id);
        if (Editor.currentScene && Editor.currentTab === 'scenes') {
          Workspace.syncFromSelectScene(Editor.currentScene);
        }
      });
    }

    if (typeof Editor.hooks.register === 'function') {
      Editor.hooks.register('editor-workspace', {
        openWorkspaceDocument: Editor.openWorkspaceDocument,
        activateWorkspaceDocument: Editor.activateWorkspaceDocument,
        closeWorkspaceDocument: Editor.closeWorkspaceDocument,
        openSceneDocument: Editor.openSceneDocument,
        registerWorkspaceDocumentType: Editor.registerWorkspaceDocumentType
      }, { force: true });
    }
  }

  if (typeof document !== 'undefined') {
    const boot = () => Workspace.ensureChrome();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }

  console.info('[Editor.Workspace] ready');
})();
