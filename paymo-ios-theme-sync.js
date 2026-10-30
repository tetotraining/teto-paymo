(() => {
  const isStandaloneIOS = /iP(hone|ad|od)/.test(navigator.userAgent) &&
    (window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches);

  function restoreDesignAfterThemeRefresh() {
    if (!document.documentElement.hasAttribute('data-theme-reload')) return;

    const reveal = () => {
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById('design')?.classList.add('active');
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('.nav-btn[data-view="menu"]')?.classList.add('active');
      document.getElementById('paymoLaunchSplash')?.remove();
      document.documentElement.removeAttribute('data-theme-reload');
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(reveal), { once: true });
    } else {
      requestAnimationFrame(reveal);
    }
  }

  document.addEventListener('change', event => {
    const target = event.target;
    if (!isStandaloneIOS || target?.id !== 'paymoDarkModeToggle') return;

    // iOS 27 standalone PWAs do not repaint the system status-bar strip on a
    // live theme-color/background change. Refresh only the web view, suppress
    // the launch splash, and restore the same Design Settings screen.
    sessionStorage.setItem('paymo_theme_reload', '1');
    requestAnimationFrame(() => window.location.reload());
  });

  restoreDesignAfterThemeRefresh();
})();
