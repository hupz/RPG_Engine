// ============================================================
// P4: Глобальный поиск по проекту + «дыры сюжета»
// ============================================================
(function attachProjectSearchAndHoles() {
  if (typeof Editor === 'undefined') {
    console.warn('editor-project-search.js: Editor не определён');
    return;
  }

  Object.assign(Editor, {
    _searchOpen: false,
    _searchQuery: '',
    _searchResults: [],

    // ——— Поиск ———

    openProjectSearch(prefill) {
      this._searchOpen = true;
      this._searchQuery = prefill != null ? String(prefill) : this._searchQuery;
      this.renderProjectSearchModal();
      setTimeout(() => {
        const input = document.getElementById('project-search-input');
        if (input) {
          input.focus();
          input.select();
        }
      }, 30);
    },

    closeProjectSearch() {
      this._searchOpen = false;
      document.getElementById('project-search-modal')?.remove();
    },

    /**
     * Индекс сущностей проекта для поиска.
     * @returns {{ kind: string, id: string, title: string, haystack: string, tab: string, sceneId?: string }[]}
     */
    buildProjectSearchIndex() {
      const data = this.data || {};
      const rows = [];

      const push = (row) => {
        rows.push({
          ...row,
          haystack: String(row.haystack || '').toLowerCase()
        });
      };

      Object.entries(data.scenes || {}).forEach(([id, sc]) => {
        const choiceTexts = (sc.choices || []).map((c) => c?.text || '').join(' ');
        const dlg = (sc.dialogue || []).map((d) => (d?.speaker || '') + ' ' + (d?.text || '')).join(' ');
        push({
          kind: 'Сцена',
          id,
          title: sc.location || sc.title || id,
          haystack: [id, sc.location, sc.title, sc.text, choiceTexts, dlg, sc.npcId].join(' '),
          tab: 'scenes',
          sceneId: id
        });
        (sc.choices || []).forEach((c, i) => {
          if (!c) return;
          push({
            kind: 'Выбор',
            id: id + '#' + i,
            title: (c.text || '(без текста)') + ' → ' + (c.to || '—'),
            haystack: [c.text, c.to, c.questSet?.questId, id, sc.location].join(' '),
            tab: 'scenes',
            sceneId: id,
            choiceIndex: i
          });
        });
      });

      Object.entries(data.quests || {}).forEach(([id, q]) => {
        const stageBits = (q.stages || []).map((s) =>
          [s.title, s.hint, ...(s.tasks || []).map((t) => t.description || t.type || '')].join(' ')
        ).join(' ');
        push({
          kind: 'Квест',
          id,
          title: q.title || id,
          haystack: [id, q.title, q.description, stageBits].join(' '),
          tab: 'quests',
          questId: id
        });
      });

      Object.entries(data.npcs || {}).forEach(([id, n]) => {
        const dlg = JSON.stringify(n.dialogues || {});
        push({
          kind: 'NPC',
          id,
          title: n.name || id,
          haystack: [id, n.name, n.description, n.location, dlg].join(' '),
          tab: 'npcs',
          npcId: id
        });
      });

      Object.entries(data.items || {}).forEach(([id, it]) => {
        push({
          kind: 'Предмет',
          id,
          title: it.name || id,
          haystack: [id, it.name, it.description, it.type].join(' '),
          tab: 'items',
          itemId: id
        });
      });

      Object.entries(data.enemies || {}).forEach(([id, e]) => {
        push({
          kind: 'Враг',
          id,
          title: e.name || id,
          haystack: [id, e.name, e.creatureType].join(' '),
          tab: 'enemies',
          enemyId: id
        });
      });

      Object.entries(data.classes || {}).forEach(([id, cl]) => {
        const abs = (cl.abilities || []).map((a) => a.name || a.id).join(' ');
        push({
          kind: 'Класс',
          id,
          title: cl.name || id,
          haystack: [id, cl.name, abs].join(' '),
          tab: 'classes',
          classId: id
        });
      });

      return rows;
    },

    runProjectSearch(query) {
      this._searchQuery = String(query || '').trim();
      const q = this._searchQuery.toLowerCase();
      if (!q) {
        this._searchResults = [];
        return [];
      }
      const tokens = q.split(/\s+/).filter(Boolean);
      const index = this.buildProjectSearchIndex();
      const scored = [];
      index.forEach((row) => {
        let ok = true;
        let score = 0;
        tokens.forEach((tok) => {
          if (!row.haystack.includes(tok)) ok = false;
          else {
            if (row.title.toLowerCase().includes(tok)) score += 5;
            if (row.id.toLowerCase().includes(tok)) score += 3;
            score += 1;
          }
        });
        if (ok) scored.push({ ...row, score });
      });
      scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'ru'));
      this._searchResults = scored.slice(0, 80);
      return this._searchResults;
    },

    renderProjectSearchModal() {
      let modal = document.getElementById('project-search-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'project-search-modal';
        document.body.appendChild(modal);
      }
      const results = this.runProjectSearch(this._searchQuery);
      const list = results.length
        ? results.map((r, i) => `
          <button type="button" class="ps-result" data-idx="${i}"
            onclick="Editor.goToSearchResult(${i})">
            <span class="ps-kind">${this.escapeHtml(r.kind)}</span>
            <span class="ps-title">${this.escapeHtml(r.title)}</span>
            <span class="ps-id hint">${this.escapeHtml(r.id)}</span>
          </button>`).join('')
        : (this._searchQuery
          ? '<p class="hint" style="padding:12px;">Ничего не найдено</p>'
          : '<p class="hint" style="padding:12px;">Начните вводить: название сцены, квеста, NPC, предмет…</p>');

      modal.innerHTML = `
        <div class="ps-backdrop" onclick="Editor.closeProjectSearch()"></div>
        <div class="ps-panel" role="dialog" aria-label="Поиск по проекту" onclick="event.stopPropagation()">
          <div class="ps-head">
            <input type="search" id="project-search-input" placeholder="Поиск по проекту…"
              value="${this.escapeAttr(this._searchQuery)}"
              autocomplete="off"
              oninput="Editor.onProjectSearchInput(this.value)">
            <button type="button" class="btn btn-secondary" onclick="Editor.closeProjectSearch()">Esc</button>
          </div>
          <div class="ps-results">${list}</div>
          <div class="ps-footer hint">Enter — открыть первый · Esc — закрыть · Ctrl+K — снова открыть</div>
        </div>`;

      const input = document.getElementById('project-search-input');
      if (input && !input._psBound) {
        input._psBound = true;
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            Editor.closeProjectSearch();
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (Editor._searchResults[0]) Editor.goToSearchResult(0);
          }
        });
      }
    },

    onProjectSearchInput(value) {
      this._searchQuery = value;
      const results = this.runProjectSearch(value);
      const box = document.querySelector('#project-search-modal .ps-results');
      if (!box) return;
      box.innerHTML = results.length
        ? results.map((r, i) => `
          <button type="button" class="ps-result" data-idx="${i}"
            onclick="Editor.goToSearchResult(${i})">
            <span class="ps-kind">${this.escapeHtml(r.kind)}</span>
            <span class="ps-title">${this.escapeHtml(r.title)}</span>
            <span class="ps-id hint">${this.escapeHtml(r.id)}</span>
          </button>`).join('')
        : (value.trim()
          ? '<p class="hint" style="padding:12px;">Ничего не найдено</p>'
          : '<p class="hint" style="padding:12px;">Начните вводить…</p>');
    },

    goToSearchResult(index) {
      const r = this._searchResults[index];
      if (!r) return;
      this.closeProjectSearch();
      this.navigateSearchResult(r);
    },

    navigateSearchResult(r) {
      if (r.tab === 'scenes' && r.sceneId) {
        if (typeof this.openSceneFromGraph === 'function') this.openSceneFromGraph(r.sceneId);
        else {
          this.currentScene = r.sceneId;
          this.switchTab?.('scenes');
          this.renderSceneEditor?.();
        }
        return;
      }
      if (r.tab === 'quests' && r.questId) {
        this.editingQuestId = r.questId;
        this.switchTab?.('quests');
        this.renderQuests?.();
        return;
      }
      if (r.tab === 'npcs' && r.npcId) {
        this.editingNpcId = r.npcId;
        this.switchTab?.('npcs');
        this.renderNPCs?.();
        return;
      }
      if (r.tab === 'items' && r.itemId) {
        this.editingItemId = r.itemId;
        this.switchTab?.('items');
        this.renderItems?.();
        return;
      }
      if (r.tab === 'enemies' && r.enemyId) {
        this.editingEnemyId = r.enemyId;
        this.switchTab?.('enemies');
        this.renderEnemies?.();
        return;
      }
      if (r.tab === 'classes' && r.classId) {
        this.editingClassId = r.classId;
        this.switchTab?.('classes');
        this.renderClasses?.();
      }
    },

    // ——— Дыры сюжета ———

    /**
     * Собрать сюжетные проблемы (дополняет валидатор).
     */
    collectStoryHoles() {
      const data = this.data || {};
      const scenes = data.scenes || {};
      const sceneIds = new Set(Object.keys(scenes));
      const holes = [];

      const startId = (typeof this.getGraphStartId === 'function' && this.getGraphStartId()) ||
        (scenes.start ? 'start' : Object.keys(scenes)[0]);

      // reachable BFS
      const reachable = new Set();
      if (startId && scenes[startId]) {
        const queue = [startId];
        reachable.add(startId);
        while (queue.length) {
          const id = queue.shift();
          const sc = scenes[id];
          if (!sc) continue;
          const outs = [];
          (sc.choices || []).forEach((c) => {
            if (c?.to) outs.push(c.to);
            if (c?.nextScene) outs.push(c.nextScene);
            if (c?.skillCheck?.successNext) outs.push(c.skillCheck.successNext);
            if (c?.skillCheck?.failNext) outs.push(c.skillCheck.failNext);
          });
          if (sc.nextScene) outs.push(sc.nextScene);
          outs.forEach((t) => {
            if (t && scenes[t] && !reachable.has(t)) {
              reachable.add(t);
              queue.push(t);
            }
          });
        }
      }

      Object.entries(scenes).forEach(([id, sc]) => {
        const title = sc.location || id;
        // broken links
        (sc.choices || []).forEach((c, i) => {
          if (c?.to && !sceneIds.has(c.to)) {
            holes.push({
              severity: 'error',
              type: 'broken_link',
              sceneId: id,
              message: `Сцена «${title}»: выбор «${(c.text || '').slice(0, 40)}» ведёт в несуществующую «${c.to}»`
            });
          }
          if (c && !c.to && !c.skillCheck && !c.action && !c.questSet) {
            holes.push({
              severity: 'warning',
              type: 'choice_no_target',
              sceneId: id,
              message: `Сцена «${title}»: у выбора «${(c.text || 'без текста').slice(0, 40)}» нет цели`
            });
          }
        });
        if (sc.nextScene && !sceneIds.has(sc.nextScene)) {
          holes.push({
            severity: 'error',
            type: 'broken_next',
            sceneId: id,
            message: `Сцена «${title}»: nextScene «${sc.nextScene}» не существует`
          });
        }

        // dead end: no exits
        const hasExit =
          (sc.choices || []).some((c) => c && (c.to || c.skillCheck || c.action)) ||
          !!sc.nextScene ||
          !!(sc.combat && (Array.isArray(sc.combat) ? sc.combat.length : true) && sc.nextScene);
        const hasCombatNoNext = Array.isArray(sc.combat) && sc.combat.length && !sc.nextScene &&
          !(sc.choices || []).some((c) => c?.to);
        if (!hasExit && Object.keys(scenes).length > 1) {
          holes.push({
            severity: 'warning',
            type: 'dead_end',
            sceneId: id,
            message: `Сцена «${title}»: нет выхода (тупик)`
          });
        }
        if (hasCombatNoNext) {
          holes.push({
            severity: 'warning',
            type: 'combat_no_next',
            sceneId: id,
            message: `Сцена «${title}»: бой без сцены после победы`
          });
        }

        if (startId && !reachable.has(id) && id !== startId) {
          holes.push({
            severity: 'info',
            type: 'unreachable',
            sceneId: id,
            message: `Сцена «${title}»: нет пути из старта «${startId}»`
          });
        }

        if (!String(sc.text || '').trim() && !(sc.dialogue || []).length && !(sc.components || []).length) {
          holes.push({
            severity: 'info',
            type: 'empty_scene',
            sceneId: id,
            message: `Сцена «${title}»: пустая (нет текста и диалога)`
          });
        }
      });

      // quests without any questSet reference
      const questRefs = new Set();
      Object.values(scenes).forEach((sc) => {
        (sc.choices || []).forEach((c) => {
          if (c?.questSet?.questId) questRefs.add(c.questSet.questId);
        });
      });
      Object.entries(data.quests || {}).forEach(([qid, q]) => {
        if (!questRefs.has(qid)) {
          holes.push({
            severity: 'info',
            type: 'quest_no_start',
            questId: qid,
            tab: 'quests',
            message: `Квест «${q.title || qid}»: ни один выбор не запускает его`
          });
        }
      });

      // NPC never placed
      Object.entries(data.npcs || {}).forEach(([nid, n]) => {
        const used = Object.values(scenes).some((sc) => {
          if (sc.npcId === nid) return true;
          return (sc.components || []).some((c) =>
            c?.params?.npc === nid || c?.params?.merchant === nid
          );
        });
        if (!used) {
          holes.push({
            severity: 'info',
            type: 'npc_unused',
            npcId: nid,
            tab: 'npcs',
            message: `NPC «${n.name || nid}»: не привязан ни к одной сцене`
          });
        }
      });

      return holes;
    },

    openStoryHolesPanel() {
      const holes = this.collectStoryHoles();
      let modal = document.getElementById('story-holes-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'story-holes-modal';
        document.body.appendChild(modal);
      }
      const errors = holes.filter((h) => h.severity === 'error');
      const warns = holes.filter((h) => h.severity === 'warning');
      const infos = holes.filter((h) => h.severity === 'info');

      const row = (h) => {
        const sev = h.severity === 'error' ? '🔴' : h.severity === 'warning' ? '🟡' : '🔵';
        const go = h.sceneId
          ? `Editor.closeStoryHolesPanel();Editor.openSceneFromGraph?.(${JSON.stringify(h.sceneId)})`
          : h.questId
            ? `Editor.closeStoryHolesPanel();Editor.editingQuestId=${JSON.stringify(h.questId)};Editor.switchTab('quests');Editor.renderQuests?.()`
            : h.npcId
              ? `Editor.closeStoryHolesPanel();Editor.editingNpcId=${JSON.stringify(h.npcId)};Editor.switchTab('npcs');Editor.renderNPCs?.()`
              : 'Editor.closeStoryHolesPanel()';
        return `<button type="button" class="sh-row" onclick="${go}">
          <span class="sh-sev">${sev}</span>
          <span class="sh-msg">${this.escapeHtml(h.message)}</span>
        </button>`;
      };

      modal.innerHTML = `
        <div class="ps-backdrop" onclick="Editor.closeStoryHolesPanel()"></div>
        <div class="ps-panel sh-panel" onclick="event.stopPropagation()">
          <div class="ps-head">
            <h3 style="margin:0;flex:1;">🕳️ Дыры сюжета</h3>
            <button type="button" class="btn btn-secondary" onclick="Editor.closeStoryHolesPanel()">Закрыть</button>
          </div>
          <p class="hint" style="padding:0 12px;">
            Ошибок: ${errors.length}, предупреждений: ${warns.length}, заметок: ${infos.length}.
            Клик — перейти к месту.
          </p>
          <div class="ps-results sh-list">
            ${holes.length ? holes.map(row).join('') : '<p class="hint" style="padding:16px;">✓ Явных дыр не найдено</p>'}
          </div>
        </div>`;
    },

    closeStoryHolesPanel() {
      document.getElementById('story-holes-modal')?.remove();
    }
  });

  // Hotkey Ctrl+K / Cmd+K
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      Editor.openProjectSearch();
    }
    if (mod && e.shiftKey && (e.key === 'h' || e.key === 'H')) {
      e.preventDefault();
      Editor.openStoryHolesPanel();
    }
  });

  // Toolbar buttons
  const inject = () => {
    if (document.getElementById('btn-project-search')) return;
    const host =
      document.getElementById('btn-campaign-wizard')?.parentElement ||
      document.getElementById('editor-mode-toggle')?.parentElement ||
      document.querySelector('.sidebar-header');
    if (!host) return;
    const s = document.createElement('button');
    s.type = 'button';
    s.id = 'btn-project-search';
    s.className = 'btn btn-secondary';
    s.style.cssText = 'margin-top:6px;width:100%;font-size:12px;';
    s.textContent = '🔍 Поиск (Ctrl+K)';
    s.onclick = () => Editor.openProjectSearch();
    host.appendChild(s);
    const h = document.createElement('button');
    h.type = 'button';
    h.id = 'btn-story-holes';
    h.className = 'btn btn-secondary';
    h.style.cssText = 'margin-top:4px;width:100%;font-size:12px;';
    h.textContent = '🕳️ Дыры сюжета';
    h.onclick = () => Editor.openStoryHolesPanel();
    host.appendChild(h);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(inject, 200));
  } else {
    setTimeout(inject, 200);
  }

  if (!document.getElementById('project-search-styles')) {
    const st = document.createElement('style');
    st.id = 'project-search-styles';
    st.textContent = `
      #project-search-modal, #story-holes-modal {
        position: fixed; inset: 0; z-index: 10000; display: flex;
        align-items: flex-start; justify-content: center; padding-top: 12vh;
      }
      .ps-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.45); }
      .ps-panel {
        position: relative; z-index: 1; width: min(560px, 94vw);
        background: var(--paper, #f5f0e8); color: var(--ink, #2c2418);
        border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,0.25);
        overflow: hidden; display: flex; flex-direction: column; max-height: 70vh;
      }
      .ps-head { display: flex; gap: 8px; padding: 12px; border-bottom: 1px solid var(--border, #ccc); align-items: center; }
      .ps-head input[type=search] {
        flex: 1; font-size: 16px; padding: 10px 12px; border-radius: 8px;
        border: 1px solid var(--border, #ccc); background: var(--card-bg, #fff); color: inherit;
      }
      .ps-results { overflow-y: auto; flex: 1; }
      .ps-result, .sh-row {
        display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: baseline;
        width: 100%; text-align: left; padding: 10px 14px; border: none; border-bottom: 1px solid var(--border, #eee);
        background: transparent; color: inherit; cursor: pointer; font: inherit;
      }
      .ps-result:hover, .sh-row:hover { background: rgba(0,0,0,0.05); }
      .ps-kind {
        font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em;
        opacity: 0.7; min-width: 64px;
      }
      .ps-title { font-weight: 600; flex: 1; }
      .ps-id { font-size: 11px; }
      .ps-footer { padding: 8px 12px; border-top: 1px solid var(--border, #ccc); font-size: 11px; }
      .sh-msg { flex: 1; font-size: 13px; }
      .sh-sev { flex-shrink: 0; }
    `;
    document.head.appendChild(st);
  }
})();
