// ============================================================
// P1: мастера сцен + квест на выборе по названиям
// ============================================================
(function attachEditorWizards() {
  if (typeof Editor === 'undefined') {
    console.warn('editor-wizards.js: Editor не определён');
    return;
  }

  Object.assign(Editor, {
    _wizardOpen: null,

    openSceneWizard(type) {
      this._wizardOpen = type || 'menu';
      this.renderSceneEditor();
    },

    closeSceneWizard() {
      this._wizardOpen = null;
      this.renderSceneEditor();
    },

    /** Панель мастеров в конструкторе сцены */
    renderSceneWizardsPanel() {
      if (!this._wizardOpen) {
        return `<div class="scene-wizards-bar">
          <span class="hint">Быстрые сценарии:</span>
          <button type="button" class="btn btn-secondary btn-sm" onclick="Editor.openSceneWizard('shop')">🛒 Магазин</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="Editor.openSceneWizard('combat')">⚔️ Бой</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="Editor.openSceneWizard('item')">🎁 Выдать предмет</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="Editor.openSceneWizard('quest')">📜 Старт квеста</button>
        </div>`;
      }
      const type = this._wizardOpen;
      if (type === 'shop') return this.renderWizardShop();
      if (type === 'combat') return this.renderWizardCombat();
      if (type === 'item') return this.renderWizardItem();
      if (type === 'quest') return this.renderWizardQuest();
      return '';
    },

    _wizardShell(title, body) {
      return `<div class="scene-wizard-panel project-info">
        <div class="quest-detail-head">
          <h4>${title}</h4>
          <button type="button" class="btn btn-secondary" onclick="Editor.closeSceneWizard()">Закрыть</button>
        </div>
        ${body}
      </div>`;
    },

    renderWizardShop() {
      const npcOpts = Object.keys(this.data?.npcs || {}).map((id) => {
        const n = this.data.npcs[id]?.name || id;
        return `<option value="${this.escapeAttr(id)}">${this.escapeHtml(n)}</option>`;
      }).join('');
      const invOpts = Object.keys(this.data?.shopInventories || {}).map((id) => {
        const n = this.data.shopInventories[id]?.name || id;
        return `<option value="${this.escapeAttr(id)}">${this.escapeHtml(n)}</option>`;
      }).join('') || '<option value="village_shop">Лавка по умолчанию</option>';
      return this._wizardShell('🛒 Мастер: магазин', `
        <p class="hint">Добавит на текущую сцену торговлю с выбранным NPC.</p>
        <div class="form-group"><label>Продавец</label>
          <select id="wiz-shop-npc"><option value="">—</option>${npcOpts}</select></div>
        <div class="form-group"><label>Ассортимент</label>
          <select id="wiz-shop-inv">${invOpts}</select></div>
        <button type="button" class="btn btn-primary" onclick="Editor.applyWizardShop()">Создать магазин</button>
      `);
    },

    applyWizardShop() {
      const scene = this.data?.scenes?.[this.currentScene];
      if (!scene) return;
      const npc = document.getElementById('wiz-shop-npc')?.value || '';
      const inv = document.getElementById('wiz-shop-inv')?.value || 'village_shop';
      if (!Array.isArray(scene.components)) scene.components = [];
      scene.components.push({
        component: 'trade_interface',
        id: 'trade_' + (scene.components.length + 1),
        enabled: true,
        params: { merchant: npc, inventory: inv, sellMultiplier: 1, buyMultiplier: 0.5 }
      });
      this.ensureSceneEditorModules?.(scene);
      if (scene.editorModules && !scene.editorModules.includes('components')) {
        scene.editorModules.push('components');
      }
      if (npc) {
        scene.npcId = npc;
        if (scene.editorModules && !scene.editorModules.includes('npc')) scene.editorModules.push('npc');
      }
      this._wizardOpen = null;
      this.updateJSONPreview();
      this.renderSceneEditor();
      alert('Магазин добавлен на сцену.');
    },

    renderWizardCombat() {
      const enemies = Object.keys(this.data?.enemies || {});
      const checks = enemies.slice(0, 40).map((id) => {
        const n = this.data.enemies[id]?.name || id;
        return `<label class="tpl-multi-check"><input type="checkbox" value="${this.escapeAttr(id)}"> ${this.escapeHtml(n)}</label>`;
      }).join('');
      const scenes = Object.keys(this.data?.scenes || {}).map((id) => {
        const loc = this.data.scenes[id]?.location || id;
        return `<option value="${this.escapeAttr(id)}">${this.escapeHtml(loc)}</option>`;
      }).join('');
      return this._wizardShell('⚔️ Мастер: бой', `
        <p class="hint">Отметьте врагов и сцену после победы.</p>
        <div class="form-group"><label>Враги</label>
          <div id="wiz-combat-enemies" style="max-height:160px;overflow:auto;display:flex;flex-direction:column;gap:4px;">${checks}</div></div>
        <div class="form-group"><label>После победы перейти в</label>
          <select id="wiz-combat-next"><option value="">— остаться / не задано —</option>${scenes}</select></div>
        <div class="form-group"><label>Короткий текст сцены (необязательно)</label>
          <textarea id="wiz-combat-text" rows="2" placeholder="Враги преграждают путь!"></textarea></div>
        <button type="button" class="btn btn-primary" onclick="Editor.applyWizardCombat()">Настроить бой</button>
      `);
    },

    applyWizardCombat() {
      const scene = this.data?.scenes?.[this.currentScene];
      if (!scene) return;
      const box = document.getElementById('wiz-combat-enemies');
      const ids = box ? [...box.querySelectorAll('input:checked')].map((el) => el.value) : [];
      if (!ids.length) {
        alert('Выберите хотя бы одного врага');
        return;
      }
      scene.combat = ids;
      const next = document.getElementById('wiz-combat-next')?.value;
      if (next) scene.nextScene = next;
      const text = document.getElementById('wiz-combat-text')?.value?.trim();
      if (text) scene.text = text;
      this.ensureSceneEditorModules?.(scene);
      if (scene.editorModules) {
        if (!scene.editorModules.includes('combat')) scene.editorModules.push('combat');
        if (text && !scene.editorModules.includes('story')) scene.editorModules.push('story');
      }
      this._wizardOpen = null;
      this.updateJSONPreview();
      this.renderSceneEditor();
      alert('Бой настроен.');
    },

    renderWizardItem() {
      const items = Object.keys(this.data?.items || {}).map((id) => {
        const n = this.data.items[id]?.name || id;
        return `<option value="${this.escapeAttr(id)}">${this.escapeHtml(n)}</option>`;
      }).join('');
      return this._wizardShell('🎁 Мастер: выдать предмет', `
        <p class="hint">Предмет выдаётся при входе в сцену.</p>
        <div class="form-group"><label>Предмет</label>
          <select id="wiz-item-id">${items}</select></div>
        <div class="form-group"><label>Сообщение в тексте сцены (необязательно)</label>
          <input type="text" id="wiz-item-note" placeholder="Вы находите…"></div>
        <button type="button" class="btn btn-primary" onclick="Editor.applyWizardItem()">Выдать предмет</button>
      `);
    },

    applyWizardItem() {
      const scene = this.data?.scenes?.[this.currentScene];
      if (!scene) return;
      const itemId = document.getElementById('wiz-item-id')?.value;
      if (!itemId) return;
      if (!Array.isArray(scene.items)) scene.items = [];
      scene.items.push(itemId);
      const note = document.getElementById('wiz-item-note')?.value?.trim();
      if (note) {
        scene.text = (scene.text ? scene.text + '\n\n' : '') + note;
      }
      this.ensureSceneEditorModules?.(scene);
      if (scene.editorModules) {
        if (!scene.editorModules.includes('items')) scene.editorModules.push('items');
        if (!scene.editorModules.includes('story')) scene.editorModules.push('story');
      }
      this._wizardOpen = null;
      this.updateJSONPreview();
      this.renderSceneEditor();
      const name = this.data.items?.[itemId]?.name || itemId;
      alert('Предмет «' + name + '» будет выдан при входе.');
    },

    renderWizardQuest() {
      const quests = Object.keys(this.data?.quests || {}).map((id) => {
        const t = this.data.quests[id]?.title || id;
        return `<option value="${this.escapeAttr(id)}">${this.escapeHtml(t)}</option>`;
      }).join('');
      const firstQ = Object.keys(this.data?.quests || {})[0] || '';
      const stages = this._wizardQuestStageOptions(firstQ, '0');
      return this._wizardShell('📜 Мастер: старт / этап квеста', `
        <p class="hint">Добавит выбор: «Принять» → квест перейдёт на выбранный этап.</p>
        <div class="form-group"><label>Квест</label>
          <select id="wiz-quest-id" onchange="Editor._wizardRefreshQuestStages()">
            <option value="">— выберите —</option>${quests}
          </select></div>
        <div class="form-group"><label>Этап</label>
          <select id="wiz-quest-stage">${stages}</select></div>
        <div class="form-group"><label>Текст кнопки</label>
          <input type="text" id="wiz-quest-btn" value="Принять задание"></div>
        <div class="form-group"><label>Куда ведёт выбор (сцена)</label>
          <select id="wiz-quest-to">
            <option value="">— остаться здесь —</option>
            ${Object.keys(this.data?.scenes || {}).map((id) => {
              const loc = this.data.scenes[id]?.location || id;
              return `<option value="${this.escapeAttr(id)}">${this.escapeHtml(loc)}</option>`;
            }).join('')}
          </select></div>
        <button type="button" class="btn btn-primary" onclick="Editor.applyWizardQuest()">Добавить выбор с квестом</button>
      `);
    },

    _wizardQuestStageOptions(questId, selected) {
      const q = this.data?.quests?.[questId];
      if (!q || !Array.isArray(q.stages)) {
        return '<option value="0">Начало</option>';
      }
      return q.stages.map((st, i) => {
        const label = st.title || st.hint || ('Этап ' + (i + 1));
        const tag = st.finish ? ' ✓' : (st.failed ? ' ✗' : '');
        const sel = String(selected) === String(i) ? ' selected' : '';
        return `<option value="${i}"${sel}>${this.escapeHtml(label + tag)}</option>`;
      }).join('');
    },

    _wizardRefreshQuestStages() {
      const qid = document.getElementById('wiz-quest-id')?.value;
      const sel = document.getElementById('wiz-quest-stage');
      if (sel) sel.innerHTML = this._wizardQuestStageOptions(qid, '0');
    },

    applyWizardQuest() {
      const scene = this.data?.scenes?.[this.currentScene];
      if (!scene) return;
      const qid = document.getElementById('wiz-quest-id')?.value;
      if (!qid) {
        alert('Выберите квест');
        return;
      }
      const stage = document.getElementById('wiz-quest-stage')?.value || '0';
      const btn = document.getElementById('wiz-quest-btn')?.value || 'Принять задание';
      const to = document.getElementById('wiz-quest-to')?.value || '';
      if (!Array.isArray(scene.choices)) scene.choices = [];
      scene.choices.push({
        text: btn,
        to: to || undefined,
        icon: '📜',
        once: true,
        questSet: { questId: qid, stage: String(stage) }
      });
      this.ensureSceneEditorModules?.(scene);
      if (scene.editorModules) {
        if (!scene.editorModules.includes('choices')) scene.editorModules.push('choices');
        if (!scene.editorModules.includes('quest')) scene.editorModules.push('quest');
      }
      this._wizardOpen = null;
      this.updateJSONPreview();
      this.renderSceneEditor();
      const title = this.data.quests[qid]?.title || qid;
      alert('Выбор добавлен: квест «' + title + '».');
    },

    /**
     * UI квеста на выборе — только названия.
     */
    renderChoiceQuestFields(choice, idx) {
      const qs = choice.questSet || {};
      const questIds = Object.keys(this.data?.quests || {});
      const qopts = questIds.map((qid) => {
        const title = this.data.quests[qid]?.title || qid;
        const sel = qs.questId === qid ? ' selected' : '';
        return `<option value="${this.escapeAttr(qid)}"${sel}>${this.escapeHtml(title)}</option>`;
      }).join('');
      let stageHtml = '<option value="">— этап —</option>';
      if (qs.questId && this.data.quests[qs.questId]?.stages) {
        stageHtml += this.data.quests[qs.questId].stages.map((st, i) => {
          const label = st.title || st.hint || ('Этап ' + (i + 1));
          const tag = st.finish ? ' (финал)' : (st.failed ? ' (провал)' : '');
          const sel = String(qs.stage) === String(i) || String(qs.stage) === String(st.id) ? ' selected' : '';
          return `<option value="${i}"${sel}>${this.escapeHtml(label + tag)}</option>`;
        }).join('');
      }
      const has = !!qs.questId;
      return `<div class="choice-quest-fields project-info" style="margin-top:8px;">
        <label><input type="checkbox" ${has ? 'checked' : ''}
          onchange="if(this.checked){Editor.setChoiceQuestSet(${idx},'questId',Object.keys(Editor.data.quests||{})[0]||'');}else{Editor.clearChoiceQuestSet(${idx});}">
          Продвинуть квест при выборе</label>
        ${has ? `<div class="grid-2" style="margin-top:6px;">
          <div class="form-group"><label>Квест</label>
            <select onchange="Editor.setChoiceQuestSet(${idx},'questId',this.value)">
              <option value="">—</option>${qopts}
            </select></div>
          <div class="form-group"><label>Этап</label>
            <select onchange="Editor.setChoiceQuestSet(${idx},'stage',this.value)">${stageHtml}</select></div>
        </div>
        <p class="hint">Игрок увидит прогресс задания; технические id не нужны.</p>` : ''}
      </div>`;
    },

    clearChoiceQuestSet(idx) {
      const c = this.data?.scenes?.[this.currentScene]?.choices?.[idx];
      if (!c) return;
      delete c.questSet;
      this.renderSceneEditor();
      this.updateJSONPreview();
    }
  });

  function injectSceneWizardsPanel() {
    const container = document.getElementById('scene-editor');
    if (!container || !Editor.currentScene) return;
    const host = container.querySelector('.scene-builder') || container;
    if (host.querySelector('.scene-wizards-bar') || host.querySelector('.scene-wizard-panel')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = Editor.renderSceneWizardsPanel();
    const el = wrap.firstElementChild;
    if (!el) return;
    const core = host.querySelector('.scene-builder-core');
    if (core && core.parentNode) core.parentNode.insertBefore(el, core.nextSibling);
    else host.insertBefore(el, host.firstChild);
  }

  if (Editor.hooks && typeof Editor.hooks.after === 'function') {
    Editor.hooks.after('renderSceneEditor', function () { injectSceneWizardsPanel(); });
  } else {
    const origRender = Editor.renderSceneEditor?.bind(Editor);
    if (typeof origRender === 'function') {
      Editor.renderSceneEditor = function () {
        origRender();
        injectSceneWizardsPanel();
      };
    }
  }

  // renderChoiceEditor returns HTML — оставляем replace через hooks.replace, если доступно
  const origChoice = Editor.renderChoiceEditor?.bind(Editor);
  if (typeof origChoice === 'function') {
    const patched = function (c, i, allScenes) {
      let html = origChoice(c, i, allScenes);
      const questBlock = this.renderChoiceQuestFields(c, i);
      if (html.includes('choice-quest-fields')) return html;
      if (html.includes('</div>')) {
        const idx = html.lastIndexOf('</div>');
        html = html.slice(0, idx) + questBlock + html.slice(idx);
      } else html += questBlock;
      return html;
    };
    if (Editor.hooks && typeof Editor.hooks.replace === 'function') {
      Editor.hooks.replace('renderChoiceEditor', function (c, i, allScenes) {
        return patched.call(this, c, i, allScenes);
      });
    } else {
      Editor.renderChoiceEditor = patched;
    }
  }

  // Визуальные пресеты костей для эффектов способностей
  Object.assign(Editor, {
    DICE_PRESETS: ['1d4', '1d6', '1d8', '1d10', '1d12', '2d6', '2d8', '3d6', '3d8', '4d6'],

    renderDicePresetSelect(current, onchangeAttr) {
      const cur = current || '1d6';
      const opts = this.DICE_PRESETS.map((d) =>
        `<option value="${d}" ${d === cur ? 'selected' : ''}>${d}</option>`
      ).join('');
      return `<select onchange="${onchangeAttr}">${opts}
        <option value="__custom__" ${this.DICE_PRESETS.includes(cur) ? '' : 'selected'}>Своё…</option>
      </select>`;
    }
  });

  if (typeof document !== 'undefined' && !document.getElementById('wizards-styles')) {
    const st = document.createElement('style');
    st.id = 'wizards-styles';
    st.textContent = `
      .scene-wizards-bar { display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin:12px 0; padding:10px; border:1px dashed var(--border,#444); border-radius:8px; }
      .scene-wizard-panel { margin:12px 0; }
      .choice-quest-fields { padding:8px; border-radius:6px; }
      .btn-sm { font-size:12px; padding:4px 10px; }
    `;
    document.head.appendChild(st);
  }
})();
