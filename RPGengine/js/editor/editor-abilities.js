// Редактор: типы эффектов умений (damage, smite, magic_missile…)

(function attachEditorAbilities() {
  if (typeof Editor === 'undefined') {
    console.error('editor-abilities.js: Editor не определён');
    return;
  }

  const ABILITY_EFFECT_TYPES = {
    damage: 'Урон',
    heal: 'Лечение',
    buff: 'Бафф',
    apply_status: 'Статус-эффект',
    extra_attack: 'Доп. атака',
    magic_missile: 'Маг. снаряд',
    smite: 'Кара',
    detect_magic: 'Обнаружение магии',
    divine_sense: 'Божественное чувство',
    custom: 'Особый'
  };

  const STATUS_EFFECT_IDS = ['poison', 'bleed', 'regen', 'weakened', 'fortified', 'stun'];

  Object.assign(Editor, {
    ABILITY_EFFECT_TYPES,
    STATUS_EFFECT_IDS,

    applyAbilityEffectDefaults(effect, type) {
      if (!effect) return;
      effect.type = type;
      if (type === 'damage') {
        effect.value = effect.value || '2d6';
        effect.damageType = effect.damageType || 'fire';
      } else if (type === 'heal') {
        effect.value = effect.value || '1d8+2';
      } else if (type === 'buff') {
        effect.buffType = effect.buffType || 'ac';
        effect.value = effect.value ?? 2;
      } else if (type === 'smite') {
        effect.value = effect.value || '2d8';
      } else if (type === 'magic_missile') {
        delete effect.value;
        delete effect.damageType;
      } else if (type === 'detect_magic' || type === 'divine_sense') {
        effect.message = effect.message || 'Вы ощущаете магию поблизости.';
      } else if (type === 'extra_attack') {
        delete effect.value;
      } else if (type === 'apply_status') {
        effect.addEffect = effect.addEffect || { id: 'regen', duration: 3 };
        effect.targeting = effect.targeting || { scope: 'self' };
        delete effect.value;
        delete effect.damageType;
      }
      if (type !== 'damage') delete effect.savingThrow;
      if (type !== 'damage' && type !== 'apply_status') delete effect.addEffect;
    },

    updateGlobalAbilityEffectMessage(id, value) {
      const target = this.data.progression?.abilities?.[id];
      if (!target?.effect) return;
      target.effect.message = value;
      this.updateJSONPreview();
    },

    updateAbilityEffectMessage(classId, idx, value) {
      const ab = this.data.classes[classId]?.abilities?.[idx];
      if (!ab?.effect) return;
      ab.effect.message = value;
      this.updateJSONPreview();
    },

    renderEffectTypeExtraFields(effect, handlers) {
      const t = effect?.type;
      const h = handlers || {};
      if (t === 'smite') {
        return `<div class="form-group"><label>Кубики кары (XdY)</label>
          <input value="${this.escapeHtml(effect.value || '2d8')}" placeholder="2d8"
            onchange="${h.value || ''}"></div>`;
      }
      if (t === 'magic_missile') {
        return `<div class="hint">Автоматически: 3×(1d4+1) по одному врагу (настройка в движке).</div>`;
      }
      if (t === 'detect_magic' || t === 'divine_sense') {
        return `<div class="form-group"><label>Сообщение в журнале</label>
          <textarea rows="2" onchange="${h.message || ''}">${this.escapeTextarea(effect.message || '')}</textarea></div>`;
      }
      if (t === 'apply_status') {
        return this.renderAddEffectFields(effect, h);
      }
      if (t === 'damage') {
        return this.renderAddEffectFields(effect, h, true);
      }
      return '';
    },

    renderSpellLevelSelect(current, onChangeAttr) {
      const cur = current != null ? String(current) : '0';
      const opts = [0, 1, 2, 3, 4, 5].map(n => {
        const label = n === 0 ? '0 — не магия (энергия)' : `${n} круг`;
        return `<option value="${n}" ${cur === String(n) ? 'selected' : ''}>${label}</option>`;
      }).join('');
      return `<select class="cb-select" onchange="${onChangeAttr}">${opts}</select>`;
    },

    renderAddEffectFields(effect, handlers, optional) {
      const h = handlers || {};
      const ae = effect?.addEffect || {};
      const opt = optional ? ' (опционально, при попадании)' : '';
      const ids = (this.data?.statusEffects
        ? Object.keys(this.data.statusEffects)
        : this.STATUS_EFFECT_IDS
      ).map(id => `<option value="${this.escapeAttr(id)}"${ae.id === id ? ' selected' : ''}>${this.escapeHtml(id)}</option>`)
        .join('');
      return `<div class="form-group"><label>Статус-эффект${opt}</label>
        <select onchange="${h.addEffectId || ''}">
          <option value="">— нет —</option>${ids}
        </select></div>
        <div class="form-group"><label>Длительность (ходы)</label>
          <input type="number" min="1" value="${ae.duration || 1}" onchange="${h.addEffectDuration || ''}"></div>`;
    }
  });

  const origGlobalAbilityEditor = Editor.renderGlobalAbilityEditor;
  if (typeof origGlobalAbilityEditor === 'function') {
    Editor.renderGlobalAbilityEditor = function (id, ab, idx) {
      let html = origGlobalAbilityEditor.call(this, id, ab, idx);
      const sl = ab.spellLevel != null ? ab.spellLevel : 0;
      const spellBlock = `<div class="form-group"><label>Уровень заклинания</label>${this.renderSpellLevelSelect(sl, `Editor.updateGlobalAbility('${this.escapeAttr(id)}','spellLevel',parseInt(this.value,10)||0)`)}</div>`;
      const needle = '<div class="form-group"><label>Тип эффекта</label>';
      if (html.includes(needle)) {
        html = html.replace(needle, spellBlock + needle);
      }
      return html;
    };
  }

  const origClassProgression = Editor.renderClassProgressionSection;
  if (typeof origClassProgression === 'function') {
    Editor.renderClassProgressionSection = function (classId, cls, maxLevel) {
      if (!cls.progression) cls.progression = { levels: {} };
      if (!cls.progression.levels) cls.progression.levels = {};
      const options = this.getClassAbilityOptions(classId);
      const levels = [];
      for (let level = 2; level <= maxLevel; level += 1) {
        const cfg = cls.progression.levels[level] || cls.progression.levels[String(level)] || { choices: [] };
        const slots = Array.isArray(cfg.slots) ? cfg.slots.join(', ') : '';
        const chosen = (cfg.choices || []).map(choiceId => {
          const ab = (cls.abilities || []).find(a => a.id === choiceId) || { name: choiceId, icon: '' };
          return `<span class="progression-choice-chip">${this.renderIcon(ab.icon)} ${this.escapeHtml(ab.name || choiceId)}<button type="button" onclick="Editor.removeProgressionChoice('${this.escapeAttr(classId)}',${level},${JSON.stringify(choiceId)})">×</button></span>`;
        }).join('') || '<div class="hint">Нет выбранных умений</div>';
        const selectHtml = options.length
          ? `<select class="icon-picker-select" onchange="Editor.addProgressionChoice('${this.escapeAttr(classId)}',${level},this.value); this.value='';"><option value="">+ Добавить умение</option>${options.map(o => `<option value="${this.escapeAttr(o.id)}">${this.escapeHtml(o.icon)} ${this.escapeHtml(o.label)}</option>`).join('')}</select>`
          : '<div class="hint">Создайте умения для этого класса на вкладке «Классы»</div>';
        levels.push(`<div class="progression-level-row"><div class="row-title">Уровень ${level}</div>
          <div class="form-group" style="margin:6px 0;"><label>Ячейки (через запятую)</label>
            <input value="${this.escapeAttr(slots)}" placeholder="4, 2, 1 — круги 1–3; одно число = энергия (воин)"
              onchange="Editor.updateProgressionSlots('${this.escapeAttr(classId)}',${level},this.value)">
            <div class="hint">Маг: [4,2] на 3 ур. · Воин: [3] = ярость</div></div>
          <div class="progression-choice-list">${chosen}</div>${selectHtml}</div>`);
      }
      return `<div class="class-section"><h4>Прогрессия класса — ${this.escapeHtml(cls.name || classId)}</h4>${levels.join('')}</div>`;
    };
  }

  Editor.updateProgressionSlots = function (classId, level, value) {
    const cls = this.data?.classes?.[classId];
    if (!cls) return;
    if (!cls.progression) cls.progression = { levels: {} };
    if (!cls.progression.levels) cls.progression.levels = {};
    const key = String(level);
    if (!cls.progression.levels[key]) cls.progression.levels[key] = { choices: [] };
    const parts = value.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !Number.isNaN(n) && n >= 0);
    if (parts.length) cls.progression.levels[key].slots = parts;
    else delete cls.progression.levels[key].slots;
    this.renderProgression();
    this.updateJSONPreview();
  };
})();
