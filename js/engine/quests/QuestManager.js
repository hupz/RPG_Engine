/**
 * Менеджер квестов - центральная система управления квестами
 * Обрабатывает события, управляет состоянием и интеграцией с другими системами
 */
import Quest from './Quest.js';
import QuestStage from './QuestStage.js';
import QuestEvent from './QuestEvent.js';
import QuestEventBus from './QuestEventBus.js';
import TaskFactory from './TaskFactory.js';

class QuestManager {
    constructor() {
        this.quests = new Map();
        this.eventBus = new QuestEventBus();
        this.taskFactory = new TaskFactory();
        this.onQuestUpdateCallbacks = [];
        this.onQuestCompletedCallbacks = [];
        this.onStageChangedCallbacks = [];
    }

    /**
     * Добавить квест
     * @param {Quest} quest 
     */
    addQuest(quest) {
        if (!quest) return;
        this.quests.set(quest.id, quest);
        this.subscribeQuestToEvents(quest);
    }

    /**
     * Удалить квест
     * @param {string} questId 
     */
    removeQuest(questId) {
        const quest = this.quests.get(questId);
        if (quest) {
            this.unsubscribeQuestFromEvents(quest);
            this.quests.delete(questId);
        }
    }

    /**
     * Получить квест по ID
     * @param {string} questId 
     * @returns {Quest|null}
     */
    getQuest(questId) {
        return this.quests.get(questId) || null;
    }

    /**
     * Получить все активные квесты
     * @returns {Quest[]}
     */
    getActiveQuests() {
        return Array.from(this.quests.values()).filter(q => q.isActive());
    }

    /**
     * Получить все завершенные квесты
     * @returns {Quest[]}
     */
    getCompletedQuests() {
        return Array.from(this.quests.values()).filter(q => q.completed);
    }

    /**
     * Подписать квест на события
     * @param {Quest} quest 
     */
    subscribeQuestToEvents(quest) {
        // Подписка на все типы событий, которые могут быть интересны задачам
        const eventTypes = [
            'NPCDialogueFinished',
            'ItemCollected',
            'EnemyKilled',
            'LocationVisited',
            'ObjectInteracted',
            'ItemDelivered'
        ];

        for (const eventType of eventTypes) {
            this.eventBus.subscribe(eventType, (event) => {
                return quest.handleEvent(event);
            }, quest);
        }
    }

    /**
     * Отписать квест от событий
     * @param {Quest} quest 
     */
    unsubscribeQuestFromEvents(quest) {
        const eventTypes = [
            'NPCDialogueFinished',
            'ItemCollected',
            'EnemyKilled',
            'LocationVisited',
            'ObjectInteracted',
            'ItemDelivered'
        ];

        for (const eventType of eventTypes) {
            this.eventBus.unsubscribe(eventType, quest.handleEvent);
        }
    }

    /**
     * Опубликовать событие
     * @param {string} type 
     * @param {object} payload 
     */
    publishEvent(type, payload = {}) {
        const event = new QuestEvent(type, payload);
        const stateChanged = this.eventBus.publish(event);
        
        if (stateChanged) {
            this.notifyUpdate();
            this.checkQuestCompletion();
        }
    }

    /**
     * Проверить завершение квестов и выдать награды
     */
    checkQuestCompletion() {
        for (const quest of this.quests.values()) {
            if (quest.completed && !quest.rewardsGiven) {
                this.giveRewards(quest);
                quest.rewardsGiven = true;
                this.notifyQuestCompleted(quest);
            }
        }
    }

    /**
     * Выдать награды за квест
     * @param {Quest} quest 
     */
    giveRewards(quest) {
        const rewards = quest.rewards;
        
        // Здесь будет интеграция с системами игрока
        // Inventory.addItem(), Player.addGold(), etc.
        console.log(`Выданы награды за квест "${quest.title}":`, rewards);
        
        // Событие о выдаче наград
        this.publishEvent('QuestRewardsGiven', {
            questId: quest.id,
            rewards: rewards
        });
    }

    /**
     * Создать квест из данных
     * @param {object} questData 
     * @returns {Quest}
     */
    createQuest(questData) {
        const quest = new Quest(questData.id, questData.title, questData.description);
        
        if (questData.stages) {
            for (const stageData of questData.stages) {
                const stage = new QuestStage(stageData.id, stageData.title);
                
                if (stageData.tasks) {
                    for (const taskData of stageData.tasks) {
                        const task = this.taskFactory.createTask(taskData.type, taskData.data);
                        if (task) {
                            stage.addTask(task);
                        }
                    }
                }
                
                quest.addStage(stage);
            }
        }
        
        if (questData.rewards) {
            quest.setRewards(questData.rewards);
        }
        
        return quest;
    }

    /**
     * Загрузить квест из сохраненных данных
     * @param {object} jsonData 
     * @returns {Quest}
     */
    loadQuest(jsonData) {
        const quest = new Quest();
        quest.deserialize(jsonData, this.taskFactory);
        return quest;
    }

    /**
     * Сохранить все квесты
     * @returns {object[]}
     */
    saveAllQuests() {
        return Array.from(this.quests.values()).map(q => q.serialize());
    }

    /**
     * Загрузить все квесты
     * @param {object[]} questsData 
     */
    loadAllQuests(questsData) {
        this.quests.clear();
        for (const questData of questsData) {
            const quest = this.loadQuest(questData);
            this.addQuest(quest);
        }
    }

    /**
     * Получить записи для журнала
     * @returns {object[]}
     */
    getJournalEntries() {
        return Array.from(this.quests.values())
            .filter(q => q.isActive() || q.completed)
            .map(q => q.getJournalEntry());
    }

    /**
     * Зарегистрировать callback на обновление квеста
     * @param {Function} callback 
     */
    onQuestUpdate(callback) {
        this.onQuestUpdateCallbacks.push(callback);
    }

    /**
     * Зарегистрировать callback на завершение квеста
     * @param {Function} callback 
     */
    onQuestCompleted(callback) {
        this.onQuestCompletedCallbacks.push(callback);
    }

    /**
     * Зарегистрировать callback на смену этапа
     * @param {Function} callback 
     */
    onStageChanged(callback) {
        this.onStageChangedCallbacks.push(callback);
    }

    /**
     * Уведомить об обновлении
     */
    notifyUpdate() {
        for (const callback of this.onQuestUpdateCallbacks) {
            try {
                callback();
            } catch (error) {
                console.error('Error in quest update callback:', error);
            }
        }
    }

    /**
     * Уведомить о завершении квеста
     * @param {Quest} quest 
     */
    notifyQuestCompleted(quest) {
        for (const callback of this.onQuestCompletedCallbacks) {
            try {
                callback(quest);
            } catch (error) {
                console.error('Error in quest completed callback:', error);
            }
        }
    }

    /**
     * Очистить все квесты
     */
    clear() {
        for (const quest of this.quests.values()) {
            this.unsubscribeQuestFromEvents(quest);
        }
        this.quests.clear();
        this.eventBus.clear();
    }

    /**
     * Получить фабрику задач
     * @returns {TaskFactory}
     */
    getTaskFactory() {
        return this.taskFactory;
    }
}

// Singleton instance
let instance = null;

export function getQuestManager() {
    if (!instance) {
        instance = new QuestManager();
    }
    return instance;
}

export default QuestManager;
