// Редактор: обложка проекта (meta.cover)

(function attachEditorCover() {
  if (typeof Editor === 'undefined') {
    console.warn('editor-cover.js: Editor не определён');
    return;
  }

  const CC = typeof CampaignCovers !== 'undefined' ? CampaignCovers : null;

  function ensureMeta() {
    if (!Editor.data) return null;
    if (!Editor.data.meta || typeof Editor.data.meta !== 'object') Editor.data.meta = {};
    return Editor.data.meta;
  }

  function formatCoverSize(dataUrl) {
    if (!CC || !dataUrl) return '';
    const kb = Math.round(CC.dataUrlByteSize(dataUrl) / 1024);
    return kb > 0 ? `${kb} КБ` : '';
  }

  Object.assign(Editor, {
    renderProjectCoverSection() {
      const meta = ensureMeta();
      if (!meta) {
        return '<p class="hint">Откройте проект, чтобы загрузить обложку.</p>';
      }
      const cover = meta.cover || '';
      const sizeHint = cover ? formatCoverSize(cover) : '';
      const preview = cover
        ? `<img src="${this.escapeAttr(cover)}" alt="Обложка проекта" class="project-cover-preview-img">`
        : '<span class="project-cover-placeholder-icon">🎮</span><span class="project-cover-placeholder-text">Перетащите PNG/JPG сюда</span>';

      return `
        <div class="project-cover-block">
          <h4 style="margin:0 0 8px;font-size:14px;color:var(--accent);">🖼 Обложка</h4>
          <p class="hint" style="margin-bottom:8px;">Показывается на главном экране. PNG/JPG, макс. 500 КБ.</p>
          <div id="project-cover-dropzone" class="project-cover-dropzone" tabindex="0" role="button"
            aria-label="Загрузить обложку перетаскиванием">
            <div class="project-cover-preview" id="project-cover-preview"
              style="background:${CC ? CC.gradientFromTitle(meta.title || 'Проект') : 'var(--paper-dark)'}">
              ${preview}
            </div>
          </div>
          <input type="file" id="project-cover-file-input" accept="image/png,image/jpeg,.png,.jpg,.jpeg" hidden>
          <div class="project-cover-actions">
            <button type="button" class="btn btn-secondary" style="flex:1;" onclick="Editor.pickProjectCover()">📷 Загрузить обложку</button>
            ${cover ? `<button type="button" class="btn btn-danger" onclick="Editor.removeProjectCover()">✕</button>` : ''}
          </div>
          ${sizeHint ? `<p class="hint project-cover-size">${this.escapeHtml(sizeHint)}</p>` : ''}
        </div>`;
    },

    bindProjectCoverUi() {
      const zone = document.getElementById('project-cover-dropzone');
      const input = document.getElementById('project-cover-file-input');
      if (!zone || zone._coverBound) return;
      zone._coverBound = true;

      zone.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        input?.click();
      });
      zone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          input?.click();
        }
      });
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('is-dragover');
      });
      zone.addEventListener('dragleave', () => zone.classList.remove('is-dragover'));
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('is-dragover');
        const file = e.dataTransfer?.files?.[0];
        if (file) Editor.processProjectCoverFile(file);
      });
      input?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) Editor.processProjectCoverFile(file);
        e.target.value = '';
      });
    },

    async processProjectCoverFile(file) {
      if (!CC) {
        Editor.toast.warning('Модуль обложек не загружен');
        return;
      }
      if (!this.data) {
        Editor.toast.warning('Сначала откройте проект');
        return;
      }
      try {
        const dataUrl = await CC.fileToCoverDataUrl(file);
        this.setProjectCover(dataUrl);
      } catch (err) {
        Editor.toast.error('❌ ' + (err.message || String(err)));
      }
    },

    pickProjectCover() {
      document.getElementById('project-cover-file-input')?.click();
    },

    setProjectCover(dataUrl) {
      const meta = ensureMeta();
      if (!meta) return;
      meta.cover = dataUrl;
      this.invalidateProjectCoverCache();
      this.updateProjectPanel();
      this.updateJSONPreview();
    },

    removeProjectCover() {
      const meta = ensureMeta();
      if (!meta) return;
      delete meta.cover;
      this.invalidateProjectCoverCache();
      this.updateProjectPanel();
      this.updateJSONPreview();
    },

    invalidateProjectCoverCache() {
      if (!CC) return;
      CC.clearAllCoverCaches();
    },

    renderProjectStartSceneField() {
      if (!this.data?.scenes) {
        return '<p class="hint">Нет сцен — создайте сцену, чтобы задать старт.</p>';
      }
      const current = this.data.startScene || this.data.meta?.startScene || '';
      if (typeof this.renderEntityPicker === 'function') {
        return `
        <div class="project-start-scene-block">
          <h4 style="margin:0 0 8px;font-size:14px;color:var(--accent);">🎬 Стартовая сцена</h4>
          <p class="hint" style="margin-bottom:8px;">После создания персонажа и при экспорте HTML игра начнёт с этой сцены.</p>
          ${this.renderEntityPicker({
            kind: 'scene',
            value: current,
            onChange: 'Editor.setProjectStartScene(this.value)',
            placeholder: 'Не задана (legacy-фолбэк)'
          })}
        </div>`;
      }
      const opts = Object.keys(this.data.scenes).map((sid) => {
        const sc = this.data.scenes[sid];
        const label = sc?.location || sc?.title || sid;
        const sel = sid === current ? ' selected' : '';
        return `<option value="${this.escapeAttr(sid)}"${sel}>${this.escapeHtml(label)}</option>`;
      }).join('');
      return `
        <div class="project-start-scene-block">
          <h4 style="margin:0 0 8px;font-size:14px;color:var(--accent);">🎬 Стартовая сцена</h4>
          <select class="form-control" onchange="Editor.setProjectStartScene(this.value)">
            <option value="">— не задана —</option>${opts}
          </select>
        </div>`;
    },

    setProjectStartScene(sceneId) {
      if (!this.data) return;
      const id = String(sceneId || '').trim();
      if (id) {
        this.data.startScene = id;
      } else {
        delete this.data.startScene;
      }
      this.markDirty?.();
      this.updateJSONPreview?.();
      this.updateProjectPanel?.();
      this.toast?.success?.('Стартовая сцена: ' + (id || 'не задана'));
    }
  });

  if (Editor.hooks?.replace) {
    Editor.hooks.replace('updateProjectPanel', function updateProjectPanelCover() {
      const p = document.getElementById('project-panel');
      if (!this.data) {
        if (p) p.innerHTML = 'Нет открытого проекта';
        return;
      }
      if (!p) return;

      if (typeof this.ensureProjectMetaSystem === 'function') {
        this.ensureProjectMetaSystem();
      }
      const sid = this.data.meta?.system;
      const sysLabel = typeof this.getRuleSystemLabel === 'function'
        ? this.getRuleSystemLabel(sid)
        : (sid || '—');
      const systemRow = sid
        ? `<b>Система:</b> ${this.escapeHtml(sysLabel)} (<code>${this.escapeHtml(sid)}</code>)<br>`
        : '';

      p.innerHTML = `
      <b>Название:</b> ${this.escapeHtml(this.data.meta?.title || '—')}<br>
      <b>Версия:</b> ${this.escapeHtml(this.data.meta?.version || '—')}<br>
      <b>Автор:</b> ${this.escapeHtml(this.data.meta?.author || '—')}<br>
      ${systemRow}
      <button class="btn btn-secondary" style="width:100%;margin-top:8px;" onclick="Editor.editMeta()">✏️ Мета</button>
      <div style="margin-top:14px;">${this.renderProjectStartSceneField()}</div>
      <div style="margin-top:14px;">${this.renderProjectCoverSection()}</div>`;
      this.bindProjectCoverUi();
      if (typeof this.bindEntityPickers === 'function') {
        this.bindEntityPickers(p);
      }
    }, 'editor-cover');
  } else {
    // hooks-exempt: fallback when Editor.hooks unavailable
    Editor.updateProjectPanel = function () {
      const p = document.getElementById('project-panel');
      if (!this.data) {
        if (p) p.innerHTML = 'Нет открытого проекта';
        return;
      }
      if (!p) return;

      if (typeof this.ensureProjectMetaSystem === 'function') {
        this.ensureProjectMetaSystem();
      }
      const sid = this.data.meta?.system;
      const sysLabel = typeof this.getRuleSystemLabel === 'function'
        ? this.getRuleSystemLabel(sid)
        : (sid || '—');
      const systemRow = sid
        ? `<b>Система:</b> ${this.escapeHtml(sysLabel)} (<code>${this.escapeHtml(sid)}</code>)<br>`
        : '';

      p.innerHTML = `
      <b>Название:</b> ${this.escapeHtml(this.data.meta?.title || '—')}<br>
      <b>Версия:</b> ${this.escapeHtml(this.data.meta?.version || '—')}<br>
      <b>Автор:</b> ${this.escapeHtml(this.data.meta?.author || '—')}<br>
      ${systemRow}
      <button class="btn btn-secondary" style="width:100%;margin-top:8px;" onclick="Editor.editMeta()">✏️ Мета</button>
      <div style="margin-top:14px;">${this.renderProjectStartSceneField()}</div>
      <div style="margin-top:14px;">${this.renderProjectCoverSection()}</div>`;
      this.bindProjectCoverUi();
      if (typeof this.bindEntityPickers === 'function') {
        this.bindEntityPickers(p);
      }
    };
  }

  function afterExportInvalidate() {
    if (typeof Editor.invalidateProjectCoverCache === 'function') {
      Editor.invalidateProjectCoverCache();
    }
  }
  if (Editor.hooks && typeof Editor.hooks.after === 'function') {
    Editor.hooks.after('exportJSON', function (result) {
      afterExportInvalidate();
      return result;
    });
    Editor.hooks.after('exportData', function (result) {
      afterExportInvalidate();
      return result;
    });
  } else {
    const target = Editor.exportJSON || Editor.exportData;
    if (typeof target === 'function') {
      const origExport = target.bind(Editor);
      const wrapExport = function () {
        const result = origExport.apply(this, arguments);
        afterExportInvalidate();
        return result;
      };
      if (Editor.exportJSON) Editor.exportJSON = wrapExport;
      if (Editor.exportData) Editor.exportData = wrapExport;
    }
  }

})();
