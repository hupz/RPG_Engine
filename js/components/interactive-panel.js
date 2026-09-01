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

      const objectId = p.objectId || compDef.id || chain || 'interactive';
      const safeObj = SceneComponentBase.attr(engine, objectId);
      const safeChain = chain ? SceneComponentBase.attr(engine, chain) : '';
      container.innerHTML = SceneComponentBase.wrap(
        'interactive_panel',
        `${icon} ${SceneComponentBase.escape(engine, label)}`,
        `${SceneComponentBase.previewNote(preview)}
         <button type="button" class="choice scene-chain-btn" ${preview ? 'disabled' : ''}
           ${preview ? '' : `onclick="GameEngine.interactSceneObject('${safeObj}','${safeChain}')"`}>
           ${SceneComponentBase.escape(engine, label)}
         </button>
         ${!chain && !p.objectId ? '<p class="hint">Укажите objectId или chain</p>' : ''}`
      );
    }
  };

  registerSceneComponent('interactive_panel', InteractivePanelComponent);
  registerSceneComponent('interactive', InteractivePanelComponent);
})();
