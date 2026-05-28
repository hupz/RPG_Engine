// ============================================
// Редактор зверей (data.beasts) — Дикий облик
// ============================================

(function attachEditorBeasts() {
  if (typeof Editor === 'undefined') {
    console.error('editor-beasts.js: Editor не определён');
    return;
  }

  const CR_SELECT = [
    { v: '0', n: '0' },
    { v: '0.125', n: '1/8' },
    { v: '0.25', n: '1/4' },
    { v: '0.5', n: '1/2' },
    { v: '1', n: '1' },
    { v: '2', n: '2' },
    { v: '3', n: '3' }
  ];

  const ICON_OPTIONS = ['🐺', '🐻', '🐆', '🐗', '🦅', '🐍', '🦇', '🐀', '🦌', '🐴', '🐾'];

  Object.assign(Editor, {
    editingBeastId: null,
    editingBeastMode: 'list',

    ensureBeasts() {
      if (!this.data) return;
      if (typeof BeastSystem !== 'undefined') {
        BeastSystem.ensureBeasts(this.data);
      } else if (!this.data.beasts) {
        this.data.beasts = {};
      }
    },

    getBeastIds() {
      this.ensureBeasts();
      return Object.keys(this.data.beasts || {}).sort();
    },

    openBeastsTab() {
      this.currentTab = 'beasts';
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach((t) => t.classList.remove('active'));
      const tabBtn = [...document.querySelectorAll('.tab')].find((t) => (t.textContent || '').includes('Звери'));
      if (tabBtn) tabBtn.classList.add('active');
      document.getElementById('tab-beasts')?.classList.add('active');
      this.renderBeasts();
    },

    renderBeasts() {
      const c = document.getElementById('beasts-editor');
      if (!c) return;
      if (!this.data) {
        c.innerHTML = '<div class="empty-state"><h2>Загрузите данные</h2></div>';
        return;
      }
      this.ensureBeasts();
      if (this.editingBeastMode === 'edit' && this.editingBeastId) {
        c.innerHTML = this.renderBeastEditForm(this.editingBeastId);
        return;
      }
      const ids = this.getBeastIds();
      const cards = ids.map((id) => {
        const b = this.data.beasts[id];
        const cr = typeof BeastSystem !== 'undefined' ? BeastSystem.formatCr(b.cr) : b.cr;
        return `<div class="beast-card">
          <div class="beast-card-head">${this.escapeHtml(b.icon || '🐾')} <strong>${this.escapeHtml(b.name || id)}</strong></div>
          <div class="hint">CR: ${this.escapeHtml(String(cr))} | ОЗ: ${b.hp ?? '—'} | Атака: +${b.atkBonus ?? 0}</div>
          <div class="beast-card-actions">
            <button type="button" class="btn btn-secondary" onclick="Editor.editBeast(${JSON.stringify(id)})">Редактировать</button>
            <button type="button" class="btn btn-danger" onclick="Editor.deleteBeast(${JSON.stringify(id)})">Удалить</button>
          </div>
        </div>`;
      }).join('');

      c.innerHTML = `<div class="beast-manager">
        <div class="beast-manager-head">
          <h3>🐾 Звери</h3>
          <button type="button" class="btn btn-primary" onclick="Editor.createBeast()">+ Добавить</button>
        </div>
        <p class="hint">Формы для умения «Дикий облик» друида. CR и мин. уровень ограничивают доступность.</p>
        <div class="beast-card-grid">${cards || '<p class="hint">Нет зверей — создайте первого.</p>'}</div>
      </div>`;
    },

    editBeast(id) {
      this.editingBeastId = id;
      this.editingBeastMode = 'edit';
      this.renderBeasts();
    },

    cancelBeastEdit() {
      this.editingBeastMode = 'list';
      this.renderBeasts();
    },

    createBeast() {
      const id = prompt('ID зверя (латиница, без пробелов):', 'new_beast');
      if (!id || !/^[a-z][a-z0-9_]*$/i.test(id)) {
        alert('ID: латиница, без пробелов');
        return;
      }
      this.ensureBeasts();
      if (this.data.beasts[id]) {
        alert('Зверь с таким ID уже есть');
        return;
      }
      this.data.beasts[id] = {
        id,
        name: 'Новый зверь',
        icon: '🐾',
        cr: 0.25,
        hp: 10,
        ac: 12,
        atkBonus: 3,
        dmgRoll: '1d6+1',
        speed: 40,
        stats: { str: 10, dex: 12, con: 10 },
        abilities: [],
        availableForWildShape: true,
        minDruidLevel: 2
      };
      this.editingBeastId = id;
      this.editingBeastMode = 'edit';
      this.renderBeasts();
      this.updateJSONPreview();
    },

    deleteBeast(id) {
      if (!confirm('Удалить зверя «' + id + '»?')) return;
      delete this.data.beasts[id];
      if (this.editingBeastId === id) {
        this.editingBeastId = null;
        this.editingBeastMode = 'list';
      }
      this.renderBeasts();
      this.updateJSONPreview();
    },

    statMod(score) {
      const n = parseInt(score, 10) || 10;
      const m = Math.floor((n - 10) / 2);
      return (m >= 0 ? '+' : '') + m;
    },

    renderBeastAbilityChecks(id, b) {
      const presets = typeof BeastSystem !== 'undefined'
        ? BeastSystem.ABILITY_PRESETS
        : { pack_tactics: 'Тактика стаи', keen_smell: 'Нюх', darkvision: 'Ночное зрение', swim: 'Плавание', climb: 'Лазание', fly: 'Полёт' };
      const selected = new Set(b.abilities || []);
      let html = Object.entries(presets).map(([key, label]) => {
        const checked = selected.has(key) ? 'checked' : '';
        return `<label class="beast-ability-check"><input type="checkbox" ${checked} onchange="Editor.toggleBeastAbility('${this.escapeAttr(id)}','${this.escapeAttr(key)}',this.checked)"> ${this.escapeHtml(label)}</label>`;
      }).join('');
      const custom = [...selected].filter((k) => !presets[k]);
      custom.forEach((k) => {
        html += `<label class="beast-ability-check"><input type="checkbox" checked onchange="Editor.toggleBeastAbility('${this.escapeAttr(id)}','${this.escapeAttr(k)}',this.checked)"> <code>${this.escapeHtml(k)}</code> (своя)</label>`;
      });
      return html;
    },

    renderBeastEditForm(id) {
      const b = this.data.beasts[id];
      if (!b) return '<p>Зверь не найден</p>';
      if (!b.stats) b.stats = { str: 10, dex: 10, con: 10 };
      if (!b.abilities) b.abilities = [];
      const crVal = String(b.cr ?? 0.25);
      const crOpts = CR_SELECT.map((o) => `<option value="${o.v}" ${crVal === o.v ? 'selected' : ''}>${o.n}</option>`).join('');
      const iconOpts = ICON_OPTIONS.map((ic) => `<option value="${ic}" ${b.icon === ic ? 'selected' : ''}>${ic}</option>`).join('');
      const minLvHint = typeof BeastSystem !== 'undefined'
        ? `Авто по CR: ${BeastSystem.getMinLevelForCr(b.cr)} ур.`
        : '';

      return `<div class="beast-edit-form">
        <h3>Редактирование зверя</h3>
        <div class="form-row"><label>ID</label><input type="text" value="${this.escapeAttr(b.id || id)}" disabled class="form-control"><span class="hint">латиница, без пробелов</span></div>
        <div class="form-row"><label>Название</label><input type="text" class="form-control" value="${this.escapeAttr(b.name || '')}" onchange="Editor.updateBeastField('${this.escapeAttr(id)}','name',this.value)"></div>
        <div class="form-row"><label>Иконка</label>
          <select class="form-control" onchange="Editor.updateBeastField('${this.escapeAttr(id)}','icon',this.value)">${iconOpts}</select>
          <input type="text" class="form-control" style="max-width:80px;margin-left:8px;" value="${this.escapeAttr(b.icon || '')}" onchange="Editor.updateBeastField('${this.escapeAttr(id)}','icon',this.value)" placeholder="эмодзи">
        </div>
        <h4>Статы</h4>
        <div class="form-row"><label>CR</label><select class="form-control" onchange="Editor.updateBeastField('${this.escapeAttr(id)}','cr',parseFloat(this.value))">${crOpts}</select></div>
        <div class="form-grid-3">
          <div><label>ОЗ</label><input type="number" class="form-control" value="${b.hp ?? 10}" onchange="Editor.updateBeastField('${this.escapeAttr(id)}','hp',parseInt(this.value,10))"></div>
          <div><label>КД</label><input type="number" class="form-control" value="${b.ac ?? 12}" onchange="Editor.updateBeastField('${this.escapeAttr(id)}','ac',parseInt(this.value,10))"></div>
          <div><label>Атака (+)</label><input type="number" class="form-control" value="${b.atkBonus ?? 0}" onchange="Editor.updateBeastField('${this.escapeAttr(id)}','atkBonus',parseInt(this.value,10))"></div>
        </div>
        <div class="form-row"><label>Урон (формула)</label><input type="text" class="form-control" value="${this.escapeAttr(b.dmgRoll || '1d6')}" onchange="Editor.updateBeastField('${this.escapeAttr(id)}','dmgRoll',this.value)"></div>
        <div class="form-row"><label>Скорость (фт)</label><input type="number" class="form-control" value="${b.speed ?? 40}" onchange="Editor.updateBeastField('${this.escapeAttr(id)}','speed',parseInt(this.value,10))"></div>
        <h4>Характеристики</h4>
        <div class="form-grid-3">
          <div><label>СИЛ</label><input type="number" class="form-control" value="${b.stats.str ?? 10}" onchange="Editor.updateBeastStat('${this.escapeAttr(id)}','str',this.value)"> <span class="hint">мод ${this.statMod(b.stats.str)}</span></div>
          <div><label>ЛОВ</label><input type="number" class="form-control" value="${b.stats.dex ?? 10}" onchange="Editor.updateBeastStat('${this.escapeAttr(id)}','dex',this.value)"> <span class="hint">мод ${this.statMod(b.stats.dex)}</span></div>
          <div><label>ТЕЛ</label><input type="number" class="form-control" value="${b.stats.con ?? 10}" onchange="Editor.updateBeastStat('${this.escapeAttr(id)}','con',this.value)"> <span class="hint">мод ${this.statMod(b.stats.con)}</span></div>
        </div>
        <p class="hint">ИНТ, МУД и ХАР для зверей не используются в бою.</p>
        <h4>Способности</h4>
        <div class="beast-abilities-list">${this.renderBeastAbilityChecks(id, b)}</div>
        <button type="button" class="btn btn-secondary" onclick="Editor.addCustomBeastAbility('${this.escapeAttr(id)}')">+ Добавить свою</button>
        <h4>Ограничения друида</h4>
        <label><input type="checkbox" ${b.availableForWildShape !== false ? 'checked' : ''} onchange="Editor.updateBeastField('${this.escapeAttr(id)}','availableForWildShape',this.checked)"> Доступен для Дикого облика</label>
        <div class="form-row"><label>Мин. уровень друида</label><input type="number" min="1" max="20" class="form-control" value="${b.minDruidLevel ?? 2}" onchange="Editor.updateBeastField('${this.escapeAttr(id)}','minDruidLevel',parseInt(this.value,10))"> <span class="hint">${this.escapeHtml(minLvHint)}</span></div>
        <div class="form-actions" style="margin-top:16px;">
          <button type="button" class="btn btn-primary" onclick="Editor.saveBeastEdit()">💾 Сохранить</button>
          <button type="button" class="btn btn-secondary" onclick="Editor.cancelBeastEdit()">Отмена</button>
        </div>
      </div>`;
    },

    updateBeastField(id, field, value) {
      const b = this.data?.beasts?.[id];
      if (!b) return;
      b[field] = value;
      if (field === 'cr' && typeof BeastSystem !== 'undefined') {
        const auto = BeastSystem.getMinLevelForCr(value);
        if (!b.minDruidLevel || b.minDruidLevel < auto) b.minDruidLevel = auto;
      }
      this.updateJSONPreview();
      if (field === 'name' || field === 'icon' || field === 'cr') this.renderBeasts();
    },

    updateBeastStat(id, key, value) {
      const b = this.data?.beasts?.[id];
      if (!b) return;
      if (!b.stats) b.stats = {};
      b.stats[key] = parseInt(value, 10) || 10;
      this.updateJSONPreview();
    },

    toggleBeastAbility(id, key, on) {
      const b = this.data?.beasts?.[id];
      if (!b) return;
      if (!b.abilities) b.abilities = [];
      if (on && !b.abilities.includes(key)) b.abilities.push(key);
      if (!on) b.abilities = b.abilities.filter((a) => a !== key);
      this.updateJSONPreview();
    },

    addCustomBeastAbility(id) {
      const key = prompt('ID способности (латиница):', 'custom_trait');
      if (!key) return;
      this.toggleBeastAbility(id, key.trim(), true);
      this.renderBeasts();
    },

    saveBeastEdit() {
      this.editingBeastMode = 'list';
      this.renderBeasts();
      this.updateJSONPreview();
      alert('Зверь сохранён в данных (не забудьте экспорт JSON).');
    },

    renderDruidWildShapeClassSection() {
      if (typeof BeastSystem === 'undefined') return '';
      this.ensureBeasts();
      const groups = BeastSystem.groupBeastsByMinLevel(this.data);
      if (!groups.length) {
        return `<div class="druid-wild-shape-panel" style="margin-top:20px;padding:12px;border:1px solid var(--border);border-radius:8px;">
          <h4>🐾 Дикий облик — формы</h4>
          <p class="hint">Нет зверей с флагом «Доступен для Дикого облика».</p>
          <button type="button" class="btn btn-secondary" onclick="Editor.openBeastsTab()">Настроить доступные формы</button>
        </div>`;
      }
      const rows = groups.map((g) => {
        const list = g.beasts.map((b) => `${b.icon || '🐾'} ${b.name} (CR ${BeastSystem.formatCr(b.cr)})`).join(', ');
        return `<li><strong>${g.level} ур.+:</strong> ${this.escapeHtml(list)}</li>`;
      }).join('');
      return `<div class="druid-wild-shape-panel" style="margin-top:20px;padding:12px;border:1px solid var(--border);border-radius:8px;">
        <h4>🐾 Дикий облик — доступные формы</h4>
        <ul class="hint" style="margin:8px 0;">${rows}</ul>
        <button type="button" class="btn btn-secondary" onclick="Editor.openBeastsTab()">Настроить доступные формы → вкладка «Звери»</button>
      </div>`;
    }
  });

  const origDetail = Editor.renderClassDetail;
  Editor.renderClassDetail = function (id) {
    let html = origDetail.call(this, id);
    if (id === 'druid') html += this.renderDruidWildShapeClassSection();
    return html;
  };

  const origSwitch = Editor.switchTab;
  Editor.switchTab = function (tab, event) {
    origSwitch.call(this, tab, event);
    if (tab === 'beasts') this.renderBeasts();
  };

  const origRenderAll = Editor.renderAll;
  Editor.renderAll = function () {
    origRenderAll.call(this);
    if (typeof this.renderBeasts === 'function') this.renderBeasts();
  };
})();
