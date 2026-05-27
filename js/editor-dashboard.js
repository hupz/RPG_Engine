// Редактор: дашборд проекта

(function attachEditorDashboard() {
  if (typeof Editor === 'undefined') {
    console.error('editor-dashboard.js: Editor не определён');
    return;
  }

  Object.assign(Editor, {
    getDashboardStats() {
      const d = this.data || {};
      return {
        scenes: Object.keys(d.scenes || {}).length,
        quests: Object.keys(d.quests || {}).length,
        enemies: Object.keys(d.enemies || {}).length,
        items: Object.keys(d.items || {}).length,
        classes: Object.keys(d.classes || {}).length,
        abilities: Object.keys(d.progression?.abilities || {}).length
      };
    },

    getDashboardValidationHints() {
      if (!this.data) return { hasIssues: false, errors: 0, deadEnds: 0, broken: 0 };
      const result = typeof this.validateProject === 'function'
        ? this.validateProject()
        : { errors: [], deadEnds: [], brokenLinks: [] };
      const errors = (result.errors || []).length;
      const deadEnds = (result.deadEnds || []).length;
      const broken = (result.brokenLinks || []).length;
      return {
        hasIssues: errors > 0 || deadEnds > 0 || broken > 0,
        errors,
        deadEnds,
        broken,
        result
      };
    },

    renderDashboardThemePreview() {
      const theme = this.data?.theme || (typeof ThemeSystem !== 'undefined' ? ThemeSystem.getDefaultTheme() : {});
      const colors = [
        { key: 'pageBg', label: 'pageBg', fallback: '#e8dcc8' },
        { key: 'paper', label: 'paper', fallback: '#f5f0e8' },
        { key: 'accent', label: 'accent', fallback: '#8b4513' },
        { key: 'ink', label: 'ink', fallback: '#2c2418' }
      ];
      const swatches = colors.map(({ key, label, fallback }) => {
        const val = theme[key] || fallback;
        return `<div class="dashboard-theme-swatch" title="${this.escapeAttr(label)}">
          <span class="dashboard-theme-color" style="background:${this.escapeAttr(val)}"></span>
          <span class="dashboard-theme-label">${this.escapeHtml(label)}</span>
          <code>${this.escapeHtml(val)}</code>
        </div>`;
      }).join('');
      return `<div class="dashboard-theme-preview paper-sheet">
        <h4>🎨 Тема интерфейса</h4>
        <div class="dashboard-theme-swatches">${swatches}</div>
      </div>`;
    },

    renderDashboard() {
      if (!this.data) {
        return `<div class="paper-sheet dashboard-empty">
          <h2>Дашборд проекта</h2>
          <p class="hint">Создайте новый проект или загрузите <code>game_data.json</code>.</p>
          <div class="dashboard-actions">
            <button type="button" class="btn btn-info" onclick="Editor.newProject()">📄 Новый проект</button>
            <button type="button" class="btn btn-secondary" onclick="Editor.loadData()">📂 Загрузить JSON</button>
          </div>
        </div>`;
      }

      const meta = this.data.meta || {};
      const systemId = meta.system || (typeof SystemRegistry !== 'undefined' ? SystemRegistry.getDefault() : 'dnd5e');
      const systemLabel = typeof Editor.getRuleSystemLabel === 'function'
        ? Editor.getRuleSystemLabel(systemId)
        : (typeof SystemRegistry !== 'undefined' ? (SystemRegistry.get(systemId)?.label || systemId) : systemId);
      const stats = this.getDashboardStats();
      const val = this.getDashboardValidationHints();

      const statCards = [
        ['🎬', 'Сцен', stats.scenes],
        ['📜', 'Квестов', stats.quests],
        ['⚔️', 'Врагов', stats.enemies],
        ['🎒', 'Предметов', stats.items],
        ['🏅', 'Классов', stats.classes],
        ['✨', 'Умений', stats.abilities]
      ].map(([icon, label, n]) =>
        `<div class="dashboard-stat-card paper-sheet">
          <div class="dashboard-stat-icon">${icon}</div>
          <div class="dashboard-stat-value">${n}</div>
          <div class="dashboard-stat-label">${label}</div>
        </div>`
      ).join('');

      const warnBlock = val.hasIssues
        ? `<div class="dashboard-warn paper-sheet">
            <h4>⚠️ Предупреждения</h4>
            <p class="hint">Битых ссылок: <strong>${val.errors}</strong>, тупиков: <strong>${val.deadEnds}</strong>.</p>
            <button type="button" class="btn btn-danger" onclick="Editor.runProjectValidation()">🔍 Проверить проект</button>
          </div>`
        : `<div class="dashboard-ok paper-sheet hint">✅ Критичных битых ссылок не найдено. <button type="button" class="btn btn-secondary" style="font-size:12px;margin-left:8px;" onclick="Editor.runProjectValidation()">🔍 Проверить</button></div>`;

      return `<div class="dashboard-root">
        <div class="paper-sheet dashboard-header">
          <h2>${this.escapeHtml(meta.title || 'Без названия')}</h2>
          <p class="hint">Версия: ${this.escapeHtml(meta.version || '—')} · Автор: ${this.escapeHtml(meta.author || '—')} · Система: <strong>${this.escapeHtml(systemLabel)}</strong> (<code>${this.escapeHtml(systemId)}</code>)</p>
          ${meta.description ? `<p>${this.escapeHtml(meta.description)}</p>` : ''}
        </div>
        <div class="dashboard-stats-grid">${statCards}</div>
        ${warnBlock}
        <div class="paper-sheet dashboard-actions">
          <h4>Быстрые действия</h4>
          <div class="dashboard-actions-row">
            <button type="button" class="btn btn-primary" onclick="Editor.createScene()">+ Новая сцена</button>
            <button type="button" class="btn btn-secondary" onclick="Editor.loadData()">📂 Загрузить JSON</button>
            <button type="button" class="btn btn-primary" onclick="Editor.exportData()">💾 Сохранить JSON</button>
            <button type="button" class="btn btn-info" onclick="Editor.exportGameStandalone()">📦 Экспорт игры</button>
          </div>
        </div>
        ${this.renderDashboardThemePreview()}
      </div>`;
    },

    showDashboard() {
      this.currentTab = 'dashboard';
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      const dash = document.getElementById('tab-dashboard');
      if (dash) {
        dash.classList.add('active');
        dash.innerHTML = this.renderDashboard();
      }
    },

    refreshDashboardIfVisible() {
      if (this.currentTab === 'dashboard') {
        const dash = document.getElementById('tab-dashboard');
        if (dash) dash.innerHTML = this.renderDashboard();
      }
    }
  });

  const origSwitchTab = Editor.switchTab.bind(Editor);
  Editor.switchTab = function (tab, event) {
    if (tab === 'dashboard') {
      this.showDashboard();
      return;
    }
    const dash = document.getElementById('tab-dashboard');
    if (dash) dash.classList.remove('active');
    origSwitchTab(tab, event);
    if (tab === 'scenes' && typeof this.scheduleLivePreviewUpdate === 'function') {
      this.scheduleLivePreviewUpdate();
    }
  };

  const origRenderAll = Editor.renderAll.bind(Editor);
  Editor.renderAll = function () {
    origRenderAll();
    this.refreshDashboardIfVisible();
  };

})();
