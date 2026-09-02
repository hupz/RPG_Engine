/* generated from ru.json */
window.I18N_LOCALES = window.I18N_LOCALES || {};
window.I18N_LOCALES['ru'] = {
  "lang": {
    "ru": "RU",
    "en": "EN",
    "switchTitle": "Язык интерфейса"
  },
  "common": {
    "save": "Сохранить",
    "cancel": "Отмена",
    "delete": "Удалить",
    "create": "Создать",
    "load": "Загрузить",
    "play": "Играть",
    "export": "Экспорт",
    "close": "Закрыть",
    "yes": "Да",
    "no": "Нет",
    "ok": "OK",
    "loading": "Загрузка…",
    "emptyLoadData": "Загрузите данные",
    "noProject": "Нет открытого проекта",
    "loadDataHint": "Загрузите данные...",
    "help": "Справка",
    "guide": "Руководство",
    "themeToggle": "Переключить тему",
    "error": "Ошибка",
    "success": "Готово"
  },
  "editor": {
    "pageTitle": "MythMill RpgEngine — Редактор",
    "title": "MythMill RpgEngine",
    "titleTooltip": "На дашборд",
    "dashboard": {
      "title": "Дашборд проекта",
      "emptyHint": "Создайте новый проект или загрузите game_data.json.",
      "newBtn": "Новый проект",
      "loadBtn": "Загрузить JSON",
      "saveJson": "Сохранить в JSON",
      "exportHtml": "Экспорт в HTML",
      "quickActions": "Быстрые действия",
      "newScene": "Новая сцена",
      "saveJsonFile": "Сохранить JSON",
      "exportGame": "Экспорт игры",
      "statsScenes": "Сцен",
      "statsQuests": "Квестов",
      "statsEnemies": "Врагов",
      "statsItems": "Предметов",
      "statsClasses": "Классов",
      "statsAbilities": "Умений",
      "warnTitle": "Предупреждения",
      "warnBroken": "Битых ссылок: {errors}, тупиков: {deadEnds}.",
      "warnOk": "Критичных битых ссылок не найдено.",
      "validateBtn": "Проверить проект",
      "themePreview": "Тема интерфейса"
    },
    "newProject": {
      "title": "📄 Новый проект",
      "projectName": "Название проекта",
      "namePlaceholder": "Моя новая игра",
      "ruleSystem": "Система правил",
      "cancel": "Отмена",
      "create": "Создать проект",
      "enterName": "Введите название проекта.",
      "defaultTitle": "Моя новая игра",
      "defaultDescription": "Новый проект",
      "startLocation": "Начало",
      "startText": "Добро пожаловать!",
      "noTitle": "Без названия",
      "editMeta": "✏️ Мета"
    },
    "loadJson": "Загрузить JSON",
    "saveProject": "Сохранить проект",
    "saveProjectTitle": "Сохранить или экспортировать проект",
    "validate": "Проверить проект",
    "hints": "Подсказки",
    "hintsTitle": "Показать все подсказки",
    "hintsHideTitle": "Скрыть все подсказки",
    "exportMenuLabel": "Формат сохранения",
    "exportJsonTitle": "Сохранить в JSON",
    "exportJsonDesc": "Продолжить работу в редакторе",
    "exportJsonTooltip": "Сохраняет проект для дальнейшего редактирования. Открывается в редакторе.",
    "exportDivider": "или готовая игра",
    "exportHtmlTitle": "Экспортировать в HTML",
    "exportHtmlDesc": "Один файл для публикации",
    "exportHtmlTooltip": "Создаёт готовую игру для публикации. Нельзя отредактировать позже.",
    "exportFolderTitle": "Экспорт в папку",
    "exportFolderDesc": "Расширенный вариант (Chrome)",
    "exportFolderTooltip": "Папка с index.html и ресурсами (Chrome / Edge)",
    "sidebarScenes": "Сцены",
    "newScene": "+ Новая сцена",
    "sidebarStats": "Статистика",
    "sidebarProject": "Проект",
    "writerMode": {
      "label": "Режим писателя",
      "levelAriaLabel": "Уровень редактора",
      "levels": {
        "writer": "✏️ Писатель",
        "cartographer": "🗺️ Картограф",
        "engineer": "⚙️ Инженер"
      },
      "hints": {
        "writer": "Текст сцен, выборы, квесты и персонажи — без технических панелей.",
        "cartographer": "Писатель + карта истории в рабочей области и чеклист связности.",
        "engineer": "Полный доступ: JSON, баланс, флаги, события входа и отладка."
      },
      "cartographerBadge": " · карта",
      "toggleAdvancedMode": "⚙️ Advanced Mode",
      "toggleEngineer": "⚙️ Инженер",
      "toggleWriterMode": "✏️ Writer Mode"
    },
    "writerModeFull": "Полный режим",
    "writerModeHint": "Скрывает баланс, климат, JSON и другие технические разделы.",
    "tabsLabel": "Разделы редактора",
    "nav": {
      "label": "Навигация редактора",
      "scenes": "Сцены",
      "items": "Предметы",
      "quests": "Квесты",
      "npcs": "NPC",
      "enemies": "Враги",
      "classes": "Классы",
      "abilities": "Умения",
      "craft": "Крафт",
      "achievements": "Достижения",
      "assets": "Ассеты",
      "settings": "Настройки",
      "help": "Справка",
      "game_ui": "Игровой UI",
      "groups": {
        "create": "Создание",
        "content": "Контент",
        "tools": "Инструменты",
        "advanced": "Расширенные"
      },
      "tools": {
        "validate": {
          "label": "Проверить",
          "title": "Проверить проект"
        },
        "preview": {
          "label": "Preview",
          "title": "Play current scene or project start in isolated test mode"
        },
        "export": {
          "label": "Экспорт",
          "title": "Сохранить или экспортировать проект"
        }
      },
      "onboarding": {
        "noProject": "Загрузите проект или создайте новый на дашборде.",
        "noScenes": "Создайте первую сцену — с неё начинается игра.",
        "firstSceneBtn": "+ Первая сцена",
        "openScene": "Откройте сцену из списка слева или создайте новую.",
        "newSceneBtn": "+ Новая сцена",
        "startScene": "Начните с стартовой сцены — отредактируйте текст и выборы."
      },
      "commands": {
        "story": "Сюжет / карта истории",
        "categoryTools": "Инструменты"
      }
    },
    "mobileGateTitle": "Редактор доступен только на ПК",
    "mobileGateBody": "Для создания и правки модулей используйте компьютер с шириной экрана от 768px. На телефоне можно играть и тестировать сценарий.",
    "mobileGateEngineerTitle": "Инженерный режим недоступен на тач-экране",
    "mobileGateEngineerBody": "Конструкторы классов, баланса, JSON и другие технические разделы пока только с мышью. Переключитесь в режим писателя для сцен, квестов и карты сюжета.",
    "mobileGateWriterBtn": "✏️ Режим писателя",
    "mobileGateOpenGame": "Открыть игру",
    "startWelcome": "Добро пожаловать в редактор!",
    "startIntro": "Создавайте текстовые RPG с нуля или редактируйте существующие проекты.",
    "startNew": "Создать новый проект",
    "startLoad": "Загрузить game_data.json",
    "sceneElements": {
      "onEnterTitle": "При входе в сцену",
      "onEnterHint": "Срабатывает сразу при входе (флаги, музыка, скрипты).",
      "onEnterEmpty": "Нет элементов при входе.",
      "mainTitle": "Элементы сцены",
      "mainHint": "Выполняются сверху вниз после текста сцены. Порядок важен.",
      "mainEmpty": "Пока нет элементов. Добавьте бой, предметы, проверки, показ выборов и т.д.",
      "addElement": "+ Добавить элемент",
      "pickerTitle": "Выберите тип элемента",
      "deleteConfirm": "Удалить этот элемент?",
      "enabled": "Включён",
      "firstVisitOnly": "Только первый визит",
      "advanced": "Дополнительно (NPC, хаб, карта, special, компоненты)",
      "npcId": "NPC сцены (репутация)",
      "skill": "Навык",
      "dc": "Сложность (DC)",
      "successText": "Текст при успехе",
      "failText": "Текст при провале",
      "enemies": "Враги",
      "addEnemy": "Добавить врага",
      "nextScene": "Сцена после победы",
      "item": "Предмет",
      "count": "Количество",
      "flagKey": "Ключ флага",
      "flagValue": "Значение",
      "quest": "Квест",
      "stage": "Стадия",
      "effect": "ID эффекта",
      "duration": "Длительность (ходов)",
      "achievement": "Достижение",
      "imageSrc": "Путь к изображению",
      "caption": "Подпись",
      "actionId": "ID действия",
      "chainId": "ID цепочки",
      "paramsJson": "Параметры (JSON)",
      "text": "Текст",
      "targetScene": "Целевая сцена",
      "amount": "Количество",
      "showChoicesHint": "Показывает выборы сцены в этой точке последовательности.",
      "serviceMenuHint": "Параметры компонента service_menu (JSON).",
      "types": {
        "skill_check": "Проверка навыка",
        "combat": "Бой",
        "give_item": "Выдать предмет",
        "remove_item": "Забрать предмет",
        "set_flag": "Изменить флаг",
        "quest_start": "Запустить квест",
        "quest_complete": "Завершить квест",
        "add_status": "Наложить статус",
        "remove_status": "Снять статус",
        "achievement": "Достижение",
        "service_menu": "Сервисное меню",
        "music": "Музыка",
        "image": "Изображение",
        "custom_action": "Действие / цепочка",
        "show_choices": "Показать выборы",
        "show_text": "Текст (блок)",
        "change_scene": "Переход на сцену",
        "award_gold": "Золото",
        "award_exp": "Опыт"
      }
    },
    "tabs": {
      "scenes": "🎬 Сцены",
      "scene_templates": "📋 Шаблоны",
      "actions": "🔗 Действия",
      "quests": "📜 Квесты",
      "snippets": "📝 Сниппеты",
      "reputation": "🤝 Репутация",
      "achievements": "🏆 Достижения",
      "analytics": "📈 Аналитика",
      "npcs": "👥 NPC",
      "enemies": "⚔️ Враги",
      "beasts": "🐾 Звери",
      "balance": "⚖️ Баланс",
      "items": "🎒 Предметы",
      "ingredients": "🧪 Ингредиенты",
      "recipes": "🔨 Рецепты",
      "classes": "🏅 Классы",
      "races": "🧬 Расы",
      "abilities": "✨ Умения",
      "audio": "🔊 Звуки",
      "theme": "🎨 Тема",
      "climate": "🌍 Климат",
      "world": "🌍 Мир",
      "worldmap": "🗺️ Карта путешествий",
      "graph": "🗺️ Карта сюжета",
      "progression": "📈 Прогрессия",
      "json": "📄 JSON",
      "player_characters": "🦸 Герой",
      "variables": "📊 Переменные",
      "prefabs": "📦 Префабы",
      "media": "🖼 Медиа"
    },
    "project": {
      "name": "Название",
      "version": "Версия",
      "author": "Автор",
      "system": "Система",
      "editMeta": "Мета",
      "noProject": "Нет проекта"
    },
    "export": {
      "htmlModalTitle": "Экспорт в HTML",
      "htmlModalText": "Экспорт в HTML создаёт финальную версию игры в одном файле. Этот файл нельзя открыть в редакторе для правок. Убедитесь, что проект завершён.",
      "htmlModalHint": "Перед экспортом автоматически сохранится резервная копия JSON в браузере.",
      "htmlCancel": "Отмена",
      "htmlConfirm": "Да, экспортировать",
      "noData": "Нет данных проекта. Создайте или загрузите JSON.",
      "jsonSaved": "Сохранено: {filename}",
      "backupRestore": "Найдена резервная копия «{title}» (перед HTML-экспортом, {when}).\n\nВосстановить проект?",
      "htmlTooLarge": "Размер HTML-файла ~{mb} МБ (лимит рекомендации 3 МБ). Браузер может долго скачивать или открывать такой файл.\n\nПродолжить экспорт?",
      "htmlDone": "HTML экспортирован: {filename}",
      "saveJsonToo": "Резервная копия JSON сохранена в браузере.\n\nСохранить JSON-файл на диск на всякий случай?",
      "loadOk": "Данные загружены: {title}",
      "loadFail": "Ошибка: {message}",
      "newProjectConfirm": "У вас есть открытый проект. Создать новый? Несохранённые изменения будут потеряны.",
      "projectCreated": "Проект «{title}» создан ({system}).",
      "jsonSavedToast": "Сохранено: {filename}",
      "fileSavedAlert": "Файл сохранён как {filename}",
      "htmlBuildFail": "Не удалось собрать HTML.\n\n{message}\n\nОткройте editor.html через http://localhost или Live Server (не file://).",
      "folderUnsupported": "Экспорт в папку поддерживается в Chromium (Chrome, Edge, Brave).\nОткройте editor.html через http://localhost или Live Server.",
      "folderPickFail": "Не удалось выбрать папку: {message}",
      "folderDone": "Экспорт в папку завершён.\nОткройте index.html в выбранной папке.",
      "exportError": "Ошибка экспорта: {message}",
      "recently": "недавно",
      "defaultProject": "Проект",
      "defaultGame": "Игра",
      "migrateNoObject": "Файл не содержит объект JSON проекта"
    },
    "uiIntegration": {
      "selectScene": "Выберите сцену"
    },
    "productHardening": {
      "templatesUnavailable": "Шаблоны недоступны"
    },
    "validationPhaseH": {
      "exportReady": "✓ Проект готов к экспорту (Phase H)",
      "exportWithWarnings": "⚠ Экспорт возможен с предупреждениями: {count}",
      "exportBlocked": "✗ Экспорт заблокирован: {count} ошибок"
    },
    "touchUi": {
      "noOtherScenes": "Нет других сцен для связи",
      "linkModalTitle": "Связать с…",
      "linkModalHint": "Выберите сцену — будет создан выбор с переходом.",
      "cancel": "Отмена",
      "link": "Связать",
      "moveToast": "Перетащите сцену пальцем, чтобы переместить",
      "done": "Готово",
      "moveModeHint": "Режим перемещения: потяните сцену. Нажмите «Готово», чтобы выйти.",
      "outputs": "Выходов: {count}",
      "linkAction": "Связать с…",
      "moveAction": "Переместить",
      "openScene": "Открыть сцену",
      "touchLinkHint": "На тач-экране связи создаются через «Связать с…», не перетаскиванием.",
      "dragNodeToast": "Потяните узел для перемещения"
    },
    "assistantUi": {
      "panelAriaLabel": "Опиши сцену",
      "panelTitle": "✨ Опиши сцену текстом",
      "panelHint": "Черновик собирается только из шаблонов, writerSafe-действий и условий каталога — без произвольного JSON.",
      "inputPlaceholder": "Например: Таверна — диалог с барменом; выбор — пойти в лес или вернуться в деревню",
      "draftBtn": "Сформировать черновик",
      "applyBtn": "Применить",
      "previewHint": "Введите описание и нажмите «Сформировать черновик».",
      "emptyDescriptionWarning": "Введите описание сцены",
      "reviewCount": "⚠ Элементов на проверку: {count} (не будут применены молча)",
      "error": "Ошибка: {errors}",
      "sceneCreated": "Сцена создана: {sceneId}"
    },
    "validatorNavigation": {
      "issueTitles": {
        "missing_scene": "Broken Scene Link",
        "broken_transition": "Broken Scene Link",
        "element_missing_scene": "Broken Scene Link",
        "missing_item": "Missing Item Reference",
        "missing_quest": "Missing Quest Reference",
        "missing_npc": "Missing Character Reference",
        "missing_enemy": "Missing Enemy Reference",
        "missing_asset_ref": "Missing Asset",
        "missing_asset_src": "Empty Asset Source",
        "empty_asset": "Empty Asset",
        "unknown_action": "Unknown Action",
        "action_not_in_catalog": "Unknown Action",
        "missing_action_id": "Invalid Action",
        "malformed_action": "Malformed Action",
        "action_js_call": "Unsafe Action",
        "missing_action_param": "Incomplete Action",
        "malformed_condition": "Invalid Condition",
        "invalid_quest_stage": "Invalid Quest Stage",
        "invalid_amount": "Invalid Number",
        "invalid_combat_params": "Invalid Combat Setup",
        "no_scenes": "No Scenes",
        "empty_scene": "Empty Scene",
        "orphan_scene": "Unreachable Scene",
        "unreachable_scene": "Unreachable Scene",
        "duplicate_id": "Duplicate ID",
        "npc_no_description": "Missing NPC Description",
        "export_no_scenes": "Export Blocked",
        "export_old_data_version": "Outdated Data Version",
        "macro_id_in_json": "Macro in JSON"
      },
      "sections": {
        "content": "Content",
        "choices": "Choices",
        "visual": "Visual",
        "conditions": "Conditions",
        "game_ui": "Game UI",
        "advanced": "Advanced"
      },
      "severity": {
        "warning": "Warning",
        "info": "Suggestion",
        "default": "Validation Issue"
      },
      "descriptions": {
        "brokenSceneLink": "The {trigger} points to a scene that does not exist ({targetId}).",
        "triggerElement": "element",
        "triggerButton": "button \"{text}\"",
        "triggerObject": "object \"{label}\"",
        "choiceFallback": "Choice {n}",
        "missingItem": "An action references item \"{id}\" which is not in the project.",
        "missingNpc": "An action references character \"{id}\" which is not in the project.",
        "missingEnemy": "An action references enemy \"{id}\" which is not in the project.",
        "emptyScene": "This scene has no text, choices, or visual content for the player.",
        "reviewIssue": "Review this issue in the editor."
      },
      "locationSep": " → ",
      "actions": {
        "openAndFix": "Open and Fix",
        "open": "Open",
        "autoFix": "Auto-fix",
        "fixed": "Fixed"
      },
      "groups": {
        "errors": "ERRORS",
        "warnings": "WARNINGS",
        "info": "INFO",
        "noIssues": "No issues found"
      },
      "modal": {
        "title": "Project Validation",
        "close": "Close",
        "recheck": "Re-check",
        "autoFixSafe": "Auto-fix safe issues ({count})",
        "autoFixPreview": "Auto-fix: {preview}",
        "summaryErrors": "ERRORS {count}",
        "summaryWarnings": "WARNINGS {count}",
        "summaryInfo": "INFO {count}"
      }
    },
    "exportFlow": {
      "formats": {
        "json": {
          "label": "Project JSON",
          "description": "Editable project file for the RPG Engine editor."
        },
        "html": {
          "label": "Standalone HTML",
          "description": "Single self-contained HTML file with inlined runtime."
        },
        "folder": {
          "label": "Web Folder",
          "description": "index.html + scripts folder (Chrome / Edge)."
        }
      },
      "confirm": {
        "message": "Перед экспортом найдены проблемы:\nОшибок: {errors}{warningsPart}\n\nЭкспорт с ошибками может сломать игру. Продолжить?",
        "warningsPart": ", предупреждений: {warnings}",
        "confirmLabel": "Продолжить",
        "cancelLabel": "Отмена"
      },
      "toast": {
        "exportBlocked": "Export blocked: {count} critical error(s)",
        "noProjectData": "No project data loaded",
        "exportBlockedFix": "Export blocked: fix critical errors first",
        "loadProjectFirst": "Load or create a project first"
      },
      "panel": {
        "title": "Export Project",
        "closeAria": "Close",
        "projectLabel": "Project",
        "formatSection": "Export format",
        "validationSection": "Validation status",
        "errorsStat": "{count} Errors",
        "warningsStat": "{count} Warnings",
        "blockedNote": "Export is blocked until critical errors are fixed.",
        "warningsNote": "Warnings do not block export.",
        "passedNote": "Project passed export validation.",
        "reviewIssues": "Review issues",
        "cancel": "Cancel",
        "exportProject": "Export Project",
        "exportAnyway": "Export Anyway"
      },
      "result": {
        "title": "Export complete",
        "lead": "Your export finished successfully.",
        "generatedFiles": "Generated files",
        "downloadStarted": "Download started in your browser.",
        "done": "Done",
        "htmlNote": "Standalone HTML uses the existing inlined runtime build.",
        "folderNote": "Folder export uses the browser folder picker; open the chosen directory in your file manager.",
        "folderFiles": "index.html, js/data.js, css/*, js/*, audio files (if used)"
      },
      "untitledProject": "Untitled Project",
      "defaultSlug": "project"
    },
    "authorGuidance": {
      "contextHints": {
        "visual": "Используйте для интерактивных локаций и объектов на сцене.",
        "game_ui": "Используйте для HUD и постоянных элементов управления.",
        "conditions": "Условия определяют, когда что-то доступно игроку.",
        "choices": "Выборы — это действия игрока в текстовой сцене.",
        "content": "Текст сцены и модули задают, что видит игрок.",
        "items": "Предметы выдаются в квестах, сценах и бою.",
        "quests": "Квесты связывают сцены, цели и награды.",
        "combat": "Враги используются в боевых сценах и заданиях."
      },
      "emptyStates": {
        "project": {
          "title": "Welcome to your RPG project",
          "explanation": "Create your first scene — that is where the game begins.",
          "primaryLabel": "Create First Scene"
        },
        "scene": {
          "title": "Сцена не открыта",
          "explanation": "Откройте сцену из списка слева или создайте новую.",
          "primaryLabel": "Создать сцену"
        },
        "content": {
          "title": "Сцена пуста",
          "explanation": "Добавьте текст или модуль, чтобы игрок увидел содержание сцены.",
          "primaryLabel": "Добавить модуль"
        },
        "choices": {
          "title": "Нет выборов",
          "explanation": "Добавьте варианты ответа, чтобы игрок мог действовать.",
          "primaryLabel": "Добавить выбор"
        },
        "visual": {
          "title": "Нет visual-контента",
          "explanation": "Добавьте фон или интерактивный объект на сцену.",
          "primaryLabel": "Добавить объект"
        },
        "game_ui": {
          "title": "Нет UI-экранов",
          "explanation": "Создайте HUD или меню — элементы управления для игрока.",
          "primaryLabel": "Создать экран"
        },
        "conditions": {
          "title": "Нет условий",
          "explanation": "Условия управляют видимостью сцены, выборов и объектов.",
          "primaryLabel": "Добавить условие"
        },
        "items": {
          "title": "Нет предметов",
          "explanation": "Создайте предметы для квестов, наград и инвентаря.",
          "primaryLabel": "Создать предмет"
        },
        "quests": {
          "title": "Нет квестов",
          "explanation": "Задайте цель игроку — квест связывает сцены и награды.",
          "primaryLabel": "Создать квест"
        },
        "combat": {
          "title": "Нет врагов",
          "explanation": "Создайте врагов для боевых сцен и заданий.",
          "primaryLabel": "Создать врага"
        },
        "content_category": {
          "title": "Нет объектов",
          "explanation": "Создайте первый объект в этой категории.",
          "primaryLabel": "Создать"
        }
      },
      "noProject": {
        "title": "Нет открытого проекта",
        "explanation": "Загрузите проект или создайте новый на стартовом экране.",
        "primaryLabel": "Загрузить проект"
      },
      "dismissHintTitle": "Скрыть подсказку",
      "dismissHintAria": "Скрыть подсказку"
    },
    "previewWorkflow": {
      "defaultProject": "Проект",
      "noSceneLabel": "—",
      "returnToEditor": "Возврат в редактор",
      "noProjectData": "Нет данных проекта",
      "testIsolationUnavailable": "Изоляция теста недоступна",
      "previewPrepareFailed": "Не удалось подготовить превью",
      "previewOpened": "Превью открыто — EDITOR TEST MODE",
      "genericError": "Ошибка",
      "warningsAllowed": "Предупреждений: {count} — превью разрешено.",
      "beforePreview": "Перед превью",
      "errorOneFound": "ошибка найдено.",
      "errorsManyFound": "ошибок найдено.",
      "noErrors": "Ошибок нет.",
      "fix": "Исправить",
      "previewAnyway": "Превью всё равно",
      "continue": "Продолжить",
      "cancel": "Отмена",
      "noSceneForPreview": "Нет сцены для превью",
      "previewWithWarnings": "Превью с {count} предупр.",
      "menuHeading": "Превью",
      "playCurrentScene": "Играть текущую сцену",
      "playFromStart": "Играть с начала проекта",
      "previewTitle": "Превью в изолированном тестовом режиме",
      "previewLabel": "Превью",
      "globalPreviewLabel": "▶ Превью",
      "currentSceneTitle": "Текущая сцена",
      "selectScene": "Выберите сцену"
    },
    "sceneWorkspacePolish": {
      "sections": {
        "overview": {
          "title": "Обзор",
          "desc": "Сводка по сцене и быстрые переходы."
        },
        "content": {
          "title": "Контент",
          "desc": "Текст сцены и сюжетные модули.",
          "addModule": "+ Добавить модуль"
        },
        "choices": {
          "title": "Выборы",
          "desc": "Варианты ответа игрока в этой сцене.",
          "addChoice": "+ Добавить выбор"
        },
        "visual": {
          "title": "Visual",
          "desc": "Интерактивные объекты и hotspots сцены.",
          "addObject": "+ Добавить объект"
        },
        "gameUi": {
          "title": "Game UI",
          "desc": "HUD и UI-экраны, связанные с проектом.",
          "addUi": "+ Добавить UI-элемент"
        },
        "conditions": {
          "title": "Условия",
          "desc": "Видимость сцены, выборов и объектов.",
          "addCondition": "+ Добавить условие"
        },
        "advanced": {
          "title": "Advanced",
          "desc": "ID, тип сцены и данные для продвинутого режима."
        }
      },
      "breadcrumb": {
        "ariaLabel": "Навигация по сцене",
        "project": "Проект",
        "unsavedTitle": "Несохранённые изменения"
      }
    },
    "commandPaletteV2": {
      "categories": {
        "navigation": "Навигация",
        "create": "Создание",
        "project": "Проект",
        "preview": "Превью",
        "validation": "Проверка",
        "export": "Экспорт",
        "objects": "Объекты",
        "recent": "Недавние"
      },
      "typeLabels": {
        "scene": "Сцена",
        "visual_scene": "Сцена",
        "quest": "Квест",
        "item": "Предмет",
        "npc": "NPC",
        "player_character": "Герой",
        "enemy": "Враг",
        "ui_screen": "Game UI",
        "asset": "Ассет"
      },
      "defaultObject": "Объект",
      "commands": {
        "goScene": "Перейти к сцене",
        "contentBrowser": "Открыть Content Browser",
        "projectGraph": "Открыть карту сюжета",
        "createScene": "Создать сцену",
        "createItem": "Создать предмет",
        "createQuest": "Создать квест",
        "projectValidate": "Проверить проект",
        "previewProject": "Превью проекта",
        "exportProject": "Экспорт проекта"
      }
    },
    "contentBrowserV2": {
      "categories": {
        "scenes": "Сцены",
        "quests": "Квесты",
        "items": "Предметы",
        "npcs": "NPC",
        "characters": "Герои",
        "combat": "Бой",
        "game_ui": "Игровой UI",
        "assets": "Ассеты"
      },
      "search": {
        "noMatch": "Ничего не найдено по запросу «{query}»",
        "resultsTitle": "Результаты поиска ({count})"
      },
      "recentTitle": "Недавно открыто",
      "categoryNavAria": "Категории контента",
      "welcome": {
        "title": "Добро пожаловать в ваш RPG-проект",
        "body": "Начните с первой сцены — квесты, предметы и визуал тоже здесь.",
        "createFirstScene": "Создать первую сцену",
        "chooseTemplate": "Выбрать шаблон"
      },
      "indexNotLoaded": "Content index не загружен",
      "empty": {
        "noObjects": "Нет объектов",
        "categoryEmpty": "Категория «{label}» пуста. Создайте первый объект.",
        "categoryEmptyShort": "Категория «{label}» пуста."
      },
      "create": {
        "quest": "+ Создать квест",
        "item": "+ Создать предмет",
        "npc": "+ Создать NPC",
        "player_character": "+ Создать героя",
        "enemy": "+ Создать врага",
        "ui_screen": "+ Создать UI-экран",
        "asset": "+ Добавить ассет",
        "default": "+ Создать",
        "toggle": "+ Создать"
      },
      "sceneFilters": {
        "all": "Все",
        "text": "Text",
        "visual": "Visual",
        "mixed": "Mixed",
        "searchPlaceholder": "🔍 Поиск сцен…",
        "filterAria": "Фильтр типа сцены",
        "sortLabel": "Сортировка",
        "sortTitle": "По имени",
        "sortTitleDesc": "Имя (Я→А)",
        "sortKind": "По типу"
      },
      "chrome": {
        "contentTitle": "CONTENT",
        "globalSearchPlaceholder": "🔍 Поиск по проекту…"
      }
    },
    "campaignWizard": {
      "steps": {
        "genre": "Жанр и система",
        "world": "Каркас мира",
        "heroes": "Герои и NPC",
        "quest": "Первый квест",
        "publish": "Проверка и публикация"
      },
      "defaultTitle": "Моя история",
      "title": "📖 Режим истории",
      "cancel": "Отмена",
      "back": "Назад",
      "skip": "Пропустить",
      "next": "Далее",
      "closeWizard": "Закрыть мастер",
      "finishWithoutExport": "Завершить без экспорта",
      "selectPlaceholder": "— выберите —",
      "unknownStep": "Неизвестный шаг",
      "unknownStepMaster": "Неизвестный шаг мастера.",
      "publishModuleMissing": "Модуль публикации не загружен.",
      "genreHint": "Расскажите, какой мир вы создаёте — движок подготовит основу проекта.",
      "storyTitleLabel": "Название истории",
      "genreLabel": "Жанр",
      "systemLabel": "Правила игры",
      "startingResources": "Стартовый запас: {gold} монет, {hp} здоровья — можно изменить позже.",
      "blankProjectLink": "Создать пустой проект с нуля…",
      "worldHint": "Выберите каркас — из готовых шаблонов появятся связанные сцены в духе вашего жанра.",
      "worldPreviewHint": "Выберите каркас — появится схема сцен.",
      "startSceneLabel": "Стартовая сцена:",
      "regenerateWorld": "Сгенерировать заново",
      "heroesHint": "Назовите героя и ключевых персонажей — движок создаст записи и реплики.",
      "heroHeading": "🧝 Герой",
      "nameLabel": "Имя",
      "heroDescLabel": "Кратко о герое",
      "npcHeading": "👤 Персонаж {n}",
      "roleLabel": "Роль",
      "briefLabel": "Кратко",
      "phrasePreview": "Реплика: «{phrase}»",
      "questHint": "Что должен сделать игрок? Выберите цель и участников — этапы соберутся сами.",
      "questTitleLabel": "Название задания",
      "npcLabel": "Персонаж",
      "itemLabel": "Предмет",
      "enemyLabel": "Противник",
      "placeLabel": "Место",
      "rewardHeading": "Награда",
      "rewardGoldLabel": "Сколько золота",
      "rewardItemLabel": "Предмет-награда",
      "repOwnerLabel": "Чья репутация",
      "repAmountLabel": "На сколько",
      "toastRegenBlocked": "Вы уже меняли сцены — перегенерация отключена, чтобы не потерять правки.",
      "toastRegenDone": "Каркас пересобран — нажмите «Далее», чтобы применить.",
      "toastWorldFailed": "Не удалось собрать каркас мира",
      "toastWorldValidation": "Каркас не прошёл проверку — сообщите об ошибке разработчикам",
      "toastHeroesFailed": "Не удалось создать персонажей",
      "toastQuestFailed": "Не удалось создать квест",
      "toastQuestValidation": "Проект не прошёл проверку после квеста",
      "toastStepFailed": "Не удалось применить шаг мастера",
      "toastSavedResume": "Мастер сохранён — продолжите через «Новый проект»",
      "toastReportUpdated": "Отчёт обновлён",
      "toastSavedPublish": "Мастер сохранён — откройте «Новый проект», чтобы вернуться к публикации",
      "toastPreviewUnavailable": "Превью недоступно — перезагрузите редактор",
      "toastFixErrors": "Сначала исправьте ошибки в отчёте",
      "toastExportUnavailable": "Экспорт HTML недоступен",
      "toastExportSaved": "HTML-файл сохранён",
      "toastExportFailed": "Не удалось экспортировать HTML",
      "toastFinished": "Мастер «Режим истории» завершён. Продолжайте наполнять игру в режиме Писателя.",
      "toastResume": "Продолжаем мастер «Режим истории» с шага «{step}»",
      "toastSavedLater": "Мастер «Режим истории» сохранён — продолжите через «Новый проект»",
      "toastUndoDone": "Изменения мастера отменены",
      "confirmCancel": "Прервать мастер? Прогресс сохранится — продолжите через «Новый проект».\n\nНажмите «Другое…», чтобы выбрать откат созданного.",
      "confirmCancelFinish": "Завершить позже",
      "confirmCancelOther": "Другое…",
      "confirmUndo": "Откатить изменения мастера через историю отмены (undo)?",
      "confirmUndoYes": "Откатить",
      "confirmUndoKeep": "Оставить как есть",
      "confirmNoUndo": "История отмены недоступна. Закрыть мастер и оставить созданное в проекте?",
      "confirmClose": "Закрыть",
      "confirmBack": "Назад",
      "confirmOpen": "Открыть мастер «Режим истории»? Текущий проект может быть заменён на шаге «Жанр и система».",
      "confirmResume": "Есть незавершённый мастер «Режим истории». Продолжить с шага «{step}»?",
      "confirmContinue": "Продолжить",
      "confirmRestart": "Начать заново",
      "legacyTitle": "📖 Новая история",
      "legacyCreate": "✨ Создать историю",
      "legacySteps": {
        "title": "Название",
        "scenes": "Сцены",
        "npc": "NPC",
        "questCombat": "Квест и бой",
        "done": "Готово"
      },
      "legacyHint0": "Дальше соберём 3 сцены, NPC, квест и простого врага — без кода.",
      "legacyNoteLabel": "Кратко, о чём игра (для себя)",
      "legacyScenesHint": "Три локации каркаса. Позже добавите ещё на карте сюжета.",
      "legacySceneName": "Сцена {n}: название",
      "legacySceneText": "Текст (что видит игрок)",
      "legacyNpcHint": "Персонаж, с которого начнётся сюжет (обычно в первой или второй сцене).",
      "legacyNpcName": "Имя NPC",
      "legacyNpcLine": "Первая реплика",
      "legacyQuestTitle": "Название квеста",
      "legacyQuestHint": "Что сделать (для журнала)",
      "legacyCombatCheck": "Добавить простого врага и сцену боя",
      "legacyEnemyName": "Имя врага",
      "legacyReadyTitle": "Всё готово к сборке",
      "legacyReadyBody": "Будут созданы: проект «{title}», {sceneCount} сцены, NPC, квест{combatExtra}.",
      "legacyReadyCombatExtra": ", враг и бой",
      "legacyDefaultScenes": [
        {
          "name": "Начало",
          "text": "Вы стоите на пороге приключения."
        },
        {
          "name": "Деревня",
          "text": "Тихая деревня. Здесь можно найти помощь."
        },
        {
          "name": "Опасное место",
          "text": "Здесь кто-то или что-то угрожает покою."
        }
      ],
      "legacyDefaultNpc": "Старейшина",
      "legacyDefaultNpcLine": "Добро пожаловать, путник. Мне нужна твоя помощь.",
      "legacyDefaultQuest": "Первое задание",
      "legacyDefaultQuestHint": "Поговорите со старейшиной и разберитесь с угрозой.",
      "legacyDefaultEnemy": "Разбойник",
      "confirmLegacyOpen": "Создать новую историю? Текущий проект в редакторе будет заменён (файл на диске не трогаем, пока не сохраните).",
      "legacyCreated": "История «{title}» создана. Откройте карту сюжета или превью сцены.",
      "quickStoryBtn": "📖 Быстрая история (классика)",
      "npcHubWhere": "📍 Где встречается",
      "npcHubAttach": "Привязать к сцене",
      "npcHubSceneOption": "+ сцена…",
      "npcHubNotLinked": "Пока нигде не привязан. Укажите NPC на сцене или добавьте ниже.",
      "npcHubLines": "💬 Реплики",
      "npcHubNoLines": "Нет реплик",
      "npcHubAddLine": "+ Реплика",
      "npcHubQuests": "📜 Связанные квесты",
      "npcHubNoQuests": "Квестов пока нет — создайте во вкладке «Квесты».",
      "npcSceneReason": "NPC сцены",
      "npcDialogReason": "Диалог",
      "npcComponentReason": "Компонент",
      "createNpcPrompt": "Имя персонажа:",
      "createNpcDefault": "Новый житель",
      "fallbackGenres": {
        "fantasy": "Фэнтези",
        "horror": "Хоррор",
        "detective": "Детектив",
        "survival": "Выживание"
      },
      "fallbackSystems": {
        "generic": "Универсальные правила",
        "dnd5e": "Классические приключения"
      },
      "fallbackRewardGold": "Золото",
      "gameData": {
        "goTo": "Идти: {name}",
        "acceptQuest": "Принять: {title}",
        "faceEnemy": "Столкнуться с: {name}",
        "questStageStart": "Начало",
        "questStagePath": "В пути",
        "questStagePathHint": "Продолжайте путь по локациям.",
        "questStageDone": "Готово",
        "questStageDoneHint": "Задание выполнено.",
        "talkTask": "Поговорить с: {name}",
        "visitTask": "Дойти до: {location}",
        "npcDesc": "Ключевой персонаж начала истории.",
        "combatLocation": "Схватка: {name}",
        "combatText": "{name} преграждает путь!"
      }
    },
    "storyWizard": {
      "content": {
        "defaultChoiceGo": "Идти",
        "systems": {
          "generic": "Универсальные правила",
          "dnd5e": "Классические приключения",
          "pf2e": "Pathfinder"
        },
        "genres": {
          "fantasy": {
            "label": "Фэнтези",
            "defaultTitle": "Сказание о приключении",
            "description": "Рыцари, магия и древние тайны ждут героя."
          },
          "horror": {
            "label": "Хоррор",
            "defaultTitle": "Тени забытого дома",
            "description": "Мрак, страх и необъяснимое на каждом шагу."
          },
          "detective": {
            "label": "Детектив",
            "defaultTitle": "Дело без ответа",
            "description": "Улики, свидетели и разгадка в финале."
          },
          "survival": {
            "label": "Выживание",
            "defaultTitle": "После бури",
            "description": "Ресурсы на исходе — нужно дойти до безопасного места."
          }
        },
        "sceneNames": {
          "fantasy": {
            "start": "У ворот королевства",
            "hub": "Перекрёсток стражей",
            "branch1": "Тёмный лес",
            "branch2": "Руины башни",
            "branch3": "Деревня эльфов",
            "village": "Деревня Ольдвуд",
            "tavern": "Таверна «Золотой кубок»",
            "shop": "Лавка алхимика",
            "forge": "Кузница старого Грома",
            "road1": "Королевская дорога",
            "road2": "Мост через реку",
            "road3": "Поляна у ручья",
            "road4": "Ворота крепости",
            "exit": "Окраина земель"
          },
          "horror": {
            "start": "Порог заброшенного дома",
            "hub": "Пустой холл",
            "branch1": "Подвал",
            "branch2": "Мансарда",
            "branch3": "Сад с могилами",
            "village": "Мёртвая деревня",
            "tavern": "Закрытая постоялая",
            "shop": "Пустая лавка",
            "forge": "Заржавевшая кузня",
            "road1": "Туманная тропа",
            "road2": "Сломанный мост",
            "road3": "Болото",
            "road4": "Старый склеп",
            "exit": "Ворота кладбища"
          },
          "detective": {
            "start": "Приёмная детектива",
            "hub": "Городская площадь",
            "branch1": "Кабинет мэра",
            "branch2": "Склад улик",
            "branch3": "Кафе свидетелей",
            "village": "Старый квартал",
            "tavern": "Бар «Красная лампа»",
            "shop": "Ломбард",
            "forge": "Мастерская часовщика",
            "road1": "Улица фонарей",
            "road2": "Переулок у доков",
            "road3": "Архив полиции",
            "road4": "Судебный зал",
            "exit": "Вокзал"
          },
          "survival": {
            "start": "Лагерь после бури",
            "hub": "Разрушенный мост",
            "branch1": "Заросшая тропа",
            "branch2": "Заброшенная хижина",
            "branch3": "Ручей с пресной водой",
            "village": "Посёлок ущелья",
            "tavern": "Убежище у костра",
            "shop": "Запасной склад",
            "forge": "Сарай с инструментами",
            "road1": "Горная тропа",
            "road2": "Обвал на пути",
            "road3": "Пещера у скалы",
            "road4": "Спасательный пункт",
            "exit": "Безопасная поляна"
          }
        },
        "skeletons": {
          "hub_branches": {
            "label": "Хаб и три ветки",
            "description": "Центральная точка и три пути — классика ветвящегося сюжета.",
            "choices": {
              "startPath": "Начать путь",
              "path1": "Первый путь",
              "path2": "Второй путь",
              "path3": "Третий путь",
              "return": "Вернуться"
            }
          },
          "linear_road": {
            "label": "Линейная дорога",
            "description": "Последовательный путь из пяти локаций — для сюжета без развилок.",
            "choices": {
              "setOut": "В путь",
              "continue": "Идти дальше",
              "finishPath": "Завершить путь",
              "return": "Вернуться"
            }
          },
          "ready_village": {
            "label": "Готовая деревня",
            "description": "Посёлок с таверной, лавкой и кузницей — готовый хаб для истории.",
            "choices": {
              "enterVillage": "Войти в посёлок",
              "tavern": "Таверна",
              "shop": "Лавка",
              "forge": "Кузница",
              "leaveVillage": "Уйти из посёлка",
              "toSquare": "На площадь",
              "return": "Вернуться"
            }
          }
        }
      },
      "heroesQuest": {
        "roles": {
          "quest_giver": "Квестодатель",
          "merchant": "Торговец",
          "informant": "Источник информации",
          "antagonist": "Противник"
        },
        "phrases": {
          "quest_giver": "Мне нужна твоя помощь, путник. У меня есть дело для тебя.",
          "merchant": "Загляни — товар свежий, цены честные.",
          "informant": "Слышал кое-что важное. Может, пригодится.",
          "antagonist": "Тебе здесь не рады. Убирайся, пока цел.",
          "fallback": "…"
        },
        "rewards": {
          "gold": "Золото",
          "item": "Предмет",
          "reputation": "Репутация"
        },
        "defaults": {
          "heroName": "Странник",
          "heroDescription": "Главный герой вашей истории",
          "questTitle": "Первое задание",
          "npcFallback": "Персонаж",
          "acceptQuest": "Принять: {title}",
          "acceptQuestFallback": "задание",
          "rewardItemName": "Награда за подвиг",
          "rewardItemDesc": "За выполненное задание",
          "rewardPlaceholder": "Награда",
          "reputationVillage": "Местные жители"
        },
        "items": {
          "fantasy": "Старый амулет",
          "horror": "Потёртая записка",
          "detective": "Улика",
          "survival": "Запас провизии",
          "fallback": "Предмет"
        },
        "enemies": {
          "fantasy": "Разбойник",
          "horror": "Тень",
          "detective": "Подозреваемый",
          "survival": "Дикий зверь",
          "fallback": "Враг"
        },
        "defaultNpcs": {
          "fantasy": [
            {
              "name": "Старейшина",
              "role": "quest_giver",
              "description": "Правит деревней и даёт поручения"
            },
            {
              "name": "Торговец",
              "role": "merchant",
              "description": "Продаёт зелья и снаряжение"
            },
            {
              "name": "Странник",
              "role": "informant",
              "description": "Знает тропы и слухи"
            }
          ],
          "horror": [
            {
              "name": "Хозяин дома",
              "role": "quest_giver",
              "description": "Просит разобраться с тенями"
            },
            {
              "name": "Сторож",
              "role": "informant",
              "description": "Видел странное у колодца"
            },
            {
              "name": "Незнакомец",
              "role": "antagonist",
              "description": "Пугает и мешает расследованию"
            }
          ],
          "detective": [
            {
              "name": "Инспектор",
              "role": "quest_giver",
              "description": "Поручает первое дело"
            },
            {
              "name": "Свидетель",
              "role": "informant",
              "description": "Видел подозрительное"
            },
            {
              "name": "Лавочник",
              "role": "merchant",
              "description": "Торгует уликами и кофе"
            }
          ],
          "survival": [
            {
              "name": "Старший лагеря",
              "role": "quest_giver",
              "description": "Организует выживание группы"
            },
            {
              "name": "Разведчик",
              "role": "informant",
              "description": "Знает безопасные тропы"
            },
            {
              "name": "Мародёр",
              "role": "antagonist",
              "description": "Угрожает запасами"
            }
          ]
        }
      },
      "publish": {
        "heroDefault": "Герой",
        "defaultTitle": "Моя история",
        "dash": "—",
        "projectLabel": "Проект",
        "errorFallback": "Ошибка",
        "questNotSet": "квест не задан в мастере",
        "questNotCreated": "квест ещё не создан в проекте",
        "noStartScene": "нет стартовой сцены",
        "questGranted": "выдаётся в «{label}»",
        "questUnreachable": "ни один выбор с старта не запускает квест",
        "checklist": {
          "hasStart": "Есть стартовая сцена",
          "firstQuest": "Первый квест достижим",
          "sceneExit": "У каждой сцены есть хотя бы один выход",
          "hubFinal": "Финал достижим из хаба"
        },
        "checklistDetail": {
          "startAssigned": "«{id}»",
          "startDefault": "«{id}» (по умолчанию)",
          "noStart": "создайте хотя бы одну сцену и укажите старт",
          "deadEnds": "без выхода: {list}",
          "allExits": "все сцены ведут дальше или завершают историю",
          "flowSkipped": "карта сюжета недоступна — проверка пропущена",
          "hubFinalOk": "от хаба достижим финал"
        },
        "sections": {
          "checklist": "Чеклист готовности",
          "errors": "Ошибки ({count})",
          "warnings": "Предупреждения ({count})"
        },
        "validatorOk": "✓ Критических проблем валидатора не найдено — можно тестировать и экспортировать.",
        "exportBlocked": "Экспорт заблокирован",
        "exportBlockedHint": " — устраните ошибки выше:",
        "exportTitle": "Экспортировать HTML",
        "exportDisabledTitle": "Сначала исправьте ошибки",
        "header": "Проверка и публикация",
        "headerSummary": "{title} · {count} сцен · квест «{quest}»",
        "playPreview": "▶ Играть как герой",
        "refreshReport": "↻ Обновить отчёт",
        "note": "Превью и экспорт не требуют переключения вкладок. Клик по строке откроет место проблемы в редакторе.",
        "successTitle": "Игра экспортирована",
        "successHint": "Файл HTML сохранён на диск — откройте его в браузере и передайте друзьям.",
        "stats": {
          "scenes": "Сцен: {count}",
          "quest": "Квест: «{title}»",
          "heroNpc": "Герой: {hero} · NPC: {count}"
        },
        "improveTitle": "Что улучшить позже",
        "improve": {
          "warnings": "есть предупреждения валидатора — можно доработать диалоги и условия",
          "checklist": "чеклист готовности не полностью зелёный",
          "default": "добавить больше сцен, квестов и визуальных деталей"
        },
        "gotoCartographer": "🗺️ Картограф — карта сюжета",
        "gotoEngineer": "⚙️ Инженер — баланс и механики"
      }
    }
  },
  "game": {
    "pageTitle": "RPGengine",
    "pickerTitle": "RPGengine",
    "pickerIntro": "Выберите приключение. Каждая игра сохраняется отдельно.",
    "loadCustomJson": "Загрузить свой JSON",
    "pickerAria": "Выбор приключения",
    "hasSave": "Есть сохранение",
    "play": "Играть",
    "continueOrNew": "Продолжить / начать заново",
    "sidebarCharacter": "Персонаж",
    "health": "Здоровье",
    "healthTip": "Очки здоровья",
    "ac": "КД",
    "acTip": "Класс защиты",
    "attack": "Атака",
    "attackTip": "Бонус атаки",
    "damage": "Урон",
    "initiative": "Инициатива",
    "gold": "Золото",
    "goldUnit": "зм",
    "level": "Уровень",
    "levelTip": "Уровень персонажа",
    "exp": "Опыт",
    "resource": "Ресурс",
    "resourceTip": "Ресурс класса",
    "proficiencies": "Владения",
    "proficienciesEmpty": "Владения: —",
    "namePlaceholder": "Введите имя...",
    "questsTitle": "Текущие задания",
    "questsEmpty": "У вас пока нет активных заданий.",
    "rest": "Отдых",
    "restTip": "Короткий отдых восстанавливает ОЗ и ресурс",
    "supplies": "Припасов",
    "restBtn": "Отдохнуть",
    "restInfo": "С припасом: полное ОЗ и ресурс. Без припаса: половина ОЗ и ресурса.",
    "journal": "Журнал",
    "dockInventory": "Инвентарь",
    "dockAbilities": "Умения",
    "dockRelations": "Отношения",
    "dockAchievements": "Достижения",
    "dockCrafting": "Крафт",
    "dockLocation": "Локация",
    "dockWait": "Ожидание",
    "dockAudio": "Звук",
    "dockMenu": "Меню",
    "panelInventory": "Инвентарь",
    "panelAbilities": "Умения",
    "panelRelations": "Отношения",
    "panelAchievements": "Достижения",
    "panelCrafting": "Крафт",
    "panelLocation": "Локация",
    "panelWait": "Ожидание",
    "panelMenu": "Меню",
    "panelCurses": "Проклятия",
    "close": "Закрыть",
    "achievementsSummary": "Полученные — цветные; секретные до разблокировки отображаются как «???».",
    "craftingHint": "Зелёный — хватает материалов, красный — не хватает, серый — рецепт неизвестен.",
    "relationsHint": "Репутация с фракциями и NPC. Наведите на строку — подсказка о прогрессе.",
    "travelSelect": "Переместиться…",
    "travelTip": "Путешествие между локациями",
    "waitSelect": "Выберите время…",
    "menuLoadContent": "Загрузить контент JSON",
    "menuSaveGame": "Сохранить игру",
    "menuLoadGame": "Загрузить игру",
    "menuDeleteSave": "Удалить сохранение",
    "menuCampaignPicker": "К выбору игры",
    "menuReset": "Начать заново",
    "saveSlots": {
      "title": "Сохранения",
      "open": "Сохранить / загрузить",
      "slotLabel": "Слот {n}",
      "empty": "Пусто",
      "save": "Сохранить",
      "load": "Загрузить",
      "delete": "Удалить",
      "active": "активный",
      "overwrite": "Перезаписать сохранение в слоте {n}?",
      "deleteConfirm": "Удалить сохранение в слоте {n}?",
      "savedAt": "Сохранено: {date}",
      "playtime": "Время: {time}",
      "level": "Уровень {level}",
      "scene": "Локация: {name}"
    },
    "audioMusic": "Громкость музыки",
    "audioSfx": "Громкость эффектов",
    "audioOn": "Звук вкл",
    "audioOff": "Звук выкл",
    "lootTitle": "Добыча",
    "lootTake": "Забрать",
    "levelUp": "Новый уровень!",
    "dialog": {
      "ok": "OK",
      "confirm": "Да",
      "cancel": "Отмена",
      "promptPlaceholder": "Введите значение…",
      "noticeTitle": "Сообщение",
      "jsonReadError": "Ошибка чтения JSON: {message}",
      "returnToPicker": "Вернуться к выбору игры? Несохранённый прогресс может быть потерян.",
      "resetGame": "Начать новую игру? Текущий прогресс будет сброшен.",
      "deleteSave": "Удалить сохранение игры?",
      "abilityNotFound": "Умение не найдено в данных progression.abilities",
      "cancelCharCreation": "Отменить создание персонажа?"
    },
    "achievementUnlocked": "Достижение разблокировано!",
    "hintLabel": "Подсказка",
    "mobileExpandSidebar": "Развернуть панель персонажа",
    "mobileCollapseSidebar": "Свернуть панель персонажа",
    "mobileHeroDefault": "Герой",
    "worldStatusAria": "Время, дата и климат",
    "combatStatsAria": "Боевые показатели",
    "spellSlotsAria": "Ресурс / ячейки заклинаний",
    "abilitiesAria": "Характеристики",
    "dockAria": "Быстрые панели",
    "closeInventory": "Закрыть инвентарь",
    "closeAbilities": "Закрыть умения",
    "closeRelations": "Закрыть отношения",
    "closeAchievements": "Закрыть достижения",
    "closeCrafting": "Закрыть крафт",
    "closeLocation": "Закрыть локацию",
    "closeWait": "Закрыть ожидание",
    "closeAudio": "Закрыть звук",
    "closeMenu": "Закрыть меню",
    "loading": "Загрузка...",
    "charCreatorAria": "Создание персонажа",
    "turnOrderAria": "Порядок ходов",
    "sceneComponentsAria": "Компоненты сцены",
    "combatLogAria": "Журнал боя",
    "eventsAria": "События",
    "waitSkip": "Пропустить:",
    "waitHours": "ч.",
    "waitMinutes": "мин.",
    "waitBtn": "Ждать",
    "waitRest": "Отдыхать (восстановление)",
    "waitCamp": "Разбить лагерь (безопаснее)",
    "waitDawn": "🌅 Рассвет",
    "waitDusk": "🌇 Закат",
    "waitNoon": "☀️ Полдень",
    "waitMidnight": "🌙 Полночь",
    "wait15min": "15 мин",
    "wait30min": "30 мин",
    "wait1h": "1 час",
    "wait4h": "4 часа",
    "ui": {
      "actionTypes": {
        "action": "Действие",
        "bonus_action": "Бонус",
        "reaction": "Реакция",
        "passive": "Пассивное",
        "free": "Свободное"
      },
      "notYourTurn": "Не ваш ход",
      "reactionTrigger": "Срабатывает по триггеру",
      "curseSilence": "Проклятие безмолвия",
      "noSpellSlots": "Нет свободных ячеек",
      "needSpellSlots": "Нужно {cost} свободных ячеек",
      "noSpellCircle": "Нет ячеек {level} круга и выше",
      "noSlotsCircle": "Нет слотов {level} круга",
      "notEnoughResource": "Недостаточно {resource}",
      "concentrationBusy": "Концентрация занята",
      "alreadyUsedCombat": "Уже использовано в этом бою",
      "actionSpent": "Действие потрачено",
      "bonusSpent": "Бонусное действие потрачено",
      "unavailable": "Недоступно",
      "minLevel": "Доступно с {level} уровня",
      "maxLevel": "Макс. уровень",
      "reputationHostile": "Вражда",
      "reputationNeutral": "Нейтралитет",
      "reputationFriendly": "Дружба",
      "reputationHero": "Герой",
      "yes": "Да",
      "no": "Нет",
      "cancel": "Отмена",
      "continue": "Продолжить",
      "take": "Забрать",
      "nothingDropped": "Ничего не выпало.",
      "achievement": "Достижение",
      "sceneNotFound": "Ошибка: сцена «{id}» не найдена.",
      "notEnoughGold": "Недостаточно золота (нужно {price} зм).",
      "itemNotFound": "Предмет не найден",
      "questItem": "Квестовый предмет",
      "cursedNoSell": "Проклятый предмет нельзя продать",
      "unequipFirst": "Сначала снимите экипировку",
      "merchantWontBuy": "Торговец не покупает",
      "notInInventory": "Нет в инвентаре",
      "available": "доступно",
      "spent": "потрачено",
      "energy": "Энергия",
      "slots": "Ячейки"
    },
    "campaigns": {
      "melnitsa": {
        "badge": "Основная",
        "subtitle": "D&D 5e · основная игра",
        "description": "Спасите мельника Альберта. Мельница, погреб, босс Корвин и деревня."
      },
      "scifi": {
        "badge": "Демо",
        "subtitle": "Sci-Fi хоррор · generic",
        "description": "Заброшенная орбитальная станция, кислород и сигнал бедствия."
      },
      "pf2e": {
        "badge": "Демо PF2e",
        "subtitle": "Pathfinder 2e · демо-кампания",
        "description": "Деревня Горнистead: пропавший мельник, святилище фейри, уровни 1–10."
      }
    }
  },
  "tutorial": {
    "preparation": "Подготовка",
    "createProjectTitle": "Создайте проект",
    "createProjectText": "Для обучения нужен открытый проект. Нажмите «Новый проект» в шапке и подтвердите создание.",
    "createProjectWait": "Создайте проект, чтобы продолжить…",
    "stepOf": "Шаг {current} из {total}",
    "waitAction": "Выполните действие на экране, чтобы перейти дальше…",
    "skip": "Пропустить",
    "neverAgain": "Не показывать снова",
    "complete": "Обучение завершено! Можно продолжать работу над игрой.",
    "scenesListTitle": "Список сцен",
    "scenesListText": "Это список ваших сцен. Нажмите «Новая сцена», чтобы создать первую локацию.",
    "sceneFormTitle": "Название и описание",
    "sceneFormText": "Введите название локации в форме создания, нажмите «Создать», затем допишите описание в поле «Текст».",
    "npcTitle": "NPC",
    "npcText": "Добавьте NPC из панели справа — откройте вкладку NPC и нажмите «Добавить NPC».",
    "dialogueTitle": "Диалог",
    "dialogueText": "Создайте диалог: вернитесь к сцене и нажмите «+ Добавить» в блоке «Диалоги».",
    "choiceTitle": "Переход между сценами",
    "choiceText": "Добавьте кнопку перехода к другой сцене: «+ Добавить» в блоке «Выборы» и укажите целевую сцену.",
    "playTitle": "Тестирование",
    "playText": "Нажмите «Play» в панели превью справа, чтобы протестировать сцену в игре.",
    "saveTitle": "Сохранение",
    "saveText": "Сохраните проект — нажмите «Сохранить проект» в шапке редактора."
  },
  "guide": {
    "pageTitle": "Руководство — MythMill RpgEngine",
    "navEditor": "← Редактор",
    "navGame": "Игра",
    "navToc": "Содержание",
    "title": "Руководство по MythMill RpgEngine",
    "subtitle": "Документация для авторов без программирования. Редактор (editor.html) и игра (index.html) работают с одним файлом game_data.json. Сюжет собирается в формах: сцены, выборы, квесты, условия, проверки навыков, шаблоны локаций, сниппеты текста. Вкладка «JSON» — для поиска и редких полей.",
    "tocTitle": "Содержание"
  },
  "help": {}
};
