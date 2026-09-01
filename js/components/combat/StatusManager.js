/**
 * StatusManager — временные состояния в бою (data-driven из statusEffects JSON).
 * @module StatusManager
 */
(function (global) {
  'use strict';

  /** Встроенные дефолты; переопределяются и дополняются через game_data.statusEffects */
  const BUILTIN_STATUSES = {
    surprised: {
      id: 'surprised',
      label: 'Врасплох',
      icon: '😵',
      description: 'Не может действовать: пропуск хода.',
      behavior: 'skip_turn',
      category: 'condition',
      duration: 1,
      color: 'amber'
    },
    flanking: {
      id: 'flanking',
      label: 'Фланг',
      icon: '⊞',
      description: 'Атаки с обеих зон — преимущество или бонус к атаке.',
      behavior: 'marker',
      category: 'position',
      duration: 1,
      color: 'teal'
    },
    prone: {
      id: 'prone',
      label: 'Сбит с ног',
      icon: '⬇️',
      description: 'Атаки по цели с преимуществом; вставание — половина скорости.',
      behavior: 'prone',
      category: 'condition',
      duration: 2,
      color: 'brown'
    },
    covered: {
      id: 'covered',
      label: 'Укрытие',
      icon: '🛡️',
      description: '+2 к КД от дистанционных атак.',
      behavior: 'ac_mod',
      value: 2,
      attribute: 'ac',
      category: 'defense',
      duration: 3,
      color: 'steel'
    },
    advantage: {
      id: 'advantage',
      label: 'Преимущество',
      icon: '▲',
      description: 'Бросок к20 дважды, берётся лучший.',
      behavior: 'roll_mod',
      grants: { advantage: true },
      category: 'buff',
      duration: 1,
      color: 'gold'
    },
    disadvantage: {
      id: 'disadvantage',
      label: 'Помеха',
      icon: '▼',
      description: 'Бросок к20 дважды, берётся худший.',
      behavior: 'roll_mod',
      grants: { disadvantage: true },
      category: 'debuff',
      duration: 1,
      color: 'slate'
    },
    burning: {
      id: 'burning',
      label: 'Горение',
      icon: '🔥',
      description: 'Урон огнём в начале хода.',
      behavior: 'dot',
      value: '1d6',
      attribute: 'hp',
      category: 'dot',
      duration: 2,
      color: 'fire'
    },
    poison: {
      id: 'poison',
      label: 'Отравление',
      icon: '☠️',
      description: 'Урон ядом в начале хода.',
      behavior: 'dot',
      value: '1d4',
      attribute: 'hp',
      category: 'dot',
      duration: 3,
      color: 'poison'
    },
    poisoned: {
      id: 'poisoned',
      label: 'Отравлен',
      icon: '☠️',
      description: 'Урон ядом в начале хода.',
      behavior: 'dot',
      value: '1d4',
      attribute: 'hp',
      category: 'dot',
      duration: 3,
      color: 'poison'
    },
    bleed: {
      id: 'bleed',
      label: 'Кровотечение',
      icon: '🩸',
      description: 'Урон в начале хода.',
      behavior: 'dot',
      value: '1d6',
      attribute: 'hp',
      category: 'dot',
      duration: 2,
      color: 'crimson'
    },
    regen: {
      id: 'regen',
      label: 'Регенерация',
      icon: '💚',
      description: 'Восстановление ОЗ в начале хода.',
      behavior: 'hot',
      value: '1d4',
      attribute: 'hp',
      category: 'hot',
      duration: 3,
      color: 'green'
    },
    stun: {
      id: 'stun',
      label: 'Оглушение',
      icon: '💫',
      description: 'Пропуск хода.',
      behavior: 'skip_turn',
      category: 'condition',
      duration: 1,
      color: 'violet'
    },
    stunned: {
      id: 'stunned',
      label: 'Оглушён',
      icon: '💫',
      description: 'Пропуск хода.',
      behavior: 'skip_turn',
      category: 'condition',
      duration: 1,
      color: 'violet'
    },
    weakened: {
      id: 'weakened',
      label: 'Ослабление',
      icon: '📉',
      description: 'Штраф к атаке.',
      behavior: 'stat_mod',
      attribute: 'atkBonus',
      value: -2,
      category: 'debuff',
      duration: 2,
      color: 'slate'
    },
    fortified: {
      id: 'fortified',
      label: 'Укрепление',
      icon: '🛡️',
      description: 'Бонус к КД.',
      behavior: 'stat_mod',
      attribute: 'ac',
      value: 2,
      category: 'buff',
      duration: 2,
      color: 'steel'
    }
  };

  const SKIP_BEHAVIORS = new Set(['skip_turn', 'stun']);

  function escapeAttr(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function logStatus(engine, type, message, extra = {}) {
    if (typeof CombatLog !== 'undefined') {
      CombatLog.log(engine, type, { message, ...extra });
      return;
    }
    const legacy = {
      heal: 'log-heal',
      effect: 'log-combat',
      status: 'log-combat',
      damage: 'log-damage'
    };
    engine?.log?.(message, legacy[type] || 'log-dice');
  }

  class StatusManagerClass {
    getCatalog(engine) {
      const data = engine?.data?.statusEffects || {};
      return { ...BUILTIN_STATUSES, ...data };
    }

    getDefinition(id, engine) {
      const catalog = this.getCatalog(engine);
      return catalog[id] || null;
    }

    /**
     * Нормализация спецификации статуса (строка id или объект).
     */
    normalize(raw, engine) {
      const catalog = this.getCatalog(engine);
      const base =
        typeof raw === 'string'
          ? { id: raw, ...(catalog[raw] || {}) }
          : { ...(catalog[raw?.id || raw?.statusId || raw?.status] || {}), ...raw };

      const id =
        base.id ||
        base.statusId ||
        base.status ||
        (typeof raw === 'string' ? raw : 'unknown');

      const fromCat = catalog[id] || {};
      const merged = { ...fromCat, ...base, id };

      const behavior =
        merged.behavior || merged.type || (SKIP_BEHAVIORS.has(merged.type) ? 'skip_turn' : merged.type) || 'marker';

      let duration = merged.duration;
      if (duration === 'turn' || duration === 'round') duration = 1;
      if (duration == null || duration === '') duration = 1;
      duration = Math.max(0, parseInt(duration, 10) || 1);

      return {
        id,
        label: merged.label || id,
        icon: merged.icon || '✨',
        description: merged.description || merged.desc || merged.label || id,
        behavior,
        category: merged.category || 'effect',
        duration,
        value: merged.value != null ? String(merged.value) : '',
        attribute: merged.attribute || 'hp',
        grants: merged.grants || null,
        color: merged.color || 'default',
        stacks: !!merged.stacks
      };
    }

    ensureState(engine) {
      if (engine.state.combat && !Array.isArray(engine.state.combat.effects)) {
        engine.state.combat.effects = [];
      }
      (engine.state.enemies || []).forEach((e) => {
        if (!Array.isArray(e.effects)) e.effects = [];
      });
    }

    getPlayerHolder(engine) {
      this.ensureState(engine);
      return {
        kind: 'player',
        name: engine.state.charName || 'Герой',
        effects: engine.state.combat?.effects || [],
        ref: engine.state.combat
      };
    }

    getEnemyHolder(engine, enemy) {
      if (!enemy) return null;
      this.ensureState(engine);
      if (!Array.isArray(enemy.effects)) enemy.effects = [];
      return {
        kind: 'enemy',
        name: enemy.name,
        effects: enemy.effects,
        ref: enemy,
        enemyIndex: (engine.state.enemies || []).indexOf(enemy)
      };
    }

    hasStatus(holder, statusId) {
      return (holder?.effects || []).some(
        (e) => e.id === statusId && (e.duration == null || e.duration > 0)
      );
    }

    syncPlayerSurprisedFlag(engine) {
      if (!engine.state?.combat) return;
      const surprised = this.hasStatus(this.getPlayerHolder(engine), 'surprised');
      engine.state.combat.playerSurprised = surprised;
    }

    applyStatMod(engine, holder, inst, sign) {
      const attr = (inst.attribute || 'ac').toLowerCase();
      const val = parseInt(inst.value, 10) || 0;
      if (!val) return;
      const delta = val * sign;

      if (holder.kind === 'player') {
        if (!engine.state.combat) return;
        if (attr === 'ac') {
          engine.state.combat.effectAcMod = (engine.state.combat.effectAcMod || 0) + delta;
        } else if (attr === 'atkbonus' || attr === 'atk') {
          engine.state.combat.effectAtkMod = (engine.state.combat.effectAtkMod || 0) + delta;
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
    }

    /**
     * Наложение статуса на участника.
     * @returns {object|null} instance
     */
    apply(engine, holder, raw, sourceLabel) {
      if (!holder?.effects) return null;
      const norm = this.normalize(raw, engine);
      const existing = holder.effects.find((e) => e.id === norm.id);

      if (existing && !norm.stacks) {
        existing.duration = Math.max(existing.duration, norm.duration);
        existing.label = norm.label;
        existing.icon = norm.icon;
        existing.description = norm.description;
        existing.behavior = norm.behavior;
        existing.color = norm.color;
        if (norm.value) existing.value = norm.value;
        if (norm.grants) existing.grants = norm.grants;
        logStatus(
          engine,
          'status',
          `${holder.name}: «${norm.label}» (${existing.duration} раунд.)${sourceLabel ? ' — ' + sourceLabel : ''}`,
          { target: holder.name }
        );
        if (norm.id === 'surprised' && holder.kind === 'player') {
          this.syncPlayerSurprisedFlag(engine);
        }
        return existing;
      }

      const inst = {
        id: norm.id,
        label: norm.label,
        icon: norm.icon,
        description: norm.description,
        behavior: norm.behavior,
        category: norm.category,
        duration: norm.duration,
        value: norm.value,
        attribute: norm.attribute,
        grants: norm.grants,
        color: norm.color,
        source: sourceLabel || null,
        _statApplied: false
      };

      holder.effects.push(inst);

      if (inst.behavior === 'stat_mod' || inst.behavior === 'ac_mod') {
        this.applyStatMod(engine, holder, inst, 1);
      }

      const logType =
        inst.behavior === 'hot' ? 'heal' : inst.behavior === 'dot' ? 'damage' : 'status';
      logStatus(
        engine,
        logType,
        `${holder.name} получает «${inst.label}» (${inst.duration} раунд.)${sourceLabel ? ' — ' + sourceLabel : ''}`,
        { target: holder.name, important: SKIP_BEHAVIORS.has(inst.behavior) }
      );

      if (inst.id === 'surprised' && holder.kind === 'player') {
        this.syncPlayerSurprisedFlag(engine);
      }

      engine.playCombatSound?.('buff');
      return inst;
    }

    remove(engine, holder, instOrId, silent) {
      if (!holder?.effects) return;
      const inst =
        typeof instOrId === 'string'
          ? holder.effects.find((e) => e.id === instOrId)
          : instOrId;
      if (!inst) return;

      if (
        (inst.behavior === 'stat_mod' || inst.behavior === 'ac_mod') &&
        inst._statApplied
      ) {
        this.applyStatMod(engine, holder, inst, -1);
      }

      holder.effects = holder.effects.filter((e) => e !== inst);

      if (inst.id === 'surprised' && holder.kind === 'player') {
        this.syncPlayerSurprisedFlag(engine);
      }

      engine.maybeEndConcentrationFromStatusRemoval?.(holder, inst);

      if (!silent) {
        logStatus(engine, 'effect', `«${inst.label}» на ${holder.name} закончился`, {
          target: holder.name
        });
      }
    }

    /** Начало хода: DoT/HoT и проверка пропуска */
    processTurnStart(engine, holder) {
      if (!holder?.effects?.length) return { skipTurn: false };

      const skipTurn = holder.effects.some(
        (e) =>
          (e.duration == null || e.duration > 0) &&
          (SKIP_BEHAVIORS.has(e.behavior) || e.behavior === 'stun')
      );

      holder.effects.forEach((inst) => {
        if (inst.duration != null && inst.duration <= 0) return;

        if (inst.behavior === 'dot' && (inst.attribute || 'hp') === 'hp') {
          const dmg = engine.parseRoll(inst.value || '1');
          if (holder.kind === 'player') {
            engine.takeDamage(dmg);
            logStatus(
              engine,
              'damage',
              `☠️ ${holder.name}: ${dmg} урона от «${inst.label}»`,
              { target: holder.name, amount: dmg }
            );
          } else if (holder.ref) {
            holder.ref.hp -= dmg;
            logStatus(
              engine,
              'damage',
              `☠️ ${holder.name}: ${dmg} урона от «${inst.label}»`,
              { target: holder.name, amount: dmg }
            );
          }
        } else if (inst.behavior === 'hot' && (inst.attribute || 'hp') === 'hp') {
          const amt = engine.parseRoll(inst.value || '1');
          if (holder.kind === 'player') {
            engine.state.hp = Math.min(engine.state.maxHp, engine.state.hp + amt);
            logStatus(
              engine,
              'heal',
              `💚 ${holder.name}: +${amt} ОЗ («${inst.label}»)`,
              { target: holder.name, amount: amt }
            );
          } else if (holder.ref) {
            holder.ref.hp = Math.min(holder.ref.maxHp, holder.ref.hp + amt);
            logStatus(
              engine,
              'heal',
              `💚 ${holder.name}: +${amt} ОЗ («${inst.label}»)`,
              { target: holder.name, amount: amt }
            );
          }
        }
      });

      engine.updateStats?.();
      return { skipTurn };
    }

    /** Конец раунда: тик длительности у всех участников */
    tickRoundEnd(engine) {
      if (!engine.state?.combat) return;
      const holders = [this.getPlayerHolder(engine)];
      (engine.state.enemies || [])
        .filter((e) => e.hp > 0)
        .forEach((e) => {
          const h = this.getEnemyHolder(engine, e);
          if (h) holders.push(h);
        });

      holders.forEach((holder) => {
        if (!holder?.effects?.length) return;
        const expired = [];
        holder.effects.forEach((inst) => {
          if (inst.duration == null) return;
          inst.duration -= 1;
          if (inst.duration <= 0) expired.push(inst);
        });
        expired.forEach((inst) => this.remove(engine, holder, inst));
      });

      this.syncFlankingMarkers(engine);
      engine.updateStats?.();
      engine.renderCombat?.();
    }

    /** Синхронизация визуального статуса «Фланг» с CombatPosition */
    syncFlankingMarkers(engine) {
      if (typeof CombatPosition === 'undefined' || !CombatPosition.isEnabled(engine)) {
        return;
      }
      (engine.state.enemies || []).forEach((enemy, idx) => {
        if (enemy.hp <= 0) return;
        const holder = this.getEnemyHolder(engine, enemy);
        if (!holder) return;
        const flanked = CombatPosition.hasFlankingOnEnemy(engine, idx);
        const has = this.hasStatus(holder, 'flanking');
        if (flanked && !has) {
          this.apply(engine, holder, { id: 'flanking', duration: 1 }, 'фланг');
        } else if (!flanked && has) {
          this.remove(engine, holder, 'flanking', true);
        }
      });
    }

    getAttackModifiers(engine, attackerHolder, defenderHolder, ctx = {}) {
      const out = {
        advantage: false,
        disadvantage: false,
        attackBonus: 0,
        notes: []
      };

      const applyInst = (inst, role) => {
        if (inst.duration != null && inst.duration <= 0) return;
        const g = inst.grants || {};

        if (g.advantage) out.advantage = true;
        if (g.disadvantage) out.disadvantage = true;

        if (inst.behavior === 'roll_mod') {
          if (g.advantage) out.advantage = true;
          if (g.disadvantage) out.disadvantage = true;
        }

        if (role === 'attacker') {
          if (inst.id === 'disadvantage' || inst.behavior === 'disadvantage') {
            out.disadvantage = true;
          }
          if (inst.id === 'advantage' || inst.behavior === 'advantage') {
            out.advantage = true;
          }
        }

        if (role === 'defender' && inst.behavior === 'prone') {
          out.advantage = true;
          out.notes.push('Цель сбита с ног: преимущество');
        }
      };

      (attackerHolder?.effects || []).forEach((inst) => applyInst(inst, 'attacker'));
      (defenderHolder?.effects || []).forEach((inst) => applyInst(inst, 'defender'));

      if (ctx.ranged && defenderHolder && this.hasStatus(defenderHolder, 'covered')) {
        const def = this.getDefinition('covered', engine);
        const bonus = parseInt(def?.value, 10) || 2;
        out.attackBonus -= bonus;
        out.notes.push(`Укрытие: −${bonus} к попаданию`);
      }

      if (out.advantage && out.disadvantage) {
        out.advantage = false;
        out.disadvantage = false;
        out.notes.push('Преимущество и помеха отменяют друг друга');
      }

      return out;
    }

    getHolderAcBonus(holder) {
      let bonus = 0;
      (holder?.effects || []).forEach((inst) => {
        if (inst.duration != null && inst.duration <= 0) return;
        if (inst.behavior === 'ac_mod' || (inst.behavior === 'stat_mod' && inst.attribute === 'ac')) {
          bonus += parseInt(inst.value, 10) || 0;
        }
      });
      return bonus;
    }

    resolveTargets(engine, effectWrapper, explicitEnemy) {
      const scope =
        effectWrapper?.targeting?.scope ||
        effectWrapper?.target ||
        (effectWrapper?.addEffect?.target === 'self' ? 'self' : null) ||
        'single';
      const targets = [];

      if (scope === 'self' || effectWrapper?.addEffect?.target === 'self') {
        const p = this.getPlayerHolder(engine);
        if (p) targets.push(p);
        return targets;
      }

      if (scope === 'all_enemies' || effectWrapper?.allTargets) {
        (engine.state.enemies || [])
          .filter((e) => e.hp > 0)
          .forEach((e) => {
            const h = this.getEnemyHolder(engine, e);
            if (h) targets.push(h);
          });
        return targets;
      }

      if (explicitEnemy) {
        const h = this.getEnemyHolder(engine, explicitEnemy);
        if (h) targets.push(h);
        return targets;
      }

      const first = (engine.state.enemies || []).find((e) => e.hp > 0);
      if (first) {
        const h = this.getEnemyHolder(engine, first);
        if (h) targets.push(h);
      }
      return targets;
    }

    /** apply_status из умения / CombatManager */
    applyFromEffect(engine, effectWrapper, explicitTarget) {
      const spec =
        effectWrapper?.statusId ||
        effectWrapper?.status ||
        effectWrapper?.addEffect ||
        effectWrapper?.statusEffect;
      if (!spec) return true;

      const raw =
        typeof spec === 'string'
          ? { id: spec, duration: effectWrapper.duration }
          : { ...spec, duration: effectWrapper.duration ?? spec.duration };

      const label = engine._abilitySoundCtx?.name || effectWrapper.source || 'действие';
      const targets = this.resolveTargets(engine, effectWrapper, explicitTarget);
      targets.forEach((holder) => this.apply(engine, holder, raw, label));
      engine.renderCombat?.();
      return true;
    }

    /** Публичный API: combatLog.add(type, data) стиль */
    add(engine, typeOrHolder, data, sourceLabel) {
      if (typeOrHolder?.effects) {
        return this.apply(engine, typeOrHolder, data, sourceLabel);
      }
      const holder = this.getPlayerHolder(engine);
      const raw = typeof typeOrHolder === 'string' ? { id: typeOrHolder, ...data } : data;
      return this.apply(engine, holder, raw, sourceLabel);
    }

    renderHtml(engine, effects) {
      if (!effects?.length) return '';
      return effects
        .filter((e) => e.duration == null || e.duration > 0)
        .map((e) => {
          const turns =
            e.duration != null && e.duration > 0 ? ` · ${e.duration} раунд.` : '';
          const desc = e.description || e.label || e.id;
          const title = `${desc}${turns}${e.source ? ' (' + e.source + ')' : ''}`;
          const color = e.color || 'default';
          const behavior = e.behavior || 'marker';
          const icon = e.icon || '✨';
          const important =
            SKIP_BEHAVIORS.has(behavior) ||
            e.id === 'burning' ||
            e.category === 'dot';
          return `<span class="status-chip status-chip--${escapeAttr(color)} status-chip--${escapeAttr(behavior)}${important ? ' status-chip--important' : ''}"
            title="${escapeAttr(title)}"
            role="img"
            aria-label="${escapeAttr(title)}">
            <span class="status-chip__icon" aria-hidden="true">${escapeHtml(icon)}</span>
            <span class="status-chip__dur">${e.duration > 0 ? escapeHtml(String(e.duration)) : ''}</span>
          </span>`;
        })
        .join('');
    }

    renderTimelineBadges(engine, participant) {
      let effects = [];
      if (participant.type === 'player') {
        effects = engine.state.combat?.effects || [];
      } else if (participant.enemyIndex != null) {
        effects = engine.state.enemies?.[participant.enemyIndex]?.effects || [];
      }
      const html = this.renderHtml(engine, effects);
      if (!html) return '';
      return `<div class="combat-timeline__statuses">${html}</div>`;
    }

    applyAmbushSurprise(engine, rules) {
      if (!rules?.surpriseRound && !rules?.ambush) return;
      const holder = this.getPlayerHolder(engine);
      const dur = rules.surpriseDuration != null ? rules.surpriseDuration : 1;
      this.apply(engine, holder, { id: 'surprised', duration: dur }, rules.ambushLabel || 'засада');
    }
  }

  const StatusManager = new StatusManagerClass();

  function attachToEngine() {
    if (typeof GameEngine === 'undefined') return false;
    Object.assign(GameEngine, {
      getStatusEffectCatalog() {
        return StatusManager.getCatalog(this);
      },
      normalizeStatusEffect(raw) {
        return StatusManager.normalize(raw, this);
      },
      ensureCombatEffectsState() {
        StatusManager.ensureState(this);
      },
      getPlayerEffectHolder() {
        return StatusManager.getPlayerHolder(this);
      },
      getEnemyEffectHolder(enemy) {
        return StatusManager.getEnemyHolder(this, enemy);
      },
      applyStatusEffect(holder, rawEffect, sourceLabel) {
        return StatusManager.apply(this, holder, rawEffect, sourceLabel);
      },
      removeStatusEffect(holder, inst) {
        return StatusManager.remove(this, holder, inst);
      },
      processEffects(holder) {
        return StatusManager.processTurnStart(this, holder);
      },
      tickStatusRoundEnd() {
        return StatusManager.tickRoundEnd(this);
      },
      resolveStatusEffectTargets(effectWrapper, explicitEnemy) {
        return StatusManager.resolveTargets(this, effectWrapper, explicitEnemy);
      },
      applyAbilityAddEffect(effectWrapper, explicitTarget) {
        return StatusManager.applyFromEffect(this, effectWrapper, explicitTarget);
      },
      renderStatusEffectsHtml(effects) {
        return StatusManager.renderHtml(this, effects);
      },
      getStatusAttackModifiers(attackerHolder, defenderHolder, ctx) {
        return StatusManager.getAttackModifiers(this, attackerHolder, defenderHolder, ctx);
      }
    });
    return true;
  }

  if (!attachToEngine()) {
    document.addEventListener('DOMContentLoaded', () => {
      if (!attachToEngine()) {
        console.error('StatusManager: GameEngine не определён');
      }
    });
  }

  global.StatusManager = StatusManager;
})(typeof window !== 'undefined' ? window : globalThis);
