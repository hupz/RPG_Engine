/**
 * Миграция репутации: уровни фракций, rep_bandits, враг bandit с behavior.
 */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../data/game_data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const DEFAULT_LEVELS = [
  { min: -100, max: -21, label: 'Вражда', color: '#c0392b', discount: -0.50, tradeAllowed: false },
  { min: -20, max: -1, label: 'Нейтралитет-', color: '#e67e22', discount: -0.20, tradeAllowed: true },
  { min: 0, max: 19, label: 'Нейтралитет', color: '#f1c40f', discount: 0, tradeAllowed: true },
  { min: 20, max: 49, label: 'Дружба', color: '#27ae60', discount: 0.10, tradeAllowed: true },
  { min: 50, max: 100, label: 'Герой', color: '#3498db', discount: 0.30, tradeAllowed: true, bonusAccess: ['rare_items', 'legendary_quests'] }
];

if (!data.reputation) data.reputation = {};

data.reputation.rep_village = {
  id: 'rep_village',
  name: 'Деревня Тихая река',
  icon: '🏘️',
  shopRep: 'rep_village',
  levels: DEFAULT_LEVELS.map((lv) => ({ ...lv, bonusAccess: lv.bonusAccess ? [...lv.bonusAccess] : undefined })),
  effects: {
    onHostile: ['trade_ban', 'guard_pursuit'],
    onHero: ['discount_30', 'bonus_quests']
  }
};

data.reputation.rep_bandits = {
  id: 'rep_bandits',
  name: 'Бандиты Леса',
  icon: '⚔️',
  levels: DEFAULT_LEVELS.map((lv) => ({ ...lv })),
  effects: {
    onHostile: ['auto_combat'],
    onHero: ['ally_loot']
  }
};

if (!data.startingFlags) data.startingFlags = {};
if (data.startingFlags.rep_village == null) data.startingFlags.rep_village = 0;
if (data.startingFlags.rep_bandits == null) data.startingFlags.rep_bandits = 0;

if (!data.enemies) data.enemies = {};
if (!data.enemies.bandit) {
  data.enemies.bandit = {
    id: 'bandit',
    name: 'Бандит',
    creatureType: 'humanoid',
    hp: 14,
    maxHp: 14,
    ac: 12,
    atkBonus: 3,
    dmgRoll: '1d6',
    dmgBonus: 1,
    dex: 2,
    exp: 35,
    faction: 'rep_bandits',
    behavior: {
      hostile: {
        threshold: -20,
        action: 'auto_combat',
        dialogue: 'Ты не из тех, кого мы ждём...'
      },
      neutral: {
        threshold: 0,
        action: 'dialogue_then_combat',
        dialogue: 'Стой! Кто такой?'
      },
      friendly: {
        threshold: 20,
        action: 'dialogue_optional_combat',
        dialogue: 'Приветствуем, друг! Что привело в наш лагерь?'
      },
      hero: {
        threshold: 50,
        action: 'ally',
        dialogue: 'Брат! Мы за тебя — скажи слово.'
      }
    }
  };
}

if (data.npcs?.marta && !data.npcs.marta.reputationEffects) {
  data.npcs.marta.reputationEffects = [
    { trigger: 'talk', faction: 'rep_village', value: 1, once: true }
  ];
}

if (data.scenes?.tavern && !data.scenes.tavern.npcId) {
  data.scenes.tavern.npcId = 'marta';
}
if (data.scenes?.village && !data.scenes.village.npcId) {
  data.scenes.village.npcId = 'marta';
}

// Награды квестов — объект { rep_village: N }
const questRep = {
  find_albert: { rep_village: 15 },
  lost_bag: { rep_village: 8 },
  bandit_lair: { rep_village: 10 },
  lukorn_investigation: { rep_village: 15 },
  albert_locket: { rep_village: 10 }
};
Object.entries(questRep).forEach(([qid, rep]) => {
  if (data.quests?.[qid]?.rewards) data.quests[qid].rewards.reputation = rep;
});

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('OK: reputation factions migrated');
