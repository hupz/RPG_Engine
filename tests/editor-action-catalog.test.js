#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
let passed = 0, failed = 0;
function assert(c, m) {
  if (c) { passed++; console.log('  ✓', m); }
  else { failed++; console.error('  ✗', m); }
}

const ctx = { console, window: {}, globalThis: null, Editor: { data: {
  scenes: { tavern: { title: 'Таверна' }, village: { title: 'Деревня' } },
  items: { potion: { name: 'Зелье' } },
  quests: { q1: { name: 'Пропажа', stages: [{ id: 's1', name: 'Найти' }, { id: 's2', name: 'Вернуть' }] } },
  npcs: { jack: { name: 'Джек' } }
} } };
ctx.globalThis = ctx;
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/actions/action-registry.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-action-catalog.js'), 'utf8'), ctx);

const cat = ctx.EditorActionCatalog;
assert(!!cat, 'catalog module');
assert(Array.isArray(cat.ACTION_CATALOG) && cat.ACTION_CATALOG.length > 0, 'catalog non-empty');

const ids = cat.ACTION_CATALOG.map((e) => e.id);
const uniq = new Set(ids);
assert(uniq.size === ids.length, 'no duplicate ids');

const v = cat.validateCatalogAgainstRegistry(ctx.ACTION_REGISTRY);
assert(v.ok, 'all catalog ids in ACTION_REGISTRY: ' + (v.errors || []).join('; '));

ids.forEach((id) => {
  assert(!!ctx.ACTION_REGISTRY[id], 'registry has ' + id);
});

const writer = cat.getWriterActions();
assert(writer.every((e) => e.writerSafe === true), 'writer actions all writerSafe');
assert(writer.some((e) => e.id === 'change_scene'), 'writer has change_scene');
assert(writer.some((e) => e.id === 'open_panel'), 'writer has open_panel');
assert(writer.some((e) => e.id === 'add_item'), 'writer has add_item');
assert(!writer.some((e) => e.id === 'run_script'), 'writer hides run_script');
assert(!writer.some((e) => e.id === 'set_flag'), 'writer hides set_flag');

const adv = cat.getAdvancedActions();
assert(adv.some((e) => e.id === 'run_script'), 'advanced has run_script');
assert(adv.every((e) => e.writerSafe === false), 'advanced not writerSafe');

cat.ACTION_CATALOG.forEach((e) => {
  assert(typeof e.label === 'string' && e.label.length > 0, 'label: ' + e.id);
  assert(typeof e.writerSafe === 'boolean', 'writerSafe: ' + e.id);
  assert(Array.isArray(e.params), 'params array: ' + e.id);
  (e.params || []).forEach((p) => {
    assert(cat.PARAM_TYPES.includes(p.type), 'param type ' + p.type + ' on ' + e.id);
  });
  assert(cat.CATALOG_CATEGORIES.some((c) => c.id === e.category), 'category: ' + e.id);
});

const cs = cat.getActionDefinition('change_scene');
assert(cs && cs.params.some((p) => p.type === 'scene' && p.id === 'sceneId'), 'scene param');
const ai = cat.getActionDefinition('add_item');
assert(ai && ai.params.some((p) => p.type === 'item'), 'item param');
const uq = cat.getActionDefinition('update_quest');
assert(uq && uq.params.some((p) => p.type === 'quest'), 'quest param');

const scenes = cat.getEntityOptions('scene', ctx.Editor.data);
assert(scenes.some((s) => s.id === 'tavern'), 'entity scene picker data');
const items = cat.getEntityOptions('item', ctx.Editor.data);
assert(items.some((s) => s.id === 'potion'), 'entity item picker data');
const quests = cat.getEntityOptions('quest', ctx.Editor.data);
assert(quests.some((s) => s.id === 'q1'), 'entity quest picker data');
const stages = cat.getQuestStageOptions('q1', ctx.Editor.data);
assert(stages.length >= 2, 'quest stages');

// Catalog does not define execute
assert(!cat.ACTION_CATALOG.some((e) => typeof e.execute === 'function'), 'no execute on catalog');

// Runtime isolation: ui-runtime has no Editor
const rt = fs.readFileSync(path.join(root, 'js/game-ui/ui-runtime.js'), 'utf8');
assert(!/\bEditor\./.test(rt), 'UIRuntime no Editor');

// Editor APIs attached when Editor present
assert(typeof ctx.Editor.getActionCatalog === 'function', 'Editor.getActionCatalog');
assert(typeof ctx.Editor.getWriterActions === 'function', 'Editor.getWriterActions');
assert(typeof ctx.Editor.getActionDefinition === 'function', 'Editor.getActionDefinition');
assert(typeof ctx.Editor.getActionCategories === 'function', 'Editor.getActionCategories');

const cats = cat.getActionCategories();
assert(cats.some((c) => c.id === 'navigation'), 'categories include navigation');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
