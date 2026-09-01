# Create your first RPG

## Recommended starter

Use **Text RPG** template (hub → forest → well → cellar) or **Village Demo**.

## Minimal loop (from Blank)

1. **Create project** → Blank RPG.
2. Edit `start` scene text; add a **choice** to a new scene (Create scene / template pack).
3. In the second scene: add actions via **Готовое действие** / action list:
   - **Give Item** / **Give Gold**
   - **Start Quest** / **Advance Quest**
4. Add a `showIf` on a choice (hasItem / flag).
5. **Preview** from the start scene.
6. **Validate** project (0 errors).
7. **Export** JSON.

## Isolation

Starters use their own `meta.campaignId` / `templateId`. They are not the Mill campaign.
