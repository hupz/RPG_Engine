#!/usr/bin/env node
/**
 * Phase 1.1 — static architecture boundary checks + core presence.
 * Script-tag project: no ESM import graph; scan source text.
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

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function walkJs(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkJs(p, out);
    else if (ent.name.endsWith('.js')) out.push(p);
  }
  return out;
}

// --- Core foundation files exist ---
const coreFiles = [
  'js/core/event-bus.js',
  'js/core/project.js',
  'js/core/runtime-context.js',
  'js/core/engine-app.js',
  'js/core/contracts.js',
  'js/core/legacy-facade-map.js',
  'docs/architecture.md'
];
for (const f of coreFiles) {
  assert(fs.existsSync(path.join(root, f)), 'exists ' + f);
}

// --- Core must not reference Editor or DOM APIs ---
const coreDir = path.join(root, 'js/core');
const coreSources = walkJs(coreDir);
for (const abs of coreSources) {
  const rel = path.relative(root, abs).replace(/\\/g, '/');
  const src = fs.readFileSync(abs, 'utf8');
  assert(!/\bwindow\.Editor\b/.test(src), rel + ' has no window.Editor');
  assert(!/editor\/editor-/.test(src), rel + ' has no editor/ path ref');
  assert(!/\bdocument\./.test(src), rel + ' has no document.*');
  assert(!/\bdocument\b\s*\./.test(src), rel + ' has no document access');
  // innerHTML / getElementById
  assert(!/\binnerHTML\b/.test(src), rel + ' has no innerHTML');
  assert(!/\bgetElementById\b/.test(src), rel + ' has no getElementById');
}

// --- QuestRuntime must not depend on Editor ---
const qr = read('js/quests/quest-runtime.js');
assert(!/\bwindow\.Editor\b/.test(qr), 'quest-runtime.js has no window.Editor');
assert(!/editor\/editor-/.test(qr), 'quest-runtime.js has no editor/ path');
assert(!/\bEditor\.(switchTab|renderAll|hooks)\b/.test(qr), 'quest-runtime.js has no Editor API calls');

// --- Quest events / tasks ---
for (const f of ['js/quests/quest-events.js', 'js/quests/task-base.js', 'js/quests/task-types.js']) {
  const s = read(f);
  assert(!/\bwindow\.Editor\b/.test(s), f + ' has no window.Editor');
}

// --- Production HTML should not load editor modules as game runtime ---
const prod = read('index.prod.html');
assert(!/js\/editor\/editor-core\.js/.test(prod), 'index.prod.html does not load editor-core');
assert(!/js\/editor\/editor-hooks\.js/.test(prod), 'index.prod.html does not load editor-hooks');
assert(
  /js\/quests\/quest-runtime\.js/.test(prod) || /dist\/index-prod\.bundle\.js/.test(prod),
  'index.prod.html loads quest-runtime (direct or index-prod bundle)'
);

// --- Load core in VM and exercise APIs ---
const ctx = {
  console,
  module: { exports: {} },
  exports: {},
  globalThis: null
};
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

assert(!!ctx.EngineCore, 'EngineCore global attached');
assert(typeof ctx.EngineCore.createEventBus === 'function', 'createEventBus');
assert(typeof ctx.EngineCore.createProject === 'function', 'createProject');
assert(typeof ctx.EngineCore.createRuntimeContext === 'function', 'createRuntimeContext');
assert(typeof ctx.EngineCore.createEngineApp === 'function', 'createEngineApp');
assert(!!ctx.EngineCore.contracts, 'contracts');
assert(!!ctx.EngineCore.LEGACY_GAMEENGINE_API_MAP, 'legacy map');

const bus = ctx.EngineCore.createEventBus();
let hits = 0;
const h = () => {
  hits++;
};
bus.on('t', h);
bus.emit('t', {});
bus.emit('t', {});
assert(hits === 2, 'EventBus emit delivers');
bus.off('t', h);
bus.emit('t', {});
assert(hits === 2, 'EventBus off works');

const project = ctx.EngineCore.createProject(
  { scenes: { a: { id: 'a' } }, meta: { engineVersion: '1.1.0' } },
  { name: 'Test' }
);
assert(project.version === '1.1.0', 'Project.version');
assert(project.scenes.a.id === 'a', 'Project.scenes');

const app = ctx.EngineCore.createEngineApp({ project });
assert(!app.isStarted(), 'app starts stopped');
app.start();
assert(app.isStarted(), 'app started');
const rt = app.createDefaultRuntime({ scene: 'a' });
assert(rt.state.scene === 'a', 'RuntimeContext state');
assert(app.getRuntime() === rt, 'app.getRuntime');
app.stop();
assert(!app.isStarted(), 'app stopped');
assert(app.getRuntime() == null, 'runtime cleared on stop');

assert(
  ctx.EngineCore.contracts.GameUI_METHODS.indexOf('showScene') !== -1,
  'GameUI contract lists showScene'
);
assert(
  ctx.EngineCore.contracts.IRenderer_METHODS.indexOf('render') !== -1,
  'IRenderer contract lists render'
);
assert(
  ctx.EngineCore.LEGACY_GAMEENGINE_API_MAP.showScene === 'FACADE',
  'showScene mapped FACADE'
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
