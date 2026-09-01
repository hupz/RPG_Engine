#!/usr/bin/env node
/**
 * editor-variables — modal create flow, validation, no native dialogs
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

const src = fs.readFileSync(path.join(root, 'js/editor/editor-variables.js'), 'utf8');

assert(!/\bprompt\s*\(/.test(src), 'no prompt() calls');
assert(!/\bconfirm\s*\(/.test(src), 'no confirm() calls');
assert(!/\balert\s*\(/.test(src), 'no alert() calls');
assert(src.includes('openAddProjectVariableModal'), 'modal API');
assert(src.includes('validateNewProjectVariableId'), 'validation API exported');
assert(src.includes('Переменная добавлена'), 'success toast');

const ctx = {
  console: { log() {}, info() {}, warn() {}, error() {} },
  document: {
    head: { appendChild() {} },
    body: { appendChild() {} },
    getElementById() { return null; }
  },
  Editor: {
    data: {
      variables: { door_open: { name: 'door_open', defaultValue: false } },
      startingFlags: { visited_tavern: true },
      scenes: {}
    },
    hooks: { after() {} },
    toast: { success() {}, warning() {} },
    markDirty() {},
    updateJSONPreview() {},
    renderVariablesPanel() {},
    confirmDialog() { return Promise.resolve(false); }
  },
  ConditionSystem: {
    collectFlagNames(data) {
      return Object.keys(data?.startingFlags || {});
    }
  }
};
ctx.window = ctx;
ctx.globalThis = ctx;

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/project-schema.js'), 'utf8'), ctx);
vm.runInContext(src, ctx);

const E = ctx.Editor;

assert(E.validateNewProjectVariableId('') !== '', 'empty name rejected');
assert(E.validateNewProjectVariableId('door_open') !== '', 'duplicate variable rejected');
assert(E.validateNewProjectVariableId('visited_tavern') !== '', 'duplicate flag rejected');
assert(E.validateNewProjectVariableId('new_flag_ok') === '', 'unique id accepted');

E.data.variables = {};
assert(E.validateNewProjectVariableId('visited_tavern') !== '', 'flag still blocks when vars empty');

assert(E.normalizeProjectVariableId('  My Flag  ') === 'my_flag', 'slugify id');

console.log('\n' + (failed ? 'FAILED' : 'PASSED') + ': ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
