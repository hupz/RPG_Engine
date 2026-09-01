/**
 * Phase 1.16 — Combat authoring (pure helpers)
 * Runtime model: start_combat { enemies: string[], nextScene }
 * Defeat scene is NOT a start_combat param (engine uses game_over / scene lossScene).
 */
(function attachCombatAuthoringIndex(global) {
  'use strict';

  function parseEnemyIds(value) {
    if (value == null || value === '') return [];
    if (Array.isArray(value)) {
      return value.map((v) => String(v).trim()).filter(Boolean);
    }
    if (typeof value === 'object' && value.id) {
      return [String(value.id)];
    }
    const s = String(value).trim();
    if (!s) return [];
    if (s.charAt(0) === '[') {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          return parsed.map((v) => String(v).trim()).filter(Boolean);
        }
      } catch (e) { /* fall through */ }
    }
    return s.split(/[,;\s]+/).map((p) => p.trim()).filter(Boolean);
  }

  function enemyPickerLabel(id, enemy) {
    const name = (enemy && (enemy.name || enemy.title)) || id;
    if (!id) return String(name || '');
    if (name === id) return String(id);
    return String(name) + ' (' + id + ')';
  }

  function buildStartCombatParams(opts) {
    opts = opts || {};
    const enemies = parseEnemyIds(opts.enemies);
    const nextScene = opts.nextScene != null ? String(opts.nextScene) : '';
    const params = { enemies };
    if (nextScene) params.nextScene = nextScene;
    return params;
  }

  function buildStartCombatAction(opts) {
    return {
      action: 'start_combat',
      params: buildStartCombatParams(opts)
    };
  }

  /** Start Fight macro → registry action only */
  function expandStartFightMacro(overrides) {
    overrides = overrides || {};
    const step = buildStartCombatAction({
      enemies: overrides.enemies != null ? overrides.enemies : [],
      nextScene: overrides.nextScene || ''
    });
    return { ok: true, steps: [step], macroId: null };
  }

  /**
   * Encounter authoring shape → existing compile path inputs.
   * Rewards ride on victory scene enter (via GameplayComponentsIndex.compileEncounter).
   */
  function buildEncounterAuthoring(opts) {
    opts = opts || {};
    return {
      name: opts.name || opts.label || 'Encounter',
      label: opts.label || opts.name || 'Encounter',
      enemies: parseEnemyIds(opts.enemies),
      nextScene: opts.nextScene || opts.victoryScene || '',
      victoryGold: opts.victoryGold > 0 ? Number(opts.victoryGold) : 0,
      victoryItems: Array.isArray(opts.victoryItems) ? opts.victoryItems : [],
      // defeat not authored on start_combat — documented for UI
      defeatSupported: false,
      defeatNote: 'start_combat does not take a defeat scene; runtime clears combat / uses game_over'
    };
  }

  function validateCombatParams(params, data) {
    const issues = [];
    params = params || {};
    const enemies = parseEnemyIds(params.enemies);
    if (!enemies.length) {
      issues.push({
        type: 'invalid_combat_params',
        severity: 'warning',
        message: 'start_combat: no enemies selected'
      });
    }
    enemies.forEach((eid) => {
      if (data?.enemies && !data.enemies[eid]) {
        issues.push({
          type: 'missing_enemy',
          severity: 'error',
          message: 'Missing enemy «' + eid + '»',
          entityId: eid
        });
      }
    });
    if (params.nextScene) {
      const sid = String(params.nextScene);
      if (data?.scenes && !data.scenes[sid]) {
        issues.push({
          type: 'missing_scene',
          severity: 'error',
          message: 'Victory scene «' + sid + '» missing',
          entityId: sid
        });
      }
    }
    // Unknown defeat-like keys on start_combat (author confusion)
    if (params.lossScene || params.defeatScene || params.loseScene) {
      issues.push({
        type: 'invalid_combat_params',
        severity: 'warning',
        message: 'Defeat scene is not a start_combat param (ignored by runtime)'
      });
    }
    return { ok: !issues.some((i) => i.severity === 'error'), issues, enemies };
  }

  function assertCombatActionJson(step) {
    if (!step || step.action !== 'start_combat') {
      return { ok: false, error: 'expected start_combat' };
    }
    const enemies = parseEnemyIds(step.params && step.params.enemies);
    if (step.params && typeof step.params.enemies === 'string') {
      // Prefer array in authored JSON
      return {
        ok: true,
        warning: 'enemies stored as string — normalize to array',
        enemies,
        normalized: buildStartCombatAction({
          enemies,
          nextScene: step.params.nextScene
        })
      };
    }
    return { ok: true, enemies, step };
  }

  const api = {
    parseEnemyIds,
    enemyPickerLabel,
    buildStartCombatParams,
    buildStartCombatAction,
    expandStartFightMacro,
    buildEncounterAuthoring,
    validateCombatParams,
    assertCombatActionJson
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof global !== 'undefined') {
    global.CombatAuthoringIndex = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global);
