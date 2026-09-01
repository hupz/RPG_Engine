// ============================================================
// Editor Core — объект Editor + базовые хелперы (без контент-редакторов)
// Владелец: editor-core
// ============================================================
(function editorCore() {
  'use strict';

  if (typeof window.Editor !== 'undefined' && window.Editor.__coreReady) {
    console.warn('[editor-core] Editor already initialized');
    return;
  }

  const Editor = {
    /** @type {object|null} */
    data: null,
    currentScene: null,
    currentTab: 'dashboard',
    editingClassId: null,
    editingItemId: null,
    __coreReady: true,
    __coreModule: 'editor-core',

    tr(key, params) {
      return typeof t === 'function' ? t(key, params) : key;
    },

    escapeHtml(str) {
      return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    },
    escapeAttr(str) {
      return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    },
    escapeTextarea(str) {
      return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    },

    renderIcon(icon) {
      const value = String(icon || '').trim();
      if (!value) return '';
      const isImage = /^((https?:)?\/\/|\.\/|\/).+\.(png|jpe?g|gif|svg)$/i.test(value);
      if (isImage) {
        return `<img src="${this.escapeAttr(value)}" alt="icon" style="max-width:18px; max-height:18px; vertical-align:middle;">`;
      }
      return this.escapeHtml(value);
    },
    renderIconPreview(icon) {
      const value = String(icon || '').trim();
      if (!value) return '';
      const isImage = /^((https?:)?\/\/|\.\/|\/).+\.(png|jpe?g|gif|svg)$/i.test(value);
      if (isImage) {
        return `<span class="icon-preview"><img src="${this.escapeAttr(value)}" alt="icon"></span>`;
      }
      return `<span class="icon-preview">${this.escapeHtml(value)}</span>`;
    },
    getIconSuggestions() {
      return ['⚔️','🛡️','✨','🔥','❄️','💀','🧪','🌀','⚡','🌿','🛠️','📜','🏹'];
    },
    getIconPickerOptions() {
      return ['⚔️','🛡️','✨','🔥','❄️','💀','🧪','🌀','⚡','🌿','🛠️','📜','🏹','🧠','🌙','☀️','⭐','🍷','🏚️','🪓','🧭','🗝️','🎒','🛏️','🧱','🧵','🪄','🧿','⚗️','🧲','🦉','🐺','🐴','🐉','🦴','🥾','📕','🎯','🕯️','⛺','🚪','👤','🗣️','📖','💬','🎭','👁️','💎','🌊','☠️','🩸','🙏','🔔','📯'];
    },
    getIconPickerOptionsUnique() {
      return [...new Set(this.getIconPickerOptions())];
    },
    renderIconEmojiSelect(onchangeBody) {
      const opts = this.getIconPickerOptionsUnique()
        .map((ic) => `<option value="${this.escapeAttr(ic)}">${this.escapeHtml(ic)}</option>`)
        .join('');
      return `<select class="icon-emoji-select" title="Список emoji" aria-label="Выбрать emoji" onchange="${this.escapeAttr(onchangeBody)}"><option value="">▼ Emoji…</option>${opts}</select>`;
    },
    renderIconSuggestionButtons(onClickExpr) {
      return this.getIconSuggestions()
        .map((icon) => {
          const expr = onClickExpr(icon);
          return `<button type="button" class="icon-suggestion" onclick="${this.escapeAttr(expr)}" title="${this.escapeAttr(icon)}">${this.escapeHtml(icon)}</button>`;
        })
        .join('');
    },

    getWeaponItems() {
      if (!this.data?.items) return [];
      return Object.entries(this.data.items).filter(([, item]) => item.type === 'weapon');
    },
    getAllItemIds() {
      return Object.keys(this.data?.items || {});
    },

    ensureAudioConfig() {
      if (!this.data) return;
      if (!this.data.audio) this.data.audio = { catalog: {}, defaults: { damageType: {}, effectType: {}, attack: {} } };
      if (!this.data.audio.catalog) this.data.audio.catalog = {};
      if (!this.data.audio.defaults) this.data.audio.defaults = { damageType: {}, effectType: {}, attack: {} };
    },
    getSoundCatalogIds() {
      this.ensureAudioConfig();
      return Object.keys(this.data.audio.catalog).sort();
    },
    renderSoundSelect(current, onChangeAttr) {
      const opts = this.getSoundCatalogIds().map((sid) => {
        const label = this.data.audio.catalog[sid]?.label || sid;
        const sel = sid === current ? ' selected' : '';
        return `<option value="${this.escapeAttr(sid)}"${sel}>${this.escapeHtml(label)} (${this.escapeHtml(sid)})</option>`;
      }).join('');
      return `<select onchange="${onChangeAttr}"><option value="">— авто —</option>${opts}</select>`;
    },

    // Stubs — content modules / core-tabs register real implementations
    switchTab(tab, event) {},
    renderAll() {},
    renderSceneList() {},
    updateJSONPreview() {},
    showDashboard() {
      this.currentTab = 'dashboard';
      document.querySelectorAll('.tab-content').forEach((el) => el.classList.remove('active'));
      const dash = document.getElementById('tab-dashboard');
      if (dash) dash.classList.add('active');
    },
    selectScene(id) {
      this.currentScene = id;
      if (typeof this.renderSceneList === 'function') this.renderSceneList();
      if (typeof this.renderSceneEditor === 'function') this.renderSceneEditor();
    },
    renderSceneEditor() {
      const c = document.getElementById('scene-editor');
      if (!c) return;
      if (!this.data) {
        c.innerHTML = '<div class="empty-state"><h2>Нет данных</h2></div>';
        return;
      }
      if (!this.currentScene || !this.data.scenes?.[this.currentScene]) {
        c.innerHTML = '<div class="empty-state"><h2>Выберите сцену</h2></div>';
        return;
      }
      c.innerHTML = '<div class="empty-state"><p class="hint">Редактор сцен подключается модулем scene-builder…</p></div>';
    },

    newProject() {
      if (typeof this.openNewProjectModal === 'function') this.openNewProjectModal();
      else Editor.toast.warning('Загрузите editor-new-project.js');
    },
    loadData() {
      if (typeof this._loadDataFromFile === 'function') this._loadDataFromFile();
      else Editor.toast.warning('Загрузите editor-new-project.js');
    },
    updateProjectPanel() {
      /* cover / meta modules may replace */
    }
  };

  window.Editor = Editor;

  if (Editor.hooks && typeof Editor.hooks.register === 'function') {
    // hooks loads AFTER core normally — registration deferred
  }
})();
