// Применение декларативных эффектов после execute()
const ActionEffects = (function () {
  async function applyOne(effect, ctx) {
    if (!effect || !ctx?.engine) return;
    const engine = ctx.engine;
    const type = effect.type;

    switch (type) {
      case 'ui_update':
        engine.updateStats?.();
        engine.updateUI?.();
        engine.refreshSceneComponents?.();
        (effect.panels || []).forEach((p) => {
          if (p === 'inventory') engine.renderInventory?.();
          if (p === 'abilities') engine.renderAbilities?.();
          if (p === 'equipment') engine.updateStats?.();
          if (p === 'stats') engine.updateStats?.();
          if (p === 'clock') engine.timeSystem?.updateUI?.();
          if (p === 'climate') engine.updateClimateUI?.();
          if (p === 'crafting' && typeof CraftingUI !== 'undefined') CraftingUI.render();
        });
        break;
      case 'refresh_scene':
        engine.refreshSceneForTime?.(true);
        engine.refreshSceneForClimate?.(true);
        engine.refreshSceneComponents?.();
        break;
      case 'modify_stat':
        if (effect.stat === 'gold') engine.state.gold = (engine.state.gold || 0) + (effect.value || 0);
        else if (effect.stat === 'hp') {
          engine.state.hp = Math.min(engine.state.maxHp, (engine.state.hp || 0) + (effect.value || 0));
        } else if (engine.state.stats && effect.stat in engine.state.stats) {
          engine.state.stats[effect.stat] += effect.value || 0;
        }
        engine.updateStats?.();
        break;
      case 'set_flag':
        if (!engine.state.flags) engine.state.flags = {};
        engine.state.flags[effect.flag] = effect.value !== undefined ? effect.value : true;
        break;
      case 'log':
        ctx.log(effect.message || '…', effect.logType || 'log-dice');
        break;
      case 'transition':
      case 'change_scene':
        if (effect.target || effect.sceneId) {
          engine.showScene(effect.target || effect.sceneId);
        }
        break;
      case 'play_sound':
        if (typeof AudioEngine !== 'undefined' && effect.sound) {
          AudioEngine.playSFX?.(effect.sound, { volume: effect.volume });
        }
        break;
      case 'trigger_event':
        if (effect.event && typeof engine[effect.event] === 'function') {
          engine[effect.event](...(effect.args || []));
        } else if (effect.handler && typeof GameEngine.runSceneHandler === 'function') {
          GameEngine.runSceneHandler(effect.handler, effect.data || {});
        }
        break;
      case 'item_repaired':
      case 'refresh_components':
        engine.refreshSceneComponents?.();
        break;
      default:
        break;
    }
  }

  async function applyAll(effects, ctx) {
    if (!Array.isArray(effects)) return;
    for (const eff of effects) {
      await applyOne(eff, ctx);
    }
  }

  return { applyOne, applyAll };
})();

if (typeof window !== 'undefined') {
  window.ActionEffects = ActionEffects;
}
