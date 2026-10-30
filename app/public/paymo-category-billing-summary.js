(() => {
  const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
  const yen = (value) => '¥' + Number(value || 0).toLocaleString('ja-JP');
  let observer = null;
  let refreshing = false;

  function source() {
    if (Array.isArray(window.expenses)) return window.expenses;
    try { return JSON.parse(localStorage.getItem('ready-expenses-v1') || '[]'); } catch (_) { return []; }
  }

  function payeeOf(expense) {
    return String(expense?.payee || expense?.item || expense?.name || 'その他');
  }

  function billingPartsOf(expense) {
    const raw = Array.isArray(expense?.installments) ? expense.installments : [];
    const parts = raw.slice(0, 3)
      .map((part) => ({ date: String(part?.date || ''), amount: Number(part?.amount || 0) }))
      .filter((part) => validDate(part.date) && part.amount > 0);
    if (parts.length && parts.reduce((sum, part) => sum + part.amount, 0) === Number(expense?.amount || 0)) return parts;
    return [{ date: String(expense?.date || ''), amount: Number(expense?.amount || 0) }];
  }

  function monthKeyOffset(offset) {
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  function monthLabel(key) {
    const month = Number(String(key || '').split('-')[1] || 0);
    return month ? `${month}月` : '';
  }

  function monthTotalByBillingDate(name, key) {
    return source().reduce((total, expense) => {
      if (payeeOf(expense) !== name) return total;
      return total + billingPartsOf(expense).reduce((sum, part) => {
        return String(part.date || '').slice(0, 7) === key ? sum + Number(part.amount || 0) : sum;
      }, 0);
    }, 0);
  }

  function setText(el, value) {
    if (el && el.textContent !== value) el.textContent = value;
  }

  function refresh() {
    if (refreshing) return;
    const page = document.getElementById('paymoCategoryDetail');
    const title = document.getElementById('paymoCategoryDetailTitle');
    const total = document.getElementById('paymoCategoryDetailTotal');
    const list = document.getElementById('paymoCategoryDetailOtherMonths');
    const name = title?.textContent?.trim() || '';
    if (!page || !name || !total || !list) return;

    refreshing = true;
    const currentKey = monthKeyOffset(0);
    setText(document.getElementById('paymoCategoryDetailMonth'), monthLabel(currentKey));
    setText(total, yen(monthTotalByBillingDate(name, currentKey)));

    const keys = [monthKeyOffset(2), monthKeyOffset(1), monthKeyOffset(-1), monthKeyOffset(-2)];
    const rows = Array.from(list.querySelectorAll('.category-detail-month-row'));
    keys.forEach((key, index) => {
      const row = rows[index];
      if (!row) return;
      setText(row.querySelector('.category-detail-month-label'), monthLabel(key));
      setText(row.querySelector('.category-detail-month-amount'), yen(monthTotalByBillingDate(name, key)));
    });
    refreshing = false;
  }

  function observeSummary() {
    const wrap = document.querySelector('#paymoCategoryDetail .category-detail-summary-wrap');
    if (!wrap || observer) return;
    observer = new MutationObserver(() => queueMicrotask(refresh));
    observer.observe(wrap, { childList:true, subtree:true, characterData:true });
  }

  function refreshSoon() {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      observeSummary();
      refresh();
    }));
  }

  document.addEventListener('click', (event) => {
    if (event.target?.closest?.('#categorySpendRows .category-history-title')) refreshSoon();
  }, true);

  window.addEventListener('paymo-expenses-updated', refreshSoon);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshSoon(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refreshSoon, { once:true });
  else refreshSoon();
})();
