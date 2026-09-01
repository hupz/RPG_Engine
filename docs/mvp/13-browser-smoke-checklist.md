# Browser smoke checklist (Phase 1.19)

**Status: NOT COMPLETED in-agent** (browser MCP timeout). Run manually before production claim.

Host: `npx serve -l 8765` → `http://localhost:8765/editor.html`

| # | Step | Pass? |
|---|------|-------|
| 1 | Editor loads without console errors | |
| 2 | New Project → Text RPG → create → Preview banner EDITOR TEST MODE | |
| 3 | Preview plays hub → forest choice | |
| 4 | New Project → Visual Adventure → hotspot click | |
| 5 | Add condition on choice; Preview respects it | |
| 6 | Multi-action order on hotspot | |
| 7 | Quest start/advance visible in journal | |
| 8 | Give item / gold in Preview | |
| 9 | Start combat → victory scene | |
| 10 | Game UI button open_panel / change_scene | |
| 11 | Validate → 0 errors on starter | |
| 12 | Export JSON downloads / copies | |
| 13 | Exit Test Mode does not leave Mill polluted | |

Sign-off: _____________ Date: _____________
