// Система времени года
(function () {
  const { DEFAULT_SEASONS, MONTH_NAMES } = window.ClimateData || {};

  const SeasonSystem = {
    SEASONS: DEFAULT_SEASONS,
    state: { month: 3, day: 15, season: 'spring', temperature: 12, year: 4720 },
    engine: null,
    config: { enabled: true },

    init(engine, config = {}) {
      this.engine = engine;
      this.config = { enabled: config.enabled !== false, ...config };
      this.SEASONS = this.mergeSeasons(config.seasons || engine?.data?.settings?.climate?.seasons);

      const start = config.startDate || engine?.data?.settings?.climate?.startDate || {};
      if (engine?.state?.gameSeason) {
        this.loadState(engine.state.gameSeason);
      } else {
        this.state.month = start.month ?? config.startMonth ?? 3;
        this.state.day = start.day ?? 15;
        this.state.year = start.year ?? config.startYear ?? 4720;
      }
      this.updateSeason();
      return this;
    },

    mergeSeasons(overrides) {
      const base = JSON.parse(JSON.stringify(DEFAULT_SEASONS || {}));
      if (!overrides || typeof overrides !== 'object') return base;
      Object.keys(overrides).forEach((key) => {
        if (!base[key]) base[key] = { id: key, ...overrides[key] };
        else Object.assign(base[key], overrides[key]);
      });
      return base;
    },

    isEnabled() {
      return this.config.enabled !== false;
    },

    loadState(saved) {
      if (!saved) return;
      Object.assign(this.state, saved);
    },

    getSaveState() {
      return { ...this.state };
    },

    getSeasonDef(id) {
      return this.SEASONS[id || this.state.season] || this.SEASONS.spring;
    },

    updateSeason() {
      const m = this.state.month;
      for (const [key, season] of Object.entries(this.SEASONS)) {
        if (season.months?.includes(m)) {
          this.state.season = key;
          break;
        }
      }
      this.updateTemperature();
      this.engine?.weatherSystem?.onSeasonChange?.();
    },

    updateTemperature() {
      const season = this.getSeasonDef();
      if (!season?.tempRange) return;
      const base = (season.tempRange.min + season.tempRange.max) / 2;
      const variance = (season.tempRange.max - season.tempRange.min) / 2;
      const random = (Math.random() * 2 - 1) * variance;
      const hour = this.engine?.timeSystem?.state?.hour ?? 12;
      const dayMod = hour >= 8 && hour <= 16 ? 0 : -5;
      const regionTemp = this.engine?.weatherSystem?.getRegionBaseTemp?.() || 0;
      this.state.temperature = Math.round(base + random + dayMod + regionTemp);
    },

    advanceDays(days) {
      const d = Math.max(0, parseInt(days, 10) || 0);
      if (!d) return;
      const prevSeason = this.state.season;
      this.state.day += d;
      while (this.state.day > 30) {
        this.state.day -= 30;
        this.state.month += 1;
        if (this.state.month > 12) {
          this.state.month = 1;
          this.state.year += 1;
        }
      }
      this.updateSeason();
      if (this.state.season !== prevSeason) {
        this.engine?.log?.(`🍂 Смена сезона: ${this.getSeasonDef().icon} ${this.getSeasonDef().name}`, 'log-dice');
        this.engine?.refreshSceneForClimate?.(true);
      }
      this.syncState();
      this.engine?.updateClimateUI?.();
    },

    syncState() {
      if (this.engine?.state) this.engine.state.gameSeason = this.getSaveState();
    },

    getOperatingHourModifier() {
      const season = this.getSeasonDef();
      const dusk = season.dayLength?.dusk ?? 19;
      const summerDusk = this.SEASONS.summer?.dayLength?.dusk ?? 22;
      const winterDusk = this.SEASONS.winter?.dayLength?.dusk ?? 17;
      if (dusk >= summerDusk - 1) return 1;
      if (dusk <= winterDusk + 1) return -1;
      return 0;
    },

    applyToOperatingHours(baseHours, seasonal = true) {
      if (!baseHours) return baseHours;
      const open = parseInt(baseHours.open ?? baseHours.openHour, 10);
      const close = parseInt(baseHours.close ?? baseHours.closeHour, 10);
      if (Number.isNaN(open) || Number.isNaN(close)) return baseHours;
      const mod = seasonal ? this.getOperatingHourModifier() : 0;
      return { open, close: close + mod };
    },

    getSeasonEffects() {
      return this.getSeasonDef()?.effects || {};
    },

    getDateString() {
      const mn = MONTH_NAMES[this.state.month] || `Мес.${this.state.month}`;
      return `${this.state.day} ${mn} ${this.state.year}`;
    },

    checkExposure() {
      const effects = this.getSeasonEffects();
      const temp = this.state.temperature;
      if (effects.coldDamage && temp < 0) {
        return { type: 'cold', ...effects.coldDamage };
      }
      if (effects.heatExhaustion && temp > 30) {
        const hour = this.engine?.timeSystem?.state?.hour;
        if (hour >= (effects.heatExhaustion.hour ?? 12)) {
          return { type: 'heat', ...effects.heatExhaustion };
        }
      }
      return null;
    },

    getPeriodBounds() {
      const dl = this.getSeasonDef()?.dayLength;
      if (!dl) return null;
      return dl;
    }
  };

  window.SeasonSystem = SeasonSystem;
})();
