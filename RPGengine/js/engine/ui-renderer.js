// ============================================================
// engine/ui-renderer.js — рендеринг HTML и UI
// ============================================================

(function attachEngineUiRenderer() {
  'use strict';
  if (typeof GameEngine === 'undefined') {
    console.error('engine/ui-renderer.js: GameEngine не определён — загрузите core.js первым');
    return;
  }

  Object.assign(GameEngine, {
    _tr(key, params, fallback) {
      if (typeof t !== 'function') return fallback ?? key;
      const v = t(key, params);
      return v !== key ? v : (fallback ?? key);
    },

    abilityActionTypeLabel(key) {
      const fb = {
        action: 'Действие',
        bonus_action: 'Бонус',
        reaction: 'Реакция',
        passive: 'Пассивное',
        free: 'Свободное'
      }[key] || key;
      return this._tr('game.ui.actionTypes.' + key, null, fb);
    },

    // ========== ПОДСКАЗКИ UI (ui_hints) ==========
    _tooltipDelayMs: 300,
    _tooltipShowTimer: null,
    _tooltipActiveIcon: null,
    _tooltipMoveHandler: null,
    _tooltipMousedownBound: false,

    getHintText(hintKey) {
      if (!hintKey || !this.data?.ui_hints) return null;
      const text = this.data.ui_hints[hintKey];
      if (text == null || String(text).trim() === '') return null;
      return String(text);
    },

    hideTooltip() {
      if (this._tooltipShowTimer) {
        clearTimeout(this._tooltipShowTimer);
        this._tooltipShowTimer = null;
      }
      this._tooltipActiveIcon = null;
      if (this._tooltipMoveHandler) {
        document.removeEventListener('mousemove', this._tooltipMoveHandler);
        this._tooltipMoveHandler = null;
      }
      const el = document.getElementById('ui-tooltip');
      if (el) {
        el.style.display = 'none';
        el.textContent = '';
      }
    },

    positionTooltip(pageX, pageY) {
      const el = document.getElementById('ui-tooltip');
      if (!el || el.style.display === 'none') return;
      const offset = 14;
      let left = pageX + offset;
      let top = pageY + offset;
      el.style.left = left + 'px';
      el.style.top = top + 'px';
      const rect = el.getBoundingClientRect();
      if (rect.right > window.innerWidth - 8) {
        left = pageX - rect.width - offset;
        el.style.left = Math.max(8, left) + 'px';
      }
      if (rect.bottom > window.innerHeight - 8) {
        top = pageY - rect.height - offset;
        el.style.top = Math.max(8, top) + 'px';
      }
    },

    showTooltip(text, pageX, pageY) {
      const el = document.getElementById('ui-tooltip');
      if (!el || !text) return;
      el.textContent = text;
      el.style.display = 'block';
      this.positionTooltip(pageX, pageY);
    },

    initTooltips() {
      if (!this._tooltipMousedownBound) {
        this._tooltipMousedownBound = true;
        document.addEventListener('mousedown', () => this.hideTooltip());
      }

      document.querySelectorAll('.info-icon').forEach(icon => {
        if (icon._tooltipInited) return;
        icon._tooltipInited = true;

        icon.addEventListener('mouseenter', (e) => {
          const key = icon.getAttribute('data-hint');
          const text = this.getHintText(key);
          if (!text) return;

          this._tooltipActiveIcon = icon;
          if (this._tooltipShowTimer) clearTimeout(this._tooltipShowTimer);

          this._tooltipShowTimer = setTimeout(() => {
            this._tooltipShowTimer = null;
            if (this._tooltipActiveIcon !== icon) return;
            this.showTooltip(text, e.pageX, e.pageY);

            if (this._tooltipMoveHandler) {
              document.removeEventListener('mousemove', this._tooltipMoveHandler);
            }
            this._tooltipMoveHandler = (ev) => this.positionTooltip(ev.pageX, ev.pageY);
            document.addEventListener('mousemove', this._tooltipMoveHandler);
          }, this._tooltipDelayMs);
        });

        icon.addEventListener('mouseleave', () => {
          if (this._tooltipActiveIcon === icon) this._tooltipActiveIcon = null;
          this.hideTooltip();
        });
      });
    },

    playAbilityHit(ability, effect) {
      const eff = effect || ability?.effect;
      const dt = eff && typeof eff === 'object' ? eff.damageType : null;
      const soundId = this.resolveSoundId(
        eff?.soundHit,
        ability?.soundHit,
        ability?.sounds?.hit,
        dt && this.resolveDamageTypeSound(dt),
        eff && typeof eff === 'object' && this.resolveEffectTypeSound(eff.type)
      );
      if (soundId) this.playCombatSound(soundId);
    },

    getConditionContext() {
      return {
        flags: { ...(this.state.flags || {}) },
        inventory: [...(this.state.inventory || [])],
        gold: this.state.gold ?? 0,
        className: this.state.className || '',
        questStages: { ...(this.state.questStages || {}) },
        quests: this.data?.quests || {}
      };
    },

    filterChoicesByConditions(choices) {
      if (!Array.isArray(choices)) return [];
      const ctx = this.getConditionContext();
      return choices.filter(c => ConditionSystem.isChoiceVisible(c, ctx));
    },

    getAttackSoundId(forWeaponId) {
      const cls = this.state.classData;
      const weaponId = forWeaponId || this.getEquippedItemId('weapon_main') || this.getEquippedWeaponId(cls);
      const weapon = weaponId ? this.itemsData[weaponId] : null;
      const attackDefaults = this.data?.audio?.defaults?.attack || {};
      return this.resolveSoundId(
        cls?.attackSound,
        weapon?.soundHit,
        weapon?.sound,
        weaponId && attackDefaults[weaponId],
        weaponId === 'staff' && attackDefaults.staff,
        weaponId === 'longsword' && attackDefaults.sword,
        weaponId === 'morningstar' && attackDefaults.blunt,
        attackDefaults.default,
        'slash_physical'
      );
    },

    escapeHtml(str) {
      return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    },

    escapeAttr(str) {
      return this.escapeHtml(str).replace(/"/g, '&quot;');
    },

    /** onclick="GameEngine.method(...)" — кавычки не ломают HTML-атрибут */
    onclickGame(method, ...args) {
      const expr = 'GameEngine.' + method + '(' + args.map(a => JSON.stringify(a)).join(', ') + ')';
      return 'onclick="' + this.escapeAttr(expr) + '"';
    },

    renderIcon(icon) {
      const value = String(icon || '').trim();
      if (!value) return '';
      const isImage = /^((https?:)?\/\/|\.\/|\/).+\.(png|jpe?g|gif|svg)$/i.test(value);
      if (isImage) {
        return `<img src="${this.escapeAttr(value)}" alt="icon" class="inline-icon">`;
      }
      return this.escapeHtml(value);
    },

    normalizeAbilities(abilities, classKey) {
      return (abilities || []).map((ab, i) => this.normalizeAbility(ab, classKey, i));
    },

    /** @deprecated use abilityActionTypeLabel() */
    get ABILITY_ACTION_TYPE_LABELS() {
      return {
        action: this.abilityActionTypeLabel('action'),
        bonus_action: this.abilityActionTypeLabel('bonus_action'),
        reaction: this.abilityActionTypeLabel('reaction'),
        passive: this.abilityActionTypeLabel('passive'),
        free: this.abilityActionTypeLabel('free')
      };
    },

    normalizeAbility(ab, classKey, index) {
      const copy = JSON.parse(JSON.stringify(ab || {}));
      if (!copy.id) copy.id = (classKey || 'hero') + '_ability_' + ((index ?? 0) + 1);
      if (copy.usage === 'combat') copy.combatOnly = true;
      if (copy.usage === 'world' || copy.usage === 'exploration') copy.combatOnly = false;
      if (typeof CombatManager !== 'undefined') {
        const system =
          this.data?.meta?.system === 'pf2e' || this.isPf2e?.() ? 'pf2e' : 'dnd5e';
        return CombatManager.parseAction(copy, { system });
      }
      return copy;
    },

    getAbilityPrimaryEffect(ab) {
      if (!ab) return null;
      if (ab.effect && typeof ab.effect === 'object') return ab.effect;
      if (Array.isArray(ab.effects) && ab.effects.length) return ab.effects[0];
      return null;
    },

    /** Тип действия умения (по умолчанию — action) */
    getAbilityActionType(ab) {
      if (!ab) return 'action';
      if (ab.actionType) return ab.actionType;
      if (ab.type === 'passive' || ab.passive) return 'passive';
      const eff = this.getAbilityPrimaryEffect(ab);
      if (eff?.type === 'smite' || (typeof ab.effect === 'string' && String(ab.effect).startsWith('smite'))) {
        return 'reaction';
      }
      return 'action';
    },

    getAbilityTrigger(ab) {
      if (!ab) return null;
      if (ab.trigger) return ab.trigger;
      if (this.getAbilityActionType(ab) === 'reaction') return 'after_player_hit';
      return null;
    },

    isAbilityPassiveAbility(ab) {
      return this.getAbilityActionType(ab) === 'passive' || ab?.type === 'passive' || !!ab?.passive;
    },

    getAbilityActionTypeBadge(ab) {
      const key = this.getAbilityActionType(ab);
      const label = this.ABILITY_ACTION_TYPE_LABELS[key] || key;
      return `[${label}]`;
    },

    /** Сброс действий в начале хода игрока */
    resetPlayerTurnEconomy() {
      if (!this.state.combat) return;
      this.state.combat.actionSpent = false;
      this.state.combat.bonusActionSpent = false;
      if (typeof CombatPosition !== 'undefined') {
        CombatPosition.resetTurnMovement(this);
      }
    },

    /** Занята ли концентрация другим заклинанием */
    isConcentrationBlockedFor(ability) {
      if (!this.isConcentrationAbility(ability)) return false;
      const conc = this.state.combat?.concentration;
      if (!conc) return false;
      return (conc.abilityId || conc.id) !== ability?.id;
    },

    /** Почему умение недоступно в бою (null = можно) */
    getAbilityMinLevel(ab) {
      const n = parseInt(ab?.minLevel, 10);
      return Number.isFinite(n) && n > 0 ? n : 1;
    },

    getAbilityUnavailableReason(ab) {
      if (!ab || !this.state.combat) return null;
      if ((this.state.level || 1) < this.getAbilityMinLevel(ab)) {
        return this._tr('game.ui.minLevel', { level: this.getAbilityMinLevel(ab) }, `Доступно с ${this.getAbilityMinLevel(ab)} уровня`);
      }
      if (this.getCombatPhase() !== 'player_turn') return this._tr('game.ui.notYourTurn', null, 'Не ваш ход');
      const actionType = this.getAbilityActionType(ab);
      if (actionType === 'passive') return null;
      if (actionType === 'reaction') return this._tr('game.ui.reactionTrigger', null, 'Срабатывает по триггеру');
      if (this.isSpellBlockedByCurse(ab)) return this._tr('game.ui.curseSilence', null, 'Проклятие безмолвия');
      if (!this.canAffordAbility(ab)) {
        const sl = this.getAbilitySpellLevel(ab);
        if (this.abilityUsesSpellSlots(ab)) {
          if (sl >= 1) return this._tr('game.ui.noSpellCircle', { level: sl }, `Нет ячеек ${sl} круга и выше`);
          const cost = parseInt(ab?.cost, 10) || 0;
          return cost > 1
            ? this._tr('game.ui.needSpellSlots', { cost }, `Нужно ${cost} свободных ячеек`)
            : this._tr('game.ui.noSpellSlots', null, 'Нет свободных ячеек');
        }
        const resName = this.state.classData?.resourceName || 'ресурса';
        return sl >= 1 && this.state.resources?.spellSlots?.[String(sl)]
          ? this._tr('game.ui.noSlotsCircle', { level: sl }, `Нет слотов ${sl} круга`)
          : this._tr('game.ui.notEnoughResource', { resource: resName }, `Недостаточно ${resName}`);
      }
      if (this.isConcentrationBlockedFor(ab)) return this._tr('game.ui.concentrationBusy', null, 'Концентрация занята');
      if (ab.oncePerCombat && this.state.combat.abilitiesUsed?.[ab.id]) return this._tr('game.ui.alreadyUsedCombat', null, 'Уже использовано в этом бою');
      if (actionType === 'action' && this.state.combat.actionSpent && !this.state.combat.actionSurge) {
        return this._tr('game.ui.actionSpent', null, 'Действие потрачено');
      }
      if (actionType === 'bonus_action' && this.state.combat.bonusActionSpent) {
        return this._tr('game.ui.bonusSpent', null, 'Бонусное действие потрачено');
      }
      if (typeof CombatManager !== 'undefined') {
        const cmReason = CombatManager.canPerformAction(this, ab);
        if (cmReason) return cmReason;
      }
      if (typeof CombatPosition !== 'undefined' && CombatPosition.isEnabled(this)) {
        const zoneReason = CombatPosition.getAbilityZoneUnavailableReason(this, ab);
        if (zoneReason) return zoneReason;
      }
      return null;
    },

    canOfferReactionAbility(ab) {
      if (!ab || this.getAbilityActionType(ab) !== 'reaction') return false;
      if (!this.state.combat?.reactionAvailable) return false;
      if (this.isSpellBlockedByCurse(ab)) return false;
      if (!this.canAffordAbility(ab)) return false;
      if (ab.oncePerCombat && this.state.combat.abilitiesUsed?.[ab.id]) return false;
      return true;
    },

    spendCombatActionType(actionType) {
      if (!this.state.combat) return;
      if (actionType === 'action') this.state.combat.actionSpent = true;
      if (actionType === 'bonus_action') this.state.combat.bonusActionSpent = true;
      if (actionType === 'reaction') this.state.combat.reactionAvailable = false;
    },

    buildCombatAbilityButton(ab, opts = {}) {
      const forceDisabled = !!opts.forceDisabled;
      const reason = forceDisabled
        ? (opts.disabledReason || this._tr('game.ui.unavailable', null, 'Недоступно'))
        : this.getAbilityUnavailableReason(ab);
      const disabled = forceDisabled || !!reason;
      const costLabel = this.getAbilityResourceCostLabel(ab);
      const title = this.escapeAttr(reason || ab.desc || '');
      const label = `${this.renderIcon(ab.icon)} ${this.escapeHtml(ab.name)} (${costLabel})`;
      if (disabled) {
        return `<button type="button" class="choice ability-choice" disabled style="opacity:0.55;cursor:not-allowed;" title="${title}">${label}</button>`;
      }
      return `<button type="button" class="choice ability-choice" ${this.onclickGame('useAbility', ab.id)} title="${title}">${label}</button>`;
    },

    renderCombatActionSection(title, buttonsHtml, opts = {}) {
      const showEmpty = !!opts.showEmpty;
      if (!buttonsHtml && !showEmpty) return '';
      const inner =
        buttonsHtml ||
        (showEmpty ? '<span class="combat-actions-empty">—</span>' : '');
      const col = opts.column ? ` combat-actions-section--${opts.column}` : '';
      const compact = opts.compact ? ' combat-actions-section--compact' : '';
      const inGrid = opts.column ? ' combat-actions-section--in-grid' : '';
      const inBar = opts.compact ? ' combat-actions-section--in-bar' : '';
      return (
        `<div class="combat-actions-section${col}${compact}${inGrid}${inBar}">` +
        `<div class="combat-actions-section-title">${title}</div>` +
        `<div class="combat-actions-section-buttons">${inner}</div></div>`
      );
    },

    /** Три колонки: атака | умения (действие) | бонус */
    renderCombatActionsGrid(columns) {
      const parts = (columns || []).filter(Boolean);
      if (!parts.length) return '';
      return `<div class="combat-actions-grid">${parts.join('')}</div>`;
    },

    getReactionAbilitiesForTrigger(trigger) {
      return (this.state.classData?.abilities || []).filter((ab) => {
        if (!ab?.id) return false;
        if (this.getAbilityActionType(ab) !== 'reaction') return false;
        return this.getAbilityTrigger(ab) === trigger;
      });
    },

    getSmiteDamageFormula(ability) {
      const eff = this.getAbilityPrimaryEffect(ability);
      if (eff?.type === 'smite' && eff.value) return String(eff.value);
      if (typeof ability?.effect === 'string' && ability.effect.startsWith('smite:')) {
        return ability.effect.slice(6);
      }
      return '2d8';
    },

    /** Модальное окно реакции (например, божественная кара после попадания) */
    promptReactionUse(ability, context) {
      const formula = this.getSmiteDamageFormula(ability);
      const bodyEl = document.getElementById('modal-body');
      const titleEl = document.getElementById('modal-title');
      if (!bodyEl || !titleEl) {
        this.finishPlayerAttackAfterReaction(context, false);
        return;
      }
      this._reactionPrompt = { ability, context };
      titleEl.textContent = `Использовать ${ability.name}?`;
      bodyEl.innerHTML = `
        <p>${this.escapeHtml(ability.desc || '')}</p>
        <p><strong>Добавить ${this.escapeHtml(formula)} урона излучением?</strong></p>
        <div class="reaction-prompt-actions" style="display:flex;flex-wrap:wrap;gap:10px;margin-top:14px;">
          <button type="button" class="choice" onclick="GameEngine.confirmReactionPrompt(true)">Да</button>
          <button type="button" class="choice" onclick="GameEngine.confirmReactionPrompt(false)">Нет</button>
        </div>`;
      document.getElementById('modal')?.classList.remove('hidden');
    },

    confirmReactionPrompt(accept) {
      this.closeModal();
      const pending = this._reactionPrompt;
      this._reactionPrompt = null;
      if (!pending) return;
      if (accept) this.applyReactionSmite(pending.ability, pending.context);
      this.finishPlayerAttackAfterReaction(pending.context, !!accept);
    },

    applyReactionSmite(ability, context) {
      const enemy = context?.enemy || this.state.enemies?.[context?.enemyIndex];
      if (!enemy || enemy.hp <= 0) return;
      if (!this.canOfferReactionAbility(ability)) return;
      this.spendAbilityCost(ability);
      this.spendCombatActionType('reaction');
      if (ability.oncePerCombat) {
        if (!this.state.combat.abilitiesUsed) this.state.combat.abilitiesUsed = {};
        this.state.combat.abilitiesUsed[ability.id] = true;
      }
      const bonus = this.parseRoll(this.getSmiteDamageFormula(ability));
      enemy.hp -= bonus;
      this.log(`⚡ ${ability.name}: +${bonus} урона излучением по ${enemy.name}!`, 'log-damage');
      this.playCombatSound('smite_hit');
      this.renderCombat();
      this.updateStats();
    },

    tryOfferReactionAfterPlayerHit(enemyIndex, hitSucceeded) {
      if (!hitSucceeded || !this.state.combat) {
        this.finishPlayerAttackAfterReaction({ enemyIndex }, false);
        return;
      }
      const enemy = this.state.enemies[enemyIndex];
      const reactions = this.getReactionAbilitiesForTrigger('after_player_hit')
        .filter((ab) => this.canOfferReactionAbility(ab));
      if (!reactions.length) {
        this.finishPlayerAttackAfterReaction({ enemyIndex, enemy }, false);
        return;
      }
      const ability = reactions.find((a) => a.id === 'divine_smite') || reactions[0];
      this.promptReactionUse(ability, { enemyIndex, enemy, trigger: 'after_player_hit' });
    },

    finishPlayerAttackAfterReaction(context, usedReaction) {
      if (!this.state.combat) return;
      const enemy = context?.enemy || this.state.enemies?.[context?.enemyIndex];
      if (enemy && enemy.hp <= 0) {
        setTimeout(() => this.nextCombatTurn(), usedReaction ? 800 : 600);
        return;
      }
      if (this.state.combat.actionSurge) {
        this.state.combat.actionSurge = false;
        this.playerCombatTurn();
        return;
      }
      this.state.combat.turnIndex++;
      setTimeout(() => this.nextCombatTurn(), 600);
    },

    /** Слияние сохранённого умения с актуальным из game_data (старый + новый формат effect) */
    reconcileAbility(saved, def, classKey, index) {
      if (!def) return this.normalizeAbility(saved, classKey, index);
      const merged = { ...JSON.parse(JSON.stringify(def)), ...saved };
      const savedHasEffect = merged.effect != null || (merged.effects && merged.effects.length);
      if (!savedHasEffect) {
        if (def.effect != null) merged.effect = def.effect;
        if (def.effects) merged.effects = def.effects;
      } else if (typeof saved.effect === 'string' && def.effect && typeof def.effect === 'object') {
        merged.effect = def.effect;
      }
      if (def.passive && !merged.passive) merged.passive = def.passive;
      if (def.type && !merged.type) merged.type = def.type;
      if (def.targeting && !merged.targeting) merged.targeting = def.targeting;
      if (def.spellLevel != null && (merged.spellLevel == null || merged.spellLevel === '')) {
        merged.spellLevel = def.spellLevel;
      }
      if (def.cost != null && merged.cost == null) merged.cost = def.cost;
      if (def.concentration != null && merged.concentration == null) merged.concentration = def.concentration;
      if (def.actionType && !merged.actionType) merged.actionType = def.actionType;
      if (def.trigger && !merged.trigger) merged.trigger = def.trigger;
      return this.normalizeAbility(merged, classKey, index);
    },

    isConcentrationAbility(ability) {
      return !!(ability && ability.concentration === true);
    },

    reconcileAbilities(savedList, classKey) {
      const defs = this.data?.classes?.[classKey]?.abilities || [];
      const defById = Object.fromEntries(defs.map(d => [d.id, d]));
      const pool = this.getProgression().abilities || {};
      return (savedList || []).map((saved, i) => {
        const def = defById[saved.id] || pool[saved.id];
        return this.reconcileAbility(saved, def, classKey, i);
      });
    },

    isAbilityCombatOnly(ab) {
      if (ab.combatOnly === true) return true;
      if (ab.combatOnly === false) return false;
      return ab.usage === 'combat';
    },

    applyAcBonus(bonus) {
      if (!this.state.combat) return;
      const b = parseInt(bonus, 10) || 0;
      if (b === 4) {
        this.state.combat.shieldBlock = true;
        this.log('🛡️ +4 КД до вашего следующего хода', 'log-combat');
      } else if (b === 5) {
        this.state.combat.shieldSpell = true;
        this.log('🔰 +5 КД против следующей атаки', 'log-combat');
      } else if (b === 2) {
        this.state.combat.shieldOfFaith = true;
        this.log('🛡️ +2 КД', 'log-combat');
      } else {
        this.state.combat.tempAcBonus = (this.state.combat.tempAcBonus || 0) + b;
        this.log(`🛡️ +${b} КД до следующего хода`, 'log-combat');
      }
    },

    formatDamageLabel(dmgRoll, dmgBonus) {
      const roll = dmgRoll || '1d6';
      const bonus = dmgBonus ?? 0;
      return bonus ? `${roll}+${bonus}` : roll;
    },

    getExpThreshold(level) {
      const table = this.getProgression().expTable || [0];
      const idx = Math.max(0, (level || 1) - 1);
      return table[idx] ?? table[table.length - 1] ?? 0;
    },

    getMaxLevel() {
      const pg = this.getProgression();
      return pg.maxLevel || pg.expTable?.length || 1;
    },

    getExpToNextLevel() {
      if (!this.isProgressionEnabled()) return 0;
      if (this.state.level >= this.getMaxLevel()) return 0;
      return Math.max(0, this.getExpThreshold(this.state.level + 1) - this.state.exp);
    },

    /** Сумма stats из progression.levels (2…текущий уровень), напр. +1 атаки на 3 ур. */
    collectProgressionLevelBonuses() {
      const totals = { atkBonus: 0, acBonus: 0 };
      const level = parseInt(this.state.level, 10) || 1;
      if (level < 2) return totals;
      for (let lv = 2; lv <= level; lv++) {
        const cfg = this.getClassLevelConfig(lv);
        const st = cfg?.stats;
        if (!st) continue;
        if (st.atkBonus != null) totals.atkBonus += parseInt(st.atkBonus, 10) || 0;
        if (st.ac != null) totals.acBonus += parseInt(st.ac, 10) || 0;
      }
      return totals;
    },

    getClassLevelConfig(level) {
      const cls = this.data?.classes?.[this.state.className];
      return cls?.progression?.levels?.[String(level)] || cls?.progression?.levels?.[level] || null;
    },

    /** Массив ячеек по уровню персонажа (D&D 5e tables в progression.levels / baseSlots) */
    getSlotsArrayForLevel(classKey, level) {
      const cls = this.data?.classes?.[classKey];
      if (!cls) return null;
      let best = null;
      if (level >= 1 && Array.isArray(cls.baseSlots) && cls.baseSlots.length) {
        best = cls.baseSlots;
      }
      for (let l = 1; l <= level; l++) {
        const slots = cls.progression?.levels?.[String(l)]?.slots;
        if (Array.isArray(slots) && slots.length) best = slots;
      }
      return best;
    },

    getResourceMode(classKey, level) {
      if (this.activeSystem?.getResourceMode) {
        return this.activeSystem.getResourceMode(classKey, level, this.data, this);
      }
      const cls = this.data?.classes?.[classKey];
      if (!cls) return 'energy';
      if (cls.pactMagic) return 'spellSlots';
      const lvl = level ?? this.state.level ?? 1;
      const slots = this.getSlotsArrayForLevel(classKey, lvl);
      if (!slots || !slots.length) return 'energy';
      if (cls.spellcasting && slots.length >= 1) return 'spellSlots';
      if (cls.halfCaster && lvl >= 2 && slots.length >= 1) return 'spellSlots';
      if (slots.length === 1 && !cls.spellcasting && !cls.halfCaster) return 'energy';
      if (slots.length > 1) return 'spellSlots';
      return 'energy';
    },

    buildSpellSlotsFromArray(slotsArray) {
      const out = {};
      (slotsArray || []).forEach((max, i) => {
        const n = Number(max) || 0;
        if (n > 0) out[String(i + 1)] = { c: n, m: n };
      });
      return out;
    },

    initResourcesFromLevel(level) {
      const classKey = this.state.className;
      if (!classKey || !this.data?.classes?.[classKey]) {
        this.state.resources = { mode: 'energy', current: 0, max: 0, spellSlots: null };
        return;
      }
      if (this.activeSystem?.initResources && this.activeSystem.id === 'pf2e') {
        this.state.resources = this.activeSystem.initResources(classKey, level, this.data, this);
        return;
      }
      const cls = this.data.classes[classKey];
      const mode = this.getResourceMode(classKey, level);
      if (cls.pactMagic) {
        const pact = this.getWarlockPactSlots(level);
        this.state.resources = {
          mode: 'spellSlots',
          spellSlots: this.buildWarlockSpellSlots(level),
          pactLevel: pact.slotLevel,
          current: 0,
          max: 0
        };
      } else if (mode === 'spellSlots') {
        const arr = this.getSlotsArrayForLevel(classKey, level) || [2];
        this.state.resources = {
          mode: 'spellSlots',
          spellSlots: this.buildSpellSlotsFromArray(arr),
          current: 0,
          max: 0
        };
      } else {
        const max = Math.max(0, this.getClassResourceMax(classKey, level));
        this.state.resources = {
          mode: 'energy',
          current: max,
          max,
          spellSlots: null
        };
      }
    },

    applyLevelResources(level) {
      this.initResourcesFromLevel(level);
      this.renderSpellSlotsPanel();
    },

    restoreAllResources() {
      const r = this.state.resources;
      if (!r) return;
      if (r.mode === 'spellSlots' && r.spellSlots) {
        Object.values(r.spellSlots).forEach(slot => {
          slot.c = slot.m;
        });
      } else if (r.mode === 'focus') {
        r.current = r.max ?? 0;
      } else {
        r.current = r.max ?? 0;
      }
    },

    migrateResourcesState() {
      const r = this.state.resources;
      if (!r || !this.state.className) return;
      if (r.spellSlots && typeof r.spellSlots === 'object') {
        r.mode = r.mode || 'spellSlots';
        return;
      }
      if (r.mode === 'spellSlots') return;
      const hasLegacy = r.max != null && r.current != null && !r.spellSlots;
      if (hasLegacy && this.getResourceMode(this.state.className, this.state.level) === 'spellSlots') {
        this.initResourcesFromLevel(this.state.level || 1);
        return;
      }
      if (!r.mode) {
        r.mode = 'energy';
        if (r.max == null) r.max = r.current ?? 2;
        if (r.current == null) r.current = r.max;
      }
    },

    getAbilitySpellLevel(ability) {
      if (!ability) return 0;
      const sl = ability.spellLevel;
      if (sl == null || sl === '' || sl === false) return 0;
      const n = parseInt(sl, 10);
      return Number.isFinite(n) && n >= 1 && n <= 5 ? n : 0;
    },

    /** Круг ячейки, которым фактически кастуют (после выбора усиления) */
    getCastSlotLevel(ability) {
      const cast = ability?._castSlotLevel ?? ability?.castSlotLevel;
      const n = parseInt(cast, 10);
      if (Number.isFinite(n) && n >= 1) return n;
      return this.getAbilitySpellLevel(ability);
    },

    withCastSlotLevel(ability, level) {
      return { ...ability, _castSlotLevel: level };
    },

    getUpcastLevelsAboveBase(ability) {
      const min = this.getAbilitySpellLevel(ability);
      const cast = this.getCastSlotLevel(ability);
      return Math.max(0, cast - min);
    },

    /** Доступные круги ячеек для каста (от базового круга заклинания и выше, где есть c > 0) */
    getAvailableCastLevels(ability) {
      if (!this.abilityUsesSpellSlots(ability)) return [];
      const min = this.getAbilitySpellLevel(ability);
      if (min < 1) return [];
      const slots = this.state.resources?.spellSlots || {};
      const levels = [];
      for (const key of Object.keys(slots).sort((a, b) => Number(a) - Number(b))) {
        const lv = Number(key);
        if (!Number.isFinite(lv) || lv < min) continue;
        const slot = slots[key];
        if (slot && slot.c > 0) levels.push(lv);
      }
      return levels;
    },

    canAffordAbilityAtLevel(ability, level) {
      if (this.isSpellBlockedByCurse(ability)) return false;
      if (this.abilityUsesSpellSlots(ability)) {
        const min = this.getAbilitySpellLevel(ability);
        if (level < min) return false;
        const slot = this.state.resources?.spellSlots?.[String(level)];
        return !!(slot && slot.c > 0);
      }
      return this.canAffordAbility(ability);
    },

    needsCastLevelChoice(ability) {
      return this.getAvailableCastLevels(ability).length > 1;
    },

    promptSpellSlotLevel(ability, levels, onPick) {
      const bodyEl = document.getElementById('modal-body');
      const titleEl = document.getElementById('modal-title');
      if (!bodyEl || !titleEl) {
        onPick(levels[0]);
        return;
      }
      this._castLevelPrompt = { ability, onPick };
      const min = this.getAbilitySpellLevel(ability);
      titleEl.textContent = `Ячейка заклинания: ${ability.name || ''}`;
      const btns = levels.map((lv) => {
        const left = this.state.resources?.spellSlots?.[String(lv)]?.c ?? 0;
        const upNote = lv > min ? ` — усиление +${lv - min}` : '';
        return `<button type="button" class="choice" ${this.onclickGame('confirmCastLevelPick', lv)}>Круг ${lv} (свободно: ${left})${this.escapeHtml(upNote)}</button>`;
      }).join('');
      bodyEl.innerHTML = `
        <p>Базовый круг заклинания: <b>${min}</b>. Выберите, какой ячейкой творить:</p>
        <div style="display:flex;flex-direction:column;gap:8px;margin:12px 0;">${btns}</div>
        <button type="button" class="choice" onclick="GameEngine.cancelCastLevelPick()">Отмена</button>`;
      document.getElementById('modal')?.classList.remove('hidden');
    },

    confirmCastLevelPick(level) {
      this.closeModal();
      const pending = this._castLevelPrompt;
      this._castLevelPrompt = null;
      if (!pending) return;
      const lv = parseInt(level, 10);
      if (!this.canAffordAbilityAtLevel(pending.ability, lv)) {
        this.log('❌ Нет свободной ячейки этого круга.', 'log-damage');
        return;
      }
      pending.onPick(lv);
    },

    cancelCastLevelPick() {
      this.closeModal();
      this._castLevelPrompt = null;
    },

    continueUseAbility(ability, castLevel) {
      const sl = this.getAbilitySpellLevel(ability);
      if (sl >= 1) {
        const lv = castLevel ?? this.getAvailableCastLevels(ability)[0] ?? sl;
        if (!this.canAffordAbilityAtLevel(ability, lv)) {
          this.log('❌ Нет свободной ячейки для этого круга.', 'log-damage');
          return;
        }
        const prepared = this.withCastSlotLevel(ability, lv);
        if (this.abilityRequiresEnemyTarget(prepared)) {
          this.beginAbilityTargetSelect(prepared);
          return;
        }
        this.executeAbility(prepared, null);
        return;
      }
      if (!this.canAffordAbility(ability)) {
        this.log('❌ Недостаточно ресурса!', 'log-damage');
        return;
      }
      if (this.abilityRequiresEnemyTarget(ability)) {
        this.beginAbilityTargetSelect(ability);
        return;
      }
      this.executeAbility(ability, null);
    },

    /** Предмет помечен как проклятый в данных */
    isItemCursed(db) {
      return db?.cursed === true;
    },

    /** ID эффектов проклятия предмета */
    getItemCurseEffects(db) {
      const arr = db?.curseEffects;
      return Array.isArray(arr) ? arr.filter(Boolean) : [];
    },

    /** Сцена снятия проклятия (дефолт — храм) */
    getCurseRemoveSceneId(db) {
      const id = db?.curseRemoveScene;
      if (id && String(id).trim()) return String(id).trim();
      return 'temple_priest';
    },

    getSceneDisplayName(sceneId) {
      const scene = this.data?.scenes?.[sceneId];
      return scene?.location || scene?.name || sceneId || '—';
    },

    /** Человекочитаемый список эффектов проклятия */
    formatCurseEffectsList(dbOrEffects) {
      const ids = Array.isArray(dbOrEffects)
        ? dbOrEffects
        : this.getItemCurseEffects(dbOrEffects);
      return ids.map(id => this.CURSE_EFFECT_DEFS[id]?.label || id).join(', ') || '—';
    },

    hasCurseEffect(effectId) {
      return !!this.state.curseEffects?.[effectId];
    },

    isSilencedByCurse() {
      return this.hasCurseEffect('silence');
    },

    isSpellBlockedByCurse(ability) {
      return this.isSilencedByCurse() && this.getAbilitySpellLevel(ability) >= 1;
    },

    /** Пересчёт активных проклятий по надетой экипировке */
    recalculateCurseEffectsFromEquipment() {
      const next = {};
      this.EQUIPMENT_SLOTS.forEach(slot => {
        const itemId = this.getEquippedItemId(slot);
        if (!itemId) return;
        const db = this.itemsData[itemId];
        if (!this.isItemCursed(db)) return;
        this.getItemCurseEffects(db).forEach(eff => { next[eff] = true; });
      });
      this.state.curseEffects = next;
      this.renderCurseEffectsPanel();
    },

    /** Миграция старых сохранений: curseEffects в state */
    migrateCurseState() {
      if (!this.state.curseEffects || typeof this.state.curseEffects !== 'object') {
        this.state.curseEffects = {};
      }
      this.recalculateCurseEffectsFromEquipment();
    },

    getEquippedCursedEntries() {
      const out = [];
      this.EQUIPMENT_SLOTS.forEach(slot => {
        const itemId = this.getEquippedItemId(slot);
        if (!itemId) return;
        const db = this.itemsData[itemId];
        if (!this.isItemCursed(db)) return;
        out.push({
          slot,
          itemId,
          item: db,
          cost: Math.max(0, parseInt(db.curseRemoveCost, 10) || 0)
        });
      });
      return out;
    },

    /** Попытка снять экипировку: проклятые предметы блокируются */
    canUnequipItem(itemId) {
      const db = this.itemsData[itemId];
      if (!this.isItemCursed(db)) return true;
      const sceneId = this.getCurseRemoveSceneId(db);
      const sceneName = this.getSceneDisplayName(sceneId);
      this.showCurseUnequipBlockedModal(db?.name || itemId, sceneName);
      return false;
    },

    showAlertModal(title, bodyHtml) {
      const titleEl = document.getElementById('modal-title');
      const bodyEl = document.getElementById('modal-body');
      if (!titleEl || !bodyEl) return;
      titleEl.textContent = title;
      bodyEl.innerHTML = bodyHtml;
      document.getElementById('modal')?.classList.remove('hidden');
    },

    showCurseUnequipBlockedModal(itemName, sceneName) {
      const safeName = this.escapeHtml(itemName);
      const safeScene = this.escapeHtml(sceneName);
      this.showAlertModal(
        '⚠️ Проклятый предмет',
        `<p>Предмет <b>${safeName}</b> проклят. Снять можно только у священника в сцене «${safeScene}».</p>
         <p style="margin-top:12px;"><button type="button" class="btn btn-primary" onclick="GameEngine.closeModal()">Понятно</button></p>`
      );
    },

    isClassSpellcaster() {
      const cls = this.data?.classes?.[this.state.className];
      return !!(cls?.spellcasting || cls?.halfCaster);
    },

    /** Режим ячеек заклинаний (полный или полукастер) */
    isSpellSlotResourceMode() {
      const r = this.state.resources;
      if (!r?.spellSlots || typeof r.spellSlots !== 'object') return false;
      if (r.mode === 'spellSlots') return true;
      return this.isClassSpellcaster() && Object.values(r.spellSlots).some((s) => (s?.m ?? 0) > 0);
    },

    getTotalSpellSlotCharges() {
      if (!this.isSpellSlotResourceMode()) return 0;
      return Object.values(this.state.resources.spellSlots).reduce(
        (sum, slot) => sum + Math.max(0, parseInt(slot?.c, 10) || 0),
        0
      );
    },

    spendSpellSlotCharges(amount) {
      let left = Math.max(0, parseInt(amount, 10) || 0);
      if (!left || !this.isSpellSlotResourceMode()) return;
      const slots = this.state.resources.spellSlots;
      const keys = Object.keys(slots).sort((a, b) => Number(a) - Number(b));
      for (const key of keys) {
        while (left > 0 && slots[key]?.c > 0) {
          slots[key].c--;
          left--;
        }
        if (left <= 0) break;
      }
    },

    /** Умение оплачивается ячейками, а не пулом energy.current */
    abilityUsesSpellSlots(ability) {
      if (!this.isSpellSlotResourceMode()) return false;
      const spellLevel = this.getAbilitySpellLevel(ability);
      if (spellLevel >= 1) return true;
      const cost = parseInt(ability?.cost, 10) || 0;
      return cost > 0 && this.isClassSpellcaster();
    },

    getAbilityResourceCostLabel(ability) {
      const sl = this.getAbilitySpellLevel(ability);
      if (this.abilityUsesSpellSlots(ability)) {
        if (sl >= 1) return `круг ${sl}`;
        const cost = parseInt(ability?.cost, 10) || 0;
        if (cost <= 1) return '1 ячейка';
        return `${cost} ${cost < 5 ? 'ячейки' : 'ячеек'}`;
      }
      const resName = this.state.classData?.resourceName || 'ресурс';
      return sl >= 1 ? `круг ${sl}` : `${ability?.cost ?? 0} ${resName}`;
    },

    canAffordAbility(ability) {
      if (this.isSpellBlockedByCurse(ability)) return false;
      if (this.abilityUsesSpellSlots(ability)) {
        const spellLevel = this.getAbilitySpellLevel(ability);
        if (spellLevel >= 1) {
          if (this.getAvailableCastLevels(ability).length === 0) return false;
        } else {
          const cost = parseInt(ability?.cost, 10) || 0;
          if (this.getTotalSpellSlotCharges() < cost) return false;
        }
      } else {
        const spellLevel = this.getAbilitySpellLevel(ability);
        if (spellLevel >= 1 && this.isSpellSlotResourceMode()) {
          const slot = this.state.resources?.spellSlots?.[String(spellLevel)];
          if (!slot || slot.c <= 0) return false;
        } else {
          const cost = ability?.cost ?? 0;
          if ((this.state.resources?.current ?? 0) < cost) return false;
        }
      }
      if (this.isPf2e() && this.state.combat) {
        let actionCost = ability?.cost ?? 1;
        if (typeof CombatManager !== 'undefined' && ability.actionCost?.actions != null) {
          actionCost = ability.actionCost.actions;
        } else if (
          typeof CombatManager !== 'undefined' &&
          ability.actionCost &&
          !ability._combatParsed
        ) {
          const parsed = CombatManager.parseAction(ability, {
            system: 'pf2e'
          });
          actionCost = parsed.actionCost?.actions ?? actionCost;
        }
        return (this.state.combat.actionsRemaining ?? 0) >= actionCost;
      }
      return true;
    },

    spendAbilityCost(ability) {
      if (this.abilityUsesSpellSlots(ability)) {
        const spellLevel = this.getAbilitySpellLevel(ability);
        if (spellLevel >= 1) {
          const key = String(this.getCastSlotLevel(ability));
          const slot = this.state.resources?.spellSlots?.[key];
          if (slot && slot.c > 0) slot.c--;
        } else {
          this.spendSpellSlotCharges(ability?.cost ?? 0);
        }
      } else {
        const spellLevel = this.getAbilitySpellLevel(ability);
        if (spellLevel >= 1 && this.isSpellSlotResourceMode()) {
          const key = String(spellLevel);
          const slot = this.state.resources?.spellSlots?.[key];
          if (slot && slot.c > 0) slot.c--;
        } else {
          const cost = ability?.cost ?? 0;
          if (this.state.resources) {
            this.state.resources.current = Math.max(0, (this.state.resources.current ?? 0) - cost);
          }
        }
      }
      if (this.isPf2e() && this.state.combat) {
        if (!ability._skipPf2eActionSpend) {
          const actions =
            ability.actionCost?.actions ?? ability?.cost ?? 1;
          this.spendPf2eActions(actions);
        }
        this.renderSpellSlotsPanel();
        return;
      }
      this.renderSpellSlotsPanel();
    },

    renderSpellSlotsPanel() {
      const panel = document.getElementById('spell-slots-panel');
      const legacy = document.getElementById('resources');
      const r = this.state.resources;
      if (!panel) return;

      if (r?.mode === 'focus') {
        panel.innerHTML = '';
        if (legacy) {
          legacy.textContent = `Focus ${r.current ?? 0}/${r.max ?? 0}`;
          legacy.classList.remove('hidden');
        }
        return;
      }

      if (!r || r.mode !== 'spellSlots' || !r.spellSlots) {
        panel.innerHTML = '';
        if (legacy) {
          if (r && r.mode === 'energy') {
            legacy.textContent = (r.current ?? 0) + '/' + (r.max ?? 0);
            legacy.classList.remove('hidden');
          } else {
            legacy.classList.add('hidden');
          }
        }
        if (r?.mode === 'energy' && (r.max ?? 0) > 0) {
          const cls = this.data?.classes?.[this.state.className];
          const icon = cls?.resource?.icon || '⚡';
          const label = this.escapeHtml(this.state.classData?.resourceName || 'Энергия');
          const dots = [];
          for (let i = 0; i < r.max; i++) {
            dots.push(`<span class="spell-slot-dot ${i < r.current ? 'active' : 'spent'}" title="${i < r.current ? 'доступно' : 'потрачено'}"></span>`);
          }
          panel.innerHTML = `<div class="spell-slot-row"><span class="spell-slot-label">${icon} ${label}</span><div class="spell-slot-dots">${dots.join('')}</div></div>`;
        }
        return;
      }

      if (legacy) legacy.classList.add('hidden');
      const cls = this.data?.classes?.[this.state.className];
      const pactLabel = cls?.pactMagic && r.pactLevel
        ? `💎 ${this.escapeHtml(this.state.classData?.resourceName || 'Ячейки')} (${r.pactLevel} кр.)`
        : null;
      const keys = Object.keys(r.spellSlots).sort((a, b) => Number(a) - Number(b));
      panel.innerHTML = keys.map(circle => {
        const slot = r.spellSlots[circle];
        const max = slot.m ?? 0;
        const cur = slot.c ?? 0;
        const dots = [];
        for (let i = 0; i < max; i++) {
          dots.push(`<span class="spell-slot-dot ${i < cur ? 'active' : 'spent'}" title="${i < cur ? 'доступно' : 'потрачено'}"></span>`);
        }
        const rowLabel = pactLabel || `Круг ${circle}`;
        return `<div class="spell-slot-row"><span class="spell-slot-label">${rowLabel}</span><div class="spell-slot-dots">${dots.join('')}</div></div>`;
      }).join('');
    },

    resolveAbilityDefinition(abilityId) {
      const pool = this.getProgression().abilities || {};
      if (pool[abilityId]) return JSON.parse(JSON.stringify(pool[abilityId]));
      for (const cls of Object.values(this.data?.classes || {})) {
        const found = (cls.abilities || []).find(a => a.id === abilityId);
        if (found) return JSON.parse(JSON.stringify(found));
      }
      return null;
    },

    initProgressionState() {
      this.state.level = 1;
      this.state.exp = 0;
      this.state.expAwarded = {};
      this.state.pendingLevelUp = null;
      this.state.resumeAfterLevelUp = null;
    },

    resumeAfterLevelUp() {
      if (this.state.pendingLevelUp) return;
      const resume = this.state.resumeAfterLevelUp;
      if (!resume) return;
      this.state.resumeAfterLevelUp = null;
      if (resume.type === 'scene' && resume.id) {
        this.showScene(resume.id);
      }
    },

    renderLevelBar() {
      const levelEl = document.getElementById('char-level');
      const xpText = document.getElementById('xp-text');
      const xpFill = document.getElementById('xp-bar-fill');
      const panel = document.getElementById('level-panel');
      if (!panel) return;

      if (!this.isProgressionEnabled()) {
        panel.classList.add('hidden');
        return;
      }
      panel.classList.remove('hidden');

      const level = this.state.level || 1;
      const maxLevel = this.getMaxLevel();
      if (levelEl) levelEl.textContent = level;

      if (level >= maxLevel) {
        if (xpText) xpText.textContent = this._tr('game.ui.maxLevel', null, 'Макс. уровень');
        if (xpFill) xpFill.style.width = '100%';
        return;
      }

      const curThreshold = this.getExpThreshold(level);
      const nextThreshold = this.getExpThreshold(level + 1);
      const span = Math.max(1, nextThreshold - curThreshold);
      const progress = Math.max(0, Math.min(1, (this.state.exp - curThreshold) / span));

      if (xpText) xpText.textContent = `${this.state.exp} / ${nextThreshold}`;
      if (xpFill) xpFill.style.width = (progress * 100) + '%';
    },

    addExp(amount, reason) {
      if (!this.isProgressionEnabled() || !amount || amount <= 0) return;
      if (this.state.level >= this.getMaxLevel()) return;

      this.state.exp += amount;
      this.log(`⭐ +${amount} опыта${reason ? ' — ' + reason : ''}`, 'log-dice');
      this.renderLevelBar();
      this.checkLevelUp();
      this.updateStats();
      this.saveGame();
    },

    grantExpOnce(key, amount, reason) {
      if (!key || !this.isProgressionEnabled()) return;
      if (this.state.expAwarded[key]) return;
      this.state.expAwarded[key] = true;
      this.addExp(amount, reason);
    },

    getSkillCheckExp(skill, skillCheck) {
      const pg = this.getProgression();
      if (skillCheck?.exp != null) return skillCheck.exp;
      if (pg.skillExp?.[skill] != null) return pg.skillExp[skill];
      if (pg.defaults?.skillCheckExp != null) return pg.defaults.skillCheckExp;
      return 15;
    },

    awardSkillCheckExp(skill, skillCheck) {
      const exp = this.getSkillCheckExp(skill, skillCheck);
      const once = skillCheck?.expOnce !== false;
      const key = skillCheck?.expKey || `skill:${this.state.scene}:${skill}`;
      if (once) this.grantExpOnce(key, exp, 'успешная проверка');
      else this.addExp(exp, 'успешная проверка');
    },

    awardSceneExp(scene) {
      if (!scene?.exp) return;
      this.grantExpOnce(`scene:${scene.id}`, scene.exp, 'сцена');
    },

    awardQuestExp(questId) {
      const quest = this.data?.quests?.[questId];
      const exp = quest?.rewards?.exp;
      if (!exp) return;
      this.grantExpOnce(`quest:${questId}:complete`, exp, `квест «${quest.title}»`);
    },

    /**
     * Текущая стадия квеста: приоритет state.questStages, затем legacy-флаг quest_<id>.
     */
    getQuestStage(questId) {
      if (!questId) return null;
      if (typeof QuestRuntime !== 'undefined') {
        QuestRuntime.bind(this);
        const key = QuestRuntime.getStageKey(questId);
        if (key != null) return key;
      }
      const direct = this.state.questStages?.[questId];
      if (direct != null && direct !== '') return String(direct);
      const legacy = this.state.flags?.['quest_' + questId];
      if (legacy == null || legacy === '') return null;
      const quest = this.data?.quests?.[questId];
      if (quest && typeof QuestSystem !== 'undefined') {
        return QuestSystem.resolveStageRef(quest, legacy);
      }
      return String(legacy);
    },

    /** Квест завершён: стадия __finished__, legacy complete или текущая стадия с finish: true */
    isQuestFinished(questId) {
      if (typeof QuestRuntime !== 'undefined') {
        QuestRuntime.bind(this);
        if (QuestRuntime.isCompleted(questId)) return true;
      }
      const s = this.state.questStages?.[questId];
      if (s === '__finished__') return true;
      if (this.state.flags?.['quest_' + questId] === 'complete') return true;
      const quest = this.data?.quests?.[questId];
      if (!quest || s == null || s === '') return false;
      const st = QuestSystem.getStageData(quest, s);
      return !!st?.finish;
    },

    /** Квест провален */
    isQuestFailed(questId) {
      if (typeof QuestRuntime !== 'undefined') {
        QuestRuntime.bind(this);
        if (QuestRuntime.isFailed(questId)) return true;
      }
      const s = this.state.questStages?.[questId];
      if (s === '__failed__') return true;
      if (this.state.flags?.['quest_' + questId] === 'failed') return true;
      const quest = this.data?.quests?.[questId];
      if (!quest || s == null || s === '') return false;
      return QuestSystem.isStageFailed(quest, s);
    },

    /**
     * Провал квеста: стадия с failed: true или ссылка "failed" / __failed__.
     * @param {string} questId
     * @param {string} [stageRef='failed']
     */
    failQuest(questId, stageRef = 'failed', opts = {}) {
      this.updateQuest(questId, stageRef, opts);
    },

    /** Синхронизация legacy-флага quest_* для старых условий и сцен */
    syncLegacyQuestFlag(questId, stageKey) {
      const quest = this.data?.quests?.[questId];
      let legacyVal = stageKey;
      if (quest?.legacyStageMap) {
        const entry = Object.entries(quest.legacyStageMap).find(([, v]) => String(v) === String(stageKey));
        if (entry) legacyVal = entry[0];
      }
      this.state.flags['quest_' + questId] = legacyVal;
    },

    /** Квест «Пропавшая сумка»: сумка может быть найдена до разговора с Джеком */
    syncLostBagQuestProgress(opts = {}) {
      if (!this.data?.quests?.lost_bag) return;
      if (this.state.flags.jackRewarded) return;
      if (!this.state.flags.jackQuest) return;
      const hasBag = (this.state.inventory || []).includes('jack_bag');
      const stage = hasBag ? '2' : '1';
      this.updateQuest('lost_bag', stage, { silentLog: !!opts.silentLog });
    },

    /**
     * Обновляет стадию квеста, пишет log в журнал боя, обновляет сайдбар «Активные задания».
     * @param {string} questId — ID из data.quests
     * @param {string|number} stage — ключ стадии ("0") или legacy ("start", "complete")
     * @param {{ silentLog?: boolean, skipFinish?: boolean }} opts
     */
    updateQuest(questId, stage, opts = {}) {
      if (!questId || !this.data?.quests?.[questId]) return;
      if (typeof QuestRuntime !== 'undefined') {
        QuestRuntime.bind(this);
        QuestRuntime.setStage(questId, stage, opts || {});
        return;
      }
      // Fallback without runtime
      const quest = this.data.quests[questId];
      const stageKey = QuestSystem.resolveStageRef(quest, stage);
      if (stageKey == null) return;
      if (!this.state.questStages) this.state.questStages = {};
      this.state.questStages[questId] = stageKey;
      this.updateUI();
      this.saveGame();
    }

    /** Открывает точки на карте путешествий при смене стадии побочных квестов */
    applyQuestMapUnlocks(questId, stageKey) {
      if (!this.state.visitedLocations) this.state.visitedLocations = {};
      if (questId === 'albert_locket' && String(stageKey) === '0') {
        this.state.visitedLocations.river_bend = true;
      }
      if (questId === 'lukorn_investigation' && String(stageKey) === '1') {
        this.state.visitedLocations.north_gate = true;
      }
    },

    awardCombatExp(enemyIds, expKey) {
      if (!enemyIds?.length) return;
      const defaults = this.getProgression().defaults || {};
      let total = 0;
      enemyIds.forEach(id => {
        const enemy = this.data?.enemies?.[id];
        total += enemy?.exp ?? defaults.enemyExp ?? 0;
      });
      if (total <= 0) return;
      const key = expKey || `combat:${this.state.scene}`;
      this.grantExpOnce(key, total, 'победа в бою');
    },

    /**
     * Бросок таблицы loot по ID врагов из боя (все участники, включая убитых).
     * Возвращает [{ item, qty }, ...]; item === 'gold' — золото.
     */
    rollCombatLootFromEnemies(enemyIds) {
      const result = [];
      const byItem = new Map();
      const enemiesData = this.data?.enemies || {};

      (enemyIds || []).forEach(enemyId => {
        const template = enemiesData[enemyId];
        const table = template?.loot;
        if (!Array.isArray(table) || !table.length) return;

        table.forEach(entry => {
          const chance = Number(entry.chance);
          if (!entry.item || isNaN(chance) || chance <= 0) return;
          if (Math.random() >= chance) return;

          const min = Math.max(0, parseInt(entry.min, 10) || 0);
          const max = Math.max(min, parseInt(entry.max, 10) ?? min);
          let qty = min;
          if (max > min) {
            qty = min + Math.floor(Math.random() * (max - min + 1));
          }
          if (qty <= 0) return;

          const prev = byItem.get(entry.item) || 0;
          byItem.set(entry.item, prev + qty);
        });
      });

      byItem.forEach((qty, item) => result.push({ item, qty }));
      return result;
    },

    /** Подпись строки добычи для окна */
    formatLootEntryLabel(entry) {
      if (entry.item === 'gold') {
        return `${entry.qty} зм`;
      }
      const db = this.itemsData[entry.item] || this.data?.items?.[entry.item];
      const name = db?.name || entry.item;
      if (entry.qty > 1) return `${name} ×${entry.qty}`;
      return name;
    },

    /** Окно добычи после победы; награды сцены — после перехода на nextScene */
    showCombatLootModal(tempLoot, nextScene, combatSnapshot) {
      this.state.pendingCombatLoot = {
        loot: tempLoot,
        nextScene: nextScene || null,
        combat: combatSnapshot || null
      };

      const modal = document.getElementById('loot-modal');
      const body = document.getElementById('loot-modal-body');
      if (!modal || !body) {
        this.claimCombatLoot();
        return;
      }

      const lines = tempLoot.map(entry => {
        const icon = entry.item === 'gold' ? '💰' : (this.itemsData[entry.item]?.icon || '📦');
        return `<div class="loot-modal-row">${icon} ${this.escapeHtml(this.formatLootEntryLabel(entry))}</div>`;
      });
      body.innerHTML = lines.length
        ? lines.join('')
        : '<div class="loot-modal-empty">' + this.escapeHtml(this._tr('game.ui.nothingDropped', null, 'Ничего не выпало.')) + '</div>';
      modal.classList.remove('hidden');
    },

    closeCombatLootModal() {
      const modal = document.getElementById('loot-modal');
      if (modal) modal.classList.add('hidden');
    },

    /** Применить добычу: предметы в инвентарь, gold — в state.gold */
    applyCombatLootEntries(loot) {
      if (!loot?.length) return;
      loot.forEach(({ item, qty }) => {
        const n = Math.max(0, parseInt(qty, 10) || 0);
        if (n <= 0) return;
        if (item === 'gold') {
          this.state.gold += n;
          this.log(`💰 +${n} зм (добыча с врагов)`, 'log-heal');
          return;
        }
        const resolved = this.resolveItemId(item);
        if (!this.data?.items?.[resolved]) {
          console.warn('Добыча: предмет не найден:', item);
          return;
        }
        for (let i = 0; i < n; i++) {
          this.state.inventory.push(resolved);
        }
        const label = this.formatLootEntryLabel({ item: resolved, qty: n });
        this.log(`🎒 Добыча: ${label}`, 'log-heal');
      });
      this.updateUI();
    },

    /** Кнопка «Забрать»: выдать добычу и перейти на nextScene боя */
    claimCombatLoot() {
      const pending = this.state.pendingCombatLoot;
      this.closeCombatLootModal();
      if (pending?.loot?.length) {
        this.applyCombatLootEntries(pending.loot);
      }
      const next = pending?.nextScene;
      const combat = pending?.combat;
      this.state.pendingCombatLoot = null;
      this.finishCombatVictory(next, combat);
      this.saveGame();
    },

    /** Завершение победы: опыт и переход на сцену (награды gold/items — в showScene) */
    finishCombatVictory(nextScene, combat) {
      if (combat) {
        const ids = combat.enemies || combat.enemyIds || [];
        this.awardCombatExp(ids, combat.expKey);
        const sourceScene = this.getCombatSourceSceneId(combat);
        if (sourceScene) this.markCombatCleared(sourceScene);
      }
      if (this.state._combatFromSceneElement && typeof SceneElementRunner !== 'undefined') {
        delete this.state._combatFromSceneElement;
        const runner = SceneElementRunner.getRunner(this);
        if (runner?.paused) {
          SceneElementRunner.resume(this);
          return;
        }
      }
      if (nextScene && this.data.scenes[nextScene]) {
        this.showScene(nextScene);
      } else if (nextScene) {
        this.setText(this._tr('game.ui.sceneNotFound', { id: nextScene }, 'Ошибка: сцена «' + nextScene + '» не найдена.'));
        this.setChoices([]);
      } else {
        this.setChoices([]);
      }
    },

    shouldApplyQuestStageUpdate(questId, newStageRef) {
      if (!questId || newStageRef == null || newStageRef === '') return false;
      if (this.isQuestFinished(questId) || this.isQuestFailed(questId)) return false;
      const quest = this.data?.quests?.[questId];
      if (!quest) return true;
      const currentKey = this.getQuestStage(questId);
      if (currentKey == null || currentKey === '' || currentKey === '__finished__') return true;
      const newKey = QuestSystem.resolveStageRef(quest, newStageRef);
      if (newKey == null) return true;
      const curNum = Number(currentKey);
      const newNum = Number(newKey);
      if (!Number.isNaN(curNum) && !Number.isNaN(newNum) && newNum < curNum) return false;
      return true;
    },

    applyFlags(flags) {
      if (!flags) return;
      for (const [key, value] of Object.entries(flags)) {
        if (key.startsWith('quest_')) {
          const questId = key.slice(6);
          if (this.shouldApplyQuestStageUpdate(questId, value)) {
            this.updateQuest(questId, value, { silentLog: false });
          }
          continue;
        }
        this.state.flags[key] = value;
      }
      if (flags.thicketBagLoot || flags.quest_lost_bag != null) {
        this.syncLostBagQuestProgress({ silentLog: false });
      }
    },

    isVillageReturnScene(sceneId) {
      const villageScenes = new Set([
        'village_hub', 'tavern', 'tavern_entry', 'village', 'village_albert', 'village_millinfo',
        'village_accept', 'village_haggle', 'village_square', 'forest_path',
        'quest_board', 'start'
      ]);
      return villageScenes.has(sceneId);
    },

    maybeAlbertWalksToVillage(sceneId) {
      if (!this.state.flags?.albertSaved) return;
      if (this.state.flags.albertEscorted || this.state.flags.albertAtVillage) return;
      if (!this.isVillageReturnScene(sceneId)) return;
      this.state.flags.albertAtVillage = true;
      this.log('🏚️ Альберт добрался до деревни своим ходом. Зайдите в таверну к Марте.', 'log-heal');
      this.saveGame();
    },

    claimFindAlbertReward() {
      if (this.state.flags.find_albert_rewardClaimed) return false;
      if (!this.state.flags.albertSaved) return false;
      if (!this.applyQuestRewards('find_albert', { claimFlag: 'find_albert_rewardClaimed', logGold: 'награда от Марты' })) {
        return false;
      }
      this.state.flags.albertAtVillage = true;
      this.updateQuest('find_albert', 'complete');
      this.updateStats();
      this.saveGame();
      return true;
    },

    /**
     * Выдаёт награды квеста из data.quests[questId].rewards.
     * @param {string} questId
     * @param {{ claimFlag?: string, gold?: boolean, items?: boolean, reputation?: boolean, logGold?: string }} opts
     */
    applyQuestRewards(questId, opts = {}) {
      const quest = this.data?.quests?.[questId];
      if (!quest) return false;
      if (opts.claimFlag && this.state.flags[opts.claimFlag]) return false;

      const rewards = quest.rewards || {};
      let applied = false;

      if (opts.gold !== false) {
        const gold = Number(rewards.gold) || 0;
        if (gold > 0) {
          if (typeof this.changeGold === 'function') this.changeGold(gold, { reason: 'quest_reward', silent: true });
          else this.state.gold += gold;
          const note = opts.logGold ? ` (${opts.logGold})` : '';
          this.log(`💰 +${gold} зм${note}`, 'log-heal');
          applied = true;
        }
      }
      if (opts.items !== false) {
        (rewards.items || []).forEach((itemId) => {
          if (itemId) {
            this.addItem(itemId);
            applied = true;
          }
        });
      }
      if (opts.reputation !== false && typeof QuestSystem !== 'undefined') {
        QuestSystem.getReputationEntries(rewards).forEach(({ flag, amount }) => {
          this.changeReputation(flag, amount);
          applied = true;
        });
      }
      if (opts.claimFlag) this.state.flags[opts.claimFlag] = true;
      return applied || !!opts.claimFlag;
    },

    handleEpilogueAlbertArrival() {
      this.state.flags.albertEscorted = true;
      this.state.flags.albertAtVillage = true;
      if (!this.state.flags.find_albert_rewardClaimed) {
        this.claimFindAlbertReward();
      }
    },

    handleMartaFindAlbertReward() {
      this.setLocation('Таверна «Кривой Котёл»');
      const claimed = this.claimFindAlbertReward();
      if (claimed) {
        this.setText(
          'Марта обнимает Альберта, потом крепко жмёт вам руки.\n\n«Ты не просто спас мельника — ты спас всю деревню. Держи награду — и знай: дверь таверны всегда открыта для тебя.»'
        );
        this.setDialogue([
          { speaker: 'Марта', text: 'Пятьдесят золотых — и моя благодарность. Альберт уже отдыхает у камина.' },
          { speaker: 'Альберт', text: 'Спасибо, ' + (this.state.charName || 'друг') + '. Без тебя я бы не выбрался.' }
        ]);
      } else {
        this.setText('Марта улыбается: «Награда уже вручена, но благодарность наша не кончается.»');
        this.clearDialogue();
      }
      const sideQuestChoices = this.getAlbertSideQuestChoices();
      this.setChoices([
        ...sideQuestChoices,
        { text: '← В таверну', to: 'tavern' },
        { text: '🏘️ На площадь', to: 'village_hub' }
      ]);
    },

    /** Кнопки старта квестов Люкорна и медальона (после спасения Альберта) */
    getAlbertSideQuestChoices() {
      const ctx = this.getConditionContext();
      const raw = [
        {
          text: '🗣️ Спросить Альберта о письме Люкорна',
          to: 'albert_lukorn_talk',
          questSet: { questId: 'lukorn_investigation', stage: '0' },
          showIf: {
            all: [
              { flag: 'albertSaved', equals: true },
              { notHasItem: 'lukorn_signet_ring' },
              { flag: 'lukorn_investigation_started', equals: false }
            ]
          }
        },
        {
          text: '🗣️ Поговорить с Альбертом о медальоне Эльзы',
          to: 'albert_locket_talk',
          showIf: {
            all: [
              { flag: 'albertSaved', equals: true },
              { notHasItem: 'elsa_locket' },
              { flag: 'albert_locket_started', equals: false }
            ]
          }
        }
      ];
      return raw.filter((c) => ConditionSystem.isChoiceVisible(c, ctx));
    },

    migrateAlbertQuestState() {
      const f = this.state.flags || {};
      if (!f.albertSaved) return;
      if (f.find_albert_rewardClaimed) {
        if (!f.albertAtVillage) f.albertAtVillage = true;
        return;
      }
      const stage = this.getQuestStage('find_albert');
      const finishedWithoutReward = this.isQuestFinished('find_albert')
        || stage === '4'
        || stage === '__finished__'
        || f.quest_find_albert === 'complete';
      if (!finishedWithoutReward) return;
      f.albertAtVillage = true;
      this.state.questStages = this.state.questStages || {};
      this.state.questStages.find_albert = '3';
      this.syncLegacyQuestFlag('find_albert', 'rescue');
      const quest = this.data?.quests?.find_albert;
      if (quest) quest.isFinished = false;
    },

    applyStartingFlags() {
      const start = { ...(this.data?.startingFlags || {}) };
      Object.assign(start, this.data?.reputation?.starting || {});
      for (const [key, value] of Object.entries(start)) {
        if (this.state.flags[key] === undefined) this.state.flags[key] = value;
      }
    },

    getReputationFactionMeta(repFlag) {
      if (typeof ReputationSystem !== 'undefined') {
        return ReputationSystem.getFactionMeta(this.data, repFlag);
      }
      return this.data?.reputation?.[repFlag] || null;
    },

    getReputationValue(repFlag) {
      if (!repFlag || this.state.flags[repFlag] === undefined) return null;
      const n = Number(this.state.flags[repFlag]);
      return Number.isNaN(n) ? 0 : n;
    },

    getReputationStatusLabel(value, repFlag) {
      const v = Number(value) || 0;
      const meta = repFlag ? this.getReputationFactionMeta(repFlag) : null;
      if (meta && typeof ReputationSystem !== 'undefined') {
        return ReputationSystem.getStatusLabel(meta, v);
      }
      if (v < -10) return this._tr('game.ui.reputationHostile', null, 'Вражда');
      if (v <= 10) return this._tr('game.ui.reputationNeutral', null, 'Нейтралитет');
      if (v < 25) return this._tr('game.ui.reputationFriendly', null, 'Дружба');
      return this._tr('game.ui.reputationHero', null, 'Герой');
    },

    getReputationStatusClass(value, repFlag) {
      const v = Number(value) || 0;
      const meta = repFlag ? this.getReputationFactionMeta(repFlag) : null;
      if (meta && typeof ReputationSystem !== 'undefined') {
        return ReputationSystem.getStatusClass(meta, v);
      }
      if (v < -10) return 'enemy';
      if (v <= 10) return 'neutral';
      if (v < 25) return 'friend';
      return 'hero';
    },

    /** Множитель цены из уровня фракции (discount в JSON). */
    getReputationPriceMultiplier(repFlag) {
      const rep = this.getReputationValue(repFlag);
      const n = rep == null ? 0 : rep;
      const meta = this.getReputationFactionMeta(repFlag);
      if (meta && typeof ReputationSystem !== 'undefined') {
        return ReputationSystem.getPriceMultiplier(meta, n);
      }
      let mult = 1 - n / 100;
      return Math.max(0.7, Math.min(1.5, mult));
    },

    getShopPrice(basePrice, repFlag = 'rep_village') {
      const base = Math.max(0, Number(basePrice) || 0);
      const price = Math.ceil(base * this.getReputationPriceMultiplier(repFlag));
      return Math.max(1, price);
    },

    /** Базовая цена предмета из JSON (price или cost); без цены — 0 */
    getItemBasePrice(db) {
      if (!db) return 0;
      const raw = db.price != null ? db.price : db.cost;
      return Math.max(0, Number(raw) || 0);
    },

    /** Нормализация shopConfig сцены */
    normalizeShopConfig(scene) {
      const cfg = scene?.shopConfig || {};
      return {
        inventory: Array.isArray(cfg.inventory) ? [...cfg.inventory] : [],
        sellMultiplier: Number(cfg.sellMultiplier) || 1,
        buyMultiplier: cfg.buyMultiplier != null ? Number(cfg.buyMultiplier) : 0.5,
        repFlag: cfg.repFlag || null,
        exitScene: cfg.exitScene || null,
        jackShop: !!cfg.jackShop
      };
    },

    /** Товары и цены лавки Джека (покупка + продажа через renderShopUI) */
    getJackShopConfig(scene) {
      const fromScene = scene?.shopConfig;
      if (fromScene?.inventory?.length) {
        return this.normalizeShopConfig({ ...scene, shopConfig: { ...fromScene, jackShop: true } });
      }
      const jackNpc = this.data?.npcs?.jack;
      const inventory = jackNpc?.shopItems || [
        'healing_potion', 'rope', 'supplies', 'fireball_scroll', 'focus_potion'
      ];
      return {
        inventory: [...inventory],
        sellMultiplier: 1,
        buyMultiplier: 0.5,
        repFlag: 'rep_village',
        exitScene: scene?.exitScene || 'village_hub',
        jackShop: true
      };
    },

    /** Цена покупки у торговца: base * sellMultiplier * репутация */
    getShopBuyPrice(itemId, shopConfig) {
      let base = null;
      if (shopConfig?.jackShop) {
        const override = this.data?.npcs?.jack?.shopPrices?.[itemId];
        if (override != null) base = Math.max(0, Number(override) || 0);
      }
      const db = this.data?.items?.[itemId];
      if (base == null) base = this.getItemBasePrice(db);
      if (base <= 0) return 0;
      let price = base * (shopConfig.sellMultiplier ?? 1);
      if (shopConfig.repFlag) {
        price *= this.getReputationPriceMultiplier(shopConfig.repFlag);
      }
      return Math.max(0, Math.ceil(price));
    },

    /** Цена продажи торговцу: base * buyMultiplier * репутация */
    getShopSellPrice(itemId, shopConfig) {
      const db = this.data?.items?.[itemId];
      const base = this.getItemBasePrice(db);
      if (base <= 0) return 0;
      let price = base * (shopConfig.buyMultiplier ?? 0.5);
      if (shopConfig.repFlag) {
        price *= this.getReputationPriceMultiplier(shopConfig.repFlag);
      }
      return Math.max(0, Math.floor(price));
    },

    /** Можно ли продать предмет игроком */
    getSellItemBlockReason(itemId) {
      const db = this.data?.items?.[itemId];
      if (!db) return this._tr('game.ui.itemNotFound', null, 'Предмет не найден');
      if (db.type === 'quest' || db.type === 'key') return this._tr('game.ui.questItem', null, 'Квестовый предмет');
      if (db.cursed === true) return this._tr('game.ui.cursedNoSell', null, 'Проклятый предмет нельзя продать');
      if (this.isItemEquipped(itemId)) return this._tr('game.ui.unequipFirst', null, 'Сначала снимите экипировку');
      if (this.getItemBasePrice(db) <= 0) return this._tr('game.ui.merchantWontBuy', null, 'Торговец не покупает');
      if (!this.state.inventory.includes(itemId)) return this._tr('game.ui.notInInventory', null, 'Нет в инвентаре');
      return null;
    },

    getSellableInventoryIds() {
      const seen = new Set();
      const ids = [];
      for (const itemId of this.state.inventory || []) {
        if (seen.has(itemId)) continue;
        seen.add(itemId);
        if (!this.getSellItemBlockReason(itemId)) ids.push(itemId);
      }
      return ids;
    },

    /**
     * Универсальная лавка: special "shop" + shopConfig в JSON сцены.
     */
    handleShop(sceneId, scene) {
      const cfg = this.normalizeShopConfig(scene);

      if (cfg.repFlag) {
        const rep = this.getReputationValue(cfg.repFlag) ?? 0;
        const meta = this.getReputationFactionMeta(cfg.repFlag);
        const tradeOk = meta && typeof ReputationSystem !== 'undefined'
          ? ReputationSystem.isTradeAllowed(meta, rep)
          : rep > -20;
        if (!tradeOk) {
          this.setLocation(scene?.location || 'Лавка');
          this.setText('Торговец отворачивается.\n\n«С тобой я не торгую. Торговля запрещена. Убирайся.»');
          this.clearDialogue();
          const exit = cfg.exitScene || this.getShopDefaultExit(scene);
          this.setChoices(exit ? [{ text: '🚪 Уйти', to: exit }] : []);
          return;
        }
      }

      this.setLocation(scene?.location || 'Лавка');
      if (typeof this.applyInheritedSceneAmbience === 'function') {
        this.applyInheritedSceneAmbience(sceneId || this.state.scene);
      }
      if (scene?.text) this.setText(scene.text);
      else this.setText('Перед вами прилавок с товарами.');

      this.clearDialogue();
      this.state.shopSession = {
        sceneId: sceneId || this.state.scene,
        config: cfg,
        selectedBuyId: null,
        selectedSellId: null,
        message: ''
      };
      this.refreshShopUI();
      this.saveGame();
    },

    getShopDefaultExit(scene) {
      if (scene?.shopConfig?.exitScene) return scene.shopConfig.exitScene;
      const ch = (scene?.choices || []).find(c => c.to);
      return ch?.to || null;
    },

    closeShop() {
      const session = this.state.shopSession;
      const inComponent = session?.componentIndex != null;
      this.state.shopSession = null;
      if (inComponent) {
        this.refreshSceneComponents?.();
        return;
      }
      const exit = session?.config?.exitScene;
      if (exit && this.data?.scenes?.[exit]) {
        this.showScene(exit);
        return;
      }
      this.setChoices([]);
      this.updateUI();
    },

    refreshShopUI() {
      const session = this.state.shopSession;
      const area = session?.containerEl || document.getElementById('choices-area');
      this.renderShopUIInto(area);
    },

    shopSelectBuy(itemId) {
      if (!this.state.shopSession) return;
      this.state.shopSession.selectedBuyId = itemId;
      this.state.shopSession.selectedSellId = null;
      this.state.shopSession.message = '';
      this.refreshShopUI();
    },

    shopSelectSell(itemId) {
      if (!this.state.shopSession) return;
      this.state.shopSession.selectedSellId = itemId;
      this.state.shopSession.selectedBuyId = null;
      this.state.shopSession.message = '';
      this.refreshShopUI();
    },

    shopActionBuy() {
      const session = this.state.shopSession;
      if (!session) return;
      const itemId = session.selectedBuyId;
      const cfg = session.config;
      if (!itemId) {
        session.message = 'Выберите товар у торговца.';
        this.refreshShopUI();
        return;
      }
      const db = this.data?.items?.[itemId];
      const price = this.getShopBuyPrice(itemId, cfg);
      if (!db || price <= 0) {
        session.message = 'Этот товар нельзя купить.';
        this.refreshShopUI();
        return;
      }
      if (this.state.gold < price) {
        session.message = this._tr('game.ui.notEnoughGold', { price }, `Недостаточно золота (нужно ${price} зм).`);
        this.refreshShopUI();
        return;
      }
      if (typeof this.changeGold === 'function') this.changeGold(-price, { reason: 'buy', silent: true }); else this.state.gold -= price;
      this.addItem(itemId);
      this.updateStats();
      session.message =
        itemId === this.ARROWS_ITEM_ID
          ? `Куплено: 10 стрел (−${price} зм).`
          : `Куплено: ${db.name} (−${price} зм).`;
      session.selectedBuyId = null;
      this.log(`🛒 ${db.name} (−${price} зм)`, 'log-heal');
      this.refreshShopUI();
      this.saveGame();
    },

    shopActionSell() {
      const session = this.state.shopSession;
      if (!session) return;
      const itemId = session.selectedSellId;
      const cfg = session.config;
      if (!itemId) {
        session.message = 'Выберите предмет из своего инвентаря.';
        this.refreshShopUI();
        return;
      }
      const reason = this.getSellItemBlockReason(itemId);
      if (reason) {
        session.message = reason;
        this.refreshShopUI();
        return;
      }
      const db = this.data?.items?.[itemId];
      const price = this.getShopSellPrice(itemId, cfg);
      if (price <= 0) {
        session.message = 'Торговец не покупает этот предмет.';
        this.refreshShopUI();
        return;
      }
      const idx = this.state.inventory.indexOf(itemId);
      if (idx === -1) {
        session.message = 'Предмета нет в инвентаре.';
        this.refreshShopUI();
        return;
      }
      this.state.inventory.splice(idx, 1);
      if (!this.state.inventory.includes(itemId)) {
        this.unequipItem(itemId, { silent: true });
      }
      if (typeof this.changeGold === 'function') this.changeGold(price, { reason: 'sell', silent: true }); else this.state.gold += price;
      this.updateStats();
      session.message = `Продано: ${db?.name || itemId} (+${price} зм).`;
      session.selectedSellId = null;
      this.log(`💰 Продажа: ${db?.name || itemId} (+${price} зм)`, 'log-heal');
      this.refreshShopUI();
      this.saveGame();
    },

    shopActionLeave() {
      this.closeShop();
    },

    /**
     * Кузница: special "blacksmith" — заточка экипированного оружия/брони/щита за золото.
     */
    handleBlacksmith(sceneId, scene) {
      this.setLocation(scene?.location || 'Кузница');
      if (typeof this.applyInheritedSceneAmbience === 'function') {
        this.applyInheritedSceneAmbience(sceneId || this.state.scene);
      }
      if (scene?.text) this.setText(scene.text);
      else this.setText('Кузнец осматривает ваше снаряжение.\n\n«Что будем закалять?»');
      this.clearDialogue();
      this.state.blacksmithSession = {
        sceneId: sceneId || this.state.scene,
        exitScene: scene?.exitScene || this.getShopDefaultExit(scene),
        message: ''
      };
      this.refreshBlacksmithUI();
      this.saveGame();
    },

    blacksmithLeave() {
      const session = this.state.blacksmithSession;
      const inComponent = session?.componentIndex != null;
      const exit = session?.exitScene;
      this.state.blacksmithSession = null;
      if (inComponent) {
        this.refreshSceneComponents?.();
        return;
      }
      if (exit && this.data?.scenes?.[exit]) {
        this.showScene(exit);
      } else {
        this.setChoices([]);
        this.updateUI();
      }
    },

    refreshBlacksmithUI() {
      const session = this.state.blacksmithSession;
      const area = session?.componentContainer || document.getElementById('choices-area');
      this.renderBlacksmithUIInto(area);
    },

    blacksmithEnhance(itemId) {
      const session = this.state.blacksmithSession;
      if (!session) return;

      const equippedSlot = this.ENHANCEMENT_SLOTS.find(
        s => this.getEquippedItemId(s) === itemId
      );
      if (!equippedSlot) {
        session.message = 'Предмет должен быть экипирован.';
        this.refreshBlacksmithUI();
        return;
      }

      const template = this.itemsData?.[itemId];
      const current = this.getItemEnhancementLevel(itemId);
      const max = session?.maxEnhancement != null
        ? Math.min(this.getItemEnhancementMax(template), Number(session.maxEnhancement))
        : this.getItemEnhancementMax(template);
      const cost = this.getNextEnhancementCost(itemId);

      if (!template || cost == null || current >= max) {
        session.message = 'Достигнут максимум заточки.';
        this.refreshBlacksmithUI();
        return;
      }

      if (this.state.gold < cost) {
        session.message = this._tr('game.ui.notEnoughGold', { price: cost }, `Недостаточно золота (нужно ${cost} зм).`);
        this.refreshBlacksmithUI();
        return;
      }

      if (typeof this.changeGold === 'function') this.changeGold(-cost, { reason: 'service', silent: true }); else this.state.gold -= cost;
      this.setItemEnhancementLevel(itemId, current + 1);
      this.recalcDerivedStats();
      this.updateStats();

      const newLevel = current + 1;
      session.message = `Успех! ${template.name} теперь +${newLevel}. (−${cost} зм)`;
      this.log(`⚒️ Заточка: ${template.name} +${newLevel} (−${cost} зм)`, 'log-heal');
      this.refreshBlacksmithUI();
      this.saveGame();
    },

    /**
     * Храм: special "temple_priest" — снятие проклятия с надетых предметов за золото.
     */
    handleTemplePriest(sceneId, scene) {
      this.setLocation(scene?.location || 'Храм');
      if (typeof this.applyInheritedSceneAmbience === 'function') {
        this.applyInheritedSceneAmbience(sceneId || this.state.scene);
      }
      if (scene?.text) this.setText(scene.text);
      else this.setText('Священник осматривает ваше снаряжение.\n\n«Проклятие можно снять с того, что на вас надето — за подношение.»');
      this.clearDialogue();
      this.state.templePriestSession = {
        sceneId: sceneId || this.state.scene,
        exitScene: scene?.exitScene || this.getShopDefaultExit(scene),
        message: ''
      };
      this.renderTemplePriestUI();
      this.saveGame();
    },

    templePriestLeave() {
      const session = this.state.templePriestSession;
      const inComponent = session?.componentIndex != null;
      const exit = session?.exitScene;
      this.state.templePriestSession = null;
      if (inComponent) {
        this.refreshSceneComponents?.();
        return;
      }
      if (exit && this.data?.scenes?.[exit]) {
        this.showScene(exit);
      } else {
        this.setChoices([]);
        this.updateUI();
      }
    },

    templePriestRemoveCurse(itemId) {
      const session = this.state.templePriestSession;
      if (!session) return;

      const entry = this.getEquippedCursedEntries().find(e => e.itemId === itemId);
      if (!entry) {
        session.message = 'Предмет не надет или не проклят.';
        this.refreshTemplePriestUI();
        return;
      }

      const db = entry.item;
      const cost = entry.cost;
      if (this.state.gold < cost) {
        session.message = this._tr('game.ui.notEnoughGold', { price: cost }, `Недостаточно золота (нужно ${cost} зм).`);
        this.refreshTemplePriestUI();
        return;
      }

      if (typeof this.changeGold === 'function') this.changeGold(-cost, { reason: 'service', silent: true }); else this.state.gold -= cost;
      delete this.state.equipped[entry.slot];
      if (entry.slot === 'shield') delete this.state.equipped.offhand;

      this.recalculateCurseEffectsFromEquipment();
      this.recalcDerivedStats();
      this.updateStats();

      session.message = `Священник снял ${db.name}. Предмет остаётся проклятым.`;
      this.log(`✨ Священник снял ${db.name} (−${cost} зм). Предмет в инвентаре, проклятие вернётся при надевании.`, 'log-heal');
      if (session.componentIndex != null) {
        this.refreshSceneComponents?.();
      } else {
        this.refreshTemplePriestUI();
      }
      this.saveGame();
    },

    refreshTemplePriestUI() {
      const session = this.state.templePriestSession;
      const area = session?.componentContainer || document.getElementById('choices-area');
      this.renderTemplePriestUIInto(area);
    },

    renderTemplePriestUI() {
      this.renderTemplePriestUIInto(document.getElementById('choices-area'));
    },

    renderTemplePriestUIInto(area) {
      if (!area || !this.state.templePriestSession) return;

      const session = this.state.templePriestSession;
      const entries = this.getEquippedCursedEntries();

      let listHtml = '<div class="temple-priest-list">';
      if (!entries.length) {
        listHtml += '<p class="hint">Нет надетых проклятых предметов.</p>';
      } else {
        entries.forEach(e => {
          const afford = this.state.gold >= e.cost;
          const effects = this.formatCurseEffectsList(e.item);
          listHtml += `<div class="temple-priest-row">
            <span><b>${this.escapeHtml(e.item.name)}</b> — ${this.escapeHtml(effects)}</span>
            <button type="button" class="choice temple-priest-btn${afford ? '' : ' temple-priest-btn--poor'}"
              ${afford ? `onclick="GameEngine.templePriestRemoveCurse('${this.escapeAttr(e.itemId)}')"` : 'disabled'}>
              Снять за ${e.cost} зм
            </button>
          </div>`;
        });
      }
      listHtml += '</div>';

      const msg = session.message
        ? `<p class="temple-priest-msg">${this.escapeHtml(session.message)}</p>`
        : '';

      area.innerHTML = `
        <div class="temple-priest-panel">
          <div class="temple-priest-header">☦️ Священник</div>
          <p class="hint">Золото: ${this.state.gold} зм. Снимается только с надетых вещей; предмет остаётся проклятым.</p>
          ${listHtml}
          ${msg}
          ${session.componentContainer ? '' : '<button type="button" class="choice" onclick="GameEngine.templePriestLeave()">Уйти</button>'}
        </div>`;

      if (!session.componentContainer) {
        this.state.currentChoices = [];
        this.state.currentChoiceIndices = [];
      }
    },

    renderBlacksmithUI() {
      this.renderBlacksmithUIInto(document.getElementById('choices-area'));
    },

    renderBlacksmithUIInto(area) {
      if (!area || !this.state.blacksmithSession) return;

      const session = this.state.blacksmithSession;
      const entries = this.getBlacksmithEnhanceableEntries();

      let equipHtml = '<div class="blacksmith-equipped">';
      this.ENHANCEMENT_SLOTS.forEach(slot => {
        const id = this.getEquippedItemId(slot);
        const item = id ? this.getEffectiveItemData(id) : null;
        const slotLabel = slot === 'weapon_main' ? 'Оружие (осн.)' : slot === 'armor' ? 'Броня' : 'Щит';
        if (!item) {
          equipHtml += `<div class="blacksmith-slot">${slotLabel}: <span class="hint">— пусто —</span></div>`;
        } else {
          const lvl = this.getItemEnhancementLevel(id);
          const max = this.getItemEnhancementMax(item);
          equipHtml += `<div class="blacksmith-slot">${slotLabel}: <b>${this.escapeHtml(item.name)}</b> (+${lvl}${max ? ` / +${max}` : ''})</div>`;
        }
      });
      equipHtml += '</div>';

      let actionsHtml = '';
      if (entries.length) {
        entries.forEach(e => {
          const afford = this.state.gold >= e.cost;
          actionsHtml += `<button type="button" class="choice blacksmith-enhance-btn${afford ? '' : ' blacksmith-enhance-btn--poor'}"
            ${afford ? `onclick="GameEngine.blacksmithEnhance('${this.escapeAttr(e.itemId)}')"` : 'disabled'}
            title="${afford ? '' : 'Недостаточно золота'}">
            Заточить ${this.escapeHtml(e.name)} до +${e.next} — ${e.cost} зм
          </button>`;
        });
      } else {
        actionsHtml = '<div class="hint" style="margin:8px 0;">Нет доступных улучшений (максимум или слоты пусты).</div>';
      }

      area.innerHTML = `
        <div class="blacksmith-panel">
          <div class="blacksmith-header">
            <b>⚒️ Кузница</b> · 💰 ${this.state.gold} зм
            ${session.message ? `<div class="shop-flash">${this.escapeHtml(session.message)}</div>` : ''}
          </div>
          ${equipHtml}
          <div class="blacksmith-actions">${actionsHtml}</div>
          ${session.componentContainer ? '' : '<button type="button" class="choice" onclick="GameEngine.blacksmithLeave()">Уйти</button>'}
        </div>`;

      if (!session.componentContainer) {
        this.state.currentChoices = [];
        this.state.currentChoiceIndices = [];
      }
    },

    /** Две колонки: товары торговца / инвентарь игрока */
    renderShopUI() {
      this.renderShopUIInto(document.getElementById('choices-area'));
    },

    renderShopUIInto(area) {
      if (!area || !this.state.shopSession) return;

      const session = this.state.shopSession;
      const cfg = session.config;
      const selBuy = session.selectedBuyId;
      const selSell = session.selectedSellId;

      const merchantItems = (cfg.inventory || []).filter(itemId => {
        const price = this.getShopBuyPrice(itemId, cfg);
        return price > 0 && this.data?.items?.[itemId];
      });

      const sellableIds = this.getSellableInventoryIds();
      const blockedInInv = [];
      const seen = new Set();
      for (const itemId of this.state.inventory || []) {
        if (seen.has(itemId)) continue;
        seen.add(itemId);
        const reason = this.getSellItemBlockReason(itemId);
        if (reason) blockedInInv.push({ itemId, reason, db: this.data.items[itemId] });
      }

      const renderRow = (itemId, price, selected, onClick, suffix = '') => {
        const db = this.data.items[itemId];
        const cls = 'shop-item-row' + (selected ? ' shop-item-row--selected' : '');
        const bundleHint =
          itemId === this.ARROWS_ITEM_ID ? ' · 10 шт.' : '';
        return `<button type="button" class="${cls}" onclick="${onClick}">
          <span class="shop-item-name">${this.escapeHtml((db?.icon || '📦') + ' ' + (db?.name || itemId))}${bundleHint}</span>
          <span class="shop-item-price">${price} зм${suffix}</span>
        </button>`;
      };

      let leftHtml = merchantItems.length
        ? merchantItems.map(id => renderRow(
          id,
          this.getShopBuyPrice(id, cfg),
          selBuy === id,
          `GameEngine.shopSelectBuy('${this.escapeAttr(id)}')`
        )).join('')
        : '<div class="shop-empty">Нет товаров с ценой</div>';

      let rightHtml = '';
      sellableIds.forEach(id => {
        rightHtml += renderRow(
          id,
          this.getShopSellPrice(id, cfg),
          selSell === id,
          `GameEngine.shopSelectSell('${this.escapeAttr(id)}')`,
          ''
        );
      });
      blockedInInv.forEach(({ itemId, reason, db }) => {
        rightHtml += `<div class="shop-item-row shop-item-row--disabled" title="${this.escapeAttr(reason)}">
          <span class="shop-item-name">${this.escapeHtml((db?.icon || '📦') + ' ' + (db?.name || itemId))}</span>
          <span class="shop-item-hint">${this.escapeHtml(reason)}</span>
        </div>`;
      });
      if (!rightHtml) {
        rightHtml = '<div class="shop-empty">Нечего продать</div>';
      }

      const repNote = cfg.repFlag && this.getReputationValue(cfg.repFlag) != null
        ? `<div class="shop-rep">Репутация: ${this.escapeHtml(this.getReputationStatusLabel(this.getReputationValue(cfg.repFlag), cfg.repFlag))} (${this.getReputationValue(cfg.repFlag)})</div>`
        : '';

      area.innerHTML = `
        <div class="shop-panel">
          <div class="shop-header">
            <b>💰 Золото: ${this.state.gold} зм</b>
            ${repNote}
            ${session.message ? `<div class="shop-flash">${this.escapeHtml(session.message)}</div>` : ''}
          </div>
          <div class="shop-columns">
            <div class="shop-column">
              <div class="shop-column-title">Товары торговца</div>
              <div class="shop-item-list">${leftHtml}</div>
            </div>
            <div class="shop-column">
              <div class="shop-column-title">Ваш инвентарь</div>
              <div class="shop-item-list">${rightHtml}</div>
            </div>
          </div>
          <div class="shop-actions">
            <button type="button" class="choice shop-action-btn" onclick="GameEngine.shopActionBuy()">Купить</button>
            <button type="button" class="choice shop-action-btn" onclick="GameEngine.shopActionSell()">Продать</button>
            ${cfg.jackShop && !this.state.flags.jackQuest ? `<button type="button" class="choice shop-action-btn" onclick="GameEngine.openJackQuestTalk()">🗣️ О пропавшей сумке</button>` : ''}
            ${cfg.jackShop && this.state.inventory.includes('jack_bag') && this.state.flags.jackQuest && !this.state.flags.jackRewarded ? `<button type="button" class="choice shop-action-btn" onclick="GameEngine.showScene('jack_reward')">🎒 Вернуть сумку</button>` : ''}
            ${session.containerEl ? '' : '<button type="button" class="choice shop-action-btn" onclick="GameEngine.shopActionLeave()">Уйти</button>'}
          </div>
        </div>`;

      if (!session.containerEl) {
        this.state.currentChoices = [];
        this.state.currentChoiceIndices = [];
      }
    },

    changeReputation(repFlag, amount, opts = {}) {
      if (!repFlag) return;
      const delta = Number(amount) || 0;
      if (!delta) return;

      const prevRaw = this.state.flags[repFlag];
      const prev = prevRaw === undefined ? 0 : Number(prevRaw) || 0;
      const next = prev + delta;
      this.state.flags[repFlag] = next;

      const meta = this.getReputationFactionMeta(repFlag);
      const factionName = meta?.name || repFlag;
      const prevStatus = this.getReputationStatusClass(prev, repFlag);
      const nextStatus = this.getReputationStatusClass(next, repFlag);
      const significant = Math.abs(delta) >= 5 || prevStatus !== nextStatus;

      const sign = delta > 0 ? '+' : '';
      if (opts.notify !== false) {
        this.log(`🤝 Репутация с «${factionName}» изменена: ${sign}${delta}`, delta > 0 ? 'log-heal' : 'log-damage');
      } else if (significant) {
        const verb = delta > 0 ? 'улучшилась' : 'ухудшилась';
        const status = this.getReputationStatusLabel(next, repFlag);
        this.log(`🤝 Репутация (${factionName}) ${verb}: ${status}`, delta > 0 ? 'log-heal' : 'log-damage');
      }
      this.renderRelationsPanel();
      this.saveGame();
    },

    applyNpcReputationEffects(npcId, trigger) {
      const npc = this.data?.npcs?.[npcId];
      if (!npc?.reputationEffects?.length) return;
      npc.reputationEffects.forEach((eff) => {
        if (!eff || eff.trigger !== trigger || !eff.faction) return;
        const onceKey = eff.once ? `rep_npc_${npcId}_${trigger}_${eff.faction}` : null;
        if (onceKey && this.state.flags[onceKey]) return;
        const val = Number(eff.value);
        if (!val) return;
        this.changeReputation(eff.faction, val);
        if (onceKey) this.state.flags[onceKey] = true;
      });
    },

    applyQuestNpcReputation(questId) {
      const giver = this.data?.quests?.[questId]?.giver;
      if (giver) this.applyNpcReputationEffects(giver, 'quest_complete');
    },

    /** Репутация за убийство врага с «Важность для фракции» (один раз на экземпляр) */
    processDefeatedEnemiesReputation() {
      if (!this.state.enemies?.length) return;
      this.state.enemies.forEach((enemy) => {
        if (!enemy || enemy.hp > 0 || enemy._repKillApplied) return;
        enemy._repKillApplied = true;
        if (typeof QuestEvents !== 'undefined') {
          QuestEvents.emit('EnemyKilled', {
            enemyId: enemy.id || enemy.templateId,
            id: enemy.id,
            templateId: enemy.templateId || enemy.id,
            count: 1
          });
        }
        const template = this.data?.enemies?.[enemy.id];
        if (!template?.factionImportant) return;
        const delta = Number(template.reputationOnKill);
        if (!delta || !template.faction) return;
        this.changeReputation(template.faction, delta);
      });
    },

    tryEnterCombatWithReputation(rawScene, enemies) {
      if (typeof ReputationSystem === 'undefined') return false;
      const enemyIds = rawScene.combat;
      const primaryId = enemyIds?.[0];
      const template = this.data?.enemies?.[primaryId];
      if (!template?.faction) return false;

      const rep = this.getReputationValue(template.faction) ?? 0;
      const behavior = ReputationSystem.resolveEnemyBehavior(template, rep);
      const nextScene = rawScene.nextScene;
      const exitTo = nextScene || this.getSceneExitTarget(rawScene) || 'village_hub';

      if (behavior.action === 'auto_combat') {
        this.startCombat(enemies, nextScene, enemyIds);
        return true;
      }

      const dialogue = behavior.dialogue || '';
      if (behavior.action === 'ally') {
        let text = rawScene.text || '';
        if (dialogue) text += (text ? '\n\n' : '') + dialogue;
        this.setText(text);
        this.setChoices([
          { text: '🗣️ Поговорить', to: exitTo },
          { text: '🚪 Уйти', to: exitTo }
        ]);
        this.saveGame();
        this.renderTravelMenu();
        return true;
      }

      this.state.pendingFactionCombat = { enemies, nextScene, enemyIds, behavior };
      let text = rawScene.text || '';
      if (dialogue) text += (text ? '\n\n' : '') + dialogue;
      this.setText(text);

      const choices = [];
      if (behavior.action === 'dialogue_optional_combat') {
        choices.push({ text: '🗣️ Поговорить', to: exitTo });
        choices.push({ text: '⚔️ Атаковать', action: 'start_pending_faction_combat' });
        choices.push({ text: '🚪 Уйти', to: exitTo });
      } else {
        choices.push({ text: '⚔️ Вступить в бой', action: 'start_pending_faction_combat' });
        choices.push({ text: '🚪 Уйти', to: exitTo });
      }
      this.setChoices(choices);
      this.saveGame();
      this.renderTravelMenu();
      return true;
    },

    applyChoiceReputation(choice) {
      if (!choice?.reputation || typeof choice.reputation !== 'object') return;
      for (const [repFlag, amount] of Object.entries(choice.reputation)) {
        this.changeReputation(repFlag, amount);
      }
    },

    checkAchievements(event) {
      if (typeof AchievementSystem === 'undefined') return [];
      return AchievementSystem.checkAll(this, event || {});
    },

    onAchievementUnlocked(ach) {
      const title = ach?.title || ach?.id || 'Достижение';
      this.log(`🏆 Достижение разблокировано: «${title}»`, 'log-heal');
      this.showAchievementToast(ach);
      const soundId = ach?.sound || 'buff';
      if (typeof AudioEngine !== 'undefined' && AudioEngine.playSFX) {
        AudioEngine.playSFX(soundId, { volume: 0.92 });
      } else if (typeof this.playCombatSound === 'function') {
        this.playCombatSound(soundId);
      }
    },

    showAchievementToast(ach) {
      const el = document.getElementById('achievement-toast');
      const nameEl = document.getElementById('achievement-toast-name');
      const iconEl = document.getElementById('achievement-toast-icon');
      if (!el || !nameEl) return;

      const title = ach?.title || 'Достижение';
      nameEl.textContent = title;
      if (iconEl) {
        iconEl.innerHTML = this.renderIcon?.(ach?.icon || '🏆') || (ach?.icon || '🏆');
      }

      el.classList.remove('hidden');
      el.classList.add('is-visible');
      clearTimeout(this._achievementToastTimer);
      this._achievementToastTimer = setTimeout(() => {
        el.classList.remove('is-visible');
        el.classList.add('hidden');
      }, 4200);
    },

    renderAchievementsPanel() {
      const grid = document.getElementById('achievements-grid');
      const summary = document.getElementById('achievements-summary');
      if (!grid) return;

      if (typeof AchievementSystem === 'undefined') {
        grid.innerHTML = '<div class="hint">Модуль достижений не загружен.</div>';
        return;
      }

      AchievementSystem.normalizeAll(this.data);
      const catalog = AchievementSystem.getCatalog(this.data);
      const ids = Object.keys(catalog);
      const counts = AchievementSystem.getUnlockedCount(this);

      if (summary) {
        summary.textContent = ids.length
          ? `${counts.unlocked} / ${counts.total}`
          : '0 / 0';
      }

      if (!ids.length) {
        grid.innerHTML = '<div class="hint">В этом модуле пока нет достижений.</div>';
        return;
      }

      grid.innerHTML = ids.map((id) => {
        const display = AchievementSystem.getDisplayMeta(this, id, catalog[id]);
        const cls = display.unlocked ? 'ach-trophy-card is-unlocked' : 'ach-trophy-card is-locked';
        const iconHtml = this.renderIcon?.(display.icon) || this.escapeHtml(display.icon);
        return `<div class="${cls}" title="${this.escapeAttr(display.description)}">
          <div class="ach-trophy-icon">${iconHtml}</div>
          <div class="ach-trophy-title">${this.escapeHtml(display.title)}</div>
          <div class="ach-trophy-desc">${this.escapeHtml(display.description || '')}</div>
        </div>`;
      }).join('');
    },

    renderRelationsPanel() {
      const list = document.getElementById('relations-list');
      const dockBtn = document.querySelector('.dock-icon[data-panel="relations"]');
      if (!list) return;

      if (typeof ReputationSystem !== 'undefined') ReputationSystem.ensureFactions(this.data);
      const catalog = this.data?.reputation || {};
      const rows = [];

      Object.keys(catalog).forEach(repFlag => {
        if (repFlag === 'starting' || typeof catalog[repFlag] !== 'object') return;
        if (this.state.flags[repFlag] === undefined) return;
        const meta = this.getReputationFactionMeta(repFlag);
        const value = this.getReputationValue(repFlag) ?? 0;
        const status = this.getReputationStatusLabel(value, repFlag);
        const statusClass = this.getReputationStatusClass(value, repFlag);
        const level = typeof ReputationSystem !== 'undefined'
          ? ReputationSystem.getLevelForValue(meta, value)
          : null;
        const color = level?.color || '#888';
        const nextLv = typeof ReputationSystem !== 'undefined'
          ? ReputationSystem.getNextLevel(meta, value)
          : null;
        let progressHint = '';
        if (nextLv) {
          const need = Number(nextLv.min) - value;
          progressHint = `title="До «${this.escapeAttr(nextLv.label)}»: ${need > 0 ? '+' : ''}${need} (${value} / 100)"`;
        } else {
          progressHint = `title="Текущее значение: ${value} / 100"`;
        }
        const barPct = Math.max(0, Math.min(100, ((value + 100) / 200) * 100));
        rows.push(`
          <div class="relation-row" ${progressHint}>
            <span class="relation-row-name">${this.renderIcon(meta?.icon || '🤝')} ${this.escapeHtml(meta?.name || repFlag)}</span>
            <span class="relation-row-meta">
              <span class="relation-row-value">${value}</span>
              <span class="relation-row-status relation-row-status--${statusClass}" style="color:${color}">${this.escapeHtml(status)}</span>
            </span>
            <div class="relation-progress" aria-hidden="true"><span class="relation-progress-fill" style="width:${barPct}%;background:${color}"></span></div>
          </div>`);
      });

      if (!rows.length) {
        dockBtn?.classList.add('hidden');
        list.innerHTML = '<div class="hint">Пока нет активных отношений.</div>';
        if (typeof SidebarDock !== 'undefined' && SidebarDock.activePanel === 'relations') {
          SidebarDock.closeAll();
        }
        return;
      }

      dockBtn?.classList.remove('hidden');
      list.innerHTML = rows.join('');
    },

    applyLevelHpGain(level) {
      const cls = this.data.classes[this.state.className];
      const lvlCfg = this.getClassLevelConfig(level);
      const formula = lvlCfg?.hpGain || cls?.progression?.hpGain || this.getProgression().defaultHpGain || '1d8';
      let gain = this.parseRoll(formula);
      const con = this.getBaseStats().con || 10;
      gain += Math.floor((con - 10) / 2);
      this.state.baseMaxHp = (this.state.baseMaxHp ?? this.state.maxHp) + gain;
      this.state.hp += gain;
      this.recalcDerivedStats();
      return gain;
    },

    applyLevelStatBonuses(levelConfig) {
      if (!levelConfig?.stats) return;
      // atk/ac из уровней учитываются в recalcDerivedStats (collectProgressionLevelBonuses)
      if (levelConfig.stats.atkBonus != null || levelConfig.stats.ac != null) {
        this.recalcDerivedStats?.();
        return;
      }
      for (const [key, value] of Object.entries(levelConfig.stats)) {
        if (this.state.classData[key] != null) {
          this.state.classData[key] += value;
        }
      }
    },

    STAT_KEYS: ['str', 'dex', 'con', 'int', 'wis', 'cha'],

    STAT_LABELS: {
      str: 'СИЛ', dex: 'ЛОВ', con: 'ТЕЛ', int: 'ИНТ', wis: 'МУД', cha: 'ХАР'
    },

    /**
     * ASI: объект вида { str: 2 } или { dex: 1, wis: 1 } (сумма +2).
     */
    applyStatBonus(statsObj) {
      if (!statsObj || typeof statsObj !== 'object') return false;
      const base = this.state.stats || this.state.classData?.stats;
      if (!base) return false;

      let spent = 0;
      const parts = [];
      for (const [key, raw] of Object.entries(statsObj)) {
        if (!this.STAT_KEYS.includes(key)) continue;
        const n = Number(raw) || 0;
        if (n <= 0) continue;
        spent += n;
        const before = base[key] ?? 10;
        base[key] = Math.min(20, before + n);
        if (this.state.stats) this.state.stats[key] = base[key];
        parts.push(`${this.STAT_LABELS[key] || key} ${before}→${base[key]}`);
      }

      if (spent <= 0) return false;
      this.log(`📈 Улучшение характеристик (+${spent}): ${parts.join(', ')}`, 'log-heal');
      this.updateAbilityGrid();
      this.updateStats();
      this.recalcDerivedStats?.();
      return true;
    },

    levelConfigNeedsAsi(levelConfig) {
      return !!(levelConfig && (levelConfig.asi === true || levelConfig.type === 'asi'));
    },

    getPendingLevelChoiceIds(pending) {
      if (!pending?.choiceIds?.length) return [];
      return pending.choiceIds.filter(id => this.resolveAbilityDefinition(id));
    },

    finishPendingLevelUp() {
      const pending = this.state.pendingLevelUp;
      if (!pending) return;
      this.state.pendingLevelUp = null;
      this.closeLevelUpModal();
      this.updateStats();
      this.resumeAfterLevelUp();
      this.checkLevelUp();
      this.saveGame();
    },

    showLevelUpAsiModal(pending) {
      const modal = document.getElementById('levelup-modal');
      const title = document.getElementById('levelup-title');
      const text = document.getElementById('levelup-text');
      const choicesEl = document.getElementById('levelup-choices');
      if (!modal || !choicesEl) {
        this.finishPendingLevelUp();
        return;
      }

      pending.asiMode = pending.asiMode || '+2';
      pending.asiPicks = pending.asiPicks || {};

      if (title) title.textContent = `Уровень ${pending.level}! — характеристики`;
      const hpNote = pending.hpGain > 0 ? ` (+${pending.hpGain} макс. ОЗ).` : '';
      if (text) {
        text.textContent = `Распределите +2 очка характеристик${hpNote} Можно взять +2 к одной или +1 к двум разным.`;
      }

      const mode = pending.asiMode;
      const picks = pending.asiPicks;
      const pickCount = Object.values(picks).reduce((s, v) => s + v, 0);

      let html = `
        <div class="levelup-asi-modes">
          <button type="button" class="choice levelup-asi-mode${mode === '+2' ? ' active' : ''}" ${this.onclickGame('setLevelUpAsiMode', '+2')}">+2 к одной</button>
          <button type="button" class="choice levelup-asi-mode${mode === '+1+1' ? ' active' : ''}" ${this.onclickGame('setLevelUpAsiMode', '+1+1')}">+1 к двум</button>
        </div>
        <div class="levelup-asi-grid">
      `;

      this.STAT_KEYS.forEach(stat => {
        const val = this.state.classData.stats[stat] ?? 10;
        const mod = this.getModifier(val);
        const modStr = mod >= 0 ? '+' + mod : String(mod);
        const picked = picks[stat] || 0;
        html += `<button type="button" class="choice levelup-stat-btn" ${this.onclickGame('pickLevelUpAsiStat', stat)}>
          <span class="levelup-stat-name">${this.STAT_LABELS[stat]}</span>
          <span class="levelup-stat-val">${val}${picked ? ` (+${picked})` : ''}</span>
          <span class="levelup-stat-mod">${modStr}</span>
        </button>`;
      });

      html += `</div><p class="levelup-asi-hint">Выбрано очков: ${pickCount} / 2</p>`;

      const canConfirm = pickCount === 2;
      html += `<button type="button" class="choice levelup-asi-confirm" ${canConfirm ? this.onclickGame('confirmLevelUpAsi') : 'disabled'}>Подтвердить</button>`;

      choicesEl.innerHTML = html;
      modal.classList.remove('hidden');
    },

    setLevelUpAsiMode(mode) {
      const pending = this.state.pendingLevelUp;
      if (!pending) return;
      pending.asiMode = mode === '+1+1' ? '+1+1' : '+2';
      pending.asiPicks = {};
      this.showLevelUpAsiModal(pending);
    },

    pickLevelUpAsiStat(stat) {
      const pending = this.state.pendingLevelUp;
      if (!pending || !this.STAT_KEYS.includes(stat)) return;
      const picks = { ...(pending.asiPicks || {}) };
      const mode = pending.asiMode || '+2';
      const current = picks[stat] || 0;
      const total = Object.values(picks).reduce((s, v) => s + v, 0);

      if (mode === '+2') {
        pending.asiPicks = total === 2 && current === 2 ? {} : { [stat]: 2 };
      } else {
        if (current >= 1) {
          delete picks[stat];
        } else if (total < 2) {
          picks[stat] = 1;
        }
        pending.asiPicks = picks;
      }
      this.showLevelUpAsiModal(pending);
    },

    confirmLevelUpAsi() {
      const pending = this.state.pendingLevelUp;
      if (!pending?.asiPicks) return;
      const total = Object.values(pending.asiPicks).reduce((s, v) => s + v, 0);
      if (total !== 2) return;

      this.applyStatBonus(pending.asiPicks);
      pending.asiDone = true;

      const abilityIds = this.getPendingLevelChoiceIds(pending);
      if (abilityIds.length) {
        this.showLevelUpAbilityModal(pending.level, abilityIds, pending.hpGain, true);
        return;
      }
      this.finishPendingLevelUp();
    },

    showLevelUpAbilityModal(level, choiceIds, hpGain, afterAsi) {
      const validChoices = (choiceIds || []).filter(id => this.resolveAbilityDefinition(id));
      if (!validChoices.length) {
        this.finishPendingLevelUp();
        return;
      }

      const modal = document.getElementById('levelup-modal');
      const title = document.getElementById('levelup-title');
      const text = document.getElementById('levelup-text');
      const choicesEl = document.getElementById('levelup-choices');
      if (!modal || !choicesEl) {
        this.finishPendingLevelUp();
        return;
      }

      const pending = this.state.pendingLevelUp || {};
      pending.level = level;
      pending.choiceIds = validChoices;
      pending.hpGain = hpGain;
      pending.asiDone = afterAsi || pending.asiDone;
      this.state.pendingLevelUp = pending;

      if (title) title.textContent = `Уровень ${level}!`;
      if (text) {
        const hpPart = !afterAsi && hpGain > 0 ? ` +${hpGain} макс. ОЗ.` : '';
        text.textContent = `Выберите новое умение${hpPart}`;
      }

      choicesEl.innerHTML = validChoices.map(id => {
        const ab = this.resolveAbilityDefinition(id);
        const sl = this.getAbilitySpellLevel(ab);
        const cost = sl >= 1 ? ` (круг ${sl})` : (ab.cost != null ? ` (${ab.cost} ${this.state.classData.resourceName})` : '');
        const tag = ab.type === 'passive' || ab.passive ? ' [пассив]' : '';
        return `<button type="button" class="choice levelup-choice" ${this.onclickGame('pickLevelUpAbility', id)}>
          <span class="levelup-ab-icon">${this.escapeHtml(ab.icon || '✨')}</span>
          <span class="levelup-ab-name">${this.escapeHtml(ab.name)}${this.escapeHtml(cost)}${this.escapeHtml(tag)}</span>
          <span class="levelup-ab-desc">${this.escapeHtml(ab.desc || '')}</span>
        </button>`;
      }).join('');

      modal.classList.remove('hidden');
    },

    applyPassiveAbility(ability) {
      const passive = ability.passive;
      if (!passive) return;
      // ОЗ: по-прежнему накапливаем в baseMaxHp (совместимость со старыми сохранениями)
      if (passive.maxHpBonus) {
        const bonus = parseInt(passive.maxHpBonus, 10) || 0;
        if (bonus > 0) {
          this.ensureBaseMaxHp();
          this.state.baseMaxHp = (this.state.baseMaxHp ?? this.state.maxHp) + bonus;
          this.state.hp += bonus;
        }
      }
      // КД/атака — только через recalcDerivedStats (иначе затираются при экипировке)
      if (passive.resourceMaxBonus) {
        const r = this.state.resources;
        const bonus = parseInt(passive.resourceMaxBonus, 10) || 0;
        if (r?.mode === 'spellSlots' && r.spellSlots?.['1']) {
          r.spellSlots['1'].m += bonus;
          r.spellSlots['1'].c += bonus;
        } else if (r) {
          r.max = (r.max ?? 0) + bonus;
          r.current = (r.current ?? 0) + bonus;
        }
      }
      if (passive.acBonus || passive.atkBonus || passive.maxHpBonus) {
        this.recalcDerivedStats?.();
        this.updateStats?.();
      }
    },

    addAbilityToPlayer(ability) {
      if (!ability?.id || !this.state.classData.abilities) return;
      if (this.state.classData.abilities.some(a => a.id === ability.id)) return;
      const idx = this.state.classData.abilities.length;
      const def = this.resolveAbilityDefinition(ability.id) || ability;
      this.state.classData.abilities.push(
        this.reconcileAbility(ability, def, this.state.className, idx)
      );
      if (ability.type === 'passive' || ability.passive) {
        this.applyPassiveAbility(ability);
      } else {
        this.recalcDerivedStats?.();
      }
      this.renderAbilities();
    },

    /** PF2e: навыки, которые можно повысить на чётном уровне */
    getPf2eSkillIncreaseOptions() {
      const sys = this.activeSystem;
      if (!sys?.getNextRank) return [];
      const skills = this.state.skills || {};
      return Object.entries(skills)
        .filter(([, rank]) => rank && rank !== 'untrained' && rank !== 'legendary')
        .map(([id, rank]) => ({
          id,
          rank,
          nextRank: sys.getNextRank(rank),
          label: this.CharacterCreator?.skillLabel?.(id) || sys.getSkillDefs?.()?.[id]?.ru || id
        }))
        .filter(o => o.nextRank);
    },

    pf2eLevelGrantsSkillIncrease(level) {
      return this.isPf2eMode() && level >= 2 && level % 2 === 0;
    },

    showPf2eSkillIncreaseModal(pending) {
      const modal = document.getElementById('levelup-modal');
      const title = document.getElementById('levelup-title');
      const text = document.getElementById('levelup-text');
      const choicesEl = document.getElementById('levelup-choices');
      if (!modal || !choicesEl) {
        this.continuePendingLevelUpAfterSkillIncrease(pending);
        return;
      }

      const options = this.getPf2eSkillIncreaseOptions();
      if (!options.length) {
        pending.skillIncreaseDone = true;
        this.continuePendingLevelUpAfterSkillIncrease(pending);
        return;
      }

      if (title) title.textContent = `Уровень ${pending.level}! — увеличение навыка`;
      const hpNote = pending.hpGain > 0 ? ` (+${pending.hpGain} макс. ОЗ).` : '';
      if (text) {
        text.textContent = `Выберите один навык для повышения ранга (Skill Increase).${hpNote}`;
      }

      let html = options.map(opt => {
        const from = this.getPf2eSkillRankShort(opt.rank);
        const to = this.getPf2eSkillRankShort(opt.nextRank);
        return `<button type="button" class="choice levelup-skill-btn ${this.getPf2eSkillRankCss(opt.rank)}"
          ${this.onclickGame('pickPf2eSkillIncrease', opt.id)}>${this.escapeHtml(opt.label)} (${from} → ${to})</button>`;
      }).join('');

      if (pending.level % 4 === 0) {
        html += `<p class="levelup-asi-hint">Уровень ${pending.level}: черта навыка (Skill Feat) — в разработке.</p>`;
      }

      choicesEl.innerHTML = html;
      modal.classList.remove('hidden');
    },

    pickPf2eSkillIncrease(skillId) {
      const pending = this.state.pendingLevelUp;
      if (!pending || !skillId) return;
      const sys = this.activeSystem;
      const key = sys?.normalizeSkillId?.(skillId) || String(skillId).toLowerCase();
      const cur = this.state.skills?.[key];
      const next = sys?.getNextRank?.(cur);
      if (!cur || !next) return;

      this.state.skills[key] = next;
      if (!this.state.skillIncreases) this.state.skillIncreases = [];
      this.state.skillIncreases.push({ level: pending.level, skill: key, newRank: next });

      if (this.state.classData) {
        if (!this.state.classData.skillProficiency) this.state.classData.skillProficiency = {};
        this.state.classData.skillProficiency[key] = next;
      }

      const label = this.CharacterCreator?.skillLabel?.(key) || key;
      this.log(`📈 Навык «${label}»: ${this.getPf2eSkillRankShort(cur)} → ${this.getPf2eSkillRankShort(next)}`, 'log-heal');
      pending.skillIncreaseDone = true;
      this.renderProficienciesPanel();
      this.continuePendingLevelUpAfterSkillIncrease(pending);
    },

    continuePendingLevelUpAfterSkillIncrease(pending) {
      const validChoices = this.getPendingLevelChoiceIds(pending);
      if (pending.needsAsi && !pending.asiDone) {
        this.showLevelUpAsiModal(pending);
        return;
      }
      if (validChoices.length) {
        this.showLevelUpAbilityModal(pending.level, validChoices, pending.hpGain, false);
        return;
      }
      this.finishPendingLevelUp();
    },

    showLevelUpModal(level, choiceIds, hpGain, levelConfig) {
      const validChoices = (choiceIds || []).filter(id => this.resolveAbilityDefinition(id));
      const needsAsi = this.levelConfigNeedsAsi(levelConfig);
      const needsSkillInc = this.pf2eLevelGrantsSkillIncrease(level);

      if (!needsAsi && !validChoices.length && !needsSkillInc) {
        this.log('⚠️ Нет выбора на уровне ' + level, 'log-damage');
        this.renderLevelBar();
        this.resumeAfterLevelUp();
        return;
      }

      this.state.pendingLevelUp = {
        level,
        choiceIds: validChoices,
        hpGain: hpGain || 0,
        needsAsi,
        asiDone: !needsAsi,
        needsSkillIncrease: needsSkillInc,
        skillIncreaseDone: !needsSkillInc
      };

      if (needsSkillInc && !this.state.pendingLevelUp.skillIncreaseDone) {
        this.showPf2eSkillIncreaseModal(this.state.pendingLevelUp);
        const extra = needsAsi ? ' Затем — характеристики.' : (validChoices.length ? ' Затем — умение.' : '');
        this.log(`🎉 Уровень ${level}! Увеличение навыка.${extra}`, 'log-heal');
        this.renderLevelBar();
        return;
      }

      if (needsAsi) {
        this.showLevelUpAsiModal(this.state.pendingLevelUp);
        return;
      }
      this.showLevelUpAbilityModal(level, validChoices, hpGain, false);
    },

    closeLevelUpModal() {
      const modal = document.getElementById('levelup-modal');
      if (modal) modal.classList.add('hidden');
    },

    pickLevelUpAbility(abilityId) {
      const pending = this.state.pendingLevelUp;
      if (!pending) return;

      const ability = this.resolveAbilityDefinition(abilityId);
      if (!ability) {
        alert('Умение не найдено в данных progression.abilities');
        return;
      }

      this.addAbilityToPlayer(ability);
      this.log(`🎉 Новое умение: ${ability.name}`, 'log-heal');
      if (abilityId === 'ranger_favored_enemy') {
        const max = this.getMaxFavoredEnemyTypes();
        const cur = (this.state.favoredEnemyTypes || []).length;
        if (cur < max) {
          this.showFavoredEnemyPickModal({
            pickCount: max - cur,
            title: `Уровень ${pending.level}! — избранные враги`,
            intro: 'Улучшение умения: выберите ещё один тип существ (+2 урона по обоим типам).',
            onDone: () => this.finishPendingLevelUp()
          });
          return;
        }
      }
      this.finishPendingLevelUp();
    },

    checkLevelUp() {
      if (!this.isProgressionEnabled() || this.state.pendingLevelUp) return;

      while (this.state.level < this.getMaxLevel() && this.state.exp >= this.getExpThreshold(this.state.level + 1)) {
        const newLevel = this.state.level + 1;
        this.state.level = newLevel;

        const hpGain = this.applyLevelHpGain(newLevel);
        const levelConfig = this.getClassLevelConfig(newLevel);
        this.applyLevelStatBonuses(levelConfig);
        this.applyLevelResources(newLevel);

        const choices = levelConfig?.choices || [];
        const needsAsi = this.levelConfigNeedsAsi(levelConfig);
        const hasPick = needsAsi || choices.length;

        if (hasPick) {
          this.showLevelUpModal(newLevel, choices, hpGain, levelConfig);
          const extra = needsAsi ? ' Выберите улучшение характеристик' : ' Выберите умение.';
          this.log(`🎉 Уровень ${newLevel}! +${hpGain} ОЗ.${extra}`, 'log-heal');
          this.renderLevelBar();
          return;
        }

        this.log(`🎉 Уровень ${newLevel}! +${hpGain} ОЗ`, 'log-heal');
      }

      this.renderLevelBar();
      this.resumeAfterLevelUp();
    },

    // Внутри объекта GameEngine
    applyEffect(effect, target = null) {
      // Legacy string effects → object (миграции ProjectDataSchema; ветка оставлена как страховка)
      if (typeof effect === 'string') {
        if (typeof ProjectDataSchema !== 'undefined' && ProjectDataSchema.normalizeAbilityEffect) {
          effect = ProjectDataSchema.normalizeAbilityEffect(effect);
        } else {
          const s = effect.trim();
          if (s.startsWith('heal:')) effect = { type: 'heal', value: s.slice(5), targeting: { scope: 'self' } };
          else if (s.startsWith('damage:')) effect = { type: 'damage', value: s.slice(7), damageType: 'physical' };
          else if (s.startsWith('smite:')) effect = { type: 'smite', value: s.slice(6) };
          else if (s === 'magic_missile') effect = { type: 'magic_missile' };
          else if (s === 'extra_attack') effect = { type: 'extra_attack' };
          else effect = { type: 'custom', desc: s };
        }
      }
      // --- НОВЫЙ ФОРМАТ (объект) ---
      if (effect && typeof effect === 'object' && effect.type) {
        if (effect.type === 'apply_status') {
          this.applyAbilityAddEffect(effect, target);
          return true;
        }

        switch(effect.type) {
          case 'damage': {
            let dmg = this.parseRoll(effect.value);
            if (this._abilitySoundCtx?.id === 'eldritch_blast' && (this.state.level || 1) >= 5) {
              dmg += this.parseRoll('1d10');
            }
            if (typeof this.applyClimateSpellMods === 'function') {
              dmg = this.applyClimateSpellMods(dmg, effect.damageType);
            }
            const upLv = this.getUpcastLevelsAboveBase(this._abilitySoundCtx);
            if (upLv > 0) {
              const per = effect.upcastDamage || '1d6';
              for (let u = 0; u < upLv; u++) dmg += this.parseRoll(per);
            }
            let targets = [];
            const scope = effect.targeting?.scope;
            if (effect.allTargets || scope === 'all_enemies' || scope === 'area') {
              targets = this.state.enemies.filter(e => e.hp > 0);
              const abCtx = this._abilitySoundCtx;
              if (
                abCtx &&
                typeof CombatPosition !== 'undefined' &&
                CombatPosition.isEnabled(this) &&
                CombatPosition.rangeTypeRequiresSameZone(
                  CombatPosition.getAbilityRangeType(abCtx)
                )
              ) {
                const pz = CombatPosition.getPlayerPosition(this);
                targets = (this.state.enemies || []).filter(
                  (e, i) => e.hp > 0 && CombatPosition.getEnemyPosition(this, i) === pz
                );
              }
            } else if (scope === 'single') {
              if (target && target.hp > 0) {
                targets = [target];
              } else {
                const e = this.state.enemies.find(en => en.hp > 0);
                if (e) targets = [e];
              }
            } else if (target && target.hp > 0) {
              targets = [target];
            } else {
              const e = this.state.enemies.find(en => en.hp > 0);
              if (e) targets = [e];
            }
            for (let t of targets) {
              let finalDmg = dmg;
              if (effect.savingThrow) {
                const bonus = this.getSkillBonus(effect.savingThrow.skill);
                const roll = this.d20() + bonus;
                if (roll >= effect.savingThrow.dc) {
                  if (effect.savingThrow.halfOnSave) finalDmg = Math.floor(dmg/2);
                  else finalDmg = 0;
                  this.log(`🧙 Спасбросок ${effect.savingThrow.skill}: ${roll} vs ${effect.savingThrow.dc} -> ${finalDmg>0?'половина':'нет'} урона`, 'log-dice');
                } else this.log(`🧙 Спасбросок провален: ${roll} vs ${effect.savingThrow.dc}`, 'log-dice');
              }
              if (finalDmg > 0) {
                const favHit = this.addFavoredEnemyDamageToHit(t, finalDmg);
                finalDmg = favHit.total;
                t.hp -= finalDmg;
                const favNote = this.favoredEnemyDamageNote(favHit.bonus);
                this.log(`💥 ${t.name} получает ${finalDmg} ${effect.damageType||''} урона${favNote}`, 'log-damage');
                this.playAbilityHit(this._abilitySoundCtx, effect);
                if (effect.addEffect) {
                  const h = this.getEnemyEffectHolder(t);
                  if (h) this.applyStatusEffect(h, effect.addEffect, this._abilitySoundCtx?.name);
                }
              }
            }
            if (effect.addEffect && !targets.length) {
              this.applyAbilityAddEffect(effect, target);
            }
            this.renderCombat();
            break;
          }
          case 'heal': {
            const amt = this.parseRoll(effect.value);
            this.heal(amt);
            this.log(`✨ Восстановлено ${amt} ОЗ`, 'log-heal');
            this.playCombatSound(this.resolveSoundId(effect.soundHit, this._abilitySoundCtx?.soundHit, 'heal'));
            break;
          }
          case 'rage': {
            if (this.state.combat) {
              this.state.combat.rageActive = true;
              this.state.combat.tempDmgBonus = (this.state.combat.tempDmgBonus || 0) + 2;
            }
            this.log('😤 Ярость! +2 к урону оружием до конца боя.', 'log-combat');
            this.playCombatSound('buff');
            break;
          }
          case 'wild_shape': {
            const beastId = this._pendingWildShapeBeastId;
            this._pendingWildShapeBeastId = null;
            if (beastId && typeof this.enterWildShape === 'function') {
              this.enterWildShape(beastId);
            } else if (this.isInWildShape?.()) {
              this.log('Вы уже в облике зверя.', 'log-dice');
            } else {
              this.log('❌ Выберите форму зверя.', 'log-damage');
            }
            break;
          }
          case 'transformation': {
            const ability = this._abilitySoundCtx || this._pendingTransformAbility;
            const formId = this._pendingTransformFormId;
            const mods = this._pendingTransformModifiers ?? ability?.effect?.modifiers;
            this._pendingTransformFormId = null;
            this._pendingTransformModifiers = null;
            this._pendingTransformAbility = null;

            const mode = effect.mode || effect.target || 'self';
            if (mode === 'target' || mode === 'enemy') {
              const enemyIdx = this.state.combat?.selectedEnemyIndex;
              if (enemyIdx != null && formId) {
                this.transformEnemy?.(enemyIdx, formId, ability);
                break;
              }
            }

            if (typeof this.enterTransformation === 'function') {
              this.enterTransformation(formId, { ability, modifiers: mods });
            } else {
              this.log('❌ Система превращений не загружена.', 'log-damage');
            }
            break;
          }
          case 'buff': {
            this.playCombatSound(this.resolveSoundId(effect.soundCast, this._abilitySoundCtx?.soundCast, 'buff'));
            const bonus = parseInt(effect.value, 10) || 0;
            if (effect.buffType === 'ac') {
              if (this.state.combat) this.applyAcBonus(bonus);
              else this.log(`🛡️ +${bonus} КД (только в бою)`, 'log-dice');
            } else if (effect.buffType === 'atk') {
              if (this.state.combat) this.state.combat.tempAtkBonus = bonus;
              this.log(`⚔️ Временно +${bonus} к атаке`, 'log-dice');
            } else if (effect.buffType === 'dmg') {
              if (this.state.combat) this.state.combat.tempDmgBonus = (this.state.combat.tempDmgBonus || 0) + bonus;
              this.log(`⚔️ Временно +${bonus} к урону`, 'log-dice');
            }
            break;
          }
          case 'extra_attack': {
            if (this.state.combat) this.state.combat.actionSurge = true;
            this.log('⚡ Дополнительная атака в этом ходу!', 'log-combat');
            return false; // не завершает ход
          }
          case 'magic_missile': {
            const upLv = this.getUpcastLevelsAboveBase(this._abilitySoundCtx);
            const dartCount = 3 + upLv;
            let total = 0;
            for (let i = 0; i < dartCount; i++) total += this.d(4) + 1;
            const enemy = (target && target.hp > 0)
              ? target
              : this.state.enemies.find(e => e.hp > 0);
            if (enemy) {
              enemy.hp -= total;
              const castLv = this.getCastSlotLevel(this._abilitySoundCtx);
              const lvTag = castLv > 1 ? ` (круг ${castLv}, ${dartCount} снаряда)` : '';
              this.log(`✨ Магический снаряд${lvTag}: ${total} урона по ${enemy.name}!`, 'log-damage');
              this.playAbilityHit(this._abilitySoundCtx, effect);
            }
            break;
          }
          case 'smite': {
            if (this.state.combat) {
              const abCtx = this._abilitySoundCtx;
              if (abCtx && this.getAbilityActionType(abCtx) === 'reaction') {
                this.log('⚡ Кара применяется после попадания оружием.', 'log-combat');
                return false;
              }
              this.state.combat.divineSmite = true;
              this.state.combat.smiteRoll = effect.value;
              this.log('⚡ Кара — нанесите удар!', 'log-combat');
            }
            return false;
          }
          case 'detect_magic':
          case 'divine_sense':
          case 'custom': {
            this.log(effect.message || effect.desc || 'Умение активировано.', 'log-dice');
            return !this.state.combat;
          }
          default: {
            this.log(`Эффект ${effect.type} пока не реализован`, 'log-dice');
          }
        }
        return true;
      }

      // Legacy string effects нормализуются в начале applyEffect — отдельная ветка не нужна.

      // Если пассивка
      if (effect && effect.passive) {
        this.applyPassiveAbility(effect);
        return true;
      }
      this.log('Умение использовано (без эффекта).', 'log-dice');
      return true;
    },
    // ========== ЛОГ ==========
    log(msg, cls = '') {
      if (
        this.state?.combat &&
        typeof CombatLog !== 'undefined' &&
        CombatLog.isCombatLogClass(cls)
      ) {
        CombatLog.addFromLegacy(msg, cls, this);
        return;
      }
      const el = document.getElementById('log');
      if (!el) return;
      const div = document.createElement('div');
      div.className = 'log-entry ' + cls;
      div.textContent = msg;
      el.prepend(div);
    },

    /** Прямая запись в журнал боя (CombatLog.add) */
    combatLog(type, data = {}) {
      if (typeof CombatLog === 'undefined') {
        const text = data.message ?? data.text ?? '';
        this.log(text, data.cls || 'log-combat');
        return null;
      }
      return CombatLog.add(type, { ...data, engine: this });
    },

    finishCombatLogUI() {
      if (typeof CombatLog === 'undefined') return;
      const log = CombatLog.getInstance();
      if (!log) return;
      log.finishCombatSession();
    },

    /** Развернуть блок последнего боя в нижнем журнале */
    showCombatLogReview() {
      if (typeof CombatLog === 'undefined') return;
      const log = CombatLog.getInstance();
      if (!log?.hasEntries()) return;
      log.ensureDom();
      log.ensurePlacement();
      if (!log.reviewMode) log.enterArchiveMode();
      log.host?.classList.remove('hidden');
      log.expandAllRounds();
      log.scrollJournalIntoView();
    },

    syncCombatLogRound() {
      if (!this.state?.combat || typeof CombatLog === 'undefined') return;
      const log = CombatLog.attach(this);
      log.setRound(this.state.combat.round || 1, { announce: true });
    },
    // ========== ОТОБРАЖЕНИЕ ==========
    setText(txt) {
      const el = document.getElementById('story-text');
      if (el) el.textContent = this.processSceneTemplate(txt);
    },


    getChoiceUsedFlag(choice, index) {
      if (choice.doneFlag) return choice.doneFlag;
      if (choice.skillCheck) {
        if (choice.skillCheck.doneFlag) return choice.skillCheck.doneFlag;
        if (choice.skillCheck.once === false) return null;
        return `sc_${this.state.scene}_${index}`;
      }
      if (choice.once) return `ch_${this.state.scene}_${index}`;
      return null;
    },

    isChoiceUsed(choice, index) {
      const flag = this.getChoiceUsedFlag(choice, index);
      return !!(flag && this.state.flags[flag]);
    },

    markChoiceUsed(choice, index) {
      const flag = this.getChoiceUsedFlag(choice, index);
      if (!flag || this.state.flags[flag]) return;
      this.state.flags[flag] = true;
      this.saveGame();
    },

    /** Только смена стадии квеста без перехода на другую сцену */
    applyChoiceQuestSet(choiceIndex) {
      const choice = this.state.currentChoices?.[choiceIndex];
      if (!choice?.questSet) return;
      const origIdx = this.state.currentChoiceIndices?.[choiceIndex] ?? choiceIndex;
      if (this.isChoiceUsed(choice, origIdx)) return;
      if (choice.once) this.markChoiceUsed(choice, origIdx);
      this.applyChoiceReputation(choice);
      let stage = choice.questSet.stage;
      if (choice.questSet.questId === 'lost_bag' && (this.state.inventory || []).includes('jack_bag')) {
        stage = '2';
      }
      this.updateQuest(choice.questSet.questId, stage);
      if (choice.questSet.questId === 'lost_bag') this.syncLostBagQuestProgress({ silentLog: true });
    },

    /** Подпись кнопки выбора: icon отдельно от text, без дубля emoji в начале текста */
    formatChoiceButtonLabel(choice, disabled) {
      const rawText = (choice?.text || '').trim();
      const icon = (choice?.icon || '').trim();
      const suffix = disabled ? ' ✓' : '';
      if (!icon) return `${this.escapeHtml(rawText)}${suffix}`;
      if (rawText.startsWith(icon)) {
        return `${this.escapeHtml(rawText)}${suffix}`;
      }
      return `${this.renderIcon(icon)} ${this.escapeHtml(rawText)}${suffix}`;
    },

    pickChoice(choiceIndex) {
      const choices = this.state.currentChoices || [];
      const choice = choices[choiceIndex];
      if (!choice) return;
      if (choice.action === 'scene_element_resume' && typeof SceneElementRunner !== 'undefined') {
        SceneElementRunner.resume(this);
        return;
      }
      const origIdx = this.state.currentChoiceIndices?.[choiceIndex] ?? choiceIndex;
      if (this.isChoiceUsed(choice, origIdx)) return;
      if (choice.once) this.markChoiceUsed(choice, origIdx);
      if (choice.questSet?.questId != null && choice.questSet.stage != null) {
        let stage = choice.questSet.stage;
        if (choice.questSet.questId === 'lost_bag' && (this.state.inventory || []).includes('jack_bag')) {
          stage = '2';
        }
        this.updateQuest(choice.questSet.questId, stage);
        if (choice.questSet.questId === 'lost_bag') this.syncLostBagQuestProgress({ silentLog: true });
      }
      if (typeof QuestEvents !== 'undefined') {
        const npcId = choice.npc || choice.npcId;
        if (npcId) {
          QuestEvents.emit('NPCTalked', { npcId, npc: npcId, sceneId: this.state.scene });
          QuestEvents.emit('NPCDialogueFinished', { npcId, npc: npcId, sceneId: this.state.scene });
        }
        if (choice.deliverItem) {
          QuestEvents.emit('ItemDelivered', {
            itemId: choice.deliverItem,
            item: choice.deliverItem,
            npcId: choice.npc || choice.npcId,
            qty: Number(choice.deliverQty) || 1
          });
        }
        if (choice.once || choice.choiceFlag) {
          QuestEvents.emit('ChoiceSelected', {
            flag: choice.choiceFlag || this.getChoiceUsedFlag?.(choice, origIdx),
            sceneId: this.state.scene,
            text: choice.text
          });
        }
      }
      if (choice.flags) this.applyFlags(choice.flags);
      const goldCost = Number(choice.goldCost) || 0;
      if (goldCost > 0) {
        if (this.state.gold < goldCost) {
          this.log(`❌ Нужно ${goldCost} зм.`, 'log-damage');
          return;
        }
        this.state.gold -= goldCost;
        this.updateStats();
      }
      if (Array.isArray(choice.grantItems)) {
        choice.grantItems.forEach((itemId) => this.addItem(itemId));
      }
      this.applyChoiceReputation(choice);
      if (choice.flags?.jackQuest) {
        this.syncLostBagQuestProgress({ silentLog: false });
      }
      if (choice.action === 'reopen_jack_shop') {
        this.reopenJackShop();
        return;
      }
      if (choice.action === 'refill_water_flask') {
        this.refillWaterFlask();
        return;
      }
      if (choice.action === 'rest_short' || choice.action === 'rest:short') {
        this.rest('short');
        return;
      }
      if (choice.action === 'rest_long' || choice.action === 'rest:long') {
        this.rest('long');
        return;
      }
      if (choice.action === 'template_start_combat') {
        const scene = this.resolveSceneDefinition?.(this.state.scene) || this.data?.scenes?.[this.state.scene];
        const tc = scene?.templateCombat;
        if (tc?.enemies?.length) {
          const enemies = tc.enemies.map((eid) => {
            const e = this.data.enemies[eid];
            return {
              ...e,
              id: eid,
              maxHp: e.hp,
              creatureType: e.creatureType || this.getDefaultCreatureType()
            };
          });
          this.startCombat(enemies, tc.winScene, tc.enemies);
        } else {
          this.log('❌ В шаблоне боя не указаны враги.', 'log-damage');
        }
        return;
      }
      if (choice.action === 'tavern_rent_room') {
        const scene = this.resolveSceneDefinition?.(this.state.scene) || this.data?.scenes?.[this.state.scene];
        const price = scene?.tavernConfig?.roomPrice ?? 5;
        if (this.state.gold < price) {
          this.log(`❌ Нужно ${price} зм за комнату.`, 'log-damage');
          return;
        }
        if (typeof this.changeGold === 'function') this.changeGold(-price, { reason: 'buy', silent: true }); else this.state.gold -= price;
        this.updateStats();
        this.rest('long');
        this.log(`🛏️ Комната снята (−${price} зм). Долгий отдых.`, 'log-heal');
        return;
      }
      if (choice.action === 'temple_heal') {
        const scene = this.resolveSceneDefinition?.(this.state.scene) || this.data?.scenes?.[this.state.scene];
        const price = scene?.templeConfig?.healPrice ?? 25;
        if (this.state.gold < price) {
          this.log(`❌ Нужно ${price} зм.`, 'log-damage');
          return;
        }
        if (typeof this.changeGold === 'function') this.changeGold(-price, { reason: 'buy', silent: true }); else this.state.gold -= price;
        this.state.hp = this.state.maxHp;
        this.updateStats();
        this.log(`✨ Лечение (−${price} зм). ОЗ восстановлены.`, 'log-heal');
        return;
      }
      if (choice.action === 'temple_bless') {
        if (!this.state.flags) this.state.flags = {};
        this.state.flags.templeBlessed = true;
        this.log('🙏 Благословение оберегает вас в следующем бою.', 'log-combat');
        return;
      }
      if (choice.action === 'start_pending_faction_combat') {
        const pending = this.state.pendingFactionCombat;
        this.state.pendingFactionCombat = null;
        if (pending?.enemies?.length) {
          this.startCombat(pending.enemies, pending.nextScene, pending.enemyIds);
        }
        return;
      }
      const chainMatch = /^chain:(.+)$/.exec(choice.action || '');
      if (chainMatch) {
        this.executeChain(chainMatch[1]);
        return;
      }
      if (choice.to) this.showScene(choice.to);
    },

    setChoices(choices) {
      const area = document.getElementById('choices-area');
      if (!area) return;

      const allChoices = Array.isArray(choices) ? choices : [];
      const ctx = this.getConditionContext();
      const visible = [];
      const visibleIndices = [];
      allChoices.forEach((c, i) => {
        if (ConditionSystem.isChoiceVisible(c, ctx)) {
          visible.push(c);
          visibleIndices.push(i);
        }
      });
      this.state.currentChoices = visible;
      this.state.currentChoiceIndices = visibleIndices;

      area.innerHTML = visible.map((c, vi) => {
        const i = visibleIndices[vi];
        const disabled = this.isChoiceUsed(c, i);
        const cls = 'choice' + (disabled ? ' done' : '');
        const label = this.formatChoiceButtonLabel(c, disabled);

        if (c.skillCheck) {
          const sc = c.skillCheck;
          const usedFlag = this.getChoiceUsedFlag(c, i);
          const checkData = encodeURIComponent(JSON.stringify({
            to: c.to,
            skill: sc.skill,
            dc: sc.dc,
            sText: sc.successText || '',
            fText: sc.failText || '',
            sFlags: sc.successFlags || null,
            fFlags: sc.failFlags || null,
            sItems: sc.successItems || null,
            sNext: sc.successNext || c.to,
            fNext: sc.failNext || c.to,
            sQuestSet: sc.successQuestSet || null,
            usedFlag,
            choiceIndex: vi,
            sceneId: this.state.scene,
            exp: sc.exp,
            expOnce: sc.expOnce,
            expKey: sc.expKey
          }));

          let profMark = '';
          let rankCls = '';
          if (this.isPf2eMode()) {
            const rank = this.getPf2eSkillRank(sc.skill);
            if (rank && rank !== 'untrained') {
              const short = this.getPf2eSkillRankShort(rank);
              profMark = `<span class="choice-skill-prof ${this.getPf2eSkillRankCss(rank)}" title="Ранг: ${rank}">${short}</span> `;
              rankCls = ` choice--${rank}`;
            }
          } else if (this.isSkillProficient(sc.skill)) {
            profMark = '<span class="choice-skill-prof choice--trained" title="Владение">✓</span> ';
            rankCls = ' choice--proficient';
          }
          return `<button type="button" class="${cls}${rankCls}" ${disabled ? 'disabled' : ''} 
                    ${this.onclickGame('handleSkillCheckSafe', checkData)}>${profMark}${label}</button>`;
        }

        if (c.questSet?.questId != null && c.questSet.stage != null && !c.to && !c.skillCheck && !c.action) {
          return `<button type="button" class="${cls}" ${disabled ? 'disabled' : ''} 
                  onclick="GameEngine.applyChoiceQuestSet(${vi})">${label}</button>`;
        }

        if (c.action) {
          const classMatch = /^select_class:(.+)$/.exec(c.action);
          if (classMatch && this.data?.classes?.[classMatch[1]]) {
            return `<button type="button" class="${cls}" ${this.onclickGame('selectClass', classMatch[1])}>${label}</button>`;
          }
          if (c.action === 'start_game') return `<button type="button" class="${cls}" onclick="GameEngine.startGame()">${label}</button>`;
          if (c.action === 'reset_game') return `<button type="button" class="${cls}" onclick="GameEngine.resetGame()">${label}</button>`;
          if (c.action === 'jack_turn_in') {
            return `<button type="button" class="${cls}" ${disabled ? 'disabled' : ''} onclick="GameEngine.handleJackTurnIn()">${label}</button>`;
          }
          if (c.action === 'reopen_jack_shop') {
            return `<button type="button" class="${cls}" onclick="GameEngine.reopenJackShop()">${label}</button>`;
          }
          if (c.action === 'refill_water_flask') {
            return `<button type="button" class="${cls}" ${this.onclickGame('refillWaterFlask')}>${label}</button>`;
          }
          const travelMatch = /^travel:(.+)$/.exec(c.action);
          if (travelMatch) {
            return `<button type="button" class="${cls}" ${this.onclickGame('travelTo', travelMatch[1])}>${label}</button>`;
          }
          const passthroughMatch = /^special_passthrough:(.+)$/.exec(c.action);
          if (passthroughMatch) {
            return `<button type="button" class="${cls}" ${this.onclickGame('runSpecialScenePassthrough', passthroughMatch[1])}>${label}</button>`;
          }
          const chainMatch = /^chain:(.+)$/.exec(c.action || '');
          if (chainMatch) {
            return `<button type="button" class="${cls}" ${disabled ? 'disabled' : ''} onclick="GameEngine.runActionChain('${this.escapeAttr(chainMatch[1])}')">${label}</button>`;
          }
        }

        return `<button type="button" class="${cls}" ${disabled ? 'disabled' : ''} 
                onclick="GameEngine.pickChoice(${vi})">${label}</button>`;
      }).join('');

      /* На мобильном: две короткие кнопки в ряд */
      if (document.body.classList.contains('mobile') && !this.state.combat) {
        const allShort = visible.length >= 2 && visible.every((c) => {
          const raw = String(c.text || '').replace(/<[^>]+>/g, '').trim();
          return raw.length > 0 && raw.length <= 20;
        });
        area.classList.toggle('choices-grid--short-row', allShort);
      } else {
        area.classList.remove('choices-grid--short-row');
      }
    },

    handleSkillCheckSafe(encodedData) {
      const data = JSON.parse(decodeURIComponent(encodedData));
      const vi = data.choiceIndex;
      const origIdx = this.state.currentChoiceIndices?.[vi] ?? vi;
      const choice = this.state.currentChoices?.[vi]
        || this.data.scenes[data.sceneId || this.state.scene]?.choices?.[origIdx];

      if (data.usedFlag && this.state.flags[data.usedFlag]) return;

      if (choice) this.markChoiceUsed(choice, origIdx);
      else if (data.usedFlag) this.state.flags[data.usedFlag] = true;

      this.handleSkillCheck(
        { to: data.to },
        data.skill,
        data.dc,
        data.sText,
        data.fText,
        data.sFlags,
        data.sItems,
        data.sNext,
        data.fNext,
        data.fFlags,
        {
          exp: data.exp,
          expOnce: data.expOnce,
          expKey: data.expKey,
          successQuestSet: data.sQuestSet
        }
      );
    },
    handleSkillCheck(choice, skill, dc, successText, failText, successFlags, successItems, successNext, failNext, failFlags, skillCheckMeta) {
      const bonus = this.getSkillBonus(skill);
      const roll = this.d20() + bonus;
      const resolveNext = (next, fallback) => {
        if (typeof next === 'string' && next.trim()) return next;
        return typeof fallback === 'string' ? fallback : '';
      };

      if (roll >= dc) {
        this.log(`✅ Успех! ${skill}: ${roll} vs ${dc}`, 'log-combat');

        // Успех: показываем текст успеха
        this.setText(successText || 'Проверка пройдена!');
        this.clearDialogue();

        this.applyFlags(successFlags);

        if (successItems) {
          successItems.forEach(item => this.addItem(item));
        }

        const sQuest = skillCheckMeta?.successQuestSet;
        if (sQuest?.questId != null && sQuest.stage != null) {
          this.updateQuest(sQuest.questId, sQuest.stage);
        }

        this.awardSkillCheckExp(skill, skillCheckMeta || {});

        const next = resolveNext(successNext, choice.to);
        this.setChoices([
          { text: 'Продолжить', to: next }
        ]);

      } else {
        this.log(`❌ Провал. ${skill}: ${roll} vs ${dc}`, 'log-dice');

        // Провал: показываем текст провала
        this.setText(failText || 'Проверка провалена.');
        this.clearDialogue();

        this.applyFlags(failFlags);

        const fQuest = skillCheckMeta?.failQuestSet;
        if (fQuest?.questId != null) {
          this.failQuest(fQuest.questId, fQuest.stage || 'failed');
        } else if (this.shouldFailAlbertLocketSearch()) {
          this.failQuest('albert_locket', 'failed');
          this.showScene('albert_locket_failed');
          return;
        }

        // Переход или остаёмся
        const next = resolveNext(failNext, choice.to);
        this.setChoices([
          { text: 'Продолжить', to: next }
        ]);
      }
    },

    /** @deprecated Используйте renderActiveQuests */
    renderQuestLog() {
      this.renderActiveQuests();
    },

    // ========== Мобильная панель персонажа (свёртка) ==========
    MOBILE_SIDEBAR_STORAGE_KEY: 'rpg_mobile_sidebar_compact',

    initMobileSidebar() {
      const toggles = document.querySelectorAll('.mobile-sidebar-toggle');
      if (!toggles.length || document.getElementById('sidebar')?.dataset.mobileSidebarInit) return;
      document.getElementById('sidebar').dataset.mobileSidebarInit = '1';

      toggles.forEach((btn) => {
        btn.addEventListener('click', () => {
          const compact = document.body.classList.contains('mobile-sidebar-expanded');
          this.setMobileSidebarCompact(compact);
        });
      });

      const saved = sessionStorage.getItem(this.MOBILE_SIDEBAR_STORAGE_KEY);
      const compactDefault = saved === null ? true : saved === '1';
      if (document.body.classList.contains('mobile')) {
        this.setMobileSidebarCompact(compactDefault);
      }

      if (!this._mobileSidebarResizeBound) {
        this._mobileSidebarResizeBound = true;
        window.addEventListener('rpg-mobile-change', (e) => {
          if (e.detail?.mobile) {
            const compact = sessionStorage.getItem(this.MOBILE_SIDEBAR_STORAGE_KEY);
            this.setMobileSidebarCompact(compact !== '0');
          } else {
            document.body.classList.remove('mobile-compact', 'mobile-sidebar-expanded');
            document.getElementById('sidebar')?.classList.remove('mobile-compact');
          }
        });
      }
      this.syncMobileCompactBar();
    },

    /** Свёрнутая панель персонажа на мобильном */
    setMobileSidebarCompact(compact) {
      if (!document.body.classList.contains('mobile')) return;
      document.body.classList.toggle('mobile-compact', compact);
      document.body.classList.toggle('mobile-sidebar-expanded', !compact);
      const sidebar = document.getElementById('sidebar');
      sidebar?.classList.toggle('mobile-compact', compact);

      document.querySelectorAll('.mobile-sidebar-toggle').forEach((btn) => {
        const inPanel = btn.classList.contains('mobile-sidebar-toggle--in-panel');
        btn.textContent = inPanel ? '▲' : '▼';
        btn.setAttribute('aria-expanded', compact ? 'false' : 'true');
        btn.setAttribute(
          'aria-label',
          compact ? 'Развернуть панель персонажа' : 'Свернуть панель персонажа'
        );
      });
      sessionStorage.setItem(this.MOBILE_SIDEBAR_STORAGE_KEY, compact ? '1' : '0');
    },

    syncMobileCompactBar() {
      if (!document.body.classList.contains('mobile')) return;
      const nameEl = document.getElementById('mobile-compact-name');
      const acEl = document.getElementById('mobile-compact-ac-val');
      const fill = document.getElementById('mobile-compact-hp-fill');
      if (nameEl) {
        nameEl.textContent = this.state.charName
          || document.getElementById('char-name-input')?.value
          || 'Герой';
      }
      if (acEl) {
        acEl.textContent = document.getElementById('ac-val')?.textContent || '—';
      }
      if (fill && this.state.maxHp > 0) {
        const pct = Math.max(0, (this.state.hp / this.state.maxHp) * 100);
        fill.style.width = pct + '%';
      }
    },

    /** Классы in-combat для мобильной вёрстки боя */
    updateCombatLayoutClasses() {
      const combatArea = document.getElementById('combat-area');
      const inCombat = !!(this.state.combat && combatArea && !combatArea.classList.contains('hidden'));
      document.getElementById('game-content')?.classList.toggle('in-combat', inCombat);
      document.getElementById('game-card')?.classList.toggle('in-combat', inCombat);
      if (inCombat && document.body.classList.contains('mobile')) {
        this.setMobileSidebarCompact(true);
      }
    },

  });
})();
