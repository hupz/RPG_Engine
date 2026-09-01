#!/usr/bin/env node
/**
 * Phase UI-19 — Author Guidance & Empty States tests
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

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const html = read('editor.html');
const css = read('css/editor-design-system.css');
const js = read('js/editor/editor-author-guidance.js');
const sceneWs = read('js/editor/editor-scene-workspace.js');
const cb2 = read('js/editor/editor-content-browser-v2.js');

assert(html.includes('editor-author-guidance.js'), 'author guidance script wired');
assert(html.indexOf('editor-author-guidance.js') > html.indexOf('editor-scene-workspace-polish.js'),
  'guidance loads after scene workspace polish');
assert(css.includes('.ui-guidance-empty'), 'empty state CSS');
assert(css.includes('.ui-guidance-hint'), 'context hint CSS');
assert(css.includes('.ui-guidance-dismiss'), 'dismiss control CSS');
assert(!js.includes('SceneManager'), 'no runtime dependency');
assert(!js.includes('QuestRuntime'), 'no quest runtime');

const REQUIRED_CONTEXTS = [
  'project', 'scene', 'content', 'choices', 'visual',
  'game_ui', 'conditions', 'items', 'quests', 'combat'
];

REQUIRED_CONTEXTS.forEach((key) => {
  assert(js.includes(key + ':'), 'EMPTY_STATES has ' + key);
});

const ACTION_MAP = {
  'create-scene': ['openSceneWizard'],
  'content-add-module': ['addSceneModule'],
  'choices-add': ['addChoice', 'addSceneModule'],
  'visual-add-hotspot': ['visualAddNode', 'renderVisualScenePanel'],
  'game-ui-add-screen': ['uiAddScreen'],
  'conditions-add': ['setSceneWorkspaceSection'],
  'create-item': ['createContentEntity', 'createItem'],
  'create-quest': ['createContentEntity', 'openQuestWizard', 'createQuest'],
  'create-enemy': ['createContentEntity', 'switchTab'],
  'create-content': ['createContentEntity']
};

Object.entries(ACTION_MAP).forEach(([action, fns]) => {
  assert(js.includes("case '" + action + "'"), 'runPrimaryAction handles ' + action);
  const hasTarget = fns.some((fn) => js.includes(fn));
  assert(hasTarget, action + ' maps to real editor API');
});

assert(js.includes('buildEmptyStateHtml'), 'buildEmptyStateHtml API');
assert(js.includes('data-guidance-action'), 'primary action attribute');
assert(js.includes('data-guidance-dismiss'), 'dismissible hints');
assert(js.includes('guidanceDismissed'), 'session dismiss state');
assert(js.includes('renderItems'), 'items panel patch uses renderItems');
assert(js.includes('renderEnemies'), 'combat panel patch uses renderEnemies');
assert(js.includes('guidanceReplace'), 'uses hooks.replace for panel patches');
assert(!js.includes('Editor.renderQuests = function'), 'no direct renderQuests monkey-patch');
assert(js.includes('injectSectionHint'), 'section hint injection');
assert(sceneWs.includes('renderAuthorEmptyState'), 'scene workspace uses guidance empty states');
assert(cb2.includes('data-guidance-action'), 'content browser handles guidance actions');
assert(cb2.includes('data-cb2-create'), 'content browser create bridge on guidance CTA');

// Runtime boot + action wiring
const actionsCalled = [];
const ctx = {
  console: { log() {}, info() {}, warn() {}, error() {} },
  document: {
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  },
  Editor: {
    workspace: {},
    data: { scenes: {}, items: {}, enemies: {}, ui: { screens: {} } },
    hooks: { register() {} },
    escapeHtml(s) { return String(s); },
    escapeAttr(s) { return String(s); },
    openSceneWizard() { actionsCalled.push('openSceneWizard'); },
    addSceneModule(t) { actionsCalled.push('addSceneModule:' + t); },
    addChoice() { actionsCalled.push('addChoice'); },
    visualAddNode(k) { actionsCalled.push('visualAddNode:' + k); },
    uiAddScreen() { actionsCalled.push('uiAddScreen'); },
    setSceneWorkspaceSection(s) { actionsCalled.push('section:' + s); },
    createContentEntity(t) { actionsCalled.push('createContentEntity:' + t); },
    createItem() { actionsCalled.push('createItem'); },
    createQuest() { actionsCalled.push('createQuest'); },
    switchTab(t) { actionsCalled.push('switchTab:' + t); },
    renderQuests() {},
    renderGameUiEditor() {},
    renderItems() {},
    renderEnemies() {},
    setSceneWorkspaceSection(s) { actionsCalled.push('section:' + s); }
  }
};
ctx.globalThis = ctx;
ctx.window = ctx;

vm.runInNewContext(js, ctx, { filename: 'editor-author-guidance.js' });

assert(typeof ctx.Editor.AuthorGuidance === 'object', 'Editor.AuthorGuidance exported');
assert(typeof ctx.Editor.renderAuthorEmptyState === 'function', 'renderAuthorEmptyState exported');
assert(typeof ctx.Editor.runAuthorGuidanceAction === 'function', 'runAuthorGuidanceAction exported');

const htmlContent = ctx.Editor.AuthorGuidance.buildEmptyStateHtml('visual');
assert(htmlContent.includes('ui-guidance-empty'), 'empty state markup');
assert(htmlContent.includes('data-guidance-action="visual-add-hotspot"'), 'visual primary action');
assert(htmlContent.includes('btn-primary'), 'primary CTA class');
assert(htmlContent.includes('Нет visual-контента'), 'visual title');

const catHtml = ctx.Editor.AuthorGuidance.buildEmptyStateHtml('content_category', {
  createType: 'quest'
});
assert(catHtml.includes('data-cb2-create="quest"'), 'content category bridges to browser create');
assert(catHtml.includes('data-guidance-action="create-content"'), 'content category guidance action');

ctx.Editor.runAuthorGuidanceAction('create-scene');
assert(actionsCalled.includes('openSceneWizard'), 'create-scene opens canonical wizard');
ctx.Editor.runAuthorGuidanceAction('content-add-module');
assert(actionsCalled.includes('addSceneModule:story'), 'content-add-module calls addSceneModule');
ctx.Editor.runAuthorGuidanceAction('choices-add');
assert(actionsCalled.includes('addChoice'), 'choices-add calls addChoice');
ctx.Editor.runAuthorGuidanceAction('create-item');
assert(actionsCalled.includes('createContentEntity:item'), 'create-item calls createContentEntity');
ctx.Editor.runAuthorGuidanceAction('create-content', 'enemy');
assert(actionsCalled.includes('createContentEntity:enemy'), 'create-content passes payload');

// Dismiss hint
assert(!ctx.Editor.AuthorGuidance.isHintDismissed('section-visual'), 'hint starts visible');
ctx.Editor.AuthorGuidance.dismissHint('section-visual');
assert(ctx.Editor.AuthorGuidance.isHintDismissed('section-visual'), 'hint dismiss persists in session');
assert(ctx.Editor.AuthorGuidance.renderGuidanceHintHtml('section-visual', 'test') === '', 'dismissed hint hidden');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
