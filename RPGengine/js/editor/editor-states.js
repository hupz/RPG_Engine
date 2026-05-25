// Редактор: динамические состояния локаций (scene.states)

(function attachEditorStates() {
  if (typeof Editor === 'undefined') {
    console.error('editor-states.js: Editor не определён');
    return;
  }

  const STATE_OVERRIDE_FIELDS = ['text', 'audio', 'choices', 'location', 'special'];

  Object.assign(Editor, {
    ensureSceneStates(scene) {
      if (!Array.isArray(scene.states)) scene.states = [];
      return scene.states;
    },

    addSceneState() {
      const scene = this.data.scenes[this.currentScene];
      if (!scene) return;
      const states = this.ensureSceneStates(scene);
      states.push({
        id: 'state_' + (states.length + 1),
        condition: { flag: 'new_flag', equals: true },
        text: '',
        choices: []
      });
      this.renderSceneEditor();
      this.updateJSONPreview();
    },

    removeSceneState(idx) {
      const scene = this.data.scenes[this.currentScene];
      if (!scene?.states) return;
      if (!confirm('Удалить состояние #' + (idx + 1) + '?')) return;
      scene.states.splice(idx, 1);
      this.renderSceneEditor();
      this.updateJSONPreview();
    },

    moveSceneState(idx, dir) {
      const scene = this.data.scenes[this.currentScene];
      const states = scene?.states;
      if (!states) return;
      const j = idx + dir;
      if (j < 0 || j >= states.length) return;
      const tmp = states[idx];
      states[idx] = states[j];
      states[j] = tmp;
      this.renderSceneEditor();
      this.updateJSONPreview();
    },

    updateSceneStateField(idx, field, value) {
      const st = this.data.scenes[this.currentScene]?.states?.[idx];
      if (!st) return;
      if (field === 'default') {
        if (value) st.default = true;
        else delete st.default;
      } else if (field === 'id') {
        st.id = value;
      } else if (value === '' || value == null) {
        delete st[field];
      } else {
        st[field] = value;
      }
      this.updateJSONPreview();
      if (field === 'text' || field === 'location' || field === 'special') this.renderSceneEditor();
    },

    toggleSceneStateDefault(idx, checked) {
      const scene = this.data.scenes[this.currentScene];
      if (!scene?.states?.[idx]) return;
      if (checked) {
        scene.states.forEach((s, i) => {
          if (i === idx) s.default = true;
          else delete s.default;
        });
      } else {
        delete scene.states[idx].default;
      }
      this.renderSceneEditor();
      this.updateJSONPreview();
    },

    addSceneStateChoice(stateIdx) {
      const st = this.data.scenes[this.currentScene]?.states?.[stateIdx];
      if (!st) return;
      if (!st.choices) st.choices = [];
      st.choices.push({ text: '', to: '', icon: '➡️' });
      this.renderSceneEditor();
      this.updateJSONPreview();
    },

    updateSceneStateChoice(stateIdx, choiceIdx, field, value) {
      const c = this.data.scenes[this.currentScene]?.states?.[stateIdx]?.choices?.[choiceIdx];
      if (!c) return;
      c[field] = value;
      this.updateJSONPreview();
    },

    removeSceneStateChoice(stateIdx, choiceIdx) {
      const st = this.data.scenes[this.currentScene]?.states?.[stateIdx];
      if (!st?.choices) return;
      st.choices.splice(choiceIdx, 1);
      this.renderSceneEditor();
      this.updateJSONPreview();
    },

    renderSceneStateEditor(st, stateIdx, allScenes, audioIds) {
      const preview = (st.text || '').substring(0, 40);
      const isDefault = st.default === true;
      let html = `<div class="state-card">
        <div class="state-card-head">
          <strong>Состояние #${stateIdx + 1}</strong>
          <span class="hint">${this.escapeHtml(preview || 'без текста')}${isDefault ? ' · default' : ''}</span>
          <div class="state-card-actions">
            <button type="button" class="btn btn-secondary" style="font-size:11px;" onclick="Editor.moveSceneState(${stateIdx},-1)" title="Выше">↑</button>
            <button type="button" class="btn btn-secondary" style="font-size:11px;" onclick="Editor.moveSceneState(${stateIdx},1)" title="Ниже">↓</button>
            <button type="button" class="btn-remove" onclick="Editor.removeSceneState(${stateIdx})">×</button>
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group"><label>ID состояния</label>
            <input value="${this.escapeAttr(st.id || '')}" placeholder="burning_village" onchange="Editor.updateSceneStateField(${stateIdx},'id',this.value)"></div>
          <div class="form-group"><label>
            <input type="checkbox" ${isDefault ? 'checked' : ''} onchange="Editor.toggleSceneStateDefault(${stateIdx},this.checked)"> Fallback (default)
          </label><div class="hint">Если ни одно условие выше не сработало</div></div>
        </div>
        ${typeof this.renderConditionBuilder === 'function'
          ? this.renderConditionBuilder(
              () => this.data.scenes[this.currentScene]?.states?.[stateIdx],
              'condition',
              () => {},
              { title: 'Условие (condition)', builderSuffix: 'state-' + stateIdx }
            )
          : ''}
        <div class="form-group"><label>Текст (override)</label>
          <textarea rows="3" onchange="Editor.updateSceneStateField(${stateIdx},'text',this.value)">${this.escapeTextarea(st.text || '')}</textarea></div>
        <div class="grid-2">
          <div class="form-group"><label>Локация (override)</label>
            <input value="${this.escapeAttr(st.location || '')}" onchange="Editor.updateSceneStateField(${stateIdx},'location',this.value)"></div>
          <div class="form-group"><label>Audio (эмбиент)</label>
            <select onchange="Editor.updateSceneStateField(${stateIdx},'audio',this.value||null)">
              <option value="">— не менять / стоп —</option>
              ${audioIds.map(aid => `<option value="${this.escapeAttr(aid)}" ${st.audio === aid ? 'selected' : ''}>${this.escapeHtml(aid)}</option>`).join('')}
            </select></div>
        </div>
        <div class="form-group"><label>special (override)</label>
          <input value="${this.escapeAttr(st.special || '')}" onchange="Editor.updateSceneStateField(${stateIdx},'special',this.value||undefined)"></div>
        <div class="choices-section"><h4>🔀 Выборы (override)
          <button type="button" class="btn btn-secondary" style="font-size:12px;" onclick="Editor.addSceneStateChoice(${stateIdx})">+</button></h4>
          ${(st.choices || []).map((c, ci) => `<div class="choice-row-mini">
            <input placeholder="Текст" value="${this.escapeAttr(c.text || '')}" onchange="Editor.updateSceneStateChoice(${stateIdx},${ci},'text',this.value)">
            <select onchange="Editor.updateSceneStateChoice(${stateIdx},${ci},'to',this.value)"><option value=""></option>${allScenes.map(s => `<option value="${s}" ${c.to === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
            <button type="button" class="btn-remove" onclick="Editor.removeSceneStateChoice(${stateIdx},${ci})">×</button>
          </div>`).join('') || '<div class="hint">Пусто — останутся базовые выборы сцены</div>'}
        </div>
      </div>`;
      return html;
    },

    renderSceneStatesPanel(scene) {
      const states = scene.states || [];
      const allScenes = Object.keys(this.data.scenes || {});
      const audioIds = Object.keys(this.data?.audio?.catalog || {});

      return `<div class="states-section">
        <h4>🔄 Состояния локации (states)
          <button type="button" class="btn btn-secondary" style="font-size:12px;" onclick="Editor.addSceneState()">+ Добавить</button>
        </h4>
        <div class="hint" style="margin-bottom:10px;">
          Проверка сверху вниз через <code>ConditionSystem</code>. Первое истинное <code>condition</code> перекрывает
          ${STATE_OVERRIDE_FIELDS.map(f => '<code>' + f + '</code>').join(', ')}. Базовые combat/flags/items не меняются.
        </div>
        <div id="states-list">${states.map((st, i) => this.renderSceneStateEditor(st, i, allScenes, audioIds)).join('')}</div>
      </div>`;
    }
  });

  const origRender = Editor.renderSceneEditor.bind(Editor);
  Editor.renderSceneEditor = function () {
    origRender();
    const container = document.getElementById('scene-editor');
    const scene = this.currentScene && this.data?.scenes?.[this.currentScene];
    if (!container || !scene) return;
    const baseText = container.querySelector('#scene-text');
    if (!baseText || !baseText.parentElement) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = this.renderSceneStatesPanel(scene);
    const statesBlock = wrap.firstElementChild;
    if (statesBlock) baseText.parentElement.insertAdjacentElement('afterend', statesBlock);
  };
})();
