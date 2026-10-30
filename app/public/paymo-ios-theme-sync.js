(() => {
  function syncThemeChrome() {
    const root = document.documentElement;
    const dark = root.dataset.theme !== 'light';
    const bg = getComputedStyle(root).getPropertyValue('--page-bg').trim() || (dark ? '#050605' : '#f5f5f3');

    root.style.colorScheme = dark ? 'dark' : 'light';
    root.style.backgroundColor = bg;
    if (document.body) document.body.style.backgroundColor = bg;

    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', bg);
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
