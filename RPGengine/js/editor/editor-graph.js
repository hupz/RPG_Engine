// ============================================
// Карта сюжета: визуализация связей сцен (Mermaid)
// ============================================

(function attachEditorGraph() {
  if (typeof Editor === 'undefined') {
    console.error('editor-graph.js: Editor не определён');
    return;
  }

  const SKILL_LABELS = {
    perception: 'Восприятие',
    stealth: 'Скрытность',
    strength: 'Сила',
    dexterity: 'Ловкость',
    acrobatics: 'Акробатика',
    athletics: 'Атлетика',
    intimidation: 'Запугивание',
    persuasion: 'Убеждение',
    insight: 'Проницательность',
    investigation: 'Расследование'
  };

  let mermaidReady = false;

  Object.assign(Editor, {
    _graphSearchId: '',

    /** Подпись узла на графе (локация или id) */
    getSceneGraphLabel(scene, sceneId) {
      const raw = (scene?.location || scene?.id || sceneId || '').trim();
      const text = raw || sceneId;
      return text.length > 42 ? text.slice(0, 39) + '…' : text;
    },

    formatSkillName(skill) {
      const key = String(skill || '').toLowerCase();
      return SKILL_LABELS[key] || key || '?';
    },

    /** Первые 100 символов текста сцены для подсказки */
    getScenePreviewText(scene) {
      let raw = scene?.text || '';
      if (!raw && Array.isArray(scene?.dialogue) && scene.dialogue.length) {
        raw = scene.dialogue
          .map(d => (typeof d === 'string' ? d : d?.text || d?.line || ''))
          .join(' ');
      }
      raw = String(raw).replace(/\s+/g, ' ').trim();
      if (!raw) return '(нет текста)';
      return raw.length > 100 ? raw.slice(0, 100) + '…' : raw;
    },

    hasSceneCombat(scene) {
      const c = scene?.combat;
      if (c == null || c === false) return false;
      if (Array.isArray(c)) return c.length > 0;
      if (typeof c === 'object') return Object.keys(c).length > 0;
      return Boolean(c);
    },

    /** На сцене заданы questStages */
    hasSceneQuestStages(scene) {
      const qs = scene?.questStages;
      if (qs == null) return false;
      if (Array.isArray(qs)) return qs.length > 0;
      if (typeof qs === 'object') return Object.keys(qs).length > 0;
      return Boolean(qs);
    },

    /** Есть ли у сцены выходы: choices, skillCheck, win/loss, nextScene */
    hasSceneExits(scene) {
      if (scene?.win != null || scene?.loss != null) return true;
      if (scene?.nextScene) return true;

      const choices = scene?.choices || [];
      if (!choices.length) return false;

      return choices.some(c => {
        if (c?.win != null || c?.loss != null) return true;
        if (c?.skillCheck) return true;
        if (c?.to) return true;
        if (c?.nextScene) return true;
        return false;
      });
    },

    /** Финал: нет choices/skillCheck/win/loss-выходов */
    isFinalScene(scene) {
      return !this.hasSceneExits(scene);
    },

    /** Классы Mermaid для узла — строки `class id combat` в конце code */
    getSceneClassLines(nodeId, sceneId, { combat, quest, final, orphans }) {
      const lines = [];
      if (orphans?.has(sceneId)) lines.push(`  class ${nodeId} orphanNode`);
      if (combat?.has(sceneId)) lines.push(`  class ${nodeId} combat`);
      if (quest?.has(sceneId)) lines.push(`  class ${nodeId} quest`);
      if (final?.has(sceneId)) lines.push(`  class ${nodeId} final`);
      return lines;
    },

    /** classDef в начале mermaid-кода (сразу после flowchart TD) */
    getMermaidStyleDefs() {
      return [
        'classDef combat fill:#f96,stroke:#333,stroke-width:2px',
        'classDef quest fill:#69f,stroke:#05a,color:#fff',
        'classDef final fill:#fd2,stroke:#a80,stroke-width:2px',
        'classDef orphanNode fill:#e1bee7,stroke:#7b1fa2,stroke-width:3px,color:#333',
        'classDef brokenNode fill:#ffcdd2,stroke:#d32f2f,stroke-width:2px,color:#b71c1c',
        'classDef deadEndNode fill:#fff3e0,stroke:#e65100,stroke-width:2px,stroke-dasharray:4 4,color:#333'
      ];
    },

    isBrokenSceneTarget(targetId, scenes) {
      if (!targetId) return false;
      const sceneIds = new Set(Object.keys(scenes || {}));
      if (typeof this.isValidSceneTarget === 'function') {
        return !this.isValidSceneTarget(targetId, sceneIds);
      }
      if (targetId === 'reset') return false;
      return !scenes?.[targetId];
    },

    getPhantomNodeId(missingSceneId) {
      return 'err_' + this.mermaidNodeId(missingSceneId);
    },

    formatBrokenMermaidEdge(fromNode, missingId) {
      const phantom = this.getPhantomNodeId(missingId);
      const label = this.sanitizeMermaidLabel(`⚠ ${missingId}`);
      return {
        phantomNode: phantom,
        phantomLine: `  ${phantom}["${label}"]`,
        edgeLine: `  ${fromNode} -.->|"ERROR_NOT_FOUND"| ${phantom}`
      };
    },

    /** ID стартовой сцены для обхода графа */
    getGraphStartId() {
      const scenes = this.data?.scenes || {};
      if (scenes.start) return 'start';
      return Object.keys(scenes)[0] || null;
    },

    /**
     * Сцены, до которых нельзя добраться из start (BFS по тем же рёбрам, что на графе).
     */
    findOrphanScenes() {
      const scenes = this.data?.scenes || {};
      const ids = Object.keys(scenes);
      if (!ids.length) return [];

      const startId = this.getGraphStartId();
      if (!startId || !scenes[startId]) return ids.slice().sort();

      const reached = new Set([startId]);
      const queue = [startId];

      while (queue.length) {
        const id = queue.shift();
        const scene = scenes[id];
        if (!scene) continue;

        this.collectSceneEdges(scene, scenes).forEach(({ to }) => {
          if (!scenes[to] || reached.has(to)) return;
          reached.add(to);
          queue.push(to);
        });
      }

      return ids.filter(id => !reached.has(id)).sort();
    },

    /** Экранирование текста внутри узла Mermaid [...] */
    sanitizeMermaidLabel(text) {
      return String(text ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/"/g, "'")
        .replace(/\]/g, '›')
        .replace(/\[/g, '‹')
        .replace(/\n/g, ' ')
        .replace(/\r/g, '');
    },

    /** Подпись на стрелке (короче, без символов, ломающих синтаксис) */
    sanitizeMermaidEdgeLabel(text) {
      let s = this.sanitizeMermaidLabel(text)
        .replace(/\|/g, '/')
        .replace(/#/g, '')
        .replace(/-->/g, '→');
      if (s.length > 40) s = s.slice(0, 37) + '…';
      return s;
    },

    getChoiceEdgeLabel(choice) {
      const t = (choice?.text || '').trim();
      return t ? this.sanitizeMermaidEdgeLabel(t) : '→';
    },

    getSkillCheckEdgeLabel(skillCheck, outcome) {
      const skill = this.formatSkillName(skillCheck?.skill);
      const dc = skillCheck?.dc != null ? skillCheck.dc : '?';
      let label = `${skill} DC${dc}`;
      if (outcome === 'success') label += ' ✓';
      else if (outcome === 'fail') label += ' ✗';
      return this.sanitizeMermaidEdgeLabel(label);
    },

    /** Безопасный id узла Mermaid (латиница, цифры, _) */
    mermaidNodeId(sceneId) {
      const id = String(sceneId).replace(/[^a-zA-Z0-9_]/g, '_');
      return /^[0-9]/.test(id) ? 's_' + id : id;
    },

    _pushSceneEdge(edges, to, label, scenes) {
      if (!to) return;
      edges.push({
        to,
        label: label || '→',
        broken: this.isBrokenSceneTarget(to, scenes)
      });
    },

    /** Все переходы из сцены с подписями для стрелок */
    collectSceneEdges(scene, scenes = {}) {
      const edges = [];

      (scene?.choices || []).forEach(choice => {
        const sc = choice?.skillCheck;

        if (sc) {
          if (sc.successNext) {
            this._pushSceneEdge(edges, sc.successNext, this.getSkillCheckEdgeLabel(sc, 'success'), scenes);
          }
          if (sc.failNext) {
            this._pushSceneEdge(edges, sc.failNext, this.getSkillCheckEdgeLabel(sc, 'fail'), scenes);
          }
          if (!sc.successNext && !sc.failNext && choice.to) {
            this._pushSceneEdge(edges, choice.to, this.getSkillCheckEdgeLabel(sc, 'check'), scenes);
          }
        } else if (choice?.to) {
          this._pushSceneEdge(edges, choice.to, this.getChoiceEdgeLabel(choice), scenes);
        }

        if (choice?.nextScene && choice.nextScene !== choice?.to) {
          this._pushSceneEdge(edges, choice.nextScene, this.getChoiceEdgeLabel(choice), scenes);
        }
        if (choice?.winScene) {
          this._pushSceneEdge(edges, choice.winScene, this.sanitizeMermaidEdgeLabel('win'), scenes);
        }
        if (choice?.lossScene) {
          this._pushSceneEdge(edges, choice.lossScene, this.sanitizeMermaidEdgeLabel('loss'), scenes);
        }
      });

      if (scene?.nextScene) {
        this._pushSceneEdge(edges, scene.nextScene, this.sanitizeMermaidEdgeLabel('после боя'), scenes);
      }
      if (scene?.winScene) {
        this._pushSceneEdge(edges, scene.winScene, this.sanitizeMermaidEdgeLabel('win'), scenes);
      }
      if (scene?.lossScene) {
        this._pushSceneEdge(edges, scene.lossScene, this.sanitizeMermaidEdgeLabel('loss'), scenes);
      }

      return edges;
    },

    /** Все целевые id (для совместимости) */
    collectSceneTargets(scene, scenes) {
      return this.collectSceneEdges(scene, scenes).map(e => e.to);
    },

    formatMermaidEdgeLine(fromNode, toNode, label) {
      if (label) {
        const safe = this.sanitizeMermaidEdgeLabel(label);
        return `  ${fromNode} -->|"${safe}"| ${toNode}`;
      }
      return `  ${fromNode} --> ${toNode}`;
    },

    /**
     * Генерирует текст диаграммы Mermaid и метаданные для пост-обработки SVG.
     */
    buildMermaidFromScenes() {
      const scenes = this.data?.scenes || {};
      const ids = Object.keys(scenes);

      if (typeof this.validateProject === 'function') {
        this.validateProject();
      }

      if (!ids.length) {
        return {
          code: 'flowchart TD\n  empty["Нет сцен"]',
          meta: { sceneToNode: {}, tooltips: {}, combat: new Set(), quest: new Set(), final: new Set(), orphans: new Set(), deadEnds: new Set(), brokenLinks: [] }
        };
      }

      const idToNode = {};
      const sceneToNode = {};
      const tooltips = {};
      const combat = new Set();
      const quest = new Set();
      const final = new Set();
      const deadEnds = new Set();
      const orphans = new Set(this.findOrphanScenes());
      const phantomNodes = new Set();

      ids.forEach(sid => {
        const nid = this.mermaidNodeId(sid);
        idToNode[sid] = nid;
        sceneToNode[sid] = nid;
        const scene = scenes[sid];
        tooltips[sid] = this.getScenePreviewText(scene);

        if (this.hasSceneCombat(scene)) combat.add(sid);
        if (this.hasSceneQuestStages(scene)) quest.add(sid);
        if (this.isFinalScene(scene)) final.add(sid);
        if (typeof this.isDeadEndScene === 'function' && this.isDeadEndScene(scene)) deadEnds.add(sid);
      });

      const lines = ['flowchart TD'];
      const edgeLabels = new Map();
      const brokenEdgeLines = [];
      const clickLines = [];
      const classLines = [];

      this.getMermaidStyleDefs().forEach(def => lines.push(`  ${def}`));

      ids.forEach(fromId => {
        const scene = scenes[fromId];
        const fromNode = idToNode[fromId];
        const label = this.sanitizeMermaidLabel(this.getSceneGraphLabel(scene, fromId));
        lines.push(`  ${fromNode}["${label}"]`);

        this.collectSceneEdges(scene, scenes).forEach(({ to, label: edgeLabel, broken }) => {
          if (!to) return;

          if (broken || !scenes[to]) {
            const b = this.formatBrokenMermaidEdge(fromNode, to);
            if (!phantomNodes.has(to)) {
              lines.push(b.phantomLine);
              phantomNodes.add(to);
              classLines.push(`  class ${b.phantomNode} brokenNode`);
            }
            brokenEdgeLines.push(b.edgeLine);
            return;
          }

          const toNode = idToNode[to];
          const key = `${fromNode}-->${toNode}`;
          if (!edgeLabels.has(key)) edgeLabels.set(key, new Set());
          edgeLabels.get(key).add(edgeLabel || '→');
        });
      });

      edgeLabels.forEach((labels, key) => {
        const arrow = key.indexOf('-->');
        const fromNode = key.slice(0, arrow);
        const toNode = key.slice(arrow + 3);
        const combined = [...labels].join(' / ');
        lines.push(this.formatMermaidEdgeLine(fromNode, toNode, combined));
      });

      lines.push(...brokenEdgeLines);

      ids.forEach(sid => {
        const node = idToNode[sid];
        const safeArg = String(sid).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        clickLines.push(`  click ${node} call Editor.openSceneFromGraph("${safeArg}")`);
      });

      const classSets = { combat, quest, final, orphans };
      ids.forEach(sid => {
        classLines.push(...this.getSceneClassLines(idToNode[sid], sid, classSets));
        if (deadEnds.has(sid)) classLines.push(`  class ${idToNode[sid]} deadEndNode`);
      });

      lines.push(...clickLines, ...classLines);

      const code = lines.join('\n');
      const brokenLinks = this._lastValidation?.brokenLinks || [];

      return {
        code,
        meta: { sceneToNode, tooltips, combat, quest, final, orphans, deadEnds, brokenLinks }
      };
    },

    /** Инициализация Mermaid (один раз) */
    ensureMermaid() {
      if (typeof mermaid === 'undefined') {
        console.error('Mermaid.js не загружен');
        return false;
      }
      if (!mermaidReady) {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: 'neutral',
          flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' }
        });
        mermaidReady = true;
      }
      return true;
    },

    /** Панель вкладки «Карта сюжета» */
    renderStoryGraphPanel() {
      const c = document.getElementById('story-graph-editor');
      if (!c) return;

      if (!this.data?.scenes || !Object.keys(this.data.scenes).length) {
        c.innerHTML = '<div class="empty-state"><h2>Загрузите данные</h2><p class="hint">Откройте game_data.json, чтобы построить карту сюжета.</p></div>';
        return;
      }

      const sceneCount = Object.keys(this.data.scenes).length;
      const searchVal = this.escapeHtml(this._graphSearchId || '');
      const startId = this.escapeHtml(this.getGraphStartId() || 'start');
      c.innerHTML = `<div class="story-graph-panel">
        <div class="story-graph-toolbar">
          <div>
            <h2>🗺️ Карта сюжета</h2>
            <p class="hint">Сцен: ${sceneCount}. Оранжевый — бой, синий — questStages, золотой — финал без выходов. Фиолетовые — сироты (нет пути из <code>${startId}</code>).</p>
          </div>
          <button type="button" class="btn btn-primary" onclick="Editor.renderStoryGraph()">🔄 Обновить граф</button>
        </div>
        <div class="story-graph-search">
          <label for="story-graph-search-input">Поиск по ID сцены</label>
          <input type="text" id="story-graph-search-input" class="story-graph-search-input"
            placeholder="например: village" value="${searchVal}"
            oninput="Editor.onStoryGraphSearch(this.value)">
        </div>
        <div id="story-graph-mermaid" class="story-graph-mermaid"></div>
        <div id="story-graph-orphans" class="story-graph-orphans"></div>
      </div>`;

      this.renderStoryGraph();
    },

    /** Список сирот под графом */
    renderOrphanScenesList(orphanIds) {
      const el = document.getElementById('story-graph-orphans');
      if (!el) return;

      const startId = this.getGraphStartId() || 'start';

      if (!orphanIds?.length) {
        el.innerHTML = `<p class="hint story-graph-orphans-ok">✓ Все сцены достижимы из <code>${this.escapeHtml(startId)}</code>.</p>`;
        return;
      }

      const items = orphanIds.map(id => {
        const js = `Editor.onStoryGraphSearch(${JSON.stringify(id)})`;
        return `<button type="button" class="story-graph-orphan-id" onclick="${js}">${this.escapeHtml(id)}</button>`;
      }).join('');

      el.innerHTML = `<div class="story-graph-orphans-warn">
        <strong>⚠ Сироты (${orphanIds.length})</strong> — нет пути из <code>${this.escapeHtml(startId)}</code>:
        <div class="story-graph-orphan-list">${items}</div>
      </div>`;
    },

    /** Отрисовка / обновление диаграммы Mermaid */
    async renderStoryGraph() {
      const mount = document.getElementById('story-graph-mermaid');
      if (!mount) {
        this.renderStoryGraphPanel();
        return;
      }
      if (!this.data?.scenes) {
        mount.innerHTML = '<p class="hint">Нет данных сцен</p>';
        return;
      }
      if (!this.ensureMermaid()) {
        mount.innerHTML = '<p class="hint">Не удалось загрузить Mermaid.js</p>';
        return;
      }

      const searchInput = document.getElementById('story-graph-search-input');
      if (searchInput) this._graphSearchId = searchInput.value.trim();

      const { code, meta } = this.buildMermaidFromScenes();
      const renderId = 'story-graph-' + Date.now();

      try {
        mount.innerHTML = '<p class="hint">Построение графа…</p>';
        const { svg, bindFunctions } = await mermaid.render(renderId, code);
        mount.innerHTML = svg;
        if (typeof bindFunctions === 'function') bindFunctions(mount);
        this._lastGraphMeta = meta;
        this.enhanceStoryGraphSvg(mount, meta);
        this.applyGraphSearchHighlight();
        this.renderOrphanScenesList([...meta.orphans]);
      } catch (err) {
        console.error('Mermaid render error:', err);
        mount.innerHTML = `<div class="empty-state"><h2>Ошибка графа</h2><pre class="hint">${this.escapeHtml(err.message || String(err))}</pre></div>`;
        this.renderOrphanScenesList(this.findOrphanScenes());
      }
    },

    /** Сопоставление SVG-узла Mermaid с id сцены */
    resolveSceneIdFromGraphNode(nodeEl, sceneToNode) {
      const gid = nodeEl.id || '';
      if (!gid) return null;
      let best = null;
      let bestLen = 0;
      for (const [sceneId, mermaidId] of Object.entries(sceneToNode)) {
        if (gid.includes(mermaidId) && mermaidId.length > bestLen) {
          best = sceneId;
          bestLen = mermaidId.length;
        }
      }
      return best;
    },

    /** Классы, подсказки и интерактив после отрисовки SVG */
    enhanceStoryGraphSvg(mount, meta) {
      const { sceneToNode, tooltips, combat, quest, final, orphans } = meta;

      mount.querySelectorAll('g.node').forEach(g => {
        const sceneId = this.resolveSceneIdFromGraphNode(g, sceneToNode);
        if (!sceneId) return;

        g.dataset.sceneId = sceneId;
        g.classList.add('graph-node-interactive');

        if (orphans?.has(sceneId)) g.classList.add('graph-node-orphan');
        if (combat.has(sceneId)) g.classList.add('graph-node-combat');
        if (quest?.has(sceneId)) g.classList.add('graph-node-quest');
        if (final.has(sceneId)) g.classList.add('graph-node-final');
        if (meta.deadEnds?.has(sceneId)) g.classList.add('graph-node-deadend');

        const tip = tooltips[sceneId];
        if (!tip) return;

        const show = (e) => this.showGraphTooltip(e, sceneId, tip);
        const hide = () => this.hideGraphTooltip();
        g.addEventListener('mouseenter', show);
        g.addEventListener('mouseleave', hide);
        g.addEventListener('mousemove', show);
      });
    },

    ensureGraphTooltipEl() {
      let el = document.getElementById('story-graph-tooltip');
      if (!el) {
        el = document.createElement('div');
        el.id = 'story-graph-tooltip';
        el.className = 'story-graph-tooltip';
        el.setAttribute('role', 'tooltip');
        document.body.appendChild(el);
      }
      return el;
    },

    showGraphTooltip(event, sceneId, text) {
      const el = this.ensureGraphTooltipEl();
      el.innerHTML = `<strong>${this.escapeHtml(sceneId)}</strong><br>${this.escapeHtml(text)}`;
      el.classList.add('visible');
      this.moveGraphTooltip(event);
    },

    moveGraphTooltip(event) {
      const el = document.getElementById('story-graph-tooltip');
      if (!el || !el.classList.contains('visible')) return;
      const pad = 14;
      let x = event.clientX + pad;
      let y = event.clientY + pad;
      const rect = el.getBoundingClientRect();
      if (x + rect.width > window.innerWidth - 8) x = event.clientX - rect.width - pad;
      if (y + rect.height > window.innerHeight - 8) y = event.clientY - rect.height - pad;
      el.style.left = x + 'px';
      el.style.top = y + 'px';
    },

    hideGraphTooltip() {
      const el = document.getElementById('story-graph-tooltip');
      if (el) el.classList.remove('visible');
    },

    onStoryGraphSearch(query) {
      this._graphSearchId = String(query || '').trim();
      this.applyGraphSearchHighlight();
    },

    applyGraphSearchHighlight() {
      const mount = document.getElementById('story-graph-mermaid');
      if (!mount) return;

      mount.querySelectorAll('g.node.graph-node-search').forEach(g => {
        g.classList.remove('graph-node-search');
      });

      const input = document.getElementById('story-graph-search-input');
      if (input && input.value.trim() !== this._graphSearchId) {
        input.value = this._graphSearchId;
      }

      const q = this._graphSearchId;
      if (!q) return;

      if (!this.data?.scenes?.[q]) {
        if (input) input.classList.add('story-graph-search-invalid');
        return;
      }
      if (input) input.classList.remove('story-graph-search-invalid');

      const meta = this._lastGraphMeta;
      const mermaidId = meta?.sceneToNode?.[q] || this.mermaidNodeId(q);
      const node = Array.from(mount.querySelectorAll('g.node')).find(g => {
        if (g.dataset.sceneId === q) return true;
        return (g.id || '').includes(mermaidId);
      });

      if (!node) return;

      node.classList.add('graph-node-search');
      node.scrollIntoView({ block: 'center', behavior: 'smooth', inline: 'nearest' });
    },

    /**
     * Клик по узлу на графе: вкладка «Сцены» + выбор сцены.
     */
    openSceneFromGraph(sceneId) {
      if (!this.data?.scenes?.[sceneId]) return;
      this.hideGraphTooltip();

      this.currentScene = sceneId;
      this.currentTab = 'scenes';

      document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

      const scenesTab = document.querySelector('.tabs .tab[onclick*="scenes"]');
      if (scenesTab) scenesTab.classList.add('active');
      const scenesContent = document.getElementById('tab-scenes');
      if (scenesContent) scenesContent.classList.add('active');

      const startScreen = document.getElementById('start-screen');
      if (startScreen) startScreen.style.display = 'none';

      this.renderSceneList();
      this.renderSceneEditor();
    }
  });
})();
