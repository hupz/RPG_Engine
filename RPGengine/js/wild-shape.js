// ============================================
// Дикий облик друида — звери и превращение
// ============================================

(function () {
  const WILD_SHAPE_UNLOCK_LEVEL = 2;
  const KNOWN_FORMS_AT_START = 2;

  const CR_OPTIONS = [
    { value: 0, label: '0' },
    { value: 0.125, label: '1/8' },
    { value: 0.25, label: '1/4' },
    { value: 0.5, label: '1/2' },
    { value: 1, label: '1' },
    { value: 2, label: '2' },
    { value: 3, label: '3' }
  ];

  const DEFAULT_BEASTS = {
    wolf: {
      id: 'wolf',
      name: 'Волк',
      icon: '🐺',
      cr: 0.25,
      hp: 11,
      ac: 13,
      atkBonus: 4,
      dmgRoll: '2d4+2',
      speed: 40,
      stats: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
      abilities: ['pack_tactics'],
      availableForWildShape: true,
      minDruidLevel: 2
    },
    panther: {
      id: 'panther',
      name: 'Пантера',
      icon: '🐆',
      cr: 0.25,
      hp: 13,
      ac: 12,
      atkBonus: 4,
      dmgRoll: '1d6+2',
      speed: 50,
      stats: { str: 14, dex: 15, con: 10, int: 3, wis: 12, cha: 7 },
      abilities: ['keen_smell', 'climb'],
      availableForWildShape: true,
      minDruidLevel: 2
    },
    eagle: {
      id: 'eagle',
      name: 'Орёл',
      icon: '🦅',
      cr: 0.25,
      hp: 13,
      ac: 12,
      atkBonus: 4,
      dmgRoll: '1d4+2',
      speed: 10,
      fly: 60,
      stats: { str: 6, dex: 15, con: 10, int: 2, wis: 14, cha: 7 },
      abilities: ['keen_sight', 'fly'],
      availableForWildShape: true,
      minDruidLevel: 2
    },
    lizard: {
      id: 'lizard',
      name: 'Ящерица',
      icon: '🦎',
      cr: 0,
      hp: 2,
      ac: 10,
      atkBonus: 0,
      dmgRoll: '1',
      speed: 20,
      stats: { str: 2, dex: 11, con: 10, int: 1, wis: 8, cha: 3 },
      abilities: ['climb'],
      availableForWildShape: true,
      minDruidLevel: 2
    },
    bear: {
      id: 'bear',
      name: 'Медведь',
      icon: '🐻',
      cr: 1,
      hp: 34,
      ac: 11,
      atkBonus: 5,
      dmgRoll: '1d8+4',
      speed: 40,
      stats: { str: 15, dex: 10, con: 14, int: 2, wis: 12, cha: 7 },
      abilities: [],
      availableForWildShape: true,
      minDruidLevel: 5
    }
  };

  const ABILITY_PRESETS = {
    pack_tactics: 'Тактика стаи (преимущество, если союзник рядом)',
    keen_smell: 'Нюх (выслеживание)',
    keen_hearing: 'Острое слуховое восприятие',
    keen_sight: 'Острое зрение',
    darkvision: 'Ночное зрение',
    swim: 'Плавание',
    climb: 'Лазание',
    fly: 'Полёт'
  };

  const BeastSystem = {
    CR_OPTIONS,
    ABILITY_PRESETS,
    DEFAULT_BEASTS,
    WILD_SHAPE_UNLOCK_LEVEL,
    KNOWN_FORMS_AT_START,

    ensureBeasts(data) {
      if (!data) return {};
      if (!data.beasts || typeof data.beasts !== 'object') {
        data.beasts = JSON.parse(JSON.stringify(DEFAULT_BEASTS));
      }
      if (!data.beastsMeta || typeof data.beastsMeta !== 'object') {
        data.beastsMeta = {};
      }
      const removed = new Set(
        Array.isArray(data.beastsMeta.removedDefaults) ? data.beastsMeta.removedDefaults : []
      );
      Object.keys(DEFAULT_BEASTS).forEach((id) => {
        if (!data.beasts[id] && !removed.has(id)) {
          data.beasts[id] = JSON.parse(JSON.stringify(DEFAULT_BEASTS[id]));
        }
      });
      return data.beasts;
    },

    /** Удалить зверя; встроенные формы не восстанавливаются при ensureBeasts. */
    removeBeast(data, id) {
      if (!data?.beasts || !id || !data.beasts[id]) return false;
      delete data.beasts[id];
      if (DEFAULT_BEASTS[id]) {
        if (!data.beastsMeta || typeof data.beastsMeta !== 'object') {
          data.beastsMeta = {};
        }
        if (!Array.isArray(data.beastsMeta.removedDefaults)) {
          data.beastsMeta.removedDefaults = [];
        }
        if (!data.beastsMeta.removedDefaults.includes(id)) {
          data.beastsMeta.removedDefaults.push(id);
        }
      }
      return true;
    },

    formatCr(cr) {
      const n = Number(cr);
      const hit = CR_OPTIONS.find((o) => Math.abs(o.value - n) < 0.001);
      return hit ? hit.label : String(cr);
    },

    parseCrInput(val) {
      const s = String(val ?? '').trim();
      if (s === '1/8') return 0.125;
      if (s === '1/4') return 0.25;
      if (s === '1/2') return 0.5;
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : 0.25;
    },

    getMaxCrForDruidLevel(level) {
      const lv = Math.max(1, parseInt(level, 10) || 1);
      if (lv >= 9) return 2;
      if (lv >= 5) return 1;
      if (lv >= 4) return 0.5;
      if (lv >= 2) return 0.25;
      return 0;
    },

    getMinLevelForCr(cr) {
      const c = Number(cr) || 0;
      if (c <= 0.25) return 2;
      if (c <= 0.5) return 4;
      if (c <= 1) return 5;
      if (c <= 2) return 9;
      return 99;
    },

    splitDamageFormula(formula) {
      const m = String(formula || '').match(/^(\d+d\d+)(?:\+(-?\d+))?$/i);
      if (!m) return { dmgRoll: formula || '1', dmgBonus: 0 };
      return { dmgRoll: m[1], dmgBonus: parseInt(m[2], 10) || 0 };
    },

    getBeastIds(data) {
      this.ensureBeasts(data);
      return Object.keys(data.beasts).sort();
    },

    getBeast(data, id) {
      if (!id) return null;
      this.ensureBeasts(data);
      return data.beasts[id] || null;
    },

    filterAvailableBeasts(data, druidLevel) {
      this.ensureBeasts(data);
      const lv = Math.max(1, parseInt(druidLevel, 10) || 1);
      const maxCr = this.getMaxCrForDruidLevel(lv);
      return Object.values(data.beasts).filter((b) => {
        if (!b || b.availableForWildShape === false) return false;
        const minLv = Math.max(this.getMinLevelForCr(b.cr), parseInt(b.minDruidLevel, 10) || 2);
        if (lv < minLv) return false;
        return (Number(b.cr) || 0) <= maxCr + 0.001;
      });
    },

    groupBeastsByMinLevel(data) {
      this.ensureBeasts(data);
      const groups = {};
      Object.values(data.beasts).forEach((b) => {
        if (!b?.availableForWildShape) return;
        const lv = Math.max(this.getMinLevelForCr(b.cr), parseInt(b.minDruidLevel, 10) || 2);
        if (!groups[lv]) groups[lv] = [];
        groups[lv].push(b);
      });
      return Object.keys(groups)
        .map(Number)
        .sort((a, b) => a - b)
        .map((lv) => ({ level: lv, beasts: groups[lv].sort((a, b) => (a.name || '').localeCompare(b.name || '')) }));
    },

    defaultKnownFormIds(data, count = KNOWN_FORMS_AT_START) {
      return this.filterAvailableBeasts(data, WILD_SHAPE_UNLOCK_LEVEL)
        .slice(0, count)
        .map((b) => b.id);
    },

    FORM_POOLS: {
      beast: { label: 'Звери', icon: '🐺', source: 'beast' },
      elemental: { label: 'Элементали', icon: '🌊', source: 'elemental' },
      dragon: { label: 'Драконы', icon: '🐉', source: 'dragon' },
      aberration: { label: 'Аберрации', icon: '👁️', source: 'aberration' },
      fey: { label: 'Фейри', icon: '🧚', source: 'fey' }
    },

    DEFAULT_ELEMENTALS: {
      fire_elemental: {
        id: 'fire_elemental',
        name: 'Элементаль огня',
        icon: '🔥',
        cr: 1,
        hp: 30,
        ac: 14,
        atkBonus: 5,
        dmgRoll: '2d6+2',
        damageType: 'fire',
        speed: 40,
        fly: 0,
        stats: { str: 10, dex: 17, con: 14, int: 4, wis: 10, cha: 7 },
        abilities: ['fire_aura', 'burn'],
        availableFor: ['wizard', 'sorcerer', 'druid'],
        minLevel: 5
      },
      water_elemental: {
        id: 'water_elemental',
        name: 'Элементаль воды',
        icon: '💧',
        cr: 1,
        hp: 34,
        ac: 14,
        atkBonus: 5,
        dmgRoll: '2d8+3',
        damageType: 'bludgeoning',
        speed: 30,
        swim: 60,
        stats: { str: 16, dex: 14, con: 15, int: 5, wis: 10, cha: 8 },
        abilities: ['swim'],
        availableFor: ['wizard', 'sorcerer', 'druid'],
        minLevel: 5
      },
      air_elemental: {
        id: 'air_elemental',
        name: 'Элементаль воздуха',
        icon: '💨',
        cr: 1,
        hp: 26,
        ac: 15,
        atkBonus: 6,
        dmgRoll: '2d8+2',
        damageType: 'bludgeoning',
        speed: 0,
        fly: 90,
        stats: { str: 14, dex: 20, con: 12, int: 6, wis: 10, cha: 6 },
        abilities: ['fly'],
        availableFor: ['wizard', 'sorcerer', 'druid'],
        minLevel: 5
      },
      earth_elemental: {
        id: 'earth_elemental',
        name: 'Элементаль земли',
        icon: '🪨',
        cr: 1,
        hp: 42,
        ac: 17,
        atkBonus: 6,
        dmgRoll: '2d8+4',
        damageType: 'bludgeoning',
        speed: 20,
        stats: { str: 18, dex: 8, con: 18, int: 5, wis: 10, cha: 5 },
        abilities: [],
        availableFor: ['wizard', 'sorcerer', 'druid'],
        minLevel: 5
      }
    },

    ensureExtraPools(data) {
      if (!data) return;
      if (!data.formPools || typeof data.formPools !== 'object') {
        data.formPools = {};
      }
      if (!data.formPools.elemental) {
        data.formPools.elemental = JSON.parse(JSON.stringify(this.DEFAULT_ELEMENTALS));
      }
    },

    getPoolFormsList(data, poolId) {
      this.ensureBeasts(data);
      this.ensureExtraPools(data);
      const pid = poolId || 'beast';
      if (pid === 'beast') {
        return Object.values(data.beasts || {}).filter(Boolean);
      }
      const pool = data.formPools?.[pid];
      if (pool && typeof pool === 'object') {
        return Object.values(pool).filter(Boolean);
      }
      if (pid === 'elemental') {
        return Object.values(this.DEFAULT_ELEMENTALS);
      }
      return [];
    },

    getFormFromPool(data, poolId, formId) {
      if (!formId) return null;
      if (poolId === 'beast' || !poolId) {
        return this.getBeast(data, formId);
      }
      this.ensureExtraPools(data);
      return data.formPools?.[poolId]?.[formId]
        || this.DEFAULT_ELEMENTALS?.[formId]
        || null;
    },

    getCustomFormFromAbility(ability, formId) {
      const custom = ability?.effect?.forms?.custom;
      if (!Array.isArray(custom) || !formId) return null;
      return custom.find((f) => f.id === formId) || null;
    },

    filterFormsForAbility(forms, character, ability) {
      const filter = ability?.effect?.forms?.filter || {};
      const className = character?.className || character?.classKey || '';
      const level = Math.max(1, parseInt(character?.level, 10) || 1);
      return (forms || []).filter((form) => {
        if (!form) return false;
        if (filter.maxCr != null && (Number(form.cr) || 0) > Number(filter.maxCr) + 0.001) return false;
        if (filter.maxLevel != null && level > filter.maxLevel) return false;
        if (filter.minLevel != null && level < filter.minLevel) return false;
        if (form.minLevel != null && level < form.minLevel) return false;
        if (form.availableFor && className && !form.availableFor.includes(className)) return false;
        if (ability?.effect?.type === 'wild_shape' && form.availableForWildShape === false) return false;
        return true;
      });
    },

    canUseForm(formId, character, ability, data) {
      const effect = ability?.effect;
      const pool = effect?.forms?.pool || effect?.formSource || 'beast';
      let form = this.getFormFromPool(data, pool, formId)
        || this.getCustomFormFromAbility(ability, formId)
        || this.getBeast(data, formId);
      if (!form) return false;
      return this.filterFormsForAbility([form], character, ability).length > 0;
    },

    getAvailableFormsForAbility(data, character, ability) {
      const effect = ability?.effect;
      if (!effect) return [];
      if (Array.isArray(effect.forms)) {
        return effect.forms
          .map((id) => this.getBeast(data, id))
          .filter(Boolean);
      }
      const formsCfg = effect.forms || {};
      const pool = formsCfg.pool || effect.formSource || 'beast';
      let forms = [];
      if (pool === 'custom') {
        forms = Array.isArray(formsCfg.custom) ? [...formsCfg.custom] : [];
      } else {
        forms = this.getPoolFormsList(data, pool);
      }
      if (Array.isArray(formsCfg.custom) && pool !== 'custom') {
        forms = forms.concat(formsCfg.custom);
      }
      if (Array.isArray(formsCfg.ids)) {
        const idSet = new Set(formsCfg.ids);
        forms = forms.filter((f) => idSet.has(f.id));
      }
      return this.filterFormsForAbility(forms, character, ability);
    }
  };

  window.BeastSystem = BeastSystem;

  function installWildShapeHooks() {
    if (typeof GameEngine === 'undefined') return false;
    if (GameEngine._wildShapeHooksInstalled) return true;

    Object.assign(GameEngine, {
      WILD_SHAPE_UNLOCK_LEVEL,

      ensureBeastsData() {
        if (this.data) BeastSystem.ensureBeasts(this.data);
      },

      ensureWildShapeState() {
        if (this.state.className !== 'druid') return;
        if (!this.state.wildShape || typeof this.state.wildShape !== 'object') {
          this.state.wildShape = { knownForms: [] };
        }
        if (!Array.isArray(this.state.wildShape.knownForms)) {
          this.state.wildShape.knownForms = [];
        }
        this.ensureBeastsData();
        if (!this.state.wildShape.knownForms.length) {
          this.state.wildShape.knownForms = BeastSystem.defaultKnownFormIds(this.data);
        }
      },

      migrateWildShapeState() {
        if (this.state.className !== 'druid') {
          if (this.state.wildShape?.beastId) delete this.state.wildShape;
          return;
        }
        this.ensureWildShapeState();
      },

      getBeastsData() {
        this.ensureBeastsData();
        return this.data?.beasts || {};
      },

      getBeastById(id) {
        return BeastSystem.getBeast(this.data, id);
      },

      getActiveBeast() {
        const ws = this.state?.wildShape;
        if (!ws?.beastId) return null;
        return this.getBeastById(ws.beastId);
      },

      isInWildShape() {
        return !!this.state?.wildShape?.beastId;
      },

      transform(beastId) {
        return this.enterWildShape(beastId);
      },

      revert() {
        if (!this.isInWildShape()) return;
        this.endWildShape('manual');
      },

      getAvailableForms() {
        return this.getAvailableWildShapeBeasts();
      },

      getAbilityEffectType(ability) {
        const e = ability?.effect;
        if (e && typeof e === 'object' && e.type) return e.type;
        if (typeof e === 'string' && e.includes(':')) return e.split(':')[0];
        return null;
      },

      isWildShapeAbility(ability) {
        return this.getAbilityEffectType(ability) === 'wild_shape';
      },

      getDruidLevelForWildShape() {
        return Math.max(1, parseInt(this.state?.level, 10) || 1);
      },

      canUseWildShapeFeature() {
        return this.state.className === 'druid'
          && this.getDruidLevelForWildShape() >= WILD_SHAPE_UNLOCK_LEVEL;
      },

      getWildShapeDurationHours() {
        const lv = this.getDruidLevelForWildShape();
        return Math.max(1, Math.floor(lv / 2));
      },

      getAvailableWildShapeBeasts() {
        if (!this.canUseWildShapeFeature()) return [];
        this.ensureWildShapeState();
        const lv = this.getDruidLevelForWildShape();
        let beasts = BeastSystem.filterAvailableBeasts(this.data, lv);
        const known = this.state.wildShape?.knownForms;
        if (Array.isArray(known) && known.length) {
          beasts = beasts.filter((b) => known.includes(b.id));
        }
        return beasts;
      },

      getWildShapeUnavailableReason(ability) {
        if (!ability || !this.isWildShapeAbility(ability)) return null;
        if (this.state.className !== 'druid') return 'Только для друида';
        if (this.getDruidLevelForWildShape() < WILD_SHAPE_UNLOCK_LEVEL) {
          return `Доступно с ${WILD_SHAPE_UNLOCK_LEVEL} уровня`;
        }
        this.ensureWildShapeState();
        if (!this.getAvailableWildShapeBeasts().length) {
          return 'Нет известных форм (выберите при создании персонажа)';
        }
        if (this.isInWildShape()) return 'Уже в облике зверя';
        return null;
      },

      promptWildShapeForm(ability) {
        const beasts = this.getAvailableWildShapeBeasts();
        const lv = this.getDruidLevelForWildShape();
        const bodyEl = document.getElementById('modal-body');
        const titleEl = document.getElementById('modal-title');
        if (!bodyEl || !titleEl) {
          this.log('❌ Нет окна выбора формы.', 'log-damage');
          return;
        }
        const block = this.getWildShapeUnavailableReason(ability);
        if (block) {
          this.log(`❌ ${block}`, 'log-damage');
          return;
        }
        if (!beasts.length) {
          this.log(`❌ Нет доступных форм на ${lv} уровне друида.`, 'log-damage');
          return;
        }
        this._wildShapePrompt = ability;
        titleEl.textContent = '🐻 Дикий облик';
        const cards = beasts.map((b) => {
          const dmg = this.escapeHtml(b.dmgRoll || '—');
          return `<button type="button" class="wild-shape-pick" onclick="GameEngine.confirmWildShapePick('${this.escapeAttr(b.id)}')">
          <span class="wild-shape-pick-icon">${this.escapeHtml(b.icon || '🐾')}</span>
          <span class="wild-shape-pick-name">${this.escapeHtml(b.name || b.id)}</span>
          <span class="wild-shape-pick-stat">ОЗ: ${b.hp ?? '—'} · КД ${b.ac ?? '—'}</span>
          <span class="wild-shape-pick-stat">Ат: ${dmg}</span>
        </button>`;
        }).join('');
        bodyEl.innerHTML = `
        <p class="hint">Известные формы (уровень друида: <strong>${lv}</strong>). Длительность: ${this.getWildShapeDurationHours()} ч.</p>
        <div class="wild-shape-grid">${cards}</div>
        <div style="margin-top:14px;">
          <button type="button" class="choice" onclick="GameEngine.cancelWildShapePick()">Отмена</button>
        </div>`;
        document.getElementById('modal')?.classList.remove('hidden');
      },

      cancelWildShapePick() {
        this.closeModal();
        this._wildShapePrompt = null;
        this._pendingWildShapeBeastId = null;
      },

      confirmWildShapePick(beastId) {
        const ability = this._wildShapePrompt;
        this.closeModal();
        this._wildShapePrompt = null;
        if (!ability || !beastId) return;
        const beast = this.getBeastById(beastId);
        if (!beast) {
          this.log('❌ Зверь не найден.', 'log-damage');
          return;
        }
        this._pendingWildShapeBeastId = beastId;
        this.continueUseAbility(ability, null);
      },

      enterWildShape(beastId) {
        if (this.isInWildShape()) {
          this.log('Вы уже в облике зверя.', 'log-dice');
          return false;
        }
        const beast = this.getBeastById(beastId);
        if (!beast) {
          this.log('❌ Форма зверя не найдена в данных.', 'log-damage');
          return false;
        }
        const available = this.getAvailableWildShapeBeasts();
        if (!available.some((b) => b.id === beastId)) {
          this.log('❌ Эта форма недоступна на вашем уровне.', 'log-damage');
          return false;
        }

        const mental = {};
        ['int', 'wis', 'cha'].forEach((k) => {
          mental[k] = this.state.stats?.[k] ?? this.state.classData?.stats?.[k];
        });

        this.state.wildShape = {
          ...(this.state.wildShape || {}),
          beastId,
          druidHp: this.state.hp,
          druidMaxHp: this.state.maxHp,
          druidAc: this.state.classData?.ac,
          mentalStats: mental,
          startedAt: Date.now()
        };
        this.state.hp = Math.max(1, parseInt(beast.hp, 10) || 1);
        this.state.maxHp = this.state.hp;
        this.updateWildShapeStatDisplay(beast);
        this.renderClassDisplay?.(this.state.className);
        const hours = this.getWildShapeDurationHours();
        this.log(
          `🐾 Вы принимаете облик: ${beast.icon || ''} ${beast.name}! ОЗ ${this.state.hp}, КД ${beast.ac}. Длительность до ${hours} ч.`,
          'log-combat'
        );
        this.playCombatSound?.('buff');
        this.updateStats();
        this.renderAbilities?.();
        this.syncMobileCompactBar?.();
        if (this.state.combat) this.renderCombat();
        return true;
      },

      endWildShape(reason, damageContext) {
        const ws = this.state?.wildShape;
        if (!ws?.beastId) return;
        const beast = this.getBeastById(ws.beastId);
        let druidHp = ws.druidHp;
        const druidMax = ws.druidMaxHp ?? this.state.maxHp;

        if (reason === 'damage' && damageContext) {
          const dmg = Math.max(0, Number(damageContext.dmg) || 0);
          const hpBefore = Math.max(0, Number(damageContext.hpBefore) || 0);
          const excess = Math.max(0, dmg - hpBefore);
          if (excess > 0) druidHp = Math.max(1, druidHp - excess);
          else druidHp = 1;
        } else if (reason === 'combat_end') {
          druidHp = Math.min(druidHp, druidMax);
        }

        const knownForms = ws.knownForms;
        delete ws.beastId;
        delete ws.druidHp;
        delete ws.druidMaxHp;
        delete ws.druidAc;
        delete ws.mentalStats;
        delete ws.startedAt;
        this.state.wildShape = { knownForms: knownForms || [] };

        this.state.maxHp = druidMax;
        this.state.hp = Math.min(druidMax, Math.max(1, druidHp));
        this.recalcDerivedStats?.();
        this.renderClassDisplay?.(this.state.className);
        if (reason === 'damage') {
          this.log('Вы возвращаетесь в свою форму! Избыточный урон перенесён.', 'log-combat');
        } else if (reason === 'manual') {
          this.log('Вы возвращаетесь в свою форму.', 'log-combat');
        } else if (reason === 'combat_end') {
          this.log(`Вы возвращаетесь из облика ${beast?.name || 'зверя'}.`, 'log-combat');
        }
        this.updateStats();
        this.renderAbilities?.();
        this.syncMobileCompactBar?.();
        if (this.state.combat) this.renderCombat();
      },

      revertWildShapeManually() {
        if (!this.isInWildShape()) return;
        if (this.state.combat) {
          const c = this.state.combat;
          if (!c.bonusActionSpent) {
            this.spendCombatActionType('bonus_action');
          } else if (!c.actionSpent && !c.actionSurge) {
            this.spendCombatActionType('action');
          } else {
            this.log('Нет свободного действия, чтобы вернуться в форму.', 'log-damage');
            return;
          }
        }
        this.endWildShape('manual');
      },

      updateWildShapeStatDisplay(beast) {
        if (!beast) return;
        const { dmgRoll, dmgBonus } = BeastSystem.splitDamageFormula(beast.dmgRoll);
        const label = this.formatDamageLabel?.(dmgRoll, dmgBonus) || beast.dmgRoll;
        const acEl = document.getElementById('ac-val');
        const atkEl = document.getElementById('atk-val');
        const dmgEl = document.getElementById('dmg-val');
        if (acEl) acEl.textContent = String(beast.ac ?? '—');
        if (atkEl) atkEl.textContent = '+' + (beast.atkBonus ?? 0);
        if (dmgEl) dmgEl.textContent = label;
      },

      clearWildShapeIfCombatEnds() {
        if (this.isInWildShape()) this.endWildShape('combat_end');
      }
    });

    if (!GameEngine._wildShapeTakeDamageWrapped) {
      const origTakeDamage = GameEngine.takeDamage;
      GameEngine.takeDamage = function (amount) {
        const dmg = Math.max(0, Number(amount) || 0);
        if (this.isInWildShape()) {
          const hpBefore = this.state.hp;
          this.state.hp = Math.max(0, hpBefore - dmg);
          if (dmg > 0 && typeof this.checkConcentrationAfterDamage === 'function') {
            this.checkConcentrationAfterDamage(dmg);
          }
          this.updateStats();
          if (this.state.hp <= 0) {
            this.endWildShape('damage', { dmg, hpBefore });
            return false;
          }
          return false;
        }
        return origTakeDamage.call(this, amount);
      };
      GameEngine._wildShapeTakeDamageWrapped = true;
    }

    if (!GameEngine._wildShapeContinueWrapped) {
      const origContinue = GameEngine.continueUseAbility;
      GameEngine.continueUseAbility = function (ability, castLevel) {
        if (this.isWildShapeAbility(ability) && !this.isInWildShape() && !this._pendingWildShapeBeastId) {
          this.promptWildShapeForm(ability);
          return;
        }
        if (this.isWildShapeAbility(ability) && this.isInWildShape()) {
          this.log('Вы уже в облике зверя. Используйте «Вернуться в форму».', 'log-dice');
          return;
        }
        return origContinue.call(this, ability, castLevel);
      };
      GameEngine._wildShapeContinueWrapped = true;
    }

    if (!GameEngine._wildShapeWeaponWrapped) {
      const origProfile = GameEngine.getWeaponAttackProfile;
      GameEngine.getWeaponAttackProfile = function (slot = 'weapon_main') {
        if (this.isInWildShape() && slot === 'weapon_main') {
          const beast = this.getActiveBeast();
          if (beast) {
            const { dmgRoll, dmgBonus } = BeastSystem.splitDamageFormula(beast.dmgRoll);
            return {
              dmgRoll,
              dmgBonus,
              atkBonus: parseInt(beast.atkBonus, 10) || 0,
              statKey: 'str',
              weaponName: beast.name || 'Укус',
              weaponId: null,
              isOffHand: false
            };
          }
        }
        return origProfile.call(this, slot);
      };
      GameEngine._wildShapeWeaponWrapped = true;
    }

    if (!GameEngine._wildShapeFormatDmgWrapped) {
      const origFormatDmg = GameEngine.formatEquippedDamageLabel;
      GameEngine.formatEquippedDamageLabel = function (stats) {
        if (this.isInWildShape()) {
          const beast = this.getActiveBeast();
          if (beast) {
            const { dmgRoll, dmgBonus } = BeastSystem.splitDamageFormula(beast.dmgRoll);
            const formula = this.formatDamageLabel(dmgRoll, dmgBonus);
            return `${formula} · ${beast.name || 'зверь'}`;
          }
        }
        return origFormatDmg.call(this, stats);
      };
      GameEngine._wildShapeFormatDmgWrapped = true;
    }

    if (!GameEngine._wildShapeClassDisplayWrapped) {
      const origRenderClass = GameEngine.renderClassDisplay;
      GameEngine.renderClassDisplay = function (classKey) {
        origRenderClass.call(this, classKey);
        const beast = this.getActiveBeast();
        const el = document.getElementById('class-display');
        if (beast && el) {
          el.innerHTML += ` <span class="wild-shape-badge" title="Дикий облик">${this.escapeHtml(beast.icon || '🐾')} ${this.escapeHtml(beast.name)}</span>`;
        }
      };
      GameEngine._wildShapeClassDisplayWrapped = true;
    }

    if (!GameEngine._wildShapeApplyDataWrapped) {
      const origApplyData = GameEngine.applyGameData;
      GameEngine.applyGameData = function (...args) {
        const r = origApplyData.apply(this, args);
        this.ensureBeastsData?.();
        return r;
      };
      GameEngine._wildShapeApplyDataWrapped = true;
    }

    if (!GameEngine._wildShapeAbilityReasonWrapped) {
      const origReason = GameEngine.getAbilityUnavailableReason;
      GameEngine.getAbilityUnavailableReason = function (ab) {
        const ws = this.getWildShapeUnavailableReason?.(ab);
        if (ws) return ws;
        return origReason.call(this, ab);
      };
      GameEngine._wildShapeAbilityReasonWrapped = true;
    }

    if (!GameEngine._wildShapeLoadWrapped) {
      const origLoad = GameEngine.loadGame;
      GameEngine.loadGame = function () {
        const ok = origLoad.call(this);
        if (ok) this.migrateWildShapeState?.();
        return ok;
      };
      GameEngine._wildShapeLoadWrapped = true;
    }

    if (!GameEngine._wildShapeSaveWrapped) {
      const origSave = GameEngine.saveGame;
      GameEngine.saveGame = function () {
        if (this.state.className === 'druid') this.ensureWildShapeState?.();
        return origSave.call(this);
      };
      GameEngine._wildShapeSaveWrapped = true;
    }

    GameEngine._wildShapeHooksInstalled = true;
    return true;
  }

  if (!installWildShapeHooks()) {
    document.addEventListener('DOMContentLoaded', installWildShapeHooks);
  }
})();
