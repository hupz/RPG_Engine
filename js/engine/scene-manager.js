// ============================================================
// engine/scene-manager.js — сцены, переходы, special
// ============================================================

(function attachEngineSceneManager() {
  'use strict';
  if (typeof GameEngine === 'undefined') {
    console.error('engine/scene-manager.js: GameEngine не определён — загрузите core.js первым');
    return;
  }

  Object.assign(GameEngine, {
    // ========== ОТОБРАЖЕНИЕ СЦЕН ==========

    /** Глубокая копия — не мутирует GAME_DATA / scenes в памяти */
    cloneSceneData(obj) {
      if (obj == null) return obj;
      try {
        return JSON.parse(JSON.stringify(obj));
      } catch (e) {
        if (Array.isArray(obj)) return [...obj];
        if (typeof obj === 'object') return { ...obj };
        return obj;
      }
    },

    /** Поля состояния локации, перекрывающие базовую сцену */
    SCENE_STATE_OVERRIDE_FIELDS: ['text', 'audio', 'choices', 'location', 'special', 'dialogue'],

    applyLocationStateOverrides(scene, stateEntry) {
      this.SCENE_STATE_OVERRIDE_FIELDS.forEach((field) => {
        if (stateEntry[field] !== undefined && stateEntry[field] !== null) {
          scene[field] = this.cloneSceneData(stateEntry[field]);
        }
      });
    },

    /**
     * Сцена с учётом states[]: копия JSON + первое истинное condition (сверху вниз).
     * Базовые combat / flags / items / gold остаются из исходной сцены.
     */
    /** Сцена из JSON с разворотом шаблона (без клонирования) */
    resolveSceneDefinition(sceneId) {
      const raw = this.data?.scenes?.[sceneId];
      if (!raw) return null;
      if (
        raw.sceneTemplate
        && !raw.templateDetached
        && typeof SceneTemplateEngine !== 'undefined'
      ) {
        return SceneTemplateEngine.materializeScene(this.data, raw);
      }
      return raw;
    },

    getProcessedScene(sceneId) {
      const raw = this.data?.scenes?.[sceneId];
      if (!raw) return null;

      const source = this.resolveSceneDefinition(sceneId) || raw;
      const scene = this.cloneSceneData(source);
      scene.id = sceneId;

      if (typeof this.applyTimeOfDayVariant === 'function') {
        this.applyTimeOfDayVariant(scene, source);
      }

      if (!Array.isArray(scene.states) || !scene.states.length) return scene;

      const ctx = this.getConditionContext();

      for (let i = 0; i < scene.states.length; i++) {
        const st = scene.states[i];
        if (st.default === true) continue;
        if (ConditionSystem.matchesSceneState(st, ctx)) {
          this.applyLocationStateOverrides(scene, st);
          scene._activeStateIndex = i;
          scene._activeStateId = st.id || ('state_' + i);
          return scene;
        }
      }

      const fallback = scene.states.find(st => st.default === true);
      if (fallback) {
        this.applyLocationStateOverrides(scene, fallback);
        scene._activeStateIndex = -1;
        scene._activeStateId = fallback.id || 'default';
      }

      if (raw.returnsToHub && raw.hubScene) {
        scene.choices = this.withHubReturnChoices(scene.choices, raw);
      }

      return scene;
    },

    resolveSceneAudioId(audio) {
      if (audio == null || audio === '') return null;
      if (typeof audio === 'string') return audio;
      if (typeof audio === 'object') {
        return audio.ambient || audio.id || audio.track || audio.play || null;
      }
      return null;
    },

    playSceneAudio(audio) {
      if (typeof AudioEngine === 'undefined') return;
      AudioEngine.unlock();

      if (audio == null || audio === '') {
        this._sceneAmbientId = null;
        this._sceneAmbientVolume = undefined;
        AudioEngine.stopAmbient(false);
        return;
      }

      if (typeof audio === 'string') {
        this._sceneAmbientId = audio;
        this._sceneAmbientVolume = undefined;
        AudioEngine.playAmbient(audio, { loop: true });
        return;
      }

      if (typeof audio !== 'object') return;

      const ambientId = audio.ambient || audio.id || audio.track || audio.play || null;
      const vol = audio.volume != null ? Number(audio.volume) : undefined;
      const loop = audio.loop !== false;

      if (ambientId && loop) {
        if (this._sceneAmbientId === ambientId && vol === this._sceneAmbientVolume) {
          AudioEngine.applyAmbientVolume();
        } else {
          this._sceneAmbientId = ambientId;
          this._sceneAmbientVolume = vol;
          AudioEngine.playAmbient(ambientId, { loop: true, volume: vol });
        }
      } else if (ambientId && !loop) {
        this._sceneAmbientId = null;
        this._sceneAmbientVolume = undefined;
        AudioEngine.stopAmbient(false).then(() => {
          AudioEngine.playSFX(ambientId, { volume: vol });
        });
      } else {
        this._sceneAmbientId = null;
        this._sceneAmbientVolume = undefined;
        AudioEngine.stopAmbient(false);
      }

      const sfxEnter = audio.sfxOnEnter || audio.sfx || null;
      if (sfxEnter) {
        AudioEngine.playSFX(sfxEnter, {
          volume: audio.sfxVolume != null ? Number(audio.sfxVolume) : undefined
        });
      }
    },

    showScene(sceneId, options = {}) {
      const prevSceneId = this.state.scene;
      if (typeof SceneElementRunner !== 'undefined') SceneElementRunner.clearRunner(this);
      if (typeof VisualRuntime !== 'undefined' && VisualRuntime.unmount) {
        try { VisualRuntime.unmount(this); } catch (_) { /* ignore */ }
      }
      if (typeof UIRuntime !== 'undefined' && UIRuntime.mountPersistent) {
        try { UIRuntime.mountPersistent(this); } catch (_) { /* ignore */ }
      }
      try {
      this.unlockMillShortcutOnLeave(prevSceneId, sceneId);
      if (sceneId === 'river_bend_search' && this.shouldFailAlbertLocketSearch()) {
        if (!this.isQuestFailed('albert_locket')) {
          this.failQuest('albert_locket', 'failed', { silentLog: false });
        }
        sceneId = 'albert_locket_failed';
      }
      this.state.scene = sceneId;
      if (typeof QuestEvents !== 'undefined') {
        const loc = this.data?.scenes?.[sceneId]?.location || '';
        QuestEvents.emit('SceneEntered', { sceneId, scene: sceneId, location: loc });
        QuestEvents.emit('LocationVisited', { sceneId, scene: sceneId, location: loc });
      }
      if (typeof CombatLog !== 'undefined' && !this.state.combat) {
        const log = CombatLog.getInstance();
        if (log?.active) {
          log.active = false;
          log.host?.classList.remove('combat-log-host--live');
          if (log.hasEntries() && !log.reviewMode) {
            log.enterArchiveMode();
          }
        }
      }
      const rawScene = this.data.scenes[sceneId];
      if (!rawScene) {
        console.error('Сцена не найдена:', sceneId);
        this.setText('Ошибка: сцена "' + sceneId + '" не найдена в данных.');
        this.setChoices([]);
        return;
      }

      const scene = this.getProcessedScene(sceneId);
      const hasComponents = this.hasSceneComponents?.(scene) || this.hasSceneComponents?.(rawScene);

      if (sceneId === 'mill_arrival' || sceneId === 'mill_door') {
        this.migrateMillAccessFlag();
      }
      this.migrateAlbertQuestState();

      const applyRewards = this.shouldApplySceneRewards(sceneId, rawScene, options);
      if (!this.state.sceneVisits) this.state.sceneVisits = {};
      this.state.sceneVisits[sceneId] = (this.state.sceneVisits[sceneId] || 0) + 1;
      if (typeof this.applyFlags === 'function') {
        this.applyFlags({ ['loc_' + sceneId]: true });
      } else if (this.state.flags) {
        this.state.flags['loc_' + sceneId] = true;
      }

      // Обработка специальных сцен (special может прийти из states)
      if (scene.special && !options.fromSpecial && !hasComponents) {
        this.registerMapLocation(scene);
        this.handleSpecialScene(sceneId, scene, options);
        return;
      }

      if (!hasComponents) {
        this.clearSceneComponentsArea?.();
      }

      // Установка локации
      const locEl = document.getElementById('location');
      if (locEl) delete locEl.dataset.atmoAppended;
      this.setLocation(scene.location || '—');
      this.registerMapLocation(scene);

      const useSceneElements = typeof SceneElementRunner !== 'undefined' && typeof SceneElements !== 'undefined';
      if (useSceneElements) {
        SceneElements.ensureMigrated(rawScene);
      }

      // Sync: apply legacy scene.flags (incl. quest_*) before async SceneElementRunner.
      // Quest progress must update before choices/conditions render.
      // set_flag elements remain for non-quest side effects; updateQuest is idempotent for same stage.
      if (applyRewards && rawScene.flags && typeof this.applyFlags === 'function') {
        this.applyFlags(rawScene.flags);
      }

      const onEnterHasMusic = useSceneElements && (rawScene.onEnterElements || []).some((e) => e.type === 'music' && e.enabled !== false);
      if (!onEnterHasMusic) {
        if (scene.audio ?? rawScene.audio) {
          this.playSceneAudio(scene.audio ?? rawScene.audio);
        } else if (typeof WorldHierarchy !== 'undefined') {
          const inhAudio = WorldHierarchy.resolveInheritedAudio(
            WorldHierarchy.getSceneState(this.data, this.state, sceneId)
          );
          if (inhAudio) this.playSceneAudio({ ambient: inhAudio, loop: true });
        }
      }
      if (typeof this.applyInheritedSceneAmbience === 'function') {
        this.applyInheritedSceneAmbience(sceneId);
      }

      // Обработка текста с подстановками
      let text = scene.text || '';
      if (sceneId === 'jack_reward' && this.state.flags.jackRewarded) {
        text = 'Джек перебирает товар на полках. Увидев вас, улыбается.\n\n«А, мой герой! Сумка на месте — всё честно. Заходи, если что понадобится.»';
      } else if (sceneId === 'village_accept' && this.state.flags.haggleWon) {
        text = 'Марта кивает.\n\n«Пятьдесят золотых у тебя — я помню. Иди по тропе на север, не теряй время.»';
      } else if (sceneId === 'village_accept' && this.state.flags.haggleLost) {
        text = 'Марта кивает.\n\n«Двадцать пять — и точка, мы договорились. Мельница ждёт.»';
      }
      this.setText(text);

      // Диалоги
      if (sceneId === 'jack_reward' && this.state.flags.jackRewarded) {
        this.clearDialogue();
      } else if (scene.dialogue && scene.dialogue.length > 0) {
        this.setDialogue(scene.dialogue);
      } else {
        this.clearDialogue();
      }

      if (applyRewards && sceneId === 'epilogue' && this.state.flags.albertSaved) {
        this.handleEpilogueAlbertArrival();
      }

      // Optional Visual overlay (Phase 1.3) — additive; no-op if scene.visual absent
      if (typeof VisualRuntime !== 'undefined' && VisualRuntime.onSceneShown) {
        try { VisualRuntime.onSceneShown(this, sceneId, rawScene); } catch (_) { /* ignore */ }
      }
      if (typeof UIRuntime !== 'undefined' && UIRuntime.onSceneShown) {
        try { UIRuntime.onSceneShown(this, sceneId); } catch (_) { /* ignore */ }
      }

      // Phase E — authoring scene.events.enter (no-code chain)
      const enterSteps = rawScene.events?.enter;
      if (Array.isArray(enterSteps) && enterSteps.length) {
        const eng = this;
        enterSteps.forEach((step) => {
          if (!step || !step.action) return;
          try {
            if (typeof eng.runAction === 'function') {
              Promise.resolve(eng.runAction(step.action, step.params || {}, { source: 'scene_enter' })).catch(function () {});
            } else if (typeof ActionRunner !== 'undefined' && ActionRunner.runV2) {
              ActionRunner.runV2(eng, step.action, step.params || {}, { source: 'scene_enter' });
            }
          } catch (_) { /* ignore */ }
        });
      }

      if (useSceneElements) {
        SceneElementRunner.runSceneFlow(this, {
          sceneId,
          scene,
          rawScene,
          options,
          applyRewards,
          text,
          hasComponents
        });
        return;
      }

      // Legacy fallback (без scene-elements.js)
      if (applyRewards) {
        this.applyFlags(rawScene.flags);
        this.awardSceneExp(rawScene);
        if (rawScene.items) {
          rawScene.items.forEach(itemId => this.addItem(itemId));
        }
        this.awardSceneGold(rawScene, sceneId);
      }
      this.maybeAlbertWalksToVillage(sceneId);
      if (applyRewards && rawScene.npcId) {
        this.applyNpcReputationEffects(rawScene.npcId, 'talk');
      }
      if (rawScene.combat && rawScene.combat.length > 0) {
        if (this.isCombatSceneCleared(sceneId)) {
          const after = rawScene.nextScene;
          if (after && this.data.scenes[after]) {
            this.showScene(after, options);
            return;
          }
        }
        if (!applyRewards) {
          if (scene.choices?.length) {
            this.setChoices(scene.choices);
          } else {
            const bodies = this.formatClearedBodiesMapNote(
              rawScene.clearedMapLabel || this.inferClearedCombatMapLabel(rawScene.combat)
            );
            const note = this.isCombatSceneCleared(sceneId)
              ? `\n\n☠️ Здесь уже лежат ${bodies}. Бой не повторяется.`
              : '\n\n⚠️ Вы уже были здесь — бой не начинается повторно.';
            this.setText((text || '') + note);
            const fallbackTo = rawScene.nextScene
              || this.resolveMapTravelScene(rawScene.mapLocation)
              || 'village';
            if (fallbackTo && this.data.scenes[fallbackTo]) {
              this.setChoices([{ text: '➡️ Продолжить', to: fallbackTo }]);
            } else {
              this.setChoices([]);
            }
          }
          this.renderTravelMenu();
          return;
        }
        const missing = rawScene.combat.filter(eid => !this.data.enemies?.[eid]);
        if (missing.length) {
          console.error('Враги не найдены:', missing.join(', '));
          this.setText('Ошибка данных: не найдены враги: ' + missing.join(', '));
          this.setChoices([]);
          return;
        }
        const enemies = rawScene.combat.map(eid => {
          const e = this.data.enemies[eid];
          return {
            ...e,
            id: eid,
            maxHp: e.hp,
            creatureType: e.creatureType || this.getDefaultCreatureType()
          };
        });
        if (this.tryEnterCombatWithReputation(rawScene, enemies)) return;
        this.startCombat(enemies, rawScene.nextScene, rawScene.combat);
        return;
      }
      if (hasComponents) {
        const sceneWithComponents = scene.components?.length ? scene : { ...scene, components: rawScene.components };
        this.renderSceneComponents(sceneId, sceneWithComponents);
        this._runSceneChainOnEnter?.(sceneWithComponents.components);
        this.renderTravelMenu();
        this.initTooltips();
        return;
      }
      const sceneChoices = this.withWaterRefillChoices(scene.choices, rawScene);
      if (sceneChoices.length) {
        this.setChoices(sceneChoices);
      } else {
        this.setChoices([]);
      }
      this.renderTravelMenu();
      this.initTooltips();
      if (typeof this.getTimePeriod === 'function') {
        this._lastSceneTimePeriod = this.getTimePeriod();
      }
      } finally {
        this.checkAchievements({ type: 'scene_change', sceneId });
        this.autosaveOnSceneChange(prevSceneId);
      }
    },

    handleSpecialScene(sceneId, scene, options = {}) {
      if (typeof SpecialSceneRegistry !== 'undefined' && SpecialSceneRegistry.run(this, sceneId, scene)) {
        return;
      }
      if (this.runSpecialScenePassthrough(sceneId, scene, options)) {
        return;
      }
      const hint = 'Добавьте обработчик через SpecialSceneRegistry.register() или опишите в plugins.specialScenes в JSON.';
      this.setLocation(scene.location || '—');
      this.setText('⚠️ Неизвестный special: «' + scene.special + '».\n\n' + hint + '\n\nЗаполните текст и выборы в редакторе — сцена откроется как обычная.');
      this.setChoices([
        { text: '↺ Попробовать показать как обычную сцену', action: 'special_passthrough:' + sceneId },
        { text: '← Назад', to: this.getSceneExitTarget(scene) }
      ]);
    },

    runSpecialScenePassthrough(sceneId, scene, options = {}) {
      const processed = this.getProcessedScene(sceneId) || scene;
      const hasContent = !!(
        processed.text?.trim()
        || processed.choices?.length
        || processed.dialogue?.length
      );
      if (!hasContent) return false;
      this.showScene(sceneId, { ...options, fromSpecial: true });
      return true;
    },

    handleResetFromSpecial() {
      this.resetGame();
    },

    // ========== СПЕЦИАЛЬНЫЕ ОБРАБОТЧИКИ ==========
    handleHaggle() {
      if (this.state.flags.haggleDone) {
        this.setText('Марта отмахивается: «Мы уже договорились о плате. Больше не торгуюсь.»');
        this.setDialogue([]);
        const scene = this.data?.scenes?.[this.state.scene];
        this.setChoices([{ text: '← Вернуться к разговору с Мартой', to: this.getSceneExitTarget(scene) }]);
        return;
      }
      const roll = this.d20();
      const bonus = this.getSkillBonus('persuasion');
      const total = roll + bonus;

      if (total >= 14) {
        this.state.gold += 50;
        this.setText('Марта хмурится, потом достаёт кошелёк.\n\n«Чёрт с тобой. Пятьдесят. Но если Альберт погиб по твоей вине — ты ответишь перед ополчением.»');
        this.setDialogue([]);
        this.log(`Торг: успех! 50 зм (к20=${roll}+${bonus >= 0 ? '+' : ''}${bonus}=${total})`);
        this.state.flags.haggleWon = true;
      } else {
        this.state.gold += 25;
        this.state.flags.haggleLost = true;
        this.setText('Марта фыркает.\n\n«Двадцать пять — и точка. Не нравится — иди мимо. Других желающих нет.»');
        this.setDialogue([]);
        this.log(`Торг: 25 зм (к20=${roll}+${bonus >= 0 ? '+' : ''}${bonus}=${total})`);
      }
      this.state.flags.haggleDone = true;
      this.updateStats();
      this.setChoices([
        { text: '← Вернуться к разговору с Мартой', to: 'village' }
      ]);
    },

    /** Лавка Джека: универсальный интерфейс покупки/продажи (special shop_jack) */
    handleShopJack(sceneId, scene) {
      const sid = sceneId || this.state.scene;
      const sc = scene || this.data?.scenes?.[sid];
      const visited = this.state.flags.shopVisited;
      if (!visited) this.state.flags.shopVisited = true;

      const welcome = 'Лавка пахнет сухофруктами, кожей и чем-то сладковатым. За прилавком — худой мужчина с хитрой улыбкой и лисьими глазами. Он поправляет жёлтый берет.\n\n«Добро пожаловать! Покупай, продавай — честная цена.»';
      const revisit = 'Джек сидит за прилавком, перебирает бусины на счётах.«Ну, смотри, выбирай.»';
      const merged = {
        ...sc,
        location: sc?.location || 'Лавка Пройдохи Джека',
        text: (sc?.text && sc.text.trim()) ? sc.text : (visited ? revisit : welcome),
        shopConfig: this.getJackShopConfig(sc)
      };
      this.handleShop(sid, merged);
    },

    /** Из лавки — диалог о пропавшей сумке (после возврата снова открывается jack_shop) */
    openJackQuestTalk() {
      if (this.state.combat) return;
      this.state.shopSession = null;
      this.showScene('jack_quest_talk');
    },

    /** После принятия квеста — снова прилавок Джека */
    reopenJackShop() {
      if (this.state.combat) return;
      this.showScene('jack_shop');
    },

    handleForestLoot() {
      const bonus = this.getSkillBonus('perception');
      const roll = this.d20() + bonus;
      if (roll >= 12 && !this.state.flags.forestPotion) {
        this.state.flags.forestPotion = true;
        this.addItem('healing_potion');
        this.setText('В сумке — свёрток из кожи. Внутри бутылочка с рубиновой жидкостью. Зелье лечения.');
        this.log(`Найдено зелье! (${roll})`);
      } else {
        this.setText('Больше ничего ценного. Гнилой хлеб, игральные кости, нож с выбитой рукоятью.');
      }
      this.setChoices([
        { text: 'Продолжить путь', to: 'thicket' }
      ]);
    },

    handleBarnChest() {
      if (!this.state.flags.barnChestOpen) {
        this.state.flags.barnChestOpen = true;
        this.state.gold += 15;
        this.updateStats();
        this.setText('В ящике — старые долота, клочок шерсти, и кошелёк с пятнадцатью золотыми. Сбережения Альберта.');
        this.log('Найдено 15 зм');
      } else {
        this.setText('Ящик пуст.');
      }
      this.setChoices([
        { text: 'Вернуться к мельнице', to: 'mill_arrival' }
      ]);
    },

    handleAttic() {
      const visited = this.state.flags.atticVisited;
      if (!visited) {
        this.state.flags.atticVisited = true;
        this.setText('Чердак просторный. Огромное колесо механизма. Одна шестерня сорвана и лежит в углу. Вал пустой — без неё механизм мёртв.\nНа полу три паза для шестерни.');
        this.setChoices([
          { text: '🔧 Вставить в верхний паз', to: 'mill_attic_gear_top' },
          { text: '🔧 Вставить в средний паз', to: 'mill_attic_gear_mid' },
          { text: '🔧 Вставить в нижний паз', to: 'mill_attic_gear_bot' },
          { text: '📋 Вспомнить чертёж из сарая', to: 'mill_attic_blueprint' },
          { text: '⬇️ Спуститься', to: 'mill_second' }
        ]);
      } else {
        if (this.state.flags.gearFixed && !this.state.flags.corvinSpawned) {
          this.state.flags.corvinSpawned = true;
          this.setText('Механизм грохочет. Из-за мешков выходит мужчина в кирасе. Длинный меч. Он смотрит без страха — только усталость.');
          this.setDialogue([
            { speaker: 'Корвин', text: 'Ты не первый, кто пришёл сюда. Но первый, кто добрался так далеко. Жаль. Мне не хотелось убивать, но мельница — хорошее укрытие. А ты — помеха.' }
          ]);
          this.setChoices([
            { text: '🗣️ «Сдавайся»', to: 'boss_talk' },
            { text: '🗣️ «Где Альберт?»', to: 'boss_albert' },
            { text: '⚔️ Атаковать', to: 'boss_fight' }
          ]);
          return;
        }
        this.setText(this.state.flags.gearFixed ? 'Чердак. Механизм грохочет, колесо крутится.' : 'Чердак. Механизм мёртв.');
        this.setChoices([
          { text: 'Спуститься', to: 'mill_second' }
        ]);
      }
    },

    handleBossTalk() {
      this.setDialogue([
        { speaker: 'Корвин', text: 'Окружён? Тут только ты и я. И механизм, который скоро развалится. Я бы ушёл, но ты видел слишком много.' }
      ]);
      this.setChoices([
        { text: '«Уходи, я не преследую»', to: 'boss_mercy' },
        { text: '«Тогда — оружие»', to: 'boss_fight' }
      ]);
    },

    handleBossAlbert() {
      this.setDialogue([
        { speaker: 'Корвин', text: 'Старый мельник? Жив. В погребе, с псом. Мы не убийцы — торговцы. Просто... не совсем честные. Железо, меха. Но ты всё испортил.' }
      ]);
      this.setChoices([
        { text: '«Я заберу его и уйду. Ты — тоже»', to: 'boss_mercy' },
        { text: '«Нет. Ты идёшь со мной»', to: 'boss_fight' }
      ]);
    },

    handleBossMercy() {
      const bonus = this.getSkillBonus('persuasion');
      const roll = this.d20() + bonus;
      if (roll >= 15) {
        this.setText('Корвин смотрит долго. Потом опускает меч.');
        this.setDialogue([
          { speaker: 'Корвин', text: '...Ладно. Забирай старика. Скажи деревне, что я ушёл в лес. Больше не вернусь. Но если встретимся снова — я не прощу.' }
        ]);
        this.state.flags.corvinSpared = true;
        this.setChoices([
          { text: 'Спуститься в погреб', to: 'cellar_after' }
        ]);
      } else {
        this.setText('Корвин усмехается.');
        this.setDialogue([
          { speaker: 'Корвин', text: 'Милосердие? От воина? Нет, друг. Мир жесток. Докажи, что достоин жить.' }
        ]);
        this.setChoices([
          { text: 'Вступить в бой', to: 'boss_fight' }
        ]);
      }
    },

    handleCellarFirst() {
      if (!this.state.flags.cellarVisited) {
        this.state.flags.cellarVisited = true;
        this.setText('Лестница ведёт в сырой каменный погреб. Тусклый факел. В клетке — мужчина в лохмотьях (Альберт) и привязанный пёс Гризли.\nТрое бандитов пересчитывают товар. Один замечает вас.');
        this.setChoices([
          { text: '⚔️ Ворваться в бой', to: 'cellar_combat' },
          { text: '🗣️ «Опустите оружие!»', to: 'cellar_intimidate' }
        ]);
      } else {
        this.setText('Погреб.');
        this.setChoices([
          { text: 'К Альберту', to: 'cellar_after' }
        ]);
      }
    },

    handleCellarIntimidate() {
      const bonus = this.getSkillBonus('intimidation');
      const roll = this.d20() + bonus;
      if (roll >= 14) {
        this.setText('Бандиты переглядываются. Громила опускает дубину.');
        this.setDialogue([
          { speaker: 'Бандит', text: 'Чёрт... Корвин говорил, что нас никто не тронет. Ладно, мы уходим.' }
        ]);
        this.state.flags.banditsFled = true;
        this.setChoices([
          { text: 'Позволить уйти', to: 'cellar_after' },
          { text: '«Руки за голову»', to: 'cellar_combat' }
        ]);
      } else {
        this.setText('Бандит хмыкает.');
        this.setDialogue([
          { speaker: 'Бандит', text: 'Один на троих? Ты шутишь. Ребята — в него!' }
        ]);
        this.setChoices([
          { text: 'Бой', to: 'cellar_combat' }
        ]);
      }
    },

    handleCellarAfter() {
      this.setLocation('Погреб');
      if (this.state.flags.albertSaved) {
        this.setText('Погреб пуст. Альберт и Гризли ушли. Остались только следы борьбы и разбросанные мешки.');
        this.setChoices([
          { text: '🔍 Осмотреть погреб ещё раз', to: 'cellar_search' },
          ...this.getAlbertSideQuestChoices(),
          { text: '🏚️ Вернуться к мельнице', to: 'mill_arrival' },
          { text: '🌲 Вернуться в деревню', to: 'epilogue' }
        ]);
        return;
      }
      this.setText('В погребе пахнет кровью и плесенью. Альберт смотрит из клетки. Гризли рычит, потом виляет хвостом.');
      this.setDialogue([
        { speaker: 'Альберт', text: 'Боги... ты пришёл. Я думал, умру. Эти гады держали меня трое суток. Корвин на чердаке, наверное.' },
        { speaker: 'Альберт', text: 'Механизм... если запустить жернова, шум заглушит всё. Ключ у меня был, но отобрали. Возьми — в кармане у Громилы.' }
      ]);
      if (!this.state.inventory.includes('safe_key')) this.addItem('safe_key');
      const choices = [];
      if (!this.state.flags.dogFreed) choices.push({ text: '🐕 Освободить Гризли', to: 'cellar_dog' });
      choices.push({ text: '🔍 Осмотреть погреб', to: 'cellar_search' });
      choices.push({ text: '🗣️ «Корвин мёртв / сбежал. Вы свободны»', to: 'cellar_free' });
      this.setChoices(choices);
    },

    handleCellarSearch() {
      const bonus = this.getSkillBonus('perception');
      const roll = this.d20() + bonus;
      if (roll >= 12 && !this.state.flags.cellarLoot) {
        this.state.flags.cellarLoot = true;
        this.state.gold += 8;
        this.updateStats();
        this.setText('В ящике — украденные меха, два железных слитка и 8 золотых.');
        this.addItem('iron_ingots');
      } else {
        this.setText('Товар краденый, но ничего лично ценного.');
      }
      const choices = [
        { text: '🗣️ Поговорить с Альбертом', to: 'cellar_free' }
      ];
      if (!this.state.flags.dogFreed) choices.unshift({ text: '🐕 Освободить Гризли', to: 'cellar_dog' });
      if (!this.state.flags.albertSaved) choices.unshift({ text: '🔓 Освободить Альберта', to: 'cellar_free' });
      choices.push({ text: '🏚️ Вернуться к мельнице', to: 'mill_arrival' });
      this.setChoices(choices);
    },

    // ========== ГОЛОВОЛОМКА С ШЕСТЕРНЁЙ ==========
    gearPuzzle(choice) {
      const correct = 'mid';
      if (this.state.flags.gearFixed) { this.showScene('mill_attic'); return; }
      if (choice === correct) {
        this.state.flags.gearFixed = true;
        this.setText('Шестерня встаёт идеально. Механизм с грохотом оживает — колесо крутится. Шум оглушает, пыль взмывает.\n\nЭтот грохот маскирует шаги. Или... привлекает кого-то?');
        this.log('Механизм запущен!');
        this.setChoices([
          { text: 'Осмотреть чердак', to: 'mill_attic' }
        ]);
      } else {
        this.setText('Шестерня входит туго, но при обороте заедает. Ржавый трос обрывается!');
        const bonus = this.getSkillBonus('dexterity');
        const roll = this.d20() + bonus;
        if (roll >= 12) {
          this.log(`Увернулись: ${roll} vs 12`);
          this.setText('Вы уворачиваетесь. Трос падает рядом. Шестерня сломана — механизм мёртв.');
        } else {
          const dmg = this.d(6);
          this.takeDamage(dmg);
          this.log(`Трос ударил: ${dmg} урона`, 'log-damage');
          this.setText(`Трос бьёт вас, сбивая с ног. ${dmg} урона. Шестерня сломана.`);
        }
        this.state.flags.gearBroken = true;
        this.setChoices([
          { text: 'Спуститься', to: 'mill_second' }
        ]);
      }
    },

    // ========== ШЕСТЕРНИ ==========
    handleGearTop() {
      this.gearPuzzle('top');
    },

    handleGearMid() {
      this.gearPuzzle('mid');
    },

    handleGearBot() {
      this.gearPuzzle('bot');
    },

  });
})();
