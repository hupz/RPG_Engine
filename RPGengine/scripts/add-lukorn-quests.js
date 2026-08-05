/**
 * Добавляет квесты «Тень Люкорна» и «Медальон Эльзы» + связанный контент.
 * Не перезаписывает существующие квесты/сцены (кроме epilogue и cellar_free).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dataPath = path.join(root, 'data/game_data.json');
const patchPath = path.join(__dirname, 'lukorn-quests-data.json');

const PROTECTED_QUESTS = new Set(['find_albert', 'lost_bag', 'bandit_lair']);
const REPLACE_SCENES = new Set(['epilogue', 'cellar_free']);

function mergeSection(target, source, label, { allowOverwrite = false, protectedKeys = null } = {}) {
  if (!source || typeof source !== 'object') return;
  for (const [key, value] of Object.entries(source)) {
    if (protectedKeys && protectedKeys.has(key)) {
      console.warn(`SKIP ${label} (protected): ${key}`);
      continue;
    }
    if (target[key] && !allowOverwrite) {
      console.warn(`SKIP ${label} (exists): ${key}`);
      continue;
    }
    target[key] = value;
    console.log(`+ ${label}: ${key}`);
  }
}

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const patch = JSON.parse(fs.readFileSync(patchPath, 'utf8'));

if (!data.quests) data.quests = {};
if (!data.enemies) data.enemies = {};
if (!data.items) data.items = {};
if (!data.worldMap) data.worldMap = {};
if (!data.scenes) data.scenes = {};

for (const q of PROTECTED_QUESTS) {
  if (patch.quests?.[q]) delete patch.quests[q];
}
mergeSection(data.quests, patch.quests, 'quest');

mergeSection(data.enemies, patch.enemies, 'enemy');
mergeSection(data.items, patch.items, 'item');
mergeSection(data.worldMap, patch.worldMap, 'worldMap');

if (patch.sceneReplacements) {
  for (const [key, scene] of Object.entries(patch.sceneReplacements)) {
    if (!REPLACE_SCENES.has(key)) {
      console.warn(`SKIP scene replace (not allowed): ${key}`);
      continue;
    }
    data.scenes[key] = scene;
    console.log(`~ scene replace: ${key}`);
  }
}

mergeSection(data.scenes, patch.scenes, 'scene');

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('OK:', dataPath);
