/**
 * Phase 1.18 — Starter projects UX: Create Project → template → Preview
 */
(function attachStarterProjectsPhase118() {
  'use strict';
  if (typeof Editor === 'undefined') {
    console.error('editor-starter-projects-phase-118: Editor missing');
    return;
  }

  const IDX = typeof StarterProjectsIndex !== 'undefined' ? StarterProjectsIndex : null;

  Editor._starterTemplateId = Editor._starterTemplateId || 'blank_rpg';

  Editor.listStarterProjectTemplates = function () {
    if (IDX && IDX.listStarterProjects) return IDX.listStarterProjects();
    return [];
  };

  Editor.buildStarterProjectFromTemplate = function (templateId, title, opts) {
    if (!IDX || !IDX.buildStarterProject) return null;
    return IDX.buildStarterProject(templateId, title, opts || {});
  };

  Editor.getDefaultStarterTemplateId = function () {
    return 'blank_rpg';
  };

  /**
   * After create: open editor test / preview if available.
   */
  Editor.previewNewStarterProject = function () {
    if (typeof Editor.testFromHere === 'function') {
      const sid = Editor.data?.startScene || Editor.currentScene;
      Editor.testFromHere({ sceneId: sid });
      return true;
    }
    if (typeof Editor.openEditorTestPreview === 'function') {
      Editor.openEditorTestPreview();
      return true;
    }
    // Fallback: open game with editorTest keys if preview helper exists
    try {
      if (typeof EditorTestKeys !== 'undefined' && EditorTestKeys.writeProject) {
        EditorTestKeys.writeProject(Editor.data);
      }
      window.open('index.html?editorTest=1', '_blank', 'noopener');
      return true;
    } catch (e) {
      console.warn('[starter] preview failed', e);
      return false;
    }
  };

  function injectTemplatePicker(overlay) {
    if (!overlay || overlay.querySelector('#editor-new-project-template')) return;
    const body = overlay.querySelector('.modal-box-body');
    if (!body) return;
    const list = Editor.listStarterProjectTemplates();
    if (!list.length) return;
    const current = Editor._starterTemplateId || 'blank_rpg';
    const html = `<div class="form-group" id="editor-new-project-template-wrap">
      <label for="editor-new-project-template">Project template</label>
      <div class="np-template-grid" role="listbox" aria-label="Starter templates">
        ${list.map((t) => `
          <button type="button" class="np-template-card ${t.id === current ? 'is-selected' : ''}"
            data-np-template="${Editor.escapeAttr(t.id)}" role="option"
            aria-selected="${t.id === current ? 'true' : 'false'}">
            <span class="np-template-icon">${t.icon || '📋'}</span>
            <span class="np-template-title">${Editor.escapeHtml(t.label || t.id)}</span>
            <span class="np-template-desc hint">${Editor.escapeHtml(t.description || '')}</span>
          </button>`).join('')}
      </div>
      <input type="hidden" id="editor-new-project-template" value="${Editor.escapeAttr(current)}">
      <p class="hint">Blank / Text / Visual / Village — isolated starters. Preview opens after create.</p>
    </div>`;
    // Insert before system select if present
    const sysGroup = body.querySelector('#editor-new-project-system')?.closest('.form-group');
    if (sysGroup) sysGroup.insertAdjacentHTML('beforebegin', html);
    else body.insertAdjacentHTML('afterbegin', html);

    body.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-np-template]');
      if (!btn || !body.contains(btn)) return;
      const id = btn.getAttribute('data-np-template');
      Editor._starterTemplateId = id;
      const hidden = document.getElementById('editor-new-project-template');
      if (hidden) hidden.value = id;
      body.querySelectorAll('[data-np-template]').forEach((b) => {
        const on = b.getAttribute('data-np-template') === id;
        b.classList.toggle('is-selected', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    });
  }

  // Wrap openNewProjectModal
  if (typeof Editor.openNewProjectModal === 'function' && !Editor._npTemplateWrapped) {
    Editor._npTemplateWrapped = true;
    const prevOpen = Editor.openNewProjectModal.bind(Editor);
    Editor.openNewProjectModal = function openNewProjectModalPhase118() {
      prevOpen();
      const overlay = document.getElementById('editor-new-project-modal');
      injectTemplatePicker(overlay);
      Editor._starterTemplateId = Editor._starterTemplateId || 'blank_rpg';
      const hidden = document.getElementById('editor-new-project-template');
      if (hidden) hidden.value = Editor._starterTemplateId;
    };
  }

  // Wrap confirmNewProject
  if (typeof Editor.confirmNewProject === 'function' && !Editor._npConfirmWrapped) {
    Editor._npConfirmWrapped = true;
    const prevConfirm = Editor.confirmNewProject.bind(Editor);
    Editor.confirmNewProject = function confirmNewProjectPhase118() {
      const title = (document.getElementById('editor-new-project-name')?.value || '').trim();
      if (!title) {
        prevConfirm();
        return;
      }
      const templateId =
        document.getElementById('editor-new-project-template')?.value ||
        Editor._starterTemplateId ||
        'blank_rpg';
      const systemId = document.getElementById('editor-new-project-system')?.value
        || (typeof SystemRegistry !== 'undefined' ? SystemRegistry.getDefault() : 'generic');

      // Prefer starter template builders for the four starters
      const starters = (IDX && IDX.STARTER_IDS) || [];
      if (starters.indexOf(templateId) >= 0 && IDX.buildStarterProject) {
        let data = IDX.buildStarterProject(templateId, title, {
          system: systemId === 'pf2e' ? 'pf2e' : (systemId || 'generic'),
          villageData: typeof DEMO_VISUAL_VILLAGE_DATA !== 'undefined' ? DEMO_VISUAL_VILLAGE_DATA : null
        });
        if (!data) {
          prevConfirm();
          return;
        }
        // Preserve system selection when blank/text/visual
        if (templateId !== 'village_demo') {
          data.meta = data.meta || {};
          data.meta.system = systemId;
          data.system = systemId;
        }
        if (typeof ThemeSystem !== 'undefined') {
          try { ThemeSystem.ensureInData(data); } catch (e) { /* */ }
        }
        Editor.data = data;
        Editor.currentScene = data.startScene || Object.keys(data.scenes || {})[0] || 'start';
        if (typeof Editor.applyThemeFromData === 'function') Editor.applyThemeFromData();
        Editor.closeNewProjectModal();
        Editor.renderAll?.();
        Editor.updateProjectPanel?.();
        Editor.updateJSONPreview?.();
        if (typeof Editor.showDashboard === 'function') Editor.showDashboard();
        const label = (IDX.CATALOG.find((c) => c.id === templateId) || {}).label || templateId;
        if (Editor.toast) Editor.toast.success('Project created: ' + label);
        else if (typeof alert === 'function') {
          /* soft: skip blocking alert when toast exists; use toast path */
        }
        // Immediately Preview
        setTimeout(() => {
          Editor.previewNewStarterProject();
        }, 50);
        return;
      }
      prevConfirm();
    };
  }

  if (!document.getElementById('starter-projects-phase-118-styles')) {
    const st = document.createElement('style');
    st.id = 'starter-projects-phase-118-styles';
    st.textContent = `
      .np-template-grid {
        display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px;
      }
      .np-template-card {
        display: flex; flex-direction: column; align-items: flex-start; gap: 2px;
        text-align: left; padding: 10px; border: 1px solid var(--border, #ccc);
        border-radius: 8px; background: #fff; cursor: pointer; width: 100%;
      }
      .np-template-card.is-selected {
        border-color: var(--accent, #8b4513); box-shadow: 0 0 0 2px rgba(139,69,19,0.2);
      }
      .np-template-icon { font-size: 1.25rem; }
      .np-template-title { font-weight: 600; font-size: 13px; }
      .np-template-desc { font-size: 11px; line-height: 1.3; }
      @media (max-width: 560px) {
        .np-template-grid { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(st);
  }

  if (Editor.hooks && typeof Editor.hooks.register === 'function') {
    Editor.hooks.register('editor-starter-projects-phase-118', {
      listStarterProjectTemplates: Editor.listStarterProjectTemplates,
      buildStarterProjectFromTemplate: Editor.buildStarterProjectFromTemplate,
      previewNewStarterProject: Editor.previewNewStarterProject
    }, { force: true });
  }

  console.info('[Phase 1.18] Starter projects ready');
})();
