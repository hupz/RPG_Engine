# Village Quest — Vertical Slice Smoke (Phase 1.11)

**Status: READY FOR MANUAL SIGN-OFF** (do not mark PASS without a real browser run).

Isolated demo: `campaignId: visual_village` — does **not** touch Mill.

## Load

1. Open `editor.html`
2. Visual layer → **Загрузить демо «Деревня»** (or import `data/demos/visual_village.json`)
3. **Test From Here** / Preview on scene `village`

## Checklist (max 17)

1. Village visual + HUD (HP / Gold / Level) visible  
2. HUD **Журнал** → journal panel (`open_panel`)  
3. HUD **Инвентарь** → inventory panel  
4. HUD **Сохранить** → `save_game` (no console error)  
5. Hotspot **Таверна** → TEXT scene  
6. Choice «Спросить, всё ли в порядке» → quest **Пропавшие припасы** starts → back to Village  
7. **Сундук** visible (was hidden before quest)  
8. Click chest → multi-action: say → item → gold → quest stage → flag  
9. Gold on HUD updates (or after remount)  
10. `village_supplies` in inventory  
11. Chest **gone** after loot  
12. **Вор** hotspot appears  
13. Click thief → combat (`start_combat`)  
14. Victory → `bandit_cleared` → return Village (quest stage 2)  
15. Tavern → «Отдать найденные припасы» → quest complete  
16. Save → reload / reopen Test From Here → flags/quest progress still sensible  
17. Console: no `Editor` required on runtime path  

## Author check (Editor)

- Visual Scene: background, tavern, chest, enemy hotspots editable without JS  
- Game UI: `rpg_hud` nodes (position / text / actions) editable without JS  
