/* editor-core bundle generated 2026-08-06T13:51:02.342Z */

;/* —— js/data-schema.js —— */
// ============================================================
// Project data schema version + единая миграция при загрузке
// ============================================================
(function (global) {
  const DATA_VERSION = 3;

  /**
   * Нормализация ability.effect: string → object
   */
  function normalizeAbilityEffect(effect) {
    if (effect == null) return { type: 'damage', value: '1d6', damageType: 'physical' };
    if (typeof effect === 'object' && effect.type) return effect;
    if (typeof effect !== 'string') return { type: 'custom', desc: String(effect) };
    const s = effect.trim();
    if (s.startsWith('heal:')) return { type: 'heal', value: s.slice(5), targeting: { scope: 'self' } };
    if (s.startsWith('damage:')) return { type: 'damage', value: s.slice(7), damageType: 'physical' };
    if (s === 'extra_attack') return { type: 'extra_attack' };
    if (s.startsWith('ac_bonus:')) return { type: 'buff', buffType: 'ac', value: parseInt(s.slice(9), 10) || 2, targeting: { scope: 'self' } };
    if (s === 'magic_missile') return { type: 'magic_missile' };
    if (s.startsWith('aoe_fire:')) {
      return { type: 'damage', value: s.slice(9), damageType: 'fire', targeting: { scope: 'all_enemies' } };
    }
    if (s.startsWith('smite:')) return { type: 'smite', value: s.slice(6) };
    return { type: 'custom', desc: s };
  }

  function migrateAbilitiesInClass(cls) {
    if (!cls || !Array.isArray(cls.abilities)) return;
    cls.abilities.forEach((ab) => {
      if (!ab) return;
      if (typeof ab.effect === 'string' || (ab.effect && !ab.effect.type && !Array.isArray(ab.effects))) {
        ab.effect = normalizeAbilityEffect(ab.effect);
      }
    });
  }

  function migrateScenes(data) {
    Object.values(data.scenes || {}).forEach((sc) => {
      if (!sc || typeof sc !== 'object') return;
      if (!Array.isArray(sc.editorModules) && (sc.text || sc.choices || sc.combat)) {
        // не форсируем editorModules — редактор выводит сам
      }
      // audio string → object
      if (typeof sc.audio === 'string') {
        sc.audio = { ambient: sc.audio, loop: true, volume: 0.7 };
      }
    });
  }

  function migrateQuests(data) {
    if (typeof QuestMigrate !== 'undefined' && typeof QuestMigrate.migrateAll === 'function') {
      QuestMigrate.migrateAll(data);
      return;
    }
    if (typeof QuestMigrate !== 'undefined' && typeof QuestMigrate.normalizeAll === 'function') {
      QuestMigrate.normalizeAll(data);
    }
  }

  /**
   * Единая точка: data → актуальная схема.
   * Идемпотентна: повторный вызов безопасен.
   */
  function migrateProjectData(data) {
    if (!data || typeof data !== 'object') return data;
    if (!data.meta) data.meta = {};

    const from = parseInt(data.meta.dataVersion, 10) || 0;

    // v0/v1/v2 → v3
    if (from < 3) {
      migrateScenes(data);
      migrateQuests(data);
      Object.values(data.classes || {}).forEach(migrateAbilitiesInClass);
      if (data.progression?.abilities) {
        Object.values(data.progression.abilities).forEach((ab) => {
          if (ab && (typeof ab.effect === 'string' || (ab.effect && !ab.effect.type))) {
            ab.effect = normalizeAbilityEffect(ab.effect);
          }
        });
      }
      if (!data.meta.storyGraph) data.meta.storyGraph = { positions: {} };
    }

    data.meta.dataVersion = DATA_VERSION;
    if (!data.meta.version) data.meta.version = '1.0';
    return data;
  }

  function getDataVersion(data) {
    return parseInt(data?.meta?.dataVersion, 10) || 0;
  }

  global.ProjectDataSchema = {
    DATA_VERSION,
    migrateProjectData,
    normalizeAbilityEffect,
    getDataVersion
  };

  // Авто-хук GameEngine при наличии
  if (typeof global.GameEngine !== 'undefined') {
    // no-op: подключение через save-load / data load
  }
})(typeof window !== 'undefined' ? window : globalThis);


;/* —— js/editor/editor-hooks.js —— */
// ============================================================
// EditorHooks — стабильные расширения без «перезаписи последним скриптом»
// ============================================================
// Использование:
//   Editor.hooks.after('renderSceneEditor', function () { ... });
//   Editor.hooks.before('createScene', function (args) { ... return args; });
//   Editor.hooks.once('renderAll', fn);
// Методы оборачиваются один раз; несколько after-колбэков вызываются по порядку.
// ============================================================
(function attachEditorHooks() {
  if (typeof Editor === 'undefined') {
    console.warn('editor-hooks.js: Editor ещё не определён — подключите после const Editor');
    return;
  }

  const _wrapped = new Set();
  const _before = new Map(); // method -> fn[]
  const _after = new Map();

  function list(map, name) {
    if (!map.has(name)) map.set(name, []);
    return map.get(name);
  }

  function ensureWrap(methodName) {
    if (_wrapped.has(methodName)) return;
    const original = Editor[methodName];
    if (typeof original !== 'function') {
      // метод появится позже — мягкая обёртка-заглушка
      Editor[methodName] = function (...args) {
        const befores = list(_before, methodName);
        let a = args;
        for (const fn of befores) {
          const out = fn.apply(this, a);
          if (Array.isArray(out)) a = out;
        }
        const afters = list(_after, methodName);
        let result;
        afters.forEach((fn) => {
          try { result = fn.apply(this, a); } catch (e) { console.error('[Editor.hooks]', methodName, e); }
        });
        return result;
      };
      _wrapped.add(methodName);
      return;
    }

    Editor[methodName] = function hooked(...args) {
      const befores = list(_before, methodName);
      let a = args;
      for (const fn of befores) {
        try {
          const out = fn.apply(this, a);
          if (Array.isArray(out)) a = out;
        } catch (e) {
          console.error('[Editor.hooks before]', methodName, e);
        }
      }
      const result = original.apply(this, a);
      const afters = list(_after, methodName);
      for (const fn of afters) {
        try {
          fn.call(this, result, a);
        } catch (e) {
          console.error('[Editor.hooks after]', methodName, e);
        }
      }
      return result;
    };
    _wrapped.add(methodName);
  }

  Editor.hooks = {
    /** Вызвать до оригинала. fn(...args) может вернуть новый массив args */
    before(methodName, fn) {
      if (typeof fn !== 'function') return () => {};
      ensureWrap(methodName);
      list(_before, methodName).push(fn);
      return () => {
        const arr = list(_before, methodName);
        const i = arr.indexOf(fn);
        if (i >= 0) arr.splice(i, 1);
      };
    },

    /** Вызвать после оригинала. fn(result, args) */
    after(methodName, fn) {
      if (typeof fn !== 'function') return () => {};
      ensureWrap(methodName);
      list(_after, methodName).push(fn);
      return () => {
        const arr = list(_after, methodName);
        const i = arr.indexOf(fn);
        if (i >= 0) arr.splice(i, 1);
      };
    },

    once(methodName, fn) {
      const off = this.after(methodName, function (result, args) {
        off();
        return fn.call(this, result, args);
      });
      return off;
    },

    /** Зарегистрировать метод, если его ещё нет, и сразу обернуть */
    define(methodName, fn) {
      if (typeof Editor[methodName] !== 'function') {
        Editor[methodName] = fn.bind(Editor);
      }
      ensureWrap(methodName);
    },

    /** Список обёрнутых методов (отладка) */
    listWrapped() {
      return [..._wrapped];
    },

    /**
     * Безопасная подмена «как раньше», но с сохранением цепочки hooks.
     * Предпочтительно: hooks.after. Этот метод — для миграции старых модулей.
     */
    replace(methodName, fn) {
      const prev = Editor[methodName];
      Editor[methodName] = function (...args) {
        return fn.apply(this, args);
      };
      // если уже были hooks — они потеряны на prev; пере-оборачиваем
      if (_wrapped.has(methodName)) {
        _wrapped.delete(methodName);
      }
      ensureWrap(methodName);
      // восстановить: original становится fn, before/after остаются
      // ensureWrap захватил fn как original — OK
      return prev;
    }
  };

  // Часто используемые точки расширения — заранее
  [
    'renderSceneEditor', 'renderSceneList', 'renderAll', 'renderClasses',
    'renderNPCs', 'renderQuests', 'renderStoryGraphPanel', 'createScene',
    'updateJSONPreview', 'switchTab', 'selectScene'
  ].forEach((name) => {
    if (typeof Editor[name] === 'function') ensureWrap(name);
  });

  console.info('[Editor.hooks] ready');
})();


;/* —— js/editor/editor-utils.js —— */
// ============================================================
// Editor utils (вынесено из editor.html) — escape, icons
// Подключать ПОСЛЕ const Editor = {...} базового объекта
// или ДО — тогда допишет прототип при наличии.
// ============================================================
(function attachEditorUtils() {
  if (typeof Editor === 'undefined') {
    console.warn('editor-utils.js: Editor не определён');
    return;
  }

  // Не перетираем, если уже есть в editor.html
  if (typeof Editor.escapeHtml !== 'function') {
    Editor.escapeHtml = function (str) {
      return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    };
  }
  if (typeof Editor.escapeAttr !== 'function') {
    Editor.escapeAttr = function (str) {
      return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    };
  }
  if (typeof Editor.escapeTextarea !== 'function') {
    Editor.escapeTextarea = function (str) {
      return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    };
  }

  Editor.ARCH = Editor.ARCH || {
    hooks: true,
    dataVersion: typeof ProjectDataSchema !== 'undefined' ? ProjectDataSchema.DATA_VERSION : null,
    note: 'Prefer Editor.hooks.after/before instead of replacing Editor methods'
  };
})();


;/* —— js/editor/editor-data-load.js —— */
// ============================================================
// Editor: единая загрузка/нормализация project data
// ============================================================
(function attachEditorDataLoad() {
  if (typeof Editor === 'undefined') return;

  Editor.migrateProjectData = function (data) {
    if (typeof ProjectDataSchema !== 'undefined') {
      return ProjectDataSchema.migrateProjectData(data);
    }
    return data;
  };

  Editor.setProjectData = function (data, opts) {
    const o = opts || {};
    this.data = this.migrateProjectData(data);
    if (o.render !== false) {
      if (typeof this.renderAll === 'function') this.renderAll();
      else {
        this.renderSceneList?.();
        this.renderSceneEditor?.();
      }
    }
    if (o.preview !== false) this.updateJSONPreview?.();
    return this.data;
  };

  // Обёртка через hooks, если уже есть методы загрузки
  const patch = (name) => {
    if (typeof Editor[name] !== 'function') return;
    if (Editor.hooks?.after) {
      Editor.hooks.after(name, function () {
        if (this.data && typeof ProjectDataSchema !== 'undefined') {
          const v = ProjectDataSchema.getDataVersion(this.data);
          if (v < ProjectDataSchema.DATA_VERSION) {
            this.data = ProjectDataSchema.migrateProjectData(this.data);
          }
        }
      });
    }
  };
  ['confirmNewProject', 'finishCampaignWizard', 'renderAll'].forEach(patch);

  // Перехват типичной загрузки файла (editor-export / import)
  if (typeof Editor.loadDataObject === 'function') {
    const orig = Editor.loadDataObject.bind(Editor);
    Editor.loadDataObject = function (obj) {
      return orig(this.migrateProjectData(obj));
    };
  }
})();

