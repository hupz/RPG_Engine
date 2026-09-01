#!/usr/bin/env node
/**
 * Phase D — UI Builder 2.0: screen types, smart widgets, anchors, presets
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
  return ctx;
}

console.log('Phase D — schema: screen types, anchors, smart widgets');

{
  const ctx = loadContexts();
  const PS = ctx.ProjectSchema;

  assert(PS.UI_SCREEN_TYPES.includes('journal'), 'screen type journal');
  assert(PS.UI_SCREEN_TYPES.includes('dialogue'), 'screen type dialogue');
  assert(PS.UI_ANCHORS.includes('bottom-right'), 'anchor bottom-right');
  assert(PS.UI_SMART_WIDGETS.includes('quest_tracker'), 'smart widget quest_tracker');

  const node = PS.applySmartWidgetDefaults({
    id: 'j1',
    kind: 'button',
    props: { widget: 'journal_button' },
    events: { click: [] }
  });
  assert(node.events.click[0].action === 'open_panel', 'journal_button sets open_panel');
  assert(node.events.click[0].params.panel === 'journal', 'journal panel param');

  const anchored = PS.resolveUiAnchoredTransform(
    { x: 0, y: 0, w: 0.1, h: 0.1, z: 1 },
    { anchor: 'top-right', marginX: 0.02, marginY: 0.03 }
  );
  assert(Math.abs(anchored.x - 0.88) < 0.001, 'top-right anchor resolves x');
  assert(Math.abs(anchored.y - 0.03) < 0.001, 'top-right anchor resolves y');

  const screen = PS.normalizeUiScreen({ screenType: 'hud', scope: 'persistent', nodes: [] }, 'hud1');
  assert(screen.screenType === 'hud', 'screenType normalized');
}

console.log('\nPhase D — runtime: presets, bindings, showIf');

{
  const ctx = loadContexts();
  const UI = ctx.UIRuntime;

  assert(UI.UI_SCREEN_TYPES.includes('pause'), 'runtime exports screen types');
  assert(UI.BINDINGS.includes('quest.activeTitle'), 'quest binding');
  assert(typeof UI.evaluateShowIf === 'function', 'evaluateShowIf exported');
  assert(typeof UI.resolveNodeTransform === 'function', 'resolveNodeTransform exported');

  const journal = UI.presets.journal_overlay();
  assert(journal.screenType === 'journal', 'journal preset type');
  assert(journal.nodes.some((n) => n.kind === 'panel'), 'journal has panel');

  const inv = UI.presets.inventory_overlay();
  assert(inv.screenType === 'inventory', 'inventory preset');

  const pause = UI.presets.pause_menu();
  assert(pause.screenType === 'pause', 'pause preset');

  const dlg = UI.presets.dialogue_overlay();
  assert(dlg.screenType === 'dialogue', 'dialogue preset');

  const icons = UI.presets.icon_hud();
  assert(icons.nodes.some((n) => n.props?.widget === 'journal_button'), 'icon_hud journal widget');
  assert(icons.nodes.some((n) => n.props?.widget === 'quest_tracker'), 'icon_hud quest tracker');

  const eng = {
    data: { ui: { screens: { t: { id: 't', scope: 'persistent', nodes: [] } } }, assets: {} },
    state: {
      hp: 10,
      maxHp: 20,
      gold: 5,
      level: 2,
      charName: 'Hero',
      questProgress: { main_q: { title: 'Find the relic', stage: 2 } },
      activeQuest: 'main_q'
    },
    actions: [],
    runAction(a, p) { this.actions.push({ a, p }); return Promise.resolve(true); }
  };

  assert(UI.resolveBinding(eng, 'quest.activeTitle') === 'Find the relic', 'quest title binding');
  assert(UI.resolveBinding(eng, 'quest.activeStage') === '2', 'quest stage binding');

  const hidden = UI.normalizeNode({
    id: 'h',
    kind: 'button',
    showIf: false,
    transform: { x: 0, y: 0, w: 0.1, h: 0.1, z: 1 },
    text: 'X',
    events: { click: [] }
  }, 0);
  eng.data.ui.screens.t.nodes = [hidden];
  UI.mountPersistent(eng);
  assert(!UI.resolveNodeTransform({ transform: { x: 0.1, y: 0.1, w: 0.2, h: 0.1 }, props: { layout: { anchor: 'bottom-right', marginX: 0.02, marginY: 0.02 } } }).x < 0.5, 'resolveNodeTransform uses anchor');
}

console.log('\nPhase D — editor wiring');

{
  const html = fs.readFileSync(path.join(root, 'editor.html'), 'utf8');
  assert(html.includes('editor-game-ui-phase-d.js'), 'editor loads phase-d module');

  const pd = fs.readFileSync(path.join(root, 'js/editor/editor-game-ui-phase-d.js'), 'utf8');
  assert(pd.includes('uiAddSmartWidget'), 'smart widget API');
  assert(pd.includes('uiSetNodeAnchor'), 'anchor API');
  assert(pd.includes('uiSetScreenType'), 'screen type API');
  assert(pd.includes('uiCopySelectedNodes'), 'copy API');
  assert(pd.includes('journal_button'), 'journal widget button');

  const ui = fs.readFileSync(path.join(root, 'js/editor/editor-game-ui.js'), 'utf8');
  assert(ui.includes('node.locked'), 'locked guard in ui transform');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
