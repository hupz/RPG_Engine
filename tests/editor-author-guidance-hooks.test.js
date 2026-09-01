#!/usr/bin/env node
/**
 * Regression: author-guidance panel patches must not recurse via hooks
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

const ctx = {
  console: { log() {}, info() {}, warn() {}, error() {} },
  document: {
    getElementById(id) {
      if (id === 'quests-editor') {
        return {
          innerHTML: '',
          querySelectorAll() { return []; },
          querySelector() { return null; }
        };
      }
      return null;
    },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  },
  Editor: {
    workspace: {},
    data: { scenes: { a: { id: 'a' } }, quests: {} },
    escapeHtml(s) { return String(s); },
    escapeAttr(s) { return String(s); },
    getQuestIds() { return Object.keys(this.data.quests || {}); },
    ensureQuests() {
      if (!this.data.quests) this.data.quests = {};
    },
    _questRenders: 0
  }
};
ctx.globalThis = ctx;
ctx.window = ctx;

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-hooks.js'), 'utf8'), ctx);
ctx.Editor.hooks.register('test-quests', {
  renderQuests() { ctx.Editor._questRenders = (ctx.Editor._questRenders || 0) + 1; }
}, { force: true });
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-author-guidance.js'), 'utf8'), ctx);

ctx.Editor.renderQuests();
assert(ctx.Editor._questRenders === 0, 'empty quests shows guidance without calling prev render');

ctx.Editor.data.quests.q1 = { id: 'q1', title: 'Q' };
ctx.Editor.renderQuests();
assert(ctx.Editor._questRenders === 1, 'quests with data delegates to prev render once');

ctx.Editor.renderQuests();
ctx.Editor.renderQuests();
assert(ctx.Editor._questRenders === 3, 'subsequent renders stay bounded');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
