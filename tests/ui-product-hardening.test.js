#!/usr/bin/env node
/**
 * Phase UI-24 — Product hardening structural tests
 */
'use strict';

const fs = require('fs');
const path = require('path');
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
const hardening = read('js/editor/editor-product-hardening.js');
const guidance = read('js/editor/editor-author-guidance.js');
const browserV2 = read('js/editor/editor-content-browser-v2.js');

assert(html.indexOf('editor-product-hardening.js') > html.indexOf('editor-ui-integration.js'),
  'hardening loads after ui-integration');
assert(hardening.includes('openProjectTemplatePicker'), 'template picker exported');
assert(hardening.includes('openExportMenu'), 'export redirect');
assert(hardening.includes('aria-hidden'), 'legacy nav hidden');
assert(hardening.includes('ui24-no-project'), 'no-project CSS hook');
assert(hardening.includes('ui24-empty-project'), 'empty project CSS hook');
assert(!hardening.includes('SceneManager'), 'no runtime changes');

assert(guidance.includes('Welcome to your RPG project'), 'author guidance project welcome');
assert(browserV2.includes('Create First Scene'), 'content browser create CTA');
assert(browserV2.includes('Choose Template'), 'content browser template CTA');
assert(browserV2.includes('label: \'Бой\''), 'combat category localized');
assert(browserV2.includes('label: \'Игровой UI\''), 'game ui category localized');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
