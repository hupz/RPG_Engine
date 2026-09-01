#!/usr/bin/env node
/**
 * Синхронизация ENGINE_VERSION из package.json → js/engine-version.js
 * Вызывать перед build / вручную: node scripts/sync-version.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const ver = pkg.version || '0.0.0';

const out = `/**
 * ENGINE VERSION — единственный runtime-источник.
 * Генерируется из package.json (scripts/sync-version.mjs).
 * НЕ редактировать вручную число версии здесь.
 */
(function (global) {
  'use strict';
  var VERSION = ${JSON.stringify(ver)};
  global.ENGINE_VERSION = VERSION;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ENGINE_VERSION: VERSION, version: VERSION };
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
`;

const dest = join(root, 'js', 'engine-version.js');
writeFileSync(dest, out, 'utf8');
console.log('ENGINE_VERSION =', ver, '→', dest);
