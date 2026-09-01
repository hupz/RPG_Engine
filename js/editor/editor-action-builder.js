// Редактор: конструктор цепочек действий
(function attachEditorActionBuilder() {
  if (typeof Editor === 'undefined' || typeof ACTION_REGISTRY === 'undefined') {
    console.warn('editor-action-builder.js: Editor или ACTION_REGISTRY не найдены');
    return;
  }

  const CAT_ORDER = ['inventory', 'economy', 'health', 'scene', 'dialogue', 'combat', 'effects', 'utility'];

  /**
   * Human-friendly action catalog → existing ACTION_REGISTRY ids.
   * User never sees technical type ids in the main picker.
   */
  const HUMAN_ACTIONS = [
    { id: 'say', label: 'Показать диалог', hint: 'Реплика NPC', icon: '🗣️', group: 'Сюжет' },
    { id: 'log', label: 'Показать сообщение', hint: 'Текст в журнале', icon: '💬', group: 'Сюжет' },
    { id: 'show_choices', label: 'Показать выборы', hint: 'Кнопки ответа', icon: '🔘', group: 'Сюжет' },
    { id: 'change_scene', label: 'Изменить сцену', hint: 'Переход в другое место', icon: '🎭', group: 'Сюжет' },
    { id: 'add_item', label: 'Выдать предмет', hint: 'Добавить в инвентарь', icon: '📦', group: 'Предметы и экономика' },
    { id: 'remove_item', label: 'Забрать предмет', hint: 'Убрать из инвентаря', icon: '📤', group: 'Предметы и экономика' },
    { id: 'add_gold', label: 'Дать золото', hint: 'Увеличить золото', icon: '💰', group: 'Предметы и экономика' },
    { id: 'remove_gold', label: 'Забрать золото', hint: 'Уменьшить золото', icon: '💸', group: 'Предметы и экономика' },
    { id: 'heal', label: 'Вылечить', hint: 'Восстановить здоровье', icon: '❤️', group: 'Персонаж' },
    { id: 'damage', label: 'Нанести урон', hint: 'Снять здоровье', icon: '💔', group: 'Персонаж' },
    { id: 'update_quest', label: 'Управление квестом', hint: 'Старт / этап / завершение', icon: '📜', group: 'Квесты' },
    { id: 'start_combat', label: 'Начать бой', hint: 'Встреча с врагами', icon: '⚔️', group: 'Бой' },
    { id: 'end_combat', label: 'Завершить бой', hint: 'Выйти из боя', icon: '🏳️', group: 'Бой' },
    { id: 'advance_time', label: 'Изменить время', hint: 'Сдвинуть игровые часы', icon: '⏳', group: 'Мир' },
    { id: 'rest_short_time', label: 'Короткий отдых', hint: '+1 час', icon: '☕', group: 'Мир' },
    { id: 'rest_long_time', label: 'Долгий отдых', hint: '+8 часов', icon: '🌙', group: 'Мир' },
    { id: 'apply_effect', label: 'Наложить эффект', hint: 'Статус на персонажа', icon: '🔮', group: 'Эффекты' },
    { id: 'remove_effect', label: 'Снять эффект', hint: 'Убрать статус', icon: '✨', group: 'Эффекты' },
    { id: 'skill_check', label: 'Проверка навыка', hint: 'Бросок / сложность', icon: '🎲', group: 'Проверки' },
    { id: 'unlock_achievement', label: 'Достижение', hint: 'Открыть достижение', icon: '🏆', group: 'Прочее' },
    { id: 'play_sound', label: 'Проиграть звук', hint: 'Если поддерживается', icon: '🔊', group: 'Прочее', optional: true },
    { id: 'set_weather', label: 'Изменить погоду', hint: 'Если поддерживается', icon: '🌤', group: 'Прочее', optional: true },
    { id: 'add_exp', label: 'Дать опыт', hint: 'Если поддерживается', icon: '⭐', group: 'Прочее', optional: true },
    { id: 'set_level', label: 'Изменить уровень', hint: 'Если поддерживается', icon: '📈', group: 'Прочее', optional: true },
    { id: 'change_reputation', label: 'Изменить репутацию', hint: 'Если поддерживается', icon: '🤝', group: 'Прочее', optional: true }
  ];

  function humanLabelForAction(actionId) {
    const h = HUMAN_ACTIONS.find((x) => x.id === actionId);
    if (h) return h.label;
    const def = typeof ACTION_REGISTRY !== 'undefined' ? ACTION_REGISTRY[actionId] : null;
    return def?.name || actionId;
  }

  function humanPreview(step) {
    const id = step?.action;
    const p = step?.params || {};
    const data = Editor.data || {};
    const itemName = (iid) => data.items?.[iid]?.name || iid || '…';
    const sceneName = (sid) => data.scenes?.[sid]?.location || data.scenes?.[sid]?.title || sid || '…';
    const npcName = (nid) => data.npcs?.[nid]?.name || nid || '…';
    const questName = (qid) => data.quests?.[qid]?.title || qid || '…';
    switch (id) {
      case 'add_item': return `Выдать «${itemName(p.itemId)}» ×${p.count || 1}`;
      case 'remove_item': return `Забрать «${itemName(p.itemId)}» ×${p.count || 1}`;
      case 'add_gold': return `Дать ${p.amount ?? p.count ?? 0} золота`;
      case 'remove_gold': return `Забрать ${p.amount ?? p.count ?? 0} золота`;
      case 'change_scene': return `Перейти: ${sceneName(p.sceneId)}`;
      case 'say': return `${npcName(p.npcId)}: «${String(p.text || '').slice(0, 40)}${(p.text || '').length > 40 ? '…' : ''}»`;
      case 'log': return `Сообщение: ${String(p.message || p.text || '').slice(0, 50)}`;
      case 'update_quest': {
        const st = String(p.stage || '');
        const mode = st === 'complete' || st === 'done' ? 'завершить' : (!st || st === '0' || st === 'start' ? 'запустить/обновить' : 'этап «' + st + '»');
        return `Квест «${questName(p.questId)}»: ${mode}`;
      }
      case 'start_combat': return 'Начать бой';
      case 'advance_time': return `Время +${p.minutes || 60} мин.`;
      case 'heal': return `Лечение: ${p.amount ?? p.value ?? '…'}`;
      default: return humanLabelForAction(id);
    }
  }

  function validateActionStep(step) {
    const errors = [];
    const def = ACTION_REGISTRY[step?.action];
    if (!def) {
      errors.push('Неизвестное действие');
      return errors;
    }
    (def.params || []).forEach((pd) => {
      if (pd.optional) return;
      const v = step.params?.[pd.name];
      if (v == null || v === '') {
        // skip if no required flag - treat select sources as required
        if (pd.type === 'select' || pd.name === 'itemId' || pd.name === 'sceneId' || pd.name === 'questId' || pd.name === 'npcId') {
          errors.push('Не задано: ' + (pd.label || pd.name));
        }
      }
    });
    return errors;
  }

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
        return `<div class="scene-item${active}" onclick="${this.escapeAttr('Editor.selectActionChain(' + JSON.stringify(id) + ')')}">
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

    async createActionChain() {
      this.ensureActionChainsData();
      const id = await Editor.promptDialog({ message: 'ID цепочки (латиница, snake_case):', defaultValue: 'my_chain' });
      if (!id || !/^[a-z][a-z0-9_]*$/i.test(id)) return;
      if (this.data.actionChains[id]) {
        Editor.toast.warning('Цепочка уже существует');
        return;
      }
      this.data.actionChains[id] = { name: id, steps: [] };
      this.currentActionChainId = id;
      this.updateJSONPreview();
      this.renderActionChainsTab();
    },

    async deleteActionChain() {
      const id = this.currentActionChainId;
      if (!id || !(await Editor.confirmDialog({ message: `Удалить цепочку «${id}»?`, danger: true }))) return;
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

      return `<div class="action-chain-builder">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px;flex-wrap:wrap;">
          <h2>🔗 ${this.escapeHtml(chain.name || chainId)}</h2>
          <button type="button" class="btn btn-danger" onclick="Editor.deleteActionChain()">🗑 Удалить</button>
        </div>
        <div class="form-group">
          <label>Название цепочки</label>
          <input type="text" value="${this.escapeAttr(chain.name || '')}" onchange="Editor.setActionChainName('${this.escapeAttr(chainId)}',this.value)">
        </div>
        <p class="hint" style="margin:0 0 10px;">Что происходит? Добавьте шаги по порядку.</p>
        <div id="action-steps-list" class="action-steps-list">${stepsHtml || '<p class="hint">Пока нет действий. Нажмите «+ Добавить действие».</p>'}</div>
        <button type="button" class="btn btn-primary" style="margin-top:10px;"
          onclick="${this.escapeAttr('Editor.openHumanActionPicker(' + JSON.stringify(chainId) + ')')}">+ Добавить действие</button>
        <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" class="btn btn-secondary" onclick="Editor.saveActionChainFromUI()">💾 Сохранить</button>
          <button type="button" class="btn btn-info" onclick="${this.escapeAttr('Editor.testActionChain(' + JSON.stringify(chainId) + ')')}">👁 Предпросмотр</button>
        </div>
        <div id="action-chain-test-result" class="hint" style="margin-top:8px;"></div>
      </div>`;
    },

    renderActionStepCard(chainId, step, index) {
      const def = ACTION_REGISTRY[step.action];
      const human = HUMAN_ACTIONS.find((h) => h.id === step.action);
      const meta = human
        ? `${human.icon || ''} ${human.label}`
        : (def ? `${ACTION_CATEGORIES[def.category]?.icon || ''} ${def.name}` : step.action);
      const preview = humanPreview(step);
      const errs = validateActionStep(step);
      const errHtml = errs.length
        ? `<div class="quest-task-errors" style="margin:6px 0;">⚠ ${errs.map((e) => this.escapeHtml(e)).join('; ')}</div>`
        : '';
      const paramsHtml = (def?.params || []).map((p) => this.renderActionParamField(chainId, index, p, step.params, step)).join('');
      const onFailVal = typeof step.onFail === 'string' ? step.onFail : (Array.isArray(step.onFail) ? '__array__' : '');
      const onFailListId = this.allocSmartIdList(`step-onfail-${chainId}-${index}`);

      return `<div class="action-step-card" draggable="true"
          ondragstart="Editor.onActionStepDragStart(event,${index})"
          ondragover="event.preventDefault()"
          ondrop="Editor.onActionStepDrop(event,'${this.escapeAttr(chainId)}',${index})">
        <div class="action-step-head">
          <span class="action-step-num">${index + 1}.</span>
          <strong>${this.escapeHtml(meta)}</strong>
          <span class="hint action-step-preview" style="margin-left:8px;">${this.escapeHtml(preview)}</span>
          <span style="flex:1"></span>
          <button type="button" class="btn btn-secondary btn-sm" onclick="${this.escapeAttr('Editor.moveActionStep(' + JSON.stringify(chainId) + ', ' + index + ', -1)')}">↑</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="${this.escapeAttr('Editor.moveActionStep(' + JSON.stringify(chainId) + ', ' + index + ', 1)')}">↓</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="${this.escapeAttr('Editor.duplicateActionStep(' + JSON.stringify(chainId) + ', ' + index + ')')}" title="Дублировать">⧉</button>
          <button type="button" class="btn btn-danger btn-sm" onclick="${this.escapeAttr('Editor.removeActionStep(' + JSON.stringify(chainId) + ', ' + index + ')')}">❌</button>
        </div>
        <div class="action-step-body">${errHtml}${paramsHtml}
          ${def?.returns === 'boolean' || def?.id === 'remove_gold' ? `
            <div class="form-group">
              <label>При неудаче (цепочка)</label>
              ${typeof Editor.renderChainIdField === 'function'
                ? Editor.renderChainIdField(onFailVal, onFailListId, `Editor.setStepOnFail('${this.escapeAttr(chainId)}',${index},this.value)`)
                : `<input type="text" value="${this.escapeAttr(onFailVal)}" onchange="Editor.setStepOnFail('${this.escapeAttr(chainId)}',${index},this.value)">`}
            </div>` : ''}
        </div>
      </div>`;
    },

    renderActionParamField(chainId, stepIndex, paramDef, params, step) {
      let pdef = paramDef;
      if (step && step.action === 'update_quest' && pdef.name === 'stage') {
        const val0 = params?.[pdef.name] != null ? params[pdef.name] : '';
        const ch0 = `Editor.setActionStepParam('${this.escapeAttr(chainId)}',${stepIndex},'stage',`;
        return `<div class="form-group"><label>Что сделать с квестом</label>
          <select onchange="${ch0}this.value)">
            <option value="start" ${val0 === 'start' || val0 === '0' || val0 === '' ? 'selected' : ''}>Запустить / начать</option>
            <option value="1" ${val0 === '1' ? 'selected' : ''}>Этап 1</option>
            <option value="2" ${val0 === '2' ? 'selected' : ''}>Этап 2</option>
            <option value="3" ${val0 === '3' ? 'selected' : ''}>Этап 3</option>
            <option value="complete" ${val0 === 'complete' || val0 === 'done' ? 'selected' : ''}>Завершить</option>
          </select></div>`;
      }
      if (pdef.name === 'questId') {
        pdef = Object.assign({}, pdef, { type: 'select', source: 'quests', label: pdef.label || 'Квест' });
      }

      const val = params?.[pdef.name];
      const label = pdef.label || pdef.name;
      const ch = `Editor.setActionStepParam('${this.escapeAttr(chainId)}',${stepIndex},'${this.escapeAttr(pdef.name)}',`;
      paramDef = pdef;

      if (paramDef.type === 'select' && paramDef.source === 'quests') {
        const quests = this.data.quests || {};
        return `<div class="form-group"><label>${this.escapeHtml(label)}</label>
          <select onchange="${ch}this.value)">
            <option value="">— выберите квест —</option>
            ${Object.keys(quests).map((id) => `<option value="${this.escapeAttr(id)}" ${val === id ? 'selected' : ''}>${this.escapeHtml(quests[id].title || id)}</option>`).join('')}
          </select></div>`;
      }
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
        Editor.toast.error('Ошибка JSON: ' + e.message);
        return null;
      }
    },

    _snapshotActionChain(chainId) {
      if (typeof EditorHistory === 'undefined' || !EditorHistory.makeSnapshot) return null;
      try {
        // chain lives in project data; use generic project snapshot via updateJSONPreview path
        return null;
      } catch (e) {
        return null;
      }
    },

    openHumanActionPicker(chainId) {
      let modal = document.getElementById('human-action-picker');
      if (modal) modal.remove();
      modal = document.createElement('div');
      modal.id = 'human-action-picker';
      modal.className = 'editor-modal';
      const available = HUMAN_ACTIONS.filter((h) => {
        if (h.optional && !ACTION_REGISTRY[h.id]) return false;
        return !!ACTION_REGISTRY[h.id] || h.optional;
      }).filter((h) => ACTION_REGISTRY[h.id]);

      const groups = {};
      available.forEach((h) => {
        const g = h.group || 'Прочее';
        if (!groups[g]) groups[g] = [];
        groups[g].push(h);
      });

      const body = Object.keys(groups).map((g) => {
        const items = groups[g].map((h) =>
          `<button type="button" class="btn btn-secondary human-action-pick" style="width:100%;text-align:left;margin:4px 0;"
            data-action-id="${this.escapeAttr(h.id)}" data-chain-id="${this.escapeAttr(chainId)}">
            <strong>${this.escapeHtml(h.icon + ' ' + h.label)}</strong>
            <span class="hint" style="display:block;font-weight:400;">${this.escapeHtml(h.hint || '')}</span>
          </button>`
        ).join('');
        return `<h4 style="margin:12px 0 6px;">${this.escapeHtml(g)}</h4>${items}`;
      }).join('');

      modal.innerHTML = `
        <div class="editor-modal-backdrop" data-close="1"></div>
        <div class="editor-modal-panel" style="max-width:480px;max-height:80vh;overflow:auto;">
          <div class="quest-detail-head">
            <h2>Что происходит?</h2>
            <button type="button" class="btn-remove" data-close="1">×</button>
          </div>
          <p class="hint">Выберите действие. Технические имена скрыты.</p>
          ${body}
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', (e) => {
        if (e.target.closest('[data-close]')) {
          modal.remove();
          return;
        }
        const btn = e.target.closest('[data-action-id]');
        if (!btn) return;
        const aid = btn.getAttribute('data-action-id');
        const cid = btn.getAttribute('data-chain-id');
        modal.remove();
        this.addActionStep(cid, aid);
      });
    },

    addActionStep(chainId, actionId) {
      const chain = this.data.actionChains[chainId];
      if (!chain) return;
      if (!ACTION_REGISTRY[actionId]) {
        Editor.toast.warning('Действие недоступно: ' + actionId);
        return;
      }
      const def = ACTION_REGISTRY[actionId];
      const params = {};
      (def?.params || []).forEach((p) => {
        if (p.default != null) params[p.name] = p.default;
      });
      // Friendly defaults for quest control
      if (actionId === 'update_quest' && params.stage == null) params.stage = 'start';
      chain.steps.push({ action: actionId, params });
      this.updateJSONPreview();
      this.renderActionChainsTab();
      if (Editor.toast) Editor.toast.success('Действие добавлено: ' + humanLabelForAction(actionId));
    },

    duplicateActionStep(chainId, index) {
      const steps = this.data.actionChains[chainId]?.steps;
      if (!steps || !steps[index]) return;
      const copy = JSON.parse(JSON.stringify(steps[index]));
      steps.splice(index + 1, 0, copy);
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

  if (Editor.hooks?.after) {
    Editor.hooks.after('switchTab', function (result, args) {
      if (args && args[0] === 'actions' && this.data) this.renderActionChainsTab?.();
    });
    Editor.hooks.after('updateJSONPreview', function () {
      if (document.getElementById('tab-actions')?.classList.contains('active')) {
        this.renderActionChainsTab?.();
      }
    });
  } else if (typeof console !== 'undefined' && console.warn) {
    console.warn('[editor-action-builder] Editor.hooks missing — extension skipped');
  }
})();
