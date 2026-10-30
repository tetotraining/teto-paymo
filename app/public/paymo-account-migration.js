(() => {
  const TOKEN_KEY = 'paymo_token_v1';
  const HYDRATED_KEY = 'paymo-account-hydrated-v1';
  const DIRTY_KEY = 'paymo-dirty-expenses-v1';
  const EXPENSE_KEY = 'ready-expenses-v1';
  if (!localStorage.getItem(TOKEN_KEY) || localStorage.getItem(HYDRATED_KEY) === '1') return;
  try {
    const rows = JSON.parse(localStorage.getItem(EXPENSE_KEY) || '[]');
    const ids = Array.isArray(rows) ? rows.map((item) => String(item?.id || '')).filter(Boolean) : [];
    if (ids.length) localStorage.setItem(DIRTY_KEY, JSON.stringify(Array.from(new Set(ids))));
  } catch {}
})();
