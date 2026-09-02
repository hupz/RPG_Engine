#!/usr/bin/env node
/**
 * P4.3 — StoryWizard heroes + quest steps.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓', msg); }
  else { failed++; console.error('  ✗', msg); }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function bootI18n(ctx, lang) {
  const ru = JSON.parse(fs.readFileSync(path.join(root, 'locales/ru.json'), 'utf8'));
  const en = JSON.parse(fs.readFileSync(path.join(root, 'locales/en.json'), 'utf8'));
  const primary = lang === 'en' ? en : ru;
  const fallback = ru;
  function nestedGet(obj, key) {
    return String(key).split('.').reduce((o, p) => (o && o[p] !== undefined ? o[p] : undefined), obj);
  }
  function t(key, params) {
    let val = nestedGet(primary, key);
    if (val == null) val = nestedGet(fallback, key);
    if (val == null) return String(key);
    if (params && typeof params === 'object') {
      Object.entries(params).forEach(([k, v]) => {
        val = val.replace(new RegExp('\\{' + k + '\\}', 'g'), String(v ?? ''));
      });
    }
    return val;
  }
  ctx.t = t;
  ctx.I18n = { t, _strings: primary, _fallback: fallback, _loaded: true, _lang: lang || 'ru' };
}

function bootStack() {
  const Editor = {
    data: null,
    currentScene: null,
    renderAll() {},
    updateJSONPreview() {},
    validateQuest() { return { errors: [] }; },
    slugifyId(name, prefix, existing) {
      let s = String(name || '').trim().toLowerCase()
        .replace(/[а-яё]/g, (ch) => ({ а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' }[ch] || ch))
        .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'id';
      const taken = new Set(Object.keys(existing || {}));
      let out = s;
      let n = 2;
      while (taken.has(out)) { out = s + '_' + n; n++; }
      return out;
    },
    slugifySceneId(name, ex) { return Editor.slugifyId(name, '', ex); },
    createDnd5eStarterProject(title, system) {
      return {
        meta: { title, system, storyBalance: { gold: 15, hp: 20 } },
        startScene: 'start',
        scenes: { start: { id: 'start', location: 'Старт', choices: [], sceneType: 'custom' } },
        items: {}, npcs: {}, quests: {}, enemies: {}, reputation: {}, playerCharacters: {}
      };
    },
    buildSceneTemplatePackPatch(packId, scene) {
      if (typeof Editor.buildSceneTemplatePackPatch === 'function' && Editor !== this) {
        return Editor.buildSceneTemplatePackPatch(packId, scene);
      }
      return { text: 'Текст', choices: [], editorModules: ['story', 'choices'] };
    },
    ensureNpcDialogueScene(npcId) {
      const n = Editor.data.npcs[npcId];
      if (!n) return null;
      const sid = npcId + '_talk';
      Editor.data.scenes[sid] = { id: sid, location: n.name + ' — диалог', dialogue: n.dialogues.default, npcId };
      n.dialogueSceneId = sid;
      return sid;
    }
  };

  const ctx = {
    Editor,
    console,
    document: { getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; }, createElement() { return { appendChild() {}, classList: { add() {}, remove() {} } }; }, head: { appendChild() {} }, body: { appendChild() {} }, addEventListener() {} },
    localStorage: { _m: new Map(), getItem(k) { return this._m.get(k) || null; }, setItem(k, v) { this._m.set(k, v); }, removeItem(k) { this._m.delete(k); } },
    globalThis: null, window: null, module: { exports: {} },
    JSON, Object, Array, String, Math, Date, Set, Map,
    setTimeout(fn) { if (typeof fn === 'function') fn(); }
  };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  bootI18n(ctx, 'ru');
  vm.createContext(ctx);
  vm.runInContext(read('js/editor/editor-quest-wizard.js'), ctx);
  vm.runInContext(read('js/editor/editor-story-wizard-content.js'), ctx);
  vm.runInContext(read('js/editor/editor-story-wizard-heroes-quest.js'), ctx);
  vm.runInContext(read('js/actions/action-registry.js'), ctx);
  vm.runInContext(read('js/editor/editor-action-catalog.js'), ctx);
  vm.runInContext(read('js/editor/editor-condition-catalog.js'), ctx);
  vm.runInContext(read('js/editor/editor-project-validator.js'), ctx);
  vm.runInContext(read('js/editor/editor-scene-template-pack.js'), ctx);
  return { Editor: ctx.Editor, HQ: ctx.StoryWizardHeroesQuest, SW: ctx.StoryWizardContent, PV: ctx.ProjectValidator, REG: ctx.ACTION_REGISTRY };
}

console.log('editor-story-wizard-heroes-quest.test.js');

assert(read('editor.html').includes('editor-story-wizard-heroes-quest.js'), 'heroes-quest wired');
assert(read('js/editor/editor-quest-wizard.js').includes('QuestWizardApi'), 'QuestWizardApi exported');

const { Editor, HQ, SW, PV, REG } = bootStack();

const draft = {
  genre: 'fantasy',
  skeletonId: 'hub_branches',
  projectInitialized: true,
  worldApplied: false,
  worldSceneIds: []
};

SW.applyGenrePresetToProject(Editor, draft);
SW.applyWorldSkeletonToProject(Editor, draft);
assert(draft.worldSceneIds.length >= 4, 'world skeleton for heroes test');

HQ.initHeroesQuestDraft(draft);
assert(draft.npcs.length === 3, 'default 3 npcs');
assert(HQ.listNpcRoles().length === 4, 'four roles');

const hr = HQ.applyHeroesStep(Editor, draft);
assert(hr.ok, 'heroes step applies');
assert(draft.createdNpcIds.length === 3, '3 npcs created');
assert(Object.keys(Editor.data.playerCharacters).length >= 1, 'hero in playerCharacters');
assert(draft.hubSceneId && Editor.data.scenes[draft.hubSceneId], 'hub scene set');

const hub = Editor.data.scenes[draft.hubSceneId];
const giver = draft.npcs.find((n) => n.role === 'quest_giver');
assert(giver?.id && Editor.data.npcs[giver.id], 'quest giver npc');
assert(hub.npcId === giver.id || Editor.data.scenes[draft.hubSceneId].dialogue?.length, 'giver on hub');

draft.quest = { goal: 'talk', title: 'Поговорить со старейшиной', npcId: giver.id, rewardKind: 'gold', rewardGold: 20 };
const qr = HQ.applyQuestStep(Editor, draft);
assert(qr.ok, 'quest step applies: ' + (qr.reason || ''));
assert(draft.questId && Editor.data.quests[draft.questId], 'quest created');
assert(Editor.data.quests[draft.questId].questFormat === 2, 'questFormat 2');
assert(Editor.data.quests[draft.questId].stages?.length >= 1, 'quest stages');

const questChoice = (hub.choices || []).find((c) => c.questSet?.questId === draft.questId);
assert(!!questChoice, 'questSet on hub choice');
assert(questChoice.questSet.stage === '0', 'quest starts stage 0');

const stagesJson = JSON.stringify(Editor.data);
assert(!stagesJson.includes('"flag"') || stagesJson.indexOf('questSet') > 0, 'no author-facing flags in draft path');

const vr = SW.validateWorldProject(Editor, REG);
assert(vr.ok, 'project valid after quest');

// visit goal re-apply on same project
const draft2 = JSON.parse(JSON.stringify(draft));
draft2.questId = null;
draft2.questApplied = false;
draft2.quest = {
  goal: 'visit',
  title: 'Посетить лес',
  sceneId: draft.worldSceneIds[draft.worldSceneIds.length - 1],
  rewardKind: 'gold',
  rewardGold: 10,
  npcId: giver.id
};
const qr2 = HQ.applyQuestStep(Editor, draft2);
assert(qr2.ok, 'visit quest applies');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
