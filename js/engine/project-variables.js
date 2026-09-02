/**
 * Переменные проекта в рантайме: инициализация, save/load, чтение/запись.
 * Каталог — data.variables (ProjectSchema.ensureProjectVariables).
 */
(function attachRuntimeVariables(global) {
  'use strict';

  function getCatalog(data) {
    if (!data || typeof data !== 'object') return {};
    const bag = data.variables;
    return bag && typeof bag === 'object' ? bag : {};
  }

  function getDefaultValue(entry) {
    if (entry == null) return undefined;
    if (typeof entry === 'string') return false;
    if (typeof entry !== 'object') return false;
    if (entry.defaultValue !== undefined) return entry.defaultValue;
    if (entry.default !== undefined) return entry.default;
    return undefined;
  }

  function catalogFromCtx(ctx) {
    if (ctx?.projectVariables && typeof ctx.projectVariables === 'object') {
      return ctx.projectVariables;
    }
    if (ctx?.variableCatalog && typeof ctx.variableCatalog === 'object') {
      return ctx.variableCatalog;
    }
    return getCatalog(ctx?.engine?.data);
  }

  function isCatalogVariable(name, ctx) {
    if (!name) return false;
    return Object.prototype.hasOwnProperty.call(catalogFromCtx(ctx), name);
  }

  function initFromCatalog(engine) {
    if (!engine?.state) return;
    if (!engine.state.variables || typeof engine.state.variables !== 'object') {
      engine.state.variables = {};
    }
    Object.entries(getCatalog(engine.data)).forEach(([id, entry]) => {
      if (!Object.prototype.hasOwnProperty.call(engine.state.variables, id)) {
        const dv = getDefaultValue(entry);
        engine.state.variables[id] = dv !== undefined ? dv : false;
      }
    });
  }

  function applyFromSave(engine, saved) {
    if (!engine?.state) return;
    engine.state.variables = saved && typeof saved === 'object' ? { ...saved } : {};
    initFromCatalog(engine);
  }

  function resolveValue(name, ctx) {
    if (!name) return undefined;
    const flags = ctx?.flags || {};
    if (Object.prototype.hasOwnProperty.call(flags, name)) {
      return flags[name];
    }
    if (!isCatalogVariable(name, ctx)) {
      return flags[name];
    }
    const variables = ctx?.variables || {};
    if (Object.prototype.hasOwnProperty.call(variables, name)) {
      return variables[name];
    }
    const dv = getDefaultValue(catalogFromCtx(ctx)[name]);
    if (dv !== undefined) return dv;
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn('[RuntimeVariables] Переменная «' + name + '»: нет значения и defaultValue — считается false');
    }
    return false;
  }

  function coerceActionValue(raw, current) {
    if (raw === 'toggle') return !current;
    if (raw === true || raw === 'true') return true;
    if (raw === false || raw === 'false') return false;
    return raw !== undefined ? raw : true;
  }

  function setValue(engine, variableId, rawValue) {
    if (!engine || !variableId) return false;
    const ctx = {
      engine,
      flags: {},
      variables: engine.state?.variables || {},
      projectVariables: getCatalog(engine.data)
    };
    if (!isCatalogVariable(variableId, ctx) && typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn('[RuntimeVariables] set_variable: «' + variableId + '» не в каталоге переменных');
    }
    if (!engine.state.variables || typeof engine.state.variables !== 'object') {
      engine.state.variables = {};
    }
    const cur = engine.state.variables[variableId];
    engine.state.variables[variableId] = coerceActionValue(rawValue, cur);
    return true;
  }

  const RuntimeVariables = {
    getCatalog,
    getDefaultValue,
    initFromCatalog,
    applyFromSave,
    isCatalogVariable,
    resolveValue,
    setValue,
    coerceActionValue
  };

  if (typeof global !== 'undefined') {
    global.RuntimeVariables = RuntimeVariables;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
