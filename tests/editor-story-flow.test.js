#!/usr/bin/env node
/**
 * Story flow map — model, checklist, edge retarget, per-project workspace mode.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
function assert(c, m) {
  if (c) { passed++; console.log('  ✓', m); }
  else { failed++; console.error('  ✗', m); }
}

const storage = {};
const ctx = {
  console: { log() {}, info() {}, warn() {}, error() {} },
  localStorage: {
    getItem(k) { return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null; },
    setItem(k, v) { storage[k] = String(v); },
    removeItem(k) { delete storage[k]; }
  },
  document: {
    readyState: 'complete',
    head: { appendChild() {} },
    body: { appendChild() {}, querySelectorAll: () => [] },
    addEventListener() {},
    getElementById: (id) => ctx._els[id] || null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tag) => {
      const el = {
        tagName: tag.toUpperCase(),
        className: '',
        classList: { add() {}, remove() {}, toggle() {} },
        style: {},
        dataset: {},
        innerHTML: '',
        children: [],
        appendChild(c) { this.children.push(c); return c; },
        insertAdjacentElement() {},
        addEventListener() {},
        querySelector: () => null,
        querySelectorAll: () => []
      };
      if (tag === 'div') {
        Object.defineProperty(el, 'id', {
          set(v) { el._id = v; ctx._els[v] = el; },
          get() { return el._id || ''; }
        });
      }
      if (tag === 'style') return { id: '', textContent: '' };
      return el;
    }
  },
  setTimeout(fn) { if (typeof fn === 'function') fn(); }
};
ctx._els = {};
ctx.globalThis = ctx;
ctx.window = ctx;

let jsonPreview = '';
let dirty = false;

ctx.Editor = {
  data: {
    startScene: 'start',
    scenes: {
      start: {
        id: 'start',
        location: 'Старт',
        choices: [{ text: 'В деревню', to: 'village' }]
      },
      village: {
        id: 'village',
        location: 'Деревня',
        choices: [{ text: 'Дальше', to: 'end' }],
        sceneType: 'hub'
      },
      end: {
        id: 'end',
        location: 'Финал',
        choices: []
      },
      orphan: {
        id: 'orphan',
        location: 'Сирота',
        choices: []
      },
      broken_from: {
        id: 'broken_from',
        location: 'Битая',
        choices: [{ text: 'Никуда', to: 'missing_scene' }]
      }
    },
    quests: {}
  },
  currentTab: 'scenes',
  storyFlowMode: 'flow',
  escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); },
  escapeAttr(s) { return String(s == null ? '' : s).replace(/"/g, '&quot;'); },
  isFinalScene(sc) { return !sc?.choices?.length && !sc?.nextScene; },
  getGraphStartId() { return this.data.startScene || 'start'; },
  markDirty() { dirty = true; },
  updateJSONPreview() { jsonPreview = JSON.stringify(this.data); },
  renderSceneList() {},
  renderStoryFlow() {},
  switchTab() {},
  selectScene() {},
  openSceneFromGraph() {},
  confirmDialog: async () => true,
  toast: { success() {}, info() {}, warning() {} }
};

ctx.Editor.hooks = {
  replace() {},
  after() {}
};

vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-story-flow.js'), 'utf8'), ctx);

const E = ctx.Editor;

// --- buildStoryFlowModel ---
const model = E.buildStoryFlowModel();
assert(model.nodes.length === 5, 'model has 5 scene nodes');
assert(model.edges.some((e) => e.fromId === 'start' && e.toId === 'village' && e.kind === 'choice'), 'choice edge');
assert(model.edges.some((e) => e.fromId === 'broken_from' && e.broken), 'broken edge flagged');
assert(model.warnings.some((w) => w.kind === 'broken_link' && w.sceneId === 'broken_from'), 'broken warning structured');

const orphanNode = model.nodes.find((n) => n.id === 'orphan');
assert(orphanNode && orphanNode.inCount === 0, 'orphan has no incoming edges');

// --- checklist ---
const checklist = E.buildStoryFlowChecklist(model);
const orphansItem = checklist.find((it) => it.id === 'orphans');
assert(orphansItem && orphansItem.status === 'warn', 'orphan checklist warns');
assert(orphansItem.sceneIds.includes('orphan'), 'orphan in checklist sceneIds');

const brokenItem = checklist.find((it) => it.id === 'broken_links');
assert(brokenItem && brokenItem.status === 'error', 'broken links are error');
assert(brokenItem.sceneIds.includes('broken_from'), 'broken_from in broken checklist');

const startItem = checklist.find((it) => it.id === 'start_assigned');
assert(startItem && startItem.status === 'ok', 'start scene ok');

// --- retargetStoryFlowEdge: choice ---
dirty = false;
jsonPreview = '';
const choiceEdge = model.edges.find((e) => e.fromId === 'start' && e.kind === 'choice');
E.retargetStoryFlowEdge(choiceEdge, 'orphan').then((ok) => {
  assert(ok, 'retarget choice resolves true');
  assert(E.data.scenes.start.choices[0].to === 'orphan', 'choices.to updated in data');
  assert(dirty, 'markDirty called');
  assert(jsonPreview.includes('"orphan"'), 'JSON preview reflects new target');

  // --- retargetStoryFlowEdge: nextScene ---
  E.data.scenes.village.nextScene = 'end';
  const nextEdge = {
    fromId: 'village',
    toId: 'end',
    kind: 'next',
    choiceIndex: -1,
    label: 'далее'
  };
  return E.retargetStoryFlowEdge(nextEdge, 'start');
}).then((ok2) => {
  assert(ok2, 'retarget nextScene resolves true');
  assert(E.data.scenes.village.nextScene === 'start', 'nextScene updated');

  // --- per-project workspace mode ---
  Object.keys(storage).forEach((k) => delete storage[k]);
  E.setSceneWorkspaceViewMode('map');
  assert(E.getSceneWorkspaceViewMode() === 'map', 'workspace mode map');
  const key = E.getStoryWorkspaceProjectKey();
  assert(storage['rpg_story_ws_view_' + key] === 'map', 'mode stored per project key');
  E.setSceneWorkspaceViewMode('text');
  assert(E.getSceneWorkspaceViewMode() === 'text', 'workspace mode text');

  E.setStoryFlowMode('graph');
  assert(E.storyFlowMode === 'graph', 'map submode graph');
  assert(storage['rpg_story_map_submode_' + key] === 'graph', 'submode per project');

  // --- navigateToStoryFlowIssue ---
  let highlighted = null;
  E.highlightStoryFlowScenes = (ids) => { highlighted = ids; };
  E.navigateToStoryFlowIssue({ sceneId: 'broken_from', kind: 'broken_link' });
  assert(highlighted && highlighted[0] === 'broken_from', 'warning navigates to scene');

  // --- HTML has clickable edge attrs ---
  const card = E.renderStoryFlowNodeCard(model.nodes.find((n) => n.id === 'start'), model);
  assert(card.includes('data-sf-edge='), 'node card has clickable edge');
  assert(card.includes('sf-out-btn'), 'edge is button');

  const checklistHtml = E.renderStoryFlowChecklistHtml(model);
  assert(checklistHtml.includes('data-sf-check="orphans"'), 'checklist item clickable');
  assert(checklistHtml.includes('data-scene-ids='), 'checklist has scene ids');

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
