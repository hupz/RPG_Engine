/**
 * Phase I — UX Polish: align, context menu, shortcuts, mobile preview, village wizard
 */
(function attachEditorUxPhaseI() {
  'use strict';

  if (typeof Editor === 'undefined') return;

  const STORAGE_WIZARD = 'rpg_editor_village_wizard_v1';

  /** @type {{ visual: boolean, ui: boolean }} */
  const mobilePreview = { visual: false, ui: false };

  function esc(s) {
    return typeof Editor.escapeHtml === 'function'
      ? Editor.escapeHtml(String(s == null ? '' : s))
      : String(s == null ? '' : s);
  }

  function cloneJson(v) {
    return v == null ? v : JSON.parse(JSON.stringify(v));
  }

  function sceneCtx() {
    const id = Editor.currentScene;
    return id ? { type: 'scene', id } : null;
  }

  function mutateVisualScene(mutateFn) {
    const sid = Editor.currentScene;
    const scene = sid && Editor.data?.scenes?.[sid];
    if (!scene) return false;
    const before = cloneJson(scene);
    mutateFn(scene);
    if (typeof EditorHistory !== 'undefined' && EditorHistory.recordMutation && sceneCtx()) {
      try {
        EditorHistory.recordMutation(sceneCtx(), before);
      } catch (_) { /* optional */ }
    }
    Editor.markDirty?.();
    return true;
  }

  function getVisualNodesByIds(ids) {
    const scene = Editor.currentScene && Editor.data?.scenes?.[Editor.currentScene];
    const nodes = scene?.visual?.nodes || [];
    return nodes.filter((n) => ids.indexOf(n.id) >= 0 && !n.locked);
  }

  function selectedVisualIds() {
    if (typeof Editor.visualGetSelectedIds === 'function') return Editor.visualGetSelectedIds();
    return Editor._visualSelectedNodeId ? [Editor._visualSelectedNodeId] : [];
  }

  // ——— Pure layout helpers (testable) ———

  function nodeBounds(n) {
    const t = n.transform || {};
    const x = Number(t.x) || 0;
    const y = Number(t.y) || 0;
    const w = Number(t.w) || 0.1;
    const h = Number(t.h) || 0.1;
    return { id: n.id, x, y, w, h, cx: x + w / 2, cy: y + h / 2, r: x + w, b: y + h };
  }

  function computeAlignUpdates(nodes, mode) {
    if (!Array.isArray(nodes) || nodes.length < 2) return {};
    const b = nodes.map(nodeBounds);
    const updates = {};
    const setX = (id, x) => {
      updates[id] = updates[id] || {};
      updates[id].x = Math.max(0, Math.min(1, x));
    };
    const setY = (id, y) => {
      updates[id] = updates[id] || {};
      updates[id].y = Math.max(0, Math.min(1, y));
    };

    switch (mode) {
      case 'left':
        b.forEach((n) => setX(n.id, Math.min(...b.map((x) => x.x))));
        break;
      case 'center-h': {
        const cx = b.reduce((s, n) => s + n.cx, 0) / b.length;
        b.forEach((n) => setX(n.id, cx - n.w / 2));
        break;
      }
      case 'right':
        b.forEach((n) => setX(n.id, Math.max(...b.map((x) => x.r)) - n.w));
        break;
      case 'top':
        b.forEach((n) => setY(n.id, Math.min(...b.map((x) => x.y))));
        break;
      case 'center-v': {
        const cy = b.reduce((s, n) => s + n.cy, 0) / b.length;
        b.forEach((n) => setY(n.id, cy - n.h / 2));
        break;
      }
      case 'bottom':
        b.forEach((n) => setY(n.id, Math.max(...b.map((x) => x.b)) - n.h));
        break;
      default:
        return {};
    }
    return updates;
  }

  function computeDistributeUpdates(nodes, axis) {
    if (!Array.isArray(nodes) || nodes.length < 3) return {};
    const b = nodes.map(nodeBounds).sort((a, z) => (
      axis === 'vertical' ? a.y - z.y : a.x - z.x
    ));
    const updates = {};
    const first = b[0];
    const last = b[b.length - 1];
    const span = axis === 'vertical'
      ? last.cy - first.cy
      : last.cx - first.cx;
    if (span <= 0) return {};
    const step = span / (b.length - 1);
    b.forEach((n, i) => {
      if (i === 0 || i === b.length - 1) return;
      updates[n.id] = updates[n.id] || {};
      if (axis === 'vertical') {
        updates[n.id].y = first.cy + step * i - n.h / 2;
      } else {
        updates[n.id].x = first.cx + step * i - n.w / 2;
      }
    });
    return updates;
  }

  function applyTransformUpdates(nodes, updates) {
    nodes.forEach((n) => {
      const u = updates[n.id];
      if (!u || !n.transform) return;
      if (u.x != null) n.transform.x = u.x;
      if (u.y != null) n.transform.y = u.y;
    });
  }

  // ——— Editor APIs ———

  Object.assign(Editor, {
    visualAlignSelected(mode) {
      const ids = selectedVisualIds();
      const nodes = getVisualNodesByIds(ids);
      const updates = computeAlignUpdates(nodes, mode);
      if (!Object.keys(updates).length) {
        Editor.toast?.info('Выберите 2+ незаблокированных узла');
        return false;
      }
      mutateVisualScene((scene) => {
        const all = scene.visual?.nodes || [];
        applyTransformUpdates(all.filter((n) => updates[n.id]), updates);
      });
      Editor.renderVisualScenePanel?.();
      return true;
    },

    visualDistributeSelected(axis) {
      const ids = selectedVisualIds();
      const nodes = getVisualNodesByIds(ids);
      const updates = computeDistributeUpdates(nodes, axis);
      if (!Object.keys(updates).length) {
        Editor.toast?.info('Для распределения нужно 3+ узла');
        return false;
      }
      mutateVisualScene((scene) => {
        const all = scene.visual?.nodes || [];
        applyTransformUpdates(all.filter((n) => updates[n.id]), updates);
      });
      Editor.renderVisualScenePanel?.();
      return true;
    },

    visualDuplicateSelected() {
      const ids = selectedVisualIds();
      if (!ids.length) return false;
      const nodes = getVisualNodesByIds(ids);
      if (!nodes.length) return false;
      mutateVisualScene((scene) => {
        if (!scene.visual) scene.visual = { mode: 'overlay', nodes: [] };
        if (!Array.isArray(scene.visual.nodes)) scene.visual.nodes = [];
        const pasted = [];
        nodes.forEach((src, i) => {
          const copy = cloneJson(src);
          copy.id = (copy.kind || 'node') + '_dup_' + Date.now().toString(36) + '_' + i;
          if (copy.transform) {
            copy.transform.x = Math.min(0.92, (copy.transform.x || 0) + 0.03);
            copy.transform.y = Math.min(0.92, (copy.transform.y || 0) + 0.03);
          }
          scene.visual.nodes.push(copy);
          pasted.push(copy.id);
        });
        if (typeof Editor.visualSetSelectedIds === 'function') Editor.visualSetSelectedIds(pasted);
        else if (pasted[0]) Editor._visualSelectedNodeId = pasted[0];
      });
      Editor.renderVisualScenePanel?.();
      Editor.toast?.success('Дублировано: ' + nodes.length);
      return true;
    },

    toggleMobilePreview(target) {
      const t = target === 'ui' ? 'ui' : 'visual';
      mobilePreview[t] = !mobilePreview[t];
      applyMobilePreviewClasses();
      Editor.toast?.info(t === 'ui' ? 'UI mobile preview' : 'Visual mobile preview', mobilePreview[t] ? '390px' : 'off');
      return mobilePreview[t];
    },

    getMobilePreviewState() {
      return { visual: mobilePreview.visual, ui: mobilePreview.ui };
    },

    openShortcutsHelp() {
      const lines = [
        'Ctrl+K — палитра команд',
        'Ctrl+Z / Ctrl+Shift+Z — отмена / повтор',
        'Ctrl+C / Ctrl+V — копировать / вставить узлы (visual)',
        'Ctrl+D — дублировать выделение',
        'Delete — удалить visual-узел',
        'Shift+клик — мультивыбор (visual)',
        'Ctrl+колёсико — zoom (visual viewport)',
        '? — эта справка'
      ];
      Editor.toast.info('Горячие клавиши\n\n' + lines.join('\n'));
    },

    async runVillageQuickstartWizard(opts) {
      opts = opts || {};
      if (!opts.force && localStorage.getItem(STORAGE_WIZARD)) {
        if (!(await Editor.confirmDialog({ message: 'Мастер «Деревня за 10 минут» уже проходился. Запустить снова?' }))) return;
      }
      VillageWizard.open(opts);
    }
  });

  // visualSetSelectedIds for phase-c multi-select
  if (typeof Editor.visualSetSelectedIds !== 'function') {
    Editor.visualSetSelectedIds = function (ids) {
      if (Editor._visualPhaseC) Editor._visualPhaseC.selectedIds = ids.slice();
      Editor._visualSelectedNodeId = ids[0] || null;
    };
  }

  // History for paste
  if (typeof Editor.visualPasteNodes === 'function' && !Editor._visualPasteHistoryWrapped) {
    const origPaste = Editor.visualPasteNodes;
    Editor.visualPasteNodes = function visualPasteNodesWithHistory() {
      const sid = Editor.currentScene;
      const scene = sid && Editor.data?.scenes?.[sid];
      const clip = Editor._visualPhaseC?.clipboard;
      if (!scene || !clip?.length) return origPaste.call(this);
      const before = cloneJson(scene);
      origPaste.call(this);
      if (typeof EditorHistory !== 'undefined' && EditorHistory.recordMutation) {
        try {
          EditorHistory.recordMutation({ type: 'scene', id: sid }, before);
        } catch (_) { /* optional */ }
      }
    };
    Editor._visualPasteHistoryWrapped = true;
  }

  // ——— Mobile preview CSS ———

  function injectStyles() {
    if (document.getElementById('editor-ux-phase-i-styles')) return;
    const st = document.createElement('style');
    st.id = 'editor-ux-phase-i-styles';
    st.textContent = `
      .ux-mobile-preview-frame {
        display: flex; justify-content: center; width: 100%;
      }
      .ux-mobile-preview-frame #visual-viewport,
      .ux-mobile-preview-frame #game-ui-viewport {
        max-width: 390px !important;
        box-shadow: 0 0 0 3px #334, 0 8px 24px rgba(0,0,0,0.35);
      }
      .ux-mobile-preview-frame::before {
        content: '390px'; font-size: 10px; color: #889; display: block; text-align: center; margin-bottom: 4px;
      }
      .ux-context-menu {
        position: fixed; z-index: 12000; min-width: 180px;
        background: var(--panel, #1e2433); border: 1px solid var(--border, #445);
        border-radius: 8px; padding: 4px 0; box-shadow: 0 8px 28px rgba(0,0,0,0.45);
        font-size: 13px;
      }
      .ux-context-menu button {
        display: block; width: 100%; text-align: left; border: 0; background: transparent;
        color: inherit; padding: 8px 14px; cursor: pointer;
      }
      .ux-context-menu button:hover { background: rgba(255,255,255,0.08); }
      .ux-context-menu button:disabled { opacity: 0.4; cursor: default; }
      .ux-context-menu hr { border: 0; border-top: 1px solid var(--border, #445); margin: 4px 0; }
      .ux-toolbar-group { display: inline-flex; gap: 2px; flex-wrap: wrap; align-items: center; }
      .ux-village-wizard-overlay {
        position: fixed; inset: 0; z-index: 13000; background: rgba(0,0,0,0.55);
        display: flex; align-items: center; justify-content: center; padding: 16px;
      }
      .ux-village-wizard-modal {
        max-width: 480px; width: 100%; background: var(--panel, #1a2030);
        border: 1px solid var(--border, #556); border-radius: 12px; padding: 20px;
      }
      .ux-village-wizard-modal h2 { margin: 0 0 8px; font-size: 18px; }
      .ux-village-wizard-modal p { margin: 0 0 16px; color: var(--muted, #aab); line-height: 1.45; }
      .ux-village-wizard-actions { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
    `;
    document.head.appendChild(st);
  }

  function wrapViewportForMobile(viewport, enabled) {
    if (!viewport) return;
    let frame = viewport.closest('.ux-mobile-preview-frame');
    if (enabled) {
      if (!frame) {
        frame = document.createElement('div');
        frame.className = 'ux-mobile-preview-frame';
        viewport.parentNode.insertBefore(frame, viewport);
        frame.appendChild(viewport);
      }
    } else if (frame && frame.parentNode) {
      frame.parentNode.insertBefore(viewport, frame);
      frame.remove();
    }
  }

  function applyMobilePreviewClasses() {
    wrapViewportForMobile(document.getElementById('visual-viewport'), mobilePreview.visual);
    wrapViewportForMobile(document.getElementById('game-ui-viewport'), mobilePreview.ui);
  }

  // ——— Context menu ———

  let ctxMenuEl = null;
  let ctxTarget = null;

  function closeContextMenu() {
    if (ctxMenuEl) ctxMenuEl.remove();
    ctxMenuEl = null;
    ctxTarget = null;
  }

  function openContextMenu(x, y, items) {
    closeContextMenu();
    injectStyles();
    ctxMenuEl = document.createElement('div');
    ctxMenuEl.className = 'ux-context-menu';
    ctxMenuEl.setAttribute('role', 'menu');
    items.forEach((item) => {
      if (item === 'sep') {
        ctxMenuEl.appendChild(document.createElement('hr'));
        return;
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = item.label;
      btn.disabled = !!item.disabled;
      btn.addEventListener('click', () => {
        closeContextMenu();
        if (!item.disabled && typeof item.action === 'function') item.action();
      });
      ctxMenuEl.appendChild(btn);
    });
    document.body.appendChild(ctxMenuEl);
    const rect = ctxMenuEl.getBoundingClientRect();
    ctxMenuEl.style.left = Math.min(x, window.innerWidth - rect.width - 8) + 'px';
    ctxMenuEl.style.top = Math.min(y, window.innerHeight - rect.height - 8) + 'px';
  }

  function visualContextItems(nodeId) {
    const ids = selectedVisualIds();
    const hasSel = ids.length > 0 || !!nodeId;
    const nid = nodeId || ids[0];
    const node = nid && Editor.data?.scenes?.[Editor.currentScene]?.visual?.nodes?.find((n) => n.id === nid);
    return [
      { label: 'Копировать (Ctrl+C)', action: () => Editor.visualCopySelected?.(), disabled: !hasSel },
      { label: 'Вставить (Ctrl+V)', action: () => Editor.visualPasteNodes?.() },
      { label: 'Дублировать (Ctrl+D)', action: () => Editor.visualDuplicateSelected(), disabled: !hasSel },
      'sep',
      { label: 'Удалить (Del)', action: () => Editor.visualDeleteNode?.(nid), disabled: !nid },
      { label: node?.locked ? 'Разблокировать' : 'Заблокировать', action: () => Editor.visualToggleLock?.(nid), disabled: !nid },
      'sep',
      { label: 'Выровнять влево', action: () => Editor.visualAlignSelected('left'), disabled: ids.length < 2 },
      { label: 'Выровнять по центру (H)', action: () => Editor.visualAlignSelected('center-h'), disabled: ids.length < 2 },
      { label: 'Выровнять вправо', action: () => Editor.visualAlignSelected('right'), disabled: ids.length < 2 },
      { label: 'Распределить по горизонтали', action: () => Editor.visualDistributeSelected('horizontal'), disabled: ids.length < 3 },
      'sep',
      { label: 'Добавить hotspot', action: () => Editor.visualAddNode?.('hotspot') },
      { label: 'Mobile preview', action: () => Editor.toggleMobilePreview('visual') }
    ];
  }

  function uiContextItems(nodeId) {
    const nid = nodeId || Editor._uiSelectedNode;
    return [
      { label: 'Удалить элемент', action: () => Editor.uiDeleteNode?.(nid), disabled: !nid },
      { label: 'Заблокировать / разблокировать', action: () => {
        const sc = Editor.data?.ui?.screens?.[Editor._uiSelectedScreen];
        const n = sc?.nodes?.find((x) => x.id === nid);
        if (n) { n.locked = !n.locked; Editor.renderGameUiEditor?.(); Editor.markDirty?.(); }
      }, disabled: !nid },
      'sep',
      { label: 'Mobile preview', action: () => Editor.toggleMobilePreview('ui') }
    ];
  }

  function bindContextMenus() {
    document.addEventListener('contextmenu', (ev) => {
      const vp = ev.target.closest?.('#visual-viewport, #game-ui-viewport, .visual-vp-node, .game-ui-vp-node');
      if (!vp) return;
      ev.preventDefault();
      const isUi = !!ev.target.closest?.('#game-ui-viewport, .game-ui-vp-node');
      const nodeEl = ev.target.closest?.('[data-node-id]');
      const nodeId = nodeEl?.getAttribute('data-node-id') || null;
      if (nodeId && !isUi) Editor.visualSelectNode?.(nodeId);
      if (nodeId && isUi) Editor._uiSelectedNode = nodeId;
      openContextMenu(ev.clientX, ev.clientY, isUi ? uiContextItems(nodeId) : visualContextItems(nodeId));
    }, true);
    document.addEventListener('click', closeContextMenu);
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') closeContextMenu();
    });
  }

  // ——— Toolbar injection (align + mobile) ———

  function injectUxToolbar(host) {
    if (!host || host.querySelector('#ux-phase-i-toolbar')) return;
    const bar = host.querySelector('.visual-toolbar-row') || host.querySelector('.visual-toolbar');
    if (!bar) return;
    const group = document.createElement('div');
    group.id = 'ux-phase-i-toolbar';
    group.className = 'ux-toolbar-group';
    group.innerHTML =
      '<span style="font-size:11px;color:#889;margin-right:4px">Align:</span>' +
      '<button type="button" class="btn btn-secondary btn-sm" data-ux="align-left" title="Влево">⬅</button>' +
      '<button type="button" class="btn btn-secondary btn-sm" data-ux="align-ch" title="Центр H">↔</button>' +
      '<button type="button" class="btn btn-secondary btn-sm" data-ux="align-right" title="Вправо">➡</button>' +
      '<button type="button" class="btn btn-secondary btn-sm" data-ux="dist-h" title="Распределить H">⇹</button>' +
      '<button type="button" class="btn btn-secondary btn-sm" data-ux="mobile" title="Mobile 390px">📱</button>';
    group.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-ux]');
      if (!b) return;
      const a = b.getAttribute('data-ux');
      if (a === 'align-left') Editor.visualAlignSelected('left');
      else if (a === 'align-ch') Editor.visualAlignSelected('center-h');
      else if (a === 'align-right') Editor.visualAlignSelected('right');
      else if (a === 'dist-h') Editor.visualDistributeSelected('horizontal');
      else if (a === 'mobile') Editor.toggleMobilePreview('visual');
    });
    bar.appendChild(group);
  }

  if (Editor.hooks?.after) {
    Editor.hooks.after('renderVisualScenePanel', function uxToolbarHook() {
      try {
        injectStyles();
        injectUxToolbar(document.getElementById('visual-scene-editor-panel'));
        applyMobilePreviewClasses();
      } catch (e) {
        console.warn('[phase-i]', e);
      }
    }, 'editor-ux-phase-i-toolbar');
    Editor.hooks.after('renderGameUiEditor', function uxUiMobileHook() {
      applyMobilePreviewClasses();
    }, 'editor-ux-phase-i-ui-mobile');
  }

  // ——— Global keyboard shortcuts ———

  function bindGlobalShortcuts() {
    document.addEventListener('keydown', (ev) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || document.activeElement?.isContentEditable;
      if (typing) return;

      if (ev.key === '?' && !ev.ctrlKey && !ev.metaKey) {
        ev.preventDefault();
        Editor.openShortcutsHelp();
        return;
      }

      const onVisual = Editor.currentTab === 'scenes' && document.getElementById('visual-scene-editor-panel')?.offsetParent;
      if (!onVisual) return;

      if (ev.key === 'Delete' || ev.key === 'Backspace') {
        const ids = selectedVisualIds();
        if (ids.length) {
          ev.preventDefault();
          ids.slice().forEach((id) => Editor.visualDeleteNode?.(id));
        }
      }
      if ((ev.ctrlKey || ev.metaKey) && ev.key === 'd') {
        ev.preventDefault();
        Editor.visualDuplicateSelected();
      }
    });
  }

  // ——— Village wizard ———

  const VillageWizard = {
    step: 0,
    overlay: null,

    open(opts) {
      this.step = 0;
      this._build();
      this._renderStep();
    },

    close(done) {
      if (this.overlay) this.overlay.remove();
      this.overlay = null;
      if (done) localStorage.setItem(STORAGE_WIZARD, '1');
    },

    _build() {
      injectStyles();
      this.overlay = document.createElement('div');
      this.overlay.className = 'ux-village-wizard-overlay';
      this.overlay.innerHTML =
        '<div class="ux-village-wizard-modal" role="dialog">' +
        '<h2 id="ux-vw-title"></h2>' +
        '<p id="ux-vw-text"></p>' +
        '<div class="ux-village-wizard-actions">' +
        '<button type="button" class="btn btn-secondary" id="ux-vw-skip">Пропустить</button>' +
        '<button type="button" class="btn btn-primary" id="ux-vw-next">Далее</button>' +
        '</div></div>';
      document.body.appendChild(this.overlay);
      this.overlay.querySelector('#ux-vw-skip').addEventListener('click', () => this.close(true));
      this.overlay.querySelector('#ux-vw-next').addEventListener('click', () => this._next());
    },

    _steps() {
      return [
        {
          title: 'Деревня за 10 минут',
          text: 'Мастер создаст visual-сцену с hotspots, встроенные префабы и HUD. Можно править всё без кода.',
          run: () => true
        },
        {
          title: 'Шаблон сцены',
          text: 'Применим шаблон Point-and-click: Деревня к текущей сцене (или создадим новую).',
          run: () => {
            if (!Editor.data) {
              Editor.toast.warning('Сначала загрузите или создайте проект.');
              return false;
            }
            Editor.switchTab?.('scenes');
            if (typeof Editor.applySceneTemplatePack === 'function') {
              if (!Editor.currentScene && typeof Editor.createBlankScene === 'function') Editor.createBlankScene();
              Editor.applySceneTemplatePack('tpl_visual_village', { applyToCurrent: true });
            }
            return true;
          }
        },
        {
          title: 'Префабы',
          text: 'Добавим встроенную библиотеку префабов (деревня + HUD).',
          run: () => {
            Editor.seedBuiltinPrefabs?.(true);
            const sid = Editor.currentScene;
            if (sid && Editor.data?.ui) {
              if (!Editor.data.ui.screens) Editor.data.ui.screens = {};
              if (!Editor.data.ui.screens.hud) {
                Editor.data.ui.screens.hud = {
                  id: 'hud',
                  scope: 'scene',
                  sceneId: sid,
                  nodes: []
                };
              }
              Editor._uiSelectedScreen = 'hud';
              Editor.insertUiPrefab?.('pf_hud_actions');
            }
            Editor.markDirty?.();
            Editor.renderVisualScenePanel?.();
            return true;
          }
        },
        {
          title: 'Проверка и Play',
          text: 'Запустим валидацию и встроенный Play для текущей сцены.',
          run: () => {
            const r = Editor.validateProjectExportReady?.();
            if (r && !r.ok && r.errors?.length) {
              Editor.showProjectValidationResults?.(r);
            }
            Editor.startEmbeddedPlay?.({ sceneId: Editor.currentScene });
            return true;
          }
        },
        {
          title: 'Готово!',
          text: 'Деревня собрана. Откройте Prefabs, Variables и Flow map в настройках Writer Mode.',
          run: () => {
            this.close(true);
            Editor.toast?.success('Мастер завершён — редактируйте hotspots и UI');
            return true;
          }
        }
      ];
    },

    _renderStep() {
      const steps = this._steps();
      const s = steps[this.step];
      if (!s || !this.overlay) return;
      this.overlay.querySelector('#ux-vw-title').textContent = s.title;
      this.overlay.querySelector('#ux-vw-text').textContent = s.text;
      const nextBtn = this.overlay.querySelector('#ux-vw-next');
      nextBtn.textContent = this.step >= steps.length - 1 ? 'Завершить' : 'Далее';
    },

    _next() {
      const steps = this._steps();
      const s = steps[this.step];
      if (s && s.run() === false) return;
      if (this.step >= steps.length - 1) {
        this.close(true);
        return;
      }
      this.step += 1;
      this._renderStep();
    }
  };

  // ——— Command palette ———

  function safe(fn) {
    return function () {
      try {
        return fn.call(Editor);
      } catch (e) {
        console.error(e);
        return false;
      }
    };
  }

  if (Editor.commands?.registerMany) {
    Editor.commands.registerMany([
      {
        id: 'ux.village.wizard',
        title: 'Мастер: Деревня за 10 минут',
        category: 'UX',
        keywords: ['wizard', 'village', 'onboarding', 'деревня'],
        action: safe(() => Editor.runVillageQuickstartWizard({ force: true }))
      },
      {
        id: 'ux.shortcuts',
        title: 'Справка: горячие клавиши',
        category: 'UX',
        keywords: ['help', 'keyboard', 'shortcuts'],
        action: safe(() => Editor.openShortcutsHelp())
      },
      {
        id: 'ux.mobile.visual',
        title: 'Mobile preview: Visual',
        category: 'UX',
        keywords: ['mobile', '390', 'phone'],
        action: safe(() => Editor.toggleMobilePreview('visual'))
      },
      {
        id: 'ux.mobile.ui',
        title: 'Mobile preview: UI',
        category: 'UX',
        keywords: ['mobile', 'ui'],
        action: safe(() => Editor.toggleMobilePreview('ui'))
      },
      {
        id: 'ux.align.left',
        title: 'Visual: выровнять влево',
        category: 'Visual',
        action: safe(() => Editor.visualAlignSelected('left'))
      },
      {
        id: 'ux.align.center',
        title: 'Visual: выровнять по центру',
        category: 'Visual',
        action: safe(() => Editor.visualAlignSelected('center-h'))
      },
      {
        id: 'ux.play.here',
        title: 'Play здесь (embedded)',
        category: 'Play',
        keywords: ['test', 'play', 'debug'],
        action: safe(() => Editor.startEmbeddedPlay?.({ sceneId: Editor.currentScene }))
      },
      {
        id: 'tab.variables',
        title: 'Открыть Variables',
        category: 'Навигация',
        keywords: ['variables', 'flags'],
        action: safe(() => Editor.switchTab?.('variables'))
      },
      {
        id: 'tab.prefabs',
        title: 'Открыть Prefabs',
        category: 'Навигация',
        keywords: ['prefab', 'template'],
        action: safe(() => Editor.switchTab?.('prefabs'))
      },
      {
        id: 'project.validate.export',
        title: 'Проверка перед экспортом',
        category: 'Проект',
        keywords: ['export', 'validate'],
        action: safe(() => {
          const r = Editor.validateProjectExportReady?.();
          if (typeof Editor.showProjectValidationResults === 'function') Editor.showProjectValidationResults(r);
          else if (r?.ok) Editor.toast.success('OK');
          else Editor.toast.warning('Есть проблемы: ' + (r?.errors?.length || 0));
        })
      }
    ]);
  }

  // Export test API
  const api = {
    computeAlignUpdates,
    computeDistributeUpdates,
    STORAGE_WIZARD
  };
  if (typeof globalThis !== 'undefined') globalThis.EditorUxPhaseI = api;
  if (typeof window !== 'undefined') window.EditorUxPhaseI = api;

  injectStyles();
  bindContextMenus();
  bindGlobalShortcuts();

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-ux-phase-i', {
      visualAlignSelected: Editor.visualAlignSelected,
      toggleMobilePreview: Editor.toggleMobilePreview,
      runVillageQuickstartWizard: Editor.runVillageQuickstartWizard
    });
  }
})();
