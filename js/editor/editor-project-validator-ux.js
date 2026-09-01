// ============================================================
// Project Validator UX — структурированные issues + actions + safe autofix
// Не меняет QuestRuntime
// ============================================================
(function attachProjectValidatorUX() {
  'use strict';
  if (typeof Editor === 'undefined') return;

  /**
   * @typedef {object} ProjectIssue
   * @property {string} id
   * @property {'error'|'warning'|'info'} severity
   * @property {string} message
   * @property {string} objectLabel  — e.g. Квест "…"
   * @property {string} path         — e.g. Этап 2 → задача "…"
   * @property {{ type: string, id?: string, stageIndex?: number, taskIndex?: number, field?: string }} object
   * @property {{ label: string, run: Function }} [action]
   * @property {boolean} [fixable]
   * @property {Function} [fix]
   */

  function esc(s) {
    return typeof Editor.escapeHtml === 'function' ? Editor.escapeHtml(s) : String(s ?? '');
  }

  function makeId(parts) {
    return parts.filter(Boolean).join(':');
  }

  function questTitle(data, questId) {
    return data?.quests?.[questId]?.title || questId;
  }

  function openQuest(questId, stageIndex, taskIndex) {
    if (typeof Editor.switchTab === 'function') Editor.switchTab('quests');
    if (typeof Editor.selectQuestToEdit === 'function') Editor.selectQuestToEdit(questId);
    if (typeof Editor.selectInspectorObject === 'function') {
      if (taskIndex != null && stageIndex != null) {
        Editor.selectInspectorObject({ type: 'task', id: questId, stageIndex, taskIndex });
      } else if (stageIndex != null) {
        Editor.selectInspectorObject({ type: 'stage', id: questId, stageIndex });
      } else {
        Editor.selectInspectorObject({ type: 'quest', id: questId });
      }
    }
  }

  function resolveSceneWorkspaceSection(opts) {
    opts = opts || {};
    const field = String(opts.field || '');
    const choiceIndex = opts.choiceIndex;
    const nodeId = opts.nodeId;
    if (choiceIndex != null || field === 'to' || field === 'choices' || /choice/i.test(field)) {
      return 'choices';
    }
    if (nodeId || /visual|node|hotspot/i.test(field)) return 'visual';
    if (/condition|showIf/i.test(field)) return 'conditions';
    return 'content';
  }

  function openScene(sceneId, opts) {
    opts = opts || {};
    if (typeof Editor.openValidationIssueInWorkspace === 'function') {
      Editor.openValidationIssueInWorkspace(Object.assign({ sceneId }, opts));
      return;
    }
    if (typeof Editor.openSceneWorkspace === 'function') {
      Editor.openSceneWorkspace(sceneId);
    } else {
      if (typeof Editor.switchTab === 'function') Editor.switchTab('scenes');
      if (typeof Editor.openSceneDocument === 'function') Editor.openSceneDocument(sceneId);
      else if (typeof Editor.selectScene === 'function') Editor.selectScene(sceneId);
    }
    const section = opts.section || resolveSceneWorkspaceSection(opts);
    if (section && typeof Editor.setSceneWorkspaceSection === 'function') {
      Editor.setSceneWorkspaceSection(section);
    }
    if (opts.choiceIndex != null && typeof Editor.selectChoiceIndex === 'function') {
      try { Editor.selectChoiceIndex(opts.choiceIndex); } catch (e) { /* */ }
    }
    if (opts.nodeId && typeof Editor.visualSelectNode === 'function') {
      try { Editor.visualSelectNode(opts.nodeId); } catch (e) { /* */ }
    }
  }

  function openNpc(npcId) {
    if (typeof Editor.switchTab === 'function') Editor.switchTab('npcs');
    if (typeof Editor.selectNpcToEdit === 'function') Editor.selectNpcToEdit(npcId);
    if (typeof Editor.selectInspectorObject === 'function') {
      Editor.selectInspectorObject({ type: 'npc', id: npcId });
    }
  }

  function openItem(itemId) {
    if (typeof Editor.switchTab === 'function') Editor.switchTab('items');
    if (typeof Editor.selectItemToEdit === 'function') Editor.selectItemToEdit(itemId);
  }

  function openEnemy(enemyId) {
    if (typeof Editor.switchTab === 'function') Editor.switchTab('enemies');
    if (typeof Editor.selectEnemyToEdit === 'function') Editor.selectEnemyToEdit(enemyId);
  }

  /** Normalize legacy issue → ProjectIssue */
  function normalizeLegacy(issue, data) {
    if (!issue) return null;
    if (issue.object && issue.objectLabel && issue.action) return issue;

    const severity = issue.severity === 'warning' || issue.severity === 'info' ? issue.severity : 'error';
    const message = issue.message || issue.msg || String(issue.type || 'Ошибка');
    let objectLabel = '';
    let path = '';
    let object = { type: 'project' };
    let action = null;
    let fixable = false;
    let fix = null;

    if (issue.questId) {
      object = { type: 'quest', id: issue.questId, stageIndex: issue.stageIndex, taskIndex: issue.taskIndex };
      objectLabel = 'Квест «' + questTitle(data, issue.questId) + '»';
      if (issue.stageIndex != null) {
        path = 'Этап ' + (issue.stageIndex + 1);
        const st = data?.quests?.[issue.questId]?.stages?.[issue.stageIndex];
        if (st?.title) path += ' «' + st.title + '»';
      }
      if (issue.taskIndex != null) {
        const task = data?.quests?.[issue.questId]?.stages?.[issue.stageIndex]?.tasks?.[issue.taskIndex];
        const human = task && typeof Editor.humanizeQuestTask === 'function'
          ? Editor.humanizeQuestTask(task)
          : (task?.type || 'задача');
        path = (path ? path + ' → ' : '') + 'задача «' + human + '»';
      }
      action = {
        label: issue.taskIndex != null ? 'Открыть задачу' : (issue.stageIndex != null ? 'Открыть этап' : 'Открыть квест'),
        run: () => openQuest(issue.questId, issue.stageIndex, issue.taskIndex)
      };
    } else if (issue.npcId) {
      object = { type: 'npc', id: issue.npcId };
      objectLabel = 'NPC «' + (data?.npcs?.[issue.npcId]?.name || issue.npcId) + '»';
      action = { label: 'Открыть NPC', run: () => openNpc(issue.npcId) };
      if (issue.type === 'npc_no_description') {
        fixable = true;
        fix = () => {
          const n = data.npcs[issue.npcId];
          if (n && !n.description) n.description = n.name || '';
        };
      }
    } else if (issue.sceneId) {
      object = { type: 'scene', id: issue.sceneId, field: issue.field };
      objectLabel = 'Сцена «' + (data?.scenes?.[issue.sceneId]?.location || data?.scenes?.[issue.sceneId]?.title || issue.sceneId) + '»';
      path = issue.field ? ('поле ' + issue.field) : '';
      if (issue.targetId) {
        message; // keep
        path = (path ? path + ': ' : '') + '→ «' + issue.targetId + '»';
      }
      action = {
        label: issue.targetId && !data?.scenes?.[issue.targetId] ? 'Open and Fix' : 'Open and Fix',
        run: () => openScene(issue.sceneId, {
          field: issue.field,
          choiceIndex: issue.choiceIndex,
          nodeId: issue.nodeId,
          targetId: issue.targetId
        })
      };
      if (issue.type === 'missing_scene' || issue.type === 'element_missing_scene') {
        fixable = true;
        fix = () => clearBrokenSceneRef(data, issue);
      }
    } else if (issue.itemId) {
      object = { type: 'item', id: issue.itemId };
      objectLabel = 'Предмет «' + (data?.items?.[issue.itemId]?.name || issue.itemId) + '»';
      action = { label: 'Открыть предмет', run: () => openItem(issue.itemId) };
    } else if (issue.entityType === 'scene' && (issue.entityId || issue.sceneId)) {
      const sid = issue.sceneId || issue.entityId;
      const pathCtx = typeof Editor.ValidatorNav?.parseJsonPath === 'function'
        ? Editor.ValidatorNav.parseJsonPath(issue.path)
        : {};
      object = { type: 'scene', id: sid, field: issue.field || pathCtx.field };
      objectLabel = 'Сцена «' + (data?.scenes?.[sid]?.location || data?.scenes?.[sid]?.title || sid) + '»';
      path = issue.path || '';
      action = {
        label: 'Open and Fix',
        run: () => openScene(sid, {
          field: issue.field || pathCtx.field,
          choiceIndex: issue.choiceIndex ?? pathCtx.choiceIndex,
          nodeId: issue.nodeId || pathCtx.nodeId,
          targetId: issue.targetId,
          section: pathCtx.section
        })
      };
      if (issue.type === 'missing_scene' || issue.type === 'broken_transition') {
        fixable = true;
        fix = () => clearBrokenSceneRef(data, Object.assign({ sceneId: sid }, issue, pathCtx));
      }
    } else if (issue.entityType === 'item' && issue.entityId) {
      object = { type: 'item', id: issue.entityId };
      objectLabel = 'Предмет «' + (data?.items?.[issue.entityId]?.name || issue.entityId) + '»';
      action = { label: 'Open and Fix', run: () => openItem(issue.entityId) };
    } else if (issue.entityType === 'npc' && issue.entityId) {
      object = { type: 'npc', id: issue.entityId };
      objectLabel = 'NPC «' + (data?.npcs?.[issue.entityId]?.name || issue.entityId) + '»';
      action = { label: 'Open and Fix', run: () => openNpc(issue.entityId) };
    } else if (issue.entityType === 'enemy' && issue.entityId) {
      object = { type: 'enemy', id: issue.entityId };
      objectLabel = 'Враг «' + (data?.enemies?.[issue.entityId]?.name || issue.entityId) + '»';
      action = { label: 'Open and Fix', run: () => openEnemy(issue.entityId) };
    } else if (issue.entityType === 'quest' && issue.entityId) {
      object = { type: 'quest', id: issue.entityId };
      objectLabel = 'Квест «' + questTitle(data, issue.entityId) + '»';
      action = { label: 'Open and Fix', run: () => openQuest(issue.entityId) };
    } else if (issue.tab === 'classes' && issue.classId) {
      object = { type: 'class', id: issue.classId };
      objectLabel = 'Класс «' + (data?.classes?.[issue.classId]?.name || issue.classId) + '»';
      action = {
        label: 'Открыть классы',
        run: () => { if (Editor.switchTab) Editor.switchTab('classes'); }
      };
    } else {
      objectLabel = issue.tab ? ('Раздел «' + issue.tab + '»') : 'Проект';
    }

    return {
      id: issue.id || makeId([issue.type, issue.questId, issue.sceneId, issue.npcId, message]),
      severity,
      message,
      objectLabel,
      path,
      object,
      action,
      fixable,
      fix,
      raw: issue
    };
  }

  function clearBrokenSceneRef(data, issue) {
    const scene = data?.scenes?.[issue.sceneId];
    if (!scene) return;
    const field = issue.field;
    const target = issue.targetId;
    if (field === 'nextScene' && scene.nextScene === target) scene.nextScene = '';
    if (field === 'winScene' && scene.winScene === target) scene.winScene = '';
    if (field === 'lossScene' && scene.lossScene === target) scene.lossScene = '';
    if ((field === 'to' || field === 'nextScene') && issue.choiceIndex != null) {
      const ch = scene.choices?.[issue.choiceIndex];
      if (ch) {
        if (ch.to === target) ch.to = '';
        if (ch.nextScene === target) ch.nextScene = '';
        if (ch.winScene === target) ch.winScene = '';
        if (ch.lossScene === target) ch.lossScene = '';
        if (ch.skillCheck) {
          if (ch.skillCheck.successNext === target) ch.skillCheck.successNext = '';
          if (ch.skillCheck.failNext === target) ch.skillCheck.failNext = '';
        }
      }
    }
  }

  function collectQuestTaskIssues(data) {
    const out = [];
    if (typeof Editor.validateAllQuests !== 'function') return out;
    const list = Editor.validateAllQuests() || [];
    list.forEach((e) => {
      const task = data?.quests?.[e.questId]?.stages?.[e.stageIndex]?.tasks?.[e.taskIndex];
      const human = task && typeof Editor.humanizeQuestTask === 'function'
        ? Editor.humanizeQuestTask(task)
        : (e.taskType || 'задача');
      const path = 'Этап ' + ((e.stageIndex || 0) + 1) + ' → задача «' + human + '»';
      const object = {
        type: 'task',
        id: e.questId,
        stageIndex: e.stageIndex,
        taskIndex: e.taskIndex
      };

      (e.errors || ['Ошибка']).forEach((errMsg, i) => {
        const actions = [
          {
            label: 'Открыть задачу',
            run: () => openQuest(e.questId, e.stageIndex, e.taskIndex)
          }
        ];
        let fixable = false;
        let fix = null;
        let fixPreview = '';

        const msg = String(errMsg || '');
        const missingNpc = /NPC|Персонаж|npc/i.test(msg) && task && (task.type === 'TalkToNPC' || task.type === 'DeliverItem');
        const missingItem = /предмет|item/i.test(msg) && task && /Collect|Deliver|Use|Equip|Craft/i.test(task.type || '');
        const missingEnemy = /враг|enemy/i.test(msg) && task && task.type === 'KillEnemy';
        const missingScene = /сцен|место|локац|scene|location/i.test(msg) && task && /Visit|Discover/i.test(task.type || '');
        const unsupported = /unsupported|недоступн|неизвестн/i.test(msg);

        if (missingNpc) {
          actions.push({
            label: 'Выбрать персонажа',
            run: () => openQuest(e.questId, e.stageIndex, e.taskIndex)
          });
          actions.push({
            label: 'Создать персонажа',
            run: () => {
              openQuest(e.questId, e.stageIndex, e.taskIndex);
              if (typeof Editor.createEntityContextual === 'function') {
                const id = Editor.createEntityContextual('npc', {
                  name: 'Новый персонаж',
                  role: 'Квестовый'
                });
                if (id && task) {
                  task.npcId = id;
                  Editor.updateJSONPreview?.();
                  Editor.renderQuests?.();
                }
              } else if (typeof Editor.createNPC === 'function') {
                Editor.createNPC();
              }
            }
          });
        }
        if (missingItem) {
          actions.push({
            label: 'Выбрать предмет',
            run: () => openQuest(e.questId, e.stageIndex, e.taskIndex)
          });
          actions.push({
            label: 'Создать предмет',
            run: () => {
              openQuest(e.questId, e.stageIndex, e.taskIndex);
              if (typeof Editor.createEntityContextual === 'function') {
                const id = Editor.createEntityContextual('item', { name: 'Новый предмет' });
                if (id && task) {
                  task.itemId = id;
                  Editor.updateJSONPreview?.();
                  Editor.renderQuests?.();
                }
              }
            }
          });
        }
        if (missingEnemy) {
          actions.push({
            label: 'Выбрать врага',
            run: () => openQuest(e.questId, e.stageIndex, e.taskIndex)
          });
          actions.push({
            label: 'Создать врага',
            run: () => {
              if (typeof Editor.createEntityContextual === 'function') {
                const id = Editor.createEntityContextual('enemy', { name: 'Новый враг' });
                if (id && task) {
                  task.enemyId = id;
                  Editor.updateJSONPreview?.();
                  Editor.renderQuests?.();
                }
              }
            }
          });
        }
        if (missingScene) {
          actions.push({
            label: 'Выбрать место',
            run: () => openQuest(e.questId, e.stageIndex, e.taskIndex)
          });
        }

        // Delete task is always available for bad tasks
        actions.push({
          label: 'Удалить задачу',
          run: async () => {
            if (!(await Editor.confirmDialog({ message: 'Удалить эту задачу из этапа?', danger: true }))) return;
            const q = data.quests?.[e.questId];
            const st = q?.stages?.[e.stageIndex];
            if (st && Array.isArray(st.tasks)) {
              st.tasks.splice(e.taskIndex, 1);
              Editor.updateJSONPreview?.();
              Editor.renderQuests?.();
              if (Editor.toast) Editor.toast.success('Задача удалена');
              Editor.runProjectValidation?.();
            }
          }
        });

        if (unsupported) {
          fixable = true;
          fixPreview = 'Заменить на «После нажатия Продолжить»';
          fix = () => {
            if (task) {
              task.type = 'ManualAdvance';
              task.description = task.description || 'После нажатия «Продолжить»';
              delete task.npcId;
              delete task.itemId;
              delete task.enemyId;
            }
          };
        }

        // Clear dead entity refs (safe autofix)
        if (missingNpc && task?.npcId && !data.npcs?.[task.npcId]) {
          fixable = true;
          fixPreview = 'Очистить ссылку на отсутствующего персонажа';
          fix = () => { if (task) task.npcId = ''; };
        }
        if (missingItem && task?.itemId && !data.items?.[task.itemId]) {
          fixable = true;
          fixPreview = 'Очистить ссылку на отсутствующий предмет';
          fix = () => { if (task) task.itemId = ''; };
        }

        out.push({
          id: makeId(['quest_task', e.questId, e.stageIndex, e.taskIndex, i]),
          severity: 'error',
          message: msg,
          objectLabel: 'Квест «' + questTitle(data, e.questId) + '»',
          path,
          object,
          action: actions[0],
          actions,
          fixable,
          fix,
          fixPreview,
          category: 'quest'
        });
      });
    });
    return out;
  }

  function collectEmptyQuestIssues(data) {
    const out = [];
    Object.entries(data?.quests || {}).forEach(([qid, q]) => {
      const stages = Array.isArray(q?.stages) ? q.stages : [];
      if (!stages.length) {
        out.push({
          id: makeId(['empty_quest', qid]),
          severity: 'error',
          message: 'В квесте нет этапов. Добавьте хотя бы один этап с задачей.',
          objectLabel: 'Квест «' + questTitle(data, qid) + '»',
          path: '',
          object: { type: 'quest', id: qid },
          actions: [
            { label: 'Открыть квест', run: () => openQuest(qid) },
            {
              label: 'Добавить этап',
              run: () => {
                if (!q.stages) q.stages = [];
                q.stages.push({
                  id: 'stage_0',
                  title: 'Начало',
                  tasks: [{ type: 'ManualAdvance', description: 'После нажатия «Продолжить»' }]
                });
                Editor.updateJSONPreview?.();
                Editor.renderQuests?.();
              }
            }
          ],
          action: { label: 'Открыть квест', run: () => openQuest(qid) },
          fixable: true,
          fixPreview: 'Добавить пустой этап с «Продолжить»',
          fix: () => {
            q.stages = [{
              id: 'stage_0',
              title: 'Начало',
              tasks: [{ type: 'ManualAdvance', description: 'После нажатия «Продолжить»' }]
            }];
          },
          category: 'quest'
        });
        return;
      }
      stages.forEach((st, si) => {
        if (!st.tasks || !st.tasks.length) {
          out.push({
            id: makeId(['empty_stage', qid, si]),
            severity: 'warning',
            message: 'На этапе нет задач. Игрок не поймёт, что делать.',
            objectLabel: 'Квест «' + questTitle(data, qid) + '»',
            path: 'Этап ' + (si + 1) + (st.title ? (' «' + st.title + '»') : ''),
            object: { type: 'stage', id: qid, stageIndex: si },
            actions: [
              { label: 'Открыть этап', run: () => openQuest(qid, si) }
            ],
            action: { label: 'Открыть этап', run: () => openQuest(qid, si) },
            fixable: true,
            fixPreview: 'Добавить задачу «Продолжить»',
            fix: () => {
              st.tasks = [{ type: 'ManualAdvance', description: 'После нажатия «Продолжить»' }];
            },
            category: 'quest'
          });
        }
      });
    });
    return out;
  }

  function collectOrphanSceneIssues(data) {
    const out = [];
    const scenes = data?.scenes || {};
    const ids = Object.keys(scenes);
    if (ids.length < 2) return out;
    const targets = new Set();
    ids.forEach((sid) => {
      const sc = scenes[sid];
      if (sc?.nextScene) targets.add(sc.nextScene);
      (sc?.choices || []).forEach((c) => {
        if (c?.to) targets.add(c.to);
        if (c?.nextScene) targets.add(c.nextScene);
      });
    });
    // start scene is never orphan
    const start = data?.meta?.startScene || ids[0];
    ids.forEach((sid) => {
      if (sid === start) return;
      if (targets.has(sid)) return;
      // only warn if nothing points here
      out.push({
        id: makeId(['orphan_scene', sid]),
        severity: 'info',
        message: 'На эту сцену нет переходов из других сцен. Возможно, она недостижима.',
        objectLabel: 'Сцена «' + (scenes[sid]?.location || scenes[sid]?.title || sid) + '»',
        path: '',
        object: { type: 'scene', id: sid },
        actions: [{ label: 'Открыть сцену', run: () => openScene(sid) }],
        action: { label: 'Открыть сцену', run: () => openScene(sid) },
        fixable: false,
        category: 'scene'
      });
    });
    return out;
  }

  function collectBrokenDialogueLinks(data) {
    const out = [];
    Object.entries(data?.scenes || {}).forEach(([sid, sc]) => {
      (sc?.choices || []).forEach((c, ci) => {
        if (!c) return;
        // skillCheck nexts already in scene links; check empty choice text with link
        if ((c.to || c.nextScene) && !String(c.text || '').trim()) {
          out.push({
            id: makeId(['empty_choice_text', sid, ci]),
            severity: 'warning',
            message: 'У выбора нет текста, но есть переход.',
            objectLabel: 'Сцена «' + (sc.location || sc.title || sid) + '»',
            path: 'Выбор ' + (ci + 1),
            object: { type: 'scene', id: sid },
            actions: [{ label: 'Открыть сцену', run: () => openScene(sid) }],
            action: { label: 'Открыть сцену', run: () => openScene(sid) },
            fixable: false,
            category: 'dialogue'
          });
        }
      });
    });
    return out;
  }

  function collectNpcDescriptionWarnings(data) {
    const out = [];
    Object.entries(data?.npcs || {}).forEach(([npcId, n]) => {
      if (!n) return;
      if (String(n.name || '').trim() && !String(n.description || n.desc || '').trim()) {
        out.push({
          id: makeId(['npc_no_description', npcId]),
          type: 'npc_no_description',
          severity: 'warning',
          message: 'Не задано описание.',
          objectLabel: 'Персонаж «' + (n.name || npcId) + '»',
          path: '',
          object: { type: 'npc', id: npcId },
          action: { label: 'Открыть персонажа', run: () => openNpc(npcId) },
          fixable: true,
          fix: () => {
            if (data.npcs[npcId]) {
              data.npcs[npcId].description = data.npcs[npcId].name || '';
            }
          }
        });
      }
    });
    return out;
  }

  function collectSceneLinkIssues(data) {
    const out = [];
    if (typeof Editor.forEachSceneLink !== 'function') return out;
    const sceneIds = new Set(Object.keys(data?.scenes || {}));
    Object.entries(data?.scenes || {}).forEach(([sceneId, scene]) => {
      Editor.forEachSceneLink(sceneId, scene, (field, targetId, ctx) => {
        if (typeof Editor.isValidSceneTarget === 'function'
          ? Editor.isValidSceneTarget(targetId, sceneIds)
          : sceneIds.has(targetId) || targetId === 'reset') {
          return;
        }
        out.push({
          id: makeId(['missing_scene', sceneId, field, targetId, ctx.choiceIndex]),
          type: 'missing_scene',
          severity: 'error',
          message: 'Переход ведёт на несуществующую сцену:\n' + targetId,
          objectLabel: 'Сцена «' + (scene.location || scene.title || sceneId) + '»',
          path: field + (ctx.choiceIndex != null ? (' (выбор ' + (ctx.choiceIndex + 1) + ')') : ''),
          object: { type: 'scene', id: sceneId, field },
          action: {
            label: 'Открыть',
            run: () => openScene(sceneId, { field, choiceIndex: ctx.choiceIndex, targetId })
          },
          actions: [
            {
              label: 'Открыть',
              run: () => openScene(sceneId, { field, choiceIndex: ctx.choiceIndex, targetId })
            },
            {
              label: 'Удалить ссылку',
              run: () => {
                clearBrokenSceneRef(data, {
                  sceneId, field, targetId, choiceIndex: ctx.choiceIndex
                });
                Editor.updateJSONPreview?.();
                if (Editor.toast) Editor.toast.success('Ссылка удалена');
                Editor.runProjectValidation?.();
              }
            }
          ],
          fixable: true,
          fixPreview: 'Удалить переход на несуществующую сцену',
          fix: () => clearBrokenSceneRef(data, {
            sceneId,
            field,
            targetId,
            choiceIndex: ctx.choiceIndex
          }),
          raw: { sceneId, field, targetId, choiceIndex: ctx.choiceIndex },
          category: 'scene'
        });
      });
    });
    return out;
  }

  /**
   * Full structured validation
   * @returns {{ ok: boolean, issues: ProjectIssue[], errors: ProjectIssue[], warnings: ProjectIssue[] }}
   */
  Editor.collectProjectIssues = function collectProjectIssues() {
    const data = this.data;
    const issues = [];

    if (!data) {
      issues.push({
        id: 'no_data',
        severity: 'error',
        message: 'Нет данных проекта. Загрузите или создайте проект.',
        objectLabel: 'Проект',
        path: '',
        object: { type: 'project' },
        action: {
          label: 'Загрузить',
          run: () => { if (typeof Editor.loadData === 'function') Editor.loadData(); }
        }
      });
      return { ok: false, issues, errors: issues, warnings: [] };
    }

    // Extended validator if present
    if (typeof this.validateProjectExtended === 'function') {
      try {
        const r = this.validateProjectExtended();
        (r?.issues || []).forEach((iss) => {
          const n = normalizeLegacy(iss, data);
          if (n) issues.push(n);
        });
      } catch (e) {
        console.warn('[validator]', e);
      }
    } else if (typeof this.validateProject === 'function') {
      try {
        const r = this.validateProject();
        (r?.issues || []).forEach((iss) => {
          const n = normalizeLegacy(iss, data);
          if (n) issues.push(n);
        });
      } catch (e) {
        console.warn('[validator]', e);
      }
    }

    issues.push(...collectQuestTaskIssues(data));
    issues.push(...collectEmptyQuestIssues(data));
    issues.push(...collectNpcDescriptionWarnings(data));
    issues.push(...collectSceneLinkIssues(data));
    issues.push(...collectOrphanSceneIssues(data));
    issues.push(...collectBrokenDialogueLinks(data));

    // Dedupe by id
    const seen = new Set();
    const unique = [];
    issues.forEach((i) => {
      const id = i.id || makeId([i.message, i.objectLabel, i.path]);
      if (seen.has(id)) return;
      seen.add(id);
      i.id = id;
      unique.push(i);
    });

    const errors = unique.filter((i) => i.severity === 'error');
    const warnings = unique.filter((i) => i.severity === 'warning');
    const result = {
      ok: errors.length === 0,
      issues: unique,
      errors,
      warnings
    };
    this._lastProjectIssues = result;
    return result;
  };

  Editor.runProjectValidation = function runProjectValidation() {
    const result = this.collectProjectIssues();
    this.showProjectValidationResults(result);
    if (result.ok) {
      if (Editor.toast) Editor.toast.success('Проект в порядке');
    } else {
      if (Editor.toast) {
        Editor.toast.warning(
          'Ошибок: ' + result.errors.length + (result.warnings.length ? (', предупреждений: ' + result.warnings.length) : '')
        );
      }
    }
    return result;
  };

  Editor.showProjectValidationResults = function showProjectValidationResults(result) {
    result = result || this.collectProjectIssues();
    let modal = document.getElementById('editor-project-validation-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'editor-project-validation-modal';
      modal.className = 'editor-modal';
      document.body.appendChild(modal);
    }
    const items = result.issues || [];
    const listHtml = items.length
      ? items.map((iss, idx) => {
          const icon = iss.severity === 'error' ? '🔴' : (iss.severity === 'warning' ? '🟡' : '🔵');
          const acts = Array.isArray(iss.actions) && iss.actions.length
            ? iss.actions
            : (iss.action ? [iss.action] : []);
          const actionBtns = acts.map((a, ai) =>
            `<button type="button" class="btn btn-secondary btn-sm" data-issue-action="${idx}" data-action-i="${ai}">${esc(a.label || 'Открыть')}</button>`
          ).join('');
          const fixBtn = iss.fixable && typeof iss.fix === 'function'
            ? `<button type="button" class="btn btn-primary btn-sm" data-issue-fix="${idx}" title="${esc(iss.fixPreview || 'Безопасное исправление')}">Исправить</button>`
            : '';
          return `<li class="pv-issue pv-issue--${esc(iss.severity)}" data-issue-id="${esc(iss.id)}">
            <div class="pv-issue-icon">${icon}</div>
            <div class="pv-issue-body">
              <div class="pv-issue-object">${esc(iss.objectLabel)}</div>
              ${iss.path ? `<div class="pv-issue-path">${esc(iss.path)}</div>` : ''}
              <div class="pv-issue-msg">${esc(iss.message)}</div>
              ${iss.fixPreview ? `<div class="pv-issue-path">Авто-исправление: ${esc(iss.fixPreview)}</div>` : ''}
              <div class="pv-issue-actions">${actionBtns}${fixBtn}</div>
            </div>
          </li>`;
        }).join('')
      : '<li class="pv-issue pv-issue--ok"><div class="pv-issue-body">✓ Проблем не найдено</div></li>';

    const fixableCount = items.filter((i) => i.fixable).length;

    modal.innerHTML = `
      <div class="editor-modal-backdrop" data-pv-close="1"></div>
      <div class="editor-modal-panel editor-modal-panel--wide" style="max-width:640px;">
        <div class="quest-detail-head">
          <h2>Проверка проекта</h2>
          <button type="button" class="btn-remove" data-pv-close="1">×</button>
        </div>
        <p class="hint">Ошибок: ${result.errors.length} · Предупреждений: ${result.warnings.length}</p>
        <ul class="pv-issue-list">${listHtml}</ul>
        <div class="pv-footer">
          <button type="button" class="btn btn-secondary" data-pv-close="1">Закрыть</button>
          <button type="button" class="btn btn-secondary" data-pv-recheck="1">Проверить проект</button>
          <button type="button" class="btn btn-primary" data-pv-fixall="1" ${fixableCount ? '' : 'disabled'}>
            Исправить всё, что возможно автоматически (${fixableCount})
          </button>
        </div>
      </div>`;
    modal.classList.remove('hidden');

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
            if (typeof Editor.updateJSONPreview === 'function') Editor.updateJSONPreview();
            if (Editor.toast) Editor.toast.success('Исправлено');
            Editor.runProjectValidation();
          } catch (err) {
            if (Editor.toast) Editor.toast.error(String(err.message || err));
          }
        }
      }
    };
  };

  /**
   * Safe autofix only
   */
  Editor.autofixProjectIssues = async function autofixProjectIssues(opts) {
    opts = opts || {};
    const result = this.collectProjectIssues();
    const fixable = result.issues.filter((iss) => iss.fixable && typeof iss.fix === 'function');
    if (!fixable.length) {
      if (Editor.toast) Editor.toast.info('Нечего исправлять автоматически');
      return result;
    }

    // Preview before applying (unless confirmed)
    if (!opts.confirmed) {
      const lines = fixable.map((iss, i) =>
        (i + 1) + '. ' + (iss.objectLabel || '') +
        (iss.path ? ' — ' + iss.path : '') +
        '\n   → ' + (iss.fixPreview || iss.message || 'безопасное исправление')
      );
      const preview =
        'Будут применены безопасные исправления (' + fixable.length + '):\n\n' +
        lines.slice(0, 15).join('\n') +
        (lines.length > 15 ? '\n… и ещё ' + (lines.length - 15) : '') +
        '\n\nПродолжить?';
      if (!(await Editor.confirmDialog({ message: preview }))) {
        if (Editor.toast) Editor.toast.info('Авто-исправление отменено');
        return result;
      }
    }

    let fixed = 0;
    fixable.forEach((iss) => {
      try {
        iss.fix();
        fixed += 1;
      } catch (e) {
        console.warn('[autofix]', iss.id, e);
      }
    });
    if (typeof this.updateJSONPreview === 'function') this.updateJSONPreview();
    if (typeof this.renderAll === 'function') {
      try { this.renderAll(); } catch (e) { /* */ }
    }
    if (Editor.toast) {
      if (fixed) Editor.toast.success('Исправлено безопасно: ' + fixed);
      else Editor.toast.info('Нечего исправлять автоматически');
    }
    return this.runProjectValidation();
  };

  // Styles
  if (typeof document !== 'undefined' && !document.getElementById('project-validator-ux-styles')) {
    const st = document.createElement('style');
    st.id = 'project-validator-ux-styles';
    st.textContent = `
      .pv-issue-list { list-style: none; margin: 0; padding: 0; max-height: 50vh; overflow-y: auto; }
      .pv-issue {
        display: flex; gap: 10px; padding: 12px; border-radius: 10px;
        border: 1px solid var(--border, #ddd); margin-bottom: 8px; background: rgba(0,0,0,.02);
      }
      .pv-issue--error { border-color: #e57373; background: #fff8f8; }
      .pv-issue--warning { border-color: #ffb74d; background: #fffbf5; }
      .pv-issue--ok { border-color: #81c784; }
      .pv-issue-icon { font-size: 1.1rem; flex-shrink: 0; }
      .pv-issue-object { font-weight: 700; font-size: 14px; }
      .pv-issue-path { font-size: 12px; color: var(--muted, #666); margin: 2px 0 4px; }
      .pv-issue-msg { font-size: 13px; white-space: pre-wrap; line-height: 1.4; }
      .pv-issue-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
      .pv-footer { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; margin-top: 14px; }
    `;
    document.head.appendChild(st);
  }

  // Override command if exists
  if (Editor.commands?.register) {
    Editor.commands.register({
      id: 'project.validate',
      title: 'Проверить проект',
      category: 'Проект',
      keywords: ['validate', 'lint', 'ошибки'],
      action() { Editor.runProjectValidation(); }
    });
    Editor.commands.register({
      id: 'project.autofix',
      title: 'Исправить всё возможное',
      category: 'Проект',
      keywords: ['autofix', 'fix'],
      action() { Editor.autofixProjectIssues(); }
    });
  }

  // Align validation module entry
  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-project-validator-ux', {
      collectProjectIssues: Editor.collectProjectIssues,
      runProjectValidation: Editor.runProjectValidation,
      autofixProjectIssues: Editor.autofixProjectIssues
    }, { force: true });
  }
})();
