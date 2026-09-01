// ============================================================
// Quest event bus — engine systems emit, tasks consume
// ============================================================

const QuestEvents = {
  _listeners: [],

  on(fn) {
    if (typeof fn === 'function') this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter((f) => f !== fn);
    };
  },

  off(fn) {
    this._listeners = this._listeners.filter((f) => f !== fn);
  },

  /**
   * @param {string} type
   * @param {object} [payload]
   */
  emit(type, payload) {
    if (!type) return;
    const event = { type: String(type), payload: payload || {}, ts: Date.now() };
    // Prefer QuestRuntime if bound
    if (typeof QuestRuntime !== 'undefined' && QuestRuntime.handleEvent) {
      try {
        QuestRuntime.handleEvent(event);
      } catch (e) {
        console.warn('QuestRuntime.handleEvent', e);
      }
    }
    for (const fn of this._listeners.slice()) {
      try {
        fn(event);
      } catch (e) {
        console.warn('QuestEvents listener', e);
      }
    }
  }
};

if (typeof window !== 'undefined') {
  window.QuestEvents = QuestEvents;
}
