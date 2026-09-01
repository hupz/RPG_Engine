#!/usr/bin/env node
/**
 * Phase 1.16 — Combat Authoring
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
  vm.runInContext(read('js/editor/editor-combat-authoring-index.js'), ctx);
  return ctx.CombatAuthoringIndex || ctx.module.exports;
}

function loadStack() {
  const ctx = {
    console,
    module: { exports: {} },
    globalThis: null,
    window: null,
    ACTION_REGISTRY: null,
    CombatAuthoringIndex: null,
    ItemsRewardsIndex: null,
    Editor: {}
  };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/actions/action-registry.js'), ctx);
  vm.runInContext(read('js/editor/editor-combat-authoring-index.js'), ctx);
  vm.runInContext(read('js/editor/editor-action-catalog.js'), ctx);
  vm.runInContext(read('js/editor/editor-condition-catalog.js'), ctx);
  vm.runInContext(read('js/editor/editor-project-validator.js'), ctx);
  vm.runInContext(read('js/editor/editor-gameplay-components-index.js'), ctx);
  return ctx;
}

console.log('Phase 1.16 — wiring / no new combat engine');

{
  const html = read('editor.html');
  assert(html.includes('editor-combat-authoring-index.js'), 'index wired');
  assert(html.includes('editor-combat-authoring-phase-116.js'), 'phase wired');
  const combat = read('js/engine/combat.js');
  assert(combat.includes('startCombat'), 'existing combat engine present');
  const ux = read('js/editor/editor-combat-authoring-phase-116.js');
  assert(!/new CombatEngine|rewriteCombat|CombatRuntime\.create/.test(ux), 'no new combat engine');
  assert(ux.includes('start_combat'), 'uses start_combat');
}

console.log('\n1. combat action JSON');

{
  const IDX = loadIndex();
  const step = IDX.buildStartCombatAction({
    enemies: ['goblin', 'goblin', 'wolf'],
    nextScene: 'after_fight'
  });
  assert(step.action === 'start_combat', 'action id');
  assert(Array.isArray(step.params.enemies), 'enemies array');
  assert(step.params.enemies.length === 3, 'multi enemies');
  assert(step.params.nextScene === 'after_fight', 'nextScene');

  const parsed = IDX.parseEnemyIds('a, b; c');
  assert(parsed.join(',') === 'a,b,c', 'parse comma/semicolon');

  const macro = IDX.expandStartFightMacro({ enemies: ['boss'], nextScene: 'win' });
  assert(macro.macroId === null, 'no macro id on expand');
  assert(macro.steps[0].action === 'start_combat', 'Start Fight → start_combat');
  assert(!macro.steps.some((s) => s.action === 'start_fight'), 'no start_fight in JSON');
}

console.log('\n2. entity picker (enemy label + id)');

{
  const IDX = loadIndex();
  assert(
    IDX.enemyPickerLabel('forest_wolf', { name: 'Forest Wolf' }) === 'Forest Wolf (forest_wolf)',
    'enemy picker label+id'
  );
  const ctx = loadStack();
  const opts = ctx.EditorActionCatalog.getEntityOptions('enemy', {
    enemies: { forest_wolf: { name: 'Forest Wolf' } }
  });
  assert(opts[0].label.includes('Forest Wolf') && opts[0].label.includes('forest_wolf'), 'catalog enemy options');
  const def = ctx.EditorActionCatalog.getActionDefinition('start_combat');
  assert(def.params.some((p) => p.id === 'enemies' && p.type === 'enemies'), 'enemies param type');
  assert(def.params.some((p) => p.id === 'nextScene' && p.type === 'scene'), 'nextScene scene picker');
  const html = ctx.EditorActionCatalog.buildParamFieldsHtml(
    'start_combat',
    { enemies: ['forest_wolf'], nextScene: 'win' },
    { data: { enemies: { forest_wolf: { name: 'Forest Wolf' } }, scenes: { win: { title: 'Win' } } } }
  );
  assert(html.includes('multiple') && html.includes('forest_wolf'), 'multi enemy select HTML');
  assert(html.includes('nextScene') || html.includes('Victory'), 'victory scene field');
}

console.log('\n3. validation');

{
  const ctx = loadStack();
  const PV = ctx.ProjectValidator;
  const data = {
    startScene: 'camp',
    scenes: {
      camp: {
        id: 'camp',
        text: 'Ambush',
        choices: [],
        visual: {
          nodes: [{
            id: 'ambush',
            kind: 'hotspot',
            events: {
              click: [
                { action: 'say', params: { text: 'Fight!' } },
                {
                  action: 'start_combat',
                  params: { enemies: ['missing_orc'], nextScene: 'no_scene' }
                },
                {
                  action: 'start_combat',
                  params: { enemies: [], nextScene: 'camp' }
                }
              ]
            }
          }]
        }
      }
    },
    enemies: { goblin: { name: 'Goblin' } },
    items: {},
    quests: {},
    npcs: {}
  };
  const report = PV.validateProject(data, { registry: ctx.ACTION_REGISTRY });
  const types = (report.errors || []).concat(report.warnings || []).map((i) => i.type);
  assert(types.includes('missing_enemy'), 'missing enemy');
  assert(types.includes('missing_scene'), 'missing victory scene');
  assert(types.includes('invalid_combat_params'), 'empty enemies invalid');

  const ok = IDX_validate(ctx);
  assert(ok, 'valid combat params helper');
}

function IDX_validate(ctx) {
  const IDX = ctx.CombatAuthoringIndex;
  const r = IDX.validateCombatParams(
    { enemies: ['goblin'], nextScene: 'camp' },
    { enemies: { goblin: {} }, scenes: { camp: {} } }
  );
  return r.ok;
}

console.log('\n4. macros + multi-action integration');

{
  const ctx = loadStack();
  const macros = ctx.EditorActionCatalog.getActionMacros();
  const fight = macros.find((m) => m.id === 'start_fight');
  assert(fight && fight.label === 'Start Fight', 'Start Fight macro label');
  assert(fight.steps[0].action === 'start_combat', 'macro expands to registry');
  assert(!!ctx.ACTION_REGISTRY.start_combat, 'start_combat in registry');

  const IDX = ctx.CombatAuthoringIndex;
  const GP = ctx.GameplayComponentsIndex;
  const authored = IDX.buildEncounterAuthoring({
    name: 'Bandit Ambush',
    enemies: ['goblin', 'goblin'],
    nextScene: 'road_clear',
    victoryGold: 15
  });
  assert(authored.defeatSupported === false, 'defeat not on start_combat');
  const compiled = GP.compileEncounter(authored, {
    scenes: { road_clear: { id: 'road_clear', text: 'Clear', choices: [] } },
    enemies: { goblin: {} }
  });
  const click = compiled.nodes[0].events.click;
  assert(click[0].action === 'start_combat', 'encounter uses start_combat');
  assert(click[0].params.enemies.length === 2, 'multi enemies in encounter');
  assert(click[0].params.nextScene === 'road_clear', 'victory scene');
  assert(compiled.scenePatches && compiled.scenePatches.length === 1, 'victory gold on next scene');
  assert(compiled.scenePatches[0].appendEnter[0].action === 'add_gold', 'reward integration');

  // multi-action chain order
  const chain = [
    { action: 'say', params: { text: '!' } },
    IDX.buildStartCombatAction({ enemies: ['goblin'], nextScene: 'road_clear' }),
    { action: 'set_flag', params: { flag: 'fought', value: true } }
  ];
  assert(chain[1].action === 'start_combat', 'combat in multi-action middle');
  assert(chain.map((s) => s.action).join('>') === 'say>start_combat>set_flag', 'order preserved');
}

console.log('\n5. catalog validates');

{
  const ctx = loadStack();
  const v = ctx.EditorActionCatalog.validateCatalogAgainstRegistry(ctx.ACTION_REGISTRY);
  assert(v.ok, 'catalog vs registry: ' + (v.errors || []).join('; '));
}

console.log('\n---');
console.log('Passed:', passed, 'Failed:', failed);
process.exit(failed ? 1 : 0);
