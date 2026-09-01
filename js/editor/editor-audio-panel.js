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
        return `<div class="ability-edit-card"><div class="grid-3"><div class="form-group"><label>ID</label><input value="${this.escapeHtml(sid)}" disabled></div><div class="form-group"><label>Название</label><input value="${this.escapeHtml(label)}" onchange="Editor.updateAudioCatalog('${this.escapeAttr(sid)}','label',this.value)"></div><div class="form-group"><label>Файл</label><input value="${this.escapeHtml(file)}" placeholder="audio/fire_hit.mp3" onchange="Editor.updateAudioCatalog('${this.escapeAttr(sid)}','file',this.value)"></div></div><button class="btn btn-danger" onclick="${this.escapeAttr('Editor.deleteAudioEntry(' + JSON.stringify(sid) + ')')}">🗑 Удалить</button></div>`;
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
,

renderAbilitySoundFields(ctx, ref, ab, index) {
    const cast = ab.soundCast || '';
    const hit = ab.soundHit || '';
    let castChange;
    let hitChange;
    if (ctx === 'global') {
      castChange = `Editor.setAbilitySound('global','${this.escapeAttr(ref)}','soundCast',this.value)`;
      hitChange = `Editor.setAbilitySound('global','${this.escapeAttr(ref)}','soundHit',this.value)`;
    } else {
      castChange = `Editor.setAbilitySound('class','${this.escapeAttr(ref)}',${index},'soundCast',this.value)`;
      hitChange = `Editor.setAbilitySound('class','${this.escapeAttr(ref)}',${index},'soundHit',this.value)`;
    }
    return `<div class="form-group sound-fields"><label>🔊 Звук</label><div class="grid-2"><div class="form-group"><label>SFX при использовании</label>${this.renderSoundSelect(cast, castChange)}</div><div class="form-group"><label>SFX при попадании</label>${this.renderSoundSelect(hit, hitChange)}</div></div><div class="icon-hint">Пусто = звук по типу урона из каталога. MP3 кладите в папку <code>audio/</code>.</div></div>`;
  },

  setAbilitySound(ctx, idOrClassId, indexOrField, fieldOrValue, maybeValue) {
    let ab, field, value;
    if (ctx === 'global') {
      ab = this.data?.progression?.abilities?.[idOrClassId];
      field = indexOrField;
      value = fieldOrValue;
    } else {
      ab = this.data?.classes?.[idOrClassId]?.abilities?.[indexOrField];
      field = fieldOrValue;
      value = maybeValue;
    }
    if (!ab) return;
    const v = (value || '').trim();
    if (v) ab[field] = v;
    else delete ab[field];
    this.updateJSONPreview();
  },

  renderAudio() {
    /* вынесено в js/editor/*-panel.js / core-tabs */

  },

  updateAudioCatalog(id, field, value) {
    this.ensureAudioConfig();
    if (!this.data.audio.catalog[id]) this.data.audio.catalog[id] = {};
    this.data.audio.catalog[id][field] = value;
    this.updateJSONPreview();
  },

  async addAudioEntry() {
    this.ensureAudioConfig();
    const id = await Editor.promptDialog({ message: 'ID звука (латиница, например fire_hit):', defaultValue: 'new_sound' });
    if (!id || !/^[a-z][a-z0-9_]*$/i.test(id)) return;
    if (this.data.audio.catalog[id]) { Editor.toast.warning('ID уже есть'); return; }
    this.data.audio.catalog[id] = { label: 'Новый звук', file: `audio/${id}.mp3` };
    this.renderAudio();
    this.updateJSONPreview();
  },

  async deleteAudioEntry(id) {
    if (!(await Editor.confirmDialog({ message: 'Удалить звук из каталога?', danger: true }))) return;
    this.ensureAudioConfig();
    delete this.data.audio.catalog[id];
    this.renderAudio();
    this.updateJSONPreview();
  }
  });
})();