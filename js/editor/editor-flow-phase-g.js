/**
 * Phase G — Visual flow map: hotspot / enter / UI transitions on story graph
 */
(function attachFlowPhaseG() {
  'use strict';

  if (typeof Editor === 'undefined') return;

  function collectAllFlowEdges(data) {
    if (typeof ProjectSchema !== 'undefined' && ProjectSchema.collectSceneFlowEdges) {
      const scenes = data?.scenes || {};
      const uiScreens = data?.ui?.screens || {};
      const edges = [];
      Object.keys(scenes).forEach((sid) => {
        edges.push(...ProjectSchema.collectSceneFlowEdges(scenes[sid], sid, { scenes, uiScreens }));
      });
      return edges;
    }
    return [];
  }

  function visualEdgeSummary(edges) {
    const visual = edges.filter((e) => String(e.kind || '').indexOf('visual_') === 0);
    return visual.length;
  }

  if (typeof Editor.buildStoryFlowModel === 'function' && !Editor._buildStoryFlowModelPhaseG) {
    Editor._buildStoryFlowModelPhaseG = Editor.buildStoryFlowModel.bind(Editor);
    Editor.buildStoryFlowModel = function buildStoryFlowModelPhaseG() {
      const model = Editor._buildStoryFlowModelPhaseG();
      if (!this.data?.scenes) return model;

      const flowEdges = collectAllFlowEdges(this.data);
      const visualByFrom = Object.create(null);
      flowEdges.forEach((e) => {
        if (String(e.kind || '').indexOf('visual_') !== 0 && e.kind !== 'scene_enter' && e.kind !== 'ui_show') return;
        if (!visualByFrom[e.fromId]) visualByFrom[e.fromId] = [];
        visualByFrom[e.fromId].push(e);
      });

      const existingKeys = new Set(
        (model.edges || []).map((e) => e.fromId + '→' + e.toId + '#' + (e.kind || '') + (e.nodeId || ''))
      );

      flowEdges.forEach((e) => {
        const key = e.fromId + '→' + e.toId + '#' + (e.kind || '') + (e.nodeId || '');
        if (existingKeys.has(key)) return;
        existingKeys.add(key);
        model.edges.push(e);
        if (e.broken) {
          model.warnings.push({ sceneId: e.fromId, message: 'Visual/UI → отсутствует «' + e.toId + '» (' + e.label + ')' });
        }
      });

      (model.nodes || []).forEach((n) => {
        const ve = visualByFrom[n.id];
        if (ve && ve.length) {
          n.kinds = n.kinds || ['scene'];
          if (n.kinds.indexOf('visual') < 0) n.kinds.push('visual');
          n.visualLinks = ve.length;
        }
      });

      model.visualEdgeCount = visualEdgeSummary(flowEdges);
      return model;
    };
  }

  if (typeof Editor.buildEditableGraphModel === 'function' && !Editor._buildEditableGraphModelPhaseG) {
    Editor._buildEditableGraphModelPhaseG = Editor.buildEditableGraphModel.bind(Editor);
    Editor.buildEditableGraphModel = function buildEditableGraphModelPhaseG() {
      const model = Editor._buildEditableGraphModelPhaseG();
      if (!this.data?.scenes) return model;

      const flowEdges = collectAllFlowEdges(this.data);
      const existingKeys = new Set(
        (model.edges || []).map((e) => e.fromId + '→' + e.toId + '#' + (e.choiceIndex != null ? e.choiceIndex : '') + (e.kind || ''))
      );

      flowEdges.forEach((e) => {
        if (String(e.kind || '').indexOf('visual_') !== 0 && e.kind !== 'scene_enter') return;
        const key = e.fromId + '→' + e.toId + '#' + (e.choiceIndex != null ? e.choiceIndex : '') + (e.kind || '');
        if (existingKeys.has(key)) return;
        existingKeys.add(key);
        model.edges.push({
          fromId: e.fromId,
          toId: e.toId,
          choiceIndex: e.choiceIndex != null ? e.choiceIndex : -2,
          label: e.label || e.kind,
          broken: !!e.broken,
          kind: e.kind,
          visual: true
        });
      });

      return model;
    };
  }

  if (typeof Editor.renderStoryFlowNodeCard === 'function' && !Editor._renderStoryFlowNodeCardPhaseG) {
    Editor._renderStoryFlowNodeCardPhaseG = Editor.renderStoryFlowNodeCard.bind(Editor);
    Editor.renderStoryFlowNodeCard = function renderStoryFlowNodeCardPhaseG(n, model) {
      let html = Editor._renderStoryFlowNodeCardPhaseG(n, model);
      if (n.visualLinks) {
        html = html.replace(
          '<div class="sf-badges">',
          '<div class="sf-badges"><span class="sf-badge" title="Visual hotspots / enter">🖼 ' + n.visualLinks + '</span>'
        );
      }
      return html;
    };
  }

  Object.assign(Editor, {
    collectProjectFlowEdges() {
      return collectAllFlowEdges(this.data);
    }
  });
})();
