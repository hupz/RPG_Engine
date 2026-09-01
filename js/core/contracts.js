/**
 * Engine Core — boundary contracts (shapes only).
 * No Canvas/WebGL/physics/ECS implementation in Phase 1.1.
 */
(function engineCoreContracts(global) {
  'use strict';

  /** @type {ReadonlyArray<string>} */
  const GameUI_METHODS = Object.freeze([
    'showScene',
    'showChoices',
    'showDialogue',
    'showInventory',
    'showCombat',
    'showNotification',
    'setLocation',
    'setText'
  ]);

  /** @type {ReadonlyArray<string>} */
  const IRenderer_METHODS = Object.freeze([
    'init',
    'resize',
    'render',
    'destroy'
  ]);

  /** @type {ReadonlyArray<string>} */
  const AssetManager_METHODS = Object.freeze([
    'register',
    'load',
    'unload',
    'get'
  ]);

  /** @type {ReadonlyArray<string>} */
  const GameMode_FIELDS = Object.freeze([
    'id',
    'createScene',
    'configureRuntime',
    'configureEditor',
    'capabilities'
  ]);

  /**
   * TextScene adapter contract (documentation + checklist).
   * existing scene JSON → adapter → runtime navigation
   * Does not change data/scenes.json.
   */
  const TextSceneAdapterContract = Object.freeze({
    name: 'TextSceneAdapter',
    input: 'legacy scene object (id, location, text, choices, components, …)',
    output: 'normalized text-scene view for Runtime/GameUI',
    rules: Object.freeze([
      'Must not require the Editor global (authoring UI)',
      'Must not mutate project JSON in place during play without explicit command',
      'SceneManager.showScene remains legacy owner until EXTRACT phase',
      'Campaign-specific handlers stay outside Core'
    ])
  });

  const SceneKind = Object.freeze({
    TEXT: 'text',
    SPATIAL_2D: 'spatial2d',
    SPATIAL_3D: 'spatial3d',
    HYBRID: 'hybrid'
  });

  const contracts = {
    GameUI_METHODS,
    IRenderer_METHODS,
    AssetManager_METHODS,
    GameMode_FIELDS,
    TextSceneAdapterContract,
    SceneKind
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = contracts;
  }
  global.EngineCore = global.EngineCore || {};
  global.EngineCore.contracts = contracts;
})(typeof window !== 'undefined' ? window : globalThis);
