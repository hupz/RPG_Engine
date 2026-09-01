/**
 * Editor Scene Assistant — draftScene(описание) → план с трассировкой к каталогам.
 * Провайдер по умолчанию: офлайн-заглушка по ключевым словам. Слот для внешнего API — без сети и ключей.
 */
(function attachEditorAssistant() {
  'use strict';

  if (typeof Editor === 'undefined') {
    console.warn('editor-assistant.js: Editor не определён');
    return;
  }

  const SOURCE = Object.freeze({
    TEMPLATE: 'template-pack',
    ACTION: 'action-catalog',
    CONDITION: 'condition-catalog',
    SCENE: 'scene'
  });

  const CONFIDENCE = Object.freeze({ HIGH: 'high', LOW: 'low' });

  /** @typedef {{ source: string, id: string, label?: string, confidence: string, needsReview?: boolean, params?: object, values?: object, sceneId?: string, choiceText?: string, placement?: string }} PlanItem */

  const TEMPLATE_RULES = [
    { id: 'tpl_combat', label: 'Бой', patterns: [/бой/i, /сражен/i, /битв/i, /сразиться/i, /волк/i], wizard: { sceneType: 'combat', displayMode: 'text' } },
    { id: 'tpl_dialogue', label: 'Диалог', patterns: [/диалог/i, /разговор/i, /бесед/i, /бармен/i, /npc/i], wizard: { sceneType: 'dialog', displayMode: 'text' } },
    { id: 'tpl_fork', label: 'Развилка', patterns: [/развилк/i, /выбор пути/i, /куда (идти|пойти)/i, /или.*(лес|деревн|город)/i], wizard: { sceneType: 'custom', displayMode: 'text' } },
    { id: 'tpl_shop', label: 'Магазин', patterns: [/магазин/i, /купить/i, /торгов/i, /продав/i, /зель/i], wizard: { sceneType: 'shop', displayMode: 'text' } },
    { id: 'tpl_quest_accept', label: 'Получение квеста', patterns: [/квест/i, /задани/i, /поручен/i, /старейшин/i, /пропаж/i], wizard: { sceneType: 'quest', displayMode: 'text' } },
    { id: 'tpl_tavern', label: 'Таверна', patterns: [/таверн/i, /трактир/i], wizard: { sceneType: 'custom', displayMode: 'text' } },
    { id: 'tpl_explore', label: 'Исследование', patterns: [/исследован/i, /осмотр/i, /локаци/i], wizard: { sceneType: 'custom', displayMode: 'text' } },
    { id: 'tpl_reward', label: 'Награда', patterns: [/наград/i, /сокровищ/i], wizard: { sceneType: 'reward', displayMode: 'text' } },
    { id: 'tpl_dungeon', label: 'Подземелье', patterns: [/подземел/i, /пещер/i], wizard: { sceneType: 'custom', displayMode: 'text' } }
  ];

  const LINK_HINTS = [
    { pattern: /деревн/i, hint: 'деревн' },
    { pattern: /лес/i, hint: 'лес' },
    { pattern: /таверн/i, hint: 'таверн' },
    { pattern: /город/i, hint: 'город' },
    { pattern: /замок/i, hint: 'замок' }
  ];

  function esc(s) {
    return typeof Editor.escapeHtml === 'function' ? Editor.escapeHtml(String(s ?? '')) : String(s ?? '');
  }

  function getTemplateCatalog() {
    const list = typeof Editor.listSceneTemplatePack === 'function'
      ? Editor.listSceneTemplatePack()
      : [];
    const map = new Map(list.map((t) => [t.id, t]));
    TEMPLATE_RULES.forEach((r) => {
      if (!map.has(r.id)) map.set(r.id, { id: r.id, title: r.label });
    });
    return map;
  }

  function getWriterActionIds() {
    const list = typeof Editor.getWriterActions === 'function'
      ? Editor.getWriterActions()
      : (typeof Editor.getActionCatalog === 'function' ? Editor.getActionCatalog({ writerOnly: true }) : []);
    return new Set((list || []).map((a) => a.id));
  }

  function getWriterConditionIds() {
    const list = typeof Editor.getWriterConditions === 'function'
      ? Editor.getWriterConditions()
      : (typeof EditorConditionCatalog !== 'undefined' ? EditorConditionCatalog.getWriterConditions() : []);
    return new Set((list || []).map((c) => c.id));
  }

  function extractSceneName(description) {
    const raw = String(description || '').trim();
    if (!raw) return 'Новая сцена';
    const colon = raw.split(/[:—–-]/)[0].trim();
    if (colon.length >= 3 && colon.length <= 48) return colon;
    const first = raw.split(/[.!?\n]/)[0].trim();
    return first.slice(0, 48) || 'Новая сцена';
  }

  function scoreTemplate(text) {
    let best = null;
    let bestScore = 0;
    for (const rule of TEMPLATE_RULES) {
      let score = 0;
      for (const p of rule.patterns) {
        if (p.test(text)) score += 2;
      }
      if (score > bestScore) {
        bestScore = score;
        best = rule;
      }
    }
    return bestScore > 0 ? { rule: best, score: bestScore } : null;
  }

  function findSceneRef(hint, scenes) {
    const h = String(hint || '').toLowerCase();
    if (!h) return { sceneId: null, confidence: CONFIDENCE.LOW, needsReview: true };
    let match = null;
    for (const [id, sc] of Object.entries(scenes || {})) {
      const hay = `${id} ${sc.location || ''} ${sc.title || ''}`.toLowerCase();
      if (hay.includes(h)) {
        match = id;
        break;
      }
    }
    if (match) {
      return { sceneId: match, confidence: CONFIDENCE.HIGH, needsReview: false };
    }
    return { sceneId: null, confidence: CONFIDENCE.LOW, needsReview: true };
  }

  function findItemRef(text, items) {
    const ids = Object.keys(items || {});
    for (const id of ids) {
      const name = (items[id].name || id).toLowerCase();
      if (text.toLowerCase().includes(name) || text.toLowerCase().includes(id.toLowerCase())) {
        return { itemId: id, confidence: CONFIDENCE.HIGH, needsReview: false };
      }
    }
    if (/зель/i.test(text) && ids.length) {
      const potion = ids.find((id) => /potion|зель/i.test(id + (items[id].name || '')));
      if (potion) return { itemId: potion, confidence: CONFIDENCE.LOW, needsReview: true };
    }
    return { itemId: null, confidence: CONFIDENCE.LOW, needsReview: true };
  }

  function buildAssistantContext() {
    const data = Editor.data || {};
    return {
      data,
      scenes: data.scenes || {},
      items: data.items || {},
      quests: data.quests || {},
      templates: getTemplateCatalog(),
      writerActions: getWriterActionIds(),
      writerConditions: getWriterConditionIds()
    };
  }

  /**
   * Офлайн-провайдер: ключевые слова → план с трассировкой.
   * @param {string} description
   * @param {object} ctx
   */
  function stubDraft(description, ctx) {
    const text = String(description || '').trim();
    const sceneName = extractSceneName(text);
    const tplHit = scoreTemplate(text);
    const blocks = [];
    const actions = [];
    const conditions = [];
    const links = [];
    const warnings = [];

    let template = null;
    let wizardIntent = { sceneType: 'custom', displayMode: 'text' };

    if (tplHit && ctx.templates.has(tplHit.rule.id)) {
      template = {
        source: SOURCE.TEMPLATE,
        id: tplHit.rule.id,
        label: tplHit.rule.label,
        confidence: tplHit.score >= 4 ? CONFIDENCE.HIGH : CONFIDENCE.LOW,
        needsReview: tplHit.score < 4
      };
      wizardIntent = { ...tplHit.rule.wizard };
      blocks.push({ ...template, type: 'template' });
    } else if (tplHit) {
      warnings.push('Шаблон «' + tplHit.rule.id + '» не найден в каталоге');
    }

    if (/диалог|разговор|бармен|сказать|реплик/i.test(text)) {
      const sayText = text.length > 120 ? text.slice(0, 117) + '…' : text;
      actions.push({
        source: SOURCE.ACTION,
        id: 'say',
        label: 'Реплика NPC',
        placement: 'events.enter',
        params: { text: sayText },
        confidence: CONFIDENCE.HIGH,
        needsReview: false
      });
    }

    if (/боя|бой|бои|битв|сражен|волк/i.test(text) && ctx.writerActions.has('start_combat')) {
      actions.push({
        source: SOURCE.ACTION,
        id: 'start_combat',
        label: 'Начать бой',
        placement: 'events.enter',
        params: {},
        confidence: CONFIDENCE.LOW,
        needsReview: true
      });
    }

    if (/магазин|купить/i.test(text) && ctx.writerActions.has('open_panel')) {
      actions.push({
        source: SOURCE.ACTION,
        id: 'open_panel',
        label: 'Открыть панель',
        placement: 'events.enter',
        params: { panel: 'shop' },
        confidence: CONFIDENCE.HIGH,
        needsReview: false
      });
    }

    if (/(если|когда).*(есть|имеет)/i.test(text) && ctx.writerConditions.has('hasItem')) {
      const itemRef = findItemRef(text, ctx.items);
      conditions.push({
        source: SOURCE.CONDITION,
        id: 'hasItem',
        label: 'У игрока есть предмет',
        values: itemRef.itemId ? { hasItem: itemRef.itemId } : {},
        confidence: itemRef.confidence,
        needsReview: itemRef.needsReview || !itemRef.itemId
      });
    }

    for (const hint of LINK_HINTS) {
      if (!hint.pattern.test(text)) continue;
      const ref = findSceneRef(hint.hint, ctx.scenes);
      if (ref.sceneId || ref.needsReview) {
        links.push({
          source: SOURCE.SCENE,
          sceneId: ref.sceneId,
          choiceText: 'Перейти: ' + hint.hint,
          ref: ref.sceneId ? 'scene:' + ref.sceneId : null,
          confidence: ref.confidence,
          needsReview: ref.needsReview
        });
      }
    }

    if (/развилк|или/i.test(text) && links.length < 2) {
      const forest = findSceneRef('лес', ctx.scenes);
      const village = findSceneRef('деревн', ctx.scenes);
      [forest, village].forEach((ref, i) => {
        const labels = ['В лес', 'В деревню'];
        if (ref.sceneId || text.match(/лес|деревн/i)) {
          links.push({
            source: SOURCE.SCENE,
            sceneId: ref.sceneId,
            choiceText: labels[i],
            ref: ref.sceneId ? 'scene:' + ref.sceneId : null,
            confidence: ref.confidence,
            needsReview: ref.needsReview
          });
        }
      });
    }

    const needsReviewCount = [template, ...actions, ...conditions, ...links]
      .filter(Boolean)
      .filter((x) => x.needsReview).length;

    return {
      ok: true,
      description: text,
      providerId: 'stub-keywords',
      sceneName,
      wizardIntent,
      template,
      blocks,
      actions,
      conditions,
      links,
      warnings,
      needsReviewCount
    };
  }

  function validatePlanTraceability(plan, ctx) {
    const errors = [];
    if (!plan || !plan.ok) return ['plan invalid'];

    if (plan.template && !plan.template.needsReview) {
      if (!ctx.templates.has(plan.template.id)) errors.push('template:' + plan.template.id);
    }

    (plan.actions || []).forEach((a) => {
      if (!a.needsReview && !ctx.writerActions.has(a.id)) errors.push('action:' + a.id);
    });

    (plan.conditions || []).forEach((c) => {
      if (!c.needsReview && !ctx.writerConditions.has(c.id)) errors.push('condition:' + c.id);
    });

    (plan.links || []).forEach((l) => {
      if (!l.needsReview && l.sceneId && !ctx.scenes[l.sceneId]) errors.push('scene:' + l.sceneId);
    });

    return errors;
  }

  function buildActionParams(actionId, params) {
    if (typeof Editor.buildActionParamsObject === 'function') {
      return Editor.buildActionParamsObject(actionId, params || {});
    }
    return params || {};
  }

  function applyConfidentItemsToScene(scene, plan) {
    const applied = { actions: 0, conditions: 0, links: 0, skipped: 0 };

    (plan.actions || []).forEach((a) => {
      if (a.needsReview) { applied.skipped++; return; }
      if (!Editor.getWriterActions || !getWriterActionIds().has(a.id)) { applied.skipped++; return; }
      if (!scene.events) scene.events = {};
      if (!scene.events.enter) scene.events.enter = [];
      scene.events.enter.push({
        action: a.id,
        params: buildActionParams(a.id, a.params)
      });
      applied.actions++;
    });

    const condRules = [];
    (plan.conditions || []).forEach((c) => {
      if (c.needsReview) { applied.skipped++; return; }
      if (typeof Editor.buildConditionRule !== 'function') { applied.skipped++; return; }
      const rule = Editor.buildConditionRule(c.id, c.values || {});
      if (rule) condRules.push(rule);
      applied.conditions++;
    });
    if (condRules.length && typeof Editor.rulesToShowIf === 'function') {
      scene.showIf = Editor.rulesToShowIf(condRules, 'all');
    }

    (plan.links || []).forEach((l) => {
      if (l.needsReview || !l.sceneId) { applied.skipped++; return; }
      if (!scene.choices) scene.choices = [];
      scene.choices.push({
        text: l.choiceText || ('→ ' + l.sceneId),
        to: l.sceneId,
        icon: '➡️'
      });
      if (Array.isArray(scene.editorModules) && !scene.editorModules.includes('choices')) {
        scene.editorModules.push('choices');
      }
      applied.links++;
    });

    return applied;
  }

  function formatDraftDiff(plan) {
    if (!plan || !plan.ok) return '<p class="hint">Черновик не сформирован</p>';
    const lines = [];
    lines.push('<div class="scene-assistant-diff">');
    lines.push('<p><strong>Сцена:</strong> ' + esc(plan.sceneName) + '</p>');
    if (plan.template) {
      const tag = plan.template.needsReview ? ' <span class="scene-assistant-review">требует проверки</span>' : '';
      lines.push('<p><strong>Шаблон:</strong> <code>' + esc(plan.template.id) + '</code> — ' + esc(plan.template.label || '') + tag + '</p>');
    }
    if (plan.blocks?.length) {
      lines.push('<p><strong>Блоки:</strong></p><ul>');
      plan.blocks.forEach((b) => {
        lines.push('<li><code>' + esc(b.source) + ':' + esc(b.id) + '</code>' + (b.needsReview ? ' ⚠' : '') + '</li>');
      });
      lines.push('</ul>');
    }
    if (plan.actions?.length) {
      lines.push('<p><strong>Действия (enter):</strong></p><ul>');
      plan.actions.forEach((a) => {
        lines.push('<li><code>' + esc(a.source) + ':' + esc(a.id) + '</code>' + (a.needsReview ? ' — <em>требует проверки</em>' : '') + '</li>');
      });
      lines.push('</ul>');
    }
    if (plan.conditions?.length) {
      lines.push('<p><strong>Условия:</strong></p><ul>');
      plan.conditions.forEach((c) => {
        lines.push('<li><code>' + esc(c.source) + ':' + esc(c.id) + '</code>' + (c.needsReview ? ' — <em>требует проверки</em>' : '') + '</li>');
      });
      lines.push('</ul>');
    }
    if (plan.links?.length) {
      lines.push('<p><strong>Связи:</strong></p><ul>');
      plan.links.forEach((l) => {
        const dest = l.sceneId ? esc(l.sceneId) : '—';
        lines.push('<li>«' + esc(l.choiceText) + '» → ' + dest + (l.needsReview ? ' — <em>требует проверки</em>' : '') + '</li>');
      });
      lines.push('</ul>');
    }
    if (plan.warnings?.length) {
      lines.push('<p class="hint">' + plan.warnings.map(esc).join('; ') + '</p>');
    }
    lines.push('</div>');
    return lines.join('\n');
  }

  const providers = new Map();
  let activeProviderId = 'stub-keywords';

  providers.set('stub-keywords', {
    id: 'stub-keywords',
    label: 'Подбор по ключевым словам (офлайн)',
    draft: stubDraft
  });

  const assistant = {
    SOURCE,
    CONFIDENCE,

    registerProvider(provider) {
      if (!provider?.id || typeof provider.draft !== 'function') return false;
      providers.set(provider.id, provider);
      return true;
    },

    setProvider(id) {
      if (!providers.has(id)) return false;
      activeProviderId = id;
      return true;
    },

    getProvider() {
      return providers.get(activeProviderId) || providers.get('stub-keywords');
    },

    listProviders() {
      return [...providers.values()].map((p) => ({ id: p.id, label: p.label }));
    },

    /**
     * @param {string} description
     * @returns {object} plan
     */
    draftScene(description) {
      const ctx = buildAssistantContext();
      const provider = this.getProvider();
      const plan = provider.draft(String(description || '').trim(), ctx);
      plan.providerId = provider.id;
      const errors = validatePlanTraceability(plan, ctx);
      if (errors.length) {
        plan.ok = false;
        plan.errors = errors;
      }
      return plan;
    },

    validatePlan(plan) {
      return validatePlanTraceability(plan, buildAssistantContext());
    },

    formatDraftDiff,

    /**
     * Применяет план: createSceneWithWizard / template pack + уверенные элементы.
     * @param {object} plan
     */
    applyDraft(plan) {
      if (!plan?.ok) {
        Editor.toast?.warning?.('Черновик невалиден — применение отменено');
        return { ok: false };
      }
      if (!Editor.data) Editor.data = {};
      if (!Editor.data.scenes) Editor.data.scenes = {};

      const focusBefore = typeof EditorHistory !== 'undefined' && EditorHistory.getFocusState
        ? EditorHistory.getFocusState('scene')
        : null;

      let sceneId = null;
      const usedTemplate = plan.template && !plan.template.needsReview && plan.template.id;

      if (usedTemplate && typeof Editor.applySceneTemplatePack === 'function') {
        sceneId = Editor.applySceneTemplatePack(plan.template.id);
        if (sceneId && typeof EditorHistory !== 'undefined' && EditorHistory.recordSceneCreate) {
          EditorHistory.recordSceneCreate(sceneId, focusBefore);
        }
        const sc = Editor.data.scenes[sceneId];
        if (sc && !sc.location) sc.location = plan.sceneName;
      } else if (typeof Editor.createSceneWithWizard === 'function') {
        sceneId = Editor.createSceneWithWizard(plan.sceneName, plan.wizardIntent || { sceneType: 'custom', displayMode: 'text' });
      }

      if (!sceneId || !Editor.data.scenes[sceneId]) {
        Editor.toast?.error?.('Не удалось создать сцену');
        return { ok: false };
      }

      const scene = Editor.data.scenes[sceneId];
      const applied = applyConfidentItemsToScene(scene, plan);

      if (typeof SceneAuthoringIndex !== 'undefined' && SceneAuthoringIndex.validateSceneShape) {
        if (!SceneAuthoringIndex.validateSceneShape(scene)) {
          Editor.toast?.error?.('Сцена не прошла проверку формы');
          return { ok: false, sceneId };
        }
      }

      if (typeof Editor.validateConditionRules === 'function' && scene.showIf) {
        const cv = Editor.validateConditionRules(scene.showIf);
        if (!cv.ok) {
          delete scene.showIf;
          applied.skipped++;
          Editor.toast?.warning?.('Условие не прошло валидацию — не применено');
        }
      }

      Editor.markDirty?.();
      Editor.renderSceneList?.();
      Editor.switchTab?.('scenes');
      Editor.renderSceneEditor?.();
      Editor.updateJSONPreview?.();
      Editor.toast?.success?.('Сцена «' + (scene.location || sceneId) + '» создана из описания');

      return {
        ok: true,
        sceneId,
        applied,
        skippedReview: (plan.needsReviewCount || 0) + applied.skipped
      };
    },

    /** @private тесты */
    _stubDraft: stubDraft,
    _validatePlanTraceability: validatePlanTraceability,
    _applyConfidentItemsToScene: applyConfidentItemsToScene,
    _buildAssistantContext: buildAssistantContext
  };

  Editor.assistant = assistant;
})();
