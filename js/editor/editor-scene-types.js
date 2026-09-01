// ============================================================
// Scene Types — UX labels + recommended modules (additive)
// Does NOT own switchTab/renderAll. No force:true. No monkey-patch.
// ============================================================
(function attachEditorSceneTypes() {
  'use strict';
  if (typeof Editor === 'undefined') return;

  /** Canonical scene type catalog */
  const SCENE_TYPES = [
    { id: 'dialog', icon: '💬', label: 'Диалог', modules: ['story', 'dialogue', 'choices', 'npc'] },
    { id: 'combat', icon: '⚔️', label: 'Бой', modules: ['story', 'combat', 'choices'] },
    { id: 'shop', icon: '🛒', label: 'Магазин', modules: ['story', 'npc', 'components', 'choices'] },
    { id: 'blacksmith', icon: '🔨', label: 'Кузница', modules: ['story', 'npc', 'components', 'choices'] },
    { id: 'church', icon: '⛪', label: 'Церковь', modules: ['story', 'npc', 'components', 'choices'] },
    { id: 'hub', icon: '🏠', label: 'Хаб / поселение', modules: ['story', 'choices', 'location_place', 'hub', 'map'] },
    { id: 'quest', icon: '📜', label: 'Квест', modules: ['story', 'quest', 'npc', 'choices'] },
    { id: 'reward', icon: '🎁', label: 'Награда', modules: ['story', 'items', 'choices'] },
    { id: 'transition', icon: '🚪', label: 'Переход', modules: ['story', 'scene_choice', 'choices'] },
    { id: 'character_creation', icon: '🧙', label: 'Создание персонажа', modules: ['story', 'components'] },
    { id: 'custom', icon: '🧩', label: 'Своя сцена', modules: ['story', 'choices'] }
  ];

  const BY_ID = Object.create(null);
  SCENE_TYPES.forEach((t) => { BY_ID[t.id] = t; });

  /** Infer type from legacy special / data without writing */
  function inferSceneType(scene) {
    if (!scene || typeof scene !== 'object') return 'custom';
    if (scene.sceneType && BY_ID[scene.sceneType]) return scene.sceneType;
    const special = scene.special;
    if (special === 'shop') return 'shop';
    if (special === 'blacksmith') return 'blacksmith';
    if (special === 'temple' || special === 'church') return 'church';
    if (special === 'character_creation') return 'character_creation';
    if (Array.isArray(scene.combat) && scene.combat.length) return 'combat';
    if (scene.sceneChoice) return 'transition';
    if (Array.isArray(scene.dialogue) && scene.dialogue.length) return 'dialog';
    return 'custom';
  }

  function getSceneTypeMeta(id) {
    return BY_ID[id] || BY_ID.custom;
  }

  /**
   * Merge recommended modules into scene.editorModules without removing existing.
   * Does not change scene.id or location.
   */
  function mergeRecommendedModules(scene, typeId) {
    const meta = getSceneTypeMeta(typeId);
    if (!Array.isArray(scene.editorModules)) scene.editorModules = [];
    const set = new Set(scene.editorModules);
    (meta.modules || []).forEach((m) => set.add(m));
    scene.editorModules = Array.from(set);
  }

  Editor.SCENE_TYPES = SCENE_TYPES;
  Editor.inferSceneType = inferSceneType;
  Editor.getSceneTypeMeta = getSceneTypeMeta;

  Editor.getSceneType = function (sceneOrId) {
    const scene = typeof sceneOrId === 'string'
      ? this.data?.scenes?.[sceneOrId]
      : sceneOrId;
    return inferSceneType(scene);
  };

  /**
   * Set sceneType on current or given scene.
   * @param {string} typeId
   * @param {{ sceneId?: string, applyModules?: boolean }} [opts]
   */
  Editor.setSceneType = function (typeId, opts) {
    opts = opts || {};
    const id = opts.sceneId || this.currentScene;
    const scene = this.data?.scenes?.[id];
    if (!scene) return;
    const meta = getSceneTypeMeta(typeId);
    const prevId = scene.id;
    scene.sceneType = meta.id;
    // Optional special alignment for known types (does not wipe user data)
    if (meta.id === 'shop' && !scene.special) scene.special = 'shop';
    if (meta.id === 'blacksmith' && !scene.special) scene.special = 'blacksmith';
    if (meta.id === 'church' && !scene.special) scene.special = 'temple';
    if (opts.applyModules !== false) {
      mergeRecommendedModules(scene, meta.id);
    }
    // Hard guarantee: never change id
    scene.id = prevId;
    if (typeof this.updateJSONPreview === 'function') this.updateJSONPreview();
    if (typeof this.renderSceneEditor === 'function') this.renderSceneEditor();
    if (typeof this.renderSceneList === 'function') this.renderSceneList();
    if (typeof this.markDirty === 'function') this.markDirty();
  };

  /** HTML select for Scene Editor / Inspector */
  Editor.renderSceneTypeSelect = function (scene) {
    const current = inferSceneType(scene);
    const opts = SCENE_TYPES.map((t) => {
      const sel = t.id === current ? ' selected' : '';
      return `<option value="${t.id}"${sel}>${t.icon} ${this.escapeHtml ? this.escapeHtml(t.label) : t.label}</option>`;
    }).join('');
    return `<div class="form-group scene-type-field" data-editor-ui="scene-type-select">
      <label>Тип сцены</label>
      <select onchange="Editor.setSceneType(this.value)">
        ${opts}
      </select>
      <p class="hint">Тип — подсказка и стартовые блоки. Уже добавленные элементы не удаляются.</p>
    </div>`;
  };

  // Soft badge for scene list (via hooks.after only — no ownership claim)
  if (Editor.hooks && typeof Editor.hooks.after === 'function') {
    Editor.hooks.after('renderSceneList', function (result) {
      try {
        if (!this.data?.scenes) return result;
        document.querySelectorAll('.scene-item').forEach((el) => {
          if (el.querySelector('.scene-type-badge')) return;
          const idEl = el.querySelector('.scene-id');
          if (!idEl) return;
          const sid = idEl.textContent.trim();
          const sc = this.data.scenes[sid];
          if (!sc) return;
          const meta = getSceneTypeMeta(inferSceneType(sc));
          const badge = document.createElement('span');
          badge.className = 'scene-type-badge';
          badge.title = meta.label;
          badge.textContent = meta.icon;
          badge.style.marginLeft = '4px';
          idEl.appendChild(badge);
        });
      } catch (e) {
        /* non-fatal UI */
      }
      return result;
    });
  }
})();
