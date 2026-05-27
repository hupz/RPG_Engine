// ============================================
// Реестр атомарных действий (Action Registry)
// ============================================

const ACTION_CATEGORIES = {
  inventory: { label: 'Инвентарь', icon: '📦' },
  economy: { label: 'Экономика', icon: '💰' },
  health: { label: 'Здоровье', icon: '❤️' },
  scene: { label: 'Сцены', icon: '🎭' },
  dialogue: { label: 'Диалог', icon: '🗣️' },
  combat: { label: 'Бой', icon: '⚔️' },
  effects: { label: 'Эффекты', icon: '🔮' },
  utility: { label: 'Универсальные', icon: '🧩' }
};

const ACTION_REGISTRY = {
  // ——— Инвентарь ———
  add_item: {
    id: 'add_item',
    name: 'Добавить предмет',
    category: 'inventory',
    params: [
      { name: 'itemId', type: 'select', source: 'items', label: 'Предмет' },
      { name: 'count', type: 'number', default: 1, label: 'Количество' }
    ],
    execute(engine, params) {
      const count = Math.max(1, parseInt(params.count, 10) || 1);
      const id = params.itemId;
      if (!id) return false;
      for (let i = 0; i < count; i++) engine.addItem(id);
      const name = engine.data?.items?.[id]?.name || id;
      engine.log(`📦 Получено: ${name} ×${count}`, 'log-heal');
      engine.updateStats?.();
      return true;
    }
  },

  remove_item: {
    id: 'remove_item',
    name: 'Удалить предмет',
    category: 'inventory',
    params: [
      { name: 'itemId', type: 'select', source: 'items', label: 'Предмет' },
      { name: 'count', type: 'number', default: 1, label: 'Количество' }
    ],
    returns: 'boolean',
    execute(engine, params) {
      const count = Math.max(1, parseInt(params.count, 10) || 1);
      const id = params.itemId;
      if (!id) return false;
      let removed = 0;
      for (let i = 0; i < count; i++) {
        const idx = engine.state.inventory.indexOf(id);
        if (idx === -1) break;
        engine.state.inventory.splice(idx, 1);
        removed++;
      }
      if (!removed) return false;
      if (!engine.state.inventory.includes(id)) engine.unequipItem?.(id, { silent: true });
      const name = engine.data?.items?.[id]?.name || id;
      engine.log(`📦 Потеряно: ${name} ×${removed}`, 'log-damage');
      engine.updateStats?.();
      return removed >= count;
    }
  },

  check_item: {
    id: 'check_item',
    name: 'Проверить наличие предмета',
    category: 'inventory',
    params: [
      { name: 'itemId', type: 'select', source: 'items', label: 'Предмет' },
      { name: 'count', type: 'number', default: 1, label: 'Минимум' }
    ],
    returns: 'boolean',
    execute(engine, params) {
      const need = Math.max(1, parseInt(params.count, 10) || 1);
      const have = (engine.state.inventory || []).filter((id) => id === params.itemId).length;
      return have >= need;
    }
  },

  // ——— Экономика ———
  add_gold: {
    id: 'add_gold',
    name: 'Дать золото',
    category: 'economy',
    params: [{ name: 'amount', type: 'number', default: 10, label: 'Количество' }],
    execute(engine, params) {
      const amount = Math.max(0, parseInt(params.amount, 10) || 0);
      engine.state.gold += amount;
      engine.updateStats?.();
      engine.log(`💰 +${amount} зм`, 'log-heal');
      return true;
    }
  },

  remove_gold: {
    id: 'remove_gold',
    name: 'Забрать золото',
    category: 'economy',
    params: [{ name: 'amount', type: 'number', default: 10, label: 'Количество' }],
    returns: 'boolean',
    execute(engine, params) {
      const amount = Math.max(0, parseInt(params.amount, 10) || 0);
      if (engine.state.gold < amount) return false;
      engine.state.gold -= amount;
      engine.updateStats?.();
      engine.log(`💰 −${amount} зм`, 'log-gold');
      return true;
    }
  },

  check_gold: {
    id: 'check_gold',
    name: 'Проверить золото',
    category: 'economy',
    params: [{ name: 'amount', type: 'number', default: 1, label: 'Минимум' }],
    returns: 'boolean',
    execute(engine, params) {
      const amount = Math.max(0, parseInt(params.amount, 10) || 0);
      return engine.state.gold >= amount;
    }
  },

  // ——— Здоровье ———
  heal: {
    id: 'heal',
    name: 'Вылечить',
    category: 'health',
    params: [
      { name: 'target', type: 'select', options: ['self', 'party'], label: 'Цель' },
      { name: 'amount', type: 'text', default: '2d4+2', label: 'Формула (2d4+2 или 10)' },
      { name: 'restoreResources', type: 'boolean', default: false, label: 'Восстановить ресурс' }
    ],
    execute(engine, params) {
      const amount = engine.parseRollAmount(params.amount);
      const target = params.target || 'self';
      if (target === 'party' && Array.isArray(engine.state.party) && engine.state.party.length) {
        engine.state.party.forEach((m) => {
          m.hp = Math.min(m.maxHp || m.hp, (m.hp || 0) + amount);
        });
      } else {
        engine.state.hp = Math.min(engine.state.maxHp, engine.state.hp + amount);
      }
      if (params.restoreResources) engine.restoreAllResources?.();
      engine.updateStats?.();
      engine.log(`❤️ Восстановлено ${amount} ОЗ`, 'log-heal');
      return true;
    }
  },

  damage: {
    id: 'damage',
    name: 'Нанести урон',
    category: 'health',
    params: [
      { name: 'target', type: 'select', options: ['self', 'enemy'], label: 'Цель' },
      { name: 'amount', type: 'text', default: '1d6', label: 'Формула' }
    ],
    execute(engine, params) {
      const amount = engine.parseRollAmount(params.amount);
      if (params.target === 'enemy' && engine.state.enemies?.length) {
        const e = engine.state.enemies[0];
        e.hp = Math.max(0, (e.hp || 0) - amount);
        engine.log(`💥 ${e.name}: −${amount} ОЗ`, 'log-damage');
        engine.renderCombat?.();
      } else {
        engine.takeDamage?.(amount) || (engine.state.hp = Math.max(0, engine.state.hp - amount));
        engine.log(`💥 Вы получили ${amount} урона`, 'log-damage');
        engine.updateStats?.();
      }
      return true;
    }
  },

  apply_effect: {
    id: 'apply_effect',
    name: 'Наложить эффект',
    category: 'health',
    params: [
      { name: 'target', type: 'select', options: ['self', 'enemy'], label: 'Цель' },
      { name: 'effect', type: 'text', default: 'poisoned', label: 'ID эффекта' },
      { name: 'duration', type: 'number', default: 3, label: 'Длительность (ходов)' }
    ],
    execute(engine, params) {
      const dur = parseInt(params.duration, 10) || 3;
      if (params.target === 'enemy' && engine.state.enemies?.[0]) {
        const holder = engine.state.enemies[0];
        if (typeof CombatEffects !== 'undefined' && CombatEffects.applyStatusEffect) {
          CombatEffects.applyStatusEffect(holder, params.effect, 'действие');
        } else {
          if (!holder.effects) holder.effects = [];
          holder.effects.push({ id: params.effect, turns: dur });
        }
      } else if (typeof CombatEffects !== 'undefined' && CombatEffects.applyStatusEffect) {
        CombatEffects.applyStatusEffect(engine.state, params.effect, 'действие');
      } else {
        if (!engine.state.statusEffects) engine.state.statusEffects = [];
        engine.state.statusEffects.push({ id: params.effect, turns: dur });
      }
      engine.log(`☠️ Эффект: ${params.effect} (${dur} ход.)`, 'log-dice');
      return true;
    }
  },

  remove_effect: {
    id: 'remove_effect',
    name: 'Снять эффект',
    category: 'health',
    params: [
      { name: 'target', type: 'select', options: ['self', 'enemy'], label: 'Цель' },
      { name: 'effect', type: 'text', label: 'ID эффекта' }
    ],
    execute(engine, params) {
      const eff = params.effect;
      if (params.target === 'enemy' && engine.state.enemies?.[0]?.effects) {
        engine.state.enemies[0].effects = engine.state.enemies[0].effects.filter(
          (e) => (e.id || e) !== eff
        );
      } else if (engine.state.statusEffects) {
        engine.state.statusEffects = engine.state.statusEffects.filter((e) => e.id !== eff);
      }
      if (engine.state.flags) delete engine.state.flags[`effect_${eff}`];
      engine.log(`✨ Снят эффект: ${eff}`, 'log-heal');
      return true;
    }
  },

  // ——— Сцены ———
  change_scene: {
    id: 'change_scene',
    name: 'Сменить сцену',
    category: 'scene',
    params: [{ name: 'sceneId', type: 'select', source: 'scenes', label: 'Сцена' }],
    execute(engine, params) {
      if (params.sceneId) engine.showScene(params.sceneId);
      return true;
    }
  },

  set_flag: {
    id: 'set_flag',
    name: 'Установить флаг',
    category: 'scene',
    params: [
      { name: 'flag', type: 'text', label: 'Название флага' },
      { name: 'value', type: 'select', options: [true, false, 'toggle'], label: 'Значение' }
    ],
    execute(engine, params) {
      if (!params.flag) return false;
      if (!engine.state.flags) engine.state.flags = {};
      let val = params.value;
      if (val === 'toggle') val = !engine.state.flags[params.flag];
      engine.state.flags[params.flag] = val;
      return true;
    }
  },

  check_flag: {
    id: 'check_flag',
    name: 'Проверить флаг',
    category: 'scene',
    params: [
      { name: 'flag', type: 'text', label: 'Флаг' },
      { name: 'expected', type: 'select', options: [true, false], label: 'Ожидается' }
    ],
    returns: 'boolean',
    execute(engine, params) {
      const actual = !!engine.state.flags?.[params.flag];
      const expected = params.expected === true || params.expected === 'true';
      return actual === expected;
    }
  },

  update_quest: {
    id: 'update_quest',
    name: 'Обновить квест',
    category: 'scene',
    params: [
      { name: 'questId', type: 'text', label: 'ID квеста' },
      { name: 'stage', type: 'text', label: 'Стадия (complete)' }
    ],
    execute(engine, params) {
      if (params.questId && params.stage != null) {
        engine.updateQuest?.(params.questId, params.stage);
      }
      return true;
    }
  },

  // ——— Диалог ———
  say: {
    id: 'say',
    name: 'Сказать (NPC)',
    category: 'dialogue',
    params: [
      { name: 'npcId', type: 'select', source: 'npcs', label: 'NPC' },
      { name: 'text', type: 'textarea', label: 'Текст' }
    ],
    execute(engine, params) {
      const npc = engine.data?.npcs?.[params.npcId];
      const icon = npc?.icon || '💬';
      const name = npc?.name || params.npcId || 'NPC';
      const body = params.text || '';
      engine.setText(`${icon} **${name}:** ${body}`);
      return true;
    }
  },

  show_choices: {
    id: 'show_choices',
    name: 'Показать выборы',
    category: 'dialogue',
    params: [{ name: 'choices', type: 'json', label: 'Выборы (JSON)' }],
    execute(engine, params) {
      const raw = params.choices;
      const list = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : []);
      const choices = list.map((c) => {
        if (typeof c === 'string') return { text: c };
        const ch = { text: c.text || c.label || '…', icon: c.icon };
        if (c.to) ch.to = c.to;
        if (c.chain) ch.action = `chain:${c.chain}`;
        if (c.action) ch.action = c.action;
        return ch;
      });
      engine.setChoices(choices);
      return true;
    }
  },

  // ——— Бой ———
  start_combat: {
    id: 'start_combat',
    name: 'Начать бой',
    category: 'combat',
    params: [
      { name: 'enemies', type: 'json', label: 'ID врагов (массив)' },
      { name: 'nextScene', type: 'select', source: 'scenes', label: 'Сцена после победы' }
    ],
    execute(engine, params) {
      const ids = Array.isArray(params.enemies) ? params.enemies : [params.enemies].filter(Boolean);
      const enemies = ids.map((eid) => {
        const e = engine.data?.enemies?.[eid];
        if (!e) return null;
        return {
          ...e,
          id: eid,
          maxHp: e.hp,
          creatureType: e.creatureType || engine.getDefaultCreatureType?.()
        };
      }).filter(Boolean);
      if (!enemies.length) return false;
      engine.startCombat(enemies, params.nextScene || null, ids);
      return true;
    }
  },

  end_combat: {
    id: 'end_combat',
    name: 'Закончить бой',
    category: 'combat',
    params: [{ name: 'victory', type: 'boolean', default: true, label: 'Победа' }],
    execute(engine, params) {
      if (!engine.state.combat) return false;
      if (params.victory !== false) {
        engine.endCombatVictory?.() || engine.fleeCombat?.();
      } else {
        engine.showScene?.('game_over');
      }
      return true;
    }
  },

  // ——— Эффекты / баффы ———
  apply_buff: {
    id: 'apply_buff',
    name: 'Бафф (усиление)',
    category: 'effects',
    params: [
      { name: 'stat', type: 'select', options: ['str', 'dex', 'con', 'int', 'wis', 'cha', 'ac', 'atk'], label: 'Характеристика' },
      { name: 'value', type: 'number', default: 1, label: 'Бонус' },
      { name: 'duration', type: 'number', default: 3, label: 'Длительность (ходов)' }
    ],
    execute(engine, params) {
      if (!engine.state.actionBuffs) engine.state.actionBuffs = [];
      engine.state.actionBuffs.push({
        stat: params.stat,
        value: Number(params.value) || 0,
        duration: parseInt(params.duration, 10) || 3
      });
      engine.log(`🔮 Бафф ${params.stat} +${params.value}`, 'log-combat');
      return true;
    }
  },

  // ——— Универсальные ———
  roll_dice: {
    id: 'roll_dice',
    name: 'Бросить кости',
    category: 'utility',
    params: [{ name: 'formula', type: 'text', default: '2d6', label: 'Формула' }],
    returns: 'number',
    execute(engine, params) {
      const n = engine.parseRollAmount(params.formula);
      engine.log(`🎲 Бросок ${params.formula} = ${n}`, 'log-dice');
      return n;
    }
  },

  check_skill: {
    id: 'check_skill',
    name: 'Проверка навыка',
    category: 'utility',
    params: [
      { name: 'skill', type: 'select', source: 'skills', label: 'Навык' },
      { name: 'dc', type: 'number', default: 12, label: 'Сложность (DC)' }
    ],
    returns: 'boolean',
    execute(engine, params) {
      const bonus = engine.getSkillBonus?.(params.skill) ?? 0;
      const roll = engine.d20();
      const total = roll + bonus;
      engine.log(`🎲 ${params.skill}: ${roll}+${bonus}=${total} vs DC ${params.dc}`, 'log-dice');
      return total >= (parseInt(params.dc, 10) || 12);
    }
  },

  random: {
    id: 'random',
    name: 'Случайное число',
    category: 'utility',
    params: [
      { name: 'min', type: 'number', default: 1, label: 'От' },
      { name: 'max', type: 'number', default: 100, label: 'До' }
    ],
    returns: 'number',
    execute(engine, params) {
      const min = parseInt(params.min, 10) || 1;
      const max = parseInt(params.max, 10) || 100;
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }
  },

  log: {
    id: 'log',
    name: 'Сообщение в лог',
    category: 'utility',
    params: [
      { name: 'message', type: 'textarea', label: 'Текст' },
      { name: 'type', type: 'select', options: ['info', 'success', 'warning', 'danger', 'heal', 'gold'], label: 'Тип' }
    ],
    execute(engine, params) {
      const cls = params.type === 'success' ? 'log-heal' : params.type === 'danger' ? 'log-damage' : `log-${params.type || 'info'}`;
      engine.log(params.message || '…', cls);
      return true;
    }
  },

  wait: {
    id: 'wait',
    name: 'Пауза',
    category: 'utility',
    params: [{ name: 'seconds', type: 'number', default: 1, label: 'Секунды' }],
    async execute(engine, params) {
      const ms = Math.max(0, (parseFloat(params.seconds) || 0) * 1000);
      if (ms > 0) await new Promise((r) => setTimeout(r, ms));
      return true;
    }
  },

  refresh_ui: {
    id: 'refresh_ui',
    name: 'Обновить UI сцены',
    category: 'utility',
    params: [],
    execute(engine) {
      engine.refreshSceneComponents?.();
      engine.updateStats?.();
      return true;
    }
  },

  roll_check: {
    id: 'roll_check',
    name: 'Проверка броска (d20 ≥ DC)',
    category: 'utility',
    params: [{ name: 'dc', type: 'number', default: 10, label: 'Сложность' }],
    returns: 'boolean',
    execute(engine, params) {
      const roll = engine.d20();
      const dc = parseInt(params.dc, 10) || 10;
      engine.log(`🎲 Бросок ${roll} vs DC ${dc}`, 'log-dice');
      return roll >= dc;
    }
  }
};

/** Список навыков для редактора */
const ACTION_SKILL_IDS = [
  'athletics', 'acrobatics', 'stealth', 'perception', 'insight', 'persuasion',
  'deception', 'intimidation', 'investigation', 'survival', 'arcana', 'history'
];

if (typeof window !== 'undefined') {
  window.ACTION_REGISTRY = ACTION_REGISTRY;
  window.ACTION_CATEGORIES = ACTION_CATEGORIES;
}
