// Универсальный компонент: меню услуг (кузнец, храм, жрец, …)
(function () {
  const ServiceMenuComponent = {
    defaultParams: {
      header: 'Услуги',
      services: []
    },

    render(engine, container, compDef, ctx) {
      const p = { ...this.defaultParams, ...SceneComponentBase.getConfig(compDef) };
      const preview = ctx.preview;
      const services = p.services || [];

      const panelHosts = [];
      let body = SceneComponentBase.previewNote(preview);

      if (!services.length) {
        body += '<p class="hint">Нет услуг в конфигурации.</p>';
      }

      services.forEach((svc, svcIndex) => {
        if (!svc) return;
        const cond = svc.condition || svc.conditions;
        if (cond && !SceneComponentBase.checkCondition(engine, cond)) return;

        const type = svc.type || 'action';
        const label = svc.label || svc.id || 'Услуга';
        const icon = svc.icon || '▸';
        const desc = svc.description || svc.desc || '';

        if (type === 'panel' && svc.panel) {
          const hostId = `svc-panel-${ctx.index}-${svcIndex}`;
          body += `<div class="service-menu-panel-host" id="${hostId}"></div>`;
          panelHosts.push({
            hostId,
            panelType: svc.panel,
            panelParams: svc.panelParams || svc.params || {}
          });
          return;
        }

        if (type === 'chain' && svc.chain) {
          const costStr = svc.cost ? SceneComponentBase.renderCost(engine, svc.cost) : '';
          body += `<div class="service-menu-row">
            <button type="button" class="choice service-menu-btn" ${preview ? 'disabled' : ''}
              data-svc="${svcIndex}" data-kind="chain">
              ${SceneComponentBase.escape(engine, icon)} ${SceneComponentBase.escape(engine, label)}
              ${costStr ? `<span class="service-cost">(${SceneComponentBase.escape(engine, costStr)})</span>` : ''}
            </button>
            ${desc ? `<p class="hint service-desc">${SceneComponentBase.escape(engine, desc)}</p>` : ''}
          </div>`;
          return;
        }

        const action = svc.action || svc.actionRef;
        const costStr = svc.cost ? SceneComponentBase.renderCost(engine, svc.cost) : '';
        const canRun = !preview && action && (!svc.cost || (typeof ActionContext !== 'undefined' && ActionContext.canAfford(engine, svc.cost)));

        body += `<div class="service-menu-row">
          <button type="button" class="choice service-menu-btn" ${!canRun ? 'disabled' : ''}
            data-svc="${svcIndex}" data-kind="action">
            ${SceneComponentBase.escape(engine, icon)} ${SceneComponentBase.escape(engine, label)}
            ${costStr ? `<span class="service-cost">(${SceneComponentBase.escape(engine, costStr)})</span>` : ''}
          </button>
          ${desc ? `<p class="hint service-desc">${SceneComponentBase.escape(engine, desc)}</p>` : ''}
        </div>`;
      });

      const head = SceneComponentBase.escape(engine, p.header || 'Услуги');
      container.innerHTML = SceneComponentBase.wrap('service_menu', head, body);

      panelHosts.forEach(({ hostId, panelType, panelParams }) => {
        const host = container.querySelector(`#${hostId}`);
        if (!host) return;
        const renderer = SceneComponentRegistry.get(panelType)
          || (typeof SceneComponentPanels !== 'undefined' ? SceneComponentPanels.get(panelType) : null);
        if (!renderer) {
          host.innerHTML = `<p class="hint">Неизвестная панель: ${panelType}</p>`;
          return;
        }
        try {
          renderer.render(engine, host, { component: panelType, params: panelParams, enabled: true }, ctx);
        } catch (e) {
          host.innerHTML = `<p class="hint">Ошибка панели: ${panelType}</p>`;
        }
      });

      if (!preview) {
        container.querySelectorAll('.service-menu-btn').forEach((btn) => {
          btn.onclick = () => {
            const idx = parseInt(btn.getAttribute('data-svc'), 10);
            const kind = btn.getAttribute('data-kind');
            const svc = services[idx];
            if (!svc) return;
            if (kind === 'chain' && svc.chain) {
              engine.executeChain?.(svc.chain);
              engine.refreshSceneComponents?.();
              return;
            }
            const actionId = svc.action || svc.actionRef;
            const params = { ...(svc.actionParams || svc.params || {}), cost: svc.cost };
            Promise.resolve(SceneComponentBase.runAction(engine, actionId, params, {
              scene: ctx.scene,
              component: compDef
            })).then(() => engine.refreshSceneComponents?.());
          };
        });
      }
    }
  };

  SceneComponentRegistry.register('service_menu', ServiceMenuComponent);
})();
