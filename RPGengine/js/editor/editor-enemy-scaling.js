// Редактор: вкладка «Баланс» — таблица масштабирования и отчёт

(function attachEditorEnemyScaling() {
  if (typeof Editor === 'undefined') {
    console.error('editor-enemy-scaling.js: Editor не определён');
    return;
  }

  if (typeof EnemyScaling === 'undefined') {
    console.error('editor-enemy-scaling.js: EnemyScaling не подключён');
    return;
  }

  Object.assign(Editor, {
    ensureEnemyScaling() {
      if (!this.data) return null;
      this.data.enemyScaling = EnemyScaling.ensureConfig(this.data.enemyScaling);
      return this.data.enemyScaling;
    },

    getScalingLevelList(cfg) {
      return EnemyScaling.getScalingLevels(cfg);
    },

    renderBalance() {
      const c = document.getElementById('balance-editor');
      if (!c) return;
      if (!this.data) {
        c.innerHTML = '<div class="empty-state"><h2>Загрузите данные</h2></div>';
        return;
      }

      const es = this.ensureEnemyScaling();
      const levels = this.getScalingLevelList(es);
      const baseLevel = es.baseLevel ?? 1;

      const rows = levels.map((lvl, idx) => {
        const row = es.scaling[lvl];
        return `<tr>
          <td><input type="number" min="1" max="20" value="${lvl}" style="width:52px"
            onchange="Editor.updateScalingLevelKey(${idx}, ${lvl}, parseInt(this.value,10))"></td>
          <td><input type="number" min="1" step="0.1" value="${row.hpRate}"
            onchange="Editor.updateScalingRow(${lvl},'hpRate',parseFloat(this.value))"></td>
          <td><input type="number" min="0" step="1" value="${row.atkBonus}"
            onchange="Editor.updateScalingRow(${lvl},'atkBonus',parseInt(this.value,10)||0)"></td>
          <td><input type="number" min="0" step="1" value="${row.acBonus}"
            onchange="Editor.updateScalingRow(${lvl},'acBonus',parseInt(this.value,10)||0)"></td>
          <td><button type="button" class="btn-remove" title="Удалить уровень"
            onclick="Editor.removeScalingLevel(${lvl})">×</button></td>
        </tr>`;
      }).join('');

      c.innerHTML = `
        <div class="balance-editor-panel project-info">
          <h2>⚖️ Баланс</h2>
          <p class="hint">Таблица сохраняется в <code>game_data.json</code> → <code>enemyScaling</code>. В бою используется уровень игрока из сохранения.</p>

          <div class="form-group">
            <label><input type="checkbox" ${es.enabled !== false ? 'checked' : ''}
              onchange="Editor.updateEnemyScaling('enabled', this.checked)"> Масштабирование включено</label>
          </div>

          <h3 class="balance-section-title">Масштабирование врагов</h3>

          <div class="form-group">
            <label>Базовый уровень игрока (с какого уровня применять таблицу)</label>
            <input type="number" min="1" max="20" value="${baseLevel}" style="max-width:120px"
              onchange="Editor.updateEnemyScaling('baseLevel', parseInt(this.value,10)||1)">
          </div>

          <div class="balance-table-wrap">
            <table class="balance-scaling-table">
              <thead>
                <tr>
                  <th>Уровень</th>
                  <th>HP множ.</th>
                  <th>Атака</th>
                  <th>КД</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>${rows || '<tr><td colspan="5" class="hint">Нет строк — добавьте уровень.</td></tr>'}</tbody>
            </table>
          </div>

          <div class="balance-actions-row">
            <button type="button" class="btn btn-secondary" onclick="Editor.addScalingLevel()">+ Добавить уровень</button>
            <button type="button" class="btn btn-secondary" onclick="Editor.resetEnemyScalingDefaults()">Сбросить до default</button>
          </div>

          <div class="form-group" style="margin-top:16px;">
            <label>Босс-множитель HP (× к HP-множителю строки таблицы)</label>
            <input type="number" min="1" step="0.1" value="${es.bossHpRate ?? 1.5}" style="max-width:120px"
              onchange="Editor.updateEnemyScaling('bossHpRate', parseFloat(this.value)||1.5)">
            <p class="hint">Для врагов с флажком «Босс» в редакторе врагов.</p>
          </div>

          <h3 class="balance-section-title">Проверка проекта</h3>
          <button type="button" class="btn btn-primary" onclick="Editor.generateBalanceReport()">🔍 Сгенерировать отчёт</button>
          <div id="balance-report-output" class="balance-report-output"></div>
        </div>`;
    },

    updateEnemyScaling(field, value) {
      const es = this.ensureEnemyScaling();
      if (!es) return;
      es[field] = value;
      this.updateJSONPreview();
      if (field === 'enabled' || field === 'baseLevel') this.renderBalance();
    },

    updateScalingRow(level, field, value) {
      const es = this.ensureEnemyScaling();
      if (!es?.scaling?.[level]) return;
      if (field === 'hpRate') {
        es.scaling[level].hpRate = Math.max(1, Number(value) || 1);
      } else {
        es.scaling[level][field] = Math.max(0, parseInt(value, 10) || 0);
      }
      this.updateJSONPreview();
    },

    updateScalingLevelKey(idx, oldLevel, newLevel) {
      const es = this.ensureEnemyScaling();
      if (!es?.scaling || !newLevel || newLevel < 1) {
        this.renderBalance();
        return;
      }
      const levels = this.getScalingLevelList(es);
      if (levels.includes(newLevel) && newLevel !== oldLevel) {
        alert('Такой уровень уже есть в таблице');
        this.renderBalance();
        return;
      }
      es.scaling[newLevel] = { ...es.scaling[oldLevel] };
      delete es.scaling[oldLevel];
      es.scaling = EnemyScaling.normalizeScalingTable(es.scaling);
      this.renderBalance();
      this.updateJSONPreview();
    },

    addScalingLevel() {
      const es = this.ensureEnemyScaling();
      const levels = this.getScalingLevelList(es);
      const next = levels.length ? Math.max(...levels) + 1 : 1;
      if (next > 20) {
        alert('Максимум 20 уровней в таблице');
        return;
      }
      const prev = es.scaling[levels[levels.length - 1]] || { hpRate: 1, atkBonus: 0, acBonus: 0 };
      es.scaling[next] = {
        hpRate: Math.round((prev.hpRate + 0.2) * 10) / 10,
        atkBonus: prev.atkBonus,
        acBonus: prev.acBonus
      };
      this.renderBalance();
      this.updateJSONPreview();
    },

    removeScalingLevel(level) {
      const es = this.ensureEnemyScaling();
      const levels = this.getScalingLevelList(es);
      if (levels.length <= 1) {
        alert('Нужна хотя бы одна строка в таблице');
        return;
      }
      delete es.scaling[level];
      this.renderBalance();
      this.updateJSONPreview();
    },

    resetEnemyScalingDefaults() {
      if (!confirm('Сбросить таблицу масштабирования к значениям по умолчанию?')) return;
      this.data.enemyScaling = {
        enabled: true,
        baseLevel: EnemyScaling.DEFAULT_BASE_LEVEL,
        bossHpRate: EnemyScaling.DEFAULT_BOSS_HP_RATE,
        scaling: JSON.parse(JSON.stringify(EnemyScaling.DEFAULT_SCALING))
      };
      this.renderBalance();
      this.updateJSONPreview();
    },

    generateBalanceReport() {
      const out = document.getElementById('balance-report-output');
      if (!this.data) return;
      const report = EnemyScaling.generateBalanceReport(this.data);
      if (out) out.innerHTML = this.renderBalanceReportHtml(report);
    },

    renderBalanceReportHtml(report) {
      if (!report.encounters.length) {
        return `<div class="balance-report-card"><h3>Отчёт по балансу</h3>
          <p class="hint">Нет боевых сцен с полем <code>combat</code>.</p>
          ${report.recommendations.map((r) => `<p>💡 ${this.escapeHtml(r)}</p>`).join('')}</div>`;
      }

      let html = `<div class="balance-report-card"><h3>📊 Отчёт по балансу</h3>
        <p class="hint">Оценка: 🟢 3–6 ходов до смерти игрока · 🟡 2–3 · 🔴 1–2 · ⚪ 7+ (легко). Урон — средний за ход (упрощённо).</p>`;

      report.encounters.forEach((enc) => {
        html += `<div class="balance-encounter"><h4>📍 ${this.escapeHtml(enc.location)}</h4>
          <div class="hint" style="margin-bottom:8px;">ID сцены: <code>${this.escapeHtml(enc.sceneId)}</code></div>`;

        enc.enemies.forEach((block) => {
          html += `<div class="balance-enemy-block">
            <strong>Враг: ${this.escapeHtml(block.name)} (×${block.count})</strong>`;

          block.levelResults.forEach((lr) => {
            const s = lr.scaled;
            html += `<div class="balance-level-row">
              <div><b>На уровне ${lr.playerLevel}:</b></div>
              <div>Враг ОЗ: ${s.hp}, урон/ход: ~${lr.enemyDpt}, КД: ${s.ac}, атака: +${s.atkBonus}</div>
              <div>Игрок (воин): ОЗ ${lr.player.hp}, урон/ход: ~${lr.playerDpt}</div>
              <div>Ходов до смерти игрока: <b>${lr.playerTurnsToDie}</b> · до победы над врагом: <b>${lr.enemyTurnsToDie}</b></div>
              <div class="balance-rating balance-rating--${lr.rating.id}">${lr.rating.icon} ${this.escapeHtml(lr.rating.label)}</div>
            </div>`;
          });
          html += '</div>';
        });
        html += '</div>';
      });

      if (report.recommendations.length) {
        html += `<div class="balance-recommendations"><h4>💡 Рекомендации</h4><ul>`;
        report.recommendations.forEach((r) => {
          html += `<li>${this.escapeHtml(r)}</li>`;
        });
        html += '</ul></div>';
      }

      html += '</div>';
      return html;
    },

    updateEnemyScaleWithLevel(enemyId, checked) {
      const e = this.data?.enemies?.[enemyId];
      if (!e) return;
      if (checked) delete e.scaleWithPlayerLevel;
      else e.scaleWithPlayerLevel = false;
      this.updateJSONPreview();
      this.renderEnemies();
    }
  });

  // Прогрессия: краткая ссылка на вкладку «Баланс»
  const origRenderProgression = Editor.renderProgression;
  Editor.renderProgression = function renderProgressionWithScalingHint() {
    origRenderProgression.call(this);
    const panel = document.getElementById('enemy-scaling-editor');
    if (panel) {
      panel.innerHTML = `<div class="project-info hint-box">
        <p>⚖️ Масштабирование врагов перенесено во вкладку <strong>Баланс</strong>.</p>
        <button type="button" class="btn btn-secondary" onclick="Editor.switchTab('balance', event)">Открыть «Баланс»</button>
      </div>`;
    }
  };
})();
