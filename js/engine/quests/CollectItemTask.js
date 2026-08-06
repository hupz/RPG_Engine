/**
 * Задача: Собрать предметы
 */
import QuestTask from '../QuestTask.js';

class CollectItemTask extends QuestTask {
    constructor(data = {}) {
        super('CollectItem', data);
        this.progress = data.progress || 0;
    }

    getDescription() {
        const itemName = this.data.itemName || 'предмет';
        const target = this.data.target || 1;
        return `Собрать ${itemName}: ${this.progress} / ${target}`;
    }

    handleEvent(event) {
        if (event.type === 'ItemCollected') {
            const { itemId, itemCount } = event.getData();
            
            // Проверка нужного ли предмета
            if (this.data.itemId && itemId !== this.data.itemId) {
                return false;
            }
            
            const currentProgress = this.getProgress();
            const addedCount = itemCount || 1;
            this.updateProgress(currentProgress + addedCount);
            return true;
        }
        return false;
    }
}

export default CollectItemTask;
