/**
 * P4.3 — StoryWizard шаги 3–4: герои, NPC, первый квест (без флагов в UI).
 */
(function attachStoryWizardHeroesQuest(global) {
  'use strict';

  function tr(key, params) {
    if (typeof I18n !== 'undefined' && typeof I18n.t === 'function') return I18n.t(key, params);
    if (typeof t === 'function') return t(key, params);
    return key;
  }

  const NPC_ROLE_IDS = Object.freeze(['quest_giver', 'merchant', 'informant', 'antagonist']);

  const NPC_ROLE_ICONS = Object.freeze({
    quest_giver: '📜', merchant: '🛒', informant: '💡', antagonist: '⚔️'
  });

  const REWARD_KIND_IDS = Object.freeze(['gold', 'item', 'reputation']);

  const DEFAULT_NPC_GENRES = Object.freeze(['fantasy', 'horror', 'detective', 'survival']);

  function slugId(editor, name, bucket) {
    if (editor && typeof editor.slugifyId === 'function') {
      return editor.slugifyId(String(name || '').trim(), '', bucket || {});
    }
    return String(name || 'id').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 32) || 'id';
  }

  function localeValue(key) {
    if (typeof I18n !== 'undefined' && I18n._strings) {
      return key.split('.').reduce((o, p) => (o && o[p] !== undefined ? o[p] : undefined), I18n._strings);
    }
    return undefined;
  }

  function defaultNpcsForGenre(genre) {
    const g = DEFAULT_NPC_GENRES.includes(genre) ? genre : 'fantasy';
    const list = localeValue('editor.storyWizard.heroesQuest.defaultNpcs.' + g);
    if (Array.isArray(list)) return JSON.parse(JSON.stringify(list));
    return [
      { name: tr('editor.storyWizard.heroesQuest.defaultNpcs.fantasy.0.name'), role: 'quest_giver', description: tr('editor.storyWizard.heroesQuest.defaultNpcs.fantasy.0.description') },
      { name: tr('editor.storyWizard.heroesQuest.defaultNpcs.fantasy.1.name'), role: 'merchant', description: tr('editor.storyWizard.heroesQuest.defaultNpcs.fantasy.1.description') },
      { name: tr('editor.storyWizard.heroesQuest.defaultNpcs.fantasy.2.name'), role: 'informant', description: tr('editor.storyWizard.heroesQuest.defaultNpcs.fantasy.2.description') }
    ];
  }

  function initHeroesQuestDraft(draft) {
    if (!draft.hero) {
      draft.hero = {
        name: tr('editor.storyWizard.heroesQuest.defaults.heroName'),
        description: tr('editor.storyWizard.heroesQuest.defaults.heroDescription')
      };
    }
    if (!Array.isArray(draft.npcs) || !draft.npcs.length) {
      const genre = draft.genre || 'fantasy';
      draft.npcs = defaultNpcsForGenre(genre);
    }
    if (!draft.quest) {
      draft.quest = {
        goal: 'talk',
        title: tr('editor.storyWizard.heroesQuest.defaults.questTitle'),
        npcId: '',
        itemId: '',
        enemyId: '',
        sceneId: '',
        deliverNpcId: '',
        returnNpcId: '',
        count: 1,
        rewardKind: 'gold',
        rewardGold: draft.metaBalanceGold || 15,
        rewardItemId: '',
        rewardRepId: '',
        rewardRepAmount: 5
      };
    }
    draft.heroesApplied = !!draft.heroesApplied;
    draft.questApplied = !!draft.questApplied;
    draft.createdNpcIds = draft.createdNpcIds || [];
    draft.questId = draft.questId || null;
  }

  function findHubSceneId(data, draft) {
    const scenes = data?.scenes || {};
    const hub = Object.entries(scenes).find(([, s]) => s.sceneType === 'hub');
    if (hub) return hub[0];
    const ids = draft.worldSceneIds || Object.keys(scenes);
    if (ids.length >= 2) return ids[1];
    return data.startScene || ids[0];
  }

  function pickScenesForRoles(data, draft) {
    const ids = draft.worldSceneIds || Object.keys(data.scenes || {});
    const loc = (id) => (data.scenes[id]?.location || '').toLowerCase();
    const find = (re) => ids.find((id) => re.test(loc(id)));
    const hub = findHubSceneId(data, draft);
    return {
      quest_giver: hub,
      merchant: find(/лавк|магазин|таверн|торг|shop/) || ids[Math.min(2, ids.length - 1)] || hub,
      informant: find(/лес|троп|перекр|площад|дорог/) || ids[Math.min(3, ids.length - 1)] || hub,
      antagonist: find(/руин|подвал|болот|опас|темн/) || ids[ids.length - 1] || hub
    };
  }

  function defaultPhrase(role) {
    const key = 'editor.storyWizard.heroesQuest.phrases.' + role;
    const val = tr(key);
    return val === key ? tr('editor.storyWizard.heroesQuest.phrases.fallback') : val;
  }

  function attachNpcToScene(editor, sceneId, npcId, npcName, phrase) {
    const sc = editor.data?.scenes?.[sceneId];
    if (!sc) return;
    sc.npcId = npcId;
    sc.dialogue = [{ speaker: npcName, text: phrase }];
    if (!Array.isArray(sc.editorModules)) sc.editorModules = ['story'];
    ['dialogue', 'npc'].forEach((m) => {
      if (!sc.editorModules.includes(m)) sc.editorModules.push(m);
    });
    if (typeof editor.ensureNpcDialogueScene === 'function') {
      editor.ensureNpcDialogueScene(npcId);
    }
  }

  function removeWizardNpcs(editor, draft) {
    if (!draft.createdNpcIds?.length) return;
    draft.createdNpcIds.forEach((id) => {
      if (editor.data?.npcs) delete editor.data.npcs[id];
    });
    draft.createdNpcIds = [];
  }

  function applyHeroesStep(editor, draft) {
    if (!editor?.data) return { ok: false, reason: 'no_project' };
    initHeroesQuestDraft(draft);
    if (!editor.data.npcs) editor.data.npcs = {};
    if (!editor.data.playerCharacters) editor.data.playerCharacters = {};

    if (draft.heroesApplied) removeWizardNpcs(editor, draft);

    const balance = editor.data.meta?.storyBalance || { gold: 15, hp: 20 };
    const heroName = (draft.hero.name || tr('editor.storyWizard.heroesQuest.defaults.heroName')).trim();
    const heroId = slugId(editor, heroName, editor.data.playerCharacters);
    editor.data.playerCharacters[heroId] = {
      id: heroId,
      name: heroName,
      description: draft.hero.description || '',
      hp: balance.hp || 20,
      startingGold: balance.gold || 15
    };
    draft.heroId = heroId;

    const sceneMap = pickScenesForRoles(editor.data, draft);
    draft.hubSceneId = sceneMap.quest_giver;
    const createdNpcIds = [];

    (draft.npcs || []).forEach((npcDraft) => {
      const name = (npcDraft.name || tr('editor.storyWizard.heroesQuest.defaults.npcFallback')).trim();
      if (!name) return;
      const id = slugId(editor, name, editor.data.npcs);
      const phrase = defaultPhrase(npcDraft.role);
      editor.data.npcs[id] = {
        id,
        name,
        icon: NPC_ROLE_ICONS[npcDraft.role] || '👤',
        description: npcDraft.description || '',
        location: editor.data.scenes[sceneMap[npcDraft.role]]?.location || '',
        attitude: npcDraft.role === 'antagonist' ? 'hostile' : 'friendly',
        dialogues: { default: [{ speaker: name, text: phrase }] },
        quests: [],
        shop: npcDraft.role === 'merchant'
      };
      npcDraft.id = id;
      npcDraft.phrase = phrase;
      createdNpcIds.push(id);

      const sceneId = sceneMap[npcDraft.role];
      if (sceneId) attachNpcToScene(editor, sceneId, id, name, phrase);
    });

    draft.createdNpcIds = createdNpcIds;
    draft.heroesApplied = true;

    if (draft.quest) {
      const giver = draft.npcs.find((n) => n.role === 'quest_giver');
      if (giver?.id && !draft.quest.npcId) draft.quest.npcId = giver.id;
      if (giver?.id && !draft.quest.returnNpcId) draft.quest.returnNpcId = giver.id;
      if (giver?.id && !draft.quest.deliverNpcId) draft.quest.deliverNpcId = giver.id;
    }

    editor.renderAll?.();
    editor.updateJSONPreview?.();
    return { ok: true, npcIds: createdNpcIds, heroId };
  }

  function ensureQuestEntities(editor, draft) {
    const q = draft.quest;
    const genre = draft.genre || 'fantasy';
    if (!editor.data.items) editor.data.items = {};
    if (!editor.data.enemies) editor.data.enemies = {};
    if (!editor.data.reputation) editor.data.reputation = {};

    const itemNames = {
      fantasy: tr('editor.storyWizard.heroesQuest.items.fantasy'),
      horror: tr('editor.storyWizard.heroesQuest.items.horror'),
      detective: tr('editor.storyWizard.heroesQuest.items.detective'),
      survival: tr('editor.storyWizard.heroesQuest.items.survival')
    };
    const enemyNames = {
      fantasy: tr('editor.storyWizard.heroesQuest.enemies.fantasy'),
      horror: tr('editor.storyWizard.heroesQuest.enemies.horror'),
      detective: tr('editor.storyWizard.heroesQuest.enemies.detective'),
      survival: tr('editor.storyWizard.heroesQuest.enemies.survival')
    };

    if (['find', 'collect', 'deliver'].includes(q.goal) && !q.itemId) {
      const iname = itemNames[genre] || tr('editor.storyWizard.heroesQuest.items.fallback');
      const iid = slugId(editor, iname, editor.data.items);
      if (!editor.data.items[iid]) {
        editor.data.items[iid] = { id: iid, name: iname, type: 'misc', desc: iname };
      }
      q.itemId = iid;
    }
    if (q.goal === 'kill' && !q.enemyId) {
      const ename = enemyNames[genre] || tr('editor.storyWizard.heroesQuest.enemies.fallback');
      const eid = slugId(editor, ename, editor.data.enemies);
      if (!editor.data.enemies[eid]) {
        editor.data.enemies[eid] = {
          id: eid, name: ename, hp: 12, maxHp: 12, ac: 12, atkBonus: 2, dmgRoll: '1d6', dmgBonus: 0, dex: 1
        };
      }
      q.enemyId = eid;
    }
    if (q.goal === 'visit' && !q.sceneId) {
      const ids = draft.worldSceneIds || Object.keys(editor.data.scenes || {});
      q.sceneId = ids[ids.length - 1] || editor.data.startScene;
    }
    if (!editor.data.reputation.village) {
      editor.data.reputation.village = { name: tr('editor.storyWizard.heroesQuest.defaults.reputationVillage') };
    }
    if (q.rewardKind === 'reputation' && !q.rewardRepId) {
      q.rewardRepId = 'village';
    }
    if (q.rewardKind === 'item' && !q.rewardItemId) {
      const rid = slugId(editor, tr('editor.storyWizard.heroesQuest.defaults.rewardPlaceholder'), editor.data.items);
      if (!editor.data.items[rid]) {
        editor.data.items[rid] = {
          id: rid,
          name: tr('editor.storyWizard.heroesQuest.defaults.rewardItemName'),
          type: 'misc',
          desc: tr('editor.storyWizard.heroesQuest.defaults.rewardItemDesc')
        };
      }
      q.rewardItemId = rid;
    }
  }

  function buildQuestWizardState(draft, editor) {
    const q = draft.quest || {};
    const giver = (draft.npcs || []).find((n) => n.role === 'quest_giver');
    const balance = editor?.data?.meta?.storyBalance || {};
    return {
      goal: q.goal || 'talk',
      title: q.title || tr('editor.storyWizard.heroesQuest.defaults.questTitle'),
      npcId: q.npcId || giver?.id || '',
      itemId: q.itemId || '',
      enemyId: q.enemyId || '',
      sceneId: q.sceneId || '',
      deliverNpcId: q.deliverNpcId || giver?.id || '',
      returnNpcId: q.returnNpcId || giver?.id || '',
      count: q.count || 1,
      aftermath: 'reward',
      rewards: {
        gold: q.rewardKind === 'gold' ? (q.rewardGold ?? balance.gold ?? 15) : 0,
        exp: 0,
        itemId: q.rewardKind === 'item' ? (q.rewardItemId || '') : '',
        repFlag: q.rewardKind === 'reputation' ? (q.rewardRepId || 'village') : '',
        repAmount: q.rewardKind === 'reputation' ? (q.rewardRepAmount || 5) : 0
      }
    };
  }

  function attachQuestStartChoice(scene, questId, title) {
    if (!scene) return;
    if (!Array.isArray(scene.choices)) scene.choices = [];
    scene.choices = scene.choices.filter((c) => !(c.questSet && c.questSet.questId === questId));
    const dest = scene.choices[0]?.to || scene.id;
    scene.choices.unshift({
      text: tr('editor.storyWizard.heroesQuest.defaults.acceptQuest', {
        title: title || tr('editor.storyWizard.heroesQuest.defaults.acceptQuestFallback')
      }),
      to: dest,
      icon: '📜',
      once: true,
      questSet: { questId, stage: '0' }
    });
    if (!scene.editorModules) scene.editorModules = ['story', 'choices'];
    if (!scene.editorModules.includes('quest')) scene.editorModules.push('quest');
  }

  function removeWizardQuest(editor, draft) {
    if (draft.questId && editor.data?.quests) {
      delete editor.data.quests[draft.questId];
    }
    const hub = editor.data?.scenes?.[draft.hubSceneId];
    if (hub?.choices && draft.questId) {
      hub.choices = hub.choices.filter((c) => !(c.questSet && c.questSet.questId === draft.questId));
    }
  }

  function applyQuestStep(editor, draft) {
    if (!editor?.data) return { ok: false, reason: 'no_project' };
    initHeroesQuestDraft(draft);
    const QW = (typeof QuestWizardApi !== 'undefined' ? QuestWizardApi : Editor.QuestWizardApi);
    if (!QW || typeof QW.buildQuestPayload !== 'function') {
      return { ok: false, reason: 'no_quest_wizard' };
    }

    if (!draft.heroesApplied) {
      const hr = applyHeroesStep(editor, draft);
      if (!hr.ok) return hr;
    }

    ensureQuestEntities(editor, draft);
    if (draft.questApplied) removeWizardQuest(editor, draft);

    const wState = buildQuestWizardState(draft, editor);
    const built = QW.buildQuestPayload(wState);
    if (!built || !built.title) return { ok: false, reason: 'build_failed' };

    if (!editor.data.quests) editor.data.quests = {};
    const base = QW.slugId(built.title);
    const questId = QW.uniqueQuestId(base, editor.data.quests);

    const quest = {
      id: questId,
      title: built.title,
      stages: built.stages,
      hidden: false,
      questFormat: 2,
      rewards: { exp: built.rewards.exp || 0, gold: built.rewards.gold || 0 }
    };
    if (built.rewards.itemId) quest.rewards.items = [built.rewards.itemId];
    if (built.rewards.repFlag && built.rewards.repAmount) {
      quest.rewards.reputation = { [built.rewards.repFlag]: built.rewards.repAmount };
    }

    if (typeof editor.validateQuest === 'function') {
      const report = editor.validateQuest(questId, quest);
      if (report?.errors?.length) return { ok: false, reason: 'validation', errors: report.errors };
    }

    editor.data.quests[questId] = quest;

    const giver = (draft.npcs || []).find((n) => n.role === 'quest_giver');
    if (giver?.id && editor.data.npcs[giver.id]) {
      if (!Array.isArray(editor.data.npcs[giver.id].quests)) editor.data.npcs[giver.id].quests = [];
      if (!editor.data.npcs[giver.id].quests.includes(questId)) {
        editor.data.npcs[giver.id].quests.push(questId);
      }
    }

    const hubId = draft.hubSceneId || findHubSceneId(editor.data, draft);
    attachQuestStartChoice(editor.data.scenes[hubId], questId, built.title);
    draft.hubSceneId = hubId;
    draft.questId = questId;
    draft.questApplied = true;

    editor.renderAll?.();
    editor.updateJSONPreview?.();
    return { ok: true, questId, built };
  }

  function listNpcRoles() {
    return NPC_ROLE_IDS.map((id) => ({
      id,
      label: tr('editor.storyWizard.heroesQuest.roles.' + id),
      icon: NPC_ROLE_ICONS[id]
    }));
  }

  function listRewardKinds() {
    return REWARD_KIND_IDS.map((id) => ({
      id,
      label: tr('editor.storyWizard.heroesQuest.rewards.' + id)
    }));
  }

  function listQuestGoals() {
    const QW = (typeof QuestWizardApi !== 'undefined' ? QuestWizardApi : (typeof Editor !== 'undefined' ? Editor.QuestWizardApi : null));
    return QW ? QW.PLAYER_GOALS.slice() : [];
  }

  const api = {
    NPC_ROLE_IDS,
    NPC_ROLE_ICONS,
    REWARD_KIND_IDS,
    initHeroesQuestDraft,
    applyHeroesStep,
    applyQuestStep,
    listNpcRoles,
    listRewardKinds,
    listQuestGoals,
    defaultPhrase,
    findHubSceneId,
    buildQuestWizardState
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof global !== 'undefined') {
    global.StoryWizardHeroesQuest = api;
  }
  if (typeof Editor !== 'undefined') {
    Editor.StoryWizardHeroesQuest = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global);
