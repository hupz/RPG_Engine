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
    wild_shape: 'Дикий облик (друид)',
    transformation: 'Превращение',
    custom: 'Особый'
  };

  const STATUS_EFFECT_IDS = ['poison', 'bleed', 'regen', 'weakened', 'fortified', 'stun'];

  const ABILITY_ACTION_TYPES = {
    action: 'Действие (Action)',
    bonus_action: 'Бонусное (Bonus Action)',
    reaction: 'Реакция (Reaction)',
    passive: 'Пассивное',
    free: 'Свободное'
  };

  const ABILITY_TRIGGER_OPTIONS = {
    '': '— нет —',
    after_player_hit: 'После попадания игрока',
    after_enemy_hit: 'После попадания врага',
    when_attacked: 'Когда атакуют',
    on_damage: 'При получении урона'
  };

  Object.assign(Editor, {
    ABILITY_EFFECT_TYPES,
    STATUS_EFFECT_IDS,
    ABILITY_ACTION_TYPES,
    ABILITY_TRIGGER_OPTIONS,

    COMBAT_RANGE_OPTIONS: {
      '': '— авто (tags / spellLevel) —',
      melee: 'Melee — одна зона',
      touch: 'Touch — одна зона',
      cone: 'Cone — одна зона',
      ranged: 'Ranged — любая зона',
      spell: 'Spell — любая зона'
    },

    COMBAT_ZONE_REACH_OPTIONS: {
      '': '— устарело, используйте range —',
      same_zone: 'Legacy: same_zone',
      any_zone: 'Legacy: any_zone'
    },

    renderCombatRangeField(ab, handlers) {
      const h = handlers || {};
      const cur =
        typeof ab.range === 'string' &&
        Object.keys(this.COMBAT_RANGE_OPTIONS).includes(ab.range)
          ? ab.range
          : '';
      const opts = Object.entries(this.COMBAT_RANGE_OPTIONS)
        .map(([v, l]) =>
          `<option value="${v}" ${cur === v ? 'selected' : ''}>${this.escapeHtml(l)}</option>`
        )
        .join('');
      return `<div class="form-group"><label>Дальность (range)</label>
        <select onchange="${h.range || ''}">${opts}</select>
        <div class="hint">Far / Mid / Close: melee, touch, cone — своя зона; ranged, spell — любая. Помеха ranged/spell в одной зоне с врагом — meta.combatZones.sameZonePenalty</div></div>`;
    },

    renderCombatZoneReachField(ab, handlers) {
      return this.renderCombatRangeField(ab, handlers);
    },

    /** Поля actionType / trigger в редакторе умений */
    renderAbilityActionTypeFields(ab, handlers) {
      const h = handlers || {};
      const at = ab.actionType || 'action';
      const tr = ab.trigger || '';
      const typeOpts = Object.entries(ABILITY_ACTION_TYPES).map(([v, l]) =>
        `<option value="${v}" ${at === v ? 'selected' : ''}>${this.escapeHtml(l)}</option>`
      ).join('');
      const trigOpts = Object.entries(ABILITY_TRIGGER_OPTIONS).map(([v, l]) =>
        `<option value="${v}" ${tr === v ? 'selected' : ''}>${this.escapeHtml(l)}</option>`
      ).join('');
      const triggerBlock = at === 'reaction'
        ? `<div class="form-group"><label>Триггер</label><select onchange="${h.trigger || ''}">${trigOpts}</select></div>`
        : '';
      return `<div class="grid-2"><div class="form-group"><label>Тип действия</label><select onchange="${h.actionType || ''}">${typeOpts}</select></div>${triggerBlock}</div>`;
    },

    updateClassAbilityMeta(classId, idx, field, value) {
      const ab = this.data?.classes?.[classId]?.abilities?.[idx];
      if (!ab) return;
      if (field === 'trigger') {
        if (value) ab.trigger = value;
        else delete ab.trigger;
      } else if (field === 'combatZoneReach') {
        if (value) ab.combatZoneReach = value;
        else delete ab.combatZoneReach;
      } else if (field === 'range') {
        if (value) ab.range = value;
        else delete ab.range;
      } else {
        ab[field] = value;
        if (field === 'actionType' && value === 'passive') ab.type = 'passive';
      }
      this.renderClasses();
      this.updateJSONPreview();
    },

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
      } else if (type === 'wild_shape') {
        effect.targeting = effect.targeting || { scope: 'self' };
      } else if (type === 'transformation') {
        effect.mode = effect.mode || 'self';
        effect.formSource = effect.formSource || 'beast';
        effect.forms = effect.forms || { pool: 'beast', filter: { maxCr: 1 } };
        effect.statOverride = effect.statOverride || { physical: true, mental: false };
        effect.duration = effect.duration || { type: 'minutes_per_level', value: 10, concentration: false };
        effect.restrictions = effect.restrictions || {
          cannot_cast: true,
          cannot_use_equipment: true,
          gear_merges: true
        };
        effect.targeting = effect.targeting || { scope: 'self' };
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

    _getTransformEditEffect() {
      if (this._transformEditScope === 'class') {
        return this.data?.classes?.[this._transformEditClassId]?.abilities?.[this._transformEditIdx]?.effect;
      }
      return this.data?.progression?.abilities?.[this._transformEditId]?.effect;
    },

    updateTransformEffectField(field, value) {
      const eff = this._getTransformEditEffect();
      if (!eff) return;
      if (field === 'formsJson') {
        try { eff.forms = JSON.parse(value); } catch (e) { alert('Невалидный JSON форм'); return; }
      } else if (field === 'modsJson') {
        try { eff.modifiers = JSON.parse(value); } catch (e) { alert('Невалидный JSON модификаторов'); return; }
      } else if (field === 'mode' || field === 'formSource') {
        eff[field] = value;
        if (field === 'formSource') {
          if (!eff.forms) eff.forms = {};
          eff.forms.pool = value;
        }
      } else if (field === 'durType') {
        if (!eff.duration) eff.duration = {};
        eff.duration.type = value;
      } else if (field === 'durVal') {
        if (!eff.duration) eff.duration = {};
        eff.duration.value = parseInt(value, 10) || 1;
      } else if (field === 'durConc') {
        if (!eff.duration) eff.duration = {};
        eff.duration.concentration = !!value;
      } else if (field === 'visual') {
        eff.visual = value;
      }
      this.updateJSONPreview();
      if (this._transformEditScope === 'class') this.renderClasses();
      else this.renderAbilities();
    },

    renderDiceFormulaField(current, onchangeAttr, label) {
      const cur = current || '1d6';
      const presets = (this.DICE_PRESETS || ['1d4','1d6','1d8','1d10','1d12','2d6','2d8','3d6','4d6']);
      const opts = presets.map((d) =>
        `<option value="${d}" ${d === cur ? 'selected' : ''}>${d}</option>`
      ).join('');
      const isCustom = cur && !presets.includes(cur);
      return `<div class="form-group"><label>${this.escapeHtml(label || 'Кубики')}</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <select onchange="if(this.value==='__custom__'){const v=prompt('Своя формула (например 2d6+3):','${this.escapeAttr(cur)}');if(v!=null){const el=this.nextElementSibling;if(el){el.value=v;el.dispatchEvent(new Event('change'));}}this.value='${this.escapeAttr(presets.includes(cur)?cur:presets[0])}';}else{const el=this.nextElementSibling;if(el){el.value=this.value;el.dispatchEvent(new Event('change'));}}">
            ${opts}
            <option value="__custom__">Своё…</option>
          </select>
          <input type="text" value="${this.escapeHtml(cur)}" placeholder="1d8+2" style="max-width:120px"
            onchange="${onchangeAttr}">
        </div>
        <p class="hint">Выберите кости или введите формулу вручную.</p>
      </div>`;
    },

    renderEffectTypeExtraFields(effect, handlers) {
      const t = effect?.type;
      const h = handlers || {};
      if (t === 'smite') {
        return this.renderDiceFormulaField(effect.value || '2d8', h.value || '', 'Кубики кары');
      }
      if (t === 'heal') {
        return this.renderDiceFormulaField(effect.value || '1d8', h.value || '', 'Лечение (кубики)');
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
      if (t === 'transformation') {
        const formsJson = JSON.stringify(effect.forms || { pool: 'beast' }, null, 2);
        const modsJson = JSON.stringify(effect.modifiers || [], null, 2);
        const durType = effect.duration?.type || 'minutes_per_level';
        const durVal = effect.duration?.value ?? 10;
        const durConc = effect.duration?.concentration ? 'checked' : '';
        const tf = `Editor.updateTransformEffectField`;
        return `<div class="grid-2">
          <div class="form-group"><label>Режим</label>
            <select onchange="${tf}('mode', this.value)">
              <option value="self" ${effect.mode === 'self' ? 'selected' : ''}>На себя</option>
              <option value="target" ${effect.mode === 'target' ? 'selected' : ''}>На цель</option>
            </select></div>
          <div class="form-group"><label>Пул форм</label>
            <select onchange="${tf}('formSource', this.value)">
              <option value="beast" ${(effect.formSource || effect.forms?.pool) === 'beast' ? 'selected' : ''}>Звери</option>
              <option value="elemental" ${(effect.formSource || effect.forms?.pool) === 'elemental' ? 'selected' : ''}>Элементали</option>
              <option value="custom" ${(effect.formSource || effect.forms?.pool) === 'custom' ? 'selected' : ''}>Кастомные</option>
            </select></div>
        </div>
        <div class="form-group"><label>Формы (JSON)</label>
          <textarea rows="6" onchange="${tf}('formsJson', this.value)">${this.escapeTextarea(formsJson)}</textarea></div>
        <div class="form-group"><label>Модификаторы (JSON)</label>
          <textarea rows="4" onchange="${tf}('modsJson', this.value)">${this.escapeTextarea(modsJson)}</textarea></div>
        <div class="grid-2">
          <div class="form-group"><label>Длительность: тип</label>
            <select onchange="${tf}('durType', this.value)">
              <option value="rounds" ${durType === 'rounds' ? 'selected' : ''}>Раунды</option>
              <option value="minutes" ${durType === 'minutes' ? 'selected' : ''}>Минуты</option>
              <option value="minutes_per_level" ${durType === 'minutes_per_level' ? 'selected' : ''}>Мин./ур.</option>
              <option value="hours" ${durType === 'hours' ? 'selected' : ''}>Часы</option>
              <option value="hours_per_level" ${durType === 'hours_per_level' ? 'selected' : ''}>Ч./ур.</option>
              <option value="concentration" ${durType === 'concentration' ? 'selected' : ''}>Концентрация</option>
            </select></div>
          <div class="form-group"><label>Значение</label>
            <input type="number" min="1" value="${durVal}" onchange="${tf}('durVal', this.value)"></div>
        </div>
        <label><input type="checkbox" ${durConc} onchange="${tf}('durConc', this.checked)"> Требует концентрации</label>
        <div class="form-group"><label>Визуальное описание</label>
          <textarea rows="2" onchange="${tf}('visual', this.value)">${this.escapeTextarea(effect.visual || '')}</textarea></div>`;
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


  function enhanceGlobalAbilityHtml(html, id, ab, idx) {
    if (typeof html !== 'string' || !ab) return html;
    Editor._transformEditScope = 'global';
    Editor._transformEditId = id;
    const sl = ab.spellLevel != null ? ab.spellLevel : 0;
    const spellBlock = typeof Editor.renderSpellLevelSelect === 'function'
      ? `<div class="form-group"><label>Уровень заклинания</label>${Editor.renderSpellLevelSelect(sl, `Editor.updateGlobalAbility('${Editor.escapeAttr(id)}','spellLevel',parseInt(this.value,10)||0)`)}</div>`
      : '';
    const actionBlock = typeof Editor.renderAbilityActionTypeFields === 'function'
      ? Editor.renderAbilityActionTypeFields(ab, {
          actionType: `Editor.updateGlobalAbility('${Editor.escapeAttr(id)}','actionType',this.value); Editor.renderAbilities();`,
          trigger: `Editor.updateGlobalAbility('${Editor.escapeAttr(id)}','trigger',this.value||''); Editor.renderAbilities();`
        })
      : '';
    const zoneBlock = typeof Editor.renderCombatZoneReachField === 'function'
      ? Editor.renderCombatZoneReachField(ab, {
          range: `Editor.updateGlobalAbility('${Editor.escapeAttr(id)}','range',this.value||''); Editor.renderAbilities();`
        })
      : '';
    const needle = '<div class="form-group"><label>Тип эффекта</label>';
    if (html.includes(needle)) {
      html = html.replace(needle, spellBlock + actionBlock + zoneBlock + needle);
    }
    return html;
  }

  if (Editor.hooks?.after) {
    Editor.hooks.after('renderGlobalAbilityEditor', function (html, args) {
      const id = args && args[0];
      const ab = args && args[1];
      const idx = args && args[2];
      return enhanceGlobalAbilityHtml(html, id, ab, idx);
    });
    Editor.hooks.after('renderClassDetail', function (html, args) {
      const id = args && args[0];
      const cls = Editor.data?.classes?.[id];
      if (!cls?.abilities?.length || typeof html !== 'string') return html;
      // доп. поля action type уже могут быть в renderAbilityEditor
      return html;
    });
  } else if (typeof Editor.renderGlobalAbilityEditor === 'function') {
    const orig = Editor.renderGlobalAbilityEditor.bind(Editor);
    Editor.renderGlobalAbilityEditor = function (id, ab, idx) {
      return enhanceGlobalAbilityHtml(orig(id, ab, idx), id, ab, idx);
    };
  }

  // updateProgressionSlots — определение, не обёртка
  if (typeof Editor.updateProgressionSlots !== 'function') {
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
      this.renderProgression?.();
      this.updateJSONPreview?.();
    };
  }
})();
