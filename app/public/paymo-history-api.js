(() => {
  const CLIENT_KEY_STORAGE = 'paymo-d1-client-key-v1';
  window.paymoDeleteExpense = async (id) => {
    const key = localStorage.getItem(CLIENT_KEY_STORAGE) || '';
    if (!key || !id) return { ok: false, localOnly: true };
    try {
      const response = await fetch(`/api/expenses/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'x-paymo-key': key },
        cache: 'no-store'
      });
      if (!response.ok) return { ok: false, localOnly: true, status: response.status };
      return response.json();
    } catch {
      return { ok: false, localOnly: true };
    }
  };
})();
