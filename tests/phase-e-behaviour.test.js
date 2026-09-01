#!/usr/bin/env node
/**
 * Phase E — Behaviour / No-code: enter/show events, variables catalog, unified picker
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

function loadContexts() {
  const ctx = { console, document: undefined, window: null, globalThis: null, module: { exports: {} } };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/project-schema.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/game-ui/ui-runtime.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/game-ui/visual-runtime.js'), 'utf8'), ctx);
  return ctx;
}

console.log('Phase E — schema: enter/show events + variables');

{
  const ctx = loadContexts();
  const PS = ctx.ProjectSchema;

  const ev = PS.normalizeEvents({
    enter: [{ action: 'set_flag', params: { flag: 'doorOpened', value: true } }],
    show: [{ action: 'say', params: { text: 'Hello' } }],
    exit: [{ action: 'change_scene', params: { sceneId: 'hub' } }]
  });
  assert(ev.enter?.[0]?.action === 'set_flag', 'enter event normalized');
  assert(ev.show?.[0]?.action === 'say', 'show event normalized');
  assert(ev.exit?.[0]?.action === 'change_scene', 'exit event normalized');

  const data = { variables: {} };
  const vid = PS.registerProjectVariable(data, 'visited_tavern', {
    name: 'Посещена таверна',
    defaultValue: false,
    description: 'test'
  });
  assert(vid === 'visited_tavern', 'registerProjectVariable id');
  const listed = PS.listProjectVariables(data);
  assert(listed.some((v) => v.id === 'visited_tavern' && v.name === 'Посещена таверна'), 'listProjectVariables');

  const scene = PS.normalizeSceneAuthoringEvents({
    events: { enter: [{ action: 'say', params: { text: 'Welcome' } }] }
  });
  assert(scene.events.enter[0].action === 'say', 'normalizeSceneAuthoringEvents');

  const screen = PS.normalizeUiScreen({
    screenType: 'hud',
    scope: 'persistent',
    events: { show: [{ action: 'open_panel', params: { panel: 'journal' } }] },
    nodes: []
  }, 'hud1');
  assert(screen.events.show[0].action === 'open_panel', 'UI screen show events normalized');

  PS.normalizeProjectAuthoring({
    meta: {},
    scenes: { s1: { text: 'x', events: { enter: [] } } },
    ui: { screens: {} },
    variables: { doorOpened: { name: 'Door', defaultValue: false } }
  });
  assert(data.variables.visited_tavern, 'variables preserved across calls');
}

console.log('\nPhase E — runtime: action chains + mount hooks');

{
  const ctx = loadContexts();
  const UI = ctx.UIRuntime;
  const VR = ctx.VisualRuntime;

  const eng = {
    data: { ui: { screens: {} }, assets: {} },
    state: { flags: {} },
    actions: [],
    runAction(a, p) {
      this.actions.push({ a, p });
      return Promise.resolve(true);
    }
  };

  const vEng = {
    data: { assets: {} },
    state: { flags: {} },
    actions: [],
    runAction(a, p) {
      this.actions.push({ a, p });
      return Promise.resolve(true);
    }
  };

  Promise.all([
    UI.runClick(eng, [{ action: 'say', params: { text: 'HUD up' } }]),
    VR.runClickActions(vEng, [{ action: 'set_flag', params: { flag: 'seen', value: true } }])
  ]).then(() => {
    assert(eng.actions.some((x) => x.a === 'say' && x.p.text === 'HUD up'), 'UI runClick executes show chain');
    assert(vEng.actions.some((x) => x.a === 'set_flag'), 'visual runClickActions executes enter chain');

    const vrSrc = fs.readFileSync(path.join(root, 'js/game-ui/visual-runtime.js'), 'utf8');
    assert(vrSrc.includes('events.enter'), 'visual-runtime mounts enter events');
    const uiSrc = fs.readFileSync(path.join(root, 'js/game-ui/ui-runtime.js'), 'utf8');
    assert(uiSrc.includes('screen.events.show'), 'ui-runtime mounts show events');

    console.log('\nPhase E — scene-manager enter hook');
    const sm = fs.readFileSync(path.join(root, 'js/engine/scene-manager.js'), 'utf8');
    assert(sm.includes('scene.events.enter'), 'scene-manager runs scene.events.enter');
    assert(sm.includes("source: 'scene_enter'"), 'scene enter source tag');

    console.log('\nPhase E — editor wiring');
    const html = fs.readFileSync(path.join(root, 'editor.html'), 'utf8');
    assert(html.includes('editor-action-phase-e.js'), 'editor loads phase-e action module');
    assert(html.includes('editor-variables.js'), 'editor loads variables module');
    assert(html.includes('id="tab-variables"'), 'variables tab content');

    const nav = fs.readFileSync(path.join(root, 'js/editor/editor-nav-layout.js'), 'utf8');
    assert(nav.includes("tab: 'variables'"), 'nav has variables subtab');

    const tabs = fs.readFileSync(path.join(root, 'js/editor/editor-core-tabs.js'), 'utf8');
    assert(tabs.includes("tab === 'variables'"), 'switchTab renders variables');

    const pe = fs.readFileSync(path.join(root, 'js/editor/editor-action-phase-e.js'), 'utf8');
    assert(pe.includes('openUnifiedActionPicker'), 'unified action picker API');
    assert(pe.includes('renderSceneEnterEventsPanel'), 'scene enter panel');
    assert(pe.includes('renderUiShowEventsPanel'), 'UI show panel');

    const vars = fs.readFileSync(path.join(root, 'js/editor/editor-variables.js'), 'utf8');
    assert(vars.includes('renderVariablesPanel'), 'variables panel API');
    assert(vars.includes('openAddProjectVariableModal'), 'modal create API');
    assert(!/\bprompt\s*\(/.test(vars), 'no prompt in variables module');
    assert(!/\bconfirm\s*\(/.test(vars), 'no confirm in variables module');
    assert(!/\balert\s*\(/.test(vars), 'no alert in variables module');

    const catalog = fs.readFileSync(path.join(root, 'js/editor/editor-action-catalog.js'), 'utf8');
    assert(catalog.includes("'variable'"), 'variable param type in catalog');
    assert(catalog.includes("type === 'variable'"), 'variable entity options');
    assert(catalog.includes('mark_visited'), 'mark_visited macro');

    console.log('\n---');
    console.log('Passed:', passed, 'Failed:', failed);
    process.exit(failed ? 1 : 0);
  });
}
