(() => {
  const DARK_BG = '#050605';
  const LIGHT_BG = '#f5f5f3';
  const BOUND = 'paymoThemeChromeBound';

  function darkFromStorage() {
    return localStorage.getItem('paymo_dark_mode') !== '0';
  }

  function syncThemeChrome(forcedDark) {
    const root = document.documentElement;
    const dark = typeof forcedDark === 'boolean' ? forcedDark : (root.dataset.theme ? root.dataset.theme !== 'light' : darkFromStorage());
    const bg = dark ? DARK_BG : LIGHT_BG;

    root.dataset.theme = dark ? 'dark' : 'light';
    root.style.colorScheme = dark ? 'dark' : 'light';
    root.style.setProperty('--page-bg', bg);
    root.style.setProperty('--bg', bg);
    root.style.backgroundColor = bg;
    if (document.body) document.body.style.backgroundColor = bg;

    let themeMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeMeta) {
      themeMeta = document.createElement('meta');
      themeMeta.name = 'theme-color';
      document.head.appendChild(themeMeta);
    }
    themeMeta.content = bg;

    document.querySelectorAll('meta[name="apple-mobile-web-app-status-bar-style"]').forEach((meta) => meta.remove());
  }

  function bindToggle() {
    const toggle = document.getElementById('paymoDarkModeToggle');
    if (!toggle || toggle.dataset[BOUND] === '1') return;
    toggle.dataset[BOUND] = '1';

    // Capture on the toggle itself: request the iOS chrome change before the app's
    // normal onchange handler paints the rest of the theme. Stop bubbling so the
    // old document-level reload workaround can never fire.
    toggle.addEventListener('change', (event) => {
      syncThemeChrome(toggle.checked);
      event.stopPropagation();
    }, true);
  }

  window.paymoSyncThemeChrome = syncThemeChrome;

  const observer = new MutationObserver(bindToggle);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      syncThemeChrome();
      bindToggle();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      syncThemeChrome();
      bindToggle();
    }, { once: true });
  } else {
    syncThemeChrome();
    bindToggle();
  }
})();
