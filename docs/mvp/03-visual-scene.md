# Visual Scene

## Modes

| Mode | Meaning |
|------|---------|
| TEXT | Choices / dialogue only |
| Visual | Background + nodes (hotspots, images, buttons) |
| Mixed | Text + visual overlay |

## Author steps

1. Open a scene → **Visual** layer.
2. Set background asset.
3. **+ Hotspot** → set label → **При нажатии** (click actions).
4. Typical actions: `change_scene`, `say`, `add_item`, `add_gold`, `update_quest`, `start_combat`, `open_panel`.
5. Optional **showIf** on the hotspot (flag / item / quest).
6. Drag / resize on the viewport. Preview to verify clicks.

Deep guide: `docs/visual-scene-authoring.md`.
