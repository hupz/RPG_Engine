// Редактор: импорт сцен, шаблоны создания, тестовое состояние превью

(function attachEditorImport() {
  if (typeof Editor === 'undefined') {
    console.error('editor-import.js: Editor не определён');
    return;
  }

  const SCENE_ID_RE = /^[a-z][a-z0-9_]*$/i;
  const LOCATION_RE = /^Локация:\s*(.*)$/i;
  const DIALOGUE_RE = /^\[([^\]]+)\]\s*(.*)$/;
  const CHOICE_RE = /^->\s*(.+)$/;

  /** Быстрые заготовки (полные шаблоны — во вкладке «Новая сцена» через SceneTemplateEngine) */
  const QUICK_SCENE_TEMPLATE_IDS = ['empty', 'fork', 'ending', 'skill'];

  function parseFlagValue(raw) {
    const v = (raw || '').trim();
    if (v === 'true') return true;
    if (v === 'false') return false;
    if (v !== '' && !Number.isNaN(Number(v))) return Number(v);
    return v;
  }

  function parseChoiceMeta(meta, choice, sceneAccum) {
    if (!meta) return;
    const parts = meta.split(/\s+/).filter(Boolean);
    let itemsPart = '';
    let flagsPart = '';

    parts.forEach((p) => {
      if (p.startsWith('questSet:')) {
        const segs = p.split(':');
        const questId = segs[1];
        const stage = segs[2];
        if (questId != null && stage != null) {
          choice.questSet = { questId, stage: String(stage) };
        } else {
          console.warn('[import] Некорректный questSet:', p);
        }
        return;
      }
      if (p.startsWith('items:')) {
        itemsPart = p.slice(6);
        return;
      }
      if (p.startsWith('flags:')) {
        flagsPart = p.slice(6);
        return;
      }
      if (p.startsWith('skillCheck:')) {
        const segs = p.split(':');
        const skill = segs[1];
        const dc = parseInt(segs[2], 10);
        if (!skill || Number.isNaN(dc)) {
          console.warn('[import] Некорректный skillCheck:', p);
          return;
        }
        choice.skillCheck = { skill, dc };
        delete choice.to;
        return;
      }
      if (p.startsWith('successNext:')) {
        if (!choice.skillCheck) choice.skillCheck = {};
        choice.skillCheck.successNext = p.slice('successNext:'.length);
        return;
      }
      if (p.startsWith('failNext:')) {
        if (!choice.skillCheck) choice.skillCheck = {};
        choice.skillCheck.failNext = p.slice('failNext:'.length);
        return;
      }
      console.warn('[import] Некорректный фрагмент мета выбора:', p);
    });

    if (itemsPart) {
      const ids = itemsPart.split(',').map(s => s.trim()).filter(Boolean);
      if (!sceneAccum.items) sceneAccum.items = [];
      ids.forEach((id) => {
        if (!sceneAccum.items.includes(id)) sceneAccum.items.push(id);
      });
    }
    if (flagsPart) {
      if (!sceneAccum.flags) sceneAccum.flags = {};
      flagsPart.split(',').forEach((pair) => {
        const idx = pair.indexOf(':');
        if (idx < 1) {
          console.warn('[import] Некорректный флаг:', pair);
          return;
        }
        const key = pair.slice(0, idx).trim();
        const val = parseFlagValue(pair.slice(idx + 1));
        if (key) sceneAccum.flags[key] = val;
      });
    }
  }

  function parseChoiceLine(line, sceneAccum) {
    const m = line.match(CHOICE_RE);
    if (!m) return null;
    const body = m[1].trim();
    const segments = body.split('|').map(s => s.trim());
    if (!segments.length) return null;

    const text = segments[0];
    if (!text) {
      console.warn('[import] Пустой текст выбора:', line);
      return null;
    }

    const choice = { text, to: '', icon: '➡️' };

    if (segments.length >= 2) {
      const second = segments[1];
      if (second.startsWith('skillCheck:')) {
        parseChoiceMeta(second, choice, sceneAccum);
        segments.slice(2).forEach((seg) => parseChoiceMeta(seg, choice, sceneAccum));
      } else {
        choice.to = second;
        if (segments.length >= 3) {
          parseChoiceMeta(segments.slice(2).join(' '), choice, sceneAccum);
        }
      }
    }

    return choice;
  }

  function parseSceneBlocks(text) {
    const raw = String(text || '').replace(/\r\n/g, '\n');
    const chunks = raw.split(/^===\s*/m).map(c => c.trim()).filter(Boolean);
    const parsed = [];

    chunks.forEach((chunk) => {
      const lines = chunk.split('\n');
      const idLine = (lines[0] || '').trim();
      const id = idLine.split(/\s+/)[0];

      if (!id || !SCENE_ID_RE.test(id)) {
        console.warn('[import] Пропуск блока: невалидный ID', idLine);
        return;
      }

      const scene = {
        id,
        location: '',
        text: '',
        choices: [],
        dialogue: [],
        combat: null,
        flags: {},
        items: [],
        gold: 0
      };

      const textLines = [];
      let phase = 'text';

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;

        const locMatch = line.match(LOCATION_RE);
        if (locMatch) {
          scene.location = locMatch[1].trim();
          continue;
        }

        if (line.match(CHOICE_RE)) {
          phase = 'choices';
          const ch = parseChoiceLine(line, scene);
          if (ch) scene.choices.push(ch);
          continue;
        }

        const dlg = line.match(DIALOGUE_RE);
        if (dlg) {
          phase = 'post';
          scene.dialogue.push({ speaker: dlg[1].trim(), text: dlg[2].trim() });
          continue;
        }

        if (phase === 'text') {
          textLines.push(line);
        } else {
          console.warn(`[import] Сцена ${id}: пропуск строки вне текста/диалога/выбора:`, line);
        }
      }

      scene.text = textLines.join('\n');
      parsed.push(scene);
    });

    return parsed;
  }

  function buildSceneFromTemplate(templateId, id, location) {
    const loc = (location || '').trim();
    const base = {
      id,
      location: loc,
      text: '',
      choices: [],
      dialogue: [],
      combat: null,
      flags: {},
      items: [],
      gold: 0
    };

    switch (templateId) {
      case 'dialogue':
        return {
          ...base,
          text: 'Перед вами стоит собеседник.',
          dialogue: [{ speaker: 'NPC', text: 'Здравствуйте, путник.' }],
          choices: [
            { text: 'Продолжить', to: '', icon: '➡️' },
            { text: '← Назад', to: '', icon: '↩️' }
          ]
        };
      case 'combat':
        return {
          ...base,
          text: 'Вы вступаете в бой. Добавьте врагов в блоке «Бой» и укажите сцену после победы.',
          combat: [],
          nextScene: '',
          choices: []
        };
      case 'skill':
        return {
          ...base,
          text: 'Что-то требует внимания. Совершите проверку.',
          choices: [{
            text: '🔍 Осмотреть (Восприятие DC 13)',
            to: id,
            icon: '🔍',
            skillCheck: {
              skill: 'perception',
              dc: 13,
              successText: 'Вы замечаете важную деталь.',
              failText: 'Ничего не выдаёт себя.',
              successNext: id,
              failNext: id
            }
          }]
        };
      case 'shop':
        return {
          ...base,
          text: 'Прилавок лавки. Укажите товары и цены в special-сцене или связанных переходах.',
          special: 'shop_jack',
          choices: [{ text: '← Назад', to: '', icon: '↩️' }]
        };
      case 'fork':
        return {
          ...base,
          text: 'Перед вами несколько путей.',
          choices: [
            { text: 'Путь 1', to: '', icon: '1️⃣' },
            { text: 'Путь 2', to: '', icon: '2️⃣' },
            { text: 'Путь 3', to: '', icon: '3️⃣' }
          ]
        };
      case 'ending':
        return {
          ...base,
          text: 'Конец истории. Игрок может начать заново.',
          choices: [{
            text: '🔄 Начать сначала',
            to: '',
            icon: '🔄',
            action: 'reset_game'
          }]
        };
      case 'empty':
      default:
        return { ...base, text: '' };
    }
  }

  Editor.buildSceneFromTemplate = buildSceneFromTemplate;

  Object.assign(Editor, {
    getSceneTemplates() {
      const quick = typeof Editor.getSimpleSceneTemplates === 'function'
        ? Editor.getSimpleSceneTemplates()
        : QUICK_SCENE_TEMPLATE_IDS.map((id) => ({ id, label: id, icon: '📄' }));
      const full = typeof SceneTemplateEngine !== 'undefined'
        ? SceneTemplateEngine.listBaseTemplates()
        : [];
      return [...quick, ...full];
    },

    ensureSceneListActions() {
      const list = document.getElementById('scene-list');
      if (!list) return;

      let bar = document.getElementById('scene-list-actions');
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'scene-list-actions';
        bar.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-top:12px;';
        bar.innerHTML = `
          <button type="button" class="btn btn-secondary" id="btn-import-scenes" style="width:100%;">📥 Импорт из текста</button>
          <button type="button" class="btn btn-primary" id="btn-create-scene" style="width:100%;">+ Новая сцена</button>`;
        list.insertAdjacentElement('afterend', bar);

        bar.querySelector('#btn-import-scenes').addEventListener('click', () => Editor.openSceneImportModal());
        bar.querySelector('#btn-create-scene').addEventListener('click', () => Editor.createScene());

        document.querySelectorAll(
          '.context-sidebar button[onclick*="createScene"], .context-sidebar button[onclick*="openTemplateSceneModal"], .sidebar button[onclick*="createScene"], .sidebar button[onclick*="openTemplateSceneModal"]'
        ).forEach((btn) => { btn.style.display = 'none'; });
      }
    },

    openSceneImportModal() {
      let overlay = document.getElementById('editor-import-modal');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'editor-import-modal';
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
          <div class="modal-box" role="dialog" aria-labelledby="editor-import-title">
            <div class="modal-title" id="editor-import-title">📥 Импорт сцен из текста</div>
            <div class="modal-body">
              <p class="hint" style="margin-bottom:10px;line-height:1.5;">
                Разделитель: <code>=== scene_id</code>. Локация, текст, <code>[Speaker]</code>,
                <code>-&gt; текст | сцена</code>, questSet, items/flags, skillCheck.
              </p>
              <textarea id="editor-import-textarea" class="editor-import-textarea" placeholder="=== tavern&#10;Локация: Таверна&#10;Вы входите..."></textarea>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" id="editor-import-cancel">Отмена</button>
              <button type="button" class="btn btn-primary" id="editor-import-run">Импортировать</button>
            </div>
          </div>`;
        document.body.appendChild(overlay);

        if (!document.getElementById('editor-import-modal-styles')) {
          const style = document.createElement('style');
          style.id = 'editor-import-modal-styles';
          style.textContent = `
            .modal-overlay { display:none; position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,0.45);
              align-items:center; justify-content:center; padding:24px; }
            .modal-overlay.open { display:flex; }
            .modal-box { background:var(--card-bg); color:var(--ink); border:2px solid var(--border); border-radius:12px;
              max-width:720px; width:100%; max-height:90vh; display:flex; flex-direction:column;
              box-shadow:0 12px 40px rgba(0,0,0,0.2); }
            .modal-title { padding:16px 20px; border-bottom:2px solid var(--border); font-size:18px; font-weight:600; color:var(--accent); }
            .modal-body { padding:16px 20px; overflow:auto; flex:1; }
            .modal-footer { padding:12px 20px 16px; display:flex; gap:10px; justify-content:flex-end; border-top:2px solid var(--border); }
            .editor-import-textarea { width:100%; min-height:280px; font-family:ui-monospace,Consolas,monospace; font-size:13px;
              padding:12px; border:2px solid var(--border); border-radius:8px; background:var(--paper); color:var(--ink);
              line-height:1.45; resize:vertical; }
          `;
          document.head.appendChild(style);
        }

        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) Editor.closeSceneImportModal();
        });
        overlay.querySelector('#editor-import-cancel').addEventListener('click', () => Editor.closeSceneImportModal());
        overlay.querySelector('#editor-import-run').addEventListener('click', () => Editor.runSceneTextImport());
      }

      overlay.classList.add('open');
      const ta = document.getElementById('editor-import-textarea');
      if (ta) setTimeout(() => ta.focus(), 50);
    },

    closeSceneImportModal() {
      const overlay = document.getElementById('editor-import-modal');
      if (overlay) overlay.classList.remove('open');
    },

    async runSceneTextImport() {
      const ta = document.getElementById('editor-import-textarea');
      if (!ta || !this.data?.scenes) return;

      const scenes = parseSceneBlocks(ta.value);
      if (!scenes.length) {
        Editor.toast.warning('Не найдено ни одной сцены. Начните блок со строки === scene_id');
        return;
      }

      const existing = scenes.filter(s => this.data.scenes[s.id]);
      if (existing.length) {
        const names = existing.map(s => s.id).join(', ');
        if (!(await Editor.confirmDialog({ message: `Перезаписать ${existing.length} сцен?\n${names}` }))) return;
      }

      let created = 0;
      let updated = 0;

      scenes.forEach((scene) => {
        if (this.data.scenes[scene.id]) updated++;
        else created++;

        this.data.scenes[scene.id] = {
          id: scene.id,
          location: scene.location || '',
          text: scene.text || '',
          choices: scene.choices || [],
          dialogue: scene.dialogue || [],
          combat: scene.combat,
          flags: scene.flags || {},
          items: scene.items || [],
          gold: scene.gold || 0,
          ...(scene.special ? { special: scene.special } : {}),
          ...(scene.nextScene != null ? { nextScene: scene.nextScene } : {})
        };
      });

      const lastId = scenes[scenes.length - 1].id;
      this.closeSceneImportModal();
      this.renderSceneList();
      this.updateJSONPreview();
      this.selectScene(lastId);

      const startScreen = document.getElementById('start-screen');
      if (startScreen) startScreen.style.display = 'none';

      Editor.toast.success(`Импорт завершён.\nСоздано: ${created}\nОбновлено: ${updated}`);
    },

  });

  // hooks-only: do NOT reassign Editor.renderSceneList (causes recursion with other wrappers)
  if (Editor.hooks && typeof Editor.hooks.after === 'function') {
    Editor.hooks.after('renderSceneList', function (result) {
      if (typeof this.ensureSceneListActions === 'function') this.ensureSceneListActions();
      return result;
    });
  } else if (typeof console !== 'undefined' && console.warn) {
    console.warn('[editor-import] Editor.hooks missing — ensureSceneListActions not attached to renderSceneList');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Editor.ensureSceneListActions());
  } else {
    Editor.ensureSceneListActions();
  }
})();

(function patchEditorDataMigrate() {
  if (typeof Editor === 'undefined') return;
  const wrapAssign = () => {
    const migrate = (d) => {
      if (typeof ProjectDataSchema !== 'undefined' && d) return ProjectDataSchema.migrateProjectData(d);
      return d;
    };
    // Migrate after project load paths via hooks — no Editor[name] = wrapper
    if (Editor.hooks && typeof Editor.hooks.after === 'function') {
      ['loadProjectJson', 'confirmNewProject', 'finishCampaignWizard'].forEach((name) => {
        if (typeof Editor[name] !== 'function') return;
        Editor.hooks.after(name, function (result) {
          if (this.data) this.data = migrate(this.data);
          return result;
        });
      });
    } else if (typeof console !== 'undefined' && console.warn) {
      console.warn('[editor-import] Editor.hooks missing — migrate-after-load skipped');
    }
  };
  wrapAssign();
})();
