/**
 * Phase 1.12 — Scene authoring index (pure, testable)
 */
(function attachSceneAuthoringIndex(global) {
  'use strict';

  const WIZARD_PRESETS = {
    text: {
      label: 'Text',
      sceneType: 'custom',
      editorModules: ['story', 'choices'],
      patch(scene) {
        scene.text = scene.text || '';
        scene.choices = scene.choices || [];
      }
    },
    visual: {
      label: 'Visual',
      sceneType: 'custom',
      editorModules: ['story', 'visual', 'choices'],
      patch(scene) {
        scene.text = scene.text || '';
        scene.choices = scene.choices || [];
        if (!scene.visual) {
          scene.visual = { mode: 'overlay', nodes: [] };
        }
      }
    },
    dialogue: {
      label: 'Dialogue',
      sceneType: 'dialog',
      editorModules: ['story', 'dialogue', 'choices', 'npc'],
      patch(scene) {
        scene.text = scene.text || '';
        scene.dialogue = scene.dialogue || [];
        scene.choices = scene.choices || [];
      }
    },
    combat: {
      label: 'Combat',
      sceneType: 'combat',
      editorModules: ['story', 'combat', 'choices'],
      patch(scene) {
        scene.text = scene.text || '';
        scene.combat = scene.combat || [];
        scene.choices = scene.choices || [];
      }
    },
    empty: {
      label: 'Empty',
      sceneType: 'custom',
      editorModules: ['story'],
      patch(scene) {
        scene.text = scene.text || '';
      }
    }
  };

  function sceneLabel(data, sceneId) {
    const sc = data?.scenes?.[sceneId];
    return (sc && (sc.location || sc.title)) || sceneId;
  }

  function collectFlowEdges(data) {
    if (typeof ProjectSchema !== 'undefined' && ProjectSchema.collectSceneFlowEdges) {
      const scenes = data?.scenes || {};
      const uiScreens = data?.ui?.screens || {};
      const edges = [];
      Object.keys(scenes).forEach((sid) => {
        edges.push(...ProjectSchema.collectSceneFlowEdges(scenes[sid], sid, { scenes, uiScreens }));
      });
      return edges;
    }
    return collectFlowEdgesFallback(data);
  }

  function collectFlowEdgesFallback(data) {
    const edges = [];
    const scenes = data?.scenes || {};
    Object.entries(scenes).forEach(([fromId, sc]) => {
      (sc.choices || []).forEach((c, ci) => {
        const to = c?.to || c?.nextScene;
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
          choiceIndex: -1,
          broken: !scenes[to]
        });
      }
    });
    return edges;
  }

  function isChangeSceneEdge(edge) {
    if (!edge) return false;
    if (edge.kind === 'choice' || edge.kind === 'next') return true;
    if (String(edge.kind || '').indexOf('visual_') === 0) return true;
    if (edge.kind === 'scene_enter' || edge.kind === 'ui_show') return true;
    return false;
  }

  function collectSceneConnections(sceneId, data) {
    const edges = collectFlowEdges(data);
    const outgoing = edges.filter((e) => e.fromId === sceneId && isChangeSceneEdge(e));
    const incoming = edges.filter((e) => e.toId === sceneId && isChangeSceneEdge(e));
    return { outgoing, incoming, edges };
  }

  function buildSceneFlowSummary(sceneId, data) {
    const { outgoing, incoming } = collectSceneConnections(sceneId, data);
    return {
      sceneId,
      label: sceneLabel(data, sceneId),
      outgoing: outgoing.map((e) => ({
        toId: e.toId,
        toLabel: sceneLabel(data, e.toId),
        kind: e.kind,
        label: e.label,
        broken: !!e.broken
      })),
      incoming: incoming.map((e) => ({
        fromId: e.fromId,
        fromLabel: sceneLabel(data, e.fromId),
        kind: e.kind,
        label: e.label,
        broken: !!e.broken
      }))
    };
  }

  function applyWizardPreset(scene, presetId) {
    const preset = WIZARD_PRESETS[presetId] || WIZARD_PRESETS.empty;
    if (!scene || typeof scene !== 'object') return preset;
    scene.sceneType = preset.sceneType;
    scene.editorModules = preset.editorModules.slice();
    preset.patch(scene);
    return preset;
  }

  function validateSceneShape(scene) {
    if (!scene || typeof scene !== 'object') return false;
    if (typeof scene.id !== 'string' || !scene.id) return false;
    if (scene.visual != null && typeof scene.visual !== 'object') return false;
    if (scene.choices != null && !Array.isArray(scene.choices)) return false;
    if (scene.combat != null && !Array.isArray(scene.combat)) return false;
    if (scene.dialogue != null && !Array.isArray(scene.dialogue)) return false;
    if (scene.components != null && !Array.isArray(scene.components)) return false;
    return true;
  }

  function slugSceneId(name, existing) {
    const EditorRef = typeof globalThis !== 'undefined' ? globalThis.Editor : null;
    if (EditorRef && typeof EditorRef.slugifySceneId === 'function') {
      return EditorRef.slugifySceneId(name, existing || {});
    }
    if (EditorRef && typeof EditorRef.slugifyId === 'function') {
      return EditorRef.slugifyId(String(name || '').trim(), '', existing || {});
    }
    let id = String(name || 'scene').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'new_scene';
    if (!existing || !existing[id]) return id;
    let n = 2;
    while (existing[id + '_' + n]) n++;
    return id + '_' + n;
  }

  const api = {
    WIZARD_PRESETS,
    collectFlowEdges,
    collectSceneConnections,
    buildSceneFlowSummary,
    applyWizardPreset,
    validateSceneShape,
    slugSceneId,
    sceneLabel
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof global !== 'undefined') {
    global.SceneAuthoringIndex = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global);
