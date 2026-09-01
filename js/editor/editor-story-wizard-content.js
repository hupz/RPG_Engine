/**
 * P4.2 — StoryWizard: пресеты жанра и генерация каркаса мира из шаблонов сцен.
 * Чистые данные + headless-генератор (тестируется без DOM).
 */
(function attachStoryWizardContent(global) {
  'use strict';

  const TR = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
    к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
    х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
  };

  const GENRE_PRESETS = Object.freeze({
    fantasy: {
      id: 'fantasy',
      label: 'Фэнтези',
      defaultTitle: 'Сказание о приключении',
      description: 'Рыцари, магия и древние тайны ждут героя.',
      coverColor: '#4a3728',
      startingGold: 15,
      startingHp: 20
    },
    horror: {
      id: 'horror',
      label: 'Хоррор',
      defaultTitle: 'Тени забытого дома',
      description: 'Мрак, страх и необъяснимое на каждом шагу.',
      coverColor: '#1a1a2e',
      startingGold: 5,
      startingHp: 16
    },
    detective: {
      id: 'detective',
      label: 'Детектив',
      defaultTitle: 'Дело без ответа',
      description: 'Улики, свидетели и разгадка в финале.',
      coverColor: '#2c3e50',
      startingGold: 25,
      startingHp: 18
    },
    survival: {
      id: 'survival',
      label: 'Выживание',
      defaultTitle: 'После бури',
      description: 'Ресурсы на исходе — нужно дойти до безопасного места.',
      coverColor: '#3d4a2c',
      startingGold: 8,
      startingHp: 22
    }
  });

  const SYSTEM_LABELS = Object.freeze({
    generic: 'Универсальные правила',
    dnd5e: 'Классические приключения',
    pf2e: 'Путьfinder'
  });

  const SYSTEM_IDS = Object.freeze(['generic', 'dnd5e', 'pf2e']);

  const GENRE_SCENE_NAMES = Object.freeze({
    fantasy: {
      start: 'У ворот королевства',
      hub: 'Перекрёсток стражей',
      branch1: 'Тёмный лес',
      branch2: 'Руины башни',
      branch3: 'Деревня эльфов',
      village: 'Деревня Ольдвуд',
      tavern: 'Таверна «Золотой кубок»',
      shop: 'Лавка алхимика',
      forge: 'Кузница старого Грома',
      road1: 'Королевская дорога',
      road2: 'Мост через реку',
      road3: 'Поляна у ручья',
      road4: 'Ворота крепости',
      exit: 'Окраина земель'
    },
    horror: {
      start: 'Порог заброшенного дома',
      hub: 'Пустой холл',
      branch1: 'Подвал',
      branch2: 'Мансарда',
      branch3: 'Сад с могилами',
      village: 'Мёртвая деревня',
      tavern: 'Закрытая постоялая',
      shop: 'Пустая лавка',
      forge: 'Заржавевшая кузня',
      road1: 'Туманная тропа',
      road2: 'Сломанный мост',
      road3: 'Болото',
      road4: 'Старый склеп',
      exit: 'Ворота кладбища'
    },
    detective: {
      start: 'Приёмная детектива',
      hub: 'Городская площадь',
      branch1: 'Кабинет мэра',
      branch2: 'Склад улик',
      branch3: 'Кафе свидетелей',
      village: 'Старый квартал',
      tavern: 'Бар «Красная лампа»',
      shop: 'Ломбард',
      forge: 'Мастерская часовщика',
      road1: 'Улица фонарей',
      road2: 'Переулок у доков',
      road3: 'Архив полиции',
      road4: 'Судебный зал',
      exit: 'Вокзал'
    },
    survival: {
      start: 'Лагерь после бури',
      hub: 'Разрушенный мост',
      branch1: 'Заросшая тропа',
      branch2: 'Заброшенная хижина',
      branch3: 'Ручей с пресной водой',
      village: 'Посёлок ущелья',
      tavern: 'Убежище у костра',
      shop: 'Запасной склад',
      forge: 'Сарай с инструментами',
      road1: 'Горная тропа',
      road2: 'Обвал на пути',
      road3: 'Пещера у скалы',
      road4: 'Спасательный пункт',
      exit: 'Безопасная поляна'
    }
  });

  const WORLD_SKELETONS = Object.freeze([
    {
      id: 'hub_branches',
      label: 'Хаб и три ветки',
      description: 'Центральная точка и три пути — классика ветвящегося сюжета.',
      startKey: 'start',
      nodes: [
        { key: 'start', template: 'tpl_game_start', nameKey: 'start', links: [{ to: 'hub', choice: 'Начать путь', icon: '🌅' }] },
        {
          key: 'hub', template: 'tpl_hub_simple', nameKey: 'hub',
          links: [
            { to: 'branch1', choice: 'Первый путь', icon: '🌲' },
            { to: 'branch2', choice: 'Второй путь', icon: '🏚️' },
            { to: 'branch3', choice: 'Третий путь', icon: '🏘️' }
          ]
        },
        { key: 'branch1', template: 'tpl_explore', nameKey: 'branch1', links: [{ to: 'hub', choice: 'Вернуться', icon: '↩️' }] },
        { key: 'branch2', template: 'tpl_location', nameKey: 'branch2', links: [{ to: 'hub', choice: 'Вернуться', icon: '↩️' }] },
        { key: 'branch3', template: 'tpl_dialogue', nameKey: 'branch3', links: [{ to: 'hub', choice: 'Вернуться', icon: '↩️' }] }
      ]
    },
    {
      id: 'linear_road',
      label: 'Линейная дорога',
      description: 'Последовательный путь из пяти локаций — для сюжета без развилок.',
      startKey: 'start',
      nodes: [
        { key: 'start', template: 'tpl_game_start', nameKey: 'start', links: [{ to: 'road1', choice: 'В путь', icon: '🌅' }] },
        { key: 'road1', template: 'tpl_location', nameKey: 'road1', links: [{ to: 'road2', choice: 'Идти дальше', icon: '➡️' }] },
        { key: 'road2', template: 'tpl_explore', nameKey: 'road2', links: [{ to: 'road3', choice: 'Идти дальше', icon: '➡️' }] },
        { key: 'road3', template: 'tpl_dialogue', nameKey: 'road3', links: [{ to: 'road4', choice: 'Идти дальше', icon: '➡️' }] },
        { key: 'road4', template: 'tpl_reward', nameKey: 'road4', links: [{ to: 'exit', choice: 'Завершить путь', icon: '🏁' }] },
        { key: 'exit', template: 'tpl_victory', nameKey: 'exit', links: [] }
      ]
    },
    {
      id: 'ready_village',
      label: 'Готовая деревня',
      description: 'Посёлок с таверной, лавкой и кузницей — готовый хаб для истории.',
      startKey: 'start',
      nodes: [
        { key: 'start', template: 'tpl_game_start', nameKey: 'start', links: [{ to: 'village', choice: 'Войти в посёлок', icon: '🏘️' }] },
        {
          key: 'village', template: 'tpl_village', nameKey: 'village',
          links: [
            { to: 'tavern', choice: 'Таверна', icon: '🏚️' },
            { to: 'shop', choice: 'Лавка', icon: '🛒' },
            { to: 'forge', choice: 'Кузница', icon: '⚒️' },
            { to: 'exit', choice: 'Уйти из посёлка', icon: '🚪' }
          ]
        },
        { key: 'tavern', template: 'tpl_tavern', nameKey: 'tavern', links: [{ to: 'village', choice: 'На площадь', icon: '↩️' }] },
        { key: 'shop', template: 'tpl_shop', nameKey: 'shop', links: [{ to: 'village', choice: 'На площадь', icon: '↩️' }] },
        { key: 'forge', template: 'tpl_forge', nameKey: 'forge', links: [{ to: 'village', choice: 'На площадь', icon: '↩️' }] },
        { key: 'exit', template: 'tpl_location', nameKey: 'exit', links: [{ to: 'village', choice: 'Вернуться', icon: '↩️' }] }
      ]
    }
  ]);

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
    return GENRE_PRESETS[genreId] || GENRE_PRESETS.fantasy;
  }

  function listGenrePresets() {
    return Object.values(GENRE_PRESETS);
  }

  function listWorldSkeletons() {
    return WORLD_SKELETONS.map((s) => ({
      id: s.id,
      label: s.label,
      description: s.description
    }));
  }

  function listSystemOptions() {
    return SYSTEM_IDS.map((id) => ({ id, label: SYSTEM_LABELS[id] || id }));
  }

  function getSceneName(genreId, nameKey) {
    const bag = GENRE_SCENE_NAMES[genreId] || GENRE_SCENE_NAMES.fantasy;
    return bag[nameKey] || nameKey;
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
          choice: link.choice
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
        text: link.choice || 'Идти',
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
    GENRE_SCENE_NAMES,
    WORLD_SKELETONS,
    SYSTEM_LABELS,
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
