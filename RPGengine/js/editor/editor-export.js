// Экспорт самостоятельной игры в выбранную папку (File System Access API).

(function attachEditorExport() {
  if (typeof Editor === 'undefined') {
    console.error('editor-export.js: Editor не определён');
    return;
  }

  function escapeXmlTitle(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildInlineDataJs(data) {
    const json = JSON.stringify(data);
    return [
      '// Сгенерировано редактором RPGengine (экспорт игры)',
      'var GAME_DATA_INLINE = ' + json + ';',
      'if (typeof window !== "undefined") window.GAME_DATA_INLINE = GAME_DATA_INLINE;',
      ''
    ].join('\n');
  }

  async function ensureDirHandle(parent, pathParts) {
    let h = parent;
    for (const name of pathParts) {
      h = await h.getDirectoryHandle(name, { create: true });
    }
    return h;
  }

  async function writeToRootDir(rootDir, relativePath, contents) {
    const parts = relativePath.split('/').filter(Boolean);
    const fileName = parts.pop();
    const parent = parts.length ? await ensureDirHandle(rootDir, parts) : rootDir;
    const fh = await parent.getFileHandle(fileName, { create: true });
    const w = await fh.createWritable();
    if (typeof contents === 'string') {
      await w.write(contents);
    } else {
      await w.write(contents instanceof Uint8Array ? contents : new Uint8Array(contents));
    }
    await w.close();
  }

  function collectAudioPaths(data) {
    const paths = new Set();
    const audio = data?.audio;
    if (!audio) return [];
    const add = (p) => {
      if (!p || typeof p !== 'string') return;
      const n = p.replace(/^\.\//, '').replace(/\\/g, '/').trim();
      if (n && !n.startsWith('http:') && !n.startsWith('https:') && !n.startsWith('//')) paths.add(n);
    };
    for (const entry of Object.values(audio.catalog || {})) {
      if (entry && typeof entry === 'object') {
        add(entry.file);
        add(entry.path);
      }
    }
    const maps = [audio.defaults?.damageType, audio.defaults?.effectType, audio.defaults?.attack];
    for (const map of maps) {
      if (!map || typeof map !== 'object') continue;
      for (const sid of Object.values(map)) {
        if (!sid || typeof sid !== 'string') continue;
        const cat = audio.catalog?.[sid];
        if (cat && typeof cat === 'object') {
          add(cat.file);
          add(cat.path);
        }
      }
    }
    return [...paths].sort();
  }

  const STATIC_GAME_FILES = [
    'index.html',
    'css/theme.css',
    'css/style.css',
    'js/conditions.js',
    'js/patch-progression.js',
    'js/theme.js',
    'js/enemy-scaling.js',
    'js/audio.js',
    'js/special-scenes.js',
    'js/engine.js'
  ];

  async function fetchText(rel) {
    const url = new URL(rel, window.location.href);
    const res = await fetch(url);
    if (!res.ok) throw new Error(rel + ': HTTP ' + res.status);
    return await res.text();
  }

  async function fetchBinary(rel) {
    const url = new URL(rel, window.location.href);
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  }

  function patchIndexHtml(html, title) {
    if (!title) return html;
    return html.replace(/<title>[\s\S]*?<\/title>/i, '<title>' + escapeXmlTitle(title) + '</title>');
  }

  Editor.exportGameStandalone = async function exportGameStandalone() {
    if (!this.data) {
      alert('Нет данных проекта. Создайте или загрузите JSON.');
      return;
    }
    if (typeof window.showDirectoryPicker !== 'function') {
      alert(
        'Экспорт в папку поддерживается в Chromium (Chrome, Edge, Brave).\n' +
          'Откройте editor.html по адресу http://localhost/… или через Live Server в VS Code — на чистом file:// выбор папки может быть недоступен.'
      );
      return;
    }
    let rootDir;
    try {
      rootDir = await window.showDirectoryPicker({ mode: 'readwrite' });
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      if (e && e.name === 'SecurityError') {
        alert(
          'Выбор папки заблокирован (нужен безопасный контекст).\n' +
            'Откройте editor.html через http://localhost или Live Server в VS Code, не как file://.'
        );
        return;
      }
      alert('❌ Не удалось выбрать папку: ' + (e && e.message ? e.message : String(e)));
      return;
    }
    const title = this.data.meta?.title || 'Игра';
    try {
      await writeToRootDir(rootDir, 'js/data.js', buildInlineDataJs(this.data));

      for (const rel of STATIC_GAME_FILES) {
        let text = await fetchText(rel);
        if (rel === 'index.html') text = patchIndexHtml(text, title);
        await writeToRootDir(rootDir, rel, text);
      }

      const audioPaths = collectAudioPaths(this.data);
      for (const rel of audioPaths) {
        const buf = await fetchBinary(rel);
        if (!buf) {
          console.warn('[export] файл звука не найден, пропуск:', rel);
          continue;
        }
        await writeToRootDir(rootDir, rel, buf);
      }

      const readme =
        'Собрано редактором RPGengine (экспорт в папку).\r\n\r\n' +
        'Запуск: откройте index.html в Chrome или Edge (двойной клик или «Открыть с помощью»).\r\n' +
        'Контент встроен в js/data.js (GAME_DATA_INLINE), отдельный game_data.json не нужен.\r\n\r\n' +
        'Сохранения игры и флаг «звук вкл» хранятся в localStorage браузера для этого файла (origin).\r\n\r\n' +
        'Проект: ' + title + '\r\n';
      await writeToRootDir(rootDir, 'README_export.txt', readme);

      alert('Экспорт завершён.\n\nВ выбранной папке — index.html, css/, js/ (без редактора), звуки из каталога.\nОткройте index.html для игры.');
    } catch (e) {
      console.error(e);
      alert('❌ Ошибка экспорта: ' + (e && e.message ? e.message : String(e)));
    }
  };
})();
