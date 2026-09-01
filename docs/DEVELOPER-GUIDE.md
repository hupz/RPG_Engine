# Developer Guide — RPG Engine Quest System

Этот документ для разработчиков движка и Advanced/Developer Mode.
Авторам игр см. [Руководство автора](../editor-guide.html).

## Quest architecture (v2)

```
Quest
  └── Stage[]
        └── Task[]
              └── onEvent / onActivate
QuestEventBus  →  QuestRuntime  →  questProgress (source of truth)
```

Автор в Editor **не** работает с:

- `flags` / `questFlags` / `choiceFlag` как основной механики квеста
- ручным `questStages` gameplay mutation
- `QuestSystem` (legacy, migration only)

### Runtime modules

| Module | Role |
|--------|------|
| `js/quests/quest-runtime.js` | progress, stages, journal, rewards |
| `js/quests/task-types.js` | TalkToNPC, CollectItem, KillEnemy, … |
| `js/quests/task-base.js` | registry, UnknownTaskType (no silent ManualAdvance) |
| `js/quests/quest-event-bus.js` | typed events |
| `js/quests/quest-migrate.js` | old project/save → format 2; MigrationRequired placeholder |

### Source of truth

- **Runtime:** `QuestRuntime.questProgress`
- **Legacy mirror:** `questStages` only for migration / old saves
- **Conditions:** read quest state via QuestRuntime when available

### Events (examples)

- `StageActivated` — does **not** auto-complete ManualAdvance
- `ItemDelivered` — DeliverItem progress (not ItemRemoved)
- `GoldSpent` — SpendGold
- `ObjectInteracted` — InteractObject
- `DialogueChoiceSelected` / choice actions — narrative advance

### Task lifecycle

1. Stage becomes active → `Task.onActivate(worldSnapshot)` initial sync  
2. Gameplay emits events → `Task.onEvent` incremental progress  
3. All tasks in stage done → next stage / complete quest  

### Editor (quests)

- Schema validation required fields (npcId, itemId, …)
- Unsupported types hidden unless developer mode
- Wizard + visual stage/task cards + DnD reorder + EntityPicker

### Migration

```
old project/save
  → QuestMigrate
  → Quest Format 2
  → runtime only new structures
```

Unknown/empty legacy stages → `MigrationRequired` (not silent ManualAdvance).

### Production

- Do not load active `js/quests.js` / `QuestSystem` as runtime
- Bundle must match modular quest sources
- Standalone export must embed QuestRuntime stack, not legacy QuestSystem

### Saves

- New saves: `questProgress` primary
- Old saves: migrate on load → `questProgress`

### Related docs

- `ARCHITECTURE.md`
- `docs/ARCHITECTURE-V3.md`


## Editor UI (new code)

**Rule: New Editor UI must not use inline `onclick`.**

Use:

- `createElement` / `Editor.DOM.el`
- `textContent`
- `addEventListener` or `data-action` delegation
- `data-*` attributes
- component render functions returning `Element` / `DocumentFragment`

Do not mass-rewrite legacy modules. Migrate only actively touched UI.

Helpers: `js/editor/editor-dom.js` → `Editor.DOM`
