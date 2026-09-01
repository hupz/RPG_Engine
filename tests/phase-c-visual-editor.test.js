#!/usr/bin/env node
/**
 * Phase C — Visual Scene Editor 2.0: shapes, hover, showIf mount, templates, wiring
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

function loadRuntimeContext(extra) {
  const ctx = Object.assign({
    console,
    document: undefined,
    window: null,
    globalThis: null,
    ConditionSystem: {
      evaluate(showIf) {
        if (showIf && showIf.flag) return !!showIf.flag;
        return true;
      }
    }
  }, extra || {});
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/project-schema.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/game-ui/visual-runtime.js'), 'utf8'), ctx);
  return ctx;
}

console.log('Phase C — schema: hotspot shapes + hover events');

{
  const ctx = loadRuntimeContext();
  const PS = ctx.ProjectSchema;

  assert(PS.HOTSPOT_SHAPES && PS.HOTSPOT_SHAPES.includes('circle'), 'HOTSPOT_SHAPES includes circle');
  assert(PS.HOTSPOT_SHAPES.includes('polygon'), 'HOTSPOT_SHAPES includes polygon');

  const ev = PS.normalizeEvents({
    click: [{ action: 'change_scene', params: { sceneId: 'a' } }],
    hover: [{ action: 'say', params: { text: 'hi' } }]
  });
  assert(ev.click?.[0]?.action === 'change_scene', 'click preserved');
  assert(ev.hover?.[0]?.action === 'say', 'hover normalized');

  const node = PS.normalizeVisualNode({
    id: 'hs1',
    kind: 'hotspot',
    props: { shape: 'circle' },
    transform: { x: 0.1, y: 0.2, w: 0.2, h: 0.2, z: 1 }
  }, 0, new Set());
  assert(node.props.shape === 'circle', 'visual node shape normalized');
}

console.log('\nPhase C — runtime: shapes, showIf mount, hover');

{
  const ctx = loadRuntimeContext();
  const VR = ctx.VisualRuntime;

  assert(typeof VR.pointInHotspotShape === 'function', 'pointInHotspotShape exported');
  assert(typeof VR.evaluateShowIf === 'function', 'evaluateShowIf exported');

  const circleNode = {
    kind: 'hotspot',
    transform: { x: 0.4, y: 0.4, w: 0.2, h: 0.2, z: 1 },
    props: { shape: 'circle' },
    visible: true,
    enabled: true,
    events: { click: [] }
  };
  assert(VR.pointInHotspotShape(0.5, 0.5, circleNode), 'center inside circle');
  assert(!VR.pointInHotspotShape(0.41, 0.41, circleNode), 'corner outside circle');

  const polyNode = {
    kind: 'hotspot',
    transform: { x: 0, y: 0, w: 1, h: 1, z: 1 },
    props: {
      shape: 'polygon',
      points: [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }, { x: 0.5, y: 0.8 }]
    },
    visible: true,
    enabled: true,
    events: { click: [] }
  };
  assert(VR.pointInHotspotShape(0.5, 0.4, polyNode), 'inside triangle');
  assert(!VR.pointInHotspotShape(0.1, 0.1, polyNode), 'outside triangle');

  const engine = {
    data: {
      scenes: {
        hidden: {
          visual: {
            mode: 'overlay',
            nodes: [
              { id: 'visible', kind: 'hotspot', showIf: true, transform: { x: 0, y: 0, w: 0.1, h: 0.1, z: 1 }, visible: true, enabled: true, events: {} },
              { id: 'hidden', kind: 'hotspot', showIf: false, transform: { x: 0.2, y: 0, w: 0.1, h: 0.1, z: 2 }, visible: true, enabled: true, events: {} }
            ]
          }
        }
      }
    },
    state: {}
  };

  VR.mount(engine, 'hidden', engine.data.scenes.hidden);
  const st = VR.getMountState();
  assert(st.nodeCount === 1, 'showIf false node excluded at mount');
  assert(st.nodeIds.indexOf('hidden') < 0, 'hidden node not mounted');

  const hoverNode = VR.normalizeNode({
    id: 'h1',
    kind: 'hotspot',
    transform: { x: 0, y: 0, w: 0.2, h: 0.2, z: 1 },
    events: { hover: [{ action: 'say', params: { text: 'tip' } }] },
    props: { tooltip: 'Hint', highlight: true, cursor: 'pointer' }
  });
  assert(hoverNode.events.hover?.[0]?.action === 'say', 'hover on normalized node');
}

console.log('\nPhase C — editor wiring + templates');

{
  const html = fs.readFileSync(path.join(root, 'editor.html'), 'utf8');
  assert(html.includes('editor-visual-scene-phase-c.js'), 'editor loads phase-c module');

  const pc = fs.readFileSync(path.join(root, 'js/editor/editor-visual-scene-phase-c.js'), 'utf8');
  assert(pc.includes('visualSetZoom'), 'zoom API');
  assert(pc.includes('visualCopySelected'), 'copy API');
  assert(pc.includes('visualPasteNodes'), 'paste API');
  assert(pc.includes('visualToggleLock'), 'lock API');
  assert(pc.includes('visualSetDrawShape'), 'draw shape API');
  assert(pc.includes('visualAddHoverAction'), 'hover action API');
  assert(pc.includes('visualFinishPolygonDraft'), 'polygon draft API');

  const vis = fs.readFileSync(path.join(root, 'js/editor/editor-visual-scene.js'), 'utf8');
  assert(vis.includes('node.locked'), 'locked guard in transform');

  const pack = fs.readFileSync(path.join(root, 'js/editor/editor-scene-template-pack.js'), 'utf8');
  assert(pack.includes("id: 'tpl_visual_village'"), 'visual village template');
  assert(pack.includes("id: 'tpl_visual_interior'"), 'visual interior template');
  assert(pack.includes('visual:'), 'templates include visual layer');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
