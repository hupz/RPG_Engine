// Локализация RPGengine (ru / en) — без внешних библиотек

const I18n = {
  STORAGE_KEY: 'rpgengine_lang',
  SUPPORTED: ['ru', 'en'],
  DEFAULT_LANG: 'ru',
  FALLBACK_LANG: 'ru',

  _lang: 'ru',
  _strings: {},
  _fallback: {},
  _loaded: false,
  _ready: false,
  _readyCallbacks: [],

  normalizeLang(lang) {
    return lang === 'en' ? 'en' : 'ru';
  },

  getLanguage() {
    try {
      const v = localStorage.getItem(this.STORAGE_KEY);
      if (v === 'en' || v === 'ru') return v;
    } catch (_) { /* ignore */ }
    return this.DEFAULT_LANG;
  },

  setLanguage(lang) {
    const next = this.normalizeLang(lang);
    try {
      localStorage.setItem(this.STORAGE_KEY, next);
    } catch (_) { /* ignore */ }
    window.location.reload();
  },

  onReady(fn) {
    if (this._ready) {
      try { fn(); } catch (e) { console.warn('i18n onReady', e); }
    } else {
      this._readyCallbacks.push(fn);
    }
  },

  _fireReady() {
    this._ready = true;
    this._readyCallbacks.forEach((fn) => {
      try { fn(); } catch (e) { console.warn('i18n onReady', e); }
    });
    this._readyCallbacks = [];
    window.dispatchEvent(new CustomEvent('i18n-ready', { detail: { lang: this._lang } }));
  },

  _localeFromRegistry(lang) {
    const reg = typeof window !== 'undefined' ? window.I18N_LOCALES : null;
    if (reg && reg[lang] && typeof reg[lang] === 'object') {
      return JSON.parse(JSON.stringify(reg[lang]));
    }
    return null;
  },

  _fetchLocaleSync(url) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.overrideMimeType('application/json');
    xhr.send(null);
    if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) {
      return JSON.parse(xhr.responseText);
    }
    throw new Error('XHR locale HTTP ' + xhr.status);
  },

  async fetchLocale(lang) {
    const embedded = this._localeFromRegistry(lang);
    if (embedded) return embedded;

    const url = new URL('locales/' + lang + '.json', window.location.href).href;

    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch (_) { /* file:// blocks fetch */ }

    try {
      return this._fetchLocaleSync(url);
    } catch (syncErr) {
      throw new Error('Locale load failed: ' + lang + ' (' + syncErr.message + ')');
    }
  },

  async load(lang) {
    const primary = this.normalizeLang(lang);
    this._lang = primary;
    this._strings = await this.fetchLocale(primary);
    if (primary !== this.FALLBACK_LANG) {
      try {
        this._fallback = await this.fetchLocale(this.FALLBACK_LANG);
      } catch (_) {
        this._fallback = this._strings;
      }
    } else {
      this._fallback = this._strings;
    }
    document.documentElement.lang = primary === 'en' ? 'en' : 'ru';
    return this._strings;
  },

  async init(lang) {
    try {
      await this.load(lang || this.getLanguage());
      this._loaded = true;
      this.applyDocument();
      this.initLangSwitcher();
      this._fireReady();
    } catch (err) {
      console.warn('I18n init failed', err);
      this._loaded = false;
      this.initLangSwitcher();
      this._fireReady();
    }
    return this._lang;
  },

  isLoaded() {
    return this._loaded;
  },

  _getNested(obj, key) {
    if (!obj || !key) return undefined;
    const parts = String(key).split('.');
    let cur = obj;
    for (const p of parts) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = cur[p];
    }
    return typeof cur === 'string' ? cur : undefined;
  },

  t(key, params) {
    if (!key) return '';
    let val = this._getNested(this._strings, key);
    if (val == null) val = this._getNested(this._fallback, key);
    if (val == null) return String(key);
    if (params && typeof params === 'object') {
      Object.entries(params).forEach(([k, v]) => {
        val = val.replace(new RegExp('\\{' + k + '\\}', 'g'), String(v ?? ''));
      });
    }
    return val;
  },

  formatDate(value, options) {
    const d = value instanceof Date ? value : new Date(value);
    const locale = this._lang === 'en' ? 'en-US' : 'ru-RU';
    return new Intl.DateTimeFormat(locale, options || {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(d);
  },

  formatNumber(value, options) {
    const locale = this._lang === 'en' ? 'en-US' : 'ru-RU';
    return new Intl.NumberFormat(locale, options).format(value);
  },

  applyDocument(root) {
    if (!this._loaded) return;
    const scope = root && root.querySelectorAll ? root : document;

    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      const text = this.t(key);
      const attr = el.getAttribute('data-i18n-attr');
      if (attr) {
        el.setAttribute(attr, text);
      } else if (el.getAttribute('data-i18n-html') === '1') {
        el.innerHTML = text;
      } else {
        el.textContent = text;
      }
    });

    scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.placeholder = this.t(el.getAttribute('data-i18n-placeholder'));
    });

    scope.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.title = this.t(el.getAttribute('data-i18n-title'));
    });

    scope.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
      el.setAttribute('aria-label', this.t(el.getAttribute('data-i18n-aria-label')));
    });

    document.querySelectorAll('.lang-switch-btn[data-lang]').forEach((btn) => {
      const active = btn.getAttribute('data-lang') === this._lang;
      btn.classList.toggle('lang-switch-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    const titleKey = document.body?.getAttribute('data-i18n-page-title');
    if (titleKey) {
      document.title = this.t(titleKey);
    }

    scope.querySelectorAll('.empty-state h2:not([data-i18n])').forEach((h) => {
      h.textContent = this.t('common.emptyLoadData');
    });
  },

  initLangSwitcher() {
    document.querySelectorAll('.lang-switch-btn[data-lang]').forEach((btn) => {
      if (btn._i18nBound) return;
      btn._i18nBound = true;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const lang = btn.getAttribute('data-lang');
        if (lang && lang !== this._lang) this.setLanguage(lang);
      });
    });
  },

  /** Перевод карточки кампании (имя собственное title не трогаем) */
  campaignField(id, field, fallback) {
    const key = 'game.campaigns.' + id + '.' + field;
    const val = this.t(key);
    return val === key ? (fallback || '') : val;
  }
};

window.I18n = I18n;
window.t = function t(key, params) {
  return I18n.t(key, params);
};

document.addEventListener('DOMContentLoaded', () => {
  I18n.init();
});

(function hookEditorI18nRefresh() {
  const bind = () => {
    if (typeof Editor === 'undefined' || Editor._i18nHooked) return;
    Editor._i18nHooked = true;
    Editor.refreshI18n = function (root) {
      if (!I18n.isLoaded()) return;
      I18n.applyDocument(root || document.querySelector('.tab-content.active') || document);
    };
    const wrap = (name) => {
      const orig = Editor[name];
      if (typeof orig !== 'function') return;
      Editor[name] = function (...args) {
        const out = orig.apply(this, args);
        try { if (I18n.isLoaded()) I18n.applyDocument(document.querySelector('.tab-content.active') || document); } catch (_) { /* ignore */ }
        return out;
      };
    };
    ['renderAll', 'showDashboard', 'switchTab'].forEach(wrap);
  };
  document.addEventListener('i18n-ready', bind);
  if (typeof Editor !== 'undefined') bind();
})();
