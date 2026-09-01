#!/usr/bin/env node
/**
 * Фаза A — editor-full concat bundle: порядок скриптов, editor-bundle.html, размер.
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

console.log('Editor bundle — build');

const build = spawnSync(process.execPath, ['scripts/build.mjs', 'editor-full'], {
  cwd: root,
  encoding: 'utf8'
});
if (build.stdout) process.stdout.write(build.stdout);
if (build.stderr) process.stderr.write(build.stderr);
assert(build.status === 0, 'build.mjs editor-full exits 0');

const bundlePath = path.join(root, 'dist/editor-full.bundle.js');
const bundleHtmlPath = path.join(root, 'editor-bundle.html');
assert(fs.existsSync(bundlePath), 'dist/editor-full.bundle.js exists');
assert(fs.existsSync(bundleHtmlPath), 'editor-bundle.html exists');

const bundleStat = fs.statSync(bundlePath);
const bundleKb = Math.round(bundleStat.size / 1024);
console.log(`  bundle size: ${bundleKb} KB (${bundleStat.size} bytes)`);
assert(bundleStat.size > 100_000, 'bundle non-trivial size');
assert(bundleStat.size < 50 * 1024 * 1024, 'bundle under 50 MB sanity cap');

console.log('\nEditor bundle — parse order');

const parseOut = spawnSync(process.execPath, ['scripts/parse-editor-scripts.mjs'], {
  cwd: root,
  encoding: 'utf8'
});
const extMatch = parseOut.stdout.match(/external:\s*(\d+)/);
const inlineMatch = parseOut.stdout.match(/inline:\s*(\d+)/);
const extCount = extMatch ? parseInt(extMatch[1], 10) : 0;
const inlineCount = inlineMatch ? parseInt(inlineMatch[1], 10) : 0;
assert(extCount >= 190, `editor.html has many external scripts (${extCount})`);
assert(inlineCount === 0, 'editor.html has no inline scripts (CSP: external theme-apply-stored.js)');

const bundleContent = read('dist/editor-full.bundle.js');
const html = read('editor.html');
const bundleHtml = read('editor-bundle.html');

const localScripts = [];
const re = /<script[^>]+src=["']([^"']+)["']/gi;
let m;
while ((m = re.exec(html)) !== null) {
  if (!/^https?:\/\//i.test(m[1])) localScripts.push(m[1]);
}
let missing = 0;
for (const src of localScripts) {
  const marker = `/* —— ${src} —— */`;
  if (!bundleContent.includes(marker)) missing++;
}
assert(missing === 0, `all ${localScripts.length} local scripts present in bundle`);

assert(bundleContent.includes('ThemeSystem.applyStoredMode()'), 'theme-apply-stored.js embedded in bundle');
assert(
  bundleContent.includes('editorBootSmoke') || bundleContent.includes('runBootSmokeTest'),
  'boot smoke module in bundle'
);

// Порядок: theme.js перед locales в бандле
const themePos = bundleContent.indexOf('/* —— js/theme.js —— */');
const themeApplyPos = bundleContent.indexOf('/* —— js/theme-apply-stored.js —— */');
const ruPos = bundleContent.indexOf('/* —— locales/ru.js —— */');
assert(themePos > 0 && ruPos > themePos, 'theme.js before locales/ru.js');
assert(themeApplyPos > themePos && themeApplyPos < ruPos, 'theme-apply-stored after theme, before locales');

console.log('\nEditor bundle — editor-bundle.html wiring');

const extInBundleHtml = (bundleHtml.match(/<script[^>]+src=/gi) || []).length;
assert(extInBundleHtml === 1, 'editor-bundle.html has exactly one external script tag');
assert(bundleHtml.includes('dist/editor-full.bundle.js'), 'bundle src path correct');
assert(!bundleHtml.includes('src="js/editor/editor-boot-smoke.js"'), 'individual boot-smoke tag removed');

const dup = spawnSync(process.execPath, ['scripts/find-duplicate-editor-methods.mjs', '--check-baseline'], {
  cwd: root,
  encoding: 'utf8'
});
assert(dup.status === 0, 'duplicate Editor methods baseline OK');

// editor.html не изменён
const origExt = (html.match(/<script[^>]+src=/gi) || []).length;
assert(origExt === extCount, 'editor.html script count unchanged');

console.log(`\n---\nPassed: ${passed} Failed: ${failed}`);
console.log(`Metrics — external scripts: ${extCount}, inline: ${inlineCount}, bundle: ${bundleKb} KB`);
process.exit(failed ? 1 : 0);
