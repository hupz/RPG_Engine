// ============================================
// Компонентная архитектура сцен
// ============================================

const SceneComponentRegistry = (function () {
  const _types = {};

  const COMPONENT_META = {
    dialogue_tree: { label: 'Диалог', icon: '💬' },
    trade_interface: { label: 'Торговля', icon: '💰' },
    service_menu: { label: 'Меню услуг', icon: '📋' },
    interactive_panel: { label: 'Кнопка (цепочка)', icon: '🔘' },
    character_creator: { label: 'Создание персонажа', icon: '🧝' }
  };

  function register(type, renderer) {
    _types[type] = renderer;
  }

  function get(type) {
    return _types[type] || null;
  }

  function listTypes() {
    return Object.keys(COMPONENT_META).filter((t) => t !== 'enhance');
  }

  function getMeta(type) {
    return COMPONENT_META[type] || { label: type, icon: '📦' };
  }

  function defaultParams(type) {
    const r = get(type);
    return r?.defaultParams ? { ...r.defaultParams } : {};
  }

  function bindGameEngine() {
    if (typeof GameEngine === 'undefined') return;

    GameEngine.hasSceneComponents = function (scene) {
      return Array.isArray(scene?.components) && scene.components.length > 0;
    };

    GameEngine.clearSceneComponentsArea = function () {
      const area = document.getElementById('scene-components-area');
      if (area) {
        area.innerHTML = '';
        area.classList.add('hidden');
      }
    };

    GameEngine.renderSceneComponents = function (sceneId, scene, options = {}) {
      const area = document.getElementById('scene-components-area');
      if (!area) return;
      area.innerHTML = '';
      area.classList.remove('hidden');

      let list = scene?.components || [];
      if (typeof SceneComponentNormalize !== 'undefined') {
        list = SceneComponentNormalize.normalizeList(list);
      }
      this.state.componentScene = {
        sceneId,
        preview: !!options.preview,
        activeIndex: null
      };

      list.forEach((comp, index) => {
        if (!SceneComponentBase.isVisible(this, comp)) return;
        const type = comp.component || comp.type;
        const renderer = get(type);
        if (!renderer) {
          const wrap = document.createElement('div');
          wrap.className = 'scene-component-unknown';
          wrap.innerHTML = `<p class="hint">Неизвестный компонент: ${SceneComponentBase.escape(this, type)}</p>`;
          area.appendChild(wrap);
          return;
        }
        const wrap = document.createElement('div');
        wrap.className = `scene-component scene-component--${type}`;
        wrap.dataset.componentIndex = String(index);
        area.appendChild(wrap);
        try {
          renderer.render(this, wrap, comp, {
            sceneId,
            index,
            preview: !!options.preview,
            scene
          });
        } catch (e) {
          console.error('[SceneComponent]', type, e);
          wrap.innerHTML = `<p class="hint">Ошибка компонента ${type}</p>`;
        }
      });

      if (!options.preview) {
        this.renderComponentSceneExit(sceneId, scene);
      }
      this.saveGame?.();
    };

    GameEngine.renderComponentSceneExit = function (sceneId, scene) {
      const raw = this.data?.scenes?.[sceneId];
      const exit = scene?.exit || scene?.exitScene || raw?.exitScene || 'village_hub';
      const choices = [];
      if (exit) {
        choices.push({ text: '🚪 Уйти', to: exit, icon: '🚪' });
      }
      const hubBtn = this.buildHubReturnChoice?.(raw);
      if (hubBtn && (!exit || hubBtn.to !== exit)) choices.push(hubBtn);
      this.setChoices(choices);
    };

    GameEngine.refreshSceneComponents = function () {
      const sid = this.state.scene;
      if (!sid) return;
      const scene = this.getProcessedScene?.(sid) || this.data?.scenes?.[sid];
      if (this.hasSceneComponents(scene)) {
        this.renderSceneComponents(sid, scene, { preview: this.state.componentScene?.preview });
      }
    };
  }

  bindGameEngine();
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', bindGameEngine);
  }

  return {
    register,
    get,
    listTypes,
    getMeta,
    defaultParams,
    COMPONENT_META
  };
})();

if (typeof window !== 'undefined') {
  window.SceneComponentRegistry = SceneComponentRegistry;
}
