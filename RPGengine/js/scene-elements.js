// Scene Elements: модель данных, миграция legacy-полей, синхронизация

const SCENE_ELEMENT_TYPES = [
  'skill_check',
  'combat',
  'give_item',
  'remove_item',
  'set_flag',
  'quest_start',
  'quest_complete',
  'add_status',
  'remove_status',
  'achievement',
  'service_menu',
  'music',
  'image',
  'custom_action',
  'show_choices',
  'show_text',
  'change_scene',
  'award_exp',
  'award_gold'
];

const SCENE_ELEMENT_META = {
  skill_check: { label: 'Проверка навыка', icon: '🎲', blocking: true },
  combat: { label: 'Бой', icon: '⚔️', blocking: true },
  give_item: { label: 'Выдать предмет', icon: '📦', blocking: false },
  remove_item: { label: 'Забрать предмет', icon: '📤', blocking: false },
  set_flag: { label: 'Изменить флаг', icon: '🏴', blocking: false },
  quest_start: { label: 'Запустить квест', icon: '📜', blocking: false },
  quest_complete: { label: 'Завершить квест', icon: '✅', blocking: false },
  add_status: { label: 'Наложить статус', icon: '☠️', blocking: false },
  remove_status: { label: 'Снять статус', icon: '💫', blocking: false },
  achievement: { label: 'Достижение', icon: '🏆', blocking: false },
  service_menu: { label: 'Сервисное меню', icon: '🛎️', blocking: true },
  music: { label: 'Музыка', icon: '🔊', blocking: false },
  image: { label: 'Изображение', icon: '🖼️', blocking: false },
  custom_action: { label: 'Действие / цепочка', icon: '⚡', blocking: false },
  show_choices: { label: 'Показать выборы', icon: '🔀', blocking: true },
  show_text: { label: 'Текст (блок)', icon: '📝', blocking: false },
  change_scene: { label: 'Переход на сцену', icon: '➡️', blocking: true },
  award_exp: { label: 'Опыт за сцену', icon: '⭐', blocking: false },
  award_gold: { label: 'Золото', icon: '💰', blocking: false }
};

const SceneElements = {
  TYPES: SCENE_ELEMENT_TYPES,
  META: SCENE_ELEMENT_META,

  genElementId(prefix) {
    const p = prefix || 'el';
    return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  },

  ensureArrays(scene) {
    if (!scene) return scene;
    if (!Array.isArray(scene.elements)) scene.elements = [];
    if (!Array.isArray(scene.onEnterElements)) scene.onEnterElements = [];
    return scene;
  },

  defaultData(type) {
    switch (type) {
      case 'skill_check':
        return { skill: 'perception', dc: 12, successText: '', failText: '', successNext: '', failNext: '' };
      case 'combat':
        return { enemies: [], nextScene: '' };
      case 'give_item':
        return { itemId: '', count: 1 };
      case 'remove_item':
        return { itemId: '', count: 1 };
      case 'set_flag':
        return { key: '', value: true };
      case 'quest_start':
        return { questId: '', stage: '0' };
      case 'quest_complete':
        return { questId: '', stage: 'complete' };
      case 'add_status':
        return { effect: 'poisoned', duration: 3, target: 'self' };
      case 'remove_status':
        return { effect: 'poisoned', target: 'self' };
      case 'achievement':
        return { achievementId: '' };
      case 'service_menu':
        return { component: 'service_menu', id: 'service_menu', enabled: true, params: { services: [] } };
      case 'music':
        return { ambient: '', sfxOnEnter: '', volume: 0.7, loop: true };
      case 'image':
        return { src: '', caption: '' };
      case 'custom_action':
        return { action: '', params: {}, chainId: '' };
      case 'show_choices':
        return {};
      case 'show_text':
        return { text: '' };
      case 'change_scene':
        return { sceneId: '' };
      case 'award_exp':
        return { amount: 10 };
      case 'award_gold':
        return { amount: 0 };
      default:
        return {};
    }
  },

  createElement(type, data, opts) {
    const t = SCENE_ELEMENT_TYPES.includes(type) ? type : 'custom_action';
    return {
      id: this.genElementId(t),
      type: t,
      data: { ...this.defaultData(t), ...(data || {}) },
      enabled: opts?.enabled !== false,
      firstVisitOnly: !!opts?.firstVisitOnly
    };
  },

  hasLegacyFields(scene) {
    if (!scene) return false;
    if (scene.combat?.length) return true;
    if (scene.flags && Object.keys(scene.flags).length) return true;
    if (scene.items?.length) return true;
    if (scene.gold) return true;
    if (scene.exp) return true;
    if (scene.audio != null && scene.audio !== '') return true;
    if (scene.onEnter?.length) return true;
    if (scene.choices?.length) return true;
    const sm = (scene.components || []).some((c) => (c.component || c.type) === 'service_menu');
    return sm;
  },

  needsMigration(scene) {
    if (!scene) return false;
    if (scene._sceneElementsMigrated) return false;
    this.ensureArrays(scene);
    if (scene.elements.length > 0 || scene.onEnterElements.length > 0) {
      scene._sceneElementsMigrated = true;
      return false;
    }
    return this.hasLegacyFields(scene);
  },

  parseAudioForElement(audio) {
    if (audio == null || audio === '') return null;
    if (typeof audio === 'string') return { ambient: audio, loop: true, volume: 0.7 };
    return {
      ambient: audio.ambient || audio.id || audio.track || audio.play || '',
      sfxOnEnter: audio.sfxOnEnter || audio.sfx || '',
      volume: audio.volume != null ? audio.volume : 0.7,
      loop: audio.loop !== false
    };
  },

  migrateLegacyScene(scene) {
    if (!scene) return scene;
    this.ensureArrays(scene);
    if (!this.needsMigration(scene)) return scene;

    const elements = [];
    const onEnterElements = [];

    const audioData = this.parseAudioForElement(scene.audio);
    if (audioData && (audioData.ambient || audioData.sfxOnEnter)) {
      onEnterElements.push(this.createElement('music', audioData, { firstVisitOnly: false }));
    }

    if (Array.isArray(scene.onEnter)) {
      scene.onEnter.forEach((step) => {
        if (!step) return;
        onEnterElements.push(this.createElement('custom_action', {
          action: step.action || '',
          params: step.params || {},
          chainId: step.chain || step.chainId || ''
        }, { firstVisitOnly: false }));
      });
    }

    if (scene.flags) {
      Object.entries(scene.flags).forEach(([key, value]) => {
        elements.push(this.createElement('set_flag', { key, value }, { firstVisitOnly: true }));
      });
    }

    if (scene.items?.length) {
      scene.items.forEach((itemId) => {
        elements.push(this.createElement('give_item', { itemId, count: 1 }, { firstVisitOnly: true }));
      });
    }

    if (scene.gold) {
      elements.push(this.createElement('award_gold', { amount: scene.gold }, { firstVisitOnly: true }));
    }

    if (scene.exp) {
      elements.push(this.createElement('award_exp', { amount: scene.exp }, { firstVisitOnly: true }));
    }

    if (scene.combat?.length) {
      elements.push(this.createElement('combat', {
        enemies: [...scene.combat],
        nextScene: scene.nextScene || ''
      }, { firstVisitOnly: false }));
      if (scene.nextScene) {
        elements.push(this.createElement('change_scene', { sceneId: scene.nextScene }));
      }
    }

    (scene.components || []).forEach((comp) => {
      const ctype = comp.component || comp.type;
      if (ctype === 'service_menu') {
        elements.push(this.createElement('service_menu', {
          component: 'service_menu',
          id: comp.id || 'service_menu',
          enabled: comp.enabled !== false,
          params: comp.params || { services: [] }
        }));
      }
    });

    if (scene.choices?.length && !scene.combat?.length) {
      elements.push(this.createElement('show_choices', {}));
    }

    scene.onEnterElements = onEnterElements;
    scene.elements = elements;
    scene._sceneElementsMigrated = true;
    return scene;
  },

  migrateAllScenes(data) {
    if (!data?.scenes) return data;
    Object.values(data.scenes).forEach((s) => this.migrateLegacyScene(s));
    return data;
  },

  ensureMigrated(scene) {
    return this.migrateLegacyScene(scene);
  },

  syncElementsToLegacy(scene) {
    if (!scene) return scene;
    this.ensureArrays(scene);

    const flags = {};
    const items = [];
    let gold = 0;
    let exp = null;
    let combat = null;
    let nextScene = scene.nextScene || '';
    const components = (scene.components || []).filter((c) => {
      const t = c.component || c.type;
      return t !== 'service_menu';
    });
    let audio = null;

    const allEls = [...(scene.onEnterElements || []), ...(scene.elements || [])];

    allEls.forEach((el) => {
      if (el.enabled === false) return;
      const d = el.data || {};
      switch (el.type) {
        case 'set_flag':
          if (d.key) flags[d.key] = d.value;
          break;
        case 'give_item':
          if (d.itemId) {
            const n = Math.max(1, parseInt(d.count, 10) || 1);
            for (let i = 0; i < n; i++) items.push(d.itemId);
          }
          break;
        case 'award_gold':
          gold += Math.max(0, parseInt(d.amount, 10) || 0);
          break;
        case 'award_exp':
          exp = Math.max(0, parseInt(d.amount, 10) || 0);
          break;
        case 'combat':
          if (d.enemies?.length) {
            combat = [...d.enemies];
            if (d.nextScene) nextScene = d.nextScene;
          }
          break;
        case 'music':
          if (d.ambient || d.sfxOnEnter) {
            audio = {
              ambient: d.ambient || '',
              sfxOnEnter: d.sfxOnEnter || '',
              volume: d.volume != null ? d.volume : 0.7,
              loop: d.loop !== false
            };
          }
          break;
        case 'service_menu':
          components.push({
            component: 'service_menu',
            id: d.id || 'service_menu',
            enabled: d.enabled !== false,
            params: d.params || { services: [] }
          });
          break;
        default:
          break;
      }
    });

    if (Object.keys(flags).length) scene.flags = flags;
    else if (scene.flags) delete scene.flags;

    if (items.length) scene.items = items;
    else if (scene.items) delete scene.items;

    if (gold) scene.gold = gold;
    else if (scene.gold) delete scene.gold;

    if (exp != null) scene.exp = exp;
    else if (scene.exp) delete scene.exp;

    if (combat?.length) {
      scene.combat = combat;
      scene.nextScene = nextScene;
    } else if (scene.combat) {
      delete scene.combat;
    }

    if (audio) scene.audio = audio;
    else if (scene.audio && allEls.some((e) => e.type === 'music')) {
      delete scene.audio;
    }

    scene.components = components;
    return scene;
  },

  syncAllScenes(data) {
    if (!data?.scenes) return data;
    Object.values(data.scenes).forEach((s) => this.syncElementsToLegacy(s));
    return data;
  },

  getList(scene, listKey) {
    this.ensureArrays(scene);
    return listKey === 'onEnter' ? scene.onEnterElements : scene.elements;
  },

  findElement(scene, elementId) {
    this.ensureArrays(scene);
    return scene.onEnterElements.find((e) => e.id === elementId)
      || scene.elements.find((e) => e.id === elementId)
      || null;
  },

  findElementListKey(scene, elementId) {
    if (scene.onEnterElements?.some((e) => e.id === elementId)) return 'onEnter';
    if (scene.elements?.some((e) => e.id === elementId)) return 'main';
    return null;
  }
};

if (typeof window !== 'undefined') {
  window.SceneElements = SceneElements;
  window.SCENE_ELEMENT_TYPES = SCENE_ELEMENT_TYPES;
  window.SCENE_ELEMENT_META = SCENE_ELEMENT_META;
}
