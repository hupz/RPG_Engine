/**
 * UI панели «Опиши сцену» — превью диффа и применение черновика.
 */
(function attachEditorAssistantUi() {
  'use strict';

  if (typeof Editor === 'undefined' || !Editor.assistant) return;

  let currentPlan = null;

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
      <section class="scene-assistant-panel" aria-label="Опиши сцену">
        <h3>✨ Опиши сцену текстом</h3>
        <p class="hint">Черновик собирается только из шаблонов, writerSafe-действий и условий каталога — без произвольного JSON.</p>
        <textarea id="scene-assistant-input" placeholder="Например: Таверна — диалог с барменом; выбор — пойти в лес или вернуться в деревню"></textarea>
        <div class="scene-assistant-actions">
          <button type="button" class="btn btn-secondary" id="scene-assistant-draft-btn">Сформировать черновик</button>
          <button type="button" class="btn btn-primary" id="scene-assistant-apply-btn" disabled>Применить</button>
        </div>
        <div class="scene-assistant-preview" id="scene-assistant-preview">
          <p class="hint">Введите описание и нажмите «Сформировать черновик».</p>
        </div>
      </section>`;

    const input = document.getElementById('scene-assistant-input');
    const draftBtn = document.getElementById('scene-assistant-draft-btn');
    const applyBtn = document.getElementById('scene-assistant-apply-btn');
    const preview = document.getElementById('scene-assistant-preview');

    draftBtn?.addEventListener('click', () => {
      const text = input?.value?.trim() || '';
      if (!text) {
        Editor.toast?.warning?.('Введите описание сцены');
        return;
      }
      currentPlan = Editor.assistant.draftScene(text);
      if (!currentPlan.ok) {
        preview.innerHTML = '<p class="hint">Ошибка: ' + (currentPlan.errors || []).join(', ') + '</p>';
        applyBtn.disabled = true;
        return;
      }
      preview.innerHTML = Editor.assistant.formatDraftDiff(currentPlan);
      if (currentPlan.needsReviewCount > 0) {
        preview.innerHTML += '<p class="scene-assistant-review">⚠ Элементов на проверку: ' + currentPlan.needsReviewCount + ' (не будут применены молча)</p>';
      }
      applyBtn.disabled = false;
    });

    applyBtn?.addEventListener('click', () => {
      if (!currentPlan?.ok) return;
      const result = Editor.assistant.applyDraft(currentPlan);
      if (result.ok) {
        currentPlan = null;
        if (input) input.value = '';
        applyBtn.disabled = true;
        preview.innerHTML = '<p class="hint">Сцена создана: <code>' + (result.sceneId || '') + '</code></p>';
      }
    });
  }

  Editor.renderSceneAssistantPanel = renderPanel;

  if (Editor.hooks && typeof Editor.hooks.after === 'function') {
    Editor.hooks.after('switchTab', function (_r, args) {
      const tab = args && args[0];
      if (tab === 'scenes') renderPanel();
    });
    Editor.hooks.after('editorAppBootstrap', function () {
      renderPanel();
    });
    Editor.hooks.after('loadData', function () {
      renderPanel();
    });
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(renderPanel, 0));
  }
})();
