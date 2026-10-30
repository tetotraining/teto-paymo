(() => {
  let selected = null;

  const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
  const usageDateOf = (expense) => expense?.usageDate || expense?.usage_date || expense?.date || '';
  const isPaid = (expense) => expense?.paid === true || expense?.paid === 1 || expense?.paid === '1';

  function ensureStyle() {
    if (document.getElementById('paymo-graph-detail-edit-style')) return;
    const style = document.createElement('style');
    style.id = 'paymo-graph-detail-edit-style';
    style.textContent = `
      #paymoGraphDetail .paymo-graph-detail-group-name,
      #paymoGraphDetail .paymo-graph-detail-group-total{font-size:17px!important}
      #paymoGraphDetail .paymo-graph-detail-row{
        justify-content:space-between!important;
        gap:14px!important;
        cursor:pointer;
        -webkit-tap-highlight-color:transparent;
      }
      #paymoGraphDetail .paymo-graph-detail-row:active{opacity:.62}
      #paymoGraphDetail .paymo-graph-detail-date{
        order:1;
        width:auto!important;
        flex:0 0 auto!important;
        font-size:14px!important;
      }
      #paymoGraphDetail .paymo-graph-detail-paid{
        order:2;
        margin-right:auto;
        font-size:11px!important;
      }
      #paymoGraphDetail .paymo-graph-detail-amount{
        order:3;
        margin-left:auto!important;
        font-size:16px!important;
        text-align:right!important;
      }
    `;
    document.head.appendChild(style);
  }

  function billingPartsOf(expense) {
    const raw = Array.isArray(expense?.installments) ? expense.installments : [];
    const parts = raw.slice(0, 3)
      .map((part) => ({ date: String(part?.date || ''), amount: Number(part?.amount || 0) }))
      .filter((part) => validDate(part.date) && part.amount > 0);
    if (parts.length && parts.reduce((sum, part) => sum + part.amount, 0) === Number(expense?.amount || 0)) return parts;
    return [{ date: String(expense?.date || ''), amount: Number(expense?.amount || 0) }];
  }

  function usageRows(month, payee) {
    return expenses
      .map((expense, index) => ({ expense, index, date: usageDateOf(expense), amount: Number(expense.amount || 0) }))
      .filter(({ expense, date, amount }) => amount && date && ym(date) === month && String(expense.payee || 'その他') === payee)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.index - a.index);
  }

  function billingRows(month, payee) {
    const rows = [];
    expenses.forEach((expense, index) => {
      if (isPaid(expense) || String(expense.payee || 'その他') !== payee) return;
      billingPartsOf(expense).forEach((part, partIndex) => {
        if (!part.date || ym(part.date) !== month || !part.amount) return;
        rows.push({ expense, index, partIndex, date: part.date, amount: Number(part.amount || 0) });
      });
    });
    return rows.sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.index - a.index || b.partIndex - a.partIndex);
  }

  function annotateRows() {
    if (!selected) return;
    document.querySelectorAll('#paymoGraphDetail .paymo-graph-detail-group').forEach((group) => {
      const payee = group.querySelector('.paymo-graph-detail-group-name')?.textContent?.trim() || '';
      if (!payee) return;
      const source = selected.mode === 'billing' ? billingRows(selected.month, payee) : usageRows(selected.month, payee);
      group.querySelectorAll('.paymo-graph-detail-row').forEach((row, index) => {
        const id = source[index]?.expense?.id;
        if (id !== undefined && id !== null) row.dataset.expenseId = String(id);
      });
    });
  }

  function captureEditorOpener(id) {
    const direct = Array.from(document.querySelectorAll('#expenseHistoryRows .history-entry'))
      .find((row) => row.dataset.expenseId === String(id));
    if (typeof direct?.onclick === 'function') return direct.onclick;

    const originalQuerySelectorAll = document.querySelectorAll;
    const fakeRows = Array.from({ length: expenses.length }, () => document.createElement('div'));
    let opener = null;

    try {
      document.querySelectorAll = function (selector) {
        if (selector === '#expenseHistoryRows .history-entry') return fakeRows;
        return originalQuerySelectorAll.call(this, selector);
      };
      if (typeof render === 'function') render();
      const target = fakeRows.find((row) => row.dataset.expenseId === String(id));
      if (typeof target?.onclick === 'function') opener = target.onclick;
    } catch {} finally {
      document.querySelectorAll = originalQuerySelectorAll;
    }

    try { if (typeof render === 'function') render(); } catch {}
    return opener;
  }

  document.addEventListener('click', (event) => {
    const segment = event.target?.closest?.('#graphChart .stack-segment,#homeChart .stack-segment');
    if (!segment) return;
    const chart = segment.closest('#graphChart,#homeChart');
    const bar = segment.closest('.bar-wrap');
    if (!chart || !bar) return;
    const bars = Array.from(chart.querySelectorAll('.bar-wrap'));
    const index = bars.indexOf(bar);
    if (index < 0) return;
    selected = {
      month: monthKey(index - Math.floor(bars.length / 2)),
      mode: chart.id === 'homeChart' ? 'billing' : 'usage'
    };
    requestAnimationFrame(() => requestAnimationFrame(annotateRows));
  }, true);

  document.addEventListener('click', (event) => {
    const row = event.target?.closest?.('#paymoGraphDetail .paymo-graph-detail-row');
    if (!row) return;
    annotateRows();
    const id = row.dataset.expenseId;
    if (!id) return;
    const opener = captureEditorOpener(id);
    if (typeof opener !== 'function') return;

    event.preventDefault();
    event.stopPropagation();
    const back = document.getElementById('paymoGraphDetailBack');
    if (back) {
      back.click();
      setTimeout(() => opener(), 260);
    } else {
      opener();
    }
  }, true);

  ensureStyle();
})();
