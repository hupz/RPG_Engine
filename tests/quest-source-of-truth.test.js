#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { console, Math, Date, String, Number, Array, Object, Set, Map, JSON, module: { exports: {} }, exports: {}, window: {} };
vm.createContext(ctx); ctx.window = ctx;
function load(rel) {
  const code = fs.readFileSync(path.join(root, rel), 'utf8');
  vm.runInContext(code + '\nif (typeof ConditionSystem !== "undefined") this.ConditionSystem = ConditionSystem;\nif (typeof QuestRuntime !== "undefined") this.QuestRuntime = QuestRuntime;\nif (typeof QuestEvents !== "undefined") this.QuestEvents = QuestEvents;\nif (typeof QuestTaskRegistry !== "undefined") this.QuestTaskRegistry = QuestTaskRegistry;', ctx, { filename: rel });
}
load('js/quests/task-base.js');
load('js/quests/task-types.js');
load('js/quests/quest-events.js');
load('js/quests/quest-runtime.js');
load('js/conditions.js');
const { QuestRuntime, ConditionSystem } = ctx;
let ok = 0, fail = 0;
function assert(c, m) { if (c) { ok++; console.log('  OK', m); } else { fail++; console.error('  FAIL', m); } }

const engine = {
  data: { quests: { q: { stages: [
    { title: 'A', tasks: [{ id: 't', type: 'TalkToNPC', npcId: 'x' }] },
    { title: 'B', tasks: [{ id: 't2', type: 'ManualAdvance' }] }
  ] } } },
  state: { questProgress: {}, questStages: {}, flags: {}, inventory: [], gold: 0 },
  log() {}, saveGame() {}, applyQuestNpcReputation() {}, applyQuestRewards() {}, awardQuestExp() {}, checkAchievements() {}
};
QuestRuntime.bind(engine);
QuestRuntime.startQuest('q');
QuestRuntime.setStage('q', 1, { silentLog: true });

// Poison legacy — conditions must ignore
engine.state.questStages.q = '0';
engine.state.flags.quest_q = '0';

const cctx = {
  engine,
  flags: engine.state.flags,
  inventory: [],
  gold: 0,
  questProgress: engine.state.questProgress,
  questStages: engine.state.questStages,
  quests: engine.data.quests
};

assert(ConditionSystem.getQuestStageFromCtx(cctx, 'q') === '1', 'stage from Runtime despite poisoned questStages');
assert(ConditionSystem.evaluate({ all: [{ questStage: { questId: 'q', stage: '1' } }] }, cctx) === true, 'showIf stage 1');
assert(ConditionSystem.evaluate({ all: [{ questStage: { questId: 'q', stage: '0' } }] }, cctx) === false, 'showIf stage 0 false');
assert(ConditionSystem.isQuestActiveFromCtx(cctx, 'q') === true, 'active');

QuestRuntime.completeQuest('q', { silentLog: true });
assert(ConditionSystem.isQuestFinishedFromCtx(cctx, 'q') === true, 'finished from Runtime');

// force reopen
QuestRuntime.setStage('q', 0, { force: true, silentLog: true });
assert(QuestRuntime.isActive('q'), 'reopened active');
assert(ConditionSystem.getQuestStageFromCtx(cctx, 'q') === '0', 'stage 0 after force');

console.log('\nResults', ok, 'passed', fail, 'failed');
process.exit(fail ? 1 : 0);
