// ============================================
// Создание персонажа (D&D 5e Point Buy / PF2e Ancestry)
// ============================================

(function attachCharacterCreator() {
  const STAT_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const STAT_LABELS = {
    str: 'СИЛ',
    dex: 'ЛОВ',
    con: 'ТЕЛ',
    int: 'ИНТ',
    wis: 'МУД',
    cha: 'ХАР'
  };

  /** Полный список навыков D&D 5e (id → русское имя) */
  const SKILL_LABELS = {
    acrobatics: 'Акробатика',
    animal_handling: 'Уход за животными',
    arcana: 'Магия (тайные знания)',
    athletics: 'Атлетика',
    deception: 'Обман',
    history: 'История',
    insight: 'Проницательность',
    intimidation: 'Устрашение',
    investigation: 'Расследование',
    medicine: 'Медицина',
    nature: 'Природа',
    perception: 'Восприятие',
    performance: 'Выступление',
    persuasion: 'Убеждение',
    religion: 'Религия',
    sleight_of_hand: 'Ловкость рук',
    stealth: 'Скрытность',
    survival: 'Выживание',
    magic: 'Магия'
  };

  const ALL_SKILL_IDS = Object.keys(SKILL_LABELS).filter(k => k !== 'magic');

  /** Навыки Pathfinder 2e (id → русское имя) */
  const PF2E_SKILL_LABELS = {
    acrobatics: 'Акробатика',
    arcana: 'Магия (тайные знания)',
    athletics: 'Атлетика',
    crafting: 'Ремесло',
    deception: 'Обман',
    diplomacy: 'Дипломатия',
    intimidation: 'Запугивание',
    medicine: 'Медицина',
    nature: 'Природа',
    occultism: 'Оккультизм',
    performance: 'Выступление',
    religion: 'Религия',
    society: 'Общество',
    stealth: 'Скрытность',
    survival: 'Выживание',
    thievery: 'Воровство',
    perception: 'Восприятие'
  };

  const ALL_PF2E_SKILL_IDS = Object.keys(PF2E_SKILL_LABELS);

  const PF2E_RANK_SHORT = { trained: 'T', expert: 'E', master: 'M', legendary: 'L' };

  const CharacterCreator = {
    POINT_BUY_TOTAL: 27,
    STAT_MIN: 8,
    STAT_MAX: 15,
    ABILITY_BOOST_TOTAL: 4,
    PF2E_STAT_MAX: 18,

    draft: {
      name: '',
      gender: 'male',
      raceKey: '',
      heritageId: '',
      classKey: '',
      stats: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
      skills: [],
      step: 'form',
      skillLimitFlash: false,
      bonusAbilityId: '',
      pf2eFixedBoosts: {},
      pf2eFreeBoosts: {},
      pf2eFreeBoostsRemaining: 0
    },

    getActiveSystem() {
      return GameEngine.data?.meta?.system || 'dnd5e';
    },

    isPf2eMode() {
      return this.getActiveSystem() === 'pf2e'
        || GameEngine.activeSystem?.id === 'pf2e';
    },

    getAvailableRaces() {
      const races = GameEngine.data?.races || {};
      const system = this.getActiveSystem();
      return Object.entries(races)
        .filter(([, r]) => {
          const rs = r.system || 'dnd5e';
          if (system === 'pf2e') return rs === 'pf2e';
          return rs !== 'pf2e';
        })
        .map(([id, r]) => ({ id, ...r }));
    },

    getRacesForSystem(system) {
      const sys = system ?? this.getActiveSystem();
      const current = this.getActiveSystem();
      if (sys === current) {
        return this.getAvailableRaces().map(r => [r.id, r]);
      }
      const races = GameEngine.data?.races;
      if (!races || typeof races !== 'object') return [];
      return Object.entries(races).filter(([, r]) => {
        const rs = r.system || 'dnd5e';
        return sys === 'pf2e' ? rs === 'pf2e' : rs !== 'pf2e';
      });
    },

    hasRaces() {
      return this.getAvailableRaces().length > 0;
    },

    getRaceAsiPreview(raceKey) {
      const race = GameEngine.data?.races?.[raceKey];
      if (!race?.asi) return '';
      return Object.entries(race.asi)
        .map(([stat, val]) => `${STAT_LABELS[stat] || stat}+${val}`)
        .join(', ');
    },

    getEffectiveStatWithRace(stat) {
      const base = this.draft.stats[stat] || 8;
      const race = GameEngine.data?.races?.[this.draft.raceKey];
      const raceBonus = race?.asi?.[stat] || 0;
      return Math.min(20, base + raceBonus);
    },

    getModifierWithRace(stat) {
      return GameEngine.getModifier(this.getEffectiveStatWithRace(stat));
    },

    getClassesForSystem() {
      const classes = GameEngine.data?.classes || {};
      const sys = this.getActiveSystem();
      return Object.entries(classes).filter(([, c]) => {
        const cs = c.system || 'dnd5e';
        return sys === 'pf2e' ? cs === 'pf2e' : cs !== 'pf2e';
      });
    },

    getHint(key) {
      const hints = GameEngine.data?.ui_hints;
      if (!hints || !key) return '';
      return hints[key] || hints['class_' + key] || hints['stat_' + key] || '';
    },

    wrapStatRowWithHint(stat, rowHtml) {
      const statHint = this.getHint('stat_' + stat);
      return `
        <div class="cc-stat-row-with-hint">
          ${rowHtml}
          ${statHint ? `<div class="cc-stat-hint">${GameEngine.escapeHtml(statHint)}</div>` : ''}
        </div>`;
    },

    renderClassHintPanel() {
      let html = `<div class="cc-class-hint-panel" id="cc-class-hint-panel">`;
      if (this.draft.classKey) {
        const cls = GameEngine.data?.classes?.[this.draft.classKey];
        const hint = this.getHint('class_' + this.draft.classKey);
        html += `<div class="cc-hint-content">`;
        html += `<strong>${GameEngine.escapeHtml(cls?.name || this.draft.classKey)}</strong>`;
        if (hint) html += `<p>${GameEngine.escapeHtml(hint)}</p>`;
        if (cls?.resource) {
          const resHint = cls.resource.formula === 'rage'
            ? '2 + мод. Тел'
            : cls.resource.formula === 'charisma'
              ? 'мод. Хар'
              : cls.resource.formula === 'level'
                ? 'равно уровню'
                : String(cls.resource.max ?? '—');
          html += `<div class="cc-hint-resource">${GameEngine.escapeHtml(cls.resource.icon || '⚡')} ${GameEngine.escapeHtml(cls.resource.name)}: ${GameEngine.escapeHtml(resHint)}</div>`;
        }
        if (cls?.hpHitDie) {
          html += `<div class="cc-hint-resource">❤️ Кость хитов: к${cls.hpHitDie}</div>`;
        }
        html += `</div>`;
      } else {
        html += `<div class="cc-hint-empty">← Выберите класс, чтобы увидеть описание</div>`;
      }
      html += `</div>`;
      return html;
    },

    pointCost(score) {
      const sys = typeof GameEngine !== 'undefined' ? GameEngine.activeSystem : null;
      if (sys?.pointCost) return sys.pointCost(score);
      const s = Math.max(this.STAT_MIN, Math.min(this.STAT_MAX, score));
      if (s <= 8) return 0;
      let cost = 0;
      for (let v = 9; v <= s; v++) cost += v <= 13 ? 1 : 2;
      return cost;
    },

    pointsSpent() {
      return STAT_KEYS.reduce((sum, k) => sum + this.pointCost(this.draft.stats[k]), 0);
    },

    pointsRemaining() {
      return this.POINT_BUY_TOTAL - this.pointsSpent();
    },

    canRaise(stat) {
      return this.draft.stats[stat] < this.STAT_MAX && this.pointsRemaining() >= (this.draft.stats[stat] + 1 <= 13 ? 1 : 2);
    },

    canLower(stat) {
      return this.draft.stats[stat] > this.STAT_MIN;
    },

    resetDraft() {
      const pf2e = this.isPf2eMode();
      const base = pf2e ? 10 : 8;
      this.draft = {
        name: '',
        gender: 'male',
        raceKey: '',
        heritageId: '',
        classKey: '',
        stats: { str: base, dex: base, con: base, int: base, wis: base, cha: base },
        skills: [],
        step: 'form',
        skillLimitFlash: false,
        bonusAbilityId: '',
        favoredEnemyTypes: [],
        pf2eFixedBoosts: {},
        pf2eFreeBoosts: {},
        pf2eFreeBoostsRemaining: 0
      };
    },

    getRaceConfig(raceKey) {
      const key = raceKey ?? this.draft.raceKey;
      if (!key) return null;
      return GameEngine.data?.races?.[key] || null;
    },

    getRaceAsiBonus(stat) {
      const race = this.getRaceConfig();
      return race?.asi?.[stat] ?? 0;
    },

    getTotalStat(stat) {
      if (this.isPf2eMode()) return this.draft.stats[stat] ?? 10;
      if (!this.draft.raceKey) return this.draft.stats[stat] ?? 8;
      return this.getEffectiveStatWithRace(stat);
    },

    getRaceAbilityBoosts(raceKey) {
      const race = GameEngine.data?.races?.[raceKey];
      return race?.abilityBoosts || [];
    },

    applyRaceBoostsToDraft(raceKey) {
      const boosts = this.getRaceAbilityBoosts(raceKey);
      const fixed = {};
      let freeCount = 0;
      boosts.forEach(b => {
        if (b === 'free') freeCount++;
        else fixed[b] = (fixed[b] || 0) + 2;
      });
      this.draft.pf2eFixedBoosts = fixed;
      this.draft.pf2eFreeBoostsRemaining = freeCount;
      this.draft.pf2eFreeBoosts = {};
    },

    getTotalStatPF2e(stat) {
      const base = 10;
      const fixed = this.draft.pf2eFixedBoosts?.[stat] || 0;
      const free = (this.draft.pf2eFreeBoosts?.[stat] || 0) * 2;
      return Math.min(this.PF2E_STAT_MAX, base + fixed + free);
    },

    canAddFreeBoost(stat) {
      if ((this.draft.pf2eFreeBoostsRemaining || 0) <= 0) return false;
      if ((this.draft.pf2eFreeBoosts?.[stat] || 0) >= 1) return false;
      return this.getTotalStatPF2e(stat) + 2 <= this.PF2E_STAT_MAX;
    },

    canRemoveFreeBoost(stat) {
      return (this.draft.pf2eFreeBoosts?.[stat] || 0) > 0;
    },

    addFreeBoost(stat) {
      if (!this.canAddFreeBoost(stat)) return;
      if (!this.draft.pf2eFreeBoosts) this.draft.pf2eFreeBoosts = {};
      this.draft.pf2eFreeBoosts[stat] = (this.draft.pf2eFreeBoosts[stat] || 0) + 1;
      this.draft.pf2eFreeBoostsRemaining = (this.draft.pf2eFreeBoostsRemaining || 0) - 1;
      this.render();
    },

    removeFreeBoost(stat) {
      if (!this.canRemoveFreeBoost(stat)) return;
      this.draft.pf2eFreeBoosts[stat] -= 1;
      if (this.draft.pf2eFreeBoosts[stat] <= 0) delete this.draft.pf2eFreeBoosts[stat];
      this.draft.pf2eFreeBoostsRemaining = (this.draft.pf2eFreeBoostsRemaining || 0) + 1;
      this.render();
    },

    getPf2eBoostSourceLabel(stat) {
      const parts = [];
      if (this.draft.pf2eFixedBoosts?.[stat]) parts.push('раса');
      if (this.draft.pf2eFreeBoosts?.[stat]) parts.push('свободный');
      return parts.join(', ');
    },

    formatAsi(asi) {
      if (!asi || !Object.keys(asi).length) return '—';
      return Object.entries(asi)
        .map(([k, v]) => `${STAT_LABELS[k] || k} +${v}`)
        .join(', ');
    },

    formatAbilityBoosts(boosts) {
      if (!boosts?.length) return '—';
      return boosts.map(b => (b === 'free' ? 'свободный' : (STAT_LABELS[b] || b))).join(', ');
    },

    renderRaceDetailHtml(race) {
      if (!race) return '';
      const pf2e = race.system === 'pf2e';
      const traits = (race.traits || []).map(t => `
        <div class="cc-race-trait">
          <span class="cc-race-trait-name">${GameEngine.escapeHtml(t.name)}</span>
          <span class="cc-race-trait-desc"> — ${GameEngine.escapeHtml(t.desc || '')}</span>
        </div>`).join('');
      const langs = (race.languages || []).length
        ? `<p class="cc-hint">Языки: ${GameEngine.escapeHtml(race.languages.join(', '))}</p>`
        : '';
      const meta = pf2e
        ? `Скорость: ${race.speed ?? 25} фт · ОЗ ancestry: ${race.hp ?? 8} · Бусты: ${GameEngine.escapeHtml(this.formatAbilityBoosts(race.abilityBoosts))}`
        : `Скорость: ${race.speed ?? 30} фт · ASI: ${GameEngine.escapeHtml(this.formatAsi(race.asi))}`;
      return `
        <div class="cc-race-detail" id="cc-race-detail">
          <h4>${GameEngine.renderIcon(race.icon)} ${GameEngine.escapeHtml(race.name)}</h4>
          <p>${GameEngine.escapeHtml(race.description || '')}</p>
          <p class="cc-hint">${meta}</p>
          ${traits}
          ${langs}
        </div>`;
    },

    renderHeritageBlock(race) {
      const heritages = race?.heritages || [];
      if (!heritages.length) return '';
      const options = heritages.map(h => {
        const sel = this.draft.heritageId === h.id ? ' selected' : '';
        return `<option value="${GameEngine.escapeAttr(h.id)}"${sel}>${GameEngine.escapeHtml(h.name)}</option>`;
      }).join('');
      const selected = heritages.find(h => h.id === this.draft.heritageId);
      const desc = selected?.desc
        ? `<div class="cc-heritage-desc" id="cc-heritage-desc">${GameEngine.escapeHtml(selected.desc)}</div>`
        : `<div class="cc-heritage-desc" id="cc-heritage-desc"></div>`;
      return `
        <h2 class="cc-section-title">Наследие (Heritage)</h2>
        <select id="cc-heritage-select" class="cc-input">
          <option value="">— Выберите наследие —</option>
          ${options}
        </select>
        ${desc}`;
    },

    applyThemeToRoot(root) {
      if (!root) return;
      if (typeof ThemeSystem !== 'undefined' && GameEngine.data?.theme) {
        ThemeSystem.apply(GameEngine.data.theme);
      }
      root.style.color = 'var(--ink)';
      root.style.background = 'var(--paper)';
    },

    open() {
      this.resetDraft();
      const root = document.getElementById('char-creator-screen');
      const main = document.getElementById('main');
      if (!root) return;
      GameEngine.hideCampaignPicker?.();
      document.getElementById('class-screen')?.classList.add('hidden');
      document.getElementById('name-screen')?.classList.add('hidden');
      document.getElementById('game-content')?.classList.add('hidden');
      if (main) main.classList.add('hidden');
      root.classList.remove('hidden');
      this.applyThemeToRoot(root);
      this.render();
    },

    close() {
      const root = document.getElementById('char-creator-screen');
      if (root) {
        root.classList.add('hidden');
        root.innerHTML = '';
      }
      document.getElementById('main')?.classList.remove('hidden');
    },

    getHpPreview(classKey) {
      const con = this.isPf2eMode()
        ? this.getTotalStatPF2e('con')
        : this.getEffectiveStatWithRace('con');
      const conMod = this.isPf2eMode()
        ? Math.floor((con - 10) / 2)
        : this.getModifierWithRace('con');
      if (GameEngine.getClassLevel1Hp) {
        return GameEngine.getClassLevel1Hp(classKey, conMod);
      }
      return Math.max(1, 10 + conMod);
    },

    getHpPreviewLabel(classKey) {
      if (this.isPf2eMode()) {
        const race = this.getRaceConfig();
        const cls = this.getClassConfig(classKey);
        const hp = race?.hp ?? GameEngine.data?.ancestries?.[cls?.ancestry || 'human']?.hp ?? 8;
        const per = cls?.hpPerLevel ?? 8;
        return `${hp} ancestry + ${per}/ур. + мод. Тел`;
      }
      const cls = this.getClassConfig(classKey);
      const die = cls?.hpHitDie ?? {
        warrior: 10, wizard: 6, paladin: 10, barbarian: 12,
        bard: 8, druid: 8, monk: 8, warlock: 8, sorcerer: 6,
        rogue: 8, cleric: 8, ranger: 10
      }[classKey] ?? 8;
      return `к${die} + мод. Тел`;
    },

    getClassConfig(classKey) {
      return GameEngine.data?.classes?.[classKey] || null;
    },

    normalizeSkillId(raw) {
      const s = String(raw || '').trim();
      if (!s) return '';
      const low = s.toLowerCase().replace(/\s+/g, '_');
      if (SKILL_LABELS[low]) return low;
      const aliases = {
        'ловкость_рук': 'sleight_of_hand',
        'ловкость рук': 'sleight_of_hand',
        'уход_за_животными': 'animal_handling',
        'природа': 'nature',
        'магия': 'magic',
        'arcane': 'arcana'
      };
      if (aliases[low] || aliases[s.toLowerCase()]) return aliases[low] || aliases[s.toLowerCase()];
      const byRu = Object.entries(SKILL_LABELS).find(([, ru]) => ru === s);
      if (byRu) return byRu[0];
      return low;
    },

    normalizePf2eSkillId(raw) {
      const s = String(raw || '').trim().toLowerCase().replace(/\s+/g, '_');
      if (PF2E_SKILL_LABELS[s]) return s;
      const aliases = { arcane: 'arcana', thievery: 'thievery', crafting: 'crafting' };
      if (aliases[s]) return aliases[s];
      return this.normalizeSkillId(raw);
    },

    /** Фиксированные навыки PF2e (автоматически trained) */
    getPf2eFixedSkills(classKey) {
      const cls = this.getClassConfig(classKey ?? this.draft.classKey);
      if (!cls?.fixedSkills?.length) return [];
      return cls.fixedSkills.map(s => this.normalizePf2eSkillId(s)).filter(Boolean);
    },

    getPf2eChoiceRank(classKey) {
      const cls = this.getClassConfig(classKey ?? this.draft.classKey);
      return cls?.skillChoices?.rank || 'trained';
    },

    /** Конфиг выбора навыков класса (D&D 5e / PF2e skillChoices) */
    getClassSkillChoices(classKey) {
      const key = classKey ?? this.draft.classKey;
      const cls = this.getClassConfig(key);
      if (!cls?.skillChoices) return null;
      const sc = cls.skillChoices;
      const count = Math.max(0, parseInt(sc.count, 10) || 0);
      let from = sc.from;
      const pf2e = cls.system === 'pf2e' || this.isPf2eMode();
      if (from === 'any') from = pf2e ? [...ALL_PF2E_SKILL_IDS] : [...ALL_SKILL_IDS];
      if (!Array.isArray(from)) from = [];
      const norm = pf2e
        ? (s) => this.normalizePf2eSkillId(s)
        : (s) => this.normalizeSkillId(s);
      return {
        count,
        from: from.map(norm).filter(Boolean),
        rank: sc.rank || 'trained'
      };
    },

    /** Пул навыков, из которых игрок выбирает владения класса */
    getSelectableSkillPool(classKey) {
      const key = classKey ?? this.draft.classKey;
      const cls = this.getClassConfig(key);
      const fixed = new Set(this.getPf2eFixedSkills(key));
      const choices = this.getClassSkillChoices(key);
      let pool = [];
      if (choices?.from?.length) {
        pool = choices.from;
      } else if (cls) {
        let raw = [];
        if (Array.isArray(cls.startingSkills) && cls.startingSkills.length) {
          raw = cls.startingSkills.map(s => (typeof s === 'string' ? s : s.id || s.key));
        } else if (typeof cls.skills === 'string' && cls.skills.trim()) {
          raw = cls.skills.split(',').map(s => s.trim());
        }
        const norm = cls.system === 'pf2e' || this.isPf2eMode()
          ? (s) => this.normalizePf2eSkillId(s)
          : (s) => this.normalizeSkillId(s);
        pool = raw.map(norm).filter(Boolean);
      }
      return [...new Set(pool.filter(id => !fixed.has(id)))];
    },

    getRequiredClassSkillCount(classKey) {
      const choices = this.getClassSkillChoices(classKey);
      if (choices) return choices.count;
      const pool = this.getSelectableSkillPool(classKey);
      return pool.length ? 1 : 0;
    },

    needsSkillSelectionStep() {
      if (!this.draft.classKey) return false;
      if (this.isPf2eMode()) {
        const fixed = this.getPf2eFixedSkills(this.draft.classKey).length;
        const need = this.getRequiredClassSkillCount(this.draft.classKey);
        return fixed > 0 || need > 0 || this.getSelectableSkillPool(this.draft.classKey).length > 0;
      }
      return this.getRequiredClassSkillCount(this.draft.classKey) > 0
        || this.getSelectableSkillPool(this.draft.classKey).length > 0;
    },

    getRaceBonusSkillIds() {
      const race = this.getRaceConfig();
      return (race?.bonusSkills || []).map(s => this.normalizeSkillId(s)).filter(Boolean);
    },

    /** Итоговые владения: выбор игрока + бонусы расы (вне лимита класса) */
    buildFinalSkillIds() {
      const picked = [...new Set((this.draft.skills || []).map(s => this.normalizeSkillId(s)).filter(Boolean))];
      const raceBonus = this.getRaceBonusSkillIds();
      return [...new Set([...picked, ...raceBonus])];
    },

    getClassPickedSkillCount() {
      const norm = this.isPf2eMode()
        ? (id) => this.normalizePf2eSkillId(id)
        : (id) => this.normalizeSkillId(id);
      const fixed = new Set(this.getPf2eFixedSkills().map(norm));
      const raceSet = new Set(this.getRaceBonusSkillIds().map(norm));
      return (this.draft.skills || []).filter(id => {
        const k = norm(id);
        return !fixed.has(k) && !raceSet.has(k);
      }).length;
    },

    /** Карта рангов PF2e для state.skills при финализации */
    buildPf2eSkillsMap() {
      const rank = this.getPf2eChoiceRank();
      const map = {};
      this.getPf2eFixedSkills().forEach(id => { map[id] = rank; });
      const norm = (id) => this.normalizePf2eSkillId(id);
      (this.draft.skills || []).forEach(id => {
        const k = norm(id);
        if (!map[k]) map[k] = rank;
      });
      this.getRaceBonusSkillIds().forEach(id => {
        const k = norm(id);
        if (!map[k]) map[k] = 'trained';
      });
      return map;
    },

    isSkillsStepComplete() {
      const need = this.getRequiredClassSkillCount(this.draft.classKey);
      if (this.getClassSkillChoices(this.draft.classKey)) {
        return this.getClassPickedSkillCount() === need;
      }
      return (this.draft.skills || []).length >= Math.max(1, need);
    },

    getBaseAbilities(classKey) {
      const cls = this.getClassConfig(classKey);
      return cls?.abilities || [];
    },

    getBonusAbilityChoices(classKey) {
      const cls = this.getClassConfig(classKey);
      if (!cls) return [];
      const ids = cls.level1BonusChoices || [];
      const pool = GameEngine.getProgression?.().abilities || GameEngine.data?.progression?.abilities || {};
      return ids.map(id => {
        const fromClass = (cls.abilities || []).find(a => a.id === id);
        return fromClass || pool[id] || { id, name: id, icon: '✨', desc: '' };
      }).filter(ab => ab && ab.id);
    },

    skillLabel(skillIdOrName) {
      const key = String(skillIdOrName).toLowerCase();
      if (this.isPf2eMode() && PF2E_SKILL_LABELS[key]) return PF2E_SKILL_LABELS[key];
      if (SKILL_LABELS[key]) return SKILL_LABELS[key];
      return skillIdOrName;
    },

    skillsToString(skillIds) {
      return skillIds.map(id => this.skillLabel(id)).join(', ');
    },

    buildPf2eStatsForFinalize() {
      const stats = {};
      STAT_KEYS.forEach(s => { stats[s] = 10; });
      Object.entries(this.draft.pf2eFixedBoosts || {}).forEach(([stat, val]) => {
        stats[stat] = Math.min(this.PF2E_STAT_MAX, (stats[stat] || 10) + val);
      });
      Object.entries(this.draft.pf2eFreeBoosts || {}).forEach(([stat, count]) => {
        stats[stat] = Math.min(this.PF2E_STAT_MAX, (stats[stat] || 10) + count * 2);
      });
      return stats;
    },

    isFormStepValid() {
      const name = (this.draft.name || '').trim();
      if (!name) return false;
      if (!this.draft.gender || !['male', 'female'].includes(this.draft.gender)) return false;
      if (this.hasRaces() && !this.draft.raceKey) return false;
      if (!this.draft.classKey) return false;
      if (this.isPf2eMode()) {
        if (!this.draft.heritageId) return false;
        if ((this.draft.pf2eFreeBoostsRemaining || 0) !== 0) return false;
      } else if (this.pointsRemaining() !== 0) {
        return false;
      }
      const bonus = this.getBonusAbilityChoices(this.draft.classKey);
      if (bonus.length && !this.draft.bonusAbilityId) return false;
      if (this.needsFavoredEnemyPick()) {
        const need = this.getRequiredFavoredTypeCount();
        if ((this.draft.favoredEnemyTypes || []).length < need) return false;
      }
      return true;
    },

    needsFavoredEnemyPick() {
      return !this.isPf2eMode() && this.draft.classKey === 'ranger';
    },

    getRequiredFavoredTypeCount() {
      if (!this.needsFavoredEnemyPick()) return 0;
      return this.draft.bonusAbilityId === 'ranger_favored_enemy' ? 2 : 1;
    },

    toggleDraftFavoredType(typeId) {
      if (!typeId) return;
      const need = this.getRequiredFavoredTypeCount();
      const list = [...(this.draft.favoredEnemyTypes || [])];
      const idx = list.indexOf(typeId);
      if (idx >= 0) list.splice(idx, 1);
      else if (list.length < need) list.push(typeId);
      else if (need === 1) list[0] = typeId;
      this.draft.favoredEnemyTypes = list;
      this.updateStartButton();
      this.render();
    },

    renderFavoredEnemySection() {
      if (!this.needsFavoredEnemyPick()) return '';
      const need = this.getRequiredFavoredTypeCount();
      const picked = this.draft.favoredEnemyTypes || [];
      const catalog = GameEngine.getCreatureTypeCatalog();
      const chips = catalog.map((t) => {
        const on = picked.includes(t.id);
        const full = !on && picked.length >= need;
        return `<button type="button" class="cc-ability-chip${on ? ' active' : ''}" data-favored-type="${GameEngine.escapeAttr(t.id)}" ${full ? 'disabled style="opacity:0.45;"' : ''}>${GameEngine.escapeHtml(t.label)}</button>`;
      }).join('');
      const hint = need === 2
        ? 'Следопыт: один тип для базового умения и второй — для улучшения «Избранный враг» (+2 урона).'
        : 'Следопыт: выберите тип существ для умения «Избранный враг».';
      return `
        <h2 class="cc-section-title">Избранные враги <span class="cc-points-badge">${picked.length} / ${need}</span></h2>
        <div class="cc-abilities-wrap cc-favored-types">${chips}</div>
        <p class="cc-hint">${hint}</p>`;
    },

    isValid() {
      if (this.draft.step === 'skills') {
        if (!this.isFormStepValid()) return false;
        return this.isSkillsStepComplete();
      }
      if (!this.isFormStepValid()) return false;
      if (this.needsSkillSelectionStep()) return false;
      return true;
    },

    getGenderOptions() {
      return [
        { id: 'male', label: 'Мужской' },
        { id: 'female', label: 'Женский' }
      ];
    },

    renderSkillsStep() {
      if (this.isPf2eMode()) return this.renderPf2eSkillsStep();
      return this.renderDndSkillsStep();
    },

    renderDndSkillsStep() {
      const need = this.getRequiredClassSkillCount(this.draft.classKey);
      const picked = this.getClassPickedSkillCount();
      const pool = this.getSelectableSkillPool(this.draft.classKey);
      const raceBonus = this.getRaceBonusSkillIds();
      const flash = this.draft.skillLimitFlash;
      const cls = this.getClassConfig(this.draft.classKey);

      let html = `
        <div class="cc-inner paper-sheet">
          <h1 class="cc-title">Выбор навыков владения</h1>
          <p class="cc-intro">${GameEngine.escapeHtml(cls?.name || '')} — отметьте навыки, которыми владеет персонаж.</p>
          <h2 class="cc-section-title">Выберите ${need} навыка владения
            <span class="cc-points-badge" id="cc-skill-counter">Выбрано: ${picked} / ${need}</span>
          </h2>`;

      if (raceBonus.length) {
        html += `<p class="cc-hint">От расы автоматически: ${raceBonus.map(id => GameEngine.escapeHtml(this.skillLabel(id))).join(', ')}</p>`;
      }

      if (!pool.length) {
        html += `<p class="cc-hint">Для класса не заданы skillChoices / startingSkills.</p>`;
      } else {
        html += `<div class="cc-skills-wrap${flash ? ' cc-skills-wrap--limit' : ''}">`;
        pool.forEach(sk => {
          const id = this.normalizeSkillId(sk);
          const on = this.draft.skills.includes(id);
          html += `<button type="button" class="cc-skill-chip${on ? ' active' : ''}" data-skill="${GameEngine.escapeAttr(id)}">${GameEngine.escapeHtml(this.skillLabel(id))}</button>`;
        });
        html += `</div>`;
        if (flash) {
          html += `<p class="cc-skill-limit-msg">Можно выбрать только ${need} навыков</p>`;
        }
      }

      const canNext = this.isSkillsStepComplete();
      html += `
          <div class="cc-nav-row">
            <button type="button" id="cc-back-btn" class="btn btn-secondary">← Назад</button>
            <button type="button" id="cc-next-btn" class="start-btn" ${canNext ? '' : 'disabled'}>Далее →</button>
          </div>
        </div>`;
      return html;
    },

    /** Этап навыков Pathfinder 2e: fixedSkills + выбор из пула */
    renderPf2eSkillsStep() {
      const need = this.getRequiredClassSkillCount(this.draft.classKey);
      const picked = this.getClassPickedSkillCount();
      const pool = this.getSelectableSkillPool(this.draft.classKey);
      const fixed = this.getPf2eFixedSkills();
      const rank = this.getPf2eChoiceRank();
      const rankLabel = PF2E_RANK_SHORT[rank] || 'T';
      const flash = this.draft.skillLimitFlash;
      const cls = this.getClassConfig(this.draft.classKey);
      const norm = (id) => this.normalizePf2eSkillId(id);

      let html = `
        <div class="cc-inner paper-sheet">
          <h1 class="cc-title">Навыки (Pathfinder 2e)</h1>
          <p class="cc-intro">${GameEngine.escapeHtml(cls?.name || '')} — ранги владения при создании персонажа.</p>`;

      if (fixed.length) {
        html += `<h2 class="cc-section-title">Фиксированные владения</h2><div class="cc-skills-wrap cc-skills-wrap--fixed">`;
        fixed.forEach(id => {
          html += `<span class="cc-skill-chip active disabled" title="Автоматически">${GameEngine.escapeHtml(this.skillLabel(id))} <span class="cc-rank-tag">(${rankLabel})</span></span>`;
        });
        html += `</div><p class="cc-hint">Эти навыки класс даёт автоматически (ранг ${rankLabel} = Trained).</p>`;
      }

      html += `<h2 class="cc-section-title">Выберите ${need} навыка
        <span class="cc-points-badge" id="cc-skill-counter">Выбрано: ${picked} / ${need}</span>
      </h2>`;

      if (!pool.length && !need) {
        html += `<p class="cc-hint">Дополнительный выбор не требуется.</p>`;
      } else {
        html += `<div class="cc-skills-wrap${flash ? ' cc-skills-wrap--limit' : ''}">`;
        pool.forEach(sk => {
          const id = norm(sk);
          const on = (this.draft.skills || []).some(s => norm(s) === id);
          html += `<button type="button" class="cc-skill-chip${on ? ' active' : ''}" data-skill="${GameEngine.escapeAttr(id)}">${GameEngine.escapeHtml(this.skillLabel(id))}</button>`;
        });
        html += `</div>`;
        if (flash) {
          html += `<p class="cc-skill-limit-msg">Можно выбрать только ${need} навыков</p>`;
        }
        html += `<p class="cc-hint">Каждый выбранный навык получает ранг Trained (${rankLabel}).</p>`;
      }

      const canNext = this.isSkillsStepComplete();
      html += `
          <div class="cc-nav-row">
            <button type="button" id="cc-back-btn" class="btn btn-secondary">← Назад</button>
            <button type="button" id="cc-next-btn" class="start-btn" ${canNext ? '' : 'disabled'}>Далее →</button>
          </div>
        </div>`;
      return html;
    },

    renderGenderSection() {
      const options = this.getGenderOptions();
      let html = `<h2 class="cc-section-title">Пол персонажа</h2><div class="cc-gender-grid">`;
      options.forEach(opt => {
        const sel = this.draft.gender === opt.id ? ' selected' : '';
        html += `<button type="button" class="cc-gender-card${sel}" data-gender="${opt.id}">
      <span class="cc-gender-label">${GameEngine.escapeHtml(opt.label)}</span>
    </button>`;
      });
      html += `</div>`;
      return html;
    },

    renderRaceSection() {
      if (!this.hasRaces()) return '';
      const pf2e = this.isPf2eMode();
      const title = pf2e ? 'Раса (Ancestry)' : 'Раса';
      let html = `<h2 class="cc-section-title">${title}</h2><div class="cc-race-grid">`;
      const raceList = pf2e
        ? this.getRacesForSystem('pf2e')
        : this.getAvailableRaces().map(r => [r.id, r]);
      for (const [raceId, race] of raceList) {
        const sel = this.draft.raceKey === raceId ? ' selected' : '';
        const sub = pf2e
          ? `<span class="cc-race-hp">❤️ ${race.hp ?? 8} ОЗ</span><span class="cc-race-speed">🏃 ${race.speed ?? 25} фт</span>`
          : `<span class="cc-race-asi">${GameEngine.escapeHtml(this.getRaceAsiPreview(raceId) || this.formatAsi(race.asi))}</span>`;
        html += `
          <button type="button" class="cc-race-card${sel}" data-race="${GameEngine.escapeAttr(raceId)}">
            <span class="cc-race-icon">${GameEngine.renderIcon(race.icon)}</span>
            <span class="cc-race-name">${GameEngine.escapeHtml(race.name)}</span>
            ${sub}
          </button>`;
      }
      html += '</div>';
      if (this.draft.raceKey) {
        html += this.renderRaceDetailHtml(this.getRaceConfig());
        if (pf2e) html += this.renderHeritageBlock(this.getRaceConfig());
      } else {
        html += '<div class="cc-race-detail" id="cc-race-detail"><p class="cc-hint">Выберите расу.</p></div>';
      }
      return html;
    },

    renderStatsSection() {
      const pf2e = this.isPf2eMode();
      if (pf2e) {
        const remaining = this.draft.pf2eFreeBoostsRemaining ?? 0;
        const totalFree = (this.getRaceAbilityBoosts(this.draft.raceKey) || []).filter(b => b === 'free').length;
        let html = `
          <h2 class="cc-section-title">Характеристики (Ability Boosts)
            <span class="cc-points-badge">Свободных бустов: ${remaining} / ${totalFree}</span>
          </h2>
          <div class="cc-stats-grid">`;
        STAT_KEYS.forEach(stat => {
          const effective = this.getTotalStatPF2e(stat);
          const mod = GameEngine.getModifier(effective);
          const modStr = mod >= 0 ? '+' + mod : String(mod);
          const source = this.getPf2eBoostSourceLabel(stat);
          const sourceHtml = source ? `<span class="cc-stat-source">${GameEngine.escapeHtml(source)}</span>` : '';
          const upDisabled = !this.canAddFreeBoost(stat);
          const downDisabled = !this.canRemoveFreeBoost(stat);
          html += this.wrapStatRowWithHint(stat, `
          <div class="cc-stat-row">
            <span class="cc-stat-label">${STAT_LABELS[stat]}</span>
            <button type="button" class="cc-stat-btn" data-pf2e-stat="${stat}" data-dir="-1" ${downDisabled ? 'disabled' : ''}>−</button>
            <span class="cc-stat-value">${effective}</span>
            <button type="button" class="cc-stat-btn" data-pf2e-stat="${stat}" data-dir="1" ${upDisabled ? 'disabled' : ''}>+</button>
            <span class="cc-stat-mod">${modStr}</span>
            ${sourceHtml}
          </div>`);
        });
        html += '</div>';
        return html;
      }

      const pts = this.pointsRemaining();
      let html = `
        <h2 class="cc-section-title">Характеристики <span class="cc-points-badge">Очков: ${pts} / ${this.POINT_BUY_TOTAL}</span></h2>
        <div class="cc-stats-grid">`;
      const showRaceAsi = this.draft.raceKey && !this.isPf2eMode();
      STAT_KEYS.forEach(stat => {
        const base = this.draft.stats[stat];
        const raceBonus = showRaceAsi ? this.getRaceAsiBonus(stat) : 0;
        const total = showRaceAsi ? this.getEffectiveStatWithRace(stat) : base;
        const mod = showRaceAsi ? this.getModifierWithRace(stat) : GameEngine.getModifier(base);
        const modStr = mod >= 0 ? '+' + mod : String(mod);
        const racePart = raceBonus
          ? `<span class="cc-stat-race-bonus">(+${raceBonus})</span><span class="cc-stat-eq">=</span><span class="cc-stat-total">${total}</span>`
          : `<span class="cc-stat-total">${total}</span>`;
        const upDisabled = !this.canRaise(stat);
        const downDisabled = !this.canLower(stat);
        html += this.wrapStatRowWithHint(stat, `
          <div class="cc-stat-row cc-stat-row--dnd">
            <span class="cc-stat-label">${STAT_LABELS[stat]}</span>
            <button type="button" class="cc-stat-btn" data-stat="${stat}" data-dir="-1" ${downDisabled ? 'disabled' : ''}>−</button>
            <span class="cc-stat-base">${base}</span>
            ${racePart}
            <button type="button" class="cc-stat-btn" data-stat="${stat}" data-dir="1" ${upDisabled ? 'disabled' : ''}>+</button>
            <span class="cc-stat-mod">${modStr}</span>
          </div>`);
      });
      html += '</div>';
      return html;
    },

    render() {
      const root = document.getElementById('char-creator-screen');
      if (!root) return;

      try {
      root.innerHTML = '';
      this.applyThemeToRoot(root);

      const classEntries = this.getClassesForSystem();
      if (!classEntries.length) {
        root.innerHTML = `
          <div class="cc-inner paper-sheet">
            <h1 class="cc-title">Создание персонажа</h1>
            <p class="cc-intro">Загрузите game_data.json с классами для системы «${GameEngine.escapeHtml(this.getActiveSystem())}».</p>
            <button type="button" class="start-btn" onclick="GameEngine.loadGameDataFromFile()">📂 Загрузить контент</button>
          </div>`;
        return;
      }

      if (this.draft.step === 'skills') {
        root.innerHTML = this.renderSkillsStep();
        this.bindEvents(root);
        GameEngine.initTooltips();
        return;
      }

      const cls = this.draft.classKey ? this.getClassConfig(this.draft.classKey) : null;
      const baseAbilities = this.draft.classKey ? this.getBaseAbilities(this.draft.classKey) : [];
      const bonusChoices = this.draft.classKey ? this.getBonusAbilityChoices(this.draft.classKey) : [];
      const formValid = this.isFormStepValid();
      const canStart = this.isValid();
      const showSkillsNext = this.needsSkillSelectionStep();
      const pf2e = this.isPf2eMode();
      const intro = pf2e
        ? 'Pathfinder 2e: выберите ancestry, наследие, распределите свободные бусты (+2), класс и навыки.'
        : 'Point Buy (27 очков), раса, класс, навыки и одно дополнительное стартовое умение.';

      let html = `
        <div class="cc-inner paper-sheet">
          <h1 class="cc-title">Создание персонажа</h1>
          <p class="cc-intro">${intro}</p>
          <div class="form-group cc-name-group">
            <label for="cc-char-name">Имя героя</label>
            <input type="text" id="cc-char-name" class="cc-input" maxlength="40"
              placeholder="Введите имя..." value="${GameEngine.escapeAttr(this.draft.name)}">
          </div>
      `;

      html += this.renderGenderSection();
      html += this.renderRaceSection();

      html += `<h2 class="cc-section-title">Класс</h2><div class="cc-class-grid">`;
      for (const [key, c] of classEntries) {
        const sel = this.draft.classKey === key ? ' selected' : '';
        html += `
          <button type="button" class="cc-class-card${sel}" data-class="${GameEngine.escapeAttr(key)}">
            <span class="cc-class-icon">${GameEngine.renderIcon(c.icon)}</span>
            <span class="cc-class-name">${GameEngine.escapeHtml(c.name)}</span>
          </button>`;
      }
      html += '</div>';

      html += this.renderClassHintPanel();

      html += this.renderStatsSection();

      if (cls && this.draft.classKey) {
        const hp = this.getHpPreview(this.draft.classKey);
        const hpLabel = this.getHpPreviewLabel(this.draft.classKey);
        html += `<p class="cc-hp-preview">ОЗ на 1 уровне: <b>${hp}</b> (${hpLabel})</p>`;
      }

      if (showSkillsNext && this.draft.classKey) {
        const need = this.getRequiredClassSkillCount(this.draft.classKey);
        html += `<p class="cc-hint">На следующем шаге выберите ${need} навыка владения${this.getRaceBonusSkillIds().length ? ' (бонусы расы добавятся автоматически)' : ''}.</p>`;
      }

      if (baseAbilities.length) {
        html += `<h2 class="cc-section-title">Базовые умения (1 уровень)</h2><ul class="cc-base-abilities">`;
        baseAbilities.forEach(ab => {
          html += `<li>${GameEngine.renderIcon(ab.icon)} ${GameEngine.escapeHtml(ab.name)}</li>`;
        });
        html += `</ul>`;
      }

      if (bonusChoices.length) {
        html += `<h2 class="cc-section-title">Дополнительное умение <span class="cc-points-badge">выберите 1</span></h2><div class="cc-abilities-wrap">`;
        bonusChoices.forEach(ab => {
          const on = this.draft.bonusAbilityId === ab.id;
          html += `<button type="button" class="cc-ability-chip${on ? ' active' : ''}" data-ability="${GameEngine.escapeAttr(ab.id)}" title="${GameEngine.escapeAttr(ab.desc || '')}">
            ${GameEngine.renderIcon(ab.icon)} ${GameEngine.escapeHtml(ab.name)}
          </button>`;
        });
        html += `</div><p class="cc-hint">Помимо базовых умений класса выберите одно дополнительное.</p>`;
      }

      html += this.renderFavoredEnemySection();

      html += `<div class="cc-nav-row">`;
      if (showSkillsNext) {
        html += `<button type="button" id="cc-to-skills-btn" class="start-btn cc-start-btn" ${formValid ? '' : 'disabled'}>
            Далее: навыки →
          </button>`;
      } else {
        html += `<button type="button" id="cc-start-btn" class="start-btn cc-start-btn" ${canStart ? '' : 'disabled'}>
            ⚔️ Начать приключение
          </button>`;
      }
      html += `</div></div>`;

      root.innerHTML = html;
      this.bindEvents(root);
      GameEngine.initTooltips();
      } catch (err) {
        console.error('CharacterCreator.render:', err);
        root.innerHTML = `
          <div class="cc-inner paper-sheet">
            <h1 class="cc-title">Ошибка создателя персонажа</h1>
            <p class="cc-intro">${GameEngine.escapeHtml(err.message || String(err))}</p>
            <button type="button" class="start-btn" onclick="GameEngine.returnToCampaignPicker()">← К выбору игры</button>
          </div>`;
      }
    },

    bindEvents(root) {
      const nameInp = root.querySelector('#cc-char-name');
      if (nameInp) {
        nameInp.oninput = () => {
          this.draft.name = nameInp.value;
          this.updateStartButton();
        };
      }

      root.querySelectorAll('.cc-gender-card').forEach(btn => {
        btn.onclick = () => {
          this.draft.gender = btn.getAttribute('data-gender') || 'male';
          this.render();
        };
      });

      root.querySelectorAll('.cc-race-card').forEach(btn => {
        btn.onclick = () => {
          this.draft.raceKey = btn.getAttribute('data-race') || '';
          if (this.isPf2eMode()) {
            this.applyRaceBoostsToDraft(this.draft.raceKey);
            this.draft.heritageId = '';
          }
          this.draft.skills = [];
          this.draft.skillLimitFlash = false;
          this.render();
        };
      });

      const heritageSel = root.querySelector('#cc-heritage-select');
      if (heritageSel) {
        heritageSel.onchange = () => {
          this.draft.heritageId = heritageSel.value || '';
          const race = this.getRaceConfig();
          const h = (race?.heritages || []).find(x => x.id === this.draft.heritageId);
          const descEl = root.querySelector('#cc-heritage-desc');
          if (descEl) descEl.textContent = h?.desc || '';
          this.updateStartButton();
        };
      }

      root.querySelectorAll('.cc-class-card').forEach(btn => {
        btn.onclick = () => {
          this.draft.classKey = btn.getAttribute('data-class');
          this.draft.skills = [];
          this.draft.skillLimitFlash = false;
          this.draft.step = 'form';
          this.draft.favoredEnemyTypes = [];
          const bonus = this.getBonusAbilityChoices(this.draft.classKey);
          this.draft.bonusAbilityId = bonus.length ? bonus[0].id : '';
          this.render();
        };
      });

      root.querySelectorAll('[data-pf2e-stat]').forEach(btn => {
        btn.onclick = () => {
          const stat = btn.getAttribute('data-pf2e-stat');
          const dir = parseInt(btn.getAttribute('data-dir'), 10);
          if (!stat || !dir) return;
          if (dir > 0) this.addFreeBoost(stat);
          else this.removeFreeBoost(stat);
        };
      });

      root.querySelectorAll('.cc-stat-btn[data-stat]').forEach(btn => {
        btn.onclick = () => {
          const stat = btn.getAttribute('data-stat');
          const dir = parseInt(btn.getAttribute('data-dir'), 10);
          if (!stat || !dir) return;
          const next = this.draft.stats[stat] + dir;
          if (dir > 0 && !this.canRaise(stat)) return;
          if (dir < 0 && !this.canLower(stat)) return;
          this.draft.stats[stat] = next;
          this.render();
        };
      });

      root.querySelectorAll('.cc-skill-chip').forEach(chip => {
        chip.onclick = () => this.toggleDraftSkill(chip.getAttribute('data-skill'));
      });

      const toSkillsBtn = root.querySelector('#cc-to-skills-btn');
      if (toSkillsBtn) {
        toSkillsBtn.onclick = () => {
          if (!this.isFormStepValid()) return;
          this.draft.step = 'skills';
          this.draft.skillLimitFlash = false;
          this.render();
        };
      }

      const backBtn = root.querySelector('#cc-back-btn');
      if (backBtn) {
        backBtn.onclick = () => {
          this.draft.step = 'form';
          this.draft.skillLimitFlash = false;
          this.render();
        };
      }

      const nextBtn = root.querySelector('#cc-next-btn');
      if (nextBtn) {
        nextBtn.onclick = () => {
          if (!this.isSkillsStepComplete()) return;
          this.finalizeFromDraft();
        };
      }

      root.querySelectorAll('.cc-ability-chip[data-ability]').forEach(chip => {
        chip.onclick = () => {
          this.draft.bonusAbilityId = chip.getAttribute('data-ability') || '';
          if (this.needsFavoredEnemyPick()) {
            const need = this.getRequiredFavoredTypeCount();
            const list = this.draft.favoredEnemyTypes || [];
            if (list.length > need) {
              this.draft.favoredEnemyTypes = list.slice(0, need);
            }
          }
          this.render();
        };
      });

      root.querySelectorAll('[data-favored-type]').forEach(chip => {
        chip.onclick = () => {
          this.toggleDraftFavoredType(chip.getAttribute('data-favored-type'));
        };
      });

      const startBtn = root.querySelector('#cc-start-btn');
      if (startBtn) {
        startBtn.onclick = () => {
          if (!this.isValid()) return;
          this.finalizeFromDraft();
        };
      }
    },

    toggleDraftSkill(skillId) {
      const id = this.isPf2eMode()
        ? this.normalizePf2eSkillId(skillId)
        : this.normalizeSkillId(skillId);
      if (!id) return;
      const fixed = new Set(this.getPf2eFixedSkills().map(s => this.normalizePf2eSkillId(s)));
      if (fixed.has(id)) return;
      const need = this.getRequiredClassSkillCount(this.draft.classKey);
      const norm = this.isPf2eMode()
        ? (s) => this.normalizePf2eSkillId(s)
        : (s) => this.normalizeSkillId(s);
      const idx = (this.draft.skills || []).findIndex(s => norm(s) === id);
      if (idx >= 0) {
        this.draft.skills.splice(idx, 1);
        this.draft.skillLimitFlash = false;
      } else {
        const classPicked = this.getClassPickedSkillCount();
        if (this.getClassSkillChoices(this.draft.classKey) && classPicked >= need) {
          this.draft.skillLimitFlash = true;
          this.render();
          return;
        }
        this.draft.skills.push(id);
        this.draft.skillLimitFlash = false;
      }
      if (this.draft.step === 'skills') {
        this.render();
      } else {
        this.updateStartButton();
      }
    },

    finalizeFromDraft() {
      if (!this.isValid()) return;
      const payload = { ...this.draft };
      if (this.isPf2eMode()) {
        payload.stats = this.buildPf2eStatsForFinalize();
        payload.pf2eSkills = this.buildPf2eSkillsMap();
        payload.skills = Object.keys(payload.pf2eSkills);
      } else {
        payload.skills = this.buildFinalSkillIds();
      }
      GameEngine.finalizeCharacter(payload);
    },

    updateStartButton() {
      const startBtn = document.getElementById('cc-start-btn');
      const skillsBtn = document.getElementById('cc-to-skills-btn');
      const nextBtn = document.getElementById('cc-next-btn');
      if (startBtn) startBtn.disabled = !this.isValid();
      if (skillsBtn) skillsBtn.disabled = !this.isFormStepValid();
      if (nextBtn) nextBtn.disabled = !this.isSkillsStepComplete();
      const counter = document.getElementById('cc-skill-counter');
      if (counter) {
        const need = this.getRequiredClassSkillCount(this.draft.classKey);
        counter.textContent = `Выбрано: ${this.getClassPickedSkillCount()} / ${need}`;
      }
    }
  };

  function attach() {
    if (typeof GameEngine === 'undefined') return false;
    GameEngine.CharacterCreator = CharacterCreator;
    return true;
  }

  if (!attach()) {
    document.addEventListener('DOMContentLoaded', () => {
      if (!attach()) console.error('character-creator.js: GameEngine не определён');
    });
  }
})();
