/**
 * Базовый класс для всех задач квеста
 */
class QuestTask {
    constructor(type, config = {}) {
        this.type = type;
        this.id = config.id || crypto.randomUUID();
        this.description = config.description || '';
        this.completed = false;
        this.progress = 0;
        this.target = config.target !== undefined ? config.target : 1;
        this.config = config;
    }

    /**
     * Получить текущий прогресс задачи
     * @returns {number}
     */
    getProgress() {
        return this.progress;
    }

    /**
     * Проверить, выполнена ли задача
     * @returns {boolean}
     */
    isCompleted() {
        return this.completed;
    }

    /**
     * Сбросить задачу
     */
    reset() {
        this.completed = false;
        this.progress = 0;
    }

    /**
     * Сериализация задачи в JSON
     * @returns {object}
     */
    serialize() {
        return {
            type: this.type,
            id: this.id,
            description: this.description,
            completed: this.completed,
            progress: this.progress,
            target: this.target,
            config: this.config
        };
    }

    /**
     * Десериализация задачи из JSON
     * @param {object} data 
     */
    deserialize(data) {
        this.id = data.id || this.id;
        this.description = data.description || this.description;
        this.completed = data.completed || false;
        this.progress = data.progress || 0;
        this.target = data.target !== undefined ? data.target : 1;
        this.config = data.config || this.config;
    }

    /**
     * Получить описание задачи для отображения
     * @returns {string}
     */
    getDescription() {
        return this.description;
    }

    /**
     * Обработать событие
     * @param {QuestEvent} event 
     * @returns {boolean} - было ли обновлено состояние
     */
    handleEvent(event) {
        return false;
    }

    /**
     * Обновить прогресс задачи
     * @param {number} value 
     */
    updateProgress(value) {
        this.progress = Math.min(value, this.target);
        if (this.progress >= this.target) {
            this.completed = true;
        }
    }
}

export default QuestTask;
