// ============================================================
// Quest tasks — base class and registry
// ============================================================

const QuestTaskRegistry = {
  _types: {},

  register(typeId, ClassRef) {
    if (!typeId || !ClassRef) return;
    this._types[typeId] = ClassRef;
    ClassRef.typeId = typeId;
  },

  get(typeId) {
    return this._types[typeId] || null;
  },

  list() {
    return Object.keys(this._types).map((id) => {
      const C = this._types[id];
      return {
        id,
        label: C.label || id,
        description: C.description || '',
        fields: typeof C.getEditorFields === 'function' ? C.getEditorFields() : []
      };
    });
  },

  create(def, ctx) {
    if (!def || typeof def !== 'object') return null;
    const typeId = def.type || 'ManualAdvance';
    const ClassRef = this.get(typeId) || this.get('ManualAdvance');
    if (!ClassRef) return null;
    const task = new ClassRef(def, ctx || {});
    return task;
  }
};

class QuestTaskBase {
  static typeId = 'base';
  static label = 'Задача';
  static description = '';

  /** Поля редактора: [{ key, label, input, options? }] */
  static getEditorFields() {
    return [];
  }

  constructor(def, ctx) {
    this.def = def && typeof def === 'object' ? { ...def } : {};
    this.type = this.def.type || this.constructor.typeId;
    this.id = this.def.id || this.type + '_' + Math.random().toString(36).slice(2, 8);
    this.optional = !!this.def.optional;
    this._completed = !!this.def._completed;
    this._progress = Number(this.def._progress) || 0;
    this._ctx = ctx || {};
  }

  get target() {
    return Math.max(1, Number(this.def.count) || Number(this.def.amount) || 1);
  }

  getProgress() {
    if (this._completed) return this.target;
    return Math.min(this.target, Math.max(0, this._progress));
  }

  isCompleted() {
    return !!this._completed || this.getProgress() >= this.target;
  }

  reset() {
    this._completed = false;
    this._progress = 0;
  }

  markComplete() {
    this._completed = true;
    this._progress = this.target;
  }

  /** @param {{ type: string, payload?: object }} event */
  onEvent(/* event */) {
    // override
  }

  getDescription() {
    if (this.def.description) return String(this.def.description);
    return this.constructor.label || this.type;
  }

  serialize() {
    return {
      id: this.id,
      type: this.type,
      optional: this.optional,
      _completed: this.isCompleted(),
      _progress: this.getProgress(),
      // params preserved from def (without runtime keys)
      ...this._serializeParams()
    };
  }

  _serializeParams() {
    const skip = new Set(['id', 'type', 'optional', '_completed', '_progress', 'description']);
    const out = {};
    for (const [k, v] of Object.entries(this.def)) {
      if (skip.has(k)) continue;
      out[k] = v;
    }
    if (this.def.description) out.description = this.def.description;
    return out;
  }

  static deserialize(data, ctx) {
    return QuestTaskRegistry.create(data, ctx);
  }
}

if (typeof window !== 'undefined') {
  window.QuestTaskRegistry = QuestTaskRegistry;
  window.QuestTaskBase = QuestTaskBase;
}
