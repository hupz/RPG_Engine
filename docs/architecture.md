# Browser Game Engine — Architecture Boundaries (Phase 1.1)

**Status:** foundation only. Legacy RPG_Engine remains the production runtime.  
**Invariant:** `questProgress` is the Source of Truth for quests (QuestRuntime).  
**Principle:** ONE ENGINE · ONE RUNTIME · ONE EDITOR · FOUR GAME MODES

Related: root `ARCHITECTURE.md` (Quest v2 + Editor hooks contract).

---

## Package layout (target)

```text
js/
├── core/          ← Phase 1.1 foundation (EventBus, Project, EngineApp, contracts)
├── runtime/       ← future extraction (not mass-moved yet)
├── rendering/     ← future IRenderer backends
├── assets/        ← future AssetManager
├── physics/       ← future
├── game-ui/       ← future DOM presentation
├── modes/         ← text | 2d | 3d | hybrid
├── quests/        ← EXISTING (KEEP)
├── conditions/    ← EXISTING path: js/conditions.js (KEEP)
├── actions/       ← EXISTING (KEEP)
├── editor/        ← EXISTING (client of APIs)
└── engine/        ← LEGACY GameEngine (facade later)
```

Legacy files stay in place until EXTRACT phases.

---

## Layers

### Core

| | |
|--|--|
| **Purpose** | Platform-independent engine kernel |
| **Responsibilities** | EngineApp lifecycle, EventBus, Project handle, RuntimeContext shell, contracts |
| **Allowed deps** | None (no DOM, no Editor, no campaign) |
| **Forbidden** | `document`, `window.Editor`, `editor/*`, GameUI, specific renderer, campaign IDs |
| **Public API** | `EngineCore.createEventBus`, `createProject`, `createRuntimeContext`, `createEngineApp`, `contracts`, `LEGACY_GAMEENGINE_API_MAP` |
| **Future** | Host Entity/ECS, clock, service registry |

### Runtime

| | |
|--|--|
| **Purpose** | Play session: scenes, systems, quests, save |
| **Responsibilities** | Drive game using Project + state; call GameUI commands; use QuestRuntime |
| **Allowed deps** | Core, QuestRuntime, Conditions, Actions, Assets APIs |
| **Forbidden** | `window.Editor`, `editor/*`, `editor-test-session` as required dep, DOM as *required* for core logic |
| **Public API** | (legacy today: `GameEngine`); future façade over RuntimeContext |
| **Future** | Headless-testable play without Editor |

### Rendering

| | |
|--|--|
| **Purpose** | Draw spatial/visual frames |
| **Responsibilities** | Implement `IRenderer` backends |
| **Allowed deps** | Core, Runtime read-models, Assets, Web APIs |
| **Forbidden** | Editor; Core must not import a concrete backend |
| **Public API** | `init`, `resize`, `render`, `destroy` (contract only in 1.1) |
| **Future** | Canvas2D, WebGL2, optional WebGPU |

### Assets

| | |
|--|--|
| **Purpose** | Load/cache game assets by id |
| **Responsibilities** | register / load / unload / get |
| **Allowed deps** | Core |
| **Forbidden** | Editor UI; mutating Project without API |
| **Public API** | contract methods only in 1.1 |
| **Future** | GUID pipeline, import settings |

### Physics

| | |
|--|--|
| **Purpose** | Optional 2D/3D simulation |
| **Responsibilities** | Worlds, bodies (later) |
| **Allowed deps** | Core, Runtime |
| **Forbidden** | Required for TEXT mode |
| **Public API** | none in 1.1 |
| **Future** | WASM libs behind abstraction |

### GameUI

| | |
|--|--|
| **Purpose** | Present runtime state in the browser |
| **Responsibilities** | DOM (or canvas UI): scene text, choices, inventory, combat chrome |
| **Allowed deps** | DOM, Runtime *commands/API* |
| **Forbidden** | Owning quest SoT; Core importing GameUI |
| **Public API** | `showScene`, `showChoices`, `showDialogue`, `showInventory`, `showCombat`, `showNotification`, … |
| **Future** | Split from `ui-renderer.js` |

### Editor

| | |
|--|--|
| **Purpose** | Author Project data |
| **Responsibilities** | Tabs, inspector, templates, validation, export |
| **Allowed deps** | Core, Runtime *API*, schema, Conditions, Actions, Quest APIs |
| **Forbidden** | Being required by production Runtime |
| **Public API** | `Editor`, `Editor.hooks` (existing contract) |
| **Future** | Client-only; Play Mode clones Runtime |

**Preview bridge (existing):** `Editor → editor-test-session → Runtime` (not Runtime → Editor).

### Build

| | |
|--|--|
| **Purpose** | Produce browser-playable dist without Editor |
| **Responsibilities** | Bundles, version stamp |
| **Allowed deps** | Runtime + data + assets |
| **Forbidden** | Shipping Editor modules in game build |
| **Future** | Single load graph (fix dual-load of `engine.bundle.js` + modular scripts) |

### Game Modes

Shared: Core, Runtime, Assets, Events, Save, Input, GameUI.  
Differ: scene kind, renderer, spatial systems, editor tools.

| Mode | Scene | Notes |
|------|-------|-------|
| TEXT | TextScene | Current product via adapter |
| 2D | SpatialScene2D | Future |
| 3D | SpatialScene3D | Future |
| HYBRID | HybridScene | World + text/UI layers |

`GameMode` contract fields: `id`, `createScene`, `configureRuntime`, `configureEditor`, `capabilities`.

### Quest

| | |
|--|--|
| **Purpose** | Stage/task progress |
| **SoT** | `state.questProgress` via **QuestRuntime** |
| **Allowed** | Runtime services, events from gameplay |
| **Forbidden** | questStages as SoT; silent ManualAdvance; Editor ownership of progress |
| **API** | Existing QuestRuntime (KEEP) |
| **Future** | Optional thin adapter; never ECS-forced |

### Conditions / Actions

| | |
|--|--|
| **Purpose** | Gate content / run declared effects |
| **KEEP** | Evaluator + registry + payloads unchanged in 1.1 |
| **Future** | Namespaced packaging under Runtime API |

---

## State separation

| Kind | Examples | Must not mix with |
|------|----------|-------------------|
| **Project** | scenes, quests, items, templates | Player save, editor selection |
| **Runtime state** | current scene, HP, inventory, questProgress | Editor tabs, inspector |
| **Editor state** | currentTab, selection, undo stack | Player save |
| **Player save** | serialized runtime progress | Project authoring file |

---

## Scene boundary

```text
Scene (concept)
├── TextScene      ← existing JSON via TextSceneAdapter (contract)
├── SpatialScene2D  ← future
├── SpatialScene3D  ← future
└── HybridScene     ← future
```

```text
legacy scene JSON → TextSceneAdapter → Runtime / GameUI
```

`SceneManager` remains legacy owner until EXTRACT. Campaign handlers are content, not Core.

---

## Dependency rules (enforced by tests on `js/core`)

```text
Core        ↛ DOM, Editor, GameUI, concrete Renderer, campaign
Runtime     ↛ Editor, editor/*, editor-test-session as hard dep
Editor      → Core, Runtime API, schema, Conditions, Actions, Quest
GameUI      → DOM + Runtime commands
Rendering   → Core, Runtime, Assets, Web APIs
```

Forbidden:

- Runtime → Editor  
- Core → Editor  
- Core → DOM  

---

## Legacy GameEngine façade strategy

```text
window.GameEngine (legacy)
        ↓ gradual
Runtime façade + extracted services
        ↓
Core EngineApp / RuntimeContext
```

Categories in `js/core/legacy-facade-map.js`: **KEEP | FACADE | EXTRACT_LATER | DELETE_LATER**.

Do not migrate all ~186 methods in one phase.

---

## Quest EventBus vs Engine EventBus

| Bus | Role |
|-----|------|
| **QuestEvents** | Gameplay → QuestRuntime tasks |
| **EngineCore EventBus** | App/runtime lifecycle, future systems |

No automatic merge. Bridge only via explicit adapter if needed later.

---

## Phase 1.1 non-goals

ECS, Transform, Prefab, Physics, Canvas/WebGL/WebGPU, asset GUID migration, mass moves of `core.js` / `ui-renderer.js` / editor modules, QuestRuntime rewrite, save format change.
