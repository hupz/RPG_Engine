# Quest

1. Open **Quests** tab → create quest (wizard or blank).
2. Add stages (titles). Last stage may be marked finish.
3. Drive progress with actions:
   - **Start Quest** → `update_quest` stage `0`
   - **Advance Quest** → numeric stage
   - **Complete Quest** → stage `complete`
4. Gate content with quest conditions on choices / hotspots.
5. Overview shows usages (where the quest is referenced).

Runtime SoT remains `QuestRuntime` / `questProgress` — Editor does not execute it.
