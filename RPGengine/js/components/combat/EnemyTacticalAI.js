/**
 * EnemyTacticalAI — тактика врагов по combatRole, range и зонам (CombatPosition).
 * @module EnemyTacticalAI
 */
(function (global) {
  'use strict';

  const COMBAT_ROLES = {
    MELEE: 'melee',
    RANGED: 'ranged',
    CASTER: 'caster',
    SUPPORT: 'support',
    TANK: 'tank',
    SUMMONER: 'summoner'
  };

  const IMPLEMENTED_ROLES = new Set([
    COMBAT_ROLES.MELEE,
    COMBAT_ROLES.RANGED,
    COMBAT_ROLES.CASTER,
    COMBAT_ROLES.TANK
  ]);

  function getCp() {
    return typeof CombatPosition !== 'undefined' ? CombatPosition : null;
  }

  function getTemplate(engine, enemy) {
    return engine?.data?.enemies?.[enemy?.id] || null;
  }

  function resolveCombatRole(engine, enemy) {
    const tpl = getTemplate(engine, enemy);
    const raw = String(enemy?.combatRole || tpl?.combatRole || '').toLowerCase();
    if (raw && Object.values(COMBAT_ROLES).includes(raw)) return raw;
    if (enemy?.ranged || tpl?.ranged) return COMBAT_ROLES.RANGED;
    return COMBAT_ROLES.MELEE;
  }

  function normalizeAttackRange(attack) {
    const CP = getCp();
    if (!CP) return String(attack?.range || 'melee').toLowerCase();
    return CP.normalizeRangeType(attack?.range, { tags: attack?.tags });
  }

  function isSameZoneRange(rangeType) {
    const CP = getCp();
    return CP ? CP.rangeTypeRequiresSameZone(rangeType) : rangeType === 'melee';
  }

  function getEnemyAttacks(engine, enemy) {
    const tpl = getTemplate(engine, enemy);
    const list = enemy?.attacks || tpl?.attacks;
    if (Array.isArray(list) && list.length) {
      return list.map((a, i) => ({
        id: a.id || `attack_${i}`,
        label: a.label || a.name || a.id || 'Атака',
        range: a.range,
        atkBonus: a.atkBonus != null ? a.atkBonus : enemy.atkBonus,
        dmgRoll: a.dmgRoll || enemy.dmgRoll,
        dmgBonus: a.dmgBonus != null ? a.dmgBonus : enemy.dmgBonus,
        tags: a.tags || [],
        weight: a.weight != null ? Number(a.weight) : 1
      }));
    }
    const role = resolveCombatRole(engine, enemy);
    const defaultRange = role === COMBAT_ROLES.RANGED ? 'ranged' : 'melee';
    return [
      {
        id: 'default',
        label: 'Атака',
        range: defaultRange,
        atkBonus: enemy.atkBonus,
        dmgRoll: enemy.dmgRoll,
        dmgBonus: enemy.dmgBonus,
        tags: [defaultRange, 'weapon'],
        weight: 1
      }
    ];
  }

  function getEnemyAbilities(engine, enemy) {
    const tpl = getTemplate(engine, enemy);
    const raw = enemy?.combatAbilities || enemy?.abilities || tpl?.combatAbilities || tpl?.abilities;
    if (!Array.isArray(raw) || !raw.length) return [];
    const out = [];
    raw.forEach((entry, i) => {
      if (!entry) return;
      if (typeof entry === 'string') {
        const fromGlobal = engine.data?.progression?.abilities?.[entry]
          || engine.data?.abilities?.[entry];
        if (fromGlobal) out.push({ ...fromGlobal, id: fromGlobal.id || entry });
        return;
      }
      if (entry.id || entry.name) {
        out.push(entry);
      }
    });
    return out.map((ab, i) => {
      const parsed =
        typeof CombatManager !== 'undefined' && CombatManager.parseAction
          ? CombatManager.parseAction(ab, {
              system: engine.isPf2e?.() ? 'pf2e' : 'dnd5e'
            })
          : ab;
      return parsed;
    });
  }

  function canAttackHitPlayer(engine, enemyIndex, attack) {
    const CP = getCp();
    if (!CP || !CP.isEnabled(engine)) return true;
    const rangeType = normalizeAttackRange(attack);
    const check = CP.validateAttackAgainstPlayer(engine, enemyIndex, rangeType);
    return check.valid;
  }

  function estimateAttackScore(attack) {
    const dice = String(attack.dmgRoll || '1d6');
    const m = dice.match(/(\d+)d(\d+)/);
    let avg = 4;
    if (m) avg = (parseInt(m[1], 10) || 1) * ((parseInt(m[2], 10) || 6) + 1) / 2;
    return avg + (parseInt(attack.dmgBonus, 10) || 0) + (parseInt(attack.weight, 10) || 0) * 0.5;
  }

  function pickBestAttack(engine, enemyIndex, attacks, opts = {}) {
    const { preferRangeTypes = null, enemyZone, playerZone } = opts;
    const CP = getCp();
    let candidates = attacks.filter((a) =>
      canAttackHitPlayer(engine, enemyIndex, a)
    );
    if (!candidates.length) return null;

    if (preferRangeTypes?.length) {
      const preferred = candidates.filter((a) =>
        preferRangeTypes.includes(normalizeAttackRange(a))
      );
      if (preferred.length) candidates = preferred;
    }

    if (CP && enemyZone != null && playerZone != null) {
      const dist = CP.getZoneDistance(enemyZone, playerZone);
      if (dist > 0) {
        const ranged = candidates.filter((a) => !isSameZoneRange(normalizeAttackRange(a)));
        if (ranged.length) candidates = ranged;
      } else {
        const melee = candidates.filter((a) => isSameZoneRange(normalizeAttackRange(a)));
        if (melee.length) candidates = melee;
      }
    }

    candidates.sort(
      (a, b) => estimateAttackScore(b) - estimateAttackScore(a)
    );
    return candidates[0];
  }

  function planMoveTowardPlayer(engine, enemyIndex) {
    const CP = getCp();
    if (!CP || !CP.isEnabled(engine)) return null;
    const enemy = engine.state.enemies[enemyIndex];
    if (!enemy || enemy.zoneMovedThisTurn) return null;
    const cur = CP.getEnemyPosition(engine, enemyIndex);
    const pz = CP.getPlayerPosition(engine);
    const next = CP.getZoneStepToward(cur, pz);
    if (!next) return null;
    return { kind: 'move', zone: next };
  }

  function planMoveAwayFromPlayer(engine, enemyIndex) {
    const CP = getCp();
    if (!CP || !CP.isEnabled(engine)) return null;
    const enemy = engine.state.enemies[enemyIndex];
    if (!enemy || enemy.zoneMovedThisTurn) return null;
    const cur = CP.getEnemyPosition(engine, enemyIndex);
    const pz = CP.getPlayerPosition(engine);
    const next = CP.getZoneStepAway(cur, pz);
    if (!next) return null;
    return { kind: 'move', zone: next };
  }

  /**
   * MELEE: атака в зоне досягаемости, иначе шаг к игроку.
   */
  function planMeleeTurn(engine, enemy, enemyIndex) {
    const CP = getCp();
    const attacks = getEnemyAttacks(engine, enemy);
    const playerZone = CP ? CP.getPlayerPosition(engine) : null;
    const enemyZone = CP ? CP.getEnemyPosition(engine, enemyIndex) : null;

    const hit = pickBestAttack(engine, enemyIndex, attacks, {
      preferRangeTypes: [CP?.RANGE_TYPES?.MELEE || 'melee', 'touch'],
      enemyZone,
      playerZone
    });
    if (hit) return { kind: 'attack', attack: hit };

    const move = planMoveTowardPlayer(engine, enemyIndex);
    if (move) return move;

    return { kind: 'wait' };
  }

  /**
   * RANGED: в одной зоне — мили, иначе отход + дальняя; издалека — дальняя.
   */
  function planRangedTurn(engine, enemy, enemyIndex) {
    const CP = getCp();
    const attacks = getEnemyAttacks(engine, enemy);
    const playerZone = CP ? CP.getPlayerPosition(engine) : null;
    const enemyZone = CP ? CP.getEnemyPosition(engine, enemyIndex) : null;
    const sameZone = CP && playerZone === enemyZone;

    if (sameZone) {
      const meleeTypes = [
        CP.RANGE_TYPES.MELEE,
        CP.RANGE_TYPES.TOUCH,
        'melee',
        'touch'
      ];
      const meleeHit = pickBestAttack(engine, enemyIndex, attacks, {
        preferRangeTypes: meleeTypes,
        enemyZone,
        playerZone
      });
      if (meleeHit) {
        return { kind: 'attack', attack: meleeHit, note: 'melee_fallback' };
      }

      const move = planMoveAwayFromPlayer(engine, enemyIndex);
      if (move) return move;

      const rangedHit = pickBestAttack(engine, enemyIndex, attacks, {
        preferRangeTypes: [CP.RANGE_TYPES.RANGED, CP.RANGE_TYPES.SPELL, 'ranged', 'spell'],
        enemyZone,
        playerZone
      });
      if (rangedHit) return { kind: 'attack', attack: rangedHit, note: 'ranged_in_melee' };
      return { kind: 'wait' };
    }

    const rangedHit = pickBestAttack(engine, enemyIndex, attacks, {
      preferRangeTypes: [CP.RANGE_TYPES.RANGED, CP.RANGE_TYPES.SPELL, 'ranged', 'spell'],
      enemyZone,
      playerZone
    });
    if (rangedHit) return { kind: 'attack', attack: rangedHit };

    const move = planMoveTowardPlayer(engine, enemyIndex);
    if (move) return move;

    const any = pickBestAttack(engine, enemyIndex, attacks, { enemyZone, playerZone });
    if (any) return { kind: 'attack', attack: any };

    return { kind: 'wait' };
  }

  /**
   * CASTER: приоритет действий с range spell, иначе как ranged.
   */
  function planCasterTurn(engine, enemy, enemyIndex) {
    const CP = getCp();
    const abilities = getEnemyAbilities(engine, enemy);
    const playerZone = CP ? CP.getPlayerPosition(engine) : null;
    const enemyZone = CP ? CP.getEnemyPosition(engine, enemyIndex) : null;

    const spells = abilities.filter((ab) => {
      const rt = CP ? CP.getAbilityRangeType(ab) : 'spell';
      return rt === CP.RANGE_TYPES.SPELL || rt === 'spell';
    });

    for (const ab of spells) {
      const rt = CP.getAbilityRangeType(ab);
      const inRange =
        !CP ||
        !CP.isEnabled(engine) ||
        CP.canReachWithRangeType(enemyZone, playerZone, rt);
      if (!inRange) continue;
      const scope = ab.targetType || ab.targeting?.scope;
      if (
        scope === 'singleEnemy' ||
        scope === 'single' ||
        scope === 'single_enemy'
      ) {
        return { kind: 'ability', ability: ab };
      }
      if (
        scope === 'area' ||
        scope === 'allEnemies' ||
        scope === 'all_enemies'
      ) {
        return { kind: 'ability', ability: ab };
      }
    }

    return planRangedTurn(engine, enemy, enemyIndex);
  }

  /** TANK: как melee, активнее сближается. */
  function planTankTurn(engine, enemy, enemyIndex) {
    const plan = planMeleeTurn(engine, enemy, enemyIndex);
    if (plan.kind !== 'wait') return plan;
    return planMoveTowardPlayer(engine, enemyIndex) || plan;
  }

  /** SUPPORT / SUMMONER — заглушки (базовая атака или ожидание). */
  function planSupportTurn(engine, enemy, enemyIndex) {
    const attacks = getEnemyAttacks(engine, enemy);
    const hit = pickBestAttack(engine, enemyIndex, attacks);
    if (hit) return { kind: 'attack', attack: hit };
    return { kind: 'wait' };
  }

  function planSummonerTurn(engine, enemy, enemyIndex) {
    return planSupportTurn(engine, enemy, enemyIndex);
  }

  const ROLE_PLANNERS = {
    [COMBAT_ROLES.MELEE]: planMeleeTurn,
    [COMBAT_ROLES.RANGED]: planRangedTurn,
    [COMBAT_ROLES.CASTER]: planCasterTurn,
    [COMBAT_ROLES.TANK]: planTankTurn,
    [COMBAT_ROLES.SUPPORT]: planSupportTurn,
    [COMBAT_ROLES.SUMMONER]: planSummonerTurn
  };

  function planTurn(engine, enemy, enemyIndex) {
    const role = resolveCombatRole(engine, enemy);
    const planner = ROLE_PLANNERS[role] || planMeleeTurn;
    return planner(engine, enemy, enemyIndex);
  }

  function executeMove(engine, enemyIndex, zone) {
    const CP = getCp();
    if (!CP) return false;
    return CP.moveEnemyOneZone(engine, enemyIndex, zone);
  }

  /**
   * Выполнить ход врага (план + действия). Возвращает true, если что-то сделано.
   */
  function runTurn(engine, enemy, enemyIndex) {
    if (!enemy || enemy.hp <= 0) return false;

    enemy.zoneMovedThisTurn = false;

    const CP = getCp();
    if (!CP || !CP.isEnabled(engine)) {
      if (typeof engine.executeEnemyBasicAttack === 'function') {
        return engine.executeEnemyBasicAttack(enemy, enemyIndex, null);
      }
      return false;
    }

    const plan = planTurn(engine, enemy, enemyIndex);

    if (plan.kind === 'move' && plan.zone) {
      executeMove(engine, enemyIndex, plan.zone);
      const role = resolveCombatRole(engine, enemy);
      const allowFollowUp =
        role === COMBAT_ROLES.RANGED || role === COMBAT_ROLES.CASTER;
      if (allowFollowUp) {
        const attacks = getEnemyAttacks(engine, enemy);
        const followUp = pickBestAttack(engine, enemyIndex, attacks, {
          enemyZone: CP.getEnemyPosition(engine, enemyIndex),
          playerZone: CP.getPlayerPosition(engine)
        });
        if (followUp && typeof engine.executeEnemyAttack === 'function') {
          return engine.executeEnemyAttack(enemy, enemyIndex, followUp, plan.note);
        }
      }
      return true;
    }

    if (plan.kind === 'attack' && plan.attack) {
      if (typeof engine.executeEnemyAttack === 'function') {
        return engine.executeEnemyAttack(enemy, enemyIndex, plan.attack, plan.note);
      }
    }

    if (plan.kind === 'ability' && plan.ability) {
      engine.log?.(
        `💫 ${enemy.name}: ${plan.ability.name} (AI, способности врага — в разработке)`,
        'log-combat'
      );
      const fallback = pickBestAttack(engine, enemyIndex, getEnemyAttacks(engine, enemy));
      if (fallback && typeof engine.executeEnemyAttack === 'function') {
        return engine.executeEnemyAttack(enemy, enemyIndex, fallback);
      }
      return true;
    }

    if (plan.kind === 'wait') {
      engine.log?.(`⏳ ${enemy.name} не находит удачной позиции для атаки.`, 'log-dice');
      return true;
    }

    if (typeof engine.executeEnemyBasicAttack === 'function') {
      return engine.executeEnemyBasicAttack(enemy, enemyIndex, null);
    }
    return false;
  }

  const EnemyTacticalAI = {
    COMBAT_ROLES,
    IMPLEMENTED_ROLES,
    resolveCombatRole,
    getEnemyAttacks,
    getEnemyAbilities,
    planTurn,
    runTurn,
    pickBestAttack,
    planMeleeTurn,
    planRangedTurn
  };

  global.EnemyTacticalAI = EnemyTacticalAI;
})(typeof window !== 'undefined' ? window : globalThis);
