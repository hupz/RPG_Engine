// ============================================================
// Восстановление CRUD сцен/выборов (после усечения editor.html)
// ============================================================
(function attachEditorSceneCrud() {
  if (typeof Editor === 'undefined') {
    console.error('editor-scene-crud.js: Editor не определён');
    return;
  }

  Object.assign(Editor, {
    getSceneIds() {
      return Object.keys(this.data?.scenes || {});
    },

    updateSceneField(field, value) {
      if (!this.currentScene || !this.data?.scenes?.[this.currentScene]) return;
      const sc = this.data.scenes[this.currentScene];
      if (value === '' || value == null) delete sc[field];
      else sc[field] = value;
      this.updateJSONPreview?.();
      this.renderSceneList?.();
      if (typeof this.scheduleLivePreviewUpdate === 'function') this.scheduleLivePreviewUpdate();
    },

    setSceneNpcId(npcId) {
      if (!this.currentScene || !this.data?.scenes?.[this.currentScene]) return;
      const sc = this.data.scenes[this.currentScene];
      if (!npcId) delete sc.npcId;
      else sc.npcId = String(npcId);
      if (typeof this.ensureSceneEditorModules === 'function') {
        this.ensureSceneEditorModules(sc);
        if (sc.editorModules && npcId && !sc.editorModules.includes('npc')) {
          sc.editorModules.push('npc');
        }
      }
      this.markDirty?.();
      this.updateJSONPreview?.();
      this.renderSceneEditor?.();
    },

    addDialogue() {
      const sc = this.data?.scenes?.[this.currentScene];
      if (!sc) return;
      if (!Array.isArray(sc.dialogue)) sc.dialogue = [];
      const npc = sc.npcId && this.data?.npcs?.[sc.npcId];
      sc.dialogue.push({
        speaker: npc?.name || '',
        text: ''
      });
      if (typeof this.ensureSceneEditorModules === 'function') {
        this.ensureSceneEditorModules(sc);
        if (sc.editorModules && !sc.editorModules.includes('dialogue')) {
          sc.editorModules.push('dialogue');
        }
      }
      this.renderSceneEditor?.();
      this.updateJSONPreview?.();
    },

    updateDialogue(idx, field, value) {
      const sc = this.data?.scenes?.[this.currentScene];
      if (!sc?.dialogue?.[idx]) return;
      const line = sc.dialogue[idx];
      if (value === '' || value == null) delete line[field];
      else line[field] = value;
      this.updateJSONPreview?.();
      if (typeof this.scheduleLivePreviewUpdate === 'function') this.scheduleLivePreviewUpdate();
    },

    removeDialogue(idx) {
      const sc = this.data?.scenes?.[this.currentScene];
      if (!sc?.dialogue) return;
      sc.dialogue.splice(idx, 1);
      this.renderSceneEditor?.();
      this.updateJSONPreview?.();
    },

    updateChoice(idx, field, value) {
      const sc = this.data?.scenes?.[this.currentScene];
      if (!sc?.choices?.[idx]) return;
      const c = sc.choices[idx];
      if (value === '' || value === undefined) delete c[field];
      else c[field] = value;
      this.updateJSONPreview?.();
      this.updateChoicePreview?.();
      if (typeof this.scheduleLivePreviewUpdate === 'function') this.scheduleLivePreviewUpdate();
    },

    addChoice() {
      const sc = this.data?.scenes?.[this.currentScene];
      if (!sc) return;
      if (!Array.isArray(sc.choices)) sc.choices = [];
      sc.choices.push({ text: 'Новый выбор', to: '', icon: '➡️' });
      if (typeof this.ensureSceneEditorModules === 'function') {
        this.ensureSceneEditorModules(sc);
        if (sc.editorModules && !sc.editorModules.includes('choices')) {
          sc.editorModules.push('choices');
        }
      }
      this.renderSceneEditor?.();
      this.updateJSONPreview?.();
    },

    removeChoice(idx) {
      const sc = this.data?.scenes?.[this.currentScene];
      if (!sc?.choices) return;
      sc.choices.splice(idx, 1);
      this.renderSceneEditor?.();
      this.updateJSONPreview?.();
    },

    moveChoice(from, to) {
      const sc = this.data?.scenes?.[this.currentScene];
      if (!sc?.choices) return;
      const arr = sc.choices;
      if (from < 0 || to < 0 || from >= arr.length || to >= arr.length) return;
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      this.renderSceneEditor?.();
      this.updateJSONPreview?.();
    },

    /** alias для валидатора */
    validateAll() {
      if (typeof this.validateProjectExtended === 'function') {
        return this.validateProjectExtended();
      }
      if (typeof this.runProjectValidation === 'function') {
        return this.runProjectValidation();
      }
      return { issues: [] };
    },

    renderStats() {
      const el = document.getElementById('stats-panel') || document.getElementById('editor-stats');
      if (!el || !this.data) return;
      const sc = Object.keys(this.data.scenes || {}).length;
      const q = Object.keys(this.data.quests || {}).length;
      const n = Object.keys(this.data.npcs || {}).length;
      el.innerHTML = `<span class="hint">Сцен: ${sc} · Квестов: ${q} · NPC: ${n}</span>`;
    },

    renderBalance() {
      const c = document.getElementById('balance-editor');
      if (!c) return;
      c.innerHTML = '<div class="empty-state"><p class="hint">Баланс: используйте вкладки врагов и прогрессии.</p></div>';
    },

    // Базовый редактор глобального умения (если не задан в HTML)
    renderGlobalAbilityEditor(id, ab, idx) {
      if (!ab) return '';
      const aid = this.escapeAttr(id);
      const effect = ab.effect && typeof ab.effect === 'object' ? ab.effect : { type: 'damage', value: '1d6' };
      if (typeof ProjectDataSchema !== 'undefined' && typeof ab.effect === 'string') {
        ab.effect = ProjectDataSchema.normalizeAbilityEffect(ab.effect);
      }
      const types = ['damage', 'heal', 'buff', 'smite', 'magic_missile', 'extra_attack', 'custom'];
      const typeOpts = types.map((t) =>
        `<option value="${t}" ${(effect.type || '') === t ? 'selected' : ''}>${t}</option>`
      ).join('');
      return `<div class="quest-detail-card" data-global-ability="${aid}">
        <div class="form-group"><label>ID</label><input value="${aid}" disabled></div>
        <div class="form-group"><label>Название</label>
          <input value="${this.escapeAttr(ab.name || '')}" onchange="Editor.updateGlobalAbility('${aid}','name',this.value)"></div>
        <div class="form-group"><label>Иконка</label>
          <input value="${this.escapeAttr(ab.icon || '✨')}" onchange="Editor.updateGlobalAbility('${aid}','icon',this.value)"></div>
        <div class="form-group"><label>Описание</label>
          <textarea onchange="Editor.updateGlobalAbility('${aid}','desc',this.value)">${this.escapeHtml(ab.desc || '')}</textarea></div>
        <div class="form-group"><label>Стоимость</label>
          <input type="number" min="0" value="${ab.cost ?? 1}" onchange="Editor.updateGlobalAbility('${aid}','cost',parseInt(this.value,10)||0)"></div>
        <div class="form-group"><label>Тип эффекта</label>
          <select onchange="Editor.updateGlobalAbilityEffectType('${aid}',this.value)">
            ${typeOpts}
          </select></div>
        <div class="form-group"><label>Значение / кости</label>
          <input value="${this.escapeAttr(effect.value || effect.desc || '')}"
            onchange="Editor.updateGlobalAbilityEffectValue('${aid}',this.value)"></div>
        <button type="button" class="btn btn-danger" onclick="${this.escapeAttr('Editor.deleteGlobalAbility(' + JSON.stringify(aid) + ')')}">Удалить</button>
      </div>`;
    },

    updateGlobalAbility(id, field, value) {
      const pool = this.data?.progression?.abilities;
      if (!pool?.[id]) return;
      pool[id][field] = value;
      this.updateJSONPreview?.();
      if (field === 'name' || field === 'icon') this.renderAbilities?.();
    },

    updateGlobalAbilityEffectType(id, type) {
      const ab = this.data?.progression?.abilities?.[id];
      if (!ab) return;
      if (!ab.effect || typeof ab.effect !== 'object') ab.effect = {};
      ab.effect.type = type;
      this.updateJSONPreview?.();
      this.renderAbilities?.();
    },

    updateGlobalAbilityEffectValue(id, value) {
      const ab = this.data?.progression?.abilities?.[id];
      if (!ab) return;
      if (!ab.effect || typeof ab.effect !== 'object') ab.effect = { type: 'damage' };
      ab.effect.value = value;
      this.updateJSONPreview?.();
    }
  });
})();
