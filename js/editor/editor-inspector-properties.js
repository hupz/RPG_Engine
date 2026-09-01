// ============================================================
// Inspector Property System (UI-15) — shared field controls & sections
// Extends UI-8 InspectorUI. No schema/runtime/history core changes.
// ============================================================
(function attachInspectorProperties() {
  'use strict';

  if (typeof Editor === 'undefined') return;

  const STANDARD_SECTIONS = Object.freeze({
    general: { id: 'general', label: 'Общее', labelEn: 'GENERAL' },
    appearance: { id: 'appearance', label: 'Внешний вид', labelEn: 'APPEARANCE' },
    position: { id: 'position', label: 'Позиция', labelEn: 'POSITION' },
    logic: { id: 'logic', label: 'Логика', labelEn: 'LOGIC' },
    content: { id: 'content', label: 'Контент', labelEn: 'CONTENT' },
    advanced: { id: 'advanced', label: 'Advanced', labelEn: 'ADVANCED' }
  });

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

  function UI() {
    return Editor.InspectorUI || null;
  }

  function isWriter() {
    return UI()?.isWriter?.() || (typeof Editor.isWriterMode === 'function' && Editor.isWriterMode());
  }

  function isAdvanced() {
    return UI()?.isAdvanced?.() ||
      (typeof Editor.isEditorAdvancedMode === 'function' && Editor.isEditorAdvancedMode()) ||
      (typeof Editor.isAdvancedMode === 'function' && Editor.isAdvancedMode());
  }

  function renderInspectorSection(prefix, sectionId, title, bodyHtml, defaultOpen) {
    const ui = UI();
    if (ui && typeof ui.sectionHtml === 'function') {
      return ui.sectionHtml(prefix, sectionId, title, bodyHtml, defaultOpen)
        .replace('class="insp-section', 'class="insp-section insp15-section');
    }
    const open = defaultOpen !== false ? ' open' : '';
    if (sectionId === 'advanced' && isWriter()) return '';
    return (
      '<details class="insp-section insp15-section" data-insp15-section="' + escAttr(sectionId) + '"' + open + '>' +
      '<summary class="insp-section__title insp15-section__title">' + esc(title) + '</summary>' +
      '<div class="insp-section__body insp15-section__body">' + bodyHtml + '</div></details>'
    );
  }

  function fieldWrap(label, controlHtml, opts) {
    opts = opts || {};
    const hint = opts.hint ? '<p class="hint insp15-field__hint">' + esc(opts.hint) + '</p>' : '';
    const disabled = opts.disabled ? ' insp15-field--disabled' : '';
    return (
      '<div class="insp15-field' + disabled + '">' +
      '<label class="insp15-field__label">' + esc(label) + '</label>' +
      '<div class="insp15-field__control">' + controlHtml + '</div>' +
      hint + '</div>'
    );
  }

  function renderTextField(label, value, attrs, opts) {
    attrs = attrs || {};
    opts = opts || {};
    const dis = opts.disabled ? ' disabled' : '';
    const ph = opts.placeholder ? ' placeholder="' + escAttr(opts.placeholder) + '"' : '';
    let attrStr = '';
    Object.keys(attrs).forEach((k) => {
      attrStr += ' ' + escAttr(k) + '="' + escAttr(attrs[k]) + '"';
    });
    return fieldWrap(label,
      '<input type="text" class="form-control insp15-input"' + attrStr + ph + dis +
      ' value="' + escAttr(value == null ? '' : value) + '">',
      opts);
  }

  function renderTextareaField(label, value, attrs, opts) {
    attrs = attrs || {};
    opts = opts || {};
    const rows = opts.rows || 3;
    let attrStr = '';
    Object.keys(attrs).forEach((k) => {
      attrStr += ' ' + escAttr(k) + '="' + escAttr(attrs[k]) + '"';
    });
    return fieldWrap(label,
      '<textarea class="form-control insp15-textarea" rows="' + rows + '"' + attrStr + '>' +
      esc(value == null ? '' : value) + '</textarea>',
      opts);
  }

  function renderNumberField(label, value, attrs, opts) {
    attrs = attrs || {};
    opts = opts || {};
    const step = opts.step != null ? opts.step : 'any';
    const min = opts.min != null ? ' min="' + escAttr(opts.min) + '"' : '';
    const max = opts.max != null ? ' max="' + escAttr(opts.max) + '"' : '';
    let attrStr = '';
    Object.keys(attrs).forEach((k) => {
      attrStr += ' ' + escAttr(k) + '="' + escAttr(attrs[k]) + '"';
    });
    return fieldWrap(label,
      '<input type="number" class="form-control insp15-input" step="' + escAttr(step) + '"' +
      min + max + attrStr + ' value="' + escAttr(value == null ? '' : value) + '">',
      opts);
  }

  function renderToggleField(label, checked, attrs, opts) {
    attrs = attrs || {};
    let attrStr = '';
    Object.keys(attrs).forEach((k) => {
      attrStr += ' ' + escAttr(k) + '="' + escAttr(attrs[k]) + '"';
    });
    const hint = opts && opts.hint ? '<p class="hint insp15-field__hint">' + esc(opts.hint) + '</p>' : '';
    return (
      '<div class="insp15-field insp15-toggle-field">' +
      '<label class="insp15-toggle"><input type="checkbox"' + attrStr +
      (checked ? ' checked' : '') + '> ' + esc(label) + '</label>' +
      hint + '</div>'
    );
  }

  function renderSelectField(label, value, options, attrs, opts) {
    attrs = attrs || {};
    opts = opts || {};
    let attrStr = '';
    Object.keys(attrs).forEach((k) => {
      attrStr += ' ' + escAttr(k) + '="' + escAttr(attrs[k]) + '"';
    });
    const optsHtml = (options || []).map((o) => {
      const v = typeof o === 'object' ? o.value : o;
      const t = typeof o === 'object' ? (o.label || o.value) : o;
      return '<option value="' + escAttr(v) + '"' + (String(value) === String(v) ? ' selected' : '') + '>' +
        esc(t) + '</option>';
    }).join('');
    return fieldWrap(label,
      '<select class="form-control insp15-select"' + attrStr + '>' + optsHtml + '</select>',
      opts);
  }

  function renderEntityField(label, entityType, value, attrs, opts) {
    attrs = attrs || {};
    if (typeof Editor.renderNpcIdSelect === 'function' && entityType === 'npc') {
      const wrap = Editor.renderNpcIdSelect(value || '', attrs.onchange || '');
      return fieldWrap(label, wrap, opts);
    }
    return renderTextField(label, value, attrs, opts);
  }

  function renderAssetField(label, nodeId, attrs, opts) {
    attrs = attrs || {};
    const action = attrs.pickAction || 'pickAsset';
    const targetAttr = attrs.targetAttr || 'data-target';
    return fieldWrap(label,
      '<button type="button" class="btn btn-secondary btn-sm insp15-asset-btn" data-action="' +
      escAttr(action) + '" ' + targetAttr + '="' + escAttr(nodeId) + '">Выбрать…</button>',
      opts);
  }

  function renderPositionFields(transform, attrs, opts) {
    const ui = UI();
    if (ui && typeof ui.buildTransformHtml === 'function') {
      return ui.buildTransformHtml(Object.assign({
        transform: transform || { x: 0, y: 0, w: 0.1, h: 0.1, z: 0 }
      }, attrs || {}, opts || {}));
    }
    const t = transform || {};
    let html = '<div class="insp15-position-row">';
    ['x', 'y', 'w', 'h'].forEach((f) => {
      const lab = f === 'w' ? 'Ширина' : f === 'h' ? 'Высота' : f.toUpperCase();
      html += renderNumberField(lab, t[f], { 'data-field': f }, { step: 0.01 });
    });
    html += '</div>';
    return html;
  }

  function renderLogicSection(opts) {
    opts = opts || {};
    const ui = UI();
    let html = '';

    html += '<div class="insp15-logic-block">';
    html += '<p class="insp15-logic-block__title">Условия</p>';
    if (ui && typeof ui.buildConditionsEditorHtml === 'function') {
      html += ui.buildConditionsEditorHtml(opts);
    } else {
      html += '<p class="hint insp15-empty">Нет условий</p>';
      html += '<button type="button" class="btn btn-secondary btn-sm">+ Добавить условие</button>';
    }
    html += '</div>';

    html += '<div class="insp15-logic-block">';
    html += '<p class="insp15-logic-block__title">Действия</p>';
    if (ui && typeof ui.buildInteractionEditorHtml === 'function') {
      html += ui.buildInteractionEditorHtml(opts);
    } else {
      html += '<p class="hint insp15-empty">Нет действий</p>';
      html += '<button type="button" class="btn btn-secondary btn-sm">+ Добавить действие</button>';
    }
    html += '</div>';

    return html;
  }

  function buildVisualNodeInspectorV15(selected) {
    if (!selected) return '<p class="hint">Выберите элемент</p>';
    const ui = UI();
    const nid = selected.id;
    const prefix = 'visual';
    const t = selected.transform || { x: 0, y: 0, w: 0.1, h: 0.1, z: 0 };
    const clickSteps = Array.isArray(selected.events?.click) ? selected.events.click : [];

    const generalBody =
      renderTextField('Имя', selected.props?.label || '', { 'data-field': 'label', 'data-node': nid }) +
      '<div class="insp15-toggle-row">' +
      renderToggleField('Видимый', selected.visible !== false, { 'data-field': 'visible', 'data-node': nid }) +
      renderToggleField('Активный', selected.enabled !== false, { 'data-field': 'enabled', 'data-node': nid }) +
      '</div>';

    let contentBody = '<p class="hint insp15-empty">Нет текстового контента</p>';
    if (selected.kind === 'text' || selected.kind === 'button') {
      contentBody = renderTextareaField('Текст', selected.props?.text || '', {
        'data-field': 'text', 'data-node': nid
      });
    }

    let appearBody = '';
    if (selected.kind === 'image') {
      appearBody += renderAssetField('Изображение', nid);
    }
    if (!appearBody) appearBody = '<p class="hint insp15-empty">—</p>';

    const positionBody = renderPositionFields(t, { nodeId: nid, fieldAttr: 'data-field', nodeAttr: 'data-node' });

    const logicBody = renderLogicSection({
      nodeId: nid,
      showIf: selected.showIf,
      clickSteps: clickSteps,
      clearAction: 'clearClick'
    });

    let advancedBody = '';
    if (isAdvanced()) {
      advancedBody = '<p class="hint">ID: <code>' + esc(nid) + '</code></p>' +
        '<p class="hint">Тип: <code>' + esc(selected.kind || 'hotspot') + '</code></p>';
      const legacyFn = Editor._buildVisualNodeInspectorHtmlUi8;
      if (typeof legacyFn === 'function') {
        try {
          const legacy = legacyFn(selected);
          const m = legacy.match(/<pre class="insp8-raw-json">[\s\S]*?<\/pre>/);
          if (m) advancedBody += m[0];
        } catch (e) { /* */ }
      }
    }

    return '<div class="visual-inspector insp8-inspector insp15-inspector" data-insp15="1">' +
      renderInspectorSection(prefix, 'general', STANDARD_SECTIONS.general.label, generalBody, true) +
      renderInspectorSection(prefix, 'content', STANDARD_SECTIONS.content.label, contentBody,
        selected.kind === 'text' || selected.kind === 'button') +
      renderInspectorSection(prefix, 'appearance', STANDARD_SECTIONS.appearance.label, appearBody, !!appearBody) +
      renderInspectorSection(prefix, 'position', STANDARD_SECTIONS.position.label, positionBody, true) +
      renderInspectorSection(prefix, 'logic', STANDARD_SECTIONS.logic.label, logicBody,
        clickSteps.length > 0 || !!selected.showIf) +
      renderInspectorSection(prefix, 'advanced', STANDARD_SECTIONS.advanced.label, advancedBody, false) +
      '</div>';
  }

  function buildGameUiNodeInspectorV15(node) {
    if (!node) return '';
    const ui = UI();
    const nid = node.id;
    const prefix = 'ui';
    const t = node.transform || { x: 0, y: 0, w: 0.2, h: 0.1, z: 0 };
    const clickSteps = Array.isArray(node.events?.click) ? node.events.click : [];
    const title = node.props?.label || node.text || (isAdvanced() ? nid : 'Элемент');

    const generalBody = renderTextField('Имя', node.props?.label || node.text || '', {
      'data-ui-node': nid, 'data-ui-field': 'label'
    });

    let contentBody = '<p class="hint insp15-empty">Нет контента</p>';
    if (node.text != null || node.props?.text) {
      contentBody = renderTextField('Текст', node.text || node.props?.text || '', {
        'data-ui-node': nid, 'data-ui-field': 'text'
      });
    }
    if (node.binding || !isWriter()) {
      const binds = (typeof UIRuntime !== 'undefined' && UIRuntime.BINDINGS)
        ? UIRuntime.BINDINGS : ['player.hp', 'player.gold', 'player.level', 'player.name'];
      const bindOpts = [{ value: '', label: '—' }].concat(binds.map((b) => ({
        value: b,
        label: isWriter() ? b.replace('player.', '') : b
      })));
      contentBody += renderSelectField('Привязка', node.binding || '', bindOpts, {
        'data-ui-node': nid, 'data-ui-field': 'binding'
      });
    }

    let appearBody = renderAssetField('Asset', nid, { pickAction: 'pickAsset', targetAttr: 'data-id' });
    if (node.asset && (node.asset.src || node.asset.ref) && !isWriter()) {
      appearBody += renderTextField('Путь asset', node.asset.src || node.asset.ref || '', {
        'data-ui-node': nid, 'data-ui-field': 'assetSrc'
      });
    }

    const positionBody = renderPositionFields(t, {
      nodeId: nid,
      fieldAttr: 'data-ui-field',
      nodeAttr: 'data-ui-node',
      fieldPrefix: 'transform.'
    });

    const logicBody = renderLogicSection({
      nodeId: nid,
      showIf: node.showIf,
      clickSteps: clickSteps,
      nodeAttr: 'data-ui-node',
      fieldAttr: 'data-ui-field',
      stepClass: 'ui-click-step',
      removeAction: 'clickRemove',
      addAction: 'clickAdd',
      clickActionField: 'clickActionAt'
    });

    let advancedBody = '';
    if (isAdvanced()) {
      advancedBody = '<p class="hint">ID: <code>' + esc(nid) + '</code></p>' +
        '<p class="hint">Тип: <code>' + esc(node.kind || node.type || 'panel') + '</code></p>';
    }

    return '<div class="ui-inspector insp8-inspector insp15-inspector" data-insp15="1">' +
      '<h4 class="insp8-node-title">' + esc(title) + '</h4>' +
      renderInspectorSection(prefix, 'general', STANDARD_SECTIONS.general.label, generalBody, true) +
      renderInspectorSection(prefix, 'content', STANDARD_SECTIONS.content.label, contentBody, !!(node.text || node.binding)) +
      renderInspectorSection(prefix, 'appearance', STANDARD_SECTIONS.appearance.label, appearBody, true) +
      renderInspectorSection(prefix, 'position', STANDARD_SECTIONS.position.label, positionBody, true) +
      renderInspectorSection(prefix, 'logic', STANDARD_SECTIONS.logic.label, logicBody,
        clickSteps.length > 0 || !!node.showIf) +
      renderInspectorSection(prefix, 'advanced', STANDARD_SECTIONS.advanced.label, advancedBody, false) +
      '</div>';
  }

  function patchContextInspectorsV15() {
    if (!Editor.Inspector || patchContextInspectorsV15._done) return;
    const ui = UI();
    if (!ui || typeof ui.renderContextVisualNodeInspector !== 'function') return;
    patchContextInspectorsV15._done = true;

    const origVisual = ui.renderContextVisualNodeInspector.bind(ui);
    ui.renderContextVisualNodeInspector = function (node, nodeId) {
      const frag = document.createDocumentFragment();
      const wrap = document.createElement('div');
      wrap.innerHTML = buildVisualNodeInspectorV15(Object.assign({ id: nodeId }, node));
      wrap.querySelectorAll('.insp15-section').forEach((el) => frag.appendChild(el));
      if (ui.bindSectionPersistence) {
        const host = document.createElement('div');
        host.appendChild(frag.cloneNode(true));
        ui.bindSectionPersistence(host);
      }
      if (!frag.childNodes.length) return origVisual(node, nodeId);
      return frag;
    };

    if (typeof ui.renderContextUiNodeInspector === 'function') {
      const origUi = ui.renderContextUiNodeInspector.bind(ui);
      ui.renderContextUiNodeInspector = function (node, nodeId) {
        const frag = document.createDocumentFragment();
        const wrap = document.createElement('div');
        wrap.innerHTML = buildGameUiNodeInspectorV15(Object.assign({ id: nodeId }, node));
        wrap.querySelectorAll('.insp15-section').forEach((el) => frag.appendChild(el));
        if (!frag.childNodes.length) return origUi(node, nodeId);
        return frag;
      };
    }

    if (typeof ui.renderContextChoiceInspector === 'function') {
      const origChoice = ui.renderContextChoiceInspector.bind(ui);
      ui.renderContextChoiceInspector = function (choice, idx) {
        const frag = document.createDocumentFragment();
        const prefix = 'ctx-choice';
        const generalBody = document.createDocumentFragment();
        if (ui.ctxFieldRow) {
          generalBody.appendChild(ui.ctxFieldRow('Текст', ui.ctxTextInput(choice.text || '', (v) => {
            Editor.updateChoice?.(idx, 'text', v);
          })));
        }
        const det = document.createElement('details');
        det.className = 'insp-section insp15-section';
        det.open = true;
        const sum = document.createElement('summary');
        sum.className = 'insp-section__title';
        sum.textContent = STANDARD_SECTIONS.general.label;
        det.appendChild(sum);
        const body = document.createElement('div');
        body.className = 'insp-section__body';
        body.appendChild(generalBody);
        det.appendChild(body);
        frag.appendChild(det);

        const logicWrap = document.createElement('div');
        logicWrap.innerHTML = renderLogicSection({
          nodeId: String(idx),
          showIf: choice.showIf || choice.hideIf,
          clickSteps: choice.action ? [{ action: choice.action, params: choice.params || {} }] : [],
          nodeAttr: 'data-choice',
          fieldAttr: 'data-field'
        });
        const logicDet = document.createElement('details');
        logicDet.className = 'insp-section insp15-section';
        logicDet.open = !!(choice.showIf || choice.action);
        const logicSum = document.createElement('summary');
        logicSum.className = 'insp-section__title';
        logicSum.textContent = STANDARD_SECTIONS.logic.label;
        logicDet.appendChild(logicSum);
        const logicBody = document.createElement('div');
        logicBody.className = 'insp-section__body';
        logicBody.appendChild(logicWrap);
        logicDet.appendChild(logicBody);
        frag.appendChild(logicDet);

        if (!frag.childNodes.length) return origChoice(choice, idx);
        return frag;
      };
    }
  }

  function applyPatches() {
    if (typeof Editor.buildVisualNodeInspectorHtml === 'function') {
      Editor._buildVisualNodeInspectorHtmlUi8 = Editor._buildVisualNodeInspectorHtmlUi8 ||
        Editor.buildVisualNodeInspectorHtml;
      Editor.buildVisualNodeInspectorHtml = buildVisualNodeInspectorV15;
    }
    if (typeof Editor.buildGameUiNodeInspectorHtml === 'function') {
      Editor._buildGameUiNodeInspectorHtmlUi8 = Editor._buildGameUiNodeInspectorHtmlUi8 ||
        Editor.buildGameUiNodeInspectorHtml;
      Editor.buildGameUiNodeInspectorHtml = buildGameUiNodeInspectorV15;
    }
    if (Editor.InspectorUI) {
      Object.assign(Editor.InspectorUI, {
        STANDARD_SECTIONS,
        renderInspectorSection,
        renderTextField,
        renderTextareaField,
        renderNumberField,
        renderToggleField,
        renderSelectField,
        renderEntityField,
        renderAssetField,
        renderPositionFields,
        renderLogicSection
      });
    }
    patchContextInspectorsV15();
    if (Editor.Inspector && !Editor.Inspector._insp15ScenePatched) {
      Editor.Inspector._insp15ScenePatched = true;
      Editor.Inspector.register('scene', {
        label: 'Сцена',
        render(ctx) {
          const id = ctx.id;
          const scene = ctx.data?.scenes?.[id];
          if (!scene) {
            const p = document.createElement('p');
            p.className = 'hint';
            p.textContent = 'Сцена не найдена';
            return p;
          }
          const frag = document.createDocumentFragment();
          const hint = document.createElement('p');
          hint.className = 'hint';
          hint.textContent = 'Текст и выборы — в документе слева.';
          frag.appendChild(hint);

          const gen = document.createElement('details');
          gen.className = 'insp-section insp15-section';
          gen.open = true;
          const genSum = document.createElement('summary');
          genSum.className = 'insp-section__title';
          genSum.textContent = STANDARD_SECTIONS.general.label;
          gen.appendChild(genSum);
          const genBody = document.createElement('div');
          genBody.className = 'insp-section__body';
          genBody.innerHTML = renderTextField('Название', scene.location || scene.title || '', {}, { disabled: true });
          if (isAdvanced()) {
            genBody.innerHTML += '<p class="hint">ID: <code>' + esc(id) + '</code></p>';
          }
          gen.appendChild(genBody);
          frag.appendChild(gen);

          const stats = document.createElement('p');
          stats.className = 'hint';
          const choices = Array.isArray(scene.choices) ? scene.choices.length : 0;
          const nodes = scene.visual?.nodes?.length || 0;
          stats.textContent = 'Выборов: ' + choices + (nodes ? ' · Visual: ' + nodes : '');
          frag.appendChild(stats);
          return frag;
        }
      });
    }
  }

  const InspectorProps = {
    STANDARD_SECTIONS,
    renderInspectorSection,
    renderTextField,
    renderTextareaField,
    renderNumberField,
    renderToggleField,
    renderSelectField,
    renderEntityField,
    renderAssetField,
    renderPositionFields,
    renderLogicSection,
    buildVisualNodeInspectorV15,
    buildGameUiNodeInspectorV15
  };

  Editor.InspectorProps = InspectorProps;

  function ensureStyles() {
    if (typeof document === 'undefined' || document.getElementById('insp15-styles')) return;
    const st = document.createElement('style');
    st.id = 'insp15-styles';
    st.textContent = `
      .insp15-inspector .insp15-section__title { font-size: 11px; font-weight: 700; letter-spacing: .04em; }
      .insp15-field { margin-bottom: 8px; }
      .insp15-field__label { display: block; font-size: 11px; color: var(--ink-faint); margin-bottom: 2px; }
      .insp15-field__control input, .insp15-field__control select, .insp15-field__control textarea { width: 100%; font-size: 12px; }
      .insp15-field--disabled { opacity: .55; pointer-events: none; }
      .insp15-toggle-row { display: flex; flex-wrap: wrap; gap: 8px; }
      .insp15-toggle { font-size: 12px; cursor: pointer; }
      .insp15-logic-block { margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px dashed var(--border); }
      .insp15-logic-block:last-child { border-bottom: none; margin-bottom: 0; }
      .insp15-logic-block__title { font-size: 11px; font-weight: 600; margin: 0 0 6px; color: var(--ink-light); }
      .insp15-position-row { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
      .insp15-empty { font-style: italic; }
    `;
    document.head.appendChild(st);
  }

  ensureStyles();

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', applyPatches);
    } else {
      applyPatches();
    }
  } else {
    applyPatches();
  }

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-inspector-properties', InspectorProps, { force: true });
  }

  console.info('[Editor.InspectorProps] ready');
})();
