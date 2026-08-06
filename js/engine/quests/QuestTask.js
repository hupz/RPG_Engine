/**
 * Базовый класс для всех задач квеста
 * Каждая задача инкапсулирует свою логику выполнения
 */
class QuestTask {
    constructor(type, data = {}) {
        this.type = type;
        this.data = data;
        this.progress = 0;
        this.completed = false;
        this.id = data.id || this.generateId();
    }

    /**
     * Получить текущий прогресс задачи
     * @returns {number} - текущее значение прогресса
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
     * Сбросить прогресс задачи
     */
    reset() {
        this.progress = 0;
        this.completed = false;
    }

    /**
     * Сериализовать задачу в JSON для сохранения
     * @returns {object}
     */
    serialize() {
        return {
            type: this.type,
            id: this.id,
            data: this.data,
            progress: this.progress,
            completed: this.completed
        };
    }

    /**
     * Десериализовать задачу из JSON
     * @param {object} jsonData 
     */
    deserialize(jsonData) {
        this.type = jsonData.type;
        this.id = jsonData.id;
        this.data = jsonData.data || {};
        this.progress = jsonData.progress || 0;
        this.completed = jsonData.completed || false;
    }

    /**
     * Получить описание задачи для отображения в журнале
     * @returns {string}
     */
    getDescription() {
        return `Задача: ${this.type}`;
    }

    /**
     * Обработать событие
     * Должен быть переопределен в наследниках
     * @param {QuestEvent} event 
     * @returns {boolean} - изменилось ли состояние задачи
     */
    handleEvent(event) {
        return false;
    }

    /**
     * Обновить прогресс и проверить завершение
     * @param {number} value 
     */
    updateProgress(value) {
        const target = this.data.target || 1;
        this.progress = Math.min(value, target);
        if (this.progress >= target) {
            this.completed = true;
        }
    }

    /**
     * Генерация уникального ID для задачи
     * @returns {string}
     */
    generateId() {
        return 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}

export default QuestTask;
