/**
 * Phase 1.16 — Combat authoring UX
 * No new combat engine — wraps start_combat + encounter preset.
 */
(function attachCombatAuthoringPhase116() {
  'use strict';
  if (typeof Editor === 'undefined') {
    console.error('editor-combat-authoring-phase-116: Editor missing');
    return;
  }

  const IDX = typeof CombatAuthoringIndex !== 'undefined' ? CombatAuthoringIndex : null;
  const GP = typeof GameplayComponentsIndex !== 'undefined' ? GameplayComponentsIndex : null;

  Editor.expandStartFightMacro = function (overrides) {
    if (IDX && typeof IDX.expandStartFightMacro === 'function') {
      const r = IDX.expandStartFightMacro(overrides || {});
      return r.ok ? r.steps : [];
    }
    return [{
      action: 'start_combat',
      params: {
        enemies: Array.isArray(overrides?.enemies) ? overrides.enemies : [],
        nextScene: overrides?.nextScene || ''
      }
    }];
  };

  Editor.buildStartCombatAction = function (opts) {
    if (IDX && typeof IDX.buildStartCombatAction === 'function') {
      return IDX.buildStartCombatAction(opts || {});
    }
    return {
      action: 'start_combat',
      params: {
        enemies: opts?.enemies || [],
        nextScene: opts?.nextScene || ''
      }
    };
  };

  Editor.getEnemyPickerOptions = function (data) {
    data = data || Editor.data || {};
    const out = [];
    Object.keys(data.enemies || {}).forEach((id) => {
      const en = data.enemies[id] || {};
      const label = IDX && IDX.enemyPickerLabel
        ? IDX.enemyPickerLabel(id, en)
        : ((en.name || id) === id ? id : ((en.name || id) + ' (' + id + ')'));
      out.push({ id, label, name: en.name || id });
    });
    out.sort((a, b) => String(a.label).localeCompare(String(b.label), 'ru'));
    return out;
  };

  /**
   * Compile encounter using existing GameplayComponentsIndex — rewards on victory scene.
   */
  Editor.compileCombatEncounter = function (opts) {
    const authored = IDX && IDX.buildEncounterAuthoring
      ? IDX.buildEncounterAuthoring(opts || {})
      : (opts || {});
    if (!GP || typeof GP.compileEncounter !== 'function') {
      const step = Editor.buildStartCombatAction({
        enemies: authored.enemies,
        nextScene: authored.nextScene
      });
      return {
        presetId: 'encounter',
        params: authored,
        nodes: [{
          kind: 'hotspot',
          props: { label: authored.label || 'Encounter' },
          events: { click: [step] }
        }],
        scenePatches: []
      };
    }
    return GP.compileEncounter({
      label: authored.label,
      enemies: authored.enemies,
      nextScene: authored.nextScene,
      victoryGold: authored.victoryGold,
      victoryItems: authored.victoryItems
    }, Editor.data || {});
  };

  // Improve encounter form: enemy multi-select instead of raw comma ids
  const prevRenderFields = Editor.renderGameplayPresetFields;
  if (typeof prevRenderFields === 'function') {
    Editor.renderGameplayPresetFields = function (presetId, params) {
      let html = prevRenderFields.call(Editor, presetId, params);
      if (presetId !== 'encounter') return html;
      // Replace enemiesRaw text input with multi-select if present
      const enemyOpts = Editor.getEnemyPickerOptions(Editor.data);
      if (!enemyOpts.length) return html;
      const selected = new Set((params.enemies || []).map(String));
      const multi = `<div class="form-group"><label>Enemies</label>
        <select multiple size="${Math.min(6, Math.max(3, enemyOpts.length))}" data-gp-field="enemiesMulti">
          ${enemyOpts.map((o) =>
            `<option value="${Editor.escapeAttr(o.id)}" ${selected.has(o.id) ? 'selected' : ''}>${Editor.escapeHtml(o.label)}</option>`
          ).join('')}
        </select>
        <p class="hint">Ctrl/Cmd+клик. Victory scene + optional gold below. Defeat — не параметр start_combat.</p>
      </div>`;
      html = html.replace(
        /<div class="form-group"><label>Enemies \(comma ids\)<\/label><input[^>]*data-gp-field="enemiesRaw"[^>]*><\/div>/,
        multi
      );
      // Rename label if still old
      if (html.indexOf('data-gp-field="enemiesMulti"') < 0 && html.indexOf('enemiesRaw') >= 0) {
        html = multi + html;
      }
      return html;
    };

    const prevCollect = Editor.collectGameplayFormParams;
    if (typeof prevCollect === 'function') {
      Editor.collectGameplayFormParams = function () {
        const params = prevCollect.call(Editor);
        const panel = document.getElementById('gameplay-components-panel');
        const multi = panel && panel.querySelector('[data-gp-field="enemiesMulti"]');
        if (multi && multi.multiple) {
          params.enemies = Array.prototype.slice.call(multi.selectedOptions || [])
            .map((o) => o.value)
            .filter(Boolean);
          delete params.enemiesMulti;
        }
        return params;
      };
    }
  }

  if (Editor.hooks && typeof Editor.hooks.register === 'function') {
    Editor.hooks.register('editor-combat-authoring-phase-116', {
      expandStartFightMacro: Editor.expandStartFightMacro,
      buildStartCombatAction: Editor.buildStartCombatAction,
      getEnemyPickerOptions: Editor.getEnemyPickerOptions,
      compileCombatEncounter: Editor.compileCombatEncounter
    }, { force: true });
  }

  console.info('[Phase 1.16] Combat authoring ready (start_combat / Start Fight)');
})();
