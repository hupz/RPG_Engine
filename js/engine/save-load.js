// ============================================================
// engine/save-load.js — сохранение и загрузка (многослотовое)
// ============================================================

(function attachEngineSaveLoad() {
  'use strict';
  if (typeof GameEngine === 'undefined') {
    console.error('engine/save-load.js: GameEngine не определён — загрузите core.js первым');
    return;
  }

  const SAVE_SLOTS = 5;

  function trKey(k, p) {
    if (typeof I18n !== 'undefined' && typeof I18n.t === 'function') return I18n.t(k, p);
    if (typeof t === 'function') return t(k, p);
    return k;
  }

  Object.assign(GameEngine, {
    SAVE_SLOTS,

    /** Базовый ключ кампании (слот 1 — легаси без суффикса). */
    getSaveBaseKey() {
      return this.getActiveCampaign().saveKey;
    },

    getSaveKeyForSlot(slot) {
      const base = this.getSaveBaseKey();
      const n = Math.max(1, Math.min(SAVE_SLOTS, parseInt(slot, 10) || 1));
      return n === 1 ? base : `${base}#slot${n}`;
    },

    getActiveSaveSlotStorageKey() {
      return `${this.getSaveBaseKey()}#activeSlot`;
    },

    restoreActiveSaveSlot() {
      try {
        const raw = localStorage.getItem(this.getActiveSaveSlotStorageKey());
        const n = parseInt(raw, 10);
        if (n >= 1 && n <= SAVE_SLOTS) this._activeSaveSlot = n;
      } catch (_) { /* ignore */ }
      if (!this._activeSaveSlot) this._activeSaveSlot = 1;
    },

    persistActiveSaveSlot() {
      localStorage.setItem(this.getActiveSaveSlotStorageKey(), String(this.getActiveSaveSlot()));
    },

    getActiveSaveSlot() {
      if (!this._activeSaveSlot) this.restoreActiveSaveSlot();
      return this._activeSaveSlot || 1;
    },

    setActiveSaveSlot(slot) {
      this._activeSaveSlot = Math.max(1, Math.min(SAVE_SLOTS, parseInt(slot, 10) || 1));
      this.persistActiveSaveSlot();
    },

    /** Текущий ключ автосохранения (активный слот). */
    getSaveKey() {
      return this.getSaveKeyForSlot(this.getActiveSaveSlot());
    },

    readSaveSlotRaw(slot) {
      try {
        return localStorage.getItem(this.getSaveKeyForSlot(slot));
      } catch (_) {
        return null;
      }
    },

    readSaveSlotData(slot) {
      const raw = this.readSaveSlotRaw(slot);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch (_) {
        return null;
      }
    },

    isSaveSlotOccupied(slot) {
      const data = this.readSaveSlotData(slot);
      return !!(data?.charName?.trim() && data?.className);
    },

    /** Слот для автопродолжения: активный → слот 1 (легаси) → любой занятый. */
    resolveStartupSaveSlot() {
      this.restoreActiveSaveSlot();
      const active = this.getActiveSaveSlot();
      if (this.isSaveSlotOccupied(active)) return active;
      if (this.isSaveSlotOccupied(1)) return 1;
      for (let i = 2; i <= SAVE_SLOTS; i++) {
        if (this.isSaveSlotOccupied(i)) return i;
      }
      return 1;
    },

    _playtimeSessionStart: 0,
    _playtimeSec: 0,

    syncPlaytimeClock() {
      if (!this._playtimeSessionStart) {
        this._playtimeSessionStart = Date.now();
        return;
      }
      const elapsed = Math.floor((Date.now() - this._playtimeSessionStart) / 1000);
      if (elapsed > 0) {
        this._playtimeSec = (this._playtimeSec || 0) + elapsed;
        this._playtimeSessionStart = Date.now();
      }
    },

    getPlaytimeSec() {
      this.syncPlaytimeClock();
      return this._playtimeSec || 0;
    },

    setPlaytimeFromSave(sec) {
      this._playtimeSec = Math.max(0, parseInt(sec, 10) || 0);
      this._playtimeSessionStart = Date.now();
    },

    formatPlaytime(sec) {
      const total = Math.max(0, parseInt(sec, 10) || 0);
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      return `${m}:${String(s).padStart(2, '0')}`;
    },

    deriveSaveMeta(data) {
      if (!data || typeof data !== 'object') return null;
      if (data.meta && typeof data.meta === 'object') return { ...data.meta };
      const sceneId = data.scene || '';
      const scene = this.data?.scenes?.[sceneId];
      const savedAt = data.timestamp
        ? new Date(data.timestamp).toISOString()
        : null;
      return {
        savedAt,
        sceneId,
        sceneName: scene?.title || scene?.location || sceneId || '',
        playtimeSec: data.meta?.playtimeSec ?? 0,
        charLevel: parseInt(data.level, 10) || 1,
        charName: data.charName || ''
      };
    },

    buildSaveMeta() {
      this.syncPlaytimeClock();
      const sceneId = this.state.scene || '';
      const scene = this.data?.scenes?.[sceneId];
      return {
        savedAt: new Date().toISOString(),
        sceneId,
        sceneName: scene?.title || scene?.location || sceneId || '',
        playtimeSec: this.getPlaytimeSec(),
        charLevel: parseInt(this.state.level, 10) || 1,
        charName: this.state.charName || ''
      };
    },

    listSaveSlots() {
      const slots = [];
      for (let i = 1; i <= SAVE_SLOTS; i++) {
        const data = this.readSaveSlotData(i);
        slots.push({
          slot: i,
          empty: !data,
          occupied: this.isSaveSlotOccupied(i),
          meta: data ? this.deriveSaveMeta(data) : null,
          active: i === this.getActiveSaveSlot()
        });
      }
      return slots;
    },

    /**
     * Сохранение в localStorage.
     * @param {{ force?: boolean, quiet?: boolean, slot?: number, skipConfirm?: boolean }} [opts]
     */
    saveGame(opts = {}) {
      if (opts.force) {
        return this.persistSave(opts);
      }
      this._saveDirty = true;
      return true;
    },

    autosaveOnSceneChange(prevSceneId) {
      if (prevSceneId === this.state.scene) return;
      this._saveDirty = false;
      this.persistSave({ quiet: true });
    },

    buildSavePayload() {
      return {
        version: this.data?.meta?.version || '2.0',
        timestamp: Date.now(),
        charName: this.state.charName,
        className: this.state.className,
        gender: this.state.gender || 'male',
        raceKey: this.state.raceKey || '',
        heritageId: this.state.heritageId || '',
        pf2eFixedBoosts: this.state.pf2eFixedBoosts || null,
        pf2eFreeBoosts: this.state.pf2eFreeBoosts || null,
        stats: this.state.stats,
        hp: this.state.hp,
        maxHp: this.state.maxHp,
        baseMaxHp: this.state.baseMaxHp,
        gold: this.state.gold,
        inventory: this.state.inventory,
        flags: this.state.flags,
        variables: this.state.variables || {},
        scene: this.state.scene,
        supplies: this.state.supplies,
        resources: this.state.resources,
        questSaveVersion: 2,
        questProgress: (typeof QuestRuntime !== 'undefined'
          ? (QuestRuntime.bind(this), QuestRuntime.serializeAll())
          : (this.state.questProgress || {})),
        questStages: (typeof QuestRuntime !== 'undefined'
          ? (QuestRuntime._mirrorProgressToLegacyStages(), this.state.questStages || {})
          : (this.state.questStages || {})),
        level: this.state.level,
        exp: this.state.exp,
        expAwarded: this.state.expAwarded,
        classData: this.state.classData,
        proficiencies: this.state.proficiencies || { skills: [] },
        skills: this.state.skills || {},
        skillIncreases: this.state.skillIncreases || [],
        equipped: this.state.equipped || {},
        curseEffects: this.state.curseEffects || {},
        itemEnhancements: this.state.itemEnhancements || {},
        itemCharges: this.state.itemCharges || {},
        resumeAfterLevelUp: this.state.resumeAfterLevelUp,
        favoredEnemyTypes: this.state.favoredEnemyTypes || [],
        wildShape: this.state.wildShape || null,
        transformation: this.state.transformation || null,
        passiveTransformModifiers: this.state.passiveTransformModifiers || [],
        crafting: this.state.crafting || { knownRecipes: [] },
        sceneVisits: this.state.sceneVisits || {},
        visitedLocations: this.state.visitedLocations || {},
        clearedCombats: this.state.clearedCombats || {},
        gameTime: this.timeSystem?.getSaveState?.() || this.state.gameTime || null,
        gameSeason: this.seasonSystem?.getSaveState?.() || this.state.gameSeason || null,
        gameWeather: this.weatherSystem?.getSaveState?.() || this.state.gameWeather || null,
        achievementUnlocks: this.state.achievementUnlocks || {}
      };
    },

    persistSave(opts = {}) {
      try {
        const slot = opts.slot != null ? opts.slot : this.getActiveSaveSlot();
        const saveData = this.buildSavePayload();
        saveData.meta = this.buildSaveMeta();
        localStorage.setItem(this.getSaveKeyForSlot(slot), JSON.stringify(saveData));
        this.setActiveSaveSlot(slot);
        if (!opts.quiet) {
          this.log('💾 Игра сохранена успешно', 'log-heal');
        }
        return true;
      } catch (e) {
        console.error(e);
        this.log('❌ Ошибка сохранения', 'log-damage');
        return false;
      }
    },

    async saveToSlot(slot, opts = {}) {
      const n = Math.max(1, Math.min(SAVE_SLOTS, parseInt(slot, 10) || 1));
      if (!opts.skipConfirm && this.isSaveSlotOccupied(n)) {
        const ok = await GameDialogs.confirm('', trKey('game.saveSlots.overwrite', { n }));
        if (!ok) return false;
      }
      return this.persistSave({ ...opts, slot: n, quiet: opts.quiet, force: true });
    },

    loadSave(slot) {
      return this.loadGame(slot);
    },

    _applySavePayload(data) {
      this.state.charName = data.charName || 'Герой';
      this.state.className = data.className;
      this.state.gender = data.gender || 'male';
      this.state.raceKey = data.raceKey || '';
      this.state.raceData = this.state.raceKey ? this.getRaceData(this.state.raceKey) : null;
      this.state.heritageId = data.heritageId || '';
      this.state.pf2eFixedBoosts = data.pf2eFixedBoosts || null;
      this.state.pf2eFreeBoosts = data.pf2eFreeBoosts || null;
      this.state.stats = data.stats || data.classData?.stats || null;
      this.state.hp = parseInt(data.hp) || 25;
      this.state.maxHp = parseInt(data.maxHp) || 25;
      this.state.baseMaxHp = data.baseMaxHp != null ? parseInt(data.baseMaxHp, 10) : null;
      this.state._lastComputedMaxHp = this.state.maxHp;
      this.state.gold = parseInt(data.gold) || 0;
      this.state.inventory = data.inventory || [];
      this.state.flags = data.flags || {};
      this.applyStartingFlags();
      if (typeof RuntimeVariables !== 'undefined' && RuntimeVariables.applyFromSave) {
        RuntimeVariables.applyFromSave(this, data.variables);
      } else {
        this.state.variables = data.variables && typeof data.variables === 'object' ? { ...data.variables } : {};
      }
      this.state.scene = data.scene || 'village';
      this.state.supplies = parseInt(data.supplies) || 0;
      this.state.questStages = data.questStages || {};
      this.state.questProgress = data.questProgress || {};
      if (typeof QuestRuntime !== 'undefined') {
        QuestRuntime.bind(this);
        QuestRuntime.hydrateFromSave(this);
      }
      this.migrateSaveQuestStages();
      this.state.resources = data.resources || { mode: 'energy', current: 2, max: 2, spellSlots: null };
      this.migrateResourcesState();
      this.state.level = parseInt(data.level, 10) || 1;
      this.state.exp = parseInt(data.exp, 10) || 0;
      this.state.expAwarded = data.expAwarded || {};
      this.state.pendingLevelUp = null;
      this.state.resumeAfterLevelUp = data.resumeAfterLevelUp || null;
      this.state.sceneVisits = data.sceneVisits || {};
      this.state.visitedLocations = data.visitedLocations || {};
      this.state.clearedCombats = data.clearedCombats || {};
      this.state.achievementUnlocks = data.achievementUnlocks || {};
      this.migrateClearedCombatsFromSave();
      this.migrateQuestMapUnlocksFromSave();
      this.migrateVisitedLocations();
      this.state.itemCharges = data.itemCharges || {};
      this.migrateSuppliesState();
      this.migrateArrowAmmoState();
      if (this.state.inventory.includes('water_flask')) {
        this.initItemChargesOnAdd('water_flask');
      }

      this.state.equipped = data.equipped || {};
      this.state.curseEffects = data.curseEffects || {};
      this.state.itemEnhancements = data.itemEnhancements || {};
      this.migrateEquippedSlots();
      this.migrateCurseState();
      this.migrateMillAccessFlag();
      this.migrateAlbertQuestState();

      if (this.state.className && !this.data?.classes?.[this.state.className]) {
        this.state.className = 'warrior';
        this.log('⚠️ Неизвестный класс в сохранении — выбран Воин.', 'log-dice');
      }

      const savedProf = data.proficiencies?.skills;
      if (Array.isArray(savedProf)) {
        this.state.proficiencies = { skills: savedProf.map(s => String(s).toLowerCase()) };
      } else if (data.classData?.skillIds?.length) {
        this.state.proficiencies = { skills: [...data.classData.skillIds] };
      } else {
        this.state.proficiencies = { skills: [] };
      }

      this.state.skills = data.skills && typeof data.skills === 'object' ? { ...data.skills } : {};
      this.state.skillIncreases = Array.isArray(data.skillIncreases) ? [...data.skillIncreases] : [];
      this.migratePf2eSkillsState();
      this.state.favoredEnemyTypes = Array.isArray(data.favoredEnemyTypes)
        ? [...data.favoredEnemyTypes]
        : [];
      this.state.wildShape = data.wildShape && typeof data.wildShape === 'object'
        ? { ...data.wildShape, knownForms: [...(data.wildShape.knownForms || [])] }
        : null;
      this.state.transformation = data.transformation && typeof data.transformation === 'object'
        ? { ...data.transformation }
        : null;
      this.state.passiveTransformModifiers = Array.isArray(data.passiveTransformModifiers)
        ? [...data.passiveTransformModifiers]
        : [];
      if (this.state.passiveTransformModifiers.length && typeof this.applyTransformModifiers === 'function') {
        this.applyTransformModifiers(this.state.passiveTransformModifiers);
      }
      if (data.gameTime && typeof data.gameTime === 'object') {
        this.state.gameTime = { ...data.gameTime };
        if (this.timeSystem) {
          this.timeSystem.loadState(this.state.gameTime);
          this.timeSystem.updateUI?.();
        }
      }
      if (typeof this.migrateWildShapeState === 'function') {
        this.migrateWildShapeState();
      }
      this.state.crafting = data.crafting && typeof data.crafting === 'object'
        ? { knownRecipes: [...(data.crafting.knownRecipes || [])] }
        : null;
      this.migrateCraftingState();

      if (data.classData && data.className) {
        this.state.classData = data.classData;
        if (!this.state.classData.skillIds?.length && this.state.proficiencies.skills.length) {
          this.state.classData.skillIds = [...this.state.proficiencies.skills];
        }
        this.state.classData.abilities = this.reconcileAbilities(
          this.state.classData.abilities,
          data.className
        );
        const race = this.getRaceData(this.state.raceKey);
        const racial = this.buildRacialAbilities(race);
        racial.forEach(ab => {
          if (!this.state.classData.abilities.some(a => a.id === ab.id)) {
            this.state.classData.abilities.push(
              this.normalizeAbility(ab, data.className, this.state.classData.abilities.length)
            );
          }
        });
      } else if (this.state.className && this.data?.classes?.[this.state.className]) {
        const cls = this.data.classes[this.state.className];
        const resource = cls.resource || { name: 'Ресурс', max: 2, desc: '' };
        this.state.classData = {
          ac: cls.ac ?? 10,
          atkBonus: cls.atkBonus ?? 0,
          dmgRoll: cls.dmgRoll || '1d6',
          dmgBonus: cls.dmgBonus ?? 0,
          initBonus: cls.initBonus ?? 0,
          stats: JSON.parse(JSON.stringify(cls.stats || {})),
          skills: cls.skills || '',
          resourceName: resource.name,
          resourceDesc: resource.desc || '',
          abilities: this.normalizeAbilities(cls.abilities, this.state.className)
        };
        if (!Object.keys(this.state.equipped).length) {
          this.autoEquipStartingGear(this.state.className);
        }
      }

      if (this.state.classData) {
        this.recalculateCombatStats();
      }

      const meta = this.deriveSaveMeta(data);
      this.setPlaytimeFromSave(meta?.playtimeSec ?? 0);

      this.hideCharacterCreator();
      document.getElementById('class-screen')?.classList.add('hidden');
      document.getElementById('name-screen')?.classList.add('hidden');
      this.ensurePlayerUIVisible({ force: true });

      this.setCharName(this.state.charName);
      this.renderClassDisplay(this.state.className);
      this.migratePf2eSkillsState();
      this.updateUI();

      const resLabel = document.getElementById('resource-label');
      if (resLabel && this.state.classData?.resourceName) {
        resLabel.textContent = this.state.classData.resourceName;
      }

      this.showScene(this.state.scene);
      this.migrateFavoredEnemyState();
    },

    loadGame(slot) {
      try {
        const n = slot != null
          ? Math.max(1, Math.min(SAVE_SLOTS, parseInt(slot, 10) || 1))
          : this.getActiveSaveSlot();
        const saved = this.readSaveSlotRaw(n);
        if (!saved) {
          this.log('💾 Сохранений не найдено', 'log-dice');
          return false;
        }

        const data = JSON.parse(saved);
        this.setActiveSaveSlot(n);
        this._applySavePayload(data);
        this.log('✅ Сохранение загружено', 'log-heal');
        return true;
      } catch (e) {
        console.error('Ошибка загрузки:', e);
        this.log('❌ Ошибка загрузки сохранения', 'log-damage');
        return false;
      }
    },

    async deleteSaveSlot(slot) {
      const n = Math.max(1, Math.min(SAVE_SLOTS, parseInt(slot, 10) || 1));
      if (!(await GameDialogs.confirm('', trKey('game.saveSlots.deleteConfirm', { n })))) return false;
      localStorage.removeItem(this.getSaveKeyForSlot(n));
      this.log('🗑 Сохранение удалено', 'log-dice');
      this.renderSaveSlotsPanel();
      return true;
    },

    /** @deprecated используйте deleteSaveSlot или панель слотов */
    async deleteSave() {
      return this.deleteSaveSlot(this.getActiveSaveSlot());
    },

    openSaveSlotsPanel() {
      const modal = document.getElementById('save-slots-modal');
      if (!modal) return;
      modal.classList.remove('hidden');
      this.renderSaveSlotsPanel();
      document.getElementById('panel-menu')?.classList.remove('open');
    },

    closeSaveSlotsPanel() {
      document.getElementById('save-slots-modal')?.classList.add('hidden');
    },

    formatSaveSlotDate(iso) {
      if (!iso) return '—';
      try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleString(undefined, {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });
      } catch (_) {
        return '—';
      }
    },

    renderSaveSlotsPanel() {
      const list = document.getElementById('save-slots-list');
      if (!list) return;
      const slots = this.listSaveSlots();
      list.innerHTML = slots.map((entry) => {
        const { slot, occupied, meta, active } = entry;
        const slotLabel = trKey('game.saveSlots.slotLabel', { n: slot });
        const activeBadge = active
          ? `<span class="save-slot-active">${this.escapeHtml(trKey('game.saveSlots.active'))}</span>`
          : '';
        let body;
        if (!occupied || !meta) {
          body = `<div class="save-slot-empty">${this.escapeHtml(trKey('game.saveSlots.empty'))}</div>`;
        } else {
          const dateStr = this.formatSaveSlotDate(meta.savedAt);
          body = `
            <div class="save-slot-meta">
              <div class="save-slot-char">${this.escapeHtml(meta.charName || '—')}</div>
              <div class="save-slot-detail">${this.escapeHtml(trKey('game.saveSlots.level', { level: meta.charLevel || 1 }))}</div>
              <div class="save-slot-detail">${this.escapeHtml(trKey('game.saveSlots.scene', { name: meta.sceneName || meta.sceneId || '—' }))}</div>
              <div class="save-slot-detail">${this.escapeHtml(trKey('game.saveSlots.playtime', { time: this.formatPlaytime(meta.playtimeSec) }))}</div>
              <div class="save-slot-date">${this.escapeHtml(trKey('game.saveSlots.savedAt', { date: dateStr }))}</div>
            </div>`;
        }
        const loadBtn = occupied
          ? `<button type="button" class="choice save-slot-btn" onclick="GameEngine.loadGame(${slot}); GameEngine.closeSaveSlotsPanel();">${this.escapeHtml(trKey('game.saveSlots.load'))}</button>`
          : '';
        const deleteBtn = occupied
          ? `<button type="button" class="choice panel-menu-danger save-slot-btn" onclick="GameEngine.deleteSaveSlot(${slot})">${this.escapeHtml(trKey('game.saveSlots.delete'))}</button>`
          : '';
        return `
          <div class="save-slot-row${active ? ' save-slot-row-active' : ''}" data-slot="${slot}">
            <div class="save-slot-head">
              <span class="save-slot-title">${this.escapeHtml(slotLabel)}</span>
              ${activeBadge}
            </div>
            ${body}
            <div class="save-slot-actions">
              <button type="button" class="start-btn save-slot-btn" onclick="GameEngine.saveToSlot(${slot}).then(function(ok){ if(ok) GameEngine.renderSaveSlotsPanel(); })">${this.escapeHtml(trKey('game.saveSlots.save'))}</button>
              ${loadBtn}
              ${deleteBtn}
            </div>
          </div>`;
      }).join('');
    }
  });
})();

// dataVersion migration on load
(function patchSaveLoadMigration() {
  if (typeof GameEngine === 'undefined') return;
  const migrate = (data) => {
    if (typeof ProjectDataSchema !== 'undefined' && data) {
      return ProjectDataSchema.migrateProjectData(data);
    }
    return data;
  };
  const origLoad = GameEngine.loadGame;
  if (typeof origLoad === 'function' && !GameEngine._dataSchemaPatched) {
    GameEngine._dataSchemaPatched = true;
    GameEngine.loadGame = function (...args) {
      const r = origLoad.apply(this, args);
      if (this.data) this.data = migrate(this.data);
      return r;
    };
  }
  if (typeof GameEngine.init === 'function' && !GameEngine._dataSchemaInitPatched) {
    GameEngine._dataSchemaInitPatched = true;
    const oi = GameEngine.init.bind(GameEngine);
    GameEngine.init = function (...args) {
      if (this.data) this.data = migrate(this.data);
      return oi(...args);
    };
  }
})();
