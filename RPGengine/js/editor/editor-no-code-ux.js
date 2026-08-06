// ============================================================
// No-code UX: формы везде (writer и full). JSON — только явный экспорт.
// ============================================================
(function attachEditorNoCodeUx() {
  if (typeof Editor === 'undefined') {
    console.warn('editor-no-code-ux.js: Editor не определён');
    return;
  }

  const STORAGE_JSON = 'rpg_editor_show_json';
  const STORAGE_MODE = 'rpg_editor_mode';

  /** Транслит RU → латиница для авто-ID */
  const TR = {
    а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',
    к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
    х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'
  };

  Object.assign(Editor, {
    showJsonPreview: false,

    /**
     * Название → стабильный id (латиница).
     * @param {string} name
     * @param {string} [prefix]
     * @param {Set|object} [existing] — занятые id
     */
    slugifyId(name, prefix, existing) {
      let s = String(name || '').trim().toLowerCase();
      s = s.split('').map((ch) => TR[ch] || ch).join('');
      s = s.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      if (!s) s = 'item';
      if (prefix) s = prefix + '_' + s;
      if (!/^[a-z]/.test(s)) s = 'id_' + s;
      const taken = existing
        ? (existing instanceof Set ? existing : new Set(Object.keys(existing)))
        : new Set();
      let out = s;
      let n = 2;
      while (taken.has(out)) {
        out = s + '_' + n;
        n++;
      }
      return out;
    },

    /** Подпись для списков: название (без id), id — в title */
    formatNamedOption(id, label) {
      const name = (label || '').trim() || id;
      return { id, label: name, title: id };
    },

    isJsonPreviewVisible() {
      // И writer, и полный режим — без сырого кода. JSON только по явной кнопке.
      return !!this.showJsonPreview;
    },

    setJsonPreviewVisible(on) {
      this.showJsonPreview = !!on;
      try {
        localStorage.setItem(STORAGE_JSON, this.showJsonPreview ? '1' : '0');
      } catch (e) { /* */ }
      this.applyJsonPreviewVisibility();
      if (this.showJsonPreview && typeof this.updateJSONPreview === 'function') {
        this.updateJSONPreview();
      }
    },

    applyJsonPreviewVisibility() {
      const show = this.isJsonPreviewVisible();
      document.body.classList.toggle('editor-hide-json', !show);
      document.querySelectorAll('.tab[data-tab-id="json"]').forEach((el) => {
        el.classList.toggle('tab--mode-hidden', !show);
        el.setAttribute('aria-hidden', show ? 'false' : 'true');
      });
      const tab = document.getElementById('tab-json');
      if (tab && !show) tab.classList.remove('active');
      const btn = document.getElementById('btn-toggle-json');
      if (btn) {
        btn.textContent = show ? '📄 Скрыть данные проекта' : '📄 Данные проекта (экспорт)';
        btn.setAttribute('aria-pressed', show ? 'true' : 'false');
      }
    },

    toggleJsonPreview() {
      this.setJsonPreviewVisible(!this.showJsonPreview);
      if (this.showJsonPreview && typeof this.switchTab === 'function') {
        this.switchTab('json');
      }
    },

    initNoCodeUx() {
      // JSON-вкладка выключена по умолчанию и в полном режиме — это не «код», а экспорт для продвинутых
      try {
        this.showJsonPreview = localStorage.getItem(STORAGE_JSON) === '1';
      } catch (e) {
        this.showJsonPreview = false;
      }
      try {
        if (localStorage.getItem(STORAGE_MODE) == null) {
          localStorage.setItem(STORAGE_MODE, 'writer');
        }
      } catch (e) { /* */ }
      document.body.classList.add('editor-forms-only');
      this.applyJsonPreviewVisibility();
      this.injectNoCodeToolbar();
      this.softenCodeLabelsInDom();
    },

    /** Подписи в DOM: убрать «JSON», «флаг» там, где остались старые тексты */
    softenCodeLabelsInDom() {
      const map = [
        [/Предпросмотр JSON/gi, 'Данные проекта (только просмотр)'],
        [/Сырой JSON/gi, 'Данные проекта'],
        [/legacy-флаг/gi, 'событие в игре'],
        [/Legacy-флаг/gi, 'Событие в игре'],
        [/без JSON/gi, 'через форму'],
        [/\(JSON\)/gi, '']
      ];
      document.querySelectorAll('label, .hint, h4, .tab').forEach((el) => {
        if (!el.childElementCount && el.textContent) {
          let s = el.textContent;
          let changed = false;
          map.forEach(([re, to]) => {
            if (re.test(s)) {
              s = s.replace(re, to);
              changed = true;
            }
          });
          if (changed) el.textContent = s;
        }
      });
    },

    injectNoCodeToolbar() {
      if (document.getElementById('btn-toggle-json')) return;
      const host =
        document.getElementById('editor-mode-toggle')?.parentElement ||
        document.querySelector('.editor-toolbar') ||
        document.querySelector('.sidebar-header') ||
        document.querySelector('.context-sidebar');
      if (!host) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'btn-toggle-json';
      btn.className = 'btn btn-secondary';
      btn.style.cssText = 'margin-top:6px;width:100%;font-size:12px;';
      btn.onclick = () => Editor.toggleJsonPreview();
      btn.textContent = this.showJsonPreview ? '📄 Скрыть данные проекта' : '📄 Данные проекта (экспорт)';
      host.appendChild(btn);
    },

    /**
     * Диалог «название → авто-ID».
     * @returns {{ id: string, name: string }|null}
     */
    promptNameAndId(opts) {
      const o = opts || {};
      const name = prompt(o.namePrompt || 'Название (для игрока):', o.defaultName || '');
      if (name === null) return null;
      const trimmed = String(name).trim();
      if (!trimmed) {
        alert('Нужно название');
        return null;
      }
      const existing = o.existing || {};
      let id = this.slugifyId(trimmed, o.prefix || '', existing);
      if (o.allowEditId) {
        const edited = prompt('Технический ID (можно не менять):', id);
        if (edited === null) return null;
        id = String(edited).trim() || id;
        if (!/^[a-z][a-z0-9_]*$/i.test(id)) {
          alert('ID: латиница, цифры и _');
          return null;
        }
        if (existing[id] || (existing instanceof Set && existing.has(id))) {
          alert('Такой ID уже есть');
          return null;
        }
      } else if (existing[id] || (existing instanceof Set && existing.has(id))) {
        id = this.slugifyId(trimmed + '_' + Date.now().toString(36).slice(-3), o.prefix || '', existing);
      }
      return { id, name: trimmed };
    },

    // ——— Человеческие пресеты условий (без слова «флаг») ———

    applyHumanConditionPreset(builderId, preset) {
      const ctx = this._conditionBuilders?.get(builderId);
      if (!ctx) return;
      const target = ctx.getTarget();
      if (!target) return;
      const key = ctx.propertyKey;
      let rule = null;
      if (preset === 'has_item') {
        const items = this.getItemIds?.() || Object.keys(this.data?.items || {});
        const first = items[0] || '';
        rule = { hasItem: first };
      } else if (preset === 'quest_active') {
        const qids = Object.keys(this.data?.quests || {});
        rule = { questMinStage: { questId: qids[0] || '', stage: 0 } };
      } else if (preset === 'quest_stage') {
        const qids = Object.keys(this.data?.quests || {});
        rule = { questStage: { questId: qids[0] || '', stage: '0' } };
      } else if (preset === 'quest_done') {
        const qids = Object.keys(this.data?.quests || {});
        rule = { questStage: { questId: qids[0] || '', stage: 'complete' } };
      } else if (preset === 'has_gold') {
        rule = { goldMin: 10 };
      } else if (preset === 'clear') {
        delete target[key];
        if (typeof ctx.onChange === 'function') ctx.onChange();
        this.refreshConditionBuilder(builderId);
        if (typeof this.updateJSONPreview === 'function') this.updateJSONPreview();
        return;
      }
      if (!rule) return;
      target[key] = { mode: 'all', rules: [rule] };
      if (typeof ctx.onChange === 'function') ctx.onChange();
      this.refreshConditionBuilder(builderId);
      if (typeof this.updateJSONPreview === 'function') this.updateJSONPreview();
    }
  });

  // Подмена подписей в конструкторе условий + пресеты
  const origBody = Editor._renderConditionBuilderBody?.bind(Editor);
  if (origBody) {
    Editor._renderConditionBuilderBody = function (target, propertyKey, builderId, title) {
      let humanTitle = title;
      if (propertyKey === 'showIf' || /show/i.test(String(title))) {
        humanTitle = 'Показать, если…';
      } else if (propertyKey === 'hideIf' || /hide/i.test(String(title))) {
        humanTitle = 'Скрыть, если…';
      }
      let html = origBody(target, propertyKey, builderId, humanTitle);
      // Пресеты без «флагов»
      const presets = `
        <div class="cb-human-presets">
          <span class="hint">Быстро:</span>
          <button type="button" class="btn btn-secondary btn-sm" onclick="Editor.applyHumanConditionPreset('${builderId}','has_item')">Есть предмет</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="Editor.applyHumanConditionPreset('${builderId}','quest_active')">Квест начат</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="Editor.applyHumanConditionPreset('${builderId}','quest_stage')">Квест на этапе</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="Editor.applyHumanConditionPreset('${builderId}','quest_done')">Квест завершён</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="Editor.applyHumanConditionPreset('${builderId}','has_gold')">Достаточно золота</button>
        </div>`;
      html = html.replace('<div class="cb-head">', presets + '<div class="cb-head">');
      // Смягчить подписи
      html = html
        .replace(/Нет правил — элемент всегда доступен \(для showIf\) или не скрыт \(для hideIf\)\./g,
          'Без условий — всегда видно. Добавьте правило или выберите быстрый вариант выше.')
        .replace(/>Флаг</g, '>Событие в игре<')
        .replace(/>Флаг выключен</g, '>Событие ещё не случилось<')
        .replace(/— флаг —/g, '— событие —');
      return html;
    };
  }

  // Подписи типов правил
  if (Array.isArray(Editor.CONDITION_RULE_TYPES)) {
    const map = {
      flag: 'Событие в игре произошло',
      notFlag: 'Событие ещё не произошло',
      hasItem: 'Есть предмет',
      notHasItem: 'Нет предмета',
      goldMin: 'Золота не меньше',
      goldMax: 'Золота не больше',
      class: 'Класс героя',
      questStage: 'Квест на этапе',
      questMinStage: 'Квест не раньше этапа',
      choiceUsed: 'Выбор уже сделан',
      choiceNotUsed: 'Выбор ещё не сделан'
    };
    Editor.CONDITION_RULE_TYPES.forEach((t) => {
      if (map[t.id]) t.label = map[t.id];
    });
  }

  // updateJSONPreview — не трогать DOM, если скрыто
  const origJson = Editor.updateJSONPreview?.bind(Editor);
  if (origJson) {
    Editor.updateJSONPreview = function () {
      if (!this.isJsonPreviewVisible()) return;
      return origJson();
    };
  }

  // applyEditorMode — синхронизировать JSON
  const origApply = Editor.applyEditorMode?.bind(Editor);
  if (origApply) {
    Editor.applyEditorMode = function (mode) {
      origApply(mode);
      this.applyJsonPreviewVisibility();
    };
  }

  // Стили
  if (typeof document !== 'undefined' && !document.getElementById('no-code-ux-styles')) {
    const st = document.createElement('style');
    st.id = 'no-code-ux-styles';
    st.textContent = `
      body.editor-hide-json .tab[data-tab-id="json"],
      body.editor-hide-json #tab-json { display: none !important; }
      /* Полный режим тоже без «кода»: сырые JSON-textarea скрыты, пока нет data-show-raw */
      body.editor-forms-only textarea.service-json-field,
      body.editor-forms-only .quest-json-preview,
      body.editor-forms-only .raw-json-editor {
        display: none !important;
      }
      body.editor-forms-only.show-raw-json textarea.service-json-field,
      body.editor-forms-only.show-raw-json .quest-json-preview,
      body.editor-forms-only.show-raw-json .raw-json-editor {
        display: block !important;
      }
      .cb-human-presets { display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-bottom:8px; }
      .cb-human-presets .btn-sm { font-size:11px; padding:4px 8px; }
      .dialogue-topic-card { border:1px solid var(--border,#444); border-radius:8px; padding:10px; margin:8px 0; }
      .svc-params-form .form-group { margin-bottom:8px; }
    `;
    document.head.appendChild(st);
  }



  // Создание класса/NPC и т.п. — сначала название, ID авто
  const origCreateClass = Editor.createClass?.bind(Editor);
  if (typeof origCreateClass === 'function') {
    Editor.createClass = function () {
      if (typeof this.promptNameAndId === 'function') {
        if (!this.data.classes) this.data.classes = {};
        const r = this.promptNameAndId({
          namePrompt: 'Название класса:',
          defaultName: 'Новый класс',
          existing: this.data.classes,
          allowEditId: false
        });
        if (!r) return;
        const id = r.id;
        this.data.classes[id] = {
          name: r.name,
          icon: '⚔️',
          hp: 20,
          ac: 14,
          atkBonus: 3,
          dmgRoll: '1d8',
          dmgBonus: 2,
          initBonus: 2,
          stats: { str: 12, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
          skills: 'Атлетика, Восприятие',
          resource: { name: 'Энергия', max: 2, desc: 'Ресурс для способностей.' },
          mainWeapon: null,
          startingItems: [],
          abilities: [{
            id: id + '_strike',
            name: 'Удар',
            cost: 1,
            icon: '⚔️',
            desc: 'Базовая атака.',
            combatOnly: true,
            oncePerCombat: false,
            effect: { type: 'damage', value: '1d8', damageType: 'physical' }
          }]
        };
        this.editingClassId = id;
        this.renderClasses();
        this.updateJSONPreview();
        return;
      }
      return origCreateClass();
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Editor.initNoCodeUx());
  } else {
    setTimeout(() => Editor.initNoCodeUx(), 0);
  }
})();
