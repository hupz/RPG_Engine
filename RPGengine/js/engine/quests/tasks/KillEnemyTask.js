import QuestTask from './QuestTask.js';

/**
 * Задача: Убить врагов
 */
class KillEnemyTask extends QuestTask {
    constructor(config = {}) {
        super('KillEnemy', config);
        this.enemyId = config.enemyId || '';
        this.enemyName = config.enemyName || '';
        this.target = config.target || 1;
        this.description = config.description || `Убить ${this.target} x ${this.enemyName || this.enemyId}`;
        this.progress = 0;
    }

    handleEvent(event) {
        if (event.type === 'EnemyKilled') {
            if (!this.enemyId || event.payload.enemyId === this.enemyId) {
                const newProgress = this.progress + (event.payload.quantity || 1);
                this.updateProgress(newProgress);
                return true;
            }
        }
        return false;
    }

    serialize() {
        const data = super.serialize();
        data.enemyId = this.enemyId;
        data.enemyName = this.enemyName;
        return data;
    }

    deserialize(data) {
        super.deserialize(data);
        this.enemyId = data.enemyId || '';
        this.enemyName = data.enemyName || '';
    }

    getDescription() {
        const current = this.getProgress();
        const name = this.enemyName || this.enemyId || 'Враги';
        return `${name}: ${current} / ${this.target}`;
    }
}

export default KillEnemyTask;
