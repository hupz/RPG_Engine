// ============================================================
// Command Palette 2.0 (UI-16) — fast navigation + object search
// Extends Editor.commands. Uses existing Editor APIs only.
// ============================================================
(function attachCommandPaletteV2() {
  'use strict';

  if (typeof Editor === 'undefined' || !Editor.commands) return;

  const Commands = Editor.commands;

  const CATEGORIES = Object.freeze({
    navigation: 'Навигация',
    create: 'Создание',
    project: 'Проект',
    preview: 'Превью',
    validation: 'Проверка',
    export: 'Экспорт',
    objects: 'Объекты',
    recent: 'Недавние'
  });

  const TYPE_LABELS = Object.freeze({
    scene: 'Сцена',
    visual_scene: 'Сцена',
    quest: 'Квест',
    item: 'Предмет',
    npc: 'NPC',
    player_character: 'Герой',
    enemy: 'Враг',
    ui_screen: 'Game UI',
    asset: 'Ассет'
  });

  function safe(fn) {
    return function () {
      try {
        return fn.call(Editor);
      } catch (e) {
        console.error('[cmd-palette-v2]', e);
        return false;
      }
    };
  }

  function openObject(type, id, title) {
    if (!type || id == null || id === '') return false;
    if (typeof Editor.openContentFromBrowser === 'function') {
      return Editor.openContentFromBrowser(type, id, title) !== false;
    }
    return openObjectLegacy(type, id);
  }

  function openObjectLegacy(type, id) {
    const t = String(type || '').toLowerCase();
    if (t === 'scene' || t === 'visual_scene') {
      if (typeof Editor.openSceneFromContentBrowser === 'function') {
        return Editor.openSceneFromContentBrowser(id);
      }
      if (typeof Editor.openSceneWorkspace === 'function') {
        Editor.openSceneWorkspace(id);
        return true;
      }
      if (typeof Editor.selectScene === 'function') {
        Editor.switchTab?.('scenes');
        Editor.selectScene(id);
        return true;
      }
    }
    if (t === 'quest') {
      Editor.switchTab?.('quests');
      Editor.selectQuestToEdit?.(id);
      return true;
    }
    if (t === 'item') {
      Editor.switchTab?.('items');
      Editor.selectItemToEdit?.(id);
      return true;
    }
    if (t === 'npc') {
      Editor.switchTab?.('npcs');
      Editor.selectNpcToEdit?.(id);
      return true;
    }
    if (t === 'enemy') {
      Editor.switchTab?.('enemies');
      Editor.selectEnemyToEdit?.(id);
      return true;
    }
    if (typeof Editor.openContentEntity === 'function') {
      return Editor.openContentEntity(type, id);
    }
    return false;
  }

  function searchObjectsViaContentIndex(query) {
    const q = String(query || '').trim();
    if (!q || typeof Editor.searchProjectContent !== 'function') return null;

    return Editor.searchProjectContent(q).slice(0, 25).map((entry) => {
      const type = entry.type || entry.categoryId || 'scene';
      const title = entry.title || entry.id;
      const subtitle = TYPE_LABELS[type] || entry.categoryLabel || type;
      return {
        id: 'entity:' + type + ':' + entry.id,
        title: title,
        subtitle: subtitle,
        category: CATEGORIES.objects,
        group: 'objects',
        kind: type,
        entityId: entry.id,
        keywords: [title, entry.id, subtitle, type],
        action: function () {
          openObject(type, entry.id, title);
        }
      };
    });
  }

  function mapLegacyKind(kind) {
    const k = String(kind || '').toLowerCase();
    if (k === 'квест' || k === 'quest') return 'quest';
    if (k === 'сцена' || k === 'scene') return 'scene';
    if (k === 'предмет' || k === 'item') return 'item';
    if (k === 'персонаж' || k === 'npc') return 'npc';
    if (k === 'враг' || k === 'enemy') return 'enemy';
    if (k === 'класс' || k === 'class') return 'class';
    return kind;
  }

  const origSearchEntities = Commands.searchEntities.bind(Commands);
  Commands.searchEntities = function searchEntitiesV16(query) {
    const viaIndex = searchObjectsViaContentIndex(query);
    if (viaIndex) return viaIndex;
    return origSearchEntities(query).map((item) => ({
      ...item,
      subtitle: item.subtitle || TYPE_LABELS[mapLegacyKind(item.kind)] || item.kind,
      action: function () {
        openObject(mapLegacyKind(item.kind), item.entityId, item.title);
      }
    }));
  };

  const origSearchUnified = Commands.searchUnified.bind(Commands);
  Commands.searchUnified = function searchUnifiedV16(query) {
    const results = origSearchUnified(query);
    return results.map((item) => {
      if (item.group === 'objects' && item.title && !item.subtitle) {
        const m = String(item.id || '').match(/^entity:([^:]+):/);
        const kind = m ? m[1] : item.kind;
        item.subtitle = TYPE_LABELS[kind] || item.kind || 'Объект';
      }
      if (item.group === 'recent') item.category = CATEGORIES.recent;
      if (item.group === 'objects') item.category = CATEGORIES.objects;
      return item;
    });
  };

  const origRun = Commands.run.bind(Commands);
  Commands.run = function runV16(id, opts) {
    if (String(id).startsWith('entity:')) {
      const parts = String(id).split(':');
      const type = parts[1];
      const entityId = parts.slice(2).join(':');
      return openObject(type, entityId) !== false;
    }
    return origRun(id, opts);
  };

  Commands.registerMany([
    {
      id: 'nav.go_scene',
      title: 'Перейти к сцене',
      category: CATEGORIES.navigation,
      keywords: ['go', 'scene', 'сцена', 'goto'],
      action: safe(function () {
        this.switchTab?.('scenes');
        const sid = this.currentScene || this.data?.startScene;
        if (sid && typeof this.openSceneWorkspace === 'function') {
          this.openSceneWorkspace(sid);
        } else if (typeof this.renderSceneList === 'function') {
          this.renderSceneList();
        }
      })
    },
    {
      id: 'nav.content_browser',
      title: 'Открыть Content Browser',
      category: CATEGORIES.navigation,
      keywords: ['content', 'browser', 'контент', 'список'],
      action: safe(function () {
        this.switchTab?.('scenes');
        if (typeof this.renderSceneList === 'function') this.renderSceneList();
      })
    },
    {
      id: 'nav.project_graph',
      title: 'Открыть карту сюжета',
      category: CATEGORIES.navigation,
      keywords: ['graph', 'story', 'граф', 'сюжет'],
      action: safe(function () {
        this.switchTab?.('graph');
      })
    },
    {
      id: 'ui16.create.scene',
      title: 'Создать сцену',
      category: CATEGORIES.create,
      keywords: ['create', 'scene', 'новая сцена'],
      action: safe(function () {
        this.switchTab?.('scenes');
        this.openSceneWizard();
      })
    },
    {
      id: 'ui16.create.item',
      title: 'Создать предмет',
      category: CATEGORIES.create,
      keywords: ['create', 'item', 'предмет'],
      action: safe(function () {
        if (typeof this.createContentEntity === 'function') {
          this.createContentEntity('item');
        } else {
          this.switchTab?.('items');
          this.createItem?.();
        }
      })
    },
    {
      id: 'ui16.create.quest',
      title: 'Создать квест',
      category: CATEGORIES.create,
      keywords: ['create', 'quest', 'квест'],
      action: safe(function () {
        if (typeof this.createContentEntity === 'function') {
          this.createContentEntity('quest');
        } else if (typeof this.openQuestWizard === 'function') {
          this.openQuestWizard();
        } else {
          this.createQuest?.();
        }
      })
    },
    {
      id: 'ui16.validate.project',
      title: 'Проверить проект',
      category: CATEGORIES.validation,
      keywords: ['validate', 'lint', 'проверка', 'ошибки'],
      action: safe(function () {
        if (typeof this.runProjectValidation === 'function') {
          this.runProjectValidation();
        }
      })
    },
    {
      id: 'ui16.preview.project',
      title: 'Превью проекта',
      category: CATEGORIES.preview,
      keywords: ['preview', 'play', 'test', 'превью', 'тест'],
      action: safe(function () {
        if (typeof this.previewScene === 'function') {
          this.previewScene({ mode: 'project' });
        } else if (typeof this.testCurrentScene === 'function') {
          this.testCurrentScene();
        }
      })
    },
    {
      id: 'ui16.export.project',
      title: 'Экспорт проекта',
      category: CATEGORIES.export,
      keywords: ['export', 'save', 'экспорт', 'сохранить'],
      action: safe(function () {
        if (typeof this.openExportMenu === 'function') {
          const btn = document.getElementById('export-menu-toggle');
          if (btn) btn.click();
          else this.openExportMenu();
        } else if (typeof this.exportJSON === 'function') {
          this.exportJSON();
        }
      })
    }
  ]);

  // Re-categorize legacy built-ins for palette grouping
  const legacyCategoryMap = {
    'Навигация': CATEGORIES.navigation,
    'Сцены': CATEGORIES.navigation,
    'Квесты': CATEGORIES.create,
    'Контент': CATEGORIES.create,
    'Действия': CATEGORIES.create,
    'Проект': CATEGORIES.project,
    'Быстрые действия': CATEGORIES.preview,
    'Правка': CATEGORIES.project,
    'Инструменты': CATEGORIES.project
  };

  Commands.list().forEach((cmd) => {
    if (legacyCategoryMap[cmd.category]) {
      cmd.category = legacyCategoryMap[cmd.category];
    }
    if (/preview|превью|тест/i.test(cmd.title + cmd.id)) {
      cmd.category = CATEGORIES.preview;
    }
    if (/провер/i.test(cmd.title) || cmd.id === 'project.validate') {
      cmd.category = CATEGORIES.validation;
    }
    if (/экспорт|export|сохран/i.test(cmd.title)) {
      cmd.category = CATEGORIES.export;
    }
  });

  if (typeof Editor.openProjectSearch === 'function') {
    Editor.openProjectSearch = function openProjectSearchViaPalette(prefill) {
      if (typeof Editor.openCommandPalette === 'function') {
        Editor.openCommandPalette(prefill);
        return;
      }
      Editor._searchOpen = true;
      Editor._searchQuery = prefill != null ? String(prefill) : '';
      Editor.renderProjectSearchModal?.();
    };
  }

  Editor.getCommandPaletteCategories = function () {
    return Object.assign({}, CATEGORIES);
  };

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-command-palette-v2', {
      getCommandPaletteCategories: Editor.getCommandPaletteCategories,
      openObjectFromPalette: openObject
    }, { force: true });
  }

  console.info('[Editor.CommandPaletteV2] ready');
})();
