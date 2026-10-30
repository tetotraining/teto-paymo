(() => {
  const API = '/api/expenses';
  const BULK_DELETE_API = '/api/expenses/bulk-delete';
  const SETTINGS_API = '/api/settings';
  const TOKEN_KEY = 'paymo_token_v1';
  const PENDING_DELETE_KEY = 'paymo-pending-delete-v1';
  const DIRTY_KEY = 'paymo-dirty-expenses-v1';
  const HYDRATED_KEY = 'paymo-account-hydrated-v1';
  const PAYEE_KEY = 'paymo_payees_v1';
  let syncing = false;
  let poller = null;

  const token = () => localStorage.getItem(TOKEN_KEY) || '';
  const authHeaders = () => ({
    'content-type': 'application/json',
    ...(token() ? { authorization: `Bearer ${token()}` } : {})
  });

  function installmentSignature(item) {
    const raw = Array.isArray(item?.installments) && item.installments.length
      ? item.installments
      : [{ date: item?.date || '', amount: Number(item?.amount || 0) }];
    return JSON.stringify(raw.slice(0, 3).map((part) => ({ date: String(part?.date || ''), amount: Number(part?.amount || 0) })));
  }

  const paidOf = (item) => item?.paid === true || item?.paid === 1 || item?.paid === '1';

  function readIds(key) {
    try {
      const raw = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(raw) ? raw.map(String).filter(Boolean) : [];
    } catch { return []; }
  }

  function writeIds(key, ids) {
    const unique = Array.from(new Set((ids || []).map(String).filter(Boolean)));
    if (unique.length) localStorage.setItem(key, JSON.stringify(unique));
    else localStorage.removeItem(key);
  }

  function markDirty(rows) {
    const ids = new Set(readIds(DIRTY_KEY));
    (Array.isArray(rows) ? rows : []).forEach((item) => { if (item?.id) ids.add(String(item.id)); });
    writeIds(DIRTY_KEY, Array.from(ids));
  }

  function clearDirty(ids) {
    const done = new Set((ids || []).map(String));
    writeIds(DIRTY_KEY, readIds(DIRTY_KEY).filter((id) => !done.has(id)));
  }

  async function expenseApi(method = 'GET', body) {
    const response = await fetch(API, {
      method,
      headers: authHeaders(),
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`API ${response.status}`);
    return response.json();
  }

  async function settingsApi(method = 'GET', body) {
    const response = await fetch(SETTINGS_API, {
      method,
      headers: authHeaders(),
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`Settings API ${response.status}`);
    return response.json();
  }

  async function postExpenses(rows) {
    const clean = Array.isArray(rows) ? rows.filter((item) => item?.id) : [];
    if (!clean.length) return { ok: true, count: 0 };
    const result = await expenseApi('POST', { expenses: clean });
    clearDirty(clean.map((item) => item.id));
    return result;
  }

  async function bulkDelete(ids) {
    const unique = Array.from(new Set((Array.isArray(ids) ? ids : []).map(String).filter(Boolean)));
    if (!unique.length) return { ok: true, count: 0 };
    writeIds(PENDING_DELETE_KEY, [...readIds(PENDING_DELETE_KEY), ...unique]);
    const response = await fetch(BULK_DELETE_API, {
      method: 'DELETE',
      headers: authHeaders(),
      body: JSON.stringify({ ids: unique }),
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`API ${response.status}`);
    const result = await response.json();
    const done = new Set(unique);
    writeIds(PENDING_DELETE_KEY, readIds(PENDING_DELETE_KEY).filter((id) => !done.has(id)));
    clearDirty(unique);
    return result;
  }

  window.paymoSyncExpenses = async (rows) => {
    const clean = Array.isArray(rows) ? rows.filter((item) => item?.id) : [];
    if (!clean.length || !token()) return;
    markDirty(clean);
    return postExpenses(clean);
  };

  window.paymoDeleteExpenses = async (ids) => {
    if (!token()) return { ok: false, localOnly: true };
    return bulkDelete(ids);
  };

  window.paymoSyncSettings = async (value) => {
    if (!token()) return;
    return settingsApi('POST', value || {});
  };

  function applyPayees(payees) {
    if (!Array.isArray(payees)) return;
    const clean = payees.filter((item) => item && typeof item.name === 'string' && typeof item.color === 'string');
    const before = localStorage.getItem(PAYEE_KEY) || '';
    const next = JSON.stringify(clean);
    if (before !== next) localStorage.setItem(PAYEE_KEY, next);
    try {
      if (typeof PAYEES !== 'undefined') {
        PAYEES.splice(0, PAYEES.length, ...clean.map((item) => ({ ...item })));
        if (typeof selectedPayee !== 'undefined' && !PAYEES.some((item) => item.name === selectedPayee)) selectedPayee = PAYEES[0]?.name || '';
        if (typeof renderPayees === 'function') renderPayees();
        if (typeof render === 'function') render();
      }
    } catch {}
    window.dispatchEvent(new CustomEvent('paymo:settings-synced', { detail: { payees: clean } }));
  }

  async function syncSettings(firstHydration) {
    const data = await settingsApi('GET');
    if (Array.isArray(data?.payees)) {
      applyPayees(data.payees);
      return;
    }
    if (!firstHydration) return;
    try {
      const local = JSON.parse(localStorage.getItem(PAYEE_KEY) || '[]');
      if (Array.isArray(local) && local.length) await settingsApi('POST', { payees: local });
    } catch {}
  }

  function sameSnapshot(a, b) {
    return Number(a?.amount || 0) === Number(b?.amount || 0) &&
      String(a?.payee || '') === String(b?.payee || '') &&
      String(a?.date || '') === String(b?.date || '') &&
      String(a?.usageDate || a?.usage_date || a?.date || '') === String(b?.usageDate || b?.usage_date || b?.date || '') &&
      installmentSignature(a) === installmentSignature(b) &&
      paidOf(a) === paidOf(b);
  }

  async function syncFromD1() {
    if (syncing || !token() || document.hidden) return;
    syncing = true;
    try {
      const pendingIds = readIds(PENDING_DELETE_KEY);
      if (pendingIds.length) {
        try { await bulkDelete(pendingIds); } catch {}
      }
      const pending = new Set(readIds(PENDING_DELETE_KEY));
      const firstHydration = localStorage.getItem(HYDRATED_KEY) !== '1';
      const local = (() => {
        try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
        catch { return []; }
      })().filter((item) => item?.id && !pending.has(String(item.id)));
      const dirty = new Set(readIds(DIRTY_KEY));

      const data = await expenseApi('GET');
      const remote = (Array.isArray(data?.expenses) ? data.expenses : [])
        .filter((item) => item?.id && !pending.has(String(item.id)));
      const remoteById = new Map(remote.map((item) => [String(item.id), item]));

      const toPush = local.filter((item) => dirty.has(String(item.id)) || (firstHydration && !remoteById.has(String(item.id))));
      if (toPush.length) {
        await postExpenses(toPush);
        toPush.forEach((item) => remoteById.set(String(item.id), item));
      }

      const next = Array.from(remoteById.values());
      const currentById = new Map(local.map((item) => [String(item.id), item]));
      const changed = next.length !== local.length || next.some((item) => !sameSnapshot(item, currentById.get(String(item.id))));
      expenses = next;
      localStorage.setItem(KEY, JSON.stringify(expenses));
      if (changed && typeof render === 'function') render();

      await syncSettings(firstHydration);
      localStorage.setItem(HYDRATED_KEY, '1');
    } catch {
      // 通信失敗時は端末内キャッシュを維持し、次回同期で再試行する。
    } finally {
      syncing = false;
    }
  }

  window.paymoRefreshAccountData = syncFromD1;

  const originalSave = $('saveBtn');
  if (originalSave) originalSave.onclick = async () => {
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
    try { await window.paymoSyncExpenses([expense]); } catch {}
  };

  function startPolling() {
    if (poller) clearInterval(poller);
    poller = setInterval(syncFromD1, 5000);
    syncFromD1();
  }

  window.addEventListener('paymo:authenticated', startPolling);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && token()) syncFromD1(); });
  window.addEventListener('online', () => { if (token()) syncFromD1(); });
  if (token()) startPolling();
})();
