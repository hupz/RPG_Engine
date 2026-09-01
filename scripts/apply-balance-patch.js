const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'game_data.json');
const PATCH_PATH = path.join(__dirname, '..', 'data', 'balance-patch.json');

if (!fs.existsSync(PATCH_PATH)) {
  console.error('❌ Патч не найден:', PATCH_PATH);
  console.error('Сначала запусти: node scripts/balance-check.js');
  process.exit(1);
}

if (!process.argv.includes('--apply')) {
  console.log('Режим предпросмотра. Для применения правок добавь флаг --apply');
  console.log('Пример: node scripts/apply-balance-patch.js --apply\n');
}

const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
const patch = JSON.parse(fs.readFileSync(PATCH_PATH, 'utf8'));

let applied = 0;
for (const [enemyId, changes] of Object.entries(patch.enemies || {})) {
  if (!data.enemies[enemyId]) {
    console.warn(`⚠ Враг ${enemyId} не найден в данных, пропуск`);
    continue;
  }
  const enemy = data.enemies[enemyId];
  const s = changes.suggested;
  console.log(`${enemy.name || enemyId}: HP ${enemy.hp}→${s.hp}, AC ${enemy.ac}→${s.ac}, ATK +${enemy.atkBonus}→+${s.atkBonus}, DMG +${enemy.dmgBonus || 0}→+${s.dmgBonus}`);

  if (process.argv.includes('--apply')) {
    enemy.hp = s.hp;
    enemy.maxHp = s.hp;
    enemy.ac = s.ac;
    enemy.atkBonus = s.atkBonus;
    enemy.dmgBonus = s.dmgBonus;
    applied++;
  }
}

if (process.argv.includes('--apply')) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`\n✅ Применено правок: ${applied}`);
  console.log(`💾 Файл сохранён: ${DATA_PATH}`);
  console.log('\n⚠️ Не забудь синхронизировать data.js:');
  console.log('   node scripts/sync-data-js.js');
} else {
  console.log(`\nНайдено правок: ${Object.keys(patch.enemies || {}).length}`);
  console.log('Для применения запусти: node scripts/apply-balance-patch.js --apply');
}
