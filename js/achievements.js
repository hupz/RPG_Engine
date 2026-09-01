// Система достижений: каталог в data.achievements, прогресс в save

const AchievementSystem = {
  TEMPLATES: {
    visit_scene: 'Пройти сцену',
    collect_items: 'Собрать N предметов',
    defeat_boss: 'Победить босса (сцена боя)',
    defeat_enemy: 'Победить врага',
    quest_stage: 'Достичь стадии квеста',
    quest_complete: 'Завершить квест',
    flag: 'Флаг = значение'
  },

  ensureAchievements(data) {
    if (!data || typeof data !== 'object') return;
    if (!data.achievements || typeof data.achievements !== 'object') {
      data.achievements = {};
    }
  },

  normalize(ach, id) {
    if (!ach || typeof ach !== 'object') ach = {};
    const out = { ...ach };
    out.id = String(out.id || id || '').trim() || id;
    out.title = String(out.title || out.id || 'Достижение').trim();
    out.description = String(out.description || '').trim();
    out.icon = String(out.icon || '🏆').trim();
    out.secret = !!out.secret;
    out.sound = String(out.sound || 'buff').trim();

    if (!out.unlock || typeof out.unlock !== 'object') {
      out.unlock = { type: 'template', template: 'visit_scene', sceneId: 'start' };
    }
    const u = out.unlock;
    if (!u.type) {
      if (u.expression) u.type = 'expression';
      else if (u.rules || u.all || u.any) u.type = 'rules';
      else u.type = 'template';
    }
    return out;
  },

  normalizeAll(data) {
    this.ensureAchievements(data);
    Object.entries(data.achievements).forEach(([id, ach]) => {
      data.achievements[id] = this.normalize(ach, id);
    });
  },

  getCatalog(data) {
    this.ensureAchievements(data);
    return data.achievements || {};
  },

  ensureUnlockState(engine) {
    if (!engine?.state) return;
    if (!engine.state.achievementUnlocks || typeof engine.state.achievementUnlocks !== 'object') {
      engine.state.achievementUnlocks = {};
    }
  },

  isUnlocked(engine, achievementId) {
    this.ensureUnlockState(engine);
    return !!engine.state.achievementUnlocks[achievementId];
  },

  getUnlockedCount(engine) {
    this.ensureUnlockState(engine);
    const catalog = this.getCatalog(engine.data);
    const total = Object.keys(catalog).length;
    const unlocked = Object.keys(catalog).filter((id) => this.isUnlocked(engine, id)).length;
    return { unlocked, total };
  },

  countItem(inventory, itemId) {
    if (!itemId || !Array.isArray(inventory)) return 0;
    return inventory.filter((i) => i === itemId).length;
  },

  hasDefeatedEnemy(engine, enemyId) {
    if (!enemyId) return false;
    const cleared = engine.state.clearedCombats || {};
    for (const info of Object.values(cleared)) {
      if (info?.enemyIds?.includes(enemyId)) return true;
    }
    const scenes = engine.data?.scenes || {};
    for (const [sid, raw] of Object.entries(scenes)) {
      if (!raw?.combat?.includes(enemyId)) continue;
      if (typeof engine.isCombatSceneCleared === 'function' && engine.isCombatSceneCleared(sid)) {
        return true;
      }
    }
    if (engine.state.flags?.[`enemy_defeated_${enemyId}`]) return true;
    return false;
  },

  getQuestStage(engine, questId) {
    if (typeof engine.getQuestStage === 'function') {
      return engine.getQuestStage(questId);
    }
    return engine.state?.questStages?.[questId];
  },


  /**
   * Безопасный оценщик выражений достижений (без eval / new Function).
   * Поддержка: литералы, state/data/flags/…, сравнения, && || !, арифметика,
   * .length, .includes / indexOf / startsWith / endsWith / hasOwnProperty.
   */
  _safeExpr: {
    ALLOWED_ROOTS: {
      state: true, data: true, flags: true, inventory: true,
      questStages: true, sceneVisits: true, clearedCombats: true, achievementUnlocks: true
    },
    ALLOWED_METHODS: {
      includes: true, indexOf: true, startsWith: true, endsWith: true, hasOwnProperty: true
    },
    BANNED: {
      window: true, document: true, globalThis: true, self: true, top: true, parent: true,
      eval: true, Function: true, require: true, import: true, constructor: true,
      __proto__: true, prototype: true, process: true, global: true
    },

    tokenize(src) {
      const tokens = [];
      let i = 0;
      const s = String(src);
      const len = s.length;

      while (i < len) {
        const c = s[i];
        if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }

        if (s.startsWith('===', i) || s.startsWith('!==', i)) {
          tokens.push({ type: 'op', value: s.slice(i, i + 3), pos: i });
          i += 3; continue;
        }
        if (s.startsWith('==', i) || s.startsWith('!=', i) || s.startsWith('<=', i) ||
            s.startsWith('>=', i) || s.startsWith('&&', i) || s.startsWith('||', i)) {
          tokens.push({ type: 'op', value: s.slice(i, i + 2), pos: i });
          i += 2; continue;
        }

        if (c === '(') { tokens.push({ type: 'lparen', value: c, pos: i }); i++; continue; }
        if (c === ')') { tokens.push({ type: 'rparen', value: c, pos: i }); i++; continue; }
        if (c === '[') { tokens.push({ type: 'lbracket', value: c, pos: i }); i++; continue; }
        if (c === ']') { tokens.push({ type: 'rbracket', value: c, pos: i }); i++; continue; }
        if (c === ',') { tokens.push({ type: 'comma', value: c, pos: i }); i++; continue; }
        if (c === '.') { tokens.push({ type: 'dot', value: c, pos: i }); i++; continue; }
        if ('+-*/%!<>'.includes(c)) {
          tokens.push({ type: 'op', value: c, pos: i });
          i++; continue;
        }

        if (c === '"' || c === "'") {
          const quote = c;
          let j = i + 1;
          let out = '';
          while (j < len) {
            if (s[j] === '\\' && j + 1 < len) {
              const n = s[j + 1];
              const map = { n: '\n', t: '\t', r: '\r', "'": "'", '"': '"', '\\': '\\' };
              out += map[n] != null ? map[n] : n;
              j += 2; continue;
            }
            if (s[j] === quote) break;
            out += s[j];
            j++;
          }
          if (j >= len) throw new Error('Unknown syntax at position ' + i + ': unclosed string');
          tokens.push({ type: 'string', value: out, pos: i });
          i = j + 1; continue;
        }

        if (/[0-9]/.test(c)) {
          let j = i;
          while (j < len && /[0-9]/.test(s[j])) j++;
          if (j < len && s[j] === '.') {
            j++;
            while (j < len && /[0-9]/.test(s[j])) j++;
          }
          tokens.push({ type: 'number', value: Number(s.slice(i, j)), pos: i });
          i = j; continue;
        }

        if (/[A-Za-z_$]/.test(c)) {
          let j = i + 1;
          while (j < len && /[A-Za-z0-9_$]/.test(s[j])) j++;
          const id = s.slice(i, j);
          if (id === 'true') tokens.push({ type: 'literal', value: true, pos: i });
          else if (id === 'false') tokens.push({ type: 'literal', value: false, pos: i });
          else if (id === 'null') tokens.push({ type: 'literal', value: null, pos: i });
          else tokens.push({ type: 'ident', value: id, pos: i });
          i = j; continue;
        }

        throw new Error('Unknown syntax at position ' + i + ': ' + s.slice(i, i + 12));
      }
      tokens.push({ type: 'eof', value: '', pos: len });
      return tokens;
    },

    parse(src) {
      const tokens = this.tokenize(src);
      let pos = 0;
      const self = this;
      const peek = () => tokens[pos];
      const next = () => tokens[pos++];
      const expect = (type) => {
        const t = next();
        if (t.type !== type) {
          throw new Error('Unknown syntax at position ' + t.pos + ': expected ' + type + ', got ' + String(t.value));
        }
        return t;
      };

      function parseOr() {
        let left = parseAnd();
        while (peek().type === 'op' && peek().value === '||') {
          next();
          left = { type: 'Binary', op: '||', left, right: parseAnd() };
        }
        return left;
      }
      function parseAnd() {
        let left = parseEquality();
        while (peek().type === 'op' && peek().value === '&&') {
          next();
          left = { type: 'Binary', op: '&&', left, right: parseEquality() };
        }
        return left;
      }
      function parseEquality() {
        let left = parseCmp();
        while (peek().type === 'op' && ['==', '!=', '===', '!=='].includes(peek().value)) {
          const op = next().value;
          left = { type: 'Binary', op, left, right: parseCmp() };
        }
        return left;
      }
      function parseCmp() {
        let left = parseTerm();
        while (peek().type === 'op' && ['<', '>', '<=', '>='].includes(peek().value)) {
          const op = next().value;
          left = { type: 'Binary', op, left, right: parseTerm() };
        }
        return left;
      }
      function parseTerm() {
        let left = parseFactor();
        while (peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
          const op = next().value;
          left = { type: 'Binary', op, left, right: parseFactor() };
        }
        return left;
      }
      function parseFactor() {
        let left = parseUnary();
        while (peek().type === 'op' && (peek().value === '*' || peek().value === '/' || peek().value === '%')) {
          const op = next().value;
          left = { type: 'Binary', op, left, right: parseUnary() };
        }
        return left;
      }
      function parseUnary() {
        if (peek().type === 'op' && (peek().value === '!' || peek().value === '-' || peek().value === '+')) {
          const op = next().value;
          return { type: 'Unary', op, argument: parseUnary() };
        }
        return parsePostfix();
      }
      function parsePostfix() {
        let node = parsePrimary();
        while (true) {
          if (peek().type === 'dot') {
            next();
            const propTok = expect('ident');
            const prop = propTok.value;
            if (self.BANNED[prop]) {
              throw new Error('Unknown syntax at position ' + propTok.pos + ': forbidden property ' + prop);
            }
            if (peek().type === 'lparen') {
              if (!self.ALLOWED_METHODS[prop]) {
                throw new Error('Unknown syntax at position ' + propTok.pos + ': forbidden method ' + prop);
              }
              next();
              const args = [];
              if (peek().type !== 'rparen') {
                args.push(parseOr());
                while (peek().type === 'comma') {
                  next();
                  args.push(parseOr());
                }
              }
              expect('rparen');
              node = { type: 'Call', callee: node, method: prop, args };
            } else {
              node = { type: 'Member', object: node, property: prop, computed: false };
            }
          } else if (peek().type === 'lbracket') {
            next();
            const prop = parseOr();
            expect('rbracket');
            node = { type: 'Member', object: node, property: prop, computed: true };
          } else {
            break;
          }
        }
        return node;
      }
      function parsePrimary() {
        const t = peek();
        if (t.type === 'number' || t.type === 'string' || t.type === 'literal') {
          next();
          return { type: 'Literal', value: t.value };
        }
        if (t.type === 'ident') {
          next();
          if (self.BANNED[t.value]) {
            throw new Error('Unknown syntax at position ' + t.pos + ': forbidden identifier ' + t.value);
          }
          if (!self.ALLOWED_ROOTS[t.value]) {
            throw new Error('Unknown syntax at position ' + t.pos + ': unknown identifier ' + t.value);
          }
          return { type: 'Root', name: t.value };
        }
        if (t.type === 'lparen') {
          next();
          const e = parseOr();
          expect('rparen');
          return e;
        }
        throw new Error('Unknown syntax at position ' + t.pos + ': ' + String(t.value || t.type));
      }

      const ast = parseOr();
      if (peek().type !== 'eof') {
        throw new Error('Unknown syntax at position ' + peek().pos + ': unexpected ' + String(peek().value));
      }
      return ast;
    },

    evaluate(ast, env) {
      const self = this;
      function ev(node) {
        switch (node.type) {
          case 'Literal': return node.value;
          case 'Root': return env[node.name];
          case 'Member': {
            const obj = ev(node.object);
            if (obj == null) return undefined;
            const key = node.computed ? ev(node.property) : node.property;
            if (typeof key === 'string' && (self.BANNED[key] || key === 'constructor' || key === '__proto__' || key === 'prototype')) {
              throw new Error('Forbidden property: ' + key);
            }
            return obj[key];
          }
          case 'Call': {
            const obj = ev(node.callee);
            if (obj == null) return undefined;
            if (!self.ALLOWED_METHODS[node.method]) {
              throw new Error('Forbidden method: ' + node.method);
            }
            const fn = obj[node.method];
            if (typeof fn !== 'function') return undefined;
            const args = (node.args || []).map(ev);
            return fn.apply(obj, args);
          }
          case 'Unary': {
            const v = ev(node.argument);
            if (node.op === '!') return !v;
            if (node.op === '-') return -Number(v);
            if (node.op === '+') return +Number(v);
            return undefined;
          }
          case 'Binary': {
            const op = node.op;
            if (op === '&&') return ev(node.left) && ev(node.right);
            if (op === '||') return ev(node.left) || ev(node.right);
            const l = ev(node.left);
            const r = ev(node.right);
            switch (op) {
              case '==': return l == r;
              case '!=': return l != r;
              case '===': return l === r;
              case '!==': return l !== r;
              case '<': return l < r;
              case '>': return l > r;
              case '<=': return l <= r;
              case '>=': return l >= r;
              case '+': return l + r;
              case '-': return Number(l) - Number(r);
              case '*': return Number(l) * Number(r);
              case '/': return Number(l) / Number(r);
              case '%': return Number(l) % Number(r);
              default: throw new Error('Unknown operator: ' + op);
            }
          }
          default: throw new Error('Unknown AST node: ' + node.type);
        }
      }
      return ev(ast);
    },

    run(src, env) {
      return this.evaluate(this.parse(src), env);
    }
  },

  evaluateExpression(engine, expression) {
    const expr = String(expression || '').trim();
    if (!expr) return false;
    try {
      const state = engine.state || {};
      const env = {
        state,
        data: engine.data || {},
        flags: state.flags || {},
        inventory: state.inventory || [],
        questStages: state.questStages || {},
        sceneVisits: state.sceneVisits || {},
        clearedCombats: state.clearedCombats || {},
        achievementUnlocks: state.achievementUnlocks || {}
      };
      return !!this._safeExpr.run(expr, env);
    } catch (err) {
      console.warn('AchievementSystem: ошибка выражения', expr, err);
      return false;
    }
  },

  evaluateTemplate(engine, unlock) {
    const u = unlock || {};
    const tpl = u.template || 'visit_scene';

    if (tpl === 'visit_scene') {
      const sid = u.sceneId || u.scene;
      if (!sid) return false;
      return (engine.state.sceneVisits?.[sid] || 0) >= 1 || engine.state.scene === sid;
    }

    if (tpl === 'collect_items') {
      const itemId = u.itemId || u.item;
      const need = Math.max(1, parseInt(u.count, 10) || 1);
      return this.countItem(engine.state.inventory, itemId) >= need;
    }

    if (tpl === 'defeat_boss') {
      const sid = u.sceneId || u.scene;
      if (!sid) return false;
      if (engine.state.clearedCombats?.[sid]) return true;
      if (typeof engine.isCombatSceneCleared === 'function') return engine.isCombatSceneCleared(sid);
      return !!engine.state.flags?.[`combat_cleared_${sid}`];
    }

    if (tpl === 'defeat_enemy') {
      return this.hasDefeatedEnemy(engine, u.enemyId || u.enemy);
    }

    if (tpl === 'quest_stage') {
      const qid = u.questId || u.quest;
      const stage = u.stage != null ? String(u.stage) : '';
      if (!qid || !stage) return false;
      const cur = this.getQuestStage(engine, qid);
      if (stage === 'complete' || stage === '__finished__') {
        return cur === '__finished__' || cur === 'complete';
      }
      if (stage === 'failed' || stage === '__failed__') {
        return cur === '__failed__' || cur === 'failed';
      }
      return String(cur) === stage;
    }

    if (tpl === 'quest_complete') {
      const qid = u.questId || u.quest;
      if (!qid) return false;
      const cur = this.getQuestStage(engine, qid);
      return cur === '__finished__' || cur === 'complete';
    }

    if (tpl === 'flag') {
      const flag = u.flag;
      if (!flag) return false;
      const expected = u.equals != null ? u.equals : u.value;
      const actual = engine.state.flags?.[flag];
      if (typeof expected === 'boolean') return !!actual === expected;
      if (typeof expected === 'number') return Number(actual) === expected;
      return String(actual) === String(expected);
    }

    return false;
  },

  evaluateRules(engine, rules) {
    if (typeof ConditionSystem === 'undefined' || !rules) return false;
    const ctx = typeof engine.getConditionContext === 'function'
      ? engine.getConditionContext()
      : {
        flags: { ...(engine.state.flags || {}) },
        inventory: [...(engine.state.inventory || [])],
        gold: engine.state.gold ?? 0,
        className: engine.state.className || '',
        questStages: { ...(engine.state.questStages || {}) },
        quests: engine.data?.quests || {}
      };
    ctx.achievementUnlocks = { ...(engine.state.achievementUnlocks || {}) };
    return !!ConditionSystem.evaluate(rules, ctx);
  },

  evaluateUnlock(engine, ach) {
    if (!ach?.unlock) return false;
    const u = ach.unlock;
    if (u.type === 'expression') return this.evaluateExpression(engine, u.expression);
    if (u.type === 'rules') return this.evaluateRules(engine, u.rules || u);
    return this.evaluateTemplate(engine, u);
  },

  unlock(engine, achievementId, ach) {
    this.ensureUnlockState(engine);
    if (this.isUnlocked(engine, achievementId)) return false;

    const meta = this.normalize(ach || engine.data?.achievements?.[achievementId] || {}, achievementId);
    engine.state.achievementUnlocks[achievementId] = {
      unlockedAt: Date.now()
    };

    if (typeof engine.onAchievementUnlocked === 'function') {
      engine.onAchievementUnlocked(meta);
    }
    return true;
  },

  checkAll(engine, event) {
    if (!engine?.data) return [];
    this.normalizeAll(engine.data);
    this.ensureUnlockState(engine);

    const catalog = this.getCatalog(engine.data);
    const ids = Object.keys(catalog);
    if (!ids.length) return [];

    const unlockedNow = [];
    ids.forEach((id) => {
      if (this.isUnlocked(engine, id)) return;
      const ach = catalog[id];
      if (!this.evaluateUnlock(engine, ach)) return;
      if (this.unlock(engine, id, ach)) unlockedNow.push(id);
    });

    if (unlockedNow.length && typeof engine.renderAchievementsPanel === 'function') {
      engine.renderAchievementsPanel();
    }

    return unlockedNow;
  },

  getDisplayMeta(engine, achievementId, ach) {
    const meta = this.normalize(ach || engine.data?.achievements?.[achievementId] || {}, achievementId);
    const unlocked = this.isUnlocked(engine, achievementId);
    if (!unlocked && meta.secret) {
      return {
        id: achievementId,
        unlocked: false,
        secret: true,
        title: '???',
        description: 'Секретное достижение',
        icon: '❓'
      };
    }
    return {
      id: achievementId,
      unlocked,
      secret: !!meta.secret,
      title: meta.title,
      description: meta.description,
      icon: meta.icon
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AchievementSystem };
}
