const fs = require('fs');
const path = require('path');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/game_data.json'), 'utf8'));
const ids = new Set(Object.keys(data.scenes || {}));
const bad = [];

function check(from, field, to) {
  if (to == null || to === '' || to === 'reset') return;
  if (typeof to !== 'string') {
    bad.push({ from, field, to: String(to), kind: 'not_string' });
  } else if (!ids.has(to)) {
    bad.push({ from, field, to, kind: 'missing' });
  }
}

for (const [id, scene] of Object.entries(data.scenes || {})) {
  if (scene.nextScene) check(id, 'nextScene', scene.nextScene);
  if (scene.winScene) check(id, 'winScene', scene.winScene);
  if (scene.lossScene) check(id, 'lossScene', scene.lossScene);
  (scene.choices || []).forEach((c, i) => {
    check(id, `choices[${i}].to`, c.to);
    if (c.nextScene) check(id, `choices[${i}].nextScene`, c.nextScene);
    const sc = c.skillCheck;
    if (sc) {
      check(id, `choices[${i}].skillCheck.successNext`, sc.successNext);
      check(id, `choices[${i}].skillCheck.failNext`, sc.failNext);
    }
  });
}

// Hardcoded engine targets
const engineRefs = ['mill_attic_blueprint'];
for (const ref of engineRefs) {
  if (!ids.has(ref)) bad.push({ from: 'engine.js', field: 'hardcoded', to: ref, kind: 'missing' });
}

console.log(JSON.stringify(bad, null, 2));
console.log('total issues:', bad.length);
process.exit(bad.length ? 1 : 0);
