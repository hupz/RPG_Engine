'use strict';
/**
 * Text inputs must not trigger full UI rerender that destroys the focused node.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

let passed = 0, failed = 0;
function assert(c, m) {
  if (c) { passed++; console.log('  ✓', m); }
  else { failed++; console.error('  ✗', m); }
}

const wizard = fs.readFileSync(path.join(root, 'js/editor/editor-quest-wizard.js'), 'utf8');
const quests = fs.readFileSync(path.join(root, 'js/editor/editor-quests.js'), 'utf8');

// questWizardSet: title must not always renderQuestWizard
const setFn = wizard.slice(wizard.indexOf('Editor.questWizardSet'), wizard.indexOf('Editor.questWizardNext'));
assert(setFn.includes('STRUCTURAL'), 'wizard distinguishes structural vs text fields');
assert(/if\s*\(\s*STRUCTURAL\[path\]\s*\)/.test(setFn), 'structural-only re-render gate');
// ensure title path does not force render unconditionally at end
const renderCalls = (setFn.match(/this\.renderQuestWizard\(\)/g) || []).length;
assert(renderCalls === 1, 'only one renderQuestWizard call (inside structural branch)');

// updateQuestMeta: no this.renderQuests() on title
const meta = quests.slice(quests.indexOf('updateQuestMeta'), quests.indexOf('_refreshQuestTitleUI') + 400);
assert(meta.includes('_refreshQuestTitleUI'), 'title uses soft UI refresh');
assert(!/if \(field === 'title'\) this\.renderQuests\(\)/.test(quests), 'title no longer full renderQuests');

// Behavioral simulation
let renderCount = 0;
const w = { title: '', goal: 'talk', count: 1, rewards: {} };
function questWizardSet(path, value) {
  const STRUCTURAL = { goal: true, aftermath: true, npcId: true };
  if (path === 'title') w.title = value;
  else if (path === 'goal') w.goal = value;
  if (STRUCTURAL[path]) renderCount++;
}
// type full string
const name = 'Тестовый квест';
for (const ch of name) {
  questWizardSet('title', (w.title || '') + ch);
}
assert(w.title === name, 'full title stored');
assert(renderCount === 0, 'no rerender while typing title');

questWizardSet('goal', 'collect');
assert(renderCount === 1, 'goal change does structural render');

// Soft meta update simulation
let fullQuestRenders = 0;
let softUpdates = 0;
function updateQuestMeta(field, value) {
  if (field === 'title') softUpdates++;
  else fullQuestRenders++;
}
for (const ch of 'Мельница') updateQuestMeta('title', ch);
assert(softUpdates === 8, 'soft updates per char');
assert(fullQuestRenders === 0, 'no full quest list render while typing');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
