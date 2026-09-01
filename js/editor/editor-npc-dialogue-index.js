/**
 * Phase 1.13 — NPC & Dialogue authoring index (pure, testable)
 */
(function attachNpcDialogueIndex(global) {
  'use strict';

  function normalizeTopic(topic, index) {
    if (typeof topic === 'string') {
      return { id: 'node_' + (index + 1), label: topic, reply: '' };
    }
    const t = topic && typeof topic === 'object' ? Object.assign({}, topic) : {};
    if (!t.id) t.id = 'node_' + (index + 1);
    if (!t.label && t.text) t.label = t.text;
    return t;
  }

  function validateNpcShape(npc) {
    if (!npc || typeof npc !== 'object') return false;
    if (typeof npc.id !== 'string' || !npc.id) return false;
    if (npc.dialogues != null && typeof npc.dialogues !== 'object') return false;
    if (npc.quests != null && !Array.isArray(npc.quests)) return false;
    if (npc.shopItems != null && !Array.isArray(npc.shopItems)) return false;
    return true;
  }

  function validateDialogueTopic(topic) {
    const t = normalizeTopic(topic, 0);
    if (typeof t.label !== 'string') return false;
    if (t.showIf != null && typeof t.showIf !== 'object') return false;
    if (t.actions != null && !Array.isArray(t.actions)) return false;
    return true;
  }

  function buildDialogueFlowSummary(topics) {
    const list = (Array.isArray(topics) ? topics : []).map(normalizeTopic);
    const byId = {};
    list.forEach((t, i) => { byId[t.id] = { index: i, topic: t }; });
    return list.map((t) => {
      const outgoing = [];
      if (t.nextTopic && byId[t.nextTopic]) {
        outgoing.push({ kind: 'nextTopic', target: t.nextTopic, label: byId[t.nextTopic].topic.label || t.nextTopic });
      }
      if (t.nextScene) {
        outgoing.push({ kind: 'nextScene', target: String(t.nextScene), label: String(t.nextScene) });
      }
      if (t.to) {
        outgoing.push({ kind: 'nextScene', target: String(t.to), label: String(t.to) });
      }
      const incoming = list.filter((other) => {
        return other.nextTopic === t.id;
      }).map((other) => ({ fromId: other.id, label: other.label || other.id }));
      return {
        id: t.id,
        label: t.label || t.id,
        reply: t.reply || '',
        outgoing,
        incoming,
        hasConditions: !!(t.showIf || t.hideIf),
        actionCount: Array.isArray(t.actions) ? t.actions.length : 0
      };
    });
  }

  function findDialogueTreeComponent(scene) {
    const comps = scene?.components;
    if (!Array.isArray(comps)) return null;
    for (let i = 0; i < comps.length; i++) {
      const c = comps[i];
      if (!c || c.enabled === false) continue;
      const type = c.component || c.type;
      if (type === 'dialogue_tree' || type === 'dialogue') {
        return { index: i, component: c, params: c.params || {} };
      }
    }
    return null;
  }

  const VISUAL_NPC_INTERACTIONS = {
    talk: {
      label: 'Talk',
      description: 'say или переход на dialogue scene',
      supported: true
    },
    trade: {
      label: 'Trade',
      description: 'change_scene на shop-сцену (npc.shop)',
      supported: true,
      requiresShop: true
    },
    attack: {
      label: 'Attack',
      description: 'start_combat (runtime)',
      supported: true
    }
  };

  function buildVisualNpcHotspotActions(npc, interaction, data, opts) {
    opts = opts || {};
    const npcId = npc?.id || opts.npcId;
    if (!npcId) return [];
    const greeting = npc?.dialogues?.default?.[0];
    const greetText = typeof greeting === 'object' ? (greeting.text || '') : (greeting || '');
    const dialogueSceneId = npc?.dialogueSceneId || opts.dialogueSceneId;

    if (interaction === 'talk') {
      if (dialogueSceneId && data?.scenes?.[dialogueSceneId]) {
        return [{ action: 'change_scene', params: { sceneId: dialogueSceneId } }];
      }
      return [{ action: 'say', params: { npcId, text: greetText || '…' } }];
    }
    if (interaction === 'trade') {
      const shopScene = npc?.shopSceneId || npc?.location;
      if (npc?.shop && shopScene && data?.scenes?.[shopScene]) {
        return [{ action: 'change_scene', params: { sceneId: shopScene } }];
      }
      return null;
    }
    if (interaction === 'attack') {
      const enemies = opts.enemies || (npc?.combatEnemyId ? [npc.combatEnemyId] : []);
      if (!enemies.length) return null;
      return [{
        action: 'start_combat',
        params: { enemies, nextScene: opts.nextScene || '' }
      }];
    }
    return null;
  }

  const api = {
    normalizeTopic,
    validateNpcShape,
    validateDialogueTopic,
    buildDialogueFlowSummary,
    findDialogueTreeComponent,
    VISUAL_NPC_INTERACTIONS,
    buildVisualNpcHotspotActions
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof global !== 'undefined') {
    global.NpcDialogueIndex = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global);
