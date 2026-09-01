// ============================================================
// Concrete quest task types
// ============================================================

(function registerQuestTaskTypes() {
  if (typeof QuestTaskBase === 'undefined' || typeof QuestTaskRegistry === 'undefined') {
    console.error('task-types.js: QuestTaskBase/Registry missing');
    return;
  }

  function matchId(a, b) {
    if (a == null || b == null) return false;
    return String(a) === String(b);
  }

  function inc(task, n) {
    task._progress = Math.min(task.target, (task._progress || 0) + (n || 1));
    if (task._progress >= task.target) task._completed = true;
  }

  // ----- ManualAdvance: completes when stage is set by content/migration -----
  class ManualAdvanceTask extends QuestTaskBase {
    static typeId = 'ManualAdvance';
    static label = 'Продолжение';
    static description = 'Игрок продолжает по кнопке «Продолжить»';
    static getEditorFields() {
      return [
        { key: 'description', label: 'Описание для журнала', input: 'text' },
        { key: 'stageKey', label: 'Служебный ключ этапа', input: 'text' }
      ];
    }
    onEvent(event) {
      if (this.isCompleted()) return;
      // StageActivated / StageSet = «этап стал активным», НЕ «задача выполнена»
      if (event.type === 'TaskManualComplete') {
        const p = event.payload || {};
        if (p.taskId && matchId(p.taskId, this.id)) {
          this.markComplete();
          return;
        }
        if (p.questId && p.stageIndex != null &&
            matchId(p.questId, this._ctx.questId) &&
            Number(p.stageIndex) === Number(this._ctx.stageIndex) &&
            !p.taskId) {
          this.markComplete();
        }
      }
    }
    getDescription() {
      if (this.def.description) return String(this.def.description);
      return 'После нажатия «Продолжить»';
    }
  }

  class TalkToNPCTask extends QuestTaskBase {
    static typeId = 'TalkToNPC';
    static label = 'Поговорить';
    static description = 'Завершается после разговора с персонажем';
    static getEditorFields() {
      return [
        { key: 'npcId', label: 'Персонаж', input: 'npc', required: true },
        { key: 'description', label: 'Описание', input: 'text' }
      ];
    }
    onEvent(event) {
      if (this.isCompleted()) return;
      if (!this.def.npcId) return; // invalid config — editor must set npcId
      if (event.type === 'NPCDialogueFinished' || event.type === 'NPCTalked') {
        const npcId = event.payload?.npcId || event.payload?.npc;
        if (matchId(npcId, this.def.npcId)) this.markComplete();
      }
    }
    getDescription() {
      if (this.def.description) return this.def.description;
      const name = this.def.npcId || 'NPC';
      return 'Поговорить с: ' + name;
    }
  }

  class CollectItemTask extends QuestTaskBase {
    static typeId = 'CollectItem';
    static label = 'Собрать предмет';
    static description = 'Собрать N экземпляров предмета';
    static getEditorFields() {
      return [
        { key: 'itemId', label: 'Предмет', input: 'item', required: true },
        { key: 'count', label: 'Количество', input: 'number', min: 1, required: true },
        { key: 'description', label: 'Описание', input: 'text' }
      ];
    }
    applyWorldState(world) {
      if (!this.def.itemId || !world) return;
      const inv = world.inventory || [];
      const n = inv.filter((id) => matchId(id, this.def.itemId)).length;
      this._progress = Math.min(this.target, n);
      if (this._progress >= this.target) this._completed = true;
    }
    onEvent(event) {
      if (this.isCompleted()) return;
      if (event.type === 'ItemCollected' || event.type === 'ItemAdded') {
        const p = event.payload || {};
        if (this.def.itemId && !matchId(p.itemId || p.item, this.def.itemId)) return;
        inc(this, Number(p.qty) || Number(p.count) || 1);
      }
      if (event.type === 'InventorySync' && this.def.itemId) {
        this.applyWorldState({ inventory: event.payload?.inventory || [] });
      }
    }
    getDescription() {
      if (this.def.description) return this.def.description;
      const c = this.target;
      const id = this.def.itemId || 'предмет';
      return c > 1 ? `Собрать: ${id} (${this.getProgress()}/${c})` : `Найти: ${id}`;
    }
  }

  class KillEnemyTask extends QuestTaskBase {
    static typeId = 'KillEnemy';
    static label = 'Победить врага';
    static description = 'Убить N врагов указанного типа';
    static getEditorFields() {
      return [
        { key: 'enemyId', label: 'Враг', input: 'enemy', required: true },
        { key: 'count', label: 'Количество', input: 'number', min: 1, required: true },
        { key: 'description', label: 'Описание', input: 'text' }
      ];
    }
    onEvent(event) {
      if (this.isCompleted()) return;
      if (event.type === 'EnemyKilled') {
        const p = event.payload || {};
        const id = p.enemyId || p.id || p.templateId;
        if (this.def.enemyId && !matchId(id, this.def.enemyId)) return;
        inc(this, Number(p.count) || 1);
      }
    }
    getDescription() {
      if (this.def.description) return this.def.description;
      const c = this.target;
      const id = this.def.enemyId || 'враг';
      return c > 1 ? `Победить: ${id} (${this.getProgress()}/${c})` : `Победить: ${id}`;
    }
  }

  class VisitLocationTask extends QuestTaskBase {
    static typeId = 'VisitLocation';
    static label = 'Посетить локацию';
    static description = 'Войти в указанную сцену/локацию';
    static getEditorFields() {
      return [
        { key: 'sceneId', label: 'Место', input: 'scene', required: true },
        { key: 'description', label: 'Описание', input: 'text' }
      ];
    }
    applyWorldState(world) {
      if (!this.def.sceneId || !world?.scene) return;
      if (matchId(world.scene, this.def.sceneId)) this.markComplete();
    }
    onEvent(event) {
      if (this.isCompleted()) return;
      if (!this.def.sceneId) return;
      if (event.type === 'LocationVisited' || event.type === 'SceneEntered') {
        const p = event.payload || {};
        if (matchId(p.sceneId || p.scene, this.def.sceneId)) {
          this.markComplete();
        }
      }
    }
    getDescription() {
      if (this.def.description) return this.def.description;
      return 'Посетить: ' + (this.def.location || this.def.sceneId || 'локацию');
    }
  }

  class DeliverItemTask extends QuestTaskBase {
    static typeId = 'DeliverItem';
    static label = 'Доставить предмет';
    static description = 'Отдать предмет NPC';
    static getEditorFields() {
      return [
        { key: 'itemId', label: 'Предмет', input: 'item', required: true },
        { key: 'npcId', label: 'Персонаж', input: 'npc', required: true },
        { key: 'count', label: 'Количество', input: 'number', min: 1, required: true },
        { key: 'description', label: 'Описание', input: 'text' }
      ];
    }
    onEvent(event) {
      if (this.isCompleted()) return;
      // Только ItemDelivered — ItemRemoved не означает доставку (иначе double-count)
      if (event.type === 'ItemDelivered') {
        const p = event.payload || {};
        if (this.def.itemId && !matchId(p.itemId || p.item, this.def.itemId)) return;
        if (this.def.npcId && p.npcId && !matchId(p.npcId, this.def.npcId)) return;
        inc(this, Number(p.qty) || Number(p.count) || 1);
      }
    }
    getDescription() {
      if (this.def.description) return this.def.description;
      return 'Доставить: ' + (this.def.itemId || 'предмет') +
        (this.def.npcId ? ' → ' + this.def.npcId : '');
    }
  }

  class UseItemTask extends QuestTaskBase {
    static typeId = 'UseItem';
    static label = 'Использовать предмет';
    static getEditorFields() {
      return [
        { key: 'itemId', label: 'Предмет', input: 'item', required: true },
        { key: 'count', label: 'Раз', input: 'number', min: 1 },
        { key: 'description', label: 'Описание', input: 'text' }
      ];
    }
    onEvent(event) {
      if (this.isCompleted()) return;
      if (event.type === 'ItemUsed') {
        const p = event.payload || {};
        if (this.def.itemId && !matchId(p.itemId || p.item, this.def.itemId)) return;
        inc(this, 1);
      }
    }
    getDescription() {
      return this.def.description || ('Использовать: ' + (this.def.itemId || 'предмет'));
    }
  }

  class CraftItemTask extends QuestTaskBase {
    static typeId = 'CraftItem';
    static label = 'Создать предмет';
    static getEditorFields() {
      return [
        { key: 'itemId', label: 'Предмет или рецепт', input: 'item' },
        { key: 'count', label: 'Количество', input: 'number', min: 1, required: true },
        { key: 'description', label: 'Описание', input: 'text' }
      ];
    }
    onEvent(event) {
      if (this.isCompleted()) return;
      if (event.type === 'ItemCrafted') {
        const p = event.payload || {};
        if (this.def.itemId && !matchId(p.itemId || p.recipeId, this.def.itemId)) return;
        inc(this, Number(p.qty) || 1);
      }
    }
    getDescription() {
      return this.def.description || ('Создать: ' + (this.def.itemId || 'предмет'));
    }
  }

  class ChooseDialogueOptionTask extends QuestTaskBase {
    static typeId = 'ChooseDialogueOption';
    static label = 'Выбрать реплику';
    static description = 'Завершается при выборе реплики (по id или тексту)';
    static getEditorFields() {
      return [
        { key: 'choiceId', label: 'Выбор в диалоге', input: 'text', required: true },
        { key: 'sceneId', label: 'Место (необязательно)', input: 'scene' },
        { key: 'textContains', label: 'Текст содержит (если нет id)', input: 'text' },
        { key: 'description', label: 'Описание', input: 'text' }
      ];
    }
    onEvent(event) {
      if (this.isCompleted()) return;
      // ChoiceSelected / DialogueChoiceSelected — semantic events (not quest flags)
      if (event.type !== 'ChoiceSelected' && event.type !== 'DialogueChoiceSelected') return;
      const p = event.payload || {};
      if (this.def.sceneId && p.sceneId && !matchId(p.sceneId, this.def.sceneId)) return;

      const wantId = this.def.choiceId || this.def.choiceFlag; // choiceFlag = legacy alias only
      if (wantId) {
        const got = p.choiceId || p.id || p.flag;
        if (got && matchId(got, wantId)) {
          this.markComplete();
          return;
        }
      }
      const needle = this.def.textContains || this.def.textMatch;
      if (needle && p.text && String(p.text).toLowerCase().includes(String(needle).toLowerCase())) {
        this.markComplete();
      }
    }
    getDescription() {
      if (this.def.description) return this.def.description;
      const id = this.def.choiceId || this.def.choiceFlag;
      return id ? ('Выбор: ' + id) : 'Сделать выбор в диалоге';
    }
  }

  class AcquireGoldTask extends QuestTaskBase {
    static typeId = 'AcquireGold';
    static label = 'Получить золото';
    static getEditorFields() {
      return [
        { key: 'amount', label: 'Сумма', input: 'number', min: 1 },
        { key: 'description', label: 'Описание', input: 'text' }
      ];
    }
    get target() {
      return Math.max(1, Number(this.def.amount) || 1);
    }
    onEvent(event) {
      if (this.isCompleted()) return;
      if (event.type === 'GoldGained') {
        inc(this, Number(event.payload?.amount) || 0);
      }
    }
    getDescription() {
      return this.def.description || `Накопить ${this.target} зм (${this.getProgress()}/${this.target})`;
    }
  }

  class SpendGoldTask extends QuestTaskBase {
    static typeId = 'SpendGold';
    static label = 'Потратить золото';
    static getEditorFields() {
      return [
        { key: 'amount', label: 'Сумма', input: 'number', min: 1 },
        { key: 'description', label: 'Описание', input: 'text' }
      ];
    }
    get target() {
      return Math.max(1, Number(this.def.amount) || 1);
    }
    onEvent(event) {
      if (this.isCompleted()) return;
      if (event.type === 'GoldSpent') {
        inc(this, Number(event.payload?.amount) || 0);
      }
    }
    getDescription() {
      return this.def.description || `Потратить ${this.target} зм`;
    }
  }

  class ReachLevelTask extends QuestTaskBase {
    static typeId = 'ReachLevel';
    static label = 'Достичь уровня';
    static getEditorFields() {
      return [
        { key: 'level', label: 'Уровень', input: 'number', min: 1 },
        { key: 'description', label: 'Описание', input: 'text' }
      ];
    }
    get target() {
      return Math.max(1, Number(this.def.level) || 1);
    }
    applyWorldState(world) {
      const lvl = Number(world?.level) || 0;
      if (lvl >= this.target) {
        this._progress = this.target;
        this._completed = true;
      }
    }
    onEvent(event) {
      if (this.isCompleted()) return;
      if (event.type === 'PlayerLevelChanged' || event.type === 'LevelChanged' || event.type === 'LevelUp') {
        this.applyWorldState({ level: Number(event.payload?.level) || 0 });
      }
    }
    getDescription() {
      return this.def.description || `Достичь ${this.target} уровня`;
    }
  }

  class EquipItemTask extends QuestTaskBase {
    static typeId = 'EquipItem';
    static label = 'Экипировать предмет';
    static getEditorFields() {
      return [
        { key: 'itemId', label: 'Предмет', input: 'item', required: true },
        { key: 'description', label: 'Описание', input: 'text' }
      ];
    }
    applyWorldState(world) {
      if (!this.def.itemId || !world?.equipped) return;
      const ids = Object.values(world.equipped).filter(Boolean).map(String);
      if (ids.some((id) => matchId(id, this.def.itemId))) this.markComplete();
    }
    onEvent(event) {
      if (this.isCompleted()) return;
      if (event.type === 'ItemEquipped') {
        const p = event.payload || {};
        if (!this.def.itemId || matchId(p.itemId || p.item, this.def.itemId)) {
          this.markComplete();
        }
      }
    }
    getDescription() {
      return this.def.description || ('Надеть: ' + (this.def.itemId || 'предмет'));
    }
  }

  class InteractObjectTask extends QuestTaskBase {
    static typeId = 'InteractObject';
    static label = 'Взаимодействовать с объектом';
    static description = 'Завершается событием ObjectInteracted (не флагами)';
    static getEditorFields() {
      return [
        { key: 'objectId', label: 'Объект', input: 'text', required: true },
        { key: 'sceneId', label: 'Место (необязательно)', input: 'scene' },
        { key: 'description', label: 'Описание', input: 'text' }
      ];
    }
    onEvent(event) {
      if (this.isCompleted()) return;
      // Only ObjectInteracted — FlagSet is not interaction semantics
      if (event.type !== 'ObjectInteracted') return;
      const p = event.payload || {};
      if (this.def.sceneId && p.sceneId && !matchId(p.sceneId, this.def.sceneId)) return;
      if (!this.def.objectId) return;
      if (matchId(p.objectId || p.id, this.def.objectId)) {
        this.markComplete();
      }
    }
    getDescription() {
      return this.def.description || ('Взаимодействовать: ' + (this.def.objectId || 'объект'));
    }
  }

  class DiscoverLocationTask extends QuestTaskBase {
    static typeId = 'DiscoverLocation';
    static label = 'Открыть локацию на карте';
    static getEditorFields() {
      return [
        { key: 'locationId', label: 'Локация', input: 'location', required: true },
        { key: 'description', label: 'Описание', input: 'text' }
      ];
    }
    applyWorldState(world) {
      if (!this.def.locationId || !world?.visitedLocations) return;
      if (world.visitedLocations[this.def.locationId]) this.markComplete();
    }
    onEvent(event) {
      if (this.isCompleted()) return;
      if (event.type === 'LocationDiscovered') {
        const p = event.payload || {};
        if (!this.def.locationId || matchId(p.locationId, this.def.locationId)) {
          this.markComplete();
        }
      }
    }
    getDescription() {
      return this.def.description || ('Открыть: ' + (this.def.locationId || 'локацию'));
    }
  }

  class WaitTimeTask extends QuestTaskBase {
    static typeId = 'WaitTime';
    static label = 'Подождать время';
    static getEditorFields() {
      return [
        { key: 'hours', label: 'Часов', input: 'number', min: 0 },
        { key: 'minutes', label: 'Минут', input: 'number', min: 0 },
        { key: 'description', label: 'Описание', input: 'text' }
      ];
    }
    /** Цель в минутах */
    get target() {
      const h = Number(this.def.hours) || 0;
      const m = Number(this.def.minutes) || 0;
      const total = h * 60 + m;
      return Math.max(1, total || 60);
    }
    onEvent(event) {
      if (this.isCompleted()) return;
      if (event.type === 'TimePassed') {
        const mins = Number(event.payload?.minutes) || (Number(event.payload?.hours) || 0) * 60;
        if (mins > 0) inc(this, mins);
      }
    }
    getDescription() {
      if (this.def.description) return this.def.description;
      const h = Math.floor(this.target / 60);
      const m = this.target % 60;
      if (h && m) return `Подождать ${h} ч. ${m} мин. (${this.getProgress()}/${this.target} мин.)`;
      if (h) return `Подождать ${h} ч. (${this.getProgress()}/${this.target} мин.)`;
      return `Подождать ${this.target} мин. (${this.getProgress()}/${this.target})`;
    }
  }

  class LearnSkillTask extends QuestTaskBase {
    static typeId = 'LearnSkill';
    static label = 'Изучить навык';
    static getEditorFields() {
      return [
        { key: 'skillId', label: 'Навык', input: 'text' },
        { key: 'description', label: 'Описание', input: 'text' }
      ];
    }
    applyWorldState(world) {
      if (!this.def.skillId || !world) return;
      const skills = world.skills || {};
      if (skills[this.def.skillId] != null && skills[this.def.skillId] !== false) {
        this.markComplete();
        return;
      }
      const inc = world.skillIncreases || [];
      if (inc.some((s) => {
        if (typeof s === 'string') return matchId(s, this.def.skillId);
        return matchId(s?.id || s?.skillId, this.def.skillId);
      })) this.markComplete();
    }
    onEvent(event) {
      if (this.isCompleted()) return;
      if (event.type === 'SkillLearned' || event.type === 'SkillUnlocked') {
        const p = event.payload || {};
        if (!this.def.skillId || matchId(p.skillId, this.def.skillId)) this.markComplete();
      }
    }
    getDescription() {
      return this.def.description || ('Изучить: ' + (this.def.skillId || 'навык'));
    }
  }

  class EscortNPCTask extends QuestTaskBase {
    static unsupported = true;
    static unsupportedReason = 'NPCEscorted event not emitted by engine yet';
    static typeId = 'EscortNPC';
    static label = 'Сопроводить NPC';
    static getEditorFields() {
      return [
        { key: 'npcId', label: 'Персонаж', input: 'npc' },
        { key: 'sceneId', label: 'Куда идти', input: 'scene' },
        { key: 'description', label: 'Описание', input: 'text' }
      ];
    }
    onEvent(event) {
      if (this.isCompleted()) return;
      if (event.type === 'NPCEscorted') {
        const p = event.payload || {};
        if (this.def.npcId && p.npcId && !matchId(p.npcId, this.def.npcId)) return;
        if (this.def.sceneId && p.sceneId && !matchId(p.sceneId, this.def.sceneId)) return;
        this.markComplete();
      }
    }
    getDescription() {
      return this.def.description || ('Сопроводить: ' + (this.def.npcId || 'NPC'));
    }
  }

  class ProtectNPCTask extends QuestTaskBase {
    static unsupported = true;
    static unsupportedReason = 'NPCProtected event not emitted by engine yet';
    static typeId = 'ProtectNPC';
    static label = 'Защитить NPC';
    static getEditorFields() {
      return [
        { key: 'npcId', label: 'Персонаж', input: 'npc' },
        { key: 'description', label: 'Описание', input: 'text' }
      ];
    }
    onEvent(event) {
      if (this.isCompleted()) return;
      if (event.type === 'NPCProtected') {
        const p = event.payload || {};
        if (!this.def.npcId || matchId(p.npcId, this.def.npcId)) this.markComplete();
      }
    }
    getDescription() {
      return this.def.description || ('Защитить: ' + (this.def.npcId || 'NPC'));
    }
  }

  class ActivateObjectTask extends QuestTaskBase {
    static unsupported = true;
    static unsupportedReason = 'ObjectActivated event not emitted by engine yet';
    static typeId = 'ActivateObject';
    static label = 'Активировать объект';
    static getEditorFields() {
      return [
        { key: 'objectId', label: 'Объект', input: 'text' },
        { key: 'description', label: 'Описание', input: 'text' }
      ];
    }
    onEvent(event) {
      if (this.isCompleted()) return;
      if (event.type === 'ObjectActivated') {
        const p = event.payload || {};
        if (!this.def.objectId || matchId(p.objectId, this.def.objectId)) this.markComplete();
      }
    }
    getDescription() {
      return this.def.description || ('Активировать: ' + (this.def.objectId || 'объект'));
    }
  }

  const ALL = [
    ManualAdvanceTask, TalkToNPCTask, CollectItemTask, KillEnemyTask, VisitLocationTask,
    DeliverItemTask, UseItemTask, CraftItemTask, ChooseDialogueOptionTask,
    AcquireGoldTask, SpendGoldTask, ReachLevelTask, EquipItemTask,
    InteractObjectTask, DiscoverLocationTask, WaitTimeTask, LearnSkillTask,
    EscortNPCTask, ProtectNPCTask, ActivateObjectTask
  ];
  ALL.forEach((C) => QuestTaskRegistry.register(C.typeId, C));
  class MigrationRequiredTask extends QuestTaskBase {
    static typeId = 'MigrationRequired';
    static label = 'Требует проверки (миграция)';
    static description = 'Автоматически создано при миграции — задайте тип задачи вручную';
    static unsupported = false; // visible so author can fix; does not auto-complete
    static migrationPlaceholder = true;
    static getEditorFields() {
      return [
        { key: 'description', label: 'Описание (из старого этапа)', input: 'text' },
        { key: 'legacyHint', label: 'Старая подсказка', input: 'text' }
      ];
    }
    onEvent() { /* never auto-complete — author must replace type */ }
    isCompleted() { return false; }
    getProgress() { return 0; }
    getDescription() {
      return this.def.description ||
        ('⚠ Нужна ручная настройка задачи (миграция): ' + (this.def.legacyHint || this.def.legacyId || ''));
    }
    serialize() {
      const base = super.serialize();
      base.type = 'MigrationRequired';
      base.legacyData = this.def.legacyData || null;
      base.legacyHint = this.def.legacyHint || '';
      base.legacyId = this.def.legacyId || '';
      base._migrationRequired = true;
      return base;
    }
  }


  QuestTaskRegistry.register('MigrationRequired', MigrationRequiredTask);
})();
