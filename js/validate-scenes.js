// Валидация сцен проекта (база для редактора)

const ValidateScenes = {
  RESERVED_TARGETS: new Set(['reset']),

  hasSceneSkillCheck(scene) {
    return (scene?.choices || []).some((c) => c?.skillCheck);
  },

  hasSceneCombat(scene) {
    const c = scene?.combat;
    if (!c) return false;
    if (Array.isArray(c)) return c.length > 0;
    if (typeof c === 'object') return Object.keys(c).length > 0;
    return !!c;
  },

  isDeadEndScene(scene) {
    const choices = scene?.choices;
    if (Array.isArray(choices) && choices.length > 0) return false;
    if (this.hasSceneSkillCheck(scene)) return false;
    if (this.hasSceneCombat(scene)) return false;
    if (scene?.nextScene) return false;
    if (scene?.special) return false;
    return true;
  },

  forEachSceneLink(sceneId, scene, callback) {
    const visit = (field, targetId, context) => {
      if (targetId == null || targetId === '') return;
      const id = String(targetId).trim();
      if (!id) return;
      callback(field, id, { sceneId, ...context });
    };

    if (scene?.nextScene) visit('nextScene', scene.nextScene, { where: 'scene' });
    if (scene?.winScene) visit('winScene', scene.winScene, { where: 'scene' });
    if (scene?.lossScene) visit('lossScene', scene.lossScene, { where: 'scene' });
    if (scene?.hubScene) visit('hubScene', scene.hubScene, { where: 'scene' });
    if (scene?.exitScene) visit('exitScene', scene.exitScene, { where: 'scene' });

    (scene?.choices || []).forEach((choice, choiceIndex) => {
      if (choice?.to) visit('to', choice.to, { where: 'choice', choiceIndex });
      if (choice?.nextScene) visit('nextScene', choice.nextScene, { where: 'choice', choiceIndex });
      if (choice?.action) visit('action', choice.action, { where: 'choice', choiceIndex, isAction: true });

      const sc = choice?.skillCheck;
      if (sc?.successNext) visit('successNext', sc.successNext, { where: 'skillCheck', choiceIndex });
      if (sc?.failNext) visit('failNext', sc.failNext, { where: 'skillCheck', choiceIndex });
    });
  },

  isValidSceneTarget(targetId, sceneIds) {
    if (this.RESERVED_TARGETS.has(targetId)) return true;
    return sceneIds.has(targetId);
  },

  /**
   * @returns {Array<object>} issues
   */
  validate(data) {
    const issues = [];
    if (!data?.scenes) return issues;

    const scenes = data.scenes;
    const sceneIds = new Set(Object.keys(scenes));

    const idToKeys = {};
    Object.entries(scenes).forEach(([key, scene]) => {
      const declared = String(scene?.id || key).trim();
      if (!idToKeys[declared]) idToKeys[declared] = [];
      idToKeys[declared].push(key);
      if (scene?.id && scene.id !== key) {
        issues.push({
          id: `scene_id_mismatch:${key}`,
          type: 'scene_id_mismatch',
          severity: 'warning',
          tab: 'scenes',
          sceneId: key,
          message: `Сцена «${key}»: поле id («${scene.id}») не совпадает с ключом`
        });
      }
    });

    Object.entries(idToKeys).forEach(([declaredId, keys]) => {
      if (keys.length > 1) {
        issues.push({
          id: `duplicate_scene_id:${declaredId}`,
          type: 'duplicate_scene_id',
          severity: 'error',
          tab: 'scenes',
          sceneId: keys[0],
          message: `Дублирующийся ID сцены «${declaredId}» (${keys.join(', ')})`
        });
      }
    });

    Object.entries(scenes).forEach(([sceneId, scene]) => {
      this.forEachSceneLink(sceneId, scene, (field, targetId, ctx) => {
        if (ctx.isAction) return;
        if (this.isValidSceneTarget(targetId, sceneIds)) return;

        const where = ctx.where === 'choice'
          ? `, выбор ${ctx.choiceIndex + 1}`
          : ctx.where === 'skillCheck'
            ? `, проверка навыка ${ctx.choiceIndex + 1}`
            : '';

        issues.push({
          id: `missing_scene:${sceneId}:${field}:${targetId}`,
          type: 'missing_scene',
          severity: 'error',
          tab: 'scenes',
          sceneId,
          field,
          targetId,
          choiceIndex: ctx.choiceIndex,
          message: `Сцена «${sceneId}»${where}: сцена «${targetId}» не найдена`
        });
      });

      if (this.isDeadEndScene(scene)) {
        const label = scene?.location || sceneId;
        issues.push({
          id: `dead_end:${sceneId}`,
          type: 'dead_end',
          severity: 'warning',
          tab: 'scenes',
          sceneId,
          message: `«${label}»: сцена тупиковая — нет выхода`
        });
      }
    });

    return issues;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ValidateScenes };
}
