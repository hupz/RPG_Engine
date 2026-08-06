/**
 * Задача: Посетить локацию
 */
import QuestTask from '../QuestTask.js';

class VisitLocationTask extends QuestTask {
    constructor(data = {}) {
        super('VisitLocation', data);
    }

    getDescription() {
        const locationName = this.data.locationName || 'локацию';
        return `Посетить ${locationName}`;
    }

    handleEvent(event) {
        if (event.type === 'LocationVisited') {
            const { locationId, locationName } = event.getData();
            
            // Проверка нужной ли локации
            if (this.data.locationId && locationId !== this.data.locationId) {
                return false;
            }
            
            // Или проверка по имени
            if (this.data.locationName && locationName !== this.data.locationName) {
                return false;
            }
            
            this.updateProgress(1);
            return true;
        }
        return false;
    }
}

export default VisitLocationTask;
