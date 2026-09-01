// ============================================================
// EditorHooks — стабильные расширения Editor без гонок load-order
// ============================================================
// CONTRACT (см. ARCHITECTURE.md → «Editor Extension / Hooks Contract»):
//
// 1) Первичное объявление API:
//      Editor.foo = function () { ... };   // OK, если метода ещё нет
//      Editor.hooks.register('mod', { foo() { ... } });
//
// 2) Расширение УЖЕ существующего API — ТОЛЬКО через hooks:
//      Editor.hooks.before('foo', fn)
//      Editor.hooks.after('foo', fn)
//      Editor.hooks.replace('foo', fn, 'module-id')
//    ЗАПРЕЩЕНО: Editor.foo = function () { ... }  (late monkey-patch)
//
// 3) ЗАПРЕЩЕНО оборачивать уже hooked метод:
//      const orig = Editor.foo.bind(Editor);
//      Editor.foo = function () { orig(); };  // → recursion risk
//
// 4) Цепочка:  call → hooks wrapper → _impl (original) → after hooks
//    _impl никогда не равен самому wrapper.
//
// 5) History / Visual / Help / Crafting — extensions через before/after,
//    не второй wrapper chain поверх hooks.
//
// Примеры:
//   Editor.hooks.register('editor-classes', { renderClasses(id) { ... } });
//   Editor.hooks.after('renderSceneEditor', function () { ... });
//   Editor.hooks.before('createScene', function (args) { return args; });
//   Editor.hooks.replace('renderSceneEditor', fn, 'editor-scene-builder');
//
// Отладка: Editor.hooks.listOwners() / getOwner(name)
// Regression: switchTab 1/click, renderAll 1/call, 0 recursion
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
  const _owners = new Map(); // method -> moduleId (string)
  const _impl = new Map(); // method -> current "original" implementation

  function list(map, name) {
    if (!map.has(name)) map.set(name, []);
    return map.get(name);
  }

  function isHookedWrapper(fn) {
    if (typeof fn !== 'function') return false;
    for (const w of _hookedFns.values()) {
      if (w === fn) return true;
    }
    return false;
  }

  function ensureWrap(methodName) {
    if (_wrapped.has(methodName)) {
      const hooked = _hookedFns.get(methodName);
      if (hooked && Editor[methodName] === hooked) return;
      // Editor[methodName] was reassigned outside hooks — adopt only if not a wrapper
      _wrapped.delete(methodName);
    }

    let original = Editor[methodName];
    // CRITICAL: never store the hooks wrapper as _impl (causes infinite recursion:
    // hooked → _impl(=hooked) → hooked → …)
    if (typeof original !== 'function' || isHookedWrapper(original)) {
      original = _impl.get(methodName);
    }
    if (typeof original !== 'function') {
      original = function hookedMissing() {
        /* no-op base until register/replace provides implementation */
      };
    }
    _impl.set(methodName, original);

    const hooked = function hooked(...args) {
      // Reentrancy guard for full UI rebuilds only
      if (methodName === 'renderAll' && Editor._isRendering) {
        return;
      }
      const _markRenderAll = methodName === 'renderAll';
      if (_markRenderAll) Editor._isRendering = true;
      try {
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
      let result;
      const impl = _impl.get(methodName);
      if (typeof impl === 'function') {
        try {
          result = impl.apply(this, a);
        } catch (e) {
          console.error('[Editor.hooks impl]', methodName, e);
          throw e;
        }
      }
      for (const fn of list(_after, methodName)) {
        try {
          const out = fn.call(this, result, a);
          if (out !== undefined) result = out;
        } catch (e) {
          console.error('[Editor.hooks after]', methodName, e);
        }
      }
      return result;
      } finally {
        if (_markRenderAll) Editor._isRendering = false;
      }
    };

    Editor[methodName] = hooked;
    _hookedFns.set(methodName, hooked);
    _wrapped.add(methodName);
  }

  Editor.hooks = {
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

    /**
     * Зарегистрировать API-методы модуля.
     * Не перезаписывает уже зарегистрированный метод другого владельца
     * (если только force: true).
     * @param {string} moduleId
     * @param {Record<string, Function>} methods
     * @param {{ force?: boolean }} [opts]
     */
    register(moduleId, methods, opts) {
      if (!methods || typeof methods !== 'object') return;
      const force = !!(opts && opts.force);
      const id = String(moduleId || 'unknown');
      for (const [name, fn] of Object.entries(methods)) {
        if (typeof fn !== 'function') continue;
        const prevOwner = _owners.get(name);
        if (prevOwner && prevOwner !== id && !force) {
          console.warn(
            `[Editor.hooks] register(${id}): "${name}" уже принадлежит "${prevOwner}". ` +
            `Используйте hooks.after/replace или force:true.`
          );
          continue;
        }
        // Never install the public hooks wrapper as _impl (→ infinite recursion).
        // Callers often pass Editor.foo after ensureWrap already ran.
        if (isHookedWrapper(fn)) {
          console.warn(
            `[Editor.hooks] register(${id}): "${name}" — передан hooks wrapper, ` +
            `оставлен текущий _impl. Передайте сырую реализацию или используйте replace.`
          );
          _owners.set(name, id);
          ensureWrap(name);
          continue;
        }
        const bound = fn.bind(Editor);
        _impl.set(name, bound);
        _owners.set(name, id);
        if (_wrapped.has(name)) {
          _wrapped.delete(name);
        }
        // Keep previous public wrapper until ensureWrap installs a fresh one
        ensureWrap(name);
        _impl.set(name, bound);
      }
    },

    /** Зарегистрировать один метод, если его ещё нет */
    define(methodName, fn, moduleId) {
      if (typeof fn !== 'function') return;
      if (typeof Editor[methodName] === 'function' && _owners.has(methodName)) {
        ensureWrap(methodName);
        return;
      }
      if (typeof Editor[methodName] !== 'function') {
        const bound = fn.bind(Editor);
        Editor[methodName] = bound;
        _impl.set(methodName, bound);
        if (moduleId) _owners.set(methodName, String(moduleId));
      }
      ensureWrap(methodName);
    },

    /**
     * Заменить implementation, сохранив before/after цепочку.
     * @param {string} methodName
     * @param {Function} fn
     * @param {string} [moduleId]
     */
    replace(methodName, fn, moduleId) {
      if (typeof fn !== 'function') return null;
      if (isHookedWrapper(fn)) {
        console.warn(`[Editor.hooks] replace(${methodName}): нельзя ставить hooks wrapper как impl`);
        return null;
      }
      // Prefer stored _impl; never treat the public hooks wrapper as the previous impl
      let prev = _impl.get(methodName);
      if (typeof prev !== 'function' || isHookedWrapper(prev)) {
        const cur = Editor[methodName];
        prev = (typeof cur === 'function' && !isHookedWrapper(cur)) ? cur : null;
      }
      if (isHookedWrapper(prev)) prev = null;
      const bound = fn.bind(Editor);
      // Guard: replacement must not equal prev identity in a way that loops via public API
      _impl.set(methodName, bound);
      if (moduleId) _owners.set(methodName, String(moduleId));
      if (_wrapped.has(methodName)) _wrapped.delete(methodName);
      // Keep Editor[methodName] as previous hooked or raw until ensureWrap swaps it
      ensureWrap(methodName);
      // Force _impl to the replacement (ensureWrap may have read a stale Editor[methodName])
      _impl.set(methodName, bound);
      return typeof prev === 'function' && prev !== bound ? prev : null;
    },

    /** Текущая реализация (не public wrapper). Для safe chaining в replace-патчах. */
    getImpl(methodName) {
      const impl = _impl.get(methodName);
      if (typeof impl === 'function' && !isHookedWrapper(impl)) return impl;
      return null;
    },

    rebind(methodName) {
      // If someone did Editor.foo = newFn outside hooks, pick it up as impl.
      // If Editor.foo is still the hooks wrapper, keep existing _impl and only re-wrap.
      const current = Editor[methodName];
      const hooked = _hookedFns.get(methodName);
      if (typeof current === 'function' && current !== hooked && !isHookedWrapper(current)) {
        _impl.set(methodName, current);
      }
      // If already correctly wrapped, nothing to do
      if (hooked && current === hooked && _wrapped.has(methodName)) {
        return;
      }
      _wrapped.delete(methodName);
      ensureWrap(methodName);
    },

    getOwner(methodName) {
      return _owners.get(methodName) || null;
    },

    listOwners() {
      const out = {};
      for (const [k, v] of _owners) out[k] = v;
      return out;
    },

    listWrapped() {
      return [..._wrapped];
    },

    /** Диагностика API */
    describe(methodName) {
      return {
        owner: _owners.get(methodName) || null,
        wrapped: _wrapped.has(methodName),
        hasImpl: typeof _impl.get(methodName) === 'function',
        before: list(_before, methodName).length,
        after: list(_after, methodName).length,
        typeofEditor: typeof Editor[methodName]
      };
    }
  };

  // Часто используемые точки расширения — заранее обернуть stubs
  [
    'renderSceneEditor', 'renderSceneList', 'renderAll', 'renderClasses',
    'renderClassDetail', 'renderNPCs', 'renderQuests', 'renderItems',
    'renderStoryGraphPanel', 'createScene', 'updateJSONPreview',
    'switchTab', 'selectScene', 'renderProgression', 'renderGlobalAbilityEditor'
  ].forEach((name) => {
    if (typeof Editor[name] === 'function') ensureWrap(name);
    else {
      // soft stub so after() can register before owner module loads
      Editor[name] = function () {};
      _impl.set(name, Editor[name]);
      ensureWrap(name);
    }
  });

  console.info('[Editor.hooks] ready');
})();
