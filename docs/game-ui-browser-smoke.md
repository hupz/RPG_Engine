# Game UI — Browser Smoke (Phase 1.9.1)

1. Open `editor.html`.
2. Sidebar → **Игровой UI**.
3. Apply preset **rpg_hud** (or basic_hud).
4. Select a node in hierarchy / viewport.
5. Drag node; release once.
6. Resize via corner handle; release once.
7. Undo once → one step back.
8. Change text / binding / On Click → Inventory.
9. Save project.
10. Load Demo Village (Visual layer) if needed.
11. Test From Here on Village.
12. Confirm HUD (HP/Gold/buttons) over scene.
13. Click Tavern hotspot → TEXT scene; HUD remains.
14. Click Journal / Inventory → panels open.
15. Return Village; HUD still present.
16. TEXT scene without visual still works.
17. Console: 0 recursion, 0 Editor dependency in runtime.


## Phase 1.9.2 additions

### AUTOMATED / HEADLESS
- tests/editor-game-ui.test.js (snap, history 1 mutation, shared picker)
- tests/game-ui-runtime.test.js

### MANUAL BROWSER SIGN-OFF
8. Select image node → **Выбрать asset…**
9. Search in picker → select diary.svg / bag.svg
10. Enable Snap → drag → positions quantize
11. Undo once after drag
12. Confirm asset remains after undo of later transform (order-dependent)

Do **not** mark browser PASS unless steps were run in a real browser.

## Phase 1.10.4B — Game UI multi-action (READY FOR MANUAL SIGN-OFF)

1. Editor → **Игровой UI** → выбрать button node (или добавить).
2. **Когда доступно** — при необходимости условие + режим Все / Хотя бы одно.
3. **При нажатии** — multi-action:
   - `say` — короткий текст
   - `open_panel` — panel = `inventory` (или `journal`)
4. Save → Test From Here на сцене с HUD.
5. Клик кнопки → say → панель inventory/journal открывается.
6. Console: 0 Editor dependency в runtime.

Статус: **READY FOR MANUAL SIGN-OFF**.
