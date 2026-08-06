import QuestStage from './QuestStage.js';

/**
 * Квест, состоящий из этапов
 */
class Quest {
    constructor(id, config = {}) {
        this.id = id;
        this.name = config.name || 'Без названия';
        this.description = config.description || '';
        this.stages = [];
        this.currentStageIndex = 0;
        this.completed = false;
        this.failed = false;
        this.rewards = config.rewards || {};
        this.config = config;
    }

    /**
     * Добавить этап в квест
     * @param {QuestStage} stage 
     */
    addStage(stage) {
        this.stages.push(stage);
    }

    /**
     * Получить текущий этап
     * @returns {QuestStage|null}
     */
    getCurrentStage() {
        if (this.currentStageIndex >= this.stages.length) {
            return null;
        }
        return this.stages[this.currentStageIndex];
    }

    /**
     * Проверить завершение текущего этапа и перейти к следующему
     * @returns {boolean} - перешли ли к новому этапу
     */
    checkStageCompletion() {
        const currentStage = this.getCurrentStage();
        if (!currentStage) return false;

        if (currentStage.isCompleted()) {
            currentStage.completed = true;
            this.currentStageIndex++;

            // Если это был последний этап, квест завершён
            if (this.currentStageIndex >= this.stages.length) {
                this.completed = true;
            }

            return true;
        }

        return false;
    }

    /**
     * Обработать событие для текущего этапа
     * @param {QuestEvent} event 
     * @returns {boolean} - было ли обновлено состояние
     */
    handleEvent(event) {
        if (this.completed || this.failed) return false;

        const currentStage = this.getCurrentStage();
        if (!currentStage) return false;

        const updated = currentStage.handleEvent(event);
        
        if (updated) {
            this.checkStageCompletion();
        }

        return updated;
    }

    /**
     * Получить общий прогресс квеста
     * @returns {object} { current, total, stages: [] }
     */
    getProgress() {
        const totalStages = this.stages.length;
        const completedStages = this.stages.filter(s => s.completed).length;
        
        return {
            current: completedStages,
            total: totalStages,
            stages: this.stages.map(s => ({
                id: s.id,
                name: s.name,
                completed: s.completed,
                progress: s.getProgress(),
                tasks: s.getTasksDescriptions()
            })),
            isCompleted: this.completed,
            isFailed: this.failed
        };
    }

    /**
     * Сбросить квест
     */
    reset() {
        this.stages.forEach(stage => stage.reset());
        this.currentStageIndex = 0;
        this.completed = false;
        this.failed = false;
    }

    /**
     * Провалить квест
     */
    fail() {
        this.failed = true;
    }

    /**
     * Сериализация квеста
     * @returns {object}
     */
    serialize() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            stages: this.stages.map(s => s.serialize()),
            currentStageIndex: this.currentStageIndex,
            completed: this.completed,
            failed: this.failed,
            rewards: this.rewards,
            config: this.config
        };
    }

    /**
     * Десериализация квеста
     * @param {object} data 
     * @param {TaskFactory} taskFactory 
     */
    deserialize(data, taskFactory) {
        this.id = data.id;
        this.name = data.name || 'Без названия';
        this.description = data.description || '';
        this.currentStageIndex = data.currentStageIndex || 0;
        this.completed = data.completed || false;
        this.failed = data.failed || false;
        this.rewards = data.rewards || {};
        this.config = data.config || {};

        this.stages = [];
        if (data.stages && Array.isArray(data.stages)) {
            data.stages.forEach((stageData, index) => {
                const stage = new QuestStage(index);
                stage.deserialize(stageData, taskFactory);
                this.stages.push(stage);
            });
        }
    }

    /**
     * Получить описание квеста для журнала
     * @returns {object}
     */
    getJournalEntry() {
        const progress = this.getProgress();
        const currentStage = this.getCurrentStage();
        
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            status: this.completed ? 'completed' : (this.failed ? 'failed' : 'active'),
            currentStageName: currentStage ? currentStage.name : '',
            tasks: currentStage ? currentStage.getTasksDescriptions() : [],
            progress: progress
        };
    }
}

export default Quest;
