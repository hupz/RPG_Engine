// ============================================================
// Мастер создания квестов — UX «Что должен сделать игрок?»
// Пишет Quest → Stage → Task (questFormat: 2). Не меняет QuestRuntime.
// ============================================================
(function attachQuestWizard() {
  'use strict';
  if (typeof Editor === 'undefined') {
    console.error('editor-quest-wizard: Editor missing');
    return;
  }

  /** Варианты ответа на «Что должен сделать игрок?» */
  const PLAYER_GOALS = [
    { id: 'talk', label: 'Поговорить', icon: '💬', desc: 'Поговорить с персонажем', template: 'talk' },
    { id: 'find', label: 'Найти', icon: '🔍', desc: 'Найти предмет или объект', template: 'search' },
    { id: 'collect', label: 'Собрать', icon: '🧺', desc: 'Собрать несколько предметов', template: 'collect' },
    { id: 'deliver', label: 'Доставить', icon: '📦', desc: 'Отнести предмет кому-то', template: 'delivery' },
    { id: 'kill', label: 'Победить', icon: '⚔️', desc: 'Победить врагов', template: 'hunt' },
    { id: 'visit', label: 'Посетить', icon: '🗺️', desc: 'Посетить место', template: 'explore' },
    { id: 'mixed', label: 'Выполнить несколько задач', icon: '🧩', desc: 'Составной квест из этапов', template: 'mixed' },
    { id: 'custom', label: 'Свой вариант', icon: '✏️', desc: 'Пустой квест — настроите сами', template: 'custom' }
  ];

  /** Готовые шаблоны структуры этапов */
  const TEMPLATES = {
    delivery: {
      name: 'Доставка',
      stages: [
        { title: 'Получить', hint: 'Заберите предмет', tasks: [{ type: 'TalkToNPC', description: 'Получить задание' }] },
        { title: 'Доставить', hint: 'Отнесите предмет', tasks: [{ type: 'DeliverItem', count: 1, description: 'Доставить предмет' }] },
        { title: 'Награда', hint: 'Вернитесь за наградой', tasks: [{ type: 'ManualAdvance', description: 'После нажатия «Продолжить»' }], finish: true }
      ]
    },
    hunt: {
      name: 'Охота',
      stages: [
        { title: 'Получить задание', hint: 'Узнайте цель', tasks: [{ type: 'TalkToNPC', description: 'Получить задание' }] },
        { title: 'Победить', hint: 'Сразитесь с врагами', tasks: [{ type: 'KillEnemy', count: 1, description: 'Победить врагов' }] },
        { title: 'Вернуться', hint: 'Доложите о результате', tasks: [{ type: 'TalkToNPC', description: 'Вернуться к заказчику' }] },
        { title: 'Награда', hint: 'Получите награду', tasks: [{ type: 'ManualAdvance', description: 'После нажатия «Продолжить»' }], finish: true }
      ]
    },
    search: {
      name: 'Поиск',
      stages: [
        { title: 'Получить задание', tasks: [{ type: 'TalkToNPC', description: 'Получить задание' }] },
        { title: 'Найти', tasks: [{ type: 'CollectItem', count: 1, description: 'Найти предмет' }] },
        { title: 'Вернуться', tasks: [{ type: 'TalkToNPC', description: 'Вернуться' }], finish: true }
      ]
    },
    collect: {
      name: 'Сбор',
      stages: [
        { title: 'Собрать', tasks: [{ type: 'CollectItem', count: 5, description: 'Собрать предметы' }] },
        { title: 'Завершить', tasks: [{ type: 'ManualAdvance', description: 'После нажатия «Продолжить»' }], finish: true }
      ]
    },
    talk: {
      name: 'Разговор',
      stages: [
        { title: 'Поговорить', tasks: [{ type: 'TalkToNPC', description: 'Поговорить' }] },
        { title: 'Завершить', tasks: [{ type: 'ManualAdvance', description: 'После нажатия «Продолжить»' }], finish: true }
      ]
    },
    explore: {
      name: 'Исследование',
      stages: [
        { title: 'Посетить место', tasks: [{ type: 'VisitLocation', description: 'Посетить место' }] },
        { title: 'Завершить', tasks: [{ type: 'ManualAdvance', description: 'После нажатия «Продолжить»' }], finish: true }
      ]
    },
    mixed: {
      name: 'Смешанный',
      stages: [
        { title: 'Этап 1', tasks: [{ type: 'TalkToNPC', description: 'Начать' }] },
        { title: 'Этап 2', tasks: [{ type: 'CollectItem', count: 1, description: 'Найти предмет' }] }
      ]
    },
    custom: {
      name: 'Свой',
      stages: [
        { title: 'Начало', tasks: [{ type: 'ManualAdvance', description: 'После нажатия «Продолжить»' }] }
      ]
    }
  };

  function slugId(title) {
    let id = String(title || 'quest')
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);
    if (!id || !/^[a-z]/i.test(id)) id = 'quest_' + id;
    id = id.replace(/[^a-z0-9_]/gi, '_') || 'new_quest';
    return id;
  }

  function uniqueQuestId(base, existing) {
    let id = base;
    let n = 2;
    while (existing && existing[id]) {
      id = base + '_' + n;
      n += 1;
    }
    return id;
  }

  function cloneTemplate(templateId) {
    const t = TEMPLATES[templateId] || TEMPLATES.custom;
    return JSON.parse(JSON.stringify(t.stages));
  }

  const defaultState = () => ({
    step: 1, // 1 goal, 2 title, 3 details, 4 aftermath, 5 reward, 6 preview
    goal: 'talk',
    title: '',
    // type-specific fields collected in step 3
    npcId: '',
    itemId: '',
    enemyId: '',
    sceneId: '',
    count: 1,
    deliverNpcId: '',
    returnNpcId: '',
    aftermath: 'complete', // complete | reward | next_stage | dialogue | scene
    aftermathSceneId: '',
    rewards: { gold: 0, exp: 0, itemId: '', repFlag: '', repAmount: 0 }
  });

  Editor._questWizard = null;

  Editor.openQuestWizard = function openQuestWizard() {
    this.ensureQuests();
    this._questWizard = defaultState();
    this.renderQuestWizard();
  };

  Editor.closeQuestWizard = function closeQuestWizard() {
    this._questWizard = null;
    const m = document.getElementById('quest-create-wizard-modal');
    if (m) m.remove();
  };

  Editor.questWizardSet = function questWizardSet(path, value) {
    const w = this._questWizard;
    if (!w) return;
    // Structural fields need a full wizard re-render (layout changes).
    // Text/number fields must NOT destroy the active input — keep focus.
    const STRUCTURAL = {
      goal: true,
      aftermath: true,
      npcId: true,
      itemId: true,
      enemyId: true,
      sceneId: true,
      deliverNpcId: true,
      returnNpcId: true,
      aftermathSceneId: true,
      rewardItem: true,
      rewardRepFlag: true
    };
    if (path === 'title') w.title = value;
    else if (path === 'goal') {
      w.goal = value;
      if (value === 'collect') w.count = 5;
      else if (value === 'kill') w.count = 3;
      else w.count = 1;
    } else if (path === 'npcId') w.npcId = value;
    else if (path === 'itemId') w.itemId = value;
    else if (path === 'enemyId') w.enemyId = value;
    else if (path === 'sceneId') w.sceneId = value;
    else if (path === 'deliverNpcId') w.deliverNpcId = value;
    else if (path === 'returnNpcId') w.returnNpcId = value;
    else if (path === 'count') w.count = Math.max(1, parseInt(value, 10) || 1);
    else if (path === 'aftermath') w.aftermath = value;
    else if (path === 'aftermathSceneId') w.aftermathSceneId = value;
    else if (path === 'rewardGold') w.rewards.gold = parseInt(value, 10) || 0;
    else if (path === 'rewardExp') w.rewards.exp = parseInt(value, 10) || 0;
    else if (path === 'rewardItem') w.rewards.itemId = value;
    else if (path === 'rewardRepFlag') w.rewards.repFlag = value;
    else if (path === 'rewardRepAmount') w.rewards.repAmount = parseInt(value, 10) || 0;

    if (STRUCTURAL[path]) {
      this.renderQuestWizard();
    }
    // else: model updated in place; same DOM inputs keep focus
  };

  Editor.questWizardNext = function questWizardNext() {
    const w = this._questWizard;
    if (!w) return;
    const err = this.questWizardValidateStep(w.step);
    if (err) {
      Editor.toast.warning(err);
      return;
    }
    if (w.step < 6) {
      w.step += 1;
      this.renderQuestWizard();
    }
  };

  Editor.questWizardBack = function questWizardBack() {
    const w = this._questWizard;
    if (!w || w.step <= 1) return;
    w.step -= 1;
    this.renderQuestWizard();
  };

  Editor.questWizardValidateStep = function questWizardValidateStep(step) {
    const w = this._questWizard;
    if (!w) return 'Мастер не открыт';
    if (step === 1) {
      if (!PLAYER_GOALS.some((g) => g.id === w.goal)) return 'Выберите, что должен сделать игрок';
    }
    if (step === 2) {
      if (!String(w.title || '').trim()) return 'Введите название квеста';
    }
    if (step === 3) {
      const g = w.goal;
      if (g === 'talk' && !w.npcId) return 'Выберите, с кем поговорить';
      if ((g === 'find' || g === 'collect') && !w.itemId) return 'Выберите предмет';
      if (g === 'deliver') {
        if (!w.itemId) return 'Выберите, что доставить';
        if (!w.deliverNpcId) return 'Выберите, кому доставить';
      }
      if (g === 'kill' && !w.enemyId) return 'Выберите врага';
      if (g === 'visit' && !w.sceneId) return 'Выберите место';
    }
    if (step === 4 && w.aftermath === 'scene' && !w.aftermathSceneId) {
      return 'Выберите сцену для перехода';
    }
    return null;
  };

  /** Собрать Quest JSON из ответов мастера */
  function buildQuestPayloadFromWizardState(w) {
    if (!w) return null;
    const goal = PLAYER_GOALS.find((g) => g.id === w.goal) || PLAYER_GOALS[0];
    const stages = cloneTemplate(goal.template);
    const count = Math.max(1, parseInt(w.count, 10) || 1);

    stages.forEach((st) => {
      (st.tasks || []).forEach((task) => {
        if (task.type === 'TalkToNPC') {
          const npc = w.returnNpcId || w.npcId || w.deliverNpcId;
          if (npc) task.npcId = npc;
          if (!task.description) task.description = 'Поговорить';
        }
        if (task.type === 'DeliverItem') {
          if (w.itemId) task.itemId = w.itemId;
          if (w.deliverNpcId) task.npcId = w.deliverNpcId;
          task.count = count;
        }
        if (task.type === 'CollectItem') {
          if (w.itemId) task.itemId = w.itemId;
          task.count = count;
        }
        if (task.type === 'KillEnemy') {
          if (w.enemyId) task.enemyId = w.enemyId;
          task.count = count;
        }
        if (task.type === 'VisitLocation') {
          if (w.sceneId) {
            task.sceneId = w.sceneId;
            task.locationId = w.sceneId;
          }
        }
        if (task.type === 'ManualAdvance' && !task.description) {
          task.description = 'После нажатия «Продолжить»';
        }
      });
    });

    if (stages[0] && stages[0].tasks) {
      stages[0].tasks.forEach((task) => {
        if (task.type === 'TalkToNPC' && w.npcId) task.npcId = w.npcId;
      });
    }
    if (w.returnNpcId) {
      stages.forEach((st, i) => {
        if (i === 0) return;
        (st.tasks || []).forEach((task) => {
          if (task.type === 'TalkToNPC') task.npcId = w.returnNpcId;
        });
      });
    }

    if (w.aftermath === 'complete' || w.aftermath === 'reward' || !w.aftermath) {
      if (stages.length) stages[stages.length - 1].finish = true;
    }
    if (w.aftermath === 'next_stage') {
      stages.push({
        title: 'Продолжение',
        tasks: [{ type: 'ManualAdvance', description: 'После нажатия «Продолжить»' }],
        finish: true
      });
    }
    if (w.aftermath === 'dialogue') {
      stages.push({
        title: 'Разговор',
        tasks: [{ type: 'TalkToNPC', npcId: w.npcId || w.deliverNpcId || '', description: 'Поговорить' }],
        finish: true
      });
    }
    if (w.aftermath === 'scene' && w.aftermathSceneId) {
      stages.push({
        title: 'Переход',
        tasks: [{ type: 'VisitLocation', sceneId: w.aftermathSceneId, locationId: w.aftermathSceneId, description: 'Посетить место' }],
        finish: true
      });
    }

    stages.forEach((st, si) => {
      st.id = st.id || ('stage_' + si);
      (st.tasks || []).forEach((task, ti) => {
        task.id = task.id || ('t' + si + '_' + ti);
      });
    });

    return {
      stages,
      rewards: {
        gold: w.rewards?.gold || 0,
        exp: w.rewards?.exp || 0,
        itemId: w.rewards?.itemId || undefined,
        repFlag: w.rewards?.repFlag || '',
        repAmount: w.rewards?.repAmount || 0
      },
      title: String(w.title || '').trim()
    };
  }

  Editor.questWizardBuildQuest = function questWizardBuildQuest() {
    return buildQuestPayloadFromWizardState(this._questWizard);
  };

  Editor.questWizardPreviewText = function questWizardPreviewText() {
    const built = this.questWizardBuildQuest();
    if (!built) return '';
    const lines = [];
    lines.push('«' + built.title + '»');
    lines.push('');
    lines.push('Игрок должен:');
    built.stages.forEach((st, si) => {
      lines.push('');
      lines.push((si + 1) + '. ' + (st.title || ('Этап ' + (si + 1))));
      (st.tasks || []).forEach((task) => {
        const human = typeof this.humanizeQuestTask === 'function'
          ? this.humanizeQuestTask(task)
          : (task.description || 'задача');
        lines.push('   • ' + human);
      });
    });
    lines.push('');
    lines.push('Награда:');
    const parts = [];
    if (built.rewards.gold) parts.push(built.rewards.gold + ' золота');
    if (built.rewards.exp) parts.push(built.rewards.exp + ' опыта');
    if (built.rewards.itemId) {
      const label = typeof this.getEntityLabel === 'function'
        ? this.getEntityLabel('item', built.rewards.itemId)
        : built.rewards.itemId;
      parts.push('предмет: ' + label);
    }
    lines.push(parts.length ? parts.join(', ') : 'без награды');
    return lines.join('\n');
  };

  Editor.questWizardFinish = function questWizardFinish() {
    const w = this._questWizard;
    if (!w) return;
    for (let s = 1; s <= 4; s++) {
      const err = this.questWizardValidateStep(s);
      if (err) {
        w.step = s;
        this.renderQuestWizard();
        Editor.toast.warning(err);
        return;
      }
    }
    const built = this.questWizardBuildQuest();
    if (!built) return;

    this.ensureQuests();
    const base = slugId(built.title);
    const id = uniqueQuestId(base, this.data.quests);

    const quest = {
      id,
      title: built.title,
      stages: built.stages,
      hidden: false,
      rewards: {
        exp: built.rewards.exp || 0,
        gold: built.rewards.gold || 0
      },
      questFormat: 2
    };
    if (built.rewards.itemId) {
      quest.rewards.items = [built.rewards.itemId];
    }
    if (w.rewards.repFlag && w.rewards.repAmount) {
      quest.rewards.reputation = { [w.rewards.repFlag]: w.rewards.repAmount };
    }

    // Final validation via existing validator if present
    if (typeof this.validateQuest === 'function') {
      const report = this.validateQuest(id, quest);
      if (report && report.errors && report.errors.length) {
        Editor.toast.error(report.errors.join('\n'));
        return;
      }
    }

    this.data.quests[id] = quest;
    this.editingQuestId = id;
    this.closeQuestWizard();
    this.renderQuests();
    this.updateJSONPreview?.();
    if (typeof this.validateAllQuests === 'function') this.validateAllQuests();
    if (Editor.toast) Editor.toast.success('Квест «' + built.title + '» создан');
  };

  function entitySelect(editor, kind, value, onchangeAttr) {
    // Reputation still uses plain select
    if (kind === 'rep') {
      const map = (editor.data && editor.data.reputation) || {};
      const opts = Object.keys(map).map((id) => {
        const label = map[id]?.name || id;
        const sel = String(value) === String(id) ? ' selected' : '';
        return `<option value="${editor.escapeAttr(id)}"${sel}>${editor.escapeHtml(label)}</option>`;
      }).join('');
      return `<select onchange="${onchangeAttr}">
        <option value="">— выберите —</option>${opts}
      </select>`;
    }
    if (typeof editor.renderEntityPicker === 'function') {
      const pickKind = kind === 'scene' ? 'scene' : kind;
      return editor.renderEntityPicker({
        kind: pickKind,
        value: value || '',
        onChange: onchangeAttr
      });
    }
    const data = editor.data || {};
    let map = {};
    if (kind === 'npc') map = data.npcs || {};
    else if (kind === 'item') map = data.items || {};
    else if (kind === 'enemy') map = data.enemies || {};
    else if (kind === 'scene') map = data.scenes || {};
    const opts = Object.keys(map).map((id) => {
      let label = id;
      if (kind === 'npc' || kind === 'item' || kind === 'enemy') label = map[id]?.name || id;
      if (kind === 'scene') label = map[id]?.location || map[id]?.title || id;
      const sel = String(value) === String(id) ? ' selected' : '';
      return `<option value="${editor.escapeAttr(id)}"${sel}>${editor.escapeHtml(label)}</option>`;
    }).join('');
    return `<select onchange="${onchangeAttr}">
      <option value="">— выберите —</option>${opts}
    </select>`;
  }

  Editor.renderQuestWizard = function renderQuestWizard() {
    const w = this._questWizard;
    if (!w) return;
    let modal = document.getElementById('quest-create-wizard-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'quest-create-wizard-modal';
      modal.className = 'editor-modal';
      document.body.appendChild(modal);
    }

    const step = w.step;
    const stepsLabel = ['Цель', 'Название', 'Детали', 'После', 'Награда', 'Готово'];
    const progress = stepsLabel.map((lab, i) => {
      const n = i + 1;
      const cls = n === step ? ' active' : (n < step ? ' done' : '');
      return `<span class="qw-step-dot${cls}" title="${this.escapeAttr(lab)}">${n}</span>`;
    }).join('<span class="qw-step-line"></span>');

    let body = '';
    if (step === 1) {
      body = `<h2>Что должен сделать игрок?</h2>
        <p class="hint">Выберите основную цель — мастер соберёт этапы автоматически</p>
        <div class="qw-type-grid">
          ${PLAYER_GOALS.map((g) => `
            <button type="button" class="qw-type-card${w.goal === g.id ? ' selected' : ''}"
              onclick="Editor.questWizardSet('goal', '${g.id}')">
              <span class="qw-type-icon">${g.icon}</span>
              <strong>${this.escapeHtml(g.label)}</strong>
              <span class="hint">${this.escapeHtml(g.desc)}</span>
            </button>`).join('')}
        </div>
        <div class="qw-templates hint" style="margin-top:12px;">
          Готовые схемы: Доставка · Охота · Поиск · Разговор — подставляются по выбранной цели.
        </div>`;
    } else if (step === 2) {
      body = `<h2>Название квеста</h2>
        <p class="hint">Как задание увидит игрок в журнале</p>
        <div class="form-group"><label>Название</label>
          <input value="${this.escapeAttr(w.title)}" placeholder="Например: Посылка для старейшины"
            oninput="Editor.questWizardSet('title', this.value)"></div>`;
    } else if (step === 3) {
      const g = w.goal;
      body = `<h2>Детали задания</h2>`;
      if (g === 'talk') {
        body += `<div class="form-group"><label>С кем поговорить?</label>
          ${entitySelect(this, 'npc', w.npcId, "Editor.questWizardSet('npcId', this.value)")}</div>`;
      } else if (g === 'find' || g === 'collect') {
        body += `<div class="form-group"><label>Какой предмет?</label>
          ${entitySelect(this, 'item', w.itemId, "Editor.questWizardSet('itemId', this.value)")}</div>
          <div class="form-group"><label>Сколько?</label>
            <input type="number" min="1" value="${w.count}" onchange="Editor.questWizardSet('count', this.value)"></div>
          <div class="form-group"><label>У кого получить задание? (необязательно)</label>
          ${entitySelect(this, 'npc', w.npcId, "Editor.questWizardSet('npcId', this.value)")}</div>`;
      } else if (g === 'deliver') {
        body += `<div class="form-group"><label>Что доставить?</label>
          ${entitySelect(this, 'item', w.itemId, "Editor.questWizardSet('itemId', this.value)")}</div>
          <div class="form-group"><label>Кому?</label>
          ${entitySelect(this, 'npc', w.deliverNpcId, "Editor.questWizardSet('deliverNpcId', this.value)")}</div>
          <div class="form-group"><label>Количество</label>
            <input type="number" min="1" value="${w.count}" onchange="Editor.questWizardSet('count', this.value)"></div>
          <div class="form-group"><label>У кого получить посылку? (необязательно)</label>
          ${entitySelect(this, 'npc', w.npcId, "Editor.questWizardSet('npcId', this.value)")}</div>`;
      } else if (g === 'kill') {
        body += `<div class="form-group"><label>Кого победить?</label>
          ${entitySelect(this, 'enemy', w.enemyId, "Editor.questWizardSet('enemyId', this.value)")}</div>
          <div class="form-group"><label>Сколько?</label>
            <input type="number" min="1" value="${w.count}" onchange="Editor.questWizardSet('count', this.value)"></div>
          <div class="form-group"><label>Кто даёт задание?</label>
          ${entitySelect(this, 'npc', w.npcId, "Editor.questWizardSet('npcId', this.value)")}</div>
          <div class="form-group"><label>К кому вернуться?</label>
          ${entitySelect(this, 'npc', w.returnNpcId, "Editor.questWizardSet('returnNpcId', this.value)")}</div>`;
      } else if (g === 'visit') {
        body += `<div class="form-group"><label>Куда пойти?</label>
          ${entitySelect(this, 'scene', w.sceneId, "Editor.questWizardSet('sceneId', this.value)")}</div>`;
      } else {
        body += `<p class="hint">После создания вы сможете добавить задачи в редакторе квеста.
          Используйте понятные кнопки: Поговорить, Собрать, Победить…</p>
          <div class="form-group"><label>Персонаж для старта (необязательно)</label>
          ${entitySelect(this, 'npc', w.npcId, "Editor.questWizardSet('npcId', this.value)")}</div>`;
      }
    } else if (step === 4) {
      const opts = [
        { id: 'complete', label: 'Завершить квест' },
        { id: 'reward', label: 'Дать награду' },
        { id: 'next_stage', label: 'Перейти к следующему этапу' },
        { id: 'dialogue', label: 'Показать диалог' },
        { id: 'scene', label: 'Перейти в другую сцену' }
      ];
      body = `<h2>После выполнения?</h2>
        <p class="hint">Что происходит, когда игрок закончит основные задачи</p>
        <div class="qw-type-grid">
          ${opts.map((o) => `
            <button type="button" class="qw-type-card${w.aftermath === o.id ? ' selected' : ''}"
              onclick="Editor.questWizardSet('aftermath', '${o.id}')">
              <strong>${this.escapeHtml(o.label)}</strong>
            </button>`).join('')}
        </div>
        ${w.aftermath === 'scene' ? `<div class="form-group" style="margin-top:12px;"><label>Какая сцена?</label>
          ${entitySelect(this, 'scene', w.aftermathSceneId, "Editor.questWizardSet('aftermathSceneId', this.value)")}</div>` : ''}`;
    } else if (step === 5) {
      body = `<h2>Награда</h2>
        <div class="form-group"><label>Золото</label>
          <input type="number" min="0" value="${w.rewards.gold}" onchange="Editor.questWizardSet('rewardGold', this.value)"></div>
        <div class="form-group"><label>Опыт</label>
          <input type="number" min="0" value="${w.rewards.exp}" onchange="Editor.questWizardSet('rewardExp', this.value)"></div>
        <div class="form-group"><label>Предмет</label>
          ${entitySelect(this, 'item', w.rewards.itemId, "Editor.questWizardSet('rewardItem', this.value)")}</div>
        <div class="form-group"><label>Репутация (фракция)</label>
          ${entitySelect(this, 'rep', w.rewards.repFlag, "Editor.questWizardSet('rewardRepFlag', this.value)")}</div>
        <div class="form-group"><label>Изменение репутации</label>
          <input type="number" value="${w.rewards.repAmount}" onchange="Editor.questWizardSet('rewardRepAmount', this.value)"></div>`;
    } else if (step === 6) {
      body = `<h2>Предпросмотр</h2>
        <p class="hint">Так квест будет выглядеть для игрока</p>
        <pre class="qw-preview">${this.escapeHtml(this.questWizardPreviewText())}</pre>
        <p class="hint">Нажмите «Создать» — квест появится в списке и его можно донастроить.</p>`;
    }

    const isLast = step >= 6;
    modal.innerHTML = `
      <div class="editor-modal-backdrop" onclick="Editor.closeQuestWizard()"></div>
      <div class="editor-modal-panel qw-panel" style="max-width:560px;max-height:90vh;overflow:auto;">
        <div class="quest-detail-head">
          <div class="qw-progress">${progress}</div>
          <button type="button" class="btn-remove" onclick="Editor.closeQuestWizard()" title="Закрыть">×</button>
        </div>
        <div class="qw-body">${body}</div>
        <div class="qw-footer" style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
          ${step > 1 ? '<button type="button" class="btn btn-secondary" onclick="Editor.questWizardBack()">Назад</button>' : ''}
          ${!isLast
            ? '<button type="button" class="btn btn-primary" onclick="Editor.questWizardNext()">Далее</button>'
            : '<button type="button" class="btn btn-primary" onclick="Editor.questWizardFinish()">Создать</button>'}
        </div>
      </div>`;
    modal.classList.remove('hidden');
    if (typeof this.bindEntityPickers === 'function') this.bindEntityPickers(modal);

    if (!document.getElementById('quest-wizard-styles')) {
      const st = document.createElement('style');
      st.id = 'quest-wizard-styles';
      st.textContent = `
        .qw-type-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:8px; }
        .qw-type-card {
          border:2px solid var(--border,#ccc); border-radius:10px; padding:12px; background:var(--card-bg,#fff);
          cursor:pointer; text-align:left; display:flex; flex-direction:column; gap:4px;
        }
        .qw-type-card.selected { border-color:var(--accent,#8b4513); box-shadow:0 0 0 1px var(--accent,#8b4513); }
        .qw-type-icon { font-size:22px; }
        .qw-progress { display:flex; align-items:center; gap:4px; flex-wrap:wrap; }
        .qw-step-dot {
          width:24px; height:24px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center;
          font-size:12px; background:#ddd; color:#333;
        }
        .qw-step-dot.active { background:var(--accent,#8b4513); color:#fff; }
        .qw-step-dot.done { background:#6a9; color:#fff; }
        .qw-step-line { width:12px; height:2px; background:#ccc; }
        .qw-preview {
          white-space:pre-wrap; background:rgba(0,0,0,0.04); padding:12px; border-radius:8px;
          font-family:inherit; font-size:14px; max-height:280px; overflow:auto;
        }
      `;
      document.head.appendChild(st);
    }
  };

  // Entry: createQuest opens wizard
  const prevCreate = Editor.createQuest?.bind(Editor);
  Editor.createQuest = function createQuest() {
    this.openQuestWizard();
  };
  Editor.createQuestQuick = prevCreate;

  if (Editor.hooks && typeof Editor.hooks.register === 'function') {
    try {
      Editor.hooks.register('editor-quest-wizard', {
        openQuestWizard: Editor.openQuestWizard,
        createQuest: Editor.createQuest
      }, { force: true });
    } catch (e) { /* */ }
  }

  Editor.QuestWizardApi = {
    PLAYER_GOALS,
    buildQuestPayload: buildQuestPayloadFromWizardState,
    slugId,
    uniqueQuestId
  };
  if (typeof globalThis !== 'undefined') {
    globalThis.QuestWizardApi = Editor.QuestWizardApi;
  }
})();
