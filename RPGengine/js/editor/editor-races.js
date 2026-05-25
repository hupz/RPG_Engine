// Редактор рас (D&D 5e + PF2e Ancestry)

(function attachEditorRaces() {
  if (typeof Editor === 'undefined') {
    console.error('editor-races.js: Editor не определён');
    return;
  }

  const SKILL_OPTIONS = [
    { id: 'athletics', label: 'Атлетика' },
    { id: 'acrobatics', label: 'Акробатика' },
    { id: 'stealth', label: 'Скрытность' },
    { id: 'perception', label: 'Восприятие' },
    { id: 'survival', label: 'Выживание' },
    { id: 'intimidation', label: 'Устрашение' },
    { id: 'persuasion', label: 'Убеждение' },
    { id: 'deception', label: 'Обман' },
    { id: 'investigation', label: 'Расследование' },
    { id: 'history', label: 'История' },
    { id: 'religion', label: 'Религия' },
    { id: 'medicine', label: 'Медицина' },
    { id: 'insight', label: 'Проницательность' },
    { id: 'magic', label: 'Магия' }
  ];

  const STAT_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const STAT_LABELS = { str: 'СИЛ', dex: 'ЛОВ', con: 'ТЕЛ', int: 'ИНТ', wis: 'МУД', cha: 'ХАР' };
  const BOOST_OPTIONS = [...STAT_KEYS, 'free'];
  const TRAIT_TYPES_DND = ['passive', 'active', 'resistance', 'proficiency'];
  const TRAIT_TYPES_PF2E = ['passive', 'active', 'resistance'];
  const SIZE_OPTIONS = ['medium', 'small', 'tiny'];

  Object.assign(Editor, {
    editingRaceId: null,

    ensureRaces() {
      if (!this.data) return;
      if (!this.data.races || typeof this.data.races !== 'object') {
        this.data.races = {};
      }
    },

    getRaceIds() {
      this.ensureRaces();
      return Object.keys(this.data.races);
    },

    isPf2eRace(race) {
      return race?.system === 'pf2e';
    },

    selectRaceToEdit(id) {
      this.editingRaceId = id;
      this.renderRaces();
    },

    createRace() {
      this.ensureRaces();
      const sys = this.data?.meta?.system === 'pf2e' ? 'pf2e' : 'dnd5e';
      const id = prompt('ID расы (латиница, snake_case):', sys === 'pf2e' ? 'new_ancestry_pf2e' : 'new_race');
      if (!id || !/^[a-z][a-z0-9_]*$/i.test(id)) {
        alert('ID должен начинаться с буквы и содержать только латиницу, цифры и _');
        return;
      }
      if (this.data.races[id]) {
        alert('Раса с таким ID уже есть');
        return;
      }
      if (sys === 'pf2e') {
        this.data.races[id] = {
          id,
          system: 'pf2e',
          name: 'Новая раса (PF2e)',
          icon: '🧬',
          description: '',
          abilityBoosts: ['free'],
          speed: 25,
          hp: 8,
          size: 'medium',
          heritages: [],
          traits: [],
          languages: []
        };
      } else {
        this.data.races[id] = {
          id,
          name: 'Новая раса',
          icon: '🧬',
          description: '',
          asi: {},
          speed: 30,
          traits: [],
          bonusSkills: [],
          languages: []
        };
      }
      this.editingRaceId = id;
      this.renderRaces();
      this.updateJSONPreview();
    },

    deleteRace(id) {
      if (!id || !confirm('Удалить расу «' + id + '»?')) return;
      delete this.data.races[id];
      if (this.editingRaceId === id) {
        const ids = this.getRaceIds();
        this.editingRaceId = ids[0] || null;
      }
      this.renderRaces();
      this.updateJSONPreview();
    },

    updateRaceField(id, field, value) {
      const r = this.data?.races?.[id];
      if (!r) return;
      if (field === 'speed' || field === 'hp') r[field] = parseInt(value, 10) || 0;
      else if (field === 'description' || field === 'languages') r[field] = value;
      else if (field === 'system') {
        r.system = value === 'pf2e' ? 'pf2e' : undefined;
        if (value === 'pf2e') {
          if (!r.abilityBoosts) r.abilityBoosts = ['free'];
          if (r.hp == null) r.hp = 8;
          if (!r.size) r.size = 'medium';
          if (!r.heritages) r.heritages = [];
        }
      } else r[field] = value;
      if (field === 'name' || field === 'icon' || field === 'system') this.renderRaces();
      this.updateJSONPreview();
    },

    updateRaceAsi(id, stat, value) {
      const r = this.data?.races?.[id];
      if (!r) return;
      if (!r.asi) r.asi = {};
      const n = parseInt(value, 10);
      if (!value || Number.isNaN(n) || n === 0) delete r.asi[stat];
      else r.asi[stat] = n;
      this.updateJSONPreview();
    },

    setRaceAbilityBoostSlot(raceId, idx, value) {
      const r = this.data?.races?.[raceId];
      if (!r) return;
      if (!r.abilityBoosts) r.abilityBoosts = [];
      while (r.abilityBoosts.length <= idx) r.abilityBoosts.push('free');
      r.abilityBoosts[idx] = value;
      this.updateJSONPreview();
    },

    addRaceAbilityBoostSlot(raceId) {
      const r = this.data?.races?.[raceId];
      if (!r) return;
      if (!r.abilityBoosts) r.abilityBoosts = [];
      r.abilityBoosts.push('free');
      this.renderRaces();
      this.updateJSONPreview();
    },

    removeRaceAbilityBoostSlot(raceId, idx) {
      const r = this.data?.races?.[raceId];
      if (!r?.abilityBoosts) return;
      r.abilityBoosts.splice(idx, 1);
      this.renderRaces();
      this.updateJSONPreview();
    },

    toggleRaceBonusSkill(raceId, skillId, checked) {
      const r = this.data?.races?.[raceId];
      if (!r) return;
      if (!r.bonusSkills) r.bonusSkills = [];
      if (checked && !r.bonusSkills.includes(skillId)) r.bonusSkills.push(skillId);
      else r.bonusSkills = r.bonusSkills.filter(s => s !== skillId);
      this.updateJSONPreview();
    },

    addRaceTrait(raceId) {
      const r = this.data?.races?.[raceId];
      if (!r) return;
      if (!r.traits) r.traits = [];
      const n = r.traits.length + 1;
      r.traits.push({
        id: raceId + '_trait_' + n,
        name: 'Новая черта',
        desc: '',
        type: 'passive'
      });
      this.renderRaces();
      this.updateJSONPreview();
    },

    updateRaceTrait(raceId, idx, field, value) {
      const r = this.data?.races?.[raceId];
      if (!r?.traits?.[idx]) return;
      r.traits[idx][field] = value;
      this.updateJSONPreview();
    },

    removeRaceTrait(raceId, idx) {
      const r = this.data?.races?.[raceId];
      if (!r?.traits) return;
      r.traits.splice(idx, 1);
      this.renderRaces();
      this.updateJSONPreview();
    },

    addRaceHeritage(raceId) {
      const r = this.data?.races?.[raceId];
      if (!r) return;
      if (!r.heritages) r.heritages = [];
      const n = r.heritages.length + 1;
      r.heritages.push({
        id: raceId + '_heritage_' + n,
        name: 'Новое наследие',
        desc: ''
      });
      this.renderRaces();
      this.updateJSONPreview();
    },

    updateRaceHeritage(raceId, idx, field, value) {
      const r = this.data?.races?.[raceId];
      if (!r?.heritages?.[idx]) return;
      r.heritages[idx][field] = value;
      this.updateJSONPreview();
    },

    removeRaceHeritage(raceId, idx) {
      const r = this.data?.races?.[raceId];
      if (!r?.heritages) return;
      r.heritages.splice(idx, 1);
      this.renderRaces();
      this.updateJSONPreview();
    },

    renderRaces() {
      const c = document.getElementById('races-editor');
      if (!c) return;
      if (!this.data) {
        c.innerHTML = '<div class="empty-state"><h2>Загрузите данные</h2></div>';
        return;
      }
      this.ensureRaces();
      const ids = this.getRaceIds();
      if (!ids.length) {
        c.innerHTML = `<div class="quest-manager">
          <div class="empty-state"><h2>Нет рас</h2><p class="hint">Добавьте расу D&D 5e или Ancestry PF2e.</p></div>
          <button type="button" class="btn btn-primary" onclick="Editor.createRace()">+ Добавить расу</button>
        </div>`;
        return;
      }
      if (!this.editingRaceId || !this.data.races[this.editingRaceId]) {
        this.editingRaceId = ids[0];
      }

      const sidebar = ids.map(id => {
        const r = this.data.races[id];
        const active = id === this.editingRaceId ? ' active' : '';
        const tag = r.system === 'pf2e' ? ' [PF2e]' : '';
        return `<button type="button" class="quest-pick${active}" onclick="Editor.selectRaceToEdit(${JSON.stringify(id)})">${this.renderIcon(r.icon)} ${this.escapeHtml(r.name || id)}${tag}</button>`;
      }).join('');

      const rid = this.editingRaceId;
      const race = this.data.races[rid];
      const pf2e = this.isPf2eRace(race);
      const traitTypes = pf2e ? TRAIT_TYPES_PF2E : TRAIT_TYPES_DND;

      let systemFields = `
        <div class="form-group"><label>Система</label>
          <select onchange="Editor.updateRaceField(${JSON.stringify(rid)},'system',this.value)">
            <option value="dnd5e" ${!pf2e ? 'selected' : ''}>D&D 5e</option>
            <option value="pf2e" ${pf2e ? 'selected' : ''}>Pathfinder 2e</option>
          </select>
        </div>`;

      let statBlock = '';
      if (pf2e) {
        const boostRows = (race.abilityBoosts || []).map((b, i) => `
          <div class="flex-row" style="gap:6px;margin-bottom:4px;">
            <select onchange="Editor.setRaceAbilityBoostSlot(${JSON.stringify(rid)},${i},this.value)">
              ${BOOST_OPTIONS.map(opt => `<option value="${opt}" ${b === opt ? 'selected' : ''}>${opt === 'free' ? 'свободный' : (STAT_LABELS[opt] || opt)}</option>`).join('')}
            </select>
            <button type="button" class="btn btn-danger" style="font-size:11px;" onclick="Editor.removeRaceAbilityBoostSlot(${JSON.stringify(rid)},${i})">×</button>
          </div>`).join('');
        statBlock = `
          <h4>Ability Boosts (PF2e)</h4>
          ${boostRows || '<p class="hint">Нет бустов.</p>'}
          <button type="button" class="btn btn-secondary" style="margin:6px 0;" onclick="Editor.addRaceAbilityBoostSlot(${JSON.stringify(rid)})">+ Слот буста</button>
          <div class="grid-3" style="margin-top:10px;">
            <div class="form-group"><label>ОЗ ancestry</label><input type="number" min="0" value="${race.hp ?? 8}" onchange="Editor.updateRaceField(${JSON.stringify(rid)},'hp',this.value)"></div>
            <div class="form-group"><label>Скорость (фт)</label><input type="number" min="0" value="${race.speed ?? 25}" onchange="Editor.updateRaceField(${JSON.stringify(rid)},'speed',this.value)"></div>
            <div class="form-group"><label>Размер</label>
              <select onchange="Editor.updateRaceField(${JSON.stringify(rid)},'size',this.value)">
                ${SIZE_OPTIONS.map(s => `<option value="${s}" ${race.size === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>
          </div>`;
      } else {
        const asiFields = STAT_KEYS.map(stat => `
          <div class="form-group" style="margin:0;">
            <label>${STAT_LABELS[stat]}</label>
            <input type="number" min="-2" max="4" step="1" value="${race.asi?.[stat] ?? ''}"
              placeholder="0" onchange="Editor.updateRaceAsi(${JSON.stringify(rid)},'${stat}',this.value)">
          </div>`).join('');
        const skillChecks = SKILL_OPTIONS.map(sk => {
          const on = (race.bonusSkills || []).includes(sk.id);
          return `<label style="display:block;font-size:13px;">
            <input type="checkbox" ${on ? 'checked' : ''} onchange="Editor.toggleRaceBonusSkill(${JSON.stringify(rid)},${JSON.stringify(sk.id)},this.checked)">
            ${this.escapeHtml(sk.label)}
          </label>`;
        }).join('');
        statBlock = `
          <div class="grid-2">
            <div><h4>ASI (D&D 5e)</h4><div class="grid-3">${asiFields}</div></div>
            <div class="form-group"><label>Скорость (фт)</label><input type="number" min="0" value="${race.speed ?? 30}" onchange="Editor.updateRaceField(${JSON.stringify(rid)},'speed',this.value)"></div>
          </div>
          <div class="form-group"><label>Бонусные навыки</label><div class="race-skill-checks">${skillChecks}</div></div>`;
      }

      const heritageRows = (race.heritages || []).map((h, i) => `
        <div class="race-trait-editor" style="border:1px dashed var(--border);padding:8px;margin-bottom:8px;border-radius:6px;">
          <div class="grid-2">
            <div class="form-group"><label>ID</label><input value="${this.escapeAttr(h.id)}" onchange="Editor.updateRaceHeritage(${JSON.stringify(rid)},${i},'id',this.value)"></div>
            <div class="form-group"><label>Название</label><input value="${this.escapeAttr(h.name)}" onchange="Editor.updateRaceHeritage(${JSON.stringify(rid)},${i},'name',this.value)"></div>
          </div>
          <div class="form-group"><label>Описание</label><textarea rows="2" onchange="Editor.updateRaceHeritage(${JSON.stringify(rid)},${i},'desc',this.value)">${this.escapeTextarea(h.desc || '')}</textarea></div>
          <button type="button" class="btn btn-danger" style="font-size:12px;" onclick="Editor.removeRaceHeritage(${JSON.stringify(rid)},${i})">Удалить наследие</button>
        </div>`).join('');

      const traitRows = (race.traits || []).map((t, i) => `
        <div class="race-trait-editor" style="border:1px dashed var(--border);padding:8px;margin-bottom:8px;border-radius:6px;">
          <div class="grid-2">
            <div class="form-group"><label>ID</label><input value="${this.escapeAttr(t.id)}" onchange="Editor.updateRaceTrait(${JSON.stringify(rid)},${i},'id',this.value)"></div>
            <div class="form-group"><label>Название</label><input value="${this.escapeAttr(t.name)}" onchange="Editor.updateRaceTrait(${JSON.stringify(rid)},${i},'name',this.value)"></div>
          </div>
          <div class="form-group"><label>Описание</label><textarea rows="2" onchange="Editor.updateRaceTrait(${JSON.stringify(rid)},${i},'desc',this.value)">${this.escapeTextarea(t.desc || '')}</textarea></div>
          <div class="form-group"><label>Тип</label>
            <select onchange="Editor.updateRaceTrait(${JSON.stringify(rid)},${i},'type',this.value)">
              ${traitTypes.map(tp => `<option value="${tp}" ${t.type === tp ? 'selected' : ''}>${tp}</option>`).join('')}
            </select>
          </div>
          <button type="button" class="btn btn-danger" style="font-size:12px;" onclick="Editor.removeRaceTrait(${JSON.stringify(rid)},${i})">Удалить черту</button>
        </div>`).join('');

      c.innerHTML = `<div class="quest-manager">
        <div class="quest-manager-sidebar">
          <h4>🧬 Расы</h4>
          ${sidebar}
          <button type="button" class="btn btn-primary" style="width:100%;margin-top:10px;" onclick="Editor.createRace()">+ Добавить расу</button>
        </div>
        <div class="quest-manager-detail paper-sheet">
          <div class="flex-row" style="justify-content:space-between;align-items:center;">
            <h3>${this.escapeHtml(race.name)} <span class="hint">(${this.escapeHtml(rid)})</span></h3>
            <button type="button" class="btn btn-danger" onclick="Editor.deleteRace(${JSON.stringify(rid)})">Удалить</button>
          </div>
          <div class="grid-2">
            <div class="form-group"><label>Название</label><input value="${this.escapeAttr(race.name)}" onchange="Editor.updateRaceField(${JSON.stringify(rid)},'name',this.value)"></div>
            <div class="form-group"><label>Иконка</label><input value="${this.escapeAttr(race.icon)}" onchange="Editor.updateRaceField(${JSON.stringify(rid)},'icon',this.value)"></div>
          </div>
          ${systemFields}
          <div class="form-group"><label>Описание</label><textarea rows="3" onchange="Editor.updateRaceField(${JSON.stringify(rid)},'description',this.value)">${this.escapeTextarea(race.description || '')}</textarea></div>
          ${statBlock}
          <div class="form-group"><label>Языки (через запятую)</label><input value="${this.escapeAttr((race.languages || []).join(', '))}" onchange="Editor.updateRaceField(${JSON.stringify(rid)},'languages',this.value.split(',').map(s=>s.trim()).filter(Boolean))"></div>
          ${pf2e ? `<h4>Наследия (Heritage)</h4>${heritageRows || '<p class="hint">Нет наследий.</p>'}
            <button type="button" class="btn btn-secondary" onclick="Editor.addRaceHeritage(${JSON.stringify(rid)})">+ Добавить наследие</button>` : ''}
          <h4>Черты расы</h4>
          ${traitRows || '<p class="hint">Нет черт.</p>'}
          <button type="button" class="btn btn-secondary" onclick="Editor.addRaceTrait(${JSON.stringify(rid)})">+ Добавить черту</button>
        </div>
      </div>`;
    }
  });

  const origRenderAll = Editor.renderAll.bind(Editor);
  Editor.renderAll = function () {
    origRenderAll();
    this.renderRaces();
  };
})();
