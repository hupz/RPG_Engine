/**
 * Задача: Взаимодействовать с объектом
 */
import QuestTask from '../QuestTask.js';

class InteractObjectTask extends QuestTask {
    constructor(data = {}) {
        super('InteractObject', data);
    }

    getDescription() {
        const objectName = this.data.objectName || 'объект';
        return `Взаимодействовать с ${objectName}`;
    }

    handleEvent(event) {
        if (event.type === 'ObjectInteracted') {
            const { objectId, objectType } = event.getData();
            
            // Проверка нужного ли объекта
            if (this.data.objectId && objectId !== this.data.objectId) {
                return false;
            }
            
            // Или проверка типа объекта
            if (this.data.objectType && objectType !== this.data.objectType) {
                return false;
            }
            
            this.updateProgress(1);
            return true;
        }
        return false;
    }
}

export default InteractObjectTask;
