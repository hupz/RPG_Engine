#!/usr/bin/env node
/**
 * Phase 1.14 — Quest Authoring UX
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

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function loadIndex() {
  const ctx = { console, module: { exports: {} }, globalThis: null, window: null };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/editor/editor-quest-authoring-index.js'), ctx);
  return ctx.QuestAuthoringIndex || ctx.module.exports;
}

function loadCatalog() {
  const ctx = { console, module: { exports: {} }, globalThis: null, window: null, ACTION_REGISTRY: null };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/actions/action-registry.js'), ctx);
  vm.runInContext(read('js/editor/editor-action-catalog.js'), ctx);
  return ctx.EditorActionCatalog || {
    getActionMacros: ctx.Editor?.getActionMacros,
    getQuestStageOptions: ctx.Editor?.getActionQuestStageOptions || ctx.getQuestStageOptions,
    getActionDefinition: ctx.Editor?.getActionDefinition,
    ACTION_MACROS: null
  };
}

console.log('Phase 1.14 — QuestRuntime untouched');

{
  // fingerprint: we only assert our modules don't import/rewrite runtime
  const rt = read('js/quests/quest-runtime.js');
  const ux = read('js/editor/editor-quest-authoring-ux-phase-114.js');
  const idx = read('js/editor/editor-quest-authoring-index.js');
  assert(rt.includes('questProgress'), 'questProgress SoT still in runtime');
  assert(!ux.includes('QuestRuntime.startQuest'), 'UX does not call Runtime start');
  assert(!/state\.questProgress|questProgress\s*=/.test(ux), 'UX does not write questProgress');
  assert(read('editor.html').includes('editor-quest-authoring-ux-phase-114.js'), 'ux wired');
  assert(idx.includes('collectQuestUsages'), 'usages helper');
}

console.log('\n1. create quest template');

{
  const IDX = loadIndex();
  const q = IDX.createQuestTemplate('demo_q', 'Demo Quest', 'Help someone', 3);
  assert(q.id === 'demo_q', 'quest id');
  assert(q.title === 'Demo Quest', 'title');
  assert(q.stages.length === 3, 'stages count');
  assert(IDX.validateQuestShape(q), 'shape valid');
  assert(q.stages[2].finish === true, 'last stage finish');
}

console.log('\n2. stages / overview');

{
  const IDX = loadIndex();
  const q = IDX.createQuestTemplate('q1', 'Title', '', 2);
  const flow = IDX.buildQuestFlowSummary(q);
  assert(flow.length === 2, 'flow stages');
  assert(flow[0].title, 'stage labels');
  const data = { quests: { q1: q }, scenes: {} };
  const row = IDX.buildQuestOverviewEntry('q1', q, data);
  assert(row.id === 'q1' && row.title === 'Title', 'overview title/id');
  assert(row.stageCount === 2, 'overview stages');
  assert(row.status === 'authored' || row.status === 'draft', 'overview status');
}

console.log('\n3. reorder (existing API still present)');

{
  const questsSrc = read('js/editor/editor-quests.js');
  assert(questsSrc.includes('moveQuestStage'), 'moveQuestStage exists');
  const dnd = read('js/editor/editor-quest-dnd.js');
  assert(dnd.includes('moveQuestStage'), 'dnd reorder uses moveQuestStage');
}

console.log('\n4. quest picker / stage picker');

{
  const ctx = { console, module: { exports: {} }, globalThis: null, window: null };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/actions/action-registry.js'), ctx);
  vm.runInContext(read('js/editor/editor-action-catalog.js'), ctx);
  const cat = ctx.EditorActionCatalog;
  assert(!!cat, 'catalog loaded');
  const def = cat.getActionDefinition('update_quest');
  assert(def && def.params.some((p) => p.type === 'quest'), 'quest picker param');
  assert(def.params.some((p) => p.type === 'questStage'), 'stage picker param');

  const data = {
    quests: {
      herb: {
        title: 'Herbs',
        stages: [
          { id: 'a', title: 'Find' },
          { id: 'b', title: 'Return', finish: true }
        ]
      }
    }
  };
  const stages = cat.getQuestStageOptions('herb', data);
  assert(stages.some((s) => s.id === '0'), 'stage index 0');
  assert(stages.some((s) => s.id === '1'), 'stage index 1');
  assert(stages.some((s) => s.id === 'complete'), 'complete in picker');
  assert(stages.some((s) => s.id === 'failed'), 'failed in picker');
}

console.log('\n5. action JSON compatibility (presets → update_quest)');

{
  const IDX = loadIndex();
  const presets = IDX.getQuestActionPresets();
  assert(presets.length === 3, 'three presets');
  const start = presets.find((p) => p.id === 'quest_start');
  const adv = presets.find((p) => p.id === 'quest_advance');
  const done = presets.find((p) => p.id === 'quest_complete');
  assert(start.steps[0].action === 'update_quest' && start.steps[0].params.stage === '0', 'Start → stage 0');
  assert(adv.steps[0].action === 'update_quest', 'Advance → update_quest');
  assert(done.steps[0].params.stage === 'complete', 'Complete → complete');

  const ctx = { console, module: { exports: {} }, globalThis: null, window: null };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/actions/action-registry.js'), ctx);
  assert(!!ctx.ACTION_REGISTRY.update_quest, 'registry has update_quest');
  assert(typeof ctx.ACTION_REGISTRY.update_quest.execute === 'function', 'execute intact');

  const macros = ctx.EditorActionCatalog
    ? null
    : null;
  vm.runInContext(read('js/editor/editor-action-catalog.js'), ctx);
  const m = ctx.EditorActionCatalog.getActionMacros();
  assert(m.some((x) => x.id === 'quest_start'), 'macro quest_start');
  assert(m.some((x) => x.id === 'quest_complete'), 'macro quest_complete');
  m.filter((x) => x.id.indexOf('quest_') === 0).forEach((mac) => {
    mac.steps.forEach((s) => {
      assert(s.action === 'update_quest', 'macro emits update_quest: ' + mac.id);
      assert(!!ctx.ACTION_REGISTRY[s.action], 'macro action in registry');
    });
  });
}

console.log('\n6. conditions compatibility / usages');

{
  const IDX = loadIndex();
  const data = {
    quests: {
      q1: IDX.createQuestTemplate('q1', 'Q', '', 2)
    },
    scenes: {
      village: {
        text: 'Hi',
        choices: [
          {
            text: 'Start',
            questSet: { questId: 'q1', stage: '0' },
            to: 'village'
          },
          {
            text: 'Only if active',
            showIf: { all: [{ questMinStage: { questId: 'q1', stage: 0 } }] },
            to: 'village'
          }
        ],
        visual: {
          nodes: [
            {
              id: 'hs',
              events: {
                click: [
                  { action: 'update_quest', params: { questId: 'q1', stage: 'complete' } }
                ]
              }
            }
          ]
        }
      }
    }
  };
  const usages = IDX.collectQuestUsages(data, 'q1');
  assert(usages.some((u) => u.kind === 'choice' || u.category === 'start'), 'start usage');
  assert(usages.some((u) => u.kind === 'condition'), 'condition usage');
  assert(usages.some((u) => String(u.stage) === 'complete' || u.kind === 'visual_action'), 'complete action usage');
  const wired = IDX.buildQuestOverviewEntry('q1', data.quests.q1, data);
  assert(wired.status === 'wired', 'wired when starts + finish');
}

console.log('\n7. QuestRuntime file not modified by this phase modules');

{
  // Structural: UX/index must not redefine QuestRuntime
  assert(!read('js/editor/editor-quest-authoring-ux-phase-114.js').includes('QuestRuntime ='), 'no Runtime overwrite');
  assert(!read('js/editor/editor-quest-authoring-index.js').includes('QuestRuntime ='), 'index no Runtime overwrite');
}

console.log('\n' + '='.repeat(50));
console.log(`Phase 1.14 Quest Authoring UX: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
