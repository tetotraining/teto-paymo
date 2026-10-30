(() => {
  let animationFrame = 0;

  function scrollToTopSmooth() {
    const startY = window.scrollY || document.documentElement.scrollTop || 0;
    if (startY <= 2) return;

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      window.scrollTo(0, 0);
      return;
    }

    if (animationFrame) cancelAnimationFrame(animationFrame);
    const startedAt = performance.now();
    const duration = Math.min(720, Math.max(460, 460 + startY * 0.08));

    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      window.scrollTo(0, Math.round(startY * (1 - eased)));
      if (progress < 1) animationFrame = requestAnimationFrame(tick);
      else animationFrame = 0;
    };

    animationFrame = requestAnimationFrame(tick);
  }

  document.addEventListener('click', (event) => {
    const button = event.target?.closest?.('.nav-btn[data-view]');
    if (!button || !button.classList.contains('active')) return;

    const activeView = document.querySelector('.view.active');
    if (!activeView || activeView.id !== button.dataset.view) return;

    scrollToTopSmooth();
  });

  async function releaseAuthIfBackendUnavailable() {
    try {
      const response = await fetch(`/api/me?probe=${Date.now()}`, { cache: 'no-store' });
      if (response.status !== 503) return;
    } catch {}
    document.documentElement.classList.remove('paymo-auth-locked');
    const root = document.getElementById('paymoAuthRoot');
    if (root) root.hidden = true;
    window.paymoAccountBackendUnavailable = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', releaseAuthIfBackendUnavailable, { once: true });
  } else {
    releaseAuthIfBackendUnavailable();
  }
})();
