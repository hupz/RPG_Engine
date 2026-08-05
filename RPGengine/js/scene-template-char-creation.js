// Шаблон сцены «Создание персонажа» + регистрация в SceneTemplateEngine
(function () {
  const DEFAULT_INTRO =
    'Перед вами чистый лист судьбы. Выберите происхождение, класс и навыки — ' +
    'от этого зависит, как сложится ваше приключение.';

  const SceneTemplate = {
    charCreation: {
      id: 'char_creation',
      templateName: 'character_creation',
      category: 'special',
      system: 'any',
      icon: '🧝',
      label: 'Создание персонажа',

      create(config) {
        const cfg = config || {};
        const sceneId = cfg.id || cfg.sceneId || 'char_creation';
        const nextScene = cfg.nextScene || cfg.exit || 'start';
        const music = cfg.music || cfg.audio || null;

        return {
          id: sceneId,
          location: cfg.name || cfg.location || 'Создание персонажа',
          title: 'Создание персонажа',
          text: cfg.introText || DEFAULT_INTRO,
          special: 'character_creation',
          sceneTemplate: 'character_creation',
          templateParams: { ...cfg, nextScene },
          templateDetached: false,
          skipStandardExit: true,
          exitScene: nextScene,
          audio: music ? (typeof music === 'string' ? { ambient: music, loop: true } : music) : undefined,
          components: [
            {
              component: 'character_creator',
              params: {
                displayMode: cfg.displayMode || 'embedded',
                preset: cfg.preset || null,
                startingLevel: cfg.startingLevel || 1,
                pointBuy: cfg.pointBuy !== false,
                rolledStats: !!cfg.rolledStats,
                onComplete: cfg.onComplete || 'char_creation_complete',
                onCancel: cfg.onCancel || 'char_creation_cancel',
                showCancel: cfg.showCancel !== false
              }
            }
          ],
          onEnter: [
            { action: 'apply_scene_visibility', visibility: { sidebar: false, combat: false, dock: false, log: false } },
            { action: 'hide_sidebar' },
            { action: 'hide_combat_ui' },
            { action: 'hide_dock' },
            { action: 'push_state', state: { inCharacterCreation: true } },
            ...(music ? [{ action: 'play_music', track: music, fadeIn: cfg.fadeIn ?? 2000 }] : [])
          ],
          onExit: [
            { action: 'show_sidebar' },
            { action: 'show_dock' },
            { action: 'pop_state', keys: ['inCharacterCreation'] },
            { action: 'apply_scene_visibility', visibility: { sidebar: true, dock: true, log: true } },
            { action: 'stop_music', fadeOut: cfg.fadeOut ?? 1000 }
          ],
          handlers: {
            char_creation_complete: [
              { action: 'set_character', source: 'component.output.draft' },
              { action: 'run_script', script: 'syncCharacterToUI' },
              { action: 'save_game', slot: 'auto' },
              { action: 'transition', target: nextScene }
            ],
            char_creation_cancel: [
              {
                action: 'confirm',
                message: 'Прогресс будет потерян. Вернуться к выбору кампании?',
                onConfirm: [{ action: 'return_to_campaign_picker' }],
                onCancel: [{ action: 'resume_character_creation' }]
              }
            ]
          },
          visibility: {
            sidebar: false,
            combat: false,
            dock: false,
            log: false
          }
        };
      }
    }
  };

  function registerTemplate() {
    if (typeof SceneTemplateEngine === 'undefined') return;

    SceneTemplateEngine.BASE_TEMPLATES.character_creation = {
      id: 'character_creation',
      icon: '🧝',
      label: 'Создание персонажа',
      special: 'character_creation',
      fields: ['id', 'introText', 'nextScene', 'music', 'displayMode', 'preset']
    };

    if (!SceneTemplateEngine._generateScenePatched) {
      SceneTemplateEngine._generateScenePatched = true;
      const baseGen = SceneTemplateEngine.generateSceneFromTemplate;
      SceneTemplateEngine.generateSceneFromTemplate = function (data, spec) {
        const tpl = spec?.template || spec?.sceneTemplate;
        if (tpl === 'character_creation') {
          const cfg = {
            ...(spec.params || {}),
            id: spec.id || spec.params?.id,
            name: spec.name,
            introText: spec.introText,
            nextScene: spec.nextScene,
            overrides: spec.overrides
          };
          let scene = SceneTemplate.charCreation.create(cfg);
          if (spec.overrides && SceneTemplateEngine.applyOverrides) {
            scene = SceneTemplateEngine.applyOverrides(scene, spec.overrides, data);
          }
          return scene;
        }
        return baseGen.call(this, data, spec);
      };
    }
  }

  function registerSceneTemplatesAlias() {
    const reg = {
      register(id, factory) {
        if (id === 'character_creation') {
          SceneTemplate.charCreation.create = factory.create || factory;
        }
      }
    };
    window.SceneTemplates = window.SceneTemplates || reg;
    reg.register('character_creation', SceneTemplate.charCreation);
  }

  registerTemplate();
  registerSceneTemplatesAlias();

  if (typeof window !== 'undefined') {
    window.SceneTemplate = SceneTemplate;
  }
})();
