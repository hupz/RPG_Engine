// ============================================================
// P4.6 — Служебная память истории: авто-гейты sc_/ch_/loc_/it_
// и человеческие фразы без имён флагов в режиме Писателя.
// ============================================================
(function attachStoryMemory(global) {
  'use strict';

  const PREFIX = Object.freeze({
    choiceOnce: 'ch_',
    skillOnce: 'sc_',
    location: 'loc_',
    item: 'it_'
  });

  const STORY_PHASES = Object.freeze(['start', 'setup', 'development', 'finale']);
  const STORY_PHASE_LABELS = Object.freeze({
    start: 'Начало',
    setup: 'Завязка',
    development: 'Развитие',
    finale: 'Финал'
  });

  function slugPart(id) {
    return String(id || '').replace(/[^a-zA-Z0-9_]/g, '_');
  }

  function isServiceFlag(flagId) {
    if (!flagId) return false;
    const s = String(flagId);
    return s.startsWith(PREFIX.choiceOnce)
      || s.startsWith(PREFIX.skillOnce)
      || s.startsWith(PREFIX.location)
      || s.startsWith(PREFIX.item);
  }

  function choiceOnceFlag(sceneId, choiceIndex) {
    return PREFIX.choiceOnce + slugPart(sceneId) + '_' + choiceIndex;
  }

  function skillOnceFlag(sceneId, choiceIndex) {
    return PREFIX.skillOnce + slugPart(sceneId) + '_' + choiceIndex;
  }

  function locationFlag(sceneId) {
    return PREFIX.location + slugPart(sceneId);
  }

  function itemFlag(itemId) {
    return PREFIX.item + slugPart(itemId);
  }

  function sceneLabel(gameData, sceneId) {
    const sc = gameData?.scenes?.[sceneId];
    return sc?.location || sc?.title || sceneId || 'локация';
  }

  function itemLabel(gameData, itemId) {
    const it = gameData?.items?.[itemId];
    return it?.name || it?.title || itemId || 'предмет';
  }

  function parseServiceFlag(flagId) {
    if (!flagId) return null;
    const s = String(flagId);
    if (s.startsWith(PREFIX.location)) {
      return { kind: 'location', sceneId: s.slice(PREFIX.location.length) };
    }
    if (s.startsWith(PREFIX.item)) {
      return { kind: 'item', itemId: s.slice(PREFIX.item.length) };
    }
    if (s.startsWith(PREFIX.choiceOnce)) {
      const rest = s.slice(PREFIX.choiceOnce.length);
      const m = rest.match(/^(.*)_(\d+)$/);
      return { kind: 'choiceOnce', sceneId: m ? m[1] : rest, choiceIndex: m ? parseInt(m[2], 10) : null };
    }
    if (s.startsWith(PREFIX.skillOnce)) {
      const rest = s.slice(PREFIX.skillOnce.length);
      const m = rest.match(/^(.*)_(\d+)$/);
      return { kind: 'skillOnce', sceneId: m ? m[1] : rest, choiceIndex: m ? parseInt(m[2], 10) : null };
    }
    return null;
  }

  function phraseForServiceFlag(flagId, gameData) {
    const parsed = parseServiceFlag(flagId);
    if (!parsed) return null;
    if (parsed.kind === 'location') {
      return 'игрок уже был в «' + sceneLabel(gameData, parsed.sceneId) + '»';
    }
    if (parsed.kind === 'item') {
      return 'игрок получил «' + itemLabel(gameData, parsed.itemId) + '»';
    }
    if (parsed.kind === 'choiceOnce' || parsed.kind === 'skillOnce') {
      const sc = gameData?.scenes?.[parsed.sceneId];
      const choice = sc?.choices?.[parsed.choiceIndex];
      const text = choice?.text ? String(choice.text).replace(/<[^>]+>/g, '').trim() : '';
      if (text) return 'игрок уже выбирал «' + text + '»';
      return 'игрок уже делал этот выбор в «' + sceneLabel(gameData, parsed.sceneId) + '»';
    }
    return null;
  }

  function inferStoryPhaseForNode(nodeKey, spec) {
    const key = String(nodeKey || '');
    if (key === spec?.startKey || key === 'start') return 'start';
    if (key === 'hub' || /hub/i.test(key)) return 'setup';
    if (key === 'exit' || /final|finale|end$/i.test(key)) return 'finale';
    return 'development';
  }

  function collectServiceFlagIds(data) {
    const set = new Set();
    Object.keys(data?.scenes || {}).forEach((sid) => {
      set.add(locationFlag(sid));
      const sc = data.scenes[sid];
      (sc?.choices || []).forEach((c, i) => {
        if (c?.once) set.add(choiceOnceFlag(sid, i));
        if (c?.skillCheck) set.add(skillOnceFlag(sid, i));
        if (c?.doneFlag && isServiceFlag(c.doneFlag)) set.add(c.doneFlag);
        if (c?.skillCheck?.doneFlag && isServiceFlag(c.skillCheck.doneFlag)) set.add(c.skillCheck.doneFlag);
      });
    });
    Object.keys(data?.items || {}).forEach((iid) => set.add(itemFlag(iid)));
    return [...set];
  }

  function filterAuthorFlagCatalog(ids) {
    return (ids || []).filter((id) => !isServiceFlag(id));
  }

  function sanitizeProjectForAuthorView(data) {
    if (!data) return data;
    const out = JSON.parse(JSON.stringify(data));
    if (out.startingFlags) {
      Object.keys(out.startingFlags).forEach((k) => {
        if (isServiceFlag(k)) delete out.startingFlags[k];
      });
    }
    Object.values(out.scenes || {}).forEach((sc) => {
      if (!sc || typeof sc !== 'object') return;
      if (sc.flags) {
        Object.keys(sc.flags).forEach((k) => {
          if (isServiceFlag(k)) delete sc.flags[k];
        });
      }
      (sc.choices || []).forEach((c, i) => {
        if (!c) return;
        if (c.doneFlag && isServiceFlag(c.doneFlag)) delete c.doneFlag;
        if (c.skillCheck?.doneFlag && isServiceFlag(c.skillCheck.doneFlag)) {
          delete c.skillCheck.doneFlag;
        }
      });
    });
    return out;
  }

  function buildStoryGuidanceHints(model, data) {
    model = model || {};
    data = data || {};
    const hints = [];
    const nodes = model.nodes || [];
    const startId = model.startId;
    const reachable = model.reachable || new Set();
    const scenes = data.scenes || {};

    if (startId && nodes.length) {
      const unreachable = nodes
        .filter((n) => n.id !== startId && !reachable.has(n.id))
        .map((n) => n.id);
      if (unreachable.length) {
        const ratio = unreachable.length / nodes.length;
        hints.push({
          id: 'route_coverage',
          message: ratio >= 0.5
            ? 'Половина сцен не связана с основным маршрутом — проверьте переходы от старта'
            : (unreachable.length + ' сцен(ы) не достижимы из старта'),
          sceneIds: unreachable.slice(0, 6),
          tone: 'soft'
        });
      }
    }

    const deadEnds = nodes.filter((n) => {
      if (n.outCount > 0) return false;
      if (n.isHub) return true;
      const sc = scenes[n.id];
      return (sc?.choices || []).length > 0;
    });
    if (deadEnds.length) {
      hints.push({
        id: 'scene_exits',
        message: deadEnds.length === 1
          ? 'У сцены «' + (deadEnds[0].label || deadEnds[0].id) + '» пока нет выхода'
          : 'У ' + deadEnds.length + ' сцен нет выходов — игрок может застрять',
        sceneIds: deadEnds.map((n) => n.id),
        tone: 'soft'
      });
    }

    const hubIds = nodes.filter((n) => n.isHub).map((n) => n.id);
    const finalIds = nodes.filter((n) => n.isFinal).map((n) => n.id);
    if (hubIds.length && finalIds.length) {
      const reachedFromHub = new Set();
      hubIds.forEach((hid) => {
        const q = [hid];
        const seen = new Set([hid]);
        while (q.length) {
          const id = q.shift();
          (model.edges || []).filter((e) => e.fromId === id && !e.broken).forEach((e) => {
            if (!seen.has(e.toId)) { seen.add(e.toId); q.push(e.toId); }
          });
        }
        seen.forEach((x) => reachedFromHub.add(x));
      });
      const missingFin = finalIds.filter((f) => !reachedFromHub.has(f));
      if (missingFin.length) {
        hints.push({
          id: 'hub_to_final',
          message: 'Финал пока недостижим из хаба — добавьте путь к финальной сцене',
          sceneIds: missingFin,
          tone: 'soft'
        });
      }
    }

    const phaseCounts = { start: 0, setup: 0, development: 0, finale: 0 };
    nodes.forEach((n) => {
      const p = scenes[n.id]?.storyPhase;
      if (p && phaseCounts[p] != null) phaseCounts[p]++;
    });
    if (nodes.length >= 3 && !phaseCounts.finale) {
      hints.push({
        id: 'arc_finale',
        message: 'Отметьте финальную сцену в разметке сюжета (этап «Финал»)',
        sceneIds: finalIds.length ? finalIds : [],
        tone: 'soft'
      });
    }
    if (nodes.length >= 2 && !phaseCounts.setup && !phaseCounts.start) {
      hints.push({
        id: 'arc_setup',
        message: 'Добавьте завязку — сцену этапа «Завязка» после начала истории',
        sceneIds: startId ? [startId] : [],
        tone: 'soft'
      });
    }

    return hints;
  }

  function renderGuidanceHtml(hints) {
    hints = hints || [];
    if (!hints.length) {
      return '<div class="sf-guidance sf-guidance--ok"><p>Структура истории выглядит связной — можно сосредоточиться на тексте и персонажах.</p></div>';
    }
    return `<div class="sf-guidance" data-sf-guidance>
      <h4>Подсказки по истории</h4>
      <p class="hint">Мягкие советы — не блокируют экспорт и не считаются ошибками.</p>
      <ul class="sf-guidance-list">
        ${hints.map((h, idx) =>
          `<li class="sf-guidance-item">
            <button type="button" class="sf-guidance-btn" data-sf-hint="${idx}"
              data-scene-ids="${(h.sceneIds || []).join(',')}">
              <span class="sf-guidance-icon">💡</span>
              <span>${escapeHtml(h.message)}</span>
            </button>
          </li>`
        ).join('')}
      </ul>
    </div>`;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  const StoryMemory = {
    PREFIX,
    STORY_PHASES,
    STORY_PHASE_LABELS,
    isServiceFlag,
    choiceOnceFlag,
    skillOnceFlag,
    locationFlag,
    itemFlag,
    parseServiceFlag,
    phraseForServiceFlag,
    inferStoryPhaseForNode,
    collectServiceFlagIds,
    filterAuthorFlagCatalog,
    sanitizeProjectForAuthorView,
    buildStoryGuidanceHints,
    renderGuidanceHtml,
    sceneLabel,
    itemLabel
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = StoryMemory;
  }
  if (typeof global !== 'undefined') {
    global.StoryMemory = StoryMemory;
  }

  if (typeof Editor !== 'undefined') {
    Editor.StoryMemory = StoryMemory;

    if (Editor.hooks?.after) {
      Editor.hooks.after('updateJSONPreview', function storyMemoryJsonPreview() {
        if (typeof Editor.isWriterMode !== 'function' || !Editor.isWriterMode()) return;
        const el = document.getElementById('json-preview');
        if (!el || !Editor.data) return;
        try {
          const sanitized = StoryMemory.sanitizeProjectForAuthorView(Editor.data);
          el.textContent = JSON.stringify(sanitized, null, 2);
        } catch (e) { /* */ }
      }, 'editor-story-memory');

      Editor.hooks.after('renderSceneEditor', function storyMemoryGuidancePanel() {
        if (typeof Editor.isEditorFeatureVisible === 'function' && !Editor.isEditorFeatureVisible('story.guidance_hints')) {
          return;
        }
        if (typeof Editor.buildStoryFlowModel !== 'function') return;
        const host = document.getElementById('scene-editor');
        if (!host) return;
        let panel = document.getElementById('sf-guidance-panel');
        const model = Editor.buildStoryFlowModel();
        const hints = StoryMemory.buildStoryGuidanceHints(model, Editor.data);
        const html = StoryMemory.renderGuidanceHtml(hints);
        if (!panel) {
          panel = document.createElement('div');
          panel.id = 'sf-guidance-panel';
          panel.className = 'sf-guidance-panel';
          host.insertBefore(panel, host.firstChild);
          panel.addEventListener('click', (ev) => {
            const btn = ev.target.closest('[data-sf-hint]');
            if (!btn) return;
            const ids = (btn.getAttribute('data-scene-ids') || '').split(',').filter(Boolean);
            if (ids[0] && typeof Editor.openValidationIssueInWorkspace === 'function') {
              Editor.openValidationIssueInWorkspace({ sceneId: ids[0], section: 'choices' });
            } else if (ids[0] && typeof Editor.selectScene === 'function') {
              Editor.selectScene(ids[0]);
            }
          });
        }
        panel.innerHTML = html;
      }, 'editor-story-memory');
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
