// Система погоды
(function () {
  const { DEFAULT_SEASONS, DEFAULT_WEATHER_TYPES, WEATHER_ALIAS } = window.ClimateData || {};

  const WeatherSystem = {
    WEATHER_TYPES: DEFAULT_WEATHER_TYPES,
    state: {
      current: 'clear',
      intensity: 1,
      duration: 0,
      temperature: 20,
      windSpeed: 0,
      humidity: 50,
      region: 'default'
    },
    engine: null,

    init(engine, config = {}) {
      this.engine = engine;
      this.seasonSystem = engine.seasonSystem;
      this.config = config;
      this.regions = config.regions || engine?.data?.settings?.climate?.regions || {};
      if (!this.regions.default) {
        this.regions.default = { baseTemp: 0, weights: null };
      }
      this.WEATHER_TYPES = {
        ...DEFAULT_WEATHER_TYPES,
        ...(config.weatherTypes || engine?.data?.settings?.climate?.weatherTypes || {})
      };

      if (engine?.state?.gameWeather) {
        this.loadState(engine.state.gameWeather);
      } else {
        this.generateWeather(true, true);
      }
      return this;
    },

    loadState(saved) {
      if (!saved) return;
      Object.assign(this.state, saved);
      this.applyWeatherEffects();
    },

    getSaveState() {
      return { ...this.state };
    },

    getRegionConfig(regionId) {
      const rid = regionId || this.state.region || 'default';
      return this.regions[rid] || this.regions.default || {};
    },

    getRegionBaseTemp(regionId) {
      return Number(this.getRegionConfig(regionId).baseTemp) || 0;
    },

    getSceneRegion(sceneId) {
      const scene = this.engine?.data?.scenes?.[sceneId];
      return scene?.climate?.region || scene?.climateRegion || 'default';
    },

    setRegionForScene(sceneId) {
      this.state.region = this.getSceneRegion(sceneId || this.engine?.state?.scene);
    },

    onSeasonChange() {
      this.generateWeather(true);
    },

    onHourTick() {
      if (this.state.duration > 0) {
        this.state.duration -= 1;
      }
      if (this.state.duration <= 0) {
        this.generateWeather(true);
      } else {
        this.checkRandomEvents();
      }
      this.syncState();
    },

    pickWeatherKey(seasonId, regionId) {
      const region = this.getRegionConfig(regionId);
      const season = DEFAULT_SEASONS[seasonId] || DEFAULT_SEASONS.spring;
      let weights = region.weights?.[seasonId] || season.weatherWeights || { clear: 1 };
      if (typeof weights.clear === 'number' && weights.clear > 1) {
        const total = Object.values(weights).reduce((s, v) => s + Number(v), 0) || 100;
        const norm = {};
        Object.entries(weights).forEach(([k, v]) => { norm[k] = Number(v) / total; });
        weights = norm;
      }
      const keys = Object.keys(weights);
      const rand = Math.random();
      let cumulative = 0;
      let selected = keys[0] || 'clear';
      for (const key of keys) {
        cumulative += Number(weights[key]) || 0;
        if (rand <= cumulative) {
          selected = key;
          break;
        }
      }
      const aliases = WEATHER_ALIAS[selected] || [selected];
      return aliases[Math.floor(Math.random() * aliases.length)] || 'clear';
    },

    generateWeather(force = false, silent = false) {
      if (!force && this.state.duration > 0) return;
      const seasonId = this.seasonSystem?.state?.season || 'spring';
      const regionId = this.state.region || 'default';
      const selected = this.pickWeatherKey(seasonId, regionId);
      const weather = this.WEATHER_TYPES[selected] || this.WEATHER_TYPES.clear;

      this.state.current = weather.id || selected;
      this.state.intensity = Math.min(5, Math.max(1,
        (weather.intensity || 1) + Math.floor(Math.random() * 3) - 1
      ));
      this.state.duration = 2 + Math.floor(Math.random() * 8);
      this.state.temperature = this.seasonSystem?.state?.temperature ?? 20;
      this.state.windSpeed = this.calculateWindSpeed(this.state.current, this.state.intensity);
      this.state.humidity = this.calculateHumidity(this.state.current);

      this.applyWeatherEffects();
      this.notifyWeatherChange(silent);
      this.syncState();
    },

    calculateWindSpeed(weatherId, intensity) {
      const base = {
        clear: 5, cloudy: 10, light_rain: 15, heavy_rain: 25, light_snow: 20,
        blizzard: 60, thunderstorm: 40, strong_wind: 35, fog: 5
      };
      return (base[weatherId] || 10) * ((intensity || 1) / 3);
    },

    calculateHumidity(weatherId) {
      const base = {
        clear: 40, cloudy: 60, light_rain: 90, heavy_rain: 95, light_snow: 80,
        fog: 95, drought: 20, heat_wave: 25
      };
      return base[weatherId] || 50;
    },

    transitionTo(newWeatherId) {
      if (!this.WEATHER_TYPES[newWeatherId]) return;
      this.state.current = newWeatherId;
      this.state.duration = Math.max(this.state.duration, 2) + 2;
      this.applyWeatherEffects();
      this.notifyWeatherChange(false);
      this.syncState();
    },

    checkRandomEvents() {
      const weather = this.WEATHER_TYPES[this.state.current];
      if (!weather?.effects) return;
      const eff = weather.effects;
      if (eff.chanceOfThunder && Math.random() < eff.chanceOfThunder) {
        this.transitionTo('thunderstorm');
      }
      if (eff.chanceOfBlizzard && Math.random() < eff.chanceOfBlizzard) {
        this.transitionTo('blizzard');
      }
      if (eff.nearbyLightning && Math.random() < 0.05) {
        this.engine?.triggerNearbyLightning?.();
      }
    },

    applyWeatherEffects() {
      const weather = this.WEATHER_TYPES[this.state.current];
      if (!weather || !this.engine?.state) return;
      this.engine.state.weather = {
        type: this.state.current,
        intensity: this.state.intensity,
        name: weather.name,
        icon: weather.icon,
        effects: { ...weather.effects }
      };
    },

    getCurrentEffects() {
      return this.WEATHER_TYPES[this.state.current]?.effects || {};
    },

    getAttackModifier(isRanged) {
      const eff = this.getCurrentEffects();
      return isRanged ? (eff.rangedAttack || 0) : 0;
    },

    getSpellDamageMod(spellType) {
      const eff = this.getCurrentEffects();
      const key = spellType ? `${spellType}Spells` : null;
      if (!key || !eff[key]) return 0;
      return eff[key].damageMod || 0;
    },

    getSpellDCMod(spellType) {
      const eff = this.getCurrentEffects();
      const key = spellType ? `${spellType}Spells` : null;
      if (!key || !eff[key]) return 0;
      return eff[key].dcMod || 0;
    },

    getSpellFailChance(spellType) {
      const eff = this.getCurrentEffects();
      const key = spellType ? `${spellType}Spells` : null;
      if (!key || !eff[key]) return 0;
      return eff[key].chanceToFail || 0;
    },

    isShelterRequired() {
      return !!this.getCurrentEffects().shelterRequired;
    },

    notifyWeatherChange(silent) {
      const weather = this.WEATHER_TYPES[this.state.current];
      if (!weather) return;
      if (!silent) {
        this.engine?.log?.(`🌦️ Погода: ${weather.icon} ${weather.name}`, 'log-dice');
      }
      this.engine?.updateClimateUI?.();
      if (!silent) this.engine?.refreshSceneForClimate?.(true);
    },

    syncState() {
      if (this.engine?.state) this.engine.state.gameWeather = this.getSaveState();
    }
  };

  window.WeatherSystem = WeatherSystem;
})();
