/**
 * Этап квеста - содержит набор задач
 * Автоматически отслеживает выполнение всех задач
 */
import QuestEventBus from './QuestEventBus.js';

class QuestStage {
    constructor(id, title = '', tasks = []) {
        this.id = id;
        this.title = title;
        this.tasks = tasks || [];
        this.completed = false;
        this.eventHandlers = new Map();
    }

    /**
     * Добавить задачу
     * @param {QuestTask} task 
     */
    addTask(task) {
        if (!task) return;
        this.tasks.push(task);
        this.subscribeToEvents(task);
    }

    /**
     * Удалить задачу
     * @param {string} taskId 
     */
    removeTask(taskId) {
        const index = this.tasks.findIndex(t => t.id === taskId);
        if (index !== -1) {
            const task = this.tasks[index];
            this.unsubscribeFromEvents(task);
            this.tasks.splice(index, 1);
        }
    }

    /**
     * Подписаться на события для задачи
     * @param {QuestTask} task 
     */
    subscribeToEvents(task) {
        // Задача будет обрабатывать события через handleEvent
        // Подписка происходит на уровне QuestManager
    }

    /**
     * Отписаться от событий
     * @param {QuestTask} task 
     */
    unsubscribeFromEvents(task) {
        // Очистка подписок
    }

    /**
     * Обработать событие
     * @param {QuestEvent} event 
     * @returns {boolean} - изменилось ли состояние
     */
    handleEvent(event) {
        let stateChanged = false;
        
        for (const task of this.tasks) {
            if (!task.isCompleted()) {
                const changed = task.handleEvent(event);
                if (changed) {
                    stateChanged = true;
                }
            }
        }
        
        // Проверка завершения этапа
        this.checkCompletion();
        
        return stateChanged;
    }

    /**
     * Проверить завершение всех задач этапа
     */
    checkCompletion() {
        if (this.tasks.length === 0) {
            this.completed = true;
            return;
        }
        
        this.completed = this.tasks.every(task => task.isCompleted());
    }

    /**
     * Получить прогресс этапа
     * @returns {object} { completed: number, total: number }
     */
    getProgress() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(t => t.isCompleted()).length;
        return { completed, total };
    }

    /**
     * Сбросить этап
     */
    reset() {
        this.completed = false;
        for (const task of this.tasks) {
            task.reset();
        }
    }

    /**
     * Сериализовать этап
     * @returns {object}
     */
    serialize() {
        return {
            id: this.id,
            title: this.title,
            tasks: this.tasks.map(t => t.serialize()),
            completed: this.completed
        };
    }

    /**
     * Десериализовать этап
     * @param {object} jsonData 
     * @param {TaskFactory} taskFactory 
     */
    deserialize(jsonData, taskFactory) {
        this.id = jsonData.id;
        this.title = jsonData.title || '';
        this.completed = jsonData.completed || false;
        
        this.tasks = [];
        if (jsonData.tasks && Array.isArray(jsonData.tasks)) {
            for (const taskData of jsonData.tasks) {
                const task = taskFactory.fromJSON(taskData);
                if (task) {
                    this.tasks.push(task);
                }
            }
        }
    }

    /**
     * Получить описание этапа для журнала
     * @returns {string[]}
     */
    getDescription() {
        return this.tasks.map(t => t.getDescription());
    }

    /**
     * Проверить, активен ли этап (есть незавершенные задачи)
     * @returns {boolean}
     */
    isActive() {
        return !this.completed && this.tasks.some(t => !t.isCompleted());
    }
}

export default QuestStage;
