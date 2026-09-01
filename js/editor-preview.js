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
      let out = String(text);
      if (typeof Editor.expandSnippetsInText === 'function') {
        out = Editor.expandSnippetsInText(out, this.data);
      }
      return out
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

    playTest() {
      if (!this.data) return;
      if (typeof this.openEditorTestPreview === 'function') {
        this.openEditorTestPreview({ sceneId: this.currentScene });
        return;
      }
      if (typeof EditorTestKeys !== 'undefined') {
        EditorTestKeys.writeTestData(this.data);
        EditorTestKeys.writeSession({
          mode: 'editor_test',
          sceneId: this.currentScene || null,
          createdAt: Date.now()
        });
        window.open('index.html?editorTest=1', '_blank', 'noopener');
        return;
      }
      console.warn('[playTest] EditorTestKeys missing — refusing to write production cache');
    },

    renderLivePreview() {
      const el = document.getElementById('live-preview-body')
        || document.getElementById('live-preview-container');
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
      if (sceneHasCombat(scene)) {
        const enemies = (Array.isArray(scene.combat) ? scene.combat : [])
          .map((id) => this.data?.enemies?.[id]?.name || id)
          .filter(Boolean);
        meta.push('<span class="live-meta-tag">⚔️ Бой' +
          (enemies.length ? ': ' + this.escapeHtml(enemies.join(', ')) : '') + '</span>');
      }
      if (Array.isArray(scene.items) && scene.items.length) {
        const names = scene.items.map((id) => this.data?.items?.[id]?.name || id);
        meta.push('<span class="live-meta-tag">🎁 ' + this.escapeHtml(names.join(', ')) + '</span>');
      }
      if ((scene.choices || []).some((c) => c?.questSet?.questId)) {
        const qids = [...new Set((scene.choices || []).filter((c) => c?.questSet?.questId).map((c) => c.questSet.questId))];
        const qnames = qids.map((id) => this.data?.quests?.[id]?.title || id);
        meta.push('<span class="live-meta-tag">📜 ' + this.escapeHtml(qnames.join(', ')) + '</span>');
      }
      if (scene.special && String(scene.special).trim()) {
        meta.push(`<span class="live-meta-tag">✨ ${this.escapeHtml(scene.special)}</span>`);
      }

      el.innerHTML = `
        <div class="live-preview-location">👁️ Глазами игрока · 📍 ${loc}</div>
        ${textBlock}
        ${dlgHtml}
        <div class="live-preview-choices">${choicesHtml}</div>
        ${meta.length ? `<div class="live-preview-meta">${meta.join('')}</div>` : ''}`;
    },

    wrapSceneEditorSplitView() {
      const container = document.getElementById('scene-editor');
      if (!container) return;
      // Уже в split — не трогаем (контент рендерится в .scenes-editor-pane)
      if (container.querySelector('.scenes-split-view')) return;

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

      const toolbar = document.createElement('div');
      toolbar.className = 'live-preview-toolbar';
      toolbar.innerHTML = `
        <span class="live-preview-title">👁️ Глазами игрока</span>
        <button type="button" id="editor-play-btn" class="btn btn-info btn-sm"
          onclick="(window.EditorTutorial && EditorTutorial.active ? EditorTutorial.playTest() : Editor.playTest())"
          title="Открыть игру с текущими данными">▶ Play</button>`;
      prevPane.appendChild(toolbar);

      const previewBody = document.createElement('div');
      previewBody.className = 'live-preview-body';
      previewBody.id = 'live-preview-body';
      prevPane.appendChild(previewBody);

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

  function enhanceChoiceEditorHtml(html, args) {
    const idx = args && args[1];
    if (typeof html !== 'string') return html;
    html = html.replace(
      '<div class="choice-card">',
      `<div class="choice-card" draggable="true" data-choice-index="${idx}">`
    );
    html = html.replace(
      '<div class="choice-card-head"><strong>Выбор #',
      `<div class="choice-card-head"><span class="drag-handle" title="Перетащить">⠿</span><strong>Выбор #`
    );
    return html;
  }
  if (Editor.hooks?.after) {
    Editor.hooks.after('renderChoiceEditor', function (result, args) {
      return enhanceChoiceEditorHtml(result, args);
    });
  } else if (typeof console !== 'undefined' && console.warn) {
    console.warn('[editor-preview] Editor.hooks missing — renderChoiceEditor enhance skipped');
  }

  function enhanceSceneListColors() {
    if (!Editor.data?.scenes) return;
    document.querySelectorAll('.scene-item').forEach(el => {
      const idEl = el.querySelector('.scene-id');
      if (!idEl) return;
      const sid = idEl.textContent.trim();
      const scene = Editor.data.scenes[sid];
      if (!scene) return;
      const colorClass = Editor.getSceneColorClass(scene);
      el.classList.remove(
        'scene-color-combat', 'scene-color-special', 'scene-color-quest',
        'scene-color-dialogue', 'scene-color-deadend'
      );
      el.classList.add(colorClass);
    });
  }
  function enhanceSceneEditorPreview() {
    const container = document.getElementById('scene-editor');
    if (!container) return;
    if (!Editor.currentScene || !Editor.data?.scenes?.[Editor.currentScene]) {
      Editor.scheduleLivePreviewUpdate?.();
      return;
    }
    Editor.wrapSceneEditorSplitView?.();
    Editor._choiceDragBound = false;
    Editor.bindChoiceDragDrop?.();
    Editor.renderLivePreview?.();
  }
  if (Editor.hooks?.after) {
    Editor.hooks.after('renderSceneList', function () { enhanceSceneListColors(); });
    Editor.hooks.after('renderSceneEditor', function () { enhanceSceneEditorPreview(); });
  } else if (typeof console !== 'undefined' && console.warn) {
    console.warn('[editor-preview] Editor.hooks missing — scene list/editor enhance skipped');
  }

  function activateScenesTabUi() {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    const scenesTab = document.querySelector('.tab[onclick*="switchTab(\'scenes\'"]')
      || document.querySelector('.tab[onclick*="scenes"]');
    if (scenesTab) scenesTab.classList.add('active');
  }

  function onSelectScenePreview() {
    if (Editor.currentTab === 'dashboard') {
      Editor.currentTab = 'scenes';
      document.getElementById('tab-dashboard')?.classList.remove('active');
      document.getElementById('tab-scenes')?.classList.add('active');
      activateScenesTabUi();
    }
    Editor.scheduleLivePreviewUpdate?.();
  }

  if (Editor.hooks?.before) {
    Editor.hooks.before('selectScene', function (args) {
      if (Editor.currentTab === 'dashboard') {
        Editor.currentTab = 'scenes';
        document.getElementById('tab-dashboard')?.classList.remove('active');
        document.getElementById('tab-scenes')?.classList.add('active');
        activateScenesTabUi();
      }
      return args;
    });
    Editor.hooks.after('selectScene', function () { Editor.scheduleLivePreviewUpdate?.(); });
    Editor.hooks.after('updateJSONPreview', function () {
      Editor.scheduleLivePreviewUpdate?.();
      Editor.refreshDashboardIfVisible?.();
    });
    Editor.hooks.after('switchTab', function (result, args) {
      if (args && args[0] === 'scenes') Editor.scheduleLivePreviewUpdate?.();
    });
    Editor.hooks.after('submitCreateSceneModal', function () {
      if (Editor.data?.scenes) {
        Editor.currentTab = 'scenes';
        document.getElementById('tab-dashboard')?.classList.remove('active');
        document.getElementById('tab-scenes')?.classList.add('active');
        activateScenesTabUi();
        Editor.scheduleLivePreviewUpdate?.();
      }
    });
  } else if (typeof console !== 'undefined' && console.warn) {
    console.warn('[editor-preview] Editor.hooks missing — selectScene/switchTab preview hooks skipped');
  }

})();