import QuestTask from './QuestTask.js';

/**
 * Задача: Поговорить с NPC
 */
class TalkToTask extends QuestTask {
    constructor(config = {}) {
        super('TalkToNPC', config);
        this.npcId = config.npcId || '';
        this.dialogueId = config.dialogueId || null;
        this.description = config.description || `Поговорить с ${config.npcName || 'NPC'}`;
    }

    handleEvent(event) {
        if (event.type === 'NPCDialogueFinished') {
            if (event.payload.npcId === this.npcId) {
                if (!this.dialogueId || event.payload.dialogueId === this.dialogueId) {
                    this.updateProgress(1);
                    return true;
                }
            }
        }
        return false;
    }

    serialize() {
        const data = super.serialize();
        data.npcId = this.npcId;
        data.dialogueId = this.dialogueId;
        return data;
    }

    deserialize(data) {
        super.deserialize(data);
        this.npcId = data.npcId || '';
        this.dialogueId = data.dialogueId || null;
    }

    getDescription() {
        return this.description || `Поговорить с ${this.npcId}`;
    }
}

export default TalkToTask;
