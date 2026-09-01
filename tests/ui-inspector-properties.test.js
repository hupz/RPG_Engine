#!/usr/bin/env node
/**
 * Phase UI-15 — Inspector & Property System tests
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
const insp15Src = fs.readFileSync(path.join(root, 'js/editor/editor-inspector-properties.js'), 'utf8');

assert(html.includes('editor-inspector-properties.js'), 'script wired after inspector-redesign');
assert(insp15Src.includes('renderInspectorSection'), 'renderInspectorSection helper');
assert(insp15Src.includes('renderLogicSection'), 'LOGIC section builder');
assert(!insp15Src.includes('SceneManager'), 'no SceneManager dependency');
assert(!insp15Src.includes('recordMutation'), 'no history core mutations');

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
      const el = {
        tagName: tag,
        id: '',
        className: '',
        textContent: '',
        innerHTML: '',
        open: false,
        childNodes: [],
        appendChild(c) { this.childNodes.push(c); },
        querySelectorAll() { return []; },
        addEventListener() {},
        cloneNode() { return this; }
      };
      if (tag === 'details') el.open = true;
      return el;
    },
    createDocumentFragment() {
      const nodes = [];
      return {
        childNodes: nodes,
        appendChild(n) { nodes.push(n); return n; },
        cloneNode() { return this; }
      };
    }
  },
  Editor: {
    workspace: { ui: { inspectorSections: {} } },
    data: {
      items: { sword: { name: 'Меч' } },
      quests: {},
      scenes: {
        intro: {
          location: 'Таверна',
          choices: [{ text: 'Войти' }],
          visual: { nodes: [{ id: 'n1' }] }
        }
      }
    },
    isWriterMode() { return !!ctx._writer; },
    isAdvancedMode() { return !ctx._writer; },
    isEditorAdvancedMode() { return !!ctx._advanced; },
    escapeHtml(s) { return String(s); },
    escapeAttr(s) { return String(s); },
    hooks: null,
    Inspector: {
      _insp15ScenePatched: false,
      register(type, def) {
        this._registry = this._registry || {};
        this._registry[type] = def;
      }
    }
  }
};
ctx.globalThis = ctx;
ctx.window = ctx;

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-hooks.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-action-catalog.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-condition-catalog.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-inspector-redesign.js'), 'utf8'), ctx);
vm.runInContext(insp15Src, ctx);

const E = ctx.Editor;
const P = E.InspectorProps;
const UI = E.InspectorUI;

assert(typeof P === 'object', 'InspectorProps exported');
assert(typeof P.renderTextField === 'function', 'renderTextField');
assert(typeof P.renderNumberField === 'function', 'renderNumberField');
assert(typeof P.renderToggleField === 'function', 'renderToggleField');
assert(typeof P.renderSelectField === 'function', 'renderSelectField');
assert(typeof P.renderLogicSection === 'function', 'renderLogicSection');
assert(typeof P.renderInspectorSection === 'function', 'renderInspectorSection');

// Field helpers produce consistent markup
const textField = P.renderTextField('Имя', 'Test', { 'data-field': 'label' });
assert(textField.includes('insp15-field'), 'text field wrapper class');
assert(textField.includes('insp15-field__label'), 'text field label');
assert(textField.includes('data-field="label"'), 'text field attrs');

const numField = P.renderNumberField('X', 0.5, { 'data-field': 'x' }, { step: 0.01 });
assert(numField.includes('type="number"'), 'number input type');

const toggleField = P.renderToggleField('Видимый', true, { 'data-field': 'visible' });
assert(toggleField.includes('type="checkbox"'), 'toggle checkbox');
assert(toggleField.includes('checked'), 'toggle checked state');

// LOGIC section merges conditions + actions
ctx._writer = false;
ctx._advanced = true;
const logicHtml = P.renderLogicSection({
  nodeId: 'n1',
  showIf: { all: [{ hasItem: 'sword' }] },
  clickSteps: [{ action: 'say', params: { text: 'Hi' } }]
});
assert(logicHtml.includes('insp15-logic-block'), 'logic blocks');
assert(logicHtml.includes('Условия'), 'conditions subheading');
assert(logicHtml.includes('Действия'), 'actions subheading');
assert(logicHtml.includes('+ Добавить условие'), 'add condition button');
assert(logicHtml.includes('+ Добавить действие'), 'add action button');
assert(logicHtml.includes('Шаг 1'), 'action step summary from catalog');

// Visual inspector v15 sections
ctx._writer = true;
ctx._advanced = false;
const visualHtml = E.buildVisualNodeInspectorHtml({
  id: 'btn1',
  kind: 'button',
  transform: { x: 0.1, y: 0.2, w: 0.3, h: 0.1, z: 5 },
  props: { label: 'Talk', text: 'Hello' },
  events: { click: [{ action: 'say', params: { text: 'Hi' } }] }
});
assert(visualHtml.includes('data-insp15="1"'), 'visual inspector v15 marker');
assert(visualHtml.includes('Общее'), 'GENERAL section label');
assert(visualHtml.includes('Позиция'), 'POSITION section');
assert(visualHtml.includes('Логика'), 'LOGIC section merged');
assert(visualHtml.includes('Ширина'), 'position width field');
assert(!visualHtml.includes('data-insp8-section="interaction"'), 'no separate interaction section');
assert(!visualHtml.includes('data-insp8-section="conditions"'), 'no separate conditions section');
assert(visualHtml.includes('Шаг 1'), 'action in logic section');
assert(!visualHtml.includes('insp8-raw-json'), 'writer: no raw JSON');

// Advanced mode
ctx._writer = false;
ctx._advanced = true;
const advVisual = E.buildVisualNodeInspectorHtml({
  id: 'n1',
  kind: 'hotspot',
  transform: { x: 0.45, y: 0.31, w: 0.2, h: 0.1, z: 1 },
  props: { label: 'Spot' }
});
assert(advVisual.includes('n1'), 'advanced: node id in advanced section');
assert(advVisual.includes('insp8-raw-json'), 'advanced: raw JSON preserved');

// Game UI inspector v15
const uiHtml = E.buildGameUiNodeInspectorHtml({
  id: 'ui_btn',
  kind: 'button',
  text: 'Start',
  transform: { x: 0, y: 0, w: 0.2, h: 0.1, z: 0 },
  events: { click: [{ action: 'add_item', params: { itemId: 'sword', count: 1 } }] }
});
assert(uiHtml.includes('data-insp15="1"'), 'game UI v15 marker');
assert(uiHtml.includes('Общее'), 'game UI general section');
assert(uiHtml.includes('Логика'), 'game UI logic section');
assert(uiHtml.includes('Предмет') || uiHtml.includes('Выдать'), 'game UI action label from catalog');
assert(!uiHtml.includes('Взаимодействие</summary>'), 'no legacy interaction section title');

// InspectorUI extended with shared controls
assert(typeof UI.renderTextField === 'function', 'InspectorUI.renderTextField');
assert(UI.STANDARD_SECTIONS?.logic?.label === 'Логика', 'STANDARD_SECTIONS.logic');

// Scene inspector registration
const sceneDef = E.Inspector._registry?.scene;
assert(sceneDef && typeof sceneDef.render === 'function', 'scene inspector registered');
const sceneFrag = sceneDef.render({ id: 'intro', data: E.data });
assert(sceneFrag.childNodes.length > 0, 'scene inspector renders fragment');
const sceneText = sceneFrag.childNodes.map((n) => n.textContent || '').join(' ');
assert(sceneText.includes('Таверна') || sceneText.includes('Выборов'), 'scene general info');

// Section state does not mutate project JSON
const before = JSON.stringify(E.data);
UI.setSectionExpanded('insp15-test', false);
UI.setSectionExpanded('insp15-test', true);
assert(JSON.stringify(E.data) === before, 'no data schema mutation');

// Legacy UI-8 builders preserved for rollback
assert(typeof E._buildVisualNodeInspectorHtmlUi8 === 'function', 'legacy visual builder kept');
assert(typeof E._buildGameUiNodeInspectorHtmlUi8 === 'function', 'legacy game UI builder kept');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
