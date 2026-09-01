# UI-10 — Visual Audit (Editor Design System)

## Источники стилей

| Файл | Роль | Проблемы |
|------|------|----------|
| `css/editor.css` | Legacy base, inline в `editor.html` | Дубли `.btn`, толстые рамки, scene preview cards |
| `css/editor-pro-ui.css` | Pro layer поверх legacy | Второй набор `.btn-primary/secondary/danger` |
| `css/editor-design-system.css` | UI-5 tokens + density (EDS) | Частичное покрытие, нет единых component classes |
| Inline `<style>` в `editor.html` | Header, tabs, scene-list | Третий источник button/panel стилей |
| Модули (pcm, cb, usw, insp8) | Inline `<style>` fallback | Разные border-radius, padding |

## Визуальный хаос (до UI-10)

### Кнопки
- **3+ определения** `.btn-primary`: `editor.html`, `editor-pro-ui.css`, `editor-design-system.css`
- `btn-info`, `btn-secondary`, `btn-danger` — одинаковый visual weight на header
- Scene header: ghost + more menu OK; context nav — отдельные `ws-ctx-nav-btn`
- Content browser: `cb-action` — четвёртый стиль кнопок

### Карточки
- `.scene-item`, `.pcm-scene-item`, `.cb-scene-card` — три поколения scene cards
- `.template-card`, `.choice-card`, `.scene-module-card` — вложенные рамки
- Dashboard `.content-browser-link` vs sidebar cards

### Inputs
- `.form-control` (EDS) vs raw `<input>` в visual/game-ui inspectors
- Search: `#pcm-scene-search`, `#cb-scene-search`, `#content-browser-search-input` — разные размеры

### Spacing
- 4/6/8/10/12/16px без единой шкалы в legacy
- EDS: 4–32px — не везде применена

### Radius
- 3px, 4px, 6px, 8px, 12px в разных модулях
- EDS: control 4px, panel 6px — целевой стандарт

### Shadows
- `box-shadow` на tabs, menus, cards одновременно
- EDS flattening частично убрал workspace card shadows

### Panels
- `context-sidebar`, `editor-inspector`, `usw-outline` — разный фон и borders
- Каждая секция choices/dialogue с border+background

### Typography
- h2/h3/h4 без scale: 16px, 17px, 14px ad-hoc
- UPPERCASE labels в nav vs sentence case в forms

## Целевая архитектура UI-10

```
--ui-* tokens (alias → --eds-* / legacy vars)
     ↓
.ui-* component classes
     ↓
Bridge: .btn → .ui-button, .form-control → .ui-input
     ↓
Rollout: nav | workspace | inspector | content browser
```

## Не трогаем в UI-10

- Runtime game UI (`index.html`, HUD)
- Полный legacy rewrite всех вкладок (items, quests, …)
- Project JSON / handlers / Editor.hooks
