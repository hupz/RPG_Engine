// ============================================================
// Предметы
// Вынесено из editor.html
// ============================================================
(function () {
  if (typeof Editor === 'undefined') {
    console.error('editor-items-panel.js: Editor не определён');
    return;
  }
  Object.assign(Editor, {
    renderItems() {
      const c = document.getElementById('items-editor');
      if (!this.data?.items) {
        c.innerHTML = '<div class="empty-state"><h2>Нет данных</h2></div>';
        return;
      }
      const ids = Object.keys(this.data.items).sort();
      if (!ids.length) {
        c.innerHTML = `<div class="quest-manager">
          <div class="quest-manager-sidebar"><h4>🎒 Предметы</h4><p class="hint">Создайте первый предмет.</p>
            <button class="btn btn-primary" style="width:100%;" onclick="Editor.createItem()">+ Новый предмет</button></div>
          <div class="quest-manager-detail"><div class="empty-state"><h2>Пусто</h2></div></div></div>`;
        return;
      }
      if (!this.editingItemId || !this.data.items[this.editingItemId]) {
        this.editingItemId = ids[0];
      }
      if (typeof this.renderEditorListLayout === 'function') {
        c.innerHTML = this.renderEditorListLayout({
          title: 'Предметы',
          icon: '🎒',
          ids,
          getLabel: (id) => this.data.items[id]?.name || id,
          activeId: this.editingItemId,
          onSelectMethod: 'Editor.selectItemToEdit',
          onAddMethod: 'Editor.createItem',
          addLabel: 'Новый предмет',
          detailHtml: this.renderItemDetail(this.editingItemId),
          emptyHint: 'Создайте первый предмет.'
        });
        return;
      }
      c.innerHTML = this.renderItemDetail(this.editingItemId);
    },

    selectItemToEdit(id) {
      this.editingItemId = id;
      this.renderItems();
    },

    createItem(){ const id=prompt('ID предмета:'); if(!id||this.data.items[id])return; this.data.items[id]={name:'Новый предмет',type:'misc',desc:''}; this.editingItemId=id; this.renderItems(); this.updateJSONPreview(); },

    deleteItem(id){ if(!confirm('Удалить предмет?'))return; delete this.data.items[id]; const ids=Object.keys(this.data.items); this.editingItemId=ids[0]||null; this.renderItems(); this.updateJSONPreview(); },

    updateItem(idx,val){ this.data.scenes[this.currentScene].items[idx]=val; this.updateJSONPreview(); },

    renderItemDetail(id) {
      const it = this.data?.items?.[id];
      if (!it) return '<div class="empty-state"><h2>Предмет не найден</h2></div>';
      const typeOpts = ['weapon', 'armor', 'shield', 'accessory', 'consumable', 'readable', 'misc', 'equipment', 'key', 'quest']
        .map(t => `<option value="${t}" ${it.type === t ? 'selected' : ''}>${t}</option>`).join('');
      let extra = '';
      if (it.type === 'weapon') {
        extra = `<div class="grid-3">
          <div class="form-group"><label>Урон</label><input value="${it.dmgRoll || it.damage || '1d6'}" onchange="Editor.updateItemData('${id}','dmgRoll',this.value)"></div>
          <div class="form-group"><label>Характеристика</label><input value="${it.stat || 'str'}" onchange="Editor.updateItemData('${id}','stat',this.value)"></div>
        </div>${this.renderItemEnhancementEditor(id, it)}${this.renderItemBonusesEditor(id, it)}`;
      } else if (it.type === 'armor' || it.type === 'shield') {
        extra = `<div class="grid-3">
          <div class="form-group"><label>КД / acBonus</label><input value="${it.ac ?? it.acBonus ?? ''}" onchange="Editor.updateItemData('${id}','ac',parseInt(this.value)||0)"></div>
        </div>${this.renderItemEnhancementEditor(id, it)}${this.renderItemBonusesEditor(id, it)}`;
      } else if (it.type === 'accessory') {
        extra = this.renderItemAccessoryFields(id, it);
      } else if (it.type === 'consumable') {
        extra = this.renderItemConsumableFields(id, it);
      }
      return `<div class="quest-detail-card">
        <div class="quest-detail-head">
          <h3>${this.escapeHtml(it.name || 'Без названия')}</h3>
          <button class="btn btn-danger" onclick="Editor.deleteItem('${id}')">🗑 Удалить</button>
        </div>
        <div class="form-group"><label>ID</label><input value="${this.escapeHtml(id)}" disabled></div>
        <div class="form-group"><label>Название</label><input value="${this.escapeHtml(it.name || '')}" onchange="Editor.updateItemData('${id}','name',this.value)"></div>
        <div class="form-group"><label>Тип</label><select onchange="Editor.updateItemData('${id}','type',this.value)">${typeOpts}</select></div>
        <div class="form-group"><label>Описание</label><textarea onchange="Editor.updateItemData('${id}','desc',this.value)">${this.escapeHtml(it.desc || '')}</textarea></div>
        ${extra}
      </div>`;
    },

    renderItemConsumableFields(id, it) {
      if (!it.use) it.use = { effect: 'heal', formula: '1d4', target: 'self' };
      const u = it.use;
      const target = u.target || 'self';
      const effectOpts = ['heal', 'damage', 'focus_potion', 'rest_material', 'message']
        .map(e => `<option value="${e}" ${u.effect === e ? 'selected' : ''}>${e}</option>`).join('');
      const targetOpts = [
        ['self', 'Себя'],
        ['ally', 'Союзник (пока = себя)'],
        ['single_enemy', 'Один враг (только в бою)'],
        ['all_enemies', 'Все враги (только в бою)']
      ].map(([v, lab]) => `<option value="${v}" ${target === v ? 'selected' : ''}>${lab}</option>`).join('');
      return `<div class="project-info" style="margin-top:8px;">
        <h4>Использование (use)</h4>
        <div class="grid-3">
          <div class="form-group"><label>Эффект</label>
            <select onchange="Editor.updateItemUse('${id}','effect',this.value)">${effectOpts}</select>
          </div>
          <div class="form-group"><label>Цель использования</label>
            <select onchange="Editor.updateItemUse('${id}','target',this.value)">${targetOpts}</select>
          </div>
          <div class="form-group"><label>Формула / amount</label>
            <input value="${u.formula || u.amount || ''}" placeholder="2d4+2" onchange="Editor.updateItemUseFormula('${id}',this.value)">
          </div>
        </div>
        <div class="form-group"><label>Подпись кнопки</label>
          <input value="${u.label || ''}" placeholder="Выпить" onchange="Editor.updateItemUse('${id}','label',this.value)">
        </div>
      </div>`;
    },

    renderItemEnhancementEditor(id, it) {
      const max = it.enhancementMax != null ? it.enhancementMax : 3;
      const costs = Array.isArray(it.enhancementCost) ? it.enhancementCost.join(', ') : '100, 300, 900';
      const enh = it.enhancement != null ? it.enhancement : 0;
      return `<div class="project-info" style="margin-top:8px;padding:10px;">
        <h4 style="margin:0 0 8px;">⚒️ Заточка</h4>
        <div class="grid-3">
          <div class="form-group"><label>Старт. уровень (шаблон)</label>
            <input type="number" min="0" value="${enh}" onchange="Editor.updateItemData('${id}','enhancement',parseInt(this.value)||0)">
          </div>
          <div class="form-group"><label>Макс. (+N)</label>
            <input type="number" min="0" value="${max}" onchange="Editor.updateItemData('${id}','enhancementMax',parseInt(this.value)||0)">
          </div>
          <div class="form-group"><label>Цены +1,+2,+3 (через запятую)</label>
            <input value="${costs}" placeholder="100, 300, 900" onchange="Editor.updateItemEnhancementCosts('${id}',this.value)">
          </div>
        </div>
      </div>`;
    },

    renderItemAccessoryFields(id, it) {
      const slot = it.slot || 'ring';
      return `<div class="grid-3">
        <div class="form-group"><label>Слот аксессуара</label>
          <select onchange="Editor.updateItemData('${id}','slot',this.value)">
            <option value="ring" ${slot==='ring'?'selected':''}>Кольцо</option>
            <option value="necklace" ${slot==='necklace'?'selected':''}>Ожерелье</option>
            <option value="earrings" ${slot==='earrings'?'selected':''}>Серьги</option>
          </select>
        </div>
        <div class="form-group"><label>Иконка</label>
          <input value="${it.icon||''}" onchange="Editor.updateItemData('${id}','icon',this.value)">
        </div>
      </div>${this.renderItemBonusesEditor(id, it)}`;
    }
  });
})();
