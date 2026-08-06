// ============================================================
// Враги
// Вынесено из editor.html
// ============================================================
(function () {
  if (typeof Editor === 'undefined') {
    console.error('editor-enemies-panel.js: Editor не определён');
    return;
  }
  Object.assign(Editor, {
    renderEnemyLootSection(enemyId, enemy) {
      const loot = Array.isArray(enemy.loot) ? enemy.loot : [];
      const rows = loot.map((entry, idx) => `
        <div class="loot-editor-row" style="display:grid;grid-template-columns:2fr 1fr 0.6fr 0.6fr auto;gap:8px;align-items:end;margin-bottom:8px;">
          <div class="form-group"><label>Предмет</label>${this.renderLootItemSelect(enemyId, entry, idx)}</div>
          <div class="form-group"><label>Шанс (0–1)</label>
            <input type="number" min="0" max="1" step="0.05" value="${entry.chance ?? 1}" onchange="Editor.updateEnemyLoot('${enemyId}',${idx},'chance',parseFloat(this.value))">
          </div>
          <div class="form-group"><label>Min</label>
            <input type="number" min="0" value="${entry.min ?? 1}" onchange="Editor.updateEnemyLoot('${enemyId}',${idx},'min',parseInt(this.value)||0)">
          </div>
          <div class="form-group"><label>Max</label>
            <input type="number" min="0" value="${entry.max ?? 1}" onchange="Editor.updateEnemyLoot('${enemyId}',${idx},'max',parseInt(this.value)||0)">
          </div>
          <button type="button" class="btn btn-danger" onclick="Editor.removeEnemyLoot('${enemyId}',${idx})">✕</button>
        </div>`).join('');
      return `<div class="project-info" style="margin-top:12px;">
        <h4>Добыча (loot)</h4>
        ${rows || '<p class="hint">Таблица пуста — с врага ничего не падает.</p>'}
        <button type="button" class="btn btn-secondary" onclick="Editor.addEnemyLootEntry('${enemyId}')">+ Добавить предмет</button>
      </div>`;
    },

    updateEnemy(id, f, val) {
      if (!this.data.enemies?.[id]) return;
      this.data.enemies[id][f] = val;
      this.updateJSONPreview();
    }
  });
})();
