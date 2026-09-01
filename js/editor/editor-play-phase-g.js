/**
 * Phase G — Embedded Play + Debug overlay
 */
(function attachPlayPhaseG() {
  'use strict';

  if (typeof Editor === 'undefined') return;

  const SESSION_KEY = 'melnitsa_editor_test_session';
  const MAX_LOG = 80;

  const state = {
    active: false,
    iframe: null,
    log: [],
    lastEvent: null,
    selectedHotspot: null
  };

  function esc(s) {
    return typeof Editor.escapeHtml === 'function'
      ? Editor.escapeHtml(String(s == null ? '' : s))
      : String(s == null ? '' : s);
  }

  Object.assign(Editor, {
    _playDebugState: state,

    getPlayDebugLog() {
      return state.log.slice();
    },

    clearPlayDebugLog() {
      state.log = [];
      state.lastEvent = null;
      Editor.renderPlayDebugPanel?.();
    },

    pushPlayDebugEvent(evt) {
      if (!evt || typeof evt !== 'object') return;
      const entry = Object.assign({ ts: Date.now() }, evt);
      state.lastEvent = entry;
      state.log.unshift(entry);
      if (state.log.length > MAX_LOG) state.log.length = MAX_LOG;
      if (evt.hotspotId || evt.nodeId) {
        state.selectedHotspot = evt.hotspotId || evt.nodeId;
      }
      Editor.renderPlayDebugPanel?.();
    },

    startEmbeddedPlay(opts) {
      opts = opts || {};
      if (!Editor.data) {
        Editor.toast?.warning('Нет данных проекта');
        return;
      }
      const sceneId = opts.sceneId || Editor.currentScene || Object.keys(Editor.data.scenes || {})[0];
      const session = typeof Editor.buildTestSession === 'function'
        ? Editor.buildTestSession(Object.assign({ sceneId }, opts))
        : { mode: 'editor_test', sceneId, createdAt: Date.now() };

      try {
        if (typeof Editor.prepareEditorTestLaunch === 'function') {
          Editor.prepareEditorTestLaunch(session);
        } else {
          const KEYS = typeof EditorTestKeys !== 'undefined' ? EditorTestKeys : null;
          if (KEYS) {
            KEYS.writeTestData(Editor.data);
            KEYS.writeSession(session);
          } else {
            console.warn('[embeddedPlay] EditorTestKeys missing — refusing production write');
            return;
          }
        }
      } catch (e) {
        console.error('[embeddedPlay]', e);
        Editor.toast?.error('Не удалось подготовить play-сессию');
        return;
      }

      Editor.openEmbeddedPlayPanel?.();
      const frame = document.getElementById('embedded-play-iframe');
      if (!frame) return;
      state.active = true;
      state.iframe = frame;
      frame.src = 'index.html?editorTest=1&embedded=1&t=' + Date.now();
      Editor.clearPlayDebugLog();
      Editor.pushPlayDebugEvent({ type: 'play_start', sceneId });
      Editor.toast?.info('Embedded Play: ' + sceneId);
    },

    stopEmbeddedPlay() {
      state.active = false;
      const frame = document.getElementById('embedded-play-iframe');
      if (frame) frame.src = 'about:blank';
      Editor.pushPlayDebugEvent({ type: 'play_stop' });
      Editor.renderEmbeddedPlayPanel?.();
    },

    openEmbeddedPlayPanel() {
      let panel = document.getElementById('embedded-play-panel');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'embedded-play-panel';
        panel.style.cssText =
          'position:fixed;right:12px;bottom:12px;width:min(520px,92vw);height:min(420px,70vh);' +
          'z-index:10040;background:#12141c;border:1px solid #445;border-radius:10px;' +
          'display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.45);';
        document.body.appendChild(panel);
      }
      panel.hidden = false;
      Editor.renderEmbeddedPlayPanel();
    },

    closeEmbeddedPlayPanel() {
      Editor.stopEmbeddedPlay();
      const panel = document.getElementById('embedded-play-panel');
      if (panel) panel.hidden = true;
    },

    renderEmbeddedPlayPanel() {
      const panel = document.getElementById('embedded-play-panel');
      if (!panel) return;
      panel.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid #334">' +
        '<strong style="color:#eee">▶ Play (embedded)</strong>' +
        '<button type="button" class="btn btn-secondary btn-sm" id="ep-restart">↻</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" id="ep-stop">Stop</button>' +
        '<span style="flex:1"></span>' +
        '<button type="button" class="btn btn-secondary btn-sm" id="ep-close">✕</button></div>' +
        '<div style="display:flex;flex:1;min-height:0">' +
        '<iframe id="embedded-play-iframe" title="Game preview" style="flex:1;border:0;background:#000"></iframe>' +
        '<div id="play-debug-panel" style="width:180px;border-left:1px solid #334;overflow:auto;font-size:11px;color:#ccc;padding:6px"></div>' +
        '</div>';

      document.getElementById('ep-restart')?.addEventListener('click', () => Editor.startEmbeddedPlay({ sceneId: Editor.currentScene }));
      document.getElementById('ep-stop')?.addEventListener('click', () => Editor.stopEmbeddedPlay());
      document.getElementById('ep-close')?.addEventListener('click', () => Editor.closeEmbeddedPlayPanel());
      Editor.renderPlayDebugPanel();
    },

    renderPlayDebugPanel() {
      const host = document.getElementById('play-debug-panel');
      if (!host) return;
      const last = state.lastEvent;
      let lastHtml = '<p class="hint">Нет событий</p>';
      if (last) {
        lastHtml =
          '<div><strong>Последнее</strong><br>' +
          esc(last.type || '') +
          (last.sceneId ? '<br>scene: ' + esc(last.sceneId) : '') +
          (last.action ? '<br>action: ' + esc(last.action) : '') +
          (last.source ? '<br>src: ' + esc(last.source) : '') +
          (last.nodeId ? '<br>node: ' + esc(last.nodeId) : '') +
          '</div>';
      }
      const logHtml = state.log.slice(0, 20).map((e) =>
        '<div style="margin:4px 0;padding:3px 0;border-bottom:1px solid #223">' +
        esc(e.type) +
        (e.action ? ' · ' + esc(e.action) : '') +
        (e.sceneId ? ' → ' + esc(e.sceneId) : '') +
        '</div>'
      ).join('') || '<p class="hint">Лог пуст</p>';

      host.innerHTML =
        '<div style="margin-bottom:8px">' + lastHtml + '</div>' +
        '<button type="button" class="btn btn-secondary btn-sm" id="debug-clear" style="margin-bottom:6px">Очистить</button>' +
        '<div><strong>Лог</strong></div>' + logHtml;

      document.getElementById('debug-clear')?.addEventListener('click', () => Editor.clearPlayDebugLog());
    }
  });

  window.addEventListener('message', function (e) {
    if (!e.data || e.data.channel !== 'rpg_editor_play_debug') return;
    Editor.pushPlayDebugEvent(e.data.payload || e.data);
  });

  if (Editor.hooks?.after) {
    Editor.hooks.after('renderSceneEditor', function () {
      try {
        const toolbar =
          document.querySelector('.scenes-preview-pane .live-preview-toolbar') ||
          document.querySelector('#scene-editor .scene-editor-toolbar') ||
          document.getElementById('scene-editor');
        if (!toolbar || toolbar.querySelector('#btn-embedded-play')) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'btn-embedded-play';
        btn.className = 'btn btn-info btn-sm';
        btn.textContent = '▶ Play здесь';
        btn.title = 'Embedded Play + debug (Phase G)';
        btn.addEventListener('click', () => Editor.startEmbeddedPlay({ sceneId: Editor.currentScene }));
        toolbar.appendChild(btn);
      } catch (err) {
        console.warn('[phase-g play]', err);
      }
    }, 'editor-play-phase-g-scene');

    Editor.hooks.after('renderStoryGraphPanel', function () {
      try {
        const bar = document.querySelector('.story-flow-toolbar .sf-toolbar-actions') ||
          document.querySelector('.story-graph-toolbar');
        if (!bar || bar.querySelector('#btn-flow-embedded-play')) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'btn-flow-embedded-play';
        btn.className = 'btn btn-info btn-sm';
        btn.textContent = '▶ Play';
        btn.addEventListener('click', () => Editor.startEmbeddedPlay({ sceneId: Editor.currentScene }));
        bar.appendChild(btn);
      } catch (err) {
        console.warn('[phase-g flow play]', err);
      }
    }, 'editor-play-phase-g-graph');
  }
})();
