/**
 * Квест - содержит этапы и управляет их выполнением
 */
import QuestStage from './QuestStage.js';
import QuestEvent from './QuestEvent.js';

class Quest {
    constructor(id, title = '', description = '') {
        this.id = id;
        this.title = title;
        this.description = description;
        this.stages = [];
        this.currentStageIndex = 0;
        this.completed = false;
        this.failed = false;
        this.rewards = {
            gold: 0,
            experience: 0,
            reputation: [],
            items: []
        };
    }

    /**
     * Добавить этап
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
     * Обработать событие
     * @param {QuestEvent} event 
     * @returns {boolean} - изменилось ли состояние
     */
    handleEvent(event) {
        if (this.completed || this.failed) {
            return false;
        }

        const currentStage = this.getCurrentStage();
        if (!currentStage) {
            return false;
        }

        const stateChanged = currentStage.handleEvent(event);
        
        // Проверка завершения этапа и перехода к следующему
        if (currentStage.completed && !this.completed) {
            this.advanceToNextStage();
        }

        return stateChanged;
    }

    /**
     * Перейти к следующему этапу
     */
    advanceToNextStage() {
        this.currentStageIndex++;
        
        if (this.currentStageIndex >= this.stages.length) {
            this.complete();
        }
    }

    /**
     * Завершить квест
     */
    complete() {
        this.completed = true;
        this.currentStageIndex = Math.max(0, this.stages.length - 1);
    }

    /**
     * Провалить квест
     */
    fail() {
        this.failed = true;
    }

    /**
     * Сбросить квест
     */
    reset() {
        this.currentStageIndex = 0;
        this.completed = false;
        this.failed = false;
        for (const stage of this.stages) {
            stage.reset();
        }
    }

    /**
     * Получить прогресс квеста
     * @returns {object}
     */
    getProgress() {
        const totalStages = this.stages.length;
        const completedStages = this.stages.filter(s => s.completed).length;
        const currentStage = this.getCurrentStage();
        
        let taskProgress = { completed: 0, total: 0 };
        if (currentStage) {
            taskProgress = currentStage.getProgress();
        }

        return {
            stage: {
                current: this.currentStageIndex + 1,
                total: totalStages
            },
            tasks: taskProgress,
            completed: this.completed,
            failed: this.failed
        };
    }

    /**
     * Сериализовать квест
     * @returns {object}
     */
    serialize() {
        return {
            id: this.id,
            title: this.title,
            description: this.description,
            stages: this.stages.map(s => s.serialize()),
            currentStageIndex: this.currentStageIndex,
            completed: this.completed,
            failed: this.failed,
            rewards: this.rewards
        };
    }

    /**
     * Десериализовать квест
     * @param {object} jsonData 
     * @param {TaskFactory} taskFactory 
     */
    deserialize(jsonData, taskFactory) {
        this.id = jsonData.id;
        this.title = jsonData.title || '';
        this.description = jsonData.description || '';
        this.currentStageIndex = jsonData.currentStageIndex || 0;
        this.completed = jsonData.completed || false;
        this.failed = jsonData.failed || false;
        this.rewards = jsonData.rewards || { gold: 0, experience: 0, reputation: [], items: [] };

        this.stages = [];
        if (jsonData.stages && Array.isArray(jsonData.stages)) {
            for (const stageData of jsonData.stages) {
                const stage = new QuestStage(stageData.id, stageData.title);
                stage.deserialize(stageData, taskFactory);
                this.stages.push(stage);
            }
        }
    }

    /**
     * Получить описание квеста для журнала
     * @returns {object}
     */
    getJournalEntry() {
        const currentStage = this.getCurrentStage();
        const tasks = currentStage ? currentStage.getDescription() : [];

        return {
            id: this.id,
            title: this.title,
            description: this.description,
            tasks: tasks,
            progress: this.getProgress(),
            completed: this.completed,
            failed: this.failed
        };
    }

    /**
     * Проверить, активен ли квест
     * @returns {boolean}
     */
    isActive() {
        return !this.completed && !this.failed;
    }

    /**
     * Установить награды
     * @param {object} rewards 
     */
    setRewards(rewards) {
        this.rewards = { ...this.rewards, ...rewards };
    }
}

export default Quest;
