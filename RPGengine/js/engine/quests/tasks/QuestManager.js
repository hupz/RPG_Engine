import Quest from './Quest.js';
import QuestStage from './QuestStage.js';
import TaskFactory from './TaskFactory.js';
import QuestEventBus from './QuestEventBus.js';
import QuestEvent from './QuestEvent.js';

/**
 * Менеджер квестов - центральный управляющий компонент
 * Интегрируется с gameState.state для сохранения прогресса
 */
class QuestManager {
    constructor() {
        this.quests = new Map();
        this.eventBus = new QuestEventBus();
        this.taskFactory = TaskFactory;
        this.initialized = false;
        
        // Подписываемся на события для обновления квестов
        this.setupEventHandling();
    }
    
    /**
     * Инициализация менеджера квестов
     * @param {object} gameState - ссылка на состояние игры
     */
    init(gameState) {
        if (this.initialized) return;
        
        this.gameState = gameState;
        this.loadFromState();
        this.initialized = true;
        
        console.log('[QuestManager] Инициализирован');
    }
    
    /**
     * Загрузить квесты из состояния игры
     */
    loadFromState() {
        if (!this.gameState?.state?.quests) return;
        
        const questsData = this.gameState.state.quests;
        Object.keys(questsData).forEach(questId => {
            const questData = questsData[questId];
            const quest = new Quest(questId);
            quest.deserialize(questData, this.taskFactory);
            this.quests.set(questId, quest);
        });
        
        console.log(`[QuestManager] Загружено ${this.quests.size} квестов`);
    }
    
    /**
     * Сохранить квесты в состояние игры
     */
    saveToState() {
        if (!this.gameState?.state) return;
        
        const questsData = {};
        this.quests.forEach((quest, id) => {
            questsData[id] = quest.serialize();
        });
        
        this.gameState.state.quests = questsData;
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

        Object.values(data.quests).forEach(questData => {
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
        this.initialized = false;
        this.gameState = null;
    }
    
    /**
     * Получить экземпляр менеджера (синглтон)
     * @returns {QuestManager}
     */
    static getInstance() {
        if (!this._instance) {
            this._instance = new QuestManager();
        }
        return this._instance;
    }
}

export default QuestManager;
