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

assert(guidance.includes('editor.authorGuidance.emptyStates.'), 'author guidance empty states i18n');
assert(guidance.includes("'project'") || guidance.includes('"project"'), 'author guidance project empty state key');
assert(browserV2.includes('editor.contentBrowserV2.welcome.createFirstScene'), 'content browser create CTA i18n');
assert(browserV2.includes('editor.contentBrowserV2.welcome.chooseTemplate'), 'content browser template CTA i18n');
assert(browserV2.includes('editor.contentBrowserV2.categories.combat'), 'combat category i18n key');
assert(browserV2.includes('editor.contentBrowserV2.categories.game_ui'), 'game ui category i18n key');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
