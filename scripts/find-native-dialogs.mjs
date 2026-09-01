#!/usr/bin/env node
/**
 * Инвентаризация alert / confirm / prompt в коде редактора.
 *
 * Классификация:
 *   (a) toast       — информация / успех / предупреждение / ошибка
 *   (b) confirm     — подтверждение деструктивного действия → confirmDialog
 *   (c) prompt      — ввод данных → promptDialog
 *   (d) confirm-block — блокирующее подтверждение (экспорт с ошибками и т.п.) → confirmDialog
 *
 * Использование:
 *   node scripts/find-native-dialogs.mjs
 *   node scripts/find-native-dialogs.mjs --json
 *   node scripts/find-native-dialogs.mjs --check   # exit 1, если есть вызовы в js/editor*
 *   node scripts/find-native-dialogs.mjs --runtime # инвентаризация js/engine/* + js/actions/*
 *   node scripts/find-native-dialogs.mjs --runtime --write-runtime-baseline
 */
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const JS_DIR = join(ROOT, 'js');

const args = new Set(process.argv.slice(2));
const JSON_OUT = args.has('--json');
const CHECK_MODE = args.has('--check');
const RUNTIME_MODE = args.has('--runtime');
const WRITE_BASELINE = args.has('--write-baseline');
const BASELINE_PATH = join(__dirname, 'native-dialogs-inventory-baseline.json');
const RUNTIME_BASELINE_PATH = join(__dirname, 'native-dialogs-runtime-baseline.json');

const KIND_LABEL = {
  toast: '(a) toast',
  confirm: '(b) confirmDialog',
  prompt: '(c) promptDialog',
  'confirm-block': '(d) confirmDialog (блокирующий)'
};

/** @returns {boolean} */
function isEditorFile(relPath) {
  const p = relPath.replace(/\\/g, '/');
  return p.startsWith('editor/') || /^editor[^/]*\.js$/.test(p.split('/').pop() || '');
}

/** @returns {boolean} */
function isRuntimeFile(relPath) {
  const p = relPath.replace(/\\/g, '/');
  return p.startsWith('engine/') || p.startsWith('actions/');
}

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
      let depth = 1;
      while (i < text.length && depth > 0) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') depth--;
        i++;
      }
      continue;
    }
    if (text[i] === q) return i + 1;
    i++;
  }
  return i;
}

function extractCallArg(text, openParenIdx) {
  let i = openParenIdx + 1;
  i = skipWs(text, i);
  if (text[i] === ')') return { arg: '', end: i + 1 };
  const start = i;
  let depth = 0;
  while (i < text.length) {
    if (text[i] === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) {
      i = skipComment(text, i);
      continue;
    }
    const s = skipString(text, i);
    if (s > i) { i = s; continue; }
    if ('({['.includes(text[i])) { depth++; i++; continue; }
    if (')}]'.includes(text[i])) {
      if (text[i] === ')' && depth === 0) {
        return { arg: text.slice(start, i).trim(), end: i + 1 };
      }
      if (depth > 0) depth--;
      i++;
      continue;
    }
    i++;
  }
  return { arg: text.slice(start).trim(), end: text.length };
}

function previewArg(arg, max = 72) {
  const one = arg.replace(/\s+/g, ' ');
  if (one.length <= max) return one;
  return one.slice(0, max - 1) + '…';
}

function classifyConfirm(arg, lineText, relPath) {
  const low = (arg + ' ' + lineText).toLowerCase();
  const blockHints = [
    'экспорт', 'ошибк', 'валидац', 'продолжить', 'перезаписать',
    'слишком больш', 'backup', 'восстанов', 'новую историю', 'заменён',
    'htmltoolarge', 'htmldone', 'newprojectconfirm', 'backuprestore'
  ];
  if (blockHints.some((h) => low.includes(h))) return 'confirm-block';
  if (relPath.includes('validation-phase-h')) return 'confirm-block';
  return 'confirm';
}

function classifyAlert(arg) {
  const low = arg.toLowerCase();
  if (arg.includes('✅') || low.includes('сохранён') || low.includes('создан') || low.includes('добавлен') || low.includes('импортирован') || low.includes('готов')) {
    return 'toast';
  }
  if (arg.includes('❌') || low.includes('ошибк') || low.includes('неверн') || low.includes('некоррект') || low.includes('не удалось') || low.includes('нельзя')) {
    return 'toast';
  }
  return 'toast';
}

function findNativeDialogs(content, relPath) {
  const results = [];
  const re = /(?:\b|window\.)(alert|confirm|prompt)\s*\(/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const idx = m.index;
    const kind = m[1];
    const line = lineOf(content, idx);
    const lineText = content.split('\n')[line - 1] || '';

    // editor-game-ui.js: typeof prompt === 'function' — не вызов
    if (kind === 'prompt' && /typeof\s+prompt\s*===/.test(lineText)) continue;

    const openParenIdx = content.indexOf('(', m.index);
    if (openParenIdx < 0) continue;
    const { arg } = extractCallArg(content, openParenIdx);
    let category;
    if (kind === 'prompt') category = 'prompt';
    else if (kind === 'confirm') category = classifyConfirm(arg, lineText, relPath);
    else category = classifyAlert(arg);

    results.push({
      file: relPath.replace(/\\/g, '/'),
      line,
      native: kind,
      category,
      categoryLabel: KIND_LABEL[category],
      preview: previewArg(arg || kind + '()')
    });
  }
  return results;
}

function collectEditorFiles() {
  const all = walkJsFiles(JS_DIR);
  return all
    .map((full) => ({ full, rel: relative(JS_DIR, full) }))
    .filter(({ rel }) => isEditorFile(rel));
}

function collectRuntimeFiles() {
  const all = walkJsFiles(JS_DIR);
  return all
    .map((full) => ({ full, rel: relative(JS_DIR, full) }))
    .filter(({ rel }) => isRuntimeFile(rel));
}

function scanFiles(files) {
  const all = [];
  for (const { full, rel } of files) {
    const content = readFileSync(full, 'utf8');
    all.push(...findNativeDialogs(content, rel));
  }
  all.sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return a.line - b.line;
  });
  return all;
}

function printInventory(title, files, all) {
  const byCat = {};
  for (const row of all) {
    byCat[row.category] = (byCat[row.category] || 0) + 1;
  }

  const byFile = new Map();
  for (const row of all) {
    byFile.set(row.file, (byFile.get(row.file) || 0) + 1);
  }
  const fileRank = [...byFile.entries()].sort((a, b) => b[1] - a[1]);

  console.log(title);
  console.log(`Файлов: ${files.length}, вызовов: ${all.length}\n`);

  console.log('По категориям:');
  for (const [cat, label] of Object.entries(KIND_LABEL)) {
    console.log(`  ${label}: ${byCat[cat] || 0}`);
  }
  console.log('');

  console.log('Топ файлов:');
  for (const [file, count] of fileRank.slice(0, 15)) {
    console.log(`  ${String(count).padStart(3)}  ${file}`);
  }
  console.log('');

  const col = { file: 42, line: 5, native: 7, cat: 28, preview: 50 };
  const hdr =
    'Файл'.padEnd(col.file) +
    'Стр'.padStart(col.line) +
    '  ' + 'Вызов'.padEnd(col.native) +
    '  ' + 'Категория'.padEnd(col.cat) +
    '  Сообщение (preview)';
  console.log(hdr);
  console.log('-'.repeat(hdr.length + 20));

  for (const row of all) {
    const f = row.file.length > col.file ? '…' + row.file.slice(-(col.file - 1)) : row.file.padEnd(col.file);
    const prev = row.preview.length > col.preview ? row.preview.slice(0, col.preview - 1) + '…' : row.preview;
    console.log(
      f +
      String(row.line).padStart(col.line) +
      '  ' + row.native.padEnd(col.native) +
      '  ' + row.categoryLabel.padEnd(col.cat) +
      '  ' + prev
    );
  }
}

function runRuntimeMode() {
  const files = collectRuntimeFiles();
  const all = scanFiles(files);

  if (JSON_OUT) {
    console.log(JSON.stringify({ scope: 'runtime', total: all.length, files: files.length, items: all }, null, 2));
    return;
  }

  if (args.has('--write-runtime-baseline')) {
    writeFileSync(RUNTIME_BASELINE_PATH, JSON.stringify({
      capturedAt: new Date().toISOString(),
      total: all.length,
      runtimeFiles: files.length,
      items: all
    }, null, 2));
    console.log('Runtime baseline записан:', relative(ROOT, RUNTIME_BASELINE_PATH), `(${all.length} вызовов)`);
    return;
  }

  if (CHECK_MODE) {
    let baselineTotal = all.length;
    if (existsSync(RUNTIME_BASELINE_PATH)) {
      try {
        const baseline = JSON.parse(readFileSync(RUNTIME_BASELINE_PATH, 'utf8'));
        if (typeof baseline.total === 'number') baselineTotal = baseline.total;
      } catch {
        /* use current scan */
      }
    }
    if (all.length > baselineTotal) {
      console.error(`find-native-dialogs --runtime --check: ${all.length} вызов(ов), baseline ${baselineTotal} — регрессия`);
      for (const row of all) {
        console.error(`  ${row.file}:${row.line}  ${row.native}`);
      }
      process.exit(1);
    }
    console.log(`find-native-dialogs --runtime: js/engine/* + js/actions/* — ${all.length} native dialogs (baseline ${baselineTotal})`);
    process.exit(0);
  }

  printInventory('=== Native dialogs в js/engine/* + js/actions/* ===', files, all);
}

function main() {
  if (RUNTIME_MODE) {
    runRuntimeMode();
    return;
  }

  const files = collectEditorFiles();
  const all = scanFiles(files);

  if (CHECK_MODE) {
    if (all.length > 0) {
      console.error(`find-native-dialogs: найдено ${all.length} вызов(ов) alert/confirm/prompt в js/editor*`);
      for (const row of all.slice(0, 20)) {
        console.error(`  ${row.file}:${row.line}  ${row.native}  ${row.categoryLabel}`);
      }
      if (all.length > 20) console.error(`  … и ещё ${all.length - 20}`);
      process.exit(1);
    }
    console.log('find-native-dialogs: js/editor* — 0 native dialogs');
    process.exit(0);
  }

  const byCat = {};
  for (const row of all) {
    byCat[row.category] = (byCat[row.category] || 0) + 1;
  }

  if (JSON_OUT) {
    console.log(JSON.stringify({ total: all.length, files: files.length, byCategory: byCat, items: all }, null, 2));
    return;
  }

  if (WRITE_BASELINE) {
    writeFileSync(BASELINE_PATH, JSON.stringify({
      capturedAt: new Date().toISOString(),
      total: all.length,
      editorFiles: files.length,
      byCategory: byCat,
      items: all
    }, null, 2));
    console.log('Baseline записан:', relative(ROOT, BASELINE_PATH), `(${all.length} вызовов)`);
    return;
  }

  printInventory('=== Native dialogs в js/editor* ===', files, all);
}

main();
