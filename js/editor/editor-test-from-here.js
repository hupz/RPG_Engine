// ============================================================
// Test From Here — Editor UI: ▶ Проверить
// Writes ephemeral session; does not touch player production save.
// ============================================================
(function attachEditorTestFromHere() {
  'use strict';
  if (typeof Editor === 'undefined') {
    console.warn('editor-test-from-here: Editor missing');
    return;
  }

  const SESSION_KEY = 'melnitsa_editor_test_session';

  Editor.buildTestSession = function buildTestSession(opts) {
    opts = opts || {};
    return {
      mode: 'editor_test',
      createdAt: Date.now(),
      sceneId: opts.sceneId || null,
      questId: opts.questId || null,
      stageIndex: opts.stageIndex != null ? Number(opts.stageIndex) : null,
      npcId: opts.npcId || null,
      dialogueIndex: opts.dialogueIndex != null ? Number(opts.dialogueIndex) : null,
      choiceIndex: opts.choiceIndex != null ? Number(opts.choiceIndex) : null,
      charName: opts.charName || 'Тестер',
      gold: opts.gold != null ? opts.gold : 50,
      inventory: Array.isArray(opts.inventory) ? opts.inventory : [],
      flags: opts.flags || {},
      previewMode: opts.previewMode || null,
      projectTitle: opts.projectTitle || this.data?.meta?.title || this.data?.meta?.name || null
    };
  };

  /**
   * @param {object} opts
   */
  Editor.testFromHere = function testFromHere(opts) {
    if (!this.data) {
      if (Editor.toast) Editor.toast.warning('Нет данных проекта');
      return;
    }
    opts = opts || {};
    // Default scene from editor selection
    if (!opts.sceneId && this.currentScene) opts.sceneId = this.currentScene;

    // For quest stage without scene — try to keep current scene or first scene
    if (!opts.sceneId && this.data.scenes) {
      opts.sceneId = Object.keys(this.data.scenes)[0] || null;
    }

    const session = this.buildTestSession(opts);

      try {
        if (typeof Editor.prepareEditorTestLaunch === 'function') {
          Editor.prepareEditorTestLaunch(session);
        } else {
          const KEYS = typeof EditorTestKeys !== 'undefined' ? EditorTestKeys : null;
          if (KEYS) {
            KEYS.writeTestData(this.data);
            KEYS.writeSession(session);
          } else {
            console.warn('[testFromHere] EditorTestKeys missing — refusing production write');
            return;
          }
        }
      } catch (e) {
      console.error('[testFromHere]', e);
      if (Editor.toast) Editor.toast.error('Не удалось подготовить тест');
      return;
    }

    const url = 'index.html?editorTest=1&t=' + Date.now();
    window.open(url, '_blank', 'noopener');
    if (Editor.toast) Editor.toast.info('Открыт тестовый режим');
  };

  Editor.testCurrentScene = function testCurrentScene() {
    if (!this.currentScene) {
      if (Editor.toast) Editor.toast.warning('Выберите сцену');
      return;
    }
    this.testFromHere({ sceneId: this.currentScene });
  };

  Editor.testQuestStage = function testQuestStage(questId, stageIndex) {
    if (!questId || !this.data?.quests?.[questId]) {
      if (Editor.toast) Editor.toast.warning('Квест не найден');
      return;
    }
    this.testFromHere({
      questId,
      stageIndex: stageIndex != null ? stageIndex : 0,
      sceneId: this.currentScene || Object.keys(this.data.scenes || {})[0]
    });
  };

  Editor.testNpc = function testNpc(npcId) {
    // Prefer a scene that references this NPC
    let sceneId = this.currentScene;
    const scenes = this.data?.scenes || {};
    for (const [sid, sc] of Object.entries(scenes)) {
      if (sc.npcId === npcId || sc.npc === npcId) {
        sceneId = sid;
        break;
      }
    }
    this.testFromHere({ sceneId, npcId });
  };

  Editor.testDialogue = function testDialogue(sceneId, dialogueIndex) {
    this.testFromHere({
      sceneId: sceneId || this.currentScene,
      dialogueIndex: dialogueIndex != null ? dialogueIndex : 0
    });
  };

  Editor.renderTestFromHereButton = function renderTestFromHereButton(label, jsCall) {
    const lab = this.escapeHtml(label || '▶ Проверить');
    const call = this.escapeAttr(jsCall || 'Editor.testCurrentScene()');
    return `<button type="button" class="btn btn-info btn-sm editor-test-from-here" onclick="${call}" title="Тестовый запуск (не портит сохранение игрока)">${lab}</button>`;
  };

  // ——— Inject buttons into existing UI via hooks ———

  function injectQuestStageButtons() {
    if (!Editor.hooks?.after) return;
    Editor.hooks.after('renderQuests', function (result) {
      try {
        document.querySelectorAll('.quest-stage-card').forEach((card) => {
          if (card.querySelector('.editor-test-from-here')) return;
          const qid = card.getAttribute('data-quest-id');
          const si = card.getAttribute('data-stage-index');
          if (qid == null || si == null) return;
          const head = card.querySelector('.quest-stage-head') || card;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn btn-info btn-sm editor-test-from-here';
          btn.textContent = '▶ Проверить с этого этапа';
          btn.title = 'Запуск с этим этапом квеста (TEST MODE)';
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            Editor.testQuestStage(qid, parseInt(si, 10) || 0);
          });
          head.appendChild(btn);
        });
        // Quest-level button
        const detail = document.querySelector('.quest-manager-detail .quest-detail-head, .quest-manager-detail');
        if (detail && !detail.querySelector('.editor-test-quest')) {
          const qid = Editor.editingQuestId;
          if (qid) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-info btn-sm editor-test-from-here editor-test-quest';
            btn.textContent = '▶ Проверить квест';
            btn.addEventListener('click', () => Editor.testQuestStage(qid, 0));
            detail.insertBefore(btn, detail.firstChild);
          }
        }
      } catch (e) {
        console.warn('[testFromHere] quest inject', e);
      }
      return result;
    });
  }

  function injectSceneButton() {
    if (!Editor.hooks?.after) return;
    Editor.hooks.after('renderSceneEditor', function (result) {
      try {
        if (typeof Editor.isPreviewWorkflowActive === 'function' && Editor.isPreviewWorkflowActive()) {
          return result;
        }
        const toolbar = document.querySelector(
          '.scenes-preview-pane .live-preview-toolbar, #live-preview-container .live-preview-toolbar, .scene-editor-toolbar'
        );
        if (toolbar && !toolbar.querySelector('.editor-test-scene')) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn btn-info btn-sm editor-test-from-here editor-test-scene';
          btn.textContent = '▶ Проверить сцену';
          btn.title = 'Запуск с этой сцены (TEST MODE)';
          btn.addEventListener('click', () => Editor.testCurrentScene());
          toolbar.appendChild(btn);
        }
        // Fallback: scene detail header
        const head = document.querySelector('#scene-editor .scene-detail-head, #scene-editor h2');
        if (head && !document.querySelector('.editor-test-scene')) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn btn-info btn-sm editor-test-from-here editor-test-scene';
          btn.textContent = '▶ Проверить сцену';
          btn.addEventListener('click', () => Editor.testCurrentScene());
          head.appendChild(btn);
        }
      } catch (e) {
        console.warn('[testFromHere] scene inject', e);
      }
      return result;
    });
  }

  function injectNpcButton() {
    if (!Editor.hooks?.after) return;
    Editor.hooks.after('renderNPCs', function (result) {
      try {
        const detail = document.querySelector('.npc-editor-detail, #npcs-editor .npc-detail');
        if (!detail || detail.querySelector('.editor-test-npc')) return result;
        const npcId = Editor.editingNpcId;
        if (!npcId) return result;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-info btn-sm editor-test-from-here editor-test-npc';
        btn.textContent = '▶ Проверить';
        btn.addEventListener('click', () => Editor.testNpc(npcId));
        detail.insertBefore(btn, detail.firstChild);
      } catch (e) { /* */ }
      return result;
    });
  }

  function install() {
    injectQuestStageButtons();
    injectSceneButton();
    injectNpcButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
  setTimeout(install, 0);
})();
