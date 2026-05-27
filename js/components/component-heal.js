// Компонент: лечение
(function () {
  const HealComponent = {
    defaultParams: {
      npc: 'priest',
      healAmount: 0,
      cost: 25,
      restoreResources: true
    },

    render(engine, container, compDef, ctx) {
      const p = { ...this.defaultParams, ...(compDef.params || {}) };
      const preview = ctx.preview;
      const npc = SceneComponentBase.getNpcName(engine, p.npc, 'Целитель');
      const cost = Math.max(0, parseInt(p.cost, 10) || 0);
      const fullHeal = !p.healAmount || p.healAmount === 'full';

      container.innerHTML = SceneComponentBase.wrap(
        'heal',
        `🩹 ${SceneComponentBase.escape(engine, npc)}`,
        `${SceneComponentBase.previewNote(preview)}
         <p>${fullHeal ? 'Полное восстановление ОЗ' : `+${p.healAmount} ОЗ`}${p.restoreResources ? ' и ресурса' : ''} — ${cost} зм.</p>
         <p class="hint">ОЗ: ${engine.state.hp}/${engine.state.maxHp} · 💰 ${engine.state.gold} зм</p>
         <button type="button" class="choice" ${preview || engine.state.gold < cost ? 'disabled' : ''}
           ${preview ? '' : `onclick="SceneComponentHandlers.heal(${ctx.index})"`}>
           ✨ Принять лечение (${cost} зм)
         </button>`
      );
    }
  };

  SceneComponentRegistry.register('heal', HealComponent);
})();
