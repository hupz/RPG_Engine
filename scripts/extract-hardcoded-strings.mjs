#!/usr/bin/env node
/**
 * Инвентаризация захардкоженных русских строк в модулях редактора.
 *
 * Обходит js/editor/* и js/editor*.js (как find-native-dialogs.mjs).
 * Находит строковые литералы с кириллицей вне комментариев.
 * Классификация:
 *   ui      — пользовательский интерфейс (по умолчанию)
 *   service — логи, console.*, throw, dev-диагностика
 *
 * Использование:
 *   node scripts/extract-hardcoded-strings.mjs
 *   node scripts/extract-hardcoded-strings.mjs --json
 *   node scripts/extract-hardcoded-strings.mjs --write-inventory
 *   node scripts/extract-hardcoded-strings.mjs --file editor-help.js
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const JS_DIR = join(ROOT, 'js');
const INVENTORY_PATH = join(__dirname, 'hardcoded-strings-inventory.json');

const args = process.argv.slice(2);
const JSON_OUT = args.includes('--json');
const WRITE_INVENTORY = args.includes('--write-inventory');
const fileFilterIdx = args.indexOf('--file');
const FILE_FILTER = fileFilterIdx >= 0 ? args[fileFilterIdx + 1] : null;

const CYRILLIC_RE = /[а-яА-ЯёЁ]/;
const MAX_PREVIEW = 56;

/** @returns {boolean} */
function isEditorFile(relPath) {
  const p = relPath.replace(/\\/g, '/');
  return p.startsWith('editor/') || /^editor[^/]*\.js$/.test(p.split('/').pop() || '');
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

function readStringLiteral(text, i) {
  const q = text[i];
  if (q !== '"' && q !== "'" && q !== '`') return null;
  const start = i;
  i++;
  let value = '';
  while (i < text.length) {
    if (text[i] === '\\') {
      if (i + 1 < text.length) {
        value += text[i] + text[i + 1];
        i += 2;
        continue;
      }
    }
    if (q === '`' && text[i] === '$' && text[i + 1] === '{') {
      value += '${…}';
      i += 2;
      let depth = 1;
      while (i < text.length && depth > 0) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') depth--;
        i++;
      }
      continue;
    }
    if (text[i] === q) {
      return { end: i + 1, raw: text.slice(start, i + 1), value, quote: q };
    }
    value += text[i];
    i++;
  }
  return null;
}

function preview(str) {
  const one = String(str).replace(/\s+/g, ' ').trim();
  if (one.length <= MAX_PREVIEW) return one;
  return one.slice(0, MAX_PREVIEW - 1) + '…';
}

/**
 * Служебные строки: console.*, throw, dev-префиксы модулей.
 * @param {string} lineText
 * @param {string} value
 */
function classifyString(lineText, value) {
  const trimmed = lineText.trim();

  if (/\bconsole\.(log|warn|error|info|debug|trace)\s*\(/.test(trimmed)) {
    return 'service';
  }
  if (/\bthrow\s+new\s+Error\s*\(/.test(trimmed) || /\bthrow\s+['"`]/.test(trimmed)) {
    return 'service';
  }
  if (
    /^(EDITOR BOOT ERROR|Missing API|Possible cause|Expected provider)/.test(value.trim()) ||
    (/не определён|not defined|missing|failed to load/i.test(value) &&
      /\b(console\.|throw\b|warn\(|error\()/.test(trimmed))
  ) {
    return 'service';
  }
  if (
    /^\[[\w.-]+\]/.test(value.trim()) &&
    /\bconsole\./.test(trimmed)
  ) {
    return 'service';
  }
  if (/\.js:\s/.test(value) && /\bconsole\./.test(trimmed)) {
    return 'service';
  }

  return 'ui';
}

/**
 * @param {string} content
 * @param {string} relPath
 */
function extractRussianStrings(content, relPath) {
  const results = [];
  const seenAtLine = new Set();
  let i = 0;

  while (i < content.length) {
    if (textIsWhitespace(content, i)) { i++; continue; }

    const ci = skipComment(content, i);
    if (ci !== i) { i = ci; continue; }

    const lit = readStringLiteral(content, i);
    if (lit) {
      if (CYRILLIC_RE.test(lit.value)) {
        const line = lineOf(content, i);
        const lineText = content.split('\n')[line - 1] || '';
        const kind = classifyString(lineText, lit.value);
        const key = `${line}:${lit.value}`;
        if (!seenAtLine.has(key)) {
          seenAtLine.add(key);
          results.push({
            file: relPath.replace(/\\/g, '/'),
            line,
            kind,
            value: lit.value,
            preview: preview(lit.value),
            quote: lit.quote
          });
        }
      }
      i = lit.end;
      continue;
    }

    i++;
  }

  return results;
}

function textIsWhitespace(text, i) {
  return i < text.length && /\s/.test(text[i]);
}

function collectEditorFiles() {
  const all = walkJsFiles(JS_DIR);
  return all
    .map((full) => ({ full, rel: relative(JS_DIR, full) }))
    .filter(({ rel }) => isEditorFile(rel))
    .filter(({ rel }) => !FILE_FILTER || rel.replace(/\\/g, '/').includes(FILE_FILTER));
}

function groupByFile(items) {
  const map = new Map();
  for (const item of items) {
    if (!map.has(item.file)) {
      map.set(item.file, { file: item.file, ui: [], service: [], all: [] });
    }
    const g = map.get(item.file);
    g.all.push(item);
    g[item.kind].push(item);
  }
  return [...map.values()].sort((a, b) => b.all.length - a.all.length);
}

function uniqueValues(items) {
  const m = new Map();
  for (const it of items) {
    const k = it.value;
    if (!m.has(k)) m.set(k, { value: k, preview: it.preview, count: 0, files: new Set() });
    const e = m.get(k);
    e.count++;
    e.files.add(it.file);
  }
  return [...m.values()].sort((a, b) => b.count - a.count);
}

function main() {
  const files = collectEditorFiles();
  const all = [];
  for (const { full, rel } of files) {
    const content = readFileSync(full, 'utf8');
    all.push(...extractRussianStrings(content, rel));
  }

  all.sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    return a.line - b.line;
  });

  const uiItems = all.filter((x) => x.kind === 'ui');
  const serviceItems = all.filter((x) => x.kind === 'service');
  const byFile = groupByFile(all);
  const uniqueUi = uniqueValues(uiItems);

  const summary = {
    generatedAt: new Date().toISOString(),
    editorFiles: files.length,
    totalLiterals: all.length,
    ui: uiItems.length,
    service: serviceItems.length,
    uniqueUiStrings: uniqueUi.length,
    byFile: byFile.map((g) => ({
      file: g.file,
      total: g.all.length,
      ui: g.ui.length,
      service: g.service.length
    })),
    items: all
  };

  if (WRITE_INVENTORY) {
    writeFileSync(INVENTORY_PATH, JSON.stringify(summary, null, 2) + '\n');
    console.log('Inventory written:', relative(ROOT, INVENTORY_PATH));
  }

  if (JSON_OUT) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log('=== Захардкоженные русские строки в модулях редактора ===\n');
  console.log(`Файлов: ${files.length}`);
  console.log(`Литералов с кириллицей: ${all.length} (UI: ${uiItems.length}, служебные: ${serviceItems.length})`);
  console.log(`Уникальных UI-строк: ${uniqueUi.length}\n`);

  console.log('### По файлам\n');
  console.log('| Файл | Всего | UI | Служебные |');
  console.log('|------|------:|---:|----------:|');
  for (const row of byFile) {
    console.log(`| \`${row.file}\` | ${row.all.length} | ${row.ui.length} | ${row.service.length} |`);
  }

  console.log('\n### Топ-25 повторяющихся UI-строк\n');
  console.log('| × | Строка (preview) | Файлов |');
  console.log('|--:|------------------|-------:|');
  for (const u of uniqueUi.slice(0, 25)) {
    const esc = u.preview.replace(/\|/g, '\\|').replace(/\n/g, ' ');
    console.log(`| ${u.count} | ${esc} | ${u.files.size} |`);
  }

  console.log('\n### Примеры служебных строк\n');
  console.log('| Файл | Стр | Строка |');
  console.log('|------|----:|--------|');
  for (const row of serviceItems.slice(0, 15)) {
    const esc = row.preview.replace(/\|/g, '\\|');
    console.log(`| \`${row.file}\` | ${row.line} | ${esc} |`);
  }

  console.log('\n### Критичные зоны (подсказки «?» — editor-help*.js)\n');
  const helpItems = all.filter((x) => x.file.includes('editor-help'));
  console.log('| Файл | Стр | Тип | Строка |');
  console.log('|------|----:|-----|--------|');
  for (const row of helpItems.slice(0, 40)) {
    const esc = row.preview.replace(/\|/g, '\\|');
    console.log(`| \`${row.file}\` | ${row.line} | ${row.kind} | ${esc} |`);
  }
  if (helpItems.length > 40) {
    console.log(`\n… и ещё ${helpItems.length - 40} в editor-help*.js`);
  }

  console.log(`\nПолный JSON: node scripts/extract-hardcoded-strings.mjs --write-inventory`);
}

main();
