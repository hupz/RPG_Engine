// Обработчики UI компонентов сцен
const SceneComponentHandlers = {
  dialogueTopic(compIndex, topicIndex) {
    const store = this._dialogue?.[compIndex];
    if (!store) return;
    const t = store.topics[topicIndex];
    const reply = typeof t === 'object' ? (t.reply || t.text || '') : `«${t}» — отвечает ${store.name}.`;
    const el = document.getElementById(`dialogue-component-reply-${compIndex}`);
    if (el) el.innerHTML = `<p class="scene-component-reply-text">${GameEngine.escapeHtml(reply)}</p>`;
    if (typeof t === 'object' && t.flags) GameEngine.applyFlags(t.flags);
    if (typeof t === 'object' && t.questSet) {
      GameEngine.updateQuest(t.questSet.questId, t.questSet.stage);
    }
    if (typeof t === 'object' && t.donate) {
      const cost = parseInt(t.donate.cost, 10) || 10;
      if (GameEngine.state.gold < cost) {
        if (el) el.innerHTML = '<p class="hint">Недостаточно золота для подношения.</p>';
        return;
      }
      GameEngine.state.gold -= cost;
      if (t.donate.flag) GameEngine.state.flags[t.donate.flag] = true;
      GameEngine.updateStats();
      GameEngine.log(`🙏 Пожертвование в храм (−${cost} зм).`, 'log-heal');
    }
    GameEngine.saveGame();
  },

  heal(compIndex) {
    const scene = GameEngine.data.scenes[GameEngine.state.scene];
    const comp = scene?.components?.[compIndex];
    const p = comp?.params || {};
    const cost = parseInt(p.cost, 10) || 25;
    if (GameEngine.state.gold < cost) {
      GameEngine.log('❌ Недостаточно золота.', 'log-damage');
      return;
    }
    GameEngine.state.gold -= cost;
    if (!p.healAmount || p.healAmount === 'full') {
      GameEngine.state.hp = GameEngine.state.maxHp;
    } else {
      GameEngine.state.hp = Math.min(GameEngine.state.maxHp, GameEngine.state.hp + parseInt(p.healAmount, 10));
    }
    if (p.restoreResources) GameEngine.restoreAllResources?.();
    GameEngine.updateStats();
    GameEngine.log(`✨ Лечение (−${cost} зм).`, 'log-heal');
    GameEngine.refreshSceneComponents();
  },

  repairItem(compIndex, itemId, cost) {
    if (GameEngine.state.gold < cost) {
      GameEngine.log('❌ Недостаточно золота.', 'log-damage');
      return;
    }
    const lvl = GameEngine.getItemEnhancementLevel(itemId);
    if (lvl <= 0) {
      GameEngine.log('Предмет не нуждается в ремонте.', 'log-dice');
      return;
    }
    GameEngine.state.gold -= cost;
    GameEngine.setItemEnhancementLevel(itemId, 0);
    GameEngine.recalcDerivedStats?.();
    GameEngine.updateStats();
    GameEngine.log(`⚒️ Предмет отремонтирован (−${cost} зм).`, 'log-heal');
    GameEngine.refreshSceneComponents();
  },

  curseRemove(compIndex, itemId) {
    GameEngine.templePriestRemoveCurse(itemId);
    GameEngine.refreshSceneComponents();
  },

  gamble(compIndex, min, max) {
    const inp = document.getElementById(`gamble-bet-${compIndex}`);
    let bet = parseInt(inp?.value, 10) || min;
    bet = Math.max(min, Math.min(max, bet));
    if (GameEngine.state.gold < bet) {
      GameEngine.log('❌ Недостаточно золота для ставки.', 'log-damage');
      return;
    }
    const roll = GameEngine.d20();
    const el = document.getElementById(`gamble-result-${compIndex}`);
    if (roll >= 15) {
      const win = bet * 2;
      GameEngine.state.gold += win - bet;
      GameEngine.log(`🎲 Выигрыш! Бросок ${roll}: +${win} зм`, 'log-heal');
      if (el) el.textContent = `Победа! Бросок ${roll}, вы получили ${win} зм.`;
    } else {
      GameEngine.state.gold -= bet;
      GameEngine.log(`🎲 Проигрыш (${roll}). −${bet} зм`, 'log-damage');
      if (el) el.textContent = `Неудача. Бросок ${roll}, потеря ${bet} зм.`;
    }
    GameEngine.updateStats();
    GameEngine.saveGame();
  },

  craft(compIndex, recipeIndex) {
    const recipes = this._craft?.[compIndex] || [];
    const r = recipes[recipeIndex];
    if (!r) return;
    const rec = typeof r === 'string' ? { result: r, materials: {} } : r;
    const resultId = rec.result || rec.itemId;
    const mats = rec.materials || {};
    for (const [matId, need] of Object.entries(mats)) {
      let have = 0;
      for (const id of GameEngine.state.inventory || []) {
        if (id === matId) have++;
      }
      if (have < need) {
        GameEngine.log(`❌ Не хватает ${matId} (нужно ${need}).`, 'log-damage');
        return;
      }
    }
    for (const [matId, need] of Object.entries(mats)) {
      for (let i = 0; i < need; i++) GameEngine.removeItem?.(matId) || GameEngine.state.inventory.splice(GameEngine.state.inventory.indexOf(matId), 1);
    }
    GameEngine.addItem(resultId);
    GameEngine.log(`🔨 Создано: ${GameEngine.data.items[resultId]?.name || resultId}`, 'log-heal');
    GameEngine.refreshSceneComponents();
  }
};
