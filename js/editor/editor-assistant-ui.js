/**
 * UI панели «Опиши сцену» — превью диффа и применение черновика.
 */
(function attachEditorAssistantUi() {
  'use strict';
  function tr(key, params) {
    if (typeof I18n !== 'undefined' && typeof I18n.t === 'function') return I18n.t(key, params);
    if (typeof t === 'function') return t(key, params);
    return key;
  }

  if (typeof Editor === 'undefined' || !Editor.assistant) return;

  const esc = (s) => (typeof Editor.escapeHtml === 'function' ? Editor.escapeHtml(String(s ?? '')) : String(s ?? ''));
  const escAttr = (s) => (typeof Editor.escapeAttr === 'function' ? Editor.escapeAttr(String(s ?? '')) : String(s ?? '').replace(/"/g, '&quot;'));

  const STORAGE_KEY = 'rpg_editor_scene_assistant';
  let currentPlan = null;
  let saveInputTimer = null;

  function readState() {
    if (!Editor.workspace) Editor.workspace = {};
    if (!Editor.workspace.sceneAssistant) {
      Editor.workspace.sceneAssistant = { description: '' };
    }
    return Editor.workspace.sceneAssistant;
  }

  function loadFromStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed.description === 'string') {
        readState().description = parsed.description;
      }
    } catch (e) { /* */ }
  }

  function saveToStorage(description) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ description: description || '' }));
    } catch (e) { /* */ }
  }

  function scheduleSaveInput(value) {
    readState().description = value;
    if (saveInputTimer) clearTimeout(saveInputTimer);
    saveInputTimer = setTimeout(() => {
      saveToStorage(value);
      saveInputTimer = null;
    }, 300);
  }

  function flushInputSave(value) {
    if (saveInputTimer) {
      clearTimeout(saveInputTimer);
      saveInputTimer = null;
    }
    readState().description = value;
    saveToStorage(value);
  }

  function clearSavedInput() {
    readState().description = '';
    saveToStorage('');
  }

  function restorePreview(preview, applyBtn) {
    if (!currentPlan?.ok || !preview) return;
    preview.innerHTML = Editor.assistant.formatDraftDiff(currentPlan);
    if (currentPlan.needsReviewCount > 0) {
      preview.innerHTML += '<p class="scene-assistant-review">' + esc(tr('editor.assistantUi.reviewCount', { count: currentPlan.needsReviewCount })) + '</p>';
    }
    if (applyBtn) applyBtn.disabled = false;
  }

  loadFromStorage();

  function ensureStyles() {
    if (document.getElementById('editor-assistant-styles')) return;
    const st = document.createElement('style');
    st.id = 'editor-assistant-styles';
    st.textContent = `
      .scene-assistant-panel {
        margin: 12px 0 16px;
        padding: 14px 16px;
        border: 1px solid var(--border, #ccc);
        border-radius: 10px;
        background: var(--card-bg, #fff);
      }
      .scene-assistant-panel h3 { margin: 0 0 8px; font-size: 16px; }
      .scene-assistant-panel textarea {
        width: 100%;
        min-height: 88px;
        font: inherit;
        padding: 10px 12px;
        border-radius: 8px;
        border: 1px solid var(--border, #ccc);
        resize: vertical;
      }
      .scene-assistant-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
      .scene-assistant-preview {
        margin-top: 12px;
        padding: 12px;
        border-radius: 8px;
        background: var(--paper-dark, #f5f0e8);
        border: 1px dashed var(--border, #ccc);
        font-size: 14px;
      }
      .scene-assistant-review { color: var(--warning, #b8860b); font-weight: 600; }
      .scene-assistant-diff ul { margin: 6px 0 10px 18px; }
      body.editor-touch .scene-assistant-actions .btn { min-height: 44px; }
    `;
    document.head.appendChild(st);
  }

  function ensureMount() {
    const tab = document.getElementById('tab-scenes');
    if (!tab) return null;
    let mount = document.getElementById('scene-assistant-mount');
    if (!mount) {
      mount = document.createElement('div');
      mount.id = 'scene-assistant-mount';
      tab.insertBefore(mount, tab.firstChild);
    }
    return mount;
  }

  function renderPanel() {
    if (typeof document === 'undefined') return;
    ensureStyles();
    const mount = ensureMount();
    if (!mount) return;

    const hasProject = !!(Editor.data && Editor.data.scenes);
    if (!hasProject) {
      mount.innerHTML = '';
      return;
    }

    mount.innerHTML = `
      <section class="scene-assistant-panel" aria-label="${escAttr(tr('editor.assistantUi.panelAriaLabel'))}">
        <h3>${esc(tr('editor.assistantUi.panelTitle'))}</h3>
        <p class="hint">${esc(tr('editor.assistantUi.panelHint'))}</p>
        <textarea id="scene-assistant-input" placeholder="${escAttr(tr('editor.assistantUi.inputPlaceholder'))}"></textarea>
        <div class="scene-assistant-actions">
          <button type="button" class="btn btn-secondary" id="scene-assistant-draft-btn">${esc(tr('editor.assistantUi.draftBtn'))}</button>
          <button type="button" class="btn btn-primary" id="scene-assistant-apply-btn" disabled>${esc(tr('editor.assistantUi.applyBtn'))}</button>
        </div>
        <div class="scene-assistant-preview" id="scene-assistant-preview">
          <p class="hint">${esc(tr('editor.assistantUi.previewHint'))}</p>
        </div>
      </section>`;

    const input = document.getElementById('scene-assistant-input');
    const draftBtn = document.getElementById('scene-assistant-draft-btn');
    const applyBtn = document.getElementById('scene-assistant-apply-btn');
    const preview = document.getElementById('scene-assistant-preview');

    if (input) {
      input.value = readState().description || '';
      input.addEventListener('input', () => scheduleSaveInput(input.value));
      input.addEventListener('blur', () => flushInputSave(input.value));
    }

    restorePreview(preview, applyBtn);

    draftBtn?.addEventListener('click', () => {
      const text = input?.value?.trim() || '';
      if (!text) {
        Editor.toast?.warning?.(tr('editor.assistantUi.emptyDescriptionWarning'));
        return;
      }
      flushInputSave(input?.value || '');
      currentPlan = Editor.assistant.draftScene(text);
      if (!currentPlan.ok) {
        preview.innerHTML = '<p class="hint">' + esc(tr('editor.assistantUi.error', { errors: (currentPlan.errors || []).join(', ') })) + '</p>';
        applyBtn.disabled = true;
        return;
      }
      preview.innerHTML = Editor.assistant.formatDraftDiff(currentPlan);
      if (currentPlan.needsReviewCount > 0) {
        preview.innerHTML += '<p class="scene-assistant-review">' + esc(tr('editor.assistantUi.reviewCount', { count: currentPlan.needsReviewCount })) + '</p>';
      }
      applyBtn.disabled = false;
    });

    applyBtn?.addEventListener('click', () => {
      if (!currentPlan?.ok) return;
      const result = Editor.assistant.applyDraft(currentPlan);
      if (result.ok) {
        currentPlan = null;
        if (input) input.value = '';
        clearSavedInput();
        applyBtn.disabled = true;
        preview.innerHTML = '<p class="hint">' + tr('editor.assistantUi.sceneCreated', { sceneId: '<code>' + esc(result.sceneId || '') + '</code>' }) + '</p>';
      }
    });
  }

  Editor.renderSceneAssistantPanel = renderPanel;
  Editor.getSceneAssistantInputState = readState;
  Editor.flushSceneAssistantInputSave = flushInputSave;

  if (Editor.hooks && typeof Editor.hooks.after === 'function') {
    Editor.hooks.after('switchTab', function (_r, args) {
      const tab = args && args[0];
      if (tab === 'scenes') renderPanel();
    });
    Editor.hooks.after('editorAppBootstrap', function () {
      renderPanel();
    });
    Editor.hooks.after('loadData', function () {
      loadFromStorage();
      renderPanel();
    });
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(renderPanel, 0));
  }
})();
