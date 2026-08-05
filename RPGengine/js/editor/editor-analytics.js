// Вкладка «Аналитика» — локальная статистика прохождения (localStorage)

(function attachEditorAnalytics() {
  if (typeof Editor === 'undefined') {
    console.error('editor-analytics.js: Editor не определён');
    return;
  }
  if (typeof AnalyticsSystem === 'undefined') {
    console.error('editor-analytics.js: AnalyticsSystem не определён');
    return;
  }

  const AS = AnalyticsSystem;

  Object.assign(Editor, {
    _analyticsSelectedKey: null,

    getAnalyticsProjectKeys() {
      const keys = AS.listProjectKeys();
      const preferred = this.getAnalyticsProjectKey();
      if (preferred && !keys.includes(preferred)) keys.unshift(preferred);
      return [...new Set(keys)];
    },

    getAnalyticsProjectKey() {
      if (!this.data) return null;
      return AS.getProjectKeyFromMeta(this.data.meta || {});
    },

    getAnalyticsStore(projectKey) {
      const pk = projectKey || this._analyticsSelectedKey || this.getAnalyticsProjectKey();
      if (!pk) return AS.emptyStore('default');
      return AS.loadStore(pk);
    },

    selectAnalyticsProjectKey(key) {
      this._analyticsSelectedKey = key || null;
      this.renderAnalytics();
    },

    exportAnalyticsCsv() {
      const store = this.getAnalyticsStore();
      const title = (this.data?.meta?.title || store.projectTitle || 'analytics')
        .replace(/[^\wа-яё\-]+/gi, '_')
        .slice(0, 40);
      AS.downloadCsv(store, `${title}_analytics.csv`);
    },

    clearAnalyticsData() {
      const pk = this._analyticsSelectedKey || this.getAnalyticsProjectKey();
      if (!pk) return;
      if (!confirm('Удалить всю локальную аналитику для этого проекта? Действие необратимо.')) return;
      try {
        localStorage.removeItem(AS.storageKey(pk));
      } catch (_) { /* ignore */ }
      this.renderAnalytics();
    },

    drawSceneVisitsChart(canvas, sceneVisits, sceneLabels) {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(320, Math.floor(rect.width));
      const h = Math.max(220, Math.floor(rect.height));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const entries = Object.entries(sceneVisits || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 16);

      if (!entries.length) {
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink-light').trim() || '#888';
        ctx.font = '14px Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Нет данных о посещениях сцен', w / 2, h / 2);
        return;
      }

      const maxVal = Math.max(1, ...entries.map((e) => e[1]));
      const padL = 12;
      const padR = 12;
      const padT = 24;
      const padB = 72;
      const chartW = w - padL - padR;
      const chartH = h - padT - padB;
      const barGap = 6;
      const barW = Math.max(8, (chartW - barGap * (entries.length - 1)) / entries.length);
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#8b4513';
      const ink = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#2c2418';

      ctx.strokeStyle = 'rgba(128,128,128,0.25)';
      ctx.beginPath();
      ctx.moveTo(padL, padT + chartH);
      ctx.lineTo(padL + chartW, padT + chartH);
      ctx.stroke();

      entries.forEach(([sceneId, count], i) => {
        const barH = (count / maxVal) * chartH;
        const x = padL + i * (barW + barGap);
        const y = padT + chartH - barH;
        const grad = ctx.createLinearGradient(0, y, 0, padT + chartH);
        grad.addColorStop(0, accent);
        grad.addColorStop(1, 'rgba(139,69,19,0.45)');
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barW, barH);

        ctx.fillStyle = ink;
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(count), x + barW / 2, y - 4);

        const label = sceneLabels[sceneId] || sceneId;
        const short = label.length > 10 ? label.slice(0, 9) + '…' : label;
        ctx.save();
        ctx.translate(x + barW / 2, padT + chartH + 8);
        ctx.rotate(-0.55);
        ctx.font = '10px Segoe UI, sans-serif';
        ctx.fillStyle = ink;
        ctx.fillText(short, 0, 0);
        ctx.restore();
      });

      ctx.fillStyle = ink;
      ctx.font = '13px Segoe UI, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Посещения сцен (топ)', padL, 16);
    },

    buildChoiceHeatmapRows(choices, scenes) {
      const byScene = {};
      Object.entries(choices || {}).forEach(([key, count]) => {
        const parts = key.split('::');
        const sceneId = parts[0] || '?';
        const choiceIndex = parseInt(parts[1], 10);
        const text = parts.slice(2).join('::') || parts[1] || key;
        if (!byScene[sceneId]) byScene[sceneId] = [];
        byScene[sceneId].push({ choiceIndex, text, count });
      });

      const sceneIds = Object.keys(byScene).sort((a, b) => {
        const sumA = byScene[a].reduce((s, r) => s + r.count, 0);
        const sumB = byScene[b].reduce((s, r) => s + r.count, 0);
        return sumB - sumA;
      });

      let maxCount = 1;
      sceneIds.forEach((id) => {
        byScene[id].forEach((r) => { if (r.count > maxCount) maxCount = r.count; });
      });

      return { byScene, sceneIds, maxCount, scenes };
    },

    renderChoiceHeatmapHtml(choices) {
      const scenes = this.data?.scenes || {};
      const { byScene, sceneIds, maxCount } = this.buildChoiceHeatmapRows(choices, scenes);

      if (!sceneIds.length) {
        return '<p class="hint analytics-empty-hint">Пока нет данных о выборах в диалогах.</p>';
      }

      const rows = sceneIds.slice(0, 24).map((sceneId) => {
        const loc = scenes[sceneId]?.location || '';
        const header = loc
          ? `${this.escapeHtml(sceneId)} · ${this.escapeHtml(loc)}`
          : this.escapeHtml(sceneId);
        const choiceCells = byScene[sceneId]
          .sort((a, b) => (a.choiceIndex || 0) - (b.choiceIndex || 0) || b.count - a.count)
          .map((row) => {
            const intensity = Math.max(0.12, row.count / maxCount);
            const pct = Math.round(intensity * 100);
            return `<div class="analytics-heatmap-cell" style="--heat:${intensity}" title="${this.escapeAttr(row.text)} — ${row.count}">
              <span class="analytics-heatmap-count">${row.count}</span>
              <span class="analytics-heatmap-text">${this.escapeHtml(row.text.slice(0, 48))}${row.text.length > 48 ? '…' : ''}</span>
              <span class="analytics-heatmap-bar" style="width:${pct}%"></span>
            </div>`;
          }).join('');
        return `<div class="analytics-heatmap-scene">
          <div class="analytics-heatmap-scene-title">${header}</div>
          <div class="analytics-heatmap-choices">${choiceCells}</div>
        </div>`;
      }).join('');

      return `<div class="analytics-heatmap">${rows}</div>`;
    },

    renderAnalyticsSummaryCards(agg, store) {
      const cards = [
        ['🚀', 'Запусков', agg.totalLaunches],
        ['⏱️', 'Среднее время', AS.formatDuration(agg.avgSessionMs)],
        ['💀', 'Смертей', agg.totalDeaths],
        ['📊', 'Сессий', agg.sessionCount],
        ['⌛', 'Всего времени', AS.formatDuration(agg.totalPlayMs)]
      ];
      return cards.map(([icon, label, val]) =>
        `<div class="analytics-stat-card paper-sheet">
          <div class="analytics-stat-icon">${icon}</div>
          <div class="analytics-stat-value">${this.escapeHtml(String(val))}</div>
          <div class="analytics-stat-label">${label}</div>
        </div>`
      ).join('');
    },

    renderAnalyticsItemsTable(items) {
      const entries = Object.entries(items || {}).sort((a, b) => b[1] - a[1]).slice(0, 20);
      if (!entries.length) return '<p class="hint">Предметы ещё не подбирали.</p>';
      const itemMeta = this.data?.items || {};
      const rows = entries.map(([id, n]) => {
        const name = itemMeta[id]?.name || id;
        return `<tr><td><code>${this.escapeHtml(id)}</code></td><td>${this.escapeHtml(name)}</td><td>${n}</td></tr>`;
      }).join('');
      return `<table class="analytics-table"><thead><tr><th>ID</th><th>Название</th><th>Раз</th></tr></thead><tbody>${rows}</tbody></table>`;
    },

    renderAnalyticsPathSamples(pathSamples) {
      const samples = (pathSamples || []).slice(-8).reverse();
      if (!samples.length) return '<p class="hint">Маршруты появятся после завершённых сессий.</p>';
      return samples.map((path, i) =>
        `<div class="analytics-path-sample"><span class="analytics-path-label">#${samples.length - i}</span> ${path.map((id) => `<code>${this.escapeHtml(id)}</code>`).join(' → ')}</div>`
      ).join('');
    },

    renderAnalytics() {
      const root = document.getElementById('analytics-editor');
      if (!root) return;

      if (!this.data) {
        root.innerHTML = '<div class="empty-state"><h2>Загрузите данные</h2><p class="hint">Аналитика читается из localStorage браузера, куда игра записывает статистику при прохождении.</p></div>';
        return;
      }

      const keys = this.getAnalyticsProjectKeys();
      const preferred = this.getAnalyticsProjectKey();
      const selectedKey = this._analyticsSelectedKey || preferred || keys[0] || null;
      this._analyticsSelectedKey = selectedKey;

      const store = selectedKey ? AS.loadStore(selectedKey) : AS.emptyStore('default');
      const agg = AS.getAggregates(store);
      const sceneLabels = {};
      Object.entries(this.data.scenes || {}).forEach(([id, sc]) => {
        sceneLabels[id] = sc.location || id;
      });

      const keyOptions = keys.length
        ? keys.map((k) => {
          const s = AS.loadStore(k);
          const label = s.projectTitle || k;
          const sel = k === selectedKey ? ' selected' : '';
          return `<option value="${this.escapeAttr(k)}"${sel}>${this.escapeHtml(label)} (${this.escapeHtml(k)})</option>`;
        }).join('')
        : `<option value="">— нет записей —</option>`;

      const privacyNote = `<p class="hint analytics-privacy">🔒 Данные хранятся только в <code>localStorage</code> этого браузера. Сервер не используется. Играйте в <a href="index.html" target="_blank" rel="noopener">режиме игры</a> на том же домене, чтобы накопить статистику.</p>`;

      root.innerHTML = `<div class="analytics-root">
        <div class="paper-sheet analytics-header">
          <h2>📈 Аналитика прохождения</h2>
          ${privacyNote}
          <div class="analytics-toolbar">
            <label class="analytics-key-label">Проект:
              <select class="analytics-key-select" onchange="Editor.selectAnalyticsProjectKey(this.value)">${keyOptions}</select>
            </label>
            <button type="button" class="btn btn-primary" onclick="Editor.exportAnalyticsCsv()">📥 Экспорт CSV</button>
            <button type="button" class="btn btn-secondary" onclick="Editor.renderAnalytics()">🔄 Обновить</button>
            <button type="button" class="btn btn-danger" onclick="Editor.clearAnalyticsData()">🗑 Очистить</button>
          </div>
          ${!keys.length ? '<p class="hint analytics-warn">Записей аналитики пока нет. Запустите игру и пройдите несколько сцен.</p>' : ''}
        </div>

        <div class="analytics-stats-grid">${this.renderAnalyticsSummaryCards(agg, store)}</div>

        <div class="paper-sheet analytics-panel">
          <h3>Посещения сцен</h3>
          <p class="hint">Где игроки проводят больше всего времени — возможные «застревания» или популярные локации.</p>
          <div class="analytics-chart-wrap">
            <canvas id="analytics-scenes-chart" class="analytics-canvas" width="640" height="280" aria-label="График посещений сцен"></canvas>
          </div>
        </div>

        <div class="paper-sheet analytics-panel">
          <h3>Тепловая карта выборов</h3>
          <p class="hint">Популярность веток в диалогах: чем насыщеннее полоса, тем чаще выбирали вариант.</p>
          ${this.renderChoiceHeatmapHtml(agg.choices)}
        </div>

        <div class="analytics-two-col">
          <div class="paper-sheet analytics-panel">
            <h3>🎒 Подобранные предметы</h3>
            ${this.renderAnalyticsItemsTable(agg.items)}
          </div>
          <div class="paper-sheet analytics-panel">
            <h3>🛤 Примеры маршрутов</h3>
            <p class="hint">Порядок посещения сцен в последних сессиях.</p>
            <div class="analytics-paths">${this.renderAnalyticsPathSamples(agg.pathSamples)}</div>
          </div>
        </div>
      </div>`;

      requestAnimationFrame(() => {
        const canvas = document.getElementById('analytics-scenes-chart');
        if (canvas) {
          this.drawSceneVisitsChart(canvas, agg.sceneVisits, sceneLabels);
        }
      });
    }
  });

  const origSwitchTab = Editor.switchTab?.bind(Editor);
  if (origSwitchTab) {
    Editor.switchTab = function (tab, event) {
      origSwitchTab(tab, event);
      if (tab === 'analytics' && typeof this.renderAnalytics === 'function') {
        this.renderAnalytics();
      }
    };
  }

  const origRenderAll = Editor.renderAll?.bind(Editor);
  if (origRenderAll) {
    Editor.renderAll = function () {
      origRenderAll();
      if (this.currentTab === 'analytics') this.renderAnalytics();
    };
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    if (Editor.currentTab !== 'analytics') return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (typeof Editor.renderAnalytics === 'function') Editor.renderAnalytics();
    }, 200);
  });
})();
