#!/usr/bin/env node
/**
 * Phase 1.15 — Items, Rewards & Loot Authoring
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
  vm.runInContext(read('js/editor/editor-items-rewards-index.js'), ctx);
  return ctx.ItemsRewardsIndex || ctx.module.exports;
}

function loadCatalogAndIndex() {
  const ctx = {
    console,
    module: { exports: {} },
    globalThis: null,
    window: null,
    ACTION_REGISTRY: null,
    ItemsRewardsIndex: null,
    Editor: {}
  };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/actions/action-registry.js'), ctx);
  vm.runInContext(read('js/editor/editor-items-rewards-index.js'), ctx);
  vm.runInContext(read('js/editor/editor-action-catalog.js'), ctx);
  return ctx;
}

function loadValidator() {
  const ctx = {
    console,
    module: { exports: {} },
    globalThis: null,
    window: null,
    ACTION_REGISTRY: null,
    EditorActionCatalog: null,
    EditorConditionCatalog: null,
    ItemsRewardsIndex: null
  };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/actions/action-registry.js'), ctx);
  vm.runInContext(read('js/editor/editor-items-rewards-index.js'), ctx);
  vm.runInContext(read('js/editor/editor-action-catalog.js'), ctx);
  vm.runInContext(read('js/editor/editor-condition-catalog.js'), ctx);
  vm.runInContext(read('js/editor/editor-project-validator.js'), ctx);
  return ctx;
}

console.log('Phase 1.15 — wiring / isolation');

{
  const html = read('editor.html');
  assert(html.includes('editor-items-rewards-index.js'), 'index wired');
  assert(html.includes('editor-items-rewards-phase-115.js'), 'phase UX wired');
  const panel = read('js/editor/editor-items-panel.js');
  assert(panel.includes('stackable') && panel.includes('icon'), 'item panel has icon/stack');
  const inv = read('js/engine/inventory.js');
  assert(inv.length > 100, 'existing inventory module present');
  const ux = read('js/editor/editor-items-rewards-phase-115.js');
  assert(!/Inventory\.|new Inventory|createInventory/.test(ux), 'no second inventory system');
  assert(!ux.includes('ACTION_REGISTRY.execute'), 'UX does not execute registry');
}

console.log('\n1. reward macro JSON (registry actions only)');

{
  const IDX = loadIndex();
  const give = IDX.expandRewardMacro('give_item', { itemId: 'sword', count: 2 });
  assert(give.ok && give.steps.length === 1, 'give_item expands');
  assert(give.steps[0].action === 'add_item', 'give → add_item');
  assert(give.steps[0].params.itemId === 'sword' && give.steps[0].params.count === 2, 'give params');
  assert(give.macroId === null, 'no macroId on result');

  const take = IDX.expandRewardMacro('take_gold', { amount: 5 });
  assert(take.steps[0].action === 'remove_gold', 'take_gold → remove_gold');
  assert(take.steps[0].params.amount === 5, 'take gold amount');

  const loot = IDX.buildLootChestSteps({
    itemId: 'key_iron',
    gold: 40,
    questId: 'q_demo',
    questStage: '1',
    stripEmptyQuest: false
  });
  assert(loot.ok, 'loot chest builds');
  const actions = loot.steps.map((s) => s.action);
  assert(actions[0] === 'say', 'loot order: say first');
  assert(actions.includes('add_item'), 'loot has add_item');
  assert(actions.includes('add_gold'), 'loot has add_gold');
  assert(actions.includes('update_quest'), 'loot has quest update');
  assert(!actions.includes('loot_chest'), 'no macro id in steps');
  assert(!actions.includes('give_item'), 'no give_item macro id');

  const check = IDX.assertNoMacroIdsInSteps(loot.steps);
  assert(check.ok, 'assertNoMacroIds passes for expanded loot');
}

console.log('\n2. catalog macros aligned');

{
  const ctx = loadCatalogAndIndex();
  const macros = ctx.EditorActionCatalog.getActionMacros();
  const ids = macros.map((m) => m.id);
  assert(ids.includes('give_item') && ids.includes('take_item'), 'Give/Take Item macros');
  assert(ids.includes('give_gold') && ids.includes('take_gold'), 'Give/Take Gold macros');
  assert(ids.includes('loot_chest'), 'Loot Chest macro');
  const loot = macros.find((m) => m.id === 'loot_chest');
  assert(loot.steps.every((s) => s.action !== 'loot_chest'), 'loot steps are registry actions');
  assert(loot.steps.some((s) => s.action === 'say'), 'loot has say');
  assert(loot.steps.some((s) => s.action === 'update_quest'), 'loot has update_quest');
  const REG = ctx.ACTION_REGISTRY;
  loot.steps.forEach((s) => {
    assert(!!REG[s.action], 'loot step in registry: ' + s.action);
  });
}

console.log('\n3. item picker label + id');

{
  const IDX = loadIndex();
  assert(IDX.itemPickerLabel('iron_key', { name: 'Iron Key' }) === 'Iron Key (iron_key)', 'picker label+id');
  assert(IDX.itemPickerLabel('x', { name: 'x' }) === 'x', 'picker same name/id');

  const ctx = loadCatalogAndIndex();
  const opts = ctx.EditorActionCatalog.getEntityOptions('item', {
    items: { potion_hp: { name: 'Health Potion' }, bare: { name: 'bare' } }
  });
  const pot = opts.find((o) => o.id === 'potion_hp');
  assert(pot && pot.label.includes('Health Potion') && pot.label.includes('potion_hp'), 'catalog item option label+id');
}

console.log('\n4. missing item + invalid amount validation');

{
  const ctx = loadValidator();
  const PV = ctx.ProjectValidator;
  const data = {
    startScene: 'room',
    scenes: {
      room: {
        id: 'room',
        text: 'A chest.',
        choices: [],
        visual: {
          nodes: [{
            id: 'chest',
            kind: 'hotspot',
            events: {
              click: [
                { action: 'say', params: { text: 'Loot!' } },
                { action: 'add_item', params: { itemId: 'missing_sword', count: 1 } },
                { action: 'add_gold', params: { amount: -3 } },
                { action: 'add_item', params: { itemId: 'real_gem', count: 0 } }
              ]
            }
          }]
        }
      }
    },
    items: { real_gem: { name: 'Gem', type: 'misc' } },
    quests: {},
    npcs: {},
    enemies: {}
  };
  const report = PV.validateProject(data, { registry: ctx.ACTION_REGISTRY });
  const types = (report.errors || []).concat(report.warnings || []).map((i) => i.type);
  assert(types.includes('missing_item'), 'missing_item found');
  assert(types.includes('invalid_amount'), 'invalid_amount found');

  const badMacro = {
    startScene: 'room',
    scenes: {
      room: {
        id: 'room',
        text: 'x',
        choices: [],
        visual: {
          nodes: [{
            id: 'n1',
            kind: 'hotspot',
            events: { click: [{ action: 'give_item', params: { itemId: 'a' } }] }
          }]
        }
      }
    },
    items: { a: { name: 'A' } },
    quests: {},
    npcs: {},
    enemies: {}
  };
  const r2 = PV.validateProject(badMacro, { registry: ctx.ACTION_REGISTRY });
  const t2 = (r2.errors || []).concat(r2.warnings || []).map((i) => i.type);
  assert(t2.includes('macro_id_in_json'), 'macro id in JSON flagged');
}

console.log('\n5. multi-action order preserved');

{
  const IDX = loadIndex();
  const loot = IDX.expandRewardMacro('loot_chest', {
    itemId: 'coin',
    amount: 10,
    questId: 'q1',
    stripEmptyQuest: false
  });
  const order = loot.steps.map((s) => s.action);
  assert(JSON.stringify(order) === JSON.stringify([
    'say', 'add_item', 'add_gold', 'update_quest', 'set_flag'
  ]), 'loot macro order: say → item → gold → quest → flag');
}

console.log('\n6. item shape validation');

{
  const IDX = loadIndex();
  const bad = IDX.validateItemShape({ type: 'misc' }, 'x');
  assert(!bad.ok && bad.errors.some((e) => /name/i.test(e)), 'missing name invalid');
  const ok = IDX.validateItemShape({ name: 'Torch', type: 'misc', stackable: true, maxStack: 20 }, 'torch');
  assert(ok.ok, 'valid item shape');
}

console.log('\n7. gameplay chest compile optional quest');

{
  const ctx = { console, module: { exports: {} }, globalThis: null, window: null };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/editor/editor-gameplay-components-index.js'), ctx);
  const GP = ctx.GameplayComponentsIndex || ctx.module.exports;
  const noQ = GP.compileChestLoot({
    items: [{ itemId: 'gem', count: 1 }],
    gold: 5,
    sayText: 'Found it.'
  });
  const acts = noQ.nodes[0].events.click.map((s) => s.action);
  assert(acts.includes('say') && acts.includes('add_item') && acts.includes('add_gold'), 'chest rewards');
  assert(!acts.includes('update_quest'), 'no empty quest step');
  assert(!acts.includes('loot_chest') && !acts.includes('give_item'), 'compiled actions only');

  const withQ = GP.compileChestLoot({
    items: [{ itemId: 'gem', count: 1 }],
    gold: 5,
    questId: 'main',
    questStage: '2'
  });
  const acts2 = withQ.nodes[0].events.click.map((s) => s.action);
  assert(acts2.includes('update_quest'), 'quest when questId set');
  const uq = withQ.nodes[0].events.click.find((s) => s.action === 'update_quest');
  assert(uq.params.questId === 'main' && String(uq.params.stage) === '2', 'quest params');
}

console.log('\n---');
console.log('Passed:', passed, 'Failed:', failed);
process.exit(failed ? 1 : 0);
