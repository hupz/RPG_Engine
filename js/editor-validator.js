// Валидация проекта в реальном времени + панель ошибок IDE

(function attachEditorValidator() {
  if (typeof Editor === 'undefined') {
    console.warn('editor-validator.js: Editor не определён');
    return;
  }

  const VS = typeof ValidateScenes !== 'undefined' ? ValidateScenes : null;
  const SOUND_FIELDS = ['soundCast', 'soundHit', 'soundAttack', 'soundUse', 'soundEffect', 'sound'];

  function makeIssueId(parts) {
    return parts.filter(Boolean).join(':');
  }

  function collectQuestIssues(data) {
    const issues = [];
    Object.entries(data?.quests || {}).forEach(([questId, q]) => {
      const r = q?.rewards || {};
      const hasGold = (r.gold | 0) > 0;
      const hasExp = (r.exp | 0) > 0;
      const hasItems = Array.isArray(r.items) && r.items.length > 0;
      const hasOther = Object.keys(r).some((k) => !['gold', 'exp', 'items'].includes(k) && r[k]);
      if (!hasGold && !hasExp && !hasItems && !hasOther) {
        issues.push({
          id: makeIssueId(['quest_no_reward', questId]),
          type: 'quest_no_reward',
          severity: 'warning',
          tab: 'quests',
          questId,
          message: `Квест «${q?.title || questId}»: нет награды`
        });
      }
    });
    return issues;
  }

  function collectNpcIssues(data) {
    const issues = [];
    Object.entries(data?.npcs || {}).forEach(([npcId, n]) => {
      if (!String(n?.name || '').trim()) {
        issues.push({
          id: makeIssueId(['npc_no_name', npcId]),
          type: 'npc_no_name',
          severity: 'error',
          tab: 'npcs',
          npcId,
          message: `NPC «${npcId}»: не указано имя`
        });
      }
    });
    return issues;
  }

  function collectAbilitySoundIssues(data) {
    const issues = [];
    const catalog = new Set(Object.keys(data?.audio?.catalog || {}));

    const checkAbility = (ab, ctx) => {
      if (!ab || typeof ab !== 'object') return;
      const label = ab.name || ab.id || ctx.abilityId || 'умение';
      SOUND_FIELDS.forEach((field) => {
        const val = ab[field];
        if (!val || typeof val !== 'string') return;
        const sid = val.trim();
        if (!sid || catalog.has(sid)) return;
        issues.push({
          id: makeIssueId(['missing_resource', ctx.tab, ctx.classId || ctx.abilityId, field, sid]),
          type: 'missing_resource',
          severity: 'error',
          tab: ctx.tab,
          classId: ctx.classId,
          abilityId: ctx.abilityId,
          abilityIndex: ctx.abilityIndex,
          resourceId: sid,
          field,
          message: `Умение «${label}»: ресурс «${sid}» не найден (поле ${field})`
        });
      });
    };

    Object.entries(data?.classes || {}).forEach(([classId, cls]) => {
      (cls?.abilities || []).forEach((ab, abilityIndex) => {
        checkAbility(ab, { tab: 'classes', classId, abilityId: ab?.id, abilityIndex });
      });
    });

    Object.entries(data?.progression?.abilities || {}).forEach(([abilityId, ab]) => {
      checkAbility(ab, { tab: 'abilities', abilityId });
    });

    return issues;
  }

  function buildValidationResult(issues) {
    const errors = issues.filter((i) => i.severity === 'error');
    const deadEnds = issues.filter((i) => i.type === 'dead_end');
    const brokenLinks = issues
      .filter((i) => i.type === 'missing_scene')
      .map((e) => ({
        fromScene: e.sceneId,
        field: e.field,
        targetId: e.targetId
      }));

    return {
      ok: errors.length === 0,
      issues,
      errors,
      deadEnds,
      brokenLinks
    };
  }

  function collectSceneElementIssues(data) {
    const issues = [];
    if (typeof SceneElements === 'undefined') return issues;

    Object.entries(data?.scenes || {}).forEach(([sceneId, scene]) => {
      SceneElements.ensureArrays(scene);
      const checkList = (list, label) => {
        (list || []).forEach((el, idx) => {
          if (el.type === 'combat') {
            const enemies = el.data?.enemies || [];
            if (!enemies.length) {
              issues.push({
                id: makeIssueId(['element_combat_empty', sceneId, el.id]),
                type: 'element_combat_empty',
                severity: 'warning',
                tab: 'scenes',
                sceneId,
                message: `Сцена «${sceneId}», элемент #${idx + 1} (${label}): бой без врагов`
              });
            }
            enemies.forEach((eid) => {
              if (!data.enemies?.[eid]) {
                issues.push({
                  id: makeIssueId(['element_missing_enemy', sceneId, el.id, eid]),
                  type: 'element_missing_enemy',
                  severity: 'error',
                  tab: 'scenes',
                  sceneId,
                  message: `Сцена «${sceneId}»: враг «${eid}» не найден в элементе боя`
                });
              }
            });
          }
          if (el.type === 'give_item' || el.type === 'remove_item') {
            const iid = el.data?.itemId;
            if (iid && !data.items?.[iid]) {
              issues.push({
                id: makeIssueId(['element_missing_item', sceneId, el.id, iid]),
                type: 'element_missing_item',
                severity: 'error',
                tab: 'scenes',
                sceneId,
                message: `Сцена «${sceneId}»: предмет «${iid}» не найден`
              });
            }
          }
          if (el.type === 'change_scene') {
            const tid = el.data?.sceneId;
            if (tid && !data.scenes?.[tid]) {
              issues.push({
                id: makeIssueId(['element_missing_scene', sceneId, el.id, tid]),
                type: 'missing_scene',
                severity: 'error',
                tab: 'scenes',
                sceneId,
                targetId: tid,
                message: `Сцена «${sceneId}»: переход на несуществующую сцену «${tid}»`
              });
            }
          }
        });
      };
      checkList(scene.onEnterElements, 'on enter');
      checkList(scene.elements, 'main');

      if (scene.combat?.length && !(scene.elements || []).some((e) => e.type === 'combat')) {
        issues.push({
          id: makeIssueId(['orphan_combat', sceneId]),
          type: 'orphan_combat',
          severity: 'warning',
          tab: 'scenes',
          sceneId,
          message: `Сцена «${sceneId}»: устаревшее поле combat[] без элемента боя (будет мигрировано)`
        });
      }
    });
    return issues;
  }

  function collectAllIssues(data) {
    if (!data) {
      const empty = {
        id: 'no_data',
        type: 'no_data',
        severity: 'error',
        tab: 'scenes',
        message: 'Нет данных проекта'
      };
      return [empty];
    }

    if (!Object.keys(data.scenes || {}).length) {
      return [{
        id: 'no_scenes',
        type: 'no_scenes',
        severity: 'error',
        tab: 'scenes',
        message: 'В проекте нет сцен'
      }];
    }

    const issues = [];
    if (VS) issues.push(...VS.validate(data));
    issues.push(...collectQuestIssues(data));
    issues.push(...collectNpcIssues(data));
    issues.push(...collectAbilitySoundIssues(data));
    issues.push(...collectSceneElementIssues(data));
    if (typeof ProjectSchema !== 'undefined' && typeof ProjectSchema.validateProjectAuthoring === 'function') {
      const authoring = ProjectSchema.validateProjectAuthoring(data);
      if (authoring?.issues?.length) issues.push(...authoring.issues);
    }
    return issues;
  }

  function tabSummary(issues) {
    const map = {};
    issues.forEach((issue) => {
      const tab = issue.tab || 'scenes';
      if (!map[tab]) map[tab] = { error: 0, warning: 0 };
      if (issue.severity === 'error') map[tab].error += 1;
      else map[tab].warning += 1;
    });
    return map;
  }

  Object.assign(Editor, {
    _validationTimer: null,
    _validationPanelCollapsed: false,

    validateProjectExtended() {
      const issues = collectAllIssues(this.data);
      const result = buildValidationResult(issues);
      this._lastValidation = result;
      return result;
    },

    scheduleValidation() {
      clearTimeout(this._validationTimer);
      this._validationTimer = setTimeout(() => this.refreshValidationUI(), 420);
    },

    ensureValidationPanel() {
      let panel = document.getElementById('editor-validation-panel');
      if (panel) return panel;

      const main = document.querySelector('.main-area');
      if (!main) return null;

      panel = document.createElement('div');
      panel.id = 'editor-validation-panel';
      panel.className = 'editor-validation-panel';
      panel.innerHTML = `
        <div class="editor-validation-panel-head">
          <button type="button" class="editor-validation-panel-toggle" id="editor-validation-panel-toggle"
            aria-expanded="true" title="Свернуть панель">▾</button>
          <span class="editor-validation-panel-title">Ошибки</span>
          <span class="editor-validation-panel-counts" id="editor-validation-panel-counts"></span>
          <button type="button" class="btn btn-danger btn-sm" id="editor-validation-run-btn"
            onclick="Editor.runProjectValidation()">🔍 Проверить проект</button>
        </div>
        <div class="editor-validation-panel-body" id="editor-validation-panel-body">
          <ul class="editor-validation-panel-list" id="editor-validation-panel-list"></ul>
        </div>`;
      main.appendChild(panel);

      panel.querySelector('#editor-validation-panel-toggle').addEventListener('click', () => {
        this._validationPanelCollapsed = !this._validationPanelCollapsed;
        panel.classList.toggle('is-collapsed', this._validationPanelCollapsed);
        const btn = panel.querySelector('#editor-validation-panel-toggle');
        btn.textContent = this._validationPanelCollapsed ? '▸' : '▾';
        btn.setAttribute('aria-expanded', String(!this._validationPanelCollapsed));
      });

      return panel;
    },

    _applyValidationDot(el, stats) {
      let dot = el.querySelector('.tab-issue-dot');
      if (!stats || (!stats.error && !stats.warning)) {
        el.classList.remove('has-validation-error', 'has-validation-warning');
        if (dot) dot.remove();
        return;
      }
      if (!dot) {
        dot = document.createElement('span');
        dot.className = 'tab-issue-dot';
        dot.setAttribute('aria-hidden', 'true');
        el.appendChild(dot);
      }
      if (stats.error > 0) {
        el.classList.add('has-validation-error');
        el.classList.remove('has-validation-warning');
        dot.className = 'tab-issue-dot tab-issue-dot--error';
        dot.title = `${stats.error} ошибок`;
      } else {
        el.classList.remove('has-validation-error');
        el.classList.add('has-validation-warning');
        dot.className = 'tab-issue-dot tab-issue-dot--warning';
        dot.title = `${stats.warning} предупреждений`;
      }
    },

    updateValidationTabDots(issues) {
      const summary = tabSummary(issues);
      document.querySelectorAll('.tabs .tab[data-tab-id]').forEach((tab) => {
        const tabId = tab.dataset.tabId;
        this._applyValidationDot(tab, summary[tabId]);
      });

      document.querySelectorAll('.editor-nav-item[data-section-id]').forEach((navItem) => {
        const sectionId = navItem.dataset.sectionId;
        const tabIds = typeof Editor.getNavSectionTabIds === 'function'
          ? Editor.getNavSectionTabIds(sectionId)
          : [navItem.dataset.defaultTab].filter(Boolean);
        let agg = null;
        tabIds.forEach((tabId) => {
          const stats = summary[tabId];
          if (!stats) return;
          if (!agg) agg = { error: 0, warning: 0 };
          agg.error += stats.error || 0;
          agg.warning += stats.warning || 0;
        });
        this._applyValidationDot(navItem, agg);
      });

      if (typeof Editor.syncNavLayout === 'function' && Editor.currentTab) {
        Editor.syncNavLayout(Editor.currentTab);
      }
    },

    renderValidationPanelList(result) {
      const list = document.getElementById('editor-validation-panel-list');
      const counts = document.getElementById('editor-validation-panel-counts');
      if (!list) return;

      const issues = result?.issues || [];
      const errors = issues.filter((i) => i.severity === 'error').length;
      const warnings = issues.filter((i) => i.severity === 'warning').length;

      if (counts) {
        counts.textContent = issues.length
          ? `${errors ? errors + ' ошибок' : ''}${errors && warnings ? ', ' : ''}${warnings ? warnings + ' предупр.' : ''}`
          : 'нет проблем';
      }

      if (!issues.length) {
        list.innerHTML = '<li class="editor-validation-panel-empty">✅ Проблем не обнаружено</li>';
        return;
      }

      list.innerHTML = issues.map((issue, idx) => {
        const cls = issue.severity === 'error'
          ? 'editor-validation-panel-item--error'
          : 'editor-validation-panel-item--warning';
        const icon = issue.severity === 'error' ? '●' : '◆';
        return `<li class="editor-validation-panel-item ${cls}">
          <button type="button" class="editor-validation-panel-link" data-issue-idx="${idx}">
            <span class="editor-validation-panel-icon">${icon}</span>
            <span class="editor-validation-panel-msg">${this.escapeHtml(issue.message)}</span>
          </button>
        </li>`;
      }).join('');

      list.querySelectorAll('[data-issue-idx]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const issue = issues[Number(btn.dataset.issueIdx)];
          if (issue) this.navigateToValidationIssue(issue);
        });
      });
    },

    navigateToValidationIssue(issue) {
      if (!issue) return;

      if (issue.tab === 'scenes' && issue.sceneId) {
        if (typeof this.openSceneFromGraph === 'function') {
          this.openSceneFromGraph(issue.sceneId);
        } else {
          this.currentScene = issue.sceneId;
          this.switchTab('scenes');
          this.renderSceneList();
          this.renderSceneEditor();
        }
        return;
      }

      if (issue.tab === 'quests' && issue.questId) {
        this.switchTab('quests');
        if (typeof this.selectQuestToEdit === 'function') this.selectQuestToEdit(issue.questId);
        return;
      }

      if (issue.tab === 'npcs' && issue.npcId) {
        this.switchTab('npcs');
        if (typeof this.selectNpcToEdit === 'function') this.selectNpcToEdit(issue.npcId);
        return;
      }

      if (issue.tab === 'classes' && issue.classId) {
        this.switchTab('classes');
        if (typeof this.selectClassToEdit === 'function') this.selectClassToEdit(issue.classId);
        return;
      }

      if (issue.tab === 'abilities' && issue.abilityId) {
        this.switchTab('abilities');
        if (typeof this.selectGlobalAbilityToEdit === 'function') {
          this.selectGlobalAbilityToEdit(issue.abilityId);
        }
      }
    },

    refreshValidationUI(result) {
      if (!this.data) {
        this.updateValidationTabDots([]);
        this.renderValidationPanelList({ issues: [] });
        return;
      }

      const r = result || this.validateProjectExtended();
      this.ensureValidationPanel();
      this.updateValidationTabDots(r.issues);
      this.renderValidationPanelList(r);

      if (this.currentTab === 'graph' && typeof this.renderStoryGraph === 'function') {
        this.renderStoryGraph();
      }
      if (typeof this.refreshDashboardIfVisible === 'function') {
        this.refreshDashboardIfVisible();
      }

      return r;
    },

    expandValidationPanel() {
      const panel = this.ensureValidationPanel();
      if (!panel) return;
      this._validationPanelCollapsed = false;
      panel.classList.remove('is-collapsed');
      const btn = panel.querySelector('#editor-validation-panel-toggle');
      if (btn) {
        btn.textContent = '▾';
        btn.setAttribute('aria-expanded', 'true');
      }
    }
  });

  Editor.validateProject = function validateProject() {
    return this.validateProjectExtended();
  };

  const origRun = Editor.runProjectValidation?.bind(Editor);
  Editor.runProjectValidation = function runProjectValidation() {
    const result = this.validateProjectExtended();
    this.refreshValidationUI(result);
    this.expandValidationPanel();
    if (typeof origRun === 'function' && typeof this.showValidationModal === 'function') {
      this.showValidationModal(result);
    }
    return result;
  };

  const validationMethods = [
    'updateJSONPreview', 'renderAll', 'renderSceneEditor', 'renderSceneList',
    'renderQuests', 'renderNPCs', 'renderClasses', 'renderAbilities', 'renderAudio',
    'updateSceneField', 'updateChoice', 'addChoice', 'removeChoice', 'deleteScene',
    'commitTemplateScene', 'createQuest', 'deleteQuest', 'createNPC', 'updateNPC',
    'updateClass', 'updateAbility', 'addGlobalAbility', 'switchTab'
  ];
  if (Editor.hooks && typeof Editor.hooks.after === 'function') {
    validationMethods.forEach((name) => {
      Editor.hooks.after(name, function (result) {
        this.scheduleValidation?.();
        return result;
      });
    });
  } else {
    validationMethods.forEach((name) => {
      const orig = Editor[name];
      if (typeof orig !== 'function') return;
      Editor[name] = function (...args) {
        const out = orig.apply(this, args);
        this.scheduleValidation();
        return out;
      };
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    Editor.ensureValidationPanel();
    setTimeout(() => Editor.refreshValidationUI(), 600);
  });
})();
