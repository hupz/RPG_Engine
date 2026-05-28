// Интерактивная кнопка → цепочка действий (v3)
(function () {
  const InteractivePanelComponent = {
    defaultParams: {
      label: 'Действие',
      chain: '',
      icon: '➡️'
    },

    render(engine, container, compDef, ctx) {
      const p = { ...this.defaultParams, ...SceneComponentBase.getConfig(compDef) };
      const preview = ctx.preview;
      const label = p.label || 'Действие';
      const icon = p.icon || '➡️';
      const chain = p.chain || compDef.chain;

      container.innerHTML = SceneComponentBase.wrap(
        'interactive_panel',
        `${icon} ${SceneComponentBase.escape(engine, label)}`,
        `${SceneComponentBase.previewNote(preview)}
         <button type="button" class="choice scene-chain-btn" ${preview || !chain ? 'disabled' : ''}
           ${preview || !chain ? '' : `onclick="GameEngine.executeChain('${SceneComponentBase.attr(engine, chain)}')"`}>
           ${SceneComponentBase.escape(engine, label)}
         </button>
         ${!chain ? '<p class="hint">Укажите ID цепочки в params.chain</p>' : ''}`
      );
    }
  };

  SceneComponentRegistry.register('interactive_panel', InteractivePanelComponent);
  SceneComponentRegistry.register('interactive', InteractivePanelComponent);
})();
