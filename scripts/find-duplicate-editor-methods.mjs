#!/usr/bin/env node
/**
 * Инвентаризация дублей методов объекта Editor.
 *
 * Сканирует js/ на:
 *   - Object.assign(Editor, { method() {}, method: function () {} })
 *   - Editor.method = function / arrow / .bind(Editor)
 *   - Editor.method = camelCaseFn  (alias на локальную функцию)
 *
 * Использование:
 *   node scripts/find-duplicate-editor-methods.mjs
 *   node scripts/find-duplicate-editor-methods.mjs --json
 *   node scripts/find-duplicate-editor-methods.mjs --write-baseline
 *   node scripts/find-duplicate-editor-methods.mjs --check-baseline
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const JS_DIR = join(ROOT, 'js');
const BASELINE_PATH = join(__dirname, 'editor-method-duplicates-baseline.json');

const args = new Set(process.argv.slice(2));
const JSON_OUT = args.has('--json');
const WRITE_BASELINE = args.has('--write-baseline');
const CHECK_BASELINE = args.has('--check-baseline');

function walkJsFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkJsFiles(full, out);
    else if (name.endsWith('.js')) out.push(full);
  }
  return out;
}

function lineOf(content, index) {
  return content.slice(0, index).split('\n').length;
}

function skipWs(text, i) {
  while (i < text.length && /\s/.test(text[i])) i++;
  return i;
}

function skipComment(text, i) {
  if (text[i] === '/' && text[i + 1] === '/') {
    i += 2;
    while (i < text.length && text[i] !== '\n') i++;
    return i;
  }
  if (text[i] === '/' && text[i + 1] === '*') {
    i += 2;
    while (i < text.length - 1 && !(text[i] === '*' && text[i + 1] === '/')) i++;
    return i + 2;
  }
  return i;
}

function skipString(text, i) {
  const q = text[i];
  if (q !== '"' && q !== "'" && q !== '`') return i;
  i++;
  while (i < text.length) {
    if (text[i] === '\\') { i += 2; continue; }
    if (q === '`' && text[i] === '$' && text[i + 1] === '{') {
      i += 2;
      const end = findMatching(text, i - 1, '{', '}');
      i = end + 1;
      continue;
    }
    if (text[i] === q) return i + 1;
    i++;
  }
  return i;
}

function canStartRegex(text, i) {
  let j = i - 1;
  while (j >= 0 && /\s/.test(text[j])) j--;
  if (j < 0) return true;
  const ch = text[j];
  if (/[=([{:;,!?&|+\-*%~^<>]/.test(ch)) return true;
  if (ch === '/') return true;
  if (/[a-zA-Z0-9_$)\]]/.test(ch)) return false;
  return true;
}

function skipRegex(text, i) {
  if (text[i] !== '/') return i;
  if (text[i + 1] === '/' || text[i + 1] === '*') return i;
  if (!canStartRegex(text, i)) return i;
  i++;
  while (i < text.length) {
    if (text[i] === '\\') { i += 2; continue; }
    if (text[i] === '/') return i + 1;
    if (text[i] === '[') {
      i++;
      while (i < text.length) {
        if (text[i] === '\\') { i += 2; continue; }
        if (text[i] === ']') { i++; break; }
        i++;
      }
      continue;
    }
    i++;
  }
  return i;
}

function advanceToken(text, i) {
  if (text[i] === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) return skipComment(text, i);
  const si = skipString(text, i);
  if (si !== i) return si;
  const ri = skipRegex(text, i);
  if (ri !== i) return ri;
  return i + 1;
}

function findMatching(text, openIndex, openCh, closeCh) {
  let depth = 0;
  let i = openIndex;
  while (i < text.length) {
    if (text[i] === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) {
      i = skipComment(text, i);
      continue;
    }
    const si = skipString(text, i);
    if (si !== i) { i = si; continue; }
    const ri = skipRegex(text, i);
    if (ri !== i) { i = ri; continue; }
    if (text[i] === openCh) depth++;
    else if (text[i] === closeCh) {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return text.length - 1;
}

function advanceSafe(text, i) {
  if (text[i] === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) return skipComment(text, i);
  const si = skipString(text, i);
  if (si !== i) return si;
  return i + 1;
}

function isMethodName(name) {
  if (!name || name === 'Editor') return false;
  if (/^[A-Z][A-Z0-9_]*$/.test(name)) return false;
  return /^[a-zA-Z_$][\w$]*$/.test(name);
}

function extractCalls(body) {
  const calls = new Set();
  const re = /(?:\bthis\.|\bEditor\.|\bEditor\?\.)((?:[a-zA-Z_$][\w$]*))\s*\(/g;
  let m;
  while ((m = re.exec(body)) !== null) calls.add(m[1]);
  return [...calls].sort();
}

function summarizeBody(body) {
  const trimmed = body.trim();
  return {
    chars: trimmed.length,
    lines: trimmed ? trimmed.split('\n').length : 0,
    calls: extractCalls(body)
  };
}

/** Пропустить значение верхнего уровня object literal (depth 1). */
function skipTopLevelValue(text, i) {
  i = skipWs(text, i);
  if (text[i] === '{') return findMatching(text, i, '{', '}') + 1;
  if (text[i] === '[') return findMatching(text, i, '[', ']') + 1;
  if (text[i] === '(') return findMatching(text, i, '(', ')') + 1;
  let depth = 0;
  while (i < text.length) {
    if (text[i] === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) {
      i = skipComment(text, i);
      continue;
    }
    const si = skipString(text, i);
    if (si !== i) { i = si; continue; }
    const ri = skipRegex(text, i);
    if (ri !== i) { i = ri; continue; }
    if (text[i] === '{' || text[i] === '(' || text[i] === '[') {
      const pairs = { '{': '}', '(': ')', '[': ']' };
      i = findMatching(text, i, text[i], pairs[text[i]]) + 1;
      continue;
    }
    if (depth === 0 && (text[i] === ',' || text[i] === '}')) return i;
    i++;
  }
  return i;
}

/**
 * Извлечь методы из текста object literal (от '{' до парной '}').
 */
function extractMethodsFromObjectLiteral(objText, baseOffset) {
  const found = [];
  if (objText[0] !== '{') return found;
  let i = 1;

  while (i < objText.length) {
    i = skipWs(objText, i);
    if (i >= objText.length) break;
    if (objText[i] === '/' && (objText[i + 1] === '/' || objText[i + 1] === '*')) {
      i = skipComment(objText, i);
      continue;
    }
    const si = skipString(objText, i);
    if (si !== i) { i = si; continue; }
    const ri = skipRegex(objText, i);
    if (ri !== i) { i = ri; continue; }
    if (objText[i] === '}') break;
    if (objText[i] === ',') { i++; continue; }

    const slice = objText.slice(i);

    // method shorthand: name() { }
    let m = slice.match(/^([a-zA-Z_$][\w$]*)\s*\(/);
    if (m && isMethodName(m[1])) {
      const key = m[1];
      const parenStart = i + m[0].length - 1;
      const parenEnd = findMatching(objText, parenStart, '(', ')');
      let j = skipWs(objText, parenEnd + 1);
      if (objText[j] === '{') {
        const bodyEnd = findMatching(objText, j, '{', '}');
        const body = objText.slice(i, bodyEnd + 1);
        found.push({ key, body, offset: baseOffset + i, kind: 'Object.assign' });
        i = bodyEnd + 1;
        continue;
      }
    }

    // name: function / async function
    m = slice.match(/^([a-zA-Z_$][\w$]*)\s*:\s*(async\s+)?function\b/);
    if (m && isMethodName(m[1])) {
      const key = m[1];
      let j = i + m[0].length;
      j = skipWs(objText, j);
      if (/^[a-zA-Z_$]/.test(objText[j])) {
        const id = objText.slice(j).match(/^[a-zA-Z_$][\w$]*/);
        if (id) j += id[0].length;
      }
      j = skipWs(objText, j);
      if (objText[j] === '(') j = findMatching(objText, j, '(', ')') + 1;
      j = skipWs(objText, j);
      if (objText[j] === '{') {
        const bodyEnd = findMatching(objText, j, '{', '}');
        const body = objText.slice(i, bodyEnd + 1);
        found.push({ key, body, offset: baseOffset + i, kind: 'Object.assign' });
        i = bodyEnd + 1;
        continue;
      }
    }

    // name: (args) => { }
    m = slice.match(/^([a-zA-Z_$][\w$]*)\s*:\s*(async\s+)?\(/);
    if (m && isMethodName(m[1])) {
      const key = m[1];
      const parenStart = i + slice.indexOf('(');
      const parenEnd = findMatching(objText, parenStart, '(', ')');
      let j = skipWs(objText, parenEnd + 1);
      if (objText[j] === '=' && objText[j + 1] === '>') {
        j = skipWs(objText, j + 2);
        let bodyEnd;
        if (objText[j] === '{') bodyEnd = findMatching(objText, j, '{', '}');
        else {
          bodyEnd = j;
          while (bodyEnd < objText.length && objText[bodyEnd] !== ',' && objText[bodyEnd] !== '}') bodyEnd++;
          bodyEnd--;
        }
        const body = objText.slice(i, bodyEnd + 1);
        found.push({ key, body, offset: baseOffset + i, kind: 'Object.assign' });
        i = bodyEnd + 1;
        continue;
      }
    }

    // getter/setter/async at top level — пропуск
    if (/^(async\s+)?(get|set)\s+[a-zA-Z_$]/.test(slice)) {
      i = skipTopLevelValue(objText, i);
      continue;
    }

    // не метод — пропуск значения
    i = skipTopLevelValue(objText, i);
  }

  return found;
}

function scanObjectAssign(content, relFile) {
  const sites = [];
  const re = /Object\.assign\s*\(\s*Editor\s*,/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    let i = skipWs(content, m.index + m[0].length);
    if (content[i] !== '{') continue;
    const end = findMatching(content, i, '{', '}');
    const objText = content.slice(i, end + 1);
    for (const prop of extractMethodsFromObjectLiteral(objText, i)) {
      const sum = summarizeBody(prop.body);
      sites.push({
        name: prop.key,
        file: relFile,
        line: lineOf(content, prop.offset),
        kind: prop.kind,
        ...sum
      });
    }
  }
  return sites;
}

function isDefinitionStatement(content, assignIndex) {
  let i = assignIndex - 1;
  while (i >= 0 && /\s/.test(content[i])) i--;
  if (i >= 0 && content[i] === '=') return false;
  while (i >= 0 && /\s/.test(content[i])) i--;
  return i < 0 || content[i] === ';' || content[i] === '{' || content[i] === '}';
}

function scanDirectAssign(content, relFile) {
  const sites = [];
  const re = /Editor\.([a-zA-Z_$][\w$]*)\s*=/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const name = m[1];
    if (!isMethodName(name)) continue;
    if (content[m.index + m[0].length] === '=') continue;
    if (!isDefinitionStatement(content, m.index)) continue;

    let i = skipWs(content, m.index + m[0].length);

    // Пропуск runtime-присваиваний: Editor.foo = Editor.bar / литералы
    if (content.slice(i, i + 7) === 'Editor.' || content.slice(i, i + 8) === 'Editor?.') continue;
    if (/^(true|false|null|\d|'|"|`|\[|\{)/.test(content.slice(i))) continue;

    let kind = null;
    let body = '';
    let end = i;

    if (content.slice(i, i + 5) === 'async') i = skipWs(content, i + 5);
    if (content.slice(i, i + 8) === 'function') {
      kind = 'Editor.= function';
      const blockStart = content.indexOf('{', i);
      if (blockStart >= 0) end = findMatching(content, blockStart, '{', '}') + 1;
      body = content.slice(i, end);
    } else if (content[i] === '(') {
      const parenEnd = findMatching(content, i, '(', ')');
      const j = skipWs(content, parenEnd + 1);
      if (content[j] === '=' && content[j + 1] === '>') {
        kind = 'Editor.= arrow';
        const k = skipWs(content, j + 2);
        if (content[k] === '{') end = findMatching(content, k, '{', '}') + 1;
        else {
          end = k;
          while (end < content.length && content[end] !== ';' && content[end] !== '\n') end++;
        }
        body = content.slice(i, end);
      } else continue;
    } else {
      const ident = content.slice(i).match(/^[a-zA-Z_$][\w$]*/);
      if (!ident) continue;
      if (content[i + ident[0].length] === '.') continue;
      let rhsEnd = i + ident[0].length;
      const rhsSlice = content.slice(i, rhsEnd + 20);
      if (rhsSlice.includes('.bind(')) {
        kind = 'Editor.= bind-wrap';
        while (rhsEnd < content.length && content[rhsEnd] !== ';' && content[rhsEnd] !== '\n') rhsEnd++;
        body = content.slice(i, rhsEnd);
      } else {
        continue;
      }
    }

    if (!kind) continue;
    const sum = summarizeBody(body);
    sites.push({ name, file: relFile, line: lineOf(content, m.index), kind, ...sum });
  }
  return sites;
}

function dedupeSites(sites) {
  const seen = new Set();
  return sites.filter((s) => {
    const k = `${s.name}|${s.file}|${s.line}|${s.kind}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function groupByMethod(sites) {
  const map = new Map();
  for (const s of sites) {
    if (!map.has(s.name)) map.set(s.name, []);
    map.get(s.name).push(s);
  }
  return map;
}

function siteLabel(s) {
  const calls = s.calls.length
    ? s.calls.slice(0, 6).join(', ') + (s.calls.length > 6 ? ` +${s.calls.length - 6}` : '')
    : '—';
  return `${s.file}:${s.line} [${s.kind}] ${s.lines}L/${s.chars}c → ${calls}`;
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return null;
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
}

function main() {
  const files = walkJsFiles(JS_DIR);
  let allSites = [];
  for (const full of files) {
    const rel = relative(ROOT, full).replace(/\\/g, '/');
    const content = readFileSync(full, 'utf8');
    allSites.push(...scanObjectAssign(content, rel), ...scanDirectAssign(content, rel));
  }
  allSites = dedupeSites(allSites);

  const duplicates = [...groupByMethod(allSites).entries()]
    .filter(([, sites]) => new Set(sites.map((s) => s.file)).size >= 2)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

  const dupNames = duplicates.map(([name]) => name);

  if (WRITE_BASELINE) {
    writeFileSync(BASELINE_PATH, JSON.stringify({
      generatedAt: new Date().toISOString(),
      duplicateMethods: dupNames,
      count: dupNames.length
    }, null, 2) + '\n');
    console.log(`Baseline: ${relative(ROOT, BASELINE_PATH)} (${dupNames.length} methods)`);
  }

  if (JSON_OUT) {
    console.log(JSON.stringify({
      duplicateCount: duplicates.length,
      duplicates: duplicates.map(([name, sites]) => ({
        method: name,
        fileCount: new Set(sites.map((s) => s.file)).size,
        sites: sites.map((s) => ({
          file: s.file, line: s.line, kind: s.kind, lines: s.lines, chars: s.chars, calls: s.calls
        }))
      }))
    }, null, 2));
  } else {
    console.log('Дубли методов Editor (определения в ≥2 файлах)\n');
    console.log('| Метод | Файлы | Сводка реализаций |');
    console.log('|-------|-------|-------------------|');
    for (const [name, sites] of duplicates) {
      const byFile = new Map();
      for (const s of sites) {
        if (!byFile.has(s.file)) byFile.set(s.file, s);
      }
      const fileCol = [...byFile.values()].map((s) => `${s.file}:${s.line}`).join('; ');
      const summaryCol = [...byFile.values()].map(siteLabel).join(' ‖ ');
      console.log(`| \`${name}\` | ${fileCol} | ${summaryCol} |`);
    }
    console.log(`\nИтого: ${duplicates.length} дублей (${allSites.length} определений в ${files.length} файлах js/)`);
  }

  let fail = duplicates.length > 0;

  if (CHECK_BASELINE) {
    const baseline = loadBaseline();
    if (!baseline) {
      console.error('\nBaseline не найден. Запустите: --write-baseline');
      process.exit(2);
    }
    const known = new Set(baseline.duplicateMethods || []);
    const newOnes = dupNames.filter((n) => !known.has(n));
    if (newOnes.length) {
      console.error('\nНОВЫЕ дубли:', newOnes.join(', '));
      fail = true;
    } else {
      fail = false;
      const resolved = (baseline.duplicateMethods || []).filter((n) => !dupNames.includes(n));
      if (resolved.length) console.log('Разобраны:', resolved.join(', '));
      if (!JSON_OUT) console.log('Новых дублей нет.');
    }
  } else if (fail && !JSON_OUT) {
    console.log('\nexit 1 — дубли найдены.');
    console.log('Зафиксировать: node scripts/find-duplicate-editor-methods.mjs --write-baseline');
    console.log('Только новые: node scripts/find-duplicate-editor-methods.mjs --check-baseline');
  }

  process.exit(fail ? 1 : 0);
}

main();
