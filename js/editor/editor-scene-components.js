// Редактор: компоненты сцен (диалог, торговля, ремонт и т.д.)
(function attachEditorSceneComponents() {
  if (typeof Editor === 'undefined' || typeof SceneComponentRegistry === 'undefined') {
    console.warn('editor-scene-components.js: Editor или SceneComponentRegistry не найдены');
    return;
  }

  const TYPE_ORDER = SceneComponentRegistry.listTypes();

  function npcOptions(data, selected) {
    const npcs = data?.npcs || {};
    return Object.keys(npcs).map((id) => {
      const name = npcs[id]?.name || id;
      const sel = id === selected ? ' selected' : '';
      return `<option value="${Editor.escapeAttr(id)}"${sel}>${Editor.escapeHtml(name)}</option>`;
    }).join('');
  }

  function inventoryOptions(data, selected) {
    const invs = data?.shopInventories || {};
    let html = '<option value="">— список предметов —</option>';
    Object.keys(invs).forEach((id) => {
      const name = invs[id]?.name || id;
      const sel = id === selected ? ' selected' : '';
      html += `<option value="${Editor.escapeAttr(id)}"${sel}>${Editor.escapeHtml(name)}</option>`;
    });
    return html;
  }

  function ensureComponentsArray(scene) {
    if (!Array.isArray(scene.components)) scene.components = [];
    return scene.components;
  }

  function renderChainIdFieldForEditor(currentValue, datalistId, onChangeAttr) {
    return Editor.renderChainIdField(currentValue, datalistId, onChangeAttr);
  }

  function actionOptions(selected) {
    if (typeof ACTION_REGISTRY === 'undefined') {
      return '<option value="">— реестр действий не загружен —</option>';
    }
    let html = '<option value="">— выберите действие —</option>';
    Object.values(ACTION_REGISTRY)
      .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id, 'ru'))
      .forEach((def) => {
        const id = def.id;
        const sel = id === selected ? ' selected' : '';
        html += `<option value="${Editor.escapeAttr(id)}"${sel}>${Editor.escapeHtml(def.name || id)} (${id})</option>`;
      });
    return html;
  }

  const SERVICE_TYPE_OPTIONS = [
    { id: 'action', label: 'Действие (action)' },
    { id: 'chain', label: 'Цепочка (chain)' },
    { id: 'panel', label: 'Панель (panel)' }
  ];

  const SERVICE_PANEL_OPTIONS = [
    { id: 'repair_panel', label: '🔧 Ремонт (repair_panel)' },
    { id: 'upgrade_panel', label: '⬆️ Улучшение (upgrade_panel)' },
    { id: 'curse_remove_panel', label: '✨ Снятие проклятия (curse_remove_panel)' },
    { id: 'gamble_panel', label: '🎲 Азарт (gamble_panel)' },
    { id: 'craft_panel', label: '🔨 Крафт (craft_panel)' }
  ];

  function panelOptions(selected) {
    return SERVICE_PANEL_OPTIONS.map((p) => {
      const sel = p.id === selected ? ' selected' : '';
      return `<option value="${Editor.escapeAttr(p.id)}"${sel}>${Editor.escapeHtml(p.label)}</option>`;
    }).join('');
  }

  function serviceTypeOptions(selected) {
    return SERVICE_TYPE_OPTIONS.map((t) => {
      const sel = t.id === selected ? ' selected' : '';
      return `<option value="${Editor.escapeAttr(t.id)}"${sel}>${Editor.escapeHtml(t.label)}</option>`;
    }).join('');
  }

  function jsonFieldText(value) {
    if (value == null) return '{}';
    if (typeof value === 'string') {
      try {
        return JSON.stringify(JSON.parse(value), null, 2);
      } catch {
        return value;
      }
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return '{}';
    }
  }

  Object.assign(Editor, {
    renderSceneComponentsSection(scene) {
      const comps = scene.components || [];
      const cards = comps.map((c, i) => this.renderComponentEditorCard(c, i)).join('');
      const typeMenu = TYPE_ORDER.map((t) => {
        const m = SceneComponentRegistry.getMeta(t);
        return `<button type="button" class="btn btn-secondary component-add-type" onclick="${this.escapeAttr('Editor.addSceneComponent(' + JSON.stringify(t) + ')')}">${m.icon} ${Editor.escapeHtml(m.label)}</button>`;
      }).join('');

      return `<div class="scene-components-editor project-info" style="margin-top:16px;">
        <h4>🧩 Компоненты сцены</h4>
        <p class="hint">Сцена как контейнер: блоки рендерятся сверху вниз. Наследуются только фон/музыка хаба, не компоненты.</p>
        <div id="scene-components-list">${cards || '<p class="hint">Компонентов пока нет — добавьте ниже.</p>'}</div>
        <div class="component-add-menu" style="margin:12px 0; display:flex; flex-wrap:wrap; gap:6px;">
          ${typeMenu}
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" class="btn btn-primary" onclick="Editor.previewSceneComponents()">👁️ Предпросмотр компонентов</button>
        </div>
        <div id="components-preview-box" class="components-preview-box hidden" style="margin-top:12px;"></div>
      </div>`;
    },

    renderComponentEditorCard(comp, index) {
      const type = comp.component || 'dialogue';
      const meta = SceneComponentRegistry.getMeta(type);
      const p = comp.params || {};
      const enabled = comp.enabled !== false;
      let fields = '';

      const npcSel = (field, val) => `<div class="form-group"><label>NPC</label>
        <select onchange="Editor.updateComponentParam(${index},'${field}',this.value)">
          <option value="">—</option>
          ${npcOptions(this.data, val || p.npc || p.merchant)}
        </select></div>`;

      switch (type) {
        case 'dialogue':
        case 'dialogue_tree':
          fields = `${npcSel('npc', p.npc)}
            <div class="form-group"><label>Цепочка при входе (chainOnEnter)</label>
              ${renderChainIdFieldForEditor(
                comp.chainOnEnter || '',
                Editor.allocSmartIdList(`comp-chain-enter-${index}`),
                `Editor.setComponentChainOnEnter(${index},this.value)`
              )}
              <p class="hint">Подсказка: id и название цепочки из вкладки «Действия».</p>
            </div>
            <div class="form-group"><label>Приветствие</label>
              <textarea rows="2" onchange="Editor.updateComponentParam(${index},'greeting',this.value)">${Editor.escapeHtml(p.greeting || '')}</textarea>
            </div>
            <div class="form-group"><label>Темы диалога</label>
              <p class="hint">Каждая тема — кнопка в разговоре. Без JSON.</p>
              <div class="dialogue-topics-builder">${this.renderDialogueTopicsBuilder(index, p.topics || [])}</div>
              <button type="button" class="btn btn-secondary" onclick="Editor.addDialogueTopic(${index})">+ Тема</button>
            </div>`;
          break;
        case 'interactive':
        case 'interactive_panel':
          fields = `<div class="form-group"><label>Текст кнопки</label>
              <input type="text" value="${Editor.escapeAttr(p.label || '')}" onchange="Editor.updateComponentParam(${index},'label',this.value)">
            </div>
            <div class="form-group"><label>Иконка</label>
              <input type="text" value="${Editor.escapeAttr(p.icon || '➡️')}" onchange="Editor.updateComponentParam(${index},'icon',this.value)">
            </div>
            <div class="form-group"><label>Цепочка (chain)</label>
              ${renderChainIdFieldForEditor(
                p.chain || '',
                Editor.allocSmartIdList(`comp-chain-${index}`),
                `Editor.updateComponentParam(${index},'chain',this.value)`
              )}
              <p class="hint">Подсказка: id и название цепочки.</p>
            </div>`;
          break;
        case 'trade':
        case 'trade_interface':
          fields = `${npcSel('merchant', p.merchant)}
            <div class="form-group"><label>Ассортимент</label>
              <select onchange="Editor.updateComponentParam(${index},'inventory',this.value)">
                ${inventoryOptions(this.data, p.inventory)}
              </select>
            </div>
            <div class="form-group"><label>Цена покупки (×)</label>
              <input type="number" step="0.1" value="${p.sellMultiplier ?? 1}" onchange="Editor.updateComponentParam(${index},'sellMultiplier',parseFloat(this.value)||1)">
            </div>
            <div class="form-group"><label>Цена продажи (×)</label>
              <input type="number" step="0.1" value="${p.buyMultiplier ?? 0.5}" onchange="Editor.updateComponentParam(${index},'buyMultiplier',parseFloat(this.value)||0.5)">
            </div>
            <div class="form-group"><label>Репутация (флаг)</label>
              <input type="text" value="${Editor.escapeAttr(p.repFaction || '')}" onchange="Editor.updateComponentParam(${index},'repFaction',this.value)">
            </div>
            <div class="form-group"><label><input type="checkbox" ${p.jackShop ? 'checked' : ''} onchange="Editor.updateComponentParam(${index},'jackShop',this.checked)"> Лавка Джека</label></div>`;
          break;
        case 'service_menu':
          fields = `<div class="form-group"><label>Заголовок меню</label>
              <input type="text" value="${Editor.escapeAttr(p.header || 'Услуги')}" onchange="Editor.updateComponentParam(${index},'header',this.value)">
            </div>
            <div class="form-group service-menu-builder">
              <label>Услуги</label>
              <p class="hint">Добавьте кнопки меню без JSON: действие, цепочка или встроенная панель.</p>
              <div class="service-builder-list">${this.renderServiceMenuBuilder(index, p.services)}</div>
              <button type="button" class="btn btn-secondary" onclick="Editor.addServiceToComponent(${index})">➕ Добавить сервис</button>
            </div>`;
          break;
        default:
          fields = '<p class="hint">Нет редактора для этого типа.</p>';
      }

      return `<div class="component-editor-card" data-comp-index="${index}">
        <div class="component-editor-card-head">
          <strong>${meta.icon} ${Editor.escapeHtml(meta.label)}</strong>
          <label style="margin-left:12px;"><input type="checkbox" ${enabled ? 'checked' : ''} onchange="Editor.setComponentEnabled(${index},this.checked)"> Вкл</label>
          <span style="flex:1"></span>
          <button type="button" class="btn btn-secondary" title="Вверх" onclick="Editor.moveSceneComponent(${index},-1)">↑</button>
          <button type="button" class="btn btn-secondary" title="Вниз" onclick="Editor.moveSceneComponent(${index},1)">↓</button>
          <button type="button" class="btn btn-danger" onclick="Editor.removeSceneComponent(${index})">❌</button>
        </div>
        <div class="component-editor-card-body">${fields}</div>
      </div>`;
    },

    addSceneComponent(type) {
      const scene = this.data.scenes[this.currentScene];
      if (!scene) return;
      const list = ensureComponentsArray(scene);
      const def = SceneComponentRegistry.defaultParams(type) || {};
      list.push({
        component: type,
        id: `${type}_${this.currentScene}_${list.length + 1}`,
        enabled: true,
        params: { ...def }
      });
      this.updateJSONPreview();
      this.renderSceneEditor();
    },

    removeSceneComponent(index) {
      const scene = this.data.scenes[this.currentScene];
      if (!scene?.components) return;
      scene.components.splice(index, 1);
      this.updateJSONPreview();
      this.renderSceneEditor();
    },

    moveSceneComponent(index, dir) {
      const scene = this.data.scenes[this.currentScene];
      const list = scene?.components;
      if (!list) return;
      const j = index + dir;
      if (j < 0 || j >= list.length) return;
      const tmp = list[index];
      list[index] = list[j];
      list[j] = tmp;
      this.updateJSONPreview();
      this.renderSceneEditor();
    },

    setComponentEnabled(index, on) {
      const c = this.data.scenes[this.currentScene]?.components?.[index];
      if (!c) return;
      c.enabled = on;
      this.updateJSONPreview();
    },

    updateComponentParam(index, key, value) {
      const c = this.data.scenes[this.currentScene]?.components?.[index];
      if (!c) return;
      if (!c.params) c.params = {};
      c.params[key] = value;
      this.updateJSONPreview();
    },

    updateComponentCostTable(index, str) {
      const arr = String(str).split(/[,;\s]+/).map((x) => parseInt(x.trim(), 10)).filter((n) => !Number.isNaN(n));
      this.updateComponentParam(index, 'costTable', arr);
    },


    renderDialogueTopicsBuilder(compIndex, topics) {
      const list = Array.isArray(topics) ? topics : [];
      if (!list.length) return '<p class="hint">Тем пока нет</p>';
      return list.map((topic, ti) => {
        const top = typeof topic === 'string' ? { label: topic, reply: '' } : (topic || {});
        return `<div class="dialogue-topic-card">
          <div class="quest-stage-head">
            <strong>Тема ${ti + 1}</strong>
            <button type="button" class="btn-remove" onclick="Editor.removeDialogueTopic(${compIndex},${ti})">×</button>
          </div>
          <div class="form-group"><label>Текст кнопки</label>
            <input type="text" value="${Editor.escapeAttr(top.label || top.text || '')}"
              onchange="Editor.updateDialogueTopicField(${compIndex},${ti},'label',this.value)"></div>
          <div class="form-group"><label>Ответ NPC</label>
            <textarea rows="2" onchange="Editor.updateDialogueTopicField(${compIndex},${ti},'reply',this.value)">${Editor.escapeHtml(top.reply || '')}</textarea></div>
          <div class="form-group"><label>Пожертвование (золото, 0 = нет)</label>
            <input type="number" min="0" value="${top.donate && top.donate.cost != null ? top.donate.cost : 0}"
              onchange="Editor.updateDialogueTopicDonate(${compIndex},${ti},this.value)"></div>
        </div>`;
      }).join('');
    },

    addDialogueTopic(compIndex) {
      const scene = this.data?.scenes?.[this.currentScene];
      const comp = scene?.components?.[compIndex];
      if (!comp) return;
      if (!comp.params) comp.params = {};
      if (!Array.isArray(comp.params.topics)) comp.params.topics = [];
      comp.params.topics.push({ label: 'Новая тема', reply: '' });
      this.updateJSONPreview();
      this.renderSceneEditor();
    },

    removeDialogueTopic(compIndex, topicIndex) {
      const topics = this.data?.scenes?.[this.currentScene]?.components?.[compIndex]?.params?.topics;
      if (!Array.isArray(topics)) return;
      topics.splice(topicIndex, 1);
      this.updateJSONPreview();
      this.renderSceneEditor();
    },

    updateDialogueTopicField(compIndex, topicIndex, field, value) {
      const topics = this.data?.scenes?.[this.currentScene]?.components?.[compIndex]?.params?.topics;
      if (!Array.isArray(topics) || !topics[topicIndex]) return;
      let top = topics[topicIndex];
      if (typeof top === 'string') {
        top = { label: top, reply: '' };
        topics[topicIndex] = top;
      }
      top[field] = value;
      this.updateJSONPreview();
    },

    updateDialogueTopicDonate(compIndex, topicIndex, costRaw) {
      const topics = this.data?.scenes?.[this.currentScene]?.components?.[compIndex]?.params?.topics;
      if (!Array.isArray(topics) || !topics[topicIndex]) return;
      let top = topics[topicIndex];
      if (typeof top === 'string') {
        top = { label: top, reply: '' };
        topics[topicIndex] = top;
      }
      const cost = parseInt(costRaw, 10) || 0;
      if (cost > 0) top.donate = { cost };
      else delete top.donate;
      this.updateJSONPreview();
    },

    renderServiceActionParamsForm(compIndex, svcIndex, svc) {
      const ap = svc.actionParams && typeof svc.actionParams === 'object' ? svc.actionParams : {};
      const amount = ap.amount != null ? ap.amount : '';
      const itemId = ap.itemId || ap.resultId || '';
      const target = ap.target || 'self';
      return `<div class="grid-2">
        <div class="form-group"><label>Цель</label>
          <select onchange="Editor.updateServiceActionParam(${compIndex},${svcIndex},'target',this.value)">
            <option value="self" ${target === 'self' ? 'selected' : ''}>Герой</option>
            <option value="enemy" ${target === 'enemy' ? 'selected' : ''}>Враг</option>
          </select></div>
        <div class="form-group"><label>Величина</label>
          <input type="text" value="${Editor.escapeAttr(String(amount))}" placeholder="full или 10"
            onchange="Editor.updateServiceActionParam(${compIndex},${svcIndex},'amount',this.value)"></div>
      </div>
      <div class="form-group"><label>Предмет (если нужен)</label>
        <input type="text" value="${Editor.escapeAttr(itemId)}"
          onchange="Editor.updateServiceActionParam(${compIndex},${svcIndex},'itemId',this.value)"></div>`;
    },

    renderServicePanelParamsForm(compIndex, svcIndex, svc) {
      const pp = svc.panelParams && typeof svc.panelParams === 'object' ? svc.panelParams : {};
      const npc = pp.npc || '';
      const flatCost = pp.flatCost != null ? pp.flatCost : (pp.costBase != null ? pp.costBase : '');
      const maxEnh = pp.maxEnhancement != null ? pp.maxEnhancement : '';
      const npcOpts = Object.keys(this.data?.npcs || {}).map((id) => {
        const sel = id === npc ? ' selected' : '';
        const name = this.data.npcs[id]?.name || id;
        return `<option value="${Editor.escapeAttr(id)}"${sel}>${Editor.escapeHtml(name)}</option>`;
      }).join('');
      return `<div class="form-group"><label>NPC</label>
        <select onchange="Editor.updateServicePanelParam(${compIndex},${svcIndex},'npc',this.value)">
          <option value="">—</option>${npcOpts}
        </select></div>
        <div class="grid-2">
          <div class="form-group"><label>Базовая цена</label>
            <input type="number" min="0" value="${Editor.escapeAttr(String(flatCost))}"
              onchange="Editor.updateServicePanelParam(${compIndex},${svcIndex},'flatCost',parseInt(this.value,10)||0)"></div>
          <div class="form-group"><label>Макс. заточка</label>
            <input type="number" min="0" value="${Editor.escapeAttr(String(maxEnh))}"
              onchange="Editor.updateServicePanelParam(${compIndex},${svcIndex},'maxEnhancement',parseInt(this.value,10)||0)"></div>
        </div>`;
    },

    updateServiceActionParam(compIndex, svcIndex, key, value) {
      const services = this.ensureComponentServices(compIndex);
      if (!services?.[svcIndex]) return;
      if (!services[svcIndex].actionParams) services[svcIndex].actionParams = {};
      if (value === '' || value == null) delete services[svcIndex].actionParams[key];
      else services[svcIndex].actionParams[key] = value;
      this.updateJSONPreview();
    },

    updateServicePanelParam(compIndex, svcIndex, key, value) {
      const services = this.ensureComponentServices(compIndex);
      if (!services?.[svcIndex]) return;
      if (!services[svcIndex].panelParams) services[svcIndex].panelParams = {};
      if (value === '' || value == null) delete services[svcIndex].panelParams[key];
      else services[svcIndex].panelParams[key] = value;
      if (key === 'flatCost') services[svcIndex].panelParams.costBase = value;
      this.updateJSONPreview();
    },

    updateComponentTopics(index, jsonStr) {
      try {
        const topics = JSON.parse(jsonStr);
        this.updateComponentParam(index, 'topics', topics);
      } catch (e) {
        Editor.toast.error('Ошибка JSON тем: ' + e.message);
      }
    },

    updateComponentRecipes(index, jsonStr) {
      try {
        const recipes = JSON.parse(jsonStr);
        this.updateComponentParam(index, 'recipes', recipes);
      } catch (e) {
        Editor.toast.error('Ошибка JSON рецептов: ' + e.message);
      }
    },

    updateComponentServices(index, jsonStr) {
      try {
        const services = JSON.parse(jsonStr);
        if (!Array.isArray(services)) throw new Error('services должен быть массивом');
        this.updateComponentParam(index, 'services', services);
      } catch (e) {
        Editor.toast.error('Ошибка JSON услуг: ' + e.message);
      }
    },

    ensureComponentServices(compIndex) {
      const c = this.data.scenes[this.currentScene]?.components?.[compIndex];
      if (!c) return null;
      if (!c.params) c.params = {};
      if (!Array.isArray(c.params.services)) c.params.services = [];
      return c.params.services;
    },

    renderServiceMenuBuilder(compIndex, services) {
      const list = Array.isArray(services) ? services : [];
      if (!list.length) {
        return '<p class="hint service-builder-empty">Нет добавленных услуг. Нажмите «Добавить сервис».</p>';
      }
      return list.map((svc, svcIndex) => this.renderServiceMenuCard(compIndex, svc || {}, svcIndex)).join('');
    },

    renderServiceMenuCard(compIndex, svc, svcIndex) {
      const type = svc.type || 'action';
      const costGold = svc.cost?.gold ?? 0;
      const title = svc.label || svc.id || `Услуга #${svcIndex + 1}`;
      let typeFields = '';

      if (type === 'panel') {
        typeFields = `
          <div class="form-group">
            <label>Панель</label>
            <select onchange="Editor.updateServiceField(${compIndex},${svcIndex},'panel',this.value)">
              <option value="">— выберите панель —</option>
              ${panelOptions(svc.panel)}
            </select>
          </div>
          <div class="form-group">
            <label>Параметры панели</label>
            <div class="svc-params-form">${this.renderServicePanelParamsForm(compIndex, svcIndex, svc)}</div>
          </div>`;
      } else if (type === 'chain') {
        const chainListId = Editor.allocSmartIdList(`svc-chain-${compIndex}-${svcIndex}`);
        typeFields = `
          <div class="form-group">
            <label>Цепочка действий (chain)</label>
            ${renderChainIdFieldForEditor(
              svc.chain || '',
              chainListId,
              `Editor.updateServiceField(${compIndex},${svcIndex},'chain',this.value)`
            )}
            <p class="hint">Цепочки настраиваются во вкладке «Действия». Можно ввести id вручную.</p>
          </div>
          <div class="form-group">
            <label>Стоимость (золото), необязательно</label>
            <input type="number" min="0" value="${costGold}"
              onchange="Editor.updateServiceCostGold(${compIndex},${svcIndex},this.value)">
          </div>`;
      } else {
        typeFields = `
          <div class="form-group">
            <label>Действие (action)</label>
            <select onchange="Editor.updateServiceField(${compIndex},${svcIndex},'action',this.value)">
              ${actionOptions(svc.action || svc.actionRef)}
            </select>
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label>Стоимость (золото)</label>
              <input type="number" min="0" value="${costGold}"
                onchange="Editor.updateServiceCostGold(${compIndex},${svcIndex},this.value)">
            </div>
          </div>
          <div class="form-group">
            <label>Параметры действия</label>
            <div class="svc-params-form">${this.renderServiceActionParamsForm(compIndex, svcIndex, svc)}</div>
            <button type="button" class="btn btn-secondary" style="margin-top:6px;"
              onclick="Editor.formatServiceJsonField(${compIndex},${svcIndex},'actionParams')">Отформатировать JSON</button>
          </div>`;
      }

      return `<div class="service-builder-card" data-service-index="${svcIndex}">
        <div class="service-builder-card-head">
          <strong>${Editor.escapeHtml(title)}</strong>
          <button type="button" class="btn btn-danger btn-remove" title="Удалить услугу"
            onclick="Editor.removeServiceFromComponent(${compIndex},${svcIndex})">❌ Удалить</button>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label>ID услуги</label>
            <input type="text" value="${Editor.escapeAttr(svc.id || '')}" placeholder="heal_full"
              onchange="Editor.updateServiceField(${compIndex},${svcIndex},'id',this.value)">
          </div>
          <div class="form-group">
            <label>Тип</label>
            <select onchange="Editor.updateServiceField(${compIndex},${svcIndex},'type',this.value)">
              ${serviceTypeOptions(type)}
            </select>
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label>Текст кнопки</label>
            <input type="text" value="${Editor.escapeAttr(svc.label || '')}" placeholder="Принять лечение"
              onchange="Editor.updateServiceField(${compIndex},${svcIndex},'label',this.value)">
          </div>
          <div class="form-group">
            <label>Иконка</label>
            <input type="text" value="${Editor.escapeAttr(svc.icon || '▸')}"
              onchange="Editor.updateServiceField(${compIndex},${svcIndex},'icon',this.value)">
          </div>
        </div>
        <div class="form-group">
          <label>Описание (необязательно)</label>
          <textarea rows="2" onchange="Editor.updateServiceField(${compIndex},${svcIndex},'description',this.value)">${Editor.escapeHtml(svc.description || svc.desc || '')}</textarea>
        </div>
        ${typeFields}
      </div>`;
    },

    addServiceToComponent(compIndex) {
      const services = this.ensureComponentServices(compIndex);
      if (!services) return;
      const n = services.length + 1;
      services.push({
        id: 'service_' + n,
        type: 'action',
        label: 'Новая услуга',
        icon: '▸',
        description: '',
        action: 'heal',
        cost: { gold: 0 },
        actionParams: { target: 'self' }
      });
      this.updateJSONPreview();
      this.renderSceneEditor();
    },

    async removeServiceFromComponent(compIndex, svcIndex) {
      const services = this.ensureComponentServices(compIndex);
      if (!services || svcIndex < 0 || svcIndex >= services.length) return;
      if (!(await Editor.confirmDialog({ message: 'Удалить эту услугу из меню?', danger: true }))) return;
      services.splice(svcIndex, 1);
      this.updateJSONPreview();
      this.renderSceneEditor();
    },

    updateServiceField(compIndex, svcIndex, field, value) {
      const services = this.ensureComponentServices(compIndex);
      const svc = services?.[svcIndex];
      if (!svc) return;
      if (field === 'type') {
        svc.type = value || 'action';
        if (value === 'panel') {
          svc.panel = svc.panel || 'repair_panel';
          if (!svc.panelParams) svc.panelParams = {};
          delete svc.action;
          delete svc.actionParams;
          delete svc.chain;
        } else if (value === 'chain') {
          svc.chain = svc.chain || '';
          delete svc.panel;
          delete svc.panelParams;
          delete svc.action;
          delete svc.actionParams;
        } else {
          svc.action = svc.action || 'heal';
          if (!svc.actionParams) svc.actionParams = {};
          if (!svc.cost) svc.cost = { gold: 0 };
          delete svc.panel;
          delete svc.panelParams;
          delete svc.chain;
        }
        this.updateJSONPreview();
        this.renderSceneEditor();
        return;
      }
      if (field === 'description') {
        svc.description = value;
        delete svc.desc;
      } else {
        svc[field] = value;
      }
      this.updateJSONPreview();
    },

    updateServiceCostGold(compIndex, svcIndex, raw) {
      const services = this.ensureComponentServices(compIndex);
      const svc = services?.[svcIndex];
      if (!svc) return;
      const gold = Math.max(0, parseInt(raw, 10) || 0);
      if (gold > 0) svc.cost = { gold };
      else delete svc.cost;
      this.updateJSONPreview();
    },

    updateServiceJsonField(compIndex, svcIndex, field, jsonStr) {
      const services = this.ensureComponentServices(compIndex);
      const svc = services?.[svcIndex];
      if (!svc) return;
      const trimmed = (jsonStr || '').trim();
      if (!trimmed) {
        svc[field] = {};
        this.updateJSONPreview();
        return;
      }
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('ожидается JSON-объект { }');
        }
        svc[field] = parsed;
        this.updateJSONPreview();
      } catch (e) {
        Editor.toast.error('Ошибка JSON: ' + e.message);
      }
    },

    formatServiceJsonField(compIndex, svcIndex, field) {
      const services = this.ensureComponentServices(compIndex);
      const svc = services?.[svcIndex];
      if (!svc) return;
      const ta = document.getElementById(
        field === 'panelParams'
          ? `svc-panel-params-${compIndex}-${svcIndex}`
          : `svc-action-params-${compIndex}-${svcIndex}`
      );
      const raw = ta ? ta.value : jsonFieldText(svc[field]);
      try {
        const parsed = raw.trim() ? JSON.parse(raw) : {};
        svc[field] = parsed;
        if (ta) ta.value = JSON.stringify(parsed, null, 2);
        this.updateJSONPreview();
      } catch (e) {
        Editor.toast.error('Нельзя отформатировать: ' + e.message);
      }
    },

    setComponentChainOnEnter(index, chainId) {
      const c = this.data.scenes[this.currentScene]?.components?.[index];
      if (!c) return;
      if (chainId) c.chainOnEnter = chainId;
      else delete c.chainOnEnter;
      this.updateJSONPreview();
    },

    buildMockEngineForPreview() {
      const self = this;
      return {
        state: {
          gold: 120,
          hp: 18,
          maxHp: 25,
          inventory: ['healing_potion', 'rope'],
          flags: {},
          equipped: {}
        },
        data: this.data,
        ENHANCEMENT_SLOTS: ['weapon_main', 'armor', 'shield'],
        escapeHtml: (s) => self.escapeHtml(s),
        escapeAttr: (s) => self.escapeAttr(s),
        getNpcName: (id) => self.data?.npcs?.[id]?.name || id,
        getEquippedItemId: () => null,
        getEffectiveItemData: () => null,
        getItemEnhancementLevel: () => 0,
        getEquippedCursedEntries: () => [],
        getShopBuyPrice: (id, cfg) => {
          const db = self.data?.items?.[id];
          return Math.ceil((db?.price || 10) * (cfg?.sellMultiplier || 1));
        },
        getConditionContext: () => ({ flags: {}, inventory: [], gold: 120 }),
        d20: () => 12,
        log: () => {},
        saveGame: () => {}
      };
    },

    previewSceneComponents() {
      const scene = this.data.scenes[this.currentScene];
      const box = document.getElementById('components-preview-box');
      if (!box || !scene?.components?.length) {
        if (box) {
          box.classList.remove('hidden');
          box.innerHTML = '<p class="hint">Добавьте хотя бы один компонент.</p>';
        }
        return;
      }
      box.classList.remove('hidden');
      box.innerHTML = '<h4>Предпросмотр (кнопки неактивны)</h4><div id="components-preview-inner" class="scene-components-area"></div>';
      const inner = document.getElementById('components-preview-inner');
      const mock = this.buildMockEngineForPreview();
      scene.components.forEach((comp, index) => {
        if (comp.enabled === false) return;
        const renderer = SceneComponentRegistry.get(comp.component);
        if (!renderer) return;
        const wrap = document.createElement('div');
        wrap.className = `scene-component scene-component--${comp.component}`;
        inner.appendChild(wrap);
        renderer.render(mock, wrap, comp, {
          sceneId: this.currentScene,
          index,
          preview: true,
          scene
        });
      });
    }
  });

  function appendSceneComponentsSection() {
    if (Editor._useSceneElements) return;
    const container = document.getElementById('scene-editor');
    const scene = this.currentScene && this.data?.scenes?.[this.currentScene];
    if (!container || !scene) return;
    if (container.querySelector('.scene-components-section')) return;
    if (typeof this.renderSceneComponentsSection !== 'function') return;
    const section = this.renderSceneComponentsSection(scene);
    const anchor = container.querySelector('.hub-return-panel') || container.querySelector('.choices-section');
    const div = document.createElement('div');
    div.innerHTML = section;
    const node = div.firstElementChild;
    if (!node) return;
    node.classList.add('scene-components-section');
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(node, anchor);
    } else {
      container.appendChild(node);
    }
  }
  if (Editor.hooks && typeof Editor.hooks.after === 'function') {
    Editor.hooks.after('renderSceneEditor', function () {
      appendSceneComponentsSection.call(this);
    });
  }
})();
