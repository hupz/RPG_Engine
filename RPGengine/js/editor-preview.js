// Редактор: цветовая кодировка сцен, живое превью, drag & drop выборов

(function attachEditorPreview() {
  if (typeof Editor === 'undefined') {
    console.error('editor-preview.js: Editor не определён');
    return;
  }

  Editor._livePreviewTimer = null;
  Editor._choiceDragBound = false;

  function sceneHasCombat(scene) {
    const c = scene?.combat;
    if (!c) return false;
    if (Array.isArray(c)) return c.length > 0;
    if (typeof c === 'object') return Object.keys(c).length > 0;
    return !!c;
  }

  function sceneHasQuestOrStates(scene) {
    if (Array.isArray(scene?.states) && scene.states.length > 0) return true;
    return (scene?.choices || []).some(ch =>
      ch?.questSet && (ch.questSet.questId != null || ch.questSet.quest)
    );
  }

  Object.assign(Editor, {
    sceneHasCombat,
    sceneHasQuestOrStates,

    getSceneColorClass(scene) {
      if (!scene || typeof scene !== 'object') return 'scene-color-deadend';
      if (sceneHasCombat(scene)) return 'scene-color-combat';
      if (scene.special && String(scene.special).trim()) return 'scene-color-special';
      if (sceneHasQuestOrStates(scene)) return 'scene-color-quest';
      if (Array.isArray(scene.choices) && scene.choices.length > 0) return 'scene-color-dialogue';
      if (!scene.nextScene || String(scene.nextScene).trim() === '') return 'scene-color-deadend';
      return 'scene-color-dialogue';
    },

    applySceneTemplate(text) {
      if (!text) return '';
      return String(text)
        .replace(/\{charName\}/g, 'Герой')
        .replace(/\{gold\}/g, '0');
    },

    getSceneForLivePreview() {
      if (!this.currentScene || !this.data?.scenes?.[this.currentScene]) return null;
      const scene = { ...this.data.scenes[this.currentScene] };
      const locEl = document.getElementById('scene-location');
      const textEl = document.getElementById('scene-text');
      if (locEl) scene.location = locEl.value;
      if (textEl) scene.text = textEl.value;
      return scene;
    },

    scheduleLivePreviewUpdate() {
      clearTimeout(this._livePreviewTimer);
      this._livePreviewTimer = setTimeout(() => this.renderLivePreview(), 300);
    },

    updateLiveScenePreview() {
      this.scheduleLivePreviewUpdate();
    },

    renderLivePreview() {
      const el = document.getElementById('live-preview-container');
      if (!el) return;

      if (!this.currentScene || !this.data?.scenes?.[this.currentScene]) {
        el.innerHTML = '<p class="hint">Выберите сцену в списке слева.</p>';
        return;
      }

      const scene = this.getSceneForLivePreview();
      const loc = this.escapeHtml(scene.location || '—');
      const rawText = this.applySceneTemplate(scene.text || '').trim();
      const textBlock = rawText
        ? `<div class="live-scene-text">${this.escapeHtml(rawText).replace(/\n/g, '<br>')}</div>`
        : '<p class="hint">(нет текста)</p>';

      const dialogue = (scene.dialogue || []).filter(d => d && (d.text || d.speaker));
      const dlgHtml = dialogue.map(d => {
        const speaker = this.escapeHtml(d.speaker || '???');
        const line = this.escapeHtml(this.applySceneTemplate(d.text || ''));
        return `<div class="dialogue-block"><strong>${speaker}:</strong> ${line}</div>`;
      }).join('');

      const ctx = typeof this.getPreviewContext === 'function'
        ? this.getPreviewContext()
        : { flags: {}, inventory: [], gold: 0, className: '', questStages: {}, quests: this.data?.quests || {} };

      const choicesHtml = (scene.choices || []).map((c) => {
        const visible = typeof ConditionSystem !== 'undefined'
          ? ConditionSystem.isChoiceVisible(c, ctx)
          : true;
        const icon = c.icon ? `${this.renderIcon(c.icon)} ` : '';
        const label = this.escapeHtml(c.text || '(без текста)');
        const cls = visible ? 'choice' : 'choice choice-disabled';
        const title = visible ? '' : ' title="Скрыт по условию"';
        return `<button type="button" class="${cls}" disabled${title}>${icon}${label}</button>`;
      }).join('') || '<p class="hint">Нет выборов</p>';

      const meta = [];
      if (sceneHasCombat(scene)) meta.push('<span class="live-meta-tag">⚔️ Бой</span>');
      if (scene.special && String(scene.special).trim()) {
        meta.push(`<span class="live-meta-tag">✨ ${this.escapeHtml(scene.special)}</span>`);
      }

      el.innerHTML = `
        <div class="live-preview-location">📍 ${loc}</div>
        ${textBlock}
        ${dlgHtml}
        <div class="live-preview-choices">${choicesHtml}</div>
        ${meta.length ? `<div class="live-preview-meta">${meta.join('')}</div>` : ''}`;
    },

    wrapSceneEditorSplitView() {
      const container = document.getElementById('scene-editor');
      if (!container || container.querySelector('.scenes-split-view')) return;

      const split = document.createElement('div');
      split.className = 'scenes-split-view';
      const edPane = document.createElement('div');
      edPane.className = 'scenes-editor-pane';
      while (container.firstChild) {
        edPane.appendChild(container.firstChild);
      }
      const prevPane = document.createElement('div');
      prevPane.className = 'scenes-preview-pane';
      prevPane.id = 'live-preview-container';
      split.appendChild(edPane);
      split.appendChild(prevPane);
      container.appendChild(split);
    },

    bindChoiceDragDrop() {
      const list = document.getElementById('choices-list');
      if (!list || this._choiceDragBound) return;
      this._choiceDragBound = true;

      list.addEventListener('dragstart', (e) => this._onChoiceDragStart(e));
      list.addEventListener('dragover', (e) => this._onChoiceDragOver(e));
      list.addEventListener('dragleave', (e) => this._onChoiceDragLeave(e));
      list.addEventListener('drop', (e) => this._onChoiceDrop(e));
      list.addEventListener('dragend', (e) => this._onChoiceDragEnd(e));
    },

    _onChoiceDragStart(e) {
      const card = e.target.closest('.choice-card');
      if (!card || !card.dataset.choiceIndex) return;
      e.dataTransfer.setData('text/plain', card.dataset.choiceIndex);
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
    },

    _onChoiceDragOver(e) {
      const card = e.target.closest('.choice-card');
      if (!card) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('.choice-card.drag-over').forEach(el => el.classList.remove('drag-over'));
      card.classList.add('drag-over');
    },

    _onChoiceDragLeave(e) {
      const card = e.target.closest('.choice-card');
      if (card) card.classList.remove('drag-over');
    },

    _onChoiceDrop(e) {
      e.preventDefault();
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
      const toCard = e.target.closest('.choice-card');
      if (!toCard || Number.isNaN(fromIdx)) return;
      const toIdx = parseInt(toCard.dataset.choiceIndex, 10);
      if (Number.isNaN(toIdx) || fromIdx === toIdx || !this.currentScene) return;

      const scene = this.data.scenes[this.currentScene];
      if (!scene?.choices) return;
      const [moved] = scene.choices.splice(fromIdx, 1);
      scene.choices.splice(toIdx, 0, moved);
      this._choiceDragBound = false;
      this.renderSceneEditor();
      this.updateJSONPreview();
    },

    _onChoiceDragEnd() {
      document.querySelectorAll('.choice-card.dragging, .choice-card.drag-over').forEach(el => {
        el.classList.remove('dragging', 'drag-over');
      });
    }
  });

  if (typeof Editor.renderChoiceEditor === 'function') {
    const origChoiceEditor = Editor.renderChoiceEditor.bind(Editor);
    Editor.renderChoiceEditor = function (c, idx, allScenes) {
      let html = origChoiceEditor(c, idx, allScenes);
      html = html.replace(
        '<div class="choice-card">',
        `<div class="choice-card" draggable="true" data-choice-index="${idx}">`
      );
      html = html.replace(
        '<div class="choice-card-head"><strong>Выбор #',
        `<div class="choice-card-head"><span class="drag-handle" title="Перетащить">⠿</span><strong>Выбор #`
      );
      return html;
    };
  }

  const origRenderSceneList = Editor.renderSceneList.bind(Editor);
  Editor.renderSceneList = function () {
    origRenderSceneList();
    if (!this.data?.scenes) return;
    document.querySelectorAll('.scene-item').forEach(el => {
      const idEl = el.querySelector('.scene-id');
      if (!idEl) return;
      const sid = idEl.textContent.trim();
      const scene = this.data.scenes[sid];
      if (!scene) return;
      const colorClass = this.getSceneColorClass(scene);
      el.classList.remove(
        'scene-color-combat', 'scene-color-special', 'scene-color-quest',
        'scene-color-dialogue', 'scene-color-deadend'
      );
      el.classList.add(colorClass);
    });
  };

  const origRenderSceneEditor = Editor.renderSceneEditor.bind(Editor);
  Editor.renderSceneEditor = function () {
    origRenderSceneEditor();
    const container = document.getElementById('scene-editor');
    if (!container) return;

    if (!this.currentScene || !this.data?.scenes?.[this.currentScene]) {
      this.scheduleLivePreviewUpdate();
      return;
    }

    this.wrapSceneEditorSplitView();
    this._choiceDragBound = false;
    this.bindChoiceDragDrop();
    this.renderLivePreview();
  };

  const origSelectScene = Editor.selectScene.bind(Editor);
  Editor.selectScene = function (id) {
    if (this.currentTab === 'dashboard') {
      this.currentTab = 'scenes';
      document.getElementById('tab-dashboard')?.classList.remove('active');
      document.getElementById('tab-scenes')?.classList.add('active');
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      const scenesTab = document.querySelector('.tab[onclick*="scenes"]');
      if (scenesTab) scenesTab.classList.add('active');
    }
    origSelectScene(id);
    this.scheduleLivePreviewUpdate();
  };

  const origUpdateJSONPreview = Editor.updateJSONPreview.bind(Editor);
  Editor.updateJSONPreview = function () {
    origUpdateJSONPreview();
    this.scheduleLivePreviewUpdate();
    if (typeof this.refreshDashboardIfVisible === 'function') {
      this.refreshDashboardIfVisible();
    }
  };

  const origSwitchTab = Editor.switchTab.bind(Editor);
  Editor.switchTab = function (tab, event) {
    origSwitchTab(tab, event);
    if (tab === 'scenes') this.scheduleLivePreviewUpdate();
  };

  function activateScenesTabUi() {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    const scenesTab = document.querySelector('.tab[onclick*="switchTab(\'scenes\'"]')
      || document.querySelector('.tab[onclick*="scenes"]');
    if (scenesTab) scenesTab.classList.add('active');
  }

  if (typeof Editor.submitCreateSceneModal === 'function') {
    const origSubmit = Editor.submitCreateSceneModal.bind(Editor);
    Editor.submitCreateSceneModal = function () {
      origSubmit();
      if (Editor.data?.scenes) {
        Editor.currentTab = 'scenes';
        document.getElementById('tab-dashboard')?.classList.remove('active');
        document.getElementById('tab-scenes')?.classList.add('active');
        activateScenesTabUi();
        Editor.scheduleLivePreviewUpdate();
      }
    };
  }

})();
