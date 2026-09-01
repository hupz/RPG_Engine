// ============================================================
// Editor: единая загрузка/нормализация project data
// ============================================================
(function attachEditorDataLoad() {
  if (typeof Editor === 'undefined') return;

  /**
   * Безопасный ID для ключей entity-карт (защита от XSS в onclick/HTML).
   * Уже-валидные ID ([a-zA-Z0-9_-], ≤64) возвращаются без изменений.
   */
  function sanitizeId(value) {
    let s = String(value);
    if (/^[a-zA-Z0-9_-]{1,64}$/.test(s)) return s;
    s = s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
    if (!s) s = 'unnamed';
    return s;
  }

  /**
   * Переименовывает ключи map через sanitizeId; при коллизиях — _2, _3, …
   * Мутирует map на месте. Не трогает значения.
   */
  function sanitizeEntityMapKeys(map) {
    if (!map || typeof map !== 'object' || Array.isArray(map)) return;
    const entries = Object.entries(map);
    if (!entries.length) return;

    let needsRewrite = false;
    for (const [id] of entries) {
      if (sanitizeId(id) !== id) {
        needsRewrite = true;
        break;
      }
    }
    if (!needsRewrite) {
      // Все ID валидны — без копирования
      return;
    }

    const taken = new Set();
    const next = {};
    for (const [oldId, value] of entries) {
      let base = sanitizeId(oldId);
      let id = base;
      let n = 2;
      while (taken.has(id)) {
        const suffix = '_' + n;
        const maxBase = Math.max(0, 64 - suffix.length);
        id = base.slice(0, maxBase) + suffix;
        n += 1;
      }
      taken.add(id);
      next[id] = value;
    }

    for (const k of Object.keys(map)) delete map[k];
    Object.assign(map, next);
  }

  function sanitizeProjectEntityIds(data) {
    if (!data || typeof data !== 'object') return;
    const keys = ['scenes', 'items', 'enemies', 'classes', 'races', 'quests', 'npcs'];
    for (const k of keys) {
      if (data[k] && typeof data[k] === 'object') sanitizeEntityMapKeys(data[k]);
    }
  }

  Editor.sanitizeId = sanitizeId;

  Editor.migrateProjectData = function (data) {
    if (typeof ProjectDataSchema !== 'undefined') {
      return ProjectDataSchema.migrateProjectData(data);
    }
    return data;
  };

  Editor.setProjectData = function (data, opts) {
    const o = opts || {};
    this.data = this.migrateProjectData(data);
    sanitizeProjectEntityIds(this.data);
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
