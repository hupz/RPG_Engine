// ============================================
// Масштабирование врагов по таблице уровней
// ============================================

const EnemyScaling = {
  /** Таблица по умолчанию (D&D 5e, уровни 1–10) */
  DEFAULT_SCALING: {
    1: { hpRate: 1.0, atkBonus: 0, acBonus: 0 },
    2: { hpRate: 1.2, atkBonus: 1, acBonus: 0 },
    3: { hpRate: 1.4, atkBonus: 2, acBonus: 1 },
    4: { hpRate: 1.6, atkBonus: 3, acBonus: 1 },
    5: { hpRate: 2.0, atkBonus: 4, acBonus: 2 },
    6: { hpRate: 2.2, atkBonus: 4, acBonus: 2 },
    7: { hpRate: 2.5, atkBonus: 5, acBonus: 2 },
    8: { hpRate: 2.8, atkBonus: 5, acBonus: 3 },
    9: { hpRate: 3.0, atkBonus: 6, acBonus: 3 },
    10: { hpRate: 3.5, atkBonus: 6, acBonus: 3 }
  },

  DEFAULT_BOSS_HP_RATE: 1.5,
  DEFAULT_BASE_LEVEL: 1,

  REPORT_LEVELS: [1, 3, 5, 10],

  /** Нормализация конфига из game_data.enemyScaling */
  ensureConfig(raw) {
    const cfg = raw && typeof raw === 'object' ? { ...raw } : {};
    if (cfg.enabled == null) cfg.enabled = true;
    if (cfg.baseLevel == null) cfg.baseLevel = this.DEFAULT_BASE_LEVEL;
    if (cfg.bossHpRate == null) cfg.bossHpRate = this.DEFAULT_BOSS_HP_RATE;

    if (!cfg.scaling || typeof cfg.scaling !== 'object' || !Object.keys(cfg.scaling).length) {
      cfg.scaling = JSON.parse(JSON.stringify(this.DEFAULT_SCALING));
    } else {
      cfg.scaling = this.normalizeScalingTable(cfg.scaling);
    }

    return cfg;
  },

  normalizeScalingTable(table) {
    const out = {};
    Object.keys(table).forEach((k) => {
      const lvl = parseInt(k, 10);
      if (!lvl || lvl < 1) return;
      const row = table[k] || {};
      out[lvl] = {
        hpRate: Math.max(1, Number(row.hpRate) || 1),
        atkBonus: Math.max(0, parseInt(row.atkBonus, 10) || 0),
        acBonus: Math.max(0, parseInt(row.acBonus, 10) || 0)
      };
    });
    if (!Object.keys(out).length) {
      return JSON.parse(JSON.stringify(this.DEFAULT_SCALING));
    }
    return out;
  },

  getScalingLevels(cfg) {
    const table = cfg?.scaling || this.DEFAULT_SCALING;
    return Object.keys(table)
      .map((k) => parseInt(k, 10))
      .filter((n) => n > 0)
      .sort((a, b) => a - b);
  },

  getRowForLevel(cfg, playerLevel) {
    const table = cfg?.scaling || this.DEFAULT_SCALING;
    const levels = this.getScalingLevels(cfg);
    const lvl = Math.max(1, parseInt(playerLevel, 10) || 1);
    let pick = levels[0];
    levels.forEach((n) => {
      if (n <= lvl) pick = n;
    });
    const row = table[pick] || table[levels[0]] || { hpRate: 1, atkBonus: 0, acBonus: 0 };
    return { level: pick, ...row };
  },

  /** Среднее значение кости (для отчёта) */
  averageRoll(formula) {
    const m = String(formula || '').match(/(\d+)d(\d+)/i);
    if (!m) return parseInt(formula, 10) || 0;
    const count = parseInt(m[1], 10);
    const sides = parseInt(m[2], 10);
    return count * (sides + 1) / 2;
  },

  /** Масштабирование врага; scaleWithPlayerLevel === false → базовые статы */
  scaleEnemy(enemy, playerLevel, config) {
    if (!enemy) return enemy;
    const cfg = this.ensureConfig(config);
    const level = Math.max(1, parseInt(playerLevel, 10) || 1);
    const scaled = { ...enemy };
    scaled.scaledLevel = level;

    const useScaling = enemy.scaleWithPlayerLevel !== false;
    const baseLevel = Math.max(1, parseInt(cfg.baseLevel, 10) || 1);

    if (!cfg.enabled || !useScaling || level < baseLevel) {
      const baseHp = parseInt(enemy.hp ?? enemy.maxHp, 10) || 1;
      scaled.hp = baseHp;
      scaled.maxHp = baseHp;
      scaled.atkBonus = parseInt(enemy.atkBonus, 10) || 0;
      scaled.ac = parseInt(enemy.ac, 10) || 10;
      scaled.dmgRoll = enemy.dmgRoll || '1d6';
      scaled._baseDmgBonus = parseInt(enemy.dmgBonus, 10) || 0;
      scaled.dmgBonus = scaled._baseDmgBonus;
      return scaled;
    }

    const row = this.getRowForLevel(cfg, level);
    const baseHp = parseInt(enemy.hp ?? enemy.maxHp, 10) || 1;
    let hpMult = Math.max(1, Number(row.hpRate) || 1);
    if (enemy.boss === true) {
      hpMult *= Math.max(1, Number(cfg.bossHpRate) || this.DEFAULT_BOSS_HP_RATE);
    }
    const hp = Math.max(1, Math.floor(baseHp * hpMult));

    scaled.hp = hp;
    scaled.maxHp = hp;
    scaled.atkBonus = (parseInt(enemy.atkBonus, 10) || 0) + (row.atkBonus || 0);
    scaled.ac = (parseInt(enemy.ac, 10) || 10) + (row.acBonus || 0);
    scaled.dmgRoll = enemy.dmgRoll || '1d6';
    scaled._baseDmgBonus = parseInt(enemy.dmgBonus, 10) || 0;
    scaled.dmgBonus = scaled._baseDmgBonus;

    return scaled;
  },

  /** Упрощённый билд воина для отчёта баланса */
  buildReportPlayer(level) {
    const lvl = Math.max(1, parseInt(level, 10) || 1);
    const prof = lvl <= 4 ? 2 : lvl <= 8 ? 3 : 4;
    const strMod = 3;
    const conMod = 2;
    const dexMod = 1;
    const hp = 10 + conMod + Math.max(0, lvl - 1) * (5 + conMod);
    return {
      level: lvl,
      hp,
      maxHp: hp,
      ac: 16 + dexMod,
      atkBonus: prof + strMod,
      dmgRoll: '1d8',
      dmgBonus: strMod,
      hitChance: 0.65
    };
  },

  estimateEnemyDamagePerTurn(enemy) {
    const avg = this.averageRoll(enemy.dmgRoll) + (parseInt(enemy.dmgBonus, 10) || 0);
    return Math.max(1, Math.round(avg));
  },

  estimatePlayerDamagePerTurn(player) {
    const avg = this.averageRoll(player.dmgRoll) + (player.dmgBonus || 0);
    return Math.max(1, Math.round(avg * (player.hitChance || 0.65)));
  },

  rateDifficulty(playerTurnsToDie) {
    const t = playerTurnsToDie;
    if (t == null || t <= 0) return { id: 'unknown', label: '—', icon: '⚪' };
    if (t >= 7) return { id: 'easy', label: 'ЛЕГКО', icon: '⚪' };
    if (t >= 3 && t <= 6) return { id: 'normal', label: 'НОРМАЛЬНО', icon: '✅' };
    if (t >= 2 && t < 3) return { id: 'hard', label: 'СЛОЖНО', icon: '🟡' };
    return { id: 'deadly', label: 'СЛИШКОМ СЛОЖНО', icon: '🔴' };
  },

  analyzeEncounter(enemyTemplate, count, playerLevel, config) {
    const cfg = this.ensureConfig(config);
    const scaled = this.scaleEnemy(enemyTemplate, playerLevel, cfg);
    const player = this.buildReportPlayer(playerLevel);
    const enemyDpt = this.estimateEnemyDamagePerTurn(scaled);
    const playerDpt = this.estimatePlayerDamagePerTurn(player);
    const totalEnemyHp = scaled.hp * Math.max(1, count);
    const playerTurnsToDie = Math.ceil(player.hp / Math.max(1, enemyDpt * count));
    const enemyTurnsToDie = Math.ceil(totalEnemyHp / Math.max(1, playerDpt));
    const rating = this.rateDifficulty(playerTurnsToDie);

    return {
      playerLevel,
      scaled,
      player,
      enemyDpt,
      playerDpt,
      count,
      playerTurnsToDie,
      enemyTurnsToDie,
      rating,
      scales: enemyTemplate.scaleWithPlayerLevel !== false
    };
  },

  /** Отчёт по всем боевым сценам проекта */
  generateBalanceReport(data) {
    const cfg = this.ensureConfig(data?.enemyScaling);
    const scenes = data?.scenes || {};
    const enemies = data?.enemies || {};
    const reportLevels = this.REPORT_LEVELS;
    const encounters = [];
    const recommendations = [];

    Object.entries(scenes).forEach(([sceneId, scene]) => {
      const combat = scene?.combat;
      if (!Array.isArray(combat) || !combat.length) return;

      const counts = {};
      combat.forEach((eid) => {
        counts[eid] = (counts[eid] || 0) + 1;
      });

      const enemyBlocks = [];
      Object.entries(counts).forEach(([eid, count]) => {
        const template = enemies[eid];
        if (!template) {
          recommendations.push(`Сцена «${scene.location || sceneId}»: враг «${eid}» не найден в данных.`);
          return;
        }

        const levelResults = reportLevels.map((lvl) => ({
          level: lvl,
          ...this.analyzeEncounter(template, count, lvl, cfg)
        }));

        const worst = levelResults.reduce((a, b) => {
          const order = { deadly: 0, hard: 1, normal: 2, easy: 3, unknown: 4 };
          return (order[a.rating.id] ?? 4) < (order[b.rating.id] ?? 4) ? a : b;
        }, levelResults[0]);

        if (worst.rating.id === 'deadly' && worst.playerLevel <= 3) {
          recommendations.push(
            `Сцена «${scene.location || sceneId}»: «${template.name || eid}» (×${count}) слишком опасен на ${worst.playerLevel} ур. — уменьшите число врагов или ослабьте таблицу.`
          );
        }
        if (template.scaleWithPlayerLevel === false) {
          recommendations.push(
            `Враг «${template.name || eid}» не масштабируется — на высоких уровнях может стать слишком лёгким.`
          );
        }

        enemyBlocks.push({
          enemyId: eid,
          name: template.name || eid,
          count,
          template,
          levelResults
        });
      });

      encounters.push({
        sceneId,
        location: scene.location || sceneId,
        enemies: enemyBlocks
      });
    });

    if (!encounters.length) {
      recommendations.push('В проекте нет сцен с полем combat — добавьте врагов в сцены для проверки баланса.');
    }

    return {
      generatedAt: new Date().toISOString(),
      config: cfg,
      encounters,
      recommendations: [...new Set(recommendations)]
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EnemyScaling };
}
