// Компонент: снятие проклятий
(function () {
  const CurseComponent = {
    defaultParams: {
      npc: 'priest',
      costBase: 50
    },

    render(engine, container, compDef, ctx) {
      const p = { ...this.defaultParams, ...(compDef.params || {}) };
      const preview = ctx.preview;
      const npc = SceneComponentBase.getNpcName(engine, p.npc, 'Священник');
      const entries = preview ? [] : (engine.getEquippedCursedEntries?.() || []);

      let list = '';
      if (!entries.length) {
        list = '<p class="hint">Нет надетых проклятых предметов.</p>';
      } else {
        entries.forEach((e) => {
          const afford = engine.state.gold >= e.cost;
          list += `<div class="curse-row">
            <span><b>${SceneComponentBase.escape(engine, e.item.name)}</b> — ${e.cost} зм</span>
            <button type="button" class="choice" ${!afford || preview ? 'disabled' : ''}
              ${preview ? '' : `onclick="SceneComponentHandlers.curseRemove(${ctx.index},'${SceneComponentBase.attr(engine, e.itemId)}')"`}>
              Снять проклятие
            </button>
          </div>`;
        });
      }

      container.innerHTML = SceneComponentBase.wrap(
        'curse_remove',
        `✨ ${SceneComponentBase.escape(engine, npc)}`,
        `${SceneComponentBase.previewNote(preview)}${list}`
      );

      if (!preview) {
        engine.state.templePriestSession = {
          sceneId: ctx.sceneId,
          exitScene: null,
          message: '',
          componentIndex: ctx.index
        };
      }
    }
  };

  SceneComponentRegistry.register('curse_remove', CurseComponent);
})();
