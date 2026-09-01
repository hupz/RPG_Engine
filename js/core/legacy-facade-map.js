/**
 * Legacy GameEngine API migration categories (Phase 1.1 — map only).
 * Does not wrap or change window.GameEngine.
 *
 * KEEP          — remain public long-term or already clean
 * FACADE        — keep signature; body will delegate to new Runtime later
 * EXTRACT_LATER — domain logic to extract from god-object
 * DELETE_LATER  — after cutover / content moved out of engine
 */
(function engineCoreLegacyFacadeMap(global) {
  'use strict';

  const LEGACY_GAMEENGINE_API_MAP = Object.freeze({
    // Lifecycle / data
    init: 'FACADE',
    initUI: 'EXTRACT_LATER',
    applyGameData: 'FACADE',
    cacheGameData: 'KEEP',
    getSaveKey: 'KEEP',
    saveGame: 'FACADE',
    loadSave: 'FACADE',
    persistSave: 'FACADE',

    // Scene navigation
    showScene: 'FACADE',
    pickChoice: 'FACADE',
    setChoices: 'EXTRACT_LATER',
    setText: 'EXTRACT_LATER',
    setLocation: 'EXTRACT_LATER',

    // Quest (must stay compatible with QuestRuntime)
    updateQuest: 'FACADE',
    failQuest: 'FACADE',
    applyQuestRewards: 'EXTRACT_LATER',
    applyFlags: 'EXTRACT_LATER',

    // Inventory / economy
    addItem: 'EXTRACT_LATER',
    removeItem: 'EXTRACT_LATER',
    spendGold: 'EXTRACT_LATER',
    changeGold: 'EXTRACT_LATER',
    equipItem: 'EXTRACT_LATER',

    // Combat
    startCombat: 'EXTRACT_LATER',
    playerAttack: 'EXTRACT_LATER',
    nextCombatTurn: 'EXTRACT_LATER',

    // Campaign / content in engine
    showCampaignPicker: 'EXTRACT_LATER',
    handleShopJack: 'DELETE_LATER',
    migrateAlbertQuestState: 'DELETE_LATER',

    // Dice / utils
    d: 'KEEP',
    d20: 'KEEP',
    parseRoll: 'KEEP',
    log: 'KEEP',
    escapeHtml: 'KEEP'
  });

  const api = { LEGACY_GAMEENGINE_API_MAP };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.EngineCore = global.EngineCore || {};
  global.EngineCore.LEGACY_GAMEENGINE_API_MAP = LEGACY_GAMEENGINE_API_MAP;
})(typeof window !== 'undefined' ? window : globalThis);
