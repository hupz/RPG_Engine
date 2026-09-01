/**
 * Phase 1.14 — Quest Authoring 2.0 UI
 */
(function attachQuestAuthoringPhase114() {
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

  function ensureStyles() {
    if (document.getElementById('quest-authoring-phase-114-styles')) return;
    const st = document.createElement('style');
    st.id = 'quest-authoring-phase-114-styles';
    st.textContent = `
      .quest-authoring-panel { margin: 12px 0; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--card-bg); }
      .quest-flow-mini { list-style: none; margin: 0; padding: 0; }
      .quest-flow-mini li { padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
      .quest-start-source { font-size: 12px; padding: 4px 0; }
      .quest-stage-extra { margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border); }
      .quest-action-step { display: flex; gap: 6px; align-items: center; font-size: 12px; margin: 3px 0; }
      .quest-create-overlay { position: fixed; inset: 0; z-index: 12600; background: var(--overlay); display: flex; align-items: center; justify-content: center; padding: 16px; }
      .quest-create-modal { max-width: 420px; width: 100%; background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; padding: 20px; }
    `;
    document.head.appendChild(st);
  }

  Object.assign(Editor, {
    openQuestCreationWorkflow() {
      if (!Editor.data) return;
      ensureStyles();
      Editor.ensureQuests?.();
      let overlay = document.getElementById('quest-creation-workflow');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'quest-creation-workflow';
        overlay.className = 'quest-create-overlay';
        document.body.appendChild(overlay);
      }
      overlay.innerHTML =
        '<div class="quest-create-modal" role="dialog">' +
        '<h2>Новый квест</h2>' +
        '<p class="hint">QuestRuntime v2 — этапы и задачи без флагов.</p>' +
        '<div class="form-group"><label>Название</label><input id="qc-name" class="form-control" value="Новое задание"></div>' +
        '<div class="form-group"><label>Описание</label><textarea id="qc-desc" class="form-control" rows="2"></textarea></div>' +
        '<div class="form-group"><label>Количество этапов</label>' +
        '<select id="qc-stages" class="form-control"><option value="1">1</option><option value="2">2</option><option value="3" selected>3</option><option value="4">4</option><option value="5">5</option></select></div>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap;">' +
        '<button type="button" class="btn btn-secondary" id="qc-wizard">Мастер…</button>' +
        '<button type="button" class="btn btn-secondary" id="qc-cancel">Отмена</button>' +
        '<button type="button" class="btn btn-primary" id="qc-create">Создать</button>' +
        '</div></div>';
      overlay.style.display = 'flex';
      overlay.querySelector('#qc-cancel').onclick = () => { overlay.style.display = 'none'; };
      overlay.querySelector('#qc-wizard').onclick = () => {
        overlay.style.display = 'none';
        Editor.createQuestWizard?.() || Editor.openQuestWizard?.();
      };
      overlay.querySelector('#qc-create').onclick = () => Editor.finishQuestCreationWorkflow();
      overlay.onclick = (ev) => { if (ev.target === overlay) overlay.style.display = 'none'; };
    },

    finishQuestCreationWorkflow() {
      const name = document.getElementById('qc-name')?.value?.trim();
      const desc = document.getElementById('qc-desc')?.value?.trim() || '';
      const stageCount = parseInt(document.getElementById('qc-stages')?.value, 10) || 3;
      if (!name) return;
      Editor.ensureQuests?.();
      let id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'quest';
      if (Editor.data.quests[id]) id = id + '_' + Date.now().toString(36).slice(-4);
      const quest = IDX
        ? IDX.createQuestTemplate(id, name, desc, stageCount)
        : { id, title: name, description: desc, stages: [{ title: 'Этап 1', tasks: [{ type: 'ManualAdvance', id: id + '_t0' }] }], rewards: { gold: 0, exp: 0 }, questFormat: 2 };
      Editor.data.quests[id] = quest;
      Editor.editingQuestId = id;
      Editor.markDirty?.();
      Editor.updateJSONPreview?.();
      Editor.renderQuests?.();
      const overlay = document.getElementById('quest-creation-workflow');
      if (overlay) overlay.style.display = 'none';
      Editor.toast?.success?.('Квест создан: ' + name);
      return id;
    },

    renderQuestStartSourcesPanel(questId) {
      if (!IDX) return '';
      const sources = IDX.collectQuestStartSources(Editor.data, questId);
      let html = '<div class="quest-authoring-panel"><h4>Quest start sources</h4>';
      if (!sources.length) {
        html += '<p class="hint">Нет привязок. Добавьте choice questSet, visual update_quest или dialogue topic.</p>';
      } else {
        sources.forEach((s) => {
          html += `<div class="quest-start-source">${esc(s.kind)} · ${esc(s.sceneId)} · ${esc(s.label)}`;
          if (s.stage != null) html += ` → stage ${esc(String(s.stage))}`;
          html += ` <button type="button" class="btn btn-secondary btn-sm" data-qs-open="${escAttr(s.sceneId)}">Open</button></div>`;
        });
      }
      html += '<p class="hint">Start: <code>update_quest</code> stage 0 · Advance: stage index or id · Complete: stage <code>complete</code></p>';
      html += `<button type="button" class="btn btn-secondary btn-sm" onclick="Editor.openQuestStartWiring('${escAttr(questId)}')">+ Wire start (choice)</button>`;
      html += '</div>';
      return html;
    },

    openQuestStartWiring(questId) {
      const scenes = Object.keys(Editor.data?.scenes || {});
      if (!scenes.length) {
        Editor.toast.warning('Нет сцен');
        return;
      }
      const sceneId = scenes[0];
      const sc = Editor.data.scenes[sceneId];
      if (!Array.isArray(sc.choices)) sc.choices = [];
      sc.choices.push({
        text: 'Начать квест',
        icon: '📜',
        questSet: { questId, stage: '0' }
      });
      Editor.markDirty?.();
      Editor.updateJSONPreview?.();
      Editor.renderQuests?.();
      Editor.toast?.success?.('Добавлен choice → quest stage 0 в ' + sceneId);
    },

    renderQuestFlowMini(questId) {
      const q = Editor.data?.quests?.[questId];
      if (!q || !IDX) return '';
      let html = '';
      html += `<div class="form-group"><label>Описание квеста</label>
        <textarea rows="2" onchange="${Editor.questAttrHandler?.('Editor.updateQuestMeta(' + JSON.stringify(questId) + ',\'description\',this.value)') || ''}">${esc(q.description || '')}</textarea></div>`;
      const flow = IDX.buildQuestFlowSummary(q);
      html += '<div class="quest-authoring-panel"><h4>Quest flow</h4><ul class="quest-flow-mini">';
      flow.forEach((node) => {
        html += `<li><strong>${esc(node.title)}</strong>`;
        if (node.taskCount) html += ` · ${node.taskCount} task(s)`;
        if (node.completionRule === 'any') html += ' · any';
        if (node.entryActionCount) html += ` · entry×${node.entryActionCount}`;
        if (node.rewardActionCount) html += ` · reward×${node.rewardActionCount}`;
        if (node.nextTitle) html += ` → ${esc(node.nextTitle)}`;
        html += '</li>';
      });
      html += '</ul></div>';
      return html;
    },

    renderQuestStageAuthoringExtra(questId, stageIndex, st) {
      const qid = escAttr(questId);
      let html = '<div class="quest-stage-extra">';

      html += `<div class="form-group"><label>Описание этапа</label>
        <textarea rows="2" onchange="${Editor.questAttrHandler?.('Editor.updateQuestStageField(' + JSON.stringify(questId) + ',' + stageIndex + ',\'description\',this.value)') || ''}">${esc(st.description || st.log || '')}</textarea></div>`;

      html += `<div class="form-group"><label>Completion rule</label>
        <select onchange="${Editor.questAttrHandler?.('Editor.updateQuestStageField(' + JSON.stringify(questId) + ',' + stageIndex + ',\'completionRule\',this.value)') || ''}">
          <option value="all" ${(st.completionRule || 'all') === 'all' ? 'selected' : ''}>Все задачи</option>
          <option value="any" ${st.completionRule === 'any' ? 'selected' : ''}>Любая задача</option>
        </select></div>`;

      if (typeof Editor.renderConditionBuilder === 'function') {
        html += '<div class="form-group"><label>Start conditions (metadata)</label>';
        html += Editor.renderConditionBuilder(
          () => Editor.getQuestStageRef(questId, stageIndex),
          'startConditions',
          () => Editor.renderQuests?.(),
          { title: 'Старт этапа если', builderSuffix: `qst-${questId}-${stageIndex}-start` }
        );
        html += '<p class="hint">Для gating контента через questStage / questMinStage.</p></div>';
      }

      html += `<div class="form-group"><label>Entry actions</label>`;
      (st.entryActions || []).forEach((step, ai) => {
        html += `<div class="quest-action-step"><code>${esc(step.action || '')}</code>
          <button type="button" class="btn-remove" onclick="Editor.removeQuestStageAction('${qid}',${stageIndex},'entryActions',${ai})">×</button></div>`;
      });
      html += `<button type="button" class="btn btn-secondary btn-sm" onclick="Editor.addQuestStageAction('${qid}',${stageIndex},'entryActions')">+ Entry</button></div>`;

      html += `<div class="form-group"><label>Reward actions</label>`;
      (st.rewardActions || []).forEach((step, ai) => {
        html += `<div class="quest-action-step"><code>${esc(step.action || '')}</code>
          <button type="button" class="btn-remove" onclick="Editor.removeQuestStageAction('${qid}',${stageIndex},'rewardActions',${ai})">×</button></div>`;
      });
      html += `<button type="button" class="btn btn-secondary btn-sm" onclick="Editor.addQuestStageAction('${qid}',${stageIndex},'rewardActions')">+ Reward</button></div>`;

      const nextSt = Editor.data?.quests?.[questId]?.stages?.[stageIndex + 1];
      if (nextSt) {
        html += `<p class="hint">Next → ${esc(nextSt.title || nextSt.hint || ('Этап ' + (stageIndex + 2)))} (auto on tasks done)</p>`;
      } else if (st.finish) {
        html += '<p class="hint">Next → Complete (quest.rewards)</p>';
      }

      html += '</div>';
      return html;
    },

    getQuestStageRef(questId, stageIndex) {
      return Editor.data?.quests?.[questId]?.stages?.[stageIndex] || null;
    },

    addQuestStageAction(questId, stageIndex, field) {
      Editor.openUnifiedActionPicker?.({
        title: field === 'rewardActions' ? 'Reward action' : 'Entry action',
        onSelect(step) {
          const st = Editor.getQuestStageRef(questId, stageIndex);
          if (!st) return;
          if (!Array.isArray(st[field])) st[field] = [];
          st[field].push({ action: step.action, params: step.params || {} });
          Editor.markDirty?.();
          Editor.updateJSONPreview?.();
          Editor.renderQuests?.();
        }
      });
    },

    removeQuestStageAction(questId, stageIndex, field, actionIndex) {
      const st = Editor.getQuestStageRef(questId, stageIndex);
      if (!st?.[field]) return;
      st[field].splice(actionIndex, 1);
      Editor.renderQuests?.();
      Editor.updateJSONPreview?.();
    }
  });

  if (typeof Editor.renderQuestStageBlock === 'function' && !Editor._questStageBlockWrapped) {
    Editor._questStageBlockWrapped = true;
    const orig = Editor.renderQuestStageBlock.bind(Editor);
    Editor.renderQuestStageBlock = function wrappedQuestStageBlock(questId, stageIndex, st) {
      return orig(questId, stageIndex, st) + (Editor.renderQuestStageAuthoringExtra?.(questId, stageIndex, st) || '');
    };
  }

  if (typeof Editor.renderQuestDetail === 'function' && !Editor._questDetailWrapped) {
    Editor._questDetailWrapped = true;
    const origDetail = Editor.renderQuestDetail.bind(Editor);
    Editor.renderQuestDetail = function wrappedQuestDetail(questId) {
      ensureStyles();
      let html = origDetail(questId);
      const inject = (Editor.renderQuestFlowMini?.(questId) || '') +
        (Editor.renderQuestStartSourcesPanel?.(questId) || '');
      if (inject) {
        const marker = '+ Добавить этап';
        const idx = html.indexOf(marker);
        if (idx >= 0) html = html.slice(0, idx) + inject + html.slice(idx);
        else html += inject;
      }
      return html;
    };
  }

  if (!Editor._createQuest114Wrapped) {
    Editor._createQuest114Wrapped = true;
    Editor.createQuestWizard = Editor.createQuest?.bind(Editor);
    Editor.createQuest = function createQuestWorkflow() {
      if (typeof Editor.openQuestCreationWorkflow === 'function') {
        return Editor.openQuestCreationWorkflow();
      }
      return Editor.createQuestWizard?.();
    };
  }

  if (Editor.hooks?.after) {
    Editor.hooks.after('renderQuests', function questAuthoringBind() {
      document.querySelectorAll('[data-qs-open]').forEach((btn) => {
        if (btn._qsBound) return;
        btn._qsBound = true;
        btn.addEventListener('click', () => {
          const sid = btn.getAttribute('data-qs-open');
          if (sid) Editor.openContentEntity?.('scene', sid) || Editor.selectScene?.(sid);
        });
      });
    }, 'editor-quest-authoring-phase-114-bind');
  }
})();
