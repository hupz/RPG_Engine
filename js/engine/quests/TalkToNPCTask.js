/**
 * Задача: Поговорить с NPC
 */
import QuestTask from '../QuestTask.js';

class TalkToNPCTask extends QuestTask {
    constructor(data = {}) {
        super('TalkToNPC', data);
    }

    getDescription() {
        const npcName = this.data.npcName || 'NPC';
        return `Поговорить с ${npcName}`;
    }

    handleEvent(event) {
        if (event.type === 'NPCDialogueFinished') {
            const { npcId, optionId } = event.getData();
            
            // Проверка нужного ли NPC
            if (this.data.npcId && npcId !== this.data.npcId) {
                return false;
            }
            
            // Если требуется конкретный вариант ответа
            if (this.data.optionId && optionId !== this.data.optionId) {
                return false;
            }
            
            this.updateProgress(1);
            return true;
        }
        return false;
    }
}

export default TalkToNPCTask;
