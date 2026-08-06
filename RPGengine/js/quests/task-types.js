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
    static label = 'Продвинуть вручную (сцена)';
    static description = 'Завершается, когда сцена/выбор активирует этот этап';
    static getEditorFields() {
      return [
        { key: 'description', label: 'Описание для журнала', input: 'text' },
        { key: 'stageKey', label: 'Ключ этапа (служебный)', input: 'text' }
      ];
    }
    onEvent(event) {
      if (this.isCompleted()) return;
      if (event.type === 'StageActivated' || event.type === 'StageSet') {
        const p = event.payload || {};
        if (p.questId && this._ctx.questId && !matchId(p.questId, this._ctx.questId)) return;
        if (p.stageIndex != null && this._ctx.stageIndex != null &&
            Number(p.stageIndex) !== Number(this._ctx.stageIndex)) return;
        if (p.stageKey != null && this.def.stageKey && !matchId(p.stageKey, this.def.stageKey)) return;
        // If event targets this stage index, complete
        if (p.stageIndex != null && this._ctx.stageIndex != null &&
            Number(p.stageIndex) === Number(this._ctx.stageIndex)) {
          this.markComplete();
          return;
        }
        if (p.stageKey && this.def.stageKey && matchId(p.stageKey, this.def.stageKey)) {
          this.markComplete();
        }
      }
      if (event.type === 'TaskManualComplete') {
        const p = event.payload || {};
        if (p.taskId && matchId(p.taskId, this.id)) this.markComplete();
        if (p.questId && p.stageIndex != null &&
            matchId(p.questId, this._ctx.questId) &&
            Number(p.stageIndex) === Number(this._ctx.stageIndex)) {
          this.markComplete();
        }
      }
    }
    getDescription() {
      return this.def.description || 'Выполните задание этапа';
    }
  }

  class TalkToNPCTask extends QuestTaskBase {
    static typeId = 'TalkToNPC';
    static label = 'Поговорить с NPC';
    static description = 'Завершается после диалога с указанным NPC';
    static getEditorFields() {
      return [
        { key: 'npcId', label: 'NPC (id)', input: 'npc' },
        { key: 'description', label: 'Описание', input: 'text' }
      ];
    }
    onEvent(event) {
      if (this.isCompleted()) return;
      if (event.type === 'NPCDialogueFinished' || event.type === 'NPCTalked') {
        const npcId = event.payload?.npcId || event.payload?.npc;
        if (!this.def.npcId || matchId(npcId, this.def.npcId)) this.markComplete();
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
        { key: 'itemId', label: 'Предмет (id)', input: 'item' },
        { key: 'count', label: 'Количество', input: 'number', min: 1 },
        { key: 'description', label: 'Описание', input: 'text' }
      ];
    }
    onEvent(event) {
      if (this.isCompleted()) return;
      if (event.type === 'ItemCollected' || event.type === 'ItemAdded') {
        const p = event.payload || {};
        if (this.def.itemId && !matchId(p.itemId || p.item, this.def.itemId)) return;
        inc(this, Number(p.qty) || Number(p.count) || 1);
      }
      if (event.type === 'InventorySync' && this.def.itemId) {
        const inv = event.payload?.inventory || [];
        const n = inv.filter((id) => matchId(id, this.def.itemId)).length;
        this._progress = Math.min(this.target, n);
        if (this._progress >= this.target) this._completed = true;
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
        { key: 'enemyId', label: 'Враг (id)', input: 'enemy' },
        { key: 'count', label: 'Количество', input: 'number', min: 1 },
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
        { key: 'sceneId', label: 'Сцена (id)', input: 'scene' },
        { key: 'location', label: 'Название локации (текст)', input: 'text' },
        { key: 'description', label: 'Описание', input: 'text' }
      ];
    }
    onEvent(event) {
      if (this.isCompleted()) return;
      if (event.type === 'LocationVisited' || event.type === 'SceneEntered') {
        const p = event.payload || {};
        if (this.def.sceneId && matchId(p.sceneId || p.scene, this.def.sceneId)) {
          this.markComplete();
          return;
        }
        if (this.def.location && p.location &&
            String(p.location).toLowerCase().includes(String(this.def.location).toLowerCase())) {
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
        { key: 'itemId', label: 'Предмет (id)', input: 'item' },
        { key: 'npcId', label: 'NPC (id)', input: 'npc' },
        { key: 'count', label: 'Количество', input: 'number', min: 1 },
        { key: 'description', label: 'Описание', input: 'text' }
      ];
    }
    onEvent(event) {
      if (this.isCompleted()) return;
      if (event.type === 'ItemDelivered') {
        const p = event.payload || {};
        if (this.def.itemId && !matchId(p.itemId || p.item, this.def.itemId)) return;
        if (this.def.npcId && p.npcId && !matchId(p.npcId, this.def.npcId)) return;
        inc(this, Number(p.qty) || Number(p.count) || 1);
      }
      // Fallback: item left inventory while deliver-task active (scene took the item)
      if (event.type === 'ItemRemoved') {
        const p = event.payload || {};
        if (this.def.itemId && matchId(p.itemId || p.item, this.def.itemId)) {
          inc(this, 1);
        }
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
        { key: 'itemId', label: 'Предмет (id)', input: 'item' },
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
        { key: 'itemId', label: 'Предмет/рецепт (id)', input: 'item' },
        { key: 'count', label: 'Количество', input: 'number', min: 1 },
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
    static getEditorFields() {
      return [
        { key: 'choiceFlag', label: 'Флаг выбора (once)', input: 'text' },
        { key: 'sceneId', label: 'Сцена (необязательно)', input: 'scene' },
        { key: 'description', label: 'Описание', input: 'text' }
      ];
    }
    onEvent(event) {
      if (this.isCompleted()) return;
      if (event.type === 'ChoiceSelected') {
        const p = event.payload || {};
        if (this.def.choiceFlag && p.flag && matchId(p.flag, this.def.choiceFlag)) {
          this.markComplete();
          return;
        }
        if (this.def.sceneId && matchId(p.sceneId, this.def.sceneId) && p.textMatch) {
          this.markComplete();
        }
      }
    }
    getDescription() {
      return this.def.description || 'Сделать выбор в диалоге';
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
      if (event.type === 'GoldSync') {
        const g = Number(event.payload?.gold) || 0;
        if (g >= this.target) {
          this._progress = this.target;
          this._completed = true;
        }
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
    onEvent(event) {
      if (this.isCompleted()) return;
      if (event.type === 'LevelChanged' || event.type === 'LevelUp') {
        const lvl = Number(event.payload?.level) || 0;
        if (lvl >= this.target) {
          this._progress = this.target;
          this._completed = true;
        }
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
        { key: 'itemId', label: 'Предмет (id)', input: 'item' },
        { key: 'description', label: 'Описание', input: 'text' }
      ];
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
    static getEditorFields() {
      return [
        { key: 'objectId', label: 'Объект / флаг', input: 'text' },
        { key: 'sceneId', label: 'Сцена', input: 'scene' },
        { key: 'description', label: 'Описание', input: 'text' }
      ];
    }
    onEvent(event) {
      if (this.isCompleted()) return;
      if (event.type === 'ObjectInteracted' || event.type === 'FlagSet') {
        const p = event.payload || {};
        if (this.def.objectId && (matchId(p.objectId, this.def.objectId) || matchId(p.flag, this.def.objectId))) {
          this.markComplete();
        }
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
        { key: 'locationId', label: 'ID локации', input: 'text' },
        { key: 'description', label: 'Описание', input: 'text' }
      ];
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
        { key: 'hours', label: 'Часов', input: 'number', min: 1 },
        { key: 'description', label: 'Описание', input: 'text' }
      ];
    }
    get target() {
      return Math.max(1, Number(this.def.hours) || 1);
    }
    onEvent(event) {
      if (this.isCompleted()) return;
      if (event.type === 'TimePassed') {
        inc(this, Number(event.payload?.hours) || 0);
      }
    }
    getDescription() {
      return this.def.description || `Подождать ${this.target} ч.`;
    }
  }

  class LearnSkillTask extends QuestTaskBase {
    static typeId = 'LearnSkill';
    static label = 'Изучить навык';
    static getEditorFields() {
      return [
        { key: 'skillId', label: 'Навык (id)', input: 'text' },
        { key: 'description', label: 'Описание', input: 'text' }
      ];
    }
    onEvent(event) {
      if (this.isCompleted()) return;
      if (event.type === 'SkillLearned') {
        const p = event.payload || {};
        if (!this.def.skillId || matchId(p.skillId, this.def.skillId)) this.markComplete();
      }
    }
    getDescription() {
      return this.def.description || ('Изучить: ' + (this.def.skillId || 'навык'));
    }
  }

  class EscortNPCTask extends QuestTaskBase {
    static typeId = 'EscortNPC';
    static label = 'Сопроводить NPC';
    static getEditorFields() {
      return [
        { key: 'npcId', label: 'NPC', input: 'npc' },
        { key: 'sceneId', label: 'Целевая сцена', input: 'scene' },
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
    static typeId = 'ProtectNPC';
    static label = 'Защитить NPC';
    static getEditorFields() {
      return [
        { key: 'npcId', label: 'NPC', input: 'npc' },
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
})();
