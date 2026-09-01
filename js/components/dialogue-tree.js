// Диалог с NPC (v3)
(function () {
  const DialogueTreeComponent = {
    defaultParams: {
      npc: 'marta',
      greeting: 'Приветствую, путник!',
      topics: []
    },

    render(engine, container, compDef, ctx) {
      const p = { ...this.defaultParams, ...SceneComponentBase.getConfig(compDef) };
      const npc = engine.data?.npcs?.[p.npc];
      const name = SceneComponentBase.getNpcName(engine, p.npc, 'Собеседник');
      const topics = Array.isArray(p.topics) ? p.topics : [];
      const preview = ctx.preview;

      let topicsHtml = '';
      topics.forEach((t, i) => {
        if (typeof t === 'object' && t.showIf && typeof ConditionSystem !== 'undefined') {
          const ctx = {
            inventory: engine.state?.inventory || [],
            gold: engine.state?.gold ?? 0,
            flags: engine.state?.flags || {},
            questStages: engine.state?.questStages || {},
            level: engine.state?.level ?? 1,
            className: engine.state?.className || ''
          };
          if (!ConditionSystem.evaluate(t.showIf, ctx)) return;
        }
        if (typeof t === 'object' && t.hideIf && typeof ConditionSystem !== 'undefined') {
          const ctx = {
            inventory: engine.state?.inventory || [],
            gold: engine.state?.gold ?? 0,
            flags: engine.state?.flags || {},
            questStages: engine.state?.questStages || {},
            level: engine.state?.level ?? 1,
            className: engine.state?.className || ''
          };
          if (ConditionSystem.evaluate(t.hideIf, ctx)) return;
        }
        const label = typeof t === 'string' ? t : (t.label || t.text || `Тема ${i + 1}`);
        if (preview) {
          topicsHtml += `<button type="button" class="choice" disabled>${SceneComponentBase.escape(engine, label)}</button>`;
        } else {
          topicsHtml += `<button type="button" class="choice" onclick="SceneComponentHandlers.dialogueTopic(${ctx.index},${i})">${SceneComponentBase.escape(engine, label)}</button>`;
        }
      });

      container.innerHTML = SceneComponentBase.wrap(
        'dialogue_tree',
        `💬 ${SceneComponentBase.escape(engine, name)}`,
        `${SceneComponentBase.previewNote(preview)}
         <p class="scene-component-greeting">${SceneComponentBase.escape(engine, p.greeting || npc?.dialogues?.default?.[0]?.text || '...')}</p>
         <div class="scene-component-actions">${topicsHtml || '<p class="hint">Нет тем диалога</p>'}</div>
         <div id="dialogue-component-reply-${ctx.index}" class="scene-component-reply"></div>`
      );

      if (!window.SceneComponentHandlers) window.SceneComponentHandlers = {};
      if (!window.SceneComponentHandlers._dialogue) window.SceneComponentHandlers._dialogue = {};
      window.SceneComponentHandlers._dialogue[ctx.index] = { topics, name, npcId: p.npc, npc: p.npc };
    }
  };

  registerSceneComponent('dialogue_tree', DialogueTreeComponent);
  registerSceneComponent('dialogue', DialogueTreeComponent);
})();
