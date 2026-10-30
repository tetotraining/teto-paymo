(() => {
  function syncThemeChrome() {
    const root = document.documentElement;
    const dark = root.dataset.theme !== 'light';
    const bg = getComputedStyle(root).getPropertyValue('--page-bg').trim() || (dark ? '#050605' : '#f5f5f3');

    root.style.colorScheme = dark ? 'dark' : 'light';
    root.style.backgroundColor = bg;
    if (document.body) document.body.style.backgroundColor = bg;

    let themeMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeMeta) {
      themeMeta = document.createElement('meta');
      themeMeta.name = 'theme-color';
      document.head.appendChild(themeMeta);
    }
    themeMeta.setAttribute('content', bg);

    let statusMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (!statusMeta) {
      statusMeta = document.createElement('meta');
      statusMeta.name = 'apple-mobile-web-app-status-bar-style';
      document.head.appendChild(statusMeta);
    }
    statusMeta.setAttribute('content', 'black');
  }

  document.addEventListener('change', (event) => {
    if (event.target?.id !== 'paymoDarkModeToggle') return;
    requestAnimationFrame(syncThemeChrome);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncThemeChrome();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncThemeChrome, { once: true });
  } else {
    syncThemeChrome();
  }
})();
