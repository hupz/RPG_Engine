# Phase 1.12 — Safe Preview / Editor Test Isolation — Manual Smoke

## Storage keys

| Mode | Data | Save | Session |
|------|------|------|---------|
| Production Mill | `melnitsa_game_data` | `melnitsa_save` | — |
| Editor Test | `rpg_editor_test_data` | `rpg_editor_test_save` | `rpg_editor_test_session` |

Legacy read-only: `melnitsa_editor_test_*`

---

## Checklist

1. [ ] Запустить обычный Mill (`index.html` → Мельница)
2. [ ] Запомнить / проверить production data (DevTools → `melnitsa_game_data`)
3. [ ] Открыть Editor
4. [ ] Изменить текст/локацию сцены
5. [ ] **Test From Here** / ▶ Проверить сцену
6. [ ] Увидеть баннер **EDITOR TEST MODE** и изменённую сцену
7. [ ] DevTools: есть `rpg_editor_test_data`, `melnitsa_game_data` **не изменился**
8. [ ] **Exit Test** → вернуться в редактор / закрыть вкладку
9. [ ] Снова открыть обычный Mill
10. [ ] Убедиться: production project **не изменился**
11. [ ] (опционально) В тесте: Save → **Restart** → test save сброшен, data на месте
12. [ ] (опционально) **Reset Test** в редакторе очищает только test keys

---

## Pass criteria

- Preview никогда не пишет в `melnitsa_game_data` / `melnitsa_save`
- Normal runtime игнорирует `rpg_editor_test_*`
- Exit / Reset не трогают production
