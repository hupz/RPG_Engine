// Панель ожидания / медитация (Skyrim T)
(function () {
  const PERIOD_ICONS = { dawn: '🌅', day: '☀️', dusk: '🌇', night: '🌙' };
  const PERIOD_LABELS = { dawn: 'Рассвет', day: 'День', dusk: 'Закат', night: 'Ночь' };

  const WaitSystem = {
    engine: null,

    init(engine) {
      this.engine = engine;
      return this;
    },

    formatDuration(minutes) {
      return this.engine?.timeSystem?.formatDuration?.(minutes)
        || `${minutes} мин.`;
    },

    async executeWait(minutes, opts = {}) {
      const engine = this.engine;
      const ts = engine?.timeSystem;
      minutes = Math.max(0, parseInt(minutes, 10) || 0);
      if (!minutes || !ts) {
        return { success: false, log: 'Не выбрано время для ожидания.' };
      }

      const before = ts.getTimeString();
      const panel = document.getElementById('panel-wait');
      panel?.classList.add('wait-panel-busy');

      await new Promise((r) => setTimeout(r, 350));

      ts.advance(minutes);

      if (opts.rest) {
        this.applyRestWhileWaiting(minutes, !!opts.camp);
      }

      engine.refreshSceneForTime?.(true);
      engine.refreshSceneForClimate?.(true);
      engine.refreshSceneComponents?.();
      engine.updateStats?.();
      engine.updateClimateUI?.();
      ts.updateUI();

      if (!opts.camp) {
        engine.checkEnvironmentalHazards?.();
      }

      engine.saveGame?.();
      panel?.classList.remove('wait-panel-busy');

      const after = ts.getTimeString();
      const period = PERIOD_LABELS[ts.getPeriod()] || ts.getPeriod();
      const weather = engine.weatherSystem?.WEATHER_TYPES?.[engine.weatherSystem?.state?.current]?.name || '—';
      const temp = engine.seasonSystem?.state?.temperature;
      const tempStr = temp != null ? `${temp}°C` : '';

      let log = `⏳ ${before} → ${after} (${this.formatDuration(minutes)})`;
      if (opts.rest) log += '. Вы отдыхали.';
      if (opts.camp) log += ' Лагерь укрывает от непогоды.';
      log += ` ${period}, ${weather}${tempStr ? `, ${tempStr}` : ''}.`;

      return { success: true, log, minutes, before, after };
    },

    applyRestWhileWaiting(minutes, camp) {
      const engine = this.engine;
      const cfg = engine.getRestConfig?.('short') || { hpFraction: 0.5, resourceFraction: 0.5 };
      const hours = minutes / 60;
      const hpGain = Math.floor(engine.state.maxHp * cfg.hpFraction * Math.min(1, hours));
      if (hpGain > 0) {
        engine.state.hp = Math.min(engine.state.maxHp, engine.state.hp + hpGain);
      }
      const resCfg = engine.getClassResourceConfig?.(engine.state.className);
      if (resCfg?.shortRestFull && hours >= 1) {
        engine.restoreAllResources?.();
      } else if (engine.state.resources?.mode === 'spellSlots') {
        Object.values(engine.state.resources.spellSlots || {}).forEach((slot) => {
          const gain = Math.floor(slot.m * cfg.resourceFraction * Math.min(1, hours));
          slot.c = Math.min(slot.m, slot.c + gain);
        });
      } else if (engine.state.resources) {
        engine.state.resources.current = Math.min(
          engine.state.resources.max,
          engine.state.resources.current + Math.floor(engine.state.resources.max * cfg.resourceFraction * Math.min(1, hours))
        );
      }
      if (camp && engine.getSupplyCount?.() > 0 && hours >= 8) {
        engine.consumeOneSupply?.();
        engine.state.hp = engine.state.maxHp;
        engine.restoreAllResources?.();
      }
    }
  };

  const WaitPanel = {
    engine: null,
    _bound: false,

    init(engine) {
      this.engine = engine;
      WaitSystem.init(engine);
      engine.waitSystem = WaitSystem;
      if (!this._bound) {
        this.bindEvents();
        this._bound = true;
      }
    },

    bindEvents() {
      document.querySelectorAll('.wait-preset-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const minutes = parseInt(btn.dataset.minutes, 10);
          const until = btn.dataset.until;
          if (until) this.waitUntil(until);
          else if (minutes) this.wait(minutes);
        });
      });

      document.getElementById('wait-custom-btn')?.addEventListener('click', () => {
        const h = parseInt(document.getElementById('wait-custom-hours')?.value, 10) || 0;
        const m = parseInt(document.getElementById('wait-custom-minutes')?.value, 10) || 0;
        this.wait(h * 60 + m);
      });

      ['wait-custom-hours', 'wait-custom-minutes'].forEach((id) => {
        document.getElementById(id)?.addEventListener('input', () => this.updatePreview());
      });

      document.querySelectorAll('.wait-option input').forEach((el) => {
        el.addEventListener('change', () => this.checkWarnings());
      });
    },

    refresh() {
      this.updateCurrentTime();
      this.updatePresetResults();
      this.updatePreview();
      this.checkWarnings();
    },

    updateCurrentTime() {
      const ts = this.engine?.timeSystem;
      if (!ts) return;

      const set = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
      };

      set('wait-current-time', ts.getTimeString());
      const period = ts.getPeriod();
      set('wait-current-period-icon', PERIOD_ICONS[period] || '☀️');

      const season = this.engine.seasonSystem?.getSeasonDef?.();
      const seasonName = season?.name || '';
      const dateExtra = this.engine.seasonSystem?.getDateString?.() || `День ${ts.state.day}`;
      set('wait-current-date', seasonName ? `${dateExtra}, ${seasonName}` : dateExtra);
    },

    updatePresetResults() {
      const ts = this.engine?.timeSystem;
      if (!ts) return;

      document.querySelectorAll('.wait-preset-btn[data-minutes]').forEach((btn) => {
        const mins = parseInt(btn.dataset.minutes, 10);
        const resultEl = btn.querySelector('.preset-result');
        if (resultEl && mins) resultEl.textContent = `→ ${ts.addMinutesToNow(mins)}`;
      });

      const untilMap = {
        dawn: 'wait-until-dawn',
        dusk: 'wait-until-dusk',
        noon: 'wait-until-noon',
        midnight: 'wait-until-midnight'
      };
      Object.entries(untilMap).forEach(([key, elId]) => {
        const el = document.getElementById(elId);
        if (!el) return;
        const mins = key === 'noon' ? ts.minutesUntilHour(12)
          : key === 'midnight' ? ts.minutesUntilHour(0)
            : ts.minutesUntilPeriod(key);
        el.textContent = `→ ${ts.addMinutesToNow(mins)}`;
      });
    },

    updatePreview() {
      const ts = this.engine?.timeSystem;
      const preview = document.getElementById('wait-preview');
      if (!ts || !preview) return;

      const h = parseInt(document.getElementById('wait-custom-hours')?.value, 10) || 0;
      const m = parseInt(document.getElementById('wait-custom-minutes')?.value, 10) || 0;
      const total = h * 60 + m;

      if (total <= 0) {
        preview.innerHTML = 'Выберите время или укажите часы и минуты…';
        return;
      }

      const after = ts.addMinutesToNow(total);
      const endHour = Math.floor((ts.state.hour * 60 + ts.state.minute + total) / 60) % 24;
      const period = PERIOD_LABELS[ts.getPeriodAt(endHour)] || '—';
      const weather = this.engine.weatherSystem?.WEATHER_TYPES?.[this.engine.weatherSystem?.state?.current]?.name || '—';
      const temp = this.engine.seasonSystem?.state?.temperature;
      const tempStr = temp != null ? `${temp}°C` : '—';

      preview.innerHTML = `Будет: <strong>${ts.getTimeString()} → ${after}</strong> (${period}, ${weather}, ${tempStr})`;
    },

    checkWarnings() {
      const warnings = document.getElementById('wait-warnings');
      const text = document.getElementById('wait-warning-text');
      if (!warnings || !text) return;

      const camp = document.getElementById('wait-option-camp')?.checked;
      const sceneId = this.engine?.state?.scene || '';
      const indoors = this.engine?.isPlayerIndoors?.(sceneId);
      const weather = this.engine?.weatherSystem?.state?.current;
      const period = this.engine?.timeSystem?.getPeriod?.();
      let warning = null;

      if (weather === 'blizzard' && !indoors && !camp) {
        warning = 'В пургу без укрытия или лагеря вы рискуете обморожением.';
      } else if (period === 'night' && this.isDangerous(sceneId) && !indoors && !camp) {
        warning = 'Ночью в дикой местности могут напасть звери…';
      } else if (this.engine?.weatherSystem?.isShelterRequired?.() && !indoors && !camp) {
        warning = 'Текущая погода опасна — лучше найти укрытие или разбить лагерь.';
      }

      if (warning) {
        text.textContent = warning;
        warnings.classList.remove('hidden');
      } else {
        warnings.classList.add('hidden');
      }
    },

    isDangerous(sceneId) {
      const id = (sceneId || '').toLowerCase();
      return ['forest', 'wild', 'mountain', 'swamp', 'dungeon', 'road', 'path', 'mill'].some((k) => id.includes(k));
    },

    getOptions() {
      return {
        rest: !!document.getElementById('wait-option-rest')?.checked,
        camp: !!document.getElementById('wait-option-camp')?.checked
      };
    },

    async wait(minutes) {
      if (this.engine?.state?.combat) {
        this.engine.log('❌ Нельзя ждать в бою!', 'log-damage');
        return;
      }
      const m = parseInt(minutes, 10) || 0;
      if (m <= 0) {
        this.engine?.log('Укажите время ожидания.', 'log-damage');
        return;
      }
      if (typeof SidebarDock !== 'undefined') SidebarDock.closeAll();
      const result = await this.engine.runAction('wait', {
        minutes: m,
        ...this.getOptions(),
        reason: this.getOptions().rest ? 'resting' : 'waiting'
      });
      if (result?.success === false && result?.error === 'cannot_wait_in_combat') {
        this.engine.log('❌ Нельзя ждать в бою!', 'log-damage');
      }
    },

    async waitUntil(target) {
      const ts = this.engine?.timeSystem;
      if (!ts) return;
      let minutes = 0;
      if (target === 'noon') minutes = ts.minutesUntilHour(12);
      else if (target === 'midnight') minutes = ts.minutesUntilHour(0);
      else minutes = ts.minutesUntilPeriod(target);
      await this.wait(minutes);
    }
  };

  window.WaitSystem = WaitSystem;
  window.WaitPanel = WaitPanel;

  function installWaitHooks() {
    if (typeof GameEngine === 'undefined') return false;
    if (GameEngine._waitHooksInstalled) return true;

    GameEngine.openWaitPanel = function () {
      if (this.state?.combat) {
        this.log('❌ Нельзя ждать в бою!', 'log-damage');
        return;
      }
      if (typeof SidebarDock !== 'undefined') {
        if (SidebarDock.activePanel === 'wait') SidebarDock.closeAll();
        else SidebarDock.open('wait');
      }
      WaitPanel.init(this);
      if (SidebarDock?.activePanel === 'wait') WaitPanel.refresh();
    };

    if (!GameEngine._waitKeyHandlerBound) {
      GameEngine._waitKeyHandlerBound = true;
      document.addEventListener('keydown', (e) => {
        if (e.key !== 't' && e.key !== 'T') return;
        const tag = e.target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        e.preventDefault();
        GameEngine.openWaitPanel?.();
      });
    }

    const origFinalize = GameEngine.finalizeCharacter;
    if (origFinalize && !GameEngine._waitFinalizeWrapped) {
      GameEngine.finalizeCharacter = function (...args) {
        const r = origFinalize.apply(this, args);
        WaitPanel.init(this);
        return r;
      };
      GameEngine._waitFinalizeWrapped = true;
    }

    const origApply = GameEngine.applyGameData;
    if (origApply && !GameEngine._waitApplyWrapped) {
      GameEngine.applyGameData = function (...args) {
        const r = origApply.apply(this, args);
        WaitPanel.init(this);
        return r;
      };
      GameEngine._waitApplyWrapped = true;
    }

    const origLoad = GameEngine.loadGame;
    if (origLoad && !GameEngine._waitLoadWrapped) {
      GameEngine.loadGame = function (...args) {
        const ok = origLoad.apply(this, args);
        if (ok) WaitPanel.init(this);
        return ok;
      };
      GameEngine._waitLoadWrapped = true;
    }

    GameEngine._waitHooksInstalled = true;
    return true;
  }

  if (!installWaitHooks()) {
    document.addEventListener('DOMContentLoaded', installWaitHooks);
  }
})();
