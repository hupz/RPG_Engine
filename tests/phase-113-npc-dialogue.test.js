#!/usr/bin/env node
/**
 * Phase 1.13 — NPC & Dialogue Authoring
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
  const ctx = { module: { exports: {} }, globalThis: null, window: null, console };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/editor/editor-npc-dialogue-index.js'), ctx);
  return ctx.NpcDialogueIndex || ctx.module.exports;
}

console.log('Phase 1.13 — NPC data shape');

{
  const IDX = loadIndex();
  const npc = {
    id: 'marta',
    name: 'Marta',
    icon: '👵',
    description: 'Elder',
    dialogues: { default: [{ speaker: 'Marta', text: 'Hi' }] },
    quests: ['q1'],
    shop: true,
    shopItems: ['potion']
  };
  assert(IDX.validateNpcShape(npc), 'valid NPC shape');
  assert(!IDX.validateNpcShape({ id: '' }), 'invalid empty id rejected');
}

console.log('\nPhase 1.13 — dialogue topic / flow');

{
  const IDX = loadIndex();
  const topics = [
    { id: 'intro', label: 'Hello', reply: 'Welcome', nextTopic: 'quest' },
    { id: 'quest', label: 'Quest?', reply: 'Bring sword', showIf: { all: [{ hasItem: 'sword' }] },
      actions: [{ action: 'remove_item', params: { itemId: 'sword' } }], nextScene: 'reward' }
  ];
  assert(IDX.validateDialogueTopic(topics[1]), 'dialogue topic with conditions/actions');
  const flow = IDX.buildDialogueFlowSummary(topics);
  assert(flow.length === 2, 'two nodes in flow');
  assert(flow[0].outgoing.some((o) => o.kind === 'nextTopic' && o.target === 'quest'), 'nextTopic edge');
  assert(flow[1].outgoing.some((o) => o.kind === 'nextScene' && o.target === 'reward'), 'nextScene edge');
  assert(flow[1].hasConditions, 'conditions flagged');
  assert(flow[1].actionCount === 1, 'action count');
}

console.log('\nPhase 1.13 — visual NPC interaction path');

{
  const IDX = loadIndex();
  const data = {
    scenes: { shop_scene: { id: 'shop_scene' }, talk_scene: { id: 'talk_scene' } },
    npcs: {
      jack: {
        id: 'jack', name: 'Jack', shop: true, shopSceneId: 'shop_scene',
        dialogues: { default: [{ text: 'Welcome' }] }, dialogueSceneId: 'talk_scene'
      },
      guard: { id: 'guard', name: 'Guard', combatEnemyId: 'goblin' }
    }
  };
  const talkScene = IDX.buildVisualNpcHotspotActions(data.npcs.jack, 'talk', data);
  assert(talkScene[0].action === 'change_scene' && talkScene[0].params.sceneId === 'talk_scene', 'talk uses dialogue scene');

  const talkSay = IDX.buildVisualNpcHotspotActions(
    { id: 'npc1', dialogues: { default: [{ text: 'Hi' }] } }, 'talk', { scenes: {} }
  );
  assert(talkSay[0].action === 'say', 'talk fallback say');

  const trade = IDX.buildVisualNpcHotspotActions(data.npcs.jack, 'trade', data);
  assert(trade[0].action === 'change_scene' && trade[0].params.sceneId === 'shop_scene', 'trade change_scene');

  const noTrade = IDX.buildVisualNpcHotspotActions(data.npcs.guard, 'trade', data);
  assert(noTrade === null, 'trade blocked without shop');

  const attack = IDX.buildVisualNpcHotspotActions(data.npcs.guard, 'attack', data, {});
  assert(attack[0].action === 'start_combat', 'attack start_combat');
}

console.log('\nPhase 1.13 — scene dialogue CRUD APIs');

{
  const crud = read('js/editor/editor-scene-crud.js');
  assert(crud.includes('setSceneNpcId'), 'setSceneNpcId implemented');
  assert(crud.includes('addDialogue'), 'addDialogue implemented');
  assert(crud.includes('updateDialogue'), 'updateDialogue implemented');
  assert(crud.includes('removeDialogue'), 'removeDialogue implemented');
}

console.log('\nPhase 1.13 — runtime additive (no Editor dep)');

{
  const handlers = read('js/components/component-handlers.js');
  const tree = read('js/components/dialogue-tree.js');
  assert(handlers.includes("source: 'dialogue_topic'"), 'topic actions via ActionRunner');
  assert(handlers.includes('nextScene'), 'nextScene navigation');
  assert(tree.includes('ConditionSystem.evaluate(t.showIf'), 'topic showIf filter');
  assert(!handlers.includes('editor/'), 'component-handlers no editor imports');
  assert(!tree.includes('Editor'), 'dialogue-tree no Editor');
}

console.log('\nPhase 1.13 — editor wiring');

{
  const html = read('editor.html');
  const phase = read('js/editor/editor-npc-dialogue-phase-113.js');
  assert(html.includes('editor-npc-dialogue-index.js'), 'index in html');
  assert(html.includes('editor-npc-dialogue-phase-113.js'), 'phase in html');
  assert(phase.includes('renderDialogueAuthoringPanel'), 'dialogue editor panel');
  assert(phase.includes('visualPlaceNpc'), 'visual NPC placement');
  assert(phase.includes('openUnifiedActionPicker'), 'uses unified action picker');
  assert(phase.includes('renderConditionBuilder'), 'uses condition catalog builder');
  assert(phase.includes('ensureNpcDialogueScene'), 'NPC dialogue scene link');
}

console.log('\n' + (failed ? 'FAILED' : 'PASSED') + ': ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
