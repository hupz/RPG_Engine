// ============================================================
// engine/combat.js — боевая система
// ============================================================

(function attachEngineCombat() {
  'use strict';
  if (typeof GameEngine === 'undefined') {
    console.error('engine/combat.js: GameEngine не определён — загрузите core.js первым');
    return;
  }

  Object.assign(GameEngine, {
    // ========== БОЙ ==========

    /** Правила инициативы текущей сцены (combatInitiative в JSON сцены) */
    getCombatInitiativeRules() {
      if (typeof CombatTimeline !== 'undefined' && CombatTimeline.getSceneInitiativeRules) {
        return CombatTimeline.getSceneInitiativeRules(this);
      }
      return {};
    },

    /** Синхронизация combat.battleParticipants для UI (timeline) */
    syncBattleParticipants() {
      if (typeof CombatTimeline === 'undefined') return [];
      return CombatTimeline.syncBattleState(this);
    },

    updateCombatTimeline() {
      if (typeof CombatTimeline === 'undefined') return;
      if (!this.state.combat) {
        CombatTimeline.getInstance()?.hide();
        return;
      }
      const tl = CombatTimeline.attach(this);
      this.syncBattleParticipants();
      tl.update(this.state.combat, this);
    },

    /**
     * Бросок инициативы и порядок ходов.
     * Учитывает combatInitiative сцены: бонусы, засада, «враги ходят первыми».
     */
    buildCombatInitiativeOrder() {
      const rules = this.getCombatInitiativeRules();
      const pDie = this.d20();
      const pBonus = (this.state.classData?.initBonus ?? 0) + (rules.playerBonus || 0);
      const pRoll = pDie + pBonus;

      const eRolls = this.state.enemies.map((e, i) => {
        const die = this.d20();
        const bonus = (parseInt(e.dex, 10) || 2) + (rules.enemyBonus || 0);
        return { i, die, bonus, roll: die + bonus };
      });

      let order = [{ type: 'player', die: pDie, bonus: pBonus, roll: pRoll }];
      eRolls.forEach((e) => {
        order.push({ type: 'enemy', index: e.i, die: e.die, bonus: e.bonus, roll: e.roll });
      });

      if (rules.enemiesActFirst || rules.surpriseRound) {
        const enemies = order
          .filter((o) => o.type === 'enemy')
          .sort((a, b) => b.roll - a.roll);
        const player = order.find((o) => o.type === 'player');
        order = player ? [...enemies, player] : enemies;
      } else {
        order.sort((a, b) => {
          if (b.roll !== a.roll) return b.roll - a.roll;
          if (a.type === 'player') return -1;
          if (b.type === 'player') return 1;
          return 0;
        });
      }

      return { order, rules, pRoll };
    },

    /** Отложить ход (Delay) — игрок уходит в конец очереди */
    delayTurn() {
      return this.delayCombatTurn();
    },

    delayCombatTurn() {
      const combat = this.state.combat;
      if (!combat?.order?.length) return false;
      const idx = combat.turnIndex ?? 0;
      const turn = combat.order[idx];
      if (!turn || turn.type !== 'player') return false;
      if (this.getCombatPhase() !== 'player_turn') return false;

      const [entry] = combat.order.splice(idx, 1);
      entry.delayed = true;
      combat.order.push(entry);
      this.log('⏳ Ход отложен — вы будете ходить в конце раунда', 'log-combat');
      this.syncBattleParticipants();
      this.updateCombatTimeline();
      this.state.combat.turnIndex = idx;
      setTimeout(() => this.nextCombatTurn(), 400);
      return true;
    },

    /** Подготовленное действие (Ready) — пометка + передача хода */
    readyTurn() {
      const combat = this.state.combat;
      if (!combat?.order?.length) return false;
      const idx = combat.turnIndex ?? 0;
      const turn = combat.order[idx];
      if (!turn || turn.type !== 'player') return false;
      if (this.getCombatPhase() !== 'player_turn') return false;

      turn.ready = true;
      this.log('🛡️ Подготовленное действие — ход передан', 'log-combat');
      this.syncBattleParticipants();
      this.updateCombatTimeline();
      this.state.combat.turnIndex++;
      setTimeout(() => this.nextCombatTurn(), 400);
      return true;
    },

    /** Алиас для внешних модулей (timeline, тесты) */
    nextTurn() {
      return this.nextCombatTurn();
    },

    /** Смена зоны на 1 шаг: toward_close | toward_far */
    shiftCombatPosition(direction) {
      if (typeof CombatPosition !== 'undefined') {
        return CombatPosition.shiftPlayerPosition(this, direction);
      }
      return false;
    },

    /** Имя врага с уровнем скалирования для UI */
    getEnemyDisplayName(enemy) {
      const name = enemy?.name || 'Враг';
      const lv = enemy?.scaledLevel;
      if (lv > 1) return `${name} (Ур. ${lv})`;
      return name;
    },

    /** Настройки масштабирования врагов из game_data.json (вкладка «Прогрессия» редактора) */
    getEnemyScalingConfig() {
      const raw = this.data?.enemyScaling;
      if (typeof EnemyScaling !== 'undefined') {
        return EnemyScaling.ensureConfig(raw);
      }
      return { enabled: raw?.enabled !== false, scaling: {} };
    },

    /**
     * Масштабирование врага под уровень игрока (таблица enemyScaling.scaling).
     * scaleWithPlayerLevel === false — базовые статы; boss — доп. множитель bossHpRate.
     */
    scaleEnemyForPlayerLevel(enemy) {
      const level = Math.max(1, parseInt(this.state.level, 10) || 1);
      const cfg = this.getEnemyScalingConfig();
      if (typeof EnemyScaling !== 'undefined') {
        return EnemyScaling.scaleEnemy(enemy, level, cfg);
      }
      if (this.activeSystem?.scaleEnemy) {
        return this.activeSystem.scaleEnemy(enemy, level, cfg, this.data);
      }
      const scaled = { ...enemy };
      scaled.hp = parseInt(enemy.hp ?? enemy.maxHp, 10) || 1;
      scaled.maxHp = scaled.hp;
      return scaled;
    },

    /** Текущая фаза боя (player_turn | select_target | enemy_turn) */
    getCombatPhase() {
      if (!this.state.combat) return null;
      if (this.state.combat.phase) return this.state.combat.phase;
      return this.state.combat.playerTurn ? 'player_turn' : 'enemy_turn';
    },

    /** Игрок может действовать (ход или выбор цели) */
    isPlayerCombatPhase() {
      const phase = this.getCombatPhase();
      return phase === 'player_turn' || phase === 'select_target';
    },

    setCombatPhase(phase) {
      if (!this.state.combat) return;
      this.state.combat.phase = phase;
      if (phase === 'enemy_turn') {
        this.state.combat.playerTurn = false;
      } else {
        this.state.combat.playerTurn = true;
      }
      this.updateCombatTargetHint();
    },

    /** scope из ability.targeting или effect.targeting */
    getAbilityTargetingScope(ability) {
      if (!ability) return null;
      if (Array.isArray(ability.effects)) {
        for (const ef of ability.effects) {
          if (ef?.allTargets) return 'all_enemies';
          const s = ef?.targeting?.scope;
          if (s === 'all_enemies' || s === 'area') return 'all_enemies';
        }
      }
      if (ability.effect?.allTargets) return 'all_enemies';
      if (ability.targeting?.scope) return ability.targeting.scope;
      if (ability.effect?.targeting?.scope) return ability.effect.targeting.scope;
      if (Array.isArray(ability.effects)) {
        for (const ef of ability.effects) {
          if (ef?.targeting?.scope) return ef.targeting.scope;
        }
      }
      return null;
    },

    /** Умение требует клика по живому врагу (урон по одной цели) */
    abilityRequiresEnemyTarget(ability) {
      if (!ability || !this.state.combat) return false;
      if (typeof CombatManager !== 'undefined') {
        const parsed = ability._combatParsed
          ? ability
          : CombatManager.parseAction(ability, {
              system: CombatManager.getRulesSystem(this)
            });
        return CombatManager.actionNeedsEnemyTarget(parsed);
      }
      const scope = this.getAbilityTargetingScope(ability);
      if (scope !== 'single') return false;
      const effects = [];
      if (Array.isArray(ability.effects)) effects.push(...ability.effects);
      else if (ability.effect) effects.push(ability.effect);
      for (const ef of effects) {
        if (!ef || typeof ef !== 'object') continue;
        if (ef.type === 'damage' || ef.type === 'apply_status') return true;
      }
      return false;
    },

    getAliveEnemyIndices() {
      return (this.state.enemies || [])
        .map((e, i) => (e.hp > 0 ? i : -1))
        .filter(i => i >= 0);
    },

    updateCombatTargetHint() {
      const el = document.getElementById('combat-target-hint');
      if (!el) return;
      if (!this.state.combat) {
        el.classList.add('hidden');
        el.innerHTML = '';
        return;
      }
      const phase = this.getCombatPhase();
      const pendingAb = this.state.combat?.pendingAbility;
      const pendingItemId = this.state.combat?.pendingConsumableId;
      const pendingItem = pendingItemId ? this.data?.items?.[pendingItemId] : null;
      const pendingLabel = pendingAb?.name || pendingItem?.name;
      if (phase === 'select_target' && pendingLabel) {
        el.classList.remove('hidden');
        el.innerHTML = `
          <div class="combat-target-hint-title">🎯 Выберите цель для «${this.escapeHtml(pendingLabel)}»</div>
          <div>Кликните по подсвеченному врагу. <kbd>Esc</kbd> — отмена.</div>
          <button type="button" class="btn btn-secondary combat-target-cancel" onclick="GameEngine.cancelAbilityTargetSelect()">Отмена</button>`;
      } else {
        el.classList.add('hidden');
        el.innerHTML = '';
      }
    },

    /** Ожидание клика по врагу (scope: single, урон по цели) */
    beginAbilityTargetSelect(ability) {
      if (!this.state.combat || !ability) return;
      const alive = this.getAliveEnemyIndices();
      if (!alive.length) {
        this.nextCombatTurn();
        return;
      }
      this.state.combat.pendingAbility = ability;
      this.state.combat.pendingConsumableId = null;
      this.setCombatPhase('select_target');
      this.renderCombat();
      this.playerCombatTurn();
    },

    cancelAbilityTargetSelect() {
      if (this.getCombatPhase() !== 'select_target') return;
      this.state.combat.pendingAbility = null;
      this.state.combat.pendingConsumableId = null;
      this.setCombatPhase('player_turn');
      this.renderCombat();
      this.playerCombatTurn();
      this.log('Выбор цели отменён.', 'log-dice');
    },

    onCombatEnemyClick(enemyIndex) {
      if (this.getCombatPhase() !== 'select_target') return;
      const enemy = this.state.enemies?.[enemyIndex];
      if (!enemy || enemy.hp <= 0) return;

      const pendingAb = this.state.combat?.pendingAbility;
      if (
        pendingAb &&
        typeof CombatPosition !== 'undefined' &&
        CombatPosition.isEnabled(this)
      ) {
        const v = CombatPosition.validateAbilityTarget(this, pendingAb, enemyIndex);
        if (!v.valid) {
          this.log(`❌ ${v.reason}`, 'log-damage');
          return;
        }
      }

      const itemId = this.state.combat?.pendingConsumableId;
      if (itemId) {
        const db = this.data?.items?.[itemId];
        if (!db || !this.state.inventory.includes(itemId)) {
          this.cancelAbilityTargetSelect();
          return;
        }
        this.state.combat.pendingConsumableId = null;
        this.setCombatPhase('player_turn');
        this.updateCombatTargetHint();
        const result = this.applyConsumableUseEffect(itemId, db, { enemy });
        this.finishConsumableCombatTurn(itemId, result.itemRemoved);
        return;
      }

      const ability = this.state.combat?.pendingAbility;
      if (!ability) {
        this.cancelAbilityTargetSelect();
        return;
      }
      this.state.combat.pendingAbility = null;
      this.setCombatPhase('player_turn');
      this.updateCombatTargetHint();
      this.executeAbility(ability, enemy);
    },

    /**
     * Применение умения после оплаты стоимости (target — объект врага для scope: single).
     */
    executeAbility(ability, target = null) {
      const scheduleNextTurn = (delay = 600) => {
        if (this._combatTurnScheduled) return;
        this._combatTurnScheduled = true;
        setTimeout(() => this.nextCombatTurn(), delay);
      };

      if (typeof CombatManager !== 'undefined') {
        const parsed = ability._combatParsed
          ? ability
          : CombatManager.parseAction(ability, {
              system: CombatManager.getRulesSystem(this)
            });
        const res = CombatManager.performAction(this, parsed, {
          target,
          skipValidation: true
        });
        if (!res.success) return;

        const endsTurn = res.endsTurn !== false;

        if (!this.state.combat) return;

        if (this.state.enemies.every(e => e.hp <= 0)) {
          scheduleNextTurn(600);
          return;
        }

        if (this.isPf2e() && this.state.combat) {
          if (this.endPf2ePlayerTurnIfNoActions()) return;
        }

        if (!endsTurn) {
          this.playerCombatTurn();
          return;
        }

        this.state.combat.turnIndex++;
        scheduleNextTurn(600);
        return;
      }

      const actionType = this.getAbilityActionType(ability);
      if (this.state.combat) {
        if (actionType === 'action') this.spendCombatActionType('action');
        if (actionType === 'bonus_action') this.spendCombatActionType('bonus_action');
      }

      this.spendAbilityCost(ability);
      const castLv = this.getCastSlotLevel(ability);
      const minLv = this.getAbilitySpellLevel(ability);
      let castNote = '';
      if (this.abilityUsesSpellSlots(ability) && castLv >= 1) {
        castNote = castLv > minLv ? ` — ячейка ${castLv} круга (усилено)` : ` — круг ${castLv}`;
      }
      this.log(`💫 ${ability.name}${castNote}`, 'log-info');
      this.playAbilityCast(ability);

      let endsTurn = this.applyAbilityLogic(ability, target);
      if (actionType === 'bonus_action' || actionType === 'free') {
        if (endsTurn !== false) endsTurn = false;
      } else if (actionType === 'action' && endsTurn !== false) {
        endsTurn = true;
      }

      if (this.state.combat && this.isConcentrationAbility(ability)) {
        if (typeof this.beginConcentration === 'function') {
          this.beginConcentration(ability);
        }
      }

      if (this.state.combat && ability.oncePerCombat) {
        if (!this.state.combat.abilitiesUsed) this.state.combat.abilitiesUsed = {};
        this.state.combat.abilitiesUsed[ability.id] = true;
      }

      this.updateStats();

      if (!this.state.combat) return;

      this.renderCombat();

      if (this.state.enemies.every(e => e.hp <= 0)) {
        scheduleNextTurn(600);
        return;
      }

      if (this.isPf2e() && this.state.combat) {
        if (!this.endPf2ePlayerTurnIfNoActions()) {
          this.playerCombatTurn();
        }
        return;
      }

      if (!endsTurn) {
        this.playerCombatTurn();
        return;
      }

      this.state.combat.turnIndex++;
      scheduleNextTurn(600);
      return;
    },

    startCombat(enemies, nextScene, enemyIds) {
      const ids = enemyIds || enemies.map(e => e.id).filter(Boolean);
      this.state.combat = {
        round: 1,
        nextScene: nextScene,
        playerTurn: false,
        /** Фаза боя: player_turn | select_target | enemy_turn */
        phase: 'enemy_turn',
        pendingAbility: null,
        /** Расходник, ожидающий выбора врага (target: single_enemy) */
        pendingConsumableId: null,
        abilitiesUsed: {},
        /** ID шаблонов врагов из data.enemies (для loot и опыта) */
        enemies: ids,
        enemyIds: ids,
        expKey: `combat:${this.state.scene}`,
        effects: [],
        effectAcMod: 0,
        effectAtkMod: 0,
        concentration: null,
        actionSpent: false,
        bonusActionSpent: false,
        reactionAvailable: true,
        extraAttackUsed: false,
        rageActive: false,
        tempDmgBonus: 0
      };
      const playerLevel = Math.max(1, parseInt(this.state.level, 10) || 1);
      this.state.enemies = enemies.map(e => {
        const scaled = this.scaleEnemyForPlayerLevel(e);
        const tpl = this.data?.enemies?.[scaled.id];
        return {
          ...scaled,
          maxHp: scaled.hp,
          effects: [],
          _baseAc: scaled.ac,
          _baseAtkBonus: scaled.atkBonus,
          combatRole: scaled.combatRole || tpl?.combatRole,
          attacks: scaled.attacks || tpl?.attacks,
          combatAbilities: scaled.combatAbilities || tpl?.combatAbilities,
          reactionAvailable: true
        };
      });
      if (typeof CombatPosition !== 'undefined') {
        CombatPosition.initCombatPositions(this);
      }
      if (typeof OpportunityAttack !== 'undefined') {
        OpportunityAttack.initReactionState(this);
      } else {
        this.state.combat.reactionAvailable = true;
      }
      if (typeof CombatLog !== 'undefined') {
        CombatLog.attach(this).startCombat(this, 1);
      }
      if (playerLevel > 1) {
        this.log(`⚔️ Противники усилены под уровень ${playerLevel}`, 'log-combat');
      }
      if (typeof CombatPosition !== 'undefined' && CombatPosition.isEnabled(this)) {
        const pz = CombatPosition.getZoneLabel(CombatPosition.getPlayerPosition(this));
        this.log(`📍 Позиция героя: ${pz}`, 'log-combat');
      }
      this.renderCombat();
      const init = this.buildCombatInitiativeOrder();
      this.state.combat.order = init.order;
      this.state.combat.initiativeRules = init.rules;
      if (typeof StatusManager !== 'undefined') {
        StatusManager.applyAmbushSurprise(this, init.rules);
      }
      this.state.combat.turnIndex = 0;
      this.state.combat.battleParticipants = [];
      if (this.isPf2e()) this.resetPf2eCombatActions();
      this.syncBattleParticipants();
      this.combatLog('combat', {
        message: `⚔️ Инициатива ${this.state.charName}: ${init.pRoll}`,
        round: 1
      });
      this.updateCombatTimeline();
      this.nextCombatTurn();
    },

    renderCombat() {
      const area = document.getElementById('combat-area');
      if (!area) return;
      area.classList.remove('hidden');
      this.ensureCombatEffectsState();

      let pf2eActionsHtml = '';
      if (this.isPf2e() && this.state.combat) {
        const actionsLeft = this.state.combat.actionsRemaining ?? this.getPf2eActionsPerTurn();
        const filled = '◆'.repeat(Math.max(0, actionsLeft));
        const empty = '◇'.repeat(Math.max(0, this.getPf2eActionsPerTurn() - actionsLeft));
        pf2eActionsHtml = `<div class="pf2e-actions-indicator" title="Осталось действий в ход">⚡ Действия: ${filled}${empty}</div>`;
      }

      const isMobileCombat = document.body.classList.contains('mobile');
      const playerFx = this.renderStatusEffectsHtml(this.state.combat?.effects);
      const pPct = Math.max(0, (this.state.hp / this.state.maxHp) * 100);

      let html = pf2eActionsHtml;

      if (typeof CombatPosition !== 'undefined' && CombatPosition.isEnabled(this)) {
        html += `<p class="combat-zone-hint">Фронт — мили; тыл — дистанция. С фронта по тылу: −2. Фланг (⊞): атаки с обеих зон за раунд.</p>`;
        html += CombatPosition.renderZoneFieldHtml(this, {
          hidePlayer: isMobileCombat
        });
      }

      const zoneUi =
        typeof CombatPosition !== 'undefined' && CombatPosition.isEnabled(this);
      /* На мобильном игрок только в сайдбаре — не дублируем в списке боя */
      if (!isMobileCombat && !zoneUi) {
        html += '<div class="combat-player-row">';
        const dualIcon = this.hasDualWieldSetup() ? ' <span title="Два оружия">⚔️</span>' : '';
        html += `<span class="combat-unit-name">${this.escapeHtml(this.state.charName || 'Герой')}${dualIcon}</span>`;
        html += `<div class="hp-bar-bg"><div class="hp-bar-fill" style="width:${pPct}%"></div></div>`;
        html += `<span class="combat-hp-text">${this.state.hp}/${this.state.maxHp}</span>`;
        if (playerFx) html += `<div class="combat-effects-row">${playerFx}</div>`;
        const conc = this.state.combat?.concentration;
        if (conc?.label) {
          html += `<div class="combat-concentration-row"><span class="concentration-active" title="Активная концентрация">[C] ${this.escapeHtml(conc.label)}</span></div>`;
        }
        if (this.hasFocusPotionAdvantage()) {
          const left = this.getFocusPotionTimeLeftLabel();
          html += `<div class="combat-concentration-row"><span class="focus-potion-active" title="Преимущество на проверки концентрации">🧿 Фокус${left ? ` (${this.escapeHtml(left)})` : ''}</span></div>`;
        }
        html += '</div>';
      }

      const useZoneColumns =
        typeof CombatPosition !== 'undefined' && CombatPosition.isEnabled(this);
      if (!useZoneColumns) {
        html += '<b class="combat-enemies-title">⚔️ Противники:</b>';
      }
      html += '<div class="combat-enemies-list' + (useZoneColumns ? ' combat-enemies-list--zones' : '') + '">';
      const selectingTarget = this.getCombatPhase() === 'select_target';
      this.state.enemies.forEach((e, idx) => {
        if (useZoneColumns) return;
        const alive = e.hp > 0;
        const pct = Math.max(0, (e.hp / e.maxHp) * 100);
        const fx = this.renderStatusEffectsHtml(e.effects);
        let rowClass = 'combat-enemy';
        if (selectingTarget) {
          rowClass += alive ? ' combat-enemy-targetable' : ' combat-enemy-dead';
        }
        const clickAttr = (selectingTarget && alive)
          ? ` role="button" tabindex="0" onclick="GameEngine.onCombatEnemyClick(${idx})"`
          : '';
        html += `<div class="${rowClass}" data-enemy-index="${idx}"${clickAttr}>`;
        const typeTag = this.getCreatureTypeLabel(this.getEnemyCreatureType(e));
        const typeHtml = typeTag ? ` <span class="combat-creature-type" title="Тип существа">[${this.escapeHtml(typeTag)}]</span>` : '';
        html += `<span class="combat-unit-name">${this.escapeHtml(this.getEnemyDisplayName(e))}${typeHtml}</span>`;
        html += `<div class="hp-bar-bg"><div class="hp-bar-fill" style="width:${pct}%"></div></div>`;
        html += `<span class="combat-hp-text">${e.hp}/${e.maxHp}</span>`;
        if (fx) html += `<div class="combat-effects-row">${fx}</div>`;
        html += `</div>`;
      });
      html += '</div>';
      area.innerHTML = html;
      this.updateCombatLayoutClasses();
      this.updateCombatTimeline();
    },

    nextCombatTurn() {
      this._combatTurnScheduled = false;
      if (this.state.hp <= 0) {
        if (typeof this.clearCombatConcentration === 'function') this.clearCombatConcentration(true);
        this.finishCombatLogUI();
        this.state.combat = null; this.state.enemies = [];
        const ca = document.getElementById('combat-area');
        if (ca) ca.classList.add('hidden');
        this.updateCombatLayoutClasses();
        this.updateCombatTimeline();
        return;
      }
      if (!this.state.combat) return;
      this.processDefeatedEnemiesReputation();
      if (this.state.enemies.every(e => e.hp <= 0)) {
        const next = this.state.combat.nextScene;
        const combatSnapshot = { ...this.state.combat };
        this.combatLog('death', {
          message: '✅ Все враги повержены!',
          important: true,
          round: this.state.combat.round
        });
        if (typeof this.clearCombatConcentration === 'function') this.clearCombatConcentration(true);
        if (typeof this.clearWildShapeIfCombatEnds === 'function') this.clearWildShapeIfCombatEnds();
        if (typeof this.clearTransformIfCombatEnds === 'function') this.clearTransformIfCombatEnds();
        this.finishCombatLogUI();
        this.state.combat = null;
        this.state.enemies = [];
        this.state.resumeAfterLevelUp = null;
        const ca = document.getElementById('combat-area');
        if (ca) ca.classList.add('hidden');
        this.updateCombatLayoutClasses();
        this.updateCombatTimeline();

        const enemyIds = combatSnapshot.enemies || combatSnapshot.enemyIds || [];
        const tempLoot = this.rollCombatLootFromEnemies(enemyIds);
        if (tempLoot.length > 0) {
          this.showCombatLootModal(tempLoot, next, combatSnapshot);
        } else {
          this.finishCombatVictory(next, combatSnapshot);
        }
        this.saveGame();
        return;
      }
      const turn = this.state.combat.order[this.state.combat.turnIndex];
      if (!turn) {
        if (this.state.combat.turnIndex >= this.state.combat.order.length) {
          this.tickStatusRoundEnd?.();
          this.state.combat.round = (this.state.combat.round || 1) + 1;
          this.syncCombatLogRound();
          if (typeof OpportunityAttack !== 'undefined') {
            OpportunityAttack.restoreReactionsForRound(this);
          } else {
            this.state.combat.reactionAvailable = true;
            (this.state.enemies || []).forEach((e) => {
              if (e) e.reactionAvailable = true;
            });
          }
        }
        this.state.combat.turnIndex = 0;
        this.syncBattleParticipants();
        this.updateCombatTimeline();
        this.nextCombatTurn();
        return;
      }
      this.syncBattleParticipants();
      this.updateCombatTimeline();
      if (turn.type === 'player') {
        const playerHolder = this.getPlayerEffectHolder();
        const pr = this.processEffects(playerHolder);
        this.renderCombat();
        if (pr.skipTurn) {
          this.combatLog('status', {
            message: `💫 ${playerHolder.name} не может действовать (оглушение / врасплох)`,
            important: true
          });
          this.state.combat.turnIndex++;
          setTimeout(() => this.nextCombatTurn(), 700);
          return;
        }
        this.setCombatPhase('player_turn');
        this.resetPlayerTurnEconomy();
        if (this.isPf2e()) this.resetPf2eCombatActions();
        this.renderCombat();
        this.playerCombatTurn();
      } else {
        this.setCombatPhase('enemy_turn');
        const enemy = this.state.enemies[turn.index];
        if (enemy && enemy.hp > 0) {
          const holder = this.getEnemyEffectHolder(enemy);
          const er = this.processEffects(holder);
          this.renderCombat();
          if (er.skipTurn) {
            this.combatLog('status', {
              message: `💫 ${enemy.name} оглушён и пропускает ход`,
              target: enemy.name,
              important: true
            });
          } else {
            this.enemyTurn(enemy, turn.index);
          }
        }
        this.state.combat.turnIndex++;
        setTimeout(() => this.nextCombatTurn(), 900);
      }
    },

    playerCombatTurn() {
      const area = document.getElementById('choices-area');
      if (!area) return;

      if (this.getCombatPhase() === 'select_target') {
        const pendingAb = this.state.combat?.pendingAbility;
        const pendingItemId = this.state.combat?.pendingConsumableId;
        const pendingItem = pendingItemId ? this.data?.items?.[pendingItemId] : null;
        let html = '<b style="color:var(--accent); display:block; margin-bottom:8px; font-family:Amatic SC,cursive; font-size:26px;">Выберите цель</b>';
        if (pendingAb) {
          const castLv = this.getCastSlotLevel(pendingAb);
          const minLv = this.getAbilitySpellLevel(pendingAb);
          const lvTxt = castLv > minLv ? `, ячейка ${castLv} круга` : (castLv >= 1 ? `, круг ${castLv}` : '');
          html += `<div style="margin-bottom:10px;">Умение: ${this.renderIcon(pendingAb.icon)} <b>${this.escapeHtml(pendingAb.name)}</b>${this.escapeHtml(lvTxt)} — клик по врагу в панели боя.</div>`;
        } else if (pendingItem) {
          html += `<div style="margin-bottom:10px;">Предмет: ${this.renderIcon(pendingItem.icon || '🧪')} <b>${this.escapeHtml(pendingItem.name)}</b> — клик по врагу в панели боя.</div>`;
        }
        html += `<button type="button" class="choice" onclick="GameEngine.cancelAbilityTargetSelect()">↩ Отмена (Esc)</button>`;
        area.innerHTML = html;
        this.updateCombatTargetHint();
        return;
      }

      const cls = this.state.classData;
      const atkBonus = this.getEffectivePlayerAtkBonus();
      const dmgText = 'Урон: ' + this.formatEquippedDamageLabel(cls);
      const turnHeadCls = document.body.classList.contains('mobile')
        ? 'combat-turn-sticky'
        : '';
      let html = `<div class="combat-turn-panel"><b class="combat-turn-head ${turnHeadCls}">Ваш ход</b>`;
      const footerParts = [];

      if (this.isPf2e()) {
        const left = this.state.combat?.actionsRemaining ?? this.getPf2eActionsPerTurn();
        html += `<div class="pf2e-actions-indicator" style="margin-bottom:8px;">⚡ Действия: ${'◆'.repeat(left)}${'◇'.repeat(this.getPf2eActionsPerTurn() - left)}</div>`;
        html += `<div style="font-size:20px; color:var(--ink-light); margin-bottom:10px; font-family:'Caveat',cursive;">Атака: к20+${atkBonus} против КД | ${this.escapeHtml(dmgText)}</div>`;
        this.state.enemies.forEach((e, i) => {
          if (e.hp > 0) html += this.buildCombatAttackButtonsForEnemy(i);
        });
        (cls.abilities || []).forEach((ab) => {
          if (!ab.id || this.isAbilityPassiveAbility(ab)) return;
          if (this.getAbilityActionType(ab) === 'action' && !this.isAbilityCombatOnly(ab)) return;
          html += this.buildCombatAbilityButton(ab);
        });
      } else {
        const actionSpent = !!this.state.combat?.actionSpent && !this.state.combat?.actionSurge;
        let attackButtons = '';
        if (!actionSpent) {
          this.state.enemies.forEach((e, i) => {
            if (e.hp > 0) attackButtons += this.buildCombatAttackButtonsForEnemy(i);
          });
        }

        const byType = { action: [], bonus_action: [], reaction: [] };
        (cls.abilities || []).forEach((ab) => {
          if (!ab.id || this.isAbilityPassiveAbility(ab)) return;
          const t = this.getAbilityActionType(ab);
          if (t === 'passive' || t === 'free') return;
          if (t === 'action' && !this.isAbilityCombatOnly(ab)) return;
          if (!byType[t]) byType[t] = [];
          byType[t].push(ab);
        });

        const actionAbilities = byType.action.map((ab) => this.buildCombatAbilityButton(ab)).join('');
        const bonusHtml = byType.bonus_action.map((ab) => this.buildCombatAbilityButton(ab)).join('');

        html += this.renderCombatActionsGrid([
          this.renderCombatActionSection('⚔️ Атака', attackButtons, {
            column: 'attacks',
            showEmpty: true
          }),
          this.renderCombatActionSection('✨ Умения', actionAbilities, {
            column: 'abilities',
            showEmpty: true
          }),
          this.renderCombatActionSection('⚡ Бонус', bonusHtml, {
            column: 'bonus',
            showEmpty: true
          })
        ]);

        const reactionHtml = byType.reaction
          .map((ab) =>
            this.buildCombatAbilityButton(ab, {
              forceDisabled: true,
              disabledReason: this.state.combat?.reactionAvailable
                ? 'Срабатывает после вашего попадания'
                : 'Реакция потрачена'
            })
          )
          .join('');

        if (reactionHtml) {
          footerParts.push(
            this.renderCombatActionSection('🛡️', reactionHtml, { compact: true })
          );
        }
      }

      const combatConsumables = this.getCombatUsableConsumables();
      let itemsHtml = '';
      if (combatConsumables.length) {
        itemsHtml += '<label style="font-weight:600;">🎒</label>';
        itemsHtml += '<select id="combat-consumable-select" class="combat-consumable-select" style="flex:1;min-width:140px;padding:6px;font-size:14px;">';
        combatConsumables.forEach(cid => {
          const cdb = this.data.items[cid];
          const label = this.getConsumableButtonLabel(cdb);
          itemsHtml += `<option value="${this.escapeAttr(cid)}">${this.escapeHtml((cdb?.icon || '🧪') + ' ' + (cdb?.name || cid) + ' — ' + label)}</option>`;
        });
        itemsHtml += '</select>';
        itemsHtml += '<button type="button" class="choice" onclick="GameEngine.useCombatConsumableSelect()">Использовать</button>';
      } else {
        itemsHtml += `<button type="button" class="choice" disabled style="opacity:0.55;cursor:not-allowed;" title="Нет подходящих расходников">Нет расходников</button>`;
      }
      let actionsHtml = '';
      if (typeof CombatPosition !== 'undefined' && CombatPosition.isEnabled(this)) {
        const shiftOpts = CombatPosition.getShiftOptions(this);
        const moved = !!this.state.combat?.zoneMovedThisTurn;
        const shiftUsesAction =
          typeof CombatPosition.shiftCostsAction === 'function' &&
          CombatPosition.shiftCostsAction(this);
        const shiftDisabled =
          moved ||
          (shiftUsesAction &&
            this.state.combat?.actionSpent &&
            !this.state.combat?.actionSurge);
        const shiftTitle = moved
          ? 'Уже перемещались в этом ходу (макс. 1 зона)'
          : shiftUsesAction
            ? 'Потратить действие: сменить зону на соседнюю'
            : 'Перемещение на 1 соседнюю зону за ход (Far ↔ Mid ↔ Close). Атака не тратится.';
        if (shiftOpts.towardFar) {
          const label = `← ${CombatPosition.getZoneLabel(shiftOpts.towardFar)}`;
          if (shiftDisabled) {
            actionsHtml += `<button type="button" class="choice" disabled style="opacity:0.55;" title="${this.escapeAttr(shiftTitle)}">↔️ ${label}</button>`;
          } else {
            actionsHtml += `<button type="button" class="choice" onclick="GameEngine.shiftCombatPosition('toward_far')" title="${this.escapeAttr(shiftTitle)}">↔️ ${label}</button>`;
          }
        }
        if (shiftOpts.towardClose) {
          const label = `${CombatPosition.getZoneLabel(shiftOpts.towardClose)} →`;
          if (shiftDisabled) {
            actionsHtml += `<button type="button" class="choice" disabled style="opacity:0.55;" title="${this.escapeAttr(shiftTitle)}">↔️ ${label}</button>`;
          } else {
            actionsHtml += `<button type="button" class="choice" onclick="GameEngine.shiftCombatPosition('toward_close')" title="${this.escapeAttr(shiftTitle)}">↔️ ${label}</button>`;
          }
        }
      }
      actionsHtml += `<button type="button" class="choice" onclick="GameEngine.playerFlee()">🏃 Отступить (к20+${cls.initBonus} vs DC 14)</button>`;
      if (typeof this.isInWildShape === 'function' && this.isInWildShape()) {
        const beast = this.getActiveBeast?.();
        const bname = beast ? `${beast.icon || ''} ${beast.name}` : 'зверя';
        actionsHtml = `<button type="button" class="choice" onclick="GameEngine.revertWildShapeManually()">🧙 Вернуться в форму (из ${this.escapeHtml(bname)})</button>` + actionsHtml;
      } else if (typeof this.isInTransformation === 'function' && this.isInTransformation()) {
        const t = this.state.transformation;
        const label = t?.formName ? `${t.formIcon || ''} ${t.formName}` : 'превращения';
        actionsHtml = `<button type="button" class="choice" onclick="GameEngine.revertTransformManually()">✨ Вернуться (${this.escapeHtml(label.trim())})</button>` + actionsHtml;
      }
      if (this.isPf2e()) {
        html += this.renderCombatActionSection('🎒 ПРЕДМЕТЫ', itemsHtml);
        html += this.renderCombatActionSection('🏃 ДЕЙСТВИЯ', actionsHtml);
      } else {
        footerParts.push(
          this.renderCombatActionSection('🎒', itemsHtml, { compact: true })
        );
        footerParts.push(
          this.renderCombatActionSection('⋯', actionsHtml, { compact: true })
        );
        if (footerParts.length) {
          html += `<div class="combat-actions-footer">${footerParts.join('')}</div>`;
        }
      }
      html += '</div>';

      area.innerHTML = html;
      this.renderAbilities();
    },

    applyAbilityLogic(ability, target = null) {
      let endsTurn = true;
      this._abilitySoundCtx = ability;

      const runEffect = (rawEffect) => {
        if (rawEffect == null) return;
        let effect = rawEffect;
        if (typeof rawEffect === 'object' && rawEffect.type && ability.targeting && !rawEffect.targeting) {
          effect = { ...rawEffect, targeting: ability.targeting };
        }
        const result = this.applyEffect(effect, target);
        if (result === false) endsTurn = false;
      };

      if (ability.effects && Array.isArray(ability.effects)) {
        ability.effects.forEach(runEffect);
        this._abilitySoundCtx = null;
        return endsTurn;
      }

      if (ability.effect != null) {
        runEffect(ability.effect);
        this._abilitySoundCtx = null;
        return endsTurn;
      }

      if (ability.passive || ability.type === 'passive') {
        this.log('Пассивное умение уже действует.', 'log-dice');
        this._abilitySoundCtx = null;
        return true;
      }

      this.log(ability.desc || 'Умение использовано.', 'log-dice');
      this._abilitySoundCtx = null;
      return true;
    },

    useAbility(abilityIdOrObj) {
      const ability = typeof abilityIdOrObj === 'string'
        ? this.state.classData.abilities?.find(a => a.id === abilityIdOrObj)
        : abilityIdOrObj;
      if (!ability) return;

      if (this.state.combat && !this.isPlayerCombatPhase()) {
        this.log('Не ваш ход!', 'log-damage');
        return;
      }

      if (this.getCombatPhase() === 'select_target') {
        this.log('Сначала выберите цель или нажмите «Отмена».', 'log-dice');
        return;
      }

      if (this.isAbilityCombatOnly(ability) && !this.state.combat) {
        this.log('Это умение можно использовать только в бою.', 'log-dice');
        return;
      }

      if (this.state.combat?.abilitiesUsed?.[ability.id] && ability.oncePerCombat) {
        this.log('Умение уже использовано в этом бою.', 'log-dice');
        return;
      }

      if (this.getAbilityActionType(ability) === 'reaction') {
        this.log('Реакция срабатывает автоматически (например, после попадания по врагу).', 'log-dice');
        return;
      }

      if (this.isAbilityPassiveAbility(ability)) {
        this.showAbilityInfo(ability.id);
        return;
      }

      const unavailable = this.getAbilityUnavailableReason(ability);
      if (unavailable) {
        this.log(`❌ ${unavailable}`, 'log-damage');
        return;
      }

      const castLevels = this.getAvailableCastLevels(ability);
      const sl = this.getAbilitySpellLevel(ability);
      if (this.abilityUsesSpellSlots(ability)) {
        if (sl >= 1) {
          if (castLevels.length === 0) {
            this.log(`❌ Нет ячеек ${sl} круга и выше!`, 'log-damage');
            return;
          }
          if (this.needsCastLevelChoice(ability)) {
            this.promptSpellSlotLevel(ability, castLevels, (lv) => this.continueUseAbility(ability, lv));
            return;
          }
          this.continueUseAbility(ability, castLevels[0]);
          return;
        }
        if (!this.canAffordAbility(ability)) {
          const cost = parseInt(ability?.cost, 10) || 0;
          this.log(cost > 1 ? `❌ Нужно ${cost} свободных ячеек!` : '❌ Нет свободных ячеек!', 'log-damage');
          return;
        }
        this.continueUseAbility(ability, null);
        return;
      }
      if (!this.canAffordAbility(ability)) {
        this.log('❌ Недостаточно ресурса!', 'log-damage');
        return;
      }

      if (this.needsCastLevelChoice(ability)) {
        this.promptSpellSlotLevel(ability, castLevels, (lv) => this.continueUseAbility(ability, lv));
        return;
      }

      this.continueUseAbility(ability, null);
    },
    playerAttack(idx, weaponSlot = 'weapon_main') {
      if (this.getCombatPhase() === 'select_target') {
        this.cancelAbilityTargetSelect();
      }
      if (this.getCombatPhase() !== 'player_turn') {
        this.log('Сейчас нельзя атаковать.', 'log-damage');
        return;
      }

      const isInventoryShot =
        typeof weaponSlot === 'string' && weaponSlot.startsWith('inv:');
      const slot = isInventoryShot
        ? weaponSlot
        : weaponSlot === 'weapon_off'
          ? 'weapon_off'
          : 'weapon_main';
      const profile = isInventoryShot
        ? this.getWeaponAttackProfileFromItem(weaponSlot.slice(4))
        : this.getWeaponAttackProfile(slot);
      if (!isInventoryShot && slot === 'weapon_off') {
        if (!this.hasDualWieldSetup()) {
          this.log('Нет второго одноручного оружия.', 'log-damage');
          return;
        }
        if (this.state.combat?.bonusActionSpent) {
          this.log('Бонусное действие уже потрачено в этом ходу.', 'log-damage');
          return;
        }
      } else if (this.state.combat?.actionSpent && !this.state.combat?.actionSurge) {
        this.log('Действие уже потрачено в этом ходу.', 'log-damage');
        return;
      }

      const enemy = this.state.enemies[idx];
      if (!enemy || enemy.hp <= 0) return;

      if (this.attackRequiresArrows(profile)) {
        if (this.getArrowCount() <= 0) {
          this.log('❌ Нет стрел для выстрела из лука.', 'log-damage');
          return;
        }
        this.consumeOneArrow();
      }

      const rangeType =
        typeof CombatPosition !== 'undefined' && profile
          ? CombatPosition.getWeaponRangeType(this, profile)
          : 'melee';
      const attackMode =
        typeof CombatPosition !== 'undefined'
          ? CombatPosition.getAttackModeFromRangeType(rangeType)
          : rangeType === 'ranged'
            ? 'ranged'
            : 'melee';
      if (typeof CombatPosition !== 'undefined' && CombatPosition.isEnabled(this)) {
        const zoneCheck = CombatPosition.validateAttack(this, {
          enemyIndex: idx,
          rangeType,
          attackMode
        });
        if (!zoneCheck.valid) {
          this.log(`❌ ${zoneCheck.reason}`, 'log-damage');
          return;
        }
        CombatPosition.recordAttackOnEnemy(
          this,
          idx,
          CombatPosition.getPlayerPosition(this)
        );
      }

      const cls = this.state.classData;
      let atkBonus = profile?.atkBonus ?? this.getEffectivePlayerAtkBonus();
      const enemyAc = this.getEffectiveEnemyAC(enemy);
      const weaponLabel = profile?.weaponName || 'Атака';

      let zoneMods = null;
      if (typeof CombatPosition !== 'undefined' && CombatPosition.isEnabled(this)) {
        zoneMods = CombatPosition.getAttackModifiers(this, {
          enemyIndex: idx,
          attackMode,
          attackerZone: CombatPosition.getPlayerPosition(this),
          targetZone: CombatPosition.getEnemyPosition(this, enemy)
        });
        atkBonus += zoneMods.attackBonus || 0;
      }
      if (typeof StatusManager !== 'undefined') {
        const statusMods = StatusManager.getAttackModifiers(
          this,
          StatusManager.getPlayerHolder(this),
          StatusManager.getEnemyHolder(this, enemy),
          {
            ranged:
              attackMode === 'ranged' ||
              rangeType === 'ranged' ||
              rangeType === 'spell'
          }
        );
        zoneMods = zoneMods || {
          attackBonus: 0,
          advantage: false,
          disadvantage: false,
          notes: []
        };
        zoneMods.attackBonus = (zoneMods.attackBonus || 0) + (statusMods.attackBonus || 0);
        if (statusMods.advantage) zoneMods.advantage = true;
        if (statusMods.disadvantage) zoneMods.disadvantage = true;
        zoneMods.notes = [...(zoneMods.notes || []), ...(statusMods.notes || [])];
        atkBonus += statusMods.attackBonus || 0;
      }

      if (this.isPf2e()) {
        if (!this.spendPf2eActions(1)) return;
        const map = this.state.combat?.mapPenalty || 0;
        const attacker = {
          atkBonus,
          dmgRoll: profile?.dmgRoll || cls?.dmgRoll || '1d6',
          dmgBonus: profile?.dmgBonus ?? cls?.dmgBonus ?? 0
        };
        const result = this.activeSystem.rollAttack(attacker, { ac: enemyAc }, this, { mapPenalty: map });
        this.state.combat.mapPenalty = Math.min(10, map + 5);

        const degreeLabels = {
          critical_success: 'критический успех',
          success: 'успех',
          failure: 'провал',
          critical_failure: 'критический провал'
        };
        const degLabel = degreeLabels[result.degree] || result.degree;

        if (result.hit && result.dmg > 0) {
          const favHit = this.addFavoredEnemyDamageToHit(enemy, result.dmg);
          enemy.hp -= favHit.total;
          this.log(
            `🎲 ${result.roll}+${atkBonus}${map ? map : ''}=${result.total} vs КД ${enemyAc} — ${degLabel}! 💥 ${favHit.total} урона${this.favoredEnemyDamageNote(favHit.bonus)}`,
            result.crit ? 'log-damage' : 'log-damage'
          );
          if (!this.playEnemyDamagedSound(enemy)) {
            this.playCombatSound(result.crit ? 'attack_crit' : this.getAttackSoundId());
          }
        } else {
          this.log(
            `🎲 ${result.roll}+${atkBonus}${map ? map : ''}=${result.total} vs КД ${enemyAc} — ${degLabel}`,
            'log-dice'
          );
          this.playCombatSound('attack_miss');
        }
        this.renderCombat();
        if (this.endPf2ePlayerTurnIfNoActions()) return;
        this.playerCombatTurn();
        return;
      }

      const rollPack =
        zoneMods && (zoneMods.advantage || zoneMods.disadvantage) && typeof CombatPosition !== 'undefined'
          ? CombatPosition.rollD20(this, zoneMods)
          : zoneMods?.advantage || zoneMods?.disadvantage
            ? (() => {
                const r1 = this.d20();
                const r2 = this.d20();
                if (zoneMods.advantage && !zoneMods.disadvantage) {
                  return { roll: Math.max(r1, r2), advantage: true, detail: `${r1}, ${r2}` };
                }
                if (zoneMods.disadvantage) {
                  return { roll: Math.min(r1, r2), disadvantage: true, detail: `${r1}, ${r2}` };
                }
                return { roll: r1 };
              })()
            : { roll: this.d20() };
      const roll = rollPack.roll;
      const total = roll + atkBonus;
      const zoneTag = zoneMods?.notes?.length
        ? ' [' + zoneMods.notes.join('; ') + ']'
        : '';
      const advTag = rollPack.advantage
        ? ` (Advantage: ${rollPack.detail || roll})`
        : rollPack.disadvantage
          ? ` (Disadvantage: ${rollPack.detail || roll})`
          : '';
      // Старый режим: кара активирована вручную до удара (совместимость)
      let smiteBonus = 0;
      if (this.state.combat?.divineSmite) {
        smiteBonus = this.state.combat.smiteRoll
          ? this.parseRoll(this.state.combat.smiteRoll)
          : this.d(8) + this.d(8);
        this.state.combat.divineSmite = false;
        this.state.combat.smiteRoll = null;
        this.spendCombatActionType('reaction');
      }
      if (slot === 'weapon_off') {
        this.spendCombatActionType('bonus_action');
      } else if (!this.state.combat?.actionSurge) {
        this.spendCombatActionType('action');
      }

      const offHandTag = profile?.isOffHand ? ' (второе оружие, без бонуса мастерства)' : '';
      let hit = false;
      if (roll === 20) {
        const baseDmg = this.rollPlayerWeaponDamage(true, slot) + smiteBonus;
        const favHit = this.addFavoredEnemyDamageToHit(enemy, baseDmg);
        const dmg = favHit.total;
        enemy.hp -= dmg;
        this.log('🎲 Крит! ' + roll + '+' + atkBonus + '=' + total + advTag + zoneTag + ' | 💥 ' + dmg + ' урона (' + weaponLabel + ')' + offHandTag + this.favoredEnemyDamageNote(favHit.bonus) + ' по ' + enemy.name + '!' + (smiteBonus > 0 ? ' (с божественной кара)' : ''), 'log-damage');
        if (!this.playEnemyDamagedSound(enemy)) {
          this.playCombatSound(smiteBonus > 0 ? 'smite_crit' : 'attack_crit');
        }
        hit = true;
      } else if (roll === 1) {
        this.log('🎲 ' + roll + '+' + atkBonus + '=' + total + advTag + zoneTag + ' vs КД ' + enemyAc + ' — автопровал' + offHandTag, 'log-dice');
        this.playCombatSound('attack_miss');
      } else if (total >= enemyAc) {
        const baseDmg = this.rollPlayerWeaponDamage(false, slot) + smiteBonus;
        const favHit = this.addFavoredEnemyDamageToHit(enemy, baseDmg);
        const dmg = favHit.total;
        enemy.hp -= dmg;
        this.log('🎲 ' + roll + '+' + atkBonus + '=' + total + advTag + zoneTag + ' vs КД ' + enemyAc + ' — попадание! 💥 ' + dmg + ' урона (' + weaponLabel + ')' + offHandTag + this.favoredEnemyDamageNote(favHit.bonus) + (smiteBonus > 0 ? ' (с божественной кара)' : ''), 'log-damage');
        if (!this.playEnemyDamagedSound(enemy)) {
          this.playCombatSound(smiteBonus > 0 ? 'smite_hit' : this.getAttackSoundId(profile?.weaponId));
        }
        hit = true;
      } else {
        this.log('🎲 ' + roll + '+' + atkBonus + '=' + total + advTag + zoneTag + ' vs КД ' + enemyAc + ' — промах' + offHandTag, 'log-dice');
        this.playCombatSound('attack_miss');
      }
      if (typeof StatusManager !== 'undefined') {
        StatusManager.syncFlankingMarkers(this);
      }
      this.renderCombat();

      if (hit && smiteBonus === 0) {
        this.tryOfferReactionAfterPlayerHit(idx, true);
        return;
      }
      if (this.state.combat?.actionSurge) {
        this.state.combat.actionSurge = false;
        this.playerCombatTurn();
        return;
      }
      if (
        slot === 'weapon_main'
        && hit
        && this.playerHasExtraAttack()
        && !this.state.combat?.extraAttackUsed
        && enemy.hp > 0
      ) {
        this.state.combat.extraAttackUsed = true;
        this.state.combat.actionSurge = true;
        this.log('⚔️ Дополнительная атака!', 'log-combat');
        this.playerCombatTurn();
        return;
      }
      if (enemy.hp <= 0) {
        setTimeout(() => this.nextCombatTurn(), 600);
        return;
      }
      this.state.combat.turnIndex++;
      setTimeout(() => this.nextCombatTurn(), 600);
    },

    usePotionInCombat() {
      this.useConsumable('healing_potion');
    },

    playerFlee() {
      const roll = this.d20() + this.state.classData.initBonus;
      if (roll >= 14) {
        this.log('🏃 Удалось отступить! (' + roll + ')', 'log-combat');
        if (typeof this.clearCombatConcentration === 'function') this.clearCombatConcentration(true);
        if (typeof this.clearWildShapeIfCombatEnds === 'function') this.clearWildShapeIfCombatEnds();
        if (typeof this.clearTransformIfCombatEnds === 'function') this.clearTransformIfCombatEnds();
        this.finishCombatLogUI();
        this.state.combat = null; this.state.enemies = [];
        const ca = document.getElementById('combat-area');
        if (ca) ca.classList.add('hidden');
        this.updateCombatLayoutClasses();
        this.updateCombatTimeline();
        this.showScene('fled');
      } else {
        this.log('🏃 Не удалось (' + roll + ')', 'log-combat');
        this.state.combat.turnIndex++;
        setTimeout(() => this.nextCombatTurn(), 600);
      }
    },

    /** Уровень игрока для баланса (если level нет в сохранении — 1) */
    getPlayerLevelForBalance() {
      return Math.max(1, parseInt(this.state?.level, 10) || 1);
    },

    /** Бросок урона врага (кости + бонус; при крите — удвоение костей) */
    rollEnemyRawDamage(enemy, isCrit, attack) {
      const bonus = parseInt(attack?.dmgBonus ?? enemy.dmgBonus, 10) || 0;
      const dice = attack?.dmgRoll || enemy.dmgRoll || '1d6';
      const rollPart = this.parseRoll(dice);
      if (isCrit) return rollPart + this.parseRoll(dice) + bonus;
      return rollPart + bonus;
    },

    /**
     * Атака возможности игрока по уходящему врагу (тратит реакцию снаружи — OpportunityAttack).
     */
    executePlayerOpportunityAttack(enemyIndex, leaveEvent) {
      const enemy = this.state.enemies?.[enemyIndex];
      if (!enemy || enemy.hp <= 0) return false;

      const profile =
        typeof OpportunityAttack !== 'undefined'
          ? OpportunityAttack.pickPlayerMeleeAttack(this)
          : this.getWeaponAttackProfile('weapon_main');
      if (!profile) {
        this.log('❌ Нет подходящего оружия для атаки возможности.', 'log-damage');
        return false;
      }

      const slot = profile.isOffHand ? 'weapon_off' : 'weapon_main';
      const fromZone = leaveEvent?.fromZone;
      const atkBonus = profile.atkBonus ?? this.getEffectivePlayerAtkBonus();
      const enemyAc = this.getEffectiveEnemyAC(enemy);
      const weaponLabel = profile.weaponName || 'Атака';
      const rangeType =
        typeof CombatPosition !== 'undefined'
          ? CombatPosition.getWeaponRangeType(this, profile)
          : 'melee';

      let zoneMods = null;
      if (typeof CombatPosition !== 'undefined' && CombatPosition.isEnabled(this) && fromZone) {
        const zoneCheck = CombatPosition.validateAttack(this, {
          enemyIndex,
          rangeType,
          attackMode: 'melee',
          attackerZone: fromZone,
          targetZone: fromZone
        });
        if (!zoneCheck.valid) {
          this.log(`❌ Атака возможности: ${zoneCheck.reason}`, 'log-damage');
          return false;
        }
        zoneMods = zoneCheck.modifiers;
      }

      const rollPack =
        zoneMods && (zoneMods.advantage || zoneMods.disadvantage) && typeof CombatPosition !== 'undefined'
          ? CombatPosition.rollD20(this, zoneMods)
          : { roll: this.d20() };
      const roll = rollPack.roll;
      const total = roll + atkBonus;
      const advTag = rollPack.advantage
        ? ` (Advantage: ${rollPack.detail || roll})`
        : rollPack.disadvantage
          ? ` (Disadvantage: ${rollPack.detail || roll})`
          : '';

      if (roll === 20) {
        const baseDmg = this.rollPlayerWeaponDamage(true, slot);
        const favHit = this.addFavoredEnemyDamageToHit(enemy, baseDmg);
        enemy.hp -= favHit.total;
        this.log(
          `⚡ Крит! Атака возможности: ${roll}+${atkBonus}=${total}${advTag} | 💥 ${favHit.total} по ${enemy.name}`,
          'log-damage'
        );
        this.playCombatSound('attack_crit');
      } else if (total >= enemyAc) {
        const baseDmg = this.rollPlayerWeaponDamage(false, slot);
        const favHit = this.addFavoredEnemyDamageToHit(enemy, baseDmg);
        enemy.hp -= favHit.total;
        this.log(
          `⚡ Атака возможности (${weaponLabel}): ${roll}+${atkBonus}=${total}${advTag} vs КД ${enemyAc} | 💥 ${favHit.total}`,
          'log-damage'
        );
        if (!this.playEnemyDamagedSound(enemy)) {
          this.playCombatSound(this.getAttackSoundId());
        }
      } else {
        this.log(
          `⚡ Атака возможности: ${roll}+${atkBonus}=${total}${advTag} vs КД ${enemyAc} — промах`,
          'log-dice'
        );
        this.playCombatSound('attack_miss');
      }

      if (typeof CombatPosition !== 'undefined' && fromZone) {
        CombatPosition.recordAttackOnEnemy(this, enemyIndex, fromZone);
      }
      this.renderCombat();
      return true;
    },

    /**
     * Атака возможности врага по уходящему игроку.
     */
    executeEnemyOpportunityAttack(enemyIndex, leaveEvent) {
      const enemy = this.state.enemies?.[enemyIndex];
      if (!enemy || enemy.hp <= 0) return false;
      const attack =
        typeof OpportunityAttack !== 'undefined'
          ? OpportunityAttack.pickEnemyMeleeAttack(this, enemy, enemyIndex)
          : null;
      if (!attack) return false;
      return this.executeEnemyAttack(enemy, enemyIndex, attack, 'opportunity', {
        opportunityDepartureZone: leaveEvent?.fromZone
      });
    },

    /**
     * Атака врага по профилю (range / теги из JSON). Учитывает зоны и помеху в ближней дистанции.
     */
    executeEnemyAttack(enemy, enemyIndex, attack, note, opts) {
      if (!enemy || enemy.hp <= 0) return false;

      const atkBonus = parseInt(attack?.atkBonus ?? enemy.atkBonus, 10) || 3;
      const label = attack?.label || attack?.id || 'Атака';
      let effectiveAC = this.getEffectivePlayerAC();
      if (this.state.combat?.shieldSpell) {
        effectiveAC += 5;
        if (!this.isConcentratingCleanup?.('shieldSpell')) {
          this.state.combat.shieldSpell = false;
        }
      }

      let zoneMods = null;
      let rangeType = 'melee';
      if (typeof CombatPosition !== 'undefined' && CombatPosition.isEnabled(this)) {
        rangeType = CombatPosition.normalizeRangeType(attack?.range, {
          tags: attack?.tags
        });
        const oppZone = opts?.opportunityDepartureZone;
        const zoneCheck = oppZone
          ? CombatPosition.validateAttack(this, {
              attackerZone: CombatPosition.getEnemyPosition(this, enemyIndex),
              targetZone: oppZone,
              rangeType,
              attackerIsEnemy: true
            })
          : CombatPosition.validateAttackAgainstPlayer(this, enemyIndex, rangeType);
        if (!zoneCheck.valid) {
          this.log(`❌ ${enemy.name}: ${zoneCheck.reason}`, 'log-damage');
          return false;
        }
        zoneMods = zoneCheck.modifiers;
      }

      const rollPack =
        zoneMods && (zoneMods.advantage || zoneMods.disadvantage) && typeof CombatPosition !== 'undefined'
          ? CombatPosition.rollD20(this, zoneMods)
          : { roll: this.d20() };
      const roll = rollPack.roll;
      const total = roll + atkBonus;
      const advTag = rollPack.advantage
        ? ` (Advantage: ${rollPack.detail || roll})`
        : rollPack.disadvantage
          ? ` (Disadvantage: ${rollPack.detail || roll})`
          : '';
      const noteTag =
        note === 'opportunity'
          ? ' [атака возможности]'
          : note === 'ranged_in_melee'
            ? ' [вплотную]'
            : '';
      const atkLabel = label !== 'Атака' ? ` (${label})` : '';

      const applyEnemyOnHit = () => {
        if (!enemy.onHit?.addEffect) return;
        const h = this.getPlayerEffectHolder();
        if (h) this.applyStatusEffect(h, enemy.onHit.addEffect, enemy.name);
        this.renderCombat();
      };

      if (roll === 20) {
        this.logEnemyAttackRoll(enemy, roll, atkBonus, total, effectiveAC, 'crit');
        const rawDmg = this.rollEnemyRawDamage(enemy, true, attack);
        const { dead } = this.applyEnemyDamageToPlayer(rawDmg, enemy.name + atkLabel + noteTag);
        this.playEnemyAttackSound(enemy, 'hit');
        if (!dead) applyEnemyOnHit();
        this._finishEnemyAttackCleanup();
        return true;
      }
      if (total >= effectiveAC) {
        this.logEnemyAttackRoll(enemy, roll, atkBonus, total, effectiveAC, 'hit');
        const rawDmg = this.rollEnemyRawDamage(enemy, false, attack);
        const { dead } = this.applyEnemyDamageToPlayer(rawDmg, enemy.name + atkLabel + noteTag);
        this.playEnemyAttackSound(enemy, 'hit');
        if (!dead) applyEnemyOnHit();
        this._finishEnemyAttackCleanup();
        return true;
      }
      this.log(
        `${enemy.name}${atkLabel} бросает d20: ${roll} + ${atkBonus} = ${total}${advTag} против КД ${effectiveAC} → Промах${noteTag}`,
        'log-dice'
      );
      this.playEnemyAttackSound(enemy, 'miss');
      this._finishEnemyAttackCleanup();
      return true;
    },

    _finishEnemyAttackCleanup() {
      if (!this.state.combat) return;
      this.state.combat.shieldBlock = false;
      if (!this.isConcentratingCleanup?.('shieldOfFaith')) {
        this.state.combat.shieldOfFaith = false;
      }
      if (!this.isConcentratingCleanup?.('tempAcBonus')) {
        this.state.combat.tempAcBonus = 0;
      }
    },

    /** Базовая атака без тактики (fallback) */
    executeEnemyBasicAttack(enemy, enemyIndex, attack) {
      const profile =
        attack ||
        (typeof EnemyTacticalAI !== 'undefined'
          ? EnemyTacticalAI.getEnemyAttacks(this, enemy)[0]
          : null);
      if (profile) return this.executeEnemyAttack(enemy, enemyIndex, profile);
      return this.executeEnemyAttack(enemy, enemyIndex, {
        id: 'default',
        range: 'melee',
        atkBonus: enemy.atkBonus,
        dmgRoll: enemy.dmgRoll,
        dmgBonus: enemy.dmgBonus
      });
    },

    /** Снижение урона на ранних уровнях + нанесение урона игроку */
    applyEnemyDamageToPlayer(rawDmg, enemyName) {
      let dmg = Math.max(0, parseInt(rawDmg, 10) || 0);
      let suffix = '';
      // Снижение урона на ранних уровнях
      if (this.getPlayerLevelForBalance() <= 2) {
        const reduced = Math.floor(dmg * 0.7);
        if (reduced < dmg) suffix = ' (снижено на раннем уровне)';
        dmg = reduced;
      }
      const dead = this.takeDamage(dmg);
      const who = enemyName || 'Враг';
      this.log(`${who} наносит ${dmg} урона${suffix}`, 'log-damage');
      return { dmg, dead };
    },

    // Лог броска d20 при атаке врага
    logEnemyAttackRoll(enemy, roll, bonus, total, targetAc, outcome) {
      const name = enemy?.name || 'Враг';
      let resultLabel;
      if (outcome === 'crit') resultLabel = 'Критическое попадание!';
      else if (outcome === 'hit') resultLabel = 'Попадание!';
      else resultLabel = 'Промах';
      this.log(
        `${name} бросает d20: ${roll} + ${bonus} = ${total} против КД ${targetAc} → ${resultLabel}`,
        outcome === 'miss' ? 'log-dice' : 'log-combat'
      );
    },

    enemyTurn(enemy, enemyIndex) {
      if (!enemy || enemy.hp <= 0) return;
      const idx =
        enemyIndex != null
          ? enemyIndex
          : (this.state.enemies || []).indexOf(enemy);
      if (idx < 0) {
        this.executeEnemyBasicAttack(enemy, 0, null);
        return;
      }

      if (typeof EnemyTacticalAI !== 'undefined') {
        EnemyTacticalAI.runTurn(this, enemy, idx);
        return;
      }
      this.executeEnemyBasicAttack(enemy, idx, null);
    },

  });
})();
