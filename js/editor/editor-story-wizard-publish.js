// ============================================================
// P4.4 — StoryWizard: шаг «Проверка и публикация»
// Единый отчёт (collectProjectIssues / ProjectValidator), чеклист готовности,
// превью и экспорт HTML без выхода в инженерные разделы.
// ============================================================
(function attachStoryWizardPublish() {
  'use strict';

  function esc(s) {
    return typeof Editor !== 'undefined' && typeof Editor.escapeHtml === 'function'
      ? Editor.escapeHtml(String(s == null ? '' : s))
      : String(s == null ? '' : s);
  }

  function escAttr(s) {
    return esc(s).replace(/"/g, '&quot;');
  }

  function resolveStartSceneId(editor) {
    const data = editor?.data || {};
    if (typeof ProjectSchema !== 'undefined' && typeof ProjectSchema.resolveProjectStartSceneId === 'function') {
      const id = ProjectSchema.resolveProjectStartSceneId(data);
      if (id && data.scenes?.[id]) return id;
    }
    const start = data.startScene || data.meta?.startScene;
    if (start && data.scenes?.[start]) return start;
    const keys = Object.keys(data.scenes || {});
    return keys[0] || null;
  }

  function collectValidatorReport(editor) {
    // Единый валидатор P2.1 — collectProjectIssues; иначе временная поверхность validateProjectExportReady.
    if (typeof editor.collectProjectIssues === 'function') {
      return editor.collectProjectIssues();
    }
    if (typeof editor.validateProjectExportReady === 'function') {
      const r = editor.validateProjectExportReady();
      const issues = r.issues || [];
      return {
        ok: !!r.ok,
        issues,
        errors: r.errors || issues.filter((i) => i.severity === 'error'),
        warnings: r.warnings || issues.filter((i) => i.severity === 'warning')
      };
    }
    return { ok: true, issues: [], errors: [], warnings: [] };
  }

  function sceneHasExit(editor, sceneId) {
    const sc = editor?.data?.scenes?.[sceneId];
    if (!sc) return false;
    if (sc.nextScene) return true;
    if (sc.combat?.nextScene) return true;
    if (sc.winScene || sc.lossScene) return true;
    const choices = sc.choices || [];
    return choices.some((c) => !!(c?.to || c?.nextScene || c?.winScene || c?.lossScene || c?.skillCheck));
  }

  function scenesWithoutExit(editor) {
    if (typeof editor.buildStoryFlowModel === 'function') {
      const model = editor.buildStoryFlowModel();
      return (model.nodes || [])
        .filter((n) => {
          if (n.outCount > 0) return false;
          if (n.isHub) return true;
          const sc = editor?.data?.scenes?.[n.id];
          const choices = sc?.choices || [];
          if (choices.length > 0) return true;
          return false;
        })
        .map((n) => n.id);
    }
    const scenes = editor?.data?.scenes || {};
    return Object.keys(scenes).filter((sid) => {
      const sc = scenes[sid];
      if (sceneHasExit(editor, sid)) return false;
      if (sc.sceneType === 'hub' || sc.hubScene || sc.returnsToHub) return true;
      return (sc.choices || []).length > 0;
    });
  }

  function isQuestReachableFromStart(editor, questId) {
    const data = editor?.data || {};
    if (!questId) {
      return { ok: false, status: 'warn', detail: 'квест не задан в мастере', sceneIds: [], questId: null };
    }
    if (!data.quests?.[questId]) {
      return { ok: false, status: 'warn', detail: 'квест ещё не создан в проекте', sceneIds: [], questId };
    }
    const startId = resolveStartSceneId(editor);
    if (!startId) {
      return { ok: false, status: 'error', detail: 'нет стартовой сцены', sceneIds: [], questId };
    }
    const scenes = data.scenes || {};
    const queue = [startId];
    const seen = new Set([startId]);
    while (queue.length) {
      const sid = queue.shift();
      const sc = scenes[sid];
      if (!sc) continue;
      const choices = sc.choices || [];
      for (let ci = 0; ci < choices.length; ci++) {
        const c = choices[ci];
        const qid = c.questSet?.questId || c.questId || c.startQuest;
        if (qid === questId) {
          const label = sc.location || sc.title || sid;
          return {
            ok: true,
            status: 'ok',
            detail: 'выдаётся в «' + label + '»',
            sceneIds: [sid],
            choiceIndex: ci,
            questId
          };
        }
        const to = c.to || c.nextScene;
        if (to && scenes[to] && !seen.has(to)) {
          seen.add(to);
          queue.push(to);
        }
      }
      const ns = sc.nextScene;
      if (ns && scenes[ns] && !seen.has(ns)) {
        seen.add(ns);
        queue.push(ns);
      }
      const cns = sc.combat?.nextScene;
      if (cns && scenes[cns] && !seen.has(cns)) {
        seen.add(cns);
        queue.push(cns);
      }
    }
    return {
      ok: false,
      status: 'warn',
      detail: 'ни один выбор с старта не запускает квест',
      sceneIds: [startId],
      questId
    };
  }

  function buildHumanChecklist(editor, draft) {
    const data = editor?.data || {};
    const items = [];
    const startId = resolveStartSceneId(editor);
    const startAssigned = !!(data.startScene || data.meta?.startScene);
    const startValid = !!(startId && data.scenes?.[startId]);

    items.push({
      id: 'has_start_scene',
      kind: 'checklist',
      label: 'Есть стартовая сцена',
      status: startValid ? 'ok' : 'error',
      detail: startValid
        ? (startAssigned ? '«' + startId + '»' : '«' + startId + '» (по умолчанию)')
        : 'создайте хотя бы одну сцену и укажите старт',
      sceneIds: startId ? [startId] : [],
      navigate: { type: 'scene', sceneId: startId, section: 'content' }
    });

    const questId = draft?.questId || draft?.quest?.questId || null;
    const questReach = isQuestReachableFromStart(editor, draft?.skipped?.quest ? null : questId);
    if (!draft?.skipped?.quest) {
      items.push({
        id: 'first_quest_reachable',
        kind: 'checklist',
        label: 'Первый квест достижим',
        status: questReach.status,
        detail: questReach.detail,
        sceneIds: questReach.sceneIds || [],
        choiceIndex: questReach.choiceIndex,
        questId: questReach.questId,
        navigate: questReach.questId && !questReach.ok
          ? { type: 'quest', questId: questReach.questId }
          : (questReach.sceneIds?.[0]
            ? { type: 'scene', sceneId: questReach.sceneIds[0], section: 'choices', choiceIndex: questReach.choiceIndex }
            : null)
      });
    }

    const deadEnds = scenesWithoutExit(editor);
    items.push({
      id: 'scene_has_exit',
      kind: 'checklist',
      label: 'У каждой сцены есть хотя бы один выход',
      status: deadEnds.length ? 'warn' : 'ok',
      detail: deadEnds.length
        ? 'без выхода: ' + deadEnds.slice(0, 4).join(', ') + (deadEnds.length > 4 ? '…' : '')
        : 'все сцены ведут дальше или завершают историю',
      sceneIds: deadEnds,
      navigate: deadEnds[0] ? { type: 'scene', sceneId: deadEnds[0], section: 'choices' } : null
    });

    // P2.5 — модель карты истории, если buildStoryFlowChecklist доступен
    if (typeof editor.buildStoryFlowChecklist === 'function' && typeof editor.buildStoryFlowModel === 'function') {
      const model = editor.buildStoryFlowModel();
      const flowItems = editor.buildStoryFlowChecklist(model) || [];
      const hubFinal = flowItems.find((it) => it.id === 'hub_to_final');
      if (hubFinal) {
        items.push({
          id: 'hub_to_final',
          kind: 'checklist',
          label: 'Финал достижим из хаба',
          status: hubFinal.status === 'error' ? 'error' : (hubFinal.status === 'warn' ? 'warn' : 'ok'),
          detail: hubFinal.detail,
          sceneIds: hubFinal.sceneIds || [],
          navigate: (hubFinal.sceneIds || [])[0]
            ? { type: 'scene', sceneId: hubFinal.sceneIds[0], section: 'choices' }
            : null
        });
      }
    } else {
      items.push({
        id: 'hub_to_final',
        kind: 'checklist',
        label: 'Финал достижим из хаба',
        status: 'warn',
        detail: 'карта сюжета недоступна — проверка пропущена',
        sceneIds: [],
        navigate: null
      });
    }

    return items;
  }

  function buildProjectSummary(editor, draft) {
    const data = editor?.data || {};
    const sceneIds = Object.keys(data.scenes || {});
    const npcIds = Object.keys(data.npcs || {});
    const questIds = Object.keys(data.quests || {});
    const heroName = draft?.hero?.name
      || data.playerCharacters?.[Object.keys(data.playerCharacters || {})[0]]?.name
      || 'Герой';
    const questTitle = draft?.questId && data.quests?.[draft.questId]
      ? (data.quests[draft.questId].title || draft.questId)
      : (draft?.quest?.title || '—');
    return {
      title: data.meta?.title || draft?.title || 'Моя история',
      sceneCount: sceneIds.length,
      npcCount: npcIds.length,
      questCount: questIds.length,
      heroName,
      questTitle,
      questId: draft?.questId || null
    };
  }

  function buildPublishReport(editor, draft) {
    const validator = collectValidatorReport(editor);
    const checklist = buildHumanChecklist(editor, draft || {});
    const summary = buildProjectSummary(editor, draft || {});
    const exportBlocked = (validator.errors || []).length > 0;
    return {
      ok: validator.ok && checklist.every((c) => c.status !== 'error'),
      exportBlocked,
      exportBlockers: (validator.errors || []).map((e) => e.message || e.objectLabel || 'Ошибка'),
      issues: validator.issues || [],
      errors: validator.errors || [],
      warnings: validator.warnings || [],
      checklist,
      summary
    };
  }

  function statusIcon(status) {
    if (status === 'ok') return '✓';
    if (status === 'warn') return '⚠';
    return '✗';
  }

  function renderChecklistHtml(checklist) {
    if (!checklist.length) return '';
    return `<section class="sw-publish-section">
      <h4>Чеклист готовности</h4>
      <ul class="sw-publish-rows">
        ${checklist.map((it, idx) =>
          `<li class="sw-publish-row sw-publish-row--${esc(it.status)}">
            <button type="button" class="sw-publish-row-btn" data-sw-pub-kind="checklist" data-sw-pub-idx="${idx}">
              <span class="sw-publish-row-icon">${statusIcon(it.status)}</span>
              <span class="sw-publish-row-label">${esc(it.label)}</span>
              <span class="sw-publish-row-detail hint">${esc(it.detail)}</span>
            </button>
          </li>`
        ).join('')}
      </ul>
    </section>`;
  }

  function renderIssuesHtml(report) {
    const err = report.errors || [];
    const warn = report.warnings || [];
    let html = '';
    if (err.length) {
      html += `<section class="sw-publish-section sw-publish-section--errors">
        <h4>Ошибки (${err.length})</h4>
        <ul class="sw-publish-rows">
          ${err.map((iss, idx) =>
            `<li class="sw-publish-row sw-publish-row--error">
              <button type="button" class="sw-publish-row-btn" data-sw-pub-kind="error" data-sw-pub-idx="${idx}">
                <span class="sw-publish-row-icon">🔴</span>
                <span class="sw-publish-row-label">${esc(iss.objectLabel || 'Проект')}</span>
                <span class="sw-publish-row-detail">${esc(iss.message)}</span>
              </button>
            </li>`
          ).join('')}
        </ul>
      </section>`;
    }
    if (warn.length) {
      html += `<section class="sw-publish-section">
        <h4>Предупреждения (${warn.length})</h4>
        <ul class="sw-publish-rows">
          ${warn.map((iss, idx) =>
            `<li class="sw-publish-row sw-publish-row--warn">
              <button type="button" class="sw-publish-row-btn" data-sw-pub-kind="warning" data-sw-pub-idx="${idx}">
                <span class="sw-publish-row-icon">🟡</span>
                <span class="sw-publish-row-label">${esc(iss.objectLabel || 'Проект')}</span>
                <span class="sw-publish-row-detail">${esc(iss.message)}</span>
              </button>
            </li>`
          ).join('')}
        </ul>
      </section>`;
    }
    if (!err.length && !warn.length) {
      html += `<section class="sw-publish-section sw-publish-ok-banner">
        <p>✓ Критических проблем валидатора не найдено — можно тестировать и экспортировать.</p>
      </section>`;
    }
    return html;
  }

  function renderExportBlockersHtml(report) {
    if (!report.exportBlocked) return '';
    const list = (report.exportBlockers || []).slice(0, 6)
      .map((m) => '<li>' + esc(m) + '</li>').join('');
    return `<div class="sw-publish-blockers" role="alert">
      <strong>Экспорт заблокирован</strong> — устраните ошибки выше:
      <ul>${list}</ul>
    </div>`;
  }

  function renderExportSuccessHtml(editor, draft, report) {
    const s = report.summary || buildProjectSummary(editor, draft);
    const improve = [];
    if ((report.warnings || []).length) {
      improve.push('есть предупреждения валидатора — можно доработать диалоги и условия');
    }
    if ((report.checklist || []).some((c) => c.status === 'warn')) {
      improve.push('чеклист готовности не полностью зелёный');
    }
    if (!improve.length) improve.push('добавить больше сцен, квестов и визуальных деталей');

    return `<div class="sw-publish-success" data-sw-publish="1">
      <div class="sw-publish-success-icon">🎉</div>
      <h3>Игра экспортирована</h3>
      <p class="hint">Файл HTML сохранён на диск — откройте его в браузере и передайте друзьям.</p>
      <ul class="sw-publish-stats">
        <li><strong>${esc(s.title)}</strong></li>
        <li>Сцен: ${s.sceneCount}</li>
        <li>Квест: «${esc(s.questTitle)}»</li>
        <li>Герой: ${esc(s.heroName)} · NPC: ${s.npcCount}</li>
      </ul>
      <div class="sw-publish-improve">
        <h4>Что улучшить позже</h4>
        <ul>${improve.map((t) => '<li>' + esc(t) + '</li>').join('')}</ul>
        <div class="sw-publish-level-links">
          <button type="button" class="btn btn-secondary btn-sm" data-sw-pub-goto="cartographer">🗺️ Картограф — карта сюжета</button>
          <button type="button" class="btn btn-secondary btn-sm" data-sw-pub-goto="engineer">⚙️ Инженер — баланс и механики</button>
        </div>
      </div>
    </div>`;
  }

  function renderPublishStepHtml(editor, draft, report) {
    report = report || buildPublishReport(editor, draft);
    if (draft?.exportCompleted) {
      return renderExportSuccessHtml(editor, draft, report);
    }

    const s = report.summary;
    return `<div class="sw-publish" data-sw-publish="1">
      <header class="sw-publish-header">
        <h3>Проверка и публикация</h3>
        <p class="hint"><strong>${esc(s.title)}</strong> · ${s.sceneCount} сцен · квест «${esc(s.questTitle)}»</p>
      </header>
      ${renderChecklistHtml(report.checklist)}
      ${renderIssuesHtml(report)}
      ${renderExportBlockersHtml(report)}
      <div class="sw-publish-toolbar">
        <button type="button" class="btn btn-secondary" data-sw-pub-action="preview">▶ Играть как герой</button>
        <button type="button" class="btn btn-primary" data-sw-pub-action="export"
          ${report.exportBlocked ? 'disabled title="Сначала исправьте ошибки"' : ''}>
          📦 Экспортировать HTML
        </button>
        <button type="button" class="btn btn-secondary btn-sm" data-sw-pub-action="refresh">↻ Обновить отчёт</button>
      </div>
      <p class="hint sw-publish-note">Превью и экспорт не требуют переключения вкладок. Клик по строке откроет место проблемы в редакторе.</p>
    </div>`;
  }

  function navigatePublishTarget(editor, nav) {
    if (!nav || !editor) return false;
    if (nav.type === 'quest' && nav.questId) {
      if (typeof editor.switchTab === 'function') editor.switchTab('quests');
      if (typeof editor.selectQuestToEdit === 'function') editor.selectQuestToEdit(nav.questId);
      return true;
    }
    if (nav.type === 'scene' && nav.sceneId) {
      const payload = {
        sceneId: nav.sceneId,
        section: nav.section || 'content',
        choiceIndex: nav.choiceIndex
      };
      if (typeof editor.openValidationIssueInWorkspace === 'function') {
        return editor.openValidationIssueInWorkspace(payload);
      }
      if (typeof editor.openSceneWorkspace === 'function') {
        editor.openSceneWorkspace(nav.sceneId);
      } else if (typeof editor.selectScene === 'function') {
        editor.selectScene(nav.sceneId);
      }
      if (nav.section && typeof editor.setSceneWorkspaceSection === 'function') {
        editor.setSceneWorkspaceSection(nav.section);
      }
      return true;
    }
    return false;
  }

  function navigateValidatorIssue(editor, issue) {
    if (!issue) return false;
    const acts = Array.isArray(issue.actions) && issue.actions.length
      ? issue.actions
      : (issue.action ? [issue.action] : []);
    if (acts[0]?.run) {
      acts[0].run();
      return true;
    }
    if (typeof editor.openValidationIssueInWorkspace === 'function') {
      return editor.openValidationIssueInWorkspace(issue);
    }
    return false;
  }

  function navigatePublishRow(editor, report, kind, idx) {
    if (!report) return false;
    if (kind === 'checklist') {
      const item = report.checklist[idx];
      if (!item) return false;
      if (item.navigate) return navigatePublishTarget(editor, item.navigate);
      if ((item.sceneIds || []).length && typeof editor.highlightStoryFlowScenes === 'function') {
        editor.highlightStoryFlowScenes(item.sceneIds, { focus: true });
        return true;
      }
      return false;
    }
    if (kind === 'error') return navigateValidatorIssue(editor, report.errors[idx]);
    if (kind === 'warning') return navigateValidatorIssue(editor, report.warnings[idx]);
    return false;
  }

  function gotoEditorLevel(editor, level) {
    if (level === 'cartographer') {
      if (typeof editor.applyEditorLevel === 'function') editor.applyEditorLevel('cartographer');
      else if (typeof editor.applyEditorMode === 'function') editor.applyEditorMode('cartographer');
      if (typeof editor.switchTab === 'function') editor.switchTab('scenes');
      return true;
    }
    if (level === 'engineer') {
      if (typeof editor.applyEditorLevel === 'function') editor.applyEditorLevel('engineer');
      else if (typeof editor.applyEditorMode === 'function') editor.applyEditorMode('full');
      if (typeof editor.switchTab === 'function') editor.switchTab('scenes');
      return true;
    }
    return false;
  }

  function ensurePublishStyles() {
    if (typeof document === 'undefined' || document.getElementById('sw-publish-styles')) return;
    const st = document.createElement('style');
    st.id = 'sw-publish-styles';
    st.textContent = `
      .sw-publish { display:flex; flex-direction:column; gap:12px; }
      .sw-publish-header h3 { margin:0 0 4px; }
      .sw-publish-section h4 { margin:0 0 6px; font-size:13px; color:var(--ink-muted,#666); }
      .sw-publish-rows { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:4px; }
      .sw-publish-row-btn {
        width:100%; text-align:left; display:grid; grid-template-columns:auto 1fr;
        gap:4px 8px; align-items:start; padding:8px 10px; border:1px solid var(--border,#ddd);
        border-radius:6px; background:var(--surface,#fff); cursor:pointer; font:inherit;
      }
      .sw-publish-row-btn:hover { border-color:var(--accent,#8b4513); background:var(--surface-hover,#faf8f5); }
      .sw-publish-row--error .sw-publish-row-btn { border-color:#e8b4b4; }
      .sw-publish-row--warn .sw-publish-row-btn { border-color:#e8d9a8; }
      .sw-publish-row--ok .sw-publish-row-btn { border-color:#b8dcc0; }
      .sw-publish-row-icon { font-size:14px; line-height:1.3; }
      .sw-publish-row-label { font-weight:600; font-size:13px; }
      .sw-publish-row-detail { grid-column:2; font-size:12px; }
      .sw-publish-toolbar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:4px; }
      .sw-publish-blockers { padding:10px; border-radius:6px; background:#fff3f3; border:1px solid #e8b4b4; font-size:13px; }
      .sw-publish-blockers ul { margin:6px 0 0; padding-left:18px; }
      .sw-publish-ok-banner p { margin:0; padding:10px; background:#f0faf2; border-radius:6px; border:1px solid #b8dcc0; }
      .sw-publish-success { text-align:center; padding:8px 4px 4px; }
      .sw-publish-success-icon { font-size:40px; line-height:1; margin-bottom:8px; }
      .sw-publish-stats { text-align:left; margin:12px auto; max-width:360px; padding-left:18px; font-size:13px; }
      .sw-publish-improve { text-align:left; margin-top:16px; padding-top:12px; border-top:1px solid var(--border,#ddd); }
      .sw-publish-level-links { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
      .sw-publish-note { margin:0; font-size:12px; }
    `;
    document.head.appendChild(st);
  }

  const StoryWizardPublish = {
    buildPublishReport,
    buildHumanChecklist,
    renderPublishStepHtml,
    renderExportSuccessHtml,
    navigatePublishRow,
    navigatePublishTarget,
    navigateValidatorIssue,
    gotoEditorLevel,
    collectValidatorReport,
    resolveStartSceneId,
    scenesWithoutExit,
    isQuestReachableFromStart
  };

  if (typeof globalThis !== 'undefined') {
    globalThis.StoryWizardPublish = StoryWizardPublish;
  }

  if (typeof Editor !== 'undefined') {
    ensurePublishStyles();
    Editor.StoryWizardPublish = StoryWizardPublish;
  }
})();
