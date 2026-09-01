// ============================================================
// Unified Story Flow — «Карта истории»
// UI над существующими scenes / choices / quests / story graph.
// НЕ меняет runtime-связи и не создаёт вторую систему графа.
// ============================================================
(function attachEditorStoryFlow() {
  if (typeof Editor === 'undefined') {
    console.warn('editor-story-flow.js: Editor не определён');
    return;
  }

  const NODE_ICONS = {
    scene: '🏘',
    location: '📍',
    npc: '👤',
    dialogue: '💬',
    choice: '➡',
    quest: '📜',
    quest_stage: '📌',
    action: '⚡',
    battle: '⚔️',
    warning: '⚠'
  };

  const WS_MODE_KEY_PREFIX = 'rpg_story_ws_view_';
  const MAP_SUBMODE_KEY_PREFIX = 'rpg_story_map_submode_';

  Object.assign(Editor, {
    _storyFlowCtxMenu: null,
    _storyFlowFilter: '',
    storyFlowMode: 'flow',

    getStoryWorkspaceProjectKey() {
      const d = this.data || {};
      const title = d.meta?.title || d.title || d.projectName || '';
      const start = d.startScene || d.meta?.startScene || '';
      const n = Object.keys(d.scenes || {}).length;
      const raw = [title, start, n].join('|');
      let h = 0;
      for (let i = 0; i < raw.length; i++) h = ((h << 5) - h + raw.charCodeAt(i)) | 0;
      return 'p' + Math.abs(h);
    },

    _readPerProjectStorage(prefix, fallback) {
      try {
        const k = prefix + this.getStoryWorkspaceProjectKey();
        const v = localStorage.getItem(k);
        return v != null ? v : fallback;
      } catch (e) {
        return fallback;
      }
    },

    _writePerProjectStorage(prefix, value) {
      try {
        localStorage.setItem(prefix + this.getStoryWorkspaceProjectKey(), value);
      } catch (e) { /* */ }
    },

    getSceneWorkspaceViewMode() {
      return this._readPerProjectStorage(WS_MODE_KEY_PREFIX, 'text') === 'map' ? 'map' : 'text';
    },

    setSceneWorkspaceViewMode(mode) {
      const m = mode === 'map' ? 'map' : 'text';
      this._writePerProjectStorage(WS_MODE_KEY_PREFIX, m);
      this.applySceneWorkspaceView();
    },

    getStoryFlowMapSubmode() {
      const v = this._readPerProjectStorage(MAP_SUBMODE_KEY_PREFIX, 'flow');
      this.storyFlowMode = v === 'graph' ? 'graph' : 'flow';
      return this.storyFlowMode;
    },

    setStoryFlowMode(mode) {
      this.storyFlowMode = mode === 'graph' ? 'graph' : 'flow';
      this._writePerProjectStorage(MAP_SUBMODE_KEY_PREFIX, this.storyFlowMode);
      if (this.getSceneWorkspaceViewMode() === 'map') {
        this.applySceneWorkspaceView();
      } else if (typeof this.renderStoryGraphPanel === 'function') {
        this.renderStoryGraphPanel();
      } else if (typeof this.renderStoryFlow === 'function') {
        this.renderStoryFlow();
      }
    },

    getStoryFlowStartId() {
      const d = this.data || {};
      const scenes = d.scenes || {};
      if (d.startScene && scenes[d.startScene]) return String(d.startScene);
      if (d.meta?.startScene && scenes[d.meta.startScene]) return String(d.meta.startScene);
      if (typeof this.getGraphStartId === 'function') return this.getGraphStartId();
      if (scenes.start) return 'start';
      const keys = Object.keys(scenes);
      return keys[0] || null;
    },

    /**
     * Построить narrative-модель из существующих сцен/выборов/квестов.
     */
    buildStoryFlowModel() {
      const scenes = this.data?.scenes || {};
      const quests = this.data?.quests || {};
      const npcs = this.data?.npcs || {};
      const ids = Object.keys(scenes);
      const nodes = [];
      const edges = [];
      const warnings = [];

      ids.forEach((sid) => {
        const sc = scenes[sid] || {};
        const label = sc.location || sc.title || sid;
        const kinds = ['scene'];
        if (typeof this.hasSceneCombat === 'function' ? this.hasSceneCombat(sc) : !!(sc.combat)) {
          kinds.push('battle');
        }
        const npcId = sc.npcId || sc.npc;
        if (npcId) kinds.push('npc');

        const nodeWarnings = [];
        const outEdges = [];
        (sc.choices || []).forEach((c, ci) => {
          if (!c) return;
          const to = c.to || c.nextScene;
          const text = String(c.text || 'Выбор').replace(/<[^>]+>/g, '').trim().slice(0, 40);
          if (to) {
            const broken = !scenes[to];
            if (broken) {
              nodeWarnings.push('Ссылка ведёт на удалённую сцену: ' + to);
              warnings.push({
                sceneId: sid,
                message: 'Выбор «' + text + '» → отсутствует «' + to + '»',
                kind: 'broken_link',
                edgeKind: 'choice',
                choiceIndex: ci,
                targetId: to
              });
            }
            outEdges.push({
              fromId: sid,
              toId: to,
              kind: 'choice',
              label: text,
              choiceIndex: ci,
              broken
            });
          }
          const qid = c.questSet?.questId || c.questId || c.startQuest;
          if (qid && !quests[qid]) {
            nodeWarnings.push('Квест не найден: ' + qid);
            warnings.push({
              sceneId: sid,
              message: 'Квест «' + qid + '» невозможно продолжить (удалён)',
              kind: 'missing_quest',
              targetId: qid,
              questId: qid
            });
          }
          if (c.action) kinds.push('action');
          if (c.skillCheck) kinds.push('action');
        });
        if (sc.nextScene) {
          const broken = !scenes[sc.nextScene];
          if (broken) {
            nodeWarnings.push('nextScene отсутствует: ' + sc.nextScene);
            warnings.push({
              sceneId: sid,
              message: 'После сцены → отсутствует «' + sc.nextScene + '»',
              kind: 'broken_link',
              edgeKind: 'next',
              choiceIndex: -1,
              targetId: sc.nextScene
            });
          }
          outEdges.push({
            fromId: sid,
            toId: sc.nextScene,
            kind: 'next',
            label: 'далее',
            choiceIndex: -1,
            broken
          });
        }

        if ((sc.dialogue && sc.dialogue.length) || sc.text) kinds.push('dialogue');
        if (sc.questId && !quests[sc.questId]) {
          nodeWarnings.push('Квест сцены не найден: ' + sc.questId);
        }

        nodes.push({
          id: sid,
          type: kinds.includes('battle') ? 'battle' : (npcId ? 'npc' : 'scene'),
          kinds,
          label,
          subtitle: npcId && npcs[npcId] ? (npcs[npcId].name || npcId) : '',
          warnings: nodeWarnings,
          outCount: outEdges.length,
          inCount: 0,
          isHub: sc.sceneType === 'hub' || !!sc.returnsToHub || !!sc.hubScene,
          isFinal: typeof this.isFinalScene === 'function' ? this.isFinalScene(sc) : false,
          storyPhase: sc.storyPhase || null
        });
        outEdges.forEach((e) => edges.push(e));
      });

      const inMap = {};
      edges.forEach((e) => {
        if (!e.broken) inMap[e.toId] = (inMap[e.toId] || 0) + 1;
      });
      nodes.forEach((n) => { n.inCount = inMap[n.id] || 0; });

      const questNodes = Object.keys(quests).map((qid) => {
        const q = quests[qid];
        const stages = Array.isArray(q.stages) ? q.stages : [];
        return {
          id: 'quest:' + qid,
          type: 'quest',
          kinds: ['quest'],
          label: q.title || q.name || qid,
          subtitle: stages.length ? (stages.length + ' этап(ов)') : '',
          questId: qid,
          stages: stages.map((s, i) => ({
            id: 'quest:' + qid + ':stage:' + i,
            type: 'quest_stage',
            label: s.title || s.name || ('Этап ' + (i + 1)),
            index: i
          })),
          warnings: []
        };
      });

      const layerOf = {};
      const startId = this.getStoryFlowStartId();
      const roots = nodes.filter((n) => n.inCount === 0).map((n) => n.id);
      const queue = startId && scenes[startId] ? [startId] : (roots.length ? roots.slice() : (nodes[0] ? [nodes[0].id] : []));
      queue.forEach((id) => { layerOf[id] = 0; });
      let qi = 0;
      while (qi < queue.length) {
        const id = queue[qi++];
        const layer = layerOf[id] || 0;
        edges.filter((e) => e.fromId === id && !e.broken).forEach((e) => {
          if (layerOf[e.toId] == null || layerOf[e.toId] > layer + 1) {
            layerOf[e.toId] = layer + 1;
            queue.push(e.toId);
          }
        });
      }
      nodes.forEach((n) => { n.layer = layerOf[n.id] != null ? layerOf[n.id] : 0; });

      const reachable = new Set(queue);
      if (startId) reachable.add(startId);

      return { nodes, edges, questNodes, warnings, roots, startId, reachable };
    },

    buildStoryFlowChecklist(model) {
      model = model || this.buildStoryFlowModel();
      const scenes = this.data?.scenes || {};
      const startId = this.getStoryFlowStartId();
      const items = [];

      const startAssigned = !!(this.data?.startScene || this.data?.meta?.startScene);
      const startValid = startId && !!scenes[startId];
      items.push({
        id: 'start_assigned',
        label: 'Стартовая сцена назначена',
        status: startAssigned && startValid ? 'ok' : (startValid ? 'warn' : 'error'),
        detail: startAssigned
          ? (startValid ? '«' + startId + '»' : 'указана несуществующая сцена')
          : (startValid ? 'не задана явно — используется «' + startId + '»' : 'нет сцен'),
        sceneIds: startId ? [startId] : []
      });

      const unreachable = model.nodes
        .filter((n) => startId && model.reachable && !model.reachable.has(n.id))
        .map((n) => n.id);
      items.push({
        id: 'start_reachable',
        label: 'Все сцены достижимы из старта',
        status: !startId ? 'warn' : (unreachable.length ? 'warn' : 'ok'),
        detail: unreachable.length
          ? 'недостижимо: ' + unreachable.slice(0, 5).join(', ') + (unreachable.length > 5 ? '…' : '')
          : 'обход из «' + startId + '»',
        sceneIds: unreachable
      });

      const hubIds = model.nodes.filter((n) => n.isHub).map((n) => n.id);
      const finalIds = model.nodes.filter((n) => n.isFinal).map((n) => n.id);
      let hubFinOk = true;
      let hubFinDetail = 'хабы не размечены';
      let hubFinScenes = [];
      if (hubIds.length && finalIds.length) {
        const reachedFromHub = new Set();
        hubIds.forEach((hid) => {
          const q = [hid];
          const seen = new Set([hid]);
          while (q.length) {
            const id = q.shift();
            model.edges.filter((e) => e.fromId === id && !e.broken).forEach((e) => {
              if (!seen.has(e.toId)) {
                seen.add(e.toId);
                q.push(e.toId);
              }
            });
          }
          seen.forEach((x) => reachedFromHub.add(x));
        });
        const missingFin = finalIds.filter((f) => !reachedFromHub.has(f));
        hubFinOk = missingFin.length === 0;
        hubFinDetail = hubFinOk
          ? 'от хаба(ов) достижим финал'
          : 'финал недостижим: ' + missingFin.join(', ');
        hubFinScenes = missingFin.length ? missingFin : hubIds;
      } else if (hubIds.length) {
        hubFinDetail = 'нет сцен-финалов (без выходов)';
        hubFinScenes = hubIds;
      }
      items.push({
        id: 'hub_to_final',
        label: 'От хаба достижим финал',
        status: !hubIds.length ? 'ok' : (hubFinOk ? 'ok' : 'warn'),
        detail: hubFinDetail,
        sceneIds: hubFinScenes
      });

      const orphans = model.nodes
        .filter((n) => n.inCount === 0 && n.id !== startId)
        .map((n) => n.id);
      items.push({
        id: 'orphans',
        label: 'Сироты без входящих связей',
        status: orphans.length ? 'warn' : 'ok',
        detail: orphans.length ? orphans.length + ' сцен' : 'нет',
        sceneIds: orphans
      });

      const broken = model.edges.filter((e) => e.broken);
      const brokenFrom = [...new Set(broken.map((e) => e.fromId))];
      items.push({
        id: 'broken_links',
        label: 'Битые ссылки',
        status: broken.length ? 'error' : 'ok',
        detail: broken.length ? broken.length + ' переход(ов)' : 'нет',
        sceneIds: brokenFrom
      });

      return items;
    },

    renderStoryFlowChecklistHtml(model) {
      const items = this.buildStoryFlowChecklist(model);
      const icon = { ok: '✓', warn: '⚠', error: '✗' };
      return `<div class="sf-checklist" data-sf-checklist>
        <h4>Структура сюжета</h4>
        <ul class="sf-checklist-list">
          ${items.map((it) =>
            `<li class="sf-check-item sf-check-item--${it.status}">
              <button type="button" class="sf-check-btn" data-sf-check="${this.escapeAttr(it.id)}"
                data-scene-ids="${this.escapeAttr((it.sceneIds || []).join(','))}">
                <span class="sf-check-icon">${icon[it.status] || '•'}</span>
                <span class="sf-check-label">${this.escapeHtml(it.label)}</span>
                <span class="sf-check-detail hint">${this.escapeHtml(it.detail)}</span>
              </button>
            </li>`
          ).join('')}
        </ul>
      </div>`;
    },

    navigateToStoryFlowIssue(issue) {
      if (!issue) return;
      const sceneId = issue.sceneId || issue.targetId;
      if (sceneId && this.data?.scenes?.[sceneId]) {
        this.highlightStoryFlowScenes([sceneId], { focus: true });
        return;
      }
      if (issue.questId && typeof this.selectQuestToEdit === 'function') {
        this.switchTab?.('quests');
        this.selectQuestToEdit(issue.questId);
      }
    },

    highlightStoryFlowScenes(sceneIds, opts) {
      opts = opts || {};
      sceneIds = (sceneIds || []).filter((id) => id && this.data?.scenes?.[id]);
      if (!sceneIds.length) return;

      document.querySelectorAll('.scene-item.sf-nav-highlight, .pcm-scene-item.sf-nav-highlight, .cb-scene-card.sf-nav-highlight')
        .forEach((el) => el.classList.remove('sf-nav-highlight'));

      sceneIds.forEach((id) => {
        const sel = '[data-scene-id="' + id.replace(/"/g, '\\"') + '"]';
        document.querySelectorAll('.scene-item' + sel + ', .pcm-scene-item' + sel + ', .cb-scene-card' + sel)
          .forEach((el) => el.classList.add('sf-nav-highlight'));
      });

      if (opts.focus !== false) {
        const first = sceneIds[0];
        if (typeof this.openSceneFromGraph === 'function') {
          this.openSceneFromGraph(first);
        } else if (typeof this.selectScene === 'function') {
          this.switchTab?.('scenes');
          this.selectScene(first);
        }
        const el = document.querySelector('[data-scene-id="' + first + '"]');
        el?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      }
    },

    async retargetStoryFlowEdge(edge, newToId) {
      if (!edge || !newToId) return false;
      const scenes = this.data?.scenes || {};
      const fromSc = scenes[edge.fromId];
      if (!fromSc) return false;

      if (!scenes[newToId]) {
        const msg = 'Сцена «' + newToId + '» не существует. Всё равно назначить?';
        let ok = false;
        if (typeof this.confirmDialog === 'function') {
          ok = await this.confirmDialog({
            title: 'Несуществующая сцена',
            message: msg,
            confirmLabel: 'Назначить',
            cancelLabel: 'Отмена'
          });
        } else if (Editor.toast) {
          Editor.toast.warning('Нет confirmDialog — назначение отменено');
          return false;
        } else {
          return false;
        }
        if (!ok) return false;
      }

      if (edge.kind === 'next' || edge.choiceIndex === -1) {
        fromSc.nextScene = newToId;
      } else {
        const c = fromSc.choices?.[edge.choiceIndex];
        if (!c) return false;
        c.to = newToId;
        if (c.nextScene) c.nextScene = newToId;
      }

      this.markDirty?.();
      this.updateJSONPreview?.();
      this.renderSceneList?.();
      if (this.getSceneWorkspaceViewMode() === 'map') {
        this.renderStoryFlow();
      }
      if (Editor.toast) Editor.toast.success('Переход обновлён → «' + newToId + '»');
      return true;
    },

    async onStoryFlowEdgeClick(edge, ev) {
      if (ev) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      const scenes = this.data?.scenes || {};
      const cur = edge.toId || '';
      let picked = null;
      if (typeof this.pickEntity === 'function') {
        picked = await this.pickEntity('scene', {
          title: 'Куда ведёт переход?',
          message: '«' + (edge.label || 'переход') + '» из «' + edge.fromId + '»',
          value: scenes[cur] ? cur : ''
        });
      }
      if (picked == null) return;
      await this.retargetStoryFlowEdge(edge, picked);
    },

    ensureSceneWorkspaceViewToggle() {
      if (typeof document === 'undefined') return;
      const sidebar = document.getElementById('context-sidebar');
      if (!sidebar) return;
      const existing = document.getElementById('sf-ws-toggle');
      const allowed = typeof this.isEditorFeatureVisible === 'function'
        ? this.isEditorFeatureVisible('story.map_workspace')
        : true;
      if (!allowed) {
        if (existing) existing.style.display = 'none';
        return;
      }
      if (existing) {
        existing.style.display = '';
        return;
      }
      const h3 = sidebar.querySelector('h3');
      if (!h3) return;
      const wrap = document.createElement('div');
      wrap.id = 'sf-ws-toggle';
      wrap.className = 'sf-ws-toggle';
      const mode = this.getSceneWorkspaceViewMode();
      wrap.innerHTML =
        '<span class="sf-ws-label">Режим:</span>' +
        '<button type="button" class="btn btn-sm ' + (mode === 'text' ? 'btn-primary' : 'btn-secondary') + '" data-sf-ws="text">Текст</button>' +
        '<button type="button" class="btn btn-sm ' + (mode === 'map' ? 'btn-primary' : 'btn-secondary') + '" data-sf-ws="map">Карта</button>';
      h3.insertAdjacentElement('afterend', wrap);
      wrap.addEventListener('click', (e) => {
        const b = e.target.closest('[data-sf-ws]');
        if (!b) return;
        this.setSceneWorkspaceViewMode(b.getAttribute('data-sf-ws'));
      });
    },

    applySceneWorkspaceView() {
      if (typeof document === 'undefined') return;
      this.ensureSceneWorkspaceViewToggle();
      this.getStoryFlowMapSubmode();

      const mode = this.getSceneWorkspaceViewMode();
      const toggle = document.getElementById('sf-ws-toggle');
      if (toggle) {
        toggle.querySelectorAll('[data-sf-ws]').forEach((btn) => {
          const on = btn.getAttribute('data-sf-ws') === mode;
          btn.classList.toggle('btn-primary', on);
          btn.classList.toggle('btn-secondary', !on);
        });
      }

      const editor = document.getElementById('scene-editor');
      if (!editor) return;

      let ws = document.getElementById('story-flow-workspace');
      if (mode === 'map' && (this.currentTab === 'scenes' || !this.currentTab)) {
        if (!ws) {
          ws = document.createElement('div');
          ws.id = 'story-flow-workspace';
          ws.className = 'story-flow-workspace';
          editor.appendChild(ws);
        }
        Array.from(editor.children).forEach((ch) => {
          if (ch.id !== 'story-flow-workspace') ch.classList.add('sf-ws-hidden');
        });
        ws.classList.remove('sf-ws-hidden');
        if (this.storyFlowMode === 'graph' && typeof this._renderStoryGraphPanelCore === 'function') {
          this._renderStoryGraphPanelCore();
          const inner = document.getElementById('story-graph-editor');
          if (inner && ws) {
            ws.innerHTML = '';
            ws.appendChild(inner);
          }
        } else {
          this.renderStoryFlow(ws);
        }
      } else {
        if (ws) ws.classList.add('sf-ws-hidden');
        Array.from(editor.children).forEach((ch) => {
          if (ch.id !== 'story-flow-workspace') ch.classList.remove('sf-ws-hidden');
        });
        const graphHost = document.getElementById('tab-graph');
        const graphEditor = document.getElementById('story-graph-editor');
        if (graphEditor && graphHost && !graphHost.contains(graphEditor)) {
          graphHost.appendChild(graphEditor);
        }
      }
    },

    renderStoryFlow(hostEl) {
      const host = hostEl || document.getElementById('story-flow-workspace')
        || document.getElementById('story-flow-root')
        || document.getElementById('story-graph-editor');
      if (!host) return;
      const model = this.buildStoryFlowModel();
      this._storyFlowModel = model;

      const filter = (this._storyFlowFilter || '').toLowerCase().trim();
      let nodes = model.nodes.slice().sort((a, b) => (a.layer - b.layer) || a.label.localeCompare(b.label, 'ru'));
      if (filter) {
        nodes = nodes.filter((n) =>
          n.label.toLowerCase().includes(filter) ||
          n.id.toLowerCase().includes(filter) ||
          (n.subtitle || '').toLowerCase().includes(filter)
        );
      }

      const MAX = 80;
      const truncated = nodes.length > MAX;
      const visible = truncated ? nodes.slice(0, MAX) : nodes;

      const warnBanner = model.warnings.length
        ? `<div class="sf-warnings project-info" style="border-color:#c62828;">
            <strong>⚠ Проблемы сюжета (${model.warnings.length})</strong>
            <ul class="sf-warnings-list">
              ${model.warnings.slice(0, 16).map((w, wi) =>
                `<li><button type="button" class="sf-warn-link" data-sf-warn="${wi}">
                  ${this.escapeHtml(w.message)}
                </button></li>`
              ).join('')}
              ${model.warnings.length > 16 ? '<li class="hint">… и ещё ' + (model.warnings.length - 16) + '</li>' : ''}
            </ul>
          </div>`
        : '';

      const byLayer = {};
      visible.forEach((n) => {
        const L = n.layer || 0;
        if (!byLayer[L]) byLayer[L] = [];
        byLayer[L].push(n);
      });
      const layers = Object.keys(byLayer).map(Number).sort((a, b) => a - b);

      const flowHtml = layers.map((L, li) => {
        const cards = byLayer[L].map((n) => this.renderStoryFlowNodeCard(n, model)).join('');
        const arrow = li < layers.length - 1
          ? '<div class="sf-layer-arrow" aria-hidden="true">↓</div>'
          : '';
        return `<div class="sf-layer" data-layer="${L}">
          <div class="sf-layer-label hint">Шаг ${L + 1}</div>
          <div class="sf-layer-nodes">${cards}</div>
          ${arrow}
        </div>`;
      }).join('');

      const questStrip = model.questNodes.length
        ? `<div class="sf-quests">
            <h4>📜 Квесты в истории</h4>
            <div class="sf-quest-list">
              ${model.questNodes.map((q) => `
                <button type="button" class="sf-quest-chip" data-sf-quest="${this.escapeAttr(q.questId)}" title="Открыть квест">
                  ${this.escapeHtml(q.label)}
                  <span class="hint">${this.escapeHtml(q.subtitle || '')}</span>
                </button>`).join('')}
            </div>
          </div>`
        : '';

      const sub = this.storyFlowMode === 'graph' ? 'graph' : 'flow';
      const showChecklist = typeof this.isEditorFeatureVisible === 'function'
        ? this.isEditorFeatureVisible('story.structure_checklist')
        : true;
      const showGuidance = typeof this.isEditorFeatureVisible === 'function'
        ? this.isEditorFeatureVisible('story.guidance_hints')
        : true;
      const checklistHtml = showChecklist ? this.renderStoryFlowChecklistHtml(model) : '';
      const guidanceHtml = showGuidance && typeof StoryMemory !== 'undefined'
        ? StoryMemory.renderGuidanceHtml(StoryMemory.buildStoryGuidanceHints(model, this.data))
        : '';
      host.innerHTML = `
        <div class="story-flow-panel" id="story-flow-root">
          <div class="story-flow-toolbar">
            <div>
              <h2>📖 Карта истории</h2>
              <p class="hint">Клик по переходу — сменить цель. Предупреждения и чеклист ведут к сценам.</p>
            </div>
            <div class="sf-toolbar-actions">
              <div class="sf-mode-toggle">
                <button type="button" class="btn btn-sm ${sub === 'flow' ? 'btn-primary' : 'btn-secondary'}" data-sf-mode="flow">Карта истории</button>
                <button type="button" class="btn btn-sm ${sub === 'graph' ? 'btn-primary' : 'btn-secondary'}" data-sf-mode="graph">Редактор связей</button>
              </div>
              <input type="search" class="sf-search" placeholder="Найти сцену…" value="${this.escapeAttr(this._storyFlowFilter || '')}" data-sf-search>
              <button type="button" class="btn btn-secondary btn-sm" data-sf-refresh>🔄</button>
            </div>
          </div>
          ${guidanceHtml}
          ${checklistHtml}
          ${warnBanner}
          ${questStrip}
          <div class="sf-flow-scroll">
            ${flowHtml || '<p class="hint">Нет сцен. Создайте первую сцену.</p>'}
            ${truncated ? '<p class="hint">Показаны первые ' + MAX + ' из ' + nodes.length + '. Уточните поиск.</p>' : ''}
          </div>
        </div>`;

      this.bindStoryFlowEvents(host);
    },

    renderStoryFlowNodeCard(n, model) {
      const icon = NODE_ICONS[n.type] || NODE_ICONS.scene;
      const warn = n.warnings && n.warnings.length
        ? `<div class="sf-node-warn" title="${this.escapeAttr(n.warnings.join('\n'))}">⚠</div>`
        : '';
      const outs = (model.edges || []).filter((e) => e.fromId === n.id);
      const outHtml = outs.slice(0, 6).map((e) => {
        const target = model.nodes.find((x) => x.id === e.toId);
        const tLabel = target ? target.label : e.toId;
        const cls = e.broken ? 'sf-edge-broken' : '';
        const edgeJson = this.escapeAttr(JSON.stringify({
          fromId: e.fromId,
          toId: e.toId,
          kind: e.kind,
          choiceIndex: e.choiceIndex,
          label: e.label
        }));
        return `<button type="button" class="sf-out sf-out-btn ${cls}" data-sf-edge="${edgeJson}" title="Сменить цель перехода">
          ${this.escapeHtml(e.label)} → ${this.escapeHtml(tLabel)}${e.broken ? ' ⚠' : ''}
        </button>`;
      }).join('');
      const more = outs.length > 6 ? `<div class="hint">+${outs.length - 6} переходов</div>` : '';
      const badges = (n.kinds || []).filter((k) => k !== 'scene').slice(0, 3)
        .map((k) => `<span class="sf-badge">${NODE_ICONS[k] || ''} ${this.escapeHtml(k)}</span>`).join('');
      const phase = this.data?.scenes?.[n.id]?.storyPhase || '';
      const phaseLabel = (typeof StoryMemory !== 'undefined' && StoryMemory.STORY_PHASE_LABELS[phase])
        ? StoryMemory.STORY_PHASE_LABELS[phase] : '';
      const canEditPhase = typeof this.isEditorFeatureVisible === 'function'
        && this.isEditorFeatureVisible('story.phase_edit')
        && typeof StoryMemory !== 'undefined';
      const phaseHtml = canEditPhase
        ? `<label class="sf-phase-edit hint">Этап сюжета
            <select data-sf-phase="${this.escapeAttr(n.id)}" onclick="event.stopPropagation()">
              <option value="">—</option>
              ${StoryMemory.STORY_PHASES.map((p) =>
                `<option value="${this.escapeAttr(p)}"${phase === p ? ' selected' : ''}>${this.escapeHtml(StoryMemory.STORY_PHASE_LABELS[p])}</option>`
              ).join('')}
            </select></label>`
        : (phaseLabel ? `<span class="sf-badge sf-badge--phase">${this.escapeHtml(phaseLabel)}</span>` : '');

      return `<div class="sf-node" data-sf-node="${this.escapeAttr(n.id)}" data-sf-type="${this.escapeAttr(n.type)}" tabindex="0">
        ${warn}
        <div class="sf-node-head">${icon} <strong>${this.escapeHtml(n.label)}</strong></div>
        ${n.subtitle ? `<div class="hint">${this.escapeHtml(n.subtitle)}</div>` : ''}
        <div class="sf-badges">${badges}${phaseHtml}</div>
        <div class="sf-outs">${outHtml}${more}</div>
      </div>`;
    },

    bindStoryFlowEvents(root) {
      if (!root) return;
      if (!root._sfBound) {
        root._sfBound = true;
        root.addEventListener('click', (e) => this._onStoryFlowClick(e));
        root.addEventListener('dblclick', (e) => {
          const node = e.target.closest('[data-sf-node]');
          if (!node) return;
          clearTimeout(this._sfClickTimer);
          this.editStoryFlowNode(node.getAttribute('data-sf-node'));
        });
        root.addEventListener('contextmenu', (e) => {
          const node = e.target.closest('[data-sf-node]');
          if (!node) return;
          e.preventDefault();
          this.showStoryFlowContextMenu(node.getAttribute('data-sf-node'), e.clientX, e.clientY);
        });
        root.addEventListener('input', (e) => {
          if (e.target.matches('[data-sf-search]')) {
            this._storyFlowFilter = e.target.value;
            clearTimeout(this._sfSearchTimer);
            this._sfSearchTimer = setTimeout(() => this.renderStoryFlow(), 200);
          }
          if (e.target.matches('[data-sf-phase]')) {
            const sid = e.target.getAttribute('data-sf-phase');
            const val = e.target.value || undefined;
            if (sid && this.data?.scenes?.[sid]) {
              if (val) this.data.scenes[sid].storyPhase = val;
              else delete this.data.scenes[sid].storyPhase;
              this.markDirty?.();
              this.updateJSONPreview?.();
            }
          }
        });
      }
    },

    _onStoryFlowClick(e) {
      const root = e.target.closest('.story-flow-panel')?.parentElement
        || document.getElementById('story-flow-workspace')
        || document.getElementById('story-graph-editor');
      const modeBtn = e.target.closest('[data-sf-mode]');
      if (modeBtn) {
        this.setStoryFlowMode(modeBtn.getAttribute('data-sf-mode'));
        return;
      }
      if (e.target.closest('[data-sf-refresh]')) {
        this.renderStoryFlow();
        return;
      }
      const edgeBtn = e.target.closest('[data-sf-edge]');
      if (edgeBtn) {
        try {
          const edge = JSON.parse(edgeBtn.getAttribute('data-sf-edge'));
          this.onStoryFlowEdgeClick(edge, e);
        } catch (err) { /* */ }
        return;
      }
      const warnBtn = e.target.closest('[data-sf-warn]');
      if (warnBtn) {
        const wi = parseInt(warnBtn.getAttribute('data-sf-warn'), 10);
        const w = this._storyFlowModel?.warnings?.[wi];
        if (w) this.navigateToStoryFlowIssue(w);
        return;
      }
      const checkBtn = e.target.closest('[data-sf-check]');
      if (checkBtn) {
        const ids = (checkBtn.getAttribute('data-scene-ids') || '').split(',').filter(Boolean);
        if (ids.length) this.highlightStoryFlowScenes(ids, { focus: true });
        return;
      }
      const hintBtn = e.target.closest('.sf-guidance-btn');
      if (hintBtn) {
        const ids = (hintBtn.getAttribute('data-scene-ids') || '').split(',').filter(Boolean);
        if (ids.length) this.highlightStoryFlowScenes(ids, { focus: true });
        return;
      }
      const quest = e.target.closest('[data-sf-quest]');
      if (quest) {
        const qid = quest.getAttribute('data-sf-quest');
        if (typeof this.selectQuestToEdit === 'function') {
          this.switchTab?.('quests');
          this.selectQuestToEdit(qid);
        }
        return;
      }
      const node = e.target.closest('[data-sf-node]');
      if (node && e.detail === 1) {
        clearTimeout(this._sfClickTimer);
        this._sfClickTimer = setTimeout(() => {
          this.openStoryFlowNode(node.getAttribute('data-sf-node'));
        }, 220);
      }
    },

    openStoryFlowNode(sceneId) {
      if (!sceneId || !this.data?.scenes?.[sceneId]) {
        if (Editor.toast) Editor.toast.warning('Сцена не найдена');
        return;
      }
      this.highlightStoryFlowScenes([sceneId], { focus: true });
    },

    editStoryFlowNode(sceneId) {
      this.setSceneWorkspaceViewMode('text');
      this.openStoryFlowNode(sceneId);
      if (typeof this.renderSceneEditor === 'function') this.renderSceneEditor();
    },

    showStoryFlowContextMenu(sceneId, x, y) {
      this.hideStoryFlowContextMenu();
      const menu = document.createElement('div');
      menu.className = 'sf-ctx-menu';
      menu.style.cssText = `position:fixed;left:${x}px;top:${y}px;z-index:10000;`;
      menu.innerHTML = `
        <button type="button" data-act="open">Открыть</button>
        <button type="button" data-act="edit">Редактировать</button>
        <button type="button" data-act="rename">Переименовать</button>
        <button type="button" data-act="dup">Дублировать</button>
        <button type="button" data-act="find">Найти использование</button>
        <button type="button" data-act="del" class="danger">Удалить</button>`;
      document.body.appendChild(menu);
      this._storyFlowCtxMenu = menu;
      const close = () => this.hideStoryFlowContextMenu();
      menu.addEventListener('click', (ev) => {
        const act = ev.target.getAttribute('data-act');
        if (!act) return;
        close();
        if (act === 'open' || act === 'edit') this.openStoryFlowNode(sceneId);
        else if (act === 'rename') this.renameStoryFlowScene(sceneId);
        else if (act === 'dup') this.duplicateStoryFlowScene(sceneId);
        else if (act === 'find') this.findStoryFlowUsages(sceneId);
        else if (act === 'del') this.deleteStoryFlowScene(sceneId);
      });
      setTimeout(() => document.addEventListener('click', close, { once: true }), 0);
    },

    hideStoryFlowContextMenu() {
      if (this._storyFlowCtxMenu) {
        this._storyFlowCtxMenu.remove();
        this._storyFlowCtxMenu = null;
      }
    },

    renameStoryFlowScene(sceneId) {
      this.editStoryFlowNode(sceneId);
      if (Editor.toast) Editor.toast.info('Измените название сцены в редакторе');
    },

    duplicateStoryFlowScene(sceneId) {
      const sc = this.data?.scenes?.[sceneId];
      if (!sc) return;
      const base = sceneId + '_copy';
      let id = base;
      let n = 2;
      while (this.data.scenes[id]) id = base + '_' + n++;
      this.data.scenes[id] = JSON.parse(JSON.stringify(sc));
      if (this.data.scenes[id].id) this.data.scenes[id].id = id;
      this.updateJSONPreview?.();
      this.renderStoryFlow();
      if (Editor.toast) Editor.toast.success('Сцена скопирована: ' + id);
    },

    findStoryFlowUsages(sceneId) {
      const model = this._storyFlowModel || this.buildStoryFlowModel();
      const incoming = model.edges.filter((e) => e.toId === sceneId);
      const msg = incoming.length
        ? 'Ссылки на «' + sceneId + '»: ' + incoming.map((e) =>
          (model.nodes.find((n) => n.id === e.fromId)?.label || e.fromId) + ' → «' + e.label + '»'
        ).join('; ')
        : 'Нет входящих переходов на эту сцену.';
      if (Editor.toast) Editor.toast.info(msg);
    },

    async deleteStoryFlowScene(sceneId) {
      if (typeof this.deleteScene === 'function') {
        this.deleteScene(sceneId);
        this.renderStoryFlow();
        return;
      }
      let ok = false;
      if (typeof this.confirmDialog === 'function') {
        ok = await this.confirmDialog({
          title: 'Удалить сцену',
          message: 'Удалить сцену «' + sceneId + '»?',
          confirmLabel: 'Удалить',
          cancelLabel: 'Отмена',
          danger: true
        });
      }
      if (!ok) return;
      delete this.data.scenes[sceneId];
      this.updateJSONPreview?.();
      this.renderStoryFlow();
    },

    renderStoryFlowOrGraph() {
      if (this.getSceneWorkspaceViewMode() === 'map') {
        this.applySceneWorkspaceView();
        return;
      }
      if (this.storyFlowMode === 'graph') {
        if (this._renderStoryGraphPanelCore) return this._renderStoryGraphPanelCore();
        return;
      }
      this.renderStoryFlow();
    }
  });

  if (!document.getElementById('story-flow-styles')) {
    const st = document.createElement('style');
    st.id = 'story-flow-styles';
    st.textContent = `
      .sf-ws-toggle { display:flex; flex-wrap:wrap; gap:4px; align-items:center; margin:0 0 10px; }
      .sf-ws-toggle .sf-ws-label { font-size:11px; color:var(--ink-light,#666); width:100%; }
      .sf-ws-toggle .btn-sm { flex:1; font-size:11px; padding:4px 6px; }
      .sf-ws-hidden { display:none !important; }
      .story-flow-workspace { min-height: 400px; }
      .scene-item.sf-nav-highlight, .pcm-scene-item.sf-nav-highlight, .cb-scene-card.sf-nav-highlight {
        outline: 2px solid var(--accent,#8b4513); outline-offset: 2px;
        background: color-mix(in srgb, var(--accent,#8b4513) 12%, transparent);
      }
      .story-flow-panel { padding: 4px 8px 24px; }
      .story-flow-toolbar { display:flex; flex-wrap:wrap; gap:12px; justify-content:space-between; align-items:flex-start; margin-bottom:12px; }
      .story-flow-toolbar h2 { margin:0 0 4px; color:var(--accent,#8b4513); }
      .sf-toolbar-actions { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
      .sf-mode-toggle { display:inline-flex; gap:4px; }
      .sf-search { min-width:160px; padding:6px 10px; border-radius:6px; border:1px solid var(--border,#ccc); }
      .sf-flow-scroll { max-height:min(70vh,800px); overflow:auto; padding:8px 4px; }
      .sf-layer { margin-bottom:8px; }
      .sf-layer-label { font-size:12px; margin-bottom:6px; }
      .sf-layer-nodes { display:flex; flex-wrap:wrap; gap:12px; align-items:stretch; }
      .sf-layer-arrow { text-align:center; font-size:22px; color:var(--accent,#8b4513); margin:4px 0 8px; opacity:0.7; }
      .sf-node {
        position:relative; min-width:180px; max-width:260px; flex:1 1 180px;
        border:2px solid var(--border-dark,#a89880); border-radius:10px; padding:10px 12px;
        background:var(--card-bg,#fff); cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.06);
      }
      .sf-node:hover, .sf-node:focus { border-color:var(--accent,#8b4513); outline:none; }
      .sf-node-head { font-size:15px; margin-bottom:4px; }
      .sf-node-warn { position:absolute; top:6px; right:8px; color:#c62828; font-weight:700; }
      .sf-badge { display:inline-block; font-size:11px; background:rgba(0,0,0,0.05); border-radius:4px; padding:1px 6px; margin:2px 2px 0 0; }
      .sf-out-btn {
        display:block; width:100%; text-align:left; font-size:12px; margin-top:4px;
        padding:4px 6px; border:1px dashed transparent; border-radius:4px;
        background:transparent; color:var(--ink-light,#5d5247); cursor:pointer;
      }
      .sf-out-btn:hover { border-color:var(--accent,#8b4513); background:rgba(0,0,0,0.03); }
      .sf-edge-broken { color:#c62828; }
      .sf-quests { margin:8px 0 14px; }
      .sf-quest-list { display:flex; flex-wrap:wrap; gap:8px; }
      .sf-quest-chip {
        border:1px solid var(--border,#ccc); border-radius:20px; padding:6px 12px;
        background:var(--card-bg,#fff); cursor:pointer; text-align:left;
      }
      .sf-quest-chip .hint { display:block; font-size:11px; }
      .sf-warnings { margin-bottom:12px; }
      .sf-warnings-list { margin:6px 0 0; padding:0; list-style:none; }
      .sf-warn-link {
        background:none; border:0; padding:2px 0; text-align:left; cursor:pointer;
        color:inherit; text-decoration:underline; font-size:inherit;
      }
      .sf-checklist { margin:0 0 14px; padding:10px 12px; border-radius:8px; background:var(--paper-dark,#f5f0e8); }
      .sf-checklist h4 { margin:0 0 8px; font-size:14px; }
      .sf-checklist-list { list-style:none; margin:0; padding:0; }
      .sf-guidance { margin: 0 0 12px; padding: 10px 12px; border-radius: 8px; background: #f8f6f2; border: 1px solid var(--border,#ddd); }
      .sf-guidance--ok p { margin: 0; font-size: 13px; color: var(--ink-muted,#666); }
      .sf-guidance-list { list-style: none; margin: 8px 0 0; padding: 0; }
      .sf-guidance-btn { width: 100%; text-align: left; border: 0; background: transparent; cursor: pointer; padding: 6px 4px; font: inherit; display: flex; gap: 8px; align-items: flex-start; }
      .sf-guidance-btn:hover { background: rgba(0,0,0,0.04); border-radius: 6px; }
      .sf-guidance-panel { margin-bottom: 12px; }
      .sf-phase-edit { display: block; margin-top: 6px; font-size: 11px; }
      .sf-phase-edit select { margin-left: 4px; font-size: 11px; }
      .sf-badge--phase { background: #e8f0fe; }
      .sf-check-item { margin:0 0 4px; }
      .sf-check-btn {
        display:flex; flex-wrap:wrap; gap:4px 8px; align-items:baseline; width:100%;
        text-align:left; border:0; background:transparent; cursor:pointer; padding:6px 4px;
        border-radius:4px; font-size:13px;
      }
      .sf-check-btn:hover { background:rgba(0,0,0,0.05); }
      .sf-check-item--ok .sf-check-icon { color:#2e7d32; }
      .sf-check-item--warn .sf-check-icon { color:#e65100; }
      .sf-check-item--error .sf-check-icon { color:#c62828; }
      .sf-check-detail { font-size:11px; flex:1 1 100%; padding-left:1.4em; }
      .sf-ctx-menu {
        background:var(--card-bg,#fff); border:1px solid var(--border,#ccc); border-radius:8px;
        box-shadow:0 4px 16px rgba(0,0,0,0.15); min-width:180px; padding:4px; display:flex; flex-direction:column;
      }
      .sf-ctx-menu button {
        border:0; background:transparent; text-align:left; padding:8px 12px; cursor:pointer; font-size:14px;
      }
      .sf-ctx-menu button:hover { background:rgba(0,0,0,0.06); }
      .sf-ctx-menu button.danger { color:#c62828; }
      .ep-pick-panel .entity-picker { max-width:100%; }
    `;
    document.head.appendChild(st);
  }

  function installStoryFlowShell() {
    if (typeof Editor.renderStoryGraphPanel !== 'function') return;
    if (Editor._storyFlowInstalled) return;
    Editor._storyFlowInstalled = true;

    if (!Editor._renderStoryGraphPanelCore) {
      Editor._renderStoryGraphPanelCore = Editor.renderStoryGraphPanel.bind(Editor);
    }

    if (Editor.hooks?.replace) {
      Editor.hooks.replace('renderStoryGraphPanel', function renderStoryGraphPanelWithFlow() {
        if (Editor.getSceneWorkspaceViewMode?.() === 'map') {
          Editor.applySceneWorkspaceView?.();
          return;
        }
        if (Editor.storyFlowMode === 'flow') {
          return Editor.renderStoryFlow();
        }
        const r = Editor._renderStoryGraphPanelCore();
        const toolbar = document.querySelector('#story-graph-editor .story-graph-toolbar .sg-toolbar-actions') ||
          document.querySelector('#story-graph-editor .story-graph-toolbar');
        if (toolbar && !document.getElementById('sf-mode-in-graph')) {
          const wrap = document.createElement('div');
          wrap.id = 'sf-mode-in-graph';
          wrap.className = 'sf-mode-toggle';
          wrap.style.marginRight = '8px';
          wrap.innerHTML =
            '<button type="button" class="btn btn-secondary btn-sm" data-sf-mode="flow">Карта истории</button>' +
            '<button type="button" class="btn btn-primary btn-sm" data-sf-mode="graph">Редактор связей</button>';
          const parent = toolbar.querySelector('.sg-toolbar-actions') || toolbar;
          parent.insertBefore(wrap, parent.firstChild);
          wrap.addEventListener('click', (e) => {
            const b = e.target.closest('[data-sf-mode]');
            if (b) Editor.setStoryFlowMode(b.getAttribute('data-sf-mode'));
          });
        }
        return r;
      }, 'editor-story-flow');
    }

    const hookWorkspace = () => {
      Editor.ensureSceneWorkspaceViewToggle?.();
      Editor.applySceneWorkspaceView?.();
    };

    if (Editor.hooks?.after) {
      Editor.hooks.after('switchTab', function (result, args) {
        if (args && args[0] === 'scenes') hookWorkspace();
        if (args && args[0] === 'graph' && Editor.storyFlowMode === 'flow') {
          Editor.renderStoryFlow?.();
        }
        return result;
      });
      Editor.hooks.after('renderSceneList', hookWorkspace);
      Editor.hooks.after('selectScene', hookWorkspace);
      Editor.hooks.after('renderSceneEditor', hookWorkspace);
      Editor.hooks.after('loadData', hookWorkspace);
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', installStoryFlowShell);
    } else {
      installStoryFlowShell();
    }
  }
  if (typeof setTimeout === 'function') {
    setTimeout(installStoryFlowShell, 0);
    setTimeout(installStoryFlowShell, 500);
  }
})();
