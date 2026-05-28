// Редактор: конструктор цепочек действий
(function attachEditorActionBuilder() {
  if (typeof Editor === 'undefined' || typeof ACTION_REGISTRY === 'undefined') {
    console.warn('editor-action-builder.js: Editor или ACTION_REGISTRY не найдены');
    return;
  }

  const CAT_ORDER = ['inventory', 'economy', 'health', 'scene', 'dialogue', 'combat', 'effects', 'utility'];

  Object.assign(Editor, {
    currentActionChainId: null,

    ensureActionChainsData() {
      if (!this.data) return;
      if (typeof ActionChainLibrary !== 'undefined') ActionChainLibrary.ensureActionChains(this.data);
      if (!this.data.actionChains) this.data.actionChains = {};
    },

    renderActionChainsTab() {
      this.ensureActionChainsData();
      const el = document.getElementById('actions-editor');
      if (!el) return;

      const chains = this.data.actionChains || {};
      const ids = Object.keys(chains).sort();
      if (!this.currentActionChainId || !chains[this.currentActionChainId]) {
        this.currentActionChainId = ids[0] || null;
      }

      const listHtml = ids.map((id) => {
        const c = chains[id];
        const active = id === this.currentActionChainId ? ' active' : '';
        return `<div class="scene-item${active}" onclick="Editor.selectActionChain('${this.escapeAttr(id)}')">
          <div class="scene-id">${this.escapeHtml(id)}</div>
          <div class="scene-loc">${this.escapeHtml(c.name || id)}</div>
        </div>`;
      }).join('');

      el.innerHTML = `<div class="actions-editor-layout">
        <div class="actions-chain-list">
          <h3>Цепочки</h3>
          <div class="scene-list">${listHtml || '<p class="hint">Нет цепочек</p>'}</div>
          <button type="button" class="btn btn-secondary" style="margin-top:8px;width:100%;" onclick="Editor.createActionChain()">+ Новая цепочка</button>
        </div>
        <div class="actions-chain-workspace" id="action-chain-workspace">
          ${this.currentActionChainId ? this.renderActionChainBuilder(this.currentActionChainId) : '<p class="hint">Выберите или создайте цепочку.</p>'}
        </div>
      </div>`;
    },

    selectActionChain(id) {
      this.currentActionChainId = id;
      this.renderActionChainsTab();
    },

    createActionChain() {
      this.ensureActionChainsData();
      const id = prompt('ID цепочки (латиница, snake_case):', 'my_chain');
      if (!id || !/^[a-z][a-z0-9_]*$/i.test(id)) return;
      if (this.data.actionChains[id]) {
        alert('Цепочка уже существует');
        return;
      }
      this.data.actionChains[id] = { name: id, steps: [] };
      this.currentActionChainId = id;
      this.updateJSONPreview();
      this.renderActionChainsTab();
    },

    deleteActionChain() {
      const id = this.currentActionChainId;
      if (!id || !confirm(`Удалить цепочку «${id}»?`)) return;
      delete this.data.actionChains[id];
      this.currentActionChainId = Object.keys(this.data.actionChains)[0] || null;
      this.updateJSONPreview();
      this.renderActionChainsTab();
    },

    renderActionChainBuilder(chainId) {
      const chain = this.data.actionChains[chainId];
      if (!chain) return '';
      if (!Array.isArray(chain.steps)) chain.steps = [];

      const stepsHtml = chain.steps.map((step, i) => this.renderActionStepCard(chainId, step, i)).join('');

      let addMenu = '';
      CAT_ORDER.forEach((cat) => {
        const meta = ACTION_CATEGORIES[cat];
        const actions = Object.values(ACTION_REGISTRY).filter((a) => a.category === cat);
        if (!actions.length) return;
        addMenu += `<div class="action-add-category"><strong>${meta.icon} ${meta.label}</strong>
          <div class="action-add-btns">${actions.map((a) =>
            `<button type="button" class="btn btn-secondary btn-sm" onclick="Editor.addActionStep('${chainId}','${a.id}')">${this.escapeHtml(a.name)}</button>`
          ).join('')}</div></div>`;
      });

      return `<div class="action-chain-builder">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <h2>🔗 ${this.escapeHtml(chain.name || chainId)}</h2>
          <button type="button" class="btn btn-danger" onclick="Editor.deleteActionChain()">🗑 Удалить</button>
        </div>
        <div class="form-group">
          <label>ID</label>
          <input type="text" value="${this.escapeAttr(chainId)}" disabled>
        </div>
        <div class="form-group">
          <label>Название</label>
          <input type="text" value="${this.escapeAttr(chain.name || '')}" onchange="Editor.setActionChainName('${this.escapeAttr(chainId)}',this.value)">
        </div>
        <div id="action-steps-list" class="action-steps-list">${stepsHtml || '<p class="hint">Добавьте действия ниже.</p>'}</div>
        <div class="action-add-panel project-info">
          <h4>+ Добавить действие</h4>
          ${addMenu}
        </div>
        <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" class="btn btn-primary" onclick="Editor.saveActionChainFromUI()">💾 Сохранить цепочку</button>
          <button type="button" class="btn btn-info" onclick="Editor.testActionChain('${this.escapeAttr(chainId)}')">👁️ Тестовый запуск</button>
        </div>
        <div id="action-chain-test-result" class="hint" style="margin-top:8px;"></div>
      </div>`;
    },

    renderActionStepCard(chainId, step, index) {
      const def = ACTION_REGISTRY[step.action];
      const meta = def ? `${ACTION_CATEGORIES[def.category]?.icon || ''} ${def.name}` : step.action;
      const paramsHtml = (def?.params || []).map((p) => this.renderActionParamField(chainId, index, p, step.params)).join('');
      const onFailVal = typeof step.onFail === 'string' ? step.onFail : (Array.isArray(step.onFail) ? '__array__' : '');
      const chainIds = Object.keys(this.data.actionChains || {});

      return `<div class="action-step-card" draggable="true"
          ondragstart="Editor.onActionStepDragStart(event,${index})"
          ondragover="event.preventDefault()"
          ondrop="Editor.onActionStepDrop(event,'${this.escapeAttr(chainId)}',${index})">
        <div class="action-step-head">
          <span class="action-step-num">${index + 1}.</span>
          <strong>${this.escapeHtml(meta)}</strong>
          <span style="flex:1"></span>
          <button type="button" class="btn btn-secondary btn-sm" onclick="Editor.moveActionStep('${this.escapeAttr(chainId)}',${index},-1)">↑</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="Editor.moveActionStep('${this.escapeAttr(chainId)}',${index},1)">↓</button>
          <button type="button" class="btn btn-danger btn-sm" onclick="Editor.removeActionStep('${this.escapeAttr(chainId)}',${index})">❌</button>
        </div>
        <div class="action-step-body">${paramsHtml}
          ${def?.returns === 'boolean' || def?.id === 'remove_gold' ? `
            <div class="form-group">
              <label>При неудаче (ID цепочки)</label>
              <select onchange="Editor.setStepOnFail('${this.escapeAttr(chainId)}',${index},this.value)">
                <option value="">— нет —</option>
                ${chainIds.map((cid) => `<option value="${this.escapeAttr(cid)}" ${onFailVal === cid ? 'selected' : ''}>${this.escapeHtml(cid)}</option>`).join('')}
              </select>
            </div>` : ''}
        </div>
      </div>`;
    },

    renderActionParamField(chainId, stepIndex, paramDef, params) {
      const val = params?.[paramDef.name];
      const label = paramDef.label || paramDef.name;
      const ch = `Editor.setActionStepParam('${this.escapeAttr(chainId)}',${stepIndex},'${this.escapeAttr(paramDef.name)}',`;

      if (paramDef.type === 'select' && paramDef.source === 'items') {
        const items = this.data.items || {};
        return `<div class="form-group"><label>${this.escapeHtml(label)}</label>
          <select onchange="${ch}this.value)">
            <option value="">—</option>
            ${Object.keys(items).map((id) => `<option value="${this.escapeAttr(id)}" ${val === id ? 'selected' : ''}>${this.escapeHtml(items[id].name || id)}</option>`).join('')}
          </select></div>`;
      }
      if (paramDef.type === 'select' && paramDef.source === 'scenes') {
        const scenes = this.data.scenes || {};
        return `<div class="form-group"><label>${this.escapeHtml(label)}</label>
          <select onchange="${ch}this.value)">
            ${Object.keys(scenes).map((id) => `<option value="${this.escapeAttr(id)}" ${val === id ? 'selected' : ''}>${this.escapeHtml(id)}</option>`).join('')}
          </select></div>`;
      }
      if (paramDef.type === 'select' && paramDef.source === 'npcs') {
        const npcs = this.data.npcs || {};
        return `<div class="form-group"><label>${this.escapeHtml(label)}</label>
          <select onchange="${ch}this.value)">
            ${Object.keys(npcs).map((id) => `<option value="${this.escapeAttr(id)}" ${val === id ? 'selected' : ''}>${this.escapeHtml(npcs[id].name || id)}</option>`).join('')}
          </select></div>`;
      }
      if (paramDef.type === 'select' && paramDef.source === 'skills') {
        const skills = typeof ACTION_SKILL_IDS !== 'undefined' ? ACTION_SKILL_IDS : [];
        return `<div class="form-group"><label>${this.escapeHtml(label)}</label>
          <select onchange="${ch}this.value)">
            ${skills.map((id) => `<option value="${id}" ${val === id ? 'selected' : ''}>${id}</option>`).join('')}
          </select></div>`;
      }
      if (paramDef.type === 'select' && paramDef.options) {
        return `<div class="form-group"><label>${this.escapeHtml(label)}</label>
          <select onchange="${ch}this.value)">
            ${paramDef.options.map((o) => `<option value="${this.escapeAttr(String(o))}" ${String(val) === String(o) ? 'selected' : ''}>${this.escapeHtml(String(o))}</option>`).join('')}
          </select></div>`;
      }
      if (paramDef.type === 'textarea' || paramDef.type === 'json') {
        const v = paramDef.type === 'json' ? JSON.stringify(val != null ? val : (paramDef.name === 'choices' ? [] : ''), null, 2) : (val || '');
        return `<div class="form-group"><label>${this.escapeHtml(label)}</label>
          <textarea rows="3" onchange="${ch}${paramDef.type === 'json' ? 'Editor._parseJsonParam(this.value)' : 'this.value'})">${this.escapeHtml(v)}</textarea></div>`;
      }
      if (paramDef.type === 'number') {
        return `<div class="form-group"><label>${this.escapeHtml(label)}</label>
          <input type="number" value="${val != null ? val : (paramDef.default ?? '')}" onchange="${ch}parseFloat(this.value)||0)"></div>`;
      }
      if (paramDef.type === 'boolean') {
        return `<div class="form-group"><label><input type="checkbox" ${val ? 'checked' : ''} onchange="${ch}this.checked)"> ${this.escapeHtml(label)}</label></div>`;
      }
      return `<div class="form-group"><label>${this.escapeHtml(label)}</label>
        <input type="text" value="${this.escapeAttr(val != null ? val : '')}" onchange="${ch}this.value)"></div>`;
    },

    _parseJsonParam(str) {
      try {
        return JSON.parse(str);
      } catch (e) {
        alert('Ошибка JSON: ' + e.message);
        return null;
      }
    },

    addActionStep(chainId, actionId) {
      const chain = this.data.actionChains[chainId];
      if (!chain) return;
      const def = ACTION_REGISTRY[actionId];
      const params = {};
      (def?.params || []).forEach((p) => {
        if (p.default != null) params[p.name] = p.default;
      });
      chain.steps.push({ action: actionId, params });
      this.updateJSONPreview();
      this.renderActionChainsTab();
    },

    removeActionStep(chainId, index) {
      this.data.actionChains[chainId]?.steps?.splice(index, 1);
      this.updateJSONPreview();
      this.renderActionChainsTab();
    },

    moveActionStep(chainId, index, dir) {
      const steps = this.data.actionChains[chainId]?.steps;
      if (!steps) return;
      const j = index + dir;
      if (j < 0 || j >= steps.length) return;
      const t = steps[index];
      steps[index] = steps[j];
      steps[j] = t;
      this.updateJSONPreview();
      this.renderActionChainsTab();
    },

    _actionStepDragIndex: null,

    onActionStepDragStart(ev, index) {
      this._actionStepDragIndex = index;
      ev.dataTransfer.effectAllowed = 'move';
    },

    onActionStepDrop(ev, chainId, dropIndex) {
      ev.preventDefault();
      const from = this._actionStepDragIndex;
      if (from == null || from === dropIndex) return;
      const steps = this.data.actionChains[chainId]?.steps;
      if (!steps) return;
      const [item] = steps.splice(from, 1);
      steps.splice(dropIndex, 0, item);
      this._actionStepDragIndex = null;
      this.updateJSONPreview();
      this.renderActionChainsTab();
    },

    setActionStepParam(chainId, stepIndex, key, value) {
      const step = this.data.actionChains[chainId]?.steps?.[stepIndex];
      if (!step) return;
      if (!step.params) step.params = {};
      if (value === null) return;
      step.params[key] = value;
      this.updateJSONPreview();
    },

    setStepOnFail(chainId, stepIndex, chainRef) {
      const step = this.data.actionChains[chainId]?.steps?.[stepIndex];
      if (!step) return;
      if (chainRef) step.onFail = chainRef;
      else delete step.onFail;
      this.updateJSONPreview();
    },

    setActionChainName(chainId, name) {
      const c = this.data.actionChains[chainId];
      if (c) c.name = name;
      this.updateJSONPreview();
    },

    saveActionChainFromUI() {
      this.updateJSONPreview();
      const el = document.getElementById('action-chain-test-result');
      if (el) el.textContent = '💾 Цепочка записана в JSON-превью. Экспортируйте game_data.json для игры.';
    },

    buildTestEngine() {
      return {
        state: {
          gold: 200,
          hp: 10,
          maxHp: 25,
          inventory: [],
          flags: {},
          equipped: {},
          party: null
        },
        data: this.data,
        ENHANCEMENT_SLOTS: ['weapon_main', 'armor', 'shield'],
        escapeHtml: (s) => this.escapeHtml(s),
        escapeAttr: (s) => this.escapeAttr(s),
        d20: () => 12,
        parseRoll: (f) => ActionRunner.parseRollAmount({ parseRollAmount: (x) => ActionRunner.parseRollAmount({ parseRoll: () => 4 }, x) }, f),
        parseRollAmount: (f) => ActionRunner.parseRollAmount({ parseRoll: (form) => { const m = String(form).match(/(\d+)d(\d+)/); return m ? parseInt(m[1]) * parseInt(m[2]) : 5; } }, f),
        getSkillBonus: () => 2,
        addItem(id) { this.state.inventory.push(id); },
        removeItem() {},
        unequipItem() {},
        updateStats() {},
        updateQuest() {},
        setText(t) { this._lastText = t; },
        setChoices() {},
        showScene() {},
        log(msg) { this._logs = (this._logs || []).concat(msg); },
        saveGame() {},
        refreshSceneComponents() {},
        restoreAllResources() {},
        getDefaultCreatureType: () => 'humanoid',
        startCombat() {},
        takeDamage() {}
      };
    },

    async testActionChain(chainId) {
      const el = document.getElementById('action-chain-test-result');
      if (!el || typeof ActionRunner === 'undefined') return;
      const engine = this.buildTestEngine();
      engine.parseRollAmount = (f) => ActionRunner.parseRollAmount(engine, f);
      const res = await ActionRunner.runChain(engine, chainId);
      el.innerHTML = `<strong>Результат:</strong> ${res.ok ? '✅ OK' : '❌ остановлено'}<br>
        ${(engine._logs || []).map((l) => this.escapeHtml(l)).join('<br>') || ''}
        ${engine._lastText ? '<br>' + this.escapeHtml(engine._lastText) : ''}`;
      this.updateJSONPreview();
    }
  });

  const origSwitch = Editor.switchTab.bind(Editor);
  Editor.switchTab = function (tab, event) {
    origSwitch(tab, event);
    if (tab === 'actions' && this.data) this.renderActionChainsTab();
  };

  const origLoad = Editor.loadData || Editor.setData;
  if (Editor.updateJSONPreview) {
    const origPreview = Editor.updateJSONPreview.bind(Editor);
    Editor.updateJSONPreview = function () {
      origPreview();
      if (document.getElementById('tab-actions')?.classList.contains('active')) {
        this.renderActionChainsTab();
      }
    };
  }
})();
