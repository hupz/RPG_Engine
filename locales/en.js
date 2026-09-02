/* generated from en.json */
window.I18N_LOCALES = window.I18N_LOCALES || {};
window.I18N_LOCALES['en'] = {
  "lang": {
    "ru": "RU",
    "en": "EN",
    "switchTitle": "Interface language"
  },
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "create": "Create",
    "load": "Load",
    "play": "Play",
    "export": "Export",
    "close": "Close",
    "yes": "Yes",
    "no": "No",
    "ok": "OK",
    "loading": "Loading…",
    "emptyLoadData": "Load data",
    "noProject": "No open project",
    "loadDataHint": "Load data...",
    "help": "Help",
    "guide": "Guide",
    "themeToggle": "Toggle theme",
    "error": "Error",
    "success": "Done"
  },
  "editor": {
    "pageTitle": "MythMill RpgEngine — Editor",
    "title": "MythMill RpgEngine",
    "titleTooltip": "Go to dashboard",
    "dashboard": {
      "title": "Project dashboard",
      "emptyHint": "Create a new project or load game_data.json.",
      "newBtn": "New project",
      "loadBtn": "Load JSON",
      "saveJson": "Save as JSON",
      "exportHtml": "Export to HTML",
      "quickActions": "Quick actions",
      "newScene": "New scene",
      "saveJsonFile": "Save JSON",
      "exportGame": "Export game",
      "statsScenes": "Scenes",
      "statsQuests": "Quests",
      "statsEnemies": "Enemies",
      "statsItems": "Items",
      "statsClasses": "Classes",
      "statsAbilities": "Abilities",
      "warnTitle": "Warnings",
      "warnBroken": "Broken links: {errors}, dead ends: {deadEnds}.",
      "warnOk": "No critical broken links found.",
      "validateBtn": "Validate project",
      "themePreview": "UI theme"
    },
    "newProject": {
      "title": "📄 New project",
      "projectName": "Project name",
      "namePlaceholder": "My new game",
      "ruleSystem": "Rule system",
      "cancel": "Cancel",
      "create": "Create project",
      "enterName": "Enter a project name.",
      "defaultTitle": "My new game",
      "defaultDescription": "New project",
      "startLocation": "Start",
      "startText": "Welcome!",
      "noTitle": "Untitled",
      "editMeta": "✏️ Meta"
    },
    "loadJson": "Load JSON",
    "saveProject": "Save project",
    "saveProjectTitle": "Save or export project",
    "validate": "Validate project",
    "hints": "Hints",
    "hintsTitle": "Show all hints",
    "hintsHideTitle": "Hide all hints",
    "exportMenuLabel": "Save format",
    "exportJsonTitle": "Save as JSON",
    "exportJsonDesc": "Continue editing in the editor",
    "exportJsonTooltip": "Saves the project for further editing. Opens in the editor.",
    "exportDivider": "or release build",
    "exportHtmlTitle": "Export to HTML",
    "exportHtmlDesc": "Single file for publishing",
    "exportHtmlTooltip": "Creates a publishable game. Cannot be edited in the editor later.",
    "exportFolderTitle": "Export to folder",
    "exportFolderDesc": "Advanced option (Chrome)",
    "exportFolderTooltip": "Folder with index.html and assets (Chrome / Edge)",
    "sidebarScenes": "Scenes",
    "newScene": "+ New scene",
    "sidebarStats": "Statistics",
    "sidebarProject": "Project",
    "writerMode": {
      "label": "Writer mode",
      "levelAriaLabel": "Editor level",
      "levels": {
        "writer": "✏️ Writer",
        "cartographer": "🗺️ Cartographer",
        "engineer": "⚙️ Engineer"
      },
      "hints": {
        "writer": "Scene text, choices, quests and characters — without technical panels.",
        "cartographer": "Writer plus story map in the workspace and connectivity checklist.",
        "engineer": "Full access: JSON, balance, flags, on-enter events and debugging."
      },
      "cartographerBadge": " · map",
      "toggleAdvancedMode": "⚙️ Advanced Mode",
      "toggleEngineer": "⚙️ Engineer",
      "toggleWriterMode": "✏️ Writer Mode"
    },
    "writerModeFull": "Full mode",
    "writerModeHint": "Hides balance, climate, JSON and other technical sections.",
    "tabsLabel": "Editor sections",
    "nav": {
      "label": "Editor navigation",
      "scenes": "Scenes",
      "items": "Items",
      "quests": "Quests",
      "npcs": "NPCs",
      "enemies": "Enemies",
      "classes": "Classes",
      "abilities": "Abilities",
      "craft": "Crafting",
      "achievements": "Achievements",
      "assets": "Assets",
      "settings": "Settings",
      "help": "Help",
      "game_ui": "Game UI",
      "groups": {
        "create": "Creation",
        "content": "Content",
        "tools": "Tools",
        "advanced": "Advanced"
      },
      "tools": {
        "validate": {
          "label": "Validate",
          "title": "Validate project"
        },
        "preview": {
          "label": "Preview",
          "title": "Play current scene or project start in isolated test mode"
        },
        "export": {
          "label": "Export",
          "title": "Save or export project"
        }
      },
      "onboarding": {
        "noProject": "Load a project or create a new one on the dashboard.",
        "noScenes": "Create your first scene — that's where the game begins.",
        "firstSceneBtn": "+ First scene",
        "openScene": "Open a scene from the list on the left or create a new one.",
        "newSceneBtn": "+ New scene",
        "startScene": "Start with the opening scene — edit the text and choices."
      },
      "commands": {
        "story": "Story / story map",
        "categoryTools": "Tools"
      }
    },
    "mobileGateTitle": "Editor is desktop only",
    "mobileGateBody": "Use a computer with at least 768px width to create and edit modules. On phones you can play and test your game.",
    "mobileGateEngineerTitle": "Engineer mode is not available on touch screens",
    "mobileGateEngineerBody": "Classes, balance, JSON and other technical tools need a mouse for now. Switch to Writer mode for scenes, quests and the story map.",
    "mobileGateWriterBtn": "✏️ Writer mode",
    "mobileGateOpenGame": "Open game",
    "startWelcome": "Welcome to the editor!",
    "startIntro": "Create text RPGs from scratch or edit existing projects.",
    "startNew": "Create new project",
    "startLoad": "Load game_data.json",
    "sceneElements": {
      "onEnterTitle": "On scene enter",
      "onEnterHint": "Runs immediately when the player enters the scene (flags, music, scripts).",
      "onEnterEmpty": "No on-enter elements.",
      "mainTitle": "Scene elements",
      "mainHint": "Executed top to bottom after scene text. Order matters.",
      "mainEmpty": "No elements yet. Add combat, items, skill checks, choices display, etc.",
      "addElement": "+ Add element",
      "pickerTitle": "Choose element type",
      "deleteConfirm": "Delete this element?",
      "enabled": "Enabled",
      "firstVisitOnly": "First visit only",
      "advanced": "Advanced (NPC, hub, map, special, components)",
      "npcId": "Scene NPC (reputation)",
      "skill": "Skill",
      "dc": "DC",
      "successText": "Success text",
      "failText": "Fail text",
      "enemies": "Enemies",
      "addEnemy": "Add enemy",
      "nextScene": "Scene after victory",
      "item": "Item",
      "count": "Count",
      "flagKey": "Flag key",
      "flagValue": "Value",
      "quest": "Quest",
      "stage": "Stage",
      "effect": "Effect ID",
      "duration": "Duration (turns)",
      "achievement": "Achievement",
      "imageSrc": "Image path",
      "caption": "Caption",
      "actionId": "Action ID",
      "chainId": "Chain ID",
      "paramsJson": "Params (JSON)",
      "text": "Text",
      "targetScene": "Target scene",
      "amount": "Amount",
      "showChoicesHint": "Shows scene choices at this point in the sequence.",
      "serviceMenuHint": "Service menu component params (JSON).",
      "types": {
        "skill_check": "Skill check",
        "combat": "Combat",
        "give_item": "Give item",
        "remove_item": "Remove item",
        "set_flag": "Set flag",
        "quest_start": "Start quest",
        "quest_complete": "Complete quest",
        "add_status": "Add status",
        "remove_status": "Remove status",
        "achievement": "Achievement",
        "service_menu": "Service menu",
        "music": "Music",
        "image": "Image",
        "custom_action": "Action / chain",
        "show_choices": "Show choices",
        "show_text": "Text block",
        "change_scene": "Change scene",
        "award_gold": "Gold",
        "award_exp": "Experience"
      }
    },
    "tabs": {
      "scenes": "🎬 Scenes",
      "scene_templates": "📋 Templates",
      "actions": "🔗 Actions",
      "quests": "📜 Quests",
      "snippets": "📝 Snippets",
      "reputation": "🤝 Reputation",
      "achievements": "🏆 Achievements",
      "analytics": "📈 Analytics",
      "npcs": "👥 NPCs",
      "enemies": "⚔️ Enemies",
      "beasts": "🐾 Beasts",
      "balance": "⚖️ Balance",
      "items": "🎒 Items",
      "ingredients": "🧪 Ingredients",
      "recipes": "🔨 Recipes",
      "classes": "🏅 Classes",
      "races": "🧬 Ancestries",
      "abilities": "✨ Abilities",
      "audio": "🔊 Audio",
      "theme": "🎨 Theme",
      "climate": "🌍 Climate",
      "world": "🌍 World",
      "worldmap": "🗺️ Travel map",
      "graph": "🗺️ Story map",
      "progression": "📈 Progression",
      "json": "📄 JSON",
      "player_characters": "🦸 Hero",
      "variables": "📊 Variables",
      "prefabs": "📦 Prefabs",
      "media": "🖼 Media"
    },
    "project": {
      "name": "Title",
      "version": "Version",
      "author": "Author",
      "system": "System",
      "editMeta": "Meta",
      "noProject": "No project"
    },
    "export": {
      "htmlModalTitle": "Export to HTML",
      "htmlModalText": "HTML export creates a final single-file game. This file cannot be opened in the editor for edits. Make sure the project is complete.",
      "htmlModalHint": "A JSON backup will be saved in the browser automatically before export.",
      "htmlCancel": "Cancel",
      "htmlConfirm": "Yes, export",
      "noData": "No project data. Create or load JSON.",
      "jsonSaved": "Saved: {filename}",
      "backupRestore": "Backup found for «{title}» (before HTML export, {when}).\n\nRestore project?",
      "htmlTooLarge": "HTML file size ~{mb} MB (recommended limit 3 MB). The browser may be slow to download or open it.\n\nContinue export?",
      "htmlDone": "HTML exported: {filename}",
      "saveJsonToo": "JSON backup saved in the browser.\n\nSave JSON file to disk as well?",
      "loadOk": "Data loaded: {title}",
      "loadFail": "Error: {message}",
      "newProjectConfirm": "You have an open project. Create a new one? Unsaved changes will be lost.",
      "projectCreated": "Project «{title}» created ({system}).",
      "jsonSavedToast": "Saved: {filename}",
      "fileSavedAlert": "File saved as {filename}",
      "htmlBuildFail": "Failed to build HTML.\n\n{message}\n\nOpen editor.html via http://localhost or Live Server (not file://).",
      "folderUnsupported": "Folder export is supported in Chromium (Chrome, Edge, Brave).\nOpen editor.html via http://localhost or Live Server.",
      "folderPickFail": "Could not select folder: {message}",
      "folderDone": "Folder export complete.\nOpen index.html in the selected folder.",
      "exportError": "Export error: {message}",
      "recently": "recently",
      "defaultProject": "Project",
      "defaultGame": "Game",
      "migrateNoObject": "File does not contain a project JSON object"
    },
    "uiIntegration": {
      "selectScene": "Select a scene"
    },
    "productHardening": {
      "templatesUnavailable": "Templates are unavailable"
    },
    "validationPhaseH": {
      "exportReady": "✓ Project is ready for export (Phase H)",
      "exportWithWarnings": "⚠ Export possible with warnings: {count}",
      "exportBlocked": "✗ Export blocked: {count} errors"
    },
    "touchUi": {
      "noOtherScenes": "No other scenes to link",
      "linkModalTitle": "Link to…",
      "linkModalHint": "Choose a scene — a choice with a transition will be created.",
      "cancel": "Cancel",
      "link": "Link",
      "moveToast": "Drag the scene with your finger to move it",
      "done": "Done",
      "moveModeHint": "Move mode: drag the scene. Tap Done to exit.",
      "outputs": "Exits: {count}",
      "linkAction": "Link to…",
      "moveAction": "Move",
      "openScene": "Open scene",
      "touchLinkHint": "On touch screens, links are created via Link to…, not by dragging.",
      "dragNodeToast": "Drag the node to move it"
    },
    "assistantUi": {
      "panelAriaLabel": "Describe scene",
      "panelTitle": "✨ Describe the scene in text",
      "panelHint": "The draft is built only from templates, writerSafe actions and catalog conditions — no arbitrary JSON.",
      "inputPlaceholder": "For example: Tavern — dialogue with the bartender; choice — go to the forest or return to the village",
      "draftBtn": "Generate draft",
      "applyBtn": "Apply",
      "previewHint": "Enter a description and click Generate draft.",
      "emptyDescriptionWarning": "Enter a scene description",
      "reviewCount": "⚠ Items to review: {count} (will not be applied silently)",
      "error": "Error: {errors}",
      "sceneCreated": "Scene created: {sceneId}"
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
        "message": "Issues found before export:\nErrors: {errors}{warningsPart}\n\nExporting with errors may break the game. Continue?",
        "warningsPart": ", warnings: {warnings}",
        "confirmLabel": "Continue",
        "cancelLabel": "Cancel"
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
        "visual": "Use for interactive locations and objects on the scene.",
        "game_ui": "Use for HUD and persistent control elements.",
        "conditions": "Conditions define when something is available to the player.",
        "choices": "Choices are the player's actions in a text scene.",
        "content": "Scene text and modules define what the player sees.",
        "items": "Items are granted in quests, scenes and combat.",
        "quests": "Quests connect scenes, goals and rewards.",
        "combat": "Enemies are used in combat scenes and quests."
      },
      "emptyStates": {
        "project": {
          "title": "Welcome to your RPG project",
          "explanation": "Create your first scene — that is where the game begins.",
          "primaryLabel": "Create First Scene"
        },
        "scene": {
          "title": "No scene open",
          "explanation": "Open a scene from the list on the left or create a new one.",
          "primaryLabel": "Create scene"
        },
        "content": {
          "title": "Scene is empty",
          "explanation": "Add text or a module so the player sees scene content.",
          "primaryLabel": "Add module"
        },
        "choices": {
          "title": "No choices",
          "explanation": "Add response options so the player can act.",
          "primaryLabel": "Add choice"
        },
        "visual": {
          "title": "No visual content",
          "explanation": "Add a background or interactive object to the scene.",
          "primaryLabel": "Add object"
        },
        "game_ui": {
          "title": "No UI screens",
          "explanation": "Create a HUD or menu — control elements for the player.",
          "primaryLabel": "Create screen"
        },
        "conditions": {
          "title": "No conditions",
          "explanation": "Conditions control visibility of the scene, choices and objects.",
          "primaryLabel": "Add condition"
        },
        "items": {
          "title": "No items",
          "explanation": "Create items for quests, rewards and inventory.",
          "primaryLabel": "Create item"
        },
        "quests": {
          "title": "No quests",
          "explanation": "Give the player a goal — a quest connects scenes and rewards.",
          "primaryLabel": "Create quest"
        },
        "combat": {
          "title": "No enemies",
          "explanation": "Create enemies for combat scenes and quests.",
          "primaryLabel": "Create enemy"
        },
        "content_category": {
          "title": "No objects",
          "explanation": "Create the first object in this category.",
          "primaryLabel": "Create"
        }
      },
      "noProject": {
        "title": "No project open",
        "explanation": "Load a project or create a new one from the start screen.",
        "primaryLabel": "Load project"
      },
      "dismissHintTitle": "Dismiss hint",
      "dismissHintAria": "Dismiss hint"
    },
    "commandPaletteV2": {
      "categories": {
        "navigation": "Navigation",
        "create": "Create",
        "project": "Project",
        "preview": "Preview",
        "validation": "Validation",
        "export": "Export",
        "objects": "Objects",
        "recent": "Recent"
      },
      "typeLabels": {
        "scene": "Scene",
        "visual_scene": "Scene",
        "quest": "Quest",
        "item": "Item",
        "npc": "NPC",
        "player_character": "Hero",
        "enemy": "Enemy",
        "ui_screen": "Game UI",
        "asset": "Asset"
      },
      "defaultObject": "Object",
      "commands": {
        "goScene": "Go to scene",
        "contentBrowser": "Open Content Browser",
        "projectGraph": "Open story map",
        "createScene": "Create scene",
        "createItem": "Create item",
        "createQuest": "Create quest",
        "projectValidate": "Validate project",
        "previewProject": "Preview project",
        "exportProject": "Export project"
      }
    },
    "contentBrowserV2": {
      "categories": {
        "scenes": "Scenes",
        "quests": "Quests",
        "items": "Items",
        "npcs": "NPCs",
        "characters": "Heroes",
        "combat": "Combat",
        "game_ui": "Game UI",
        "assets": "Assets"
      },
      "search": {
        "noMatch": "No results for \"{query}\"",
        "resultsTitle": "Search results ({count})"
      },
      "recentTitle": "Recently opened",
      "categoryNavAria": "Content categories",
      "welcome": {
        "title": "Welcome to your RPG project",
        "body": "Start with your first scene — quests, items, and visuals live here too.",
        "createFirstScene": "Create First Scene",
        "chooseTemplate": "Choose Template"
      },
      "indexNotLoaded": "Content index not loaded",
      "empty": {
        "noObjects": "No objects",
        "categoryEmpty": "Category \"{label}\" is empty. Create the first object.",
        "categoryEmptyShort": "Category \"{label}\" is empty."
      },
      "create": {
        "quest": "+ Create quest",
        "item": "+ Create item",
        "npc": "+ Create NPC",
        "player_character": "+ Create hero",
        "enemy": "+ Create enemy",
        "ui_screen": "+ Create UI screen",
        "asset": "+ Add asset",
        "default": "+ Create",
        "toggle": "+ Create"
      },
      "sceneFilters": {
        "all": "All",
        "text": "Text",
        "visual": "Visual",
        "mixed": "Mixed",
        "searchPlaceholder": "🔍 Search scenes…",
        "filterAria": "Scene type filter",
        "sortLabel": "Sort",
        "sortTitle": "By name",
        "sortTitleDesc": "Name (Z→A)",
        "sortKind": "By type"
      },
      "chrome": {
        "contentTitle": "CONTENT",
        "globalSearchPlaceholder": "🔍 Search project…"
      }
    },
    "previewWorkflow": {
      "defaultProject": "Project",
      "noSceneLabel": "—",
      "returnToEditor": "Return to editor",
      "noProjectData": "No project data",
      "testIsolationUnavailable": "Test isolation unavailable",
      "previewPrepareFailed": "Failed to prepare preview",
      "previewOpened": "Preview opened — EDITOR TEST MODE",
      "genericError": "Error",
      "warningsAllowed": "Warnings: {count} — preview allowed.",
      "beforePreview": "Before preview",
      "errorOneFound": "error found.",
      "errorsManyFound": "errors found.",
      "noErrors": "No errors.",
      "fix": "Fix",
      "previewAnyway": "Preview anyway",
      "continue": "Continue",
      "cancel": "Cancel",
      "noSceneForPreview": "No scene for preview",
      "previewWithWarnings": "Preview with {count} warn.",
      "menuHeading": "Preview",
      "playCurrentScene": "Play Current Scene",
      "playFromStart": "Play From Project Start",
      "previewTitle": "Preview in isolated test mode",
      "previewLabel": "Preview",
      "globalPreviewLabel": "▶ Preview",
      "currentSceneTitle": "Current scene",
      "selectScene": "Select a scene"
    },
    "sceneWorkspacePolish": {
      "sections": {
        "overview": {
          "title": "Overview",
          "desc": "Scene summary and quick navigation."
        },
        "content": {
          "title": "Content",
          "desc": "Scene text and story modules.",
          "addModule": "+ Add module"
        },
        "choices": {
          "title": "Choices",
          "desc": "Player response options in this scene.",
          "addChoice": "+ Add choice"
        },
        "visual": {
          "title": "Visual",
          "desc": "Interactive objects and scene hotspots.",
          "addObject": "+ Add object"
        },
        "gameUi": {
          "title": "Game UI",
          "desc": "HUD and UI screens linked to the project.",
          "addUi": "+ Add UI element"
        },
        "conditions": {
          "title": "Conditions",
          "desc": "Visibility of scene, choices and objects.",
          "addCondition": "+ Add condition"
        },
        "advanced": {
          "title": "Advanced",
          "desc": "ID, scene type and data for advanced mode."
        }
      },
      "breadcrumb": {
        "ariaLabel": "Scene navigation",
        "project": "Project",
        "unsavedTitle": "Unsaved changes"
      }
    },
    "campaignWizard": {
      "steps": {
        "genre": "Genre & system",
        "world": "World skeleton",
        "heroes": "Heroes & NPCs",
        "quest": "First quest",
        "publish": "Review & publish"
      },
      "defaultTitle": "My story",
      "title": "📖 Story mode",
      "cancel": "Cancel",
      "back": "Back",
      "skip": "Skip",
      "next": "Next",
      "closeWizard": "Close wizard",
      "finishWithoutExport": "Finish without export",
      "selectPlaceholder": "— select —",
      "unknownStep": "Unknown step",
      "unknownStepMaster": "Unknown wizard step.",
      "publishModuleMissing": "Publish module not loaded.",
      "genreHint": "Describe the world you are building — the engine will prepare the project foundation.",
      "storyTitleLabel": "Story title",
      "genreLabel": "Genre",
      "systemLabel": "Game rules",
      "startingResources": "Starting resources: {gold} gold, {hp} HP — you can change these later.",
      "blankProjectLink": "Create a blank project from scratch…",
      "worldHint": "Pick a skeleton — linked scenes in your genre will appear from ready templates.",
      "worldPreviewHint": "Pick a skeleton — a scene diagram will appear.",
      "startSceneLabel": "Starting scene:",
      "regenerateWorld": "Regenerate",
      "heroesHint": "Name the hero and key characters — the engine will create entries and dialogue lines.",
      "heroHeading": "🧝 Hero",
      "nameLabel": "Name",
      "heroDescLabel": "Brief hero description",
      "npcHeading": "👤 Character {n}",
      "roleLabel": "Role",
      "briefLabel": "Brief",
      "phrasePreview": "Line: «{phrase}»",
      "questHint": "What should the player do? Pick a goal and participants — stages will assemble themselves.",
      "questTitleLabel": "Quest title",
      "npcLabel": "Character",
      "itemLabel": "Item",
      "enemyLabel": "Enemy",
      "placeLabel": "Location",
      "rewardHeading": "Reward",
      "rewardGoldLabel": "Gold amount",
      "rewardItemLabel": "Reward item",
      "repOwnerLabel": "Whose reputation",
      "repAmountLabel": "Amount",
      "toastRegenBlocked": "You already edited scenes — regeneration is disabled to avoid losing changes.",
      "toastRegenDone": "Skeleton rebuilt — click Next to apply.",
      "toastWorldFailed": "Failed to build world skeleton",
      "toastWorldValidation": "Skeleton failed validation — please report this to developers",
      "toastHeroesFailed": "Failed to create characters",
      "toastQuestFailed": "Failed to create quest",
      "toastQuestValidation": "Project failed validation after quest",
      "toastStepFailed": "Failed to apply wizard step",
      "toastSavedResume": "Wizard saved — continue via New project",
      "toastReportUpdated": "Report refreshed",
      "toastSavedPublish": "Wizard saved — open New project to return to publishing",
      "toastPreviewUnavailable": "Preview unavailable — reload the editor",
      "toastFixErrors": "Fix errors in the report first",
      "toastExportUnavailable": "HTML export unavailable",
      "toastExportSaved": "HTML file saved",
      "toastExportFailed": "Failed to export HTML",
      "toastFinished": "Story mode wizard finished. Keep building your game in Writer mode.",
      "toastResume": "Resuming Story mode wizard from step «{step}»",
      "toastSavedLater": "Story mode wizard saved — continue via New project",
      "toastUndoDone": "Wizard changes rolled back",
      "confirmCancel": "Abort the wizard? Progress will be saved — continue via New project.\n\nClick Other… to choose rollback of created content.",
      "confirmCancelFinish": "Finish later",
      "confirmCancelOther": "Other…",
      "confirmUndo": "Roll back wizard changes via undo history?",
      "confirmUndoYes": "Roll back",
      "confirmUndoKeep": "Keep as is",
      "confirmNoUndo": "Undo history unavailable. Close wizard and keep created content in the project?",
      "confirmClose": "Close",
      "confirmBack": "Back",
      "confirmOpen": "Open Story mode wizard? The current project may be replaced on the Genre & system step.",
      "confirmResume": "An unfinished Story mode wizard exists. Continue from step «{step}»?",
      "confirmContinue": "Continue",
      "confirmRestart": "Start over",
      "legacyTitle": "📖 New story",
      "legacyCreate": "✨ Create story",
      "legacySteps": {
        "title": "Title",
        "scenes": "Scenes",
        "npc": "NPC",
        "questCombat": "Quest & combat",
        "done": "Done"
      },
      "legacyHint0": "Next we will assemble 3 scenes, an NPC, a quest and a simple enemy — no code.",
      "legacyNoteLabel": "Brief story note (for yourself)",
      "legacyScenesHint": "Three skeleton locations. Add more later on the story map.",
      "legacySceneName": "Scene {n}: name",
      "legacySceneText": "Text (what the player sees)",
      "legacyNpcHint": "Character where the plot begins (usually in the first or second scene).",
      "legacyNpcName": "NPC name",
      "legacyNpcLine": "First line",
      "legacyQuestTitle": "Quest title",
      "legacyQuestHint": "Objective (for journal)",
      "legacyCombatCheck": "Add a simple enemy and combat scene",
      "legacyEnemyName": "Enemy name",
      "legacyReadyTitle": "Ready to build",
      "legacyReadyBody": "Will create: project «{title}», {sceneCount} scenes, NPC, quest{combatExtra}.",
      "legacyReadyCombatExtra": ", enemy and combat",
      "legacyDefaultScenes": [
        {
          "name": "Beginning",
          "text": "You stand on the threshold of adventure."
        },
        {
          "name": "Village",
          "text": "A quiet village. Help can be found here."
        },
        {
          "name": "Dangerous place",
          "text": "Someone or something threatens the peace here."
        }
      ],
      "legacyDefaultNpc": "Elder",
      "legacyDefaultNpcLine": "Welcome, traveler. I need your help.",
      "legacyDefaultQuest": "First task",
      "legacyDefaultQuestHint": "Talk to the elder and deal with the threat.",
      "legacyDefaultEnemy": "Bandit",
      "confirmLegacyOpen": "Create a new story? The current editor project will be replaced (the file on disk stays until you save).",
      "legacyCreated": "Story «{title}» created. Open the story map or scene preview.",
      "quickStoryBtn": "📖 Quick story (classic)",
      "npcHubWhere": "📍 Appears in",
      "npcHubAttach": "Attach to scene",
      "npcHubSceneOption": "+ scene…",
      "npcHubNotLinked": "Not linked anywhere yet. Assign the NPC on a scene or add below.",
      "npcHubLines": "💬 Lines",
      "npcHubNoLines": "No lines",
      "npcHubAddLine": "+ Line",
      "npcHubQuests": "📜 Related quests",
      "npcHubNoQuests": "No quests yet — create one in the Quests tab.",
      "npcSceneReason": "Scene NPC",
      "npcDialogReason": "Dialogue",
      "npcComponentReason": "Component",
      "createNpcPrompt": "Character name:",
      "createNpcDefault": "New villager",
      "fallbackGenres": {
        "fantasy": "Fantasy",
        "horror": "Horror",
        "detective": "Detective",
        "survival": "Survival"
      },
      "fallbackSystems": {
        "generic": "Generic rules",
        "dnd5e": "Classic adventures"
      },
      "fallbackRewardGold": "Gold",
      "gameData": {
        "goTo": "Go to: {name}",
        "acceptQuest": "Accept: {title}",
        "faceEnemy": "Face: {name}",
        "questStageStart": "Start",
        "questStagePath": "On the way",
        "questStagePathHint": "Continue through locations.",
        "questStageDone": "Done",
        "questStageDoneHint": "Task completed.",
        "talkTask": "Talk to: {name}",
        "visitTask": "Reach: {location}",
        "npcDesc": "Key character at the start of the story.",
        "combatLocation": "Fight: {name}",
        "combatText": "{name} blocks the path!"
      }
    },
    "storyWizard": {
      "content": {
        "defaultChoiceGo": "Go",
        "systems": {
          "generic": "Generic rules",
          "dnd5e": "Classic adventures",
          "pf2e": "Pathfinder"
        },
        "genres": {
          "fantasy": {
            "label": "Fantasy",
            "defaultTitle": "A Tale of Adventure",
            "description": "Knights, magic and ancient secrets await the hero."
          },
          "horror": {
            "label": "Horror",
            "defaultTitle": "Shadows of the Forgotten House",
            "description": "Darkness, fear and the inexplicable at every step."
          },
          "detective": {
            "label": "Detective",
            "defaultTitle": "A Case Without Answers",
            "description": "Clues, witnesses and a reveal at the end."
          },
          "survival": {
            "label": "Survival",
            "defaultTitle": "After the Storm",
            "description": "Resources are running out — reach safety."
          }
        },
        "sceneNames": {
          "fantasy": {
            "start": "At the kingdom gates",
            "hub": "Guards' crossroads",
            "branch1": "Dark forest",
            "branch2": "Tower ruins",
            "branch3": "Elven village",
            "village": "Oldwood Village",
            "tavern": "Golden Goblet Tavern",
            "shop": "Alchemist shop",
            "forge": "Old Grom's forge",
            "road1": "Royal road",
            "road2": "River bridge",
            "road3": "Stream clearing",
            "road4": "Fortress gates",
            "exit": "Edge of the lands"
          },
          "horror": {
            "start": "Threshold of the abandoned house",
            "hub": "Empty hall",
            "branch1": "Basement",
            "branch2": "Attic",
            "branch3": "Grave garden",
            "village": "Dead village",
            "tavern": "Closed inn",
            "shop": "Empty shop",
            "forge": "Rusty forge",
            "road1": "Misty trail",
            "road2": "Broken bridge",
            "road3": "Swamp",
            "road4": "Old crypt",
            "exit": "Cemetery gates"
          },
          "detective": {
            "start": "Detective's office",
            "hub": "Town square",
            "branch1": "Mayor's office",
            "branch2": "Evidence warehouse",
            "branch3": "Witness café",
            "village": "Old quarter",
            "tavern": "Red Lamp bar",
            "shop": "Pawn shop",
            "forge": "Watchmaker's workshop",
            "road1": "Lantern street",
            "road2": "Dock alley",
            "road3": "Police archive",
            "road4": "Courtroom",
            "exit": "Train station"
          },
          "survival": {
            "start": "Camp after the storm",
            "hub": "Broken bridge",
            "branch1": "Overgrown trail",
            "branch2": "Abandoned hut",
            "branch3": "Freshwater stream",
            "village": "Canyon settlement",
            "tavern": "Campfire shelter",
            "shop": "Supply depot",
            "forge": "Tool shed",
            "road1": "Mountain trail",
            "road2": "Rockslide",
            "road3": "Cave by the cliff",
            "road4": "Rescue point",
            "exit": "Safe clearing"
          }
        },
        "skeletons": {
          "hub_branches": {
            "label": "Hub and three branches",
            "description": "Central point and three paths — classic branching plot.",
            "choices": {
              "startPath": "Begin the journey",
              "path1": "First path",
              "path2": "Second path",
              "path3": "Third path",
              "return": "Return"
            }
          },
          "linear_road": {
            "label": "Linear road",
            "description": "Sequential path of five locations — for plots without branches.",
            "choices": {
              "setOut": "Set out",
              "continue": "Continue",
              "finishPath": "Finish the journey",
              "return": "Return"
            }
          },
          "ready_village": {
            "label": "Ready-made village",
            "description": "Settlement with tavern, shop and forge — a ready hub for your story.",
            "choices": {
              "enterVillage": "Enter the settlement",
              "tavern": "Tavern",
              "shop": "Shop",
              "forge": "Forge",
              "leaveVillage": "Leave the settlement",
              "toSquare": "To the square",
              "return": "Return"
            }
          }
        }
      },
      "heroesQuest": {
        "roles": {
          "quest_giver": "Quest giver",
          "merchant": "Merchant",
          "informant": "Informant",
          "antagonist": "Antagonist"
        },
        "phrases": {
          "quest_giver": "I need your help, traveler. I have a task for you.",
          "merchant": "Stop by — goods are fresh and prices fair.",
          "informant": "I heard something important. Might be useful.",
          "antagonist": "You are not welcome here. Leave while you can.",
          "fallback": "…"
        },
        "rewards": {
          "gold": "Gold",
          "item": "Item",
          "reputation": "Reputation"
        },
        "defaults": {
          "heroName": "Wanderer",
          "heroDescription": "Main hero of your story",
          "questTitle": "First task",
          "npcFallback": "Character",
          "acceptQuest": "Accept: {title}",
          "acceptQuestFallback": "task",
          "rewardItemName": "Reward for valor",
          "rewardItemDesc": "For completing the task",
          "rewardPlaceholder": "Reward",
          "reputationVillage": "Local folk"
        },
        "items": {
          "fantasy": "Old amulet",
          "horror": "Worn note",
          "detective": "Clue",
          "survival": "Food supplies",
          "fallback": "Item"
        },
        "enemies": {
          "fantasy": "Bandit",
          "horror": "Shadow",
          "detective": "Suspect",
          "survival": "Wild beast",
          "fallback": "Enemy"
        },
        "defaultNpcs": {
          "fantasy": [
            {
              "name": "Elder",
              "role": "quest_giver",
              "description": "Rules the village and gives errands"
            },
            {
              "name": "Merchant",
              "role": "merchant",
              "description": "Sells potions and gear"
            },
            {
              "name": "Wanderer",
              "role": "informant",
              "description": "Knows trails and rumors"
            }
          ],
          "horror": [
            {
              "name": "House owner",
              "role": "quest_giver",
              "description": "Asks to deal with shadows"
            },
            {
              "name": "Caretaker",
              "role": "informant",
              "description": "Saw something strange by the well"
            },
            {
              "name": "Stranger",
              "role": "antagonist",
              "description": "Frightens and hinders the investigation"
            }
          ],
          "detective": [
            {
              "name": "Inspector",
              "role": "quest_giver",
              "description": "Assigns the first case"
            },
            {
              "name": "Witness",
              "role": "informant",
              "description": "Saw something suspicious"
            },
            {
              "name": "Shopkeeper",
              "role": "merchant",
              "description": "Trades clues and coffee"
            }
          ],
          "survival": [
            {
              "name": "Camp leader",
              "role": "quest_giver",
              "description": "Organizes group survival"
            },
            {
              "name": "Scout",
              "role": "informant",
              "description": "Knows safe trails"
            },
            {
              "name": "Marauder",
              "role": "antagonist",
              "description": "Threatens supplies"
            }
          ]
        }
      },
      "publish": {
        "heroDefault": "Hero",
        "defaultTitle": "My story",
        "dash": "—",
        "projectLabel": "Project",
        "errorFallback": "Error",
        "questNotSet": "quest not set in wizard",
        "questNotCreated": "quest not yet created in project",
        "noStartScene": "no starting scene",
        "questGranted": "granted in «{label}»",
        "questUnreachable": "no choice from start launches the quest",
        "checklist": {
          "hasStart": "Starting scene exists",
          "firstQuest": "First quest reachable",
          "sceneExit": "Every scene has at least one exit",
          "hubFinal": "Ending reachable from hub"
        },
        "checklistDetail": {
          "startAssigned": "«{id}»",
          "startDefault": "«{id}» (default)",
          "noStart": "create at least one scene and set the start",
          "deadEnds": "no exit: {list}",
          "allExits": "all scenes lead onward or end the story",
          "flowSkipped": "story map unavailable — check skipped",
          "hubFinalOk": "ending reachable from hub"
        },
        "sections": {
          "checklist": "Readiness checklist",
          "errors": "Errors ({count})",
          "warnings": "Warnings ({count})"
        },
        "validatorOk": "✓ No critical validator issues — you can test and export.",
        "exportBlocked": "Export blocked",
        "exportBlockedHint": " — fix errors above:",
        "exportTitle": "Export HTML",
        "exportDisabledTitle": "Fix errors first",
        "header": "Review & publish",
        "headerSummary": "{title} · {count} scenes · quest «{quest}»",
        "playPreview": "▶ Play as hero",
        "refreshReport": "↻ Refresh report",
        "note": "Preview and export do not require switching tabs. Click a row to open the issue in the editor.",
        "successTitle": "Game exported",
        "successHint": "HTML file saved to disk — open it in a browser and share with friends.",
        "stats": {
          "scenes": "Scenes: {count}",
          "quest": "Quest: «{title}»",
          "heroNpc": "Hero: {hero} · NPCs: {count}"
        },
        "improveTitle": "Improve later",
        "improve": {
          "warnings": "validator warnings remain — refine dialogues and conditions",
          "checklist": "readiness checklist is not fully green",
          "default": "add more scenes, quests and visual details"
        },
        "gotoCartographer": "🗺️ Cartographer — story map",
        "gotoEngineer": "⚙️ Engineer — balance and mechanics"
      }
    }
  },
  "game": {
    "pageTitle": "RPGengine",
    "pickerTitle": "RPGengine",
    "pickerIntro": "Choose an adventure. Each game is saved separately.",
    "loadCustomJson": "Load custom JSON",
    "pickerAria": "Campaign selection",
    "hasSave": "Save found",
    "play": "Play",
    "continueOrNew": "Continue / start over",
    "sidebarCharacter": "Character",
    "health": "HP",
    "healthTip": "Hit points",
    "ac": "AC",
    "acTip": "Armor class",
    "attack": "Attack",
    "attackTip": "Attack bonus",
    "damage": "Damage",
    "initiative": "Initiative",
    "gold": "Gold",
    "goldUnit": "gp",
    "level": "Level",
    "levelTip": "Character level",
    "exp": "XP",
    "resource": "Resource",
    "resourceTip": "Class resource",
    "proficiencies": "Proficiencies",
    "proficienciesEmpty": "Proficiencies: —",
    "namePlaceholder": "Enter name...",
    "questsTitle": "Active quests",
    "questsEmpty": "You have no active quests yet.",
    "rest": "Rest",
    "restTip": "Short rest restores HP and resource",
    "supplies": "Supplies",
    "restBtn": "Rest",
    "restInfo": "With supplies: full HP and resource. Without: half HP and resource.",
    "journal": "Journal",
    "dockInventory": "Inventory",
    "dockAbilities": "Abilities",
    "dockRelations": "Relations",
    "dockAchievements": "Achievements",
    "dockCrafting": "Crafting",
    "dockLocation": "Location",
    "dockWait": "Wait",
    "dockAudio": "Audio",
    "dockMenu": "Menu",
    "panelInventory": "Inventory",
    "panelAbilities": "Abilities",
    "panelRelations": "Relations",
    "panelAchievements": "Achievements",
    "panelCrafting": "Crafting",
    "panelLocation": "Location",
    "panelWait": "Wait",
    "panelMenu": "Menu",
    "panelCurses": "Curses",
    "close": "Close",
    "achievementsSummary": "Unlocked achievements are colored; secret ones show as «???» until unlocked.",
    "craftingHint": "Green — enough materials, red — not enough, gray — recipe unknown.",
    "relationsHint": "Reputation with factions and NPCs. Hover a row for progress details.",
    "travelSelect": "Travel…",
    "travelTip": "Travel between locations",
    "waitSelect": "Select time…",
    "menuLoadContent": "Load content JSON",
    "menuSaveGame": "Save game",
    "menuLoadGame": "Load game",
    "menuDeleteSave": "Delete save",
    "menuCampaignPicker": "Back to campaign picker",
    "menuReset": "Start over",
    "saveSlots": {
      "title": "Save slots",
      "open": "Save / load",
      "slotLabel": "Slot {n}",
      "empty": "Empty",
      "save": "Save",
      "load": "Load",
      "delete": "Delete",
      "active": "active",
      "overwrite": "Overwrite save in slot {n}?",
      "deleteConfirm": "Delete save in slot {n}?",
      "savedAt": "Saved: {date}",
      "playtime": "Playtime: {time}",
      "level": "Level {level}",
      "scene": "Location: {name}"
    },
    "audioMusic": "Music volume",
    "audioSfx": "SFX volume",
    "audioOn": "Sound on",
    "audioOff": "Sound off",
    "lootTitle": "Loot",
    "lootTake": "Take",
    "levelUp": "Level up!",
    "dialog": {
      "ok": "OK",
      "confirm": "Yes",
      "cancel": "Cancel",
      "promptPlaceholder": "Enter a value…",
      "noticeTitle": "Notice",
      "jsonReadError": "Failed to read JSON: {message}",
      "returnToPicker": "Return to campaign picker? Unsaved progress may be lost.",
      "resetGame": "Start a new game? Current progress will be reset.",
      "deleteSave": "Delete the game save?",
      "abilityNotFound": "Ability not found in progression.abilities data.",
      "cancelCharCreation": "Cancel character creation?"
    },
    "achievementUnlocked": "Achievement unlocked!",
    "hintLabel": "Hint",
    "mobileExpandSidebar": "Expand character panel",
    "mobileCollapseSidebar": "Collapse character panel",
    "mobileHeroDefault": "Hero",
    "worldStatusAria": "Time, date and climate",
    "combatStatsAria": "Combat stats",
    "spellSlotsAria": "Resource / spell slots",
    "abilitiesAria": "Ability scores",
    "dockAria": "Quick panels",
    "closeInventory": "Close inventory",
    "closeAbilities": "Close abilities",
    "closeRelations": "Close relations",
    "closeAchievements": "Close achievements",
    "closeCrafting": "Close crafting",
    "closeLocation": "Close location",
    "closeWait": "Close wait",
    "closeAudio": "Close audio",
    "closeMenu": "Close menu",
    "loading": "Loading...",
    "charCreatorAria": "Character creation",
    "turnOrderAria": "Turn order",
    "sceneComponentsAria": "Scene components",
    "combatLogAria": "Combat log",
    "eventsAria": "Events",
    "waitSkip": "Skip:",
    "waitHours": "h",
    "waitMinutes": "min",
    "waitBtn": "Wait",
    "waitRest": "Rest (recovery)",
    "waitCamp": "Make camp (safer)",
    "waitDawn": "🌅 Dawn",
    "waitDusk": "🌇 Dusk",
    "waitNoon": "☀️ Noon",
    "waitMidnight": "🌙 Midnight",
    "wait15min": "15 min",
    "wait30min": "30 min",
    "wait1h": "1 hour",
    "wait4h": "4 hours",
    "ui": {
      "actionTypes": {
        "action": "Action",
        "bonus_action": "Bonus",
        "reaction": "Reaction",
        "passive": "Passive",
        "free": "Free"
      },
      "notYourTurn": "Not your turn",
      "reactionTrigger": "Triggers on event",
      "curseSilence": "Curse of silence",
      "noSpellSlots": "No spell slots available",
      "needSpellSlots": "Need {cost} free slots",
      "noSpellCircle": "No level {level}+ slots",
      "noSlotsCircle": "No level {level} slots",
      "notEnoughResource": "Not enough {resource}",
      "concentrationBusy": "Concentration in use",
      "alreadyUsedCombat": "Already used this combat",
      "actionSpent": "Action spent",
      "bonusSpent": "Bonus action spent",
      "unavailable": "Unavailable",
      "minLevel": "Available at level {level}",
      "maxLevel": "Max level",
      "reputationHostile": "Hostile",
      "reputationNeutral": "Neutral",
      "reputationFriendly": "Friendly",
      "reputationHero": "Hero",
      "yes": "Yes",
      "no": "No",
      "cancel": "Cancel",
      "continue": "Continue",
      "take": "Take",
      "nothingDropped": "Nothing dropped.",
      "achievement": "Achievement",
      "sceneNotFound": "Error: scene «{id}» not found.",
      "notEnoughGold": "Not enough gold (need {price} gp).",
      "itemNotFound": "Item not found",
      "questItem": "Quest item",
      "cursedNoSell": "Cursed item cannot be sold",
      "unequipFirst": "Unequip first",
      "merchantWontBuy": "Merchant won't buy this",
      "notInInventory": "Not in inventory",
      "available": "available",
      "spent": "spent",
      "energy": "Energy",
      "slots": "Slots"
    },
    "campaigns": {
      "melnitsa": {
        "badge": "MAIN",
        "subtitle": "D&D 5e · main game",
        "description": "Save miller Albert. The mill, cellar, boss Corvin, and the village."
      },
      "scifi": {
        "badge": "DEMO",
        "subtitle": "Sci-Fi horror · generic",
        "description": "Abandoned orbital station, oxygen, and a distress signal."
      },
      "pf2e": {
        "badge": "DEMO PF2e",
        "subtitle": "Pathfinder 2e · demo campaign",
        "description": "Hornstead village: missing miller, fey shrine, levels 1–10."
      }
    }
  },
  "tutorial": {
    "preparation": "Preparation",
    "createProjectTitle": "Create a project",
    "createProjectText": "The tutorial needs an open project. Click «New project» in the header and confirm.",
    "createProjectWait": "Create a project to continue…",
    "stepOf": "Step {current} of {total}",
    "waitAction": "Complete the action on screen to continue…",
    "skip": "Skip",
    "neverAgain": "Don't show again",
    "complete": "Tutorial complete! You can continue building your game.",
    "scenesListTitle": "Scene list",
    "scenesListText": "This is your scene list. Click «New scene» to create the first location.",
    "sceneFormTitle": "Title and description",
    "sceneFormText": "Enter the location name in the creation form, click «Create», then fill in the «Text» field.",
    "npcTitle": "NPCs",
    "npcText": "Add an NPC from the right panel — open the NPCs tab and click «Add NPC».",
    "dialogueTitle": "Dialogue",
    "dialogueText": "Create dialogue: return to the scene and click «+ Add» in the «Dialogues» block.",
    "choiceTitle": "Scene transitions",
    "choiceText": "Add a transition: «+ Add» in «Choices» and set the target scene.",
    "playTitle": "Testing",
    "playText": "Click «Play» in the preview panel on the right to test the scene in the game.",
    "saveTitle": "Saving",
    "saveText": "Save the project — click «Save project» in the editor header."
  },
  "guide": {
    "pageTitle": "Guide — MythMill RpgEngine",
    "navEditor": "← Editor",
    "navGame": "Game",
    "navToc": "Contents",
    "title": "MythMill RpgEngine Guide",
    "subtitle": "Documentation for authors without programming. The editor (editor.html) and game (index.html) share one game_data.json file. Build your story in forms: scenes, choices, quests, conditions, skill checks, location templates, text snippets. The JSON tab is for search and rare fields.",
    "tocTitle": "Contents"
  },
  "help": {}
};
