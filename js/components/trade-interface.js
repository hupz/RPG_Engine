// Универсальный компонент торговли (v3)
(function () {
  const TradeInterfaceComponent = {
    defaultParams: {
      merchant: 'jack',
      inventory: 'village_shop',
      sellMultiplier: 1,
      buyMultiplier: 0.5,
      repFaction: 'rep_village'
    },

    render(engine, container, compDef, ctx) {
      const p = { ...this.defaultParams, ...SceneComponentBase.getConfig(compDef) };
      const merchant = SceneComponentBase.getNpcName(engine, p.merchant || p.npc, 'Торговец');
      const itemIds = SceneComponentBase.resolveInventory(engine, p.inventory, p.merchant);
      const preview = ctx.preview;

      const rawScene = engine.data?.scenes?.[ctx.sceneId];
      const isJackShop = !!(p.jackShop || p.merchant === 'jack' || rawScene?.shopConfig?.jackShop);
      let cfg = {
        inventory: itemIds,
        sellMultiplier: Number(p.sellMultiplier) ?? 1,
        buyMultiplier: Number(p.buyMultiplier) ?? 0.5,
        repFlag: p.repFaction || p.repFlag || null,
        exitScene: ctx.scene?.exit || ctx.scene?.exitScene || rawScene?.exitScene || 'village_hub',
        jackShop: isJackShop
      };
      if (isJackShop && typeof engine.getJackShopConfig === 'function') {
        const jackCfg = engine.getJackShopConfig(rawScene || ctx.scene);
        cfg = { ...jackCfg, ...cfg, inventory: cfg.inventory?.length ? cfg.inventory : jackCfg.inventory };
      }

      if (preview) {
        const rows = itemIds.slice(0, 6).map((id) => {
          const db = engine.data?.items?.[id];
          const price = engine.getShopBuyPrice?.(id, cfg) ?? db?.price ?? '?';
          return `<div class="trade-item-row"><span>${SceneComponentBase.escape(engine, (db?.icon || '📦') + ' ' + (db?.name || id))}</span><span>${price} зм</span></div>`;
        }).join('');
        container.innerHTML = SceneComponentBase.wrap(
          'trade_interface',
          `💰 ${SceneComponentBase.escape(engine, merchant)}`,
          `${SceneComponentBase.previewNote(true)}<div class="trade-inventory">${rows || '<p class="hint">Пустой ассортимент</p>'}</div>`
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
        if (rep <= -20) {
          container.innerHTML = SceneComponentBase.wrap(
            'trade_interface',
            `💰 ${SceneComponentBase.escape(engine, merchant)}`,
            '<p>Торговец отворачивается — с вами не торгуют.</p>'
          );
          return;
        }
      }

      engine.renderShopUIInto?.(container);
    }
  };

  SceneComponentRegistry.register('trade_interface', TradeInterfaceComponent);
  SceneComponentRegistry.register('trade', TradeInterfaceComponent);
})();
