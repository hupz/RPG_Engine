// ============================================================
// P4.1: Режим истории — StoryWizard (5 шагов) + P3: мастер «Новая история»
// ============================================================
(function attachCampaignWizardAndNpcCard() {
  if (typeof Editor === 'undefined') {
    console.warn('editor-campaign-wizard.js: Editor не определён');
    return;
  }

  const STORY_WIZARD_STORAGE = 'rpg_editor_story_wizard';
  const STORY_WIZARD_VERSION = 1;

  const STORY_WIZARD_STEPS = Object.freeze([
    { id: 'genre', label: 'Жанр и система', skippable: false },
    { id: 'world', label: 'Каркас мира', skippable: false },
    { id: 'heroes', label: 'Герои и NPC', skippable: true },
    { id: 'quest', label: 'Первый квест', skippable: true },
    { id: 'publish', label: 'Проверка и публикация', skippable: false }
  ]);

  function cloneJson(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function createStoryWizardDraft() {
    const preset = (typeof StoryWizardContent !== 'undefined')
      ? StoryWizardContent.getGenrePreset('fantasy')
      : { defaultTitle: 'Моя история' };
    const draft = {
      title: preset.defaultTitle || 'Моя история',
      genre: 'fantasy',
      system: typeof SystemRegistry !== 'undefined' ? SystemRegistry.getDefault() : 'generic',
      heroNote: '',
      projectInitialized: false,
      skeletonId: 'hub_branches',
      worldPreview: null,
      worldApplied: false,
      worldEdited: false,
      worldSceneIds: [],
      worldGeneration: 0,
      skipped: { heroes: false, quest: false }
    };
    if (typeof StoryWizardHeroesQuest !== 'undefined') {
      StoryWizardHeroesQuest.initHeroesQuestDraft(draft);
    }
    return draft;
  }

  function createStoryWizardState(step) {
    return {
      version: STORY_WIZARD_VERSION,
      step: typeof step === 'number' ? step : 0,
      draft: createStoryWizardDraft(),
      createdEntities: { scenes: [], npcs: [], quests: [], enemies: [] },
      startedAt: Date.now()
    };
  }

  const StoryWizardFsm = {
    STORAGE_KEY: STORY_WIZARD_STORAGE,
    STEPS: STORY_WIZARD_STEPS,

    createDraft: createStoryWizardDraft,
    createState: createStoryWizardState,

    isSkippable(stepIndex) {
      const s = STORY_WIZARD_STEPS[stepIndex];
      return !!(s && s.skippable);
    },

    isLastStep(stepIndex) {
      return stepIndex >= STORY_WIZARD_STEPS.length - 1;
    },

    serialize(state) {
      return JSON.stringify(state);
    },

    deserialize(raw) {
      if (!raw) return null;
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!parsed || parsed.version !== STORY_WIZARD_VERSION) return null;
        if (typeof parsed.step !== 'number') return null;
        parsed.draft = Object.assign(createStoryWizardDraft(), parsed.draft || {});
        if (typeof StoryWizardHeroesQuest !== 'undefined') {
          StoryWizardHeroesQuest.initHeroesQuestDraft(parsed.draft);
        }
        parsed.createdEntities = Object.assign(
          { scenes: [], npcs: [], quests: [], enemies: [] },
          parsed.createdEntities || {}
        );
        return parsed;
      } catch (_) {
        return null;
      }
    },

    load(storage) {
      const ls = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
      if (!ls) return null;
      return this.deserialize(ls.getItem(STORY_WIZARD_STORAGE));
    },

    save(state, storage) {
      const ls = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
      if (!ls || !state) return false;
      try {
        ls.setItem(STORY_WIZARD_STORAGE, this.serialize(state));
        return true;
      } catch (_) {
        return false;
      }
    },

    clear(storage) {
      const ls = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
      if (!ls) return;
      ls.removeItem(STORY_WIZARD_STORAGE);
    }
  };

  if (typeof globalThis !== 'undefined') {
    globalThis.StoryWizardFsm = StoryWizardFsm;
  }

  function storyWizardProgressHtml(activeStep) {
    return STORY_WIZARD_STEPS.map((s, i) => {
      const cls = i === activeStep ? ' is-active' : (i < activeStep ? ' is-done' : '');
      return `<span class="sw-step${cls}">${i + 1}. ${Editor.escapeHtml(s.label)}</span>`;
    }).join('<span class="sw-step-sep">→</span>');
  }

  function swContent() {
    return (typeof StoryWizardContent !== 'undefined' ? StoryWizardContent : Editor.StoryWizardContent) || null;
  }

  function swHQ() {
    return (typeof StoryWizardHeroesQuest !== 'undefined' ? StoryWizardHeroesQuest : Editor.StoryWizardHeroesQuest) || null;
  }

  function swPublish() {
    return (typeof StoryWizardPublish !== 'undefined' ? StoryWizardPublish : Editor.StoryWizardPublish) || null;
  }

  function swEntityOptions(editor, kind, filterIds) {
    const data = editor.data || {};
    let map = {};
    if (kind === 'npc') map = data.npcs || {};
    else if (kind === 'item') map = data.items || {};
    else if (kind === 'enemy') map = data.enemies || {};
    else if (kind === 'scene') map = data.scenes || {};
    else if (kind === 'rep') map = data.reputation || {};
    let ids = Object.keys(map);
    if (filterIds) ids = ids.filter((id) => filterIds.includes(id));
    return ids.map((id) => {
      let label = id;
      if (kind === 'scene') label = map[id]?.location || map[id]?.title || id;
      else if (kind === 'rep') label = map[id]?.name || id;
      else label = map[id]?.name || id;
      return { id, label };
    });
  }

  function swSelectHtml(id, options, value) {
    const opts = options.map((o) =>
      `<option value="${Editor.escapeAttr(o.id)}"${String(value) === String(o.id) ? ' selected' : ''}>${Editor.escapeHtml(o.label)}</option>`
    ).join('');
    return `<select id="${Editor.escapeAttr(id)}"><option value="">— выберите —</option>${opts}</select>`;
  }

  function renderWorldPreviewHtml(preview) {
    if (!preview || !preview.scenes) return '<p class="hint">Выберите каркас — появится схема сцен.</p>';
    const lines = preview.edges.map((e) =>
      `<li><span>${Editor.escapeHtml(e.fromLabel)}</span> → <span>${Editor.escapeHtml(e.toLabel)}</span>${e.choice ? ' <em class="hint">(' + Editor.escapeHtml(e.choice) + ')</em>' : ''}</li>`
    ).join('');
    const start = preview.scenes.find((s) => s.id === preview.startSceneId);
    return `<div class="sw-world-preview">
      <p class="hint">Стартовая сцена: <strong>${Editor.escapeHtml(start?.label || preview.startSceneId || '—')}</strong></p>
      <ul class="sw-scene-graph">${lines || '<li>—</li>'}</ul>
    </div>`;
  }

  function renderStoryWizardStepBody(stepIndex, draft) {
    const step = STORY_WIZARD_STEPS[stepIndex];
    const SW = swContent();
    if (!step) return '<p class="hint">Неизвестный шаг</p>';
    if (step.id === 'genre') {
      const genres = SW ? SW.listGenrePresets() : [
        { id: 'fantasy', label: 'Фэнтези' },
        { id: 'horror', label: 'Хоррор' },
        { id: 'detective', label: 'Детектив' },
        { id: 'survival', label: 'Выживание' }
      ];
      const systems = SW ? SW.listSystemOptions() : [
        { id: 'generic', label: 'Универсальные правила' },
        { id: 'dnd5e', label: 'Классические приключения' }
      ];
      const preset = SW ? SW.getGenrePreset(draft.genre) : null;
      const genreOpts = genres.map((g) =>
        `<option value="${Editor.escapeAttr(g.id)}"${draft.genre === g.id ? ' selected' : ''}>${Editor.escapeHtml(g.label)}</option>`
      ).join('');
      const sysOpts = systems.map((s) =>
        `<option value="${Editor.escapeAttr(s.id)}"${draft.system === s.id ? ' selected' : ''}>${Editor.escapeHtml(s.label)}</option>`
      ).join('');
      return `
        <p class="hint">Расскажите, какой мир вы создаёте — движок подготовит основу проекта.</p>
        <div class="form-group"><label>Название истории</label>
          <input type="text" id="sw-title" value="${Editor.escapeAttr(draft.title)}"></div>
        <div class="form-group"><label>Жанр</label>
          <select id="sw-genre">${genreOpts}</select></div>
        <div class="form-group"><label>Правила игры</label>
          <select id="sw-system">${sysOpts}</select></div>
        ${preset ? `<p class="hint sw-genre-blurb">${Editor.escapeHtml(preset.description)}</p>
        <p class="hint">Стартовый запас: ${preset.startingGold} монет, ${preset.startingHp} здоровья — можно изменить позже.</p>` : ''}
        <p class="hint"><button type="button" class="btn btn-link" id="sw-blank-project">Создать пустой проект с нуля…</button></p>`;
    }
    if (step.id === 'world') {
      const skeletons = SW ? SW.listWorldSkeletons() : [];
      const skelId = draft.skeletonId || 'hub_branches';
      const cards = skeletons.map((s) => `
        <label class="sw-skeleton-card${skelId === s.id ? ' is-selected' : ''}">
          <input type="radio" name="sw-skeleton" value="${Editor.escapeAttr(s.id)}"${skelId === s.id ? ' checked' : ''}>
          <strong>${Editor.escapeHtml(s.label)}</strong>
          <span class="hint">${Editor.escapeHtml(s.description)}</span>
        </label>`).join('');
      const preview = draft.worldPreview || null;
      return `
        <p class="hint">Выберите каркас — из готовых шаблонов появятся связанные сцены в духе вашего жанра.</p>
        <div class="sw-skeleton-grid">${cards}</div>
        ${renderWorldPreviewHtml(preview)}
        <button type="button" class="btn btn-secondary" id="sw-regenerate-world">Сгенерировать заново</button>`;
    }
    if (step.id === 'heroes') {
      const HQ = swHQ();
      if (HQ) HQ.initHeroesQuestDraft(draft);
      const roles = HQ ? HQ.listNpcRoles() : [];
      let body = `<p class="hint">Назовите героя и ключевых персонажей — движок создаст записи и реплики.</p>
        <div class="sw-hero-card project-info">
          <h4>🧝 Герой</h4>
          <div class="form-group"><label>Имя</label>
            <input type="text" id="sw-hero-name" value="${Editor.escapeAttr(draft.hero?.name || '')}"></div>
          <div class="form-group"><label>Кратко о герое</label>
            <input type="text" id="sw-hero-desc" value="${Editor.escapeAttr(draft.hero?.description || '')}"></div>
        </div>`;
      (draft.npcs || []).forEach((npc, i) => {
        const phrase = npc.phrase || (HQ ? HQ.defaultPhrase(npc.role) : '');
        const roleOpts = roles.map((r) =>
          `<option value="${Editor.escapeAttr(r.id)}"${npc.role === r.id ? ' selected' : ''}>${Editor.escapeHtml(r.label)}</option>`
        ).join('');
        body += `<div class="sw-npc-card project-info">
          <h4>👤 Персонаж ${i + 1}</h4>
          <div class="form-group"><label>Имя</label>
            <input type="text" id="sw-npc-name-${i}" value="${Editor.escapeAttr(npc.name || '')}"></div>
          <div class="form-group"><label>Роль</label>
            <select id="sw-npc-role-${i}">${roleOpts}</select></div>
          <div class="form-group"><label>Кратко</label>
            <input type="text" id="sw-npc-desc-${i}" value="${Editor.escapeAttr(npc.description || '')}"></div>
          <p class="hint sw-npc-phrase-preview">Реплика: «${Editor.escapeHtml(phrase)}»</p>
        </div>`;
      });
      return body;
    }
    if (step.id === 'quest') {
      const HQ = swHQ();
      if (HQ) HQ.initHeroesQuestDraft(draft);
      const goals = HQ ? HQ.listQuestGoals().filter((g) => g.id !== 'custom' && g.id !== 'mixed') : [];
      const q = draft.quest || {};
      const npcIds = (draft.npcs || []).map((n) => n.id).filter(Boolean);
      const npcOpts = npcIds.length ? swEntityOptions(Editor, 'npc', npcIds) : swEntityOptions(Editor, 'npc');
      let body = `<p class="hint">Что должен сделать игрок? Выберите цель и участников — этапы соберутся сами.</p>
        <div class="form-group"><label>Название задания</label>
          <input type="text" id="sw-quest-title" value="${Editor.escapeAttr(q.title || '')}"></div>
        <div class="sw-quest-goals">`;
      goals.forEach((g) => {
        body += `<label class="sw-quest-goal${q.goal === g.id ? ' is-selected' : ''}">
          <input type="radio" name="sw-quest-goal" value="${Editor.escapeAttr(g.id)}"${q.goal === g.id ? ' checked' : ''}>
          ${g.icon} ${Editor.escapeHtml(g.label)}</label>`;
      });
      body += `</div><div id="sw-quest-details">`;
      const goal = q.goal || 'talk';
      if (goal === 'talk' || goal === 'kill' || goal === 'deliver') {
        body += `<div class="form-group"><label>Персонаж</label>${swSelectHtml('sw-quest-npc', npcOpts, q.npcId)}</div>`;
      }
      if (goal === 'find' || goal === 'collect' || goal === 'deliver') {
        body += `<div class="form-group"><label>Предмет</label>${swSelectHtml('sw-quest-item', swEntityOptions(Editor, 'item'), q.itemId)}</div>`;
      }
      if (goal === 'kill') {
        body += `<div class="form-group"><label>Противник</label>${swSelectHtml('sw-quest-enemy', swEntityOptions(Editor, 'enemy'), q.enemyId)}</div>`;
      }
      if (goal === 'visit') {
        body += `<div class="form-group"><label>Место</label>${swSelectHtml('sw-quest-scene', swEntityOptions(Editor, 'scene', draft.worldSceneIds), q.sceneId)}</div>`;
      }
      body += `</div><div class="sw-reward-section"><h4>Награда</h4>`;
      const rewards = HQ ? HQ.listRewardKinds() : [{ id: 'gold', label: 'Золото' }];
      rewards.forEach((rk) => {
        body += `<label class="sw-reward-kind"><input type="radio" name="sw-reward-kind" value="${Editor.escapeAttr(rk.id)}"${q.rewardKind === rk.id ? ' checked' : ''}> ${Editor.escapeHtml(rk.label)}</label>`;
      });
      body += `<div class="form-group" id="sw-reward-gold-wrap"><label>Сколько золота</label>
        <input type="number" min="0" id="sw-reward-gold" value="${Number(q.rewardGold || 15)}"></div>`;
      body += `<div class="form-group" id="sw-reward-item-wrap"><label>Предмет-награда</label>
        ${swSelectHtml('sw-reward-item', swEntityOptions(Editor, 'item'), q.rewardItemId)}</div>`;
      body += `<div class="form-group" id="sw-reward-rep-wrap"><label>Чья репутация</label>
        ${swSelectHtml('sw-reward-rep', swEntityOptions(Editor, 'rep'), q.rewardRepId)}
        <label>На сколько</label><input type="number" id="sw-reward-rep-amt" value="${Number(q.rewardRepAmount || 5)}"></div>`;
      body += `</div>`;
      return body;
    }
    if (step.id === 'publish') {
      const Pub = swPublish();
      if (!Pub) {
        return `<div class="empty-state"><p class="hint">Модуль публикации не загружен.</p></div>`;
      }
      const report = Pub.buildPublishReport(Editor, draft);
      Editor._storyWizardPublishReport = report;
      return Pub.renderPublishStepHtml(Editor, draft, report);
    }
    return `<div class="empty-state" style="padding:16px;"><p class="hint">Неизвестный шаг мастера.</p></div>`;
  }

  Object.assign(Editor, {
    StoryWizard: StoryWizardFsm,
    _storyWizardState: null,
    _storyWizardPreSnapshot: undefined,

    _readStoryWizardStepForm() {
      const d = this._storyWizardState?.draft;
      if (!d) return;
      const step = STORY_WIZARD_STEPS[this._storyWizardState.step];
      if (!step) return;
      if (step.id === 'genre') {
        d.title = document.getElementById('sw-title')?.value?.trim() || d.title;
        d.genre = document.getElementById('sw-genre')?.value || d.genre;
        d.system = document.getElementById('sw-system')?.value || d.system;
      } else if (step.id === 'world') {
        const picked = document.querySelector('input[name="sw-skeleton"]:checked');
        if (picked) d.skeletonId = picked.value;
      } else if (step.id === 'heroes') {
        if (!d.hero) d.hero = {};
        d.hero.name = document.getElementById('sw-hero-name')?.value?.trim() || d.hero.name;
        d.hero.description = document.getElementById('sw-hero-desc')?.value?.trim() || d.hero.description;
        (d.npcs || []).forEach((npc, i) => {
          npc.name = document.getElementById('sw-npc-name-' + i)?.value?.trim() || npc.name;
          npc.role = document.getElementById('sw-npc-role-' + i)?.value || npc.role;
          npc.description = document.getElementById('sw-npc-desc-' + i)?.value?.trim() || npc.description;
          const HQ = swHQ();
          npc.phrase = HQ ? HQ.defaultPhrase(npc.role) : '';
        });
      } else if (step.id === 'quest') {
        if (!d.quest) d.quest = {};
        const goalEl = document.querySelector('input[name="sw-quest-goal"]:checked');
        if (goalEl) d.quest.goal = goalEl.value;
        d.quest.title = document.getElementById('sw-quest-title')?.value?.trim() || d.quest.title;
        d.quest.npcId = document.getElementById('sw-quest-npc')?.value || d.quest.npcId;
        d.quest.itemId = document.getElementById('sw-quest-item')?.value || d.quest.itemId;
        d.quest.enemyId = document.getElementById('sw-quest-enemy')?.value || d.quest.enemyId;
        d.quest.sceneId = document.getElementById('sw-quest-scene')?.value || d.quest.sceneId;
        const rk = document.querySelector('input[name="sw-reward-kind"]:checked');
        if (rk) d.quest.rewardKind = rk.value;
        d.quest.rewardGold = parseInt(document.getElementById('sw-reward-gold')?.value, 10) || 0;
        d.quest.rewardItemId = document.getElementById('sw-reward-item')?.value || '';
        d.quest.rewardRepId = document.getElementById('sw-reward-rep')?.value || '';
        d.quest.rewardRepAmount = parseInt(document.getElementById('sw-reward-rep-amt')?.value, 10) || 0;
      }
    },

    _refreshStoryWizardWorldPreview() {
      const SW = swContent();
      const d = this._storyWizardState?.draft;
      if (!SW || !d) return null;
      const result = SW.previewWorldSkeleton(d, this);
      if (result?.ok) {
        d.worldPreview = result.preview;
      }
      return result;
    },

    storyWizardRegenerateWorld() {
      const d = this._storyWizardState?.draft;
      if (!d) return;
      if (d.worldEdited) {
        Editor.toast?.warning?.('Вы уже меняли сцены — перегенерация отключена, чтобы не потерять правки.');
        return;
      }
      this._readStoryWizardStepForm();
      if (d.worldApplied && d.worldSceneIds?.length) {
        const SW = swContent();
        if (SW) {
          d.worldSceneIds.forEach((id) => { if (this.data?.scenes) delete this.data.scenes[id]; });
          d.worldApplied = false;
        }
      }
      this._refreshStoryWizardWorldPreview();
      this.renderStoryWizardModal();
      Editor.toast?.info?.('Каркас пересобран — нажмите «Далее», чтобы применить.');
    },

    _commitStoryWizardStep(stepIndex) {
      const step = STORY_WIZARD_STEPS[stepIndex];
      const d = this._storyWizardState?.draft;
      const SW = swContent();
      if (!step || !d) return { ok: false };

      if (step.id === 'genre') {
        if (!d.projectInitialized) {
          if (SW && typeof SW.applyGenrePresetToProject === 'function') {
            const r = SW.applyGenrePresetToProject(this, d);
            if (!r.ok) return r;
          } else {
            return { ok: false, reason: 'no_content_module' };
          }
        } else if (SW) {
          SW.applyGenrePresetToProject(this, d);
        }
        return { ok: true };
      }

      if (step.id === 'world') {
        if (!SW) return { ok: false, reason: 'no_content_module' };
        this._refreshStoryWizardWorldPreview();
        const applied = SW.applyWorldSkeletonToProject(this, d);
        if (!applied.ok) {
          Editor.toast?.error?.('Не удалось собрать каркас мира');
          return applied;
        }
        const vr = SW.validateWorldProject(this);
        if (!vr.ok && !vr.skipped) {
          Editor.toast?.error?.('Каркас не прошёл проверку — сообщите об ошибке разработчикам');
          return { ok: false, validation: vr };
        }
        const ce = this._storyWizardState.createdEntities;
        ce.scenes = [...new Set([...(ce.scenes || []), ...(d.worldSceneIds || [])])];
        return { ok: true };
      }

      if (step.id === 'heroes') {
        const HQ = swHQ();
        if (!HQ) return { ok: false, reason: 'no_heroes_module' };
        const r = HQ.applyHeroesStep(this, d);
        if (!r.ok) {
          Editor.toast?.error?.('Не удалось создать персонажей');
          return r;
        }
        const ce = this._storyWizardState.createdEntities;
        ce.npcs = [...new Set([...(ce.npcs || []), ...(d.createdNpcIds || [])])];
        return { ok: true };
      }

      if (step.id === 'quest') {
        const HQ = swHQ();
        if (!HQ) return { ok: false, reason: 'no_heroes_module' };
        const r = HQ.applyQuestStep(this, d);
        if (!r.ok) {
          Editor.toast?.error?.('Не удалось создать квест');
          return r;
        }
        const ce = this._storyWizardState.createdEntities;
        if (d.questId) ce.quests = [...new Set([...(ce.quests || []), d.questId])];
        const SW = swContent();
        if (SW) {
          const vr = SW.validateWorldProject(this);
          if (!vr.ok && !vr.skipped) {
            Editor.toast?.error?.('Проект не прошёл проверку после квеста');
            return { ok: false, validation: vr };
          }
        }
        return { ok: true };
      }

      return { ok: true, stub: true };
    },

    _hasStoryWizardCreatedEntities() {
      const st = this._storyWizardState;
      if (!st) return false;
      if (st.draft?.projectInitialized) return true;
      const ce = st.createdEntities || {};
      return ['scenes', 'npcs', 'quests', 'enemies'].some((k) => (ce[k] || []).length > 0);
    },

    _rollbackStoryWizardCreated() {
      if (this._storyWizardPreSnapshot !== undefined) {
        this.data = this._storyWizardPreSnapshot
          ? cloneJson(this._storyWizardPreSnapshot)
          : null;
        this.renderAll?.();
        this.updateProjectPanel?.();
        this.updateJSONPreview?.();
        return true;
      }
      const ents = this._storyWizardState?.createdEntities || {};
      let undone = false;
      (ents.scenes || []).slice().reverse().forEach((id) => {
        if (typeof this.deleteScene === 'function') { this.deleteScene(id); undone = true; }
        else if (this.data?.scenes) { delete this.data.scenes[id]; undone = true; }
      });
      ['npcs', 'quests', 'enemies'].forEach((bucket) => {
        (ents[bucket] || []).forEach((id) => {
          if (this.data?.[bucket]) delete this.data[bucket][id];
          undone = true;
        });
      });
      if (undone) {
        this.renderAll?.();
        this.updateJSONPreview?.();
      }
      return undone;
    },

    saveStoryWizardState() {
      if (!this._storyWizardState) return false;
      this._storyWizardState.step = this._storyWizardStep ?? this._storyWizardState.step;
      return StoryWizardFsm.save(this._storyWizardState);
    },

    clearStoryWizardState() {
      StoryWizardFsm.clear();
      this._storyWizardState = null;
      this._storyWizardStep = 0;
      this._storyWizardPreSnapshot = undefined;
    },

    renderStoryWizardModal() {
      let modal = document.getElementById('story-wizard-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'story-wizard-modal';
        modal.className = 'editor-modal';
        document.body.appendChild(modal);
      }
      modal.classList.remove('hidden');
      const st = this._storyWizardState;
      const step = this._storyWizardStep ?? 0;
      const draft = st?.draft || createStoryWizardDraft();
      const isLast = StoryWizardFsm.isLastStep(step);
      const canSkip = StoryWizardFsm.isSkippable(step);
      const progress = `<div class="sw-progress" role="progressbar" aria-valuenow="${step + 1}" aria-valuemin="1" aria-valuemax="${STORY_WIZARD_STEPS.length}">
        <div class="sw-progress-bar" style="width:${Math.round(((step + 1) / STORY_WIZARD_STEPS.length) * 100)}%"></div>
      </div>`;

      modal.innerHTML = `
        <div class="editor-modal-backdrop" onclick="Editor.requestStoryWizardCancel()"></div>
        <div class="editor-modal-panel editor-modal-panel--wide" onclick="event.stopPropagation()">
          <h2>📖 Режим истории</h2>
          ${progress}
          <div class="sw-steps">${storyWizardProgressHtml(step)}</div>
          <div class="sw-body">${renderStoryWizardStepBody(step, draft)}</div>
          <div class="modal-box-footer sw-footer">
            <button type="button" class="btn btn-secondary" onclick="Editor.requestStoryWizardCancel()">Отмена</button>
            ${step > 0 ? '<button type="button" class="btn btn-secondary" onclick="Editor.storyWizardBack()">Назад</button>' : ''}
            ${canSkip && !isLast ? '<button type="button" class="btn btn-secondary" onclick="Editor.storyWizardSkip()">Пропустить</button>' : ''}
            ${isLast
              ? (draft.exportCompleted
                ? '<button type="button" class="btn btn-primary" onclick="Editor.finishStoryWizard()">Закрыть мастер</button>'
                : '<button type="button" class="btn btn-secondary" onclick="Editor.finishStoryWizard()">Завершить без экспорта</button>')
              : '<button type="button" class="btn btn-primary" onclick="Editor.storyWizardNext()">Далее</button>'}
          </div>
        </div>`;

      document.getElementById('sw-blank-project')?.addEventListener('click', () => {
        this.closeStoryWizard(false);
        this.openNewProjectModal?.();
      });
      document.getElementById('sw-regenerate-world')?.addEventListener('click', () => {
        this.storyWizardRegenerateWorld();
      });
      if (typeof document.querySelectorAll === 'function') {
        document.querySelectorAll('input[name="sw-skeleton"]').forEach((el) => {
          el.addEventListener('change', () => {
            this._readStoryWizardStepForm();
            this._refreshStoryWizardWorldPreview();
            this.renderStoryWizardModal();
          });
        });
      }
      if (STORY_WIZARD_STEPS[step]?.id === 'world' && !draft.worldPreview) {
        this._refreshStoryWizardWorldPreview();
      }
      const syncRewardVisibility = () => {
        const kind = document.querySelector('input[name="sw-reward-kind"]:checked')?.value || 'gold';
        const g = document.getElementById('sw-reward-gold-wrap');
        const it = document.getElementById('sw-reward-item-wrap');
        const rp = document.getElementById('sw-reward-rep-wrap');
        if (g) g.style.display = kind === 'gold' ? '' : 'none';
        if (it) it.style.display = kind === 'item' ? '' : 'none';
        if (rp) rp.style.display = kind === 'reputation' ? '' : 'none';
      };
      syncRewardVisibility();
      if (typeof document.querySelectorAll === 'function') {
        document.querySelectorAll('input[name="sw-reward-kind"]').forEach((el) => {
          el.addEventListener('change', syncRewardVisibility);
        });
        document.querySelectorAll('input[name="sw-quest-goal"]').forEach((el) => {
          el.addEventListener('change', () => {
            this._readStoryWizardStepForm();
            this.renderStoryWizardModal();
          });
        });
        document.querySelectorAll('[id^="sw-npc-role-"]').forEach((el) => {
          el.addEventListener('change', () => {
            this._readStoryWizardStepForm();
            this.renderStoryWizardModal();
          });
        });
      }
      if (STORY_WIZARD_STEPS[step]?.id === 'publish') {
        const pubRoot = modal.querySelector('[data-sw-publish]') || modal.querySelector('.sw-publish-success')?.parentElement;
        if (pubRoot) {
          pubRoot.addEventListener('click', (ev) => {
            const rowBtn = ev.target.closest('[data-sw-pub-kind]');
            if (rowBtn) {
              ev.preventDefault();
              const kind = rowBtn.getAttribute('data-sw-pub-kind');
              const idx = parseInt(rowBtn.getAttribute('data-sw-pub-idx'), 10);
              this.storyWizardOpenPublishRow(kind, idx);
              return;
            }
            const actionBtn = ev.target.closest('[data-sw-pub-action]');
            if (actionBtn) {
              ev.preventDefault();
              const action = actionBtn.getAttribute('data-sw-pub-action');
              if (action === 'preview') this.storyWizardPlayPreview();
              else if (action === 'export') this.storyWizardExportHtml();
              else if (action === 'refresh') this.storyWizardRefreshPublish();
              return;
            }
            const gotoBtn = ev.target.closest('[data-sw-pub-goto]');
            if (gotoBtn) {
              ev.preventDefault();
              const level = gotoBtn.getAttribute('data-sw-pub-goto');
              const Pub = swPublish();
              if (Pub) {
                this.closeStoryWizardModal();
                Pub.gotoEditorLevel(this, level);
                Editor.toast?.info?.('Мастер сохранён — продолжите через «Новый проект»');
              }
            }
          });
        }
      }
    },

    closeStoryWizardModal() {
      document.getElementById('story-wizard-modal')?.remove();
    },

    closeStoryWizard(clearState) {
      this.closeStoryWizardModal();
      if (clearState) this.clearStoryWizardState();
    },

    async requestStoryWizardCancel() {
      if (!this._hasStoryWizardCreatedEntities()) {
        this.closeStoryWizard(true);
        return;
      }
      const finishLater = await Editor.confirmDialog({
        message: 'Прервать мастер? Прогресс сохранится — продолжите через «Новый проект».\n\nНажмите «Другое…», чтобы выбрать откат созданного.',
        confirmLabel: 'Завершить позже',
        cancelLabel: 'Другое…'
      });
      if (finishLater) {
        this.saveStoryWizardState();
        this.closeStoryWizard(false);
        Editor.toast?.info?.('Мастер «Режим истории» сохранён — продолжите через «Новый проект»');
        return;
      }
      const undoAvail = typeof EditorHistory !== 'undefined' && EditorHistory.getAvailableUndoSteps?.() > 0;
      if (undoAvail) {
        const rollback = await Editor.confirmDialog({
          message: 'Откатить изменения мастера через историю отмены (undo)?',
          danger: true,
          confirmLabel: 'Откатить',
          cancelLabel: 'Оставить как есть'
        });
        if (rollback) {
          const steps = EditorHistory.getAvailableUndoSteps();
          for (let i = 0; i < steps && EditorHistory.canUndo(); i++) EditorHistory.undo();
          this._rollbackStoryWizardCreated();
          this.closeStoryWizard(true);
          Editor.toast?.success?.('Изменения мастера отменены');
          return;
        }
      } else {
        const keep = await Editor.confirmDialog({
          message: 'История отмены недоступна. Закрыть мастер и оставить созданное в проекте?',
          confirmLabel: 'Закрыть',
          cancelLabel: 'Назад'
        });
        if (keep) {
          this.saveStoryWizardState();
          this.closeStoryWizard(false);
        }
        return;
      }
      this.saveStoryWizardState();
      this.closeStoryWizard(false);
    },

    async openStoryWizard(opts) {
      opts = opts || {};
      const saved = opts.resume ? StoryWizardFsm.load() : null;
      if (!opts.resume && this.data && !(await Editor.confirmDialog({
        message: 'Открыть мастер «Режим истории»? Текущий проект может быть заменён на шаге «Жанр и система».'
      }))) {
        return;
      }
      if (opts.resume && saved) {
        this._storyWizardState = saved;
        this._storyWizardStep = saved.step;
      } else if (saved && !opts.fresh) {
        const cont = await Editor.confirmDialog({
          message: 'Есть незавершённый мастер «Режим истории». Продолжить с шага «' + (STORY_WIZARD_STEPS[saved.step]?.label || '') + '»?',
          confirmLabel: 'Продолжить',
          cancelLabel: 'Начать заново'
        });
        if (cont) {
          this._storyWizardState = saved;
          this._storyWizardStep = saved.step;
        } else {
          StoryWizardFsm.clear();
          this._storyWizardState = createStoryWizardState(0);
          this._storyWizardStep = 0;
          this._storyWizardPreSnapshot = this.data ? cloneJson(this.data) : null;
        }
      } else {
        this._storyWizardState = createStoryWizardState(0);
        this._storyWizardStep = 0;
        this._storyWizardPreSnapshot = this.data ? cloneJson(this.data) : null;
      }
      this.saveStoryWizardState();
      this.renderStoryWizardModal();
    },

    storyWizardNext() {
      this._readStoryWizardStepForm();
      const commit = this._commitStoryWizardStep(this._storyWizardStep);
      if (!commit.ok) {
        Editor.toast?.error?.('Не удалось применить шаг мастера');
        return;
      }
      if (this._storyWizardStep < STORY_WIZARD_STEPS.length - 1) {
        this._storyWizardStep++;
        this._storyWizardState.step = this._storyWizardStep;
        this.saveStoryWizardState();
      }
      this.renderStoryWizardModal();
    },

    storyWizardBack() {
      this._readStoryWizardStepForm();
      if (this._storyWizardStep > 0) {
        this._storyWizardStep--;
        this._storyWizardState.step = this._storyWizardStep;
        this.saveStoryWizardState();
      }
      this.renderStoryWizardModal();
    },

    storyWizardSkip() {
      const step = STORY_WIZARD_STEPS[this._storyWizardStep];
      if (!step?.skippable) return;
      if (step.id === 'heroes') this._storyWizardState.draft.skipped.heroes = true;
      if (step.id === 'quest') this._storyWizardState.draft.skipped.quest = true;
      if (this._storyWizardStep < STORY_WIZARD_STEPS.length - 1) {
        this._storyWizardStep++;
        this._storyWizardState.step = this._storyWizardStep;
        this.saveStoryWizardState();
      }
      this.renderStoryWizardModal();
    },

    storyWizardRefreshPublish() {
      this._readStoryWizardStepForm();
      this.renderStoryWizardModal();
      Editor.toast?.info?.('Отчёт обновлён');
    },

    storyWizardOpenPublishRow(kind, idx) {
      const Pub = swPublish();
      const report = this._storyWizardPublishReport;
      if (!Pub || !report) return;
      this.closeStoryWizardModal();
      Pub.navigatePublishRow(this, report, kind, idx);
      this.saveStoryWizardState();
      Editor.toast?.info?.('Мастер сохранён — откройте «Новый проект», чтобы вернуться к публикации');
    },

    storyWizardPlayPreview() {
      this._readStoryWizardStepForm();
      if (typeof this.previewScene === 'function') {
        this.previewScene({ mode: 'start', previewMode: 'start' });
        return;
      }
      Editor.toast?.warning?.('Превью недоступно — перезагрузите редактор');
    },

    async storyWizardExportHtml() {
      const Pub = swPublish();
      if (!Pub) return;
      this._readStoryWizardStepForm();
      const draft = this._storyWizardState?.draft;
      const report = Pub.buildPublishReport(this, draft);
      this._storyWizardPublishReport = report;
      if (report.exportBlocked) {
        Editor.toast?.warning?.('Сначала исправьте ошибки в отчёте');
        this.renderStoryWizardModal();
        return;
      }
      const exportFn = typeof this._exportHTMLPhaseH === 'function'
        ? this._exportHTMLPhaseH.bind(this)
        : (typeof this.exportHTML === 'function' ? this.exportHTML.bind(this) : null);
      if (!exportFn) {
        Editor.toast?.error?.('Экспорт HTML недоступен');
        return;
      }
      try {
        await exportFn();
        if (draft) {
          draft.exportCompleted = true;
          draft.exportSummary = report.summary;
        }
        this.saveStoryWizardState();
        this.renderStoryWizardModal();
        Editor.toast?.success?.('HTML-файл сохранён');
      } catch (e) {
        console.error('[storyWizardExport]', e);
        Editor.toast?.error?.('Не удалось экспортировать HTML');
      }
    },

    finishStoryWizard() {
      this._readStoryWizardStepForm();
      this._commitStoryWizardStep(this._storyWizardStep);
      this.clearStoryWizardState();
      this.closeStoryWizardModal();
      this._storyWizardPreSnapshot = undefined;
      this._storyWizardPublishReport = undefined;
      if (typeof this.showDashboard === 'function') this.showDashboard();
      Editor.toast?.success?.('Мастер «Режим истории» завершён. Продолжайте наполнять игру в режиме Писателя.');
    },

    resumeStoryWizardIfNeeded() {
      const saved = StoryWizardFsm.load();
      if (!saved || StoryWizardFsm.isLastStep(saved.step)) return;
      this._storyWizardState = saved;
      this._storyWizardStep = saved.step;
      this.renderStoryWizardModal();
      Editor.toast?.info?.('Продолжаем мастер «Режим истории» с шага «' + (STORY_WIZARD_STEPS[saved.step]?.label || '') + '»');
    }
  });

  Object.assign(Editor, {
    _campaignWizardStep: 0,
    _campaignWizardDraft: null,

    async openCampaignWizard() {
      if (this.data && !(await Editor.confirmDialog({ message: 'Создать новую историю? Текущий проект в редакторе будет заменён (файл на диске не трогаем, пока не сохраните).' }))) {
        return;
      }
      this._campaignWizardStep = 0;
      this._campaignWizardDraft = {
        title: 'Моя история',
        heroNote: '',
        scenes: [
          { name: 'Начало', text: 'Вы стоите на пороге приключения.' },
          { name: 'Деревня', text: 'Тихая деревня. Здесь можно найти помощь.' },
          { name: 'Опасное место', text: 'Здесь кто-то или что-то угрожает покою.' }
        ],
        npcName: 'Старейшина',
        npcLine: 'Добро пожаловать, путник. Мне нужна твоя помощь.',
        questTitle: 'Первое задание',
        questHint: 'Поговорите со старейшиной и разберитесь с угрозой.',
        enemyName: 'Разбойник',
        includeCombat: true
      };
      this.renderCampaignWizardModal();
    },

    closeCampaignWizard() {
      document.getElementById('campaign-wizard-modal')?.remove();
      this._campaignWizardDraft = null;
    },

    renderCampaignWizardModal() {
      let modal = document.getElementById('campaign-wizard-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'campaign-wizard-modal';
        modal.className = 'editor-modal';
        document.body.appendChild(modal);
      }
      modal.classList.remove('hidden');
      const d = this._campaignWizardDraft;
      const step = this._campaignWizardStep;
      const steps = ['Название', 'Сцены', 'NPC', 'Квест и бой', 'Готово'];
      const stepsHtml = steps.map((s, i) =>
        `<span class="cw-step${i === step ? ' is-active' : ''}${i < step ? ' is-done' : ''}">${i + 1}. ${this.escapeHtml(s)}</span>`
      ).join('<span class="cw-step-sep">→</span>');

      let body = '';
      if (step === 0) {
        body = `
          <div class="form-group"><label>Название истории</label>
            <input type="text" id="cw-title" value="${this.escapeAttr(d.title)}"></div>
          <div class="form-group"><label>Кратко, о чём игра (для себя)</label>
            <textarea id="cw-note" rows="2">${this.escapeHtml(d.heroNote || '')}</textarea></div>
          <p class="hint">Дальше соберём 3 сцены, NPC, квест и простого врага — без кода.</p>`;
      } else if (step === 1) {
        body = `<p class="hint">Три локации каркаса. Позже добавите ещё на карте сюжета.</p>`;
        d.scenes.forEach((sc, i) => {
          body += `<div class="project-info" style="margin:8px 0;">
            <div class="form-group"><label>Сцена ${i + 1}: название</label>
              <input type="text" id="cw-sc-name-${i}" value="${this.escapeAttr(sc.name)}"></div>
            <div class="form-group"><label>Текст (что видит игрок)</label>
              <textarea id="cw-sc-text-${i}" rows="2">${this.escapeHtml(sc.text)}</textarea></div>
          </div>`;
        });
      } else if (step === 2) {
        body = `
          <p class="hint">Персонаж, с которого начнётся сюжет (обычно в первой или второй сцене).</p>
          <div class="form-group"><label>Имя NPC</label>
            <input type="text" id="cw-npc-name" value="${this.escapeAttr(d.npcName)}"></div>
          <div class="form-group"><label>Первая реплика</label>
            <textarea id="cw-npc-line" rows="2">${this.escapeHtml(d.npcLine)}</textarea></div>`;
      } else if (step === 3) {
        body = `
          <div class="form-group"><label>Название квеста</label>
            <input type="text" id="cw-quest-title" value="${this.escapeAttr(d.questTitle)}"></div>
          <div class="form-group"><label>Что сделать (для журнала)</label>
            <input type="text" id="cw-quest-hint" value="${this.escapeAttr(d.questHint)}"></div>
          <div class="form-group"><label>
            <input type="checkbox" id="cw-combat" ${d.includeCombat ? 'checked' : ''}> Добавить простого врага и сцену боя
          </label></div>
          <div class="form-group"><label>Имя врага</label>
            <input type="text" id="cw-enemy-name" value="${this.escapeAttr(d.enemyName)}"></div>`;
      } else {
        body = `<div class="empty-state" style="padding:20px;">
          <h3>Всё готово к сборке</h3>
          <p class="hint">Будут созданы: проект «${this.escapeHtml(d.title)}», ${d.scenes.length} сцены,
            NPC, квест${d.includeCombat ? ', враг и бой' : ''}.</p>
        </div>`;
      }

      const isLast = step >= 4;
      modal.innerHTML = `
        <div class="editor-modal-backdrop" onclick="Editor.closeCampaignWizard()"></div>
        <div class="editor-modal-panel editor-modal-panel--wide" onclick="event.stopPropagation()">
          <h2>📖 Новая история</h2>
          <div class="cw-steps">${stepsHtml}</div>
          <div class="cw-body">${body}</div>
          <div class="modal-box-footer" style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
            <button type="button" class="btn btn-secondary" onclick="Editor.closeCampaignWizard()">Отмена</button>
            ${step > 0 ? '<button type="button" class="btn btn-secondary" onclick="Editor.campaignWizardBack()">Назад</button>' : ''}
            ${isLast
              ? '<button type="button" class="btn btn-primary" onclick="Editor.finishCampaignWizard()">✨ Создать историю</button>'
              : '<button type="button" class="btn btn-primary" onclick="Editor.campaignWizardNext()">Далее</button>'}
          </div>
        </div>`;
    },

    _readCampaignWizardStep() {
      const d = this._campaignWizardDraft;
      if (!d) return;
      const step = this._campaignWizardStep;
      if (step === 0) {
        d.title = document.getElementById('cw-title')?.value?.trim() || d.title;
        d.heroNote = document.getElementById('cw-note')?.value?.trim() || '';
      } else if (step === 1) {
        d.scenes.forEach((sc, i) => {
          sc.name = document.getElementById('cw-sc-name-' + i)?.value?.trim() || sc.name;
          sc.text = document.getElementById('cw-sc-text-' + i)?.value?.trim() || sc.text;
        });
      } else if (step === 2) {
        d.npcName = document.getElementById('cw-npc-name')?.value?.trim() || d.npcName;
        d.npcLine = document.getElementById('cw-npc-line')?.value?.trim() || d.npcLine;
      } else if (step === 3) {
        d.questTitle = document.getElementById('cw-quest-title')?.value?.trim() || d.questTitle;
        d.questHint = document.getElementById('cw-quest-hint')?.value?.trim() || d.questHint;
        d.includeCombat = !!document.getElementById('cw-combat')?.checked;
        d.enemyName = document.getElementById('cw-enemy-name')?.value?.trim() || d.enemyName;
      }
    },

    campaignWizardNext() {
      this._readCampaignWizardStep();
      if (this._campaignWizardStep < 4) this._campaignWizardStep++;
      this.renderCampaignWizardModal();
    },

    campaignWizardBack() {
      this._readCampaignWizardStep();
      if (this._campaignWizardStep > 0) this._campaignWizardStep--;
      this.renderCampaignWizardModal();
    },

    _slug(name, existing) {
      if (typeof this.slugifyId === 'function') return this.slugifyId(name, '', existing || {});
      return String(name || 'id').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'id';
    },

    finishCampaignWizard() {
      this._readCampaignWizardStep();
      const d = this._campaignWizardDraft;
      if (!d) return;

      // Базовый каркас
      let data;
      if (typeof this.createDnd5eStarterProject === 'function') {
        data = this.createDnd5eStarterProject(d.title, 'dnd5e');
      } else {
        data = {
          meta: { title: d.title, version: '1.0', author: '', description: d.heroNote || '' },
          scenes: {}, npcs: {}, quests: {}, enemies: {}, items: {}, classes: {}
        };
      }
      data.meta = data.meta || {};
      data.meta.title = d.title;
      data.meta.description = d.heroNote || data.meta.description || '';
      data.scenes = {};
      data.npcs = data.npcs || {};
      data.quests = data.quests || {};
      data.enemies = data.enemies || {};

      const sceneIds = [];
      d.scenes.forEach((sc, i) => {
        let id = this._slug(sc.name, data.scenes);
        if (i === 0) id = 'start';
        if (data.scenes[id] && i > 0) id = id + '_' + (i + 1);
        data.scenes[id] = {
          id,
          location: sc.name,
          text: sc.text,
          choices: [],
          dialogue: [],
          editorModules: ['story', 'choices']
        };
        sceneIds.push(id);
      });

      // Цепочка сцен 1→2→3
      for (let i = 0; i < sceneIds.length - 1; i++) {
        const next = sceneIds[i + 1];
        const nextName = data.scenes[next].location;
        data.scenes[sceneIds[i]].choices.push({
          text: 'Идти: ' + nextName,
          to: next,
          icon: '➡️'
        });
      }

      // NPC
      const npcId = this._slug(d.npcName, data.npcs);
      data.npcs[npcId] = {
        id: npcId,
        name: d.npcName,
        icon: '👤',
        description: 'Ключевой персонаж начала истории.',
        location: data.scenes[sceneIds[Math.min(1, sceneIds.length - 1)]]?.location || '',
        attitude: 'friendly',
        dialogues: { default: [{ speaker: d.npcName, text: d.npcLine }] },
        quests: [],
        shop: false
      };

      // Вторая сцена — встреча с NPC
      const hubId = sceneIds[Math.min(1, sceneIds.length - 1)];
      data.scenes[hubId].npcId = npcId;
      data.scenes[hubId].dialogue = [
        { speaker: d.npcName, text: d.npcLine }
      ];
      if (!data.scenes[hubId].editorModules.includes('dialogue')) {
        data.scenes[hubId].editorModules.push('dialogue');
      }
      if (!data.scenes[hubId].editorModules.includes('npc')) {
        data.scenes[hubId].editorModules.push('npc');
      }

      // Квест
      const questId = this._slug(d.questTitle, data.quests);
      data.quests[questId] = {
        id: questId,
        title: d.questTitle,
        stages: [
          {
            id: 'stage_0',
            title: 'Начало',
            hint: d.questHint,
            tasks: [
              { type: 'TalkToNPC', npcId: npcId, description: 'Поговорить с: ' + d.npcName }
            ]
          },
          {
            id: 'stage_1',
            title: 'В пути',
            hint: 'Продолжайте путь по локациям.',
            tasks: [
              { type: 'VisitLocation', sceneId: sceneIds[sceneIds.length - 1], description: 'Дойти до: ' + (data.scenes[sceneIds[sceneIds.length - 1]]?.location || '') }
            ]
          },
          {
            id: 'stage_done',
            title: 'Готово',
            hint: 'Задание выполнено.',
            finish: true,
            tasks: []
          }
        ]
      };
      data.npcs[npcId].quests = [questId];

      // Выбор: принять квест на hub
      data.scenes[hubId].choices = data.scenes[hubId].choices || [];
      data.scenes[hubId].choices.unshift({
        text: 'Принять: ' + d.questTitle,
        to: sceneIds[Math.min(2, sceneIds.length - 1)] || hubId,
        icon: '📜',
        once: true,
        questSet: { questId: questId, stage: '0' }
      });
      if (!data.scenes[hubId].editorModules.includes('quest')) {
        data.scenes[hubId].editorModules.push('quest');
      }

      // Бой
      if (d.includeCombat) {
        const enemyId = this._slug(d.enemyName, data.enemies);
        data.enemies[enemyId] = {
          id: enemyId,
          name: d.enemyName,
          creatureType: 'humanoid',
          hp: 12,
          maxHp: 12,
          ac: 12,
          atkBonus: 2,
          dmgRoll: '1d6',
          dmgBonus: 0,
          dex: 2
        };
        const combatSceneId = 'combat_' + enemyId;
        const afterId = sceneIds[sceneIds.length - 1];
        data.scenes[combatSceneId] = {
          id: combatSceneId,
          location: 'Схватка: ' + d.enemyName,
          text: d.enemyName + ' преграждает путь!',
          combat: [enemyId],
          nextScene: afterId,
          choices: [],
          editorModules: ['story', 'combat']
        };
        // из hub можно пойти в бой
        data.scenes[hubId].choices.push({
          text: 'Столкнуться с: ' + d.enemyName,
          to: combatSceneId,
          icon: '⚔️'
        });
      }

      // Позиции на графе
      if (!data.meta.storyGraph) data.meta.storyGraph = { positions: {} };
      Object.keys(data.scenes).forEach((sid, i) => {
        data.meta.storyGraph.positions[sid] = { x: 40 + (i % 4) * 240, y: 40 + Math.floor(i / 4) * 120 };
      });

      this.data = data;
      this.currentScene = 'start';
      this.editingNpcId = npcId;
      this.editingQuestId = questId;
      this.closeCampaignWizard();
      if (typeof ThemeSystem !== 'undefined') ThemeSystem.ensureInData(this.data);
      if (typeof this.applyThemeFromData === 'function') this.applyThemeFromData();
      this.renderAll();
      this.updateProjectPanel?.();
      this.updateJSONPreview();
      if (typeof this.switchTab === 'function') this.switchTab('scenes');
      Editor.toast.success('История «' + d.title + '» создана. Откройте карту сюжета или превью сцены.');
    },

    // ——— Карточка NPC: где бывает, реплики, квесты ———

    getNpcSceneAppearances(npcId) {
      const out = [];
      Object.entries(this.data?.scenes || {}).forEach(([sid, sc]) => {
        if (sc.npcId === npcId) out.push({ sceneId: sid, reason: 'NPC сцены' });
        (sc.dialogue || []).forEach((line) => {
          if (line && (line.speaker === npcId || line.speaker === this.data.npcs?.[npcId]?.name)) {
            if (!out.some((x) => x.sceneId === sid)) out.push({ sceneId: sid, reason: 'Диалог' });
          }
        });
        (sc.components || []).forEach((c) => {
          const p = c.params || {};
          if (p.npc === npcId || p.merchant === npcId) {
            if (!out.some((x) => x.sceneId === sid)) out.push({ sceneId: sid, reason: 'Компонент' });
          }
        });
      });
      return out;
    },

    renderNpcHubCard(npcId) {
      const n = this.data?.npcs?.[npcId];
      if (!n) return '';
      const places = this.getNpcSceneAppearances(npcId);
      const placesHtml = places.length
        ? places.map((p) => {
          const loc = this.data.scenes[p.sceneId]?.location || p.sceneId;
          return `<button type="button" class="btn btn-secondary btn-sm" style="margin:2px;"
            onclick="Editor.openSceneFromGraph?.(${JSON.stringify(p.sceneId)}) || (Editor.currentScene=${JSON.stringify(p.sceneId)},Editor.switchTab('scenes'),Editor.renderSceneEditor())">
            ${this.escapeHtml(loc)} <span class="hint">(${this.escapeHtml(p.reason)})</span>
          </button>`;
        }).join('')
        : '<p class="hint">Пока нигде не привязан. Укажите NPC на сцене или добавьте ниже.</p>';

      const questIds = Array.isArray(n.quests) ? n.quests : [];
      const allQuests = Object.keys(this.data?.quests || {});
      const questHtml = allQuests.map((qid) => {
        const title = this.data.quests[qid]?.title || qid;
        const checked = questIds.includes(qid) ? 'checked' : '';
        return `<label style="display:block;margin:4px 0;">
          <input type="checkbox" ${checked}
            onchange="Editor.toggleNpcQuest(${JSON.stringify(npcId)},${JSON.stringify(qid)},this.checked)">
          ${this.escapeHtml(title)}
        </label>`;
      }).join('') || '<p class="hint">Квестов пока нет — создайте во вкладке «Квесты».</p>';

      // Простые реплики default
      let lines = n.dialogues?.default;
      if (!Array.isArray(lines)) lines = [];
      const linesHtml = lines.map((line, i) => {
        const text = typeof line === 'string' ? line : (line?.text || '');
        return `<div style="display:flex;gap:6px;margin:4px 0;">
          <input style="flex:1" value="${this.escapeAttr(text)}"
            onchange="Editor.updateNpcDialogueLine(${JSON.stringify(npcId)},${i},this.value)">
          <button type="button" class="btn-remove" onclick="Editor.removeNpcDialogueLine(${JSON.stringify(npcId)},${i})">×</button>
        </div>`;
      }).join('');

      return `
        <div class="npc-hub-card project-info" style="margin-top:14px;">
          <h4>📍 Где встречается</h4>
          <div>${placesHtml}</div>
          <div class="form-group" style="margin-top:8px;"><label>Привязать к сцене</label>
            <select onchange="if(this.value)Editor.attachNpcToScene(${JSON.stringify(npcId)},this.value);this.value='';">
              <option value="">+ сцена…</option>
              ${Object.keys(this.data?.scenes || {}).map((sid) => {
                const loc = this.data.scenes[sid]?.location || sid;
                return `<option value="${this.escapeAttr(sid)}">${this.escapeHtml(loc)}</option>`;
              }).join('')}
            </select>
          </div>
        </div>
        <div class="npc-hub-card project-info" style="margin-top:10px;">
          <h4>💬 Реплики</h4>
          ${linesHtml || '<p class="hint">Нет реплик</p>'}
          <button type="button" class="btn btn-secondary" onclick="Editor.addNpcDialogueLine(${JSON.stringify(npcId)})">+ Реплика</button>
        </div>
        <div class="npc-hub-card project-info" style="margin-top:10px;">
          <h4>📜 Связанные квесты</h4>
          ${questHtml}
        </div>`;
    },

    attachNpcToScene(npcId, sceneId) {
      const sc = this.data?.scenes?.[sceneId];
      if (!sc) return;
      sc.npcId = npcId;
      if (typeof this.ensureSceneEditorModules === 'function') {
        this.ensureSceneEditorModules(sc);
        if (sc.editorModules && !sc.editorModules.includes('npc')) sc.editorModules.push('npc');
      }
      this.updateJSONPreview();
      this.renderNPCs();
    },

    toggleNpcQuest(npcId, questId, on) {
      const n = this.data?.npcs?.[npcId];
      if (!n) return;
      if (!Array.isArray(n.quests)) n.quests = [];
      if (on && !n.quests.includes(questId)) n.quests.push(questId);
      if (!on) n.quests = n.quests.filter((q) => q !== questId);
      this.updateJSONPreview();
    },

    addNpcDialogueLine(npcId) {
      const n = this.data?.npcs?.[npcId];
      if (!n) return;
      if (!n.dialogues) n.dialogues = {};
      if (!Array.isArray(n.dialogues.default)) n.dialogues.default = [];
      n.dialogues.default.push({ speaker: n.name || npcId, text: '' });
      this.renderNPCs();
      this.updateJSONPreview();
    },

    updateNpcDialogueLine(npcId, index, text) {
      const n = this.data?.npcs?.[npcId];
      if (!n?.dialogues?.default?.[index]) return;
      const line = n.dialogues.default[index];
      if (typeof line === 'string') n.dialogues.default[index] = { speaker: n.name, text };
      else line.text = text;
      this.updateJSONPreview();
    },

    removeNpcDialogueLine(npcId, index) {
      const n = this.data?.npcs?.[npcId];
      if (!n?.dialogues?.default) return;
      n.dialogues.default.splice(index, 1);
      this.renderNPCs();
      this.updateJSONPreview();
    }
  });

  // Обогатить карточку NPC
  if (Editor.hooks?.after) {
    Editor.hooks.after('renderNpcDetail', function (html, args) {
      const id = (args && args[0]) || this.editingNpcId;
      return (html || '') + (this.renderNpcHubCard?.(id) || '');
    });
  } else {
    const origNpcDetail = Editor.renderNpcDetail?.bind(Editor);
    if (typeof origNpcDetail === 'function') {
      Editor.renderNpcDetail = function (id) {
        let html = origNpcDetail(id);
        html += this.renderNpcHubCard(id);
        return html;
      };
    }
  }

  // createNPC — по имени
  const origCreateNPC = Editor.createNPC?.bind(Editor);
  if (typeof origCreateNPC === 'function') {
    Editor.createNPC = async function () {
      if (typeof this.promptNameAndId === 'function') {
        this.ensureNpcs?.();
        const r = await this.promptNameAndId({
          namePrompt: 'Имя персонажа:',
          defaultName: 'Новый житель',
          existing: this.data.npcs || {},
          allowEditId: false
        });
        if (!r) return;
        this.data.npcs[r.id] = {
          id: r.id,
          name: r.name,
          location: '',
          icon: '👤',
          description: '',
          dialogues: { default: [] },
          quests: [],
          shop: false,
          attitude: 'neutral'
        };
        this.editingNpcId = r.id;
        this.renderNPCs();
        this.updateJSONPreview();
        return;
      }
      return origCreateNPC();
    };
  }

  // Кнопка мастера в дашборд / тулбар
  const injectCampaignBtn = () => {
    if (document.getElementById('btn-campaign-wizard')) return;
    const hosts = [
      document.getElementById('editor-mode-toggle')?.parentElement,
      document.querySelector('.sidebar-header'),
      document.querySelector('#project-panel')
    ].filter(Boolean);
    const host = hosts[0];
    if (!host) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'btn-campaign-wizard';
    btn.className = 'btn btn-primary';
    btn.style.cssText = 'margin-top:6px;width:100%;';
    btn.textContent = '📖 Быстрая история (классика)';
    btn.onclick = () => Editor.openCampaignWizard();
    host.appendChild(btn);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectCampaignBtn();
      setTimeout(() => Editor.resumeStoryWizardIfNeeded?.(), 300);
    });
  } else {
    setTimeout(() => {
      injectCampaignBtn();
      Editor.resumeStoryWizardIfNeeded?.();
    }, 100);
  }

  if (!document.getElementById('campaign-wizard-styles')) {
    const st = document.createElement('style');
    st.id = 'campaign-wizard-styles';
    st.textContent = `
      .cw-steps { display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin:12px 0; font-size:12px; }
      .cw-step { opacity:0.5; }
      .cw-step.is-active { opacity:1; font-weight:700; color: var(--accent,#8b4513); }
      .cw-step.is-done { opacity:0.85; }
      .cw-step-sep { opacity:0.35; }
      .cw-body { min-height: 120px; }
      #campaign-wizard-modal.editor-modal {
        position:fixed; inset:0; z-index:9999; display:flex; align-items:center; justify-content:center;
        background: rgba(0,0,0,0.45);
      }
      #campaign-wizard-modal .editor-modal-panel {
        background: var(--paper,#f5f0e8); color: var(--ink,#2c2418);
        border-radius:12px; padding:20px; max-width:560px; width:92%; max-height:90vh; overflow:auto;
        position:relative; z-index:1;
      }
      #campaign-wizard-modal .editor-modal-backdrop { position:absolute; inset:0; }
      .npc-hub-card h4 { margin:0 0 8px; }
      .btn-sm { font-size:12px; padding:4px 8px; }
      #story-wizard-modal.editor-modal {
        position:fixed; inset:0; z-index:10000; display:flex; align-items:center; justify-content:center;
        background: rgba(0,0,0,0.45);
      }
      #story-wizard-modal .editor-modal-panel {
        background: var(--paper,#f5f0e8); color: var(--ink,#2c2418);
        border-radius:12px; padding:20px; max-width:600px; width:92%; max-height:90vh; overflow:auto;
        position:relative; z-index:1;
      }
      #story-wizard-modal .editor-modal-backdrop { position:absolute; inset:0; }
      .sw-progress { height:6px; background:rgba(0,0,0,0.08); border-radius:4px; margin:10px 0 12px; overflow:hidden; }
      .sw-progress-bar { height:100%; background:var(--accent,#8b4513); transition:width .2s; }
      .sw-steps { display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin:0 0 12px; font-size:12px; }
      .sw-step { opacity:0.5; }
      .sw-step.is-active { opacity:1; font-weight:700; color: var(--accent,#8b4513); }
      .sw-step.is-done { opacity:0.85; }
      .sw-step-sep { opacity:0.35; }
      .sw-body { min-height: 140px; }
      .sw-footer { display:flex; flex-wrap:wrap; gap:8px; justify-content:flex-end; margin-top:16px; }
      .btn-link { background:none; border:none; color:var(--accent,#8b4513); cursor:pointer; text-decoration:underline; padding:0; font:inherit; }
      .sw-skeleton-grid { display:grid; gap:10px; margin:12px 0; }
      .sw-skeleton-card { display:block; padding:12px; border:2px solid var(--border,#ccc); border-radius:10px; cursor:pointer; }
      .sw-skeleton-card.is-selected { border-color: var(--accent,#8b4513); background: rgba(139,69,19,0.06); }
      .sw-skeleton-card input { margin-right:8px; }
      .sw-skeleton-card strong { display:block; margin-bottom:4px; }
      .sw-world-preview { margin:12px 0; padding:12px; border-radius:8px; background:var(--paper-dark,#f5f0e8); border:1px dashed var(--border,#ccc); }
      .sw-scene-graph { margin:8px 0 0 18px; font-size:14px; }
      .sw-hero-card, .sw-npc-card { margin:10px 0; padding:12px; border-radius:8px; border:1px solid var(--border,#ccc); }
      .sw-quest-goals { display:grid; grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); gap:8px; margin:10px 0; }
      .sw-quest-goal { display:flex; align-items:center; gap:6px; padding:8px; border:2px solid var(--border,#ccc); border-radius:8px; cursor:pointer; }
      .sw-quest-goal.is-selected { border-color:var(--accent,#8b4513); }
      .sw-quest-goal input { margin:0; }
      .sw-reward-section { margin-top:14px; padding-top:10px; border-top:1px dashed var(--border,#ccc); }
      .sw-reward-kind { display:inline-block; margin-right:12px; }
    `;
    document.head.appendChild(st);
  }
})();
