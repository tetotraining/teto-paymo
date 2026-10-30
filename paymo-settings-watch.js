(() => {
  const PAYEE_KEY = 'paymo_payees_v1';
  const TOKEN_KEY = 'paymo_token_v1';
  let snapshot = localStorage.getItem(PAYEE_KEY) || '';
  let sending = false;

  window.addEventListener('paymo:settings-synced', () => {
    snapshot = localStorage.getItem(PAYEE_KEY) || '';
  });

  async function check() {
    if (sending || !localStorage.getItem(TOKEN_KEY) || typeof window.paymoSyncSettings !== 'function') return;
    const current = localStorage.getItem(PAYEE_KEY) || '';
    if (current === snapshot) return;
    let payees;
    try { payees = JSON.parse(current || '[]'); }
    catch { return; }
    if (!Array.isArray(payees)) return;
    sending = true;
    try {
      await window.paymoSyncSettings({ payees });
      snapshot = current;
    } catch {} finally {
      sending = false;
    }
  }

  setInterval(check, 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  window.addEventListener('online', check);
})();
