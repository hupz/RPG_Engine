// ============================================================
// Inspector Redesign (UI-8) — contextual sections, progressive disclosure
// Reuses Action/Condition catalogs; no schema/runtime changes.
// ============================================================
(function attachInspectorRedesign() {
  'use strict';

  if (typeof Editor === 'undefined') return;

  const SECTION_ORDER = Object.freeze([
    { id: 'properties', label: 'Свойства' },
    { id: 'content', label: 'Контент' },
    { id: 'appearance', label: 'Внешний вид' },
    { id: 'interaction', label: 'Взаимодействие' },
    { id: 'conditions', label: 'Условия' },
    { id: 'advanced', label: 'Advanced' }
  ]);

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

  function isWriter() {
    return typeof Editor.isWriterMode === 'function' && Editor.isWriterMode();
  }

  function isAdvanced() {
    if (typeof Editor.isEditorAdvancedMode === 'function' && Editor.isEditorAdvancedMode()) return true;
    return typeof Editor.isAdvancedMode === 'function' && Editor.isAdvancedMode();
  }

  function sectionKey(prefix, id) {
    return 'insp8-' + prefix + '-' + id;
  }

  function getSectionExpanded(key, defaultOpen) {
    if (!Editor.workspace?.ui?.inspectorSections) return defaultOpen !== false;
    if (Object.prototype.hasOwnProperty.call(Editor.workspace.ui.inspectorSections, key)) {
      return !!Editor.workspace.ui.inspectorSections[key];
    }
    return defaultOpen !== false;
  }

  function setSectionExpanded(key, open) {
    if (!Editor.workspace) Editor.workspace = { open: [], activeId: null };
    if (!Editor.workspace.ui) Editor.workspace.ui = { inspectorSections: {} };
    if (!Editor.workspace.ui.inspectorSections) Editor.workspace.ui.inspectorSections = {};
    Editor.workspace.ui.inspectorSections[key] = !!open;
  }

  /** Collapsible <details> section (string HTML). */
  function sectionHtml(prefix, sectionId, title, bodyHtml, defaultOpen) {
    const key = sectionKey(prefix, sectionId);
    const open = getSectionExpanded(key, defaultOpen);
    if (sectionId === 'advanced' && isWriter()) return '';
    return (
      '<details class="insp-section insp8-section" data-insp8-section="' + escAttr(sectionId) + '"' +
      ' data-insp-section-key="' + escAttr(key) + '"' +
      (open ? ' open' : '') + '>' +
      '<summary class="insp-section__title">' + esc(title) + '</summary>' +
      '<div class="insp-section__body">' + bodyHtml + '</div></details>'
    );
  }

  function bindSectionPersistence(root) {
    if (!root || root.dataset.insp8Bound) return;
    root.dataset.insp8Bound = '1';
    root.addEventListener('toggle', (ev) => {
      const det = ev.target.closest?.('details.insp8-section');
      if (!det || !root.contains(det)) return;
      const key = det.dataset.inspSectionKey;
      if (key) setSectionExpanded(key, det.open);
    }, true);
  }

  /** Position / Size fields — normalized 0..1 preserved in JSON. */
  function buildTransformHtml(opts) {
    opts = opts || {};
    const t = opts.transform || { x: 0, y: 0, w: 0.1, h: 0.1, z: 0 };
    const nodeId = opts.nodeId || '';
    const fieldAttr = opts.fieldAttr || 'data-field';
    const nodeAttr = opts.nodeAttr || 'data-node';
    const prefix = opts.fieldPrefix || '';
    const writer = opts.writerOnly != null ? opts.writerOnly : isWriter();
    const adv = isAdvanced();

    let html = '<div class="insp8-transform">';
    html += '<p class="insp8-subhead">Позиция</p><div class="form-group form-row insp8-transform-row">';
    ['x', 'y'].forEach((f) => {
      const lab = f === 'x' ? 'X' : 'Y';
      html += '<label class="insp8-field">' + lab +
        ' <input type="number" step="0.01" ' + fieldAttr + '="' + escAttr(prefix + f) + '" ' +
        nodeAttr + '="' + escAttr(nodeId) + '" value="' + escAttr(t[f]) + '"></label>';
    });
    html += '</div>';
    html += '<p class="insp8-subhead">Размер</p><div class="form-group form-row insp8-transform-row">';
    html += '<label class="insp8-field">Ширина <input type="number" step="0.01" ' +
      fieldAttr + '="' + escAttr(prefix + 'w') + '" ' + nodeAttr + '="' + escAttr(nodeId) + '" value="' + escAttr(t.w) + '"></label>';
    html += '<label class="insp8-field">Высота <input type="number" step="0.01" ' +
      fieldAttr + '="' + escAttr(prefix + 'h') + '" ' + nodeAttr + '="' + escAttr(nodeId) + '" value="' + escAttr(t.h) + '"></label>';
    html += '</div>';
    if (!writer || adv) {
      html += '<div class="form-group form-row insp8-transform-row">';
      html += '<label class="insp8-field">Z <input type="number" ' +
        fieldAttr + '="' + escAttr(prefix + 'z') + '" ' + nodeAttr + '="' + escAttr(nodeId) + '" value="' + escAttr(t.z) + '"></label>';
      html += '</div>';
      if (adv) {
        html += '<p class="hint insp8-norm-hint">Нормализованные координаты (0…1 относительно холста)</p>';
      }
    }
    html += '</div>';
    return html;
  }

  function buildConditionsEditorHtml(opts) {
    opts = opts || {};
    const nodeId = opts.nodeId || '';
    const showIf = opts.showIf;
    const nodeAttr = opts.nodeAttr || 'data-node';
    const fieldAttr = opts.fieldAttr || 'data-field';
    const removeAction = opts.removeAction || 'condRemove';
    const addAction = opts.addAction || 'condAdd';
    const modeField = opts.modeField || 'condMode';

    const condRules = typeof Editor.extractConditionRules === 'function'
      ? Editor.extractConditionRules(showIf) : [];
    const condMode = typeof Editor.getConditionMode === 'function'
      ? Editor.getConditionMode(showIf) : 'all';
    const summary = typeof Editor.formatConditionsSummary === 'function'
      ? Editor.formatConditionsSummary(showIf, Editor.data) : { empty: true, lines: [] };

    let html = '';
    if (summary.empty) {
      html += '<p class="hint insp8-empty">Всегда видим</p>';
    } else {
      html += '<p class="hint insp8-cond-mode">' + esc(summary.modeLabel || 'Все условия') + ':</p>';
      html += '<ul class="insp8-summary-list">';
      summary.lines.forEach((line) => {
        html += '<li>' + esc(line) + '</li>';
      });
      html += '</ul>';
    }

    const modeSelect = typeof Editor.buildConditionModeSelectHtml === 'function'
      ? Editor.buildConditionModeSelectHtml(condMode).replace(
        'data-field="condMode"',
        fieldAttr + '="' + modeField + '" ' + nodeAttr + '="' + escAttr(nodeId) + '"'
      )
      : '<select ' + fieldAttr + '="' + modeField + '" ' + nodeAttr + '="' + escAttr(nodeId) + '">' +
        '<option value="all"' + (condMode === 'all' ? ' selected' : '') + '>Все условия</option>' +
        '<option value="any"' + (condMode === 'any' ? ' selected' : '') + '>Хотя бы одно</option></select>';

    html += '<div class="form-group"><label>Режим</label>' + modeSelect + '</div>';

    condRules.forEach((rule, idx) => {
      const cid = typeof Editor.ruleToCatalogId === 'function' ? Editor.ruleToCatalogId(rule) : '';
      const vals = typeof Editor.conditionValuesFromRule === 'function'
        ? Editor.conditionValuesFromRule(rule) : {};
      const sel = typeof Editor.buildConditionSelectHtml === 'function'
        ? Editor.buildConditionSelectHtml(cid) : '';
      const params = typeof Editor.buildConditionParamFieldsHtml === 'function'
        ? Editor.buildConditionParamFieldsHtml(cid, vals, { nodeId: nodeId, data: Editor.data, index: idx })
        : '';
      html += '<div class="insp8-cond-step visual-cond-step ui-cond-step">' +
        '<div class="form-group"><label>Условие ' + (idx + 1) + '</label>' +
        '<select ' + fieldAttr + '="condType" ' + nodeAttr + '="' + escAttr(nodeId) + '" data-cond-index="' + idx + '">' +
        sel + '</select></div>' + params +
        '<button type="button" class="btn btn-danger btn-sm" data-action="' + escAttr(removeAction) + '" data-id="' +
        escAttr(nodeId) + '" data-index="' + idx + '">Удалить</button></div>';
    });

    html += '<button type="button" class="btn btn-secondary btn-sm insp8-add-btn" data-action="' +
      escAttr(addAction) + '" data-id="' + escAttr(nodeId) + '">+ Добавить условие</button>';
    return html;
  }

  function buildInteractionEditorHtml(opts) {
    opts = opts || {};
    const nodeId = opts.nodeId || '';
    const clickSteps = opts.clickSteps || [];
    const nodeAttr = opts.nodeAttr || 'data-node';
    const fieldAttr = opts.fieldAttr || 'data-field';
    const stepClass = opts.stepClass || 'visual-click-step';
    const removeAction = opts.removeAction || 'clickRemove';
    const addAction = opts.addAction || 'clickAdd';
    const upAction = opts.upAction || 'clickUp';
    const downAction = opts.downAction || 'clickDown';
    const actionField = opts.actionField || 'actionType';
    const clickActionField = opts.clickActionField || null;

    let html = '';
    if (!clickSteps.length) {
      html += '<p class="hint insp8-empty">Пока нет взаимодействия</p>';
    } else {
      html += '<ul class="insp8-summary-list insp8-action-summary">';
      clickSteps.forEach((step, idx) => {
        const act = step && step.action ? step.action : '';
        const label = typeof Editor.formatActionStepSummary === 'function'
          ? Editor.formatActionStepSummary(act, (step && step.params) || {}, Editor.data)
          : (typeof Editor.getActionLabel === 'function' ? Editor.getActionLabel(act) : act);
        html += '<li><span class="insp8-step-num">Шаг ' + (idx + 1) + '</span> ' + esc(label) + '</li>';
      });
      html += '</ul>';
    }

    clickSteps.forEach((step, idx) => {
      const act = step && step.action ? step.action : '';
      const params = (step && step.params) || {};
      const actionOpts = typeof Editor.buildActionSelectHtml === 'function'
        ? Editor.buildActionSelectHtml(act) : '';
      const paramControl = typeof Editor.buildActionParamFieldsHtml === 'function'
        ? Editor.buildActionParamFieldsHtml(act, params, { nodeId: nodeId, data: Editor.data, index: idx })
        : '';
      const selectField = clickActionField || actionField;
      html += '<div class="' + escAttr(stepClass) + '" data-click-index="' + idx + '">' +
        '<div class="form-group"><label>Шаг ' + (idx + 1) + '</label>' +
        '<select ' + fieldAttr + '="' + escAttr(selectField) + '" ' + nodeAttr + '="' + escAttr(nodeId) + '" data-click-index="' + idx + '">' +
        actionOpts + '</select></div>' + paramControl +
        '<div class="btn-row">' +
        '<button type="button" class="btn btn-secondary btn-sm" data-action="' + escAttr(upAction) + '" data-id="' +
        escAttr(nodeId) + '" data-index="' + idx + '">↑</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-action="' + escAttr(downAction) + '" data-id="' +
        escAttr(nodeId) + '" data-index="' + idx + '">↓</button>' +
        '<button type="button" class="btn btn-danger btn-sm" data-action="' + escAttr(removeAction) + '" data-id="' +
        escAttr(nodeId) + '" data-index="' + idx + '">Удалить</button></div></div>';
    });

    html += '<button type="button" class="btn btn-secondary btn-sm insp8-add-btn" data-action="' +
      escAttr(addAction) + '" data-id="' + escAttr(nodeId) + '">+ Добавить действие</button>';

    let macroOpts = '<option value="">Готовое действие…</option>';
    if (typeof Editor.getActionMacros === 'function') {
      Editor.getActionMacros().forEach((m) => {
        macroOpts += '<option value="' + escAttr(m.id) + '">' + esc(m.label) + '</option>';
      });
    }
    html += '<div class="form-group"><label>Готовое действие</label>' +
      '<select ' + fieldAttr + '="clickMacro" ' + nodeAttr + '="' + escAttr(nodeId) + '">' + macroOpts + '</select></div>';
    if (opts.clearAction) {
      html += '<button type="button" class="btn btn-ghost btn-sm" data-action="' + escAttr(opts.clearAction) +
        '" data-id="' + escAttr(nodeId) + '">Убрать все действия</button>';
    }
    return html;
  }

  function visualConditionMode(showIf) {
    if (typeof Editor.getConditionMode === 'function') return Editor.getConditionMode(showIf);
    if (showIf && Array.isArray(showIf.any)) return 'any';
    return 'all';
  }

  /** Inline visual node inspector with standard sections. */
  function buildVisualNodeInspectorHtml(selected) {
    if (!selected) return '<p class="hint">Выберите элемент</p>';
    const t = selected.transform || { x: 0, y: 0, w: 0.1, h: 0.1, z: 0 };
    const nid = selected.id;
    const prefix = 'visual';

    const propsBody =
      '<div class="form-group"><label>Имя</label>' +
      '<input type="text" data-field="label" data-node="' + escAttr(nid) + '" value="' +
      escAttr(selected.props?.label || '') + '"></div>' +
      '<div class="form-group">' +
      '<label><input type="checkbox" data-field="visible" data-node="' + escAttr(nid) + '"' +
      (selected.visible !== false ? ' checked' : '') + '> Видимый</label> ' +
      '<label><input type="checkbox" data-field="enabled" data-node="' + escAttr(nid) + '"' +
      (selected.enabled !== false ? ' checked' : '') + '> Активный</label></div>';

    let contentBody = '<p class="hint insp8-empty">Нет текстового контента</p>';
    if (selected.kind === 'text' || selected.kind === 'button') {
      contentBody = '<div class="form-group"><label>Текст</label><textarea data-field="text" data-node="' +
        escAttr(nid) + '" rows="3">' + esc(selected.props?.text || '') + '</textarea></div>';
    }

    let appearBody = buildTransformHtml({ transform: t, nodeId: nid, fieldAttr: 'data-field', nodeAttr: 'data-node' });
    if (selected.kind === 'image') {
      appearBody = '<div class="form-group"><label>Изображение</label> ' +
        '<button type="button" class="btn btn-secondary btn-sm" data-action="pickAsset" data-target="' +
        escAttr(nid) + '">Выбрать…</button></div>' + appearBody;
    }

    const clickSteps = Array.isArray(selected.events?.click) ? selected.events.click : [];
    const interactionBody = buildInteractionEditorHtml({
      nodeId: nid,
      clickSteps: clickSteps,
      clearAction: 'clearClick'
    });

    const conditionsBody = buildConditionsEditorHtml({
      nodeId: nid,
      showIf: selected.showIf
    });

    let advancedBody = '';
    if (isAdvanced()) {
      advancedBody = '<p class="hint">ID: <code>' + esc(nid) + '</code></p>' +
        '<p class="hint">Тип: <code>' + esc(selected.kind || 'hotspot') + '</code></p>';
      try {
        advancedBody += '<pre class="insp8-raw-json">' + esc(JSON.stringify(selected, null, 2)) + '</pre>';
      } catch (e) { /* */ }
    }

    return '<div class="visual-inspector insp8-inspector" data-insp8-prefix="' + prefix + '">' +
      sectionHtml(prefix, 'properties', 'Свойства', propsBody, true) +
      sectionHtml(prefix, 'content', 'Контент', contentBody, selected.kind === 'text' || selected.kind === 'button') +
      sectionHtml(prefix, 'appearance', 'Внешний вид', appearBody, true) +
      sectionHtml(prefix, 'interaction', 'Взаимодействие', interactionBody, clickSteps.length > 0) +
      sectionHtml(prefix, 'conditions', 'Условия', conditionsBody, !!selected.showIf) +
      sectionHtml(prefix, 'advanced', 'Advanced', advancedBody, false) +
      '</div>';
  }

  /** Inline Game UI node inspector with standard sections. */
  function buildGameUiNodeInspectorHtml(node) {
    if (!node) return '';
    const t = node.transform || { x: 0, y: 0, w: 0.2, h: 0.1, z: 0 };
    const nid = node.id;
    const prefix = 'ui';

    const displayName = node.props?.label || node.text || (typeof Editor.getActionLabel === 'function' ? '' : '');
    const propsBody =
      '<div class="form-group"><label>Имя</label>' +
      '<input type="text" data-ui-node="' + escAttr(nid) + '" data-ui-field="label" value="' +
      escAttr(node.props?.label || node.text || '') + '"></div>';

    let contentBody = '<p class="hint insp8-empty">Нет контента</p>';
    if (node.text != null || node.props?.text) {
      contentBody = '<div class="form-group"><label>Текст</label>' +
        '<input type="text" data-ui-node="' + escAttr(nid) + '" data-ui-field="text" value="' +
        escAttr(node.text || node.props?.text || '') + '"></div>';
    }
    if (node.binding) {
      contentBody += '<div class="form-group"><label>Привязка</label>' +
        '<select data-ui-node="' + escAttr(nid) + '" data-ui-field="binding"><option value="">—</option>';
      const binds = (typeof UIRuntime !== 'undefined' && UIRuntime.BINDINGS)
        ? UIRuntime.BINDINGS : ['player.hp', 'player.gold', 'player.level', 'player.name'];
      binds.forEach((b) => {
        contentBody += '<option value="' + escAttr(b) + '"' + (node.binding === b ? ' selected' : '') + '>' +
          esc(isWriter() ? b.replace('player.', '') : b) + '</option>';
      });
      contentBody += '</select></div>';
    } else if (!isWriter()) {
      contentBody += '<div class="form-group"><label>Привязка</label>' +
        '<select data-ui-node="' + escAttr(nid) + '" data-ui-field="binding"><option value="">—</option>';
      const binds = (typeof UIRuntime !== 'undefined' && UIRuntime.BINDINGS)
        ? UIRuntime.BINDINGS : ['player.hp', 'player.gold'];
      binds.forEach((b) => {
        contentBody += '<option value="' + escAttr(b) + '"' + (node.binding === b ? ' selected' : '') + '>' + esc(b) + '</option>';
      });
      contentBody += '</select></div>';
    }

    let appearBody = buildTransformHtml({
      transform: t,
      nodeId: nid,
      fieldAttr: 'data-ui-field',
      nodeAttr: 'data-ui-node',
      fieldPrefix: 'transform.'
    });
    if (!isWriter() || isAdvanced()) {
      appearBody += '<div class="form-group"><label>Asset</label>' +
        '<input type="text" data-ui-node="' + escAttr(nid) + '" data-ui-field="assetSrc" value="' +
        escAttr((node.asset && (node.asset.src || node.asset.ref)) || '') + '"/></div>';
    }
    appearBody += '<button type="button" class="btn btn-secondary btn-sm" data-ui-action="pickAsset" data-id="' +
      escAttr(nid) + '">Выбрать asset…</button>';

    const clickSteps = Array.isArray(node.events?.click) ? node.events.click : [];
    const interactionBody = buildInteractionEditorHtml({
      nodeId: nid,
      clickSteps: clickSteps,
      nodeAttr: 'data-ui-node',
      fieldAttr: 'data-ui-field',
      stepClass: 'ui-click-step',
      removeAction: 'clickRemove',
      addAction: 'clickAdd',
      upAction: 'clickUp',
      downAction: 'clickDown',
      clickActionField: 'clickActionAt'
    });

    const conditionsBody = buildConditionsEditorHtml({
      nodeId: nid,
      showIf: node.showIf,
      nodeAttr: 'data-ui-node',
      fieldAttr: 'data-ui-field',
      removeAction: 'condRemove',
      addAction: 'condAdd'
    });

    let advancedBody = '';
    if (isAdvanced()) {
      advancedBody = '<p class="hint">ID: <code>' + esc(nid) + '</code></p>' +
        '<p class="hint">Тип: <code>' + esc(node.kind || node.type || 'panel') + '</code></p>';
      try {
        advancedBody += '<pre class="insp8-raw-json">' + esc(JSON.stringify(node, null, 2)) + '</pre>';
      } catch (e) { /* */ }
    }

    const title = displayName || (isAdvanced() ? nid : 'Элемент');
    return '<div class="ui-inspector insp8-inspector" data-insp8-prefix="' + prefix + '">' +
      '<h4 class="insp8-node-title">' + esc(title) + '</h4>' +
      sectionHtml(prefix, 'properties', 'Свойства', propsBody, true) +
      sectionHtml(prefix, 'content', 'Контент', contentBody, !!(node.text || node.binding)) +
      sectionHtml(prefix, 'appearance', 'Внешний вид', appearBody, true) +
      sectionHtml(prefix, 'interaction', 'Взаимодействие', interactionBody, clickSteps.length > 0) +
      sectionHtml(prefix, 'conditions', 'Условия', conditionsBody, !!node.showIf) +
      sectionHtml(prefix, 'advanced', 'Advanced', advancedBody, false) +
      '</div>';
  }

  /** DOM fragment for right-panel contextual inspector (visual_node). */
  function renderContextVisualNodeInspector(node, nodeId) {
    const frag = document.createDocumentFragment();
    const prefix = 'ctx-visual';
    const t = node.transform || { x: 0, y: 0, w: 0.1, h: 0.1, z: 0 };

    const propsFrag = document.createDocumentFragment();
    propsFrag.appendChild(ctxFieldRow('Имя', ctxTextInput(node.props?.label || node.props?.text || '', (v) => {
      Editor.visualUpdateNodeField?.(nodeId, 'label', v);
    })));
    frag.appendChild(ctxSection(prefix, 'properties', 'Свойства', propsFrag, true));

    const appearFrag = document.createDocumentFragment();
    const posFrag = document.createDocumentFragment();
    posFrag.appendChild(ctxFieldRow('X', ctxNumInput(t.x, (v) => Editor.visualUpdateNodeField?.(nodeId, 'x', v))));
    posFrag.appendChild(ctxFieldRow('Y', ctxNumInput(t.y, (v) => Editor.visualUpdateNodeField?.(nodeId, 'y', v))));
    appearFrag.appendChild(ctxSubhead('Позиция'));
    appearFrag.appendChild(posFrag);
    const sizeFrag = document.createDocumentFragment();
    sizeFrag.appendChild(ctxFieldRow('Ширина', ctxNumInput(t.w, (v) => Editor.visualUpdateNodeField?.(nodeId, 'w', v))));
    sizeFrag.appendChild(ctxFieldRow('Высота', ctxNumInput(t.h, (v) => Editor.visualUpdateNodeField?.(nodeId, 'h', v))));
    appearFrag.appendChild(ctxSubhead('Размер'));
    appearFrag.appendChild(sizeFrag);
    if (!isWriter() || isAdvanced()) {
      appearFrag.appendChild(ctxFieldRow('Z', ctxNumInput(t.z, (v) => Editor.visualUpdateNodeField?.(nodeId, 'z', v))));
      if (isAdvanced()) {
        const hint = document.createElement('p');
        hint.className = 'hint';
        hint.textContent = 'Нормализованные координаты (0…1)';
        appearFrag.appendChild(hint);
      }
    }
    frag.appendChild(ctxSection(prefix, 'appearance', 'Внешний вид', appearFrag, true));

    const interactFrag = document.createDocumentFragment();
    interactFrag.appendChild(ctxActionSummary(node.events?.click));
    if (!node.events?.click?.length) {
      const empty = document.createElement('p');
      empty.className = 'hint insp8-empty';
      empty.textContent = 'Пока нет взаимодействия';
      interactFrag.appendChild(empty);
    }
    frag.appendChild(ctxSection(prefix, 'interaction', 'Взаимодействие', interactFrag, false));

    const condFrag = document.createDocumentFragment();
    condFrag.appendChild(ctxConditionSummary(node.showIf));
    frag.appendChild(ctxSection(prefix, 'conditions', 'Условия', condFrag, false));

    if (isAdvanced()) {
      const advFrag = document.createDocumentFragment();
      const idP = document.createElement('p');
      idP.className = 'hint';
      idP.innerHTML = 'ID: <code>' + esc(nodeId) + '</code>';
      advFrag.appendChild(idP);
      advFrag.appendChild(ctxFieldRow('Тип', node.kind || 'hotspot'));
      frag.appendChild(ctxSection(prefix, 'advanced', 'Advanced', advFrag, false));
    }
    return frag;
  }

  function renderContextUiNodeInspector(node, nodeId) {
    const frag = document.createDocumentFragment();
    const prefix = 'ctx-ui';
    const t = node.transform || { x: 0, y: 0, w: 0.2, h: 0.1, z: 0 };

    const propsFrag = document.createDocumentFragment();
    propsFrag.appendChild(ctxFieldRow('Имя', ctxTextInput(node.props?.label || node.text || '', (v) => {
      Editor.uiUpdateNodeField?.(nodeId, 'label', v);
    })));
    frag.appendChild(ctxSection(prefix, 'properties', 'Свойства', propsFrag, true));

    const contentFrag = document.createDocumentFragment();
    if (node.text || node.props?.text) {
      contentFrag.appendChild(ctxFieldRow('Текст', node.text || node.props?.text));
    } else {
      const p = document.createElement('p');
      p.className = 'hint insp8-empty';
      p.textContent = 'Нет контента';
      contentFrag.appendChild(p);
    }
    frag.appendChild(ctxSection(prefix, 'content', 'Контент', contentFrag, false));

    const appearFrag = document.createDocumentFragment();
    appearFrag.appendChild(ctxSubhead('Позиция'));
    const posFrag = document.createDocumentFragment();
    ['x', 'y'].forEach((f) => {
      posFrag.appendChild(ctxFieldRow(f.toUpperCase(), ctxNumInput(t[f], (v) => {
        Editor.uiUpdateNodeField?.(nodeId, 'transform.' + f, v);
      })));
    });
    appearFrag.appendChild(posFrag);
    appearFrag.appendChild(ctxSubhead('Размер'));
    const sizeFrag = document.createDocumentFragment();
    ['w', 'h'].forEach((f) => {
      const lab = f === 'w' ? 'Ширина' : 'Высота';
      sizeFrag.appendChild(ctxFieldRow(lab, ctxNumInput(t[f], (v) => {
        Editor.uiUpdateNodeField?.(nodeId, 'transform.' + f, v);
      })));
    });
    appearFrag.appendChild(sizeFrag);
    if (!isWriter() || isAdvanced()) {
      appearFrag.appendChild(ctxFieldRow('Z', ctxNumInput(t.z, (v) => {
        Editor.uiUpdateNodeField?.(nodeId, 'transform.z', v);
      })));
    }
    frag.appendChild(ctxSection(prefix, 'appearance', 'Внешний вид', appearFrag, true));

    const interactFrag = document.createDocumentFragment();
    interactFrag.appendChild(ctxActionSummary(node.events?.click));
    frag.appendChild(ctxSection(prefix, 'interaction', 'Взаимодействие', interactFrag, false));

    const condFrag = document.createDocumentFragment();
    condFrag.appendChild(ctxConditionSummary(node.showIf));
    frag.appendChild(ctxSection(prefix, 'conditions', 'Условия', condFrag, false));

    if (isAdvanced()) {
      const advFrag = document.createDocumentFragment();
      const idP = document.createElement('p');
      idP.className = 'hint';
      idP.innerHTML = 'ID: <code>' + esc(nodeId) + '</code>';
      advFrag.appendChild(idP);
      frag.appendChild(ctxSection(prefix, 'advanced', 'Advanced', advFrag, false));
    }
    return frag;
  }

  function ctxSection(prefix, id, title, bodyFrag, defaultOpen) {
    const key = sectionKey(prefix, id);
    const det = document.createElement('details');
    det.className = 'insp-section insp8-section';
    det.dataset.insp8Section = id;
    det.dataset.inspSectionKey = key;
    det.open = getSectionExpanded(key, defaultOpen);
    if (id === 'advanced' && isWriter()) return document.createDocumentFragment();
    const sum = document.createElement('summary');
    sum.className = 'insp-section__title';
    sum.textContent = title;
    det.appendChild(sum);
    const body = document.createElement('div');
    body.className = 'insp-section__body';
    if (bodyFrag) body.appendChild(bodyFrag);
    det.appendChild(body);
    det.addEventListener('toggle', () => setSectionExpanded(key, det.open));
    return det;
  }

  function ctxFieldRow(label, control) {
    const wrap = document.createElement('div');
    wrap.className = 'insp-field';
    const lab = document.createElement('label');
    lab.className = 'insp-field__label';
    lab.textContent = label;
    wrap.appendChild(lab);
    const val = document.createElement('div');
    val.className = 'insp-field__control';
    if (control && control.nodeType === 1) val.appendChild(control);
    else if (control != null) val.textContent = String(control);
    wrap.appendChild(val);
    return wrap;
  }

  function ctxSubhead(text) {
    const p = document.createElement('p');
    p.className = 'insp8-subhead';
    p.textContent = text;
    return p;
  }

  function ctxTextInput(val, onChange) {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'form-control';
    inp.value = val || '';
    inp.addEventListener('change', () => onChange(inp.value));
    return inp;
  }

  function ctxNumInput(val, onChange) {
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.className = 'form-control';
    inp.step = '0.01';
    inp.value = val != null ? String(val) : '';
    inp.addEventListener('change', () => onChange(parseFloat(inp.value)));
    return inp;
  }

  function ctxActionSummary(steps) {
    const frag = document.createDocumentFragment();
    const list = Array.isArray(steps) ? steps : [];
    if (!list.length) return frag;
    const ul = document.createElement('ul');
    ul.className = 'insp8-summary-list';
    list.forEach((step, idx) => {
      const li = document.createElement('li');
      const act = step && step.action ? step.action : '';
      const label = typeof Editor.formatActionStepSummary === 'function'
        ? Editor.formatActionStepSummary(act, (step && step.params) || {}, Editor.data)
        : (typeof Editor.getActionLabel === 'function' ? Editor.getActionLabel(act) : act);
      li.textContent = 'Шаг ' + (idx + 1) + ': ' + label;
      ul.appendChild(li);
    });
    frag.appendChild(ul);
    return frag;
  }

  function ctxConditionSummary(showIf) {
    const frag = document.createDocumentFragment();
    const summary = typeof Editor.formatConditionsSummary === 'function'
      ? Editor.formatConditionsSummary(showIf, Editor.data)
      : { empty: true, lines: [] };
    if (summary.empty) {
      const p = document.createElement('p');
      p.className = 'hint insp8-empty';
      p.textContent = 'Всегда видим';
      frag.appendChild(p);
      return frag;
    }
    const mode = document.createElement('p');
    mode.className = 'hint';
    mode.textContent = (summary.modeLabel || 'Все условия') + ':';
    frag.appendChild(mode);
    const ul = document.createElement('ul');
    ul.className = 'insp8-summary-list';
    summary.lines.forEach((line) => {
      const li = document.createElement('li');
      li.textContent = line;
      ul.appendChild(li);
    });
    frag.appendChild(ul);
    return frag;
  }

  function renderContextChoiceInspector(choice, idx) {
    const frag = document.createDocumentFragment();
    const prefix = 'ctx-choice';

    const textFrag = document.createDocumentFragment();
    textFrag.appendChild(ctxFieldRow('Текст', ctxTextInput(choice.text || '', (v) => {
      Editor.updateChoice?.(idx, 'text', v);
    })));
    if (isAdvanced() && choice.to) textFrag.appendChild(ctxFieldRow('Переход', choice.to));
    frag.appendChild(ctxSection(prefix, 'content', 'Контент', textFrag, true));

    const interactFrag = document.createDocumentFragment();
    if (choice.action) {
      const p = document.createElement('p');
      p.textContent = typeof Editor.getActionLabel === 'function'
        ? Editor.getActionLabel(choice.action) : choice.action;
      interactFrag.appendChild(p);
    } else if (choice.to) {
      const p = document.createElement('p');
      p.className = 'hint';
      p.textContent = '→ ' + choice.to;
      interactFrag.appendChild(p);
    } else {
      const p = document.createElement('p');
      p.className = 'hint insp8-empty';
      p.textContent = 'Пока нет взаимодействия';
      interactFrag.appendChild(p);
    }
    frag.appendChild(ctxSection(prefix, 'interaction', 'Взаимодействие', interactFrag, false));

    const condFrag = document.createDocumentFragment();
    const condP = document.createElement('div');
    condFrag.appendChild(ctxConditionSummary(choice.showIf || choice.hideIf ? choice : null));
    if (!choice.showIf && !choice.hideIf) {
      condFrag.appendChild(condP);
    }
    frag.appendChild(ctxSection(prefix, 'conditions', 'Условия', condFrag, false));

    return frag;
  }

  const InspectorUI = {
    SECTION_ORDER,
    isWriter,
    isAdvanced,
    sectionKey,
    getSectionExpanded,
    setSectionExpanded,
    sectionHtml,
    bindSectionPersistence,
    buildTransformHtml,
    buildConditionsEditorHtml,
    buildInteractionEditorHtml,
    buildVisualNodeInspectorHtml,
    buildGameUiNodeInspectorHtml,
    renderContextVisualNodeInspector,
    renderContextUiNodeInspector,
    renderContextChoiceInspector
  };

  Editor.InspectorUI = InspectorUI;
  Editor.buildVisualNodeInspectorHtml = buildVisualNodeInspectorHtml;
  Editor.buildGameUiNodeInspectorHtml = buildGameUiNodeInspectorHtml;

  // Patch inline inspectors after render
  if (Editor.hooks?.after) {
    Editor.hooks.after('renderVisualScenePanel', function () {
      const host = document.getElementById('visual-scene-editor-panel');
      if (host) bindSectionPersistence(host);
    }, 'editor-inspector-redesign');

    Editor.hooks.after('renderGameUiEditor', function () {
      const host = document.getElementById('game-ui-editor-panel') || document.querySelector('.game-ui-editor');
      if (host) bindSectionPersistence(host);
    }, 'editor-inspector-redesign');
  }

  // Re-register contextual inspectors with UI-8 layout
  if (Editor.hooks?.after) {
    Editor.hooks.after('boot', function () {
      patchContextInspectors();
    }, 'editor-inspector-redesign');
  }

  function patchContextInspectors() {
    if (!Editor.Inspector || typeof Editor.Inspector.register !== 'function') return;
    if (patchContextInspectors._done) return;
    patchContextInspectors._done = true;

    Editor.Inspector.register('visual_node', {
      label: 'Visual элемент',
      render(ctx) {
        const sceneId = ctx.meta?.sceneId || Editor.currentScene;
        const nodeId = ctx.id;
        const scene = ctx.data?.scenes?.[sceneId];
        const node = scene?.visual?.nodes?.find((n) => n.id === nodeId);
        if (!node) {
          const p = document.createElement('p');
          p.className = 'hint';
          p.textContent = 'Элемент не найден';
          return p;
        }
        return renderContextVisualNodeInspector(node, nodeId);
      }
    }, { force: true });

    Editor.Inspector.register('ui_node', {
      label: 'UI элемент',
      render(ctx) {
        const screenId = ctx.meta?.screenId || Editor._uiSelectedScreen;
        const nodeId = ctx.id;
        const screen = ctx.data?.ui?.screens?.[screenId];
        const node = screen?.nodes?.find((n) => n.id === nodeId);
        if (!node) {
          const p = document.createElement('p');
          p.className = 'hint';
          p.textContent = 'UI элемент не найден';
          return p;
        }
        return renderContextUiNodeInspector(node, nodeId);
      }
    }, { force: true });

    Editor.Inspector.register('choice', {
      label: 'Выбор',
      render(ctx) {
        const sceneId = ctx.meta?.sceneId || Editor.currentScene;
        const idx = ctx.meta?.choiceIndex;
        const choice = ctx.data?.scenes?.[sceneId]?.choices?.[idx];
        if (!choice) {
          const p = document.createElement('p');
          p.className = 'hint';
          p.textContent = 'Выбор не найден';
          return p;
        }
        return renderContextChoiceInspector(choice, idx);
      }
    }, { force: true });
  }

  // Run patch after context-ui registers (we load after context-ui)
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', patchContextInspectors);
    } else {
      patchContextInspectors();
    }
  }

  function ensureStyles() {
    if (typeof document === 'undefined' || document.getElementById('insp8-styles')) return;
    if (document.querySelector('link#editor-design-system-css, link[href*="editor-design-system"]')) return;
    const st = document.createElement('style');
    st.id = 'insp8-styles';
    st.textContent = `
      .insp8-inspector .insp8-subhead { font-size:11px; font-weight:600; color:var(--ink-faint); margin:8px 0 4px; }
      .insp8-transform-row { display:flex; flex-wrap:wrap; gap:8px; }
      .insp8-field { font-size:12px; }
      .insp8-summary-list { list-style:none; padding:0; margin:4px 0 8px; }
      .insp8-summary-list li { padding:4px 8px; background:var(--highlight); border-radius:4px; margin-bottom:4px; font-size:12px; }
      .insp8-empty { font-style:italic; }
      .insp8-raw-json { font-size:10px; max-height:120px; overflow:auto; background:var(--bg-subtle); padding:6px; border-radius:4px; }
      .insp8-node-title { margin:0 0 8px; font-size:14px; }
      .insp8-add-btn { margin-top:6px; }
    `;
    document.head.appendChild(st);
  }

  ensureStyles();

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-inspector-redesign', {
      buildVisualNodeInspectorHtml,
      buildGameUiNodeInspectorHtml,
      InspectorUI
    }, { force: true });
  }

  console.info('[Editor.InspectorUI] ready');
})();
