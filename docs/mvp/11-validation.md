# Validation

Run **Project Validator** (integrity panel / Validate command).

## Hard errors (examples)

- Missing scene / item / quest / enemy / NPC targets
- Malformed conditions
- Macro ids left in JSON as actions

## Warnings (examples)

- Unknown actions / conditions
- Orphan / unreachable scenes
- Invalid amounts, empty combat enemies

Validator does **not** mutate project data.

CLI helper: `node scripts/mvp-validator-sweep.js`
