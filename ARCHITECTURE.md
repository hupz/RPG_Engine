# Архитектура MythMill RpgEngine

Актуально после перехода на **Quest v2**, модульный Editor и component/action v3.

> **Browser Game Engine (Phase 1.1+):** границы Core / Runtime / Editor / GameUI / Render / Modes — см. [`docs/architecture.md`](docs/architecture.md). Legacy `GameEngine` остаётся production entry; `js/core/*` — foundation без DOM/Editor.

## 1. Слои

```
Автор (Editor UI, без кода)
    → Project JSON (dataVersion / questsVersion)
    → GameEngine + SceneManager + Components + Actions
    → QuestEvents
    → QuestRuntime (questProgress)
    → Journal / Conditions / Save
```

## 2. Квесты (source of truth)

| Слой | Ответственность |
|------|-----------------|
| **QuestRuntime** | `state.questProgress` — единственный источник прогресса |
| **QuestEvents** | шина: ItemCollected, GoldSpent, ObjectInteracted, TaskManualComplete… |
| **Task types** | `js/quests/task-types.js` + registry в `task-base.js` |
| **QuestMigrate** | v1 → v2; неоднозначное → `MigrationRequired` |
| **questStages** | только mirror / hydrate старых save |

### Правила

- Неизвестный task type → ошибка / placeholder, **не** silent ManualAdvance.
- ManualAdvance завершается только `TaskManualComplete`, не `StageActivated`.
- DeliverItem считает только `ItemDelivered`.
- InteractObject считает только `ObjectInteracted`.
- Conditions читают стадию через `QuestRuntime`, не через прямую мутацию `questStages`.

### Файлы

- `js/quests/task-base.js`
- `js/quests/task-types.js`
- `js/quests/quest-events.js`
- `js/quests/quest-runtime.js`
- `js/quests/quest-migrate.js`
- `js/engine/campaign-hooks.js` — контент демо-кампании, не generic UI

## 3. Editor

```
editor.html: const Editor = { core helpers }
  → editor-hooks.js, editor-utils.js, editor-data-load.js
  → feature modules (js/editor/*.js) via Object.assign(Editor, …)
```

**Порядок скриптов критичен.** Пример: `editor-classes.js` **до** `editor-class-skills.js` (bind при загрузке).

`conditions.js` в editor path — **один** раз.

### Hooks

Предпочтительно `Editor.hooks.after/before/replace`, а не «голый» `Editor.method = …` без согласования.

## 4. Actions / Components (v3)

См. `docs/ARCHITECTURE-V3.md`.

Кратко: сцена → `components[]` → service_menu / trade / dialogue → `ActionRunner.runV2`.

## 5. Production & export

| Path | Скрипты |
|------|---------|
| `index.html` | модули `js/engine/*` + `js/quests/*` |
| `index.prod.html` | `dist/engine.bundle.js` + `js/quests/*` |
| Standalone export | inline quest v2 modules, **без** `js/quests.js` |

Пересборка bundle:

```bash
node scripts/build.mjs engine          # runtime
node scripts/build.mjs editor-full     # все скрипты editor.html → dist/editor-full.bundle.js
```

Альтернатива с отдельными тегами: `editor.html`. С одним бандлом: `editor-bundle.html` (после `build:editor-full`).

В active production path **нет** `QuestSystem`.

## 6. Save / Load

1. Есть `questProgress` → использовать.
2. Иначе V1 (`questStages` / flags) → hydrate → `questProgress`.
3. Mirror `questStages` обновляется из progress для старых читателей.

## 7. Тесты

`tests/quest-*.js` — baseline **138 passed**.

```bash
cd tests && for f in quest-*.js; do node "$f" || exit 1; done
```

## 8. Документация для автора

Пользовательское руководство: **`editor-guide.html`** (переписано под Quest v2).

## Guides

- Author (no-code): `editor-guide.html`
- Developer (QuestRuntime, migration): `docs/DEVELOPER-GUIDE.md`

## Editor Extension / Hooks Contract

Этот раздел фиксирует стабильную архитектуру расширения Editor после recovery (hooks PASS, 0 recursion).

**Не ломать:** `switchTab` = 1 call/click, `renderAll` = 1 call, EditorHistory, Crafting, Sidebar.

### 1. Первоначальное объявление API

Разрешено, если метод ещё не существует:

```js
Editor.someMethod = function (...) {
  // первичное определение владельца API
};
```

или через регистрацию:

```js
Editor.hooks.register('module-id', {
  someMethod() { ... }
});
```

### 2. Расширение существующего API

**Запрещено** перезаписывать уже существующий метод:

```js
// ЗАПРЕЩЕНО — late monkey-patch
Editor.someMethod = function (...) {
  ...
};
```

Обязательно использовать единую точку расширения:

```js
Editor.hooks.before('someMethod', function (args) {
  // опционально вернуть новый массив args
  return args;
});

Editor.hooks.after('someMethod', function (result, args) {
  // UI-расширение после original
  return result;
});

Editor.hooks.replace('someMethod', function (...) {
  // полная замена implementation; before/after сохраняются
}, 'module-id');
```

### 3. Запрещённый паттерн (рекурсия)

```js
// ЗАПРЕЩЕНО, если someMethod уже под hooks
const original = Editor.someMethod.bind(Editor);
Editor.someMethod = function (...args) {
  original(...args); // original может быть сам hooks wrapper
};
```

Цепочка `wrapper → hook → wrapper → …` приводит к `too much recursion`.

### 4. Единая схема

```text
Editor API call
    → Editor.hooks wrapper
    → original implementation (_impl)
    → after extensions
```

`_impl[method]` **никогда** не должен указывать на сам hooks wrapper.

### 5. EditorHistory

History **не** строит отдельную wrapper-chain поверх hooks для navigation (`switchTab`, `selectScene`, …).

Для navigation: `hooks.before` / `hooks.after` (flush debounce, кнопки Undo).

Мутации данных (create/delete/update) могут оборачиваться idempotent history-wrapper с флагом `__historyWrapped`, но не поверх уже history-wrapped функции повторно.

### 6. Новые Editor-модули

1. Проверить, существует ли API.
2. Если да — только `hooks.before` / `after` / `replace`.
3. Не делать late monkey-patching.
4. Не создавать второй wrapper chain.
5. Fallback `Editor.foo = …` допустим **только** если `Editor.hooks` отсутствует (legacy load).

### 7. Regression перед merge любого Editor-рефакторинга

```text
switchTab  → 1 call / click
renderAll  → 1 call
0 recursion
0 console errors (ReferenceError / InternalError / SyntaxError)
Quest tests → 138 passed / 0 failed
```

См. также: `docs/DEVELOPER-GUIDE.md`, `js/editor/editor-hooks.js`.
