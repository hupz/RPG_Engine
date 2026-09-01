// Последовательное выполнение Scene Elements

const SceneElementRunner = {
  _attach(engine) {
    if (!engine || engine._sceneElementRunnerAttached) return;
    engine._sceneElementRunnerAttached = true;
    engine.resumeSceneElements = function () {
      SceneElementRunner.resume(engine);
    };
  },

  shouldSkipElement(engine, el, applyRewards) {
    if (el.enabled === false) return true;
    if (el.firstVisitOnly && !applyRewards) return true;
    return false;
  },

  clearRunner(engine) {
    if (engine.state._sceneRunner) delete engine.state._sceneRunner;
  },

  initRunner(engine, ctx) {
    engine.state._sceneRunner = {
      sceneId: ctx.sceneId,
      list: 'main',
      index: 0,
      paused: false,
      ctx,
      completed: false
    };
  },

  getRunner(engine) {
    return engine.state._sceneRunner || null;
  },

  async runOnEnter(engine, scene, applyRewards) {
    const list = scene.onEnterElements || [];
    for (let i = 0; i < list.length; i++) {
      const el = list[i];
      if (this.shouldSkipElement(engine, el, applyRewards)) continue;
      const done = await this.executeElement(engine, el, { ...this.getRunner(engine)?.ctx, phase: 'onEnter' });
      if (done === 'pause') return false;
    }
    return true;
  },

  runSceneFlow(engine, ctx) {
    this._attach(engine);
    const { sceneId, scene, rawScene, options, applyRewards, text } = ctx;

    if (typeof SceneElements !== 'undefined') {
      SceneElements.ensureMigrated(rawScene);
    }

    const hasServiceOnly = this._hasOnlyServiceElements(rawScene);
    const hasLegacyComponents = (rawScene.components || []).some((c) => {
      const t = c.component || c.type;
      return t && t !== 'service_menu';
    });

    if (hasLegacyComponents && engine.hasSceneComponents?.(rawScene)) {
      this._runLegacyComponents(engine, ctx);
      return;
    }

    this.initRunner(engine, ctx);

    const self = this;
    (async () => {
      await self.runOnEnter(engine, rawScene, applyRewards);

      if (applyRewards && rawScene.npcId) {
        engine.applyNpcReputationEffects?.(rawScene.npcId, 'talk');
      }
      engine.maybeAlbertWalksToVillage?.(sceneId);

      await self.runMainSequence(engine);
    })();
  },

  _hasOnlyServiceElements(rawScene) {
    const comps = rawScene.components || [];
    if (!comps.length) return false;
    return comps.every((c) => (c.component || c.type) === 'service_menu');
  },

  _runLegacyComponents(engine, ctx) {
    const { sceneId, scene, rawScene } = ctx;
    const sceneWithComponents = scene.components?.length ? scene : { ...scene, components: rawScene.components };
    engine.renderSceneComponents?.(sceneId, sceneWithComponents);
    engine._runSceneChainOnEnter?.(sceneWithComponents.components);
    engine.renderTravelMenu?.();
    engine.initTooltips?.();
  },

  async runMainSequence(engine) {
    const runner = this.getRunner(engine);
    if (!runner || runner.completed) return;

    const rawScene = runner.ctx.rawScene;
    const scene = runner.ctx.scene;
    const applyRewards = runner.ctx.applyRewards;
    const list = rawScene.elements || [];

    while (runner.index < list.length) {
      const el = list[runner.index];
      runner.index += 1;

      if (this.shouldSkipElement(engine, el, applyRewards)) continue;

      const result = await this.executeElement(engine, el, { ...runner.ctx, phase: 'main' });
      if (result === 'pause') {
        runner.paused = true;
        runner.index -= 1;
        return;
      }
    }

    if (!list.some((e) => e.type === 'show_choices' && e.enabled !== false)) {
      const sceneChoices = engine.withWaterRefillChoices?.(scene.choices, rawScene) || scene.choices || [];
      if (sceneChoices.length) {
        engine.setChoices(sceneChoices);
      } else {
        engine.setChoices([]);
      }
    }

    runner.completed = true;
    engine.renderTravelMenu?.();
    engine.initTooltips?.();
    if (typeof engine.getTimePeriod === 'function') {
      engine._lastSceneTimePeriod = engine.getTimePeriod();
    }
    this.clearRunner(engine);
  },

  resume(engine) {
    const runner = this.getRunner(engine);
    if (!runner || !runner.paused) return;
    runner.paused = false;
    runner.index += 1;
    this.runMainSequence(engine);
  },

  resumeAfterCombat(engine, nextSceneFromCombat) {
    const runner = this.getRunner(engine);
    if (runner?.paused) {
      runner.paused = false;
      this.runMainSequence(engine);
      return true;
    }
    if (nextSceneFromCombat && engine.data.scenes[nextSceneFromCombat]) {
      engine.showScene(nextSceneFromCombat);
    }
    return false;
  },

  async executeElement(engine, el, ctx) {
    const d = el.data || {};
    const type = el.type;

    switch (type) {
      case 'set_flag':
        engine.applyFlags?.({ [d.key]: d.value });
        return 'continue';

      case 'give_item': {
        const n = Math.max(1, parseInt(d.count, 10) || 1);
        for (let i = 0; i < n; i++) {
          if (d.itemId) engine.addItem?.(d.itemId);
        }
        return 'continue';
      }

      case 'remove_item':
        if (typeof ActionRunner !== 'undefined' && ACTION_REGISTRY?.remove_item) {
          ActionRunner.runV2('remove_item', { itemId: d.itemId, count: d.count || 1 }, engine);
        }
        return 'continue';

      case 'award_gold':
        if (d.amount) {
          engine.state.gold = (engine.state.gold || 0) + Math.max(0, parseInt(d.amount, 10) || 0);
          engine.updateStats?.();
          engine.log?.(`💰 +${d.amount} зм`, 'log-heal');
        }
        return 'continue';

      case 'award_exp':
        if (d.amount) {
          engine.grantExpOnce?.(`scene:${ctx.sceneId}:el:${el.id}`, d.amount, 'сцена');
        } else if (ctx.rawScene?.exp) {
          engine.awardSceneExp?.(ctx.rawScene);
        }
        return 'continue';

      case 'quest_start':
      case 'quest_complete':
        if (d.questId && d.stage != null) {
          engine.updateQuest?.(d.questId, d.stage);
        }
        return 'continue';

      case 'add_status':
        if (typeof ActionRunner !== 'undefined') {
          ActionRunner.runV2('apply_effect', {
            effect: d.effect,
            duration: d.duration || 3,
            target: d.target || 'self'
          }, engine);
        }
        return 'continue';

      case 'remove_status':
        if (typeof ActionRunner !== 'undefined') {
          ActionRunner.runV2('remove_effect', {
            effect: d.effect,
            target: d.target || 'self'
          }, engine);
        }
        return 'continue';

      case 'achievement':
        if (d.achievementId && typeof AchievementSystem !== 'undefined') {
          const ach = engine.data?.achievements?.[d.achievementId];
          AchievementSystem.unlock(engine, d.achievementId, ach);
        }
        return 'continue';

      case 'music':
        if (d.ambient || d.sfxOnEnter) {
          engine.playSceneAudio?.({
            ambient: d.ambient,
            sfxOnEnter: d.sfxOnEnter,
            volume: d.volume,
            loop: d.loop !== false
          });
        } else if (d.track && typeof ActionRunner !== 'undefined') {
          ActionRunner.runV2('play_music', { track: d.track, volume: d.volume }, engine);
        }
        return 'continue';

      case 'image':
        this._showImage(engine, d);
        return 'continue';

      case 'show_text':
        if (d.text) engine.setText?.(d.text);
        return 'continue';

      case 'custom_action':
        if (d.chainId && typeof engine.executeChain === 'function') {
          await engine.executeChain(d.chainId);
        } else if (d.action && typeof ActionRunner !== 'undefined') {
          ActionRunner.runV2(d.action, d.params || {}, engine);
        }
        return 'continue';

      case 'change_scene':
        if (d.sceneId && engine.data.scenes[d.sceneId]) {
          engine.showScene(d.sceneId, ctx.options || {});
          return 'pause';
        }
        return 'continue';

      case 'skill_check':
        return this._runSkillCheckElement(engine, el, ctx);

      case 'combat':
        return this._runCombatElement(engine, el, ctx);

      case 'show_choices':
        return this._runShowChoices(engine, ctx);

      case 'service_menu':
        return this._runServiceMenu(engine, el, ctx);

      default:
        return 'continue';
    }
  },

  _showImage(engine, d) {
    let box = document.getElementById('scene-image-box');
    if (!d.src) {
      if (box) box.remove();
      return;
    }
    if (!box) {
      box = document.createElement('div');
      box.id = 'scene-image-box';
      box.className = 'scene-image-box';
      const story = document.getElementById('story-text');
      if (story?.parentNode) story.parentNode.insertBefore(box, story);
    }
    box.innerHTML = `<img src="${String(d.src).replace(/"/g, '&quot;')}" alt="" style="max-width:100%;border-radius:8px;">`
      + (d.caption ? `<p class="scene-image-caption">${d.caption}</p>` : '');
  },

  _runShowChoices(engine, ctx) {
    const scene = ctx.scene;
    const rawScene = ctx.rawScene;
    const sceneChoices = engine.withWaterRefillChoices?.(scene.choices, rawScene) || scene.choices || [];
    engine.setChoices(sceneChoices.length ? sceneChoices : []);
    return 'pause';
  },

  _runServiceMenu(engine, el, ctx) {
    const d = el.data || {};
    const comp = {
      component: 'service_menu',
      id: d.id || 'service_menu',
      enabled: d.enabled !== false,
      params: d.params || { services: [] }
    };
    const sceneId = ctx.sceneId;
    const scene = { ...ctx.scene, components: [comp] };
    engine.renderSceneComponents?.(sceneId, scene);
    engine.renderTravelMenu?.();
    return 'pause';
  },

  _runSkillCheckElement(engine, el, ctx) {
    const d = el.data || {};
    const skill = d.skill || 'perception';
    const dc = parseInt(d.dc, 10) || 12;
    const bonus = engine.getSkillBonus?.(skill) || 0;
    const roll = (engine.d20?.() || 1) + bonus;
    const fakeChoice = { to: d.successNext || d.failNext || '' };

    if (roll >= dc) {
      engine.log?.(`✅ Успех! ${skill}: ${roll} vs ${dc}`, 'log-combat');
      engine.setText?.(d.successText || 'Проверка пройдена!');
      engine.clearDialogue?.();
      engine.applyFlags?.(d.successFlags);
      if (d.successItems?.length) d.successItems.forEach((id) => engine.addItem?.(id));
      engine.setChoices([{ text: 'Продолжить', action: 'scene_element_resume' }]);
    } else {
      engine.log?.(`❌ Провал. ${skill}: ${roll} vs ${dc}`, 'log-dice');
      engine.setText?.(d.failText || 'Проверка провалена.');
      engine.clearDialogue?.();
      engine.applyFlags?.(d.failFlags);
      engine.setChoices([{ text: 'Продолжить', action: 'scene_element_resume' }]);
    }

    const runner = this.getRunner(engine);
    if (runner) runner.paused = true;
    return 'pause';
  },

  _runCombatElement(engine, el, ctx) {
    const d = el.data || {};
    const enemies = d.enemies || [];
    const sceneId = ctx.sceneId;

    if (!enemies.length) return 'continue';

    if (engine.isCombatSceneCleared?.(sceneId)) {
      const after = d.nextScene;
      if (after && engine.data.scenes[after]) {
        engine.showScene(after, ctx.options || {});
        return 'pause';
      }
      const note = '\n\n☠️ Бой уже пройден.';
      engine.setText?.((ctx.text || '') + note);
      engine.setChoices([{ text: '➡️ Продолжить', action: 'scene_element_resume' }]);
      const runner = this.getRunner(engine);
      if (runner) runner.paused = true;
      return 'pause';
    }

    if (!ctx.applyRewards) {
      const note = '\n\n⚠️ Вы уже были здесь — бой не начинается повторно.';
      engine.setText?.((ctx.text || '') + note);
      engine.setChoices([{ text: '➡️ Продолжить', action: 'scene_element_resume' }]);
      const runner = this.getRunner(engine);
      if (runner) runner.paused = true;
      return 'pause';
    }

    const missing = enemies.filter((eid) => !engine.data.enemies?.[eid]);
    if (missing.length) {
      engine.setText?.('Ошибка данных: не найдены враги: ' + missing.join(', '));
      engine.setChoices([]);
      return 'pause';
    }

    const enemyObjs = enemies.map((eid) => {
      const e = engine.data.enemies[eid];
      return {
        ...e,
        id: eid,
        maxHp: e.hp,
        creatureType: e.creatureType || engine.getDefaultCreatureType?.()
      };
    });

    const runner = this.getRunner(engine);
    if (runner) runner.paused = true;

    engine.state._combatFromSceneElement = true;
    if (engine.tryEnterCombatWithReputation?.({ combat: enemies }, enemyObjs)) {
      return 'pause';
    }
    engine.startCombat(enemyObjs, d.nextScene || '', enemies);
    return 'pause';
  }
};

if (typeof window !== 'undefined') {
  window.SceneElementRunner = SceneElementRunner;
}
