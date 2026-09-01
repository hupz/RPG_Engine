# MVP Proof — E2E Authoring Flow (Phase 1.17)

Isolated proof project: **`campaignId: mvp_proof`** — does **not** modify Mill.

**Data:** `data/demos/mvp_proof.json`  
**Play:** Campaign picker → **Oakhaven MVP Proof**  
**Editor:** Scene toolbar → **MVP Proof** or import JSON

---

## STEP 1 — Create project

1. Open `editor.html`
2. Click **MVP Proof** in scene preview toolbar (or import `data/demos/mvp_proof.json`)
3. Verify `meta.campaignId` = `mvp_proof`

---

## STEP 2 — Create Village

- Scene **`village`** — Hybrid: TEXT + **Visual Scene** (`visual.mode: overlay`)
- Background asset: `village_bg` → `assets/images/village.svg`
- Hotspots: Elder hut, Forest path (gated by `herb_quest_started`)

**Authoring path:** Scene tab → Visual layer → hotspots + `change_scene` actions

---

## STEP 3 — Create NPC

- Entity **`elder_mira`** in `data.npcs`
- Fields: `name`, `icon`, `description`, `dialogueSceneId: elder_hut`

**Authoring path:** NPC tab → create NPC → link dialogue scene

---

## STEP 4 — Create dialogue

- Scene **`elder_hut`** with component **`dialogue_tree`**
- Topics: greeting, accept quest (`update_quest` + `set_flag`), deliver herb (`remove_item` + reward), post-complete line
- Conditions: `showIf` on quest stage / flags / `hasItem`

**Authoring path:** NPC & Dialogue authoring (Phase 1.13) → topics with actions

---

## STEP 5 — Create quest

- Quest **`herb_for_elder`** — stages: accept → forest → wolf → herb → return → done
- Giver: `elder_mira`, rewards: gold + exp

**Authoring path:** Quest tab → Quest Authoring 2.0 wizard / stage editor

---

## STEP 6 — Create forest

- Scene **`forest`** — Visual Scene with enter event `update_quest` stage 1
- Hotspots: wolf, herb chest, exit to village

**Authoring path:** Scene wizard → Visual preset → forest background asset

---

## STEP 7 — Create encounter

- Enemy **`forest_wolf`** in `data.enemies`
- Visual hotspot `hs_wolf` → `start_combat` → `forest_victory`

**Authoring path:** Gameplay Component Library → Encounter preset, or manual hotspot actions

---

## STEP 8 — Create chest / loot

- Hotspot **`hs_herb_chest`** — multi-action chain:
  - `say` → `add_item` → `update_quest` → `set_flag`
- Gated by `wolf_defeated` + `notFlag herb_collected`

**Authoring path:** Gameplay Components → Chest/Loot preset (Phase 1.15)

---

## STEP 9 — Connect scenes

| From | To | Mechanism |
|------|-----|-----------|
| `start` | `village` | choice |
| `village` | `elder_hut` | visual hotspot / choice |
| `village` | `forest` | choice + hotspot (quest flag) |
| `forest` | `forest_victory` | combat win |
| `forest_victory` | `forest` | choice |
| `forest` | `village` | hotspot / choice |
| `elder_hut` | `village` | choice |

**Authoring path:** Scene Inspector connections, EntityPicker on `choices[].to`, visual `change_scene`

---

## STEP 10 — Run preview

1. **Test From Here** on `start` or `village` (isolated test keys — Phase 1.16)
2. Or launch **Oakhaven MVP Proof** from game picker
3. Verify full loop: talk → quest → forest → fight → loot → return → reward → save

---

## Manual MVP Smoke Checklist

- [ ] 1. Start game (`start` scene intro)
- [ ] 2. HUD visible (HP, gold, Inv, Journal, Save)
- [ ] 3. Village visible (visual overlay + hotspots)
- [ ] 4. Talk to NPC (elder_hut dialogue_tree)
- [ ] 5. Accept quest («Я помогу» → quest stage 0)
- [ ] 6. Quest appears in journal
- [ ] 7. Go forest (path unlocks after accept)
- [ ] 8. Combat (click wolf → `start_combat`)
- [ ] 9. Win (→ `forest_victory`)
- [ ] 10. Find chest/herb (click herb hotspot)
- [ ] 11. Receive item (`forest_herb` in inventory)
- [ ] 12. Return to village
- [ ] 13. Dialogue changes («Как поживает деревня?» after complete)
- [ ] 14. Quest completes (deliver herb topic)
- [ ] 15. Reward (+50 gold, quest rewards)
- [ ] 16. Save (HUD Save button)
- [ ] 17. Reload page / campaign
- [ ] 18. State preserved (quest done, gold, inventory)

---

## MVP Success Criteria

Author can create **location, NPC, dialogue, quest, combat, loot, scene transitions, HUD** without custom JavaScript — **PASS** when all checklist items work using editor-supported data paths only.
