# Browser Game Engine — Технический архитектурный аудит и целевой дизайн

**Исходная кодовая база:** RPG_Engine (MythMill) v1.1.0  
**Тип документа:** Phase 0 — Аудит + Target Architecture + Roadmap миграции  
**Роль:** Lead Engine Architect / Technical Director  
**Принцип:** READ → UNDERSTAND → MAP → AUDIT → DESIGN → MIGRATE  
**Дата:** август 2026

---

## A. Краткое резюме (Executive Summary)

### Текущее состояние

RPG_Engine — это **JSON-ориентированный текстовый / interactive fiction RPG-движок** с крупным визуальным редактором. Уже реализовано:

- граф сцен: выборы, диалоги, боевые хуки;
- квесты v2: `Quest → Stage → Task → QuestEventBus → QuestRuntime` (`questProgress` — единственный source of truth);
- ConditionSystem, Action Registry v3, Scene Components;
- Editor: hooks, history, inspector, шаблоны, no-code UX;
- standalone export / production bundle;
- ~173 JS-модуля, ~78 модулей редактора, ~27 тестовых файлов, baseline квест-тестов **138 passed**.

Это **не** универсальный 2D/3D игровой движок. Нет ECS для мировых объектов, нет пайплайна sprite/tilemap/GLTF, нет физики, нет изолированного Play Mode. Редактор жёстко связан с глобальным объектом `Editor` и DOM.

### Главные проблемы

1. **Несоответствие цели:** текстовое IF-ядро сильное; фундамент пространственных 2D/3D отсутствует.
2. **Хрупкость Editor:** история рекурсий (`hooks`, `renderSceneList`, `codeFieldIfAdvanced`), monkey-patching, зависимость от порядка загрузки.
3. **Глобальное мутабельное состояние:** `Editor`, `GameEngine`, реестры на `window`.
4. **Runtime UI, привязанный к DOM:** `ui-renderer.js` смешивает презентацию и побочные эффекты геймплея.
5. **Частичный dual-stack:** legacy `questStages` / flags остаются как compatibility mirror.
6. **Нет полноценного Asset pipeline:** ассеты — в основном пути в JSON, а не GUID с метаданными импорта.
7. **Export** — сборка HTML+скриптов, а не чистый пайплайн `engine.js` + `game.js` + hashed assets.

### Потенциал

**Высокий** для TEXT / Interactive Fiction / hybrid dialogue-RPG.  
**Средний** для 2D — если рядом (не внутри) текстовой модели сцен ввести ECS + Canvas/WebGL.  
**Долгий горизонт** для 3D/WebGPU — greefield-модули на общем Core, а не форк текущего текстового формата сцен.

**Вердикт:** превратить базу в компактный multi-mode Browser Game Engine **реально**, если сначала выделить **Core Runtime**, а Editor сделать клиентом этого Core. **Нельзя** наращивать 3D дальнейшими патчами `editor.html` / глобального `Editor`.

**Имеет смысл переиспользовать:** QuestRuntime, Conditions, Actions, паттерны data schema/migration, контент кампаний, опыт export, no-code UX.  
**Заменить / изолировать:** global Editor monkey-patches, DOM-as-runtime, плоскую модель «сцена = весь мир».

---

## B. Карта текущей архитектуры

### Структура репозитория (факт)

```
RPGengine/
├── editor.html, index.html, index.prod.html
├── js/
│   ├── engine/          # core, scene-manager, ui-renderer, combat, save-load, dialog, inventory
│   ├── quests/          # quest-runtime, task-*, quest-events, quest-migrate
│   ├── actions/         # action-registry, action-runner, effects
│   ├── components/      # UI-компоненты сцен (trade, character_creator, panels)
│   ├── editor/          # ~78 модулей редактора
│   ├── systems/         # climate, time, weather, reputation, …
│   ├── conditions.js, character-creator.js, scene-templates.js, …
│   └── engine.js / engine.monolith.js
├── data/, data/demos/
├── dist/                # engine.bundle.js, editor-core.bundle.js
├── tests/
├── docs/, ARCHITECTURE.md
└── package.json (сборка esbuild)
```

### Слои as-is

```
Автор ──► Editor (глобальный Editor + hooks + DOM)
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
              └──► ui-renderer (DOM игрового UI)
              │
              ▼
         Save/Load + Standalone export HTML
```

### Аудит по системам

| Система | Где | Runtime/Editor | Без DOM? | В export? | Вердикт |
|---------|-----|----------------|----------|-----------|---------|
| **GameEngine / core** | `js/engine/core.js`, `engine.js` | Runtime | Частично | Да | **REFACTOR** → Engine Core |
| **Scene Manager** | `scene-manager.js` | Runtime | Логика да, UI нет | Да | **EXTRACT** Scene + TextScene |
| **UI Renderer** | `ui-renderer.js` | Runtime | Нет | Да | **REFACTOR** выделить GameUI |
| **QuestRuntime** | `quests/quest-runtime.js` | Runtime | Да | Да | **KEEP** (+ тонкий adapter) |
| **Task types / registry** | `task-base.js`, `task-types.js` | Runtime | Да | Да | **KEEP** |
| **Quest migrate** | `quest-migrate.js` | Load-time | Да | Да | **KEEP** |
| **Conditions** | `conditions.js` | Runtime | Да | Да | **KEEP** / укрепить |
| **Actions** | `js/actions/*` | Runtime | В основном | Да | **KEEP** / namespace |
| **Scene components** | `components/*` | Runtime UI | Нет | Да | **REFACTOR** → виджеты Game UI |
| **Character Creator** | `character-creator.js` | Оба | Нет | Да | **KEEP** для TEXT |
| **Combat** | `combat.js` | Runtime | Частично | Да | **KEEP** |
| **Save/Load** | `save-load.js` | Runtime | Да | Да | **REFACTOR** версионирование |
| **Editor core** | `editor.html` + core-модули | Editor | Нет | Нет | **REPLACE** модульный shell |
| **Editor.hooks** | `editor-hooks.js` | Editor | N/A | Нет | **KEEP** + жёсткий контракт |
| **EditorHistory** | `editor-history.js` | Editor | N/A | Нет | **REFACTOR** command pattern |
| **Inspector** | `editor-inspector.js` | Editor | Нет | Нет | **REFACTOR** только registry |
| **Scene builder / templates** | `editor-scene-*.js` | Editor | Нет | Нет | **KEEP** для TEXT |
| **Export** | `editor-export.js`, `dist/` | Build | — | Выход | **REPLACE** нормальный Build |
| **Legacy quests.js** | `.bak` / остатки | — | — | — | **DELETE** после миграции |
| **2D/3D render/physics** | — | — | — | — | **NEW** (отсутствует) |

### Классы инцидентов (не повторять)

- саморекурсия Inspector `codeFieldIfAdvanced`;
- `Editor.hooks` + поздние `Editor.foo = …` → рекурсия `switchTab` / `renderAll` / `renderSceneList`;
- `questStages` как source of truth (должен оставаться только mirror);
- hardcoded campaign quest id в generic UI;
- полный re-render Inspector/Scene на каждый символ (потеря фокуса).

### Production source of truth (сейчас)

| Область | Источник истины |
|---------|-----------------|
| Прогресс квестов | `QuestRuntime` → `state.questProgress` |
| Контент проекта | JSON проекта (`dataVersion`) |
| Условия | ConditionSystem + QuestRuntime |
| Действия | Action registry + runner |
| Расширения Editor | контракт `Editor.hooks` (когда соблюдается) |

---

## C. Целевая архитектура

```
Browser Game Engine
├── Engine Core
│   ├── App / Clock / Loop
│   ├── Event Bus
│   ├── явный Service Locator (не молчаливые global)
│   └── Project / Session
├── Runtime
│   ├── Scene System (TextScene | World2D | World3D | Composite)
│   ├── Entity System
│   ├── Component System
│   ├── Event System
│   ├── Input, Audio, Save/Load
│   ├── Script Runtime (sandbox)
│   ├── Asset Runtime
│   └── UI Runtime (только Game UI)
├── Rendering
│   ├── абстракция Renderer
│   ├── backend Canvas2D
│   ├── backend WebGL2
│   └── backend WebGPU (опционально позже)
├── Physics (опционально 2D / 3D)
├── Animation
├── Asset Pipeline (import, GUID, cache, deps)
├── Editor (не нужен для уже собранной игры)
└── Export / Build System
```

### Принципы

1. **Editor не обязателен** для запуска собранной игры.
2. **Game UI ≠ Editor UI.**
3. **Один фундамент Entity/Scene;** режимы подключают компоненты и рендереры.
4. **Без monkey-patch** публичного API; расширения — явная регистрация.
5. **Core тестируется без DOM.**
6. **Бюджет сложности маленькой команды** — не второй Unreal.

### Scene / Entity / Component

```
Scene
 └── Entity (стабильный id / guid)
      ├── Transform2D | Transform3D | (нет — для чисто текстовых узлов)
      ├── Text / Dialogue / Choice
      ├── SpriteRenderer | MeshRenderer
      ├── Collider2D | Collider3D
      ├── Script / Behaviour
      └── доменные: QuestLinker, InventoryBag, …
```

- **Prefab v1:** шаблон + overrides на инстансе; nested prefabs — позже.
- **Text:** сущности могут быть логическими без пространственного transform.
- **Hybrid:** composite-сцена = World + UI/Text на общей Event Bus и Assets.

### Renderer

```
IRenderer → beginFrame / drawSprite / drawMesh / drawUI / endFrame
Backend: Canvas2D | WebGL2 | WebGPU
```

MVP: **Canvas2D** для 2D, **WebGL2** для 3D. WebGPU — когда абстракция стабильна.

### Play Mode

```
EDIT → снимок проекта → PLAY (клон runtime) → STOP (уничтожить runtime) → EDIT
```

Состояние редактора геймплей не портит.

### Скрипты

JavaScript (TypeScript — опционально на этапе build). Lifecycle `Behaviour`: `onStart`, `update(dt)`, `onDestroy`. No-code опирается на **Actions + Events**; скрипты — advanced.

### UI

| | Editor UI | Game UI |
|--|-----------|---------|
| Технология | DOM-модули, без игровых правил | DOM и/или Canvas UI |
| В поставке | только dev | в export |
| Состояние | модель проекта Editor | runtime state |

### Physics

Абстракция `PhysicsWorld2D` / `PhysicsWorld3D`. Готовые WASM-библиотеки — только когда режим реально нуждается. Text mode физику не грузит.

### Export / Build

```
Project → Build → dist/
  index.html
  engine.js
  game.js
  assets/   (hash)
  data/
```

### Формат проекта (эскиз)

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

Миграции: упорядоченные migrator'ы по `dataVersion` (паттерн уже есть).

---

## D. Карта миграции

| Существующее | Действие | Куда | Зачем |
|--------------|----------|------|-------|
| QuestRuntime + tasks + events | **KEEP** | `runtime/quests/` | Надёжный SoT, тесты |
| quest-migrate | **KEEP** | `runtime/quests/` | Старые save |
| Conditions | **KEEP** | `runtime/conditions/` | TEXT/Hybrid |
| Actions v3 | **KEEP** | `runtime/actions/` | No-code |
| Scene JSON (text) | **ADAPTER** | TextScene / Dialogue components | Сохранить контент |
| Scene components | **REFACTOR** | виджеты Game UI | Отвязать от editor |
| Character Creator | **KEEP** | системы TEXT/Hybrid | Готовая фича |
| Combat | **KEEP** | `runtime/combat/` | Позже расширить под 2D |
| ui-renderer | **SPLIT** | GameUI + тонкие presenters | Убрать god-object |
| campaign-hooks | **KEEP** | `content/`, не engine | Контент ≠ движок |
| Editor.hooks | **KEEP** | `editor/hooks` | Контракт уже описан |
| Global Editor Object.assign | **REPLACE** | явные модули + DI | Порядок загрузки |
| EditorHistory wrappers | **REFACTOR** | command stack | Безопаснее wrap методов |
| Inspector | **REFACTOR** | чистые registry renderers | Класс рекурсий |
| Templates / scene types | **KEEP** | инструменты TEXT | Ценность для автора |
| Export HTML embed | **REPLACE** | Build pipeline | Нормальный dist |
| monolith / устаревшие bundle | **DELETE** после cutover | — | Источник drift |
| quests.js.bak / мёртвые flag-path | **DELETE** | — | После тестов миграции |
| 2D/3D/Physics/Assets GUID | **NEW** | `runtime/*`, `assets/*` | Нет фундамента |

Паттерн модуля: **OLD → Adapter → NEW → DELETE OLD**, когда тесты зелёные.

---

## E. Граф зависимостей (цель)

```
AssetPipeline ──► Runtime (load)
EngineCore ──► Scene ──► Entity/Components
EventBus ◄── Scripts, Quests, Actions, UI, Physics, Input
Renderer ◄── Sprite/Mesh components (не Editor)
QuestRuntime ◄── Events, Conditions, Save
Editor ──► модель Project ──► (Play) клон Runtime
Build ──► EngineCore + Runtime + Assets + Data ──► Browser
```

**Запрещено:** импорты Runtime → Editor. Editor вызывает Runtime только через фасад.

---

## F. Четыре режима проектов

| Система | 2D | 3D | Text | Hybrid |
|---------|----|----|------|--------|
| Engine Core / Events | ✓ | ✓ | ✓ | ✓ |
| Entity/Component | ✓ | ✓ | ✓ (логические) | ✓ |
| QuestRuntime | ✓ | ✓ | ✓ | ✓ |
| Conditions / Actions | ✓ | ✓ | ✓ | ✓ |
| Canvas2D / sprites / tilemap | ✓ | — | — | опционально |
| WebGL2 / GLTF / lights | — | ✓ | — | опционально |
| Physics 2D/3D | опц. | опц. | — | опц. |
| Dialogue / choices / IF | опц. | опц. | ✓ | ✓ |
| Character Creator | опц. | опц. | ✓ | ✓ |
| Game UI (инвентарь, журнал) | ✓ | ✓ | ✓ | ✓ |
| Пространственный Viewport | ✓ | ✓ | graph/flow | оба |
| Dialogue/Quest tools в Editor | ✓ | ✓ | ✓ | ✓ |

---

## G. Дорожная карта

| Фаза | Цель / deliverable |
|------|-------------------|
| **0 Audit** | Этот отчёт; без массового rewrite |
| **1 Architecture** | Пакеты core/runtime/render/editor/build; проверка границ импортов |
| **2 Core Runtime** | EngineApp, EventBus, Entity, Component, Scene; headless-тесты |
| **3 Assets** | GUID-реестр, load by ref, image/audio/json |
| **4 Renderer** | IRenderer + Canvas2D sprite; заглушка WebGL2 |
| **5 Editor Foundation** | Browser, hierarchy, inspector host, viewport host; без новых monkey-patch |
| **6 Play Mode** | Изолированный runtime; Stop восстанавливает снимок |
| **7 2D** | Sprite, camera, tilemap sample; export запускается |
| **8 3D** | GLTF, light, camera; export запускается |
| **9 Text** | Adapter текущих сцен/квестов; golden quest-тесты |
| **10 Hybrid** | Composite scene; диалог поверх мира |
| **11 Prefab/Anim** | Prefab v1; sprite anim; опционально 3D clips |
| **12 Build/Export** | Hashed `dist/`; убрать зависимость от stale monolith |
| **13 Testing** | ECS, assets, play, quests, editor boot |
| **14 Cleanup** | Удалить adapters/мёртвый код; документация |
| **15 Stable** | engineVersion 2.x; четыре sample-проекта |

**Процесс каждого изменения:** Change → Test → Verify → Commit → Next.  
**Ранний spike Phase 9** — снизить риск поломки контента.

---

## H. План на уровне файлов (ранние фазы)

**Создать (Phase 1–4):**  
`js/core/event-bus.js`, `engine-app.js`, `entity.js`, `component.js`, `scene.js`,  
`js/assets/asset-registry.js`, `asset-loader.js`,  
`js/render/renderer.js`, `canvas2d-renderer.js`, `webgl2-renderer.js` (stub).

**Создать (Phase 5–6):** параллельный `js/editor-v2/` shell, сервис PlaySession.

**Мигрировать (Phase 9):**  
`js/runtime/text/text-scene-adapter.js` ← текущий scene JSON;  
`js/quests/*` → `js/runtime/quests/` (re-export совместимости).

**Удалить после зелёных тестов (Phase 12–14):** пути использования stale `engine.monolith.js`, дубли bundle, `.bak` квестов.

**Менять осторожно:** `editor-hooks.js` (контракт), `editor-inspector.js` (только registry), `editor-export.js` (новый pipeline).

---

## I. Реестр рисков

| Риск | Влияние | Митигация |
|------|---------|-----------|
| Раздувание scope (3D+physics+editor) | Остановка проекта | Жёсткие phase gates; TEXT+Core первыми |
| Регрессия рекурсий Editor | Нерабочий инструмент | Тесты hooks; запрет monkey-patch |
| Поломка контента (квесты/save) | Потеря доверия | Сохранить QuestRuntime; suite миграции |
| Drift bundle (dist ≠ src) | «Исправили, а в браузере старое» | Единый build path |
| Game UI навсегда на DOM | Сложный 2D/3D UI | Интерфейс Game UI pack заранее |
| Nested prefabs / WebGPU слишком рано | Сложность | Prefab v1; WebGL2 для 3D MVP |
| Один гигантский PR | Неревьюируемо | Маленькие коммиты, quest 138 continuously |

---

## J. Definition of Done

Движок считается готовым, когда:

1. В Editor открываются четыре шаблона: 2D, 3D, Text, Hybrid.
2. У каждого **Play** не портит editor state; **Stop** восстанавливает.
3. **Build** даёт runnable `dist/` без скриптов Editor.
4. TEXT mode гоняет demo-квесты; автотесты квестов зелёные.
5. 2D sample: движение спрайта, триггер/коллизия, камера.
6. 3D sample: GLTF, orbit camera, один свет.
7. Hybrid: мир + диалог на одной Event Bus.
8. Ассеты по GUID; rename/reimport не ломает сцены жёстко.
9. В production build нет импортов Runtime → Editor.
10. Задокументированы API Behaviour и data Actions.
11. Зафиксирован performance budget для целевого железа.
12. Риски закрыты или приняты с владельцами.

---

## Проверка сложности (§19 ТЗ)

| Идея | Нужно сейчас? | Проще? | Позже? |
|------|---------------|--------|--------|
| Полные nested prefabs | Нет | Flat prefab v1 | Да |
| WebGPU | Нет | WebGL2 | Да |
| Своя физика с нуля | Нет | Опциональная lib | Да |
| TypeScript везде | Опционально | JS + JSDoc | Постепенно |
| Вторая система квестов | **Нет** | Оставить QuestRuntime | — |
| Editor на React с нуля | Нет | Инкрементальный shell | Возможно |

---

## Итоговая рекомендация

1. **Принять** этот аудит как Phase 0.  
2. **Сделать Phase 1–2** (Core ECS + EventBus) в параллельном дереве, не ломая текущий Editor.  
3. **Ранний spike Phase 9:** adapter, что demo-квесты живут на новом Core.  
4. Только потом — пространственные 2D/3D рендереры.  
5. Никогда не возвращать `Editor.foo = wrapper(Editor.foo)` и прогресс квестов вне QuestRuntime.

**Один движок → один Editor → четыре способа создавать игры → один Runtime → единый фундамент Asset/Scene/Entity.**

Существующий RPG_Engine — **база для миграции**, а не потолок архитектуры.
