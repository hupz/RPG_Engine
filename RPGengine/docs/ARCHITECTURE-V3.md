# RPG Engine — архитектура v3 (Сцена → Компонент → Действие)

## 1. Диаграмма слоёв

```
┌─────────────────────────────────────────────────────────────┐
│  JSON / game_data.scenes[id]          СЛОЙ 1: СЦЕНА         │
│  • text, location, audio                                    │
│  • components[] — только декларация                       │
│  • onEnter / onExit / handlers — цепочки действий         │
└───────────────────────────┬─────────────────────────────────┘
                            │ renderSceneComponents()
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  service_menu | trade_interface | dialogue_tree | …         │
│  СЛОЙ 2: КОМПОНЕНТ (UI)                                     │
│  • mount DOM, кнопки, списки                                │
│  • condition → ConditionSystem.resolveRef()                 │
│  • клик → ActionRunner.runV2() или executeChain()           │
└───────────────────────────┬─────────────────────────────────┘
                            │ runAction / runChain
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  ACTION_REGISTRY + ActionRunner.runV2                       │
│  СЛОЙ 3: ДЕЙСТВИЕ                                           │
│  validate → spend(cost) → execute → effects → log           │
└─────────────────────────────────────────────────────────────┘
```

**Поток данных:** Сцена не вызывает `handleBlacksmith()` — только `components[]`. Компонент не знает про «кузницу», только про `services[]`. Действие `repair_item` не знает про DOM.

## 2. Файлы

| Файл | Роль |
|------|------|
| `js/actions/action-context.js` | Контекст `ActionContext.build(engine)` |
| `js/actions/action-effects.js` | `ActionEffects.applyAll(effects)` |
| `js/actions/action-runner.js` | `runV2`, `rollback`, цепочки (как раньше) |
| `js/actions/action-registry-v3.js` | `trade_buy`, `repair_item`, `enhance_item`, `remove_curse`, `gamble_dice`, `craft_item` |
| `js/conditions.js` | `CONDITION_REGISTRY`, `resolveRef()` |
| `js/components/component-base.js` | Хелперы, `runAction` |
| `js/components/component-panels.js` | Панели UI → `PanelActions.run(actionId)` |
| `js/components/component-normalize.js` | legacy `repair` → `service_menu` + `type: "panel"` |
| `js/components/service-menu.js` | Меню: `action` / `chain` / `panel` |
| `js/components/trade-interface.js` | Торговля (v3) |
| `js/components/dialogue-tree.js` | Диалог |
| `js/components/interactive-panel.js` | Кнопка → цепочка |

Legacy-файлы `component-repair.js` и др. **удалены**. Старые типы в JSON нормализуются в `service_menu` с `type: "panel"`.

## 3. Обратная совместимость

- Поле компонента: **`component`** (как раньше); **`type`** — синоним.
- `SceneComponentNormalize.normalizeList()` вызывается в `renderSceneComponents`.
- Старые сохранения не затрагиваются (только `state`, не схема сцен).
- `GameEngine.executeChain`, `showScene`, `finalizeCharacter` — без изменений.
- Новый API: `GameEngine.runAction(actionId, params, ctx)` → `ActionRunner.runV2`.

## 4. Пример: blacksmith (было → стало)

### Было (3 отдельных компонента)

```json
"components": [
  { "component": "dialogue", "params": { "npc": "blacksmith_npc", ... } },
  { "component": "repair", "params": { "flatCost": 15 } },
  { "component": "upgrade", "params": { "costTable": [100, 300, 900] } }
]
```

### Стало (v3)

```json
"components": [
  { "component": "dialogue", "params": { "npc": "blacksmith_npc", "greeting": "...", "topics": [...] } },
  {
    "component": "service_menu",
    "params": {
      "header": "⚒️ Услуги кузнеца",
      "services": [
        { "id": "repair", "type": "panel", "panel": "repair_panel", "panelParams": { "npc": "blacksmith_npc", "flatCost": 15 } },
        { "id": "upgrade", "type": "panel", "panel": "upgrade_panel", "panelParams": { "maxEnhancement": 3, "costTable": [100, 300, 900] } }
      ]
    }
  }
]
```

Панели вызывают действия при клике (`repair_item`, `enhance_item`, `remove_curse`, `gamble_dice`, `craft_item`).

## 5. Пример: temple (было → стало)

### Было

`heal` + `curse_remove` + `interactive` (цепочка).

### Стало

```json
{
  "component": "service_menu",
  "params": {
    "header": "⛪ Услуги храма",
    "services": [
      {
        "id": "heal_full",
        "type": "action",
        "label": "Принять лечение",
        "icon": "🩹",
        "cost": { "gold": 25 },
        "action": "heal",
        "actionParams": { "target": "self", "amount": "full", "restoreResources": true }
      },
      {
        "id": "heal_chain",
        "type": "chain",
        "label": "Полное лечение (50 зм, 2d8+4)",
        "chain": "heal_at_temple"
      },
      {
        "id": "curse",
        "type": "panel",
        "panel": "curse_remove_panel",
        "panelParams": { "npc": "priest", "costBase": 50 },
        "condition": "has_cursed_equipped"
      }
    ]
  }
}
```

## 6. Универсальный компонент `service_menu`

| type | Назначение |
|------|------------|
| `action` | `ActionRunner.runV2(action, params)` |
| `chain` | `executeChain(chainId)` |
| `panel` | UI-панель (`repair_panel`, `upgrade_panel`, `gamble_panel`, …) → `runAction` |

## 7. Редактор

В `editor-scene-components.js`: форма `service_menu` с JSON-редактором `services[]` (action / chain / panel).

## 8. Чеклист регрессии

- [ ] Кузница: диалог, ремонт, заточка
- [ ] Храм: лечение 25 зм, цепочка 50 зм, снятие проклятия
- [ ] Лавка Джека: торговля, квест сумки, возврат сумки
- [ ] Мобильная вёрстка: `#scene-components-area`, кнопки `.choice`
- [ ] Аудио сцен и SFX не затронуты
- [ ] Загрузка старого сохранения — ок
- [ ] `executeChain` / квесты / репутация
- [ ] Редактор: превью компонентов сцены

## 9. API действия (расширение)

```javascript
ACTION_REGISTRY.my_action = {
  id: 'my_action',
  validate(ctx, params) { return { ok: true }; },
  execute(engine, params, ctx) {
    return {
      effects: [{ type: 'ui_update', panels: ['inventory'] }],
      log: 'Готово'
    };
  }
};
```

Вызов из компонента: `GameEngine.runAction('my_action', { cost: { gold: 10 } })`.
