// Компонент: улучшение / заточка
(function () {
  const UpgradeComponent = {
    defaultParams: {
      npc: 'blacksmith_npc',
      maxEnhancement: 3,
      costTable: [100, 300, 900]
    },

    render(engine, container, compDef, ctx) {
      const p = { ...this.defaultParams, ...(compDef.params || {}) };
      const preview = ctx.preview;
      const npc = SceneComponentBase.getNpcName(engine, p.npc, 'Мастер');

      if (preview) {
        container.innerHTML = SceneComponentBase.wrap(
          'upgrade',
          `⬆️ ${SceneComponentBase.escape(engine, npc)}`,
          `${SceneComponentBase.previewNote(true)}
           <p class="hint">Заточка до +${p.maxEnhancement}, цены: ${(p.costTable || []).join(', ')} зм</p>
           <button type="button" class="choice" disabled>Заточить снаряжение</button>`
        );
        return;
      }

      engine.state.blacksmithSession = {
        sceneId: ctx.sceneId,
        exitScene: null,
        message: '',
        componentIndex: ctx.index,
        componentContainer: container,
        containerEl: container,
        costTable: p.costTable,
        maxEnhancement: p.maxEnhancement
      };

      engine.renderBlacksmithUIInto?.(container);
    }
  };

  SceneComponentRegistry.register('upgrade', UpgradeComponent);
})();
