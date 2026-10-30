(() => {
  let selected = null;

  const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
  const usageDateOf = (expense) => expense?.usageDate || expense?.usage_date || expense?.date || '';
  const isPaid = (expense) => expense?.paid === true || expense?.paid === 1 || expense?.paid === '1';
  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  function shortDate(value) {
    if (!validDate(value)) return '--/--';
    const [, month, day] = String(value).split('-');
    return `${Number(month)}/${Number(day)}`;
  }

  function ensureStyle() {
    if (document.getElementById('paymo-graph-detail-edit-style')) return;
    const style = document.createElement('style');
    style.id = 'paymo-graph-detail-edit-style';
    style.textContent = `
      #paymoGraphDetail .paymo-graph-detail-group-name,
      #paymoGraphDetail .paymo-graph-detail-group-total{font-size:17px!important}
      #paymoGraphDetail .paymo-graph-detail-columns,
      #paymoGraphDetail .paymo-graph-detail-row{
        display:grid!important;
        grid-template-columns:minmax(0,1fr) 92px 112px;
        align-items:center;
        column-gap:12px;
        width:100%;
        box-sizing:border-box;
      }
      #paymoGraphDetail .paymo-graph-detail-columns{
        padding:8px 0 4px;
        color:var(--muted);
        font-size:11px;
        font-weight:800;
      }
      #paymoGraphDetail .paymo-graph-detail-columns span:first-child{text-align:left}
      #paymoGraphDetail .paymo-graph-detail-columns span:nth-child(2){text-align:center}
      #paymoGraphDetail .paymo-graph-detail-columns span:last-child{text-align:right}
      #paymoGraphDetail .paymo-graph-detail-row{
        cursor:pointer;
        -webkit-tap-highlight-color:transparent;
      }
      #paymoGraphDetail .paymo-graph-detail-row:active{opacity:.62}
      #paymoGraphDetail .paymo-graph-detail-date,
      #paymoGraphDetail .paymo-graph-detail-due,
      #paymoGraphDetail .paymo-graph-detail-amount{
        font-variant-numeric:tabular-nums;
        font-feature-settings:"tnum" 1;
      }
      #paymoGraphDetail .paymo-graph-detail-date,
      #paymoGraphDetail .paymo-graph-detail-due{
        width:auto!important;
        flex:0 0 auto!important;
        font-size:14px!important;
        white-space:nowrap;
      }
      #paymoGraphDetail .paymo-graph-detail-due{text-align:center;color:var(--text,#fff);font-weight:850}
      #paymoGraphDetail .paymo-graph-detail-date{text-align:left;color:var(--muted);font-weight:750}
      #paymoGraphDetail .paymo-graph-detail-amount-cell{min-width:0;text-align:right}
      #paymoGraphDetail .paymo-graph-detail-amount{
        margin-left:0!important;
        font-size:16px!important;
        text-align:right!important;
      }
      #paymoGraphDetail .paymo-graph-detail-paid{
        display:block;
        margin-top:2px;
        font-size:10px!important;
        text-align:right;
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
      .map((expense, index) => ({
        expense,
        index,
        usageDate: usageDateOf(expense),
        dueDate: billingPartsOf(expense)[0]?.date || '',
        amount: Number(expense.amount || 0)
      }))
      .filter(({ expense, usageDate, amount }) => amount && usageDate && ym(usageDate) === month && String(expense.payee || 'その他') === payee)
      .sort((a, b) => String(b.usageDate).localeCompare(String(a.usageDate)) || b.index - a.index);
  }

  function billingRows(month, payee) {
    const rows = [];
    expenses.forEach((expense, index) => {
      if (isPaid(expense) || String(expense.payee || 'その他') !== payee) return;
      billingPartsOf(expense).forEach((part, partIndex) => {
        if (!part.date || ym(part.date) !== month || !part.amount) return;
        rows.push({
          expense,
          index,
          partIndex,
          usageDate: usageDateOf(expense),
          dueDate: part.date,
          amount: Number(part.amount || 0)
        });
      });
    });
    return rows.sort((a, b) => String(b.dueDate).localeCompare(String(a.dueDate)) || b.index - a.index || b.partIndex - a.partIndex);
  }

  function ensureColumnHeader(group) {
    let header = group.querySelector('.paymo-graph-detail-columns');
    if (header) return header;
    header = document.createElement('div');
    header.className = 'paymo-graph-detail-columns';
    header.innerHTML = '<span>利用日</span><span>支払期日</span><span>金額</span>';
    group.querySelector('.paymo-graph-detail-group-head')?.insertAdjacentElement('afterend', header);
    return header;
  }

  function annotateRows() {
    if (!selected) return;
    document.querySelectorAll('#paymoGraphDetail .paymo-graph-detail-group').forEach((group) => {
      const payee = group.querySelector('.paymo-graph-detail-group-name')?.textContent?.trim() || '';
      if (!payee) return;
      const source = selected.mode === 'billing' ? billingRows(selected.month, payee) : usageRows(selected.month, payee);
      ensureColumnHeader(group);
      group.querySelectorAll('.paymo-graph-detail-row').forEach((row, index) => {
        const item = source[index];
        if (!item) return;
        const id = item.expense?.id;
        if (id !== undefined && id !== null) row.dataset.expenseId = String(id);
        row.innerHTML = `
          <span class="paymo-graph-detail-date">${escapeHtml(shortDate(item.usageDate))}</span>
          <span class="paymo-graph-detail-due">${escapeHtml(shortDate(item.dueDate))}</span>
          <span class="paymo-graph-detail-amount-cell">
            <span class="paymo-graph-detail-amount">${yen(item.amount)}</span>
            ${selected.mode === 'usage' && isPaid(item.expense) ? '<span class="paymo-graph-detail-paid">支払い済</span>' : ''}
          </span>`;
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
