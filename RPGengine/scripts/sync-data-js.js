const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '..', 'data', 'game_data.json');
const outPath = path.join(__dirname, '..', 'js', 'data.js');

const json = fs.readFileSync(jsonPath, 'utf8').trim();
JSON.parse(json);

const out = [
  '// Inline game data (file://)',
  'var GAME_DATA_INLINE = ' + json + ';',
  'if (typeof window !== "undefined") window.GAME_DATA_INLINE = GAME_DATA_INLINE;',
  ''
].join('\n');

fs.writeFileSync(outPath, out);
console.log('Synced', outPath, '(' + out.length + ' bytes)');
