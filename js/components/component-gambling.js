// Компонент: азартные игры
(function () {
  const GamblingComponent = {
    defaultParams: {
      npc: 'jack',
      minBet: 5,
      maxBet: 50,
      games: ['dice']
    },

    render(engine, container, compDef, ctx) {
      const p = { ...this.defaultParams, ...(compDef.params || {}) };
      const preview = ctx.preview;
      const npc = SceneComponentBase.getNpcName(engine, p.npc, 'Игрок');
      const min = Math.max(1, parseInt(p.minBet, 10) || 5);
      const max = Math.max(min, parseInt(p.maxBet, 10) || 50);

      container.innerHTML = SceneComponentBase.wrap(
        'gambling',
        `🎲 ${SceneComponentBase.escape(engine, npc)}`,
        `${SceneComponentBase.previewNote(preview)}
         <p>Кости: ставка ${min}–${max} зм. Выигрыш ×2 при броске 15+.</p>
         <label>Ставка: <input type="number" id="gamble-bet-${ctx.index}" min="${min}" max="${max}" value="${min}" style="width:60px;" ${preview ? 'disabled' : ''}></label>
         <button type="button" class="choice" ${preview ? 'disabled' : ''} ${preview ? '' : `onclick="SceneComponentHandlers.gamble(${ctx.index},${min},${max})"`}>
           🎲 Бросить кости
         </button>
         <div id="gamble-result-${ctx.index}" class="hint"></div>`
      );
    }
  };

  SceneComponentRegistry.register('gambling', GamblingComponent);
})();
