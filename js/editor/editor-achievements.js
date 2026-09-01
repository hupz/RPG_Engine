// Редактор достижений (data.achievements)

(function attachEditorAchievements() {
  if (typeof Editor === 'undefined') {
    console.error('editor-achievements.js: Editor не определён');
    return;
  }

  const TEMPLATES = typeof AchievementSystem !== 'undefined'
    ? AchievementSystem.TEMPLATES
    : {
      visit_scene: 'Пройти сцену',
      collect_items: 'Собрать N предметов',
      defeat_boss: 'Победить босса (сцена боя)',
      defeat_enemy: 'Победить врага',
      quest_stage: 'Достичь стадии квеста',
      quest_complete: 'Завершить квест',
      flag: 'Флаг = значение'
    };

  Object.assign(Editor, {
    editingAchievementId: null,
    editingAchievementMode: 'list',

    ensureAchievements() {
      if (!this.data) return;
      if (typeof AchievementSystem !== 'undefined') {
        AchievementSystem.ensureAchievements(this.data);
        AchievementSystem.normalizeAll(this.data);
      } else if (!this.data.achievements) {
        this.data.achievements = {};
      }
    },

    getAchievementIds() {
      this.ensureAchievements();
      return Object.keys(this.data.achievements || {});
    },

    selectAchievementToEdit(id) {
      this.editingAchievementId = id;
      this.editingAchievementMode = 'edit';
      this.renderAchievements();
    },

    cancelAchievementEdit() {
      this.editingAchievementMode = 'list';
      this.renderAchievements();
    },

    createAchievement() {
      this.ensureAchievements();
      let n = 1;
      let id = 'achievement_1';
      while (this.data.achievements[id]) {
        n += 1;
        id = `achievement_${n}`;
      }
      this.data.achievements[id] = {
        id,
        title: 'Новое достижение',
        description: '',
        icon: '🏆',
        secret: false,
        sound: 'buff',
        unlock: { type: 'template', template: 'visit_scene', sceneId: 'start' }
      };
      this.editingAchievementId = id;
      this.editingAchievementMode = 'edit';
      this.renderAchievements();
      this.updateJSONPreview();
    },

    async deleteAchievement(id) {
      if (!this.data?.achievements?.[id]) return;
      if (!(await Editor.confirmDialog({ message: `Удалить достижение «${this.data.achievements[id].title || id}»?`, danger: true }))) return;
      delete this.data.achievements[id];
      if (this.editingAchievementId === id) {
        this.editingAchievementId = null;
        this.editingAchievementMode = 'list';
      }
      this.renderAchievements();
      this.updateJSONPreview();
    },

    updateAchievementField(id, field, value) {
      const ach = this.data?.achievements?.[id];
      if (!ach) return;
      ach[field] = value;
      this.updateJSONPreview();
      if (field === 'title' || field === 'icon') this.renderAchievements();
    },

    setAchievementUnlockType(id, type) {
      const ach = this.data?.achievements?.[id];
      if (!ach) return;
      if (!ach.unlock) ach.unlock = {};
      ach.unlock.type = type;
      if (type === 'template' && !ach.unlock.template) {
        ach.unlock.template = 'visit_scene';
        ach.unlock.sceneId = Object.keys(this.data.scenes || {})[0] || 'start';
      }
      if (type === 'expression' && ach.unlock.expression == null) ach.unlock.expression = '';
      if (type === 'rules' && !ach.unlock.rules) ach.unlock.rules = { all: [] };
      this.renderAchievements();
      this.updateJSONPreview();
    },

    setAchievementTemplate(id, template) {
      const ach = this.data?.achievements?.[id];
      if (!ach) return;
      if (!ach.unlock) ach.unlock = { type: 'template' };
      ach.unlock.type = 'template';
      ach.unlock.template = template;
      this.renderAchievements();
      this.updateJSONPreview();
    },

    updateAchievementUnlockParam(id, key, value) {
      const ach = this.data?.achievements?.[id];
      if (!ach) return;
      if (!ach.unlock) ach.unlock = { type: 'template', template: 'visit_scene' };
      if (value === '' || value == null) delete ach.unlock[key];
      else ach.unlock[key] = value;
      this.updateJSONPreview();
    },

    updateAchievementExpression(id, expression) {
      const ach = this.data?.achievements?.[id];
      if (!ach) return;
      if (!ach.unlock) ach.unlock = { type: 'expression' };
      ach.unlock.type = 'expression';
      ach.unlock.expression = expression;
      this.updateJSONPreview();
    },

    renderAchievements() {
      const c = document.getElementById('achievements-editor');
      if (!c) return;
      if (!this.data) {
        c.innerHTML = '<div class="empty-state"><h2>Загрузите данные</h2></div>';
        return;
      }
      this.ensureAchievements();

      if (this.editingAchievementMode === 'edit' && this.editingAchievementId) {
        c.innerHTML = this.renderAchievementEditForm(this.editingAchievementId);
        if (typeof EditorHelp !== 'undefined') EditorHelp.scheduleEnhance();
        return;
      }

      const ids = this.getAchievementIds();
      const cards = ids.map((id) => {
        const ach = this.data.achievements[id];
        const secret = ach.secret ? '<span class="ach-secret-badge">секрет</span>' : '';
        return `<div class="ach-card">
          <div class="ach-card-head">
            <span>${this.renderIcon(ach.icon || '🏆')} <strong>${this.escapeHtml(ach.title || id)}</strong> ${secret}</span>
          </div>
          <div class="hint">${this.escapeHtml(ach.description || '—')}</div>
          <div class="hint">ID: <code>${this.escapeHtml(id)}</code></div>
          <div class="ach-card-actions">
            <button type="button" class="btn btn-secondary" onclick="Editor.selectAchievementToEdit(${JSON.stringify(id)})">Редактировать</button>
            <button type="button" class="btn btn-danger" onclick="Editor.deleteAchievement(${JSON.stringify(id)})">Удалить</button>
          </div>
        </div>`;
      }).join('');

      c.innerHTML = `<div class="ach-manager">
        <div class="ach-manager-head">
          <h3>🏆 Достижения</h3>
          <button type="button" class="btn btn-primary" onclick="Editor.createAchievement()">+ Добавить достижение</button>
        </div>
        <p class="hint">Условия проверяются при смене сцены, получении предмета и победе в бою. Прогресс хранится в сохранении игрока.</p>
        <div class="ach-grid">${cards || '<p class="hint">Нет достижений — создайте первое.</p>'}</div>
      </div>`;
      if (typeof EditorHelp !== 'undefined') EditorHelp.scheduleEnhance();
    },

    renderAchievementUnlockBlock(id, unlock) {
      const u = unlock || { type: 'template', template: 'visit_scene' };
      const type = u.type || 'template';
      const scenes = Object.keys(this.data.scenes || {});
      const sceneOpts = scenes.map((sid) =>
        `<option value="${this.escapeAttr(sid)}" ${(u.sceneId || u.scene) === sid ? 'selected' : ''}>${this.escapeHtml(sid)}</option>`
      ).join('');
      const items = this.getAllItemIds();
      const itemOpts = items.map((iid) =>
        `<option value="${this.escapeAttr(iid)}" ${u.itemId === iid ? 'selected' : ''}>${this.escapeHtml(this.data.items[iid]?.name || iid)}</option>`
      ).join('');
      const enemies = Object.keys(this.data.enemies || {});
      const enemyOpts = enemies.map((eid) =>
        `<option value="${this.escapeAttr(eid)}" ${(u.enemyId || u.enemy) === eid ? 'selected' : ''}>${this.escapeHtml(eid)}</option>`
      ).join('');
      const quests = this.getQuestIds?.() || Object.keys(this.data.quests || {});
      const questOpts = quests.map((qid) =>
        `<option value="${this.escapeAttr(qid)}" ${(u.questId || u.quest) === qid ? 'selected' : ''}>${this.escapeHtml(this.data.quests[qid]?.title || qid)}</option>`
      ).join('');

      const tplOpts = Object.entries(TEMPLATES).map(([k, label]) =>
        `<option value="${k}" ${u.template === k ? 'selected' : ''}>${this.escapeHtml(label)}</option>`
      ).join('');

      const typeSel = `<div class="form-group"><label>Тип условия</label>
        <select onchange="Editor.setAchievementUnlockType(${JSON.stringify(id)}, this.value)">
          <option value="template" ${type === 'template' ? 'selected' : ''}>Шаблон</option>
          <option value="expression" ${type === 'expression' ? 'selected' : ''}>JavaScript-выражение</option>
        </select></div>`;

      let body = '';
      if (type === 'expression') {
        body = `<div class="form-group"><label>JavaScript-выражение</label>
          <textarea rows="3" placeholder="sceneVisits['village'] >= 1 && flags.met_marta"
            onchange="Editor.updateAchievementExpression(${JSON.stringify(id)}, this.value)">${this.escapeTextarea(u.expression || '')}</textarea>
          <div class="hint">Доступны: state, flags, inventory, questStages, sceneVisits, clearedCombats, achievementUnlocks, data</div></div>`;
      } else {
        body = `<div class="form-group"><label>Шаблон условия</label>
          <select onchange="Editor.setAchievementTemplate(${JSON.stringify(id)}, this.value)">${tplOpts}</select></div>`;

        const tpl = u.template || 'visit_scene';
        if (tpl === 'visit_scene' || tpl === 'defeat_boss') {
          body += `<div class="form-group"><label>Сцена</label>
            <select onchange="Editor.updateAchievementUnlockParam(${JSON.stringify(id)}, 'sceneId', this.value)">
              <option value="">— выберите —</option>${sceneOpts}</select></div>`;
        }
        if (tpl === 'collect_items') {
          body += `<div class="grid-2">
            <div class="form-group"><label>Предмет</label>
              <select onchange="Editor.updateAchievementUnlockParam(${JSON.stringify(id)}, 'itemId', this.value)">
                <option value="">— выберите —</option>${itemOpts}</select></div>
            <div class="form-group"><label>Количество</label>
              <input type="number" min="1" value="${parseInt(u.count, 10) || 1}"
                onchange="Editor.updateAchievementUnlockParam(${JSON.stringify(id)}, 'count', parseInt(this.value,10)||1)"></div>
          </div>`;
        }
        if (tpl === 'defeat_enemy') {
          body += `<div class="form-group"><label>Враг / босс</label>
            <select onchange="Editor.updateAchievementUnlockParam(${JSON.stringify(id)}, 'enemyId', this.value)">
              <option value="">— выберите —</option>${enemyOpts}</select></div>`;
        }
        if (tpl === 'quest_stage' || tpl === 'quest_complete') {
          body += `<div class="form-group"><label>Квест</label>
            <select onchange="Editor.updateAchievementUnlockParam(${JSON.stringify(id)}, 'questId', this.value)">
              <option value="">— выберите —</option>${questOpts}</select></div>`;
          if (tpl === 'quest_stage') {
            body += `<div class="form-group"><label>Стадия</label>
              <input value="${this.escapeAttr(u.stage != null ? String(u.stage) : '0')}" placeholder="0, 1, complete"
                onchange="Editor.updateAchievementUnlockParam(${JSON.stringify(id)}, 'stage', this.value)"></div>`;
          }
        }
        if (tpl === 'flag') {
          body += `<div class="grid-2">
            <div class="form-group"><label>Флаг</label>
              <input value="${this.escapeAttr(u.flag || '')}" onchange="Editor.updateAchievementUnlockParam(${JSON.stringify(id)}, 'flag', this.value)"></div>
            <div class="form-group"><label>Значение</label>
              <input value="${this.escapeAttr(u.equals != null ? String(u.equals) : (u.value != null ? String(u.value) : 'true'))}"
                onchange="Editor.updateAchievementUnlockParam(${JSON.stringify(id)}, 'equals', this.value)"></div>
          </div>`;
        }
      }

      return typeSel + body;
    },

    renderAchievementEditForm(achievementId) {
      const ach = this.data.achievements[achievementId];
      if (!ach) return '<div class="empty-state">Достижение не найдено</div>';
      const aid = JSON.stringify(achievementId);
      const soundOpts = typeof this.renderSoundSelect === 'function'
        ? this.renderSoundSelect(ach.sound || 'buff', `Editor.updateAchievementField(${aid},'sound',this.value||'buff')`)
        : `<input value="${this.escapeAttr(ach.sound || 'buff')}" onchange="Editor.updateAchievementField(${aid},'sound',this.value)">`;

      return `<div class="quest-detail-card ach-edit-form">
        <div class="quest-detail-head">
          <h3>Редактирование достижения</h3>
          <button type="button" class="btn btn-secondary" onclick="Editor.cancelAchievementEdit()">← К списку</button>
        </div>
        <div class="form-group"><label>ID (ключ в JSON)</label>
          <input value="${this.escapeHtml(achievementId)}" disabled>
          <div class="hint"><code>achievements.${this.escapeHtml(achievementId)}</code></div></div>
        <div class="form-group"><label>Название</label>
          <input value="${this.escapeAttr(ach.title || '')}" onchange="Editor.updateAchievementField(${aid},'title',this.value)"></div>
        <div class="form-group"><label>Описание</label>
          <textarea rows="2" onchange="Editor.updateAchievementField(${aid},'description',this.value)">${this.escapeTextarea(ach.description || '')}</textarea></div>
        <div class="form-group"><label>Иконка</label>
          <div class="icon-picker-row">
            ${typeof this.renderIconEmojiSelect === 'function'
              ? this.renderIconEmojiSelect(`if(this.value){Editor.updateAchievementField(${aid},'icon',this.value);}`)
              : ''}
            <input type="text" value="${this.escapeAttr(ach.icon || '🏆')}" onchange="Editor.updateAchievementField(${aid},'icon',this.value)">
            ${this.renderIconPreview(ach.icon)}
          </div>
          <div class="hint">Emoji или путь к PNG/SVG из папки проекта.</div></div>
        <div class="form-group"><label>Звук при получении</label>${soundOpts}</div>
        <div class="form-group"><label>
          <input type="checkbox" ${ach.secret ? 'checked' : ''} onchange="Editor.updateAchievementField(${aid},'secret',this.checked)">
          Секретное (скрыто до получения)</label></div>
        <h4>Условие получения</h4>
        ${this.renderAchievementUnlockBlock(achievementId, ach.unlock)}
      </div>`;
    }
  });
})();
