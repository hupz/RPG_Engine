/**
 * Интеграция новой системы квестов с движком
 * Подключает QuestManager к gameState и публикует события
 */

import QuestManager from './tasks/QuestManager.js';
import Migration from './Migration.js';

// Глобальный экземпляр для совместимости со старым кодом
window.NewQuestSystem = null;

/**
 * Инициализировать новую систему квестов
 * @param {object} gameState - ссылка на GameEngine.state
 * @param {object} gameData - данные игры (data.quests)
 */
export function initQuestSystem(gameState, gameData) {
    if (window.NewQuestSystem) {
        console.log('[QuestSystem] Уже инициализирована');
        return window.NewQuestSystem;
    }

    const manager = QuestManager.getInstance();
    manager.init(gameState);

    // Миграция старых квестов если есть данные
    if (gameData?.quests) {
        const migratedQuests = Migration.migrateAll(gameData.quests);
        
        // Добавляем мигрированные квесты в менеджер
        migratedQuests.forEach((quest, id) => {
            if (!manager.getQuest(id)) {
                manager.addQuest(quest);
            }
        });
    }

    window.NewQuestSystem = manager;
    console.log('[QuestSystem] Инициализирована новая система квестов');
    
    return manager;
}

/**
 * Опубликовать событие о посещении локации
 * @param {string} locationId 
 */
export function publishLocationVisited(locationId) {
    if (window.NewQuestSystem) {
        window.NewQuestSystem.emitEvent('LocationVisited', { locationId });
    }
}

/**
 * Опубликовать событие о получении предмета
 * @param {string} itemId 
 * @param {number} quantity 
 */
export function publishItemCollected(itemId, quantity = 1) {
    if (window.NewQuestSystem) {
        window.NewQuestSystem.emitEvent('ItemCollected', { itemId, quantity });
    }
}

/**
 * Опубликовать событие об убийстве врага
 * @param {string} enemyId 
 * @param {number} quantity 
 */
export function publishEnemyKilled(enemyId, quantity = 1) {
    if (window.NewQuestSystem) {
        window.NewQuestSystem.emitEvent('EnemyKilled', { enemyId, quantity });
    }
}

/**
 * Опубликовать событие о завершении диалога с NPC
 * @param {string} npcId 
 * @param {string} dialogueId 
 */
export function publishDialogueFinished(npcId, dialogueId = null) {
    if (window.NewQuestSystem) {
        window.NewQuestSystem.emitEvent('NPCDialogueFinished', { npcId, dialogueId });
    }
}

/**
 * Опубликовать событие о взаимодействии с объектом
 * @param {string} objectId 
 * @param {string} interactionType 
 */
export function publishObjectInteracted(objectId, interactionType = 'use') {
    if (window.NewQuestSystem) {
        window.NewQuestSystem.emitEvent('ObjectInteracted', { objectId, interactionType });
    }
}

/**
 * Получить данные квестов для журнала
 * @returns {Array}
 */
export function getJournalData() {
    if (window.NewQuestSystem) {
        return window.NewQuestSystem.getJournalData();
    }
    return [];
}

/**
 * Сохранить состояние квестов
 */
export function saveQuests() {
    if (window.NewQuestSystem) {
        window.NewQuestSystem.saveToState();
    }
}

/**
 * Загрузить состояние квестов
 */
export function loadQuests() {
    if (window.NewQuestSystem) {
        window.NewQuestSystem.loadFromState();
    }
}
