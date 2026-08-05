// ============================================
// Концентрация в бою + делегирование статусов в StatusManager
// ============================================

(function attachCombatEffects() {
  function attach() {
    if (typeof GameEngine === 'undefined') return false;
    if (typeof StatusManager === 'undefined') {
      console.warn('combat-effects.js: StatusManager не загружен');
      return false;
    }

  Object.assign(GameEngine, {
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
          const spec = eff.addEffect || eff.statusEffect || eff.statusId;
          const effectId = typeof spec === 'string' ? spec : spec?.id;
          const scope = eff.targeting?.scope || 'single';
          if (scope === 'self') return { ...base, cleanup: 'playerStatus', effectId };
          return { ...base, cleanup: 'enemyStatus', effectId };
        }
      }

      if (Array.isArray(effects)) {
        const statusFx = effects.find((e) => e?.type === 'apply_status');
        if (statusFx) {
          const spec = statusFx.addEffect || statusFx.statusEffect || statusFx.statusId;
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
      const enemy = this.state.enemies.find((e) => {
        if (e.hp <= 0) return false;
        return (e.effects || []).some((fx) => fx.id === meta.effectId);
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
          const inst = h?.effects?.find((e) => e.id === conc.effectId);
          if (inst) StatusManager.remove(this, h, inst);
          break;
        }
        case 'enemyStatus': {
          const enemy = this.state.enemies.find(
            (e) =>
              (conc.enemyId && e.id === conc.enemyId) ||
              (conc.enemyName && e.name === conc.enemyName) ||
              (e.effects || []).some((fx) => fx.id === conc.effectId)
          );
          if (enemy) {
            const h = this.getEnemyEffectHolder(enemy);
            const inst = h?.effects?.find((e) => e.id === conc.effectId);
            if (inst) StatusManager.remove(this, h, inst);
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
          this.state.combat.tempAcBonus = Math.max(
            0,
            (this.state.combat.tempAcBonus || 0) - (value || 0)
          );
          break;
        case 'playerStatus': {
          const h = this.getPlayerEffectHolder();
          const inst = h?.effects?.find((e) => e.id === effectId);
          if (inst) StatusManager.remove(this, h, inst, true);
          break;
        }
        case 'enemyStatus': {
          const enemy = this.state.enemies.find(
            (e) => (enemyId && e.id === enemyId) || (enemyName && e.name === enemyName)
          );
          if (enemy) {
            const h = this.getEnemyEffectHolder(enemy);
            const inst = h?.effects?.find((e) => e.id === effectId);
            if (inst) StatusManager.remove(this, h, inst, true);
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
      const advantage =
        typeof this.hasFocusPotionAdvantage === 'function' && this.hasFocusPotionAdvantage();
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

    executeAbilityEffect(effect, target = null) {
      return this.applyEffect(effect, target);
    },

    getEffectivePlayerAC() {
      if (typeof this.isInWildShape === 'function' && this.isInWildShape()) {
        const beast = typeof this.getActiveBeast === 'function' ? this.getActiveBeast() : null;
        if (beast) {
          let ac = parseInt(beast.ac, 10) || 10;
          if (this.state.combat) {
            const c = this.state.combat;
            if (c.shieldBlock) ac += 4;
            ac += c.tempAcBonus || 0;
            ac += c.effectAcMod || 0;
            ac += StatusManager.getHolderAcBonus(this.getPlayerEffectHolder());
          }
          return ac;
        }
      }
      let ac = this.state.classData?.ac;
      if (ac == null && typeof this.recalcDerivedStats === 'function') {
        this.recalcDerivedStats();
        ac = this.state.classData?.ac;
      }
      if (ac == null) {
        ac = typeof this.computePlayerAC === 'function' ? this.computePlayerAC() : 10;
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
      ac += StatusManager.getHolderAcBonus(this.getPlayerEffectHolder());
      return ac;
    },

    getEffectivePlayerAtkBonus() {
      if (typeof this.isInWildShape === 'function' && this.isInWildShape()) {
        const beast = typeof this.getActiveBeast === 'function' ? this.getActiveBeast() : null;
        if (beast) {
          let atk = parseInt(beast.atkBonus, 10) || 0;
          if (this.state.combat) {
            atk += this.state.combat.tempAtkBonus || 0;
            atk += this.state.combat.effectAtkMod || 0;
          }
          return atk;
        }
      }
      const cd = this.state.classData || {};
      let atk = cd.atkBonus ?? 0;
      if (this.state.combat) {
        atk += this.state.combat.tempAtkBonus || 0;
        atk += this.state.combat.effectAtkMod || 0;
      }
      return atk;
    },

    getEffectiveEnemyAC(enemy) {
      const base = enemy?.ac ?? 10;
      const holder = this.getEnemyEffectHolder(enemy);
      return base + StatusManager.getHolderAcBonus(holder);
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
