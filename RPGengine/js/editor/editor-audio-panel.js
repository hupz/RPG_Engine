// ============================================================
// Аудио-панель
// Вынесено из editor.html
// ============================================================
(function () {
  if (typeof Editor === 'undefined') {
    console.error('editor-audio-panel.js: Editor не определён');
    return;
  }
  Object.assign(Editor, {
    renderAudio() {
      const c = document.getElementById('audio-editor');
      if (!this.data) {
        c.innerHTML = '<div class="empty-state"><h2>Нет данных</h2></div>';
        return;
      }
      this.ensureAudioConfig();
      const catalog = this.data.audio.catalog;
      const ids = Object.keys(catalog);
      const rows = ids.map(sid => {
        const entry = catalog[sid] || {};
        const label = entry.label || '';
        const file = entry.file || entry.path || '';
        return `<div class="ability-edit-card"><div class="grid-3"><div class="form-group"><label>ID</label><input value="${this.escapeHtml(sid)}" disabled></div><div class="form-group"><label>Название</label><input value="${this.escapeHtml(label)}" onchange="Editor.updateAudioCatalog('${this.escapeAttr(sid)}','label',this.value)"></div><div class="form-group"><label>Файл</label><input value="${this.escapeHtml(file)}" placeholder="audio/fire_hit.mp3" onchange="Editor.updateAudioCatalog('${this.escapeAttr(sid)}','file',this.value)"></div></div><button class="btn btn-danger" onclick="Editor.deleteAudioEntry('${this.escapeAttr(sid)}')">🗑 Удалить</button></div>`;
      }).join('');
      c.innerHTML = `<div class="project-info">
        <h4>Каталог звуков</h4>
        <p class="hint">Файлы .mp3 / .ogg в папке <code>audio/</code>. Если файла нет — играет синтезированный звук.</p>
        <div id="audio-drop-zone" class="asset-drop-zone" role="button" tabindex="0" aria-label="Загрузить аудиофайл">
          <input type="file" id="audio-drop-file-input" class="asset-drop-zone-input" accept="audio/*,.mp3,.ogg" tabindex="-1">
          <span class="asset-drop-zone-icon">🔊</span>
          <span class="asset-drop-zone-text">Перетащите аудиофайл (.mp3, .ogg) сюда или нажмите для выбора</span>
        </div>
        ${rows || '<div class="empty-state"><h2>Каталог пуст</h2></div>'}
        <button class="btn btn-primary" style="margin-top:16px;" onclick="Editor.addAudioEntry()">+ Добавить звук</button>
        <button class="btn btn-secondary" style="margin-top:8px;margin-left:8px;" type="button" onclick="if(typeof AudioEngine!=='undefined'){AudioEngine.unlock();AudioEngine.play('fire_cast');}">▶ Проверить огонь</button>
      </div>`;
      if (typeof this.bindAudioDropZone === 'function') this.bindAudioDropZone();
    }
  });
})();
