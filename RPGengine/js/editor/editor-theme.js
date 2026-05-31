// Редактор темы UI — визуальные пресеты и color picker

(function attachEditorTheme() {
  if (typeof Editor === 'undefined') {
    console.error('editor-theme.js: Editor не определён');
    return;
  }

  Object.assign(Editor, {
    /** Стабильная оболочка редактора; тема игры — во вкладке «Тема» и в index.html */
    applyThemeFromData() {
      ThemeSystem.applyDefaults();
    },

    getActiveThemePresetId() {
      const t = this.data?.theme;
      if (!t) return 'parchment';
      if (t.preset && ThemeSystem.getPresetDefinition(t.preset)) return t.preset;
      if (t.id && ThemeSystem.getPresetDefinition(t.id)) return t.id;
      return 'custom';
    },

    getSelectedThemeLabel() {
      const id = this.getActiveThemePresetId();
      if (id === 'custom') return 'Кастомная';
      const def = ThemeSystem.getPresetDefinition(id);
      return def?.label || id;
    },

    getSelectedThemeIcon() {
      const id = this.getActiveThemePresetId();
      if (id === 'custom') return '🎨';
      const def = ThemeSystem.getPresetDefinition(id);
      return def?.icon || '🎨';
    },

    renderThemePresetCard(preset, activeId) {
      const core = preset.core || ThemeSystem.extractCore(preset.colors);
      const bg = ThemeSystem.normalizeHex(core.bg);
      const accent = ThemeSystem.normalizeHex(core.accent);
      const text = ThemeSystem.normalizeHex(core.text);
      const selected = preset.id === activeId;
      const userBadge = preset.userPreset
        ? '<span class="theme-preset-user-badge">Мои</span>'
        : '';
      const check = selected ? '<span class="theme-preset-check" aria-hidden="true">✅</span>' : '';
      const deleteBtn = preset.deletable
        ? `<button type="button" class="theme-preset-delete" title="Удалить пресет"
            onclick="event.stopPropagation(); Editor.deleteUserThemePreset(${JSON.stringify(preset.id)})">×</button>`
        : '';
      const name = preset.label || preset.id;
      const shortName = name.length > 8 ? name.slice(0, 7) + '…' : name;
      return `<button type="button" class="theme-preset-card${selected ? ' selected' : ''}"
        style="background:${bg}; color:${text}; --preset-accent:${accent};"
        onclick="Editor.setThemePreset(${JSON.stringify(preset.id)})"
        title="${this.escapeAttr(name)}">
        ${check}${userBadge}${deleteBtn}
        <span class="theme-preset-icon">${preset.icon || '🎨'}</span>
        <span class="theme-preset-name">${this.escapeHtml(shortName)}</span>
      </button>`;
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
      const core = theme.core || ThemeSystem.extractCore(theme.colors);
      const activeId = this.getActiveThemePresetId();
      const cards = ThemeSystem.listPresetCards()
        .map((p) => this.renderThemePresetCard(p, activeId))
        .join('');

      const colorFields = ThemeSystem.CORE_COLOR_FIELDS.map((f) => {
        const val = ThemeSystem.normalizeHex(core[f.key] || '#888888');
        return `<div class="theme-color-row">
          <label>${this.escapeHtml(f.label)}</label>
          <input type="color" value="${this.escapeAttr(val)}"
            oninput="Editor.updateThemeCoreColor('${f.key}', this.value)">
          <span class="theme-color-hex">${this.escapeHtml(val)}</span>
        </div>`;
      }).join('');

      c.innerHTML = `
        <div class="theme-editor-panel">
          <h2>🎨 ТЕМА</h2>
          <p class="hint">Пресет сохраняется в <code>game_data.json</code> → <code>meta.theme</code> и <code>theme</code>.</p>

          <div class="theme-preset-grid">${cards}</div>

          <div class="theme-selected-label">
            Выбрано: ${this.getSelectedThemeIcon()} <strong>${this.escapeHtml(this.getSelectedThemeLabel().toUpperCase())}</strong>
            ${activeId === 'parchment' ? ' <span class="hint">(default)</span>' : ''}
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

          <div class="theme-custom-section">
            <h3>Или кастомная тема</h3>
            <div class="theme-colors-grid">${colorFields}</div>
            <div class="theme-save-preset-row">
              <input type="text" id="theme-custom-preset-name" placeholder="Название пресета" maxlength="40">
              <button type="button" class="btn btn-primary" onclick="Editor.saveThemeAsUserPreset()">💾 Сохранить как пресет</button>
            </div>
            <p class="hint">Пользовательские пресеты хранятся в браузере (localStorage) и отображаются с пометкой «Мои».</p>
          </div>

          <details class="theme-fonts-details">
            <summary>Шрифты (необязательно)</summary>
            <div class="grid-2" style="margin-top:10px;">
              <div class="form-group"><label class="sub-label">Основной</label>
                <input value="${this.escapeAttr(theme.fonts?.body || '')}" onchange="Editor.updateThemeFont('body', this.value)"></div>
              <div class="form-group"><label class="sub-label">Заголовки</label>
                <input value="${this.escapeAttr(theme.fonts?.heading || '')}" onchange="Editor.updateThemeFont('heading', this.value)"></div>
            </div>
            <div class="form-group"><label class="sub-label">Google Fonts</label>
              <input value="${this.escapeAttr(theme.fonts?.google || '')}" onchange="Editor.updateThemeFont('google', this.value)">
              <div class="hint">Пример: <code>Amatic+SC:wght@400;700|family=Caveat:wght@400;500</code></div>
            </div>
          </details>
        </div>`;
    },

    toColorInput(hex) {
      return ThemeSystem.normalizeHex(hex);
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

    updateThemeCoreColor(key, value) {
      if (!this.data) return;
      ThemeSystem.ensureInData(this.data);
      if (!this.data.theme.core) {
        this.data.theme.core = ThemeSystem.extractCore(this.data.theme.colors);
      }
      this.data.theme.core[key] = ThemeSystem.normalizeHex(value);
      this.data.theme.colors = ThemeSystem.expandCore(this.data.theme.core);
      delete this.data.theme.preset;
      this.data.theme.id = 'custom';
      this.data.theme.label = 'Кастомная';
      ThemeSystem.syncMetaTheme(this.data);
      this.data.meta.theme = 'custom';
      this.applyThemeFromData();
      this.renderTheme();
      this.updateJSONPreview();
    },

    setThemePreset(presetId) {
      if (!this.data) return;
      if (!ThemeSystem.getPresetDefinition(presetId)) return;
      this.data.theme = ThemeSystem.buildThemeFromPreset(presetId);
      if (!this.data.meta) this.data.meta = {};
      this.data.meta.theme = presetId;
      this.applyThemeFromData();
      this.renderTheme();
      this.updateJSONPreview();
    },

    saveThemeAsUserPreset() {
      if (!this.data) return;
      ThemeSystem.ensureInData(this.data);
      const input = document.getElementById('theme-custom-preset-name');
      const name = (input?.value || '').trim() || 'Моя тема';
      const core = this.data.theme.core || ThemeSystem.extractCore(this.data.theme.colors);
      const saved = ThemeSystem.saveUserPreset(name, core, this.data.theme.fonts);
      this.data.theme = ThemeSystem.buildThemeFromPreset(saved.id);
      if (!this.data.meta) this.data.meta = {};
      this.data.meta.theme = saved.id;
      this.applyThemeFromData();
      this.renderTheme();
      this.updateJSONPreview();
      if (input) input.value = '';
      alert('Пресет «' + saved.label + '» сохранён в «Мои».');
    },

    deleteUserThemePreset(presetId) {
      if (!presetId || !String(presetId).startsWith('user_')) return;
      if (!confirm('Удалить пользовательский пресет?')) return;
      ThemeSystem.deleteUserPreset(presetId);
      if (this.getActiveThemePresetId() === presetId) {
        this.setThemePreset('parchment');
      } else {
        this.renderTheme();
      }
    },

    resetThemeDefault() {
      this.setThemePreset('parchment');
    }
  });
})();
