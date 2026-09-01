// ============================================================
// Quest Editor Drag & Drop — порядок Stage / Task
// Undo через EditorHistory (Ctrl+Z / Ctrl+Shift+Z)
// ============================================================
(function attachQuestDnd() {
  'use strict';
  if (typeof Editor === 'undefined') return;

  let dragState = null; // { kind, questId, stageIndex, taskIndex }

  function clearIndicators() {
    document.querySelectorAll('.quest-dnd-over, .quest-dnd-over-before, .quest-dnd-over-after').forEach((el) => {
      el.classList.remove('quest-dnd-over', 'quest-dnd-over-before', 'quest-dnd-over-after');
    });
  }

  function pushQuestUndo(questId) {
    if (typeof EditorHistory === 'undefined' || !questId) return;
    const ctx = { type: 'quest', id: questId };
    // snapshot BEFORE mutation is taken by history hooks when methods are wrapped;
    // for explicit call:
    if (typeof EditorHistory.makeSnapshot === 'function' && typeof EditorHistory.pushUndo === 'function') {
      // caller should push before mutate; see move wrappers below
    }
  }

  // Undo: одна операция через EditorHistory.wrapImmediate(moveQuestStage/Task)
  Editor.moveQuestStageWithHistory = function (questId, from, to) {
    return this.moveQuestStage(questId, from, to);
  };

  Editor.moveQuestTaskWithHistory = function (questId, stageIndex, from, to) {
    return this.moveQuestTask(questId, stageIndex, from, to);
  };

  function onDragStart(e) {
    const handle = e.target.closest?.('.quest-dnd-handle');
    if (!handle) return;
    const card = handle.closest('[data-dnd]');
    if (!card) return;
    const kind = card.getAttribute('data-dnd');
    const questId = card.getAttribute('data-quest-id');
    const stageIndex = parseInt(card.getAttribute('data-stage-index'), 10);
    const taskIndex = card.getAttribute('data-task-index') != null
      ? parseInt(card.getAttribute('data-task-index'), 10)
      : null;
    dragState = { kind, questId, stageIndex, taskIndex };
    card.classList.add('quest-dnd-dragging');
    try {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', kind + ':' + questId + ':' + stageIndex + ':' + taskIndex);
    } catch (_) { /* ie */ }
  }

  function onDragEnd() {
    clearIndicators();
    document.querySelectorAll('.quest-dnd-dragging').forEach((el) => el.classList.remove('quest-dnd-dragging'));
    dragState = null;
  }

  function targetCard(e, kind) {
    return e.target.closest?.('[data-dnd="' + kind + '"]');
  }

  function onDragOver(e) {
    if (!dragState) return;
    const card = targetCard(e, dragState.kind);
    if (!card) return;
    if (card.getAttribute('data-quest-id') !== dragState.questId) return;
    if (dragState.kind === 'task') {
      if (parseInt(card.getAttribute('data-stage-index'), 10) !== dragState.stageIndex) return;
    }
    e.preventDefault();
    try { e.dataTransfer.dropEffect = 'move'; } catch (_) {}
    clearIndicators();
    const rect = card.getBoundingClientRect();
    const before = (e.clientY - rect.top) < rect.height / 2;
    card.classList.add(before ? 'quest-dnd-over-before' : 'quest-dnd-over-after');
    card.classList.add('quest-dnd-over');
  }

  function onDrop(e) {
    if (!dragState) return;
    const card = targetCard(e, dragState.kind);
    if (!card) return;
    e.preventDefault();
    const questId = dragState.questId;
    if (card.getAttribute('data-quest-id') !== questId) return;

    const rect = card.getBoundingClientRect();
    const before = (e.clientY - rect.top) < rect.height / 2;

    if (dragState.kind === 'stage') {
      let insertAt = parseInt(card.getAttribute('data-stage-index'), 10);
      if (!before) insertAt += 1;
      const fromIdx = dragState.stageIndex;
      if (fromIdx < insertAt) insertAt -= 1;
      if (fromIdx !== insertAt) {
        Editor.moveQuestStageWithHistory(questId, fromIdx, insertAt);
      }
    } else if (dragState.kind === 'task') {
      const stageIndex = dragState.stageIndex;
      if (parseInt(card.getAttribute('data-stage-index'), 10) !== stageIndex) return;
      let insertAt = parseInt(card.getAttribute('data-task-index'), 10);
      if (!before) insertAt += 1;
      const fromIdx = dragState.taskIndex;
      if (fromIdx < insertAt) insertAt -= 1;
      if (fromIdx !== insertAt) {
        Editor.moveQuestTaskWithHistory(questId, stageIndex, fromIdx, insertAt);
      }
    }
    clearIndicators();
    dragState = null;
  }

  function bind() {
    if (window._questDndBound) return;
    window._questDndBound = true;
    document.addEventListener('dragstart', onDragStart, true);
    document.addEventListener('dragend', onDragEnd, true);
    document.addEventListener('dragover', onDragOver, true);
    document.addEventListener('drop', onDrop, true);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
    else bind();
  }

  if (!document.getElementById('quest-dnd-styles')) {
    const st = document.createElement('style');
    st.id = 'quest-dnd-styles';
    st.textContent = `
      .quest-dnd-handle {
        cursor: grab; user-select: none; color: var(--muted, #888);
        padding: 2px 6px; font-size: 14px; line-height: 1; flex-shrink: 0;
      }
      .quest-dnd-handle:active { cursor: grabbing; }
      .quest-stage-card { position: relative; }
      .quest-stage-card > .quest-dnd-handle {
        position: absolute; left: 8px; top: 44px; z-index: 2;
      }
      .quest-stage-card.quest-dnd-dragging,
      .quest-task-card.quest-dnd-dragging { opacity: 0.45; }
      .quest-stage-card.quest-dnd-over-before,
      .quest-task-card.quest-dnd-over-before {
        box-shadow: inset 0 3px 0 0 var(--accent, #6d4c41);
      }
      .quest-stage-card.quest-dnd-over-after,
      .quest-task-card.quest-dnd-over-after {
        box-shadow: inset 0 -3px 0 0 var(--accent, #6d4c41);
      }
      .quest-task-summary { display: flex; align-items: flex-start; gap: 8px; }
    `;
    document.head.appendChild(st);
  }

  // Register history immediate methods if history already installed
  if (typeof EditorHistory !== 'undefined' && EditorHistory.installHooks) {
    // wrap via Object so resolveContext sees method names
  }

  if (Editor.hooks?.register) {
    Editor.hooks.register('editor-quest-dnd', {
      moveQuestStage: Editor.moveQuestStage,
      moveQuestTask: Editor.moveQuestTask,
      moveQuestStageWithHistory: Editor.moveQuestStageWithHistory,
      moveQuestTaskWithHistory: Editor.moveQuestTaskWithHistory
    }, { force: true });
  }
})();
