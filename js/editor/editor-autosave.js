// ============================================================
// Editor Autosave / Recovery — localStorage snapshots
// НЕ заменяет exportJSON; recovery отдельно от обычного save
//
// Согласование с editor-history.js:
// — Undo/redo: EditorHistory._replaying=true → не планируем autosave в updateJSONPreview.
// — После отката снимок recovery отражает уже откатанное состояние (ожидаемо).
// — resetAll() при загрузке проекта не трогает localStorage; recovery — отдельный стек.
// ============================================================
(function attachEditorAutosave() {
  'use strict';
  if (typeof Editor === 'undefined') {
    console.error('editor-autosave: Editor missing');
    return;
  }

  const STORAGE_INDEX = 'rpg_editor_autosave_index';
  const STORAGE_PREFIX = 'rpg_editor_autosave_';
  const MAX_SNAPSHOTS = 3;
  const DEBOUNCE_MS = 8000;
  const MAX_BYTES = 4.5 * 1024 * 1024; // soft limit per entry

  let debounceTimer = null;
  let dirty = false;
  let saving = false;
  let lastSavedAt = null;
  let statusEl = null;

  function nowId() {
    return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function readIndex() {
    try {
      const raw = localStorage.getItem(STORAGE_INDEX);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function writeIndex(list) {
    try {
      localStorage.setItem(STORAGE_INDEX, JSON.stringify(list));
    } catch (e) {
      console.warn('[autosave] index write failed', e);
    }
  }

  function snapshotMeta(id, extra) {
    return Object.assign({
      id,
      savedAt: Date.now(),
      title: Editor.data?.meta?.title || Editor.data?.projectName || Editor.data?.title || 'Проект',
      sceneCount: Object.keys(Editor.data?.scenes || {}).length,
      questCount: Object.keys(Editor.data?.quests || {}).length
    }, extra || {});
  }

  function setStatus(mode, text) {
    ensureStatusUi();
    if (statusEl) {
      statusEl.dataset.mode = mode || '';
      statusEl.textContent = text || '';
      statusEl.hidden = true; // UI owns editor-project-status
    }
    if (Editor.projectStatus) {
      if (mode === 'saving') Editor.projectStatus.markSaving();
      else if (mode === 'saved') Editor.projectStatus.markSaved();
      else if (mode === 'dirty') Editor.projectStatus.markDirty();
      else if (mode === 'error') Editor.projectStatus.markError();
    }
  }

  function ensureStatusUi() {
    if (typeof document === 'undefined') return;
    if (statusEl && document.body.contains(statusEl)) return;
    statusEl = document.getElementById('editor-autosave-status');
    if (statusEl) return;
    statusEl = document.createElement('div');
    statusEl.id = 'editor-autosave-status';
    statusEl.className = 'editor-autosave-status';
    statusEl.hidden = true;
    // try header buttons area
    const header = document.querySelector('.header-buttons') || document.querySelector('.editor-nav-brand');
    if (header) header.appendChild(statusEl);
    else document.body.appendChild(statusEl);
  }

  function pruneSnapshots(index) {
    const sorted = index.slice().sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    const keep = sorted.slice(0, MAX_SNAPSHOTS);
    const keepIds = new Set(keep.map((x) => x.id));
    sorted.forEach((m) => {
      if (!keepIds.has(m.id)) {
        try { localStorage.removeItem(STORAGE_PREFIX + m.id); } catch (e) { /* */ }
      }
    });
    return keep;
  }

  /**
   * Write recovery snapshot (not export).
   */
  function writeSnapshot(reason) {
    if (!Editor.data || typeof Editor.data !== 'object') return false;
    saving = true;
    setStatus('saving', '⟳ Сохранение...');
    try {
      const payload = {
        version: 1,
        kind: 'recovery',
        reason: reason || 'debounce',
        savedAt: Date.now(),
        editing: {
          currentScene: Editor.currentScene || null,
          editingQuestId: Editor.editingQuestId || null,
          currentTab: Editor.currentTab || null
        },
        data: Editor.data
      };
      const json = JSON.stringify(payload);
      if (json.length > MAX_BYTES) {
        console.warn('[autosave] snapshot too large, skip', json.length);
        if (Editor.toast) Editor.toast.warning('Автосохранение пропущено: проект слишком большой для localStorage');
        setStatus('error', '❌ Ошибка сохранения');
        saving = false;
        return false;
      }
      const id = nowId();
      localStorage.setItem(STORAGE_PREFIX + id, json);
      let index = readIndex();
      index.push(snapshotMeta(id, { reason: reason || 'debounce', bytes: json.length }));
      index = pruneSnapshots(index);
      writeIndex(index);
      lastSavedAt = Date.now();
      dirty = false;
      setStatus('saved', '✓ Сохранено');
      if (typeof setTimeout === 'function') {
        setTimeout(() => {
          if (!dirty && !saving) setStatus('saved', '✓ Сохранено');
        }, 50);
      }
      return true;
    } catch (e) {
      console.warn('[autosave] failed', e);
      setStatus('error', '❌ Ошибка сохранения');
      if (e && (e.name === 'QuotaExceededError' || /quota/i.test(String(e)))) {
        // drop oldest and retry once
        try {
          let index = pruneSnapshots(readIndex());
          if (index.length) {
            const oldest = index.sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0))[0];
            localStorage.removeItem(STORAGE_PREFIX + oldest.id);
            index = index.filter((x) => x.id !== oldest.id);
            writeIndex(index);
          }
        } catch (e2) { /* */ }
      }
      return false;
    } finally {
      saving = false;
    }
  }

  function scheduleAutosave(reason) {
    if (!Editor.data) return;
    dirty = true;
    setStatus('dirty', '● Несохранённые изменения');
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      writeSnapshot(reason || 'debounce');
    }, DEBOUNCE_MS);
  }

  function getLatestSnapshot() {
    const index = readIndex().sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    for (const meta of index) {
      try {
        const raw = localStorage.getItem(STORAGE_PREFIX + meta.id);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.data) return { meta, payload: parsed };
      } catch (e) { /* skip corrupt */ }
    }
    return null;
  }

  function deleteAllSnapshots() {
    const index = readIndex();
    index.forEach((m) => {
      try { localStorage.removeItem(STORAGE_PREFIX + m.id); } catch (e) { /* */ }
    });
    writeIndex([]);
    setStatus('', '');
  }

  function deleteSnapshot(id) {
    try { localStorage.removeItem(STORAGE_PREFIX + id); } catch (e) { /* */ }
    writeIndex(readIndex().filter((m) => m.id !== id));
  }

  function applyRecovery(payload) {
    if (!payload || !payload.data) return;
    if (typeof Editor.setProjectData === 'function') {
      Editor.setProjectData(payload.data, { preview: true });
    } else {
      Editor.data = payload.data;
      if (typeof Editor.renderAll === 'function') Editor.renderAll();
    }
    const ed = payload.editing || {};
    if (ed.currentScene) Editor.currentScene = ed.currentScene;
    if (ed.editingQuestId) Editor.editingQuestId = ed.editingQuestId;
    if (ed.currentTab && typeof Editor.switchTab === 'function') {
      try { Editor.switchTab(ed.currentTab); } catch (e) { /* */ }
    }
    if (Editor.toast) Editor.toast.success('Проект восстановлен из автосохранения');
    setStatus('saved', '✓ Восстановлено');
  }

  function showRecoveryDialog(found) {
    const meta = found.meta;
    const when = meta.savedAt ? new Date(meta.savedAt).toLocaleString() : '—';
    const title = meta.title || 'Проект';
    const message =
      'Найдено несохранённое состояние проекта.\n\n«' +
      title + '»\n' + when +
      '\nСцен: ' + (meta.sceneCount ?? '—') +
      ', квестов: ' + (meta.questCount ?? '—');

    const run = () => {
      if (typeof Editor.confirmDialog === 'function') {
        // custom two-button is only ok/cancel — use confirm as Restore, separate discard via toast actions
        Editor.confirmDialog({
          title: 'Восстановление',
          message: message + '\n\nВосстановить это состояние?',
          confirmLabel: 'Восстановить',
          cancelLabel: 'Удалить'
        }).then((ok) => {
          if (ok) {
            applyRecovery(found.payload);
            // keep snapshot until next successful manual export optional — prune this one after restore
            deleteSnapshot(meta.id);
          } else {
            deleteAllSnapshots();
            if (Editor.toast) Editor.toast.info('Черновик автосохранения удалён');
          }
        });
        return;
      }
      // fallback modal
      const modal = document.createElement('div');
      modal.className = 'editor-modal';
      modal.innerHTML = `
        <div class="editor-modal-backdrop"></div>
        <div class="editor-modal-panel" style="max-width:440px;">
          <h2>Восстановление</h2>
          <p style="white-space:pre-wrap;">${(Editor.escapeHtml || ((s) => s))(message)}</p>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
            <button type="button" class="btn btn-secondary" data-act="discard">Удалить</button>
            <button type="button" class="btn btn-primary" data-act="restore">Восстановить</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', (e) => {
        const act = e.target.getAttribute?.('data-act');
        if (!act) return;
        modal.remove();
        if (act === 'restore') {
          applyRecovery(found.payload);
          deleteSnapshot(meta.id);
        } else {
          deleteAllSnapshots();
        }
      });
    };

    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(run, 300));
      } else {
        setTimeout(run, 300);
      }
    }
  }

  Editor.autosave = {
    schedule: scheduleAutosave,
    flush() {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      return writeSnapshot('flush');
    },
    getLatest: getLatestSnapshot,
    clear: deleteAllSnapshots,
    markDirty: () => scheduleAutosave('edit')
  };

  // Hook via Editor.hooks — never assign Editor[method] directly (recursion with ensureWrap).
  let _autosaveHooksInstalled = false;
  function installHooks() {
    if (_autosaveHooksInstalled || !Editor.hooks?.after) return;
    _autosaveHooksInstalled = true;

    Editor.hooks.after('updateJSONPreview', function () {
      if (typeof EditorHistory !== 'undefined' && EditorHistory._replaying) return;
      scheduleAutosave('edit');
    }, 'editor-autosave');

    if (typeof Editor.setProjectData === 'function') {
      Editor.hooks.after('setProjectData', function (result) {
        dirty = false;
        if (debounceTimer) {
          clearTimeout(debounceTimer);
          debounceTimer = null;
        }
        setStatus('saved', '✓ Загружено');
        return result;
      }, 'editor-autosave');
    }

    if (typeof Editor.exportJSON === 'function') {
      Editor.hooks.after('exportJSON', function (result) {
        writeSnapshot('after-export');
        return result;
      }, 'editor-autosave');
    }
  }
  installHooks();

  // Recovery on startup
  function checkRecovery() {
    const found = getLatestSnapshot();
    if (!found) return;
    // Skip if editor already has richer data? still offer if snapshot exists and no data
    const hasData = Editor.data && (Object.keys(Editor.data.scenes || {}).length || Object.keys(Editor.data.quests || {}).length);
    if (hasData) {
      // still offer if snapshot is newer than session — show only if data was empty at boot
      return;
    }
    showRecoveryDialog(found);
  }

  // Always offer recovery if snapshot exists and project data is null/empty at first paint
  function bootRecovery() {
    ensureStatusUi();
    const found = getLatestSnapshot();
    if (!found) return;
    const empty = !Editor.data || (
      !Object.keys(Editor.data.scenes || {}).length &&
      !Object.keys(Editor.data.quests || {}).length &&
      !Object.keys(Editor.data.npcs || {}).length
    );
    if (empty) showRecoveryDialog(found);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(bootRecovery, 400));
    } else {
      setTimeout(bootRecovery, 400);
    }
  }

  // beforeunload warning if dirty
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', (e) => {
      if (!dirty) return;
      // try sync flush
      try {
        if (debounceTimer) {
          clearTimeout(debounceTimer);
          debounceTimer = null;
        }
        writeSnapshot('beforeunload');
      } catch (err) { /* */ }
      e.preventDefault();
      e.returnValue = '';
    });
  }

  if (!document.getElementById('editor-autosave-styles')) {
    const st = document.createElement('style');
    st.id = 'editor-autosave-styles';
    st.textContent = `
      .editor-autosave-status {
        display: inline-block; margin-left: 10px; font-size: 12px;
        color: var(--muted, #666); vertical-align: middle; white-space: nowrap;
      }
      .editor-autosave-status[data-mode="saving"] { color: var(--info, #1565c0); }
      .editor-autosave-status[data-mode="saved"] { color: #2e7d32; }
      .editor-autosave-status[data-mode="dirty"] { color: #ef6c00; }
      .editor-autosave-status[data-mode="error"] { color: #c62828; }
    `;
    document.head.appendChild(st);
  }

  if (Editor.commands?.register) {
    Editor.commands.registerMany([
      {
        id: 'autosave.flush',
        title: 'Сохранить черновик (autosave)',
        category: 'Проект',
        keywords: ['autosave', 'recovery'],
        action() { Editor.autosave.flush(); if (Editor.toast) Editor.toast.success('Черновик записан'); }
      },
      {
        id: 'autosave.clear',
        title: 'Очистить recovery snapshots',
        category: 'Проект',
        action() {
          Editor.autosave.clear();
          if (Editor.toast) Editor.toast.info('Автосохранения удалены');
        }
      }
    ]);
  }

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-autosave', {
      autosave: Editor.autosave
    }, { force: true });
  }
})();
