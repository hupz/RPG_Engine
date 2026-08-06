#!/usr/bin/env node
/**
 * Сборка concat-бандлов (без обязательного esbuild).
 * npm install esbuild — опционально для минификации позже.
 *
 *   node scripts/build.mjs [engine|editor|all]
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dist = join(root, 'dist');
mkdirSync(dist, { recursive: true });

const target = process.argv[2] || 'all';

function bundleFiles(name, files) {
  let out = `/* ${name} bundle generated ${new Date().toISOString()} */\n`;
  for (const rel of files) {
    const abs = join(root, rel);
    if (!existsSync(abs)) {
      console.warn('skip missing', rel);
      continue;
    }
    out += `\n;/* —— ${rel} —— */\n` + readFileSync(abs, 'utf8') + '\n';
  }
  const dest = join(dist, `${name}.bundle.js`);
  writeFileSync(dest, out, 'utf8');
  console.log('wrote', dest, `(${Math.round(out.length / 1024)} KB)`);
}

const engineFiles = [
  'js/data-schema.js',
  'js/engine/core.js',
  'js/engine/ui-renderer.js',
  'js/engine/inventory.js',
  'js/engine/scene-manager.js',
  'js/engine/combat.js',
  'js/engine/dialog.js',
  'js/engine/save-load.js',
  'js/engine/scene-element-runner.js'
];

const editorCoreFiles = [
  'js/data-schema.js',
  'js/editor/editor-hooks.js',
  'js/editor/editor-utils.js',
  'js/editor/editor-data-load.js'
];

if (target === 'engine' || target === 'all') bundleFiles('engine', engineFiles);
if (target === 'editor' || target === 'all') bundleFiles('editor-core', editorCoreFiles);

writeFileSync(
  join(dist, 'README.md'),
  `# Bundles\n\n\`node scripts/build.mjs\`\n\n- engine.bundle.js — runtime + data-schema\n- editor-core.bundle.js — hooks/utils/data-load (after const Editor)\n`,
  'utf8'
);
