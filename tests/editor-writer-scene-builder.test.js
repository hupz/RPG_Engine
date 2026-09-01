#!/usr/bin/env node
/**
 * Writer Mode — scene builder technical surface hiding.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓', msg); }
  else { failed++; console.error('  ✗', msg); }
}

const css = fs.readFileSync(path.join(root, 'css/editor-design-system.css'), 'utf8');
const choices = fs.readFileSync(path.join(root, 'js/editor/editor-choices.js'), 'utf8');
const builder = fs.readFileSync(path.join(root, 'js/editor/editor-scene-builder.js'), 'utf8');
const phaseE = fs.readFileSync(path.join(root, 'js/editor/editor-action-phase-e.js'), 'utf8');

assert(css.includes('writer-advanced-only'), 'CSS: writer-advanced-only visibility');
assert(css.includes('writer-only'), 'CSS: writer-only visibility');
assert(css.includes('writer-surface--technical'), 'CSS: flags module hidden in writer');
assert(css.includes('cb-engineering-details'), 'CSS: engineering details disclosure');
assert(css.includes('scene-enter-summary-line'), 'CSS: enter events summary line');

assert(choices.includes('cb-head--writer'), 'choices: writer condition head');
assert(choices.includes('buildAddRuleOptionsHtml') || choices.includes('NLConditionBuilder'), 'choices: NL add options for all rule types');
assert(!choices.includes('cb-engineering-details') || choices.includes('writer-advanced-only'), 'choices: no writer engineering-details split');
assert(choices.includes('writer-advanced-only'), 'choices: doneFlag hidden in writer');

assert(builder.includes('writer-surface--technical'), 'builder: flags module class');
assert(builder.includes("filter((id) => id !== 'flags')"), 'builder: flags removed from picker in writer');

assert(phaseE.includes('formatSceneEnterSummary'), 'phase-e: enter summary helper');
assert(phaseE.includes('scene-enter-summary-line writer-only'), 'phase-e: read-only enter summary');

// formatSceneEnterSummary — no DOM
const ctx = {
  Editor: {
    getActionLabel(id) {
      return id === 'say' ? 'Сказать' : id;
    },
    data: { scenes: { hub: { location: 'Хаб' } } }
  },
  console
};
vm.createContext(ctx);
vm.runInContext(phaseE, ctx);

const summary = ctx.Editor.formatSceneEnterSummary([
  { action: 'say', params: { text: 'Привет' } },
  { action: 'change_scene', params: { sceneId: 'hub' } }
]);
assert(summary.includes('Сказать'), 'summary uses action labels');
assert(summary.includes('Хаб'), 'summary resolves scene location');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
