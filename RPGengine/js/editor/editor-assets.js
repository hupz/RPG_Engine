// Drag-and-drop загрузка аудио в data.audio.catalog

(function attachEditorAssets() {
  if (typeof Editor === 'undefined') {
    console.error('editor-assets.js: Editor не определён');
    return;
  }

  Object.assign(Editor, {
    slugifyAudioIdFromFile(filename) {
      let base = String(filename || '')
        .replace(/\.[^.]+$/i, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_');
      if (!base) base = 'sound';
      if (!/^[a-z]/.test(base)) base = `sound_${base}`;
      return base;
    },

    getAudioFileExtension(filename) {
      const m = String(filename || '').match(/\.(mp3|ogg)$/i);
      return m ? m[1].toLowerCase() : 'mp3';
    },

    isAcceptedAudioFile(file) {
      if (!file) return false;
      if (file.type && file.type.startsWith('audio/')) return true;
      return /\.(mp3|ogg)$/i.test(file.name || '');
    },

    allocUniqueAudioCatalogId(baseId) {
      this.ensureAudioConfig();
      const catalog = this.data.audio.catalog;
      if (!catalog[baseId]) return baseId;
      let n = 1;
      while (catalog[`${baseId}_${n}`]) n += 1;
      return `${baseId}_${n}`;
    },

    processDroppedAudioFile(file) {
      if (!file) return;
      if (!this.data) {
        alert('Сначала загрузите проект (game_data.json).');
        return;
      }
      if (!this.isAcceptedAudioFile(file)) {
        alert('Нужен аудиофайл в формате .mp3 или .ogg.');
        return;
      }

      this.ensureAudioConfig();
      const originalName = file.name || 'sound.mp3';
      const ext = this.getAudioFileExtension(originalName);
      const baseId = this.slugifyAudioIdFromFile(originalName);
      const newId = this.allocUniqueAudioCatalogId(baseId);
      const targetFileName = `${newId}.${ext}`;

      this.data.audio.catalog[newId] = {
        label: originalName,
        file: `audio/${targetFileName}`
      };

      this.updateJSONPreview();
      this.renderAudio();

      alert(
        `Звук добавлен в JSON! Пожалуйста, вручную переместите файл «${originalName}» в папку «audio/» вашего проекта и переименуйте его в «${targetFileName}».`
      );
    },

    bindAudioDropZone() {
      const zone = document.getElementById('audio-drop-zone');
      const input = document.getElementById('audio-drop-file-input');
      if (!zone || !input) return;

      if (zone._audioDropBound) return;
      zone._audioDropBound = true;

      zone.addEventListener('click', (e) => {
        if (e.target === input) return;
        input.click();
      });

      zone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          input.click();
        }
      });

      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        zone.classList.add('asset-drop-zone--over');
      });

      zone.addEventListener('dragleave', (e) => {
        if (!zone.contains(e.relatedTarget)) {
          zone.classList.remove('asset-drop-zone--over');
        }
      });

      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('asset-drop-zone--over');
        const file = e.dataTransfer?.files?.[0];
        if (file) this.processDroppedAudioFile(file);
      });

      input.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) this.processDroppedAudioFile(file);
        e.target.value = '';
      });
    }
  });
})();
