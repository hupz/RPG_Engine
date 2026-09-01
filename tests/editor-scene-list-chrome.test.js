#!/usr/bin/env node
/**
 * Regression: pcm-chrome insertBefore with context-scenes-pane (UI-4 DOM).
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

function makeEl(tag) {
  const children = [];
  return {
    tagName: tag.toUpperCase(),
    id: '',
    className: '',
    parentNode: null,
    appendChild(c) {
      if (c) { c.parentNode = this; children.push(c); }
      return c;
    },
    insertBefore(c, ref) {
      if (!children.includes(ref)) {
        throw new DOMException('Node.insertBefore: Child to insert before is not a child of this node');
      }
      const i = children.indexOf(ref);
      if (c) { c.parentNode = this; children.splice(i, 0, c); }
      return c;
    },
    querySelector() { return null; },
    firstChild: null,
    get childNodes() { return children; }
  };
}

const sidebar = makeEl('aside');
sidebar.id = 'context-sidebar';
const scenesPane = makeEl('div');
scenesPane.id = 'context-scenes-pane';
const h3 = makeEl('h3');
const sceneList = makeEl('div');
sceneList.id = 'scene-list';
scenesPane.appendChild(h3);
scenesPane.appendChild(sceneList);
sidebar.appendChild(scenesPane);

const els = {
  'context-sidebar': sidebar,
  'context-scenes-pane': scenesPane,
  'scene-list': sceneList
};

const ctx = {
  console: { log() {}, info() {}, warn() {}, error() {} },
  document: {
    getElementById: (id) => els[id] || null,
    createElement: (tag) => makeEl(tag),
    head: { appendChild() {} }
  },
  DOMException: class DOMException extends Error {
    constructor(m) { super(m); this.name = 'DOMException'; }
  }
};
ctx.globalThis = ctx;
ctx.window = ctx;

ctx.Editor = {
  data: { scenes: { a: { id: 'a', location: 'A' } } },
  _sceneListQuery: '',
  _sceneListFilter: 'all',
  escapeAttr(s) { return String(s); },
  renderProjectOverviewBar() { return '<div id="pcm-overview"></div>'; },
  renderSceneList() {}
};

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-hooks.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-project-content-phase-113.js'), 'utf8'), ctx);

let threw = false;
try {
  ctx.Editor.ensureSceneListChrome();
} catch (e) {
  threw = true;
}
assert(!threw, 'ensureSceneListChrome does not throw with scenes pane DOM');

const chrome = scenesPane.childNodes.find((n) => n.id === 'pcm-chrome');
assert(chrome != null, 'pcm-chrome created');
assert(chrome.parentNode === scenesPane, 'pcm-chrome inside context-scenes-pane');
assert(scenesPane.childNodes.includes(sceneList), 'scene-list still in pane');
assert(scenesPane.childNodes.indexOf(chrome) < scenesPane.childNodes.indexOf(sceneList),
  'pcm-chrome before scene-list');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
