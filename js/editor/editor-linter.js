// ============================================
// Линтер проекта: проверка ссылок и тупиков
// ============================================

(function attachEditorLinter() {
  if (typeof Editor === 'undefined') {
    console.error('editor-linter.js: Editor не определён');
    return;
  }

  const RESERVED_TARGETS = new Set(['reset']);

  Object.assign(Editor, {
    _lastValidation: null,

    /** Есть ли в сцене хотя бы один skillCheck в choices */
    hasSceneSkillCheck(scene) {
      return (scene?.choices || []).some(c => c?.skillCheck);
    },

    /** Тупик: пустые/нет choices, нет skillCheck, combat, nextScene */
    isDeadEndScene(scene) {
      const choices = scene?.choices;
      if (Array.isArray(choices) && choices.length > 0) return false;
      if (this.hasSceneSkillCheck?.(scene)) return false;
      if (this.hasSceneCombat?.(scene)) return false;
      if (scene?.nextScene) return false;
      return true;
    },

    /** Обход всех ссылок на сцены внутри одной сцены */
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

      (scene?.choices || []).forEach((choice, choiceIndex) => {
        if (choice?.to) visit('to', choice.to, { where: 'choice', choiceIndex });
        if (choice?.nextScene) visit('nextScene', choice.nextScene, { where: 'choice', choiceIndex });
        if (choice?.winScene) visit('winScene', choice.winScene, { where: 'choice', choiceIndex });
        if (choice?.lossScene) visit('lossScene', choice.lossScene, { where: 'choice', choiceIndex });

        const sc = choice?.skillCheck;
        if (sc?.successNext) visit('successNext', sc.successNext, { where: 'skillCheck', choiceIndex });
        if (sc?.failNext) visit('failNext', sc.failNext, { where: 'skillCheck', choiceIndex });
      });
    },

    isValidSceneTarget(targetId, sceneIds) {
      if (RESERVED_TARGETS.has(targetId)) return true;
      return sceneIds.has(targetId);
    },

    /**
     * Проверка проекта: битые ID и тупики.
     * @returns {{ ok: boolean, issues: Array, errors: Array, deadEnds: Array, brokenLinks: Array }}
     */
    validateProject() {
      const issues = [];

      if (!this.data) {
        const empty = { type: 'error', severity: 'error', message: 'Нет данных проекта' };
        const result = { ok: false, issues: [empty], errors: [empty], deadEnds: [], brokenLinks: [] };
        this._lastValidation = result;
        return result;
      }

      const scenes = this.data.scenes || {};
      const sceneIds = new Set(Object.keys(scenes));

      if (!sceneIds.size) {
        const empty = { type: 'error', severity: 'error', message: 'В проекте нет сцен' };
        const result = { ok: false, issues: [empty], errors: [empty], deadEnds: [], brokenLinks: [] };
        this._lastValidation = result;
        return result;
      }

      Object.entries(scenes).forEach(([sceneId, scene]) => {
        this.forEachSceneLink(sceneId, scene, (field, targetId, ctx) => {
          if (this.isValidSceneTarget(targetId, sceneIds)) return;

          const where =
            ctx.where === 'choice'
              ? `, выбор ${ctx.choiceIndex + 1}`
              : ctx.where === 'skillCheck'
                ? `, выбор ${ctx.choiceIndex + 1} (skillCheck)`
                : '';

          issues.push({
            type: 'missing_scene',
            severity: 'error',
            sceneId,
            field,
            targetId,
            fromScene: sceneId,
            message: `Сцена «${sceneId}»${where}: ${field} → «${targetId}» — сцена не найдена`
          });
        });

        if (this.isDeadEndScene(scene)) {
          issues.push({
            type: 'dead_end',
            severity: 'warning',
            sceneId,
            message: `Сцена «${sceneId}»: тупик (Dead End) — нет choices, skillCheck, combat и nextScene`
          });
        }
      });

      const errors = issues.filter(i => i.type === 'missing_scene');
      const deadEnds = issues.filter(i => i.type === 'dead_end');
      const brokenLinks = errors.map(e => ({
        fromScene: e.sceneId,
        field: e.field,
        targetId: e.targetId
      }));

      const result = {
        ok: errors.length === 0,
        issues,
        errors,
        deadEnds,
        brokenLinks
      };

      this._lastValidation = result;
      return result;
    },

    ensureValidationModal() {
      let el = document.getElementById('editor-validation-modal');
      if (el) return el;

      el = document.createElement('div');
      el.id = 'editor-validation-modal';
      el.className = 'editor-validation-modal';
      el.innerHTML = `<div class="editor-validation-backdrop" onclick="Editor.closeValidationModal()"></div>
        <div class="editor-validation-dialog" role="dialog" aria-labelledby="editor-validation-title">
          <div class="editor-validation-header">
            <h2 id="editor-validation-title">Проверка проекта</h2>
            <button type="button" class="editor-validation-close" onclick="Editor.closeValidationModal()" aria-label="Закрыть">×</button>
          </div>
          <div id="editor-validation-body" class="editor-validation-body"></div>
          <div class="editor-validation-footer">
            <button type="button" class="btn btn-secondary" onclick="Editor.closeValidationModal()">Закрыть</button>
          </div>
        </div>`;
      document.body.appendChild(el);
      return el;
    },

    closeValidationModal() {
      const el = document.getElementById('editor-validation-modal');
      if (el) el.classList.remove('open');
    },

    showValidationModal(result) {
      const modal = this.ensureValidationModal();
      const body = document.getElementById('editor-validation-body');
      if (!body) return;

      const errors = result?.errors || [];
      const deadEnds = result?.deadEnds || [];
      const warnings = (result?.issues || []).filter(
        i => i.severity === 'warning' && i.type !== 'dead_end'
      );

      if (!errors.length && !deadEnds.length && !warnings.length) {
        body.innerHTML = `<p class="editor-validation-ok">✅ Ошибок не обнаружено</p>`;
      } else {
        let html = '';
        if (!errors.length) {
          html += `<p class="editor-validation-ok">✅ Ошибок не обнаружено</p>`;
        }

        if (errors.length) {
          html += `<section class="editor-validation-section"><h3>❌ Битые ссылки (${errors.length})</h3><ul class="editor-validation-list">`;
          html += errors.map(e => {
            const jump = `Editor.closeValidationModal();Editor.openSceneFromGraph(${JSON.stringify(e.sceneId)})`;
            return `<li><button type="button" class="editor-validation-link" onclick="${jump}">${this.escapeHtml(e.message)}</button></li>`;
          }).join('');
          html += '</ul></section>';
        }

        if (deadEnds.length) {
          html += `<section class="editor-validation-section"><h3>⚠ Тупики — Dead End (${deadEnds.length})</h3><ul class="editor-validation-list">`;
          html += deadEnds.map(e => {
            const jump = `Editor.closeValidationModal();Editor.openSceneFromGraph(${JSON.stringify(e.sceneId)})`;
            return `<li><button type="button" class="editor-validation-link" onclick="${jump}">${this.escapeHtml(e.message)}</button></li>`;
          }).join('');
          html += '</ul></section>';
        }

        if (warnings.length) {
          html += `<section class="editor-validation-section"><h3>⚠ Замечания (${warnings.length})</h3><ul class="editor-validation-list">`;
          html += warnings.map(e => {
            const jump = e.sceneId
              ? `Editor.closeValidationModal();Editor.openSceneFromGraph(${JSON.stringify(e.sceneId)})`
              : 'Editor.closeValidationModal()';
            return `<li><button type="button" class="editor-validation-link" onclick="${jump}">${this.escapeHtml(e.message)}</button></li>`;
          }).join('');
          html += '</ul></section>';
        }

        body.innerHTML = html;
      }

      modal.classList.add('open');

      if (this.currentTab === 'graph' && typeof this.renderStoryGraph === 'function') {
        this.renderStoryGraph();
      }
    },

    /** Кнопка «Проверить проект» */
    runProjectValidation() {
      const result = this.validateProject();
      this.showValidationModal(result);
      return result;
    }
  });
})();
