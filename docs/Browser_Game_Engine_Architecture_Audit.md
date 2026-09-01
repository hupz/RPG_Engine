# Browser Game Engine — Technical Architecture Audit & Target Design

**Source codebase:** RPG_Engine (MythMill) v1.1.0  
**Document type:** Phase 0 Audit + Target Architecture + Migration Roadmap  
**Role:** Lead Engine Architect / Technical Director  
**Principle:** READ → UNDERSTAND → MAP → AUDIT → DESIGN → MIGRATE  
**Date:** August 2026

---

## A. Executive Summary

### Current state

RPG_Engine is a **JSON-driven text/IF RPG engine** with a large visual Editor. It successfully implements:

- Scene graph with choices, dialogue, combat hooks
- Quest v2: `Quest → Stage → Task → QuestEventBus → QuestRuntime` (`questProgress` as source of truth)
- ConditionSystem, Action Registry v3, Scene Components
- Editor with hooks, history, inspector, templates, no-code UX
- Standalone export / production bundle path
- ~173 JS modules, ~78 editor modules, ~27 test files, Quest suite baseline **138 passed**

It is **not** a general 2D/3D game engine. There is no Entity-Component-System for world objects, no sprite/tilemap/GLTF pipeline, no physics, no isolated Play Mode, and Editor is tightly coupled to a global `Editor` object and DOM.

### Main problems

1. **Architecture mismatch with target:** text-RPG core is strong; spatial 2D/3D foundation is absent.
2. **Editor fragility:** history of recursion (`hooks`, `renderSceneList`, `codeFieldIfAdvanced`), monkey-patching, load-order dependence.
3. **Global mutable state:** `Editor`, `GameEngine`, `window`-level registries.
4. **DOM-bound runtime UI:** `ui-renderer.js` mixes presentation and gameplay side effects.
5. **Partial dual systems:** legacy `questStages` / flags still present as compatibility mirrors.
6. **No true Asset pipeline:** assets are mostly paths inside JSON, not GUID-referenced assets with import metadata.
7. **Export is HTML+script composition**, not a clean `engine.js` + `game.js` + hashed assets pipeline.

### Potential

**High for TEXT / Interactive Fiction / hybrid dialogue-RPG.**  
**Medium for 2D** if a new ECS + Canvas/WebGL layer is introduced alongside (not inside) current scene text model.  
**Long-horizon for 3D/WebGPU** — greenfield modules on shared Core, not a fork of current scene text format.

**Verdict:** Feasible to evolve into a compact multi-mode Browser Game Engine **if** Core Runtime is extracted first and Editor becomes a client of that Core. Do **not** try to grow 3D features by further patching `editor.html` / global `Editor`.

**Reuse worth:** QuestRuntime, Conditions, Actions, data schema/migration patterns, campaign content, export packaging experience, no-code UX patterns.  
**Replace/isolate:** global Editor monkey-patches, DOM-as-runtime, flat scene-as-only-world-model.

---

## B. Current Architecture Map

### Repository layout (observed)

```
RPGengine/
├── editor.html, index.html, index.prod.html
├── js/
│   ├── engine/          # core, scene-manager, ui-renderer, combat, save-load, dialog, inventory
│   ├── quests/          # quest-runtime, task-*, quest-events, quest-migrate
│   ├── actions/         # action-registry, action-runner, effects
│   ├── components/      # scene UI components (trade, character_creator, panels)
│   ├── editor/          # ~78 editor modules (hooks, inspector, scene-builder, …)
│   ├── systems/         # climate, time, weather, reputation, …
│   ├── conditions.js, character-creator.js, scene-templates.js, …
│   └── engine.js / engine.monolith.js
├── data/, data/demos/
├── dist/                # engine.bundle.js, editor-core.bundle.js
├── tests/
├── docs/, ARCHITECTURE.md
└── package.json (esbuild build)
```

### Layer diagram (as-is)

```
Author ──► Editor (global Editor + hooks + DOM)
              │
              ▼
         Project JSON (scenes, quests, items, npcs, classes, …)
              │
              ▼
         GameEngine + SceneManager + Components + Actions
              │
              ├──► QuestEventBus ──► QuestRuntime (questProgress)
              ├──► ConditionSystem
              ├──► Combat / Inventory / Dialog
              └──► ui-renderer (DOM game UI)
              │
              ▼
         Save/Load + Standalone export HTML
```

### System-by-system audit

| System | Location | Runtime/Editor | Without DOM? | Exported game? | Cycles / globals | Verdict |
|--------|----------|----------------|--------------|----------------|------------------|---------|
| **GameEngine / core** | `js/engine/core.js`, `engine.js` | Runtime | Partially | Yes | Global engine instance | **REFACTOR** → Engine Core |
| **Scene Manager** | `js/engine/scene-manager.js` | Runtime | Logic yes, UI no | Yes | Coupled to UI | **EXTRACT** Scene + TextScene |
| **UI Renderer** | `js/engine/ui-renderer.js` | Runtime | No | Yes | Large; campaign residue risk | **REFACTOR** split GameUI |
| **QuestRuntime** | `js/quests/quest-runtime.js` | Runtime | Yes | Yes | Needs engine ref | **KEEP** (+ thin adapter) |
| **Task types / registry** | `task-base.js`, `task-types.js` | Runtime | Yes | Yes | — | **KEEP** |
| **Quest migrate** | `quest-migrate.js` | Load-time | Yes | Yes | — | **KEEP** |
| **Conditions** | `js/conditions.js` | Runtime | Yes | Yes | Must read QuestRuntime | **KEEP** / harden |
| **Actions** | `js/actions/*` | Runtime | Mostly | Yes | Registries global | **KEEP** / namespace |
| **Scene components** | `js/components/*`, `scene-components.js` | Runtime UI | No | Yes | — | **REFACTOR** as Text UI widgets |
| **Character Creator** | `character-creator.js` | Both | No | Yes | Large UI | **KEEP** for Text mode |
| **Combat** | `engine/combat.js`, combat-effects | Runtime | Partial | Yes | — | **KEEP** (TEXT/2D combat abstraction later) |
| **Save/Load** | `engine/save-load.js` | Runtime | Yes | Yes | — | **REFACTOR** versioned Project/Save |
| **Editor core** | `editor.html` + `editor-core*.js` | Editor | No | No | Global `Editor` | **REPLACE** modular shell |
| **Editor.hooks** | `editor-hooks.js` | Editor | N/A | No | Recursion history | **KEEP** with hard contract |
| **EditorHistory** | `editor-history.js` | Editor | N/A | No | Wrapper risks | **REFACTOR** command pattern |
| **Inspector** | `editor-inspector.js` | Editor | No | No | Had recursion bug | **REFACTOR** registry-only |
| **Scene builder / templates** | `editor-scene-*.js` | Editor | No | No | — | **KEEP** for Text; extend later |
| **World map / graph** | editor-worldmap, editor-graph | Editor | No | Partial runtime | — | **EXTRACT** tools |
| **Export** | `editor-export.js`, `dist/` | Build | — | Output | Bundle lag risk | **REPLACE** proper Build |
| **Legacy quests.js** | `.bak` / residual | — | — | — | — | **DELETE** when migration complete |
| **2D/3D render/physics** | — | — | — | — | **Absent** | **NEW** |

### Known incident class (do not reintroduce)

- Inspector `codeFieldIfAdvanced` self-recursion
- `Editor.hooks` + late `Editor.foo =` monkey-patches → recursion on `switchTab` / `renderAll` / `renderSceneList`
- `questStages` treated as source of truth (must remain mirror only)
- Campaign-hardcoded quest IDs in generic UI
- Full Inspector/Scene re-render on every keystroke (focus loss)

### Production source of truth (today)

| Concern | Source of truth |
|---------|-----------------|
| Quest progress | `QuestRuntime` → `state.questProgress` |
| Project content | JSON project data (`dataVersion`) |
| Conditions | ConditionSystem evaluating against runtime state + QuestRuntime |
| Actions | Action registry + runner |
| Editor extensions | `Editor.hooks` contract (when followed) |

---

## C. Target Architecture

```
Browser Game Engine
├── Engine Core
│   ├── App / Clock / Loop
│   ├── Event Bus
│   ├── Service Locator (explicit, not silent globals)
│   └── Project / Session
├── Runtime
│   ├── Scene System (mode-aware: TextScene | World2D | World3D | Composite)
│   ├── Entity System
│   ├── Component System
│   ├── Event System
│   ├── Input
│   ├── Audio
│   ├── Save/Load
│   ├── Script Runtime (sandbox)
│   ├── Asset Runtime
│   └── UI Runtime (Game UI only)
├── Rendering
│   ├── Renderer abstraction
│   ├── Canvas2D backend
│   ├── WebGL2 backend
│   └── WebGPU backend (optional later)
├── Physics
│   ├── Physics2D (optional lib)
│   └── Physics3D (optional lib)
├── Animation
├── Asset Pipeline (import, GUID, cache, deps)
├── Editor (optional for shipped game)
│   ├── Project/Asset Browser
│   ├── Scene Tree + Viewport
│   ├── Inspector (registry)
│   ├── Play/Stop isolation
│   └── Domain editors (Dialogue, Quest, Tilemap, …)
└── Export/Build System
```

### Core principles

1. **Editor is not required to run a built game.**
2. **Game UI ≠ Editor UI.**
3. **One Entity/Scene foundation; modes plug components/renderers.**
4. **No monkey-patch of public API; extensions via explicit registration.**
5. **Core systems unit-testable without DOM.**
6. **Small-team complexity budget** — no second Unreal.

### Scene / Entity / Component (shared)

```
Scene
 └── Entity (stable id / guid)
      ├── Transform2D | Transform3D | (none for pure text nodes)
      ├── Text / Dialogue / Choice components
      ├── SpriteRenderer | MeshRenderer
      ├── Collider2D | Collider3D
      ├── Script / Behaviour
      └── Domain: QuestLinker, InventoryBag, …
```

- **Entity ID:** UUID or project-local guid; human name separate.
- **Lifecycle:** create → attach → onEnable → update → onDisable → destroy.
- **Serialization:** pure data (JSON); runtime instances reconstituted.
- **Prefabs:** data template + instance overrides (v1: no nested prefabs).
- **Text mode:** entities may be logical (NPC, Trigger) without spatial transform.
- **Hybrid:** Composite scene hosts World layer + UI/Text layer sharing Event Bus & Assets.

### Renderer abstraction

```
IRenderer
  beginFrame / drawSprite / drawMesh / drawUI / endFrame
Backend: Canvas2D | WebGL2 | WebGPU
```

- Default path: **Canvas2D** for 2D MVP; **WebGL2** for 3D MVP.
- WebGPU only when abstraction is stable — not because it is newer.
- Text/UI renderer can remain DOM or canvas-text; decision per project type.

### Asset Manager

Asset ≠ Entity. GUID, metadata, import settings, dependency graph, cache, reimport, thumbnails. Types: image, spritesheet, audio, font, gltf, material, scene, prefab, script, json, shader.

### Prefab v1 (minimal)

- Save entity subtree as prefab asset.
- Instantiate into scene.
- Property overrides on instance.
- Nested prefabs: **later** (high complexity).

### Play Mode

```
EDIT → snapshot project → PLAY (clone runtime world) → STOP (dispose runtime) → EDIT
```

Editor state must not be mutated by gameplay. Runtime gets a frozen or copied project snapshot.

### Scripts

- Author scripts: JavaScript (TypeScript compile optional in build).
- `Behaviour` lifecycle: `onStart`, `update(dt)`, `onDestroy`.
- Sandbox: no raw `eval` of untrusted project code in editor without isolation; production build bundles author scripts.
- Prefer **data Actions + Events** for no-code; scripts for advanced users.

### UI

| | Editor UI | Game UI |
|--|-----------|---------|
| Tech | DOM modules, no game rules | DOM and/or Canvas UI pack |
| Ship | Dev only | In export |
| State | Editor project model | Runtime state |

### Physics

- Abstraction `PhysicsWorld2D` / `PhysicsWorld3D`.
- Integrate proven WASM libs only when a mode needs them (e.g. rapier/box2d-ish for 2D).
- Text mode: no physics module loaded.

### Export / Build

```
Project → Build → dist/
  index.html
  engine.js      # core + selected backends
  game.js        # project scripts
  assets/        # hashed
  data/          # scenes, prefabs, tables
```

Dev build: source maps, no minify. Prod: minify, hash, preload critical, lazy optional packs (3D, physics).

### Project format (sketch)

```json
{
  "name": "My Game",
  "engineVersion": "2.0.0",
  "projectType": "text" | "2d" | "3d" | "hybrid",
  "renderer": { "2d": "canvas2d", "3d": "webgl2" },
  "dataVersion": 3,
  "assets": { "guid…": { "type": "image", "path": "…" } },
  "scenes": { "guid…": { "mode": "text", "entities": [] } },
  "entryScene": "guid…"
}
```

Migrations: ordered migrators per `dataVersion` (pattern already exists).

---

## D. Migration Map

| Existing | Action | New location | Reason |
|----------|--------|--------------|--------|
| QuestRuntime + tasks + events | **KEEP** | `runtime/quests/` | Solid SoT, tested |
| quest-migrate | **KEEP** | `runtime/quests/` | Backward saves |
| Conditions | **KEEP** | `runtime/conditions/` | Shared by Text/Hybrid |
| Actions v3 | **KEEP** | `runtime/actions/` | No-code backbone |
| Scene JSON (text) | **ADAPTER** | `TextScene` / `Dialogue` components | Preserve content |
| Scene components (trade, CC) | **REFACTOR** | Game UI widgets | Decouple from editor |
| Character Creator | **KEEP** | Text/Hybrid systems | Feature complete |
| Combat | **KEEP** | `runtime/combat/` | Extend later for 2D |
| ui-renderer | **SPLIT** | `GameUI` + thin presenters | Remove god-object |
| campaign-hooks | **KEEP** | `content/` not engine | Content ≠ engine |
| Editor.hooks | **KEEP** | `editor/hooks` | Contract already documented |
| Editor global Object.assign | **REPLACE** | explicit modules + DI | Stop load-order bugs |
| EditorHistory wrappers | **REFACTOR** | Command stack | Safer than method wrap |
| Inspector | **REFACTOR** | pure registry renderers | Avoid recursion classes |
| Templates / scene types | **KEEP** | Text editor tools | High author value |
| Export HTML embed | **REPLACE** | Build pipeline | Real dist layout |
| engine.monolith / stale bundles | **DELETE** after cutover | — | Drift source |
| quests.js.bak / dead flags paths | **DELETE** | — | After migration tests |
| 2D/3D/Physics/Assets GUID | **NEW** | `runtime/*`, `assets/*` | Missing foundations |

Pattern per module: **OLD → Adapter → NEW → DELETE OLD** when tests green.

---

## E. Dependency Graph (target)

```
AssetPipeline ──► Runtime (load)
EngineCore ──► Scene ──► Entity/Components
EventBus ◄── Scripts, Quests, Actions, UI, Physics, Input
Renderer ◄── Sprite/Mesh components (not Editor)
QuestRuntime ◄── Events, Conditions, Save
Editor ──► Project model ──► (Play) Runtime clone
Build ──► EngineCore + Runtime + Assets + Data ──► Browser
```

Forbidden: Runtime → Editor imports. Editor may call Runtime APIs only through defined façade.

---

## F. Four Game Modes

| System | 2D | 3D | Text | Hybrid |
|--------|----|----|------|--------|
| Engine Core / Events | ✓ | ✓ | ✓ | ✓ |
| Entity/Component | ✓ | ✓ | ✓ (logical) | ✓ |
| QuestRuntime | ✓ | ✓ | ✓ | ✓ |
| Conditions / Actions | ✓ | ✓ | ✓ | ✓ |
| Canvas2D / sprites / tilemap | ✓ | — | — | optional |
| WebGL2 / GLTF / lights | — | ✓ | — | optional |
| Physics2D/3D | optional | optional | — | optional |
| Dialogue / choices / IF | optional | optional | ✓ | ✓ |
| Character Creator | optional | optional | ✓ | ✓ |
| Game UI (inventory, journal) | ✓ | ✓ | ✓ | ✓ |
| Editor Viewport spatial | ✓ | ✓ | graph/flow | both |
| Editor Dialogue/Quest tools | ✓ | ✓ | ✓ | ✓ |

---

## G. Roadmap (dependency order & deliverables)

### Phase 0 — Audit *(this document)*
- **Done when:** architecture report accepted; no mass rewrite started.

### Phase 1 — Architecture boundaries
- **Goal:** Define packages: `core`, `runtime`, `render`, `editor`, `build`.
- **Deliverables:** folder contracts, no-runtime-imports-editor rule, public API sketch.
- **Touches:** docs, thin barrels; minimal code moves.
- **Tests:** lint/import boundary check script.
- **Risk:** over-abstraction — keep packages few.

### Phase 2 — Core Runtime
- **Goal:** `EngineApp`, `EventBus`, `Entity`, `Component`, `Scene` without DOM.
- **Deliverables:** unit tests create/destroy entity; serialize scene.
- **Blocks:** nothing from old game yet; adapter later.
- **Done when:** headless node tests pass for ECS smoke.

### Phase 3 — Asset Pipeline
- **Goal:** GUID assets, registry, load by ref.
- **Deliverables:** import image/audio/json; dependency list.
- **Done when:** runtime loads asset by GUID in test.

### Phase 4 — Renderer abstraction
- **Goal:** `IRenderer` + Canvas2D clear/sprite; stub WebGL2.
- **Done when:** demo draws sprite from asset without Editor.

### Phase 5 — Editor Foundation
- **Goal:** Shell: Project browser, hierarchy, inspector host, viewport host.
- **Migrate:** Inspector registry pattern; **no** new monkey-patches.
- **Done when:** open project, select entity, edit property, undo.

### Phase 6 — Play Mode
- **Goal:** isolated runtime instance; Stop restores editor.
- **Done when:** play mutates clone only; stop equals pre-play snapshot.

### Phase 7 — 2D workflow
- Sprite, camera, simple tilemap, input move.
- **Done when:** sample 2D project builds and runs exported.

### Phase 8 — 3D workflow
- GLTF load, camera, light, mesh draw via WebGL2 backend.
- **Done when:** sample 3D scene exported runs.

### Phase 9 — Text mode (migrate existing strength)
- **Adapter** current scenes/quests/dialogue into TextScene + components.
- Ship existing Quest/Condition/Action as-is under new packages.
- **Done when:** Mill campaign (or demo) runs on new core with golden tests 138+.

### Phase 10 — Hybrid
- Composite scene; shared bus; UI+World.
- **Done when:** sample 3D room + dialogue overlay.

### Phase 11 — Prefabs / Animation / advanced tools
- Prefab v1; sprite animation; optional anim clips 3D.

### Phase 12 — Build / Export
- `dist/` layout hashed; remove stale monolith dependence.

### Phase 13 — Testing
- ECS, assets, render smoke, play mode, quest regression, editor boot smoke.

### Phase 14 — Migration / Cleanup
- Delete adapters and dead bundles; docs.

### Phase 15 — Stable Release
- Version 2.0 engineVersion; sample hubs for 4 modes.

**Process for every change:** Change → Test → Verify → Commit → Next.

---

## H. File-Level Plan (initial phases)

### Phase 1–2 create
- `js/core/event-bus.js`, `engine-app.js`, `entity.js`, `component.js`, `scene.js`
- `js/core/index.js`

### Phase 2–3 create
- `js/assets/asset-registry.js`, `asset-loader.js`

### Phase 4 create
- `js/render/renderer.js`, `canvas2d-renderer.js`, `webgl2-renderer.js` (stub)

### Phase 5–6 create
- `js/editor-v2/` shell (parallel to old editor until cutover)
- PlaySession service

### Phase 9 migrate / adapt
- `js/runtime/text/text-scene-adapter.js` ← existing scene JSON
- Move `js/quests/*` under `js/runtime/quests/` (re-export compatibility)

### Phase 12 delete (after green)
- Stale `engine.monolith.js` usage paths, duplicate bundles, `.bak` quest files

### Phase 5+ change carefully
- `editor-hooks.js` — keep contract; forbid new late assignments
- `editor-inspector.js` — registry only
- `editor-export.js` — replace pipeline

---

## I. Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Scope explosion (3D+physics+editor) | Project stall | Strict phase gates; TEXT+Core first |
| Editor recursion regress | Unusable tools | Hooks contract tests; ban monkey-patch |
| Content break (quests/saves) | User trust | Keep QuestRuntime; migration tests |
| Bundle drift (dist vs src) | “Fixed but not fixed” | Single build path; no dual sources |
| DOM Game UI forever | Hard 2D/3D UI | Introduce Game UI pack interface early |
| Nested prefabs early | Complexity | Prefab v1 only |
| WebGPU first | Delay | WebGL2 for 3D MVP |
| One giant PR | Unreviewable | Small commits, continuous quest 138 |

---

## J. Definition of Done (Browser Game Engine)

Engine is “ready” when:

1. Four project templates open in Editor: 2D, 3D, Text, Hybrid.
2. Each template **Play**s without corrupting editor state; **Stop** restores.
3. **Build** produces runnable `dist/` without Editor scripts.
4. TEXT mode runs existing-style quest demo; automated quest tests pass.
5. 2D sample: move sprite, collision or trigger, camera.
6. 3D sample: load GLTF, orbit camera, one light.
7. Hybrid sample: world + dialogue using same Event Bus.
8. Assets referenced by GUID; rename/reimport does not hard-break scenes.
9. No runtime import of Editor modules in production build.
10. Documented API for Behaviour scripts and data Actions.
11. Performance budget documented for target hardware (integrated GPU laptop).
12. Clean Risk items closed or accepted with owners.

---

## Complexity checklist (section 19)

| Idea | Need now? | Simpler? | Later? | Debt if skip? |
|------|-----------|----------|--------|---------------|
| Full nested prefabs | No | Flat prefab v1 | Yes | Low |
| WebGPU | No | WebGL2 | Yes | Low |
| Custom physics engine | No | Optional lib | Yes | None |
| TypeScript everywhere | Optional | JS + JSDoc | Migrate gradually | Medium if never typed |
| Second quest system | **No** | Keep QuestRuntime | — | High if duplicated |
| Editor rewrite in React | No | Incremental shell | Maybe | High rewrite cost |

---

## Final recommendation

1. **Accept** this audit as Phase 0.
2. **Implement Phase 1–2** (Core ECS + EventBus) in parallel tree without breaking current Editor.
3. **Phase 9 early spike:** adapter proving Mill/demo quests on new Core (risk reduction).
4. Only then invest in spatial 2D/3D renderers.
5. Never reintroduce `Editor.foo = wrapper(Editor.foo)` or quest progress outside QuestRuntime.

**One engine → one Editor → four creation modes → one Runtime → shared Asset/Scene/Entity foundation.**

Existing RPG_Engine is the **migration base**, not the ceiling.
