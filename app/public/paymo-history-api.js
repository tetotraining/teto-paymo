(() => {
  const CLIENT_KEY_STORAGE = 'paymo-d1-client-key-v1';
  window.paymoDeleteExpense = async (id) => {
    const key = localStorage.getItem(CLIENT_KEY_STORAGE) || '';
    if (!key || !id) throw new Error('missing delete key');
    const response = await fetch(`/api/expenses/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'x-paymo-key': key },
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`DELETE ${response.status}`);
    return response.json();
  };
})();
