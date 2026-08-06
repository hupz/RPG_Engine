// ============================================================
// Прогрессия
// Вынесено из editor.html
// ============================================================
(function () {
  if (typeof Editor === 'undefined') {
    console.error('editor-progression-panel.js: Editor не определён');
    return;
  }
  Object.assign(Editor, {
    renderProgression(){ const c=document.getElementById('progression-editor'); if(!this.data){c.innerHTML='<div class="empty-state"><h2>Нет данных</h2></div>';return;} if(!this.data.progression)this.data.progression={enabled:true,maxLevel:5,expTable:[0,100,220,380,600],defaultHpGain:'1d8',defaults:{enemyExp:20,skillCheckExp:12},skillExp:{},abilities:{}}; const pg=this.data.progression; let html=`<div class="project-info"><h4>Система уровней</h4><div class="form-group"><label><input type="checkbox" ${pg.enabled!==false?'checked':''} onchange="Editor.updateProgression('enabled',this.checked)"> Включена</label></div><div class="form-group"><label>Макс. уровень</label><input type="number" value="${pg.maxLevel||5}" onchange="Editor.updateProgression('maxLevel',parseInt(this.value))"></div><div class="form-group"><label>Пороги опыта (через запятую)</label><input value="${(pg.expTable||[]).join(', ')}" onchange="Editor.updateExpTable(this.value)"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;"><div class="form-group"><label>XP за врага по умолч.</label><input type="number" value="${pg.defaults?.enemyExp??20}" onchange="Editor.updateProgressionDefault('enemyExp',parseInt(this.value))"></div><div class="form-group"><label>XP за проверку по умолч.</label><input type="number" value="${pg.defaults?.skillCheckExp??12}" onchange="Editor.updateProgressionDefault('skillCheckExp',parseInt(this.value))"></div></div></div>`; html += `<div class="project-info"><h4>Прогрессия классов</h4>`; html += Object.entries(this.data.classes || {}).map(([classId, cls])=>this.renderClassProgressionSection(classId, cls, pg.maxLevel||5)).join(''); html += `</div>`; c.innerHTML=html; },

    renderClassProgressionSection(classId, cls, maxLevel) {
      if (!cls.progression) cls.progression = { levels: {} };
      if (!cls.progression.levels) cls.progression.levels = {};
      const options = this.getClassAbilityOptions(classId);
      const levels = [];
      for (let level = 2; level <= maxLevel; level += 1) {
        const cfg = cls.progression.levels[level] || { choices: [] };
        const chosen = (cfg.choices || []).map(choiceId => {
          const ab = (cls.abilities || []).find(a => a.id === choiceId) || { name: choiceId, icon: '' };
          return `<span class="progression-choice-chip">${this.renderIcon(ab.icon)} ${this.escapeHtml(ab.name || choiceId)}<button type="button" onclick="Editor.removeProgressionChoice('${this.escapeAttr(classId)}',${level},${JSON.stringify(choiceId)})">×</button></span>`;
        }).join('') || '<div class="hint">Нет выбранных умений</div>';
        const selectHtml = options.length
          ? `<select class="icon-picker-select" onchange="Editor.addProgressionChoice('${this.escapeAttr(classId)}',${level},this.value); this.value='';"><option value="">+ Добавить умение</option>${options.map(o => `<option value="${this.escapeAttr(o.id)}">${this.escapeHtml(o.icon)} ${this.escapeHtml(o.label)}</option>`).join('')}</select>`
          : '<div class="hint">Создайте умения для этого класса на вкладке «Классы»</div>';
        levels.push(`<div class="progression-level-row"><div class="row-title">Уровень ${level}</div><div class="progression-choice-list">${chosen}</div>${selectHtml}</div>`);
      }
      return `<div class="class-section"><h4>Прогрессия класса — ${this.escapeHtml(cls.name || classId)}</h4>${levels.join('')}</div>`;
    },

    addProgressionChoice(classId, level, abilityId) {
      if (!abilityId) return;
      const cls = this.data?.classes?.[classId];
      if (!cls) return;
      if (!cls.progression) cls.progression = { levels: {} };
      if (!cls.progression.levels) cls.progression.levels = {};
      if (!cls.progression.levels[level]) cls.progression.levels[level] = { choices: [] };
      const choices = cls.progression.levels[level].choices;
      if (!choices.includes(abilityId)) choices.push(abilityId);
      this.renderProgression();
      this.updateJSONPreview();
    },

    removeProgressionChoice(classId, level, abilityId) {
      const cfg = this.data?.classes?.[classId]?.progression?.levels?.[level];
      if (!cfg?.choices) return;
      cfg.choices = cfg.choices.filter(id => id !== abilityId);
      this.renderProgression();
      this.updateJSONPreview();
    }
  });
})();
