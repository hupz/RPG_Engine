#!/usr/bin/env node
/**
 * Mobile / touch gate logic (зеркало editor-mobile-gate.js).
 */
'use strict';

const BREAK = 768;

function shouldBlock(width, touch, advanced, writer) {
  if (touch && advanced) return { block: true, reason: 'engineer' };
  if (width < BREAK) {
    if (touch && writer) return { block: false, reason: null };
    return { block: true, reason: 'narrow' };
  }
  return { block: false, reason: null };
}

let passed = 0;
let failed = 0;
function assert(c, m) {
  if (c) { passed++; console.log('  ✓', m); }
  else { failed++; console.error('  ✗', m); }
}

console.log('Editor touch gate');

assert(shouldBlock(1024, true, true, false).block === true, 'touch + advanced → gate');
assert(shouldBlock(1024, true, false, true).block === false, 'touch + writer @1024 → open');
assert(shouldBlock(800, false, false, false).block === false, '800px desktop mouse → open');
assert(shouldBlock(500, false, true, false).block === true, 'narrow desktop → gate');
assert(shouldBlock(500, true, false, true).block === false, 'narrow touch writer → open');
assert(shouldBlock(500, true, false, false).block === true, 'narrow touch no writer → gate');
assert(shouldBlock(1024, false, true, false).block === false, 'desktop advanced → open');

console.log('\nEditor touch — wiring');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'editor.html'), 'utf8');
assert(html.includes('editor-touch.css'), 'editor-touch.css linked');
assert(html.includes('editor-touch-ui.js'), 'editor-touch-ui.js loaded');
assert(html.includes('editor-mobile-gate-writer'), 'writer escape button in gate');
assert(html.includes('id="editor-mobile-gate-title"'), 'gate title id');

const gateJs = fs.readFileSync(path.join(root, 'js/editor/editor-mobile-gate.js'), 'utf8');
assert(!gateJs.includes("'ontouchstart' in window") || gateJs.includes('maxTouchPoints'), 'no naive ontouchstart-only gate');
assert(gateJs.includes('pointer: coarse') || gateJs.includes('hover: none'), 'touch detection uses media queries');

const touchJs = fs.readFileSync(path.join(root, 'js/editor/editor-touch-ui.js'), 'utf8');
assert(touchJs.includes('renderStoryGraphTouchActions'), 'story graph touch actions');
assert(touchJs.includes('is-touch-open'), 'hover panel tap toggle');

const graphJs = fs.readFileSync(path.join(root, 'js/editor/editor-story-graph-edit.js'), 'utf8');
assert(graphJs.includes('isTouchUi'), 'story graph touch branch');

const visualJs = fs.readFileSync(path.join(root, 'js/editor/editor-visual-scene.js'), 'utf8');
assert(visualJs.includes('visualOpenClickActionPicker'), 'visual link picker');
assert(visualJs.includes('renderVisualTouchBar'), 'visual touch bar hook');

console.log(`\n---\nPassed: ${passed} Failed: ${failed}`);
process.exit(failed ? 1 : 0);
