/**
 * Phase F — Prefabs & Templates: save, insert, update, detach
 */
(function attachPrefabsPhaseF() {
  'use strict';

  if (typeof Editor === 'undefined') return;

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

  function ps() {
    return typeof ProjectSchema !== 'undefined' ? ProjectSchema : null;
  }

  function ensurePrefabs() {
    if (!Editor.data) return {};
    const P = ps();
    return P ? P.ensureProjectPrefabs(Editor.data) : (Editor.data.prefabs = Editor.data.prefabs || {});
  }

  function listPrefabs(typeFilter) {
    const P = ps();
    return P ? P.listProjectPrefabs(Editor.data, typeFilter) : [];
  }

  function getVisualScene() {
    const sid = Editor.currentScene;
    return sid && Editor.data?.scenes?.[sid] ? Editor.data.scenes[sid] : null;
  }

  function ensureVisual() {
    const scene = getVisualScene();
    if (!scene) return null;
    if (!scene.visual) scene.visual = { mode: 'overlay', nodes: [] };
    if (!Array.isArray(scene.visual.nodes)) scene.visual.nodes = [];
    return scene.visual;
  }

  function getUiScreen() {
    const sid = Editor._uiSelectedScreen;
    return sid && Editor.data?.ui?.screens?.[sid] ? Editor.data.ui.screens[sid] : null;
  }

  function visualSelectedNodes() {
    const visual = ensureVisual();
    if (!visual) return [];
    const ids = typeof Editor.visualGetSelectedIds === 'function'
      ? Editor.visualGetSelectedIds()
      : (Editor._visualSelectedNodeId ? [Editor._visualSelectedNodeId] : []);
    return visual.nodes.filter((n) => ids.indexOf(n.id) >= 0);
  }

  Object.assign(Editor, {
    listProjectPrefabs(typeFilter) {
      return listPrefabs(typeFilter);
    },

    seedBuiltinPrefabs(onlyMissing) {
      if (!Editor.data) return [];
      if (typeof PrefabLibrary !== 'undefined' && PrefabLibrary.seedBuiltinPrefabs) {
        const added = PrefabLibrary.seedBuiltinPrefabs(Editor.data, { onlyMissing: onlyMissing !== false });
        Editor.markDirty?.();
        Editor.updateJSONPreview?.();
        Editor.renderPrefabsPanel?.();
        return added;
      }
      return [];
    },

    async saveVisualSelectionAsPrefab() {
      const P = ps();
      const nodes = visualSelectedNodes();
      if (!nodes.length) {
        Editor.toast.warning('Выберите visual-узлы для сохранения в префаб.');
        return null;
      }
      const name = await Editor.promptDialog({ message: 'Название префаба:', defaultValue: 'Мой visual-префаб' });
      if (!name || !name.trim()) return null;
      const idRaw = await Editor.promptDialog({ message: 'ID префаба (латиница):', defaultValue: 'pf_' + name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') });
      if (!idRaw || !idRaw.trim()) return null;
      const entry = {
        type: 'visual',
        name: name.trim(),
        description: '',
        nodes: P ? P.prefabTemplateFromNodes(nodes, 'visual') : nodes
      };
      const pid = P ? P.registerPrefab(Editor.data, idRaw.trim(), entry) : idRaw.trim();
      ensurePrefabs()[pid] = entry;
      Editor.markDirty?.();
      Editor.updateJSONPreview?.();
      Editor.renderPrefabsPanel?.();
      Editor.toast?.success('Префаб сохранён: ' + pid);
      return pid;
    },

    async saveUiSelectionAsPrefab() {
      const P = ps();
      const sc = getUiScreen();
      const nid = Editor._uiSelectedNode;
      if (!sc || !nid) {
        Editor.toast.warning('Выберите UI-элемент или экран.');
        return null;
      }
      const node = sc.nodes.find((n) => n.id === nid);
      if (!node) return null;
      const name = await Editor.promptDialog({ message: 'Название UI-префаба:', defaultValue: 'Мой UI-блок' });
      if (!name || !name.trim()) return null;
      const idRaw = await Editor.promptDialog({ message: 'ID:', defaultValue: 'pf_' + name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') });
      if (!idRaw || !idRaw.trim()) return null;
      const entry = {
        type: 'ui',
        name: name.trim(),
        nodes: P ? P.prefabTemplateFromNodes([node], 'ui') : [node]
      };
      const pid = P ? P.registerPrefab(Editor.data, idRaw.trim(), entry) : idRaw.trim();
      Editor.markDirty?.();
      Editor.updateJSONPreview?.();
      Editor.renderPrefabsPanel?.();
      Editor.toast?.success('UI-префаб сохранён: ' + pid);
      return pid;
    },

    insertVisualPrefab(prefabId, opts) {
      const P = ps();
      const visual = ensureVisual();
      const bag = ensurePrefabs();
      const raw = bag[prefabId];
      if (!visual || !raw || !P) return false;
      const prefab = P.normalizePrefab(raw, prefabId);
      const inst = P.instantiatePrefabNodes(prefab, opts || { offsetX: 0.02, offsetY: 0.02 });
      visual.nodes.push(...inst);
      Editor.markDirty?.();
      Editor.updateJSONPreview?.();
      if (typeof Editor.renderVisualScenePanel === 'function') Editor.renderVisualScenePanel();
      else Editor.renderSceneEditor?.();
      Editor.toast?.success('Visual-префаб вставлен: ' + prefabId);
      return true;
    },

    insertUiPrefab(prefabId, opts) {
      const P = ps();
      const sc = getUiScreen();
      const bag = ensurePrefabs();
      const raw = bag[prefabId];
      if (!sc || !raw || !P) return false;
      if (!sc.nodes) sc.nodes = [];
      const prefab = P.normalizePrefab(raw, prefabId);
      const inst = P.instantiatePrefabNodes(prefab, opts || { offsetX: 0.01, offsetY: 0.01 });
      sc.nodes.push(...inst);
      if (inst[0]) Editor._uiSelectedNode = inst[0].id;
      Editor.markDirty?.();
      Editor.updateJSONPreview?.();
      Editor.renderGameUiEditor?.();
      Editor.toast?.success('UI-префаб вставлен: ' + prefabId);
      return true;
    },

    detachPrefabInstance(instanceId, context) {
      const P = ps();
      if (!P || !instanceId) return false;
      if (context === 'ui') {
        const sc = getUiScreen();
        if (!sc?.nodes) return false;
        P.detachPrefabInstance(sc.nodes, instanceId);
      } else {
        const visual = ensureVisual();
        if (!visual) return false;
        P.detachPrefabInstance(visual.nodes, instanceId);
      }
      Editor.markDirty?.();
      Editor.updateJSONPreview?.();
      if (context === 'ui') Editor.renderGameUiEditor?.();
      else Editor.renderSceneEditor?.();
      Editor.toast?.success('Префаб отвязан');
      return true;
    },

    updatePrefabInstance(instanceId, context) {
      const P = ps();
      if (!P || !instanceId) return false;
      let nodes;
      let prefabId;
      if (context === 'ui') {
        const sc = getUiScreen();
        nodes = sc?.nodes;
        prefabId = nodes?.find((n) => n.prefabLink?.instanceId === instanceId)?.prefabLink?.prefabId;
      } else {
        const visual = ensureVisual();
        nodes = visual?.nodes;
        prefabId = nodes?.find((n) => n.prefabLink?.instanceId === instanceId)?.prefabLink?.prefabId;
      }
      const raw = prefabId && ensurePrefabs()[prefabId];
      if (!nodes || !raw) return false;
      const prefab = P.normalizePrefab(raw, prefabId);
      P.updatePrefabInstanceNodes(nodes, prefab, instanceId);
      Editor.markDirty?.();
      Editor.updateJSONPreview?.();
      if (context === 'ui') Editor.renderGameUiEditor?.();
      else Editor.renderSceneEditor?.();
      Editor.toast?.success('Обновлено из префаба');
      return true;
    },

    async deleteProjectPrefab(id) {
      if (!id || !Editor.data?.prefabs?.[id]) return;
      if (!(await Editor.confirmDialog({ message: 'Удалить префаб «' + id + '»?', danger: true }))) return;
      delete Editor.data.prefabs[id];
      Editor.markDirty?.();
      Editor.updateJSONPreview?.();
      Editor.renderPrefabsPanel?.();
    },

    renderPrefabsPanel() {
      const root = document.getElementById('prefabs-editor');
      if (!root) return;
      if (!Editor.data) {
        root.innerHTML = '<div class="empty-state"><h2>Нет данных</h2></div>';
        return;
      }
      ensurePrefabs();
      const all = listPrefabs();
      const visual = all.filter((p) => p.type === 'visual');
      const ui = all.filter((p) => p.type === 'ui');
      const editing = Editor._editingPrefabId;
      const active = editing ? all.find((p) => p.id === editing) : null;

      let detail = '<p class="hint">Выберите префаб или добавьте из библиотеки.</p>';
      if (active) {
        detail =
          '<div class="form-group"><label>ID</label><code>' + esc(active.id) + '</code></div>' +
          '<div class="form-group"><label>Название</label><strong>' + esc(active.name) + '</strong></div>' +
          '<div class="form-group"><label>Тип</label> ' + esc(active.type) + ' · узлов: ' + (active.nodes?.length || 0) + '</div>' +
          '<p class="hint">' + esc(active.description || '') + '</p>' +
          '<div class="btn-row" style="flex-wrap:wrap;gap:6px">' +
          (active.type === 'visual'
            ? '<button type="button" class="btn btn-primary" data-pf-action="insertVisual" data-pf-id="' + escAttr(active.id) + '">Вставить на visual-сцену</button>'
            : '<button type="button" class="btn btn-primary" data-pf-action="insertUi" data-pf-id="' + escAttr(active.id) + '">Вставить на UI-экран</button>') +
          '<button type="button" class="btn btn-danger" data-pf-action="delete" data-pf-id="' + escAttr(active.id) + '">Удалить</button></div>';
      }

      function prefabButtons(list) {
        return list.map((p) =>
          '<button type="button" class="btn btn-secondary' + (p.id === editing ? ' active' : '') + '" data-pf-action="select" data-pf-id="' + escAttr(p.id) + '">' +
          esc(p.name) + ' <span class="hint">(' + esc(p.type) + ')</span></button>'
        ).join(' ');
      }

      root.innerHTML =
        '<div class="prefabs-editor-wrap"><h3>📦 Префабы и шаблоны (Phase F)</h3>' +
        '<p class="hint">Сохраняйте группы visual/UI-узлов и переиспользуйте. Flat prefab v1: update / detach.</p>' +
        '<div class="btn-row" style="flex-wrap:wrap;gap:6px;margin:8px 0">' +
        '<button type="button" class="btn btn-primary" data-pf-action="seed">+ Загрузить встроенные шаблоны</button>' +
        '</div>' +
        '<div class="form-group"><strong>Visual</strong><div class="btn-row" style="flex-wrap:wrap;gap:6px;margin:6px 0">' +
        (prefabButtons(visual) || '<span class="hint">Пусто</span>') + '</div></div>' +
        '<div class="form-group"><strong>UI</strong><div class="btn-row" style="flex-wrap:wrap;gap:6px;margin:6px 0">' +
        (prefabButtons(ui) || '<span class="hint">Пусто</span>') + '</div></div>' +
        '<div class="prefab-detail">' + detail + '</div></div>';

      if (!root._pfBound) {
        root._pfBound = true;
        root.addEventListener('click', function (e) {
          const btn = e.target.closest('[data-pf-action]');
          if (!btn) return;
          const act = btn.getAttribute('data-pf-action');
          const pid = btn.getAttribute('data-pf-id');
          if (act === 'seed') Editor.seedBuiltinPrefabs(true);
          if (act === 'select') { Editor._editingPrefabId = pid; Editor.renderPrefabsPanel(); }
          if (act === 'delete') Editor.deleteProjectPrefab(pid);
          if (act === 'insertVisual') Editor.insertVisualPrefab(pid);
          if (act === 'insertUi') Editor.insertUiPrefab(pid);
        });
      }
    },

    renderVisualPrefabToolbar() {
      const host = document.getElementById('visual-prefab-toolbar');
      if (!host) return;
      const P = ps();
      const visual = ensureVisual();
      const instances = P && visual ? P.collectPrefabInstances(visual.nodes) : [];
      let instHtml = '';
      instances.forEach(function (inst) {
        instHtml +=
          '<span class="hint">' + esc(inst.prefabId) + '</span> ' +
          '<button type="button" class="btn btn-secondary btn-sm" data-vpf="update" data-inst="' + escAttr(inst.instanceId) + '">Обновить</button> ' +
          '<button type="button" class="btn btn-secondary btn-sm" data-vpf="detach" data-inst="' + escAttr(inst.instanceId) + '">Отвязать</button> ';
      });
      host.innerHTML =
        '<strong>Prefabs:</strong> ' +
        '<button type="button" class="btn btn-secondary btn-sm" data-vpf="save">Сохранить выделение</button> ' +
        '<select id="visual-prefab-insert"><option value="">Вставить префаб…</option>' +
        listPrefabs('visual').map(function (p) {
          return '<option value="' + escAttr(p.id) + '">' + esc(p.name) + '</option>';
        }).join('') +
        '</select> ' + (instHtml || '');

      if (!host._vpfBound) {
        host._vpfBound = true;
        host.addEventListener('click', function (e) {
          const btn = e.target.closest('[data-vpf]');
          if (!btn) return;
          const act = btn.getAttribute('data-vpf');
          const inst = btn.getAttribute('data-inst');
          if (act === 'save') Editor.saveVisualSelectionAsPrefab();
          if (act === 'update') Editor.updatePrefabInstance(inst, 'visual');
          if (act === 'detach') Editor.detachPrefabInstance(inst, 'visual');
        });
        host.addEventListener('change', function (e) {
          if (e.target.id === 'visual-prefab-insert' && e.target.value) {
            Editor.insertVisualPrefab(e.target.value);
            e.target.value = '';
          }
        });
      }
    },

    renderUiPrefabToolbar() {
      const host = document.getElementById('ui-prefab-toolbar');
      if (!host) return;
      const P = ps();
      const sc = getUiScreen();
      const instances = P && sc ? P.collectPrefabInstances(sc.nodes) : [];
      let instHtml = '';
      instances.forEach(function (inst) {
        instHtml +=
          '<span class="hint">' + esc(inst.prefabId) + '</span> ' +
          '<button type="button" class="btn btn-secondary btn-sm" data-upf="update" data-inst="' + escAttr(inst.instanceId) + '">Обновить</button> ' +
          '<button type="button" class="btn btn-secondary btn-sm" data-upf="detach" data-inst="' + escAttr(inst.instanceId) + '">Отвязать</button> ';
      });
      host.innerHTML =
        '<strong>Prefabs:</strong> ' +
        '<button type="button" class="btn btn-secondary btn-sm" data-upf="save">Сохранить элемент</button> ' +
        '<select id="ui-prefab-insert"><option value="">Вставить префаб…</option>' +
        listPrefabs('ui').map(function (p) {
          return '<option value="' + escAttr(p.id) + '">' + esc(p.name) + '</option>';
        }).join('') +
        '</select> ' + (instHtml || '');

      if (!host._upfBound) {
        host._upfBound = true;
        host.addEventListener('click', function (e) {
          const btn = e.target.closest('[data-upf]');
          if (!btn) return;
          const act = btn.getAttribute('data-upf');
          const inst = btn.getAttribute('data-inst');
          if (act === 'save') Editor.saveUiSelectionAsPrefab();
          if (act === 'update') Editor.updatePrefabInstance(inst, 'ui');
          if (act === 'detach') Editor.detachPrefabInstance(inst, 'ui');
        });
        host.addEventListener('change', function (e) {
          if (e.target.id === 'ui-prefab-insert' && e.target.value) {
            Editor.insertUiPrefab(e.target.value);
            e.target.value = '';
          }
        });
      }
    }
  });

  if (Editor.hooks?.after) {
    Editor.hooks.after('switchTab', function (_r, args) {
      if (args && args[0] === 'prefabs') Editor.renderPrefabsPanel?.();
    }, 'editor-prefabs-phase-f-tab');

    Editor.hooks.after('renderVisualScenePanel', function () {
      try {
        const host = document.getElementById('visual-scene-editor-root') || document.getElementById('scene-editor');
        if (!host) return;
        let bar = document.getElementById('visual-prefab-toolbar');
        if (!bar) {
          bar = document.createElement('div');
          bar.id = 'visual-prefab-toolbar';
          bar.className = 'form-row';
          bar.style.cssText = 'flex-wrap:wrap;gap:6px;margin:8px 0;align-items:center;';
          const vp = host.querySelector('#visual-viewport') || host.querySelector('.visual-scene-panel');
          if (vp && vp.parentNode) vp.parentNode.insertBefore(bar, vp);
          else host.appendChild(bar);
        }
        Editor.renderVisualPrefabToolbar();
      } catch (e) { console.warn('[phase-f visual]', e); }
    }, 'editor-prefabs-phase-f-visual');

    Editor.hooks.after('renderGameUiEditor', function () {
      try {
        const host = document.getElementById('game-ui-editor-root');
        if (!host) return;
        let bar = document.getElementById('ui-prefab-toolbar');
        if (!bar) {
          bar = document.createElement('div');
          bar.id = 'ui-prefab-toolbar';
          bar.className = 'form-row';
          bar.style.cssText = 'flex-wrap:wrap;gap:6px;margin:8px 0;align-items:center;';
          const vp = host.querySelector('#game-ui-viewport');
          if (vp && vp.parentNode) vp.parentNode.insertBefore(bar, vp);
          else host.querySelector('.game-ui-editor')?.appendChild(bar) || host.appendChild(bar);
        }
        Editor.renderUiPrefabToolbar();
      } catch (e) { console.warn('[phase-f ui]', e); }
    }, 'editor-prefabs-phase-f-ui');
  }
})();
