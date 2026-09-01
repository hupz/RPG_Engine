/**
 * Phase 1.11 — Project Validation & Data Integrity
 * Headless editor-side validator (no DOM, no runtime engine).
 *
 * API:
 *   ProjectValidator.validateProject(data, options?) →
 *   { valid, errors, warnings, info, summary, issues }
 */
(function attachProjectValidator(global) {
  'use strict';

  const SEVERITY = Object.freeze({ ERROR: 'error', WARNING: 'warning', INFO: 'info' });

  function issue(partial) {
    return {
      type: partial.type || 'unknown',
      severity: partial.severity || SEVERITY.ERROR,
      message: partial.message || '',
      entityType: partial.entityType || null,
      entityId: partial.entityId || null,
      path: partial.path || '',
      fixHint: partial.fixHint || null,
      tab: partial.tab || null,
      sceneId: partial.sceneId || null,
      targetId: partial.targetId || null
    };
  }

  function getRegistry(opts) {
    if (opts && opts.actionRegistry) return opts.actionRegistry;
    if (typeof ACTION_REGISTRY !== 'undefined' && ACTION_REGISTRY) return ACTION_REGISTRY;
    if (global && global.ACTION_REGISTRY) return global.ACTION_REGISTRY;
    return null;
  }

  function getActionCatalogApi(opts) {
    if (opts && opts.actionCatalog) return opts.actionCatalog;
    if (typeof EditorActionCatalog !== 'undefined') return EditorActionCatalog;
    if (global && global.EditorActionCatalog) return global.EditorActionCatalog;
    return null;
  }

  function getConditionCatalogApi(opts) {
    if (opts && opts.conditionCatalog) return opts.conditionCatalog;
    if (typeof EditorConditionCatalog !== 'undefined') return EditorConditionCatalog;
    if (global && global.EditorConditionCatalog) return global.EditorConditionCatalog;
    return null;
  }

  function getActionDef(catalogApi, actionId) {
    if (!actionId) return null;
    if (catalogApi && typeof catalogApi.getActionDefinition === 'function') {
      return catalogApi.getActionDefinition(actionId);
    }
    return null;
  }

  function validateConditionRules(showIf, opts) {
    const cat = getConditionCatalogApi(opts);
    if (cat && typeof cat.validateConditionRules === 'function') {
      return cat.validateConditionRules(showIf);
    }
    if (typeof Editor !== 'undefined' && typeof Editor.validateConditionRules === 'function') {
      return Editor.validateConditionRules(showIf);
    }
    // Minimal fallback (no catalog loaded)
    if (showIf == null || showIf === '' || showIf === true) {
      return { ok: true, errors: [], warnings: [] };
    }
    if (typeof showIf !== 'object') {
      return { ok: false, errors: ['Condition must be an object'], warnings: [] };
    }
    if (Array.isArray(showIf.rules) && !showIf.all && !showIf.any) {
      return {
        ok: false,
        errors: ['Invalid condition shape: use { all: [...] } or { any: [...] }, not { rules: [...] }'],
        warnings: []
      };
    }
    return { ok: true, errors: [], warnings: [] };
  }

  /** Collect action steps from visual / UI / scene events / dialogue topics */
  function walkActionSteps(data, visit) {
    const scenes = data.scenes || {};
    Object.entries(scenes).forEach(([sceneId, scene]) => {
      const sceneEv = scene?.events || {};
      ['enter', 'exit'].forEach((evKey) => {
        (sceneEv[evKey] || []).forEach((step, idx) => {
          visit(step, {
            sceneId,
            path: 'scenes.' + sceneId + '.events.' + evKey + '[' + idx + ']',
            entityType: 'scene',
            entityId: sceneId,
            tab: 'scenes'
          });
        });
      });

      (scene?.choices || []).forEach((ch, ci) => {
        if (ch?.showIf) {
          visit._condition(ch.showIf, {
            sceneId,
            path: 'scenes.' + sceneId + '.choices[' + ci + '].showIf',
            entityType: 'scene',
            entityId: sceneId,
            tab: 'scenes'
          });
        }
      });

      (scene?.components || []).forEach((comp, cidx) => {
        const topics = comp?.params?.topics || [];
        topics.forEach((t, ti) => {
          if (t?.showIf) {
            visit._condition(t.showIf, {
              sceneId,
              path: 'scenes.' + sceneId + '.components[' + cidx + '].topics[' + ti + '].showIf',
              entityType: 'scene',
              entityId: sceneId,
              tab: 'scenes'
            });
          }
          (t?.actions || []).forEach((step, ai) => {
            visit(step, {
              sceneId,
              path: 'scenes.' + sceneId + '.components[' + cidx + '].topics[' + ti + '].actions[' + ai + ']',
              entityType: 'scene',
              entityId: sceneId,
              tab: 'scenes'
            });
          });
          if (t?.nextScene) {
            visit._sceneRef(t.nextScene, {
              sceneId,
              path: 'scenes.' + sceneId + '.components[' + cidx + '].topics[' + ti + '].nextScene',
              entityType: 'scene',
              entityId: sceneId,
              tab: 'scenes',
              field: 'nextScene'
            });
          }
        });
      });

      const nodes = scene?.visual?.nodes || [];
      nodes.forEach((node) => {
        if (node?.showIf) {
          visit._condition(node.showIf, {
            sceneId,
            path: 'scenes.' + sceneId + '.visual.nodes.' + (node.id || '?') + '.showIf',
            entityType: 'scene',
            entityId: sceneId,
            tab: 'scenes',
            nodeId: node.id
          });
        }
        const events = node?.events || {};
        ['click', 'hover', 'enter', 'exit'].forEach((evKey) => {
          (events[evKey] || []).forEach((step, idx) => {
            visit(step, {
              sceneId,
              path: 'scenes.' + sceneId + '.visual.nodes.' + (node.id || '?') + '.events.' + evKey + '[' + idx + ']',
              entityType: 'scene',
              entityId: sceneId,
              tab: 'scenes',
              nodeId: node.id
            });
          });
        });
      });
    });

    Object.entries(data.ui?.screens || {}).forEach(([screenId, screen]) => {
      (screen?.nodes || []).forEach((node) => {
        const events = node?.events || {};
        ['click', 'hover', 'show'].forEach((evKey) => {
          (events[evKey] || []).forEach((step, idx) => {
            visit(step, {
              path: 'ui.screens.' + screenId + '.nodes.' + (node.id || '?') + '.events.' + evKey + '[' + idx + ']',
              entityType: 'ui_screen',
              entityId: screenId,
              tab: 'game_ui',
              nodeId: node.id
            });
          });
        });
      });
    });
  }

  function extractSceneTargetsFromStep(step) {
    if (!step || typeof step !== 'object') return [];
    const params = step.params || {};
    const out = [];
    const action = step.action;
    if (action === 'change_scene' || action === 'go_to_scene') {
      if (params.sceneId) out.push({ field: 'sceneId', id: String(params.sceneId) });
      if (params.to) out.push({ field: 'to', id: String(params.to) });
    }
    if (params.nextScene) out.push({ field: 'nextScene', id: String(params.nextScene) });
    if (params.winScene) out.push({ field: 'winScene', id: String(params.winScene) });
    if (params.lossScene) out.push({ field: 'lossScene', id: String(params.lossScene) });
    return out;
  }

  function extractEntityRefsFromStep(step) {
    if (!step || typeof step !== 'object') return [];
    const params = step.params || {};
    const out = [];
    if (params.itemId) out.push({ kind: 'item', id: String(params.itemId), field: 'itemId' });
    if (params.questId) out.push({ kind: 'quest', id: String(params.questId), field: 'questId' });
    if (params.npcId) out.push({ kind: 'npc', id: String(params.npcId), field: 'npcId' });
    if (Array.isArray(params.enemies)) {
      params.enemies.forEach((eid) => {
        if (eid) out.push({ kind: 'enemy', id: String(eid), field: 'enemies' });
      });
    } else if (params.enemies != null && params.enemies !== '') {
      const parsed = (typeof CombatAuthoringIndex !== 'undefined' && CombatAuthoringIndex && CombatAuthoringIndex.parseEnemyIds)
        ? CombatAuthoringIndex.parseEnemyIds(params.enemies)
        : String(params.enemies).split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
      parsed.forEach((eid) => {
        if (eid) out.push({ kind: 'enemy', id: String(eid), field: 'enemies' });
      });
    }
    if (params.enemyId) out.push({ kind: 'enemy', id: String(params.enemyId), field: 'enemyId' });
    return out;
  }

  function collectClassicSceneLinks(sceneId, scene, callback) {
    const visit = (field, targetId, ctx) => {
      if (targetId == null || targetId === '') return;
      const id = String(targetId).trim();
      if (!id) return;
      callback(field, id, ctx || {});
    };
    if (scene?.nextScene) visit('nextScene', scene.nextScene);
    if (scene?.winScene) visit('winScene', scene.winScene);
    if (scene?.lossScene) visit('lossScene', scene.lossScene);
    if (scene?.hubScene) visit('hubScene', scene.hubScene);
    if (scene?.exitScene) visit('exitScene', scene.exitScene);
    (scene?.choices || []).forEach((choice, choiceIndex) => {
      if (choice?.to) visit('to', choice.to, { choiceIndex });
      if (choice?.nextScene) visit('nextScene', choice.nextScene, { choiceIndex });
      const sc = choice?.skillCheck;
      if (sc?.successNext) visit('successNext', sc.successNext, { choiceIndex });
      if (sc?.failNext) visit('failNext', sc.failNext, { choiceIndex });
    });
  }

  function isReservedSceneTarget(id) {
    return id === 'reset';
  }

  function getStartSceneId(data) {
    if (data.startScene && data.scenes?.[data.startScene]) return String(data.startScene);
    if (data.meta?.startScene && data.scenes?.[data.meta.startScene]) return String(data.meta.startScene);
    const keys = Object.keys(data.scenes || {});
    return keys[0] || null;
  }

  function buildReachableSet(data) {
    const scenes = data.scenes || {};
    const sceneIds = new Set(Object.keys(scenes));
    const start = getStartSceneId(data);
    if (!start) return new Set();
    const reachable = new Set();
    const queue = [start];
    while (queue.length) {
      const sid = queue.shift();
      if (reachable.has(sid) || !sceneIds.has(sid)) continue;
      reachable.add(sid);
      const scene = scenes[sid];
      collectClassicSceneLinks(sid, scene, (_f, tid) => {
        if (isReservedSceneTarget(tid)) return;
        if (sceneIds.has(tid) && !reachable.has(tid)) queue.push(tid);
      });
      // visual / component / event transitions
      const nodes = scene?.visual?.nodes || [];
      nodes.forEach((node) => {
        ['click', 'hover', 'enter', 'exit'].forEach((ev) => {
          (node?.events?.[ev] || []).forEach((step) => {
            extractSceneTargetsFromStep(step).forEach((t) => {
              if (sceneIds.has(t.id) && !reachable.has(t.id)) queue.push(t.id);
            });
          });
        });
      });
      ['enter', 'exit'].forEach((ev) => {
        (scene?.events?.[ev] || []).forEach((step) => {
          extractSceneTargetsFromStep(step).forEach((t) => {
            if (sceneIds.has(t.id) && !reachable.has(t.id)) queue.push(t.id);
          });
        });
      });
      (scene?.components || []).forEach((comp) => {
        (comp?.params?.topics || []).forEach((t) => {
          if (t?.nextScene && sceneIds.has(String(t.nextScene)) && !reachable.has(String(t.nextScene))) {
            queue.push(String(t.nextScene));
          }
          (t?.actions || []).forEach((step) => {
            extractSceneTargetsFromStep(step).forEach((ref) => {
              if (sceneIds.has(ref.id) && !reachable.has(ref.id)) queue.push(ref.id);
            });
          });
        });
      });
    }
    return reachable;
  }

  function validateActionStep(step, ctx, data, opts, push) {
    if (!step || typeof step !== 'object') {
      push(issue({
        type: 'malformed_action',
        severity: SEVERITY.WARNING,
        message: 'Пустой или некорректный шаг действия',
        entityType: ctx.entityType,
        entityId: ctx.entityId,
        path: ctx.path,
        tab: ctx.tab,
        sceneId: ctx.sceneId,
        fixHint: 'Укажите { action, params }'
      }));
      return;
    }
    const actionId = step.action;
    if (!actionId || typeof actionId !== 'string') {
      push(issue({
        type: 'missing_action_id',
        severity: SEVERITY.WARNING,
        message: 'У шага нет поля action',
        entityType: ctx.entityType,
        entityId: ctx.entityId,
        path: ctx.path,
        tab: ctx.tab,
        sceneId: ctx.sceneId
      }));
      return;
    }
    if (actionId.indexOf('(') !== -1) {
      push(issue({
        type: 'action_js_call',
        severity: SEVERITY.ERROR,
        message: 'Action выглядит как JS-вызов: «' + actionId + '»',
        entityType: ctx.entityType,
        entityId: ctx.entityId,
        path: ctx.path,
        tab: ctx.tab,
        sceneId: ctx.sceneId,
        fixHint: 'Используйте id из ACTION_REGISTRY'
      }));
      return;
    }

    const registry = getRegistry(opts);
    const catalog = getActionCatalogApi(opts);
    const inRegistry = !!(registry && registry[actionId]);
    const def = getActionDef(catalog, actionId);

    if (!inRegistry) {
      // Unknown / legacy — WARNING, never hard-block
      push(issue({
        type: 'unknown_action',
        severity: SEVERITY.WARNING,
        message: 'Неизвестное действие «' + actionId + '» (нет в ACTION_REGISTRY)',
        entityType: ctx.entityType,
        entityId: ctx.entityId,
        path: ctx.path,
        tab: ctx.tab,
        sceneId: ctx.sceneId,
        fixHint: 'Проверьте опечатку или зарегистрируйте действие'
      }));
    } else if (!def) {
      push(issue({
        type: 'action_not_in_catalog',
        severity: SEVERITY.INFO,
        message: 'Действие «' + actionId + '» в реестре, но нет в Editor Catalog (advanced/legacy)',
        entityType: ctx.entityType,
        entityId: ctx.entityId,
        path: ctx.path,
        tab: ctx.tab,
        sceneId: ctx.sceneId
      }));
    }

    // Param structure vs catalog (soft)
    if (def && Array.isArray(def.params)) {
      const params = step.params || {};
      def.params.forEach((p) => {
        if (!p.required) return;
        const v = params[p.id];
        if (v == null || v === '') {
          push(issue({
            type: 'missing_action_param',
            severity: SEVERITY.WARNING,
            message: 'У «' + actionId + '» нет обязательного параметра «' + (p.label || p.id) + '»',
            entityType: ctx.entityType,
            entityId: ctx.entityId,
            path: ctx.path + '.params.' + p.id,
            tab: ctx.tab,
            sceneId: ctx.sceneId
          }));
        }
      });
    }

    // Scene targets from action
    extractSceneTargetsFromStep(step).forEach((t) => {
      if (isReservedSceneTarget(t.id)) return;
      if (!data.scenes?.[t.id]) {
        push(issue({
          type: 'missing_scene',
          severity: SEVERITY.ERROR,
          message: 'Действие «' + actionId + '» ссылается на отсутствующую сцену «' + t.id + '»',
          entityType: ctx.entityType,
          entityId: ctx.entityId,
          path: ctx.path + '.params.' + t.field,
          tab: ctx.tab || 'scenes',
          sceneId: ctx.sceneId,
          targetId: t.id,
          fixHint: 'Создайте сцену или исправьте id'
        }));
      }
    });

    // Entity refs
    extractEntityRefsFromStep(step).forEach((ref) => {
      if (ref.kind === 'item' && !data.items?.[ref.id]) {
        push(issue({
          type: 'missing_item',
          severity: SEVERITY.ERROR,
          message: 'Ссылка на отсутствующий предмет «' + ref.id + '»',
          entityType: 'item',
          entityId: ref.id,
          path: ctx.path + '.params.' + ref.field,
          tab: ctx.tab,
          sceneId: ctx.sceneId,
          fixHint: 'Создайте предмет или исправьте itemId'
        }));
      }
      if (ref.kind === 'quest' && !data.quests?.[ref.id]) {
        push(issue({
          type: 'missing_quest',
          severity: SEVERITY.ERROR,
          message: 'Ссылка на отсутствующий квест «' + ref.id + '»',
          entityType: 'quest',
          entityId: ref.id,
          path: ctx.path + '.params.' + ref.field,
          tab: ctx.tab,
          sceneId: ctx.sceneId,
          fixHint: 'Создайте квест или исправьте questId'
        }));
      }
      if (ref.kind === 'npc' && !data.npcs?.[ref.id]) {
        push(issue({
          type: 'missing_npc',
          severity: SEVERITY.ERROR,
          message: 'Ссылка на отсутствующего NPC «' + ref.id + '»',
          entityType: 'npc',
          entityId: ref.id,
          path: ctx.path + '.params.' + ref.field,
          tab: ctx.tab,
          sceneId: ctx.sceneId
        }));
      }
      if (ref.kind === 'enemy' && !data.enemies?.[ref.id]) {
        push(issue({
          type: 'missing_enemy',
          severity: SEVERITY.ERROR,
          message: 'Ссылка на отсутствующего врага «' + ref.id + '»',
          entityType: 'enemy',
          entityId: ref.id,
          path: ctx.path + '.params.' + ref.field,
          tab: ctx.tab,
          sceneId: ctx.sceneId
        }));
      }
    });

    // Quest stage param
    const params = step.params || {};
    if (params.questId && data.quests?.[params.questId] && params.stage != null && params.stage !== '' && params.stage !== 'complete' && params.stage !== 'failed') {
      const q = data.quests[params.questId];
      const stages = Array.isArray(q.stages) ? q.stages : [];
      const stageStr = String(params.stage);
      const okIndex = /^\d+$/.test(stageStr) && Number(stageStr) >= 0 && Number(stageStr) < stages.length;
      const okId = stages.some((st, i) => String(st?.id != null ? st.id : i) === stageStr);
      if (!okIndex && !okId) {
        push(issue({
          type: 'invalid_quest_stage',
          severity: SEVERITY.WARNING,
          message: 'Квест «' + params.questId + '»: этап «' + stageStr + '» не найден',
          entityType: 'quest',
          entityId: params.questId,
          path: ctx.path + '.params.stage',
          tab: ctx.tab,
          sceneId: ctx.sceneId
        }));
      }
    }

    // Reward amounts (item count / gold)
    if (actionId === 'add_item' || actionId === 'remove_item') {
      if (params.count != null && params.count !== '') {
        const c = Number(params.count);
        if (!Number.isFinite(c) || c < 1) {
          push(issue({
            type: 'invalid_amount',
            severity: SEVERITY.WARNING,
            message: 'Некорректное количество предмета: «' + params.count + '»',
            entityType: ctx.entityType,
            entityId: ctx.entityId,
            path: ctx.path + '.params.count',
            tab: ctx.tab,
            sceneId: ctx.sceneId,
            fixHint: 'count должен быть числом >= 1'
          }));
        }
      }
    }
    if (actionId === 'add_gold' || actionId === 'remove_gold') {
      if (params.amount != null && params.amount !== '') {
        const a = Number(params.amount);
        if (!Number.isFinite(a) || a < 0) {
          push(issue({
            type: 'invalid_amount',
            severity: SEVERITY.WARNING,
            message: 'Некорректное количество золота: «' + params.amount + '»',
            entityType: ctx.entityType,
            entityId: ctx.entityId,
            path: ctx.path + '.params.amount',
            tab: ctx.tab,
            sceneId: ctx.sceneId,
            fixHint: 'amount должен быть числом >= 0'
          }));
        }
      }
    }

    // Macro ids must never appear as runtime actions
    const rewardMacros = (typeof ItemsRewardsIndex !== 'undefined' && ItemsRewardsIndex && ItemsRewardsIndex.REWARD_MACROS)
      ? ItemsRewardsIndex.REWARD_MACROS
      : null;
    const catalogMacros = (typeof EditorActionCatalog !== 'undefined' && EditorActionCatalog && EditorActionCatalog.ACTION_MACROS)
      ? EditorActionCatalog.ACTION_MACROS
      : (typeof Editor !== 'undefined' && Editor && typeof Editor.getActionMacros === 'function'
        ? Editor.getActionMacros()
        : null);
    const macroList = rewardMacros || catalogMacros || [];
    const isMacroOnly = macroList.some((m) => m && m.id === actionId) && !inRegistry;
    if (isMacroOnly) {
      push(issue({
        type: 'macro_id_in_json',
        severity: SEVERITY.ERROR,
        message: 'Macro id «' + actionId + '» не должен попадать в runtime JSON — разверните в шаги реестра',
        entityType: ctx.entityType,
        entityId: ctx.entityId,
        path: ctx.path,
        tab: ctx.tab,
        sceneId: ctx.sceneId,
        fixHint: 'Используйте Give Item / Loot Chest preset — они пишут add_item / add_gold / …'
      }));
    }

    // Combat authoring (start_combat)
    if (actionId === 'start_combat') {
      const combatCheck = (typeof CombatAuthoringIndex !== 'undefined' && CombatAuthoringIndex && CombatAuthoringIndex.validateCombatParams)
        ? CombatAuthoringIndex.validateCombatParams(params, data)
        : null;
      if (combatCheck && combatCheck.issues) {
        combatCheck.issues.forEach((iss) => {
          // missing_enemy / missing_scene already emitted via extract* — skip duplicates
          if (iss.type === 'missing_enemy' || iss.type === 'missing_scene') return;
          push(issue({
            type: iss.type || 'invalid_combat_params',
            severity: iss.severity === 'error' ? SEVERITY.ERROR : SEVERITY.WARNING,
            message: iss.message || 'Invalid combat params',
            entityType: ctx.entityType,
            entityId: ctx.entityId,
            path: ctx.path,
            tab: ctx.tab,
            sceneId: ctx.sceneId,
            fixHint: 'Выберите enemies и опционально nextScene (победа)'
          }));
        });
      } else {
        const enemyIds = Array.isArray(params.enemies)
          ? params.enemies
          : (params.enemies ? String(params.enemies).split(/[,;\s]+/) : []);
        if (!enemyIds.filter(Boolean).length) {
          push(issue({
            type: 'invalid_combat_params',
            severity: SEVERITY.WARNING,
            message: 'start_combat: не выбраны враги',
            entityType: ctx.entityType,
            entityId: ctx.entityId,
            path: ctx.path + '.params.enemies',
            tab: ctx.tab,
            sceneId: ctx.sceneId
          }));
        }
        if (params.lossScene || params.defeatScene || params.loseScene) {
          push(issue({
            type: 'invalid_combat_params',
            severity: SEVERITY.WARNING,
            message: 'Поражение не задаётся параметром start_combat (runtime игнорирует)',
            entityType: ctx.entityType,
            entityId: ctx.entityId,
            path: ctx.path,
            tab: ctx.tab,
            sceneId: ctx.sceneId
          }));
        }
      }
    }
  }

  function validateConditionAt(showIf, ctx, data, opts, push) {
    const result = validateConditionRules(showIf, opts);
    (result.errors || []).forEach((err) => {
      push(issue({
        type: 'malformed_condition',
        severity: SEVERITY.ERROR,
        message: typeof err === 'string' ? err : (err.message || 'Некорректное условие'),
        entityType: ctx.entityType,
        entityId: ctx.entityId,
        path: ctx.path,
        tab: ctx.tab,
        sceneId: ctx.sceneId,
        fixHint: 'Используйте { all: [...] } или { any: [...] }'
      }));
    });
    (result.warnings || []).forEach((w) => {
      const msg = typeof w === 'string' ? w : (w.message || 'Предупреждение условия');
      const isUnknown = /Unknown condition|unknown|Unrecognized|Catalog-only/i.test(msg);
      const isLegacy = /Legacy flat|Bare rule array/i.test(msg);
      push(issue({
        type: isUnknown ? 'unknown_condition' : (isLegacy ? 'legacy_condition' : 'condition_warning'),
        severity: SEVERITY.WARNING,
        message: msg,
        entityType: ctx.entityType,
        entityId: ctx.entityId,
        path: ctx.path,
        tab: ctx.tab,
        sceneId: ctx.sceneId,
        fixHint: isLegacy ? 'Предпочтительно { all: [...] }' : null
      }));
    });

    // Entity refs inside rules
    const rules = result.rules || [];
    rules.forEach((rule, i) => {
      if (!rule || typeof rule !== 'object') return;
      if (rule.hasItem && !data.items?.[rule.hasItem]) {
        push(issue({
          type: 'missing_item',
          severity: SEVERITY.ERROR,
          message: 'Условие ссылается на отсутствующий предмет «' + rule.hasItem + '»',
          entityType: 'item',
          entityId: String(rule.hasItem),
          path: ctx.path + '.rule[' + i + '].hasItem',
          tab: ctx.tab,
          sceneId: ctx.sceneId
        }));
      }
      if (rule.notHasItem && !data.items?.[rule.notHasItem]) {
        push(issue({
          type: 'missing_item',
          severity: SEVERITY.WARNING,
          message: 'Условие notHasItem: предмет «' + rule.notHasItem + '» отсутствует',
          entityType: 'item',
          entityId: String(rule.notHasItem),
          path: ctx.path + '.rule[' + i + '].notHasItem',
          tab: ctx.tab,
          sceneId: ctx.sceneId
        }));
      }
      if (rule.notItem && !data.items?.[rule.notItem]) {
        push(issue({
          type: 'missing_item',
          severity: SEVERITY.WARNING,
          message: 'Условие notItem: предмет «' + rule.notItem + '» отсутствует',
          entityType: 'item',
          entityId: String(rule.notItem),
          path: ctx.path + '.rule[' + i + '].notItem',
          tab: ctx.tab,
          sceneId: ctx.sceneId
        }));
      }
      const qRef = rule.questMinStage || rule.questMaxStage || rule.questStage;
      if (qRef && typeof qRef === 'object' && qRef.questId) {
        if (!data.quests?.[qRef.questId]) {
          push(issue({
            type: 'missing_quest',
            severity: SEVERITY.ERROR,
            message: 'Условие ссылается на отсутствующий квест «' + qRef.questId + '»',
            entityType: 'quest',
            entityId: String(qRef.questId),
            path: ctx.path + '.rule[' + i + ']',
            tab: ctx.tab,
            sceneId: ctx.sceneId
          }));
        } else if (qRef.stage != null) {
          const stages = data.quests[qRef.questId].stages || [];
          const st = Number(qRef.stage);
          if (Number.isFinite(st) && (st < 0 || st >= stages.length)) {
            push(issue({
              type: 'invalid_quest_stage',
              severity: SEVERITY.WARNING,
              message: 'Условие: этап ' + st + ' вне диапазона квеста «' + qRef.questId + '»',
              entityType: 'quest',
              entityId: String(qRef.questId),
              path: ctx.path + '.rule[' + i + ']',
              tab: ctx.tab,
              sceneId: ctx.sceneId
            }));
          }
        }
      }
      if (rule.sceneVisited && !data.scenes?.[rule.sceneVisited]) {
        push(issue({
          type: 'missing_scene',
          severity: SEVERITY.WARNING,
          message: 'Условие sceneVisited: сцена «' + rule.sceneVisited + '» не найдена',
          entityType: 'scene',
          entityId: String(rule.sceneVisited),
          path: ctx.path + '.rule[' + i + '].sceneVisited',
          tab: ctx.tab,
          sceneId: ctx.sceneId
        }));
      }
    });
  }

  function validateAssets(data, push) {
    const assets = data.assets || {};
    Object.entries(assets).forEach(([ref, asset]) => {
      if (!asset || typeof asset !== 'object') {
        push(issue({
          type: 'empty_asset',
          severity: SEVERITY.ERROR,
          message: 'Asset «' + ref + '»: пустая или некорректная запись',
          entityType: 'asset',
          entityId: ref,
          path: 'assets.' + ref,
          tab: 'media'
        }));
        return;
      }
      if (!asset.src && !asset.ref) {
        push(issue({
          type: 'missing_asset_src',
          severity: SEVERITY.WARNING,
          message: 'Asset «' + ref + '»: не указан src',
          entityType: 'asset',
          entityId: ref,
          path: 'assets.' + ref + '.src',
          tab: 'media',
          fixHint: 'Укажите относительный путь к файлу'
        }));
      }
      // Physical file presence cannot be verified reliably in browser → WARNING only if src looks empty-ish
      if (asset.src != null && String(asset.src).trim() === '') {
        push(issue({
          type: 'missing_asset_src',
          severity: SEVERITY.WARNING,
          message: 'Asset «' + ref + '»: пустой src',
          entityType: 'asset',
          entityId: ref,
          path: 'assets.' + ref + '.src',
          tab: 'media'
        }));
      }
    });

    // References from visual/UI nodes
    Object.entries(data.scenes || {}).forEach(([sceneId, scene]) => {
      const bg = scene?.visual?.background?.asset;
      if (bg) {
        if (bg.ref && !assets[bg.ref] && !bg.src) {
          push(issue({
            type: 'missing_asset_ref',
            severity: SEVERITY.WARNING,
            message: 'Сцена «' + sceneId + '»: фон ссылается на отсутствующий asset «' + bg.ref + '»',
            entityType: 'scene',
            entityId: sceneId,
            path: 'scenes.' + sceneId + '.visual.background.asset.ref',
            tab: 'scenes',
            sceneId
          }));
        }
        if (!bg.ref && !bg.src) {
          push(issue({
            type: 'empty_asset',
            severity: SEVERITY.WARNING,
            message: 'Сцена «' + sceneId + '»: фон без ref/src',
            entityType: 'scene',
            entityId: sceneId,
            path: 'scenes.' + sceneId + '.visual.background.asset',
            tab: 'scenes',
            sceneId
          }));
        }
      }
      (scene?.visual?.nodes || []).forEach((node) => {
        const a = node?.asset;
        if (!a) return;
        if (a.ref && !assets[a.ref] && !a.src) {
          push(issue({
            type: 'missing_asset_ref',
            severity: SEVERITY.WARNING,
            message: 'Узел «' + (node.id || '?') + '»: asset «' + a.ref + '» не в каталоге',
            entityType: 'scene',
            entityId: sceneId,
            path: 'scenes.' + sceneId + '.visual.nodes.' + (node.id || '?') + '.asset',
            tab: 'scenes',
            sceneId
          }));
        }
      });
    });
  }

  function validateStructure(data, push) {
    const scenes = data.scenes || {};
    const keys = Object.keys(scenes);
    if (!keys.length) {
      push(issue({
        type: 'no_scenes',
        severity: SEVERITY.ERROR,
        message: 'В проекте нет сцен',
        entityType: 'project',
        entityId: null,
        path: 'scenes',
        tab: 'scenes'
      }));
      return;
    }

    // Duplicate IDs
    const idToKeys = {};
    keys.forEach((key) => {
      const declared = String(scenes[key]?.id || key).trim();
      if (!idToKeys[declared]) idToKeys[declared] = [];
      idToKeys[declared].push(key);
    });
    Object.entries(idToKeys).forEach(([declaredId, list]) => {
      if (list.length > 1) {
        push(issue({
          type: 'duplicate_id',
          severity: SEVERITY.ERROR,
          message: 'Дублирующийся ID сцены «' + declaredId + '» (' + list.join(', ') + ')',
          entityType: 'scene',
          entityId: declaredId,
          path: 'scenes',
          tab: 'scenes',
          sceneId: list[0]
        }));
      }
    });

    // Classic broken transitions
    const sceneIds = new Set(keys);
    keys.forEach((sceneId) => {
      const scene = scenes[sceneId];
      collectClassicSceneLinks(sceneId, scene, (field, targetId, ctx) => {
        if (isReservedSceneTarget(targetId)) return;
        if (sceneIds.has(targetId)) return;
        push(issue({
          type: 'broken_transition',
          severity: SEVERITY.ERROR,
          message: 'Сцена «' + sceneId + '»: переход ' + field + ' → «' + targetId + '» не существует',
          entityType: 'scene',
          entityId: sceneId,
          path: 'scenes.' + sceneId + (ctx.choiceIndex != null ? '.choices[' + ctx.choiceIndex + '].' + field : '.' + field),
          tab: 'scenes',
          sceneId,
          targetId: targetId,
          fixHint: 'Исправьте id или создайте целевую сцену'
        }));
      });

      // Empty scenes
      const hasText = !!(scene?.text && String(scene.text).trim());
      const hasChoices = Array.isArray(scene?.choices) && scene.choices.length > 0;
      const hasVisual = !!(scene?.visual?.nodes && scene.visual.nodes.length);
      const hasComponents = Array.isArray(scene?.components) && scene.components.length > 0;
      const hasNext = !!(scene?.nextScene);
      if (!hasText && !hasChoices && !hasVisual && !hasComponents && !hasNext && !scene?.special) {
        push(issue({
          type: 'empty_scene',
          severity: SEVERITY.WARNING,
          message: 'Сцена «' + sceneId + '» пустая (нет текста, выборов, visual, компонентов)',
          entityType: 'scene',
          entityId: sceneId,
          path: 'scenes.' + sceneId,
          tab: 'scenes',
          sceneId
        }));
      }
    });

    if (data.startScene && !sceneIds.has(String(data.startScene))) {
      push(issue({
        type: 'missing_scene',
        severity: SEVERITY.ERROR,
        message: 'startScene «' + data.startScene + '» не существует',
        entityType: 'scene',
        entityId: String(data.startScene),
        path: 'startScene',
        tab: 'scenes',
        targetId: String(data.startScene)
      }));
    }

    if (data.meta?.startScene && !sceneIds.has(String(data.meta.startScene))) {
      push(issue({
        type: 'missing_scene',
        severity: SEVERITY.WARNING,
        message: 'meta.startScene «' + data.meta.startScene + '» не существует',
        entityType: 'scene',
        entityId: String(data.meta.startScene),
        path: 'meta.startScene',
        tab: 'scenes',
        targetId: String(data.meta.startScene)
      }));
    }

    // Reachability / orphans
    const reachable = buildReachableSet(data);
    const start = getStartSceneId(data);
    keys.forEach((sid) => {
      if (sid === start) return;
      if (reachable.has(sid)) return;
      // Check if anything points here (orphan vs unreachable from start)
      let incoming = false;
      keys.forEach((from) => {
        if (from === sid) return;
        collectClassicSceneLinks(from, scenes[from], (_f, tid) => {
          if (tid === sid) incoming = true;
        });
      });
      if (!incoming) {
        push(issue({
          type: 'orphan_scene',
          severity: SEVERITY.WARNING,
          message: 'Сцена «' + sid + '»: нет входящих переходов (orphan)',
          entityType: 'scene',
          entityId: sid,
          path: 'scenes.' + sid,
          tab: 'scenes',
          sceneId: sid,
          fixHint: 'Добавьте переход или удалите сцену вручную'
        }));
      } else {
        push(issue({
          type: 'unreachable_scene',
          severity: SEVERITY.WARNING,
          message: 'Сцена «' + sid + '» недостижима из startScene',
          entityType: 'scene',
          entityId: sid,
          path: 'scenes.' + sid,
          tab: 'scenes',
          sceneId: sid
        }));
      }
    });
  }

  /**
   * Main entry — pure function over project data.
   * Does not mutate `data`.
   */
  function validateProject(data, options) {
    const opts = options || {};
    const errors = [];
    const warnings = [];
    const info = [];
    const all = [];

    function push(iss) {
      all.push(iss);
      if (iss.severity === SEVERITY.ERROR) errors.push(iss);
      else if (iss.severity === SEVERITY.INFO) info.push(iss);
      else warnings.push(iss);
    }

    if (!data || typeof data !== 'object') {
      push(issue({
        type: 'no_data',
        severity: SEVERITY.ERROR,
        message: 'Нет данных проекта',
        entityType: 'project',
        path: ''
      }));
      return finalize(errors, warnings, info, all);
    }

    // Snapshot fingerprint to help tests prove no mutation
    const fingerprintBefore = opts._fingerprint
      ? JSON.stringify(data)
      : null;

    validateStructure(data, push);
    validateAssets(data, push);

    // Walk actions + conditions
    const visit = function visitStep(step, ctx) {
      validateActionStep(step, ctx, data, opts, push);
    };
    visit._condition = function (showIf, ctx) {
      validateConditionAt(showIf, ctx, data, opts, push);
    };
    visit._sceneRef = function (sceneId, ctx) {
      if (!sceneId || isReservedSceneTarget(String(sceneId))) return;
      if (!data.scenes?.[String(sceneId)]) {
        push(issue({
          type: 'missing_scene',
          severity: SEVERITY.ERROR,
          message: 'Ссылка на отсутствующую сцену «' + sceneId + '»',
          entityType: 'scene',
          entityId: String(sceneId),
          path: ctx.path,
          tab: ctx.tab,
          sceneId: ctx.sceneId,
          targetId: String(sceneId)
        }));
      }
    };

    walkActionSteps(data, visit);

    // NPC dialogueSceneId
    Object.entries(data.npcs || {}).forEach(([npcId, npc]) => {
      if (npc?.dialogueSceneId && !data.scenes?.[npc.dialogueSceneId]) {
        push(issue({
          type: 'missing_scene',
          severity: SEVERITY.ERROR,
          message: 'NPC «' + npcId + '»: dialogueSceneId «' + npc.dialogueSceneId + '» не найден',
          entityType: 'npc',
          entityId: npcId,
          path: 'npcs.' + npcId + '.dialogueSceneId',
          tab: 'npcs',
          targetId: npc.dialogueSceneId
        }));
      }
    });

    if (fingerprintBefore != null && JSON.stringify(data) !== fingerprintBefore) {
      push(issue({
        type: 'validator_mutated_data',
        severity: SEVERITY.ERROR,
        message: 'Внутренняя ошибка: валидатор изменил данные проекта',
        entityType: 'project',
        path: ''
      }));
    }

    return finalize(errors, warnings, info, all);
  }

  function finalize(errors, warnings, info, all) {
    return {
      valid: errors.length === 0,
      ok: errors.length === 0,
      errors: errors,
      warnings: warnings,
      info: info,
      issues: all,
      summary: {
        errors: errors.length,
        warnings: warnings.length,
        info: info.length,
        total: all.length
      }
    };
  }

  const api = {
    validateProject: validateProject,
    SEVERITY: SEVERITY,
    /** @deprecated alias */
    validate: validateProject
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectValidator = api;
  }

  // Editor bridge (optional — only when Editor exists)
  if (typeof Editor !== 'undefined') {
    Editor.validateProjectIntegrity = function validateProjectIntegrity(data) {
      return validateProject(data || this.data || {}, {
        actionRegistry: typeof ACTION_REGISTRY !== 'undefined' ? ACTION_REGISTRY : null,
        actionCatalog: typeof EditorActionCatalog !== 'undefined' ? EditorActionCatalog : null,
        conditionCatalog: typeof EditorConditionCatalog !== 'undefined' ? EditorConditionCatalog : null
      });
    };

    /**
     * Phase 1.11 canonical API — structured integrity report.
     * Keeps legacy validateProjectExtended for IDE panel; this returns
     * { valid, errors, warnings, info, summary }.
     */
    const prevValidateProject = typeof Editor.validateProject === 'function'
      ? Editor.validateProject.bind(Editor)
      : null;

    Editor.validateProject = function validateProjectPhase111(data) {
      const payload = data != null ? data : this.data;
      const report = validateProject(payload || {}, {
        actionRegistry: typeof ACTION_REGISTRY !== 'undefined' ? ACTION_REGISTRY : null,
        actionCatalog: typeof EditorActionCatalog !== 'undefined' ? EditorActionCatalog : null,
        conditionCatalog: typeof EditorConditionCatalog !== 'undefined' ? EditorConditionCatalog : null,
        _fingerprint: true
      });
      this._lastIntegrityReport = report;
      // Compatibility: if callers expect legacy { ok, issues } from extended validator
      if (arguments.length === 0 && prevValidateProject && typeof this.validateProjectExtended === 'function') {
        // Prefer integrity report as primary; merge extended issues as extras (dedupe by message+path)
        try {
          const ext = this.validateProjectExtended();
          const seen = new Set(report.issues.map((i) => i.type + '|' + i.path + '|' + i.message));
          (ext?.issues || []).forEach((iss) => {
            const key = (iss.type || '') + '|' + (iss.sceneId || '') + '|' + (iss.message || '');
            if (seen.has(key)) return;
            seen.add(key);
            const mapped = {
              type: iss.type || 'legacy',
              severity: iss.severity === 'warning' ? 'warning' : (iss.severity === 'info' ? 'info' : 'error'),
              message: iss.message || '',
              entityType: iss.tab === 'quests' ? 'quest' : (iss.tab === 'npcs' ? 'npc' : 'scene'),
              entityId: iss.questId || iss.npcId || iss.sceneId || null,
              path: iss.sceneId ? 'scenes.' + iss.sceneId : (iss.questId ? 'quests.' + iss.questId : ''),
              fixHint: null,
              tab: iss.tab || null,
              sceneId: iss.sceneId || null,
              targetId: iss.targetId || null
            };
            report.issues.push(mapped);
            if (mapped.severity === 'error') report.errors.push(mapped);
            else if (mapped.severity === 'info') report.info.push(mapped);
            else report.warnings.push(mapped);
          });
          report.summary = {
            errors: report.errors.length,
            warnings: report.warnings.length,
            info: report.info.length,
            total: report.issues.length
          };
          report.valid = report.errors.length === 0;
          report.ok = report.valid;
        } catch (e) {
          console.warn('[ProjectValidator] merge extended', e);
        }
      }
      return report;
    };

    Editor.showProjectIntegrityPanel = function showProjectIntegrityPanel(report) {
      report = report || this.validateProject();
      let modal = document.getElementById('editor-project-integrity-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'editor-project-integrity-modal';
        modal.className = 'editor-modal';
        document.body.appendChild(modal);
      }
      const esc = (s) => (typeof this.escapeHtml === 'function' ? this.escapeHtml(String(s ?? '')) : String(s ?? ''));
      const row = (iss, icon) =>
        '<li class="pv-issue pv-issue--' + esc(iss.severity) + '">' +
        '<div class="pv-issue-icon">' + icon + '</div>' +
        '<div class="pv-issue-body">' +
        '<div class="pv-issue-object">' + esc(iss.entityType || 'project') +
        (iss.entityId ? ' «' + esc(iss.entityId) + '»' : '') + '</div>' +
        (iss.path ? '<div class="pv-issue-path">' + esc(iss.path) + '</div>' : '') +
        '<div class="pv-issue-msg">' + esc(iss.message) + '</div>' +
        (iss.fixHint ? '<div class="pv-issue-path">Подсказка: ' + esc(iss.fixHint) + '</div>' : '') +
        '</div></li>';

      const list =
        (report.errors || []).map((i) => row(i, '🔴')).join('') +
        (report.warnings || []).map((i) => row(i, '🟡')).join('') +
        (report.info || []).map((i) => row(i, '🔵')).join('') ||
        '<li class="pv-issue pv-issue--ok"><div class="pv-issue-body">✓ Проблем не найдено</div></li>';

      modal.innerHTML =
        '<div class="editor-modal-backdrop" data-pi-close="1"></div>' +
        '<div class="editor-modal-panel editor-modal-panel--wide" style="max-width:640px;">' +
        '<div class="quest-detail-head"><h2>Проверить проект</h2>' +
        '<button type="button" class="btn-remove" data-pi-close="1">×</button></div>' +
        '<p class="hint">Ошибки: ' + report.summary.errors +
        ' · Предупреждения: ' + report.summary.warnings +
        ' · Info: ' + report.summary.info + '</p>' +
        '<ul class="pv-issue-list">' + list + '</ul>' +
        '<div class="pv-footer">' +
        '<button type="button" class="btn btn-secondary" data-pi-close="1">Закрыть</button>' +
        '<button type="button" class="btn btn-primary" data-pi-recheck="1">Проверить снова</button>' +
        '</div></div>';
      modal.classList.remove('hidden');
      modal.onclick = (e) => {
        if (e.target.closest('[data-pi-close]')) modal.classList.add('hidden');
        if (e.target.closest('[data-pi-recheck]')) Editor.showProjectIntegrityPanel(Editor.validateProject());
      };
    };

    const prevRun = typeof Editor.runProjectValidation === 'function'
      ? Editor.runProjectValidation.bind(Editor)
      : null;

    Editor.runProjectValidation = function runProjectValidationPhase111() {
      if (typeof this.collectProjectIssues === 'function' &&
          typeof this.showProjectValidationResults === 'function') {
        const result = this.collectProjectIssues();
        this.showProjectValidationResults(result);
        if (typeof this.refreshValidationUI === 'function') {
          try { this.refreshValidationUI(); } catch (e) { /* */ }
        }
        if (result.ok) {
          this.toast?.success?.('Проект в порядке');
        } else {
          this.toast?.warning?.(
            'Ошибок: ' + result.errors.length +
            (result.warnings.length ? ', предупреждений: ' + result.warnings.length : '')
          );
        }
        return result;
      }

      const report = this.validateProject();
      if (typeof this.showProjectIntegrityPanel === 'function') {
        this.showProjectIntegrityPanel(report);
      }
      if (typeof this.refreshValidationUI === 'function') {
        try { this.refreshValidationUI(); } catch (e) { /* */ }
      }
      if (report.valid) {
        this.toast?.success?.('Проект в порядке');
      } else {
        this.toast?.warning?.(
          'Ошибок: ' + report.summary.errors +
          (report.summary.warnings ? ', предупреждений: ' + report.summary.warnings : '')
        );
      }
      if (prevRun && typeof this.collectProjectIssues !== 'function') {
        try { prevRun(); } catch (e) { /* */ }
      }
      return report;
    };

    if (Editor.commands?.register) {
      Editor.commands.register({
        id: 'project.validate.integrity',
        title: 'Проверить проект (целостность)',
        category: 'Проект',
        keywords: ['validate', 'integrity', 'ошибки', 'проверка'],
        action() { Editor.runProjectValidation(); }
      });
    }

    if (Editor.hooks?.register) {
      Editor.hooks.register('editor-project-validator', {
        validateProject: Editor.validateProject,
        validateProjectIntegrity: Editor.validateProjectIntegrity,
        runProjectValidation: Editor.runProjectValidation
      }, { force: true });
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global);
