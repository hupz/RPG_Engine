#!/usr/bin/env node
/**
 * Сборка concat-бандлов (фаза A — без esbuild).
 *
 *   node scripts/build.mjs [engine|editor|editor-full|index-prod|all]
 *
 * editor-full: все внешние <script src> из editor.html в dist/editor-full.bundle.js
 * + генерация editor-bundle.html (один тег бандла, inline-скрипты на месте).
 *
 * index-prod: модули тела index.html → dist/index-prod.bundle.js
 * + генерация index.prod.html (один тег бандла в теле, head/inline без изменений).
 */
import {
  mkdirSync, writeFileSync, existsSync, readFileSync, statSync
} from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { parseEditorScripts, SCRIPT_TAG_RE } from './parse-editor-scripts.mjs';
import {
  GAME_CSP_POLICY,
  EDITOR_CSP_POLICY,
  upsertCspMeta
} from './csp-policies.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dist = join(root, 'dist');
const vendorDir = join(dist, 'vendor');
const editorHtmlPath = join(root, 'editor.html');
const bundleHtmlPath = join(root, 'editor-bundle.html');
const bundleRelSrc = 'dist/editor-full.bundle.js';
const indexHtmlPath = join(root, 'index.html');
const indexProdHtmlPath = join(root, 'index.prod.html');
const indexProdBundleRel = 'dist/index-prod.bundle.js';
const BODY_MODULE_START = 'js/engine-version.js';

const PROD_SKIP_SCRIPTS = new Set([
  'js/editor-test-keys.js',
  'js/editor-test-session.js',
  'js/engine/campaign-hooks.js'
]);

const ENGINE_MODULE_PREFIX = 'js/engine/';

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
  'js/quests/quest-stage-actions-bridge.js',
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

  const withCsp = upsertCspMeta(
    result,
    EDITOR_CSP_POLICY,
    'editor-bundle: new Function в editor-модулях; script-src-attr — legacy onclick='
  );

  const banner = `<!-- editor-bundle.html: ${scriptCount} внешних скриптов editor.html → ${bundleRelSrc}. Сгенерировано scripts/build.mjs editor-full -->\n`;
  writeFileSync(bundleHtmlPath, banner + withCsp, 'utf8');
  console.log('wrote', bundleHtmlPath);
}

/**
 * Список src для prod-бандла: порядок index.html с заменой js/engine/* на engine.bundle
 * и переносом scene-elements.js сразу после бандла (как ручной index.prod.html после P7.8).
 */
function buildProdBodyScriptSources(external) {
  const startIdx = external.findIndex((e) => e.src === BODY_MODULE_START);
  if (startIdx < 0) {
    throw new Error('index.html: не найден js/engine-version.js');
  }

  const result = [];
  let engineBundleInserted = false;
  let deferredSceneElements = null;

  for (const { src } of external.slice(startIdx)) {
    if (PROD_SKIP_SCRIPTS.has(src)) continue;

    if (src === 'js/scene-elements.js') {
      deferredSceneElements = src;
      continue;
    }

    if (src.startsWith(ENGINE_MODULE_PREFIX)) {
      if (!engineBundleInserted) {
        result.push('dist/engine.bundle.js');
        engineBundleInserted = true;
      }
      continue;
    }

    result.push(src);
  }

  if (deferredSceneElements) {
    const bundleIdx = result.indexOf('dist/engine.bundle.js');
    if (bundleIdx >= 0) {
      result.splice(bundleIdx + 1, 0, deferredSceneElements);
    } else {
      result.push(deferredSceneElements);
    }
  }

  return result;
}

/**
 * index-prod: concat модулей тела index.html (prod-порядок) + index.prod.html с одним тегом бандла.
 */
async function buildIndexProd() {
  const engineBundlePath = join(dist, 'engine.bundle.js');
  if (!existsSync(engineBundlePath)) {
    bundleFiles('engine', engineFiles);
  }

  const html = readFileSync(indexHtmlPath, 'utf8');
  const { external } = parseEditorScripts(html);
  const prodSources = buildProdBodyScriptSources(external);

  if (!prodSources.length) {
    throw new Error('index.html: пустой список prod-модулей');
  }

  let out = `/* index-prod bundle — ${prodSources.length} scripts from index.html — ${new Date().toISOString()} */\n`;
  for (const src of prodSources) {
    const content = await resolveScriptContent(src);
    out += `\n;/* —— ${src} —— */\n${content}\n`;
  }

  const dest = join(dist, 'index-prod.bundle.js');
  writeFileSync(dest, out, 'utf8');
  const kb = Math.round(out.length / 1024);
  console.log('wrote', dest, `(${kb} KB, ${prodSources.length} scripts)`);

  generateIndexProdHtml(html, prodSources.length);
  return { dest, bytes: out.length, kb, scriptCount: prodSources.length };
}

/**
 * index.prod.html: head-скрипты и inline без изменений; модули тела → один dist/index-prod.bundle.js.
 */
function generateIndexProdHtml(html, scriptCount) {
  const bundleTag = `<!-- Движок и модули игры: index.html → ${indexProdBundleRel}. Пересборка: node scripts/build.mjs index-prod -->\n<script src="${indexProdBundleRel}"></script>`;
  let bodyModuleStarted = false;
  let bundleReplaced = false;

  let result = html.replace(SCRIPT_TAG_RE, (full, attrs, body) => {
    const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (srcMatch) {
      const src = srcMatch[1];
      if (src === BODY_MODULE_START) bodyModuleStarted = true;
      if (bodyModuleStarted) {
        if (!bundleReplaced) {
          bundleReplaced = true;
          return bundleTag;
        }
        return '';
      }
      return full;
    }
    if (body.trim()) return full;
    return full;
  });

  result = result.replace(
    /<!-- Движок: модули js\/engine\/ \(порядок важен\) -->\s*\n/g,
    ''
  );

  result = upsertCspMeta(
    result,
    GAME_CSP_POLICY,
    'index.prod: рантайм без eval; script-src-attr — legacy onclick='
  );

  const banner = `<!-- index.prod.html: тело index.html (${scriptCount} модулей) → ${indexProdBundleRel}. Сгенерировано scripts/build.mjs index-prod. Не править вручную. -->\n`;
  writeFileSync(indexProdHtmlPath, banner + result, 'utf8');
  console.log('wrote', indexProdHtmlPath);
}

async function main() {
  if (target === 'engine' || target === 'all') bundleFiles('engine', engineFiles);
  if (target === 'editor' || target === 'all') bundleFiles('editor-core', editorCoreFiles);
  if (target === 'index-prod' || target === 'all') await buildIndexProd();
  if (target === 'editor-full') await buildEditorFull();

  const readmeLines = [
    '# Bundles',
    '',
    '`node scripts/build.mjs [engine|editor|editor-full|index-prod|all]`',
    '',
    '- `engine.bundle.js` — runtime + data-schema',
    '- `editor-core.bundle.js` — hooks/utils/data-load (after const Editor)',
    '- `editor-full.bundle.js` — все внешние скрипты editor.html (concat, порядок из HTML)',
    '- `editor-bundle.html` — editor.html с одним тегом `dist/editor-full.bundle.js`',
    '- `index-prod.bundle.js` — модули тела index.html (prod-порядок, engine → engine.bundle)',
    '- `index.prod.html` — index.html с одним тегом `dist/index-prod.bundle.js` в теле',
    ''
  ];
  if (target === 'all') {
    writeFileSync(join(dist, 'README.md'), readmeLines.join('\n'), 'utf8');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
