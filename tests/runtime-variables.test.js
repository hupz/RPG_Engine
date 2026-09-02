#!/usr/bin/env node
/**
 * Переменные проекта в рантайме: условия, set_variable, save/load.
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
    removeItem(k) { map.delete(k); }
  };
}

function bootCtx(extra) {
  const ctx = {
    console,
    localStorage: mockStorage(),
    GameEngine: {
      activeCampaignId: 'test',
      state: {
        charName: 'Тест',
        className: 'warrior',
        scene: 'village',
        level: 1,
        hp: 20,
        maxHp: 20,
        gold: 0,
        inventory: [],
        flags: {},
        variables: {},
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
        variables: {
          door_open: { name: 'door_open', defaultValue: false },
          trust_level: { name: 'trust_level', defaultValue: 0 }
        },
        scenes: { village: { id: 'village', title: 'Деревня' } },
        classes: { warrior: { ac: 10, resource: { name: 'Ресурс', max: 2 } } }
      },
      getActiveCampaign() {
        return { saveKey: 'test_save', cacheKey: 'test_data', id: 'test' };
      },
      log() {},
      applyStartingFlags() {
        if (typeof RuntimeVariables !== 'undefined') RuntimeVariables.initFromCatalog(this);
      },
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
      showScene() {},
      getRaceData() { return null; },
      initItemChargesOnAdd() {},
      initProgressionState() {},
      reconcileAbilities() { return []; },
      buildSaveMeta() { return { savedAt: Date.now() }; },
      getActiveSaveSlot() { return 1; },
      setActiveSaveSlot() {},
      getSaveKeyForSlot() { return 'test_save'; },
      getSaveKey() { return 'test_save'; },
      getConditionContext() {
        return {
          flags: { ...(this.state.flags || {}) },
          variables: { ...(this.state.variables || {}) },
          projectVariables: this.data?.variables || {},
          inventory: [...(this.state.inventory || [])],
          gold: this.state.gold ?? 0,
          engine: this
        };
      },
      ...(extra || {})
    },
    QuestRuntime: {
      bind() {},
      serializeAll() { return {}; },
      hydrateFromSave() {},
      _mirrorProgressToLegacyStages() {}
    },
    GameDialogs: { confirm: async () => true }
  };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/project-schema.js'), ctx);
  vm.runInContext(read('js/engine/project-variables.js'), ctx);
  vm.runInContext(read('js/conditions.js') + '\nthis.ConditionSystem = ConditionSystem;', ctx);
  vm.runInContext(read('js/actions/action-registry.js'), ctx);
  vm.runInContext(read('js/engine/save-load.js'), ctx);
  return ctx;
}

// --- Condition evaluation ---
const ctx1 = bootCtx();
const CS = ctx1.ConditionSystem;
const baseCtx = {
  flags: {},
  variables: { door_open: true },
  projectVariables: ctx1.GameEngine.data.variables,
  inventory: [],
  gold: 0
};

assert(
  CS.evaluate({ all: [{ flag: 'door_open', equals: true }] }, baseCtx) === true,
  'condition on variable passes when variables.door_open=true'
);
assert(
  CS.evaluate({ all: [{ flag: 'door_open', equals: true }] }, {
    flags: {},
    variables: {},
    projectVariables: ctx1.GameEngine.data.variables,
    inventory: [],
    gold: 0
  }) === false,
  'condition uses catalog defaultValue=false when unset'
);
assert(
  CS.evaluate({ all: [{ flag: 'door_open', equals: true }] }, {
    flags: { door_open: false },
    variables: { door_open: true },
    projectVariables: ctx1.GameEngine.data.variables,
    inventory: [],
    gold: 0
  }) === false,
  'flag takes priority over variable with same id'
);
assert(
  CS.evaluate({ all: [{ flag: 'unknown_flag', equals: true }] }, {
    flags: {},
    variables: {},
    projectVariables: ctx1.GameEngine.data.variables,
    inventory: [],
    gold: 0
  }) === false,
  'unknown non-catalog flag stays false (legacy behavior)'
);

// --- set_variable action ---
const eng = ctx1.GameEngine;
ctx1.RuntimeVariables.initFromCatalog(eng);
assert(
  ctx1.ACTION_REGISTRY.set_variable.execute(eng, { variable: 'door_open', value: true }),
  'set_variable returns true'
);
assert(eng.state.variables.door_open === true, 'set_variable writes state.variables');

// --- save / load ---
eng.state.variables.trust_level = 7;
const payload = eng.buildSavePayload();
assert(payload.variables && payload.variables.trust_level === 7, 'save payload includes variables');

const eng2 = bootCtx().GameEngine;
ctx1.RuntimeVariables.initFromCatalog(eng2);
ctx1.RuntimeVariables.applyFromSave(eng2, payload.variables);
assert(eng2.state.variables.trust_level === 7, 'applyFromSave restores variables from save');
assert(eng2.state.variables.door_open === true, 'applyFromSave restores saved variable values');

// --- legacy save without variables field ---
const eng3 = bootCtx().GameEngine;
eng3.state.variables = { door_open: false, trust_level: 99 };
ctx1.RuntimeVariables.applyFromSave(eng3, undefined);
assert(eng3.state.variables.door_open === false, 'legacy save: door_open gets catalog default false');
assert(eng3.state.variables.trust_level === 0, 'legacy save: trust_level gets catalog default 0');

// --- validator ---
const valCtx = {
  console: { log() {}, warn() {}, error() {} },
  document: { createElement: () => ({ style: {}, appendChild() {} }), head: { appendChild() {} }, body: { appendChild() {} } },
  Editor: { hooks: { after() {} } },
  ConditionSystem: ctx1.ConditionSystem,
  SEVERITY: { ERROR: 'error', WARNING: 'warning', INFO: 'info' }
};
valCtx.globalThis = valCtx;
valCtx.window = valCtx;
vm.createContext(valCtx);
vm.runInContext(read('js/editor/editor-condition-catalog.js'), valCtx);
vm.runInContext(read('js/editor/editor-project-validator.js'), valCtx);

const badData = {
  startScene: 'village',
  scenes: {
    village: {
      choices: [{
        text: 'x',
        showIf: { all: [{ flag: 'ghost_var', equals: true }] }
      }]
    }
  },
  variables: { door_open: { defaultValue: false } }
};
const report = valCtx.ProjectValidator.validateProject(badData);
const varWarn = (report.issues || []).some(
  (i) => i.type === 'unknown_project_variable' && /ghost_var/.test(i.message)
);
assert(varWarn, 'validator warns on condition referencing missing catalog variable');

console.log('\n' + (failed ? 'FAILED' : 'PASSED') + ': ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
