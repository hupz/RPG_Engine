// ============================================================
// Редактируемый граф сцен (Twine-like): связи = choices[].to
// ============================================================
(function attachEditableStoryGraph() {
  if (typeof Editor === 'undefined') {
    console.warn('editor-story-graph-edit.js: Editor не определён');
    return;
  }

  const NODE_W = 200;
  const NODE_H = 70;
  const PORT = 14;

  Object.assign(Editor, {
    _sg: {
      positions: {},
      panX: 0,
      panY: 0,
      scale: 1,
      drag: null,
      selectedEdge: null, // { fromId, choiceIndex, toId, kind }
      selectedNode: null,
      linkPreview: null
    },

    ensureStoryGraphMeta() {
      if (!this.data) return null;
      if (!this.data.meta) this.data.meta = {};
      if (!this.data.meta.storyGraph) this.data.meta.storyGraph = { positions: {} };
      if (!this.data.meta.storyGraph.positions) this.data.meta.storyGraph.positions = {};
      return this.data.meta.storyGraph;
    },

    getStoryGraphPositions() {
      const meta = this.ensureStoryGraphMeta();
      return meta ? meta.positions : {};
    },

    setStoryGraphNodePos(sceneId, x, y) {
      const pos = this.getStoryGraphPositions();
      pos[sceneId] = { x: Math.round(x), y: Math.round(y) };
    },

    /**
     * Модель: узлы + рёбра из choices / nextScene
     */
    buildEditableGraphModel() {
      const scenes = this.data?.scenes || {};
      const ids = Object.keys(scenes);
      const positions = this.getStoryGraphPositions();
      const nodes = [];
      const edges = [];

      // auto-layout missing positions in a grid
      let gi = 0;
      const cols = Math.max(3, Math.ceil(Math.sqrt(ids.length || 1)));
      ids.forEach((id) => {
        const sc = scenes[id];
        let p = positions[id];
        if (!p || p.x == null) {
          const col = gi % cols;
          const row = Math.floor(gi / cols);
          p = { x: 40 + col * (NODE_W + 100), y: 40 + row * (NODE_H + 90) };
          positions[id] = p;
          gi++;
        }
        const combat = typeof this.hasSceneCombat === 'function'
          ? this.hasSceneCombat(sc)
          : !!(sc.combat && (Array.isArray(sc.combat) ? sc.combat.length : true));
        const hasQuest = (sc.choices || []).some((c) => c?.questSet?.questId);
        nodes.push({
          id,
          label: sc.location || sc.title || id,
          x: p.x,
          y: p.y,
          combat,
          quest: hasQuest,
          orphan: false
        });
      });

      ids.forEach((fromId) => {
        const sc = scenes[fromId];
        (sc.choices || []).forEach((c, ci) => {
          if (!c) return;
          const to = c.to || c.nextScene;
          if (!to) return;
          edges.push({
            fromId,
            toId: to,
            choiceIndex: ci,
            label: (c.text || '→').slice(0, 28),
            broken: !scenes[to],
            kind: 'choice'
          });
        });
        if (sc.nextScene) {
          edges.push({
            fromId,
            toId: sc.nextScene,
            choiceIndex: -1,
            label: 'после боя',
            broken: !scenes[sc.nextScene],
            kind: 'nextScene'
          });
        }
      });

      return { nodes, edges };
    },

    renderStoryGraphPanel() {
      const c = document.getElementById('story-graph-editor');
      if (!c) return;
      if (!this.data?.scenes || !Object.keys(this.data.scenes).length) {
        c.innerHTML = '<div class="empty-state"><h2>Нет сцен</h2><p class="hint">Создайте сцену — она появится на карте.</p></div>';
        return;
      }

      const sceneCount = Object.keys(this.data.scenes).length;
      c.innerHTML = `
        <div class="story-graph-panel sg-edit-panel">
          <div class="story-graph-toolbar">
            <div>
              <h2>🗺️ Карта сюжета</h2>
              <p class="hint">Сцен: ${sceneCount}. Тяните <strong>от кружка справа</strong> узла к другому — создаётся выбор.
                Двойной клик по сцене — открыть редактор. Клик по стрелке — изменить текст связи.</p>
            </div>
            <div class="sg-toolbar-actions">
              <button type="button" class="btn btn-secondary" onclick="Editor.storyGraphZoom(0.85)" title="Мельче">−</button>
              <button type="button" class="btn btn-secondary" onclick="Editor.storyGraphZoom(1.15)" title="Крупнее">+</button>
              <button type="button" class="btn btn-secondary" onclick="Editor.storyGraphZoomReset()">100%</button>
              <button type="button" class="btn btn-secondary" onclick="Editor.autoLayoutStoryGraph()">▦ Сетка</button>
              <button type="button" class="btn btn-secondary" onclick="Editor.openSceneWizard(); Editor.renderStoryGraphPanel?.();">+ Сцена</button>
              <button type="button" class="btn btn-primary" onclick="Editor.renderEditableStoryGraph()">🔄 Обновить</button>
            </div>
          </div>
          <div class="sg-workspace">
            <div id="sg-canvas-wrap" class="sg-canvas-wrap">
              <svg id="sg-canvas" class="sg-canvas" xmlns="http://www.w3.org/2000/svg"></svg>
            </div>
            <aside id="sg-side" class="sg-side">
              <p class="hint">Выберите связь или узел</p>
            </aside>
          </div>
        </div>`;

      this.renderEditableStoryGraph();
      this._bindStoryGraphEvents();
    },

    renderEditableStoryGraph() {
      const svg = document.getElementById('sg-canvas');
      if (!svg) return;
      const model = this.buildEditableGraphModel();
      this._sg.model = model;
      const s = this._sg;

      let maxX = 400;
      let maxY = 300;
      model.nodes.forEach((n) => {
        maxX = Math.max(maxX, n.x + NODE_W + 80);
        maxY = Math.max(maxY, n.y + NODE_H + 80);
      });
      const width = Math.max(maxX, 900);
      const height = Math.max(maxY, 600);
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');

      const edgesHtml = model.edges.map((e, ei) => {
        const from = model.nodes.find((n) => n.id === e.fromId);
        const to = model.nodes.find((n) => n.id === e.toId);
        if (!from) return '';
        const x1 = from.x + NODE_W;
        const y1 = from.y + NODE_H / 2;
        let x2;
        let y2;
        if (to) {
          x2 = to.x;
          y2 = to.y + NODE_H / 2;
        } else {
          x2 = x1 + 100;
          y2 = y1;
        }
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const sel = s.selectedEdge &&
          s.selectedEdge.fromId === e.fromId &&
          s.selectedEdge.choiceIndex === e.choiceIndex;
        const cls = 'sg-edge' + (e.broken ? ' sg-edge-broken' : '') + (sel ? ' sg-edge-selected' : '');
        const path = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
        return `<g class="${cls}" data-edge-i="${ei}" data-from="${this.escapeAttr(e.fromId)}" data-to="${this.escapeAttr(e.toId || '')}" data-ci="${e.choiceIndex}">
          <path class="sg-edge-hit" d="${path}" />
          <path class="sg-edge-line" d="${path}" marker-end="url(#sg-arrow)" />
          <title>${this.escapeHtml(e.label)}</title>
          <text class="sg-edge-label" x="${mx}" y="${my - 6}">${this.escapeHtml(e.label)}</text>
        </g>`;
      }).join('');

      const nodesHtml = model.nodes.map((n) => {
        const cls = 'sg-node' +
          (n.combat ? ' sg-node-combat' : '') +
          (n.quest ? ' sg-node-quest' : '') +
          (s.selectedNode === n.id ? ' sg-node-selected' : '');
        return `<g class="${cls}" data-node-id="${this.escapeAttr(n.id)}" transform="translate(${n.x},${n.y})">
          <rect class="sg-node-body" width="${NODE_W}" height="${NODE_H}" rx="8" ry="8" />
          <text class="sg-node-title" x="14" y="28">${this.escapeHtml(n.label.slice(0, 22))}</text>
          <text class="sg-node-id" x="14" y="50">${this.escapeHtml(n.id.slice(0, 24))}</text>
          <circle class="sg-port sg-port-out" cx="${NODE_W}" cy="${NODE_H / 2}" r="${PORT}" />
        </g>`;
      }).join('');

      let preview = '';
      if (s.linkPreview) {
        const { x1, y1, x2, y2 } = s.linkPreview;
        preview = `<path class="sg-link-preview" d="M${x1},${y1} L${x2},${y2}" />`;
      }

      svg.innerHTML = `
        <defs>
          <marker id="sg-arrow" markerWidth="10" markerHeight="10" refX="8" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="var(--accent, #8b4513)" />
          </marker>
        </defs>
        <g class="sg-world">
          ${edgesHtml}
          ${preview}
          ${nodesHtml}
        </g>`;
      this._applyStoryGraphScale?.();
    },

    _bindStoryGraphEvents() {
      const wrap = document.getElementById('sg-canvas-wrap');
      const svg = document.getElementById('sg-canvas');
      if (!wrap || !svg || wrap._sgBound) return;
      wrap._sgBound = true;

      const toLocal = (evt) => {
        const pt = svg.createSVGPoint();
        pt.x = evt.clientX;
        pt.y = evt.clientY;
        const ctm = svg.getScreenCTM();
        if (!ctm) return { x: 0, y: 0 };
        const p = pt.matrixTransform(ctm.inverse());
        return { x: p.x, y: p.y };
      };

      svg.addEventListener('mousedown', (e) => {
        const port = e.target.closest('.sg-port-out');
        const node = e.target.closest('.sg-node');
        const edge = e.target.closest('.sg-edge');
        const local = toLocal(e);
        const touchUi = typeof Editor.isTouchUi === 'function' && Editor.isTouchUi();

        if (port && node && !touchUi) {
          e.preventDefault();
          e.stopPropagation();
          const id = node.getAttribute('data-node-id');
          const n = this._sg.model.nodes.find((x) => x.id === id);
          this._sg.drag = { type: 'link', fromId: id };
          this._sg.linkPreview = {
            x1: n.x + NODE_W,
            y1: n.y + NODE_H / 2,
            x2: local.x,
            y2: local.y
          };
          this.renderEditableStoryGraph();
          return;
        }

        if (edge) {
          e.preventDefault();
          const fromId = edge.getAttribute('data-from');
          const ci = parseInt(edge.getAttribute('data-ci'), 10);
          const edgeMeta = (this._sg.model?.edges || [])[parseInt(edge.getAttribute('data-edge-i'), 10)];
          this._sg.selectedEdge = {
            fromId,
            choiceIndex: ci,
            toId: edgeMeta?.toId || null,
            kind: edgeMeta?.kind || 'choice'
          };
          this._sg.selectedNode = null;
          this.renderEditableStoryGraph();
          this.renderStoryGraphSidePanel();
          return;
        }

        if (node) {
          e.preventDefault();
          const id = node.getAttribute('data-node-id');
          const n = this._sg.model.nodes.find((x) => x.id === id);

          if (touchUi) {
            if (this._sg._moveModeId === id) {
              this._sg.drag = { type: 'node', id, ox: local.x - n.x, oy: local.y - n.y };
              this._sg.selectedNode = id;
              this._sg.selectedEdge = null;
              return;
            }
            this._sg.selectedNode = id;
            this._sg.selectedEdge = null;
            if (typeof Editor.renderStoryGraphTouchActions === 'function') {
              Editor.renderStoryGraphTouchActions(id);
            } else {
              this.renderStoryGraphSidePanel();
            }
            return;
          }

          this._sg.drag = {
            type: 'node',
            id,
            ox: local.x - n.x,
            oy: local.y - n.y
          };
          this._sg.selectedNode = id;
          this._sg.selectedEdge = null;
          this.renderStoryGraphSidePanel();
          return;
        }

        this._sg.selectedEdge = null;
        this._sg.selectedNode = null;
        this.renderStoryGraphSidePanel();
      });

      svg.addEventListener('mousemove', (e) => {
        const d = this._sg.drag;
        if (!d) return;
        const local = toLocal(e);
        if (d.type === 'node') {
          const x = local.x - d.ox;
          const y = local.y - d.oy;
          this.setStoryGraphNodePos(d.id, x, y);
          const n = this._sg.model.nodes.find((x) => x.id === d.id);
          if (n) {
            n.x = x;
            n.y = y;
          }
          this.renderEditableStoryGraph();
        } else if (d.type === 'link') {
          const from = this._sg.model.nodes.find((x) => x.id === d.fromId);
          this._sg.linkPreview = {
            x1: from.x + NODE_W,
            y1: from.y + NODE_H / 2,
            x2: local.x,
            y2: local.y
          };
          this.renderEditableStoryGraph();
        }
      });

      const endDrag = (e) => {
        const d = this._sg.drag;
        if (!d) return;
        if (d.type === 'link') {
          const el = document.elementFromPoint(e.clientX, e.clientY);
          const node = el && el.closest ? el.closest('.sg-node') : null;
          const toId = node && node.getAttribute('data-node-id');
          if (toId && toId !== d.fromId) {
            this.createStoryGraphLink(d.fromId, toId);
          }
          this._sg.linkPreview = null;
        }
        if (d.type === 'node') {
          this.updateJSONPreview();
        }
        this._sg.drag = null;
        this.renderEditableStoryGraph();
        this.renderStoryGraphSidePanel();
      };

      if (!Editor._sgDocBound) {
        Editor._sgDocBound = true;
        document.addEventListener('mouseup', (ev) => {
          if (typeof Editor._sgEndDrag === 'function') Editor._sgEndDrag(ev);
        });
        document.addEventListener('mousemove', (ev) => {
          if (typeof Editor._sgMoveDrag === 'function') Editor._sgMoveDrag(ev);
        });
      }
      this._sgEndDrag = endDrag;

      wrap.addEventListener('wheel', (e) => {
        if (!e.ctrlKey && !e.metaKey) return; // Ctrl+колесо = зум
        e.preventDefault();
        this.storyGraphZoom(e.deltaY > 0 ? 0.9 : 1.1);
      }, { passive: false });

      svg.addEventListener('dblclick', (e) => {
        const node = e.target.closest('.sg-node');
        if (!node) return;
        const id = node.getAttribute('data-node-id');
        if (typeof this.openSceneFromGraph === 'function') {
          this.openSceneFromGraph(id);
        } else {
          this.currentScene = id;
          this.switchTab?.('scenes');
          this.renderSceneEditor?.();
        }
      });
    },

    createStoryGraphLink(fromId, toId) {
      const scene = this.data?.scenes?.[fromId];
      if (!scene || !this.data.scenes[toId]) return;
      if (!Array.isArray(scene.choices)) scene.choices = [];
      const label = this.data.scenes[toId].location || toId;
      scene.choices.push({
        text: 'К: ' + label,
        to: toId,
        icon: '➡️'
      });
      // ensure modules
      if (typeof this.ensureSceneEditorModules === 'function') {
        this.ensureSceneEditorModules(scene);
        if (scene.editorModules && !scene.editorModules.includes('choices')) {
          scene.editorModules.push('choices');
        }
      }
      this._sg.selectedEdge = { fromId, choiceIndex: scene.choices.length - 1 };
      this.updateJSONPreview();
      this.renderEditableStoryGraph();
      this.renderStoryGraphSidePanel();
    },

    updateStoryGraphEdgeLabel(fromId, choiceIndex, text) {
      const c = this.data?.scenes?.[fromId]?.choices?.[choiceIndex];
      if (!c) return;
      c.text = text;
      this.updateJSONPreview();
      this.renderEditableStoryGraph();
    },

    updateStoryGraphEdgeTarget(fromId, choiceIndex, toId) {
      const c = this.data?.scenes?.[fromId]?.choices?.[choiceIndex];
      if (!c) return;
      if (!toId) delete c.to;
      else c.to = toId;
      this.updateJSONPreview();
      this.renderEditableStoryGraph();
      this.renderStoryGraphSidePanel();
    },

    async deleteStoryGraphEdge(fromId, choiceIndex, toId) {
      const scene = this.data?.scenes?.[fromId];
      if (!scene) {
        Editor.toast.warning('Сцена не найдена: ' + fromId);
        return;
      }

      // nextScene-связь
      if (choiceIndex < 0 || (this._sg.selectedEdge && this._sg.selectedEdge.kind === 'nextScene')) {
        if (scene.nextScene != null) {
          if (!(await Editor.confirmDialog({ message: 'Убрать переход «после боя» (nextScene)?' }))) return;
          delete scene.nextScene;
          this._sg.selectedEdge = null;
          try { this.updateJSONPreview?.(); } catch (e) { /* */ }
          this.renderEditableStoryGraph();
          this.renderStoryGraphSidePanel();
        }
        return;
      }

      if (!Array.isArray(scene.choices)) scene.choices = [];
      let idx = choiceIndex;
      // если индекс устарел — ищем по toId
      if (idx < 0 || idx >= scene.choices.length || (toId && scene.choices[idx]?.to !== toId && scene.choices[idx]?.nextScene !== toId)) {
        if (toId) {
          idx = scene.choices.findIndex((c) => c && (c.to === toId || c.nextScene === toId));
        }
      }
      if (idx < 0 || idx >= scene.choices.length) {
        Editor.toast.warning('Не удалось найти выбор для удаления. Откройте сцену и удалите выбор в редакторе.');
        return;
      }
      const label = scene.choices[idx]?.text || toId || '';
      if (!(await Editor.confirmDialog({ message: 'Удалить связь «' + label + '»?', danger: true }))) return;
      scene.choices.splice(idx, 1);
      this._sg.selectedEdge = null;
      try { this.updateJSONPreview?.(); } catch (e) { console.warn(e); }
      this.renderEditableStoryGraph();
      this.renderStoryGraphSidePanel();
    },

    autoLayoutStoryGraph() {
      const ids = Object.keys(this.data?.scenes || {});
      const cols = Math.max(3, Math.ceil(Math.sqrt(ids.length || 1)));
      ids.forEach((id, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        this.setStoryGraphNodePos(id, 40 + col * (NODE_W + 100), 40 + row * (NODE_H + 90));
      });
      this.updateJSONPreview();
      this.renderEditableStoryGraph();
    },

    renderStoryGraphSidePanel() {
      const side = document.getElementById('sg-side');
      if (!side) return;
      const se = this._sg.selectedEdge;
      const sn = this._sg.selectedNode;

      if (se && se.choiceIndex >= 0) {
        const c = this.data.scenes[se.fromId]?.choices?.[se.choiceIndex];
        if (!c) {
          side.innerHTML = '<p class="hint">Связь не найдена</p>';
          return;
        }
        const opts = Object.keys(this.data.scenes).map((id) => {
          const loc = this.data.scenes[id]?.location || id;
          const sel = c.to === id ? ' selected' : '';
          return `<option value="${this.escapeAttr(id)}"${sel}>${this.escapeHtml(loc)}</option>`;
        }).join('');
        side.innerHTML = `
          <h4>Связь (выбор)</h4>
          <p class="hint">Из <strong>${this.escapeHtml(this.data.scenes[se.fromId]?.location || se.fromId)}</strong></p>
          <div class="form-group"><label>Текст кнопки</label>
            <input type="text" value="${this.escapeAttr(c.text || '')}"
              onchange="Editor.updateStoryGraphEdgeLabel(${JSON.stringify(se.fromId)},${se.choiceIndex},this.value)"></div>
          <div class="form-group"><label>Куда ведёт</label>
            <select onchange="Editor.updateStoryGraphEdgeTarget(${JSON.stringify(se.fromId)},${se.choiceIndex},this.value)">
              <option value="">— не задано —</option>${opts}
            </select></div>
          <button type="button" class="btn btn-danger" style="width:100%;margin-top:8px;"
            data-action="delete-story-edge" data-from="${this.escapeAttr(se.fromId)}" data-ci="${se.choiceIndex}" data-to="${this.escapeAttr(se.toId || c.to || '')}" onclick="Editor.deleteStoryGraphEdge(${JSON.stringify(se.fromId)},${se.choiceIndex},${JSON.stringify(se.toId || c.to || '')})">Удалить связь</button>
          <button type="button" class="btn btn-secondary" style="width:100%;margin-top:6px;"
            onclick="Editor.openSceneFromGraph(${JSON.stringify(se.fromId)})">Открыть сцену</button>`;
        return;
      }

      if (se && (se.choiceIndex < 0 || se.kind === 'nextScene')) {
        side.innerHTML = `
          <h4>После боя</h4>
          <p class="hint">Связь <code>nextScene</code> сцены «${this.escapeHtml(se.fromId)}».</p>
          <button type="button" class="btn btn-danger" style="width:100%;margin-top:8px;"
            data-action="delete-story-edge" data-from="${this.escapeAttr(se.fromId)}" data-ci="-1" data-to="${this.escapeAttr(se.toId || '')}" onclick="Editor.deleteStoryGraphEdge(${JSON.stringify(se.fromId)},-1,${JSON.stringify(se.toId || '')})">Убрать nextScene</button>
          <button type="button" class="btn btn-secondary" style="width:100%;margin-top:6px;"
            onclick="Editor.openSceneFromGraph(${JSON.stringify(se.fromId)})">Открыть сцену</button>`;
        return;
      }

      if (sn && this.data.scenes[sn]) {
        const sc = this.data.scenes[sn];
        const outs = (sc.choices || []).filter((c) => c && c.to).length;
        side.innerHTML = `
          <h4>${this.escapeHtml(sc.location || sn)}</h4>
          <p class="hint">ID: <code>${this.escapeHtml(sn)}</code></p>
          <p class="hint">Выходов: ${outs}</p>
          <button type="button" class="btn btn-primary" style="width:100%;"
            onclick="Editor.openSceneFromGraph(${JSON.stringify(sn)})">Открыть сцену</button>
          <p class="hint" style="margin-top:12px;">Потяните кружок справа → на другую сцену, чтобы добавить переход.</p>`;
        return;
      }

      side.innerHTML = `
        <h4>Как пользоваться</h4>
        <ul class="hint" style="padding-left:18px;margin:8px 0;">
          <li>Кружок справа у сцены → другая сцена = новый выбор</li>
          <li>Клик по стрелке — текст кнопки и цель</li>
          <li>Двойной клик по сцене — редактор</li>
          <li>Перетаскивание сцены — расположение на карте</li>
        </ul>`;
    },

    // Совместимость: старый вызов «Обновить граф»
    renderStoryGraph() {
      this.renderEditableStoryGraph();
    }
  });

  // Зафиксировать панель через hooks (после editor-graph.js)
  if (Editor.hooks && typeof Editor.hooks.replace === 'function') {
    const panelFn = Editor.renderStoryGraphPanel.bind(Editor);
    const graphFn = Editor.renderStoryGraph.bind(Editor);
    Editor.hooks.replace('renderStoryGraphPanel', function () { return panelFn(); });
    Editor.hooks.replace('renderStoryGraph', function () { return graphFn(); });
  }

  if (typeof document !== 'undefined' && !document.getElementById('sg-edit-styles')) {
    const st = document.createElement('style');
    st.id = 'sg-edit-styles';
    st.textContent = `
      .sg-workspace { display:flex; gap:12px; align-items:stretch; min-height:520px; }
      .sg-canvas-wrap {
        flex:1; min-width:0; border:1px solid var(--border,#ccc); border-radius:8px;
        background: repeating-linear-gradient(0deg, transparent, transparent 24px, rgba(0,0,0,0.04) 25px),
                    repeating-linear-gradient(90deg, transparent, transparent 24px, rgba(0,0,0,0.04) 25px),
                    var(--paper,#f5f0e8);
        overflow:auto; height:min(78vh, 820px);
      }
      .sg-canvas { display:block; min-width:100%; min-height:100%; }
      .sg-side {
        flex:0 0 280px; border:1px solid var(--border,#ccc); border-radius:8px;
        padding:14px; background:var(--card-bg,#fff); overflow:auto; max-height:min(78vh,820px);
        font-size:14px;
      }
      .sg-side .btn { font-size:14px; padding:10px 12px; }
      .sg-node-body { fill: var(--card-bg,#fff); stroke: var(--border-dark,#a89880); stroke-width:2.5; cursor:grab; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.08)); }
      .sg-node-combat .sg-node-body { stroke: #c45c26; fill:#fff5f0; }
      .sg-node-quest .sg-node-body { stroke: #2a6f97; fill:#f0f7fc; }
      .sg-node-selected .sg-node-body { stroke: var(--accent,#8b4513); stroke-width:3.5; }
      .sg-node-title { font-size:14px; font-weight:700; fill:var(--ink,#2c2418); pointer-events:none; }
      .sg-node-id { font-size:11px; fill:var(--ink-light,#5d5247); pointer-events:none; }
      .sg-port-out { fill: var(--accent,#8b4513); stroke:#fff; stroke-width:2.5; cursor:crosshair; }
      .sg-edge-line { fill:none; stroke:var(--accent,#8b4513); stroke-width:2.5; pointer-events:none; }
      .sg-edge-hit { fill:none; stroke:transparent; stroke-width:18; cursor:pointer; }
      .sg-edge-selected .sg-edge-line { stroke:#c45c26; stroke-width:4; }
      .sg-edge-broken .sg-edge-line { stroke:#c62828; stroke-dasharray:6 4; }
      .sg-edge-label { font-size:12px; fill:var(--ink,#2c2418); text-anchor:middle; pointer-events:none; font-weight:600; }
      .sg-link-preview { fill:none; stroke:var(--accent,#8b4513); stroke-width:2; stroke-dasharray:5 4; pointer-events:none; }
      .sg-toolbar-actions { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
      @media (max-width:900px) {
        .sg-workspace { flex-direction:column; }
        .sg-side { flex:none; max-height:200px; }
      }
    `;
    document.head.appendChild(st);
  }
})();
