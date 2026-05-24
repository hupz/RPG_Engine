const fs = require('fs');
const path = require('path');

const demos = [
  { json: 'data/demos/scifi-horror-demo.json', out: 'js/demo-scifi.js', global: 'DEMO_SCIFI_DATA' },
  { json: 'data/demos/pf2e-detective-demo.json', out: 'js/demo-pf2e.js', global: 'DEMO_PF2E_DATA' }
];

for (const { json, out, global } of demos) {
  const jsonPath = path.join(__dirname, '..', json);
  const outPath = path.join(__dirname, '..', out);
  const raw = fs.readFileSync(jsonPath, 'utf8').trim();
  JSON.parse(raw);
  const content = [
    `// Inline demo data (file://) — ${json}`,
    `var ${global} = ${raw};`,
    `if (typeof window !== 'undefined') window.${global} = ${global};`,
    ''
  ].join('\n');
  fs.writeFileSync(outPath, content);
  console.log('Synced', outPath, '(' + content.length + ' bytes)');
}
