/**
 * Engine Core — EngineApp
 * Minimal lifecycle shell. Does not own DOM, Editor, or QuestRuntime.
 * Legacy GameEngine remains the production entry; this is the new boundary.
 */
(function engineCoreEngineApp(global) {
  'use strict';

  function requireCore(name) {
    const core = global.EngineCore;
    if (!core || typeof core[name] !== 'function') {
      throw new Error('EngineApp requires EngineCore.' + name + ' (load js/core modules first)');
    }
    return core[name];
  }

  /**
   * @param {{
   *   project?: object,
   *   bus?: object,
   *   runtime?: object
   * }} [opts]
   */
  function createEngineApp(opts) {
    opts = opts || {};
    const createEventBus = requireCore('createEventBus');
    const createProject = requireCore('createProject');
    const createRuntimeContext = requireCore('createRuntimeContext');

    const bus = opts.bus || createEventBus();
    const project = opts.project
      || createProject(opts.data || {}, opts.metadata || {});
    let runtime = opts.runtime || null;
    let started = false;

    return {
      start() {
        if (started) return this;
        started = true;
        bus.emit('app:start', { project });
        return this;
      },

      stop() {
        if (!started) return this;
        started = false;
        bus.emit('app:stop', {});
        runtime = null;
        return this;
      },

      isStarted() {
        return started;
      },

      getProject() {
        return project;
      },

      getRuntime() {
        return runtime;
      },

      /**
       * Attach or replace runtime context (play session).
       * @param {object|null} ctx
       */
      setRuntime(ctx) {
        runtime = ctx;
        bus.emit('app:runtime', { runtime: ctx });
        return this;
      },

      /** Create a fresh RuntimeContext bound to this project/bus if none provided. */
      createDefaultRuntime(state, services) {
        const ctx = createRuntimeContext({
          project,
          state: state || {},
          services: services || {},
          bus
        });
        this.setRuntime(ctx);
        return ctx;
      },

      getBus() {
        return bus;
      }
    };
  }

  const api = { createEngineApp };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.EngineCore = global.EngineCore || {};
  global.EngineCore.createEngineApp = createEngineApp;
})(typeof window !== 'undefined' ? window : globalThis);
