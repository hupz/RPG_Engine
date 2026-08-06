/**
 * Класс события квеста
 */
class QuestEvent {
    constructor(type, payload = {}) {
        this.type = type;
        this.payload = payload;
        this.timestamp = Date.now();
    }
}

export default QuestEvent;
