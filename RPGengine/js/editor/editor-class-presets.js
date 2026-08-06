// ============================================================
// Пресеты классов + мастер умения (full mode без «справочника»)
// ============================================================
(function attachClassPresetsAndAbilityWizard() {
  if (typeof Editor === 'undefined') {
    console.warn('editor-class-presets.js: Editor не определён');
    return;
  }

  /** Готовые классы: название → статы + 2–3 умения */
  const CLASS_PRESETS = [
    {
      id: 'warrior',
      name: 'Воин',
      icon: '⚔️',
      blurb: 'Много HP, сильный удар',
      data: {
        name: 'Воин',
        icon: '⚔️',
        hp: 28,
        ac: 16,
        atkBonus: 4,
        dmgRoll: '1d10',
        dmgBonus: 3,
        initBonus: 1,
        stats: { str: 16, dex: 12, con: 15, int: 8, wis: 10, cha: 10 },
        skills: 'Атлетика, Восприятие',
        resource: { name: 'Ярость', max: 2, desc: 'Очки для мощных ударов.' },
        abilities: [
          {
            id: 'warrior_strike',
            name: 'Мощный удар',
            cost: 1,
            icon: '💥',
            desc: 'Сильная атака по одному врагу.',
            combatOnly: true,
            oncePerCombat: false,
            effect: { type: 'damage', value: '1d10+3', damageType: 'physical' }
          },
          {
            id: 'warrior_second_wind',
            name: 'Второе дыхание',
            cost: 1,
            icon: '💚',
            desc: 'Восстановить силы в бою.',
            combatOnly: true,
            oncePerCombat: true,
            effect: { type: 'heal', value: '1d8+2', targeting: { scope: 'self' } }
          }
        ]
      }
    },
    {
      id: 'mage',
      name: 'Маг',
      icon: '🔮',
      blurb: 'Заклинания, мало HP',
      data: {
        name: 'Маг',
        icon: '🔮',
        hp: 16,
        ac: 12,
        atkBonus: 2,
        dmgRoll: '1d4',
        dmgBonus: 0,
        initBonus: 2,
        stats: { str: 8, dex: 12, con: 12, int: 16, wis: 12, cha: 10 },
        skills: 'Магия, История',
        resource: { name: 'Мана', max: 4, desc: 'Очки заклинаний.' },
        abilities: [
          {
            id: 'mage_bolt',
            name: 'Магическая стрела',
            cost: 1,
            icon: '✨',
            desc: 'Снаряд чистой энергии.',
            combatOnly: true,
            oncePerCombat: false,
            effect: { type: 'damage', value: '1d8', damageType: 'force', targeting: { scope: 'single' } }
          },
          {
            id: 'mage_missile',
            name: 'Волшебные стрелы',
            cost: 2,
            icon: '☄️',
            desc: 'Несколько снарядов по врагу.',
            combatOnly: true,
            oncePerCombat: false,
            effect: { type: 'magic_missile' }
          },
          {
            id: 'mage_shield',
            name: 'Щит',
            cost: 1,
            icon: '🛡️',
            desc: 'Краткий бонус к защите.',
            combatOnly: true,
            oncePerCombat: true,
            effect: { type: 'buff', buffType: 'ac', value: 2, targeting: { scope: 'self' } }
          }
        ]
      }
    },
    {
      id: 'rogue',
      name: 'Плут',
      icon: '🗡️',
      blurb: 'Ловкость, скрытность',
      data: {
        name: 'Плут',
        icon: '🗡️',
        hp: 20,
        ac: 14,
        atkBonus: 5,
        dmgRoll: '1d6',
        dmgBonus: 3,
        initBonus: 4,
        stats: { str: 10, dex: 16, con: 12, int: 12, wis: 12, cha: 12 },
        skills: 'Скрытность, Ловкость рук',
        resource: { name: 'Хитрость', max: 3, desc: 'Очки для трюков.' },
        abilities: [
          {
            id: 'rogue_sneak',
            name: 'Подлый удар',
            cost: 1,
            icon: '🗡️',
            desc: 'Точный удар в уязвимое место.',
            combatOnly: true,
            oncePerCombat: false,
            effect: { type: 'damage', value: '2d6', damageType: 'physical' }
          },
          {
            id: 'rogue_dodge',
            name: 'Уклонение',
            cost: 1,
            icon: '💨',
            desc: 'Стать труднее попасть.',
            combatOnly: true,
            oncePerCombat: true,
            effect: { type: 'buff', buffType: 'ac', value: 3, targeting: { scope: 'self' } }
          }
        ]
      }
    },
    {
      id: 'cleric',
      name: 'Жрец',
      icon: '✝️',
      blurb: 'Лечение и светлая кара',
      data: {
        name: 'Жрец',
        icon: '✝️',
        hp: 22,
        ac: 15,
        atkBonus: 3,
        dmgRoll: '1d8',
        dmgBonus: 1,
        initBonus: 1,
        stats: { str: 12, dex: 10, con: 14, int: 10, wis: 16, cha: 12 },
        skills: 'Медицина, Религия',
        resource: { name: 'Вера', max: 3, desc: 'Очки божественной силы.' },
        abilities: [
          {
            id: 'cleric_heal',
            name: 'Исцеление',
            cost: 1,
            icon: '💚',
            desc: 'Восстановить здоровье.',
            combatOnly: false,
            oncePerCombat: false,
            effect: { type: 'heal', value: '2d8', targeting: { scope: 'self' } }
          },
          {
            id: 'cleric_smite',
            name: 'Священная кара',
            cost: 2,
            icon: '☀️',
            desc: 'Удар священным огнём.',
            combatOnly: true,
            oncePerCombat: false,
            effect: { type: 'smite', value: '2d8' }
          }
        ]
      }
    },
    {
      id: 'ranger',
      name: 'Следопыт',
      icon: '🏹',
      blurb: 'Дальний бой и выживание',
      data: {
        name: 'Следопыт',
        icon: '🏹',
        hp: 22,
        ac: 14,
        atkBonus: 4,
        dmgRoll: '1d8',
        dmgBonus: 2,
        initBonus: 3,
        stats: { str: 12, dex: 15, con: 13, int: 10, wis: 14, cha: 10 },
        skills: 'Выживание, Восприятие',
        resource: { name: 'Фокус', max: 2, desc: 'Очки концентрации.' },
        abilities: [
          {
            id: 'ranger_shot',
            name: 'Прицельный выстрел',
            cost: 1,
            icon: '🏹',
            desc: 'Выстрел по одному врагу.',
            combatOnly: true,
            oncePerCombat: false,
            effect: { type: 'damage', value: '1d8+2', damageType: 'physical', targeting: { scope: 'single' } }
          },
          {
            id: 'ranger_trap',
            name: 'Ловушка',
            cost: 1,
            icon: '⚠️',
            desc: 'Замедлить и ранить врага.',
            combatOnly: true,
            oncePerCombat: true,
            effect: { type: 'damage', value: '1d6', damageType: 'physical' }
          }
        ]
      }
    }
  ];

  const ABILITY_WIZARD_KINDS = [
    { id: 'damage', label: 'Удар / урон', icon: '💥', hint: 'Наносит урон врагу' },
    { id: 'heal', label: 'Лечение', icon: '💚', hint: 'Восстанавливает HP' },
    { id: 'buff', label: 'Защита / бафф', icon: '🛡️', hint: 'Повышает броню' },
    { id: 'smite', label: 'Кара', icon: '☀️', hint: 'Доп. урон светом' },
    { id: 'magic_missile', label: 'Маг. снаряды', icon: '☄️', hint: 'Несколько снарядов' }
  ];

  Object.assign(Editor, {
    CLASS_PRESETS,
    ABILITY_WIZARD_KINDS,
    _abilityWizardOpen: false,

    renderClassPresetsBar() {
      const cards = CLASS_PRESETS.map((p) => `
        <button type="button" class="class-preset-card" data-preset-id="${this.escapeAttr(p.id)}"
          title="${this.escapeAttr(p.blurb)}">
          <span class="class-preset-icon">${p.icon}</span>
          <span class="class-preset-name">${this.escapeHtml(p.name)}</span>
          <span class="class-preset-blurb">${this.escapeHtml(p.blurb)}</span>
        </button>`).join('');
      return `<div class="class-presets-bar project-info">
        <h4>Быстрый старт — пресеты</h4>
        <p class="hint">Один клик: готовый класс с 2–3 умениями. Потом можно править формы.</p>
        <div class="class-presets-grid">${cards}</div>
        <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;">
          <button type="button" class="btn btn-secondary" onclick="Editor.createClass()">+ Пустой класс</button>
        </div>
      </div>`;
    },

    applyClassPreset(presetId) {
      try {
        const preset = CLASS_PRESETS.find((p) => p.id === presetId);
        if (!preset) {
          alert('Пресет не найден: ' + presetId);
          return;
        }
        if (!this.data) {
          alert('Сначала загрузите или создайте проект (вкладка проекта / «Новая история»).');
          return;
        }
        if (!this.data.classes || typeof this.data.classes !== 'object') {
          this.data.classes = {};
        }
        let baseId = preset.id || 'class';
        if (typeof this.slugifyId === 'function') {
          try {
            baseId = this.slugifyId(preset.name || preset.id, '', this.data.classes) || baseId;
          } catch (e) {
            baseId = preset.id;
          }
        }
        if (this.data.classes[baseId]) {
          baseId = preset.id + '_' + Date.now().toString(36).slice(-4);
        }
        const body = JSON.parse(JSON.stringify(preset.data));
        body.id = baseId;
        body.name = body.name || preset.name;
        body.icon = body.icon || preset.icon;
        if (!Array.isArray(body.abilities)) body.abilities = [];
        body.abilities.forEach((ab, i) => {
          if (!ab || typeof ab !== 'object') return;
          ab.id = baseId + '_ab' + i;
        });
        this.data.classes[baseId] = body;
        this.editingClassId = baseId;
        this._abilityWizardOpen = false;

        // Надёжный рендер: сначала простой, потом полный
        this._renderClassesSafe(baseId);
        try { this.updateJSONPreview?.(); } catch (e) { console.warn(e); }

        const ok = !!this.data.classes[baseId];
        if (ok) {
          alert('Класс «' + preset.name + '» добавлен. Выберите его слева, если список уже открыт.');
        } else {
          alert('Класс не сохранился в data.classes — проверьте консоль.');
        }
      } catch (err) {
        console.error('applyClassPreset', err);
        alert('Не удалось добавить класс: ' + (err && err.message ? err.message : err));
      }
    },

    /** Рендер классов без падения, если renderClassDetail сломан */
    _renderClassesSafe(preferId) {
      const container = document.getElementById('classes-list');
      if (!container || !this.data) return;
      if (!this.data.classes) this.data.classes = {};
      const ids = Object.keys(this.data.classes);
      if (preferId && this.data.classes[preferId]) this.editingClassId = preferId;
      else if (!this.editingClassId || !this.data.classes[this.editingClassId]) {
        this.editingClassId = ids[0] || null;
      }

      try {
        this.renderClasses?.();
      } catch (err) {
        console.error('renderClasses failed, fallback UI', err);
        if (!ids.length) {
          container.innerHTML = '<div class="empty-state"><h2>Нет классов</h2></div>';
        } else {
          const sidebar = ids.map((id) => {
            const cls = this.data.classes[id];
            const active = id === this.editingClassId ? 'active' : '';
            return `<button type="button" class="class-pick ${active}" onclick="Editor.selectClassToEdit(${JSON.stringify(id)})">${cls.icon || '⚔️'} ${this.escapeHtml(cls.name || id)}</button>`;
          }).join('');
          let detail = '<p class="hint">Не удалось отрисовать карточку класса (ошибка в редакторе). Класс в данных есть — сохраните проект.</p>';
          try {
            if (this.editingClassId && typeof this.renderClassDetail === 'function') {
              detail = this.renderClassDetail(this.editingClassId);
            }
          } catch (e2) {
            detail = `<pre class="hint">${this.escapeHtml(String(e2.message || e2))}</pre>`;
          }
          container.innerHTML = `<div class="class-editor-wrap"><div class="class-editor-sidebar">${sidebar}</div><div class="class-editor-detail">${detail}</div></div>`;
        }
      }
      // пресеты сверху
      enhanceClassesPanel();
    },

    renderAbilityWizardPanel(classId) {
      if (!this._abilityWizardOpen) {
        return `<div class="ability-wizard-bar">
          <button type="button" class="btn btn-primary" onclick="Editor.openAbilityWizard()">✨ Мастер умения</button>
          <span class="hint">Название → тип → кости — без справочника эффектов.</span>
        </div>`;
      }
      const kinds = ABILITY_WIZARD_KINDS.map((k) =>
        `<label class="ability-wiz-kind">
          <input type="radio" name="wiz-ab-kind" value="${k.id}" ${k.id === 'damage' ? 'checked' : ''}>
          <span>${k.icon} ${this.escapeHtml(k.label)}</span>
        </label>`
      ).join('');
      const dice = (this.DICE_PRESETS || ['1d4', '1d6', '1d8', '1d10', '2d6', '2d8']).map((d) =>
        `<option value="${d}">${d}</option>`
      ).join('');
      return `<div class="ability-wizard-panel project-info">
        <div class="quest-detail-head">
          <h4>✨ Мастер умения</h4>
          <button type="button" class="btn btn-secondary" onclick="Editor.closeAbilityWizard()">Закрыть</button>
        </div>
        <div class="form-group"><label>Название</label>
          <input type="text" id="wiz-ab-name" placeholder="Огненный шар" value="Новое умение"></div>
        <div class="form-group"><label>Тип</label>
          <div class="ability-wiz-kinds">${kinds}</div></div>
        <div class="form-group"><label>Кубики / сила</label>
          <select id="wiz-ab-dice">${dice}<option value="1d8+2">1d8+2</option></select></div>
        <div class="form-group"><label>Стоимость ресурса</label>
          <input type="number" id="wiz-ab-cost" min="0" value="1" style="max-width:80px"></div>
        <div class="form-group"><label>
          <input type="checkbox" id="wiz-ab-combat" checked> Только в бою
        </label></div>
        <button type="button" class="btn btn-primary" onclick="Editor.applyAbilityWizard(${JSON.stringify(classId)})">
          Создать умение
        </button>
      </div>`;
    },

    openAbilityWizard() {
      this._abilityWizardOpen = true;
      this.renderClasses();
    },

    closeAbilityWizard() {
      this._abilityWizardOpen = false;
      this.renderClasses();
    },

    applyAbilityWizard(classId) {
      const cid = classId || this.editingClassId;
      const cls = this.data?.classes?.[cid];
      if (!cls) {
        alert('Сначала создайте или выберите класс (пресет или «Пустой класс»).');
        return;
      }
      classId = cid;
      const name = document.getElementById('wiz-ab-name')?.value?.trim() || 'Умение';
      const kind = document.querySelector('input[name="wiz-ab-kind"]:checked')?.value || 'damage';
      const dice = document.getElementById('wiz-ab-dice')?.value || '1d6';
      const cost = parseInt(document.getElementById('wiz-ab-cost')?.value, 10) || 0;
      const combatOnly = !!document.getElementById('wiz-ab-combat')?.checked;

      if (!Array.isArray(cls.abilities)) cls.abilities = [];
      const abId = (typeof this.slugifyId === 'function'
        ? this.slugifyId(name, classId, {})
        : classId + '_ab_' + (cls.abilities.length + 1));

      let effect = { type: kind };
      if (kind === 'damage') {
        effect = { type: 'damage', value: dice, damageType: 'physical' };
      } else if (kind === 'heal') {
        effect = { type: 'heal', value: dice, targeting: { scope: 'self' } };
      } else if (kind === 'buff') {
        effect = { type: 'buff', buffType: 'ac', value: 2, targeting: { scope: 'self' } };
      } else if (kind === 'smite') {
        effect = { type: 'smite', value: dice };
      } else if (kind === 'magic_missile') {
        effect = { type: 'magic_missile' };
      }

      const icons = { damage: '💥', heal: '💚', buff: '🛡️', smite: '☀️', magic_missile: '☄️' };
      cls.abilities.push({
        id: abId,
        name,
        cost,
        icon: icons[kind] || '✨',
        desc: name,
        combatOnly,
        oncePerCombat: false,
        effect
      });

      this._abilityWizardOpen = false;
      this.updateJSONPreview();
      this.renderClasses();
    }
  });

  function enhanceClassesPanel() {
    const container = document.getElementById('classes-list');
    if (!container) return;

    // пресеты всегда сверху
    if (!container.querySelector('.class-presets-bar')) {
      const wrap = document.createElement('div');
      wrap.innerHTML = Editor.renderClassPresetsBar();
      const bar = wrap.firstElementChild;
      if (bar) container.insertBefore(bar, container.firstChild);
    }

    // мастер умений — только если выбран существующий класс
    const cid = Editor.editingClassId;
    const hasClass = cid && Editor.data?.classes?.[cid];
    if (!hasClass) {
      Editor._abilityWizardOpen = false;
      return;
    }

    if (container.querySelector('.ability-wizard-bar, .ability-wizard-panel')) return;

    const host =
      container.querySelector('.class-editor-detail') ||
      container.querySelector('.class-editor-wrap') ||
      container;
    const w = document.createElement('div');
    w.innerHTML = Editor.renderAbilityWizardPanel(cid);
    const el = w.firstElementChild;
    if (!el) return;
    const abHeader = Array.from(container.querySelectorAll('h3,h4')).find((h) =>
      /умения|способност/i.test(h.textContent || '')
    );
    if (abHeader && abHeader.parentNode) abHeader.parentNode.insertBefore(el, abHeader);
    else host.appendChild(el);
  }

  // Делегирование кликов по пресетам (надёжнее inline onclick)
  if (!window._classPresetClickBound) {
    window._classPresetClickBound = true;
    document.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest && e.target.closest('.class-preset-card[data-preset-id]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute('data-preset-id');
      if (id && typeof Editor.applyClassPreset === 'function') {
        Editor.applyClassPreset(id);
      } else {
        alert('applyClassPreset недоступен — перезагрузите редактор.');
      }
    });
  }

  if (Editor.hooks && typeof Editor.hooks.after === 'function') {
    if (typeof Editor.hooks.rebind === 'function') {
      Editor.hooks.rebind('renderClasses');
    }
    Editor.hooks.after('renderClasses', function () { enhanceClassesPanel(); });
  } else {
    const origRenderClasses = Editor.renderClasses?.bind(Editor);
    if (typeof origRenderClasses === 'function') {
      Editor.renderClasses = function () {
        origRenderClasses.apply(this, arguments);
        enhanceClassesPanel();
      };
    }
  }

  // После всех модулей — ещё раз rebind (editor-classes мог перезаписать метод)
  setTimeout(() => {
    if (Editor.hooks?.rebind) Editor.hooks.rebind('renderClasses');
  }, 0);

  if (typeof document !== 'undefined' && !document.getElementById('class-presets-styles')) {
    const st = document.createElement('style');
    st.id = 'class-presets-styles';
    st.textContent = `
      .class-presets-bar { margin-bottom: 16px; }
      .class-presets-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 8px;
        margin-top: 8px;
      }
      .class-preset-card {
        display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
        text-align: left; padding: 10px 12px; border-radius: 8px;
        border: 1px solid var(--border, #ccc); background: var(--card-bg, #fff);
        cursor: pointer; color: inherit; font: inherit;
      }
      .class-preset-card:hover { border-color: var(--accent, #8b4513); }
      .class-preset-icon { font-size: 22px; }
      .class-preset-name { font-weight: 700; font-size: 14px; }
      .class-preset-blurb { font-size: 11px; opacity: 0.75; }
      .ability-wizard-bar { margin: 12px 0; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .ability-wizard-panel { margin: 12px 0; }
      .ability-wiz-kinds { display: flex; flex-direction: column; gap: 4px; }
      .ability-wiz-kind { display: flex; align-items: center; gap: 8px; cursor: pointer; }
    `;
    document.head.appendChild(st);
  }
})();
