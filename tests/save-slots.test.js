#!/usr/bin/env node
/**
 * Многослотовые сохранения: изоляция слотов, легаси-сейв, meta поверх payload.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function assert(c, m) {
  if (c) { passed++; console.log('  ✓', m); }
  else { failed++; console.error('  ✗', m); }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function mockStorage() {
  const map = new Map();
  return {
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(k, String(v)); },
    removeItem(k) { map.delete(k); },
    _map: map
  };
}

function makeEngine(local) {
  const ctx = {
    console,
    localStorage: local,
    GameEngine: {
      activeCampaignId: 'melnitsa',
      state: {
        charName: 'Тест',
        className: 'warrior',
        scene: 'village',
        level: 3,
        hp: 20,
        maxHp: 20,
        gold: 5,
        inventory: [],
        flags: {},
        supplies: 0,
        resources: { mode: 'energy', current: 2, max: 2 },
        questStages: {},
        questProgress: {},
        exp: 0,
        expAwarded: {},
        classData: { abilities: [] },
        proficiencies: { skills: [] },
        skills: {},
        skillIncreases: [],
        equipped: {},
        curseEffects: {},
        itemEnhancements: {},
        itemCharges: {},
        favoredEnemyTypes: [],
        sceneVisits: {},
        visitedLocations: {},
        clearedCombats: {},
        achievementUnlocks: {},
        gender: 'male',
        raceKey: '',
        heritageId: '',
        stats: null
      },
      data: {
        meta: { version: '2.0' },
        scenes: {
          village: { id: 'village', title: 'Деревня', location: 'Деревня' }
        },
        classes: { warrior: { ac: 10, resource: { name: 'Ресурс', max: 2 } } }
      },
      getActiveCampaign() {
        return { saveKey: 'melnitsa_save', cacheKey: 'melnitsa_game_data', id: 'melnitsa' };
      },
      log() {},
      applyStartingFlags() {},
      migrateSaveQuestStages() {},
      migrateResourcesState() {},
      migrateClearedCombatsFromSave() {},
      migrateQuestMapUnlocksFromSave() {},
      migrateVisitedLocations() {},
      migrateSuppliesState() {},
      migrateArrowAmmoState() {},
      migrateEquippedSlots() {},
      migrateCurseState() {},
      migrateMillAccessFlag() {},
      migrateAlbertQuestState() {},
      migratePf2eSkillsState() {},
      migrateCraftingState() {},
      migrateFavoredEnemyState() {},
      hideCharacterCreator() {},
      ensurePlayerUIVisible() {},
      setCharName() {},
      renderClassDisplay() {},
      updateUI() {},
      showScene() {},
      getRaceData() { return null; },
      buildRacialAbilities() { return []; },
      reconcileAbilities(a) { return a || []; },
      normalizeAbility(a) { return a; },
      normalizeAbilities(a) { return a || []; },
      recalculateCombatStats() {},
      autoEquipStartingGear() {},
      escapeHtml(s) {
        return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
      }
    },
    GameDialogs: {
      confirm: async () => true
    },
    document: {
      getElementById() { return null; }
    }
  };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/engine/save-load.js'), ctx);
  return ctx.GameEngine;
}

console.log('Save slots — keys and isolation');

{
  const local = mockStorage();
  const eng = makeEngine(local);

  assert(eng.SAVE_SLOTS === 5, 'SAVE_SLOTS is 5');
  assert(eng.getSaveKeyForSlot(1) === 'melnitsa_save', 'slot 1 uses legacy key');
  assert(eng.getSaveKeyForSlot(2) === 'melnitsa_save#slot2', 'slot 2 suffix key');
  assert(eng.getSaveKeyForSlot(5) === 'melnitsa_save#slot5', 'slot 5 suffix key');

  eng.persistSave({ slot: 1, quiet: true });
  eng.state.charName = 'Слот2';
  eng.persistSave({ slot: 2, quiet: true });

  const s1 = JSON.parse(local.getItem('melnitsa_save'));
  const s2 = JSON.parse(local.getItem('melnitsa_save#slot2'));
  assert(s1.charName === 'Тест', 'slot 1 char unchanged after slot 2 save');
  assert(s2.charName === 'Слот2', 'slot 2 has its own charName');
  assert(s1.meta && s1.meta.charName === 'Тест', 'slot 1 meta written');
  assert(s2.meta && s2.meta.charName === 'Слот2', 'slot 2 meta written');
}

console.log('\nSave slots — legacy without meta');

{
  const local = mockStorage();
  const legacy = {
    version: '2.0',
    timestamp: Date.now(),
    charName: 'Легаси',
    className: 'warrior',
    scene: 'village',
    level: 2,
    hp: 10,
    maxHp: 10,
    gold: 0,
    inventory: [],
    flags: {},
    supplies: 0,
    resources: { mode: 'energy', current: 2, max: 2 },
    questStages: {},
    questProgress: {},
    exp: 0,
    expAwarded: {},
    classData: { abilities: [] },
    proficiencies: { skills: [] },
    skills: {},
    skillIncreases: [],
    equipped: {},
    curseEffects: {},
    itemEnhancements: {},
    itemCharges: {},
    favoredEnemyTypes: [],
    sceneVisits: {},
    visitedLocations: {},
    clearedCombats: {},
    achievementUnlocks: {}
  };
  local.setItem('melnitsa_save', JSON.stringify(legacy));

  const eng = makeEngine(local);
  assert(eng.isSaveSlotOccupied(1), 'legacy save occupied slot 1');
  const meta = eng.deriveSaveMeta(legacy);
  assert(meta && meta.charName === 'Легаси', 'deriveSaveMeta from legacy payload');
  assert(meta.sceneName === 'Деревня', 'deriveSaveMeta scene name');
  assert(!legacy.meta, 'legacy object not mutated');

  const ok = eng.loadGame(1);
  assert(ok === true, 'legacy save loads');
  assert(eng.state.charName === 'Легаси', 'legacy charName restored');
}

console.log('\nSave slots — list and active slot');

{
  const local = mockStorage();
  const eng = makeEngine(local);
  eng.persistSave({ slot: 3, quiet: true });
  eng.setActiveSaveSlot(3);
  assert(eng.getSaveKey() === 'melnitsa_save#slot3', 'getSaveKey follows active slot');

  const list = eng.listSaveSlots();
  assert(list.length === 5, 'lists 5 slots');
  assert(list.filter((s) => s.occupied).length === 1, 'one occupied slot');
  assert(list[2].occupied && list[2].slot === 3, 'slot 3 occupied');
}

console.log('\nSave slots — overwrite only target slot');

{
  const local = mockStorage();
  const eng = makeEngine(local);
  eng.persistSave({ slot: 1, quiet: true });
  eng.persistSave({ slot: 2, quiet: true });
  eng.state.charName = 'Перезапись';
  eng.persistSave({ slot: 2, quiet: true });
  const s1 = JSON.parse(local.getItem('melnitsa_save'));
  const s2 = JSON.parse(local.getItem('melnitsa_save#slot2'));
  assert(s1.charName === 'Тест', 'slot 1 intact after slot 2 overwrite');
  assert(s2.charName === 'Перезапись', 'slot 2 overwritten');
}

console.log(`\n---\nPassed: ${passed} Failed: ${failed}`);
process.exit(failed ? 1 : 0);
