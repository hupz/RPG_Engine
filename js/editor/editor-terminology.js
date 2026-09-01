// ============================================================
// Editor Terminology — человеческие подписи (UI only)
// Не меняет runtime / JSON / API. Advanced mode может показать коды.
// ============================================================
(function attachEditorTerminology() {
  if (typeof Editor === 'undefined') return;

  const LABELS = {
    npcId: 'Персонаж',
    itemId: 'Предмет',
    enemyId: 'Враг',
    sceneId: 'Место',
    locationId: 'Локация',
    questId: 'Квест',
    choiceId: 'Выбор',
    objectId: 'Объект',
    skillId: 'Навык',
    flag: 'Состояние',
    ManualAdvance: 'Продолжение',
    TalkToNPC: 'Поговорить',
    CollectItem: 'Собрать',
    KillEnemy: 'Победить',
    DeliverItem: 'Доставить',
    VisitLocation: 'Посетить',
    Condition: 'Когда доступно',
    Action: 'Что происходит',
    Task: 'Задача',
    Stage: 'Этап',
    Reference: 'Ссылка',
    'Invalid reference': 'Объект не найден'
  };

  Editor.humanTerm = function humanTerm(key, fallback) {
    if (key == null) return fallback || '';
    const k = String(key);
    if (LABELS[k]) return LABELS[k];
    // strip Id suffix for display: questId → already mapped
    return fallback != null ? fallback : k;
  };

  Editor.isEditorAdvancedMode = function isEditorAdvancedMode() {
    try {
      if (this.devMode) return true;
      if (this.editorMode === 'advanced') return true;
      if (typeof this.isQuestDevMode === 'function' && this.isQuestDevMode()) return true;
      if (typeof localStorage !== 'undefined') {
        if (localStorage.getItem('rpg_editor_dev') === '1') return true;
        if (localStorage.getItem('rpg_editor_mode') === 'advanced') return true;
      }
    } catch (e) { /* */ }
    return false;
  };
})();
