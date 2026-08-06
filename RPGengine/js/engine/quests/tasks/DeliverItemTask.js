import QuestTask from './QuestTask.js';

/**
 * Задача: Доставить предмет
 */
class DeliverItemTask extends QuestTask {
    constructor(config = {}) {
        super('DeliverItem', config);
        this.itemId = config.itemId || '';
        this.itemName = config.itemName || '';
        this.targetNpcId = config.targetNpcId || '';
        this.targetNpcName = config.targetNpcName || '';
        this.target = config.target || 1;
        this.description = config.description || `Доставить ${this.target} x ${this.itemName || this.itemId} ${this.targetNpcName || this.targetNpcId}`;
        this.progress = 0;
        this.hasDelivered = false;
    }

    handleEvent(event) {
        // Сначала проверяем наличие предмета (собираем)
        if (event.type === 'ItemCollected') {
            if (event.payload.itemId === this.itemId && !this.hasDelivered) {
                const newProgress = this.progress + event.payload.quantity;
                this.updateProgress(newProgress);
                return true;
            }
        }
        
        // Затем проверяем доставку NPC
        if (event.type === 'ItemDelivered') {
            if (event.payload.itemId === this.itemId && 
                event.payload.npcId === this.targetNpcId &&
                this.progress >= this.target) {
                this.hasDelivered = true;
                this.updateProgress(this.target);
                return true;
            }
        }
        
        return false;
    }

    isCompleted() {
        return this.hasDelivered && this.progress >= this.target;
    }

    serialize() {
        const data = super.serialize();
        data.itemId = this.itemId;
        data.itemName = this.itemName;
        data.targetNpcId = this.targetNpcId;
        data.targetNpcName = this.targetNpcName;
        data.hasDelivered = this.hasDelivered;
        return data;
    }

    deserialize(data) {
        super.deserialize(data);
        this.itemId = data.itemId || '';
        this.itemName = data.itemName || '';
        this.targetNpcId = data.targetNpcId || '';
        this.targetNpcName = data.targetNpcName || '';
        this.hasDelivered = data.hasDelivered || false;
    }

    getDescription() {
        const current = this.getProgress();
        const itemName = this.itemName || this.itemId;
        const npcName = this.targetNpcName || this.targetNpcId;
        
        if (this.hasDelivered) {
            return `Доставить ${itemName} (${current}/${this.target}) ${npcName} ✓`;
        }
        return `Доставить ${itemName} (${current}/${this.target}) ${npcName}`;
    }
}

export default DeliverItemTask;
