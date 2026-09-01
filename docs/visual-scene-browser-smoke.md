# Visual Scene — browser smoke checklist (Phase 1.6)

Автоматизации Playwright/Puppeteer в проекте **нет** (`package.json` только esbuild).  
Ниже — воспроизводимый ручной smoke. Headless API-тесты **не** заменяют эти шаги.

## Подготовка

1. `npm run build`
2. Открыть `editor.html` в браузере
3. Загрузить/открыть проект с несколькими сценами и при возможности `data.assets`

## Checklist

| # | Шаг | Ожидание |
|---|-----|----------|
| 1 | Editor загружается | Sidebar, без SyntaxError в console |
| 2 | Вкладка Сцены → выбрать сцену | Scene editor + блок «Визуальный слой» |
| 3 | Режим «Поверх сцены» | Viewport виден |
| 4 | Фон → Asset Picker | Список/поиск; выбор задаёт background |
| 5 | + Image → asset | Картинка на viewport |
| 6 | Клик по node | Selection outline, hierarchy, inspector |
| 7 | Drag | x/y меняются; **один** Undo на жест |
| 8 | Resize за угол | w/h > 0; один Undo |
| 9 | + Hotspot или draw mode | Новая область |
| 10 | On Click → Открыть сцену → цель | В данных `change_scene` + sceneId |
| 11 | Save / export project JSON | `visual.nodes` на месте |
| 12 | Preview / Play сцены | VisualRuntime mount |
| 13 | Клик hotspot в Preview | Переход на целевую сцену |
| 14 | Undo после drag | Позиция откатилась целиком |
| 15 | Сцена **без** visual | Только TEXT path |
| 16 | Mixed: text + visual | Оба слоя |

## Production

- `index.prod.html` / export: есть `js/game-ui/visual-runtime.js`, **нет** editor-*.
- Quest / Mill кампания без изменений visual.

## Автотесты (дополнение, не замена)

```bash
node tests/visual-scene.test.js
node tests/editor-visual-scene.test.js
node tests/editor-visual-viewport.test.js
node tests/visual-action-ux.test.js   # Phase 1.6
```

---

## DEMO VILLAGE E2E CHECK

1. Open Editor.
2. Visual layer → **Загрузить демо «Деревня»** (or import `data/demos/visual_village.json`).
3. Scene Village selected; background/hotspots in viewport.
4. **Test From Here** / Preview opens game with editor test session.
5. Click Tavern area → Tavern TEXT scene.
6. Choice «Выйти на площадь» → Village visual again.
7. Click Shop → jack_shop; return.
8. Click Smithy → smithy; return.
9. Click Chapel → chapel; return.
10. Click Journal icon → journal UI focus / quest log.
11. Click Inventory icon → inventory panel (if dock available).
12. Confirm a pure TEXT scene without `visual` still works in another project/tab.
13. Console: no recursion / no Editor required in production path.

Mill campaign files must remain unchanged.


## Assets (Phase 1.8)

Confirm in Editor Asset Picker after loading Demo Village:

- village.svg (background)
- diary.svg
- bag.svg

Missing file must not freeze Editor or throw in console during mount.

## Phase 1.10.4 Conditions (manual)
1. Hotspot → + Условие → hasItem → village_key
2. Multi-action say + gold
3. Preview without key → click no-op
4. Give key → click runs
5. Game UI button: same showIf
6. Undo condition
7. Режим условий: переключить «Все» ↔ «Хотя бы одно» → JSON `{ all }` / `{ any }` сохраняется

## Phase 1.10.4B — Chest multi-action (READY FOR MANUAL SIGN-OFF)

Полный сценарий Visual hotspot (используйте реальные ACTION_REGISTRY ids):

1. Demo Village или сцена с визуальным слоем.
2. Добавить / выбрать hotspot «сундук».
3. **Когда доступно** (опционально): hasItem = ключ **или** без условия.
4. **При нажатии** — multi-action по порядку:
   - `say` — текст вроде «Вы открыли сундук.»
   - `add_item` — предмет (например `potion` / существующий item id)
   - `add_gold` — amount (например `25`)
5. Save → **Test From Here** / Preview.
6. Клик по сундуку → текст `say` → проверить inventory → проверить gold.
7. Console: нет ошибок; production path не требует Editor.

Статус: **READY FOR MANUAL SIGN-OFF** (автоматический browser PASS не заявлять без реального прогона).

---

## Phase 1.11 — Village Quest vertical slice

См. короткий checklist: [`docs/village-vertical-slice-smoke.md`](village-vertical-slice-smoke.md)

Поток: Tavern NPC → quest → chest multi-action → conditions → enemy combat → return → save.
