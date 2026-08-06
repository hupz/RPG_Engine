/**
 * Задача: Убить врага
 */
import QuestTask from '../QuestTask.js';

class KillEnemyTask extends QuestTask {
    constructor(data = {}) {
        super('KillEnemy', data);
        this.progress = data.progress || 0;
    }

    getDescription() {
        const enemyName = this.data.enemyName || 'враг';
        const target = this.data.target || 1;
        return `Победить ${enemyName}: ${this.progress} / ${target}`;
    }

    handleEvent(event) {
        if (event.type === 'EnemyKilled') {
            const { enemyId, enemyType } = event.getData();
            
            // Проверка нужного ли врага
            if (this.data.enemyId && enemyId !== this.data.enemyId) {
                return false;
            }
            
            // Или проверка типа врага
            if (this.data.enemyType && enemyType !== this.data.enemyType) {
                return false;
            }
            
            const currentProgress = this.getProgress();
            this.updateProgress(currentProgress + 1);
            return true;
        }
        return false;
    }
}

export default KillEnemyTask;
