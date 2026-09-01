/**
 * Phase 1.15 — Items / Rewards / Loot authoring UX
 * Wires reward macros + loot chest preset; no second inventory system.
 */
(function attachItemsRewardsPhase115() {
  'use strict';
  if (typeof Editor === 'undefined') {
    console.error('editor-items-rewards-phase-115: Editor missing');
    return;
  }

  const IDX = typeof ItemsRewardsIndex !== 'undefined' ? ItemsRewardsIndex : null;

  /**
   * Insert Loot Chest macro steps into a click list (registry actions only).
   */
  Editor.applyLootChestPreset = function (opts) {
    opts = opts || {};
    if (!IDX || typeof IDX.buildLootChestSteps !== 'function') {
      console.warn('ItemsRewardsIndex.buildLootChestSteps missing');
      return [];
    }
    const built = IDX.buildLootChestSteps({
      itemId: opts.itemId || '',
      count: opts.count,
      gold: opts.gold,
      sayText: opts.sayText,
      questId: opts.questId || '',
      questStage: opts.questStage,
      openedFlag: opts.openedFlag,
      stripEmptyQuest: opts.stripEmptyQuest
    });
    return built.ok ? built.steps : [];
  };

  /** Expand any reward macro → steps (never returns macro id as action). */
  Editor.expandRewardMacro = function (macroId, overrides) {
    if (IDX && typeof IDX.expandRewardMacro === 'function') {
      const r = IDX.expandRewardMacro(macroId, overrides || {});
      return r.ok ? r.steps : [];
    }
    const macros = typeof Editor.getActionMacros === 'function' ? Editor.getActionMacros() : [];
    const m = macros.find((x) => x.id === macroId);
    if (!m || !m.steps) return [];
    return JSON.parse(JSON.stringify(m.steps));
  };

  /** Item picker options: label + id */
  Editor.getItemPickerOptions = function (data) {
    data = data || Editor.data || {};
    const out = [];
    Object.keys(data.items || {}).forEach((id) => {
      const it = data.items[id] || {};
      const label = IDX && IDX.itemPickerLabel
        ? IDX.itemPickerLabel(id, it)
        : ((it.name || id) === id ? id : (it.name + ' (' + id + ')'));
      out.push({ id, label, name: it.name || id });
    });
    out.sort((a, b) => String(a.label).localeCompare(String(b.label), 'ru'));
    return out;
  };

  // Ensure catalog macros stay aligned with index when both loaded
  if (IDX && Array.isArray(IDX.REWARD_MACROS) && typeof Editor.getActionMacros === 'function') {
    const orig = Editor.getActionMacros;
    Editor.getActionMacros = function () {
      const base = orig.call(Editor) || [];
      const byId = Object.create(null);
      base.forEach((m) => { byId[m.id] = m; });
      IDX.REWARD_MACROS.forEach((m) => {
        byId[m.id] = {
          id: m.id,
          label: m.label,
          steps: JSON.parse(JSON.stringify(m.steps))
        };
      });
      // Preserve non-reward macros order: replace reward ones in place, append missing
      const seen = new Set();
      const out = [];
      base.forEach((m) => {
        if (byId[m.id]) {
          out.push(byId[m.id]);
          seen.add(m.id);
        }
      });
      IDX.REWARD_MACROS.forEach((m) => {
        if (!seen.has(m.id)) out.push(byId[m.id]);
      });
      return out;
    };
  }

  if (Editor.hooks && typeof Editor.hooks.register === 'function') {
    Editor.hooks.register('editor-items-rewards-phase-115', {
      applyLootChestPreset: Editor.applyLootChestPreset,
      expandRewardMacro: Editor.expandRewardMacro,
      getItemPickerOptions: Editor.getItemPickerOptions
    }, { force: true });
  }

  console.info('[Phase 1.15] Items / Rewards / Loot authoring ready');
})();
