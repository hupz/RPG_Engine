#!/usr/bin/env node
/**
 * CSP meta на всех публичных HTML-страницах (аудит v3, гл. 6).
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

const CSP_RE = /<meta\s+http-equiv=["']Content-Security-Policy["']/i;

console.log('CSP meta — build artifacts');

const build = spawnSync(process.execPath, ['scripts/build.mjs', 'all'], {
  cwd: root,
  encoding: 'utf8'
});
if (build.stdout) process.stdout.write(build.stdout);
if (build.stderr) process.stderr.write(build.stderr);
assert(build.status === 0, 'build.mjs all exits 0');

const editorFull = spawnSync(process.execPath, ['scripts/build.mjs', 'editor-full'], {
  cwd: root,
  encoding: 'utf8'
});
if (editorFull.stdout) process.stdout.write(editorFull.stdout);
if (editorFull.stderr) process.stderr.write(editorFull.stderr);
assert(editorFull.status === 0, 'build.mjs editor-full exits 0');

console.log('\nCSP meta — pages');

const pages = [
  { file: 'index.html', needEval: false },
  { file: 'index.prod.html', needEval: false },
  { file: 'editor.html', needEval: true },
  { file: 'editor-bundle.html', needEval: true },
  { file: 'editor-guide.html', needEval: false }
];

for (const { file, needEval } of pages) {
  const html = read(file);
  assert(CSP_RE.test(html), `${file} has CSP meta`);
  assert(html.includes("default-src 'self'"), `${file} default-src self`);
  assert(html.includes("script-src-attr 'unsafe-inline'"), `${file} script-src-attr for onclick`);
  assert(html.includes("style-src 'self' 'unsafe-inline'"), `${file} style-src allows inline styles`);
  if (needEval) {
    assert(html.includes("'unsafe-eval'"), `${file} allows unsafe-eval for editor`);
    assert(!/script-src 'self';/.test(html), `${file} script-src is not game-only`);
  } else {
    assert(html.includes("script-src 'self'"), `${file} script-src self without eval in policy`);
    assert(!html.includes("'unsafe-eval'"), `${file} no unsafe-eval`);
  }
}

assert(read('index.html').includes('js/theme-apply-stored.js'), 'index.html external theme boot');
assert(read('index.html').includes('js/game-bootstrap.js'), 'index.html external game bootstrap');
assert(!/<script>\s*ThemeSystem\.applyStoredMode/m.test(read('index.html')), 'index.html no inline theme boot');
assert(!/<script>\s*function gameAppBootstrap/m.test(read('index.html')), 'index.html no inline game bootstrap');

console.log(`\n---\nPassed: ${passed} Failed: ${failed}`);
process.exit(failed ? 1 : 0);
