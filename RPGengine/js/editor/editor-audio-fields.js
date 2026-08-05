// ============================================
// Редактор: звук сцен, врагов, умения (поля в формах)
// ============================================

(function attachEditorAudioFields() {
  if (typeof Editor === 'undefined') {
    console.error('editor-audio-fields.js: Editor не определён');
    return;
  }

  Object.assign(Editor, {
    /** Записи каталога audio.catalog с путём к файлу */
    getAudioCatalogEntries() {
      this.ensureAudioConfig();
      return Object.entries(this.data.audio.catalog || {})
        .map(([id, entry]) => ({
          id,
          label: entry?.label || id,
          file: entry?.file || entry?.path || ''
        }))
        .sort((a, b) => a.label.localeCompare(b.label, 'ru'));
    },

    renderAudioFileSelect(current, onChangeAttr, emptyLabel) {
      const opts = this.getAudioCatalogEntries().map(({ id, label, file }) => {
        const sel = id === current ? ' selected' : '';
        const fileHint = file ? ` · ${file}` : '';
        return `<option value="${this.escapeAttr(id)}"${sel}>${this.escapeHtml(label)} (${this.escapeHtml(id)}${this.escapeHtml(fileHint)})</option>`;
      }).join('');
      return `<select onchange="${onChangeAttr}"><option value="">${this.escapeHtml(emptyLabel || '— нет —')}</option>${opts}</select>`;
    },

    parseSceneAudio(scene) {
      const raw = scene?.audio;
      if (raw == null || raw === '') {
        return { ambient: '', sfxOnEnter: '', volumePct: 70 };
      }
      if (typeof raw === 'string') {
        return { ambient: raw, sfxOnEnter: '', volumePct: 70 };
      }
      const vol = raw.volume != null ? Number(raw.volume) : 0.7;
      return {
        ambient: raw.ambient || raw.id || raw.track || raw.play || '',
        sfxOnEnter: raw.sfxOnEnter || raw.sfx || '',
        volumePct: Math.round(Math.max(0, Math.min(1, vol)) * 100)
      };
    },

    ensureSceneAudioObject(scene) {
      if (!scene) return null;
      if (scene.audio == null || scene.audio === '') {
        scene.audio = {};
        return scene.audio;
      }
      if (typeof scene.audio === 'string') {
        scene.audio = { ambient: scene.audio, loop: true, volume: 0.7 };
      }
      return scene.audio;
    },

    pruneSceneAudio(scene) {
      const a = scene?.audio;
      if (!a || typeof a !== 'object') return;
      if (!a.ambient && !a.sfxOnEnter && (a.volume == null || a.volume === 0.7)) {
        delete scene.audio;
      }
    },

    setSceneAudioAmbient(catalogId) {
      const scene = this.data?.scenes?.[this.currentScene];
      if (!scene) return;
      const id = (catalogId || '').trim();
      if (!id) {
        if (typeof scene.audio === 'object') {
          delete scene.audio.ambient;
          this.pruneSceneAudio(scene);
        } else {
          delete scene.audio;
        }
      } else {
        const a = this.ensureSceneAudioObject(scene);
        a.ambient = id;
        if (a.loop == null) a.loop = true;
        if (a.volume == null) a.volume = 0.7;
      }
      this.renderSceneEditor();
      this.updateJSONPreview();
    },

    setSceneAudioSfxOnEnter(catalogId) {
      const scene = this.data?.scenes?.[this.currentScene];
      if (!scene) return;
      const id = (catalogId || '').trim();
      if (!id) {
        if (typeof scene.audio === 'object') {
          delete scene.audio.sfxOnEnter;
          this.pruneSceneAudio(scene);
        }
      } else {
        const a = this.ensureSceneAudioObject(scene);
        a.sfxOnEnter = id;
        if (a.volume == null) a.volume = 0.7;
      }
      this.renderSceneEditor();
      this.updateJSONPreview();
    },

    setSceneAudioVolume(percent) {
      const scene = this.data?.scenes?.[this.currentScene];
      if (!scene) return;
      const pct = Math.max(0, Math.min(100, parseInt(percent, 10) || 0));
      const a = this.ensureSceneAudioObject(scene);
      a.volume = Math.round((pct / 100) * 100) / 100;
      this.updateJSONPreview();
    },

    clearSceneAudio() {
      const scene = this.data?.scenes?.[this.currentScene];
      if (!scene) return;
      delete scene.audio;
      this.renderSceneEditor();
      this.updateJSONPreview();
    },

    renderSceneAudioSection(scene) {
      this.ensureAudioConfig();
      const { ambient, sfxOnEnter, volumePct } = this.parseSceneAudio(scene);
      return `<div class="project-info scene-audio-panel" style="margin-top:12px;">
        <h4>🔊 Звук</h4>
        <p class="hint">Файлы из каталога вкладки «Звуки» (папка <code>audio/</code>). Эмбиент зацикливается, SFX при входе — один раз.</p>
        <div class="grid-2">
          <div class="form-group">
            <label>Ambient (фон)</label>
            ${this.renderAudioFileSelect(ambient, 'Editor.setSceneAudioAmbient(this.value)', '— без фона —')}
          </div>
          <div class="form-group">
            <label>SFX при входе</label>
            ${this.renderAudioFileSelect(sfxOnEnter, 'Editor.setSceneAudioSfxOnEnter(this.value)', '— без эффекта —')}
          </div>
        </div>
        <div class="form-group">
          <label>Громкость ambient: <span id="scene-audio-vol-label">${volumePct}%</span></label>
          <input type="range" min="0" max="100" step="1" value="${volumePct}"
            oninput="document.getElementById('scene-audio-vol-label').textContent=this.value+'%'"
            onchange="Editor.setSceneAudioVolume(this.value)">
        </div>
        <button type="button" class="btn btn-secondary" onclick="Editor.clearSceneAudio()">Очистить звук сцены</button>
      </div>`;
    },

    renderEnemySoundSection(enemyId) {
      const e = this.data?.enemies?.[enemyId];
      if (!e) return '';
      const eid = JSON.stringify(enemyId);
      return `<div class="project-info" style="margin-top:12px;">
        <h4>🔊 Звук</h4>
        <div class="grid-2">
          <div class="form-group">
            <label>SFX при атаке</label>
            ${this.renderAudioFileSelect(
              e.soundAttack || '',
              `Editor.updateEnemy(${eid},'soundAttack',this.value||undefined);Editor.renderEnemies();`,
              '— авто —'
            )}
          </div>
          <div class="form-group">
            <label>SFX при получении урона</label>
            ${this.renderAudioFileSelect(
              e.soundHit || '',
              `Editor.updateEnemy(${eid},'soundHit',this.value||undefined);Editor.renderEnemies();`,
              '— авто —'
            )}
          </div>
        </div>
        <p class="hint">Пусто — звук по умолчанию (оружие игрока / физический удар).</p>
      </div>`;
    }
  });
})();
