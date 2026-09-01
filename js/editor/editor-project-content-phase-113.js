/**
 * Phase 1.13 — Project Content Management (authoring UX only)
 * Extends scene list: search, filter, duplicate, safe delete, overview, empty states.
 * Reuses EditorContentIndex + ProjectValidator — no second navigation system.
 */
(function attachEditorProjectContentPhase113() {
  'use strict';

  if (typeof Editor === 'undefined') return;

  const IDX = typeof EditorContentIndex !== 'undefined' ? EditorContentIndex : null;

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

  Editor._sceneListQuery = Editor._sceneListQuery || '';
  Editor._sceneListFilter = Editor._sceneListFilter || 'all';

  Object.assign(Editor, {
    getProjectOverviewStats() {
      if (typeof this.getProjectContentStats === 'function') {
        return this.getProjectContentStats();
      }
      if (IDX) return IDX.collectProjectContentStats(this.data || {});
      return {};
    },

    searchProjectScenes(query, filter) {
      if (!IDX) return [];
      return IDX.searchScenes(this.data || {}, {
        query: query != null ? query : this._sceneListQuery,
        filter: filter != null ? filter : this._sceneListFilter
      });
    },

    findSceneInboundReferences(sceneId) {
      if (IDX && typeof IDX.findSceneReferences === 'function') {
        return IDX.findSceneReferences(sceneId, this.data || {});
      }
      return [];
    },

    /**
     * Duplicate scene → new unique id. Does not rewrite external links.
     * @returns {string|null} new scene id
     */
    duplicateScene(sceneId) {
      if (!this.data?.scenes?.[sceneId]) {
        this.toast?.warning?.('Сцена не найдена');
        return null;
      }
      if (!IDX || typeof IDX.buildDuplicatedScene !== 'function') {
        if (typeof this.duplicateStoryFlowScene === 'function') {
          this.duplicateStoryFlowScene(sceneId);
          return null;
        }
        return null;
      }
      const built = IDX.buildDuplicatedScene(sceneId, this.data.scenes[sceneId], this.data.scenes);
      this.data.scenes[built.id] = built.scene;
      this.currentScene = built.id;
      this.updateJSONPreview?.();
      this.renderSceneList?.();
      this.renderSceneEditor?.();
      this.refreshDashboardIfVisible?.();
      if (typeof this.openSceneDocument === 'function') this.openSceneDocument(built.id);
      this.toast?.success?.('Сцена скопирована: ' + built.id);
      return built.id;
    },

    /**
     * Safe delete with reference report. Never silent when refs exist.
     */
    async deleteSceneSafe(sceneId) {
      if (!this.data?.scenes?.[sceneId]) return false;
      const ids = Object.keys(this.data.scenes);
      if (ids.length <= 1) {
        Editor.toast.warning('Нельзя удалить последнюю сцену');
        return false;
      }

      const refs = this.findSceneInboundReferences(sceneId);
      let extra = '';
      if (typeof ProjectValidator !== 'undefined' && ProjectValidator.validateProject) {
        try {
          const report = ProjectValidator.validateProject(this.data);
          const related = (report.issues || []).filter((iss) =>
            iss.entityId === sceneId || iss.sceneId === sceneId || iss.targetId === sceneId
          );
          if (related.length) {
            extra = '\n\nValidator: ' + related.slice(0, 5).map((i) => i.type + ' — ' + i.message).join('\n');
          }
        } catch (e) { /* */ }
      }

      let msg = 'Удалить сцену «' + sceneId + '»?';
      if (refs.length) {
        msg =
          'Сцена «' + sceneId + '» используется (' + refs.length + '):\n' +
          refs.slice(0, 12).map((r) =>
            '• [' + r.kind + '] ' + r.fromId + (r.label ? ' — ' + r.label : '')
          ).join('\n') +
          (refs.length > 12 ? '\n… ещё ' + (refs.length - 12) : '') +
          '\n\nВнешние ссылки НЕ будут исправлены автоматически.' +
          extra +
          '\n\nВсё равно удалить?';
      } else {
        msg = 'Удалить сцену «' + sceneId + '»?\nСсылок на неё не найдено.' + extra;
      }

      if (!(await Editor.confirmDialog({ message: msg, danger: true }))) return false;

      delete this.data.scenes[sceneId];
      if (this.currentScene === sceneId) {
        this.currentScene = Object.keys(this.data.scenes)[0];
      }
      this.updateJSONPreview?.();
      this.renderSceneList?.();
      this.renderSceneEditor?.();
      this.refreshDashboardIfVisible?.();
      this.toast?.success?.('Сцена удалена');
      return true;
    },

    renderProjectOverviewBar() {
      const stats = this.getProjectOverviewStats() || {};
      return (
        '<div class="pcm-overview" id="pcm-overview" title="Project overview">' +
        '<span>Scenes <b>' + (stats.scenes || 0) + '</b></span>' +
        '<span>Visual <b>' + (stats.visual_scenes || 0) + '</b></span>' +
        '<span>UI <b>' + (stats.ui_screens || 0) + '</b></span>' +
        '<span>Items <b>' + (stats.items || 0) + '</b></span>' +
        '<span>Quests <b>' + (stats.quests || 0) + '</b></span>' +
        '<span>NPC <b>' + (stats.npcs || 0) + '</b></span>' +
        '</div>'
      );
    },

    renderSceneListEmptyState() {
      return (
        '<div class="pcm-empty" id="pcm-empty">' +
        '<p class="hint">Проект без сцен — создайте первую:</p>' +
        '<button type="button" class="btn btn-primary btn-sm" data-pcm="create-text">TEXT Scene</button> ' +
        '<button type="button" class="btn btn-info btn-sm" data-pcm="create-visual">Visual Scene</button> ' +
        '<button type="button" class="btn btn-secondary btn-sm" data-pcm="create-ui">Game UI</button>' +
        '</div>'
      );
    },

    ensureSceneListChrome() {
      if (document.getElementById('cb-browser-chrome')?.classList?.contains('cb2-browser-chrome')) return;
      const sidebar = document.getElementById('context-sidebar');
      if (!sidebar) return;
      if (!document.getElementById('pcm-chrome')) {
        const chrome = document.createElement('div');
        chrome.id = 'pcm-chrome';
        chrome.className = 'pcm-chrome';
        chrome.innerHTML =
          this.renderProjectOverviewBar() +
          '<div class="pcm-tools">' +
          '<input type="search" id="pcm-scene-search" class="pcm-search" placeholder="Поиск сцен…" ' +
          'value="' + escAttr(this._sceneListQuery) + '" />' +
          '<select id="pcm-scene-filter" class="pcm-filter" title="Filter">' +
          '<option value="all"' + (this._sceneListFilter === 'all' ? ' selected' : '') + '>Все</option>' +
          '<option value="text"' + (this._sceneListFilter === 'text' ? ' selected' : '') + '>TEXT</option>' +
          '<option value="visual"' + (this._sceneListFilter === 'visual' ? ' selected' : '') + '>Visual</option>' +
          '<option value="mixed"' + (this._sceneListFilter === 'mixed' ? ' selected' : '') + '>Mixed</option>' +
          '<option value="ui"' + (this._sceneListFilter === 'ui' ? ' selected' : '') + '>UI-linked</option>' +
          '</select>' +
          '</div>';
        const sceneList = document.getElementById('scene-list');
        const scenesPane = document.getElementById('context-scenes-pane');
        const parent = (sceneList && sceneList.parentNode) || scenesPane || sidebar;
        if (sceneList && sceneList.parentNode === parent) {
          parent.insertBefore(chrome, sceneList);
        } else if (scenesPane && scenesPane.parentNode === sidebar) {
          scenesPane.insertBefore(chrome, scenesPane.firstChild);
        } else {
          sidebar.insertBefore(chrome, sidebar.firstChild);
        }

        chrome.querySelector('#pcm-scene-search')?.addEventListener('input', (ev) => {
          this._sceneListQuery = ev.target.value || '';
          this.renderSceneList?.();
        });
        chrome.querySelector('#pcm-scene-filter')?.addEventListener('change', (ev) => {
          this._sceneListFilter = ev.target.value || 'all';
          this.renderSceneList?.();
        });
      } else {
        const ov = document.getElementById('pcm-overview');
        if (ov) ov.outerHTML = this.renderProjectOverviewBar();
      }
    },

    bindPcmEmptyActions(root) {
      if (!root || root._pcmBound) return;
      root._pcmBound = true;
      root.addEventListener('click', (ev) => {
        const btn = ev.target.closest('[data-pcm]');
        if (!btn) return;
        const act = btn.getAttribute('data-pcm');
        if (act === 'create-text') {
          this.openSceneWizard({ displayMode: 'text' });
        } else if (act === 'create-visual') {
          this.openSceneWizard({ displayMode: 'visual' });
        } else if (act === 'create-ui') {
          this.switchTab?.('game_ui');
          this.uiAddScreen?.();
        } else if (act === 'dup') {
          const id = btn.getAttribute('data-id');
          if (id) this.duplicateScene(id);
        } else if (act === 'del') {
          const id = btn.getAttribute('data-id');
          if (id) this.deleteSceneSafe(id);
        }
      });
    }
  });

  // ——— Enhance scene list via hooks.replace (no late Editor.renderSceneList =) ———
  function renderSceneListWithContentMgmt() {
    this.ensureSceneListChrome?.();
    const list = document.getElementById('scene-list');
    if (!list) return;

    if (!this.data?.scenes) {
      list.innerHTML = '';
      return;
    }

    const entries = Object.keys(this.data.scenes);
    if (!entries.length) {
      list.innerHTML = this.renderSceneListEmptyState?.() || '<p class="hint">Нет сцен</p>';
      this.bindPcmEmptyActions(list);
      return;
    }

    const filtered = typeof this.searchProjectScenes === 'function'
      ? this.searchProjectScenes(this._sceneListQuery, this._sceneListFilter)
      : entries.map((id) => ({ id, title: id, kind: 'text' }));

    if (!filtered.length) {
      list.innerHTML = '<p class="hint pcm-no-match">Ничего не найдено</p>';
      return;
    }

    list.innerHTML = filtered.map((row) => {
      const id = row.id;
      const scene = this.data.scenes[id] || row.scene || {};
      const preview = scene.text ? String(scene.text).substring(0, 60) + '…' : 'Нет текста';
      const active = this.currentScene === id ? 'active' : '';
      const title = row.title || scene.location || scene.title || id;
      const kind = row.kind || (IDX ? IDX.getSceneKind(scene) : 'text');
      const badge =
        kind === 'visual' ? 'Visual' :
          kind === 'mixed' ? 'Mixed' :
            'TEXT';
      const badgeCls =
        kind === 'visual' ? 'pcm-badge--visual' :
          kind === 'mixed' ? 'pcm-badge--mixed' :
            'pcm-badge--text';
      return (
        '<div class="scene-item pcm-scene-item ' + escAttr(active) + '" data-scene-id="' + escAttr(id) + '">' +
        '<div class="pcm-scene-main" onclick="' + escAttr('Editor.openSceneDocument(' + JSON.stringify(id) + ')') + '">' +
        '<div class="scene-loc">' + esc(title) +
        ' <span class="pcm-badge ' + badgeCls + '">' + badge + '</span>' +
        (row.uiLinked ? ' <span class="pcm-badge pcm-badge--ui">UI</span>' : '') +
        '</div>' +
        '<div class="scene-id hint" data-label="code" title="Системный код">' + esc(id) + '</div>' +
        '<div class="scene-preview">' + esc(preview) + '</div>' +
        '</div>' +
        '<div class="pcm-scene-actions">' +
        '<button type="button" class="btn btn-secondary btn-sm" data-pcm="dup" data-id="' + escAttr(id) + '" title="Duplicate">⧉</button>' +
        '<button type="button" class="btn btn-danger btn-sm" data-pcm="del" data-id="' + escAttr(id) + '" title="Delete">🗑</button>' +
        '</div></div>'
      );
    }).join('');

    this.bindPcmEmptyActions(list);
  }

  if (Editor.hooks && typeof Editor.hooks.replace === 'function') {
    Editor.hooks.replace('renderSceneList', function () {
      return renderSceneListWithContentMgmt.call(this);
    }, 'editor-project-content-phase-113');
  } else {
    console.warn('[pcm] Editor.hooks.replace missing — scene list chrome may not attach');
  }

  // Safe delete via hooks.replace
  if (Editor.hooks && typeof Editor.hooks.replace === 'function') {
    Editor.hooks.replace('deleteScene', function deleteScenePhase113(id) {
      if (typeof this.deleteSceneSafe === 'function') {
        return this.deleteSceneSafe(id);
      }
      return undefined;
    }, 'editor-project-content-phase-113');
  }

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-project-content-phase-113', {
      duplicateScene: Editor.duplicateScene,
      deleteSceneSafe: Editor.deleteSceneSafe
    }, { force: true });
  }

  if (Editor.commands?.register) {
    Editor.commands.register({
      id: 'scene.duplicate',
      title: 'Duplicate scene',
      category: 'Сцены',
      keywords: ['duplicate', 'copy', 'копия'],
      action() {
        if (Editor.currentScene) Editor.duplicateScene(Editor.currentScene);
      }
    });
  }

  // Styles once
  if (typeof document !== 'undefined' && !document.getElementById('pcm-styles')) {
    const st = document.createElement('style');
    st.id = 'pcm-styles';
    st.textContent = `
      .pcm-chrome { margin: 0 0 8px; }
      .pcm-overview {
        display: flex; flex-wrap: wrap; gap: 6px 10px; font-size: 11px;
        color: var(--muted, #666); margin-bottom: 6px;
      }
      .pcm-overview b { color: var(--text, #222); }
      .pcm-tools { display: flex; gap: 4px; margin-bottom: 6px; }
      .pcm-search { flex: 1; min-width: 0; font-size: 12px; padding: 4px 6px; }
      .pcm-filter { max-width: 96px; font-size: 11px; }
      .pcm-scene-item {
        display: flex; align-items: flex-start; gap: 4px;
        border-bottom: 1px solid rgba(0,0,0,.06);
      }
      .pcm-scene-main { flex: 1; min-width: 0; cursor: pointer; padding: 6px 4px; }
      .pcm-scene-actions { display: flex; flex-direction: column; gap: 2px; padding: 4px 2px; }
      .pcm-badge {
        display: inline-block; font-size: 9px; padding: 1px 4px; border-radius: 3px;
        font-weight: 600; vertical-align: middle;
      }
      .pcm-badge--text { background: #e3f2fd; color: #1565c0; }
      .pcm-badge--visual { background: #f3e5f5; color: #6a1b9a; }
      .pcm-badge--mixed { background: #fff3e0; color: #e65100; }
      .pcm-badge--ui { background: #e8f5e9; color: #2e7d32; }
      .pcm-empty { padding: 10px 4px; }
      .pcm-empty .btn { margin: 2px 0; }
    `;
    document.head.appendChild(st);
  }
})();
