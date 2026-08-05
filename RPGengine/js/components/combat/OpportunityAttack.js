/**
 * OpportunityAttack — атаки возможности при выходе из общей зоны (D&D / PF2e / Free Strike).
 * @module OpportunityAttack
 */
(function (global) {
  'use strict';

  const REACTION_TYPES = {
    OPPORTUNITY_ATTACK: 'opportunity_attack',
    COUNTERATTACK: 'counterattack',
    GUARD_ALLY: 'guard_ally',
    INTERCEPT: 'intercept',
    TALENT: 'talent'
  };

  /** Зарегистрированные типы реакций (расширяемо) */
  const REACTION_REGISTRY = {
    [REACTION_TYPES.OPPORTUNITY_ATTACK]: {
      id: REACTION_TYPES.OPPORTUNITY_ATTACK,
      label: 'Атака возможности',
      canMake: null,
      trigger: null
    }
  };

  function getConfig(engine) {
    const zones = engine?.data?.meta?.combatZones || {};
    const oa = zones.opportunityAttack || zones.opportunityAttacks || {};
    return {
      enabled: zones.enabled !== false && oa.enabled !== false,
      requireMelee: oa.requireMelee !== false,
      useInitiativeOrder: oa.useInitiativeOrder !== false
    };
  }

  function isEnabled(engine) {
    if (!engine?.state?.combat) return false;
    if (typeof CombatPosition === 'undefined' || !CombatPosition.isEnabled(engine)) {
      return false;
    }
    return getConfig(engine).enabled;
  }

  function participantKey(participant) {
    if (!participant || !participant.type) return '';
    return participant.type === 'player'
      ? 'player'
      : `enemy:${participant.enemyIndex}`;
  }

  function initReactionState(engine) {
    if (!engine.state?.combat) return;
    const c = engine.state.combat;
    if (!c.reactions || typeof c.reactions !== 'object') {
      c.reactions = { usedThisRound: {} };
    }
    if (!c.reactions.usedThisRound) c.reactions.usedThisRound = {};
    c.reactionAvailable = true;
    clearOpportunityUsageForRound(engine);
    (engine.state.enemies || []).forEach((e) => {
      if (e) e.reactionAvailable = true;
    });
  }

  /**
   * Восстановление реакций в начале нового раунда.
   */
  function restoreReactionsForRound(engine) {
    if (!engine?.state?.combat) return;
    initReactionState(engine);
  }

  function hasUsedOpportunityThisRound(engine, participant) {
    const key = participantKey(participant);
    return !!engine.state.combat?.reactions?.usedThisRound?.[key];
  }

  function markOpportunityUsed(engine, participant) {
    if (!engine.state.combat) return;
    if (!engine.state.combat.reactions) engine.state.combat.reactions = { usedThisRound: {} };
    if (!engine.state.combat.reactions.usedThisRound) {
      engine.state.combat.reactions.usedThisRound = {};
    }
    engine.state.combat.reactions.usedThisRound[participantKey(participant)] = true;
  }

  function clearOpportunityUsageForRound(engine) {
    if (engine.state?.combat?.reactions) {
      engine.state.combat.reactions.usedThisRound = {};
    }
  }

  function isParticipantAlive(engine, participant) {
    if (participant.type === 'player') {
      return (parseInt(engine.state?.hp, 10) || 0) > 0;
    }
    const enemy = engine.state?.enemies?.[participant.enemyIndex];
    return !!(enemy && enemy.hp > 0);
  }

  function isParticipantAbleToAct(engine, participant) {
    if (!isParticipantAlive(engine, participant)) return false;
    if (typeof StatusManager === 'undefined') return true;
    const holder =
      participant.type === 'player'
        ? StatusManager.getPlayerHolder(engine)
        : StatusManager.getEnemyHolder(
            engine,
            engine.state.enemies[participant.enemyIndex]
          );
    if (!holder) return true;
    if (StatusManager.hasStatus(holder, 'stunned')) return false;
    if (StatusManager.hasStatus(holder, 'surprised')) return false;
    return true;
  }

  function hasReactionResource(engine, participant) {
    if (participant.type === 'player') {
      return engine.state.combat?.reactionAvailable !== false;
    }
    const enemy = engine.state.enemies?.[participant.enemyIndex];
    return enemy?.reactionAvailable !== false;
  }

  function spendReaction(engine, participant, reactionType) {
    if (reactionType === REACTION_TYPES.OPPORTUNITY_ATTACK) {
      markOpportunityUsed(engine, participant);
    }
    if (participant.type === 'player') {
      engine.spendCombatActionType?.('reaction');
      return;
    }
    const enemy = engine.state.enemies?.[participant.enemyIndex];
    if (enemy) enemy.reactionAvailable = false;
  }

  function pickPlayerMeleeAttack(engine) {
    if (typeof CombatPosition === 'undefined') return null;
    const trySlot = (slot) => {
      const profile = engine.getWeaponAttackProfile?.(slot);
      if (!profile?.weaponId) return slot === 'weapon_main' ? profile : null;
      const rt = CombatPosition.getWeaponRangeType(engine, profile);
      if (CombatPosition.rangeTypeRequiresSameZone(rt)) return profile;
      return null;
    };
    return trySlot('weapon_main') || trySlot('weapon_off') || engine.getWeaponAttackProfile?.('weapon_main');
  }

  function pickEnemyMeleeAttack(engine, enemy, enemyIndex) {
    if (typeof EnemyTacticalAI === 'undefined') {
      return {
        id: 'default',
        range: 'melee',
        atkBonus: enemy.atkBonus,
        dmgRoll: enemy.dmgRoll,
        dmgBonus: enemy.dmgBonus,
        label: 'Атака возможности'
      };
    }
    const attacks = EnemyTacticalAI.getEnemyAttacks(engine, enemy);
    const CP = CombatPosition;
    const melee = attacks.filter((a) =>
      CP.rangeTypeRequiresSameZone(CP.normalizeRangeType(a.range, { tags: a.tags }))
    );
    const list = melee.length ? melee : attacks;
    return EnemyTacticalAI.pickBestAttack(engine, enemyIndex, list, {
      preferRangeTypes: [CP.RANGE_TYPES.MELEE, 'melee', 'touch'],
      enemyZone: CP.getEnemyPosition(engine, enemyIndex),
      playerZone: CP.getPlayerPosition(engine)
    });
  }

  function canPerformOpportunityStrike(engine, participant) {
    const cfg = getConfig(engine);
    if (!cfg.requireMelee) return true;
    if (participant.type === 'player') {
      return !!pickPlayerMeleeAttack(engine);
    }
    const enemy = engine.state.enemies?.[participant.enemyIndex];
    if (!enemy) return false;
    return !!pickEnemyMeleeAttack(engine, enemy, participant.enemyIndex);
  }

  /**
   * @param {object} engine
   * @param {{ type: 'player'|'enemy', enemyIndex?: number }} participant — кто бьёт
   * @param {object} leaveEvent — событие выхода из зоны
   */
  function canMakeOpportunityAttack(engine, participant, leaveEvent) {
    if (!isEnabled(engine) || !leaveEvent) return false;
    if (!leaveEvent.fromZone || leaveEvent.fromZone === leaveEvent.toZone) return false;

    if (!isParticipantAlive(engine, participant)) return false;
    if (!isParticipantAbleToAct(engine, participant)) return false;
    if (!hasReactionResource(engine, participant)) return false;
    if (hasUsedOpportunityThisRound(engine, participant)) return false;
    if (!canPerformOpportunityStrike(engine, participant)) return false;

    const CP = CombatPosition;
    const reactorZone =
      participant.type === 'player'
        ? CP.getPlayerPosition(engine)
        : CP.getEnemyPosition(engine, participant.enemyIndex);

    if (normalizeZone(reactorZone) !== normalizeZone(leaveEvent.fromZone)) {
      return false;
    }

    if (leaveEvent.actorType === participant.type) {
      if (
        leaveEvent.actorType === 'enemy' &&
        leaveEvent.enemyIndex === participant.enemyIndex
      ) {
        return false;
      }
      if (leaveEvent.actorType === 'player' && participant.type === 'player') {
        return false;
      }
    }

    return true;
  }

  function normalizeZone(z) {
    return typeof CombatPosition !== 'undefined'
      ? CombatPosition.normalizeZone(z)
      : z;
  }

  function listReactorsInZone(engine, fromZone, leavingActor) {
    const zone = normalizeZone(fromZone);
    const reactors = [];
    const CP = CombatPosition;

    if (
      leavingActor.actorType !== 'player' &&
      (parseInt(engine.state?.hp, 10) || 0) > 0 &&
      CP.getPlayerPosition(engine) === zone
    ) {
      reactors.push({ type: 'player' });
    }

    (engine.state.enemies || []).forEach((e, i) => {
      if (!e || e.hp <= 0) return;
      if (leavingActor.actorType === 'enemy' && leavingActor.enemyIndex === i) {
        return;
      }
      if (CP.getEnemyPosition(engine, i) === zone) {
        reactors.push({ type: 'enemy', enemyIndex: i });
      }
    });

    return reactors;
  }

  function sortReactorsByInitiative(engine, reactors) {
    if (!getConfig(engine).useInitiativeOrder) return reactors;
    const order = engine.state.combat?.order || [];
    const indexOf = (p) => {
      if (p.type === 'player') {
        return order.findIndex((o) => o.type === 'player');
      }
      return order.findIndex(
        (o) => o.type === 'enemy' && o.index === p.enemyIndex
      );
    };
    return [...reactors].sort((a, b) => {
      const ia = indexOf(a);
      const ib = indexOf(b);
      const ai = ia >= 0 ? ia : 999;
      const bi = ib >= 0 ? ib : 999;
      return ai - bi;
    });
  }

  /**
   * Выполнить атаку возможности.
   */
  function triggerOpportunityAttack(engine, participant, leaveEvent) {
    if (!canMakeOpportunityAttack(engine, participant, leaveEvent)) return false;

    const moverName =
      leaveEvent.actorName ||
      (leaveEvent.actorType === 'player'
        ? engine.state?.charName || 'Герой'
        : engine.state.enemies?.[leaveEvent.enemyIndex]?.name || 'Противник');

    const reactorName =
      participant.type === 'player'
        ? engine.state?.charName || 'Герой'
        : engine.state.enemies?.[participant.enemyIndex]?.name || 'Враг';

    engine.log?.(
      `⚡ Атака возможности: ${reactorName} → ${moverName} (покидает ${CombatPosition.getZoneLabel(leaveEvent.fromZone)})`,
      'log-combat'
    );

    let ok = false;
    if (participant.type === 'player') {
      ok = !!engine.executePlayerOpportunityAttack?.(
        leaveEvent.enemyIndex,
        leaveEvent
      );
    } else {
      ok = !!engine.executeEnemyOpportunityAttack?.(
        participant.enemyIndex,
        leaveEvent
      );
    }

    if (ok) {
      spendReaction(engine, participant, REACTION_TYPES.OPPORTUNITY_ATTACK);
    }
    return ok;
  }

  /**
   * Точка входа: существо покинуло зону (вызывается из CombatPosition, не из логики сдвига).
   * @param {object} engine
   * @param {object} leaveEvent
   */
  function onZoneLeave(engine, leaveEvent) {
    if (!isEnabled(engine) || !leaveEvent) return [];
    const reactors = sortReactorsByInitiative(
      engine,
      listReactorsInZone(engine, leaveEvent.fromZone, leaveEvent)
    );
    const triggered = [];
    reactors.forEach((reactor) => {
      if (canMakeOpportunityAttack(engine, reactor, leaveEvent)) {
        if (triggerOpportunityAttack(engine, reactor, leaveEvent)) {
          triggered.push(reactor);
        }
      }
    });
    return triggered;
  }

  REACTION_REGISTRY[REACTION_TYPES.OPPORTUNITY_ATTACK].canMake = canMakeOpportunityAttack;
  REACTION_REGISTRY[REACTION_TYPES.OPPORTUNITY_ATTACK].trigger = triggerOpportunityAttack;

  const OpportunityAttack = {
    REACTION_TYPES,
    REACTION_REGISTRY,
    getConfig,
    isEnabled,
    initReactionState,
    restoreReactionsForRound,
    canMakeOpportunityAttack,
    triggerOpportunityAttack,
    onZoneLeave,
    spendReaction,
    hasReactionResource,
    pickPlayerMeleeAttack,
    pickEnemyMeleeAttack,
    participantKey
  };

  global.OpportunityAttack = OpportunityAttack;
})(typeof window !== 'undefined' ? window : globalThis);
