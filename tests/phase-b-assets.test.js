#!/usr/bin/env node
/**
 * Phase B — Asset System: registry, usage scan, drag payload, editor wiring
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

function loadSchemaContext() {
  const ctx = { console, module: { exports: {} }, exports: {} };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/project-schema.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/data-schema.js'), 'utf8'), ctx);
  return ctx;
}

console.log('Phase B — asset registry');

{
  const ctx = loadSchemaContext();
  const PS = ctx.ProjectSchema;

  const data = {
    assets: {
      village_bg: { type: 'image', src: 'assets/images/village.svg', name: 'Village' },
      sfx_hit: 'assets/audio/hit.mp3'
    },
    scenes: {
      village: {
        visual: {
          background: { asset: { ref: 'village_bg' } },
          nodes: [
            {
              id: 'orphan_img',
              kind: 'image',
              asset: { ref: 'inline_only' }
            }
          ]
        }
      }
    },
    ui: {
      screens: {
        hud: {
          nodes: [{ id: 'bag', kind: 'image', asset: { ref: 'village_bg' } }]
        }
      }
    }
  };

  const list = PS.listRegistryAssets(data);
  assert(list.some((a) => a.id === 'village_bg' && a.inCatalog), 'catalog asset listed');
  assert(list.some((a) => a.id === 'inline_only' && a.orphan), 'orphan inline ref listed');
  assert(list.some((a) => a.id === 'sfx_hit' && a.type === 'audio'), 'string asset infers audio type');

  const usage = PS.scanAssetUsage(data, 'village_bg');
  assert(usage.some((u) => u.kind === 'visual_bg'), 'usage: visual background');
  assert(usage.some((u) => u.kind === 'ui_node'), 'usage: ui node');

  const id = PS.registerAsset(data, null, {
    name: 'New Icon',
    src: 'assets/images/new.png',
    type: 'image'
  });
  assert(id && data.assets[id]?.src === 'assets/images/new.png', 'registerAsset adds to catalog');
  assert(data.assets[id].uid, 'registerAsset assigns uid');

  const slug = PS.slugifyAssetId('My Cool Image!', data.assets);
  assert(typeof slug === 'string' && slug.length > 0, 'slugifyAssetId returns id');
  assert(!data.assets[slug] || slug !== id, 'slugify avoids collision or is new');

  const mime = PS.ASSET_DRAG_MIME;
  const dt = {
    _store: {},
    setData(type, val) { this._store[type] = val; },
    getData(type) { return this._store[type] || ''; }
  };
  dt.setData(mime, JSON.stringify({ id: 'village_bg', src: 'assets/images/village.svg', type: 'image' }));
  const payload = PS.parseAssetDragPayload(dt);
  assert(payload && payload.id === 'village_bg', 'parseAssetDragPayload round-trip');

  const validation = PS.validateProjectAuthoring(data);
  assert(validation.issues.some((i) => i.type === 'authoring_missing_asset'), 'missing catalog ref warns');
}

console.log('\nPhase B — editor wiring');

{
  const html = fs.readFileSync(path.join(root, 'editor.html'), 'utf8');
  assert(html.includes('id="tab-media"'), 'editor.html has tab-media');
  assert(html.includes('id="media-assets-editor"'), 'editor.html has media-assets-editor');
  assert(html.includes('js/editor/editor-assets.js'), 'editor.html loads editor-assets.js');

  const nav = fs.readFileSync(path.join(root, 'js/editor/editor-nav-layout.js'), 'utf8');
  assert(nav.includes("tab: 'media'"), 'nav layout includes media tab');

  const tabs = fs.readFileSync(path.join(root, 'js/editor/editor-core-tabs.js'), 'utf8');
  assert(tabs.includes("tab === 'media'"), 'switchTab handles media');

  const writer = fs.readFileSync(path.join(root, 'js/editor/editor-writer-mode.js'), 'utf8');
  assert(writer.includes("'media'"), 'writer mode includes media tab');

  const visual = fs.readFileSync(path.join(root, 'js/editor/editor-visual-scene.js'), 'utf8');
  assert(visual.includes('Editor.visualDropAssetAt'), 'visual scene exposes drop handler');
  assert(visual.includes('bindAssetDropTarget'), 'visual viewport binds asset drop');

  const ui = fs.readFileSync(path.join(root, 'js/editor/editor-game-ui.js'), 'utf8');
  assert(ui.includes('Editor.uiDropAssetAt'), 'game ui exposes drop handler');
  assert(ui.includes('bindAssetDropTarget'), 'game ui viewport binds asset drop');

  const assets = fs.readFileSync(path.join(root, 'js/editor/editor-assets.js'), 'utf8');
  assert(assets.includes('renderMediaAssets'), 'asset browser render function');
  assert(assets.includes('bindAssetDropTarget'), 'shared drop target binder');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
