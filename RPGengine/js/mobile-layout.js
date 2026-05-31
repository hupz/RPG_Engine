/**
 * Подключение mobile.css и класс body.mobile по ширине / touch.
 */
(function attachMobileLayout() {
  const LINK_ID = 'rpg-mobile-css';
  const BREAKPOINT = 768;
  let resizeTimer = null;

  function isMobileContext() {
    return window.innerWidth < BREAKPOINT || 'ontouchstart' in window;
  }

  function applyMobileMode(mobile) {
    document.body.classList.toggle('mobile', mobile);
    let link = document.getElementById(LINK_ID);
    if (mobile) {
      if (!link) {
        link = document.createElement('link');
        link.id = LINK_ID;
        link.rel = 'stylesheet';
        link.href = 'css/mobile.css';
        document.head.appendChild(link);
      }
    } else if (link) {
      link.remove();
    }
    window.dispatchEvent(new CustomEvent('rpg-mobile-change', { detail: { mobile } }));
  }

  function update() {
    applyMobileMode(isMobileContext());
  }

  window.RpgMobileLayout = {
    isMobile: isMobileContext,
    refresh: update
  };

  function boot() {
    if (!document.body) {
      requestAnimationFrame(boot);
      return;
    }
    update();
  }

  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(update, 200);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
