/**
 * CombatPosition — зоны боя Far / Mid / Close и дальность действий (data-driven).
 * @module CombatPosition
 */
(function (global) {
  'use strict';

  const ZONES = {
    FAR: 'far',
    MID: 'mid',
    CLOSE: 'close'
  };

  const ZONE_ORDER = [ZONES.FAR, ZONES.MID, ZONES.CLOSE];

  const RANGE_TYPES = {
    MELEE: 'melee',
    TOUCH: 'touch',
    CONE: 'cone',
    RANGED: 'ranged',
    SPELL: 'spell'
  };

  const SAME_ZONE_RANGE_TYPES = new Set([
    RANGE_TYPES.MELEE,
    RANGE_TYPES.TOUCH,
    RANGE_TYPES.CONE
  ]);

  /** @deprecated Совместимость с кодом, использующим ZONE_REACH */
  const ZONE_REACH = {
    SAME_ZONE: 'same_zone',
    ANY_ZONE: 'any_zone'
  };

  const DEFAULT_CONFIG = {
    enabled: true,
    defaultPlayerPosition: ZONES.CLOSE,
    defaultEnemyPosition: ZONES.CLOSE,
    flankingAttackBonus: 2,
    flankingUsesAdvantage: true,
    shiftCostsAction: false,
    /** Помеха / штраф при ranged или spell в одной зоне с живым врагом */
    sameZonePenalty: {
      ranged: { disadvantage: true, attackBonus: 0 },
      spell: { disadvantage: true, attackBonus: 0 }
    }
  };

  function getConfig(engine) {
    const meta = engine?.data?.meta?.combatZones || {};
    return { ...DEFAULT_CONFIG, ...meta };
  }

  function isEnabled(engine) {
    return getConfig(engine).enabled !== false;
  }

  function migrateLegacyZone(z) {
    const s = String(z || '').toLowerCase();
    if (s === 'frontline') return ZONES.CLOSE;
    if (s === 'backline') return ZONES.FAR;
    if (ZONE_ORDER.includes(s)) return s;
    return null;
  }

  function normalizeZone(z) {
    const migrated = migrateLegacyZone(z);
    if (migrated) return migrated;
    return ZONES.MID;
  }

  function zoneIndex(zone) {
    const z = normalizeZone(zone);
    const i = ZONE_ORDER.indexOf(z);
    return i >= 0 ? i : 1;
  }

  function getZoneDistance(a, b) {
    return Math.abs(zoneIndex(a) - zoneIndex(b));
  }

  function isAdjacentZone(from, to) {
    return getZoneDistance(from, to) === 1;
  }

  function getZoneLabel(zone) {
    const z = normalizeZone(zone);
    if (z === ZONES.FAR) return 'Дальняя';
    if (z === ZONES.CLOSE) return 'Ближняя';
    return 'Средняя';
  }

  function getZoneIcon(zone) {
    const z = normalizeZone(zone);
    if (z === ZONES.FAR) return '🏹';
    if (z === ZONES.CLOSE) return '⚔️';
    return '🛡️';
  }

  function inferDefaultPlayerZone(engine) {
    const cfg = getConfig(engine);
    if (cfg.defaultPlayerPosition) {
      return normalizeZone(cfg.defaultPlayerPosition);
    }
    const cls = engine.state?.className || '';
    if (['wizard', 'pf2e_wizard', 'pf2e_sorcerer', 'bard'].includes(cls)) {
      return ZONES.FAR;
    }
    if (['ranger', 'rogue', 'pf2e_rogue'].includes(cls)) {
      return ZONES.MID;
    }
    return ZONES.CLOSE;
  }

  function inferEnemyZone(enemy, index, template, engine) {
    if (enemy?.position) return normalizeZone(enemy.position);
    if (template?.position) return normalizeZone(template.position);
    if (template?.combatPosition) return normalizeZone(template.combatPosition);
    if (template?.ranged || template?.isRanged || enemy?.ranged || enemy?.isRanged) {
      return ZONES.FAR;
    }
    const cfg = engine ? getConfig(engine) : DEFAULT_CONFIG;
    if (cfg.defaultEnemyPosition) return normalizeZone(cfg.defaultEnemyPosition);
    if (index % 3 === 1) return ZONES.MID;
    if (index % 3 === 2) return ZONES.FAR;
    return ZONES.CLOSE;
  }

  function initCombatPositions(engine) {
    if (!engine?.state?.combat) return;
    const combat = engine.state.combat;
    combat.playerPosition = migrateLegacyZone(combat.playerPosition)
      || inferDefaultPlayerZone(engine);
    combat.flankingMarks = {};
    combat.zoneConfig = getConfig(engine);
    combat.zoneMovedThisTurn = false;

    (engine.state.enemies || []).forEach((enemy, i) => {
      const tplId = combat.enemies?.[i] || combat.enemyIds?.[i];
      const tpl = tplId && engine.data?.enemies?.[tplId];
      enemy.position = migrateLegacyZone(enemy.position)
        || inferEnemyZone(enemy, i, tpl, engine);
      enemy.zoneMovedThisTurn = false;
    });
  }

  function resetTurnMovement(engine) {
    if (engine.state?.combat) engine.state.combat.zoneMovedThisTurn = false;
  }

  function getPlayerPosition(engine) {
    if (!isEnabled(engine)) return ZONES.CLOSE;
    return normalizeZone(
      engine.state?.combat?.playerPosition || inferDefaultPlayerZone(engine)
    );
  }

  function getEnemyPosition(engine, enemyOrIndex) {
    if (!isEnabled(engine)) return ZONES.CLOSE;
    const enemy =
      typeof enemyOrIndex === 'number'
        ? engine.state?.enemies?.[enemyOrIndex]
        : enemyOrIndex;
    return normalizeZone(enemy?.position || ZONES.CLOSE);
  }

  function setPlayerPosition(engine, zone) {
    if (!engine.state?.combat) return false;
    engine.state.combat.playerPosition = normalizeZone(zone);
    return true;
  }

  function setEnemyPosition(engine, index, zone) {
    const enemy = engine.state?.enemies?.[index];
    if (!enemy) return false;
    enemy.position = normalizeZone(zone);
    return true;
  }

  function normalizeRangeType(raw, opts = {}) {
    const ability = opts.ability || null;
    const tags = (opts.tags || ability?.tags || []).map((t) => String(t).toLowerCase());
    const s = typeof raw === 'string' ? raw.toLowerCase().trim() : '';

    const known = Object.values(RANGE_TYPES);
    if (known.includes(s)) return s;

    if (typeof raw === 'number') {
      if (tags.includes('spell') || ability?.spellLevel != null) return RANGE_TYPES.SPELL;
      return RANGE_TYPES.RANGED;
    }

    if (ability?.combatZoneReach != null && ability.combatZoneReach !== '') {
      const reach = String(ability.combatZoneReach).toLowerCase();
      if (reach === 'same_zone') {
        if (tags.includes('cone')) return RANGE_TYPES.CONE;
        if (tags.includes('touch')) return RANGE_TYPES.TOUCH;
        return RANGE_TYPES.MELEE;
      }
      if (reach === 'any_zone') return RANGE_TYPES.SPELL;
    }

    if (tags.includes('cone')) return RANGE_TYPES.CONE;
    if (tags.includes('touch')) return RANGE_TYPES.TOUCH;
    if (tags.includes('spell')) return RANGE_TYPES.SPELL;
    if (tags.includes('ranged')) return RANGE_TYPES.RANGED;
    if (tags.includes('weapon') || tags.includes('martial')) return RANGE_TYPES.MELEE;

    if (ability?.spellLevel != null) return RANGE_TYPES.SPELL;
    return RANGE_TYPES.MELEE;
  }

  function rangeTypeRequiresSameZone(rangeType) {
    return SAME_ZONE_RANGE_TYPES.has(rangeType);
  }

  function rangeTypeToZoneReach(rangeType) {
    return rangeTypeRequiresSameZone(rangeType)
      ? ZONE_REACH.SAME_ZONE
      : ZONE_REACH.ANY_ZONE;
  }

  function getAbilityRangeType(ability) {
    if (!ability) return RANGE_TYPES.SPELL;
    const raw = ability.range != null ? ability.range : ability.targeting?.range;
    return normalizeRangeType(raw, { ability, tags: ability.tags });
  }

  function getWeaponRangeType(engine, profile) {
    if (!profile) return RANGE_TYPES.MELEE;
    const weapon = profile.weaponId
      ? engine?.itemsData?.[profile.weaponId] || engine?.data?.items?.[profile.weaponId]
      : null;
    if (!weapon) return RANGE_TYPES.MELEE;
    if (weapon.range === 'ranged' || weapon.weaponRange === 'ranged') {
      return RANGE_TYPES.RANGED;
    }
    const wr = normalizeRangeType(weapon.range, { tags: weapon.tags });
    if (wr !== RANGE_TYPES.MELEE || weapon.combatZoneReach === 'any_zone') {
      if (weapon.combatZoneReach === 'any_zone') return RANGE_TYPES.RANGED;
      if (wr !== RANGE_TYPES.MELEE) return wr;
    }
    return RANGE_TYPES.MELEE;
  }

  function isWeaponRanged(weapon) {
    if (!weapon) return false;
    if (weapon.range === 'ranged' || weapon.weaponRange === 'ranged') return true;
    if (weapon.combatZoneReach === 'any_zone') return true;
    const wr = normalizeRangeType(weapon.range, { tags: weapon.tags });
    return wr === RANGE_TYPES.RANGED;
  }

  function getAbilityZoneReach(ability) {
    return rangeTypeToZoneReach(getAbilityRangeType(ability));
  }

  function getWeaponZoneReach(engine, profile) {
    return rangeTypeToZoneReach(getWeaponRangeType(engine, profile));
  }

  function getAttackModeFromRangeType(rangeType) {
    if (rangeType === RANGE_TYPES.RANGED) return 'ranged';
    if (rangeType === RANGE_TYPES.SPELL) return 'spell';
    if (rangeType === RANGE_TYPES.MELEE || rangeType === RANGE_TYPES.TOUCH) {
      return 'melee';
    }
    if (rangeType === RANGE_TYPES.CONE) return 'cone';
    return 'melee';
  }

  function getAttackModeFromProfile(engine, profile) {
    return getAttackModeFromRangeType(getWeaponRangeType(engine, profile));
  }

  function getAttackModeFromAbility(ability) {
    return getAttackModeFromRangeType(getAbilityRangeType(ability));
  }

  function hasLivingEnemyInZone(engine, zone) {
    const z = normalizeZone(zone);
    return (engine.state?.enemies || []).some(
      (e, i) => e.hp > 0 && getEnemyPosition(engine, i) === z
    );
  }

  function hasHostileInAttackerZone(engine, attackerZone, ctx) {
    const zone = normalizeZone(attackerZone);
    if (ctx?.attackerIsEnemy) {
      return zone === getPlayerPosition(engine) && (engine.state?.hp > 0);
    }
    return hasLivingEnemyInZone(engine, zone);
  }

  function applySameZonePenalty(engine, rangeType, attackerZone, out, ctx) {
    if (!SAME_ZONE_RANGE_TYPES.has(rangeType) && rangeType !== RANGE_TYPES.RANGED && rangeType !== RANGE_TYPES.SPELL) {
      return;
    }
    if (rangeType !== RANGE_TYPES.RANGED && rangeType !== RANGE_TYPES.SPELL) return;
    if (!hasHostileInAttackerZone(engine, attackerZone, ctx)) return;

    const cfg = getConfig(engine);
    const pen =
      cfg.sameZonePenalty?.[rangeType] ||
      cfg.sameZonePenalty?.default ||
      null;
    if (!pen) return;

    if (pen.disadvantage) {
      out.disadvantage = true;
      out.notes.push(
        rangeType === RANGE_TYPES.SPELL
          ? 'Помеха: заклинание в одной зоне с врагом'
          : 'Помеха: дальний бой в одной зоне с врагом'
      );
    }
    const bonus = parseInt(pen.attackBonus, 10) || 0;
    if (bonus) {
      out.attackBonus += bonus;
      out.notes.push(
        `Штраф в своей зоне: ${bonus >= 0 ? '+' : ''}${bonus}`
      );
    }
  }

  function resetFlankingMarksIfNewRound(engine) {
    const combat = engine.state?.combat;
    if (!combat) return;
    const round = combat.round || 1;
    if (combat._flankingRound !== round) {
      combat.flankingMarks = {};
      combat._flankingRound = round;
    }
  }

  function getFlankingMarks(engine, enemyIndex) {
    resetFlankingMarksIfNewRound(engine);
    const key = String(enemyIndex);
    if (!engine.state.combat.flankingMarks[key]) {
      engine.state.combat.flankingMarks[key] = { zones: {} };
    }
    if (!engine.state.combat.flankingMarks[key].zones) {
      engine.state.combat.flankingMarks[key].zones = {};
    }
    return engine.state.combat.flankingMarks[key];
  }

  function recordAttackOnEnemy(engine, enemyIndex, attackerZone) {
    if (!isEnabled(engine)) return;
    const marks = getFlankingMarks(engine, enemyIndex);
    marks.zones[normalizeZone(attackerZone)] = true;
  }

  function hasFlankingOnEnemy(engine, enemyIndex) {
    if (!isEnabled(engine)) return false;
    const marks = getFlankingMarks(engine, enemyIndex);
    const hitZones = Object.keys(marks.zones || {}).filter((z) => marks.zones[z]);
    return hitZones.length >= 2;
  }

  function getAttackModifiers(engine, ctx) {
    const cfg = getConfig(engine);
    const out = {
      attackBonus: 0,
      advantage: false,
      disadvantage: false,
      notes: []
    };
    if (!isEnabled(engine)) return out;

    const attackerZone = ctx.attackerZone || getPlayerPosition(engine);
    const targetZone = ctx.targetZone || ZONES.CLOSE;
    const rangeType =
      ctx.rangeType ||
      (ctx.zoneReach === ZONE_REACH.SAME_ZONE
        ? RANGE_TYPES.MELEE
        : ctx.attackMode === 'ranged'
          ? RANGE_TYPES.RANGED
          : RANGE_TYPES.SPELL);

    applySameZonePenalty(engine, rangeType, attackerZone, out, ctx);

    if (ctx.enemyIndex != null && hasFlankingOnEnemy(engine, ctx.enemyIndex)) {
      if (cfg.flankingUsesAdvantage && engine.isPf2e?.() !== true) {
        out.advantage = true;
        out.notes.push('Фланг: преимущество (Advantage)');
      } else {
        out.attackBonus += cfg.flankingAttackBonus || 2;
        out.notes.push(`Фланг: +${cfg.flankingAttackBonus} к атаке`);
      }
    }

    if (ctx.extraPenalty) out.attackBonus += ctx.extraPenalty;
    return out;
  }

  function validateAttack(engine, ctx) {
    const ok = { valid: true, reason: null, modifiers: null, suggestShift: false };

    if (!isEnabled(engine)) return ok;

    const attackerZone = ctx.attackerZone || getPlayerPosition(engine);
    const targetZone =
      ctx.targetZone != null
        ? normalizeZone(ctx.targetZone)
        : getEnemyPosition(engine, ctx.enemyIndex);

    const rangeType =
      ctx.rangeType ||
      (ctx.zoneReach === ZONE_REACH.SAME_ZONE
        ? RANGE_TYPES.MELEE
        : ctx.attackMode === 'ranged'
          ? RANGE_TYPES.RANGED
          : RANGE_TYPES.SPELL);

    if (rangeTypeRequiresSameZone(rangeType) && attackerZone !== targetZone) {
      return {
        valid: false,
        reason: `Дистанция «${rangeType}»: нужна одна зона с целью (вы: ${getZoneLabel(attackerZone)}, цель: ${getZoneLabel(targetZone)}). Переместитесь на соседнюю зону.`,
        suggestShift: true,
        modifiers: null
      };
    }

    ok.modifiers = getAttackModifiers(engine, {
      ...ctx,
      attackerZone,
      targetZone,
      rangeType
    });
    return ok;
  }

  function validateAbilityTarget(engine, ability, enemyIndex) {
    if (!isEnabled(engine)) return { valid: true };

    const rangeType = getAbilityRangeType(ability);
    const targetType = ability.targetType || ability.targeting?.scope;

    if (
      enemyIndex == null &&
      (targetType === 'area' || targetType === 'allEnemies' || targetType === 'all_enemies')
    ) {
      if (rangeTypeRequiresSameZone(rangeType)) {
        const pz = getPlayerPosition(engine);
        if (!hasLivingEnemyInZone(engine, pz)) {
          return {
            valid: false,
            reason: `В зоне «${getZoneLabel(pz)}» нет врагов (${rangeType}).`,
            suggestShift: false,
            modifiers: null
          };
        }
      }
      return { valid: true, modifiers: null };
    }

    if (enemyIndex == null) return { valid: true };

    return validateAttack(engine, {
      enemyIndex,
      rangeType,
      targetZone: getEnemyPosition(engine, enemyIndex)
    });
  }

  function getAbilityZoneUnavailableReason(engine, ability) {
    if (!isEnabled(engine) || !ability || !engine.state?.combat) return null;
    const rangeType = getAbilityRangeType(ability);
    if (!rangeTypeRequiresSameZone(rangeType)) return null;
    const pz = getPlayerPosition(engine);
    const scope = ability.targetType || ability.targeting?.scope;
    if (
      scope === 'singleEnemy' ||
      scope === 'single' ||
      scope === 'single_enemy' ||
      scope === 'area' ||
      scope === 'allEnemies' ||
      scope === 'all_enemies'
    ) {
      return hasLivingEnemyInZone(engine, pz)
        ? null
        : `Нет врагов в зоне «${getZoneLabel(pz)}» (${rangeType})`;
    }
    return null;
  }

  function rollD20(engine, modifiers) {
    const m = modifiers || {};
    if (m.advantage && !m.disadvantage) {
      const a = engine.d20();
      const b = engine.d20();
      return {
        roll: Math.max(a, b),
        advantage: true,
        detail: `max(${a}, ${b})`
      };
    }
    if (m.disadvantage && !m.advantage) {
      const a = engine.d20();
      const b = engine.d20();
      return {
        roll: Math.min(a, b),
        disadvantage: true,
        detail: `min(${a}, ${b})`
      };
    }
    return { roll: engine.d20() };
  }

  function getZoneStepToward(fromZone, toZone) {
    const from = zoneIndex(fromZone);
    const to = zoneIndex(toZone);
    if (from === to) return null;
    if (to > from) return ZONE_ORDER[from + 1];
    return ZONE_ORDER[from - 1];
  }

  function getZoneStepAway(fromZone, toZone) {
    const from = zoneIndex(fromZone);
    const to = zoneIndex(toZone);
    if (from === to) return null;
    if (to > from) return ZONE_ORDER[from - 1];
    return ZONE_ORDER[from + 1];
  }

  function canReachWithRangeType(attackerZone, targetZone, rangeType) {
    const a = normalizeZone(attackerZone);
    const t = normalizeZone(targetZone);
    if (rangeTypeRequiresSameZone(rangeType)) return a === t;
    return true;
  }

  /**
   * Перемещение врага на соседнюю зону (макс. 1 за ход на экземпляр).
   */
  function notifyZoneLeave(engine, leaveEvent) {
    if (!leaveEvent || leaveEvent.fromZone === leaveEvent.toZone) return;
    if (typeof OpportunityAttack !== 'undefined') {
      OpportunityAttack.onZoneLeave(engine, leaveEvent);
    }
  }

  function moveEnemyOneZone(engine, enemyIndex, nextZone) {
    const enemy = engine.state?.enemies?.[enemyIndex];
    if (!enemy || enemy.hp <= 0) return false;
    if (enemy.zoneMovedThisTurn) return false;
    const cur = getEnemyPosition(engine, enemyIndex);
    const next = normalizeZone(nextZone);
    if (!isAdjacentZone(cur, next)) return false;
    setEnemyPosition(engine, enemyIndex, next);
    enemy.zoneMovedThisTurn = true;
    engine.log?.(
      `↔️ ${enemy.name}: ${getZoneLabel(cur)} → ${getZoneLabel(next)}`,
      'log-combat'
    );
    notifyZoneLeave(engine, {
      actorType: 'enemy',
      enemyIndex,
      fromZone: cur,
      toZone: next,
      actorName: enemy.name
    });
    engine.renderCombat?.();
    engine.updateCombatTimeline?.();
    return true;
  }

  function validateAttackAgainstPlayer(engine, enemyIndex, rangeType) {
    return validateAttack(engine, {
      attackerZone: getEnemyPosition(engine, enemyIndex),
      targetZone: getPlayerPosition(engine),
      rangeType,
      attackerIsEnemy: true
    });
  }

  function getShiftOptions(engine) {
    const cur = getPlayerPosition(engine);
    const idx = zoneIndex(cur);
    return {
      towardClose: idx < ZONE_ORDER.length - 1 ? ZONE_ORDER[idx + 1] : null,
      towardFar: idx > 0 ? ZONE_ORDER[idx - 1] : null,
      current: cur
    };
  }

  /**
   * @param {object} engine
   * @param {'toward_close'|'toward_far'} direction
   */
  function shiftPlayerPosition(engine, direction) {
    if (!engine.state?.combat) return false;
    if (engine.getCombatPhase?.() !== 'player_turn') {
      engine.log('Переместиться можно только в свой ход.', 'log-damage');
      return false;
    }

    if (engine.state.combat.zoneMovedThisTurn) {
      engine.log('В этом ходу уже перемещались (максимум 1 зона).', 'log-damage');
      return false;
    }

    const cfg = getConfig(engine);
    if (cfg.shiftCostsAction) {
      if (engine.state.combat.actionSpent && !engine.state.combat.actionSurge) {
        engine.log('Действие уже потрачено в этом ходу.', 'log-damage');
        return false;
      }
      engine.spendCombatActionType?.('action');
    }

    const opts = getShiftOptions(engine);
    const cur = opts.current;
    let next = null;
    if (direction === 'toward_close') next = opts.towardClose;
    else if (direction === 'toward_far') next = opts.towardFar;
    else next = normalizeZone(direction);

    if (!next || !isAdjacentZone(cur, next)) {
      engine.log('За один ход можно сменить только соседнюю зону.', 'log-damage');
      return false;
    }

    setPlayerPosition(engine, next);
    engine.state.combat.zoneMovedThisTurn = true;
    engine.log(
      `↔️ ${engine.state.charName || 'Герой'}: ${getZoneLabel(cur)} → ${getZoneLabel(next)}`,
      'log-combat'
    );
    notifyZoneLeave(engine, {
      actorType: 'player',
      fromZone: cur,
      toZone: next,
      actorName: engine.state.charName || 'Герой'
    });
    engine.renderCombat?.();
    engine.updateCombatTimeline?.();
    engine.playerCombatTurn?.();
    return true;
  }

  function shiftCostsAction(engine) {
    return getConfig(engine).shiftCostsAction === true;
  }

  function renderZoneBadge(zone, extraClass) {
    const z = normalizeZone(zone);
    const cls = ['combat-zone-badge', `combat-zone-badge--${z}`, extraClass || '']
      .filter(Boolean)
      .join(' ');
    return `<span class="${cls}" title="${getZoneLabel(z)}">${getZoneIcon(z)} ${getZoneLabel(z)}</span>`;
  }

  function renderZoneFieldHtml(engine, opts = {}) {
    if (!isEnabled(engine)) return '';
    const playerZone = getPlayerPosition(engine);
    const enemies = engine.state?.enemies || [];
    const byZone = { far: [], mid: [], close: [] };

    enemies.forEach((e, idx) => {
      if (e.hp <= 0 && !opts.showDead) return;
      const card = renderCombatantCard(engine, e, idx, opts);
      const z = getEnemyPosition(engine, e);
      byZone[z].push(card);
    });

    const playerCard =
      opts.hidePlayer && document.body.classList.contains('mobile')
        ? ''
        : renderPlayerCard(engine, playerZone, opts);

    const column = (zoneKey, cssKey) => {
      const units = byZone[zoneKey].join('') || '<div class="combat-zone-empty">—</div>';
      const playerHere = playerZone === zoneKey ? playerCard : '';
      return `
        <div class="combat-zone-column combat-zone-column--${cssKey}">
          <div class="combat-zone-column__head">${getZoneIcon(zoneKey)} ${getZoneLabel(zoneKey)}</div>
          <div class="combat-zone-column__body">
            ${playerHere}
            ${units}
          </div>
        </div>`;
    };

    return `
      <div class="combat-zone-field combat-zone-field--triple" aria-label="Позиции в бою">
        ${column(ZONES.FAR, 'far')}
        ${column(ZONES.MID, 'mid')}
        ${column(ZONES.CLOSE, 'close')}
      </div>`;
  }

  function renderPlayerCard(engine, zone, opts) {
    const pPct = Math.max(0, (engine.state.hp / engine.state.maxHp) * 100);
    const fx = engine.renderStatusEffectsHtml?.(engine.state.combat?.effects) || '';
    const selecting = engine.getCombatPhase?.() === 'select_target';
    return `
      <div class="combat-zone-unit combat-zone-unit--player ${selecting ? 'combat-zone-unit--selecting' : ''}">
        ${renderZoneBadge(zone, 'combat-zone-badge--on-card')}
        <div class="combat-zone-unit__name">${engine.escapeHtml(engine.state.charName || 'Герой')}</div>
        <div class="hp-bar-bg"><div class="hp-bar-fill" style="width:${pPct}%"></div></div>
        <span class="combat-hp-text">${engine.state.hp}/${engine.state.maxHp}</span>
        ${fx ? `<div class="combat-effects-row">${fx}</div>` : ''}
      </div>`;
  }

  function renderCombatantCard(engine, enemy, idx, opts) {
    const alive = enemy.hp > 0;
    const pct = Math.max(0, (enemy.hp / enemy.maxHp) * 100);
    const zone = getEnemyPosition(engine, enemy);
    const selecting = engine.getCombatPhase?.() === 'select_target';
    let rowClass = 'combat-zone-unit combat-zone-unit--enemy';
    if (!alive) rowClass += ' combat-zone-unit--dead';
    if (selecting && alive) rowClass += ' combat-zone-unit--targetable';
    const clickAttr =
      selecting && alive
        ? ` role="button" tabindex="0" onclick="GameEngine.onCombatEnemyClick(${idx})"`
        : '';
    const flank = hasFlankingOnEnemy(engine, idx);
    const flankTag = flank
      ? '<span class="combat-zone-flank" title="Фланг: атаки с разных зон">⊞</span>'
      : '';

    return `
      <div class="${rowClass}" data-enemy-index="${idx}"${clickAttr}>
        ${renderZoneBadge(zone, 'combat-zone-badge--on-card')}
        ${flankTag}
        <div class="combat-zone-unit__name">${engine.escapeHtml(engine.getEnemyDisplayName(enemy))}</div>
        <div class="hp-bar-bg"><div class="hp-bar-fill" style="width:${pct}%"></div></div>
        <span class="combat-hp-text">${enemy.hp}/${enemy.maxHp}</span>
      </div>`;
  }

  function syncParticipantPositions(engine, participants) {
    if (!participants?.length) return participants;
    return participants.map((p) => {
      if (p.type === 'player') {
        return { ...p, position: getPlayerPosition(engine) };
      }
      if (p.type === 'enemy' && p.enemyIndex != null) {
        return {
          ...p,
          position: getEnemyPosition(engine, p.enemyIndex)
        };
      }
      return p;
    });
  }

  const CombatPosition = {
    ZONES,
    ZONE_ORDER,
    RANGE_TYPES,
    SAME_ZONE_RANGE_TYPES,
    ZONE_REACH,
    getConfig,
    isEnabled,
    migrateLegacyZone,
    normalizeZone,
    zoneIndex,
    getZoneDistance,
    isAdjacentZone,
    isWeaponRanged,
    initCombatPositions,
    resetTurnMovement,
    getPlayerPosition,
    getEnemyPosition,
    setPlayerPosition,
    setEnemyPosition,
    normalizeRangeType,
    rangeTypeRequiresSameZone,
    rangeTypeToZoneReach,
    getAbilityRangeType,
    getWeaponRangeType,
    getAttackModeFromProfile,
    getAttackModeFromAbility,
    getAttackModeFromRangeType,
    getAbilityZoneReach,
    getWeaponZoneReach,
    getAbilityZoneUnavailableReason,
    validateAttack,
    validateAbilityTarget,
    getAttackModifiers,
    recordAttackOnEnemy,
    hasFlankingOnEnemy,
    rollD20,
    getZoneStepToward,
    getZoneStepAway,
    canReachWithRangeType,
    moveEnemyOneZone,
    notifyZoneLeave,
    validateAttackAgainstPlayer,
    hasHostileInAttackerZone,
    getShiftOptions,
    shiftPlayerPosition,
    shiftCostsAction,
    renderZoneBadge,
    renderZoneFieldHtml,
    syncParticipantPositions,
    getZoneLabel,
    getZoneIcon
  };

  global.CombatPosition = CombatPosition;
})(typeof window !== 'undefined' ? window : globalThis);
