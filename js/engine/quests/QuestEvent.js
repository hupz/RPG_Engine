/**
 * Класс события квеста
 */
class QuestEvent {
    constructor(type, payload = {}) {
        this.type = type;
        this.payload = payload;
        this.timestamp = Date.now();
    }

    /**
     * Получить данные события
     * @returns {object}
     */
    getData() {
        return this.payload;
    }

    /**
     * Получить тип события
     * @returns {string}
     */
    getType() {
        return this.type;
    }
}

export default QuestEvent;
