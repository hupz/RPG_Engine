// Компонент: создание предметов
(function () {
  const CraftingComponent = {
    defaultParams: {
      npc: 'blacksmith_npc',
      recipes: []
    },

    render(engine, container, compDef, ctx) {
      const p = { ...this.defaultParams, ...(compDef.params || {}) };
      const preview = ctx.preview;
      const npc = SceneComponentBase.getNpcName(engine, p.npc, 'Мастер');
      const recipes = Array.isArray(p.recipes) ? p.recipes : [];

      let rows = '';
      recipes.forEach((r, i) => {
        const rec = typeof r === 'string' ? { id: r, result: r } : r;
        const resultId = rec.result || rec.itemId || rec.id;
        const db = engine.data?.items?.[resultId];
        const mats = rec.materials || rec.cost || {};
        const matStr = Object.entries(mats).map(([k, v]) => `${k}×${v}`).join(', ') || '—';
        rows += `<div class="craft-row">
          <span>${SceneComponentBase.escape(engine, db?.name || resultId)}</span>
          <span class="hint">${SceneComponentBase.escape(engine, matStr)}</span>
          <button type="button" class="choice" ${preview ? 'disabled' : ''} ${preview ? '' : `onclick="SceneComponentHandlers.craft(${ctx.index},${i})"`}>
            Создать
          </button>
        </div>`;
      });

      if (!rows) rows = '<p class="hint">Нет рецептов в params.recipes</p>';

      container.innerHTML = SceneComponentBase.wrap(
        'crafting',
        `🔨 ${SceneComponentBase.escape(engine, npc)}`,
        `${SceneComponentBase.previewNote(preview)}${rows}`
      );

      if (!window.SceneComponentHandlers) window.SceneComponentHandlers = {};
      window.SceneComponentHandlers._craft = window.SceneComponentHandlers._craft || {};
      window.SceneComponentHandlers._craft[ctx.index] = recipes;
    }
  };

  SceneComponentRegistry.register('crafting', CraftingComponent);
})();
