/**
 * Phase 1.17 — Story Flow & Project Graph UX (editor visualization).
 * Uses ProjectGraphIndex + ProjectValidator. No runtime graph.
 */
(function attachProjectGraphPhase117() {
  'use strict';
  if (typeof Editor === 'undefined') {
    console.error('editor-project-graph-phase-117: Editor missing');
    return;
  }

  const IDX = typeof ProjectGraphIndex !== 'undefined' ? ProjectGraphIndex : null;

  Editor._pgFilter = Editor._pgFilter || 'all';
  Editor._pgLastAnalysis = null;

  Editor.getProjectGraphFilter = function () {
    return Editor._pgFilter || 'all';
  };

  Editor.setProjectGraphFilter = function (filter) {
    Editor._pgFilter = filter || 'all';
    if (typeof Editor.renderStoryGraphPanel === 'function') {
      Editor.renderStoryGraphPanel();
    }
  };

  /**
   * Run ProjectValidator + extract graph. Does not invent reachability.
   */
  Editor.buildProjectGraphView = function (filter) {
    const data = Editor.data || {};
    let report = { errors: [], warnings: [], info: [], summary: {} };
    if (typeof ProjectValidator !== 'undefined' && ProjectValidator.validateProject) {
      report = ProjectValidator.validateProject(data, {
        actionRegistry: typeof ACTION_REGISTRY !== 'undefined' ? ACTION_REGISTRY : null,
        actionCatalog: typeof EditorActionCatalog !== 'undefined' ? EditorActionCatalog : null,
        conditionCatalog: typeof EditorConditionCatalog !== 'undefined' ? EditorConditionCatalog : null
      });
    } else if (typeof Editor.validateProjectIntegrity === 'function') {
      report = Editor.validateProjectIntegrity(data) || report;
    }
    if (!IDX) {
      return { nodes: [], edges: [], analysis: null, filter: filter || 'all' };
    }
    const view = IDX.buildAnalyzedGraph(data, report, filter || Editor._pgFilter);
    Editor._pgLastAnalysis = view.analysis;
    return view;
  };

  function esc(s) {
    return typeof Editor.escapeHtml === 'function'
      ? Editor.escapeHtml(s)
      : String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderAnalysisOverlay(analysis) {
    if (!analysis) return '';
    const u = analysis.unreachable || [];
    const o = analysis.orphan || [];
    const d = analysis.deadEnds || [];
    const b = analysis.brokenLinks || [];
    const chips = (ids, cls, title) => {
      if (!ids.length) return '';
      return `<div class="pg-analysis-row"><strong>${esc(title)} (${ids.length})</strong>
        <div class="pg-chip-list">${ids.slice(0, 24).map((id) =>
          `<button type="button" class="pg-chip ${cls}" data-pg-open="${esc(id)}">${esc(id)}</button>`
        ).join('')}${ids.length > 24 ? '<span class="hint">…</span>' : ''}</div></div>`;
    };
    const broken = b.length
      ? `<div class="pg-analysis-row"><strong>Broken links (${b.length})</strong>
          <ul class="pg-broken-list">${b.slice(0, 12).map((e) =>
            `<li><button type="button" class="pg-chip pg-err" data-pg-open="${esc(e.fromId)}">${esc(e.fromId)}</button>
              → <code>${esc(e.toId)}</code> <span class="hint">(${esc(e.kind || '')})</span></li>`
          ).join('')}${b.length > 12 ? '<li class="hint">…</li>' : ''}</ul></div>`
      : '';
    const empty = !u.length && !o.length && !d.length && !b.length;
    return `<div class="pg-analysis" id="pg-analysis-overlay">
      <div class="pg-analysis-head">Analysis (Project Validator + graph edges)</div>
      ${empty ? '<p class="hint pg-analysis-ok">✓ No unreachable / orphan / broken issues flagged.</p>' : ''}
      ${chips(u, 'pg-unreach', 'Unreachable')}
      ${chips(o, 'pg-orphan', 'Orphan')}
      ${chips(d, 'pg-dead', 'Dead ends')}
      ${broken}
    </div>`;
  }

  function renderFilterBar(active) {
    const filters = [
      { id: 'all', label: 'All' },
      { id: 'text', label: 'TEXT' },
      { id: 'visual', label: 'Visual' },
      { id: 'errors', label: 'Errors' },
      { id: 'orphan', label: 'Orphan' }
    ];
    return `<div class="pg-filters" role="toolbar" aria-label="Graph filters">
      ${filters.map((f) =>
        `<button type="button" class="btn btn-sm ${active === f.id ? 'btn-primary' : 'btn-secondary'}"
          data-pg-filter="${f.id}">${f.label}</button>`
      ).join('')}
    </div>`;
  }

  // Wrap editable graph panel
  if (typeof Editor.renderStoryGraphPanel === 'function' && !Editor._pgRenderWrapped) {
    Editor._pgRenderWrapped = true;
    const prevPanel = Editor.renderStoryGraphPanel.bind(Editor);
    Editor.renderStoryGraphPanel = function renderStoryGraphPanelPhase117() {
      prevPanel();
      const host = document.getElementById('story-graph-editor');
      if (!host) return;
      const panel = host.querySelector('.story-graph-panel') || host;
      const toolbar = panel.querySelector('.story-graph-toolbar .sg-toolbar-actions') ||
        panel.querySelector('.story-graph-toolbar');
      if (toolbar && !panel.querySelector('.pg-filters')) {
        const bar = document.createElement('div');
        bar.className = 'pg-toolbar-extra';
        bar.innerHTML = renderFilterBar(Editor._pgFilter);
        toolbar.appendChild(bar);
      }
      let overlay = panel.querySelector('#pg-analysis-overlay');
      const view = Editor.buildProjectGraphView(Editor._pgFilter);
      const html = renderAnalysisOverlay(view.analysis);
      if (overlay) {
        overlay.outerHTML = html;
      } else {
        const workspace = panel.querySelector('.sg-workspace') || panel;
        workspace.insertAdjacentHTML('beforebegin', html);
      }
      // Re-apply node classes after next editable render
      requestAnimationFrame(() => Editor._pgAnnotateCanvas(view));
    };
  }

  Editor._pgAnnotateCanvas = function (view) {
    view = view || Editor._pgLastView;
    Editor._pgLastView = view;
    const svg = document.getElementById('sg-canvas');
    if (!svg || !view) return;
    const byId = Object.create(null);
    (view.nodes || []).forEach((n) => { byId[n.id] = n; });
    const filterOn = view.filter && view.filter !== 'all';
    svg.querySelectorAll('[data-node-id]').forEach((el) => {
      const id = el.getAttribute('data-node-id');
      const n = byId[id];
      el.classList.remove('pg-node-orphan', 'pg-node-unreach', 'pg-node-dead', 'pg-node-error', 'pg-node-hidden');
      if (filterOn && !n) {
        el.classList.add('pg-node-hidden');
        return;
      }
      if (!n) return;
      if (n.orphan) el.classList.add('pg-node-orphan');
      if (n.unreachable) el.classList.add('pg-node-unreach');
      if (n.deadEnd) el.classList.add('pg-node-dead');
      if (n.hasErrors) el.classList.add('pg-node-error');
    });
    svg.querySelectorAll('[data-from]').forEach((el) => {
      el.classList.remove('pg-edge-hidden');
      if (!filterOn) return;
      const from = el.getAttribute('data-from');
      const to = el.getAttribute('data-to');
      if (!byId[from] || (to && !byId[to] && !el.classList.contains('sg-edge-broken'))) {
        el.classList.add('pg-edge-hidden');
      }
    });
  };

  // After editable graph redraw, re-annotate
  if (typeof Editor.renderEditableStoryGraph === 'function' && !Editor._pgEditableWrapped) {
    Editor._pgEditableWrapped = true;
    const prevEdit = Editor.renderEditableStoryGraph.bind(Editor);
    Editor.renderEditableStoryGraph = function renderEditableStoryGraphPhase117() {
      prevEdit();
      const view = Editor.buildProjectGraphView(Editor._pgFilter);
      Editor._pgAnnotateCanvas(view);
    };
  }

  // Enrich editable model edges from ProjectSchema (visual/change_scene) without replacing layout
  if (typeof Editor.buildEditableGraphModel === 'function' && !Editor._pgModelWrapped) {
    Editor._pgModelWrapped = true;
    const prevModel = Editor.buildEditableGraphModel.bind(Editor);
    Editor.buildEditableGraphModel = function buildEditableGraphModelPhase117() {
      const model = prevModel();
      if (!IDX || !this.data?.scenes) return model;
      const extracted = IDX.extractProjectGraph(this.data);
      const existing = new Set(
        (model.edges || []).map((e) => e.fromId + '→' + e.toId + '#' + (e.kind || '') + (e.choiceIndex != null ? e.choiceIndex : ''))
      );
      extracted.edges.forEach((e) => {
        const key = e.fromId + '→' + e.toId + '#' + (e.kind || '') + (e.choiceIndex != null ? e.choiceIndex : '');
        if (existing.has(key)) return;
        // Prefer visual / action transitions not already present
        if (e.kind === 'choice' || e.kind === 'next' || e.kind === 'nextScene') return;
        existing.add(key);
        model.edges.push({
          fromId: e.fromId,
          toId: e.toId,
          choiceIndex: e.choiceIndex != null ? e.choiceIndex : -2,
          label: e.label || e.kind,
          broken: !!e.broken,
          kind: e.kind,
          visual: String(e.kind || '').indexOf('visual_') === 0
        });
      });
      // Annotate orphan/unreachable on nodes from validator
      let report = { errors: [], warnings: [] };
      if (typeof ProjectValidator !== 'undefined' && ProjectValidator.validateProject) {
        report = ProjectValidator.validateProject(this.data, {
          actionRegistry: typeof ACTION_REGISTRY !== 'undefined' ? ACTION_REGISTRY : null
        });
      }
      const annotated = IDX.annotateWithValidatorReport(
        { nodes: model.nodes.map((n) => ({ ...n })), edges: model.edges, brokenEdges: extracted.brokenEdges },
        report
      );
      const flags = Object.create(null);
      annotated.nodes.forEach((n) => { flags[n.id] = n; });
      model.nodes.forEach((n) => {
        const f = flags[n.id];
        if (!f) return;
        n.orphan = f.orphan;
        n.unreachable = f.unreachable;
        n.deadEnd = f.deadEnd;
        n.hasErrors = f.hasErrors;
        n.kind = f.kind;
      });
      return model;
    };
  }

  // Event delegation for filters + open from overlay
  document.addEventListener('click', (e) => {
    const filterBtn = e.target.closest && e.target.closest('[data-pg-filter]');
    if (filterBtn && document.getElementById('story-graph-editor')?.contains(filterBtn)) {
      Editor.setProjectGraphFilter(filterBtn.getAttribute('data-pg-filter'));
      return;
    }
    const openBtn = e.target.closest && e.target.closest('[data-pg-open]');
    if (openBtn && document.getElementById('story-graph-editor')?.contains(openBtn)) {
      const id = openBtn.getAttribute('data-pg-open');
      if (typeof Editor.openSceneFromGraph === 'function') Editor.openSceneFromGraph(id);
      else if (typeof Editor.selectScene === 'function') {
        Editor.switchTab?.('scenes');
        Editor.selectScene(id);
      }
    }
  });

  // Styles
  if (!document.getElementById('project-graph-phase-117-styles')) {
    const st = document.createElement('style');
    st.id = 'project-graph-phase-117-styles';
    st.textContent = `
      .pg-toolbar-extra { display:inline-flex; flex-wrap:wrap; gap:6px; margin-left:8px; align-items:center; }
      .pg-filters { display:inline-flex; flex-wrap:wrap; gap:4px; }
      .pg-analysis {
        margin: 8px 12px; padding: 10px 12px; border: 1px solid var(--border, #ccc);
        border-radius: 6px; background: rgba(0,0,0,0.03); font-size: 13px;
      }
      .pg-analysis-head { font-weight: 600; margin-bottom: 6px; }
      .pg-analysis-ok { margin: 0; color: #2e7d32; }
      .pg-analysis-row { margin-top: 8px; }
      .pg-chip-list { display:flex; flex-wrap:wrap; gap:4px; margin-top:4px; }
      .pg-chip {
        border: 1px solid #999; background: #fff; border-radius: 4px;
        padding: 2px 8px; cursor: pointer; font-size: 12px;
      }
      .pg-chip.pg-orphan { border-color: #7b1fa2; background: #f3e5f5; }
      .pg-chip.pg-unreach { border-color: #c62828; background: #ffebee; }
      .pg-chip.pg-dead { border-color: #e65100; background: #fff3e0; }
      .pg-chip.pg-err { border-color: #c62828; }
      .pg-broken-list { margin: 4px 0 0; padding-left: 18px; }
      #sg-canvas .pg-node-orphan rect, #sg-canvas .sg-node.pg-node-orphan rect { stroke: #7b1fa2; stroke-width: 3; }
      #sg-canvas .pg-node-unreach rect, #sg-canvas .sg-node.pg-node-unreach rect { stroke: #c62828; stroke-width: 3; }
      #sg-canvas .pg-node-dead rect, #sg-canvas .sg-node.pg-node-dead rect { stroke-dasharray: 4 3; stroke: #e65100; }
      #sg-canvas .pg-node-error rect, #sg-canvas .sg-node.pg-node-error rect { fill: #ffcdd2; }
      #sg-canvas .pg-node-hidden, #sg-canvas .sg-node.pg-node-hidden { opacity: 0.12; pointer-events: none; }
      #sg-canvas .pg-edge-hidden { opacity: 0.08; pointer-events: none; }
    `;
    document.head.appendChild(st);
  }

  if (Editor.hooks && typeof Editor.hooks.register === 'function') {
    Editor.hooks.register('editor-project-graph-phase-117', {
      buildProjectGraphView: Editor.buildProjectGraphView,
      setProjectGraphFilter: Editor.setProjectGraphFilter
    }, { force: true });
  }

  console.info('[Phase 1.17] Project graph / story flow analysis ready');
})();
