// Расширения ACTION_REGISTRY: validate + effects (слой 3), без ломки legacy execute
(function augmentActionRegistryV3() {
  if (typeof ACTION_REGISTRY === 'undefined') return;

  const heal = ACTION_REGISTRY.heal;
  if (heal && !heal.validate) {
    heal.validate = (ctx, params) => {
      const cost = params.cost || { gold: params.costGold || 0 };
      const gold = typeof cost === 'number' ? cost : (cost.gold || 0);
      if (gold > 0 && (ctx.state?.gold ?? 0) < gold) return { ok: false, error: 'cannot_afford' };
      return { ok: true };
    };
    heal.effects = () => [{ type: 'ui_update', panels: ['inventory', 'abilities'] }];
  }

  if (!ACTION_REGISTRY.trade_buy) {
    ACTION_REGISTRY.trade_buy = {
      id: 'trade_buy',
      name: 'Купить предмет',
      category: 'inventory',
      params: [
        { name: 'itemId', type: 'select', source: 'items', label: 'Предмет' },
        { name: 'price', type: 'number', label: 'Цена' }
      ],
      validate(ctx, params) {
        const price = parseInt(params.price, 10) || 0;
        if ((ctx.state?.gold ?? 0) < price) return { ok: false, error: 'cannot_afford' };
        return { ok: true };
      },
      execute(engine, params) {
        const price = parseInt(params.price, 10) || 0;
        if (engine.state.gold < price) return false;
        engine.state.gold -= price;
        engine.addItem(params.itemId);
        engine.updateStats?.();
        const name = engine.data?.items?.[params.itemId]?.name || params.itemId;
        return {
          effects: [{ type: 'ui_update', panels: ['inventory'] }],
          log: `📦 Куплено: ${name} (−${price} зм)`
        };
      }
    };
  }

  if (!ACTION_REGISTRY.trade_sell) {
    ACTION_REGISTRY.trade_sell = {
      id: 'trade_sell',
      name: 'Продать предмет',
      category: 'inventory',
      params: [
        { name: 'itemId', type: 'select', source: 'items', label: 'Предмет' },
        { name: 'price', type: 'number', label: 'Цена' }
      ],
      validate(ctx, params) {
        const have = (ctx.state?.inventory || []).includes(params.itemId);
        if (!have) return { ok: false, error: 'no_item' };
        return { ok: true };
      },
      execute(engine, params) {
        const idx = engine.state.inventory.indexOf(params.itemId);
        if (idx === -1) return false;
        const price = parseInt(params.price, 10) || 0;
        engine.state.inventory.splice(idx, 1);
        engine.state.gold += price;
        engine.updateStats?.();
        const name = engine.data?.items?.[params.itemId]?.name || params.itemId;
        return {
          effects: [{ type: 'ui_update', panels: ['inventory'] }],
          log: `💰 Продано: ${name} (+${price} зм)`
        };
      }
    };
  }

  if (!ACTION_REGISTRY.repair_item) {
    ACTION_REGISTRY.repair_item = {
      id: 'repair_item',
      name: 'Починить предмет',
      category: 'utility',
      params: [
        { name: 'itemId', type: 'text', label: 'ID предмета' },
        { name: 'cost', type: 'number', label: 'Стоимость' }
      ],
      validate(ctx, params) {
        const cost = parseInt(params.cost, 10) || 0;
        if (cost > 0 && (ctx.state?.gold ?? 0) < cost) {
          return { ok: false, error: 'cannot_afford' };
        }
        const lvl = ctx.engine?.getItemEnhancementLevel?.(params.itemId) ?? 0;
        if (lvl <= 0) return { ok: false, error: 'no_wear' };
        return { ok: true };
      },
      execute(engine, params) {
        const cost = parseInt(params.cost, 10) || 0;
        const lvl = engine.getItemEnhancementLevel?.(params.itemId) || 0;
        if (lvl <= 0) return false;
        if (cost > 0 && engine.state.gold < cost) return false;
        if (cost > 0) engine.state.gold -= cost;
        engine.setItemEnhancementLevel?.(params.itemId, 0);
        engine.recalcDerivedStats?.();
        engine.updateStats?.();
        engine.saveGame?.();
        return {
          effects: [{ type: 'item_repaired' }, { type: 'ui_update' }],
          log: `⚒️ Предмет отремонтирован (−${cost} зм)`
        };
      }
    };
  }

  if (!ACTION_REGISTRY.enhance_item) {
    ACTION_REGISTRY.enhance_item = {
      id: 'enhance_item',
      name: 'Заточить предмет',
      category: 'utility',
      params: [{ name: 'itemId', type: 'text', label: 'ID предмета' }],
      validate(ctx, params) {
        const engine = ctx.engine;
        if (!engine?.getNextEnhancementCost) return { ok: true };
        const cost = engine.getNextEnhancementCost(params.itemId);
        if (cost == null) return { ok: false, error: 'max_level' };
        if ((ctx.state?.gold ?? 0) < cost) return { ok: false, error: 'cannot_afford' };
        return { ok: true };
      },
      execute(engine, params) {
        const session = engine.state.blacksmithSession || {};
        const equippedSlot = engine.ENHANCEMENT_SLOTS?.find(
          (s) => engine.getEquippedItemId(s) === params.itemId
        );
        if (!equippedSlot) {
          session.message = 'Предмет должен быть экипирован.';
          return { effects: [{ type: 'ui_update' }], log: session.message };
        }
        const template = engine.itemsData?.[params.itemId];
        const current = engine.getItemEnhancementLevel(params.itemId);
        const max = session.maxEnhancement != null
          ? Math.min(engine.getItemEnhancementMax(template), Number(session.maxEnhancement))
          : engine.getItemEnhancementMax(template);
        const cost = engine.getNextEnhancementCost(params.itemId);
        if (!template || cost == null || current >= max) {
          session.message = 'Достигнут максимум заточки.';
          return { effects: [{ type: 'ui_update' }], log: session.message };
        }
        if (engine.state.gold < cost) {
          session.message = `Недостаточно золота (нужно ${cost} зм).`;
          return { effects: [{ type: 'ui_update' }], log: session.message };
        }
        engine.state.gold -= cost;
        engine.setItemEnhancementLevel(params.itemId, current + 1);
        engine.recalcDerivedStats();
        engine.updateStats();
        const newLevel = current + 1;
        session.message = `Успех! ${template.name} теперь +${newLevel}. (−${cost} зм)`;
        engine.saveGame();
        return {
          effects: [{ type: 'ui_update' }],
          log: `⚒️ Заточка: ${template.name} +${newLevel} (−${cost} зм)`
        };
      }
    };
  }

  if (!ACTION_REGISTRY.remove_curse) {
    ACTION_REGISTRY.remove_curse = {
      id: 'remove_curse',
      name: 'Снять проклятие с экипировки',
      category: 'utility',
      params: [
        { name: 'itemId', type: 'text', label: 'ID предмета' },
        { name: 'cost', type: 'number', label: 'Стоимость' }
      ],
      validate(ctx, params) {
        const cost = parseInt(params.cost, 10) || 0;
        if (cost > 0 && (ctx.state?.gold ?? 0) < cost) {
          return { ok: false, error: 'cannot_afford' };
        }
        return { ok: true };
      },
      execute(engine, params) {
        if (typeof engine.templePriestRemoveCurse === 'function') {
          engine.templePriestRemoveCurse(params.itemId);
          return { effects: [{ type: 'ui_update' }], log: '✨ Проклятие снято с экипировки' };
        }
        return false;
      }
    };
  }

  if (!ACTION_REGISTRY.gamble_dice) {
    ACTION_REGISTRY.gamble_dice = {
      id: 'gamble_dice',
      name: 'Игра в кости',
      category: 'utility',
      params: [
        { name: 'bet', type: 'number', label: 'Ставка' },
        { name: 'minBet', type: 'number', label: 'Мин.' },
        { name: 'maxBet', type: 'number', label: 'Макс.' }
      ],
      validate(ctx, params) {
        const bet = parseInt(params.bet, 10) || 0;
        if (bet <= 0 || (ctx.state?.gold ?? 0) < bet) {
          return { ok: false, error: 'cannot_afford' };
        }
        return { ok: true };
      },
      execute(engine, params) {
        const min = Math.max(1, parseInt(params.minBet, 10) || 5);
        const max = Math.max(min, parseInt(params.maxBet, 10) || 50);
        let bet = parseInt(params.bet, 10) || min;
        bet = Math.max(min, Math.min(max, bet));
        if (engine.state.gold < bet) return false;
        const roll = engine.d20();
        let msg;
        if (roll >= 15) {
          const win = bet * 2;
          engine.state.gold += win - bet;
          msg = `Победа! Бросок ${roll}, вы получили ${win} зм.`;
          engine.log(`🎲 Выигрыш! Бросок ${roll}: +${win} зм`, 'log-heal');
        } else {
          engine.state.gold -= bet;
          msg = `Неудача. Бросок ${roll}, потеря ${bet} зм.`;
          engine.log(`🎲 Проигрыш (${roll}). −${bet} зм`, 'log-damage');
        }
        engine._lastGambleMsg = msg;
        engine.updateStats();
        engine.saveGame();
        return { effects: [{ type: 'ui_update' }], log: msg };
      }
    };
  }

  if (!ACTION_REGISTRY.craft_item) {
    ACTION_REGISTRY.craft_item = {
      id: 'craft_item',
      name: 'Создать предмет',
      category: 'inventory',
      params: [
        { name: 'resultId', type: 'text', label: 'Результат' },
        { name: 'materials', type: 'object', label: 'Материалы' }
      ],
      validate(ctx, params) {
        const mats = params.materials || {};
        const inv = ctx.state?.inventory || [];
        for (const [matId, need] of Object.entries(mats)) {
          let have = 0;
          for (const id of inv) {
            if (id === matId) have++;
          }
          if (have < need) return { ok: false, error: 'no_materials' };
        }
        return { ok: true };
      },
      execute(engine, params) {
        const mats = params.materials || {};
        for (const [matId, need] of Object.entries(mats)) {
          for (let i = 0; i < need; i++) {
            if (engine.removeItem) engine.removeItem(matId);
            else {
              const idx = engine.state.inventory.indexOf(matId);
              if (idx === -1) return false;
              engine.state.inventory.splice(idx, 1);
            }
          }
        }
        engine.addItem(params.resultId);
        const name = engine.data?.items?.[params.resultId]?.name || params.resultId;
        engine.saveGame?.();
        return {
          effects: [{ type: 'ui_update', panels: ['inventory'] }],
          log: `🔨 Создано: ${name}`
        };
      }
    };
  }
})();

