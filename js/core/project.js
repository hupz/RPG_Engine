/**
 * Engine Core — Project
 * Authoritative *data* of a game project (not player save, not editor UI state).
 */
(function engineCoreProject(global) {
  'use strict';

  /**
   * @param {object} [data] - project JSON root (scenes, quests, items, …)
   * @param {object} [metadata] - optional { name, engineVersion, projectType, … }
   */
  function createProject(data, metadata) {
    const projectData = data && typeof data === 'object' ? data : {};
    const meta = metadata && typeof metadata === 'object' ? { ...metadata } : {};

    if (meta.engineVersion == null && projectData.meta && projectData.meta.engineVersion != null) {
      meta.engineVersion = projectData.meta.engineVersion;
    }
    if (meta.name == null && projectData.meta && projectData.meta.name != null) {
      meta.name = projectData.meta.name;
    }

    return {
      /** @type {object} mutable project data (legacy-compatible shape) */
      data: projectData,
      /** @type {object} */
      metadata: meta,

      get version() {
        return this.metadata.engineVersion
          || this.data?.meta?.engineVersion
          || this.data?.engineVersion
          || null;
      },

      get projectType() {
        return this.metadata.projectType
          || this.data?.meta?.projectType
          || 'text';
      },

      get scenes() {
        return this.data.scenes || {};
      },

      get quests() {
        return this.data.quests || {};
      },

      get items() {
        return this.data.items || {};
      }
    };
  }

  const api = { createProject };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.EngineCore = global.EngineCore || {};
  global.EngineCore.createProject = createProject;
})(typeof window !== 'undefined' ? window : globalThis);
