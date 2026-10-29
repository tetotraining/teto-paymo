(() => {
  const API = '/api/expenses';
  const BULK_DELETE_API = '/api/expenses/bulk-delete';
  const CLIENT_KEY_STORAGE = 'paymo-d1-client-key-v1';
  const PENDING_DELETE_KEY = 'paymo-pending-delete-v1';

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

  function readPendingDeletes() {
    try {
      const raw = JSON.parse(localStorage.getItem(PENDING_DELETE_KEY) || '[]');
      return Array.isArray(raw) ? raw.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
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

  async function bulkDelete(ids) {
    const unique = Array.from(new Set((Array.isArray(ids) ? ids : []).map(String).filter(Boolean)));
    if (!unique.length) return { ok: true, count: 0 };
    const response = await fetch(BULK_DELETE_API, {
      method: 'DELETE',
      headers: {
        'content-type': 'application/json',
        'x-paymo-key': clientKey
      },
      body: JSON.stringify({ ids: unique }),
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

  window.paymoDeleteExpenses = async (ids) => bulkDelete(ids);

  async function syncFromD1() {
    try {
      const pendingIds = readPendingDeletes();
      let pending = new Set(pendingIds);
      if (pendingIds.length) {
        try {
          await bulkDelete(pendingIds);
          localStorage.removeItem(PENDING_DELETE_KEY);
          pending = new Set();
        } catch {}
      }

      const local = JSON.parse(localStorage.getItem(KEY) || '[]')
        .filter((item) => !pending.has(String(item?.id || '')));
      const data = await api('GET');
      const remote = (Array.isArray(data.expenses) ? data.expenses : [])
        .filter((item) => !pending.has(String(item?.id || '')));
      const remoteById = new Map(remote.map(item => [item.id, item]));
      const needsSync = local.filter(item => {
        if (!item?.id || pending.has(String(item.id))) return false;
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
