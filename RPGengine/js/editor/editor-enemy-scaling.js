// Редактор: масштабирование врагов под уровень игрока

(function attachEditorEnemyScaling() {
  if (typeof Editor === 'undefined') {
    console.error('editor-enemy-scaling.js: Editor не определён');
    return;
  }

  const DEFAULTS = {
    enabled: true,
    hpRatePerLevel: 0.155,
    bossHpRatePerLevel: 0.3,
    atkBonusPerEvenLevel: 1,
    damageMinPlayerLevel: 3,
    acBonuses: [
      { playerLevel: 5, bonus: 1 },
      { playerLevel: 10, bonus: 1 }
    ]
  };

  Object.assign(Editor, {
    ensureEnemyScaling() {
      if (!this.data) return null;
      if (!this.data.enemyScaling) {
        this.data.enemyScaling = JSON.parse(JSON.stringify(DEFAULTS));
      }
      const es = this.data.enemyScaling;
      if (es.enabled == null) es.enabled = true;
      if (es.hpRatePerLevel == null) es.hpRatePerLevel = DEFAULTS.hpRatePerLevel;
      if (es.bossHpRatePerLevel == null) es.bossHpRatePerLevel = DEFAULTS.bossHpRatePerLevel;
      if (es.atkBonusPerEvenLevel == null) es.atkBonusPerEvenLevel = DEFAULTS.atkBonusPerEvenLevel;
      if (es.damageMinPlayerLevel == null) es.damageMinPlayerLevel = DEFAULTS.damageMinPlayerLevel;
      if (!Array.isArray(es.acBonuses) || !es.acBonuses.length) {
        es.acBonuses = JSON.parse(JSON.stringify(DEFAULTS.acBonuses));
      }
      return es;
    },

    renderEnemyScalingSection() {
      const es = this.ensureEnemyScaling();
      if (!es) {
        return '<div class="project-info"><h4>Масштабирование врагов</h4><p class="hint">Загрузите game_data.json</p></div>';
      }
      const acRows = (es.acBonuses || []).map((row, idx) => `
        <div class="enemy-scale-ac-row" style="display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end;margin-bottom:8px;">
          <div class="form-group" style="margin:0;">
            <label>Уровень игрока ≥</label>
            <input type="number" min="2" value="${row.playerLevel ?? 5}"
              onchange="Editor.updateEnemyScalingAcRow(${idx},'playerLevel',parseInt(this.value,10)||0)">
          </div>
          <div class="form-group" style="margin:0;">
            <label>+КД</label>
            <input type="number" value="${row.bonus ?? 1}"
              onchange="Editor.updateEnemyScalingAcRow(${idx},'bonus',parseInt(this.value,10)||0)">
          </div>
          <button type="button" class="btn btn-danger" onclick="Editor.removeEnemyScalingAcRow(${idx})">×</button>
        </div>`).join('');

      return `<div class="project-info enemy-scaling-panel" style="border-color:#c62828;">
        <h4>⚔️ Масштабирование врагов</h4>
        <p class="hint" style="margin-bottom:12px;">Параметры применяются в бою по уровню игрока (<code>GameEngine.state.level</code>). На 1-м уровне враги без усиления.</p>
        <div class="form-group">
          <label><input type="checkbox" ${es.enabled !== false ? 'checked' : ''}
            onchange="Editor.updateEnemyScaling('enabled',this.checked)"> Включено</label>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="form-group">
            <label>ОЗ за уровень (обычный)</label>
            <input type="number" step="0.001" min="0" value="${es.hpRatePerLevel}"
              onchange="Editor.updateEnemyScaling('hpRatePerLevel',parseFloat(this.value)||0)">
            <div class="hint">Множитель: 1 + (ур−1) × значение. По умолчанию 0.155 (~15.5%)</div>
          </div>
          <div class="form-group">
            <label>ОЗ за уровень (босс)</label>
            <input type="number" step="0.001" min="0" value="${es.bossHpRatePerLevel}"
              onchange="Editor.updateEnemyScaling('bossHpRatePerLevel',parseFloat(this.value)||0)">
            <div class="hint">При <code>boss: true</code> у врага. По умолчанию 0.30</div>
          </div>
          <div class="form-group">
            <label>Бонус атаки за чётный уровень</label>
            <input type="number" step="1" min="0" value="${es.atkBonusPerEvenLevel}"
              onchange="Editor.updateEnemyScaling('atkBonusPerEvenLevel',parseFloat(this.value)||0)">
            <div class="hint">Итого: floor(ур/2) × значение (+1 на 2, 4, 6… при =1)</div>
          </div>
          <div class="form-group">
            <label>Урон: с уровня игрока</label>
            <input type="number" min="1" value="${es.damageMinPlayerLevel}"
              onchange="Editor.updateEnemyScaling('damageMinPlayerLevel',parseInt(this.value,10)||1)">
            <div class="hint">С этого уровня к бонусу урона добавляется число уровня (+3 на 3 ур.)</div>
          </div>
        </div>
        <div class="form-group">
          <label>Бонусы КД по порогам уровня</label>
          ${acRows || '<p class="hint">Нет порогов — КД не растёт с уровнем.</p>'}
          <button type="button" class="btn btn-secondary" style="margin-top:8px;" onclick="Editor.addEnemyScalingAcRow()">+ Порог КД</button>
        </div>
        <button type="button" class="btn btn-secondary" onclick="Editor.resetEnemyScalingDefaults()">↺ Сбросить по умолчанию</button>
      </div>`;
    },

    updateEnemyScaling(field, value) {
      const es = this.ensureEnemyScaling();
      if (!es) return;
      es[field] = value;
      this.updateJSONPreview();
    },

    updateEnemyScalingAcRow(idx, field, value) {
      const es = this.ensureEnemyScaling();
      if (!es?.acBonuses?.[idx]) return;
      es.acBonuses[idx][field] = value;
      this.updateJSONPreview();
    },

    addEnemyScalingAcRow() {
      const es = this.ensureEnemyScaling();
      if (!es) return;
      es.acBonuses.push({ playerLevel: 5, bonus: 1 });
      this.renderProgression();
      this.updateJSONPreview();
    },

    removeEnemyScalingAcRow(idx) {
      const es = this.ensureEnemyScaling();
      if (!es?.acBonuses) return;
      es.acBonuses.splice(idx, 1);
      this.renderProgression();
      this.updateJSONPreview();
    },

    resetEnemyScalingDefaults() {
      if (!confirm('Сбросить настройки масштабирования к значениям по умолчанию?')) return;
      this.data.enemyScaling = JSON.parse(JSON.stringify(DEFAULTS));
      this.renderProgression();
      this.updateJSONPreview();
    }
  });

  const origRenderProgression = Editor.renderProgression;
  Editor.renderProgression = function renderProgressionWithScaling() {
    const c = document.getElementById('progression-editor');
    if (!this.data) {
      if (c) c.innerHTML = '<div class="empty-state"><h2>Нет данных</h2></div>';
      return;
    }
    origRenderProgression.call(this);
    const panel = document.getElementById('enemy-scaling-editor');
    if (panel) panel.innerHTML = this.renderEnemyScalingSection();
  };

  const origRenderEnemies = Editor.renderEnemies;
  Editor.renderEnemies = function renderEnemiesWithBoss() {
    const c = document.getElementById('enemies-editor');
    if (!this.data?.enemies) {
      if (c) c.innerHTML = '<div class="empty-state"><h2>Нет данных</h2></div>';
      return;
    }
    this.ensureEnemyScaling();
    c.innerHTML = Object.entries(this.data.enemies).map(([id, e]) => `
      <div class="quest-editor">
        <h4>${this.escapeHtml(e.name || 'Без имени')} (${this.escapeHtml(id)})</h4>
        <div class="form-group">
          <label>Имя</label>
          <input value="${this.escapeAttr(e.name || '')}" onchange="Editor.updateEnemy('${this.escapeAttr(id)}','name',this.value)">
        </div>
        <div class="form-group">
          <label><input type="checkbox" ${e.boss ? 'checked' : ''}
            onchange="Editor.updateEnemy('${this.escapeAttr(id)}','boss',this.checked)"> Босс (усиленное ОЗ по настройкам)</label>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;">
          <div class="form-group"><label>HP</label><input type="number" value="${e.hp || 10}" onchange="Editor.updateEnemy('${this.escapeAttr(id)}','hp',parseInt(this.value,10))"></div>
          <div class="form-group"><label>КД</label><input type="number" value="${e.ac || 12}" onchange="Editor.updateEnemy('${this.escapeAttr(id)}','ac',parseInt(this.value,10))"></div>
          <div class="form-group"><label>Атака</label><input type="number" value="${e.atkBonus || 2}" onchange="Editor.updateEnemy('${this.escapeAttr(id)}','atkBonus',parseInt(this.value,10))"></div>
          <div class="form-group"><label>Урон</label><input value="${this.escapeAttr(e.dmgRoll || '1d6')}" onchange="Editor.updateEnemy('${this.escapeAttr(id)}','dmgRoll',this.value)"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
          <div class="form-group"><label>Бонус урона</label><input type="number" value="${e.dmgBonus || 0}" onchange="Editor.updateEnemy('${this.escapeAttr(id)}','dmgBonus',parseInt(this.value,10)||0)"></div>
          <div class="form-group"><label>Ловкость</label><input type="number" value="${e.dex || 2}" onchange="Editor.updateEnemy('${this.escapeAttr(id)}','dex',parseInt(this.value,10))"></div>
          <div class="form-group"><label>Опыт</label><input type="number" value="${e.exp ?? ''}" placeholder="20" onchange="Editor.updateEnemy('${this.escapeAttr(id)}','exp',parseInt(this.value,10)||0)"></div>
        </div>
        ${typeof this.renderEnemyLootSection === 'function' ? this.renderEnemyLootSection(id, e) : ''}
        <button class="btn btn-danger" onclick="Editor.deleteEnemy('${this.escapeAttr(id)}')">🗑 Удалить</button>
      </div>`).join('')
      + '<button class="btn btn-primary" style="width:100%;margin-top:16px;" onclick="Editor.createEnemy()">+ Новый враг</button>';
  };
})();
