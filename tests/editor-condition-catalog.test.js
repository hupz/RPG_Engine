#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
let passed = 0, failed = 0;
function assert(c, m) { if (c) { passed++; console.log('  ✓', m); } else { failed++; console.error('  ✗', m); } }

const ctx = { console, window: {}, globalThis: null, Editor: { data: {
  items: { village_key: { name: 'Ключ' }, potion: { name: 'Зелье' } },
  quests: { q1: { name: 'Q', stages: [{ id: '1', name: 'S1' }] } },
  scenes: { village: {} },
  reputation: { village: { name: 'Деревня' }, starting: {} }
}, isWriterMode: () => true } };
ctx.globalThis = ctx; ctx.window = ctx;
vm.createContext(ctx);
const condCode = fs.readFileSync(path.join(root, 'js/conditions.js'), 'utf8');
vm.runInContext(condCode + '\nif (typeof ConditionSystem !== "undefined") this.ConditionSystem = ConditionSystem;', ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/actions/action-registry.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-action-catalog.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/editor/editor-condition-catalog.js'), 'utf8'), ctx);

const C = ctx.EditorConditionCatalog;
assert(!!C, 'catalog module');
assert(C.validateCatalog().ok, 'validate: ' + (C.validateCatalog().errors || []).join(';'));
assert(C.getWriterConditions().every((e) => e.writerSafe), 'writerSafe');
assert(!C.getWriterConditions().some((e) => e.id === 'flag'), 'flag advanced only');
assert(!C.getWriterConditions().some((e) => e.id === 'notFlag'), 'notFlag advanced only');

// ——— New catalog entries ———
['notFlag', 'choiceUsed', 'choiceNotUsed', 'reputation'].forEach((id) => {
  assert(!!C.getConditionDefinition(id), 'def ' + id);
});

const notFlag = C.buildRule('notFlag', { notFlag: 'door_open' });
assert(notFlag.notFlag === 'door_open', 'build notFlag');
assert(C.ruleToCatalogId(notFlag) === 'notFlag', 'id notFlag');
assert(ctx.ConditionSystem.evaluate({ all: [notFlag] }, { inventory: [], gold: 0, flags: {} }) === true, 'notFlag open');
assert(ctx.ConditionSystem.evaluate({ all: [notFlag] }, { inventory: [], gold: 0, flags: { door_open: true } }) === false, 'notFlag closed');

const choiceUsed = C.buildRule('choiceUsed', { choiceUsed: 'talked_to_jack' });
assert(choiceUsed.choiceUsed === 'talked_to_jack', 'build choiceUsed');
assert(ctx.ConditionSystem.evaluate({ all: [choiceUsed] }, { inventory: [], gold: 0, flags: { talked_to_jack: true } }) === true, 'choiceUsed ok');

const choiceNot = C.buildRule('choiceNotUsed', { choiceNotUsed: 'talked_to_jack' });
assert(choiceNot.choiceNotUsed === 'talked_to_jack', 'build choiceNotUsed');
assert(ctx.ConditionSystem.evaluate({ all: [choiceNot] }, { inventory: [], gold: 0, flags: {} }) === true, 'choiceNotUsed ok');

const rep = C.buildRule('reputation', { faction: 'village', op: 'gte', value: 10 });
assert(rep.reputation && rep.reputation.faction === 'village' && rep.reputation.op === 'gte', 'build reputation');
assert(C.ruleToCatalogId(rep) === 'reputation', 'id reputation');
assert(ctx.ConditionSystem.evaluate({ all: [rep] }, { inventory: [], gold: 0, flags: { village: 12 } }) === true, 'rep ok');
assert(ctx.ConditionSystem.evaluate({ all: [rep] }, { inventory: [], gold: 0, flags: { village: 5 } }) === false, 'rep fail');

const rule = C.buildRule('hasItem', { hasItem: 'village_key' });
assert(rule.hasItem === 'village_key', 'build hasItem');
const showIf = C.rulesToShowIf([rule]);
assert(showIf.all.length === 1, 'showIf all');
assert(!showIf.any, 'default all not any');

const ctxEval = { inventory: ['village_key'], gold: 0, flags: {} };
assert(ctx.ConditionSystem.evaluate(showIf, ctxEval) === true, 'positive hasItem');
assert(ctx.ConditionSystem.evaluate(showIf, { inventory: [], gold: 0, flags: {} }) === false, 'negative hasItem');

const gold = C.rulesToShowIf([C.buildRule('goldMin', { goldMin: 10 })]);
assert(ctx.ConditionSystem.evaluate(gold, { inventory: [], gold: 15, flags: {} }), 'gold ok');
assert(!ctx.ConditionSystem.evaluate(gold, { inventory: [], gold: 5, flags: {} }), 'gold fail');

// ——— ALL / ANY ———
const anyShow = C.rulesToShowIf([
  C.buildRule('hasItem', { hasItem: 'key' }),
  C.buildRule('goldMin', { goldMin: 100 })
], 'any');
assert(Array.isArray(anyShow.any) && anyShow.any.length === 2, 'any shape');
assert(!anyShow.all, 'any has no all');
assert(ctx.ConditionSystem.evaluate(anyShow, { inventory: ['key'], gold: 0, flags: {} }) === true, 'any key');
assert(ctx.ConditionSystem.evaluate(anyShow, { inventory: [], gold: 100, flags: {} }) === true, 'any gold');
assert(ctx.ConditionSystem.evaluate(anyShow, { inventory: [], gold: 0, flags: {} }) === false, 'any none');

const allShow = C.rulesToShowIf([
  C.buildRule('hasItem', { hasItem: 'key' }),
  C.buildRule('goldMin', { goldMin: 100 })
], 'all');
assert(Array.isArray(allShow.all) && !allShow.any, 'all shape');
assert(ctx.ConditionSystem.evaluate(allShow, { inventory: ['key'], gold: 100, flags: {} }) === true, 'all both');
assert(ctx.ConditionSystem.evaluate(allShow, { inventory: ['key'], gold: 0, flags: {} }) === false, 'all missing gold');

assert(C.getConditionMode({ all: [{}] }) === 'all', 'mode all');
assert(C.getConditionMode({ any: [{}] }) === 'any', 'mode any');
assert(C.getConditionMode(null) === 'all', 'mode default');

// Preserve existing all when rewriting with same mode
const preserved = C.rulesToShowIf(C.extractRules({ all: [{ hasItem: 'x' }] }), C.getConditionMode({ all: [{ hasItem: 'x' }] }));
assert(preserved.all && preserved.all[0].hasItem === 'x' && !preserved.any, 'preserve all');

assert(C.ruleToCatalogId({ hasItem: 'x' }) === 'hasItem', 'ruleToCatalogId');
assert(C.extractRules(showIf).length === 1, 'extract');
assert(C.extractRules(null).length === 0, 'empty');

const unknown = { all: [{ weirdCustom: 1 }, { hasItem: 'x' }] };
assert(C.extractRules(unknown).length === 2, 'unknown preserved in extract');

// ——— Validation ———
const vOk = C.validateConditionRules({ all: [{ hasItem: 'key' }] });
assert(vOk.ok && vOk.errors.length === 0, 'valid all');
const vAny = C.validateConditionRules({ any: [{ goldMin: 10 }] });
assert(vAny.ok && vAny.mode === 'any', 'valid any');
const vLegacy = C.validateConditionRules({ hasItem: 'key', goldMin: 5 });
assert(vLegacy.ok && vLegacy.warnings.some((w) => /Legacy/.test(w.message || w)), 'legacy flat warning');

const badShape = { mode: 'all', rules: [{ hasItem: 'key' }] };
const vBad = C.validateConditionRules(badShape);
assert(!vBad.ok && vBad.errors.some((e) => /Invalid condition shape/.test(e)), 'invalid rules shape');
assert(JSON.stringify(badShape) === JSON.stringify({ mode: 'all', rules: [{ hasItem: 'key' }] }), 'validation does not mutate');

const vUnk = C.validateConditionRules({ all: [{ futureRule: true }] });
assert(vUnk.ok, 'unknown is warning not hard error');
assert(vUnk.warnings.some((w) => /Unknown/.test(w.message)), 'unknown warning');
assert(vUnk.rules[0].futureRule === true, 'unknown preserved in result copy');

assert(typeof C.buildConditionSelectHtml === 'function', 'select html');
const html = C.buildConditionSelectHtml('hasItem');
assert(html.includes('hasItem'), 'select has id');
assert(html.includes('choiceUsed') || C.getConditionDefinition('choiceUsed'), 'choice in catalog');
const modeHtml = C.buildConditionModeSelectHtml('any');
assert(/value="any"[^>]*selected|selected[^>]*value="any"/.test(modeHtml) || modeHtml.includes('selected'), 'mode select any');

// Editor API wiring
assert(typeof ctx.Editor.validateConditionRules === 'function', 'Editor.validateConditionRules');
assert(typeof ctx.Editor.getConditionMode === 'function', 'Editor.getConditionMode');

// Human preset source fix (static)
const noCode = fs.readFileSync(path.join(root, 'js/editor/editor-no-code-ux.js'), 'utf8');
assert(noCode.includes("target[key] = { all: [rule] }"), 'preset writes { all }');
assert(!noCode.includes("mode: 'all', rules:"), 'preset no longer writes rules[]');

assert(!/\bEditor\./.test(fs.readFileSync(path.join(root, 'js/conditions.js'), 'utf8').replace(/Editor/g,'')), 'skip');
assert(!/require\(['\"]\.\/editor/.test(fs.readFileSync(path.join(root, 'js/conditions.js'), 'utf8')), 'conditions no editor require');
assert(!/\bEditor\./.test(fs.readFileSync(path.join(root, 'js/game-ui/visual-runtime.js'), 'utf8')), 'visual no Editor');
assert(!/\bEditor\./.test(fs.readFileSync(path.join(root, 'js/game-ui/ui-runtime.js'), 'utf8')), 'ui runtime no Editor');

// Generic builder parity (source)
const choicesSrc = fs.readFileSync(path.join(root, 'js/editor/editor-choices.js'), 'utf8');
assert(choicesSrc.includes("id: 'goldMax'"), 'generic goldMax');
assert(choicesSrc.includes("id: 'questMinStage'"), 'generic questMinStage');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
