# UI-6 — Аудит навигации (временный отчёт)

Дата: 2026-08-29

## Классификация точек входа (до UI-6)

| Элемент | Класс | Проблема |
|---------|-------|----------|
| Левый nav (14 секций плоским списком) | PRIMARY | Архитектурные названия, не задачи |
| Legacy tabs bar (скрыт визуально) | LEGACY | Дублирует nav |
| Section sub-nav (editor-section-bar) | SECONDARY | OK для подвкладок |
| Context sidebar (сцены / browser) | CONTEXTUAL | OK (UI-4) |
| Header: Save/Export | PRIMARY global | Канонично |
| Header: Validate | PRIMARY global | Дублирует scene header |
| Scene header: Test/Validate | CONTEXTUAL | Дублирует global |
| Command palette (Ctrl+K) | SECONDARY | Уже есть — расширен |
| Mode toggle (footer nav) | PRIMARY | OK |
| Dashboard | ENTRY | OK |

## Целевая модель (UI-6)

```
СОЗДАНИЕ     → Сцены, Сюжет, Игровой UI
КОНТЕНТ      → Предметы, Квесты, Персонажи, Враги, Мир
ИНСТРУМЕНТЫ  → Проверить, Превью, Экспорт (действия)
РАСШИРЕННЫЕ  → Классы, Крафт, Настройки… (Advanced)
```

## Command palette

Инфраструктура `Editor.commands` + `editor-command-palette.js` **существует**.
Добавлены команды навигации и инструментов — новая палитра не создавалась.

## Mode persistence

`localStorage.rpg_editor_mode` = `writer` | `advanced` — без изменений схемы.
При переключении режима workspace/open/activeId/currentScene сохраняются.

## Доступность функций (regression)

| Функция | Точка входа после UI-6 |
|---------|------------------------|
| Сцены | CREATE → Сцены |
| Visual Scene | Контекстная nav «Visual» + mixed modes |
| Game UI | CREATE → Игровой UI |
| Story graph | CREATE → Сюжет |
| Validation | TOOLS / контекст сцены / header (Advanced) |
| Preview/Test | TOOLS / контекст сцены / command palette |
| Export | TOOLS / header (канон) |
| Templates | Sub-nav сцен |
| Quests/Items/NPC | CONTENT |
| Classes/JSON | РАСШИРЕННЫЕ |
