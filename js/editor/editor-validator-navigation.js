// ============================================================
// Validator UX 2.0 (UI-21) — human issues + Open and Fix navigation
// Extends editor-project-validator-ux.js; no validator semantics changes.
// ============================================================
(function attachValidatorNavigation() {
  'use strict';
  function tr(key, params) {
    if (typeof I18n !== 'undefined' && typeof I18n.t === 'function') return I18n.t(key, params);
    if (typeof t === 'function') return t(key, params);
    return key;
  }

  if (typeof Editor === 'undefined') return;

  const ISSUE_TITLE_TYPES = Object.freeze([
    'missing_scene', 'broken_transition', 'element_missing_scene', 'missing_item', 'missing_quest',
    'missing_npc', 'missing_enemy', 'missing_asset_ref', 'missing_asset_src', 'empty_asset',
    'unknown_action', 'action_not_in_catalog', 'missing_action_id', 'malformed_action', 'action_js_call',
    'missing_action_param', 'malformed_condition', 'invalid_quest_stage', 'invalid_amount',
    'invalid_combat_params', 'no_scenes', 'empty_scene', 'orphan_scene', 'unreachable_scene',
    'duplicate_id', 'npc_no_description', 'export_no_scenes', 'export_old_data_version', 'macro_id_in_json'
  ]);

  function issueTitle(type) {
    return tr('editor.validatorNavigation.issueTitles.' + type);
  }

  function getIssueTitles() {
    const out = {};
    ISSUE_TITLE_TYPES.forEach((type) => {
      out[type] = issueTitle(type);
    });
    return Object.freeze(out);
  }

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
    return tr('editor.validatorNavigation.sections.' + sectionId) || sectionId || '';
  }

  function getIssueTitle(issue) {
    if (issue.title) return issue.title;
    const raw = issue.raw || issue;
    const type = raw.type || issue.type;
    if (type && ISSUE_TITLE_TYPES.includes(type)) return issueTitle(type);
    if (issue.severity === 'warning') return tr('editor.validatorNavigation.severity.warning');
    if (issue.severity === 'info') return tr('editor.validatorNavigation.severity.info');
    return tr('editor.validatorNavigation.severity.default');
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
      let trigger = tr('editor.validatorNavigation.descriptions.triggerElement');
      if (choiceIdx != null && scene?.choices?.[choiceIdx]) {
        trigger = tr('editor.validatorNavigation.descriptions.triggerButton', {
          text: scene.choices[choiceIdx].text || tr('editor.validatorNavigation.descriptions.choiceFallback', { n: choiceIdx + 1 })
        });
      } else if (pathCtx.nodeId) {
        const node = (scene?.visual?.nodes || []).find((n) => n.id === pathCtx.nodeId);
        trigger = tr('editor.validatorNavigation.descriptions.triggerObject', {
          label: node?.label || pathCtx.nodeId
        });
      }
      return tr('editor.validatorNavigation.descriptions.brokenSceneLink', { trigger, targetId });
    }
    if (type === 'missing_item' && (raw.entityId || targetId)) {
      return tr('editor.validatorNavigation.descriptions.missingItem', { id: raw.entityId || targetId });
    }
    if (type === 'missing_npc' && (raw.entityId || targetId)) {
      return tr('editor.validatorNavigation.descriptions.missingNpc', { id: raw.entityId || targetId });
    }
    if (type === 'missing_enemy' && (raw.entityId || targetId)) {
      return tr('editor.validatorNavigation.descriptions.missingEnemy', { id: raw.entityId || targetId });
    }
    if (type === 'empty_scene') {
      return tr('editor.validatorNavigation.descriptions.emptyScene');
    }
    return message || tr('editor.validatorNavigation.descriptions.reviewIssue');
  }

  function getIssueLocation(issue, data) {
    if (issue.location) return issue.location;
    const raw = issue.raw || issue;
    const pathCtx = parseJsonPath(raw.path || issue.path || '');
    const sceneId = raw.sceneId || issue.sceneId || issue.object?.id || pathCtx.sceneId;
    const parts = [];
    const locSep = tr('editor.validatorNavigation.locationSep');

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
      if (pathCtx.nodeId) loc += locSep + pathCtx.nodeId;
      else if (pathCtx.choiceIndex != null) {
        const scene = data?.scenes?.[sceneId];
        const ch = scene?.choices?.[pathCtx.choiceIndex];
        loc += locSep + (ch?.text || tr('editor.validatorNavigation.descriptions.choiceFallback', { n: pathCtx.choiceIndex + 1 }));
      } else if (issue.path) {
        loc += locSep + issue.path;
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
    const openAndFixLabel = tr('editor.validatorNavigation.actions.openAndFix'); // Open and Fix

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
      issue.action = { label: openAndFixLabel, run: openSceneFn };
      return issue;
    }
    if (entityType === 'quest' || raw.questId) {
      const qid = raw.questId || entityId;
      issue.action = {
        label: openAndFixLabel,
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
        label: openAndFixLabel,
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
        label: openAndFixLabel,
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
        label: openAndFixLabel,
        run: () => {
          if (typeof Editor.switchTab === 'function') Editor.switchTab('enemies');
          if (typeof Editor.selectEnemyToEdit === 'function') Editor.selectEnemyToEdit(eid);
        }
      };
      return issue;
    }
    if (raw.tab) {
      issue.action = {
        label: tr('editor.validatorNavigation.actions.open'),
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
      issue.action.label = tr('editor.validatorNavigation.actions.openAndFix');
    }
    return issue;
  }

  function renderIssueCard(iss, idx) {
    const icon = iss.severity === 'error' ? '🔴' : (iss.severity === 'warning' ? '🟡' : '🔵');
    const acts = Array.isArray(iss.actions) && iss.actions.length
      ? iss.actions
      : (iss.action ? [iss.action] : []);
    const primary = acts[0];
    const openAndFixLabel = tr('editor.validatorNavigation.actions.openAndFix'); // Open and Fix
    const primaryLabel = primary
      ? (primary.label === 'Открыть' || primary.label === 'Исправить' ? openAndFixLabel : primary.label)
      : '';
    const actionBtns = primary
      ? '<button type="button" class="btn btn-primary btn-sm" data-issue-action="' + idx + '" data-action-i="0">' +
        esc(primaryLabel) + '</button>'
      : '';
    const extraBtns = acts.slice(1).map((a, ai) =>
      '<button type="button" class="btn btn-secondary btn-sm" data-issue-action="' + idx + '" data-action-i="' + (ai + 1) + '">' +
      esc(a.label || tr('editor.validatorNavigation.actions.open')) + '</button>'
    ).join('');
    const autoFixLabel = tr('editor.validatorNavigation.actions.autoFix');
    const fixBtn = iss.fixable && typeof iss.fix === 'function'
      ? '<button type="button" class="btn btn-secondary btn-sm" data-issue-fix="' + idx + '" title="' +
        esc(iss.fixPreview || autoFixLabel) + '">' + esc(autoFixLabel) + '</button>'
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
      (iss.fixPreview ? '<div class="pv-issue-path">' + esc(tr('editor.validatorNavigation.modal.autoFixPreview', { preview: iss.fixPreview })) + '</div>' : '') +
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
      return '<ul class="pv-issue-list"><li class="pv-issue pv-issue--ok"><div class="pv-issue-body">✓ ' +
        esc(tr('editor.validatorNavigation.groups.noIssues')) + '</div></li></ul>';
    }

    return groupBlock(tr('editor.validatorNavigation.groups.errors'), errors, 'error') + // ERRORS
      groupBlock(tr('editor.validatorNavigation.groups.warnings'), warnings, 'warning') + // WARNINGS
      groupBlock(tr('editor.validatorNavigation.groups.info'), infos, 'info');
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
            Editor.toast?.success?.(tr('editor.validatorNavigation.actions.fixed'));
            Editor.runProjectValidation();
          } catch (err) {
            Editor.toast?.error?.(String(err.message || err));
          }
        }
      }
    };
  }

  function patchCollectProjectIssues() {
    if (!Editor.collectProjectIssues || Editor._validatorNavCollectHooked || !Editor.hooks?.replace) return;
    let savedPrev;
    savedPrev = Editor.hooks.replace('collectProjectIssues', function collectProjectIssuesNav() {
      const result = savedPrev.call(this);
      const data = this.data;
      result.issues = (result.issues || []).map((iss) => enrichProjectIssue(iss, data));
      result.errors = result.issues.filter((i) => i.severity === 'error');
      result.warnings = result.issues.filter((i) => i.severity === 'warning');
      result.info = result.issues.filter((i) => i.severity === 'info');
      result.ok = result.errors.length === 0;
      this._lastProjectIssues = result;
      return result;
    }, 'editor-validator-navigation');
    Editor._validatorNavCollectHooked = true;
  }

  function patchShowProjectValidationResults() {
    if (!Editor.showProjectValidationResults || Editor._validatorNavShowHooked || !Editor.hooks?.replace) return;
    Editor.hooks.replace('showProjectValidationResults', function showProjectValidationResultsNav(result) {
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
        '<h2>' + esc(tr('editor.validatorNavigation.modal.title')) + '</h2>' +
        '<button type="button" class="btn-remove" data-pv-close="1">×</button>' +
        '</div>' +
        '<div class="pv-summary">' +
        '<span class="pv-count pv-count--error">' + esc(tr('editor.validatorNavigation.modal.summaryErrors', { count: result.errors.length })) + '</span>' +
        '<span class="pv-count pv-count--warning">' + esc(tr('editor.validatorNavigation.modal.summaryWarnings', { count: result.warnings.length })) + '</span>' +
        (infoCount ? '<span class="pv-count pv-count--info">' + esc(tr('editor.validatorNavigation.modal.summaryInfo', { count: infoCount })) + '</span>' : '') +
        '</div>' +
        listHtml +
        '<div class="pv-footer">' +
        '<button type="button" class="btn btn-secondary" data-pv-close="1">' + esc(tr('editor.validatorNavigation.modal.close')) + '</button>' +
        '<button type="button" class="btn btn-secondary" data-pv-recheck="1">' + esc(tr('editor.validatorNavigation.modal.recheck')) + '</button>' +
        '<button type="button" class="btn btn-primary" data-pv-fixall="1"' +
        (fixableCount ? '' : ' disabled') + '>' + esc(tr('editor.validatorNavigation.modal.autoFixSafe', { count: fixableCount })) + '</button>' +
        '</div></div>';
      modal.classList.remove('hidden');
      bindValidationModal(modal, items);
    }, 'editor-validator-navigation');
    Editor._validatorNavShowHooked = true;
  }

  function patchNavigateToValidationIssue() {
    if (typeof Editor.navigateToValidationIssue !== 'function' || Editor._validatorNavLegacyHooked || !Editor.hooks?.replace) return;
    let savedPrev;
    savedPrev = Editor.hooks.replace('navigateToValidationIssue', function navigateToValidationIssueNav(issue) {
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
      return savedPrev ? savedPrev.call(this, issue) : false;
    }, 'editor-validator-navigation');
    Editor._validatorNavLegacyHooked = true;
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
    get ISSUE_TITLES() { return getIssueTitles(); },
    ISSUE_TITLE_TYPES,
    issueTitle,
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
