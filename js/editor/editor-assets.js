// ============================================================
// Phase B — Asset Browser: registry, grid, usage, drag & drop
// ============================================================
(function attachEditorAssets() {
  'use strict';

  if (typeof Editor === 'undefined') {
    console.warn('[editor-assets] Editor missing');
    return;
  }

  const ASSET_DRAG_MIME = (typeof ProjectSchema !== 'undefined' && ProjectSchema.ASSET_DRAG_MIME)
    ? ProjectSchema.ASSET_DRAG_MIME
    : 'application/x-rpgengine-asset';

  const TYPE_LABELS = {
    image: '🖼 Изображение',
    audio: '🔊 Аудио',
    font: '🔤 Шрифт',
    data: '📄 Данные'
  };

  function esc(s) {
    return typeof Editor.escapeHtml === 'function'
      ? Editor.escapeHtml(String(s == null ? '' : s))
      : String(s == null ? '' : s);
  }

  function escAttr(s) {
    return typeof Editor.escapeAttr === 'function'
      ? Editor.escapeAttr(String(s == null ? '' : s))
      : esc(s);
  }

  function ensureAssets() {
    if (!Editor.data) return null;
    if (typeof ProjectSchema !== 'undefined' && ProjectSchema.ensureProjectAssets) {
      return ProjectSchema.ensureProjectAssets(Editor.data);
    }
    if (!Editor.data.assets) Editor.data.assets = {};
    return Editor.data.assets;
  }

  function getAssetList() {
    if (typeof ProjectSchema !== 'undefined' && ProjectSchema.listRegistryAssets) {
      return ProjectSchema.listRegistryAssets(Editor.data || {});
    }
    return [];
  }

  function getUsage(assetId) {
    if (typeof ProjectSchema !== 'undefined' && ProjectSchema.scanAssetUsage) {
      return ProjectSchema.scanAssetUsage(Editor.data || {}, assetId);
    }
    return [];
  }

  function parseDragPayload(dt) {
    if (typeof ProjectSchema !== 'undefined' && ProjectSchema.parseAssetDragPayload) {
      return ProjectSchema.parseAssetDragPayload(dt);
    }
    try {
      const raw = dt.getData(ASSET_DRAG_MIME);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function assetDragPayload(asset) {
    return JSON.stringify({
      id: asset.id,
      src: asset.src,
      name: asset.name,
      type: asset.type || 'image'
    });
  }

  Object.assign(Editor, {
    ASSET_DRAG_MIME,

    getProjectAssetList() {
      return getAssetList();
    },

    scanAssetUsage(assetId) {
      return getUsage(assetId);
    },

    selectAssetToEdit(id) {
      Editor._editingAssetId = id;
      Editor.renderMediaAssets && Editor.renderMediaAssets();
    },

    registerProjectAsset(id, entry) {
      if (!Editor.data) return null;
      let aid = id;
      if (typeof ProjectSchema !== 'undefined' && ProjectSchema.registerAsset) {
        aid = ProjectSchema.registerAsset(Editor.data, id, entry);
      } else {
        ensureAssets();
        aid = id || ('asset_' + Date.now().toString(36));
        Editor.data.assets[aid] = entry;
      }
      Editor._editingAssetId = aid;
      Editor.updateJSONPreview && Editor.updateJSONPreview();
      Editor.renderMediaAssets && Editor.renderMediaAssets();
      Editor.scheduleValidation && Editor.scheduleValidation();
      return aid;
    },

    updateProjectAsset(id, field, value) {
      const bag = ensureAssets();
      if (!bag || !bag[id]) return;
      const a = bag[id];
      if (typeof a === 'string') {
        bag[id] = { type: 'image', src: a, name: id };
      }
      if (field === 'tags') {
        bag[id].tags = String(value || '').split(',').map((t) => t.trim()).filter(Boolean);
      } else {
        bag[id][field] = value;
      }
      if (field === 'src' && !bag[id].type) {
        bag[id].type = (typeof ProjectSchema !== 'undefined' && ProjectSchema.inferAssetType)
          ? ProjectSchema.inferAssetType(value)
          : 'image';
      }
      Editor.updateJSONPreview && Editor.updateJSONPreview();
      Editor.renderMediaAssets && Editor.renderMediaAssets();
    },

    async deleteProjectAsset(id) {
      if (!id || !Editor.data?.assets?.[id]) return;
      const usages = getUsage(id);
      if (usages.length && !(await Editor.confirmDialog({ message: 'Asset используется в ' + usages.length + ' мест(ах). Удалить из каталога?' }))) return;
      delete Editor.data.assets[id];
      if (Editor._editingAssetId === id) Editor._editingAssetId = null;
      Editor.updateJSONPreview && Editor.updateJSONPreview();
      Editor.renderMediaAssets && Editor.renderMediaAssets();
    },

    async addProjectAssetFromPath() {
      const src = await Editor.promptDialog({ message: 'Путь к файлу (например assets/images/village.svg):', defaultValue: 'assets/images/' });
      if (!src || !src.trim()) return;
      const name = await Editor.promptDialog({ message: 'Название:', defaultValue: src.split('/').pop() || 'asset' });
      const slug = (typeof ProjectSchema !== 'undefined' && ProjectSchema.slugifyAssetId)
        ? ProjectSchema.slugifyAssetId(name, Editor.data?.assets || {})
        : ('asset_' + Date.now().toString(36).slice(-6));
      const type = (typeof ProjectSchema !== 'undefined' && ProjectSchema.inferAssetType)
        ? ProjectSchema.inferAssetType(src)
        : 'image';
      Editor.registerProjectAsset(slug, { type, src: src.trim(), name: name || slug });
    },

    importProjectAssetFile(file) {
      if (!file) return;
      const name = file.name || 'asset';
      const slug = (typeof ProjectSchema !== 'undefined' && ProjectSchema.slugifyAssetId)
        ? ProjectSchema.slugifyAssetId(name.replace(/\.[^.]+$/, ''), Editor.data?.assets || {})
        : ('asset_' + Date.now().toString(36).slice(-6));
      const relPath = 'assets/images/' + name;
      const isImage = /^image\//.test(file.type || '');
      if (isImage && file.size < 512000) {
        const reader = new FileReader();
        reader.onload = function () {
          Editor.registerProjectAsset(slug, {
            type: 'image',
            src: reader.result,
            name: name.replace(/\.[^.]+$/, ''),
            tags: ['imported']
          });
        };
        reader.readAsDataURL(file);
        return;
      }
      Editor.registerProjectAsset(slug, {
        type: (typeof ProjectSchema !== 'undefined' && ProjectSchema.inferAssetType)
          ? ProjectSchema.inferAssetType(relPath, /^audio\//.test(file.type) ? 'audio' : undefined)
          : 'image',
        src: relPath,
        name: name.replace(/\.[^.]+$/, ''),
        tags: ['imported']
      });
      Editor.toast.info('Файл зарегистрирован как «' + relPath + '». Скопируйте файл в папку проекта для экспорта.');
    },

    /** Bind drop target for assets onto visual/UI viewport */
    bindAssetDropTarget(el, onDrop) {
      if (!el || el._assetDropBound) return;
      el._assetDropBound = true;
      el.addEventListener('dragover', function (e) {
        if (e.dataTransfer && e.dataTransfer.types && (
          e.dataTransfer.types.indexOf(ASSET_DRAG_MIME) >= 0 ||
          e.dataTransfer.types.includes(ASSET_DRAG_MIME)
        )) {
          e.preventDefault();
          el.classList.add('is-asset-drop-target');
        }
      });
      el.addEventListener('dragleave', function () {
        el.classList.remove('is-asset-drop-target');
      });
      el.addEventListener('drop', function (e) {
        el.classList.remove('is-asset-drop-target');
        const payload = parseDragPayload(e.dataTransfer);
        if (!payload) return;
        e.preventDefault();
        e.stopPropagation();
        if (typeof onDrop === 'function') onDrop(payload, e);
      });
    },

    renderMediaAssets() {
      const root = document.getElementById('media-assets-editor');
      if (!root) return;
      if (!Editor.data) {
        root.innerHTML = '<div class="empty-state"><h2>Нет данных</h2></div>';
        return;
      }

      ensureAssets();
      const filterType = Editor._assetFilterType || 'all';
      const query = String(Editor._assetSearchQuery || '').trim().toLowerCase();
      let assets = getAssetList();
      if (filterType !== 'all') assets = assets.filter((a) => a.type === filterType);
      if (query) {
        assets = assets.filter((a) => {
          const hay = ((a.id || '') + ' ' + (a.name || '') + ' ' + (a.src || '') + ' ' + (a.tags || []).join(' ')).toLowerCase();
          return hay.indexOf(query) >= 0;
        });
      }

      const activeId = Editor._editingAssetId;
      if (activeId && !assets.find((a) => a.id === activeId)) {
        const extra = getAssetList().find((a) => a.id === activeId);
        if (extra) assets.unshift(extra);
      }
      if (!activeId && assets.length) Editor._editingAssetId = assets[0].id;
      const detail = Editor._editingAssetId ? Editor.renderAssetDetail(Editor._editingAssetId) : '';

      const typeOpts = ['all', 'image', 'audio', 'font', 'data'].map((t) => {
        const label = t === 'all' ? 'Все типы' : (TYPE_LABELS[t] || t);
        return '<option value="' + t + '"' + (filterType === t ? ' selected' : '') + '>' + esc(label) + '</option>';
      }).join('');

      const cards = assets.length
        ? assets.map((a) => {
            const active = a.id === Editor._editingAssetId ? ' is-active' : '';
            const thumb = a.type === 'image' && a.src
              ? '<div class="asset-card-thumb" style="background-image:url(\'' + escAttr(a.src) + '\')"></div>'
              : '<div class="asset-card-thumb asset-card-thumb--placeholder">' + esc(TYPE_LABELS[a.type]?.[0] || '📄') + '</div>';
            const orphan = a.orphan ? '<span class="hint"> (не в каталоге)</span>' : '';
            return '<div class="asset-card' + active + '" draggable="true" data-asset-id="' + escAttr(a.id) + '">' +
              thumb +
              '<div class="asset-card-meta"><strong>' + esc(a.name || a.id) + '</strong>' + orphan +
              '<div class="hint">' + esc(a.src || '') + '</div></div></div>';
          }).join('')
        : '<p class="hint">Нет ассетов. Добавьте файл или укажите путь.</p>';

      root.innerHTML =
        '<div class="asset-browser-wrap">' +
        '<div class="asset-browser-toolbar">' +
        '<h3 style="margin:0">🖼 Ассеты проекта</h3>' +
        '<input type="search" id="asset-search" placeholder="Поиск…" value="' + escAttr(Editor._assetSearchQuery || '') + '">' +
        '<select id="asset-type-filter">' + typeOpts + '</select>' +
        '<button type="button" class="btn btn-primary" id="asset-add-path">+ По пути</button>' +
        '<button type="button" class="btn btn-secondary" id="asset-add-file">📁 Файл</button>' +
        '<input type="file" id="asset-file-input" accept="image/*,audio/*,.svg,.webp,.png,.jpg,.jpeg,.gif,.mp3,.ogg,.wav" hidden>' +
        '</div>' +
        '<p class="hint">Перетащите карточку на Visual Scene или Игровой UI — создастся элемент с картинкой.</p>' +
        '<div class="asset-browser-body">' +
        '<div class="asset-grid" id="asset-grid">' + cards + '</div>' +
        '<div class="asset-detail-panel">' + detail + '</div>' +
        '</div></div>';

      root.querySelector('#asset-search')?.addEventListener('input', function (e) {
        Editor._assetSearchQuery = e.target.value;
        Editor.renderMediaAssets();
      });
      root.querySelector('#asset-type-filter')?.addEventListener('change', function (e) {
        Editor._assetFilterType = e.target.value;
        Editor.renderMediaAssets();
      });
      root.querySelector('#asset-add-path')?.addEventListener('click', () => Editor.addProjectAssetFromPath());
      root.querySelector('#asset-add-file')?.addEventListener('click', () => {
        root.querySelector('#asset-file-input')?.click();
      });
      root.querySelector('#asset-file-input')?.addEventListener('change', function (e) {
        const f = e.target.files && e.target.files[0];
        if (f) Editor.importProjectAssetFile(f);
        e.target.value = '';
      });

      root.querySelectorAll('.asset-card[draggable]').forEach((card) => {
        card.addEventListener('dragstart', function (e) {
          const id = card.getAttribute('data-asset-id');
          const asset = getAssetList().find((a) => a.id === id) || Editor.data?.assets?.[id];
          if (!asset || !e.dataTransfer) return;
          const payload = {
            id,
            src: typeof asset === 'string' ? asset : (asset.src || id),
            name: typeof asset === 'string' ? id : (asset.name || id),
            type: typeof asset === 'string' ? 'image' : (asset.type || 'image')
          };
          e.dataTransfer.setData(ASSET_DRAG_MIME, assetDragPayload(payload));
          e.dataTransfer.effectAllowed = 'copy';
        });
        card.addEventListener('click', function () {
          Editor.selectAssetToEdit(card.getAttribute('data-asset-id'));
        });
      });

      root.querySelectorAll('[data-asset-field]').forEach((inp) => {
        inp.addEventListener('change', function () {
          const id = inp.getAttribute('data-asset-id');
          const field = inp.getAttribute('data-asset-field');
          Editor.updateProjectAsset(id, field, inp.value);
        });
      });
      root.querySelector('[data-action="delete-asset"]')?.addEventListener('click', function () {
        Editor.deleteProjectAsset(this.getAttribute('data-asset-id'));
      });
      root.querySelectorAll('[data-action="goto-usage"]').forEach((btn) => {
        btn.addEventListener('click', function () {
          const kind = btn.getAttribute('data-kind');
          const sceneId = btn.getAttribute('data-scene-id');
          const screenId = btn.getAttribute('data-screen-id');
          if (kind === 'visual' && sceneId) {
            Editor.currentScene = sceneId;
            Editor.switchTab && Editor.switchTab('scenes');
            Editor.renderSceneEditor && Editor.renderSceneEditor();
          } else if (kind === 'ui') {
            Editor.switchTab && Editor.switchTab('game_ui');
            if (screenId) Editor._uiSelectedScreen = screenId;
            Editor.renderGameUiEditor && Editor.renderGameUiEditor();
          }
        });
      });
    },

    renderAssetDetail(assetId) {
      const bag = Editor.data?.assets || {};
      let entry = bag[assetId];
      const listed = getAssetList().find((a) => a.id === assetId);
      if (!entry && listed) {
        entry = { type: listed.type, src: listed.src, name: listed.name, tags: listed.tags || [] };
      }
      if (!entry) return '<p class="hint">Выберите ассет</p>';

      const src = typeof entry === 'string' ? entry : (entry.src || '');
      const name = typeof entry === 'string' ? assetId : (entry.name || assetId);
      const type = typeof entry === 'string' ? 'image' : (entry.type || 'image');
      const tags = (typeof entry === 'object' && entry.tags) ? entry.tags.join(', ') : '';
      const inCatalog = !!bag[assetId];
      const usages = getUsage(assetId);

      let preview = '';
      if (type === 'image' && src) {
        preview = '<div class="asset-detail-preview"><img src="' + escAttr(src) + '" alt=""></div>';
      }

      let usageHtml = '<p class="hint">Не используется</p>';
      if (usages.length) {
        usageHtml = '<ul class="asset-usage-list">' + usages.map((u) => {
          const kind = u.kind === 'ui_node' ? 'ui' : 'visual';
          const attrs = kind === 'ui'
            ? 'data-action="goto-usage" data-kind="ui" data-screen-id="' + escAttr(u.screenId || '') + '"'
            : 'data-action="goto-usage" data-kind="visual" data-scene-id="' + escAttr(u.sceneId || '') + '"';
          return '<li><button type="button" class="btn btn-link" ' + attrs + '>' + esc(u.label) + '</button></li>';
        }).join('') + '</ul>';
      }

      const catalogFields = inCatalog
        ? '<div class="form-group"><label>Название</label><input data-asset-id="' + escAttr(assetId) + '" data-asset-field="name" value="' + escAttr(name) + '"></div>' +
          '<div class="form-group"><label>Тип</label><select data-asset-id="' + escAttr(assetId) + '" data-asset-field="type">' +
          Object.keys(TYPE_LABELS).map((t) =>
            '<option value="' + t + '"' + (type === t ? ' selected' : '') + '>' + esc(TYPE_LABELS[t]) + '</option>'
          ).join('') +
          '</select></div>' +
          '<div class="form-group"><label>Путь (src)</label><input data-asset-id="' + escAttr(assetId) + '" data-asset-field="src" value="' + escAttr(src) + '"></div>' +
          '<div class="form-group"><label>Теги (через запятую)</label><input data-asset-id="' + escAttr(assetId) + '" data-asset-field="tags" value="' + escAttr(tags) + '"></div>' +
          '<button type="button" class="btn btn-danger" data-action="delete-asset" data-asset-id="' + escAttr(assetId) + '">Удалить из каталога</button>'
        : '<p class="hint">Только ссылка в сцене/UI — добавьте в каталог через «+ По пути» с тем же id.</p>' +
          '<button type="button" class="btn btn-primary" onclick="Editor.registerProjectAsset(' + JSON.stringify(assetId) + ',' +
          JSON.stringify({ type, src, name }) + ')">Добавить в каталог</button>';

      return '<h4>' + esc(name) + '</h4>' + preview +
        '<p class="hint">ID: <code>' + esc(assetId) + '</code></p>' +
        catalogFields +
        '<h4>Где используется</h4>' + usageHtml;
    }
  });

  // Delegate listProjectAssets for visual-scene picker
  Editor.listProjectAssets = Editor.getProjectAssetList;

  if (typeof document !== 'undefined' && !document.getElementById('asset-browser-styles')) {
    const st = document.createElement('style');
    st.id = 'asset-browser-styles';
    st.textContent = `
      .asset-browser-wrap { display:flex; flex-direction:column; gap:10px; }
      .asset-browser-toolbar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
      .asset-browser-toolbar input[type=search] { flex:1; min-width:140px; }
      .asset-browser-body { display:grid; grid-template-columns:1fr minmax(260px,340px); gap:16px; }
      @media (max-width:900px) { .asset-browser-body { grid-template-columns:1fr; } }
      .asset-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:10px; max-height:70vh; overflow-y:auto; padding:4px; }
      .asset-card { border:1px solid var(--border,#444); border-radius:8px; padding:8px; cursor:grab; background:var(--paper-dark,#1e1e28); }
      .asset-card.is-active { outline:2px solid var(--accent,#6af); }
      .asset-card-thumb { width:100%; aspect-ratio:1; border-radius:6px; background:#333 center/cover no-repeat; margin-bottom:6px; }
      .asset-card-thumb--placeholder { display:flex; align-items:center; justify-content:center; font-size:28px; }
      .asset-card-meta { font-size:12px; word-break:break-word; }
      .asset-detail-panel { border:1px solid var(--border,#444); border-radius:8px; padding:12px; max-height:70vh; overflow-y:auto; }
      .asset-detail-preview img { max-width:100%; max-height:200px; border-radius:6px; }
      .asset-usage-list { list-style:none; padding:0; margin:0; }
      .asset-usage-list li { margin:4px 0; }
      .visual-viewport.is-asset-drop-target,
      #game-ui-viewport.is-asset-drop-target { outline:3px dashed var(--accent,#6af); outline-offset:-3px; }
    `;
    document.head.appendChild(st);
  }

  if (Editor.hooks && typeof Editor.hooks.after === 'function') {
    Editor.hooks.after('switchTab', function (_r, args) {
      const tab = args && args[0];
      if (tab === 'media') Editor.renderMediaAssets && Editor.renderMediaAssets();
    });
  }
})();
