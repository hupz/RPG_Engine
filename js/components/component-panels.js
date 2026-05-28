// Универсальные панели услуг: только UI, логика в ACTION_REGISTRY (runAction)
(function () {
  const PanelActions = {
    async run(actionId, params, extraCtx) {
      if (typeof SceneComponentBase === 'undefined') return;
      await SceneComponentBase.runAction(GameEngine, actionId, params || {}, extraCtx || {});
      GameEngine.refreshSceneComponents?.();
      GameEngine.updateStats?.();
    },
    runGamble(inputId, min, max, resultId) {
      const inp = document.getElementById(inputId);
      let bet = parseInt(inp?.value, 10) || min;
      bet = Math.max(min, Math.min(max, bet));
      return PanelActions.run('gamble_dice', { bet, minBet: min, maxBet: max }).then(() => {
        const el = document.getElementById(resultId);
        if (el && GameEngine._lastGambleMsg) el.textContent = GameEngine._lastGambleMsg;
      });
    },
    runCraft(btn) {
      if (!btn?.dataset) return Promise.resolve();
      let materials = {};
      try {
        materials = JSON.parse(btn.dataset.mats || '{}');
      } catch (e) { /* ignore */ }
      return PanelActions.run('craft_item', {
        resultId: btn.dataset.resultId,
        materials
      });
    }
  };
  if (typeof window !== 'undefined') window.PanelActions = PanelActions;

  function attr(engine, s) {
    return SceneComponentBase.attr(engine, s);
  }

  function esc(engine, s) {
    return SceneComponentBase.escape(engine, s);
  }

  const RepairPanel = {
    defaultParams: { npc: 'blacksmith_npc', flatCost: 15, costPerDurability: 1 },
    render(engine, container, compDef, ctx) {
      const p = { ...this.defaultParams, ...SceneComponentBase.getConfig(compDef) };
      const preview = ctx.preview;
      const npc = SceneComponentBase.getNpcName(engine, p.npc, 'Мастер');
      const cost = Math.max(1, parseInt(p.flatCost ?? p.costPerDurability, 10) || 15);
      const slots = engine.ENHANCEMENT_SLOTS || ['weapon_main', 'armor', 'shield'];
      let rows = '';
      slots.forEach((slot) => {
        const id = engine.getEquippedItemId?.(slot);
        const item = id ? engine.getEffectiveItemData?.(id) : null;
        const label = slot === 'weapon_main' ? 'Оружие' : slot === 'armor' ? 'Броня' : 'Щит';
        if (!item) {
          rows += `<p class="hint">${label}: пусто</p>`;
          return;
        }
        const lvl = engine.getItemEnhancementLevel?.(id) || 0;
        const worn = lvl > 0;
        const btn = worn && !preview
          ? `<button type="button" class="choice" onclick="PanelActions.run('repair_item',{itemId:'${attr(engine, id)}',cost:${cost}})">Починить за ${cost} зм</button>`
          : worn && preview ? '<button type="button" class="choice" disabled>Починить</button>' : '';
        rows += `<div class="repair-row"><span>${esc(engine, item.name)} ${worn ? `(износ +${lvl})` : '(в порядке)'}</span> ${btn}</div>`;
      });
      container.innerHTML = SceneComponentBase.wrap(
        'repair_panel',
        `⚒️ Ремонт — ${esc(engine, npc)}`,
        `${SceneComponentBase.previewNote(preview)}<p class="hint">Сбрасывает заточку (износ). Цена: ${cost} зм.</p>${rows}`
      );
    }
  };

  const UpgradePanel = {
    defaultParams: { npc: 'blacksmith_npc', maxEnhancement: 3, costTable: [100, 300, 900] },
    render(engine, container, compDef, ctx) {
      const p = { ...this.defaultParams, ...SceneComponentBase.getConfig(compDef) };
      const preview = ctx.preview;
      const npc = SceneComponentBase.getNpcName(engine, p.npc, 'Мастер');
      if (preview) {
        container.innerHTML = SceneComponentBase.wrap(
          'upgrade_panel',
          `⬆️ ${esc(engine, npc)}`,
          `${SceneComponentBase.previewNote(true)}<p class="hint">Заточка до +${p.maxEnhancement}</p>`
        );
        return;
      }
      engine.state.blacksmithSession = {
        sceneId: ctx.sceneId,
        message: '',
        componentIndex: ctx.index,
        componentContainer: container,
        costTable: p.costTable,
        maxEnhancement: p.maxEnhancement
      };
      const entries = engine.getBlacksmithEnhanceableEntries?.() || [];
      let equipHtml = '<div class="blacksmith-equipped">';
      (engine.ENHANCEMENT_SLOTS || []).forEach((slot) => {
        const id = engine.getEquippedItemId(slot);
        const item = id ? engine.getEffectiveItemData(id) : null;
        const slotLabel = slot === 'weapon_main' ? 'Оружие' : slot === 'armor' ? 'Броня' : 'Щит';
        equipHtml += item
          ? `<div class="blacksmith-slot">${slotLabel}: <b>${esc(engine, item.name)}</b> (+${engine.getItemEnhancementLevel(id)})</div>`
          : `<div class="blacksmith-slot">${slotLabel}: <span class="hint">— пусто —</span></div>`;
      });
      equipHtml += '</div>';
      let actionsHtml = '';
      if (entries.length) {
        entries.forEach((e) => {
          const afford = engine.state.gold >= e.cost;
          actionsHtml += `<button type="button" class="choice" ${afford ? '' : 'disabled'}
            ${afford ? `onclick="PanelActions.run('enhance_item',{itemId:'${attr(engine, e.itemId)}'})"` : ''}>
            Заточить ${esc(engine, e.name)} до +${e.next} — ${e.cost} зм
          </button>`;
        });
      } else {
        actionsHtml = '<p class="hint">Нет доступных улучшений.</p>';
      }
      const session = engine.state.blacksmithSession;
      const msg = session.message ? `<p class="shop-flash">${esc(engine, session.message)}</p>` : '';
      container.innerHTML = SceneComponentBase.wrap(
        'upgrade_panel',
        `⬆️ Заточка — ${esc(engine, npc)}`,
        `<p class="hint">💰 ${engine.state.gold} зм</p>${msg}${equipHtml}<div class="blacksmith-actions">${actionsHtml}</div>`
      );
    }
  };

  const CurseRemovePanel = {
    defaultParams: { npc: 'priest', costBase: 50 },
    render(engine, container, compDef, ctx) {
      const p = { ...this.defaultParams, ...SceneComponentBase.getConfig(compDef) };
      const preview = ctx.preview;
      const npc = SceneComponentBase.getNpcName(engine, p.npc, 'Священник');
      const entries = preview ? [] : (engine.getEquippedCursedEntries?.() || []);
      let list = '';
      if (!entries.length) {
        list = '<p class="hint">Нет надетых проклятых предметов.</p>';
      } else {
        entries.forEach((e) => {
          const afford = engine.state.gold >= e.cost;
          list += `<div class="curse-row">
            <span><b>${esc(engine, e.item.name)}</b> — ${e.cost} зм</span>
            <button type="button" class="choice" ${!afford || preview ? 'disabled' : ''}
              ${preview ? '' : `onclick="PanelActions.run('remove_curse',{itemId:'${attr(engine, e.itemId)}',cost:${e.cost}})"`}>
              Снять проклятие
            </button>
          </div>`;
        });
      }
      if (!preview) {
        engine.state.templePriestSession = {
          sceneId: ctx.sceneId,
          message: '',
          componentIndex: ctx.index
        };
      }
      container.innerHTML = SceneComponentBase.wrap(
        'curse_remove_panel',
        `✨ ${esc(engine, npc)}`,
        `${SceneComponentBase.previewNote(preview)}${list}`
      );
    }
  };

  const GamblePanel = {
    defaultParams: { npc: 'jack', minBet: 5, maxBet: 50 },
    render(engine, container, compDef, ctx) {
      const p = { ...this.defaultParams, ...SceneComponentBase.getConfig(compDef) };
      const preview = ctx.preview;
      const npc = SceneComponentBase.getNpcName(engine, p.npc, 'Игрок');
      const min = Math.max(1, parseInt(p.minBet, 10) || 5);
      const max = Math.max(min, parseInt(p.maxBet, 10) || 50);
      const hostId = `gamble-result-${ctx.index}`;
      container.innerHTML = SceneComponentBase.wrap(
        'gamble_panel',
        `🎲 ${esc(engine, npc)}`,
        `${SceneComponentBase.previewNote(preview)}
         <p>Кости: ставка ${min}–${max} зм. Выигрыш ×2 при броске 15+.</p>
         <label>Ставка: <input type="number" id="gamble-bet-${ctx.index}" min="${min}" max="${max}" value="${min}" style="width:60px;" ${preview ? 'disabled' : ''}></label>
         <button type="button" class="choice" ${preview ? 'disabled' : ''}
           ${preview ? '' : `onclick="PanelActions.runGamble('gamble-bet-${ctx.index}',${min},${max},'${hostId}')"`}>
           🎲 Бросить кости
         </button>
         <div id="${hostId}" class="hint"></div>`
      );
    }
  };

  const CraftPanel = {
    defaultParams: { npc: 'blacksmith_npc', recipes: [] },
    render(engine, container, compDef, ctx) {
      const p = { ...this.defaultParams, ...SceneComponentBase.getConfig(compDef) };
      const preview = ctx.preview;
      const npc = SceneComponentBase.getNpcName(engine, p.npc, 'Мастер');
      const recipes = Array.isArray(p.recipes) ? p.recipes : [];
      let rows = '';
      recipes.forEach((r, i) => {
        const rec = typeof r === 'string' ? { id: r, result: r } : r;
        const resultId = rec.result || rec.itemId || rec.id;
        const db = engine.data?.items?.[resultId];
        const mats = rec.materials || rec.cost || {};
        const matStr = Object.entries(mats).map(([k, v]) => `${k}×${v}`).join(', ') || '—';
        rows += `<div class="craft-row">
          <span>${esc(engine, db?.name || resultId)}</span>
          <span class="hint">${esc(engine, matStr)}</span>
          <button type="button" class="choice" ${preview ? 'disabled' : ''}
            data-result-id="${attr(engine, resultId)}"
            data-mats="${attr(engine, JSON.stringify(mats))}"
            ${preview ? '' : 'onclick="PanelActions.runCraft(this)"'}>
            Создать
          </button>
        </div>`;
      });
      if (!rows) rows = '<p class="hint">Нет рецептов в panelParams.recipes</p>';
      container.innerHTML = SceneComponentBase.wrap(
        'craft_panel',
        `🔨 ${esc(engine, npc)}`,
        `${SceneComponentBase.previewNote(preview)}${rows}`
      );
    }
  };

  const PANEL_MAP = {
    repair_panel: RepairPanel,
    upgrade_panel: UpgradePanel,
    enhance_panel: UpgradePanel,
    curse_remove_panel: CurseRemovePanel,
    gamble_panel: GamblePanel,
    craft_panel: CraftPanel
  };

  Object.keys(PANEL_MAP).forEach((id) => {
    SceneComponentRegistry.register(id, PANEL_MAP[id]);
  });

  if (typeof window !== 'undefined') {
    window.SceneComponentPanels = { PANEL_MAP, get: (id) => PANEL_MAP[id] || null };
  }
})();
