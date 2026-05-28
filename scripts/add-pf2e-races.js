const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../data/game_data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

if (!data.races) data.races = {};

const PF2E_RACES = {
  human_pf2e: {
    id: 'human_pf2e',
    system: 'pf2e',
    name: 'Человек (PF2e)',
    icon: '🧑',
    description: 'Универсальные и амбициозные. Два свободных буста характеристик.',
    abilityBoosts: ['str', 'dex', 'con', 'int'],
    speed: 25,
    hp: 8,
    size: 'medium',
    heritages: [
      { id: 'versatile_human', name: 'Разносторонний', desc: 'Получите общую черту 1-го уровня.' },
      { id: 'skilled_human', name: 'Умелый', desc: 'Тренирован в одном навыке на ваш выбор.' }
    ],
    traits: [
      { id: 'human_natural_ambition', name: 'Природная амбиция', desc: '+1 к проверкам характеристик для получения опыта.', type: 'passive' }
    ],
    languages: ['Общий']
  },
  elf_pf2e: {
    id: 'elf_pf2e',
    system: 'pf2e',
    name: 'Эльф (PF2e)',
    icon: '🧝',
    description: 'Грациозные и долгоживущие. Бусты ЛОВ, ИНТ и свободный.',
    abilityBoosts: ['dex', 'int', 'free'],
    speed: 30,
    hp: 6,
    size: 'medium',
    heritages: [
      { id: 'ancient_elf', name: 'Древний эльф', desc: 'Тренированы в Аркане или Природе.' },
      { id: 'woodland_elf', name: 'Лесной эльф', desc: 'Скорость 30 футов, игнорируете сложную местность в лесах.' }
    ],
    traits: [
      { id: 'low_light_vision_elf', name: 'Ночное зрение', desc: 'Видите в тусклом свете как при ярком.', type: 'passive' },
      { id: 'elven_immunities', name: 'Эльфийский иммунитет', desc: 'Иммунитет к магическому сну.', type: 'resistance' }
    ],
    languages: ['Общий', 'Эльфийский']
  },
  dwarf_pf2e: {
    id: 'dwarf_pf2e',
    system: 'pf2e',
    name: 'Дварф (PF2e)',
    icon: '⛏️',
    description: 'Крепкие и стойкие. Бусты ТЕЛ, МУД и свободный.',
    abilityBoosts: ['con', 'wis', 'free'],
    speed: 20,
    hp: 10,
    size: 'medium',
    heritages: [
      { id: 'strong_blooded_dwarf', name: 'Крепкая кровь', desc: 'Спасброски от яда +1.' },
      { id: 'rock_dwarf', name: 'Скальный дварф', desc: 'Сопротивление урону ядом.' }
    ],
    traits: [
      { id: 'darkvision_dwarf', name: 'Тёмное зрение', desc: 'Видите в темноте как в тусклом свете.', type: 'passive' },
      { id: 'dwarven_toughness', name: 'Дварфская стойкость', desc: '+1 к спасброскам от ядов.', type: 'resistance' }
    ],
    languages: ['Общий', 'Дварфийский']
  },
  halfling_pf2e: {
    id: 'halfling_pf2e',
    system: 'pf2e',
    name: 'Полурослик (PF2e)',
    icon: '🌿',
    description: 'Маленькие, удачливые и отважные. Бусты ЛОВ, МУД и свободный.',
    abilityBoosts: ['dex', 'wis', 'free'],
    speed: 25,
    hp: 6,
    size: 'small',
    heritages: [
      { id: 'gutsy_halfling', name: 'Отважный', desc: '+1 к спасброскам от эмоций.' },
      { id: 'nomadic_halfling', name: 'Кочевой', desc: 'Тренированы в Выживании.' }
    ],
    traits: [
      { id: 'keen_eyes', name: 'Острые глаза', desc: '+2 к Восприятию для поиска скрытых существ.', type: 'passive' },
      { id: 'halfling_luck', name: 'Удача полурослика', desc: 'Раз в день перебросьте проваленную проверку.', type: 'active' }
    ],
    languages: ['Общий', 'Полуросликов']
  },
  gnome_pf2e: {
    id: 'gnome_pf2e',
    system: 'pf2e',
    name: 'Гном (PF2e)',
    icon: '🎭',
    description: 'Любопытные и магические. Бусты ТЕЛ, ХАР и свободный.',
    abilityBoosts: ['con', 'cha', 'free'],
    speed: 20,
    hp: 8,
    size: 'small',
    heritages: [
      { id: 'fey_touched_gnome', name: 'Коснувшийся фейри', desc: 'Знаете заговор «Призрачный свет».' },
      { id: 'umbral_gnome', name: 'Сумеречный гном', desc: 'Тёмное зрение.' }
    ],
    traits: [
      { id: 'low_light_vision_gnome', name: 'Ночное зрение', desc: 'Видите в тусклом свете как при ярком.', type: 'passive' },
      { id: 'gnome_obsession', name: 'Гномья одержимость', desc: '+1 к проверкам знаний по выбранной теме.', type: 'passive' }
    ],
    languages: ['Общий', 'Гномий', 'Сильван']
  }
};

let added = 0;
for (const [id, race] of Object.entries(PF2E_RACES)) {
  if (!data.races[id]) {
    data.races[id] = race;
    added++;
  }
}

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`PF2e races: added ${added}, total races: ${Object.keys(data.races).length}`);
