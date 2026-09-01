/**
 * Phase 1.15 — Gameplay component presets (pure compile → existing runtime shapes)
 */
(function attachGameplayComponentsIndex(global) {
  'use strict';

  const PRESETS = {
    chest_loot: { label: 'Chest / Loot', icon: '📦', target: 'visual_hotspot' },
    door_exit: { label: 'Door / Exit', icon: '🚪', target: 'visual_hotspot' },
    npc_interaction: { label: 'NPC Interaction', icon: '👤', target: 'visual_hotspot' },
    rest_point: { label: 'Rest Point', icon: '🛏️', target: 'visual_hotspot' },
    encounter: { label: 'Encounter', icon: '⚔️', target: 'visual_hotspot' }
  };

  function slugId(prefix) {
    return (prefix || 'gp') + '_' + Date.now().toString(36).slice(-5);
  }

  function step(action, params) {
    return { action, params: params || {} };
  }

  function notOpenedCondition(openedFlag) {
    if (!openedFlag) return null;
    return { all: [{ notFlag: openedFlag }] };
  }

  function compileChestLoot(params, data) {
    params = params || {};
    const openedFlag = params.openedFlag || slugId('chest_open');
    const items = Array.isArray(params.items) ? params.items : [];
    const click = [];
    if (params.sayText !== false) {
      click.push(step('say', { text: params.sayText || 'Вы открыли сундук.', npcId: params.npcId || '' }));
    }
    items.forEach((it) => {
      if (!it?.itemId) return;
      click.push(step('add_item', { itemId: it.itemId, count: it.count || 1 }));
    });
    if (params.gold > 0) click.push(step('add_gold', { amount: params.gold }));
    // Optional quest update — author can delete/edit after insert
    if (params.questId) {
      click.push(step('update_quest', {
        questId: params.questId,
        stage: params.questStage != null ? params.questStage : (params.stage != null ? params.stage : '1')
      }));
    }
    click.push(step('set_flag', { flag: openedFlag, value: true }));
    return {
      presetId: 'chest_loot',
      params: { ...params, openedFlag },
      nodes: [{
        kind: 'hotspot',
        props: { label: params.label || 'Сундук' },
        showIf: notOpenedCondition(openedFlag),
        events: { click }
      }],
      openedShowIf: { all: [{ flag: openedFlag }] }
    };
  }

  function compileDoorExit(params) {
    params = params || {};
    const dest = params.destinationSceneId || params.sceneId || '';
    const lockedText = params.lockedText || 'Заперто.';
    const nodes = [];
    const hasItemReq = !!params.requireItemId;
    const hasGoldReq = params.requireGold > 0;

    if (hasItemReq || hasGoldReq) {
      const lockedRules = [];
      if (hasItemReq) lockedRules.push({ notHasItem: params.requireItemId });
      if (hasGoldReq) lockedRules.push({ goldMax: params.requireGold - 1 });
      nodes.push({
        kind: 'hotspot',
        props: { label: (params.label || 'Дверь') + ' (заперто)' },
        showIf: lockedRules.length === 1 ? { all: lockedRules } : { any: lockedRules },
        events: { click: [step('say', { text: lockedText })] }
      });
      const openRules = [];
      if (hasItemReq) openRules.push({ hasItem: params.requireItemId });
      if (hasGoldReq) openRules.push({ goldMin: params.requireGold });
      nodes.push({
        kind: 'hotspot',
        props: { label: params.label || 'Дверь' },
        showIf: { all: openRules },
        events: { click: dest ? [step('change_scene', { sceneId: dest })] : [] }
      });
    } else {
      nodes.push({
        kind: 'hotspot',
        props: { label: params.label || 'Выход' },
        events: { click: dest ? [step('change_scene', { sceneId: dest })] : [] }
      });
    }
    return { presetId: 'door_exit', params, nodes };
  }

  function compileNpcInteraction(params, data) {
    params = params || {};
    const npcId = params.npcId;
    const npc = npcId && data?.npcs?.[npcId];
    const interaction = params.interaction || 'talk';
    const nodes = [];

    if (interaction === 'talk') {
      const dialogueScene = params.dialogueSceneId || npc?.dialogueSceneId;
      const greet = npc?.dialogues?.default?.[0]?.text || '…';
      const click = dialogueScene && data?.scenes?.[dialogueScene]
        ? [step('change_scene', { sceneId: dialogueScene })]
        : [step('say', { npcId, text: greet })];
      nodes.push({ kind: 'hotspot', props: { label: params.label || (npc?.name || 'NPC') + ' (Talk)' }, events: { click } });
    } else if (interaction === 'trade') {
      if (!npc?.shop) return { presetId: 'npc_interaction', params, error: 'npc_no_shop', nodes: [] };
      const shopScene = params.shopSceneId || npc.shopSceneId || npc.location;
      if (!shopScene || !data?.scenes?.[shopScene]) {
        return { presetId: 'npc_interaction', params, error: 'no_shop_scene', nodes: [] };
      }
      nodes.push({
        kind: 'hotspot',
        props: { label: params.label || (npc?.name || 'NPC') + ' (Trade)' },
        events: { click: [step('change_scene', { sceneId: shopScene })] }
      });
    } else if (interaction === 'attack') {
      const enemies = params.enemies || (npc?.combatEnemyId ? [npc.combatEnemyId] : []);
      if (!enemies.length) return { presetId: 'npc_interaction', params, error: 'no_enemies', nodes: [] };
      nodes.push({
        kind: 'hotspot',
        props: { label: params.label || (npc?.name || 'NPC') + ' (Attack)' },
        events: { click: [step('start_combat', { enemies, nextScene: params.nextScene || '' })] }
      });
    }
    return { presetId: 'npc_interaction', params, nodes };
  }

  function compileRestPoint(params) {
    params = params || {};
    const click = [];
    if (params.healAmount != null && params.healAmount !== '' && params.healAmount !== false) {
      click.push(step('heal', { target: 'self', amount: String(params.healAmount) }));
    }
    if (params.restType === 'short') click.push(step('rest_short_time', {}));
    else if (params.restType === 'long') click.push(step('rest_long_time', {}));
    else if (params.advanceMinutes > 0) click.push(step('advance_time', { minutes: params.advanceMinutes }));
    if (params.doSave) click.push(step('save_game', { slot: 'auto' }));
    if (!click.length) click.push(step('heal', { target: 'self', amount: '2d4+2' }));
    return {
      presetId: 'rest_point',
      params,
      nodes: [{
        kind: 'hotspot',
        props: { label: params.label || 'Место отдыха' },
        events: { click }
      }]
    };
  }

  function compileEncounter(params, data) {
    params = params || {};
    const enemies = Array.isArray(params.enemies) ? params.enemies.filter(Boolean) : [];
    if (!enemies.length) {
      return { presetId: 'encounter', params, error: 'no_enemies', nodes: [] };
    }
    const click = [step('start_combat', { enemies, nextScene: params.nextScene || '' })];
    const scenePatches = [];
    const victory = [];
    if (params.victoryGold > 0) victory.push(step('add_gold', { amount: params.victoryGold }));
    (params.victoryItems || []).forEach((it) => {
      if (it?.itemId) victory.push(step('add_item', { itemId: it.itemId, count: it.count || 1 }));
    });
    if (victory.length && params.nextScene && data?.scenes?.[params.nextScene]) {
      scenePatches.push({ sceneId: params.nextScene, appendEnter: victory });
    }
    return {
      presetId: 'encounter',
      params,
      nodes: [{
        kind: 'hotspot',
        props: { label: params.label || 'Encounter' },
        events: { click }
      }],
      scenePatches
    };
  }

  const COMPILERS = {
    chest_loot: compileChestLoot,
    door_exit: compileDoorExit,
    npc_interaction: compileNpcInteraction,
    rest_point: compileRestPoint,
    encounter: compileEncounter
  };

  function compilePreset(presetId, params, data) {
    const fn = COMPILERS[presetId];
    if (!fn) return { error: 'unknown_preset', nodes: [] };
    return fn(params, data);
  }

  function validateActionSteps(steps, registry) {
    if (!Array.isArray(steps)) return { ok: false, errors: ['steps not array'] };
    const errors = [];
    steps.forEach((s, i) => {
      if (!s?.action) errors.push('step ' + i + ': missing action');
      else if (registry && !registry[s.action]) errors.push('step ' + i + ': unknown action ' + s.action);
    });
    return { ok: !errors.length, errors };
  }

  function validateShowIf(showIf) {
    if (showIf == null) return { ok: true };
    if (typeof showIf !== 'object') return { ok: false };
    const rules = showIf.all || showIf.any || [];
    if (!Array.isArray(rules)) return { ok: false };
    return { ok: true };
  }

  function collectAllSteps(compiled) {
    const steps = [];
    (compiled.nodes || []).forEach((n) => {
      (n.events?.click || []).forEach((s) => steps.push(s));
    });
    (compiled.scenePatches || []).forEach((p) => {
      (p.appendEnter || []).forEach((s) => steps.push(s));
    });
    return steps;
  }

  function serializeRoundtrip(compiled) {
    return JSON.parse(JSON.stringify(compiled));
  }

  const api = {
    PRESETS,
    COMPILERS,
    compilePreset,
    compileChestLoot,
    compileDoorExit,
    compileNpcInteraction,
    compileRestPoint,
    compileEncounter,
    validateActionSteps,
    validateShowIf,
    collectAllSteps,
    serializeRoundtrip
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof global !== 'undefined') {
    global.GameplayComponentsIndex = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global);
