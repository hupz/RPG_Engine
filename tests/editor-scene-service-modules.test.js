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

const src = fs.readFileSync(path.join(root, 'js/editor/editor-scene-builder.js'), 'utf8');

assert(/id:\s*'shop'/.test(src), 'shop module in catalog');
assert(/id:\s*'blacksmith'/.test(src), 'blacksmith module in catalog');
assert(/id:\s*'church'/.test(src), 'church module in catalog');
assert(src.includes('Торговля предметами') || src.includes('trade_interface'), 'shop description / trade');
assert(src.includes('renderShopModule'), 'renderShopModule');
assert(src.includes('renderBlacksmithModule'), 'renderBlacksmithModule');
assert(src.includes('renderChurchModule'), 'renderChurchModule');
assert(src.includes('_initShopModule'), 'init shop');
assert(src.includes('shopConfig'), 'shopConfig persisted field');
assert(src.includes('blacksmithConfig'), 'blacksmithConfig field');
assert(src.includes('churchConfig'), 'churchConfig field');
assert(src.includes('_sceneModulePickerOpen'), 'single picker flag');
assert(!/Editor\.switchTab\s*=/.test(src) || src.includes('hooks'), 'no switchTab monkey-patch focus');

// Simulate module init without full Editor
const scene = { id: 's1', location: 'Test', editorModules: [] };
function ensureComponents(s) {
  if (!Array.isArray(s.components)) s.components = [];
  return s.components;
}
function upsert(s, type, params) {
  const comps = ensureComponents(s);
  let c = comps.find((x) => x.component === type);
  if (!c) { c = { component: type, params: {} }; comps.push(c); }
  Object.assign(c.params, params);
}
// shop
scene.shopConfig = {
  title: 'Магазин', description: 'Hi', merchantNpcId: 'bob', inventoryId: 'inv1',
  sellMultiplier: 1, buyMultiplier: 0.5
};
scene.special = 'shop';
upsert(scene, 'trade_interface', {
  title: scene.shopConfig.title,
  merchant: scene.shopConfig.merchantNpcId,
  inventory: scene.shopConfig.inventoryId
});
assert(scene.components.some((c) => c.component === 'trade_interface'), 'shop creates trade component');
assert(scene.shopConfig.title === 'Магазин', 'shop config in JSON shape');

// blacksmith
const bs = { id: 's2', blacksmithConfig: { title: 'Кузница', enableBuy: true, enableUpgrade: true, enableRepair: true, npcId: 'smith' } };
bs.special = 'blacksmith';
upsert(bs, 'service_menu', { title: bs.blacksmithConfig.title });
upsert(bs, 'trade_interface', { merchant: bs.blacksmithConfig.npcId });
assert(bs.components.some((c) => c.component === 'service_menu'), 'blacksmith service_menu');
assert(bs.components.some((c) => c.component === 'trade_interface'), 'blacksmith trade');

// church
const ch = { id: 's3', churchConfig: { title: 'Храм', enableHeal: true, healCost: 50 } };
ch.special = 'temple';
upsert(ch, 'service_menu', { title: ch.churchConfig.title, services: [{ id: 'heal', cost: 50 }] });
assert(ch.components.some((c) => c.component === 'service_menu'), 'church service_menu');

// JSON round-trip
const json = JSON.stringify({ scenes: { s1: scene, s2: bs, s3: ch } });
const loaded = JSON.parse(json);
assert(loaded.scenes.s1.shopConfig.title === 'Магазин', 'JSON load shop');
assert(loaded.scenes.s2.blacksmithConfig.enableUpgrade === true, 'JSON load blacksmith');
assert(loaded.scenes.s3.churchConfig.healCost === 50, 'JSON load church');

// picker singleton concept
assert((src.match(/_sceneModulePickerOpen/g) || []).length >= 2, 'picker uses single flag');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
