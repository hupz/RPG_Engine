// Редактор: дашборд проекта

(function attachEditorDashboard() {
  if (typeof Editor === 'undefined') {
    console.error('editor-dashboard.js: Editor не определён');
    return;
  }

  Object.assign(Editor, {
    getDashboardStats() {
      if (typeof this.getProjectContentStats === 'function') {
        const cs = this.getProjectContentStats();
        return {
          scenes: cs.scenes || 0,
          quests: cs.quests || 0,
          enemies: cs.enemies || 0,
          items: cs.items || 0,
          classes: Object.keys(this.data?.classes || {}).length,
          abilities: Object.keys(this.data?.progression?.abilities || {}).length,
          visualScenes: cs.visual_scenes || 0,
          npcs: cs.npcs || 0,
          playerCharacters: cs.player_characters || 0,
          uiScreens: cs.ui_screens || 0,
          assets: cs.assets || 0
        };
      }
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
      const tr = (k, p) => (typeof t === 'function' ? t(k, p) : k);
      if (!this.data) {
        return `<div class="paper-sheet dashboard-empty">
          <h2>${tr('editor.dashboard.title')}</h2>
          <p class="hint">${tr('editor.dashboard.emptyHint')}</p>
          <div class="dashboard-actions">
            <button type="button" class="btn btn-info" onclick="Editor.newProject()">📄 ${tr('editor.dashboard.newBtn')}</button>
            <button type="button" class="btn btn-secondary" onclick="Editor.loadData()">📂 ${tr('editor.dashboard.loadBtn')}</button>
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
        ['🎬', tr('editor.dashboard.statsScenes'), stats.scenes],
        ['📜', tr('editor.dashboard.statsQuests'), stats.quests],
        ['⚔️', tr('editor.dashboard.statsEnemies'), stats.enemies],
        ['🎒', tr('editor.dashboard.statsItems'), stats.items],
        ['🏅', tr('editor.dashboard.statsClasses'), stats.classes],
        ['✨', tr('editor.dashboard.statsAbilities'), stats.abilities]
      ].map(([icon, label, n]) =>
        `<div class="dashboard-stat-card paper-sheet">
          <div class="dashboard-stat-icon">${icon}</div>
          <div class="dashboard-stat-value">${n}</div>
          <div class="dashboard-stat-label">${label}</div>
        </div>`
      ).join('');

      const warnBlock = val.hasIssues
        ? `<div class="dashboard-warn paper-sheet">
            <h4>⚠️ ${tr('editor.dashboard.warnTitle')}</h4>
            <p class="hint">${tr('editor.dashboard.warnBroken', { errors: val.errors, deadEnds: val.deadEnds })}</p>
            <button type="button" class="btn btn-danger" onclick="Editor.runProjectValidation()">🔍 ${tr('editor.dashboard.validateBtn')}</button>
          </div>`
        : `<div class="dashboard-ok paper-sheet hint">✅ ${tr('editor.dashboard.warnOk')} <button type="button" class="btn btn-secondary" style="font-size:12px;margin-left:8px;" onclick="Editor.runProjectValidation()">🔍 ${tr('editor.validate')}</button></div>`;

      return `<div class="dashboard-root">
        <div class="paper-sheet dashboard-header">
          <h2>${this.escapeHtml(meta.title || 'Без названия')}</h2>
          <p class="hint">${tr('editor.project.version')}: ${this.escapeHtml(meta.version || '—')} · ${tr('editor.project.author')}: ${this.escapeHtml(meta.author || '—')} · ${tr('editor.project.system')}: <strong>${this.escapeHtml(systemLabel)}</strong> (<code>${this.escapeHtml(systemId)}</code>)</p>
          ${meta.description ? `<p>${this.escapeHtml(meta.description)}</p>` : ''}
        </div>
        <div class="dashboard-stats-grid">${statCards}</div>
        ${warnBlock}
        <div class="paper-sheet dashboard-actions">
          <h4>${tr('editor.dashboard.quickActions')}</h4>
          <div class="dashboard-actions-row">
            <button type="button" class="btn btn-primary" onclick="Editor.openSceneWizard()">+ ${tr('editor.dashboard.newScene')}</button>
            <button type="button" class="btn btn-secondary" onclick="Editor.loadData()">📂 ${tr('editor.dashboard.loadBtn')}</button>
            <button type="button" class="btn btn-primary" onclick="Editor.exportJSON()">📁 ${tr('editor.dashboard.saveJson')}</button>
            <button type="button" class="btn btn-info" onclick="Editor.openExportHtmlModal()">🌐 ${tr('editor.dashboard.exportHtml')}</button>
          </div>
        </div>
        ${typeof this.renderProjectDashboardContentSection === 'function' ? this.renderProjectDashboardContentSection() : ''}
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
        setTimeout(() => {
          const section = dash.querySelector('.dashboard-content-section');
          if (section && typeof this.bindContentBrowserEvents === 'function') {
            this.bindContentBrowserEvents(section);
          }
        }, 0);
      }
    },

    refreshDashboardIfVisible() {
      if (this.currentTab === 'dashboard') {
        const dash = document.getElementById('tab-dashboard');
        if (dash) {
          dash.innerHTML = this.renderDashboard();
          setTimeout(() => {
            const section = dash.querySelector('.dashboard-content-section');
            if (section && typeof this.bindContentBrowserEvents === 'function') {
              this.bindContentBrowserEvents(section);
            }
          }, 0);
        }
      }
    }
  });

  // Canonical owner for full showDashboard (replaces core stub in _impl)
  if (Editor.hooks && typeof Editor.hooks.register === 'function') {
    Editor.hooks.register('editor-dashboard', {
      showDashboard: Editor.showDashboard,
      refreshDashboardIfVisible: Editor.refreshDashboardIfVisible,
      renderDashboard: Editor.renderDashboard
    }, { force: true });
  }

  // Dashboard intercept must own switchTab impl via hooks.replace (not nested monkey-patch)
  if (Editor.hooks && typeof Editor.hooks.replace === 'function') {
    const prevSwitch = Editor.hooks.replace('switchTab', function (tab, event) {
      if (tab === 'dashboard') {
        this.showDashboard();
        return;
      }
      const dash = document.getElementById('tab-dashboard');
      if (dash) dash.classList.remove('active');
      const r = typeof prevSwitch === 'function' ? prevSwitch.call(this, tab, event) : undefined;
      if (tab === 'scenes' && typeof this.scheduleLivePreviewUpdate === 'function') {
        this.scheduleLivePreviewUpdate();
      }
      return r;
    }, 'editor-dashboard');
  } else if (typeof console !== 'undefined' && console.warn) {
    console.warn('[editor-dashboard] Editor.hooks missing — switchTab dashboard intercept skipped');
  }

  // after renderAll only — never wrap as Editor.renderAll → renderAll
  if (Editor.hooks && typeof Editor.hooks.after === 'function') {
    Editor.hooks.after('renderAll', function () {
      if (typeof Editor.refreshDashboardIfVisible === 'function') {
        Editor.refreshDashboardIfVisible();
      }
    });
  } else if (typeof console !== 'undefined' && console.warn) {
    console.warn('[editor-dashboard] Editor.hooks missing — renderAll dashboard refresh skipped');
  }

})();
