// ============================================
// Редактор квестов: визуальный менеджер data.quests
// ============================================

(function attachEditorQuests() {
  if (typeof Editor === 'undefined') {
    console.error('editor-quests.js: Editor не определён');
    return;
  }

  Object.assign(Editor, {
    editingQuestId: null,

    /** Гарантирует объект quests и нормализует формат стадий */
    ensureQuests() {
      if (!this.data) return;
      if (!this.data.quests || typeof this.data.quests !== 'object') {
        this.data.quests = {};
      }
      if (typeof QuestSystem !== 'undefined') {
        QuestSystem.normalizeAll(this.data);
      }
    },

    getQuestIds() {
      this.ensureQuests();
      return Object.keys(this.data.quests);
    },

    /** Ключи стадий квеста для выпадающих списков */
    getQuestStageKeys(questId) {
      const q = this.data?.quests?.[questId];
      if (!q) return [];
      return typeof QuestSystem !== 'undefined'
        ? QuestSystem.getStageKeys(q)
        : Object.keys(q.stages || {}).sort((a, b) => Number(a) - Number(b));
    },

    /** Безопасный onclick/onchange: готовое JS-выражение целиком */
    questAttrHandler(jsExpr) {
      return this.escapeAttr(jsExpr);
    },

    selectQuestToEdit(id) {
      this.editingQuestId = id;
      this.renderQuests();
    },

    renderQuests() {
      const c = document.getElementById('quests-editor');
      if (!c) return;
      if (!this.data) {
        c.innerHTML = '<div class="empty-state"><h2>Загрузите данные</h2></div>';
        return;
      }
      this.ensureQuests();
      const ids = this.getQuestIds();
      if (!ids.length) {
        c.innerHTML = `<div class="quest-manager">
          <div class="empty-state"><h2>Нет квестов</h2><p class="hint">Создайте первый квест — стадии задаются номерами 0, 1, 2…</p></div>
          <button type="button" class="btn btn-primary" onclick="Editor.createQuest()">+ Добавить квест</button>
        </div>`;
        return;
      }
      if (!this.editingQuestId || !this.data.quests[this.editingQuestId]) {
        this.editingQuestId = ids[0];
      }

      const sidebar = ids.map(id => {
        const q = this.data.quests[id];
        const active = id === this.editingQuestId ? ' active' : '';
        return `<button type="button" class="quest-pick${active}" onclick="${this.questAttrHandler('Editor.selectQuestToEdit(' + JSON.stringify(id) + ')')}">${this.escapeHtml(q.title || id)}</button>`;
      }).join('');

      c.innerHTML = `<div class="quest-manager">
        <div class="quest-manager-sidebar">
          <h4>📜 Квесты</h4>
          ${sidebar}
          <button type="button" class="btn btn-primary" style="width:100%;margin-top:10px;" onclick="Editor.createQuest()">+ Добавить квест</button>
        </div>
        <div class="quest-manager-detail">${this.renderQuestDetail(this.editingQuestId)}</div>
      </div>
      <div class="quest-json-preview" id="quest-json-preview">${this.renderQuestPreview(this.editingQuestId)}</div>`;
    },

    /** Превью текущего квеста для нарративщика */
    renderQuestPreview(questId) {
      const q = this.data?.quests?.[questId];
      if (!q) return '';
      const keys = this.getQuestStageKeys(questId);
      const rows = keys.map(k => {
        const st = q.stages[k] || {};
        return `<div class="quest-preview-stage"><strong>Стадия ${k}</strong>
          <div class="hint">Журнал: ${this.escapeHtml(st.log || '—')}</div>
          <div class="hint">Подсказка: ${this.escapeHtml(st.hint || '—')}</div></div>`;
      }).join('');
      return `<h4>👁 Превью «${this.escapeHtml(q.title)}»</h4>${rows || '<p class="hint">Нет стадий</p>'}`;
    },

    renderQuestDetail(questId) {
      const q = this.data.quests[questId];
      if (!q) return '';
      const keys = this.getQuestStageKeys(questId);
      const stagesHtml = keys.map(k => this.renderQuestStageRow(questId, k, q.stages[k])).join('');

      return `<div class="quest-detail-card">
        <div class="quest-detail-head">
          <h3>${this.escapeHtml(q.title || questId)}</h3>
          <button type="button" class="btn btn-danger" onclick="${this.questAttrHandler('Editor.deleteQuest(' + JSON.stringify(questId) + ')')}">🗑 Удалить квест</button>
        </div>
        <div class="form-group"><label>ID (ключ в JSON)</label><input value="${this.escapeHtml(questId)}" disabled></div>
        <div class="form-group"><label>Название для игрока</label>
          <input value="${this.escapeHtml(q.title || '')}" onchange="${this.questAttrHandler('Editor.updateQuestMeta(' + JSON.stringify(questId) + ',\'title\',this.value)')}"></div>
        <div class="form-group"><label><input type="checkbox" ${q.hidden ? 'checked' : ''} onchange="${this.questAttrHandler('Editor.updateQuestMeta(' + JSON.stringify(questId) + ',\'hidden\',this.checked)')}"> Скрытый квест (не в журнале на стадии 0)</label></div>
        <div class="form-group"><label>Опыт за завершение</label>
          <input type="number" value="${q.rewards?.exp ?? 0}" onchange="${this.questAttrHandler('Editor.updateQuestReward(' + JSON.stringify(questId) + ',\'exp\',parseInt(this.value)||0)')}"></div>
        <h4>Стадии</h4>
        <p class="hint">Стадия <code>0</code> — старт. В игре в журнале показывается <strong>hint</strong>, в лог — <strong>log</strong> при смене стадии.</p>
        <div class="quest-stages-list">${stagesHtml}</div>
        <button type="button" class="btn btn-secondary" onclick="${this.questAttrHandler('Editor.addQuestStage(' + JSON.stringify(questId) + ')')}">+ Добавить стадию</button>
      </div>`;
    },

    renderQuestStageRow(questId, stageKey, st) {
      st = st || { log: '', hint: '' };
      const finish = st.finish ? 'checked' : '';
      return `<div class="quest-stage-card">
        <div class="quest-stage-head"><strong>Стадия ${this.escapeHtml(stageKey)}</strong>
          <button type="button" class="btn-remove" onclick="${this.questAttrHandler('Editor.removeQuestStage(' + JSON.stringify(questId) + ',' + JSON.stringify(stageKey) + ')')}">×</button></div>
        <div class="form-group"><label>Текст в лог (log)</label>
          <textarea rows="2" onchange="${this.questAttrHandler('Editor.updateQuestStageField(' + JSON.stringify(questId) + ',' + JSON.stringify(stageKey) + ',\'log\',this.value)')}">${this.escapeTextarea(st.log || '')}</textarea></div>
        <div class="form-group"><label>Подсказка в журнале (hint)</label>
          <input value="${this.escapeHtml(st.hint || '')}" onchange="${this.questAttrHandler('Editor.updateQuestStageField(' + JSON.stringify(questId) + ',' + JSON.stringify(stageKey) + ',\'hint\',this.value)')}"></div>
        <label><input type="checkbox" ${finish} onchange="${this.questAttrHandler('Editor.updateQuestStageField(' + JSON.stringify(questId) + ',' + JSON.stringify(stageKey) + ',\'finish\',this.checked)')}"> Финальная стадия (завершение квеста)</label>
      </div>`;
    },

    createQuest() {
      this.ensureQuests();
      const id = prompt('ID квеста (латиница, например find_artifact):', 'new_quest');
      if (!id || !/^[a-z][a-z0-9_]*$/i.test(id)) {
        alert('ID: латиница, цифры и _');
        return;
      }
      if (this.data.quests[id]) {
        alert('Квест уже существует');
        return;
      }
      this.data.quests[id] = {
        title: 'Новый квест',
        stages: {
          0: { log: 'Задание получено.', hint: 'Узнайте подробности у заказчика.', finish: false }
        },
        isFinished: false,
        hidden: false,
        rewards: { exp: 0 }
      };
      this.editingQuestId = id;
      this.renderQuests();
      this.updateJSONPreview();
    },

    deleteQuest(id) {
      if (!confirm('Удалить квест «' + id + '»?')) return;
      delete this.data.quests[id];
      this.editingQuestId = this.getQuestIds()[0] || null;
      this.renderQuests();
      this.updateJSONPreview();
    },

    updateQuestMeta(id, field, value) {
      if (!this.data.quests[id]) return;
      this.data.quests[id][field] = value;
      if (field === 'title') this.renderQuests();
      this.updateJSONPreview();
    },

    updateQuestReward(id, field, value) {
      if (!this.data.quests[id]) return;
      if (!this.data.quests[id].rewards) this.data.quests[id].rewards = {};
      this.data.quests[id].rewards[field] = value;
      this.updateJSONPreview();
    },

    updateQuestStageField(questId, stageKey, field, value) {
      const q = this.data.quests[questId];
      if (!q?.stages) return;
      if (!q.stages[stageKey]) q.stages[stageKey] = { log: '', hint: '' };
      if (field === 'finish') q.stages[stageKey].finish = !!value;
      else q.stages[stageKey][field] = value;
      const preview = document.getElementById('quest-json-preview');
      if (preview) preview.innerHTML = this.renderQuestPreview(questId);
      this.updateJSONPreview();
    },

    addQuestStage(questId) {
      const q = this.data.quests[questId];
      if (!q) return;
      if (!q.stages || Array.isArray(q.stages)) q.stages = {};
      const keys = this.getQuestStageKeys(questId);
      const next = keys.length ? String(Math.max(...keys.map(Number)) + 1) : '0';
      q.stages[next] = { log: 'Событие стадии ' + next, hint: 'Подсказка для игрока', finish: false };
      this.renderQuests();
      this.updateJSONPreview();
    },

    removeQuestStage(questId, stageKey) {
      const q = this.data.quests[questId];
      if (!q?.stages || Object.keys(q.stages).length <= 1) {
        alert('Нужна хотя бы одна стадия');
        return;
      }
      delete q.stages[stageKey];
      this.renderQuests();
      this.updateJSONPreview();
    },

    /** HTML: выпадающий список квестов */
    renderQuestIdSelect(selected, onchangeAttr) {
      const ids = this.getQuestIds();
      const opts = ids.map(id => {
        const t = this.data.quests[id]?.title || id;
        const sel = id === selected ? ' selected' : '';
        return `<option value="${this.escapeAttr(id)}"${sel}>${this.escapeHtml(t)} (${this.escapeHtml(id)})</option>`;
      }).join('');
      return `<select onchange="${this.escapeAttr(onchangeAttr)}"><option value="">— квест —</option>${opts}</select>`;
    },

    /** HTML: стадии выбранного квеста */
    renderQuestStageSelect(questId, selectedStage, onchangeAttr) {
      const keys = this.getQuestStageKeys(questId);
      const opts = keys.map(k => {
        const hint = this.data.quests[questId]?.stages?.[k]?.hint || '';
        const sel = String(k) === String(selectedStage) ? ' selected' : '';
        return `<option value="${this.escapeAttr(k)}"${sel}>${k}: ${this.escapeHtml(hint.slice(0, 40))}</option>`;
      }).join('');
      return `<select onchange="${this.escapeAttr(onchangeAttr)}" ${keys.length ? '' : 'disabled'}><option value="">— стадия —</option>${opts}</select>`;
    }
  });

})();
