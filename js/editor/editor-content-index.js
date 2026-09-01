/**
 * Phase 1.11 — Project content index (pure, testable)
 * Reads existing Editor.data shape — no runtime, no migration.
 */
(function attachEditorContentIndex(global) {
  'use strict';

  const CATEGORIES = [
    {
      id: 'scenes',
      label: 'Scenes',
      labelRu: 'Сцены',
      writerVisible: true,
      tab: 'scenes',
      createType: 'scene'
    },
    {
      id: 'visual_scenes',
      label: 'Visual Scenes',
      labelRu: 'Visual-сцены',
      writerVisible: true,
      tab: 'scenes',
      createType: 'scene'
    },
    {
      id: 'items',
      label: 'Items',
      labelRu: 'Предметы',
      writerVisible: true,
      tab: 'items',
      createType: 'item'
    },
    {
      id: 'quests',
      label: 'Quests',
      labelRu: 'Квесты',
      writerVisible: true,
      tab: 'quests',
      createType: 'quest'
    },
    {
      id: 'npcs',
      label: 'NPC',
      labelRu: 'NPC',
      writerVisible: true,
      tab: 'npcs',
      createType: 'npc'
    },
    {
      id: 'player_characters',
      label: 'Player Characters',
      labelRu: 'Герои',
      writerVisible: true,
      tab: 'player_characters',
      createType: 'player_character'
    },
    {
      id: 'enemies',
      label: 'Enemies',
      labelRu: 'Враги',
      writerVisible: true,
      tab: 'enemies',
      createType: 'enemy'
    },
    {
      id: 'ui_screens',
      label: 'Game UI',
      labelRu: 'Game UI',
      writerVisible: true,
      tab: 'game_ui',
      createType: 'ui_screen'
    },
    {
      id: 'assets',
      label: 'Assets',
      labelRu: 'Ассеты',
      writerVisible: true,
      tab: 'media',
      createType: 'asset'
    }
  ];

  function safeObj(v) {
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  }

  function sceneTitle(id, sc) {
    return (sc && (sc.location || sc.title)) || id;
  }

  function hasVisualScene(sc) {
    if (!sc || typeof sc !== 'object') return false;
    const v = sc.visual;
    if (!v || typeof v !== 'object') return false;
    if (Array.isArray(v.nodes) && v.nodes.length) return true;
    if (v.background && (v.background.asset || v.background.src)) return true;
    return v.mode === 'overlay' || v.mode === 'full';
  }

  /** Existing-data kinds only: text | visual | mixed (no artificial scene types). */
  function getSceneKind(sc) {
    const visual = hasVisualScene(sc);
    const hasText = !!(sc && String(sc.text || '').trim());
    const hasChoices = Array.isArray(sc?.choices) && sc.choices.length > 0;
    if (visual && (hasText || hasChoices)) return 'mixed';
    if (visual) return 'visual';
    return 'text';
  }

  function sceneIsUiLinked(sceneId, data) {
    const screens = safeObj(data?.ui && data.ui.screens);
    return Object.values(screens).some((screen) => {
      if (screen?.sceneId === sceneId) return true;
      return (screen?.nodes || []).some((node) => {
        const clicks = node?.events?.click || [];
        return clicks.some((step) => {
          const p = step?.params || {};
          return step?.action === 'change_scene' && (p.sceneId === sceneId || p.to === sceneId);
        });
      });
    });
  }

  function collectSceneTags(sc) {
    const tags = [];
    if (Array.isArray(sc?.tags)) {
      sc.tags.forEach((t) => { if (t) tags.push(String(t)); });
    } else if (typeof sc?.tags === 'string' && sc.tags.trim()) {
      tags.push(sc.tags.trim());
    }
    if (sc?.sceneType) tags.push(String(sc.sceneType));
    return tags;
  }

  /**
   * Search scenes by id, title/location, text, tags.
   * @returns {{ id: string, scene: object, kind: string, title: string }[]}
   */
  function searchScenes(data, opts) {
    opts = opts || {};
    const query = String(opts.query || '').trim().toLowerCase();
    const filter = opts.filter || 'all'; // all | text | visual | mixed | ui
    const scenes = safeObj(data?.scenes);
    const out = [];
    Object.entries(scenes).forEach(([id, sc]) => {
      const kind = getSceneKind(sc);
      if (filter === 'text' && kind !== 'text') return;
      if (filter === 'visual' && kind !== 'visual' && kind !== 'mixed') return;
      if (filter === 'mixed' && kind !== 'mixed') return;
      if (filter === 'ui' && !sceneIsUiLinked(id, data)) return;
      if (query) {
        const tags = collectSceneTags(sc).join(' ');
        const hay = [id, sc?.location, sc?.title, sc?.text, tags].join(' ').toLowerCase();
        if (hay.indexOf(query) < 0) return;
      }
      out.push({
        id,
        scene: sc,
        kind,
        title: sceneTitle(id, sc),
        uiLinked: sceneIsUiLinked(id, data)
      });
    });
    out.sort((a, b) => String(a.title).localeCompare(String(b.title), 'ru'));
    return out;
  }

  /**
   * Find inbound references to a scene (choices, transitions, actions, UI).
   * Does not mutate data. Pure scan of known fields.
   */
  function findSceneReferences(sceneId, data) {
    const refs = [];
    if (!sceneId || !data) return refs;
    const scenes = safeObj(data.scenes);

    if (data.startScene === sceneId || data.meta?.startScene === sceneId) {
      refs.push({ kind: 'startScene', fromId: 'project', label: 'startScene', path: 'startScene' });
    }

    Object.entries(scenes).forEach(([fromId, sc]) => {
      if (fromId === sceneId) return;
      const push = (kind, label, path) => {
        refs.push({ kind, fromId, label: label || kind, path });
      };
      ['nextScene', 'winScene', 'lossScene', 'hubScene', 'exitScene'].forEach((field) => {
        if (sc?.[field] === sceneId) push('transition', field, 'scenes.' + fromId + '.' + field);
      });
      (sc?.choices || []).forEach((ch, i) => {
        if (ch?.to === sceneId) push('choice', 'choice.to', 'scenes.' + fromId + '.choices[' + i + '].to');
        if (ch?.nextScene === sceneId) push('choice', 'choice.nextScene', 'scenes.' + fromId + '.choices[' + i + '].nextScene');
        const sk = ch?.skillCheck;
        if (sk?.successNext === sceneId) push('choice', 'skillCheck.successNext', 'scenes.' + fromId + '.choices[' + i + ']');
        if (sk?.failNext === sceneId) push('choice', 'skillCheck.failNext', 'scenes.' + fromId + '.choices[' + i + ']');
      });
      ['enter', 'exit'].forEach((ev) => {
        (sc?.events?.[ev] || []).forEach((step, idx) => {
          const p = step?.params || {};
          if ((step?.action === 'change_scene' || step?.action === 'start_combat') &&
              (p.sceneId === sceneId || p.to === sceneId || p.nextScene === sceneId)) {
            push('action', step.action + ' (' + ev + ')', 'scenes.' + fromId + '.events.' + ev + '[' + idx + ']');
          }
        });
      });
      (sc?.visual?.nodes || []).forEach((node) => {
        ['click', 'hover', 'enter', 'exit'].forEach((ev) => {
          (node?.events?.[ev] || []).forEach((step, idx) => {
            const p = step?.params || {};
            if (p.sceneId === sceneId || p.to === sceneId || p.nextScene === sceneId) {
              push('action', (step.action || 'action') + ' @' + (node.id || '?'),
                'scenes.' + fromId + '.visual.nodes.' + (node.id || '?') + '.' + ev + '[' + idx + ']');
            }
          });
        });
      });
      (sc?.components || []).forEach((comp, ci) => {
        (comp?.params?.topics || []).forEach((t, ti) => {
          if (t?.nextScene === sceneId || t?.to === sceneId) {
            push('action', 'dialogue nextScene', 'scenes.' + fromId + '.components[' + ci + '].topics[' + ti + ']');
          }
          (t?.actions || []).forEach((step, ai) => {
            const p = step?.params || {};
            if (p.sceneId === sceneId || p.nextScene === sceneId) {
              push('action', step.action || 'action', 'scenes.' + fromId + '.components[' + ci + '].topics[' + ti + '].actions[' + ai + ']');
            }
          });
        });
      });
    });

    Object.entries(safeObj(data.npcs)).forEach(([npcId, npc]) => {
      if (npc?.dialogueSceneId === sceneId) {
        refs.push({ kind: 'npc', fromId: npcId, label: 'dialogueSceneId', path: 'npcs.' + npcId + '.dialogueSceneId' });
      }
    });

    Object.entries(safeObj(data.ui && data.ui.screens)).forEach(([screenId, screen]) => {
      if (screen?.sceneId === sceneId) {
        refs.push({ kind: 'ui', fromId: screenId, label: 'ui.sceneId', path: 'ui.screens.' + screenId });
      }
      (screen?.nodes || []).forEach((node) => {
        (node?.events?.click || []).forEach((step, idx) => {
          const p = step?.params || {};
          if (p.sceneId === sceneId || p.to === sceneId) {
            refs.push({
              kind: 'ui',
              fromId: screenId,
              label: step.action || 'ui action',
              path: 'ui.screens.' + screenId + '.nodes.' + (node.id || '?') + '[' + idx + ']'
            });
          }
        });
      });
    });

    return refs;
  }

  function allocateUniqueSceneId(baseId, existing) {
    const base = String(baseId || 'scene_copy').replace(/_copy(_\d+)?$/, '') + '_copy';
    let id = base;
    let n = 2;
    const map = existing || {};
    while (map[id]) id = base + '_' + n++;
    return id;
  }

  /**
   * Deep-copy scene with new id. Does NOT retarget external links.
   * Internal copy keeps same internal structure (self-links stay pointing at old id — audited by caller).
   */
  function buildDuplicatedScene(sourceId, sourceScene, existingIds) {
    const newId = allocateUniqueSceneId(sourceId, existingIds);
    const copy = JSON.parse(JSON.stringify(sourceScene || {}));
    copy.id = newId;
    if (copy.location && !/_copy$/i.test(copy.location)) {
      copy.location = String(copy.location) + ' (копия)';
    }
    return { id: newId, scene: copy };
  }

  function assetTitle(id, entry) {
    if (!entry) return id;
    if (typeof entry === 'string') return id;
    return entry.name || entry.src || id;
  }

  function assetType(entry) {
    if (!entry || typeof entry === 'string') return 'file';
    return entry.type || 'asset';
  }

  function collectEntriesForCategory(categoryId, data) {
    data = data || {};
    const rows = [];

    if (categoryId === 'scenes') {
      Object.entries(safeObj(data.scenes)).forEach(([id, sc]) => {
        rows.push({
          type: 'scene',
          id,
          title: sceneTitle(id, sc),
          meta: sc?.sceneType || getSceneKind(sc),
          tab: 'scenes'
        });
      });
    } else if (categoryId === 'visual_scenes') {
      Object.entries(safeObj(data.scenes)).forEach(([id, sc]) => {
        if (!hasVisualScene(sc)) return;
        rows.push({
          type: 'visual_scene',
          id,
          title: sceneTitle(id, sc),
          meta: 'visual',
          tab: 'scenes'
        });
      });
    } else if (categoryId === 'items') {
      Object.entries(safeObj(data.items)).forEach(([id, it]) => {
        rows.push({
          type: 'item',
          id,
          title: it?.name || id,
          meta: it?.type || '',
          tab: 'items'
        });
      });
    } else if (categoryId === 'quests') {
      Object.entries(safeObj(data.quests)).forEach(([id, q]) => {
        rows.push({
          type: 'quest',
          id,
          title: q?.title || id,
          meta: q?.status || '',
          tab: 'quests'
        });
      });
    } else if (categoryId === 'npcs') {
      Object.entries(safeObj(data.npcs)).forEach(([id, n]) => {
        rows.push({
          type: 'npc',
          id,
          title: n?.name || id,
          meta: n?.location || '',
          tab: 'npcs'
        });
      });
    } else if (categoryId === 'player_characters') {
      Object.entries(safeObj(data.playerCharacters)).forEach(([id, pc]) => {
        rows.push({
          type: 'player_character',
          id,
          title: pc?.displayName || pc?.name || id,
          meta: pc?.classId || '',
          tab: 'player_characters'
        });
      });
    } else if (categoryId === 'enemies') {
      Object.entries(safeObj(data.enemies)).forEach(([id, e]) => {
        rows.push({
          type: 'enemy',
          id,
          title: e?.name || id,
          meta: e?.creatureType || '',
          tab: 'enemies'
        });
      });
    } else if (categoryId === 'ui_screens') {
      const screens = safeObj(data.ui && data.ui.screens);
      Object.entries(screens).forEach(([id, sc]) => {
        rows.push({
          type: 'ui_screen',
          id,
          title: sc?.name || sc?.id || id,
          meta: sc?.scope || 'ui',
          tab: 'game_ui'
        });
      });
    } else if (categoryId === 'assets') {
      Object.entries(safeObj(data.assets)).forEach(([id, entry]) => {
        rows.push({
          type: 'asset',
          id,
          title: assetTitle(id, entry),
          meta: assetType(entry),
          tab: 'media'
        });
      });
    }

    rows.sort((a, b) => String(a.title).localeCompare(String(b.title), 'ru'));
    return rows;
  }

  function collectProjectContentStats(data) {
    const stats = {};
    CATEGORIES.forEach((cat) => {
      stats[cat.id] = collectEntriesForCategory(cat.id, data).length;
    });
    stats.npc_characters = stats.npcs + stats.player_characters;
    return stats;
  }

  function getVisibleCategories(opts) {
    opts = opts || {};
    const writerMode = !!opts.writerMode;
    const data = opts.data || {};
    return CATEGORIES.filter((cat) => {
      if (writerMode && cat.writerVisible === false) return false;
      if (opts.onlyNonEmpty) {
        return collectEntriesForCategory(cat.id, data).length > 0;
      }
      return true;
    });
  }

  function buildContentBrowserIndex(data, opts) {
    opts = opts || {};
    const categories = getVisibleCategories({
      writerMode: opts.writerMode,
      data,
      onlyNonEmpty: false
    });
    const entries = [];
    categories.forEach((cat) => {
      collectEntriesForCategory(cat.id, data).forEach((row) => {
        entries.push({
          ...row,
          categoryId: cat.id,
          categoryLabel: cat.labelRu || cat.label
        });
      });
    });
    return entries;
  }

  function filterContentEntries(entries, opts) {
    opts = opts || {};
    let list = Array.isArray(entries) ? entries.slice() : [];
    const cat = opts.category;
    if (cat && cat !== 'all') {
      list = list.filter((e) => e.categoryId === cat || e.type === cat);
    }
    const q = String(opts.query || '').trim().toLowerCase();
    if (q) {
      list = list.filter((e) => {
        const hay = [e.title, e.id, e.meta, e.categoryLabel].join(' ').toLowerCase();
        return hay.indexOf(q) >= 0;
      });
    }
    return list;
  }

  const api = {
    CATEGORIES,
    hasVisualScene,
    getSceneKind,
    sceneIsUiLinked,
    collectSceneTags,
    searchScenes,
    findSceneReferences,
    allocateUniqueSceneId,
    buildDuplicatedScene,
    collectEntriesForCategory,
    collectProjectContentStats,
    getVisibleCategories,
    buildContentBrowserIndex,
    filterContentEntries
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof global !== 'undefined') {
    global.EditorContentIndex = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global);
