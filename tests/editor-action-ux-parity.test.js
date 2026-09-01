#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
let passed = 0, failed = 0;
function assert(c, m) { if (c) { passed++; console.log('  ✓', m); } else { failed++; console.error('  ✗', m); } }

const visSrc = fs.readFileSync(path.join(root, 'js/editor/editor-visual-scene.js'), 'utf8');
const uiSrc = fs.readFileSync(path.join(root, 'js/editor/editor-game-ui.js'), 'utf8');
const catSrc = fs.readFileSync(path.join(root, 'js/editor/editor-action-catalog.js'), 'utf8');

assert(!/\bconst ACTION_UX\s*=/.test(visSrc), 'Visual has no local ACTION_UX array');
assert(visSrc.includes('buildActionSelectHtml') || visSrc.includes('listActionsForEditor'), 'Visual uses catalog API');
assert(visSrc.includes('buildActionParamFieldsHtml') || visSrc.includes('buildActionParamsObject'), 'Visual uses param builders');
assert(!uiSrc.includes("open_panel:journal"), 'Game UI no colon hardcoded open_panel:journal');
assert(!uiSrc.includes("['', '—'], ['open_panel:journal'"), 'Game UI no hardcoded action pairs array');
assert(uiSrc.includes('buildActionSelectHtml'), 'Game UI uses buildActionSelectHtml');
assert(uiSrc.includes('buildActionParamFieldsHtml'), 'Game UI uses param fields');
assert(catSrc.includes('buildActionSelectHtml'), 'catalog has select builder');

const ctx = { console, window: {}, globalThis: null, Editor: { data: {
  scenes: { tavern: { title: 'Таверна' } },
  items: { potion: { name: 'Зелье' } },
  quests: { q1: { name: 'Q', stages: [{ id: 'a', name: 'A' }] } },
  npcs: { jack: { name: 'Jack' } }
}, isWriterMode: () => true } };
ctx.globalThis = ctx; ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/actions/action-registry.js'), 'utf8'), ctx);
vm.runInContext(catSrc, ctx);

const html = ctx.Editor.buildActionSelectHtml('change_scene');
assert(html.includes('change_scene'), 'select includes change_scene');
assert(html.includes('Открыть сцену') || html.includes('selected'), 'select has label/selected');
assert(!html.includes('run_script'), 'writer mode hides run_script');

ctx.Editor.isWriterMode = () => false;
const htmlAdv = ctx.Editor.buildActionSelectHtml('run_script');
assert(htmlAdv.includes('run_script'), 'advanced shows run_script');

const paramsHtml = ctx.Editor.buildActionParamFieldsHtml('change_scene', { sceneId: 'tavern' }, { nodeId: 'n1', data: ctx.Editor.data });
assert(paramsHtml.includes('tavern'), 'scene picker has tavern');
assert(paramsHtml.includes('Таверна') || paramsHtml.includes('selected'), 'scene label');

const itemHtml = ctx.Editor.buildActionParamFieldsHtml('add_item', { itemId: 'potion', count: 2 }, { nodeId: 'n1', data: ctx.Editor.data });
assert(itemHtml.includes('potion'), 'item picker');

const unk = ctx.Editor.buildActionParamFieldsHtml('change_scene', { sceneId: 'missing_x' }, { nodeId: 'n1', data: ctx.Editor.data });
assert(unk.includes('missing_x') && unk.includes('Неизвестно'), 'unknown id preserved');

const built = ctx.Editor.buildActionParamsObject('add_gold', { amount: '15' });
assert(built.amount === 15, 'number param coerce');

const order = [{ action: 'say', params: { text: 'hi' } }, { action: 'change_scene', params: { sceneId: 'tavern' } }];
assert(order[0].action === 'say' && order[1].action === 'change_scene', 'multi action order concept');

const v = ctx.Editor.validateActionCatalog(ctx.ACTION_REGISTRY);
assert(v.ok, 'catalog still valid');

assert(!/\bEditor\./.test(fs.readFileSync(path.join(root, 'js/game-ui/ui-runtime.js'), 'utf8')), 'runtime no Editor');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
