/**
 * CombatManager — data-driven разбор и выполнение боевых действий (abilities / actions).
 * Обратная совместимость: effect (строка/объект), actionType, targeting.scope, cost.
 * @module CombatManager
 */
(function (global) {
  'use strict';

  const TARGET_TYPES = {
    self: 'self',
    singleEnemy: 'singleEnemy',
    allEnemies: 'allEnemies',
    singleAlly: 'singleAlly',
    allAllies: 'allAllies',
    area: 'area'
  };

  const SCOPE_TO_TARGET = {
    single: TARGET_TYPES.singleEnemy,
    single_enemy: TARGET_TYPES.singleEnemy,
    all_enemies: TARGET_TYPES.allEnemies,
    area: TARGET_TYPES.area,
    self: TARGET_TYPES.self
  };

  const TARGET_TO_SCOPE = {
    [TARGET_TYPES.singleEnemy]: 'single',
    [TARGET_TYPES.allEnemies]: 'all_enemies',
    [TARGET_TYPES.area]: 'area',
    [TARGET_TYPES.self]: 'self',
    [TARGET_TYPES.singleAlly]: 'self',
    [TARGET_TYPES.allAllies]: 'self'
  };

  const REQUIREMENT_HANDLERS = {
    frontline(engine) {
      return REQUIREMENT_HANDLERS.close_zone(engine);
    },
    close_zone(engine) {
      if (!engine.state?.combat) return { ok: false, reason: 'Только в бою' };
      if (typeof CombatPosition !== 'undefined' && CombatPosition.isEnabled(engine)) {
        const z = CombatPosition.getPlayerPosition(engine);
        if (z !== CombatPosition.ZONES.CLOSE) {
          return {
            ok: false,
            reason: `Нужна ближняя зона (Close) — сейчас «${CombatPosition.getZoneLabel(z)}». Переместитесь на 1 зону.`
          };
        }
        return { ok: true };
      }
      const alive = (engine.state.enemies || []).some((e) => e.hp > 0);
      return alive
        ? { ok: true }
        : { ok: false, reason: 'Нет противников в ближнем бою' };
    },
    hasWeaponEquipped(engine) {
      const slots = ['weapon_main', 'weapon_off', 'weapon'];
      const has = slots.some((s) => {
        const id = engine.getEquippedItemId?.(s);
        if (!id) return false;
        const db = engine.itemsData?.[id] || engine.data?.items?.[id];
        return db && (db.type === 'weapon' || db.slot === 'weapon');
      });
      return has
        ? { ok: true }
        : { ok: false, reason: 'Нужно экипированное оружие' };
    },
    notSurprised(engine) {
      const surprised =
        engine.state?.combat?.playerSurprised ||
        (typeof StatusManager !== 'undefined' &&
          StatusManager.hasStatus(StatusManager.getPlayerHolder(engine), 'surprised'));
      if (surprised) {
        return { ok: false, reason: 'Вы застигнуты врасплох' };
      }
      return { ok: true };
    }
  };

  function getRulesSystem(engine) {
    if (engine?.isPf2e?.()) return 'pf2e';
    return 'dnd5e';
  }

  /** Запись в CombatLog с fallback на engine.log */
  function combatLog(engine, type, data = {}) {
    const payload = {
      ...data,
      message: data.message ?? data.text ?? '',
      engine
    };
    if (typeof CombatLog !== 'undefined') {
      return CombatLog.log(engine, type, payload);
    }
    const legacy = {
      damage: 'log-damage',
      crit: 'log-damage',
      heal: 'log-heal',
      miss: 'log-dice',
      fail: 'log-dice',
      effect: 'log-combat',
      status: 'log-combat',
      buff: 'log-combat',
      combat: 'log-combat',
      ability: 'log-combat',
      death: 'log-combat'
    };
    engine?.log?.(payload.message, legacy[type] || 'log-combat');
    return null;
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj ?? {}));
  }

  /**
   * Нормализует actionCost под активную систему.
   */
  function resolveActionCost(raw, system) {
    if (!raw || typeof raw !== 'object') return null;

    if (raw[system]) return clone(raw[system]);

    if (system === 'pf2e' && raw.actions != null) {
      return { actions: Number(raw.actions) || 1 };
    }
    if (system === 'dnd5e') {
      if (
        raw.action != null ||
        raw.bonusAction != null ||
        raw.reaction != null
      ) {
        return {
          action: Number(raw.action) || 0,
          bonusAction: Number(raw.bonusAction) || 0,
          reaction: Number(raw.reaction) || 0
        };
      }
    }
    if (raw.action != null || raw.bonusAction != null || raw.reaction != null) {
      return {
        action: Number(raw.action) || 0,
        bonusAction: Number(raw.bonusAction) || 0,
        reaction: Number(raw.reaction) || 0
      };
    }
    if (raw.actions != null) return { actions: Number(raw.actions) || 1 };
    return null;
  }

  function legacyActionTypeToCost(actionType) {
    switch (actionType) {
      case 'bonus_action':
        return { action: 0, bonusAction: 1, reaction: 0 };
      case 'reaction':
        return { action: 0, bonusAction: 0, reaction: 1 };
      case 'free':
        return { action: 0, bonusAction: 0, reaction: 0 };
      case 'passive':
        return null;
      default:
        return { action: 1, bonusAction: 0, reaction: 0 };
    }
  }

  function inferTargetType(action) {
    if (action.targetType && TARGET_TYPES[action.targetType]) {
      return action.targetType;
    }
    const scope =
      action.targeting?.scope ||
      action.effects?.find((e) => e?.targeting?.scope)?.targeting?.scope;
    if (scope && SCOPE_TO_TARGET[scope]) return SCOPE_TO_TARGET[scope];
    if (Array.isArray(action.effects)) {
      for (const ef of action.effects) {
        if (ef?.allTargets) return TARGET_TYPES.allEnemies;
        if (ef?.type === 'heal' && !ef.targeting) return TARGET_TYPES.self;
      }
    }
    if (typeof action.effect === 'string') {
      if (action.effect.startsWith('heal:')) return TARGET_TYPES.self;
      if (action.effect.startsWith('aoe_') || action.effect.includes('all')) {
        return TARGET_TYPES.allEnemies;
      }
      if (action.effect.startsWith('damage:')) return TARGET_TYPES.singleEnemy;
    }
    if (action.effect?.type === 'heal') return TARGET_TYPES.self;
    if (action.effect?.allTargets || action.effect?.targeting?.scope === 'all_enemies') {
      return TARGET_TYPES.allEnemies;
    }
    if (action.effect?.type === 'damage' || action.effect?.type === 'apply_status') {
      return TARGET_TYPES.singleEnemy;
    }
    return TARGET_TYPES.self;
  }

  function ensureTargeting(action) {
    const targetType = action.targetType || inferTargetType(action);
    const scope = TARGET_TO_SCOPE[targetType] || 'self';
    if (!action.targeting) action.targeting = { scope };
    else if (!action.targeting.scope) action.targeting.scope = scope;
    action.targetType = targetType;
    return action;
  }

  function normalizeEffects(action) {
    if (Array.isArray(action.effects) && action.effects.length) {
      return action.effects.map((ef) => {
        if (typeof ef === 'string') return legacyStringToEffect(ef);
        return clone(ef);
      });
    }
    if (action.effect != null) {
      if (typeof action.effect === 'string') {
        return [legacyStringToEffect(action.effect)];
      }
      return [clone(action.effect)];
    }
    return [];
  }

  function legacyStringToEffect(str) {
    const s = String(str);
    if (s.startsWith('heal:')) {
      return { type: 'heal', value: s.slice(5) };
    }
    if (s.startsWith('damage:')) {
      return {
        type: 'damage',
        value: s.slice(7),
        targeting: { scope: 'single' }
      };
    }
    if (s.startsWith('ac_bonus:')) {
      return {
        type: 'grantBonus',
        stat: 'ac',
        value: parseInt(s.split(':')[1], 10) || 0,
        duration: 'turn'
      };
    }
    if (s.startsWith('aoe_fire:')) {
      return {
        type: 'damage',
        value: s.slice(9),
        damageType: 'fire',
        targeting: { scope: 'all_enemies' },
        allTargets: true
      };
    }
    if (s.startsWith('smite:')) {
      return { type: 'smite', value: s.slice(6) };
    }
    if (s === 'extra_attack') return { type: 'extra_attack' };
    if (s === 'magic_missile') return { type: 'magic_missile' };
    return { type: 'custom', message: s };
  }

  function inferActionTypeFromCost(cost, system) {
    if (!cost) return 'passive';
    if (system === 'pf2e') return 'action';
    if (cost.reaction) return 'reaction';
    if (cost.bonusAction && !cost.action) return 'bonus_action';
    if (!cost.action && !cost.bonusAction && !cost.reaction) return 'free';
    return 'action';
  }

  /**
   * Парсинг действия в единую структуру (idempotent).
   * @param {object} raw
   * @param {object} [opts]
   * @param {string} [opts.system]
   * @returns {object}
   */
  function parseAction(raw, opts = {}) {
    const action = clone(raw);
    if (!action.id) action.id = 'action_' + Math.random().toString(36).slice(2, 9);

    const system = opts.system || 'dnd5e';

    let actionCost = resolveActionCost(action.actionCost, system);
    if (!actionCost && action.actionType) {
      actionCost = legacyActionTypeToCost(action.actionType);
    }
    if (!actionCost && action.type === 'passive') {
      actionCost = null;
    }
    if (!actionCost && system === 'pf2e' && action.cost != null) {
      actionCost = { actions: Number(action.cost) || 1 };
    }
    if (!actionCost && system === 'dnd5e' && !action.passive && action.type !== 'passive') {
      const legacyType =
        action.actionType ||
        (action.type === 'passive' ? 'passive' : 'action');
      actionCost = legacyActionTypeToCost(legacyType);
    }

    action._parsedSystem = system;
    action.actionCost = actionCost;
    action.actionType =
      action.actionType || inferActionTypeFromCost(actionCost, system);

    action.effects = normalizeEffects(action);
    ensureTargeting(action);

    if (action.range == null && action.targeting?.range != null) {
      action.range = action.targeting.range;
    }

    action.requirements = Array.isArray(action.requirements)
      ? [...action.requirements]
      : [];

    action.tags = Array.isArray(action.tags) ? [...action.tags] : [];

    if (action.soundEffect && !action.soundCast) {
      action.soundCast = action.soundEffect;
    }

    action._combatParsed = true;
    return action;
  }

  function checkRequirements(engine, action) {
    const reqs = action.requirements || [];
    for (const key of reqs) {
      const fn = REQUIREMENT_HANDLERS[key];
      if (!fn) continue;
      const res = fn(engine, action);
      if (res && !res.ok) return res;
    }
    return { ok: true };
  }

  function canAffordDnd5eCost(engine, cost) {
    const c = engine.state.combat;
    if (!c) return true;
    if (cost.action && c.actionSpent && !c.actionSurge) return false;
    if (cost.bonusAction && c.bonusActionSpent) return false;
    if (cost.reaction && !c.reactionAvailable) return false;
    return true;
  }

  function spendDnd5eCost(engine, cost) {
    if (!cost || !engine.state.combat) return;
    if (cost.action && !engine.state.combat.actionSurge) {
      engine.spendCombatActionType('action');
    }
    if (cost.bonusAction) engine.spendCombatActionType('bonus_action');
    if (cost.reaction) engine.spendCombatActionType('reaction');
  }

  function canAffordPf2eCost(engine, cost) {
    if (!engine.state.combat || !cost?.actions) return true;
    return (
      (engine.state.combat.actionsRemaining ?? 0) >= (cost.actions || 1)
    );
  }

  function spendPf2eCost(engine, action, cost) {
    const n = cost?.actions ?? action?.cost ?? 1;
    engine.spendPf2eActions?.(n);
  }

  function getUnavailableFromEconomy(engine, action) {
    const system = action._parsedSystem || getRulesSystem(engine);
    const cost = action.actionCost;
    if (!cost || action.actionType === 'passive') return null;

    if (system === 'pf2e') {
      if (!canAffordPf2eCost(engine, cost)) {
        return `Нужно ${cost.actions || 1} действий`;
      }
      return null;
    }

    if (action.actionType === 'reaction') {
      return 'Реакция срабатывает по триггеру';
    }
    if (!canAffordDnd5eCost(engine, cost)) {
      if (cost.bonusAction && !cost.action) return 'Бонусное действие потрачено';
      if (cost.reaction) return 'Реакция уже использована';
      return 'Действие потрачено';
    }
    return null;
  }

  function needsTargetSelection(action) {
    if (action.actionType === 'passive' || action.type === 'passive') {
      return false;
    }
    const tt = action.targetType;
    return tt === TARGET_TYPES.singleEnemy || tt === TARGET_TYPES.singleAlly;
  }

  function effectNeedsEnemyTarget(effect) {
    if (!effect || typeof effect !== 'object') return false;
    if (effect.type === 'damage' || effect.type === 'apply_status') {
      const scope = effect.targeting?.scope;
      return !scope || scope === 'single' || scope === 'single_enemy';
    }
    return false;
  }

  function actionNeedsEnemyTarget(action) {
    if (!needsTargetSelection(action)) return false;
    if (action.targetType === TARGET_TYPES.singleEnemy) {
      return (action.effects || []).some(effectNeedsEnemyTarget) || !!action.effect;
    }
    return false;
  }

  function attachTargetingToEffects(action) {
    const scope = TARGET_TO_SCOPE[action.targetType] || 'self';
    (action.effects || []).forEach((ef) => {
      if (ef && typeof ef === 'object' && !ef.targeting) {
        ef.targeting = { scope };
      }
      if (
        action.targetType === TARGET_TYPES.allEnemies ||
        action.targetType === TARGET_TYPES.area
      ) {
        ef.allTargets = true;
      }
    });
  }

  function applyGrantBonus(engine, effect) {
    const val = parseInt(effect.value, 10) || 0;
    const stat = effect.stat || effect.buffType || 'atk';
    if (!engine.state.combat) {
      engine.log('Бонус действует только в бою.', 'log-dice');
      return true;
    }
    if (stat === 'ac') {
      engine.applyAcBonus?.(val);
    } else if (stat === 'atk') {
      engine.state.combat.tempAtkBonus =
        (engine.state.combat.tempAtkBonus || 0) + val;
      combatLog(engine, 'buff', {
        message: `⚔️ ${val >= 0 ? '+' : ''}${val} к атаке (${effect.duration || 'ход'})`
      });
    } else if (stat === 'dmg') {
      engine.state.combat.tempDmgBonus =
        (engine.state.combat.tempDmgBonus || 0) + val;
      combatLog(engine, 'buff', {
        message: `💥 ${val >= 0 ? '+' : ''}${val} к урону (${effect.duration || 'ход'})`
      });
    } else {
      combatLog(engine, 'buff', { message: `Бонус ${stat}: ${val}` });
    }
    engine.playCombatSound?.('buff');
    return true;
  }

  function applyRemoveStatus(engine, effect, target) {
    const statusId = effect.statusId || effect.status;
    if (typeof StatusManager !== 'undefined') {
      if (effect.target === 'self' || !target) {
        const holder = StatusManager.getPlayerHolder(engine);
        StatusManager.remove(engine, holder, statusId);
        combatLog(engine, 'heal', { message: `✨ Снят эффект: ${statusId}` });
        return true;
      }
      const holder = StatusManager.getEnemyHolder(engine, target);
      if (holder) {
        StatusManager.remove(engine, holder, statusId);
        combatLog(engine, 'effect', {
          message: `✨ С ${target.name} снят ${statusId}`,
          target: target.name
        });
      }
      return true;
    }
    return true;
  }

  function applyMoveEffect(engine, effect) {
    const dist = effect.distance ?? effect.value ?? 0;
    combatLog(engine, 'position', { message: `🏃 Перемещение на ${dist} фт.` });
    return true;
  }

  function applyActionEffect(engine, effect, ctx) {
    if (!effect) return true;
    const target = ctx.target ?? null;

    switch (effect.type) {
      case 'grantBonus':
        return applyGrantBonus(engine, effect);
      case 'removeStatus':
        return applyRemoveStatus(engine, effect, target);
      case 'move':
        return applyMoveEffect(engine, effect);
      case 'apply_status':
        if (typeof StatusManager !== 'undefined') {
          return StatusManager.applyFromEffect(engine, effect, target);
        }
        return engine.applyAbilityAddEffect?.(effect, target) ?? true;
      default:
        if (typeof engine.applyEffect === 'function') {
          return engine.applyEffect(effect, target);
        }
        engine.log(`Эффект ${effect.type} не реализован`, 'log-dice');
        return true;
    }
  }

  function applyActionEffects(engine, action, ctx) {
    attachTargetingToEffects(action);
    let endsTurn = true;

    for (const effect of action.effects || []) {
      const result = applyActionEffect(engine, effect, ctx);
      if (result === false) endsTurn = false;
    }

    if (action.actionType === 'bonus_action' || action.actionType === 'free') {
      if (endsTurn !== false) endsTurn = false;
    } else if (action.actionType === 'action' && endsTurn !== false) {
      endsTurn = true;
    }

    return endsTurn;
  }

  function spendActionEconomy(engine, action) {
    const system = action._parsedSystem || getRulesSystem(engine);
    const cost = action.actionCost;
    if (!cost || !engine.state.combat) return;

    if (system === 'pf2e') {
      spendPf2eCost(engine, action, cost);
      return;
    }
    spendDnd5eCost(engine, cost);
  }

  /**
   * Выполнение действия (основная точка входа).
   * @param {object} engine — GameEngine
   * @param {object} rawAction — умение / действие из JSON
   * @param {object} [context]
   * @param {object} [context.target] — враг (объект)
   * @param {boolean} [context.skipEconomy] — не тратить action/bonus (уже потрачено)
   * @param {boolean} [context.skipResourceCost] — не тратить ячейки/ярость
   * @returns {{ success: boolean, endsTurn?: boolean, needsTarget?: boolean, reason?: string }}
   */
  function performAction(engine, rawAction, context = {}) {
    if (!engine || !rawAction) {
      return { success: false, reason: 'Нет действия' };
    }

    const system = getRulesSystem(engine);
    const action = rawAction._combatParsed
      ? rawAction
      : parseAction(rawAction, { system });

    if (action.flavorText) {
      combatLog(engine, 'ability', { message: action.flavorText });
    }

    const req = checkRequirements(engine, action);
    if (!req.ok) {
      combatLog(engine, 'fail', { message: `❌ ${req.reason}` });
      return { success: false, reason: req.reason };
    }

    if (!context.skipValidation) {
      const econ = getUnavailableFromEconomy(engine, action);
      if (econ) {
        combatLog(engine, 'fail', { message: `❌ ${econ}` });
        return { success: false, reason: econ };
      }
      if (
        engine.state.combat &&
        actionNeedsEnemyTarget(action) &&
        (!context.target ||
          context.target.hp == null ||
          context.target.hp <= 0)
      ) {
        return { success: true, needsTarget: true, endsTurn: false };
      }
    }

    if (!context.skipResourceCost && engine.spendAbilityCost) {
      if (!engine.canAffordAbility?.(action)) {
        combatLog(engine, 'fail', { message: '❌ Недостаточно ресурса!' });
        return { success: false, reason: 'resource' };
      }
      const spendPayload = { ...action };
      if (system === 'pf2e' && spendPayload.actionCost?.actions != null) {
        spendPayload._skipPf2eActionSpend = true;
      }
      engine.spendAbilityCost(spendPayload);
    }

    if (!context.skipEconomy) {
      spendActionEconomy(engine, action);
    }

    const castLv = engine.getCastSlotLevel?.(action);
    const minLv = engine.getAbilitySpellLevel?.(action);
    let castNote = '';
    if (engine.abilityUsesSpellSlots?.(action) && castLv >= 1) {
      castNote =
        castLv > minLv
          ? ` — ячейка ${castLv} круга (усилено)`
          : ` — круг ${castLv}`;
    }
    combatLog(engine, 'ability', {
      message: `💫 ${action.name}${castNote}`,
      actor: engine.state?.charName,
      target: context.target?.name
    });
    engine.playAbilityCast?.(action);

    engine._abilitySoundCtx = action;
    const endsTurn = applyActionEffects(engine, action, context);
    engine._abilitySoundCtx = null;

    if (engine.state.combat && engine.isConcentrationAbility?.(action)) {
      engine.beginConcentration?.(action);
    }

    if (engine.state.combat && action.oncePerCombat) {
      if (!engine.state.combat.abilitiesUsed) {
        engine.state.combat.abilitiesUsed = {};
      }
      engine.state.combat.abilitiesUsed[action.id] = true;
    }

    engine.updateStats?.();
    engine.renderCombat?.();

    return {
      success: true,
      endsTurn: endsTurn !== false,
      needsTarget: false
    };
  }

  function canPerformAction(engine, rawAction) {
    const action = rawAction._combatParsed
      ? rawAction
      : parseAction(rawAction, { system: getRulesSystem(engine) });
    const req = checkRequirements(engine, action);
    if (!req.ok) return req.reason;
    const econ = getUnavailableFromEconomy(engine, action);
    if (econ) return econ;
    if (engine.isSpellBlockedByCurse?.(action)) {
      return 'Проклятие безмолвия';
    }
    if (engine.canAffordAbility && !engine.canAffordAbility(action)) {
      return 'Недостаточно ресурса';
    }
    return null;
  }

  function normalizeAbilityForEngine(engine, ab, classKey, index) {
    const base = engine.normalizeAbility
      ? engine.normalizeAbility(ab, classKey, index)
      : clone(ab);
    return parseAction(base, { system: getRulesSystem(engine) });
  }

  function normalizeProgressionAbilities(data, engine) {
    const pool = data?.progression?.abilities;
    if (!pool) return;
    const system =
      data?.meta?.system === 'pf2e' ? 'pf2e' : 'dnd5e';
    Object.keys(pool).forEach((id) => {
      pool[id] = parseAction(pool[id], { system });
    });
  }

  const CombatManager = {
    TARGET_TYPES,
    parseAction,
    performAction,
    combatLog,
    canPerformAction,
    checkRequirements,
    needsTargetSelection,
    actionNeedsEnemyTarget,
    normalizeAbilityForEngine,
    normalizeProgressionAbilities,
    getRulesSystem,
    resolveActionCost
  };

  global.CombatManager = CombatManager;
})(typeof window !== 'undefined' ? window : globalThis);
