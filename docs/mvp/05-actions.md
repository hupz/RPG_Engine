# Actions

Runtime source of truth: `ACTION_REGISTRY`.

Editor catalog presents writer-safe actions + **macros** that expand to registry steps only (macro ids are never stored in project JSON).

## Common actions

| Action | Purpose |
|--------|---------|
| `change_scene` | Go to scene |
| `say` | Show line |
| `add_item` / `remove_item` | Inventory |
| `add_gold` / `remove_gold` | Economy |
| `update_quest` | Quest stage |
| `set_flag` | World flag |
| `start_combat` | Begin fight |
| `open_panel` | Journal / inventory / … |
| `heal` | Restore HP |

## Macros (expand on insert)

Give/Take Item, Give/Take Gold, Loot Chest, Start Fight, Start/Advance/Complete Quest.

Multi-action lists keep **order** (↑ ↓ / delete).
