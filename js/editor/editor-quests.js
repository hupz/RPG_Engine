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
      // Миграция v1→v2 только один раз при загрузке (QuestMigrate), не на каждый render
      if (this.data.questsVersion !== 2 && typeof QuestMigrate !== 'undefined') {
        QuestMigrate.migrateAll(this.data);
        this.data.questsVersion = 2;
      }
    },

    getQuestIds() {
      this.ensureQuests();
      return Object.keys(this.data.quests);
    },

    getQuestStageKeys(questId) {
      const q = this.data?.quests?.[questId];
      if (!q) return [];
      if (typeof QuestRuntime !== 'undefined' && QuestRuntime.getStageKeys) {
        return QuestRuntime.getStageKeys(q);
      }
      return Array.isArray(q.stages) ? q.stages.map((_, i) => String(i)) : [];
    },

    questAttrHandler(jsExpr) {
      return this.escapeAttr(jsExpr);
    },

    /** Человекочитаемое описание задачи для карточки */
    humanizeQuestTask(task) {
      task = task || {};
      if (task.description) return String(task.description);
      const type = task.type || '';
      const C = typeof QuestTaskRegistry !== 'undefined' ? QuestTaskRegistry.get(type) : null;
      if (C && typeof C.prototype?.getDescription === 'function') {
        try {
          const inst = Object.create(C.prototype);
          inst.def = task;
          inst.id = task.id;
          const d = inst.getDescription();
          if (d) return d;
        } catch (e) { /* fall through */ }
      }
      const el = (kind, id) => {
        if (!id) return '…';
        if (typeof this.getEntityLabel === 'function') {
          const full = this.getEntityLabel(kind, id);
          // "Name (id)" → Name
          const m = String(full).match(/^(.*?)\s*\([^)]+\)\s*$/);
          return m ? m[1] : full;
        }
        return id;
      };
      switch (type) {
        case 'TalkToNPC':
          return 'Поговорить с «' + el('npc', task.npcId) + '»';
        case 'CollectItem': {
          const n = task.count != null ? task.count : 1;
          return n > 1
            ? ('Собрать ' + n + ' × «' + el('item', task.itemId) + '»')
            : ('Найти «' + el('item', task.itemId) + '»');
        }
        case 'KillEnemy': {
          const n = task.count != null ? task.count : 1;
          return n > 1
            ? ('Победить ' + n + ' × «' + el('enemy', task.enemyId) + '»')
            : ('Победить «' + el('enemy', task.enemyId) + '»');
        }
        case 'VisitLocation':
        case 'DiscoverLocation':
          return 'Посетить «' + el('scene', task.sceneId || task.locationId) + '»';
        case 'DeliverItem': {
          const n = task.count != null ? task.count : 1;
          return 'Доставить ' + (n > 1 ? n + ' × ' : '') + '«' + el('item', task.itemId) + '» → «' + el('npc', task.npcId) + '»';
        }
        case 'SpendGold':
          return 'Потратить ' + (task.amount != null ? task.amount : '?') + ' золота';
        case 'AcquireGold':
          return 'Получить ' + (task.amount != null ? task.amount : '?') + ' золота';
        case 'UseItem':
          return 'Использовать «' + el('item', task.itemId) + '»';
        case 'CraftItem':
          return 'Создать «' + el('item', task.itemId) + '»';
        case 'EquipItem':
          return 'Экипировать «' + el('item', task.itemId) + '»';
        case 'ReachLevel':
          return 'Достичь уровня ' + (task.level != null ? task.level : '?');
        case 'ManualAdvance':
          return task.description || 'После нажатия «Продолжить»';
        case 'ChooseDialogueOption':
          return 'Выбрать реплику' + (task.choiceId ? (': ' + task.choiceId) : '');
        case 'InteractObject':
          return 'Взаимодействовать с объектом' + (task.objectId ? (': ' + task.objectId) : '');
        case 'LearnSkill':
          return 'Изучить навык' + (task.skillId ? (': ' + task.skillId) : '');
        case 'WaitTime':
          return 'Подождать время';
        case 'MigrationRequired':
          return '⚠ Требуется ручная настройка (миграция)';
        default:
          return (C && C.label) ? C.label : (type || 'Задача');
      }
    },

    /** Каталог типов для кнопки «+ Добавить задачу» (человеческие ярлыки) */
    getQuestTaskTypeCatalog() {
      const preferred = [
        { id: 'TalkToNPC', label: 'Поговорить', icon: '💬' },
        { id: 'CollectItem', label: 'Собрать / найти предмет', icon: '🌿' },
        { id: 'KillEnemy', label: 'Победить врага', icon: '⚔️' },
        { id: 'DeliverItem', label: 'Доставить предмет', icon: '📦' },
        { id: 'VisitLocation', label: 'Посетить место', icon: '📍' },
        { id: 'SpendGold', label: 'Потратить золото', icon: '🪙' },
        { id: 'ManualAdvance', label: 'После нажатия «Продолжить»', icon: '▶️' },
        { id: 'UseItem', label: 'Использовать предмет', icon: '🧪' },
        { id: 'EquipItem', label: 'Экипировать', icon: '🛡️' },
        { id: 'ReachLevel', label: 'Достичь уровня', icon: '📈' },
        { id: 'AcquireGold', label: 'Получить золото', icon: '💰' },
        { id: 'CraftItem', label: 'Создать предмет', icon: '🔨' },
        { id: 'InteractObject', label: 'Взаимодействовать', icon: '🔘' },
        { id: 'ChooseDialogueOption', label: 'Выбрать реплику', icon: '🗣️' },
        { id: 'DiscoverLocation', label: 'Открыть локацию', icon: '🗺️' },
        { id: 'LearnSkill', label: 'Изучить навык', icon: '📚' },
        { id: 'WaitTime', label: 'Подождать время', icon: '⏱️' }
      ];
      const supported = new Set();
      if (typeof QuestTaskRegistry !== 'undefined') {
        const list = QuestTaskRegistry.listSupported
          ? QuestTaskRegistry.listSupported()
          : (QuestTaskRegistry.list || (() => []))().filter((t) => {
              const C = QuestTaskRegistry.get(t.id);
              return C && !C.unsupported;
            });
        list.forEach((t) => supported.add(t.id));
      }
      let cat = preferred.filter((p) => !supported.size || supported.has(p.id));
      if (this.isQuestDevMode() && typeof QuestTaskRegistry !== 'undefined' && QuestTaskRegistry.list) {
        QuestTaskRegistry.list().forEach((t) => {
          if (!t.id || cat.some((c) => c.id === t.id)) return;
          const C = QuestTaskRegistry.get(t.id);
          cat.push({
            id: t.id,
            label: (t.label || t.id) + (C && C.unsupported ? ' (недоступно)' : ''),
            icon: '⚙️'
          });
        });
      }
      return cat;
    },

    openAddQuestTaskPicker(questId, stageIndex) {
      this._pendingTaskAdd = { questId, stageIndex };
      let modal = document.getElementById('quest-task-type-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'quest-task-type-modal';
        modal.className = 'editor-modal';
        modal.innerHTML = `<div class="editor-modal-backdrop" data-close="1"></div>
          <div class="editor-modal-panel" style="max-width:480px;">
            <h2>Добавить задачу</h2>
            <p class="hint">Выберите, что должен сделать игрок на этом этапе</p>
            <div class="quest-task-type-grid" id="quest-task-type-grid"></div>
            <button type="button" class="btn btn-secondary" data-close="1">Отмена</button>
          </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
          if (e.target.closest('[data-close]')) {
            modal.classList.add('hidden');
            return;
          }
          const btn = e.target.closest('[data-task-type]');
          if (!btn || !this._pendingTaskAdd) return;
          const type = btn.getAttribute('data-task-type');
          const { questId: qid, stageIndex: si } = this._pendingTaskAdd;
          this._pendingTaskAdd = null;
          modal.classList.add('hidden');
          this.addQuestTaskOfType(qid, si, type);
        });
      }
      const grid = modal.querySelector('#quest-task-type-grid');
      grid.innerHTML = this.getQuestTaskTypeCatalog().map((t) =>
        `<button type="button" class="quest-task-type-pick" data-task-type="${this.escapeAttr(t.id)}">
          <span class="qtt-icon">${t.icon || '•'}</span>
          <span class="qtt-label">${this.escapeHtml(t.label)}</span>
        </button>`
      ).join('');
      modal.classList.remove('hidden');
    },

    addQuestTaskOfType(questId, stageIndex, type) {
      const q = this.data?.quests?.[questId];
      if (!q || !Array.isArray(q.stages) || !q.stages[stageIndex]) return;
      if (!Array.isArray(q.stages[stageIndex].tasks)) q.stages[stageIndex].tasks = [];
      const C = typeof QuestTaskRegistry !== 'undefined' ? QuestTaskRegistry.get(type) : null;
      const task = { id: 't_' + Date.now().toString(36), type: type || 'TalkToNPC' };
      if (C && typeof C.getEditorFields === 'function') {
        C.getEditorFields().forEach((f) => {
          if (f.key === 'count' || f.key === 'amount' || f.key === 'level') task[f.key] = f.min != null ? f.min : 1;
        });
      }
      q.stages[stageIndex].tasks.push(task);
      this.renderQuests();
      this.updateJSONPreview();
    },


    selectQuestToEdit(id) {
      this.editingQuestId = id;
      this.renderQuests();
    },

    isQuestDevMode() {
      try {
        return !!(this.devMode || (typeof localStorage !== 'undefined' && localStorage.getItem('rpg_editor_dev') === '1'));
      } catch (e) {
        return !!this.devMode;
      }
    },

    getTaskTypeOptions(selected) {
      const dev = this.isQuestDevMode();
      let types = [];
      if (typeof QuestTaskRegistry !== 'undefined') {
        // Normal authors: only runtime-supported types
        if (dev && QuestTaskRegistry.list) {
          types = QuestTaskRegistry.list()
            .filter((t) => t.id && t.id !== 'base' && t.id !== '__unknown__')
            .map((t) => {
              const C = QuestTaskRegistry.get(t.id);
              if (C && C.unsupported) {
                return { id: t.id, label: (t.label || t.id) + ' (недоступно)' };
              }
              return t;
            });
        } else {
          const raw = QuestTaskRegistry.listSupported
            ? QuestTaskRegistry.listSupported()
            : QuestTaskRegistry.list().filter((t) => {
                const C = QuestTaskRegistry.get(t.id);
                return C && !C.unsupported && t.id !== 'base';
              });
          types = raw.filter((t) => t.id && t.id !== 'base' && t.id !== '__unknown__');
        }
        // Keep invalid/unsupported selection visible so author can fix it
        if (selected && !types.some((x) => x.id === selected)) {
          const check = QuestTaskRegistry.validateTaskType
            ? QuestTaskRegistry.validateTaskType(selected)
            : { ok: false };
          if (check.unsupported) {
            types = types.concat([{ id: selected, label: (check.label || selected) + ' (недоступно)' }]);
          } else if (!check.ok) {
            types = types.concat([{ id: selected, label: '⚠ Неизвестная задача: ' + selected }]);
          }
        }
      }
      return types.map((t) => {
        const sel = t.id === selected ? ' selected' : '';
        return `<option value="${this.escapeAttr(t.id)}"${sel}>${this.escapeHtml(t.label || t.id)}</option>`;
      }).join('');
    },

    getEntityLabel(kind, id) {
      const data = this.data || {};
      if (kind === 'npc') {
        const n = data.npcs?.[id];
        const name = n && (n.name || n.title);
        return name ? name + ' (' + id + ')' : id;
      }
      if (kind === 'item') {
        const it = data.items?.[id];
        return (it && it.name) ? it.name + ' (' + id + ')' : id;
      }
      if (kind === 'enemy') {
        const e = data.enemies?.[id];
        return (e && e.name) ? e.name + ' (' + id + ')' : id;
      }
      if (kind === 'scene' || kind === 'location') {
        const s = data.scenes?.[id] || data.worldMap?.[id];
        const title = s && (s.title || s.name || s.location);
        return title ? title + ' (' + id + ')' : id;
      }
      return id;
    },

    getEntitySelectOptions(kind, selected) {
      const data = this.data || {};
      let ids = [];
      if (kind === 'npc') ids = Object.keys(data.npcs || {});
      else if (kind === 'item') ids = Object.keys(data.items || {});
      else if (kind === 'enemy') ids = Object.keys(data.enemies || {});
      else if (kind === 'scene') ids = Object.keys(data.scenes || {});
      else if (kind === 'location') {
        ids = Array.from(new Set([...Object.keys(data.scenes || {}), ...Object.keys(data.worldMap || {})]));
      }
      ids.sort();
      const missing = selected && selected !== '' && !ids.includes(selected);
      let html = '<option value="">— выберите —</option>';
      if (missing) {
        html += '<option value="' + this.escapeAttr(selected) + '" selected>⚠ не найден: ' + this.escapeHtml(selected) + '</option>';
      }
      ids.forEach((id) => {
        const sel = id === selected ? ' selected' : '';
        const label = this.getEntityLabel(kind, id);
        html += '<option value="' + this.escapeAttr(id) + '"' + sel + '>' + this.escapeHtml(label) + '</option>';
      });
      return html;
    },

    validateQuestTask(task) {
      if (typeof QuestTaskRegistry === 'undefined') return { ok: true, errors: [] };
      if (QuestTaskRegistry.validateDef) return QuestTaskRegistry.validateDef(task, this.data);
      if (QuestTaskRegistry.validateTaskType) {
        const r = QuestTaskRegistry.validateTaskType(task && task.type);
        return { ok: r.ok, errors: r.ok ? [] : [r.error] };
      }
      return { ok: true, errors: [] };
    },

    /**
     * Full project quest validation. Returns list of { questId, stageIndex, taskIndex, errors[] }.
     */
    validateAllQuests() {
      const out = [];
      const quests = this.data?.quests || {};
      for (const [questId, q] of Object.entries(quests)) {
        if (!q || typeof q !== 'object') continue;
        (q.stages || []).forEach((st, stageIndex) => {
          (st.tasks || []).forEach((task, taskIndex) => {
            const r = this.validateQuestTask(task);
            if (!r.ok) {
              out.push({
                questId,
                stageIndex,
                taskIndex,
                taskType: task?.type || '?',
                errors: r.errors || ['Ошибка валидации']
              });
            }
          });
        });
      }
      return out;
    },

    /** Human-readable summary for alerts / banners */
    formatQuestValidationErrors(list) {
      return (list || []).map((e) => {
        const path = 'Квест «' + e.questId + '», этап ' + (e.stageIndex + 1) +
          ', задача ' + (e.taskIndex + 1) + ' (' + e.taskType + ')';
        return path + ': ' + (e.errors || []).join('; ');
      });
    },

    /**
     * Block export if any task is invalid. Returns true if OK to save.
     */
    ensureQuestsValidForSave() {
      const errs = this.validateAllQuests();
      if (!errs.length) return true;
      const lines = this.formatQuestValidationErrors(errs);
      const msg = 'Нельзя сохранить: есть некорректные задачи квестов.';
      const detail = msg + '\n\n' + lines.slice(0, 12).join('\n') +
        (lines.length > 12 ? ('\n… ещё ' + (lines.length - 12)) : '');
      Editor.toast.error(detail, { title: 'Ошибки квестов' });
      return false;
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
          <div class="empty-state"><h2>Нет квестов</h2><p class="hint">Что должен сделать игрок? Мастер поможет собрать задание без технических настроек.</p></div>
          <button type="button" class="btn btn-primary" onclick="Editor.createQuest()">+ Новый квест</button>
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
          <button type="button" class="btn btn-primary" style="width:100%;margin-top:10px;" onclick="Editor.createQuest()">+ Новый квест</button>
        </div>
        <div class="quest-manager-detail">${this.renderQuestDetail(this.editingQuestId)}</div>
      </div>
      <div class="quest-json-preview" id="quest-json-preview" ${this.isQuestDevMode() ? '' : 'hidden'}>${this.renderQuestPreview(this.editingQuestId)}</div>`;
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
      const rep = (typeof QuestRuntime !== 'undefined' && QuestRuntime.getPrimaryReputationReward)
        ? QuestRuntime.getPrimaryReputationReward(q.rewards)
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
      const flow = [];
      flow.push(`<div class="quest-flow-head">
        <div class="quest-flow-title">📜 ${this.escapeHtml(q.title || questId)}</div>
        <div class="quest-flow-meta hint">Последовательность этапов для игрока</div>
      </div>`);
      stages.forEach((st, i) => {
        flow.push(this.renderQuestStageBlock(questId, i, st));
        if (i < stages.length - 1 || true) {
          flow.push('<div class="quest-flow-arrow" aria-hidden="true">↓</div>');
        }
      });
      flow.push(this.renderQuestRewardCard(questId, q));

      return `<div class="quest-detail-card quest-flow">
        <div class="quest-detail-head">
          <h3>${this.escapeHtml(q.title || questId)}</h3>
          <button type="button" class="btn btn-danger" onclick="${this.questAttrHandler('Editor.deleteQuest(' + JSON.stringify(questId) + ')')}">🗑 Удалить квест</button>
        </div>
        <div class="form-group"><label>Название квеста</label>
          <input value="${this.escapeHtml(q.title || '')}" onchange="${this.questAttrHandler('Editor.updateQuestMeta(' + JSON.stringify(questId) + ',\'title\',this.value)')}"></div>
        <div class="form-group"><label><input type="checkbox" ${q.hidden ? 'checked' : ''} onchange="${this.questAttrHandler('Editor.updateQuestMeta(' + JSON.stringify(questId) + ',\'hidden\',this.checked)')}"> Скрытый (не в списке до старта)</label></div>
        <div class="quest-flow-body">${flow.join('')}</div>
        <button type="button" class="btn btn-secondary" style="margin-top:12px;" onclick="${this.questAttrHandler('Editor.addQuestStage(' + JSON.stringify(questId) + ')')}">+ Добавить этап</button>
      </div>`;
    },

    renderQuestRewardCard(questId, q) {
      const gold = q.rewards?.gold ?? 0;
      const exp = q.rewards?.exp ?? 0;
      return `<div class="quest-stage-card quest-reward-card">
        <div class="quest-stage-badge">🏁</div>
        <div class="quest-stage-head"><strong>Награда / завершение</strong></div>
        <p class="hint">Выдаётся, когда игрок проходит этап с типом «Завершение квеста»</p>
        <div class="grid-2">
          <div class="form-group"><label>Золото</label>
            <input type="number" min="0" value="${gold}" onchange="${this.questAttrHandler('Editor.updateQuestReward(' + JSON.stringify(questId) + ',\'gold\',parseInt(this.value)||0)')}"></div>
          <div class="form-group"><label>Опыт</label>
            <input type="number" min="0" value="${exp}" onchange="${this.questAttrHandler('Editor.updateQuestReward(' + JSON.stringify(questId) + ',\'exp\',parseInt(this.value)||0)')}"></div>
        </div>
        ${this.renderQuestReputationFields(questId)}
      </div>`;
    },

    renderQuestStageBlock(questId, stageIndex, st) {
      st = st || { tasks: [] };
      const qid = JSON.stringify(questId);
      const stageType = st.failed ? 'failed' : (st.finish ? 'finish' : 'normal');
      const stateLabel = stageType === 'finish' ? 'Завершение' : (stageType === 'failed' ? 'Провал' : 'Обычный этап');
      const tasks = Array.isArray(st.tasks) ? st.tasks : [];
      const tasksHtml = tasks.map((t, ti) => this.renderTaskRow(questId, stageIndex, ti, t)).join('');
      const title = st.title || st.hint || ('Этап ' + (stageIndex + 1));
      return `<div class="quest-stage-card" data-stage="${stageIndex}" data-stage-type="${stageType}"
        data-dnd="stage" data-quest-id="${this.escapeAttr(questId)}" data-stage-index="${stageIndex}">
        <div class="quest-dnd-handle" draggable="true" title="Перетащить этап" aria-label="Перетащить этап">☰</div>
        <div class="quest-stage-badge">${stageIndex + 1}</div>
        <div class="quest-stage-head">
          <div>
            <strong>Этап ${stageIndex + 1}</strong>
            <span class="quest-stage-state hint"> · ${this.escapeHtml(stateLabel)}</span>
          </div>
          <button type="button" class="btn-remove" title="Удалить этап" onclick="${this.questAttrHandler('Editor.removeQuestStage(' + qid + ',' + stageIndex + ')')}">×</button>
        </div>
        <div class="form-group"><label>Название этапа</label>
          <input value="${this.escapeHtml(st.title || '')}" placeholder="Например: Встреча в таверне"
            onchange="${this.questAttrHandler('Editor.updateQuestStageField(' + qid + ',' + stageIndex + ',\'title\',this.value)')}"></div>
        <div class="form-group"><label>Подсказка в журнале</label>
          <input value="${this.escapeHtml(st.hint || '')}" placeholder="Кратко для игрока"
            onchange="${this.questAttrHandler('Editor.updateQuestStageField(' + qid + ',' + stageIndex + ',\'hint\',this.value)')}"></div>
        ${this.isQuestDevMode() ? `<div class="form-group"><label>Тип этапа (advanced)</label>
          <select onchange="${this.questAttrHandler('Editor.setQuestStageType(' + qid + ',' + stageIndex + ',this.value)')}">
            <option value="normal"${stageType === 'normal' ? ' selected' : ''}>Обычный</option>
            <option value="finish"${stageType === 'finish' ? ' selected' : ''}>✅ Завершение квеста</option>
            <option value="failed"${stageType === 'failed' ? ' selected' : ''}>❌ Провал</option>
          </select></div>
          <div class="form-group"><label>Текст в лог при входе</label>
            <textarea rows="2" onchange="${this.questAttrHandler('Editor.updateQuestStageField(' + qid + ',' + stageIndex + ',\'log\',this.value)')}">${this.escapeTextarea(st.log || '')}</textarea></div>` : `
          <div class="form-group"><label>Этот этап завершает квест?</label>
            <select onchange="${this.questAttrHandler('Editor.setQuestStageType(' + qid + ',' + stageIndex + ',this.value)')}">
              <option value="normal"${stageType === 'normal' ? ' selected' : ''}>Нет, обычный этап</option>
              <option value="finish"${stageType === 'finish' ? ' selected' : ''}>Да, финал (награда)</option>
              <option value="failed"${stageType === 'failed' ? ' selected' : ''}>Провал квеста</option>
            </select></div>`}
        <div class="quest-tasks-list" data-dnd-list="tasks" data-quest-id="${this.escapeAttr(questId)}" data-stage-index="${stageIndex}">
          ${tasksHtml || '<p class="hint quest-tasks-empty">Пока нет задач — добавьте, что должен сделать игрок</p>'}
        </div>
        <button type="button" class="btn btn-primary btn-sm" onclick="${this.questAttrHandler('Editor.openAddQuestTaskPicker(' + qid + ',' + stageIndex + ')')}">+ Добавить задачу</button>
      </div>`;
    },

    renderTaskRow(questId, stageIndex, taskIndex, task) {
      task = task || { type: 'TalkToNPC' };
      const type = task.type || '';
      const qid = JSON.stringify(questId);
      const ClassRef = typeof QuestTaskRegistry !== 'undefined' ? QuestTaskRegistry.get(type) : null;
      const typeInfo = (typeof QuestTaskRegistry !== 'undefined' && QuestTaskRegistry.validateTaskType)
        ? QuestTaskRegistry.validateTaskType(type)
        : { ok: !!ClassRef };
      const fields = ClassRef && typeof ClassRef.getEditorFields === 'function' ? ClassRef.getEditorFields() : [];
      // Hide internal / advanced fields in normal mode
      const visible = fields.filter((f) => {
        if (f.key === 'stageKey') return false;
        if (!this.isQuestDevMode() && (f.key === 'choiceFlag' || f.label && /служебн/i.test(f.label))) return false;
        return true;
      });
      const entityInputs = new Set(['npc', 'item', 'enemy', 'scene', 'location']);
      const fieldsHtml = visible.map((f) => {
        const val = task[f.key] != null ? task[f.key] : '';
        const req = f.required ? ' *' : '';
        const onchgRaw = 'Editor.updateQuestTaskField(' + qid + ',' + stageIndex + ',' + taskIndex + ',' + JSON.stringify(f.key) + ',this.value)';
        const onchg = this.questAttrHandler(onchgRaw);
        if (entityInputs.has(f.input)) {
          if (typeof this.renderEntityPicker === 'function') {
            return `<div class="form-group"><label>${this.escapeHtml(f.label)}${req}</label>
              ${this.renderEntityPicker({ kind: f.input, value: String(val), onChange: onchgRaw })}</div>`;
          }
          return `<div class="form-group"><label>${this.escapeHtml(f.label)}${req}</label>
            <select onchange="${onchg}">${this.getEntitySelectOptions(f.input, String(val))}</select></div>`;
        }
        if (f.input === 'number') {
          return `<div class="form-group"><label>${this.escapeHtml(f.label)}${req}</label>
            <input type="number" min="${f.min != null ? f.min : 1}" value="${this.escapeHtml(String(val))}" onchange="${onchg}"></div>`;
        }
        return `<div class="form-group"><label>${this.escapeHtml(f.label)}${req}</label>
          <input value="${this.escapeHtml(String(val))}" onchange="${onchg}"></div>`;
      }).join('');

      const validation = this.validateQuestTask(task);
      let errHtml = '';
      if (!typeInfo.ok) {
        errHtml = `<div class="quest-task-errors">⚠ ${this.escapeHtml(typeInfo.error || ('Неизвестная задача'))}</div>`;
      } else if (!validation.ok) {
        errHtml = `<div class="quest-task-errors">⚠ ${validation.errors.map((e) => this.escapeHtml(e)).join(' · ')}</div>`;
      }

      const human = this.humanizeQuestTask(task);
      const typeLabel = (ClassRef && ClassRef.label) ? ClassRef.label : type;

      return `<div class="quest-task-card${!typeInfo.ok || !validation.ok ? ' quest-task-invalid' : ''}"
        data-dnd="task" data-quest-id="${this.escapeAttr(questId)}" data-stage-index="${stageIndex}" data-task-index="${taskIndex}">
        <div class="quest-task-summary">
          <span class="quest-dnd-handle" draggable="true" title="Перетащить задачу" aria-label="Перетащить задачу">☰</span>
          <div class="quest-task-human">${this.escapeHtml(human)}</div>
          ${this.isQuestDevMode() ? `<div class="hint">${this.escapeHtml(typeLabel)}</div>` : ''}
          <button type="button" class="btn-remove" title="Удалить задачу" onclick="${this.questAttrHandler('Editor.removeQuestTask(' + qid + ',' + stageIndex + ',' + taskIndex + ')')}">×</button>
        </div>
        ${errHtml}
        <details class="quest-task-fields" ${(!validation.ok || !typeInfo.ok) ? 'open' : ''}>
          <summary>Настроить</summary>
          ${this.isQuestDevMode() ? `<div class="form-group"><label>Тип задачи</label>
            <select onchange="${this.questAttrHandler('Editor.changeQuestTaskType(' + qid + ',' + stageIndex + ',' + taskIndex + ',this.value)')}">
              ${this.getTaskTypeOptions(type)}
            </select></div>` : ''}
          ${fieldsHtml || '<p class="hint">Нет дополнительных параметров</p>'}
        </details>
      </div>`;
    },

    getReputationFlagOptions() {
      const keys = Object.keys(this.data?.reputation || {}).filter((k) => k !== 'starting');
      if (!keys.includes('rep_village')) keys.unshift('rep_village');
      return keys;
    },

    renderQuestReputationFields(questId) {
      const q = this.data.quests[questId];
      const primary = (typeof QuestRuntime !== 'undefined' && QuestRuntime.getPrimaryReputationReward)
        ? QuestRuntime.getPrimaryReputationReward(q?.rewards)
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


    moveQuestStage(questId, fromIndex, toIndex) {
      const q = this.data?.quests?.[questId];
      if (!q || !Array.isArray(q.stages)) return false;
      const from = Number(fromIndex);
      const to = Number(toIndex);
      if (!Number.isFinite(from) || !Number.isFinite(to)) return false;
      if (from < 0 || from >= q.stages.length) return false;
      if (to < 0 || to >= q.stages.length) return false;
      if (from === to) return false;
      const [item] = q.stages.splice(from, 1);
      q.stages.splice(to, 0, item);
      this.editingQuestId = questId;
      this.renderQuests();
      if (typeof this.updateJSONPreview === 'function') this.updateJSONPreview();
      if (typeof this.validateAllQuests === 'function') this.validateAllQuests();
      return true;
    },

    moveQuestTask(questId, stageIndex, fromIndex, toIndex) {
      const st = this.data?.quests?.[questId]?.stages?.[stageIndex];
      if (!st || !Array.isArray(st.tasks)) return false;
      const from = Number(fromIndex);
      const to = Number(toIndex);
      if (!Number.isFinite(from) || !Number.isFinite(to)) return false;
      if (from < 0 || from >= st.tasks.length) return false;
      if (to < 0 || to >= st.tasks.length) return false;
      if (from === to) return false;
      const [item] = st.tasks.splice(from, 1);
      st.tasks.splice(to, 0, item);
      this.editingQuestId = questId;
      this.renderQuests();
      if (typeof this.updateJSONPreview === 'function') this.updateJSONPreview();
      if (typeof this.validateAllQuests === 'function') this.validateAllQuests();
      return true;
    },

    async createQuest() {
      this.ensureQuests();
      let id, title;
      if (typeof this.promptNameAndId === 'function') {
        const r = await this.promptNameAndId({
          namePrompt: 'Название квеста (для игрока):',
          defaultName: 'Новое задание',
          existing: this.data.quests,
          allowEditId: false
        });
        if (!r) return;
        id = r.id;
        title = r.name;
      } else {
        title = await Editor.promptDialog({ message: 'Название квеста:', defaultValue: 'Новое задание' });
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

    async deleteQuest(id) {
      if (!(await Editor.confirmDialog({ message: 'Удалить квест «' + id + '»?', danger: true }))) return;
      delete this.data.quests[id];
      this.editingQuestId = this.getQuestIds()[0] || null;
      this.renderQuests();
      this.updateJSONPreview();
    },

    updateQuestMeta(id, field, value) {
      if (!this.data.quests[id]) return;
      this.data.quests[id][field] = value;
      if (field === 'title') {
        // Soft UI update — do NOT full renderQuests (destroys focused name input)
        this._refreshQuestTitleUI(id, value);
      }
      this.updateJSONPreview();
    },

    /** Update quest title in list/header without replacing the active input. */
    _refreshQuestTitleUI(id, title) {
      const safe = this.escapeHtml(title || id);
      document.querySelectorAll('.quest-pick').forEach((btn) => {
        const onclick = btn.getAttribute('onclick') || '';
        if (onclick.includes(JSON.stringify(id)) || (btn.dataset && btn.dataset.questId === id)) {
          const label = btn.querySelector('.quest-pick-title, .quest-loc, span');
          if (label) label.textContent = title || id;
          else if (!btn.querySelector('input')) {
            // keep structure if complex; only update text nodes carefully
            const icon = btn.querySelector('.quest-pick-icon');
            if (icon && icon.nextSibling) icon.nextSibling.textContent = ' ' + (title || id);
          }
        }
      });
      const head = document.querySelector('.quest-manager-detail h3, .quest-flow-title');
      if (head && this.editingQuestId === id) {
        if (head.classList.contains('quest-flow-title')) head.textContent = '📜 ' + (title || id);
        else head.textContent = title || id;
      }
      const preview = document.getElementById('quest-json-preview');
      if (preview && this.editingQuestId === id && typeof this.renderQuestPreview === 'function') {
        preview.innerHTML = this.renderQuestPreview(id);
      }
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
          type: 'CollectItem',
          id: questId + '_s' + i + '_t0',
          itemId: '',
          count: 1,
          description: ''
        }]
      });
      this.renderQuests();
      this.updateJSONPreview();
    },

    removeQuestStage(questId, stageIndex) {
      const q = this.data.quests[questId];
      if (!q?.stages || q.stages.length <= 1) {
        Editor.toast.warning('Нужен хотя бы один этап');
        return;
      }
      q.stages.splice(stageIndex, 1);
      this.renderQuests();
      this.updateJSONPreview();
    },

    addQuestTask(questId, stageIndex) {
      this.openAddQuestTaskPicker(questId, stageIndex);
    },

    removeQuestTask(questId, stageIndex, taskIndex) {
      const st = this.data.quests[questId]?.stages?.[stageIndex];
      if (!st?.tasks) return;
      if (st.tasks.length <= 1) {
        Editor.toast.warning('На этапе нужна хотя бы одна задача');
        return;
      }
      st.tasks.splice(taskIndex, 1);
      this.renderQuests();
      this.updateJSONPreview();
    },

    changeQuestTaskType(questId, stageIndex, taskIndex, type) {
      const st = this.data.quests[questId]?.stages?.[stageIndex];
      if (!st?.tasks?.[taskIndex]) return;
      if (typeof QuestTaskRegistry !== 'undefined') {
        const C = QuestTaskRegistry.get(type);
        if (C && C.unsupported && !this.isQuestDevMode()) {
          Editor.toast.warning('Тип «' + (C.label || type) + '» пока не поддерживается. Выберите другую задачу.');
          this.renderQuests();
          return;
        }
      }
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
      if (field === 'count' || field === 'amount' || field === 'level' || field === 'hours' || field === 'minutes') {
        const n = parseInt(value, 10);
        t[field] = Number.isFinite(n) && n > 0 ? n : 1;
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

  if (Editor.hooks && typeof Editor.hooks.register === 'function' && typeof Editor.renderQuests === 'function') {
    Editor.hooks.register('editor-quests', {
      renderQuests: Editor.renderQuests
    }, { force: true });
  }
})();
