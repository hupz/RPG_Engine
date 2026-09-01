#!/usr/bin/env node
/**
 * Phase I — UX Polish
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log('  ✓', msg);
  } else {
    failed++;
    console.error('  ✗', msg);
  }
}

console.log('Phase I — align / distribute pure functions');

{
  const src = fs.readFileSync(path.join(root, 'js/editor/editor-ux-phase-i.js'), 'utf8');
  const start = src.indexOf('function nodeBounds');
  const end = src.indexOf('function applyTransformUpdates');
  const fnBlock = src.slice(start, end);
  const ctx = { console, module: { exports: {} } };
  vm.createContext(ctx);
  vm.runInContext(fnBlock + '\nmodule.exports = { computeAlignUpdates, computeDistributeUpdates };', ctx);
  const { computeAlignUpdates, computeDistributeUpdates } = ctx.module.exports;

  const nodes = [
    { id: 'a', transform: { x: 0.1, y: 0.2, w: 0.1, h: 0.1 } },
    { id: 'b', transform: { x: 0.5, y: 0.3, w: 0.1, h: 0.1 } }
  ];
  const left = computeAlignUpdates(nodes, 'left');
  assert(left.a && left.b && left.a.x === 0.1 && left.b.x === 0.1, 'align left');

  const three = [
    { id: 'x', transform: { x: 0.1, y: 0, w: 0.1, h: 0.1 } },
    { id: 'y', transform: { x: 0.5, y: 0, w: 0.1, h: 0.1 } },
    { id: 'z', transform: { x: 0.9, y: 0, w: 0.1, h: 0.1 } }
  ];
  const dist = computeDistributeUpdates(three, 'horizontal');
  assert(dist.y && Math.abs(dist.y.x - 0.5) < 0.001, 'distribute horizontal middle node');
  assert(Object.keys(computeAlignUpdates([nodes[0]], 'left')).length === 0, 'align needs 2+ nodes');
}

console.log('\nPhase I — module surface');

{
  const ux = fs.readFileSync(path.join(root, 'js/editor/editor-ux-phase-i.js'), 'utf8');
  assert(ux.includes('visualAlignSelected'), 'visualAlignSelected API');
  assert(ux.includes('visualDuplicateSelected'), 'duplicate API');
  assert(ux.includes('toggleMobilePreview'), 'mobile preview API');
  assert(ux.includes('runVillageQuickstartWizard'), 'village wizard API');
  assert(ux.includes('ux-context-menu'), 'context menu CSS');
  assert(ux.includes('_visualPasteHistoryWrapped'), 'paste history wrap');
  assert(ux.includes('ux.village.wizard'), 'command palette registration');
  assert(ux.includes('openShortcutsHelp'), 'shortcuts help');
  assert(ux.includes('visualDeleteNode'), 'Delete shortcut');
  assert(ux.includes('EditorUxPhaseI'), 'test export global');
}

console.log('\nPhase I — editor.html wiring');

{
  const html = fs.readFileSync(path.join(root, 'editor.html'), 'utf8');
  const idxI = html.indexOf('editor-ux-phase-i.js');
  const idxH = html.indexOf('editor-validation-phase-h.js');
  const idxPalette = html.indexOf('editor-command-palette.js');
  assert(idxI > 0, 'phase-i script in editor.html');
  assert(idxI > idxH, 'phase-i after phase-h');
  assert(idxPalette > idxI, 'phase-i before command palette');
}

console.log('\n' + '='.repeat(40));
console.log('Phase I results:', passed, 'passed,', failed, 'failed');
process.exit(failed ? 1 : 0);
