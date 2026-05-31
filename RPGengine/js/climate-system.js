// Интеграция сезонов и погоды с движком
(function () {
  const CLIMATE_FIELDS = ['text', 'location', 'dialogue', 'components', 'choices', 'audio'];

  const NEARBY_LIGHTNING_TEXTS = [
    '⚡ Молния бьёт в дерево в нескольких шагах от вас — сердце замирает, пальцы онемели от страха.',
    '⚡ Ослепительная вспышка где-то рядом — удар грома оглушает, вы машинально пригибаетесь.',
    '⚡ Небо раскалывается над головой, но разряд уходит в землю в стороне. На миг кажется, что мир переворачивается.',
    '⚡ Молния ударила в крышу соседнего дома — запах гари, в ушах звенит, ноги подкашиваются.',
    '⚡ Вспышка на мгновение ослепляет; гром приходит через секунду, и вы не можете сдержать вздрагивание.'
  ];

  function getSceneClimate(raw) {
    if (!raw) return null;
    return raw.climate && typeof raw.climate === 'object' ? raw.climate : null;
  }

  function getVariants(raw, key) {
    const climate = getSceneClimate(raw);
    return raw?.[key] || climate?.[key] || null;
  }

  function installClimateHooks() {
    if (typeof GameEngine === 'undefined') return false;
    if (GameEngine._climateHooksInstalled) return true;

    Object.assign(GameEngine, {
      isClimateEnabled() {
        return !!(this.seasonSystem?.isEnabled?.() !== false && this.data?.settings?.climate?.enabled !== false);
      },

      initClimateSystems() {
        const cfg = this.data?.settings?.climate || {};
        if (cfg.enabled === false) return;
        if (!this.timeSystem) {
          this.initTimeSystem?.();
        } else {
          this.timeSystem.syncFromData?.(this);
        }
        if (typeof SeasonSystem !== 'undefined') {
          this.seasonSystem = SeasonSystem.init(this, cfg);
        }
        if (typeof WeatherSystem !== 'undefined') {
          this.weatherSystem = WeatherSystem.init(this, cfg);
        }
        if (this.state?.gameSeason && this.seasonSystem) {
          this.seasonSystem.loadState(this.state.gameSeason);
          this.seasonSystem.updateSeason();
        }
        if (this.state?.gameWeather && this.weatherSystem) {
          this.weatherSystem.loadState(this.state.gameWeather);
        }
        this.updateClimateUI?.();
      },

      getSceneClimateConfig(sceneId) {
        const raw = this.data?.scenes?.[sceneId];
        return getSceneClimate(raw);
      },

      applyClimateVariants(scene, rawSource) {
        if (!rawSource) return scene;

        if (this.seasonSystem?.isEnabled?.() !== false) {
          const season = this.seasonSystem?.state?.season;
          const sv = getVariants(rawSource, 'seasonVariants');
          const sVar = sv?.[season];
          if (sVar) {
            CLIMATE_FIELDS.forEach((f) => {
              if (sVar[f] !== undefined) scene[f] = this.cloneSceneData(sVar[f]);
            });
            scene._season = season;
          }
        }

        if (this.weatherSystem) {
          const wt = this.weatherSystem.state?.current;
          const wv = getVariants(rawSource, 'weatherVariants');
          const wVar = wv?.[wt];
          if (wVar) {
            if (wVar.closed) scene._climateClosed = true;
            CLIMATE_FIELDS.forEach((f) => {
              if (wVar[f] !== undefined) scene[f] = this.cloneSceneData(wVar[f]);
            });
            scene._weather = wt;
          }
        }
        return scene;
      },

      getClimateOperatingHours(params) {
        if (!params) return null;
        let hours = params.operatingHours || null;
        if (!hours) return null;
        const seasonal = params.seasonalHours !== false && hours.seasonal !== false;
        if (this.seasonSystem && seasonal) {
          hours = this.seasonSystem.applyToOperatingHours(hours, true);
        }
        return hours;
      },

      isClimateOpen(params) {
        if (!this.isTimeSystemEnabled?.()) return true;
        const hours = this.getClimateOperatingHours(params);
        if (!hours) return true;
        if (params?.weatherDependent && this.weatherSystem?.isShelterRequired?.()) {
          return false;
        }
        if (this.state?.scene && getVariants(this.data?.scenes?.[this.state.scene], 'weatherVariants')?.[this.weatherSystem?.state?.current]?.closed) {
          return false;
        }
        return this.isOpen(hours.open, hours.close);
      },

      refreshSceneForClimate(force) {
        const sceneId = this.state?.scene;
        if (!sceneId || this.state?.combat) return;
        const raw = this.data?.scenes?.[sceneId];
        const hasClimate = raw?.climate || raw?.timeVariants || raw?.seasonVariants || raw?.weatherVariants;
        if (!hasClimate) return;

        const period = this.getTimePeriod?.();
        const season = this.seasonSystem?.state?.season;
        const weather = this.weatherSystem?.state?.current;
        const key = `${period}|${season}|${weather}`;
        if (!force && this._lastSceneClimateKey === key) return;
        this._lastSceneClimateKey = key;

        this.runSceneWeatherEvents?.(raw);

        const scene = this.getProcessedScene(sceneId);
        if (scene.text) this.setText(scene.text);
        if (scene.location) this.setLocation(scene.location);
        if (scene.dialogue?.length) this.setDialogue(scene.dialogue);
        else this.clearDialogue?.();

        if (this.hasSceneComponents?.(scene)) {
          this.renderSceneComponents(sceneId, scene);
        } else if (scene.choices) {
          this.setChoices(this.withWaterRefillChoices(scene.choices, raw));
        }
        this.refreshServiceMenus?.();
      },

      runSceneWeatherEvents(raw) {
        const events = raw?.climate?.weatherEvents;
        if (!Array.isArray(events) || !this.weatherSystem) return;
        const cur = this.weatherSystem.state.current;
        events.forEach((ev) => {
          if (!ev || ev.weather !== cur) return;
          if (ev.action === 'random_lightning') return;
          const chance = (parseInt(ev.chance, 10) || 0) / 100;
          if (Math.random() > chance) return;
          this.triggerWeatherEvent(ev.action || 'show_text', ev.params || ev);
        });
      },

      isPlayerIndoors(sceneId) {
        const id = sceneId || this.state?.scene;
        if (!id || !this.data?.scenes) return false;
        const raw = this.data.scenes[id];
        if (!raw) return false;
        const cl = raw.climate || {};
        if (cl.indoor === true || cl.outdoor === false || raw.indoor === true) return true;
        if (cl.indoor === false || cl.outdoor === true || raw.indoor === false) return false;
        if (raw.parent) return this.isPlayerIndoors(raw.parent);
        return false;
      },

      triggerNearbyLightning() {
        if (this.isPlayerIndoors?.()) return;
        const pool = NEARBY_LIGHTNING_TEXTS;
        const text = pool[Math.floor(Math.random() * pool.length)];
        this.log(text, 'log-dice');
      },

      triggerWeatherEvent(action, params) {
        if (action === 'random_lightning') return;
        if (action === 'show_text' && params?.text) {
          this.log(params.text, 'log-dice');
        } else if (params?.message) {
          this.log(params.message, 'log-dice');
        }
      },

      updateClimateUI() {
        const panel = document.getElementById('climate-panel');
        if (!this.isClimateEnabled?.()) {
          panel?.classList.add('hidden');
          return;
        }
        panel?.classList.remove('hidden');

        const season = this.seasonSystem?.getSeasonDef?.();
        const weather = this.weatherSystem?.WEATHER_TYPES?.[this.weatherSystem?.state?.current];

        const set = (id, val) => {
          const el = document.getElementById(id);
          if (el) el.textContent = val ?? '—';
        };

        set('season-icon', season?.icon);
        set('season-name', season?.name);
        set('weather-icon', weather?.icon);
        set('weather-name', weather?.name);
        set('temp-display', `${this.seasonSystem?.state?.temperature ?? '—'}°C`);
        set('date-display', this.seasonSystem?.getDateString?.() || '');
        set('mobile-compact-weather', weather?.icon || '☀️');

        const effectsEl = document.getElementById('climate-effects');
        if (effectsEl && weather?.effects) {
          effectsEl.innerHTML = '';
          const e = weather.effects;
          const addTag = (icon, val, title) => {
            if (!val) return;
            const tag = document.createElement('span');
            tag.className = 'effect-tag';
            const sign = val > 0 ? '+' : '';
            tag.textContent = `${icon}${sign}${val}`;
            tag.title = title || '';
            effectsEl.appendChild(tag);
          };
          if (e.fireSpells?.damageMod) addTag('🔥', e.fireSpells.damageMod, 'Огонь');
          if (e.electricSpells?.damageMod) addTag('⚡', e.electricSpells.damageMod, 'Электричество');
          if (e.coldSpells?.damageMod) addTag('❄️', e.coldSpells.damageMod, 'Холод');
          if (e.rangedAttack) addTag('🏹', e.rangedAttack, 'Дальний бой');
          if (e.travelSpeed && e.travelSpeed !== 1) {
            addTag('🚶', `${Math.round(e.travelSpeed * 100)}%`, 'Скорость');
          }
        }

        this.timeSystem?.updateUI?.();
      },

      checkEnvironmentalHazards() {
        if (!this.isClimateEnabled?.() || this.state?.combat) return;
        const exposure = this.seasonSystem?.checkExposure?.();
        if (exposure?.damage) {
          const dmg = this.parseRoll?.(exposure.damage) || 0;
          if (dmg > 0) {
            this.takeDamage(dmg);
            const label = exposure.type === 'cold' ? 'Холод' : 'Жара';
            this.log(`${exposure.type === 'cold' ? '❄️' : '🥵'} ${label} наносит ${dmg} урона!`, 'log-damage');
          }
        }
        const wEff = this.weatherSystem?.getCurrentEffects?.();
        if (wEff?.bluntDamage?.perRound) {
          const dmg = this.parseRoll?.(wEff.bluntDamage.perRound) || 0;
          if (dmg > 0) {
            this.takeDamage(dmg);
            this.log(`🧊 Град наносит ${dmg} урона!`, 'log-damage');
          }
        }
      },

      applyClimateSpellMods(baseDmg, damageType) {
        let dmg = baseDmg;
        const dt = (damageType || 'physical').toLowerCase();
        const map = { fire: 'fire', cold: 'cold', ice: 'cold', lightning: 'electric', thunder: 'thunder', acid: 'acid' };
        const spellType = map[dt] || dt;
        const fail = this.weatherSystem?.getSpellFailChance?.(spellType) || 0;
        if (fail > 0 && Math.random() < fail) {
          this.log('❌ Заклинание не сработало из-за погоды!', 'log-damage');
          return 0;
        }
        dmg += this.weatherSystem?.getSpellDamageMod?.(spellType) || 0;
        const seasonBonus = this.seasonSystem?.getSeasonEffects?.()?.fireDamageBonus;
        if (dt === 'fire' && seasonBonus) dmg += seasonBonus;
        return Math.max(0, dmg);
      }
    });

    // applyTimeOfDayVariant: поддержка climate.timeVariants
    const origApplyTime = GameEngine.applyTimeOfDayVariant;
    if (origApplyTime) {
      GameEngine.applyTimeOfDayVariant = function (scene, rawSource) {
        const merged = typeof rawSource === 'object' && rawSource?.timeVariants
          ? rawSource
          : { timeVariants: getVariants(rawSource, 'timeVariants') };
        return origApplyTime.call(this, scene, merged);
      };
    }

    // getProcessedScene: climate variants после time
    if (!GameEngine._climateProcessedWrapped) {
      const origGet = GameEngine.getProcessedScene;
      GameEngine.getProcessedScene = function (sceneId) {
        const scene = origGet.call(this, sceneId);
        if (!scene) return scene;
        const raw = this.resolveSceneDefinition?.(sceneId) || this.data?.scenes?.[sceneId];
        this.applyClimateVariants(scene, raw);
        this.weatherSystem?.setRegionForScene?.(sceneId);
        return scene;
      };
      GameEngine._climateProcessedWrapped = true;
    }

    // showScene: climate region + events
    if (!GameEngine._climateShowSceneWrapped) {
      const origShow = GameEngine.showScene;
      GameEngine.showScene = function (sceneId, options) {
        this.weatherSystem?.setRegionForScene?.(sceneId);
        const r = origShow.call(this, sceneId, options);
        this._lastSceneClimateKey = null;
        this.updateClimateUI?.();
        return r;
      };
      GameEngine._climateShowSceneWrapped = true;
    }

    // Time hooks
    if (!GameEngine._climateTimeWrapped && GameEngine.timeSystem) {
      const ts = TimeSystem;
      const origHour = ts.onHourChange.bind(ts);
      ts.onHourChange = function () {
        origHour();
        GameEngine.weatherSystem?.onHourTick?.();
        GameEngine.seasonSystem?.updateTemperature?.();
        GameEngine.updateClimateUI?.();
      };
      const origDay = ts.onDayChange.bind(ts);
      ts.onDayChange = function () {
        origDay();
        GameEngine.seasonSystem?.advanceDays?.(1);
      };
      GameEngine._climateTimeWrapped = true;
    }

    // Wrap climate time on install if time not yet init
    if (!GameEngine._climateTimeInstallWrapped) {
      const origInitTime = GameEngine.initTimeSystem;
      GameEngine.initTimeSystem = function (...args) {
        const r = origInitTime?.apply(this, args);
        if (!GameEngine._climateTimeWrapped && typeof TimeSystem !== 'undefined') {
          const ts = TimeSystem;
          const origHour = ts.onHourChange.bind(ts);
          ts.onHourChange = function () {
            origHour();
            GameEngine.weatherSystem?.onHourTick?.();
            GameEngine.seasonSystem?.updateTemperature?.();
            GameEngine.updateClimateUI?.();
          };
          const origDay = ts.onDayChange.bind(ts);
          ts.onDayChange = function () {
            origDay();
            GameEngine.seasonSystem?.advanceDays?.(1);
          };
          GameEngine._climateTimeWrapped = true;
        }
        return r;
      };
      GameEngine._climateTimeInstallWrapped = true;
    }

    if (!GameEngine._climateApplyDataWrapped) {
      const orig = GameEngine.applyGameData;
      GameEngine.applyGameData = function (...args) {
        const r = orig.apply(this, args);
        this.initClimateSystems?.();
        return r;
      };
      GameEngine._climateApplyDataWrapped = true;
    }

    if (!GameEngine._climateFinalizeWrapped) {
      const orig = GameEngine.finalizeCharacter;
      GameEngine.finalizeCharacter = function (...args) {
        const r = orig.apply(this, args);
        this.initClimateSystems?.();
        return r;
      };
      GameEngine._climateFinalizeWrapped = true;
    }

    if (!GameEngine._climateLoadWrapped) {
      const orig = GameEngine.loadGame;
      GameEngine.loadGame = function (...args) {
        const ok = orig.apply(this, args);
        if (ok) this.initClimateSystems?.();
        return ok;
      };
      GameEngine._climateLoadWrapped = true;
    }

    if (!GameEngine._climateSaveWrapped) {
      const orig = GameEngine.saveGame;
      GameEngine.saveGame = function (...args) {
        if (this.seasonSystem) this.state.gameSeason = this.seasonSystem.getSaveState();
        if (this.weatherSystem) this.state.gameWeather = this.weatherSystem.getSaveState();
        return orig.apply(this, args);
      };
      GameEngine._climateSaveWrapped = true;
    }

    // Combat: ranged weather mod
    if (!GameEngine._climateCombatWrapped) {
      const origAttack = GameEngine.playerAttack;
      GameEngine.playerAttack = function (idx, weaponSlot) {
        const slot = weaponSlot === 'weapon_off' ? 'weapon_off' : 'weapon_main';
        const wid = this.getEquippedItemId?.(slot);
        const weapon = wid ? this.data?.items?.[wid] : null;
        const isRanged = weapon?.range === 'ranged' || weapon?.type === 'ranged'
          || (weapon?.tags || []).includes('ranged');
        this._climateRangedAttack = isRanged;
        return origAttack.call(this, idx, weaponSlot);
      };
      GameEngine._climateCombatWrapped = true;
    }

    if (!GameEngine._climateAtkWrapped) {
      const origAtk = GameEngine.getEffectivePlayerAtkBonus;
      if (typeof origAtk === 'function') {
        GameEngine.getEffectivePlayerAtkBonus = function () {
          let atk = origAtk.call(this);
          if (this._climateRangedAttack && this.weatherSystem) {
            atk += this.weatherSystem.getAttackModifier(true);
          }
          return atk;
        };
      }
      GameEngine._climateAtkWrapped = true;
    }

    // Player turn hazards
    if (!GameEngine._climateTurnWrapped) {
      const origNext = GameEngine.nextCombatTurn;
      GameEngine.nextCombatTurn = function (...args) {
        const turn = this.state.combat?.order?.[this.state.combat?.turnIndex];
        if (turn?.type === 'player') {
          this.checkEnvironmentalHazards?.();
        }
        return origNext.apply(this, args);
      };
      GameEngine._climateTurnWrapped = true;
    }

    GameEngine._climateHooksInstalled = true;
    return true;
  }

  if (!installClimateHooks()) {
    document.addEventListener('DOMContentLoaded', installClimateHooks);
  }
})();
