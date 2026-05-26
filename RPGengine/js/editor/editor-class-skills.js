// Редактор: выбор навыков класса (skillChoices) во вкладке «Классы»

(function attachEditorClassSkills() {
  if (typeof Editor === 'undefined') {
    console.error('editor-class-skills.js: Editor не определён');
    return;
  }

  const PF2E_SKILL_OPTIONS = [
    { id: 'acrobatics', label: 'Акробатика' },
    { id: 'arcana', label: 'Магия (тайные знания)' },
    { id: 'athletics', label: 'Атлетика' },
    { id: 'crafting', label: 'Ремесло' },
    { id: 'deception', label: 'Обман' },
    { id: 'diplomacy', label: 'Дипломатия' },
    { id: 'intimidation', label: 'Запугивание' },
    { id: 'medicine', label: 'Медицина' },
    { id: 'nature', label: 'Природа' },
    { id: 'occultism', label: 'Оккультизм' },
    { id: 'performance', label: 'Выступление' },
    { id: 'religion', label: 'Религия' },
    { id: 'society', label: 'Общество' },
    { id: 'stealth', label: 'Скрытность' },
    { id: 'survival', label: 'Выживание' },
    { id: 'thievery', label: 'Воровство' },
    { id: 'perception', label: 'Восприятие' }
  ];

  const PF2E_RANK_OPTIONS = ['trained', 'expert', 'master', 'legendary'];

  const SKILL_OPTIONS = [
    { id: 'acrobatics', label: 'Акробатика' },
    { id: 'animal_handling', label: 'Уход за животными' },
    { id: 'arcana', label: 'Магия (тайные знания)' },
    { id: 'athletics', label: 'Атлетика' },
    { id: 'deception', label: 'Обман' },
    { id: 'history', label: 'История' },
    { id: 'insight', label: 'Проницательность' },
    { id: 'intimidation', label: 'Устрашение' },
    { id: 'investigation', label: 'Расследование' },
    { id: 'medicine', label: 'Медицина' },
    { id: 'nature', label: 'Природа' },
    { id: 'perception', label: 'Восприятие' },
    { id: 'performance', label: 'Выступление' },
    { id: 'persuasion', label: 'Убеждение' },
    { id: 'religion', label: 'Религия' },
    { id: 'sleight_of_hand', label: 'Ловкость рук' },
    { id: 'stealth', label: 'Скрытность' },
    { id: 'survival', label: 'Выживание' }
  ];

  const _renderClasses = Editor.renderClasses.bind(Editor);
  const _renderClassDetail = Editor.renderClassDetail.bind(Editor);

  function ensureSkillChoices(cls) {
    if (!cls.skillChoices) {
      cls.skillChoices = { count: 2, from: [] };
    }
    if (cls.skillChoices.from === 'any') return;
    if (!Array.isArray(cls.skillChoices.from)) cls.skillChoices.from = [];
  }

  function skillBadge(cls) {
    const fixed = (cls.fixedSkills || []).length;
    const sc = cls.skillChoices;
    if (!sc && !fixed) return '';
    const n = parseInt(sc?.count, 10) || 0;
    if (cls.system === 'pf2e') {
      return `<span class="class-skill-badge" style="display:block;font-size:11px;color:var(--ink-faint);margin-top:2px;">PF2e: ${fixed} фикс. + ${n}</span>`;
    }
    if (sc.from === 'any') return `<span class="class-skill-badge" style="display:block;font-size:11px;color:var(--ink-faint);margin-top:2px;">Навыки: ${n} (любые)</span>`;
    const len = Array.isArray(sc.from) ? sc.from.length : 0;
    return `<span class="class-skill-badge" style="display:block;font-size:11px;color:var(--ink-faint);margin-top:2px;">Навыки: ${n}${len ? ` / ${len}` : ''}</span>`;
  }

  function ensureFixedSkills(cls) {
    if (!Array.isArray(cls.fixedSkills)) cls.fixedSkills = [];
  }

  Editor.renderPf2eClassSkillsSection = function (id) {
    const cls = this.data.classes[id];
    if (!cls) return '';
    ensureSkillChoices(cls);
    ensureFixedSkills(cls);
    const sc = cls.skillChoices;
    const isAny = sc.from === 'any';
    const count = parseInt(sc.count, 10) || 0;
    const rank = sc.rank || 'trained';
    const fixedChecks = PF2E_SKILL_OPTIONS.map(opt => {
      const on = cls.fixedSkills.includes(opt.id);
      return `<label style="display:block;font-size:13px;margin:3px 0;">
        <input type="checkbox" ${on ? 'checked' : ''}
          onchange="Editor.toggleClassFixedSkill('${id}','${opt.id}',this.checked)">
        ${this.escapeHtml(opt.label)} <code>${opt.id}</code>
      </label>`;
    }).join('');
    const choiceChecks = PF2E_SKILL_OPTIONS.map(opt => {
      const on = !isAny && sc.from.includes(opt.id);
      return `<label style="display:block;font-size:13px;margin:3px 0;">
        <input type="checkbox" ${on ? 'checked' : ''} ${isAny ? 'disabled' : ''}
          onchange="Editor.toggleClassSkillFrom('${id}','${opt.id}',this.checked)">
        ${this.escapeHtml(opt.label)} <code>${opt.id}</code>
      </label>`;
    }).join('');
    const rankOpts = PF2E_RANK_OPTIONS.map(r =>
      `<option value="${r}" ${rank === r ? 'selected' : ''}>${r}</option>`
    ).join('');
    return `
      <div class="class-section">
        <h4>🎯 Навыки PF2e</h4>
        <div class="form-group">
          <label>Ключевая характеристика (keyAbility)</label>
          <select onchange="Editor.updateClass('${id}','keyAbility',this.value)">
            ${['str', 'dex', 'con', 'int', 'wis', 'cha'].map(s =>
              `<option value="${s}" ${cls.keyAbility === s ? 'selected' : ''}>${s.toUpperCase()}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Фиксированные навыки (fixedSkills) — автоматически trained</label>
          <div style="max-height:140px;overflow-y:auto;border:1px solid var(--border);padding:8px;border-radius:6px;">${fixedChecks}</div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label>Количество на выбор</label>
            <input type="number" min="0" max="18" value="${count}"
              onchange="Editor.setClassSkillCount('${id}', parseInt(this.value, 10) || 0)">
          </div>
          <div class="form-group">
            <label>Ранг при выборе</label>
            <select onchange="Editor.setClassSkillChoiceRank('${id}', this.value)">${rankOpts}</select>
          </div>
        </div>
        <div class="form-group">
          <label><input type="checkbox" ${isAny ? 'checked' : ''}
            onchange="Editor.setClassSkillAny('${id}', this.checked)"> Любые (any)</label>
        </div>
        <div class="form-group" style="${isAny ? 'opacity:0.5' : ''}">
          <label>Доступные для выбора</label>
          <div style="max-height:200px;overflow-y:auto;border:1px solid var(--border);padding:8px;border-radius:6px;">${choiceChecks}</div>
        </div>
      </div>`;
  };

  Editor.toggleClassFixedSkill = function (id, skillId, checked) {
    const cls = this.data.classes[id];
    if (!cls) return;
    ensureFixedSkills(cls);
    if (checked && !cls.fixedSkills.includes(skillId)) cls.fixedSkills.push(skillId);
    else cls.fixedSkills = cls.fixedSkills.filter(s => s !== skillId);
    this.updateJSONPreview();
    this.renderClasses();
  };

  Editor.setClassSkillChoiceRank = function (id, rank) {
    const cls = this.data.classes[id];
    if (!cls) return;
    ensureSkillChoices(cls);
    cls.skillChoices.rank = rank || 'trained';
    this.updateJSONPreview();
    this.renderClasses();
  };

  Editor.renderClassSkillChoicesSection = function (id) {
    const cls = this.data.classes[id];
    if (!cls) return '';
    if (cls.system === 'pf2e') return this.renderPf2eClassSkillsSection(id);
    ensureSkillChoices(cls);
    const sc = cls.skillChoices;
    const isAny = sc.from === 'any';
    const count = parseInt(sc.count, 10) || 0;
    const checks = SKILL_OPTIONS.map(opt => {
      const on = !isAny && sc.from.includes(opt.id);
      return `<label style="display:block;font-size:13px;margin:3px 0;">
        <input type="checkbox" ${on ? 'checked' : ''} ${isAny ? 'disabled' : ''}
          onchange="Editor.toggleClassSkillFrom('${id}','${opt.id}',this.checked)">
        ${this.escapeHtml(opt.label)} <code>${opt.id}</code>
      </label>`;
    }).join('');
    return `
      <div class="class-section">
        <h4>🎯 Навыки класса (skillChoices)</h4>
        <div class="grid-2">
          <div class="form-group">
            <label>Количество навыков</label>
            <input type="number" min="0" max="18" value="${count}"
              onchange="Editor.setClassSkillCount('${id}', parseInt(this.value, 10) || 0)">
          </div>
          <div class="form-group">
            <label><input type="checkbox" ${isAny ? 'checked' : ''}
              onchange="Editor.setClassSkillAny('${id}', this.checked)"> Любые (any)</label>
            <div class="hint">Если включено — игрок выбирает из всех навыков D&D 5e.</div>
          </div>
        </div>
        <div class="form-group" style="${isAny ? 'opacity:0.5' : ''}">
          <label>Доступные навыки</label>
          <div style="max-height:200px;overflow-y:auto;border:1px solid var(--border);padding:8px;border-radius:6px;">
            ${checks}
          </div>
        </div>
        <div class="hint">Устаревшее поле «skills» (строка) — только для старых сценариев без skillChoices.</div>
        <div class="form-group">
          <label>Владение навыками (legacy)</label>
          <input value="${this.escapeHtml(cls.skills || '')}" onchange="Editor.updateClass('${id}','skills',this.value)">
        </div>
      </div>`;
  };

  Editor.setClassSkillCount = function (id, count) {
    const cls = this.data.classes[id];
    if (!cls) return;
    ensureSkillChoices(cls);
    cls.skillChoices.count = Math.max(0, count);
    this.updateJSONPreview();
    this.renderClasses();
  };

  Editor.setClassSkillAny = function (id, checked) {
    const cls = this.data.classes[id];
    if (!cls) return;
    ensureSkillChoices(cls);
    if (checked) {
      cls.skillChoices.from = 'any';
    } else if (cls.skillChoices.from === 'any') {
      cls.skillChoices.from = [];
    }
    this.updateJSONPreview();
    this.renderClasses();
  };

  Editor.toggleClassSkillFrom = function (id, skillId, checked) {
    const cls = this.data.classes[id];
    if (!cls) return;
    ensureSkillChoices(cls);
    if (cls.skillChoices.from === 'any') return;
    if (!Array.isArray(cls.skillChoices.from)) cls.skillChoices.from = [];
    if (checked && !cls.skillChoices.from.includes(skillId)) cls.skillChoices.from.push(skillId);
    else cls.skillChoices.from = cls.skillChoices.from.filter(s => s !== skillId);
    this.updateJSONPreview();
    this.renderClasses();
  };

  Editor.renderClasses = function () {
    const container = document.getElementById('classes-list');
    if (!container || !this.data?.classes) {
      return _renderClasses();
    }
    const ids = Object.keys(this.data.classes);
    if (!ids.length) return _renderClasses();
    if (!this.editingClassId || !this.data.classes[this.editingClassId]) {
      this.editingClassId = ids[0];
    }
    const sidebar = ids.map(id => {
      const cls = this.data.classes[id];
      const active = id === this.editingClassId ? 'active' : '';
      return `<button type="button" class="class-pick ${active}" onclick="Editor.selectClassToEdit('${id}')">
        ${this.renderIcon(cls.icon) || '⚔️'} ${this.escapeHtml(cls.name || id)}
        ${skillBadge(cls)}
      </button>`;
    }).join('');
    container.innerHTML = `<div class="class-editor-wrap">
      <div class="class-editor-sidebar">${sidebar}
        <button type="button" class="btn btn-primary" style="width:100%;margin-top:10px;" onclick="Editor.createClass()">+ Новый класс</button>
      </div>
      <div class="class-editor-detail">${this.renderClassDetail(this.editingClassId)}</div>
    </div>`;
  };

  Editor.renderClassDetail = function (id) {
    let html = _renderClassDetail(id);
    const section = this.renderClassSkillChoicesSection(id);
    const abMarker = '<div class="class-section"><h4>✨ Способности</h4>';
    if (html.includes(abMarker)) {
      html = html.replace(abMarker, section + abMarker);
    } else {
      html += section;
    }
    return html;
  };

  const _createClass = Editor.createClass.bind(Editor);
  Editor.createClass = function () {
    _createClass();
    const id = this.editingClassId;
    if (id && this.data.classes[id]) {
      const c = this.data.classes[id];
      c.skillChoices = { count: 2, from: [], rank: 'trained' };
      c.fixedSkills = c.system === 'pf2e' ? [] : undefined;
      c.skills = '';
      this.renderClasses();
      this.updateJSONPreview();
    }
  };
})();
