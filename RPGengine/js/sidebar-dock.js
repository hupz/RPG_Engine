/**
 * Боковой dock: иконки 🎒 🔊 📁 открывают overlay-панели.
 * Одновременно активна только одна панель; повторный клик — закрытие.
 */
const SidebarDock = {
  activePanel: null,

  init() {
    const dock = document.getElementById('sidebar-dock');
    if (!dock || dock.dataset.bound === '1') return;
    dock.dataset.bound = '1';

    dock.querySelectorAll('.dock-icon').forEach(btn => {
      btn.addEventListener('click', () => this.toggle(btn.dataset.panel));
    });

    document.querySelectorAll('.panel-close').forEach(btn => {
      btn.addEventListener('click', () => this.close(btn.dataset.panel));
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activePanel) this.closeAll();
    });
  },

  /** Показать/скрыть dock вместе с основным sidebar (экран выбора кампании) */
  setVisible(visible) {
    const dock = document.getElementById('sidebar-dock');
    const wrap = document.getElementById('sidebar-panels-wrap');
    if (dock) dock.classList.toggle('hidden', !visible);
    if (wrap) {
      wrap.classList.toggle('hidden', !visible);
      wrap.setAttribute('aria-hidden', visible ? 'false' : 'true');
    }
    if (!visible) this.closeAll();
  },

  toggle(panelId) {
    if (!panelId) return;
    if (this.activePanel === panelId) {
      this.closeAll();
    } else {
      this.open(panelId);
    }
  },

  open(panelId) {
    this.closeAll();
    const panel = document.getElementById('panel-' + panelId);
    const icon = document.querySelector(`.dock-icon[data-panel="${panelId}"]`);
    if (panel) {
      panel.classList.add('panel-active');
      panel.setAttribute('aria-hidden', 'false');
    }
    if (icon) icon.classList.add('dock-icon-active');
    this.activePanel = panelId;

    const wrap = document.getElementById('sidebar-panels-wrap');
    if (wrap) wrap.setAttribute('aria-hidden', 'false');
  },

  close(panelId) {
    if (this.activePanel === panelId) this.closeAll();
  },

  closeAll() {
    document.querySelectorAll('.panel-overlay').forEach(p => {
      p.classList.remove('panel-active');
      p.setAttribute('aria-hidden', 'true');
    });
    document.querySelectorAll('.dock-icon').forEach(i => i.classList.remove('dock-icon-active'));
    this.activePanel = null;

    const wrap = document.getElementById('sidebar-panels-wrap');
    if (wrap && !document.querySelector('.panel-overlay.panel-active')) {
      wrap.setAttribute('aria-hidden', 'true');
    }
  }
};
