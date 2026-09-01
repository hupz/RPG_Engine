#!/usr/bin/env node
/**
 * Phase 1.17 — Story Flow & Project Graph
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

function loadIndex() {
  const ctx = { console, module: { exports: {} }, globalThis: null, window: null };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/editor/editor-project-graph-index.js'), ctx);
  return ctx.ProjectGraphIndex || ctx.module.exports;
}

function loadWithValidator() {
  const ctx = {
    console,
    module: { exports: {} },
    globalThis: null,
    window: null,
    ACTION_REGISTRY: null,
    ProjectSchema: null,
    EditorContentIndex: null,
    ProjectGraphIndex: null
  };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/project-schema.js'), ctx);
  vm.runInContext(read('js/editor/editor-content-index.js'), ctx);
  vm.runInContext(read('js/actions/action-registry.js'), ctx);
  vm.runInContext(read('js/editor/editor-action-catalog.js'), ctx);
  vm.runInContext(read('js/editor/editor-condition-catalog.js'), ctx);
  vm.runInContext(read('js/editor/editor-project-validator.js'), ctx);
  vm.runInContext(read('js/editor/editor-project-graph-index.js'), ctx);
  return ctx;
}

console.log('Phase 1.17 — wiring / no runtime graph');

{
  const html = read('editor.html');
  assert(html.includes('editor-project-graph-index.js'), 'index wired');
  assert(html.includes('editor-project-graph-phase-117.js'), 'phase wired');
  const ux = read('js/editor/editor-project-graph-phase-117.js');
  assert(!/SceneManager|VisualRuntime|QuestRuntime\.|new GraphRuntime/.test(ux), 'no runtime graph dependency');
  assert(ux.includes('ProjectValidator'), 'uses ProjectValidator');
  assert(read('js/editor/editor-story-graph-edit.js').includes('storyGraphZoom'), 'existing zoom');
  assert(read('js/editor/editor-story-graph-edit.js').includes('panX'), 'existing pan');
}

console.log('\n1. graph extraction');

{
  const IDX = loadIndex();
  const data = {
    startScene: 'hub',
    scenes: {
      hub: {
        id: 'hub',
        text: 'Hub',
        choices: [{ text: 'Go forest', to: 'forest' }]
      },
      forest: {
        id: 'forest',
        text: 'Trees',
        visual: {
          nodes: [{
            id: 'hs1',
            kind: 'hotspot',
            events: {
              click: [{ action: 'change_scene', params: { sceneId: 'cave' } }]
            }
          }]
        },
        choices: []
      },
      cave: { id: 'cave', text: 'Dark', choices: [] },
      island: { id: 'island', text: 'Orphan island', choices: [] }
    }
  };
  const g = IDX.extractProjectGraph(data);
  assert(g.nodes.length === 4, '4 scene nodes');
  assert(g.edges.some((e) => e.fromId === 'hub' && e.toId === 'forest'), 'choice transition');
  assert(g.edges.some((e) => e.fromId === 'forest' && e.toId === 'cave'), 'visual change_scene');
  assert(g.startScene === 'hub', 'startScene');
  const cave = g.nodes.find((n) => n.id === 'cave');
  assert(cave && cave.deadEnd === true, 'cave is dead end (no outs)');
}

console.log('\n2. transition detection (ProjectSchema)');

{
  const ctx = loadWithValidator();
  const IDX = ctx.ProjectGraphIndex;
  const data = {
    startScene: 'a',
    scenes: {
      a: {
        text: 'A',
        choices: [{ text: 'B', to: 'b' }],
        nextScene: 'c',
        visual: {
          nodes: [{
            id: 'x',
            events: { click: [{ action: 'start_combat', params: { enemies: ['e'], nextScene: 'b' } }] }
          }]
        }
      },
      b: { text: 'B', choices: [] },
      c: { text: 'C', choices: [] }
    },
    enemies: { e: { name: 'E' } }
  };
  const edges = IDX.collectEdges(data);
  const kinds = edges.map((e) => e.kind);
  assert(kinds.includes('choice'), 'choice edge');
  assert(kinds.includes('next') || kinds.includes('nextScene'), 'nextScene edge');
  assert(kinds.some((k) => String(k).indexOf('visual_') === 0), 'visual edge');
}

console.log('\n3. unreachable integration (validator, not duplicate BFS)');

{
  const ctx = loadWithValidator();
  const IDX = ctx.ProjectGraphIndex;
  const PV = ctx.ProjectValidator;
  const data = {
    startScene: 'hub',
    scenes: {
      hub: { text: 'H', choices: [{ text: 'f', to: 'forest' }] },
      forest: { text: 'F', choices: [] },
      island: { text: 'I', choices: [] },
      // pointed at but not from start
      secret: { text: 'S', choices: [] },
      side: { text: 'Side', choices: [{ text: 'secret', to: 'secret' }] }
    }
  };
  const report = PV.validateProject(data, { registry: ctx.ACTION_REGISTRY });
  const types = (report.warnings || []).concat(report.errors || []).map((i) => i.type);
  assert(types.includes('orphan_scene') || types.includes('unreachable_scene'), 'validator flags reachability');

  const view = IDX.buildAnalyzedGraph(data, report, 'all');
  assert(view.analysis, 'analysis present');
  assert(
    view.analysis.orphan.includes('island') || view.analysis.unreachable.includes('island'),
    'island annotated from validator'
  );
  assert(
    view.analysis.unreachable.includes('secret') || view.analysis.orphan.includes('side') ||
      view.analysis.unreachable.includes('side'),
    'side/secret reachability from validator'
  );
  // Ensure we did not invent a second engine — annotation reads issue types
  const idxSrc = read('js/editor/editor-project-graph-index.js');
  assert(idxSrc.includes('annotateWithValidatorReport'), 'annotates from report');
  assert(!/function buildReachableSet/.test(idxSrc), 'index does not redefine reachability BFS');
}

console.log('\n4. broken links');

{
  const IDX = loadIndex();
  const data = {
    startScene: 'hub',
    scenes: {
      hub: {
        text: 'H',
        choices: [{ text: 'gone', to: 'missing_scene_xyz' }]
      }
    }
  };
  const g = IDX.extractProjectGraph(data);
  assert(g.brokenEdges.length >= 1, 'broken edge detected');
  assert(g.brokenEdges[0].toId === 'missing_scene_xyz', 'broken target id');
  const annotated = IDX.annotateWithValidatorReport(g, {
    errors: [{
      type: 'missing_scene',
      severity: 'error',
      sceneId: 'hub',
      targetId: 'missing_scene_xyz',
      message: 'missing'
    }]
  });
  const hub = annotated.nodes.find((n) => n.id === 'hub');
  assert(hub.hasErrors, 'source marked hasErrors');
  assert(annotated.analysis.brokenLinks.length >= 1, 'analysis brokenLinks');
}

console.log('\n5. filters');

{
  const IDX = loadIndex();
  const data = {
    startScene: 't1',
    scenes: {
      t1: { text: 'Text only', choices: [{ to: 'v1', text: 'go' }] },
      v1: {
        text: '',
        visual: { nodes: [{ id: 'h', kind: 'hotspot', events: { click: [] } }] },
        choices: []
      },
      bad: { text: 'Bad', choices: [{ to: 'nope', text: 'x' }] }
    }
  };
  const g = IDX.extractProjectGraph(data);
  IDX.annotateWithValidatorReport(g, {
    warnings: [{ type: 'orphan_scene', severity: 'warning', entityId: 'bad', sceneId: 'bad', entityType: 'scene' }]
  });
  const text = IDX.filterProjectGraph(g, 'text');
  assert(text.nodes.every((n) => n.kind === 'text'), 'TEXT filter');
  const visual = IDX.filterProjectGraph(g, 'visual');
  assert(visual.nodes.some((n) => n.id === 'v1'), 'Visual filter keeps v1');
  assert(!visual.nodes.some((n) => n.id === 't1'), 'Visual filter drops pure text');
  const orphans = IDX.filterProjectGraph(g, 'orphan');
  assert(orphans.nodes.some((n) => n.id === 'bad'), 'orphan filter');
  const errors = IDX.filterProjectGraph(g, 'errors');
  assert(errors.nodes.some((n) => n.hasErrors || n.orphan), 'errors filter');
}

console.log('\n6. open scene / select (existing APIs)');

{
  const edit = read('js/editor/editor-story-graph-edit.js');
  assert(edit.includes('openSceneFromGraph'), 'open scene on graph');
  assert(edit.includes('selectedNode'), 'select node');
  const graph = read('js/editor/editor-graph.js');
  assert(graph.includes('openSceneFromGraph'), 'mermaid open scene');
}

console.log('\n---');
console.log('Passed:', passed, 'Failed:', failed);
process.exit(failed ? 1 : 0);
