import QuestTask from './QuestTask.js';

/**
 * Задача: Взаимодействовать с объектом
 */
class InteractObjectTask extends QuestTask {
    constructor(config = {}) {
        super('InteractObject', config);
        this.objectId = config.objectId || '';
        this.objectName = config.objectName || '';
        this.interactionType = config.interactionType || 'use';
        this.description = config.description || `Взаимодействовать с ${this.objectName || this.objectId}`;
        this.target = 1;
        this.progress = 0;
    }

    handleEvent(event) {
        if (event.type === 'ObjectInteracted') {
            if (event.payload.objectId === this.objectId) {
                if (!this.interactionType || event.payload.interactionType === this.interactionType) {
                    this.updateProgress(1);
                    return true;
                }
            }
        }
        return false;
    }

    serialize() {
        const data = super.serialize();
        data.objectId = this.objectId;
        data.objectName = this.objectName;
        data.interactionType = this.interactionType;
        return data;
    }

    deserialize(data) {
        super.deserialize(data);
        this.objectId = data.objectId || '';
        this.objectName = data.objectName || '';
        this.interactionType = data.interactionType || 'use';
    }

    getDescription() {
        const name = this.objectName || this.objectId;
        return this.completed ? `Взаимодействовать с ${name} ✓` : `Взаимодействовать с ${name}`;
    }
}

export default InteractObjectTask;
