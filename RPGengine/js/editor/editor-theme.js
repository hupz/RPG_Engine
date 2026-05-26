// Редактор темы UI

(function attachEditorTheme() {
  if (typeof Editor === 'undefined') {
    console.error('editor-theme.js: Editor не определён');
    return;
  }

  Object.assign(Editor, {
    applyThemeFromData() {
      if (!this.data) {
        ThemeSystem.applyDefaults();
        return;
      }
      ThemeSystem.ensureInData(this.data);
      ThemeSystem.apply(this.data.theme);
    },

    renderTheme() {
      const c = document.getElementById('theme-editor');
      if (!c) return;
      if (!this.data) {
        c.innerHTML = '<div class="empty-state"><h2>Загрузите данные</h2></div>';
        return;
      }
      ThemeSystem.ensureInData(this.data);
      const theme = this.data.theme;
      const colors = theme.colors || {};
      const presets = Object.entries(ThemeSystem.PRESETS).map(([id, p]) =>
        `<button type="button" class="btn btn-secondary" onclick="Editor.setThemePreset('${id}')">${this.escapeHtml(p.label)}</button>`
      ).join('');

      const colorFields = ThemeSystem.COLOR_FIELDS.map(f => {
        const val = colors[f.key] || '';
        return `<div class="theme-color-row">
          <label>${this.escapeHtml(f.label)}</label>
          <input type="color" value="${this.escapeAttr(this.toColorInput(val))}" oninput="Editor.updateThemeColor('${f.key}', this.value)">
          <input type="text" value="${this.escapeAttr(val)}" onchange="Editor.updateThemeColor('${f.key}', this.value)">
        </div>`;
      }).join('');

      c.innerHTML = `
        <div class="theme-editor-panel">
          <h2>🎨 Тема интерфейса</h2>
          <p class="hint">Цвета и шрифты сохраняются в <code>game_data.json</code> → <code>theme</code>. Игра подхватывает их при загрузке.</p>
          <div class="form-group">
            <label>Название темы</label>
            <input value="${this.escapeAttr(theme.label || '')}" onchange="Editor.updateThemeMeta('label', this.value)">
          </div>
          <div class="form-group">
            <label>ID темы</label>
            <input value="${this.escapeAttr(theme.id || 'custom')}" onchange="Editor.updateThemeMeta('id', this.value)">
          </div>
          <div class="form-group">
            <label>Пресеты</label>
            <div class="theme-presets">${presets}
              <button type="button" class="btn btn-secondary" onclick="Editor.resetThemeDefault()">↺ По умолчанию</button>
            </div>
          </div>
          <div class="theme-preview" id="theme-live-preview">
            <div class="tp-sidebar">Панель</div>
            <div class="tp-main">
              <div class="tp-title">Заголовок сцены</div>
              <div class="tp-text">Текст истории и <span class="tp-accent">акцент</span>.</div>
              <button type="button" class="tp-choice">Вариант выбора</button>
              <button type="button" class="tp-btn">Кнопка действия</button>
            </div>
          </div>
          <div class="form-group">
            <label>Шрифты (CSS family)</label>
            <div class="grid-2">
              <div><label class="sub-label">Основной</label>
                <input value="${this.escapeAttr(theme.fonts?.body || '')}" onchange="Editor.updateThemeFont('body', this.value)"></div>
              <div><label class="sub-label">Заголовки</label>
                <input value="${this.escapeAttr(theme.fonts?.heading || '')}" onchange="Editor.updateThemeFont('heading', this.value)"></div>
            </div>
            <label class="sub-label" style="margin-top:8px;">Google Fonts (спецификация)</label>
            <input value="${this.escapeAttr(theme.fonts?.google || '')}" onchange="Editor.updateThemeFont('google', this.value)">
            <div class="hint">Пример: <code>Amatic+SC:wght@400;700|family=Caveat:wght@400;500</code></div>
          </div>
          <div class="form-group">
            <label>Цвета</label>
            <div class="theme-colors-grid">${colorFields}</div>
          </div>
        </div>`;
    },

    toColorInput(hex) {
      if (!hex || typeof hex !== 'string') return '#000000';
      if (/^#[0-9a-f]{6}$/i.test(hex)) return hex;
      if (/^#[0-9a-f]{3}$/i.test(hex)) {
        const h = hex.slice(1);
        return '#' + h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      }
      return '#888888';
    },

    updateThemeMeta(field, value) {
      if (!this.data) return;
      ThemeSystem.ensureInData(this.data);
      this.data.theme[field] = value;
      this.applyThemeFromData();
      this.updateJSONPreview();
    },

    updateThemeFont(field, value) {
      if (!this.data) return;
      ThemeSystem.ensureInData(this.data);
      if (!this.data.theme.fonts) this.data.theme.fonts = {};
      this.data.theme.fonts[field] = value;
      if (field === 'google') ThemeSystem._loadedFonts.delete(value.trim());
      this.applyThemeFromData();
      this.updateJSONPreview();
    },

    updateThemeColor(key, value) {
      if (!this.data) return;
      ThemeSystem.ensureInData(this.data);
      if (!this.data.theme.colors) this.data.theme.colors = {};
      this.data.theme.colors[key] = value;
      delete this.data.theme.preset;
      this.applyThemeFromData();
      this.updateJSONPreview();
      const row = document.querySelector(`.theme-color-row input[type="color"][oninput*="'${key}'"]`);
      if (row && /^#[0-9a-f]{3,6}$/i.test(value)) row.value = this.toColorInput(value);
    },

    setThemePreset(presetId) {
      if (!this.data || !ThemeSystem.PRESETS[presetId]) return;
      const preset = JSON.parse(JSON.stringify(ThemeSystem.PRESETS[presetId]));
      this.data.theme = {
        preset: presetId,
        id: preset.id,
        label: preset.label,
        fonts: { ...preset.fonts },
        colors: { ...preset.colors }
      };
      this.applyThemeFromData();
      this.renderTheme();
      this.updateJSONPreview();
    },

    resetThemeDefault() {
      if (!this.data) return;
      this.data.theme = ThemeSystem.getDefaultTheme();
      this.applyThemeFromData();
      this.renderTheme();
      this.updateJSONPreview();
    }
  });
})();
