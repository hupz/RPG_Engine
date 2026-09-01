/**
 * Large project test fixture (~200 scenes, 500 items, 100 quests)
 * Used for performance audit tests — not loaded in production.
 */
'use strict';

function buildLargeProjectFixture() {
  const scenes = {};
  const items = {};
  const quests = {};
  const ui = { screens: {} };

  for (let i = 0; i < 200; i++) {
    const id = 'scene_' + i;
    scenes[id] = {
      id,
      location: 'Location ' + i,
      text: 'Scene body ' + i,
      choices: i % 3 === 0 ? [{ text: 'Next', to: 'scene_' + ((i + 1) % 200) }] : []
    };
  }

  for (let i = 0; i < 500; i++) {
    const id = 'item_' + i;
    items[id] = { id, name: 'Item ' + i, type: 'misc' };
  }

  for (let i = 0; i < 100; i++) {
    const id = 'quest_' + i;
    quests[id] = {
      id,
      title: 'Quest ' + i,
      stages: [{
        id: 'stage_0',
        title: 'Start',
        tasks: [{ type: 'ManualAdvance', description: 'Continue' }]
      }]
    };
  }

  for (let i = 0; i < 5; i++) {
    const sid = 'screen_' + i;
    const nodes = [];
    for (let n = 0; n < 25; n++) {
      nodes.push({ id: 'node_' + n, kind: 'label', label: 'Node ' + n });
    }
    ui.screens[sid] = { id: sid, name: 'Screen ' + i, nodes };
  }

  return {
    meta: { title: 'Large Fixture', dataVersion: 5 },
    startScene: 'scene_0',
    scenes,
    items,
    quests,
    npcs: {},
    enemies: {},
    classes: { fighter: { name: 'Fighter', hp: 20 } },
    ui
  };
}

module.exports = { buildLargeProjectFixture };
