/**
 * ENGINE VERSION — единственный runtime-источник.
 * Генерируется из package.json (scripts/sync-version.mjs).
 * НЕ редактировать вручную число версии здесь.
 */
(function (global) {
  'use strict';
  var VERSION = "1.1.0";
  global.ENGINE_VERSION = VERSION;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ENGINE_VERSION: VERSION, version: VERSION };
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
