#!/usr/bin/env node
/**
 * Phase UI-8 — Inspector Redesign tests
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
function assert(c, m) {
  if (c) { passed++; console.log('  ✓', m); }
  else { failed++; console.error('  ✗', m); }
}

const html = fs.readFileSync(path.join(root, 'editor.html'), 'utf8');
const insp8 = fs.readFileSync(path.join(root, 'js/editor/editor-inspector-redesign.js'), 'utf8');

assert(html.includes('editor-inspector-redesign.js'), 'script wired in editor.html');
assert(insp8.includes('buildVisualNodeInspectorHtml'), 'visual inspector builder');
assert(insp8.includes('buildGameUiNodeInspectorHtml'), 'game UI inspector builder');
assert(!insp8.includes('SceneManager'), 'no SceneManager dependency');

const ctx = {
  console: { log() {}, info() {}, warn() {}, error() {} },
  UIRuntime: { BINDINGS: ['player.hp', 'player.gold'] },
  document: {
    readyState: 'complete',
    head: { appendChild() {} },
    body: { classList: { add() {}, remove() {}, toggle() {} } },
    addEventListener() {},
    querySelector: () => null,
    getElementById: () => null,
    createElement(tag) {
      return { id: '', className: '', textContent: '', innerHTML: '', appendChild() {}, addEventListener() {} };
    }
  },
  Editor: {
    workspace: { ui: { inspectorSections: {} } },
    data: {
      items: { sword: { name: 'Меч' } },
      quests: {},
      scenes: {}
    },
    isWriterMode() { return !!ctx._writer; },
    isAdvancedMode() { return !ctx._writer; },
    isEditorAdvancedMode() { return !!ctx._advanced; },
    escapeHtml(s) { return String(s); },
    escapeAttr(s) { return String(s); },
    hooks: null
  }
};
ctx.globalThis = ctx;
ctx.window = ctx;

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-hooks.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-action-catalog.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-condition-catalog.js'), 'utf8'), ctx);
vm.runInContext(insp8, ctx);

const E = ctx.Editor;
const UI = E.InspectorUI;

assert(typeof E.getActionLabel === 'function', 'getActionLabel API');
assert(E.getActionLabel('say') === 'Реплика NPC', 'action label from catalog');
assert(E.getActionLabel('unknown_action_xyz') === 'unknown_action_xyz', 'unknown action id preserved');

assert(typeof E.formatActionStepSummary === 'function', 'formatActionStepSummary API');
const stepLabel = E.formatActionStepSummary('add_gold', { amount: 50 }, E.data);
assert(stepLabel.includes('золото') || stepLabel.includes('Золото') || stepLabel.includes('50'), 'action step human label');

assert(typeof E.formatConditionRuleSummary === 'function', 'formatConditionRuleSummary API');
const condLabel = E.formatConditionRuleSummary({ hasItem: 'sword' }, E.data);
assert(condLabel.includes('Меч') || condLabel.includes('sword'), 'condition rule with item name');

assert(typeof E.formatConditionsSummary === 'function', 'formatConditionsSummary API');
const emptyCond = E.formatConditionsSummary(null, E.data);
assert(emptyCond.empty === true, 'empty conditions summary');

// Writer mode filtering
ctx._writer = true;
ctx._advanced = false;
const writerHtml = E.buildVisualNodeInspectorHtml({
  id: 'btn1', kind: 'button', transform: { x: 0.1, y: 0.2, w: 0.3, h: 0.1, z: 5 },
  props: { label: 'Talk', text: 'Hello' },
  events: { click: [{ action: 'say', params: { text: 'Hi' } }] }
});
assert(!writerHtml.includes('insp8-raw-json'), 'writer: no raw JSON block');
assert(writerHtml.includes('Позиция'), 'writer: position labels');
assert(writerHtml.includes('Ширина'), 'writer: size labels');
assert(writerHtml.includes('insp-section'), 'collapsible sections');
assert(writerHtml.includes('Шаг 1'), 'action step summary');
assert(!writerHtml.includes('data-insp8-section="advanced"') || !writerHtml.match(/Advanced<\/summary>/), 'writer: advanced section hidden');

// Advanced mode
ctx._writer = false;
ctx._advanced = true;
const advHtml = E.buildVisualNodeInspectorHtml({
  id: 'n1', kind: 'hotspot', transform: { x: 0.45, y: 0.31, w: 0.2, h: 0.1, z: 1 },
  props: { label: 'Spot' }
});
assert(advHtml.includes('n1'), 'advanced: node id shown');
assert(advHtml.includes('insp8-norm-hint') || advHtml.includes('Нормализованные'), 'advanced: normalized hint');

// Transform persistence — values in HTML
assert(advHtml.includes('value="0.45"') || advHtml.includes('value=\'0.45\''), 'transform x preserved');
assert(advHtml.includes('0.31'), 'transform y preserved');

// Game UI consistency
const uiHtml = E.buildGameUiNodeInspectorHtml({
  id: 'ui_btn', kind: 'button', text: 'Start', transform: { x: 0, y: 0, w: 0.2, h: 0.1, z: 0 },
  events: { click: [{ action: 'add_item', params: { itemId: 'sword', count: 1 } }] }
});
assert(uiHtml.includes('Свойства'), 'game UI: properties section');
assert(uiHtml.includes('Внешний вид'), 'game UI: appearance section');
assert(uiHtml.includes('Взаимодействие'), 'game UI: interaction section');
assert(uiHtml.includes('Условия'), 'game UI: conditions section');
assert(uiHtml.includes('Предмет') || uiHtml.includes('Выдать'), 'game UI: action label not raw id only');

// Section navigation does not mutate project data
const before = JSON.stringify(E.data);
UI.setSectionExpanded('test-key', false);
UI.setSectionExpanded('test-key', true);
assert(JSON.stringify(E.data) === before, 'section state does not mutate project JSON');

// History unchanged — no EditorHistory in module
assert(!insp8.includes('recordMutation'), 'no new history mutations');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
