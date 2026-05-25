// Редактор: проклятые предметы (вкладка «Предметы»)

(function attachEditorItemsCurse() {
  if (typeof Editor === 'undefined') {
    console.error('editor-items-curse.js: Editor не определён');
    return;
  }

  Editor.CURSE_EFFECT_OPTIONS = [
    { id: 'silence', label: 'Безмолвие (silence)' },
    { id: 'weakness', label: 'Слабость (weakness)' },
    { id: 'poison_touch', label: 'Ядовитое касание (poison_touch)' },
    { id: 'bloodlust', label: 'Кровожадность (bloodlust)' },
    { id: 'haunted', label: 'Преследование (haunted)' }
  ];

  if (Editor.editingItemId == null) Editor.editingItemId = null;

  Editor.ensureItemCurseDefaults = function (it) {
    if (!it) return;
    if (it.cursed !== true) {
      it.cursed = false;
      return;
    }
    if (!Array.isArray(it.curseEffects)) it.curseEffects = [];
    if (it.curseRemoveCost == null || it.curseRemoveCost === '') it.curseRemoveCost = 50;
    if (!it.curseRemoveScene) it.curseRemoveScene = 'temple_priest';
  };

  Editor.getAllSceneIds = function () {
    return Object.keys(this.data?.scenes || {}).sort();
  };

  Editor.getCurseEffectLabel = function (id) {
    const opt = this.CURSE_EFFECT_OPTIONS.find(o => o.id === id);
    return opt ? opt.label.split(' (')[0] : id;
  };

  Editor.validateItemCurse = function (itemId) {
    const it = this.data?.items?.[itemId];
    if (!it || it.cursed !== true) return { ok: true };
    const errors = [];
    if (!Array.isArray(it.curseEffects) || !it.curseEffects.length) {
      errors.push('effects');
    }
    if (!it.curseRemoveScene) {
      errors.push('scene');
    }
    return { ok: errors.length === 0, errors };
  };

  Editor.renderItemCurseSection = function (itemId, it) {
    this.ensureItemCurseDefaults(it);
    const cursed = it.cursed === true;
    const effects = Array.isArray(it.curseEffects) ? it.curseEffects : [];
    const val = this.validateItemCurse(itemId);
    const effectsErr = cursed && val.errors?.includes('effects');
    const sceneErr = cursed && val.errors?.includes('scene');

    const effectOpts = this.CURSE_EFFECT_OPTIONS
      .filter(o => !effects.includes(o.id))
      .map(o => `<option value="${this.escapeAttr(o.id)}">${this.escapeHtml(o.label)}</option>`)
      .join('');

    const pills = effects.map(eff => {
      const label = this.getCurseEffectLabel(eff);
      return `<span class="curse-effect-pill" data-effect="${this.escapeAttr(eff)}">
        <span>${this.escapeHtml(label)}</span>
        <button type="button" class="curse-pill-remove" title="Удалить"
          onclick="Editor.removeItemCurseEffect('${this.escapeAttr(itemId)}','${this.escapeAttr(eff)}')">❌</button>
      </span>`;
    }).join('') || '<span class="hint curse-effects-empty">Нет эффектов</span>';

    const sceneIds = this.getAllSceneIds();
    const sceneOpts = sceneIds.map(sid => {
      const sc = this.data.scenes[sid];
      const label = sc?.location || sc?.name || sid;
      return `<option value="${this.escapeAttr(sid)}" ${it.curseRemoveScene === sid ? 'selected' : ''}>${this.escapeHtml(label)} (${this.escapeHtml(sid)})</option>`;
    }).join('');

    return `
      <div class="item-curse-block">
        <h5 class="item-curse-title">☠️ Проклятие</h5>
        <div class="form-group">
          <label><input type="checkbox" ${cursed ? 'checked' : ''}
            onchange="Editor.setItemCursed('${this.escapeAttr(itemId)}', this.checked)"> Проклятый предмет</label>
        </div>
        <div class="item-curse-fields${cursed ? ' item-curse-fields--open' : ''}" id="curse-fields-${this.escapeAttr(itemId)}">
          <div class="form-group curse-effects-group${effectsErr ? ' field-error' : ''}">
            <label>Эффекты проклятия</label>
            <div class="curse-effects-toolbar">
              <select id="curse-effect-pick-${this.escapeAttr(itemId)}">${effectOpts || '<option value="">— все добавлены —</option>'}</select>
              <button type="button" class="btn btn-secondary" onclick="Editor.addItemCurseEffect('${this.escapeAttr(itemId)}')">Добавить эффект</button>
            </div>
            <div class="curse-effects-pills">${pills}</div>
            ${effectsErr ? '<div class="field-error-msg">Добавьте хотя бы один эффект проклятия</div>' : ''}
          </div>
          <div class="form-group">
            <label>Стоимость снятия (зм)</label>
            <input type="number" min="0" placeholder="50" value="${it.curseRemoveCost ?? ''}"
              onchange="Editor.updateItemCurseField('${this.escapeAttr(itemId)}','curseRemoveCost',parseInt(this.value,10)||0)">
            <div class="hint">Сколько золота требует священник</div>
          </div>
          <div class="form-group${sceneErr ? ' field-error' : ''}">
            <label>Сцена снятия</label>
            <select onchange="Editor.updateItemCurseField('${this.escapeAttr(itemId)}','curseRemoveScene',this.value||null)">
              <option value="" ${!it.curseRemoveScene ? 'selected' : ''}>Не выбрано</option>
              ${sceneOpts}
            </select>
            <div class="hint">Где можно снять проклятие</div>
            ${sceneErr ? '<div class="field-error-msg">Выберите сцену снятия проклятия</div>' : ''}
          </div>
        </div>
      </div>`;
  };

  Editor.setItemCursed = function (itemId, checked) {
    const it = this.data?.items?.[itemId];
    if (!it) return;
    it.cursed = !!checked;
    if (it.cursed) {
      this.ensureItemCurseDefaults(it);
      if (!it.curseEffects?.length) it.curseEffects = ['silence'];
    } else {
      delete it.curseEffects;
      delete it.curseRemoveCost;
      delete it.curseRemoveScene;
    }
    this.renderItems();
    this.updateJSONPreview();
  };

  Editor.updateItemCurseField = function (itemId, field, value) {
    const it = this.data?.items?.[itemId];
    if (!it) return;
    it[field] = value;
    this.renderItems();
    this.updateJSONPreview();
  };

  Editor.addItemCurseEffect = function (itemId) {
    const it = this.data?.items?.[itemId];
    if (!it || it.cursed !== true) return;
    const sel = document.getElementById(`curse-effect-pick-${itemId}`);
    const eff = sel?.value;
    if (!eff) return;
    if (!Array.isArray(it.curseEffects)) it.curseEffects = [];
    if (!it.curseEffects.includes(eff)) it.curseEffects.push(eff);
    this.renderItems();
    this.updateJSONPreview();
  };

  Editor.removeItemCurseEffect = function (itemId, effectId) {
    const it = this.data?.items?.[itemId];
    if (!it || !Array.isArray(it.curseEffects)) return;
    it.curseEffects = it.curseEffects.filter(e => e !== effectId);
    this.renderItems();
    this.updateJSONPreview();
  };

  Editor.selectItemToEdit = function (itemId) {
    this.editingItemId = itemId;
    this.renderItems();
  };

  const _renderItemTypeExtra = function (id, it) {
    if (it.type === 'weapon') {
      return `<div class="grid-3">
          <div class="form-group"><label>Урон</label><input value="${it.dmgRoll || it.damage || '1d6'}" onchange="Editor.updateItemData('${id}','dmgRoll',this.value)"></div>
          <div class="form-group"><label>Характеристика</label><input value="${it.stat || 'str'}" onchange="Editor.updateItemData('${id}','stat',this.value)"></div>
        </div>${Editor.renderItemEnhancementEditor(id, it)}${Editor.renderItemBonusesEditor(id, it)}`;
    }
    if (it.type === 'armor' || it.type === 'shield') {
      return `<div class="grid-3">
          <div class="form-group"><label>КД / acBonus</label><input value="${it.ac ?? it.acBonus ?? ''}" onchange="Editor.updateItemData('${id}','ac',parseInt(this.value)||0)"></div>
        </div>${Editor.renderItemEnhancementEditor(id, it)}${Editor.renderItemBonusesEditor(id, it)}`;
    }
    if (it.type === 'accessory') return Editor.renderItemAccessoryFields(id, it);
    if (it.type === 'consumable') return Editor.renderItemConsumableFields(id, it);
    return '';
  };

  Editor.renderItemDetail = function (itemId) {
    const it = this.data.items[itemId];
    if (!it) return '';
    this.ensureItemCurseDefaults(it);
    const typeOpts = ['weapon', 'armor', 'shield', 'accessory', 'consumable', 'readable', 'misc', 'equipment', 'key', 'quest']
      .map(t => `<option value="${t}" ${it.type === t ? 'selected' : ''}>${t}</option>`).join('');
    const extra = _renderItemTypeExtra(itemId, it);
    return `<div class="quest-editor item-detail-editor">
        <h4>${this.escapeHtml(it.name || 'Без названия')} (${this.escapeHtml(itemId)})</h4>
        <div class="form-group"><label>Название</label><input value="${this.escapeHtml(it.name || '')}" onchange="Editor.updateItemData('${itemId}','name',this.value)"></div>
        <div class="form-group"><label>Тип</label><select onchange="Editor.updateItemData('${itemId}','type',this.value)">${typeOpts}</select></div>
        <div class="form-group"><label>Описание</label><textarea onchange="Editor.updateItemData('${itemId}','desc',this.value)">${this.escapeHtml(it.desc || '')}</textarea></div>
        ${extra}
        ${this.renderItemCurseSection(itemId, it)}
        <button class="btn btn-danger" onclick="Editor.deleteItem('${itemId}')">🗑 Удалить</button>
      </div>`;
  };

  Editor.renderItems = function () {
    const c = document.getElementById('items-editor');
    if (!this.data?.items) {
      c.innerHTML = '<div class="empty-state"><h2>Нет данных</h2></div>';
      return;
    }
    const ids = Object.keys(this.data.items);
    if (!ids.length) {
      c.innerHTML = '<div class="empty-state"><h2>Нет предметов</h2><button class="btn btn-primary" onclick="Editor.createItem()">+ Новый предмет</button></div>';
      return;
    }
    if (!this.editingItemId || !this.data.items[this.editingItemId]) {
      this.editingItemId = ids[0];
    }

    const sidebar = ids.map(id => {
      const it = this.data.items[id];
      this.ensureItemCurseDefaults(it);
      const active = id === this.editingItemId ? 'active' : '';
      const curseIcon = it.cursed === true
        ? `<span class="item-pick-curse" title="Проклят: ${this.escapeAttr(this.formatItemCurseTooltip(it))}">☠️</span>`
        : '';
      const effectsTip = it.cursed === true ? this.formatItemCurseTooltip(it) : '';
      return `<button type="button" class="class-pick item-pick ${active}" onclick="Editor.selectItemToEdit('${this.escapeAttr(id)}')"
        title="${it.cursed ? 'Проклят: ' + this.escapeAttr(effectsTip) : ''}">
        ${curseIcon} ${this.escapeHtml(it.name || id)}
      </button>`;
    }).join('');

    const detail = this.renderItemDetail(this.editingItemId);

    c.innerHTML = `<div class="class-editor-wrap">
      <div class="class-editor-sidebar item-editor-sidebar">${sidebar}
        <button type="button" class="btn btn-primary" style="width:100%;margin-top:10px;" onclick="Editor.createItem()">+ Новый предмет</button>
      </div>
      <div class="class-editor-detail">${detail}</div>
    </div>`;
  };

  Editor.formatItemCurseTooltip = function (it) {
    if (!it?.curseEffects?.length) return 'нет эффектов';
    return it.curseEffects.map(e => this.getCurseEffectLabel(e)).join(', ');
  };

  const _origUpdateItemData = Editor.updateItemData;
  Editor.updateItemData = function (id, f, val) {
    _origUpdateItemData.call(this, id, f, val);
    if (f === 'name' && this.data?.items?.[id]?.cursed) {
      this.renderItems();
    }
  };

  const _origCreateItem = Editor.createItem;
  Editor.createItem = function () {
    const id = prompt('ID предмета:');
    if (!id || this.data.items[id]) return;
    this.data.items[id] = { name: 'Новый предмет', type: 'misc', desc: '', cursed: false };
    this.editingItemId = id;
    this.renderItems();
    this.updateJSONPreview();
  };

  const _origDeleteItem = Editor.deleteItem;
  Editor.deleteItem = function (id) {
    _origDeleteItem.call(this, id);
    const ids = Object.keys(this.data.items || {});
    this.editingItemId = ids[0] || null;
  };
})();
