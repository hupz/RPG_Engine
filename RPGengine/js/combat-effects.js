// ============================================
// Статус-эффекты в бою (буффы / дебаффы)
// ============================================

(function attachCombatEffects() {
  function attach() {
    if (typeof GameEngine === 'undefined') return false;

  const DEFAULT_STATUS_EFFECTS = {
    poison: { id: 'poison', label: 'Яд', type: 'dot', value: '1d4', attribute: 'hp' },
    bleed: { id: 'bleed', label: 'Кровотечение', type: 'dot', value: '1d6', attribute: 'hp' },
    regen: { id: 'regen', label: 'Регенерация', type: 'hot', value: '1d4', attribute: 'hp' },
    weakened: { id: 'weakened', label: 'Ослабление', type: 'stat_mod', attribute: 'atkBonus', value: -2 },
    fortified: { id: 'fortified', label: 'Укрепление', type: 'stat_mod', attribute: 'ac', value: 2 },
    stun: { id: 'stun', label: 'Оглушение', type: 'stun', duration: 1 }
  };

  Object.assign(GameEngine, {
    /** Каталог эффектов из game_data + дефолты */
    getStatusEffectCatalog() {
      return { ...DEFAULT_STATUS_EFFECTS, ...(this.data?.statusEffects || {}) };
    },

    normalizeStatusEffect(raw) {
      const catalog = this.getStatusEffectCatalog();
      const base = typeof raw === 'string' ? catalog[raw] || { id: raw } : { ...(catalog[raw?.id] || {}), ...raw };
      const id = base.id || raw?.id || 'unknown';
      const fromCat = catalog[id] || {};
      const merged = { ...fromCat, ...base, id };
      return {
        id,
        label: merged.label || id,
        type: merged.type || 'dot',
        duration: Math.max(1, parseInt(merged.duration, 10) || 1),
        value: merged.value != null ? String(merged.value) : '',
        attribute: merged.attribute || 'hp'
      };
    },

    ensureCombatEffectsState() {
      if (this.state.combat && !Array.isArray(this.state.combat.effects)) {
        this.state.combat.effects = [];
      }
      (this.state.enemies || []).forEach(e => {
        if (!Array.isArray(e.effects)) e.effects = [];
      });
    },

    getPlayerEffectHolder() {
      this.ensureCombatEffectsState();
      return {
        kind: 'player',
        name: this.state.charName || 'Герой',
        effects: this.state.combat.effects,
        ref: this.state.combat
      };
    },

    getEnemyEffectHolder(enemy) {
      if (!enemy) return null;
      if (!Array.isArray(enemy.effects)) enemy.effects = [];
      return { kind: 'enemy', name: enemy.name, effects: enemy.effects, ref: enemy };
    },

    /** Наложение эффекта: один id — обновление duration (без бесконечного стака) */
    applyStatusEffect(holder, rawEffect, sourceLabel) {
      if (!holder?.effects) return null;
      const norm = this.normalizeStatusEffect(rawEffect);
      const existing = holder.effects.find(e => e.id === norm.id);

      if (existing) {
        existing.duration = Math.max(existing.duration, norm.duration);
        existing.label = norm.label;
        if (norm.value) existing.value = norm.value;
        if (norm.type) existing.type = norm.type;
        if (norm.attribute) existing.attribute = norm.attribute;
        this.log(
          `${holder.name}: ${norm.label} (${existing.duration} ход.)${sourceLabel ? ' — ' + sourceLabel : ''}`,
          'log-dice'
        );
        return existing;
      }

      const inst = {
        id: norm.id,
        label: norm.label,
        type: norm.type,
        duration: norm.duration,
        value: norm.value,
        attribute: norm.attribute,
        _statApplied: false
      };

      holder.effects.push(inst);
      if (inst.type === 'stat_mod') this.applyStatusStatMod(holder, inst, 1);

      this.log(
        `${holder.name} получает «${inst.label}» (${inst.duration} ход.)${sourceLabel ? ' — ' + sourceLabel : ''}`,
        inst.type === 'hot' ? 'log-heal' : inst.type === 'stun' ? 'log-combat' : 'log-damage'
      );
      return inst;
    },

    applyStatusStatMod(holder, inst, sign) {
      const attr = (inst.attribute || 'ac').toLowerCase();
      const val = parseInt(inst.value, 10) || 0;
      if (!val) return;
      const delta = val * sign;

      if (holder.kind === 'player') {
        if (!this.state.combat) return;
        if (attr === 'ac') {
          this.state.combat.effectAcMod = (this.state.combat.effectAcMod || 0) + delta;
        } else if (attr === 'atkbonus' || attr === 'atk') {
          this.state.combat.effectAtkMod = (this.state.combat.effectAtkMod || 0) + delta;
        }
        inst._statApplied = sign > 0;
        return;
      }

      const enemy = holder.ref;
      if (!enemy) return;
      if (attr === 'ac') {
        if (enemy._baseAc == null) enemy._baseAc = enemy.ac;
        enemy._effectAcMod = (enemy._effectAcMod || 0) + delta;
        enemy.ac = enemy._baseAc + enemy._effectAcMod;
      } else if (attr === 'atkbonus' || attr === 'atk') {
        if (enemy._baseAtkBonus == null) enemy._baseAtkBonus = enemy.atkBonus || 0;
        enemy._effectAtkMod = (enemy._effectAtkMod || 0) + delta;
        enemy.atkBonus = enemy._baseAtkBonus + enemy._effectAtkMod;
      }
      inst._statApplied = sign > 0;
    },

    removeStatusEffect(holder, inst) {
      if (!holder?.effects || !inst) return;
      if (inst.type === 'stat_mod' && inst._statApplied) {
        this.applyStatusStatMod(holder, inst, -1);
      }
      holder.effects = holder.effects.filter(e => e !== inst);
      this.maybeEndConcentrationFromStatusRemoval(holder, inst);
    },

    isConcentratingCleanup(cleanup) {
      return this.state.combat?.concentration?.cleanup === cleanup;
    },

    resolveConcentrationMeta(ability) {
      if (!ability) return null;
      const base = {
        id: ability.id,
        label: ability.name || ability.id
      };
      const eff = ability.effect;
      const effects = ability.effects;

      if (typeof eff === 'string') {
        if (eff === 'ac_bonus:2') return { ...base, cleanup: 'shieldOfFaith' };
        if (eff.startsWith('ac_bonus:')) {
          const v = parseInt(eff.split(':')[1], 10) || 0;
          if (v === 4) return { ...base, cleanup: 'shieldBlock' };
          if (v === 5) return { ...base, cleanup: 'shieldSpell' };
          return { ...base, cleanup: 'tempAcBonus', value: v };
        }
      }

      if (eff && typeof eff === 'object') {
        if (eff.type === 'buff' && eff.buffType === 'ac') {
          const v = parseInt(eff.value, 10) || 0;
          if (v === 5) return { ...base, cleanup: 'shieldSpell' };
          if (v === 2) return { ...base, cleanup: 'shieldOfFaith' };
          return { ...base, cleanup: 'tempAcBonus', value: v };
        }
        if (eff.type === 'apply_status') {
          const spec = eff.addEffect || eff.statusEffect;
          const effectId = typeof spec === 'string' ? spec : spec?.id;
          const scope = eff.targeting?.scope || 'single';
          if (scope === 'self') return { ...base, cleanup: 'playerStatus', effectId };
          return { ...base, cleanup: 'enemyStatus', effectId };
        }
      }

      if (Array.isArray(effects)) {
        const statusFx = effects.find(e => e?.type === 'apply_status');
        if (statusFx) {
          const spec = statusFx.addEffect || statusFx.statusEffect;
          const effectId = typeof spec === 'string' ? spec : spec?.id;
          const scope = statusFx.targeting?.scope || 'single';
          if (scope === 'self') return { ...base, cleanup: 'playerStatus', effectId };
          return { ...base, cleanup: 'enemyStatus', effectId };
        }
      }

      return { ...base, cleanup: 'generic' };
    },

    attachEnemyConcentrationTarget(meta) {
      if (meta.cleanup !== 'enemyStatus' || !meta.effectId) return meta;
      const enemy = this.state.enemies.find(e => {
        if (e.hp <= 0) return false;
        return (e.effects || []).some(fx => fx.id === meta.effectId);
      });
      if (enemy) {
        meta.enemyId = enemy.id;
        meta.enemyName = enemy.name;
      }
      return meta;
    },

    endConcentration(reason) {
      const combat = this.state.combat;
      const conc = combat?.concentration;
      if (!conc) return;

      switch (conc.cleanup) {
        case 'shieldOfFaith':
          combat.shieldOfFaith = false;
          break;
        case 'shieldSpell':
          combat.shieldSpell = false;
          break;
        case 'shieldBlock':
          combat.shieldBlock = false;
          break;
        case 'tempAcBonus':
          combat.tempAcBonus = Math.max(0, (combat.tempAcBonus || 0) - (conc.value || 0));
          break;
        case 'playerStatus': {
          const h = this.getPlayerEffectHolder();
          const inst = h?.effects?.find(e => e.id === conc.effectId);
          if (inst) {
            if (inst.type === 'stat_mod' && inst._statApplied) {
              this.applyStatusStatMod(h, inst, -1);
            }
            h.effects = h.effects.filter(e => e !== inst);
          }
          break;
        }
        case 'enemyStatus': {
          const enemy = this.state.enemies.find(e =>
            (conc.enemyId && e.id === conc.enemyId)
            || (conc.enemyName && e.name === conc.enemyName)
            || (e.effects || []).some(fx => fx.id === conc.effectId)
          );
          if (enemy) {
            const h = this.getEnemyEffectHolder(enemy);
            const inst = h?.effects?.find(e => e.id === conc.effectId);
            if (inst) {
              if (inst.type === 'stat_mod' && inst._statApplied) {
                this.applyStatusStatMod(h, inst, -1);
              }
              h.effects = h.effects.filter(e => e !== inst);
            }
          }
          break;
        }
        default:
          break;
      }

      combat.concentration = null;

      if (reason === 'failed') {
        this.log('Концентрация потеряна!', 'log-damage');
      } else if (reason === 'replaced') {
        this.log(`Концентрация на «${conc.label}» прервана новым заклинанием.`, 'log-dice');
      } else if (reason === 'ended') {
        this.log(`Концентрация на «${conc.label}» прекращена.`, 'log-dice');
      }

      if (reason !== 'silent') this.renderCombat();
    },

    beginConcentration(ability) {
      if (!this.state.combat || !this.isConcentrationAbility?.(ability)) return;
      if (this.state.combat.concentration) {
        this.endConcentration('replaced');
      }
      let meta = this.resolveConcentrationMeta(ability);
      meta = this.attachEnemyConcentrationTarget(meta);
      this.state.combat.concentration = meta;
      this.log(`🧠 Концентрация: ${meta.label}`, 'log-info');
      this.renderCombat();
    },

    clearCombatConcentration(silent) {
      if (!this.state.combat?.concentration) return;
      const conc = this.state.combat.concentration;
      const cleanup = conc.cleanup;
      const effectId = conc.effectId;
      const value = conc.value;
      const enemyId = conc.enemyId;
      const enemyName = conc.enemyName;

      switch (cleanup) {
        case 'shieldOfFaith':
          this.state.combat.shieldOfFaith = false;
          break;
        case 'shieldSpell':
          this.state.combat.shieldSpell = false;
          break;
        case 'shieldBlock':
          this.state.combat.shieldBlock = false;
          break;
        case 'tempAcBonus':
          this.state.combat.tempAcBonus = Math.max(0, (this.state.combat.tempAcBonus || 0) - (value || 0));
          break;
        case 'playerStatus': {
          const h = this.getPlayerEffectHolder();
          const inst = h?.effects?.find(e => e.id === effectId);
          if (inst) {
            if (inst.type === 'stat_mod' && inst._statApplied) this.applyStatusStatMod(h, inst, -1);
            h.effects = h.effects.filter(e => e !== inst);
          }
          break;
        }
        case 'enemyStatus': {
          const enemy = this.state.enemies.find(e =>
            (enemyId && e.id === enemyId)
            || (enemyName && e.name === enemyName)
          );
          if (enemy) {
            const h = this.getEnemyEffectHolder(enemy);
            const inst = h?.effects?.find(e => e.id === effectId);
            if (inst) {
              if (inst.type === 'stat_mod' && inst._statApplied) this.applyStatusStatMod(h, inst, -1);
              h.effects = h.effects.filter(e => e !== inst);
            }
          }
          break;
        }
        default:
          break;
      }

      this.state.combat.concentration = null;
      if (!silent && conc.label) {
        this.log(`Концентрация на «${conc.label}» рассеялась с окончанием боя.`, 'log-dice');
      }
    },

    checkConcentrationAfterDamage(damage) {
      const conc = this.state.combat?.concentration;
      if (!conc) return;

      const dc = Math.max(10, Math.floor((Number(damage) || 0) / 2));
      const conScore = this.state.classData?.stats?.con ?? this.state.stats?.con ?? 10;
      const mod = this.getModifier(conScore);
      const r1 = this.d20();
      const advantage = typeof this.hasFocusPotionAdvantage === 'function' && this.hasFocusPotionAdvantage();
      const r2 = advantage ? this.d20() : null;
      const picked = r2 != null ? Math.max(r1, r2) : r1;
      const roll = picked + mod;

      if (advantage) {
        this.log(`🧿 Преимущество (фокус): к20 ${r1}, ${r2} → ${picked}`, 'log-dice');
      }

      if (roll < dc) {
        this.endConcentration('failed');
      } else {
        this.log(`🧠 Концентрация (${conc.label}): ${roll} vs ${dc} — удержана`, 'log-dice');
      }
    },

    maybeEndConcentrationFromStatusRemoval(holder, inst) {
      const conc = this.state.combat?.concentration;
      if (!conc || !inst) return;
      if (conc.cleanup === 'playerStatus' && holder?.kind === 'player' && inst.id === conc.effectId) {
        this.state.combat.concentration = null;
        this.log(`Концентрация на «${conc.label}» прекращена.`, 'log-dice');
        this.renderCombat();
        return;
      }
      if (conc.cleanup === 'enemyStatus' && holder?.kind === 'enemy' && inst.id === conc.effectId) {
        this.state.combat.concentration = null;
        this.log(`Концентрация на «${conc.label}» прекращена.`, 'log-dice');
        this.renderCombat();
      }
    },

    /**
     * Начало хода: dot/hot, затем тик duration, снятие stat_mod.
     * @returns {{ skipTurn: boolean }}
     */
    processEffects(holder) {
      if (!holder?.effects?.length) return { skipTurn: false };

      const wasStunned = holder.effects.some(e => e.type === 'stun' && e.duration > 0);

      holder.effects.forEach(inst => {
        if (inst.type === 'dot' && (inst.attribute || 'hp') === 'hp') {
          const dmg = this.parseRoll(inst.value || '1');
          if (holder.kind === 'player') {
            this.takeDamage(dmg);
            this.log(`☠️ ${holder.name} получает ${dmg} урона от «${inst.label}»`, 'log-damage');
          } else if (holder.ref) {
            holder.ref.hp -= dmg;
            this.log(`☠️ ${holder.name} получает ${dmg} урона от «${inst.label}»`, 'log-damage');
          }
        } else if (inst.type === 'hot' && (inst.attribute || 'hp') === 'hp') {
          const amt = this.parseRoll(inst.value || '1');
          if (holder.kind === 'player') {
            this.state.hp = Math.min(this.state.maxHp, this.state.hp + amt);
            this.log(`💚 ${holder.name} восстанавливает ${amt} ОЗ («${inst.label}»)`, 'log-heal');
          } else if (holder.ref) {
            holder.ref.hp = Math.min(holder.ref.maxHp, holder.ref.hp + amt);
            this.log(`💚 ${holder.name} восстанавливает ${amt} ОЗ («${inst.label}»)`, 'log-heal');
          }
        }
      });

      const expired = [];
      holder.effects.forEach(inst => {
        inst.duration -= 1;
        if (inst.duration <= 0) expired.push(inst);
      });
      expired.forEach(inst => {
        this.log(`«${inst.label}» на ${holder.name} закончился`, 'log-dice');
        this.removeStatusEffect(holder, inst);
      });

      this.updateStats();
      return { skipTurn: wasStunned };
    },

    /** Цели для addEffect из способности */
    resolveStatusEffectTargets(effectWrapper, explicitEnemy) {
      const scope = effectWrapper?.targeting?.scope
        || effectWrapper?.target
        || (effectWrapper?.addEffect?.target === 'self' ? 'self' : null)
        || 'single';
      const targets = [];

      if (scope === 'self' || effectWrapper?.addEffect?.target === 'self') {
        const p = this.getPlayerEffectHolder();
        if (p) targets.push(p);
        return targets;
      }

      if (scope === 'all_enemies' || effectWrapper?.allTargets) {
        this.state.enemies.filter(e => e.hp > 0).forEach(e => {
          const h = this.getEnemyEffectHolder(e);
          if (h) targets.push(h);
        });
        return targets;
      }

      if (explicitEnemy) {
        const h = this.getEnemyEffectHolder(explicitEnemy);
        if (h) targets.push(h);
        return targets;
      }

      const first = this.state.enemies.find(e => e.hp > 0);
      if (first) {
        const h = this.getEnemyEffectHolder(first);
        if (h) targets.push(h);
      }
      return targets;
    },

    applyAbilityAddEffect(effectWrapper, explicitTarget) {
      const spec = effectWrapper?.addEffect || effectWrapper?.statusEffect;
      if (!spec) return;
      const label = this._abilitySoundCtx?.name || 'умение';
      const targets = this.resolveStatusEffectTargets(effectWrapper, explicitTarget);
      targets.forEach(holder => this.applyStatusEffect(holder, spec, label));
      this.renderCombat();
    },

    /** Алиас из ТЗ */
    executeAbilityEffect(effect, target = null) {
      return this.applyEffect(effect, target);
    },

    getEffectivePlayerAC() {
      // classData.ac уже включает броню, щит, заточку и пассивные умения (recalcDerivedStats)
      let ac = this.state.classData?.ac;
      if (ac == null && typeof this.recalcDerivedStats === 'function') {
        this.recalcDerivedStats();
        ac = this.state.classData?.ac;
      }
      if (ac == null) {
        ac = typeof this.computePlayerAC === 'function'
          ? this.computePlayerAC()
          : 10;
        const equip = this.collectEquipmentBonuses?.() || {};
        const passive = this.collectPassiveAbilityBonuses?.() || {};
        ac += (equip.acBonus || 0) + (passive.acBonus || 0);
      }
      if (!this.state.combat) return ac;
      const c = this.state.combat;
      if (c.shieldBlock) ac += 4;
      if (c.shieldOfFaith) ac += 2;
      ac += c.tempAcBonus || 0;
      ac += c.effectAcMod || 0;
      return ac;
    },

    getEffectivePlayerAtkBonus() {
      const cd = this.state.classData || {};
      let atk = cd.atkBonus ?? 0;
      if (this.state.combat) {
        atk += this.state.combat.tempAtkBonus || 0;
        atk += this.state.combat.effectAtkMod || 0;
      }
      return atk;
    },

    getEffectiveEnemyAC(enemy) {
      return enemy?.ac ?? 10;
    },

    renderStatusEffectsHtml(effects) {
      if (!effects?.length) return '';
      return effects
        .map(e => {
          const turns = e.duration > 0 ? ` ${e.duration}х` : '';
          const cls = `combat-effect-badge combat-effect-${this.escapeAttr(e.type)}`;
          return `<span class="${cls}" title="${this.escapeAttr(e.label)} (${e.type})">${this.escapeHtml(e.label)}${turns}</span>`;
        })
        .join('');
    }
  });
    return true;
  }

  if (!attach()) {
    document.addEventListener('DOMContentLoaded', () => {
      if (!attach()) console.error('combat-effects.js: GameEngine не определён');
    });
  }
})();
