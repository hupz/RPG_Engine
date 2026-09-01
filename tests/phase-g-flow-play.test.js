#!/usr/bin/env node
/**
 * Phase G — Scene Flow & Play debug
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

console.log('Phase G — schema: collectSceneFlowEdges');

{
  const ctx = { console, module: { exports: {} }, globalThis: null, window: null };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/project-schema.js'), 'utf8'), ctx);
  const PS = ctx.ProjectSchema;

  assert(typeof PS.collectSceneFlowEdges === 'function', 'collectSceneFlowEdges exported');

  const scenes = {
    village: {
      text: 'Village',
      choices: [{ text: 'Tavern', to: 'tavern' }],
      visual: {
        nodes: [{
          id: 'hs_shop',
          kind: 'hotspot',
          props: { label: 'Shop' },
          events: { click: [{ action: 'change_scene', params: { sceneId: 'shop' } }] }
        }]
      },
      events: { enter: [{ action: 'change_scene', params: { sceneId: 'tavern' } }] }
    },
    tavern: { text: 'Tavern' },
    shop: { text: 'Shop' }
  };

  const edges = PS.collectSceneFlowEdges(scenes.village, 'village', { scenes });
  assert(edges.some((e) => e.kind === 'choice' && e.toId === 'tavern'), 'choice edge');
  assert(edges.some((e) => e.kind === 'visual_click' && e.toId === 'shop'), 'visual click edge');
  assert(edges.some((e) => e.kind === 'scene_enter'), 'scene enter edge');
  assert(edges.filter((e) => e.kind === 'visual_click')[0].nodeId === 'hs_shop', 'nodeId on visual edge');
}

console.log('\nPhase G — flow map extension');

{
  const flow = fs.readFileSync(path.join(root, 'js/editor/editor-flow-phase-g.js'), 'utf8');
  assert(flow.includes('buildStoryFlowModel'), 'wraps buildStoryFlowModel');
  assert(flow.includes('buildEditableGraphModel'), 'wraps buildEditableGraphModel');
  assert(flow.includes('visualLinks'), 'visual badge on nodes');
  assert(flow.includes('collectProjectFlowEdges'), 'Editor API');
}

console.log('\nPhase G — embedded play + debug');

{
  const play = fs.readFileSync(path.join(root, 'js/editor/editor-play-phase-g.js'), 'utf8');
  assert(play.includes('startEmbeddedPlay'), 'embedded play API');
  assert(play.includes('embedded-play-iframe'), 'iframe panel');
  assert(play.includes('play-debug-panel'), 'debug panel');
  assert(play.includes('rpg_editor_play_debug'), 'postMessage channel');

  const session = fs.readFileSync(path.join(root, 'js/editor-test-session.js'), 'utf8');
  assert(session.includes('emitPlayDebugEvent'), 'debug emit in test session');
  assert(session.includes('installPlayDebugHooks'), 'runAction hook');
  assert(session.includes('embedded'), 'embedded mode detect');

  const html = fs.readFileSync(path.join(root, 'editor.html'), 'utf8');
  assert(html.includes('editor-flow-phase-g.js'), 'editor loads flow phase-g');
  assert(html.includes('editor-play-phase-g.js'), 'editor loads play phase-g');
}

console.log('\n---');
console.log('Passed:', passed, 'Failed:', failed);
process.exit(failed ? 1 : 0);
