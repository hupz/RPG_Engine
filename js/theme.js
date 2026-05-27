// ============================================
// ThemeSystem — темы UI через CSS-переменные из JSON
// ============================================

const ThemeSystem = {
  USER_PRESETS_STORAGE_KEY: 'rpgengine_user_theme_presets',

  DEFAULT_FONTS: {
    google: 'Amatic+SC:wght@400;700|family=Caveat:wght@400;500;600;700',
    body: "'Caveat', cursive",
    heading: "'Amatic SC', cursive"
  },

  /** 7 базовых цветов для редактора */
  CORE_COLOR_FIELDS: [
    { key: 'bg', label: 'Фон' },
    { key: 'text', label: 'Текст' },
    { key: 'accent', label: 'Акцент' },
    { key: 'border', label: 'Граница' },
    { key: 'hp', label: 'ОЗ' },
    { key: 'gold', label: 'Золото' },
    { key: 'success', label: 'Успех' }
  ],

  /** 6 встроенных пресетов (визуальный выбор в редакторе) */
  BUILTIN_PRESETS: {
    parchment: {
      id: 'parchment',
      label: 'Пергамент',
      icon: '🏜️',
      default: true,
      fonts: {
        google: 'Amatic+SC:wght@400;700|family=Caveat:wght@400;500;600;700',
        body: "'Caveat', cursive",
        heading: "'Amatic SC', cursive"
      },
      core: {
        bg: '#F5E6D3',
        text: '#3E2723',
        accent: '#8B4513',
        border: '#D2B48C',
        hp: '#C0392B',
        gold: '#F1C40F',
        success: '#27AE60'
      }
    },
    dark: {
      id: 'dark',
      label: 'Тёмная',
      icon: '🌑',
      fonts: {
        google: 'Cinzel:wght@400;600;700|family=Crimson+Pro:ital,wght@0,400;0,600;1,400',
        body: "'Crimson Pro', serif",
        heading: "'Cinzel', serif"
      },
      core: {
        bg: '#1A1A2E',
        text: '#E0E0E0',
        accent: '#E94560',
        border: '#16213E',
        hp: '#E74C3C',
        gold: '#F39C12',
        success: '#2ECC71'
      }
    },
    icy: {
      id: 'icy',
      label: 'Ледяная',
      icon: '❄️',
      fonts: {
        google: 'Nunito:wght@400;600;700|family=Merriweather:ital,wght@0,400;0,700;1,400',
        body: "'Merriweather', serif",
        heading: "'Nunito', sans-serif"
      },
      core: {
        bg: '#E8F4F8',
        text: '#2C3E50',
        accent: '#3498DB',
        border: '#AED6F1',
        hp: '#E74C3C',
        gold: '#F1C40F',
        success: '#1ABC9C'
      }
    },
    bloody: {
      id: 'bloody',
      label: 'Кровавая',
      icon: '🩸',
      fonts: {
        google: 'Cinzel:wght@400;600;700|family=Crimson+Pro:ital,wght@0,400;0,600;1,400',
        body: "'Crimson Pro', serif",
        heading: "'Cinzel', serif"
      },
      core: {
        bg: '#2C0B0E',
        text: '#F5D6D6',
        accent: '#C0392B',
        border: '#641E16',
        hp: '#FF0000',
        gold: '#F39C12',
        success: '#27AE60'
      }
    },
    forest: {
      id: 'forest',
      label: 'Лесная',
      icon: '🌿',
      fonts: {
        google: 'Amatic+SC:wght@400;700|family=Caveat:wght@400;500;600;700',
        body: "'Caveat', cursive",
        heading: "'Amatic SC', cursive"
      },
      core: {
        bg: '#F0F7DA',
        text: '#1E3A1E',
        accent: '#6B8E23',
        border: '#A8D08D',
        hp: '#C0392B',
        gold: '#DAA520',
        success: '#228B22'
      }
    },
    ash: {
      id: 'ash',
      label: 'Пепельная',
      icon: '🌫️',
      fonts: {
        google: 'Nunito:wght@400;600;700|family=Merriweather:ital,wght@0,400;0,700;1,400',
        body: "'Merriweather', serif",
        heading: "'Nunito', sans-serif"
      },
      core: {
        bg: '#E8E8E8',
        text: '#2C3E50',
        accent: '#7F8C8D',
        border: '#BDC3C7',
        hp: '#C0392B',
        gold: '#F39C12',
        success: '#27AE60'
      }
    }
  },

  /** Старые пресеты — полная палитра, для совместимости проектов */
  LEGACY_PRESETS: {
    dark_fantasy: {
      id: 'dark_fantasy',
      label: 'Тёмное фэнтези',
      fonts: {
        google: 'Cinzel:wght@400;600;700|family=Crimson+Pro:ital,wght@0,400;0,600;1,400',
        body: "'Crimson Pro', serif",
        heading: "'Cinzel', serif"
      },
      colors: {
        pageBg: '#0f0e14',
        paper: '#1a1824',
        paperDark: '#12101a',
        paperShadow: '#0a090e',
        cardBg: '#22202e',
        ink: '#e8e4dc',
        inkLight: '#b8b0a4',
        inkFaint: '#7a7268',
        accent: '#c9a227',
        accentLight: '#e0bc4a',
        danger: '#cf6679',
        success: '#4caf7a',
        successDark: '#2e7d52',
        info: '#64b5f6',
        infoLight: '#90caf9',
        border: '#3d3848',
        borderDark: '#2a2634',
        pencil: '#9a9288',
        onAccent: '#1a1824',
        onSuccess: '#0f0e14',
        overlay: 'rgba(0, 0, 0, 0.75)',
        tagCombatBg: '#3d2028',
        tagOnceBg: '#3d3020',
        tagOnceFg: '#ffb74d',
        invUseBg: '#1e3d2a',
        invUseBorder: '#4caf7a',
        invUseHover: '#2e5c40',
        wizard: '#9c7bd8',
        wizardLight: '#b39ddb',
        paladin: '#66bb6a',
        paladinLight: '#81c784',
        warrior: '#d4a574',
        warriorLight: '#e0bc94',
        shadowSm: 'rgba(0, 0, 0, 0.35)',
        shadowMd: 'rgba(0, 0, 0, 0.5)',
        highlight: 'rgba(255, 255, 255, 0.06)'
      }
    },
    sci_fi: {
      id: 'sci_fi',
      label: 'Sci-Fi',
      fonts: {
        google: 'Orbitron:wght@400;600;700|family=Share+Tech+Mono',
        body: "'Share Tech Mono', monospace",
        heading: "'Orbitron', sans-serif"
      },
      colors: {
        pageBg: '#050a12',
        paper: '#0c1420',
        paperDark: '#080e18',
        paperShadow: '#040810',
        cardBg: '#101c2c',
        ink: '#c8e6ff',
        inkLight: '#7eb8d4',
        inkFaint: '#4a7a94',
        accent: '#00e5ff',
        accentLight: '#4dffff',
        danger: '#ff5252',
        success: '#00e676',
        successDark: '#00a152',
        info: '#448aff',
        infoLight: '#82b1ff',
        border: '#1e3a52',
        borderDark: '#142838',
        pencil: '#5a8aaa',
        onAccent: '#050a12',
        onSuccess: '#050a12',
        overlay: 'rgba(0, 20, 40, 0.85)',
        tagCombatBg: '#2a1018',
        tagOnceBg: '#1a2838',
        tagOnceFg: '#ffb74d',
        invUseBg: '#0a2830',
        invUseBorder: '#00e5ff',
        invUseHover: '#143848',
        wizard: '#b388ff',
        wizardLight: '#d1c4e9',
        paladin: '#69f0ae',
        paladinLight: '#b9f6ca',
        warrior: '#ffab40',
        warriorLight: '#ffd180',
        shadowSm: 'rgba(0, 229, 255, 0.08)',
        shadowMd: 'rgba(0, 229, 255, 0.2)',
        highlight: 'rgba(0, 229, 255, 0.08)'
      }
    }
  },

  /** @deprecated — алиас для совместимости */
  get PRESETS() {
    return { ...this.BUILTIN_PRESETS, ...this.LEGACY_PRESETS };
  },

  get DEFAULT() {
    return this.buildThemeFromPreset('parchment');
  },

  CSS_MAP: {
    pageBg: '--page-bg',
    paper: '--paper',
    paperDark: '--paper-dark',
    paperShadow: '--paper-shadow',
    cardBg: '--card-bg',
    ink: '--ink',
    inkLight: '--ink-light',
    inkFaint: '--ink-faint',
    accent: '--accent',
    accentLight: '--accent-light',
    danger: '--danger',
    success: '--success',
    successDark: '--success-dark',
    info: '--info',
    infoLight: '--info-light',
    border: '--border',
    borderDark: '--border-dark',
    pencil: '--pencil',
    onAccent: '--on-accent',
    onSuccess: '--on-success',
    overlay: '--overlay',
    tagCombatBg: '--tag-combat-bg',
    tagOnceBg: '--tag-once-bg',
    tagOnceFg: '--tag-once-fg',
    invUseBg: '--inv-use-bg',
    invUseBorder: '--inv-use-border',
    invUseHover: '--inv-use-hover',
    wizard: '--wizard',
    wizardLight: '--wizard-light',
    paladin: '--paladin',
    paladinLight: '--paladin-light',
    warrior: '--warrior',
    warriorLight: '--warrior-light',
    shadowSm: '--shadow-sm',
    shadowMd: '--shadow-md',
    highlight: '--highlight'
  },

  /** @deprecated — полный список для старых экранов */
  COLOR_FIELDS: [
    { key: 'pageBg', label: 'Фон страницы' },
    { key: 'paper', label: 'Пергамент / панель' },
    { key: 'ink', label: 'Текст' },
    { key: 'accent', label: 'Акцент' },
    { key: 'border', label: 'Граница' },
    { key: 'danger', label: 'Опасность' },
    { key: 'success', label: 'Успех' }
  ],

  _loadedFonts: new Set(),

  normalizeHex(hex) {
    if (!hex || typeof hex !== 'string') return '#000000';
    let h = hex.trim();
    if (!h.startsWith('#')) h = '#' + h;
    if (/^#[0-9a-f]{3}$/i.test(h)) {
      const c = h.slice(1);
      h = '#' + c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    }
    if (!/^#[0-9a-f]{6}$/i.test(h)) return '#888888';
    return h.toUpperCase();
  },

  hexToRgb(hex) {
    const h = this.normalizeHex(hex).slice(1);
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  },

  rgbToHex(r, g, b) {
    const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
    return '#' + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  },

  mixColors(a, b, t) {
    const c1 = this.hexToRgb(a);
    const c2 = this.hexToRgb(b);
    const k = Math.max(0, Math.min(1, t));
    return this.rgbToHex(
      c1.r + (c2.r - c1.r) * k,
      c1.g + (c2.g - c1.g) * k,
      c1.b + (c2.b - c1.b) * k
    );
  },

  lighten(hex, amount) {
    return this.mixColors(hex, '#FFFFFF', amount);
  },

  darken(hex, amount) {
    return this.mixColors(hex, '#000000', amount);
  },

  luminance(hex) {
    const { r, g, b } = this.hexToRgb(hex);
    const srgb = [r, g, b].map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  },

  contrastText(bg, light = '#FFFFFF', dark = '#1A1A1A') {
    return this.luminance(bg) < 0.45 ? light : dark;
  },

  /** Разворачивает 7 базовых цветов в полную палитру CSS */
  expandCore(core) {
    const bg = this.normalizeHex(core.bg);
    const text = this.normalizeHex(core.text);
    const accent = this.normalizeHex(core.accent);
    const border = this.normalizeHex(core.border);
    const hp = this.normalizeHex(core.hp);
    const gold = this.normalizeHex(core.gold);
    const success = this.normalizeHex(core.success);
    const isDark = this.luminance(bg) < 0.35;
    const onAccent = this.contrastText(accent, '#FFFFFF', text);
    const onSuccess = this.contrastText(success, '#FFFFFF', text);

    return {
      pageBg: this.darken(bg, isDark ? 0.08 : 0.06),
      paper: bg,
      paperDark: isDark ? this.darken(bg, 0.12) : this.darken(bg, 0.05),
      paperShadow: border,
      cardBg: isDark ? this.lighten(bg, 0.06) : '#FFFFFF',
      ink: text,
      inkLight: this.mixColors(text, bg, 0.55),
      inkFaint: this.mixColors(text, bg, 0.72),
      accent,
      accentLight: this.lighten(accent, 0.15),
      danger: hp,
      success,
      successDark: this.darken(success, 0.18),
      info: accent,
      infoLight: this.lighten(accent, 0.22),
      border,
      borderDark: this.darken(border, 0.12),
      pencil: this.mixColors(text, border, 0.45),
      onAccent,
      onSuccess,
      overlay: isDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(60, 50, 40, 0.55)',
      tagCombatBg: this.mixColors(hp, bg, 0.88),
      tagOnceBg: this.mixColors(gold, bg, 0.85),
      tagOnceFg: gold,
      invUseBg: this.mixColors(success, bg, 0.82),
      invUseBorder: success,
      invUseHover: this.mixColors(success, bg, 0.65),
      wizard: isDark ? '#9c7bd8' : '#4a148c',
      wizardLight: isDark ? '#b39ddb' : '#7b1fa2',
      paladin: success,
      paladinLight: this.lighten(success, 0.12),
      warrior: accent,
      warriorLight: this.lighten(accent, 0.12),
      shadowSm: isDark ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.08)',
      shadowMd: isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.15)',
      highlight: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.5)'
    };
  },

  extractCore(colors) {
    if (!colors) return { ...this.BUILTIN_PRESETS.parchment.core };
    return {
      bg: colors.paper || colors.pageBg || '#F5E6D3',
      text: colors.ink || '#3E2723',
      accent: colors.accent || '#8B4513',
      border: colors.border || '#D2B48C',
      hp: colors.danger || '#C0392B',
      gold: colors.tagOnceFg || colors.gold || '#F1C40F',
      success: colors.success || '#27AE60'
    };
  },

  getUserPresets() {
    try {
      const raw = localStorage.getItem(this.USER_PRESETS_STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  },

  saveUserPresets(list) {
    try {
      localStorage.setItem(this.USER_PRESETS_STORAGE_KEY, JSON.stringify(list));
    } catch (_) { /* ignore */ }
  },

  slugifyPresetName(name) {
    return String(name || 'theme')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u0400-\u04ff]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 32) || 'theme';
  },

  saveUserPreset(name, core, fonts) {
    const label = String(name || '').trim() || 'Моя тема';
    const slug = this.slugifyPresetName(label);
    const id = 'user_' + slug + '_' + Date.now().toString(36);
    const preset = {
      id,
      label,
      icon: '⭐',
      custom: true,
      core: { ...core },
      fonts: fonts ? { ...fonts } : { ...this.DEFAULT_FONTS }
    };
    const list = this.getUserPresets();
    list.push(preset);
    this.saveUserPresets(list);
    return preset;
  },

  deleteUserPreset(id) {
    const list = this.getUserPresets().filter((p) => p.id !== id);
    this.saveUserPresets(list);
  },

  getPresetDefinition(presetId) {
    if (!presetId) return null;
    if (this.BUILTIN_PRESETS[presetId]) return this.BUILTIN_PRESETS[presetId];
    if (this.LEGACY_PRESETS[presetId]) return this.LEGACY_PRESETS[presetId];
    return this.getUserPresets().find((p) => p.id === presetId) || null;
  },

  listPresetCards() {
    const builtin = Object.values(this.BUILTIN_PRESETS).map((p) => ({
      ...p,
      builtin: true,
      deletable: false
    }));
    const user = this.getUserPresets().map((p) => ({
      ...p,
      icon: p.icon || '⭐',
      deletable: true,
      userPreset: true
    }));
    return [...builtin, ...user];
  },

  buildThemeFromPreset(presetId) {
    const def = this.getPresetDefinition(presetId) || this.BUILTIN_PRESETS.parchment;
    const fonts = { ...this.DEFAULT_FONTS, ...(def.fonts || {}) };
    let colors;
    let core;

    if (def.core) {
      core = { ...def.core };
      colors = this.expandCore(core);
    } else if (def.colors) {
      colors = { ...def.colors };
      core = this.extractCore(colors);
    } else {
      core = { ...this.BUILTIN_PRESETS.parchment.core };
      colors = this.expandCore(core);
    }

    const isLegacy = !!this.LEGACY_PRESETS[presetId];
    const isUser = !!def.custom;

    return {
      preset: isLegacy || def.custom ? presetId : presetId,
      id: def.id || presetId,
      label: def.label || presetId,
      core,
      fonts,
      colors
    };
  },

  buildCustomTheme(core, fonts, label) {
    const normalized = {};
    this.CORE_COLOR_FIELDS.forEach(({ key }) => {
      normalized[key] = this.normalizeHex(core[key]);
    });
    return {
      id: 'custom',
      label: label || 'Кастомная',
      core: normalized,
      fonts: { ...this.DEFAULT_FONTS, ...(fonts || {}) },
      colors: this.expandCore(normalized)
    };
  },

  resolve(theme) {
    if (!theme || typeof theme !== 'object') {
      return this.buildThemeFromPreset('parchment');
    }

    if (theme.preset) {
      const built = this.buildThemeFromPreset(theme.preset);
      if (theme.label) built.label = theme.label;
      if (theme.fonts) built.fonts = { ...built.fonts, ...theme.fonts };
      if (theme.core) {
        built.core = { ...built.core, ...theme.core };
        built.colors = this.expandCore(built.core);
      }
      return built;
    }

    const base = theme.core
      ? this.buildCustomTheme(theme.core, theme.fonts, theme.label)
      : JSON.parse(JSON.stringify(this.buildThemeFromPreset('parchment')));

    if (theme.id) base.id = theme.id;
    if (theme.label) base.label = theme.label;
    if (theme.fonts) base.fonts = { ...base.fonts, ...theme.fonts };
    if (theme.core) {
      base.core = { ...base.core, ...theme.core };
      base.colors = { ...base.colors, ...this.expandCore(base.core) };
    }
    if (theme.colors) {
      base.colors = { ...base.colors, ...theme.colors };
      base.core = this.extractCore(base.colors);
    }
    return base;
  },

  getDefaultTheme() {
    return this.buildThemeFromPreset('parchment');
  },

  syncMetaTheme(data) {
    if (!data) return;
    if (!data.meta || typeof data.meta !== 'object') data.meta = {};
    const t = data.theme;
    if (t?.preset) {
      data.meta.theme = t.preset;
    } else if (t?.id === 'custom' || !this.BUILTIN_PRESETS[t?.id]) {
      data.meta.theme = t?.id === 'custom' ? 'custom' : (data.meta.theme || 'custom');
    } else if (t?.id) {
      data.meta.theme = t.id;
    } else if (!data.meta.theme) {
      data.meta.theme = 'parchment';
    }
  },

  apply(theme, root = document.documentElement) {
    const resolved = this.resolve(theme);
    const style = root.style;
    for (const [key, cssVar] of Object.entries(this.CSS_MAP)) {
      const val = resolved.colors[key];
      if (val != null && val !== '') style.setProperty(cssVar, val);
    }
    if (resolved.fonts?.body) style.setProperty('--font-body', resolved.fonts.body);
    if (resolved.fonts?.heading) style.setProperty('--font-heading', resolved.fonts.heading);
    if (resolved.fonts?.google) this.loadGoogleFonts(resolved.fonts.google);
    root.dataset.theme = resolved.id || 'custom';
    return resolved;
  },

  applyDefaults(root = document.documentElement) {
    return this.apply(this.getDefaultTheme(), root);
  },

  loadGoogleFonts(googleSpec) {
    if (!googleSpec || typeof googleSpec !== 'string') return;
    const key = googleSpec.trim();
    if (!key || this._loadedFonts.has(key)) return;
    this._loadedFonts.add(key);
    const families = key.split('|').map((part) => {
      const p = part.trim();
      if (p.startsWith('family=')) return p.replace(/^family=/, 'family=');
      return 'family=' + p;
    }).join('&');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?' + families + '&display=swap';
    document.head.appendChild(link);
  },

  ensureInData(data) {
    if (!data) return data;
    if (!data.meta || typeof data.meta !== 'object') data.meta = {};

    const metaTheme = data.meta.theme || 'parchment';

    if (!data.theme || typeof data.theme !== 'object') {
      if (metaTheme && metaTheme !== 'custom' && this.getPresetDefinition(metaTheme)) {
        data.theme = this.buildThemeFromPreset(metaTheme);
      } else {
        data.theme = this.getDefaultTheme();
        data.meta.theme = 'parchment';
      }
    } else {
      data.theme = this.resolve(data.theme);
      this.syncMetaTheme(data);
    }
    return data;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ThemeSystem };
}
