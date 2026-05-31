// Общие хелперы и базовый класс компонентов (слой 2)
const SceneComponentBase = {
  escape(engine, s) {
    return engine.escapeHtml ? engine.escapeHtml(s) : String(s ?? '');
  },

  attr(engine, s) {
    return engine.escapeAttr ? engine.escapeAttr(s) : String(s ?? '');
  },

  isVisible(engine, compDef) {
    if (compDef.enabled === false) return false;
    const cond = compDef.conditions || compDef.condition;
    if (!cond) return true;
    const ctx = engine.getConditionContext?.() || {
      flags: engine.state?.flags || {},
      inventory: engine.state?.inventory || [],
      gold: engine.state?.gold ?? 0
    };
    if (typeof ConditionSystem !== 'undefined') {
      if (typeof ConditionSystem.resolveRef === 'function') {
        return ConditionSystem.resolveRef(cond, ctx);
      }
      if (cond.showIf && !ConditionSystem.evaluate(cond.showIf, ctx)) return false;
      if (cond.hideIf && ConditionSystem.evaluate(cond.hideIf, ctx)) return false;
    }
    return true;
  },

  wrap(type, title, inner) {
    return `<div class="scene-component-block scene-component-block--${type}">
      <div class="scene-component-head">${title}</div>
      <div class="scene-component-body">${inner}</div>
    </div>`;
  },

  previewNote(preview) {
    return preview ? '<p class="hint scene-component-preview">Предпросмотр — кнопки неактивны</p>' : '';
  },

  resolveInventory(engine, key, npcId) {
    if (typeof SceneTemplateEngine !== 'undefined') {
      return SceneTemplateEngine.resolveInventory(engine.data, key, npcId);
    }
    const inv = engine.data?.shopInventories?.[key];
    if (inv?.items) return inv.items;
    if (Array.isArray(inv)) return inv;
    return Array.isArray(key) ? key : [];
  },

  getNpcName(engine, id, fallback) {
    return engine.data?.npcs?.[id]?.name || fallback || id || 'NPC';
  },

  /** Стоимость для UI: золото + предметы */
  renderCost(engine, cost) {
    if (!cost) return '';
    const parsed = typeof ActionContext !== 'undefined'
      ? ActionContext.parseCost(cost)
      : { gold: Number(cost.gold || cost) || 0, items: {} };
    const parts = [];
    if (parsed.gold > 0) parts.push(`${parsed.gold} зм`);
    Object.entries(parsed.items).forEach(([id, n]) => {
      const name = engine.data?.items?.[id]?.name || id;
      parts.push(`${name} ×${n}`);
    });
    return parts.join(' · ') || 'бесплатно';
  },

  checkCondition(engine, conditionRef, args) {
    const ctx = engine.getConditionContext?.();
    if (typeof ConditionSystem !== 'undefined' && ConditionSystem.resolveRef) {
      return ConditionSystem.resolveRef(conditionRef, ctx, args);
    }
    return true;
  },

  async runAction(engine, actionRef, params, extraCtx) {
    if (typeof ActionRunner !== 'undefined' && ActionRunner.runV2) {
      return ActionRunner.runV2(engine, actionRef, params, extraCtx);
    }
    if (typeof engine.executeChain === 'function' && typeof actionRef === 'string') {
      return engine.executeChain(actionRef);
    }
    return { success: false };
  },

  getConfig(compDef) {
    return compDef.config || compDef.params || {};
  },

  resolveType(compDef) {
    return compDef.component || compDef.type || 'unknown';
  }
};

/**
 * Базовый класс UI-компонента сцены (слой 2 — без бизнес-логики).
 */
class SceneComponent {
  constructor(type, config, engine, ctx) {
    this.type = type;
    this.config = config || {};
    this.engine = engine;
    this.ctx = ctx || {};
    this.element = null;
    this.state = {};
  }

  mount(container) {
    this.element = container;
    this.render();
  }

  unmount() {
    if (this.element) this.element.innerHTML = '';
    this.element = null;
    this.state = {};
  }

  update(data) {
    Object.assign(this.config, data || {});
    if (this.element) this.render();
  }

  emit(event, data) {
    const sceneId = this.ctx.sceneId || this.engine.state?.scene;
    if (event === 'run_action' && data?.action) {
      return SceneComponentBase.runAction(this.engine, data.action, data.params || {}, {
        scene: this.ctx.scene,
        component: this.ctx.compDef
      });
    }
    if (event === 'run_chain' && data?.chain) {
      return this.engine.executeChain?.(data.chain);
    }
    if (event === 'refresh') {
      this.engine.refreshSceneComponents?.();
    }
  }

  render() {
    /* override */
  }

  renderCost(cost) {
    return SceneComponentBase.renderCost(this.engine, cost);
  }

  checkCondition(ref, args) {
    return SceneComponentBase.checkCondition(this.engine, ref, args);
  }

  runAction(actionRef, params) {
    return this.emit('run_action', { action: actionRef, params });
  }
}

if (typeof window !== 'undefined') {
  window.SceneComponent = SceneComponent;
}
