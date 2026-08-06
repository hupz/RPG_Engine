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
  const _hookedFns = new Map(); // method -> current hooked function
  const _before = new Map(); // method -> fn[]
  const _after = new Map();

  function list(map, name) {
    if (!map.has(name)) map.set(name, []);
    return map.get(name);
  }

  function ensureWrap(methodName) {
    // если метод уже обёрнут, но Editor.xxx подменили снаружи — переобернуть
    if (_wrapped.has(methodName)) {
      const hooked = _hookedFns.get(methodName);
      if (hooked && Editor[methodName] === hooked) return;
      _wrapped.delete(methodName);
    }
    const original = Editor[methodName];
    if (typeof original !== 'function') {
      // метод появится позже — мягкая обёртка-заглушка
      function hookedMissing(...args) {
        const befores = list(_before, methodName);
        let a = args;
        for (const fn of befores) {
          try {
            const out = fn.apply(this, a);
            if (Array.isArray(out)) a = out;
          } catch (e) { console.error('[Editor.hooks before]', methodName, e); }
        }
        let result;
        for (const fn of list(_after, methodName)) {
          try {
            const out = fn.apply(this, a);
            if (out !== undefined) result = out;
          } catch (e) { console.error('[Editor.hooks after]', methodName, e); }
        }
        return result;
      }
      Editor[methodName] = hookedMissing;
      _hookedFns.set(methodName, hookedMissing);
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
      let result = original.apply(this, a);
      const afters = list(_after, methodName);
      for (const fn of afters) {
        try {
          const out = fn.call(this, result, a);
          // after может вернуть новое значение (трансформация HTML и т.п.)
          if (out !== undefined) result = out;
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

    /** Пере-обернуть метод после Editor.foo = ... из другого модуля */
    rebind(methodName) {
      _wrapped.delete(methodName);
      ensureWrap(methodName);
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
