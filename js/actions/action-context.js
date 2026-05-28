// Единый контекст выполнения действий (слой 3)
const ActionContext = (function () {
  function build(engine, extra = {}) {
    if (!engine) throw new Error('ActionContext.build: engine required');
    const state = engine.state || {};
    return {
      engine,
      state,
      data: engine.data,
      scene: extra.scene || null,
      component: extra.component || null,
      character: {
        name: state.charName,
        className: state.className,
        level: state.level ?? 1,
        hp: state.hp,
        maxHp: state.maxHp,
        gold: state.gold,
        inventory: state.inventory || [],
        equipment: state.equipped || {},
        flags: state.flags || {},
        stats: state.stats || {}
      },
      party: state.party || [],
      conditions: typeof ConditionSystem !== 'undefined' ? ConditionSystem : null,
      resources: {
        canAfford: (cost) => ActionContext.canAfford(engine, cost),
        spend: (cost) => ActionContext.spend(engine, cost)
      },
      log: (message, type) => engine.log?.(message, type || 'log-dice'),
      snapshot: () => ActionContext.snapshot(engine),
      restore: (snap) => ActionContext.restore(engine, snap),
      ...extra
    };
  }

  function snapshot(engine) {
    const s = engine.state;
    return {
      gold: s.gold,
      hp: s.hp,
      maxHp: s.maxHp,
      inventory: [...(s.inventory || [])],
      flags: { ...(s.flags || {}) },
      equipped: { ...(s.equipped || {}) },
      questStages: { ...(s.questStages || {}) }
    };
  }

  function restore(engine, snap) {
    if (!snap) return;
    Object.assign(engine.state, {
      gold: snap.gold,
      hp: snap.hp,
      maxHp: snap.maxHp,
      inventory: [...(snap.inventory || [])],
      flags: { ...(snap.flags || {}) },
      equipped: { ...(snap.equipped || {}) },
      questStages: { ...(snap.questStages || {}) }
    });
    engine.updateStats?.();
    engine.updateUI?.();
  }

  function parseCost(cost) {
    if (!cost) return { gold: 0, items: {} };
    if (typeof cost === 'number') return { gold: cost, items: {} };
    if (typeof cost === 'string' && /^\d+$/.test(cost)) return { gold: parseInt(cost, 10), items: {} };
    const gold = cost.gold ?? cost.amount ?? 0;
    const items = { ...(cost.items || {}) };
    if (cost.itemId) items[cost.itemId] = cost.count ?? cost.amount ?? 1;
    if (cost.resource && cost.resource !== 'gold') {
      items[cost.resource] = cost.amount ?? 1;
    }
    return { gold: Number(gold) || 0, items };
  }

  function canAfford(engine, cost) {
    const parsed = parseCost(cost);
    if ((engine.state.gold ?? 0) < parsed.gold) return false;
    for (const [itemId, need] of Object.entries(parsed.items)) {
      const have = (engine.state.inventory || []).filter((id) => id === itemId).length;
      if (have < need) return false;
    }
    return true;
  }

  function spend(engine, cost) {
    const parsed = parseCost(cost);
    if (parsed.gold > 0) {
      engine.state.gold -= parsed.gold;
      engine.updateStats?.();
    }
    for (const [itemId, need] of Object.entries(parsed.items)) {
      for (let i = 0; i < need; i++) {
        const idx = (engine.state.inventory || []).indexOf(itemId);
        if (idx === -1) break;
        engine.state.inventory.splice(idx, 1);
      }
    }
  }

  return { build, snapshot, restore, canAfford, spend, parseCost };
})();

if (typeof window !== 'undefined') {
  window.ActionContext = ActionContext;
}
