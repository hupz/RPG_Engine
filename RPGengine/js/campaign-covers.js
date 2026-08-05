// Обложки кампаний: кэш, градиенты, извлечение из game_data

const CampaignCovers = {
  MEMORY_CACHE: new Map(),
  LS_PREFIX: 'rpg_cover_cache_v1_',
  MAX_UPLOAD_BYTES: 500 * 1024,
  ACCEPT_TYPES: new Set(['image/png', 'image/jpeg', 'image/jpg']),
  ACCEPT_EXT: /\.(png|jpe?g)$/i,

  hashString(str) {
    let h = 0;
    const s = String(str || '');
    for (let i = 0; i < s.length; i += 1) {
      h = ((h << 5) - h) + s.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  },

  gradientFromTitle(title) {
    const h = this.hashString(title);
    const hue1 = h % 360;
    const hue2 = (hue1 + 40 + (h % 80)) % 360;
    const sat = 48 + (h % 22);
    const light = 32 + (h % 14);
    return `linear-gradient(135deg, hsl(${hue1}, ${sat}%, ${light}%) 0%, hsl(${hue2}, ${sat + 8}%, ${light - 8}%) 100%)`;
  },

  getSceneImageCandidates(scene) {
    if (!scene || typeof scene !== 'object') return [];
    const found = [];
    const fields = ['cover', 'image', 'illustration', 'background', 'bg', 'bgImage', 'sceneImage'];
    fields.forEach((key) => {
      const v = scene[key];
      if (typeof v === 'string' && v.trim()) found.push(v.trim());
    });
    const text = String(scene.text || '');
    const patterns = [
      /!\[[^\]]*]\(([^)]+\.(?:png|jpe?g|webp)(?:\?[^)]*)?)\)/gi,
      /<img[^>]+src=["']([^"']+\.(?:png|jpe?g|webp)(?:\?[^"']*)?)["']/gi,
      /(https?:\/\/[^\s"'<>]+\.(?:png|jpe?g|webp)(?:\?[^\s"'<>]*)?)/gi,
      /(?:^|[\s("'"])([a-zA-Z0-9_./-]+\.(?:png|jpe?g|webp))/gi
    ];
    patterns.forEach((re) => {
      let m;
      const rx = new RegExp(re.source, re.flags);
      while ((m = rx.exec(text)) !== null) {
        const src = (m[1] || m[0] || '').trim().replace(/^["'(]+|["')]+$/g, '');
        if (src && !found.includes(src)) found.push(src);
      }
    });
    return found;
  },

  normalizeImageSrc(src) {
    if (!src || typeof src !== 'string') return null;
    const s = src.trim();
    if (/^data:image\//i.test(s)) return s;
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith('/')) return s;
    return s;
  },

  getFirstSceneId(data) {
    if (!data?.scenes) return null;
    if (data.scenes.village_hub) return 'village_hub';
    if (data.scenes.start) return 'start';
    const keys = Object.keys(data.scenes);
    return keys[0] || null;
  },

  findFirstSceneImage(data) {
    if (!data?.scenes) return null;
    const order = [];
    const first = this.getFirstSceneId(data);
    if (first) order.push(first);
    Object.keys(data.scenes).forEach((id) => {
      if (!order.includes(id)) order.push(id);
    });
    for (let i = 0; i < order.length; i += 1) {
      const scene = data.scenes[order[i]];
      const candidates = this.getSceneImageCandidates(scene);
      for (let j = 0; j < candidates.length; j += 1) {
        const norm = this.normalizeImageSrc(candidates[j]);
        if (norm) return norm;
      }
    }
    return null;
  },

  getCoverFromData(data) {
    const metaCover = data?.meta?.cover;
    if (typeof metaCover === 'string' && metaCover.trim()) {
      return metaCover.trim();
    }
    return this.findFirstSceneImage(data);
  },

  getCacheStorageKey(campaign) {
    return campaign?.cacheKey || campaign?.id || 'default';
  },

  readCachedGameData(cacheKey) {
    if (!cacheKey) return null;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  },

  getLsCover(cacheKey) {
    try {
      return localStorage.getItem(this.LS_PREFIX + cacheKey);
    } catch (_) {
      return null;
    }
  },

  setLsCover(cacheKey, src) {
    if (!cacheKey || !src) return;
    try {
      localStorage.setItem(this.LS_PREFIX + cacheKey, src);
    } catch (_) { /* quota */ }
  },

  clearCoverCache(cacheKey) {
    if (cacheKey) this.MEMORY_CACHE.delete(cacheKey);
    try {
      if (cacheKey) localStorage.removeItem(this.LS_PREFIX + cacheKey);
    } catch (_) { /* ignore */ }
  },

  clearAllCoverCaches() {
    this.MEMORY_CACHE.clear();
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(this.LS_PREFIX)) localStorage.removeItem(key);
      });
    } catch (_) { /* ignore */ }
  },

  resolveCoverPayload(campaign, data) {
    const src = this.getCoverFromData(data);
    if (src) {
      return { type: 'image', src };
    }
    return {
      type: 'gradient',
      gradient: this.gradientFromTitle(campaign?.title || campaign?.id || 'Game'),
      icon: '🎮'
    };
  },

  async getCoverForCampaign(campaign, fetchDataFn) {
    const cacheKey = this.getCacheStorageKey(campaign);
    if (this.MEMORY_CACHE.has(cacheKey)) {
      return this.MEMORY_CACHE.get(cacheKey);
    }

    const lsCover = this.getLsCover(cacheKey);
    if (lsCover) {
      const payload = { type: 'image', src: lsCover };
      this.MEMORY_CACHE.set(cacheKey, payload);
      return payload;
    }

    let data = this.readCachedGameData(cacheKey);
    if (!data && typeof fetchDataFn === 'function') {
      try {
        data = await fetchDataFn(campaign);
      } catch (_) {
        data = null;
      }
    }

    const payload = this.resolveCoverPayload(campaign, data);
    if (payload.type === 'image' && payload.src) {
      this.setLsCover(cacheKey, payload.src);
    }
    this.MEMORY_CACHE.set(cacheKey, payload);
    return payload;
  },

  applyToCardElement(coverEl, payload) {
    if (!coverEl || !payload) return;
    const img = coverEl.querySelector('.campaign-card-cover-img');
    const fallback = coverEl.querySelector('.campaign-card-cover-fallback');
    if (!img || !fallback) return;

    if (payload.type === 'image' && payload.src) {
      img.onload = () => {
        img.classList.add('is-loaded');
        fallback.classList.add('is-hidden');
      };
      img.onerror = () => {
        img.classList.remove('is-loaded');
        img.hidden = true;
        fallback.classList.remove('is-hidden');
        fallback.style.background = payload.fallbackGradient
          || this.gradientFromTitle(coverEl.dataset.coverTitle || '');
      };
      img.src = payload.src;
      img.hidden = false;
      img.alt = '';
      return;
    }

    img.hidden = true;
    img.classList.remove('is-loaded');
    fallback.classList.remove('is-hidden');
    fallback.style.background = payload.gradient || this.gradientFromTitle(coverEl.dataset.coverTitle || '');
    const icon = fallback.querySelector('.campaign-card-cover-icon');
    if (icon) icon.textContent = payload.icon || '🎮';
  },

  readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
      reader.readAsDataURL(file);
    });
  },

  dataUrlByteSize(dataUrl) {
    if (typeof dataUrl !== 'string') return 0;
    const base64 = dataUrl.split(',')[1] || '';
    return Math.ceil(base64.length * 0.75);
  },

  loadImageFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Некорректное изображение'));
      img.src = dataUrl;
    });
  },

  canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), type, quality);
    });
  },

  async compressToLimit(dataUrl, maxBytes, mimeType) {
    const img = await this.loadImageFromDataUrl(dataUrl);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const isJpeg = /jpe?g/i.test(mimeType);
    const outType = isJpeg ? 'image/jpeg' : 'image/png';
    let scale = 1;
    let quality = isJpeg ? 0.88 : undefined;
    const maxW = 1280;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      if (w > maxW) {
        const ratio = maxW / w;
        canvas.width = maxW;
        canvas.height = Math.round(h * ratio);
      } else {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await this.canvasToBlob(canvas, outType, quality);
      if (!blob) break;
      if (blob.size <= maxBytes) {
        return this.readFileAsDataUrl(blob);
      }
      if (isJpeg && quality > 0.5) {
        quality -= 0.1;
      } else {
        scale *= 0.82;
      }
    }
    throw new Error('Не удалось сжать изображение до 500 КБ');
  },

  async fileToCoverDataUrl(file) {
    if (!file) throw new Error('Файл не выбран');
    const type = (file.type || '').toLowerCase();
    if (!this.ACCEPT_TYPES.has(type) && !this.ACCEPT_EXT.test(file.name || '')) {
      throw new Error('Поддерживаются только PNG и JPG');
    }
    let dataUrl = await this.readFileAsDataUrl(file);
    const mime = type || ( /\.jpe?g$/i.test(file.name) ? 'image/jpeg' : 'image/png');
    if (this.dataUrlByteSize(dataUrl) > this.MAX_UPLOAD_BYTES) {
      dataUrl = await this.compressToLimit(dataUrl, this.MAX_UPLOAD_BYTES, mime);
    }
    if (this.dataUrlByteSize(dataUrl) > this.MAX_UPLOAD_BYTES) {
      throw new Error('Изображение больше 500 КБ даже после сжатия');
    }
    return dataUrl;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CampaignCovers };
}
