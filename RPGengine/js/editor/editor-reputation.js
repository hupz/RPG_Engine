// ============================================
// Редактор фракций репутации (data.reputation)
// ============================================

(function attachEditorReputation() {
  if (typeof Editor === 'undefined') {
    console.error('editor-reputation.js: Editor не определён');
    return;
  }

  Object.assign(Editor, {
    editingFactionId: null,
    editingFactionMode: 'list',

    ensureReputationFactions() {
      if (!this.data) return;
      if (typeof ReputationSystem !== 'undefined') {
        ReputationSystem.ensureFactions(this.data);
      } else if (!this.data.reputation) {
        this.data.reputation = {};
      }
    },

    getFactionIds() {
      this.ensureReputationFactions();
      if (typeof ReputationSystem !== 'undefined') {
        return ReputationSystem.getFactionIds(this.data);
      }
      return Object.keys(this.data.reputation || {}).filter((k) => k !== 'starting');
    },

    getReputationFlagOptions() {
      return this.getFactionIds();
    },

    selectFactionToEdit(id) {
      this.editingFactionId = id;
      this.editingFactionMode = 'edit';
      this.renderReputation();
    },

    cancelFactionEdit() {
      this.editingFactionMode = 'list';
      this.renderReputation();
    },

    renderReputation() {
      const c = document.getElementById('reputation-editor');
      if (!c) return;
      if (!this.data) {
        c.innerHTML = '<div class="empty-state"><h2>Загрузите данные</h2></div>';
        return;
      }
      this.ensureReputationFactions();
      if (this.editingFactionMode === 'edit' && this.editingFactionId) {
        c.innerHTML = this.renderFactionEditForm(this.editingFactionId);
        return;
      }
      const ids = this.getFactionIds();
      const cards = ids.map((id) => {
        const f = this.data.reputation[id];
        return `<div class="rep-faction-card">
          <div class="rep-faction-card-head">
            <span>${this.renderIcon(f.icon || '🤝')} <strong>${this.escapeHtml(f.name || id)}</strong></span>
          </div>
          <div class="hint">ID: <code>${this.escapeHtml(id)}</code></div>
          <div class="rep-faction-card-actions">
            <button type="button" class="btn btn-secondary" onclick="Editor.selectFactionToEdit(${JSON.stringify(id)})">Редактировать</button>
            <button type="button" class="btn btn-danger" onclick="Editor.deleteFaction(${JSON.stringify(id)})">Удалить</button>
          </div>
        </div>`;
      }).join('');
      c.innerHTML = `<div class="rep-manager">
        <div class="rep-manager-head">
          <h3>🤝 Репутация</h3>
          <button type="button" class="btn btn-primary" onclick="Editor.createFaction()">+ Добавить фракцию</button>
        </div>
        <p class="hint">Фракции задают уровни отношений, скидки в торговле и поведение NPC/врагов.</p>
        <div class="rep-faction-grid">${cards || '<p class="hint">Нет фракций — создайте первую.</p>'}</div>
      </div>`;
    },

    renderFactionEditForm(factionId) {
      const f = this.data.reputation[factionId];
      if (!f) return '<div class="empty-state">Фракция не найдена</div>';
      const fid = JSON.stringify(factionId);
      const levels = Array.isArray(f.levels) ? f.levels : [];
      const levelsHtml = levels.map((lv, idx) => this.renderFactionLevelRow(factionId, idx, lv)).join('');
      const effects = f.effects || {};
      return `<div class="quest-detail-card rep-edit-form">
        <div class="quest-detail-head">
          <h3>Редактирование фракции</h3>
          <button type="button" class="btn btn-secondary" onclick="Editor.cancelFactionEdit()">← К списку</button>
        </div>
        <div class="form-group"><label>Название</label>
          <input value="${this.escapeAttr(f.name || '')}" onchange="Editor.updateFactionField(${fid},'name',this.value)"></div>
        <div class="form-group"><label>ID (латиница)</label>
          <input value="${this.escapeAttr(factionId)}" disabled>
          <div class="hint">Ключ в JSON: <code>reputation.${this.escapeHtml(factionId)}</code></div></div>
        <div class="form-group"><label>Иконка</label>
          <input value="${this.escapeAttr(f.icon || '🤝')}" onchange="Editor.updateFactionField(${fid},'icon',this.value)"></div>
        <h4>Уровни репутации</h4>
        <p class="hint">Диапазоны min…max не должны пересекаться. discount: −0.5 = наценка 50%, +0.3 = скидка 30%.</p>
        <div class="rep-levels-list">${levelsHtml}</div>
        <button type="button" class="btn btn-secondary" onclick="Editor.addFactionLevel(${fid})">+ Добавить уровень</button>
        <h4 style="margin-top:16px;">Эффекты (текст для мастера)</h4>
        <div class="form-group"><label>При вражде (onHostile)</label>
          <textarea rows="2" placeholder="auto_combat, trade_ban…" onchange="Editor.updateFactionEffects(${fid},'onHostile',this.value)">${this.escapeTextarea((effects.onHostile || []).join(', '))}</textarea></div>
        <div class="form-group"><label>При герое (onHero)</label>
          <textarea rows="2" placeholder="discount_30, rare_access…" onchange="Editor.updateFactionEffects(${fid},'onHero',this.value)">${this.escapeTextarea((effects.onHero || []).join(', '))}</textarea></div>
        <button type="button" class="btn btn-primary" onclick="Editor.saveFactionForm(${fid})">💾 Сохранить фракцию</button>
      </div>`;
    },

    renderFactionLevelRow(factionId, idx, lv) {
      lv = lv || {};
      const fid = JSON.stringify(factionId);
      const trade = lv.tradeAllowed !== false;
      const discPct = Math.round((Number(lv.discount) || 0) * 100);
      return `<div class="rep-level-card" style="border-left:4px solid ${this.escapeAttr(lv.color || '#999')}">
        <div class="rep-level-head">
          <strong>${this.escapeHtml(lv.label || 'Уровень')} (${lv.min ?? '?'} … ${lv.max ?? '?'})</strong>
          <button type="button" class="btn-remove" onclick="Editor.removeFactionLevel(${fid},${idx})">×</button>
        </div>
        <div class="grid-2">
          <div class="form-group"><label>Мин</label><input type="number" value="${lv.min ?? 0}" onchange="Editor.updateFactionLevel(${fid},${idx},'min',parseInt(this.value,10)||0)"></div>
          <div class="form-group"><label>Макс</label><input type="number" value="${lv.max ?? 0}" onchange="Editor.updateFactionLevel(${fid},${idx},'max',parseInt(this.value,10)||0)"></div>
        </div>
        <div class="grid-2">
          <div class="form-group"><label>Название</label><input value="${this.escapeAttr(lv.label || '')}" onchange="Editor.updateFactionLevel(${fid},${idx},'label',this.value)"></div>
          <div class="form-group"><label>Цвет</label><input type="color" value="${this.escapeAttr(lv.color || '#f1c40f')}" onchange="Editor.updateFactionLevel(${fid},${idx},'color',this.value)"></div>
        </div>
        <div class="grid-2">
          <div class="form-group"><label>Скидка (−1…+1)</label><input type="number" step="0.05" value="${Number(lv.discount) || 0}" onchange="Editor.updateFactionLevel(${fid},${idx},'discount',parseFloat(this.value)||0)"></div>
          <div class="form-group"><label>${discPct >= 0 ? 'Скидка' : 'Наценка'} ~${Math.abs(discPct)}%</label>
            <label><input type="checkbox" ${trade ? 'checked' : ''} onchange="Editor.updateFactionLevel(${fid},${idx},'tradeAllowed',this.checked)"> Торговля разрешена</label></div>
        </div>
      </div>`;
    },

    createFaction() {
      this.ensureReputationFactions();
      const id = prompt('ID фракции (латиница, напр. rep_bandits):', 'rep_new');
      if (!id || !/^rep_[a-z][a-z0-9_]*$/i.test(id)) {
        alert('ID: rep_ + латиница');
        return;
      }
      if (this.data.reputation[id]) {
        alert('Фракция уже существует');
        return;
      }
      const name = prompt('Название фракции:', 'Новая фракция') || 'Новая фракция';
      const base = typeof ReputationSystem !== 'undefined'
        ? ReputationSystem.createDefaultFaction(id, name)
        : { id, name, icon: '🤝', levels: [], effects: { onHostile: [], onHero: [] } };
      this.data.reputation[id] = base;
      if (!this.data.startingFlags) this.data.startingFlags = {};
      if (this.data.startingFlags[id] == null) this.data.startingFlags[id] = 0;
      this.editingFactionId = id;
      this.editingFactionMode = 'edit';
      this.renderReputation();
      this.updateJSONPreview();
    },

    deleteFaction(id) {
      if (!confirm('Удалить фракцию «' + id + '»?')) return;
      delete this.data.reputation[id];
      this.editingFactionId = null;
      this.editingFactionMode = 'list';
      this.renderReputation();
      this.updateJSONPreview();
    },

    updateFactionField(id, field, value) {
      if (!this.data.reputation[id]) return;
      this.data.reputation[id][field] = value;
      this.updateJSONPreview();
    },

    updateFactionLevel(id, idx, field, value) {
      const f = this.data.reputation[id];
      if (!f?.levels?.[idx]) return;
      if (field === 'tradeAllowed') f.levels[idx].tradeAllowed = !!value;
      else f.levels[idx][field] = value;
      this.updateJSONPreview();
      this.renderReputation();
    },

    addFactionLevel(id) {
      const f = this.data.reputation[id];
      if (!f) return;
      if (!Array.isArray(f.levels)) f.levels = [];
      f.levels.push({ min: 0, max: 10, label: 'Новый уровень', color: '#f1c40f', discount: 0, tradeAllowed: true });
      this.renderReputation();
      this.updateJSONPreview();
    },

    removeFactionLevel(id, idx) {
      const f = this.data.reputation[id];
      if (!f?.levels || f.levels.length <= 1) {
        alert('Нужен хотя бы один уровень');
        return;
      }
      f.levels.splice(idx, 1);
      this.renderReputation();
      this.updateJSONPreview();
    },

    updateFactionEffects(id, key, raw) {
      const f = this.data.reputation[id];
      if (!f) return;
      if (!f.effects) f.effects = {};
      f.effects[key] = String(raw || '').split(',').map((s) => s.trim()).filter(Boolean);
      this.updateJSONPreview();
    },

    saveFactionForm(id) {
      this.editingFactionMode = 'list';
      this.renderReputation();
      this.updateJSONPreview();
      alert('Фракция сохранена в JSON проекта.');
    },

    renderFactionSelect(selected, onchangeJs, emptyLabel) {
      const opts = this.getFactionIds().map((id) => {
        const name = this.data.reputation[id]?.name || id;
        const sel = id === selected ? ' selected' : '';
        return `<option value="${this.escapeAttr(id)}"${sel}>${this.escapeHtml(name)}</option>`;
      }).join('');
      return `<select onchange="${this.escapeAttr(onchangeJs)}"><option value="">${this.escapeHtml(emptyLabel || '— фракция —')}</option>${opts}</select>`;
    },

    renderNpcReputationSection(npcId) {
      const npc = this.data?.npcs?.[npcId];
      if (!npc) return '';
      if (!Array.isArray(npc.reputationEffects)) npc.reputationEffects = [];
      const nid = JSON.stringify(npcId);
      const rows = npc.reputationEffects.map((eff, idx) => {
        const triggers = [
          { v: 'talk', l: 'При разговоре' },
          { v: 'quest_complete', l: 'Квест NPC завершён' }
        ];
        const trOpts = triggers.map((t) =>
          `<option value="${t.v}" ${eff.trigger === t.v ? 'selected' : ''}>${t.l}</option>`
        ).join('');
        const facOpts = this.getFactionIds().map((fid) => {
          const name = this.data.reputation[fid]?.name || fid;
          return `<option value="${this.escapeAttr(fid)}" ${eff.faction === fid ? 'selected' : ''}>${this.escapeHtml(name)}</option>`;
        }).join('');
        return `<div class="rep-effect-row">
          <select onchange="Editor.updateNpcRepEffect(${nid},${idx},'trigger',this.value)">${trOpts}</select>
          <select onchange="Editor.updateNpcRepEffect(${nid},${idx},'faction',this.value)"><option value="">—</option>${facOpts}</select>
          <input type="number" value="${eff.value ?? 0}" placeholder="±" style="width:70px" onchange="Editor.updateNpcRepEffect(${nid},${idx},'value',parseInt(this.value,10)||0)">
          <button type="button" class="btn-remove" onclick="Editor.removeNpcRepEffect(${nid},${idx})">×</button>
        </div>`;
      }).join('');
      return `<div class="project-info" style="margin-top:12px;">
        <h4>🤝 Влияние на репутацию</h4>
        <p class="hint">Изменение репутации при разговоре или завершении квеста этого NPC.</p>
        ${rows || '<p class="hint">Эффектов нет.</p>'}
        <button type="button" class="btn btn-secondary" onclick="Editor.addNpcRepEffect(${nid})">+ Добавить репутационный эффект</button>
      </div>`;
    },

    addNpcRepEffect(npcId) {
      const npc = this.data?.npcs?.[npcId];
      if (!npc) return;
      if (!Array.isArray(npc.reputationEffects)) npc.reputationEffects = [];
      const firstFaction = this.getFactionIds()[0] || 'rep_village';
      npc.reputationEffects.push({ trigger: 'talk', faction: firstFaction, value: 1, once: true });
      this.renderNPCs();
      this.updateJSONPreview();
    },

    updateNpcRepEffect(npcId, idx, field, value) {
      const npc = this.data?.npcs?.[npcId];
      if (!npc?.reputationEffects?.[idx]) return;
      npc.reputationEffects[idx][field] = value;
      this.updateJSONPreview();
    },

    removeNpcRepEffect(npcId, idx) {
      const npc = this.data?.npcs?.[npcId];
      if (!npc?.reputationEffects) return;
      npc.reputationEffects.splice(idx, 1);
      this.renderNPCs();
      this.updateJSONPreview();
    },

    renderEnemyBehaviorSection(enemyId) {
      const e = this.data?.enemies?.[enemyId];
      if (!e) return '';
      const eid = JSON.stringify(enemyId);
      if (!e.behavior) e.behavior = {};
      const fac = e.faction || '';
      const facSelect = this.renderFactionSelect(
        fac,
        `Editor.updateEnemy(${JSON.stringify(enemyId)},'faction',this.value);Editor.renderEnemies();`,
        '— без фракции —'
      );
      const tiers = [
        { key: 'hostile', title: 'Если репутация ≤ порога (Вражда)' },
        { key: 'neutral', title: 'Нейтралитет (порог ≥)' },
        { key: 'friendly', title: 'Дружба (порог ≥)' },
        { key: 'hero', title: 'Герой (порог ≥)' }
      ];
      const actions = [
        { v: 'auto_combat', l: 'Сразу бой' },
        { v: 'dialogue_then_combat', l: 'Диалог → бой' },
        { v: 'dialogue_optional_combat', l: 'Диалог, можно уйти' },
        { v: 'ally', l: 'Союзник / без боя' }
      ];
      const tierHtml = tiers.map(({ key, title }) => {
        const b = e.behavior[key] || {};
        const actOpts = actions.map((a) =>
          `<option value="${a.v}" ${b.action === a.v ? 'selected' : ''}>${a.l}</option>`
        ).join('');
        return `<div class="rep-behavior-tier">
          <strong>${title}</strong>
          <div class="grid-2">
            <div class="form-group"><label>Порог</label>
              <input type="number" value="${b.threshold ?? ''}" placeholder="${key === 'hostile' ? -20 : key === 'friendly' ? 20 : 0}"
                onchange="Editor.updateEnemyBehavior(${eid},'${key}','threshold',parseInt(this.value,10))"></div>
            <div class="form-group"><label>Действие</label>
              <select onchange="Editor.updateEnemyBehavior(${eid},'${key}','action',this.value)">${actOpts}</select></div>
          </div>
          <div class="form-group"><label>Диалог</label>
            <input value="${this.escapeAttr(b.dialogue || '')}" placeholder="Реплика при встрече…"
              onchange="Editor.updateEnemyBehavior(${eid},'${key}','dialogue',this.value)"></div>
        </div>`;
      }).join('');
      return `<div class="project-info" style="margin-top:12px;">
        <h4>🤝 Поведение по репутации</h4>
        <div class="form-group"><label>Фракция врага</label>${facSelect}</div>
        ${tierHtml}
      </div>`;
    },

    updateEnemyBehavior(enemyId, tier, field, value) {
      const e = this.data?.enemies?.[enemyId];
      if (!e) return;
      if (!e.behavior) e.behavior = {};
      if (!e.behavior[tier]) e.behavior[tier] = {};
      e.behavior[tier][field] = value;
      this.updateJSONPreview();
    },

    /** Штраф репутации фракции при убийстве врага (использует enemy.faction) */
    renderEnemyFactionKillSection(enemyId) {
      const e = this.data?.enemies?.[enemyId];
      if (!e) return '';
      const eid = JSON.stringify(enemyId);
      const important = !!e.factionImportant;
      const facName = e.faction
        ? (this.data.reputation?.[e.faction]?.name || e.faction)
        : null;
      const facHint = facName
        ? `Фракция: ${facName}`
        : 'Сначала укажите фракцию в блоке «Поведение по репутации»';
      const fields = important
        ? `<div class="form-group" style="margin-top:10px;">
            <label>Изменение репутации при убийстве (${this.escapeHtml(facHint)})</label>
            <input type="number" value="${e.reputationOnKill ?? -5}" placeholder="-5"
              onchange="Editor.updateEnemy(${eid},'reputationOnKill',parseInt(this.value,10)||0)">
            <p class="hint">Отрицательное число ухудшает отношения (например −5). Положительное — улучшает.</p>
          </div>`
        : '';
      return `<div class="project-info" style="margin-top:12px;">
        <h4>🤝 Репутация при убийстве</h4>
        <label>
          <input type="checkbox" ${important ? 'checked' : ''}
            onchange="Editor.setEnemyFactionImportant(${eid}, this.checked)">
          Важность для фракции
        </label>
        ${fields}
      </div>`;
    },

    setEnemyFactionImportant(enemyId, checked) {
      const e = this.data?.enemies?.[enemyId];
      if (!e) return;
      if (checked) {
        e.factionImportant = true;
        if (e.reputationOnKill == null) e.reputationOnKill = -5;
      } else {
        delete e.factionImportant;
        delete e.reputationOnKill;
      }
      this.renderEnemies();
      this.updateJSONPreview();
    }
  });
})();
