'use strict';
/**
 * Static architecture audit: no late monkey-patches on critical hooked APIs.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const jsRoot = path.join(root, 'js');

let passed = 0, failed = 0;
function assert(c, m) {
  if (c) { passed++; console.log('  ✓', m); }
  else { failed++; console.error('  ✗', m); }
}

const CRITICAL = [
  'switchTab', 'renderAll', 'renderSceneList', 'renderSceneEditor',
  'selectScene', 'selectQuestToEdit', 'selectItemToEdit', 'selectNpcToEdit',
  'selectEnemyToEdit', 'updateJSONPreview'
];

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith('.js')) out.push(p);
  }
  return out;
}

const files = walk(jsRoot).filter((p) => {
  const rel = path.relative(jsRoot, p);
  if (rel.includes('editor-history')) return false; // known exception
  return /editor/i.test(rel) || path.basename(p).startsWith('editor');
});

const findings = [];
for (const file of files) {
  const rel = path.relative(root, file);
  const lines = fs.readFileSync(file, 'utf8').split(/\n/);
  lines.forEach((line, i) => {
    for (const api of CRITICAL) {
      // Editor.api = function  OR Editor.api = (...
      const assign = new RegExp(`Editor\\.${api}\\s*=\\s*(function|\\()`);
      if (assign.test(line)) {
        findings.push({ api, file: rel, line: i + 1, reason: 'late Editor.' + api + ' = assignment', text: line.trim().slice(0, 100) });
      }
      // const origX = Editor.api.bind(Editor) followed by reassignment is risk; flag bind of critical
      if (line.includes(`Editor.${api}.bind(Editor)`) || line.includes(`Editor.${api}?.bind(Editor)`)) {
        if (/orig|original|prev/i.test(line)) {
          findings.push({ api, file: rel, line: i + 1, reason: 'orig.bind capture of critical API', text: line.trim().slice(0, 100) });
        }
      }
    }
  });
}

console.log('\nCritical late assignments / orig.bind:');
if (!findings.length) {
  console.log('  (none)');
} else {
  findings.forEach((f) => console.log(`  ${f.api} ${f.file}:${f.line} — ${f.reason}`));
}

assert(findings.length === 0, 'Unexpected late monkey-patches on critical APIs: 0');

// Positive: known fixed files use hooks.after
const mustUseAfter = [
  ['js/editor-import.js', 'renderSceneList'],
  ['js/editor/editor-worldmap.js', 'renderSceneList'],
  ['js/editor/editor-inspector.js', 'after'],
];
for (const [rel, needle] of mustUseAfter) {
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  assert(src.includes('hooks.after') || src.includes("hooks.after"), rel + ' uses hooks.after');
}

// Inspector must not reassign select*
const insp = fs.readFileSync(path.join(root, 'js/editor/editor-inspector.js'), 'utf8');
assert(!/Editor\[methodName\]\s*=/.test(insp), 'inspector no Editor[methodName]=');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
