# Conditions

Prefer structured form:

```json
{ "all": [ { "hasItem": "rusty_key" } ] }
```

or `{ "any": [ ... ] }`.

## Common rules

| Rule | Meaning |
|------|---------|
| `flag` / `notFlag` | World flags |
| `hasItem` / `notHasItem` | Inventory |
| `goldMin` / `goldMax` | Gold |
| `questMinStage` / `questStage` | Quest progress |

Attach as `showIf` on choices, visual nodes, or Game UI nodes.

Unknown / legacy shapes are validated as warnings by Project Validator.
