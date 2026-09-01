#!/usr/bin/env node
/**
 * Phase H — dist/release export (engine bundle + demo data, no editor)
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import vm from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'dist', 'release');

function loadValidateExportReady() {
  const ctx = { console, module: { exports: {} }, globalThis: null, window: null };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(root, 'js/project-schema.js'), 'utf8'), ctx);
  vm.runInContext(readFileSync(join(root, 'js/data-schema.js'), 'utf8'), ctx);
  return { PS: ctx.ProjectSchema, PDS: ctx.ProjectDataSchema };
}

console.log('Phase H export-dist — build bundles');
execSync('node scripts/build.mjs all', { cwd: root, stdio: 'inherit' });

const demoPath = join(root, 'data/demos/visual_village.json');
if (!existsSync(demoPath)) {
  console.error('Missing demo:', demoPath);
  process.exit(1);
}

const rawDemo = JSON.parse(readFileSync(demoPath, 'utf8'));
const { PS, PDS } = loadValidateExportReady();
PDS.migrateProjectData(rawDemo);
const validation = PS.validateProjectExportReady(rawDemo);
if (!validation.ok) {
  console.error('Demo fails export validation:', validation.errors.map((e) => e.message).join('; '));
  process.exit(1);
}
console.log('  ✓ visual_village passes validateProjectExportReady');

mkdirSync(join(outDir, 'js'), { recursive: true });
mkdirSync(join(outDir, 'data'), { recursive: true });

const inlineData =
  '// RPGengine Phase H release — inline game data\n' +
  'var GAME_DATA_INLINE = ' + JSON.stringify(rawDemo) + ';\n' +
  'if (typeof window !== "undefined") window.GAME_DATA_INLINE = GAME_DATA_INLINE;\n';

writeFileSync(join(outDir, 'js', 'data.js'), inlineData, 'utf8');
copyFileSync(join(root, 'dist', 'engine.bundle.js'), join(outDir, 'js', 'engine.bundle.js'));
writeFileSync(join(outDir, 'data', 'visual_village.json'), JSON.stringify(rawDemo, null, 2), 'utf8');

const indexHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${rawDemo.meta?.title || 'RPG Engine Game'}</title>
<link rel="stylesheet" href="../css/style.css">
</head>
<body>
<p>RPGengine release shell — загрузите полный standalone через редактор (Экспорт → Папка) или index.html проекта.</p>
<p>Этот dist/release содержит engine.bundle.js + data.js для smoke-тестов CI.</p>
<script src="js/engine.bundle.js"></script>
<script src="js/data.js"></script>
</body>
</html>`;

writeFileSync(join(outDir, 'index.html'), indexHtml, 'utf8');

const manifest = {
  type: 'rpgengine-release',
  generatedAt: new Date().toISOString(),
  campaignId: rawDemo.meta?.campaignId || null,
  dataVersion: rawDemo.meta?.dataVersion || null,
  files: [
    'index.html',
    'js/engine.bundle.js',
    'js/data.js',
    'data/visual_village.json',
    'manifest.json'
  ],
  excludesEditor: true,
  validation: { ok: validation.ok, errors: validation.errors.length, warnings: validation.warnings.length }
};

writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

console.log('Wrote', outDir);
console.log('  manifest.json', manifest.files.length, 'entries');
