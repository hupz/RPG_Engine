// ============================================
// Дикий облик друида — звери и превращение
// ============================================

(function attachWildShape() {
  if (typeof GameEngine === 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      if (typeof GameEngine !== 'undefined') attachWildShape();
    });
    return;
  }

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
      stats: { str: 12, dex: 15, con: 12 },
      abilities: ['pack_tactics'],
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
      stats: { str: 15, dex: 10, con: 14 },
      abilities: [],
      availableForWildShape: true,
      minDruidLevel: 5
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
      stats: { str: 14, dex: 15, con: 10 },
      abilities: ['keen_smell', 'climb'],
      availableForWildShape: true,
      minDruidLevel: 2
    }
  };

  const ABILITY_PRESETS = {
    pack_tactics: 'Тактика стаи (преимущество, если союзник рядом)',
    keen_smell: 'Нюх (выслеживание)',
    keen_hearing: 'Острое слуховое восприятие',
    darkvision: 'Ночное зрение',
    swim: 'Плавание',
    climb: 'Лазание',
    fly: 'Полёт'
  };

  const BeastSystem = {
    CR_OPTIONS,
    ABILITY_PRESETS,
    DEFAULT_BEASTS,

    ensureBeasts(data) {
      if (!data) return {};
      if (!data.beasts || typeof data.beasts !== 'object') {
        data.beasts = JSON.parse(JSON.stringify(DEFAULT_BEASTS));
      }
      Object.keys(DEFAULT_BEASTS).forEach((id) => {
        if (!data.beasts[id]) data.beasts[id] = JSON.parse(JSON.stringify(DEFAULT_BEASTS[id]));
      });
      return data.beasts;
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

    /** Максимальный CR облика по уровню друида (D&D 5e, упрощённо) */
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

    /** Доступные формы для уровня друида */
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

    /** Список по уровням для редактора класса */
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
    }
  };

  window.BeastSystem = BeastSystem;

  Object.assign(GameEngine, {
    ensureBeastsData() {
      if (this.data) BeastSystem.ensureBeasts(this.data);
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

    getAvailableWildShapeBeasts() {
      return BeastSystem.filterAvailableBeasts(this.data, this.getDruidLevelForWildShape());
    },

    /** Модальное окно выбора формы перед трактовкой умения */
    promptWildShapeForm(ability) {
      const beasts = this.getAvailableWildShapeBeasts();
      const lv = this.getDruidLevelForWildShape();
      const bodyEl = document.getElementById('modal-body');
      const titleEl = document.getElementById('modal-title');
      if (!bodyEl || !titleEl) {
        this.log('❌ Нет окна выбора формы.', 'log-damage');
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
          <span class="wild-shape-pick-stat">ОЗ: ${b.hp ?? '—'}</span>
          <span class="wild-shape-pick-stat">Ат: ${dmg}</span>
        </button>`;
      }).join('');
      bodyEl.innerHTML = `
        <p class="hint">Доступные формы (уровень друида: <strong>${lv}</strong>). CR до ${this.escapeHtml(BeastSystem.formatCr(BeastSystem.getMaxCrForDruidLevel(lv)))}.</p>
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

      this.state.wildShape = {
        beastId,
        druidHp: this.state.hp,
        druidMaxHp: this.state.maxHp
      };
      this.state.hp = Math.max(1, parseInt(beast.hp, 10) || 1);
      this.state.maxHp = this.state.hp;
      this.updateWildShapeStatDisplay(beast);
      this.renderClassDisplay?.(this.state.className);
      this.log(`🐾 Вы принимаете облик: ${beast.icon || ''} ${beast.name}! ОЗ ${this.state.hp}, КД ${beast.ac}.`, 'log-combat');
      this.playCombatSound?.('buff');
      this.updateStats();
      if (this.state.combat) this.renderCombat();
      return true;
    },

    endWildShape(reason, damageContext) {
      const ws = this.state?.wildShape;
      if (!ws) return;
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

      delete this.state.wildShape;
      this.state.maxHp = druidMax;
      this.state.hp = Math.min(druidMax, Math.max(1, druidHp));
      this.recalcDerivedStats?.();
      this.renderClassDisplay?.(this.state.className);
      if (reason === 'damage') {
        this.log('Вы возвращаетесь в свою форму!', 'log-combat');
      } else if (reason === 'manual') {
        this.log('Вы возвращаетесь в свою форму.', 'log-combat');
      }
      this.updateStats();
      if (this.state.combat) this.renderCombat();
    },

    revertWildShapeManually() {
      if (!this.isInWildShape() || !this.state.combat) return;
      const c = this.state.combat;
      if (!c.bonusActionSpent) {
        this.spendCombatActionType('bonus_action');
      } else if (!c.actionSpent && !c.actionSurge) {
        this.spendCombatActionType('action');
      } else {
        this.log('Нет свободного действия, чтобы вернуться в форму.', 'log-damage');
        return;
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

  const origRenderClass = GameEngine.renderClassDisplay;
  GameEngine.renderClassDisplay = function (classKey) {
    origRenderClass.call(this, classKey);
    const beast = this.getActiveBeast();
    const el = document.getElementById('class-display');
    if (beast && el) {
      el.innerHTML += ` <span class="wild-shape-badge" title="Дикий облик">${this.escapeHtml(beast.icon || '🐾')} ${this.escapeHtml(beast.name)}</span>`;
    }
  };

  const origApplyData = GameEngine.applyGameData;
  GameEngine.applyGameData = function (...args) {
    const r = origApplyData.apply(this, args);
    this.ensureBeastsData?.();
    return r;
  };
})();

