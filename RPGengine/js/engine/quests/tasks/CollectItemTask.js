import QuestTask from './QuestTask.js';

/**
 * Задача: Собрать предметы
 */
class CollectItemTask extends QuestTask {
    constructor(config = {}) {
        super('CollectItem', config);
        this.itemId = config.itemId || '';
        this.itemName = config.itemName || '';
        this.target = config.target || 1;
        this.description = config.description || `Собрать ${this.target} x ${this.itemName || this.itemId}`;
        this.progress = 0;
    }

    handleEvent(event) {
        if (event.type === 'ItemCollected') {
            if (event.payload.itemId === this.itemId) {
                const newProgress = this.progress + event.payload.quantity;
                this.updateProgress(newProgress);
                return true;
            }
        }
        return false;
    }

    serialize() {
        const data = super.serialize();
        data.itemId = this.itemId;
        data.itemName = this.itemName;
        return data;
    }

    deserialize(data) {
        super.deserialize(data);
        this.itemId = data.itemId || '';
        this.itemName = data.itemName || '';
    }

    getDescription() {
        const current = this.getProgress();
        const name = this.itemName || this.itemId;
        return `${name}: ${current} / ${this.target}`;
    }
}

export default CollectItemTask;
