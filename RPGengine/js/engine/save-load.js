// ============================================================
// engine/save-load.js — сохранение и загрузка
// ============================================================

(function attachEngineSaveLoad() {
  'use strict';
  if (typeof GameEngine === 'undefined') {
    console.error('engine/save-load.js: GameEngine не определён — загрузите core.js первым');
    return;
  }

  Object.assign(GameEngine, {
    /**
     * Сохранение в localStorage.
     * @param {{ force?: boolean, quiet?: boolean }} [opts]
     * force — сразу (кнопка «Сохранить»); иначе отложено до смены сцены.
     */
    saveGame(opts = {}) {
      if (opts.force) {
        return this.persistSave(opts);
      }
      this._saveDirty = true;
      return true;
    },

    /** Автосохранение только при переходе на другую сцену */
    autosaveOnSceneChange(prevSceneId) {
      if (prevSceneId === this.state.scene) return;
      this._saveDirty = false;
      this.persistSave({ quiet: true });
    },

    persistSave(opts = {}) {
      try {
        const saveData = {
          version: this.data?.meta?.version || "2.0",
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
          scene: this.state.scene,
          supplies: this.state.supplies,
          resources: this.state.resources,
          questStages: this.state.questStages,
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

        localStorage.setItem(this.getSaveKey(), JSON.stringify(saveData));
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

    /** Загрузка сохранения (алиас для loadGame) */
    loadSave() {
      return this.loadGame();
    },

        loadGame() {
      try {
        const saved = localStorage.getItem(this.getSaveKey());
        if (!saved) {
          this.log('💾 Сохранений не найдено', 'log-dice');
          return false;
        }

        const data = JSON.parse(saved);

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
        this.state.scene = data.scene || 'village';
        this.state.supplies = parseInt(data.supplies) || 0;
        this.state.questStages = data.questStages || {};
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

        // Переключение экранов
        this.hideCharacterCreator();
        document.getElementById('class-screen').classList.add('hidden');
        document.getElementById('name-screen').classList.add('hidden');
        this.ensurePlayerUIVisible({ force: true });

        // Обновление интерфейса
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

        this.log('✅ Сохранение загружено', 'log-heal');
        return true;
      } catch (e) {
        console.error('Ошибка загрузки:', e);
        this.log('❌ Ошибка загрузки сохранения', 'log-damage');
        return false;
      }
    },

    deleteSave() {
      if (confirm('Удалить сохранение игры?')) {
        localStorage.removeItem(this.getSaveKey());
        this.log('🗑 Сохранение удалено', 'log-dice');
      }
    }
  });
})();
