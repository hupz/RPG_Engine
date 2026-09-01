// ============================================================
// engine/dialog.js — диалоговая система
// ============================================================

(function attachEngineDialog() {
  'use strict';
  if (typeof GameEngine === 'undefined') {
    console.error('engine/dialog.js: GameEngine не определён — загрузите core.js первым');
    return;
  }

  Object.assign(GameEngine, {
    setDialogue(lines) {
      const area = document.getElementById('dialogue-area');
      if (!area) return;
      const rows = (lines || []).map(l => {
        const speaker = this.processSceneTemplate(l.speaker || '');
        const text = this.processSceneTemplate(l.text || l.line || '');
        return `<div class="dialogue-block"><div class="speaker">${this.escapeHtml(speaker)}:</div><div class="text">«${this.escapeHtml(text)}»</div></div>`;
      });
      area.innerHTML = rows.join('');
    },

    clearDialogue() {
      const area = document.getElementById('dialogue-area');
      if (area) area.innerHTML = '';
    },
  });
})();
