import QuestTask from './QuestTask.js';

/**
 * Фабрика для создания задач по типу
 */
import TalkToTask from './TalkToTask.js';
import CollectItemTask from './CollectItemTask.js';
import KillEnemyTask from './KillEnemyTask.js';
import VisitLocationTask from './VisitLocationTask.js';
import InteractObjectTask from './InteractObjectTask.js';
import DeliverItemTask from './DeliverItemTask.js';

class TaskFactory {
    static taskTypes = {
        'TalkToNPC': TalkToTask,
        'CollectItem': CollectItemTask,
        'KillEnemy': KillEnemyTask,
        'VisitLocation': VisitLocationTask,
        'InteractObject': InteractObjectTask,
        'DeliverItem': DeliverItemTask
    };

    /**
     * Создать задачу по типу
     * @param {string} type - тип задачи
     * @param {object} config - конфигурация
     * @returns {QuestTask}
     */
    static create(type, config = {}) {
        const TaskClass = this.taskTypes[type];
        if (!TaskClass) {
            console.warn(`Unknown task type: ${type}`);
            return null;
        }
        return new TaskClass(config);
    }

    /**
     * Создать задачу из сериализованных данных
     * @param {object} data - сериализованные данные задачи
     * @returns {QuestTask}
     */
    static fromData(data) {
        const task = this.create(data.type, data.config);
        if (task) {
            task.deserialize(data);
        }
        return task;
    }

    /**
     * Зарегистрировать новый тип задачи
     * @param {string} type - тип задачи
     * @param {class} TaskClass - класс задачи
     */
    static registerTaskType(type, TaskClass) {
        this.taskTypes[type] = TaskClass;
    }

    /**
     * Получить все зарегистрированные типы задач
     * @returns {string[]}
     */
    static getRegisteredTypes() {
        return Object.keys(this.taskTypes);
    }
}

export default TaskFactory;
