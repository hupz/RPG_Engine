import QuestEvent from './QuestEvent.js';

/**
 * Шина событий для квестовой системы
 */
class QuestEventBus {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * Подписаться на событие
     * @param {string} eventType 
     * @param {Function} callback 
     */
    subscribe(eventType, callback) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, []);
        }
        this.listeners.get(eventType).push(callback);
    }

    /**
     * Отписаться от события
     * @param {string} eventType 
     * @param {Function} callback 
     */
    unsubscribe(eventType, callback) {
        if (this.listeners.has(eventType)) {
            const callbacks = this.listeners.get(eventType);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * Опубликовать событие
     * @param {QuestEvent} event 
     */
    publish(event) {
        if (this.listeners.has(event.type)) {
            const callbacks = this.listeners.get(event.type);
            callbacks.forEach(callback => {
                try {
                    callback(event);
                } catch (error) {
                    console.error(`Error in event handler for ${event.type}:`, error);
                }
            });
        }
        
        // Также отправляем событие wildcard для общей обработки
        if (this.listeners.has('*')) {
            const callbacks = this.listeners.get('*');
            callbacks.forEach(callback => {
                try {
                    callback(event);
                } catch (error) {
                    console.error(`Error in wildcard event handler:`, error);
                }
            });
        }
    }

    /**
     * Очистить все подписки
     */
    clear() {
        this.listeners.clear();
    }
}

export default QuestEventBus;
