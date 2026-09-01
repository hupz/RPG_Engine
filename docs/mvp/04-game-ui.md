# Game UI

Author persistent or scene-scoped HUD screens (buttons, bars, gold, portrait).

1. Open **Game UI** editor tab.
2. Add a screen (persistent or bound to a scene).
3. Add nodes (button / text / image / gold / …).
4. On click: same action catalog as visual hotspots (`change_scene`, `open_panel`, …).
5. Conditions (`showIf`) hide/show UI nodes.

Runtime reads `data.ui.screens` — Editor is not a runtime dependency.

Deep guide: `docs/game-ui-authoring.md`.
