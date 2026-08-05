// Контекстные подсказки (?) в формах редактора

(function attachEditorHelp() {
  const DATA = typeof EditorHelpData !== 'undefined' ? EditorHelpData : {};
  const LABEL_MAP = typeof EditorHelpLabelMap !== 'undefined' ? EditorHelpLabelMap : {};
  const STORAGE_KEY = 'rpgengine_editor_help_show_all';

  function normalizeLabel(text) {
    return String(text || '')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function getText(fieldId) {
    if (typeof I18n !== 'undefined' && I18n.getLanguage() === 'en' && fieldId) {
      const key = 'help.' + fieldId;
      const fromLocale = I18n.t(key);
      if (fromLocale && fromLocale !== key) return fromLocale;
    }
    return DATA[fieldId] || '';
  }

  const CONTEXT_LABEL_MAPS = [
    {
      match: (g) => g.closest('.choice-card'),
      map: {
        'текст': 'choice-text',
        'иконка': 'choice-icon',
        'тип': 'choice-type',
        'сцена (переход)': 'choice-to',
        'action': 'choice-action',
        'doneflag (один раз)': 'choice-done-flag',
        'квест при выборе': 'choice-quest-set',
        'при выборе — стадия квеста': 'choice-quest-set'
      }
    },
    {
      match: (g) => g.closest('#quests-editor, .quest-editor, .quest-stage-card'),
      map: {
        'id (ключ в json)': 'quest-id',
        'название для игрока': 'quest-title',
        'золото (зм)': 'quest-reward-gold',
        'опыт за завершение': 'quest-reward-exp',
        'тип стадии': 'quest-stage-type',
        'текст в лог (log)': 'quest-stage-log',
        'подсказка в журнале (hint)': 'quest-stage-hint'
      }
    },
    {
      match: (g) => g.closest('#npcs-editor, .npc-editor-panel'),
      map: {
        'id': 'npc-id',
        'имя': 'npc-name',
        'иконка': 'npc-icon',
        'описание': 'npc-desc',
        'локация': 'npc-location',
        'отношение': 'npc-attitude'
      }
    },
    {
      match: (g) => g.closest('#enemies-editor, .enemy-editor-panel'),
      map: {
        'id': 'enemy-id',
        'имя': 'enemy-name',
        'hp': 'enemy-hp',
        'кд': 'enemy-ac',
        'атака': 'enemy-atk',
        'урон': 'enemy-dmg',
        'бонус урона': 'enemy-dmg-bonus',
        'ловкость': 'enemy-dex',
        'опыт': 'enemy-exp',
        'предмет': 'loot-item',
        'шанс (0–1)': 'loot-chance',
        'min': 'loot-min',
        'max': 'loot-max'
      }
    },
    {
      match: (g) => g.closest('.ability-edit-card, #abilities-editor'),
      map: {
        'id': 'ability-id',
        'название': 'ability-name',
        'описание': 'ability-desc',
        'иконка': 'ability-icon',
        'тип': 'ability-type',
        'применение': 'ability-usage',
        'стоимость': 'ability-cost',
        'тип эффекта': 'ability-effect-type',
        'формула (xdy+z)': 'ability-formula',
        'тип урона': 'ability-damage-type',
        'область действия': 'ability-target-scope',
        'зона действия': 'ability-combat-range',
        'дальность': 'ability-range',
        'дальность (range)': 'ability-combat-range',
        'радиус (например: 15ft)': 'ability-radius',
        'пассивный эффект (json)': 'ability-passive',
        'тип действия': 'ability-action-type',
        'триггер': 'ability-trigger'
      }
    },
    {
      match: (g) => g.closest('#items-editor, .item-editor-panel'),
      map: {
        'название': 'item-name',
        'тип': 'item-type',
        'описание': 'item-desc',
        'урон': 'item-dmg',
        'характеристика': 'item-stat',
        'кд / acbonus': 'item-ac',
        'иконка': 'item-icon',
        'эффект': 'item-effect',
        'цель использования': 'item-use-target',
        'формула / amount': 'item-use-formula',
        'подпись кнопки': 'item-use-label',
        'бонусы (json)': 'item-bonuses',
        'слот аксессуара': 'item-accessory-slot'
      }
    }
  ];

  function resolveFieldId(group) {
    if (group.dataset.helpId) return group.dataset.helpId;

    const control = group.querySelector(
      'input[id], select[id], textarea[id], input[data-help-id], select[data-help-id], textarea[data-help-id]'
    );
    if (control) {
      const explicit = control.dataset.helpId;
      if (explicit && DATA[explicit]) return explicit;
      const byId = control.id;
      if (byId && DATA[byId]) return byId;
    }

    const label = findLabel(group);
    if (label) {
      const norm = normalizeLabel(labelTextFromLabel(label));

      for (const ctx of CONTEXT_LABEL_MAPS) {
        if (!ctx.match(group)) continue;
        const ctxId = ctx.map[norm];
        if (ctxId && DATA[ctxId]) return ctxId;
      }

      const mapped = LABEL_MAP[norm];
      if (mapped && DATA[mapped]) return mapped;
    }

    return null;
  }

  function labelTextFromLabel(label) {
    const clone = label.cloneNode(true);
    clone.querySelectorAll('input, select, textarea, button, .editor-help-trigger, .editor-help-inline').forEach((el) => el.remove());
    return clone.textContent || '';
  }

  function findLabel(group) {
    const direct = group.querySelector(':scope > label');
    if (direct) return direct;
    return group.querySelector(':scope > .cb-field-label, :scope > strong, :scope > h4, :scope > h5');
  }

  let tooltipEl = null;
  let pinnedFieldId = null;

  function ensureTooltip() {
    if (tooltipEl) return tooltipEl;
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'editor-help-tooltip';
    tooltipEl.className = 'editor-help-tooltip';
    tooltipEl.setAttribute('role', 'tooltip');
    tooltipEl.hidden = true;
    document.body.appendChild(tooltipEl);
    return tooltipEl;
  }

  function positionTooltip(trigger) {
    const tip = ensureTooltip();
    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    let top = rect.bottom + margin;
    let left = rect.left;

    tip.hidden = false;
    const tipRect = tip.getBoundingClientRect();

    if (left + tipRect.width > window.innerWidth - margin) {
      left = window.innerWidth - tipRect.width - margin;
    }
    if (left < margin) left = margin;

    if (top + tipRect.height > window.innerHeight - margin) {
      top = rect.top - tipRect.height - margin;
    }

    tip.style.top = `${Math.max(margin, top)}px`;
    tip.style.left = `${left}px`;
  }

  function showTooltip(fieldId, trigger) {
    const text = getText(fieldId);
    if (!text) return;
    const tip = ensureTooltip();
    tip.textContent = text;
    tip.hidden = false;
    tip.classList.add('is-visible');
    positionTooltip(trigger);
    pinnedFieldId = fieldId;
  }

  function hideTooltip(force) {
    if (!tooltipEl) return;
    if (!force && document.body.classList.contains('editor-help-show-all')) return;
    tooltipEl.classList.remove('is-visible');
    tooltipEl.hidden = true;
    pinnedFieldId = null;
  }

  function createTrigger(fieldId) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'editor-help-trigger';
    btn.setAttribute('aria-label', 'Подсказка');
    btn.dataset.helpId = fieldId;
    btn.textContent = '?';

    btn.addEventListener('mouseenter', () => {
      if (!document.body.classList.contains('editor-help-show-all')) {
        showTooltip(fieldId, btn);
      }
    });
    btn.addEventListener('mouseleave', () => {
      if (!document.body.classList.contains('editor-help-show-all') && pinnedFieldId !== fieldId) {
        hideTooltip(true);
      }
    });
    btn.addEventListener('focus', () => showTooltip(fieldId, btn));
    btn.addEventListener('blur', () => {
      if (!document.body.classList.contains('editor-help-show-all')) hideTooltip(true);
    });
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (tooltipEl?.classList.contains('is-visible') && pinnedFieldId === fieldId) {
        hideTooltip(true);
        btn.blur();
      } else {
        showTooltip(fieldId, btn);
      }
    });

    return btn;
  }

  function createInline(fieldId) {
    const div = document.createElement('div');
    div.className = 'editor-help-inline';
    div.dataset.helpId = fieldId;
    div.textContent = getText(fieldId);
    return div;
  }

  function enhanceFormGroup(group) {
    if (group.dataset.helpEnhanced === '1') return;

    const fieldId = resolveFieldId(group);
    if (!fieldId || !getText(fieldId)) return;

    group.dataset.helpEnhanced = '1';
    group.dataset.helpId = fieldId;
    group.classList.add('has-editor-help');

    const label = findLabel(group);
    const trigger = createTrigger(fieldId);
    const inline = createInline(fieldId);

    if (label) {
      label.classList.add('editor-label-with-help');
      if (!label.querySelector('.editor-help-trigger')) {
        label.appendChild(trigger);
      }
    } else {
      const row = document.createElement('div');
      row.className = 'editor-help-orphan-row';
      row.appendChild(trigger);
      const first = group.firstElementChild;
      if (first) group.insertBefore(row, first);
      else group.appendChild(row);
    }

    if (!group.querySelector('.editor-help-inline')) {
      const anchor = group.querySelector('.hint') || group.querySelector('input, select, textarea, .grid-2, .icon-picker-row');
      if (anchor) group.insertBefore(inline, anchor);
      else group.appendChild(inline);
    }
  }

  function enhanceConditionBuilder(builder) {
    if (builder.dataset.helpEnhanced === '1') return;
    const head = builder.querySelector('.cb-head');
    const titleEl = head?.querySelector('strong');
    if (!titleEl) return;

    const title = normalizeLabel(titleEl.textContent);
    let fieldId = null;
    if (title.includes('показать')) fieldId = 'choice-show-if';
    else if (title.includes('скрыть')) fieldId = 'choice-hide-if';
    else if (title.includes('условие')) fieldId = 'condition-appearance';
    else fieldId = LABEL_MAP[title];

    if (!fieldId || !getText(fieldId)) return;

    builder.dataset.helpEnhanced = '1';
    builder.dataset.helpId = fieldId;
    builder.classList.add('has-editor-help');

    if (!titleEl.querySelector('.editor-help-trigger')) {
      titleEl.classList.add('editor-label-with-help');
      titleEl.appendChild(createTrigger(fieldId));
    }

    if (!builder.querySelector('.editor-help-inline')) {
      const inline = createInline(fieldId);
      const body = builder.querySelector('.cb-rules, .cb-empty, .cb-head');
      if (body?.nextSibling) builder.insertBefore(inline, body.nextSibling);
      else builder.appendChild(inline);
    }
  }

  function enhance(root) {
    const scope = root && root.querySelectorAll ? root : document;
    const container = root?.querySelectorAll
      ? root
      : document.querySelector('.main-area') || document;

    container.querySelectorAll('.form-group').forEach(enhanceFormGroup);
    container.querySelectorAll('.condition-builder').forEach(enhanceConditionBuilder);

    if (document.body.classList.contains('editor-help-show-all')) {
      hideTooltip(true);
    }
  }

  let enhanceTimer = null;

  function scheduleEnhance() {
    clearTimeout(enhanceTimer);
    enhanceTimer = setTimeout(() => {
      const active = document.querySelector('.tab-content.active') || document.querySelector('.main-area');
      enhance(active || document);
    }, 60);
  }

  function setShowAll(enabled) {
    document.body.classList.toggle('editor-help-show-all', !!enabled);
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
    } catch (_) { /* ignore */ }

    const btn = document.getElementById('editor-help-show-all-btn');
    if (btn) {
      btn.classList.toggle('is-active', !!enabled);
      btn.setAttribute('aria-pressed', String(!!enabled));
      btn.title = enabled ? 'Скрыть все подсказки' : 'Показать все подсказки';
    }
    scheduleEnhance();
  }

  function toggleShowAll() {
    setShowAll(!document.body.classList.contains('editor-help-show-all'));
  }

  function initShowAllFromStorage() {
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') setShowAll(true);
    } catch (_) { /* ignore */ }
  }

  function triggerHtml(fieldId) {
    if (!fieldId || !getText(fieldId)) return '';
    return `<button type="button" class="editor-help-trigger" data-help-id="${fieldId}" aria-label="Подсказка">?</button>`;
  }

  const EditorHelp = {
    DATA,
    LABEL_MAP,
    normalizeLabel,
    getText,
    triggerHtml,
    enhance,
    scheduleEnhance,
    setShowAll,
    toggleShowAll
  };

  window.EditorHelp = EditorHelp;

  if (typeof Editor !== 'undefined') {
    Editor.helpIcon = (fieldId) => EditorHelp.triggerHtml(fieldId);
    Editor.refreshFieldHelp = () => EditorHelp.enhance(document.querySelector('.tab-content.active'));

    const hook = (name) => {
      const orig = Editor[name];
      if (typeof orig !== 'function') return;
      Editor[name] = function (...args) {
        const out = orig.apply(this, args);
        EditorHelp.scheduleEnhance();
        return out;
      };
    };

    [
      'renderSceneEditor', 'renderSceneList', 'renderAll', 'switchTab',
      'renderQuests', 'renderNPCs', 'renderClasses', 'renderAbilities',
      'renderEnemies', 'renderItems', 'renderProgression', 'renderAudio',
      'renderRecipes', 'renderIngredients', 'renderBalance', 'renderRaces',
      'renderClimate', 'renderTheme', 'renderWorld', 'renderSnippets',
      'renderActions', 'renderReputation', 'renderSceneTemplates',
      'showDashboard', 'renderClassDetail', 'renderGlobalAbilityEditor',
      'renderItemEditor', 'renderEnemyEditor', 'renderNpcEditor'
    ].forEach(hook);
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.editor-help-trigger') && !e.target.closest('#editor-help-tooltip')) {
      if (!document.body.classList.contains('editor-help-show-all')) hideTooltip(true);
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    initShowAllFromStorage();
    scheduleEnhance();

    const btn = document.getElementById('editor-help-show-all-btn');
    if (btn && !btn._helpBound) {
      btn._helpBound = true;
      btn.addEventListener('click', () => EditorHelp.toggleShowAll());
    }

  });

  window.addEventListener('resize', () => {
    const active = document.querySelector('.editor-help-trigger:focus, .editor-help-trigger:hover');
    if (active?.dataset.helpId) positionTooltip(active);
  });
})();
