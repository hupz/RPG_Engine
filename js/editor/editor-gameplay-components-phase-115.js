/**
 * Phase 1.15 — Gameplay Component Library UI
 */
(function attachGameplayComponentsPhase115() {
  'use strict';

  if (typeof Editor === 'undefined') return;

  const IDX = typeof GameplayComponentsIndex !== 'undefined' ? GameplayComponentsIndex : null;

  function esc(s) {
    return typeof Editor.escapeHtml === 'function'
      ? Editor.escapeHtml(String(s == null ? '' : s))
      : String(s == null ? '' : s);
  }

  function escAttr(s) {
    return typeof Editor.escapeAttr === 'function'
      ? Editor.escapeAttr(String(s == null ? '' : s))
      : esc(s);
  }

  function isWriter() {
    return typeof Editor.isWriterMode === 'function' && Editor.isWriterMode();
  }

  function isAdvanced() {
    return !isWriter();
  }

  function ensureStyles() {
    if (document.getElementById('gameplay-components-phase-115-styles')) return;
    const st = document.createElement('style');
    st.id = 'gameplay-components-phase-115-styles';
    st.textContent = `
      .gp-components-panel { margin: 14px 0; padding: 14px; border: 1px solid var(--border); border-radius: 8px; background: var(--card-bg); }
      .gp-preset-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; margin: 10px 0; }
      .gp-preset-btn { padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--paper); cursor: pointer; text-align: center; }
      .gp-preset-btn.is-active { border-color: var(--info); background: color-mix(in srgb, var(--info) 12%, var(--paper)); }
      .gp-form-section { margin-top: 12px; }
      .gp-preview-raw { font-size: 11px; max-height: 160px; overflow: auto; background: var(--paper-dark); padding: 8px; border-radius: 6px; }
    `;
    document.head.appendChild(st);
  }

  function defaultParams(presetId) {
    switch (presetId) {
      case 'chest_loot':
        return { label: 'Сундук', items: [{ itemId: '', count: 1 }], gold: 10, sayText: 'Вы нашли содержимое сундука.' };
      case 'door_exit':
        return { label: 'Дверь', destinationSceneId: '', requireItemId: '', lockedText: 'Заперто.' };
      case 'npc_interaction':
        return { label: '', npcId: '', interaction: 'talk' };
      case 'rest_point':
        return { label: 'Костёр', healAmount: '2d4+2', restType: 'short', doSave: false };
      case 'encounter':
        return { label: 'Засада', enemies: [], nextScene: '', victoryGold: 0 };
      default:
        return {};
    }
  }

  Object.assign(Editor, {
    _gpPreset: Editor._gpPreset || 'chest_loot',
    _gpParams: Editor._gpParams || null,

    renderGameplayComponentsPanel() {
      if (!IDX) return '';
      const presetId = Editor._gpPreset || 'chest_loot';
      const params = Editor._gpParams || defaultParams(presetId);
      Editor._gpParams = params;

      let html = '<div class="gp-components-panel" id="gameplay-components-panel">';
      html += '<h3>🧩 Gameplay Components</h3>';
      html += '<p class="hint">Presets compile to visual hotspots + ACTION_REGISTRY steps. Runtime unchanged.</p>';

      html += '<div class="gp-preset-grid">';
      Object.entries(IDX.PRESETS).forEach(([id, meta]) => {
        const active = presetId === id ? ' is-active' : '';
        html += `<button type="button" class="gp-preset-btn${active}" data-gp-preset="${escAttr(id)}">${esc(meta.icon)} ${esc(meta.label)}</button>`;
      });
      html += '</div>';

      html += '<div class="gp-form-section" id="gp-form-fields">';
      html += Editor.renderGameplayPresetForm(presetId, params);
      html += '</div>';

      html += '<button type="button" class="btn btn-primary btn-sm" id="gp-apply-btn">Apply to Visual Scene</button>';
      html += '<button type="button" class="btn btn-secondary btn-sm" id="gp-preview-btn">Preview generated</button>';

      if (isAdvanced()) {
        html += '<div id="gp-raw-preview" class="gp-preview-raw" hidden></div>';
      }

      html += '</div>';
      return html;
    },

    renderGameplayPresetForm(presetId, params) {
      params = params || {};
      let html = '';
      html += `<div class="form-group"><label>Label</label><input class="form-control" data-gp-field="label" value="${escAttr(params.label || '')}"></div>`;

      if (presetId === 'chest_loot') {
        const itemId = params.items?.[0]?.itemId || '';
        html += `<div class="form-group"><label>Item</label>`;
        if (typeof Editor.renderEntityPicker === 'function') {
          html += Editor.renderEntityPicker({ kind: 'item', value: itemId, onChange: 'Editor._gpSetItem(this.value)' });
        } else {
          html += `<input data-gp-field="itemId" value="${escAttr(itemId)}">`;
        }
        html += '</div>';
        html += `<div class="form-group"><label>Gold</label><input type="number" min="0" data-gp-field="gold" value="${params.gold ?? 0}"></div>`;
        html += `<div class="form-group"><label>Opened state (flag)</label><input data-gp-field="openedFlag" value="${escAttr(params.openedFlag || '')}" placeholder="auto"></div>`;
      }

      if (presetId === 'door_exit') {
        html += `<div class="form-group"><label>Destination scene</label>`;
        if (typeof Editor.renderEntityPicker === 'function') {
          html += Editor.renderEntityPicker({
            kind: 'scene',
            value: params.destinationSceneId || '',
            onChange: 'Editor._gpSetField("destinationSceneId",this.value)'
          });
        } else {
          html += `<input data-gp-field="destinationSceneId" value="${escAttr(params.destinationSceneId || '')}">`;
        }
        html += '</div>';
        html += `<div class="form-group"><label>Requires item (key)</label>`;
        if (typeof Editor.renderEntityPicker === 'function') {
          html += Editor.renderEntityPicker({
            kind: 'item',
            value: params.requireItemId || '',
            onChange: 'Editor._gpSetField("requireItemId",this.value)'
          });
        } else {
          html += `<input data-gp-field="requireItemId" value="${escAttr(params.requireItemId || '')}">`;
        }
        html += '</div>';
        html += `<div class="form-group"><label>Locked text</label><input data-gp-field="lockedText" value="${escAttr(params.lockedText || 'Заперто.')}"></div>`;
      }

      if (presetId === 'npc_interaction') {
        html += `<div class="form-group"><label>NPC</label>`;
        if (typeof Editor.renderEntityPicker === 'function') {
          html += Editor.renderEntityPicker({
            kind: 'npc',
            value: params.npcId || '',
            onChange: 'Editor._gpSetField("npcId",this.value)'
          });
        } else {
          html += `<input data-gp-field="npcId" value="${escAttr(params.npcId || '')}">`;
        }
        html += '</div>';
        html += `<div class="form-group"><label>Interaction</label><select data-gp-field="interaction">
          <option value="talk" ${params.interaction === 'talk' ? 'selected' : ''}>Talk</option>
          <option value="trade" ${params.interaction === 'trade' ? 'selected' : ''}>Trade</option>
          <option value="attack" ${params.interaction === 'attack' ? 'selected' : ''}>Attack</option>
        </select></div>`;
      }

      if (presetId === 'rest_point') {
        html += `<div class="form-group"><label>Heal amount</label><input data-gp-field="healAmount" value="${escAttr(String(params.healAmount ?? '2d4+2'))}"></div>`;
        html += `<div class="form-group"><label>Rest</label><select data-gp-field="restType">
          <option value="short" ${params.restType === 'short' ? 'selected' : ''}>Short rest</option>
          <option value="long" ${params.restType === 'long' ? 'selected' : ''}>Long rest</option>
          <option value="none" ${params.restType === 'none' ? 'selected' : ''}>None</option>
        </select></div>`;
        html += `<label><input type="checkbox" data-gp-field="doSave" ${params.doSave ? 'checked' : ''}> Save game</label>`;
      }

      if (presetId === 'encounter') {
        html += `<div class="form-group"><label>Enemies (comma ids)</label><input data-gp-field="enemiesRaw" value="${escAttr((params.enemies || []).join(', '))}"></div>`;
        html += `<div class="form-group"><label>Next scene (victory)</label>`;
        if (typeof Editor.renderEntityPicker === 'function') {
          html += Editor.renderEntityPicker({
            kind: 'scene',
            value: params.nextScene || '',
            onChange: 'Editor._gpSetField("nextScene",this.value)'
          });
        } else {
          html += `<input data-gp-field="nextScene" value="${escAttr(params.nextScene || '')}">`;
        }
        html += '</div>';
        html += `<div class="form-group"><label>Victory gold</label><input type="number" min="0" data-gp-field="victoryGold" value="${params.victoryGold ?? 0}"></div>`;
      }

      return html;
    },

    _gpSetField(key, value) {
      if (!Editor._gpParams) Editor._gpParams = {};
      Editor._gpParams[key] = value;
    },

    _gpSetItem(itemId) {
      if (!Editor._gpParams) Editor._gpParams = defaultParams('chest_loot');
      Editor._gpParams.items = [{ itemId, count: 1 }];
    },

    collectGameplayFormParams() {
      const panel = document.getElementById('gameplay-components-panel');
      const params = Object.assign({}, Editor._gpParams || defaultParams(Editor._gpPreset));
      if (!panel) return params;
      panel.querySelectorAll('[data-gp-field]').forEach((el) => {
        const key = el.getAttribute('data-gp-field');
        if (!key) return;
        if (el.type === 'checkbox') params[key] = el.checked;
        else if (el.type === 'number') params[key] = parseInt(el.value, 10) || 0;
        else params[key] = el.value;
      });
      if (params.enemiesRaw != null) {
        params.enemies = String(params.enemiesRaw).split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
        delete params.enemiesRaw;
      }
      if (params.itemId) {
        params.items = [{ itemId: params.itemId, count: 1 }];
        delete params.itemId;
      }
      Editor._gpParams = params;
      return params;
    },

    compileCurrentGameplayPreset() {
      if (!IDX) return null;
      const params = Editor.collectGameplayFormParams();
      return IDX.compilePreset(Editor._gpPreset, params, Editor.data || {});
    },

    applyGameplayComponentToScene() {
      const compiled = Editor.compileCurrentGameplayPreset();
      if (!compiled || compiled.error) {
        Editor.toast.warning(compiled?.error || 'Compile failed');
        return;
      }
      const scene = Editor.data?.scenes?.[Editor.currentScene];
      if (!scene) return;
      if (!scene.visual) scene.visual = { mode: 'overlay', nodes: [] };
      if (!Array.isArray(scene.visual.nodes)) scene.visual.nodes = [];

      (compiled.nodes || []).forEach((spec) => {
        const nodeId = typeof Editor.visualAddNode === 'function'
          ? Editor.visualAddNode(spec.kind || 'hotspot')
          : null;
        let node = nodeId
          ? scene.visual.nodes.find((n) => n.id === nodeId)
          : null;
        if (!node) {
          node = { id: 'gp_' + Date.now().toString(36), kind: spec.kind || 'hotspot', transform: { x: 20, y: 20, w: 12, h: 10, z: 1 }, props: {}, events: {} };
          scene.visual.nodes.push(node);
        }
        node.props = Object.assign(node.props || {}, spec.props || {});
        node.events = spec.events || node.events;
        if (spec.showIf) node.showIf = spec.showIf;
        node.props.gameplayPreset = { id: Editor._gpPreset, params: Editor._gpParams };
      });

      (compiled.scenePatches || []).forEach((patch) => {
        const sc = Editor.data?.scenes?.[patch.sceneId];
        if (!sc) return;
        if (!sc.events) sc.events = {};
        if (!Array.isArray(sc.events.enter)) sc.events.enter = [];
        sc.events.enter.push(...(patch.appendEnter || []));
      });

      Editor.markDirty?.();
      Editor.updateJSONPreview?.();
      Editor.renderVisualScenePanel?.();
      Editor.toast?.success?.('Gameplay component applied');
    },

    previewGameplayComponentRaw() {
      if (!isAdvanced()) return;
      const compiled = Editor.compileCurrentGameplayPreset();
      const box = document.getElementById('gp-raw-preview');
      if (!box) return;
      box.hidden = false;
      box.textContent = JSON.stringify(compiled, null, 2);
    },

    bindGameplayComponentsPanel(root) {
      if (!root || root._gpBound) return;
      root._gpBound = true;
      root.addEventListener('click', (ev) => {
        const preset = ev.target.closest('[data-gp-preset]');
        if (preset) {
          Editor._gpPreset = preset.getAttribute('data-gp-preset');
          Editor._gpParams = defaultParams(Editor._gpPreset);
          Editor.renderGameplayComponentsInjected?.();
          return;
        }
        if (ev.target.id === 'gp-apply-btn' || ev.target.closest('#gp-apply-btn')) {
          Editor.applyGameplayComponentToScene?.();
        }
        if (ev.target.id === 'gp-preview-btn' || ev.target.closest('#gp-preview-btn')) {
          Editor.previewGameplayComponentRaw?.();
        }
      });
      if (typeof Editor.bindEntityPickers === 'function') Editor.bindEntityPickers(root);
    },

    renderGameplayComponentsInjected() {
      const host = document.getElementById('visual-scene-editor-panel') ||
        document.querySelector('#scene-editor .scene-builder');
      if (!host) return;
      let panel = document.getElementById('gameplay-components-panel');
      const html = Editor.renderGameplayComponentsPanel();
      if (!html) {
        if (panel) panel.remove();
        return;
      }
      if (panel) panel.outerHTML = html;
      else host.insertAdjacentHTML('afterbegin', html);
      panel = document.getElementById('gameplay-components-panel');
      if (panel) Editor.bindGameplayComponentsPanel(panel);
    }
  });

  if (Editor.hooks?.after) {
    Editor.hooks.after('renderVisualScenePanel', function gpComponentsInject() {
      try {
        ensureStyles();
        Editor.renderGameplayComponentsInjected?.();
      } catch (e) {
        console.warn('[phase-115]', e);
      }
    }, 'editor-gameplay-components-phase-115');
  }
})();
