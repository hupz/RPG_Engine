// ============================================
// Универсальная система превращений (transformation)
// Работает для любого класса, заклинаний, расовых умений
// ============================================

(function () {
  const DURATION_LABELS = {
    rounds: 'раундов',
    minutes: 'мин.',
    minutes_per_level: 'мин./ур.',
    hours: 'ч.',
    hours_per_level: 'ч./ур.',
    concentration: 'концентрация'
  };

  const TransformSystem = {
    DURATION_LABELS,

    isTransformationEffect(ability) {
      const t = ability?.effect?.type;
      return t === 'transformation';
    },

    isModifiersOnlyEffect(ability) {
      const effect = ability?.effect;
      if (!effect || effect.type !== 'transformation') return false;
      const pool = effect.forms?.pool || effect.formSource;
      const hasCustom = Array.isArray(effect.forms?.custom) && effect.forms.custom.length;
      const hasPool = pool && pool !== 'custom';
      const hasLegacyForms = Array.isArray(effect.forms) && effect.forms.length;
      return !hasCustom && !hasPool && !hasLegacyForms && !!(effect.modifiers?.length);
    },

    formatDuration(duration, level = 1) {
      if (!duration) return 'бессрочно';
      if (typeof duration === 'string') {
        if (duration === 'hours_per_level') return `${Math.max(1, Math.floor(level / 2))} ч.`;
        return duration;
      }
      const lv = Math.max(1, parseInt(level, 10) || 1);
      const val = duration.value ?? 1;
      const unit = DURATION_LABELS[duration.type] || duration.type || '';
      if (duration.type === 'minutes_per_level' || duration.type === 'hours_per_level') {
        return `${val * lv} ${unit}`;
      }
      if (duration.concentration) return `${val} ${unit} (концентрация)`;
      return `${val} ${unit}`;
    },

    calculateDurationRounds(duration, level = 1) {
      if (!duration) return Infinity;
      if (typeof duration === 'string') {
        const lv = Math.max(1, parseInt(level, 10) || 1);
        if (duration === 'hours_per_level') return Math.max(1, Math.floor(lv / 2)) * 600;
        return Infinity;
      }
      const lv = Math.max(1, parseInt(level, 10) || 1);
      const val = duration.value ?? 1;
      switch (duration.type) {
        case 'rounds': return val;
        case 'minutes': return val * 10;
        case 'minutes_per_level': return val * lv * 10;
        case 'hours': return val * 600;
        case 'hours_per_level': return val * lv * 600;
        case 'concentration': return Infinity;
        default: return Infinity;
      }
    },

    normalizeFormAttack(form) {
      if (form.atkBonus != null) return form;
      const atk = Array.isArray(form.attacks) && form.attacks[0] ? form.attacks[0] : null;
      if (!atk) return form;
      const dmg = atk.damage || atk.dmgRoll || '1d6';
      const split = typeof BeastSystem !== 'undefined'
        ? BeastSystem.splitDamageFormula(dmg)
        : { dmgRoll: dmg, dmgBonus: 0 };
      return {
        ...form,
        atkBonus: atk.bonus ?? atk.atkBonus ?? 0,
        dmgRoll: split.dmgRoll,
        dmgBonus: split.dmgBonus,
        attackName: atk.name || form.name
      };
    },

    describeModifiers(modifiers) {
      if (!Array.isArray(modifiers) || !modifiers.length) return '';
      return modifiers.map((m) => `${m.icon || '✨'} ${m.name}`).join(', ');
    }
  };

  window.TransformSystem = TransformSystem;

  function installTransformHooks() {
    if (typeof GameEngine === 'undefined') return false;
    if (GameEngine._transformHooksInstalled) return true;

    Object.assign(GameEngine, {
      isTransformationAbility(ability) {
        return TransformSystem.isTransformationEffect(ability);
      },

      isInTransformation() {
        return !!(this.state?.transformation?.formId || this.state?.transformation?.modifiersOnly);
      },

      getTransformAbilityById(id) {
        return this.state.classData?.abilities?.find((a) => a.id === id) || null;
      },

      getAvailableTransformForms(ability) {
        if (typeof BeastSystem === 'undefined') return [];
        const character = {
          className: this.state.className,
          classKey: this.state.className,
          level: this.state.level || 1
        };
        return BeastSystem.getAvailableFormsForAbility(this.data, character, ability);
      },

      getTransformForm(formId, ability) {
        if (!formId) return null;
        const effect = ability?.effect;
        const pool = effect?.forms?.pool || effect?.formSource || 'beast';
        if (typeof BeastSystem !== 'undefined') {
          const custom = BeastSystem.getCustomFormFromAbility(ability, formId);
          if (custom) return TransformSystem.normalizeFormAttack(custom);
          const fromPool = BeastSystem.getFormFromPool(this.data, pool, formId);
          if (fromPool) return TransformSystem.normalizeFormAttack(fromPool);
          const beast = BeastSystem.getBeast(this.data, formId);
          if (beast) return TransformSystem.normalizeFormAttack(beast);
        }
        return null;
      },

      calculateTransformDuration(ability) {
        const dur = ability?.effect?.duration;
        return TransformSystem.calculateDurationRounds(dur, this.state.level || 1);
      },

      formatTransformDuration(ability) {
        return TransformSystem.formatDuration(ability?.effect?.duration, this.state.level || 1);
      },

      getTransformUnavailableReason(ability) {
        if (!ability || !this.isTransformationAbility(ability)) return null;
        const effect = ability.effect;
        if (this.isInTransformation()) return 'Уже преобразованы';
        if (this.isInWildShape?.()) return 'Уже в облике зверя';
        if (effect.permanent || ability.passive || ability.type === 'passive') return null;
        if (!TransformSystem.isModifiersOnlyEffect(ability)) {
          const forms = this.getAvailableTransformForms(ability);
          if (!forms.length) return 'Нет доступных форм';
        }
        if (effect.mode === 'target' && !this.state.combat) {
          return 'Только в бою (цель)';
        }
        return null;
      },

      promptTransformForm(ability) {
        const effect = ability?.effect || {};
        const bodyEl = document.getElementById('modal-body');
        const titleEl = document.getElementById('modal-title');
        if (!bodyEl || !titleEl) {
          this.log('❌ Нет окна выбора формы.', 'log-damage');
          return;
        }
        const block = this.getTransformUnavailableReason(ability);
        if (block) {
          this.log(`❌ ${block}`, 'log-damage');
          return;
        }

        this._pendingTransformAbility = ability;

        if (TransformSystem.isModifiersOnlyEffect(ability)) {
          const mods = effect.modifiers || [];
          this.confirmTransform(null, ability, mods);
          return;
        }

        const forms = this.getAvailableTransformForms(ability);
        const modifiers = effect.modifiers || [];
        titleEl.textContent = `${ability.icon || '🐾'} ${ability.name || 'Превращение'}`;

        const formsHtml = forms.map((f) => {
          const atk = f.atkBonus ?? 0;
          return `<button type="button" class="transform-card" data-form="${this.escapeAttr(f.id)}">
            <span class="transform-icon">${this.escapeHtml(f.icon || '🐾')}</span>
            <span class="transform-name">${this.escapeHtml(f.name || f.id)}</span>
            <span class="transform-stats">ОЗ ${f.hp ?? '—'} · КД ${f.ac ?? '—'} · Атк +${atk}</span>
          </button>`;
        }).join('');

        let modsHtml = '';
        if (modifiers.length) {
          modsHtml = `<h4 style="margin:12px 0 8px;font-size:13px;">Дополнительные черты</h4>
            <div class="modifier-list">${modifiers.map((m) => `
              <label class="modifier-chip">
                <input type="checkbox" name="transform-modifier" value="${this.escapeAttr(m.id)}">
                <span>${this.escapeHtml(m.icon || '✨')} ${this.escapeHtml(m.name || m.id)}</span>
                ${m.visual ? `<small>${this.escapeHtml(m.visual)}</small>` : ''}
              </label>`).join('')}</div>`;
        }

        bodyEl.innerHTML = `
          <div class="transform-picker">
            ${effect.visual ? `<p class="hint">${this.escapeHtml(effect.visual)}</p>` : ''}
            <p>Выберите форму превращения:</p>
            <div class="transform-grid">${formsHtml || '<p class="hint">Нет форм</p>'}</div>
            ${modsHtml}
            <div class="transform-duration">Длительность: ${this.escapeHtml(this.formatTransformDuration(ability))}</div>
            <div style="margin-top:14px;">
              <button type="button" class="choice" onclick="GameEngine.cancelTransformPick()">Отмена</button>
            </div>
          </div>`;

        bodyEl.querySelectorAll('.transform-card').forEach((card) => {
          card.onclick = () => {
            const formId = card.dataset.form;
            const selectedMods = Array.from(bodyEl.querySelectorAll('input[name="transform-modifier"]:checked'))
              .map((cb) => modifiers.find((m) => m.id === cb.value))
              .filter(Boolean);
            this.confirmTransform(formId, ability, selectedMods);
          };
        });

        document.getElementById('modal')?.classList.remove('hidden');
      },

      cancelTransformPick() {
        this.closeModal();
        this._pendingTransformAbility = null;
        this._pendingTransformFormId = null;
        this._pendingTransformModifiers = null;
      },

      confirmTransform(formId, ability, selectedMods) {
        this.closeModal();
        this._pendingTransformAbility = ability;
        this._pendingTransformFormId = formId;
        this._pendingTransformModifiers = selectedMods || [];
        this.continueUseAbility(ability, null);
      },

      applyFormStatsToState(form, statOverride) {
        if (!form) return;
        const physical = statOverride?.physical !== false;
        const mental = statOverride?.mental === true;
        const formStats = form.stats || {};

        if (physical) {
          ['str', 'dex', 'con'].forEach((k) => {
            if (formStats[k] != null) {
              this.state.stats[k] = formStats[k];
              if (this.state.classData?.stats) this.state.classData.stats[k] = formStats[k];
            }
          });
        }
        if (mental) {
          ['int', 'wis', 'cha'].forEach((k) => {
            if (formStats[k] != null) {
              this.state.stats[k] = formStats[k];
              if (this.state.classData?.stats) this.state.classData.stats[k] = formStats[k];
            }
          });
        }

        if (form.hp != null) {
          this.state.hp = Math.max(1, parseInt(form.hp, 10) || 1);
          this.state.maxHp = this.state.hp;
        }
        if (form.ac != null && this.state.classData) {
          this.state.classData.ac = parseInt(form.ac, 10) || this.state.classData.ac;
        }
        if (form.speed != null) this.state.speed = form.speed;
        if (form.fly) this.state.flySpeed = form.fly;
        if (form.swim) this.state.swimSpeed = form.swim;
        if (form.climb) this.state.climbSpeed = form.climb;

        this.updateTransformStatDisplay(form);
      },

      updateTransformStatDisplay(form) {
        if (!form) return;
        const split = typeof BeastSystem !== 'undefined'
          ? BeastSystem.splitDamageFormula(form.dmgRoll || '1d6')
          : { dmgRoll: form.dmgRoll || '1d6', dmgBonus: form.dmgBonus || 0 };
        const label = this.formatDamageLabel?.(split.dmgRoll, split.dmgBonus) || form.dmgRoll;
        const acEl = document.getElementById('ac-val');
        const atkEl = document.getElementById('atk-val');
        const dmgEl = document.getElementById('dmg-val');
        if (acEl && form.ac != null) acEl.textContent = String(form.ac);
        if (atkEl && form.atkBonus != null) atkEl.textContent = '+' + form.atkBonus;
        if (dmgEl && form.dmgRoll) dmgEl.textContent = label;
      },

      applyTransformModifiers(modifiers) {
        if (!Array.isArray(modifiers)) return;
        modifiers.forEach((mod) => {
          const grant = mod?.grant;
          if (!grant) return;
          if (grant.climb_speed) this.state.climbSpeed = grant.climb_speed;
          if (grant.fly_speed) this.state.flySpeed = grant.fly_speed;
          if (grant.swim_speed) this.state.swimSpeed = grant.swim_speed;
          if (grant.darkvision) {
            this.state.darkvision = Math.max(this.state.darkvision || 0, grant.darkvision);
          }
          if (grant.scent) this.state.scent = grant.scent;
          if (grant.perception_bonus) {
            this.state.perceptionBonus = (this.state.perceptionBonus || 0) + grant.perception_bonus;
          }
          if (grant.spider_climb) this.state.spiderClimb = true;
          if (grant.web_walker) this.state.webWalker = true;
          if (grant.water_breathing) this.state.waterBreathing = true;
          if (grant.fly) this.state.canFly = true;
          if (grant.resistance) {
            if (!this.state.resistances) this.state.resistances = {};
            Object.assign(this.state.resistances, grant.resistance);
          }
          if (grant.aura_damage || grant.radiant_aura) {
            this.state.aura = grant.aura_damage || grant.radiant_aura;
          }
        });
        this.renderTransformSidebarBadges?.();
      },

      clearTransformModifierState() {
        delete this.state.climbSpeed;
        delete this.state.flySpeed;
        delete this.state.swimSpeed;
        delete this.state.darkvision;
        delete this.state.scent;
        delete this.state.perceptionBonus;
        delete this.state.spiderClimb;
        delete this.state.webWalker;
        delete this.state.waterBreathing;
        delete this.state.canFly;
        delete this.state.aura;
        if (this.state.passiveTransformModifiers?.length) {
          this.applyTransformModifiers(this.state.passiveTransformModifiers);
        }
      },

      enterTransformation(formId, options = {}) {
        const ability = options.ability || this._pendingTransformAbility;
        const effect = ability?.effect;
        let form = null;
        if (formId) {
          form = this.getTransformForm(formId, ability);
          if (!form) {
            this.log('❌ Форма не найдена.', 'log-damage');
            return false;
          }
          if (typeof BeastSystem !== 'undefined') {
            const character = { className: this.state.className, level: this.state.level || 1 };
            if (!BeastSystem.canUseForm(formId, character, ability, this.data)) {
              this.log('❌ Эта форма недоступна.', 'log-damage');
              return false;
            }
          }
        }

        const modifiers = options.modifiers
          || this._pendingTransformModifiers
          || effect?.modifiers
          || [];
        const statOverride = effect?.statOverride || { physical: true, mental: false };

        this.state.transformation = {
          original: {
            hp: this.state.hp,
            maxHp: this.state.maxHp,
            ac: this.state.classData?.ac,
            stats: { ...(this.state.stats || {}) },
            classStats: { ...(this.state.classData?.stats || {}) },
            atkBonus: this.state.classData?.atkBonus,
            dmgRoll: this.state.classData?.dmgRoll,
            dmgBonus: this.state.classData?.dmgBonus
          },
          formId: formId || null,
          formName: form?.name,
          formIcon: form?.icon,
          abilityId: ability?.id,
          modifiersOnly: !formId,
          modifiers: [...modifiers],
          statOverride,
          restrictions: effect?.restrictions || {},
          roundsRemaining: this.calculateTransformDuration(ability),
          concentration: !!effect?.duration?.concentration
        };

        if (form) this.applyFormStatsToState(form, statOverride);
        if (modifiers.length) this.applyTransformModifiers(modifiers);

        const label = form
          ? `${form.icon || ''} ${form.name}`
          : (ability?.name || 'превращение');
        this.log(`🐾 Превращение: ${label}!`, 'log-combat');
        this.playCombatSound?.('buff');
        this.recalcDerivedStats?.();
        this.updateStats();
        this.renderAbilities?.();
        this.renderClassDisplay?.(this.state.className);
        this.syncMobileCompactBar?.();
        if (this.state.combat) this.renderCombat();
        return true;
      },

      revertTransform(reason = 'manual') {
        const t = this.state?.transformation;
        if (!t) return;

        const orig = t.original || {};
        if (orig.maxHp != null) this.state.maxHp = orig.maxHp;
        if (orig.hp != null) {
          this.state.hp = Math.min(orig.maxHp ?? this.state.maxHp, Math.max(1, this.state.hp));
        }
        if (orig.stats) {
          this.state.stats = { ...orig.stats };
          if (this.state.classData) this.state.classData.stats = { ...(orig.classStats || orig.stats) };
        }
        if (orig.ac != null && this.state.classData) this.state.classData.ac = orig.ac;
        if (orig.atkBonus != null && this.state.classData) this.state.classData.atkBonus = orig.atkBonus;
        if (orig.dmgRoll && this.state.classData) this.state.classData.dmgRoll = orig.dmgRoll;
        if (orig.dmgBonus != null && this.state.classData) this.state.classData.dmgBonus = orig.dmgBonus;

        delete this.state.transformation;
        this.clearTransformModifierState();

        const reasonLabels = {
          manual: 'вручную',
          expired: 'истекло',
          concentration_lost: 'потеря концентрации',
          damage: 'урон',
          combat_end: 'конец боя'
        };
        this.log(`✨ Превращение окончено (${reasonLabels[reason] || reason}).`, 'log-heal');
        this.recalcDerivedStats?.();
        this.updateStats();
        this.renderAbilities?.();
        this.renderClassDisplay?.(this.state.className);
        this.syncMobileCompactBar?.();
        if (this.state.combat) this.renderCombat();
      },

      revertTransformManually() {
        if (!this.isInTransformation()) return;
        if (this.state.combat) {
          const c = this.state.combat;
          if (!c.bonusActionSpent) {
            this.spendCombatActionType('bonus_action');
          } else if (!c.actionSpent && !c.actionSurge) {
            this.spendCombatActionType('action');
          }
        }
        this.revertTransform('manual');
      },

      checkTransformExpiration() {
        const t = this.state?.transformation;
        if (!t) return;
        if (t.concentration && this.state.combat?.concentrationBroken) {
          this.revertTransform('concentration_lost');
          return;
        }
        if (t.roundsRemaining != null && t.roundsRemaining !== Infinity) {
          if (t.roundsRemaining <= 0) this.revertTransform('expired');
        }
      },

      tickTransformDuration() {
        const t = this.state?.transformation;
        if (!t || t.roundsRemaining == null || t.roundsRemaining === Infinity) return;
        t.roundsRemaining = Math.max(0, t.roundsRemaining - 1);
        this.checkTransformExpiration();
      },

      getActiveTransformForm() {
        const t = this.state?.transformation;
        if (!t?.formId) return null;
        const ability = this.getTransformAbilityById(t.abilityId);
        return this.getTransformForm(t.formId, ability);
      },

      applyPassiveTransformation(ability) {
        const effect = ability?.effect;
        if (!effect || effect.type !== 'transformation') return;
        const isPassive = ability.passive || ability.type === 'passive' || effect.permanent;
        if (!isPassive) return;
        const mods = effect.modifiers || [];
        if (!mods.length) return;
        if (!this.state.passiveTransformModifiers) this.state.passiveTransformModifiers = [];
        this.state.passiveTransformModifiers = this.state.passiveTransformModifiers.concat(mods);
        this.applyTransformModifiers(mods);
      },

      transformEnemy(enemyIndex, formId, ability) {
        const enemy = this.state.enemies?.[enemyIndex];
        if (!enemy) return false;
        const form = this.getTransformForm(formId, ability);
        if (!form) return false;
        enemy._original = { ...enemy };
        enemy.name = form.name || enemy.name;
        enemy.icon = form.icon || enemy.icon;
        enemy.hp = form.hp ?? enemy.hp;
        enemy.maxHp = form.hp ?? enemy.maxHp;
        enemy.ac = form.ac ?? enemy.ac;
        if (form.attacks) enemy.attacks = form.attacks;
        if (form.abilities) enemy.abilities = form.abilities;
        this.log(`✨ ${enemy._original.name} превращается в ${form.name}!`, 'log-combat');
        this.renderCombat?.();
        return true;
      },

      clearTransformIfCombatEnds() {
        if (!this.isInTransformation?.()) return;
        const ability = this.getTransformAbilityById?.(this.state.transformation?.abilityId);
        if (ability?.combatOnly || ability?.effect?.combatOnly) {
          this.revertTransform('combat_end');
        }
      },

      renderTransformSidebarBadges() {
        const el = document.getElementById('transform-badges');
        if (!el) return;
        const parts = [];
        if (this.state.flySpeed || this.state.canFly) parts.push('🪽 полёт');
        if (this.state.climbSpeed || this.state.spiderClimb) parts.push('🕷️ лазание');
        if (this.state.swimSpeed || this.state.waterBreathing) parts.push('🐟 плавание');
        if (this.state.darkvision) parts.push(`👁️ тьма ${this.state.darkvision} фт`);
        el.innerHTML = parts.length
          ? `<div class="transform-badges">${parts.map((p) => `<span class="transform-badge">${this.escapeHtml(p)}</span>`).join('')}</div>`
          : '';
      },

      getAbilityDisplayDescWithTransform(ab) {
        const base = ab?.desc || '';
        if (!TransformSystem.isTransformationEffect(ab)) return base;
        const mods = TransformSystem.describeModifiers(ab.effect?.modifiers);
        const dur = ab.effect?.duration
          ? ` Длительность: ${TransformSystem.formatDuration(ab.effect.duration, this.state?.level || 1)}.`
          : '';
        const modLine = mods ? ` Модификаторы: ${mods}.` : '';
        return (base + modLine + dur).trim();
      }
    });

    if (!GameEngine._transformContinueWrapped) {
      const origContinue = GameEngine.continueUseAbility;
      GameEngine.continueUseAbility = function (ability, castLevel) {
        if (this.isTransformationAbility?.(ability) && !this.isInTransformation?.()) {
          if (!this._pendingTransformFormId && !this._pendingTransformAbility
            && !TransformSystem.isModifiersOnlyEffect(ability)) {
            this.promptTransformForm(ability);
            return;
          }
        }
        if (this.isTransformationAbility?.(ability) && this.isInTransformation?.()) {
          this.log('Вы уже преобразованы.', 'log-dice');
          return;
        }
        return origContinue.call(this, ability, castLevel);
      };
      GameEngine._transformContinueWrapped = true;
    }

    if (!GameEngine._transformTakeDamageWrapped) {
      const origTakeDamage = GameEngine.takeDamage;
      GameEngine.takeDamage = function (amount) {
        if (this.isInTransformation?.() && !this.isInWildShape?.()) {
          const dmg = Math.max(0, Number(amount) || 0);
          const hpBefore = this.state.hp;
          this.state.hp = Math.max(0, hpBefore - dmg);
          if (dmg > 0 && typeof this.checkConcentrationAfterDamage === 'function') {
            this.checkConcentrationAfterDamage(dmg);
          }
          this.updateStats();
          if (this.state.hp <= 0) {
            this.revertTransform('damage');
            return false;
          }
          return false;
        }
        return origTakeDamage.call(this, amount);
      };
      GameEngine._transformTakeDamageWrapped = true;
    }

    if (!GameEngine._transformWeaponWrapped) {
      const origProfile = GameEngine.getWeaponAttackProfile;
      GameEngine.getWeaponAttackProfile = function (slot = 'weapon_main') {
        if (this.isInTransformation?.() && !this.isInWildShape?.() && slot === 'weapon_main') {
          const form = this.getActiveTransformForm?.();
          if (form) {
            const split = typeof BeastSystem !== 'undefined'
              ? BeastSystem.splitDamageFormula(form.dmgRoll || '1d6')
              : { dmgRoll: form.dmgRoll || '1d6', dmgBonus: form.dmgBonus || 0 };
            return {
              dmgRoll: split.dmgRoll,
              dmgBonus: split.dmgBonus,
              atkBonus: parseInt(form.atkBonus, 10) || 0,
              statKey: 'str',
              weaponName: form.attackName || form.name || 'Атака',
              weaponId: null,
              isOffHand: false
            };
          }
        }
        return origProfile.call(this, slot);
      };
      GameEngine._transformWeaponWrapped = true;
    }

    if (!GameEngine._transformClassDisplayWrapped) {
      const origRenderClass = GameEngine.renderClassDisplay;
      GameEngine.renderClassDisplay = function (classKey) {
        origRenderClass.call(this, classKey);
        const t = this.state?.transformation;
        const el = document.getElementById('class-display');
        if (t && el) {
          const icon = t.formIcon || '🐾';
          const name = t.formName || 'превращение';
          el.innerHTML += ` <span class="transform-active-badge" title="Активное превращение">${this.escapeHtml(icon)} ${this.escapeHtml(name)}</span>`;
        }
        this.renderTransformSidebarBadges?.();
      };
      GameEngine._transformClassDisplayWrapped = true;
    }

    if (!GameEngine._transformAbilityReasonWrapped) {
      const origReason = GameEngine.getAbilityUnavailableReason;
      GameEngine.getAbilityUnavailableReason = function (ab) {
        const tr = this.getTransformUnavailableReason?.(ab);
        if (tr) return tr;
        return origReason.call(this, ab);
      };
      GameEngine._transformAbilityReasonWrapped = true;
    }

    if (!GameEngine._transformPassiveWrapped) {
      const origPassive = GameEngine.applyPassiveAbility;
      GameEngine.applyPassiveAbility = function (ability) {
        origPassive.call(this, ability);
        this.applyPassiveTransformation?.(ability);
      };
      GameEngine._transformPassiveWrapped = true;
    }

    if (!GameEngine._transformDisplayDescWrapped) {
      const origDesc = GameEngine.getAbilityDisplayDesc;
      GameEngine.getAbilityDisplayDesc = function (ab) {
        if (TransformSystem.isTransformationEffect(ab)) {
          return this.getAbilityDisplayDescWithTransform(ab);
        }
        return origDesc.call(this, ab);
      };
      GameEngine._transformDisplayDescWrapped = true;
    }

    if (!GameEngine._transformTurnWrapped) {
      const origNext = GameEngine.nextCombatTurn;
      if (typeof origNext === 'function') {
        GameEngine.nextCombatTurn = function (...args) {
          const turn = this.state.combat?.order?.[this.state.combat?.turnIndex];
          if (turn?.type === 'player') this.tickTransformDuration?.();
          return origNext.apply(this, args);
        };
      }
      GameEngine._transformTurnWrapped = true;
    }

    if (!GameEngine._transformApplyDataWrapped) {
      const origApplyData = GameEngine.applyGameData;
      GameEngine.applyGameData = function (...args) {
        const r = origApplyData.apply(this, args);
        if (typeof BeastSystem !== 'undefined') BeastSystem.ensureExtraPools?.(this.data);
        return r;
      };
      GameEngine._transformApplyDataWrapped = true;
    }

    GameEngine._transformHooksInstalled = true;
    return true;
  }

  if (!installTransformHooks()) {
    document.addEventListener('DOMContentLoaded', installTransformHooks);
  }
})();
