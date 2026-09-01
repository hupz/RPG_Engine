/**
 * Engine Core — EventBus
 * DOM-independent, Editor-independent, synchronous.
 * Does NOT replace QuestEvents / QuestRuntime event path.
 */
(function engineCoreEventBus(global) {
  'use strict';

  /**
   * @returns {{
   *   on: (event: string, handler: Function) => void,
   *   off: (event: string, handler: Function) => void,
   *   emit: (event: string, payload?: *) => void,
   *   clear: (event?: string) => void,
   *   listenerCount: (event: string) => number
   * }}
   */
  function createEventBus() {
    /** @type {Map<string, Set<Function>>} */
    const listeners = new Map();

    function on(event, handler) {
      if (typeof event !== 'string' || !event) {
        throw new Error('EventBus.on: event must be a non-empty string');
      }
      if (typeof handler !== 'function') {
        throw new Error('EventBus.on: handler must be a function');
      }
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(handler);
    }

    function off(event, handler) {
      const set = listeners.get(event);
      if (!set) return;
      set.delete(handler);
      if (set.size === 0) listeners.delete(event);
    }

    function emit(event, payload) {
      const set = listeners.get(event);
      if (!set || set.size === 0) return;
      // snapshot to allow off during emit
      const list = Array.from(set);
      for (let i = 0; i < list.length; i++) {
        list[i](payload);
      }
    }

    function clear(event) {
      if (event == null) {
        listeners.clear();
        return;
      }
      listeners.delete(event);
    }

    function listenerCount(event) {
      const set = listeners.get(event);
      return set ? set.size : 0;
    }

    return { on, off, emit, clear, listenerCount };
  }

  const api = { createEventBus };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.EngineCore = global.EngineCore || {};
  global.EngineCore.createEventBus = createEventBus;
})(typeof window !== 'undefined' ? window : globalThis);
