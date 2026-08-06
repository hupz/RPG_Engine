# Архитектура RPGengine (стабильность)

## 1. Editor.hooks

Подключение: `js/editor/editor-hooks.js` (сразу после `const Editor` / data-schema).

```js
// Предпочтительно:
Editor.hooks.after('renderSceneEditor', function () {
  // UI-надстройки
});

Editor.hooks.before('createScene', function (args) {
  return args; // или новый массив аргументов
});
```

**Не делайте** `Editor.renderX = function(){...}` без крайней нужды — последний скрипт перетирает предыдущий.

Отладка: `Editor.hooks.listWrapped()`.

## 2. dataVersion

`js/data-schema.js` → `ProjectDataSchema`

- Текущая версия: **3**
- При загрузке: `ProjectDataSchema.migrateProjectData(data)`
- Редактор: `Editor.setProjectData(data)` / `Editor.migrateProjectData(data)`
- Игра: хук в `save-load.js` + footer в `data.js`

Миграции v&lt;3:
- квесты через `QuestMigrate`
- `ability.effect` string → object
- `scene.audio` string → object
- `meta.storyGraph.positions`

## 3. Вынос из editor.html

Сделано:
- `js/editor/editor-utils.js` — escape helpers (дублируют html, не ломают)
- `js/editor/editor-data-load.js` — setProjectData / migrate
- фичи — в `js/editor/*.js`

Дальше выносить: `renderClasses`, ability cards, `validateAll` body.

## 4. Сборка бандлов

```bash
npm install
npm run build        # dist/engine.bundle.js + dist/editor-core.bundle.js
```

По умолчанию **dev** по-прежнему на отдельных `<script>` (проще отладка).  
Прод: можно подменить хвост `index.html` на один `dist/engine.bundle.js`.

## Порядок скриптов редактора (критично)

1. inline `const Editor = { ... }`
2. `data-schema.js`
3. `editor-hooks.js` → `editor-utils.js` → `editor-data-load.js`
4. остальные модули (квесты, сцены, graph, …)
5. late UX: scene-builder, no-code, wizards, search, …

## Целевой runtime

```
Author UI → (normalize) → Content JSON (dataVersion) → EventBus + Systems
```


## Обновления (стабильность, продолжение)

- `editor-scene-builder` / `editor-story-graph-edit` → `Editor.hooks.replace`
- `editor-wizards` → `Editor.hooks.after('renderSceneEditor')`
- Классы/умения: `js/editor/editor-classes.js` (вынесено из editor.html)
- Prod: `index.prod.html` → `dist/engine.bundle.js`
- `applyEffect`: строки нормализуются на входе; отдельная legacy-ветка удалена

## Вынос и hooks (продолжение)

### Модули из editor.html
- `editor-classes.js` — классы/умения
- `editor-core-tabs.js` — switchTab, renderAll, scene list, JSON preview
- `editor-items-panel.js` — предметы
- `editor-audio-panel.js` — аудио
- `editor-progression-panel.js` — прогрессия
- `editor-enemies-panel.js` — loot врагов

`renderSceneEditor` в HTML заменён **заглушкой** (~60KB убрано); UI — `editor-scene-builder.js`.

### Hooks вместо подмен
- preview, analytics, beasts, choices, tutorial, campaign-wizard (NPC), class-skills (detail)
- `hooks.after` может **вернуть** новое значение (трансформация HTML)

### Осталось
- `editor-abilities.js` / `action-builder` — точечные обёртки HTML (можно на after)
- climate / worldmap — **определения** методов, не обёртки (OK)
- дальнейший вынос: `validateAll`, `renderGlobalAbilityEditor`

## Recovery (editor-scene-crud.js)

После агрессивного выноса  из HTML часть методов была усечена.
Восстановлено в :
- updateChoice / addChoice / removeChoice / moveChoice
- updateSceneField, getSceneIds
- validateAll → validateProjectExtended
- renderGlobalAbilityEditor (+ update helpers)
- renderStats / renderBalance stubs

abilities + action-builder: HTML-обёртки через hooks.after.

## Recovery

`editor-scene-crud.js` restores choice/scene CRUD and global ability editor after HTML trim. abilities/action-builder use hooks.after.
