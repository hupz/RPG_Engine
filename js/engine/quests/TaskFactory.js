/**
 * Фабрика задач квестов
 * Создает экземпляры задач по типу
 */
import TalkToNPCTask from './tasks/TalkToNPCTask.js';
import CollectItemTask from './tasks/CollectItemTask.js';
import KillEnemyTask from './tasks/KillEnemyTask.js';
import VisitLocationTask from './tasks/VisitLocationTask.js';
import InteractObjectTask from './tasks/InteractObjectTask.js';
import DeliverItemTask from './tasks/DeliverItemTask.js';

class TaskFactory {
    static taskTypes = {
        'TalkToNPC': TalkToNPCTask,
        'CollectItem': CollectItemTask,
        'KillEnemy': KillEnemyTask,
        'VisitLocation': VisitLocationTask,
        'InteractObject': InteractObjectTask,
        'DeliverItem': DeliverItemTask
    };

    /**
     * Зарегистрировать новый тип задачи
     * @param {string} type 
     * @param {class} taskClass 
     */
    static registerTaskType(type, taskClass) {
        this.taskTypes[type] = taskClass;
    }

    /**
     * Создать задачу по типу
     * @param {string} type 
     * @param {object} data 
     * @returns {QuestTask}
     */
    static createTask(type, data = {}) {
        const TaskClass = this.taskTypes[type];
        if (!TaskClass) {
            console.warn(`Unknown task type: ${type}`);
            return null;
        }
        return new TaskClass(data);
    }

    /**
     * Создать задачу из сериализованных данных
     * @param {object} jsonData 
     * @returns {QuestTask}
     */
    static fromJSON(jsonData) {
        const task = this.createTask(jsonData.type, jsonData.data);
        if (task && jsonData.progress !== undefined) {
            task.deserialize(jsonData);
        }
        return task;
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
