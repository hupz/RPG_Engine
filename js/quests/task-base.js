// ============================================================
// Quest tasks — base class and registry
// ============================================================

/**
 * Thrown when task type is not registered. Never silently map to ManualAdvance.
 */
class UnknownQuestTaskTypeError extends Error {
  constructor(typeId, ctx, taskData) {
    ctx = ctx || {};
    const questId = ctx.questId != null ? String(ctx.questId) : '?';
    const stage = ctx.stageIndex != null ? String(ctx.stageIndex) : (ctx.stageId != null ? String(ctx.stageId) : '?');
    super(
      'Unknown quest task type «' + typeId + '» (quest=' + questId + ', stage=' + stage + ')'
    );
    this.name = 'UnknownQuestTaskTypeError';
    this.typeId = typeId;
    this.questId = ctx.questId != null ? ctx.questId : null;
    this.stageIndex = ctx.stageIndex != null ? ctx.stageIndex : null;
    this.stageId = ctx.stageId != null ? ctx.stageId : null;
    this.taskData = taskData || null;
  }
}

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


  /**
   * Validate task definition against getEditorFields schema.
   * @returns {{ ok: boolean, errors: string[] }}
   */
  validateDef(def, projectData) {
    const errors = [];
    if (!def || typeof def !== 'object') {
      return { ok: false, errors: ['Нет данных задачи'] };
    }
    const typeCheck = this.validateTaskType(def.type);
    if (!typeCheck.ok) {
      return { ok: false, errors: [typeCheck.error || ('Неизвестный тип задачи: ' + def.type)] };
    }
    const ClassRef = this.get(def.type);
    const fields = typeof ClassRef.getEditorFields === 'function' ? ClassRef.getEditorFields() : [];
    for (const f of fields) {
      if (!f.required) continue;
      const v = def[f.key];
      if (v == null || String(v).trim() === '') {
        errors.push('Укажите: ' + (f.label || f.key));
        continue;
      }
      // Entity existence
      if (projectData) {
        if (f.input === 'npc' && projectData.npcs && !projectData.npcs[v]) {
          errors.push('Персонаж не найден: «' + v + '»');
        }
        if (f.input === 'item' && projectData.items && !projectData.items[v]) {
          errors.push('Предмет не найден: «' + v + '»');
        }
        if (f.input === 'enemy' && projectData.enemies && !projectData.enemies[v]) {
          errors.push('Враг не найден: «' + v + '»');
        }
        if (f.input === 'scene' && projectData.scenes && !projectData.scenes[v]) {
          errors.push('Место не найдено: «' + v + '»');
        }
        if (f.input === 'location') {
          const inScenes = projectData.scenes && projectData.scenes[v];
          const inMap = projectData.worldMap && projectData.worldMap[v];
          if (projectData.scenes && projectData.worldMap && !inScenes && !inMap) {
            errors.push('Локация не найдена: «' + v + '»');
          }
        }
      }
      if (f.input === 'number') {
        const n = Number(v);
        const min = f.min != null ? f.min : 1;
        if (!Number.isFinite(n) || n < min) {
          errors.push((f.label || f.key) + ' должно быть числом ≥ ' + min);
        }
      }
    }
    return { ok: errors.length === 0, errors };
  },

  listSupported() {
    return this.list().filter((t) => {
      if (!t.id || t.id === 'base' || t.id === '__unknown__' || t.id === 'MigrationRequired') return false;
      const C = this.get(t.id);
      return C && !C.unsupported && !C.migrationPlaceholder;
    });
  },
  /**
   * Create a task instance. Unknown types throw UnknownQuestTaskTypeError
   * (no silent ManualAdvance). Use opts.placeholder to get UnknownTaskType instead.
   * @param {object} def
   * @param {{ questId?: string, stageIndex?: number }} [ctx]
   * @param {{ placeholder?: boolean }} [opts]
   */
  create(def, ctx, opts) {
    opts = opts || {};
    ctx = ctx || {};
    if (!def || typeof def !== 'object') {
      throw new UnknownQuestTaskTypeError('(missing def)', ctx, def);
    }
    const typeId = def.type;
    if (typeId == null || String(typeId).trim() === '') {
      throw new UnknownQuestTaskTypeError('(empty type)', ctx, def);
    }
    const ClassRef = this.get(String(typeId));
    if (!ClassRef) {
      if (opts.placeholder) {
        const Placeholder = (typeof UnknownTaskType !== 'undefined')
          ? UnknownTaskType
          : (typeof window !== 'undefined' ? window.UnknownTaskType : null);
        if (Placeholder) {
          return new Placeholder({ ...def, type: String(typeId), _unknownType: String(typeId) }, ctx);
        }
      }
      throw new UnknownQuestTaskTypeError(String(typeId), ctx, def);
    }
    return new ClassRef(def, ctx);
  },

  /**
   * @returns {{ ok: boolean, typeId: string, registered: boolean, unsupported: boolean, label?: string, error?: string }}
   */
  validateTaskType(typeId) {
    const id = typeId == null ? '' : String(typeId).trim();
    if (!id) {
      return { ok: false, typeId: id, registered: false, unsupported: false, error: 'Тип задачи не указан' };
    }
    const ClassRef = this.get(id);
    if (!ClassRef) {
      return { ok: false, typeId: id, registered: false, unsupported: false, error: 'Неизвестный тип задачи: ' + id };
    }
    if (ClassRef.unsupported) {
      return {
        ok: false, typeId: id, registered: true, unsupported: true,
        label: ClassRef.label || id,
        error: 'Тип «' + (ClassRef.label || id) + '» пока не поддерживается движком'
      };
    }
    return { ok: true, typeId: id, registered: true, unsupported: false, label: ClassRef.label || id };
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

  /**
   * Called when task becomes active on a stage.
   * Check current world state (not synthetic events).
   * @param {object} world — snapshot from engine.state
   */
  onActivate(world) {
    if (this.isCompleted()) return;
    this.applyWorldState(world || {});
  }

  /**
   * Shared state check used by onActivate (and optionally by onEvent wrappers).
   * Override in task types that care about current state.
   */
  applyWorldState(/* world */) {
    // default: no initial sync
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

class UnknownTaskType extends QuestTaskBase {
  static typeId = '__unknown__';
  static label = 'Неизвестный тип';
  static unsupported = true;
  static getEditorFields() {
    return [
      { key: '_unknownType', label: 'Исходный тип (только чтение)', input: 'text' },
      { key: 'description', label: 'Описание', input: 'text' }
    ];
  }
  constructor(def, ctx) {
    super(def, ctx);
    this._unknownType = (def && (def._unknownType || def.type)) || '__unknown__';
    this.type = this._unknownType;
  }
  onEvent() {}
  isCompleted() { return false; }
  getProgress() { return 0; }
  getDescription() {
    return '⚠ Неизвестный тип задачи: ' + (this._unknownType || '?');
  }
  serialize() {
    const base = super.serialize();
    base.type = this._unknownType || this.def.type || '__unknown__';
    base._unknownType = this._unknownType;
    base._isUnknown = true;
    return base;
  }
}

if (typeof window !== 'undefined') {
  window.QuestTaskRegistry = QuestTaskRegistry;
  window.QuestTaskBase = QuestTaskBase;
  window.UnknownQuestTaskTypeError = UnknownQuestTaskTypeError;
  window.UnknownTaskType = UnknownTaskType;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { QuestTaskRegistry, QuestTaskBase, UnknownQuestTaskTypeError, UnknownTaskType };
}
