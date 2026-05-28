// Компонент сцены: встроенный или полноэкранный мастер создания персонажа
(function () {
  const CharacterCreatorComponent = {
    defaultParams: {
      displayMode: 'embedded',
      preset: null,
      startingLevel: 1,
      pointBuy: true,
      rolledStats: false,
      onComplete: 'char_creation_complete',
      onCancel: 'char_creation_cancel',
      showCancel: true
    },

    render(engine, container, compDef, ctx) {
      const p = { ...this.defaultParams, ...(compDef.params || {}) };
      const preview = ctx.preview;

      container.innerHTML = SceneComponentBase.wrap(
        'character_creator',
        '🧝 Создание персонажа',
        preview
          ? '<p class="hint">В игре откроется мастер создания персонажа (встроенный или полноэкранный).</p>'
          : '<div class="cc-scene-host" id="cc-scene-host-' + ctx.index + '"></div>'
      );

      if (preview) return;

      const host = container.querySelector('.cc-scene-host');
      if (!host || !engine.CharacterCreator) {
        container.insertAdjacentHTML('beforeend', '<p class="hint">CharacterCreator не загружен.</p>');
        return;
      }

      engine.state.inCharacterCreation = true;
      const mode = p.displayMode || 'embedded';

      if (mode === 'fullscreen' || mode === 'modal') {
        engine.CharacterCreator.openFullscreen({
          config: p,
          sceneId: ctx.sceneId,
          onComplete: p.onComplete,
          onCancel: p.onCancel
        });
        return;
      }

      engine.CharacterCreator.mount(host, {
        ...p,
        sceneId: ctx.sceneId,
        componentIndex: ctx.index
      });
    },

    unmount(engine, compDef, ctx) {
      engine.CharacterCreator?.unmount?.();
      delete engine.state.inCharacterCreation;
    }
  };

  SceneComponentRegistry.register('character_creator', CharacterCreatorComponent);

  if (typeof GameEngine !== 'undefined' && GameEngine.renderComponentSceneExit) {
    const origExit = GameEngine.renderComponentSceneExit.bind(GameEngine);
    GameEngine.renderComponentSceneExit = function (sceneId, scene) {
      const raw = this.data?.scenes?.[sceneId];
      if (scene?.skipStandardExit || raw?.skipStandardExit) {
        this.setChoices([]);
        return;
      }
      return origExit(sceneId, scene);
    };
  }
})();
