// ============================================================
// Классы — шаблоны; умения назначаются из общего пула (вкладка Умения)
// ============================================================
(function attachEditorClasses() {
  if (typeof Editor === 'undefined') {
    console.error('editor-classes.js: Editor не определён');
    return;
  }

  Object.assign(Editor, {

    selectClassToEdit(id) {
      this.editingClassId = id;
      this.renderClasses();
    },

    ensureAbilityPool() {
      if (!this.data) return null;
      if (!this.data.progression || typeof this.data.progression !== 'object') {
        this.data.progression = {
          enabled: true,
          maxLevel: 5,
          expTable: [0, 100, 220, 380, 600],
          defaults: {},
          abilities: {}
        };
      }
      if (!this.data.progression.abilities || typeof this.data.progression.abilities !== 'object') {
        this.data.progression.abilities = {};
      }
      return this.data.progression.abilities;
    },

    /** Разрешить определение умения по id (пул → legacy object). */
    resolveAbilityDef(abilityId) {
      if (!abilityId) return null;
      const pool = this.ensureAbilityPool();
      if (pool?.[abilityId]) return pool[abilityId];
      for (const cls of Object.values(this.data?.classes || {})) {
        const found = (cls.abilities || []).find(
          (a) => a && typeof a === 'object' && a.id === abilityId
        );
        if (found) return found;
      }
      return null;
    },

    /** Список id умений класса (нормализует строки / объекты). */
    getClassAbilityIds(classId) {
      const cls = this.data?.classes?.[classId];
      if (!cls || !Array.isArray(cls.abilities)) return [];
      return cls.abilities
        .map((ab) => (typeof ab === 'string' ? ab : ab?.id))
        .filter(Boolean);
    },

    /**
     * Положить полное умение в пул и вернуть id.
     * Не перезаписывает существующую запись пула.
     */
    upsertAbilityToPool(ability) {
      const pool = this.ensureAbilityPool();
      if (!pool || !ability) return null;
      let id = String(ability.id || '').trim();
      if (!id) {
        const base = typeof this.slugifyId === 'function'
          ? this.slugifyId(ability.name || 'ability', 'ability', pool)
          : ('ability_' + Date.now().toString(36));
        id = base;
      }
      if (!pool[id]) {
        const copy = JSON.parse(JSON.stringify(ability));
        copy.id = id;
        if (typeof ProjectDataSchema !== 'undefined' && copy.effect != null) {
          if (typeof copy.effect === 'string' || (copy.effect && !copy.effect.type)) {
            copy.effect = ProjectDataSchema.normalizeAbilityEffect(copy.effect);
          }
        }
        pool[id] = copy;
      }
      return id;
    },

    /** Заменить встроенные объекты класса ссылками (локально, без полной миграции). */
    normalizeClassAbilityRefs(classId) {
      const cls = this.data?.classes?.[classId];
      if (!cls || !Array.isArray(cls.abilities)) return;
      const ids = [];
      const seen = new Set();
      cls.abilities.forEach((ab, i) => {
        let id = null;
        if (typeof ab === 'string') id = ab;
        else if (ab && typeof ab === 'object') {
          id = this.upsertAbilityToPool(Object.assign({}, ab, {
            id: ab.id || (classId + '_ability_' + (i + 1))
          }));
        }
        if (id && !seen.has(id)) {
          seen.add(id);
          ids.push(id);
        }
      });
      cls.abilities = ids;
    },

    renderClasses() {
      const container = document.getElementById('classes-list');
      if (!this.data?.classes) {
        container.innerHTML = '<div class="empty-state"><h2>Нет данных</h2></div>';
        return;
      }
      const ids = Object.keys(this.data.classes);
      if (!ids.length) {
        container.innerHTML = '<div class="empty-state"><h2>Нет классов</h2><button class="btn btn-primary" onclick="Editor.createClass()">+ Создать класс</button></div>';
        return;
      }
      if (!this.editingClassId || !this.data.classes[this.editingClassId]) this.editingClassId = ids[0];
      const sidebar = ids.map((id) => {
        const cls = this.data.classes[id];
        const active = id === this.editingClassId ? 'active' : '';
        return `<button type="button" class="class-pick ${active}" onclick="${this.escapeAttr('Editor.selectClassToEdit(' + JSON.stringify(id) + ')')}">${this.renderIcon(cls.icon) || '⚔️'} ${this.escapeHtml(cls.name || id)}</button>`;
      }).join('');
      container.innerHTML = `<div class="class-editor-wrap"><div class="class-editor-sidebar">${sidebar}<button type="button" class="btn btn-primary" style="width:100%;margin-top:10px;" onclick="Editor.createClass()">+ Новый класс</button></div><div class="class-editor-detail">${this.renderClassDetail(this.editingClassId)}</div></div>`;
    },

    async createClass() {
      if (!this.data) { Editor.toast.warning('Сначала загрузите проект'); return; }
      if (!this.data.classes) this.data.classes = {};
      let id, name;
      if (typeof this.promptNameAndId === 'function') {
        const r = await this.promptNameAndId({
          namePrompt: 'Название класса:',
          defaultName: 'Новый класс',
          existing: this.data.classes,
          allowEditId: false
        });
        if (!r) return;
        id = r.id; name = r.name;
      } else {
        name = await Editor.promptDialog({ message: 'Название класса:', defaultValue: 'Новый класс' });
        if (!name) return;
        id = typeof this.slugifyId === 'function'
          ? this.slugifyId(name, '', this.data.classes)
          : ('class_' + Date.now().toString(36));
      }
      if (this.data.classes[id]) {
        id = id + '_' + Date.now().toString(36).slice(-3);
      }
      const strikeId = this.upsertAbilityToPool({
        id: id + '_strike',
        name: 'Удар',
        cost: 1,
        icon: '⚔️',
        desc: 'Базовая атака.',
        combatOnly: true,
        oncePerCombat: false,
        effect: { type: 'damage', value: '1d8', damageType: 'physical' }
      });
      this.data.classes[id] = {
        name: name || 'Новый класс',
        icon: '⚔️',
        hp: 20, ac: 14, atkBonus: 3, dmgRoll: '1d8', dmgBonus: 2, initBonus: 2,
        stats: { str: 12, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
        skills: 'Атлетика, Восприятие',
        resource: { name: 'Энергия', max: 2, desc: 'Ресурс для способностей.' },
        mainWeapon: null, startingItems: [],
        abilities: strikeId ? [strikeId] : []
      };
      this.editingClassId = id;
      try { this.updateJSONPreview?.(); } catch (e) {}
      this.renderClasses();
    },

    renderClassAbilityAssignment(classId, abilityId, index) {
      const ab = this.resolveAbilityDef(abilityId) || { id: abilityId, name: abilityId, icon: '✨' };
      const name = ab.name || abilityId;
      const icon = ab.icon || '✨';
      const desc = ab.desc || '';
      const cost = ab.cost != null ? ab.cost : '—';
      return `<div class="ability-assign-card" style="border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:8px 0;display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
        <div style="min-width:0;flex:1;">
          <div style="font-weight:600;">${this.renderIcon(icon)} ${this.escapeHtml(name)} <span class="hint">(${this.escapeHtml(abilityId)})</span></div>
          <div class="hint" style="margin-top:4px;">${this.escapeHtml(desc)}</div>
          <div class="hint" style="margin-top:4px;">Стоимость: ${this.escapeHtml(String(cost))}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;">
          <button type="button" class="btn btn-secondary" onclick="${this.escapeAttr('Editor.openAbilityInAbilitiesTab(' + JSON.stringify(abilityId) + ')')}">Открыть в Умениях</button>
          <button type="button" class="btn btn-danger" onclick="${this.escapeAttr('Editor.removeAbilityFromClass(' + JSON.stringify(classId) + ', ' + index + ')')}">Убрать из класса</button>
        </div>
      </div>`;
    },

    renderClassDetail(id) {
      const cls = this.data.classes[id];
      if (!cls) return '';
      if (!cls.stats) cls.stats = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
      if (!cls.resource) cls.resource = { name: 'Ресурс', max: 2, desc: '' };
      if (!cls.abilities) cls.abilities = [];
      if (!cls.startingItems) cls.startingItems = [];
      this.normalizeClassAbilityRefs(id);

      const weapons = this.getWeaponItems();
      const weaponOptions = weapons.map(([wid, w]) =>
        `<option value="${wid}" ${cls.mainWeapon === wid ? 'selected' : ''}>${this.escapeHtml(w.name)} (${wid})</option>`
      ).join('');
      const itemCheckboxes = this.getAllItemIds().map((itemId) => {
        const item = this.data.items[itemId];
        const checked = cls.startingItems.includes(itemId) ? 'checked' : '';
        return `<label style="display:block;font-size:13px;margin:4px 0;"><input type="checkbox" ${checked} onchange="Editor.toggleStartingItem('${id}','${itemId}',this.checked)"> ${this.escapeHtml(item.name)} (${itemId})</label>`;
      }).join('') || '<p class="hint">Создайте предметы во вкладке «Предметы»</p>';

      const assigned = new Set(this.getClassAbilityIds(id));
      const pool = this.ensureAbilityPool() || {};
      const globalAbilityOptions = Object.entries(pool)
        .filter(([aid]) => !assigned.has(aid))
        .map(([aid, ab]) =>
          `<option value="${this.escapeAttr(aid)}">${this.escapeHtml(ab.icon || '✨')} ${this.escapeHtml(ab.name || aid)}</option>`
        ).join('');
      const abilityIds = this.getClassAbilityIds(id);
      const abilitiesHtml = abilityIds.length
        ? abilityIds.map((aid, idx) => this.renderClassAbilityAssignment(id, aid, idx)).join('')
        : '<p class="hint">Пока нет умений. Добавьте из пула или создайте новое (оно появится во вкладке «Умения»).</p>';

      return `<div class="class-section"><div style="display:flex;justify-content:space-between;"><h4>Основное — ${this.escapeHtml(cls.name)}</h4><button class="btn btn-danger" onclick="${this.escapeAttr('Editor.deleteClass(' + JSON.stringify(id) + ')')}">🗑 Удалить</button></div><div class="grid-2"><div class="form-group"><label>ID класса</label><input value="${id}" disabled></div><div class="form-group" style="grid-column:1/-1"><label>Иконка</label><div class="icon-picker-row">${this.renderIconEmojiSelect('if(this.value){Editor.updateClass(' + JSON.stringify(id) + ',"icon",this.value);}')}<input type="text" value="${this.escapeHtml(cls.icon || '⚔️')}" onchange="Editor.updateClass('${id}','icon',this.value)">${this.renderIconPreview(cls.icon)}</div><div class="icon-suggestions">${this.renderIconSuggestionButtons((icon) => 'Editor.updateClass(' + JSON.stringify(id) + ',"icon",' + JSON.stringify(icon) + ')')}</div><div class="icon-hint">Выберите emoji из списка или вставьте свой / путь к PNG/SVG (например <code>icons/class.png</code>).</div></div></div><div class="form-group"><label>Название</label><input value="${this.escapeHtml(cls.name || '')}" onchange="Editor.updateClass('${id}','name',this.value)"></div></div>
<div class="class-section"><h4>❤️ Здоровье и защита</h4><div class="grid-3"><div class="form-group"><label>ОЗ</label><input type="number" value="${cls.hp ?? 20}" onchange="Editor.updateClass('${id}','hp',parseInt(this.value)||1)"></div><div class="form-group"><label>КД</label><input type="number" value="${cls.ac ?? 10}" onchange="Editor.updateClass('${id}','ac',parseInt(this.value)||10)"></div><div class="form-group"><label>Инициатива</label><input type="number" value="${cls.initBonus ?? 0}" onchange="Editor.updateClass('${id}','initBonus',parseInt(this.value)||0)"></div></div></div>
<div class="class-section"><h4>⚡ Ресурс класса</h4><div class="grid-3"><div class="form-group"><label>Название</label><input value="${this.escapeHtml(cls.resource.name)}" onchange="Editor.updateClassResource('${id}','name',this.value)"></div><div class="form-group"><label>Максимум</label><input type="number" value="${cls.resource.max ?? 2}" onchange="Editor.updateClassResource('${id}','max',parseInt(this.value)||0)"></div><div class="form-group"><label>Описание</label><input value="${this.escapeHtml(cls.resource.desc || '')}" onchange="Editor.updateClassResource('${id}','desc',this.value)"></div></div></div>
<div class="class-section"><h4>📊 Характеристики</h4><div class="grid-6">${['str', 'dex', 'con', 'int', 'wis', 'cha'].map((stat) => `<div class="form-group"><label>${stat.toUpperCase()}</label><input type="number" min="1" max="30" value="${cls.stats[stat] ?? 10}" onchange="Editor.updateClassStat('${id}','${stat}',parseInt(this.value)||10)"></div>`).join('')}</div><div class="form-group"><label>Владение навыками</label><input value="${this.escapeHtml(cls.skills || '')}" onchange="Editor.updateClass('${id}','skills',this.value)"></div></div>
<div class="class-section"><h4>⚔️ Оружие и бой</h4><div class="form-group"><label>Стартовое оружие</label><select onchange="Editor.setClassWeapon('${id}',this.value)"><option value="">— не выбрано —</option>${weaponOptions}</select></div><div class="grid-3"><div class="form-group"><label>Бонус атаки</label><input type="number" value="${cls.atkBonus ?? 0}" onchange="Editor.updateClass('${id}','atkBonus',parseInt(this.value)||0)"></div><div class="form-group"><label>Кубики урона</label><input value="${this.escapeHtml(cls.dmgRoll || '1d6')}" onchange="Editor.updateClass('${id}','dmgRoll',this.value)"></div><div class="form-group"><label>Бонус урона</label><input type="number" value="${cls.dmgBonus ?? 0}" onchange="Editor.updateClass('${id}','dmgBonus',parseInt(this.value)||0)"></div></div><div class="form-group"><label>Звук атаки</label>${this.renderSoundSelect(cls.attackSound || '', `Editor.updateClass('${id}','attackSound',this.value)`)}<div class="hint">Пусто = звук оружия из предмета</div></div></div>
<div class="class-section"><h4>🎒 Стартовый инвентарь</h4><div style="max-height:160px;overflow-y:auto;border:1px solid var(--border);padding:8px;border-radius:6px;">${itemCheckboxes}</div></div>
<div class="class-section"><h4>✨ Стартовые умения</h4>
  <p class="hint">Умения создаются и редактируются во вкладке «Умения». Здесь только назначение классам (одно умение можно дать нескольким классам).</p>
  <div class="form-group"><label>Добавить из пула</label>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <select style="flex:1;min-width:180px;" onchange="if(this.value){Editor.addGlobalAbilityToClass('${id}',this.value); this.value='';}">
        <option value="">— Выбрать умение —</option>${globalAbilityOptions}
      </select>
      <button class="btn btn-primary" type="button" onclick="${this.escapeAttr('Editor.addAbility(' + JSON.stringify(id) + ')')}">+ Новое умение</button>
      <button class="btn btn-secondary" type="button" onclick="Editor.switchTab('abilities')">Открыть вкладку Умения</button>
    </div>
  </div>
  ${abilitiesHtml}
</div>`;
    },

    /** @deprecated Полный редактор перенесён во вкладку Умения */
    renderAbilityEditor() {
      return '';
    },

    addAbility(classId) {
      const cls = this.data?.classes?.[classId];
      if (!cls) return;
      this.normalizeClassAbilityRefs(classId);
      const pool = this.ensureAbilityPool();
      const n = Object.keys(pool).length + 1;
      const abId = this.upsertAbilityToPool({
        id: classId + '_skill_' + n,
        name: 'Новая способность',
        cost: 1,
        icon: '✨',
        desc: 'Описание...',
        combatOnly: true,
        oncePerCombat: false,
        usage: 'combat',
        type: 'active',
        effect: { type: 'damage', value: '1d6', damageType: 'physical' }
      });
      if (!abId) return;
      if (!cls.abilities.includes(abId)) cls.abilities.push(abId);
      this.editingGlobalAbilityId = abId;
      this.renderClasses();
      this.updateJSONPreview();
      if (typeof this.switchTab === 'function') {
        // оставляем на классе: автор сразу видит назначение; правки — в Умениях
      }
    },

    addGlobalAbilityToClass(classId, abilityId) {
      const cls = this.data?.classes?.[classId];
      if (!cls || !abilityId) return;
      this.normalizeClassAbilityRefs(classId);
      if (!this.resolveAbilityDef(abilityId)) {
        Editor.toast.warning('Умение не найдено в пуле');
        return;
      }
      if (cls.abilities.includes(abilityId)) return;
      cls.abilities.push(abilityId);
      this.renderClasses();
      this.updateJSONPreview();
    },

    removeAbilityFromClass(classId, index) {
      const cls = this.data?.classes?.[classId];
      if (!cls || !Array.isArray(cls.abilities)) return;
      this.normalizeClassAbilityRefs(classId);
      if (index < 0 || index >= cls.abilities.length) return;
      cls.abilities.splice(index, 1);
      this.renderClasses();
      this.updateJSONPreview();
    },

    /** Убрать из класса (без удаления из пула). Старое имя API. */
    deleteAbility(classId, idx) {
      this.removeAbilityFromClass(classId, idx);
    },

    openAbilityInAbilitiesTab(abilityId) {
      if (!abilityId) return;
      this.editingGlobalAbilityId = abilityId;
      if (typeof this.switchTab === 'function') this.switchTab('abilities');
      else if (typeof this.renderAbilities === 'function') this.renderAbilities();
    },

    async deleteClass(id) {
      if (!(await Editor.confirmDialog({ message: 'Удалить класс?', danger: true }))) return;
      delete this.data.classes[id];
      this.editingClassId = Object.keys(this.data.classes)[0] || null;
      this.renderClasses();
      this.updateJSONPreview();
    },

    // Legacy no-ops: правки умения только в пуле (вкладка Умения)
    updateAbility() {},
    updateAbilityEffectValue() {},
    updateAbilityEffectType() {},
    updateAbilityEffectDamageType() {},
    updateAbilityTargeting() {},
    updateAbilitySave() {},
    setAbilityIcon() {}
  });

  if (Editor.hooks && typeof Editor.hooks.register === 'function') {
    Editor.hooks.register('editor-classes', {
      renderClasses: Editor.renderClasses,
      renderClassDetail: Editor.renderClassDetail,
      selectClassToEdit: Editor.selectClassToEdit,
      createClass: Editor.createClass,
      deleteClass: Editor.deleteClass,
      addAbility: Editor.addAbility,
      addGlobalAbilityToClass: Editor.addGlobalAbilityToClass,
      removeAbilityFromClass: Editor.removeAbilityFromClass,
      deleteAbility: Editor.deleteAbility
    }, { force: true });
  } else if (typeof Editor.hooks?.rebind === 'function') {
    Editor.hooks.rebind('renderClasses');
    Editor.hooks.rebind('renderClassDetail');
    Editor.hooks.rebind('createClass');
  }
})();
