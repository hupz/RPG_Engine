/**
 * Шина событий для системы квестов
 * Централизованная система обработки событий
 */
class QuestEventBus {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * Подписаться на событие
     * @param {string} eventType - тип события
     * @param {Function} callback - функция обработчика
     * @param {object} context - контекст выполнения (обычно задача)
     */
    subscribe(eventType, callback, context) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, []);
        }
        this.listeners.get(eventType).push({ callback, context });
    }

    /**
     * Отписаться от события
     * @param {string} eventType 
     * @param {Function} callback 
     */
    unsubscribe(eventType, callback) {
        if (!this.listeners.has(eventType)) return;
        
        const eventListeners = this.listeners.get(eventType);
        const index = eventListeners.findIndex(l => l.callback === callback);
        if (index !== -1) {
            eventListeners.splice(index, 1);
        }
    }

    /**
     * Опубликовать событие
     * @param {QuestEvent} event 
     */
    publish(event) {
        if (!this.listeners.has(event.type)) return;
        
        const eventListeners = this.listeners.get(event.type);
        let stateChanged = false;
        
        for (const listener of eventListeners) {
            try {
                const changed = listener.callback.call(listener.context, event);
                if (changed) {
                    stateChanged = true;
                }
            } catch (error) {
                console.error(`Error handling event ${event.type}:`, error);
            }
        }
        
        return stateChanged;
    }

    /**
     * Очистить все подписчики
     */
    clear() {
        this.listeners.clear();
    }

    /**
     * Получить количество подписчиков для типа события
     * @param {string} eventType 
     * @returns {number}
     */
    getListenerCount(eventType) {
        if (!this.listeners.has(eventType)) return 0;
        return this.listeners.get(eventType).length;
    }
}

export default QuestEventBus;
