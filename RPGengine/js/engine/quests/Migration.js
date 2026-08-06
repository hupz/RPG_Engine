/**
 * Миграция старой системы квестов в новую
 * Преобразует формат QuestSystem (стадии, флаги) в новую систему задач
 */

import Quest from './tasks/Quest.js';
import QuestStage from './tasks/QuestStage.js';
import TaskFactory from './tasks/TaskFactory.js';

class Migration {
    /**
     * Мигрировать все квесты из старого формата в новый
     * @param {object} oldData - данные из data.quests в старом формате
     * @returns {Map<string, Quest>} - карта квестов в новом формате
     */
    static migrateAll(oldData) {
        const quests = new Map();
        
        if (!oldData || typeof oldData !== 'object') {
            return quests;
        }
        
        for (const [questId, questData] of Object.entries(oldData)) {
            const quest = this.migrateQuest(questId, questData);
            if (quest) {
                quests.set(questId, quest);
            }
        }
        
        console.log(`[Migration] Мигрировано ${quests.size} квестов`);
        return quests;
    }
    
    /**
     * Мигрировать один квест из старого формата в новый
     * @param {string} questId - ID квеста
     * @param {object} questData - данные квеста в старом формате
     * @returns {Quest|null}
     */
    static migrateQuest(questId, questData) {
        if (!questData) return null;
        
        // Создаём новый квест
        const quest = new Quest(questId, {
            name: questData.title || questId,
            description: questData.description || '',
            rewards: questData.rewards || {},
            hidden: !!questData.hidden
        });
        
        // Получаем ключи стадий
        const stageKeys = this.getStageKeys(questData);
        
        if (stageKeys.length === 0) {
            // Если нет стадий, создаём одну пустую
            const stage = new QuestStage(0, {
                name: 'Начало',
                description: questData.description || ''
            });
            quest.addStage(stage);
            return quest;
        }
        
        // Мигрируем каждую стадию
        stageKeys.forEach((key, index) => {
            const stageData = questData.stages[key];
            const stage = this.migrateStage(index, key, stageData, questId, questData);
            quest.addStage(stage);
            
            // Если стадия завершённая в старом формате, помечаем как выполненную
            if (stageData.finish && !stageData.failed) {
                stage.completed = true;
            }
        });
        
        // Если квест был завершён в старом формате
        if (questData.isFinished) {
            quest.completed = true;
            quest.currentStageIndex = quest.stages.length;
        }
        
        // Если квест был провален
        const hasFailedStage = stageKeys.some(k => questData.stages[k]?.failed);
        if (hasFailedStage) {
            quest.failed = true;
        }
        
        return quest;
    }
    
    /**
     * Мигрировать стадию квеста
     * @param {number} newIndex - новый индекс стадии (0, 1, 2...)
     * @param {string} oldKey - старый ключ стадии
     * @param {object} stageData - данные стадии
     * @param {string} questId - ID квеста
     * @param {object} questData - данные всего квеста для контекста
     * @returns {QuestStage}
     */
    static migrateStage(newIndex, oldKey, stageData, questId, questData) {
        const stage = new QuestStage(newIndex, {
            name: stageData.hint || `Этап ${newIndex}`,
            description: stageData.log || ''
        });
        
        // Пытаемся создать задачу на основе содержимого стадии и контекста квеста
        const task = this.inferTaskFromStage(oldKey, stageData, questId, questData);
        if (task) {
            stage.addTask(task);
        }
        
        return stage;
    }
    
    /**
     * Сделать вывод о типе задачи на основе данных стадии
     * Использует эвристику по тексту hint/log и legacyStageMap
     * @param {string} stageKey 
     * @param {object} stageData 
     * @param {string} questId
     * @param {object} questData
     * @returns {QuestTask|null}
     */
    static inferTaskFromStage(stageKey, stageData, questId, questData) {
        const hint = (stageData.hint || '').toLowerCase();
        const log = (stageData.log || '').toLowerCase();
        const text = `${hint} ${log}`;
        
        // Получаем legacy ID для этой стадии
        const legacyId = this.findLegacyId(stageKey, questData?.legacyStageMap);
        
        // Эвристика для определения типа задачи по тексту
        if (text.includes('поговор') || text.includes('talk') || text.includes('спрос') || text.includes('диалог')) {
            return TaskFactory.create('TalkToNPC', {
                description: stageData.hint || stageData.log || `Поговорить с NPC`,
                npcId: this.extractNpcId(text, questId)
            });
        }
        
        if (text.includes('собрат') || text.includes('найт') || text.includes('collect') || text.includes('find item') || text.includes('возьм')) {
            const count = this.extractNumber(text) || 1;
            return TaskFactory.create('CollectItem', {
                description: stageData.hint || stageData.log || `Собрать предметы`,
                target: count,
                itemId: this.extractItemId(text),
                itemName: 'Предмет'
            });
        }
        
        if (text.includes('уб') || text.includes('kill') || text.includes('побед') || text.includes('сраз')) {
            const count = this.extractNumber(text) || 1;
            return TaskFactory.create('KillEnemy', {
                description: stageData.hint || stageData.log || `Победить врагов`,
                target: count,
                enemyId: this.extractEnemyId(text),
                enemyName: 'Враг'
            });
        }
        
        if (text.includes('посет') || text.includes('go to') || text.includes('reach') || text.includes('arrive') || text.includes('отправ')) {
            return TaskFactory.create('VisitLocation', {
                description: stageData.hint || stageData.log || `Посетить локацию`,
                locationId: this.extractLocationId(text, questId),
                locationName: 'Локация'
            });
        }
        
        if (text.includes('отнес') || text.includes('deliver') || text.includes('give') || text.includes('верн') || text.includes('return')) {
            return TaskFactory.create('DeliverItem', {
                description: stageData.hint || stageData.log || `Доставить предмет`,
                itemId: this.extractItemId(text),
                itemName: 'Предмет',
                targetNpcId: this.extractNpcId(text, questId),
                targetNpcName: 'NPC'
            });
        }
        
        if (text.includes('осмотр') || text.includes('inspect') || text.includes('investigat') || text.includes('най')) {
            return TaskFactory.create('InteractObject', {
                description: stageData.hint || stageData.log || `Найти улики`,
                objectId: `search_${questId}_${stageKey}`,
                objectName: 'Объект поиска'
            });
        }
        
        // По умолчанию создаём задачу взаимодействия
        return TaskFactory.create('InteractObject', {
            description: stageData.hint || stageData.log || `Выполнить задание`,
            objectId: `stage_${questId}_${stageKey}`,
            objectName: 'Объект'
        });
    }
    
    /**
     * Найти legacy ID для стадии
     * @param {string} stageKey 
     * @param {object} legacyStageMap 
     * @returns {string|null}
     */
    static findLegacyId(stageKey, legacyStageMap) {
        if (!legacyStageMap) return null;
        for (const [legacyId, key] of Object.entries(legacyStageMap)) {
            if (key === stageKey) return legacyId;
        }
        return null;
    }
    
    /**
     * Получить ключи стадий из старого формата
     * @param {object} questData 
     * @returns {string[]}
     */
    static getStageKeys(questData) {
        if (!questData?.stages) return [];
        
        if (Array.isArray(questData.stages)) {
            return questData.stages.map((_, i) => String(i));
        }
        
        if (typeof questData.stages === 'object') {
            return Object.keys(questData.stages).sort((a, b) => Number(a) - Number(b));
        }
        
        return [];
    }
    
    /**
     * Извлечь число из текста
     * @param {string} text 
     * @returns {number|null}
     */
    static extractNumber(text) {
        const match = text.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : null;
    }
    
    /**
     * Извлечь ID NPC из текста (эвристика)
     * @param {string} text 
     * @param {string} questId
     * @returns {string}
     */
    static extractNpcId(text, questId) {
        // Попытка найти упоминание NPC
        const match = text.match(/с\s+([а-яa-z_]+)/i);
        if (match) return match[1];
        
        // Используем giver из квеста если есть
        return '';
    }
    
    /**
     * Извлечь ID предмета из текста (эвристика)
     * @param {string} text 
     * @returns {string}
     */
    static extractItemId(text) {
        const match = text.match(/([а-яa-z_]+(?:я|ов|ы)?)/i);
        return match ? match[1] : '';
    }
    
    /**
     * Извлечь ID врага из текста (эвристика)
     * @param {string} text 
     * @returns {string}
     */
    static extractEnemyId(text) {
        const match = text.match(/(?:убить|победить|kill)\s+([а-яa-z_]+)/i);
        return match ? match[1] : '';
    }
    
    /**
     * Извлечь ID локации из текста (эвристика)
     * @param {string} text 
     * @param {string} questId
     * @returns {string}
     */
    static extractLocationId(text, questId) {
        const match = text.match(/(?:посетить|go to|reach|отправиться)\s+([а-яa-z_]+)/i);
        if (match) return match[1];
        
        // Пытаемся извлечь из названия квеста
        if (questId.includes('_')) {
            const parts = questId.split('_');
            return parts[parts.length - 1];
        }
        
        return '';
    }
}

export default Migration;
