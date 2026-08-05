/**
 * Генерирует help-секцию в locales/*.json из EditorHelpData (для синхронизации).
 * Запуск: node scripts/build-locales.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const helpSrc = fs.readFileSync(path.join(root, 'js/editor-help-data.js'), 'utf8');

const helpRu = {};
const entryRe = /'([a-z0-9-]+)':\s*'((?:\\'|[^'])*)'/g;
let m;
while ((m = entryRe.exec(helpSrc)) !== null) {
  helpRu[m[1]] = m[2].replace(/\\'/g, "'");
}

// English help — machine-assisted baseline (authors can refine in en.json)
const helpEn = {
  'scene-id': 'Unique ID used for scene transitions. Latin letters only, no spaces.',
  'scene-location': 'Location name shown to the player in the scene header.',
  'scene-text': 'Main scene text. Placeholders: {charName}, snippets @id. Line breaks are preserved.',
  'choice-text': 'Button label the player sees at the bottom of the screen.',
  'choice-to': 'Target scene ID. Must exist in the project — check with the linter.',
  'quest-id': 'JSON key. Used in questSet, showIf, and scripts. Latin letters only.',
  'quest-title': 'Title shown in the player quest journal.',
  'npc-name': 'Display name. Empty name triggers a validation error.',
  'enemy-hp': 'Hit points. At 0 the enemy is defeated.',
  'item-name': 'Name in inventory and tooltips.',
  'ability-name': 'Name in combat and on the abilities panel.',
  'json-preview': 'Raw project JSON. For debugging; edits here are not auto-saved.'
};

Object.keys(helpRu).forEach((k) => {
  if (!helpEn[k]) helpEn[k] = '[EN] ' + helpRu[k];
});

function patchLocale(file, helpMap) {
  const p = path.join(root, 'locales', file);
  let data = {};
  if (fs.existsSync(p)) {
    data = JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  data.help = { ...(data.help || {}), ...helpMap };
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('Updated', file, 'help keys:', Object.keys(data.help).length);
}

patchLocale('ru.json', helpRu);
patchLocale('en.json', helpEn);
