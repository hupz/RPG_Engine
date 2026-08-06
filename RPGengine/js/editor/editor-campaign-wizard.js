// ============================================================
// P3: Мастер «Новая история» + карточка NPC (где бывает, квесты)
// ============================================================
(function attachCampaignWizardAndNpcCard() {
  if (typeof Editor === 'undefined') {
    console.warn('editor-campaign-wizard.js: Editor не определён');
    return;
  }

  Object.assign(Editor, {
    _campaignWizardStep: 0,
    _campaignWizardDraft: null,

    openCampaignWizard() {
      if (this.data && !confirm('Создать новую историю? Текущий проект в редакторе будет заменён (файл на диске не трогаем, пока не сохраните).')) {
        return;
      }
      this._campaignWizardStep = 0;
      this._campaignWizardDraft = {
        title: 'Моя история',
        heroNote: '',
        scenes: [
          { name: 'Начало', text: 'Вы стоите на пороге приключения.' },
          { name: 'Деревня', text: 'Тихая деревня. Здесь можно найти помощь.' },
          { name: 'Опасное место', text: 'Здесь кто-то или что-то угрожает покою.' }
        ],
        npcName: 'Старейшина',
        npcLine: 'Добро пожаловать, путник. Мне нужна твоя помощь.',
        questTitle: 'Первое задание',
        questHint: 'Поговорите со старейшиной и разберитесь с угрозой.',
        enemyName: 'Разбойник',
        includeCombat: true
      };
      this.renderCampaignWizardModal();
    },

    closeCampaignWizard() {
      document.getElementById('campaign-wizard-modal')?.remove();
      this._campaignWizardDraft = null;
    },

    renderCampaignWizardModal() {
      let modal = document.getElementById('campaign-wizard-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'campaign-wizard-modal';
        modal.className = 'editor-modal';
        document.body.appendChild(modal);
      }
      modal.classList.remove('hidden');
      const d = this._campaignWizardDraft;
      const step = this._campaignWizardStep;
      const steps = ['Название', 'Сцены', 'NPC', 'Квест и бой', 'Готово'];
      const stepsHtml = steps.map((s, i) =>
        `<span class="cw-step${i === step ? ' is-active' : ''}${i < step ? ' is-done' : ''}">${i + 1}. ${this.escapeHtml(s)}</span>`
      ).join('<span class="cw-step-sep">→</span>');

      let body = '';
      if (step === 0) {
        body = `
          <div class="form-group"><label>Название истории</label>
            <input type="text" id="cw-title" value="${this.escapeAttr(d.title)}"></div>
          <div class="form-group"><label>Кратко, о чём игра (для себя)</label>
            <textarea id="cw-note" rows="2">${this.escapeHtml(d.heroNote || '')}</textarea></div>
          <p class="hint">Дальше соберём 3 сцены, NPC, квест и простого врага — без кода.</p>`;
      } else if (step === 1) {
        body = `<p class="hint">Три локации каркаса. Позже добавите ещё на карте сюжета.</p>`;
        d.scenes.forEach((sc, i) => {
          body += `<div class="project-info" style="margin:8px 0;">
            <div class="form-group"><label>Сцена ${i + 1}: название</label>
              <input type="text" id="cw-sc-name-${i}" value="${this.escapeAttr(sc.name)}"></div>
            <div class="form-group"><label>Текст (что видит игрок)</label>
              <textarea id="cw-sc-text-${i}" rows="2">${this.escapeHtml(sc.text)}</textarea></div>
          </div>`;
        });
      } else if (step === 2) {
        body = `
          <p class="hint">Персонаж, с которого начнётся сюжет (обычно в первой или второй сцене).</p>
          <div class="form-group"><label>Имя NPC</label>
            <input type="text" id="cw-npc-name" value="${this.escapeAttr(d.npcName)}"></div>
          <div class="form-group"><label>Первая реплика</label>
            <textarea id="cw-npc-line" rows="2">${this.escapeHtml(d.npcLine)}</textarea></div>`;
      } else if (step === 3) {
        body = `
          <div class="form-group"><label>Название квеста</label>
            <input type="text" id="cw-quest-title" value="${this.escapeAttr(d.questTitle)}"></div>
          <div class="form-group"><label>Что сделать (для журнала)</label>
            <input type="text" id="cw-quest-hint" value="${this.escapeAttr(d.questHint)}"></div>
          <div class="form-group"><label>
            <input type="checkbox" id="cw-combat" ${d.includeCombat ? 'checked' : ''}> Добавить простого врага и сцену боя
          </label></div>
          <div class="form-group"><label>Имя врага</label>
            <input type="text" id="cw-enemy-name" value="${this.escapeAttr(d.enemyName)}"></div>`;
      } else {
        body = `<div class="empty-state" style="padding:20px;">
          <h3>Всё готово к сборке</h3>
          <p class="hint">Будут созданы: проект «${this.escapeHtml(d.title)}», ${d.scenes.length} сцены,
            NPC, квест${d.includeCombat ? ', враг и бой' : ''}.</p>
        </div>`;
      }

      const isLast = step >= 4;
      modal.innerHTML = `
        <div class="editor-modal-backdrop" onclick="Editor.closeCampaignWizard()"></div>
        <div class="editor-modal-panel editor-modal-panel--wide" onclick="event.stopPropagation()">
          <h2>📖 Новая история</h2>
          <div class="cw-steps">${stepsHtml}</div>
          <div class="cw-body">${body}</div>
          <div class="modal-box-footer" style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
            <button type="button" class="btn btn-secondary" onclick="Editor.closeCampaignWizard()">Отмена</button>
            ${step > 0 ? '<button type="button" class="btn btn-secondary" onclick="Editor.campaignWizardBack()">Назад</button>' : ''}
            ${isLast
              ? '<button type="button" class="btn btn-primary" onclick="Editor.finishCampaignWizard()">✨ Создать историю</button>'
              : '<button type="button" class="btn btn-primary" onclick="Editor.campaignWizardNext()">Далее</button>'}
          </div>
        </div>`;
    },

    _readCampaignWizardStep() {
      const d = this._campaignWizardDraft;
      if (!d) return;
      const step = this._campaignWizardStep;
      if (step === 0) {
        d.title = document.getElementById('cw-title')?.value?.trim() || d.title;
        d.heroNote = document.getElementById('cw-note')?.value?.trim() || '';
      } else if (step === 1) {
        d.scenes.forEach((sc, i) => {
          sc.name = document.getElementById('cw-sc-name-' + i)?.value?.trim() || sc.name;
          sc.text = document.getElementById('cw-sc-text-' + i)?.value?.trim() || sc.text;
        });
      } else if (step === 2) {
        d.npcName = document.getElementById('cw-npc-name')?.value?.trim() || d.npcName;
        d.npcLine = document.getElementById('cw-npc-line')?.value?.trim() || d.npcLine;
      } else if (step === 3) {
        d.questTitle = document.getElementById('cw-quest-title')?.value?.trim() || d.questTitle;
        d.questHint = document.getElementById('cw-quest-hint')?.value?.trim() || d.questHint;
        d.includeCombat = !!document.getElementById('cw-combat')?.checked;
        d.enemyName = document.getElementById('cw-enemy-name')?.value?.trim() || d.enemyName;
      }
    },

    campaignWizardNext() {
      this._readCampaignWizardStep();
      if (this._campaignWizardStep < 4) this._campaignWizardStep++;
      this.renderCampaignWizardModal();
    },

    campaignWizardBack() {
      this._readCampaignWizardStep();
      if (this._campaignWizardStep > 0) this._campaignWizardStep--;
      this.renderCampaignWizardModal();
    },

    _slug(name, existing) {
      if (typeof this.slugifyId === 'function') return this.slugifyId(name, '', existing || {});
      return String(name || 'id').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'id';
    },

    finishCampaignWizard() {
      this._readCampaignWizardStep();
      const d = this._campaignWizardDraft;
      if (!d) return;

      // Базовый каркас
      let data;
      if (typeof this.createDnd5eStarterProject === 'function') {
        data = this.createDnd5eStarterProject(d.title, 'dnd5e');
      } else {
        data = {
          meta: { title: d.title, version: '1.0', author: '', description: d.heroNote || '' },
          scenes: {}, npcs: {}, quests: {}, enemies: {}, items: {}, classes: {}
        };
      }
      data.meta = data.meta || {};
      data.meta.title = d.title;
      data.meta.description = d.heroNote || data.meta.description || '';
      data.scenes = {};
      data.npcs = data.npcs || {};
      data.quests = data.quests || {};
      data.enemies = data.enemies || {};

      const sceneIds = [];
      d.scenes.forEach((sc, i) => {
        let id = this._slug(sc.name, data.scenes);
        if (i === 0) id = 'start';
        if (data.scenes[id] && i > 0) id = id + '_' + (i + 1);
        data.scenes[id] = {
          id,
          location: sc.name,
          text: sc.text,
          choices: [],
          dialogue: [],
          editorModules: ['story', 'choices']
        };
        sceneIds.push(id);
      });

      // Цепочка сцен 1→2→3
      for (let i = 0; i < sceneIds.length - 1; i++) {
        const next = sceneIds[i + 1];
        const nextName = data.scenes[next].location;
        data.scenes[sceneIds[i]].choices.push({
          text: 'Идти: ' + nextName,
          to: next,
          icon: '➡️'
        });
      }

      // NPC
      const npcId = this._slug(d.npcName, data.npcs);
      data.npcs[npcId] = {
        id: npcId,
        name: d.npcName,
        icon: '👤',
        description: 'Ключевой персонаж начала истории.',
        location: data.scenes[sceneIds[Math.min(1, sceneIds.length - 1)]]?.location || '',
        attitude: 'friendly',
        dialogues: { default: [{ speaker: d.npcName, text: d.npcLine }] },
        quests: [],
        shop: false
      };

      // Вторая сцена — встреча с NPC
      const hubId = sceneIds[Math.min(1, sceneIds.length - 1)];
      data.scenes[hubId].npcId = npcId;
      data.scenes[hubId].dialogue = [
        { speaker: d.npcName, text: d.npcLine }
      ];
      if (!data.scenes[hubId].editorModules.includes('dialogue')) {
        data.scenes[hubId].editorModules.push('dialogue');
      }
      if (!data.scenes[hubId].editorModules.includes('npc')) {
        data.scenes[hubId].editorModules.push('npc');
      }

      // Квест
      const questId = this._slug(d.questTitle, data.quests);
      data.quests[questId] = {
        id: questId,
        title: d.questTitle,
        stages: [
          {
            id: 'stage_0',
            title: 'Начало',
            hint: d.questHint,
            tasks: [
              { type: 'TalkToNPC', npcId: npcId, description: 'Поговорить с: ' + d.npcName }
            ]
          },
          {
            id: 'stage_1',
            title: 'В пути',
            hint: 'Продолжайте путь по локациям.',
            tasks: [
              { type: 'VisitLocation', sceneId: sceneIds[sceneIds.length - 1], description: 'Дойти до: ' + (data.scenes[sceneIds[sceneIds.length - 1]]?.location || '') }
            ]
          },
          {
            id: 'stage_done',
            title: 'Готово',
            hint: 'Задание выполнено.',
            finish: true,
            tasks: []
          }
        ]
      };
      data.npcs[npcId].quests = [questId];

      // Выбор: принять квест на hub
      data.scenes[hubId].choices = data.scenes[hubId].choices || [];
      data.scenes[hubId].choices.unshift({
        text: 'Принять: ' + d.questTitle,
        to: sceneIds[Math.min(2, sceneIds.length - 1)] || hubId,
        icon: '📜',
        once: true,
        questSet: { questId: questId, stage: '0' }
      });
      if (!data.scenes[hubId].editorModules.includes('quest')) {
        data.scenes[hubId].editorModules.push('quest');
      }

      // Бой
      if (d.includeCombat) {
        const enemyId = this._slug(d.enemyName, data.enemies);
        data.enemies[enemyId] = {
          id: enemyId,
          name: d.enemyName,
          creatureType: 'humanoid',
          hp: 12,
          maxHp: 12,
          ac: 12,
          atkBonus: 2,
          dmgRoll: '1d6',
          dmgBonus: 0,
          dex: 2
        };
        const combatSceneId = 'combat_' + enemyId;
        const afterId = sceneIds[sceneIds.length - 1];
        data.scenes[combatSceneId] = {
          id: combatSceneId,
          location: 'Схватка: ' + d.enemyName,
          text: d.enemyName + ' преграждает путь!',
          combat: [enemyId],
          nextScene: afterId,
          choices: [],
          editorModules: ['story', 'combat']
        };
        // из hub можно пойти в бой
        data.scenes[hubId].choices.push({
          text: 'Столкнуться с: ' + d.enemyName,
          to: combatSceneId,
          icon: '⚔️'
        });
      }

      // Позиции на графе
      if (!data.meta.storyGraph) data.meta.storyGraph = { positions: {} };
      Object.keys(data.scenes).forEach((sid, i) => {
        data.meta.storyGraph.positions[sid] = { x: 40 + (i % 4) * 240, y: 40 + Math.floor(i / 4) * 120 };
      });

      this.data = data;
      this.currentScene = 'start';
      this.editingNpcId = npcId;
      this.editingQuestId = questId;
      this.closeCampaignWizard();
      if (typeof ThemeSystem !== 'undefined') ThemeSystem.ensureInData(this.data);
      if (typeof this.applyThemeFromData === 'function') this.applyThemeFromData();
      this.renderAll();
      this.updateProjectPanel?.();
      this.updateJSONPreview();
      if (typeof this.switchTab === 'function') this.switchTab('scenes');
      alert('История «' + d.title + '» создана. Откройте карту сюжета или превью сцены.');
    },

    // ——— Карточка NPC: где бывает, реплики, квесты ———

    getNpcSceneAppearances(npcId) {
      const out = [];
      Object.entries(this.data?.scenes || {}).forEach(([sid, sc]) => {
        if (sc.npcId === npcId) out.push({ sceneId: sid, reason: 'NPC сцены' });
        (sc.dialogue || []).forEach((line) => {
          if (line && (line.speaker === npcId || line.speaker === this.data.npcs?.[npcId]?.name)) {
            if (!out.some((x) => x.sceneId === sid)) out.push({ sceneId: sid, reason: 'Диалог' });
          }
        });
        (sc.components || []).forEach((c) => {
          const p = c.params || {};
          if (p.npc === npcId || p.merchant === npcId) {
            if (!out.some((x) => x.sceneId === sid)) out.push({ sceneId: sid, reason: 'Компонент' });
          }
        });
      });
      return out;
    },

    renderNpcHubCard(npcId) {
      const n = this.data?.npcs?.[npcId];
      if (!n) return '';
      const places = this.getNpcSceneAppearances(npcId);
      const placesHtml = places.length
        ? places.map((p) => {
          const loc = this.data.scenes[p.sceneId]?.location || p.sceneId;
          return `<button type="button" class="btn btn-secondary btn-sm" style="margin:2px;"
            onclick="Editor.openSceneFromGraph?.(${JSON.stringify(p.sceneId)}) || (Editor.currentScene=${JSON.stringify(p.sceneId)},Editor.switchTab('scenes'),Editor.renderSceneEditor())">
            ${this.escapeHtml(loc)} <span class="hint">(${this.escapeHtml(p.reason)})</span>
          </button>`;
        }).join('')
        : '<p class="hint">Пока нигде не привязан. Укажите NPC на сцене или добавьте ниже.</p>';

      const questIds = Array.isArray(n.quests) ? n.quests : [];
      const allQuests = Object.keys(this.data?.quests || {});
      const questHtml = allQuests.map((qid) => {
        const title = this.data.quests[qid]?.title || qid;
        const checked = questIds.includes(qid) ? 'checked' : '';
        return `<label style="display:block;margin:4px 0;">
          <input type="checkbox" ${checked}
            onchange="Editor.toggleNpcQuest(${JSON.stringify(npcId)},${JSON.stringify(qid)},this.checked)">
          ${this.escapeHtml(title)}
        </label>`;
      }).join('') || '<p class="hint">Квестов пока нет — создайте во вкладке «Квесты».</p>';

      // Простые реплики default
      let lines = n.dialogues?.default;
      if (!Array.isArray(lines)) lines = [];
      const linesHtml = lines.map((line, i) => {
        const text = typeof line === 'string' ? line : (line?.text || '');
        return `<div style="display:flex;gap:6px;margin:4px 0;">
          <input style="flex:1" value="${this.escapeAttr(text)}"
            onchange="Editor.updateNpcDialogueLine(${JSON.stringify(npcId)},${i},this.value)">
          <button type="button" class="btn-remove" onclick="Editor.removeNpcDialogueLine(${JSON.stringify(npcId)},${i})">×</button>
        </div>`;
      }).join('');

      return `
        <div class="npc-hub-card project-info" style="margin-top:14px;">
          <h4>📍 Где встречается</h4>
          <div>${placesHtml}</div>
          <div class="form-group" style="margin-top:8px;"><label>Привязать к сцене</label>
            <select onchange="if(this.value)Editor.attachNpcToScene(${JSON.stringify(npcId)},this.value);this.value='';">
              <option value="">+ сцена…</option>
              ${Object.keys(this.data?.scenes || {}).map((sid) => {
                const loc = this.data.scenes[sid]?.location || sid;
                return `<option value="${this.escapeAttr(sid)}">${this.escapeHtml(loc)}</option>`;
              }).join('')}
            </select>
          </div>
        </div>
        <div class="npc-hub-card project-info" style="margin-top:10px;">
          <h4>💬 Реплики</h4>
          ${linesHtml || '<p class="hint">Нет реплик</p>'}
          <button type="button" class="btn btn-secondary" onclick="Editor.addNpcDialogueLine(${JSON.stringify(npcId)})">+ Реплика</button>
        </div>
        <div class="npc-hub-card project-info" style="margin-top:10px;">
          <h4>📜 Связанные квесты</h4>
          ${questHtml}
        </div>`;
    },

    attachNpcToScene(npcId, sceneId) {
      const sc = this.data?.scenes?.[sceneId];
      if (!sc) return;
      sc.npcId = npcId;
      if (typeof this.ensureSceneEditorModules === 'function') {
        this.ensureSceneEditorModules(sc);
        if (sc.editorModules && !sc.editorModules.includes('npc')) sc.editorModules.push('npc');
      }
      this.updateJSONPreview();
      this.renderNPCs();
    },

    toggleNpcQuest(npcId, questId, on) {
      const n = this.data?.npcs?.[npcId];
      if (!n) return;
      if (!Array.isArray(n.quests)) n.quests = [];
      if (on && !n.quests.includes(questId)) n.quests.push(questId);
      if (!on) n.quests = n.quests.filter((q) => q !== questId);
      this.updateJSONPreview();
    },

    addNpcDialogueLine(npcId) {
      const n = this.data?.npcs?.[npcId];
      if (!n) return;
      if (!n.dialogues) n.dialogues = {};
      if (!Array.isArray(n.dialogues.default)) n.dialogues.default = [];
      n.dialogues.default.push({ speaker: n.name || npcId, text: '' });
      this.renderNPCs();
      this.updateJSONPreview();
    },

    updateNpcDialogueLine(npcId, index, text) {
      const n = this.data?.npcs?.[npcId];
      if (!n?.dialogues?.default?.[index]) return;
      const line = n.dialogues.default[index];
      if (typeof line === 'string') n.dialogues.default[index] = { speaker: n.name, text };
      else line.text = text;
      this.updateJSONPreview();
    },

    removeNpcDialogueLine(npcId, index) {
      const n = this.data?.npcs?.[npcId];
      if (!n?.dialogues?.default) return;
      n.dialogues.default.splice(index, 1);
      this.renderNPCs();
      this.updateJSONPreview();
    }
  });

  // Обогатить карточку NPC
  if (Editor.hooks?.after) {
    Editor.hooks.after('renderNpcDetail', function (html, args) {
      const id = (args && args[0]) || this.editingNpcId;
      return (html || '') + (this.renderNpcHubCard?.(id) || '');
    });
  } else {
    const origNpcDetail = Editor.renderNpcDetail?.bind(Editor);
    if (typeof origNpcDetail === 'function') {
      Editor.renderNpcDetail = function (id) {
        let html = origNpcDetail(id);
        html += this.renderNpcHubCard(id);
        return html;
      };
    }
  }

  // createNPC — по имени
  const origCreateNPC = Editor.createNPC?.bind(Editor);
  if (typeof origCreateNPC === 'function') {
    Editor.createNPC = function () {
      if (typeof this.promptNameAndId === 'function') {
        this.ensureNpcs?.();
        const r = this.promptNameAndId({
          namePrompt: 'Имя персонажа:',
          defaultName: 'Новый житель',
          existing: this.data.npcs || {},
          allowEditId: false
        });
        if (!r) return;
        this.data.npcs[r.id] = {
          id: r.id,
          name: r.name,
          location: '',
          icon: '👤',
          description: '',
          dialogues: { default: [] },
          quests: [],
          shop: false,
          attitude: 'neutral'
        };
        this.editingNpcId = r.id;
        this.renderNPCs();
        this.updateJSONPreview();
        return;
      }
      return origCreateNPC();
    };
  }

  // Кнопка мастера в дашборд / тулбар
  const injectCampaignBtn = () => {
    if (document.getElementById('btn-campaign-wizard')) return;
    const hosts = [
      document.getElementById('editor-mode-toggle')?.parentElement,
      document.querySelector('.sidebar-header'),
      document.querySelector('#project-panel')
    ].filter(Boolean);
    const host = hosts[0];
    if (!host) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'btn-campaign-wizard';
    btn.className = 'btn btn-primary';
    btn.style.cssText = 'margin-top:6px;width:100%;';
    btn.textContent = '📖 Новая история';
    btn.onclick = () => Editor.openCampaignWizard();
    host.appendChild(btn);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectCampaignBtn);
  } else {
    setTimeout(injectCampaignBtn, 100);
  }

  if (!document.getElementById('campaign-wizard-styles')) {
    const st = document.createElement('style');
    st.id = 'campaign-wizard-styles';
    st.textContent = `
      .cw-steps { display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin:12px 0; font-size:12px; }
      .cw-step { opacity:0.5; }
      .cw-step.is-active { opacity:1; font-weight:700; color: var(--accent,#8b4513); }
      .cw-step.is-done { opacity:0.85; }
      .cw-step-sep { opacity:0.35; }
      .cw-body { min-height: 120px; }
      #campaign-wizard-modal.editor-modal {
        position:fixed; inset:0; z-index:9999; display:flex; align-items:center; justify-content:center;
        background: rgba(0,0,0,0.45);
      }
      #campaign-wizard-modal .editor-modal-panel {
        background: var(--paper,#f5f0e8); color: var(--ink,#2c2418);
        border-radius:12px; padding:20px; max-width:560px; width:92%; max-height:90vh; overflow:auto;
        position:relative; z-index:1;
      }
      #campaign-wizard-modal .editor-modal-backdrop { position:absolute; inset:0; }
      .npc-hub-card h4 { margin:0 0 8px; }
      .btn-sm { font-size:12px; padding:4px 8px; }
    `;
    document.head.appendChild(st);
  }
})();
