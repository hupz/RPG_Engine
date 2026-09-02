#!/usr/bin/env node
/**
 * Detect late Editor.method = reassignments outside hooks API.
 * Follows editor.html script load order; first global assignment wins.
 *
 *   node scripts/find-editor-monkey-patches.mjs
 *   node scripts/find-editor-monkey-patches.mjs --check
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const EDITOR_HTML = join(ROOT, 'editor.html');

const CHECK = process.argv.includes('--check');
const EXEMPT_MARK = 'hooks-exempt';
const SKIP_FILES = new Set([
  'js/editor/editor-hooks.js',
  'js/editor/editor-dom.js'
]);

function parseEditorScriptOrder() {
  const html = readFileSync(EDITOR_HTML, 'utf8');
  const re = /<script\s+src="([^"]+\.js)"><\/script>/g;
  const all = [];
  let m;
  while ((m = re.exec(html)) !== null) all.push(m[1].replace(/^\//, ''));
  return all.filter((src) => /editor/i.test(src) || src.includes('/editor/'));
}

function lineOf(content, index) {
  return content.slice(0, index).split('\n').length;
}

function isExempt(content, index) {
  const lineStart = content.lastIndexOf('\n', index) + 1;
  const lineEnd = content.indexOf('\n', index);
  const line = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd);
  if (line.includes(EXEMPT_MARK)) return true;
  const prevNl = content.lastIndexOf('\n', lineStart - 2);
  const prevLine = prevNl >= 0 ? content.slice(prevNl + 1, lineStart - 1) : '';
  return prevLine.includes(EXEMPT_MARK);
}

function scanAssignments(content, relPath, defined, violations) {
  const patterns = [
    /Editor\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function/g,
    /Editor\[['"]([A-Za-z_$][\w$]*)['"]\]\s*=\s*(?:async\s+)?function/g
  ];

  for (const re of patterns) {
    let m;
    while ((m = re.exec(content)) !== null) {
      const method = m[1];
      const idx = m.index;
      if (isExempt(content, idx)) continue;
      if (defined.has(method)) {
        violations.push({
          method,
          file: relPath,
          line: lineOf(content, idx),
          text: content.slice(idx, content.indexOf('\n', idx)).trim().slice(0, 120)
        });
      } else {
        defined.add(method);
      }
    }
  }
}

function main() {
  if (!existsSync(EDITOR_HTML)) {
    console.error('editor.html not found');
    process.exit(1);
  }

  const order = parseEditorScriptOrder();
  const defined = new Set();
  const violations = [];

  for (const rel of order) {
    const pathNorm = rel.replace(/\\/g, '/');
    if (SKIP_FILES.has(pathNorm)) continue;
    const filePath = join(ROOT, pathNorm);
    if (!existsSync(filePath)) continue;
    scanAssignments(readFileSync(filePath, 'utf8'), pathNorm, defined, violations);
  }

  for (const rel of ['js/editor-import.js', 'js/editor-export.js']) {
    const pathNorm = rel;
    const filePath = join(ROOT, pathNorm);
    if (!existsSync(filePath) || order.includes(pathNorm)) continue;
    scanAssignments(readFileSync(filePath, 'utf8'), pathNorm, defined, violations);
  }

  if (!violations.length) {
    console.log('Editor monkey-patches: 0 violations');
    process.exit(0);
  }

  console.log('Editor monkey-patches: ' + violations.length + ' violation(s)\n');
  violations.forEach((v) => {
    console.log(`  ${v.method}  ${v.file}:${v.line}`);
    console.log(`    ${v.text}`);
  });

  process.exit(CHECK ? 1 : 0);
}

main();
