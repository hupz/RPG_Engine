/**
 * Engine Core — RuntimeContext
 * Live play session: project + mutable state + services + bus.
 * Not Editor state. Not the same object as Project.data alone.
 */
(function engineCoreRuntimeContext(global) {
  'use strict';

  /**
   * @param {{
   *   project?: object,
   *   state?: object,
   *   services?: object,
   *   bus?: { on: Function, off: Function, emit: Function }
   * }} [opts]
   */
  function createRuntimeContext(opts) {
    opts = opts || {};
    const project = opts.project || null;
    const state = opts.state && typeof opts.state === 'object' ? opts.state : {};
    const services = opts.services && typeof opts.services === 'object' ? opts.services : {};
    const bus = opts.bus || null;

    return {
      project,
      state,
      services,
      bus,

      /** Convenience: project data root if present */
      get data() {
        return this.project && this.project.data ? this.project.data : null;
      }
    };
  }

  const api = { createRuntimeContext };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.EngineCore = global.EngineCore || {};
  global.EngineCore.createRuntimeContext = createRuntimeContext;
})(typeof window !== 'undefined' ? window : globalThis);
