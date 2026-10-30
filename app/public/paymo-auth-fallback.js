(() => {
  async function releaseIfBackendUnavailable() {
    try {
      const response = await fetch(`/api/me?probe=${Date.now()}`, { cache: 'no-store' });
      if (response.status !== 503) return;
      document.documentElement.classList.remove('paymo-auth-locked');
      const root = document.getElementById('paymoAuthRoot');
      if (root) root.hidden = true;
      window.paymoAccountBackendUnavailable = true;
    } catch {
      document.documentElement.classList.remove('paymo-auth-locked');
      const root = document.getElementById('paymoAuthRoot');
      if (root) root.hidden = true;
      window.paymoAccountBackendUnavailable = true;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', releaseIfBackendUnavailable, { once: true });
  } else {
    releaseIfBackendUnavailable();
  }
})();
