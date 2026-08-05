// ============================================================
// js/engine.js — точка входа движка (модульная структура)
// ============================================================
// Монолит: js/engine.monolith.js (резервная копия)
//
// Модули (подключать в index.html в этом порядке):
//   1. js/engine/core.js         — состояние, init, прогрессия, квесты
//   2. js/engine/ui-renderer.js  — HTML, лог, модалки, UI
//   3. js/engine/inventory.js    — инвентарь, экипировка, магазин
//   4. js/engine/scene-manager.js — сцены, переходы, special
//   5. js/engine/combat.js       — бой
//   6. js/engine/dialog.js       — диалоги
//   7. js/engine/save-load.js    — сохранения
//
// Звук: js/audio.js (AudioEngine, без изменений)
//
// Пересборка из монолита: node scripts/split-engine.js
