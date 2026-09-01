// ============================================================
// Project data schema version + единая миграция при загрузке
// ============================================================
(function (global) {
  const DATA_VERSION = 5;

  /**
   * Нормализация ability.effect: string → object
   */
  function normalizeAbilityEffect(effect) {
    if (effect == null) return { type: 'damage', value: '1d6', damageType: 'physical' };
    if (typeof effect === 'object' && effect.type) return effect;
    if (typeof effect !== 'string') return { type: 'custom', desc: String(effect) };
    const s = effect.trim();
    if (s.startsWith('heal:')) return { type: 'heal', value: s.slice(5), targeting: { scope: 'self' } };
    if (s.startsWith('damage:')) return { type: 'damage', value: s.slice(7), damageType: 'physical' };
    if (s === 'extra_attack') return { type: 'extra_attack' };
    if (s.startsWith('ac_bonus:')) return { type: 'buff', buffType: 'ac', value: parseInt(s.slice(9), 10) || 2, targeting: { scope: 'self' } };
    if (s === 'magic_missile') return { type: 'magic_missile' };
    if (s.startsWith('aoe_fire:')) {
      return { type: 'damage', value: s.slice(9), damageType: 'fire', targeting: { scope: 'all_enemies' } };
    }
    if (s.startsWith('smite:')) return { type: 'smite', value: s.slice(6) };
    return { type: 'custom', desc: s };
  }

  function migrateAbilitiesInClass(cls) {
    if (!cls || !Array.isArray(cls.abilities)) return;
    cls.abilities.forEach((ab) => {
      if (!ab || typeof ab === 'string') return;
      if (typeof ab.effect === 'string' || (ab.effect && !ab.effect.type && !Array.isArray(ab.effects))) {
        ab.effect = normalizeAbilityEffect(ab.effect);
      }
    });
  }

  /**
   * Единый каталог умений: progression.abilities.
   * Классы хранят только id-ссылки. Встроенные объекты поднимаются в пул.
   * Идемпотентна.
   */
  function migrateClassAbilitiesToPool(data) {
    if (!data || typeof data !== 'object') return;
    if (!data.progression || typeof data.progression !== 'object') {
      data.progression = {
        enabled: true,
        maxLevel: 5,
        expTable: [0, 100, 220, 380, 600],
        defaults: {},
        abilities: {}
      };
    }
    if (!data.progression.abilities || typeof data.progression.abilities !== 'object') {
      data.progression.abilities = {};
    }
    const pool = data.progression.abilities;

    Object.entries(data.classes || {}).forEach(([classId, cls]) => {
      if (!cls || !Array.isArray(cls.abilities)) return;
      const ids = [];
      const seen = new Set();

      cls.abilities.forEach((ab, i) => {
        if (ab == null) return;
        let aid = null;

        if (typeof ab === 'string') {
          aid = ab.trim();
          if (!aid) return;
        } else if (typeof ab === 'object') {
          aid = String(ab.id || (classId + '_ability_' + (i + 1))).trim();
          if (!aid) return;
          if (typeof ab.effect === 'string' || (ab.effect && !ab.effect.type && !Array.isArray(ab.effects))) {
            ab.effect = normalizeAbilityEffect(ab.effect);
          }
          if (!pool[aid]) {
            const copy = JSON.parse(JSON.stringify(ab));
            copy.id = aid;
            pool[aid] = copy;
          }
        } else {
          return;
        }

        if (!seen.has(aid)) {
          seen.add(aid);
          ids.push(aid);
        }
      });

      cls.abilities = ids;
    });

    Object.entries(pool).forEach(([id, ab]) => {
      if (!ab || typeof ab !== 'object') return;
      if (!ab.id) ab.id = id;
      if (typeof ab.effect === 'string' || (ab.effect && !ab.effect.type && !Array.isArray(ab.effects))) {
        ab.effect = normalizeAbilityEffect(ab.effect);
      }
    });
  }

  function migrateScenes(data) {
    Object.values(data.scenes || {}).forEach((sc) => {
      if (!sc || typeof sc !== 'object') return;
      if (!Array.isArray(sc.editorModules) && (sc.text || sc.choices || sc.combat)) {
        // не форсируем editorModules — редактор выводит сам
      }
      // audio string → object
      if (typeof sc.audio === 'string') {
        sc.audio = { ambient: sc.audio, loop: true, volume: 0.7 };
      }
    });
  }

  function migrateQuests(data) {
    if (typeof QuestMigrate !== 'undefined' && typeof QuestMigrate.migrateAll === 'function') {
      if (data.questsVersion !== 2) { QuestMigrate.migrateAll(data); data.questsVersion = 2; }
      return;
    }
    if (typeof QuestMigrate !== 'undefined' && typeof QuestMigrate.normalizeAll === 'function') {
      QuestMigrate.normalizeAll(data);
    }
  }

  /**
   * Единая точка: data → актуальная схема.
   * Идемпотентна: повторный вызов безопасен.
   */
  function migrateProjectData(data) {
    if (!data || typeof data !== 'object') return data;
    if (!data.meta) data.meta = {};

    const from = parseInt(data.meta.dataVersion, 10) || 0;

    // v0/v1/v2 → v3
    if (from < 3) {
      migrateScenes(data);
      migrateQuests(data);
      Object.values(data.classes || {}).forEach(migrateAbilitiesInClass);
      if (data.progression?.abilities) {
        Object.values(data.progression.abilities).forEach((ab) => {
          if (ab && (typeof ab.effect === 'string' || (ab.effect && !ab.effect.type))) {
            ab.effect = normalizeAbilityEffect(ab.effect);
          }
        });
      }
      if (!data.meta.storyGraph) data.meta.storyGraph = { positions: {} };
    }

    // v3 → v4: умения классов → общий пул, классы хранят id
    if (from < 4) {
      migrateClassAbilitiesToPool(data);
    } else {
      // Идемпотентная нормализация на случай смешанных данных
      migrateClassAbilitiesToPool(data);
    }

    // v4 → v5: visual / ui / assets / unified events (Phase A)
    if (typeof ProjectSchema !== 'undefined' && typeof ProjectSchema.normalizeProjectAuthoring === 'function') {
      ProjectSchema.normalizeProjectAuthoring(data);
    }

    // playerCharacters is optional — do not auto-create a hero
    if (data.playerCharacters != null && typeof data.playerCharacters !== 'object') {
      data.playerCharacters = {};
    }

    data.meta.dataVersion = DATA_VERSION;
    if (!data.meta.version) data.meta.version = '1.0';
    return data;
  }

  function getDataVersion(data) {
    return parseInt(data?.meta?.dataVersion, 10) || 0;
  }

  global.ProjectDataSchema = {
    DATA_VERSION,
    migrateProjectData,
    migrateClassAbilitiesToPool,
    normalizeAbilityEffect,
    getDataVersion,
    validateProjectAuthoring(data) {
      if (typeof ProjectSchema !== 'undefined' && typeof ProjectSchema.validateProjectAuthoring === 'function') {
        return ProjectSchema.validateProjectAuthoring(data);
      }
      return { ok: true, issues: [] };
    },
    normalizeProjectAuthoring(data) {
      if (typeof ProjectSchema !== 'undefined' && typeof ProjectSchema.normalizeProjectAuthoring === 'function') {
        return ProjectSchema.normalizeProjectAuthoring(data);
      }
      return data;
    }
  };

  // Авто-хук GameEngine при наличии
  if (typeof global.GameEngine !== 'undefined') {
    // no-op: подключение через save-load / data load
  }
})(typeof window !== 'undefined' ? window : globalThis);
