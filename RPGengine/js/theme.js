// ============================================
// ThemeSystem — UI themes via CSS variables from JSON
// ============================================

const ThemeSystem = {
  DEFAULT: {
    id: 'parchment',
    label: 'Пергамент',
    fonts: {
      google: 'Amatic+SC:wght@400;700|family=Caveat:wght@400;500;600;700',
      body: "'Caveat', cursive",
      heading: "'Amatic SC', cursive"
    },
    colors: {
      pageBg: '#d8d0c0',
      paper: '#f5f0e8',
      paperDark: '#e8e0d0',
      paperShadow: '#d4cbb8',
      cardBg: '#ffffff',
      ink: '#2c2418',
      inkLight: '#6b5d4d',
      inkFaint: '#9a8e7e',
      accent: '#8b4513',
      accentLight: '#a0522d',
      danger: '#b22222',
      success: '#2e7d32',
      successDark: '#1b5e20',
      info: '#1565c0',
      infoLight: '#42a5f5',
      border: '#c4b8a0',
      borderDark: '#a89880',
      pencil: '#6b5d4d',
      onAccent: '#ffffff',
      onSuccess: '#ffffff',
      overlay: 'rgba(60, 50, 40, 0.6)',
      tagCombatBg: '#ffebee',
      tagOnceBg: '#fff3e0',
      tagOnceFg: '#e65100',
      invUseBg: '#c8e6c9',
      invUseBorder: '#81c784',
      invUseHover: '#a5d6a7',
      wizard: '#4a148c',
      wizardLight: '#7b1fa2',
      paladin: '#1b5e20',
      paladinLight: '#2e7d32',
      warrior: '#8b4513',
      warriorLight: '#a0522d',
      shadowSm: 'rgba(0, 0, 0, 0.08)',
      shadowMd: 'rgba(0, 0, 0, 0.15)',
      highlight: 'rgba(255, 255, 255, 0.5)'
    }
  },

  PRESETS: {
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

  COLOR_FIELDS: [
    { key: 'pageBg', label: 'Фон страницы' },
    { key: 'paper', label: 'Пергамент / панель' },
    { key: 'paperDark', label: 'Пергамент тёмный' },
    { key: 'cardBg', label: 'Карточки' },
    { key: 'ink', label: 'Текст' },
    { key: 'inkLight', label: 'Текст вторичный' },
    { key: 'inkFaint', label: 'Текст бледный' },
    { key: 'accent', label: 'Акцент' },
    { key: 'accentLight', label: 'Акцент светлый' },
    { key: 'border', label: 'Граница' },
    { key: 'borderDark', label: 'Граница тёмная' },
    { key: 'danger', label: 'Опасность' },
    { key: 'success', label: 'Успех' },
    { key: 'info', label: 'Информация' },
    { key: 'wizard', label: 'Класс: маг' },
    { key: 'paladin', label: 'Класс: паладин' },
    { key: 'warrior', label: 'Класс: воин' }
  ],

  _loadedFonts: new Set(),

  resolve(theme) {
    const base = JSON.parse(JSON.stringify(this.DEFAULT));
    if (theme?.preset && this.PRESETS[theme.preset]) {
      const preset = JSON.parse(JSON.stringify(this.PRESETS[theme.preset]));
      base.id = preset.id;
      base.label = preset.label;
      base.fonts = { ...base.fonts, ...preset.fonts };
      base.colors = { ...base.colors, ...preset.colors };
    }
    if (theme?.id) base.id = theme.id;
    if (theme?.label) base.label = theme.label;
    if (theme?.fonts) base.fonts = { ...base.fonts, ...theme.fonts };
    if (theme?.colors) base.colors = { ...base.colors, ...theme.colors };
    return base;
  },

  getDefaultTheme() {
    return JSON.parse(JSON.stringify(this.DEFAULT));
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
    return this.apply(this.DEFAULT, root);
  },

  loadGoogleFonts(googleSpec) {
    if (!googleSpec || typeof googleSpec !== 'string') return;
    const key = googleSpec.trim();
    if (!key || this._loadedFonts.has(key)) return;
    this._loadedFonts.add(key);
    const families = key.split('|').map(part => {
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
    if (!data.theme || typeof data.theme !== 'object') {
      data.theme = this.getDefaultTheme();
    } else {
      data.theme = this.resolve(data.theme);
    }
    return data;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ThemeSystem };
}
