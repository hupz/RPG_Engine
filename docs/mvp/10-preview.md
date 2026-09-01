# Preview (safe)

Editor Test Mode uses isolated storage keys (`rpg_editor_test_*`) and URL gate `?editorTest=1`.

## Rules

- Preview writes **test** data only — not production Mill / campaign cache.
- Banner shows **EDITOR TEST MODE** with Restart / Exit.
- Prefer **Test From Here** on the current scene.

See also: `docs/phase-112-editor-test-smoke.md`.
