#!/usr/bin/env node
/**
 * Phase 1.11 — Village Quest vertical slice (structure + registry + isolation)
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

const demoPath = path.join(root, 'data/demos/visual_village.json');
assert(fs.existsSync(demoPath), 'visual_village.json exists');
const demo = JSON.parse(fs.readFileSync(demoPath, 'utf8'));

assert(demo.meta?.campaignId === 'visual_village', 'campaignId visual_village');
assert(demo.meta?.campaignId !== 'pf2e_mill', 'not Mill');
assert(String(demo.meta?.dataVersion || '').includes('visual-village'), 'dataVersion');

// ——— Scenes ———
['village', 'tavern', 'tavern_quest_started', 'tavern_quest_done', 'bandit_cleared', 'jack_shop', 'smithy', 'chapel'].forEach((id) => {
  assert(!!demo.scenes?.[id], 'scene ' + id);
});
assert(!!demo.scenes.village.visual, 'village visual');
assert(demo.startScene === 'village', 'startScene village');

const nodes = demo.scenes.village.visual.nodes || [];
const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

assert(!!byId.hs_tavern, 'hs_tavern');
assert(!!byId.hs_chest, 'hs_chest');
assert(!!byId.hs_enemy, 'hs_enemy');
assert(!!byId.img_journal, 'img_journal');
assert(!!byId.img_inventory, 'img_inventory');

// ——— Quest ———
const q = demo.quests?.missing_supplies;
assert(!!q, 'quest missing_supplies');
assert(Array.isArray(q.stages) && q.stages.length >= 3, 'quest stages array');
assert(!!demo.npcs?.innkeeper_ela, 'npc ela');
assert(!!demo.enemies?.village_thief, 'enemy village_thief');
assert(!!demo.items?.village_supplies, 'item village_supplies');

// ——— Chest multi-action order ———
const chest = byId.hs_chest;
const chestSteps = (chest.events && chest.events.click) || [];
assert(chestSteps.length >= 5, 'chest multi-action length');
assert(chestSteps[0].action === 'say', 'chest 1 say');
assert(chestSteps[1].action === 'add_item' && chestSteps[1].params?.itemId === 'village_supplies', 'chest 2 add_item');
assert(chestSteps[2].action === 'add_gold', 'chest 3 add_gold');
assert(chestSteps[3].action === 'update_quest' && chestSteps[3].params?.questId === 'missing_supplies', 'chest 4 update_quest');
assert(chestSteps[4].action === 'set_flag' && chestSteps[4].params?.flag === 'village_chest_looted', 'chest 5 set_flag');

// Order preserved under serialize
const serChest = JSON.parse(JSON.stringify(chestSteps));
assert(serChest.map((s) => s.action).join(',') === chestSteps.map((s) => s.action).join(','), 'chest order survives JSON');

// ——— Conditions ———
assert(!!chest.showIf?.all, 'chest showIf all');
assert(
  chest.showIf.all.some((r) => r.questMinStage?.questId === 'missing_supplies'),
  'chest requires quest'
);
assert(chest.showIf.all.some((r) => r.notFlag === 'village_chest_looted'), 'chest hidden after loot');

const enemy = byId.hs_enemy;
assert(!!enemy.showIf?.all, 'enemy showIf');
assert(enemy.showIf.all.some((r) => r.questMinStage?.stage === 1), 'enemy after stage 1');
assert((enemy.events.click || []).some((s) => s.action === 'start_combat'), 'enemy start_combat');

// ——— HUD ———
const hud = demo.ui?.screens?.rpg_hud;
assert(!!hud && hud.scope === 'persistent', 'rpg_hud persistent');
const hudActions = [];
(hud.nodes || []).forEach((n) => {
  (n.events?.click || []).forEach((s) => hudActions.push(s.action));
});
assert(hudActions.includes('open_panel'), 'hud open_panel');
assert(hudActions.includes('save_game'), 'hud save_game');
assert((hud.nodes || []).some((n) => n.kind === 'bar'), 'hud hp bar');
assert((hud.nodes || []).some((n) => n.kind === 'gold'), 'hud gold');

// ——— ACTION_REGISTRY ids used in demo ———
const used = new Set();
function walkActions(obj) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    obj.forEach(walkActions);
    return;
  }
  if (typeof obj.action === 'string') used.add(obj.action);
  Object.keys(obj).forEach((k) => walkActions(obj[k]));
}
walkActions(demo.scenes);
walkActions(demo.ui);

const regSrc = fs.readFileSync(path.join(root, 'js/actions/action-registry.js'), 'utf8');
const ctx = { console, window: {}, globalThis: null };
ctx.globalThis = ctx;
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(regSrc, ctx);
const registry = ctx.ACTION_REGISTRY;
assert(!!registry, 'ACTION_REGISTRY loaded');

used.forEach((id) => {
  assert(!!registry[id], 'registry has ' + id);
});

// ——— Condition evaluate shapes (no Editor) ———
vm.runInContext(
  fs.readFileSync(path.join(root, 'js/conditions.js'), 'utf8') +
    '\nif (typeof ConditionSystem !== "undefined") this.ConditionSystem = ConditionSystem;',
  ctx
);
const CS = ctx.ConditionSystem;
assert(CS.evaluate(chest.showIf, { inventory: [], gold: 0, flags: {}, questProgress: {} }) === false, 'chest hidden before quest');
assert(
  CS.evaluate(chest.showIf, {
    inventory: [],
    gold: 0,
    flags: {},
    questProgress: { missing_supplies: { status: 'active', stageIndex: 0 } }
  }) === true,
  'chest visible on stage 0'
);
assert(
  CS.evaluate(chest.showIf, {
    inventory: [],
    gold: 0,
    flags: { village_chest_looted: true },
    questProgress: { missing_supplies: { status: 'active', stageIndex: 0 } }
  }) === false,
  'chest hidden when looted'
);

// ——— Serialize whole project ———
const again = JSON.parse(JSON.stringify(demo));
assert(again.quests.missing_supplies.stages.length === q.stages.length, 'quest survives serialize');
assert(again.ui.screens.rpg_hud.nodes.length === hud.nodes.length, 'ui survives serialize');
assert(again.scenes.village.visual.nodes.find((n) => n.id === 'hs_chest').events.click.length === chestSteps.length, 'chest chain survives');

// ——— Runtime isolation ———
const visSrc = fs.readFileSync(path.join(root, 'js/game-ui/visual-runtime.js'), 'utf8');
const uiSrc = fs.readFileSync(path.join(root, 'js/game-ui/ui-runtime.js'), 'utf8');
assert(!/\bEditor\./.test(visSrc), 'VisualRuntime no Editor');
assert(!/\bEditor\./.test(uiSrc), 'UIRuntime no Editor');
assert(visSrc.includes('refreshBindings') || visSrc.includes('UIRuntime'), 'visual refreshes UI after click');
assert(visSrc.includes('navigatesAway') || visSrc.includes('mount('), 'visual remounts for showIf');

// Inline demo keeps campaign id
const inline = fs.readFileSync(path.join(root, 'js/demo-visual-village.js'), 'utf8');
assert(inline.includes('visual_village'), 'inline demo campaignId');
assert(inline.includes('missing_supplies'), 'inline has quest');
assert(inline.includes('hs_chest'), 'inline has chest');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
