// Обработчики UI компонентов сцен (диалог, создание персонажа)
const SceneComponentHandlers = {
  dialogueTopic(compIndex, topicIndex) {
    const store = this._dialogue?.[compIndex];
    if (!store) return;
    const t = store.topics[topicIndex];
    const reply = typeof t === 'object' ? (t.reply || t.text || '') : `«${t}» — отвечает ${store.name}.`;
    const el = document.getElementById(`dialogue-component-reply-${compIndex}`);
    if (el) el.innerHTML = `<p class="scene-component-reply-text">${GameEngine.escapeHtml(reply)}</p>`;
    if (typeof t === 'object' && t.flags) GameEngine.applyFlags(t.flags);
    if (typeof t === 'object' && t.questSet) {
      GameEngine.updateQuest(t.questSet.questId, t.questSet.stage);
    }
    // Quest events: dialogue finished with NPC
    const npcId = store.npcId || store.npc || (typeof t === 'object' ? t.npc : null);
    if (typeof QuestEvents !== 'undefined') {
      QuestEvents.emit('NPCTalked', { npcId, npc: npcId, topicIndex });
      QuestEvents.emit('NPCDialogueFinished', { npcId, npc: npcId, topicIndex });
      if (typeof t === 'object' && t.choiceFlag) {
        QuestEvents.emit('ChoiceSelected', { flag: t.choiceFlag, sceneId: GameEngine.state?.scene });
      }
    }
    if (typeof t === 'object' && t.donate) {
      const cost = parseInt(t.donate.cost, 10) || 10;
      if (GameEngine.state.gold < cost) {
        if (el) el.innerHTML = '<p class="hint">Недостаточно золота для подношения.</p>';
        return;
      }
      GameEngine.state.gold -= cost;
      if (typeof QuestEvents !== 'undefined') {
        QuestEvents.emit('GoldSpent', { amount: cost, reason: 'donate' });
      }
      if (t.donate.flag) GameEngine.state.flags[t.donate.flag] = true;
      GameEngine.updateStats();
      GameEngine.log(`🙏 Пожертвование в храм (−${cost} зм).`, 'log-heal');
    }
    if (typeof t === 'object' && Array.isArray(t.actions)) {
      t.actions.forEach((step) => {
        if (!step?.action) return;
        if (typeof ActionRunner !== 'undefined' && ActionRunner.runV2) {
          ActionRunner.runV2(GameEngine, step.action, step.params || {}, { source: 'dialogue_topic' });
        } else if (typeof GameEngine.runAction === 'function') {
          GameEngine.runAction(step.action, step.params || {});
        }
      });
    }
    const nextScene = typeof t === 'object' ? (t.nextScene || t.to) : null;
    if (nextScene && typeof GameEngine.showScene === 'function') {
      GameEngine.showScene(String(nextScene));
    }
  },

  resumeCharacterCreation() {
    const sid = GameEngine.state.scene;
    const scene = GameEngine.data?.scenes?.[sid];
    if (GameEngine.hasSceneComponents?.(scene)) {
      GameEngine.renderSceneComponents(sid, scene);
    } else if (GameEngine.CharacterCreator?.open) {
      GameEngine.CharacterCreator.open();
    }
  }
};
