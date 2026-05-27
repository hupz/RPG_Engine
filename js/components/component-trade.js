// Компонент: торговля
(function () {
  const TradeComponent = {
    defaultParams: {
      merchant: 'jack',
      inventory: 'village_shop',
      sellMultiplier: 1,
      buyMultiplier: 0.5,
      repFaction: 'rep_village'
    },

    render(engine, container, compDef, ctx) {
      const p = { ...this.defaultParams, ...(compDef.params || {}) };
      const merchant = SceneComponentBase.getNpcName(engine, p.merchant || p.npc, 'Торговец');
      const itemIds = SceneComponentBase.resolveInventory(engine, p.inventory, p.merchant);
      const preview = ctx.preview;

      const cfg = {
        inventory: itemIds,
        sellMultiplier: Number(p.sellMultiplier) ?? 1,
        buyMultiplier: Number(p.buyMultiplier) ?? 0.5,
        repFlag: p.repFaction || p.repFlag || null,
        exitScene: ctx.scene?.exit || ctx.scene?.exitScene || 'village_hub'
      };

      if (preview) {
        const rows = itemIds.slice(0, 6).map((id) => {
          const db = engine.data?.items?.[id];
          const price = engine.getShopBuyPrice?.(id, cfg) ?? db?.price ?? '?';
          return `<div class="trade-item-row"><span>${SceneComponentBase.escape(engine, (db?.icon || '📦') + ' ' + (db?.name || id))}</span><span>${price} зм</span></div>`;
        }).join('');
        container.innerHTML = SceneComponentBase.wrap(
          'trade',
          `💰 ${SceneComponentBase.escape(engine, merchant)}`,
          `${SceneComponentBase.previewNote(true)}<div class="trade-inventory">${rows || '<p class="hint">Пустой ассортимент</p>'}</div>
           <button type="button" class="choice" disabled>Купить</button>
           <button type="button" class="choice" disabled>💰 Продать предмет</button>`
        );
        return;
      }

      engine.state.shopSession = {
        sceneId: ctx.sceneId,
        config: cfg,
        selectedBuyId: null,
        selectedSellId: null,
        message: '',
        componentIndex: ctx.index,
        containerEl: container
      };

      if (cfg.repFlag) {
        const rep = engine.getReputationValue?.(cfg.repFlag) ?? 0;
        const tradeOk = rep > -20;
        if (!tradeOk) {
          container.innerHTML = SceneComponentBase.wrap(
            'trade',
            `💰 ${SceneComponentBase.escape(engine, merchant)}`,
            '<p>Торговец отворачивается — с вами не торгуют.</p>'
          );
          return;
        }
      }

      engine.renderShopUIInto?.(container);
    }
  };

  SceneComponentRegistry.register('trade', TradeComponent);
})();
