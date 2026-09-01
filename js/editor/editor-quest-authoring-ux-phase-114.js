/**
 * Phase 1.14 — Quest Authoring UX (thin layer)
 * Overview list, usage panel, friendly Start/Advance/Complete presets.
 * Does NOT change QuestRuntime / questProgress / ACTION_REGISTRY execute.
 */
(function attachQuestAuthoringUxPhase114() {
  'use strict';

  if (typeof Editor === 'undefined') return;

  const IDX = typeof QuestAuthoringIndex !== 'undefined' ? QuestAuthoringIndex : null;

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

  function statusLabel(status) {
    if (status === 'wired') return 'wired';
    if (status === 'authored') return 'authored';
    if (status === 'invalid') return 'invalid';
    return 'draft';
  }

  function ensureStyles() {
    if (document.getElementById('quest-authoring-ux-114-styles')) return;
    const st = document.createElement('style');
    st.id = 'quest-authoring-ux-114-styles';
    st.textContent = `
      .quest-pick { display: block; width: 100%; text-align: left; margin: 0 0 4px; padding: 8px; }
      .quest-pick-title { font-weight: 600; font-size: 13px; }
      .quest-pick-meta { font-size: 11px; color: var(--muted, #666); margin-top: 2px; }
      .quest-pick-badge {
        display: inline-block; font-size: 9px; padding: 1px 5px; border-radius: 3px;
        margin-left: 4px; font-weight: 600; text-transform: uppercase;
      }
      .quest-pick-badge--wired { background: #e8f5e9; color: #2e7d32; }
      .quest-pick-badge--authored { background: #e3f2fd; color: #1565c0; }
      .quest-pick-badge--draft { background: #f5f5f5; color: #616161; }
      .quest-pick-badge--invalid { background: #ffebee; color: #c62828; }
      .quest-usage-panel { margin: 12px 0; padding: 10px 12px; border: 1px solid var(--border, #ddd); border-radius: 8px; }
      .quest-usage-row { font-size: 12px; padding: 3px 0; }
      .quest-presets { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 4px; }
      .quest-presets .hint { width: 100%; margin: 0 0 4px; }
    `;
    document.head.appendChild(st);
  }

  Object.assign(Editor, {
    getQuestOverviewList() {
      this.ensureQuests?.();
      const data = this.data || {};
      const ids = typeof this.getQuestIds === 'function'
        ? this.getQuestIds()
        : Object.keys(data.quests || {});
      if (!IDX || typeof IDX.buildQuestOverviewEntry !== 'function') {
        return ids.map((id) => ({
          id,
          title: data.quests[id]?.title || id,
          stageCount: (data.quests[id]?.stages || []).length,
          status: 'authored'
        }));
      }
      return ids.map((id) => IDX.buildQuestOverviewEntry(id, data.quests[id], data));
    },

    getQuestUsages(questId) {
      if (!IDX || typeof IDX.collectQuestUsages !== 'function') return [];
      return IDX.collectQuestUsages(this.data || {}, questId);
    },

    getQuestActionPresets() {
      if (IDX && typeof IDX.getQuestActionPresets === 'function') {
        return IDX.getQuestActionPresets();
      }
      return [
        { id: 'quest_start', label: 'Start Quest', steps: [{ action: 'update_quest', params: { questId: '', stage: '0' } }] },
        { id: 'quest_advance', label: 'Advance Quest', steps: [{ action: 'update_quest', params: { questId: '', stage: '1' } }] },
        { id: 'quest_complete', label: 'Complete Quest', steps: [{ action: 'update_quest', params: { questId: '', stage: 'complete' } }] }
      ];
    },

    /**
     * Insert friendly preset into visual/action editor if available;
     * otherwise copy JSON hint to toast.
     */
    applyQuestActionPreset(presetId, questId) {
      const preset = this.getQuestActionPresets().find((p) => p.id === presetId);
      if (!preset) return null;
      const qid = questId || this.editingQuestId || '';
      const steps = JSON.parse(JSON.stringify(preset.steps));
      steps.forEach((s) => {
        if (s.params) s.params.questId = qid;
      });
      // Prefer existing visual append helpers
      if (typeof this.visualAppendClickSteps === 'function' && this._visualSelectedNodeId) {
        this.visualAppendClickSteps(this._visualSelectedNodeId, steps);
        this.toast?.success?.(preset.label + ' → visual');
        return steps;
      }
      this._lastQuestActionPreset = steps;
      this.toast?.info?.(
        preset.label + ': ' + JSON.stringify(steps[0]) +
        ' — вставьте через Action picker (update_quest)'
      );
      return steps;
    },

    renderQuestUsagePanel(questId) {
      const usages = this.getQuestUsages(questId);
      if (!usages.length) {
        return (
          '<div class="quest-usage-panel" id="quest-usage-panel">' +
          '<strong>Где используется</strong>' +
          '<p class="hint">Пока нет ссылок в сценах / actions / conditions. Добавьте Start Quest на сцене.</p>' +
          '</div>'
        );
      }
      const rows = usages.slice(0, 40).map((u) => {
        const where = u.sceneId
          ? ('сцена «' + u.sceneId + '»')
          : (u.path || u.kind);
        return (
          '<div class="quest-usage-row">• [' + esc(u.category || u.kind) + '] ' +
          esc(where) +
          (u.label ? ' — ' + esc(u.label) : '') +
          (u.stage != null ? ' → stage ' + esc(String(u.stage)) : '') +
          '</div>'
        );
      }).join('');
      return (
        '<div class="quest-usage-panel" id="quest-usage-panel">' +
        '<strong>Где используется</strong> <span class="hint">(' + usages.length + ')</span>' +
        rows +
        (usages.length > 40 ? '<p class="hint">… ещё ' + (usages.length - 40) + '</p>' : '') +
        '</div>'
      );
    },

    renderQuestActionPresetsBar(questId) {
      const presets = this.getQuestActionPresets();
      return (
        '<div class="quest-presets" id="quest-action-presets">' +
        '<span class="hint">На сцене (JSON = update_quest):</span>' +
        presets.map((p) =>
          '<button type="button" class="btn btn-secondary btn-sm" data-qpreset="' + escAttr(p.id) + '" ' +
          'data-qid="' + escAttr(questId || '') + '" title="' + escAttr(p.hint || p.label) + '">' +
          esc(p.label) + '</button>'
        ).join('') +
        '</div>'
      );
    },

    bindQuestAuthoringUx(root) {
      if (!root || root._qauxBound) return;
      root._qauxBound = true;
      root.addEventListener('click', (ev) => {
        const btn = ev.target.closest('[data-qpreset]');
        if (!btn) return;
        this.applyQuestActionPreset(btn.getAttribute('data-qpreset'), btn.getAttribute('data-qid'));
      });
    }
  });

  // Enrich sidebar after renderQuests
  if (Editor.hooks?.after) {
    Editor.hooks.after('renderQuests', function questAuthoringUxOverview() {
      try {
        ensureStyles();
        const sidebar = document.querySelector('.quest-manager-sidebar');
        if (!sidebar) return;
        const overview = Editor.getQuestOverviewList();
        const buttons = overview.map((row) => {
          const active = row.id === Editor.editingQuestId ? ' active' : '';
          const badge = statusLabel(row.status);
          return (
            '<button type="button" class="quest-pick' + active + '" ' +
            'onclick="' + escAttr('Editor.selectQuestToEdit(' + JSON.stringify(row.id) + ')') + '">' +
            '<div class="quest-pick-title">' + esc(row.title) +
            '<span class="quest-pick-badge quest-pick-badge--' + badge + '">' + badge + '</span></div>' +
            '<div class="quest-pick-meta">id: ' + esc(row.id) +
            ' · stages: ' + row.stageCount +
            (row.startCount ? ' · starts: ' + row.startCount : '') +
            '</div></button>'
          );
        }).join('');
        const createBtn = sidebar.querySelector('.btn-primary');
        const h4 = sidebar.querySelector('h4');
        // Replace pick buttons but keep header + create
        const oldPicks = sidebar.querySelectorAll('.quest-pick');
        oldPicks.forEach((el) => el.remove());
        if (h4) {
          h4.insertAdjacentHTML('afterend', buttons);
        } else if (createBtn) {
          createBtn.insertAdjacentHTML('beforebegin', buttons);
        } else {
          sidebar.insertAdjacentHTML('afterbegin', buttons);
        }

        // Inject usage + presets into detail
        const detail = document.querySelector('.quest-manager-detail');
        if (detail && Editor.editingQuestId) {
          if (!detail.querySelector('#quest-usage-panel')) {
            const head = detail.querySelector('.quest-detail-head, .quest-flow-head, h3');
            const block =
              Editor.renderQuestActionPresetsBar(Editor.editingQuestId) +
              Editor.renderQuestUsagePanel(Editor.editingQuestId);
            if (head) head.insertAdjacentHTML('afterend', block);
            else detail.insertAdjacentHTML('afterbegin', block);
          }
          Editor.bindQuestAuthoringUx(detail);
        }
      } catch (e) {
        console.warn('[quest-ux-114]', e);
      }
    }, 'quest-authoring-ux-overview');
  }

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-quest-authoring-ux-phase-114', {
      getQuestOverviewList: Editor.getQuestOverviewList,
      getQuestUsages: Editor.getQuestUsages,
      getQuestActionPresets: Editor.getQuestActionPresets,
      applyQuestActionPreset: Editor.applyQuestActionPreset
    }, { force: true });
  }

  if (Editor.commands?.register) {
    Editor.commands.register({
      id: 'quest.presets.help',
      title: 'Quest: Start / Advance / Complete',
      category: 'Квесты',
      keywords: ['quest', 'start', 'complete', 'update_quest'],
      action() {
        const p = Editor.getQuestActionPresets();
        Editor.toast.info(p.map((x) => x.label + ' → ' + JSON.stringify(x.steps[0])).join('\n'));
      }
    });
  }
})();
