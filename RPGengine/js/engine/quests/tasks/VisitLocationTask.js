import QuestTask from './QuestTask.js';

/**
 * Задача: Посетить локацию
 */
class VisitLocationTask extends QuestTask {
    constructor(config = {}) {
        super('VisitLocation', config);
        this.locationId = config.locationId || '';
        this.locationName = config.locationName || '';
        this.description = config.description || `Посетить ${this.locationName || this.locationId}`;
        this.target = 1;
        this.progress = 0;
    }

    handleEvent(event) {
        if (event.type === 'LocationVisited') {
            if (event.payload.locationId === this.locationId) {
                this.updateProgress(1);
                return true;
            }
        }
        return false;
    }

    serialize() {
        const data = super.serialize();
        data.locationId = this.locationId;
        data.locationName = this.locationName;
        return data;
    }

    deserialize(data) {
        super.deserialize(data);
        this.locationId = data.locationId || '';
        this.locationName = data.locationName || '';
    }

    getDescription() {
        const name = this.locationName || this.locationId;
        return this.completed ? `Посетить ${name} ✓` : `Посетить ${name}`;
    }
}

export default VisitLocationTask;
