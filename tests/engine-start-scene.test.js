#!/usr/bin/env node
/**
 * Runtime startScene resolution — project.startScene vs legacy fallback
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

function loadResolver() {
  const ctx = { module: { exports: {} }, globalThis: null, window: null, console };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/project-schema.js'), 'utf8'), ctx);
  return ctx.ProjectSchema.resolveProjectStartSceneId;
}

console.log('engine-start-scene — resolveProjectStartSceneId');

const resolve = loadResolver();
assert(typeof resolve === 'function', 'exported');

// Explicit startScene wins over village_hub
{
  const id = resolve({
    startScene: 'prolog',
    scenes: {
      prolog: { id: 'prolog' },
      village_hub: { id: 'village_hub' },
      start: { id: 'start' }
    }
  });
  assert(id === 'prolog', 'configured startScene used');
}

// Demo visual_village: startScene village (not village_hub)
{
  const demo = JSON.parse(fs.readFileSync(path.join(root, 'data/demos/visual_village.json'), 'utf8'));
  const id = resolve(demo);
  assert(id === demo.startScene, 'visual_village demo unchanged');
}

// Legacy: no startScene → village_hub priority
{
  const id = resolve({
    scenes: {
      village_hub: { id: 'village_hub' },
      start: { id: 'start' },
      other: { id: 'other' }
    }
  });
  assert(id === 'village_hub', 'legacy village_hub fallback');
}

// Legacy: no startScene, no village_hub → start
{
  const id = resolve({
    scenes: { start: { id: 'start' }, x: { id: 'x' } }
  });
  assert(id === 'start', 'legacy start fallback');
}

// Broken startScene → legacy chain
{
  const id = resolve({
    startScene: 'missing',
    scenes: { village_hub: { id: 'village_hub' }, a: { id: 'a' } }
  });
  assert(id === 'village_hub', 'broken startScene falls back to village_hub');
}

// meta.startScene supported
{
  const id = resolve({
    meta: { startScene: 'intro' },
    scenes: { intro: { id: 'intro' }, village_hub: { id: 'village_hub' } }
  });
  assert(id === 'intro', 'meta.startScene used');
}

// Editor project panel exposes start scene field
{
  const cover = fs.readFileSync(path.join(root, 'js/editor/editor-cover.js'), 'utf8');
  assert(cover.includes('renderProjectStartSceneField'), 'project panel field');
  assert(cover.includes('setProjectStartScene'), 'setProjectStartScene API');
  assert(cover.includes('Стартовая сцена'), 'RU label');
}

// Validator warns on missing startScene
{
  const validator = fs.readFileSync(path.join(root, 'js/editor/editor-project-validator.js'), 'utf8');
  assert(validator.includes('startScene «'), 'validator startScene message');
}

console.log('\n' + (failed ? 'FAILED' : 'PASSED') + ': ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
