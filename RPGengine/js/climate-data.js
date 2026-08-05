// Базовые данные сезонов и погоды (переопределяются через settings.climate в game_data.json)
(function () {
  const DEFAULT_SEASONS = {
    spring: {
      id: 'spring',
      name: 'Весна',
      icon: '🌸',
      months: [3, 4, 5],
      dayLength: { dawn: 5, dayStart: 6, dusk: 20, night: 21 },
      tempRange: { min: 5, max: 18 },
      weatherWeights: { rain: 0.3, cloudy: 0.3, clear: 0.3, fog: 0.1 },
      effects: {
        description: 'Пробуждение природы. Реки полноводны, дороги размыты.',
        travelSpeed: 0.9,
        foragingBonus: 2
      }
    },
    summer: {
      id: 'summer',
      name: 'Лето',
      icon: '☀️',
      months: [6, 7, 8],
      dayLength: { dawn: 4, dayStart: 5, dusk: 22, night: 23 },
      tempRange: { min: 15, max: 35 },
      weatherWeights: { clear: 0.4, hot: 0.2, rain: 0.2, thunderstorm: 0.15, drought: 0.05 },
      effects: {
        description: 'Зной. В полдень невыносимо жарко.',
        travelSpeed: 1.0,
        waterConsumption: 2,
        fireDamageBonus: 1,
        heatExhaustion: { check: 'fortitude', dc: 15, hour: 12 }
      }
    },
    autumn: {
      id: 'autumn',
      name: 'Осень',
      icon: '🍂',
      months: [9, 10, 11],
      dayLength: { dawn: 6, dayStart: 7, dusk: 19, night: 20 },
      tempRange: { min: 0, max: 15 },
      weatherWeights: { rain: 0.25, cloudy: 0.3, clear: 0.2, fog: 0.15, storm: 0.1 },
      effects: {
        description: 'Листопад. Дороги заметены опавшей листвой.',
        travelSpeed: 0.95,
        stealthBonus: 2,
        foragingBonus: 3
      }
    },
    winter: {
      id: 'winter',
      name: 'Зима',
      icon: '❄️',
      months: [12, 1, 2],
      dayLength: { dawn: 7, dayStart: 8, dusk: 17, night: 18 },
      tempRange: { min: -25, max: 5 },
      weatherWeights: { snow: 0.3, blizzard: 0.1, clear: 0.2, cloudy: 0.2, ice: 0.2 },
      effects: {
        description: 'Мороз. Реки во льду, дороги занесены.',
        travelSpeed: 0.7,
        coldDamage: { check: 'fortitude', dc: 12, damage: '1d6', type: 'cold' },
        fireDamageBonus: 2,
        waterFreezing: true,
        campDifficulty: 2
      }
    }
  };

  const WEATHER_ALIAS = {
    rain: ['light_rain', 'heavy_rain'],
    snow: ['light_snow', 'heavy_snow'],
    clear: ['clear'],
    cloudy: ['cloudy'],
    fog: ['fog'],
    blizzard: ['blizzard'],
    thunderstorm: ['thunderstorm'],
    storm: ['thunderstorm'],
    hot: ['heat_wave'],
    drought: ['drought'],
    ice: ['hail'],
    wind: ['strong_wind']
  };

  const DEFAULT_WEATHER_TYPES = {
    clear: {
      id: 'clear', name: 'Ясно', icon: '☀️', intensity: 1, visibility: 1.0,
      effects: { description: 'Чистое небо, отличная видимость.', rangedAttack: 0, travelSpeed: 1.0 }
    },
    cloudy: {
      id: 'cloudy', name: 'Облачно', icon: '☁️', intensity: 1, visibility: 0.9,
      effects: { description: 'Пасмурно.', lightSpells: { damageMod: -1 }, travelSpeed: 1.0 }
    },
    light_rain: {
      id: 'light_rain', name: 'Небольшой дождь', icon: '🌦️', intensity: 2, visibility: 0.8,
      effects: {
        description: 'Мелкий дождь. Дороги скользкие.',
        rangedAttack: -1, perception: -1,
        fireSpells: { damageMod: -2, dcMod: -1 },
        electricSpells: { dcMod: 1 },
        travelSpeed: 0.9, wet: true
      }
    },
    heavy_rain: {
      id: 'heavy_rain', name: 'Сильный дождь', icon: '⛈️', intensity: 4, visibility: 0.5,
      effects: {
        description: 'Ливень. Видимость нулевая.',
        rangedAttack: -4, perception: -4,
        fireSpells: { damageMod: -4, dcMod: -2, chanceToFail: 0.25 },
        electricSpells: { damageMod: 2, dcMod: 1 },
        travelSpeed: 0.6, wet: true, difficultTerrain: true, chanceOfThunder: 0.3
      }
    },
    light_snow: {
      id: 'light_snow', name: 'Небольшой снег', icon: '🌨️', intensity: 2, visibility: 0.85,
      effects: {
        description: 'Идёт снег.',
        rangedAttack: -1, coldSpells: { damageMod: 1 }, travelSpeed: 0.85, cold: true
      }
    },
    heavy_snow: {
      id: 'heavy_snow', name: 'Сильный снег', icon: '❄️', intensity: 4, visibility: 0.4,
      effects: {
        description: 'Метель.',
        rangedAttack: -5, coldSpells: { damageMod: 2 }, travelSpeed: 0.4, cold: true,
        difficultTerrain: true, chanceOfBlizzard: 0.2
      }
    },
    blizzard: {
      id: 'blizzard', name: 'Пурга', icon: '🌬️❄️', intensity: 5, visibility: 0.2,
      effects: {
        description: 'Пурга. Выживание — главная задача.',
        rangedAttack: -8, travelSpeed: 0.2, cold: true, shelterRequired: true,
        exposureCheck: { dc: 18, damage: '2d6', type: 'cold' }
      }
    },
    thunderstorm: {
      id: 'thunderstorm', name: 'Гроза', icon: '⛈️', intensity: 5, visibility: 0.6,
      effects: {
        description: 'Гроза раскалывает небо.',
        rangedAttack: -3, electricSpells: { damageMod: 3, dcMod: 2 },
        travelSpeed: 0.7, wet: true,
        nearbyLightning: true
      }
    },
    hail: {
      id: 'hail', name: 'Град', icon: '🧊', intensity: 4, visibility: 0.7,
      effects: {
        description: 'Град с небес.',
        rangedAttack: -2, bluntDamage: { perRound: '1d4', type: 'bludgeoning' },
        travelSpeed: 0.5
      }
    },
    fog: {
      id: 'fog', name: 'Туман', icon: '🌫️', intensity: 3, visibility: 0.3,
      effects: {
        description: 'Густой туман.',
        rangedAttack: -4, perception: -6, stealth: 4, travelSpeed: 0.7
      }
    },
    strong_wind: {
      id: 'strong_wind', name: 'Сильный ветер', icon: '💨', intensity: 3, visibility: 0.8,
      effects: { description: 'Ветер срывает шляпы.', rangedAttack: -3, travelSpeed: 0.85 }
    },
    heat_wave: {
      id: 'heat_wave', name: 'Зной', icon: '🥵', intensity: 4, visibility: 1.0,
      effects: {
        description: 'Невыносимая жара.',
        fireSpells: { damageMod: 1 }, coldSpells: { damageMod: -2 }, travelSpeed: 0.7
      }
    },
    drought: {
      id: 'drought', name: 'Засуха', icon: '🏜️', intensity: 3, visibility: 1.0,
      effects: {
        description: 'Земля раскололась от засухи.',
        fireSpells: { damageMod: 2 }, travelSpeed: 0.9
      }
    }
  };

  const MONTH_NAMES = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

  window.ClimateData = {
    DEFAULT_SEASONS,
    DEFAULT_WEATHER_TYPES,
    WEATHER_ALIAS,
    MONTH_NAMES
  };
})();
