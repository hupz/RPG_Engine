/**
 * Экспорт всех классов новой системы квестов
 */
export { default as QuestTask } from './QuestTask.js';
export { default as QuestStage } from './QuestStage.js';
export { default as Quest } from './Quest.js';
export { default as QuestEvent } from './QuestEvent.js';
export { default as QuestEventBus } from './QuestEventBus.js';
export { default as TaskFactory } from './TaskFactory.js';
export { default as QuestManager, getQuestManager } from './QuestManager.js';

// Задачи
export { default as TalkToNPCTask } from './tasks/TalkToNPCTask.js';
export { default as CollectItemTask } from './tasks/CollectItemTask.js';
export { default as KillEnemyTask } from './tasks/KillEnemyTask.js';
export { default as VisitLocationTask } from './tasks/VisitLocationTask.js';
export { default as InteractObjectTask } from './tasks/InteractObjectTask.js';
export { default as DeliverItemTask } from './tasks/DeliverItemTask.js';
