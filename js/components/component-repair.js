// Компонент: ремонт снаряжения
(function () {
  const RepairComponent = {
    defaultParams: {
      npc: 'blacksmith_npc',
      costPerDurability: 1,
      flatCost: 15
    },

    render(engine, container, compDef, ctx) {
      const p = { ...this.defaultParams, ...(compDef.params || {}) };
      const preview = ctx.preview;
      const npc = SceneComponentBase.getNpcName(engine, p.npc, 'Мастер');
      const cost = Math.max(1, parseInt(p.flatCost ?? p.costPerDurability, 10) || 15);
      const slots = engine.ENHANCEMENT_SLOTS || ['weapon_main', 'armor', 'shield'];

      let rows = '';
      slots.forEach((slot) => {
        const id = engine.getEquippedItemId?.(slot);
        const item = id ? engine.getEffectiveItemData?.(id) : null;
        const label = slot === 'weapon_main' ? 'Оружие' : slot === 'armor' ? 'Броня' : 'Щит';
        if (!item) {
          rows += `<p class="hint">${label}: пусто</p>`;
          return;
        }
        const lvl = engine.getItemEnhancementLevel?.(id) || 0;
        const worn = lvl > 0;
        rows += `<div class="repair-row">
          <span>${SceneComponentBase.escape(engine, item.name)} ${worn ? `(износ +${lvl})` : '(в порядке)'}</span>
          ${worn && !preview ? `<button type="button" class="choice" onclick="SceneComponentHandlers.repairItem(${ctx.index},'${SceneComponentBase.attr(engine, id)}',${cost})">Починить за ${cost} зм</button>` : ''}
          ${worn && preview ? `<button type="button" class="choice" disabled>Починить</button>` : ''}
        </div>`;
      });

      container.innerHTML = SceneComponentBase.wrap(
        'repair',
        `⚒️ Ремонт — ${SceneComponentBase.escape(engine, npc)}`,
        `${SceneComponentBase.previewNote(preview)}
         <p class="hint">Сбрасывает заточку (износ) за плату. Цена: ${cost} зм.</p>
         ${rows}`
      );
    }
  };

  SceneComponentRegistry.register('repair', RepairComponent);
})();
