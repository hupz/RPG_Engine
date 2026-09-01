/**
 * Phase 1.15 — Items / Rewards / Loot (pure helpers)
 * Macros expand to ACTION_REGISTRY steps only — never store macro ids in project JSON.
 */
(function attachItemsRewardsIndex(global) {
  'use strict';

  const ITEM_CATEGORIES = [
    'misc', 'key', 'quest', 'consumable', 'weapon', 'armor', 'shield',
    'accessory', 'readable', 'equipment'
  ];

  const REWARD_MACROS = Object.freeze([
    {
      id: 'give_item',
      label: 'Give Item',
      steps: [{ action: 'add_item', params: { itemId: '', count: 1 } }]
    },
    {
      id: 'take_item',
      label: 'Take Item',
      steps: [{ action: 'remove_item', params: { itemId: '', count: 1 } }]
    },
    {
      id: 'give_gold',
      label: 'Give Gold',
      steps: [{ action: 'add_gold', params: { amount: 10 } }]
    },
    {
      id: 'take_gold',
      label: 'Take Gold',
      steps: [{ action: 'remove_gold', params: { amount: 10 } }]
    },
    {
      id: 'loot_chest',
      label: 'Loot Chest',
      steps: [
        { action: 'say', params: { text: 'Вы открыли сундук и нашли добычу.' } },
        { action: 'add_item', params: { itemId: '', count: 1 } },
        { action: 'add_gold', params: { amount: 25 } },
        { action: 'update_quest', params: { questId: '', stage: '1' } },
        { action: 'set_flag', params: { flag: 'chest_looted', value: true } }
      ]
    }
  ]);

  function validateItemShape(item, id) {
    const errors = [];
    const warnings = [];
    if (!item || typeof item !== 'object') {
      return { ok: false, errors: ['Item must be an object'], warnings };
    }
    if (!String(item.name || '').trim()) {
      errors.push('Missing name');
    }
    const desc = item.description != null ? item.description : item.desc;
    if (desc != null && typeof desc !== 'string') {
      warnings.push('description should be a string');
    }
    if (item.type && ITEM_CATEGORIES.indexOf(item.type) < 0) {
      warnings.push('Unknown category/type: ' + item.type);
    }
    if (item.stackable != null && typeof item.stackable !== 'boolean') {
      warnings.push('stackable should be boolean');
    }
    if (item.maxStack != null) {
      const n = Number(item.maxStack);
      if (!Number.isFinite(n) || n < 1) warnings.push('maxStack must be >= 1');
    }
    if (id != null && String(id).trim() === '') {
      errors.push('Missing item id');
    }
    return { ok: errors.length === 0, errors, warnings };
  }

  function itemPickerLabel(id, item) {
    const name = (item && (item.name || item.title)) || id;
    if (!id) return String(name || '');
    if (name === id) return String(id);
    return String(name) + ' (' + id + ')';
  }

  function deepCloneSteps(steps) {
    return JSON.parse(JSON.stringify(steps || []));
  }

  /**
   * Expand macro → registry action steps only.
   * Never returns macro id in the result.
   */
  function expandRewardMacro(macroId, overrides) {
    overrides = overrides || {};
    const def = REWARD_MACROS.find((m) => m.id === macroId);
    if (!def) return { ok: false, steps: [], error: 'Unknown macro: ' + macroId };
    const steps = deepCloneSteps(def.steps);
    steps.forEach((step) => {
      if (!step || !step.params) return;
      if (step.action === 'add_item' || step.action === 'remove_item') {
        if (overrides.itemId != null) step.params.itemId = overrides.itemId;
        if (overrides.count != null) step.params.count = overrides.count;
      }
      if (step.action === 'add_gold' || step.action === 'remove_gold') {
        if (overrides.amount != null) step.params.amount = overrides.amount;
        if (overrides.gold != null) step.params.amount = overrides.gold;
      }
      if (step.action === 'say' && overrides.sayText != null) {
        step.params.text = overrides.sayText;
      }
      if (step.action === 'update_quest') {
        if (overrides.questId != null) step.params.questId = overrides.questId;
        if (overrides.questStage != null) step.params.stage = overrides.questStage;
        if (overrides.stage != null) step.params.stage = overrides.stage;
      }
      if (step.action === 'set_flag' && overrides.openedFlag != null) {
        step.params.flag = overrides.openedFlag;
      }
    });
    // Optionally drop quest step if no questId provided and stripEmptyQuest
    if (overrides.stripEmptyQuest) {
      const filtered = steps.filter((s) => {
        if (s.action !== 'update_quest') return true;
        return !!(s.params && s.params.questId);
      });
      return { ok: true, steps: filtered, macroId: null };
    }
    return { ok: true, steps, macroId: null };
  }

  function buildLootChestSteps(opts) {
    opts = opts || {};
    return expandRewardMacro('loot_chest', {
      itemId: opts.itemId || '',
      count: opts.count != null ? opts.count : 1,
      gold: opts.gold != null ? opts.gold : 25,
      sayText: opts.sayText,
      questId: opts.questId || '',
      stage: opts.questStage != null ? opts.questStage : (opts.stage != null ? opts.stage : '1'),
      openedFlag: opts.openedFlag || 'chest_looted',
      stripEmptyQuest: opts.stripEmptyQuest !== false && !opts.questId
    });
  }

  function validateRewardStep(step, data) {
    const issues = [];
    if (!step || typeof step !== 'object' || !step.action) {
      return [{ type: 'malformed_action', severity: 'warning', message: 'Empty reward step' }];
    }
    // Macro ids must never appear as actions
    if (REWARD_MACROS.some((m) => m.id === step.action) && step.action !== 'loot_chest') {
      // give_item etc. are not registry actions
      if (typeof ACTION_REGISTRY === 'undefined' || !ACTION_REGISTRY[step.action]) {
        issues.push({
          type: 'macro_id_in_json',
          severity: 'error',
          message: 'Macro id «' + step.action + '» must be expanded to registry actions'
        });
      }
    }
    const p = step.params || {};
    if (step.action === 'add_item' || step.action === 'remove_item') {
      if (p.itemId && data?.items && !data.items[p.itemId]) {
        issues.push({
          type: 'missing_item',
          severity: 'error',
          message: 'Missing item «' + p.itemId + '»',
          entityId: p.itemId
        });
      }
      if (p.count != null && p.count !== '') {
        const c = Number(p.count);
        if (!Number.isFinite(c) || c < 1) {
          issues.push({
            type: 'invalid_amount',
            severity: 'warning',
            message: 'Invalid item count: ' + p.count
          });
        }
      }
    }
    if (step.action === 'add_gold' || step.action === 'remove_gold') {
      if (p.amount != null && p.amount !== '') {
        const a = Number(p.amount);
        if (!Number.isFinite(a) || a < 0) {
          issues.push({
            type: 'invalid_amount',
            severity: 'warning',
            message: 'Invalid gold amount: ' + p.amount
          });
        }
      }
    }
    if (step.action === 'update_quest' && p.questId && data?.quests && !data.quests[p.questId]) {
      issues.push({
        type: 'missing_quest',
        severity: 'error',
        message: 'Missing quest «' + p.questId + '»',
        entityId: p.questId
      });
    }
    return issues;
  }

  function assertNoMacroIdsInSteps(steps) {
    const macroIds = new Set(REWARD_MACROS.map((m) => m.id));
    // loot_chest / give_item are macros — registry has real actions only
    const bad = [];
    (steps || []).forEach((s, i) => {
      if (s && macroIds.has(s.action)) {
        // Only flag if not a real registry action
        const inReg = typeof ACTION_REGISTRY !== 'undefined' && ACTION_REGISTRY[s.action];
        if (!inReg) bad.push({ index: i, action: s.action });
      }
    });
    return { ok: bad.length === 0, bad };
  }

  const api = {
    ITEM_CATEGORIES,
    REWARD_MACROS,
    validateItemShape,
    itemPickerLabel,
    expandRewardMacro,
    buildLootChestSteps,
    validateRewardStep,
    assertNoMacroIdsInSteps
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof global !== 'undefined') {
    global.ItemsRewardsIndex = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global);
