(() => {
  const originalRender = typeof render === 'function' ? render : null;
  if (!originalRender) return;

  const usageDateOf = (expense) => expense?.usageDate || expense?.usage_date || expense?.date || '';
  const billingDateOf = (expense) => expense?.date || '';

  function formatDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return '日付なし';
    const [year, month, day] = value.split('-');
    return `${year}/${Number(month)}/${Number(day)}`;
  }

  function ensureStyle() {
    if (document.getElementById('paymo-history-payment-style')) return;
    const style = document.createElement('style');
    style.id = 'paymo-history-payment-style';
    style.textContent = `
      .expense-history-card .history-right{
        flex:0 0 auto;
        display:flex;
        flex-direction:column;
        align-items:flex-end;
        gap:4px;
        text-align:right;
      }
      .expense-history-card .history-billing-date{
        font-size:11px;
        line-height:1.2;
        color:var(--muted);
        font-weight:700;
        white-space:nowrap;
      }
    `;
    document.head.appendChild(style);
  }

  function enhanceHistory() {
    ensureStyle();
    const rows = Array.from(document.querySelectorAll('#expenseHistoryRows .history-entry'));
    if (!rows.length) return;

    const sorted = expenses
      .map((expense, index) => ({ expense, index, usageDate: usageDateOf(expense) }))
      .sort((a, b) => {
        const dateOrder = String(b.usageDate).localeCompare(String(a.usageDate));
        return dateOrder || b.index - a.index;
      });

    rows.forEach((row, index) => {
      const expense = sorted[index]?.expense;
      if (!expense) return;

      let right = row.querySelector('.history-right');
      const amount = row.querySelector('.history-amount');
      if (!right) {
        right = document.createElement('div');
        right.className = 'history-right';
        if (amount) right.appendChild(amount);
        row.appendChild(right);
      }

      let billing = right.querySelector('.history-billing-date');
      if (!billing) {
        billing = document.createElement('div');
        billing.className = 'history-billing-date';
      }
      right.insertBefore(billing, amount || right.firstChild);
      billing.textContent = `請求日：${formatDate(billingDateOf(expense))}`;
    });
  }

  render = function (...args) {
    const result = originalRender(...args);
    enhanceHistory();
    return result;
  };

  enhanceHistory();
})();
