# FINAL MVP REPORT — RPG Engine Phase 1.19

**Date:** 2026-08-26  
**Scope:** VERIFY / FIX / DOCUMENT / HARDEN (no ECS / WebGL / Canvas rewrite)

---

## 1. Architecture status

| Layer | Status |
|-------|--------|
| Author data → Editor → JSON → Runtime | Intact |
| `ACTION_REGISTRY` runtime SoT | Intact |
| Editor catalogs / macros (expand only) | Intact |
| `QuestRuntime` / inventory / combat engines | Reused, not replaced |
| Preview isolation (`?editorTest=1`) | Intact |
| Project Validator (headless) | Intact |
| No new runtime graph / combat / inventory | Confirmed |

Editor must not be a runtime dependency for play. VisualRuntime / UIRuntime stay Editor-free (covered by tests).

---

## 2. Implemented systems (MVP surface)

- Project create + **4 starter templates** (Blank / Text / Visual / Village)
- TEXT + Visual + Mixed scenes
- Hotspots / multi-action / conditions
- Game UI screens
- Assets picker (existing)
- Quests (author + macros)
- Items / gold rewards / loot chest
- Combat authoring (`start_combat`)
- Safe Preview / Test From Here
- Project Validate + Export gate (Phase H)
- Story graph analysis overlay (Phase 1.17)

---

## 3. Deferred systems (not MVP)

- ECS rewrite
- WebGL / Canvas scene renderer rewrite
- Defeat-scene param on `start_combat`
- Full Mill warning cleanup (125 warnings, 0 errors)
- Cloud multiplayer / server authoring
- Full i18n of all new MVP English labels

---

## 4. Test results (executed files)

**Command:** run every `tests/*.test.js` via Node (exit code = file result).

| Metric | Value |
|--------|-------|
| Test **files** executed | **67** |
| **PASS** | **67** |
| **FAIL** | **0** |
| **KNOWN FAIL** | **0** (after Phase 1.19 fixes) |

Artifact: `docs/_mvp-test-baseline.json`

### Fixed during 1.19 (were failing before harden)

| File | Cause | Fix |
|------|-------|-----|
| `editor-action-macros.test.js` | Hard-coded loot_chest length 3; macro now 5 steps | Assert dynamic macro length + registry expansion |
| `editor-hook-architecture.test.js` | Late `Editor.renderSceneList =` in phase-113 | `hooks.replace` for scene list / delete |

---

## 5. Build result

```
npm run build
→ PASS
→ dist/engine.bundle.js (~542 KB)
→ dist/editor-core.bundle.js (~63 KB)
```

Build clean; bundles regenerated this run. No stale-artifact assumption relied upon for the above.

---

## 6. Browser sign-off

| Area | Status | Evidence |
|------|--------|----------|
| Visual | **PENDING manual** | Prior docs: `docs/visual-scene-browser-smoke.md`; automated visual tests PASS |
| Game UI | **PENDING manual** | Prior docs: `docs/game-ui-browser-smoke.md`; `game-ui-runtime` / phase-d tests PASS |
| Conditions | **PENDING manual** | Catalog + visual-condition tests PASS |
| Multi actions | **Automated PASS** | `editor-action-macros` + phase tests |
| Quest | **Automated PASS** | quest-* + phase-114 tests |
| Items | **Automated PASS** | phase-115 items/rewards |
| Combat | **Automated PASS** | phase-116 combat authoring |
| Preview isolation | **Automated PASS** | phase-112 / 116 isolation tests |

**Honesty note:** Cursor IDE browser MCP did **not** complete a live `editor.html` session in this run (provider timeout). Do **not** treat Visual / Game UI rows as PASS without a human click-through on `http://localhost:8765/editor.html` (or local open).

Suggested 10-minute manual:

1. New Project → Text RPG → Preview loads with EDITOR TEST MODE banner  
2. Visual Adventure → click hotspot in preview  
3. Validate → 0 errors  
4. Export JSON  

---

## 7. Known limitations

- Mill campaign: **0 errors**, **125 warnings** (legacy / unreachable / soft issues) — playable, not warning-clean
- Defeat scene not authored on `start_combat`
- Some Editor UX strings remain RU/EN mixed
- Browser smoke for Visual / Game UI not re-signed in this session
- `serve` static host used for attempted smoke; file:// also supported for many flows

---

## 8. Strong MVP score

Checklist (author without JS):

| Criterion | Score |
|-----------|-------|
| Create project | ✓ |
| TEXT scene | ✓ |
| Visual scene | ✓ (tests + docs; browser pending) |
| Hotspot | ✓ |
| Game UI | ✓ (tests + docs; browser pending) |
| Assets | ✓ |
| Condition | ✓ |
| Multi-action | ✓ |
| Give item / gold | ✓ |
| Quest update | ✓ |
| Start combat | ✓ |
| Open panel | ✓ (catalog/registry) |
| Scene transitions | ✓ |
| Safe Preview | ✓ |
| Validate | ✓ |
| Export | ✓ |

**Strong MVP score: 16/16 capability surface available in product**  
**Confidence: HIGH for automated path; MEDIUM until Visual/Game UI manual sign-off**

---

## 9. Production blockers

| Blocker | Severity |
|---------|----------|
| Human Visual + Game UI smoke not completed this session | Process (sign-off) |
| Mill warning debt (125) | Low for MVP demos; Medium if Mill is the ship vehicle |
| None for starter templates / Village / Text path | — |

No architecture rewrite blockers for shipping the **no-code authoring MVP** on starter/demo content.

---

## 10. Recommended Phase 2

1. Complete **manual browser sign-off** checklist; archive screenshots  
2. Mill warning triage (top orphan/unreachable/unknown-condition buckets)  
3. Polish Create Project i18n + onboarding tour tied to starters  
4. Export packaging (`export:dist`) smoke for a zip playable build  
5. Optional: defeat / loss scene as **documented scene-level** pattern (not new combat engine)

**Do not start:** ECS, WebGL, Canvas renderer rewrite.

---

## Validator sweep (executed)

`node scripts/mvp-validator-sweep.js`

| Project | Errors | Warnings |
|---------|--------|----------|
| Demo Village | 0 | 0 |
| Template blank_rpg | 0 | 0 |
| Template text_rpg | 0 | 0 |
| Template visual_adventure | 0 | 0 |
| Template village_demo | 0 | 0 |
| Mill (`GAME_DATA_INLINE`) | 0 | 125 |

Artifact: `docs/_mvp-validator-sweep.json`

---

## Docs shipped

`docs/mvp/` — Quick Start through Export (12 guides + README).

---

## Phase 1.19 code fixes

- `js/editor/editor-project-content-phase-113.js` — hooks.replace (architecture)
- `tests/editor-action-macros.test.js` — loot_chest step count
- `scripts/mvp-validator-sweep.js` — Mill / Village / templates sweep

**STOP** after Phase 1.19.
