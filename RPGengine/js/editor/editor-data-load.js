// ============================================================
// Editor: единая загрузка/нормализация project data
// ============================================================
(function attachEditorDataLoad() {
  if (typeof Editor === 'undefined') return;

  Editor.migrateProjectData = function (data) {
    if (typeof ProjectDataSchema !== 'undefined') {
      return ProjectDataSchema.migrateProjectData(data);
    }
    return data;
  };

  Editor.setProjectData = function (data, opts) {
    const o = opts || {};
    this.data = this.migrateProjectData(data);
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
