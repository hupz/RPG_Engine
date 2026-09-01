# Combat

No new combat engine. Author `start_combat`:

```json
{
  "action": "start_combat",
  "params": {
    "enemies": ["wolf", "wolf"],
    "nextScene": "after_fight"
  }
}
```

1. Define enemies in **Enemies** tab.
2. Insert **Start Fight** macro or Start Combat action.
3. Multi-select enemies; pick **victory** `nextScene`.
4. Optional rewards on the victory scene `enter` (Encounter preset).

**Defeat** is not a `start_combat` parameter (runtime uses combat clear / `game_over`).
