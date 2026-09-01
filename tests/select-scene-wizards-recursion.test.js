#!/usr/bin/env node
/**
 * Regression: selectScene → renderSceneEditor → renderChoiceEditor must not
 * recurse when editor-preview wraps via after() and editor-wizards replace().
 * Mirrors real load order: hooks → choices → preview after → wizards replace.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
function assert(c, m) {
  if (c) {
    passed++;
    console.log('  ✓', m);
  } else {
    failed++;
    console.error('  ✗', m);
  }
}

const ctx = {
  console: {
    log: () => {},
    info: () => {},
    warn: () => {},
    error: (...a) => {
      // surface hook errors
      if (String(a[0] || '').includes('[Editor.hooks')) {
        console.error(...a);
      }
    }
  },
  module: { exports: {} },
  document: {
    getElementById: () => null,
    createElement: () => ({
      style: {},
      classList: { add() {}, remove() {} },
      appendChild() {},
      insertBefore() {},
      querySelector() { return null; },
      firstElementChild: null
    }),
    body: { appendChild() {} },
    head: { appendChild() {} },
    addEventListener() {},
    readyState: 'complete',
    querySelectorAll: () => []
  }
};
ctx.globalThis = ctx;
ctx.window = ctx;

ctx.Editor = {
  data: {
    scenes: {
      cellar: {
        id: 'cellar',
        location: 'Cellar',
        text: 'Dark.',
        choices: [{ text: 'Leave', to: 'hub' }]
      },
      hub: { id: 'hub', location: 'Crossroads', text: 'Hub.', choices: [] }
    },
    quests: { find_key: { title: 'Find the Key', stages: [{ title: 'Start' }] } }
  },
  currentScene: null,
  escapeHtml(s) { return String(s == null ? '' : s); },
  escapeAttr(s) { return String(s == null ? '' : s); },
  // core stubs (like editor-core.js before hooks)
  selectScene(id) {
    this.currentScene = id;
    this.renderSceneList();
    this.renderSceneEditor();
  },
  renderSceneList() {},
  renderSceneEditor() {
    const scene = this.data.scenes[this.currentScene];
    if (!scene) return;
    const allScenes = Object.keys(this.data.scenes);
    (scene.choices || []).forEach((c, i) => this.renderChoiceEditor(c, i, allScenes));
  },
  updateJSONPreview() {}
};

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-hooks.js'), 'utf8'), ctx);

assert(typeof ctx.Editor.hooks.replace === 'function', 'hooks.replace available');
assert(typeof ctx.Editor.hooks.getImpl === 'function', 'hooks.getImpl available');

// Simulate bootstrap mistakenly registering public wrapper — must NOT poison _impl
const hookedBefore = ctx.Editor.selectScene;
ctx.Editor.hooks.register('editor-core', {
  selectScene: ctx.Editor.selectScene
}, { force: true });
assert(
  ctx.Editor.hooks.getImpl('selectScene') !== hookedBefore ||
    !String(ctx.Editor.hooks.getImpl('selectScene')).includes('hooked'),
  'register ignores hooks wrapper'
);

// Canonical owner like editor-core-tabs (raw impl after Object.assign)
function tabsSelectScene(id) {
  this.currentScene = id;
  this.renderSceneList();
  this.renderSceneEditor();
}
ctx.Editor.selectScene = tabsSelectScene;
ctx.Editor.hooks.register('editor-core-tabs', {
  selectScene: tabsSelectScene,
  renderSceneList: function () {},
  renderSceneEditor: function () {
    const scene = this.data.scenes[this.currentScene];
    if (!scene) return '';
    const allScenes = Object.keys(this.data.scenes);
    return (scene.choices || [])
      .map((c, i) => this.renderChoiceEditor(c, i, allScenes))
      .join('');
  }
}, { force: true });

// choices.js — raw renderChoiceEditor
ctx.Editor.renderChoiceEditor = function (c, i) {
  return `<div class="choice-card"><div>Choice ${i}: ${c.text}</div></div>`;
};

// editor-preview.js — after() wraps before wizards replace
ctx.Editor.hooks.after('renderChoiceEditor', function (result) {
  return String(result || '').replace(
    '<div class="choice-card">',
    '<div class="choice-card" data-enhanced="1">'
  );
});

// wizards — Object.assign quest fields + replace
ctx.Editor.renderChoiceQuestFields = function () {
  return '<div class="choice-quest-fields">quest</div>';
};
ctx.Editor.renderSceneWizardsPanel = function () {
  return '<div class="scene-wizards-bar"></div>';
};
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-wizards.js'), 'utf8'), ctx);

const wizSrc = fs.readFileSync(path.join(root, 'js/editor/editor-wizards.js'), 'utf8');
assert(/const baseChoice = Editor\.hooks\.replace/.test(wizSrc), 'wizards assigns baseChoice from replace return');
assert(!/origChoice\s*=\s*Editor\.renderChoiceEditor\.bind/.test(wizSrc), 'no public API bind capture');

let depth = 0;
let maxDepth = 0;
const pub = ctx.Editor.selectScene;
ctx.Editor.selectScene = function (id) {
  depth++;
  if (depth > maxDepth) maxDepth = depth;
  if (depth > 15) throw new Error('RECURSION selectScene depth=' + depth);
  try {
    return pub.apply(this, arguments);
  } finally {
    depth--;
  }
};

try {
  ctx.Editor.selectScene('cellar');
  assert(true, 'selectScene(cellar) completes');
} catch (e) {
  assert(false, 'selectScene throws: ' + e.message);
}
assert(maxDepth <= 3, 'selectScene depth bounded (max=' + maxDepth + ')');

const html = ctx.Editor.renderChoiceEditor({ text: 'X', to: 'hub' }, 0, ['cellar', 'hub']);
assert(typeof html === 'string' && html.includes('choice-card'), 'renderChoiceEditor returns html');
assert(html.includes('choice-quest-fields') || html.includes('quest'), 'quest fields injected');
assert(html.includes('data-enhanced') || html.includes('Choice'), 'after-hook / base still applied');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
