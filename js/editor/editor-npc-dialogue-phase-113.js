/**
 * Phase 1.13 — NPC & Dialogue Authoring UI
 */
(function attachNpcDialoguePhase113() {
  'use strict';

  if (typeof Editor === 'undefined') return;

  const IDX = typeof NpcDialogueIndex !== 'undefined' ? NpcDialogueIndex : null;

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

  function isWriter() {
    return typeof Editor.isWriterMode === 'function' && Editor.isWriterMode();
  }

  function ensureStyles() {
    if (document.getElementById('npc-dialogue-phase-113-styles')) return;
    const st = document.createElement('style');
    st.id = 'npc-dialogue-phase-113-styles';
    st.textContent = `
      .npc-dialogue-panel, .npc-authoring-extra { margin: 14px 0; padding: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--card-bg); }
      .dialogue-node-card { border: 1px solid var(--border); border-radius: 8px; padding: 10px; margin: 8px 0; background: var(--paper); }
      .dialogue-node-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
      .dialogue-flow-list { list-style: none; margin: 0; padding: 0; }
      .dialogue-flow-item { padding: 4px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
      .dialogue-action-step { display: flex; gap: 6px; align-items: center; margin: 4px 0; font-size: 12px; }
      .visual-npc-bar { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
    `;
    document.head.appendChild(st);
  }

  Object.assign(Editor, {
    renderNpcAuthoringExtra(id) {
      const n = Editor.data?.npcs?.[id];
      if (!n) return '';
      const nid = escAttr(id);
      const writer = isWriter();
      let html = '<div class="npc-authoring-extra">';

      html += '<h4>Dialogue</h4>';
      html += '<div class="form-group"><label>Сцена диалога (dialogue tree)</label>';
      if (typeof Editor.renderEntityPicker === 'function') {
        html += Editor.renderEntityPicker({
          kind: 'scene',
          value: n.dialogueSceneId || '',
          onChange: `Editor.updateNPC('${nid}','dialogueSceneId',this.value||undefined)`
        });
      } else {
        html += `<input value="${escAttr(n.dialogueSceneId || '')}" onchange="Editor.updateNPC('${nid}','dialogueSceneId',this.value||undefined)">`;
      }
      html += '<p class="hint">Visual Talk → change_scene на эту сцену, если задана.</p></div>';

      html += '<h4>Shop</h4>';
      html += `<label><input type="checkbox" ${n.shop ? 'checked' : ''} onchange="Editor.updateNPC('${nid}','shop',this.checked)"> Торговец</label>`;
      if (n.shop) {
        const items = Array.isArray(n.shopItems) ? n.shopItems.join(', ') : '';
        html += `<div class="form-group"><label>shopItems (id через запятую)</label>
          <input value="${escAttr(items)}" onchange="Editor.setNpcShopItems('${nid}',this.value)"></div>`;
        html += '<div class="form-group"><label>Shop scene (change_scene)</label>';
        if (typeof Editor.renderEntityPicker === 'function') {
          html += Editor.renderEntityPicker({
            kind: 'scene',
            value: n.shopSceneId || n.location || '',
            onChange: `Editor.updateNPC('${nid}','shopSceneId',this.value||undefined)`
          });
        } else {
          html += `<input value="${escAttr(n.shopSceneId || n.location || '')}" onchange="Editor.updateNPC('${nid}','shopSceneId',this.value||undefined)">`;
        }
        html += '</div>';
      }

      html += '<h4>Quests</h4>';
      const allQuests = Object.keys(Editor.data?.quests || {});
      const questIds = Array.isArray(n.quests) ? n.quests : [];
      if (!allQuests.length) {
        html += '<p class="hint">Квестов нет.</p>';
      } else {
        allQuests.forEach((qid) => {
          const checked = questIds.includes(qid) ? ' checked' : '';
          html += `<label style="display:block;margin:3px 0;"><input type="checkbox"${checked}
            onchange="Editor.toggleNpcQuest('${nid}','${escAttr(qid)}',this.checked)"> ${esc(Editor.data.quests[qid]?.title || qid)}</label>`;
        });
      }

      if (!writer) {
        html += `<p class="hint">ID: <code>${esc(id)}</code> · icon/portrait: ${esc(n.icon || '👤')}</p>`;
      }

      html += `<button type="button" class="btn btn-secondary btn-sm" onclick="Editor.openNpcDialogueScene('${nid}')">Открыть dialogue scene</button>`;
      html += '</div>';
      return html;
    },

    setNpcShopItems(npcId, raw) {
      const n = Editor.data?.npcs?.[npcId];
      if (!n) return;
      n.shopItems = String(raw || '').split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
      Editor.updateJSONPreview?.();
    },

    openNpcDialogueScene(npcId) {
      const n = Editor.data?.npcs?.[npcId];
      if (!n) return;
      let sid = n.dialogueSceneId;
      if (!sid || !Editor.data?.scenes?.[sid]) {
        sid = Editor.ensureNpcDialogueScene?.(npcId);
      }
      if (sid) Editor.openContentEntity?.('scene', sid) || Editor.selectScene?.(sid);
    },

    ensureNpcDialogueScene(npcId) {
      const n = Editor.data?.npcs?.[npcId];
      if (!n || !Editor.data) return null;
      if (n.dialogueSceneId && Editor.data.scenes[n.dialogueSceneId]) return n.dialogueSceneId;
      if (!Editor.data.scenes) Editor.data.scenes = {};
      const baseId = String(npcId).replace(/[^a-z0-9_]+/gi, '_') + '_talk';
      let sid = baseId;
      if (Editor.data.scenes[sid]) sid = baseId + '_' + Date.now().toString(36).slice(-4);
      Editor.data.scenes[sid] = {
        id: sid,
        location: (n.name || npcId) + ' — диалог',
        text: '',
        sceneType: 'dialog',
        editorModules: ['story', 'dialogue', 'choices', 'npc', 'components'],
        npcId: npcId,
        dialogue: n.dialogues?.default?.length
          ? n.dialogues.default.map((line) => ({
            speaker: typeof line === 'object' ? (line.speaker || n.name) : n.name,
            text: typeof line === 'object' ? (line.text || '') : String(line)
          }))
          : [{ speaker: n.name || npcId, text: '…' }],
        components: [{
          component: 'dialogue_tree',
          enabled: true,
          params: {
            npc: npcId,
            greeting: n.dialogues?.default?.[0]?.text || 'Здравствуй.',
            topics: [
              { id: 'intro', label: 'Приветствие', reply: n.dialogues?.default?.[0]?.text || '…' },
              { id: 'goodbye', label: 'До свидания', reply: 'Удачи.' }
            ]
          }
        }]
      };
      n.dialogueSceneId = sid;
      Editor.markDirty?.();
      Editor.updateJSONPreview?.();
      return sid;
    },

    findSceneDialogueTree() {
      const scene = Editor.data?.scenes?.[Editor.currentScene];
      return IDX ? IDX.findDialogueTreeComponent(scene) : null;
    },

    renderDialogueAuthoringPanel() {
      const found = Editor.findSceneDialogueTree();
      if (!found) return '';
      const compIndex = found.index;
      const topics = found.params.topics || [];
      const flow = IDX ? IDX.buildDialogueFlowSummary(topics) : [];
      const npcId = found.params.npc || Editor.data?.scenes?.[Editor.currentScene]?.npcId || '';

      let html = '<div class="npc-dialogue-panel" id="npc-dialogue-authoring-panel">';
      html += '<h3>💬 Dialogue Editor</h3>';
      html += '<p class="hint">Модель: dialogue_tree topics — label (выбор игрока), reply (NPC), showIf, actions[], nextTopic / nextScene.</p>';

      if (npcId) {
        html += `<p><strong>NPC:</strong> ${esc(Editor.data?.npcs?.[npcId]?.name || npcId)}</p>`;
      }

      html += '<div class="dialogue-flow-section"><h4>Flow</h4><ul class="dialogue-flow-list">';
      flow.forEach((node) => {
        html += `<li class="dialogue-flow-item"><strong>${esc(node.label)}</strong>`;
        if (node.outgoing.length) {
          html += ' → ' + node.outgoing.map((o) => esc(o.label || o.target)).join(', ');
        } else {
          html += ' <span class="hint">(конец)</span>';
        }
        html += '</li>';
      });
      html += '</ul></div>';

      html += `<button type="button" class="btn btn-secondary btn-sm" onclick="Editor.addDialogueTopicNode(${compIndex})">+ Node</button>`;
      html += '<div id="dialogue-nodes-list">';
      topics.forEach((topic, ti) => {
        html += Editor.renderDialogueTopicNodeEditor(compIndex, ti, topic, flow);
      });
      html += '</div></div>';
      return html;
    },

    renderDialogueTopicNodeEditor(compIndex, topicIndex, topic, flowSummary) {
      const t = IDX ? IDX.normalizeTopic(topic, topicIndex) : (topic || {});
      const topicIds = (flowSummary || []).map((n) => n.id);
      const nextOpts = topicIds.map((id) =>
        `<option value="${escAttr(id)}" ${t.nextTopic === id ? 'selected' : ''}>${esc(id)}</option>`
      ).join('');
      const sceneListId = Editor.allocSmartIdList?.(`dlg-next-${compIndex}-${topicIndex}`) || ('dlg-' + topicIndex);

      let html = `<div class="dialogue-node-card" data-dialogue-node="${topicIndex}">
        <div class="dialogue-node-head"><strong>${esc(t.label || t.id || 'Node')}</strong>
          <button type="button" class="btn-remove" onclick="Editor.removeDialogueTopic(${compIndex},${topicIndex})">×</button></div>`;

      if (!isWriter()) {
        html += `<div class="form-group"><label>Node id</label>
          <input value="${escAttr(t.id || '')}" onchange="Editor.updateDialogueTopicField(${compIndex},${topicIndex},'id',this.value)"></div>`;
      }

      html += `<div class="form-group"><label>Choice text (игрок)</label>
        <input value="${escAttr(t.label || '')}" onchange="Editor.updateDialogueTopicField(${compIndex},${topicIndex},'label',this.value)"></div>`;
      html += `<div class="form-group"><label>NPC text (reply)</label>
        <textarea rows="2" onchange="Editor.updateDialogueTopicField(${compIndex},${topicIndex},'reply',this.value)">${esc(t.reply || '')}</textarea></div>`;

      if (typeof Editor.renderConditionBuilder === 'function') {
        html += '<div class="form-group"><label>Conditions (showIf)</label>';
        html += Editor.renderConditionBuilder(
          () => Editor.getDialogueTopicRef(compIndex, topicIndex),
          'showIf',
          () => Editor.renderDialogueAuthoringInjected?.(),
          { title: 'Показать если', builderSuffix: `dlg-${compIndex}-${topicIndex}-show` }
        );
        html += '</div>';
      }

      html += `<div class="form-group"><label>Actions</label>`;
      const actions = Array.isArray(t.actions) ? t.actions : [];
      if (!actions.length) html += '<p class="hint">Нет действий</p>';
      actions.forEach((step, ai) => {
        html += `<div class="dialogue-action-step"><code>${esc(step.action || '')}</code>
          <button type="button" class="btn-remove" onclick="Editor.removeDialogueTopicAction(${compIndex},${topicIndex},${ai})">×</button></div>`;
      });
      html += `<button type="button" class="btn btn-secondary btn-sm" onclick="Editor.addDialogueTopicAction(${compIndex},${topicIndex})">+ Action</button></div>`;

      html += `<div class="grid-2">
        <div class="form-group"><label>Next node</label>
          <select onchange="Editor.updateDialogueTopicField(${compIndex},${topicIndex},'nextTopic',this.value||undefined)">
            <option value="">—</option>${nextOpts}</select></div>
        <div class="form-group"><label>Next scene</label>
          ${typeof Editor.renderSceneIdField === 'function'
            ? Editor.renderSceneIdField(t.nextScene || t.to || '', sceneListId,
              `Editor.updateDialogueTopicField(${compIndex},${topicIndex},'nextScene',this.value||undefined)`)
            : `<input value="${escAttr(t.nextScene || t.to || '')}" onchange="Editor.updateDialogueTopicField(${compIndex},${topicIndex},'nextScene',this.value||undefined)">`}
        </div></div>`;

      if (typeof Editor.renderChoiceQuestSetBlock === 'function') {
        /* quest on topic via questSet field — reuse pattern inline */
        const qs = t.questSet;
        html += `<div class="form-group"><label>Quest on pick</label>`;
        if (qs) {
          html += `<span class="hint">${esc(qs.questId || '')} → stage ${esc(String(qs.stage ?? ''))}</span>
            <button type="button" class="btn btn-secondary btn-sm" onclick="Editor.clearDialogueTopicQuestSet(${compIndex},${topicIndex})">Clear</button>`;
        } else {
          html += `<button type="button" class="btn btn-secondary btn-sm" onclick="Editor.setDialogueTopicQuestSet(${compIndex},${topicIndex})">+ Quest</button>`;
        }
        html += '</div>';
      }

      html += '</div>';
      return html;
    },

    getDialogueTopicRef(compIndex, topicIndex) {
      const topics = Editor.data?.scenes?.[Editor.currentScene]?.components?.[compIndex]?.params?.topics;
      if (!Array.isArray(topics) || !topics[topicIndex]) return null;
      let top = topics[topicIndex];
      if (typeof top === 'string') {
        top = { label: top, reply: '' };
        topics[topicIndex] = top;
      }
      return top;
    },

    addDialogueTopicNode(compIndex) {
      const comp = Editor.data?.scenes?.[Editor.currentScene]?.components?.[compIndex];
      if (!comp) return;
      if (!comp.params) comp.params = {};
      if (!Array.isArray(comp.params.topics)) comp.params.topics = [];
      const n = comp.params.topics.length + 1;
      comp.params.topics.push({ id: 'node_' + n, label: 'Новый выбор', reply: '' });
      Editor.renderSceneEditor?.();
      Editor.updateJSONPreview?.();
    },

    addDialogueTopicAction(compIndex, topicIndex) {
      Editor.openUnifiedActionPicker?.({
        title: 'Действие при выборе темы',
        onSelect(step) {
          const top = Editor.getDialogueTopicRef(compIndex, topicIndex);
          if (!top) return;
          if (!Array.isArray(top.actions)) top.actions = [];
          top.actions.push({ action: step.action, params: step.params || {} });
          Editor.markDirty?.();
          Editor.updateJSONPreview?.();
          Editor.renderDialogueAuthoringInjected?.();
        }
      });
    },

    removeDialogueTopicAction(compIndex, topicIndex, actionIndex) {
      const top = Editor.getDialogueTopicRef(compIndex, topicIndex);
      if (!top?.actions) return;
      top.actions.splice(actionIndex, 1);
      Editor.renderDialogueAuthoringInjected?.();
      Editor.updateJSONPreview?.();
    },

    setDialogueTopicQuestSet(compIndex, topicIndex) {
      const qids = Editor.getQuestIds?.() || Object.keys(Editor.data?.quests || {});
      const qid = qids[0];
      if (!qid) return;
      const top = Editor.getDialogueTopicRef(compIndex, topicIndex);
      if (!top) return;
      top.questSet = { questId: qid, stage: '1' };
      Editor.renderDialogueAuthoringInjected?.();
      Editor.updateJSONPreview?.();
    },

    clearDialogueTopicQuestSet(compIndex, topicIndex) {
      const top = Editor.getDialogueTopicRef(compIndex, topicIndex);
      if (!top) return;
      delete top.questSet;
      Editor.renderDialogueAuthoringInjected?.();
      Editor.updateJSONPreview?.();
    },

    renderVisualNpcPlacementBar() {
      if (!Editor.data?.scenes?.[Editor.currentScene]?.visual) return '';
      let html = '<div class="visual-npc-bar" id="visual-npc-placement-bar">';
      html += '<span class="hint">Add NPC:</span>';
      if (typeof Editor.renderEntityPicker === 'function') {
        html += Editor.renderEntityPicker({
          kind: 'npc',
          value: Editor._visualNpcPick || '',
          id: 'visual-npc-pick',
          onChange: 'Editor._visualNpcPick=this.value'
        });
      }
      html += '<button type="button" class="btn btn-secondary btn-sm" onclick="Editor.visualPlaceNpc(\'talk\')">Talk</button>';
      html += '<button type="button" class="btn btn-secondary btn-sm" onclick="Editor.visualPlaceNpc(\'trade\')">Trade</button>';
      html += '<button type="button" class="btn btn-secondary btn-sm" onclick="Editor.visualPlaceNpc(\'attack\')">Attack</button>';
      html += '</div>';
      return html;
    },

    visualPlaceNpc(interaction) {
      const npcId = Editor._visualNpcPick || document.querySelector('#visual-npc-pick [data-value]')?.getAttribute('data-value');
      if (!npcId) {
        Editor.toast.warning('Выберите NPC');
        return;
      }
      const npc = Editor.data?.npcs?.[npcId];
      if (!npc) return;
      if (interaction === 'trade' && !npc.shop) {
        Editor.toast.warning('У NPC не включён shop');
        return;
      }
      const steps = IDX
        ? IDX.buildVisualNpcHotspotActions(npc, interaction, Editor.data, {})
        : null;
      if (!steps || !steps.length) {
        Editor.toast.warning('Interaction недоступен');
        return;
      }
      if (typeof Editor.visualAddNode !== 'function') return;
      const nodeId = Editor.visualAddNode('hotspot');
      if (!nodeId) return;
      const scene = Editor.data.scenes[Editor.currentScene];
      const node = scene?.visual?.nodes?.find((n) => n.id === nodeId);
      if (node) {
        node.props = node.props || {};
        node.props.label = (npc.name || npcId) + ' (' + interaction + ')';
        if (!node.events) node.events = {};
        node.events.click = steps.slice();
      }
      Editor.renderVisualScenePanel?.();
      Editor.toast?.success?.('Hotspot: ' + (npc.name || npcId));
    },

    renderDialogueAuthoringInjected() {
      const builder = document.querySelector('#scene-editor .scene-builder');
      if (!builder) return;
      let panel = document.getElementById('npc-dialogue-authoring-panel');
      const html = Editor.renderDialogueAuthoringPanel();
      if (!html) {
        if (panel) panel.remove();
        return;
      }
      if (panel) panel.outerHTML = html;
      else builder.insertAdjacentHTML('beforeend', html);
      panel = document.getElementById('npc-dialogue-authoring-panel');
      if (panel && typeof Editor.bindConditionBuilders === 'function') {
        Editor.bindConditionBuilders(panel);
      }
      if (panel && typeof Editor.bindEntityPickers === 'function') {
        Editor.bindEntityPickers(panel);
      }
    },

    renderVisualNpcBarInjected() {
      const host = document.getElementById('visual-scene-editor-panel');
      if (!host) return;
      let bar = document.getElementById('visual-npc-placement-bar');
      const html = Editor.renderVisualNpcPlacementBar();
      if (!html) {
        if (bar) bar.remove();
        return;
      }
      if (bar) bar.outerHTML = html;
      else host.insertAdjacentHTML('afterbegin', html);
      bar = document.getElementById('visual-npc-placement-bar');
      if (bar && typeof Editor.bindEntityPickers === 'function') {
        Editor.bindEntityPickers(bar);
      }
    }
  });

  if (Editor.hooks?.after) {
    Editor.hooks.after('renderNpcDetail', function npcAuthoringExtra(html, args) {
      try {
        ensureStyles();
        const id = (args && args[0]) || Editor.editingNpcId;
        return (html || '') + (Editor.renderNpcAuthoringExtra?.(id) || '');
      } catch (e) {
        console.warn('[phase-113 npc]', e);
        return html;
      }
    }, 'editor-npc-dialogue-phase-113-npc');

    Editor.hooks.after('renderSceneEditor', function dialogueAuthoringInject() {
      try {
        ensureStyles();
        Editor.renderDialogueAuthoringInjected?.();
      } catch (e) {
        console.warn('[phase-113 dialogue]', e);
      }
    }, 'editor-npc-dialogue-phase-113-scene');

    Editor.hooks.after('renderVisualScenePanel', function visualNpcBar() {
      try {
        ensureStyles();
        Editor.renderVisualNpcBarInjected?.();
      } catch (e) {
        console.warn('[phase-113 visual]', e);
      }
    }, 'editor-npc-dialogue-phase-113-visual');
  }
})();
