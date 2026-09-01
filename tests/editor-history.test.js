#!/usr/bin/env node
/**
 * EditorHistory — undo/redo contexts, limits, scene create/delete, project settings.
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

function makeData() {
  return {
    meta: { title: 'Test', version: '1.0', author: 'A' },
    startScene: 'hub',
    scenes: {
      hub: {
        id: 'hub',
        location: 'Hub',
        text: 'Hi',
        choices: [{ text: 'Go', to: 'tavern', icon: '➡️' }],
        visual: { mode: 'overlay', nodes: [{ id: 'n1', kind: 'hotspot', transform: { x: 0.1, y: 0.1, w: 0.1, h: 0.1 } }] }
      },
      tavern: { id: 'tavern', location: 'Tavern', text: 'Drink', choices: [] }
    },
    quests: {},
    npcs: {},
    items: {},
    classes: {}
  };
}

function bootHistory() {
  const ctx = {
    console: { log() {}, warn() {}, error() {}, info() {} },
    document: {
      readyState: 'complete',
      querySelector: () => null,
      getElementById: () => null,
      createElement: () => ({
        className: '', innerHTML: '', appendChild() {},
        addEventListener() {}, querySelector: () => null
      }),
      addEventListener() {}
    },
    structuredClone: (v) => JSON.parse(JSON.stringify(v)),
    Editor: {
      data: makeData(),
      currentTab: 'scenes',
      currentScene: 'hub',
      toast: { warning() {}, success() {}, info() {} },
      updateJSONPreview() {},
      renderSceneList() {},
      renderSceneEditor() {},
      renderVisualScenePanel() {},
      updateChoicePreview() {},
      updateProjectPanel() {},
      findSceneInboundReferences(sceneId) {
        const refs = [];
        const data = ctx.Editor.data;
        Object.entries(data.scenes || {}).forEach(([fromId, sc]) => {
          if (fromId === sceneId) return;
          (sc.choices || []).forEach((ch, i) => {
            if (ch?.to === sceneId) refs.push({ kind: 'choice', fromId, path: `scenes.${fromId}.choices[${i}].to`, label: 'choice.to' });
          });
        });
        return refs;
      }
    }
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/editor-history.js'), 'utf8'), ctx);
  return ctx;
}

console.log('EditorHistory — API');

{
  const src = fs.readFileSync(path.join(root, 'js/editor-history.js'), 'utf8');
  assert(src.includes('MAX_STEPS = 50'), '50 step limit');
  assert(src.includes('MAX_MEMORY_BYTES'), 'memory cap');
  assert(src.includes('FULL_SNAPSHOT_MAX_BYTES'), 'diff/slim strategy documented');
  assert(src.includes('editor-autosave.js'), 'autosave coordination comment');
  assert(src.includes('type: \'choice\''), 'choice context');
  assert(src.includes('type: \'visual\''), 'visual context');
  assert(src.includes('type: \'project\''), 'project context');
  assert(src.includes('createBlankScene'), 'scene create hook');
  assert(src.includes('deleteSceneSafe'), 'scene delete hook');
}

console.log('\nEditorHistory — scene create / undo');

{
  const ctx = bootHistory();
  const H = ctx.EditorHistory;
  const E = ctx.Editor;
  const beforeCount = Object.keys(E.data.scenes).length;
  E.data.scenes.new_room = { id: 'new_room', location: 'New', choices: [], text: '' };
  H.recordSceneCreate('new_room', { currentScene: 'hub' });
  assert(Object.keys(E.data.scenes).length === beforeCount + 1, 'scene created');
  H.undo();
  assert(!E.data.scenes.new_room, 'undo create removes scene');
  assert(Object.keys(E.data.scenes).length === beforeCount, 'scene count restored');
}

console.log('\nEditorHistory — scene delete / undo with inbound refs');

{
  const ctx = bootHistory();
  const H = ctx.EditorHistory;
  const E = ctx.Editor;
  const snap = H.makeSnapshot({ type: 'scene', id: 'tavern' });
  snap.meta = {
    op: 'delete',
    inboundSnapshot: H.captureSceneInboundSnapshot('tavern')
  };
  H.pushUndo({ type: 'scene', id: 'tavern' }, snap);
  delete E.data.scenes.tavern;
  assert(!E.data.scenes.tavern, 'tavern deleted');
  assert(E.data.scenes.hub.choices[0].to === 'tavern', 'inbound ref still points to tavern');
  H.undo();
  assert(!!E.data.scenes.tavern, 'undo restores deleted scene');
  assert(E.data.scenes.hub.choices[0].to === 'tavern', 'inbound ref intact after restore');
}

console.log('\nEditorHistory — project settings undo');

{
  const ctx = bootHistory();
  const H = ctx.EditorHistory;
  const E = ctx.Editor;
  E.currentTab = 'dashboard';
  const before = H.makeSnapshot({ type: 'project', id: 'settings' });
  E.applyProjectSettings = function (patch) {
    if (patch.title != null) E.data.meta.title = patch.title;
  };
  H.wrapImmediate('applyProjectSettings');
  E.applyProjectSettings({ title: 'Changed' });
  assert(E.data.meta.title === 'Changed', 'meta changed');
  H.undo();
  assert(E.data.meta.title === 'Test', 'undo restores project meta');
}

console.log('\nEditorHistory — choice card undo');

{
  const ctx = bootHistory();
  const H = ctx.EditorHistory;
  const E = ctx.Editor;
  E.currentScene = 'hub';
  const ctxChoice = { type: 'choice', id: 'hub:0' };
  const before = H.makeSnapshot(ctxChoice);
  E.data.scenes.hub.choices[0].text = 'Changed';
  H.recordMutation(ctxChoice, before);
  H.undo();
  assert(E.data.scenes.hub.choices[0].text === 'Go', 'choice text restored');
}

console.log('\nEditorHistory — visual nodes undo');

{
  const ctx = bootHistory();
  const H = ctx.EditorHistory;
  const E = ctx.Editor;
  const ctxVisual = { type: 'visual', id: 'hub' };
  const before = H.makeSnapshot(ctxVisual);
  E.data.scenes.hub.visual.nodes[0].transform.x = 0.9;
  H.recordMutation(ctxVisual, before);
  H.undo();
  assert(E.data.scenes.hub.visual.nodes[0].transform.x === 0.1, 'visual node position restored');
}

console.log('\nEditorHistory — memory / large project');

{
  const ctx = bootHistory();
  const H = ctx.EditorHistory;
  const E = ctx.Editor;
  for (let i = 0; i < 200; i++) {
    E.data.scenes['sc_' + i] = { id: 'sc_' + i, location: 'S' + i, text: 'x', choices: [] };
  }
  const bytesBefore = H._memoryBytes;
  for (let i = 0; i < 60; i++) {
    const id = 'sc_' + i;
    const snap = H.makeSnapshot({ type: 'scene', id });
    H.pushUndo({ type: 'scene', id }, snap);
  }
  const store = H.stores['scene:sc_0'];
  assert(store.undo.length <= 50, 'per-context max 50 steps');
  assert(H._memoryBytes <= H._memoryBytes + 1 && H._memoryBytes < 4.5 * 1024 * 1024, 'memory under 4.5MB cap');
  assert(H._memoryBytes >= bytesBefore, 'memory tracked');
}

console.log('\nEditorHistory — step counter');

{
  const ctx = bootHistory();
  const H = ctx.EditorHistory;
  H.pushUndo({ type: 'scene', id: 'hub' }, H.makeSnapshot({ type: 'scene', id: 'hub' }));
  H.pushUndo({ type: 'scene', id: 'hub' }, H.makeSnapshot({ type: 'scene', id: 'hub' }));
  assert(H.getAvailableUndoSteps() === 2, 'undo step count');
  assert(H.formatUndoCommandTitle() === 'Отменить (2)', 'command title with count');
}

console.log('\n---');
console.log('Passed:', passed, 'Failed:', failed);
process.exit(failed ? 1 : 0);
