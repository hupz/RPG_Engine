/**
 * QuestIntegration.js
 * Мост между старыми системами движка и новой системой квестов.
 * Перехватывает события игры и транслирует их в шину событий квестов.
 */

import { QuestEventBus, QuestEvent } from './quests/QuestEventBus.js';

// Типы событий для квестовой системы
const QUEST_EVENT_TYPES = {
    ENEMY_KILLED: 'EnemyKilled',
    ITEM_COLLECTED: 'ItemCollected',
    ITEM_USED: 'ItemUsed',
    ITEM_DELIVERED: 'ItemDelivered',
    LOCATION_VISITED: 'LocationVisited',
    NPC_TALKED: 'NPCDialogueFinished',
    OBJECT_INTERACTED: 'ObjectInteracted',
    TIME_WAITED: 'TimeWaited',
    LEVEL_REACHED: 'LevelReached',
    GOLD_ACQUIRED: 'GoldAcquired',
    GOLD_SPENT: 'GoldSpent',
    SKILL_LEARNED: 'SkillLearned',
    DIALOGUE_OPTION_CHOSEN: 'DialogueOptionChosen'
};

class QuestIntegration {
    constructor() {
        this.eventBus = null;
        this.isInitialized = false;
        
        // Ссылки на системы движка (заполняются при инициализации)
        this.combatSystem = null;
        this.inventorySystem = null;
        this.sceneManager = null;
        this.dialogueSystem = null;
        this.timeSystem = null;
        this.playerSystem = null;
    }

    /**
     * Инициализация интеграции
     * @param {object} engineSystems - Объект со ссылками на системы движка
     */
    init(engineSystems) {
        if (this.isInitialized) {
            console.warn('QuestIntegration уже инициализирована');
            return;
        }

        this.eventBus = new QuestEventBus();
        
        // Сохраняем ссылки на системы
        this.combatSystem = engineSystems.combat || window.combatSystem;
        this.inventorySystem = engineSystems.inventory || window.inventorySystem;
        this.sceneManager = engineSystems.sceneManager || window.sceneManager;
        this.dialogueSystem = engineSystems.dialogue || window.dialogueSystem;
        this.timeSystem = engineSystems.time || window.timeSystem;
        this.playerSystem = engineSystems.player || window.playerSystem;

        this._hookCombatSystem();
        this._hookInventorySystem();
        this._hookSceneManager();
        this._hookDialogueSystem();
        this._hookTimeSystem();
        this._hookPlayerSystem();

        this.isInitialized = true;
        console.log('QuestIntegration: инициализирована успешно');
    }

    /**
     * Публикация события в шину квестов
     * @param {string} type - Тип события
     * @param {object} data - Данные события
     */
    publishEvent(type, data = {}) {
        if (!this.eventBus) {
            console.error('QuestIntegration: шина событий не инициализирована');
            return;
        }

        const event = new QuestEvent(type, data);
        this.eventBus.publish(event);
        
        // Логирование для отладки (можно отключить в релизе)
        // console.log(`[QuestEvent] ${type}`, data);
    }

    // ==================== ХУКИ ДЛЯ БОЕВОЙ СИСТЕМЫ ====================

    _hookCombatSystem() {
        if (!this.combatSystem) return;

        // Сохраняем оригинальный метод завершения боя
        const originalEndCombat = this.combatSystem.endCombat?.bind(this.combatSystem);
        
        if (originalEndCombat) {
            this.combatSystem.endCombat = (winner, defeatedEnemies) => {
                const result = originalEndCombat(defeatedEnemies);
                
                // Публикуем события о убитых врагах
                if (defeatedEnemies && Array.isArray(defeatedEnemies)) {
                    defeatedEnemies.forEach(enemy => {
                        this.publishEvent(QUEST_EVENT_TYPES.ENEMY_KILLED, {
                            enemyId: enemy.id || enemy.templateId,
                            enemyType: enemy.type,
                            count: 1
                        });
                    });
                }

                return result;
            };
        }
    }

    // ==================== ХУКИ ДЛЯ ИНВЕНТАРЯ ====================

    _hookInventorySystem() {
        if (!this.inventorySystem) return;

        // Хук на добавление предмета
        const originalAddItem = this.inventorySystem.addItem?.bind(this.inventorySystem);
        if (originalAddItem) {
            this.inventorySystem.addItem = (itemId, count = 1) => {
                const result = originalAddItem(itemId, count);
                
                if (result) {
                    this.publishEvent(QUEST_EVENT_TYPES.ITEM_COLLECTED, {
                        itemId: itemId,
                        count: count
                    });
                }
                
                return result;
            };
        }

        // Хук на использование предмета
        const originalUseItem = this.inventorySystem.useItem?.bind(this.inventorySystem);
        if (originalUseItem) {
            this.inventorySystem.useItem = (itemId, targetId) => {
                const result = originalUseItem(itemId, targetId);
                
                if (result) {
                    this.publishEvent(QUEST_EVENT_TYPES.ITEM_USED, {
                        itemId: itemId,
                        targetId: targetId
                    });
                }
                
                return result;
            };
        }
        
        // Хук на передачу предмета (для квестов доставки)
        // Предполагается, что в движке есть метод передачи предмета NPC
        const originalGiveItem = this.inventorySystem.giveItem?.bind(this.inventorySystem);
        if (originalGiveItem) {
            this.inventorySystem.giveItem = (itemId, npcId, count = 1) => {
                const result = originalGiveItem(itemId, npcId, count);
                
                if (result) {
                    this.publishEvent(QUEST_EVENT_TYPES.ITEM_DELIVERED, {
                        itemId: itemId,
                        npcId: npcId,
                        count: count
                    });
                }
                
                return result;
            };
        }
    }

    // ==================== ХУКИ ДЛЯ МЕНЕДЖЕРА СЦЕН ====================

    _hookSceneManager() {
        if (!this.sceneManager) return;

        // Хук на переход в новую сцену (локацию)
        const originalLoadScene = this.sceneManager.loadScene?.bind(this.sceneManager);
        if (originalLoadScene) {
            this.sceneManager.loadScene = (sceneId) => {
                const result = originalLoadScene(sceneId);
                
                // Публикуем событие посещения локации
                // Небольшая задержка, чтобы сцена успела загрузиться
                setTimeout(() => {
                    this.publishEvent(QUEST_EVENT_TYPES.LOCATION_VISITED, {
                        sceneId: sceneId,
                        sceneType: this.sceneManager.getCurrentSceneType?.() || 'location'
                    });
                }, 100);
                
                return result;
            };
        }
        
        // Хук на взаимодействие с объектом сцены
        const originalInteractObject = this.sceneManager.interactObject?.bind(this.sceneManager);
        if (originalInteractObject) {
            this.sceneManager.interactObject = (objectId) => {
                const result = originalInteractObject(objectId);
                
                this.publishEvent(QUEST_EVENT_TYPES.OBJECT_INTERACTED, {
                    objectId: objectId,
                    sceneId: this.sceneManager.currentSceneId
                });
                
                return result;
            };
        }
    }

    // ==================== ХУКИ ДЛЯ ДИАЛОГОВОЙ СИСТЕМЫ ====================

    _hookDialogueSystem() {
        if (!this.dialogueSystem) return;

        // Хук на завершение диалога
        const originalEndDialogue = this.dialogueSystem.endDialogue?.bind(this.dialogueSystem);
        if (originalEndDialogue) {
            this.dialogueSystem.endDialogue = (npcId, lastOptionId) => {
                const result = originalEndDialogue(npcId, lastOptionId);
                
                this.publishEvent(QUEST_EVENT_TYPES.NPC_TALKED, {
                    npcId: npcId,
                    lastOptionId: lastOptionId
                });
                
                return result;
            };
        }
        
        // Хук на выбор опции диалога
        const originalSelectOption = this.dialogueSystem.selectOption?.bind(this.dialogueSystem);
        if (originalSelectOption) {
            this.dialogueSystem.selectOption = (optionId, npcId) => {
                const result = originalSelectOption(optionId, npcId);
                
                this.publishEvent(QUEST_EVENT_TYPES.DIALOGUE_OPTION_CHOSEN, {
                    optionId: optionId,
                    npcId: npcId
                });
                
                return result;
            };
        }
    }

    // ==================== ХУКИ ДЛЯ СИСТЕМЫ ВРЕМЕНИ ====================

    _hookTimeSystem() {
        if (!this.timeSystem) return;

        // Хук на ожидание времени (сон, ожидание)
        const originalWait = this.timeSystem.wait?.bind(this.timeSystem);
        if (originalWait) {
            this.timeSystem.wait = (hours) => {
                const result = originalWait(hours);
                
                this.publishEvent(QUEST_EVENT_TYPES.TIME_WAITED, {
                    hours: hours,
                    currentTime: this.timeSystem.getCurrentTime?.()
                });
                
                return result;
            };
        }
    }

    // ==================== ХУКИ ДЛЯ СИСТЕМЫ ИГРОКА ====================

    _hookPlayerSystem() {
        if (!this.playerSystem) return;

        // Отслеживание уровня игрока
        // Если в движке есть метод повышения уровня
        const originalLevelUp = this.playerSystem.levelUp?.bind(this.playerSystem);
        if (originalLevelUp) {
            this.playerSystem.levelUp = () => {
                const result = originalLevelUp();
                
                this.publishEvent(QUEST_EVENT_TYPES.LEVEL_REACHED, {
                    level: this.playerSystem.level || this.playerSystem.getLevel?.()
                });
                
                return result;
            };
        }
        
        // Отслеживание получения золота
        const originalAddGold = this.playerSystem.addGold?.bind(this.playerSystem);
        if (originalAddGold) {
            this.playerSystem.addGold = (amount) => {
                const result = originalAddGold(amount);
                
                this.publishEvent(QUEST_EVENT_TYPES.GOLD_ACQUIRED, {
                    amount: amount,
                    totalGold: this.playerSystem.gold
                });
                
                return result;
            };
        }
        
        // Отслеживание траты золота
        const originalSpendGold = this.playerSystem.spendGold?.bind(this.playerSystem);
        if (originalSpendGold) {
            this.playerSystem.spendGold = (amount) => {
                const result = originalSpendGold(amount);
                
                if (result) {
                    this.publishEvent(QUEST_EVENT_TYPES.GOLD_SPENT, {
                        amount: amount,
                        totalGold: this.playerSystem.gold
                    });
                }
                
                return result;
            };
        }
        
        // Отслеживание изучения навыка
        const originalLearnSkill = this.playerSystem.learnSkill?.bind(this.playerSystem);
        if (originalLearnSkill) {
            this.playerSystem.learnSkill = (skillId) => {
                const result = originalLearnSkill(skillId);
                
                if (result) {
                    this.publishEvent(QUEST_EVENT_TYPES.SKILL_LEARNED, {
                        skillId: skillId
                    });
                }
                
                return result;
            };
        }
    }

    /**
     * Получить экземпляр шины событий (для QuestManager)
     */
    getEventBus() {
        return this.eventBus;
    }
}

// Экспорт singleton
const questIntegration = new QuestIntegration();

export { QuestIntegration, questIntegration, QUEST_EVENT_TYPES };
export default questIntegration;
