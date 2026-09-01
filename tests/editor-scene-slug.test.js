#!/usr/bin/env node
/**
 * Scene id slug — transliteration via Editor.slugifyId / slugifySceneId
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

const ctx = {
  console: { log() {}, info() {}, warn() {}, error() {} },
  document: {
    head: { appendChild() {} },
    body: { classList: { add() {}, remove() {}, toggle() {} }, appendChild() {} },
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return { id: '', textContent: '', appendChild() {} }; }
  },
  localStorage: { store: {}, getItem() { return null; }, setItem() {} },
  Editor: { data: { scenes: {} }, showJsonPreview: false }
};
ctx.window = ctx;
ctx.globalThis = ctx;
ctx.setTimeout = (fn) => { if (typeof fn === 'function') fn(); return 0; };

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-no-code-ux.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/project-schema.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-scene-authoring-index.js'), 'utf8'), ctx);

const E = ctx.Editor;
const IDX = ctx.SceneAuthoringIndex;

assert(typeof E.slugifySceneId === 'function', 'slugifySceneId exported');
assert(E.slugifyId('Таверна', '', {}) === 'taverna', 'Таверна → taverna');
assert(E.slugifyId('Дом старосты', '', {}) === 'dom_starosty', 'Дом старосты → dom_starosty');
assert(E.slugifyId('Таверна', '', { taverna: {} }) === 'taverna_2', 'duplicate gets _2 suffix');
assert(E.slugifySceneId('Таверна', { taverna: {}, taverna_2: {} }) === 'taverna_3', 'slugifySceneId unique chain');

assert(IDX.slugSceneId('Таверна', {}) === 'taverna', 'index delegates translit via Editor');
assert(IDX.slugSceneId('Таверна', { taverna: {} }) === 'taverna_2', 'index delegates uniqueness');

const phase = fs.readFileSync(path.join(root, 'js/editor/editor-scene-authoring-phase-112.js'), 'utf8');
assert(phase.includes('slugSceneId'), 'wizard uses slugSceneId');
const builder = fs.readFileSync(path.join(root, 'js/editor/editor-scene-builder.js'), 'utf8');
assert(builder.includes('slugifySceneId'), 'createBlankScene uses slugifySceneId fallback');

console.log('\n' + (failed ? 'FAILED' : 'PASSED') + ': ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
