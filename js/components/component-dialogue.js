// Компонент: диалог с NPC
(function () {
  const DialogueComponent = {
    defaultParams: {
      npc: 'marta',
      greeting: 'Приветствую, путник!',
      topics: []
    },

    render(engine, container, compDef, ctx) {
      const p = { ...this.defaultParams, ...(compDef.params || {}) };
      const npc = engine.data?.npcs?.[p.npc];
      const name = SceneComponentBase.getNpcName(engine, p.npc, 'Собеседник');
      const topics = Array.isArray(p.topics) ? p.topics : [];
      const preview = ctx.preview;

      let topicsHtml = '';
      topics.forEach((t, i) => {
        const label = typeof t === 'string' ? t : (t.label || t.text || `Тема ${i + 1}`);
        const reply = typeof t === 'object' ? (t.reply || t.text || '') : `«${label}» — отвечает ${name}.`;
        if (preview) {
          topicsHtml += `<button type="button" class="choice" disabled>${SceneComponentBase.escape(engine, label)}</button>`;
        } else {
          topicsHtml += `<button type="button" class="choice" onclick="SceneComponentHandlers.dialogueTopic(${ctx.index},${i})">${SceneComponentBase.escape(engine, label)}</button>`;
        }
      });

      container.innerHTML = SceneComponentBase.wrap(
        'dialogue',
        `💬 ${SceneComponentBase.escape(engine, name)}`,
        `${SceneComponentBase.previewNote(preview)}
         <p class="scene-component-greeting">${SceneComponentBase.escape(engine, p.greeting || npc?.dialogues?.default?.[0]?.text || '...')}</p>
         <div class="scene-component-actions">${topicsHtml || '<p class="hint">Нет тем диалога</p>'}</div>
         <div id="dialogue-component-reply-${ctx.index}" class="scene-component-reply"></div>`
      );

      if (!window.SceneComponentHandlers) window.SceneComponentHandlers = {};
      if (!window.SceneComponentHandlers._dialogue) window.SceneComponentHandlers._dialogue = {};
      window.SceneComponentHandlers._dialogue[ctx.index] = { topics, name };
    }
  };

  SceneComponentRegistry.register('dialogue', DialogueComponent);
})();
