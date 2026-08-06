/**
 * Новая система квестов RPGengine
 * 
 * Архитектура:
 * - QuestManager - центральный менеджер
 * - QuestEventBus - шина событий
 * - Quest - квест с этапами
 * - QuestStage - этап квеста с задачами
 * - QuestTask - базовый класс задачи
 * - TaskFactory - фабрика задач
 * - Конкретные типы задач (TalkTo, CollectItem, KillEnemy, etc.)
 */

export { default as QuestManager } from './tasks/QuestManager.js';
export { default as Quest } from './tasks/Quest.js';
export { default as QuestStage } from './tasks/QuestStage.js';
export { default as QuestTask } from './tasks/QuestTask.js';
export { default as QuestEvent } from './tasks/QuestEvent.js';
export { default as QuestEventBus } from './tasks/QuestEventBus.js';
export { default as TaskFactory } from './tasks/TaskFactory.js';

// Типы задач
export { default as TalkToTask } from './tasks/TalkToTask.js';
export { default as CollectItemTask } from './tasks/CollectItemTask.js';
export { default as KillEnemyTask } from './tasks/KillEnemyTask.js';
export { default as VisitLocationTask } from './tasks/VisitLocationTask.js';
export { default as InteractObjectTask } from './tasks/InteractObjectTask.js';
export { default as DeliverItemTask } from './tasks/DeliverItemTask.js';
