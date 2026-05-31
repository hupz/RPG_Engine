// ============================================
// Игровое время суток — часы, периоды, тикер
// ============================================

(function () {
  const PERIOD_ICONS = {
    dawn: '🌅',
    day: '☀️',
    dusk: '🌇',
    night: '🌙'
  };

  const TimeSystem = {
    config: {
      realMinutesPerGameHour: 3,
      startHour: 8,
      startDay: 1,
      hoursPerDay: 24,
      enabled: true
    },

    state: {
      hour: 8,
      minute: 0,
      day: 1,
      totalGameHours: 0
    },

    engine: null,
    ticker: null,
    paused: false,
    _lastPeriod: null,

    resolveScale(engine, config = {}) {
      const ts = engine?.data?.settings?.timeScale;
      let raw;
      if (ts != null && typeof ts === 'object') {
        raw = ts.realMinutesPerGameHour;
      } else if (typeof ts === 'number') {
        raw = ts;
      }
      const n = Number(raw ?? config.realMinutesPerGameHour ?? this.config.realMinutesPerGameHour ?? 3);
      return Number.isFinite(n) && n > 0 ? n : 3;
    },

    buildConfig(engine, config = {}) {
      const ts = engine?.data?.settings?.timeScale;
      const settings = ts != null && typeof ts === 'object' ? ts : {};
      return {
        realMinutesPerGameHour: this.resolveScale(engine, config),
        startHour: Number(settings.startHour ?? config.startHour ?? this.config.startHour ?? 8),
        startDay: Number(settings.startDay ?? config.startDay ?? this.config.startDay ?? 1),
        enabled: settings.enabled !== false && settings.useTimeOfDay !== false
      };
    },

    syncFromData(engine, config = {}) {
      this.engine = engine || this.engine;
      const prevScale = this.config.realMinutesPerGameHour;
      Object.assign(this.config, this.buildConfig(this.engine, config));
      if (this.isEnabled() && this.config.realMinutesPerGameHour !== prevScale) {
        this.startTicker();
      }
      this.updateUI();
      return this;
    },

    init(engine, config = {}) {
      this.engine = engine;
      Object.assign(this.config, this.buildConfig(engine, config));

      if (engine?.state?.gameTime) {
        this.loadState(engine.state.gameTime);
      } else {
        this.state.hour = this.config.startHour ?? 8;
        this.state.day = this.config.startDay ?? 1;
        this.state.minute = 0;
        this.state.totalGameHours = 0;
      }

      this._lastPeriod = this.getPeriod();
      if (this.isEnabled()) {
        this.startTicker();
      }
      this.updateUI();
      return this;
    },

    isEnabled() {
      return this.config.enabled !== false;
    },

    loadState(saved) {
      if (!saved || typeof saved !== 'object') return;
      this.state.hour = Math.max(0, Math.min(23, parseInt(saved.hour, 10) || 0));
      this.state.minute = Math.max(0, Math.min(59, parseInt(saved.minute, 10) || 0));
      this.state.day = Math.max(1, parseInt(saved.day, 10) || 1);
      this.state.totalGameHours = parseInt(saved.totalGameHours, 10) || 0;
    },

    getSaveState() {
      return { ...this.state };
    },

    startTicker() {
      if (!this.isEnabled()) return;
      clearInterval(this.ticker);
      this.ticker = null;
      const scale = this.resolveScale(this.engine, this.config);
      this.config.realMinutesPerGameHour = scale;
      // 1 игровая минута = (scale / 60) реальных минут
      const msPerGameMinute = scale * 1000;
      this.ticker = setInterval(() => {
        if (!this.paused && !this.engine?.state?.combat) {
          this.advance(1);
        }
      }, msPerGameMinute);
    },

    pause() {
      this.paused = true;
    },

    resume() {
      if (!this.isEnabled()) return;
      this.paused = false;
      if (!this.ticker) this.startTicker();
    },

    setScale(realMinutesPerGameHour) {
      const n = Number(realMinutesPerGameHour);
      if (!Number.isFinite(n) || n <= 0) return;
      this.config.realMinutesPerGameHour = n;
      clearInterval(this.ticker);
      this.ticker = null;
      if (this.isEnabled() && !this.paused) this.startTicker();
    },

    advance(gameMinutes) {
      if (!this.isEnabled()) return;
      const mins = Math.max(0, parseInt(gameMinutes, 10) || 0);
      if (!mins) return;

      this.state.minute += mins;
      while (this.state.minute >= 60) {
        this.state.minute -= 60;
        this.state.hour += 1;
        this.state.totalGameHours += 1;
        this.onHourChange();
      }
      while (this.state.hour >= (this.config.hoursPerDay || 24)) {
        this.state.hour -= (this.config.hoursPerDay || 24);
        this.state.day += 1;
        this.onDayChange();
      }

      if (this.engine?.state) {
        this.engine.state.gameTime = this.getSaveState();
      }
      this.updateUI();
    },

    onHourChange() {
      const period = this.getPeriod();
      if (period !== this._lastPeriod) {
        this._lastPeriod = period;
        this.engine?.refreshSceneForTime?.(true);
      }
    },

    onDayChange() {
      this.engine?.log?.(`📅 Наступил день ${this.state.day}.`, 'log-dice');
    },

    getPeriod() {
      const h = this.state.hour;
      const bounds = this.engine?.seasonSystem?.getPeriodBounds?.();
      if (bounds) {
        const dawn = bounds.dawn ?? 5;
        const dayStart = bounds.dayStart ?? 8;
        const dusk = bounds.dusk ?? 17;
        const night = bounds.night ?? 20;
        if (h >= dawn && h < dayStart) return 'dawn';
        if (h >= dayStart && h < dusk) return 'day';
        if (h >= dusk && h < night) return 'dusk';
        return 'night';
      }
      if (h >= 5 && h < 8) return 'dawn';
      if (h >= 8 && h < 17) return 'day';
      if (h >= 17 && h < 20) return 'dusk';
      return 'night';
    },

    getTimeString() {
      return `${String(this.state.hour).padStart(2, '0')}:${String(this.state.minute).padStart(2, '0')}`;
    },

    getDateString() {
      return `День ${this.state.day}, ${this.getTimeString()}`;
    },

    isOpen(openHour, closeHour) {
      const h = this.state.hour;
      const open = parseInt(openHour, 10);
      const close = parseInt(closeHour, 10);
      if (Number.isNaN(open) || Number.isNaN(close)) return true;
      if (close > open) return h >= open && h < close;
      return h >= open || h < close;
    },

    updateUI() {
      const clock = document.getElementById('game-clock');
      const timeDisplay = document.getElementById('time-display');
      const dayDisplay = document.getElementById('day-display');
      const icon = document.getElementById('time-icon');
      const mobileTime = document.getElementById('mobile-compact-time');

      if (timeDisplay) timeDisplay.textContent = this.getTimeString();
      if (dayDisplay) dayDisplay.textContent = `День ${this.state.day}`;
      if (mobileTime) mobileTime.textContent = this.getTimeString();

      const period = this.getPeriod();
      const iconChar = PERIOD_ICONS[period] || '☀️';
      if (icon) icon.textContent = iconChar;

      if (clock) {
        clock.className = 'game-clock';
        if (this.isEnabled()) {
          clock.classList.remove('hidden');
          clock.classList.add(`period-${period}`);
        } else {
          clock.classList.add('hidden');
        }
      }
    },

    destroy() {
      clearInterval(this.ticker);
      this.ticker = null;
    },

    getPeriodBounds() {
      const bounds = this.engine?.seasonSystem?.getPeriodBounds?.();
      if (bounds) {
        return {
          dawn: bounds.dawn ?? 5,
          dayStart: bounds.dayStart ?? 8,
          dusk: bounds.dusk ?? 17,
          night: bounds.night ?? 20
        };
      }
      return { dawn: 5, dayStart: 8, dusk: 17, night: 20 };
    },

    minutesUntilHour(targetHour) {
      const th = ((parseInt(targetHour, 10) % 24) + 24) % 24;
      let diffH = th - this.state.hour;
      if (diffH < 0 || (diffH === 0 && this.state.minute > 0)) diffH += 24;
      if (diffH === 0 && this.state.minute === 0) diffH = 24;
      return diffH * 60 - this.state.minute;
    },

    minutesUntilPeriod(targetPeriod) {
      const p = this.getPeriodBounds();
      const map = {
        dawn: p.dawn,
        day: p.dayStart,
        dusk: p.dusk,
        night: p.night,
        noon: 12,
        midnight: 0
      };
      const hour = map[targetPeriod];
      if (hour === undefined) return 0;
      return this.minutesUntilHour(hour);
    },

    addMinutesToNow(minutes) {
      const add = Math.max(0, parseInt(minutes, 10) || 0);
      const total = this.state.hour * 60 + this.state.minute + add;
      const h = Math.floor(total / 60) % 24;
      const m = total % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    },

    getPeriodAt(hour) {
      const h = ((parseInt(hour, 10) % 24) + 24) % 24;
      const b = this.getPeriodBounds();
      if (h >= b.dawn && h < b.dayStart) return 'dawn';
      if (h >= b.dayStart && h < b.dusk) return 'day';
      if (h >= b.dusk && h < b.night) return 'dusk';
      return 'night';
    },

    formatDuration(minutes) {
      const m = Math.max(0, parseInt(minutes, 10) || 0);
      const h = Math.floor(m / 60);
      const r = m % 60;
      if (h > 0 && r > 0) return `${h} ч. ${r} мин.`;
      if (h > 0) return `${h} ч.`;
      return `${r} мин.`;
    }
  };

  window.TimeSystem = TimeSystem;

  function installTimeHooks() {
    if (typeof GameEngine === 'undefined') return false;
    if (GameEngine._timeHooksInstalled) return true;

    Object.assign(GameEngine, {
      get currentScene() {
        const id = this.state?.scene;
        return id ? (this.data?.scenes?.[id] || null) : null;
      },

      isTimeSystemEnabled() {
        return !!(this.timeSystem?.isEnabled?.());
      },

      initTimeSystem(config) {
        if (typeof TimeSystem === 'undefined') return null;
        if (this.timeSystem?.ticker) {
          this.timeSystem.syncFromData(this, config || {});
        } else {
          this.timeSystem = TimeSystem.init(this, config || {});
        }
        if (this.state) this.state.gameTime = this.timeSystem.getSaveState();
        return this.timeSystem;
      },

      getGameTime() {
        return this.timeSystem?.getTimeString?.() || '—';
      },

      getTimePeriod() {
        return this.timeSystem?.getPeriod?.() || 'day';
      },

      isOpen(openHour, closeHour) {
        if (!this.timeSystem?.isEnabled?.()) return true;
        return this.timeSystem.isOpen(openHour, closeHour);
      },

      advanceTime(minutes) {
        this.timeSystem?.advance?.(minutes);
      },

      setTimeScale(scale) {
        this.timeSystem?.setScale?.(scale);
        if (this.data?.settings) {
          if (!this.data.settings.timeScale) this.data.settings.timeScale = {};
          if (typeof this.data.settings.timeScale === 'object') {
            this.data.settings.timeScale.realMinutesPerGameHour = scale;
          }
        }
      },

      applyTimeOfDayVariant(scene, rawSource) {
        if (!this.isTimeSystemEnabled?.()) return scene;
        const variants = rawSource?.timeVariants;
        if (!variants || typeof variants !== 'object') return scene;
        const period = this.getTimePeriod();
        const variant = variants[period];
        if (!variant) {
          scene._timePeriod = period;
          return scene;
        }
        const fields = ['text', 'location', 'dialogue', 'components', 'choices', 'audio'];
        fields.forEach((field) => {
          if (variant[field] !== undefined && variant[field] !== null) {
            scene[field] = this.cloneSceneData(variant[field]);
          }
        });
        scene._timePeriod = period;
        return scene;
      },

      refreshSceneForTime(force) {
        const sceneId = this.state?.scene;
        if (!sceneId || this.state?.combat || !this.isTimeSystemEnabled?.()) return;
        const raw = this.data?.scenes?.[sceneId];
        const hasTime = raw?.timeVariants || raw?.climate?.timeVariants;
        const hasClimate = raw?.seasonVariants || raw?.weatherVariants
          || raw?.climate?.seasonVariants || raw?.climate?.weatherVariants;
        if (!hasTime && !hasClimate) return;

        const period = this.getTimePeriod();
        if (!force && this._lastSceneTimePeriod === period && !hasClimate) return;
        this._lastSceneTimePeriod = period;

        const scene = this.getProcessedScene(sceneId);
        if (scene.text) this.setText(scene.text);
        if (scene.location) this.setLocation(scene.location);

        if (scene.dialogue?.length) this.setDialogue(scene.dialogue);
        else this.clearDialogue?.();

        if (this.hasSceneComponents?.(scene)) {
          this.renderSceneComponents(sceneId, scene);
        } else if (scene.choices) {
          const rawScene = this.data.scenes[sceneId];
          this.setChoices(this.withWaterRefillChoices(scene.choices, rawScene));
        }

        this.refreshServiceMenus?.();
      },

      refreshServiceMenus() {
        this.refreshSceneComponents?.();
      }
    });

    if (!GameEngine._timeApplyDataWrapped) {
      const orig = GameEngine.applyGameData;
      GameEngine.applyGameData = function (...args) {
        const r = orig.apply(this, args);
        if (!this.timeSystem) {
          this.initTimeSystem?.();
        } else if (this.state?.gameTime) {
          this.timeSystem.loadState(this.state.gameTime);
        }
        this.timeSystem?.updateUI?.();
        return r;
      };
      GameEngine._timeApplyDataWrapped = true;
    }

    if (!GameEngine._timeFinalizeWrapped) {
      const orig = GameEngine.finalizeCharacter;
      GameEngine.finalizeCharacter = function (...args) {
        const r = orig.apply(this, args);
        if (!this.timeSystem) this.initTimeSystem?.();
        else this.timeSystem.syncFromData?.(this);
        return r;
      };
      GameEngine._timeFinalizeWrapped = true;
    }

    if (!GameEngine._timeLoadWrapped) {
      const orig = GameEngine.loadGame;
      GameEngine.loadGame = function (...args) {
        const ok = orig.apply(this, args);
        if (ok && !this.timeSystem) this.initTimeSystem?.();
        return ok;
      };
      GameEngine._timeLoadWrapped = true;
    }

    if (!GameEngine._timeRestWrapped) {
      const orig = GameEngine.rest;
      GameEngine.rest = function (type) {
        const r = orig.call(this, type);
        if (this.timeSystem?.isEnabled?.()) {
          const cfg = this.getRestConfig?.(type);
          const isShort = type === 'short' || (cfg?.hpFraction < 1 && cfg?.hpFraction > 0);
          this.advanceTime(isShort ? 60 : 480);
        }
        return r;
      };
      GameEngine._timeRestWrapped = true;
    }

    if (!GameEngine._timeCombatWrapped) {
      const origStart = GameEngine.startCombat;
      GameEngine.startCombat = function (...args) {
        this.timeSystem?.pause?.();
        return origStart.apply(this, args);
      };
      const origNext = GameEngine.nextCombatTurn;
      GameEngine.nextCombatTurn = function (...args) {
        const r = origNext.apply(this, args);
        if (!this.state?.combat) this.timeSystem?.resume?.();
        return r;
      };
      GameEngine._timeCombatWrapped = true;
    }

    if (!GameEngine._timeModalWrapped) {
      const origShow = GameEngine.showModal;
      GameEngine.showModal = function (...args) {
        this.timeSystem?.pause?.();
        return origShow.apply(this, args);
      };
      const origClose = GameEngine.closeModal;
      GameEngine.closeModal = function (...args) {
        const r = origClose.apply(this, args);
        if (!this.state?.combat) this.timeSystem?.resume?.();
        return r;
      };
      GameEngine._timeModalWrapped = true;
    }

    GameEngine._timeHooksInstalled = true;
    return true;
  }

  if (!installTimeHooks()) {
    document.addEventListener('DOMContentLoaded', installTimeHooks);
  }
})();
