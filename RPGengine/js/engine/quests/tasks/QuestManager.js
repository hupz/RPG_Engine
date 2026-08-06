import Quest from './Quest.js';
import QuestStage from './QuestStage.js';
import TaskFactory from './TaskFactory.js';
import QuestEventBus from './QuestEventBus.js';
import QuestEvent from './QuestEvent.js';

/**
 * Менеджер квестов - центральный управляющий компонент
 */
class QuestManager {
    constructor() {
        this.quests = new Map();
        this.eventBus = new QuestEventBus();
        this.taskFactory = TaskFactory;
        
        // Подписываемся на события для обновления квестов
        this.setupEventHandling();
    }

    /**
     * Настроить обработку событий
     */
    setupEventHandling() {
        this.eventBus.subscribe('*', (event) => {
            this.handleGlobalEvent(event);
        });
    }

    /**
     * Обработать глобальное событие для всех квестов
     * @param {QuestEvent} event 
     */
    handleGlobalEvent(event) {
        this.quests.forEach((quest, questId) => {
            if (!quest.completed && !quest.failed) {
                quest.handleEvent(event);
            }
        });
    }

    /**
     * Добавить квест
     * @param {Quest} quest 
     */
    addQuest(quest) {
        this.quests.set(quest.id, quest);
    }

    /**
     * Создать и добавить квест из конфигурации
     * @param {string} id 
     * @param {object} config 
     * @returns {Quest}
     */
    createQuest(id, config = {}) {
        const quest = new Quest(id, config);
        
        // Создаём этапы из конфигурации
        if (config.stages && Array.isArray(config.stages)) {
            config.stages.forEach((stageConfig, index) => {
                const stage = new QuestStage(index, stageConfig);
                
                // Создаём задачи из конфигурации
                if (stageConfig.tasks && Array.isArray(stageConfig.tasks)) {
                    stageConfig.tasks.forEach(taskConfig => {
                        const task = this.taskFactory.create(taskConfig.type, taskConfig);
                        if (task) {
                            stage.addTask(task);
                        }
                    });
                }
                
                quest.addStage(stage);
            });
        }
        
        this.addQuest(quest);
        return quest;
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
     * Удалить квест
     * @param {string} questId 
     */
    removeQuest(questId) {
        this.quests.delete(questId);
    }

    /**
     * Опубликовать событие
     * @param {QuestEvent} event 
     */
    publishEvent(event) {
        this.eventBus.publish(event);
    }

    /**
     * Создать и опубликовать событие
     * @param {string} type 
     * @param {object} payload 
     */
    emitEvent(type, payload = {}) {
        const event = new QuestEvent(type, payload);
        this.publishEvent(event);
    }

    /**
     * Получить все активные квесты
     * @returns {Quest[]}
     */
    getActiveQuests() {
        return Array.from(this.quests.values())
            .filter(q => !q.completed && !q.failed);
    }

    /**
     * Получить все завершённые квесты
     * @returns {Quest[]}
     */
    getCompletedQuests() {
        return Array.from(this.quests.values())
            .filter(q => q.completed);
    }

    /**
     * Получить данные для журнала квестов
     * @returns {object[]}
     */
    getJournalData() {
        return Array.from(this.quests.values())
            .map(q => q.getJournalEntry());
    }

    /**
     * Проверить завершение квеста и выдать награды
     * @param {string} questId 
     * @returns {boolean} - были ли выданы награды
     */
    checkQuestCompletion(questId) {
        const quest = this.getQuest(questId);
        if (!quest || !quest.completed) return false;

        // Здесь будет логика выдачи наград
        // rewards: { gold, xp, reputation, items }
        if (quest.rewards && Object.keys(quest.rewards).length > 0) {
            this.emitEvent('QuestRewardsGiven', {
                questId: questId,
                rewards: quest.rewards
            });
        }

        return true;
    }

    /**
     * Сериализация всех квестов для сохранения
     * @returns {object}
     */
    serialize() {
        const questsData = {};
        this.quests.forEach((quest, id) => {
            questsData[id] = quest.serialize();
        });
        return { quests: questsData };
    }

    /**
     * Десериализация квестов из сохранения
     * @param {object} data 
     */
    deserialize(data) {
        if (!data || !data.quests) return;

        data.quests.forEach(questData => {
            const quest = new Quest(questData.id);
            quest.deserialize(questData, this.taskFactory);
            this.quests.set(quest.id, quest);
        });
    }

    /**
     * Очистить все квесты
     */
    clear() {
        this.quests.clear();
        this.eventBus.clear();
    }
}

export default QuestManager;
