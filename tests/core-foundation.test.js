#!/usr/bin/env node
/**
 * Phase 1.1 — EngineCore unit tests (no DOM, no Editor, no QuestRuntime).
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

const ctx = { console, module: { exports: {} }, exports: {}, globalThis: null };
ctx.globalThis = ctx;
ctx.window = ctx;
vm.createContext(ctx);
for (const f of [
  'js/core/event-bus.js',
  'js/core/project.js',
  'js/core/runtime-context.js',
  'js/core/engine-app.js',
  'js/core/contracts.js',
  'js/core/legacy-facade-map.js'
]) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}

const { createEventBus, createProject, createRuntimeContext, createEngineApp, contracts } =
  ctx.EngineCore;

// EventBus isolation
{
  const a = createEventBus();
  const b = createEventBus();
  let n = 0;
  a.on('x', () => {
    n++;
  });
  b.emit('x');
  assert(n === 0, 'separate buses do not share listeners');
  a.emit('x');
  assert(n === 1, 'bus A receives');
}

// clear
{
  const bus = createEventBus();
  let n = 0;
  bus.on('e', () => {
    n++;
  });
  bus.clear('e');
  bus.emit('e');
  assert(n === 0, 'clear removes listeners');
}

// Project defaults
{
  const p = createProject({});
  assert(p.projectType === 'text', 'default projectType text');
  assert(p.quests && typeof p.quests === 'object', 'quests object');
}

// RuntimeContext data accessor
{
  const project = createProject({ items: { sword: {} } });
  const rt = createRuntimeContext({ project, state: { gold: 1 } });
  assert(rt.data.items.sword, 'runtime.data → project.data');
  assert(rt.state.gold === 1, 'runtime state');
}

// EngineApp emits lifecycle
{
  const bus = createEventBus();
  const app = createEngineApp({ bus, project: createProject({}) });
  let starts = 0;
  let stops = 0;
  bus.on('app:start', () => {
    starts++;
  });
  bus.on('app:stop', () => {
    stops++;
  });
  app.start();
  app.start(); // idempotent
  assert(starts === 1, 'start emits once');
  app.stop();
  assert(stops === 1, 'stop emits');
}

// Contracts frozen lists
assert(contracts.SceneKind.TEXT === 'text', 'SceneKind.TEXT');
assert(Array.isArray(contracts.GameMode_FIELDS), 'GameMode fields');
assert(contracts.TextSceneAdapterContract.name === 'TextSceneAdapter', 'TextScene adapter name');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
