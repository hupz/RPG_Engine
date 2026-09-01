#!/usr/bin/env node
/**
 * Сборка concat-бандлов (фаза A — без esbuild).
 *
 *   node scripts/build.mjs [engine|editor|editor-full|all]
 *
 * editor-full: все внешние <script src> из editor.html в dist/editor-full.bundle.js
 * + генерация editor-bundle.html (один тег бандла, inline-скрипты на месте).
 */
import {
  mkdirSync, writeFileSync, existsSync, readFileSync, statSync
} from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { parseEditorScripts, SCRIPT_TAG_RE } from './parse-editor-scripts.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dist = join(root, 'dist');
const vendorDir = join(dist, 'vendor');
const editorHtmlPath = join(root, 'editor.html');
const bundleHtmlPath = join(root, 'editor-bundle.html');
const bundleRelSrc = 'dist/editor-full.bundle.js';

mkdirSync(dist, { recursive: true });
mkdirSync(vendorDir, { recursive: true });

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
  const kb = Math.round(out.length / 1024);
  console.log('wrote', dest, `(${kb} KB)`);
  return { dest, bytes: out.length, kb };
}

const engineFiles = [
  'js/engine-version.js',
  'js/data-schema.js',
  'js/project-schema.js',
  'js/game-ui/visual-runtime.js',
  'js/game-ui/ui-runtime.js',
  'js/engine/core.js',
  'js/engine/ui-renderer.js',
  'js/engine/inventory.js',
  'js/engine/campaign-hooks.js',
  'js/engine/scene-manager.js',
  'js/engine/combat.js',
  'js/engine/dialog.js',
  'js/engine/save-load.js',
  'js/engine/scene-element-runner.js'
];

const editorCoreFiles = [
  'js/data-schema.js',
  'js/project-schema.js',
  'js/editor/editor-hooks.js',
  'js/editor/editor-utils.js',
  'js/editor/editor-data-load.js'
];

/** Проверка дублей Editor-методов — только новые сверх baseline. */
function checkEditorMethodDuplicates() {
  const r = spawnSync(
    process.execPath,
    [join(__dirname, 'find-duplicate-editor-methods.mjs'), '--check-baseline'],
    { cwd: root, encoding: 'utf8' }
  );
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    console.error('\nbuild: остановлено — новые дубли Editor-методов (см. выше).');
    process.exit(r.status || 1);
  }
}

function vendorFileNameForUrl(url) {
  const base = url.split('/').pop().split('?')[0] || 'remote.js';
  return base.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/** Локальный путь или CDN → содержимое файла (CDN кэшируется в dist/vendor/). */
async function resolveScriptContent(src) {
  if (/^https?:\/\//i.test(src)) {
    const cachePath = join(vendorDir, vendorFileNameForUrl(src));
    if (existsSync(cachePath)) {
      return readFileSync(cachePath, 'utf8');
    }
    const res = await fetch(src);
    if (!res.ok) {
      throw new Error(`Не удалось загрузить CDN-скрипт ${src}: HTTP ${res.status}`);
    }
    const text = await res.text();
    writeFileSync(cachePath, text, 'utf8');
    console.log('cached CDN →', cachePath);
    return text;
  }
  const abs = join(root, src.replace(/^\//, ''));
  if (!existsSync(abs)) {
    throw new Error(`Скрипт не найден: ${src} (${abs})`);
  }
  return readFileSync(abs, 'utf8');
}

/**
 * Собирает editor-full.bundle.js: порядок = порядок <script src> в editor.html.
 * Inline-скрипты вшиваются в бандл на исходных позициях (для корректного порядка
 * ThemeSystem.applyStoredMode между theme.js и locales); в HTML inline остаётся
 * отдельным тегом (идемпотентный повтор после бандла).
 */
async function buildEditorFull() {
  checkEditorMethodDuplicates();

  const html = readFileSync(editorHtmlPath, 'utf8');
  const { external, inline } = parseEditorScripts(html);

  if (!external.length) {
    throw new Error('editor.html: нет внешних <script src>');
  }

  let out = `/* editor-full bundle — ${external.length} scripts from editor.html — ${new Date().toISOString()} */\n`;
  let inlineIdx = 0;

  for (const ext of external) {
    while (inlineIdx < inline.length && inline[inlineIdx].index < ext.index) {
      const block = inline[inlineIdx];
      out += `\n;/* —— INLINE editor.html @${block.index} —— */\n${block.code}\n`;
      inlineIdx++;
    }
    const content = await resolveScriptContent(ext.src);
    out += `\n;/* —— ${ext.src} —— */\n${content}\n`;
  }
  while (inlineIdx < inline.length) {
    const block = inline[inlineIdx];
    out += `\n;/* —— INLINE editor.html @${block.index} —— */\n${block.code}\n`;
    inlineIdx++;
  }

  const dest = join(dist, 'editor-full.bundle.js');
  writeFileSync(dest, out, 'utf8');
  const kb = Math.round(out.length / 1024);
  console.log('wrote', dest, `(${kb} KB, ${external.length} scripts)`);

  generateEditorBundleHtml(html, external.length);
  return { dest, bytes: out.length, kb, scriptCount: external.length };
}

/**
 * editor-bundle.html: все внешние script → один dist/editor-full.bundle.js;
 * inline-теги без изменений.
 */
function generateEditorBundleHtml(html, scriptCount) {
  const bundleTag = `<script src="${bundleRelSrc}"></script>`;
  let replacedFirst = false;

  const result = html.replace(SCRIPT_TAG_RE, (full, attrs, body) => {
    if (/\bsrc\s*=/.test(attrs)) {
      if (!replacedFirst) {
        replacedFirst = true;
        return bundleTag;
      }
      return '';
    }
    if (body.trim()) return full;
    return full;
  });

  const banner = `<!-- editor-bundle.html: ${scriptCount} внешних скриптов editor.html → ${bundleRelSrc}. Сгенерировано scripts/build.mjs editor-full -->\n`;
  writeFileSync(bundleHtmlPath, banner + result, 'utf8');
  console.log('wrote', bundleHtmlPath);
}

async function main() {
  if (target === 'engine' || target === 'all') bundleFiles('engine', engineFiles);
  if (target === 'editor' || target === 'all') bundleFiles('editor-core', editorCoreFiles);
  if (target === 'editor-full') await buildEditorFull();

  const readmeLines = [
    '# Bundles',
    '',
    '`node scripts/build.mjs [engine|editor|editor-full|all]`',
    '',
    '- `engine.bundle.js` — runtime + data-schema',
    '- `editor-core.bundle.js` — hooks/utils/data-load (after const Editor)',
    '- `editor-full.bundle.js` — все внешние скрипты editor.html (concat, порядок из HTML)',
    '- `editor-bundle.html` — editor.html с одним тегом `dist/editor-full.bundle.js`',
    ''
  ];
  writeFileSync(join(dist, 'README.md'), readmeLines.join('\n'), 'utf8');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
