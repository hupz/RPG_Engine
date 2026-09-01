/**
 * Phase 1.17 — Project graph extraction & analysis helpers (editor only).
 * No runtime graph. Edges from real transitions; analysis from ProjectValidator report.
 */
(function attachProjectGraphIndex(global) {
  'use strict';

  const FILTERS = Object.freeze(['all', 'text', 'visual', 'errors', 'orphan']);

  function sceneLabel(id, sc) {
    return (sc && (sc.location || sc.title || sc.name)) || id;
  }

  function getSceneKind(sc) {
    if (typeof EditorContentIndex !== 'undefined' && EditorContentIndex.getSceneKind) {
      return EditorContentIndex.getSceneKind(sc);
    }
    const visual = !!(sc && sc.visual && Array.isArray(sc.visual.nodes) && sc.visual.nodes.length);
    const hasText = !!(sc && String(sc.text || '').trim());
    const hasChoices = Array.isArray(sc?.choices) && sc.choices.length > 0;
    if (visual && (hasText || hasChoices)) return 'mixed';
    if (visual) return 'visual';
    return 'text';
  }

  function collectEdges(data) {
    const scenes = data?.scenes || {};
    const uiScreens = data?.ui?.screens || {};
    if (typeof ProjectSchema !== 'undefined' && typeof ProjectSchema.collectSceneFlowEdges === 'function') {
      const edges = [];
      Object.keys(scenes).forEach((sid) => {
        edges.push(...ProjectSchema.collectSceneFlowEdges(scenes[sid], sid, { scenes, uiScreens }));
      });
      return edges;
    }
    // Fallback: choices + nextScene + change_scene in visual
    const edges = [];
    Object.keys(scenes).forEach((fromId) => {
      const sc = scenes[fromId] || {};
      (sc.choices || []).forEach((c, ci) => {
        const to = c && (c.to || c.nextScene);
        if (!to) return;
        edges.push({
          fromId,
          toId: String(to),
          kind: 'choice',
          label: String(c.text || '→').slice(0, 40),
          choiceIndex: ci,
          broken: !scenes[to]
        });
      });
      if (sc.nextScene) {
        const to = String(sc.nextScene);
        edges.push({
          fromId,
          toId: to,
          kind: 'next',
          label: 'далее',
          broken: !scenes[to]
        });
      }
      (sc.visual?.nodes || []).forEach((node) => {
        (node?.events?.click || []).forEach((step, si) => {
          const p = step?.params || {};
          let to = null;
          if (step?.action === 'change_scene') to = p.sceneId || p.to;
          if (step?.action === 'start_combat') to = p.nextScene;
          if (!to) return;
          edges.push({
            fromId,
            toId: String(to),
            kind: 'visual_click',
            label: (node.props && node.props.label) || 'hotspot',
            choiceIndex: si,
            nodeId: node.id,
            broken: !scenes[to]
          });
        });
      });
    });
    return edges;
  }

  /**
   * Extract scene graph: nodes = scenes, edges = real transitions.
   */
  function extractProjectGraph(data) {
    data = data || {};
    const scenes = data.scenes || {};
    const edges = collectEdges(data);
    const outCount = Object.create(null);
    const brokenEdges = [];
    edges.forEach((e) => {
      outCount[e.fromId] = (outCount[e.fromId] || 0) + 1;
      if (e.broken) brokenEdges.push(e);
    });

    const startScene = data.startScene && scenes[data.startScene]
      ? String(data.startScene)
      : (data.meta?.startScene && scenes[data.meta.startScene]
        ? String(data.meta.startScene)
        : (Object.keys(scenes)[0] || null));

    const nodes = Object.keys(scenes).map((id) => {
      const sc = scenes[id] || {};
      const kind = getSceneKind(sc);
      return {
        id,
        label: sceneLabel(id, sc),
        kind,
        deadEnd: !outCount[id],
        outgoing: outCount[id] || 0,
        // analysis flags filled by annotateWithValidatorReport
        orphan: false,
        unreachable: false,
        hasErrors: false,
        issues: []
      };
    });

    return {
      nodes,
      edges,
      brokenEdges,
      startScene,
      meta: { nodeCount: nodes.length, edgeCount: edges.length }
    };
  }

  /**
   * Annotate graph from ProjectValidator report — do not re-run reachability BFS here.
   */
  function annotateWithValidatorReport(graph, report) {
    if (!graph || !graph.nodes) return graph;
    const byId = Object.create(null);
    graph.nodes.forEach((n) => {
      n.orphan = false;
      n.unreachable = false;
      n.hasErrors = false;
      n.issues = [];
      byId[n.id] = n;
    });

    const issues = []
      .concat(report?.errors || [])
      .concat(report?.warnings || [])
      .concat(report?.info || [])
      .concat(report?.issues || []);

    const seen = new Set();
    issues.forEach((iss) => {
      if (!iss) return;
      const key = (iss.type || '') + '|' + (iss.entityId || '') + '|' + (iss.path || '') + '|' + (iss.message || '');
      if (seen.has(key)) return;
      seen.add(key);

      const sceneId = iss.sceneId || (iss.entityType === 'scene' ? iss.entityId : null);
      if (sceneId && byId[sceneId]) {
        byId[sceneId].issues.push(iss);
        if (iss.type === 'orphan_scene') byId[sceneId].orphan = true;
        if (iss.type === 'unreachable_scene') byId[sceneId].unreachable = true;
        if (iss.severity === 'error' || iss.type === 'missing_scene' || iss.type === 'orphan_scene' ||
            iss.type === 'unreachable_scene') {
          byId[sceneId].hasErrors = true;
        }
      }
      // Broken link: missing target — flag source scene when known
      if (iss.type === 'missing_scene' && iss.sceneId && byId[iss.sceneId]) {
        byId[iss.sceneId].hasErrors = true;
      }
    });

    // Broken edges from extraction (structural) also mark hasErrors
    (graph.brokenEdges || graph.edges || []).forEach((e) => {
      if (e.broken && byId[e.fromId]) {
        byId[e.fromId].hasErrors = true;
      }
    });

    graph.analysis = summarizeAnalysis(graph, report);
    return graph;
  }

  function summarizeAnalysis(graph, report) {
    const nodes = graph.nodes || [];
    return {
      unreachable: nodes.filter((n) => n.unreachable).map((n) => n.id),
      orphan: nodes.filter((n) => n.orphan).map((n) => n.id),
      deadEnds: nodes.filter((n) => n.deadEnd).map((n) => n.id),
      brokenLinks: (graph.brokenEdges || []).map((e) => ({
        fromId: e.fromId,
        toId: e.toId,
        kind: e.kind,
        label: e.label
      })),
      errorScenes: nodes.filter((n) => n.hasErrors).map((n) => n.id),
      validatorSummary: report?.summary || null
    };
  }

  /**
   * Filters: all | text | visual | errors | orphan
   * visual includes mixed; text = text-only.
   */
  function filterProjectGraph(graph, filter) {
    filter = (filter || 'all').toLowerCase();
    if (filter === 'all' || FILTERS.indexOf(filter) < 0) {
      return {
        nodes: (graph.nodes || []).slice(),
        edges: (graph.edges || []).slice(),
        filter: 'all',
        analysis: graph.analysis || null,
        startScene: graph.startScene,
        meta: graph.meta
      };
    }
    const keep = Object.create(null);
    (graph.nodes || []).forEach((n) => {
      let ok = false;
      if (filter === 'text') ok = n.kind === 'text';
      else if (filter === 'visual') ok = n.kind === 'visual' || n.kind === 'mixed';
      else if (filter === 'errors') ok = !!n.hasErrors || !!n.unreachable || !!n.orphan;
      else if (filter === 'orphan') ok = !!n.orphan || !!n.unreachable;
      if (ok) keep[n.id] = true;
    });
    const nodes = (graph.nodes || []).filter((n) => keep[n.id]);
    const edges = (graph.edges || []).filter((e) => keep[e.fromId] && (keep[e.toId] || e.broken));
    return {
      nodes,
      edges,
      filter,
      analysis: graph.analysis || null,
      startScene: graph.startScene,
      meta: { nodeCount: nodes.length, edgeCount: edges.length }
    };
  }

  /** Build annotated+filtered graph using validator report (caller provides report). */
  function buildAnalyzedGraph(data, report, filter) {
    const graph = extractProjectGraph(data);
    annotateWithValidatorReport(graph, report || {});
    return filterProjectGraph(graph, filter || 'all');
  }

  const api = {
    FILTERS,
    extractProjectGraph,
    annotateWithValidatorReport,
    filterProjectGraph,
    buildAnalyzedGraph,
    collectEdges,
    getSceneKind,
    sceneLabel
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof global !== 'undefined') {
    global.ProjectGraphIndex = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global);
