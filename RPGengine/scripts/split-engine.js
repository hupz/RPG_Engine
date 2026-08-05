/**
 * Разбивает js/engine.monolith.js на модули js/engine/*.js (по диапазонам строк).
 * Запуск: node scripts/split-engine.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'js', 'engine.monolith.js');
const OUT_DIR = path.join(ROOT, 'js', 'engine');

const MODULE_DEFS = [
  {
    file: 'core.js',
    title: 'core.js — инициализация, состояние, прогрессия, квесты',
    isCore: true,
    ranges: [[101, 1361], [4729, 5187], [6560, 7739], [10531, 10560]]
  },
  {
    file: 'ui-renderer.js',
    title: 'ui-renderer.js — рендеринг HTML и UI',
    ranges: [[1362, 4728], [5188, 5240], [9948, 9953], [9969, 10344], [10444, 10529]],
    exclude: []
  },
  {
    file: 'inventory.js',
    title: 'inventory.js — инвентарь, экипировка, магазин',
    ranges: [[5242, 6559], [10345, 10429]]
  },
  {
    file: 'scene-manager.js',
    title: 'scene-manager.js — сцены, переходы, special',
    ranges: [[7740, 8393], [10431, 10443]]
  },
  {
    file: 'combat.js',
    title: 'combat.js — боевая система',
    ranges: [[8394, 9947]]
  },
  {
    file: 'dialog.js',
    title: 'dialog.js — диалоговая система',
    ranges: [[9954, 9968]]
  },
  {
    file: 'save-load.js',
    title: 'save-load.js — сохранение и загрузка',
    ranges: [[10561, 10831]]
  }
];

function extractRanges(allLines, ranges, exclude = []) {
  const out = [];
  for (const [start, end] of ranges) {
    for (let ln = start; ln <= end; ln++) {
      if (exclude.some(([a, b]) => ln >= a && ln <= b)) continue;
      out.push(allLines[ln - 1]);
    }
  }
  return out;
}

function iifeName(file) {
  return 'attachEngine' + file.replace('.js', '').split('-').map((s) => s[0].toUpperCase() + s.slice(1)).join('');
}

function wrapAttach(file, title, bodyLines) {
  const name = iifeName(file);
  return [
    '// ============================================================',
    `// engine/${title}`,
    '// ============================================================',
    '',
    `(function ${name}() {`,
    "  'use strict';",
    '  if (typeof GameEngine === \'undefined\') {',
    `    console.error('engine/${file}: GameEngine не определён — загрузите core.js первым');`,
    '    return;',
    '  }',
    '',
    '  Object.assign(GameEngine, {',
    ...bodyLines.map((l) => (l.length ? '  ' + l : '')),
    '  });',
    '})();',
    ''
  ].join('\n');
}

function main() {
  const monolithPath = SRC;
  if (!fs.existsSync(monolithPath)) {
    const fallback = path.join(ROOT, 'js', 'engine.js');
    if (!fs.existsSync(fallback)) throw new Error('Нет engine.monolith.js и engine.js');
    fs.copyFileSync(fallback, monolithPath);
  }

  const raw = fs.readFileSync(monolithPath, 'utf8');
  const lines = raw.split('\n');

  const geStart = lines.findIndex((l) => l.startsWith('const GameEngine = {'));
  const geEnd = lines.findIndex((l, i) => i > geStart && l === '};');
  if (geStart < 0 || geEnd < 0) throw new Error('GameEngine block not found');

  const preamble = lines.slice(0, geStart).join('\n');
  const initialProps = lines.slice(geStart + 1, 100); // lines 57-100 in file = indices 56-99
  const bootstrapStart = lines.findIndex((l) => l.includes('Запуск при загрузке страницы'));
  const bootstrap = bootstrapStart >= 0
    ? lines.slice(bootstrapStart).join('\n').trim()
    : '';

  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const mod of MODULE_DEFS) {
    const body = extractRanges(lines, mod.ranges, mod.exclude || []);
    let content;
    if (mod.isCore) {
      content = [
        '// ============================================================',
        `// engine/${mod.title}`,
        '// ============================================================',
        preamble,
        '',
        'const GameEngine = window.GameEngine || {};',
        'window.GameEngine = GameEngine;',
        '',
        'Object.assign(GameEngine, {',
        ...initialProps.map((l) => '  ' + l),
        ...body.map((l) => (l.length ? '  ' + l : '')),
        '});',
        '',
        bootstrap,
        ''
      ].join('\n');
    } else {
      content = wrapAttach(mod.file, mod.title, body);
    }
    fs.writeFileSync(path.join(OUT_DIR, mod.file), content);
  }

  console.log('Engine split OK → js/engine/*.js (index.html подключает модули)');
}

main();
