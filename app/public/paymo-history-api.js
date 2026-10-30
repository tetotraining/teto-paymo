(() => {
  const TOKEN_KEY = 'paymo_token_v1';
  const PENDING_DELETE_KEY = 'paymo-pending-delete-v1';

  function queueDelete(id) {
    try {
      const saved = JSON.parse(localStorage.getItem(PENDING_DELETE_KEY) || '[]');
      const ids = new Set(Array.isArray(saved) ? saved.map(String) : []);
      ids.add(String(id));
      localStorage.setItem(PENDING_DELETE_KEY, JSON.stringify(Array.from(ids)));
    } catch {}
  }

  window.paymoDeleteExpense = async (id) => {
    const token = localStorage.getItem(TOKEN_KEY) || '';
    if (!token || !id) return { ok: false, localOnly: true };
    queueDelete(id);
    try {
      const response = await fetch(`/api/expenses/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      if (!response.ok) return { ok: false, localOnly: true, status: response.status };
      const result = await response.json();
      try {
        const saved = JSON.parse(localStorage.getItem(PENDING_DELETE_KEY) || '[]');
        const next = (Array.isArray(saved) ? saved : []).map(String).filter((value) => value !== String(id));
        if (next.length) localStorage.setItem(PENDING_DELETE_KEY, JSON.stringify(next));
        else localStorage.removeItem(PENDING_DELETE_KEY);
      } catch {}
      return result;
    } catch {
      return { ok: false, localOnly: true };
    }
  };
})();
