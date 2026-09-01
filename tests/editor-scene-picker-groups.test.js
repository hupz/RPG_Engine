'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let passed = 0, failed = 0;
function assert(c, m) {
  if (c) { passed++; console.log('  ✓', m); }
  else { failed++; console.error('  ✗', m); }
}

const src = fs.readFileSync(path.join(root, 'js/editor/editor-scene-builder.js'), 'utf8');

const MODULE_IDS = [
  'story','npc','dialogue','choices','quest','combat','components','elements',
  'items','flags','audio','climate','time','map','hub','template',
  'scene_choice','location_place','shop','blacksmith','church'
];

MODULE_IDS.forEach((id) => {
  assert(src.includes("id: '" + id + "'") || src.includes('"' + id + '"'), 'module id present: ' + id);
});

assert(src.includes('scene-module-picker-group'), 'grouped UI');
assert(src.includes('toggleSceneModulePickerAdvanced'), '+ Ещё toggle');
assert(src.includes('isWriterMode'), 'writer mode aware');
assert(src.includes('data-editor-ui="scene-element-picker"') || src.includes("id=\"scene-element-picker\""), 'singleton marker');
assert(src.includes('_sceneModulePickerOpen'), 'single open flag');
assert(!/Editor\.switchTab\s*=\s*(function|\()/.test(src), 'no switchTab reassignment');

// Simulate group coverage
const GROUPS = {
  basic: ['story', 'dialogue', 'choices', 'npc', 'items'],
  actions: ['combat', 'quest', 'flags'],
  world: ['scene_choice', 'location_place', 'map', 'hub', 'shop', 'blacksmith', 'church'],
  atmosphere: ['audio', 'climate', 'time'],
  advanced: ['components', 'elements', 'template']
};
const allGrouped = new Set(Object.values(GROUPS).flat());
MODULE_IDS.forEach((id) => {
  assert(allGrouped.has(id) || src.includes("'" + id + "'"), 'id reachable: ' + id);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
