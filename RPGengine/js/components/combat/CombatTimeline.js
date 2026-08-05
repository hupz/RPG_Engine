/**
 * CombatTimeline — горизонтальная полоса порядка ходов в бою.
 * Использует state.combat (battleState) и combat.battleParticipants.
 * @module CombatTimeline
 */
(function (global) {
  'use strict';

  const DEFAULT_VISIBLE = 5;
  const UPCOMING_AFTER_CURRENT = 3;

  /** @typedef {object} BattleParticipant
   * @property {string} id
   * @property {'player'|'enemy'} type
   * @property {number} [enemyIndex]
   * @property {string} name
   * @property {string} icon
   * @property {number} initiative
   * @property {number} [die]
   * @property {number} [bonus]
   * @property {string} tooltip
   * @property {string[]} tooltipLines
   * @property {boolean} isCurrent
   * @property {boolean} isDelayed
   * @property {boolean} isReady
   * @property {boolean} isDead
   * @property {number} orderIndex
   */

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getSceneInitiativeRules(engine) {
    const sceneId = engine?.state?.scene;
    const scene = sceneId && engine?.data?.scenes?.[sceneId];
    const raw = scene?.combatInitiative || scene?.combatRules?.initiative || {};
    return {
      enemyBonus: Number(raw.enemyBonus ?? raw.enemyInitiativeBonus ?? 0) || 0,
      playerBonus: Number(raw.playerBonus ?? raw.playerInitiativeBonus ?? 0) || 0,
      ambush: !!(raw.ambush ?? raw.isAmbush),
      surpriseRound: !!(raw.surpriseRound ?? raw.surprise),
      enemiesActFirst: !!(raw.enemiesActFirst ?? raw.enemyFirst),
      ambushLabel: raw.ambushLabel || null
    };
  }

  function isOrderEntryAlive(engine, entry) {
    if (!entry) return false;
    if (entry.type === 'player') return (engine.state?.hp ?? 0) > 0;
    const enemy = engine.state?.enemies?.[entry.index];
    return enemy && enemy.hp > 0;
  }

  function getParticipantIcon(engine, entry) {
    if (entry.type === 'player') {
      const cls = engine.state?.classData || engine.data?.classes?.[engine.state?.className];
      return cls?.icon || '⚔️';
    }
    const enemy = engine.state?.enemies?.[entry.index];
    const tplId = engine.state?.combat?.enemies?.[entry.index] || engine.state?.combat?.enemyIds?.[entry.index];
    const tpl = tplId && engine.data?.enemies?.[tplId];
    return enemy?.icon || tpl?.icon || '💀';
  }

  function getParticipantName(engine, entry) {
    if (entry.type === 'player') {
      return engine.state?.charName || 'Герой';
    }
    const enemy = engine.state?.enemies?.[entry.index];
    return engine.getEnemyDisplayName
      ? engine.getEnemyDisplayName(enemy)
      : (enemy?.name || 'Враг');
  }

  /**
   * Формирует текст подсказки инициативы для участника.
   */
  function buildInitiativeTooltip(engine, entry, context) {
    const lines = [];
    const rules = context.rules;
    const order = context.order;
    const roll = entry.roll ?? 0;
    const die = entry.die;
    const bonus = entry.bonus;
    const name = getParticipantName(engine, entry);

    const sortedRolls = order.map((o) => o.roll ?? 0);
    const maxRoll = sortedRolls.length ? Math.max(...sortedRolls) : roll;
    const tied = sortedRolls.filter((r) => r === roll).length > 1;

    if (entry.type === 'player') {
      if (rules.surpriseRound || rules.enemiesActFirst) {
        lines.push('Сюрпризный раунд — враги ходят первыми');
      }
      if (rules.playerBonus) {
        lines.push(`Бонус сцены: +${rules.playerBonus} к инициативе`);
      }
      if (roll === maxRoll && !rules.enemiesActFirst) {
        lines.push(`Высшая инициатива (${roll})`);
      } else if (tied && roll === maxRoll) {
        lines.push(`Инициатива равна (${roll}), первым идёт игрок`);
      } else if (die != null && bonus != null) {
        lines.push(`Бросок: ${die} + ${bonus} = ${roll}`);
      } else {
        lines.push(`Инициатива: ${roll}`);
      }
    } else {
      if (rules.ambush || rules.enemyBonus) {
        const bonusVal = rules.enemyBonus || (rules.ambush ? 5 : 0);
        if (bonusVal) {
          lines.push(
            rules.ambushLabel ||
              `Засада: +${bonusVal} к инициативе в этой сцене`
          );
        }
      }
      if (rules.surpriseRound || rules.enemiesActFirst) {
        lines.push('Сюрпризный раунд — враги ходят первыми');
      }
      if (roll === maxRoll && !rules.enemiesActFirst) {
        lines.push(`Высшая инициатива (${roll}) — ${name}`);
      } else if (tied && entry === context.firstEnemyInOrder) {
        lines.push(`Инициатива равна (${roll}), среди врагов ходит первым`);
      } else if (die != null && bonus != null) {
        lines.push(`${name}: ${die} + ${bonus} = ${roll}`);
      } else {
        lines.push(`Инициатива ${name}: ${roll}`);
      }
    }

    if (entry.delayed) lines.push('Отложенный ход (Delay) — в конце очереди');
    if (entry.ready) lines.push('Подготовленное действие (Ready)');

    const tooltip = lines[0] || `Инициатива: ${roll}`;
    return { tooltip, tooltipLines: lines };
  }

  /**
   * Собирает battleParticipants из combat.order и состояния движка.
   */
  function buildBattleParticipants(engine, combat) {
    if (!combat?.order?.length) return [];

    const rules = getSceneInitiativeRules(engine);
    const order = combat.order;
    const turnIndex = Math.max(0, combat.turnIndex ?? 0);
    const firstEnemy = order.find((o) => o.type === 'enemy');

    return order.map((entry, orderIndex) => {
      const alive = isOrderEntryAlive(engine, entry);
      const tip = buildInitiativeTooltip(engine, entry, {
        rules,
        order,
        firstEnemyInOrder: firstEnemy
      });

      const position =
        entry.type === 'player'
          ? (typeof CombatPosition !== 'undefined'
              ? CombatPosition.getPlayerPosition(engine)
              : 'close')
          : (typeof CombatPosition !== 'undefined'
              ? CombatPosition.getEnemyPosition(engine, entry.index)
              : 'close');

      return {
        id: entry.type === 'player' ? 'player' : `enemy_${entry.index}`,
        type: entry.type,
        enemyIndex: entry.type === 'enemy' ? entry.index : undefined,
        name: getParticipantName(engine, entry),
        icon: getParticipantIcon(engine, entry),
        position,
        initiative: entry.roll ?? 0,
        die: entry.die,
        bonus: entry.bonus,
        tooltip: tip.tooltip,
        tooltipLines: tip.tooltipLines,
        isCurrent: orderIndex === turnIndex && alive,
        isDelayed: !!entry.delayed,
        isReady: !!entry.ready,
        isDead: !alive,
        orderIndex
      };
    });
  }

  /**
   * Очередь для отображения: текущий + следующие N живых участников.
   */
  function buildDisplayQueue(participants, turnIndex, maxVisible) {
    const alive = participants.filter((p) => !p.isDead);
    if (!alive.length) return [];

    const byOrder = [...participants]
      .filter((p) => !p.isDead)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    const n = byOrder.length;
    let startIdx = 0;
    for (let i = 0; i < n; i++) {
      if (byOrder[i].orderIndex === turnIndex || byOrder[i].isCurrent) {
        startIdx = i;
        break;
      }
    }
    const currentId = participants.find((p) => p.isCurrent)?.id
      || byOrder[startIdx]?.id;

    const queue = [];
    for (let k = 0; k < n && queue.length < maxVisible; k++) {
      const p = byOrder[(startIdx + k) % n];
      queue.push({
        ...p,
        isCurrent: p.id === currentId || (k === 0 && p.orderIndex === turnIndex),
        queuePosition: k
      });
    }
    return queue;
  }

  class CombatTimeline {
    /**
     * @param {object} options
     * @param {string} [options.hostId]
     * @param {HTMLElement} [options.host]
     */
    constructor(options = {}) {
      this.host =
        options.host ||
        (options.hostId ? document.getElementById(options.hostId) : null);
      this.root = null;
      this.track = null;
      this._lastSignature = '';
      this._cardRects = new Map();
      this.visibleCount = options.visibleCount ?? DEFAULT_VISIBLE;
      this.upcomingCount = options.upcomingCount ?? UPCOMING_AFTER_CURRENT;
    }

    static buildParticipants(engine, combat) {
      return buildBattleParticipants(engine, combat);
    }

    static syncBattleState(engine) {
      if (!engine?.state?.combat) return [];
      const participants = buildBattleParticipants(engine, engine.state.combat);
      engine.state.combat.battleParticipants = participants;
      return participants;
    }

    static getInstance() {
      return CombatTimeline._instance || null;
    }

    static attach(engine, options = {}) {
      let host = options.host || document.getElementById('combat-timeline-host');
      if (!host) {
        const gameContent = document.getElementById('game-content');
        host = document.createElement('div');
        host.id = 'combat-timeline-host';
        host.className = 'combat-timeline-host hidden';
        host.setAttribute('aria-label', 'Порядок ходов');
        const combatArea = document.getElementById('combat-area');
        if (gameContent && combatArea) {
          gameContent.insertBefore(host, combatArea);
        } else if (gameContent) {
          gameContent.prepend(host);
        } else {
          document.body.prepend(host);
        }
      }
      if (!CombatTimeline._instance) {
        CombatTimeline._instance = new CombatTimeline({ host });
      }
      CombatTimeline._instance.engine = engine;
      return CombatTimeline._instance;
    }

    ensureDom() {
      if (!this.host) return false;
      if (this.root) return true;

      this.host.innerHTML = '';
      this.root = document.createElement('div');
      this.root.className = 'combat-timeline';
      this.root.innerHTML = `
        <div class="combat-timeline__header">
          <span class="combat-timeline__title">Порядок ходов</span>
          <span class="combat-timeline__round" data-round></span>
        </div>
        <div class="combat-timeline__scroll">
          <div class="combat-timeline__track" role="list"></div>
        </div>
      `;
      this.host.appendChild(this.root);
      this.track = this.root.querySelector('.combat-timeline__track');
      this.roundEl = this.root.querySelector('[data-round]');
      return true;
    }

    hide() {
      this.host?.classList.add('hidden');
      this._lastSignature = '';
      this._cardRects.clear();
    }

    show() {
      this.host?.classList.remove('hidden');
    }

    /**
     * @param {object} battleState — state.combat
     * @param {object} engine — GameEngine
     */
    update(battleState, engine) {
      if (!battleState || !engine) {
        this.hide();
        return;
      }
      if (!this.ensureDom()) return;

      let participants =
        battleState.battleParticipants ||
        buildBattleParticipants(engine, battleState);
      if (typeof CombatPosition !== 'undefined') {
        participants = CombatPosition.syncParticipantPositions(engine, participants);
      }
      battleState.battleParticipants = participants;

      const turnIndex = battleState.turnIndex ?? 0;
      const maxShow = 1 + this.upcomingCount;
      const queue = buildDisplayQueue(participants, turnIndex, maxShow);

      if (!queue.length) {
        this.hide();
        return;
      }

      this.show();
      if (this.roundEl) {
        const round = battleState.round ?? 1;
        this.roundEl.textContent = `Раунд ${round}`;
      }

      const signature = queue
        .map((p) => `${p.id}:${p.isCurrent}:${p.isDelayed}:${p.isReady}:${p.initiative}`)
        .join('|');

      const animate = signature !== this._lastSignature && this._lastSignature !== '';
      this._lastSignature = signature;

      if (animate && this.track) {
        this.track.querySelectorAll('.combat-timeline__card').forEach((el) => {
          this._cardRects.set(el.dataset.participantId, el.getBoundingClientRect());
        });
      }

      const cards = queue.map((p, i) => this.renderCard(p, i === 0, engine));
      let html = cards[0] || '';
      if (cards.length > 1) {
        html += '<div class="combat-timeline__next-label">Далее</div>' + cards.slice(1).join('');
      }
      this.track.innerHTML = html;

      this.track.querySelectorAll('.combat-timeline__info').forEach((btn) => {
        const lines = (btn.dataset.tooltipLines || btn.dataset.tooltip || '')
          .split('|')
          .filter(Boolean);
        const text = lines.join('\n');
        btn.setAttribute('title', text);
        btn.setAttribute('aria-label', text || 'Подсказка инициативы');
      });

      if (animate) {
        requestAnimationFrame(() => this.runFlipAnimation());
      }
    }

    renderCard(p, isHead, engine) {
      const mod = [
        'combat-timeline__card',
        p.isCurrent || isHead ? 'combat-timeline__card--active' : '',
        p.isDelayed ? 'combat-timeline__card--delayed' : '',
        p.isReady ? 'combat-timeline__card--ready' : '',
        p.type === 'player' ? 'combat-timeline__card--player' : 'combat-timeline__card--enemy',
        p.queuePosition > 0 ? 'combat-timeline__card--upcoming' : ''
      ]
        .filter(Boolean)
        .join(' ');

      const showInfo =
        (p.isCurrent || isHead) &&
        (p.type === 'enemy' || p.queuePosition === 0);
      const linesAttr = escapeHtml((p.tooltipLines || [p.tooltip]).join('|'));

      return `
        <div class="${mod}"
             role="listitem"
             data-participant-id="${escapeHtml(p.id)}"
             data-order="${p.orderIndex}">
          ${
            showInfo
              ? `<button type="button" class="combat-timeline__info"
                    data-tooltip="${escapeHtml(p.tooltip)}"
                    data-tooltip-lines="${linesAttr}">ⓘ</button>`
              : ''
          }
          <div class="combat-timeline__portrait-wrap">
            <div class="combat-timeline__portrait" aria-hidden="true">${escapeHtml(p.icon)}</div>
            ${
              typeof StatusManager !== 'undefined' && engine
                ? StatusManager.renderTimelineBadges(engine, p)
                : ''
            }
          </div>
          <div class="combat-timeline__meta">
            <span class="combat-timeline__name">${escapeHtml(p.name)}</span>
            ${
              p.position && typeof CombatPosition !== 'undefined'
                ? CombatPosition.renderZoneBadge(p.position, 'combat-timeline__zone')
                : ''
            }
            <span class="combat-timeline__init" title="Инициатива">${escapeHtml(String(p.initiative))}</span>
          </div>
          ${p.isDelayed ? '<span class="combat-timeline__badge">Delay</span>' : ''}
          ${p.isReady ? '<span class="combat-timeline__badge combat-timeline__badge--ready">Ready</span>' : ''}
        </div>
      `;
    }

    runFlipAnimation() {
      if (!this.track) return;
      const cards = this.track.querySelectorAll('.combat-timeline__card');
      cards.forEach((el) => {
        const id = el.dataset.participantId;
        const first = this._cardRects.get(id);
        if (!first) {
          el.classList.add('combat-timeline__card--enter');
          return;
        }
        const last = el.getBoundingClientRect();
        const dx = first.left - last.left;
        if (Math.abs(dx) < 2) return;
        el.style.transform = `translateX(${dx}px)`;
        el.classList.add('combat-timeline__card--animating');
        requestAnimationFrame(() => {
          el.style.transform = '';
          el.addEventListener(
            'transitionend',
            () => {
              el.classList.remove('combat-timeline__card--animating');
            },
            { once: true }
          );
        });
      });
      this._cardRects.clear();
    }

    destroy() {
      this.hide();
      if (this.host) this.host.innerHTML = '';
      this.root = null;
      this.track = null;
      if (CombatTimeline._instance === this) CombatTimeline._instance = null;
    }
  }

  CombatTimeline._instance = null;
  CombatTimeline.buildBattleParticipants = buildBattleParticipants;
  CombatTimeline.getSceneInitiativeRules = getSceneInitiativeRules;

  global.CombatTimeline = CombatTimeline;
})(typeof window !== 'undefined' ? window : globalThis);
