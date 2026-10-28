(() => {
  const API = '/api/expenses';
  const CLIENT_KEY_STORAGE = 'paymo-d1-client-key-v1';

  function getClientKey() {
    let key = localStorage.getItem(CLIENT_KEY_STORAGE);
    if (key) return key;
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    key = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(CLIENT_KEY_STORAGE, key);
    return key;
  }

  const clientKey = getClientKey();

  async function api(method = 'GET', body) {
    const response = await fetch(API, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-paymo-key': clientKey
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`API ${response.status}`);
    return response.json();
  }

  window.paymoSyncExpenses = async (rows) => {
    const expensesToSync = Array.isArray(rows) ? rows.filter(Boolean) : [];
    if (!expensesToSync.length) return;
    return api('POST', { expenses: expensesToSync });
  };

  async function syncFromD1() {
    try {
      const local = JSON.parse(localStorage.getItem(KEY) || '[]');
      const data = await api('GET');
      const remote = Array.isArray(data.expenses) ? data.expenses : [];
      const remoteIds = new Set(remote.map(item => item.id));
      const unsynced = local.filter(item => item?.id && !remoteIds.has(item.id));

      if (unsynced.length) {
        await window.paymoSyncExpenses(unsynced);
      }

      const merged = new Map();
      remote.forEach(item => merged.set(item.id, item));
      local.forEach(item => merged.set(item.id, item));
      expenses = Array.from(merged.values());
      localStorage.setItem(KEY, JSON.stringify(expenses));
      render();
    } catch {
      // D1未接続・一時的な通信失敗時は既存の端末保存をそのまま利用する。
    }
  }

  const originalOpenSheet = $('addBtn').onclick;
  if (typeof originalOpenSheet === 'function') $('addBtn').onclick = originalOpenSheet;

  $('saveBtn').onclick = async () => {
    const amount = Number(String($('amount').value).replace(/[^0-9]/g, ''));
    if (!amount) {
      $('amount').focus();
      return;
    }

    const expense = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      amount,
      payee: selectedPayee,
      usageDate: $('usageDate')?.value || today(),
      date: $('date').value || today()
    };

    expenses.push(expense);
    localStorage.setItem(KEY, JSON.stringify(expenses));
    closeSheet();
    render();
    showToast();

    try {
      await api('POST', { expense });
    } catch {
      // オフライン時も端末内に残し、次回起動時に自動同期する。
    }
  };

  syncFromD1();
})();
