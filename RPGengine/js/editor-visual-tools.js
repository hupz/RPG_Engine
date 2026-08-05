// Редактор: мини-граф связей сцены (Mermaid)

(function attachEditorVisualTools() {
  if (typeof Editor === 'undefined') {
    console.error('editor-visual-tools.js: Editor не определён');
    return;
  }

  Editor._miniGraphTimer = null;
  Editor._miniGraphRenderId = 0;

  function mermaidNodeId(sceneId) {
    if (typeof Editor.mermaidNodeId === 'function') return Editor.mermaidNodeId(sceneId);
    const id = String(sceneId).replace(/[^a-zA-Z0-9_]/g, '_');
    return /^[0-9]/.test(id) ? 's_' + id : id;
  }

  function sanitizeLabel(text) {
    if (typeof Editor.sanitizeMermaidLabel === 'function') {
      return Editor.sanitizeMermaidLabel(text);
    }
    return String(text ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/"/g, "'")
      .replace(/\n/g, ' ')
      .trim();
  }

  function isBrokenTarget(targetId, scenes) {
    if (!targetId) return false;
    if (typeof Editor.isBrokenSceneTarget === 'function') {
      return Editor.isBrokenSceneTarget(targetId, scenes);
    }
    return targetId !== 'reset' && !scenes?.[targetId];
  }

  function collectOutgoing(scene, scenes) {
    if (typeof Editor.collectSceneEdges === 'function') {
      return Editor.collectSceneEdges(scene, scenes);
    }
    const edges = [];
    (scene?.choices || []).forEach((choice) => {
      const sc = choice?.skillCheck;
      if (sc) {
        if (sc.successNext) edges.push({ to: sc.successNext, label: '✓', broken: isBrokenTarget(sc.successNext, scenes) });
        if (sc.failNext) edges.push({ to: sc.failNext, label: '✗', broken: isBrokenTarget(sc.failNext, scenes) });
        if (!sc.successNext && !sc.failNext && choice.to) {
          edges.push({ to: choice.to, label: '→', broken: isBrokenTarget(choice.to, scenes) });
        }
      } else if (choice?.to) {
        edges.push({ to: choice.to, label: '→', broken: isBrokenTarget(choice.to, scenes) });
      }
    });
    if (scene?.nextScene) {
      edges.push({ to: scene.nextScene, label: 'бой', broken: isBrokenTarget(scene.nextScene, scenes) });
    }
    return edges;
  }

  function collectIncoming(targetId, scenes) {
    const incoming = [];
    Object.entries(scenes || {}).forEach(([fromId, scene]) => {
      if (fromId === targetId) return;
      collectOutgoing(scene, scenes).forEach((edge) => {
        if (edge.to === targetId) {
          incoming.push({ fromId, ...edge });
        }
      });
    });
    return incoming;
  }

  function openSceneLink(sceneId) {
    if (!sceneId || !Editor.data?.scenes?.[sceneId]) return;
    if (typeof Editor.openSceneFromGraph === 'function') {
      Editor.openSceneFromGraph(sceneId);
    } else if (typeof Editor.selectScene === 'function') {
      Editor.selectScene(sceneId);
    }
  }

  Object.assign(Editor, {
    collectIncomingSceneEdges(targetId) {
      return collectIncoming(targetId, this.data?.scenes || {});
    },

    buildMiniGraphMermaid(sceneId) {
      const scenes = this.data?.scenes || {};
      const scene = scenes[sceneId];
      if (!scene) return { code: '', sceneIds: [] };

      const centerNode = mermaidNodeId(sceneId);
      const centerLabel = sanitizeLabel(`${sceneId} [ТЕКУЩАЯ]`);
      const lines = [
        'flowchart TD',
        'classDef miniCurrent fill:#fff59d,stroke:#f9a825,color:#333',
        'classDef miniOut fill:#c8e6c9,stroke:#43a047,color:#1b5e20',
        'classDef miniIn fill:#bbdefb,stroke:#1e88e5,color:#0d47a1',
        'classDef miniErr fill:#ffcdd2,stroke:#e53935,color:#b71c1c',
        `  ${centerNode}["${centerLabel}"]:::miniCurrent`
      ];
      const clickLines = [];
      const registered = new Set([centerNode]);
      const sceneIds = new Set([sceneId]);

      const ensureNode = (sid, kind) => {
        const broken = isBrokenTarget(sid, scenes);
        const nid = broken
          ? (typeof Editor.getPhantomNodeId === 'function' ? Editor.getPhantomNodeId(sid) : 'err_' + mermaidNodeId(sid))
          : mermaidNodeId(sid);
        if (!registered.has(nid)) {
          registered.add(nid);
          const cls = broken ? 'miniErr' : (kind === 'in' ? 'miniIn' : 'miniOut');
          lines.push(`  ${nid}["${sanitizeLabel(sid)}"]:::${cls}`);
          if (scenes[sid]) {
            sceneIds.add(sid);
            const safe = String(sid).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            clickLines.push(`  click ${nid} call Editor.openSceneFromGraph("${safe}")`);
          }
        }
        return { nid, broken };
      };

      collectOutgoing(scene, scenes).forEach((edge) => {
        if (!edge.to) return;
        const { nid, broken } = ensureNode(edge.to, 'out');
        if (broken) {
          lines.push(`  ${centerNode} -.->|"⚠"| ${nid}`);
        } else if (typeof Editor.formatMermaidEdgeLine === 'function') {
          lines.push(Editor.formatMermaidEdgeLine(centerNode, nid, edge.label));
        } else {
          lines.push(`  ${centerNode} --> ${nid}`);
        }
      });

      collectIncoming(sceneId, scenes).forEach((edge) => {
        const { nid, broken } = ensureNode(edge.fromId, 'in');
        if (broken) {
          lines.push(`  ${nid} -.->|"⚠"| ${centerNode}`);
        } else if (typeof Editor.formatMermaidEdgeLine === 'function') {
          lines.push(Editor.formatMermaidEdgeLine(nid, centerNode, edge.label || '←'));
        } else {
          lines.push(`  ${nid} --> ${centerNode}`);
        }
      });

      const safeCenter = String(sceneId).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      clickLines.push(`  click ${centerNode} call Editor.openSceneFromGraph("${safeCenter}")`);

      return {
        code: lines.concat(clickLines).join('\n'),
        sceneIds: [...sceneIds]
      };
    },

    renderMiniGraphFallback(sceneId, mount, fallbackEl) {
      const scenes = this.data?.scenes || {};
      const scene = scenes[sceneId];
      if (!scene) {
        fallbackEl.innerHTML = '<p class="hint">Сцена не найдена.</p>';
        mount.innerHTML = '';
        return;
      }

      const out = collectOutgoing(scene, scenes);
      const inc = collectIncoming(sceneId, scenes);

      const link = (id, broken) => {
        const cls = broken ? ' style="color:#e53935"' : '';
        const js = `Editor.openSceneFromGraph(${JSON.stringify(id)})`;
        return `<a href="#"${cls} onclick="event.preventDefault();${js}">${this.escapeHtml(id)}</a>`;
      };

      let html = '<p><strong>Исходящие:</strong> ';
      html += out.length
        ? out.map(e => link(e.to, e.broken)).join(', ')
        : '<span class="hint">нет</span>';
      html += '</p><p><strong>Входящие:</strong> ';
      html += inc.length
        ? inc.map(e => `${link(e.fromId, e.broken)} →`).join(' ')
        : '<span class="hint">нет</span>';
      html += '</p>';

      fallbackEl.innerHTML = html;
      mount.innerHTML = '';
    },

    async renderMiniGraph(sceneId) {
      const panel = document.getElementById('mini-graph-container');
      const mount = document.getElementById('mini-graph-svg');
      const fallback = document.getElementById('mini-graph-fallback');
      if (!panel || !mount || !fallback) return;

      if (!sceneId || !this.data?.scenes?.[sceneId]) {
        mount.innerHTML = '';
        fallback.innerHTML = '<p class="hint">Выберите сцену для отображения связей.</p>';
        return;
      }

      const { code } = this.buildMiniGraphMermaid(sceneId);
      if (!code) {
        fallback.innerHTML = '<p class="hint">Нет связей для отображения.</p>';
        mount.innerHTML = '';
        return;
      }

      if (typeof mermaid === 'undefined' || typeof Editor.ensureMermaid !== 'function' || !Editor.ensureMermaid()) {
        this.renderMiniGraphFallback(sceneId, mount, fallback);
        return;
      }

      fallback.innerHTML = '';
      const renderId = 'mini_graph_' + (++this._miniGraphRenderId);
      try {
        const { svg, bindFunctions } = await mermaid.render(renderId, code);
        mount.innerHTML = svg;
        if (typeof bindFunctions === 'function') bindFunctions(mount);
      } catch (err) {
        console.warn('[mini-graph] Mermaid render failed:', err);
        this.renderMiniGraphFallback(sceneId, mount, fallback);
      }
    },

    ensureMiniGraphContainer() {
      const pane = document.querySelector('.scenes-editor-pane');
      if (!pane || pane.querySelector('#mini-graph-container')) return;

      const panel = document.createElement('div');
      panel.id = 'mini-graph-container';
      panel.className = 'mini-graph-panel';
      panel.innerHTML = `
        <h4>🔗 Связи сцены (мини-граф)</h4>
        <p class="hint" style="margin:0 0 8px;font-size:12px;">Жёлтый — текущая, зелёный — исходящие, синий — входящие, красный пунктир — битая ссылка. Клик по узлу открывает сцену.</p>
        <div class="mini-graph-svg" id="mini-graph-svg"></div>
        <div class="mini-graph-fallback" id="mini-graph-fallback"></div>`;

      const choicesSection = pane.querySelector('.choices-section');
      if (choicesSection) {
        choicesSection.insertAdjacentElement('afterend', panel);
      } else {
        pane.appendChild(panel);
      }
    },

    scheduleMiniGraphUpdate() {
      clearTimeout(this._miniGraphTimer);
      this._miniGraphTimer = setTimeout(() => {
        if (this.currentScene && this.currentTab === 'scenes') {
          this.renderMiniGraph(this.currentScene);
        }
      }, 500);
    }
  });

  const origRenderSceneEditor = Editor.renderSceneEditor.bind(Editor);
  Editor.renderSceneEditor = function () {
    origRenderSceneEditor();
    if (!this.currentScene || !this.data?.scenes?.[this.currentScene]) {
      const panel = document.getElementById('mini-graph-container');
      if (panel) {
        const svg = document.getElementById('mini-graph-svg');
        const fb = document.getElementById('mini-graph-fallback');
        if (svg) svg.innerHTML = '';
        if (fb) fb.innerHTML = '';
      }
      return;
    }
    this.ensureMiniGraphContainer();
    this.scheduleMiniGraphUpdate();
  };

  const origSelectScene = Editor.selectScene.bind(Editor);
  Editor.selectScene = function (id) {
    origSelectScene(id);
    this.scheduleMiniGraphUpdate();
  };

  const origUpdateJSONPreview = Editor.updateJSONPreview.bind(Editor);
  Editor.updateJSONPreview = function () {
    origUpdateJSONPreview();
    this.scheduleMiniGraphUpdate();
  };

  const origSwitchTab = Editor.switchTab.bind(Editor);
  Editor.switchTab = function (tab, event) {
    origSwitchTab(tab, event);
    if (tab === 'scenes' && this.currentScene) {
      this.scheduleMiniGraphUpdate();
    }
  };
})();
