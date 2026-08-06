import QuestTask from './QuestTask.js';

/**
 * Этап квеста, содержащий набор задач
 */
class QuestStage {
    constructor(id, config = {}) {
        this.id = id;
        this.name = config.name || `Этап ${id}`;
        this.description = config.description || '';
        this.tasks = [];
        this.completed = false;
        this.config = config;
    }

    /**
     * Добавить задачу в этап
     * @param {QuestTask} task 
     */
    addTask(task) {
        this.tasks.push(task);
    }

    /**
     * Удалить задачу из этапа
     * @param {string} taskId 
     */
    removeTask(taskId) {
        this.tasks = this.tasks.filter(t => t.id !== taskId);
    }

    /**
     * Проверить, все ли задачи выполнены
     * @returns {boolean}
     */
    isCompleted() {
        if (this.tasks.length === 0) return false;
        return this.tasks.every(task => task.isCompleted());
    }

    /**
     * Получить прогресс этапа
     * @returns {object} { current, total }
     */
    getProgress() {
        const total = this.tasks.length;
        const current = this.tasks.filter(t => t.isCompleted()).length;
        return { current, total };
    }

    /**
     * Обработать событие для всех задач этапа
     * @param {QuestEvent} event 
     * @returns {boolean} - было ли обновлено состояние
     */
    handleEvent(event) {
        let updated = false;
        this.tasks.forEach(task => {
            if (task.handleEvent(event)) {
                updated = true;
            }
        });
        return updated;
    }

    /**
     * Сбросить все задачи этапа
     */
    reset() {
        this.tasks.forEach(task => task.reset());
        this.completed = false;
    }

    /**
     * Сериализация этапа
     * @returns {object}
     */
    serialize() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            completed: this.completed,
            tasks: this.tasks.map(t => t.serialize()),
            config: this.config
        };
    }

    /**
     * Десериализация этапа
     * @param {object} data 
     * @param {TaskFactory} taskFactory 
     */
    deserialize(data, taskFactory) {
        this.id = data.id;
        this.name = data.name || `Этап ${this.id}`;
        this.description = data.description || '';
        this.completed = data.completed || false;
        this.config = data.config || {};
        
        this.tasks = [];
        if (data.tasks && Array.isArray(data.tasks)) {
            data.tasks.forEach(taskData => {
                const task = taskFactory.fromData(taskData);
                if (task) {
                    this.tasks.push(task);
                }
            });
        }
    }

    /**
     * Получить описание всех задач для отображения
     * @returns {string[]}
     */
    getTasksDescriptions() {
        return this.tasks.map(t => t.getDescription());
    }
}

export default QuestStage;
