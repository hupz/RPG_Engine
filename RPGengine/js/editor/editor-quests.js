// ============================================
// Редактор квестов v2: этапы → задачи (без флагов)
// ============================================

(function attachEditorQuests() {
  if (typeof Editor === 'undefined') {
    console.error('editor-quests.js: Editor не определён');
    return;
  }

  Object.assign(Editor, {
    editingQuestId: null,

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

    getQuestStageKeys(questId) {
      const q = this.data?.quests?.[questId];
      if (!q) return [];
      return typeof QuestSystem !== 'undefined'
        ? QuestSystem.getStageKeys(q)
        : (Array.isArray(q.stages) ? q.stages.map((_, i) => String(i)) : []);
    },

    questAttrHandler(jsExpr) {
      return this.escapeAttr(jsExpr);
    },

    selectQuestToEdit(id) {
      this.editingQuestId = id;
      this.renderQuests();
    },

    getTaskTypeOptions(selected) {
      const types = (typeof QuestSystem !== 'undefined' && QuestSystem.getTaskTypes)
        ? QuestSystem.getTaskTypes()
        : [];
      return types.map((t) => {
        const sel = t.id === selected ? ' selected' : '';
        return `<option value="${this.escapeAttr(t.id)}"${sel}>${this.escapeHtml(t.label)}</option>`;
      }).join('');
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
          <div class="empty-state"><h2>Нет квестов</h2><p class="hint">Квест = этапы. Этап = список задач. Флаги не нужны.</p></div>
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

    renderQuestPreview(questId) {
      const q = this.data?.quests?.[questId];
      if (!q) return '';
      const stages = Array.isArray(q.stages) ? q.stages : [];
      const rows = stages.map((st, i) => {
        const type = st.failed ? '❌ провал' : (st.finish ? '✅ финал' : '•');
        const tasks = (st.tasks || []).map(t => {
          const ClassRef = (typeof QuestTaskRegistry !== 'undefined') ? QuestTaskRegistry.get(t.type) : null;
          const label = ClassRef ? (ClassRef.label || t.type) : t.type;
          return `<li>${this.escapeHtml(label)}: ${this.escapeHtml(t.description || t.itemId || t.npcId || t.enemyId || '')}</li>`;
        }).join('');
        return `<div class="quest-preview-stage"><strong>Этап ${i + 1}</strong> <span class="hint">${type}</span>
          <div class="hint">${this.escapeHtml(st.hint || st.title || '')}</div>
          <ul class="quest-preview-tasks">${tasks || '<li class="hint">нет задач</li>'}</ul></div>`;
      }).join('');
      const rep = typeof QuestSystem !== 'undefined'
        ? QuestSystem.getPrimaryReputationReward(q.rewards)
        : { flag: '', amount: 0 };
      const repLine = rep.flag && rep.amount
        ? `<div class="hint">Репутация: ${this.escapeHtml(rep.flag)} ${rep.amount > 0 ? '+' : ''}${rep.amount}</div>`
        : '';
      return `<h4>👁 Превью «${this.escapeHtml(q.title)}»</h4>
        <div class="hint">Золото: ${q.rewards?.gold ?? 0} · Опыт: ${q.rewards?.exp ?? 0}</div>
        ${repLine}
        ${rows || '<p class="hint">Нет этапов</p>'}`;
    },

    renderQuestDetail(questId) {
      const q = this.data.quests[questId];
      if (!q) return '';
      const stages = Array.isArray(q.stages) ? q.stages : [];
      const stagesHtml = stages.map((st, i) => this.renderQuestStageBlock(questId, i, st)).join('');

      return `<div class="quest-detail-card">
        <div class="quest-detail-head">
          <h3>${this.escapeHtml(q.title || questId)}</h3>
          <button type="button" class="btn btn-danger" onclick="${this.questAttrHandler('Editor.deleteQuest(' + JSON.stringify(questId) + ')')}">🗑 Удалить квест</button>
        </div>
        <div class="form-group"><label>Название</label>
          <input value="${this.escapeHtml(q.title || '')}" onchange="${this.questAttrHandler('Editor.updateQuestMeta(' + JSON.stringify(questId) + ',\'title\',this.value)')}"></div>
        <div class="form-group"><label><input type="checkbox" ${q.hidden ? 'checked' : ''} onchange="${this.questAttrHandler('Editor.updateQuestMeta(' + JSON.stringify(questId) + ',\'hidden\',this.checked)')}"> Скрытый квест</label></div>
        <h4>Награды</h4>
        <div class="grid-2">
          <div class="form-group"><label>Золото</label>
            <input type="number" min="0" value="${q.rewards?.gold ?? 0}" onchange="${this.questAttrHandler('Editor.updateQuestReward(' + JSON.stringify(questId) + ',\'gold\',parseInt(this.value)||0)')}"></div>
          <div class="form-group"><label>Опыт</label>
            <input type="number" min="0" value="${q.rewards?.exp ?? 0}" onchange="${this.questAttrHandler('Editor.updateQuestReward(' + JSON.stringify(questId) + ',\'exp\',parseInt(this.value)||0)')}"></div>
        </div>
        ${this.renderQuestReputationFields(questId)}
        <h4>Этапы</h4>
        <p class="hint">Добавляйте задачи: «Поговорить», «Собрать предмет», «Победить»… Когда все задачи этапа выполнены — следующий этап включается сам.</p>
        <div class="quest-stages-list">${stagesHtml}</div>
        <button type="button" class="btn btn-secondary" onclick="${this.questAttrHandler('Editor.addQuestStage(' + JSON.stringify(questId) + ')')}">+ Добавить этап</button>
      </div>`;
    },

    renderQuestStageBlock(questId, stageIndex, st) {
      st = st || { tasks: [] };
      const qid = JSON.stringify(questId);
      const stageType = st.failed ? 'failed' : (st.finish ? 'finish' : 'normal');
      const tasks = Array.isArray(st.tasks) ? st.tasks : [];
      const tasksHtml = tasks.map((t, ti) => this.renderTaskRow(questId, stageIndex, ti, t)).join('');
      return `<div class="quest-stage-card" data-stage="${stageIndex}">
        <div class="quest-stage-head"><strong>Этап ${stageIndex + 1}</strong>
          <button type="button" class="btn-remove" onclick="${this.questAttrHandler('Editor.removeQuestStage(' + qid + ',' + stageIndex + ')')}">×</button></div>
        <div class="form-group"><label>Тип этапа</label>
          <select onchange="${this.questAttrHandler('Editor.setQuestStageType(' + qid + ',' + stageIndex + ',this.value)')}">
            <option value="normal"${stageType === 'normal' ? ' selected' : ''}>Обычный</option>
            <option value="finish"${stageType === 'finish' ? ' selected' : ''}>✅ Завершение квеста</option>
            <option value="failed"${stageType === 'failed' ? ' selected' : ''}>❌ Провал</option>
          </select></div>
        <div class="form-group"><label>Подсказка в журнале</label>
          <input value="${this.escapeHtml(st.hint || st.title || '')}" onchange="${this.questAttrHandler('Editor.updateQuestStageField(' + qid + ',' + stageIndex + ',\'hint\',this.value)')}"></div>
        <div class="form-group"><label>Текст в лог при входе</label>
          <textarea rows="2" onchange="${this.questAttrHandler('Editor.updateQuestStageField(' + qid + ',' + stageIndex + ',\'log\',this.value)')}">${this.escapeTextarea(st.log || '')}</textarea></div>
        <h5>Задачи</h5>
        <div class="quest-tasks-list">${tasksHtml || '<p class="hint">Нет задач</p>'}</div>
        <button type="button" class="btn btn-secondary btn-sm" onclick="${this.questAttrHandler('Editor.addQuestTask(' + qid + ',' + stageIndex + ')')}">+ Добавить задачу</button>
      </div>`;
    },

    renderTaskRow(questId, stageIndex, taskIndex, task) {
      task = task || { type: 'TalkToNPC' };
      const type = task.type || 'ManualAdvance';
      const qid = JSON.stringify(questId);
      const ClassRef = typeof QuestTaskRegistry !== 'undefined' ? QuestTaskRegistry.get(type) : null;
      const fields = ClassRef && typeof ClassRef.getEditorFields === 'function' ? ClassRef.getEditorFields() : [];
      const visible = fields.filter((f) => f.key !== 'stageKey');
      const fieldsHtml = visible.map((f) => {
        const val = task[f.key] != null ? task[f.key] : '';
        const onchg = this.questAttrHandler(
          'Editor.updateQuestTaskField(' + qid + ',' + stageIndex + ',' + taskIndex + ',' + JSON.stringify(f.key) + ',this.value)'
        );
        if (f.input === 'number') {
          return `<div class="form-group"><label>${this.escapeHtml(f.label)}</label>
            <input type="number" min="${f.min != null ? f.min : 0}" value="${this.escapeHtml(String(val))}" onchange="${onchg}"></div>`;
        }
        return `<div class="form-group"><label>${this.escapeHtml(f.label)}</label>
          <input value="${this.escapeHtml(String(val))}" onchange="${onchg}"></div>`;
      }).join('');

      return `<div class="quest-task-card">
        <div class="quest-stage-head">
          <select onchange="${this.questAttrHandler('Editor.changeQuestTaskType(' + qid + ',' + stageIndex + ',' + taskIndex + ',this.value)')}">
            ${this.getTaskTypeOptions(type)}
          </select>
          <button type="button" class="btn-remove" onclick="${this.questAttrHandler('Editor.removeQuestTask(' + qid + ',' + stageIndex + ',' + taskIndex + ')')}">×</button>
        </div>
        ${fieldsHtml}
      </div>`;
    },

    getReputationFlagOptions() {
      const keys = Object.keys(this.data?.reputation || {}).filter((k) => k !== 'starting');
      if (!keys.includes('rep_village')) keys.unshift('rep_village');
      return keys;
    },

    renderQuestReputationFields(questId) {
      const q = this.data.quests[questId];
      const primary = typeof QuestSystem !== 'undefined'
        ? QuestSystem.getPrimaryReputationReward(q?.rewards)
        : { flag: '', amount: 0 };
      const flag = primary.flag || '';
      const amount = primary.amount ?? 0;
      const opts = this.getReputationFlagOptions().map((k) => {
        const name = this.data.reputation?.[k]?.name || k;
        const sel = k === flag ? ' selected' : '';
        return `<option value="${this.escapeAttr(k)}"${sel}>${this.escapeHtml(name)} (${this.escapeHtml(k)})</option>`;
      }).join('');
      const qid = JSON.stringify(questId);
      return `<div class="quest-rep-reward">
        <p class="hint">Репутация при завершении квеста</p>
        <div class="grid-2">
          <div class="form-group"><label>Фракция</label>
            <select onchange="${this.questAttrHandler('Editor.syncQuestReputation(' + qid + ')')}">
              <option value="">— без репутации —</option>
              ${opts}
            </select>
          </div>
          <div class="form-group"><label>Изменение</label>
            <input type="number" id="quest-rep-amt-${this.escapeAttr(questId)}" value="${amount}"
              onchange="${this.questAttrHandler('Editor.syncQuestReputation(' + qid + ')')}"></div>
        </div>
      </div>`;
    },

    syncQuestReputation(questId) {
      const card = document.querySelector('.quest-detail-card');
      if (!card) return;
      const select = card.querySelector('.quest-rep-reward select');
      const amountInput = document.getElementById('quest-rep-amt-' + questId);
      if (!select || !amountInput) return;
      this.updateQuestReputation(questId, select.value, amountInput.value);
      const preview = document.getElementById('quest-json-preview');
      if (preview) preview.innerHTML = this.renderQuestPreview(questId);
    },

    updateQuestReputation(questId, flag, amountRaw) {
      if (!this.data.quests[questId]) return;
      if (!this.data.quests[questId].rewards) this.data.quests[questId].rewards = {};
      const rewards = this.data.quests[questId].rewards;
      const amount = parseInt(amountRaw, 10);
      if (!flag || Number.isNaN(amount) || amount === 0) {
        delete rewards.reputation;
        delete rewards.reputationAmount;
      } else {
        rewards.reputation = { [flag]: amount };
        delete rewards.reputationAmount;
      }
      this.updateJSONPreview();
    },

    setQuestStageType(questId, stageIndex, type) {
      const q = this.data.quests[questId];
      if (!q?.stages?.[stageIndex]) return;
      const st = q.stages[stageIndex];
      st.finish = type === 'finish';
      st.failed = type === 'failed';
      this.renderQuests();
      this.updateJSONPreview();
    },

    createQuest() {
      this.ensureQuests();
      let id, title;
      if (typeof this.promptNameAndId === 'function') {
        const r = this.promptNameAndId({
          namePrompt: 'Название квеста (для игрока):',
          defaultName: 'Новое задание',
          existing: this.data.quests,
          allowEditId: false
        });
        if (!r) return;
        id = r.id;
        title = r.name;
      } else {
        title = prompt('Название квеста:', 'Новое задание');
        if (!title) return;
        id = String(title).toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'new_quest';
        if (this.data.quests[id]) id = id + '_' + Date.now().toString(36).slice(-3);
      }
      this.data.quests[id] = {
        id,
        title: title,
        stages: [{
          id: 'stage_0',
          title: 'Начало',
          hint: 'Узнайте подробности у заказчика',
          log: 'Задание получено.',
          finish: false,
          failed: false,
          tasks: [{
            type: 'TalkToNPC',
            id: id + '_t0',
            description: 'Поговорить с заказчиком'
          }]
        }],
        hidden: false,
        rewards: { exp: 0, gold: 0 },
        questFormat: 2
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

    updateQuestStageField(questId, stageIndex, field, value) {
      const q = this.data.quests[questId];
      if (!q?.stages?.[stageIndex]) return;
      q.stages[stageIndex][field] = value;
      if (field === 'hint') q.stages[stageIndex].title = value;
      const preview = document.getElementById('quest-json-preview');
      if (preview) preview.innerHTML = this.renderQuestPreview(questId);
      this.updateJSONPreview();
    },

    addQuestStage(questId) {
      const q = this.data.quests[questId];
      if (!q) return;
      if (!Array.isArray(q.stages)) q.stages = [];
      const i = q.stages.length;
      q.stages.push({
        id: 'stage_' + i,
        title: 'Этап ' + (i + 1),
        hint: 'Новый этап',
        log: '',
        finish: false,
        failed: false,
        tasks: [{
          type: 'VisitLocation',
          id: questId + '_s' + i + '_t0',
          description: 'Выполните задачу'
        }]
      });
      this.renderQuests();
      this.updateJSONPreview();
    },

    removeQuestStage(questId, stageIndex) {
      const q = this.data.quests[questId];
      if (!q?.stages || q.stages.length <= 1) {
        alert('Нужен хотя бы один этап');
        return;
      }
      q.stages.splice(stageIndex, 1);
      this.renderQuests();
      this.updateJSONPreview();
    },

    addQuestTask(questId, stageIndex) {
      const q = this.data.quests[questId];
      const st = q?.stages?.[stageIndex];
      if (!st) return;
      if (!Array.isArray(st.tasks)) st.tasks = [];
      const n = st.tasks.length;
      st.tasks.push({
        type: 'TalkToNPC',
        id: questId + '_s' + stageIndex + '_t' + n,
        description: ''
      });
      this.renderQuests();
      this.updateJSONPreview();
    },

    removeQuestTask(questId, stageIndex, taskIndex) {
      const st = this.data.quests[questId]?.stages?.[stageIndex];
      if (!st?.tasks) return;
      if (st.tasks.length <= 1) {
        alert('На этапе нужна хотя бы одна задача');
        return;
      }
      st.tasks.splice(taskIndex, 1);
      this.renderQuests();
      this.updateJSONPreview();
    },

    changeQuestTaskType(questId, stageIndex, taskIndex, type) {
      const st = this.data.quests[questId]?.stages?.[stageIndex];
      if (!st?.tasks?.[taskIndex]) return;
      const prev = st.tasks[taskIndex];
      st.tasks[taskIndex] = {
        type,
        id: prev.id || (questId + '_s' + stageIndex + '_t' + taskIndex),
        description: prev.description || ''
      };
      this.renderQuests();
      this.updateJSONPreview();
    },

    updateQuestTaskField(questId, stageIndex, taskIndex, field, value) {
      const t = this.data.quests[questId]?.stages?.[stageIndex]?.tasks?.[taskIndex];
      if (!t) return;
      if (field === 'count' || field === 'amount' || field === 'level' || field === 'hours') {
        t[field] = parseInt(value, 10) || 0;
      } else {
        t[field] = value;
      }
      const preview = document.getElementById('quest-json-preview');
      if (preview) preview.innerHTML = this.renderQuestPreview(questId);
      this.updateJSONPreview();
    },

    renderQuestIdSelect(selected, onchangeAttr) {
      const ids = this.getQuestIds();
      const opts = ids.map(id => {
        const t = this.data.quests[id]?.title || id;
        const sel = id === selected ? ' selected' : '';
        return `<option value="${this.escapeAttr(id)}"${sel}>${this.escapeHtml(t)} (${this.escapeHtml(id)})</option>`;
      }).join('');
      return `<select onchange="${this.escapeAttr(onchangeAttr)}"><option value="">— квест —</option>${opts}</select>`;
    },

    renderQuestStageSelect(questId, selectedStage, onchangeAttr) {
      const keys = this.getQuestStageKeys(questId);
      const q = this.data.quests[questId];
      const opts = keys.map(k => {
        const st = Array.isArray(q?.stages) ? q.stages[Number(k)] : q?.stages?.[k];
        const hint = st?.hint || st?.title || '';
        const tag = st?.failed ? ' [провал]' : (st?.finish ? ' [финал]' : '');
        const sel = String(k) === String(selectedStage) ? ' selected' : '';
        return `<option value="${this.escapeAttr(k)}"${sel}>${Number(k) + 1}${tag}: ${this.escapeHtml(String(hint).slice(0, 40))}</option>`;
      }).join('');
      return `<select onchange="${this.escapeAttr(onchangeAttr)}" ${keys.length ? '' : 'disabled'}><option value="">— этап —</option>${opts}</select>`;
    }
  });
})();
