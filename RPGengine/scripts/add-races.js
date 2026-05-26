const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../data/game_data.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

if (!data.races) {
  data.races = {
    human: {
      id: 'human',
      name: 'Человек',
      icon: '🧑',
      description: 'Универсальные и амбициозные. Люди встречаются повсюду и преуспевают во всём.',
      asi: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
      speed: 30,
      traits: [
        {
          id: 'human_versatility',
          name: 'Универсальность',
          desc: '+1 ко всем характеристикам отражает адаптивность людей.',
          type: 'passive'
        }
      ],
      bonusSkills: [],
      languages: ['Общий']
    },
    elf: {
      id: 'elf',
      name: 'Эльф',
      icon: '🧝',
      description: 'Грациозные и долгоживущие. Эльфы обладают острым восприятием и врождённой магией.',
      asi: { dex: 2 },
      speed: 30,
      traits: [
        {
          id: 'darkvision_elf',
          name: 'Тёмное зрение',
          desc: 'Видите в темноте на расстоянии 60 футов как в тусклом свете.',
          type: 'passive'
        },
        {
          id: 'fey_ancestry',
          name: 'Наследие фейри',
          desc: 'Преимущество на спасброски от очарования; нельзя усыпить магией.',
          type: 'resistance'
        },
        {
          id: 'keen_senses',
          name: 'Острые чувства',
          desc: 'Владение навыком Восприятие.',
          type: 'proficiency'
        }
      ],
      bonusSkills: ['perception'],
      languages: ['Общий', 'Эльфийский']
    },
    dwarf: {
      id: 'dwarf',
      name: 'Дварф',
      icon: '⛏️',
      description: 'Крепкие и стойкие. Дварфы — мастера камня, металла и войны.',
      asi: { con: 2 },
      speed: 25,
      traits: [
        {
          id: 'darkvision_dwarf',
          name: 'Тёмное зрение',
          desc: 'Видите в темноте на расстоянии 60 футов.',
          type: 'passive'
        },
        {
          id: 'dwarven_resilience',
          name: 'Дварфская стойкость',
          desc: 'Преимущество на спасброски от яда; сопротивление урону ядом.',
          type: 'resistance'
        },
        {
          id: 'combat_training',
          name: 'Боевая подготовка',
          desc: 'Владение боевым топором, ручным топором, лёгким и боевым молотом.',
          type: 'proficiency'
        }
      ],
      bonusSkills: [],
      languages: ['Общий', 'Дварфийский']
    },
    halfling: {
      id: 'halfling',
      name: 'Полурослик',
      icon: '🌿',
      description: 'Маленькие, удачливые и отважные. Полурослики ценят уют, но не боятся приключений.',
      asi: { dex: 2 },
      speed: 25,
      traits: [
        {
          id: 'lucky',
          name: 'Удачливый',
          desc: 'При выпадении 1 на к20 можно перебросить кубик (раз за проверку).',
          type: 'passive'
        },
        {
          id: 'brave',
          name: 'Храбрый',
          desc: 'Преимущество на спасброски от испуга.',
          type: 'resistance'
        },
        {
          id: 'nimble',
          name: 'Проворный',
          desc: 'Можете перемещаться через пространство существ крупнее вас.',
          type: 'passive'
        }
      ],
      bonusSkills: [],
      languages: ['Общий', 'Полуросликов']
    },
    dragonborn: {
      id: 'dragonborn',
      name: 'Драконорождённый',
      icon: '🐉',
      description: 'Потомки драконов. Гордые, сильные, с оружием дыхания.',
      asi: { str: 2, cha: 1 },
      speed: 30,
      traits: [
        {
          id: 'breath_weapon',
          name: 'Оружие дыхания',
          desc: 'Раз за короткий отдых: конус 15 фт, 2к6 урона огнём (спасбросок ЛОВ DC 13 — половина).',
          type: 'active'
        },
        {
          id: 'damage_resistance_fire',
          name: 'Сопротивление огню',
          desc: 'Сопротивление урону огнём.',
          type: 'resistance'
        }
      ],
      bonusSkills: [],
      languages: ['Общий', 'Драконий']
    },
    tiefling: {
      id: 'tiefling',
      name: 'Тифлинг',
      icon: '😈',
      description: 'Потомки инфернальных существ. Харизматичные, с тёмным наследием.',
      asi: { cha: 2, int: 1 },
      speed: 30,
      traits: [
        {
          id: 'darkvision_tiefling',
          name: 'Тёмное зрение',
          desc: 'Видите в темноте на расстоянии 60 футов.',
          type: 'passive'
        },
        {
          id: 'hellish_resistance',
          name: 'Адское сопротивление',
          desc: 'Сопротивление урону огнём.',
          type: 'resistance'
        },
        {
          id: 'infernal_legacy',
          name: 'Инфернальное наследие',
          desc: 'Знаете заговор «Тауматургия». На 3 уровне — «Адское возмездие» (1/день).',
          type: 'passive'
        }
      ],
      bonusSkills: [],
      languages: ['Общий', 'Инфернальный']
    }
  };
  console.log('Created data.races section');
} else {
  console.log('data.races already exists — skipped');
}

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('OK: races added to game_data.json');
