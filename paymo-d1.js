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

  function installmentSignature(item) {
    const raw = Array.isArray(item?.installments) && item.installments.length
      ? item.installments
      : [{ date: item?.date || '', amount: Number(item?.amount || 0) }];
    return JSON.stringify(raw.slice(0, 3).map((part) => ({ date: String(part?.date || ''), amount: Number(part?.amount || 0) })));
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
      const remoteById = new Map(remote.map(item => [item.id, item]));
      const needsSync = local.filter(item => {
        if (!item?.id) return false;
        const saved = remoteById.get(item.id);
        if (!saved) return true;
        const localUsage = item.usageDate || item.usage_date || item.date || '';
        const remoteUsage = saved.usageDate || saved.usage_date || saved.date || '';
        return Number(saved.amount) !== Number(item.amount) ||
          saved.payee !== item.payee ||
          saved.date !== item.date ||
          remoteUsage !== localUsage ||
          installmentSignature(saved) !== installmentSignature(item);
      });

      if (needsSync.length) await window.paymoSyncExpenses(needsSync);

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

    try { await api('POST', { expense }); } catch {}
  };

  syncFromD1();
})();
