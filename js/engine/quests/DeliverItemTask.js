/**
 * Задача: Доставить предмет
 */
import QuestTask from '../QuestTask.js';

class DeliverItemTask extends QuestTask {
    constructor(data = {}) {
        super('DeliverItem', data);
    }

    getDescription() {
        const itemName = this.data.itemName || 'предмет';
        const npcName = this.data.npcName || 'NPC';
        return `Доставить ${itemName} ${npcName}`;
    }

    handleEvent(event) {
        if (event.type === 'ItemDelivered') {
            const { itemId, npcId } = event.getData();
            
            // Проверка предмета
            if (this.data.itemId && itemId !== this.data.itemId) {
                return false;
            }
            
            // Проверка NPC
            if (this.data.npcId && npcId !== this.data.npcId) {
                return false;
            }
            
            this.updateProgress(1);
            return true;
        }
        return false;
    }
}

export default DeliverItemTask;
