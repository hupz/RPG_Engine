// ============================================
// Исполнитель цепочек действий
// ============================================

const ActionRunner = (function () {
  const _history = [];

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

  /** Поля шага кроме action/onSuccess/onFail → params (формат сцены и цепочек) */
  function normalizeStep(step) {
    if (!step || !step.action) return step;
    const reserved = new Set([
      'action', 'params', 'onSuccess', 'onFail', 'onFailMessage', 'stopOnFail',
      'onConfirm', 'onCancel'
    ]);
    const params = { ...(step.params || {}) };
    Object.keys(step).forEach((key) => {
      if (!reserved.has(key)) params[key] = step[key];
    });
    if (step.onConfirm != null) params.onConfirm = step.onConfirm;
    if (step.onCancel != null) params.onCancel = step.onCancel;
    return { action: step.action, params, onSuccess: step.onSuccess, onFail: step.onFail,
      onFailMessage: step.onFailMessage, stopOnFail: step.stopOnFail,
      onConfirm: step.onConfirm, onCancel: step.onCancel };
  }

  function resolveContextPath(ctx, source) {
    if (!source) return undefined;
    if (typeof source === 'object') return source;
    const path = String(source).trim();
    if (!path) return undefined;
    return path.split('.').reduce((cur, key) => (cur == null ? undefined : cur[key]), ctx);
  }

  async function runAction(engine, def, params, ctx) {
    const p = { ...(params || {}) };
    if (def.execute.length >= 3) return await def.execute(engine, p, ctx || {});
    return await def.execute(engine, p);
  }

  function isBooleanAction(def, result) {
    if (def.returns === 'boolean') return true;
    return typeof result === 'boolean';
  }

  async function runSteps(engine, steps, ctx = {}) {
    if (!Array.isArray(steps)) return { ok: false };

    for (let i = 0; i < steps.length; i++) {
      const step = normalizeStep(steps[i]);
      if (!step || !step.action) continue;

      const def = getActionDef(step.action);
      if (!def) {
        console.warn('[ActionRunner] Неизвестное действие:', step.action);
        continue;
      }

      const result = await runAction(engine, def, step.params, ctx);
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

    if (!ctx.skipAutoSave) engine.saveGame?.();
    return { ok: true };
  }

  function getSceneHooks(engine, sceneId) {
    const raw = engine.data?.scenes?.[sceneId];
    if (!raw) return null;
    if (raw.sceneTemplate && !raw.templateDetached && typeof SceneTemplateEngine !== 'undefined') {
      try {
        return SceneTemplateEngine.materializeScene(engine.data, raw);
      } catch (e) {
        console.warn('[ActionRunner] materializeScene:', e);
      }
    }
    return raw;
  }

  async function runSceneLifecycle(engine, sceneId, phase) {
    const scene = getSceneHooks(engine, sceneId);
    if (!scene) return;
    const steps = phase === 'enter' ? scene.onEnter : scene.onExit;
    if (!Array.isArray(steps) || !steps.length) return;
    await runSteps(engine, steps, { sceneId, scene, phase, skipAutoSave: true });
  }

  function resolveHandlerSteps(engine, sceneId, scene, handlerId) {
    let steps = scene?.handlers?.[handlerId];
    if (Array.isArray(steps)) return { steps, scene };
    const raw = engine.data?.scenes?.[sceneId];
    if (raw?.sceneTemplate === 'character_creation' && typeof SceneTemplate !== 'undefined') {
      const built = SceneTemplate.charCreation.create({
        ...(raw.templateParams || {}),
        id: sceneId
      });
      steps = built.handlers?.[handlerId];
      if (Array.isArray(steps)) return { steps, scene: built };
    }
    return { steps: null, scene };
  }

  async function runSceneHandler(engine, handlerId, ctx = {}) {
    const sceneId = ctx.sceneId || engine.state.scene;
    let scene = ctx.scene || getSceneHooks(engine, sceneId);
    let { steps, scene: resolvedScene } = resolveHandlerSteps(engine, sceneId, scene, handlerId);
    scene = resolvedScene || scene;
    if (!Array.isArray(steps)) {
      console.warn('[ActionRunner] Обработчик сцены не найден:', handlerId, 'scene:', sceneId);
      return { ok: false };
    }
    return runSteps(engine, steps, { ...ctx, sceneId, scene, handlerId });
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

  /**
   * Универсальный запуск действия (слой 3): validate → cost → execute → effects.
   * Совместим с ACTION_REGISTRY.execute; validate/effects — опционально.
   */
  async function runV2(engine, actionRef, params = {}, extraCtx = {}) {
    const def = getActionDef(actionRef);
    if (!def) {
      console.warn('[ActionRunner] Unknown action:', actionRef);
      return { success: false, error: 'unknown_action' };
    }

    const ctx = extraCtx.engine
      ? extraCtx
      : (typeof ActionContext !== 'undefined'
        ? ActionContext.build(engine, extraCtx)
        : { engine, log: (m, t) => engine.log?.(m, t) });

    const snapshot = ctx.snapshot?.();

    if (typeof def.validate === 'function') {
      const validation = def.validate(ctx, params);
      if (validation && validation.ok === false) {
        return { success: false, error: validation.error || 'validation_failed' };
      }
    }

    const cost = params.cost;
    if (cost && typeof ActionContext !== 'undefined') {
      if (!ActionContext.canAfford(engine, cost)) {
        return { success: false, error: 'cannot_afford' };
      }
      ActionContext.spend(engine, cost);
    }

    const raw = await runAction(engine, def, params, ctx);
    const isBool = isBooleanAction(def, raw);

    if (isBool && raw === false) {
      if (snapshot && ctx.restore) ctx.restore(snapshot);
      return { success: false, error: 'action_failed' };
    }

    let effects = [];
    if (raw && typeof raw === 'object' && Array.isArray(raw.effects)) {
      effects = raw.effects;
    } else if (def.effects) {
      effects = typeof def.effects === 'function' ? def.effects(ctx, params, raw) : def.effects;
    }

    if (params.log && ctx.log) ctx.log(params.log, params.logType || 'log-heal');
    if (raw && raw.log && ctx.log) ctx.log(raw.log, raw.logType || 'log-heal');

    if (effects.length && typeof ActionEffects !== 'undefined') {
      await ActionEffects.applyAll(effects, ctx);
    }

    if (snapshot) {
      _history.push({ actionRef, params, snapshot, ts: Date.now() });
      if (_history.length > 32) _history.shift();
    }

    return { success: true, result: raw };
  }

  function rollback(engine, steps = 1) {
    let n = Math.max(1, parseInt(steps, 10) || 1);
    while (n > 0 && _history.length) {
      const entry = _history.pop();
      if (entry?.snapshot && typeof ActionContext !== 'undefined') {
        ActionContext.restore(engine, entry.snapshot);
      }
      n--;
    }
    engine.refreshSceneComponents?.();
    return _history.length;
  }

  function bindEngine() {
    if (typeof GameEngine === 'undefined') return;

    GameEngine.runAction = function (actionRef, params, ctx) {
      return ActionRunner.runV2(this, actionRef, params || {}, ctx || {});
    };

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

    GameEngine.runSceneHandler = function (handlerId, ctx) {
      return ActionRunner.runSceneHandler(this, handlerId, ctx || {});
    };

    if (!GameEngine._sceneLifecyclePatched) {
      GameEngine._sceneLifecyclePatched = true;
      const origShow = GameEngine.showScene.bind(GameEngine);
      GameEngine.showScene = async function (sceneId, options = {}) {
        const prevId = this.state.scene;
        if (prevId && prevId !== sceneId) {
          await ActionRunner.runSceneLifecycle(this, prevId, 'exit');
        }
        await ActionRunner.runSceneLifecycle(this, sceneId, 'enter');
        const result = origShow(sceneId, options);
        if (!this.sceneHidesPlayerUI?.(sceneId)) {
          this.ensurePlayerUIVisible?.();
        }
        return result;
      };
    }
  }

  bindEngine();
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', bindEngine);
  }

  return {
    parseRollAmount,
    normalizeStep,
    resolveContextPath,
    runSteps,
    runChain,
    runV2,
    rollback,
    runSceneLifecycle,
    runSceneHandler,
    getActionDef,
    resolveBranch,
    getHistory: () => [..._history]
  };
})();

if (typeof window !== 'undefined') {
  window.ActionRunner = ActionRunner;
}
