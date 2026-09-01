# Unified Scene Workspace (UI-7)

## Что изменилось

Сцена открывается как **единый документ** с левым outline и центральной областью секций. Это orchestration-слой поверх существующих редакторов — без изменений project JSON и runtime.

## Как открыть сцену

```javascript
Editor.openSceneWorkspace('sceneId');
```

Также работает `Editor.openSceneDocument('sceneId')` — автоматически активирует unified workspace.

## Scene Outline (левая панель)

| Секция | Содержимое |
|--------|------------|
| **Обзор** | Карточка сцены, тип, статистика, быстрые переходы |
| **Контент** | Текст, локация, story-модуль |
| **Выборы (N)** | Модуль choices |
| **Visual (N)** | `renderVisualScenePanel()` |
| **Game UI** | Ссылки на экраны + переход в редактор UI |
| **Условия** | Сводка showIf/hideIf |
| **Advanced** | ID, тип, модули (только Advanced Mode) |

Счётчики в outline динамические. Пустые секции показывают CTA «+ Добавить».

## Секции и адаптеры

| Секция | Переиспользуемый API |
|--------|----------------------|
| Content | `renderSceneEditor` → scene-builder modules |
| Choices | `.scene-module-card[data-module="choices"]` |
| Visual | `Editor.renderVisualScenePanel()` |
| Game UI | `Editor.switchTab('game_ui')`, `uiSelectScreen` |

## Session state

```javascript
Editor.workspace.sceneWs = {
  enabled: true,
  section: 'overview' | 'content' | 'choices' | ...
};
```

Не сериализуется в project JSON.

## History

Переключение секций **не** вызывает `markDirty` и не пишет в `EditorHistory`.

## Совместимость

- `openSceneDocument`, workspace tabs, inspector, contextual nav — сохранены
- Без USW (`sceneWs.enabled = false`) — legacy monolithic scene editor в `#scene-editor`
- `getSceneEditorMount()` в scene-builder учитывает `#usw-canvas-mount`

## Файлы

- `js/editor/editor-scene-workspace.js` — основной модуль
- `css/editor-design-system.css` — стили `.usw-*`
- `tests/ui-unified-scene-workspace.test.js`
