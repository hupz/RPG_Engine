#!/usr/bin/env node
/**
 * Последовательный запуск tests/*.test.js (node, без зависимостей).
 * Exit 1, если хотя бы один файл завершился с ненулевым кодом.
 */
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const testsDir = join(root, 'tests');

const files = readdirSync(testsDir)
  .filter((name) => name.endsWith('.test.js'))
  .sort();

if (!files.length) {
  console.error('run-tests: нет файлов tests/*.test.js');
  process.exit(1);
}

const failed = [];
let passed = 0;

for (const file of files) {
  const abs = join(testsDir, file);
  const rel = `tests/${file}`;
  const result = spawnSync(process.execPath, [abs], {
    cwd: root,
    stdio: 'inherit',
    env: process.env
  });
  const code = result.status ?? 1;
  if (code === 0) {
    passed++;
  } else {
    failed.push(rel);
  }
}

console.log('\n--- Test summary ---');
console.log(`Total: ${files.length}, passed: ${passed}, failed: ${failed.length}`);

if (failed.length) {
  console.error('\nFailed tests:');
  for (const name of failed) {
    console.error(`  - ${name}`);
  }
  process.exit(1);
}

process.exit(0);
