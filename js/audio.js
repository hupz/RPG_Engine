// ============================================
// ЗВУКОВОЙ ДВИЖОК — SFX + фоновая музыка (эмбиент)
// ============================================

const AudioEngine = {
  enabled: true,
  /** @deprecated используйте sfxVolume / musicVolume */
  volume: 0.75,
  musicVolume: 0.6,
  sfxVolume: 0.85,
  catalog: {},
  defaults: {},
  cache: new Map(),
  ctx: null,
  _unlockBound: false,
  _unlocked: false,

  _ambientEl: null,
  _ambientId: null,
  _ambientPath: null,
  _ambientSceneVolume: null,
  _ambientFadeGen: 0,
  _pendingAmbient: null,

  FADE_MS: 900,

  init(audioConfig) {
    const cfg = audioConfig || {};
    this.catalog = cfg.catalog || {};
    this.defaults = cfg.defaults || {};
    this.cache.clear();
    this.loadSettings();
    this.bindUnlock();
  },

  loadSettings() {
    try {
      const stored = localStorage.getItem('melnitsa_audio_enabled');
      if (stored !== null) this.enabled = stored === '1';
      const mv = localStorage.getItem('melnitsa_music_volume');
      const sv = localStorage.getItem('melnitsa_sfx_volume');
      if (mv != null) this.musicVolume = this.clamp01(parseFloat(mv));
      if (sv != null) this.sfxVolume = this.clamp01(parseFloat(sv));
    } catch (_) { /* ignore */ }
    this.volume = this.sfxVolume;
  },

  saveSettings() {
    try {
      localStorage.setItem('melnitsa_audio_enabled', this.enabled ? '1' : '0');
      localStorage.setItem('melnitsa_music_volume', String(this.musicVolume));
      localStorage.setItem('melnitsa_sfx_volume', String(this.sfxVolume));
    } catch (_) { /* ignore */ }
  },

  clamp01(n) {
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(1, n));
  },

  setMusicVolume(value) {
    this.musicVolume = this.clamp01(value);
    this.saveSettings();
    this.applyAmbientVolume();
  },

  setSfxVolume(value) {
    this.sfxVolume = this.clamp01(value);
    this.volume = this.sfxVolume;
    this.saveSettings();
  },

  getMusicVolume() {
    return this.enabled ? this.musicVolume : 0;
  },

  getSfxVolume() {
    return this.enabled ? this.sfxVolume : 0;
  },

  bindUnlock() {
    if (this._unlockBound) return;
    this._unlockBound = true;
    const unlock = () => {
      this.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('click', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true, passive: true });
    window.addEventListener('click', unlock, { once: true, passive: true });
  },

  setEnabled(on) {
    this.enabled = !!on;
    this.saveSettings();
    if (!on) this.stopAmbient(true);
    else this.applyAmbientVolume();
  },

  unlock() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const done = () => {
      this._unlocked = true;
      this.flushPendingAmbient();
    };
    if (ctx.state === 'suspended') {
      const p = ctx.resume();
      if (p && typeof p.then === 'function') p.then(done).catch(done);
      else done();
      return;
    }
    done();
  },

  flushPendingAmbient() {
    if (!this._pendingAmbient) return;
    const { id, opts } = this._pendingAmbient;
    this._pendingAmbient = null;
    this.playAmbient(id, opts);
  },

  ensureContext() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) this.ctx = new Ctx();
    }
    return this.ctx;
  },

  resolveEntry(soundId) {
    if (!soundId) return null;
    const entry = this.catalog[soundId];
    if (!entry) return { id: soundId, procedural: true };
    if (typeof entry === 'string') return { id: soundId, file: entry };
    return {
      id: soundId,
      file: entry.file || entry.path || null,
      volume: entry.volume,
      procedural: entry.procedural,
      loop: entry.loop
    };
  },

  /** Короткие эффекты (бой, UI) — громкость sfxVolume */
  playSFX(soundId, opts = {}) {
    if (!this.enabled || !soundId) return;
    this.unlock();
    const entry = this.resolveEntry(soundId);
    if (!entry) return;
    const base = opts.volume ?? entry.volume ?? 1;
    const vol = base * this.getSfxVolume();
    if (entry.file && !entry.procedural) {
      this.playFile(entry.file, vol, soundId);
    } else {
      this.playProcedural(soundId, vol);
    }
  },

  /** Алиас для совместимости */
  play(soundId, opts = {}) {
    return this.playSFX(soundId, opts);
  },

  applyAmbientVolume() {
    if (!this._ambientEl || !this._ambientId) return;
    const entry = this.resolveEntry(this._ambientId);
    const base = this._ambientSceneVolume ?? entry?.volume ?? 1;
    this._ambientEl.volume = this.clamp01(base * this.getMusicVolume());
  },

  _bumpFadeGen() {
    this._ambientFadeGen += 1;
    return this._ambientFadeGen;
  },

  _fadeVolume(el, from, to, durationMs, gen) {
    return new Promise(resolve => {
      if (!el || gen !== this._ambientFadeGen) {
        resolve();
        return;
      }
      const steps = Math.max(8, Math.floor(durationMs / 40));
      const stepMs = durationMs / steps;
      let i = 0;
      const tick = () => {
        if (gen !== this._ambientFadeGen || !el) {
          resolve();
          return;
        }
        i += 1;
        const t = i / steps;
        el.volume = this.clamp01(from + (to - from) * t);
        if (i >= steps) resolve();
        else setTimeout(tick, stepMs);
      };
      tick();
    });
  },

  /** Плавная остановка текущего эмбиента */
  stopAmbient(immediate = false) {
    const el = this._ambientEl;
    if (!el) {
      this._ambientId = null;
      this._ambientPath = null;
      return Promise.resolve();
    }
    const gen = this._bumpFadeGen();
    if (immediate || !this.enabled) {
      try {
        el.pause();
        el.currentTime = 0;
      } catch (_) { /* ignore */ }
      this._ambientEl = null;
      this._ambientId = null;
      this._ambientPath = null;
      return Promise.resolve();
    }
    const startVol = el.volume;
    return this._fadeVolume(el, startVol, 0, this.FADE_MS, gen).then(() => {
      if (gen !== this._ambientFadeGen) return;
      try {
        el.pause();
        el.currentTime = 0;
      } catch (_) { /* ignore */ }
      if (this._ambientEl === el) {
        this._ambientEl = null;
        this._ambientId = null;
        this._ambientPath = null;
      }
    });
  },

  /**
   * Фоновая музыка из catalog: loop + crossfade при смене трека.
   */
  playAmbient(soundId, opts = {}) {
    if (!this.enabled || !soundId) {
      return this.stopAmbient();
    }

    this.unlock();

    const entry = this.resolveEntry(soundId);
    if (!entry) return Promise.resolve();

    if (this._ambientId === soundId && this._ambientEl && !this._ambientEl.paused) {
      this.applyAmbientVolume();
      return Promise.resolve();
    }

    const path = entry.file || null;
    if (!path || entry.procedural) {
      this._ambientId = soundId;
      return Promise.resolve();
    }

    if (!this._unlocked) {
      this._pendingAmbient = { id: soundId, opts };
      return Promise.resolve();
    }

    const gen = this._bumpFadeGen();
    const baseVol = opts.volume ?? entry.volume ?? 1;
    this._ambientSceneVolume = opts.volume != null ? opts.volume : null;
    const targetVol = this.clamp01(baseVol * this.getMusicVolume());

    const startNew = () => {
      if (gen !== this._ambientFadeGen) return Promise.resolve();

      let base = this.cache.get('ambient:' + path);
      if (!base) {
        base = new Audio(path);
        base.preload = 'auto';
        this.cache.set('ambient:' + path, base);
      }
      const audio = base.cloneNode();
      audio.loop = opts.loop !== false;
      audio.volume = 0;
      this._ambientEl = audio;
      this._ambientId = soundId;
      this._ambientPath = path;

      const p = audio.play();
      const afterPlay = () => this._fadeVolume(audio, 0, targetVol, this.FADE_MS, gen);

      if (p && typeof p.then === 'function') {
        return p.then(afterPlay).catch(() => {
          this._ambientEl = null;
          this._ambientId = null;
          this._ambientPath = null;
        });
      }
      return afterPlay();
    };

    if (this._ambientEl) {
      const old = this._ambientEl;
      const oldVol = old.volume;
      return this._fadeVolume(old, oldVol, 0, this.FADE_MS, gen).then(() => {
        try {
          old.pause();
          old.currentTime = 0;
        } catch (_) { /* ignore */ }
        if (this._ambientEl === old) {
          this._ambientEl = null;
          this._ambientId = null;
          this._ambientPath = null;
        }
        return startNew();
      });
    }

    return startNew();
  },

  playFile(path, volume, fallbackId) {
    let base = this.cache.get(path);
    if (!base) {
      base = new Audio(path);
      base.preload = 'auto';
      this.cache.set(path, base);
    }
    const audio = base.cloneNode();
    audio.volume = this.clamp01(volume);
    const p = audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => this.playProcedural(fallbackId, volume));
    }
  },

  playProcedural(soundId, volume = 0.75) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const vol = Math.max(0.05, Math.min(1, volume));
    const master = ctx.createGain();
    master.gain.value = vol;
    master.connect(ctx.destination);

    const tone = (freq, type, start, dur, peak = 0.2) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(peak, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(start);
      osc.stop(start + dur + 0.05);
    };

    const noise = (start, dur, peak = 0.15, filterFreq = 800) => {
      const bufferSize = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = filterFreq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(peak, start);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      src.connect(filter);
      filter.connect(g);
      g.connect(master);
      src.start(start);
      src.stop(start + dur + 0.05);
    };

    const id = String(soundId).toLowerCase();

    if (id.includes('fire') || id === 'aoe_fire') {
      noise(t0, 0.12, 0.22, 1200);
      tone(180, 'sawtooth', t0, 0.25, 0.12);
      tone(90, 'sine', t0 + 0.05, 0.35, 0.18);
      return;
    }
    if (id.includes('cold') || id.includes('frost')) {
      tone(880, 'sine', t0, 0.2, 0.1);
      tone(660, 'triangle', t0 + 0.08, 0.35, 0.08);
      noise(t0, 0.15, 0.06, 4000);
      return;
    }
    if (id.includes('lightning') || id.includes('arcane') || id.includes('magic')) {
      tone(520, 'square', t0, 0.08, 0.06);
      tone(1040, 'sine', t0 + 0.04, 0.15, 0.1);
      tone(780, 'sine', t0 + 0.1, 0.2, 0.07);
      return;
    }
    if (id.includes('heal')) {
      tone(392, 'sine', t0, 0.25, 0.12);
      tone(523, 'sine', t0 + 0.12, 0.35, 0.1);
      tone(659, 'sine', t0 + 0.22, 0.4, 0.08);
      return;
    }
    if (id.includes('staff') || id.includes('blunt')) {
      noise(t0, 0.06, 0.2, 400);
      tone(120, 'sine', t0, 0.15, 0.25);
      return;
    }
    if (id.includes('slash') || id.includes('sword') || id.includes('cleave') || id.includes('physical')) {
      noise(t0, 0.05, 0.28, 2500);
      tone(2400, 'triangle', t0, 0.07, 0.04);
      tone(800, 'sine', t0 + 0.02, 0.1, 0.06);
      return;
    }
    if (id.includes('miss') || id.includes('whoosh')) {
      noise(t0, 0.08, 0.08, 600);
      return;
    }
    if (id.includes('buff') || id.includes('shield')) {
      tone(330, 'sine', t0, 0.2, 0.1);
      tone(440, 'sine', t0 + 0.1, 0.3, 0.08);
      return;
    }
    if (id.includes('crit')) {
      noise(t0, 0.08, 0.25, 1800);
      tone(660, 'sawtooth', t0, 0.15, 0.12);
      tone(990, 'sine', t0 + 0.06, 0.2, 0.1);
      return;
    }
    if (id.includes('radiant') || id.includes('smite')) {
      tone(440, 'sine', t0, 0.2, 0.14);
      tone(880, 'triangle', t0 + 0.08, 0.35, 0.1);
      return;
    }
    if (id.includes('necrotic')) {
      tone(110, 'sawtooth', t0, 0.4, 0.1);
      noise(t0, 0.25, 0.08, 300);
      return;
    }

    tone(440, 'sine', t0, 0.12, 0.08);
  }
};
