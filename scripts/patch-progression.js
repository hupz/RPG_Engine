const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '..', 'data', 'game_data.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

data.progression = {
  enabled: true,
  maxLevel: 5,
  expTable: [0, 80, 180, 320, 500],
  defaultHpGain: '1d8',
  defaults: { enemyExp: 20, skillCheckExp: 12 },
  skillExp: {
    perception: 18, athletics: 15, stealth: 15, persuasion: 14,
    intimidation: 14, dexterity: 12, strength: 12, acrobatics: 15,
    investigation: 16, survival: 14, wisdom: 12, charisma: 12, intelligence: 12
  },
  abilities: {
    warrior_cleave: { id: 'warrior_cleave', name: 'Рассечение', cost: 1, icon: '🪓', desc: 'Мощный удар: 2к8 урона.', combatOnly: true, oncePerCombat: false, effect: 'damage:2d8' },
    warrior_endurance: { id: 'warrior_endurance', name: 'Стойкость', type: 'passive', icon: '💪', desc: '+6 максимальных ОЗ.', passive: { maxHpBonus: 6 } },
    warrior_rally: { id: 'warrior_rally', name: 'Боевой клич', cost: 1, icon: '📯', desc: 'Восстанавливает 1к8+2 ОЗ.', combatOnly: false, oncePerCombat: true, effect: 'heal:1d8+2' },
    warrior_parry: { id: 'warrior_parry', name: 'Парирование', cost: 1, icon: '⚔️', desc: '+3 КД до следующего хода.', combatOnly: true, oncePerCombat: false, effect: 'ac_bonus:3' },
    warrior_whirlwind: { id: 'warrior_whirlwind', name: 'Вихрь клинка', cost: 2, icon: '🌪️', desc: '2к6 урона всем врагам.', combatOnly: true, oncePerCombat: true, effects: [{ type: 'damage', value: '2d6', allTargets: true }] },
    warrior_armor_mastery: { id: 'warrior_armor_mastery', name: 'Мастер брони', type: 'passive', icon: '🛡️', desc: '+2 КД.', passive: { acBonus: 2 } },
    wizard_arcane_bolt: { id: 'wizard_arcane_bolt', name: 'Чародейский заряд', cost: 1, icon: '⚡', desc: '1к12+3 урона.', combatOnly: true, oncePerCombat: false, effect: 'damage:1d12+3' },
    wizard_meditation: { id: 'wizard_meditation', name: 'Медитация', type: 'passive', icon: '🧘', desc: '+1 макс. ячейка.', passive: { resourceMaxBonus: 1 } },
    wizard_scorch: { id: 'wizard_scorch', name: 'Ожог', cost: 1, icon: '🔥', desc: '2к6 огня (спасбросок).', combatOnly: true, oncePerCombat: false, effect: 'aoe_fire:2d6' },
    wizard_frost: { id: 'wizard_frost', name: 'Ледяной луч', cost: 1, icon: '❄️', desc: '1к10+4 урона.', combatOnly: true, oncePerCombat: false, effect: 'damage:1d10+4' },
    wizard_empower: { id: 'wizard_empower', name: 'Усиление', type: 'passive', icon: '✨', desc: '+1 к атаке.', passive: { atkBonus: 1 } },
    wizard_counterspell: { id: 'wizard_counterspell', name: 'Контрзаклинание', cost: 2, icon: '🌀', desc: '+5 КД.', combatOnly: true, oncePerCombat: true, effect: 'ac_bonus:5' },
    paladin_bless: { id: 'paladin_bless', name: 'Благословение', cost: 1, icon: '🙏', desc: '2к4+2 ОЗ.', combatOnly: false, oncePerCombat: false, effect: 'heal:2d4+2' },
    paladin_holy_armor: { id: 'paladin_holy_armor', name: 'Святая броня', type: 'passive', icon: '🛡️', desc: '+2 КД.', passive: { acBonus: 2 } },
    paladin_radiant_strike: { id: 'paladin_radiant_strike', name: 'Сияющий удар', cost: 1, icon: '☀️', desc: 'Кара +1к8 на удар.', combatOnly: true, oncePerCombat: false, effect: 'smite:1d8' },
    paladin_aura: { id: 'paladin_aura', name: 'Аура стойкости', type: 'passive', icon: '💚', desc: '+4 макс. ОЗ.', passive: { maxHpBonus: 4 } },
    paladin_divine_wrath: { id: 'paladin_divine_wrath', name: 'Гнев небес', cost: 2, icon: '⚡', desc: '2к8 урона.', combatOnly: true, oncePerCombat: true, effect: 'damage:2d8' },
    paladin_faith_shield: { id: 'paladin_faith_shield', name: 'Щит веры (усил.)', cost: 1, icon: '🔰', desc: '+3 КД.', combatOnly: true, oncePerCombat: false, effect: 'ac_bonus:3' }
  }
};

const enemyExp = { scout_a: 25, scout_b: 25, wolf_a: 22, wolf_b: 22, corvin: 60, bruiser: 30, archer_a: 18, archer_b: 18 };
for (const [id, exp] of Object.entries(enemyExp)) {
  if (data.enemies[id]) data.enemies[id].exp = exp;
}

data.classes.warrior.progression = {
  hpGain: '1d10',
  levels: {
    '2': { choices: ['warrior_cleave', 'warrior_endurance'] },
    '3': { choices: ['warrior_rally', 'warrior_parry'], stats: { atkBonus: 1 } },
    '4': { choices: ['warrior_whirlwind', 'warrior_armor_mastery'] },
    '5': { choices: ['warrior_cleave', 'warrior_endurance'], stats: { atkBonus: 1 } }
  }
};
data.classes.wizard.progression = {
  hpGain: '1d6',
  levels: {
    '2': { choices: ['wizard_arcane_bolt', 'wizard_meditation'] },
    '3': { choices: ['wizard_scorch', 'wizard_frost'], stats: { atkBonus: 1 } },
    '4': { choices: ['wizard_empower', 'wizard_counterspell'] },
    '5': { choices: ['wizard_arcane_bolt', 'wizard_scorch'] }
  }
};
data.classes.paladin.progression = {
  hpGain: '1d10',
  levels: {
    '2': { choices: ['paladin_bless', 'paladin_holy_armor'] },
    '3': { choices: ['paladin_radiant_strike', 'paladin_aura'] },
    '4': { choices: ['paladin_divine_wrath', 'paladin_faith_shield'] },
    '5': { choices: ['paladin_bless', 'paladin_radiant_strike'], stats: { atkBonus: 1 } }
  }
};

const ordered = {
  meta: data.meta,
  progression: data.progression,
  classes: data.classes,
  items: data.items,
  enemies: data.enemies,
  npcs: data.npcs,
  quests: data.quests,
  scenes: data.scenes
};

fs.writeFileSync(filePath, JSON.stringify(ordered, null, 2), 'utf8');
console.log('OK:', filePath);
