# UI-5 — Аудит CSS редактора (временный отчёт)

Дата: 2026-08-29  
Режим: READ ONLY перед внедрением design system.

---

## 1. Карта источников стилей

| Слой | Файл | Роль | Проблемы |
|------|------|------|----------|
| Глобальная тема | `css/theme.css` | CSS-переменные `--paper`, `--ink`, `--border`… | Дублируется в `editor-pro-ui.css` |
| Тёмный UI | `css/dark-ui.css` | Игровой UI (не редактор) | Не трогать |
| Редактор legacy | `css/editor.css` | Карточки, формы, export menu | `border: 2px`, `border-radius: 10px` |
| Inline | `editor.html` `<style>` (~800 строк) | Layout shell, nav, forms, choices | Конфликтует с `editor-pro-ui.css` |
| Pro UI | `css/editor-pro-ui.css` | Токены `--ep-*`, кнопки, nav, workspace | Частично перекрывает inline |
| Модули | `nl-condition-builder.css`, `editor-tutorial.css` | Изолированные виджеты | OK |
| JS-injected | 15+ модулей (`ensureStyles`) | Workspace, scene header, context-ui, phase-* | Разрозненные значения, hardcoded `#ccc` |

**Порядок загрузки в `editor.html`:**
`theme.css` → `dark-ui.css` → `i18n.css` → `editor.css` → `editor-tutorial.css` → `nl-condition-builder.css` → **inline `<style>`** → `editor-pro-ui.css` → *(UI-5: `editor-design-system.css`)*

Inline идёт **до** pro-ui, но pro-ui не покрывает все inline-правила → двойные определения кнопок, nav, form-group.

---

## 2. Дублированные переменные

| Переменная | theme.css | editor-pro-ui.css | Inline fallback |
|------------|-----------|-------------------|-----------------|
| `--page-bg`, `--paper`, `--card-bg` | ✓ | ✓ (переопределение по theme-mode) | `var(--paper)` |
| `--border` | ✓ | ✓ | `2px solid` везде |
| `--ep-radius-sm` / `8px` / `6px` | — | 5/8/10px | 6px, 8px, 10px |
| `--btn-primary-bg` | — | ✓ | `.btn-primary` = `--success` (!) |

**Критично:** inline `.btn-primary` использует `--success` (зелёный), pro-ui — `--btn-primary-bg` (синий). Визуальная несогласованность primary action.

---

## 3. Hardcoded цвета (выборка)

- `#1565c0`, `#1976d2`, `#ef6c00` — workspace tabs (JS)
- `#e3f2fd`, `#6a1b9a` — scene document header (JS)
- `#ffebee`, `#f1c40f` — validation (inline)
- `rgba(0,0,0,.04)` — hover без токена

---

## 4. Hardcoded отступы

| Значение | Где встречается |
|----------|-----------------|
| 4px | scene-list gap, workspace tabs |
| 8–10px | nav items, form padding |
| 12–16px | sidebar, section padding |
| 20–24px | tab-content padding, empty-state |
| 60px | empty-state vertical padding (избыточно) |

Единой шкалы нет; близкие значения 10/12/14/16 используются как взаимозаменяемые.

---

## 5. Паттерны border (шум)

| Паттерн | Примеры | Оценка |
|---------|---------|--------|
| `2px solid var(--border)` | nav, sidebar, choices-section, form inputs, quest-editor | Избыточно |
| `1px solid` | pro-ui override | Предпочтительно |
| `border + box-shadow + background` | scene-item, template-card, tab-content.active | Card-in-card |
| `border-bottom: 2px` | tabs, context-sidebar h3 | Тяжёлый разделитель |

**Типичная вложенность (плохо):**
```
.main-area > .tab-content.active  [border + shadow + padding]
  .choices-section                 [border 2px + card-bg]
    .choice-row                    [background paper + radius]
      input                        [border]
```

---

## 6. Варианты кнопок

| Класс | Inline | Pro UI | Конкуренция |
|-------|--------|--------|-------------|
| `.btn-primary` | green success | blue info | **Да** |
| `.btn-secondary` | 2px border, paper-dark | 1px ghost-like | Средняя |
| `.btn-danger` | solid red | tinted outline | OK |
| `.btn-info` | solid blue | tinted | Дублирует primary |
| ghost/icon | нет класса | частично theme-toggle | Нет системы |

Каждая панель добавляет свои `.btn-sm` без единого toolbar-стиля.

---

## 7. Варианты панелей

| Компонент | Визуальный вес | Должен быть |
|-----------|----------------|-------------|
| `#tab-scenes` (document) | card в card | **доминанта** — без рамки |
| `#context-sidebar` | 1px + card-bg | тихий L2 |
| `#editor-inspector` | injected, border | тихий L2 |
| `.ws-scene-document-header` | bordered card | toolbar strip, не карточка |
| Dashboard cards | grid of bordered cards | OK для dashboard |

---

## 8. Inline styles в JS (выборка)

- `editor-workspace.js` — workspace tabs
- `editor-workspace-scene.js` — document header, quick create modal
- `editor-context-ui.js` — sidebar, inspector sections
- `editor-scene-builder.js` — scene builder layout
- phase-112…118 — feature panels

**Стратегия UI-5:** консолидировать chrome в `editor-design-system.css`; JS `ensureStyles` пропускать при `body[data-eds="1"]`.

---

## 9. Writer / Advanced density

Уже есть:
- `body.editor-writer-mode` / `body.editor-advanced-mode` (`editor-writer-mode.js`)
- `body.editor-ctx-writer` (`editor-context-ui.js`)

Нет единых правил плотности для form-group, choices-section, metadata visibility.

---

## 10. Accessibility (текущее)

| Критерий | Статус |
|----------|--------|
| `:focus-visible` на кнопках | ✓ pro-ui |
| Контраст | В целом OK (dark/light) |
| aria-label на icon buttons | Частично (workspace close ✓) |
| Keyboard после switchTab | Не проверено автоматически |

---

## 11. Рекомендации внедрения (UI-5)

1. **`css/editor-design-system.css`** — токены `--eds-*`, унификация L1/L2/L3 поверхностей
2. Снять рамку с `#tab-scenes` — workspace доминирует
3. Свести `border: 2px` → `1px` / divider / none для внутренних секций
4. Единый `.btn-ghost` для toolbar
5. Form labels: weight 500, без UPPERCASE
6. Empty states: компактнее, с CTA
7. `@media (max-width: 1100px)` — sidebar/inspector не перекрывают main
8. Structural tests — link, токены, DOM roots

---

*Временный документ. Не является runtime-зависимостью.*
