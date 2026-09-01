// ============================================================
// Validator UX 2.0 (UI-21) — human issues + Open and Fix navigation
// Extends editor-project-validator-ux.js; no validator semantics changes.
// ============================================================
(function attachValidatorNavigation() {
  'use strict';
  if (typeof Editor === 'undefined') return;

  const ISSUE_TITLES = Object.freeze({
    missing_scene: 'Broken Scene Link',
    broken_transition: 'Broken Scene Link',
    element_missing_scene: 'Broken Scene Link',
    missing_item: 'Missing Item Reference',
    missing_quest: 'Missing Quest Reference',
    missing_npc: 'Missing Character Reference',
    missing_enemy: 'Missing Enemy Reference',
    missing_asset_ref: 'Missing Asset',
    missing_asset_src: 'Empty Asset Source',
    empty_asset: 'Empty Asset',
    unknown_action: 'Unknown Action',
    action_not_in_catalog: 'Unknown Action',
    missing_action_id: 'Invalid Action',
    malformed_action: 'Malformed Action',
    action_js_call: 'Unsafe Action',
    missing_action_param: 'Incomplete Action',
    malformed_condition: 'Invalid Condition',
    invalid_quest_stage: 'Invalid Quest Stage',
    invalid_amount: 'Invalid Number',
    invalid_combat_params: 'Invalid Combat Setup',
    no_scenes: 'No Scenes',
    empty_scene: 'Empty Scene',
    orphan_scene: 'Unreachable Scene',
    unreachable_scene: 'Unreachable Scene',
    duplicate_id: 'Duplicate ID',
    npc_no_description: 'Missing NPC Description',
    export_no_scenes: 'Export Blocked',
    export_old_data_version: 'Outdated Data Version',
    macro_id_in_json: 'Macro in JSON'
  });

  function esc(s) {
    return typeof Editor.escapeHtml === 'function' ? Editor.escapeHtml(s) : String(s ?? '');
  }

  function parseJsonPath(path) {
    if (!path) return {};
    const out = {};
    const sceneMatch = String(path).match(/^scenes\.([^.[\]]+)/);
    if (sceneMatch) out.sceneId = sceneMatch[1];
    const choiceMatch = String(path).match(/choices\[(\d+)\]/);
    if (choiceMatch) out.choiceIndex = parseInt(choiceMatch[1], 10);
    const nodeBracket = String(path).match(/visual\.nodes\[([^\]]+)\]/);
    const nodeDot = String(path).match(/visual\.nodes\.([^.[\]]+)/);
    if (nodeBracket) out.nodeId = nodeBracket[1];
    else if (nodeDot) out.nodeId = nodeDot[1];
    if (/visual|hotspot|nodes/i.test(path)) out.section = 'visual';
    else if (/choices/i.test(path)) out.section = 'choices';
    else if (/showIf|condition/i.test(path)) out.section = 'conditions';
    else if (/actions|onEnter|onExit/i.test(path)) out.section = 'content';
    const fieldMatch = String(path).match(/\.([a-zA-Z0-9_]+)$/);
    if (fieldMatch) out.field = fieldMatch[1];
    return out;
  }

  function sceneLabel(data, sceneId) {
    const scene = data?.scenes?.[sceneId];
    return scene?.location || scene?.title || sceneId || '—';
  }

  function sectionLabel(sectionId) {
    const map = {
      content: 'Content',
      choices: 'Choices',
      visual: 'Visual',
      conditions: 'Conditions',
      game_ui: 'Game UI',
      advanced: 'Advanced'
    };
    return map[sectionId] || sectionId || '';
  }

  function getIssueTitle(issue) {
    if (issue.title) return issue.title;
    const raw = issue.raw || issue;
    const type = raw.type || issue.type;
    if (type && ISSUE_TITLES[type]) return ISSUE_TITLES[type];
    if (issue.severity === 'warning') return 'Warning';
    if (issue.severity === 'info') return 'Suggestion';
    return 'Validation Issue';
  }

  function getIssueDescription(issue, data) {
    if (issue.description) return issue.description;
    const raw = issue.raw || issue;
    const message = String(issue.message || raw.message || '').trim();
    const type = raw.type || issue.type;
    const targetId = raw.targetId || issue.targetId;
    const sceneId = raw.sceneId || issue.sceneId || issue.object?.id;
    const pathCtx = parseJsonPath(raw.path || issue.path || '');

    if ((type === 'missing_scene' || type === 'broken_transition' || type === 'element_missing_scene') && targetId) {
      const choiceIdx = raw.choiceIndex ?? issue.choiceIndex ?? pathCtx.choiceIndex;
      const scene = data?.scenes?.[sceneId || pathCtx.sceneId];
      let trigger = 'element';
      if (choiceIdx != null && scene?.choices?.[choiceIdx]) {
        trigger = 'button "' + (scene.choices[choiceIdx].text || ('Choice ' + (choiceIdx + 1))) + '"';
      } else if (pathCtx.nodeId) {
        const node = (scene?.visual?.nodes || []).find((n) => n.id === pathCtx.nodeId);
        trigger = 'object "' + (node?.label || pathCtx.nodeId) + '"';
      }
      return 'The ' + trigger + ' points to a scene that does not exist (' + targetId + ').';
    }
    if (type === 'missing_item' && (raw.entityId || targetId)) {
      return 'An action references item "' + (raw.entityId || targetId) + '" which is not in the project.';
    }
    if (type === 'missing_npc' && (raw.entityId || targetId)) {
      return 'An action references character "' + (raw.entityId || targetId) + '" which is not in the project.';
    }
    if (type === 'missing_enemy' && (raw.entityId || targetId)) {
      return 'An action references enemy "' + (raw.entityId || targetId) + '" which is not in the project.';
    }
    if (type === 'empty_scene') {
      return 'This scene has no text, choices, or visual content for the player.';
    }
    return message || 'Review this issue in the editor.';
  }

  function getIssueLocation(issue, data) {
    if (issue.location) return issue.location;
    const raw = issue.raw || issue;
    const pathCtx = parseJsonPath(raw.path || issue.path || '');
    const sceneId = raw.sceneId || issue.sceneId || issue.object?.id || pathCtx.sceneId;
    const parts = [];

    if (sceneId) parts.push(sceneLabel(data, sceneId));
    const section = issue.section || pathCtx.section
      || (typeof Editor.resolveSceneWorkspaceSection === 'function'
        ? null
        : null);
    let sectionId = section;
    if (!sectionId && raw.field) {
      if (/choice|\.to$/i.test(raw.field + (issue.path || ''))) sectionId = 'choices';
      else if (/visual|node|hotspot/i.test(raw.field + (issue.path || ''))) sectionId = 'visual';
      else if (/condition|showIf/i.test(raw.field + (issue.path || ''))) sectionId = 'conditions';
    }
    if (!sectionId && pathCtx.section) sectionId = pathCtx.section;

    if (sectionId) {
      let loc = sectionLabel(sectionId);
      if (pathCtx.nodeId) loc += ' → ' + pathCtx.nodeId;
      else if (pathCtx.choiceIndex != null) {
        const scene = data?.scenes?.[sceneId];
        const ch = scene?.choices?.[pathCtx.choiceIndex];
        loc += ' → ' + (ch?.text || ('Choice ' + (pathCtx.choiceIndex + 1)));
      } else if (issue.path) {
        loc += ' → ' + issue.path;
      }
      parts.push(loc);
    } else if (issue.path) {
      parts.push(issue.path);
    } else if (issue.objectLabel) {
      parts.push(issue.objectLabel);
    }

    return parts.filter(Boolean).join('\n');
  }

  function ensureOpenAction(issue, data) {
    if (issue.action || (Array.isArray(issue.actions) && issue.actions.length)) return issue;

    const raw = issue.raw || issue;
    const pathCtx = parseJsonPath(raw.path || issue.path || '');
    const sceneId = raw.sceneId || issue.sceneId || pathCtx.sceneId;
    const entityType = raw.entityType || issue.object?.type;
    const entityId = raw.entityId || issue.object?.id;

    const openSceneFn = () => {
      if (typeof Editor.openValidationIssueInWorkspace === 'function') {
        Editor.openValidationIssueInWorkspace({
          sceneId,
          field: raw.field || pathCtx.field,
          choiceIndex: raw.choiceIndex ?? pathCtx.choiceIndex,
          nodeId: raw.nodeId || pathCtx.nodeId,
          section: pathCtx.section
        });
      } else if (typeof Editor.openSceneWorkspace === 'function') {
        Editor.openSceneWorkspace(sceneId, { section: pathCtx.section });
      }
    };

    if (sceneId && (entityType === 'scene' || raw.type?.includes('scene') || pathCtx.sceneId)) {
      issue.action = { label: 'Open and Fix', run: openSceneFn };
      return issue;
    }
    if (entityType === 'quest' || raw.questId) {
      const qid = raw.questId || entityId;
      issue.action = {
        label: 'Open and Fix',
        run: () => {
          if (typeof Editor.switchTab === 'function') Editor.switchTab('quests');
          if (typeof Editor.selectQuestToEdit === 'function') Editor.selectQuestToEdit(qid);
        }
      };
      return issue;
    }
    if (entityType === 'npc' || raw.npcId) {
      const nid = raw.npcId || entityId;
      issue.action = {
        label: 'Open and Fix',
        run: () => {
          if (typeof Editor.switchTab === 'function') Editor.switchTab('npcs');
          if (typeof Editor.selectNpcToEdit === 'function') Editor.selectNpcToEdit(nid);
        }
      };
      return issue;
    }
    if (entityType === 'item' || raw.itemId) {
      const iid = raw.itemId || entityId;
      issue.action = {
        label: 'Open and Fix',
        run: () => {
          if (typeof Editor.switchTab === 'function') Editor.switchTab('items');
          if (typeof Editor.selectItemToEdit === 'function') Editor.selectItemToEdit(iid);
        }
      };
      return issue;
    }
    if (entityType === 'enemy' || raw.enemyId) {
      const eid = raw.enemyId || entityId;
      issue.action = {
        label: 'Open and Fix',
        run: () => {
          if (typeof Editor.switchTab === 'function') Editor.switchTab('enemies');
          if (typeof Editor.selectEnemyToEdit === 'function') Editor.selectEnemyToEdit(eid);
        }
      };
      return issue;
    }
    if (raw.tab) {
      issue.action = {
        label: 'Open',
        run: () => { if (typeof Editor.switchTab === 'function') Editor.switchTab(raw.tab); }
      };
    }
    return issue;
  }

  function enrichProjectIssue(issue, data) {
    if (!issue) return issue;
    ensureOpenAction(issue, data);
    issue.title = getIssueTitle(issue);
    issue.description = getIssueDescription(issue, data);
    issue.location = getIssueLocation(issue, data);
    if (issue.action && !issue.fixable && issue.action.label === 'Открыть') {
      issue.action.label = 'Open and Fix';
    }
    return issue;
  }

  function renderIssueCard(iss, idx) {
    const icon = iss.severity === 'error' ? '🔴' : (iss.severity === 'warning' ? '🟡' : '🔵');
    const acts = Array.isArray(iss.actions) && iss.actions.length
      ? iss.actions
      : (iss.action ? [iss.action] : []);
    const primary = acts[0];
    const primaryLabel = primary
      ? (primary.label === 'Открыть' || primary.label === 'Исправить' ? 'Open and Fix' : primary.label)
      : '';
    const actionBtns = primary
      ? '<button type="button" class="btn btn-primary btn-sm" data-issue-action="' + idx + '" data-action-i="0">' +
        esc(primaryLabel) + '</button>'
      : '';
    const extraBtns = acts.slice(1).map((a, ai) =>
      '<button type="button" class="btn btn-secondary btn-sm" data-issue-action="' + idx + '" data-action-i="' + (ai + 1) + '">' +
      esc(a.label || 'Open') + '</button>'
    ).join('');
    const fixBtn = iss.fixable && typeof iss.fix === 'function'
      ? '<button type="button" class="btn btn-secondary btn-sm" data-issue-fix="' + idx + '" title="' +
        esc(iss.fixPreview || 'Auto-fix') + '">Auto-fix</button>'
      : '';
    const locationHtml = iss.location
      ? '<div class="pv-issue-location">' + esc(iss.location).replace(/\n/g, '<br>') + '</div>'
      : (iss.path ? '<div class="pv-issue-location">' + esc(iss.path) + '</div>' : '');

    return '<li class="pv-issue pv-issue--' + esc(iss.severity) + '" data-issue-id="' + esc(iss.id) + '">' +
      '<div class="pv-issue-icon">' + icon + '</div>' +
      '<div class="pv-issue-body">' +
      '<div class="pv-issue-severity">' + esc(String(iss.severity || 'error').toUpperCase()) + '</div>' +
      '<div class="pv-issue-title">' + esc(iss.title || getIssueTitle(iss)) + '</div>' +
      '<div class="pv-issue-desc">' + esc(iss.description || iss.message) + '</div>' +
      locationHtml +
      (iss.fixPreview ? '<div class="pv-issue-path">Auto-fix: ' + esc(iss.fixPreview) + '</div>' : '') +
      '<div class="pv-issue-actions">' + actionBtns + extraBtns + fixBtn + '</div>' +
      '</div></li>';
  }

  function renderGroupedIssueList(items) {
    const errors = items.filter((i) => i.severity === 'error');
    const warnings = items.filter((i) => i.severity === 'warning');
    const infos = items.filter((i) => i.severity === 'info');

    function groupBlock(label, list, severity) {
      if (!list.length) return '';
      const cards = list.map((iss) => renderIssueCard(iss, items.indexOf(iss))).join('');
      return '<section class="pv-group pv-group--' + severity + '">' +
        '<h3 class="pv-group__title">' + esc(label) + ' <span class="pv-group__count">' + list.length + '</span></h3>' +
        '<ul class="pv-issue-list pv-issue-list--group">' + cards + '</ul></section>';
    }

    if (!items.length) {
      return '<ul class="pv-issue-list"><li class="pv-issue pv-issue--ok"><div class="pv-issue-body">✓ No issues found</div></li></ul>';
    }

    return groupBlock('ERRORS', errors, 'error') +
      groupBlock('WARNINGS', warnings, 'warning') +
      groupBlock('INFO', infos, 'info');
  }

  function bindValidationModal(modal, items) {
    modal.onclick = (e) => {
      if (e.target.closest('[data-pv-close]')) {
        modal.classList.add('hidden');
        return;
      }
      if (e.target.closest('[data-pv-recheck]')) {
        Editor.runProjectValidation();
        return;
      }
      if (e.target.closest('[data-pv-fixall]')) {
        Editor.autofixProjectIssues();
        return;
      }
      const act = e.target.closest('[data-issue-action]');
      if (act) {
        const iss = items[parseInt(act.getAttribute('data-issue-action'), 10)];
        const ai = parseInt(act.getAttribute('data-action-i') || '0', 10);
        const acts = Array.isArray(iss?.actions) && iss.actions.length ? iss.actions : (iss?.action ? [iss.action] : []);
        const chosen = acts[ai] || acts[0];
        if (chosen?.run) {
          modal.classList.add('hidden');
          chosen.run();
        }
        return;
      }
      const fx = e.target.closest('[data-issue-fix]');
      if (fx) {
        const iss = items[parseInt(fx.getAttribute('data-issue-fix'), 10)];
        if (iss?.fix) {
          try {
            iss.fix();
            Editor.updateJSONPreview?.();
            Editor.toast?.success?.('Fixed');
            Editor.runProjectValidation();
          } catch (err) {
            Editor.toast?.error?.(String(err.message || err));
          }
        }
      }
    };
  }

  function patchCollectProjectIssues() {
    if (!Editor.collectProjectIssues || Editor._validatorNavCollectPatched) return;
    const orig = Editor.collectProjectIssues.bind(Editor);
    Editor.collectProjectIssues = function collectProjectIssuesNav() {
      const result = orig();
      const data = this.data;
      result.issues = (result.issues || []).map((iss) => enrichProjectIssue(iss, data));
      result.errors = result.issues.filter((i) => i.severity === 'error');
      result.warnings = result.issues.filter((i) => i.severity === 'warning');
      result.info = result.issues.filter((i) => i.severity === 'info');
      result.ok = result.errors.length === 0;
      this._lastProjectIssues = result;
      return result;
    };
    Editor._validatorNavCollectPatched = true;
  }

  function patchShowProjectValidationResults() {
    if (!Editor.showProjectValidationResults || Editor._validatorNavShowPatched) return;
    const orig = Editor.showProjectValidationResults.bind(Editor);
    Editor.showProjectValidationResults = function showProjectValidationResultsNav(result) {
      result = result || Editor.collectProjectIssues();
      const data = Editor.data;
      const items = (result.issues || []).map((iss) => enrichProjectIssue(iss, data));
      result.issues = items;
      result.errors = items.filter((i) => i.severity === 'error');
      result.warnings = items.filter((i) => i.severity === 'warning');
      result.info = items.filter((i) => i.severity === 'info');

      let modal = document.getElementById('editor-project-validation-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'editor-project-validation-modal';
        modal.className = 'editor-modal';
        document.body.appendChild(modal);
      }

      const infoCount = result.info?.length || 0;
      const listHtml = renderGroupedIssueList(items);
      const fixableCount = items.filter((i) => i.fixable).length;

      modal.innerHTML =
        '<div class="editor-modal-backdrop" data-pv-close="1"></div>' +
        '<div class="editor-modal-panel editor-modal-panel--wide pv-modal-panel">' +
        '<div class="quest-detail-head">' +
        '<h2>Project Validation</h2>' +
        '<button type="button" class="btn-remove" data-pv-close="1">×</button>' +
        '</div>' +
        '<div class="pv-summary">' +
        '<span class="pv-count pv-count--error">ERRORS ' + result.errors.length + '</span>' +
        '<span class="pv-count pv-count--warning">WARNINGS ' + result.warnings.length + '</span>' +
        (infoCount ? '<span class="pv-count pv-count--info">INFO ' + infoCount + '</span>' : '') +
        '</div>' +
        listHtml +
        '<div class="pv-footer">' +
        '<button type="button" class="btn btn-secondary" data-pv-close="1">Close</button>' +
        '<button type="button" class="btn btn-secondary" data-pv-recheck="1">Re-check</button>' +
        '<button type="button" class="btn btn-primary" data-pv-fixall="1"' +
        (fixableCount ? '' : ' disabled') + '>Auto-fix safe issues (' + fixableCount + ')</button>' +
        '</div></div>';
      modal.classList.remove('hidden');
      bindValidationModal(modal, items);
    };
    Editor._validatorNavShowPatched = true;
  }

  function patchExportGuard() {
    if (!Editor.guardExportWithValidation || Editor._validatorNavExportPatched) return;
    const orig = Editor.guardExportWithValidation.bind(Editor);
    Editor.guardExportWithValidation = function guardExportWithValidationNav(opts) {
      opts = opts || {};
      const result = this.validateProjectExportReady();
      this._lastExportValidation = result;
      if (result.ok) return true;
      if (opts.force) return true;

      const errCount = result.errors.length;
      const warnCount = result.warnings.length;

      if (typeof this.refreshValidationUI === 'function') {
        try { this.refreshValidationUI(); } catch (e) { /* */ }
      }

      if (errCount > 0) {
        if (typeof this.showProjectValidationResults === 'function') {
          const normalized = (result.issues || []).map((iss) => {
            const n = typeof Editor.ValidatorNav?.enrichIssue === 'function'
              ? Editor.ValidatorNav.enrichIssue(iss, this.data)
              : iss;
            return n;
          });
          this.showProjectValidationResults({
            ok: false,
            issues: normalized,
            errors: normalized.filter((i) => i.severity === 'error'),
            warnings: normalized.filter((i) => i.severity === 'warning'),
            info: normalized.filter((i) => i.severity === 'info')
          });
        }
        if (Editor.toast) {
          Editor.toast.error('Export blocked: ' + errCount + ' critical error(s)');
        }
        return false;
      }

      if (warnCount > 0 && Editor.toast) {
        Editor.toast.info('Export allowed with ' + warnCount + ' warning(s)');
      }
      return true;
    };
    Editor._validatorNavExportPatched = true;
  }

  function patchNavigateToValidationIssue() {
    if (typeof Editor.navigateToValidationIssue !== 'function' || Editor._validatorNavLegacyPatched) return;
    const orig = Editor.navigateToValidationIssue.bind(Editor);
    Editor.navigateToValidationIssue = function navigateToValidationIssueNav(issue) {
      const enriched = enrichProjectIssue(normalizeExportIssue(issue), Editor.data);
      if (enriched.action?.run) {
        enriched.action.run();
        return true;
      }
      if (typeof Editor.openValidationIssueInWorkspace === 'function') {
        const raw = enriched.raw || enriched;
        const pathCtx = parseJsonPath(raw.path || enriched.path || '');
        if (Editor.openValidationIssueInWorkspace({
          sceneId: raw.sceneId || enriched.sceneId || pathCtx.sceneId,
          questId: raw.questId || enriched.questId,
          field: raw.field || pathCtx.field,
          choiceIndex: raw.choiceIndex ?? pathCtx.choiceIndex,
          nodeId: raw.nodeId || pathCtx.nodeId
        })) return true;
      }
      return orig(issue);
    };
    Editor._validatorNavLegacyPatched = true;
  }

  function normalizeExportIssue(issue) {
    if (!issue) return issue;
    if (issue.objectLabel && issue.action) return issue;
    return {
      severity: issue.severity || 'error',
      message: issue.message || '',
      path: issue.path || '',
      raw: issue,
      tab: issue.tab,
      sceneId: issue.sceneId,
      questId: issue.questId,
      targetId: issue.targetId,
      type: issue.type
    };
  }

  Editor.getSceneValidationIssues = function getSceneValidationIssues(sceneId) {
    const result = typeof this.collectProjectIssues === 'function'
      ? this.collectProjectIssues()
      : { issues: [] };
    return (result.issues || []).filter((iss) => {
      const raw = iss.raw || iss;
      const pathCtx = parseJsonPath(raw.path || iss.path || '');
      return iss.sceneId === sceneId || raw.sceneId === sceneId || pathCtx.sceneId === sceneId
        || (iss.object?.type === 'scene' && iss.object?.id === sceneId);
    });
  };

  Editor.navigateToValidatorIssue = function navigateToValidatorIssue(issue) {
    const enriched = enrichProjectIssue(issue, Editor.data);
    if (enriched.action?.run) {
      enriched.action.run();
      return true;
    }
    if (typeof Editor.openValidationIssueInWorkspace === 'function') {
      return Editor.openValidationIssueInWorkspace(enriched.raw || enriched);
    }
    return false;
  };

  const ValidatorNav = {
    ISSUE_TITLES,
    parseJsonPath,
    getIssueTitle,
    getIssueDescription,
    getIssueLocation,
    enrichIssue: enrichProjectIssue,
    renderGroupedIssueList
  };

  Editor.ValidatorNav = ValidatorNav;
  Editor.enrichValidatorIssue = enrichProjectIssue;

  patchCollectProjectIssues();
  patchShowProjectValidationResults();
  patchNavigateToValidationIssue();

  Editor.applyValidatorExportGuardPatch = function applyValidatorExportGuardPatch() {
    patchExportGuard();
  };

  if (typeof Editor.guardExportWithValidation === 'function') {
    patchExportGuard();
  }

  if (typeof document !== 'undefined' && !document.getElementById('validator-nav-styles')) {
    const st = document.createElement('style');
    st.id = 'validator-nav-styles';
    st.textContent = `
      .pv-modal-panel { max-width: 680px; }
      .pv-summary { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0 12px; }
      .pv-count { font-size: 11px; font-weight: 700; letter-spacing: .04em; padding: 4px 8px; border-radius: 999px; }
      .pv-count--error { background: #ffebee; color: #b71c1c; }
      .pv-count--warning { background: #fff8e1; color: #e65100; }
      .pv-count--info { background: #e3f2fd; color: #1565c0; }
      .pv-group { margin-bottom: 14px; }
      .pv-group__title { font-size: 12px; letter-spacing: .06em; margin: 0 0 8px; color: var(--muted, #666); }
      .pv-group__count { opacity: .7; }
      .pv-issue-severity { font-size: 10px; font-weight: 700; letter-spacing: .06em; opacity: .65; }
      .pv-issue-title { font-weight: 700; font-size: 14px; margin-top: 2px; }
      .pv-issue-desc { font-size: 13px; line-height: 1.45; margin: 4px 0; color: var(--ink, #222); }
      .pv-issue-location { font-size: 12px; color: var(--muted, #666); white-space: pre-line; margin: 2px 0 6px; }
      .pv-issue-list--group { max-height: none; }
    `;
    document.head.appendChild(st);
  }

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-validator-navigation', ValidatorNav, { force: true });
  }

  console.info('[Editor.ValidatorNav] ready');
})();
