/**
 * Phase 1.12 — Scene & World Authoring: wizard, inspector, connections, flow
 */
(function attachSceneAuthoringPhase112() {
  'use strict';

  if (typeof Editor === 'undefined') return;

  const IDX = typeof SceneAuthoringIndex !== 'undefined' ? SceneAuthoringIndex : null;

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

  function currentScene() {
    const id = Editor.currentScene;
    return id && Editor.data?.scenes?.[id] ? Editor.data.scenes[id] : null;
  }

  function ensureStyles() {
    if (document.getElementById('scene-authoring-phase-112-styles')) return;
    const st = document.createElement('style');
    st.id = 'scene-authoring-phase-112-styles';
    st.textContent = `
      .scene-authoring-panel { margin: 16px 0; padding: 14px; border: 1px solid var(--border); border-radius: 8px; background: var(--card-bg); }
      .scene-authoring-panel h3 { margin: 0 0 10px; font-size: 15px; }
      .scene-authoring-section { margin-bottom: 14px; }
      .scene-authoring-section h4 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ink-light); }
      .scene-conn-list { list-style: none; margin: 0; padding: 0; }
      .scene-conn-item { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 6px 0; border-bottom: 1px solid var(--border); }
      .scene-conn-item:last-child { border-bottom: 0; }
      .scene-conn-arrow { opacity: 0.6; }
      .scene-conn-broken { color: var(--danger); font-size: 11px; }
      .scene-flow-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
      .scene-flow-tag { font-size: 11px; padding: 2px 6px; border-radius: 4px; background: var(--paper-dark); border: 1px solid var(--border); }
      .scene-wizard-overlay { position: fixed; inset: 0; z-index: 12500; background: var(--overlay); display: flex; align-items: center; justify-content: center; padding: 16px; }
      .scene-wizard-modal { max-width: 440px; width: 100%; background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; padding: 20px; }
      .scene-wizard-types { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 12px 0; }
      .scene-wizard-type { text-align: left; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--paper); cursor: pointer; }
      .scene-wizard-type.is-selected { border-color: var(--info); background: color-mix(in srgb, var(--info) 10%, var(--paper)); }
      .scene-wizard-type strong { display: block; margin-bottom: 2px; }
      .scene-wizard-type span { font-size: 12px; color: var(--ink-light); }
    `;
    document.head.appendChild(st);
  }

  const LEGACY_PRESET_MAP = {
    text: { sceneType: 'custom', displayMode: 'text' },
    visual: { sceneType: 'custom', displayMode: 'visual' },
    dialogue: { sceneType: 'dialog', displayMode: 'text' },
    combat: { sceneType: 'combat', displayMode: 'text' },
    empty: { sceneType: 'custom', displayMode: 'text', minimal: true },
    mixed: { sceneType: 'custom', displayMode: 'mixed' }
  };

  const DISPLAY_MODE_OPTIONS = [
    ['text', 'TEXT', 'Текст и выборы'],
    ['visual', 'Visual', 'Visual layer и hotspots'],
    ['mixed', 'Mixed', 'Текст + visual вместе']
  ];

  function parseWizardIntent(intentOrPreset, displayMode) {
    if (intentOrPreset && typeof intentOrPreset === 'object') {
      return {
        sceneType: intentOrPreset.sceneType || 'custom',
        displayMode: intentOrPreset.displayMode || 'text',
        minimal: !!intentOrPreset.minimal
      };
    }
    if (typeof intentOrPreset === 'string' && LEGACY_PRESET_MAP[intentOrPreset]) {
      return { ...LEGACY_PRESET_MAP[intentOrPreset] };
    }
    return {
      sceneType: typeof intentOrPreset === 'string' ? intentOrPreset : 'custom',
      displayMode: displayMode || 'text',
      minimal: false
    };
  }

  function applyIntentToScene(scene, sceneType, minimal) {
    if (typeof Editor.getSceneTypeMeta === 'function') {
      const meta = Editor.getSceneTypeMeta(sceneType);
      scene.sceneType = meta.id;
      scene.editorModules = (meta.modules || ['story', 'choices']).slice();
    } else if (IDX) {
      const presetMap = { dialog: 'dialogue', combat: 'combat', custom: minimal ? 'empty' : 'text' };
      IDX.applyWizardPreset(scene, presetMap[sceneType] || (minimal ? 'empty' : 'text'));
      scene.sceneType = sceneType || scene.sceneType || 'custom';
    } else {
      scene.sceneType = sceneType || 'custom';
      scene.editorModules = minimal ? ['story'] : ['story', 'choices'];
    }
    scene.text = scene.text || '';
    if (minimal && Array.isArray(scene.editorModules)) {
      scene.editorModules = scene.editorModules.filter((m) => m === 'story');
    } else if (!minimal && !Array.isArray(scene.choices)) {
      scene.choices = [];
    }
  }

  function applyDisplayModeToScene(scene, displayMode) {
    const mode = displayMode || 'text';
    if (!Array.isArray(scene.editorModules)) scene.editorModules = ['story', 'choices'];
    if (mode === 'visual' || mode === 'mixed') {
      if (!scene.visual) scene.visual = { mode: 'overlay', nodes: [] };
      if (!scene.editorModules.includes('visual')) scene.editorModules.push('visual');
    }
    if (mode === 'text' && scene.visual && !(scene.visual.nodes?.length || scene.visual.background)) {
      delete scene.visual;
      scene.editorModules = scene.editorModules.filter((m) => m !== 'visual');
    }
  }

  function applyDisplayModeToWorkspace(sceneId, displayMode) {
    const viewMap = { text: 'text', visual: 'visual', mixed: 'both' };
    const viewMode = viewMap[displayMode] || 'text';
    if (typeof Editor.setSceneViewMode === 'function') {
      Editor.setSceneViewMode(sceneId, viewMode);
    } else if (Editor.workspace) {
      if (!Editor.workspace.viewModes) Editor.workspace.viewModes = {};
      Editor.workspace.viewModes[sceneId] = viewMode;
    }
  }

  function renderIntentOptions(selected) {
    const types = Array.isArray(Editor.SCENE_TYPES) && Editor.SCENE_TYPES.length
      ? Editor.SCENE_TYPES
      : [{ id: 'custom', icon: '🧩', label: 'Своя сцена' }];
    return types.map((t) => {
      const sel = (selected || 'custom') === t.id ? ' selected' : '';
      return `<option value="${escAttr(t.id)}"${sel}>${esc(t.icon || '')} ${esc(t.label || t.id)}</option>`;
    }).join('');
  }

  function renderDisplayModeOptions(selected) {
    return DISPLAY_MODE_OPTIONS.map(([id, title, hint]) => {
      const sel = (selected || 'text') === id ? ' selected' : '';
      return `<option value="${escAttr(id)}"${sel}>${esc(title)} — ${esc(hint)}</option>`;
    }).join('');
  }

  Object.assign(Editor, {
    openSceneWizard(opts) {
      opts = opts || {};
      if (!Editor.data) {
        Editor.toast.warning('Сначала загрузите или создайте проект');
        return;
      }
      ensureStyles();
      Editor._sceneWizardState = {
        sceneType: opts.sceneType || 'custom',
        displayMode: opts.displayMode || 'text',
        defaultName: opts.defaultName || 'Новая сцена'
      };
      let overlay = document.getElementById('scene-creation-wizard');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'scene-creation-wizard';
        overlay.className = 'scene-wizard-overlay';
        document.body.appendChild(overlay);
      }
      overlay.innerHTML =
        '<div class="scene-wizard-modal" role="dialog" aria-labelledby="scene-wizard-title">' +
        '<h2 id="scene-wizard-title">Новая сцена</h2>' +
        '<p class="hint">Название, намерение (тип сцены) и режим отображения — разные параметры.</p>' +
        '<div class="form-group"><label for="scene-wizard-name">Название</label>' +
        '<input type="text" id="scene-wizard-name" class="form-control" value="' +
        escAttr(Editor._sceneWizardState.defaultName) + '"></div>' +
        '<div class="form-group"><label for="scene-wizard-intent">Намерение</label>' +
        '<select id="scene-wizard-intent" class="form-control">' +
        renderIntentOptions(Editor._sceneWizardState.sceneType) +
        '</select><p class="hint">Жанровый тип: диалог, бой, хаб… Задаёт стартовые блоки редактора.</p></div>' +
        '<div class="form-group"><label for="scene-wizard-display">Режим отображения</label>' +
        '<select id="scene-wizard-display" class="form-control">' +
        renderDisplayModeOptions(Editor._sceneWizardState.displayMode) +
        '</select><p class="hint">Как сцена показывается в workspace: TEXT, Visual или Mixed.</p></div>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">' +
        '<button type="button" class="btn btn-secondary" id="scene-wizard-cancel">Отмена</button>' +
        '<button type="button" class="btn btn-primary" id="scene-wizard-create">Создать</button>' +
        '</div></div>';
      overlay.style.display = 'flex';
      overlay.querySelector('#scene-wizard-cancel').onclick = () => { overlay.style.display = 'none'; };
      overlay.querySelector('#scene-wizard-create').onclick = () => Editor.finishSceneWizard();
      overlay.onclick = (ev) => { if (ev.target === overlay) overlay.style.display = 'none'; };
      overlay.querySelector('#scene-wizard-name')?.focus();
    },

    finishSceneWizard() {
      const name = document.getElementById('scene-wizard-name')?.value?.trim();
      const sceneType = document.getElementById('scene-wizard-intent')?.value || 'custom';
      const displayMode = document.getElementById('scene-wizard-display')?.value || 'text';
      if (!name) return;
      const id = Editor.createSceneWithWizard(name, { sceneType, displayMode });
      const overlay = document.getElementById('scene-creation-wizard');
      if (overlay) overlay.style.display = 'none';
      return id;
    },

    /** @deprecated use openSceneWizard */
    openSceneCreationWizard(opts) {
      return Editor.openSceneWizard(opts);
    },

    /** @deprecated alias */
    openSceneQuickCreate(opts) {
      return Editor.openSceneWizard(opts);
    },

    /** Legacy card picker — kept for tests; redirects to canonical wizard */
    renderSceneWizardTypes() {
      /* no-op: intent is now a select in openSceneWizard */
    },

    /** @deprecated use finishSceneWizard */
    finishSceneCreationWizard() {
      return Editor.finishSceneWizard();
    },

    createSceneWithWizard(name, intentOrPreset, displayMode) {
      if (!Editor.data) return null;
      if (!Editor.data.scenes) Editor.data.scenes = {};
      const parsed = parseWizardIntent(intentOrPreset, displayMode);
      const id = typeof Editor.slugifySceneId === 'function'
        ? Editor.slugifySceneId(name, Editor.data.scenes)
        : (IDX
          ? IDX.slugSceneId(name, Editor.data.scenes)
          : (name.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'scene'));
      const scene = { id, location: name };
      applyIntentToScene(scene, parsed.sceneType, parsed.minimal);
      applyDisplayModeToScene(scene, parsed.displayMode);
      scene.id = id;
      Editor.data.scenes[id] = scene;
      if (!Editor.data.startScene && !Editor.data.meta?.startScene) {
        Editor.data.startScene = id;
      }
      Editor.currentScene = id;
      Editor._sceneModulePickerOpen = false;
      const startScreen = document.getElementById('start-screen');
      if (startScreen) startScreen.style.display = 'none';
      Editor.markDirty?.();
      Editor.renderSceneList?.();
      Editor.switchTab?.('scenes');
      Editor.renderSceneEditor?.();
      Editor.updateJSONPreview?.();
      applyDisplayModeToWorkspace(id, parsed.displayMode);
      if (typeof Editor.openSceneDocument === 'function') Editor.openSceneDocument(id);
      Editor.focusSceneAfterWizard?.(parsed.displayMode === 'visual' ? 'visual' : parsed.sceneType);
      Editor.toast?.success?.('Сцена создана: ' + name);
      return id;
    },

    focusSceneAfterWizard(presetId) {
      if (presetId === 'visual') {
        const sc = currentScene();
        if (sc && !sc.visual) sc.visual = { mode: 'overlay', nodes: [] };
        Editor.renderVisualScenePanel?.();
        document.getElementById('visual-scene-editor-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (presetId === 'empty') {
        Editor.Inspector?.select?.({ type: 'scene', id: Editor.currentScene });
      } else if (presetId === 'dialogue' && typeof Editor.addSceneModule === 'function') {
        /* modules already in preset */
      }
    },

    renderSceneAuthoringPanel() {
      const sid = Editor.currentScene;
      const scene = currentScene();
      if (!sid || !scene || !IDX) return '';
      const writer = isWriter();
      const summary = IDX.buildSceneFlowSummary(sid, Editor.data);
      const hasVisual = !!(scene.visual && (scene.visual.nodes?.length || scene.visual.background));
      const hasText = !!(scene.text && String(scene.text).trim());
      const hasDialogue = !!(scene.dialogue && scene.dialogue.length);
      const hasCombat = !!(scene.combat && scene.combat.length);
      const hasComponents = !!(scene.components && scene.components.length);
      const enterSteps = scene.events?.enter || [];

      let html = '<div class="scene-authoring-panel" id="scene-authoring-panel">';

      html += '<div class="scene-authoring-section"><h4>General</h4>';
      html += `<p><strong>${esc(scene.location || scene.title || sid)}</strong></p>`;
      if (isAdvanced()) html += `<p class="hint">ID: <code>${esc(sid)}</code></p>`;
      html += `<p class="hint">${esc(scene.text || '').slice(0, 120)}${(scene.text || '').length > 120 ? '…' : ''}</p>`;
      html += '</div>';

      html += '<div class="scene-authoring-section"><h4>Content</h4><div class="scene-flow-tags">';
      if (hasText) html += '<span class="scene-flow-tag">📝 Text</span>';
      if (hasVisual) html += '<span class="scene-flow-tag">🖼 Visual</span>';
      if (hasDialogue) html += '<span class="scene-flow-tag">💬 Dialogue</span>';
      if (hasCombat) html += '<span class="scene-flow-tag">⚔️ Combat</span>';
      if (hasComponents) html += '<span class="scene-flow-tag">🧩 Components</span>';
      if (!hasText && !hasVisual && !hasDialogue && !hasCombat && !hasComponents) {
        html += '<span class="hint">Пусто — добавьте модули ниже</span>';
      }
      html += '</div></div>';

      html += '<div class="scene-authoring-section"><h4>Flow — исходящие</h4>';
      if (!summary.outgoing.length) {
        html += '<p class="hint">Нет переходов. Добавьте choice или visual hotspot с change_scene.</p>';
      } else {
        html += '<ul class="scene-conn-list">';
        summary.outgoing.forEach((e) => {
          html += `<li class="scene-conn-item">
            <span>${esc(sid)}</span><span class="scene-conn-arrow">→</span>
            <button type="button" class="btn btn-secondary btn-sm" data-sa-open="${escAttr(e.toId)}">${esc(e.toLabel)}</button>
            <span class="hint">${esc(e.kind)}</span>
            ${e.broken ? '<span class="scene-conn-broken">missing</span>' : ''}
          </li>`;
        });
        html += '</ul>';
      }
      html += '</div>';

      html += '<div class="scene-authoring-section"><h4>Flow — входящие</h4>';
      if (!summary.incoming.length) {
        html += '<p class="hint">Никто не ссылается на эту сцену.</p>';
      } else {
        html += '<ul class="scene-conn-list">';
        summary.incoming.forEach((e) => {
          html += `<li class="scene-conn-item">
            <button type="button" class="btn btn-secondary btn-sm" data-sa-open="${escAttr(e.fromId)}">${esc(e.fromLabel)}</button>
            <span class="scene-conn-arrow">→</span><span>${esc(sid)}</span>
            <span class="hint">${esc(e.kind)}</span>
          </li>`;
        });
        html += '</ul>';
      }
      html += '</div>';

      html += '<div class="scene-authoring-section"><h4>Connections</h4>';
      html += '<div id="scene-conn-add-row">';
      if (typeof Editor.renderEntityPicker === 'function') {
        html += Editor.renderEntityPicker({
          kind: 'scene',
          value: '',
          onChange: 'Editor.addSceneConnectionChoice(this.value)'
        });
      } else {
        html += '<p class="hint">EntityPicker недоступен</p>';
      }
      html += '<p class="hint">Выберите сцену — добавится choice с change_scene через поле «to».</p></div>';
      html += '</div>';

      html += '<div class="scene-authoring-section writer-advanced-only"><h4>Actions — On Enter</h4>';
      if (!enterSteps.length) {
        html += '<p class="hint">Нет scene.events.enter</p>';
      } else {
        html += '<ul class="scene-conn-list">';
        enterSteps.forEach((step, idx) => {
          const dest = step?.params?.sceneId;
          html += `<li class="scene-conn-item">${idx + 1}. ${esc(step.action || '')}`;
          if (dest) html += ` → <code>${esc(dest)}</code>`;
          html += '</li>';
        });
        html += '</ul>';
      }
      html += '<button type="button" class="btn btn-secondary btn-sm" id="scene-authoring-add-enter">+ Enter action</button>';
      html += '<div id="scene-enter-events-panel"></div>';
      if (scene.events?.exit?.length) {
        html += `<p class="hint">exit events: ${scene.events.exit.length} (read-only)</p>`;
      }
      html += '</div>';
      if (enterSteps.length && typeof Editor.formatSceneEnterSummary === 'function') {
        html += `<p class="scene-enter-summary-line writer-only"><span class="scene-enter-summary-label">При входе в сцену:</span> ${esc(Editor.formatSceneEnterSummary(enterSteps))}</p>`;
      }

      html += '<div class="scene-authoring-section"><h4>World overview</h4>';
      html += `<button type="button" class="btn btn-secondary btn-sm" data-sa-graph="1">🗺 Story Flow</button>`;
      html += '</div>';

      html += '</div>';
      return html;
    },

    addSceneConnectionChoice(toSceneId) {
      const scene = currentScene();
      if (!scene || !toSceneId) return;
      if (!Array.isArray(scene.choices)) scene.choices = [];
      const label = IDX ? IDX.sceneLabel(Editor.data, toSceneId) : toSceneId;
      scene.choices.push({
        text: 'Перейти: ' + label,
        to: toSceneId,
        icon: '➡️'
      });
      if (!Array.isArray(scene.editorModules)) scene.editorModules = ['story', 'choices'];
      if (scene.editorModules.indexOf('choices') < 0) scene.editorModules.push('choices');
      Editor.markDirty?.();
      Editor.updateJSONPreview?.();
      Editor.renderSceneEditor?.();
      Editor.toast?.success('Добавлен переход → ' + label);
    },

    bindSceneAuthoringPanel(root) {
      if (!root || root._saBound) return;
      root._saBound = true;
      root.addEventListener('click', (ev) => {
        const open = ev.target.closest('[data-sa-open]');
        if (open) {
          ev.preventDefault();
          const tid = open.getAttribute('data-sa-open');
          if (tid) Editor.openContentEntity?.('scene', tid) || Editor.selectScene?.(tid);
          return;
        }
        if (ev.target.closest('[data-sa-graph]')) {
          Editor.switchTab?.('graph');
          Editor.renderStoryGraphPanel?.();
          return;
        }
        if (ev.target.id === 'scene-authoring-add-enter' || ev.target.closest('#scene-authoring-add-enter')) {
          Editor.openUnifiedActionPicker?.({
            title: 'Действие при входе',
            onSelect(step) { Editor.sceneAddEnterAction?.(step.action, step.params); Editor.renderSceneAuthoringInjected?.(); }
          });
        }
      });
      if (typeof Editor.bindEntityPickers === 'function') {
        Editor.bindEntityPickers(root);
      }
    },

    renderSceneAuthoringInjected() {
      const builder = document.querySelector('#scene-editor .scene-builder');
      if (!builder) return;
      let panel = document.getElementById('scene-authoring-panel');
      const html = Editor.renderSceneAuthoringPanel();
      if (!html) {
        if (panel) panel.remove();
        return;
      }
      if (panel) {
        panel.outerHTML = html;
      } else {
        builder.insertAdjacentHTML('beforeend', html);
      }
      panel = document.getElementById('scene-authoring-panel');
      if (panel) {
        Editor.bindSceneAuthoringPanel(panel);
        Editor.renderSceneEnterEventsPanel?.();
      }
    },

    collectSceneFlowForScene(sceneId) {
      if (!IDX) return null;
      return IDX.buildSceneFlowSummary(sceneId || Editor.currentScene, Editor.data || {});
    }
  });

  (function wrapSceneCreation() {
    if (Editor._createSceneWizardWrapped) return;
    Editor._createSceneWizardWrapped = true;
    if (typeof Editor.createBlankScene === 'function') {
      Editor.createBlankSceneDirect = Editor.createBlankScene.bind(Editor);
    }
    Editor.createScene = function createSceneViaWizard() {
      return Editor.openSceneWizard();
    };
  })();

  Editor.closeTemplateSceneModal = function closeTemplateSceneModal() {
    const modal = document.getElementById('template-scene-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.hidden = true;
    }
  };

  if (Editor.hooks?.after) {
    Editor.hooks.after('renderSceneEditor', function sceneAuthoringInject() {
      if (typeof Editor.shouldShowSceneAuthoringPanel === 'function' && !Editor.shouldShowSceneAuthoringPanel()) {
        return;
      }
      try {
        ensureStyles();
        Editor.renderSceneAuthoringInjected?.();
      } catch (e) {
        console.warn('[phase-112]', e);
      }
    }, 'editor-scene-authoring-phase-112');
  }

  if (Editor.hooks?.after && typeof Editor.renderStoryGraphPanel === 'function') {
    Editor.hooks.after('renderStoryGraphPanel', function sceneFlowHint() {
      const host = document.getElementById('story-graph-editor');
      if (!host || host.querySelector('.scene-flow-phase-112-hint')) return;
      const edges = Editor.collectProjectFlowEdges?.() || [];
      const hint = document.createElement('p');
      hint.className = 'hint scene-flow-phase-112-hint';
      hint.style.margin = '8px 0 0';
      hint.textContent = 'Story Flow (Phase G): ' + edges.length + ' переходов, включая visual / enter / UI.';
      host.insertBefore(hint, host.firstChild);
    }, 'editor-scene-authoring-graph-hint');
  }
})();
