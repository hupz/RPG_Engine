/**
 * CombatLog — журнал боя с раундами, иконками и цветовой дифференциацией.
 * API: CombatLog.add(type, data)
 * @module CombatLog
 */
(function (global) {
  'use strict';

  const TYPES = {
    damage: {
      icon: '💥',
      label: 'Урон',
      className: 'combat-log-entry--damage'
    },
    crit: {
      icon: '⚡',
      label: 'Крит',
      className: 'combat-log-entry--crit'
    },
    heal: {
      icon: '✨',
      label: 'Лечение',
      className: 'combat-log-entry--heal'
    },
    miss: {
      icon: '💨',
      label: 'Промах',
      className: 'combat-log-entry--miss'
    },
    fail: {
      icon: '✖',
      label: 'Провал',
      className: 'combat-log-entry--fail'
    },
    effect: {
      icon: '🔮',
      label: 'Эффект',
      className: 'combat-log-entry--effect'
    },
    status: {
      icon: '🛡️',
      label: 'Статус',
      className: 'combat-log-entry--effect'
    },
    buff: {
      icon: '📈',
      label: 'Бафф',
      className: 'combat-log-entry--buff'
    },
    debuff: {
      icon: '📉',
      label: 'Дебафф',
      className: 'combat-log-entry--effect'
    },
    combat: {
      icon: '⚔️',
      label: 'Бой',
      className: 'combat-log-entry--combat'
    },
    ability: {
      icon: '💫',
      label: 'Умение',
      className: 'combat-log-entry--ability'
    },
    attack: {
      icon: '⚔️',
      label: 'Атака',
      className: 'combat-log-entry--combat'
    },
    death: {
      icon: '☠️',
      label: 'Смерть',
      className: 'combat-log-entry--death'
    },
    info: {
      icon: 'ℹ️',
      label: 'Инфо',
      className: 'combat-log-entry--info'
    },
    round: {
      icon: '🔄',
      label: 'Раунд',
      className: 'combat-log-entry--round'
    },
    position: {
      icon: '↔️',
      label: 'Позиция',
      className: 'combat-log-entry--combat'
    }
  };

  const LEGACY_CLASS_MAP = {
    'log-damage': 'damage',
    'log-heal': 'heal',
    'log-combat': 'combat',
    'log-dice': 'info',
    'log-info': 'info'
  };

  const COMBAT_LOG_CLASSES = new Set(Object.keys(LEGACY_CLASS_MAP));

  let instance = null;

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function inferTypeFromMessage(text, fallback = 'info') {
    const t = String(text || '');
    const low = t.toLowerCase();
    if (/☠|повержен|убит|погиб|уничтожен|все враги|не дышит/.test(low)) {
      return 'death';
    }
    if (/крит|critical_success|критический успех/i.test(t)) return 'crit';
    if (/промах|autопровал|— промах|miss/i.test(low)) return 'miss';
    if (/провал|провален|failure|critical_failure/i.test(low)) return 'fail';
    if (/восстановлено|\+.*оз|лечение|heal|исцел/i.test(t)) return 'heal';
    if (/урон|💥|получает \d|damage/i.test(t)) return 'damage';
    if (/оглуш|яд|кровотеч|статус|status|эффект|концентрац/i.test(low)) {
      return 'effect';
    }
    if (/позици|frontline|backline|фронт|тыл|far|mid|close|дальн|средн|ближн/i.test(low)) return 'position';
    if (/умение|💫|заклинан|кара|ярость|огненный шар|magic_missile/i.test(low)) {
      return 'ability';
    }
    if (/атак|🎲|vs кд|попадание/i.test(low)) return 'attack';
    if (/❌|недостаточно|нельзя/i.test(low)) return 'fail';
    return fallback;
  }

  function isImportant(type, data, text) {
    if (data.important || data.highlight) return true;
    if (type === 'death' || type === 'crit') return true;
    const low = String(text).toLowerCase();
    if (/божественн|огненный шар|8d6|крит|☠|повержен/i.test(low)) return true;
    return false;
  }

  class CombatLog {
    constructor(options = {}) {
      this.hostId = options.hostId || 'combat-log-host';
      this.host = null;
      this.scrollEl = null;
      this.rounds = new Map();
      this.currentRound = 1;
      this.maxEntries = options.maxEntries ?? 400;
      this.autoCollapseOldRounds = options.autoCollapseOldRounds !== false;
      this.engine = null;
      this.active = false;
      this.reviewMode = false;
      this._entryCount = 0;
      this._hideTimer = null;
    }

    static getInstance() {
      return instance;
    }

    static attach(engine, options = {}) {
      if (!instance) {
        instance = new CombatLog(options);
      }
      instance.engine = engine;
      instance.ensureDom();
      return instance;
    }

    static isCombatLogClass(cls) {
      return COMBAT_LOG_CLASSES.has(cls);
    }

    static add(type, data = {}) {
      const log = CombatLog.attach(
        data.engine || (typeof GameEngine !== 'undefined' ? GameEngine : null)
      );
      return log.add(type, data);
    }

    static addFromLegacy(msg, cls, engine) {
      const log = CombatLog.attach(engine);
      let type = LEGACY_CLASS_MAP[cls] || 'info';
      const text = String(msg || '');
      if (type === 'damage' && /крит/i.test(text)) type = 'crit';
      if (type === 'info') type = inferTypeFromMessage(text, type);
      if (/промах/i.test(text)) type = 'miss';
      if (/провал/i.test(text) && type !== 'damage') type = 'fail';
      return log.add(type, {
        message: text,
        engine,
        round: engine?.state?.combat?.round
      });
    }

    /** Удобная обёртка для CombatManager */
    static log(engine, type, data = {}) {
      return CombatLog.add(type, { ...data, engine });
    }

    ensureDom() {
      let host = document.getElementById(this.hostId);
      if (!host) {
        const journal = document.getElementById('journal-wrap');
        const logEl = document.getElementById('log');
        host = document.createElement('div');
        host.id = this.hostId;
        host.className = 'combat-log-host hidden';
        host.setAttribute('aria-label', 'Журнал боя');
        if (journal && logEl) {
          journal.insertBefore(host, logEl);
        } else if (logEl?.parentNode) {
          logEl.parentNode.insertBefore(host, logEl);
        } else {
          document.body.appendChild(host);
        }
      }
      this.ensurePlacement();
      this.host = host;

      if (!host.querySelector('.combat-log')) {
        host.innerHTML = `
          <div class="combat-log">
            <div class="combat-log__toolbar">
              <span class="combat-log__title">📜 Журнал боя</span>
              <div class="combat-log__actions">
                <button type="button" class="combat-log__btn" data-action="collapse-old" title="Свернуть старые раунды">Свернуть старые</button>
                <button type="button" class="combat-log__btn" data-action="expand-all" title="Развернуть все">Развернуть</button>
                <button type="button" class="combat-log__btn combat-log__btn--dismiss hidden" data-action="dismiss" title="Скрыть журнал">Скрыть</button>
              </div>
            </div>
            <div class="combat-log__scroll" tabindex="0"></div>
          </div>`;
        this.scrollEl = host.querySelector('.combat-log__scroll');
        host.querySelector('[data-action="collapse-old"]')?.addEventListener(
          'click',
          () => this.collapseOldRounds()
        );
        host.querySelector('[data-action="expand-all"]')?.addEventListener(
          'click',
          () => this.expandAllRounds()
        );
        host.querySelector('[data-action="dismiss"]')?.addEventListener('click', () =>
          this.dismiss()
        );
      } else {
        this.scrollEl = host.querySelector('.combat-log__scroll');
      }
    }

    _cancelHideTimer() {
      if (this._hideTimer) {
        clearTimeout(this._hideTimer);
        this._hideTimer = null;
      }
    }

    hasEntries() {
      return this._entryCount > 0;
    }

    /** Журнал боя всегда внутри нижнего блока журнала (перед событиями). */
    ensurePlacement() {
      document.getElementById('combat-log-reopen-btn')?.remove();
      const journal = document.getElementById('journal-wrap');
      const logEl = document.getElementById('log');
      if (!journal || !logEl || !this.host) return;
      if (this.host.parentNode !== journal) {
        journal.insertBefore(this.host, logEl);
      } else if (this.host.nextElementSibling !== logEl) {
        journal.insertBefore(this.host, logEl);
      }
    }

    show() {
      this.ensureDom();
      this.ensurePlacement();
      this._cancelHideTimer();
      this.host?.classList.remove('hidden');
      this.active = true;
    }

    hide() {
      this._cancelHideTimer();
      this.host?.classList.add('hidden');
      this.active = false;
      this._updateDismissButton();
    }

    dismiss() {
      if (this.reviewMode) {
        this.hide();
        return;
      }
      this.hide();
    }

    enterArchiveMode() {
      if (!this.hasEntries()) {
        this.hide();
        return;
      }
      if (this.reviewMode) {
        this.ensureDom();
        this.ensurePlacement();
        this.host?.classList.remove('hidden', 'combat-log-host--live');
        this.host?.classList.add('combat-log-host--archive');
        return;
      }
      this.ensureDom();
      this.ensurePlacement();
      this._cancelHideTimer();
      this.active = false;
      this.reviewMode = true;
      this.host?.classList.remove('hidden', 'combat-log-host--live');
      this.host?.classList.add('combat-log-host--archive');
      this._updateTitle();
      this._updateDismissButton();
      this.collapseOldRounds(this.currentRound);
      this.scrollJournalIntoView();
    }

    /** @deprecated alias */
    enterReviewMode() {
      this.enterArchiveMode();
    }

    _updateTitle() {
      const title = this.host?.querySelector('.combat-log__title');
      if (!title) return;
      if (this.reviewMode) {
        title.textContent = '⚔️ Последний бой';
      } else if (this.active) {
        title.textContent = '⚔️ Бой';
      } else {
        title.textContent = '⚔️ Бой';
      }
    }

    _updateDismissButton() {
      const btn = this.host?.querySelector('[data-action="dismiss"]');
      if (!btn) return;
      btn.classList.toggle('hidden', !this.reviewMode);
      btn.title = this.reviewMode ? 'Свернуть блок боя' : 'Скрыть журнал';
    }

    scrollJournalIntoView() {
      const wrap = document.getElementById('journal-wrap');
      if (!wrap) return;
      requestAnimationFrame(() => {
        wrap.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    }

    clear() {
      this.rounds.clear();
      this._entryCount = 0;
      if (this.scrollEl) this.scrollEl.innerHTML = '';
    }

    startCombat(engine, round = 1) {
      this.engine = engine;
      this.ensureDom();
      this.ensurePlacement();
      this._cancelHideTimer();
      this.reviewMode = false;
      this.host?.classList.remove('combat-log-host--archive', 'combat-log-host--review');
      this.host?.classList.add('combat-log-host--live');
      this.clear();
      this.currentRound = round || 1;
      this.show();
      this._updateTitle();
      this._updateDismissButton();
      this.setRound(this.currentRound, { announce: true });
      this.add('combat', {
        message: '⚔️ Бой начался',
        important: true,
        round: this.currentRound
      });
    }

    endCombat() {
      this.add('combat', {
        message: '🏁 Бой завершён',
        important: true,
        round: this.currentRound
      });
    }

    /**
     * Завершение боя: запись «Бой завершён», блок остаётся внизу в общем журнале.
     * @param {{ keepReviewVisible?: boolean }} [opts]
     */
    finishCombatSession(opts = {}) {
      this._cancelHideTimer();
      this.endCombat();
      this.host?.classList.remove('combat-log-host--live', 'combat-log-host--review');
      if (opts.keepReviewVisible !== false) {
        this.enterArchiveMode();
        return;
      }
      this.reviewMode = false;
      this.hide();
    }

    setRound(round, opts = {}) {
      const r = Math.max(1, parseInt(round, 10) || 1);
      const prev = this.currentRound;
      this.currentRound = r;
      if (opts.announce && r > 1 && r !== prev) {
        this.add('round', {
          message: `Раунд ${r}`,
          round: r,
          important: false
        });
      }
      this.ensureRoundGroup(r);
      if (this.autoCollapseOldRounds) {
        this.collapseOldRounds(r);
      }
    }

    ensureRoundGroup(round) {
      const r = Math.max(1, parseInt(round, 10) || 1);
      if (this.rounds.has(r)) return this.rounds.get(r);

      const section = document.createElement('section');
      section.className = 'combat-log-round';
      section.dataset.round = String(r);
      const isCurrent = r === this.currentRound;
      section.classList.toggle('combat-log-round--current', isCurrent);
      if (!isCurrent && this.autoCollapseOldRounds) {
        section.classList.add('combat-log-round--collapsed');
      }

      section.innerHTML = `
        <button type="button" class="combat-log-round__head" aria-expanded="${isCurrent ? 'true' : 'false'}">
          <span class="combat-log-round__chevron" aria-hidden="true">▼</span>
          <span class="combat-log-round__label">Раунд ${r}</span>
          <span class="combat-log-round__count">0</span>
        </button>
        <div class="combat-log-round__body"></div>`;

      const head = section.querySelector('.combat-log-round__head');
      head.addEventListener('click', () => this.toggleRound(r));

      if (this.scrollEl) {
        this.scrollEl.appendChild(section);
      }

      const group = {
        round: r,
        el: section,
        body: section.querySelector('.combat-log-round__body'),
        countEl: section.querySelector('.combat-log-round__count'),
        count: 0
      };
      this.rounds.set(r, group);
      return group;
    }

    toggleRound(round) {
      const g = this.rounds.get(round);
      if (!g) return;
      const collapsed = g.el.classList.toggle('combat-log-round--collapsed');
      const head = g.el.querySelector('.combat-log-round__head');
      if (head) head.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }

    collapseOldRounds(keepRound) {
      const keep = keepRound ?? this.currentRound;
      this.rounds.forEach((g, r) => {
        if (r < keep) {
          g.el.classList.add('combat-log-round--collapsed');
          g.el.querySelector('.combat-log-round__head')?.setAttribute(
            'aria-expanded',
            'false'
          );
        }
      });
    }

    expandAllRounds() {
      this.rounds.forEach((g) => {
        g.el.classList.remove('combat-log-round--collapsed');
        g.el.querySelector('.combat-log-round__head')?.setAttribute(
          'aria-expanded',
          'true'
        );
      });
    }

    /**
     * @param {string} type — ключ из TYPES
     * @param {object} data
     * @param {string} [data.message] — текст записи
     * @param {string} [data.text] — alias message
     * @param {number} [data.round] — раунд (иначе текущий)
     * @param {boolean} [data.important]
     * @param {string} [data.actor]
     * @param {string} [data.target]
     * @param {number|string} [data.amount]
     */
    add(type, data = {}) {
      this.ensureDom();
      if (!this.active && this.engine?.state?.combat) {
        this.show();
        this.active = true;
      }

      const def = TYPES[type] || TYPES.info;
      const round =
        data.round ??
        data.engine?.state?.combat?.round ??
        this.engine?.state?.combat?.round ??
        this.currentRound;
      const r = Math.max(1, parseInt(round, 10) || 1);
      if (r !== this.currentRound) {
        this.setRound(r, { announce: r > this.currentRound });
      }

      const text = data.message ?? data.text ?? '';
      const important = isImportant(type, data, text);
      const group = this.ensureRoundGroup(r);

      const entry = document.createElement('div');
      entry.className = [
        'combat-log-entry',
        def.className,
        important ? 'combat-log-entry--important' : ''
      ]
        .filter(Boolean)
        .join(' ');

      const metaParts = [];
      if (data.actor) metaParts.push(escapeHtml(data.actor));
      if (data.target) metaParts.push('→ ' + escapeHtml(data.target));
      if (data.amount != null && data.amount !== '') {
        metaParts.push(`[${escapeHtml(String(data.amount))}]`);
      }

      entry.innerHTML = `
        <span class="combat-log-entry__icon" aria-hidden="true">${def.icon}</span>
        <div class="combat-log-entry__content">
          <span class="combat-log-entry__text">${escapeHtml(text)}</span>
          ${metaParts.length ? `<span class="combat-log-entry__meta">${metaParts.join(' ')}</span>` : ''}
        </div>`;

      group.body.appendChild(entry);
      group.count += 1;
      if (group.countEl) group.countEl.textContent = String(group.count);
      this._entryCount += 1;

      if (this._entryCount > this.maxEntries) {
        const firstKey = Math.min(...this.rounds.keys());
        const first = this.rounds.get(firstKey);
        if (first?.body?.firstChild) {
          first.body.removeChild(first.body.firstChild);
          first.count = Math.max(0, first.count - 1);
          if (first.countEl) first.countEl.textContent = String(first.count);
          this._entryCount -= 1;
        }
      }

      this.scrollToBottom();
      return entry;
    }

    scrollToBottom() {
      if (!this.scrollEl) return;
      requestAnimationFrame(() => {
        this.scrollEl.scrollTop = this.scrollEl.scrollHeight;
      });
    }
  }

  global.CombatLog = CombatLog;
  global.CombatLog.TYPES = TYPES;
})(typeof window !== 'undefined' ? window : globalThis);
