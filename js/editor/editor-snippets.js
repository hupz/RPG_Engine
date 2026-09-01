// Редактор текстовых сниппетов (data.snippets) — синтаксис @id в сценах и диалогах

(function attachEditorSnippets() {
  if (typeof Editor === 'undefined') {
    console.error('editor-snippets.js: Editor не определён');
    return;
  }

  Object.assign(Editor, {
    editingSnippetId: null,

    ensureSnippets() {
      if (!this.data) return;
      if (!this.data.snippets || typeof this.data.snippets !== 'object') {
        this.data.snippets = {};
      }
    },

    getSnippetIds() {
      this.ensureSnippets();
      return Object.keys(this.data.snippets).sort((a, b) => a.localeCompare(b, 'ru'));
    },

    /** Подстановка @id (для превью редактора; в игре — GameEngine.expandTextSnippets) */
    expandSnippetsInText(text, data) {
      if (text == null) return '';
      let out = String(text);
      const snippets = (data || this.data)?.snippets;
      if (!snippets || typeof snippets !== 'object') return out;
      return out.replace(/@([a-zA-Z0-9_]+)/g, (match, id) => {
        if (Object.prototype.hasOwnProperty.call(snippets, id)) {
          return String(snippets[id]);
        }
        return match;
      });
    },

    selectSnippetToEdit(id) {
      this.editingSnippetId = id;
      this.renderSnippets();
    },

    renderSnippets() {
      const c = document.getElementById('snippets-editor');
      if (!c) return;
      if (!this.data) {
        c.innerHTML = '<div class="empty-state"><h2>Загрузите данные</h2></div>';
        return;
      }
      this.ensureSnippets();
      const ids = this.getSnippetIds();

      if (!ids.length) {
        c.innerHTML = `<div class="quest-manager snippet-manager">
          <div class="empty-state" style="flex:1;">
            <h2>Нет сниппетов</h2>
            <p class="hint">В тексте сцен и диалогов используйте <code>@id_сниппета</code> — при показе подставится полный текст.</p>
          </div>
          <button type="button" class="btn btn-primary" onclick="Editor.createSnippet()">+ Добавить сниппет</button>
        </div>`;
        return;
      }

      if (!this.editingSnippetId || !this.data.snippets[this.editingSnippetId]) {
        this.editingSnippetId = ids[0];
      }

      const sidebar = ids.map((id) => {
        const active = id === this.editingSnippetId ? ' active' : '';
        const preview = String(this.data.snippets[id] || '').slice(0, 36);
        return `<button type="button" class="quest-pick${active}" onclick="Editor.selectSnippetToEdit(${JSON.stringify(id)})">
          <code>@${this.escapeHtml(id)}</code>
          <span class="snippet-pick-preview">${this.escapeHtml(preview)}${preview.length >= 36 ? '…' : ''}</span>
        </button>`;
      }).join('');

      c.innerHTML = `<div class="quest-manager snippet-manager">
        <div class="quest-manager-sidebar">
          <h4>📝 Сниппеты</h4>
          <p class="hint" style="font-size:12px;margin-bottom:8px;">В тексте: <code>@id</code></p>
          ${sidebar}
          <button type="button" class="btn btn-primary" style="width:100%;margin-top:10px;" onclick="Editor.createSnippet()">+ Добавить сниппет</button>
        </div>
        <div class="quest-manager-detail">${this.renderSnippetDetail(this.editingSnippetId)}</div>
      </div>`;
    },

    renderSnippetDetail(id) {
      const text = this.data.snippets[id];
      if (text === undefined) return '';
      const preview = this.expandSnippetsInText(`Пример: @${id} в описании локации.`, this.data);

      return `<div class="snippet-detail-card">
        <div class="quest-detail-head">
          <h3><code>@${this.escapeHtml(id)}</code></h3>
          <button type="button" class="btn btn-danger" onclick="Editor.deleteSnippet(${JSON.stringify(id)})">🗑 Удалить</button>
        </div>
        <div class="form-group">
          <label>ID (латиница, без @)</label>
          <input value="${this.escapeHtml(id)}" disabled>
          <p class="hint">В тексте сцены пишите: <code>@${this.escapeHtml(id)}</code></p>
        </div>
        <div class="form-group">
          <label>Текст сниппета</label>
          <textarea class="snippet-text-field" rows="8"
            onchange="Editor.updateSnippetText(${JSON.stringify(id)}, this.value)">${this.escapeTextarea(String(text))}</textarea>
        </div>
        <div class="snippet-live-preview">
          <strong>Превью подстановки</strong>
          <p class="hint">${this.escapeHtml(preview)}</p>
        </div>
      </div>`;
    },

    slugifySnippetId(name, existing) {
      let base = String(name || 'snippet')
        .toLowerCase()
        .replace(/^@+/, '')
        .replace(/[^a-z0-9_]+/gi, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_');
      if (!base || !/^[a-z]/.test(base)) base = 'snippet_' + base.replace(/^[^a-z]+/, '');
      if (!base) base = 'snippet';
      let id = base;
      let n = 1;
      while (existing[id]) {
        id = `${base}_${n++}`;
      }
      return id;
    },

    async createSnippet() {
      this.ensureSnippets();
      const raw = await Editor.promptDialog({ message: 'ID сниппета (латиница, без @):', defaultValue: 'new_snippet' });
      if (!raw) return;
      const id = this.slugifySnippetId(raw, this.data.snippets);
      if (!/^[a-z][a-z0-9_]*$/i.test(id)) {
        Editor.toast.warning('ID: латиница, цифры и _');
        return;
      }
      this.data.snippets[id] = '';
      this.editingSnippetId = id;
      this.renderSnippets();
      this.updateJSONPreview();
    },

    updateSnippetText(id, value) {
      this.ensureSnippets();
      if (!this.data.snippets[id]) return;
      this.data.snippets[id] = value;
      this.updateJSONPreview();
      const preview = document.querySelector('.snippet-live-preview .hint');
      if (preview) {
        preview.textContent = this.expandSnippetsInText(`Пример: @${id} в описании локации.`, this.data);
      }
    },

    async deleteSnippet(id) {
      if (!(await Editor.confirmDialog({ message: `Удалить сниппет @${id}?`, danger: true }))) return;
      this.ensureSnippets();
      delete this.data.snippets[id];
      const ids = this.getSnippetIds();
      this.editingSnippetId = ids[0] || null;
      this.renderSnippets();
      this.updateJSONPreview();
    }
  });

  if (Editor.hooks && typeof Editor.hooks.after === 'function') {
    Editor.hooks.after('renderAll', function (result) {
      if (typeof this.renderSnippets === 'function') this.renderSnippets();
      return result;
    });
    Editor.hooks.after('switchTab', function (result, args) {
      if (args && args[0] === 'snippets' && typeof this.renderSnippets === 'function') {
        this.renderSnippets();
      }
      return result;
    });
  } else if (typeof console !== 'undefined' && console.warn) {
    console.warn('[editor-snippets] Editor.hooks missing — extension skipped');
  }
})();
