// Локальная аналитика прохождения (только режим игры, без сервера)

const AnalyticsSystem = {
  STORAGE_PREFIX: 'rpg_analytics_v1_',
  MAX_SESSIONS: 80,
  MAX_PATH_SAMPLES: 30,

  isGamePage() {
    try {
      return !/\/editor\.html/i.test(window.location.pathname || '');
    } catch (_) {
      return true;
    }
  },

  slugify(text) {
    return String(text || 'project')
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'project';
  },

  getProjectKey(engine) {
    const e = engine || (typeof GameEngine !== 'undefined' ? GameEngine : null);
    const campaignId = e?.activeCampaignId
      || (typeof localStorage !== 'undefined' ? localStorage.getItem('rpg_active_campaign') : null)
      || 'default';
    const title = e?.data?.meta?.title || campaignId;
    return `${campaignId}_${this.slugify(title)}`;
  },

  storageKey(projectKey) {
    return this.STORAGE_PREFIX + (projectKey || 'default');
  },

  emptyStore(projectKey, meta = {}) {
    return {
      version: 1,
      projectKey,
      projectTitle: meta.projectTitle || '',
      campaignId: meta.campaignId || '',
      updatedAt: Date.now(),
      totalLaunches: 0,
      totalDeaths: 0,
      totalPlayMs: 0,
      sessionCount: 0,
      sceneVisits: {},
      choices: {},
      items: {},
      pathSamples: [],
      sessions: []
    };
  },

  loadStore(projectKey) {
    try {
      const raw = localStorage.getItem(this.storageKey(projectKey));
      if (!raw) return this.emptyStore(projectKey);
      const data = JSON.parse(raw);
      return { ...this.emptyStore(projectKey), ...data, sceneVisits: data.sceneVisits || {}, choices: data.choices || {}, items: data.items || {}, pathSamples: data.pathSamples || [], sessions: data.sessions || [] };
    } catch (_) {
      return this.emptyStore(projectKey);
    }
  },

  saveStore(projectKey, store) {
    try {
      store.updatedAt = Date.now();
      localStorage.setItem(this.storageKey(projectKey), JSON.stringify(store));
      return true;
    } catch (err) {
      console.warn('AnalyticsSystem: не удалось сохранить', err);
      return false;
    }
  },

  listProjectKeys() {
    const keys = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(this.STORAGE_PREFIX)) {
          keys.push(k.slice(this.STORAGE_PREFIX.length));
        }
      }
    } catch (_) { /* ignore */ }
    return keys.sort();
  },

  getStoreForEngine(engine) {
    const pk = this.getProjectKey(engine);
    return this.loadStore(pk);
  },

  _active: null,

  beginSession(engine) {
    if (!this.isGamePage() || !engine?.data) return null;
    const projectKey = this.getProjectKey(engine);
    const store = this.loadStore(projectKey);
    store.projectTitle = engine.data?.meta?.title || store.projectTitle || projectKey;
    store.campaignId = engine.activeCampaignId || store.campaignId || '';
    store.totalLaunches += 1;
    store.sessionCount += 1;

    const session = {
      id: 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      startedAt: Date.now(),
      endedAt: null,
      durationMs: 0,
      deaths: 0,
      scenes: [],
      choices: [],
      items: []
    };

    this._active = { projectKey, store, session, lastTick: Date.now() };
    this.saveStore(projectKey, store);
    return session.id;
  },

  endSession() {
    const act = this._active;
    if (!act) return;
    const now = Date.now();
    act.session.endedAt = now;
    act.session.durationMs = Math.max(0, now - act.session.startedAt);

    const store = act.store;
    store.totalPlayMs += act.session.durationMs;

    if (act.session.scenes.length) {
      const path = act.session.scenes.map((s) => s.sceneId);
      store.pathSamples.push(path);
      if (store.pathSamples.length > this.MAX_PATH_SAMPLES) {
        store.pathSamples = store.pathSamples.slice(-this.MAX_PATH_SAMPLES);
      }
    }

    store.sessions.push({
      id: act.session.id,
      startedAt: act.session.startedAt,
      endedAt: act.session.endedAt,
      durationMs: act.session.durationMs,
      deaths: act.session.deaths,
      sceneCount: act.session.scenes.length,
      choiceCount: act.session.choices.length,
      itemCount: act.session.items.length
    });
    if (store.sessions.length > this.MAX_SESSIONS) {
      store.sessions = store.sessions.slice(-this.MAX_SESSIONS);
    }

    this.saveStore(act.projectKey, store);
    this._active = null;
  },

  getProjectKeyFromMeta(meta, campaignIdOverride) {
    const campaignId = campaignIdOverride
      || (typeof localStorage !== 'undefined' ? localStorage.getItem('rpg_active_campaign') : null)
      || meta?.campaignId
      || 'default';
    const title = meta?.title || campaignId;
    return `${campaignId}_${this.slugify(title)}`;
  },

  recordScene(engine, sceneId) {
    if (!sceneId || !this._active) return;
    const act = this._active;
    if (act.projectKey !== this.getProjectKey(engine)) return;

    act.session.scenes.push({ sceneId, at: Date.now() });
    act.store.sceneVisits[sceneId] = (act.store.sceneVisits[sceneId] || 0) + 1;
    this.saveStore(act.projectKey, act.store);
  },

  recordChoice(engine, choice, choiceIndex) {
    if (!choice || !this._active) return;
    const act = this._active;
    if (act.projectKey !== this.getProjectKey(engine)) return;

    const sceneId = engine.state?.scene || '';
    const text = String(choice.text || choice.action || choice.to || '').trim().slice(0, 120);
    const key = `${sceneId}::${choiceIndex}::${text}`;
    act.session.choices.push({ sceneId, text, choiceIndex, at: Date.now() });
    act.store.choices[key] = (act.store.choices[key] || 0) + 1;
    this.saveStore(act.projectKey, act.store);
  },

  recordItem(engine, itemId) {
    if (!itemId || !this._active) return;
    const act = this._active;
    if (act.projectKey !== this.getProjectKey(engine)) return;

    act.session.items.push({ itemId, at: Date.now() });
    act.store.items[itemId] = (act.store.items[itemId] || 0) + 1;
    this.saveStore(act.projectKey, act.store);
  },

  recordDeath(engine) {
    if (!this._active) return;
    const act = this._active;
    if (act.projectKey !== this.getProjectKey(engine)) return;
    act.session.deaths += 1;
    act.store.totalDeaths += 1;
    this.saveStore(act.projectKey, act.store);
  },

  getAggregates(store) {
    const s = store || this.emptyStore();
    const sessions = s.sessions || [];
    const completed = sessions.filter((x) => x.durationMs > 0);
    const avgMs = completed.length
      ? Math.round(completed.reduce((a, b) => a + b.durationMs, 0) / completed.length)
      : 0;
    return {
      totalLaunches: s.totalLaunches || 0,
      totalDeaths: s.totalDeaths || 0,
      totalPlayMs: s.totalPlayMs || 0,
      sessionCount: s.sessionCount || 0,
      avgSessionMs: avgMs,
      sceneVisits: { ...(s.sceneVisits || {}) },
      choices: { ...(s.choices || {}) },
      items: { ...(s.items || {}) },
      pathSamples: [...(s.pathSamples || [])],
      sessions: [...sessions]
    };
  },

  formatDuration(ms) {
    const sec = Math.max(0, Math.round((ms || 0) / 1000));
    if (sec < 60) return sec + ' сек';
    const min = Math.floor(sec / 60);
    const rs = sec % 60;
    if (min < 60) return `${min} мин ${rs} сек`;
    const h = Math.floor(min / 60);
    return `${h} ч ${min % 60} мин`;
  },

  exportCsv(store) {
    const s = store || this.emptyStore();
    const lines = [];
    const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';

    lines.push('Раздел,Ключ,Значение,Дополнительно');

    lines.push(['Сводка', 'Запусков', s.totalLaunches, ''].map(esc).join(','));
    lines.push(['Сводка', 'Сессий', s.sessionCount, ''].map(esc).join(','));
    lines.push(['Сводка', 'Смертей', s.totalDeaths, ''].map(esc).join(','));
    lines.push(['Сводка', 'Время всего (мс)', s.totalPlayMs, this.formatDuration(s.totalPlayMs)].map(esc).join(','));

    const agg = this.getAggregates(s);
    lines.push(['Сводка', 'Среднее время сессии (мс)', agg.avgSessionMs, this.formatDuration(agg.avgSessionMs)].map(esc).join(','));

    Object.entries(s.sceneVisits || {}).sort((a, b) => b[1] - a[1]).forEach(([id, n]) => {
      lines.push(['Сцена', id, n, ''].map(esc).join(','));
    });

    Object.entries(s.choices || {}).sort((a, b) => b[1] - a[1]).forEach(([key, n]) => {
      const parts = key.split('::');
      lines.push(['Выбор', parts[0] || '', n, (parts[2] || parts[1] || '')].map(esc).join(','));
    });

    Object.entries(s.items || {}).sort((a, b) => b[1] - a[1]).forEach(([id, n]) => {
      lines.push(['Предмет', id, n, ''].map(esc).join(','));
    });

    (s.sessions || []).forEach((sess) => {
      lines.push(['Сессия', sess.id, sess.durationMs, this.formatDuration(sess.durationMs)].map(esc).join(','));
    });

    return '\uFEFF' + lines.join('\n');
  },

  downloadCsv(store, filename) {
    const csv = this.exportCsv(store);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'analytics_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  },

  attachGameHooks() {
    if (!this.isGamePage() || typeof GameEngine === 'undefined') return;
    if (GameEngine._analyticsHooksBound) return;
    GameEngine._analyticsHooksBound = true;

    const AS = this;
    let sessionStarted = false;

    const ensureSession = () => {
      if (sessionStarted && AS._active) return;
      sessionStarted = true;
      AS.beginSession(GameEngine);
    };

    const wrap = (name, after) => {
      const orig = GameEngine[name];
      if (typeof orig !== 'function') return;
      GameEngine[name] = function (...args) {
        const out = orig.apply(this, args);
        try { after.apply(this, args); } catch (e) { console.warn('analytics hook', name, e); }
        return out;
      };
    };

    wrap('startGame', function () {
      ensureSession();
    });

    wrap('loadGame', function () {
      ensureSession();
    });

    wrap('showScene', function (sceneId) {
      if (document.getElementById('game-content') && !document.getElementById('game-content').classList.contains('hidden')) {
        ensureSession();
      }
      if (sceneId) AS.recordScene(this, sceneId);
    });

    wrap('pickChoice', function (choiceIndex) {
      const choices = this.state?.currentChoices || [];
      const choice = choices[choiceIndex];
      if (choice) AS.recordChoice(this, choice, choiceIndex);
    });

    wrap('gameOver', function () {
      AS.recordDeath(this);
    });

    wrap('addItem', function (itemId) {
      if (itemId) AS.recordItem(this, itemId);
    });

    wrap('returnToCampaignPicker', function () {
      AS.endSession();
      sessionStarted = false;
    });

    wrap('resetGame', function () {
      AS.endSession();
      sessionStarted = false;
    });

    window.addEventListener('beforeunload', () => AS.endSession());
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AnalyticsSystem };
}

(function initAnalytics() {
  const run = () => AnalyticsSystem.attachGameHooks();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
