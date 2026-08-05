const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'game_data.json');
const PATCH_PATH = path.join(__dirname, '..', 'data', 'balance-patch.json');
const REPORT_PATH = path.join(__dirname, '..', 'data', 'balance-report.json');
const SIMULATIONS = 5000;

const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

// ========== УТИЛИТЫ БРОСКОВ ==========
function roll(formula) {
  const m = String(formula).match(/(\d+)d(\d+)(?:\s*\+\s*(-?\d+))?/);
  if (!m) return parseInt(formula, 10) || 0;
  const count = parseInt(m[1], 10);
  const sides = parseInt(m[2], 10);
  const bonus = m[3] ? parseInt(m[3], 10) : 0;
  let total = bonus;
  for (let i = 0; i < count; i++) total += Math.floor(Math.random() * sides) + 1;
  return total;
}

function d20() {
  return Math.floor(Math.random() * 20) + 1;
}

function mod(score) {
  return Math.floor((score - 10) / 2);
}

// ========== ПОСТРОЕНИЕ БИЛДОВ ИГРОКОВ ==========
function pointBuyCost(score) {
  if (score <= 8) return 0;
  let cost = 0;
  for (let v = 9; v <= score; v++) cost += v <= 13 ? 1 : 2;
  return cost;
}

function buildPlayer(classKey, level, raceAsi = {}) {
  const cls = data.classes[classKey];
  if (!cls) return null;

  const baseStats = {
    warrior: { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 },
    wizard: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 },
    paladin: { str: 15, dex: 10, con: 14, int: 8, wis: 12, cha: 15 },
    rogue: { str: 10, dex: 15, con: 14, int: 12, wis: 10, cha: 12 },
    cleric: { str: 14, dex: 10, con: 14, int: 10, wis: 15, cha: 12 },
    ranger: { str: 12, dex: 15, con: 14, int: 10, wis: 14, cha: 8 }
  };

  const stats = { ...(baseStats[classKey] || baseStats.warrior) };
  for (const [k, v] of Object.entries(raceAsi)) {
    stats[k] = Math.min(20, (stats[k] || 10) + v);
  }

  const hitDie = { warrior: 10, wizard: 6, paladin: 10, rogue: 8, cleric: 8, ranger: 10 };
  const die = hitDie[classKey] || 8;
  const conMod = mod(stats.con);
  const hp = die + conMod + Math.max(0, level - 1) * (Math.floor(die / 2) + 1 + conMod);

  let ac = 10 + mod(stats.dex);
  if (classKey === 'warrior' || classKey === 'paladin' || classKey === 'cleric') {
    ac = 16 + 2;
  } else if (classKey === 'rogue' || classKey === 'ranger') {
    ac = 11 + mod(stats.dex);
  } else if (classKey === 'wizard') {
    ac = 13 + mod(stats.dex);
  }

  const profBonus = level <= 4 ? 2 : 3;
  const atkStat = { warrior: 'str', paladin: 'str', cleric: 'str', rogue: 'dex', ranger: 'dex', wizard: 'int' }[classKey] || 'str';
  const atkBonus = profBonus + mod(stats[atkStat]);

  const dmgConfigs = {
    warrior: { roll: '1d8', bonus: mod(stats.str) },
    paladin: { roll: '1d8', bonus: mod(stats.str) },
    cleric: { roll: '1d6', bonus: mod(stats.str) },
    rogue: { roll: '1d6', bonus: mod(stats.dex) },
    ranger: { roll: '1d8', bonus: mod(stats.dex) },
    wizard: { roll: '1d6', bonus: mod(stats.str) }
  };
  const dmg = dmgConfigs[classKey] || { roll: '1d6', bonus: 0 };

  return {
    classKey,
    level,
    stats,
    hp,
    maxHp: hp,
    ac,
    atkBonus,
    dmgRoll: dmg.roll,
    dmgBonus: dmg.bonus,
    sneakAttack: classKey === 'rogue' ? '1d6' : null
  };
}

const HUMAN_ASI = { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 };

// ========== СИМУЛЯЦИЯ БОЯ ==========
function simulateBattle(player, enemy) {
  let pHp = player.hp;
  let eHp = enemy.hp;
  let rounds = 0;
  const maxRounds = 50;

  let playerFirst = mod(player.stats.dex) >= (enemy.dex || 2);

  while (pHp > 0 && eHp > 0 && rounds < maxRounds) {
    rounds++;

    if (playerFirst) {
      const atkRoll = d20();
      if (atkRoll === 20 || (atkRoll !== 1 && atkRoll + player.atkBonus >= enemy.ac)) {
        const isCrit = atkRoll === 20;
        let dmg = roll(player.dmgRoll) + player.dmgBonus;
        if (isCrit) dmg += roll(player.dmgRoll);
        if (player.sneakAttack && !isCrit) dmg += roll(player.sneakAttack);
        if (player.sneakAttack && isCrit) dmg += roll(player.sneakAttack) + roll(player.sneakAttack);
        eHp -= dmg;
      }
      if (eHp <= 0) break;

      const eRoll = d20();
      if (eRoll === 20 || (eRoll !== 1 && eRoll + enemy.atkBonus >= player.ac)) {
        const isCrit = eRoll === 20;
        let dmg = roll(enemy.dmgRoll) + (enemy.dmgBonus || 0);
        if (isCrit) dmg += roll(enemy.dmgRoll);
        pHp -= dmg;
      }
    } else {
      const eRoll = d20();
      if (eRoll === 20 || (eRoll !== 1 && eRoll + enemy.atkBonus >= player.ac)) {
        const isCrit = eRoll === 20;
        let dmg = roll(enemy.dmgRoll) + (enemy.dmgBonus || 0);
        if (isCrit) dmg += roll(enemy.dmgRoll);
        pHp -= dmg;
      }
      if (pHp <= 0) break;

      const atkRoll = d20();
      if (atkRoll === 20 || (atkRoll !== 1 && atkRoll + player.atkBonus >= enemy.ac)) {
        const isCrit = atkRoll === 20;
        let dmg = roll(player.dmgRoll) + player.dmgBonus;
        if (isCrit) dmg += roll(player.dmgRoll);
        if (player.sneakAttack && !isCrit) dmg += roll(player.sneakAttack);
        if (player.sneakAttack && isCrit) dmg += roll(player.sneakAttack) + roll(player.sneakAttack);
        eHp -= dmg;
      }
    }
    playerFirst = !playerFirst;
  }

  return {
    playerWon: eHp <= 0 && pHp > 0,
    enemyWon: pHp <= 0,
    draw: pHp > 0 && eHp > 0,
    rounds,
    playerHpLeft: Math.max(0, pHp),
    playerHpLost: player.hp - Math.max(0, pHp),
    enemyHpLeft: Math.max(0, eHp)
  };
}

// ========== АНАЛИЗ ==========
const classes = ['warrior', 'wizard', 'paladin', 'rogue', 'cleric', 'ranger'];
const levels = [1, 2, 3];
const issues = [];
const balanceReport = [];
const patch = { enemies: {}, meta: { simulations: SIMULATIONS, race: 'human +1 all', pointBuy: '27 (8-15)' } };

console.log('=== АНАЛИЗ БАЛАНСА МЕЛЬНИЦЫ ===\n');
console.log(`Симуляций на матч: ${SIMULATIONS}, раса: human (+1 ко всем), Point Buy 27\n`);

for (const [enemyId, enemy] of Object.entries(data.enemies || {})) {
  console.log(`\n--- ${enemy.name || enemyId}${enemy.boss ? ' [босс]' : ''} (HP:${enemy.hp} AC:${enemy.ac} ATK:+${enemy.atkBonus} DMG:${enemy.dmgRoll}+${enemy.dmgBonus || 0}) ---`);

  let totalWinRate = 0;
  let totalHpLostPct = 0;
  let count = 0;
  let worstCase = null;

  for (const classKey of classes) {
    for (const level of levels) {
      const player = buildPlayer(classKey, level, HUMAN_ASI);
      if (!player) continue;

      let wins = 0;
      let totalHpLost = 0;
      let totalRounds = 0;
      for (let i = 0; i < SIMULATIONS; i++) {
        const result = simulateBattle(player, enemy);
        if (result.playerWon) wins++;
        totalHpLost += result.playerHpLost;
        totalRounds += result.rounds;
      }

      const winRate = wins / SIMULATIONS;
      const avgHpLost = totalHpLost / SIMULATIONS;
      const hpLostPct = avgHpLost / player.maxHp;
      const avgRounds = totalRounds / SIMULATIONS;

      totalWinRate += winRate;
      totalHpLostPct += hpLostPct;
      count++;

      const flag = winRate < 0.55 ? '⚠️ СЛОЖНО' : hpLostPct > 0.7 ? '⚠️ КРОВАВО' : '✓';
      console.log(`  ${flag} ${classKey} ур.${level}: win=${(winRate * 100).toFixed(1)}% HPlost=${(hpLostPct * 100).toFixed(1)}% rounds=${avgRounds.toFixed(1)}`);

      balanceReport.push({
        enemy: enemyId,
        enemyName: enemy.name,
        class: classKey,
        level,
        winRate: +(winRate * 100).toFixed(1),
        hpLostPct: +(hpLostPct * 100).toFixed(1),
        avgRounds: +avgRounds.toFixed(1)
      });

      if (!worstCase || winRate < worstCase.winRate) {
        worstCase = { classKey, level, winRate, hpLostPct, player };
      }
    }
  }

  const avgWinRate = totalWinRate / count;
  const avgHpLostPct = totalHpLostPct / count;

  const isTooHard = avgWinRate < 0.6 || avgHpLostPct > 0.7;
  const isBossTooHard = enemy.boss && (avgWinRate < 0.5 || avgHpLostPct > 0.8);

  if (isTooHard || isBossTooHard) {
    console.log(`  ⚠️ ВРАГ СЛИШКОМ СИЛЁН: avg win=${(avgWinRate * 100).toFixed(1)}%, avg HPlost=${(avgHpLostPct * 100).toFixed(1)}%`);
    console.log(`     Самый сложный бой: ${worstCase.classKey} ур.${worstCase.level} — win=${(worstCase.winRate * 100).toFixed(1)}%`);

    const suggested = {
      hp: enemy.hp,
      ac: enemy.ac,
      atkBonus: enemy.atkBonus,
      dmgBonus: enemy.dmgBonus || 0
    };

    if (enemy.boss) {
      suggested.hp = Math.max(10, Math.floor(enemy.hp * 0.85));
      if (avgWinRate < 0.45) suggested.atkBonus = Math.max(0, enemy.atkBonus - 1);
      if (avgHpLostPct > 0.85) suggested.dmgBonus = Math.max(0, (enemy.dmgBonus || 0) - 1);
    } else {
      if (avgWinRate < 0.55) {
        suggested.hp = Math.max(5, Math.floor(enemy.hp * 0.8));
        suggested.atkBonus = Math.max(0, enemy.atkBonus - 1);
      } else if (avgWinRate < 0.6) {
        suggested.hp = Math.max(5, Math.floor(enemy.hp * 0.9));
      }
      if (avgHpLostPct > 0.7) {
        suggested.dmgBonus = Math.max(0, (enemy.dmgBonus || 0) - 1);
      }
    }

    patch.enemies[enemyId] = {
      original: {
        hp: enemy.hp,
        ac: enemy.ac,
        atkBonus: enemy.atkBonus,
        dmgBonus: enemy.dmgBonus || 0
      },
      suggested: {
        hp: suggested.hp,
        ac: suggested.ac,
        atkBonus: suggested.atkBonus,
        dmgBonus: suggested.dmgBonus
      },
      reason: `avg win ${(avgWinRate * 100).toFixed(1)}%, avg HP lost ${(avgHpLostPct * 100).toFixed(1)}%`
    };

    issues.push({
      enemy: enemyId,
      name: enemy.name,
      boss: !!enemy.boss,
      avgWinRate: +(avgWinRate * 100).toFixed(1),
      avgHpLost: +(avgHpLostPct * 100).toFixed(1),
      suggested
    });
  } else {
    console.log(`  ✓ Баланс ОК: avg win=${(avgWinRate * 100).toFixed(1)}%, avg HPlost=${(avgHpLostPct * 100).toFixed(1)}%`);
  }
}

console.log('\n\n========================================');
console.log('ИТОГ АНАЛИЗА');
console.log('========================================');
console.log(`Всего врагов: ${Object.keys(data.enemies || {}).length}`);
console.log(`Проблемных: ${issues.length}`);
console.log('');

if (issues.length === 0) {
  console.log('✅ Баланс в порядке. Правки не требуются.');
} else {
  console.log('⚠️ Требуется балансировка следующих врагов:\n');
  issues.forEach((i) => {
    const ch = patch.enemies[i.enemy];
    console.log(`  ${i.boss ? '👑' : '⚔️'} ${i.name} (${i.enemy})`);
    console.log(`     Было:  HP:${ch.original.hp} ATK:+${ch.original.atkBonus} DMG:+${ch.original.dmgBonus}`);
    console.log(`     Стало: HP:${ch.suggested.hp} ATK:+${ch.suggested.atkBonus} DMG:+${ch.suggested.dmgBonus}`);
    console.log(`     Причина: ${ch.reason}`);
  });

  fs.writeFileSync(PATCH_PATH, JSON.stringify(patch, null, 2) + '\n', 'utf8');
  console.log(`\n💾 Патч сохранён: ${PATCH_PATH}`);
  console.log('');
  console.log('Чтобы применить правки, запусти: node scripts/apply-balance-patch.js --apply');
  console.log('Затем: node scripts/sync-data-js.js');
}

fs.writeFileSync(REPORT_PATH, JSON.stringify(balanceReport, null, 2) + '\n', 'utf8');
console.log(`📊 Подробный отчёт: ${REPORT_PATH}`);
