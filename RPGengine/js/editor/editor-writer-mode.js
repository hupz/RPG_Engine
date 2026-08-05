// Режим писателя: скрывает технические вкладки редактора

(function attachEditorWriterMode() {
  if (typeof Editor === 'undefined') {
    console.warn('editor-writer-mode.js: Editor не определён');
    return;
  }

  const STORAGE_KEY = 'rpg_editor_mode';

  /** Вкладки, видимые в режиме писателя */
  const WRITER_TAB_IDS = new Set([
    'scenes',
    'scene_templates',
    'quests',
    'achievements',
    'snippets',
    'npcs',
    'items'
  ]);

  Object.assign(Editor, {
    editorMode: 'full',

    getWriterTabIds() {
      return [...WRITER_TAB_IDS];
    },

    isWriterMode() {
      return this.editorMode === 'writer';
    },

    isTabVisibleInEditorMode(tabId) {
      if (this.editorMode !== 'writer') return true;
      return WRITER_TAB_IDS.has(tabId);
    },

    getEditorModeToggleLabel() {
      const tr = (k) => (typeof t === 'function' ? t(k) : k);
      return this.isWriterMode() ? '⚙️ ' + tr('editor.writerModeFull') : '✏️ ' + tr('editor.writerMode');
    },

    updateEditorModeToggleButton() {
      const btn = document.getElementById('editor-mode-toggle');
      if (!btn) return;
      const writer = this.isWriterMode();
      btn.textContent = this.getEditorModeToggleLabel();
      btn.classList.toggle('btn-info', !writer);
      btn.classList.toggle('btn-secondary', writer);
      btn.setAttribute('aria-pressed', writer ? 'true' : 'false');
      btn.title = writer
        ? 'Показать все технические вкладки (баланс, климат, JSON…)'
        : 'Оставить только сцены, квесты, NPC и предметы';
    },

    applyEditorMode(mode) {
      const writer = mode === 'writer';
      this.editorMode = writer ? 'writer' : 'full';
      document.body.classList.toggle('editor-writer-mode', writer);

      document.querySelectorAll('.tab[data-tab-id]').forEach((el) => {
        const id = el.dataset.tabId;
        const visible = !writer || WRITER_TAB_IDS.has(id);
        el.classList.toggle('tab--mode-hidden', !visible);
        el.setAttribute('aria-hidden', visible ? 'false' : 'true');
      });

      const tabsBar = document.querySelector('.tabs-bar');
      if (tabsBar) {
        tabsBar.classList.toggle('tabs-bar--writer', writer);
      }

      try {
        localStorage.setItem(STORAGE_KEY, this.editorMode);
      } catch (e) { /* private mode */ }

      this.updateEditorModeToggleButton();

      const hint = document.getElementById('writer-mode-hint');
      if (hint) {
        hint.textContent = writer
          ? 'Видны: сцены, шаблоны, квесты, NPC, предметы.'
          : 'Скрывает баланс, климат, JSON и другие технические разделы.';
      }

      const activeTab = this.currentTab || 'scenes';
      if (writer && !this.isTabVisibleInEditorMode(activeTab)) {
        this.switchTab('scenes');
      }
    },

    toggleEditorMode() {
      this.applyEditorMode(this.isWriterMode() ? 'full' : 'writer');
    },

    initEditorMode() {
      let stored = 'full';
      try {
        stored = localStorage.getItem(STORAGE_KEY) || 'full';
      } catch (e) { /* ignore */ }
      this.applyEditorMode(stored === 'writer' ? 'writer' : 'full');
    }
  });

  const origSwitchTab = Editor.switchTab?.bind(Editor);
  if (origSwitchTab) {
    Editor.switchTab = function switchTabWithWriterMode(tab, event) {
      if (!this.isTabVisibleInEditorMode(tab)) {
        origSwitchTab('scenes', null);
        if (typeof Editor.syncNavLayout === 'function') Editor.syncNavLayout('scenes');
        return;
      }
      origSwitchTab(tab, event);
      if (!event?.target) {
        const tabEl = document.querySelector(`.tab[data-tab-id="${tab}"]:not(.tab--mode-hidden)`);
        if (tabEl) {
          document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
          tabEl.classList.add('active');
        }
      }
    };
  }
})();
