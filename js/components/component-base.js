// Общие хелперы для компонентов сцен
const SceneComponentBase = {
  escape(engine, s) {
    return engine.escapeHtml ? engine.escapeHtml(s) : String(s ?? '');
  },

  attr(engine, s) {
    return engine.escapeAttr ? engine.escapeAttr(s) : String(s ?? '');
  },

  isVisible(engine, compDef) {
    if (compDef.enabled === false) return false;
    const cond = compDef.conditions;
    if (!cond) return true;
    const ctx = engine.getConditionContext?.() || {
      flags: engine.state?.flags || {},
      inventory: engine.state?.inventory || [],
      gold: engine.state?.gold ?? 0
    };
    if (typeof ConditionSystem !== 'undefined') {
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
  }
};
