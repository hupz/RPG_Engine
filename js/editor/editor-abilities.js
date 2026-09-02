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

  /** Типы урона / эффекта для автора (русские подписи) */
  const ABILITY_DAMAGE_TYPES = {
    physical: { label: 'Физический', effectType: 'damage', icon: '⚔️' },
    magical: { label: 'Магический', effectType: 'damage', icon: '✨', aliases: ['force', 'radiant', 'arcane'] },
    electric: { label: 'Электрический', effectType: 'damage', icon: '⚡', aliases: ['lightning', 'thunder'] },
    fire: { label: 'Огненный', effectType: 'damage', icon: '🔥' },
    darkness: { label: 'Тьма', effectType: 'damage', icon: '🌑', aliases: ['necrotic', 'dark', 'shadow'] },
    heal: { label: 'Лечение', effectType: 'heal', icon: '💚' },
    curse: { label: 'Проклятие', effectType: 'damage', icon: '💀', aliases: ['necrotic_curse'] },
    enhancement: { label: 'Усиление', effectType: 'buff', icon: '💪', buffType: 'ac' },
    help: { label: 'Помощь', effectType: 'buff', icon: '🤝', buffType: 'help' }
  };

  const DICE_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const DICE_SIDE_OPTIONS = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];

  function parseDiceFormula(value) {
    const s = String(value || '1d6').trim();
    const m = s.match(/^(\d+)\s*d\s*(\d+)(?:\s*([+-])\s*(\d+))?$/i);
    if (m) {
      const bonusSign = m[3];
      const bonusVal = m[4] ? parseInt(m[4], 10) : 0;
      return {
        count: parseInt(m[1], 10) || 1,
        die: 'd' + m[2],
        bonus: bonusSign === '-' ? -bonusVal : bonusVal
      };
    }
    return { count: 1, die: 'd6', bonus: 0, custom: s };
  }

  function buildDiceFormula(count, die, bonus) {
    const c = Math.max(1, parseInt(count, 10) || 1);
    const sides = String(die || 'd6').replace(/^d/i, '') || '6';
    let f = c + 'd' + sides;
    const b = parseInt(bonus, 10) || 0;
    if (b > 0) f += '+' + b;
    else if (b < 0) f += String(b);
    return f;
  }

  function resolveEditorDamageTypeKey(effect) {
    if (!effect || typeof effect !== 'object') return 'physical';
    if (effect.type === 'heal') return 'heal';
    if (effect.type === 'buff') {
      if (effect.buffType === 'help' || effect.damageType === 'help') return 'help';
      return 'enhancement';
    }
    const dt = String(effect.damageType || 'physical').toLowerCase();
    for (const [key, meta] of Object.entries(ABILITY_DAMAGE_TYPES)) {
      if (key === dt) return key;
      if (meta.aliases && meta.aliases.includes(dt)) return key;
    }
    return dt in ABILITY_DAMAGE_TYPES ? dt : 'physical';
  }

  function applyEditorDamageTypeToEffect(effect, typeKey) {
    if (!effect) return;
    const meta = ABILITY_DAMAGE_TYPES[typeKey] || ABILITY_DAMAGE_TYPES.physical;
    effect.type = meta.effectType;
    if (meta.effectType === 'damage') {
      effect.damageType = typeKey;
      if (effect.value == null) effect.value = '1d6';
      delete effect.buffType;
    } else if (meta.effectType === 'heal') {
      effect.damageType = 'heal';
      if (effect.value == null) effect.value = '1d8';
      if (!effect.targeting) effect.targeting = { scope: 'self' };
      delete effect.buffType;
    } else if (meta.effectType === 'buff') {
      effect.buffType = meta.buffType || 'ac';
      effect.damageType = typeKey;
      if (effect.value == null) effect.value = 2;
      if (!effect.targeting) effect.targeting = { scope: typeKey === 'help' ? 'ally' : 'self' };
    }
  }

  Object.assign(Editor, {
    ABILITY_EFFECT_TYPES,
    ABILITY_DAMAGE_TYPES,
    DICE_COUNT_OPTIONS,
    DICE_SIDE_OPTIONS,
    STATUS_EFFECT_IDS,
    ABILITY_ACTION_TYPES,
    ABILITY_TRIGGER_OPTIONS,
    parseDiceFormula,
    buildDiceFormula,
    resolveEditorDamageTypeKey,
    applyEditorDamageTypeToEffect,

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
        effect.value = effect.value || '1d6';
        effect.damageType = effect.damageType || 'physical';
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
        try { eff.forms = JSON.parse(value); } catch (e) { Editor.toast.warning('Невалидный JSON форм'); return; }
      } else if (field === 'modsJson') {
        try { eff.modifiers = JSON.parse(value); } catch (e) { Editor.toast.warning('Невалидный JSON модификаторов'); return; }
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
      return this.renderAbilityDicePicker(null, { value: current }, {
        value: onchangeAttr,
        label: label || 'Кубики'
      });
    },

    /** Выбор кубиков: количество + тип dX + бонус */
    renderAbilityDicePicker(abilityId, effect, opts) {
      const o = opts || {};
      const parsed = parseDiceFormula(effect?.value);
      const count = parsed.count;
      const die = parsed.die;
      const bonus = parsed.bonus;
      const label = o.label || 'Урон / сила (кубики)';
      const aid = abilityId != null ? this.escapeAttr(String(abilityId)) : '';
      const onCount = aid
        ? `Editor.updateGlobalAbilityDice('${aid}','count',this.value)`
        : (o.count || '');
      const onDie = aid
        ? `Editor.updateGlobalAbilityDice('${aid}','die',this.value)`
        : (o.die || '');
      const onBonus = aid
        ? `Editor.updateGlobalAbilityDice('${aid}','bonus',this.value)`
        : (o.bonus || '');
      const onValue = o.value || '';
      const countOpts = DICE_COUNT_OPTIONS.map((n) =>
        `<option value="${n}" ${n === count ? 'selected' : ''}>${n}</option>`
      ).join('');
      const dieOpts = DICE_SIDE_OPTIONS.map((d) =>
        `<option value="${d}" ${d === die ? 'selected' : ''}>${d.toUpperCase()}</option>`
      ).join('');
      const formula = buildDiceFormula(count, die, bonus);
      const customHint = parsed.custom
        ? `<p class="hint">Текущая формула в данных: <code>${this.escapeHtml(parsed.custom)}</code></p>`
        : '';
      return `<div class="form-group ability-dice-picker">
        <label>${this.escapeHtml(label)}</label>
        <div class="grid-3" style="align-items:end;">
          <div class="form-group" style="margin:0;">
            <label class="hint">Сколько кубиков</label>
            <select onchange="${onCount}">${countOpts}</select>
          </div>
          <div class="form-group" style="margin:0;">
            <label class="hint">Тип кубика</label>
            <select onchange="${onDie}">${dieOpts}</select>
          </div>
          <div class="form-group" style="margin:0;">
            <label class="hint">Бонус (+/−)</label>
            <input type="number" value="${bonus}" step="1"
              onchange="${onBonus}">
          </div>
        </div>
        <p class="hint" style="margin-top:6px;">Итого: <strong>${this.escapeHtml(formula)}</strong></p>
        ${customHint}
        ${onValue ? `<input type="hidden" value="${this.escapeAttr(formula)}" data-dice-formula="${this.escapeAttr(formula)}" onchange="${onValue}">` : ''}
      </div>`;
    },

    renderAbilityDamageTypeSelect(abilityId, effect) {
      const cur = resolveEditorDamageTypeKey(effect);
      const aid = this.escapeAttr(String(abilityId));
      const opts = Object.entries(ABILITY_DAMAGE_TYPES).map(([key, meta]) =>
        `<option value="${key}" ${cur === key ? 'selected' : ''}>${meta.icon} ${this.escapeHtml(meta.label)}</option>`
      ).join('');
      return `<div class="form-group"><label>Тип урона / эффекта</label>
        <select onchange="Editor.updateGlobalAbilityDamageType('${aid}',this.value)">${opts}</select>
        <p class="hint">Физический, магический, огонь… или лечение / усиление / помощь.</p>
      </div>`;
    },

    renderAbilityBuffValueField(abilityId, effect) {
      const aid = this.escapeAttr(String(abilityId));
      const isHelp = resolveEditorDamageTypeKey(effect) === 'help';
      const buffOpts = isHelp
        ? `<option value="help" selected>Помощь союзнику</option>`
        : `<option value="ac" ${effect.buffType === 'ac' ? 'selected' : ''}>Класс доспеха (КД)</option>
           <option value="atk" ${effect.buffType === 'atk' ? 'selected' : ''}>Атака</option>
           <option value="dmg" ${effect.buffType === 'dmg' ? 'selected' : ''}>Урон</option>`;
      return `<div class="grid-2">
        <div class="form-group"><label>Что усиливает</label>
          <select onchange="Editor.updateGlobalAbilityBuffType('${aid}',this.value)">${buffOpts}</select>
        </div>
        <div class="form-group"><label>Величина</label>
          <input type="number" value="${effect.value ?? 2}" step="1"
            onchange="Editor.updateGlobalAbilityEffectValue('${aid}',this.value)">
        </div>
      </div>`;
    },

    renderGlobalAbilityEffectBlock(abilityId, ab) {
      if (!ab) return '';
      let effect = ab.effect && typeof ab.effect === 'object' ? ab.effect : { type: 'damage', value: '1d6', damageType: 'physical' };
      if (typeof ProjectDataSchema !== 'undefined' && typeof ab.effect === 'string') {
        ab.effect = ProjectDataSchema.normalizeAbilityEffect(ab.effect);
        effect = ab.effect;
      }
      const typeKey = resolveEditorDamageTypeKey(effect);
      const meta = ABILITY_DAMAGE_TYPES[typeKey] || ABILITY_DAMAGE_TYPES.physical;
      const aid = this.escapeAttr(String(abilityId));

      let body = this.renderAbilityDamageTypeSelect(abilityId, effect);

      if (meta.effectType === 'buff') {
        body += this.renderAbilityBuffValueField(abilityId, effect);
      } else {
        body += this.renderAbilityDicePicker(abilityId, effect, {
          label: meta.effectType === 'heal' ? 'Лечение (кубики)' : 'Урон (кубики)'
        });
      }

      const scope = effect.targeting?.scope || (meta.effectType === 'heal' ? 'self' : 'single');
      const scopeOpts = {
        single: 'Одна цель',
        all_enemies: 'Все враги',
        ally: 'Союзник',
        self: 'На себя',
        area: 'Область'
      };
      const scopeHtml = Object.entries(scopeOpts).map(([v, l]) =>
        `<option value="${v}" ${scope === v ? 'selected' : ''}>${l}</option>`
      ).join('');
      body += `<div class="form-group"><label>Область</label>
        <select onchange="Editor.updateGlobalAbilityTargeting('${aid}','scope',this.value)">${scopeHtml}</select>
      </div>`;

      return body;
    },

    updateGlobalAbilityDamageType(id, typeKey) {
      const ab = this.data?.progression?.abilities?.[id];
      if (!ab) return;
      if (!ab.effect || typeof ab.effect !== 'object') ab.effect = {};
      applyEditorDamageTypeToEffect(ab.effect, typeKey);
      this.updateJSONPreview?.();
      this.renderAbilities?.();
    },

    updateGlobalAbilityDice(id, part, value) {
      const ab = this.data?.progression?.abilities?.[id];
      if (!ab) return;
      if (!ab.effect || typeof ab.effect !== 'object') ab.effect = { type: 'damage', value: '1d6' };
      const parsed = parseDiceFormula(ab.effect.value);
      if (part === 'count') parsed.count = Math.max(1, parseInt(value, 10) || 1);
      else if (part === 'die') parsed.die = value || 'd6';
      else if (part === 'bonus') parsed.bonus = parseInt(value, 10) || 0;
      ab.effect.value = buildDiceFormula(parsed.count, parsed.die, parsed.bonus);
      this.updateJSONPreview?.();
      this.renderAbilities?.();
    },

    updateGlobalAbilityBuffType(id, buffType) {
      const ab = this.data?.progression?.abilities?.[id];
      if (!ab?.effect) return;
      ab.effect.buffType = buffType;
      if (buffType === 'help') {
        ab.effect.damageType = 'help';
        if (!ab.effect.targeting) ab.effect.targeting = { scope: 'ally' };
      }
      this.updateJSONPreview?.();
      this.renderAbilities?.();
    },

    updateGlobalAbilityTargeting(id, field, value) {
      const ab = this.data?.progression?.abilities?.[id];
      if (!ab) return;
      if (!ab.effect || typeof ab.effect !== 'object') ab.effect = {};
      if (!ab.effect.targeting) ab.effect.targeting = {};
      ab.effect.targeting[field] = value;
      this.updateJSONPreview?.();
    },

    renderRichGlobalAbilityEditor(id, ab, idx) {
      if (!ab) return '';
      const aid = this.escapeAttr(id);
      const sl = ab.spellLevel != null ? ab.spellLevel : 0;
      const spellBlock = typeof this.renderSpellLevelSelect === 'function'
        ? `<div class="form-group"><label>Уровень заклинания</label>${this.renderSpellLevelSelect(sl, `Editor.updateGlobalAbility('${aid}','spellLevel',parseInt(this.value,10)||0)`)}</div>`
        : '';
      const actionBlock = typeof this.renderAbilityActionTypeFields === 'function'
        ? this.renderAbilityActionTypeFields(ab, {
            actionType: `Editor.updateGlobalAbility('${aid}','actionType',this.value); Editor.renderAbilities();`,
            trigger: `Editor.updateGlobalAbility('${aid}','trigger',this.value||''); Editor.renderAbilities();`
          })
        : '';
      const zoneBlock = typeof this.renderCombatZoneReachField === 'function'
        ? this.renderCombatZoneReachField(ab, {
            range: `Editor.updateGlobalAbility('${aid}','range',this.value||''); Editor.renderAbilities();`
          })
        : '';
      const usageOpts = { combat: 'Только бой', exploration: 'Исследование', both: 'Любое' };
      const usage = ab.usage || (ab.combatOnly ? 'combat' : 'both');
      const usageHtml = Object.entries(usageOpts).map(([v, l]) =>
        `<option value="${v}" ${usage === v ? 'selected' : ''}>${l}</option>`
      ).join('');

      return `<div class="quest-detail-card" data-global-ability="${aid}">
        <div class="form-group"><label>ID</label><input value="${aid}" disabled></div>
        <div class="form-group"><label>Название</label>
          <input value="${this.escapeAttr(ab.name || '')}" onchange="Editor.updateGlobalAbility('${aid}','name',this.value)"></div>
        <div class="form-group"><label>Иконка</label>
          <div class="icon-picker-row">
            ${typeof this.renderIconEmojiSelect === 'function'
              ? this.renderIconEmojiSelect(`if(this.value){Editor.updateGlobalAbility('${aid}','icon',this.value);}`)
              : ''}
            <input value="${this.escapeAttr(ab.icon || '✨')}" onchange="Editor.updateGlobalAbility('${aid}','icon',this.value)">
            ${typeof this.renderIconPreview === 'function' ? this.renderIconPreview(ab.icon) : ''}
          </div>
        </div>
        <div class="form-group"><label>Описание</label>
          <textarea rows="3" onchange="Editor.updateGlobalAbility('${aid}','desc',this.value)">${this.escapeHtml(ab.desc || '')}</textarea></div>
        <div class="grid-2">
          <div class="form-group"><label>Стоимость ресурса</label>
            <input type="number" min="0" value="${ab.cost ?? 1}" onchange="Editor.updateGlobalAbility('${aid}','cost',parseInt(this.value,10)||0)"></div>
          <div class="form-group"><label>Применение</label>
            <select onchange="Editor.updateGlobalAbility('${aid}','usage',this.value)">${usageHtml}</select>
          </div>
        </div>
        ${spellBlock}${actionBlock}${zoneBlock}
        <div class="class-section" style="margin-top:12px;">
          <h4>⚡ Эффект</h4>
          ${this.renderGlobalAbilityEffectBlock(id, ab)}
        </div>
        <button type="button" class="btn btn-danger" style="margin-top:12px;" onclick="${this.escapeAttr('Editor.deleteGlobalAbility(' + JSON.stringify(id) + ')')}">Удалить умение</button>
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
        return this.renderAbilityDicePicker(null, effect, {
          label: 'Урон (кубики)',
          count: h.count || '',
          die: h.die || '',
          bonus: h.bonus || '',
          value: h.value || ''
        }) + this.renderAddEffectFields(effect, h, true);
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
    // Rich editor уже включает все поля — пропускаем legacy-вставку
    if (typeof Editor.renderRichGlobalAbilityEditor === 'function') return html;
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
  } else if (typeof Editor.renderGlobalAbilityEditor === 'function' && Editor.hooks?.replace) {
    let savedPrev;
    savedPrev = Editor.hooks.replace('renderGlobalAbilityEditor', function (id, ab, idx) {
      return enhanceGlobalAbilityHtml(savedPrev(id, ab, idx), id, ab, idx);
    }, 'editor-abilities');
  }

  function renderGlobalAbilityEditorRich(id, ab, idx) {
    if (typeof Editor.renderRichGlobalAbilityEditor === 'function') {
      return Editor.renderRichGlobalAbilityEditor(id, ab, idx);
    }
    return '';
  }
  if (Editor.hooks?.replace) {
    Editor.hooks.replace('renderGlobalAbilityEditor', renderGlobalAbilityEditorRich, 'editor-abilities');
  } else if (typeof Editor.renderGlobalAbilityEditor !== 'function') {
    Editor.renderGlobalAbilityEditor = renderGlobalAbilityEditorRich;
  }

  const _origUpdateGlobalEffectType = Editor.updateGlobalAbilityEffectType?.bind(Editor);
  Editor.updateGlobalAbilityEffectType = function (id, type) {
    const ab = this.data?.progression?.abilities?.[id];
    if (!ab) return;
    if (!ab.effect || typeof ab.effect !== 'object') ab.effect = {};
    if (typeof this.applyAbilityEffectDefaults === 'function') {
      this.applyAbilityEffectDefaults(ab.effect, type);
    } else {
      ab.effect.type = type;
    }
    this.updateJSONPreview?.();
    this.renderAbilities?.();
  };

  const _origUpdateGlobalEffectValue = Editor.updateGlobalAbilityEffectValue?.bind(Editor);
  Editor.updateGlobalAbilityEffectValue = function (id, value) {
    const ab = this.data?.progression?.abilities?.[id];
    if (!ab) return;
    if (!ab.effect || typeof ab.effect !== 'object') ab.effect = { type: 'damage' };
    const num = parseFloat(value);
    ab.effect.value = Number.isFinite(num) && String(value).trim() !== '' && !/\d+d/i.test(String(value))
      ? num
      : value;
    this.updateJSONPreview?.();
    this.renderAbilities?.();
  };

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

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-abilities-rich', {
      renderGlobalAbilityEditor: Editor.renderGlobalAbilityEditor,
      updateGlobalAbilityDamageType: Editor.updateGlobalAbilityDamageType,
      updateGlobalAbilityDice: Editor.updateGlobalAbilityDice
    }, { force: true });
  }
})();
