// Редактор: настройки игрового времени
(function attachEditorTimeSettings() {
  if (typeof Editor === 'undefined') return;

  Editor.ensureTimeSettings = function () {
    if (!this.data.settings) this.data.settings = {};
    if (!this.data.settings.timeScale || typeof this.data.settings.timeScale !== 'object') {
      this.data.settings.timeScale = {
        realMinutesPerGameHour: 3,
        startHour: 8,
        startDay: 1,
        enabled: true
      };
    }
    return this.data.settings.timeScale;
  };

  Editor.renderTimeSettingsBlock = function () {
    const ts = this.ensureTimeSettings();
    const enabled = ts.enabled !== false;
    return `<div class="form-group" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
      <label><strong>⏰ Игровое время</strong></label>
      <label style="display:block;margin:8px 0;">
        <input type="checkbox" ${enabled ? 'checked' : ''}
          onchange="Editor.updateTimeSetting('enabled', this.checked)"> Смена времени суток
      </label>
      <div class="form-group">
        <label>1 игровой час = реальных минут</label>
        <input type="number" min="1" max="120" value="${ts.realMinutesPerGameHour ?? 3}"
          onchange="Editor.updateTimeSetting('realMinutesPerGameHour', parseFloat(this.value)||3)">
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>Начальный час (0–23)</label>
          <input type="number" min="0" max="23" value="${ts.startHour ?? 8}"
            onchange="Editor.updateTimeSetting('startHour', parseInt(this.value,10)||8)">
        </div>
        <div class="form-group">
          <label>Начальный день</label>
          <input type="number" min="1" value="${ts.startDay ?? 1}"
            onchange="Editor.updateTimeSetting('startDay', parseInt(this.value,10)||1)">
        </div>
      </div>
      <p class="hint">Периоды: рассвет 5–8, день 8–17, сумерки 17–20, ночь 20–5. В сценах — поле <code>timeVariants</code>.</p>
    </div>`;
  };

  Editor.updateTimeSetting = function (key, value) {
    const ts = this.ensureTimeSettings();
    ts[key] = value;
    this.updateJSONPreview();
    this.updateProjectPanel?.();
  };

  const origPanel = Editor.updateProjectPanel;
  if (typeof origPanel === 'function') {
    Editor.updateProjectPanel = function () {
      origPanel.call(this);
      const p = document.getElementById('project-panel');
      if (!p || !this.data) return;
      const block = this.renderTimeSettingsBlock();
      if (!p.innerHTML.includes('⏰ Игровое время')) {
        p.innerHTML += block;
      }
    };
  }
})();
