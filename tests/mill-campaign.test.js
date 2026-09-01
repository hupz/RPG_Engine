/**
 * Mill campaign regression — find_albert / lost_bag via QuestRuntime (no QuestSystem).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log('  ✓', msg);
  } else {
    failed++;
    console.error('  ✗', msg);
  }
}

const ctx = {
  console,
  window: {},
  document: {
    getElementById: () => null,
    createElement: () => ({ style: {}, classList: { add() {}, remove() {} }, appendChild() {} }),
    body: { appendChild() {} },
    head: { appendChild() {} },
    addEventListener() {},
    readyState: 'complete'
  },
  localStorage: { getItem: () => null, setItem() {} },
  setTimeout,
  clearTimeout,
  JSON,
  Math,
  Number,
  String,
  Array,
  Object,
  Error,
  Map,
  Set,
  Promise
};
ctx.window = ctx;
vm.createContext(ctx);

function load(rel) {
  vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), ctx, { filename: rel });
}

load('js/quests/task-base.js');
load('js/quests/task-types.js');
load('js/quests/quest-events.js');
load('js/quests/quest-runtime.js');
load('js/quests/quest-migrate.js');
load('js/scene-elements.js');

const { QuestRuntime, QuestEvents, SceneElements } = ctx;
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/game_data.json'), 'utf8'));

assert(data.quests.find_albert && data.quests.find_albert.stages?.length >= 4, 'find_albert quest definition exists');
assert(data.quests.lost_bag && data.quests.lost_bag.stages?.length >= 3, 'lost_bag quest definition exists');
assert(typeof QuestRuntime !== 'undefined' && typeof QuestSystem === 'undefined', 'QuestRuntime present, no QuestSystem');

function makeEngine() {
  const engine = {
    data,
    state: {
      flags: {},
      questStages: {},
      questProgress: {},
      inventory: [],
      gold: 50,
      scene: null,
      sceneVisits: {},
      currentChoices: []
    },
    log() {},
    saveGame() {
      this._save = JSON.parse(JSON.stringify({
        questProgress: this.state.questProgress,
        questStages: this.state.questStages,
        flags: this.state.flags,
        inventory: this.state.inventory,
        scene: this.state.scene,
        sceneVisits: this.state.sceneVisits,
        gold: this.state.gold
      }));
    },
    loadSave() {
      if (!this._save) return;
      Object.assign(this.state, JSON.parse(JSON.stringify(this._save)));
      QuestRuntime.bind(this);
      if (typeof QuestRuntime.hydrateFromSave === 'function') {
        QuestRuntime.hydrateFromSave(this, this.state);
      }
    },
    isQuestFinished(id) {
      QuestRuntime.bind(this);
      return QuestRuntime.isCompleted(id);
    },
    isQuestFailed(id) {
      QuestRuntime.bind(this);
      return QuestRuntime.isFailed(id);
    },
    getQuestStage(id) {
      QuestRuntime.bind(this);
      return QuestRuntime.getStageKey(id);
    },
    updateQuest(questId, stage, opts) {
      QuestRuntime.bind(this);
      QuestRuntime.setStage(questId, stage, opts || {});
    },
    shouldApplyQuestStageUpdate(questId, newStageRef) {
      if (!questId || newStageRef == null || newStageRef === '') return false;
      if (this.isQuestFinished(questId) || this.isQuestFailed(questId)) return false;
      const currentKey = this.getQuestStage(questId);
      if (currentKey == null || currentKey === '') return true;
      const newKey = QuestRuntime.resolveStageRef(this.data.quests[questId], newStageRef);
      if (newKey == null) return true;
      const curNum = Number(currentKey);
      const newNum = Number(newKey);
      if (!Number.isNaN(curNum) && !Number.isNaN(newNum) && newNum < curNum) return false;
      return true;
    },
    applyFlags(flags) {
      if (!flags) return;
      for (const [key, value] of Object.entries(flags)) {
        if (key.startsWith('quest_')) {
          const questId = key.slice(6);
          if (this.shouldApplyQuestStageUpdate(questId, value)) {
            this.updateQuest(questId, value, {});
          }
          continue;
        }
        this.state.flags[key] = value;
      }
    },
    shouldApplySceneRewards(sceneId) {
      return (this.state.sceneVisits?.[sceneId] || 0) === 0;
    },
    /** Mirrors showScene critical path: events + sync flags */
    showScene(sceneId) {
      this.state.scene = sceneId;
      QuestEvents.emit('SceneEntered', { sceneId, scene: sceneId });
      QuestEvents.emit('LocationVisited', { sceneId, scene: sceneId });
      const raw = this.data.scenes[sceneId];
      if (!raw) throw new Error('missing scene ' + sceneId);
      const applyRewards = this.shouldApplySceneRewards(sceneId);
      this.state.sceneVisits[sceneId] = (this.state.sceneVisits[sceneId] || 0) + 1;
      SceneElements.ensureMigrated(raw);
      if (applyRewards && raw.flags) this.applyFlags(raw.flags);
    },
    addItem(id) {
      this.state.inventory.push(id);
      QuestEvents.emit('ItemCollected', { itemId: id, item: id, qty: 1 });
      QuestEvents.emit('InventoryChanged', { itemId: id });
    }
  };
  QuestRuntime.bind(engine);
  return engine;
}

console.log('\n--- find_albert flow ---');
const eng = makeEngine();
eng.showScene('village');
assert(QuestRuntime.getStageKey('find_albert') === '0', 'Start: stage 0 after village');
assert(QuestRuntime.getProgress('find_albert')?.status === 'active', 'Start: quest active');

eng.showScene('village_accept');
assert(QuestRuntime.getStageKey('find_albert') === '1', 'Dialogue/accept: stage 1 (reach_mill)');

eng.showScene('mill_arrival');
assert(Number(QuestRuntime.getStageKey('find_albert')) >= 1, 'Mill visit: stage advanced');
const afterMill = Number(QuestRuntime.getStageKey('find_albert'));
assert(afterMill >= 2, 'Quest progression: stage >= 2 at mill (find_clues)');

eng.showScene('cellar');
assert(Number(QuestRuntime.getStageKey('find_albert')) >= 2, 'Cellar visit progresses clues stage');

eng.showScene('cellar_free');
assert(eng.state.flags.albertSaved === true, 'Rewards flag: albertSaved');
assert(Number(QuestRuntime.getStageKey('find_albert')) >= 3, 'Stage transitions: rescue+');

const journal = QuestRuntime.getJournalEntries();
const fa = journal.find((j) => j.questId === 'find_albert');
assert(!!fa, 'Journal: find_albert entry present');
assert(fa.status === 'active' || fa.status === 'completed', 'Journal: active or completed');

console.log('\n--- save/load mid-quest ---');
eng.saveGame();
const stageBefore = QuestRuntime.getStageKey('find_albert');
const eng2 = makeEngine();
eng2._save = eng._save;
eng2.loadSave();
assert(QuestRuntime.getStageKey('find_albert') === stageBefore, 'Save/Load: stage preserved');
assert(QuestRuntime.getProgress('find_albert')?.status === 'active' || QuestRuntime.isCompleted('find_albert'), 'Save/Load: status ok');

console.log('\n--- lost_bag short path ---');
const eng3 = makeEngine();
eng3.updateQuest('lost_bag', '0');
assert(QuestRuntime.getStageKey('lost_bag') === '0', 'lost_bag starts');
eng3.updateQuest('lost_bag', '1');
eng3.addItem('jack_bag');
QuestEvents.emit('ItemCollected', { itemId: 'jack_bag', item: 'jack_bag', qty: 1 });
eng3.updateQuest('lost_bag', '2');
assert(Number(QuestRuntime.getStageKey('lost_bag')) >= 2, 'lost_bag delivery stage');
eng3.updateQuest('lost_bag', 'complete');
assert(QuestRuntime.isCompleted('lost_bag'), 'lost_bag completion');

console.log('\n--- architecture guards ---');
assert(typeof ctx.QuestSystem === 'undefined', 'No QuestSystem global');
assert(eng.state.questProgress.find_albert != null, 'questProgress is source of truth');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
