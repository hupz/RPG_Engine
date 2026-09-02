/**
 * P4.2 — StoryWizard: пресеты жанра и генерация каркаса мира из шаблонов сцен.
 * Чистые данные + headless-генератор (тестируется без DOM).
 */
(function attachStoryWizardContent(global) {
  'use strict';

  function tr(key, params) {
    if (typeof I18n !== 'undefined' && typeof I18n.t === 'function') return I18n.t(key, params);
    if (typeof t === 'function') return t(key, params);
    return key;
  }

  const TR = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
    к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
    х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
  };

  const GENRE_IDS = Object.freeze(['fantasy', 'horror', 'detective', 'survival']);

  const GENRE_PRESETS = Object.freeze({
    fantasy: { id: 'fantasy', coverColor: '#4a3728', startingGold: 15, startingHp: 20 },
    horror: { id: 'horror', coverColor: '#1a1a2e', startingGold: 5, startingHp: 16 },
    detective: { id: 'detective', coverColor: '#2c3e50', startingGold: 25, startingHp: 18 },
    survival: { id: 'survival', coverColor: '#3d4a2c', startingGold: 8, startingHp: 22 }
  });

  const SYSTEM_IDS = Object.freeze(['generic', 'dnd5e', 'pf2e']);

  const SCENE_NAME_KEYS = Object.freeze([
    'start', 'hub', 'branch1', 'branch2', 'branch3', 'village', 'tavern', 'shop', 'forge',
    'road1', 'road2', 'road3', 'road4', 'exit'
  ]);

  const WORLD_SKELETONS = Object.freeze([
    {
      id: 'hub_branches',
      startKey: 'start',
      nodes: [
        { key: 'start', template: 'tpl_game_start', nameKey: 'start', links: [{ to: 'hub', choiceKey: 'startPath', icon: '🌅' }] },
        {
          key: 'hub', template: 'tpl_hub_simple', nameKey: 'hub',
          links: [
            { to: 'branch1', choiceKey: 'path1', icon: '🌲' },
            { to: 'branch2', choiceKey: 'path2', icon: '🏚️' },
            { to: 'branch3', choiceKey: 'path3', icon: '🏘️' }
          ]
        },
        { key: 'branch1', template: 'tpl_explore', nameKey: 'branch1', links: [{ to: 'hub', choiceKey: 'return', icon: '↩️' }] },
        { key: 'branch2', template: 'tpl_location', nameKey: 'branch2', links: [{ to: 'hub', choiceKey: 'return', icon: '↩️' }] },
        { key: 'branch3', template: 'tpl_dialogue', nameKey: 'branch3', links: [{ to: 'hub', choiceKey: 'return', icon: '↩️' }] }
      ]
    },
    {
      id: 'linear_road',
      startKey: 'start',
      nodes: [
        { key: 'start', template: 'tpl_game_start', nameKey: 'start', links: [{ to: 'road1', choiceKey: 'setOut', icon: '🌅' }] },
        { key: 'road1', template: 'tpl_location', nameKey: 'road1', links: [{ to: 'road2', choiceKey: 'continue', icon: '➡️' }] },
        { key: 'road2', template: 'tpl_explore', nameKey: 'road2', links: [{ to: 'road3', choiceKey: 'continue', icon: '➡️' }] },
        { key: 'road3', template: 'tpl_dialogue', nameKey: 'road3', links: [{ to: 'road4', choiceKey: 'continue', icon: '➡️' }] },
        { key: 'road4', template: 'tpl_reward', nameKey: 'road4', links: [{ to: 'exit', choiceKey: 'finishPath', icon: '🏁' }] },
        { key: 'exit', template: 'tpl_victory', nameKey: 'exit', links: [] }
      ]
    },
    {
      id: 'ready_village',
      startKey: 'start',
      nodes: [
        { key: 'start', template: 'tpl_game_start', nameKey: 'start', links: [{ to: 'village', choiceKey: 'enterVillage', icon: '🏘️' }] },
        {
          key: 'village', template: 'tpl_village', nameKey: 'village',
          links: [
            { to: 'tavern', choiceKey: 'tavern', icon: '🏚️' },
            { to: 'shop', choiceKey: 'shop', icon: '🛒' },
            { to: 'forge', choiceKey: 'forge', icon: '⚒️' },
            { to: 'exit', choiceKey: 'leaveVillage', icon: '🚪' }
          ]
        },
        { key: 'tavern', template: 'tpl_tavern', nameKey: 'tavern', links: [{ to: 'village', choiceKey: 'toSquare', icon: '↩️' }] },
        { key: 'shop', template: 'tpl_shop', nameKey: 'shop', links: [{ to: 'village', choiceKey: 'toSquare', icon: '↩️' }] },
        { key: 'forge', template: 'tpl_forge', nameKey: 'forge', links: [{ to: 'village', choiceKey: 'toSquare', icon: '↩️' }] },
        { key: 'exit', template: 'tpl_location', nameKey: 'exit', links: [{ to: 'village', choiceKey: 'return', icon: '↩️' }] }
      ]
    }
  ]);

  function genrePresetKey(genreId, field) {
    return 'editor.storyWizard.content.genres.' + (GENRE_PRESETS[genreId] ? genreId : 'fantasy') + '.' + field;
  }

  function skeletonChoiceText(skeletonId, choiceKey) {
    if (!choiceKey) return tr('editor.storyWizard.content.defaultChoiceGo');
    return tr('editor.storyWizard.content.skeletons.' + skeletonId + '.choices.' + choiceKey);
  }

  function slugifyId(name, existing) {
    let s = String(name || '').trim().toLowerCase();
    s = s.split('').map((ch) => TR[ch] || ch).join('');
    s = s.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (!s) s = 'scene';
    if (!/^[a-z]/.test(s)) s = 'id_' + s;
    const taken = existing instanceof Set ? existing : new Set(Object.keys(existing || {}));
    let out = s;
    let n = 2;
    while (taken.has(out)) {
      out = s + '_' + n;
      n++;
    }
    return out;
  }

  function getGenrePreset(genreId) {
    const id = GENRE_PRESETS[genreId] ? genreId : 'fantasy';
    const base = GENRE_PRESETS[id];
    return {
      id,
      label: tr(genrePresetKey(id, 'label')),
      defaultTitle: tr(genrePresetKey(id, 'defaultTitle')),
      description: tr(genrePresetKey(id, 'description')),
      coverColor: base.coverColor,
      startingGold: base.startingGold,
      startingHp: base.startingHp
    };
  }

  function listGenrePresets() {
    return GENRE_IDS.map((id) => getGenrePreset(id));
  }

  function listWorldSkeletons() {
    return WORLD_SKELETONS.map((s) => ({
      id: s.id,
      label: tr('editor.storyWizard.content.skeletons.' + s.id + '.label'),
      description: tr('editor.storyWizard.content.skeletons.' + s.id + '.description')
    }));
  }

  function listSystemOptions() {
    return SYSTEM_IDS.map((id) => ({
      id,
      label: tr('editor.storyWizard.content.systems.' + id)
    }));
  }

  function getSceneName(genreId, nameKey) {
    const g = GENRE_PRESETS[genreId] ? genreId : 'fantasy';
    const key = 'editor.storyWizard.content.sceneNames.' + g + '.' + nameKey;
    const val = tr(key);
    return val === key ? nameKey : val;
  }

  function buildPreviewGraph(spec, sceneIds, genreId) {
    const edges = [];
    spec.nodes.forEach((node) => {
      const fromId = sceneIds[node.key];
      const fromLabel = getSceneName(genreId, node.nameKey);
      (node.links || []).forEach((link) => {
        edges.push({
          from: fromId,
          fromLabel,
          to: sceneIds[link.to],
          toLabel: getSceneName(genreId, WORLD_SKELETONS.find((s) => s.id === spec.id)?.nodes.find((n) => n.key === link.to)?.nameKey || link.to),
          choice: link.choiceKey
            ? skeletonChoiceText(spec.id, link.choiceKey)
            : (link.choice || tr('editor.storyWizard.content.defaultChoiceGo')),
        });
      });
    });
    const scenes = spec.nodes.map((node) => ({
      key: node.key,
      id: sceneIds[node.key],
      label: getSceneName(genreId, node.nameKey),
      template: node.template
    }));
    return { scenes, edges, startSceneId: sceneIds[spec.startKey] };
  }

  /**
   * @param {object} data — project data (mutated)
   * @param {object} opts — { genre, skeletonId, buildPackPatch, slugifySceneId, removeSceneIds }
   */
  function generateWorldSkeleton(data, opts) {
    opts = opts || {};
    const genreId = opts.genre || 'fantasy';
    const skeletonId = opts.skeletonId || 'hub_branches';
    const spec = WORLD_SKELETONS.find((s) => s.id === skeletonId) || WORLD_SKELETONS[0];
    const buildPackPatch = opts.buildPackPatch;
    if (typeof buildPackPatch !== 'function') {
      return { ok: false, error: 'no_buildPackPatch' };
    }

    if (!data.scenes) data.scenes = {};
    const removeIds = opts.removeSceneIds || [];
    removeIds.forEach((id) => { delete data.scenes[id]; });

    const sceneIds = {};
    const reserved = { ...data.scenes };

    spec.nodes.forEach((node) => {
      const location = getSceneName(genreId, node.nameKey);
      const slugFn = opts.slugifySceneId || ((name, ex) => slugifyId(name, ex));
      sceneIds[node.key] = slugFn(location, reserved);
      reserved[sceneIds[node.key]] = true;
    });

    spec.nodes.forEach((node) => {
      const id = sceneIds[node.key];
      const location = getSceneName(genreId, node.nameKey);
      const blank = { id, location, text: '', choices: [], editorModules: [] };
      if (opts.editorRef) opts.editorRef.currentScene = id;
      const patch = buildPackPatch(node.template, blank) || {};
      const scene = Object.assign({}, blank, patch, { id, location });
      scene.choices = (node.links || []).map((link) => ({
        text: link.choiceKey
          ? skeletonChoiceText(spec.id, link.choiceKey)
          : (link.choice || tr('editor.storyWizard.content.defaultChoiceGo')),
        to: sceneIds[link.to],
        icon: link.icon || '➡️'
      }));
      if (typeof StoryMemory !== 'undefined' && StoryMemory.inferStoryPhaseForNode) {
        scene.storyPhase = StoryMemory.inferStoryPhaseForNode(node.key, spec);
      }
      if (!Array.isArray(scene.editorModules)) scene.editorModules = ['story', 'choices'];
      data.scenes[id] = scene;
    });

    data.startScene = sceneIds[spec.startKey];
    if (data.meta && data.meta.startScene) data.meta.startScene = data.startScene;
    if (!data.meta) data.meta = {};
    if (!data.meta.storyGraph) data.meta.storyGraph = { positions: {} };
    Object.keys(data.scenes).forEach((sid, i) => {
      if (!data.meta.storyGraph.positions[sid]) {
        data.meta.storyGraph.positions[sid] = { x: 40 + (i % 4) * 220, y: 40 + Math.floor(i / 4) * 110 };
      }
    });

    const preview = buildPreviewGraph(spec, sceneIds, genreId);
    return {
      ok: true,
      skeletonId: spec.id,
      sceneIds,
      startSceneId: sceneIds[spec.startKey],
      preview,
      sceneIdList: Object.values(sceneIds)
    };
  }

  function applyGenrePresetToProject(editor, draft) {
    if (!editor || !draft) return { ok: false };
    const preset = getGenrePreset(draft.genre);
    const title = (draft.title || '').trim() || preset.defaultTitle;
    const systemId = draft.system || 'generic';

    let data;
    if (systemId === 'pf2e' && typeof editor.createPf2eStarterProject === 'function') {
      data = editor.createPf2eStarterProject(title);
    } else if (typeof editor.createDnd5eStarterProject === 'function') {
      data = editor.createDnd5eStarterProject(title, systemId);
    } else if (typeof StarterProjectsIndex !== 'undefined' && StarterProjectsIndex.buildStarterProject) {
      data = StarterProjectsIndex.buildStarterProject('blank_rpg', title, { system: systemId });
    } else {
      return { ok: false, reason: 'no_starter' };
    }

    if (!data.meta) data.meta = {};
    data.meta.title = title;
    data.meta.description = preset.description;
    data.meta.storyGenre = draft.genre;
    data.meta.coverColor = preset.coverColor;
    data.meta.storyBalance = { gold: preset.startingGold, hp: preset.startingHp };
    data.system = systemId;
    data.meta.system = systemId;

    if (data.scenes && data.startScene && data.scenes[data.startScene]) {
      const start = data.scenes[data.startScene];
      if (start.gold == null) start.gold = preset.startingGold;
    }

    editor.data = data;
    editor.currentScene = data.startScene || 'start';
    draft.title = title;
    draft.projectInitialized = true;

    if (typeof ThemeSystem !== 'undefined') ThemeSystem.ensureInData(editor.data);
    if (typeof editor.applyThemeFromData === 'function') editor.applyThemeFromData();
    if (typeof EditorHistory !== 'undefined' && EditorHistory.resetAll) EditorHistory.resetAll();
    editor.renderAll?.();
    editor.updateProjectPanel?.();
    editor.updateJSONPreview?.();

    return { ok: true, preset };
  }

  function previewWorldSkeleton(draft, editor) {
    const skeletonId = draft.skeletonId || 'hub_branches';
    const clone = JSON.parse(JSON.stringify(editor?.data || { scenes: {}, meta: {} }));
    const prevIds = (draft.worldSceneIds || []).slice();
    const result = generateWorldSkeleton(clone, {
      genre: draft.genre,
      skeletonId,
      removeSceneIds: prevIds,
      slugifySceneId: (name, ex) => {
        if (editor && typeof editor.slugifySceneId === 'function') return editor.slugifySceneId(name, ex);
        return slugifyId(name, ex);
      },
      buildPackPatch: (packId, scene) => {
        if (editor && typeof editor.buildSceneTemplatePackPatch === 'function') {
          return editor.buildSceneTemplatePackPatch(packId, scene);
        }
        if (typeof SceneTemplatePackApi !== 'undefined') {
          return SceneTemplatePackApi.buildPatch(packId, scene, editor);
        }
        return null;
      },
      editorRef: editor
    });
    return result;
  }

  function applyWorldSkeletonToProject(editor, draft) {
    if (!editor?.data) return { ok: false, reason: 'no_project' };
    const removeIds = [];
    if (draft.worldApplied && !draft.worldEdited && draft.worldSceneIds?.length) {
      removeIds.push(...draft.worldSceneIds);
    } else if (draft.projectInitialized && !draft.worldApplied) {
      const keys = Object.keys(editor.data.scenes || {});
      if (keys.length <= 1) removeIds.push(...keys);
    }

    const result = generateWorldSkeleton(editor.data, {
      genre: draft.genre,
      skeletonId: draft.skeletonId || 'hub_branches',
      removeSceneIds: removeIds,
      slugifySceneId: (name, ex) => {
        if (typeof editor.slugifySceneId === 'function') return editor.slugifySceneId(name, ex);
        return slugifyId(name, ex);
      },
      buildPackPatch: (packId, scene) => editor.buildSceneTemplatePackPatch(packId, scene),
      editorRef: editor
    });
    if (!result.ok) return result;

    draft.worldPreview = result.preview;
    draft.worldSceneIds = result.sceneIdList;
    draft.worldApplied = true;
    draft.worldEdited = false;
    draft.worldGeneration = (draft.worldGeneration || 0) + 1;
    editor.currentScene = result.startSceneId;
    editor.renderAll?.();
    editor.updateJSONPreview?.();
    return result;
  }

  function validateWorldProject(editor, registry, catalogs) {
    if (typeof ProjectValidator === 'undefined' || !ProjectValidator.validateProject) {
      return { ok: true, skipped: true };
    }
    const report = ProjectValidator.validateProject(editor.data, {
      actionRegistry: registry,
      actionCatalog: catalogs?.actionCatalog,
      conditionCatalog: catalogs?.conditionCatalog
    });
    const errors = (report.errors || []).filter((e) => e.severity === 'error' || !e.severity);
    return { ok: errors.length === 0, errors, report };
  }

  const api = {
    GENRE_PRESETS,
    GENRE_IDS,
    SCENE_NAME_KEYS,
    WORLD_SKELETONS,
    SYSTEM_IDS,
    getGenrePreset,
    listGenrePresets,
    listWorldSkeletons,
    listSystemOptions,
    getSceneName,
    slugifyId,
    generateWorldSkeleton,
    buildPreviewGraph,
    applyGenrePresetToProject,
    previewWorldSkeleton,
    applyWorldSkeletonToProject,
    validateWorldProject
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof global !== 'undefined') {
    global.StoryWizardContent = api;
  }
  if (typeof Editor !== 'undefined') {
    Editor.StoryWizardContent = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global);
