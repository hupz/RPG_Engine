// ============================================
// Исполнитель цепочек действий
// ============================================

const ActionRunner = (function () {
  /** Разбор формулы: число, NdM+X или parseRoll движка */
  function parseRollAmount(engine, formula) {
    if (engine.parseRollAmount) return engine.parseRollAmount(formula);
    if (formula == null) return 0;
    if (typeof formula === 'number' && !Number.isNaN(formula)) return formula;
    const s = String(formula).trim();
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    if (typeof engine.parseRoll === 'function' && /d\d/i.test(s)) return engine.parseRoll(s);
    return 0;
  }

  function getActionDef(actionId) {
    return ACTION_REGISTRY?.[actionId] || null;
  }

  function resolveBranch(engine, branch, ctx) {
    if (branch == null) return true;
    if (typeof branch === 'string') {
      return runChain(engine, branch, ctx);
    }
    if (Array.isArray(branch)) {
      return runSteps(engine, branch, ctx);
    }
    if (typeof branch === 'object' && branch.steps) {
      return runSteps(engine, branch.steps, ctx);
    }
    return true;
  }

  async function runAction(engine, def, params) {
    const p = { ...(params || {}) };
    return await def.execute(engine, p);
  }

  function isBooleanAction(def, result) {
    if (def.returns === 'boolean') return true;
    return typeof result === 'boolean';
  }

  async function runSteps(engine, steps, ctx = {}) {
    if (!Array.isArray(steps)) return { ok: false };

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step || !step.action) continue;

      const def = getActionDef(step.action);
      if (!def) {
        console.warn('[ActionRunner] Неизвестное действие:', step.action);
        continue;
      }

      const result = await runAction(engine, def, step.params);
      const isBool = isBooleanAction(def, result);

      if (isBool) {
        if (result) {
          if (step.onSuccess != null) {
            const sub = await resolveBranch(engine, step.onSuccess, ctx);
            if (sub === false) return { ok: false, stoppedAt: i };
          }
        } else {
          if (step.onFail != null) {
            await resolveBranch(engine, step.onFail, ctx);
          } else if (step.onFailMessage) {
            engine.log(step.onFailMessage, 'log-damage');
          }
          if (ctx.stopOnFail !== false) return { ok: false, stoppedAt: i };
        }
        continue;
      }

      if (result === false && step.stopOnFail !== false) {
        if (step.onFail != null) await resolveBranch(engine, step.onFail, ctx);
        return { ok: false, stoppedAt: i };
      }
    }

    engine.saveGame?.();
    return { ok: true };
  }

  async function runChain(engine, chainIdOrDef, ctx = {}) {
    let steps = chainIdOrDef;
    let meta = null;

    if (typeof chainIdOrDef === 'string') {
      const stored = engine.data?.actionChains?.[chainIdOrDef];
      if (!stored) {
        console.warn('[ActionRunner] Цепочка не найдена:', chainIdOrDef);
        return { ok: false, error: 'chain_not_found' };
      }
      meta = stored;
      steps = stored.steps || stored;
    }

    if (!Array.isArray(steps)) {
      return { ok: false, error: 'invalid_chain' };
    }

    const res = await runSteps(engine, steps, ctx);
    if (meta?.refreshComponents) engine.refreshSceneComponents?.();
    return res;
  }

  function bindEngine() {
    if (typeof GameEngine === 'undefined') return;

    GameEngine.parseRollAmount = function (formula) {
      return parseRollAmount(this, formula);
    };

    GameEngine.executeChain = function (chainIdOrDef, options = {}) {
      return ActionRunner.runChain(this, chainIdOrDef, options || {});
    };

    GameEngine.runActionChain = function (chainId) {
      return this.executeChain(chainId);
    };

    GameEngine._runSceneChainOnEnter = function (components) {
      if (!Array.isArray(components)) return;
      components.forEach((c) => {
        if (c.enabled === false) return;
        if (c.chainOnEnter) this.executeChain(c.chainOnEnter);
      });
    };
  }

  bindEngine();
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', bindEngine);
  }

  return {
    parseRollAmount,
    runSteps,
    runChain,
    getActionDef,
    resolveBranch
  };
})();

if (typeof window !== 'undefined') {
  window.ActionRunner = ActionRunner;
}
