#!/usr/bin/env node
/**
 * index.prod.html — parity с index.html: prod-бандл, один тег в теле, порядок модулей.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function assert(c, m) {
  if (c) { passed++; console.log('  ✓', m); }
  else { failed++; console.error('  ✗', m); }
}

function read(p) {
  return fs.readFileSync(path.join(root, p), 'utf8');
}

const BODY_MODULE_START = 'js/engine-version.js';
const PROD_SKIP = new Set([
  'js/editor-test-keys.js',
  'js/editor-test-session.js',
  'js/engine/campaign-hooks.js'
]);
const ENGINE_PREFIX = 'js/engine/';

function parseExternalScripts(html) {
  const external = [];
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const srcMatch = m[1].match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (srcMatch) external.push(srcMatch[1]);
  }
  return external;
}

function buildExpectedProdSources(external) {
  const startIdx = external.indexOf(BODY_MODULE_START);
  if (startIdx < 0) throw new Error('index.html missing engine-version.js');
  const result = [];
  let engineBundleInserted = false;
  let deferredSceneElements = null;

  for (const src of external.slice(startIdx)) {
    if (PROD_SKIP.has(src)) continue;
    if (src === 'js/scene-elements.js') {
      deferredSceneElements = src;
      continue;
    }
    if (src.startsWith(ENGINE_PREFIX)) {
      if (!engineBundleInserted) {
        result.push('dist/engine.bundle.js');
        engineBundleInserted = true;
      }
      continue;
    }
    result.push(src);
  }

  if (deferredSceneElements) {
    const bi = result.indexOf('dist/engine.bundle.js');
    if (bi >= 0) result.splice(bi + 1, 0, deferredSceneElements);
    else result.push(deferredSceneElements);
  }

  return result;
}

console.log('Index prod — build');

const build = spawnSync(process.execPath, ['scripts/build.mjs', 'index-prod'], {
  cwd: root,
  encoding: 'utf8'
});
if (build.stdout) process.stdout.write(build.stdout);
if (build.stderr) process.stderr.write(build.stderr);
assert(build.status === 0, 'build.mjs index-prod exits 0');

const bundlePath = path.join(root, 'dist/index-prod.bundle.js');
const prodHtmlPath = path.join(root, 'index.prod.html');
assert(fs.existsSync(bundlePath), 'dist/index-prod.bundle.js exists');
assert(fs.existsSync(prodHtmlPath), 'index.prod.html exists');

const bundleStat = fs.statSync(bundlePath);
const bundleKb = Math.round(bundleStat.size / 1024);
console.log(`  bundle size: ${bundleKb} KB (${bundleStat.size} bytes)`);
assert(bundleStat.size > 200_000, 'bundle non-trivial size');

console.log('\nIndex prod — bundle contents');

const indexHtml = read('index.html');
const prodHtml = read('index.prod.html');
const bundleContent = read('dist/index-prod.bundle.js');
const external = parseExternalScripts(indexHtml);
const expectedSources = buildExpectedProdSources(external);

let missing = 0;
for (const src of expectedSources) {
  const marker = `/* —— ${src} —— */`;
  if (!bundleContent.includes(marker)) missing++;
}
assert(missing === 0, `all ${expectedSources.length} prod body modules present in bundle`);
assert(bundleContent.includes('quest-stage-actions-bridge'), 'quest stage actions bridge in bundle');
assert(bundleContent.includes('attachQuestStageActionsBridge'), 'bridge hook registered in bundle');

const enginePos = bundleContent.indexOf('/* —— dist/engine.bundle.js —— */');
const scenePos = bundleContent.indexOf('/* —— js/scene-elements.js —— */');
assert(enginePos > 0 && scenePos > enginePos, 'scene-elements.js after engine.bundle in bundle');

console.log('\nIndex prod — index.prod.html wiring');

assert(prodHtml.includes('Сгенерировано scripts/build.mjs index-prod'), 'generated banner present');
assert(prodHtml.includes('Не править вручную'), 'do-not-edit banner present');
assert(prodHtml.includes('dist/index-prod.bundle.js'), 'bundle src path correct');
assert(!prodHtml.includes('src="js/engine/core.js"'), 'dev engine module tag removed');
assert(!prodHtml.includes('editor-test-keys.js'), 'editor test keys removed from prod html');
assert(prodHtml.includes('js/theme-apply-stored.js'), 'head theme-apply-stored.js preserved');
assert(bundleContent.includes('/* —— js/game-bootstrap.js —— */'), 'game-bootstrap embedded in prod bundle');
assert(prodHtml.includes('Content-Security-Policy'), 'CSP meta preserved in index.prod.html');
assert(prodHtml.includes('src="locales/ru.js"'), 'head locale script preserved');

const bodyModuleStarted = prodHtml.indexOf(BODY_MODULE_START);
const bundleTagCount = (prodHtml.match(/<script[^>]+src=["']dist\/index-prod\.bundle\.js["']/gi) || []).length;
assert(bundleTagCount === 1, 'exactly one index-prod bundle script tag');
assert(bodyModuleStarted < 0, 'no raw engine-version tag in generated prod html');

const bodyAfterHead = prodHtml.split('</head>')[1] || '';
const bodyExternalScripts = (bodyAfterHead.match(/<script[^>]+src=/gi) || []).length;
assert(bodyExternalScripts === 1, 'body has exactly one external script tag (bundle)');

console.log('\nIndex prod — source parity sections');

for (const src of expectedSources) {
  if (src === 'dist/engine.bundle.js') continue;
  const abs = path.join(root, src);
  const sourceText = read(src);
  const marker = `/* —— ${src} —— */`;
  const start = bundleContent.indexOf(marker);
  assert(start >= 0, `marker for ${src}`);
  const slice = bundleContent.slice(start, start + marker.length + sourceText.length + 32);
  assert(slice.includes(sourceText.slice(0, 80)), `${src} content embedded in bundle`);
}

console.log('\nIndex prod — index.html unchanged');

const origExternal = parseExternalScripts(indexHtml);
assert(origExternal.includes('js/engine/core.js'), 'index.html still lists dev engine modules');
assert(origExternal.includes('js/quests/quest-stage-actions-bridge.js'), 'bridge still in index.html');

console.log(`\n---\nPassed: ${passed} Failed: ${failed}`);
console.log(`Metrics — prod body modules: ${expectedSources.length}, bundle: ${bundleKb} KB`);
process.exit(failed ? 1 : 0);
